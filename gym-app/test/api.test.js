'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

// Monday 19 Oct 2026, 10:00 in Karachi.
const NOW = new Date('2026-10-19T05:00:00Z');
const TODAY = '2026-10-19';

async function start(seed = 'empty') {
  const server = createServer({ seed, now: () => NOW });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  const login = async (pin) => (await call('/api/admin/login', { method: 'POST', body: { pin } })).body.token;
  return { server, call, login, close: () => new Promise((r) => server.close(r)) };
}

const newMember = (extra = {}) => ({ name: 'Ahmed Khan', phone: '0300 1234567', gender: 'male', joinDate: TODAY, ...extra });

test('owner adds a member with a first fee, and the summary adds up', async (t) => {
  const app = await start();
  t.after(app.close);
  const token = await app.login('1234');
  const r = await app.call('/api/admin/members', { method: 'POST', token, body: { ...newMember(), payment: { planId: 'plan-3m', periodStart: TODAY, date: TODAY, admissionFee: 2000, discount: 500, paid: 10000, method: 'Cash' } } });
  assert.equal(r.status, 200);
  assert.equal(r.body.member.memberNo, 1001);
  assert.match(r.body.pin, /^\d{4}$/);
  assert.equal(r.body.member.pin, undefined);
  assert.equal(r.body.payment.periodEnd, '2027-01-18');
  assert.equal(r.body.payment.total, 13500 - 500 + 2000);

  const detail = await app.call(`/api/admin/members/${r.body.member.id}`, { token });
  assert.equal(detail.body.summary.status, 'active');
  assert.equal(detail.body.summary.balance, 5000);
  assert.equal(detail.body.suggestedStart, '2027-01-19');

  const pay = detail.body.payments[0];
  assert.equal((await app.call(`/api/admin/payments/${pay.id}/installments`, { method: 'POST', token, body: { amount: 6000 } })).status, 400);
  await app.call(`/api/admin/payments/${pay.id}/installments`, { method: 'POST', token, body: { amount: 5000, method: 'JazzCash' } });
  const after = await app.call(`/api/admin/members/${r.body.member.id}`, { token });
  assert.equal(after.body.summary.balance, 0);

  const dup = await app.call('/api/admin/members', { method: 'POST', token, body: newMember({ name: 'Someone' }) });
  assert.equal(dup.status, 409);
});

test('check in and out toggles, and expired members can be blocked', async (t) => {
  const app = await start();
  t.after(app.close);
  const token = await app.login('1234');
  const { body } = await app.call('/api/admin/members', { method: 'POST', token, body: newMember({ joinDate: '2026-08-01' }) });
  const inRes = await app.call('/api/admin/checkin', { method: 'POST', token, body: { memberNo: '1001' } });
  assert.equal(inRes.body.action, 'in');
  assert.equal(inRes.body.visit.in, '10:00');
  assert.equal(inRes.body.warning, true);
  const out = await app.call('/api/admin/checkin', { method: 'POST', token, body: { memberId: body.member.id } });
  assert.equal(out.body.action, 'out');

  const gym = (await app.call('/api/admin/data', { token })).body.business;
  await app.call('/api/admin/business', { method: 'PUT', token, body: { ...gym, blockExpiredCheckin: true } });
  const blocked = await app.call('/api/admin/checkin', { method: 'POST', token, body: { memberNo: 1001 } });
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /not paid/);
  const forced = await app.call('/api/admin/checkin', { method: 'POST', token, body: { memberNo: 1001, force: true } });
  assert.equal(forced.body.action, 'in');

  const att = await app.call(`/api/admin/attendance?date=${TODAY}`, { token });
  assert.equal(att.body.list.length, 2);
  assert.equal(att.body.hours[10].count, 2);
});

test('front desk PIN cannot see money or change settings', async (t) => {
  const app = await start();
  t.after(app.close);
  const staff = await app.login('0000');
  const owner = await app.login('1234');
  assert.equal((await app.call('/api/admin/login', { method: 'POST', body: { pin: '9999' } })).status, 401);
  const dash = await app.call('/api/admin/dashboard', { token: staff });
  assert.equal(dash.status, 200);
  assert.equal(dash.body.money, undefined);
  assert.ok((await app.call('/api/admin/dashboard', { token: owner })).body.money);
  assert.equal((await app.call(`/api/admin/report?month=2026-10`, { token: staff })).status, 403);
  assert.equal((await app.call('/api/admin/expenses', { method: 'POST', token: staff, body: { date: TODAY, category: 'Rent', amount: 100 } })).status, 403);
  const data = await app.call('/api/admin/data', { token: staff });
  assert.equal(data.body.role, 'staff');
  assert.ok(data.body.staff.every((s) => s.salary === undefined));
  // Front desk can still run the floor.
  assert.equal((await app.call('/api/admin/members', { method: 'POST', token: staff, body: newMember() })).status, 200);
});

