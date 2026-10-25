// Calories burned per exercise and a daily diet plan built around protein.
// Estimates from standard MET values (Compendium of Physical Activities) and
// the Mifflin-St Jeor formula; good for guidance, not a medical plan.
(function (root) {
  const round = (n, step = 1) => Math.round(n / step) * step;

  // How hard each kind of exercise is, in METs.
  const CARDIO_METS = [
    [/jump rope|rope jump|skipping/i, 11], [/run|sprint/i, 9.8], [/stair|step mill|stepmill/i, 9], [/row/i, 7], [/bike|cycl|bicycl/i, 7],
    [/jog/i, 7], [/elliptical|cross.?trainer/i, 5], [/walk/i, 3.8], [/burpee|mountain climber|jumping jack/i, 8],
  ];
  const SMALL = new Set(['biceps', 'triceps', 'forearms', 'calves', 'abs', 'traps']);

  function met(e) {
    if (e.cardio) return (CARDIO_METS.find(([re]) => re.test(e.name)) || [null, 7])[1];
    if (SMALL.has(e.group)) return 3.8;
    // Big compound lifts work several muscles at once.
    if (['legs', 'back'].includes(e.group) && /barbell|kettlebell|body only/.test(e.equipment || '')) return 6;
    return (e.secondary || []).length >= 2 ? 5.5 : 5;
  }

  const avgReps = (reps) => {
    const n = String(reps || '').match(/\d+/g)?.map(Number) || [10];
    return n.length > 1 ? (n[0] + n[1]) / 2 : n[0];
  };
  const minutesOf = (reps) => (/min/i.test(reps) ? avgReps(reps) : /s$/i.test(String(reps).trim()) ? avgReps(reps) / 60 : 0);

  /**
   * One exercise in the plan → minutes and calories.
   * A strength set is about 2 minutes with its rest (more for long sets).
   */
  function burn(e, { sets = 3, reps = '10-12' } = {}, kg = 70) {
    const perMin = (met(e) * 3.5 * kg) / 200;
    const timed = minutesOf(reps);
    const setMinutes = timed ? timed + (e.cardio ? 0 : 1) : 1.4 + (avgReps(reps) * 3) / 60;
    const perSet = perMin * setMinutes;
    return { perSet: round(perSet), total: round(perSet * sets), minutes: round(setMinutes * sets) };
  }

  function dayBurn(day, byId, kg) {
    let kcal = 0;
    let minutes = 0;
    for (const x of day?.exercises || []) {
      const e = byId[x.id];
      if (!e) continue;
      const b = burn(e, x, kg);
      kcal += b.total;
      minutes += b.minutes;
    }
    return { kcal: round(kcal), minutes: round(minutes) };
  }

  // Foods people actually eat, with protein (g) and calories per portion.
  const FOODS = {
    egg: { name: 'Eggs (boiled or omelette)', unit: 'egg', p: 6.3, kcal: 75 },
    chicken: { name: 'Chicken breast, cooked', unit: 'g', per: 100, p: 31, kcal: 165 },
    fish: { name: 'Fish, grilled or curry', unit: 'g', per: 100, p: 22, kcal: 140 },
    beef: { name: 'Lean beef / qeema', unit: 'g', per: 100, p: 26, kcal: 220 },
    daal: { name: 'Daal (lentils)', unit: 'bowl', p: 14, kcal: 230 },
    chana: { name: 'Chanay (chickpeas)', unit: 'cup', p: 14.5, kcal: 270 },
    paneer: { name: 'Paneer', unit: 'g', per: 100, p: 18, kcal: 265 },
    soya: { name: 'Soya chunks (dry weight)', unit: 'g', per: 50, p: 26, kcal: 172 },
    milk: { name: 'Milk', unit: 'glass', p: 8.5, kcal: 150 },
    dahi: { name: 'Dahi (yogurt)', unit: 'cup', p: 8.5, kcal: 150 },
    whey: { name: 'Whey protein', unit: 'scoop', p: 24, kcal: 120 },
    roti: { name: 'Roti (whole wheat)', unit: 'roti', p: 3, kcal: 120 },
    rice: { name: 'Rice, cooked', unit: 'cup', p: 4.3, kcal: 205 },
    oats: { name: 'Oats', unit: 'g', per: 50, p: 6.5, kcal: 190 },
    banana: { name: 'Banana', unit: 'banana', p: 1.3, kcal: 105 },
    peanut: { name: 'Peanut butter', unit: 'tbsp', p: 4, kcal: 95 },
    salad: { name: 'Salad / vegetables', unit: 'plate', p: 2, kcal: 60 },
  };

  function item(key, qty) {
    const f = FOODS[key];
    const portions = f.per ? qty / f.per : qty;
    const label = f.per ? `${qty} g` : `${qty} ${f.unit}${qty === 1 || f.unit === 'tbsp' ? '' : 's'}`;
    return { key, food: f.name, qty, label, protein: round(f.p * portions), kcal: round(f.kcal * portions) };
  }

  const ACTIVITY = (days) => (days <= 1 ? 1.2 : days <= 3 ? 1.375 : days <= 5 ? 1.55 : 1.725);
  const PROTEIN_PER_KG = { lose: 2.0, fit: 1.6, gain: 2.0 };

  /**
   * body: { weight, height, age, gender, goal: lose|fit|gain, diet: nonveg|egg|veg }
   * trainingDays: workout days in the week plan
   */
  function plan(body, trainingDays = 3, adjust = 0) {
    const { weight: kg, height: cm, age, gender, goal = 'fit', diet = 'nonveg' } = body;
    const bmr = 10 * kg + 6.25 * cm - 5 * age + (gender === 'female' ? -161 : 5);
    const maintain = bmr * ACTIVITY(trainingDays);
    // adjust: the coach's change after weekly weigh-ins (e.g. -150 when weight isn't moving).
    const target = Math.max(gender === 'female' ? 1200 : 1500, maintain + (goal === 'lose' ? -450 : goal === 'gain' ? 300 : 0) + (Number(adjust) || 0));
    const protein = round(Math.min(kg, 120) * PROTEIN_PER_KG[goal], 5);
    const fat = round((target * 0.25) / 9, 5);
    const carbs = round((target - protein * 4 - fat * 9) / 4, 5);

    // Start from everyday meals, then add protein foods until the target is met.
    const meals = {
      breakfast: [item('milk', 1), diet === 'veg' ? item('oats', 50) : item('egg', 2), item('roti', 1)],
      lunch: [item('roti', 2), item('daal', 1), item('salad', 1)],
      snack: [item('dahi', 1), item('banana', 1)],
      dinner: [item('roti', 2), item('salad', 1)],
    };
    const sum = (k) => Object.values(meals).flat().reduce((a, x) => a + x[k], 0);
    const add = (meal, key, qty) => {
      const at = meals[meal].findIndex((x) => x.key === key);
      if (at >= 0) meals[meal][at] = item(key, meals[meal][at].qty + qty);
      else meals[meal].unshift(item(key, qty));
    };
    const short = () => protein - sum('protein');
    // Biggest protein sources first, within sensible amounts.
    const steps = diet === 'nonveg'
      ? [['lunch', 'chicken', 50, 150], ['dinner', 'chicken', 50, 150], ['breakfast', 'egg', 1, 2], ['snack', 'whey', 1, 1], ['dinner', 'fish', 50, 150]]
      : diet === 'egg'
        ? [['breakfast', 'egg', 1, 3], ['dinner', 'paneer', 50, 150], ['lunch', 'chana', 1, 1], ['snack', 'whey', 1, 1], ['dinner', 'soya', 25, 50]]
        : [['dinner', 'paneer', 50, 150], ['lunch', 'chana', 1, 1], ['dinner', 'soya', 25, 75], ['snack', 'whey', 1, 1], ['breakfast', 'peanut', 1, 2]];
    for (const [meal, key, step, max] of steps) {
      let added = 0;
      while (short() > 2 && added + step <= max) {
        add(meal, key, step);
        added += step;
      }
    }
    // Then bring calories near the target with roti and rice.
    // Spread the extra roti over the day, with at most one cup of rice.
    const qty = (meal, key) => meals[meal].find((x) => x.key === key)?.qty || 0;
    const fills = [['breakfast', 'roti', 2], ['dinner', 'roti', 3], ['lunch', 'rice', 1], ['lunch', 'roti', 3], ['snack', 'oats', 50], ['breakfast', 'roti', 3], ['dinner', 'roti', 4], ['lunch', 'roti', 4], ['snack', 'peanut', 2]];
    let grew = true;
    while (grew && sum('kcal') < target - 150) {
      grew = false;
      for (const [meal, key, cap] of fills) {
        const step = key === 'oats' ? 50 : 1;
        if (qty(meal, key) + step <= cap) { add(meal, key, step); grew = true; break; }
      }
    }
    // Too much for a small target: fewer roti (at least one with lunch and dinner).
    for (const meal of ['breakfast', 'dinner', 'lunch']) {
      const min = meal === 'breakfast' ? 0 : 1;
      while (sum('kcal') > target + 150 && (meals[meal].find((x) => x.key === 'roti')?.qty || 0) > min) add(meal, 'roti', -1);
    }
    if (sum('kcal') > target + 150) meals.snack = meals.snack.filter((x) => x.key !== 'banana');
    // Carbs bring protein too: drop extra meat or paneer if now well over.
    for (const key of ['chicken', 'fish', 'paneer', 'soya']) {
      for (const meal of ['dinner', 'lunch']) {
        const step = key === 'soya' ? 25 : 50;
        while (sum('protein') - protein > 12 && qty(meal, key) > step) add(meal, key, -step);
      }
    }

    return {
      bmr: round(bmr),
      maintain: round(maintain, 10),
      target: round(target, 10),
      protein,
      carbs,
      fat,
      water: Math.round(kg * 0.035 * 10) / 10,
      meals: Object.entries(meals).map(([id, items]) => ({ id, items: items.filter((x) => x.qty > 0) })),
      totals: { protein: round(sum('protein')), kcal: round(sum('kcal'), 10) },
    };
  }

  const api = { met, burn, dayBurn, plan, FOODS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Nutrition = api;
})(typeof window !== 'undefined' ? window : globalThis);
