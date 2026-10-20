'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

// Monday 19 Oct 2026, 10:00 in Karachi. The salon opens at 11:00.
const NOW = new Date('2026-10-19T05:00:00Z');
const MONDAY = '2026-10-19';
const TUESDAY = '2026-10-20';

async function start(seed = 'salon') {
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
  return { server, call, close: () => new Promise((r) => server.close(r)) };
}

const customer = { name: 'Ahmed Khan', phone: '03001234567' };

test('customer books a slot, it disappears, and a second booking is refused', async (t) => {
  const app = await start();
  t.after(app.close);
  const before = await app.call(`/api/availability?serviceId=s-haircut&staffId=st-ali&date=${MONDAY}`);
  assert.equal(before.status, 200);
  assert.equal(before.body.slots[0].time, '11:00');

  const booked = await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-haircut', staffId: 'st-ali', date: MONDAY, time: '11:00', ...customer } });
  assert.equal(booked.status, 200);
  assert.match(booked.body.code, /^[A-Z2-9]{6}$/);
  assert.equal(booked.body.end, '11:45');
  assert.ok(booked.body.token);

  const after = await app.call(`/api/availability?serviceId=s-haircut&staffId=st-ali&date=${MONDAY}`);
  assert.ok(!after.body.slots.some((s) => ['11:00', '11:15', '11:30'].includes(s.time)));

  const clash = await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-haircut', staffId: 'st-ali', date: MONDAY, time: '11:30', ...customer } });
  assert.equal(clash.status, 409);
});

test('"any professional" is assigned to someone actually free', async (t) => {
  const app = await start();
  t.after(app.close);
  const a = await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-beard', staffId: 'any', date: MONDAY, time: '12:00', ...customer } });
  const b = await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-beard', staffId: 'any', date: MONDAY, time: '12:00', ...customer } });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.notEqual(a.body.staffId, b.body.staffId);
  const c = await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-beard', staffId: 'any', date: MONDAY, time: '12:00', ...customer } });
  assert.equal(c.status, 409);
});

test('bad input is rejected with a readable message', async (t) => {
  const app = await start();
  t.after(app.close);
  const r = await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-haircut', date: MONDAY, time: '11:00', name: 'X', phone: '12' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'Enter a valid phone number');
  const tooSoon = await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-haircut', date: MONDAY, time: '10:30', ...customer } });
  assert.equal(tooSoon.status, 409);
});

test('customers see and cancel only with their token, and lookup needs code plus phone', async (t) => {
  const app = await start();
  t.after(app.close);
  const { body: b } = await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-haircut', date: TUESDAY, time: '15:00', ...customer } });
  assert.equal((await app.call(`/api/bookings/${b.id}?token=wrong`)).status, 404);
  const seen = await app.call(`/api/bookings/${b.id}?token=${b.token}`);
  assert.equal(seen.body.code, b.code);
  assert.equal(seen.body.token, undefined);

  assert.equal((await app.call('/api/bookings/lookup', { method: 'POST', body: { code: b.code, phone: '03009999999' } })).status, 404);
  const found = await app.call('/api/bookings/lookup', { method: 'POST', body: { code: b.code.toLowerCase(), phone: customer.phone } });
  assert.equal(found.body.token, b.token);

  const cancelled = await app.call(`/api/bookings/${b.id}/cancel`, { method: 'POST', body: { token: b.token } });
  assert.equal(cancelled.body.status, 'cancelled');
  assert.equal((await app.call(`/api/bookings/${b.id}/cancel`, { method: 'POST', body: { token: b.token } })).status, 409);
});

test('online cancellation closes inside the notice window', async (t) => {
  const app = await start();
  t.after(app.close);
  const { body: b } = await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-beard', staffId: 'st-ali', date: MONDAY, time: '11:00', ...customer } });
  const r = await app.call(`/api/bookings/${b.id}/cancel`, { method: 'POST', body: { token: b.token } });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /2 hours/);
});

