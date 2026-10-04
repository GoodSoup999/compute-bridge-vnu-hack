// Starts the coordinator and two provider processes on this PC, to test the interface without a network.
// Usage: node scripts/local.js [--port 3000] [--gpu]
// --gpu lets the second provider render Blender frames (needs Blender and an NVIDIA GPU on this PC).
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const root = path.join(__dirname, '..');
const port = Number(arg('port', process.env.PORT || 3000));
const token = process.env.BRIDGE_TOKEN || crypto.randomBytes(12).toString('hex');
const base = `http://127.0.0.1:${port}`;
const children = [];

function start(name, script, args, quiet) {
  const child = spawn(process.execPath, [path.join(root, script), ...args], {
    cwd: root, env: { ...process.env, PORT: String(port), BRIDGE_TOKEN: token }, windowsHide: true
  });
  const print = stream => part => {
    for (const line of String(part).split(/\r?\n/)) {
      if (!line || (quiet && /^(Slot|GPU OPTIX|GPU CUDA)/.test(line))) continue;
      if (/^Cod de acces/.test(line)) continue; // printed below, together with the link
      stream.write(`[${name}] ${line}\n`);
    }
  };
  child.stdout.on('data', print(process.stdout));
  child.stderr.on('data', print(process.stderr));
  child.on('exit', code => {
    if (!stopping) console.error(`[${name}] s-a oprit (cod ${code}).`);
  });
  children.push(child);
  return child;
}

let stopping = false;
function stop() {
  stopping = true;
  for (const child of children) child.kill();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

(async () => {
  start('server', 'server.js', []);
  for (let i = 0; ; i++) {
    try {
      const response = await fetch(`${base}/api/state`, { headers: { 'x-bridge-token': token } });
      if (response.ok) break;
    } catch {}
    if (i > 50) { console.error('Serverul nu a pornit.'); stop(); }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const common = ['--server', base, '--token', token];
  start('PC-A', 'provider.js', [...common, '--name', 'PC-A local', '--slots', '2', '--ram', '16',
    '--gpu', 'GPU integrat', '--watts', '120', '--rate', '2'], true);
  start('PC-B', 'provider.js', [...common, '--name', 'PC-B local', '--slots', '4', '--ram', '32',
    ...(process.argv.includes('--gpu') ? ['--gpu', 'GPU local', '--vram', '8'] : ['--gpu', 'GPU local']),
    '--watts', '160', '--rate', '3'], true);
  console.log('');
  console.log(`Interfața NODE:     http://localhost:${port}/node#token=${token}`);
  console.log(`Interfața originală: http://localhost:${port}  (cod de acces: ${token})`);
  console.log('Ambii furnizori rulează pe acest PC, deci își împart același procesor. Ctrl+C oprește tot.');
})();
