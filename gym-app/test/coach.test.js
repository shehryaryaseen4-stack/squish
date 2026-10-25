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
