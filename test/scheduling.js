const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { encodeRgbPng } = require('../lib/png');

const port = 3197;
const token = 'local-scheduling-test';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, PORT: String(port), BRIDGE_TOKEN: token }, windowsHide: true
});
async function api(endpoint, method = 'GET', data) {
  const response = await fetch(base + endpoint, {
    method, headers: { 'x-bridge-token': token, 'content-type': 'application/json' },
    body: data && JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`${endpoint}: ${response.status} ${await response.text()}`);
  return response.json();
}
async function take(providerId, kind) {
  return (await api(`/api/task?provider=${providerId}&kind=${kind}`)).task;
}
async function complete(providerId, task) {
  const result = { providerId, jobId: task.jobId, taskId: task.taskId, durationMs: 100 };
  if (task.mode === 'blender') {
    result.image = encodeRgbPng(200, 200, Buffer.alloc(200 * 200 * 3)).toString('base64');
    result.gpuBackend = 'OPTIX:Test';
  } else {
    result.pixels = Buffer.alloc(task.width * task.rows * 3).toString('base64');
  }
  await api('/api/result', 'POST', result);
}
async function checkMode(mode, fast, slow) {
  await api('/api/job', 'POST', mode === 'blender'
    ? { mode, frames: 8, width: 200, height: 200, samples: 8 }
    : { mode, width: 200, height: 200, iterations: 100 });
  const fastFirst = await take(fast, mode === 'blender' ? 'gpu' : 'cpu');
  const slowFirst = await take(slow, mode === 'blender' ? 'gpu' : 'cpu');
  assert.ok(fastFirst && slowFirst);
  await complete(fast, fastFirst);
  let fastCount = 1;
  for (;;) {
    const task = await take(fast, mode === 'blender' ? 'gpu' : 'cpu');
    if (!task) break;
    await complete(fast, task);
    fastCount++;
  }
  assert.ok(fastCount > 1, 'PC-ul rapid trebuie să preia și sarcinile următoare');
  await complete(slow, slowFirst);
  const state = await api('/api/state');
  assert.equal(state.job.status, 'done');
  assert.equal(state.job.contributions.Fast.tiles, fastCount);
  assert.equal(state.job.contributions.Slow.tiles, 1);
  return fastCount;
}
(async () => {
  try {
    for (let i = 0; i < 20; i++) {
      try { await api('/api/state'); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    const fast = (await api('/api/register', 'POST', { protocolVersion: 3, name: 'Fast', slots: 1, gpuRender: true })).id;
    const slow = (await api('/api/register', 'POST', { protocolVersion: 3, name: 'Slow', slots: 1, gpuRender: true })).id;
    const gpu = await checkMode('blender', fast, slow);
    const cpu = await checkMode('fractal', fast, slow);
    console.log(`PASS: coadă dinamică GPU ${gpu}:1 cadre, CPU ${cpu}:1 bucăți`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally { server.kill(); }
})();
