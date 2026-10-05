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
  server = http.createServer(async (req, res) => {
    if (req.url === '/local/state') {
      const body = JSON.stringify(state); const delay = delayNextState; delayNextState = false;
      return setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end(body); }, delay ? 300 : 0);
    }
    if (req.url === '/local/action') {
      const parts=[]; for await(const p of req)parts.push(p); const body=JSON.parse(Buffer.concat(parts));
      if(body.endpoint?.startsWith('wallet/')) {
        const kind=body.endpoint.endsWith('buy')?'buy':'withdraw';
        state.state.user.credits+=(kind==='buy'?1:-1)*body.data.credits;
        state.state.wallet.transactions.unshift({id:'demo-transaction-'+kind,kind,credits:body.data.credits,euroCents:body.data.credits,status:'simulated',at:Date.now()});
        res.setHeader('content-type','application/json'); return res.end('{"ok":true}');
      }
      job.status = 'cancelled'; job.reserved = 0; res.setHeader('content-type', 'application/json'); return res.end('{"ok":true}');
    }
    const file = ({ '/': 'hub.html', '/hub.js': 'hub.js', '/workload.js': 'workload.js', '/workload-types.js': 'workload-types.js', '/task-bundle.js':'task-bundle.js', '/hub.css': 'hub.css', '/ui.css': 'ui.css' })[req.url];
    if (!file) { res.writeHead(404); return res.end(); }
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(path.join(__dirname, '../public', file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  window = new BrowserWindow({ width:1180,height:820,show: false, webPreferences: { offscreen:process.argv.includes('--screenshot'),sandbox: true, contextIsolation: true, nodeIntegration: false } });
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
  state.state.projects.push({id:'python-bundle',name:'My script.cbtask',kind:'python',bytes:2000});
  await run("document.getElementById('jobMode').value='python'; document.getElementById('jobMode').dispatchEvent(new Event('change')); refresh(true);");
  assert.equal(await run("document.getElementById('bundleSettings').hidden"),false);
  assert.equal(await run("document.getElementById('renderDetails').hidden"),true);
  assert.equal(await run("document.querySelector('[name=width]').disabled"),true);
  assert.equal(await run("document.querySelector('[name=frames]').disabled"),true);
  assert.equal(await run("document.querySelector('[name=execution] option[value=hybrid]').disabled"),true);
  assert.match(await run("document.getElementById('bundle').textContent"),/My script.cbtask/);
  assert.doesNotMatch(await run("document.getElementById('bundle').textContent"),/My animation/);
  assert.match(await run("document.getElementById('requirements').textContent"),/2 GB RAM/);
  const completed={...job,id:'workload-completed',mode:'python',status:'done',workload:true,done:1,total:1,outputs:{files:[{path:'statistics.json',bytes:36}],logs:'<script>alert(1)</script>'}};
  state.state.jobs.push(completed); await run('refresh(true)');
  assert.equal(await run("document.querySelectorAll('[data-file]').length"),1);
  assert.equal(await run("document.querySelectorAll('[data-result]').length"),0);
  assert.equal(await run("document.getElementById('jobs').querySelectorAll('script').length"),0);
  const packed=JSON.parse(await run("(async()=>{const blob=await createTaskBundle([new File(['print(55)'],'main.py'),new File(['10'],'data.csv')],{kind:'python',entry:'main.py',args:['/inputs/data.csv']});return blob.text();})()"));
  require('../lib/workload-bundle').validateBundle(Buffer.from(JSON.stringify(packed)));
  assert.equal(packed.files.length,2);assert.equal(Buffer.from(packed.files[0].data,'base64').toString(),'print(55)');
  if(process.argv.includes('--screenshot')){
    await run("tab('jobs'); document.getElementById('bundleSettings').querySelector('details').open=true; document.getElementById('jobForm').scrollIntoView();");
    await sleep(500);
    fs.mkdirSync(path.resolve(__dirname,'../tmp'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../tmp/workload-ui.png'),(await window.webContents.capturePage()).toPNG());
  }
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
  assert.equal(await run("document.getElementById('buyCreditsButton').disabled"),true,'older server must not advertise working economy');
  state.hub.features=['economy-demo-v1']; state.state.wallet={demo:true,transactions:[]};
  await run("refresh(true)"); await run("tab('wallet')");
  assert.equal(await run("document.getElementById('buyCreditsButton').disabled"),false);
  await run("document.getElementById('buyCreditsForm').requestSubmit();");
  for(let i=0;i<50&&state.state.user.credits!==600;i++)await sleep(50);
  await run('refresh(true)');
  assert.equal(state.state.user.credits,600);
  assert.match(await run("document.getElementById('walletBalance').textContent"),/600 credite/);
  assert.match(await run("document.getElementById('demoTransactions').textContent"),/Cumpărare · SIMULATĂ/);
  await run("document.getElementById('withdrawCreditsForm').requestSubmit();");
  for(let i=0;i<50&&state.state.user.credits!==500;i++)await sleep(50);
  await run('refresh(true)');
  assert.equal(state.state.user.credits,500);
  assert.match(await run("document.getElementById('demoTransactions').textContent"),/Retragere · SIMULATĂ/);
  assert.match(await run("document.querySelector('[data-panel=wallet]').textContent"),/Nu se încasează și nu se transferă bani reali/);
  if(process.argv.includes('--screenshot')){
    await run("tab('wallet'); document.querySelector('[data-panel=wallet]').scrollIntoView();");
    await sleep(200);fs.writeFileSync(path.resolve(__dirname,'../tmp/economy-ui.png'),(await window.webContents.capturePage()).toPNG());
  }
  state.agent={state:'stopped',active:[],done:1,energy:{kWh:0.15,costLei:0.3}};
  await run('refresh(true)');
  assert.match(await run("document.getElementById('energyUsage').textContent"),/150 Wh · 0,15 kWh · 0,3 lei/);
  console.log('PASS UI: automatic memory estimates, progress/cancellation, demo economy and estimated energy display');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  window?.destroy(); if (server) await new Promise(resolve => server.close(resolve)); app.exit(process.exitCode || 0);
});
