// Member app: membership card, fee status, attendance, progress and class booking.
(function () {
  const { esc, api: rawApi, money, time12, dateLong, dateShort, dayName, dayNum, addDays, weekday, initials, toast, sheet, confirmSheet, busy, store, DAYS, DAY_LABELS } = UI;

  const view = document.getElementById('view');
  const tabbar = document.getElementById('tabbar');
  const state = { gym: null, me: null, token: store.get('memberToken', null) };
  const rs = (n) => money(n, { zero: null });
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fmtMinutes = (m) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  const monthLabel = (key, long = false) => new Intl.DateTimeFormat('en-GB', { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit', timeZone: 'UTC' }).format(new Date(`${key}-15T12:00:00Z`));
  const shiftMonth = (key, n) => { const d = new Date(`${key}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };

  const api = (path, opts = {}) => rawApi(path, { ...opts, token: state.token }).catch((e) => {
    if (e.status === 401 && state.token) { logout(true); }
    throw e;
  });

  function nowHere() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: state.gym.business.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: +parts.hour * 60 + +parts.minute };
  }
  const today = () => nowHere().date;

  function emptyState(ic, title, text, action = '') {
    return `<div class="empty"><div class="empty-icon">${icon(ic)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
  }

  function render(html, { tabs = true } = {}) {
    view.innerHTML = `<div class="view">${html}</div>`;
    view.classList.toggle('no-tabs', !tabs);
    tabbar.hidden = !tabs;
    renderTabs();
  }

  function renderTabs() {
    const route = (location.hash.split('?')[0] || '#/').replace('#/workout/library', '#/workout');
    const tabs = state.token
      ? [['#/', 'home', 'Home'], ['#/workout', 'dumbbell', 'Workout'], ['#/classes', 'calendar', 'Classes'], ['#/progress', 'activity', 'Progress'], ['#/profile', 'user', 'Profile']]
      : [['#/', 'home', 'Home'], ['#/classes', 'calendar', 'Classes'], ['#/login', 'lock', 'Member login']];
    tabbar.innerHTML = tabs.map(([href, ic, label]) => `<a class="tab" href="${href}" ${route === href ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('');
  }

  function statusText(s) {
    return {
      active: `Active · ${s.daysLeft} days left`,
      expiring: s.daysLeft === 0 ? 'Expires today' : `Expires in ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'}`,
      expired: `Expired ${-s.daysLeft} day${s.daysLeft === -1 ? '' : 's'} ago`,
      unpaid: 'Fee not paid',
      frozen: `Frozen till ${s.frozen ? dateShort(s.frozen.to) : ''}`,
      left: 'Inactive',
    }[s.status];
  }

  function hoursFor(date) {
    const b = state.gym.business;
    if ((b.closedDates || []).includes(date)) return [];
    return b.hours[DAYS[weekday(date)]] || [];
  }

  function openStatus() {
    const n = nowHere();
    const cur = hoursFor(n.date).find(([a, z]) => n.minutes >= toMin(a) && n.minutes < toMin(z));
    if (cur) return { open: true, text: `Open now · until ${time12(cur[1])}` };
    const later = hoursFor(n.date).find(([a]) => toMin(a) > n.minutes);
    if (later) return { open: false, text: `Closed · opens ${time12(later[0])}` };
    for (let i = 1; i <= 7; i++) {
      const h = hoursFor(addDays(n.date, i));
      if (h.length) return { open: false, text: `Closed · opens ${i === 1 ? 'tomorrow' : dayName(addDays(n.date, i))} ${time12(h[0][0])}` };
    }
    return { open: false, text: 'Closed' };
  }

  function topbar() {
    const b = state.gym.business;
    const st = openStatus();
    return `<header class="topbar"><div class="brand-mark" aria-hidden="true">${esc(b.name.charAt(0))}</div>
      <div class="brand-text"><h1>${esc(b.name)}</h1><span class="open-status ${st.open ? 'open' : 'closed'}"><i class="dot"></i>${esc(st.text)}</span></div>
      ${b.phone ? `<a class="icon-btn" href="tel:${esc(b.phone)}" aria-label="Call ${esc(b.name)}">${icon('phone')}</a>` : ''}</header>`;
  }

  // ---- public home ------------------------------------------------------------

  function publicHome() {
    const { business: b, plans, staff } = state.gym;
    render(`${topbar()}
      <section class="hero"><div class="hero-eyebrow">Welcome 👋</div><h2>${esc(b.tagline || 'Train with us')}</h2>
        <p>Members: sign in to see your fee status, attendance and progress, and book classes.</p>
        <a class="btn" href="#/login">${icon('lock')}Member login</a>
        <div class="hero-stats"><div><b>${plans.length}</b>Plans</div><div><b>${state.gym.classes.length}</b>Classes / week</div><div><b>${staff.length}</b>Coaches</div></div></section>
      ${plans.length ? `<section class="section"><div class="section-head"><h2>Memberships</h2></div><div class="scroller">${plans.map(planCard).join('')}</div></section>` : ''}
      <section class="section"><div class="section-head"><h2>Not a member yet?</h2></div>
        <div class="card box"><p style="color:var(--ink-2);font-size:14.5px">Leave your number and we'll call you to book a free trial.</p><button class="btn btn-primary btn-block" style="margin-top:14px" data-join>${icon('userPlus')}I want to join</button></div></section>
      <section class="section"><div class="section-head"><h2>Coaches</h2></div><div class="scroller">${staff.map((m) => `<div class="card team-card"><span class="avatar lg" style="--c:${esc(m.color)}">${esc(initials(m.name))}</span><h3>${esc(m.name)}</h3><p>${esc(m.role)}</p></div>`).join('')}</div></section>
      <section class="section"><div class="section-head"><h2>Visit us</h2></div>${infoCard()}</section>
      <div class="footer">© ${new Date().getFullYear()} ${esc(b.name)} · <a href="/admin.html">Gym staff</a></div>`);
    view.querySelector('[data-join]').addEventListener('click', joinSheet);
  }

  function planCard(p) {
    const b = state.gym.business;
    const perMonth = Math.round(p.price / p.months);
    return `<div class="card plan${p.highlight ? ' highlight' : ''}"><h3>${esc(p.name)}${p.highlight ? ' <span class="badge badge-accent">Best value</span>' : ''}</h3>
      <div class="price tnum">${rs(p.price)}</div><div class="muted">${p.months} month${p.months > 1 ? 's' : ''}${p.months > 1 ? ` · ${rs(perMonth)}/month` : ''}</div>
      <ul>${p.features.map((f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul>
      ${b.whatsapp ? `<a class="btn btn-ghost btn-block" href="${UI.waLink(b.whatsapp, `Hi ${b.name}! I'd like to know more about the ${p.name} plan (${rs(p.price)}).`)}" target="_blank" rel="noopener">${icon('whatsapp')}Ask on WhatsApp</a>` : ''}</div>`;
  }

  function infoCard() {
    const b = state.gym.business;
    const t = DAYS[weekday(today())];
    return `<div class="card info-card">
      ${b.address ? `<a class="info-row" href="${esc(b.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(b.address)}`)}" target="_blank" rel="noopener"><span class="ic">${icon('pin')}</span><span class="tx"><b>Address</b><span>${esc(b.address)}</span></span>${icon('external', 'muted')}</a>` : ''}
      <div class="info-row" style="align-items:flex-start"><span class="ic">${icon('clock')}</span><div class="tx"><b>Opening hours</b><table class="hours">${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => `<tr class="${d === t ? 'today' : ''}"><td>${DAY_LABELS[d]}</td><td>${(b.hours[d] || []).map(([a, z]) => `${time12(a)} – ${time12(z)}`).join('<br>') || 'Closed'}</td></tr>`).join('')}</table></div></div>
      ${b.phone ? `<a class="info-row" href="tel:${esc(b.phone)}"><span class="ic">${icon('phone')}</span><span class="tx"><b>Call</b><span>${esc(b.phone)}</span></span>${icon('chevronRight', 'muted')}</a>` : ''}
      ${b.whatsapp ? `<a class="info-row" href="${UI.waLink(b.whatsapp, `Hi ${b.name}!`)}" target="_blank" rel="noopener"><span class="ic">${icon('whatsapp')}</span><span class="tx"><b>WhatsApp</b><span>Chat with the front desk</span></span>${icon('chevronRight', 'muted')}</a>` : ''}
      ${b.instagram ? `<a class="info-row" href="https://instagram.com/${esc(b.instagram)}" target="_blank" rel="noopener"><span class="ic">${icon('instagram')}</span><span class="tx"><b>Instagram</b><span>@${esc(b.instagram)}</span></span>${icon('external', 'muted')}</a>` : ''}
    </div>`;
  }

  function joinSheet() {
    sheet({
      title: 'Join the gym',
      html: `<form class="form" style="padding:0" novalidate>
        <label class="field"><span>Your name</span><input class="input" name="name" maxlength="60" autocomplete="name"></label>
        <label class="field"><span>Mobile number</span><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="03xx xxxxxxx"></label>
        <label class="field"><span>Interested in</span><select class="select" name="interest">${state.gym.plans.map((p) => `<option>${esc(p.name)}</option>`).join('')}<option value="">Not sure yet</option></select></label>
        <label class="field"><span>Message</span><textarea class="textarea" name="message" maxlength="300" placeholder="Best time to call, questions…"></textarea></label></form>
        <div class="sheet-actions"><button class="btn btn-primary" data-ok>Send</button></div>`,
      onMount: (el, close) => {
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          try {
            await rawApi('/api/leads', { method: 'POST', body: Object.fromEntries(new FormData(el.querySelector('form'))) });
            close();
            toast("Thanks! We'll call you soon.");
          } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    });
  }

  // ---- login ------------------------------------------------------------------

  function loginView() {
    const b = state.gym.business;
    render(`<div class="login-wrap"><div class="brand-mark" style="display:grid">${esc(b.name.charAt(0))}</div><h1>Member login</h1><p>Use your member number (or mobile) and the PIN the gym sent you.</p>
      <form class="form" style="padding:0" novalidate>
        <label class="field"><span>Member number or mobile</span><input class="input" name="id" inputmode="numeric" autocomplete="username" value="${esc(store.get('lastMemberId', ''))}" placeholder="e.g. 1001"></label>
        <label class="field"><span>PIN</span><input class="input pin-input" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" placeholder="••••"></label>
        <button class="btn btn-primary btn-block">${icon('lock')}Sign in</button>
      </form>
      <p class="muted" style="text-align:center;margin-top:18px;font-size:13.5px">Forgot your PIN? Ask the front desk to reset it.<br>Demo: member <b>1001</b>, PIN <b>1111</b></p></div>`);
    const f = view.querySelector('form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(f.querySelector('button'), async () => {
        try {
          const { token } = await rawApi('/api/member/login', { method: 'POST', body: { id: f.id.value, pin: f.pin.value } });
          state.token = token;
          store.set('memberToken', token);
          store.set('lastMemberId', f.id.value);
          state.me = null;
          location.hash = '#/';
          route();
        } catch (err) { toast(err.message, 'bad'); f.pin.value = ''; }
      });
    });
  }

  function logout(expired) {
    if (!expired && state.token) rawApi('/api/member/logout', { method: 'POST', token: state.token }).catch(() => {});
    state.token = null;
    state.me = null;
    store.remove('memberToken');
    if (expired) toast('Please sign in again', 'bad');
    location.hash = '#/';
    route();
  }

  async function me(force) {
    if (!state.me || force) state.me = await api('/api/member/me');
    return state.me;
  }

  // ---- member home --------------------------------------------------------------

  async function memberHome() {
    render(`${topbar()}<div class="boot"><div class="skel" style="height:200px;border-radius:26px"></div><div class="skel" style="height:90px"></div></div>`);
    const d = await me(true);
    const m = d.member;
    const s = d.summary;
    const b = state.gym.business;
    const periodLen = d.payments[0] ? (Date.parse(d.payments[0].periodEnd) - Date.parse(d.payments[0].periodStart)) / 864e5 + 1 : 30;
    const pct = s.daysLeft == null || s.daysLeft < 0 ? 0 : Math.min(100, Math.round((s.daysLeft / periodLen) * 100));
    const dead = ['expired', 'unpaid', 'left'].includes(s.status);
    const nextClass = d.bookings.find((x) => x.status === 'booked');
    const h = Math.floor(nowHere().minutes / 60);
    render(`${topbar()}
      <div class="pad" style="margin-top:6px"><p class="muted" style="font-weight:600">${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${esc(m.name.split(' ')[0])} 💪</p></div>
      <section class="member-card${dead ? ' expired' : ''}">
        <div class="mc-head"><a href="#/profile" aria-label="Your photo" class="mc-photo">${UI.avatarHtml(m, 'lg', '#ffffff')}</a><div class="mc-id"><small>${esc(b.name)} member</small><h2>${esc(m.name)}</h2><div class="mc-no">No. ${m.memberNo}</div></div></div>
        <span class="mc-pill mc-status">${esc(statusText(s))}</span>
        <div class="mc-body"><div class="ring" style="--p:${pct}"><div><b>${s.daysLeft == null ? '—' : Math.max(0, s.daysLeft)}</b><span>days left</span></div></div>
          <div class="mc-info"><div><span>Plan</span><b>${esc(s.plan?.name || 'No plan yet')}</b></div><div><span>${s.status === 'expired' ? 'Expired on' : 'Valid till'}</span><b>${s.expiry ? dateLong(s.expiry) : '—'}</b></div></div></div>
      </section>
      ${dead ? `<div class="alert-card bad">${icon('alert')}<span class="tx">${s.status === 'unpaid' ? 'Your fee is not paid yet.' : 'Your membership has ended.'} Renew at the front desk to keep training.</span>${b.whatsapp ? `<a class="btn btn-primary btn-sm" href="${UI.waLink(b.whatsapp, `Hi! I'm ${m.name} (member ${m.memberNo}). I want to renew my membership.`)}" target="_blank" rel="noopener">Renew</a>` : ''}</div>` : ''}
      ${s.status === 'expiring' ? `<div class="alert-card warn">${icon('clock')}<span class="tx">Only ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left. Renew before ${dateShort(s.expiry)} so your training doesn't stop.</span></div>` : ''}
      ${s.balance > 0 ? `<div class="alert-card bad">${icon('wallet')}<span class="tx"><b>${rs(s.balance)}</b> is still pending on your fee.</span><a class="btn btn-ghost btn-sm" href="#/fees">Details</a></div>` : ''}
      <section class="section"><div class="section-head"><h2>Workout</h2><a class="link" href="#/workout">My plan</a></div><div id="today-workout"><div class="skel" style="height:96px;margin:0 20px;border-radius:22px"></div></div></section>
      <section class="section"><div class="section-head"><h2>This month</h2><a class="link" href="#/progress">See all</a></div>
        <div class="mini-stats"><div class="stat"><span>Visits</span><b>${s.visitsThisMonth}</b></div><div class="stat"><span>Avg. workout</span><b>${fmtMinutes(s.avgMinutes)}</b></div><div class="stat"><span>Last visit</span><b>${s.lastVisit ? (s.daysSinceVisit === 0 ? 'Today' : `${s.daysSinceVisit}d ago`) : '—'}</b></div></div></section>
      ${s.inside ? `<div class="alert-card" style="background:var(--good-soft)">${icon('login')}<span class="tx">You're checked in. Have a great workout!</span></div>` : ''}
      <section class="section"><div class="section-head"><h2>Next class</h2><a class="link" href="#/classes">Timetable</a></div>
        ${nextClass ? `<div class="card next-card" style="cursor:default"><div class="date-tile"><b>${dayNum(nextClass.date)}</b><span>${dayName(nextClass.date)}</span></div><div class="meta"><small>Booked</small><h3>${esc(nextClass.className)}</h3><p>${time12(nextClass.start)} – ${time12(nextClass.end)}</p></div></div>`
          : `<div class="card box"><p class="muted">No class booked. Grab a spot in HIIT, yoga or strength.</p><a class="btn btn-soft btn-sm" style="margin-top:12px" href="#/classes">Book a class</a></div>`}</section>
      <section class="section"><div class="section-head"><h2>Check-in</h2></div><div class="card box" style="text-align:center"><p class="muted" style="font-size:14px">Tell the front desk or type at the kiosk:</p><div style="font-size:40px;font-weight:800;letter-spacing:.12em;margin-top:6px">${m.memberNo}</div></div></section>
      <div class="footer">${esc(b.name)} · <a href="#/fees">Fees & receipts</a> · <a href="#/profile">Contact & hours</a></div>`);
    todayWorkoutCard(d).then((html) => { const el = document.getElementById('today-workout'); if (el) el.innerHTML = html; }).catch(() => {});
  }

  // ---- classes ----------------------------------------------------------------

  async function classesView(params) {
    const t = today();
    const windowDays = state.gym.business.bookingWindowDays || 7;
    const days = Array.from({ length: windowDays }, (_, i) => addDays(t, i));
    let date = days.includes(params.get('date')) ? params.get('date') : t;
    render(`<div class="page-title"><h1>Classes</h1><p>${state.token ? 'Book your spot. Spaces are limited.' : 'Members can book from the app.'}</p></div>
      <div class="section" style="margin-top:18px"><div class="dates" id="dates" role="group" aria-label="Date">${days.map((x) => `<button class="date-btn" data-date="${x}" aria-pressed="${x === date}" aria-label="${dateLong(x)}"><small>${x === t ? 'Today' : dayName(x)}</small><b>${dayNum(x)}</b><i></i></button>`).join('')}</div></div>
      <div id="class-list" class="bk-list"></div>`);
    const listEl = document.getElementById('class-list');
    const draw = async () => {
      listEl.innerHTML = Array.from({ length: 3 }, () => '<div class="skel" style="height:140px;border-radius:22px"></div>').join('');
      const current = date;
      const [list, mine] = await Promise.all([rawApi(`/api/classes?date=${date}`), state.token ? me(true).catch(() => null) : null]);
      if (current !== date) return;
      if (!list.length) { listEl.innerHTML = emptyState('calendar', 'No classes', `Nothing scheduled on ${dateLong(date)}.`); return; }
      const staff = (id) => state.gym.staff.find((x) => x.id === id);
      listEl.innerHTML = list.map((c) => {
        const booked = mine?.bookings.find((b) => b.classId === c.id && b.date === date && b.status === 'booked');
        let action;
        if (booked) action = `<button class="btn btn-soft btn-sm" data-cancel="${esc(booked.id)}">${icon('check')}Booked · cancel</button>`;
        else if (c.started) action = '<span class="badge badge-muted">Started</span>';
        else if (!c.spotsLeft) action = '<span class="badge badge-bad">Full</span>';
        else if (!state.token) action = '<a class="btn btn-ghost btn-sm" href="#/login">Log in to book</a>';
        else action = `<button class="btn btn-primary btn-sm" data-book="${esc(c.id)}">Book spot</button>`;
        const pctFull = Math.round((c.booked / c.capacity) * 100);
        const coach = staff(c.staffId);
        return `<div class="card class-row"><div class="class-time"><b>${time12(c.start).replace(' ', '<br>')}</b><span>${c.duration} min</span></div>
          <div class="class-body"><h3>${esc(c.name)}</h3><div class="sub">${coach ? `${esc(coach.name)} · ` : ''}${esc(c.level || '')}</div>
            <div class="spots${c.spotsLeft && c.spotsLeft <= 2 ? ' low' : ''}"><div class="spots-bar"><i style="width:${pctFull}%"></i></div><div class="spots-text"><span>${c.booked}/${c.capacity} booked</span><b>${c.spotsLeft ? `${c.spotsLeft} left` : 'Full'}</b></div></div>
            <div class="class-actions"><span></span>${action}</div></div></div>`;
      }).join('');
      listEl.querySelectorAll('[data-book]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
        try { await api('/api/member/classes', { method: 'POST', body: { classId: b.dataset.book, date } }); toast("You're booked!"); draw(); } catch (e) { toast(e.message, 'bad'); }
      })));
      listEl.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmSheet({ title: 'Cancel your spot?', message: 'Someone else can take it.', confirm: 'Cancel spot', danger: true }))) return;
        try { await api(`/api/member/classes/${b.dataset.cancel}/cancel`, { method: 'POST' }); toast('Cancelled'); draw(); } catch (e) { toast(e.message, 'bad'); }
      }));
    };
    document.querySelectorAll('#dates [data-date]').forEach((b) => b.addEventListener('click', () => {
      date = b.dataset.date;
      document.querySelectorAll('#dates [data-date]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      history.replaceState(null, '', `#/classes?date=${date}`);
      draw();
    }));
    draw();
  }

  // ---- workout plan ---------------------------------------------------------------

  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayKey = () => DAY_KEYS[weekday(today())];

  const savePlan = async (plan) => {
    const saved = await api('/api/member/plan', { method: 'PUT', body: plan });
    state.me.member.workoutPlan = saved;
    route();
  };
  const tick = async (date, done) => {
    await api('/api/member/workout-log', { method: 'PUT', body: { date, done } });
    state.me.member.workoutLog = { ...(state.me.member.workoutLog || {}), [date]: done };
  };

  async function workoutView(params) {
    const d = await me();
    render(`<div class="page-title"><h1>My workout</h1><p>Your weekly plan. Tap an exercise to see how it's done.</p></div><div id="wk" style="margin-top:14px"><div class="boot"><div class="skel" style="height:300px;border-radius:22px"></div></div></div>`);
    await Workout.planView(document.getElementById('wk'), {
      plan: d.member.workoutPlan,
      log: d.member.workoutLog?.[today()] || [],
      todayKey: todayKey(),
      todayDate: today(),
      selected: params.get('day'),
      onSelect: (day) => { history.replaceState(null, '', `#/workout?day=${day}`); workoutView(new URLSearchParams({ day })); },
      save: savePlan,
      tick,
    });
  }

  async function libraryPage(params) {
    const d = await me();
    render(`<header class="page-head"><a class="icon-btn" href="#/workout" aria-label="Back">${icon('chevronLeft')}</a><h1>Exercises</h1></header><div id="lib"></div>`);
    await Workout.libraryView(document.getElementById('lib'), {
      group: params.get('g') || 'all',
      onAdd: async (day, id) => {
        try {
          const plan = Workout.addToDay(d.member.workoutPlan, day, id);
          const saved = await api('/api/member/plan', { method: 'PUT', body: plan });
          state.me.member.workoutPlan = saved;
          toast(`Added to ${DAY_LABELS[day]}`);
        } catch (e) { toast(e.message, 'bad'); }
      },
    });
  }

  async function todayWorkoutCard(d) {
    const plan = d.member.workoutPlan;
    if (!plan || !Object.keys(plan.days || {}).length) {
      return `<a class="card today-workout" href="#/workout"><div class="empty-icon" style="width:56px;height:56px;margin:0;border-radius:18px">${icon('dumbbell')}</div><div class="tx"><small>Workout</small><h3>Make your weekly plan</h3><p>Chest on Monday, back on Tuesday… with photos of every exercise.</p></div>${icon('chevronRight', 'muted')}</a>`;
    }
    const lib = await Workout.library();
    const day = plan.days[todayKey()];
    if (!day) return `<a class="card today-workout" href="#/workout"><div class="empty-icon" style="width:56px;height:56px;margin:0;border-radius:18px">${icon('moon')}</div><div class="tx"><small>Today</small><h3>Rest day</h3><p>Recover well. Tap to see the rest of your week.</p></div>${icon('chevronRight', 'muted')}</a>`;
    const done = (d.member.workoutLog?.[today()] || []).length;
    const first = day.exercises.find((x) => lib.byId[x.id]);
    return `<a class="card today-workout" href="#/workout">${first ? `<div class="ex-anim"><img src="${window.APP_CONFIG?.demo ? '' : '/'}exercises/img/${first.id}-0.jpg" alt=""><img src="${window.APP_CONFIG?.demo ? '' : '/'}exercises/img/${first.id}-1.jpg" alt=""></div>` : ''}
      <div class="tx"><small>Today's workout</small><h3>${esc(Workout.dayLabel(day))}</h3><p>${day.exercises.length} exercises${done ? ` · ${Math.min(done, day.exercises.length)} done` : ''}</p></div>${icon('chevronRight', 'muted')}</a>`;
  }

  // ---- progress -----------------------------------------------------------------

  async function progressView(params) {
    const d = await me();
    const s = d.summary;
    const month = params.get('m') || today().slice(0, 7);
    const visits = new Map(d.attendance.filter((a) => a.date.startsWith(month)).map((a) => [a.date, a]));
    const first = `${month}-01`;
    const offset = (weekday(first) + 6) % 7;
    const count = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
    const t = today();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push('<div class="day blank"></div>');
    for (let i = 1; i <= count; i++) {
      const date = `${month}-${String(i).padStart(2, '0')}`;
      cells.push(`<div class="day ${visits.has(date) ? 'came' : ''} ${date === t ? 'today' : ''} ${date > t ? 'out' : ''}">${i}</div>`);
    }
    const meas = d.measurements;
    const last = meas[meas.length - 1];
    const firstM = meas[0];
    const delta = (k) => (last && firstM && meas.length > 1 && last[k] != null && firstM[k] != null ? Math.round((last[k] - firstM[k]) * 10) / 10 : null);
    render(`<div class="page-title"><h1>My progress</h1><p>Member for ${s.monthsMember} month${s.monthsMember === 1 ? '' : 's'} · since ${dateLong(d.member.joinDate)}</p></div>
      <div class="mini-stats" style="margin-top:16px"><div class="stat"><span>Total visits</span><b>${s.totalVisits}</b></div><div class="stat"><span>Months came</span><b>${s.monthsAttended}/${s.monthsMember}</b></div><div class="stat"><span>Months missed</span><b>${s.monthsMissed}</b></div></div>
      <section class="section"><div class="card box"><div class="cal-head"><a class="icon-btn" href="#/progress?m=${shiftMonth(month, -1)}" aria-label="Previous month">${icon('chevronLeft')}</a><b>${monthLabel(month, true)} · ${visits.size} visit${visits.size === 1 ? '' : 's'}</b>${month < t.slice(0, 7) ? `<a class="icon-btn" href="#/progress?m=${shiftMonth(month, 1)}" aria-label="Next month">${icon('chevronRight')}</a>` : '<span style="width:42px"></span>'}</div>
        <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="dow">${x}</div>`).join('')}${cells.join('')}</div></div></section>
      <section class="section"><div class="section-head"><h2>Month by month</h2></div><div class="card box"><div class="months">${s.months.slice().reverse().map((x) => {
        const cls = x.frozen ? 'frozen' : x.paid ? (x.visits ? 'paid-came' : 'paid-missed') : x.visits ? 'unpaid-came' : 'gap';
        return `<div class="month ${cls}"><b>${monthLabel(x.month)}</b><span>${x.frozen ? 'Frozen' : `${x.visits} visits`}</span></div>`;
      }).join('')}</div>
      <div class="month-legend"><span><i style="background:var(--good-soft);border:1.5px solid var(--good)"></i>Came</span><span><i style="background:var(--warn-soft);border:1.5px solid var(--warn)"></i>Paid, missed</span><span><i style="background:var(--surface-2);border:1.5px dashed var(--ink-3)"></i>Not a member</span></div></div></section>
      <section class="section"><div class="section-head"><h2>Body</h2></div><div class="card box">${last ? `<div class="stat-grid" style="grid-template-columns:repeat(2,1fr)">${[['weight', 'Weight', 'kg'], ['bodyFat', 'Body fat', '%'], ['waist', 'Waist', 'cm'], ['arms', 'Arms', 'cm']].filter(([k]) => last[k] != null).map(([k, l, u]) => {
        const dl = delta(k);
        return `<div class="stat"><span>${l}</span><b>${last[k]}<small> ${u}</small>${dl ? `<span class="delta ${dl < 0 ? 'down' : 'up'}">${dl > 0 ? '+' : ''}${dl}</span>` : ''}</b></div>`;
      }).join('')}</div><p class="muted" style="font-size:13px;margin-top:10px">Last measured ${dateLong(last.date)}${meas.length > 1 ? ` · change since ${dateShort(firstM.date)}` : ''}</p>` : '<p class="muted">Ask your trainer to record your weight and measurements to track progress here.</p>'}</div></section>
      <section class="section"><div class="section-head"><h2>Recent visits</h2></div><div class="card box" style="padding:6px 16px">${d.attendance.slice(0, 10).map((a) => `<div class="recap-row"><span>${dateShort(a.date)}</span><b>${time12(a.in)} – ${a.out ? time12(a.out) : 'now'}${a.out ? ` · ${fmtMinutes(toMin(a.out) - toMin(a.in))}` : ''}</b></div>`).join('') || '<p class="muted" style="padding:10px 0">No visits yet.</p>'}</div></section>`);
  }

  // ---- fees ---------------------------------------------------------------------

  async function feesView() {
    const d = await me();
    const s = d.summary;
    const b = state.gym.business;
    render(`<div class="page-title"><h1>Fees</h1><p>${s.expiry ? `${s.status === 'expired' ? 'Expired' : 'Paid till'} ${dateLong(s.expiry)}` : 'No fee paid yet'}</p></div>
      <div class="mini-stats" style="margin-top:16px"><div class="stat"><span>Total paid</span><b>${rs(s.totalPaid)}</b></div><div class="stat"><span>Pending</span><b class="${s.balance ? 'money-neg' : ''}">${rs(s.balance)}</b></div><div class="stat"><span>Months paid</span><b>${s.monthsPaid}</b></div></div>
      ${s.balance > 0 || ['expired', 'expiring', 'unpaid'].includes(s.status) ? `<div class="alert-card warn">${icon('wallet')}<span class="tx">Pay at the front desk${b.whatsapp ? ' or message us to arrange' : ''}.</span>${b.whatsapp ? `<a class="btn btn-primary btn-sm" href="${UI.waLink(b.whatsapp, `Hi! I'm ${d.member.name} (member ${d.member.memberNo}). I want to pay my fee.`)}" target="_blank" rel="noopener">${icon('whatsapp')}Message</a>` : ''}</div>` : ''}
      <div class="bk-list">${d.payments.map((p) => {
        const paid = p.installments.reduce((a, i) => a + i.amount, 0);
        return `<div class="card receipt"><div class="r-top"><div><b>${esc(p.planName)}</b><span>${dateShort(p.periodStart)} – ${dateShort(p.periodEnd)} · receipt #${p.receiptNo}</span></div>${p.total - paid > 0 ? `<span class="badge badge-bad">Due ${rs(p.total - paid)}</span>` : '<span class="badge badge-good">Paid</span>'}</div>
          <div class="amounts"><span>Total <b class="tnum">${rs(p.total)}</b></span><span>Paid <b class="tnum">${rs(paid)}</b></span>${p.discount ? `<span>Discount <b class="tnum">${rs(p.discount)}</b></span>` : ''}</div>
          ${p.installments.map((i) => `<span class="muted" style="font-size:12.5px">${rs(i.amount)} · ${esc(i.method)} · ${dateShort(i.date)}</span>`).join('')}</div>`;
      }).join('') || emptyState('wallet', 'No payments yet', 'Your fee receipts will show up here.')}</div>
      ${state.gym.plans.length ? `<section class="section"><div class="section-head"><h2>Plans</h2></div><div class="scroller">${state.gym.plans.map(planCard).join('')}</div></section>` : ''}`);
  }

  // ---- profile ------------------------------------------------------------------

  async function profileView() {
    const d = await me();
    const m = d.member;
    const trainer = state.gym.staff.find((x) => x.id === m.trainerId);
    render(`<div class="page-title"><h1>Profile</h1></div>
      <div class="card box" style="margin-top:14px;display:flex;gap:16px;align-items:center"><button class="photo-edit" data-photo aria-label="Change your photo">${UI.avatarHtml(m, 'xl')}<span class="cam">${icon('camera')}</span></button><div><b style="font-size:17px">${esc(m.name)}</b><p class="muted">Member no. ${m.memberNo} · ${esc(m.phone)}</p><button class="link" data-photo2>${m.photo ? 'Change photo' : 'Add your photo'}</button></div></div>
      <div class="card recap"><div class="recap-row"><span>Joined</span><b>${dateLong(m.joinDate)}</b></div>${trainer ? `<div class="recap-row"><span>Trainer</span><b>${esc(trainer.name)}</b></div>` : ''}${m.goal ? `<div class="recap-row"><span>Goal</span><b>${esc(m.goal)}</b></div>` : ''}${m.emergencyName ? `<div class="recap-row"><span>Emergency contact</span><b>${esc(m.emergencyName)}</b></div>` : ''}</div>
      <div class="detail-actions" style="margin-top:16px"><a class="btn btn-ghost" href="#/fees">${icon('wallet')}Fees & receipts</a><button class="btn btn-ghost" data-pin>${icon('lock')}Change PIN</button><button class="btn btn-danger" data-out>${icon('logout')}Sign out</button></div>
      <section class="section"><div class="section-head"><h2>Gym</h2></div>${infoCard()}</section>`);
    view.querySelector('[data-out]').addEventListener('click', () => logout());
    const changePhoto = () => sheet({
      title: 'Your photo',
      html: `<div style="display:grid;justify-items:center;gap:12px;padding:6px 0 4px">${UI.avatarHtml(m, 'xl')}<p class="muted" style="text-align:center">The gym sees this photo at the front desk and on the entry screen when you check in.</p></div>
        <div class="sheet-actions">${m.photo ? `<button class="btn btn-danger" data-remove>${icon('trash')}Remove</button>` : ''}<button class="btn btn-primary" data-pick>${icon('camera')}${m.photo ? 'Change photo' : 'Choose a photo'}</button></div>`,
      onMount: (el, close) => {
        el.querySelector('[data-pick]').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          try {
            const image = await UI.pickPhoto();
            if (!image) return;
            const r = await busy(btn, () => api('/api/member/photo', { method: 'PUT', body: { image } }));
            state.me.member.photo = r.photo;
            close();
            toast('Photo updated');
            profileView();
          } catch (err) { toast(err.message, 'bad'); }
        });
        el.querySelector('[data-remove]')?.addEventListener('click', async () => {
          await api('/api/member/photo', { method: 'DELETE' });
          delete state.me.member.photo;
          close();
          profileView();
        });
      },
    });
    view.querySelector('[data-photo]').addEventListener('click', changePhoto);
    view.querySelector('[data-photo2]').addEventListener('click', changePhoto);
    view.querySelector('[data-pin]').addEventListener('click', () => sheet({
      title: 'Change PIN',
      html: `<form class="form" style="padding:0" novalidate><label class="field"><span>Current PIN</span><input class="input" name="current" type="password" inputmode="numeric" maxlength="8"></label><label class="field"><span>New PIN (4–8 digits)</span><input class="input" name="next" type="password" inputmode="numeric" maxlength="8"></label></form>
        <div class="sheet-actions"><button class="btn btn-primary" data-ok>Save</button></div>`,
      onMount: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        try { await api('/api/member/pin', { method: 'POST', body: Object.fromEntries(new FormData(el.querySelector('form'))) }); close(); toast('PIN changed'); } catch (e) { toast(e.message, 'bad'); }
      }),
    }));
  }

  // ---- router -------------------------------------------------------------------

  async function route() {
    document.querySelectorAll('.sheet-backdrop').forEach((x) => x.remove());
    document.body.style.overflow = '';
    const [path, query] = (location.hash.slice(1) || '/').split('?');
    const params = new URLSearchParams(query || '');
    const page = path.split('/').filter(Boolean)[0] || '';
    window.scrollTo(0, 0);
    try {
      if (page === 'classes') return await classesView(params);
      if (!state.token) return page === 'login' ? loginView() : publicHome();
      if (page === 'workout' && path.includes('library')) return await libraryPage(params);
      if (page === 'workout') return await workoutView(params);
      if (page === 'progress') return await progressView(params);
      if (page === 'fees') return await feesView();
      if (page === 'profile') return await profileView();
      return await memberHome();
    } catch (e) {
      if (!state.token && e.status === 401) return;
      render(emptyState('alert', 'Something went wrong', e.message, '<a class="btn btn-primary" href="#/">Go home</a>'));
    }
  }

  // Native builds made without API_URL ask once for the gym's server address.
  function connectView(error) {
    view.innerHTML = `<div class="view" style="padding:calc(48px + env(safe-area-inset-top)) 24px 24px">
      <div class="empty" style="padding:0 0 20px"><div class="empty-icon">${icon('store')}</div><h3>Connect your gym</h3><p>Enter your gym's server address, for example https://app.yourgym.com</p></div>
      <form class="form" style="padding:0" novalidate><label class="field"><span>Server address</span><input class="input" name="url" type="url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="https://" value="${esc(store.get('serverUrlDraft', ''))}"></label>
      ${error ? `<p class="field-error">${esc(error)}</p>` : ''}<button class="btn btn-primary btn-block">Connect</button></form></div>`;
    const form = view.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = form.url.value.trim().replace(/\/+$/, '');
      store.set('serverUrlDraft', url);
      if (!/^https?:\/\/./.test(url)) return connectView('The address must start with https://');
      try { localStorage.setItem('serverUrl', url); } catch { /* ignore */ }
      boot();
    });
  }

  function offlineBanner() {
    let bar = document.querySelector('.offline-bar');
    if (navigator.onLine) { bar?.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'offline-bar';
      bar.textContent = "You're offline. Connect to see your latest data.";
      document.body.prepend(bar);
    }
  }

  let booted = false;
  async function boot() {
    if (window.APP_CONFIG?.native && !UI.apiBase()) return connectView();
    try {
      state.gym = await rawApi('/api/gym');
    } catch (e) {
      if (window.APP_CONFIG?.native && !window.APP_CONFIG.apiBase) {
        try { localStorage.removeItem('serverUrl'); } catch { /* ignore */ }
        return connectView(`Could not reach that server. ${e.message}`);
      }
      view.innerHTML = emptyState('alert', "Can't connect", e.message, '<button class="btn btn-primary" data-retry>Try again</button>');
      view.querySelector('[data-retry]').addEventListener('click', () => location.reload());
      return;
    }
    const b = state.gym.business;
    UI.setBusiness(b);
    UI.setAccent(b.accent);
    document.title = b.name;
    if (!booted) {
      booted = true;
      window.addEventListener('hashchange', route);
      window.addEventListener('online', offlineBanner);
      window.addEventListener('offline', offlineBanner);
    }
    offlineBanner();
    route();
    if (!window.APP_CONFIG?.demo && 'serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  boot();
})();
