const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createHubServer } = require('../cloud/server');
const { RemoteAgent, request } = require('../lib/remote-agent');
const { detect, command } = require('../lib/container-runtime');
const { make } = require('../scripts/make-examples');
const { validateBundle, validateOutput } = require('../lib/workload-bundle');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const protocol = process.argv.includes('--protocol');
  if (!protocol) { const runtime = await detect(); if (!runtime.ready) throw new Error(runtime.reason); }
  const kit = make();
  const app = createHubServer(); let agent;
  const resultDirectory = path.resolve(__dirname, '../tmp/workload-results'); fs.mkdirSync(resultDirectory, { recursive: true });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const api = (token, route, data) => request(base, token, '/v1/' + route, data === undefined ? 'GET' : 'POST', data);
  async function upload(token, bytes) {
    const r = await fetch(base + '/v1/projects?kind=bundle&name=example.cbtask', { method: 'PUT', headers: { authorization: 'Bearer ' + token }, body: bytes });
    const value = await r.json(); if (!r.ok) throw Object.assign(new Error(value.error), { status: r.status }); return value;
  }
  const report = { version: 1, verification: protocol ? 'protocol-only' : 'real-docker', cases: [], at: new Date().toISOString() };
  try {
    const buyer = await api('', 'auth/register', { email: 'buyer@work.test', password: 'test-password-123' });
    const seller = await api('', 'auth/register', { email: 'seller@work.test', password: 'test-password-123' });
    const stranger = await api('', 'auth/register', { email: 'stranger@work.test', password: 'test-password-123' });
    const config = { name: 'Workload provider', slots: 2, ramGb: 4, vramGb: 0, cpuPercent: 75, workloads: false, market: true, until: Date.now() + 3600000, price: 1, clientKey: crypto.randomBytes(32).toString('hex') };
    const consumer = await api(buyer.token, 'devices', { ...config, market: false });
    let provider = await api(seller.token, 'devices', config);
    await api(provider.token, 'agent/heartbeat', {});
    const first = fs.readFileSync(path.join(kit, 'python.cbtask'));
    const bad = JSON.parse(first); bad.files[0].path = '../escape.py';
    await assert.rejects(upload(buyer.token, Buffer.from(JSON.stringify(bad))), e => e.status === 400);
    assert.throws(() => validateBundle(Buffer.from(JSON.stringify({ ...bad, kind: 'constructor' }))), /nesuportat/);
    assert.throws(() => validateOutput({ version:1,exitCode:0,files:[{path:'../escape',data:'AA=='}] }), /invalid/);
    const one = await upload(buyer.token, first);
    const params = { mode:'python', projectId:one.id, execution:'remote', requestDeviceId:consumer.id, providerId:provider.id, budget:20 };
    await assert.rejects(api(buyer.token, 'jobs', params), e => e.status === 400);
    await api(buyer.token, 'projects/delete', { projectId:one.id });
    provider = await api(seller.token, 'devices', { ...config, workloads:true });
    if (!protocol) {
      agent = new RemoteAgent({ server:base,token:provider.token,config:{...config,workloads:true} }); await agent.start();
    } else await api(provider.token, 'agent/heartbeat', {});
    let spent=0;
    for (const name of ['video','python','ai-inference','ai-training','compile','simulation']) {
      const bytes=fs.readFileSync(path.join(kit,name+'.cbtask')); const bundle=validateBundle(bytes);
      const project=await upload(buyer.token,bytes);
      const created=await api(buyer.token,'jobs',{...params,mode:bundle.kind,projectId:project.id,providerId:provider.id});
      if(protocol) {
        const task=(await api(provider.token,'agent/task?kind=workload')).task; assert.equal(task.jobId,created.id);
        assert.equal(task.adapter,bundle.kind);
        assert.equal((await api(provider.token,'agent/task?kind=workload')).task,null,'only one generic workload per provider');
        const artifact={version:1,exitCode:0,logs:'PROTOCOL TEST ONLY',files:[{path:'result.txt',data:Buffer.from(name).toString('base64')}]};
        await api(provider.token,'agent/result',{...task,artifact});
        await api(provider.token,'agent/result',{...task,artifact});
      }
      let job;
      for(let i=0;i<1600;i++){job=app.hub.s.jobs.find(j=>j.id===created.id);if(job.status!=='running')break;await sleep(200);}
      assert.equal(job.status,'done',JSON.stringify({name,error:job.error,agent:agent?.message}));
      const files={};
      for(const metadata of job.outputs.files){
        const r=await fetch(base+'/v1/jobs/'+job.id+'/file?name='+encodeURIComponent(metadata.path),{headers:{authorization:'Bearer '+buyer.token}});assert.equal(r.status,200);
        files[metadata.path]=Buffer.from(await r.arrayBuffer());
        const dir=path.join(resultDirectory,name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,path.basename(metadata.path)),files[metadata.path]);
        assert.equal((await fetch(base+'/v1/jobs/'+job.id+'/file?name='+encodeURIComponent(metadata.path),{headers:{authorization:'Bearer '+stranger.token}})).status,404);
      }
      if(!protocol) {
        const json=file=>JSON.parse(files[file].toString());
        if(name==='python')assert.deepEqual(json('statistics.json'),{count:10,sum:55,mean:5.5});
        if(name==='ai-inference')assert.deepEqual(json('predictions.json'),[1,3,5,11]);
        if(name==='ai-training'){const model=json('trained-model.json');assert.ok(Math.abs(model.weight-2)<.01);assert.ok(Math.abs(model.bias-1)<.01);assert.ok(model.loss<.0001);assert.ok(files['weights.pt'].length>100);}
        if(name==='compile')assert.equal(files['program.exe'].subarray(0,2).toString(),'MZ');
        if(name==='simulation'){const result=json('summary.json');assert.ok(Math.abs(result.position-Math.cos(10))<.002);assert.ok(Math.abs(result.energy-.5)<.001);assert.equal(files['trajectory.csv'].toString().trim().split(/\r?\n/).length,101);}
        if(name==='video'){
          assert.equal(files['converted.mp4'].subarray(4,8).toString(),'ftyp');
          const info=JSON.parse(await command(['run','--rm','--network','none','--entrypoint','ffprobe','--mount','type=bind,source='+path.join(resultDirectory,name)+',target=/verify,readonly','compute-bridge/workloads:0.7.0','-v','error','-show_entries','stream=width,height','-of','json','/verify/converted.mp4'],30000));
          assert.equal(info.streams[0].width,128);assert.equal(info.streams[0].height,128);
        }
      }
      spent+=job.spent/1000;
      assert.equal((await api(buyer.token,'state')).user.credits,100-spent);
      assert.equal((await api(seller.token,'state')).user.credits,100+spent);
      await api(buyer.token,'projects/delete',{projectId:project.id});
      report.cases.push({name,passed:true,spent:job.spent/1000,files:Object.keys(files)});
      console.log('PASS '+(protocol?'protocol-only':'real Docker')+': '+name+' / result, owner-only download, exact payment');
    }
    fs.writeFileSync(path.join(resultDirectory,'report.json'),JSON.stringify(report,null,2));
  } finally { await agent?.stop(); await app.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
