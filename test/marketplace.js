// Exercise the same local bridge and real agents used by the Windows app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHubServer } = require('../cloud/server');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-desktop-flow-'));
  const app = createHubServer();
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const hub = process.env.TEST_PUBLIC_HUB_URL || 'http://127.0.0.1:' + app.server.address().port;
  const children = [];
  const suffix = process.env.TEST_EMAIL_SUFFIX || Date.now();
  async function bridge(name) {
    const child = spawn(process.execPath, [path.resolve(__dirname, '../hub-app.js'), '--port', '0'], {
      windowsHide: true, env: { ...process.env, CB_HUB_URL: hub, CB_DATA_DIR: path.join(dir, name) }, stdio: ['ignore', 'pipe', 'pipe']
    });
    children.push(child); let logs = '';
    child.stdout.on('data', b => logs += b); child.stderr.on('data', b => logs += b);
    let url;
    for (let i = 0; i < 150; i++) { url = logs.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]; if (url) break; await sleep(100); }
    assert.ok(url, logs);
    const html = await (await fetch(url)).text();
    assert.ok(!html.includes('name="server"'), 'no URL entry');
    assert.ok(!html.toLowerCase().includes('party'), 'no group UI');
    const key = html.match(/meta name="cb-key" content="([^"]+)"/)[1];
    const call = async (endpoint, data) => {
      const r = await fetch(url + 'local/' + endpoint, { method: data === undefined ? 'GET' : 'POST', headers: { 'x-app-key': key, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
      const value = await r.json(); if (!r.ok) throw Object.assign(new Error(value.error), { status: r.status }); return value;
    };
    await call('register', { name, email: `${name}-${suffix}@bridge.test`, password: 'test-password-123', server: 'https://ignored.invalid' });
    assert.equal((await call('state')).state.user.credits, 100, 'account uses configured hub, not input URL');
    return { call, url };
  }
  try {
    const buyer = await bridge('buyer'); const seller = await bridge('seller'); const other = await bridge('other');
    assert.equal((await buyer.call('state')).state.devices.filter(d => d.market && d.online).length, 0, 'login does not secretly offer a PC');
    await seller.call('device', { name: 'Selected PC', hours: 1, slots: 1, cpuPercent: 75, ramGb: 4, vramGb: 0, gpuRender: false, price: 1 });
    await other.call('device', { name: 'Other PC', hours: 1, slots: 1, cpuPercent: 50, ramGb: 4, vramGb: 0, gpuRender: false, price: 1 });
    let state = await buyer.call('state');
    const offered = state.state.devices.find(d => d.name === 'Selected PC');
    assert.ok(offered?.online); assert.equal(state.state.devices.filter(d => d.market && d.online).length, 2);
    const params = { providerId: offered.id, execution: 'remote', mode: 'fractal', width: 200, height: 200, iterations: 100, minRam: 2, budget: 5 };
    await buyer.call('job', params);
    let job;
    for (let i = 0; i < 160; i++) { state = await buyer.call('state'); job = state.state.jobs[0]; if (job.status === 'done') break; await sleep(100); }
    assert.equal(job.status, 'done', JSON.stringify(job));
    assert.deepEqual(Object.keys(job.contributions), ['Selected PC']); assert.ok(job.spent > 0);
    const s = await seller.call('state'); const o = await other.call('state');
    assert.equal(state.state.user.credits, 100 - job.spent);
    assert.equal(s.state.user.credits, 100 + job.spent); assert.equal(o.state.user.credits, 100);
    assert.equal(state.agent, null, 'remote job does not start the buyer CPU');
    console.log('PASS desktop flow: automatic hub, 100 starter credits, two real offers visible, selected PC renders, matching debit/income, other PC cannot steal work');

    await seller.call('stop', { force: false });
    state = await buyer.call('state'); assert.ok(!state.state.devices.some(d => d.id === offered.id));
    const before = state.state.user.credits;
    await assert.rejects(buyer.call('job', params), /disponibil/);
    assert.equal((await buyer.call('state')).state.user.credits, before);
    await seller.call('device', { name: 'Selected PC', hours: 2, slots: 1, cpuPercent: 50, ramGb: 4, vramGb: 0, gpuRender: false, price: 1 });
    state = await buyer.call('state'); assert.ok(state.state.devices.find(d => d.id === offered.id)?.online, 'same device can restart its offer');
    await buyer.call('job', { ...params, execution: 'hybrid' });
    for (let i = 0; i < 160; i++) { state = await buyer.call('state'); job = state.state.jobs[0]; if (job.status === 'done') break; await sleep(100); }
    assert.equal(job.status, 'done'); assert.ok(state.agent);
    assert.ok(job.contributions['Selected PC'] > 0, 'hybrid actually uses a remote PC');
    assert.equal(state.state.devices.find(d => d.id === state.deviceId).market, false, 'local contribution does not publish an unwanted offer');
    await buyer.call('stop', { force: true });
    await buyer.call('logout', {}); assert.equal((await buyer.call('state')).state, null);
    console.log('PASS desktop flow: graceful stop hides offer, stale selection cannot spend credits, offer restarts with same identity, hybrid works without publishing the buyer, logout');
    if (process.env.TEST_GPU === '1') {
      await seller.call('stop', { force: false });
      const hw = (await seller.call('state')).hardware;
      assert.ok(!hw.gpuRenderReason, hw.gpuRenderReason);
      await seller.call('device', { name: 'Selected PC', hours: 1, slots: 1, cpuPercent: 50, ramGb: 4, vramGb: hw.gpus.find(g => g.nvidia).vramGb, gpuRender: true, price: 1 });
      // buyer logged out above: use the third account as the GPU requester.
      await other.call('job', { ...params, mode: 'blender', width: 200, height: 200, samples: 8, frames: 2, minVram: 4 });
      for (let i = 0; i < 240; i++) { state = await other.call('state'); job = state.state.jobs[0]; if (job.status !== 'running') break; await sleep(1000); }
      assert.equal(job.status, 'done', JSON.stringify(job));
      assert.deepEqual(Object.keys(job.contributions), ['Selected PC']);
      console.log('PASS desktop GPU flow: offered NVIDIA PC, selected by another account, two real Blender frames returned and paid');
    }
    for (const client of [seller, other]) await client.call('logout', {});
  } finally {
    for (const child of children) { child.kill(); if (child.exitCode === null) await new Promise(r => child.once('exit', r)); }
    await app.close();
    if (path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
