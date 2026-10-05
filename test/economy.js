const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHubServer } = require('../cloud/server');
const { request } = require('../lib/remote-agent');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-economy-'));
  const file = path.join(dir, 'hub.sqlite'); let app = createHubServer({file});
  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + app.server.address().port;
    const api = (token, route, data) => request(base, token, '/v1/' + route, data === undefined ? 'GET' : 'POST', data);
    const user = await api('', 'auth/register', {email:'economy@test.example',password:'demo-password-123'});
    const other = await api('', 'auth/register', {email:'other@test.example',password:'demo-password-123'});
    const buy = {credits:500, requestId:crypto.randomUUID()};
    await assert.rejects(api('', 'wallet/buy', buy), e => e.status === 401);
    await Promise.all([api(user.token,'wallet/buy',buy),api(user.token,'wallet/buy',buy)]);
    let state = await api(user.token,'state'); assert.equal(state.user.credits,600);
    assert.equal(state.wallet.transactions.length,1); assert.equal(state.wallet.transactions[0].euroCents,500);
    assert.equal(state.wallet.transactions[0].status,'simulated');
    await assert.rejects(api(user.token,'wallet/withdraw',buy),e=>e.status===409);
    for(const credits of [-1,0,9,10.5,10001,'100',null]) await assert.rejects(api(user.token,'wallet/buy',{credits,requestId:crypto.randomUUID()}));
    await assert.rejects(api(user.token,'wallet/withdraw',{credits:601,requestId:crypto.randomUUID()}),e=>e.status===402);
    // Reserved budget is unavailable for withdrawals.
    app.hub.write(() => app.hub.money(state.user.id,-550000,'Buget rezervat','test-escrow'));
    await assert.rejects(api(user.token,'wallet/withdraw',{credits:100,requestId:crypto.randomUUID()}),e=>e.status===402);
    app.hub.write(() => app.hub.money(state.user.id,550000,'Buget restituit','test-escrow'));
    const withdrawal = {credits:200, requestId:crypto.randomUUID()};
    await Promise.all([api(user.token,'wallet/withdraw',withdrawal),api(user.token,'wallet/withdraw',withdrawal)]);
    state = await api(user.token,'state'); assert.equal(state.user.credits,400);
    assert.equal(state.wallet.transactions.length,2);
    assert.equal((await api(other.token,'state')).user.credits,100);
    assert.equal((await api(other.token,'state')).wallet.transactions.length,0);
    await app.close(); app = createHubServer({file});
    await new Promise(r => app.server.listen(0,'127.0.0.1',r));
    const persisted = await request('http://127.0.0.1:'+app.server.address().port,user.token,'/v1/state');
    assert.equal(persisted.user.credits,400); assert.equal(persisted.wallet.transactions.length,2);
    console.log('PASS demo economy: authentication, duplicate requests, validation, insufficient/escrow balance, privacy and restart persistence.');
  } finally { await app.close(); fs.rmSync(dir,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1;});
