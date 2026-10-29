'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { restoreLine } = require('../lib/gate');

// Monday 19 Oct 2026, 10:00 in Karachi; tests move the clock forward.
async function start() {
  let now = new Date('2026-10-19T05:00:00Z').getTime();
  const server = createServer({ seed: 'empty', reminders: false, now: () => new Date(now) });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, token, text } = {}) => {
    const res = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : text });
    const raw = await res.text();
    let json = null;
    try { json = JSON.parse(raw); } catch { /* plain text */ }
    return { status: res.status, body: json, text: raw };
  };
  const token = (await call('/api/admin/login', { method: 'POST', body: { pin: '1234' } })).body.token;
  const add = async (name, phone, payment) => (await call('/api/admin/members', { method: 'POST', token, body: { name, phone, joinDate: '2026-08-01', payment } })).body.member;
  const later = (ms = 31000) => { now += ms; };
  // What the machine is told when it next asks for work, without the queue ids.
  const work = async (sn) => (await call(`/iclock/getrequest?SN=${sn}`)).text.split('\n').filter((l) => l.startsWith('C:')).map((l) => l.replace(/^C:\d+:/, ''));
  return { call, token, add, later, work, close: () => new Promise((r) => server.close(r)) };
}

const paidAug = { planId: 'plan-1m', periodStart: '2026-08-01', date: '2026-08-01', paid: 5000 }; // ran out on 31 Aug
const paidOct = { planId: 'plan-1m', periodStart: '2026-10-05', date: '2026-10-05', paid: 5000 };

test('attendance machine: expired members are taken off, and put back with their face after paying', async (t) => {
  const app = await start();
  t.after(app.close);
  const { call, token, add, later, work } = app;
  assert.equal((await call('/api/admin/devices', { method: 'POST', token, body: { type: 'zk-face', name: 'Gate', sn: 'NYU7252500300' } })).status, 200);
  const ok = await add('Ali Paid', '03000000001', paidOct);
  const late = await add('Bilal Late', '03000000002', paidAug);
  const noFace = await add('Sara NoFace', '03000000003', paidAug);
  await call('/iclock/cdata?SN=NYU7252500300&options=all');
  await work('NYU7252500300'); // the new members' names go out first
  // The machine reports the faces and fingers registered on it.
  await call('/iclock/cdata?SN=NYU7252500300&table=OPERLOG', { method: 'POST', text: `FP PIN=${late.memberNo}\tFID=6\tSize=512\tValid=1\tTMP=AAAABBBBCCCCDDDD\nFACE PIN=${noFace.memberNo}\tFID=0\tSIZE=0\tVALID=1\tTMP=` });
  const dev = (await call('/api/admin/devices', { token })).body.devices[0];

  // Turning the gate on: Bilal (fee ended, finger saved) is taken off the machine.
  let st = (await call(`/api/admin/devices/${dev.id}/gate`, { method: 'PUT', token, body: { enabled: true, graceDays: 0 } })).body;
  assert.equal(st.mode, 'attendance');
  assert.deepEqual(st.blocked.map((x) => x.name), ['Bilal Late']);
  // Sara's face isn't saved, so she is left alone rather than losing it.
  assert.deepEqual(st.skipped.map((x) => x.name), ['Sara NoFace']);
  let cmds = await work('NYU7252500300');
  assert.ok(cmds.includes(`DATA DELETE USERINFO PIN=${late.memberNo}`), cmds.join('\n'));
  assert.ok(!cmds.some((c) => c.includes(`PIN=${ok.memberNo}`)));

  // Bilal pays: within half a minute he is back on the machine, with his fingerprint.
  await call('/api/admin/payments', { method: 'POST', token, body: { memberId: late.id, planId: 'plan-1m', periodStart: '2026-10-19', date: '2026-10-19', paid: 5000 } });
  later();
  cmds = await work('NYU7252500300');
  assert.ok(cmds.some((c) => c.startsWith(`DATA UPDATE USERINFO PIN=${late.memberNo}\t`)), cmds.join('\n'));
  assert.ok(cmds.includes(`DATA UPDATE FINGERTMP PIN=${late.memberNo}\tFID=6\tSize=512\tValid=1\tTMP=AAAABBBBCCCCDDDD`), cmds.join('\n'));
  st = (await call(`/api/admin/devices/${dev.id}/gate`, { token })).body;
  assert.equal(st.blocked.length, 0);

  // If the gym accepts re-registering, Sara is blocked too.
  st = (await call(`/api/admin/devices/${dev.id}/gate`, { method: 'PUT', token, body: { enabled: true, withoutBackup: true } })).body;
  assert.deepEqual(st.blocked.map((x) => x.name), ['Sara NoFace']);
  // Turning it off lets everyone back.
  later();
  st = (await call(`/api/admin/devices/${dev.id}/gate`, { method: 'PUT', token, body: { enabled: false } })).body;
  assert.equal(st.blocked.length, 0);
  cmds = await work('NYU7252500300');
  assert.ok(cmds.some((c) => c.startsWith(`DATA UPDATE USERINFO PIN=${noFace.memberNo}\t`)));

  // Asking the machine for saved faces.
  assert.equal((await call(`/api/admin/devices/${dev.id}/backup`, { method: 'POST', token })).body.asked, 2);
  assert.ok((await work('NYU7252500300')).includes(`DATA QUERY BIODATA Type=9\tPIN=${noFace.memberNo}`));
  // Its answer comes as bare BIODATA rows and is saved.
  await call('/iclock/cdata?SN=NYU7252500300&table=BIODATA', { method: 'POST', text: `Pin=${noFace.memberNo}\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=9\tMajorVer=58\tTmp=FACEFACEFACEFACE` });
  assert.ok((await call(`/api/admin/devices/${dev.id}/gate`, { token })).body.saved >= 2);

  // Grace days: blocked only after the extra days.
  st = (await call(`/api/admin/devices/${dev.id}/gate`, { method: 'PUT', token, body: { enabled: true, graceDays: 7, withoutBackup: true } })).body;
  assert.equal(st.blocked.length, 1, 'Sara ended in August, long past 7 days');
});

