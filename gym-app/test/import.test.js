'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Sheet = require('../public/sheet');
const { createServer } = require('../server');

const xlsx = fs.readFileSync(path.join(__dirname, 'fixtures', 'members.xlsx'));

test('reads an Excel file and guesses its columns', async () => {
  const rows = await Sheet.readXlsx(xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.length));
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0].slice(0, 3), ['S.No', 'Member Name', 'Mobile']);
  const cols = Sheet.guessColumns(rows[0]);
  assert.deepEqual(cols, { paidOn: 7, validTill: 8, due: 9, memberNo: 0, joinDate: 4, name: 1, phone: 2, gender: 3, plan: 5, amount: 6, notes: 10 });
});

test('reads CSV and pasted rows, and dates written many ways', () => {
  assert.deepEqual(Sheet.parseCsv('Name,Phone\r\n"Khan, Ali",0300\r\n\r\n'), [['Name', 'Phone'], ['Khan, Ali', '0300']]);
  assert.deepEqual(Sheet.parseCsv('Name\tPhone\nAli\t0300'), [['Name', 'Phone'], ['Ali', '0300']]);
  assert.deepEqual(Sheet.parseCsv('Name;Phone\nAli;0300'), [['Name', 'Phone'], ['Ali', '0300']]);
  assert.equal(Sheet.toIsoDate('31/12/2026'), '2026-12-31');
  assert.equal(Sheet.toIsoDate('05/10/2026'), '2026-10-05');
  assert.equal(Sheet.toIsoDate('10/05/2026', false), '2026-10-05');
  assert.equal(Sheet.toIsoDate('2026-1-5'), '2026-01-05');
  assert.equal(Sheet.toIsoDate('5th Oct 2026'), '2026-10-05');
  assert.equal(Sheet.toIsoDate('Oct 5, 2026'), '2026-10-05');
  assert.equal(Sheet.toIsoDate(46300), '2026-10-05');
  assert.equal(Sheet.toIsoDate('31/02/2026'), null);
  assert.equal(Sheet.guessDayFirst([['12/31/2026']], [0]), false);
  // The template the app hands out maps itself.
  const head = ['Member no', 'Name', 'Phone', 'Gender', 'Join date', 'Plan', 'Fee paid', 'Paid on', 'Valid till', 'Balance', 'Date of birth', 'Address', 'Emergency phone', 'Notes'];
  assert.deepEqual(Sheet.guessColumns(head), { memberNo: 0, name: 1, phone: 2, gender: 3, joinDate: 4, plan: 5, amount: 6, paidOn: 7, validTill: 8, due: 9, dob: 10, address: 11, emergencyPhone: 12, notes: 13 });
  // Our own export: "Total paid" is all fees ever, not the last one.
  assert.equal(Sheet.guessColumns(['Name', 'Phone', 'Total paid']).amount, undefined);
});

test('imports members with their old numbers, fees and expiry', async (t) => {
  const server = createServer({ seed: 'demo', reminders: false, now: () => new Date('2026-10-19T05:00:00Z') });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, token) => {
    const res = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const owner = (await call('/api/admin/login', 'POST', { pin: '1234' })).body.token;
  const before = (await call('/api/admin/members?status=all', 'GET', null, owner)).body.length;
  const rows = [
    { memberNo: '5001', name: 'Imran Ali', phone: '03111234501', gender: 'M', joinDate: '2025-01-10', plan: 'Monthly', amount: 3000, paidOn: '2026-10-01', validTill: '2026-10-31', due: 500 },
    { memberNo: '5002', name: 'Sana Khan', phone: '03111234502', gender: 'Female', plan: '3 months', amount: 8000, paidOn: '2026-09-15' },
    { memberNo: '5003', name: 'Bilal', phone: '03111234503' },
    { memberNo: '5004', name: 'No Phone' },
    { name: 'Twice', phone: '03111234501' },
    { name: 'Bad date', phone: '03111234505', paidOn: '31/31/2026' },
  ];

  const dry = (await call('/api/admin/members/import', 'POST', { rows, dryRun: true }, owner)).body;
  assert.equal(dry.created, 3);
  assert.equal(dry.fees, 2);
  assert.equal(dry.errors.length, 2);
  assert.deepEqual(dry.errors.map((e) => e.line), [5, 7]);
  assert.equal(dry.skipped[0].line, 6);
  assert.equal((await call('/api/admin/members?status=all', 'GET', null, owner)).body.length, before, 'a check changes nothing');

  const r = (await call('/api/admin/members/import', 'POST', { rows }, owner)).body;
  assert.equal(r.created, 3);
  assert.deepEqual(r.pins.map((p) => p.memberNo), [5001, 5002, 5003]);
  assert.ok(r.pins.every((p) => /^\d{4}$/.test(p.pin)));
  const list = (await call('/api/admin/members?status=all', 'GET', null, owner)).body;
  const imran = list.find((m) => m.memberNo === 5001);
  assert.equal(imran.expiry, '2026-10-31');
  assert.equal(imran.balance, 500);
  assert.equal(imran.joinDate, '2025-01-10');
  const sana = list.find((m) => m.memberNo === 5002);
  assert.equal(sana.gender, 'female');
  assert.equal(sana.plan.months, 3);
  assert.equal(sana.expiry, '2026-12-14');
  assert.equal(list.find((m) => m.memberNo === 5003).status, 'unpaid');

  // New members added by hand continue after the imported numbers.
  const added = (await call('/api/admin/members', 'POST', { name: 'After Import', phone: '03111234599', gender: 'male', joinDate: '2026-10-19' }, owner)).body;
  assert.ok(added.member, JSON.stringify(added));
  assert.equal(added.member.memberNo, 5004);

  // The same file again: everyone is already here, no fee is added twice.
  const again = (await call('/api/admin/members/import', 'POST', { rows, existing: 'update' }, owner)).body;
  assert.equal(again.created, 0);
  assert.equal(again.updated, 3);
  const imranAgain = (await call('/api/admin/members?status=all', 'GET', null, owner)).body.find((m) => m.memberNo === 5001);
  assert.equal(imranAgain.balance, 500);

  // Staff need the right to add members.
  const u = await call('/api/admin/users', 'POST', { name: 'Viewer', pin: '4455', perms: ['members.view'] }, owner);
  assert.equal(u.status, 200, JSON.stringify(u.body));
  const viewer = (await call('/api/admin/login', 'POST', { pin: '4455' })).body.token;
  assert.equal((await call('/api/admin/members/import', 'POST', { rows: [{ name: 'X', phone: '03111234600' }] }, viewer)).status, 403);
  const desk = (await call('/api/admin/login', 'POST', { pin: '0000' })).body.token;
  assert.equal((await call('/api/admin/members/import', 'POST', { rows: [{ name: 'Desk Add', phone: '03111234601' }] }, desk)).body.created, 1);
});
