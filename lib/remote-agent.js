const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execute } = require('./task-adapters');
const { MAX_PROJECT_BYTES } = require('./project-file');
const { Connector } = require('./connector');

function hubUrl(value) {
  const u = new URL(String(value || '').trim());
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('Introdu doar adresa HTTPS a serviciului');
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname))) throw new Error('Conexiunile la distanță cer HTTPS');
  return u.origin;
}
async function request(server, token, endpoint, method = 'GET', data) {
  let res;
  try { res = await fetch(server + endpoint, { method, headers: { authorization: `Bearer ${token || ''}`, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(45000) }); }
  catch { throw Object.assign(new Error('Serviciul nu răspunde. Verifică internetul și adresa hub-ului.'), { network: true }); }
  const value = await res.json().catch(() => ({}));
  if (value && typeof value === 'object') Object.defineProperty(value, 'serverTimeMs', { value: Date.parse(res.headers.get('date')), enumerable: false });
  if (!res.ok) throw Object.assign(new Error(value.error || `HTTP ${res.status}`), { status: res.status }); return value;
}
class RemoteAgent extends Connector {
  constructor({ server, token, config, blenderPath }) {
    super({ ...config, blenderPath }); this.hub = hubUrl(server); this.deviceToken = token; this.config = config;
    this.running = false; this.accepting = false; this.active = new Map(); this.message = ''; this.done = 0;
    this.projectCache = new Map(); this.projectDownloads = new Set(); this.projectDirectory = null;
  }
  call(endpoint, method = 'POST', data = {}) { return request(this.hub, this.deviceToken, '/v1/agent/' + endpoint, method, method === 'GET' ? undefined : data); }
  async start() {
    if (this.running) return; this.running = true; this.accepting = true; this.state = 'connected';
    await this.beat(true);
    if (!this.running || !this.accepting) throw new Error('Oferta nu poate porni: intervalul a expirat sau PC-ul este oprit');
    this.timer = setInterval(() => this.beat(), 5000);
    for (let i = 0; i < this.config.slots; i++) this.loop('cpu', i);
    if (this.config.gpuRender) this.loop('gpu', 'gpu');
    if (this.config.workloads) this.loop('workload', 'workload');
  }
  async beat(initial = false) {
    if (this.beating || !this.running) return; this.beating = true; const sent = Date.now();
    try {
      const status = await this.call('heartbeat'); this.state = this.accepting ? 'connected' : 'draining'; this.message = '';
      if (status.paused || status.until < status.serverTimeMs) this.accepting = false;
      for (const [lease, item] of this.active) if (item.startedAt < sent && !status.active.includes(lease)) item.cancel();
      if (!this.accepting && !this.active.size) await this.stop(false);
    } catch (e) { this.message = e.message; this.state = 'reconnecting'; if (initial || e.status === 401) await this.stop(true); if (initial) throw e; }
    finally { this.beating = false; }
  }
  async submit(task, result) {
    for (let i = 0; i < 4; i++) {
      try { return await this.call('result', 'POST', { jobId: task.jobId, taskId: task.taskId, lease: task.lease, ...result }); }
      catch (e) { if (!e.network || i === 3 || !this.running) throw e; await this.sleep(1500 * (i + 1)); }
    }
  }
  async cpu(task) {
    const worker = this.spawnWorker();
    this.active.set(task.lease, { task, startedAt: Date.now(), cancel: () => worker.terminate() });
    return new Promise((resolve, reject) => {
      worker.once('message', resolve); worker.once('error', reject); worker.once('exit', () => reject(new Error('Calcul oprit'))); worker.postMessage(task);
    }).finally(() => worker.terminate());
  }
  async downloadProject(project, workload = false) {
    if (workload ? !this.config.workloads : !this.config.customProjects) throw new Error('Acest PC nu acceptă acest tip de proiect');
    if (!project || !/^[a-f0-9-]{36}$/.test(project.id) || !Number.isInteger(project.bytes) || project.bytes > MAX_PROJECT_BYTES) throw new Error('Proiect invalid');
    if (!this.projectCache.has(project.id)) {
      const pending = (async () => {
        const abort = new AbortController(); this.projectDownloads.add(abort);
        const timer = setTimeout(() => abort.abort(), 90000);
        try {
          const r = await fetch(this.hub + '/v1/agent/projects/' + project.id, { headers: { authorization: 'Bearer ' + this.deviceToken }, signal: abort.signal });
          if (!r.ok) throw new Error('Proiectul nu poate fi descărcat: HTTP ' + r.status);
          const chunks = []; let size = 0;
          for await (const chunk of r.body) { size += chunk.length; if (size > MAX_PROJECT_BYTES) { abort.abort(); throw new Error('Proiect prea mare'); } chunks.push(chunk); }
          const bytes = Buffer.concat(chunks);
          if (bytes.length !== project.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== project.sha256) throw new Error('Transferul proiectului este incomplet sau corupt');
          if (!this.running) throw new Error('Agent oprit');
          this.projectDirectory ||= fs.mkdtempSync(path.join(os.tmpdir(), 'compute-bridge-projects-'));
          // One GPU task at a time; bound cached projects to three files.
          if (this.projectCache.size > 3) {
            const pinned = new Set([...this.active.values()].map(item => item.task.project?.id)); pinned.add(project.id);
            for (const pid of this.projectCache.keys()) if (!pinned.has(pid) && this.projectCache.size > 3) {
              const old = path.join(this.projectDirectory, pid + '.blend'); if (fs.existsSync(old)) fs.unlinkSync(old); this.projectCache.delete(pid);
            }
          }
          const file = path.join(this.projectDirectory, project.id + '.blend'); fs.writeFileSync(file, bytes); return file;
        } finally { clearTimeout(timer); this.projectDownloads.delete(abort); }
      })();
      this.projectCache.set(project.id, pending);
      pending.catch(() => this.projectCache.delete(project.id));
    }
    return this.projectCache.get(project.id);
  }
  async loop(kind, slot) {
    while (this.running && this.accepting) {
      let task; const started = Date.now();
      try {
        // Keep headroom for the desktop. RAM/VRAM configuration is admission, not a hardware partition.
        if (os.freemem() < 1024 ** 3) { this.message = 'Pauză: memoria liberă este sub 1 GB'; await this.sleep(3000); continue; }
        ({ task } = await this.call('task?kind=' + kind, 'GET'));
        if (!task) { await this.sleep(1200); continue; }
        if (!this.accepting) { await this.call('failure', 'POST', { ...task, error: 'Agentul se oprește' }); break; }
        let result;
        if (kind === 'gpu' || kind === 'workload') {
          const item = { task, startedAt: Date.now(), cancelled: false, cancel: () => { item.cancelled = true; for (const abort of this.projectDownloads) abort.abort(); for (const c of this.children) c.kill(); } };
          this.active.set(task.lease, item);
          result = await execute(this, task);
        } else result = await execute(this, task);
        await this.submit(task, result); this.done++;
      } catch (e) {
        this.message = e.message;
        if (task && this.running && e.status !== 409) try { await this.call('failure', 'POST', { ...task, error: e.message }); } catch {}
        if (e.status === 401) { await this.stop(true); break; }
        await this.sleep(1500);
      } finally { if (task) this.active.delete(task.lease); }
      if (task && kind === 'cpu') await this.sleep(Math.min(15000, (Date.now() - started) * (100 / this.config.cpuPercent - 1)));
    }
    if (this.running && !this.accepting && !this.active.size) await this.stop(false);
  }
  async drain() { this.accepting = false; this.state = 'draining'; await this.call('stop', 'POST', { force: false }); if (!this.active.size) await this.stop(false); }
  async stop(force = true) {
    if (!this.running) return; this.running = false; this.accepting = false; clearInterval(this.timer);
    if (force) { for (const worker of this.workers) worker.terminate(); for (const child of this.children) child.kill(); }
    if (force) for (const item of this.active.values()) item.cancel();
    for (const abort of this.projectDownloads) abort.abort();
    try { await this.call('stop', 'POST', { force }); } catch {}
    this.state = 'stopped';
    this.projectCache.clear();
    if (this.projectDirectory) {
      if (!path.resolve(this.projectDirectory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'compute-bridge-projects-')) throw new Error('Director temporar invalid');
      try { fs.rmSync(this.projectDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {} this.projectDirectory = null;
    }
  }
  snapshot() { return { state: this.state, accepting: this.accepting, active: [...this.active.values()].map(x => ({ mode: x.task.mode, frame: x.task.frame, y: x.task.y })), done: this.done, message: this.message }; }
}
module.exports = { RemoteAgent, hubUrl, request };
