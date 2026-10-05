const crypto = require('node:crypto');
const { fail } = require('./service');
const RATE = 1; // Demonstration only: one whole credit corresponds to one euro cent.
function transact(hub, uid, kind, body) {
  if (!['buy', 'withdraw'].includes(kind)) fail('Operație necunoscută');
  const credits = body.credits;
  if (!Number.isInteger(credits) || credits < 10 || credits > 10000) fail('Alege între 10 și 10000 de credite întregi');
  if (!/^[a-f0-9-]{36}$/i.test(body.requestId || '')) fail('Identificator de tranzacție invalid');
  return hub.write(s => {
    hub.user(uid); s.demoTransactions ||= [];
    const existing = s.demoTransactions.find(t => t.userId === uid && t.requestId === body.requestId);
    if (existing) {
      if (existing.kind !== kind || existing.credits !== credits) fail('Identificator reutilizat pentru altă tranzacție', 409);
      return { ok: true, transaction: existing, duplicate: true };
    }
    if (s.demoTransactions.filter(t => t.userId === uid && hub.clock() - t.at < 86400000).length >= 100) fail('Maximum 100 de tranzacții demo pe zi', 429);
    const t = { id: crypto.randomUUID(), userId: uid, requestId: body.requestId, kind, credits,
      euroCents: credits * RATE, status: 'simulated', at: hub.clock() };
    hub.money(uid, (kind === 'buy' ? 1 : -1) * credits * 1000,
      kind === 'buy' ? 'Cumpărare credite · DEMO, fără plată reală' : 'Retragere credite · DEMO, fără transfer bancar', t.id);
    s.demoTransactions.push(t);
    return { ok: true, transaction: t };
  });
}
function view(hub, uid) {
  return { demo: true, currency: 'EUR', euroCentsPerCredit: RATE,
    transactions: (hub.s.demoTransactions || []).filter(t => t.userId === uid).slice(-30).reverse() };
}
module.exports = { transact, view };
