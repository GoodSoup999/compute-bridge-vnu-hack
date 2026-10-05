const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../cloud/store');
const { deleteAccount } = require('../cloud/delete-account');
const { startAdmin } = require('../cloud/admin');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-delete-test-'));
  const file = path.join(dir, 'hub.sqlite');
  let store = new Store(file); let stop;
  try {
    store.transaction(s => {
      s.users.push({ id: 'a', email: 'a@example.com', balance: 100 }, { id: 'b', email: 'b@example.com', balance: 999 });
      s.sessions.push({ userId: 'a' }, { userId: 'b' });
      s.devices.push({ id: 'da', ownerId: 'a' }, { id: 'db', ownerId: 'b' });
      s.projects = [{ id: 'pa', ownerId: 'a' }, { id: 'pb', ownerId: 'b' }];
      s.jobs.push({ id: 'ja', ownerId: 'a', status: 'done', tasks: [{ id: 'ta', status: 'done' }] },
        { id: 'jb', ownerId: 'b', status: 'running', providerId: 'da', tasks: [{ id: 'tb', status: 'pending' }] });
      s.ledger.push({ userId: 'a' }, { userId: 'b' });
      store.put('ta', Buffer.from('private')); store.put('project:pa', Buffer.from('private'));
      store.put('tb', Buffer.from('other')); store.put('project:pb', Buffer.from('other'));
    });
    assert.throws(() => deleteAccount(store, 'a@example.com', false), /confirm/);
    assert.throws(() => deleteAccount(store, 'a@example.com', true), /active/);
    assert.equal(store.data.users.length, 2);
    store.transaction(s => { s.jobs[1].providerId = null; s.jobs[1].tasks[0] = { id: 'tb', status: 'assigned', deviceId: 'da' }; });
    assert.throws(() => deleteAccount(store, 'a@example.com', true), /active/);
    store.transaction(s => { s.jobs[1].tasks[0].status = 'done'; s.jobs[1].status = 'done'; });
    const hub = { store, get s() { return store.data; } };
    stop = await startAdmin(hub, file + '.admin.json');
    const { port, token } = JSON.parse(fs.readFileSync(file + '.admin.json'));
    const call = (auth, confirm) => fetch('http://127.0.0.1:' + port + '/', {
      method: 'POST', headers: { authorization: 'Bearer ' + auth, 'content-type': 'application/json' },
      body: JSON.stringify({ command: 'delete', email: ' A@EXAMPLE.COM ', confirm })
    });
    assert.equal((await call('wrong', true)).status, 403);
    assert.equal((await call(token, false)).status, 400);
    assert.equal((await call(token, true)).status, 200);
    stop(); stop = null; store.close(); store = new Store(file);
    assert.deepEqual(store.data.users, [{ id: 'b', email: 'b@example.com', balance: 999 }]);
    for (const key of ['sessions', 'ledger']) assert.deepEqual(store.data[key], [{ userId: 'b' }]);
    assert.equal(store.data.devices[0].id, 'db'); assert.equal(store.data.jobs[0].id, 'jb');
    assert.equal(store.data.projects[0].id, 'pb');
    assert.equal(store.get('ta'), undefined); assert.equal(store.get('project:pa'), undefined);
    assert.equal(store.get('tb').toString(), 'other'); assert.equal(store.get('project:pb').toString(), 'other');
    assert.throws(() => deleteAccount(store, 'a@example.com', true), /inexistent/);
    console.log('Account deletion: active work protected, admin authenticated, other accounts retained, deletion persisted.');
  } finally {
    stop?.(); store.close();
    // Only the temporary directory created above is removed.
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
