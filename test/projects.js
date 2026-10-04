const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createHubServer } = require('../cloud/server');
const { request, RemoteAgent } = require('../lib/remote-agent');
const { systemInfo } = require('../lib/system');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-project-test-'));
  const database = path.join(dir, 'hub.sqlite');
  let app = createHubServer({ file: database }); let agent;
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const api = (token, route, data) => request(base, token, '/v1/' + route, data === undefined ? 'GET' : 'POST', data);
  async function put(token, bytes) {
    const res = await fetch(base + '/v1/projects?name=own-scene.blend', { method: 'PUT', headers: { authorization: 'Bearer ' + token }, body: bytes });
    const value = await res.json(); if (!res.ok) throw Object.assign(new Error(value.error), { status: res.status }); return value;
  }
  try {
    const buyer = await api('', 'auth/register', { email: 'buyer@project.test', password: 'test-password-123' });
    const seller = await api('', 'auth/register', { email: 'seller@project.test', password: 'test-password-123' });
    const third = await api('', 'auth/register', { email: 'other@project.test', password: 'test-password-123' });
    await assert.rejects(put('', Buffer.from('BLENDER-v300test')), e => e.status === 401);
    await assert.rejects(put(buyer.token, Buffer.from('not a blend')), e => e.status === 400);
    let bytes = Buffer.from('BLENDER-v300fixture'); let hardware;
    if (process.env.TEST_GPU === '1') {
      hardware = await systemInfo(); assert.ok(!hardware.gpuRenderReason, hardware.gpuRenderReason);
      const script = path.join(dir, 'create.py');
      fs.writeFileSync(script, "import bpy,sys\nbpy.ops.wm.read_factory_settings(use_empty=False)\ncube=bpy.data.objects['Cube']\ncube.location=(0,0,0)\ncube.keyframe_insert(data_path='location',frame=7)\ncube.location=(100,100,100)\ncube.keyframe_insert(data_path='location',frame=8)\nbpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1],compress=False)\n");
      const file = path.join(dir, 'own-scene.blend');
      execFileSync(hardware.blender, ['--factory-startup', '--disable-autoexec', '--background', '--python', script, '--', file], { windowsHide: true, timeout: 60000 }); bytes = fs.readFileSync(file);
    }
    const project = await put(buyer.token, bytes);
    assert.equal(project.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
    assert.equal((await api(seller.token, 'state')).projects.length, 0);
    await assert.rejects(api(seller.token, 'projects/delete', { projectId: project.id }), e => e.status === 404);
    const config = { name: 'Project GPU', slots: 0, gpuRender: true, ramGb: 8, vramGb: 8, cpuPercent: 50, market: true, until: Date.now() + 3600000, price: 1, clientKey: crypto.randomBytes(32).toString('hex') };
    const consumer = await api(buyer.token, 'devices', { ...config, market: false });
    let provider = await api(seller.token, 'devices', config);
    await api(provider.token, 'agent/heartbeat', {});
    const jobParams = { mode: 'blender', projectId: project.id, requestDeviceId: consumer.id, providerId: provider.id, execution: 'remote', width: 200, height: 200, samples: 8, frames: 2, startFrame: 7, budget: 5 };
    await assert.rejects(api(buyer.token, 'jobs', jobParams), e => e.status === 400);
    assert.equal((await api(buyer.token, 'state')).user.credits, 100);
    await assert.rejects(api(third.token, 'jobs', { ...jobParams, requestDeviceId: consumer.id }), e => e.status === 400);
    provider = await api(seller.token, 'devices', { ...config, customProjects: true });
    await api(provider.token, 'agent/heartbeat', {});
    const fakeFile = await put(buyer.token, Buffer.from('BLENDER-v300lease-test'));
    const assignment = await api(buyer.token, 'jobs', { ...jobParams, projectId: fakeFile.id, frames: 1 });
    const task = (await api(provider.token, 'agent/task?kind=gpu')).task;
    assert.equal(task.sourceFrame, 7); assert.equal(task.adapter, 'blender-project');
    const fetched = await fetch(base + '/v1/agent/projects/' + fakeFile.id, { headers: { authorization: 'Bearer ' + provider.token } });
    assert.equal(fetched.status, 200); assert.equal(Buffer.from(await fetched.arrayBuffer()).toString(), 'BLENDER-v300lease-test');
    await assert.rejects(api(buyer.token, 'projects/delete', { projectId: fakeFile.id }), e => e.status === 409);
    await api(buyer.token, 'jobs/cancel', { jobId: assignment.id });
    assert.equal((await fetch(base + '/v1/agent/projects/' + fakeFile.id, { headers: { authorization: 'Bearer ' + provider.token } })).status, 403);
    await api(buyer.token, 'projects/delete', { projectId: fakeFile.id });
    const extraA = await put(buyer.token, Buffer.from('BLENDER-v300quota-a'));
    const extraB = await put(buyer.token, Buffer.from('BLENDER-v300quota-b'));
    await assert.rejects(put(buyer.token, Buffer.from('BLENDER-v300quota-c')), e => e.status === 400);
    await api(buyer.token, 'projects/delete', { projectId: extraA.id });
    await api(buyer.token, 'projects/delete', { projectId: extraB.id });
    console.log('PASS projects: authenticated upload, format/quota metadata, owner privacy, provider opt-in, frame ranges, lease-only downloads, cancellation and deletion');
    if (process.env.TEST_GPU === '1') {
      agent = new RemoteAgent({ server: base, token: provider.token, config: { ...config, customProjects: true }, blenderPath: hardware.blender });
      const sourceFrames = []; const render = agent.renderGpuFrame.bind(agent);
      agent.renderGpuFrame = async task => { sourceFrames.push(task.sourceFrame); try { return await render(task); } catch (error) { console.error(error.message); throw error; } };
      await agent.start();
      const created = await api(buyer.token, 'jobs', jobParams);
      let job;
      for (let i = 0; i < 120; i++) { job = app.hub.s.jobs.find(j => j.id === created.id); if (job.status !== 'running') break; await sleep(1000); }
      assert.equal(job.status, 'done', job.error || agent.message);
      assert.deepEqual(sourceFrames, [7, 8]);
      assert.equal(agent.projectCache.size, 1, 'project downloaded once for successive frames');
      assert.notDeepEqual(app.hub.result(job.ownerId, job.id, 0), app.hub.result(job.ownerId, job.id, 1), 'uploaded animation has distinct frames');
      const a = await api(buyer.token, 'state'); const b = await api(seller.token, 'state');
      assert.equal(a.user.credits, 100 - job.spent / 1000); assert.equal(b.user.credits, 100 + job.spent / 1000);
      fs.mkdirSync(path.join(__dirname, '../tmp'), { recursive: true });
      fs.writeFileSync(path.join(__dirname, '../tmp/project-frame-7.png'), app.hub.result(job.ownerId, job.id, 0));
      fs.writeFileSync(path.join(__dirname, '../tmp/project-frame-8.png'), app.hub.result(job.ownerId, job.id, 1));
      console.log('PASS real Blender GPU: uploaded own animated scene, frames 7 and 8, verified transfer/cache, PNG results, exact credit transfer');
    }
    await agent?.stop(); agent = null;
    const port = app.server.address().port; await app.close(); app = createHubServer({ file: database });
    await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    await sleep(150); // Let the HTTP pool discard connections closed by the old server.
    assert.equal((await api(buyer.token, 'state')).projects[0].id, project.id);
    assert.deepEqual(app.hub.store.get('project:' + project.id), bytes);
    console.log('PASS project file and metadata survive a hub restart');
  } finally {
    await agent?.stop(); await app.close();
    if (path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
