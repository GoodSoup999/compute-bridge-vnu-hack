// Publish only the hub API, not the local desktop bridge or admin channel.
const { spawn } = require('node:child_process');
const path = require('node:path');
const port = Number(process.env.HUB_PORT || 8787);
const binary = process.env.CLOUDFLARED_PATH || 'cloudflared';
const check = spawn(binary, ['--version'], { windowsHide: true, stdio: 'pipe' });
check.on('error', () => { console.error('Instalează cloudflared din sursa oficială. Windows: winget install --id Cloudflare.cloudflared --exact. Arch: sudo pacman -S cloudflared'); process.exitCode = 1; });
check.on('exit', code => {
  if (code !== 0) return;
  const hub = spawn(process.execPath, [path.join(__dirname, '../cloud/server.js')], { windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, HUB_BIND: '127.0.0.1' } });
  let tunnel; let started = false; let stopping = false;
  const stop = () => { if (stopping) return; stopping = true; tunnel?.kill(); hub.kill(); };
  hub.stdout.on('data', data => {
    process.stdout.write(data);
    if (!started && String(data).includes('Compute Bridge Hub:')) {
      started = true; tunnel = spawn(binary, ['tunnel', '--url', `http://127.0.0.1:${port}`], { windowsHide: true, stdio: 'inherit' });
      tunnel.on('exit', stop); tunnel.on('error', e => { console.error(e.message); stop(); });
      console.log('Folosiți adresa HTTPS trycloudflare afișată mai jos în toate aplicațiile. Se schimbă la repornirea tunelului.');
    }
  });
  hub.on('exit', stop); hub.on('error', e => { console.error(e.message); stop(); });
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
});
