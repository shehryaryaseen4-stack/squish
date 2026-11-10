'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

test('opening hours: closing at midnight (12:00 AM) is allowed; a clear message otherwise', async (t) => {
  const server = createServer({ seed: 'demo', reminders: false });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, token) => {
    const res = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const owner = (await call('/api/admin/login', 'POST', { pin: '1234' })).body.token;
  const b = (await call('/api/gym')).body.business;
  const ok = await call('/api/admin/business', 'PUT', { ...b, hours: { ...b.hours, fri: [['06:00', '12:30'], ['14:30', '00:00']] } }, owner);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual((await call('/api/gym')).body.business.hours.fri, [['06:00', '12:30'], ['14:30', '23:59']]);
  const bad = await call('/api/admin/business', 'PUT', { ...b, hours: { ...b.hours, fri: [['14:30', '12:00']] } }, owner);
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /^Friday: closing time must be after opening time/);
});
