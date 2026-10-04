const os = require('node:os');
const { Worker } = require('node:worker_threads');
const path = require('node:path');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const server = String(arg('server', 'http://localhost:3000')).replace(/\/$/, '');
const token = String(arg('token', process.env.BRIDGE_TOKEN || ''));
const slots = Math.max(1, Math.min(12, Number(arg('slots', 4)) || 4));
const info = {
  name: arg('name', os.hostname()),
  cpu: arg('cpu', os.cpus()[0]?.model || 'CPU'),
  ramGb: Number(arg('ram', Math.round(os.totalmem() / 1073741824))),
  gpu: arg('gpu', 'Nespecificat'),
  vramGb: Number(arg('vram', 0)),
  watts: Number(arg('watts', 0)),
  rateRon: Number(arg('rate', 0)),
  slots
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
      const { task } = await request(`/api/task?provider=${encodeURIComponent(providerId)}&slot=${index}`);
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

(async () => {
  const { id } = await request('/api/register', 'POST', info);
  console.log(`Conectat ca ${info.name}: ${slots} sloturi CPU. GPU-ul este doar afișat, nu utilizat de această lucrare.`);
  await Promise.all(Array.from({ length: slots }, (_, i) => runSlot(i + 1, id)));
})().catch(error => { console.error(error.message); process.exit(1); });
