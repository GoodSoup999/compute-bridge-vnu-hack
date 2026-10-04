// Compute Bridge desktop app. Opens a local window in the browser where this PC either starts the
// coordinator or offers its CPU/GPU to one. The window talks to this process through /local/*,
// which only answers on 127.0.0.1 and only with the key embedded in the page it served.
const http = require('node:http');
const crypto = require('node:crypto');
const { exec } = require('node:child_process');
const VERSION = require('./lib/version');
const { readAsset, serveShared } = require('./lib/assets');
const { systemInfo, findBlender } = require('./lib/system');
const { startListener, lanAddresses, rankAddress } = require('./lib/discovery');
const { Connector, normalizeServer } = require('./lib/connector');
const { startServer, stopServer, getState } = require('./server');

if (Number(process.versions.node.split('.')[0]) < 18) {
  console.error(`Compute Bridge are nevoie de Node.js 20 sau mai nou (acum: ${process.versions.node}). https://nodejs.org`);
  process.exit(1);
}
process.title = 'Compute Bridge';

const KEY = crypto.randomBytes(18).toString('hex');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
let uiPort = Number(arg('port', 3210));

let coordinator = null;   // { port, token, name }
let connector = null;     // Connector
let connectorConfig = null;
let active = new Map();   // slot -> task in progress on this PC
const found = new Map();  // address:port -> beacon heard on the network
const clients = new Set(); // open event streams
const recent = [];        // recent events, replayed to a window that reconnects
let system = systemInfo();

// ------------------------------------------------------------------ events

function emit(type, data) {
  const payload = { type, at: Date.now(), ...data };
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(line);
  if (type !== 'found') {
    recent.push(line);
    if (recent.length > 250) recent.shift();
  }
}

startListener(beacon => {
  const key = `${beacon.address}:${beacon.port}`;
  const isNew = !found.has(key);
  found.set(key, beacon);
  if (isNew) emit('found', { coordinators: coordinatorsFound() });
});
setInterval(() => {
  let changed = false;
  for (const [key, beacon] of found) if (Date.now() - beacon.seenAt > 7000) { found.delete(key); changed = true; }
  if (changed) emit('found', { coordinators: coordinatorsFound() });
}, 2000);

// One entry per coordinator: its beacon arrives once per network card (LAN, VPN), keep the best address.
function coordinatorsFound() {
  const own = new Set(lanAddresses().map(a => a.address));
  const best = new Map();
  for (const b of found.values()) {
    const key = `${b.name}:${b.port}`;
    const current = best.get(key);
    if (!current || rankAddress(b.address) < rankAddress(current.address)) best.set(key, b);
  }
  return [...best.values()]
    .map(b => ({ ...b, self: own.has(b.address) && coordinator?.port === b.port }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ------------------------------------------------------------------- state

function state() {
  return {
    version: VERSION,
    coordinator: coordinator && {
      ...coordinator,
      addresses: lanAddresses().map(a => a.address),
      url: `http://localhost:${coordinator.port}/node#token=${coordinator.token}&app=${uiPort}`,
      summary: summary()
    },
    connector: connector && {
      state: connector.state,
      server: connector.server,
      id: connector.id,
      name: connector.info.name,
      slots: connector.info.slots,
      gpuRender: connector.info.gpuRender,
      stats: connector.stats,
      active: [...active.values()],
      config: connectorConfig
    },
    found: coordinatorsFound()
  };
}

function summary() {
  const st = getState();
  const all = st.providers;
  return {
    providers: all.filter((p, i) => p.online || !all.some((q, j) => q.name === p.name && (q.online || j > i)))
      .map(p => ({ name: p.name, online: p.online, slots: p.slots, gpuRender: p.gpuRender, gpu: p.gpu, completed: p.completed })),
    job: st.job && { status: st.job.status, mode: st.job.mode, done: st.job.done, total: st.job.total }
  };
}

async function startCoordinator(body) {
  if (coordinator) return;
  const token = crypto.randomBytes(12).toString('hex');
  const first = Number(body.port) || 3000;
  let lastError;
  for (let port = first; port < first + 10; port++) {
    try {
      coordinator = await startServer({ port, token, name: String(body.name || '').trim() || undefined });
      emit('coordinator', { running: true });
      return;
    } catch (error) {
      lastError = error;
      if (error.code !== 'EADDRINUSE') break;
    }
  }
  throw new Error(lastError?.code === 'EADDRINUSE' ? `Porturile ${first}–${first + 9} sunt ocupate.` : lastError?.message || 'Coordonatorul nu a pornit.');
}

async function stopCoordinator() {
  if (!coordinator) return;
  await stopServer();
  coordinator = null;
  emit('coordinator', { running: false });
}

async function startConnector(body) {
  await stopConnector();
  const server = normalizeServer(body.server);
  if (!server) throw new Error('Alege un coordonator sau scrie adresa lui.');
  const token = String(body.token || '').replace(/\s+/g, '');
  if (!token) throw new Error('Scrie codul de acces afișat pe coordonator.');
  const info = await system;
  const blenderPath = body.gpuRender ? findBlender(body.blenderPath || null) || info.blender : null;
  if (body.gpuRender && !blenderPath) throw new Error('Nu găsesc Blender pe acest PC. Instalează-l sau scrie calea către blender.');
  connectorConfig = {
    server, name: String(body.name || info.hostname).slice(0, 50), slots: Number(body.slots) || 1,
    gpuRender: Boolean(body.gpuRender), gpu: String(body.gpu || ''), vramGb: Number(body.vramGb) || 0,
    watts: Number(body.watts) || 0, rateRon: Number(body.rateRon) || 0
  };
  const c = new Connector({ ...connectorConfig, token, cpu: info.cpu, ramGb: info.ramGb, blenderPath, gpu: connectorConfig.gpu || 'Nespecificat' });
  connector = c;
  active = new Map();
  c.on('status', s => { if (connector === c) emit('status', s); });
  c.on('log', l => { if (connector === c) emit('log', l); });
  c.on('task', t => {
    if (connector !== c) return;
    if (t.phase === 'start') active.set(String(t.slot), { ...t, since: Date.now() });
    else active.delete(String(t.slot));
    emit('task', { ...t, stats: c.stats });
  });
  try {
    await c.start();
  } catch (error) {
    if (connector === c) { connector = null; connectorConfig = null; }
    throw error;
  }
}

async function stopConnector() {
  if (!connector) return;
  const c = connector;
  connector = null;
  active = new Map();
  await c.stop();
  emit('status', { state: 'stopped' });
}

// ------------------------------------------------------------------ server

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', part => { data += part; if (data.length > 100000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('JSON invalid')); } });
    req.on('error', reject);
  });
}