test('freeze extends the expiry and shows in the member detail', async (t) => {
  const app = await start();
  t.after(app.close);
  const token = await app.login('1234');
  const { body } = await app.call('/api/admin/members', { method: 'POST', token, body: { ...newMember(), payment: { planId: 'plan-1m', periodStart: TODAY, date: TODAY, paid: 5000 } } });
  const frozen = await app.call(`/api/admin/members/${body.member.id}/freeze`, { method: 'POST', token, body: { from: '2026-10-25', to: '2026-10-31', reason: 'Travel' } });
  assert.equal(frozen.body.summary.expiry, '2026-11-25');
  const overlap = await app.call(`/api/admin/members/${body.member.id}/freeze`, { method: 'POST', token, body: { from: '2026-10-30', to: '2026-11-02' } });
  assert.equal(overlap.status, 400);
  const unfrozen = await app.call(`/api/admin/members/${body.member.id}/freeze/0`, { method: 'DELETE', token });
  assert.equal(unfrozen.body.summary.expiry, '2026-11-18');
});

test('member app: login with number and PIN, see own data, book a class', async (t) => {
  const app = await start();
  t.after(app.close);
  const token = await app.login('1234');
  const { body } = await app.call('/api/admin/members', { method: 'POST', token, body: { ...newMember(), payment: { planId: 'plan-1m', periodStart: TODAY, date: TODAY, paid: 5000 } } });
  assert.equal((await app.call('/api/member/login', { method: 'POST', body: { id: '1001', pin: '0000' === body.pin ? '1111' : '0000' } })).status, 401);
  const viaPhone = await app.call('/api/member/login', { method: 'POST', body: { id: '+92 300 1234567', pin: body.pin } });
  assert.equal(viaPhone.status, 200);
  const mt = viaPhone.body.token;
  const me = await app.call('/api/member/me', { token: mt });
  assert.equal(me.body.member.name, 'Ahmed Khan');
  assert.equal(me.body.member.pin, undefined);
  assert.equal(me.body.summary.status, 'active');

  const booked = await app.call('/api/member/classes', { method: 'POST', token: mt, body: { classId: 'c-yoga-mon', date: TODAY } });
  assert.equal(booked.status, 200);
  assert.equal((await app.call('/api/member/classes', { method: 'POST', token: mt, body: { classId: 'c-yoga-mon', date: TODAY } })).status, 409);
  const day = await app.call(`/api/admin/class-day?date=${TODAY}`, { token });
  assert.equal(day.body.find((c) => c.id === 'c-yoga-mon').attendees[0].name, 'Ahmed Khan');

  // Resetting the PIN signs the member out everywhere.
  await app.call(`/api/admin/members/${body.member.id}/pin`, { method: 'POST', token });
  assert.equal((await app.call('/api/member/me', { token: mt })).status, 401);
  assert.equal((await app.call('/api/admin/data', { token: mt })).status, 401);
});

test('expired members cannot book classes from the app', async (t) => {
  const app = await start();
  t.after(app.close);
  const token = await app.login('1234');
  const { body } = await app.call('/api/admin/members', { method: 'POST', token, body: { ...newMember({ joinDate: '2026-08-01' }), payment: { planId: 'plan-1m', periodStart: '2026-08-01', date: '2026-08-01', paid: 5000 } } });
  const mt = (await app.call('/api/member/login', { method: 'POST', body: { id: 1001, pin: body.pin } })).body.token;
  const r = await app.call('/api/member/classes', { method: 'POST', token: mt, body: { classId: 'c-yoga-mon', date: TODAY } });
  assert.equal(r.status, 409);
});

test('reports count money by the day it was received', async (t) => {
  const app = await start();
  t.after(app.close);
  const token = await app.login('1234');
  const { body } = await app.call('/api/admin/members', { method: 'POST', token, body: { ...newMember({ joinDate: '2026-10-01' }), payment: { planId: 'plan-1m', periodStart: '2026-10-01', date: '2026-10-01', paid: 3000, method: 'Cash', admissionFee: 2000 } } });
  const [pay] = (await app.call(`/api/admin/members/${body.member.id}`, { token })).body.payments;
  await app.call(`/api/admin/payments/${pay.id}/installments`, { method: 'POST', token, body: { amount: 4000, method: 'EasyPaisa', date: '2026-10-15' } });
  await app.call('/api/admin/expenses', { method: 'POST', token, body: { date: '2026-10-05', category: 'Rent', amount: 1500 } });
  const r = await app.call('/api/admin/report?month=2026-10', { token });
  assert.equal(r.body.revenue, 7000);
  assert.equal(r.body.expenses, 1500);
  assert.deepEqual(r.body.byMethod, [{ name: 'EasyPaisa', amount: 4000 }, { name: 'Cash', amount: 3000 }]);
  assert.equal(r.body.newMembers, 1);
  assert.equal(r.body.admissionFees, 2000);
  assert.equal(r.body.daily.length, 31);
});

