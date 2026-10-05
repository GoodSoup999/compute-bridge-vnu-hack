const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { validateBundle, validateOutput } = require('./workload-bundle');
const IMAGE = 'compute-bridge/workloads:0.7.0';
function binary() {
  const installed = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker/Docker/resources/bin/docker.exe');
  return process.platform === 'win32' && fs.existsSync(installed) ? installed : 'docker';
}
function command(args, timeout = 10000) {
  return new Promise((resolve, reject) => execFile(binary(), args, { timeout, windowsHide: true, maxBuffer: 12 * 1024 * 1024 }, (error, out, err) => error ? reject(new Error(String(err || error.message).slice(-2000))) : resolve(String(out))));
}
async function detect() {
  try {
    const engine = (await command(['version', '--format', '{{.Server.Os}}'], 6000)).trim();
    if (engine !== 'linux') return { ready: false, reason: 'Docker trebuie să folosească containere Linux.' };
    const imageId = (await command(['image', 'inspect', IMAGE, '--format', '{{.Id}}'], 6000)).trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('Imagine invalidă');
    return { ready: true, imageId, reason: '' };
  } catch { return { ready: false, reason: 'Pornește Docker Desktop și pregătește mediul Compute Bridge (npm run runtime:prepare).' }; }
}
async function run(agent, task) {
  const runtime = await detect(); if (!runtime.ready) throw new Error(runtime.reason);
  const file = await agent.downloadProject(task.project, true, task.lease);
  if(!agent.running || agent.active.get(task.lease)?.cancelled)throw new Error('Sarcina a fost anulată');
  const bundle = validateBundle(fs.readFileSync(file));
  if (bundle.kind !== task.mode) throw new Error('Tipul pachetului nu corespunde lucrării');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'compute-bridge-workload-'));
  const name = 'cb-' + crypto.randomBytes(12).toString('hex');
  try {
    for (const input of bundle.files) {
      const target = path.resolve(directory, ...input.path.split('/'));
      if (!target.startsWith(path.resolve(directory) + path.sep)) throw new Error('Cale de intrare invalidă');
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, Buffer.from(input.data, 'base64'));
    }
    fs.writeFileSync(path.join(directory, 'task.json'), JSON.stringify({ ...bundle, files: undefined }));
    // The container's unprivileged user must be able to read the input directory.
    fs.chmodSync(directory, 0o755);
    const cpus = Math.max(.1, Math.min(Number(agent.config.slots) || 1, (Number(agent.config.slots) || 1) * Number(agent.config.cpuPercent) / 100));
    const memory = Math.max(1, Math.min(8, Number(task.resources?.ramGb) || 2));
    const args = ['run', '--name', name, '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--user', '65534:65534', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges=true', '--pids-limit', '64', '--memory', memory + 'g', '--memory-swap', memory + 'g', '--cpus', String(cpus), '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=256m,mode=1777', '--tmpfs', '/outputs:rw,nosuid,nodev,size=16m,mode=1777', '--mount', 'type=bind,source=' + directory + ',target=/inputs,readonly', runtime.imageId];
    const logs = await new Promise((resolve, reject) => {
      const child = spawn(binary(), args, { windowsHide: true }); agent.children.add(child);
      let out = '', err = '', finished = false;
      const remove = () => command(['rm', '-f', name], 15000).catch(() => {});
      const kill = () => { const removed=remove(); child.kill(); return removed; };
      const active = agent.active.get(task.lease);
      if (active) active.cancel = () => { active.cancelled = true; return kill(); };
      const timeout = setTimeout(() => { err = 'Execuția a depășit 5 minute'; kill(); }, 300000);
      child.stdout.on('data', part => { out += String(part); if (out.length > 10 * 1024 * 1024) { err = 'Rezultatul depășește limita'; kill(); } });
      child.stderr.on('data', part => { err = (err + String(part)).slice(-12000); });
      const done = async (error, code) => {
        if (finished) return; finished = true; clearTimeout(timeout); agent.children.delete(child); await remove();
        if (error || code !== 0 || active?.cancelled || !agent.running) reject(new Error(err.slice(-4000) || error?.message || 'Execuție anulată'));
        else resolve(out);
      };
      child.once('error', error => done(error)); child.once('close', code => done(null, code));
      if (!agent.running || active?.cancelled) kill();
    });
    let value; try { value = JSON.parse(logs); } catch { throw new Error('Mediul de execuție a întors un rezultat invalid'); }
    return { artifact: validateOutput(value) };
  } finally {
    await command(['rm', '-f', name], 15000).catch(() => {});
    if (!path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'compute-bridge-workload-')) throw new Error('Director temporar invalid');
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
module.exports = { IMAGE, detect, run, command };
