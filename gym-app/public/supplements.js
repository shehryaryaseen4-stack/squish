// A plain guide to gym supplements: what each one is, what a serving holds,
// how to take it, what it does and doesn't do, the risks, and what it means for
// this member (scoops a day from their protein target, a dose for their weight).
// Numbers are typical label values and research averages; brands differ.
(function (root) {
  const round = (n, step = 1) => Math.round(n / step) * step;

  // evidence: strong | some | weak | none (how well research backs the main claim).
  const LIST = [
    {
      id: 'whey', name: 'Whey protein', kind: 'Protein powder', icon: 'scoop', color: '#f59e0b',
      when: 'After training, or any time you are short on protein',
      what: 'Milk protein, dried into a powder. It is food: the same protein as in milk, eggs or chicken, just quick and easy.',
      serving: { label: '1 scoop (about 30 g powder)', protein: 24, kcal: 120, carbs: 3, fat: 1.5 },
      dose: '1-2 scoops a day, in water or milk. Only as much as your food is short of your protein target.',
      timing: 'Any time of day works. Most people have it after training or with breakfast. The total for the day matters more than the time.',
      evidence: 'strong',
      evidenceText: 'Protein (from food or whey) helps build muscle when you lift. Whey is not better than the same protein from food; it just makes the target easy.',
      benefits: ['24 g protein in a minute, with few calories', 'Helps you reach your daily protein, which builds and keeps muscle', 'Digests fast, easy after training', 'Cheaper per gram of protein than meat in many places'],
      risks: ['Bloating or gas if milk upsets your stomach: choose whey isolate, or a plant protein', 'Fake or under-dosed tubs are common: buy from an authorised seller and check the seal and batch number', 'Not needed if your meals already give enough protein', 'People with kidney disease should ask a doctor before high-protein diets'],
      skip: 'You get your protein from food, or you have a milk allergy.',
      results: 'No faster than food protein. With training and enough protein, beginners usually see more muscle and strength in 8-12 weeks.',
    },
    {
      id: 'creatine', name: 'Creatine monohydrate', kind: 'Strength', icon: 'bolt', color: '#3b82f6',
      when: 'Any time, every day (even rest days)',
      what: 'A natural compound your muscles use for short, hard efforts. Meat and fish have a little; the powder gives you enough to fill your muscles up.',
      serving: { label: '1 small scoop (5 g)', protein: 0, kcal: 0, carbs: 0, fat: 0 },
      dose: '3-5 g a day, every day, in water or any drink. No loading needed (a faster start is 20 g a day split in 4 for one week, then 3-5 g).',
      timing: 'Any time of day. Taking it every day matters, not the time.',
      evidence: 'strong',
      evidenceText: 'The most studied supplement. With weight training it gives more strength and a little more muscle than training alone.',
      benefits: ['About 5-10% more strength and an extra rep or two per set', 'On average 1-2 kg more lean mass over 1-3 months than training alone', 'Faster recovery between sets', 'Cheap and safe for healthy adults in long studies'],
      risks: ['1-2 kg heavier in the first weeks: water stored inside the muscle, not fat', 'Stomach upset with big doses; split them or take with food', 'Drink plenty of water', 'People with kidney disease, and under-18s, should ask a doctor first'],
      skip: 'You have kidney problems, or you don’t lift weights (it does little without training).',
      results: 'Strength goes up in 2-4 weeks (1 week with loading). The extra muscle shows over 1-3 months of training.',
    },
    {
      id: 'gainer', name: 'Mass gainer', kind: 'Calories', icon: 'scoop', color: '#a855f7',
      when: 'Between meals, for people who can’t eat enough',
      what: 'Mostly sugar and starch with some protein: a big-calorie shake for people who find it hard to gain weight.',
      serving: { label: '1 serving (2-3 scoops, check the label)', protein: 30, kcal: 650, carbs: 120, fat: 7 },
      dose: 'Half a serving to one serving a day, only if you can’t gain weight from food.',
      timing: 'Between meals, so it adds to your food instead of replacing a meal.',
      evidence: 'some',
      evidenceText: 'It works the way any extra calories do: it makes you gain weight. Muscle comes from training; the rest is fat.',
      benefits: ['Easy extra calories for thin people with small appetites', 'Some protein in each serving'],
      risks: ['Lots of sugar; easy to gain fat', 'Can cause bloating and loose stomach', 'Not for anyone overweight or with diabetes', 'A home shake (milk, banana, oats, peanut butter) does the same, cheaper'],
      skip: 'You are at a healthy weight or above, or you have diabetes.',
      results: 'Weight goes up about 0.25-0.5 kg a week if you take it every day and train; more than that is mostly fat.',
    },
    {
      id: 'casein', name: 'Casein protein', kind: 'Protein powder', icon: 'moon', color: '#64748b',
      when: 'Before sleep',
      what: 'The slow-digesting milk protein. It releases protein over several hours.',
      serving: { label: '1 scoop (about 33 g powder)', protein: 24, kcal: 120, carbs: 3, fat: 1 },
      dose: '1 scoop, usually at night.',
      timing: 'Before bed, so your muscles get protein through the night. Dahi or milk at night does much the same.',
      evidence: 'some',
      evidenceText: 'A slow protein at night helps a little, mainly by adding to the day’s total.',
      benefits: ['Slow protein that keeps you full', 'Adds protein without a full meal at night'],
      risks: ['Same milk issues as whey (bloating if lactose upsets you)', 'Costs more than whey for the same protein'],
      skip: 'You already reach your protein target.',
      results: 'Same as other protein: it counts towards your daily total.',
    },
    {
      id: 'plant', name: 'Plant protein (pea, soy, rice)', kind: 'Protein powder', icon: 'sparkles', color: '#22c55e',
      when: 'Like whey: after training or any time',
      what: 'Protein from peas, soy or rice, for vegetarians or anyone milk doesn’t suit.',
      serving: { label: '1 scoop (about 32 g powder)', protein: 21, kcal: 120, carbs: 4, fat: 2 },
      dose: '1-2 scoops a day, as needed to reach your protein target.',
      timing: 'Any time of day.',
      evidence: 'strong',
      evidenceText: 'A blend of pea and rice (or soy) works about as well as whey when you get enough of it.',
      benefits: ['No milk: good for lactose problems and vegetarians', 'Easy to digest for most people'],
      risks: ['A little less protein per scoop than whey', 'Taste and texture are earthier', 'Allergies to soy or peas'],
      skip: 'You get your protein from food.',
      results: 'Same as whey and food protein.',
    },
    {
      id: 'preworkout', name: 'Pre-workout (caffeine)', kind: 'Energy', icon: 'flame', color: '#ef4444',
      when: '30 minutes before training, never late in the day',
      what: 'A drink with caffeine (often 150-350 mg a scoop) and sometimes beta-alanine (the tingle) and citrulline.',
      serving: { label: '1 scoop (check caffeine on the label)', protein: 0, kcal: 10, carbs: 1, fat: 0 },
      dose: 'Start with half a scoop. Keep caffeine from all drinks under 400 mg a day. A cup of strong coffee does the same job.',
      timing: '20-40 minutes before training. Not within 6-8 hours of sleep.',
      evidence: 'strong',
      evidenceText: 'Caffeine helps you train a little harder and longer. The other ingredients add little at the doses most tubs use.',
      benefits: ['More energy and focus', 'A few more reps and better endurance'],
      risks: ['Jitters, fast heartbeat, anxiety', 'Bad sleep, which hurts muscle growth', 'Not for people with high blood pressure or heart problems, pregnant women, or under-18s', 'Some tubs hide banned or risky stimulants: avoid unknown brands'],
      skip: 'You train in the evening, sleep badly, or have blood pressure or heart problems.',
      results: 'Works the same day, from the first dose. It doesn’t build muscle by itself.',
    },
    {
      id: 'bcaa', name: 'BCAA / EAA', kind: 'Amino acids', icon: 'activity', color: '#14b8a6',
      when: 'Not needed if you eat enough protein',
      what: 'Single amino acids, the building blocks of protein, sold as a flavoured drink.',
      serving: { label: '1 scoop (5-10 g)', protein: 5, kcal: 20, carbs: 0, fat: 0 },
      dose: 'Only useful if your meals are low in protein; a scoop of whey has more of them.',
      timing: 'During training, if you use it.',
      evidence: 'weak',
      evidenceText: 'With enough protein from food or whey, BCAAs add nothing for muscle.',
      benefits: ['Tasty drink during training', 'Can help a little if your diet is very low in protein'],
      risks: ['Mostly wasted money when your protein is enough'],
      skip: 'You reach your protein target (most people).',
      results: 'No extra muscle if your protein is already enough.',
    },
    {
      id: 'fatburner', name: 'Fat burner', kind: 'Weight loss', icon: 'alert', color: '#f97316',
      when: 'Better to skip',
      what: 'Pills with caffeine and plant extracts (green tea, L-carnitine, etc.) sold to burn fat.',
      serving: { label: '1-2 capsules', protein: 0, kcal: 0, carbs: 0, fat: 0 },
      dose: 'Not recommended. If you use one, never take it with a pre-workout or extra coffee.',
      timing: '-',
      evidence: 'none',
      evidenceText: 'At best a little extra calorie burn from the caffeine. Fat comes off from eating less than you burn.',
      benefits: ['Some appetite control and energy from the caffeine'],
      risks: ['Fast heartbeat, high blood pressure, poor sleep', 'Some contain banned or dangerous stimulants', 'Wastes money that could buy good food'],
      skip: 'Most people. Fat loss comes from your calorie target.',
      results: 'Almost nothing on its own. Fat loss comes from the calorie deficit in your diet plan.',
    },
    {
      id: 'vitd', name: 'Vitamin D3', kind: 'Health', icon: 'sun', color: '#eab308',
      when: 'With a meal, once a day',
      what: 'The sunshine vitamin. Many people are low in it, even in sunny countries, because they stay indoors.',
      serving: { label: '1 capsule or drops', protein: 0, kcal: 0, carbs: 0, fat: 0 },
      dose: 'Commonly 1,000-2,000 IU a day. Get a blood test first; higher doses only as a doctor prescribes.',
      timing: 'With a meal that has some fat.',
      evidence: 'some',
      evidenceText: 'If you are low, fixing it helps bones, muscles and energy. If you are not low, it adds little.',
      benefits: ['Stronger bones and better muscle function when you were low', 'Better energy and mood for people who were low'],
      risks: ['Too much over months is harmful; don’t take big doses without a test'],
      skip: 'Your blood test is normal.',
      results: 'Blood levels improve in 2-3 months.',
    },
    {
      id: 'omega3', name: 'Omega-3 (fish oil)', kind: 'Health', icon: 'heart', color: '#06b6d4',
      when: 'With a meal',
      what: 'Healthy fats found in oily fish.',
      serving: { label: '1-2 capsules (1 g each)', protein: 0, kcal: 10, carbs: 0, fat: 1 },
      dose: '1-2 g of fish oil a day, or eat oily fish twice a week.',
      timing: 'With food, to avoid fishy burps.',
      evidence: 'some',
      evidenceText: 'Good for heart health; small effects on joints and soreness. Not a muscle builder.',
      benefits: ['Heart and blood health', 'May ease joint stiffness'],
      risks: ['Fishy burps', 'Ask a doctor if you take blood thinners'],
      skip: 'You eat oily fish twice a week.',
      results: 'Health effects build over months.',
    },
    {
      id: 'multivitamin', name: 'Multivitamin', kind: 'Health', icon: 'sparkles', color: '#8b5cf6',
      when: 'With breakfast',
      what: 'A mix of vitamins and minerals.',
      serving: { label: '1 tablet', protein: 0, kcal: 0, carbs: 0, fat: 0 },
      dose: '1 a day.',
      timing: 'With a meal.',
      evidence: 'weak',
      evidenceText: 'Fills gaps in a poor diet; doesn’t help muscle or fat loss if you eat well.',
      benefits: ['A safety net if your diet lacks fruit and vegetables'],
      risks: ['Not a replacement for real food'],
      skip: 'You eat fruit, vegetables and a varied diet.',
      results: 'No visible body change.',
    },
    {
      id: 'electrolytes', name: 'Electrolytes / ORS', kind: 'Hydration', icon: 'snow', color: '#0ea5e9',
      when: 'Hot days and long sweaty sessions',
      what: 'Salt, potassium and a little sugar to replace what you sweat out.',
      serving: { label: '1 sachet in water', protein: 0, kcal: 40, carbs: 10, fat: 0 },
      dose: '1 sachet on hot days or after heavy sweating.',
      timing: 'During or after training.',
      evidence: 'some',
      evidenceText: 'Helps against cramps and tiredness when you sweat a lot.',
      benefits: ['Fewer cramps and less tiredness in the heat', 'Cheap (ORS from any pharmacy works)'],
      risks: ['Extra salt is not good for people with high blood pressure'],
      skip: 'Short sessions in a cool gym: water is enough.',
      results: 'Works the same day.',
    },
  ];

  // What a beginner can expect from training and diet, per month (women about half the muscle).
  const MUSCLE_RATE = { new: 0.9, lt1: 0.65, '1to3': 0.35, '3plus': 0.18 };

  /**
   * The guide for this member. body: their weight, goal, experience…; diet: Nutrition.plan(…).
   * Returns per-supplement advice ("2 scoops a day", "not for you") and what to expect.
   */
  function forMember(body, diet) {
    const kg = Number(body?.weight) || 70;
    const female = body?.gender === 'female';
    const goal = diet?.goal || body?.goal || 'fit';
    const teen = Number(body?.age) > 0 && Number(body?.age) < 18;
    const thin = diet?.bmi?.category === 'under';
    const heavy = ['over', 'obese'].includes(diet?.bmi?.category);
    // Protein from food alone (the plan may already include whey).
    const items = (diet?.meals || []).flatMap((m) => m.items);
    const fromWhey = items.filter((x) => x.key === 'whey').reduce((a, x) => a + x.protein, 0);
    const target = diet?.protein || round(kg * 1.6, 5);
    const food = (diet?.totals?.protein ?? target) - fromWhey;
    const short = Math.max(0, target - food);
    const scoops = short < 8 ? 0 : Math.min(2, Math.ceil(short / 24));
    const muscle = round((MUSCLE_RATE[body?.experience] || MUSCLE_RATE.new) * (female ? 0.5 : 1), 0.1);
    const deficit = diet ? diet.maintain - diet.target : 0;
    const fatPerMonth = deficit > 0 ? round((deficit * 30) / 7700, 0.1) : 0;
    const caffeine = Math.min(400, round(kg * 3, 25));

    const advice = {
      whey: scoops
        ? { fit: 'yes', text: `Your target is ${target} g protein a day and your meal plan gives about ${food} g. ${scoops} scoop${scoops > 1 ? 's' : ''} a day (${scoops * 24} g) covers the gap.` }
        : { fit: 'maybe', text: `Your meal plan already gives about ${food} g of your ${target} g protein. You don’t need whey, but it’s an easy swap on busy days.` },
      creatine: teen ? { fit: 'no', text: 'Under 18: ask a doctor first.' }
        : { fit: 'yes', text: `${kg >= 80 ? 5 : kg >= 60 ? '3-5' : 3} g a day, every day. Expect about 1-2 kg on the scale in the first weeks; that is water in your muscles.` },
      gainer: thin ? { fit: 'maybe', text: 'You are underweight: half a serving a day can help if you can’t eat more food. A home shake works too.' }
        : { fit: 'no', text: heavy ? 'You are above a healthy weight: a gainer would mostly add fat.' : 'Not needed: you can reach your calories with food.' },
      casein: { fit: scoops ? 'maybe' : 'no', text: scoops ? 'Optional: one scoop at night can replace one of your whey scoops.' : 'Not needed: you reach your protein from food.' },
      plant: { fit: body?.diet === 'veg' && scoops ? 'yes' : 'maybe', text: body?.diet === 'veg' ? (scoops ? `Good for you as a vegetarian: ${scoops} scoop${scoops > 1 ? 's' : ''} a day covers your protein gap.` : 'Your meals cover your protein; use it only on busy days.') : 'Choose this instead of whey if milk upsets your stomach.' },
      preworkout: teen ? { fit: 'no', text: 'Not for under-18s.' } : { fit: 'maybe', text: `Optional. For your weight keep it under about ${caffeine} mg of caffeine before training (all drinks counted), and not late in the day.` },
      bcaa: { fit: 'no', text: 'Not needed: your protein target already covers it.' },
      fatburner: { fit: 'no', text: goal === 'lose' ? `Skip it. Your diet plan eats about ${deficit} kcal a day less than you burn: that alone takes off about ${fatPerMonth} kg of fat a month.` : 'Skip it.' },
      vitd: { fit: 'maybe', text: 'Worth a blood test, especially if you are tired or rarely in the sun.' },
      omega3: { fit: 'maybe', text: 'Optional, for health. Not a muscle builder.' },
      multivitamin: { fit: 'maybe', text: 'Only if your meals lack fruit and vegetables.' },
      electrolytes: { fit: 'maybe', text: 'On hot days or if you get cramps.' },
    };
    return {
      advice,
      expect: { muscle, fatPerMonth, goal, deficit, scoops, target, food },
    };
  }

  const byId = Object.fromEntries(LIST.map((x) => [x.id, x]));
  const api = { LIST, byId, forMember };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Supplements = api;
})(typeof window !== 'undefined' ? window : globalThis);
