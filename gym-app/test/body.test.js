'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Nutrition = require('../public/nutrition');
const { createServer } = require('../server');

test('outlook: calories, protein and weight change for each goal', () => {
  const o = Nutrition.outlook({ weight: 80, height: 175, age: 30, gender: 'male', diet: 'nonveg' }, 3);
  assert.equal(o.bmi.value, 26.1);
  const [lose, fit, gain] = o.goals;
  assert.deepEqual(o.goals.map((g) => g.id), ['lose', 'fit', 'gain']);
  assert.equal(fit.eat, o.burn);
  assert.ok(lose.eat < fit.eat && gain.eat > fit.eat);
  assert.ok(lose.perWeek < 0 && gain.perWeek > 0 && fit.perWeek === 0);
  // 450 kcal less a day is about 0.4 kg a week.
  assert.equal(lose.perWeek, -0.4);
  assert.ok(lose.threeMonths < lose.month && lose.month < 0);
  assert.ok(lose.protein >= fit.protein);
  // Too thin to diet: the "lose" plan doesn't cut calories.
  const thin = Nutrition.outlook({ weight: 48, height: 175, age: 25, gender: 'male' }, 3).goals[0];
  assert.equal(thin.goal, 'fit');
  assert.ok(thin.changed);
});

test('the desk sets weight, height and goal, when adding a member and later', async (t) => {
  const server = createServer({ seed: 'demo', reminders: false });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, token) => {
    const res = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const owner = (await call('/api/admin/login', 'POST', { pin: '1234' })).body.token;
  const added = await call('/api/admin/members', 'POST', { name: 'Body Test', gender: 'female', joinDate: '2026-11-11', body: { weight: 72, height: 160, age: 28, goal: 'lose', days: 4, diet: 'egg' } }, owner);
  assert.equal(added.status, 200, JSON.stringify(added.body));
  const m = added.body.member;
  assert.equal(m.body.weight, 72);
  assert.equal(m.body.gender, 'female');
  assert.equal(m.body.updatedBy, 'staff');
  assert.equal(m.weighIns.length, 1);

  const bad = await call('/api/admin/members', 'POST', { name: 'No Age', gender: 'male', joinDate: '2026-11-11', body: { weight: 70, height: 170 } }, owner);
  assert.equal(bad.status, 400);

  const up = await call(`/api/admin/members/${m.id}/body`, 'PUT', { weight: 70, height: 160, age: 28, goal: 'fit', days: 4 }, owner);
  assert.equal(up.status, 200);
  assert.equal(up.body.body.goal, 'fit');
  assert.equal(up.body.weighIns.slice(-1)[0].kg, 70);
  // The member's app reads the same body.
  const detail = (await call(`/api/admin/members/${m.id}`, 'GET', null, owner)).body;
  assert.equal(detail.member.body.weight, 70);

  // Viewing members isn't enough to change it.
  await call('/api/admin/users', 'POST', { name: 'Viewer', pin: '4466', perms: ['members.view'] }, owner);
  const viewer = (await call('/api/admin/login', 'POST', { pin: '4466' })).body.token;
  assert.equal((await call(`/api/admin/members/${m.id}/body`, 'PUT', { weight: 60, height: 160, age: 28 }, viewer)).status, 403);
});
