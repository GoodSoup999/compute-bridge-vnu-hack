// Optional integration check on a Windows PC with Blender and an NVIDIA GPU.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const base = 'http://127.0.0.1:3199';
const token = 'local-smoke-test';
const root = path.join(__dirname, '..');
const processes = [];
const logs = [];

function start(file, args = [], env = {}) {
  const child = spawn(process.execPath, [path.join(root, file), ...args], {
    cwd: root, env: { ...process.env, ...env }, windowsHide: true
  });
  child.stdout.on('data', chunk => logs.push(String(chunk)));
  child.stderr.on('data', chunk => logs.push(String(chunk)));
  processes.push(child);
}
async function api(endpoint, method = 'GET', data) {
  const response = await fetch(base + endpoint, {
    method, headers: { 'x-bridge-token': token, 'content-type': 'application/json' },
    body: data && JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`${endpoint}: ${response.status} ${await response.text()}`);
  return response;
}
async function until(predicate, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try { const value = await predicate(); if (value) return value; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Timeout\n' + logs.join('').slice(-4000));
}

(async () => {
  try {
    start('server.js', [], { PORT: '3199', BRIDGE_TOKEN: token });
    await until(async () => (await api('/api/state')).ok, 10);
    for (const name of ['Test-A', 'Test-B']) {
      start('provider.js', ['--server', base, '--token', token, '--name', name,
        '--slots', '1', '--vram', '8', '--rate', '3', '--watts', '160']);
    }
    await until(async () => {
      const state = await (await api('/api/state')).json();
      return state.providers.length === 2 && state.providers.every(p => p.gpuRender);
    }, 15);
    await api('/api/job', 'POST', { mode: 'blender', frames: 2, width: 320, height: 200, samples: 16 });
    const state = await until(async () => {
      const current = await (await api('/api/state')).json();
      if (current.job?.status === 'error') throw new Error(current.job.error);
      return current.job?.status === 'done' ? current : null;
    }, 120);
    assert.equal(state.job.done, 2);
    assert.equal(Object.keys(state.job.contributions).length, 2);
    for (const item of Object.values(state.job.contributions)) assert.match(item.gpuBackend, /OPTIX|CUDA/);
    for (let i = 0; i < 2; i++) {
      const image = Buffer.from(await (await api(`/api/frame/${i}`)).arrayBuffer());
      assert.equal(image.subarray(1, 4).toString(), 'PNG');
      assert.equal(image.readUInt32BE(16), 320);
    }
    await api('/api/job', 'POST', { mode: 'fractal', width: 200, height: 200, iterations: 100 });
    await until(async () => (await (await api('/api/state')).json()).job?.status === 'done', 20);
    console.log('PASS: două cadre GPU pe doi furnizori și mod CPU funcțional');
  } catch (error) {
    console.error(error, logs.join('').slice(-4000));
    process.exitCode = 1;
  } finally {
    for (const child of processes) child.kill();
  }
})();
