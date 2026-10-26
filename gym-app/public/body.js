// Body shapes: pictures for "how you look now" and "the body you want",
// and the journey between them: how much fat to lose, how much muscle to
// build, in what order, and how long it takes at a healthy pace.
// The pictures are drawn here as SVG, so they need no image files.
(function (root) {
  // ---- drawing --------------------------------------------------------------------

  // A smooth closed or open path through points (Catmull-Rom as cubic Béziers).
  function smooth(pts, closed) {
    const p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < p.length - 2; i++) {
      const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return closed ? `${d}Z` : d;
  }

  /**
   * A front-view figure. fat 0 (very lean) … 3.5 (heavy); muscle 0 (none) … 3 (bodybuilder).
   * Returns SVG markup sized by CSS (viewBox 0 0 200 400).
   */
  function figure(sex, fat, muscle, { label = '' } = {}) {
    const f = sex === 'female';
    const F = fat;
    const M = muscle;
    const cx = 100;
    // Half-widths of the body at each height.
    const shoulder = (f ? 27 : 31) + M * (f ? 4 : 9.5) + F * 4;
    const chest = (f ? 24 : 27) + M * (f ? 3 : 5.5) + F * 6.5;
    const under = (f ? 20 : 25) + M * (f ? 2 : 5) + F * 7.5;
    const waist = (f ? 16.5 : 21) + M * (f ? 0.6 : 1.6) + F * 9.5;
    const belly = (f ? 19 : 22) + M * 1 + F * 10.5;
    const hip = (f ? 28 : 24) + M * (f ? 2.5 : 1.8) + F * 8;
    const thigh = (f ? 26 : 23) + M * (f ? 2.5 : 4) + F * 7.5;
    const knee = 15 + M * 1.2 + F * 3;
    const calf = 15 + M * 2.6 + F * 3;
    const ankle = 9 + F * 1.2;
    const gap = Math.max(1.5, 5 - F * 1.6);

    const right = [
      [cx + 7.5 + M * 1.5 + F * 1.5, 58], // neck
      [cx + 8.5 + M * 2.5 + F * 2, 70],
      [cx + shoulder * 0.62, 79],
      [cx + shoulder, 91],
      [cx + chest, 112],
      [cx + under, 138],
      [cx + waist, 162],
      [cx + belly, 186],
      [cx + hip, 212],
      [cx + thigh, 240],
      [cx + thigh * 0.82 + 2, 275],
      [cx + knee + 4, 308],
      [cx + calf + 5, 334],
      [cx + ankle + 6, 372],
      [cx + ankle + 8, 390],
      [cx + gap + 3, 392],
      [cx + gap + 1, 372],
      [cx + gap + 1, 330],
      [cx + gap, 300],
      [cx + gap - 0.5, 262],
      [cx + 0.5, 246],
    ];
    const left = right.slice().reverse().map(([x, y]) => [2 * cx - x, y]);
    const body = smooth([...right, ...left], true);

    // Arms hang a little away from the body.
    const arm = (side) => {
      const s = side;
      const ux = (f ? 8 : 10) + M * (f ? 2 : 5.5) + F * 3; // upper arm half-width
      const lx = (f ? 6 : 7.5) + M * (f ? 1.2 : 2.6) + F * 2; // forearm
      const elbowX = cx + s * (Math.max(under, waist + F * 2) + ux * 0.8 + 5);
      const wristX = cx + s * (Math.max(hip, thigh) + lx * 0.8 + 5);
      const pts = [
        [cx + s * (shoulder - 8), 86], [cx + s * (shoulder + 2), 89], [cx + s * (shoulder + ux * 0.45), 108],
        [elbowX + s * ux * 0.8, 160], [wristX + s * lx, 202], [wristX + s * 4.5, 230], [wristX - s * 4.5, 231],
        [wristX - s * lx * 0.85, 204], [elbowX - s * ux * 0.75, 166], [cx + s * (chest - 1), 120],
      ];
      return `<path d="${smooth(pts, true)}"/><ellipse cx="${wristX}" cy="240" rx="6" ry="10"/>`;
    };

    // Lines that show muscle when there is little fat over it.
    const lines = [];
    const show = Math.max(0, Math.min(1, M * 0.9 - F * 0.9 + 0.2));
    if (!f && show > 0.15) {
      lines.push(`<path d="M${cx},${100} Q${cx + chest * 0.55},${128 + M} ${cx + chest * 0.9},${110}" /><path d="M${cx},${100} Q${cx - chest * 0.55},${128 + M} ${cx - chest * 0.9},${110}" />`);
    }
    if (show > 0.35 && F < 1.2) {
      const rows = [142, 158, 174];
      lines.push(`<path d="M${cx},136 L${cx},196" />${rows.map((y) => `<path d="M${cx - 9},${y} L${cx + 9},${y}" />`).join('')}`);
      lines.push(`<path d="M${cx - waist + 3},150 Q${cx - waist * 0.55},190 ${cx - 6},214" /><path d="M${cx + waist - 3},150 Q${cx + waist * 0.55},190 ${cx + 6},214" />`);
    }
    if (F >= 2) lines.push(`<path d="M${cx - belly * 0.75},${200 + F * 2} Q${cx},${214 + F * 3} ${cx + belly * 0.75},${200 + F * 2}" />`);
    if (f) lines.push(`<path d="M${cx - chest * 0.85},${118} Q${cx - chest * 0.45},${132 + F * 2} ${cx - 3},${120}" /><path d="M${cx + chest * 0.85},${118} Q${cx + chest * 0.45},${132 + F * 2} ${cx + 3},${120}" />`);
    if (M >= 1.5 && F < 1.5) lines.push(`<path d="M${cx - thigh * 0.6},${250} Q${cx - thigh * 0.45},${280} ${cx - knee * 0.4},${300}" /><path d="M${cx + thigh * 0.6},${250} Q${cx + thigh * 0.45},${280} ${cx + knee * 0.4},${300}" />`);

    const headW = f ? 16 : 16.5;
    const hair = f
      ? `<path class="hair" d="M${cx - 21},44 Q${cx - 24},6 ${cx},6 Q${cx + 24},6 ${cx + 21},44 L${cx + 23},86 Q${cx + 14},80 ${cx + 13},58 L${cx - 13},58 Q${cx - 14},80 ${cx - 23},86 Z"/>`
      : `<path class="hair" d="M${cx - 17},34 Q${cx - 18},10 ${cx},10 Q${cx + 18},10 ${cx + 17},34 Q${cx + 12},22 ${cx},22 Q${cx - 12},22 ${cx - 17},34 Z"/>`;
    // Soft light from the front-left gives the figure some depth.
    return `<svg class="body-fig" viewBox="0 0 200 400" role="img" aria-label="${label.replace(/[<&"]/g, '')}">
      <defs><linearGradient id="bf-skin" x1="0" x2="1" y1="0" y2="0"><stop offset="0" class="sk-edge"/><stop offset=".38" class="sk-lit"/><stop offset=".62" class="sk-mid"/><stop offset="1" class="sk-edge"/></linearGradient></defs>
      ${f ? hair : ''}<g class="skin" fill="url(#bf-skin)">${arm(1)}${arm(-1)}<path d="${body}"/><ellipse cx="${cx}" cy="${36}" rx="${headW + F * 1.2}" ry="${22 + F * 0.6}"/></g>${f ? '' : hair}
      <g class="lines" style="opacity:${f ? 0.6 : Math.max(0.35, show)}">${lines.join('')}</g></svg>`;
  }

  // ---- the choices --------------------------------------------------------------------

  // How the member looks now. bf: body fat % range for that look.
  const NOW = {
    male: [
      { id: 'skinny', label: 'Very thin', hint: 'Bones show, hard to gain weight', fat: 0, muscle: 0, bf: [6, 11] },
      { id: 'slim', label: 'Slim', hint: 'Thin, a little shape', fat: 0.5, muscle: 0.5, bf: [10, 15] },
      { id: 'average', label: 'Average', hint: 'Some fat, no clear muscle', fat: 1.3, muscle: 0.4, bf: [16, 23] },
      { id: 'belly', label: 'Belly fat', hint: 'Big stomach, soft chest', fat: 2.3, muscle: 0.4, bf: [23, 30] },
      { id: 'heavy', label: 'Heavy', hint: 'Fat all over the body', fat: 3.4, muscle: 0.3, bf: [30, 42] },
      { id: 'bulky', label: 'Strong, some fat', hint: 'Big and strong, a soft middle', fat: 1.6, muscle: 1.8, bf: [18, 26] },
    ],
    female: [
      { id: 'skinny', label: 'Very thin', hint: 'Bones show, hard to gain weight', fat: 0, muscle: 0, bf: [14, 19] },
      { id: 'slim', label: 'Slim', hint: 'Thin, little shape', fat: 0.5, muscle: 0.3, bf: [19, 24] },
      { id: 'average', label: 'Average', hint: 'Some softness, no tone', fat: 1.3, muscle: 0.3, bf: [24, 31] },
      { id: 'belly', label: 'Belly & hips', hint: 'Weight on the stomach and hips', fat: 2.3, muscle: 0.3, bf: [31, 38] },
      { id: 'heavy', label: 'Heavy', hint: 'Fat all over the body', fat: 3.4, muscle: 0.2, bf: [38, 48] },
      { id: 'bulky', label: 'Strong, some fat', hint: 'Strong, a soft middle', fat: 1.6, muscle: 1.4, bf: [26, 33] },
    ],
  };

  // The body they want. bf: body fat % to reach, gain: kg of muscle to add (for an average beginner),
  // focus: where the coach adds extra work.
  const WANT = {
    male: [
      { id: 'healthy', label: 'Fit & healthy', hint: 'Less fat, more energy', fat: 1.0, muscle: 0.7, bf: 18, gain: 1.5, focus: 'balanced' },
      { id: 'slim', label: 'Slim', hint: 'Light and lean', fat: 0.4, muscle: 0.4, bf: 13, gain: 0, focus: 'waist' },
      { id: 'toned', label: 'Lean & toned', hint: 'Flat stomach, abs show', fat: 0.3, muscle: 1.0, bf: 11, gain: 3, focus: 'waist' },
      { id: 'athletic', label: 'Athletic', hint: 'V shape, strong and fast', fat: 0.5, muscle: 1.5, bf: 12, gain: 5, focus: 'back' },
      { id: 'muscular', label: 'Muscular', hint: 'Big chest, arms and shoulders', fat: 0.7, muscle: 2.2, bf: 13, gain: 9, focus: 'chest' },
      { id: 'bodybuilder', label: 'Bodybuilder', hint: 'Very big and defined', fat: 0.3, muscle: 3.0, bf: 9, gain: 15, focus: 'balanced' },
    ],
    female: [
      { id: 'healthy', label: 'Fit & healthy', hint: 'Less fat, more energy', fat: 1.0, muscle: 0.5, bf: 27, gain: 1, focus: 'balanced' },
      { id: 'slim', label: 'Slim', hint: 'Light and slender', fat: 0.4, muscle: 0.3, bf: 23, gain: 0, focus: 'waist' },
      { id: 'toned', label: 'Toned', hint: 'Firm arms, flat stomach', fat: 0.4, muscle: 0.8, bf: 22, gain: 2, focus: 'waist' },
      { id: 'curvy', label: 'Curvy & strong', hint: 'Round glutes, slim waist', fat: 0.8, muscle: 1.2, bf: 24, gain: 3.5, focus: 'legs' },
      { id: 'athletic', label: 'Athletic', hint: 'Strong, shapely muscles', fat: 0.5, muscle: 1.6, bf: 21, gain: 5, focus: 'balanced' },
      { id: 'fitness', label: 'Fitness model', hint: 'Lean with clear muscle', fat: 0.2, muscle: 2.2, bf: 18, gain: 7, focus: 'balanced' },
    ],
  };

  // ---- real photos -----------------------------------------------------------------------
  // The gym (or the app's owner, in public/shapes/) can replace each drawing with a photo.
  let photos = {};
  const setPhotos = (map) => { photos = { ...photos, ...(map || {}) }; };
  const keyOf = (sex, kind, id) => `${sex}-${kind}-${id}`;
  /** The photo for this look if there is one, else the drawing. kind: "now" or "want". */
  function picture(sex, kind, x) {
    const src = photos[keyOf(sex, kind, x.id)];
    const alt = x.label.replace(/[<&"]/g, '');
    if (src) return `<img class="body-photo" src="${String(src).replace(/"/g, '&quot;')}" alt="${alt}" loading="lazy">`;
    return figure(sex, x.fat, x.muscle, { label: x.label });
  }

  const sexOf = (b) => (b?.gender === 'female' ? 'female' : 'male');
  const nowOf = (b) => NOW[sexOf(b)].find((x) => x.id === b?.shape) || null;
  const wantOf = (b) => WANT[sexOf(b)].find((x) => x.id === b?.target) || null;

  // ---- the journey ------------------------------------------------------------------------

  // Muscle a natural lifter can add, kg per month, by training age (women about half).
  const MUSCLE_RATE = { new: 0.9, lt1: 0.65, '1to3': 0.35, '3plus': 0.18 };
  const round1 = (n) => Math.round(n * 10) / 10;

  /** Body fat %: the look they chose, checked against BMI (Deurenberg) so a wrong pick doesn't mislead. */
  function bodyFat(b) {
    const look = nowOf(b);
    const kg = Number(b.weight);
    const m = Number(b.height) / 100;
    const est = kg && m ? 1.2 * (kg / (m * m)) + 0.23 * (Number(b.age) || 30) - 10.8 * (sexOf(b) === 'male' ? 1 : 0) - 5.4 : null;
    if (!look) return est ? Math.max(5, Math.round(est)) : null;
    const mid = (look.bf[0] + look.bf[1]) / 2;
    // BMI can't see muscle, so trust the picture for strong builds.
    if (!est || look.id === 'bulky') return Math.round(mid);
    const blended = (mid + est) / 2;
    return Math.round(Math.max(look.bf[0] - 3, Math.min(look.bf[1] + 3, blended)));
  }

  /**
   * From now to the wanted body: phases (lose fat / build muscle / tone up),
   * weeks for each, the weight at the end of each, and checkpoints.
   */
  function journey(b) {
    const want = wantOf(b);
    const now = nowOf(b);
    if (!want || !now || !b.weight) return null;
    const female = sexOf(b) === 'female';
    // Measured from where the journey started; weekly weigh-ins show the progress.
    const kg = Number(b.startWeight || b.weight);
    const bf = bodyFat({ ...b, weight: kg }) / 100;
    const fatKg = kg * bf;
    const lean = kg - fatKg;
    const rate = (MUSCLE_RATE[b.experience] || MUSCLE_RATE.new) * (female ? 0.5 : 1) * (Number(b.age) >= 40 ? 0.8 : 1);
    // Small people build less muscle; scale the goal by frame (lean mass vs. a typical 60 kg man / 42 kg woman).
    const gain = round1(want.gain * Math.min(1.25, Math.max(0.7, lean / (female ? 42 : 60))) * (now.id === 'bulky' ? 0.4 : 1));
    const targetBf = want.id === 'healthy' ? Math.min(bf * 100, Math.max(want.bf, bf * 100 - 7)) / 100 : want.bf / 100;
    const leanEnd = lean + gain;
    const weightEnd = round1(leanEnd / (1 - targetBf));
    const phases = [];

    let w = kg;
    let l = lean;
    let fatNow = fatKg;
    // 1. Lose fat first when well above the target (muscle still grows a little for beginners).
    const fatEnd = leanEnd * targetBf / (1 - targetBf);
    if (fatNow - fatEnd > 2.5 && bf * 100 > want.bf + 3) {
      const perWeek = bf > (female ? 0.38 : 0.3) ? 0.75 : bf > (female ? 0.3 : 0.2) ? 0.5 : 0.35;
      const toLose = fatNow - fatEnd;
      const weeks = Math.ceil(toLose / perWeek);
      const leanGain = Math.min(gain, ['new', 'lt1'].includes(b.experience) ? (rate / 4.3) * weeks * 0.5 : 0);
      l += leanGain;
      fatNow = fatEnd;
      const end = round1(l + fatNow);
      phases.push({ goal: 'lose', label: 'Lose fat', weeks, from: round1(w), to: end, text: `Eat a little less than you burn, with lots of protein, and lift weights so you keep your muscle. About ${perWeek} kg a week.` });
      w = end;
    }
    // 2. Build the muscle that's still missing, with a small surplus.
    const leftToBuild = leanEnd - l;
    if (leftToBuild > 1) {
      const weeks = Math.ceil((leftToBuild / rate) * 4.3);
      const end = round1(w + leftToBuild * 1.35);
      phases.push({ goal: 'gain', label: 'Build muscle', weeks, from: round1(w), to: end, text: `Eat a little more than you burn and lift heavier every week. About ${round1((leftToBuild * 1.35) / weeks)} kg a week, mostly muscle.` });
      w = end;
      fatNow += leftToBuild * 0.35;
      l = leanEnd;
    }
    // 3. Lose the little fat that comes with building, so the muscle shows.
    const finalFat = l * targetBf / (1 - targetBf);
    if (phases.some((p) => p.goal === 'gain') && fatNow - finalFat > 1.5) {
      const weeks = Math.ceil((fatNow - finalFat) / 0.4);
      const end = round1(l + finalFat);
      phases.push({ goal: 'lose', label: 'Get defined', weeks, from: round1(w), to: end, text: 'A short diet to lose the last bit of fat, so your new muscle shows.' });
      w = end;
    }
    if (!phases.length) {
      phases.push({ goal: 'fit', label: 'Tone up', weeks: 12, from: round1(kg), to: round1(kg), text: 'You are close already. Eat as much as you burn, lift weights and add a little cardio: fat turns into firm muscle over 3 months.' });
    }
    const weeks = phases.reduce((a, p) => a + p.weeks, 0);
    let at = 0;
    for (const p of phases) { p.start = at; at += p.weeks; }
    return {
      bodyFat: Math.round(bf * 100),
      targetBodyFat: Math.round(targetBf * 100),
      fatToLose: round1(Math.max(0, fatKg - finalFat)),
      muscleToGain: round1(gain),
      weightNow: kg,
      weightEnd: round1(w),
      weeks,
      months: Math.max(1, Math.round(weeks / 4.33)),
      phases,
      now,
      want,
    };
  }

  /** Where the member is in the journey today, and which goal the diet and coach should follow. */
  function current(b, today, weighIns = []) {
    const j = journey(b);
    if (!j) return null;
    const started = b.journeyStart || today;
    const week = Math.max(0, Math.floor((Date.parse(today) - Date.parse(started)) / (7 * 864e5)));
    const kg = [...weighIns].sort((a, z) => a.d.localeCompare(z.d)).pop()?.kg ?? Number(b.weight);
    let i = j.phases.findIndex((p) => week < p.start + p.weeks);
    if (i < 0) i = j.phases.length - 1;
    // Reached the weight for a fat-loss phase early? Move on.
    while (i < j.phases.length - 1 && j.phases[i].goal === 'lose' && kg <= j.phases[i].to) i++;
    const phase = j.phases[i];
    // How far along, by weight: lost or gained so far out of the whole change.
    const total = j.weightEnd - j.weightNow;
    const lose = j.phases[0].goal === 'lose';
    const firstTo = j.phases[0].to;
    const progress = lose ? (j.weightNow - kg) / Math.max(0.1, j.weightNow - firstTo) : total ? (kg - j.weightNow) / total : 0;
    return { ...j, week: week + 1, index: i, phase, goal: phase.goal, kgNow: kg, progress: Math.max(0, Math.min(1, progress)), done: week >= j.weeks };
  }

  const api = { figure, picture, setPhotos, keyOf, NOW, WANT, nowOf, wantOf, bodyFat, journey, current };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Body = api;
})(typeof window !== 'undefined' ? window : globalThis);
