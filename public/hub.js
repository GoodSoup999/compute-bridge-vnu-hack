const $ = id => document.getElementById(id);
const key = document.querySelector('meta[name="cb-key"]').content;
let current = null, initialized = false, noticeTimer, images = [], frame = 0, playing = false, playerTimer;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => Number(n || 0).toLocaleString('ro-RO', {maximumFractionDigits:3});
function notice(text) { $('notice').textContent = text; $('notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').hidden = true, 9000); }
async function api(route, data) {
  const r = await fetch('/local/' + route, {method:data === undefined ? 'GET':'POST',headers:{'x-app-key':key,'content-type':'application/json'},body:data === undefined ? undefined:JSON.stringify(data)});
  const b = await r.json(); if (!r.ok) throw new Error(b.error || 'Operația a eșuat'); return b;
}
const action = (endpoint, data) => api('action', {endpoint, data});
function formData(form) {
  const b = Object.fromEntries(new FormData(form));
  for (const el of form.elements) { if (!el.name) continue; if (el.type === 'checkbox') b[el.name] = el.checked; else if (el.type === 'number') b[el.name] = Number(el.value); }
  return b;
}
const empty = text => `<div class="empty">${esc(text)}</div>`;
function conditional() {
  const mode = $('jobMode').value;
  const workload = !!ComputeTypes[mode];
  if ($('taskVideoOptions')) { $('taskVideoOptions').hidden=mode!=='video'; $('taskCompileOptions').hidden=mode!=='compile'; for (const input of $('taskVideoOptions').querySelectorAll('input')) input.disabled=mode!=='video'; }
  $('bundleSettings').hidden = !workload; $('renderDetails').hidden = workload;
  for (const input of $('renderDetails').querySelectorAll('input')) input.disabled = workload;
  const execution = $('jobForm').elements.execution;
  execution.querySelector('[value=hybrid]').disabled = workload;
  if (workload) execution.value = 'remote';
  $('fractalSettings').hidden = mode !== 'fractal'; $('renderSettings').hidden = mode === 'fractal'; $('gpuSettings').hidden = mode !== 'blender';
  for (const input of $('gpuSettings').querySelectorAll('input')) input.disabled=mode!=='blender';
  const project = mode === 'blender' && !!$('project').value && $('project').value !== 'demo';
  $('startFrameLabel').hidden = !project;
  $('jobForm').elements.frames.min = project ? 1 : 2;
  const memory = ComputeWorkload.requirements(formData($('jobForm')));
  $('requirements').textContent = `Memorie estimată automat: ${memory.minRam} GB RAM${memory.minVram ? ' · '+memory.minVram+' GB VRAM' : ''}. Alegem PC-uri compatibile. Estimarea include o marjă de siguranță.`;
}
function tab(name) {
  document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== name);
  document.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('selected',t.dataset.tab === name));
}
function deviceCard(d, own = false) {
  const remaining = Math.max(0, Math.ceil((d.until - (current?.serverTime || Date.now())) / 60000));
  return `<article class="card"><div class="jobhead"><strong>${esc(d.name)}</strong><span class="badge">${d.online ? (d.busy ? 'Lucrează':'Disponibil'):'Oprit'}</span></div><p class="sub">${esc(d.owner)} · ${d.slots} fire CPU · ${d.ramGb} GB RAM<br>${esc(d.gpuRender ? d.gpu : 'GPU neofertat')} ${d.gpuRender ? '· '+d.vramGb+' GB VRAM':''}<br>${d.workloads?'Acceptă video, Python, AI CPU, compilare și simulări':'Pachete video/cod neacceptate'}</p><p class="sub">${money(d.price)} credite / unitate · ${d.completed} sarcini terminate<br>${d.online ? 'Disponibil încă '+remaining+' minute':'Oferta nu este activă'}</p>${own ? `<p class="positive">${money(d.earned)} credite câștigate prin calcul</p>`:`<button class="primary" data-use="${esc(d.id)}">Folosește acest PC</button>`}</article>`;
}
function providers(devices) {
  const el = $('provider'); const selected = el.value; const oldName = el.selectedOptions[0]?.textContent;
  let html = '<option value="">Automat · toate PC-urile compatibile</option>' + devices.map(d=>`<option value="${esc(d.id)}">${esc(d.name)} · ${money(d.price)} cr/unitate</option>`).join('');
  if (selected && !devices.some(d=>d.id===selected)) html += `<option value="${esc(selected)}" disabled>${esc(oldName)} · indisponibil</option>`;
  if (el.innerHTML !== html) { el.innerHTML = html; el.value = selected; }
}
function workloadResults(job) {
  if(!job.workload||!job.outputs)return '';
  return `<div class="actions">${job.outputs.files.map(file=>`<button type="button" data-job="${esc(job.id)}" data-file="${esc(file.path)}">Descarcă ${esc(file.path)} (${Math.ceil(file.bytes/1024)} KB)</button>`).join('')}</div><details><summary>Mesajele programului</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(job.outputs.logs)}</pre></details>`;
}
function renderJobs(jobs) {
  const list = $('jobs');
  const focused = document.activeElement;
  const focusedJob = focused?.closest?.('.budgetForm')?.dataset.job;
  const drafts = new Map([...list.querySelectorAll('.budgetForm')].map(f => [f.dataset.job, f.elements.amount.value]));
  const html = jobs.map(j=>`<article class="card"><div class="jobhead"><strong>${esc(j.projectName || j.mode)}</strong><span class="badge">${esc(({running:'În lucru',done:'Terminat',cancelled:'Anulat',error:'Eroare',expired:'Expirat'})[j.status] || j.status)}</span></div><p class="sub">${esc(j.provider)} · ${j.execution==='hybrid' ? 'cu acest laptop':'remote'} · ${j.done}/${j.total} sarcini</p><div class="meter"><span style="width:${Math.round(j.done/j.total*100)}%"></span></div><p class="sub">${money(j.spent)} credite consumate · ${money(j.reserved)} rezervate<br>${esc(Object.entries(j.contributions).map(([n,v])=>n+': '+v).join(' · '))}</p>${j.waiting ? `<p class="hint">${esc(j.waiting)}</p>`:''}${j.error ? `<p class="hint">${esc(j.error)}</p>`:''}<div class="actions">${j.status==='running' ? `<button data-cancel="${j.id}">Anulează și restituie restul</button><form class="budgetForm" data-job="${j.id}"><div class="row"><label>Credite suplimentare<input name="amount" type="number" min="0.1" max="1000" step="0.1" value="10" required></label><button>Adaugă la buget</button></div></form>`:''}${j.status==='done' && !j.workload ? `<button class="primary" data-result="${j.id}" data-frames="${j.frames || 1}">Vezi rezultatul</button>`:''}</div>${workloadResults(j)}</article>`).join('') || empty('Alege un PC disponibil și pornește prima lucrare.');
  if (list.innerHTML === html) return;
  list.innerHTML = html;
  for (const form of list.querySelectorAll('.budgetForm')) {
    if (drafts.has(form.dataset.job)) form.elements.amount.value = drafts.get(form.dataset.job);
    if (form.dataset.job === focusedJob && focused.name === 'amount') form.elements.amount.focus({preventScroll:true});
  }
}
function render(data) {
  current = data; const s = data.state;
  $('auth').hidden = !!s; $('workspace').hidden = !s; $('logout').hidden = !s;
  $('connection').textContent = data.hub.message; $('dot').className = data.hub.connected ? 'online':'';
  if (!s) { $('balance').textContent = ''; closeViewer(); return; }
  $('balance').textContent = money(s.user.credits)+' credite'; $('greeting').textContent = 'BUN VENIT, '+s.user.name.toUpperCase();
  const hw = data.hardware;
  $('workloadOffer').disabled = !hw.workloadRuntime?.ready;
  $('workloadReason').textContent = hw.workloadRuntime?.ready ? 'Mediul izolat este pregătit. Oferă minimum un fir CPU.' : hw.workloadRuntime?.reason || 'Instalează Docker Desktop și pregătește mediul Compute Bridge.';
  $('hardwareName').textContent = hw.hostname; $('hardware').textContent = `${hw.threads} fire CPU · ${hw.ramGb} GB RAM · ${hw.gpus.map(g=>g.name).join(', ')}`;
  if (!initialized) {
    $('deviceName').value = data.config?.name || hw.hostname;
    $('slots').max = Math.min(hw.threads,12); $('slots').value = data.config?.slots ?? Math.max(1,Math.min(2,hw.threads-1));
    $('ram').value = data.config?.ramGb ?? Math.max(1,Math.min(4,hw.ramGb-2)); $('ram').max = Math.max(1,hw.ramGb-1);
    $('vram').value = data.config?.vramGb ?? (hw.gpus.find(g=>g.nvidia)?.vramGb || 0);
    $('gpu').disabled = !!hw.gpuRenderReason; $('gpuReason').textContent = hw.gpuRenderReason || 'Blender și GPU NVIDIA detectate.';
    initialized = true;
  }
  const a = data.agent;
  const active = a && a.state !== 'stopped';
  const ownOffer = s.devices.find(d=>d.id===data.deviceId && d.market && d.online);
  const labels = {connected:'PC conectat',reconnecting:'Reconectare…',draining:'Termin lucrul…',stopped:'PC oprit'};
  $('agentStatus').textContent = ownOffer ? `PC ofertat · ${a?.active.length || 0} sarcini active`:active ? 'Contribuție locală / conectare':'PC neofertat';
  $('agentDetails').textContent = a ? `${labels[a.state] || a.state}. ${a.done} sarcini terminate. ${a.active.length} active. ${a.message || ''}`:'Apasă „Oferă PC-ul” ca să apari în marketplace.';
  $('offerButton').disabled = !!active; $('offerButton').textContent = active ? 'Agent activ · oprește înainte de modificare':'Oferă PC-ul';
  $('drain').disabled = !active; $('force').disabled = !active;
  const available = s.devices.filter(d=>d.ownerId!==s.user.id && d.market && d.online);
  providers(available);
  const selectedProject = $('project').value;
  const allProjects = s.projects || [];
  const projects = allProjects.filter(p => !p.kind || p.kind === 'blender');
  const projectOptions = '<option value="">Alege proiectul tău</option><option value="demo">Scena demo inclusă</option>' + projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if ($('project').innerHTML !== projectOptions) { $('project').innerHTML = projectOptions; $('project').value = selectedProject; conditional(); }
  $('projectList').innerHTML = allProjects.map(p=>`<div class="ledgerrow"><span>${esc(p.name)} · ${(p.bytes/1048576).toFixed(1)} MB</span><button type="button" data-delete-project="${esc(p.id)}">Șterge</button></div>`).join('');
  const selectedBundle = $('bundle').value;
  const options = '<option value="">Alege pachetul tău</option>' + allProjects.filter(p => p.kind === $('jobMode').value).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if ($('bundle').innerHTML !== options) { $('bundle').innerHTML = options; $('bundle').value = selectedBundle; }
  $('market').innerHTML = available.map(d=>deviceCard(d)).join('') || empty('Niciun PC oferit acum. Pe laptopul furnizor, deschide „Oferă PC-ul meu” și pornește oferta.');
  $('myDevices').innerHTML = s.devices.filter(d=>d.id===data.deviceId && d.market).map(d=>deviceCard(d,true)).join('') || empty('Acest PC nu este oferit pentru lucru.');
  renderJobs(s.jobs);
  $('ledger').innerHTML = s.ledger.map(l=>`<div class="ledgerrow"><span>${esc(l.reason)}<br><small class="sub">${new Date(l.at).toLocaleString('ro-RO')}</small></span><strong class="${l.delta>=0 ? 'positive':'negative'}">${l.delta>0 ? '+':''}${money(l.delta)}</strong></div>`).join('');
}
let refreshPromise;
async function refresh(force = false) {
  if (refreshPromise) { await refreshPromise; if (!force) return; }
  const pending = (async () => { try { render(await api('state')); } catch(e) { $('dot').className=''; $('connection').textContent=e.message; } })();
  refreshPromise = pending;
  try { await pending; } finally { if (refreshPromise === pending) refreshPromise = null; }
}
async function perform(fn, message) { try { await fn(); if (message) notice(message); await refresh(true); } catch(e) { notice(e.message); } }
$('authForm').addEventListener('submit',e=>{e.preventDefault();const intent=e.submitter.value;const b=formData(e.currentTarget);perform(async()=>{await api(intent,b);e.target.elements.password.value='';initialized=false;},'Conectat.');});
$('logout').onclick=()=>perform(async()=>{await api('logout',{});initialized=false;tab('market');closeViewer();},'Ai ieșit din cont.');
$('offerForm').onsubmit=e=>{e.preventDefault();perform(()=>api('device',formData(e.target)),'PC-ul tău este conectat și oferit în marketplace.');};
$('jobForm').onsubmit=e=>{e.preventDefault();const data=formData(e.target);perform(()=>{if(ComputeTypes[data.mode]){data.projectId=data.bundleId;if(!data.projectId)throw new Error('Încarcă și selectează pachetul de lucru.');}else{if(data.mode==='blender'&&!data.projectId)throw new Error('Încarcă și selectează proiectul tău Blender.');if(data.mode!=='blender'||data.projectId==='demo')delete data.projectId;}delete data.bundleId;return api('job',data);},'Lucrarea a pornit.');};
$('drain').onclick=()=>perform(()=>api('stop',{force:false}),'Oferta nu mai primește sarcini. Finalizăm lucrul curent.');
$('force').onclick=()=>perform(()=>api('stop',{force:true}),'Oferta a fost oprită.');
$('jobMode').onchange=()=>{conditional();if(current)render(current);};
$('jobForm').addEventListener('input', conditional);
$('project').onchange=conditional;
const builder=document.createElement('details');
builder.innerHTML=`<summary>Încarcă fișierele tale direct</summary><p class="hint">Selectează programul și datele lui împreună, apoi fișierul de pornire. Pentru video selectează videoclipul. Programele citesc din /inputs și scriu rezultatele în /outputs. Modulele și datele se încarcă cu numele lor; folderele complexe pot fi împachetate separat.</p><label>Fișiere de intrare<input id="taskFiles" type="file" multiple></label><label>Fișier de pornire<select id="taskEntry"></select></label><label>Parametri (listă JSON)<input id="taskArgs" value="[]" placeholder='["/inputs/data.csv"]'></label><div id="taskVideoOptions" hidden><div class="row"><label>Lățime video<input id="videoWidth" type="number" min="64" max="1920" step="2" value="640"></label><label>Înălțime video<input id="videoHeight" type="number" min="64" max="1080" step="2" value="360"></label><label>Format<select id="videoFormat"><option>mp4</option><option>webm</option></select></label></div></div><div id="taskCompileOptions" hidden><label>Executabil pentru<select id="compileTarget"><option value="windows">Windows x64</option><option value="linux">Linux x64</option></select></label></div><button id="uploadTaskFiles" type="button">Încarcă fișierele</button>`;
$('bundleSettings').append(builder);
$('taskFiles').onchange=()=>{ $('taskEntry').innerHTML=[...$('taskFiles').files].map(file=>`<option value="${esc(file.name)}">${esc(file.name)}</option>`).join(''); const entry=[...$('taskFiles').files].find(file=> $('jobMode').value==='compile'?/\.(c|cc|cpp)$/i.test(file.name):/\.py$/i.test(file.name)); if(entry)$('taskEntry').value=entry.name; };
async function uploadBundleBlob(file,name,kind) {
  const r=await fetch('/local/project?kind=bundle&name='+encodeURIComponent(name),{method:'PUT',headers:{'x-app-key':key,'content-type':'application/octet-stream'},body:file});
  const p=await r.json();if(!r.ok)throw new Error(p.error);
  $('jobMode').value=kind;
  await refresh(true);$('bundle').value=p.id;conditional();$('bundleStatus').textContent='Pachet încărcat. Poți porni lucrarea.';
}
$('uploadTaskFiles').onclick=()=>perform(async()=>{
  const mode=$('jobMode').value; if(!ComputeTypes[mode])throw new Error('Alege un tip de lucrare pentru fișiere');
  let args;try{args=JSON.parse($('taskArgs').value);}catch{throw new Error('Parametri invalizi. Exemplu: ["/inputs/data.csv"]');}
  const config=mode==='video'?{width:Number($('videoWidth').value),height:Number($('videoHeight').value),format:$('videoFormat').value}:mode==='compile'?{target:$('compileTarget').value}:{};
  $('uploadTaskFiles').disabled=true;$('bundleStatus').textContent='Pregătesc și transfer fișierele…';
  try { const blob=await createTaskBundle([...$('taskFiles').files],{kind:mode,entry:$('taskEntry').value,args,config}); await uploadBundleBlob(blob,$('taskEntry').value+'.cbtask',mode); }
  finally{$('uploadTaskFiles').disabled=false;}
},'Fișiere încărcate.');
$('uploadBundle').onclick=()=>perform(async()=>{
  const file=$('bundleFile').files[0]; if(!file||!/\.cbtask$/i.test(file.name))throw new Error('Alege pachetul .cbtask');
  if(file.size>32*1048576)throw new Error('Maximum 32 MB per pachet');
  $('uploadBundle').disabled=true; $('bundleStatus').textContent='Transfer în curs…';
  try {
    const metadata=JSON.parse(await file.text());await uploadBundleBlob(file,file.name,metadata.kind);
  } finally {$('uploadBundle').disabled=false;}
},'Pachet încărcat.');
$('uploadProject').onclick=()=>perform(async()=>{
  const file=$('projectFile').files[0];
  if(!file || !/\.blend$/i.test(file.name)) throw new Error('Alege fișierul .blend');
  if(file.size>32*1048576) throw new Error('Maximum 32 MB per proiect');
  $('uploadProject').disabled=true;
  try {
    const project=await new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest(); xhr.open('PUT','/local/project?name='+encodeURIComponent(file.name)); xhr.setRequestHeader('x-app-key',key); xhr.setRequestHeader('content-type','application/octet-stream'); xhr.timeout=150000;
      xhr.upload.onprogress=e=>{$('uploadStatus').textContent=e.lengthComputable ? `Transfer către aplicație: ${Math.round(e.loaded/e.total*100)}%. Așteaptă confirmarea serverului…`:'Transfer în curs…';};
      xhr.onerror=()=>reject(new Error('Transferul proiectului a eșuat')); xhr.ontimeout=()=>reject(new Error('Transferul a depășit timpul disponibil'));
      xhr.onload=()=>{let value;try{value=JSON.parse(xhr.responseText);}catch{return reject(new Error('Răspuns de transfer invalid'));}if(xhr.status>=400)reject(new Error(value.error));else resolve(value);}; xhr.send(file);
    });
    await refresh(true); $('project').value=project.id; conditional(); $('uploadStatus').textContent='Proiect încărcat pe server. Alege cadrele și pornește lucrarea.';
  } finally { $('uploadProject').disabled=false; }
},'Proiect încărcat.');
document.addEventListener('submit',e=>{if(e.target.matches('.budgetForm')){e.preventDefault();perform(()=>action('jobs/budget',{jobId:e.target.dataset.job,amount:Number(formData(e.target).amount)}),'Buget suplimentat.');}});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.tab)tab(b.dataset.tab);
  if(b.dataset.use){$('provider').value=b.dataset.use;tab('jobs');notice('PC selectat. Alege lucrarea și apasă „Pornește lucrarea”.');}
  if(b.dataset.cancel)perform(()=>action('jobs/cancel',{jobId:b.dataset.cancel}));
  if(b.dataset.deleteProject)perform(()=>action('projects/delete',{projectId:b.dataset.deleteProject}),'Proiect șters.');
  if(b.dataset.result)perform(()=>view(b.dataset.result,Number(b.dataset.frames)));
  if(b.dataset.file)perform(async()=>{
    const r=await fetch('/local/file?job='+encodeURIComponent(b.dataset.job)+'&name='+encodeURIComponent(b.dataset.file),{headers:{'x-app-key':key}});
    if(!r.ok)throw new Error('Fișierul nu poate fi descărcat');
    const url=URL.createObjectURL(await r.blob());const link=document.createElement('a');link.href=url;link.download=b.dataset.file.split('/').pop();link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  });
});
function closeViewer(){playing=false;clearInterval(playerTimer);for(const image of images)URL.revokeObjectURL(image);images=[];$('viewer').hidden=true;}
function showFrame(){if(!images.length)return;$('resultImage').src=images[frame];$('download').href=images[frame];$('download').download=`rezultat-${frame+1}.png`;$('frameLabel').textContent=`${frame+1}/${images.length}`;}
async function view(job,count){closeViewer();notice('Încarc rezultatul…');try{for(let i=0;i<count;i++){const r=await fetch(`/local/image?job=${job}&frame=${i}`,{headers:{'x-app-key':key}});if(!r.ok)throw new Error('Nu pot încărca rezultatul');images.push(URL.createObjectURL(await r.blob()));}frame=0;$('viewer').hidden=false;$('player').hidden=count<2;showFrame();$('viewer').scrollIntoView({behavior:'smooth'});$('notice').hidden=true;}catch(e){closeViewer();throw e;}}
function playback(){clearInterval(playerTimer);if(playing)playerTimer=setInterval(()=>{frame=(frame+1)%images.length;showFrame();},1000/Number($('fps').value));}
$('play').onclick=()=>{playing=!playing;playback();};$('fps').oninput=()=>{$('fpsLabel').textContent=$('fps').value;playback();};$('closeViewer').onclick=closeViewer;
conditional();refresh();setInterval(refresh,2500);
