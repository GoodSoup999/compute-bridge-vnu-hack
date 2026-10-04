const $ = id => document.getElementById(id);
const key = document.querySelector('meta[name="cb-key"]').content;
let current = null, initialized = false, refreshing = false, noticeTimer, images = [], frame = 0, playing = false, playerTimer;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const money = n => Number(n || 0).toLocaleString('ro-RO', { maximumFractionDigits: 3 });
function notice(text) { $('notice').textContent = text; $('notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').hidden = true, 9000); }
async function api(route, data) {
  const r = await fetch('/local/' + route, { method: data === undefined ? 'GET' : 'POST', headers: { 'x-app-key': key, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const b = await r.json(); if (!r.ok) throw new Error(b.error || 'Operația a eșuat'); return b;
}
const action = (endpoint, data) => api('action', { endpoint, data });
function options(id, values) {
  const el = $(id); const selected = [...el.selectedOptions].map(x => x.value);
  const html = values.map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');
  if (el.innerHTML !== html) { el.innerHTML = html; for (const o of el.options) o.selected = selected.includes(o.value); if (!el.multiple && el.selectedIndex < 0 && el.options.length) el.selectedIndex = 0; }
}
function formData(form) { const b = Object.fromEntries(new FormData(form)); for (const el of form.elements) { if (!el.name) continue; if (el.type === 'checkbox') b[el.name] = el.checked; else if (el.multiple) b[el.name] = [...el.selectedOptions].map(o => o.value); else if (el.type === 'number') b[el.name] = Number(el.value); } return b; }
function empty(text) { return `<div class="empty">${esc(text)}</div>`; }
function conditional() {
  $('partyJob').hidden = $('jobTarget').value !== 'party';
  $('partyOffer').hidden = !['party', 'both'].includes($('offerScope').value);
  $('marketOffer').hidden = !['market', 'both'].includes($('offerScope').value);
  if (!current?.state) return;
  const s = current.state;
  const p = s.parties.find(p => p.id === $('offerParty').value);
  options('allowedUsers', (p?.members || []).filter(m => m.id !== s.user.id));
  options('jobDevices', s.devices.filter(d => d.partyId === $('jobParty').value && d.id !== current.deviceId && d.canUse).map(d => ({ id: d.id, name: d.name + (d.online ? ' · online' : ' · offline') })));
}
function deviceCard(d, own = false) { return `<article class="card"><div class="jobhead"><strong>${esc(d.name)}</strong><span class="badge">${d.online ? 'online' : 'offline'}</span></div><p class="sub">${esc(d.owner)} · ${d.slots} fire CPU · ${d.ramGb} GB RAM<br>${esc(d.gpu || 'GPU nepartajat')} · ${d.vramGb} GB VRAM</p><span class="sub">${d.completed} sarcini terminate${d.market ? ' · ' + money(d.price) + ' cr/unitate · ' + (d.commitment === 'reserved' ? 'rezervat' : 'flexibil') : ''}</span>${d.market && !d.approved ? '<p class="hint">Marketplace: așteaptă aprobarea administratorului.</p>' : ''}${own ? `<p><button data-stop-device="${esc(d.id)}">Revocă disponibilitatea</button></p>` : ''}</article>`; }
function render(data) {
  current = data; const s = data.state;
  $('auth').hidden = !!s; $('workspace').hidden = !s; $('logout').hidden = !s;
  $('connection').textContent = data.server || 'Conectează-te la serviciul echipei'; $('dot').className = s ? 'online' : '';
  if (!$('server').value && data.server) $('server').value = data.server;
  if (!s) return;
  $('balance').textContent = money(s.user.credits) + ' credite'; $('greeting').textContent = 'BUN VENIT, ' + s.user.name.toUpperCase();
  const hw = data.hardware;
  $('hardwareName').textContent = hw.hostname; $('hardware').textContent = `${hw.threads} fire CPU · ${hw.ramGb} GB RAM · ${hw.gpus.map(g => g.name).join(', ')}`;
  if (!initialized) {
    $('deviceName').value = hw.hostname; $('slots').max = Math.min(hw.threads, 12); $('slots').value = data.config?.slots || Math.max(1, Math.min(2, hw.threads - 1));
    $('ram').value = Math.max(1, Math.min(4, hw.ramGb - 2)); $('ram').max = Math.max(1, hw.ramGb - 1); $('vram').value = hw.gpus.find(g => g.nvidia)?.vramGb || 0;
    $('gpu').disabled = !!hw.gpuRenderReason; $('gpuReason').textContent = hw.gpuRenderReason || 'Blender și GPU NVIDIA detectate.'; initialized = true;
  }
  const a = data.agent; const labels = { connected: 'Agent conectat', reconnecting: 'Reconectare…', draining: 'Termin sarcinile curente…', stopped: 'Agent oprit' };
  $('agentStatus').textContent = a ? `${labels[a.state] || a.state} · ${a.active.length} sarcini active` : 'Agent oprit';
  $('agentDetails').textContent = a ? `${labels[a.state] || a.state}. ${a.done} sarcini terminate. ${a.active.length} active. ${a.message || ''}` : 'Pornește agentul pentru a oferi resurse.';
  options('jobParty', s.parties); options('offerParty', s.parties); conditional();
  if (!$('jobs').contains(document.activeElement)) $('jobs').innerHTML = s.jobs.map(j => `<article class="card"><div class="jobhead"><strong>${esc(j.mode)}</strong><span class="badge">${esc(({running:'În lucru / așteaptă resurse',done:'Terminat',cancelled:'Anulat',error:'Eroare',expired:'Expirat'})[j.status] || j.status)}</span></div><p class="sub">${j.target === 'party' ? 'Party' : 'Marketplace'} · ${j.execution === 'hybrid' ? 'cu acest laptop' : 'remote'} · ${j.done}/${j.total} sarcini</p><div class="meter"><span style="width:${Math.round(j.done / j.total * 100)}%"></span></div><p class="sub">${money(j.spent)} credite consumate · ${money(j.reserved)} rezervate<br>${esc(Object.entries(j.contributions).map(([n,v])=>`${n}: ${v}`).join(' · '))}</p>${j.waiting ? `<p class="hint">${esc(j.waiting)}</p>` : ''}${j.error ? `<p class="hint">${esc(j.error)}</p>` : ''}<div class="actions">${j.status === 'running' ? `<button data-cancel="${j.id}">Anulează și restituie bugetul rămas</button><form class="budgetForm" data-job="${j.id}"><div class="row"><label>Credite suplimentare<input name="amount" type="number" min="0.1" max="1000" step="0.1" value="10" required></label><button>Adaugă la buget</button></div></form>` : ''}${j.status === 'done' ? `<button class="primary" data-result="${j.id}" data-frames="${j.frames || 1}">Vezi rezultatul</button>` : ''}</div></article>`).join('') || empty('Prima lucrare începe de aici.');
  $('invites').innerHTML = s.invites.map(i => `<div class="card"><h3>${esc(i.name)}</h3><div class="actions"><button data-invite="${i.id}" data-accept="true">Acceptă invitația</button><button data-invite="${i.id}" data-accept="false">Refuză</button></div></div>`).join('') || empty('Nu ai invitații noi.');
  if (!$('parties').contains(document.activeElement)) $('parties').innerHTML = s.parties.map(p => `<article class="card"><h2>${esc(p.name)}</h2>${p.members.map(m => `<div class="member"><span>${esc(m.name)} · ${esc(m.email)}</span>${p.ownerId === s.user.id && m.id !== s.user.id ? `<button data-remove="${m.id}" data-party="${p.id}">Elimină</button>` : ''}</div>`).join('')}<p class="hint">${s.devices.filter(d => d.partyId === p.id && d.online).length} PC-uri online. Acceptarea invitației nu partajează automat PC-ul tău.</p>${p.ownerId === s.user.id ? `<form class="inviteForm" data-party="${p.id}"><label>Invită un prieten cu cont<input name="email" type="email" required placeholder="prieten@exemplu.ro"></label><button>Trimite invitație în aplicație</button></form>` : `<button data-leave="${p.id}">Părăsește party-ul</button>`}</article>`).join('') || empty('Creează un party sau acceptă invitația unui prieten.');
  $('myDevices').innerHTML = s.devices.filter(d => d.ownerId === s.user.id).map(d => deviceCard(d, true)).join('');
  $('market').innerHTML = s.devices.filter(d => d.market && d.approved && d.online).map(d => deviceCard(d)).join('') || empty('Niciun furnizor aprobat disponibil acum. Lucrările vor aștepta resurse compatibile.');
  $('ledger').innerHTML = s.ledger.map(l => `<div class="ledgerrow"><span>${esc(l.reason)}<br><small class="sub">${new Date(l.at).toLocaleString('ro-RO')}</small></span><strong class="${l.delta >= 0 ? 'positive' : 'negative'}">${l.delta > 0 ? '+' : ''}${money(l.delta)}</strong></div>`).join('') || empty('Nu există tranzacții. Soldul inițial se acordă de administrator.');
}
async function refresh() { if (refreshing) return; refreshing = true; try { render(await api('state')); } catch (e) { $('dot').className = ''; $('connection').textContent = e.message; } finally { refreshing = false; } }
async function perform(fn, message) { try { await fn(); if (message) notice(message); await refresh(); } catch(e) { notice(e.message); } }
$('authForm').addEventListener('submit', e => { e.preventDefault(); const intent = e.submitter.value; const b = formData(e.currentTarget); perform(async () => { await api(intent, b); e.target.elements.password.value = ''; initialized = false; }, 'Conectat.'); });
$('logout').onclick = () => perform(async () => { await api('logout', {}); initialized = false; $('balance').textContent = ''; }, 'Ai ieșit din cont.');
$('partyForm').onsubmit = e => { e.preventDefault(); perform(() => action('parties', formData(e.target)), 'Party creat.'); };
$('offerForm').onsubmit = e => { e.preventDefault(); const b = formData(e.target); b.market = ['market','both'].includes(b.scope); b.partyId = ['party','both'].includes(b.scope) ? b.partyId : null; b.until = Date.now() + Number(b.hours) * 3600000; perform(() => api('device', b), 'Agentul este pornit cu limitele alese.'); };
$('jobForm').onsubmit = e => { e.preventDefault(); perform(() => api('job', formData(e.target)), 'Lucrarea a intrat în coadă.'); };
$('drain').onclick = () => perform(() => api('stop', { force:false }), 'Nu mai primim sarcini noi.');
$('force').onclick = () => perform(() => api('stop', { force:true }), 'Agentul a fost oprit.');
for (const id of ['offerScope','offerParty','jobTarget','jobParty']) $(id).onchange = conditional;
document.addEventListener('submit', e => { if (e.target.matches('.inviteForm')) { e.preventDefault(); perform(() => action('parties/invite', { partyId:e.target.dataset.party, email:formData(e.target).email }), 'Invitația apare în contul prietenului.'); } });
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tab) { document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab); document.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('selected', t === b)); }
  if (b.dataset.invite) perform(() => action('parties/respond', { inviteId:b.dataset.invite, accept:b.dataset.accept === 'true' }));
  if (b.dataset.leave) perform(() => action('parties/leave', { partyId:b.dataset.leave }));
  if (b.dataset.remove) perform(() => action('parties/leave', { partyId:b.dataset.party, memberId:b.dataset.remove }));
  if (b.dataset.stopDevice) perform(() => action('devices/stop', { deviceId:b.dataset.stopDevice }));
  if (b.dataset.cancel) perform(() => action('jobs/cancel', { jobId:b.dataset.cancel }));
  if (b.dataset.result) perform(() => view(b.dataset.result, Number(b.dataset.frames)));
});
function closeViewer() { playing = false; clearInterval(playerTimer); for (const image of images) URL.revokeObjectURL(image); images = []; $('viewer').hidden = true; }
function showFrame() { if (!images.length) return; $('resultImage').src = images[frame]; $('download').href = images[frame]; $('download').download = `rezultat-${frame + 1}.png`; $('frameLabel').textContent = `${frame + 1}/${images.length}`; }
async function view(job, count) { closeViewer(); notice('Încarc rezultatul…'); for(let i=0;i<count;i++){const r=await fetch(`/local/image?job=${job}&frame=${i}`,{headers:{'x-app-key':key}});if(!r.ok)throw new Error('Nu pot încărca rezultatul');images.push(URL.createObjectURL(await r.blob()));}frame=0;$('viewer').hidden=false;$('player').hidden=count<2;showFrame();$('viewer').scrollIntoView({behavior:'smooth'}); }
function playback() { clearInterval(playerTimer); if(playing)playerTimer=setInterval(()=>{frame=(frame+1)%images.length;showFrame();},1000/Number($('fps').value)); }
$('play').onclick=()=>{playing=!playing;playback();}; $('fps').oninput=()=>{$('fpsLabel').textContent=$('fps').value;playback();}; $('closeViewer').onclick=closeViewer;
refresh(); setInterval(refresh, 2500);

document.addEventListener("submit", e => { if (e.target.matches(".budgetForm")) { e.preventDefault(); perform(() => action("jobs/budget", { jobId:e.target.dataset.job, amount:Number(formData(e.target).amount) }), "Buget suplimentat; lucrarea continuă."); } });
