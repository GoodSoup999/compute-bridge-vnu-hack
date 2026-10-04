const os = require('node:os');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { Worker } = require('node:worker_threads');
const path = require('node:path');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const server = String(arg('server', 'http://localhost:3000')).replace(/\/$/, '');
const token = String(arg('token', process.env.BRIDGE_TOKEN || ''));
const slots = Math.max(1, Math.min(12, Number(arg('slots', 4)) || 4));
function findBlender() {
  const specified = arg('blender', null);
  if (specified) return fs.existsSync(specified) ? specified : null;
  const root = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Blender Foundation');
  if (!fs.existsSync(root)) return null;
  const folders = fs.readdirSync(root).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const folder of folders) {
    const candidate = path.join(root, folder, 'blender.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
const blenderPath = findBlender();
const info = {
  protocolVersion: 3,
  name: arg('name', os.hostname()),
  cpu: arg('cpu', os.cpus()[0]?.model || 'CPU'),
  ramGb: Number(arg('ram', Math.round(os.totalmem() / 1073741824))),
  gpu: arg('gpu', 'Nespecificat'),
  vramGb: Number(arg('vram', 0)),
  watts: Number(arg('watts', 0)),
  rateRon: Number(arg('rate', 0)),
  slots,
  gpuRender: Boolean(blenderPath && Number(arg('vram', 0)) > 0)
};
if (!token) {
  console.error('Lipsește --token. Folosește codul afișat de server.');
  process.exit(1);
}

async function request(endpoint, method = 'GET', data) {
  const response = await fetch(server + endpoint, {
    method,
    headers: { 'x-bridge-token': token, 'content-type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function calculate(worker, task) {
  return new Promise((resolve, reject) => {
    const onMessage = value => { cleanup(); resolve(value); };
    const onError = error => { cleanup(); reject(error); };
    function cleanup() {
      worker.off('message', onMessage);
      worker.off('error', onError);
    }
    worker.once('message', onMessage);
    worker.once('error', onError);
    worker.postMessage(task);
  });
}

async function runSlot(index, providerId) {
  const worker = new Worker(path.join(__dirname, 'lib', 'render-worker.js'));
  for (;;) {
    try {
      const { task } = await request(`/api/task?provider=${encodeURIComponent(providerId)}&kind=cpu&slot=${index}`);
      if (!task) { await sleep(1200); continue; }
      const result = await calculate(worker, task);
      await request('/api/result', 'POST', {
        providerId, jobId: task.jobId, taskId: task.taskId,
        pixels: result.pixels, durationMs: result.durationMs
      });
      console.log(`Slot ${index}: rândurile ${task.y}–${task.y + task.rows - 1} în ${result.durationMs} ms`);
    } catch (error) {
      console.error(`Slot ${index}: ${error.message}`);
      await sleep(3000);
    }
  }
}

async function renderGpuFrame(task) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'compute-bridge-'));
  const output = path.join(folder, `frame-${task.frame}.png`);
  const args = [
    '--factory-startup', '--background', '--python-exit-code', '1',
    '--python', path.join(__dirname, 'lib', 'blender_gpu.py'), '--',
    '--frame', String(task.frame), '--frames', String(task.frames),
    '--width', String(task.width), '--height', String(task.height),
    '--samples', String(task.samples), '--output', output
  ];
  const started = Date.now();
  try {
    const log = await new Promise((resolve, reject) => {
      const child = spawn(blenderPath, args, { windowsHide: true });
      let messages = '';
      const append = part => { messages = (messages + String(part)).slice(-12000); };
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 240000);
      child.stdout.on('data', append);
      child.stderr.on('data', append);
      child.on('error', error => { clearTimeout(timeout); reject(error); });
      child.on('close', code => {
        clearTimeout(timeout);
        code === 0 ? resolve(messages) : reject(new Error(timedOut ? 'Blender a depășit limita de 4 minute per cadru' : `Blender exit ${code}: ${messages.slice(-1500)}`));
      });
    });
    if (!log.includes('COMPUTE_BRIDGE_GPU=')) throw new Error('Blender nu a confirmat folosirea GPU-ului');
    const image = fs.readFileSync(output);
    if (image.length > 8000000) throw new Error('Imaginea generată este prea mare');
    return { image: image.toString('base64'), durationMs: Date.now() - started, gpuBackend: log.match(/COMPUTE_BRIDGE_GPU=([^\r\n]+)/)?.[1] || 'GPU' };
  } finally {
    if (fs.existsSync(output)) fs.unlinkSync(output);
    fs.rmdirSync(folder);
  }
}

async function runGpuSlot(providerId) {
  for (;;) {
    let task = null;
    try {
      ({ task } = await request(`/api/task?provider=${encodeURIComponent(providerId)}&kind=gpu`));
      if (!task) { await sleep(1200); continue; }
      const result = await renderGpuFrame(task);
      await request('/api/result', 'POST', {
        providerId, jobId: task.jobId, taskId: task.taskId,
        image: result.image, durationMs: result.durationMs, gpuBackend: result.gpuBackend
      });
      console.log(`GPU ${result.gpuBackend}: cadrul ${task.frame + 1}/${task.frames} în ${result.durationMs} ms`);
    } catch (error) {
      console.error(`GPU: ${error.message}`);
      if (task) {
        try { await request('/api/failure', 'POST', { providerId, jobId: task.jobId, taskId: task.taskId, error: error.message.slice(0, 300) }); } catch {}
      }
      await sleep(3000);
    }
  }
}

(async () => {
  const { id } = await request('/api/register', 'POST', info);
  console.log(`Conectat ca ${info.name}: ${slots} sloturi CPU; randare Blender GPU: ${info.gpuRender ? blenderPath : 'indisponibilă'}.`);
  const workers = Array.from({ length: slots }, (_, i) => runSlot(i + 1, id));
  if (info.gpuRender) workers.push(runGpuSlot(id));
  await Promise.all(workers);
})().catch(error => { console.error(error.message); process.exit(1); });
