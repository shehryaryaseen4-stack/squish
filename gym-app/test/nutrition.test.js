'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../public/nutrition');
const lib = require('../public/exercises/library.json');

const byId = Object.fromEntries(lib.exercises.map((e) => [e.id, e]));

test('calories per set and per workout grow with sets and body weight', () => {
  const bench = byId['barbell-bench-press-medium-grip'];
  const a = N.burn(bench, { sets: 3, reps: '10-12' }, 70);
  assert.ok(a.perSet >= 8 && a.perSet <= 20, `per set ${a.perSet}`);
  assert.equal(N.burn(bench, { sets: 4, reps: '10-12' }, 70).total > a.total, true);
  assert.equal(N.burn(bench, { sets: 3, reps: '10-12' }, 100).total > a.total, true);
  const run = lib.exercises.find((e) => /Running/.test(e.name));
  const r = N.burn(run, { sets: 1, reps: '15 min' }, 70);
  assert.ok(r.total > 150 && r.total < 220, `15 min run ${r.total}`);
  // A typical hour of weights lands in the usual 200-500 kcal range.
  const day = { exercises: lib.exercises.filter((e) => e.group === 'chest').slice(0, 6).map((e) => ({ id: e.id, sets: 3, reps: '10-12' })) };
  const d = N.dayBurn(day, byId, 75);
  assert.ok(d.kcal > 150 && d.kcal < 500, `day ${d.kcal}`);
});

test('the diet plan meets the protein target with everyday foods', () => {
  for (const diet of ['nonveg', 'egg', 'veg']) {
    for (const goal of ['lose', 'fit', 'gain']) {
      const p = N.plan({ weight: 75, height: 175, age: 25, gender: 'male', goal, diet }, 5);
      assert.equal(p.protein, goal === 'fit' ? 120 : 150);
      assert.ok(p.totals.protein >= p.protein - 15, `${diet}/${goal}: ${p.totals.protein} of ${p.protein}`);
      assert.ok(Math.abs(p.totals.kcal - p.target) < 400, `${diet}/${goal}: ${p.totals.kcal} vs ${p.target}`);
      const foods = p.meals.flatMap((m) => m.items.map((x) => x.key));
      if (diet !== 'nonveg') assert.ok(!foods.includes('chicken') && !foods.includes('fish'));
      if (diet === 'veg') assert.ok(!foods.includes('egg'));
    }
  }
  const cut = N.plan({ weight: 75, height: 175, age: 25, gender: 'male', goal: 'lose', diet: 'nonveg' }, 5);
  const bulk = N.plan({ weight: 75, height: 175, age: 25, gender: 'male', goal: 'gain', diet: 'nonveg' }, 5);
  assert.ok(cut.target < cut.maintain && bulk.target > bulk.maintain);
});

test('a plan keeps the rest chosen for an exercise, or leaves it to the suggestion', () => {
  const v = require('../lib/validate');
  const plan = v.workoutPlan({ days: { mon: { groups: ['chest'], exercises: [{ id: 'barbell-bench-press-medium-grip', sets: 4, reps: '8-10', rest: 120 }, { id: 'dumbbell-flyes', sets: 3, reps: '12' }] } } });
  assert.equal(plan.days.mon.exercises[0].rest, 120);
  assert.equal('rest' in plan.days.mon.exercises[1], false);
  assert.throws(() => v.workoutPlan({ days: { mon: { groups: ['chest'], exercises: [{ id: 'dumbbell-flyes', rest: 9999 }] } } }));
});
