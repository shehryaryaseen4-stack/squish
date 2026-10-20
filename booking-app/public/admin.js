// Owner dashboard: today at a glance, schedule, bookings, catalogue and settings.
(function () {
  const { esc, api: rawApi, money, time12, dateLong, dateShort, dayName, addDays, weekday, duration, initials, toast, sheet, confirmSheet, busy, store, DAYS, DAY_LABELS } = UI;

  const root = document.getElementById('root');
  const S = { token: store.get('adminToken', null), data: null };
  const isGym = () => S.data.business.mode === 'gym';
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const PRESETS = ['#7c5cff', '#e5487f', '#f97316', '#0ea5a4', '#2563eb', '#16a34a', '#111827', '#b45309'];

  async function api(path, opts = {}) {
    try {
      return await rawApi(path, { ...opts, token: S.token });
    } catch (e) {
      if (e.status === 401 && S.token) { signOut(); throw new Error('Session expired. Please sign in again.'); }
      throw e;
    }
  }

  function nowHere() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: S.data.business.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: +parts.hour * 60 + +parts.minute };
  }
  const today = () => nowHere().date;
  const staffById = (id) => S.data.staff.find((s) => s.id === id);
  const avatar = (m, size = '') => `<span class="avatar ${size}" style="--c:${esc(m?.color || '#888')}">${esc(initials(m?.name || '?'))}</span>`;

  function statusBadge(s) {
    return {
      confirmed: '<span class="badge badge-good"><i class="dot"></i>Confirmed</span>',
      completed: `<span class="badge badge-muted">${icon('check')}Done</span>`,
      'no-show': '<span class="badge badge-warn">No-show</span>',
      cancelled: '<span class="badge badge-bad">Cancelled</span>',
    }[s] || '';
  }

  // ---- auth ---------------------------------------------------------------

  async function loginView() {
    let business = { name: 'Dashboard', accent: '#7c5cff' };
    try { business = (await rawApi('/api/business')).business; } catch { /* still allow sign-in */ }
    UI.setAccent(business.accent);
    let pin = '';
    root.innerHTML = `<div class="login"><div class="login-card">
      <div class="brand-mark">${esc(business.name.charAt(0))}</div>
      <h1>${esc(business.name)}</h1><p>Enter your owner PIN</p>
      <div class="pin-dots" aria-live="polite" aria-label="PIN entered">${'<i></i>'.repeat(4)}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key" data-k="${n}">${n}</button>`).join('')}
        <button class="key ghost" data-k="ok" aria-label="Sign in">${icon('chevronRight')}</button><button class="key" data-k="0">0</button><button class="key ghost" data-k="del" aria-label="Delete">${icon('backspace')}</button></div>
      <p class="hint muted">Default PIN is 1234. Change it in Settings.</p>
      <p class="hint"><a class="link" href="/">← Back to booking page</a></p>
    </div></div>`;
    const dots = root.querySelector('.pin-dots');
    const paint = () => {
      const n = Math.max(4, pin.length);
      dots.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
    };
    const submit = async () => {
      if (pin.length < 4) return;
      try {
        const { token } = await rawApi('/api/admin/login', { method: 'POST', body: { pin } });
        S.token = token;
        store.set('adminToken', token);
        start();
      } catch (e) {
        pin = '';
        paint();
        dots.classList.remove('shake');
        void dots.offsetWidth;
        dots.classList.add('shake');
        toast(e.message, 'bad');
      }
    };
    const press = (k) => {
      if (k === 'del') pin = pin.slice(0, -1);
      else if (k === 'ok') return submit();
      else if (pin.length < 8) pin += k;
      paint();
      if (pin.length === 4 && k !== 'del') setTimeout(() => { if (pin.length === 4) submit(); }, 120);
    };
    root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
    const onKey = (e) => {
      if (!root.querySelector('.keypad')) return document.removeEventListener('keydown', onKey);
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') press('ok');
    };
    document.addEventListener('keydown', onKey);
  }

  function signOut() {
    if (S.token) rawApi('/api/admin/logout', { method: 'POST', token: S.token }).catch(() => {});
    S.token = null;
    store.remove('adminToken');
    loginView();
  }

  // ---- shell --------------------------------------------------------------

  const PAGES = () => [
    ['home', 'chart', 'Overview'],
    ['schedule', 'calendar', 'Schedule'],
    ['bookings', 'list', 'Bookings'],
    ['catalog', isGym() ? 'dumbbell' : 'tag', isGym() ? 'Services & classes' : 'Services & team'],
    ['settings', 'settings', 'Settings'],
  ];

  function shell(page, title, sub, body, { fab = false, actions = '' } = {}) {
    const b = S.data.business;
    const nav = PAGES().map(([id, ic, label]) => `<a class="nav-item" href="#/${id}" ${id === page ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(id === 'catalog' ? 'Catalogue' : label)}</span></a>`).join('');
    root.innerHTML = `<div class="shell">
      <aside class="side"><div class="side-brand"><div class="brand-mark">${esc(b.name.charAt(0))}</div><div><b>${esc(b.name)}</b><span>Owner dashboard</span></div></div>
        ${PAGES().map(([id, ic, label]) => `<a class="nav-item" href="#/${id}" ${id === page ? 'aria-current="page"' : ''}>${icon(ic)}${esc(label)}</a>`).join('')}
        <div class="spacer"></div>
        <a class="nav-item" href="/" target="_blank" rel="noopener">${icon('external')}View booking page</a>
        <button class="nav-item" data-signout style="border:0;background:none;cursor:pointer;width:100%">${icon('logout')}Sign out</button>
      </aside>
      <div class="content">
        <header class="top"><h1>${esc(title)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</h1>${actions}</header>
        <div class="wrap view">${body}</div>
      </div>
      <nav class="bottom-nav" aria-label="Main">${nav}</nav>
      ${fab ? `<button class="fab" data-new aria-label="New booking">${icon('plus')}</button>` : ''}
    </div>`;
    root.querySelector('[data-signout]')?.addEventListener('click', signOut);
    root.querySelector('[data-new]')?.addEventListener('click', () => newBookingSheet());
  }

  // ---- overview -----------------------------------------------------------

  async function homePage() {
    const t = today();
    shell('home', greeting(), dateLong(t), '<div class="kpis">' + '<div class="skel" style="height:104px;border-radius:22px"></div>'.repeat(4) + '</div>', { fab: true });
    const o = await api(`/api/admin/overview?date=${t}`);
    const b = S.data.business;
    const max = Math.max(1, ...o.week.map((d) => d.count));
    const noShowRate = o.last30.total ? Math.round((o.last30.noShows / o.last30.total) * 100) : 0;
    const link = `${UI.apiBase() || location.origin}/`;
    const topMax = Math.max(1, ...o.topServices.map((s) => s.count));
    const body = `
      <div class="kpis">
        <div class="card kpi"><div class="k-head">${icon('calendar')}Today</div><div class="k-val tnum">${o.today.bookings}</div><div class="k-sub">${o.today.completed} done · ${o.today.bookings - o.today.completed} to go</div></div>
        <div class="card kpi"><div class="k-head">${icon('wallet')}Expected today</div><div class="k-val tnum">${money(o.today.revenue, { zero: null })}</div><div class="k-sub">from confirmed visits</div></div>
        <div class="card kpi"><div class="k-head">${icon('chart')}Earned · 30 days</div><div class="k-val tnum">${money(o.last30.revenue, { zero: null })}</div><div class="k-sub">${o.last30.customers} customers</div></div>
        <div class="card kpi"><div class="k-head">${icon('alert')}No-shows · 30 days</div><div class="k-val tnum">${noShowRate}%</div><div class="k-sub">${o.last30.noShows} missed · ${o.last30.cancelled} cancelled</div></div>
      </div>

      <div class="card share-card"><div class="ic-tile">${icon('share')}</div><div class="tx"><b>Your booking link</b><span>${esc(link)}</span></div>
        <div class="btns"><button class="btn btn-ghost btn-sm" data-copy>${icon('copy')}Copy</button>${`<a class="btn btn-primary btn-sm" href="https://wa.me/?text=${encodeURIComponent(`Book your next visit at ${b.name} in seconds: ${link}`)}" target="_blank" rel="noopener">${icon('whatsapp')}Share</a>`}</div></div>

      <div class="grid-2">
        <section class="card panel">
          <div class="panel-head"><h2>Bookings · next 7 days</h2><span class="muted" style="font-size:13px;font-weight:600">${o.week.reduce((a, d) => a + d.count, 0)} total</span></div>
          <div class="chart" role="img" aria-label="Bookings per day for the next 7 days">
            ${o.week.map((d) => `<div class="bar-col${d.count ? '' : ' zero'}" tabindex="0" aria-label="${dateLong(d.date)}: ${d.count} bookings, ${money(d.revenue)}">
              <div class="bar" style="height:${Math.max(1, (d.count / max) * 100)}%"></div>
              ${d.count === max && d.count ? `<span class="val tnum" style="bottom:${(d.count / max) * 100}%">${d.count}</span>` : ''}
              <div class="tip"><b>${dateShort(d.date)}</b>${d.count} booking${d.count === 1 ? '' : 's'} · ${money(d.revenue)}</div></div>`).join('')}
          </div>
          <div class="chart-x">${o.week.map((d, i) => `<span class="${i === 0 ? 'today' : ''}">${i === 0 ? 'Today' : dayName(d.date)}</span>`).join('')}</div>
          <table class="sr-only"><caption>Bookings per day</caption><tr><th>Date</th><th>Bookings</th><th>Revenue</th></tr>${o.week.map((d) => `<tr><td>${dateShort(d.date)}</td><td>${d.count}</td><td>${money(d.revenue)}</td></tr>`).join('')}</table>
        </section>

        <section class="card panel">
          <div class="panel-head"><h2>Up next</h2><a class="link" href="#/bookings">All bookings</a></div>
          <div class="rows">${o.upcoming.length ? o.upcoming.map(bookingRow).join('') : `<div class="empty" style="padding:24px"><div class="empty-icon">${icon('calendar')}</div><h3>All clear</h3><p>No upcoming bookings yet. Share your link to fill the diary.</p></div>`}</div>
        </section>
      </div>

      ${o.topServices.length ? `<section class="card panel" style="margin-top:16px"><div class="panel-head"><h2>Most booked · 30 days</h2></div><div class="top-list">
        ${o.topServices.map((s) => `<div class="top-row"><div class="row"><span>${esc(s.name)}</span><span class="tnum">${s.count}</span></div><div class="track"><i style="width:${(s.count / topMax) * 100}%"></i></div></div>`).join('')}</div></section>` : ''}
    `;
    root.querySelector('.wrap').innerHTML = body;
    root.querySelector('[data-copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch { toast(link); }
    });
    bindRows(o.upcoming);
  }

  function greeting() {
    const h = Math.floor(nowHere().minutes / 60);
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  function bookingRow(b, { showDate = true } = {}) {
    const m = staffById(b.staffId);
    return `<button class="b-row" data-bk="${esc(b.id)}"><span class="staff-dot" style="--c:${esc(m?.color || '#999')}"></span>
      <span class="b-time tnum">${time12(b.start)}${showDate ? `<small>${b.date === today() ? 'Today' : dateShort(b.date)}</small>` : ''}</span>
      <span class="b-main"><b>${esc(b.customer.name)}</b><span>${esc(b.serviceName)}${b.staffName ? ` · ${esc(b.staffName)}` : ''}</span></span>
      ${statusBadge(b.status)}</button>`;
  }

  function bindRows(list, after) {
    root.querySelectorAll('[data-bk]').forEach((el) => el.addEventListener('click', () => {
      const b = list.find((x) => x.id === el.dataset.bk);
      if (b) bookingSheet(b, after || route);
    }));
  }

  // ---- booking sheet --------------------------------------------------------

  function bookingSheet(b, onChange) {
    const biz = S.data.business;
    const reminder = `Hi ${b.customer.name}, this is ${biz.name}. A reminder of your ${b.serviceName} on ${dateLong(b.date)} at ${time12(b.start)}${b.staffName ? ` with ${b.staffName}` : ''}. Booking code ${b.code}. See you soon!`;
    const m = staffById(b.staffId);
    sheet({
      label: 'Booking',
      html: `<div class="bk-head">${avatar({ name: b.customer.name, color: m?.color }, 'lg')}<div class="tx"><h3>${esc(b.customer.name)}</h3><p>${esc(b.customer.phone)} · #${esc(b.code)}</p></div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
        <div class="contact-btns"><a class="btn btn-ghost btn-sm" href="tel:${esc(b.customer.phone)}">${icon('phone')}Call</a>
          <a class="btn btn-ghost btn-sm" href="${UI.waLink(b.customer.phone.replace(/^0/, '92'), reminder)}" target="_blank" rel="noopener">${icon('whatsapp')}Remind</a></div>
        <div class="kv"><div><span>Service</span><b>${esc(b.serviceName)}</b></div><div><span>Status</span>${statusBadge(b.status)}</div>
          <div><span>Date</span><b>${dateShort(b.date)}</b></div><div><span>Time</span><b>${time12(b.start)} – ${time12(b.end)}</b></div>
          <div><span>${b.type === 'class' ? 'Coach' : 'With'}</span><b>${esc(b.staffName || '—')}</b></div><div><span>Price</span><b>${money(b.price)}</b></div>
          <div><span>Booked</span><b>${b.source === 'staff' ? 'By staff' : 'Online'}</b></div><div><span>Created</span><b>${new Date(b.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</b></div></div>
        ${b.note ? `<div class="note-box">${icon('info')}<span>${esc(b.note)}</span></div>` : ''}
        <div class="status-btns">
          ${b.status === 'confirmed' ? `<button class="btn btn-primary" data-status="completed">${icon('check')}Completed</button><button class="btn btn-ghost" data-status="no-show">No-show</button>
            ${b.type === 'service' ? `<button class="btn btn-ghost" data-move>${icon('calendar')}Reschedule</button>` : ''}<button class="btn btn-danger" data-status="cancelled">${icon('x')}Cancel</button>`
          : `<button class="btn btn-ghost" data-status="confirmed" style="grid-column:1/-1">${icon('refresh')}Mark as confirmed again</button>`}
        </div>`,
      onMount: (el, close) => {
        el.querySelectorAll('[data-status]').forEach((btn) => btn.addEventListener('click', async () => {
          const status = btn.dataset.status;
          if (status === 'cancelled' && !(await confirmSheet({ title: 'Cancel booking?', message: `${b.customer.name} · ${b.serviceName} on ${dateShort(b.date)} at ${time12(b.start)}`, confirm: 'Cancel booking', danger: true }))) return;
          try {
            await api(`/api/admin/bookings/${b.id}`, { method: 'PATCH', body: { status } });
            toast({ completed: 'Marked as completed', 'no-show': 'Marked as no-show', cancelled: 'Booking cancelled', confirmed: 'Booking restored' }[status]);
            close();
            onChange?.();
          } catch (e) { toast(e.message, 'bad'); }
        }));
        el.querySelector('[data-move]')?.addEventListener('click', () => { close(); setTimeout(() => rescheduleSheet(b, onChange), 240); });
      },
    });
  }

  // Shared date → time picker used by new bookings and reschedules.
  function slotPicker(el, getQuery, onPick) {
    const box = el.querySelector('[data-slots]');
    let picked = null;
    const load = async () => {
      const q = getQuery();
      picked = null;
      onPick(null);
      if (!q) { box.innerHTML = '<p class="muted" style="font-size:13.5px">Pick a service and date first.</p>'; return; }
      box.innerHTML = '<div class="skel" style="height:42px"></div>';
      try {
        const { slots } = await api(`/api/admin/availability?${new URLSearchParams(q)}`);
        box.innerHTML = slots.length
          ? `<div class="slot-pick">${slots.map((s) => `<button type="button" data-t="${s.time}">${time12(s.time)}</button>`).join('')}</div>`
          : '<p class="muted" style="font-size:13.5px">No free times on this day.</p>';
        box.querySelectorAll('[data-t]').forEach((btn) => btn.addEventListener('click', () => {
          picked = btn.dataset.t;
          box.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-pressed', x === btn));
          onPick(picked);
        }));
      } catch (e) { box.innerHTML = `<p class="field-error">${esc(e.message)}</p>`; }
    };
    return load;
  }

  function staffOptions(serviceId, selected, { any = true } = {}) {
    const svc = S.data.services.find((s) => s.id === serviceId);
    const team = S.data.staff.filter((m) => m.active !== false && (!svc || !svc.staffIds?.length || svc.staffIds.includes(m.id)));
    return `${any ? '<option value="any">Any available</option>' : ''}${team.map((m) => `<option value="${esc(m.id)}" ${m.id === selected ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}`;
  }

  function rescheduleSheet(b, onChange) {
    sheet({
      title: 'Reschedule',
      html: `<div class="form-grid">
        <label class="field"><span>Team member</span><select class="select" name="staff">${staffOptions(b.serviceId, b.staffId, { any: false })}</select></label>
        <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${b.date}" min="${today()}"></label>
        <div class="field"><span>Time</span><div data-slots></div></div></div>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok disabled>Move booking</button></div>`,
      onMount: (el, close) => {
        const ok = el.querySelector('[data-ok]');
        let time = null;
        const load = slotPicker(el, () => ({ serviceId: b.serviceId, staffId: el.querySelector('[name=staff]').value, date: el.querySelector('[name=date]').value, ignoreId: b.id }), (t) => { time = t; ok.disabled = !t; });
        el.querySelector('[name=staff]').addEventListener('change', load);
        el.querySelector('[name=date]').addEventListener('change', load);
        load();
        ok.addEventListener('click', () => busy(ok, async () => {
          try {
            await api(`/api/admin/bookings/${b.id}`, { method: 'PATCH', body: { date: el.querySelector('[name=date]').value, time, staffId: el.querySelector('[name=staff]').value } });
            toast('Booking moved');
            close();
            onChange?.();
          } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    });
  }

  function newBookingSheet(date = today(), after = route) {
    const services = S.data.services.filter((s) => s.active !== false);
    const gym = isGym() && S.data.classes.length;
    sheet({
      title: 'New booking',
      html: `<form class="form-grid" novalidate>
        ${gym ? '<div class="seg" role="group"><button type="button" data-type="service" aria-pressed="true">Appointment</button><button type="button" data-type="class" aria-pressed="false">Class spot</button></div>' : ''}
        <div class="form-grid two">
          <label class="field" data-for="service"><span>Service</span><select class="select" name="service">${services.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} · ${duration(s.duration)}</option>`).join('')}</select></label>
          <label class="field" data-for="service"><span>Team member</span><select class="select" name="staff"></select></label>
          <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${date}" min="${today()}"></label>
          <label class="field" data-for="class" hidden><span>Class</span><select class="select" name="class"></select></label>
        </div>
        <div class="field" data-for="service"><span>Time</span><div data-slots></div></div>
        <div class="form-grid two">
          <label class="field"><span>Customer name</span><input class="input" name="name" required maxlength="60"></label>
          <label class="field"><span>Phone</span><input class="input" name="phone" type="tel" inputmode="tel" required maxlength="20"></label>
          <label class="field span"><span>Note</span><input class="input" name="note" maxlength="300" placeholder="Optional"></label>
        </div></form>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>Save booking</button></div>`,
      wide: true,
      onMount: (el, close) => {
        const f = el.querySelector('form');
        let type = 'service';
        let time = null;
        const fillStaff = () => { f.staff.innerHTML = staffOptions(f.service.value, null); };
        const load = slotPicker(el, () => (f.service.value && f.date.value ? { serviceId: f.service.value, staffId: f.staff.value, date: f.date.value } : null), (t) => { time = t; });
        const loadClasses = async () => {
          if (type !== 'class') return;
          f.class.innerHTML = '<option>Loading…</option>';
          const list = await api(`/api/classes?date=${f.date.value}`).catch(() => []);
          f.class.innerHTML = list.length ? list.map((c) => `<option value="${esc(c.id)}" ${c.spotsLeft ? '' : 'disabled'}>${time12(c.start)} · ${esc(c.name)} (${c.spotsLeft} left)</option>`).join('') : '<option value="">No classes this day</option>';
        };
        fillStaff();
        load();
        f.service.addEventListener('change', () => { fillStaff(); load(); });
        f.staff.addEventListener('change', load);
        f.date.addEventListener('change', () => (type === 'class' ? loadClasses() : load()));
        el.querySelectorAll('[data-type]').forEach((btn) => btn.addEventListener('click', () => {
          type = btn.dataset.type;
          el.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-pressed', x === btn));
          el.querySelectorAll('[data-for]').forEach((x) => { x.hidden = x.dataset.for !== type; });
          if (type === 'class') loadClasses(); else load();
        }));
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          if (type === 'service' && !time) return toast('Pick a time', 'bad');
          if (type === 'class' && !f.class.value) return toast('Pick a class', 'bad');
          try {
            const body = type === 'class'
              ? { type, classId: f.class.value, date: f.date.value }
              : { type, serviceId: f.service.value, staffId: f.staff.value, date: f.date.value, time };
            await api('/api/admin/bookings', { method: 'POST', body: { ...body, name: f.name.value, phone: f.phone.value, note: f.note.value } });
            toast('Booking saved');
            close();
            after?.();
          } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    });
  }

  // ---- schedule -----------------------------------------------------------

  async function schedulePage(params) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : today();
    const label = date === today() ? 'Today' : date === addDays(today(), 1) ? 'Tomorrow' : dayName(date);
    shell('schedule', 'Schedule', dateLong(date), `
      <div class="date-nav">
        <button class="icon-btn" data-go="${addDays(date, -1)}" aria-label="Previous day">${icon('chevronLeft')}</button>
        <button class="btn btn-ghost btn-sm" data-go="${today()}">Today</button>
        <button class="icon-btn" data-go="${addDays(date, 1)}" aria-label="Next day">${icon('chevronRight')}</button>
        <span class="label">${esc(label)}</span>
        <input class="input" type="date" value="${date}" aria-label="Jump to date" data-jump>
      </div>
      <div class="card sched" id="sched"><div class="skel" style="height:400px"></div></div>`, { fab: true });
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/schedule?date=${b.dataset.go}`; }));
    root.querySelector('[data-jump]').addEventListener('change', (e) => { if (e.target.value) location.hash = `#/schedule?date=${e.target.value}`; });
    root.querySelector('[data-new]').onclick = () => newBookingSheet(date >= today() ? date : today());

    const bookings = (await api(`/api/admin/bookings?from=${date}&to=${date}`)).filter((b) => b.status !== 'cancelled');
    const team = S.data.staff.filter((m) => m.active !== false || bookings.some((b) => b.staffId === m.id));
    const biz = S.data.business;
    const dayKey = DAYS[weekday(date)];
    const hours = (biz.closedDates || []).includes(date) ? [] : biz.hours[dayKey] || [];
    const starts = [...hours.map(([a]) => toMin(a)), ...bookings.map((b) => toMin(b.start))];
    const ends = [...hours.map(([, z]) => toMin(z)), ...bookings.map((b) => toMin(b.end))];
    const el = document.getElementById('sched');
    if (!starts.length) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">${icon('moon')}</div><h3>Closed</h3><p>No opening hours and no bookings on ${dateLong(date)}.</p></div>`;
      return;
    }
    const first = Math.floor(Math.min(...starts) / 60) * 60;
    const last = Math.ceil(Math.max(...ends) / 60) * 60;
    const px = (m) => (m - first);
    const heightPx = last - first;
    const cols = team.length;

    // Class bookings collapse into one block per class with a head count.
    const classBlocks = {};
    for (const b of bookings.filter((x) => x.type === 'class')) {
      const k = `${b.classId}`;
      (classBlocks[k] ||= { ...b, count: 0, list: [] }).count++;
      classBlocks[k].list.push(b);
    }
    const serviceBookings = bookings.filter((b) => b.type !== 'class');

    const hourMarks = [];
    for (let m = first; m < last; m += 60) hourMarks.push(m);
    const n = nowHere();
    el.innerHTML = `<div class="sched-grid" style="grid-template-columns:56px repeat(${cols}, minmax(150px, 1fr))">
      <div class="sched-corner"></div>
      ${team.map((m) => `<div class="sched-head">${avatar(m, 'sm')}${esc(m.name.split(' ')[0])}</div>`).join('')}
      <div class="sched-times" style="height:${heightPx}px">${hourMarks.map((m) => `<div>${time12(fromMin(m)).replace(':00', '')}</div>`).join('')}</div>
      ${team.map((m) => {
        const working = (biz.closedDates || []).includes(date) || (m.daysOff || []).includes(dayKey) ? [] : hours.map(([a, z]) => [toMin(a), toMin(z)]);
        const offBlocks = [];
        let cursor = first;
        for (const [a, z] of working) { if (a > cursor) offBlocks.push([cursor, a]); cursor = Math.max(cursor, z); }
        if (cursor < last) offBlocks.push([cursor, last]);
        const evs = serviceBookings.filter((b) => b.staffId === m.id).map((b) => `<button class="ev ${b.status}" data-ev="${esc(b.id)}" style="--c:${esc(m.color)};top:${px(toMin(b.start)) + 1}px;height:${toMin(b.end) - toMin(b.start) - 2}px"><b>${esc(b.customer.name)}</b><span>${time12(b.start)} · ${esc(b.serviceName)}</span></button>`);
        const cls = Object.values(classBlocks).filter((c) => c.staffId === m.id).map((c) => `<button class="ev" data-class-ev="${esc(c.classId)}" style="--c:${esc(m.color)};top:${px(toMin(c.start)) + 1}px;height:${toMin(c.end) - toMin(c.start) - 2}px"><b>${esc(c.serviceName)}</b><span>${c.count} booked · ${time12(c.start)}</span></button>`);
        return `<div class="sched-col" style="height:${heightPx}px">${offBlocks.map(([a, z]) => `<div class="off" style="top:${px(a)}px;height:${z - a}px"></div>`).join('')}${evs.join('')}${cls.join('')}
          ${date === n.date && n.minutes > first && n.minutes < last ? `<div class="now-line" style="top:${px(n.minutes)}px"></div>` : ''}</div>`;
      }).join('')}
    </div>`;
    const reload = () => schedulePage(params);
    el.querySelectorAll('[data-ev]').forEach((x) => x.addEventListener('click', () => bookingSheet(serviceBookings.find((b) => b.id === x.dataset.ev), reload)));
    el.querySelectorAll('[data-class-ev]').forEach((x) => x.addEventListener('click', () => {
      const c = classBlocks[x.dataset.classEv];
      sheet({
        title: `${c.serviceName} · ${time12(c.start)}`,
        html: `<p class="muted" style="margin-bottom:10px">${c.count} booked</p><div class="rows">${c.list.map((b) => bookingRow(b, { showDate: false })).join('')}</div>`,
        onMount: (sh, close) => sh.querySelectorAll('[data-bk]').forEach((r) => r.addEventListener('click', () => { close(); setTimeout(() => bookingSheet(c.list.find((b) => b.id === r.dataset.bk), reload), 240); })),
      });
    }));
    if (date === n.date) {
      const scrollTo = Math.max(0, px(n.minutes) - 120);
      el.scrollTop = scrollTo;
    }
  }

  // ---- bookings list --------------------------------------------------------

  async function bookingsPage(params) {
    const filter = params.get('f') || 'upcoming';
    const q = params.get('q') || '';
    shell('bookings', 'Bookings', '', `
      <div class="toolbar">
        <div class="seg" role="group" aria-label="Filter">${[['upcoming', 'Upcoming'], ['today', 'Today'], ['past', 'Past'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([id, l]) => `<button data-f="${id}" aria-pressed="${filter === id}">${l}</button>`).join('')}</div>
        <div class="grow input-group">${icon('search')}<input class="input" type="search" placeholder="Search name, phone or code" value="${esc(q)}" data-q aria-label="Search bookings"></div>
      </div>
      <div class="card panel" id="list"><div class="skel" style="height:240px"></div></div>`, { fab: true });
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/bookings?f=${b.dataset.f}${q ? `&q=${encodeURIComponent(q)}` : ''}`; }));
    const input = root.querySelector('[data-q]');
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { history.replaceState(null, '', `#/bookings?f=${filter}&q=${encodeURIComponent(input.value)}`); draw(input.value); }, 250);
    });
    const t = today();
    const query = {
      upcoming: { from: t, status: 'confirmed' },
      today: { from: t, to: t, status: 'all' },
      past: { to: addDays(t, -1), status: 'all', order: 'desc' },
      cancelled: { status: 'cancelled', order: 'desc' },
      all: { status: 'all', order: 'desc' },
    }[filter] || {};
    const draw = async (term) => {
      const list = await api(`/api/admin/bookings?${new URLSearchParams({ ...query, q: term })}`);
      const el = document.getElementById('list');
      if (!el) return;
      if (!list.length) {
        el.innerHTML = `<div class="empty"><div class="empty-icon">${icon('list')}</div><h3>No bookings</h3><p>${term ? 'Nothing matches your search.' : 'Nothing here yet.'}</p></div>`;
        return;
      }
      let lastDate = '';
      el.innerHTML = `<div class="rows">${list.map((b) => {
        const head = b.date !== lastDate ? `<div class="day-head">${b.date === t ? 'Today' : dateLong(b.date)}</div>` : '';
        lastDate = b.date;
        return head + bookingRow(b, { showDate: false });
      }).join('')}</div>`;
      bindRows(list, () => draw(input.value));
    };
    root.querySelector('[data-new]').onclick = () => newBookingSheet(t, () => draw(input.value));
    draw(q);
  }

  // ---- catalogue ------------------------------------------------------------

  async function refreshData() {
    S.data = await api('/api/admin/data');
    UI.setBusiness(S.data.business);
    UI.setAccent(S.data.business.accent);
  }

  function catalogPage(params) {
    const tabs = [['services', 'Services'], ['staff', isGym() ? 'Coaches' : 'Team'], ...(isGym() ? [['classes', 'Classes']] : []), ['categories', 'Categories']];
    const tab = tabs.some(([id]) => id === params.get('t')) ? params.get('t') : 'services';
    const add = { services: 'Add service', staff: isGym() ? 'Add coach' : 'Add team member', classes: 'Add class', categories: 'Add category' }[tab];
    shell('catalog', 'Catalogue', '', `
      <div class="toolbar"><div class="seg" role="group">${tabs.map(([id, l]) => `<button data-t="${id}" aria-pressed="${tab === id}">${l}</button>`).join('')}</div><span class="grow"></span>
        <button class="btn btn-primary btn-sm" data-add>${icon('plus')}${add}</button></div>
      <div class="item-list" id="items"></div>`);
    root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/catalog?t=${b.dataset.t}`; }));
    root.querySelector('[data-add]').addEventListener('click', () => editItem(tab));
    drawItems(tab);
  }

  function drawItems(tab) {
    const el = document.getElementById('items');
    const catName = (id) => S.data.categories.find((c) => c.id === id)?.name || 'Uncategorised';
    const catIcon = (id) => S.data.categories.find((c) => c.id === id)?.icon || 'sparkles';
    const rows = {
      services: () => S.data.categories.map((c) => {
        const items = S.data.services.filter((s) => s.categoryId === c.id);
        return items.length ? `<div class="day-head">${esc(c.name)}</div>${items.map((s) => `<div class="card item${s.active === false ? ' inactive' : ''}"><div class="ic-tile">${icon(catIcon(s.categoryId))}</div>
          <div class="tx"><b>${esc(s.name)}${s.popular ? ' <span class="badge badge-accent">Popular</span>' : ''}${s.active === false ? ' <span class="badge badge-muted">Hidden</span>' : ''}</b><span>${duration(s.duration)} · ${money(s.price)} · ${s.staffIds?.length ? s.staffIds.map((id) => staffById(id)?.name.split(' ')[0]).filter(Boolean).join(', ') : 'Whole team'}</span></div>
          <div class="acts"><button class="icon-btn" data-edit="${esc(s.id)}" aria-label="Edit ${esc(s.name)}">${icon('edit')}</button></div></div>`).join('')}` : '';
      }).join(''),
      staff: () => S.data.staff.map((m) => `<div class="card item${m.active === false ? ' inactive' : ''}">${avatar(m)}
          <div class="tx"><b>${esc(m.name)}${m.active === false ? ' <span class="badge badge-muted">Inactive</span>' : ''}</b><span>${esc(m.role || '')}${m.daysOff?.length ? ` · off ${m.daysOff.map((d) => DAY_LABELS[d].slice(0, 3)).join(', ')}` : ''}</span></div>
          <div class="acts"><button class="icon-btn" data-edit="${esc(m.id)}" aria-label="Edit ${esc(m.name)}">${icon('edit')}</button></div></div>`).join(''),
      classes: () => [1, 2, 3, 4, 5, 6, 0].map((wd) => {
        const items = S.data.classes.filter((c) => c.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
        return items.length ? `<div class="day-head">${DAY_LABELS[DAYS[wd]]}</div>${items.map((c) => `<div class="card item${c.active === false ? ' inactive' : ''}"><div class="ic-tile">${icon('flame')}</div>
          <div class="tx"><b>${esc(c.name)}</b><span>${time12(c.start)} · ${c.duration} min · ${c.capacity} spots · ${esc(staffById(c.staffId)?.name || 'No coach')}</span></div>
          <div class="acts"><button class="icon-btn" data-edit="${esc(c.id)}" aria-label="Edit ${esc(c.name)}">${icon('edit')}</button></div></div>`).join('')}` : '';
      }).join(''),
      categories: () => S.data.categories.map((c) => `<div class="card item"><div class="ic-tile">${icon(c.icon)}</div><div class="tx"><b>${esc(c.name)}</b><span>${S.data.services.filter((s) => s.categoryId === c.id).length} services</span></div>
          <div class="acts"><button class="icon-btn" data-edit="${esc(c.id)}" aria-label="Edit ${esc(c.name)}">${icon('edit')}</button></div></div>`).join(''),
    };
    const html = rows[tab]();
    el.innerHTML = html || `<div class="card empty"><div class="empty-icon">${icon('plus')}</div><h3>Nothing here yet</h3><p>Use the button above to add your first one.</p></div>`;
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editItem(tab, S.data[tab].find((x) => x.id === b.dataset.edit))));
  }

  function editItem(tab, item) {
    const isNew = !item;
    item = item || {};
    const nameOf = { services: 'service', staff: isGym() ? 'coach' : 'team member', classes: 'class', categories: 'category' }[tab];
    const daysOff = (sel) => `<div class="day-picks">${ORDER.map((d) => `<label><input type="checkbox" name="daysOff" value="${d}" ${(sel || []).includes(d) ? 'checked' : ''}><span>${DAY_LABELS[d].slice(0, 3)}</span></label>`).join('')}</div>`;
    const active = `<label class="toggle-row span"><span>${tab === 'services' ? 'Show on booking page' : 'Active'}</span><span class="switch"><input type="checkbox" name="active" ${item.active !== false ? 'checked' : ''}><span></span></span></label>`;
    const forms = {
      services: `<label class="field span"><span>Name</span><input class="input" name="name" value="${esc(item.name || '')}" maxlength="80" required></label>
        <label class="field"><span>Category</span><select class="select" name="categoryId">${S.data.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === item.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Duration (minutes)</span><input class="input" name="duration" type="number" min="5" max="600" step="5" value="${item.duration || 30}"></label>
        <label class="field"><span>Price (${esc(S.data.business.currencySymbol)})</span><input class="input" name="price" type="number" min="0" step="50" value="${item.price ?? ''}"></label>
        <label class="toggle-row"><span>Mark as popular</span><span class="switch"><input type="checkbox" name="popular" ${item.popular ? 'checked' : ''}><span></span></span></label>
        <label class="field span"><span>Description</span><textarea class="textarea" name="description" maxlength="400">${esc(item.description || '')}</textarea></label>
        <div class="field span"><span>Who can do it?</span><small>Leave all unticked to allow the whole team.</small><div class="staff-picks">${S.data.staff.map((m) => `<label><input type="checkbox" name="staffIds" value="${esc(m.id)}" ${(item.staffIds || []).includes(m.id) ? 'checked' : ''}>${avatar(m, 'sm')}${esc(m.name)}</label>`).join('')}</div></div>
        ${active}`,
      staff: `<label class="field"><span>Name</span><input class="input" name="name" value="${esc(item.name || '')}" maxlength="60" required></label>
        <label class="field"><span>Role</span><input class="input" name="role" value="${esc(item.role || '')}" maxlength="60" placeholder="e.g. Senior Stylist"></label>
        <label class="field"><span>Rating (optional)</span><input class="input" name="rating" type="number" min="0" max="5" step="0.1" value="${item.rating ?? ''}"></label>
        <div class="field"><span>Colour</span><div class="swatches">${PRESETS.slice(0, 6).map((c) => `<button type="button" class="swatch" style="--c:${c}" data-swatch="${c}" aria-label="${c}" aria-pressed="${c === item.color}"></button>`).join('')}<input type="color" name="color" value="${esc(item.color || '#7c5cff')}" aria-label="Custom colour"></div></div>
        <div class="field span"><span>Days off every week</span>${daysOff(item.daysOff)}</div>
        ${active}`,
      classes: `<label class="field span"><span>Class name</span><input class="input" name="name" value="${esc(item.name || '')}" maxlength="60" required></label>
        <label class="field"><span>Day</span><select class="select" name="weekday">${[1, 2, 3, 4, 5, 6, 0].map((wd) => `<option value="${wd}" ${wd === item.weekday ? 'selected' : ''}>${DAY_LABELS[DAYS[wd]]}</option>`).join('')}</select></label>
        <label class="field"><span>Start time</span><input class="input" name="start" type="time" value="${esc(item.start || '18:00')}"></label>
        <label class="field"><span>Duration (minutes)</span><input class="input" name="duration" type="number" min="10" max="300" step="5" value="${item.duration || 60}"></label>
        <label class="field"><span>Capacity</span><input class="input" name="capacity" type="number" min="1" max="500" value="${item.capacity || 12}"></label>
        <label class="field"><span>Coach</span><select class="select" name="staffId">${S.data.staff.map((m) => `<option value="${esc(m.id)}" ${m.id === item.staffId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Level</span><input class="input" name="level" value="${esc(item.level || 'All levels')}" maxlength="40"></label>
        <label class="field"><span>Drop-in price (0 = included)</span><input class="input" name="price" type="number" min="0" step="50" value="${item.price || 0}"></label>
        ${active}`,
      categories: `<label class="field span"><span>Name</span><input class="input" name="name" value="${esc(item.name || '')}" maxlength="40" required></label>
        <div class="field span"><span>Icon</span><div class="tag-list">${['scissors', 'razor', 'sparkles', 'hand', 'gift', 'dumbbell', 'activity', 'heart', 'flame', 'bolt', 'star', 'sun', 'user', 'tag'].map((n) => `<label class="day-picks"><input type="radio" name="icon" value="${n}" ${n === (item.icon || 'sparkles') ? 'checked' : ''}><span aria-label="${n}">${icon(n)}</span></label>`).join('')}</div></div>`,
    };
    sheet({
      title: `${isNew ? 'Add' : 'Edit'} ${nameOf}`,
      wide: true,
      html: `<form class="form-grid two" novalidate>${forms[tab]}</form>
        <div class="sheet-actions">${isNew ? '<button class="btn btn-ghost" data-close>Cancel</button>' : `<button class="btn btn-danger" data-del>${icon('trash')}Delete</button>`}<button class="btn btn-primary" data-ok>${isNew ? 'Add' : 'Save changes'}</button></div>`,
      onMount: (el, close) => {
        const f = el.querySelector('form');
        el.querySelectorAll('[data-swatch]').forEach((s) => s.addEventListener('click', () => {
          f.color.value = s.dataset.swatch;
          el.querySelectorAll('[data-swatch]').forEach((x) => x.setAttribute('aria-pressed', x === s));
        }));
        const collect = () => {
          const fd = new FormData(f);
          const body = {};
          for (const [k, v] of fd.entries()) {
            if (k === 'staffIds' || k === 'daysOff') (body[k] ||= []).push(v);
            else body[k] = v;
          }
          body.staffIds ||= [];
          body.daysOff ||= [];
          body.active = f.active ? f.active.checked : true;
          body.popular = f.popular ? f.popular.checked : false;
          return body;
        };
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          try {
            await api(`/api/admin/${tab}${isNew ? '' : `/${item.id}`}`, { method: isNew ? 'POST' : 'PUT', body: collect() });
            await refreshData();
            toast(isNew ? 'Added' : 'Saved');
            close();
            drawItems(tab);
          } catch (e) { toast(e.message, 'bad'); }
        }));
        el.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (!(await confirmSheet({ title: `Delete ${item.name}?`, message: 'Existing bookings stay in your history. This cannot be undone.', confirm: 'Delete', danger: true }))) return;
          try {
            await api(`/api/admin/${tab}/${item.id}`, { method: 'DELETE' });
            await refreshData();
            toast('Deleted');
            close();
            drawItems(tab);
          } catch (e) { toast(e.message, 'bad'); }
        });
      },
    });
  }

  // ---- settings -------------------------------------------------------------

  function settingsPage() {
    const b = S.data.business;
    const range = (d, i, r) => `<div class="range" data-range><input class="input" type="time" value="${r[0]}" aria-label="${DAY_LABELS[d]} opens"><span class="muted">to</span><input class="input" type="time" value="${r[1]}" aria-label="${DAY_LABELS[d]} closes">${i > 0 ? `<button type="button" class="icon-btn" data-rm aria-label="Remove break">${icon('x')}</button>` : ''}</div>`;
    const hoursRow = (d) => {
      const h = b.hours[d] || [];
      return `<div class="hours-row" data-day="${d}"><b>${DAY_LABELS[d]}</b><span class="switch"><input type="checkbox" data-open ${h.length ? 'checked' : ''} aria-label="Open on ${DAY_LABELS[d]}"><span></span></span>
        <div class="ranges">${h.length ? h.map((r, i) => range(d, i, r)).join('') + (h.length < 3 ? `<button type="button" class="link" data-addrange style="justify-self:start">+ Add a break</button>` : '') : '<span class="closed">Closed</span>'}</div></div>`;
    };
    shell('settings', 'Settings', '', `
      <form id="settings" novalidate>
      <section class="card form-section"><h2>Business</h2><p>What customers see at the top of your booking page.</p>
        <div class="form-grid two">
          <label class="field"><span>Business name</span><input class="input" name="name" value="${esc(b.name)}" maxlength="60" required></label>
          <label class="field"><span>Type</span><select class="select" name="mode"><option value="salon" ${b.mode === 'salon' ? 'selected' : ''}>Salon / barber / spa / clinic</option><option value="gym" ${b.mode === 'gym' ? 'selected' : ''}>Gym / studio (with classes)</option></select></label>
          <label class="field span"><span>Tagline</span><input class="input" name="tagline" value="${esc(b.tagline)}" maxlength="120"></label>
          <div class="field span"><span>Brand colour</span><div class="swatches">${PRESETS.map((c) => `<button type="button" class="swatch" style="--c:${c}" data-swatch="${c}" aria-label="${c}" aria-pressed="${c === b.accent}"></button>`).join('')}<input type="color" name="accent" value="${esc(b.accent)}" aria-label="Custom colour"></div></div>
        </div></section>

      <section class="card form-section"><h2>Contact & location</h2><p>Shown on the booking page with one-tap buttons.</p>
        <div class="form-grid two">
          <label class="field"><span>Phone</span><input class="input" name="phone" value="${esc(b.phone)}" type="tel"></label>
          <label class="field"><span>WhatsApp number</span><input class="input" name="whatsapp" value="${esc(b.whatsapp)}" inputmode="numeric" placeholder="923001234567"><small>Country code, digits only.</small></label>
          <label class="field"><span>Email</span><input class="input" name="email" value="${esc(b.email)}" type="email"></label>
          <label class="field"><span>Instagram</span><input class="input" name="instagram" value="${esc(b.instagram)}" placeholder="yourhandle"></label>
          <label class="field span"><span>Address</span><input class="input" name="address" value="${esc(b.address)}"></label>
          <label class="field span"><span>Google Maps link</span><input class="input" name="mapUrl" value="${esc(b.mapUrl)}" placeholder="https://maps.google.com/..."></label>
        </div></section>

      <section class="card form-section"><h2>Opening hours</h2><p>Customers can only book inside these hours. Use “Add a break” for lunch or prayer breaks.</p>
        <div id="hours">${ORDER.map(hoursRow).join('')}</div></section>

      <section class="card form-section"><h2>Booking rules</h2><p>Control how far ahead and how late people can book.</p>
        <div class="form-grid two">
          <label class="field"><span>Time slot every</span><select class="select" name="slotStep">${[10, 15, 20, 30, 45, 60].map((n) => `<option value="${n}" ${n === b.slotStep ? 'selected' : ''}>${n} minutes</option>`).join('')}</select></label>
          <label class="field"><span>Bookable days ahead</span><input class="input" name="bookingWindowDays" type="number" min="1" max="365" value="${b.bookingWindowDays}"></label>
          <label class="field"><span>Minimum notice (minutes)</span><input class="input" name="minNoticeMinutes" type="number" min="0" step="15" value="${b.minNoticeMinutes}"></label>
          <label class="field"><span>Online cancellation until (minutes before)</span><input class="input" name="cancelNoticeMinutes" type="number" min="0" step="15" value="${b.cancelNoticeMinutes}"></label>
          <label class="field"><span>Currency symbol</span><input class="input" name="currencySymbol" value="${esc(b.currencySymbol)}" maxlength="4"></label>
          <label class="field"><span>Time zone</span><input class="input" name="timeZone" value="${esc(b.timeZone)}" placeholder="Asia/Karachi"></label>
          <div class="field span"><span>Holidays & closed dates</span><div class="tag-list" id="closed">${(b.closedDates || []).map((d) => `<span class="chip" data-closed="${d}">${dateShort(d)} <button type="button" class="icon-btn" style="width:24px;height:24px;border-radius:8px" data-rmclosed aria-label="Remove ${d}">${icon('x')}</button></span>`).join('')}</div>
            <div style="display:flex;gap:8px;margin-top:6px"><input class="input" type="date" id="closed-add" min="${today()}" style="max-width:200px"><button type="button" class="btn btn-ghost btn-sm" data-addclosed style="min-height:50px">${icon('plus')}Add</button></div></div>
        </div></section>
      <input type="hidden" name="currency" value="${esc(b.currency)}"><input type="hidden" name="locale" value="${esc(b.locale)}">
      <div class="save-bar"><button class="btn btn-primary" type="submit">${icon('check')}Save settings</button></div>
      </form>

      ${isGym() ? `<section class="card form-section"><div class="panel-head"><div><h2>Membership plans</h2><p class="muted" style="font-size:13.5px">Shown on the home screen with a “Join on WhatsApp” button.</p></div><button class="btn btn-primary btn-sm" data-addplan>${icon('plus')}Add plan</button></div>
        <div class="item-list">${S.data.plans.map((p) => `<div class="card item${p.active === false ? ' inactive' : ''}"><div class="ic-tile">${icon('star')}</div><div class="tx"><b>${esc(p.name)}${p.highlight ? ' <span class="badge badge-accent">Highlighted</span>' : ''}</b><span>${money(p.price)} / ${esc(p.period)} · ${p.features.length} perks</span></div><div class="acts"><button class="icon-btn" data-plan="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">${icon('edit')}</button></div></div>`).join('') || '<p class="muted">No plans yet.</p>'}</div></section>` : ''}

      <section class="card form-section"><h2>Security</h2><p>Change the PIN used to open this dashboard.</p>
        <form class="form-grid two" id="pin-form" novalidate>
          <label class="field"><span>Current PIN</span><input class="input" name="current" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password"></label>
          <label class="field"><span>New PIN (4–8 digits)</span><input class="input" name="next" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></label>
          <div class="span"><button class="btn btn-ghost" type="submit">${icon('lock')}Change PIN</button> <button class="btn btn-danger" type="button" data-signout2>${icon('logout')}Sign out</button></div>
        </form></section>`);

    const form = document.getElementById('settings');
    const hoursEl = document.getElementById('hours');
    const readHours = () => {
      const out = {};
      hoursEl.querySelectorAll('[data-day]').forEach((row) => {
        out[row.dataset.day] = row.querySelector('[data-open]').checked
          ? [...row.querySelectorAll('[data-range]')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value))
          : [];
      });
      return out;
    };
    const redrawRow = (day, ranges) => {
      b.hours = { ...readHours(), [day]: ranges };
      hoursEl.querySelector(`[data-day="${day}"]`).outerHTML = hoursRow(day);
      bindHours();
    };
    const bindHours = () => {
      hoursEl.querySelectorAll('[data-day]').forEach((row) => {
        const day = row.dataset.day;
        row.querySelector('[data-open]').onchange = (e) => redrawRow(day, e.target.checked ? [['10:00', '20:00']] : []);
        const add = row.querySelector('[data-addrange]');
        if (add) add.onclick = () => {
          const cur = readHours()[day];
          const lastEnd = cur[cur.length - 1][1];
          const end = toMin(lastEnd);
          cur[cur.length - 1][1] = fromMin(Math.max(toMin(cur[cur.length - 1][0]) + 30, end - 120));
          cur.push([fromMin(Math.max(toMin(cur[cur.length - 1][1]) + 30, end - 60)), lastEnd]);
          redrawRow(day, cur);
        };
        row.querySelectorAll('[data-rm]').forEach((btn, i) => { btn.onclick = () => { const cur = readHours()[day]; cur.splice(i + 1, 1); redrawRow(day, cur); }; });
      });
    };
    bindHours();

    const closed = new Set(b.closedDates || []);
    const drawClosed = () => {
      document.getElementById('closed').innerHTML = [...closed].sort().map((d) => `<span class="chip" data-closed="${d}">${dateShort(d)} <button type="button" class="icon-btn" style="width:24px;height:24px;border-radius:8px" data-rmclosed aria-label="Remove ${d}">${icon('x')}</button></span>`).join('');
      document.querySelectorAll('[data-rmclosed]').forEach((x) => { x.onclick = () => { closed.delete(x.closest('[data-closed]').dataset.closed); drawClosed(); }; });
    };
    drawClosed();
    root.querySelector('[data-addclosed]').addEventListener('click', () => {
      const v = document.getElementById('closed-add').value;
      if (v) { closed.add(v); drawClosed(); }
    });
    root.querySelectorAll('[data-swatch]').forEach((s) => s.addEventListener('click', () => {
      form.accent.value = s.dataset.swatch;
      root.querySelectorAll('[data-swatch]').forEach((x) => x.setAttribute('aria-pressed', x === s));
      UI.setAccent(s.dataset.swatch);
    }));
    form.accent.addEventListener('input', () => UI.setAccent(form.accent.value));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      busy(btn, async () => {
        const body = Object.fromEntries(new FormData(form).entries());
        body.hours = readHours();
        body.closedDates = [...closed];
        try {
          await api('/api/admin/business', { method: 'PUT', body });
          const modeChanged = body.mode !== S.data.business.mode;
          await refreshData();
          toast('Settings saved');
          if (modeChanged) settingsPage();
        } catch (err) { toast(err.message, 'bad'); }
      });
    });

    document.getElementById('pin-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      busy(f.querySelector('[type=submit]'), async () => {
        try {
          await api('/api/admin/pin', { method: 'POST', body: { current: f.current.value, next: f.next.value } });
          f.reset();
          toast('PIN changed');
        } catch (err) { toast(err.message, 'bad'); }
      });
    });
    root.querySelector('[data-signout2]').addEventListener('click', signOut);
    root.querySelector('[data-addplan]')?.addEventListener('click', () => editPlan());
    root.querySelectorAll('[data-plan]').forEach((b2) => b2.addEventListener('click', () => editPlan(S.data.plans.find((p) => p.id === b2.dataset.plan))));
  }

  function editPlan(p) {
    const isNew = !p;
    p = p || { features: [] };
    sheet({
      title: isNew ? 'Add plan' : 'Edit plan',
      html: `<form class="form-grid two" novalidate>
        <label class="field"><span>Name</span><input class="input" name="name" value="${esc(p.name || '')}" maxlength="40"></label>
        <label class="field"><span>Price</span><input class="input" name="price" type="number" min="0" step="100" value="${p.price ?? ''}"></label>
        <label class="field"><span>Per</span><input class="input" name="period" value="${esc(p.period || 'month')}" placeholder="month, 3 months, year"></label>
        <label class="toggle-row"><span>Highlight as best value</span><span class="switch"><input type="checkbox" name="highlight" ${p.highlight ? 'checked' : ''}><span></span></span></label>
        <label class="field span"><span>What's included (one per line)</span><textarea class="textarea" name="features">${esc(p.features.join('\n'))}</textarea></label>
        <label class="toggle-row span"><span>Show on booking page</span><span class="switch"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}><span></span></span></label></form>
        <div class="sheet-actions">${isNew ? '<button class="btn btn-ghost" data-close>Cancel</button>' : `<button class="btn btn-danger" data-del>${icon('trash')}Delete</button>`}<button class="btn btn-primary" data-ok>Save</button></div>`,
      onMount: (el, close) => {
        const f = el.querySelector('form');
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          try {
            await api(`/api/admin/plans${isNew ? '' : `/${p.id}`}`, { method: isNew ? 'POST' : 'PUT', body: { name: f.name.value, price: f.price.value, period: f.period.value, features: f.features.value, highlight: f.highlight.checked, active: f.active.checked } });
            await refreshData();
            close();
            toast('Saved');
            settingsPage();
          } catch (e) { toast(e.message, 'bad'); }
        }));
        el.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (!(await confirmSheet({ title: `Delete ${p.name}?`, message: 'It will disappear from the booking page.', confirm: 'Delete', danger: true }))) return;
          await api(`/api/admin/plans/${p.id}`, { method: 'DELETE' }).catch((e) => toast(e.message, 'bad'));
          await refreshData();
          close();
          settingsPage();
        });
      },
    });
  }

  // ---- router ---------------------------------------------------------------

  async function route() {
    if (!S.token) return loginView();
    const [path, query] = (location.hash.slice(1) || '/home').split('?');
    const params = new URLSearchParams(query || '');
    const page = path.replace(/^\//, '') || 'home';
    window.scrollTo(0, 0);
    try {
      if (page === 'schedule') return await schedulePage(params);
      if (page === 'bookings') return await bookingsPage(params);
      if (page === 'catalog') return catalogPage(params);
      if (page === 'settings') return settingsPage();
      return await homePage();
    } catch (e) {
      if (!S.token) return;
      toast(e.message, 'bad');
    }
  }

  async function start() {
    try {
      await refreshData();
    } catch (e) {
      if (!S.token) return;
      root.innerHTML = `<div class="login"><div class="empty"><div class="empty-icon">${icon('alert')}</div><h3>Can't reach the server</h3><p>${esc(e.message)}</p><button class="btn btn-primary" data-retry>Try again</button></div></div>`;
      root.querySelector('[data-retry]').addEventListener('click', start);
      return;
    }
    document.title = `${S.data.business.name} · Dashboard`;
    route();
  }

  if (window.APP_CONFIG?.native && !UI.apiBase()) { location.replace('/index.html'); return; }
  window.addEventListener('hashchange', route);
  if (S.token) start(); else loginView();
})();
