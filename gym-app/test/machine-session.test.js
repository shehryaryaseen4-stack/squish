'use strict';

// A whole day with a face machine, as the SenseFace 2A talks once it has ADMS firmware:
// in access-control mode (how it ships) and in attendance mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

const SN = 'NYU7252500300';

async function start() {
  const server = createServer({ seed: 'empty', reminders: false, now: () => new Date('2026-11-23T05:00:00Z') });
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
  const add = async (name, phone) => (await call('/api/admin/members', { method: 'POST', token, body: { name, phone, joinDate: '2026-11-01', payment: { planId: 'plan-1m', periodStart: '2026-11-01', date: '2026-11-01', paid: 5000 } } })).body.member;
  const cmds = async () => (await call(`/iclock/getrequest?SN=${SN}`)).text.split('\n').filter((l) => l.startsWith('C:'));
  return { call, token, add, cmds, close: () => new Promise((r) => server.close(r)) };
}

test('access-control face machine: connect, get members, register face and thumb, check in', async (t) => {
  const { call, token, add, cmds, close } = await start();
  t.after(close);
  const ali = await add('Ali Khan', '03000000011');
  const sara = await add('Sara Ahmed', '03000000012');

  // Before it is added in Settings the machine is refused, and shows up as found.
  assert.equal((await call(`/iclock/cdata?SN=${SN}&options=all&pushver=3.1.2`)).status, 403);
  assert.equal((await call('/api/admin/devices', { method: 'POST', token, body: { type: 'zk-face', name: 'Gate', sn: SN } })).status, 200);

  // Hello, registration and settings, then the heartbeat.
  assert.equal((await call(`/iclock/cdata?SN=${SN}&options=all&pushver=3.1.2`)).status, 200);
  assert.equal((await call(`/iclock/registry?SN=${SN}`, { method: 'POST', text: 'DeviceType=acc,~DeviceName=SenseFace 2A,FirmVer=ZAM70' })).text, `RegistryCode=${SN}`);
  assert.match((await call(`/iclock/push?SN=${SN}`, { method: 'POST' })).text, /ServerName=ADMS/);
  assert.equal((await call(`/iclock/ping?SN=${SN}`)).text, 'OK');
  const dev = (await call('/api/admin/devices', { token })).body.devices[0];
  assert.equal((await call(`/api/admin/devices/${dev.id}/check`, { token })).body.ok, true);

  // "Send all members": each one goes out as a user with door rights.
  assert.equal((await call(`/api/admin/devices/${dev.id}/sync`, { method: 'POST', token })).body.queued, 2);
  const sent = await cmds();
  for (const m of [ali, sara]) {
    assert.ok(sent.some((c) => c.includes(`DATA UPDATE user CardNo=\tPin=${m.memberNo}\t`)), sent.join('\n'));
    assert.ok(sent.some((c) => c.endsWith(`DATA UPDATE userauthorize Pin=${m.memberNo}\tAuthorizeTimezoneId=1\tAuthorizeDoorId=1`)));
  }
  // The machine says each command worked.
  const ids = sent.map((c) => c.split(':')[1]);
  assert.equal((await call(`/iclock/devicecmd?SN=${SN}`, { method: 'POST', text: ids.map((id) => `ID=${id}&Return=0&CMD=DATA`).join('\n') })).text, 'OK');
  assert.equal((await cmds()).length, 0, 'nothing sent twice');

  // Faces and thumbs registered at the machine come back as table data.
  const face = `pin=${ali.memberNo}\tno=0\tindex=0\tvalid=1\tduress=0\ttype=9\tmajorver=58\tminorver=1\tformat=0\ttmp=FACEFACEFACEFACEFACE`;
  assert.equal((await call(`/iclock/cdata?SN=${SN}&table=tabledata&tablename=biodata&count=1`, { method: 'POST', text: `biodata ${face}` })).text, 'biodata=1');
  const thumb = `pin=${sara.memberNo}\tno=6\tindex=0\tvalid=1\tduress=0\ttype=1\tmajorver=10\tminorver=0\tformat=0\ttmp=THUMBTHUMBTHUMBTHUMB`;
  await call(`/iclock/cdata?SN=${SN}&table=tabledata&tablename=biodata&count=1`, { method: 'POST', text: thumb });
  await call(`/iclock/cdata?SN=${SN}&table=tabledata&tablename=user&count=1`, { method: 'POST', text: `user uid=2\tcardno=12345678\tpin=${sara.memberNo}\tpassword=\tgroup=0\tstarttime=0\tendtime=0\tname=Sara\tprivilege=0` });
  const aliNow = (await call(`/api/admin/members/${ali.id}`, { token })).body.member;
  const saraNow = (await call(`/api/admin/members/${sara.id}`, { token })).body.member;
  assert.equal(aliNow.credentials.face, true);
  assert.deepEqual(saraNow.credentials.fingers, [6]);
  assert.equal(saraNow.credentials.card, '12345678');
  assert.ok(Object.keys(aliNow.templates).length, 'the face is kept as a backup');

  // At the gate: Ali by face, Sara by thumb, a stranger, a refused entry, then Ali leaves.
  const rtlog = [
    `time=2026-11-23 07:05:00\tpin=${ali.memberNo}\tcardno=0\teventaddr=1\tevent=0\tinoutstatus=0\tverifytype=15\tindex=1`,
    `time=2026-11-23 07:06:00\tpin=${sara.memberNo}\tcardno=0\teventaddr=1\tevent=0\tinoutstatus=0\tverifytype=1\tindex=2`,
    'time=2026-11-23 07:07:00\tpin=0\tcardno=0\teventaddr=1\tevent=27\tinoutstatus=0\tverifytype=15\tindex=3',
    `time=2026-11-23 07:08:00\tpin=99999\tcardno=0\teventaddr=1\tevent=0\tinoutstatus=0\tverifytype=15\tindex=4`,
  ].join('\n');
  assert.equal((await call(`/iclock/cdata?SN=${SN}&table=rtlog&Stamp=1`, { method: 'POST', text: rtlog })).text, 'OK');
  await call(`/iclock/cdata?SN=${SN}&table=rtlog&Stamp=2`, { method: 'POST', text: `time=2026-11-23 08:30:00\tpin=${ali.memberNo}\tcardno=0\teventaddr=1\tevent=0\tinoutstatus=1\tverifytype=15\tindex=5` });
  assert.equal((await call(`/iclock/cdata?SN=${SN}&table=rtstate`, { method: 'POST', text: 'time=2026-11-23 08:31:00\tsensor=00\trelay=00\talarm=00' })).text, 'OK');
  const att = (await call('/api/admin/attendance?date=2026-11-23', { token })).body.list;
  const byName = Object.fromEntries(att.map((a) => [a.name || a.member?.name, a]));
  assert.equal(att.length, 2);
  const a = att.find((x) => x.memberId === ali.id);
  const s = att.find((x) => x.memberId === sara.id);
  assert.deepEqual([a.in, a.out, a.source], ['07:05', '08:30', 'face']);
  assert.deepEqual([s.in, s.source], ['07:06', 'fingerprint']);
  assert.ok(byName);
  const after = (await call('/api/admin/devices', { token })).body.devices[0];
  assert.equal(after.mode || (after.acMode ? 'access' : 'attendance'), 'access');
  assert.deepEqual(after.unknownIds, ['99999'], 'a face the machine knows but the app does not');
  // A new member added at the desk goes to the machine by itself.
  const zain = await add('Zain', '03000000013');
  assert.ok((await cmds()).some((c) => c.includes(`Pin=${zain.memberNo}\t`)));
  // Card and PIN from the app go out in the machine's own format.
  await call(`/api/admin/members/${zain.id}/enroll`, { method: 'POST', token, body: { deviceId: dev.id, method: 'card', card: '555666' } });
  assert.ok((await cmds()).some((c) => c.includes(`DATA UPDATE user CardNo=555666\tPin=${zain.memberNo}\t`)));
});

