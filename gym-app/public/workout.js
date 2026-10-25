// Weekly workout plans and the exercise library (photos show how to do each move).
// Used by the member app and, for trainers, by the dashboard.
(function () {
  const { esc, toast, sheet, busy, confirmSheet, DAY_LABELS } = UI;
  const BASE = window.APP_CONFIG?.demo ? '' : '/';
  const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  let lib = null;
  // Body weight for calorie estimates; the member app sets it.
  let kg = 70;
  const kcalOf = (e, x) => (window.Nutrition ? Nutrition.burn(e, x, kg) : null);

  let videos = {};
  async function library() {
    if (lib) return lib;
    const [res, vids] = await Promise.all([fetch(`${BASE}exercises/library.json`), UI.api('/api/exercise-videos').catch(() => ({}))]);
    if (!res.ok) throw new Error('Could not load the exercise library');
    lib = await res.json();
    lib.byId = Object.fromEntries(lib.exercises.map((e) => [e.id, e]));
    videos = vids || {};
    return lib;
  }
  const setVideo = (id, v) => { if (v) videos[id] = v; else delete videos[id]; };
  const videoOf = (id) => videos[id] || null;

  // The gym's own clip or YouTube video; otherwise a link to short videos on YouTube.
  function player(e) {
    const v = videos[e.id];
    if (v?.type === 'file') return `<div class="ex-video"><video src="${UI.esc(UI.photoSrc(v.src))}" controls playsinline loop autoplay muted preload="metadata"></video></div>`;
    if (v?.type === 'youtube') return `<div class="ex-video yt${v.short ? ' short' : ''}"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${encodeURIComponent(v.id)}" title="${UI.esc(e.name)} video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    return '';
  }
  // ---- rest between sets ------------------------------------------------------------

  let goal = 'fit';
  const SMALL_GROUPS = new Set(['biceps', 'triceps', 'forearms', 'calves', 'traps']);
  // Suggested rest in seconds: heavy compound lifts need longer to recover than small muscles.
  function restFor(e, x = {}) {
    if (x.rest != null && x.rest !== '') return Number(x.rest);
    if (e.cardio) return 0;
    const reps = Number(String(x.reps || '').match(/\d+/)?.[0]) || 10;
    let s;
    if (e.group === 'abs') s = 45;
    else if (SMALL_GROUPS.has(e.group) || (e.secondary || []).length === 0) s = 60;
    else if (['legs', 'back', 'chest'].includes(e.group) && /barbell/.test(e.equipment || '')) s = 120;
    else s = 90;
    if (reps <= 6 && !SMALL_GROUPS.has(e.group) && e.group !== 'abs') s = 180; // heavy, low-rep sets
    if (goal === 'lose') s = Math.max(30, s - 30);
    return s;
  }
  const restText = (s) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} sec` : ''}` : `${s} sec`);
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // A rest countdown at the bottom of the screen; buzzes and beeps when it's time for the next set.
  let timer = null;
  function startRest(seconds, nextLabel) {
    stopRest();
    let left = seconds;
    const bar = document.createElement('div');
    bar.className = 'rest-timer';
    bar.setAttribute('role', 'timer');
    bar.innerHTML = `<div class="rt-track"><i></i></div><div class="rt-row">${icon('clock')}<div class="rt-text"><small>Rest</small><b>${clock(left)}</b></div><span class="rt-next">${UI.esc(nextLabel)}</span><button class="btn btn-ghost btn-sm" data-more>+15s</button><button class="btn btn-primary btn-sm" data-skip>Skip</button></div>`;
    document.body.append(bar);
    let total = seconds;
    const paint = () => {
      bar.querySelector('b').textContent = clock(Math.max(0, left));
      bar.querySelector('.rt-track i').style.width = `${Math.max(0, (left / total) * 100)}%`;
    };
    const finish = () => {
      stopRest();
      try { navigator.vibrate?.([250, 120, 250]); } catch { /* not on this device */ }
      beep();
      toast(`Time's up! ${nextLabel}`);
    };
    bar.querySelector('[data-more]').addEventListener('click', () => { left += 15; total += 15; paint(); });
    bar.querySelector('[data-skip]').addEventListener('click', stopRest);
    timer = { bar, id: setInterval(() => { left -= 1; paint(); if (left <= 0) finish(); }, 1000) };
    paint();
  }
  function stopRest() {
    if (!timer) return;
    clearInterval(timer.id);
    timer.bar.remove();
    timer = null;
  }
  let audio = null;
  function beep() {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22].forEach((t) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.frequency.value = 880;
        o.connect(g);
        g.connect(audio.destination);
        const t0 = audio.currentTime + t;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        o.start(t0);
        o.stop(t0 + 0.2);
      });
    } catch { /* no sound */ }
  }

  const shortsLink = (e) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} proper form #shorts`)}`;

  const img = (id, n) => `${BASE}exercises/img/${id}-${n}.jpg`;
  const groupName = (g) => lib?.groups.find((x) => x.id === g)?.name || g;
  const cap = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

  // Two photos (start and end position) shown in turn, like a GIF.
  function anim(id, cls = '') {
    return `<div class="ex-anim ${cls}"><img src="${img(id, 0)}" alt="" loading="lazy" decoding="async"><img src="${img(id, 1)}" alt="" loading="lazy" decoding="async"></div>`;
  }

  function defaultsFor(group, count) {
    return lib.exercises.filter((e) => e.group === group).slice(0, count)
      .map((e) => ({ id: e.id, sets: e.cardio ? 1 : 3, reps: e.cardio ? '15 min' : group === 'abs' ? '15' : '10-12' }));
  }

  function dayFromGroups(groups) {
    if (!groups.length) return null;
    const per = groups.length === 1 ? 6 : Math.max(2, Math.min(5, Math.floor(9 / groups.length)));
    return { groups, exercises: groups.flatMap((g) => defaultsFor(g, per)) };
  }

  const PRESETS = [
    { id: 'bro', name: 'Body-part split', note: '6 days · one or two muscles a day, the classic gym routine', days: { mon: ['chest'], tue: ['back'], wed: ['shoulders', 'traps'], thu: ['legs', 'calves'], fri: ['biceps', 'triceps'], sat: ['abs', 'cardio'] } },
    { id: 'ppl', name: 'Push · Pull · Legs', note: '6 days · push muscles, pull muscles, then legs, twice a week', days: { mon: ['chest', 'shoulders', 'triceps'], tue: ['back', 'biceps'], wed: ['legs', 'abs'], thu: ['chest', 'shoulders', 'triceps'], fri: ['back', 'biceps'], sat: ['legs', 'abs'] } },
    { id: 'ul', name: 'Upper · Lower', note: '4 days · upper body and lower body, with a cardio day', days: { mon: ['chest', 'back', 'shoulders'], tue: ['legs', 'calves', 'abs'], thu: ['chest', 'back', 'biceps', 'triceps'], fri: ['legs', 'abs'], sat: ['cardio'] } },
    { id: 'full', name: 'Full body · 3 days', note: 'Mon, Wed, Fri · good for beginners', days: { mon: ['chest', 'back', 'legs', 'shoulders'], wed: ['chest', 'back', 'legs', 'abs'], fri: ['chest', 'back', 'legs', 'biceps'] } },
    { id: 'loss', name: 'Fat loss', note: '5 days · full body strength with cardio every day', days: { mon: ['legs', 'cardio'], tue: ['chest', 'back', 'cardio'], wed: ['abs', 'cardio'], thu: ['shoulders', 'biceps', 'triceps', 'cardio'], sat: ['legs', 'abs', 'cardio'] } },
  ];

  function presetPlan(p) {
    return { days: Object.fromEntries(Object.entries(p.days).map(([d, g]) => [d, dayFromGroups(g)])) };
  }

  function dayLabel(day) {
    if (!day || !day.groups?.length) return day?.exercises?.length ? 'Custom' : 'Rest';
    return day.groups.map(groupName).join(' + ');
  }

  // ---- sheets ------------------------------------------------------------------

  function detailSheet(id, { sets, reps, onAdd, item: x0 } = {}) {
    const e = lib.byId[id];
    if (!e) return;
    sheet({
      label: e.name,
      wide: true,
      html: `<div class="sheet-head"><h3>${esc(e.name)}</h3><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
        ${player(e) || anim(e.id, 'big')}
        ${videos[e.id] ? '' : `<a class="btn btn-soft btn-block yt-link" href="${shortsLink(e)}" target="_blank" rel="noopener">${icon('tv')}Watch short videos of the right form</a>`}
        <div class="ex-tags"><span class="badge badge-accent">${esc(groupName(e.group))}</span><span class="badge badge-muted">${esc(cap(e.equipment))}</span>${e.level ? `<span class="badge badge-muted">${esc(cap(e.level))}</span>` : ''}${sets ? `<span class="badge badge-good">${sets} × ${esc(reps)}</span>` : ''}${sets && kcalOf(e, { sets, reps }) ? `<span class="badge badge-warn">${icon('flame')}≈ ${kcalOf(e, { sets, reps }).total} kcal · ${kcalOf(e, { sets, reps }).perSet} per ${e.cardio ? 'session' : 'set'}</span>` : ''}</div>
        ${!e.cardio ? `<div class="rest-tip">${icon('clock')}<span><b>Rest ${restText(restFor(e, { sets, reps, rest: x0?.rest }))} between sets.</b> Breathe and let the muscle recover, then do the next set. Heavy lifts need longer rest than small muscles.</span></div>` : ''}
        <p class="ex-muscles"><b>Works:</b> ${e.primary.map(cap).map(esc).join(', ')}${e.secondary.length ? ` <span class="muted">· also ${e.secondary.map(cap).map(esc).join(', ')}</span>` : ''}</p>
        <h4 class="ex-h">How to do it</h4>
        <ol class="ex-steps">${e.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        ${onAdd ? `<div class="sheet-actions"><select class="select" data-day aria-label="Day">${ORDER.map((d) => `<option value="${d}">${DAY_LABELS[d]}</option>`).join('')}</select><button class="btn btn-primary" data-add>${icon('plus')}Add to day</button></div>` : ''}`,
      onMount: (el, close) => el.querySelector('[data-add]')?.addEventListener('click', () => { onAdd(el.querySelector('[data-day]').value, e.id); close(); }),
    });
  }

  function editDaySheet(plan, dayKey, save) {
    const day = plan.days?.[dayKey] || { groups: [], exercises: [] };
    let groups = [...(day.groups || [])];
    const chosen = new Map((day.exercises || []).map((x) => [x.id, { ...x }]));
    sheet({
      title: `${DAY_LABELS[dayKey]} workout`,
      wide: true,
      html: `<p class="muted" style="margin-bottom:10px">Pick the muscles for this day. Leave all off for a rest day.</p>
        <div class="chips-wrap" data-groups>${lib.groups.map((g) => `<button type="button" class="chip" data-g="${g.id}" aria-pressed="${groups.includes(g.id)}">${esc(g.name)}</button>`).join('')}</div>
        <div data-list style="margin-top:16px"></div>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>${icon('check')}Save ${esc(DAY_LABELS[dayKey])}</button></div>`,
      onMount: (el, close) => {
        const list = el.querySelector('[data-list]');
        const draw = () => {
          if (!groups.length) { list.innerHTML = `<div class="rest-note">${icon('moon')}<span><b>Rest day.</b> Muscles grow while you recover.</span></div>`; return; }
          list.innerHTML = groups.map((g) => `<h4 class="ex-h">${esc(groupName(g))}</h4><div class="pick-ex">${lib.exercises.filter((e) => e.group === g).map((e) => {
            const c = chosen.get(e.id);
            return `<div class="pick-row${c ? ' on' : ''}"><label class="pick-main"><input type="checkbox" data-ex="${e.id}" ${c ? 'checked' : ''}>${anim(e.id, 'tiny')}<span><b>${esc(e.name)}</b><small>${esc(cap(e.equipment))}</small></span></label>
              ${c ? `<span class="setsreps"><input class="input" type="number" min="1" max="10" value="${c.sets}" data-sets="${e.id}" aria-label="Sets"><span>×</span><input class="input" value="${esc(c.reps)}" maxlength="12" data-reps="${e.id}" aria-label="Reps">
                ${e.cardio ? '' : `<select class="select rest-pick" data-rest="${e.id}" aria-label="Rest between sets"><option value="">Rest: ${restText(restFor(e, { reps: c.reps }))} (suggested)</option>${[30, 45, 60, 90, 120, 180].map((r) => `<option value="${r}" ${Number(c.rest) === r && c.rest != null ? 'selected' : ''}>Rest: ${restText(r)}</option>`).join('')}</select>`}</span>` : ''}</div>`;
          }).join('')}</div>`).join('');
          list.querySelectorAll('[data-ex]').forEach((cb) => cb.addEventListener('change', () => {
            const e = lib.byId[cb.dataset.ex];
            if (cb.checked) chosen.set(e.id, { id: e.id, sets: e.cardio ? 1 : 3, reps: e.cardio ? '15 min' : e.group === 'abs' ? '15' : '10-12' });
            else chosen.delete(e.id);
            draw();
          }));
          list.querySelectorAll('[data-sets]').forEach((i) => i.addEventListener('input', () => { chosen.get(i.dataset.sets).sets = Number(i.value) || 1; }));
          list.querySelectorAll('[data-reps]').forEach((i) => i.addEventListener('input', () => { chosen.get(i.dataset.reps).reps = i.value; }));
          list.querySelectorAll('[data-rest]').forEach((i) => i.addEventListener('change', () => {
            const c = chosen.get(i.dataset.rest);
            if (i.value === '') delete c.rest; else c.rest = Number(i.value);
          }));
        };
        el.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
          const g = b.dataset.g;
          if (groups.includes(g)) {
            groups = groups.filter((x) => x !== g);
            for (const [id] of chosen) if (lib.byId[id]?.group === g) chosen.delete(id);
          } else {
            groups.push(g);
            const per = groups.length === 1 ? 6 : Math.max(2, Math.min(5, Math.floor(9 / groups.length)));
            for (const x of defaultsFor(g, per)) chosen.set(x.id, x);
          }
          b.setAttribute('aria-pressed', groups.includes(g));
          draw();
        }));
        draw();
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          const exercises = [...chosen.values()].filter((x) => groups.includes(lib.byId[x.id]?.group));
          const days = { ...(plan.days || {}) };
          if (groups.length) days[dayKey] = { groups, exercises }; else delete days[dayKey];
          try { await save({ days }); close(); toast(`${DAY_LABELS[dayKey]} saved`); } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    });
  }

  function presetSheet(hasPlan, save) {
    sheet({
      title: 'Ready-made plans',
      wide: true,
      html: `<p class="muted" style="margin-bottom:12px">Start from a plan, then change any day the way you like.</p>
        <div class="preset-list">${PRESETS.map((p) => `<button class="card preset" data-preset="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.note)}</span>
          <span class="preset-week">${ORDER.map((d) => `<i class="${p.days[d] ? 'on' : ''}" title="${DAY_LABELS[d]}">${SHORT[d][0]}</i>`).join('')}</span></button>`).join('')}</div>`,
      onMount: (el, close) => el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', async () => {
        const p = PRESETS.find((x) => x.id === b.dataset.preset);
        if (hasPlan && !(await confirmSheet({ title: `Use "${p.name}"?`, message: 'This replaces the current weekly plan.', confirm: 'Use this plan' }))) return;
        try { await save(presetPlan(p)); close(); toast(`${p.name} plan set`); } catch (e) { toast(e.message, 'bad'); }
      })),
    });
  }

  // ---- views ---------------------------------------------------------------------

  function weekStrip(plan, selected, todayKey) {
    return `<div class="week-strip" role="tablist">${ORDER.map((d) => {
      const day = plan.days?.[d];
      return `<button class="wday${day ? '' : ' rest'}" role="tab" data-day="${d}" aria-selected="${d === selected}"><small>${SHORT[d]}${d === todayKey ? ' •' : ''}</small><b>${esc(day ? dayLabel(day).split(' + ').slice(0, 2).join(' + ') : 'Rest')}</b></button>`;
    }).join('')}</div>`;
  }

  function exerciseCard(x, { done, tickable } = {}) {
    const e = lib.byId[x.id];
    if (!e) return '';
    const k = kcalOf(e, x);
    return `<div class="card ex-card${done ? ' done' : ''}" data-open="${e.id}" role="button" tabindex="0">${anim(e.id)}
      <div class="ex-body"><b>${esc(e.name)}</b><span>${x.sets} ${x.sets === 1 ? 'set' : 'sets'} × ${esc(x.reps)}${/min|s$/.test(x.reps) ? '' : ' reps'}</span><small>${esc(groupName(e.group))} · ${esc(cap(e.equipment))}</small>
        ${k ? `<span class="kcal">${icon('flame')}≈ ${k.total} kcal${x.sets > 1 ? ` · ${k.perSet} per set` : ''}</span>` : ''}${videos[e.id] ? `<span class="has-video">${icon('tv')}Video</span>` : ''}
        ${!e.cardio && x.sets > 1 ? `<span class="rest-line">${icon('clock')}Rest ${restText(restFor(e, x))} after each set</span>` : ''}
        ${tickable && !done && !e.cardio ? `<button class="set-btn" data-set="${e.id}">${icon('check')}<span>Set <b data-setno>${Math.min((setsDone[e.id] || 0) + 1, x.sets)}</b> of ${x.sets} done</span></button>` : ''}</div>
      ${tickable ? `<label class="tick" aria-label="Done"><input type="checkbox" data-tick="${e.id}" ${done ? 'checked' : ''}><span>${icon('check')}</span></label>` : ''}</div>`;
  }

  /**
   * ctx: { plan, log (ids done today), todayKey, todayDate, save(plan), tick(date, ids), selected, onSelect(day) }
   */
  // Sets finished today, kept on this phone.
  let setsDone = {};
  async function planView(root, ctx) {
    await library();
    if (ctx.kg) kg = ctx.kg;
    if (ctx.goal) goal = ctx.goal;
    setsDone = UI.store.get(`setsDone|${ctx.todayDate}`, {});
    const plan = ctx.plan || { days: {} };
    const has = Object.keys(plan.days || {}).length > 0;
    const selected = ctx.selected || ctx.todayKey;
    if (!has) {
      root.innerHTML = `<div class="empty"><div class="empty-icon">${icon('dumbbell')}</div><h3>Plan your week</h3><p>Choose which muscles you train each day. Every exercise comes with photos showing how to do it.</p></div>
        <div class="pad" style="display:grid;gap:10px"><button class="btn btn-primary btn-block" data-presets>${icon('star')}Pick a ready-made plan</button><button class="btn btn-ghost btn-block" data-build>${icon('edit')}Build my own, day by day</button></div>`;
      root.querySelector('[data-presets]').addEventListener('click', () => presetSheet(false, ctx.save));
      root.querySelector('[data-build]').addEventListener('click', () => editDaySheet(plan, ctx.todayKey, ctx.save));
      return;
    }
    const day = plan.days[selected];
    const isToday = selected === ctx.todayKey;
    const done = new Set(isToday ? ctx.log || [] : []);
    const list = day?.exercises || [];
    const doneCount = list.filter((x) => done.has(x.id)).length;
    root.innerHTML = `${weekStrip(plan, selected, ctx.todayKey)}
      <div class="card day-card"><div class="day-top"><div><small>${isToday ? 'Today · ' : ''}${DAY_LABELS[selected]}</small><h2>${esc(dayLabel(day))}</h2></div><button class="btn btn-ghost btn-sm" data-edit>${icon('edit')}Edit</button></div>
        ${day && isToday && list.length ? `<div class="day-progress"><div class="progress-track"><i style="width:${Math.round((doneCount / list.length) * 100)}%"></i></div><span>${doneCount}/${list.length} done</span></div>` : ''}
        ${day ? `<p class="muted" style="font-size:13px">${list.length} exercise${list.length === 1 ? '' : 's'} · about ${Math.max(20, list.reduce((a, x) => a + (lib.byId[x.id]?.cardio ? 15 : x.sets * 3), 0))} min</p>` : ''}
        ${day && list.length && window.Nutrition ? (() => {
          const all = Nutrition.dayBurn(day, lib.byId, kg);
          const doneKcal = isToday ? Nutrition.dayBurn({ exercises: list.filter((x) => done.has(x.id)) }, lib.byId, kg).kcal : null;
          return `<div class="day-burn">${icon('flame')}<div><b>≈ ${all.kcal} kcal</b> if you do the whole workout${doneKcal != null ? ` · <span data-burned>${doneKcal}</span> kcal done so far` : ''}<small>Estimate for ${kg} kg body weight${ctx.kgKnown ? '' : ' · add your weight in Diet'}</small></div></div>`;
        })() : ''}</div>
      ${day ? `<div class="ex-list">${list.map((x) => exerciseCard(x, { done: done.has(x.id), tickable: isToday })).join('')}</div>`
        : `<div class="rest-note big">${icon('moon')}<span><b>Rest day.</b> Sleep well, eat well, and come back stronger. <button class="link" data-edit>Add a workout</button></span></div>`}
      <div class="plan-foot"><button class="link" data-presets>${icon('star')} Change to a ready-made plan</button><a class="link" href="#/workout/library">${icon('search')} Browse all ${lib.exercises.length} exercises</a></div>
      <p class="credit">Exercise photos: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> (public domain)</p>`;
    root.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => ctx.onSelect(b.dataset.day)));
    root.querySelector(`[data-day="${selected}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editDaySheet(plan, selected, ctx.save)));
    root.querySelector('[data-presets]').addEventListener('click', () => presetSheet(true, ctx.save));
    root.querySelectorAll('[data-open]').forEach((c) => {
      const open = (ev) => {
        if (ev.target.closest('.tick')) return;
        if (ev.target.closest('.set-btn')) return;
        const x = list.find((y) => y.id === c.dataset.open);
        detailSheet(c.dataset.open, { sets: x?.sets, reps: x?.reps, item: x });
      };
      c.addEventListener('click', open);
      c.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') open(ev); });
    });
    // "Set done": count it and start the rest timer; after the last set the exercise is ticked.
    root.querySelectorAll('[data-set]').forEach((btn) => btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const x = list.find((y) => y.id === btn.dataset.set);
      const e = lib.byId[x.id];
      const n = (setsDone[x.id] || 0) + 1;
      setsDone[x.id] = n;
      UI.store.set(`setsDone|${ctx.todayDate}`, setsDone);
      if (n >= x.sets) {
        stopRest();
        const cb = root.querySelector(`[data-tick="${x.id}"]`);
        if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
        btn.remove();
        const next = list.find((y) => !done.has(y.id) && y.id !== x.id);
        const rest = restFor(e, x);
        if (next && rest) startRest(rest, `Next: ${lib.byId[next.id]?.name || 'next exercise'}`);
        return;
      }
      btn.querySelector('[data-setno]').textContent = n + 1;
      const rest = restFor(e, x);
      if (rest) startRest(rest, `Then set ${n + 1} of ${x.sets}`);
    }));
    root.querySelectorAll('[data-tick]').forEach((cb) => cb.addEventListener('change', async () => {
      if (cb.checked) done.add(cb.dataset.tick); else done.delete(cb.dataset.tick);
      cb.closest('.ex-card').classList.toggle('done', cb.checked);
      const n = list.filter((x) => done.has(x.id)).length;
      const bar = root.querySelector('.day-progress');
      if (bar) { bar.querySelector('i').style.width = `${Math.round((n / list.length) * 100)}%`; bar.querySelector('span').textContent = `${n}/${list.length} done`; }
      if (n === list.length) toast('Workout complete! 💪');
      const burned = root.querySelector('[data-burned]');
      if (burned) burned.textContent = Nutrition.dayBurn({ exercises: list.filter((x) => done.has(x.id)) }, lib.byId, kg).kcal;
      try { await ctx.tick(ctx.todayDate, [...done]); } catch (e) { toast(e.message, 'bad'); }
    }));
  }

  async function libraryView(root, { group = 'all', onAdd } = {}) {
    await library();
    root.innerHTML = `<div class="chips" role="group" aria-label="Muscle">${[{ id: 'all', name: 'All' }, ...lib.groups].map((g) => `<button class="chip" data-g="${g.id}" aria-pressed="${g.id === group}">${esc(g.name)}</button>`).join('')}</div>
      <div class="search input-group">${icon('search')}<input class="input" type="search" placeholder="Search exercises" data-q aria-label="Search exercises"></div>
      <div class="ex-grid" data-grid></div>
      <p class="credit">Exercise photos: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> (public domain)</p>`;
    let current = group;
    const q = root.querySelector('[data-q]');
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      const items = lib.exercises.filter((e) => (current === 'all' || e.group === current) && (!t || e.name.toLowerCase().includes(t)));
      root.querySelector('[data-grid]').innerHTML = items.map((e) => `<button class="card ex-tile" data-open="${e.id}">${anim(e.id)}<b>${esc(e.name)}</b><small>${esc(groupName(e.group))} · ${esc(cap(e.equipment))}</small></button>`).join('') || '<p class="muted pad">No exercise found.</p>';
      root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => detailSheet(b.dataset.open, { onAdd })));
    };
    root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
      current = b.dataset.g;
      root.querySelectorAll('[data-g]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      draw();
    }));
    q.addEventListener('input', draw);
    draw();
  }

  // A one-glance summary of a member's week for the dashboard.
  async function summary(plan) {
    await library();
    const days = plan?.days || {};
    if (!Object.keys(days).length) return '';
    return `<div class="week-summary">${ORDER.map((d) => `<div class="${days[d] ? '' : 'rest'}"><small>${SHORT[d]}</small><b>${esc(days[d] ? dayLabel(days[d]) : 'Rest')}</b>${days[d] ? `<span>${days[d].exercises.length} exercises</span>` : ''}</div>`).join('')}</div>`;
  }

  // Adds one exercise to a day, creating the day if it was a rest day.
  function addToDay(plan, dayKey, id) {
    const e = lib.byId[id];
    const days = JSON.parse(JSON.stringify(plan?.days || {}));
    const day = days[dayKey] || { groups: [], exercises: [] };
    if (!day.groups.includes(e.group)) day.groups.push(e.group);
    if (!day.exercises.some((x) => x.id === id)) day.exercises.push({ id, sets: e.cardio ? 1 : 3, reps: e.cardio ? '15 min' : e.group === 'abs' ? '15' : '10-12' });
    days[dayKey] = day;
    return { days };
  }

  window.Workout = { library, planView, libraryView, presetSheet, editDaySheet, summary, addToDay, dayLabel, ORDER, detailSheet, setVideo, videoOf, anim, groupName, restFor, restText };
})();
