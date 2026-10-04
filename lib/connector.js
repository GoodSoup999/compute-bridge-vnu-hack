// The provider side: registers this PC with a coordinator and works through tasks from the shared
// queue, one loop per CPU slot plus one for the GPU. Used by provider.js (command line) and app.js.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Worker } = require('node:worker_threads');
const { EventEmitter } = require('node:events');
const { assetFile } = require('./assets');

const PROTOCOL_VERSION = 3;

function normalizeServer(value) {
  let server = String(value || '').trim().replace(/\/+$/, '');
  if (!server) return '';
  if (!/^https?:\/\//i.test(server)) server = `http://${server}`;
  if (!/:\d+$/.test(server.replace(/^https?:\/\//i, ''))) server += ':3000';
  return server;
}

function friendlyError(error, server) {
  if (error.network) return `Nu pot ajunge la ${server.replace(/^https?:\/\//, '')}. Verifică dacă coordonatorul rulează și dacă ambele PC-uri sunt în aceeași rețea.`;
  if (error.status === 401) return 'Codul de acces nu e corect. Copiază-l din nou de pe coordonator.';
  if (error.status === 426) return 'Coordonatorul folosește altă versiune. Pune aceeași versiune de Compute Bridge pe toate PC-urile.';
  return error.message;
}

function createWorker() {
  // Inside the single-file executable the worker code is embedded as a string.
  const source = globalThis.__CB_WORKER_SOURCE__;
  return source ? new Worker(source, { eval: true }) : new Worker(path.join(__dirname, 'render-worker.js'));
}

function calculate(worker, task) {
  return new Promise((resolve, reject) => {
    const onMessage = value => { cleanup(); resolve(value); };
    const onError = error => { cleanup(); reject(error); };
    const onExit = () => { cleanup(); reject(new Error('Calculul a fost oprit')); };
    function cleanup() {
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    }
    worker.once('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
    worker.postMessage(task);
  });
}

class Connector extends EventEmitter {
  constructor(options) {
    super();
    this.server = normalizeServer(options.server);
    this.token = String(options.token || '').trim();
    this.blenderPath = options.blenderPath || null;
    const slots = Math.max(1, Math.min(12, Number(options.slots) || 1));
    this.info = {
      protocolVersion: PROTOCOL_VERSION,
      name: String(options.name || os.hostname()).slice(0, 50),
      cpu: String(options.cpu || os.cpus()[0]?.model || 'CPU'),
      ramGb: Number(options.ramGb) || Math.round(os.totalmem() / 1073741824),
      gpu: String(options.gpu || 'Nespecificat'),
      vramGb: Number(options.vramGb) || 0,
      watts: Math.max(0, Number(options.watts) || 0),
      rateRon: Math.max(0, Number(options.rateRon) || 0),
      slots,
      gpuRender: Boolean(options.gpuRender && this.blenderPath)
    };
    this.id = null;
    this.coordinatorName = null;
    this.state = 'idle';
    this.running = false;
    this.workers = new Set();
    this.children = new Set();
    this.reregistering = null;
    this.stats = { done: 0, computeMs: 0, failed: 0, startedAt: null };
  }

  async request(endpoint, method = 'GET', data) {
    let response;
    try {
      response = await fetch(this.server + endpoint, {
        method,
        headers: { 'x-bridge-token': this.token, 'content-type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(method === 'GET' ? 15000 : 60000)
      });
    } catch (cause) {
      const error = new Error('fetch failed');
      error.network = true;
      error.cause = cause;
      throw error;
    }
    let result = {};
    try { result = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(result.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return result;
  }

  setState(state, message) {
    if (this.state === state && !message) return;
    this.state = state;
    this.emit('status', { state, message: message || null, id: this.id, server: this.server });
  }

  log(text, level = 'info') { this.emit('log', { text, level }); }

  async start() {
    if (this.running) return;
    if (!this.token) throw new Error('Lipsește codul de acces.');
    this.running = true;
    this.setState('connecting');
    try {
      const { id } = await this.request('/api/register', 'POST', this.info);
      this.id = id;
    } catch (error) {
      this.running = false;
      const message = friendlyError(error, this.server);
      this.setState('error', message);
      const failure = new Error(message);
      failure.status = error.status;
      throw failure;
    }
    this.stats.startedAt = Date.now();
    try { this.coordinatorName = (await this.request('/api/state')).coordinator?.name || null; } catch {}
    this.setState('connected');
    this.log(`Conectat ca ${this.info.name}: ${this.info.slots} sloturi CPU; randare Blender GPU: ${this.info.gpuRender ? this.blenderPath : 'indisponibilă'}.`);
    for (let i = 1; i <= this.info.slots; i++) this.runSlot(i);
    if (this.info.gpuRender) this.runGpuSlot();
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    for (const worker of this.workers) worker.terminate();
    this.workers.clear();
    for (const child of this.children) child.kill();
    this.children.clear();
    if (this.id) {
      try { await this.request('/api/leave', 'POST', { providerId: this.id }); } catch {}
    }
    this.setState('stopped');
  }

  async sleep(ms) {
    const end = Date.now() + ms;
    while (this.running && Date.now() < end) await new Promise(resolve => setTimeout(resolve, Math.min(250, end - Date.now())));
  }

  // Polls failed: either the network dropped or the coordinator restarted and forgot this PC.
  async recover(error, where) {
    if (!this.running) return;
    if (error.status === 404 && /Nod necunoscut/.test(error.message)) {
      this.reregistering ||= (async () => {
        this.setState('reconnecting', 'Coordonatorul a repornit. Reînregistrez acest PC…');
        try {
          const { id } = await this.request('/api/register', 'POST', this.info);
          this.id = id;
          this.setState('connected');
          this.log('Reînregistrat la coordonator după repornirea lui.');
        } catch (e) {
          this.setState('reconnecting', friendlyError(e, this.server));
          await this.sleep(3000);
        } finally { this.reregistering = null; }
      })();
      await this.reregistering;
      return;
    }
    if (error.network || error.status === 401) this.setState('reconnecting', friendlyError(error, this.server));
    else this.log(`${where}: ${error.message}`, 'error');
    await this.sleep(3000);
  }

  async poll(kind, slot) {
    const { task } = await this.request(`/api/task?provider=${encodeURIComponent(this.id)}&kind=${kind}${slot ? `&slot=${slot}` : ''}`);
    if (this.state === 'reconnecting') this.setState('connected');
    return task;
  }

  spawnWorker() {
    const worker = createWorker();
    this.workers.add(worker);
    worker.once('exit', () => this.workers.delete(worker));
    return worker;
  }

  async runSlot(index) {
    let worker = this.spawnWorker();
    while (this.running) {
      let task;
      try {
        task = await this.poll('cpu', index);
      } catch (error) { await this.recover(error, `Slot ${index}`); continue; }
      if (!task) { await this.sleep(1200); continue; }
      this.emit('task', { slot: index, kind: 'cpu', phase: 'start', mode: task.mode, y: task.y, rows: task.rows, jobId: task.jobId });
      try {
        const result = await calculate(worker, task);
        await this.request('/api/result', 'POST', {
          providerId: this.id, jobId: task.jobId, taskId: task.taskId, pixels: result.pixels, durationMs: result.durationMs
        });
        this.stats.done++;
        this.stats.computeMs += result.durationMs;
        this.emit('task', { slot: index, kind: 'cpu', phase: 'done', mode: task.mode, y: task.y, rows: task.rows, durationMs: result.durationMs, jobId: task.jobId });
      } catch (error) {
        if (!this.running) break;
        this.emit('task', { slot: index, kind: 'cpu', phase: 'drop', mode: task.mode, y: task.y, rows: task.rows, message: error.message, jobId: task.jobId });
        if (error.status === 409) continue; // the job was stopped or the task expired
        this.stats.failed++;
        this.log(`Slot ${index}: ${error.message}`, 'error');
        if (!this.workers.has(worker)) worker = this.spawnWorker();
        await this.sleep(3000);
      }
    }
  }

  renderGpuFrame(task) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'compute-bridge-'));
    const output = path.join(folder, `frame-${task.frame}.png`);
    const args = [
      '--factory-startup', '--disable-autoexec', '--background', ...(task.projectPath ? [task.projectPath] : []), '--python-exit-code', '1',
      '--python', assetFile(task.projectPath ? 'lib/blender_project.py' : 'lib/blender_gpu.py'), '--',
      '--frame', String(task.frame), '--frames', String(task.frames),
      '--width', String(task.width), '--height', String(task.height),
      '--samples', String(task.samples), '--output', output,
      ...(task.projectPath ? ['--source-frame', String(task.sourceFrame)] : [])
    ];
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const child = spawn(this.blenderPath, args, { windowsHide: true });
      this.children.add(child);
      let messages = '';
      const append = part => { messages = (messages + String(part)).slice(-12000); };
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 240000);
      child.stdout.on('data', append);
      child.stderr.on('data', append);
      child.on('error', error => { clearTimeout(timeout); this.children.delete(child); reject(error); });
      child.on('close', code => {
        clearTimeout(timeout);
        this.children.delete(child);
        if (code !== 0) return reject(new Error(timedOut ? 'Blender a depășit limita de 4 minute per cadru' : `Blender exit ${code}: ${messages.slice(-1500)}`));
        resolve(messages);
      });
    }).then(log => {
      if (!log.includes('COMPUTE_BRIDGE_GPU=')) throw new Error('Blender nu a confirmat folosirea GPU-ului');
      const image = fs.readFileSync(output);
      if (image.length > 8000000) throw new Error('Imaginea generată este prea mare');
      return { image: image.toString('base64'), durationMs: Date.now() - started, gpuBackend: log.match(/COMPUTE_BRIDGE_GPU=([^\r\n]+)/)?.[1] || 'GPU' };
    }).finally(() => {
      fs.rmSync(folder, { recursive: true, force: true });
    });
  }

  async runGpuSlot() {
    while (this.running) {
      let task = null;
      let stage = 'poll';
      try {
        task = await this.poll('gpu');
        if (!task) { await this.sleep(1200); continue; }
        this.emit('task', { slot: 'gpu', kind: 'gpu', phase: 'start', mode: task.mode, frame: task.frame, frames: task.frames, jobId: task.jobId });
        stage = 'render';
        const result = await this.renderGpuFrame(task);
        stage = 'submit';
        await this.request('/api/result', 'POST', {
          providerId: this.id, jobId: task.jobId, taskId: task.taskId,
          image: result.image, durationMs: result.durationMs, gpuBackend: result.gpuBackend
        });
        this.stats.done++;
        this.stats.computeMs += result.durationMs;
        this.emit('task', { slot: 'gpu', kind: 'gpu', phase: 'done', mode: task.mode, frame: task.frame, frames: task.frames,
          durationMs: result.durationMs, backend: result.gpuBackend, jobId: task.jobId });
      } catch (error) {
        if (!this.running) break;
        if (stage === 'poll') { await this.recover(error, 'GPU'); continue; }
        const stopped = stage === 'submit' && error.message === 'Lucrarea nu mai este activă';
        this.emit('task', { slot: 'gpu', kind: 'gpu', phase: 'drop', mode: task.mode, frame: task.frame, frames: task.frames, message: error.message, jobId: task.jobId });
        if (stopped) this.log('GPU: cadrul terminat a fost ignorat deoarece lucrarea s-a oprit.');
        else {
          this.stats.failed++;
          this.log(`GPU: ${error.message}`, 'error');
          try {
            await this.request('/api/failure', 'POST', { providerId: this.id, jobId: task.jobId, taskId: task.taskId, error: error.message.slice(0, 300) });
          } catch {}
        }
        await this.sleep(3000);
      }
    }
  }
}

module.exports = { Connector, normalizeServer, friendlyError, PROTOCOL_VERSION };
