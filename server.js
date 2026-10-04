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
      if (data.length > 11000000) req.destroy();
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
      vramGb: p.vramGb, slots: p.slots, gpuRender: p.gpuRender,
      rateRon: p.rateRon, watts: p.watts,
      online: now - p.lastSeen < 15000, completed: p.completed
    })),
    job: job && {
      id: job.id, status: job.status, mode: job.mode, width: job.width, height: job.height,
      iterations: job.iterations, samples: job.samples, frameCount: job.frameCount,
      total: job.tiles.length,
      done: job.tiles.filter(t => t.status === 'done').length,
      startedAt: job.startedAt, finishedAt: job.finishedAt,
      costRon: Number(job.costRon.toFixed(4)), energyKwh: Number(job.energyKwh.toFixed(5)),
      contributions: job.contributions, error: job.error || null,
      imageUrl: job.status === 'done' && job.mode !== 'blender' ? '/api/image' : null,
      frameUrls: job.status === 'done' && job.mode === 'blender' ? job.frames.map((_, i) => `/api/frame/${i}`) : null
    }
  };
}
function releaseExpiredTiles() {
  if (!job || job.status !== 'running') return;
  for (const tile of job.tiles) {
    if (tile.status === 'assigned' && Date.now() - tile.assignedAt > (job.mode === 'blender' ? 300000 : 120000)) {
      tile.status = 'pending';
      tile.providerId = null;
    }
  }
}
function newJob(input) {
  const mode = String(input.mode || 'fractal');
  if (!['fractal', 'raytrace', 'blender'].includes(mode)) throw new Error('Tip de lucrare necunoscut');
  const width = Number(input.width), height = Number(input.height);
  const iterations = mode === 'fractal' ? Number(input.iterations) : null;
  const samples = mode !== 'fractal' ? Number(input.samples) : null;
  const frameCount = mode === 'blender' ? Number(input.frames) : null;
  const maxWidth = mode === 'fractal' ? 3000 : 1600;
  const maxHeight = mode === 'fractal' ? 2000 : 1000;
  if (![width, height].every(Number.isInteger) || width < 200 || width > maxWidth || height < 200 || height > maxHeight ||
      (mode === 'fractal' && (!Number.isInteger(iterations) || iterations < 100 || iterations > 10000)) ||
      (mode === 'raytrace' && (!Number.isInteger(samples) || samples < 1 || samples > 1024)) ||
      (mode === 'blender' && (!Number.isInteger(samples) || samples < 8 || samples > 512 ||
        !Number.isInteger(frameCount) || frameCount < 2 || frameCount > 96 ||
        width * height * frameCount > 80000000))) {
    throw new Error(mode === 'blender' ? 'Blender GPU: max. 1600 × 1000, 2–96 cadre, 8–512 mostre și 80 milioane pixeli în total' :
      mode === 'raytrace' ? 'Ray tracing: max. 1600 × 1000, 1–1024 mostre/pixel' :
      'Fractal: max. 3000 × 2000, 100–10000 iterații');
  }
  const online = [...providers.values()].filter(p => Date.now() - p.lastSeen < 15000 && (mode !== 'blender' || p.gpuRender));
  if (mode === 'blender' && !online.length) throw new Error('Niciun PC cu Blender GPU disponibil');
  const tiles = [];
  if (mode === 'blender') {
    for (let frame = 0; frame < frameCount; frame++) {
      tiles.push({ id: crypto.randomUUID(), frame, status: 'pending', ownerId: online[frame % online.length].id });
    }
  } else {
    const tileRows = mode === 'raytrace' ? 16 : 32;
    for (let y = 0; y < height; y += tileRows) {
      tiles.push({
        id: crypto.randomUUID(), y, rows: Math.min(tileRows, height - y), status: 'pending',
        ownerId: online.length ? online[tiles.length % online.length].id : null
      });
    }
  }
  return {
    id: crypto.randomUUID(), status: 'running', mode, width, height, iterations, samples, frameCount, tiles,
    pixels: mode === 'blender' ? null : Buffer.alloc(width * height * 3),
    frames: mode === 'blender' ? Array(frameCount).fill(null) : null,
    startedAt: Date.now(), finishedAt: null,
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
      if (body.protocolVersion !== 3) return json(res, 426, { error: 'Actualizează provider.js pe acest PC la versiunea nouă' });
      const slots = Math.max(1, Math.min(12, Number(body.slots) || 1));
      const id = crypto.randomUUID();
      providers.set(id, {
        id, name: String(body.name || 'PC').slice(0, 50), cpu: String(body.cpu || '').slice(0, 80),
        ramGb: Number(body.ramGb) || 0, gpu: String(body.gpu || '').slice(0, 80),
        vramGb: Number(body.vramGb) || 0, slots, gpuRender: Boolean(body.gpuRender),
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

    if (req.url === '/api/cancel' && req.method === 'POST') {
      if (!job || job.status !== 'running') return json(res, 409, { error: 'Nicio lucrare în curs' });
      job.status = 'cancelled';
      job.finishedAt = Date.now();
      return json(res, 200, { ok: true });
    }

    if (req.url.startsWith('/api/task?') && req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const provider = providers.get(url.searchParams.get('provider'));
      if (!provider) return json(res, 404, { error: 'Nod necunoscut' });
      provider.lastSeen = Date.now();
      releaseExpiredTiles();
      if (!job || job.status !== 'running') return json(res, 200, { task: null });
      const kind = url.searchParams.get('kind') || 'cpu';
      if ((job.mode === 'blender') !== (kind === 'gpu') || (kind === 'gpu' && !provider.gpuRender)) {
        return json(res, 200, { task: null });
      }
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
        y: tile.y, rows: tile.rows, frame: tile.frame, frames: job.frameCount,
        iterations: job.iterations, samples: job.samples
      } });
    }

    if (req.url === '/api/result' && req.method === 'POST') {
      const body = await readJson(req);
      if (job && body.jobId === job.id && job.status !== 'running') {
        return json(res, 409, { error: 'Lucrarea nu mai este activă' });
      }
      const provider = providers.get(body.providerId);
      const tile = job?.tiles.find(t => t.id === body.taskId);
      if (!provider || !tile || body.jobId !== job.id || job.status !== 'running' || tile.status !== 'assigned' || tile.providerId !== provider.id) {
        return json(res, 409, { error: 'Rezultat expirat sau nod necunoscut' });
      }
      if (job.mode === 'blender') {
        const image = Buffer.from(String(body.image || ''), 'base64');
        if (image.length < 100 || image.length > 8000000 ||
            !image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
            image.readUInt32BE(16) !== job.width || image.readUInt32BE(20) !== job.height) {
          return json(res, 400, { error: 'Imagine GPU invalidă' });
        }
        job.frames[tile.frame] = image;
      } else {
        const pixels = Buffer.from(String(body.pixels || ''), 'base64');
        if (pixels.length !== job.width * tile.rows * 3) return json(res, 400, { error: 'Dimensiune rezultat incorectă' });
        pixels.copy(job.pixels, tile.y * job.width * 3);
      }
      tile.status = 'done';
      provider.completed++;
      provider.lastSeen = Date.now();
      const slotHours = Math.max(0, Math.min(job.mode === 'blender' ? 300000 : 120000, Number(body.durationMs) || 0)) / 3600000;
      const divisor = job.mode === 'blender' ? 1 : provider.slots;
      job.costRon += slotHours * provider.rateRon / divisor;
      job.energyKwh += slotHours * provider.watts / divisor / 1000;
      const c = job.contributions[provider.name] ||= { tiles: 0, computeMs: 0 };
      c.tiles++;
      c.computeMs += Number(body.durationMs) || 0;
      if (job.mode === 'blender') c.gpuBackend = String(body.gpuBackend || 'GPU').slice(0, 100);
      if (job.tiles.every(t => t.status === 'done')) {
        job.status = 'done';
        job.finishedAt = Date.now();
        if (job.mode !== 'blender') {
          job.png = encodeRgbPng(job.width, job.height, job.pixels);
          job.pixels = null;
        }
      }
      return json(res, 200, { ok: true });
    }

    if (req.url === '/api/failure' && req.method === 'POST') {
      const body = await readJson(req);
      const provider = providers.get(body.providerId);
      const tile = job?.tiles.find(t => t.id === body.taskId);
      if (!provider || !tile || body.jobId !== job.id || job.status !== 'running' ||
          tile.status !== 'assigned' || tile.providerId !== provider.id) {
        return json(res, 409, { error: 'Sarcină expirată' });
      }
      job.status = 'error';
      job.error = `${provider.name}: ${String(body.error || 'Eroare de randare')}`.slice(0, 300);
      job.finishedAt = Date.now();
      return json(res, 200, { ok: true });
    }

    if (req.url.startsWith('/api/frame/') && req.method === 'GET' && job?.mode === 'blender') {
      const index = Number(req.url.slice('/api/frame/'.length));
      if (!Number.isInteger(index) || index < 0 || index >= job.frames.length || !job.frames[index]) {
        return json(res, 404, { error: 'Cadru indisponibil' });
      }
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      return res.end(job.frames[index]);
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
