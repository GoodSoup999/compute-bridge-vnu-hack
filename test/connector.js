// The connector used by the desktop app: it registers, works through a CPU job, and on stop
// shows up offline at once with its unfinished tasks back in the queue.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { Connector } = require('../lib/connector');

const port = 3196;
const token = 'local-connector-test';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, PORT: String(port), BRIDGE_TOKEN: token }, windowsHide: true
});
async function api(endpoint, method = 'GET', data) {
  const response = await fetch(base + endpoint, {
    method, headers: { 'x-bridge-token': token, 'content-type': 'application/json' }, body: data && JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`${endpoint}: ${response.status} ${await response.text()}`);
  return response.json();
}
async function until(check, seconds) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Timeout');
}

(async () => {
  const connector = new Connector({ server: `127.0.0.1:${port}`, token, name: 'Test-Conector', slots: 2 });
  try {
    await until(async () => { try { return await api('/api/state'); } catch { return null; } }, 5);
    const events = [];
    connector.on('task', task => events.push(task.phase));
    await connector.start();
    assert.equal(connector.state, 'connected');

    await api('/api/job', 'POST', { mode: 'fractal', width: 400, height: 320, iterations: 300 });
    const done = await until(async () => { const s = await api('/api/state'); return s.job.status === 'done' && s; }, 20);
    assert.equal(done.job.contributions['Test-Conector'].tiles, 10);
    assert.ok(events.includes('done'));

    await api('/api/job', 'POST', { mode: 'raytrace', width: 1600, height: 1000, samples: 1024 });
    await until(async () => (await api('/api/state')).job.tiles.some(t => t.status === 'assigned'), 10);
    await connector.stop();
    const after = await api('/api/state');
    assert.equal(after.providers[0].online, false, 'shown offline right after stopping');
    assert.ok(after.job.tiles.every(t => t.status !== 'assigned'), 'unfinished tasks are back in the queue');

    const wrong = new Connector({ server: `127.0.0.1:${port}`, token: 'gresit', slots: 1 });
    await assert.rejects(wrong.start(), /Codul de acces nu e corect/);
    const away = new Connector({ server: '127.0.0.1:3195', token, slots: 1 });
    await assert.rejects(away.start(), /Nu pot ajunge/);
    console.log('PASS: conectorul lucrează, se oprește curat și explică erorile');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await connector.stop().catch(() => {});
    server.kill();
  }
})();
