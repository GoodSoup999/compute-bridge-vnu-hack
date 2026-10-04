const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let window, server;
async function main() {
  await app.whenReady();
  const job = { id: 'test-job', mode: 'fractal', status: 'running', provider: 'Seller', execution: 'remote', done: 0, total: 10, spent: 0, reserved: 30, contributions: {} };
  const state = { hub: { connected: true, message: 'Conectat' }, serverTime: Date.now(), hardware: { hostname: 'Test', threads: 8, ramGb: 16, gpus: [], gpuRenderReason: 'Test CPU' }, state: { user: { id: 'buyer', name: 'Test', credits: 100 }, devices: [], jobs: [job], ledger: [] }, agent: null };
  let delayNextState = false;
  server = http.createServer((req, res) => {
    if (req.url === '/local/state') {
      const body = JSON.stringify(state); const delay = delayNextState; delayNextState = false;
      return setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end(body); }, delay ? 300 : 0);
    }
    if (req.url === '/local/action') {
      job.status = 'cancelled'; job.reserved = 0; res.setHeader('content-type', 'application/json'); return res.end('{"ok":true}');
    }
    const file = ({ '/': 'hub.html', '/hub.js': 'hub.js', '/workload.js': 'workload.js', '/hub.css': 'hub.css', '/ui.css': 'ui.css' })[req.url];
    if (!file) { res.writeHead(404); return res.end(); }
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(path.join(__dirname, '../public', file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await window.loadURL('http://127.0.0.1:' + server.address().port);
  const run = code => window.webContents.executeJavaScript(code);
  for (let i = 0; i < 50 && !await run("!!document.querySelector('[data-cancel]')"); i++) await sleep(50);
  assert.equal(await run("document.querySelectorAll('[name=minRam],[name=minVram]').length"), 0);
  await run("document.getElementById('jobMode').value='blender'; conditional();");
  assert.match(await run("document.getElementById('requirements').textContent"), /4 GB RAM · 4 GB VRAM/);
  await run("document.querySelector('[name=width]').value=1600; document.querySelector('[name=height]').value=1000; conditional();");
  assert.match(await run("document.getElementById('requirements').textContent"), /6 GB RAM/);
  state.state.projects = [{ id: 'own-project', name: 'My animation.blend', bytes: 1000 }];
  await run('refresh(true)');
  await run("document.getElementById('project').value='own-project'; conditional();");
  assert.equal(await run("document.getElementById('startFrameLabel').hidden"), false);
  assert.equal(await run("document.querySelector('[name=frames]').min"), '1');
  assert.match(await run("document.getElementById('projectList').textContent"), /My animation.blend/);
  await run("tab('jobs'); const input=document.querySelector('.budgetForm input'); input.value='27'; input.focus();");
  job.done = 5;
  await run('refresh(true)');
  assert.match(await run("document.getElementById('jobs').textContent"), /5\/10/);
  assert.equal(await run("document.querySelector('.budgetForm input').value"), '27');
  assert.equal(await run("document.activeElement.name"), 'amount');
  delayNextState = true;
  await run('void refresh()');
  await sleep(50);
  await run("const cancel=document.querySelector('[data-cancel]'); cancel.focus(); cancel.click();");
  for (let i = 0; i < 50 && !await run("document.getElementById('jobs').textContent.includes('Anulat')"); i++) await sleep(50);
  assert.match(await run("document.getElementById('jobs').textContent"), /Anulat/);
  assert.equal(await run("!!document.querySelector('[data-cancel]')"), false);
  console.log('PASS UI: automatic memory estimates, progress while editing without lost draft/focus, cancellation visible despite focused button and in-flight stale refresh');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  window?.destroy(); if (server) await new Promise(resolve => server.close(resolve)); app.exit(process.exitCode || 0);
});
