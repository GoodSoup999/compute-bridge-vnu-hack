const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { encodeRgbPng } = require('./lib/png');

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.BRIDGE_TOKEN || crypto.randomBytes(12).toString('hex');
const providers = new Map();
let job = null;

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', part => {
      data += part;
      if (data.length > 1500000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('JSON invalid')); }
    });
    req.on('error', reject);
  });
}
function requireToken(req, res) {
  if (req.headers['x-bridge-token'] === TOKEN) return true;
  json(res, 401, { error: 'Cod de acces greșit' });
  return false;
}
function publicState() {
  const now = Date.now();
  return {
    providers: [...providers.values()].map(p => ({
      id: p.id, name: p.name, cpu: p.cpu, ramGb: p.ramGb, gpu: p.gpu,
      vramGb: p.vramGb, slots: p.slots, rateRon: p.rateRon, watts: p.watts,
      online: now - p.lastSeen < 15000, completed: p.completed
    })),
    job: job && {
      id: job.id, status: job.status, mode: job.mode, width: job.width, height: job.height,
      iterations: job.iterations, samples: job.samples, total: job.tiles.length,
      done: job.tiles.filter(t => t.status === 'done').length,
      startedAt: job.startedAt, finishedAt: job.finishedAt,
      costRon: Number(job.costRon.toFixed(4)), energyKwh: Number(job.energyKwh.toFixed(5)),
      contributions: job.contributions,
      imageUrl: job.status === 'done' ? '/api/image' : null
    }
  };
}
function releaseExpiredTiles() {
  if (!job || job.status !== 'running') return;
  for (const tile of job.tiles) {
    if (tile.status === 'assigned' && Date.now() - tile.assignedAt > 120000) {
      tile.status = 'pending';
      tile.providerId = null;
    }
  }
}
function newJob(input) {
  const mode = String(input.mode || 'fractal');
  if (!['fractal', 'raytrace'].includes(mode)) throw new Error('Tip de lucrare necunoscut');
  const width = Number(input.width), height = Number(input.height);
  const iterations = mode === 'fractal' ? Number(input.iterations) : null;
  const samples = mode === 'raytrace' ? Number(input.samples) : null;
  const maxWidth = mode === 'raytrace' ? 1600 : 3000;
  const maxHeight = mode === 'raytrace' ? 1000 : 2000;
  if (![width, height].every(Number.isInteger) || width < 200 || width > maxWidth || height < 200 || height > maxHeight ||
      (mode === 'fractal' && (!Number.isInteger(iterations) || iterations < 100 || iterations > 10000)) ||
      (mode === 'raytrace' && (!Number.isInteger(samples) || samples < 1 || samples > 1024))) {
    throw new Error(mode === 'raytrace' ? 'Ray tracing: max. 1600 × 1000, 1–1024 mostre/pixel' : 'Fractal: max. 3000 × 2000, 100–10000 iterații');
  }
  const online = [...providers.values()].filter(p => Date.now() - p.lastSeen < 15000);
  const tiles = [];
  const tileRows = mode === 'raytrace' ? 16 : 32;
  for (let y = 0; y < height; y += tileRows) {
    tiles.push({
      id: crypto.randomUUID(), y, rows: Math.min(tileRows, height - y), status: 'pending',
      ownerId: online.length ? online[tiles.length % online.length].id : null
    });
  }
  return {
    id: crypto.randomUUID(), status: 'running', mode, width, height, iterations, samples, tiles,
    pixels: Buffer.alloc(width * height * 3), startedAt: Date.now(), finishedAt: null,
    costRon: 0, energyKwh: 0, contributions: {}
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(__dirname, 'public', 'index.html')).pipe(res);
      return;
    }
    if (!req.url.startsWith('/api/')) return json(res, 404, { error: 'Negăsit' });
    if (!requireToken(req, res)) return;

    if (req.url === '/api/state' && req.method === 'GET') return json(res, 200, publicState());

    if (req.url === '/api/register' && req.method === 'POST') {
      const body = await readJson(req);
      if (body.protocolVersion !== 2) return json(res, 426, { error: 'Actualizează provider.js pe acest PC la versiunea nouă' });
      const slots = Math.max(1, Math.min(12, Number(body.slots) || 1));
      const id = crypto.randomUUID();
      providers.set(id, {
        id, name: String(body.name || 'PC').slice(0, 50), cpu: String(body.cpu || '').slice(0, 80),
        ramGb: Number(body.ramGb) || 0, gpu: String(body.gpu || '').slice(0, 80),
        vramGb: Number(body.vramGb) || 0, slots,
        rateRon: Math.max(0, Number(body.rateRon) || 0), watts: Math.max(0, Number(body.watts) || 0),
        lastSeen: Date.now(), completed: 0
      });
      return json(res, 200, { id });
    }

    if (req.url === '/api/job' && req.method === 'POST') {
      if (job?.status === 'running') return json(res, 409, { error: 'Există deja o lucrare în curs' });
      job = newJob(await readJson(req));
      return json(res, 200, { id: job.id });
    }

    if (req.url.startsWith('/api/task?') && req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const provider = providers.get(url.searchParams.get('provider'));
      if (!provider) return json(res, 404, { error: 'Nod necunoscut' });
      provider.lastSeen = Date.now();
      releaseExpiredTiles();
      if (!job || job.status !== 'running') return json(res, 200, { task: null });
      const tile = job.tiles.find(t => t.status === 'pending' && (
        !t.ownerId || t.ownerId === provider.id ||
        !providers.has(t.ownerId) || Date.now() - providers.get(t.ownerId).lastSeen >= 15000
      ));
      if (!tile) return json(res, 200, { task: null });
      tile.status = 'assigned';
      tile.providerId = provider.id;
      tile.assignedAt = Date.now();
      return json(res, 200, { task: {
        jobId: job.id, taskId: tile.id, mode: job.mode, width: job.width, height: job.height,
        y: tile.y, rows: tile.rows, iterations: job.iterations, samples: job.samples
      } });
    }

    if (req.url === '/api/result' && req.method === 'POST') {
      const body = await readJson(req);
      const provider = providers.get(body.providerId);
      const tile = job?.tiles.find(t => t.id === body.taskId);
      if (!provider || !tile || body.jobId !== job.id || tile.status !== 'assigned' || tile.providerId !== provider.id) {
        return json(res, 409, { error: 'Rezultat expirat sau nod necunoscut' });
      }
      const pixels = Buffer.from(String(body.pixels || ''), 'base64');
      if (pixels.length !== job.width * tile.rows * 3) return json(res, 400, { error: 'Dimensiune rezultat incorectă' });
      pixels.copy(job.pixels, tile.y * job.width * 3);
      tile.status = 'done';
      provider.completed++;
      provider.lastSeen = Date.now();
      const slotHours = Math.max(0, Math.min(120000, Number(body.durationMs) || 0)) / 3600000;
      job.costRon += slotHours * provider.rateRon / provider.slots;
      job.energyKwh += slotHours * provider.watts / provider.slots / 1000;
      const c = job.contributions[provider.name] ||= { tiles: 0, computeMs: 0 };
      c.tiles++;
      c.computeMs += Number(body.durationMs) || 0;
      if (job.tiles.every(t => t.status === 'done')) {
        job.status = 'done';
        job.finishedAt = Date.now();
        job.png = encodeRgbPng(job.width, job.height, job.pixels);
        job.pixels = null;
      }
      return json(res, 200, { ok: true });
    }

    if (req.url === '/api/image' && req.method === 'GET' && job?.png) {
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      return res.end(job.png);
    }
    return json(res, 404, { error: 'Negăsit' });
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Compute Bridge: http://localhost:${PORT}`);
  console.log(`Cod de acces: ${TOKEN}`);
  console.log('Folosește numai în rețeaua locală de încredere.');
});
