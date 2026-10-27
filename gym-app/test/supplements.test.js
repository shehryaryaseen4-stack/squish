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
