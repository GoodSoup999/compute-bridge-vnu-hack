const crypto = require('node:crypto');
const { Store } = require('./store');
const { encodeRgbPng } = require('../lib/png');
const { requirements } = require('../public/workload');

const id = () => crypto.randomUUID();
const secret = () => crypto.randomBytes(32).toString('hex');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function integer(value, min, max, name) { const n = Number(value); if (!Number.isInteger(n) || n < min || n > max) fail(`${name}: ${min}–${max}`); return n; }
function amount(value, min = 0, max = 10000) { const n = Number(value); if (!Number.isFinite(n) || n < min || n > max) fail('Valoare credite invalidă'); return Math.round(n * 1000); }
const label = value => String(value || '').trim().slice(0, 70);

class Hub {
  constructor({ file = ':memory:', clock = Date.now, initialCredits = 100 } = {}) {
    this.store = new Store(file); this.clock = clock; this.initialCredits = initialCredits;
    // A hub restart is not a provider fault. Release unfinished leases and deposits.
    this.write(s => {
      for (const j of s.jobs) {
        for (const t of j.tasks) if (t.status === 'assigned') this.release(j, t, false);
        if (j.target === 'party' && j.status === 'running') this.finish(j, 'cancelled', 'Lucrare închisă la simplificarea marketplace-ului');
        delete j.partyId; delete j.marketFallback;
      }
      delete s.parties; delete s.invites;
      for (const d of s.devices) {
        d.lastSeen = 0;
        delete d.partyId; delete d.partyAll; delete d.allowedUsers; delete d.approved;
      }
      for (const u of s.users) if (!s.ledger.some(l => l.userId === u.id && (l.ref === 'signup' || l.ref === 'welcome-v5'))) {
        this.money(u.id, amount(this.initialCredits), 'Credite de început', 'welcome-v5');
      }
    });
  }
  get s() { return this.store.data; }
  write(fn) { return this.store.transaction(fn); }
  user(uid) { return this.s.users.find(u => u.id === uid) || fail('Cont inexistent', 404); }
  money(uid, delta, reason, ref) {
    const u = this.user(uid); if (u.balance + delta < 0) fail('Credite insuficiente', 402);
    u.balance += delta; this.s.ledger.push({ id: id(), userId: uid, delta, reason, ref, at: this.clock() });
  }
  session(uid) { const token = secret(); this.s.sessions = this.s.sessions.filter(s => s.expires > this.clock()); if (this.s.sessions.filter(s => s.userId === uid).length >= 30) fail('Prea multe sesiuni active'); this.s.sessions.push({ hash: hash(token), userId: uid, expires: this.clock() + 7 * 86400000 }); return token; }
  authenticate(token, device = false) {
    const digest = hash(token || '');
    if (device) return this.s.devices.find(d => d.tokenHash === digest) || fail('Dispozitiv neautentificat', 401);
    const session = this.s.sessions.find(s => s.hash === digest && s.expires > this.clock());
    if (!session) fail('Autentifică-te din nou', 401); return this.user(session.userId);
  }
  signup({ email, name, passwordHash, salt }) {
    return this.write(s => {
      if (s.users.some(u => u.email === email)) fail('Contul există deja', 409);
      const u = { id: id(), email, name: label(name) || email.split('@')[0], passwordHash, salt, balance: 0 };
      s.users.push(u); if (this.initialCredits) this.money(u.id, amount(this.initialCredits), 'Credite de început', 'signup');
      return { token: this.session(u.id) };
    });
  }
  login(uid) { return this.write(() => ({ token: this.session(uid) })); }
  logout(token) { this.write(s => { s.sessions = s.sessions.filter(x => x.hash !== hash(token)); }); }
  deviceConfig(uid, b) {
    if (b.market && Number(b.slots) === 0 && b.gpuRender !== true) fail('Oferă cel puțin un fir CPU sau GPU-ul');
    return { name: label(b.name) || 'PC', cpu: label(b.cpu), gpu: label(b.gpu),
      slots: integer(b.slots ?? 2, 0, 12, 'Fire CPU'), gpuRender: b.gpuRender === true, customProjects: b.customProjects === true,
      ramGb: integer(b.ramGb ?? 4, 1, 512, 'RAM'), vramGb: integer(b.vramGb ?? 0, 0, 128, 'VRAM'),
      cpuPercent: integer(b.cpuPercent ?? 50, 10, 80, 'Buget CPU'),
      until: integer(b.until, this.clock() + 1000, this.clock() + 86400000, 'Sfârșit disponibilitate'),
      market: b.market === true, commitment: b.commitment === 'reserved' ? 'reserved' : 'flexible',
      price: amount(b.price ?? 1, 0.1, 20), paused: false };
  }
  registerDevice(uid, b) {
    return this.write(s => {
      if (!/^[a-f0-9]{64}$/.test(b.clientKey || '')) fail('Identitate dispozitiv invalidă');
      let d = s.devices.find(d => d.ownerId === uid && d.clientKey === hash(b.clientKey));
      if (d && s.jobs.some(j => j.tasks.some(t => t.status === 'assigned' && t.deviceId === d.id))) fail('Oprește sau finalizează sarcinile înainte de reconfigurare', 409);
      if (!d) { if (s.devices.filter(d => d.ownerId === uid).length >= 20) fail('Maximum 20 dispozitive'); d = { id: id(), ownerId: uid, clientKey: hash(b.clientKey), completed: 0, failed: 0, averageMs: 30000 }; s.devices.push(d); }
      Object.assign(d, this.deviceConfig(uid, b), { lastSeen: 0 });
      const token = secret(); d.tokenHash = hash(token); return { id: d.id, token };
    });
  }
  online(d) { return !d.paused && d.lastSeen > 0 && this.clock() - d.lastSeen < 20000 && d.until > this.clock() + 5000; }
  eligible(d, j, kind) {
    if (!this.online(d) || j.status !== 'running') return false;
    if ((j.mode === 'blender') !== (kind === 'gpu') || (kind === 'gpu' ? !d.gpuRender || d.vramGb < j.minVram : d.slots < 1) || d.ramGb < j.minRam) return false;
    if (j.projectId && !d.customProjects) return false;
    // Start with a remote provider before adding local contribution in hybrid mode.
    if (d.id === j.requestDeviceId) return j.execution === 'hybrid' && j.tasks.some(t => t.deviceId && t.deviceId !== d.id && ['assigned', 'done'].includes(t.status));
    return d.market && d.ownerId !== j.ownerId && (!j.providerId || d.id === j.providerId);
  }
  free(j, d) { return d.id === j.requestDeviceId && j.execution === 'hybrid'; }
  quote(j, t, d) {
    if (this.free(j, d)) return 0;
    const units = j.mode === 'blender' ? j.width * j.height * j.samples / 20000000 : j.width * t.rows * (j.iterations || j.samples * 80) / 10000000;
    return Math.max(10, Math.ceil(units * d.price));
  }
  createJob(uid, b) {
    return this.write(s => {
      if (b.target && b.target !== 'market') fail('Doar marketplace este disponibil');
      if (!['hybrid', 'remote'].includes(b.execution)) fail('Alege cu sau fără contribuția acestui laptop');
      if (s.jobs.filter(j => j.ownerId === uid && j.status === 'running').length >= 3) fail('Maximum 3 lucrări active');
      if (s.jobs.filter(j => j.ownerId === uid && this.clock() - j.createdAt < 86400000).length >= 50) fail('Maximum 50 lucrări pe zi în beta', 429);
      const current = s.devices.find(d => d.id === b.requestDeviceId && d.ownerId === uid);
      if (!current) fail('Înregistrează acest dispozitiv înainte de pornire');
      if (b.execution === 'hybrid' && (current.paused || this.clock() - current.lastSeen > 20000)) fail('Pornește agentul local pentru modul mixt');
      const mode = b.mode; if (!['fractal', 'raytrace', 'blender'].includes(mode)) fail('Lucrare nesuportată');
      const project = b.projectId && (s.projects || []).find(p => p.id === b.projectId && p.ownerId === uid);
      if (b.projectId && (!project || mode !== 'blender')) fail('Proiect Blender inaccesibil');
      const startFrame = project ? integer(b.startFrame ?? 1, 1, 100000, 'Primul cadru') : 0;
      const j = { id: id(), ownerId: uid, requestDeviceId: current.id, target: 'market', providerId: b.providerId || null,
        execution: b.execution, mode, status: 'running', projectId: project?.id || null, projectName: project?.name || null, startFrame,
        width: integer(b.width, 200, 1600, 'Lățime'), height: integer(b.height, 200, 1000, 'Înălțime'),
        iterations: mode === 'fractal' ? integer(b.iterations, 100, 10000, 'Iterații') : null,
        samples: mode !== 'fractal' ? integer(b.samples, 8, 256, 'Mostre') : null,
        frames: mode === 'blender' ? integer(b.frames, project ? 1 : 2, 48, 'Cadre') : null,
        ...requirements(b),
        createdAt: this.clock(), deadline: this.clock() + 86400000, tasks: [], spent: 0, escrow: 0, error: null };
      if (mode === 'blender' && j.width * j.height * j.frames > 30000000) fail('Maximum 30 milioane pixeli per animație');
      if (project) j.minRam = Math.max(j.minRam, Math.ceil(3 + project.bytes * 8 / 1073741824));
      if (s.jobs.reduce((n, x) => n + x.width * x.height * (x.frames || 1), 0) + j.width * j.height * (j.frames || 1) > 250000000) fail('Stocarea hub-ului este ocupată; contactează administratorul', 503);
      if (mode === 'blender') for (let frame = 0; frame < j.frames; frame++) j.tasks.push({ id: id(), frame, status: 'pending', attempts: 0 });
      else for (let y = 0; y < j.height; y += 16) j.tasks.push({ id: id(), y, rows: Math.min(16, j.height - y), status: 'pending', attempts: 0 });
      const compatible = s.devices.filter(d => d.id !== current.id && this.eligible(d, j, mode === 'blender' ? 'gpu' : 'cpu'));
      if (!compatible.length) fail(j.providerId ? 'PC-ul ales nu este disponibil sau nu este compatibil cu lucrarea. Alege alt PC.' : 'Niciun PC remote compatibil nu este disponibil. Un furnizor trebuie să pornească oferta.');
      j.escrow = amount(b.budget, 0.1, 1000);
      if (compatible.every(d => this.quote(j, j.tasks[0], d) > j.escrow)) fail('Bugetul nu ajunge pentru prima sarcină');
      this.money(uid, -j.escrow, 'Buget rezervat', j.id);
      s.jobs.push(j); return { id: j.id };
    });
  }
  release(j, t, penalize) {
    const d = this.s.devices.find(d => d.id === t.deviceId);
    if (t.bond) {
      this.money(penalize ? j.ownerId : d.ownerId, t.bond, penalize ? 'Compensație întrerupere rezervare' : 'Garanție restituită', t.id);
    }
    if (penalize && d) d.failed++;
    Object.assign(t, { status: 'pending', deviceId: null, lease: null, charge: 0, bond: 0 });
  }
  finish(j, status, error = null) {
    for (const t of j.tasks) if (t.status === 'assigned') this.release(j, t, false);
    if (j.escrow) this.money(j.ownerId, j.escrow, 'Buget neutilizat restituit', j.id);
    j.escrow = 0; j.status = status; j.error = error; j.finishedAt = this.clock();
  }
  maintain() {
    const old = this.s.jobs.filter(j => j.status !== 'running' && this.clock() - j.finishedAt > 7 * 86400000);
    for (const j of old) for (const t of j.tasks) this.store.db.prepare('DELETE FROM results WHERE id=?').run(t.id);
    this.s.jobs = this.s.jobs.filter(j => !old.includes(j));
    for (const j of this.s.jobs.filter(j => j.status === 'running')) {
      if (j.deadline < this.clock()) { this.finish(j, 'expired', 'Lucrarea a expirat după 24 de ore'); continue; }
      for (const t of j.tasks) if (t.status === 'assigned') {
        const d = this.s.devices.find(d => d.id === t.deviceId);
        const otherOnline = this.s.devices.some(other => other.id !== d?.id && this.clock() - other.lastSeen < 20000);
        // A total loss of agents may be the hub's connection. Do not charge an ambiguous outage.
        if (!d || this.clock() - d.lastSeen > 60000 || t.expires < this.clock()) this.release(j, t, !!d && otherOnline && this.clock() - d.lastSeen > 60000);
      }
      if (j.tasks.some(t => t.status === 'pending' && t.attempts >= 5)) this.finish(j, 'error', 'Prea multe încercări eșuate; bugetul rămas a fost restituit');
    }
  }
  heartbeat(did) { return this.write(s => { const d = s.devices.find(d => d.id === did); d.lastSeen = this.clock(); this.maintain(); return { paused: d.paused, until: d.until, active: s.jobs.flatMap(j => j.tasks).filter(t => t.status === 'assigned' && t.deviceId === did).map(t => t.lease) }; }); }
  take(did, kind) {
    return this.write(s => {
      this.maintain(); const d = s.devices.find(d => d.id === did); d.lastSeen = this.clock();
      const active = s.jobs.flatMap(j => j.tasks.filter(t => t.status === 'assigned' && t.deviceId === did).map(t => ({ t, kind: j.mode === 'blender' ? 'gpu' : 'cpu' })));
      if (active.filter(x => x.kind === kind).length >= (kind === 'gpu' ? 1 : d.slots)) return { task: null };
      for (const j of s.jobs.filter(j => this.eligible(d, j, kind)).sort((a, b) => (b.ownerId === d.ownerId) - (a.ownerId === d.ownerId) || a.createdAt - b.createdAt)) {
        const t = j.tasks.find(t => t.status === 'pending'); if (!t) continue;
        const available = j.escrow - j.tasks.filter(t => t.status === 'assigned').reduce((v, t) => v + t.charge, 0);
        const charge = this.quote(j, t, d); if (charge > available) continue;
        // Prefer compatible available capacity with lower price and better observed completion time.
        const score = x => this.quote(j, t, x) * (1 + x.averageMs / 60000) * (1 + x.failed / (x.completed + 1));
        const better = s.devices.some(other => other.id !== d.id && other.id !== j.requestDeviceId && this.eligible(other, j, kind) && (other.commitment !== 'reserved' || this.user(other.ownerId).balance >= Math.min(1000, Math.max(10, Math.ceil(this.quote(j, t, other) * .1)))) && score(other) < score(d) * .85 &&
          s.jobs.flatMap(k => k.tasks.filter(q => q.status === 'assigned' && q.deviceId === other.id && (k.mode === 'blender') === (kind === 'gpu'))).length < (kind === 'gpu' ? 1 : other.slots));
        if (better) continue;
        const bond = charge && d.commitment === 'reserved' ? Math.min(1000, Math.max(10, Math.ceil(charge * .1))) : 0;
        if (bond > this.user(d.ownerId).balance) continue;
        if (bond) this.money(d.ownerId, -bond, 'Garanție rezervare', t.id);
        Object.assign(t, { status: 'assigned', deviceId: did, lease: secret(), charge, bond, assignedAt: this.clock(), expires: this.clock() + (kind === 'gpu' ? 300000 : 120000), attempts: t.attempts + 1 });
        const project = (s.projects || []).find(p => p.id === j.projectId);
        return { task: { jobId: j.id, taskId: t.id, lease: t.lease, mode: j.mode, adapter: j.projectId ? 'blender-project' : j.mode, project: project && { id: project.id, bytes: project.bytes, sha256: project.sha256 }, sourceFrame: j.startFrame + (t.frame || 0), width: j.width, height: j.height, iterations: j.iterations, samples: j.samples, frames: j.frames, frame: t.frame, y: t.y, rows: t.rows } };
      }
      return { task: null };
    });
  }
  lease(did, b) {
    const j = this.s.jobs.find(j => j.id === b.jobId); const t = j?.tasks.find(t => t.id === b.taskId);
    if (!t || t.deviceId !== did || t.lease !== b.lease) fail('Sarcină expirată sau neautorizată', 409);
    if (t.status !== 'done' && (j.status !== 'running' || t.status !== 'assigned' || t.expires < this.clock())) fail('Sarcină expirată', 409);
    return { j, t };
  }
  complete(did, b, bytes) {
    return this.write(s => {
      const { j, t } = this.lease(did, b); if (t.status === 'done') return { ok: true, duplicate: true };
      this.store.put(t.id, bytes); const d = s.devices.find(d => d.id === did);
      if (t.charge) { j.escrow -= t.charge; j.spent += t.charge; this.money(d.ownerId, t.charge, 'Sarcină acceptată', t.id); }
      if (t.bond) this.money(d.ownerId, t.bond, 'Garanție restituită', t.id);
      t.bond = 0; t.status = 'done'; d.completed++; d.averageMs = Math.round(d.averageMs * .7 + Math.max(1, this.clock() - t.assignedAt) * .3);
      if (j.tasks.every(t => t.status === 'done')) this.finish(j, 'done');
      return { ok: true };
    });
  }
  failure(did, b) { return this.write(() => { const { j, t } = this.lease(did, b); if (t.status === 'done') return { ok: true }; this.s.devices.find(d => d.id === did).failed++; this.release(j, t, false); j.error = label(b.error); return { ok: true }; }); }
  stopDevice(did, force) { return this.write(s => { const d = s.devices.find(d => d.id === did); d.paused = true; if (force) for (const j of s.jobs) for (const t of j.tasks) if (t.status === 'assigned' && t.deviceId === did) this.release(j, t, t.bond > 0); return { ok: true }; }); }
  revokeDevice(uid, did) { const d = this.s.devices.find(d => d.id === did && d.ownerId === uid) || fail('Dispozitiv inaccesibil', 403); return this.stopDevice(d.id, true); }
  cancel(uid, jid) { return this.write(s => { const j = s.jobs.find(j => j.id === jid && j.ownerId === uid) || fail('Lucrare inaccesibilă', 404); if (j.status === 'running') this.finish(j, 'cancelled'); return { ok: true }; }); }
  addBudget(uid, jid, value) { return this.write(s => { const j = s.jobs.find(j => j.id === jid && j.ownerId === uid && j.status === 'running') || fail('Lucrare activă inexistentă', 404); const n = amount(value, .1, 1000); if (j.escrow + j.spent + n > 1000000) fail('Maximum 1000 credite per lucrare'); this.money(uid, -n, 'Buget suplimentar rezervat', jid); j.escrow += n; return { ok: true }; }); }
  waitingReason(j) {
    if (j.status !== 'running') return null;
    const task = j.tasks.find(t => t.status === 'pending'); if (!task) return 'Se finalizează sarcinile atribuite.';
    const devices = this.s.devices.filter(d => this.eligible(d, j, j.mode === 'blender' ? 'gpu' : 'cpu'));
    if (!devices.length) return 'Așteaptă un PC compatibil și autorizat. Verifică disponibilitatea, permisiunile și memoria necesară.';
    const available = j.escrow - j.tasks.filter(t => t.status === 'assigned').reduce((n, t) => n + t.charge, 0);
    if (devices.every(d => this.quote(j, task, d) > available)) return 'Bugetul rămas nu ajunge pentru următoarea sarcină. Adaugă credite pentru a continua.';
    return 'Distribuire dinamică: fiecare PC liber preia următoarea sarcină.';
  }
  result(uid, jid, frame) {
    const j = this.s.jobs.find(j => j.id === jid && j.ownerId === uid) || fail('Lucrare inaccesibilă', 404);
    if (j.mode === 'blender') { const t = j.tasks.find(t => t.frame === frame && t.status === 'done'); return t && this.store.get(t.id) || fail('Cadru indisponibil', 404); }
    if (j.status !== 'done') fail('Lucrarea nu este terminată', 409);
    const pixels = Buffer.alloc(j.width * j.height * 3); for (const t of j.tasks) this.store.get(t.id).copy(pixels, t.y * j.width * 3);
    return encodeRgbPng(j.width, j.height, pixels);
  }
  agentProject(did, pid) {
    if (!this.s.jobs.some(j => j.projectId === pid && j.status === 'running' && j.tasks.some(t => t.deviceId === did && t.status === 'assigned' && t.expires > this.clock()))) fail('Proiect neatribuit acestui PC', 403);
    return this.store.get('project:' + pid) || fail('Proiect indisponibil', 404);
  }
  state(uid) {
    const s = this.s; const u = this.user(uid);
    const deviceView = d => ({ id: d.id, ownerId: d.ownerId, owner: this.user(d.ownerId).name, name: d.name, cpu: d.cpu, gpu: d.gpu, slots: d.slots, gpuRender: d.gpuRender, ramGb: d.ramGb, vramGb: d.vramGb, until: d.until, market: d.market, commitment: d.commitment, price: d.price / 1000, online: this.online(d), completed: d.completed, failed: d.failed,
      busy: s.jobs.flatMap(j => j.tasks).filter(t => t.status === 'assigned' && t.deviceId === d.id).length,
      earned: s.ledger.filter(l => l.userId === d.ownerId && l.reason === 'Sarcină acceptată').reduce((n,l) => n + l.delta, 0) / 1000 });
    return { user: { id: u.id, name: u.name, email: u.email, credits: u.balance / 1000 },
      projects: (s.projects || []).filter(p => p.ownerId === uid).map(p => ({ id: p.id, name: p.name, bytes: p.bytes })),
      devices: s.devices.filter(d => d.ownerId === uid || d.market && this.online(d)).map(d => ({ ...deviceView(d), customProjects: !!d.customProjects })),
      jobs: s.jobs.filter(j => j.ownerId === uid).slice(-30).reverse().map(j => ({ id: j.id, mode: j.mode, projectName: j.projectName, startFrame: j.startFrame, providerId: j.providerId, provider: s.devices.find(d => d.id === j.providerId)?.name || 'Automat', status: j.status, execution: j.execution, total: j.tasks.length, done: j.tasks.filter(t => t.status === 'done').length, spent: j.spent / 1000, reserved: j.escrow / 1000, error: j.error, waiting: this.waitingReason(j), frames: j.frames, contributions: j.tasks.filter(t => t.status === 'done').reduce((a, t) => { const name = s.devices.find(d => d.id === t.deviceId)?.name || 'PC'; a[name] = (a[name] || 0) + 1; return a; }, {}) })),
      ledger: s.ledger.filter(l => l.userId === uid).slice(-30).reverse().map(l => ({ ...l, delta: l.delta / 1000 })) };
  }
  close() { this.store.close(); }
}
module.exports = { Hub, fail, hash, amount };
