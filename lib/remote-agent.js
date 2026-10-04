const os = require('node:os');
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
  if (!res.ok) throw Object.assign(new Error(value.error || `HTTP ${res.status}`), { status: res.status }); return value;
}
class RemoteAgent extends Connector {
  constructor({ server, token, config, blenderPath }) {
    super({ ...config, blenderPath }); this.hub = hubUrl(server); this.deviceToken = token; this.config = config;
    this.running = false; this.accepting = false; this.active = new Map(); this.message = ''; this.done = 0;
  }
  call(endpoint, method = 'POST', data = {}) { return request(this.hub, this.deviceToken, '/v1/agent/' + endpoint, method, method === 'GET' ? undefined : data); }
  async start() {
    if (this.running) return; this.running = true; this.accepting = true; this.state = 'connected';
    await this.beat(true);
    if (!this.running || !this.accepting) throw new Error('Oferta nu poate porni: intervalul a expirat sau PC-ul este oprit');
    this.timer = setInterval(() => this.beat(), 5000);
    for (let i = 0; i < this.config.slots; i++) this.loop('cpu', i);
    if (this.config.gpuRender) this.loop('gpu', 'gpu');
  }
  async beat(initial = false) {
    if (this.beating || !this.running) return; this.beating = true; const sent = Date.now();
    try {
      const status = await this.call('heartbeat'); this.state = this.accepting ? 'connected' : 'draining'; this.message = '';
      if (status.paused || status.until < Date.now()) this.accepting = false;
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
        if (kind === 'gpu') {
          this.active.set(task.lease, { task, startedAt: Date.now(), cancel: () => { for (const c of this.children) c.kill(); } });
          result = await this.renderGpuFrame(task);
        } else result = await this.cpu(task);
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
    try { await this.call('stop', 'POST', { force }); } catch {}
    this.state = 'stopped';
  }
  snapshot() { return { state: this.state, accepting: this.accepting, active: [...this.active.values()].map(x => ({ mode: x.task.mode, frame: x.task.frame, y: x.task.y })), done: this.done, message: this.message }; }
}
module.exports = { RemoteAgent, hubUrl, request };