test('public endpoints and enquiries', async (t) => {
  const app = await start();
  t.after(app.close);
  const gym = await app.call('/api/gym');
  assert.equal(gym.body.business.name, 'Iron Republic');
  assert.equal(gym.body.plans.length, 4);
  assert.equal(JSON.stringify(gym.body).includes('salary'), false);
  assert.equal(JSON.stringify(gym.body).includes('Pin'), false);
  assert.equal((await app.call('/api/leads', { method: 'POST', body: { name: 'Sara', phone: '03001112222', interest: 'Monthly' } })).status, 200);
  const token = await app.login('0000');
  assert.equal((await app.call('/api/admin/leads', { token })).body[0].name, 'Sara');
});

test('owner can wipe demo data but keeps the settings', async (t) => {
  const app = await start('demo');
  t.after(app.close);
  const token = await app.login('1234');
  const dash = await app.call('/api/admin/dashboard', { token });
  assert.equal(dash.body.demo, true);
  assert.ok(dash.body.counts.members > 40);
  assert.equal(dash.body.money.months.length, 6);
  assert.equal((await app.call('/api/admin/clear-data', { method: 'POST', token, body: { confirm: 'no' } })).status, 400);
  await app.call('/api/admin/clear-data', { method: 'POST', token, body: { confirm: 'DELETE' } });
  const after = await app.call('/api/admin/dashboard', { token });
  assert.equal(after.body.counts.members, 0);
  assert.equal(after.body.demo, false);
  assert.equal((await app.call('/api/gym')).body.plans.length, 4);
});

test('native app origins get CORS, others do not; static files are safe', async (t) => {
  const app = await start();
  t.after(app.close);
  const native = await app.call('/api/gym', { headers: { Origin: 'capacitor://localhost' } });
  assert.equal(native.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  const other = await app.call('/api/gym', { headers: { Origin: 'https://evil.example' } });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  const port = app.server.address().port;
  assert.equal((await fetch(`http://127.0.0.1:${port}/..%2fserver.js`)).status, 404);
  const manifest = await (await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`)).json();
  assert.equal(manifest.name, 'Iron Republic');
});

test('members save a weekly workout plan and tick off exercises; trainers can set it too', async (t) => {
  const app = await start();
  t.after(app.close);
  const token = await app.login('1234');
  const { body } = await app.call('/api/admin/members', { method: 'POST', token, body: { ...newMember(), payment: { planId: 'plan-1m', periodStart: TODAY, date: TODAY, paid: 5000 } } });
  const mt = (await app.call('/api/member/login', { method: 'POST', body: { id: 1001, pin: body.pin } })).body.token;
  const plan = { days: { mon: { groups: ['chest', 'biceps'], exercises: [{ id: 'barbell-bench-press-medium-grip', sets: 4, reps: '8-10' }, { id: 'barbell-curl' }] }, tue: { groups: [], exercises: [] } } };
  const saved = await app.call('/api/member/plan', { method: 'PUT', token: mt, body: plan });
  assert.equal(saved.status, 200);
  assert.deepEqual(Object.keys(saved.body.days), ['mon']);
  assert.equal(saved.body.days.mon.exercises[1].sets, 3);
  assert.equal((await app.call('/api/member/plan', { method: 'PUT', token: mt, body: { days: { mon: { exercises: [{ id: '../x' }] } } } })).status, 400);
  await app.call('/api/member/workout-log', { method: 'PUT', token: mt, body: { date: TODAY, done: ['barbell-curl'] } });
  const me = await app.call('/api/member/me', { token: mt });
  assert.deepEqual(me.body.member.workoutLog[TODAY], ['barbell-curl']);
  assert.equal(me.body.member.workoutPlan.updatedBy, 'member');
  await app.call(`/api/admin/members/${body.member.id}/plan`, { method: 'PUT', token, body: { days: { wed: { groups: ['legs'], exercises: [{ id: 'barbell-squat' }] } } } });
  const detail = await app.call(`/api/admin/members/${body.member.id}`, { token });
  assert.deepEqual(Object.keys(detail.body.member.workoutPlan.days), ['wed']);
  assert.equal(detail.body.member.workoutPlan.updatedBy, 'trainer');
});
