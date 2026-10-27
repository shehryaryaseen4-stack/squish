'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../public/foods');
const { createServer } = require('../server');

test('food search finds English and Urdu names', () => {
  assert.ok(F.LIST.length >= 120);
  for (const f of F.LIST) for (const k of ['kcal', 'protein', 'carbs', 'fat']) assert.equal(typeof f[k], 'number', `${f.id} ${k}`);
  assert.equal(new Set(F.LIST.map((f) => f.id)).size, F.LIST.length);
  assert.equal(F.search('kela')[0].id, 'banana');
  assert.equal(F.search('murgi karahi')[0].id, 'chicken-karahi');
  assert.ok(F.search('anda').some((f) => f.id === 'egg-boiled'));
  assert.equal(F.search('Roti')[0].id, 'roti');
  assert.deepEqual(F.search('xyzzy'), []);
  // The member's own foods come first.
  assert.equal(F.search('roti', [{ id: 'own-1', name: 'Roti with ghee', alt: '', portion: '1', kcal: 200, protein: 3, carbs: 18, fat: 12, own: true }])[0].id, 'own-1');
  assert.deepEqual(F.totals([{ kcal: 120, protein: 3, carbs: 18, fat: 3.7, qty: 2 }, { kcal: 78, protein: 6.3, carbs: 0.6, fat: 5.3, qty: 1 }]), { kcal: 318, protein: 12, carbs: 37, fat: 13 });
});

test('members keep a list of what they ate, and their own foods', async (t) => {
  const server = createServer({ seed: 'demo', reminders: false, now: () => new Date('2026-10-19T05:00:00Z') });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, token) => {
    const res = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const token = (await call('/api/member/login', 'POST', { id: '1001', pin: '1111' })).body.token;
  const roti = F.byId.roti;
  const saved = (await call('/api/member/food-log', 'PUT', { date: '2026-10-19', items: [{ ...roti, qty: 2, meal: 'lunch' }, { ...F.byId['egg-boiled'], qty: 1, meal: 'nope' }] }, token)).body;
  assert.equal(saved.length, 2);
  assert.equal(saved[0].qty, 2);
  assert.equal(saved[1].meal, 'snack');
  const me = (await call('/api/member/me', 'GET', null, token)).body.member;
  assert.equal(me.foodLog['2026-10-19'].length, 2);
  assert.equal((await call('/api/member/food-log', 'PUT', { date: '2026-10-19', items: [{ name: '', kcal: 1 }] }, token)).status, 400);
  assert.equal((await call('/api/member/food-log', 'PUT', { date: '2026-10-19', items: [{ name: 'x', kcal: 99999 }] }, token)).status, 400);
  // Clearing the day removes it.
  await call('/api/member/food-log', 'PUT', { date: '2026-10-19', items: [] }, token);
  assert.equal((await call('/api/member/me', 'GET', null, token)).body.member.foodLog['2026-10-19'], undefined);

  const own = (await call('/api/member/custom-foods', 'PUT', { foods: [{ id: 'own-abc', name: 'Mama’s qeema', portion: '1 bowl', kcal: 420, protein: 30 }] }, token)).body;
  assert.equal(own[0].id, 'own-abc');
  assert.equal(own[0].own, true);
  assert.equal((await call('/api/member/custom-foods', 'PUT', { foods: [{ name: 'x' }] })).status, 401);
});
