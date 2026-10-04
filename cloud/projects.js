const crypto = require('node:crypto');
const { fail } = require('./service');
const { MAX_PROJECT_BYTES, readProject } = require('../lib/project-file');
function upload(hub, uid, name, bytes) {
  return hub.write(s => {
    hub.user(uid); s.projects ||= [];
    const own = s.projects.filter(p => p.ownerId === uid);
    if (own.length >= 3 || own.reduce((n, p) => n + p.bytes, 0) + bytes.length > 96 * 1024 * 1024) fail('Maximum 3 proiecte / 96 MB per cont. Șterge un proiect nefolosit.');
    if (s.projects.reduce((n, p) => n + p.bytes, 0) + bytes.length > 256 * 1024 * 1024) fail('Stocarea proiectelor pe gazdă este ocupată');
    const project = { id: crypto.randomUUID(), ownerId: uid, name: String(name || 'proiect.blend').replace(/[\\/]/g, '_').slice(0, 100), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), createdAt: hub.clock() };
    hub.store.put('project:' + project.id, bytes); s.projects.push(project); return project;
  });
}
function remove(hub, uid, pid) {
  return hub.write(s => {
    const project = (s.projects || []).find(p => p.id === pid && p.ownerId === uid) || fail('Proiect inaccesibil', 404);
    if (s.jobs.some(j => j.projectId === pid && j.status === 'running')) fail('Proiectul este folosit de o lucrare activă', 409);
    s.projects = s.projects.filter(p => p !== project);
    hub.store.db.prepare('DELETE FROM results WHERE id=?').run('project:' + pid);
    return { ok: true };
  });
}
module.exports = { MAX_PROJECT_BYTES, readProject, upload, remove };