test('gym classes fill up and refuse duplicates', async (t) => {
  const app = await start('gym');
  t.after(app.close);
  const classes = await app.call(`/api/classes?date=${MONDAY}`);
  const yoga = classes.body.find((c) => c.id === 'c-yoga-mon');
  assert.equal(yoga.spotsLeft, 14);
  assert.equal(classes.body.find((c) => c.id === 'c-hiit-mon').started, true);

  const ok = await app.call('/api/bookings', { method: 'POST', body: { type: 'class', classId: 'c-yoga-mon', date: MONDAY, ...customer } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.staffName, 'Bilal Shah');
  const dup = await app.call('/api/bookings', { method: 'POST', body: { type: 'class', classId: 'c-yoga-mon', date: MONDAY, ...customer } });
  assert.equal(dup.status, 409);
  const started = await app.call('/api/bookings', { method: 'POST', body: { type: 'class', classId: 'c-hiit-mon', date: MONDAY, ...customer } });
  assert.equal(started.status, 409);
});

test('admin routes need a PIN session', async (t) => {
  const app = await start();
  t.after(app.close);
  assert.equal((await app.call('/api/admin/data')).status, 401);
  assert.equal((await app.call('/api/admin/login', { method: 'POST', body: { pin: '0000' } })).status, 401);
  const { body } = await app.call('/api/admin/login', { method: 'POST', body: { pin: '1234' } });
  assert.equal((await app.call('/api/admin/data', { token: body.token })).status, 200);
  await app.call('/api/admin/logout', { method: 'POST', token: body.token });
  assert.equal((await app.call('/api/admin/data', { token: body.token })).status, 401);
});

test('admin walk-in, reschedule, restore guard, overview and catalogue edits', async (t) => {
  const app = await start();
  t.after(app.close);
  const { body: { token } } = await app.call('/api/admin/login', { method: 'POST', body: { pin: '1234' } });

  // Staff book walk-ins and phone bookings from the dashboard.
  const walkIn = await app.call('/api/admin/bookings', { method: 'POST', token, body: { type: 'service', serviceId: 's-beard', staffId: 'st-hamza', date: MONDAY, time: '11:00', ...customer } });
  assert.equal(walkIn.status, 200);
  assert.equal(walkIn.body.source, 'staff');

  const moved = await app.call(`/api/admin/bookings/${walkIn.body.id}`, { method: 'PATCH', token, body: { date: TUESDAY, time: '17:00', staffId: 'st-hamza' } });
  assert.equal(moved.body.start, '17:00');
  assert.equal(moved.body.date, TUESDAY);
  const offDay = await app.call(`/api/admin/bookings/${walkIn.body.id}`, { method: 'PATCH', token, body: { staffId: 'st-ali' } });
  assert.equal(offDay.status, 409);

  await app.call(`/api/admin/bookings/${walkIn.body.id}`, { method: 'PATCH', token, body: { status: 'cancelled' } });
  await app.call('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: 's-beard', staffId: 'st-hamza', date: TUESDAY, time: '17:00', ...customer } });
  const restore = await app.call(`/api/admin/bookings/${walkIn.body.id}`, { method: 'PATCH', token, body: { status: 'confirmed' } });
  assert.equal(restore.status, 409);

  const overview = await app.call(`/api/admin/overview?date=${MONDAY}`, { token });
  assert.equal(overview.body.week.length, 7);
  assert.equal(overview.body.week[1].count, 1);

  const svc = await app.call('/api/admin/services', { method: 'POST', token, body: { name: 'Hair Spa', categoryId: 'hair', duration: 50, price: 3000, staffIds: ['st-sara'] } });
  assert.equal(svc.status, 200);
  const pub = await app.call('/api/business');
  assert.ok(pub.body.services.some((s) => s.name === 'Hair Spa'));
  assert.equal(pub.body.business.admin, undefined);
  assert.equal(JSON.stringify(pub.body).includes('pin'), false);

  assert.equal((await app.call('/api/admin/categories/hair', { method: 'DELETE', token })).status, 409);
  const bad = await app.call('/api/admin/services', { method: 'POST', token, body: { name: '', categoryId: 'hair', duration: 30, price: 10 } });
  assert.equal(bad.status, 400);
});

test('native app origins get CORS, others do not', async (t) => {
  const app = await start();
  t.after(app.close);
  const native = await app.call('/api/business', { headers: { Origin: 'capacitor://localhost' } });
  assert.equal(native.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  const other = await app.call('/api/business', { headers: { Origin: 'https://evil.example' } });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
});

test('static files are served and path traversal is blocked', async (t) => {
  const app = await start();
  t.after(app.close);
  const port = app.server.address().port;
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/admin`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/..%2fserver.js`)).status, 404);
  const manifest = await (await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`)).json();
  assert.equal(manifest.name, 'Luxe Studio');
});