// Only this machine, only this page: blocks other sites and DNS rebinding from driving the app.
function trusted(req, url) {
  const host = req.headers.host;
  if (host !== `127.0.0.1:${uiPort}` && host !== `localhost:${uiPort}`) return false;
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host}`) return false;
  return req.headers['x-app-key'] === KEY || url.searchParams.get('key') === KEY;
}

const ui = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      const host = req.headers.host;
      if (host !== `127.0.0.1:${uiPort}` && host !== `localhost:${uiPort}`) return json(res, 403, { error: 'Doar de pe acest PC' });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(String(readAsset('public/app.html')).replace('__APP_KEY__', KEY).replace(/__VERSION__/g, VERSION));
    }
    if (serveShared(req, res)) return;
    if (!url.pathname.startsWith('/local/')) return json(res, 404, { error: 'Negăsit' });
    if (!trusted(req, url)) return json(res, 403, { error: 'Interzis' });

    if (url.pathname === '/local/events' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`retry: 1500\n\n`);
      for (const line of recent.slice(-60)) res.write(line);
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (url.pathname === '/local/state' && req.method === 'GET') return json(res, 200, state());
    if (url.pathname === '/local/system' && req.method === 'GET') {
      if (url.searchParams.has('refresh')) system = systemInfo();
      return json(res, 200, await system);
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Metodă nepermisă' });
    const body = await readJson(req);
    if (url.pathname === '/local/coordinator/start') { await startCoordinator(body); return json(res, 200, state()); }
    if (url.pathname === '/local/coordinator/stop') { await stopCoordinator(); return json(res, 200, state()); }
    if (url.pathname === '/local/connector/start') { await startConnector(body); return json(res, 200, state()); }
    if (url.pathname === '/local/connector/stop') { await stopConnector(); return json(res, 200, state()); }
    if (url.pathname === '/local/quit') {
      json(res, 200, { ok: true });
      await quit();
      return;
    }
    return json(res, 404, { error: 'Negăsit' });
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
});

async function quit() {
  console.log('Compute Bridge se închide…');
  await Promise.allSettled([stopConnector(), stopCoordinator()]);
  for (const res of clients) res.end();
  setTimeout(() => process.exit(0), 150);
}
process.on('SIGINT', quit);
process.on('SIGTERM', quit);

function openWindow(url) {
  if (process.argv.includes('--no-open')) return;
  const command = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(command, { windowsHide: true }, () => {});
}

function listen(port, attempts = 20) {
  ui.once('error', error => {
    if (error.code === 'EADDRINUSE' && attempts > 1) return listen(port + 1, attempts - 1);
    console.error(`Fereastra aplicației nu a pornit: ${error.message}`);
    process.exit(1);
  });
  ui.listen(port, '127.0.0.1', () => {
    uiPort = port;
    const url = `http://127.0.0.1:${port}/`;
    console.log('');
    console.log(`  Compute Bridge ${VERSION}`);
    console.log(`  Fereastra aplicației: ${url}`);
    console.log('  Dacă nu s-a deschis singură, copiază adresa în browser.');
    console.log('  Lasă această fereastră deschisă cât folosești aplicația. Ctrl+C sau închiderea ei oprește tot.');
    console.log('');
    openWindow(url);
  });
}

listen(uiPort);
