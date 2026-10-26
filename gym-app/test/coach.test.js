'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/coach');
const lib = require('../public/exercises/library.json');
const { createServer } = require('../server');

lib.byId = Object.fromEntries(lib.exercises.map((e) => [e.id, e]));
const base = { weight: 70, height: 172, age: 25, gender: 'male', goal: 'gain', experience: 'new', days: 3, minutes: 60, focus: 'balanced', injuries: [] };

test('the coach builds a plan for the days, goal and body', () => {
  for (const days of [2, 3, 4, 5, 6]) {
    const p = C.plan({ ...base, days }, lib);
    assert.equal(Object.keys(p.days).length, days);
    for (const day of Object.values(p.days)) {
      assert.ok(day.exercises.length >= 4, `${days} days: ${day.exercises.length} exercises`);
      assert.equal(new Set(day.exercises.map((x) => x.id)).size, day.exercises.length, 'no exercise twice in a day');
      for (const x of day.exercises) assert.ok(lib.byId[x.id], x.id);
    }
  }
  // New lifters get machines and dumbbells, not heavy barbell squats and deadlifts.
  const ids = Object.values(C.plan(base, lib).days).flatMap((d) => d.exercises.map((x) => x.id));
  assert.ok(!ids.includes('barbell-deadlift') && !ids.includes('barbell-squat'));
  // Injuries keep risky moves out.
  const knee = Object.values(C.plan({ ...base, injuries: ['knee'], experience: '3plus', days: 6 }, lib).days).flatMap((d) => d.exercises.map((x) => x.id));
  for (const bad of ['barbell-squat', 'dumbbell-lunges', 'hack-squat', 'leg-extensions']) assert.ok(!knee.includes(bad), bad);
  // Fat loss adds cardio; muscle gain uses heavier rep ranges.
  const lose = C.plan({ ...base, goal: 'lose' }, lib);
  assert.ok(Object.values(lose.days).every((d) => d.exercises.some((x) => lib.byId[x.id].cardio)));
  assert.equal(C.plan(base, lib).days.mon.exercises[0].reps, '8-10');
});

test('starting weights fit the person and round to real plates and dumbbells', () => {
  const man = C.startWeight('barbell-bench-press-medium-grip', base);
  const woman = C.startWeight('barbell-bench-press-medium-grip', { ...base, gender: 'female', weight: 55 });
  const pro = C.startWeight('barbell-bench-press-medium-grip', { ...base, experience: '3plus', weight: 85 });
  assert.ok(man >= 20 && man <= 35, `man ${man}`);
  assert.ok(woman < man, `woman ${woman}`);
  assert.ok(pro > 60, `experienced ${pro}`);
  assert.equal(man % 2.5, 0);
  assert.ok(Number.isInteger(C.startWeight('dumbbell-bicep-curl', base)));
  assert.equal(C.startWeight('leg-press', base) % 5, 0);
  assert.equal(C.startWeight('pushups', base), null);
});

test('weights go up after every set hits the top of the range, and down after two misses', () => {
  const x = { sets: 3, reps: '8-10' };
  const id = 'barbell-bench-press-medium-grip';
  const first = C.nextTarget(id, x, [], base);
  assert.ok(first.first && first.weight > 0);
  assert.equal(C.nextTarget(id, x, [{ d: '1', s: [[30, 10], [30, 10], [30, 10]] }], base).weight, 32.5);
  assert.equal(C.nextTarget('barbell-squat', x, [{ d: '1', s: [[60, 10], [60, 10], [60, 10]] }], base).weight, 65);
  const stay = C.nextTarget(id, x, [{ d: '1', s: [[30, 10], [30, 9], [30, 8]] }], base);
  assert.equal(stay.weight, 30);
  const miss = [{ d: '1', s: [[40, 7], [40, 6], [40, 6]] }, { d: '2', s: [[40, 7], [40, 6], [40, 5]] }];
  assert.ok(C.nextTarget(id, x, miss, base).weight < 40);
  assert.match(C.nextTarget('pushups', { sets: 3, reps: '10-12' }, [{ d: '1', s: [[0, 12], [0, 11], [0, 10]] }], base).note, /1 more/);
});

test('the 8-week block and the weekly weigh-in advice', () => {
  assert.equal(C.phase('2026-10-01', '2026-10-05').name, 'Learn the moves');
  assert.equal(C.phase('2026-10-01', '2026-10-25').week, 4);
  assert.equal(C.phase('2026-08-01', '2026-09-22').deload, true);
  assert.equal(C.weightTrend([{ d: '2026-10-01', kg: 80 }, { d: '2026-10-22', kg: 80 }], 'lose').kcal, -150);
  assert.equal(C.weightTrend([{ d: '2026-10-01', kg: 80 }, { d: '2026-10-22', kg: 78.5 }], 'lose').kcal, 0);
  assert.equal(C.weightTrend([{ d: '2026-10-01', kg: 60 }, { d: '2026-10-22', kg: 60 }], 'gain').kcal, 200);
});

