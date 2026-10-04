const http = require('node:http');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { Worker } = require('node:worker_threads');
const path = require('node:path');
const { Hub, fail } = require('./service');
const scrypt = promisify(crypto.scrypt);

function json(res, status, data) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(data)); }
async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 11000000) fail('Cerere prea mare', 413); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString() || '{}'); if (!value || typeof value !== 'object' || Array.isArray(value)) fail('JSON invalid'); return value; } catch { fail('JSON invalid'); }
}
function sample(task) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../lib/render-worker.js'));
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Validarea a depășit timpul disponibil')); }, 20000);
    worker.once('message', value => { clearTimeout(timer); worker.terminate(); resolve(Buffer.from(value.pixels, 'base64')); });
    worker.once('error', error => { clearTimeout(timer); worker.terminate(); reject(error); }); worker.postMessage(task);
  });
}
async function validateResult(hub, did, body) {
  const { j, t } = hub.lease(did, body);
  if (t.status === 'done') return null;
  if (j.mode === 'blender') {
    const bytes = Buffer.from(String(body.image || ''), 'base64');
    if (bytes.length < 100 || bytes.length > 8000000 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.readUInt32BE(16) !== j.width || bytes.readUInt32BE(20) !== j.height) fail('Cadru PNG invalid');
    return bytes; // Format checked; arbitrary GPU render correctness is not proven by this check.
  }
  const bytes = Buffer.from(String(body.pixels || ''), 'base64');
  if (bytes.length !== j.width * t.rows * 3) fail('Rezultat CPU incomplet');
  const row = crypto.randomInt(t.rows);
  const expected = await sample({ ...j, y: t.y + row, rows: 1 });
  if (!expected.equals(bytes.subarray(row * j.width * 3, (row + 1) * j.width * 3))) fail('Rezultatul nu trece verificarea de calcul');
  return bytes;
}

