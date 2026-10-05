// Separate loopback-only management channel; never mounted on the public hub port.
const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');
async function startAdmin(hub, infoFile) {
  const token = crypto.randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    const reply = (status, data) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (req.headers.authorization !== 'Bearer ' + token) return reply(403, { error: 'Acces interzis' });
    try {
      if (req.method !== 'POST' || req.url !== '/') throw new Error('Rută necunoscută');
      const parts = []; let size = 0; for await (const p of req) { size += p.length; if (size > 4096) throw new Error('Cerere prea mare'); parts.push(p); }
      const b = JSON.parse(Buffer.concat(parts).toString());
      if (b.command === 'list') return reply(200, { users: hub.s.users.map(u => ({ id: u.id, email: u.email, credits: u.balance / 1000 })), devices: hub.s.devices.map(d => ({ id: d.id, name: d.name, ownerId: d.ownerId })) });
      if (b.command === 'delete') return reply(200, require('./delete-account').deleteAccount(hub.store, b.email, b.confirm));
      hub.write(s => {
        if (b.command === 'credit') {
          const u = s.users.find(u => u.email === b.email); const n = Number(b.amount);
          if (!u || !Number.isFinite(n) || n <= 0 || n > 10000) throw new Error('Email sau sumă invalidă');
          hub.money(u.id, Math.round(n * 1000), 'Credite beta acordate de administrator', 'admin');
        }
        else throw new Error('Comandă necunoscută');
      }); reply(200, { ok: true });
    } catch (e) { reply(400, { error: e.message }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  fs.writeFileSync(infoFile, JSON.stringify({ port: server.address().port, token }), { mode: 0o600 });
  return () => { server.closeAllConnections(); server.close(); try { fs.unlinkSync(infoFile); } catch {} };
}
module.exports = { startAdmin };
