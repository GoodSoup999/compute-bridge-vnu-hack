// Local desktop bridge. Account and device credentials never enter the renderer.
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readAsset, serveShared } = require('./lib/assets');
const { systemInfo } = require('./lib/system');
const { RemoteAgent, hubUrl, request } = require('./lib/remote-agent');

const key = crypto.randomBytes(24).toString('hex');
const dir = process.env.CB_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'ComputeBridge');
fs.mkdirSync(dir, { recursive: true }); const settingsFile = path.join(dir, 'connection.json');
let settings = {}; try { settings = JSON.parse(fs.readFileSync(settingsFile)); } catch {}
const save = () => fs.writeFileSync(settingsFile, JSON.stringify(settings), { mode: 0o600 });
let server = process.env.CB_HUB_URL || settings.server || '';
let account = null; let device = null; let config = null; let agent = null; let busy = false;
const hardware = systemInfo();
const call = (endpoint, method = 'GET', body) => { if (!account) throw new Error('Autentifică-te'); return request(server, account.token, '/v1/' + endpoint, method, body); };
function json(res, status, value) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); }
async function body(req) { const parts = []; let n = 0; for await (const c of req) { n += c.length; if (n > 65536) throw new Error('Cerere prea mare'); parts.push(c); } return JSON.parse(Buffer.concat(parts).toString() || '{}'); }
async function configure(input = {}) {
  if (agent?.running) throw new Error('Oprește partajarea înainte de a schimba configurația');
  const hw = await hardware; const gpu = hw.gpus.find(g => g.nvidia);
  const defaults = { name: hw.hostname, slots: Math.max(1, Math.min(2, hw.threads - 1)), cpuPercent: 50, gpuRender: false, ramGb: Math.max(1, Math.min(4, hw.ramGb - 2)), vramGb: gpu?.vramGb || 0, until: Date.now() + 3600000, price: 1 };
  const next = { ...defaults, ...input, cpu: hw.cpu, gpu: gpu?.name || '' };
  if (!Number.isInteger(Number(next.slots)) || next.slots < 0 || next.slots > Math.min(12, hw.threads)) throw new Error('Număr de fire CPU invalid');
  if (next.ramGb > Math.max(1, hw.ramGb - 1)) throw new Error('Lasă minimum 1 GB RAM pentru sistem');
  if (next.gpuRender && (hw.gpuRenderReason || next.vramGb > gpu.vramGb)) throw new Error(hw.gpuRenderReason || 'VRAM peste capacitatea GPU-ului');
  settings.identities ||= {}; settings.identities[account.id] ||= crypto.randomBytes(32).toString('hex'); save();
  device = await call('devices', 'POST', { ...next, clientKey: settings.identities[account.id] }); config = next;
  return device.id;
}
async function startAgent() {
  if (agent?.running) return;
  if (!device || config.until <= Date.now() || agent) await configure(config ? { ...config, until: Math.max(config.until, Date.now() + 3600000) } : {});
  agent = new RemoteAgent({ server, token: device.token, config, blenderPath: (await hardware).blender }); agent.start();
}
async function quit() { await agent?.stop(true); if (account) try { await call('auth/logout', 'POST', {}); } catch {} setTimeout(() => process.exit(0), 50); }
const ui = http.createServer(async (req, res) => {
  try {
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')) return json(res, 403, { error: 'Gazdă locală invalidă' });
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'" });
      return res.end(readAsset('public/hub.html').toString().replace('APP_KEY', key));
    }
    if (req.method === 'GET' && ['/hub.js', '/hub.css'].includes(req.url)) { res.writeHead(200, { 'content-type': req.url.endsWith('.js') ? 'text/javascript' : 'text/css' }); return res.end(readAsset('public' + req.url)); }
    if (serveShared(req, res)) return;
    if (req.headers['x-app-key'] !== key) return json(res, 403, { error: 'Acces local neautorizat' });
    if (req.url === '/local/state' && req.method === 'GET') {
      let state = null;
      if (account) {
        try { state = await call('state'); } catch (error) {
          if (error.status !== 401) throw error;
          await agent?.stop(true).catch(() => {}); account = device = config = agent = null;
        }
      }
      return json(res, 200, { server, state, hardware: await hardware, deviceId: device?.id, config, agent: agent?.snapshot() || null });
    }
    if (req.url.startsWith('/local/image?') && req.method === 'GET') {
      if (!account) throw new Error('Autentifică-te'); const u = new URL(req.url, 'http://local'); const jid = u.searchParams.get('job'); const frame = Number(u.searchParams.get('frame') || 0);
      if (!/^[a-f0-9-]{36}$/.test(jid) || !Number.isInteger(frame) || frame < 0 || frame > 47) throw new Error('Imagine invalidă');
      const r = await fetch(`${server}/v1/jobs/${jid}/image?frame=${frame}`, { headers: { authorization: 'Bearer ' + account.token }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) return json(res, r.status, { error: 'Imagine indisponibilă' });
      res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (req.method !== 'POST') return json(res, 404, { error: 'Negăsit' });
    const b = await body(req);
    if (req.url === '/local/quit') { json(res, 200, { ok: true }); quit(); return; }
    if (busy) return json(res, 409, { error: 'O operație este deja în curs' }); busy = true;
    try {
      if (req.url === '/local/login' || req.url === '/local/register') {
        if (account) throw new Error('Ieși din cont înainte de schimbarea serviciului');
        const destination = hubUrl(b.server);
        const session = await request(destination, '', '/v1/auth/' + (req.url.endsWith('register') ? 'register' : 'login'), 'POST', { email: b.email, password: b.password, name: b.name });
        server = destination; settings.server = server; save();
        account = { token: session.token }; account.id = (await call('state')).user.id;
        await configure();
      } else if (req.url === '/local/logout') {
        try { await agent?.stop(true); if (account) await call('auth/logout', 'POST', {}); }
        finally { account = device = config = agent = null; }
      }
      else if (req.url === '/local/device') { await configure(b); await startAgent(); }
      else if (req.url === '/local/stop') { if (b.force) await agent?.stop(true); else await agent?.drain(); }
      else if (req.url === '/local/job') { if (b.execution === 'hybrid') await startAgent(); await call('jobs', 'POST', { ...b, requestDeviceId: device.id }); }
      else if (req.url === '/local/action') {
        const allowed = ['parties', 'parties/invite', 'parties/respond', 'parties/leave', 'devices/stop', 'jobs/cancel', 'jobs/budget'];
        if (!allowed.includes(b.endpoint)) throw new Error('Operație nepermisă'); await call(b.endpoint, 'POST', b.data);
      } else return json(res, 404, { error: 'Negăsit' });
      return json(res, 200, { ok: true });
    } finally { busy = false; }
  } catch (e) { json(res, e.status || 400, { error: e.message }); }
});
function listen(port, retries = 15) {
  ui.once('error', e => { if (e.code === 'EADDRINUSE' && retries > 0) listen(port + 1, retries - 1); else { console.error(e.message); process.exit(1); } });
  ui.listen(port, '127.0.0.1', () => console.log(`Fereastra aplicației: http://127.0.0.1:${ui.address().port}/`));
}
const pi = process.argv.indexOf('--port'); listen(pi >= 0 ? Number(process.argv[pi + 1]) : 3210);
process.on('SIGINT', quit); process.on('SIGTERM', quit);