function createHubServer(options = {}) {
  const hub = new Hub(options); const attempts = new Map();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://hub'); const route = url.pathname;
      if (route === '/health' && req.method === 'GET') return json(res, 200, { ok: true, version: require('../lib/version'), protocol: 5, features: ['blender-projects-v1'] });
      if (!route.startsWith('/v1/')) return json(res, 404, { error: 'Negăsit' });
      if (route === '/v1/projects' && req.method === 'PUT') {
        const user = hub.authenticate(String(req.headers.authorization || '').replace(/^Bearer /, ''));
        const projects = require('./projects');
        const bytes = await projects.readProject(req);
        return json(res, 201, projects.upload(hub, user.id, url.searchParams.get('name'), bytes));
      }
      const body = req.method === 'POST' ? await readJson(req) : {};
      if (req.method === 'POST' && ['/v1/auth/register', '/v1/auth/login'].includes(route)) {
        const key = req.socket.remoteAddress;
        const now = Date.now(); const recent = (attempts.get(key) || []).filter(x => now - x < 60000);
        if (recent.length >= 20) fail('Prea multe încercări. Reîncearcă într-un minut.', 429);
        recent.push(now); attempts.set(key, recent);
        const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '');
        if (!/^[^\s@]{1,80}@[^\s@]{1,100}\.[^\s@]{2,20}$/.test(email) || password.length < 12 || password.length > 128) fail('Email valid și parolă de 12–128 caractere necesare');
        if (route.endsWith('/register')) {
          const allow = options.allowedEmails;
          if (allow?.length && !allow.includes(email)) fail('Beta privată: administratorul trebuie să aprobe acest email', 403);
          const salt = crypto.randomBytes(16).toString('hex'); const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
          return json(res, 201, hub.signup({ email, name: body.name, passwordHash, salt }));
        }
        const user = hub.s.users.find(u => u.email === email);
        const derived = await scrypt(password, user?.salt || 'missing-user-salt', 64);
        if (!user || !crypto.timingSafeEqual(derived, Buffer.from(user.passwordHash, 'hex'))) fail('Email sau parolă incorectă', 401);
        return json(res, 200, hub.login(user.id));
      }
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      if (route.startsWith('/v1/agent/')) {
        const d = hub.authenticate(token, true);
        if (route === '/v1/agent/heartbeat' && req.method === 'POST') return json(res, 200, hub.heartbeat(d.id));
        if (route === '/v1/agent/task' && req.method === 'GET') return json(res, 200, hub.take(d.id, url.searchParams.get('kind') === 'gpu' ? 'gpu' : 'cpu'));
        const projectRoute = /^\/v1\/agent\/projects\/([a-f0-9-]+)$/.exec(route);
        if (projectRoute && req.method === 'GET') {
          const project = hub.agentProject(d.id, projectRoute[1]);
          res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' }); return res.end(project);
        }
        if (route === '/v1/agent/stop' && req.method === 'POST') return json(res, 200, hub.stopDevice(d.id, body.force === true));
        if (route === '/v1/agent/failure' && req.method === 'POST') return json(res, 200, hub.failure(d.id, body));
        if (route === '/v1/agent/result' && req.method === 'POST') {
          const bytes = await validateResult(hub, d.id, body); return json(res, 200, hub.complete(d.id, body, bytes));
        }
        return json(res, 404, { error: 'Rută agent necunoscută' });
      }
      const user = hub.authenticate(token);
      if (route === '/v1/auth/logout' && req.method === 'POST') { hub.logout(token); return json(res, 200, { ok: true }); }
      if (route === '/v1/state' && req.method === 'GET') return json(res, 200, hub.state(user.id));
      if (route === '/v1/devices' && req.method === 'POST') return json(res, 201, hub.registerDevice(user.id, body));
      if (route === '/v1/devices/stop' && req.method === 'POST') return json(res, 200, hub.revokeDevice(user.id, body.deviceId));
      if (route === '/v1/jobs' && req.method === 'POST') return json(res, 201, hub.createJob(user.id, body));
      if (route === '/v1/jobs/cancel' && req.method === 'POST') return json(res, 200, hub.cancel(user.id, body.jobId));
      if (route === '/v1/jobs/budget' && req.method === 'POST') return json(res, 200, hub.addBudget(user.id, body.jobId, body.amount));
      if (route === '/v1/projects/delete' && req.method === 'POST') return json(res, 200, require('./projects').remove(hub, user.id, body.projectId));
      const image = /^\/v1\/jobs\/([a-f0-9-]+)\/image$/.exec(route);
      if (image && req.method === 'GET') { const bytes = hub.result(user.id, image[1], Number(url.searchParams.get('frame') || 0)); res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); return res.end(bytes); }
      return json(res, 404, { error: 'Negăsit' });
    } catch (e) { if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : 'Eroare internă a serviciului' }); }
  });
  server.requestTimeout = 60000; server.headersTimeout = 15000;
  const timer = setInterval(() => { hub.write(() => hub.maintain()); for (const [key, values] of attempts) if (Date.now() - values.at(-1) > 60000) attempts.delete(key); }, 5000); timer.unref();
  return { server, hub, close: async () => { clearInterval(timer); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); hub.close(); } };
}
module.exports = { createHubServer, readJson, json };
if (require.main === module) {
  const port = Number(process.env.HUB_PORT || 8787);
  const file = process.env.HUB_DB || path.join(__dirname, '../data/hub.sqlite');
  const app = createHubServer({ file, allowedEmails: (process.env.HUB_ALLOWED_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean) });
  let closeAdmin = () => {};
  app.server.listen(port, process.env.HUB_BIND || '127.0.0.1', async () => {
    closeAdmin = await require('./admin').startAdmin(app.hub, file + '.admin.json');
    console.log(`Compute Bridge Hub: http://${process.env.HUB_BIND || '127.0.0.1'}:${port} — folosește HTTPS/tunel pentru acces de la distanță.`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { closeAdmin(); app.close().then(() => process.exit()); });
}
