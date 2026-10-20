// Customer app: browse services, book a slot or a class, manage bookings.
(function () {
  const { esc, api, money, time12, dateLong, dateShort, dayName, dayNum, monthName, addDays, weekday, duration, initials, toast, sheet, confirmSheet, busy, store, DAYS, DAY_LABELS } = UI;

  const view = document.getElementById('view');
  const tabbar = document.getElementById('tabbar');
  const state = { data: null, draft: {}, cache: {} };
  const isGym = () => state.data.business.mode === 'gym';

  // ---- data helpers -------------------------------------------------------

  const service = (id) => state.data.services.find((s) => s.id === id);
  const staffMember = (id) => state.data.staff.find((s) => s.id === id);
  const category = (id) => state.data.categories.find((c) => c.id === id);
  const catIcon = (s) => icon(category(s.categoryId)?.icon || 'sparkles');
  const staffFor = (s) => (s.staffIds?.length ? state.data.staff.filter((m) => s.staffIds.includes(m.id)) : state.data.staff);

  const myBookings = () => store.get('myBookings', []);
  function rememberBooking(b) {
    const list = myBookings().filter((x) => x.id !== b.id);
    list.unshift({ id: b.id, token: b.token });
    store.set('myBookings', list.slice(0, 50));
    state.cache.bookings = null;
  }
  async function loadMyBookings(force) {
    if (state.cache.bookings && !force) return state.cache.bookings;
    const refs = myBookings();
    const results = await Promise.all(refs.map((r) => api(`/api/bookings/${r.id}?token=${r.token}`).then((b) => ({ ...b, token: r.token })).catch((e) => (e.status === 404 ? 'gone' : null))));
    // Forget bookings the server no longer knows about, keep the rest even if offline.
    store.set('myBookings', refs.filter((_, i) => results[i] !== 'gone'));
    state.cache.bookings = results.filter((b) => b && b !== 'gone');
    return state.cache.bookings;
  }
  const upcoming = (list) => list.filter((b) => b.status === 'confirmed' && !isPast(b)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  function nowHere() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: state.data.business.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: +parts.hour * 60 + +parts.minute };
  }
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  function isPast(b) {
    const n = nowHere();
    return b.date < n.date || (b.date === n.date && toMin(b.end) <= n.minutes);
  }

  function hoursFor(date) {
    const b = state.data.business;
    if ((b.closedDates || []).includes(date)) return [];
    return b.hours[DAYS[weekday(date)]] || [];
  }

  function openStatus() {
    const n = nowHere();
    const today = hoursFor(n.date);
    const current = today.find(([a, z]) => n.minutes >= toMin(a) && n.minutes < toMin(z));
    if (current) return { open: true, text: `Open now · until ${time12(current[1])}` };
    const later = today.find(([a]) => toMin(a) > n.minutes);
    if (later) return { open: false, text: `Closed · opens ${time12(later[0])}` };
    for (let i = 1; i <= 7; i++) {
      const d = addDays(n.date, i);
      const h = hoursFor(d);
      if (h.length) return { open: false, text: `Closed · opens ${i === 1 ? 'tomorrow' : dayName(d)} ${time12(h[0][0])}` };
    }
    return { open: false, text: 'Closed' };
  }

  function greeting() {
    const h = Math.floor(nowHere().minutes / 60);
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  // ---- shared fragments ---------------------------------------------------

  function serviceCard(s) {
    return `<button class="card svc" data-book="${esc(s.id)}">
      <div class="svc-icon">${catIcon(s)}</div>
      <div class="svc-body">
        <h3>${esc(s.name)}${s.popular ? ' <span class="badge badge-accent">Popular</span>' : ''}</h3>
        ${s.description ? `<p>${esc(s.description)}</p>` : ''}
        <div class="svc-meta"><span>${icon('clock')}${duration(s.duration)}</span><span class="svc-price">${money(s.price)}</span></div>
      </div>
      <span class="svc-add" aria-hidden="true">${icon('plus')}</span>
    </button>`;
  }

  function avatar(m, size = '') {
    return `<span class="avatar ${size}" style="--c:${esc(m.color || 'var(--accent)')}">${esc(initials(m.name))}</span>`;
  }

  function ratingHtml(r) {
    return r ? `<span class="rating">${icon('star')}${Number(r).toFixed(1)}</span>` : '';
  }

  function spotsHtml(c) {
    const pct = Math.round(((c.capacity - c.spotsLeft) / c.capacity) * 100);
    const low = c.spotsLeft > 0 && c.spotsLeft <= Math.max(2, Math.round(c.capacity * 0.2));
    return `<div class="spots${low ? ' low' : ''}"><div class="spots-bar"><i style="width:${pct}%"></i></div>
      <div class="spots-text"><span>${c.capacity - c.spotsLeft}/${c.capacity} booked</span><b>${c.spotsLeft ? `${c.spotsLeft} spot${c.spotsLeft === 1 ? '' : 's'} left` : 'Full'}</b></div></div>`;
  }

  function dateTile(date) {
    return `<div class="date-tile"><b>${dayNum(date)}</b><span>${monthName(date)}</span></div>`;
  }

  function statusBadge(b) {
    if (b.status === 'cancelled') return '<span class="badge badge-bad">Cancelled</span>';
    if (b.status === 'completed') return `<span class="badge badge-muted">${icon('check')}Completed</span>`;
    if (b.status === 'no-show') return '<span class="badge badge-warn">Missed</span>';
    if (isPast(b)) return '<span class="badge badge-muted">Past</span>';
    return '<span class="badge badge-good"><i class="dot"></i>Confirmed</span>';
  }

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
    const route = location.hash.split('?')[0] || '#/';
    const count = upcoming(state.cache.bookings || []).length;
    const tabs = [
      ['#/', 'home', 'Home'],
      ['#/services', isGym() ? 'dumbbell' : 'grid', 'Services'],
      ...(isGym() ? [['#/classes', 'calendar', 'Classes']] : []),
      ['#/bookings', 'ticket', 'Bookings', count],
    ];
    tabbar.innerHTML = tabs.map(([href, ic, label, n]) => `<a class="tab" href="${href}" ${route === href ? 'aria-current="page"' : ''}>${icon(ic)}${label}${n ? `<span class="count">${n}</span>` : ''}</a>`).join('');
  }

  // ---- home ---------------------------------------------------------------

  async function homeView() {
    const { business: b, services, staff, plans } = state.data;
    const status = openStatus();
    const popular = services.filter((s) => s.popular).slice(0, 4);
    const ratings = staff.map((s) => s.rating).filter(Boolean);
    const avg = ratings.length ? (ratings.reduce((a, c) => a + c, 0) / ratings.length).toFixed(1) : null;
    const minPrice = Math.min(...services.map((s) => s.price).filter(Boolean));

    render(`
      <header class="topbar">
        <div class="brand-mark" aria-hidden="true">${esc(b.name.charAt(0))}</div>
        <div class="brand-text"><h1>${esc(b.name)}</h1><span class="open-status ${status.open ? 'open' : 'closed'}"><i class="dot"></i>${esc(status.text)}</span></div>
        ${b.phone ? `<a class="icon-btn" href="tel:${esc(b.phone)}" aria-label="Call ${esc(b.name)}">${icon('phone')}</a>` : ''}
      </header>

      <section class="hero">
        <div class="hero-eyebrow">${greeting()} 👋</div>
        <h2>${isGym() ? 'Book your next session' : 'Book your next look'}</h2>
        <p>${esc(b.tagline)}</p>
        <a class="btn" href="#/services">${icon('calendar')}Book now</a>
        <div class="hero-stats">
          ${avg ? `<div><b>${avg} ★</b>Rating</div>` : ''}
          <div><b>${services.length}</b>Services</div>
          <div><b>${staff.length}</b>${isGym() ? 'Coaches' : 'Experts'}</div>
          ${Number.isFinite(minPrice) ? `<div><b>${money(minPrice)}</b>From</div>` : ''}
        </div>
      </section>

      <div id="next-up"></div>

      <section class="section">
        <div class="section-head"><h2>Categories</h2><a class="link" href="#/services">See all</a></div>
        <div class="scroller">${state.data.categories.map((c) => `<a class="cat-tile" href="#/services?cat=${esc(c.id)}"><span class="tile">${icon(c.icon)}</span><span>${esc(c.name)}</span></a>`).join('')}</div>
      </section>

      ${isGym() ? `<section class="section"><div class="section-head"><h2>Today's classes</h2><a class="link" href="#/classes">Full timetable</a></div><div class="scroller" id="today-classes"><div class="skel" style="width:210px;height:130px;flex:none"></div><div class="skel" style="width:210px;height:130px;flex:none"></div></div></section>` : ''}

      ${popular.length ? `<section class="section"><div class="section-head"><h2>Popular right now</h2><a class="link" href="#/services">All services</a></div><div class="svc-list">${popular.map(serviceCard).join('')}</div></section>` : ''}

      <section class="section">
        <div class="section-head"><h2>Meet the ${isGym() ? 'coaches' : 'team'}</h2></div>
        <div class="scroller">${staff.map((m) => `<a class="card team-card" href="#/services?staff=${esc(m.id)}">${avatar(m, 'lg')}<h3>${esc(m.name)}</h3><p>${esc(m.role)}</p>${ratingHtml(m.rating)}</a>`).join('')}</div>
      </section>

      ${plans.length ? `<section class="section"><div class="section-head"><h2>Memberships</h2></div><div class="scroller">${plans.map(planCard).join('')}</div></section>` : ''}

      <section class="section">
        <div class="section-head"><h2>Visit us</h2></div>
        ${infoCard()}
      </section>
      <div class="footer">© ${new Date().getFullYear()} ${esc(b.name)} · <a href="/admin.html">Owner login</a></div>
    `);

    loadMyBookings().then((list) => {
      renderTabs();
      const next = upcoming(list)[0];
      const slot = document.getElementById('next-up');
      if (next && slot) {
        slot.innerHTML = `<a class="card next-card" href="#/booking/${esc(next.id)}">${dateTile(next.date)}
          <div class="meta"><small>Your next visit</small><h3>${esc(next.serviceName)}</h3><p>${dayName(next.date)} · ${time12(next.start)}${next.staffName ? ` · ${esc(next.staffName)}` : ''}</p></div>${icon('chevronRight', 'muted')}</a>`;
      }
    }).catch(() => {});

    if (isGym()) {
      const today = nowHere().date;
      api(`/api/classes?date=${today}`).then((list) => {
        const el = document.getElementById('today-classes');
        if (!el) return;
        const open = list.filter((c) => !c.started);
        el.innerHTML = open.length
          ? open.map((c) => `<button class="card class-mini" data-class="${esc(c.id)}" data-date="${today}"><div class="time">${time12(c.start)} · ${duration(c.duration)}</div><h3>${esc(c.name)}</h3><p>${esc(staffMember(c.staffId)?.name || '')}</p>${spotsHtml(c)}</button>`).join('')
          : `<a class="card class-mini" href="#/classes"><div class="time">No more classes today</div><h3>See tomorrow's timetable</h3><p>Plan ahead and grab your spot.</p></a>`;
      }).catch(() => {});
    }
  }

  function planCard(p) {
    const b = state.data.business;
    const msg = `Hi ${b.name}! I'd like to join the ${p.name} membership (${money(p.price)} / ${p.period}).`;
    return `<div class="card plan${p.highlight ? ' highlight' : ''}">
      <h3>${esc(p.name)}${p.highlight ? ' <span class="badge badge-accent">Best value</span>' : ''}</h3>
      <div class="price tnum">${money(p.price)}</div><div class="muted">per ${esc(p.period)}</div>
      <ul>${p.features.map((f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul>
      ${b.whatsapp ? `<a class="btn btn-ghost btn-block" href="${UI.waLink(b.whatsapp, msg)}" target="_blank" rel="noopener">${icon('whatsapp')}Join on WhatsApp</a>` : b.phone ? `<a class="btn btn-ghost btn-block" href="tel:${esc(b.phone)}">${icon('phone')}Call to join</a>` : ''}
    </div>`;
  }

  function infoCard() {
    const b = state.data.business;
    const today = DAYS[weekday(nowHere().date)];
    const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    return `<div class="card info-card">
      ${b.address ? `<a class="info-row" href="${esc(b.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(b.address)}`)}" target="_blank" rel="noopener"><span class="ic">${icon('pin')}</span><span class="tx"><b>Address</b><span>${esc(b.address)}</span></span>${icon('external', 'muted')}</a>` : ''}
      <div class="info-row" style="align-items:flex-start"><span class="ic">${icon('clock')}</span><div class="tx"><b>Opening hours</b>
        <table class="hours">${order.map((d) => {
          const h = b.hours[d] || [];
          return `<tr class="${d === today ? 'today' : ''}"><td>${DAY_LABELS[d]}</td><td>${h.length ? h.map(([a, z]) => `${time12(a)} – ${time12(z)}`).join('<br>') : 'Closed'}</td></tr>`;
        }).join('')}</table></div></div>
      ${b.phone ? `<a class="info-row" href="tel:${esc(b.phone)}"><span class="ic">${icon('phone')}</span><span class="tx"><b>Call us</b><span>${esc(b.phone)}</span></span>${icon('chevronRight', 'muted')}</a>` : ''}
      ${b.whatsapp ? `<a class="info-row" href="${UI.waLink(b.whatsapp, `Hi ${b.name}!`)}" target="_blank" rel="noopener"><span class="ic">${icon('whatsapp')}</span><span class="tx"><b>WhatsApp</b><span>Chat with us</span></span>${icon('chevronRight', 'muted')}</a>` : ''}
      ${b.instagram ? `<a class="info-row" href="https://instagram.com/${esc(b.instagram)}" target="_blank" rel="noopener"><span class="ic">${icon('instagram')}</span><span class="tx"><b>Instagram</b><span>@${esc(b.instagram)}</span></span>${icon('external', 'muted')}</a>` : ''}
    </div>`;
  }

  // ---- services -----------------------------------------------------------

  function servicesView(params) {
    const cat = params.get('cat') || 'all';
    const staffId = params.get('staff');
    const member = staffId && staffMember(staffId);
    render(`
      <div class="page-title"><h1>${member ? `Book with ${esc(member.name.split(' ')[0])}` : 'Services'}</h1><p>${member ? esc(member.role) : 'Pick a service to see open times.'}</p></div>
      <div class="search input-group">${icon('search')}<input class="input" type="search" id="q" placeholder="Search services" aria-label="Search services" autocomplete="off"></div>
      <div class="chips" role="group" aria-label="Categories">
        <button class="chip" data-cat="all" aria-pressed="${cat === 'all'}">All</button>
        ${state.data.categories.map((c) => `<button class="chip" data-cat="${esc(c.id)}" aria-pressed="${cat === c.id}">${icon(c.icon)}${esc(c.name)}</button>`).join('')}
      </div>
      <div id="svc-results"></div>
    `);
    const results = document.getElementById('svc-results');
    const q = document.getElementById('q');
    let currentCat = cat;
    const draw = () => {
      const term = q.value.trim().toLowerCase();
      let list = state.data.services.filter((s) => (currentCat === 'all' || s.categoryId === currentCat)
        && (!term || `${s.name} ${s.description}`.toLowerCase().includes(term))
        && (!member || staffFor(s).some((m) => m.id === member.id)));
      if (!list.length) {
        results.innerHTML = emptyState('search', 'Nothing found', term ? `No services match “${term}”.` : 'No services in this category yet.');
        return;
      }
      if (currentCat === 'all' && !term) {
        results.innerHTML = state.data.categories.map((c) => {
          const items = list.filter((s) => s.categoryId === c.id);
          return items.length ? `<div class="group-title">${esc(c.name)}</div><div class="svc-list">${items.map(serviceCard).join('')}</div>` : '';
        }).join('');
      } else {
        results.innerHTML = `<div class="svc-list" style="margin-top:14px">${list.map(serviceCard).join('')}</div>`;
      }
    };
    q.addEventListener('input', draw);
    view.querySelectorAll('[data-cat]').forEach((chip) => chip.addEventListener('click', () => {
      currentCat = chip.dataset.cat;
      view.querySelectorAll('[data-cat]').forEach((c) => c.setAttribute('aria-pressed', c === chip));
      chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      draw();
    }));
    state.draft.presetStaff = member ? member.id : null;
    draw();
  }

  // ---- booking flow -------------------------------------------------------

  function flowSteps(s) {
    return staffFor(s).length > 1 ? ['staff', 'time', 'details'] : ['time', 'details'];
  }

  function startBooking(serviceId) {
    const s = service(serviceId);
    if (!s) return;
    const team = staffFor(s);
    const preset = state.draft.presetStaff && team.some((m) => m.id === state.draft.presetStaff) ? state.draft.presetStaff : null;
    state.draft = { serviceId, staffId: team.length === 1 ? team[0].id : preset || 'any', date: null, time: null };
    location.hash = `#/book/${serviceId}/${flowSteps(s)[0]}`;
  }

  function flowShell(s, step, body, cta) {
    const steps = flowSteps(s);
    const idx = steps.indexOf(step);
    const titles = { staff: 'Choose professional', time: 'Pick a time', details: 'Your details' };
    render(`
      <header class="flow-head">
        <div class="row"><button class="icon-btn" data-back aria-label="Back">${icon('chevronLeft')}</button><h1>${titles[step]}</h1><span class="step">Step ${idx + 1} of ${steps.length}</span></div>
        <div class="progress" aria-hidden="true">${steps.map((_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</div>
      </header>
      <div class="card summary"><div class="svc-icon">${catIcon(s)}</div><div class="tx"><h3>${esc(s.name)}</h3><p>${duration(s.duration)} · ${money(s.price)}</p></div><a class="link" href="#/services">Change</a></div>
      ${body}
      <div class="cta-bar">${cta}</div>
    `, { tabs: false });
    view.querySelector('[data-back]').addEventListener('click', () => {
      if (idx > 0) location.hash = `#/book/${s.id}/${steps[idx - 1]}`;
      else history.length > 1 ? history.back() : (location.hash = '#/services');
    });
  }

  function ctaSummary(s) {
    const d = state.draft;
    const who = d.staffId === 'any' ? 'Any professional' : staffMember(d.staffId)?.name;
    const when = d.date && d.time ? `${dateShort(d.date)} · ${time12(d.time)}` : who;
    return `<div class="tx"><b>${money(s.price)}</b><span>${esc(when)}</span></div>`;
  }

  function staffStep(s) {
    const team = staffFor(s);
    const d = state.draft;
    flowShell(s, 'staff', `
      <h2 class="step-title">Who would you like?</h2>
      <div class="pick-list" role="radiogroup" aria-label="Professional">
        <button class="card pick" role="radio" data-staff="any" aria-checked="${d.staffId === 'any'}"><span class="any-avatar">${icon('users')}</span><span class="tx"><b>Any professional</b><span>Most availability · we'll match you</span></span><span class="radio"></span></button>
        ${team.map((m) => `<button class="card pick" role="radio" data-staff="${esc(m.id)}" aria-checked="${d.staffId === m.id}">${avatar(m)}<span class="tx"><b>${esc(m.name)}</b><span>${esc(m.role)}${m.daysOff?.length ? ` · off ${m.daysOff.map((x) => DAY_LABELS[x].slice(0, 3)).join(', ')}` : ''}</span></span>${ratingHtml(m.rating)}<span class="radio"></span></button>`).join('')}
      </div>`, `${ctaSummary(s)}<button class="btn btn-primary" data-next>Continue${icon('chevronRight')}</button>`);
    view.querySelectorAll('[data-staff]').forEach((el) => el.addEventListener('click', () => {
      d.staffId = el.dataset.staff;
      d.time = null;
      view.querySelectorAll('[data-staff]').forEach((x) => x.setAttribute('aria-checked', x === el));
      view.querySelector('.cta-bar .tx').outerHTML = ctaSummary(s);
    }));
    view.querySelector('[data-next]').addEventListener('click', () => { location.hash = `#/book/${s.id}/time`; });
  }

  async function timeStep(s) {
    const d = state.draft;
    if (!d.serviceId || d.serviceId !== s.id) state.draft = { serviceId: s.id, staffId: staffFor(s).length === 1 ? staffFor(s)[0].id : 'any' };
    const draft = state.draft;
    flowShell(s, 'time', `
      <h2 class="step-title">When suits you?</h2>
      <div class="month-label" id="month-label">&nbsp;</div>
      <div class="dates" id="dates" role="group" aria-label="Date">${Array.from({ length: 7 }, () => '<div class="skel" style="width:60px;height:74px;flex:none;border-radius:18px"></div>').join('')}</div>
      <div id="slots"></div>`,
      `${ctaSummary(s)}<button class="btn btn-primary" data-next ${draft.time ? '' : 'disabled'}>Continue${icon('chevronRight')}</button>`);

    const next = view.querySelector('[data-next]');
    next.addEventListener('click', () => { location.hash = `#/book/${s.id}/details`; });
    let days;
    try {
      days = await api(`/api/calendar?serviceId=${s.id}&staffId=${draft.staffId}`);
    } catch (e) {
      document.getElementById('slots').innerHTML = emptyState('alert', 'Could not load times', e.message);
      return;
    }
    const firstOpen = days.find((x) => x.slots > 0);
    if (!draft.date || !days.some((x) => x.date === draft.date && x.slots > 0)) draft.date = firstOpen?.date || days[0].date;
    const datesEl = document.getElementById('dates');
    const today = nowHere().date;
    datesEl.innerHTML = days.map((x) => `<button class="date-btn" data-date="${x.date}" aria-pressed="${x.date === draft.date}" ${x.slots ? '' : 'disabled'} aria-label="${dateLong(x.date)}${x.slots ? '' : ', fully booked or closed'}">
      <small>${x.date === today ? 'Today' : x.date === addDays(today, 1) ? 'Tmrw' : dayName(x.date)}</small><b>${dayNum(x.date)}</b><i></i></button>`).join('');
    if (!firstOpen) {
      document.getElementById('slots').innerHTML = emptyState('calendar', 'No openings', 'Everything is booked for the next few weeks. Try another professional, or contact us directly.');
      return;
    }
    const selectDate = async (date, scroll) => {
      draft.date = date;
      document.getElementById('month-label').textContent = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
      datesEl.querySelectorAll('[data-date]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.date === date));
      if (scroll) datesEl.querySelector(`[data-date="${date}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      await loadSlots();
    };
    const loadSlots = async () => {
      const slotsEl = document.getElementById('slots');
      slotsEl.innerHTML = `<div class="slot-group"><div class="slots">${Array.from({ length: 8 }, () => '<div class="skel" style="height:46px"></div>').join('')}</div></div>`;
      const date = draft.date;
      const res = await api(`/api/availability?serviceId=${s.id}&staffId=${draft.staffId}&date=${date}`).catch((e) => ({ error: e.message }));
      if (draft.date !== date) return;
      if (res.error) { slotsEl.innerHTML = emptyState('alert', 'Could not load times', res.error); return; }
      if (!res.slots.some((x) => x.time === draft.time)) { draft.time = null; next.disabled = true; }
      if (!res.slots.length) {
        const later = days.find((x) => x.date > date && x.slots > 0);
        slotsEl.innerHTML = emptyState('calendar', 'Fully booked', 'No times left on this day.', later ? `<button class="btn btn-soft" data-jump="${later.date}">Next available: ${dateShort(later.date)}</button>` : '');
        slotsEl.querySelector('[data-jump]')?.addEventListener('click', (e) => selectDate(e.currentTarget.dataset.jump, true));
        return;
      }
      const groups = [['Morning', 'sun', (m) => m < 720], ['Afternoon', 'sunset', (m) => m >= 720 && m < 1020], ['Evening', 'moon', (m) => m >= 1020]];
      slotsEl.innerHTML = groups.map(([label, ic, test]) => {
        const items = res.slots.filter((x) => test(toMin(x.time)));
        return items.length ? `<div class="slot-group"><h4>${icon(ic)}${label}<span class="muted" style="font-weight:600">· ${items.length} open</span></h4><div class="slots">${items.map((x) => `<button class="slot tnum" data-time="${x.time}" aria-pressed="${x.time === draft.time}">${time12(x.time)}</button>`).join('')}</div></div>` : '';
      }).join('');
      slotsEl.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => {
        draft.time = b.dataset.time;
        slotsEl.querySelectorAll('[data-time]').forEach((x) => x.setAttribute('aria-pressed', x === b));
        next.disabled = false;
        view.querySelector('.cta-bar .tx').outerHTML = ctaSummary(s);
      }));
    };
    datesEl.querySelectorAll('[data-date]').forEach((b) => b.addEventListener('click', () => selectDate(b.dataset.date)));
    selectDate(draft.date, true);
  }

  function customerFields(profile) {
    return `<label class="field"><span>Full name</span><input class="input" name="name" autocomplete="name" required maxlength="60" value="${esc(profile.name || '')}" placeholder="e.g. Ahmed Khan"></label>
      <label class="field"><span>Mobile number</span><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" value="${esc(profile.phone || '')}" placeholder="03xx xxxxxxx"><small>We'll only use this to confirm or change your booking.</small></label>`;
  }

  function validateCustomer(form) {
    const name = form.name.value.trim();
    const phone = form.phone.value.replace(/[\s()-]/g, '');
    form.name.classList.toggle('invalid', !name);
    const phoneOk = /^\+?\d{7,15}$/.test(phone);
    form.phone.classList.toggle('invalid', !phoneOk);
    if (!name) { form.name.focus(); toast('Please enter your name', 'bad'); return null; }
    if (!phoneOk) { form.phone.focus(); toast('Please enter a valid mobile number', 'bad'); return null; }
    return { name, phone };
  }

  function detailsStep(s) {
    const d = state.draft;
    if (d.serviceId !== s.id || !d.date || !d.time) { location.replace(`#/book/${s.id}/time`); return; }
    const profile = store.get('profile', {});
    const who = d.staffId === 'any' ? 'Any professional' : staffMember(d.staffId)?.name;
    const notice = state.data.business.cancelNoticeMinutes;
    flowShell(s, 'details', `
      <h2 class="step-title">Almost done</h2>
      <form class="form" id="details" novalidate>
        ${customerFields(profile)}
        <label class="field"><span>Notes <span class="muted" style="font-weight:500">(optional)</span></span><textarea class="textarea" name="note" maxlength="300" placeholder="Anything we should know?"></textarea></label>
      </form>
      <div class="card recap">
        <div class="recap-row"><span>Date</span><b>${dateLong(d.date)}</b></div>
        <div class="recap-row"><span>Time</span><b>${time12(d.time)}</b></div>
        <div class="recap-row"><span>With</span><b>${esc(who)}</b></div>
        <div class="recap-row"><span>Duration</span><b>${duration(s.duration)}</b></div>
        <div class="recap-row total"><span>Total</span><b>${money(s.price)}</b></div>
      </div>
      <div class="policy">${icon('info')}<span>Pay at the ${isGym() ? 'front desk' : 'salon'}. ${notice ? `Free cancellation up to ${notice >= 60 ? `${notice / 60} hour${notice === 60 ? '' : 's'}` : `${notice} minutes`} before.` : 'Cancel any time before your visit.'}</span></div>`,
      `${ctaSummary(s)}<button class="btn btn-primary" data-confirm>Confirm booking</button>`);

    const form = document.getElementById('details');
    const submit = async () => {
      const customer = validateCustomer(form);
      if (!customer) return;
      await busy(view.querySelector('[data-confirm]'), async () => {
        try {
          const booking = await api('/api/bookings', { method: 'POST', body: { type: 'service', serviceId: s.id, staffId: d.staffId, date: d.date, time: d.time, ...customer, note: form.note.value } });
          store.set('profile', customer);
          rememberBooking(booking);
          state.draft = {};
          location.replace(`#/done/${booking.id}`);
        } catch (e) {
          toast(e.message, 'bad');
          if (e.status === 409) { d.time = null; setTimeout(() => { location.hash = `#/book/${s.id}/time`; }, 900); }
        }
      });
    };
    view.querySelector('[data-confirm]').addEventListener('click', submit);
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  }

  // ---- classes ------------------------------------------------------------

  async function classesView(params) {
    const today = nowHere().date;
    const window = Math.min(state.data.business.bookingWindowDays || 14, 21);
    const days = Array.from({ length: window }, (_, i) => addDays(today, i));
    let date = days.includes(params.get('date')) ? params.get('date') : today;
    render(`
      <div class="page-title"><h1>Class timetable</h1><p>Reserve your spot. Spaces are limited.</p></div>
      <div class="section" style="margin-top:18px">
        <div class="dates" id="dates" role="group" aria-label="Date">${days.map((x) => `<button class="date-btn" data-date="${x}" aria-pressed="${x === date}" aria-label="${dateLong(x)}"><small>${x === today ? 'Today' : dayName(x)}</small><b>${dayNum(x)}</b><i></i></button>`).join('')}</div>
      </div>
      <div id="class-list" class="bk-list"></div>
    `);
    const listEl = document.getElementById('class-list');
    const mine = await loadMyBookings().catch(() => []);
    const draw = async () => {
      listEl.innerHTML = Array.from({ length: 3 }, () => '<div class="skel" style="height:150px;border-radius:22px"></div>').join('');
      const current = date;
      const list = await api(`/api/classes?date=${date}`).catch((e) => ({ error: e.message }));
      if (current !== date) return;
      if (list.error) { listEl.innerHTML = emptyState('alert', 'Could not load classes', list.error); return; }
      if (!list.length) { listEl.innerHTML = emptyState('calendar', 'No classes', `Nothing scheduled on ${dateLong(date)}.`); return; }
      listEl.innerHTML = list.map((c) => {
        const booked = mine.find((b) => b.classId === c.id && b.date === date && b.status === 'confirmed');
        const coach = staffMember(c.staffId);
        let action;
        if (booked) action = `<a class="btn btn-soft btn-sm" href="#/booking/${esc(booked.id)}">${icon('check')}You're in</a>`;
        else if (c.started) action = '<span class="badge badge-muted">Started</span>';
        else if (!c.spotsLeft) action = '<span class="badge badge-bad">Full</span>';
        else action = `<button class="btn btn-primary btn-sm" data-class="${esc(c.id)}" data-date="${date}">Book spot</button>`;
        return `<div class="card class-row">
          <div class="class-time"><b>${time12(c.start).replace(' ', '<br>')}</b><span>${c.duration} min</span></div>
          <div class="class-body"><h3>${esc(c.name)}</h3>
            <div class="sub">${coach ? `${avatar(coach, 'sm')}${esc(coach.name)} · ` : ''}${esc(c.level || '')}</div>
            ${spotsHtml(c)}
            <div class="class-actions"><b>${c.price ? money(c.price) : '<span class="muted">Included</span>'}</b>${action}</div>
          </div></div>`;
      }).join('');
    };
    document.querySelectorAll('#dates [data-date]').forEach((b) => b.addEventListener('click', () => {
      date = b.dataset.date;
      document.querySelectorAll('#dates [data-date]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      history.replaceState(null, '', `#/classes?date=${date}`);
      draw();
    }));
    document.querySelector(`#dates [data-date="${date}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
    draw();
  }

  async function bookClass(classId, date) {
    const list = await api(`/api/classes?date=${date}`).catch(() => []);
    const c = list.find((x) => x.id === classId);
    if (!c) return toast('That class is not available any more', 'bad');
    const coach = staffMember(c.staffId);
    const profile = store.get('profile', {});
    sheet({
      title: 'Reserve your spot',
      html: `<div class="card summary" style="margin:0 0 18px"><div class="svc-icon">${icon('flame')}</div><div class="tx"><h3>${esc(c.name)}</h3><p>${dateShort(date)} · ${time12(c.start)} · ${c.duration} min${coach ? ` · ${esc(coach.name)}` : ''}</p></div></div>
        <form class="form" style="padding:0" novalidate>${customerFields(profile)}</form>
        ${spotsHtml(c)}
        <div class="sheet-actions"><button class="btn btn-primary" data-ok>Confirm · ${c.price ? money(c.price) : 'Free'}</button></div>`,
      onMount: (root, close) => {
        const form = root.querySelector('form');
        const go = async () => {
          const customer = validateCustomer(form);
          if (!customer) return;
          await busy(root.querySelector('[data-ok]'), async () => {
            try {
              const booking = await api('/api/bookings', { method: 'POST', body: { type: 'class', classId, date, ...customer } });
              store.set('profile', customer);
              rememberBooking(booking);
              close();
              location.hash = `#/done/${booking.id}`;
            } catch (e) { toast(e.message, 'bad'); }
          });
        };
        root.querySelector('[data-ok]').addEventListener('click', go);
        form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
      },
    });
  }

  // ---- confirmation & bookings ---------------------------------------------

  async function getBooking(id) {
    const ref = myBookings().find((r) => r.id === id);
    if (!ref) return null;
    return { ...(await api(`/api/bookings/${id}?token=${ref.token}`)), token: ref.token };
  }

  function ticket(b) {
    const biz = state.data.business;
    return `<div class="card ticket">
      <div class="ticket-top"><div class="svc-icon">${b.type === 'class' ? icon('flame') : service(b.serviceId) ? catIcon(service(b.serviceId)) : icon('sparkles')}</div>
        <div><h3>${esc(b.serviceName)}</h3><p>${esc(biz.name)}</p></div></div>
      <div class="ticket-grid">
        <div><span>Date</span><b>${dateShort(b.date)}</b></div>
        <div><span>Time</span><b>${time12(b.start)} – ${time12(b.end)}</b></div>
        <div><span>${b.type === 'class' ? 'Coach' : 'With'}</span><b>${esc(b.staffName || '—')}</b></div>
        <div><span>Price</span><b>${money(b.price)}</b></div>
        <div style="grid-column:1/-1"><span>Booked for</span><b>${esc(b.customer.name)} · ${esc(b.customer.phone)}</b></div>
      </div></div>`;
  }

  function shareText(b) {
    const biz = state.data.business;
    return `Hi ${biz.name}! I just booked ${b.serviceName} on ${dateShort(b.date)} at ${time12(b.start)}${b.staffName ? ` with ${b.staffName}` : ''}. Booking code: ${b.code}. Name: ${b.customer.name}.`;
  }

  async function doneView(id) {
    const b = await getBooking(id).catch(() => null);
    if (!b) return (location.hash = '#/bookings');
    const biz = state.data.business;
    render(`
      <div class="success">
        <div class="check-anim"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
        <h1>You're booked!</h1>
        <p>${b.anyStaff ? `We've matched you with ${esc(b.staffName)}. ` : ''}See you ${dateLong(b.date)}.</p>
        <div class="code-box"><span>Booking code</span><b>${esc(b.code)}</b></div>
      </div>
      ${ticket(b)}
      <div class="actions">
        <button class="btn btn-ghost" data-ics>${icon('calendar')}Calendar</button>
        ${biz.whatsapp ? `<a class="btn btn-ghost" href="${UI.waLink(biz.whatsapp, shareText(b))}" target="_blank" rel="noopener">${icon('whatsapp')}Send to us</a>` : `<a class="btn btn-ghost" href="${esc(biz.mapUrl || '#/')}" target="_blank" rel="noopener">${icon('pin')}Directions</a>`}
        <a class="btn btn-primary full" href="#/bookings">View my bookings</a>
        <a class="btn btn-ghost full" href="#/">Back to home</a>
      </div>
    `, { tabs: false });
    view.querySelector('[data-ics]').addEventListener('click', () => UI.icsFor(b, biz));
  }

  async function bookingsView(params) {
    const tab = params.get('tab') === 'past' ? 'past' : 'upcoming';
    render(`
      <div class="page-title"><h1>My bookings</h1><p>Saved on this device.</p></div>
      <div class="tabs" role="tablist"><button role="tab" data-tab="upcoming" aria-selected="${tab === 'upcoming'}">Upcoming</button><button role="tab" data-tab="past" aria-selected="${tab === 'past'}">Past</button></div>
      <div class="bk-list" id="bk-list">${Array.from({ length: 3 }, () => '<div class="skel" style="height:86px;border-radius:22px"></div>').join('')}</div>
      <div style="text-align:center;padding:22px 20px 0"><button class="link" data-find>${icon('search')} Find a booking with your code</button></div>
    `);
    view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.replace(`#/bookings?tab=${b.dataset.tab}`); }));
    view.querySelector('[data-find]').addEventListener('click', findBooking);
    let list;
    try {
      list = await loadMyBookings(true);
    } catch {
      list = [];
    }
    renderTabs();
    const up = upcoming(list);
    const past = list.filter((b) => !up.includes(b)).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
    const items = tab === 'upcoming' ? up : past;
    const el = document.getElementById('bk-list');
    if (!items.length) {
      el.innerHTML = tab === 'upcoming'
        ? emptyState('calendar', 'No upcoming bookings', 'When you book, your appointments show up here.', `<a class="btn btn-primary" href="#/services">Book now</a>`)
        : emptyState('clock', 'No past bookings', 'Your booking history will appear here.');
      return;
    }
    el.innerHTML = items.map((b) => `<a class="card bk${tab === 'past' ? ' past' : ''}" href="#/booking/${esc(b.id)}">${dateTile(b.date)}
      <div class="meta"><h3>${esc(b.serviceName)}</h3><p>${dayName(b.date)} · ${time12(b.start)}${b.staffName ? ` · ${esc(b.staffName)}` : ''}</p>${statusBadge(b)}</div>${icon('chevronRight', 'muted')}</a>`).join('');
  }

  function findBooking() {
    const profile = store.get('profile', {});
    sheet({
      title: 'Find a booking',
      html: `<form class="form" style="padding:0" novalidate>
        <label class="field"><span>Booking code</span><input class="input" name="code" maxlength="10" autocapitalize="characters" placeholder="e.g. K7M2QX" style="text-transform:uppercase;letter-spacing:.1em" required></label>
        <label class="field"><span>Mobile number used to book</span><input class="input" name="phone" type="tel" inputmode="tel" value="${esc(profile.phone || '')}" required></label>
      </form><div class="sheet-actions"><button class="btn btn-primary" data-ok>Find booking</button></div>`,
      onMount: (root, close) => {
        const form = root.querySelector('form');
        const go = () => busy(root.querySelector('[data-ok]'), async () => {
          try {
            const b = await api('/api/bookings/lookup', { method: 'POST', body: { code: form.code.value, phone: form.phone.value } });
            rememberBooking(b);
            close();
            location.hash = `#/booking/${b.id}`;
          } catch (e) { toast(e.message, 'bad'); }
        });
        root.querySelector('[data-ok]').addEventListener('click', go);
        form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
      },
    });
  }

  async function bookingDetailView(id) {
    render(`<div class="boot"><div class="skel" style="height:300px;border-radius:22px"></div></div>`, { tabs: false });
    let b;
    try {
      b = await getBooking(id);
    } catch (e) {
      render(`<header class="page-head"><a class="icon-btn" href="#/bookings" aria-label="Back">${icon('chevronLeft')}</a><h1>Booking</h1></header>${emptyState('alert', 'Could not load booking', e.message)}`, { tabs: false });
      return;
    }
    if (!b) return location.replace('#/bookings');
    const biz = state.data.business;
    const active = b.status === 'confirmed' && !isPast(b);
    render(`
      <header class="page-head"><button class="icon-btn" data-back aria-label="Back">${icon('chevronLeft')}</button><h1>Booking</h1>${statusBadge(b)}</header>
      <div style="text-align:center;margin-top:6px"><div class="code-box"><span>Booking code</span><b>${esc(b.code)}</b></div></div>
      ${ticket(b)}
      ${b.note ? `<div class="policy">${icon('edit')}<span>${esc(b.note)}</span></div>` : ''}
      <div class="detail-actions">
        ${active ? `<div class="actions" style="padding:0;margin:0"><button class="btn btn-ghost" data-ics>${icon('calendar')}Calendar</button><a class="btn btn-ghost" href="${esc(biz.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(biz.address || biz.name)}`)}" target="_blank" rel="noopener">${icon('pin')}Directions</a></div>` : ''}
        ${b.type === 'service' && service(b.serviceId) ? `<button class="btn btn-primary" data-again>${icon('refresh')}${active ? 'Book another' : 'Book again'}</button>` : ''}
        ${biz.phone ? `<a class="btn btn-ghost" href="tel:${esc(biz.phone)}">${icon('phone')}Call ${esc(biz.name)}</a>` : ''}
        ${active ? `<button class="btn btn-danger" data-cancel>${icon('x')}Cancel booking</button>` : ''}
      </div>
    `, { tabs: false });
    view.querySelector('[data-back]').addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = '#/bookings')));
    view.querySelector('[data-ics]')?.addEventListener('click', () => UI.icsFor(b, biz));
    view.querySelector('[data-again]')?.addEventListener('click', () => { state.draft.presetStaff = b.staffId; startBooking(b.serviceId); });
    view.querySelector('[data-cancel]')?.addEventListener('click', async () => {
      const ok = await confirmSheet({ title: 'Cancel this booking?', message: `${b.serviceName} on ${dateLong(b.date)} at ${time12(b.start)}. This frees the slot for someone else.`, confirm: 'Yes, cancel', danger: true });
      if (!ok) return;
      try {
        await api(`/api/bookings/${b.id}/cancel`, { method: 'POST', body: { token: b.token } });
        state.cache.bookings = null;
        toast('Booking cancelled');
        bookingDetailView(id);
      } catch (e) { toast(e.message, 'bad'); }
    });
  }

  // ---- router -------------------------------------------------------------

  async function route() {
    const [path, query] = (location.hash.slice(1) || '/').split('?');
    const params = new URLSearchParams(query || '');
    const parts = path.split('/').filter(Boolean);
    window.scrollTo(0, 0);
    try {
      if (!parts.length) return await homeView();
      if (parts[0] === 'services') return servicesView(params);
      if (parts[0] === 'classes' && isGym()) return await classesView(params);
      if (parts[0] === 'bookings') return await bookingsView(params);
      if (parts[0] === 'booking' && parts[1]) return await bookingDetailView(parts[1]);
      if (parts[0] === 'done' && parts[1]) return await doneView(parts[1]);
      if (parts[0] === 'book' && service(parts[1])) {
        const s = service(parts[1]);
        const step = flowSteps(s).includes(parts[2]) ? parts[2] : flowSteps(s)[0];
        if (step === 'staff') return staffStep(s);
        if (step === 'time') return await timeStep(s);
        return detailsStep(s);
      }
      location.replace('#/');
    } catch (e) {
      render(emptyState('alert', 'Something went wrong', e.message, '<a class="btn btn-primary" href="#/">Go home</a>'));
    }
  }

  // Delegated taps for service cards and class cards, wherever they appear.
  view.addEventListener('click', (e) => {
    const book = e.target.closest('[data-book]');
    if (book) { e.preventDefault(); startBooking(book.dataset.book); return; }
    const cls = e.target.closest('button[data-class]');
    if (cls) { e.preventDefault(); bookClass(cls.dataset.class, cls.dataset.date); }
  });

  function offlineBanner() {
    let bar = document.querySelector('.offline-bar');
    if (navigator.onLine) { bar?.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'offline-bar';
      bar.textContent = "You're offline. Bookings need a connection.";
      document.body.prepend(bar);
    }
  }

  // Native builds made without API_URL ask once for the shop's server address.
  function connectView(error) {
    view.innerHTML = `<div class="view" style="padding:calc(48px + env(safe-area-inset-top)) 24px 24px">
      <div class="empty" style="padding:0 0 20px"><div class="empty-icon">${icon('store')}</div><h3>Connect your business</h3><p>Enter the address of your booking server, for example https://book.yourshop.com</p></div>
      <form class="form" style="padding:0" novalidate><label class="field"><span>Server address</span><input class="input" name="url" type="url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="https://" value="${esc(UI.store.get('serverUrlDraft', ''))}"></label>
      ${error ? `<p class="field-error">${esc(error)}</p>` : ''}<button class="btn btn-primary btn-block">Connect</button></form></div>`;
    const form = view.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = form.url.value.trim().replace(/\/+$/, '');
      store.set('serverUrlDraft', url);
      if (!/^https?:\/\/./.test(url)) return connectView('The address must start with https://');
      try { localStorage.setItem('serverUrl', url); } catch { /* ignore */ }
      boot();
    });
  }

  let booted = false;
  async function boot() {
    if (window.APP_CONFIG?.native && !UI.apiBase()) return connectView();
    try {
      state.data = await api('/api/business');
    } catch (e) {
      if (window.APP_CONFIG?.native && !window.APP_CONFIG.apiBase) {
        try { localStorage.removeItem('serverUrl'); } catch { /* ignore */ }
        return connectView(`Could not reach that server. ${e.message}`);
      }
      view.innerHTML = emptyState('alert', "Can't connect", e.message, '<button class="btn btn-primary" data-retry>Try again</button>');
      view.querySelector('[data-retry]').addEventListener('click', () => location.reload());
      return;
    }
    const b = state.data.business;
    UI.setBusiness(b);
    UI.setAccent(b.accent);
    document.title = `${b.name} · Book online`;
    if (!booted) {
      booted = true;
      window.addEventListener('hashchange', route);
      window.addEventListener('online', offlineBanner);
      window.addEventListener('offline', offlineBanner);
    }
    offlineBanner();
    route();
    if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  boot();
})();
