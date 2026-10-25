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

test('attendance machines: add by type, check the connection, and punches check members in and out', async (t) => {
  const app = await start();
  t.after(app.close);
  const { call, token, add } = app;
  const m = await add('Ali', '03000000001', { planId: 'plan-1m', periodStart: '2026-10-01', date: '2026-10-01', paid: 5000 });

  const { body: list } = await call('/api/admin/devices', { token });
  assert.ok(list.types.some((x) => x.id === 'zk-face'));
  assert.ok(list.types.some((x) => x.id === 'hik-face'));

  // A machine nobody added yet is refused but shows up as found.
  assert.equal((await call('/iclock/cdata?SN=ZK999&options=all')).status, 403);

  assert.equal((await call('/api/admin/devices', { method: 'POST', token, body: { type: 'zk-fingerprint', sn: 'bad sn!' } })).status, 400);
  const added = await call('/api/admin/devices', { method: 'POST', token, body: { type: 'zk-fingerprint', name: 'Front gate', sn: 'zk123' } });
  assert.equal(added.body.sn, 'ZK123');
  assert.equal(added.body.online, false);

  // Before the machine calls in, the check explains what is wrong.
  const before = await call(`/api/admin/devices/${added.body.id}/check`, { token });
  assert.equal(before.body.ok, false);
  assert.equal(before.body.code, 'wrong-serial');
  assert.match(before.body.message, /ZK999/);

  const options = await call('/iclock/cdata?SN=ZK123&options=all');
  assert.equal(options.status, 200);
  assert.match(options.text, /GET OPTION FROM: ZK123/);
  const after = await call(`/api/admin/devices/${added.body.id}/check`, { token });
  assert.equal(after.body.ok, true);

  const log = [
    `${m.memberNo}\t2026-10-19 07:00:10\t0\t1\t0\t0`,
    `${m.memberNo}\t2026-10-19 07:00:40\t0\t1\t0\t0`, // double tap, ignored
    `${m.memberNo}\t2026-10-19 08:20:00\t1\t1\t0\t0`,
    '9999\t2026-10-19 08:30:00\t0\t1\t0\t0', // not a member
  ].join('\n');
  assert.equal((await call('/iclock/cdata?SN=ZK123&table=ATTLOG&Stamp=1', { method: 'POST', text: log })).text, 'OK: 4');
  const att = (await call('/api/admin/attendance?date=2026-10-19', { token })).body.list;
  assert.equal(att.length, 1);
  assert.equal(att[0].in, '07:00');
  assert.equal(att[0].out, '08:20');
  assert.equal(att[0].source, 'fingerprint');
  const zk = (await call('/api/admin/devices', { token })).body.devices.find((x) => x.sn === 'ZK123');
  assert.equal(zk.punches, 2);
  assert.deepEqual(zk.unknownIds, ['9999']);

  // Hikvision face terminal: events arrive at /hik/<key>.
  const hik = await call('/api/admin/devices', { method: 'POST', token, body: { type: 'hik-face', name: 'Face gate' } });
  assert.ok(hik.body.key);
  const event = JSON.stringify({ dateTime: '2026-10-19T09:40:05+05:00', eventType: 'AccessControllerEvent', AccessControllerEvent: { majorEventType: 5, subEventType: 75, employeeNoString: String(m.memberNo), currentVerifyMode: 'face' } });
  const multipart = `--boundary\r\nContent-Disposition: form-data; name="AccessControllerEvent"\r\nContent-Type: application/json\r\n\r\n${event}\r\n--boundary--\r\n`;
  assert.equal((await call(`/hik/${hik.body.key}`, { method: 'POST', text: multipart })).status, 200);
  assert.equal((await call('/hik/wrong-key', { method: 'POST', text: multipart })).status, 404);
  const att2 = (await call('/api/admin/attendance?date=2026-10-19', { token })).body.list;
  assert.ok(att2.some((a) => a.in === '09:40' && a.source === 'face'));
  assert.equal((await call(`/api/admin/devices/${hik.body.id}/check`, { token })).body.ok, true);

  // The owner can try it without a machine.
  const test1 = await call('/api/admin/devices/test-punch', { method: 'POST', token, body: { memberNo: String(m.memberNo) } });
  assert.equal(test1.body.result, 'out');
});

test('member photos: set from the app or the desk, shown to staff and on the entry screen', async (t) => {
  const app = await start();
  t.after(app.close);
  const { call, token } = app;
  const { body } = await call('/api/admin/members', { method: 'POST', token, body: { name: 'Sara', phone: '03000000009', joinDate: '2026-10-01', payment: { planId: 'plan-1m', periodStart: '2026-10-01', date: '2026-10-01', paid: 5000 } } });
  const mt = (await call('/api/member/login', { method: 'POST', body: { id: body.member.memberNo, pin: body.pin } })).body.token;
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  assert.equal((await call('/api/member/photo', { method: 'PUT', token: mt, body: { image: 'not a photo' } })).status, 400);
  const set = await call('/api/member/photo', { method: 'PUT', token: mt, body: { image: jpeg } });
  assert.equal(set.status, 200);
  assert.ok(set.body.photo.startsWith('data:image/jpeg'));
  const list = await call('/api/admin/members?status=all', { token });
  assert.equal(list.body[0].photo, set.body.photo);

  await call('/api/admin/checkin', { method: 'POST', token, body: { memberId: body.member.id } });
  const feed = await call('/api/admin/display', { token });
  assert.equal(feed.body.events[0].type, 'in');
  assert.equal(feed.body.events[0].member.photo, set.body.photo);
  assert.equal(feed.body.events[0].summary.daysLeft, 12);
  assert.equal(feed.body.insideNow, 1);

  await call(`/api/admin/members/${body.member.id}/photo`, { method: 'DELETE', token });
  assert.equal((await call('/api/member/me', { token: mt })).body.member.photo, undefined);
});

