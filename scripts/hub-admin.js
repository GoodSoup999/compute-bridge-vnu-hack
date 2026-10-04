// Uses the separate localhost management channel while the hub is running.
const fs = require('node:fs');
const path = require('node:path');
const { Store } = require('../cloud/store');
const args = process.argv.slice(2);
const file = process.env.HUB_DB || path.join(__dirname, '../data/hub.sqlite');
if (fs.existsSync(file + '.admin.json')) {
  const { port, token } = JSON.parse(fs.readFileSync(file + '.admin.json'));
  fetch(`http://127.0.0.1:${port}/`, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ command: args[0], email: args[1], amount: args[2], deviceId: args[1] }), signal: AbortSignal.timeout(5000) })
    .then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); console.log(JSON.stringify(b, null, 2)); })
    .catch(e => { console.error('Administrarea locală nu răspunde: ' + e.message + '. Repornește hub-ul dacă a fost oprit forțat.'); process.exitCode = 1; });
} else {
const store = new Store(file);
try {
  if (args[0] === 'list') console.log(JSON.stringify({ users: store.data.users.map(u => ({ id: u.id, email: u.email, credits: u.balance / 1000 })), devices: store.data.devices.map(d => ({ id: d.id, name: d.name, ownerId: d.ownerId, approved: d.approved })) }, null, 2));
  else store.transaction(s => {
    if (args[0] === 'credit') {
      const user = s.users.find(u => u.email === args[1]); const n = Number(args[2]);
      if (!user || !Number.isFinite(n) || n <= 0 || n > 10000) throw new Error('credit EMAIL SUMA (0–10000)');
      const delta = Math.round(n * 1000); user.balance += delta;
      s.ledger.push({ id: require('crypto').randomUUID(), userId: user.id, delta, reason: 'Credite beta acordate de administrator', ref: 'admin', at: Date.now() });
    } else if (args[0] === 'approve') {
      const d = s.devices.find(d => d.id === args[1]); if (!d) throw new Error('Dispozitiv necunoscut'); d.approved = true;
    } else throw new Error('Comenzi: list | credit EMAIL SUMA | approve DEVICE_ID');
    console.log('Actualizat. Poți reporni hub-ul.');
  });
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { store.close(); }
}