test('access-control machine: door rights are taken away and given back', async (t) => {
  const app = await start();
  t.after(app.close);
  const { call, token, add, later, work } = app;
  await call('/api/admin/devices', { method: 'POST', token, body: { type: 'zk-face', sn: 'ACC001' } });
  await call('/iclock/registry?SN=ACC001', { method: 'POST', text: 'DeviceType=acc' });
  const late = await add('Bilal Late', '03000000002', paidAug);
  let cmds = await work('ACC001');
  // New members go out in the access-control format.
  assert.ok(cmds.some((c) => c.startsWith(`DATA UPDATE user CardNo=\tPin=${late.memberNo}\t`)), cmds.join('\n'));
  assert.ok(cmds.includes(`DATA UPDATE userauthorize Pin=${late.memberNo}\tAuthorizeTimezoneId=1\tAuthorizeDoorId=1`));
  const dev = (await call('/api/admin/devices', { token })).body.devices[0];
  const st = (await call(`/api/admin/devices/${dev.id}/gate`, { method: 'PUT', token, body: { enabled: true } })).body;
  assert.equal(st.mode, 'access');
  assert.equal(st.blocked[0].how, 'rights');
  cmds = await work('ACC001');
  assert.ok(cmds.includes(`DATA DELETE userauthorize Pin=${late.memberNo}`), cmds.join('\n'));
  await call('/api/admin/payments', { method: 'POST', token, body: { memberId: late.id, planId: 'plan-1m', periodStart: '2026-10-19', date: '2026-10-19', paid: 5000 } });
  later();
  cmds = await work('ACC001');
  assert.ok(cmds.includes(`DATA UPDATE userauthorize Pin=${late.memberNo}\tAuthorizeTimezoneId=1\tAuthorizeDoorId=1`), cmds.join('\n'));
});

test('machine log: what the machine sent and what the app answered', async (t) => {
  const app = await start();
  t.after(app.close);
  const { call, token } = app;
  await call('/iclock/cdata?SN=LOG1&options=all'); // not added yet: refused, and logged
  await call('/api/admin/devices', { method: 'POST', token, body: { type: 'zk-fingerprint', sn: 'LOG1' } });
  await call('/iclock/cdata?SN=LOG1&options=all');
  for (let i = 0; i < 5; i++) await call('/iclock/getrequest?SN=LOG1');
  await call('/iclock/cdata?SN=LOG1&table=ATTLOG', { method: 'POST', text: '777\t2026-10-19 10:00:00\t0\t1' });
  const dev = (await call('/api/admin/devices', { token })).body.devices[0];
  assert.equal(dev.log, undefined, 'the device list stays small');
  const log = (await call(`/api/admin/devices/${dev.id}/log`, { token })).body.log;
  assert.equal(log[0].p, '/iclock/cdata?table=ATTLOG');
  assert.match(log[0].body, /^777\t/);
  assert.equal(log[0].reply, 'OK: 1');
  const polls = log.find((x) => x.p === '/iclock/getrequest');
  assert.ok(polls.n >= 5, 'repeated polls on one line');
  assert.ok(log.some((x) => x.status === 403), 'the refused call before it was added');
  await call(`/api/admin/devices/${dev.id}/log`, { method: 'DELETE', token });
  assert.equal((await call(`/api/admin/devices/${dev.id}/log`, { token })).body.log.length, 0);
  // Only staff with the machines right see it.
  assert.equal((await call(`/api/admin/devices/${dev.id}/log`)).status, 401);
});

test('saved templates become update commands', () => {
  assert.equal(restoreLine('FP PIN=7\tFID=6\tTMP=xx'), 'DATA UPDATE FINGERTMP PIN=7\tFID=6\tTMP=xx');
  assert.equal(restoreLine('FACE PIN=7\tFID=0\tTMP=xx'), 'DATA UPDATE FACE PIN=7\tFID=0\tTMP=xx');
  assert.equal(restoreLine('BIODATA Pin=7\tType=9\tTmp=xx'), 'DATA UPDATE BIODATA Pin=7\tType=9\tTmp=xx');
});
