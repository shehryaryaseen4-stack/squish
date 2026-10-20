'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

// Monday 19 Oct 2026, 10:00 in Karachi.
const NOW = new Date('2026-10-19T05:00:00Z');

async function start() {
  const server = createServer({ seed: 'empty', now: () => NOW });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, token, text } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : text,
    });
    const raw = await res.text();
    let json = null;
    try { json = JSON.parse(raw); } catch { /* plain text */ }
    return { status: res.status, body: json, text: raw };
  };
  const token = (await call('/api/admin/login', { method: 'POST', body: { pin: '1234' } })).body.token;
  const add = async (name, phone, payment) => (await call('/api/admin/members', { method: 'POST', token, body: { name, phone, joinDate: '2026-09-01', payment } })).body.member;
  return { call, token, add, close: () => new Promise((r) => server.close(r)) };
}

test('monthly register: who came, who paid, and what was collected from whom', async (t) => {
  const app = await start();
  t.after(app.close);
  const { call, token, add } = app;
  const paidCame = await add('Ali', '03000000001', { planId: 'plan-1m', periodStart: '2026-10-01', date: '2026-10-03', paid: 5000, method: 'Cash' });
  const paidAway = await add('Bilal', '03000000002', { planId: 'plan-3m', periodStart: '2026-09-01', date: '2026-09-01', paid: 13500 });
  const unpaidCame = await add('Saad', '03000000003', { planId: 'plan-1m', periodStart: '2026-09-01', date: '2026-09-01', paid: 5000 });
  await add('Zain', '03000000004');
  await call('/api/admin/checkin', { method: 'POST', token, body: { memberId: paidCame.id } });
  await call('/api/admin/checkin', { method: 'POST', token, body: { memberId: unpaidCame.id } });

  const r = await call('/api/admin/register?month=2026-10', { token });
  assert.equal(r.body.from, '2026-10-01');
  assert.equal(r.body.to, '2026-10-19');
  assert.deepEqual(r.body.totals, { members: 4, came: 2, notCame: 2, paid: 2, notPaid: 2, frozen: 0, collected: 5000, payers: 1, visits: 2 });
  const row = (id) => r.body.rows.find((x) => x.id === id);
  assert.equal(row(paidCame.id).received[0].amount, 5000);
  assert.equal(row(paidAway.id).paid, true);
  assert.equal(row(paidAway.id).paidTill, '2026-11-30');
  assert.equal(row(paidAway.id).visits, 0);
  assert.equal(row(unpaidCame.id).paid, false);

  const sept = await call('/api/admin/register?month=2026-09', { token });
  assert.equal(sept.body.totals.collected, 13500 + 5000);
  const day = await call('/api/admin/register?day=2026-10-19', { token });
  assert.equal(day.body.totals.came, 2);
});

test('fingerprint machine: waits for approval, then punches check members in and out', async (t) => {
  const app = await start();
  t.after(app.close);
  const { call, token, add } = app;
  const m = await add('Ali', '03000000001', { planId: 'plan-1m', periodStart: '2026-10-01', date: '2026-10-01', paid: 5000 });

  const hello = await call('/iclock/cdata?SN=ZK123&options=all');
  assert.equal(hello.status, 403);
  const [device] = (await call('/api/admin/devices', { token })).body;
  assert.equal(device.sn, 'ZK123');
  assert.equal(device.approved, false);
  await call('/api/admin/devices/ZK123', { method: 'PUT', token, body: { approved: true, name: 'Front gate' } });

  const options = await call('/iclock/cdata?SN=ZK123&options=all');
  assert.equal(options.status, 200);
  assert.match(options.text, /GET OPTION FROM: ZK123/);

  const log = [
    `${m.memberNo}\t2026-10-19 07:00:10\t0\t1\t0\t0`,
    `${m.memberNo}\t2026-10-19 07:00:40\t0\t1\t0\t0`, // double tap, ignored
    `${m.memberNo}\t2026-10-19 08:20:00\t1\t1\t0\t0`,
    '9999\t2026-10-19 08:30:00\t0\t1\t0\t0', // not a member
  ].join('\n');
  const posted = await call('/iclock/cdata?SN=ZK123&table=ATTLOG&Stamp=1', { method: 'POST', text: log });
  assert.equal(posted.text, 'OK: 4');

  const att = (await call('/api/admin/attendance?date=2026-10-19', { token })).body.list;
  assert.equal(att.length, 1);
  assert.equal(att[0].in, '07:00');
  assert.equal(att[0].out, '08:20');
  assert.equal(att[0].source, 'fingerprint');
  const [after] = (await call('/api/admin/devices', { token })).body;
  assert.equal(after.punches, 2);
  assert.deepEqual(after.unknownIds, ['9999']);
  assert.equal((await call('/iclock/getrequest?SN=ZK123')).text, 'OK');

  // The owner can try it without a machine.
  const test1 = await call('/api/admin/devices/test-punch', { method: 'POST', token, body: { memberNo: String(m.memberNo) } });
  assert.equal(test1.body.result, 'in');
});