test('attendance-mode face machine: faces, thumbs and punches', async (t) => {
  const { call, token, add, cmds, close } = await start();
  t.after(close);
  const ali = await add('Ali Khan', '03000000011');
  await call('/api/admin/devices', { method: 'POST', token, body: { type: 'zk-face', name: 'Gate', sn: SN } });
  assert.match((await call(`/iclock/cdata?SN=${SN}&options=all`)).text, /TransFlag=.*FACE/);
  await cmds();
  await call(`/iclock/cdata?SN=${SN}&table=OPERLOG`, { method: 'POST', text: `FACE PIN=${ali.memberNo}\tFID=0\tSIZE=4\tVALID=1\tTMP=FACEFACEFACEFACE\nFP PIN=${ali.memberNo}\tFID=6\tSize=512\tValid=1\tTMP=AAAABBBBCCCCDDDD` });
  const m = (await call(`/api/admin/members/${ali.id}`, { token })).body.member;
  assert.equal(m.credentials.face, true);
  assert.deepEqual(m.credentials.fingers, [6]);
  assert.equal((await call(`/iclock/cdata?SN=${SN}&table=ATTLOG`, { method: 'POST', text: `${ali.memberNo}\t2026-11-23 07:05:00\t0\t15\t0\t0` })).text, 'OK: 1');
  const att = (await call('/api/admin/attendance?date=2026-11-23', { token })).body.list;
  assert.deepEqual([att[0].in, att[0].source], ['07:05', 'face']);
  // Face registration started from the app.
  const dev = (await call('/api/admin/devices', { token })).body.devices[0];
  await call(`/api/admin/members/${ali.id}/enroll`, { method: 'POST', token, body: { deviceId: dev.id, method: 'face' } });
  assert.ok((await cmds()).some((c) => c.endsWith(`ENROLL_BIO TYPE=9\tPIN=${ali.memberNo}\tRETRY=3\tOVERWRITE=1`)));
});
