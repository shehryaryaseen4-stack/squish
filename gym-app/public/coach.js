// The app's personal trainer: builds a plan from the member's body, goal,
// experience and schedule, suggests a safe starting weight for every
// exercise, and raises it workout by workout (double progression).
// Pure functions, so the same logic runs in the app and in tests.
(function (root) {
  // ---- starting weights ------------------------------------------------------------
  // Load for a man in his first weeks of training, as a share of body weight.
  // kind: bar = total on a barbell (bar included), db = each dumbbell, kb = one kettlebell,
  // machine / cable = the stack, body = body weight only.
  const START = {
    'barbell-bench-press-medium-grip': ['bar', 0.5], 'barbell-incline-bench-press-medium-grip': ['bar', 0.4], 'decline-barbell-bench-press': ['bar', 0.5],
    'dumbbell-bench-press': ['db', 0.14], 'incline-dumbbell-press': ['db', 0.12], 'dumbbell-flyes': ['db', 0.07], 'incline-dumbbell-flyes': ['db', 0.06],
    'cable-crossover': ['cable', 0.08], butterfly: ['machine', 0.3], 'dips-chest-version': ['body'], pushups: ['body'],
    'wide-grip-lat-pulldown': ['cable', 0.45], pullups: ['body'], 'bent-over-barbell-row': ['bar', 0.4], 'one-arm-dumbbell-row': ['db', 0.16],
    'seated-cable-rows': ['cable', 0.45], 't-bar-row-with-handle': ['bar', 0.3], 'close-grip-front-lat-pulldown': ['cable', 0.45],
    'barbell-deadlift': ['bar', 0.8, 'lower'], 'hyperextensions-back-extensions': ['body'], 'straight-arm-pulldown': ['cable', 0.2],
    'dumbbell-shoulder-press': ['db', 0.1], 'standing-military-press': ['bar', 0.3], 'arnold-dumbbell-press': ['db', 0.08], 'side-lateral-raise': ['db', 0.04],
    'front-dumbbell-raise': ['db', 0.05], 'reverse-flyes': ['db', 0.04], 'face-pull': ['cable', 0.2], 'upright-barbell-row': ['bar', 0.25], 'leverage-shoulder-press': ['machine', 0.3],
    'barbell-shrug': ['bar', 0.6], 'dumbbell-shrug': ['db', 0.2], 'cable-shrugs': ['cable', 0.5],
    'barbell-curl': ['bar', 0.2], 'dumbbell-bicep-curl': ['db', 0.07], 'hammer-curls': ['db', 0.08], 'preacher-curl': ['bar', 0.15], 'concentration-curls': ['db', 0.06],
    'ez-bar-curl': ['bar', 0.2], 'standing-biceps-cable-curl': ['cable', 0.2], 'alternate-incline-dumbbell-curl': ['db', 0.06],
    'triceps-pushdown': ['cable', 0.25], 'triceps-pushdown-rope-attachment': ['cable', 0.2], 'ez-bar-skullcrusher': ['bar', 0.15], 'close-grip-barbell-bench-press': ['bar', 0.4],
    'cable-rope-overhead-triceps-extension': ['cable', 0.18], 'bench-dips': ['body'], 'tricep-dumbbell-kickback': ['db', 0.05], 'dips-triceps-version': ['body'],
    'palms-up-barbell-wrist-curl-over-a-bench': ['bar', 0.15], 'palms-down-wrist-curl-over-a-bench': ['bar', 0.1], 'reverse-barbell-curl': ['bar', 0.15], 'farmers-walk': ['db', 0.3],
    'barbell-squat': ['bar', 0.6, 'lower'], 'leg-press': ['machine', 1.0, 'lower'], 'hack-squat': ['machine', 0.5, 'lower'], 'leg-extensions': ['machine', 0.3, 'lower'],
    'lying-leg-curls': ['machine', 0.2, 'lower'], 'seated-leg-curl': ['machine', 0.25, 'lower'], 'romanian-deadlift': ['bar', 0.5, 'lower'], 'dumbbell-lunges': ['db', 0.1, 'lower'],
    'barbell-walking-lunge': ['bar', 0.3, 'lower'], 'goblet-squat': ['kb', 0.2, 'lower'], 'barbell-hip-thrust': ['bar', 0.6, 'lower'],
    'standing-calf-raises': ['machine', 0.6, 'lower'], 'seated-calf-raise': ['machine', 0.3, 'lower'], 'calf-press-on-the-leg-press-machine': ['machine', 0.8, 'lower'],
    'cable-crunch': ['cable', 0.3], 'ab-crunch-machine': ['machine', 0.3],
  };
  const EXPERIENCE = { new: 0.75, lt1: 1, '1to3': 1.35, '3plus': 1.7 };

  function kindOf(id) {
    const s = START[id];
    return s ? { kind: s[0], ratio: s[1], lower: s[2] === 'lower' } : { kind: 'body', lower: false };
  }

  // Weights people can actually load: bars in 2.5 kg, dumbbells in 1 or 2.5 kg, stacks in 5 kg.
  function roundLoad(kind, kg, female) {
    if (kind === 'bar') return Math.max(female ? 10 : 20, Math.round(kg / 2.5) * 2.5);
    if (kind === 'db') return kg <= 10 ? Math.max(2, Math.round(kg)) : Math.round(kg / 2.5) * 2.5;
    if (kind === 'kb') return Math.max(4, Math.round(kg / 4) * 4);
    return Math.max(5, Math.round(kg / 5) * 5);
  }

  /** Where a member should start on an exercise. */
  function startWeight(id, p) {
    const { kind, ratio, lower } = kindOf(id);
    if (kind === 'body' || !ratio) return null;
    const female = p.gender === 'female';
    let kg = (p.weight || 70) * ratio * (EXPERIENCE[p.experience] || 1);
    if (female) kg *= lower ? 0.7 : 0.55;
    if (p.age >= 50) kg *= 0.85;
    return roundLoad(kind, kg, female);
  }

  const range = (reps) => {
    const n = String(reps || '').match(/\d+/g)?.map(Number) || [10];
    return [n[0], n[1] || n[0]];
  };

  function step(id, kg) {
    const { kind, lower } = kindOf(id);
    if (kind === 'bar') return lower ? 5 : 2.5;
    if (kind === 'db') return kg < 10 ? 1 : 2.5;
    if (kind === 'kb') return 4;
    return 5;
  }

  /**
   * What to lift today, from the last sessions of this exercise.
   * Hit the top of the rep range on every set → add weight next time.
   * Fell short of the bottom twice at the same weight → drop 10%.
   */
  function nextTarget(id, x, history = [], p = {}) {
    const [lo, hi] = range(x.reps);
    const { kind } = kindOf(id);
    const last = history[history.length - 1];
    if (kind === 'body') {
      if (!last) return { weight: null, reps: `${lo}-${hi}`, note: 'Use your body weight. Stop each set when your form starts to slip.' };
      const best = Math.min(...last.s.map(([, r]) => r));
      if (best >= hi + 3) return { weight: null, reps: `${hi}+`, note: 'Too easy now: move slower (3 seconds down) or hold a weight.', up: true };
      return { weight: null, reps: `${Math.min(best + 1, hi + 3)}`, note: `Last time ${last.s.map(([, r]) => r).join(', ')} reps. Try 1 more on each set.` };
    }
    if (!last) {
      const w = startWeight(id, p);
      return { weight: w, reps: `${lo}-${hi}`, first: true, note: `Start at ${w} kg${kind === 'db' ? ' in each hand' : ''}. It should feel steady with 2 reps left in you. Too easy or too hard? Change it, and the app learns from what you log.` };
    }
    const w = Math.max(...last.s.map(([kg]) => kg));
    const atW = last.s.filter(([kg]) => kg === w);
    const allTop = atW.length >= Math.max(1, x.sets - 1) && atW.every(([, r]) => r >= hi);
    if (allTop) {
      const up = roundLoad(kind, w + step(id, w), p.gender === 'female');
      const next = up > w ? up : w + step(id, w);
      return { weight: next, reps: `${lo}-${hi}`, up: true, note: `You did ${hi}+ reps on every set at ${w} kg. Time to go up to ${next} kg 💪` };
    }
    const prev = history[history.length - 2];
    const missed = (s) => s.some(([kg, r]) => kg === w && r < lo);
    if (missed(last.s) && prev && missed(prev.s)) {
      const down = roundLoad(kind, w * 0.9, p.gender === 'female');
      return { weight: down, reps: `${lo}-${hi}`, down: true, note: `${w} kg was too heavy twice. Drop to ${down} kg, get all reps with good form, then build up again.` };
    }
    return { weight: w, reps: `${lo}-${hi}`, note: `Stay at ${w} kg and beat last time (${last.s.map(([, r]) => r).join(', ')} reps). When every set reaches ${hi}, the weight goes up.` };
  }

  // ---- the plan ------------------------------------------------------------------
  // Each slot lists exercises in order of preference; injuries and experience remove some.
  const SLOTS = {
    chestPress: ['barbell-bench-press-medium-grip', 'dumbbell-bench-press', 'incline-dumbbell-press', 'butterfly', 'pushups'],
    chestPress2: ['incline-dumbbell-press', 'barbell-incline-bench-press-medium-grip', 'dumbbell-bench-press', 'decline-barbell-bench-press', 'pushups'],
    chestFly: ['cable-crossover', 'dumbbell-flyes', 'butterfly', 'incline-dumbbell-flyes'],
    shoulderPress: ['dumbbell-shoulder-press', 'leverage-shoulder-press', 'standing-military-press', 'arnold-dumbbell-press', 'side-lateral-raise'],
    lateral: ['side-lateral-raise', 'reverse-flyes', 'face-pull'],
    rearDelt: ['face-pull', 'reverse-flyes'],
    vertPull: ['wide-grip-lat-pulldown', 'close-grip-front-lat-pulldown', 'pullups'],
    row: ['seated-cable-rows', 'one-arm-dumbbell-row', 'bent-over-barbell-row', 't-bar-row-with-handle'],
    row2: ['one-arm-dumbbell-row', 'seated-cable-rows', 't-bar-row-with-handle', 'straight-arm-pulldown'],
    hingeBack: ['barbell-deadlift', 'hyperextensions-back-extensions'],
    squat: ['barbell-squat', 'goblet-squat', 'leg-press', 'hack-squat'],
    legPress: ['leg-press', 'hack-squat', 'goblet-squat'],
    hinge: ['romanian-deadlift', 'barbell-hip-thrust', 'lying-leg-curls'],
    lunge: ['dumbbell-lunges', 'barbell-walking-lunge', 'leg-press'],
    glutes: ['barbell-hip-thrust', 'romanian-deadlift', 'dumbbell-lunges'],
    legCurl: ['lying-leg-curls', 'seated-leg-curl'],
    legExt: ['leg-extensions'],
    calves: ['standing-calf-raises', 'seated-calf-raise', 'calf-press-on-the-leg-press-machine'],
    biceps: ['dumbbell-bicep-curl', 'barbell-curl', 'ez-bar-curl', 'standing-biceps-cable-curl'],
    biceps2: ['hammer-curls', 'preacher-curl', 'alternate-incline-dumbbell-curl', 'concentration-curls'],
    triceps: ['triceps-pushdown', 'triceps-pushdown-rope-attachment', 'cable-rope-overhead-triceps-extension'],
    triceps2: ['cable-rope-overhead-triceps-extension', 'ez-bar-skullcrusher', 'tricep-dumbbell-kickback', 'bench-dips'],
    abs: ['plank', 'cable-crunch', 'crunches', 'flat-bench-lying-leg-raise'],
    abs2: ['russian-twist', 'flat-bench-lying-leg-raise', 'mountain-climbers', 'hanging-leg-raise'],
    shrug: ['dumbbell-shrug', 'barbell-shrug', 'cable-shrugs'],
    cardio: ['bicycling-stationary', 'walking-treadmill', 'elliptical-trainer', 'rowing-stationary', 'running-treadmill'],
  };
  const COMPOUND = new Set(['chestPress', 'chestPress2', 'shoulderPress', 'vertPull', 'row', 'row2', 'hingeBack', 'squat', 'legPress', 'hinge', 'lunge', 'glutes']);

  const AVOID = {
    knee: ['barbell-squat', 'hack-squat', 'dumbbell-lunges', 'barbell-walking-lunge', 'leg-extensions', 'running-treadmill', 'rope-jumping', 'mountain-climbers', 'goblet-squat'],
    back: ['barbell-deadlift', 'bent-over-barbell-row', 't-bar-row-with-handle', 'romanian-deadlift', 'barbell-squat', 'standing-military-press', 'barbell-shrug', 'hyperextensions-back-extensions', 'russian-twist', 'barbell-walking-lunge'],
    shoulder: ['standing-military-press', 'upright-barbell-row', 'dips-chest-version', 'dips-triceps-version', 'arnold-dumbbell-press', 'bench-dips', 'barbell-bench-press-medium-grip', 'decline-barbell-bench-press', 'pullups', 'dumbbell-shoulder-press', 'leverage-shoulder-press'],
  };
  // Free-weight lifts that need practice first; new members start on machines and dumbbells.
  const SKILLED = ['barbell-deadlift', 'barbell-squat', 'bent-over-barbell-row', 'standing-military-press', 'romanian-deadlift', 'pullups', 'dips-chest-version', 'dips-triceps-version', 'hanging-leg-raise', 'barbell-walking-lunge', 't-bar-row-with-handle'];

  const DAYS = { 2: ['tue', 'fri'], 3: ['mon', 'wed', 'fri'], 4: ['mon', 'tue', 'thu', 'fri'], 5: ['mon', 'tue', 'wed', 'thu', 'fri'], 6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] };
  const TEMPLATES = {
    full: ['squat', 'chestPress', 'row', 'shoulderPress', 'legCurl', 'biceps', 'triceps', 'abs'],
    fullB: ['legPress', 'chestPress2', 'vertPull', 'hinge', 'lateral', 'triceps2', 'biceps2', 'abs2'],
    fullC: ['lunge', 'chestFly', 'row2', 'shoulderPress', 'calves', 'biceps', 'triceps', 'abs'],
    upper: ['chestPress', 'row', 'shoulderPress', 'vertPull', 'lateral', 'biceps', 'triceps', 'chestFly'],
    upperB: ['chestPress2', 'vertPull', 'row2', 'lateral', 'rearDelt', 'triceps2', 'biceps2', 'shrug'],
    lower: ['squat', 'hinge', 'lunge', 'legCurl', 'calves', 'abs', 'legExt'],
    lowerB: ['legPress', 'glutes', 'legCurl', 'legExt', 'calves', 'abs2', 'lunge'],
    push: ['chestPress', 'shoulderPress', 'chestPress2', 'lateral', 'triceps', 'chestFly', 'triceps2'],
    pull: ['vertPull', 'row', 'row2', 'rearDelt', 'biceps', 'biceps2', 'shrug'],
    legs: ['squat', 'hinge', 'legPress', 'legCurl', 'legExt', 'calves', 'abs'],
  };
  const SPLITS = {
    2: ['Full body', ['full', 'fullB']],
    3: ['Full body', ['full', 'fullB', 'fullC']],
    4: ['Upper · Lower', ['upper', 'lower', 'upperB', 'lowerB']],
    5: ['Push · Pull · Legs + Upper · Lower', ['push', 'pull', 'legs', 'upperB', 'lowerB']],
    6: ['Push · Pull · Legs ×2', ['push', 'pull', 'legs', 'push', 'pull', 'legs']],
  };
  // Extra work for what the member most wants to change.
  const FOCUS = {
    balanced: { label: 'Balanced, all-round body', add: [] },
    chest: { label: 'Bigger chest and shoulders', add: ['chestFly', 'lateral'] },
    arms: { label: 'Bigger arms', add: ['biceps2', 'triceps2'] },
    back: { label: 'Wide back (V shape)', add: ['vertPull', 'rearDelt'] },
    legs: { label: 'Strong legs and glutes', add: ['glutes', 'legCurl'] },
    waist: { label: 'Flat stomach, slim waist', add: ['abs2', 'cardio'] },
  };

  const GROUP_OF = (lib, id) => lib.byId[id]?.group;
  const Nutrition = typeof module !== 'undefined' && module.exports ? require('./nutrition') : root.Nutrition;
  // Hard on the knees and ankles of a heavy body; bike, walk or elliptical instead.
  const HIGH_IMPACT = ['running-treadmill', 'rope-jumping', 'mountain-climbers', 'battling-ropes'];

  function plan(p, lib) {
    const days = Math.max(2, Math.min(6, Number(p.days) || 3));
    const [splitName, order] = SPLITS[days];
    const perDay = { 45: 5, 60: 6, 90: 8 }[p.minutes] || 6;
    const avoid = new Set((p.injuries || []).flatMap((k) => AVOID[k] || []));
    if (p.experience === 'new' || p.experience === 'lt1') SKILLED.forEach((id) => avoid.add(id));
    const body = Nutrition.bmi(p, { asian: p.asian });
    const heavy = body && !body.teen && body.category === 'obese';
    const thin = body && !body.teen && body.category === 'under';
    if (heavy) HIGH_IMPACT.forEach((id) => avoid.add(id));
    const used = new Map();
    const trained = p.experience === '1to3' || p.experience === '3plus';
    const pick = (slot, offset) => {
      // Experienced members get loaded moves, not push-ups.
      const options = SLOTS[slot].filter((id) => lib.byId[id] && !avoid.has(id) && !(trained && kindOf(id).kind === 'body' && COMPOUND.has(slot)));
      if (!options.length) return null;
      const n = used.get(slot) || 0;
      used.set(slot, n + 1);
      // Rotate through the best few so repeated days differ a little.
      return options[(n + offset) % Math.min(3, options.length)];
    };
    const reps = (slot) => {
      if (slot === 'cardio') return p.goal === 'lose' || heavy ? '20 min' : '12 min';
      const compound = COMPOUND.has(slot);
      if (p.goal === 'lose') return compound ? '10-12' : '12-15';
      if (p.goal === 'gain') return compound ? (p.experience === '3plus' ? '6-8' : '8-10') : '10-12';
      return compound ? '8-12' : '10-15';
    };
    const sets = (slot) => {
      if (slot === 'cardio') return 1;
      if (COMPOUND.has(slot)) return p.goal === 'gain' && p.experience !== 'new' ? 4 : 3;
      return 3;
    };
    const out = {};
    DAYS[days].forEach((day, i) => {
      const tpl = TEMPLATES[order[i]];
      const focusSlots = (FOCUS[p.focus] || FOCUS.balanced).add.filter((s) => s !== 'cardio');
      const slots = [...tpl.slice(0, perDay)];
      // Focus muscles get an extra exercise on the days that train them.
      for (const f of focusSlots) if (tpl.some((s) => GROUP_OF(lib, SLOTS[s]?.[0]) === GROUP_OF(lib, SLOTS[f][0])) && !slots.includes(f)) slots.push(f);
      // Cardio for fat loss and for heavy bodies whatever the goal; underweight members save their energy for growing.
      if ((p.goal === 'lose' || p.focus === 'waist' || heavy) && !thin) slots.push('cardio');
      const exercises = [];
      for (const slot of slots) {
        const id = pick(slot, i);
        if (!id || exercises.some((x) => x.id === id)) continue;
        const r = id === 'plank' ? '45 s' : lib.byId[id].group === 'abs' && !START[id] ? '15' : reps(slot);
        exercises.push({ id, sets: sets(slot), reps: r });
      }
      const groups = [...new Set(exercises.map((x) => GROUP_OF(lib, x.id)))];
      out[day] = { groups, exercises };
    });
    return { days: out, program: { by: 'coach', split: splitName, weeks: 8 }, bmi: body };
  }

  // Week of the 8-week block: weeks 1-2 learn the moves, 3-7 build, 8 is a lighter week.
  function phase(startedAt, today) {
    if (!startedAt) return null;
    const days = Math.floor((Date.parse(today) - Date.parse(startedAt)) / 864e5);
    const week = Math.max(1, Math.floor(days / 7) + 1);
    const inBlock = ((week - 1) % 8) + 1;
    const name = inBlock <= 2 ? 'Learn the moves' : inBlock < 8 ? 'Build strength' : 'Easy week';
    const tip = inBlock <= 2 ? 'Focus on form. The weights here are on the light side on purpose.'
      : inBlock < 8 ? 'Add weight whenever the app says so. Sleep 7-8 hours and hit your protein.'
        : 'Do one set less and use about 10% less weight this week so your body recovers. Next week a new block starts.';
    return { week, inBlock, block: Math.ceil(week / 8), name, tip, deload: inBlock === 8 };
  }

  // Weekly weigh-ins → is the body moving the right way for the goal?
  function weightTrend(weighIns = [], goal = 'fit') {
    const list = [...weighIns].sort((a, b) => a.d.localeCompare(b.d));
    if (list.length < 2) return { note: 'Weigh yourself once a week, same day and time (morning, before breakfast).' };
    const first = list.find((x) => Date.parse(list[list.length - 1].d) - Date.parse(x.d) <= 28 * 864e5) || list[0];
    const last = list[list.length - 1];
    const weeks = Math.max(1, (Date.parse(last.d) - Date.parse(first.d)) / (7 * 864e5));
    const perWeek = Math.round(((last.kg - first.kg) / weeks) * 10) / 10;
    const pct = (perWeek / first.kg) * 100;
    let note;
    let kcal = 0;
    if (goal === 'lose') {
      if (pct > -0.2) { note = 'Your weight isn’t going down. Eat about 150 kcal less (one roti less) and walk 20 minutes more each day.'; kcal = -150; }
      else if (pct < -1.2) { note = 'You are losing too fast; you may lose muscle. Eat about 150 kcal more.'; kcal = 150; }
      else note = 'Perfect pace: you are losing fat steadily. Keep going!';
    } else if (goal === 'gain') {
      if (pct < 0.1) { note = 'Your weight isn’t going up. Add about 200 kcal: a glass of milk and a banana.'; kcal = 200; }
      else if (pct > 0.7) { note = 'You are gaining fast, some of it fat. Eat about 150 kcal less.'; kcal = -150; }
      else note = 'Great: you are gaining at a good pace for building muscle.';
    } else note = Math.abs(pct) < 0.5 ? 'Your weight is steady. Nice!' : `Your weight is ${perWeek > 0 ? 'going up' : 'going down'} a little. Check your meals.`;
    return { perWeek, note, kcal, from: first, to: last };
  }

  const api = { startWeight, nextTarget, plan, phase, weightTrend, kindOf, FOCUS, SLOTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Coach = api;
})(typeof window !== 'undefined' ? window : globalThis);
