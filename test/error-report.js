const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const port = 3198;
const token = 'local-error-test';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, PORT: String(port), BRIDGE_TOKEN: token }, windowsHide: true
});
async function api(endpoint, method = 'GET', data) {
  const response = await fetch(base + endpoint, {
    method, headers: { 'x-bridge-token': token, 'content-type': 'application/json' },
    body: data && JSON.stringify(data)
  });
  return { status: response.status, body: await response.json() };
}
(async () => {
  try {
    for (let i = 0; i < 20; i++) {
      try { await api('/api/state'); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    const provider = (await api('/api/register', 'POST', {
      protocolVersion: 3, name: 'PC-3050', slots: 1, gpuRender: true
    })).body.id;
    const job = (await api('/api/job', 'POST', {
      mode: 'blender', width: 200, height: 200, samples: 8, frames: 2
    })).body.id;
    const task = (await api(`/api/task?provider=${provider}&kind=gpu`)).body.task;
    const original = { providerId: provider, jobId: job, taskId: task.taskId,
      error: 'Blender 3.6: Transmission Weight absent' };
    assert.equal((await api('/api/failure', 'POST', original)).status, 200);
    assert.equal((await api('/api/failure', 'POST', { ...original, error: 'Rezultat expirat' })).status, 409);
    const state = (await api('/api/state')).body;
    assert.equal(state.job.status, 'error');
    assert.match(state.job.error, /PC-3050: Blender 3.6/);
    const stale = await api('/api/result', 'POST', original);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'Lucrarea nu mai este activă');
    console.log('PASS: eroarea inițială rămâne vizibilă');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally { server.kill(); }
})();
