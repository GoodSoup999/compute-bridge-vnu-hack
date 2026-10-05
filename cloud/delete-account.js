// Called only through the localhost administrator or the offline CLI.
function deleteAccount(store, email, confirmed) {
  if (confirmed !== true) throw new Error('Ștergerea este permanentă. Folosește delete EMAIL --confirm.');
  const normalized = String(email || '').trim().toLowerCase();
  return store.transaction(s => {
    const user = s.users.find(u => u.email === normalized);
    if (!user) throw new Error('Cont inexistent');
    const devices = new Set(s.devices.filter(d => d.ownerId === user.id).map(d => d.id));
    if (s.jobs.some(j => j.status === 'running' && (j.ownerId === user.id || devices.has(j.requestDeviceId) || devices.has(j.providerId))) ||
        s.jobs.some(j => j.tasks.some(t => t.status === 'assigned' && devices.has(t.deviceId)))) {
      throw new Error('Contul are lucrări active sau este furnizor pentru o lucrare activă. Finalizează sau anulează lucrările înainte de ștergere.');
    }
    const jobs = s.jobs.filter(j => j.ownerId === user.id);
    const projects = (s.projects || []).filter(p => p.ownerId === user.id);
    const remove = store.db.prepare('DELETE FROM results WHERE id=?');
    for (const j of jobs) for (const t of j.tasks) remove.run(t.id);
    for (const p of projects) remove.run('project:' + p.id);
    s.jobs = s.jobs.filter(j => j.ownerId !== user.id);
    s.projects = (s.projects || []).filter(p => p.ownerId !== user.id);
    s.devices = s.devices.filter(d => d.ownerId !== user.id);
    s.sessions = s.sessions.filter(x => x.userId !== user.id);
    s.ledger = s.ledger.filter(x => x.userId !== user.id);
    s.users = s.users.filter(u => u.id !== user.id);
    return { ok: true, deletedEmail: normalized };
  });
}
module.exports = { deleteAccount };