test('members log their sets and weigh-ins', async (t) => {
  const server = createServer({ seed: 'demo', reminders: false, now: () => new Date('2026-10-19T05:00:00Z') });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, token) => {
    const res = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const token = (await call('/api/member/login', 'POST', { id: '1001', pin: '1111' })).body.token;
  assert.ok(token);
  const ex = 'barbell-bench-press-medium-grip';
  await call('/api/member/lift', 'PUT', { exerciseId: ex, sets: [[30, 10]] }, token);
  const after = await call('/api/member/lift', 'PUT', { exerciseId: ex, sets: [[30, 10], [30, 9.6]] }, token);
  assert.equal(after.status, 400, 'reps are whole numbers');
  const two = await call('/api/member/lift', 'PUT', { exerciseId: ex, sets: [[30, 10], [32.5, 8]] }, token);
  assert.deepEqual(two.body, [{ d: '2026-10-19', s: [[30, 10], [32.5, 8]] }], 'same day is replaced, not added');
  await call('/api/member/body', 'PUT', { ...base }, token);
  const w = await call('/api/member/weigh-in', 'POST', { kg: 71.4 }, token);
  assert.equal(w.body.weighIns.at(-1).kg, 71.4);
  assert.equal(w.body.body.weight, 71);
  const me = (await call('/api/member/me', 'GET', null, token)).body;
  assert.equal(me.member.lifts[ex][0].s.length, 2);
  assert.equal(me.member.body.experience, 'new');
  // A coach plan keeps its program details.
  const plan = C.plan(base, lib);
  const saved = await call('/api/member/plan', 'PUT', { ...plan, program: { ...plan.program, startedAt: '2026-10-19' } }, token);
  assert.equal(saved.body.program.by, 'coach');
  assert.equal(saved.body.program.startedAt, '2026-10-19');
});

test('BMI: groups, healthy weight and the plan it leads to', () => {
  const N = require('../public/nutrition');
  const who = N.bmi({ weight: 70, height: 175, age: 30 });
  assert.equal(who.value, 22.9);
  assert.equal(who.category, 'normal');
  assert.deepEqual(who.healthy, { min: 57, max: 76 });
  // Asian ranges: the same body is overweight from 23.
  const asia = N.bmi({ weight: 74, height: 175, age: 30 }, { asian: true });
  assert.equal(asia.category, 'over');
  assert.equal(asia.goal, 'lose');
  assert.ok(N.isAsian('en-PK') && N.isAsian('ur-PK') && !N.isAsian('en-GB'));
  const thin = N.bmi({ weight: 50, height: 175, age: 22 });
  assert.equal(thin.category, 'under');
  assert.equal(thin.goal, 'gain');
  assert.equal(thin.gap, 7);
  const heavy = N.bmi({ weight: 110, height: 170, age: 35 });
  assert.equal(heavy.category, 'obese');
  assert.ok(heavy.gap < -30 && heavy.milestone >= 7);
  assert.equal(heavy.proteinKg, 72, 'protein from a healthy weight, not 110 kg');
  // Teens get no goal from adult ranges.
  assert.equal(N.bmi({ weight: 80, height: 165, age: 15 }).goal, null);

  // The diet won't starve an underweight member or overfeed an obese one.
  const dietThin = N.plan({ weight: 50, height: 175, age: 22, gender: 'male', goal: 'lose' }, 3);
  assert.equal(dietThin.goal, 'fit');
  assert.ok(dietThin.changed);
  const dietHeavy = N.plan({ weight: 110, height: 170, age: 35, gender: 'male', goal: 'gain' }, 3);
  assert.equal(dietHeavy.goal, 'recomp');
  assert.ok(dietHeavy.target < dietHeavy.maintain);
  assert.ok(dietHeavy.protein <= 150, `protein ${dietHeavy.protein}`);

  // Workouts: low-impact cardio every day for a heavy body, no extra cardio when underweight.
  const heavyPlan = C.plan({ ...base, weight: 110, height: 170, goal: 'fit', days: 3 }, lib);
  for (const day of Object.values(heavyPlan.days)) {
    const cardio = day.exercises.filter((x) => lib.byId[x.id].cardio);
    assert.equal(cardio.length, 1);
    assert.ok(!['running-treadmill', 'rope-jumping'].includes(cardio[0].id));
    assert.equal(cardio[0].reps, '20 min');
  }
  const thinPlan = C.plan({ ...base, weight: 50, height: 175, focus: 'waist' }, lib);
  assert.ok(Object.values(thinPlan.days).every((d) => !d.exercises.some((x) => lib.byId[x.id].cardio)));
});
