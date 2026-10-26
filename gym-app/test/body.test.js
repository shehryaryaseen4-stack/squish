'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../public/body');
const { createServer } = require('../server');

const man = { weight: 96, height: 172, age: 29, gender: 'male', experience: 'new', shape: 'belly', target: 'athletic' };

test('pictures for every look, for men and women', () => {
  for (const sex of ['male', 'female']) {
    for (const x of [...B.NOW[sex], ...B.WANT[sex]]) {
      const svg = B.figure(sex, x.fat, x.muscle, { label: x.label });
      assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
      assert.ok(!/NaN|undefined/.test(svg), `${sex} ${x.id}`);
    }
  }
  // A photo replaces the drawing once the gym adds one.
  B.setPhotos({ 'male-now-belly': '/photos/body-male-now-belly.jpg' });
  assert.match(B.picture('male', 'now', B.NOW.male[3]), /<img class="body-photo" src="\/photos\/body-male-now-belly.jpg"/);
  assert.match(B.picture('male', 'now', B.NOW.male[0]), /<svg/);
  B.setPhotos({ 'male-now-belly': null });
});

test('the journey: lose fat first, then build, with a realistic time', () => {
  const j = B.journey(man);
  assert.deepEqual(j.phases.map((p) => p.goal), ['lose', 'gain']);
  assert.ok(j.bodyFat >= 24 && j.bodyFat <= 32, `body fat ${j.bodyFat}`);
  assert.ok(j.months >= 7 && j.months <= 14, `${j.months} months`);
  assert.ok(j.weightEnd < 96);
  // A thin man who wants muscle only builds.
  const thin = B.journey({ ...man, weight: 58, height: 175, shape: 'skinny', target: 'muscular' });
  assert.deepEqual(thin.phases.map((p) => p.goal), ['gain']);
  assert.ok(thin.weightEnd > 58);
  // Bodybuilder from heavy is a long road: lose, build, then get defined.
  const big = B.journey({ ...man, weight: 110, height: 170, shape: 'heavy', target: 'bodybuilder' });
  assert.equal(big.phases.length, 3);
  assert.ok(big.months > 18);
  // Women build muscle about half as fast.
  const her = B.journey({ ...man, gender: 'female', weight: 50, height: 160, shape: 'slim', target: 'athletic' });
  const him = B.journey({ ...man, weight: 62, height: 175, shape: 'slim', target: 'athletic' });
  assert.ok(her.weeks > him.weeks);
  // Close to the goal already: tone up for 12 weeks.
  const close = B.journey({ ...man, weight: 70, height: 178, shape: 'slim', target: 'slim' });
  assert.deepEqual(close.phases.map((p) => p.goal), ['fit']);
});

test('where the member is today, by weeks and by weight', () => {
  const b = { ...man, startWeight: 96, journeyStart: '2026-08-01' };
  const c = B.current(b, '2026-10-26', [{ d: '2026-10-20', kg: 90 }]);
  assert.equal(c.goal, 'lose');
  assert.equal(c.week, 13);
  assert.ok(c.progress > 0.3 && c.progress < 0.6);
  // Reached the fat-loss weight early: on to building.
  const early = B.current(b, '2026-10-26', [{ d: '2026-10-20', kg: c.phases[0].to - 0.5 }]);
  assert.equal(early.goal, 'gain');
});

test('the server keeps the journey start and its weight; gyms upload photos', async (t) => {
  const server = createServer({ seed: 'demo', reminders: false, now: () => new Date('2026-10-19T05:00:00Z') });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, token) => {
    const res = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const token = (await call('/api/member/login', 'POST', { id: '1001', pin: '1111' })).body.token;
  const saved = (await call('/api/member/body', 'PUT', { ...man, days: 3, minutes: 60, diet: 'nonveg', goal: 'lose' }, token)).body;
  assert.equal(saved.shape, 'belly');
  assert.equal(saved.target, 'athletic');
  assert.equal(saved.journeyStart, '2026-10-19');
  assert.equal(saved.startWeight, 96);
  await call('/api/member/weigh-in', 'POST', { kg: 94 }, token);
  // Changing the days keeps the journey; changing the goal body restarts it.
  const same = (await call('/api/member/body', 'PUT', { ...man, weight: 94, days: 4 }, token)).body;
  assert.equal(same.startWeight, 96);
  const fresh = (await call('/api/member/body', 'PUT', { ...man, weight: 94, target: 'muscular' }, token)).body;
  assert.equal(fresh.startWeight, 94);
  assert.equal((await call('/api/member/body', 'PUT', { ...man, target: 'wizard' }, token)).body.target, null);

  const owner = (await call('/api/admin/login', 'POST', { pin: '1234' })).body.token;
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');
  const up = await call('/api/admin/body-photos/male-now-belly', 'PUT', { image: jpeg }, owner);
  assert.equal(up.status, 200);
  assert.ok((await call('/api/gym')).body.bodyPhotos['male-now-belly']);
  assert.equal((await call('/api/admin/body-photos/robot-now-belly', 'PUT', { image: jpeg }, owner)).status, 404);
  const desk = (await call('/api/admin/login', 'POST', { pin: '0000' })).body.token;
  assert.equal((await call('/api/admin/body-photos/male-now-slim', 'PUT', { image: jpeg }, desk)).status, 403);
  await call('/api/admin/body-photos/male-now-belly', 'DELETE', null, owner);
  assert.deepEqual((await call('/api/gym')).body.bodyPhotos, {});
});