test('registering a finger, face, card or PIN on the machine from the app', async (t) => {
  const { createServer: make } = require('../server');
  const server = make({ seed: 'empty', reminders: false });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, { method = 'GET', body, token, raw } = {}) => {
    const res = await fetch(base + p, { method, headers: { 'Content-Type': raw ? 'text/plain' : 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* text */ }
    return { status: res.status, body: json, text };
  };
  const token = (await call('/api/admin/login', { method: 'POST', body: { pin: '1234' } })).body.token;
  const dev = (await call('/api/admin/devices', { method: 'POST', token, body: { type: 'zk-face', sn: 'FACE0001', name: 'Door' } })).body;
  const opts = await call('/iclock/cdata?SN=FACE0001&options=all');
  assert.match(opts.text, /TransFlag=.*OpLog.*EnrollFP/);

  // Adding a member puts them on the machine.
  const { member } = (await call('/api/admin/members', { method: 'POST', token, body: { name: 'Sára Malik', phone: '03001234567', gender: 'female', joinDate: '2026-10-01' } })).body;
  let work = await call('/iclock/getrequest?SN=FACE0001');
  assert.match(work.text, /^C:\d+:DATA UPDATE USERINFO PIN=1001\tName=Sara Malik\tPri=0$/);
  assert.equal((await call('/iclock/getrequest?SN=FACE0001')).text, 'OK', 'each command is handed out once');

  // Face: the machine gets the user and an enrol command, then says it worked and uploads the face.
  const r = await call(`/api/admin/members/${member.id}/enroll`, { method: 'POST', token, body: { deviceId: dev.id, method: 'face' } });
  assert.equal(r.status, 200);
  work = (await call('/iclock/getrequest?SN=FACE0001')).text.split('\n');
  assert.equal(work.length, 2);
  assert.match(work[1], /ENROLL_BIO TYPE=9\tPIN=1001\tRETRY=3\tOVERWRITE=1/);
  const id = work[1].split(':')[1];
  await call('/iclock/devicecmd?SN=FACE0001', { method: 'POST', raw: `ID=${id}&Return=0&CMD=ENROLL_BIO` });
  await call('/iclock/cdata?SN=FACE0001&table=OPERLOG', { method: 'POST', raw: 'BIODATA Pin=1001\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=9\tMajorVer=40\tTmp=abc' });
  let st = (await call(`/api/admin/members/${member.id}/enroll`, { token })).body;
  assert.equal(st.commands[0].status, 'ok');
  assert.equal(st.credentials.face, true);

  // Fingerprint the machine can't start remotely: a clear message.
  await call(`/api/admin/members/${member.id}/enroll`, { method: 'POST', token, body: { deviceId: dev.id, method: 'fingerprint', finger: 6 } });
  work = (await call('/iclock/getrequest?SN=FACE0001')).text.split('\n');
  assert.match(work[1], /ENROLL_FP PIN=1001\tFID=6/);
  await call('/iclock/devicecmd?SN=FACE0001', { method: 'POST', raw: `ID=${work[1].split(':')[1]}&Return=-1002&CMD=ENROLL_FP` });
  st = (await call(`/api/admin/members/${member.id}/enroll`, { token })).body;
  assert.equal(st.commands[0].status, 'failed');
  assert.match(st.commands[0].error, /on the machine itself/);
  // …but a finger added on the machine still shows up.
  await call('/iclock/cdata?SN=FACE0001&table=OPERLOG', { method: 'POST', raw: 'FP PIN=1001\tFID=5\tSize=1000\tValid=1\tTMP=xyz' });

  // Card and PIN go straight onto the user.
  await call(`/api/admin/members/${member.id}/enroll`, { method: 'POST', token, body: { deviceId: dev.id, method: 'card', card: '0012 345678' } });
  work = (await call('/iclock/getrequest?SN=FACE0001')).text;
  assert.match(work, /Card=0012345678/);
  await call('/iclock/devicecmd?SN=FACE0001', { method: 'POST', raw: `ID=${work.split(':')[1]}&Return=0&CMD=DATA` });
  assert.equal((await call(`/api/admin/members/${member.id}/enroll`, { method: 'POST', token, body: { deviceId: dev.id, method: 'pin', pin: '12' } })).status, 400);

  const detail = (await call(`/api/admin/members/${member.id}`, { token })).body;
  assert.deepEqual(detail.member.credentials.fingers, [5]);
  assert.equal(detail.member.credentials.face, true);
  assert.equal(detail.member.credentials.card, '0012345678');
  const list = (await call('/api/admin/devices', { token })).body.devices;
  assert.equal(list[0].commands, undefined);

  // Deleting the member removes them from the machine.
  await call(`/api/admin/members/${member.id}`, { method: 'DELETE', token });
  assert.match((await call('/iclock/getrequest?SN=FACE0001')).text, /DATA DELETE USERINFO PIN=1001/);
});
