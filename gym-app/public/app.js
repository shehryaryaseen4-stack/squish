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
    const route = (location.hash.split('?')[0] || '#/').replace('#/workout/library', '#/workout').replace('#/diet', '#/workout').replace('#/coach', '#/workout').replace('#/bmi', '#/workout').replace('#/supps', '#/workout');
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
      <div class="footer">© ${new Date().getFullYear()} ${esc(b.name)} · <a href="${UI.url('/admin.html')}">Gym staff</a></div>`);
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
      ${bmiTile(m)}
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

  // The member's weight: what they entered for their diet, else the trainer's last measurement.
  function bodyWeight(d) {
    const measured = [...(d.measurements || [])].reverse().find((x) => x.weight);
    const kg = d.member.body?.weight || measured?.weight;
    return { kg: kg || 70, known: Boolean(kg) };
  }

  const fitTabs = (on) => `<div class="fit-tabs" role="tablist"><a href="#/workout" role="tab" aria-selected="${on === 'workout'}">${icon('dumbbell')}Workout</a><a href="#/diet" role="tab" aria-selected="${on === 'diet'}">${icon('flame')}Diet</a><a href="#/bmi" role="tab" aria-selected="${on === 'bmi'}">${icon('ruler')}BMI</a><a href="#/supps" role="tab" aria-selected="${on === 'supps'}" title="Supplements">${icon('scoop')}Supps</a></div>`;

  async function workoutView(params) {
    const d = await me();
    const w = bodyWeight(d);
    const byCoach = d.member.workoutPlan?.program?.by === 'coach';
    const cta = byCoach ? '' : `<a class="card coach-cta" href="#/coach">${icon('star')}<div><b>Let your coach make your plan</b><span>Answer a few questions. You get a plan for your body and goal, the weight to lift on every exercise, and it goes up as you get stronger.</span></div>${icon('chevronRight')}</a>`;
    render(`<div class="page-title"><h1>My workout</h1><p>Your weekly plan. Tap an exercise to see how it's done.</p></div>${fitTabs('workout')}${cta}<div id="wk" style="margin-top:14px"><div class="boot"><div class="skel" style="height:300px;border-radius:22px"></div></div></div>`);
    await Workout.planView(document.getElementById('wk'), {
      kg: w.kg,
      kgKnown: w.known,
      goal: d.member.body?.goal,
      profile: d.member.body,
      lifts: d.member.lifts || {},
      saveLift,
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

  // ---- diet ----------------------------------------------------------------------------

  const GOALS = [['lose', 'Lose fat'], ['fit', 'Stay fit'], ['gain', 'Build muscle']];
  const DIETS = [['nonveg', 'Chicken, meat & eggs'], ['egg', 'Eggs, no meat'], ['veg', 'Vegetarian']];
  const MEAL_NAMES = { breakfast: ['sun', 'Breakfast'], lunch: ['sunset', 'Lunch'], snack: ['bolt', 'After workout'], dinner: ['moon', 'Dinner'] };

  async function dietView(params) {
    const d = await me();
    const m = d.member;
    render(`<div class="page-title"><h1>Diet & calories</h1><p>How much you burn, how much protein you need, and what to eat.</p></div>${fitTabs('diet')}<div id="diet" class="pad" style="margin-top:14px"></div>`);
    const box = document.getElementById('diet');
    if (!m.body || params.get('edit')) return bodyForm(box, d);

    const b = m.body;
    const plan = m.workoutPlan;
    const trainingDays = Object.values(plan?.days || {}).filter((x) => x?.exercises?.length).length || 3;
    const trend = Coach.weightTrend(m.weighIns || [], b.goal);
    const p = Nutrition.plan(b, trainingDays, trend.kcal || 0, { asian: asianBmi() });
    const lib = await Workout.library();
    const todayDay = plan?.days?.[todayKey()];
    const burnToday = todayDay ? Nutrition.dayBurn(todayDay, lib.byId, b.weight) : null;
    const weekBurn = Object.values(plan?.days || {}).reduce((a, x) => a + Nutrition.dayBurn(x, lib.byId, b.weight).kcal, 0);
    const short = p.protein - p.totals.protein;

    box.innerHTML = `<div class="card diet-target">
        <div class="dt-main"><div><small>Eat each day</small><b class="tnum">${p.target.toLocaleString()}</b><span>kcal</span></div><div><small>Protein</small><b class="tnum">${p.protein}</b><span>grams</span></div></div>
        <div class="dt-macros"><span><b>${p.carbs} g</b> carbs</span><span><b>${p.fat} g</b> fat</span><span><b>${p.water} L</b> water</span></div>
        <p class="dt-why">${p.proteinKg} kg × ${p.perKg} g = <b>${p.protein} g protein</b> a day to ${p.goal === 'gain' ? 'build muscle' : p.goal === 'lose' ? 'lose fat and keep your muscle' : p.goal === 'recomp' ? 'build muscle while losing fat' : 'stay fit'}${p.proteinKg !== b.weight ? ` (${p.proteinKg} kg is a healthy weight for your height, so protein isn't counted for extra fat)` : ''}. Your body uses about ${p.maintain.toLocaleString()} kcal a day with ${trainingDays} workout${trainingDays === 1 ? '' : 's'} a week${p.goal === 'lose' || p.goal === 'recomp' ? ', so eating less makes you lose fat' : p.goal === 'gain' ? ', so eating a bit more builds muscle' : ''}.</p></div>
      ${p.changed ? `<p class="note-line warn">${esc(p.changed)}</p>` : ''}
      ${bmiStrip(p.bmi)}

      <div class="card diet-burn">${icon('flame')}<div>${burnToday && burnToday.kcal ? `<b>Today's workout burns ≈ ${burnToday.kcal} kcal</b><span>${esc(Workout.dayLabel(todayDay))} · about ${burnToday.minutes} min. See each exercise in <a class="link" href="#/workout">Workout</a>.</span>` : `<b>Rest day today</b><span>${weekBurn ? `Your week of workouts burns ≈ ${weekBurn.toLocaleString()} kcal.` : 'Make a workout plan to see the calories you burn.'}</span>`}</div></div>

      <div class="card weigh-in"><div class="wi-head">${icon('activity')}<div><b>Weekly check-in</b><span>Weigh yourself once a week: same day, in the morning before breakfast.</span></div></div>
        <form class="wi-form" novalidate><input class="input" name="kg" type="number" inputmode="decimal" step="0.1" min="25" max="300" placeholder="Today's weight (kg)" aria-label="Today's weight in kg"><button class="btn btn-primary">Save</button></form>
        ${(m.weighIns || []).length ? `<div class="wi-list">${(m.weighIns || []).slice(-6).map((x) => `<span><b>${x.kg}</b><small>${esc(dateShort(x.d))}</small></span>`).join('')}</div>` : ''}
        <p class="wi-note ${trend.kcal ? 'warn' : ''}">${esc(trend.note)}${trend.kcal ? ` Your calories above already include this (${trend.kcal > 0 ? '+' : ''}${trend.kcal} kcal).` : ''}</p></div>

      <h2 class="diet-h">Your meals for today</h2>
      <div class="meals">${p.meals.map((meal) => {
        const [ic, name] = MEAL_NAMES[meal.id];
        const prot = meal.items.reduce((a, x) => a + x.protein, 0);
        const kc = meal.items.reduce((a, x) => a + x.kcal, 0);
        return `<section class="card meal"><div class="meal-head">${icon(ic)}<h3>${name}</h3><span>${prot} g protein · ${kc} kcal</span></div>
          <ul>${meal.items.map((x) => `<li><span class="qty">${esc(x.label)}</span><span class="food">${esc(x.food)}</span><span class="p">${x.protein ? `${x.protein} g` : ''}</span></li>`).join('')}</ul></section>`;
      }).join('')}</div>
      <div class="card diet-total"><div><small>Protein in this plan</small><b class="${short > 10 ? 'warn' : ''}">${p.totals.protein} g</b><span>of ${p.protein} g</span></div><div><small>Calories</small><b>${p.totals.kcal.toLocaleString()}</b><span>of ${p.target.toLocaleString()} kcal</span></div></div>
      ${short > 10 ? `<p class="note-line">${short} g short: add a scoop of whey or ${Math.ceil(short / 6)} more eggs.</p>` : ''}

      <a class="card bmi-rec" href="#/supps">${icon('scoop')}<div><b>Supplements: what you need</b><span>Whey, creatine and more: what a scoop holds, how to take it, the good and the bad, and how many scoops fit your diet.</span></div>${icon('chevronRight')}</a>

      <h2 class="diet-h">Protein in common foods</h2>
      <div class="card protein-table"><table><tbody>${['egg', 'chicken', 'fish', 'beef', 'daal', 'chana', 'paneer', 'soya', 'milk', 'dahi', 'whey', 'roti'].map((k) => {
        const f = Nutrition.FOODS[k];
        return `<tr><td>${esc(f.name)}</td><td class="muted">${f.per ? `${f.per} g` : `1 ${f.unit}`}</td><td class="num"><b>${f.p} g</b></td><td class="num muted">${f.kcal} kcal</td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="diet-note">Numbers are estimates for a healthy adult. If you have a medical condition, are pregnant, or take medicine, ask a doctor first. Your trainer can adjust this plan with you.</p>
      <button class="btn btn-ghost btn-block" data-edit style="margin-top:12px">${icon('edit')}Change weight, goal or diet</button>`;
    box.querySelector('[data-edit]').addEventListener('click', () => { location.hash = '#/diet?edit=1'; });
    box.querySelector('.wi-form').addEventListener('submit', (e) => {
      e.preventDefault();
      busy(e.target.querySelector('button'), async () => {
        try { await weighIn(Number(e.target.kg.value)); toast('Saved. See you next week!'); dietView(new URLSearchParams()); } catch (err) { toast(err.message, 'bad'); }
      });
    });
  }

  const EXPERIENCE = [['new', 'Never / just started'], ['lt1', 'Under 1 year'], ['1to3', '1-3 years'], ['3plus', '3+ years']];
  const INJURIES = [['knee', 'Knee'], ['back', 'Lower back'], ['shoulder', 'Shoulder']];

  // Everything the coach needs to know; the diet plan uses the same answers.
  function bodyForm(box, d, { coach = false, onSaved } = {}) {
    const m = d.member;
    const b = m.body || {};
    const last = (k) => [...(d.measurements || [])].reverse().find((x) => x[k])?.[k];
    const age = b.age || (m.dob ? Math.floor((Date.parse(today()) - Date.parse(m.dob)) / (365.25 * 864e5)) : '');
    const chips = (name, list, cur, multi) => `<div class="choice-row" role="${multi ? 'group' : 'radiogroup'}">${list.map(([v, l]) => `<label class="choice-chip"><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${v}" ${(multi ? (cur || []).includes(v) : v === cur) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    box.innerHTML = `<div class="card box"><h2 style="font-size:19px">${coach ? 'Tell your coach about you' : 'About you'}</h2><p class="muted" style="margin:4px 0 16px">${coach ? 'Your plan, starting weights and diet are made from these answers. You can change them any time.' : 'Used to work out your calories and protein. Only you and your gym can see it.'}</p>
      <form class="form" style="padding:0" novalidate>
        <div class="two-col"><label class="field"><span>Weight (kg)</span><input class="input" name="weight" type="number" inputmode="decimal" min="25" max="300" value="${esc(b.weight || last('weight') || '')}" required></label>
          <label class="field"><span>Height (cm)</span><input class="input" name="height" type="number" inputmode="numeric" min="100" max="250" value="${esc(b.height || last('height') || '')}" required></label></div>
        <div class="two-col"><label class="field"><span>Age</span><input class="input" name="age" type="number" inputmode="numeric" min="10" max="100" value="${esc(age)}" required></label>
          <label class="field"><span>Gender</span><select class="select" name="gender" data-sex><option value="male" ${(b.gender || m.gender) !== 'female' ? 'selected' : ''}>Male</option><option value="female" ${(b.gender || m.gender) === 'female' ? 'selected' : ''}>Female</option></select></label></div>
        <div class="bmi-live" data-bmi hidden></div>
        <div class="field"><span>Your goal</span>${chips('goal', GOALS, b.goal || 'fit')}<p class="goal-hint" data-goalhint hidden></p></div>
        <div class="field"><span>What you want most</span>${chips('focus', Object.entries(Coach.FOCUS).map(([k, x]) => [k, x.label]), b.focus || 'balanced')}</div>
        <div class="field"><span>How long have you been training?</span>${chips('experience', EXPERIENCE, b.experience || 'new')}</div>
        <div class="two-col"><label class="field"><span>Days a week you can come</span><select class="select" name="days">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${Number(b.days || 3) === n ? 'selected' : ''}>${n} days</option>`).join('')}</select></label>
          <label class="field"><span>Time per workout</span><select class="select" name="minutes">${[[45, '45 min'], [60, '1 hour'], [90, '1.5 hours']].map(([n, l]) => `<option value="${n}" ${Number(b.minutes || 60) === n ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <div class="field"><span>Any pain or injury? (we'll avoid risky moves)</span>${chips('injuries', INJURIES, b.injuries, true)}</div>
        <div class="field"><span>What you eat</span>${chips('diet', DIETS, b.diet || 'nonveg')}</div>
        <button class="btn btn-primary btn-block">${coach ? 'Make my plan' : 'Show my diet plan'}</button></form></div>`;
    const f = box.querySelector('form');
    // Show the BMI while typing, and pick the goal it suggests until the member chooses one.
    let goalTouched = Boolean(b.goal);
    const live = () => {
      const r = Nutrition.bmi({ weight: Number(f.weight.value), height: Number(f.height.value), age: Number(f.age.value) }, { asian: asianBmi() });
      const out = f.querySelector('[data-bmi]');
      const hint = f.querySelector('[data-goalhint]');
      out.hidden = !r || r.value < 10 || r.value > 70;
      hint.hidden = true;
      if (out.hidden) return;
      out.className = `bmi-live bmi-${r.category}`;
      out.innerHTML = `<b>BMI ${r.value}</b><span>${r.teen ? 'Under 18: ask your trainer, BMI for teens is read by age' : `${esc(r.label)} · healthy for your height: ${r.healthy.min}–${r.healthy.max} kg`}</span>`;
      if (!r.goal) return;
      if (!goalTouched) { f.querySelector(`input[name="goal"][value="${r.goal}"]`).checked = true; }
      const chosen = f.querySelector('input[name="goal"]:checked')?.value;
      if (chosen !== r.goal) {
        hint.hidden = false;
        hint.textContent = r.category === 'under' ? 'For your BMI we suggest “Build muscle”: you need to gain healthy weight first.' : `For your BMI we suggest “Lose fat”. ${r.category === 'obese' ? 'Eating extra now would add more fat.' : 'You can build muscle while you lose it.'}`;
      }
    };
    f.querySelectorAll('input[name="goal"]').forEach((x) => x.addEventListener('change', () => { goalTouched = true; live(); }));
    ['weight', 'height', 'age'].forEach((k) => f[k].addEventListener('input', live));
    live();
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(f.querySelector('button'), async () => {
        try {
          const fd = new FormData(f);
          const body = Object.fromEntries(fd.entries());
          body.injuries = fd.getAll('injuries');
          for (const k of ['weight', 'height', 'age', 'days', 'minutes']) body[k] = Math.round(Number(body[k]));
          state.me.member.body = await api('/api/member/body', { method: 'PUT', body });
          if (onSaved) return onSaved();
          if (location.hash.startsWith('#/bmi')) { location.hash = '#/bmi'; return bmiView(new URLSearchParams()); }
          if (location.hash === '#/diet') dietView(new URLSearchParams()); else location.hash = '#/diet';
        } catch (err) { toast(err.message, 'bad'); }
      });
    });
  }

  // ---- BMI ---------------------------------------------------------------------------------

  // Gyms in South and East Asia use the Asian BMI ranges.
  const asianBmi = () => Nutrition.isAsian(state.gym?.business?.locale);
  const GOAL_LABEL = Object.fromEntries(GOALS);

  // Where the BMI sits on a 15-40 scale, with the four ranges coloured.
  function bmiScale(r) {
    const lo = 15;
    const hi = 40;
    const at = (v) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100;
    const [a, c, d] = r.cuts;
    return `<div class="bmi-scale" aria-hidden="true"><div class="bs-bar"><i class="bs-under" style="width:${at(a)}%"></i><i class="bs-normal" style="width:${at(c) - at(a)}%"></i><i class="bs-over" style="width:${at(d) - at(c)}%"></i><i class="bs-obese" style="width:${100 - at(d)}%"></i></div>
      <span class="bs-pin" style="left:${at(r.value)}%"></span>
      <div class="bs-ticks"><span style="left:${at(a)}%">${a}</span><span style="left:${at(c)}%">${c}</span><span style="left:${at(d)}%">${d}</span></div></div>`;
  }

  function bmiTile(m) {
    const r = m.body && Nutrition.bmi(m.body, { asian: asianBmi() });
    if (!r) return `<a class="card bmi-tile" href="#/bmi">${icon('ruler')}<div><b>Check your BMI</b><span>Enter your weight and height to get a diet and workout made for your body.</span></div>${icon('chevronRight')}</a>`;
    return `<a class="card bmi-tile" href="#/bmi"><div class="bt-num bmi-${r.teen ? 'normal' : r.category}"><b>${r.value}</b><small>BMI</small></div><div><b>${r.teen ? 'Your BMI' : esc(r.label)}</b><span>${r.gap && !r.teen ? `${r.gap < 0 ? 'Lose' : 'Gain'} ${Math.abs(r.gap)} kg to reach a healthy weight` : 'Healthy weight. Keep it up!'}</span></div>${icon('chevronRight')}</a>`;
  }

  // A one-line BMI reminder on the diet page.
  const bmiStrip = (r) => (r ? `<a class="card bmi-strip" href="#/bmi"><span class="bmi-dot bmi-${r.teen ? 'normal' : r.category}"></span><span>BMI <b>${r.value}</b>${r.teen ? '' : ` · ${esc(r.label)}`}</span><span class="link">Why this plan ›</span></a>` : '');

  async function bmiView(params) {
    const d = await me();
    const m = d.member;
    render(`<div class="page-title"><h1>BMI & your body</h1><p>Your body mass index, a healthy weight for your height, and the plan that fits you.</p></div>${fitTabs('bmi')}<div id="bmi" class="pad" style="margin-top:14px"></div>`);
    const box = document.getElementById('bmi');
    if (!m.body || params.get('edit')) return bodyForm(box, d, { coach: true, onSaved: () => { location.hash = '#/bmi'; } });
    const b = m.body;
    const asian = asianBmi();
    const r = Nutrition.bmi(b, { asian });
    const lib = await Workout.library();
    const coachPlan = Coach.plan({ ...b, asian }, lib);
    // Same numbers as the Diet page: the days in the member's own plan.
    const trainingDays = Object.values(m.workoutPlan?.days || {}).filter((x) => x?.exercises?.length).length || Object.keys(coachPlan.days).length;
    const p = Nutrition.plan(b, trainingDays, Coach.weightTrend(m.weighIns || [], b.goal).kcal || 0, { asian });
    const waist = [...(d.measurements || [])].reverse().find((x) => x.waist)?.waist;
    const whtr = waist ? Math.round((waist / b.height) * 100) / 100 : null;
    const cardio = Object.values(coachPlan.days).flatMap((x) => x.exercises).find((x) => lib.byId[x.id]?.cardio);
    const advise = !r.teen && r.goal && r.goal !== b.goal;

    const pace = r.gap < 0 ? `about ${r.category === 'obese' ? '0.75' : '0.5'} kg a week` : 'about 0.25 kg a week';
    const history = (m.weighIns || []).slice(-8).map((x) => ({ ...x, bmi: Nutrition.bmi({ weight: x.kg, height: b.height }, { asian }).value }));
    box.innerHTML = `<div class="card bmi-hero">
        <div class="bh-top"><div class="bh-num bmi-${r.teen ? 'normal' : r.category}"><b class="tnum">${r.value}</b><small>BMI</small></div>
          <div><h2>${r.teen ? 'Under 18' : esc(r.label)}</h2><p>${b.weight} kg · ${b.height} cm</p></div></div>
        ${bmiScale(r)}
        <div class="bh-facts"><div><small>Healthy weight for ${b.height} cm</small><b>${r.healthy.min}–${r.healthy.max} kg</b></div>
          <div><small>${r.gap < 0 ? 'To lose' : r.gap > 0 ? 'To gain' : 'You are'}</small><b>${r.gap ? `${Math.abs(r.gap)} kg` : 'In range ✓'}</b></div>
          ${r.gap ? `<div><small>Time at a safe pace</small><b>${r.weeks < 9 ? `${r.weeks} weeks` : `${Math.round(r.weeks / 4.3)} months`}</b></div>` : ''}</div>
      </div>
      <p class="bmi-text">${r.teen ? 'You are under 18, so BMI is read from growth charts for your age, not these ranges. Train with your trainer’s guidance and eat well to grow strong.' : esc(r.text)}
        ${r.gap && !r.teen ? ` At ${pace}, that is a healthy, lasting change.` : ''}${r.milestone ? ` <b>First step: lose ${r.milestone} kg.</b> Even that much lowers blood pressure and sugar and makes training easier.` : ''}</p>
      ${whtr ? `<div class="card bmi-note ${whtr > 0.5 ? 'warn' : ''}">${icon('ruler')}<div><b>Waist ${waist} cm (${whtr} × your height)</b><span>${whtr > 0.5 ? `Keep your waist under ${Math.floor(b.height / 2)} cm, half your height. Belly fat is the riskiest kind.` : 'Your waist is under half your height. Good sign!'}</span></div></div>` : ''}
      ${r.category === 'over' && b.experience === '3plus' && !(whtr > 0.5) ? `<div class="card bmi-note">${icon('info')}<div><b>Lots of muscle?</b><span>BMI can’t tell muscle from fat. If you are muscular with a slim waist, a BMI a bit over the range is fine.</span></div></div>` : ''}
      ${advise ? `<div class="card bmi-advise"><div><small>Recommended goal for your body</small><b>${esc(GOAL_LABEL[r.goal])}</b><span>Your goal now: ${esc(GOAL_LABEL[b.goal] || 'Stay fit')}.</span></div><button class="btn btn-primary btn-sm" data-goal="${r.goal}">Use this goal</button></div>` : ''}

      <h2 class="diet-h">What we recommend for you</h2>
      <a class="card bmi-rec" href="#/diet">${icon('flame')}<div><b>Diet: ${p.target.toLocaleString()} kcal and ${p.protein} g protein a day</b>
        <span>${p.goal === 'lose' ? `About ${p.maintain - p.target > 0 ? (p.maintain - p.target).toLocaleString() : 0} kcal less than your body uses, so fat comes off slowly while protein keeps your muscle.` : p.goal === 'recomp' ? 'A little less than your body uses, with plenty of protein: lose fat and build muscle together.' : p.goal === 'gain' ? `About ${(p.target - p.maintain).toLocaleString()} kcal more than your body uses, with protein in every meal to build muscle.` : 'As much as your body uses, with enough protein to stay strong.'} Breakfast: ${esc(p.meals[0].items.map((x) => x.food.split(/ \(|,/)[0].toLowerCase()).join(', '))}, and more.</span></div>${icon('chevronRight')}</a>
      <a class="card bmi-rec" href="#/coach">${icon('dumbbell')}<div><b>Workout: ${esc(coachPlan.program.split)}, ${Object.keys(coachPlan.days).length} days a week</b>
        <span>${b.goal === 'gain' && r.category !== 'obese' ? 'Heavier weights, 8-10 reps.' : b.goal === 'lose' || r.category === 'obese' ? 'Weights for 10-15 reps with short rests.' : 'Weights for 8-15 reps.'} ${cardio ? `Plus ${esc(cardio.reps)} of ${r.category === 'obese' ? 'easy-on-the-joints ' : ''}cardio (${esc(lib.byId[cardio.id].name.toLowerCase())}).` : 'No extra cardio, so your food goes into muscle.'} Starting weights fit your body and go up as you get stronger.</span></div>${icon('chevronRight')}</a>

      ${history.length > 1 ? `<h2 class="diet-h">Your BMI over time</h2><div class="card bmi-history">${history.map((x) => `<div><b>${x.bmi}</b><small>${x.kg} kg</small><span>${esc(dateShort(x.d))}</span></div>`).join('')}</div>` : `<p class="diet-note">Weigh yourself once a week on the <a class="link" href="#/diet">Diet</a> page to see your BMI change.</p>`}
      <p class="diet-note">BMI is a quick guide for adults, not a diagnosis. ${asian ? 'This gym uses the Asian BMI ranges (WHO), because South and East Asian bodies carry more fat at the same BMI. ' : ''}If you have a health condition, ask a doctor.</p>
      <button class="btn btn-ghost btn-block" data-edit style="margin-top:12px">${icon('edit')}Update weight, height or goal</button>`;
    box.querySelector('[data-edit]').addEventListener('click', () => { location.hash = '#/bmi?edit=1'; });
    box.querySelector('[data-goal]')?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
      try {
        state.me.member.body = await api('/api/member/body', { method: 'PUT', body: { ...b, goal: r.goal } });
        toast('Goal updated. Your diet changed, and your coach has a new plan for you.');
        bmiView(new URLSearchParams());
      } catch (err) { toast(err.message, 'bad'); }
    }));
  }

  // ---- supplements ---------------------------------------------------------------------------

  const FIT = { yes: ['good', 'Good for you'], maybe: ['', 'Optional'], no: ['bad', 'Not for you'] };
  const EVIDENCE = { strong: [3, 'Strong research'], some: [2, 'Some research'], weak: [1, 'Weak research'], none: [0, 'No real proof'] };
  const SUPP_GROUPS = [['all', 'All'], ['you', 'Good for you'], ['protein', 'Protein'], ['strength', 'Strength & energy'], ['health', 'Health']];
  const groupOf = (x) => (/protein|calories|amino/i.test(x.kind) ? 'protein' : /strength|energy|weight/i.test(x.kind) ? 'strength' : 'health');
  const evidenceDots = (e) => `<span class="ev" title="${EVIDENCE[e][1]}">${[1, 2, 3].map((i) => `<i class="${i <= EVIDENCE[e][0] ? 'on' : ''}"></i>`).join('')}<small>${EVIDENCE[e][1]}</small></span>`;

  // The gym's own photo of the tub it sells, or the drawing.
  const productPic = (x) => {
    const src = state.gym?.suppPhotos?.[`${x.id}-prod`];
    return src ? `<img class="supp-prod" src="${esc(UI.photoSrc(src))}" alt="${esc(x.name)}">` : Supplements.art(x);
  };

  async function suppsView(params) {
    const d = await me();
    const m = d.member;
    const b = m.body;
    const days = Object.values(m.workoutPlan?.days || {}).filter((x) => x?.exercises?.length).length || 3;
    const diet = b ? Nutrition.plan(b, days, Coach.weightTrend(m.weighIns || [], b.goal).kcal || 0, { asian: asianBmi() }) : null;
    const guide = Supplements.forMember(b, diet);
    const show = params.get('g') || 'all';
    const list = Supplements.LIST.filter((x) => show === 'all' || (show === 'you' ? b && guide.advice[x.id].fit === 'yes' : groupOf(x) === show));
    const e = guide.expect;
    render(`<div class="page-title"><h1>Supplements</h1><p>What each one does, how to take it, and what it means for you.</p></div>${fitTabs('supps')}<div class="pad" style="margin-top:14px">
      <div class="card supp-truth"><b>What really builds your body</b>
        <ol><li><span>1</span>Training hard, 3+ times a week</li><li><span>2</span>Eating your calories and ${e.target} g protein a day</li><li><span>3</span>Sleeping 7-8 hours</li></ol>
        <p>Supplements add the last few percent, or make the food part easier. None of them builds muscle or burns fat on its own.</p>
        ${b ? `<div class="supp-expect">${e.fatPerMonth ? `<div><b>${e.fatPerMonth} kg</b><small>fat off a month</small></div>` : ''}<div><b>${e.muscle} kg</b><small>muscle a month</small></div><div><b>8-12</b><small>weeks to see it</small></div></div>`
          : `<a class="btn btn-soft btn-sm" href="#/diet" style="margin-top:10px">Enter your weight to see what fits you</a>`}
      </div>
      <div class="chips-row supp-filter" role="group" aria-label="Show" style="margin:14px 0 4px">${SUPP_GROUPS.filter(([id]) => id !== 'you' || b).map(([id, l]) => `<a class="chip" href="#/supps?g=${id}" aria-pressed="${show === id}">${l}</a>`).join('')}</div>
      <div class="supp-grid">${list.map((x) => {
        const a = guide.advice[x.id];
        const s = x.serving;
        // Every card has the same parts in the same places.
        return `<button class="card supp-card" data-supp="${x.id}">
          <span class="supp-banner">${productPic(x)}${b ? `<span class="supp-fit ${a.fit}"><i></i>${FIT[a.fit][1]}</span>` : ''}</span>
          <span class="supp-top"><span class="supp-ico">${icon(x.icon)}</span><span><small>${esc(x.kind)}</small><b>${esc(x.name)}</b></span></span>
          <span class="supp-pills"><span>${s.protein} g protein</span><span>${s.kcal} kcal</span></span>
          <span class="supp-ev ${x.evidence}">${evidenceDots(x.evidence)}</span>
          <span class="supp-when">${icon('clock')}<span>${esc(x.when)}</span></span>
          <span class="supp-more">See details ${icon('chevronRight')}</span></button>`;
      }).join('') || '<p class="muted">Nothing here.</p>'}</div>
      <p class="diet-note">Typical values; brands differ, so check your tub’s label. Buy from an authorised seller: fake supplements are common. Ask a doctor first if you have kidney, liver or heart problems, high blood pressure, take medicine, are pregnant, or are under 18. Steroids and “test boosters” are not supplements: they are risky and the app doesn’t recommend them.</p></div>`);
    const open = (id) => suppSheet(Supplements.byId[id], guide, b, diet);
    view.querySelectorAll('[data-supp]').forEach((el) => el.addEventListener('click', () => open(el.dataset.supp)));
    if (params.get('id') && Supplements.byId[params.get('id')]) open(params.get('id'));
  }

  // The body this supplement is bought for: photo, time, training, food and what to avoid.
  function suppResult(x, body, diet) {
    const r = Supplements.result(x.id, body, diet);
    if (!r) return '';
    const photo = state.gym?.suppPhotos?.[(body?.gender || state.me?.member?.gender) === 'female' ? `${x.id}-f` : x.id];
    const list = (items, cls = '') => `<ul class="supp-list ${cls}">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    return `<div class="supp-result">
        ${photo ? `<img class="supp-photo" src="${esc(UI.photoSrc(photo))}" alt="${esc(r.title)}">` : ''}
        <div class="supp-result-head"><small>What you can build</small><b>${esc(r.title)}</b><span>${esc(r.sub)}</span></div>
      </div>
      <h4 class="supp-h">${icon('calendar')}How long it takes</h4>
      <ol class="supp-time">${r.timeline.map(([when, text]) => `<li><b>${esc(when)}</b><span>${esc(text)}</span></li>`).join('')}</ol>
      <h4 class="supp-h">${icon('dumbbell')}Training you need</h4>${list(r.training)}
      <p class="supp-p"><a class="link" href="#/coach">Get your weekly plan from the coach ›</a></p>
      <h4 class="supp-h">${icon('flame')}Food you need</h4>${list(r.food)}
      <p class="supp-p"><a class="link" href="#/diet">See your meals ›</a></p>
      <h4 class="supp-h">${icon('x')}Avoid</h4>${list(r.avoid, 'bad')}
      <p class="supp-note muted">Times are averages for natural training (men; women build about half as fast). The supplement helps; the training and food do the work.</p>`;
  }

  function suppSheet(x, guide, body, diet) {
    const known = Boolean(body);
    const a = guide.advice[x.id];
    const s = x.serving;
    const scoops = x.id === 'whey' || (x.id === 'plant' && a.fit === 'yes') ? guide.expect.scoops : 0;
    const facts = [['Protein', `${s.protein} g`], ['Calories', `${s.kcal}`], ['Carbs', `${s.carbs} g`], ['Fat', `${s.fat} g`]];
    sheet({
      label: x.name,
      wide: true,
      html: `<div class="supp-hero">${productPic(x)}</div><div class="supp-head"><span class="supp-ico lg">${icon(x.icon)}</span><div><small>${esc(x.kind)}</small><h3>${esc(x.name)}</h3>${evidenceDots(x.evidence)}</div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
        ${suppResult(x, body, diet)}
        <h4 class="supp-h">${icon('info')}What it is</h4>
        <p class="supp-what">${esc(x.what)}</p>
        ${known ? `<div class="supp-for ${a.fit}"><b>${FIT[a.fit][1]}</b><p>${esc(a.text)}</p></div>` : ''}
        <h4 class="supp-h">In ${esc(s.label)}</h4>
        <div class="supp-facts">${facts.map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('')}</div>
        ${scoops ? `<p class="supp-note">${scoops} scoop${scoops > 1 ? 's' : ''} a day = <b>${s.protein * scoops} g protein</b> and ${s.kcal * scoops} kcal.</p>` : ''}
        <h4 class="supp-h">${icon('clock')}How to take it</h4>
        <p class="supp-p"><b>How much:</b> ${esc(x.dose)}</p><p class="supp-p"><b>When:</b> ${esc(x.timing)}</p>
        <h4 class="supp-h">${icon('check')}What it does</h4><ul class="supp-list good">${x.benefits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <h4 class="supp-h">${icon('alert')}Side effects and risks</h4><ul class="supp-list bad">${x.risks.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <h4 class="supp-h">${icon('trending')}When you’ll see results</h4><p class="supp-p">${esc(x.results)}</p>
        <h4 class="supp-h">${icon('info')}What research says</h4><p class="supp-p">${esc(x.evidenceText)}</p>
        <p class="supp-p"><b>Skip it if:</b> ${esc(x.skip)}</p>`,
    });
  }

  // ---- the coach ------------------------------------------------------------------------

  async function coachView(params) {
    const d = await me();
    const m = d.member;
    render(`<header class="page-head"><a class="icon-btn" href="#/workout" aria-label="Back">${icon('chevronLeft')}</a><h1>Your coach</h1></header><div id="coach" class="pad"></div>`);
    const box = document.getElementById('coach');
    if (!m.body?.experience || params.get('edit')) return bodyForm(box, d, { coach: true, onSaved: () => coachView(new URLSearchParams()) });
    const lib = await Workout.library();
    const b = m.body;
    const plan = Coach.plan({ ...b, asian: asianBmi() }, lib);
    const body = plan.bmi && !plan.bmi.teen ? plan.bmi : null;
    const focus = Coach.FOCUS[b.focus]?.label || 'Balanced';
    const goalText = { lose: 'lose fat while keeping your muscle', fit: 'get fit and strong', gain: 'build muscle' }[b.goal];
    const why = [
      `${plan.program.split}: the best split for ${b.days} days a week${b.experience === 'new' ? ' when you are starting out' : ''}.`,
      `${b.goal === 'gain' ? 'Heavier sets of 8-10 reps' : b.goal === 'lose' ? 'Sets of 10-15 reps with short rests, plus cardio' : 'Sets of 8-15 reps'} to ${goalText}.`,
      b.focus !== 'balanced' ? `Extra work for: ${focus.toLowerCase()}.` : 'Every muscle trained evenly.',
      b.injuries?.length ? `No moves that load your ${b.injuries.map((x) => INJURIES.find((i) => i[0] === x)[1].toLowerCase()).join(', ')}.` : null,
      body?.category === 'obese' ? `Your BMI is ${body.value}: 20 minutes of easy-on-the-joints cardio (bike, walk, elliptical) every workout, no running or jumping yet.` : null,
      body?.category === 'under' ? `Your BMI is ${body.value}: no extra cardio, so your energy goes into growing muscle.` : null,
      ['new', 'lt1'].includes(b.experience) ? 'Machines and dumbbells first; barbell squats and deadlifts come once your form is solid.' : null,
      'Starting weights are on the light side. Log each set and the app raises the weight when you are ready.',
    ].filter(Boolean);
    const hasOther = Object.keys(m.workoutPlan?.days || {}).length && m.workoutPlan?.program?.by !== 'coach';
    box.innerHTML = `<div class="card coach-hero"><small>Made for ${esc(m.name.split(' ')[0])}</small><h2>${esc(plan.program.split)} · ${b.days} days a week</h2><ul>${why.map((w) => `<li>${icon('check')}<span>${esc(w)}</span></li>`).join('')}</ul></div>
      ${Workout.ORDER.filter((k) => plan.days[k]).map((k) => {
        const day = plan.days[k];
        return `<section class="card coach-day"><div class="cd-head"><b>${DAY_LABELS[k]}</b><span>${esc(Workout.dayLabel(day))}</span></div>
          <ul>${day.exercises.map((x) => {
            const e = lib.byId[x.id];
            const w = Coach.startWeight(x.id, b);
            const kind = Coach.kindOf(x.id).kind;
            return `<li><span class="cd-name">${esc(e.name)}</span><span class="cd-sets">${x.sets} × ${esc(x.reps)}</span><span class="cd-w">${w ? `${w} kg${kind === 'db' ? ' each' : ''}` : e.cardio ? '' : 'body'}</span></li>`;
          }).join('')}</ul></section>`;
      }).join('')}
      ${hasOther ? '<p class="note-line">This replaces the plan you have now.</p>' : ''}
      <div style="display:grid;gap:10px;margin-top:14px"><button class="btn btn-primary btn-block" data-start>${icon('check')}Start this plan</button><a class="btn btn-ghost btn-block" href="#/coach?edit=1">${icon('edit')}Change my answers</a></div>`;
    box.querySelector('[data-start]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      try {
        const saved = await api('/api/member/plan', { method: 'PUT', body: { ...plan, program: { ...plan.program, startedAt: today() } } });
        state.me.member.workoutPlan = saved;
        toast('Your plan is ready. Let’s go! 💪');
        location.hash = '#/workout';
      } catch (err) { toast(err.message, 'bad'); }
    }));
  }

  // Logging a set: what was lifted, then the rest timer.
  async function saveLift(exerciseId, sets) {
    const list = await api('/api/member/lift', { method: 'PUT', body: { date: today(), exerciseId, sets } });
    state.me.member.lifts = { ...(state.me.member.lifts || {}), [exerciseId]: list };
    return list;
  }

  async function weighIn(kg) {
    const r = await api('/api/member/weigh-in', { method: 'POST', body: { kg } });
    state.me.member.weighIns = r.weighIns;
    if (r.body) state.me.member.body = r.body;
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
      if (page === 'diet') return await dietView(params);
      if (page === 'coach') return await coachView(params);
      if (page === 'bmi') return await bmiView(params);
      if (page === 'supps') return await suppsView(params);
      if (page === 'progress') return await progressView(params);
      if (page === 'fees') return await feesView();
      if (page === 'profile') return await profileView();
      return await memberHome();
    } catch (e) {
      if (!state.token && e.status === 401) return;
      render(emptyState('alert', 'Something went wrong', e.message, '<a class="btn btn-primary" href="#/">Go home</a>'));
    }
  }

  // Native builds made without API_URL ask once for the gym's address: a gym code
  // on the platform the app was built for, or any server address.
  function connectView(error) {
    const platform = (window.APP_CONFIG?.platformUrl || '').replace(/\/+$/, '');
    view.innerHTML = `<div class="view" style="padding:calc(48px + env(safe-area-inset-top)) 24px 24px">
      <div class="empty" style="padding:0 0 20px"><div class="empty-icon">${icon('store')}</div><h3>Connect your gym</h3><p>${platform ? 'Enter your gym\u2019s code (ask the front desk), or its full web address.' : 'Enter your gym\u2019s address, for example https://yourdomain.com/g/your-gym'}</p></div>
      <form class="form" style="padding:0" novalidate><label class="field"><span>${platform ? 'Gym code or address' : 'Gym address'}</span><input class="input" name="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${platform ? 'e.g. fit-zone' : 'https://'}" value="${esc(store.get('serverUrlDraft', ''))}"></label>
      ${error ? `<p class="field-error">${esc(error)}</p>` : ''}<button class="btn btn-primary btn-block">Connect</button></form></div>`;
    const form = view.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let url = form.url.value.trim().replace(/\/(admin|index)(\.html)?$/, '').replace(/\/+$/, '');
      store.set('serverUrlDraft', url);
      if (platform && /^[a-z0-9-]+$/i.test(url)) url = `${platform}/g/${url.toLowerCase()}`;
      else if (url && !/^https?:\/\//.test(url)) url = `https://${url}`;
      if (!/^https?:\/\/./.test(url)) return connectView('Enter your gym\u2019s code or address');
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
    if (!window.APP_CONFIG?.demo && 'serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register(UI.url('/sw.js')).catch(() => {});
  }

  boot();
})();
