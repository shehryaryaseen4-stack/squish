'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/supplements');
const N = require('../public/nutrition');

test('every supplement has the full details', () => {
  for (const x of S.LIST) {
    for (const k of ['name', 'kind', 'when', 'what', 'dose', 'timing', 'evidenceText', 'skip', 'results']) assert.ok(x[k], `${x.id} ${k}`);
    assert.ok(x.benefits.length && x.risks.length, x.id);
    assert.ok(['strong', 'some', 'weak', 'none'].includes(x.evidence), x.id);
    for (const k of ['protein', 'kcal', 'carbs', 'fat']) assert.equal(typeof x.serving[k], 'number', `${x.id} ${k}`);
  }
  assert.equal(S.byId.whey.serving.protein, 24);
});

test('advice fits the member: scoops from the protein gap, no gainer when heavy', () => {
  const heavy = { weight: 92, height: 173, age: 28, gender: 'male', goal: 'lose', experience: 'new', diet: 'nonveg' };
  const g = S.forMember(heavy, N.plan(heavy, 3, 0, { asian: true }));
  assert.equal(g.advice.gainer.fit, 'no');
  assert.equal(g.advice.fatburner.fit, 'no');
  assert.equal(g.advice.creatine.fit, 'yes');
  assert.match(g.advice.creatine.text, /^5 g/);
  assert.ok(g.expect.fatPerMonth > 1 && g.expect.fatPerMonth < 4, `${g.expect.fatPerMonth} kg a month`);

  // A thin vegetarian: a gainer is an option; their meal plan already covers protein, so no scoops.
  const thin = { weight: 52, height: 178, age: 22, gender: 'male', goal: 'gain', experience: 'new', diet: 'veg' };
  const t = S.forMember(thin, N.plan(thin, 3));
  assert.equal(t.advice.gainer.fit, 'maybe');
  assert.equal(t.expect.scoops, 0);
  assert.equal(t.expect.fatPerMonth, 0);
  // Short of protein by 40 g: two scoops (whey already in the plan doesn't count as food).
  const short = S.forMember({ ...thin, weight: 80 }, { protein: 140, totals: { protein: 124 }, meals: [{ items: [{ key: 'whey', protein: 24 }] }], maintain: 2500, target: 2800, goal: 'gain' });
  assert.equal(short.expect.food, 100);
  assert.equal(short.expect.scoops, 2);
  assert.equal(short.advice.plant.fit, 'yes');
  assert.match(short.advice.whey.text, /2 scoops a day \(48 g\)/);

  // Under-18s: no creatine or pre-workout without a doctor.
  const teen = S.forMember({ ...heavy, age: 16 }, null);
  assert.equal(teen.advice.creatine.fit, 'no');
  assert.equal(teen.advice.preworkout.fit, 'no');
  // Women build muscle about half as fast.
  assert.equal(S.forMember({ ...heavy, gender: 'female' }, null).expect.muscle, 0.5);
});

test('what each protein builds: honest times, training, food and what to avoid', () => {
  const man = { weight: 70, height: 175, age: 22, gender: 'male', goal: 'gain', experience: 'new', days: 4 };
  const r = S.result('whey', man, N.plan(man, 4));
  assert.equal(r.title, 'A lean, muscular body');
  assert.deepEqual(r.timeline.map(([w]) => w), ['1 month', '3 months', '6 months', '1 year', '2-3 years']);
  assert.match(r.timeline[3][1], /About 9 kg/);
  assert.match(r.timeline[4][1], /no powder/);
  assert.ok(r.training.some((t) => /4 days a week/.test(t)));
  assert.ok(r.food.some((t) => /kcal a day/.test(t)) && r.food.some((t) => /protein a day/.test(t)));
  assert.ok(r.avoid.some((t) => /Steroids/.test(t)));
  // Women: about half the muscle.
  assert.match(S.result('whey', { ...man, gender: 'female' }, null).timeline[3][1], /About 4\.5 kg/);
  assert.ok(S.result('creatine', man, null).avoid[0].includes('every day'));
  assert.ok(S.result('gainer', man, null).food.some((t) => /between meals/.test(t)));
  assert.equal(S.result('fatburner', man, null), null);
  assert.ok(S.hasResult('plant') && !S.hasResult('vitd'));
});

test('the gym adds result photos (settings right only)', async (t) => {
  const { createServer } = require('../server');
  const server = createServer({ seed: 'demo', reminders: false });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, token) => {
    const res = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const owner = (await call('/api/admin/login', 'POST', { pin: '1234' })).body.token;
  const desk = (await call('/api/admin/login', 'POST', { pin: '0000' })).body.token;
  const image = `data:image/jpeg;base64,${Buffer.from('jpeg').toString('base64')}`;
  assert.equal((await call('/api/admin/supp-photos/whey', 'PUT', { image }, owner)).status, 200);
  assert.ok((await call('/api/gym')).body.suppPhotos.whey);
  assert.equal((await call('/api/admin/supp-photos/whey', 'PUT', { image }, desk)).status, 403);
  assert.equal((await call('/api/admin/supp-photos/steroids', 'PUT', { image }, owner)).status, 404);
  assert.equal((await call('/api/admin/supp-photos/whey-f', 'PUT', { image }, owner)).status, 200);
  await call('/api/admin/supp-photos/whey-f', 'DELETE', null, owner);
  assert.equal((await call('/api/admin/supp-photos/whey', 'PUT', { image: 'nope' }, owner)).status, 400);
  await call('/api/admin/supp-photos/whey', 'DELETE', null, owner);
  assert.deepEqual((await call('/api/gym')).body.suppPhotos, {});
});
