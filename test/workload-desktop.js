const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {spawn}=require('node:child_process');const {createHubServer}=require('../cloud/server');const {request}=require('../lib/remote-agent');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const hub=createHubServer();await new Promise(resolve=>hub.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+hub.server.address().port;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-workload-desktop-'));
 const child=spawn(process.execPath,[path.resolve(__dirname,'../hub-app.js'),'--port','0'],{windowsHide:true,env:{...process.env,CB_HUB_URL:base,CB_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',part=>logs+=part);child.stderr.on('data',part=>logs+=part);
 try{
  let url;for(let i=0;i<150;i++){url=logs.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];if(url)break;await sleep(100);}assert.ok(url,logs);
  const html=await(await fetch(url)).text();const key=html.match(/meta name="cb-key" content="([^"]+)"/)[1];
  const local=async(route,data)=>{const r=await fetch(url+'local/'+route,{method:data===undefined?'GET':'POST',headers:{'x-app-key':key,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;};
  await local('register',{email:'desktop-buyer@test.example',password:'password-test-123'});
  assert.equal((await fetch(url+'task-bundle.js')).status,200);
  const seller=await request(base,'','/v1/auth/register','POST',{email:'desktop-seller@test.example',password:'password-test-123'});
  const device=await request(base,seller.token,'/v1/devices','POST',{clientKey:require('node:crypto').randomBytes(32).toString('hex'),name:'Workload PC',slots:1,ramGb:4,workloads:true,market:true,until:Date.now()+3600000,price:1});
  await request(base,device.token,'/v1/agent/heartbeat','POST',{});
  const bundle=Buffer.from(JSON.stringify({version:1,kind:'python',entry:'main.py',files:[{path:'main.py',data:Buffer.from("from pathlib import Path\nPath('answer.txt').write_text('55')").toString('base64')}]}));
  const uploaded=await fetch(url+'local/project?kind=bundle&name=main.cbtask',{method:'PUT',headers:{'x-app-key':key},body:bundle});assert.equal(uploaded.status,201);const project=await uploaded.json();
  assert.equal((await local('state')).state.projects[0].kind,'python');
  await local('job',{mode:'python',execution:'remote',projectId:project.id,providerId:device.id,budget:20});
  const task=(await request(base,device.token,'/v1/agent/task?kind=workload')).task;assert.equal(task.adapter,'python');
  // This test checks the desktop forwarding protocol; the separate Docker suite executes the program.
  await request(base,device.token,'/v1/agent/result','POST',{...task,artifact:{version:1,exitCode:0,logs:'Protocol forwarding test',files:[{path:'answer.txt',data:Buffer.from('55').toString('base64')}]}});
  const state=await local('state');assert.equal(state.state.jobs[0].status,'done');assert.equal(state.state.user.credits,99);
  const endpoint=url+'local/file?job='+task.jobId+'&name=answer.txt';
  const result=await fetch(endpoint,{headers:{'x-app-key':key}});assert.equal(result.status,200);assert.equal(await result.text(),'55');
  assert.equal((await fetch(endpoint,{headers:{'x-app-key':'wrong'}})).status,403);
  await local('logout',{});
  assert.equal((await fetch(endpoint,{headers:{'x-app-key':key}})).status,400);
  console.log('PASS desktop workload forwarding: upload, project kind, remote assignment, state refresh, exact credits, authenticated binary download and logout');
 }finally{
  child.kill();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('close',resolve);});await hub.close();
  if(!path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'bridge-workload-desktop-'))throw Error('Invalid temporary path');fs.rmSync(directory,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
