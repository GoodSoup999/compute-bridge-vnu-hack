"""Trusted entrypoint in the workload image. User files are read-only in /inputs."""
import base64
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys

root = Path('/outputs')
bundle = json.loads(Path('/inputs/task.json').read_text())
entry = '/inputs/' + bundle['entry']
args = bundle.get('args', [])
kind = bundle['kind']
config = bundle.get('config', {})
if kind in ('python', 'ai', 'simulation'):
    command = ['python', '-u', entry, *args]
elif kind == 'compile':
    windows = config.get('target', 'windows') == 'windows'
    compiler = 'x86_64-w64-mingw32-g++' if windows else 'g++'
    command = [compiler, '-O2', '-std=c++17', entry, '-I', '/inputs', '-static', '-o', '/outputs/program.exe' if windows else '/outputs/program-linux']
elif kind == 'video':
    fmt = config.get('format', 'mp4')
    command = ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'warning', '-protocol_whitelist', 'file,pipe', '-i', entry,
               '-vf', f"scale={config['width']}:{config['height']}", '-t', '120', '-threads', '1', '-c:v', 'libx264' if fmt == 'mp4' else 'libvpx-vp9',
               '-c:a', 'aac' if fmt == 'mp4' else 'libopus', '-y', '/outputs/converted.' + fmt]
else:
    raise RuntimeError('Unsupported adapter')
process = subprocess.Popen(command, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
selector = selectors.DefaultSelector()
selector.register(process.stdout, selectors.EVENT_READ)
logs = bytearray()
while selector.get_map():
    for key, _ in selector.select(timeout=1):
        chunk = os.read(key.fileobj.fileno(), 8192)
        if not chunk:
            selector.unregister(key.fileobj)
            continue
        logs.extend(chunk)
        if len(logs) > 65536:
            os.killpg(process.pid, signal.SIGKILL)
            raise RuntimeError('Output log exceeds 64 KB')
code = process.wait()
if code != 0:
    print(logs.decode(errors='replace')[-12000:], file=sys.stderr)
    raise RuntimeError('Workload exit ' + str(code))
files = []
total = 0
for file in sorted(root.rglob('*')):
    if file.is_symlink():
        raise RuntimeError('Output symlinks are not accepted')
    if not file.is_file():
        continue
    if root.resolve() not in file.resolve().parents:
        raise RuntimeError('Output path escapes the result folder')
    if len(files) >= 64:
        raise RuntimeError('Maximum 64 output files')
    total += file.stat().st_size
    if total > 6 * 1024 * 1024:
        raise RuntimeError('Maximum 6 MB output')
    files.append({'path': file.relative_to(root).as_posix(), 'data': base64.b64encode(file.read_bytes()).decode()})
if not files:
    raise RuntimeError('Program must write results to /outputs')
print(json.dumps({'version': 1, 'exitCode': 0, 'logs': logs.decode(errors='replace'), 'files': files}))
