'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../lib/store');
const { createReminders, intlPhone, reminderDays } = require('../lib/reminders');
const { createServer } = require('../server');

// Monday 19 Oct 2026 in Karachi; `hour` is local time.
const at = (day, hour) => new Date(`2026-10-${day}T${String(hour - 5).padStart(2, '0')}:00:00Z`);

function gym() {
  const store = createStore({ seed: 'empty' });
  const d = store.db;
  const member = (id, name, phone, periodEnd, extra = {}) => {
    d.members.push({ id, memberNo: d.memberSeq++, name, phone, gender: 'male', joinDate: '2026-01-01', freezes: [], left: false, ...extra });
    d.payments.push({ id: `pay-${id}`, memberId: id, receiptNo: d.receiptSeq++, planId: 'plan-1m', planName: 'Monthly', periodStart: '2026-09-27', periodEnd, date: '2026-09-27', price: 5000, total: 5000, installments: [{ amount: 5000, method: 'Cash', date: '2026-09-27' }] });
  };
  member('m1', 'Ali Khan', '0300 1234567', '2026-10-26'); // ends in 7 days
  member('m2', 'Sara Malik', '+971 50 123 4567', '2026-10-20'); // ends tomorrow
  member('m3', 'Bilal Ahmed', '03211234567', '2026-11-20'); // a month away
  member('m4', 'Left Guy', '03331234567', '2026-10-26', { left: true });
  d.whatsapp = { enabled: true, phoneNumberId: '1234567890', token: 'EAAB', countryCode: '92', daysBefore: 7, every: 'day', sendAt: '10:00' };
  return store;
}

test('phone numbers become international', () => {
  assert.equal(intlPhone('0300 1234567', '92'), '923001234567');
  assert.equal(intlPhone('+971 50 123 4567', '92'), '971501234567');
  assert.equal(intlPhone('00447700900123', '92'), '447700900123');
  assert.equal(intlPhone('923001234567', '92'), '923001234567');
  assert.deepEqual(reminderDays({ daysBefore: 7, every: 'day' }), [7, 6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(reminderDays({ daysBefore: 7, every: 'some' }), [7, 3, 1, 0]);
});

test('reminders start 7 days before the end, go once a day, and wait for the send time', async () => {
  const store = gym();
  let clock = at(19, 9);
  const sent = [];
  const r = createReminders(store, { now: () => clock, send: async (msg) => { sent.push(msg); return {}; } });

  await r.tick();
  assert.equal(sent.length, 0, 'nothing before 10:00');

  clock = at(19, 11);
  await r.tick();
  assert.deepEqual(sent.map((m) => m.to).sort(), ['923001234567', '971501234567']);
  const ali = sent.find((m) => m.to === '923001234567');
  assert.deepEqual(ali.values, ['Ali', 'Iron Republic', '26 October', '7']);
  assert.equal(ali.template, 'membership_reminder');

  await r.tick();
  assert.equal(sent.length, 2, 'not twice on the same day');

  clock = at(20, 11);
  await r.tick();
  assert.equal(sent.length, 4, 'again the next day');
  assert.deepEqual(sent.slice(2).map((m) => `${m.values[0]} ${m.values[3]}`).sort(), ['Ali 6', 'Sara 0']);

  // Renewed: no more reminders for the old end date.
  store.db.payments.push({ id: 'pay-renew', memberId: 'm1', receiptNo: 99, planId: 'plan-1m', planName: 'Monthly', periodStart: '2026-10-27', periodEnd: '2026-11-26', date: '2026-10-21', price: 5000, total: 5000, installments: [{ amount: 5000, method: 'Cash', date: '2026-10-21' }] });
  clock = at(21, 11);
  await r.tick();
  assert.equal(sent.filter((m) => m.to === '923001234567').length, 2);
});

test('a failed message is logged and tried again later', async () => {
  const store = gym();
  let fail = true;
  const r = createReminders(store, { now: () => at(19, 11), send: async () => { if (fail) throw new Error('Invalid OAuth access token'); return {}; } });
  await r.tick();
  assert.equal(store.db.reminders.filter((x) => x.status === 'failed').length, 2);
  assert.match(store.db.reminders[0].error, /OAuth/);
  fail = false;
  await r.tick();
  assert.equal(store.db.reminders.filter((x) => x.status === 'sent').length, 2);
  assert.equal(store.db.reminders.length, 2, 'the failed tries are replaced');
});

test('switched off, or without a token, nothing is sent', async () => {
  const store = gym();
  store.db.whatsapp.enabled = false;
  const sent = [];
  const r = createReminders(store, { now: () => at(19, 11), send: async (m) => { sent.push(m); } });
  await r.tick();
  assert.equal(sent.length, 0);
});

test('the owner sets up reminders; the token never comes back', async (t) => {
  const server = createServer({ seed: 'demo', reminders: false, now: () => at(19, 11) });
  await new Promise((res) => server.listen(0, res));
  t.after(() => new Promise((res) => server.close(res)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, token) => {
    const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const owner = (await call('/api/admin/login', 'POST', { pin: '1234' })).body.token;
  const desk = (await call('/api/admin/login', 'POST', { pin: '0000' })).body.token;
  const settings = { enabled: true, phoneNumberId: '123 456', token: 'EAAsecret', templateName: 'Membership Reminder', templateLang: 'ur', countryCode: '+92', daysBefore: 7, every: 'day', sendAt: '10:00' };
  assert.equal((await call('/api/admin/whatsapp', 'PUT', settings, desk)).status, 403);
  assert.equal((await call('/api/admin/whatsapp', 'PUT', { ...settings, token: '', phoneNumberId: '' }, owner)).status, 400);
  assert.equal((await call('/api/admin/whatsapp', 'PUT', settings, owner)).status, 200);
  await call('/api/admin/whatsapp', 'PUT', { ...settings, token: '' }, owner);
  const got = (await call('/api/admin/whatsapp', 'GET', null, owner)).body;
  assert.equal(got.settings.token, undefined);
  assert.equal(got.settings.hasToken, true);
  assert.equal(got.settings.phoneNumberId, '123456');
  assert.equal(got.settings.templateName, 'membership_reminder');
  assert.equal(got.settings.countryCode, '92');
  assert.ok(got.templates.ur.includes('{{1}}'));
  const list = (await call('/api/admin/reminders', 'GET', null, desk)).body;
  assert.equal(list.enabled, true);
  assert.ok(Array.isArray(list.due));
});
