const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

class Store {
  constructor(file) {
    if (file !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      this.lock = path.resolve(file) + '.lock';
      if (fs.existsSync(this.lock)) {
        const pid = Number(fs.readFileSync(this.lock, 'utf8')); let alive = true;
        try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; }
        if (alive) throw new Error('Baza de date este folosită. Oprește hub-ul înainte de administrare sau o a doua instanță.');
        fs.unlinkSync(this.lock);
      }
      fs.writeFileSync(this.lock, String(process.pid), { flag: 'wx', mode: 0o600 });
    }
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS results (id TEXT PRIMARY KEY, data BLOB NOT NULL)');
    const row = this.db.prepare('SELECT data FROM state WHERE id=1').get();
    this.data = row ? JSON.parse(row.data) : { users: [], sessions: [], devices: [], jobs: [], ledger: [] };
  }
  transaction(fn) {
    const before = JSON.stringify(this.data);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn(this.data);
      this.db.prepare('INSERT INTO state VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(this.data));
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK'); this.data = JSON.parse(before); throw error;
    }
  }
  put(id, bytes) { this.db.prepare('INSERT OR REPLACE INTO results VALUES(?, ?)').run(id, bytes); }
  get(id) { const row = this.db.prepare('SELECT data FROM results WHERE id=?').get(id); return row && Buffer.from(row.data); }
  close() { this.db.close(); if (this.lock) fs.unlinkSync(this.lock); }
}
module.exports = { Store };
