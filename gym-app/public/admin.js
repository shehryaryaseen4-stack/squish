// Gym manager: members, fees, attendance, classes, expenses and reports.
(function () {
  const { esc, api: rawApi, money, time12, dateLong, dateShort, dayName, addDays, weekday, initials, toast, sheet, confirmSheet, busy, store, DAYS, DAY_LABELS } = UI;

  const root = document.getElementById('root');
  const S = { token: store.get('adminToken', null), data: null };
  const isOwner = () => S.data?.role === 'owner';
  // What this login may do; the owner decides it per staff login.
  const can = (perm) => isOwner() || (S.data?.perms || []).includes(perm);
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const PRESETS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#0ea5e9', '#6366f1', '#a855f7', '#111827'];
  const rs = (n) => money(n, { zero: null });

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
  const monthOf = (d) => d.slice(0, 7);
  const monthLabel = (key, long = false) => new Intl.DateTimeFormat('en-GB', { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit', timeZone: 'UTC' }).format(new Date(`${key}-15T12:00:00Z`));
  const shiftMonth = (key, n) => { const d = new Date(`${key}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
  const avatar = (m, size = '') => UI.avatarHtml(m, size);
  const staffById = (id) => S.data.staff.find((s) => s.id === id);
  const planById = (id) => S.data.plans.find((p) => p.id === id);
  const fmtMinutes = (m) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  const age = (dob) => (dob ? Math.floor((Date.parse(today()) - Date.parse(dob)) / (365.25 * 864e5)) : null);
  const ago = (days) => (days == null ? 'never' : days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

  function statusBadge(s) {
    switch (s.status) {
      case 'active': return `<span class="badge badge-good"><i class="dot"></i>Active · ${s.daysLeft}d left</span>`;
      case 'expiring': return `<span class="badge badge-warn">${icon('clock')}${s.daysLeft === 0 ? 'Expires today' : `Expires in ${s.daysLeft}d`}</span>`;
      case 'expired': return `<span class="badge badge-bad">Expired ${-s.daysLeft}d ago</span>`;
      case 'unpaid': return '<span class="badge badge-bad">No fee paid</span>';
      case 'frozen': return `<span class="badge badge-info">${icon('snow')}Frozen</span>`;
      case 'left': return '<span class="badge badge-muted">Left</span>';
      default: return '';
    }
  }

  // ---- WhatsApp messages (Roman Urdu, the way most gyms in Pakistan text) ----

  const waNumber = (p) => String(p || '').replace(/\D/g, '').replace(/^0/, '92');
  const wa = (phone, text) => UI.waLink(waNumber(phone), text);
  const appLink = () => { const b = UI.apiBase(); return `${/^https?:/.test(b) ? b : location.origin + b}/`; };
  // Reminders in the language the gym chose in Settings.
  const MSG_EN = {
    expiring: (m, s) => `Hi ${m.name}! Your ${S.data.business.name} membership ends on ${dateLong(s.expiry)} (${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left). Please renew in time so your training doesn't stop. Thank you!`,
    expired: (m, s) => `Hi ${m.name}! Your ${S.data.business.name} membership ended on ${dateLong(s.expiry)}. Renew to get back to training, we'd love to see you again! 💪`,
    dues: (m, s) => `Hi ${m.name}! You have ${rs(s.balance)} left to pay at ${S.data.business.name}. Please clear it on your next visit. Thank you!`,
    inactive: (m, s) => `Hi ${m.name}! ${s.daysSinceVisit == null ? 'We haven\u2019t seen you at the gym yet' : `We haven\u2019t seen you for ${s.daysSinceVisit} days`}. All good? We miss you, come in today! 💪`,
    birthday: (m) => `Happy Birthday ${m.name}! 🎉 Best wishes from everyone at ${S.data.business.name}. Stay strong!`,
    welcome: (m, pin) => `Welcome to ${S.data.business.name}, ${m.name}! 🎉\nMember number: ${m.memberNo}\nApp PIN: ${pin}\nSee your attendance, fees and classes here: ${appLink()}`,
  };
  const MSG = new Proxy({}, { get: (_, k) => (S.data?.business?.messageLang === 'en' && MSG_EN[k]) || MSG_UR[k] });
  const MSG_UR = {
    expiring: (m, s) => `Assalam o Alaikum ${m.name}! ${S.data.business.name} mein aap ki membership ${dateLong(s.expiry)} ko khatam ho rahi hai (${s.daysLeft} din baqi). Barah-e-karam fee time par jama karwa dein taa ke training na ruke. Shukriya!`,
    expired: (m, s) => `Assalam o Alaikum ${m.name}! Aap ki ${S.data.business.name} membership ${dateLong(s.expiry)} ko khatam ho chuki hai. Renew karwa kar dobara training shuru karein, hum aap ka intezar kar rahe hain! 💪`,
    dues: (m, s) => `Assalam o Alaikum ${m.name}! ${S.data.business.name} mein aap ki fee ka ${rs(s.balance)} baqaya hai. Agli dafa aate hue jama karwa dein. Shukriya!`,
    inactive: (m, s) => `Assalam o Alaikum ${m.name}! ${s.daysSinceVisit == null ? 'Aap abhi tak gym nahi aaye' : `${s.daysSinceVisit} din se aap gym nahi aaye`}. Sab khairiyat? Hum aap ko miss kar rahe hain, aaj hi aa jayein! 💪`,
    birthday: (m) => `Happy Birthday ${m.name}! 🎉 ${S.data.business.name} ki poori team ki taraf se dher saari mubarakbaad. Sehatmand rahein!`,
    welcome: (m, pin) => `Welcome to ${S.data.business.name}, ${m.name}! 🎉\nMember number: ${m.memberNo}\nApp PIN: ${pin}\nApni attendance, fee aur classes yahan dekhein: ${appLink()}`,
    receipt: (m, p) => {
      const paid = (p.installments || []).reduce((a, i) => a + i.amount, 0);
      return `${S.data.business.name} · Fee receipt #${p.receiptNo}\n${m.name} (Member ${m.memberNo})\nPlan: ${p.planName}\nPeriod: ${dateShort(p.periodStart)} to ${dateShort(p.periodEnd)}\nFee: ${rs(p.price)}${p.discount ? `\nDiscount: -${rs(p.discount)}` : ''}${p.admissionFee ? `\nAdmission: ${rs(p.admissionFee)}` : ''}\nTotal: ${rs(p.total)}\nPaid: ${rs(paid)}${p.total - paid > 0 ? `\nBalance: ${rs(p.total - paid)}` : ''}${S.data.business.messageLang === 'en' ? '\nThank you!' : '\nShukriya!'}`;
    },
  };
  const reminderFor = (m, s) => (s.status === 'expired' ? MSG.expired : s.status === 'expiring' ? MSG.expiring : s.balance > 0 ? MSG.dues : MSG.inactive)(m, s);

  // ---- auth -------------------------------------------------------------------

  async function loginView() {
    let business = { name: 'Gym', accent: '#f97316' };
    let demo = false;
    try { ({ business, demo } = await rawApi('/api/gym')); } catch { /* still allow sign-in */ }
    UI.setAccent(business.accent);
    let pin = '';
    root.innerHTML = `<div class="login"><div class="login-card">
      <div class="brand-mark">${esc(business.name.charAt(0))}</div>
      <h1>${esc(business.name)}</h1><p>Enter your PIN</p>
      <div class="pin-dots" aria-live="polite" aria-label="PIN entered">${'<i></i>'.repeat(4)}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key" data-k="${n}">${n}</button>`).join('')}
        <button class="key ghost" data-k="ok" aria-label="Sign in">${icon('chevronRight')}</button><button class="key" data-k="0">0</button><button class="key ghost" data-k="del" aria-label="Delete">${icon('backspace')}</button></div>
      ${demo ? '<p class="hint muted">Demo PINs: owner 1234 · front desk 0000</p>' : ''}
      <p class="hint"><a class="link" href="${UI.url('/index.html')}">← Member app</a></p>
    </div></div>`;
    const dots = root.querySelector('.pin-dots');
    const paint = () => { dots.innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join(''); };
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
      if (pin.length === 4 && k !== 'del') setTimeout(() => { if (pin.length === 4) submit(); }, 150);
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

  // ---- entry screen on a second monitor -----------------------------------------

  // The desktop app puts it full screen on the TV by itself. In Chrome or Edge
  // the browser can place a window on the other monitor once allowed to.
  async function openScreen(kind, e) {
    if (e.defaultPrevented) return; // the demo handles these links itself
    const desk = window.gymDesktop;
    if (desk) {
      e.preventDefault();
      return kind === 'entry' ? desk.openEntryScreen() : desk.openKiosk();
    }
    if (kind !== 'entry') return;
    e.preventDefault();
    let spot = null;
    try {
      if ('getScreenDetails' in window) {
        const d = await window.getScreenDetails();
        spot = d.screens.find((s) => s !== d.currentScreen) || null;
      }
    } catch { /* permission refused: fall back to a normal window */ }
    const size = spot
      ? `left=${spot.availLeft},top=${spot.availTop},width=${spot.availWidth},height=${spot.availHeight}`
      : 'width=1280,height=760';
    const open = () => window.open(UI.url('/display.html'), 'gymEntryScreen', `popup,${size}`);
    // Asking for the monitor list can use up the click, and then pop-ups are blocked.
    const win = open();
    if (!win) {
      return sheet({
        title: 'Open the entry screen',
        html: '<p>The browser blocked the new window. Press the button below, or allow pop-ups for this site.</p><button class="btn btn-primary btn-block" data-go style="margin-top:14px">Open entry screen</button>',
        onMount: (el, close) => el.querySelector('[data-go]').addEventListener('click', () => { if (open()) close(); }),
      });
    }
    win.focus();
    sheet({
      title: 'Entry screen opened',
      html: `<p>${spot ? 'It opened on your other monitor.' : 'It opened in a new window.'}</p>
        <ol class="steps">${spot ? '' : '<li>Drag the new window onto the wall monitor or TV.</li>'}
          <li>On that screen enter the PIN once and press <b>Full screen</b> (or F11).</li>
          <li>Keep working here; check-ins appear there by themselves.</li></ol>
        <p class="muted" style="margin-top:10px">No second monitor showing? Connect it with HDMI, press Windows + P and choose <b>Extend</b>.</p>`,
    });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-screen]');
    if (a) openScreen(a.dataset.screen, e);
  });

  // ---- shell -------------------------------------------------------------------

  const PAGE_RIGHTS = {
    desk: ['checkin'], members: ['members.view'], register: ['attendance'], fees: ['fees.view'], attendance: ['attendance'],
    classes: ['classes', 'settings'], leads: ['leads'], expenses: ['expenses'], reports: ['reports'], settings: ['settings', 'machines'], member: ['members.view'],
  };
  // Buttons marked data-need="right other-right" only show with one of those rights.
  // The server checks every action too; this just keeps the screen tidy.
  function applyRights() {
    if (!S.data || isOwner()) return;
    root.querySelectorAll('[data-need]').forEach((el) => { if (!el.dataset.need.split(' ').some(can)) el.style.display = 'none'; });
  }
  new MutationObserver(applyRights).observe(root, { childList: true, subtree: true });
  const allowed = (page) => isOwner() || !PAGE_RIGHTS[page] || PAGE_RIGHTS[page].some(can);
  const PAGES = () => [
    ['home', 'chart', 'Dashboard'],
    ['desk', 'login', 'Front desk'],
    ['members', 'users', 'Members'],
    ['register', 'list', 'Register'],
    ['fees', 'wallet', 'Fees'],
    ['attendance', 'clock', 'Attendance'],
    ['classes', 'calendar', 'Classes'],
    ['expenses', 'receipt', 'Expenses'],
    ['reports', 'trending', 'Reports'],
    ['leads', 'inbox', 'Enquiries'],
    ['settings', 'settings', 'Settings'],
  ].filter(([id]) => allowed(id));
  const BOTTOM = ['home', 'desk', 'register', 'members'];

  function shell(page, title, sub, body, { fab = null, actions = '' } = {}) {
    const b = S.data.business;
    const pages = PAGES();
    const bottom = BOTTOM.filter((id) => pages.some((p) => p[0] === id));
    const inBottom = bottom.includes(page);
    const screens = can('checkin');
    root.innerHTML = `<div class="shell">
      <aside class="side"><div class="side-brand"><div class="brand-mark">${esc(b.name.charAt(0))}</div><div><b>${esc(b.name)}</b><span>${isOwner() ? 'Owner' : esc(S.data.userName || 'Staff')}</span></div></div>
        ${pages.map(([id, ic, label]) => `<a class="nav-item" href="#/${id}" ${id === page ? 'aria-current="page"' : ''}>${icon(ic)}${esc(label)}</a>`).join('')}
        <div class="spacer"></div>
        ${screens ? `<a class="nav-item" href="${UI.url('/display.html')}" data-screen="entry">${icon('tv')}Entry screen (TV)</a>
        <a class="nav-item" href="${UI.url('/kiosk.html')}" data-screen="kiosk">${icon('kiosk')}Check-in kiosk</a>` : ''}
        <button class="nav-item" data-signout style="border:0;background:none;cursor:pointer;width:100%">${icon('logout')}Sign out</button>
      </aside>
      <div class="content">
        <header class="top"><h1>${esc(title)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</h1>${actions}</header>
        <div class="wrap view">${body}</div>
      </div>
      <nav class="bottom-nav" aria-label="Main">
        ${bottom.map((id) => { const [, ic, label] = pages.find((p) => p[0] === id); return `<a class="nav-item" href="#/${id}" ${id === page ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(label === 'Front desk' ? 'Desk' : label === 'Dashboard' ? 'Home' : label)}</span></a>`; }).join('')}
        <button class="nav-item" data-more style="border:0;background:none;cursor:pointer" ${!inBottom ? 'aria-current="page"' : ''}>${icon('more')}<span>More</span></button>
      </nav>
      ${fab && (!fab.need || can(fab.need)) ? `<button class="fab" data-fab aria-label="${esc(fab.label)}">${icon(fab.icon || 'plus')}</button>` : ''}
    </div>`;
    root.querySelector('[data-signout]').addEventListener('click', signOut);
    root.querySelector('[data-more]').addEventListener('click', () => sheet({
      title: 'More',
      html: `<div class="more-grid">${pages.filter(([id]) => !bottom.includes(id)).map(([id, ic, label]) => `<a href="#/${id}" data-close>${icon(ic)}${esc(label)}</a>`).join('')}
        ${screens ? `<a href="${UI.url('/kiosk.html')}" data-screen="kiosk">${icon('kiosk')}Kiosk</a><a href="${UI.url('/display.html')}" data-screen="entry">${icon('tv')}Entry screen</a>` : ''}<a href="#" data-close data-out>${icon('logout')}Sign out</a></div>`,
      onMount: (el) => el.querySelector('[data-out]').addEventListener('click', (e) => { e.preventDefault(); signOut(); }),
    }));
    root.querySelector('[data-fab]')?.addEventListener('click', fab?.onClick);
  }

  const panel = (title, body, extra = '') => `<section class="card panel"><div class="panel-head"><h2>${title}</h2>${extra}</div>${body}</section>`;
  const emptyLine = (text) => `<p class="muted" style="font-size:14px;padding:6px 4px">${esc(text)}</p>`;

  function memberRow(x, { end = '', sub } = {}) {
    return `<div class="m-row" role="button" tabindex="0" data-member="${esc(x.id)}">${avatar(x)}<span class="tx"><b>${esc(x.name)} <span class="no">#${x.memberNo}</span></b><span>${sub ?? esc(x.phone)}</span></span><span class="end">${end}</span></div>`;
  }

  function bindMemberRows(scope = root) {
    scope.querySelectorAll('[data-member]').forEach((el) => {
      const go = (e) => {
        if (e.target.closest('a,button')) return;
        if (!can('members.view')) return toast('You don’t have access to member profiles. Ask the owner.', 'bad');
        location.hash = `#/member/${el.dataset.member}`;
      };
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(e); });
    });
  }

  const waBtn = (phone, text, label = '') => `<a class="btn btn-ghost btn-sm" href="${wa(phone, text)}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('whatsapp')}${label}</a>`;

  // Simple bar chart. `series` share one axis; each has its own colour and a legend entry.
  function barChart(rows, series, { label, format = (n) => n, height = 180 } = {}) {
    const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key])));
    const grouped = series.length > 1;
    return `${grouped ? `<div class="legend" style="margin-bottom:8px">${series.map((s) => `<span><i style="--c:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>` : ''}
      <div class="chart${grouped ? ' grouped' : ''}" style="height:${height}px" role="img" aria-label="${esc(series.map((s) => s.label).join(' and '))} chart">
      ${rows.map((r) => `<div class="bar-col" tabindex="0">
        ${series.map((s) => `<div class="bar" style="height:${Math.max(1, (r[s.key] / max) * 100)}%;background:${s.color}"></div>`).join('')}
        <div class="tip"><b>${esc(label(r))}</b>${series.map((s) => `${esc(s.label)}: ${esc(format(r[s.key]))}`).join('<br>')}</div></div>`).join('')}
      </div>
      <div class="chart-x">${rows.map((r) => `<span>${esc(r.short ?? label(r))}</span>`).join('')}</div>
      <table class="sr-only"><tr><th>Period</th>${series.map((s) => `<th>${esc(s.label)}</th>`).join('')}</tr>${rows.map((r) => `<tr><td>${esc(label(r))}</td>${series.map((s) => `<td>${esc(format(r[s.key]))}</td>`).join('')}</tr>`).join('')}</table>`;
  }

  function hBars(list, { format = rs } = {}) {
    if (!list.length) return emptyLine('Nothing yet.');
    const max = Math.max(1, ...list.map((x) => x.amount));
    return `<div class="top-list">${list.map((x) => `<div class="top-row"><div class="row"><span>${esc(x.name)}</span><span class="tnum">${esc(format(x.amount))}</span></div><div class="track"><i style="width:${(x.amount / max) * 100}%"></i></div></div>`).join('')}</div>`;
  }

  // ---- dashboard ---------------------------------------------------------------

  function greeting() {
    const h = Math.floor(nowHere().minutes / 60);
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  async function homePage() {
    shell('home', greeting(), dateLong(today()), '<div class="kpis six">' + '<div class="skel" style="height:104px;border-radius:22px"></div>'.repeat(6) + '</div>', { fab: { label: 'Add member', icon: 'userPlus', need: 'members.add', onClick: () => addMemberSheet() } });
    const onPlatform = Boolean(window.APP_CONFIG?.base) && isOwner();
    const [o, month, plan] = await Promise.all([
      api('/api/admin/dashboard'),
      can('attendance') ? api(`/api/admin/register?month=${monthOf(today())}`) : null,
      onPlatform ? rawApi('/api/platform/status').catch(() => null) : null,
    ]);
    const M = month?.totals;
    const fees = can('fees.view');
    const c = o.counts;
    const kpi = (ic, label, val, sub, href, tone = '') => `<a class="card kpi link" href="${href}"><div class="k-head">${icon(ic)}${label}</div><div class="k-val tnum ${tone}">${val}</div><div class="k-sub">${sub}</div></a>`;
    const owner = o.money;
    const body = `
      ${planBar(plan)}${!o.demo && isOwner() && o.counts.members < 3 && !store.get('hideStart', false) ? startPanel(o) : ''}
      ${o.demo && can('settings') ? `<div class="demo-bar">${icon('info')}<span>This is demo data so you can try everything. Clear it from <b>Settings → Data</b> when you start for real.</span></div>` : ''}
      ${M ? `<section class="card panel" style="margin-bottom:16px"><div class="panel-head"><h2>${monthLabel(monthOf(today()), true)} so far</h2><a class="link" href="#/register">Open register</a></div>
        <div class="month-glance">
          <a href="#/register?f=came"><b class="tnum">${M.came}<small>/${M.members}</small></b><span>members came</span></a>
          <a href="#/register?f=absent"><b class="tnum ${M.notCame ? 'warn' : ''}">${M.notCame}</b><span>didn't come yet</span></a>
          <a href="#/register?f=paid"><b class="tnum">${M.paid}</b><span>fee paid</span></a>
          <a href="#/register?f=unpaid"><b class="tnum ${M.notPaid ? 'bad' : ''}">${M.notPaid}</b><span>fee not paid</span></a>
          ${fees ? `<a href="#/register?f=collected"><b class="tnum">${rs(M.collected)}</b><span>collected from ${M.payers}</span></a>` : ''}
        </div></section>` : ''}
      <div class="kpis six">
        ${kpi('login', 'In the gym now', c.insideNow, `${c.checkinsToday} check-ins today`, '#/desk')}
        ${kpi('users', 'Active members', c.active, `${c.newThisMonth} joined this month`, '#/members?status=active')}
        ${kpi('clock', 'Expiring soon', c.expiring, `in the next ${S.data.business.expiringDays} days`, '#/fees?tab=expiring', c.expiring ? 'warn' : '')}
        ${kpi('alert', 'Expired', c.expired, `${c.unpaid} never paid`, '#/fees?tab=expired', c.expired ? 'bad' : '')}
        ${fees ? kpi('wallet', 'Dues pending', rs(c.duesAmount), `${c.dues} members owe`, '#/fees?tab=dues', c.duesAmount ? 'bad' : '') : kpi('userPlus', 'New this month', c.newThisMonth, 'joined since the 1st', '#/members')}
        ${kpi('moon', 'Not coming', c.inactive, `${S.data.business.inactiveDays}+ days absent`, '#/members?status=inactive', c.inactive ? 'warn' : '')}
      </div>
      ${owner ? `<div class="kpis section-gap">
        <div class="card kpi"><div class="k-head">${icon('wallet')}Collected today</div><div class="k-val tnum">${rs(owner.today)}</div></div>
        <div class="card kpi"><div class="k-head">${icon('chart')}Collected this month</div><div class="k-val tnum">${rs(owner.month)}</div></div>
        <div class="card kpi"><div class="k-head">${icon('receipt')}Expenses this month</div><div class="k-val tnum">${rs(owner.expenses)}</div></div>
        <div class="card kpi"><div class="k-head">${icon('trending')}Profit this month</div><div class="k-val tnum ${owner.profit >= 0 ? 'good' : 'bad'}">${rs(owner.profit)}</div></div>
      </div>` : ''}
      <div class="grid-2">
        ${owner ? panel('Income vs expenses · 6 months', barChart(owner.months.map((m) => ({ ...m, short: monthLabel(m.month).split(' ')[0] })), [
          { key: 'revenue', label: 'Fees collected', color: 'var(--accent)' },
          { key: 'expenses', label: 'Expenses', color: '#94a3b8' },
        ], { label: (r) => monthLabel(r.month, true), format: rs }), '<a class="link" href="#/reports">Reports</a>')
          : panel('Busiest hours · last 4 weeks', peakChart(o.peak))}
        ${panel(`In the gym now <span class="muted" style="font-weight:600">· ${o.inside.length}</span>`, o.inside.length ? `<div class="rows">${o.inside.map((a) => memberRow({ ...a.member, id: a.memberId }, { sub: `In at ${time12(a.in)} · ${fmtMinutes(nowHere().minutes - toMin(a.in))}`, end: `<button class="btn btn-ghost btn-sm" data-out="${esc(a.memberId)}">${icon('logout')}Out</button>` })).join('')}</div>` : emptyLine('Nobody is checked in right now.'), '<a class="link" href="#/desk">Front desk</a>')}
      </div>
      ${owner ? `<div class="section-gap">${panel('Busiest hours · last 4 weeks', peakChart(o.peak))}</div>` : ''}
      <div class="grid-3">
        ${listPanel('Expiring soon', o.expiring, (x) => `${statusBadge(x)}${waBtn(x.phone, MSG.expiring(x, x))}`, 'All expiring', '#/fees?tab=expiring', 'Nobody expiring this week.')}
        ${listPanel('Expired · need renewal', o.expired, (x) => `${statusBadge(x)}${waBtn(x.phone, MSG.expired(x, x))}`, 'All expired', '#/fees?tab=expired', 'No recent expiries.')}
        ${fees ? listPanel('Fee dues', o.dues, (x) => `<b class="tnum money-neg">${rs(x.balance)}</b>${waBtn(x.phone, MSG.dues(x, x))}`, 'All dues', '#/fees?tab=dues', 'No pending dues.') : ''}
        ${listPanel(`Not coming lately`, o.inactive, (x) => `<span class="badge badge-muted">${x.daysSinceVisit == null ? 'Never came' : `${x.daysSinceVisit}d`}</span>${waBtn(x.phone, MSG.inactive(x, x))}`, 'See all', '#/members?status=inactive', 'Everyone is showing up. 💪')}
        ${o.birthdays.length ? listPanel('Birthdays this week 🎂', o.birthdays, (x) => `<span class="badge badge-accent">${dateShort(`${today().slice(0, 4)}-${x.dob.slice(5)}`)}</span>${waBtn(x.phone, MSG.birthday(x))}`, '', '', '') : ''}
        ${c.newLeads && can('leads') ? panel('New enquiries', `<p style="font-size:15px"><b>${c.newLeads}</b> people asked about joining.</p><a class="btn btn-soft btn-sm" style="margin-top:12px" href="#/leads">${icon('inbox')}Open enquiries</a>`) : ''}
      </div>`;
    root.querySelector('.wrap').innerHTML = body;
    root.querySelector('[data-hidestart]')?.addEventListener('click', () => { store.set('hideStart', true); homePage(); });
    root.querySelector('[data-startadd]')?.addEventListener('click', () => addMemberSheet());
    bindMemberRows();
    root.querySelectorAll('[data-out]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
      const r = await api('/api/admin/checkin', { method: 'POST', body: { memberId: b.dataset.out } });
      toast(`${r.member.name} checked out`);
      homePage();
    })));
  }

  // On the platform: how long the trial or subscription has left.
  function planBar(p) {
    if (!p || p.state === 'paid' || p.state === 'free') return '';
    const text = p.state === 'trial' ? `Free trial: <b>${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left</b>. Choose a plan to keep everything running.` : 'Your payment is due. Renew in the next few days to avoid a pause.';
    return `<div class="demo-bar">${icon('star')}<span>${text}</span><a class="btn btn-primary btn-sm" href="${esc(p.billingUrl)}">See plans</a></div>`;
  }

  // A new gym's first steps.
  function startPanel(o) {
    const steps = [
      [false, 'Check your plans and prices', '#/settings'],
      [o.counts.members > 0, 'Add your first member', null, 'data-startadd'],
      [S.data.staff.length > 0, 'Add your trainers', '#/settings'],
      [false, 'Give your front desk their own login', '#/settings'],
      [false, 'Connect your fingerprint machine', '#/settings'],
    ];
    return `<section class="card panel" style="margin-bottom:16px"><div class="panel-head"><h2>Get your gym ready</h2><button class="link" data-hidestart>Hide</button></div>
      <div class="start-steps">${steps.map(([done, text, href, attr]) => `${href ? `<a href="${href}"` : `<button type="button" ${attr}`} class="${done ? 'done' : ''}">${icon(done ? 'check' : 'chevronRight')}<span>${esc(text)}</span>${href ? '</a>' : '</button>'}`).join('')}</div>
      <p class="muted" style="font-size:13px;margin-top:12px">Member app link to share: <b>${esc(appLink())}</b></p></section>`;
  }

  function listPanel(title, list, end, linkLabel, href, empty) {
    return panel(title, list.length ? `<div class="rows">${list.map((x) => memberRow(x, { end: end(x), sub: x.plan ? `${esc(x.plan.name)} · ${x.expiry ? `till ${dateShort(x.expiry)}` : ''}` : esc(x.phone) })).join('')}</div>` : emptyLine(empty), linkLabel ? `<a class="link" href="${href}">${esc(linkLabel)}</a>` : '');
  }

  function peakChart(peak) {
    return barChart(peak.map((p) => ({ ...p, short: p.hour % 3 === 0 ? time12(`${String(p.hour).padStart(2, '0')}:00`).replace(':00', '').replace(' ', '') : '' })), [{ key: 'avg', label: 'Average check-ins', color: 'var(--accent)' }], { label: (r) => `${time12(`${String(r.hour).padStart(2, '0')}:00`)} – ${time12(`${String((r.hour + 1) % 24).padStart(2, '0')}:00`)}`, height: 140 });
  }

  // ---- front desk -------------------------------------------------------------

  async function deskPage() {
    shell('desk', 'Front desk', 'Check members in and out', `
      <div class="desk-search input-group">${icon('search')}<input class="input" id="desk-q" placeholder="Member no., name or phone" autocomplete="off" inputmode="search" aria-label="Find member" autofocus></div>
      <div id="desk-flash"></div>
      <div class="desk-results" id="desk-results"></div>
      <div class="grid-2" id="desk-lists"></div>`, { fab: { label: 'Add member', icon: 'userPlus', need: 'members.add', onClick: () => addMemberSheet() } });
    const input = document.getElementById('desk-q');
    const results = document.getElementById('desk-results');
    let members = [];
    const draw = () => {
      const term = input.value.trim().toLowerCase();
      if (!term) { results.innerHTML = ''; return; }
      const exact = members.filter((m) => String(m.memberNo) === term);
      const list = exact.length ? exact : members.filter((m) => m.name.toLowerCase().includes(term) || m.phone.replace(/\D/g, '').includes(term.replace(/\D/g, '') || '@@') || String(m.memberNo).startsWith(term)).slice(0, 8);
      results.innerHTML = list.length ? list.map((m) => `<div class="card desk-card">${avatar(m, 'lg')}<div class="tx"><b>${esc(m.name)} <span class="no">#${m.memberNo}</span></b><span>${statusBadge(m)} ${m.balance > 0 ? `<span class="badge badge-bad">Due ${rs(m.balance)}</span>` : ''}</span></div>
        <button class="btn ${m.inside ? 'btn-ghost' : 'btn-primary'}" data-toggle="${esc(m.id)}">${icon(m.inside ? 'logout' : 'login')}${m.inside ? 'Check out' : 'Check in'}</button></div>`).join('')
        : `<div class="card empty" style="padding:24px"><h3>No member found</h3><p>Try the member number or phone.</p></div>`;
      results.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggle(b, { memberId: b.dataset.toggle })));
    };
    const toggle = (btn, body) => busy(btn, async () => {
      try {
        const r = await api('/api/admin/checkin', { method: 'POST', body });
        flash(r);
        input.value = '';
        results.innerHTML = '';
        members = await api('/api/admin/members?status=all');
        lists();
        input.focus();
      } catch (e) {
        if (e.status === 409 && can('checkin.override') && (await confirmSheet({ title: 'Membership not active', message: `${e.message} Let them in anyway?`, confirm: 'Check in anyway' }))) {
          const r = await api('/api/admin/checkin', { method: 'POST', body: { ...body, force: true } });
          flash(r);
          lists();
        } else toast(e.message, 'bad');
      }
    });
    const flash = (r) => {
      const s = r.summary;
      const m = r.member;
      const warn = r.action === 'in' && (['expired', 'unpaid', 'left'].includes(s.status) || s.balance > 0 || s.status === 'expiring');
      const dur = r.action === 'out' ? toMin(r.visit.out) - toMin(r.visit.in) : 0;
      document.getElementById('desk-flash').innerHTML = `<div class="desk-flash ${r.action === 'out' ? 'out' : warn ? 'warn' : 'in'}">${avatar(m, 'lg')}<div class="tx">
        <h3>${r.action === 'in' ? `Welcome, ${esc(m.name.split(' ')[0])}!` : `Bye, ${esc(m.name.split(' ')[0])}!`} <span class="no">#${m.memberNo}</span></h3>
        <p>${r.action === 'in' ? `Checked in at ${time12(r.visit.in)}` : `Checked out · trained ${fmtMinutes(dur)}`} · ${statusBadge(s)}${s.balance > 0 ? ` <span class="badge badge-bad">Due ${rs(s.balance)}</span>` : ''}</p></div>
        ${warn && can('fees.collect') ? `<button class="btn btn-primary btn-sm" data-collect="${esc(m.id)}">${icon('wallet')}Collect fee</button>` : ''}</div>`;
      document.querySelector('[data-collect]')?.addEventListener('click', () => collectFeeSheet(m.id, deskPage));
    };
    const lists = async () => {
      const day = await api(`/api/admin/attendance?date=${today()}`);
      const inside = day.list.filter((a) => !a.out);
      const el = document.getElementById('desk-lists');
      if (!el) return;
      el.innerHTML = panel(`In the gym now · ${inside.length}`, inside.length ? `<div class="rows">${inside.map((a) => memberRow({ ...a.member, id: a.memberId }, { sub: `In ${time12(a.in)} · <span class="dur">${fmtMinutes(nowHere().minutes - toMin(a.in))}</span>`, end: `<button class="btn btn-ghost btn-sm" data-outbtn="${esc(a.memberId)}">${icon('logout')}Out</button>` })).join('')}</div>` : emptyLine('Nobody inside right now.'))
        + panel(`Today's log · ${day.list.length}`, day.list.length ? `<div class="rows">${day.list.slice(0, 30).map((a) => memberRow({ ...a.member, id: a.memberId }, { sub: `${a.source ? '☝ ' : ''}${time12(a.in)} → ${a.out ? time12(a.out) : 'inside'}` })).join('')}</div>` : emptyLine('No check-ins yet today.'), '<a class="link" href="#/attendance">Full log</a>');
      bindMemberRows(el);
      el.querySelectorAll('[data-outbtn]').forEach((b) => b.addEventListener('click', () => toggle(b, { memberId: b.dataset.outbtn })));
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const btn = results.querySelector('[data-toggle]');
      if (btn && results.querySelectorAll('[data-toggle]').length === 1) btn.click();
    });
    lists();
    input.focus();
    members = await api('/api/admin/members?status=all');
    draw();
  }

  // ---- members list ---------------------------------------------------------------

  const FILTERS = [['all', 'All'], ['active', 'Active'], ['expiring', 'Expiring'], ['expired', 'Expired'], ['unpaid', 'No fee'], ['dues', 'Dues'], ['inactive', 'Not coming'], ['inside', 'In gym'], ['frozen', 'Frozen'], ['left', 'Left']];

  async function membersPage(params) {
    const status = params.get('status') || 'all';
    const q = params.get('q') || '';
    const sort = params.get('sort') || 'new';
    shell('members', 'Members', '', `
      <div class="chips-row" role="group" aria-label="Filter">${FILTERS.map(([id, l]) => `<button class="chip" data-f="${id}" aria-pressed="${status === id}">${l}</button>`).join('')}</div>
      <div class="toolbar">
        <div class="grow input-group">${icon('search')}<input class="input" type="search" placeholder="Search name, phone or member no." value="${esc(q)}" data-q aria-label="Search members"></div>
        <select class="select" data-sort style="width:auto" aria-label="Sort"><option value="new" ${sort === 'new' ? 'selected' : ''}>Newest first</option><option value="name" ${sort === 'name' ? 'selected' : ''}>Name A–Z</option><option value="expiry" ${sort === 'expiry' ? 'selected' : ''}>Expiry date</option></select>
        <button class="btn btn-ghost btn-sm" data-csv style="min-height:50px">${icon('download')}CSV</button>
      </div>
      <div class="card panel" id="list"><div class="skel" style="height:300px"></div></div>`, { fab: { label: 'Add member', icon: 'userPlus', need: 'members.add', onClick: () => addMemberSheet() } });
    const go = (over) => {
      const p = new URLSearchParams({ status, q: input.value, sort, ...over });
      location.hash = `#/members?${p}`;
    };
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => go({ status: b.dataset.f })));
    root.querySelector(`[data-f="${status}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
    root.querySelector('[data-sort]').addEventListener('change', (e) => go({ sort: e.target.value }));
    const input = root.querySelector('[data-q]');
    let list = [];
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { history.replaceState(null, '', `#/members?${new URLSearchParams({ status, q: input.value, sort })}`); draw(); }, 200);
    });
    const draw = () => {
      const term = input.value.trim().toLowerCase();
      const items = list.filter((m) => !term || m.name.toLowerCase().includes(term) || m.phone.includes(term) || String(m.memberNo).includes(term));
      const el = document.getElementById('list');
      el.innerHTML = items.length ? `<div class="panel-head"><h2>${items.length} member${items.length === 1 ? '' : 's'}</h2></div><div class="rows">${items.map((m) => memberRow(m, {
        sub: `${m.plan ? esc(m.plan.name) : 'No plan'} · ${m.expiry ? `till ${dateShort(m.expiry)}` : 'joined ' + dateShort(m.joinDate)} · last visit ${ago(m.daysSinceVisit)}`,
        end: `${m.inside ? '<span class="badge badge-accent">In gym</span>' : ''}${m.balance > 0 ? `<span class="badge badge-bad">Due ${rs(m.balance)}</span>` : ''}${statusBadge(m)}`,
      })).join('')}</div>` : `<div class="empty"><div class="empty-icon">${icon('users')}</div><h3>No members here</h3><p>${term ? 'Nothing matches your search.' : 'Nobody in this group right now.'}</p></div>`;
      bindMemberRows(el);
    };
    root.querySelector('[data-csv]').addEventListener('click', () => {
      downloadCsv(`members-${status}-${today()}.csv`, ['Member no', 'Name', 'Phone', 'Gender', 'Joined', 'Plan', 'Status', 'Expiry', 'Days left', 'Balance', 'Total paid', 'Visits', 'Visits this month', 'Last visit', 'Months member', 'Months attended', 'Months missed', 'Months unpaid'],
        list.map((m) => [m.memberNo, m.name, m.phone, m.gender, m.joinDate, m.plan?.name || '', m.status, m.expiry || '', m.daysLeft ?? '', m.balance, m.totalPaid, m.totalVisits, m.visitsThisMonth, m.lastVisit || '', m.monthsMember, m.monthsAttended, m.monthsMissed, m.monthsUnpaid]));
    });
    list = await api(`/api/admin/members?${new URLSearchParams({ status, sort })}`);
    draw();
  }

  function downloadCsv(name, head, rows) {
    const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---- add / edit member ----------------------------------------------------------

  function memberFields(m = {}) {
    const trainers = S.data.staff.filter((s) => s.active !== false);
    return `<label class="field"><span>Full name</span><input class="input" name="name" value="${esc(m.name || '')}" maxlength="60" required autocomplete="off"></label>
      <label class="field"><span>Mobile</span><input class="input" name="phone" type="tel" inputmode="tel" value="${esc(m.phone || '')}" maxlength="20" required placeholder="03xx xxxxxxx"></label>
      <label class="field"><span>Gender</span><select class="select" name="gender">${[['male', 'Male'], ['female', 'Female'], ['other', 'Other']].map(([v, l]) => `<option value="${v}" ${m.gender === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Date of birth</span><input class="input" name="dob" type="date" value="${esc(m.dob || '')}" max="${today()}"></label>
      <label class="field"><span>Joining date</span><input class="input" name="joinDate" type="date" value="${esc(m.joinDate || today())}"></label>
      <label class="field"><span>Trainer</span><select class="select" name="trainerId"><option value="">No personal trainer</option>${trainers.map((t) => `<option value="${esc(t.id)}" ${t.id === m.trainerId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Goal</span><input class="input" name="goal" value="${esc(m.goal || '')}" list="goals" maxlength="60"><datalist id="goals"><option>Weight loss</option><option>Muscle gain</option><option>General fitness</option><option>Strength</option><option>Sports conditioning</option></datalist></label>
      <label class="field"><span>Address / area</span><input class="input" name="address" value="${esc(m.address || '')}" maxlength="200"></label>
      <label class="field"><span>Emergency contact</span><input class="input" name="emergencyName" value="${esc(m.emergencyName || '')}" maxlength="60" placeholder="Name"></label>
      <label class="field"><span>Emergency phone</span><input class="input" name="emergencyPhone" type="tel" value="${esc(m.emergencyPhone || '')}" maxlength="24"></label>
      <label class="field span"><span>Notes (injuries, preferences)</span><textarea class="textarea" name="notes" maxlength="500">${esc(m.notes || '')}</textarea></label>`;
  }

  function feeFields({ start, admission = 0, planId } = {}) {
    const plans = S.data.plans.filter((p) => p.active !== false);
    const methods = S.data.methods;
    return `<label class="field"><span>Plan</span><select class="select" name="planId">${plans.map((p) => `<option value="${esc(p.id)}" ${p.id === planId ? 'selected' : ''}>${esc(p.name)} · ${p.months} month${p.months > 1 ? 's' : ''} · ${rs(p.price)}</option>`).join('')}</select></label>
      <label class="field"><span>Starts on</span><input class="input" name="periodStart" type="date" value="${esc(start || today())}"><small data-ends></small></label>
      <label class="field"><span>Admission fee</span><input class="input" name="admissionFee" type="number" min="0" step="100" value="${admission}"></label>
      <label class="field"><span>Discount</span><input class="input" name="discount" type="number" min="0" step="100" value="0"></label>
      <div class="field span"><div class="card" style="padding:12px 16px;box-shadow:none" data-totals></div></div>
      <label class="field"><span>Amount received now</span><input class="input" name="paid" type="number" min="0" step="100"><small>Less than the total keeps the rest as dues.</small></label>
      <label class="field"><span>Paid by</span><select class="select" name="method">${methods.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>
      <label class="field"><span>Payment date</span><input class="input" name="date" type="date" value="${today()}" max="${today()}"></label>
      <label class="field"><span>Note</span><input class="input" name="note" maxlength="200" placeholder="Optional"></label>`;
  }

  // Keeps the total, end date and "amount received" in sync as the form changes.
  function wireFee(form) {
    let touched = false;
    const calc = () => {
      const plan = planById(form.planId.value);
      if (!plan) return 0;
      const total = plan.price - Number(form.discount.value || 0) + Number(form.admissionFee.value || 0);
      const end = form.periodStart.value ? addDays(addMonthsLocal(form.periodStart.value, plan.months), -1) : '';
      form.querySelector('[data-ends]').textContent = end ? `Valid till ${dateLong(end)}` : '';
      form.querySelector('[data-totals]').innerHTML = `<div class="sum-line"><span>${esc(plan.name)} fee</span><b class="tnum">${rs(plan.price)}</b></div>
        ${Number(form.admissionFee.value) ? `<div class="sum-line"><span>Admission</span><b class="tnum">${rs(Number(form.admissionFee.value))}</b></div>` : ''}
        ${Number(form.discount.value) ? `<div class="sum-line"><span>Discount</span><b class="tnum money-pos">−${rs(Number(form.discount.value))}</b></div>` : ''}
        <div class="sum-line total"><span>Total</span><span class="tnum">${rs(total)}</span></div>`;
      if (!touched) form.paid.value = Math.max(0, total);
      return total;
    };
    form.paid.addEventListener('input', () => { touched = true; });
    ['planId', 'periodStart', 'admissionFee', 'discount'].forEach((n) => form[n].addEventListener('input', calc));
    form.planId.addEventListener('change', calc);
    calc();
    return calc;
  }

  function addMonthsLocal(date, n) {
    const [y, m, d] = date.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(d, last));
    return t.toISOString().slice(0, 10);
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function addMemberSheet(prefill = {}) {
    sheet({
      title: 'New member',
      wide: true,
      html: `<form class="form-grid two" novalidate>${memberFields(prefill)}
        <div class="span" style="margin-top:6px"><label class="toggle-row"><span><b>Collect the first fee now</b></span><span class="switch"><input type="checkbox" name="withFee" checked><span></span></span></label></div>
        <div class="form-grid two span" data-fee>${feeFields({ admission: S.data.business.admissionFee })}</div></form>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>${icon('userPlus')}Add member</button></div>`,
      onMount: (el, close) => {
        const f = el.querySelector('form');
        wireFee(f);
        f.joinDate.addEventListener('change', () => { f.periodStart.value = f.joinDate.value; f.periodStart.dispatchEvent(new Event('input')); });
        f.withFee.addEventListener('change', () => { el.querySelector('[data-fee]').hidden = !f.withFee.checked; });
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          const d = formData(f);
          const body = { ...d, payment: f.withFee.checked ? { planId: d.planId, periodStart: d.periodStart, admissionFee: d.admissionFee, discount: d.discount, paid: d.paid, method: d.method, date: d.date, note: d.note } : null };
          try {
            const r = await api('/api/admin/members', { method: 'POST', body });
            close();
            if (prefill.leadId) api(`/api/admin/leads/${prefill.leadId}`, { method: 'PUT', body: { status: 'joined' } }).catch(() => {});
            setTimeout(() => pinSheet(r.member, r.pin, true), 240);
          } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    });
  }

  function pinSheet(m, pin, isNew) {
    sheet({
      label: 'Member app PIN',
      html: `<div class="pin-reveal">${avatar(m, 'lg')}<h3 style="margin-top:10px">${isNew ? `${esc(m.name)} is a member!` : 'New app PIN'}</h3>
        <p class="muted">Member number <b>#${m.memberNo}</b>. Their app PIN is shown only now:</p>
        <div class="code">${pin.split('').map((d) => `<b>${d}</b>`).join('')}</div></div>
        ${isNew && can('members.edit') ? `<div class="enroll-offer"><b>Register on the fingerprint / face machine</b><p class="muted">Ask ${esc(m.name.split(' ')[0])} what's easiest for them:</p>
          <div class="method-row">${ENROLL_METHODS.map(([id, ic, label]) => `<button type="button" class="method-chip" data-method="${id}">${icon(ic)}${label}</button>`).join('')}</div></div>` : ''}
        <div class="sheet-actions"><a class="btn btn-primary" href="${wa(m.phone, MSG.welcome(m, pin))}" target="_blank" rel="noopener">${icon('whatsapp')}Send on WhatsApp</a><button class="btn btn-ghost" data-open>Open profile</button></div>`,
      onMount: (el, close) => {
        el.querySelector('[data-open]').addEventListener('click', () => { close(); location.hash = `#/member/${m.id}`; if (location.hash === `#/member/${m.id}`) route(); });
        el.querySelectorAll('[data-method]').forEach((b) => b.addEventListener('click', () => { close(); setTimeout(() => enrollSheet(m, { method: b.dataset.method }), 240); }));
      },
    });
  }

  // ---- registering on the fingerprint / face machine ----------------------------------

  const ENROLL_METHODS = [['fingerprint', 'fingerprint', 'Fingerprint'], ['face', 'user', 'Face'], ['face-nir', 'user', 'Near-infrared face'], ['palm', 'hand', 'Palm'], ['card', 'ticket', 'Card'], ['pin', 'lock', 'PIN code']];
  // Finger numbers as the machine counts them (0 = left little … 9 = right little).
  const FINGERS = [[6, 'Right index'], [5, 'Right thumb'], [7, 'Right middle'], [3, 'Left index'], [4, 'Left thumb'], [2, 'Left middle'], [8, 'Right ring'], [1, 'Left ring'], [9, 'Right little'], [0, 'Left little']];

  function credentialChips(c = {}) {
    const items = [
      ['fingerprint', 'Fingerprint', c.fingers?.length ? `${c.fingers.length} finger${c.fingers.length === 1 ? '' : 's'}` : ''],
      ['user', 'Face', c.face ? 'Saved' : ''],
      ['hand', 'Palm', c.palm ? 'Saved' : ''],
      ['ticket', 'Card', c.card ? `No. ${c.card}` : ''],
      ['lock', 'PIN code', c.pin ? 'Set' : ''],
    ];
    return `<div class="cred-chips">${items.map(([ic, label, val]) => `<div class="cred ${val ? 'on' : ''}">${icon(ic)}<span><b>${label}</b><small>${val || 'Not registered'}</small></span></div>`).join('')}</div>`;
  }

  async function enrollSheet(m, { method = 'fingerprint' } = {}, onDone) {
    let devices = [];
    try { devices = (await api('/api/admin/devices')).devices.filter((dv) => dv.approved); } catch { /* shown below */ }
    const first = esc(m.name.split(' ')[0]);
    if (!devices.length) {
      return sheet({
        title: 'Register on a machine',
        html: `<div class="empty" style="padding:10px 0"><div class="empty-icon">${icon('fingerprint')}</div><h3>No machine added yet</h3><p>Add your fingerprint or face machine first, then register ${first} here.</p></div>
          ${can('machines') ? '<div class="sheet-actions"><a class="btn btn-primary" href="#/settings" data-close>Add a machine</a></div>' : ''}`,
      });
    }
    sheet({
      title: `Register ${m.name}`,
      wide: true,
      html: `<form class="enroll" novalidate>
        <p class="muted" style="margin-bottom:12px">Member <b>#${m.memberNo}</b> · ask ${first} which is easiest, then they scan on the machine.</p>
        ${devices.length > 1 ? `<label class="field" style="margin-bottom:12px"><span>Machine</span><select class="select" name="deviceId">${devices.map((dv) => `<option value="${esc(dv.id)}">${esc(dv.name)}${dv.online ? '' : ' (offline)'}</option>`).join('')}</select></label>` : `<input type="hidden" name="deviceId" value="${esc(devices[0].id)}">`}
        <div class="method-grid" role="radiogroup" aria-label="How they check in">${ENROLL_METHODS.map(([id, ic, label]) => `<label class="method"><input type="radio" name="method" value="${id}" ${id === method ? 'checked' : ''}><span>${icon(ic)}<b>${label}</b></span></label>`).join('')}</div>
        <div data-extra></div>
        <div class="sheet-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit">${icon('fingerprint')}Start on machine</button></div></form>`,
      onMount: (el, close) => {
        const f = el.querySelector('form');
        const extra = el.querySelector('[data-extra]');
        const drawExtra = () => {
          const v = f.method.value;
          extra.innerHTML = v === 'fingerprint' ? `<label class="field"><span>Which finger</span><select class="select" name="finger">${FINGERS.map(([n, l]) => `<option value="${n}">${l}</option>`).join('')}</select></label>`
            : v === 'card' ? '<label class="field"><span>Card number</span><input class="input" name="card" inputmode="numeric" autocomplete="off" placeholder="Tap the card on the desk reader or type the number on it"></label>'
              : v === 'pin' ? '<label class="field"><span>PIN for the machine (4 to 8 digits)</span><input class="input" name="pin" inputmode="numeric" maxlength="8" autocomplete="off"></label>'
                : `<p class="muted" style="font-size:13.5px">${v === 'palm' ? 'For machines with a palm sensor.' : v === 'face-nir' ? 'For older face machines with an infrared camera (MB160, iFace).' : 'For SpeedFace, ProFace and other visible light face machines.'}</p>`;
          extra.querySelector('input')?.focus();
        };
        f.querySelectorAll('[name=method]').forEach((r) => r.addEventListener('change', drawExtra));
        drawExtra();
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const body = formData(f);
          busy(f.querySelector('[type=submit]'), async () => {
            try {
              const r = await api(`/api/admin/members/${m.id}/enroll`, { method: 'POST', body });
              const device = devices.find((dv) => dv.id === body.deviceId);
              enrollWait(el, close, m, body.method, r.commands[r.commands.length - 1], device, onDone);
            } catch (err) { toast(err.message, 'bad'); }
          });
        });
      },
    });
  }

  // Waits for the machine to pick up the command and for the member to scan.
  function enrollWait(el, close, m, method, cmdId, device, onDone) {
    const first = esc(m.name.split(' ')[0]);
    const label = ENROLL_METHODS.find((x) => x[0] === method)[2];
    const ask = {
      fingerprint: `Ask ${first} to put the chosen finger on the machine when it asks, three times.`,
      face: `Ask ${first} to stand in front of the machine and look at the screen until it beeps.`,
      'face-nir': `Ask ${first} to stand in front of the machine and look at the screen until it beeps.`,
      palm: `Ask ${first} to hold their open palm over the sensor until it beeps.`,
      card: 'Saving the card on the machine.',
      pin: 'Saving the PIN on the machine.',
    }[method];
    const manual = `On the machine: <b>Menu → User Mgt → All Users → ${m.memberNo} → Edit → ${method === 'pin' ? 'Password' : method === 'face-nir' ? 'Face' : label}</b>.`;
    const ic = ENROLL_METHODS.find((x) => x[0] === method)[1];
    const box = el.querySelector('.sheet-body');
    const started = Date.now();
    const draw = (state, text, sub = '') => {
      box.innerHTML = `<div class="enroll-wait ${state}"><div class="pulse">${icon(state === 'ok' ? 'check' : state === 'bad' ? 'alert' : ic)}</div>
        <h3>${text}</h3><p class="muted">${sub}</p></div>
        <div class="sheet-actions">${state === 'ok' ? '<button class="btn btn-primary" data-close>Done</button>' : state === 'bad' ? `<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-primary" data-retry>Try again</button>` : '<button class="btn btn-ghost" data-close>Close</button>'}</div>`;
      box.querySelector('[data-retry]')?.addEventListener('click', () => { close(); setTimeout(() => enrollSheet(m, { method }, onDone), 240); });
    };
    draw('wait', 'Sending to the machine…', `${esc(device.name)} checks for work every few seconds.`);
    const tick = async () => {
      if (!el.isConnected) return;
      let st;
      try { st = await api(`/api/admin/members/${m.id}/enroll`); } catch { return setTimeout(tick, 3000); }
      const c = st.commands.find((x) => x.id === cmdId);
      if (c?.status === 'ok') {
        draw('ok', `${label} saved`, `${first} can now check in at ${esc(device.name)}.`);
        onDone?.();
        return;
      }
      if (c?.status === 'failed') return draw('bad', 'It didn’t work', `${esc(c.error || 'The machine refused it.')}<br><br>${manual}`);
      if (c?.status === 'sent') draw('wait', method === 'card' || method === 'pin' ? 'Saving…' : `${label}: scan now`, ask);
      if (c?.status === 'pending' && Date.now() - started > 90000) {
        return draw('bad', 'The machine didn’t answer', `Is ${esc(device.name)} switched on and connected? ${device.lastSeen ? '' : 'It has never connected yet.'}<br>The request stays waiting and runs when it connects.<br><br>Or register on the machine now: ${manual}`);
      }
      if (Date.now() - started > 4 * 60 * 1000) return draw('bad', 'No answer yet', `Check the machine's screen. ${manual}`);
      setTimeout(tick, 2000);
    };
    setTimeout(tick, 1500);
  }

  // ---- collect fee ----------------------------------------------------------------

  async function collectFeeSheet(memberId, after) {
    const d = await api(`/api/admin/members/${memberId}`);
    const m = d.member;
    const s = d.summary;
    const lastPlan = d.payments[0]?.planId;
    sheet({
      title: s.status === 'unpaid' ? 'First fee' : 'Collect fee / renew',
      wide: true,
      html: `<div class="m-row" style="cursor:default;margin-bottom:10px">${avatar(m)}<span class="tx"><b>${esc(m.name)} <span class="no">#${m.memberNo}</span></b><span>${s.expiry ? `Current fee ${s.status === 'expired' ? 'ended' : 'runs till'} ${dateLong(s.expiry)}` : 'No fee paid yet'}</span></span>${statusBadge(s)}</div>
        ${s.balance > 0 ? `<div class="note-box">${icon('alert')}<span>${rs(s.balance)} is still due on older receipts. Collect it from the receipt in the member's profile.</span></div>` : ''}
        <form class="form-grid two" novalidate>${feeFields({ start: d.suggestedStart, admission: s.status === 'unpaid' ? S.data.business.admissionFee : 0, planId: lastPlan })}</form>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>${icon('check')}Save payment</button></div>`,
      onMount: (el, close) => {
        const f = el.querySelector('form');
        wireFee(f);
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          try {
            const p = await api('/api/admin/payments', { method: 'POST', body: { ...formData(f), memberId } });
            close();
            toast(`Receipt #${p.receiptNo} saved`);
            setTimeout(() => receiptSheet(m, p, after), 240);
          } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    });
  }

  function receiptSheet(m, p, after) {
    const paid = p.installments.reduce((a, i) => a + i.amount, 0);
    sheet({
      title: `Receipt #${p.receiptNo}`,
      html: `<div class="card" style="padding:4px 16px;box-shadow:none">
          <div class="sum-line"><span>Member</span><b>${esc(m.name)} #${m.memberNo}</b></div>
          <div class="sum-line"><span>Plan</span><b>${esc(p.planName)}</b></div>
          <div class="sum-line"><span>Valid</span><b>${dateShort(p.periodStart)} – ${dateShort(p.periodEnd)}</b></div>
          <div class="sum-line"><span>Total</span><b class="tnum">${rs(p.total)}</b></div>
          <div class="sum-line"><span>Paid</span><b class="tnum">${rs(paid)}</b></div>
          ${p.total - paid > 0 ? `<div class="sum-line"><span>Balance due</span><b class="tnum money-neg">${rs(p.total - paid)}</b></div>` : ''}
        </div>
        <div class="sheet-actions"><a class="btn btn-primary" href="${wa(m.phone, MSG.receipt(m, p))}" target="_blank" rel="noopener">${icon('whatsapp')}Send receipt</a><button class="btn btn-ghost" data-close>Done</button></div>`,
    }).then(() => after?.());
  }

  function installmentSheet(m, p, after) {
    const due = p.total - p.installments.reduce((a, i) => a + i.amount, 0);
    sheet({
      title: 'Collect balance',
      html: `<p class="muted" style="margin-bottom:14px">Receipt #${p.receiptNo} · ${esc(p.planName)} · ${rs(due)} due</p>
        <form class="form-grid two" novalidate>
          <label class="field"><span>Amount</span><input class="input" name="amount" type="number" min="1" max="${due}" value="${due}"></label>
          <label class="field"><span>Paid by</span><select class="select" name="method">${S.data.methods.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>
          <label class="field"><span>Date</span><input class="input" name="date" type="date" value="${today()}" max="${today()}"></label>
        </form>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>Save</button></div>`,
      onMount: (el, close) => {
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          try {
            const updated = await api(`/api/admin/payments/${p.id}/installments`, { method: 'POST', body: formData(el.querySelector('form')) });
            close();
            toast('Balance collected');
            setTimeout(() => receiptSheet(m, updated, after), 240);
          } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    });
  }

  async function pickMember(title, onPick) {
    const list = await api('/api/admin/members?status=all');
    sheet({
      title,
      html: `<div class="input-group">${icon('search')}<input class="input" placeholder="Name, phone or member no." data-q autofocus></div><div class="rows" style="margin-top:10px;max-height:50vh;overflow:auto" data-list></div>`,
      onMount: (el, close) => {
        const q = el.querySelector('[data-q]');
        const draw = () => {
          const t = q.value.trim().toLowerCase();
          const items = list.filter((m) => !t || m.name.toLowerCase().includes(t) || m.phone.includes(t) || String(m.memberNo).startsWith(t)).slice(0, 30);
          el.querySelector('[data-list]').innerHTML = items.map((m) => `<button class="m-row" data-pick="${esc(m.id)}">${avatar(m)}<span class="tx"><b>${esc(m.name)} <span class="no">#${m.memberNo}</span></b><span>${esc(m.phone)}</span></span><span class="end">${statusBadge(m)}</span></button>`).join('') || emptyLine('No match.');
          el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { close(); setTimeout(() => onPick(b.dataset.pick), 240); }));
        };
        q.addEventListener('input', draw);
        draw();
      },
    });
  }

  // ---- member profile ---------------------------------------------------------------

  async function memberPage(id, params) {
    shell('members', 'Member', '', '<div class="skel" style="height:420px;border-radius:22px"></div>');
    let d;
    try {
      d = await api(`/api/admin/members/${id}`);
    } catch (e) {
      root.querySelector('.wrap').innerHTML = `<div class="card empty"><h3>Member not found</h3><p>${esc(e.message)}</p><a class="btn btn-primary" href="#/members">All members</a></div>`;
      return;
    }
    const m = d.member;
    const s = d.summary;
    const reload = () => memberPage(id, params);
    const trainer = staffById(m.trainerId);
    const periodLen = d.payments[0] ? (Date.parse(d.payments[0].periodEnd) - Date.parse(d.payments[0].periodStart)) / 864e5 + 1 : 30;
    const leftPct = s.daysLeft == null ? 0 : Math.max(0, Math.min(100, (s.daysLeft / periodLen) * 100));
    const calMonth = params.get('cal') || monthOf(today());

    root.querySelector('.top h1').innerHTML = `<a class="icon-btn" href="#/members" aria-label="Back" style="display:inline-grid;vertical-align:middle;margin-right:10px">${icon('chevronLeft')}</a>${esc(m.name)}`;
    root.querySelector('.wrap').innerHTML = `
      <section class="card profile-head"><button class="photo-edit" data-photo aria-label="Change photo">${avatar(m, 'xl')}<span class="cam" data-need="members.edit">${icon('camera')}</span></button>
        <div class="tx"><h2>${esc(m.name)} <span class="no">#${m.memberNo}</span></h2><p>${esc(m.phone)} · ${m.gender}${age(m.dob) ? ` · ${age(m.dob)} yrs` : ''} · joined ${dateLong(m.joinDate)}</p>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${statusBadge(s)}${s.inside ? '<span class="badge badge-accent">In the gym now</span>' : ''}${s.balance > 0 ? `<span class="badge badge-bad">Due ${rs(s.balance)}</span>` : ''}</div></div>
        <div class="acts">
          <button class="btn btn-primary btn-sm" data-fee data-need="fees.collect">${icon('wallet')}${s.status === 'unpaid' ? 'Collect fee' : 'Renew / collect'}</button>
          <button class="btn btn-ghost btn-sm" data-check data-need="checkin">${icon(s.inside ? 'logout' : 'login')}${s.inside ? 'Check out' : 'Check in'}</button>
          <a class="btn btn-ghost btn-sm" href="tel:${esc(m.phone)}">${icon('phone')}Call</a>
          ${waBtn(m.phone, reminderFor(m, s), 'WhatsApp')}
        </div>
      </section>

      <div class="grid-2">
        <section class="card mem-card">
          <div class="row"><div><span class="muted" style="font-size:13px;font-weight:700">Current membership</span><div class="big">${s.plan ? esc(s.plan.name) : 'No plan yet'}</div></div>
            <div style="text-align:right"><span class="muted" style="font-size:13px;font-weight:700">${s.status === 'expired' ? 'Expired on' : 'Valid till'}</span><div class="big tnum">${s.expiry ? dateShort(s.expiry) : '—'}</div></div></div>
          ${s.expiry ? `<div class="progress-track ${s.status === 'expiring' ? 'warn' : s.status === 'expired' ? 'bad' : ''}"><i style="width:${s.status === 'expired' ? 100 : leftPct}%"></i></div>
          <div class="row" style="font-size:13.5px;font-weight:650"><span>${s.status === 'expired' ? `Expired ${-s.daysLeft} days ago` : s.status === 'frozen' ? `Frozen till ${dateShort(s.frozen.to)}` : `${s.daysLeft} days left`}</span><span class="muted">${s.monthsPaid} months paid in total</span></div>` : '<p class="muted">Collect the first fee to start the membership.</p>'}
          ${s.balance > 0 ? `<div class="note-box" style="margin:0">${icon('alert')}<span>${rs(s.balance)} pending on old receipts.</span></div>` : ''}
        </section>
        <section class="card panel">
          <div class="panel-head"><h2>Details</h2><button class="link" data-edit data-need="members.edit">${icon('edit')} Edit</button></div>
          <div class="kv" style="margin:0">
            <div><span>Trainer</span><b>${esc(trainer?.name || 'None')}</b></div><div><span>Goal</span><b>${esc(m.goal || '—')}</b></div>
            <div><span>Date of birth</span><b>${m.dob ? dateShort(m.dob) : '—'}</b></div><div><span>Area</span><b>${esc(m.address || '—')}</b></div>
            <div><span>Emergency</span><b>${esc(m.emergencyName || '—')}${m.emergencyPhone ? ` · ${esc(m.emergencyPhone)}` : ''}</b></div>${can('fees.view') ? `<div><span>Total paid</span><b class="tnum">${rs(s.totalPaid)}</b></div>` : ''}
            <div style="grid-column:1/-1"><span>Fingerprint machine ID</span><b>${icon('fingerprint')} ${m.memberNo}</b> <small class="muted">enroll the thumb on the machine under this user ID</small></div>
          </div>
          ${m.notes ? `<div class="note-box" style="margin:12px 0 0">${icon('info')}<span>${esc(m.notes)}</span></div>` : ''}
        </section>
      </div>

      <section class="card panel section-gap"><div class="panel-head"><h2>Attendance record</h2></div>
        <div class="stat-grid">
          <div class="stat"><span>Member for</span><b>${s.monthsMember} month${s.monthsMember === 1 ? '' : 's'}</b><small>since ${dateShort(m.joinDate)}</small></div>
          <div class="stat"><span>Months attended</span><b>${s.monthsAttended}</b><small>of ${s.monthsMember}</small></div>
          <div class="stat"><span>Months missed</span><b class="${s.monthsMissed ? 'money-neg' : ''}">${s.monthsMissed}</b><small>no visit all month</small></div>
          <div class="stat"><span>Months without fee</span><b class="${s.monthsUnpaid ? 'money-neg' : ''}">${s.monthsUnpaid}</b><small>not covered by a payment</small></div>
          <div class="stat"><span>Total visits</span><b>${s.totalVisits}</b><small>${s.visitsThisMonth} this month</small></div>
          <div class="stat"><span>Last visit</span><b>${s.lastVisit ? dateShort(s.lastVisit) : '—'}</b><small>${ago(s.daysSinceVisit)}</small></div>
          <div class="stat"><span>Avg. time in gym</span><b>${fmtMinutes(s.avgMinutes)}</b><small>per visit</small></div>
          <div class="stat"><span>Visits / month</span><b>${s.monthsAttended ? Math.round(s.totalVisits / s.monthsAttended) : 0}</b><small>in months they came</small></div>
          <div class="stat"><span>Freezes</span><b>${(m.freezes || []).length}</b><small>${(m.freezes || []).reduce((a, f) => a + (Date.parse(f.to) - Date.parse(f.from)) / 864e5 + 1, 0)} days total</small></div>
          <div class="stat"><span>Classes booked</span><b>${d.bookings.length}</b><small>upcoming</small></div>
        </div>
        <h3 style="font-size:15px;margin:20px 0 10px">Month by month</h3>
        <div class="months">${s.months.slice().reverse().map((x) => {
          const cls = x.frozen ? 'frozen' : x.paid ? (x.visits ? 'paid-came' : 'paid-missed') : x.visits ? 'unpaid-came' : 'gap';
          const text = x.frozen ? 'Frozen' : `${x.visits} visit${x.visits === 1 ? '' : 's'}`;
          const title = `${monthLabel(x.month, true)}: ${x.frozen ? 'frozen' : x.paid ? 'fee paid' : 'no fee'}, ${x.visits} visits`;
          return `<div class="month ${cls}" title="${esc(title)}"><b>${monthLabel(x.month)}</b><span>${text}</span><span>${x.frozen ? '' : x.paid ? 'Paid' : 'Not paid'}</span></div>`;
        }).join('')}</div>
        <div class="month-legend"><span><i style="background:var(--good-soft);border:1.5px solid var(--good)"></i>Paid & came</span><span><i style="background:var(--warn-soft);border:1.5px solid var(--warn)"></i>Paid, didn't come</span><span><i style="background:var(--bad-soft);border:1.5px solid var(--bad)"></i>Came without fee</span><span><i style="background:var(--surface-2);border:1.5px dashed var(--ink-3)"></i>No fee, didn't come</span><span><i style="background:color-mix(in srgb,#3b82f6 13%,transparent);border:1.5px solid #3b82f6"></i>Frozen</span></div>
      </section>

      <div class="grid-2">
        <section class="card panel">${calendar(d.attendance, calMonth, m.joinDate)}</section>
        <section class="card panel"><div class="panel-head"><h2>Recent visits</h2></div>
          ${d.attendance.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Date</th><th>In</th><th>Out</th><th class="num">Time</th></tr>${d.attendance.slice(0, 12).map((a) => `<tr><td>${dateShort(a.date)}${a.source ? ` ${icon('fingerprint', 'src-ico')}` : ''}</td><td>${time12(a.in)}</td><td>${a.out ? time12(a.out) : '<span class="muted">—</span>'}</td><td class="num">${a.out ? fmtMinutes(toMin(a.out) - toMin(a.in)) : ''}</td></tr>`).join('')}</table></div>` : emptyLine('No visits yet.')}
        </section>
      </div>

      <section class="card panel section-gap" data-need="fees.view fees.collect"><div class="panel-head"><h2>Fee history</h2><button class="btn btn-soft btn-sm" data-fee data-need="fees.collect">${icon('plus')}New payment</button></div>
        ${d.payments.length ? `<div class="item-list" data-receipts>${d.payments.map((p, idx) => {
          const paid = p.installments.reduce((a, i) => a + i.amount, 0);
          const due = p.total - paid;
          return `<div class="receipt"${idx >= 3 ? ' data-old hidden' : ''}><div class="r-top"><div><b>${esc(p.planName)} · ${dateShort(p.periodStart)} – ${dateShort(p.periodEnd)}</b><span>Receipt #${p.receiptNo} · ${p.installments.map((i) => `${rs(i.amount)} ${esc(i.method)} on ${dateShort(i.date)}`).join(' · ') || 'nothing paid yet'}</span></div>
            ${due > 0 ? `<span class="badge badge-bad">Due ${rs(due)}</span>` : '<span class="badge badge-good">Paid</span>'}</div>
            <div class="amounts"><span>Fee <b class="tnum">${rs(p.price)}</b></span>${p.discount ? `<span>Discount <b class="tnum">−${rs(p.discount)}</b></span>` : ''}${p.admissionFee ? `<span>Admission <b class="tnum">${rs(p.admissionFee)}</b></span>` : ''}<span>Total <b class="tnum">${rs(p.total)}</b></span><span>Paid <b class="tnum">${rs(paid)}</b></span></div>
            <div class="acts">${due > 0 ? `<button class="btn btn-primary btn-sm" data-inst="${esc(p.id)}" data-need="fees.collect">${icon('wallet')}Collect ${rs(due)}</button>` : ''}${waBtn(m.phone, MSG.receipt(m, p), 'Receipt')}${can('fees.delete') ? `<button class="btn btn-ghost btn-sm" data-delpay="${esc(p.id)}" aria-label="Delete receipt">${icon('trash')}</button>` : ''}</div></div>`;
        }).join('')}</div>${d.payments.length > 3 ? `<button class="btn btn-ghost btn-sm" style="margin-top:12px" data-allreceipts>Show all ${d.payments.length} receipts</button>` : ''}` : emptyLine('No payments yet.')}
      </section>

      <section class="card panel section-gap"><div class="panel-head"><h2>Workout plan</h2><div style="display:flex;gap:6px" data-need="members.edit"><button class="btn btn-ghost btn-sm" data-wpreset>${icon('star')}Ready plans</button><button class="btn btn-soft btn-sm" data-wday>${icon('edit')}Edit a day</button></div></div>
        <div data-plan><div class="skel" style="height:70px"></div></div></section>

      <div class="grid-2">
        <section class="card panel"><div class="panel-head"><h2>Body measurements</h2><button class="btn btn-soft btn-sm" data-measure data-need="members.edit">${icon('plus')}Add</button></div>${measurementsView(d.measurements)}</section>
        <section class="card panel"><div class="panel-head"><h2>Freeze membership</h2><button class="btn btn-soft btn-sm" data-freeze data-need="members.edit">${icon('snow')}Freeze</button></div>
          <p class="muted" style="font-size:13.5px;margin-bottom:10px">Pausing adds the frozen days to the end of the membership.</p>
          ${(m.freezes || []).length ? `<div class="rows">${m.freezes.map((f, i) => `<div class="m-row" style="cursor:default"><span class="ic-tile">${icon('snow')}</span><span class="tx"><b>${dateShort(f.from)} – ${dateShort(f.to)}</b><span>${(Date.parse(f.to) - Date.parse(f.from)) / 864e5 + 1} days${f.reason ? ` · ${esc(f.reason)}` : ''}</span></span><span class="end"><button class="icon-btn" data-unfreeze="${i}" data-need="members.edit" aria-label="Remove freeze">${icon('x')}</button></span></div>`).join('')}</div>` : emptyLine('Never frozen.')}
        </section>
      </div>

      <section class="card panel section-gap"><div class="panel-head"><h2>${icon('fingerprint')} Machine access</h2><button class="btn btn-soft btn-sm" data-enroll data-need="members.edit">${icon('plus')}Register on machine</button></div>
        ${credentialChips(m.credentials)}
        <p class="muted" style="font-size:13px;margin-top:10px">Machine user ID: <b>${m.memberNo}</b></p></section>

      <section class="card panel section-gap" data-need="members.edit members.delete"><div class="panel-head"><h2>Account</h2></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" data-pin data-need="members.edit">${icon('lock')}Reset app PIN</button>
          <button class="btn btn-ghost btn-sm" data-left data-need="members.edit">${icon(m.left ? 'refresh' : 'logout')}${m.left ? 'Rejoin (mark active)' : 'Mark as left'}</button>
          ${can('members.delete') ? `<button class="btn btn-danger btn-sm" data-del>${icon('trash')}Delete member</button>` : ''}
        </div></section>`;

    const $ = (sel) => root.querySelectorAll(sel);
    $('[data-fee]').forEach((b) => b.addEventListener('click', () => collectFeeSheet(id, reload)));
    root.querySelector('[data-enroll]')?.addEventListener('click', () => enrollSheet(m, {}, reload));
    root.querySelector('[data-check]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      try {
        const r = await api('/api/admin/checkin', { method: 'POST', body: { memberId: id } });
        toast(r.action === 'in' ? `Checked in at ${time12(r.visit.in)}` : 'Checked out');
        reload();
      } catch (err) { toast(err.message, 'bad'); }
    }));
    root.querySelector('[data-edit]').addEventListener('click', () => sheet({
      title: 'Edit member',
      wide: true,
      html: `<form class="form-grid two" novalidate>${memberFields(m)}</form><div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>Save</button></div>`,
      onMount: (el, close) => {
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          try { await api(`/api/admin/members/${id}`, { method: 'PUT', body: formData(el.querySelector('form')) }); close(); toast('Saved'); reload(); } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    }));
    root.querySelector('[data-allreceipts]')?.addEventListener('click', (e) => { root.querySelectorAll('[data-old]').forEach((x) => { x.hidden = false; }); e.currentTarget.remove(); });
    $('[data-inst]').forEach((b) => b.addEventListener('click', () => installmentSheet(m, d.payments.find((p) => p.id === b.dataset.inst), reload)));
    $('[data-delpay]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Delete this receipt?', message: 'The membership dates and totals will be recalculated without it.', confirm: 'Delete', danger: true }))) return;
      await api(`/api/admin/payments/${b.dataset.delpay}`, { method: 'DELETE' }).catch((e) => toast(e.message, 'bad'));
      reload();
    }));
    root.querySelector('[data-measure]').addEventListener('click', () => measurementSheet(id, d.measurements[d.measurements.length - 1], reload));
    $('[data-delmeasure]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Delete measurement?', message: 'This entry will be removed.', confirm: 'Delete', danger: true }))) return;
      await api(`/api/admin/measurements/${b.dataset.delmeasure}`, { method: 'DELETE' });
      reload();
    }));
    root.querySelector('[data-freeze]').addEventListener('click', () => sheet({
      title: 'Freeze membership',
      html: `<form class="form-grid two" novalidate><label class="field"><span>From</span><input class="input" name="from" type="date" value="${today()}"></label><label class="field"><span>To</span><input class="input" name="to" type="date" value="${addDays(today(), 13)}"></label>
        <label class="field span"><span>Reason</span><input class="input" name="reason" maxlength="100" placeholder="Travel, illness, exams…"></label></form>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>${icon('snow')}Freeze</button></div>`,
      onMount: (el, close) => {
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          try { await api(`/api/admin/members/${id}/freeze`, { method: 'POST', body: formData(el.querySelector('form')) }); close(); toast('Membership frozen'); reload(); } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    }));
    $('[data-unfreeze]').forEach((b) => b.addEventListener('click', async () => {
      await api(`/api/admin/members/${id}/freeze/${b.dataset.unfreeze}`, { method: 'DELETE' });
      reload();
    }));
    root.querySelector('[data-pin]').addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Reset app PIN?', message: `${m.name} will be signed out of the member app and get a new PIN.`, confirm: 'Reset PIN' }))) return;
      const { pin } = await api(`/api/admin/members/${id}/pin`, { method: 'POST' });
      pinSheet(m, pin, false);
    });
    root.querySelector('[data-left]').addEventListener('click', async () => {
      if (!m.left && !(await confirmSheet({ title: `Mark ${m.name} as left?`, message: 'They move to the "Left" list and stop counting as a member. Their history is kept.', confirm: 'Mark as left' }))) return;
      await api(`/api/admin/members/${id}/left`, { method: 'POST', body: { left: !m.left } });
      reload();
    });
    root.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: `Delete ${m.name}?`, message: 'This removes the member with all their payments, attendance and measurements. It cannot be undone.', confirm: 'Delete forever', danger: true }))) return;
      await api(`/api/admin/members/${id}`, { method: 'DELETE' });
      toast('Member deleted');
      location.hash = '#/members';
    });
    memberPageCalBind(id, d, m);
    root.querySelector('[data-photo]').addEventListener('click', () => can('members.edit') && photoSheet(m, `/api/admin/members/${id}/photo`, reload));
    // Workout plan: trainers can see and set it; the member sees it in their app.
    const savePlan = async (plan) => { await api(`/api/admin/members/${id}/plan`, { method: 'PUT', body: plan }); reload(); };
    Workout.summary(m.workoutPlan).then((html) => {
      const box = root.querySelector('[data-plan]');
      if (!box) return;
      const log = m.workoutLog || {};
      const recent = Object.entries(log).filter(([, ids]) => ids.length).slice(-7);
      box.innerHTML = html
        ? `${html}<p class="muted" style="font-size:12.5px;margin-top:10px">${m.workoutPlan.updatedBy === 'trainer' ? 'Set by a trainer' : 'Set by the member'} on ${dateShort(m.workoutPlan.updatedAt.slice(0, 10))}${recent.length ? ` · last ticked a workout on ${dateShort(recent[recent.length - 1][0])}` : ''}</p>`
        : emptyLine('No plan yet. The member can make one in the app, or set one here.');
    }).catch(() => {});
    root.querySelector('[data-wpreset]').addEventListener('click', async () => { await Workout.library(); Workout.presetSheet(Boolean(m.workoutPlan && Object.keys(m.workoutPlan.days || {}).length), savePlan); });
    root.querySelector('[data-wday]').addEventListener('click', async () => {
      await Workout.library();
      sheet({
        title: 'Which day?',
        html: `<div class="more-grid">${Workout.ORDER.map((dk) => `<a href="#" data-pickday="${dk}">${icon('calendar')}${DAY_LABELS[dk]}</a>`).join('')}</div>`,
        onMount: (el, close) => el.querySelectorAll('[data-pickday]').forEach((a) => a.addEventListener('click', (e) => {
          e.preventDefault();
          close();
          setTimeout(() => Workout.editDaySheet(m.workoutPlan || { days: {} }, a.dataset.pickday, savePlan), 240);
        })),
      });
    });
  }

  function memberPageCalBind(id, d, m) {
    root.querySelectorAll('[data-cal]').forEach((b) => b.addEventListener('click', () => {
      history.replaceState(null, '', `#/member/${id}?cal=${b.dataset.cal}`);
      root.querySelector('[data-calendar]').outerHTML = calendar(d.attendance, b.dataset.cal, m.joinDate);
      memberPageCalBind(id, d, m);
    }));
  }

  function calendar(visits, month, joinDate) {
    const days = new Map(visits.filter((v) => v.date.startsWith(month)).map((v) => [v.date, v]));
    const first = `${month}-01`;
    const offset = (weekday(first) + 6) % 7;
    const count = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
    const t = today();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push('<div class="day blank"></div>');
    for (let i = 1; i <= count; i++) {
      const date = `${month}-${String(i).padStart(2, '0')}`;
      const v = days.get(date);
      const cls = [v ? 'came' : '', date === t ? 'today' : '', date > t || date < joinDate ? 'out' : ''].join(' ');
      cells.push(`<div class="day ${cls}" title="${v ? `${dateShort(date)}: ${time12(v.in)}${v.out ? ` – ${time12(v.out)}` : ''}` : dateShort(date)}">${i}</div>`);
    }
    const prev = shiftMonth(month, -1);
    const next = shiftMonth(month, 1);
    return `<div data-calendar><div class="cal-head"><button class="icon-btn" data-cal="${prev}" ${prev < joinDate.slice(0, 7) ? 'disabled' : ''} aria-label="Previous month">${icon('chevronLeft')}</button><b>${monthLabel(month, true)} · ${days.size} visit${days.size === 1 ? '' : 's'}</b><button class="icon-btn" data-cal="${next}" ${next > t.slice(0, 7) ? 'disabled' : ''} aria-label="Next month">${icon('chevronRight')}</button></div>
      <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="dow">${x}</div>`).join('')}${cells.join('')}</div></div>`;
  }

  function measurementsView(list) {
    if (!list.length) return emptyLine('No measurements yet. Track weight, body fat and sizes over time.');
    const first = list[0];
    const last = list[list.length - 1];
    const fields = [['weight', 'Weight', 'kg'], ['bodyFat', 'Body fat', '%'], ['waist', 'Waist', 'cm'], ['chest', 'Chest', 'cm'], ['arms', 'Arms', 'cm']];
    const delta = (k) => {
      if (first[k] == null || last[k] == null || list.length < 2) return '';
      const dlt = Math.round((last[k] - first[k]) * 10) / 10;
      return dlt ? `<span class="delta ${dlt < 0 ? 'down' : 'up'}">${dlt > 0 ? '+' : ''}${dlt}</span>` : '';
    };
    const weights = list.filter((x) => x.weight != null);
    const spark = weights.length > 1 ? sparkline(weights.map((x) => x.weight)) : '';
    return `<div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">${fields.filter(([k]) => last[k] != null).map(([k, l, u]) => `<div class="stat"><span>${l}</span><b>${last[k]}<small> ${u}</small>${delta(k)}</b></div>`).join('')}</div>
      ${spark ? `<div style="margin-top:14px"><span class="muted" style="font-size:12.5px;font-weight:700">Weight since ${dateShort(first.date)}</span>${spark}</div>` : ''}
      <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><tr><th>Date</th><th class="num">Weight</th><th class="num">Fat %</th><th class="num">Waist</th><th></th></tr>
      ${list.slice().reverse().slice(0, 8).map((x) => `<tr><td>${dateShort(x.date)}</td><td class="num">${x.weight ?? ''}</td><td class="num">${x.bodyFat ?? ''}</td><td class="num">${x.waist ?? ''}</td><td class="num"><button class="icon-btn" style="width:32px;height:32px" data-delmeasure="${esc(x.id)}" aria-label="Delete">${icon('x')}</button></td></tr>`).join('')}</table></div>`;
  }

  function sparkline(values) {
    const w = 300;
    const h = 60;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 6 - ((v - min) / span) * (h - 12)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:60px;display:block" role="img" aria-label="Weight from ${values[0]} to ${values[values.length - 1]} kg"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function measurementSheet(memberId, last = {}, after) {
    const f = (name, label, unit, step = '0.1') => `<label class="field"><span>${label} (${unit})</span><input class="input" name="${name}" type="number" step="${step}" min="0" value="${last[name] ?? ''}"></label>`;
    sheet({
      title: 'Add measurement',
      wide: true,
      html: `<form class="form-grid two" novalidate><label class="field"><span>Date</span><input class="input" name="date" type="date" value="${today()}" max="${today()}"></label>
        ${f('weight', 'Weight', 'kg')}${f('height', 'Height', 'cm', '1')}${f('bodyFat', 'Body fat', '%')}${f('chest', 'Chest', 'cm')}${f('waist', 'Waist', 'cm')}${f('arms', 'Arms', 'cm')}
        <label class="field span"><span>Note</span><input class="input" name="note" maxlength="200"></label></form>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>Save</button></div>`,
      onMount: (el, close) => {
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          try { await api('/api/admin/measurements', { method: 'POST', body: { ...formData(el.querySelector('form')), memberId } }); close(); toast('Saved'); after?.(); } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    });
  }

  // ---- monthly register ---------------------------------------------------------

  const REG_FILTERS = [['all', 'Everyone'], ['came', 'Came'], ['absent', "Didn't come"], ['paid', 'Fee paid'], ['unpaid', 'Fee not paid'], ['collected', 'Paid this period']];

  async function registerPage(params) {
    const t = today();
    const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') ? params.get('day') : null;
    const month = day ? null : (params.get('month') || monthOf(t));
    const filter = params.get('f') || 'all';
    const go = (over) => {
      const p = new URLSearchParams(day ? { day } : { month });
      if (filter !== 'all') p.set('f', filter);
      for (const [k, val] of Object.entries(over)) { if (val == null) p.delete(k); else p.set(k, val); }
      location.hash = `#/register?${p}`;
    };
    const label = day ? (day === t ? 'Today' : dateLong(day)) : monthLabel(month, true);
    shell('register', 'Register', label, `
      <div class="toolbar"><div class="seg" role="group"><button data-today aria-pressed="${day === t}">Today</button><button data-thismonth aria-pressed="${month === monthOf(t)}">This month</button></div></div>
      <div class="date-nav">
        <button class="icon-btn" data-prev aria-label="Previous">${icon('chevronLeft')}</button><span class="label">${esc(label)}</span><button class="icon-btn" data-next ${(day || `${month}-01`) >= (day ? t : `${monthOf(t)}-01`) ? 'disabled' : ''} aria-label="Next">${icon('chevronRight')}</button>
      </div>
      <div id="reg"><div class="kpis six">${'<div class="skel" style="height:96px;border-radius:22px"></div>'.repeat(6)}</div></div>`);
    root.querySelector('[data-today]').addEventListener('click', () => go({ day: t, month: null }));
    root.querySelector('[data-thismonth]').addEventListener('click', () => go({ month: monthOf(t), day: null }));
    root.querySelector('[data-prev]').addEventListener('click', () => (day ? go({ day: addDays(day, -1) }) : go({ month: shiftMonth(month, -1) })));
    root.querySelector('[data-next]').addEventListener('click', () => (day ? go({ day: addDays(day, 1) }) : go({ month: shiftMonth(month, 1) })));

    const r = await api(`/api/admin/register?${day ? `day=${day}` : `month=${month}`}`);
    const T = r.totals;
    const period = day ? 'today' : 'this month';
    const tile = (f, ic, title, val, sub, tone = '') => `<button class="card kpi link${filter === f ? ' picked' : ''}" data-f="${f}"><div class="k-head">${icon(ic)}${title}</div><div class="k-val tnum ${tone}">${val}</div><div class="k-sub">${sub}</div></button>`;
    const el = document.getElementById('reg');
    el.innerHTML = `
      <div class="kpis six">
        ${tile('all', 'users', 'Members', T.members, `${T.visits} visits in total`)}
        ${tile('came', 'login', 'Came', T.came, `${T.members ? Math.round((T.came / T.members) * 100) : 0}% of members`, 'good')}
        ${tile('absent', 'moon', "Didn't come", T.notCame, `not even once ${period}`, T.notCame ? 'warn' : '')}
        ${tile('paid', 'check', 'Fee paid', T.paid, `fee covers ${period}`, 'good')}
        ${tile('unpaid', 'alert', 'Fee not paid', T.notPaid, T.frozen ? `${T.frozen} frozen` : `no fee for ${period}`, T.notPaid ? 'bad' : '')}
        ${tile('collected', 'wallet', 'Collected', rs(T.collected), `from ${T.payers} member${T.payers === 1 ? '' : 's'}`)}
      </div>
      <div class="toolbar section-gap">
        <div class="chips-row" style="margin:0;flex:1" role="group" aria-label="Show">${REG_FILTERS.map(([id, l]) => `<button class="chip" data-f="${id}" aria-pressed="${filter === id}">${l}</button>`).join('')}</div>
      </div>
      <div class="toolbar"><div class="grow input-group">${icon('search')}<input class="input" type="search" placeholder="Search name, phone or member no." data-q aria-label="Search"></div><button class="btn btn-ghost btn-sm" data-csv style="min-height:50px">${icon('download')}CSV</button></div>
      <section class="card panel" id="reg-list"></section>`;
    el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => go({ f: b.dataset.f === 'all' ? null : b.dataset.f })));

    const pick = (row) => ({ all: true, came: row.visits > 0, absent: row.visits === 0, paid: row.paid, unpaid: !row.paid && !row.frozen, collected: row.receivedTotal > 0 })[filter] ?? true;
    const feeCell = (x) => (x.paid ? `<span class="badge badge-good">${icon('check')}Paid${x.paidTill ? ` · till ${dateShort(x.paidTill)}` : ''}</span>` : x.frozen ? `<span class="badge badge-info">${icon('snow')}Frozen</span>` : '<span class="badge badge-bad">Not paid</span>');
    const receivedCell = (x) => (x.received.length ? x.received.map((i) => `<b class="tnum">${rs(i.amount)}</b> <span class="muted">${dateShort(i.date)} · ${esc(i.method)}</span>`).join('<br>') : '<span class="muted">—</span>');
    const actions = (x) => {
      const m = { name: x.name, phone: x.phone };
      const s = { ...x, daysLeft: x.expiry ? Math.round((Date.parse(x.expiry) - Date.parse(t)) / 864e5) : null, daysSinceVisit: null };
      return `${!x.paid && !x.frozen ? `${waBtn(x.phone, s.expiry ? MSG.expired(m, s) : `Assalam o Alaikum ${x.name}! ${S.data.business.name} ki fee abhi tak jama nahi hui. Barah-e-karam jald jama karwa dein. Shukriya!`)}<button class="btn btn-primary btn-sm" data-collect="${esc(x.id)}">${icon('wallet')}<span class="hide-sm">Collect</span></button>` : x.visits === 0 ? waBtn(x.phone, `Assalam o Alaikum ${x.name}! ${day ? 'Aaj' : 'Is mahine'} aap gym nahi aaye. Sab khairiyat? Hum aap ka intezar kar rahe hain! 💪`) : ''}`;
    };
    const input = el.querySelector('[data-q]');
    const draw = () => {
      const term = input.value.trim().toLowerCase();
      const rows = r.rows.filter(pick).filter((x) => !term || x.name.toLowerCase().includes(term) || x.phone.includes(term) || String(x.memberNo).includes(term));
      const list = document.getElementById('reg-list');
      if (!rows.length) { list.innerHTML = `<div class="empty"><div class="empty-icon">${icon('list')}</div><h3>Nobody here</h3><p>${term ? 'Nothing matches your search.' : 'No member in this group.'}</p></div>`; return; }
      const collected = rows.reduce((a, x) => a + x.receivedTotal, 0);
      list.innerHTML = `<div class="panel-head"><h2>${rows.length} member${rows.length === 1 ? '' : 's'}${filter === 'collected' || collected ? ` · ${rs(collected)} received` : ''}</h2></div>
        <div class="reg-table tbl-wrap"><table class="tbl"><thead><tr><th>No.</th><th>Member</th><th>Plan</th><th>Fee ${day ? 'today' : 'this month'}</th><th>Paid ${day ? 'today' : 'in month'}</th><th class="num">Visits</th><th>Last visit</th><th></th></tr></thead><tbody>
        ${rows.map((x) => `<tr><td class="no">${x.memberNo}</td><td><a href="#/member/${esc(x.id)}"><b>${esc(x.name)}</b></a><br><span class="muted">${esc(x.phone)}</span></td><td>${esc(x.plan?.name || '—')}</td><td>${feeCell(x)}</td><td>${receivedCell(x)}</td>
          <td class="num"><b class="${x.visits ? '' : 'money-neg'}">${x.visits}</b></td><td>${x.lastVisit ? dateShort(x.lastVisit) : '<span class="muted">—</span>'}</td><td><div style="display:flex;gap:6px;justify-content:flex-end">${actions(x)}</div></td></tr>`).join('')}
        </tbody><tfoot><tr><td></td><td><b>Total</b></td><td></td><td><b>${rows.filter((x) => x.paid).length} paid</b></td><td><b class="tnum">${rs(collected)}</b></td><td class="num"><b>${rows.reduce((a, x) => a + x.visits, 0)}</b></td><td></td><td></td></tr></tfoot></table></div>
        <div class="reg-rows rows">${rows.map((x) => memberRow(x, {
          sub: `${x.visits ? `Came ${x.visits} day${x.visits === 1 ? '' : 's'}` : "Didn't come"}${x.receivedTotal ? ` · paid ${rs(x.receivedTotal)} on ${dateShort(x.received[x.received.length - 1].date)}` : ''}`,
          end: `${feeCell(x)}${actions(x)}`,
        })).join('')}</div>`;
      bindMemberRows(list);
      list.querySelectorAll('[data-collect]').forEach((b) => b.addEventListener('click', () => collectFeeSheet(b.dataset.collect, () => registerPage(params))));
    };
    input.addEventListener('input', draw);
    el.querySelector('[data-csv]').addEventListener('click', () => downloadCsv(`register-${day || month}.csv`,
      ['Member no', 'Name', 'Phone', 'Plan', 'Fee covers period', 'Paid till', 'Received in period', 'Payment dates', 'Visits', 'Last visit', 'Status', 'Balance due'],
      r.rows.filter(pick).map((x) => [x.memberNo, x.name, x.phone, x.plan?.name || '', x.paid ? 'Yes' : x.frozen ? 'Frozen' : 'No', x.paidTill || '', x.receivedTotal, x.received.map((i) => `${i.date} ${i.amount} ${i.method}`).join('; '), x.visits, x.lastVisit || '', x.status, x.balance])));
    draw();
  }

  // ---- fees -------------------------------------------------------------------

  async function feesPage(params) {
    const tab = params.get('tab') || 'collected';
    const range = params.get('range') || 'month';
    const tabs = [['collected', 'Collected'], ['dues', 'Dues'], ['expiring', 'Expiring'], ['expired', 'Expired'], ['unpaid', 'Never paid']];
    shell('fees', 'Fees', '', `<div class="toolbar"><div class="seg" role="group">${tabs.map(([id, l]) => `<button data-t="${id}" aria-pressed="${tab === id}">${l}</button>`).join('')}</div></div><div id="fees"><div class="skel" style="height:300px;border-radius:22px"></div></div>`,
      { fab: { label: 'Collect fee', icon: 'wallet', need: 'fees.collect', onClick: () => pickMember('Collect fee from…', (id) => collectFeeSheet(id, () => feesPage(params))) } });
    root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/fees?tab=${b.dataset.t}`; }));
    const el = document.getElementById('fees');
    if (tab === 'collected') {
      const t = today();
      const ranges = { today: [t, t, 'Today'], week: [addDays(t, -6), t, 'Last 7 days'], month: [`${monthOf(t)}-01`, t, 'This month'], last: [`${shiftMonth(monthOf(t), -1)}-01`, addDays(`${monthOf(t)}-01`, -1), 'Last month'] };
      const [from, to] = ranges[range] || ranges.month;
      const list = await api(`/api/admin/payments?from=${from}&to=${to}`);
      // Money received in the range, counted per instalment.
      const received = [];
      const all = await api(`/api/admin/payments?to=${to}`);
      for (const p of all) for (const i of p.installments) if (i.date >= from && i.date <= to) received.push({ ...i, p });
      const total = received.reduce((a, i) => a + i.amount, 0);
      const byMethod = {};
      for (const i of received) byMethod[i.method] = (byMethod[i.method] || 0) + i.amount;
      el.innerHTML = `<div class="toolbar"><div class="seg" role="group">${Object.entries(ranges).map(([id, [, , l]]) => `<button data-r="${id}" aria-pressed="${range === id}">${l}</button>`).join('')}</div><span class="grow"></span>
        <button class="btn btn-ghost btn-sm" data-csv>${icon('download')}CSV</button></div>
        <div class="kpis"><div class="card kpi"><div class="k-head">${icon('wallet')}Received</div><div class="k-val tnum">${rs(total)}</div><div class="k-sub">${received.length} payments</div></div>
        ${Object.entries(byMethod).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `<div class="card kpi"><div class="k-head">${esc(k)}</div><div class="k-val tnum">${rs(v)}</div></div>`).join('')}</div>
        <section class="card panel section-gap"><div class="panel-head"><h2>Receipts issued</h2><span class="muted" style="font-size:13px">${list.length}</span></div>
        ${list.length ? `<div class="rows">${list.map((p) => memberRow({ ...p.member, id: p.memberId }, { sub: `#${p.receiptNo} · ${esc(p.planName)} · ${dateShort(p.date)} · ${p.installments.map((i) => esc(i.method)).join(', ')}`, end: `<b class="tnum">${rs(p.paid)}</b>${p.total - p.paid > 0 ? `<span class="badge badge-bad">Due ${rs(p.total - p.paid)}</span>` : ''}` })).join('')}</div>` : emptyLine('No receipts in this period.')}</section>`;
      el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/fees?tab=collected&range=${b.dataset.r}`; }));
      el.querySelector('[data-csv]').addEventListener('click', () => downloadCsv(`fees-${from}-to-${to}.csv`, ['Date', 'Receipt', 'Member no', 'Name', 'Phone', 'Plan', 'Period start', 'Period end', 'Amount', 'Method'],
        received.map((i) => [i.date, i.p.receiptNo, i.p.member?.memberNo, i.p.member?.name, i.p.member?.phone, i.p.planName, i.p.periodStart, i.p.periodEnd, i.amount, i.method])));
      bindMemberRows(el);
      return;
    }
    const status = { dues: 'dues', expiring: 'expiring', expired: 'expired', unpaid: 'unpaid' }[tab];
    const list = await api(`/api/admin/members?status=${status}&sort=expiry`);
    const items = tab === 'expired' ? list.slice().reverse() : tab === 'dues' ? list.slice().sort((a, b) => b.balance - a.balance) : list;
    const total = items.reduce((a, m) => a + (tab === 'dues' ? m.balance : 0), 0);
    const msg = (m) => (tab === 'dues' ? MSG.dues : tab === 'expiring' ? MSG.expiring : MSG.expired)(m, m);
    el.innerHTML = `<section class="card panel"><div class="panel-head"><h2>${items.length} member${items.length === 1 ? '' : 's'}${tab === 'dues' ? ` · ${rs(total)} pending` : ''}</h2></div>
      ${items.length ? `<div class="rows">${items.map((m) => memberRow(m, {
        sub: `${m.plan ? esc(m.plan.name) : 'No plan'} · ${m.expiry ? `${m.status === 'expired' ? 'ended' : 'ends'} ${dateShort(m.expiry)}` : `joined ${dateShort(m.joinDate)}`} · ${esc(m.phone)}`,
        end: `${tab === 'dues' ? `<b class="tnum money-neg">${rs(m.balance)}</b>` : statusBadge(m)}${tab !== 'unpaid' ? waBtn(m.phone, msg(m)) : ''}<button class="btn btn-primary btn-sm" data-collect="${esc(m.id)}">${icon('wallet')}<span class="hide-sm">Collect</span></button>`,
      })).join('')}</div>` : `<div class="empty"><div class="empty-icon">${icon('check')}</div><h3>All clear</h3><p>Nobody in this list.</p></div>`}</section>`;
    bindMemberRows(el);
    el.querySelectorAll('[data-collect]').forEach((b) => b.addEventListener('click', () => {
      const m = items.find((x) => x.id === b.dataset.collect);
      if (tab === 'dues') location.hash = `#/member/${m.id}`;
      else collectFeeSheet(m.id, () => feesPage(params));
    }));
  }

  // ---- attendance -----------------------------------------------------------------

  async function attendancePage(params) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : today();
    shell('attendance', 'Attendance', dateLong(date), `
      <div class="date-nav"><button class="icon-btn" data-go="${addDays(date, -1)}" aria-label="Previous day">${icon('chevronLeft')}</button><button class="btn btn-ghost btn-sm" data-go="${today()}">Today</button>
        <button class="icon-btn" data-go="${addDays(date, 1)}" ${date >= today() ? 'disabled' : ''} aria-label="Next day">${icon('chevronRight')}</button><span class="label">${date === today() ? 'Today' : dayName(date)}</span>
        <input class="input" type="date" value="${date}" max="${today()}" data-jump aria-label="Pick date"></div>
      <div id="att"><div class="skel" style="height:300px;border-radius:22px"></div></div>`);
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/attendance?date=${b.dataset.go}`; }));
    root.querySelector('[data-jump]').addEventListener('change', (e) => { if (e.target.value) location.hash = `#/attendance?date=${e.target.value}`; });
    const r = await api(`/api/admin/attendance?date=${date}`);
    const closed = r.list.filter((a) => a.out);
    const avg = closed.length ? Math.round(closed.reduce((s, a) => s + toMin(a.out) - toMin(a.in), 0) / closed.length) : null;
    const unique = new Set(r.list.map((a) => a.memberId)).size;
    const hours = r.hours.filter((h) => h.hour >= 5 && h.hour <= 23);
    document.getElementById('att').innerHTML = `
      <div class="kpis"><div class="card kpi"><div class="k-head">${icon('login')}Check-ins</div><div class="k-val tnum">${r.list.length}</div><div class="k-sub">${unique} members</div></div>
        <div class="card kpi"><div class="k-head">${icon('users')}Still inside</div><div class="k-val tnum">${r.list.filter((a) => !a.out).length}</div></div>
        <div class="card kpi"><div class="k-head">${icon('clock')}Avg. workout</div><div class="k-val tnum">${fmtMinutes(avg)}</div></div>
        <div class="card kpi"><div class="k-head">${icon('chart')}Busiest hour</div><div class="k-val tnum">${r.list.length ? time12(`${String(hours.reduce((a, b) => (b.count > a.count ? b : a)).hour).padStart(2, '0')}:00`) : '—'}</div></div></div>
      <section class="card panel section-gap"><div class="panel-head"><h2>Check-ins by hour</h2></div>${barChart(hours.map((h) => ({ ...h, short: h.hour % 3 === 0 ? time12(`${String(h.hour).padStart(2, '0')}:00`).replace(':00', '').replace(' ', '') : '' })), [{ key: 'count', label: 'Check-ins', color: 'var(--accent)' }], { label: (x) => time12(`${String(x.hour).padStart(2, '0')}:00`), height: 140 })}</section>
      <section class="card panel section-gap"><div class="panel-head"><h2>Log</h2><button class="btn btn-ghost btn-sm" data-csv>${icon('download')}CSV</button></div>
        ${r.list.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Member</th><th>In</th><th>Out</th><th class="num">Time</th><th></th></tr>${r.list.map((a) => `<tr><td><a href="#/member/${esc(a.memberId)}"><b>${esc(a.member?.name || 'Deleted member')}</b> <span class="no">#${a.member?.memberNo ?? ''}</span></a>${a.source ? ` ${icon('fingerprint', 'src-ico')}` : ''}</td><td>${time12(a.in)}</td><td>${a.out ? time12(a.out) : '<span class="badge badge-accent">Inside</span>'}</td><td class="num">${a.out ? fmtMinutes(toMin(a.out) - toMin(a.in)) : ''}</td><td class="num"><button class="icon-btn" style="width:34px;height:34px" data-fix="${esc(a.id)}" aria-label="Edit times">${icon('edit')}</button></td></tr>`).join('')}</table></div>` : emptyLine('No check-ins on this day.')}
      </section>`;
    root.querySelector('[data-csv]').addEventListener('click', () => downloadCsv(`attendance-${date}.csv`, ['Date', 'Member no', 'Name', 'In', 'Out', 'Minutes'], r.list.map((a) => [a.date, a.member?.memberNo, a.member?.name, a.in, a.out || '', a.out ? toMin(a.out) - toMin(a.in) : ''])));
    root.querySelectorAll('[data-fix]').forEach((b) => b.addEventListener('click', () => {
      const a = r.list.find((x) => x.id === b.dataset.fix);
      sheet({
        title: `Fix times · ${a.member?.name || ''}`,
        html: `<form class="form-grid two" novalidate><label class="field"><span>Check-in</span><input class="input" name="in" type="time" value="${a.in}"></label><label class="field"><span>Check-out</span><input class="input" name="out" type="time" value="${a.out || ''}"></label></form>
          <div class="sheet-actions"><button class="btn btn-danger" data-del>${icon('trash')}Delete</button><button class="btn btn-primary" data-ok>Save</button></div>`,
        onMount: (el, close) => {
          el.querySelector('[data-ok]').addEventListener('click', async () => {
            try { await api(`/api/admin/attendance/${a.id}`, { method: 'PATCH', body: formData(el.querySelector('form')) }); close(); attendancePage(params); } catch (e) { toast(e.message, 'bad'); }
          });
          el.querySelector('[data-del]').addEventListener('click', async () => { await api(`/api/admin/attendance/${a.id}`, { method: 'DELETE' }); close(); attendancePage(params); });
        },
      });
    }));
  }

  // ---- classes --------------------------------------------------------------------

  async function classesPage(params) {
    const tab = params.get('tab') || 'day';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : today();
    shell('classes', 'Classes', tab === 'day' ? dateLong(date) : 'Weekly timetable', `<div class="toolbar"><div class="seg" role="group"><button data-t="day" aria-pressed="${tab === 'day'}">Bookings</button><button data-t="week" aria-pressed="${tab === 'week'}">Timetable</button></div><span class="grow"></span>
      ${tab === 'week' && can('settings') ? `<button class="btn btn-primary btn-sm" data-addclass>${icon('plus')}Add class</button>` : ''}</div><div id="cls"></div>`);
    root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/classes?tab=${b.dataset.t}`; }));
    const el = document.getElementById('cls');
    if (tab === 'week') {
      el.innerHTML = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
        const items = S.data.classes.filter((c) => c.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
        return items.length ? `<div class="day-head">${DAY_LABELS[DAYS[wd]]}</div><div class="item-list">${items.map((c) => `<div class="card item${c.active === false ? ' inactive' : ''}"><div class="ic-tile">${icon('flame')}</div><div class="tx"><b>${esc(c.name)}</b><span>${time12(c.start)} · ${c.duration} min · ${c.capacity} spots · ${esc(staffById(c.staffId)?.name || 'No coach')}</span></div>
          ${can('settings') ? `<div class="acts"><button class="icon-btn" data-edit="${esc(c.id)}" aria-label="Edit">${icon('edit')}</button></div>` : ''}</div>`).join('')}</div>` : '';
      }).join('') || emptyLine('No classes yet.');
      root.querySelector('[data-addclass]')?.addEventListener('click', () => editClass());
      el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editClass(S.data.classes.find((c) => c.id === b.dataset.edit))));
      return;
    }
    el.innerHTML = `<div class="date-nav"><button class="icon-btn" data-go="${addDays(date, -1)}" aria-label="Previous day">${icon('chevronLeft')}</button><button class="btn btn-ghost btn-sm" data-go="${today()}">Today</button><button class="icon-btn" data-go="${addDays(date, 1)}" aria-label="Next day">${icon('chevronRight')}</button><span class="label">${date === today() ? 'Today' : dayName(date)}</span></div><div id="cls-day"></div>`;
    el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/classes?date=${b.dataset.go}`; }));
    const list = await api(`/api/admin/class-day?date=${date}`);
    const box = document.getElementById('cls-day');
    box.innerHTML = list.length ? `<div class="grid-2" style="margin-top:0">${list.map((c) => panel(`${esc(c.name)} <span class="muted" style="font-weight:600">· ${time12(c.start)}</span>`, `<p class="muted" style="font-size:13.5px;margin-bottom:10px">${esc(staffById(c.staffId)?.name || '')} · ${c.booked}/${c.capacity} booked</p>
      <div class="rows">${c.attendees.map((a) => memberRow(a, { end: `<button class="icon-btn" data-cancel="${esc(a.bookingId)}" aria-label="Remove">${icon('x')}</button>` })).join('') || emptyLine('No bookings yet.')}</div>`,
      c.spotsLeft && date >= today() ? `<button class="btn btn-soft btn-sm" data-add="${esc(c.id)}">${icon('plus')}Add</button>` : '')).join('')}</div>` : `<div class="card empty"><div class="empty-icon">${icon('calendar')}</div><h3>No classes</h3><p>Nothing scheduled on this day.</p></div>`;
    bindMemberRows(box);
    box.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => pickMember('Add to class', async (memberId) => {
      try { await api(`/api/admin/members/${memberId}/classes`, { method: 'POST', body: { classId: b.dataset.add, date } }); toast('Added to class'); classesPage(params); } catch (e) { toast(e.message, 'bad'); }
    })));
    box.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
      await api(`/api/admin/class-bookings/${b.dataset.cancel}/cancel`, { method: 'POST' });
      classesPage(params);
    }));
  }

  function editClass(item) {
    const isNew = !item;
    item = item || {};
    crudSheet('classes', item, isNew ? 'Add class' : 'Edit class', `
      <label class="field span"><span>Class name</span><input class="input" name="name" value="${esc(item.name || '')}" maxlength="60"></label>
      <label class="field"><span>Day</span><select class="select" name="weekday">${[1, 2, 3, 4, 5, 6, 0].map((wd) => `<option value="${wd}" ${wd === item.weekday ? 'selected' : ''}>${DAY_LABELS[DAYS[wd]]}</option>`).join('')}</select></label>
      <label class="field"><span>Start time</span><input class="input" name="start" type="time" value="${esc(item.start || '18:00')}"></label>
      <label class="field"><span>Duration (min)</span><input class="input" name="duration" type="number" min="10" max="300" step="5" value="${item.duration || 60}"></label>
      <label class="field"><span>Capacity</span><input class="input" name="capacity" type="number" min="1" max="500" value="${item.capacity || 12}"></label>
      <label class="field"><span>Coach</span><select class="select" name="staffId">${S.data.staff.map((m) => `<option value="${esc(m.id)}" ${m.id === item.staffId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Level</span><input class="input" name="level" value="${esc(item.level || 'All levels')}" maxlength="40"></label>
      <label class="toggle-row span"><span>Active</span><span class="switch"><input type="checkbox" name="active" ${item.active !== false ? 'checked' : ''}><span></span></span></label>`, () => route());
  }

  // Generic add/edit/delete sheet for plans, staff, classes and expenses.
  function crudSheet(collection, item, title, fields, after) {
    const isNew = !item.id;
    sheet({
      title,
      wide: true,
      html: `<form class="form-grid two" novalidate>${fields}</form>
        <div class="sheet-actions">${isNew ? '<button class="btn btn-ghost" data-close>Cancel</button>' : `<button class="btn btn-danger" data-del>${icon('trash')}Delete</button>`}<button class="btn btn-primary" data-ok>${isNew ? 'Add' : 'Save'}</button></div>`,
      onMount: (el, close) => {
        const f = el.querySelector('form');
        const collect = () => {
          const body = formData(f);
          for (const box of f.querySelectorAll('input[type=checkbox]')) body[box.name] = box.checked;
          return body;
        };
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          try {
            await api(`/api/admin/${collection}${isNew ? '' : `/${item.id}`}`, { method: isNew ? 'POST' : 'PUT', body: collect() });
            await refreshData();
            close();
            toast('Saved');
            after?.();
          } catch (e) { toast(e.message, 'bad'); }
        }));
        el.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (!(await confirmSheet({ title: 'Delete?', message: `${item.name || 'This entry'} will be removed.`, confirm: 'Delete', danger: true }))) return;
          try { await api(`/api/admin/${collection}/${item.id}`, { method: 'DELETE' }); await refreshData(); close(); after?.(); } catch (e) { toast(e.message, 'bad'); }
        });
      },
    });
  }

  // ---- expenses -------------------------------------------------------------------

  async function expensesPage(params) {
    const month = params.get('month') || monthOf(today());
    shell('expenses', 'Expenses', monthLabel(month, true), `<div class="date-nav"><button class="icon-btn" data-m="${shiftMonth(month, -1)}" aria-label="Previous month">${icon('chevronLeft')}</button><span class="label">${monthLabel(month, true)}</span><button class="icon-btn" data-m="${shiftMonth(month, 1)}" ${month >= monthOf(today()) ? 'disabled' : ''} aria-label="Next month">${icon('chevronRight')}</button><button class="btn btn-ghost btn-sm" data-cats>${icon('tag')}Categories</button></div><div id="exp"></div>`,
      { fab: { label: 'Add expense', onClick: () => editExpense({ date: today() }) } });
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/expenses?month=${b.dataset.m}`; }));
    root.querySelector('[data-cats]').addEventListener('click', categoriesSheet);
    const list = await api(`/api/admin/expenses?month=${month}`);
    const total = list.reduce((a, e) => a + e.amount, 0);
    const byCat = {};
    for (const e of list) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    document.getElementById('exp').innerHTML = `<div class="grid-2" style="margin-top:0">
      ${panel(`Total · ${rs(total)}`, hBars(Object.entries(byCat).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)))}
      ${panel(`${list.length} entries`, list.length ? `<div class="rows">${list.map((e) => `<button class="m-row" data-exp="${esc(e.id)}"><span class="ic-tile">${icon('receipt')}</span><span class="tx"><b>${esc(e.category)}</b><span>${dateShort(e.date)} · ${esc(e.method)}${e.note ? ` · ${esc(e.note)}` : ''}</span></span><span class="end"><b class="tnum">${rs(e.amount)}</b></span></button>`).join('')}</div>` : emptyLine('No expenses this month.'))}</div>`;
    root.querySelectorAll('[data-exp]').forEach((b) => b.addEventListener('click', () => editExpense(list.find((e) => e.id === b.dataset.exp))));
  }

  function editExpense(item) {
    crudSheet('expenses', item, item.id ? 'Edit expense' : 'Add expense', `
      <label class="field"><span>Category</span><select class="select" name="category">${S.data.expenseCategories.map((c) => `<option ${c === item.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="field"><span>Amount</span><input class="input" name="amount" type="number" min="1" step="100" value="${item.amount ?? ''}"></label>
      <label class="field"><span>Date</span><input class="input" name="date" type="date" value="${esc(item.date || today())}"></label>
      <label class="field"><span>Paid by</span><select class="select" name="method">${S.data.methods.map((x) => `<option ${x === item.method ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <label class="field span"><span>Note</span><input class="input" name="note" value="${esc(item.note || '')}" maxlength="200" placeholder="e.g. Treadmill repair"></label>`, () => route());
  }

  function categoriesSheet() {
    sheet({
      title: 'Expense categories',
      html: `<label class="field"><span>One per line</span><textarea class="textarea" style="min-height:220px" data-cats>${esc(S.data.expenseCategories.join('\n'))}</textarea></label>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>Save</button></div>`,
      onMount: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        try {
          await api('/api/admin/expense-categories', { method: 'PUT', body: { categories: el.querySelector('[data-cats]').value.split('\n') } });
          await refreshData();
          close();
          toast('Saved');
        } catch (e) { toast(e.message, 'bad'); }
      }),
    });
  }

  // ---- reports --------------------------------------------------------------------

  async function reportsPage(params) {
    const month = params.get('month') || monthOf(today());
    shell('reports', 'Reports', monthLabel(month, true), `<div class="date-nav"><button class="icon-btn" data-m="${shiftMonth(month, -1)}" aria-label="Previous month">${icon('chevronLeft')}</button><span class="label">${monthLabel(month, true)}</span><button class="icon-btn" data-m="${shiftMonth(month, 1)}" ${month >= monthOf(today()) ? 'disabled' : ''} aria-label="Next month">${icon('chevronRight')}</button></div><div id="rep"><div class="skel" style="height:300px;border-radius:22px"></div></div>`);
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/reports?month=${b.dataset.m}`; }));
    const r = await api(`/api/admin/report?month=${month}`);
    const profit = r.revenue - r.expenses;
    document.getElementById('rep').innerHTML = `
      <div class="kpis"><div class="card kpi"><div class="k-head">${icon('wallet')}Fees collected</div><div class="k-val tnum">${rs(r.revenue)}</div><div class="k-sub">${r.payments} receipts</div></div>
        <div class="card kpi"><div class="k-head">${icon('receipt')}Expenses</div><div class="k-val tnum">${rs(r.expenses)}</div></div>
        <div class="card kpi"><div class="k-head">${icon('trending')}Profit</div><div class="k-val tnum ${profit >= 0 ? 'good' : 'bad'}">${rs(profit)}</div></div>
        <div class="card kpi"><div class="k-head">${icon('userPlus')}New members</div><div class="k-val tnum">${r.newMembers}</div><div class="k-sub">${r.renewals} renewals</div></div></div>
      <div class="kpis section-gap"><div class="card kpi"><div class="k-head">${icon('login')}Visits</div><div class="k-val tnum">${r.visits}</div><div class="k-sub">${r.visitors} different members</div></div>
        <div class="card kpi"><div class="k-head">${icon('alert')}Lapsed</div><div class="k-val tnum ${r.lapsed.length ? 'bad' : ''}">${r.lapsed.length}</div><div class="k-sub">expired, not renewed</div></div>
        <div class="card kpi"><div class="k-head">${icon('tag')}Admission fees</div><div class="k-val tnum">${rs(r.admissionFees)}</div></div>
        <div class="card kpi"><div class="k-head">${icon('gift')}Discounts given</div><div class="k-val tnum">${rs(r.discounts)}</div></div></div>
      <section class="card panel section-gap"><div class="panel-head"><h2>Daily collection</h2></div>${barChart(r.daily.map((d) => ({ ...d, short: Number(d.date.slice(8)) % 5 === 1 ? String(Number(d.date.slice(8))) : '' })), [{ key: 'revenue', label: 'Collected', color: 'var(--accent)' }], { label: (d) => dateShort(d.date), format: rs, height: 150 })}</section>
      <div class="grid-3">
        ${panel('By payment method', hBars(r.byMethod))}
        ${panel('By plan', hBars(r.byPlan))}
        ${panel('Expenses by category', hBars(r.byCategory))}
      </div>
      <section class="card panel section-gap"><div class="panel-head"><h2>Lapsed members</h2><span class="muted" style="font-size:13px">Their fee ended this month and they haven't renewed</span></div>
        ${r.lapsed.length ? `<div class="rows">${r.lapsed.map((m) => memberRow(m, { end: waBtn(m.phone, `Assalam o Alaikum ${m.name}! Aap ki ${S.data.business.name} membership khatam ho gayi hai. Renew karwa kar dobara shuru karein, hum aap ka intezar kar rahe hain! 💪`) })).join('')}</div>` : emptyLine('Nobody lapsed this month.')}</section>
      <section class="card panel section-gap"><div class="panel-head"><h2>Downloads</h2></div><div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-dl="daily">${icon('download')}Daily totals (CSV)</button>
        <a class="btn btn-ghost btn-sm" href="#/members">${icon('users')}Members list → CSV</a>
        <a class="btn btn-ghost btn-sm" href="#/fees?tab=collected&range=month">${icon('wallet')}Fees → CSV</a></div></section>`;
    bindMemberRows();
    root.querySelector('[data-dl]').addEventListener('click', () => downloadCsv(`daily-${month}.csv`, ['Date', 'Collected', 'Visits'], r.daily.map((d) => [d.date, d.revenue, d.visits])));
  }

  // ---- enquiries --------------------------------------------------------------------

  async function leadsPage() {
    shell('leads', 'Enquiries', 'People who asked about joining', '<div id="leads"></div>', { fab: { label: 'Add enquiry', onClick: () => editLead({}) } });
    const list = await api('/api/admin/leads');
    const tone = { new: 'badge-accent', contacted: 'badge-warn', joined: 'badge-good', lost: 'badge-muted' };
    document.getElementById('leads').innerHTML = list.length ? `<div class="card panel"><div class="rows">${list.map((l) => `<div class="m-row" style="cursor:default">${avatar(l)}<span class="tx"><b>${esc(l.name)}</b><span>${esc(l.phone)}${l.interest ? ` · ${esc(l.interest)}` : ''}${l.message ? ` · “${esc(l.message)}”` : ''} · ${dateShort(l.createdAt.slice(0, 10))}</span></span>
      <span class="end"><span class="badge ${tone[l.status]}">${esc(l.status)}</span>${waBtn(l.phone, `Assalam o Alaikum ${l.name}! ${S.data.business.name} se baat kar rahe hain. Aap ne membership ke bare mein poocha tha. Kab visit karna chahenge?`)}<button class="btn btn-ghost btn-sm" data-lead="${esc(l.id)}">${icon('edit')}</button>${l.status !== 'joined' ? `<button class="btn btn-primary btn-sm" data-join="${esc(l.id)}">${icon('userPlus')}Join</button>` : ''}</span></div>`).join('')}</div></div>`
      : `<div class="card empty"><div class="empty-icon">${icon('inbox')}</div><h3>No enquiries yet</h3><p>When someone fills the "Join" form in the member app, they appear here.</p></div>`;
    root.querySelectorAll('[data-lead]').forEach((b) => b.addEventListener('click', () => editLead(list.find((l) => l.id === b.dataset.lead))));
    root.querySelectorAll('[data-join]').forEach((b) => b.addEventListener('click', () => {
      const l = list.find((x) => x.id === b.dataset.join);
      addMemberSheet({ name: l.name, phone: l.phone, leadId: l.id });
    }));
  }

  function editLead(item) {
    crudSheet('leads', item, item.id ? 'Edit enquiry' : 'Add enquiry', `
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(item.name || '')}"></label>
      <label class="field"><span>Phone</span><input class="input" name="phone" type="tel" value="${esc(item.phone || '')}"></label>
      <label class="field"><span>Interested in</span><select class="select" name="interest"><option value="">—</option>${S.data.plans.map((p) => `<option ${p.name === item.interest ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Status</span><select class="select" name="status">${['new', 'contacted', 'joined', 'lost'].map((x) => `<option ${x === (item.status || 'new') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="field span"><span>Message / notes</span><textarea class="textarea" name="message">${esc(item.message || '')}</textarea></label>`, () => route());
  }

  // ---- settings -------------------------------------------------------------------

  function settingsPage() {
    const b = S.data.business;
    const range = (d, i, r) => `<div class="range" data-range><input class="input" type="time" value="${r[0]}" aria-label="${DAY_LABELS[d]} opens"><span class="muted">to</span><input class="input" type="time" value="${r[1]}" aria-label="${DAY_LABELS[d]} closes">${i > 0 ? `<button type="button" class="icon-btn" data-rm aria-label="Remove break">${icon('x')}</button>` : ''}</div>`;
    const hoursRow = (d) => {
      const h = b.hours[d] || [];
      return `<div class="hours-row" data-day="${d}"><b>${DAY_LABELS[d]}</b><span class="switch"><input type="checkbox" data-open ${h.length ? 'checked' : ''} aria-label="Open on ${DAY_LABELS[d]}"><span></span></span>
        <div class="ranges">${h.length ? h.map((r, i) => range(d, i, r)).join('') + (h.length < 3 ? '<button type="button" class="link" data-addrange style="justify-self:start">+ Add a break</button>' : '') : '<span class="closed">Closed</span>'}</div></div>`;
    };
    shell('settings', 'Settings', '', `
      ${can('settings') ? `<form id="settings" novalidate>
      <section class="card form-section"><h2>Gym</h2><p>Shown in the member app and on receipts.</p>
        <div class="form-grid two">
          <label class="field"><span>Gym name</span><input class="input" name="name" value="${esc(b.name)}" maxlength="60" required></label>
          <label class="field"><span>Tagline</span><input class="input" name="tagline" value="${esc(b.tagline)}" maxlength="120"></label>
          <div class="field span"><span>Brand colour</span><div class="swatches">${PRESETS.map((c) => `<button type="button" class="swatch" style="--c:${c}" data-swatch="${c}" aria-label="${c}" aria-pressed="${c === b.accent}"></button>`).join('')}<input type="color" name="accent" value="${esc(b.accent)}" aria-label="Custom colour"></div></div>
          <label class="field"><span>Phone</span><input class="input" name="phone" value="${esc(b.phone)}" type="tel"></label>
          <label class="field"><span>WhatsApp number</span><input class="input" name="whatsapp" value="${esc(b.whatsapp)}" inputmode="numeric" placeholder="923001234567"></label>
          <label class="field"><span>Email</span><input class="input" name="email" value="${esc(b.email)}" type="email"></label>
          <label class="field"><span>Instagram</span><input class="input" name="instagram" value="${esc(b.instagram)}"></label>
          <label class="field span"><span>Address</span><input class="input" name="address" value="${esc(b.address)}"></label>
          <label class="field span"><span>Google Maps link</span><input class="input" name="mapUrl" value="${esc(b.mapUrl)}" placeholder="https://maps.google.com/..."></label>
        </div></section>

      <section class="card form-section"><h2>Fees & rules</h2><p>How memberships, reminders and the front desk behave.</p>
        <div class="form-grid two">
          <label class="field"><span>Admission fee (new members)</span><input class="input" name="admissionFee" type="number" min="0" step="100" value="${b.admissionFee}"></label>
          <label class="field"><span>Warn before expiry (days)</span><input class="input" name="expiringDays" type="number" min="1" max="60" value="${b.expiringDays}"></label>
          <label class="field"><span>"Not coming" after (days absent)</span><input class="input" name="inactiveDays" type="number" min="3" max="90" value="${b.inactiveDays}"></label>
          <label class="field"><span>Class booking window (days)</span><input class="input" name="bookingWindowDays" type="number" min="1" max="60" value="${b.bookingWindowDays}"></label>
          <label class="field"><span>Currency symbol</span><input class="input" name="currencySymbol" value="${esc(b.currencySymbol)}" maxlength="4"></label>
          <label class="field"><span>Time zone</span><input class="input" name="timeZone" value="${esc(b.timeZone)}"></label>
          <label class="field span"><span>Ways members pay (comma between)</span><input class="input" name="paymentMethods" value="${esc((b.paymentMethods || S.data.methods || []).join(', '))}" placeholder="Cash, Card, Bank transfer"></label>
          <label class="field"><span>WhatsApp reminder language</span><select class="input" name="messageLang"><option value="en" ${b.messageLang === 'en' ? 'selected' : ''}>English</option><option value="ur" ${b.messageLang !== 'en' ? 'selected' : ''}>Roman Urdu</option></select></label>
          <label class="toggle-row span"><span>Stop expired or unpaid members at check-in</span><span class="switch"><input type="checkbox" name="blockExpiredCheckin" ${b.blockExpiredCheckin ? 'checked' : ''}><span></span></span></label>
        </div></section>

      <section class="card form-section"><h2>Opening hours</h2><p>Shown in the member app.</p><div id="hours">${ORDER.map(hoursRow).join('')}</div></section>
      <input type="hidden" name="currency" value="${esc(b.currency)}"><input type="hidden" name="locale" value="${esc(b.locale)}">
      <div class="save-bar"><button class="btn btn-primary" type="submit">${icon('check')}Save settings</button></div>
      </form>

      <section class="card form-section" id="wa"><div class="skel" style="height:120px"></div></section>
      <section class="card form-section" id="exvid"><div class="skel" style="height:120px"></div></section>

      <section class="card form-section"><div class="panel-head"><div><h2>Membership plans</h2><p class="muted" style="font-size:13.5px">Monthly, quarterly, half-yearly, annual or anything you like.</p></div><button class="btn btn-primary btn-sm" data-addplan>${icon('plus')}Add plan</button></div>
        <div class="item-list">${S.data.plans.map((p) => `<div class="card item${p.active === false ? ' inactive' : ''}"><div class="ic-tile">${icon('star')}</div><div class="tx"><b>${esc(p.name)}${p.highlight ? ' <span class="badge badge-accent">Highlighted</span>' : ''}${p.active === false ? ' <span class="badge badge-muted">Hidden</span>' : ''}</b><span>${p.months} month${p.months > 1 ? 's' : ''} · ${rs(p.price)} · ${rs(Math.round(p.price / p.months))}/month</span></div><div class="acts"><button class="icon-btn" data-plan="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">${icon('edit')}</button></div></div>`).join('')}</div></section>

      <section class="card form-section"><div class="panel-head"><div><h2>Trainers & staff</h2><p class="muted" style="font-size:13.5px">Coaches can be assigned to members and classes.</p></div><button class="btn btn-primary btn-sm" data-addstaff>${icon('plus')}Add</button></div>
        <div class="item-list">${S.data.staff.map((s) => `<div class="card item${s.active === false ? ' inactive' : ''}"><span class="avatar" style="--c:${esc(s.color)}">${esc(initials(s.name))}</span><div class="tx"><b>${esc(s.name)}</b><span>${esc(s.role || '')}${s.salary ? ` · salary ${rs(s.salary)}` : ''}${s.phone ? ` · ${esc(s.phone)}` : ''}</span></div><div class="acts"><button class="icon-btn" data-staff="${esc(s.id)}" aria-label="Edit ${esc(s.name)}">${icon('edit')}</button></div></div>`).join('')}</div></section>

      ` : ''}
      ${can('machines') ? `<section class="card form-section" id="fp"><div class="panel-head"><div><h2>${icon('fingerprint')} Fingerprint & face machines</h2><p class="muted" style="font-size:13.5px">Connect your attendance machine. Members check in and out with a thumb or face, and it shows on the entry screen.</p></div>
        <button class="btn btn-primary btn-sm" data-addmachine>${icon('plus')}Add machine</button></div>
        <div id="devices" class="item-list"><div class="skel" style="height:70px"></div></div>
        <div class="fp-test"><b>Try it without a machine</b><p class="muted">Enter a member number to record a thumb punch now.</p>
          <form class="toolbar" style="margin:8px 0 0" data-fptest><input class="input" name="memberNo" inputmode="numeric" placeholder="Member no., e.g. 1001" style="max-width:220px"><button class="btn btn-soft">${icon('fingerprint')}Punch</button></form></div>
      </section>

      ` : ''}
      ${isOwner() ? `<section class="card form-section" id="logins"><div class="panel-head"><div><h2>${icon('lock')} Staff logins & access</h2><p class="muted" style="font-size:13.5px">Give each person their own PIN and choose exactly what they can see and do. Changes work straight away.</p></div>
        <button class="btn btn-primary btn-sm" data-adduser>${icon('plus')}Add login</button></div>
        <div id="users" class="item-list"><div class="skel" style="height:70px"></div></div>
        <h3 style="font-size:15px;margin:22px 0 4px">Owner PIN</h3><p class="muted" style="font-size:13.5px;margin-bottom:10px">Opens everything, including this section. Keep it to yourself.</p>
        <form class="form-grid two" id="pin-form" novalidate>
          <label class="field"><span>Current owner PIN</span><input class="input" name="current" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password"></label>
          <label class="field"><span>New owner PIN</span><input class="input" name="owner" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></label>
          <div class="span"><button class="btn btn-ghost" type="submit">${icon('lock')}Change owner PIN</button></div>
        </form></section>

      <section class="card form-section"><h2>Data</h2><p>${S.data.demo ? 'You are looking at <b>demo data</b>. Clear it to start with your real members.' : 'Remove every member, payment, visit and expense. Settings, plans, staff and classes stay.'}</p>
        <button class="btn btn-danger" data-clear>${icon('trash')}${S.data.demo ? 'Clear demo data' : 'Delete all member data'}</button></section>` : ''}`);

    if (can('settings')) bindSettings(hoursRow);
    if (can('machines')) bindMachines();
    if (isOwner()) bindOwner();
  }

  function bindSettings(hoursRow) {
    const b = S.data.business;
    const form = document.getElementById('settings');
    const hoursEl = document.getElementById('hours');
    const readHours = () => {
      const out = {};
      hoursEl.querySelectorAll('[data-day]').forEach((row) => {
        out[row.dataset.day] = row.querySelector('[data-open]').checked ? [...row.querySelectorAll('[data-range]')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value)) : [];
      });
      return out;
    };
    const redrawRow = (day, ranges) => {
      b.hours = { ...readHours(), [day]: ranges };
      hoursEl.querySelector(`[data-day="${day}"]`).outerHTML = hoursRow(day);
      bindHours();
    };
    const bindHours = () => hoursEl.querySelectorAll('[data-day]').forEach((row) => {
      const day = row.dataset.day;
      row.querySelector('[data-open]').onchange = (e) => redrawRow(day, e.target.checked ? [['06:00', '22:00']] : []);
      const add = row.querySelector('[data-addrange]');
      if (add) add.onclick = () => {
        const cur = readHours()[day];
        const end = cur[cur.length - 1][1];
        cur[cur.length - 1][1] = '12:30';
        cur.push(['14:30', end]);
        redrawRow(day, cur);
      };
      row.querySelectorAll('[data-rm]').forEach((btn, i) => { btn.onclick = () => { const cur = readHours()[day]; cur.splice(i + 1, 1); redrawRow(day, cur); }; });
    });
    bindHours();
    root.querySelectorAll('[data-swatch]').forEach((sw) => sw.addEventListener('click', () => {
      form.accent.value = sw.dataset.swatch;
      root.querySelectorAll('[data-swatch]').forEach((x) => x.setAttribute('aria-pressed', x === sw));
      UI.setAccent(sw.dataset.swatch);
    }));
    form.accent.addEventListener('input', () => UI.setAccent(form.accent.value));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(form.querySelector('[type=submit]'), async () => {
        const body = formData(form);
        body.hours = readHours();
        body.closedDates = b.closedDates || [];
        body.blockExpiredCheckin = form.blockExpiredCheckin.checked;
        try {
          await api('/api/admin/business', { method: 'PUT', body });
          await refreshData();
          document.title = `${S.data.business.name} · Manager`;
          const y = window.scrollY;
          settingsPage();
          window.scrollTo(0, y);
          toast('Settings saved');
        } catch (err) { toast(err.message, 'bad'); }
      });
    });
    root.querySelector('[data-addplan]').addEventListener('click', () => editPlan({}));
    root.querySelectorAll('[data-plan]').forEach((x) => x.addEventListener('click', () => editPlan(S.data.plans.find((p) => p.id === x.dataset.plan))));
    root.querySelector('[data-addstaff]').addEventListener('click', () => editStaff({}));
    root.querySelectorAll('[data-staff]').forEach((x) => x.addEventListener('click', () => editStaff(S.data.staff.find((s) => s.id === x.dataset.staff))));
    drawWhatsApp();
    drawExerciseVideos();
  }

  // ---- short how-to videos on exercises ------------------------------------------------

  async function drawExerciseVideos(filter = { q: '', f: 'all' }) {
    const box = document.getElementById('exvid');
    if (!box) return;
    const lib = await Workout.library();
    const count = lib.exercises.filter((e) => Workout.videoOf(e.id)).length;
    box.innerHTML = `<div class="panel-head"><div><h2>${icon('tv')} Exercise videos</h2><p class="muted" style="font-size:13.5px">Add a short clip (15-60 seconds) showing the right way to do each exercise. Members see it when they open the exercise. Without one, they get a button to short YouTube videos.</p></div></div>
      <div class="toolbar" style="margin:0 0 12px"><input class="input" type="search" placeholder="Search exercises" data-q value="${esc(filter.q)}" style="max-width:260px">
        <div class="chips-row" style="margin:0" role="group">${[['all', `All · ${lib.exercises.length}`], ['with', `With video · ${count}`], ['without', `No video · ${lib.exercises.length - count}`]].map(([id, l]) => `<button class="chip" data-f="${id}" aria-pressed="${filter.f === id}">${l}</button>`).join('')}</div></div>
      <div class="item-list ex-videos" data-list></div>`;
    const draw = () => {
      const t = filter.q.trim().toLowerCase();
      const list = lib.exercises.filter((e) => (!t || e.name.toLowerCase().includes(t)) && (filter.f === 'all' || (filter.f === 'with') === Boolean(Workout.videoOf(e.id))));
      box.querySelector('[data-list]').innerHTML = list.map((e) => {
        const v = Workout.videoOf(e.id);
        return `<div class="card item">${Workout.anim(e.id, 'tiny')}<div class="tx"><b>${esc(e.name)} ${v ? `<span class="badge badge-good">${v.type === 'file' ? 'Your clip' : 'YouTube'}</span>` : ''}</b><span>${esc(Workout.groupName(e.group))}</span></div>
          <div class="acts"><button class="btn btn-ghost btn-sm" data-preview="${e.id}">${icon('tv')}See</button><button class="btn btn-soft btn-sm" data-link="${e.id}">Link</button><button class="btn btn-soft btn-sm" data-upload="${e.id}">${icon('download')}Upload</button>${v ? `<button class="icon-btn" data-rmvid="${e.id}" aria-label="Remove video">${icon('trash')}</button>` : ''}</div></div>`;
      }).join('') || emptyLine('No exercise found.');
      const L = box.querySelector('[data-list]');
      L.querySelectorAll('[data-preview]').forEach((b) => b.addEventListener('click', () => Workout.detailSheet(b.dataset.preview)));
      L.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => sheet({
        title: 'Add a YouTube video',
        html: `<form class="form-grid" novalidate><p class="muted">Paste a YouTube or YouTube Shorts link. Short videos (under a minute) that show the full set with good form work best.</p>
          <label class="field"><span>Link</span><input class="input" name="url" inputmode="url" placeholder="https://youtube.com/shorts/…" autocomplete="off"></label>
          <a class="link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${lib.byId[b.dataset.link].name} proper form #shorts`)}" target="_blank" rel="noopener">Find one on YouTube ↗</a>
          <div class="sheet-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Save</button></div></form>`,
        onMount: (el, close) => el.querySelector('form').addEventListener('submit', (ev) => {
          ev.preventDefault();
          busy(ev.target.querySelector('.btn-primary'), async () => {
            try { Workout.setVideo(b.dataset.link, await api(`/api/admin/exercise-videos/${b.dataset.link}`, { method: 'PUT', body: { url: ev.target.url.value } })); close(); toast('Video added'); drawExerciseVideos(filter); } catch (err) { toast(err.message, 'bad'); }
          });
        }),
      })));
      L.querySelectorAll('[data-upload]').forEach((b) => b.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/mp4,video/quicktime';
        input.addEventListener('change', () => {
          const file = input.files[0];
          if (!file) return;
          if (file.size > 40 * 1024 * 1024) return toast('The video is too big. Keep it under 40 MB (15-60 seconds).', 'bad');
          busy(b, async () => {
            try {
              const res = await fetch(`${UI.apiBase()}/api/admin/exercise-videos/${b.dataset.upload}/file`, { method: 'PUT', headers: { Authorization: `Bearer ${S.token}`, 'Content-Type': file.type || 'video/mp4' }, body: file });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || 'Upload failed');
              Workout.setVideo(b.dataset.upload, data);
              toast('Video uploaded');
              drawExerciseVideos(filter);
            } catch (err) { toast(err.message, 'bad'); }
          });
        });
        input.click();
      }));
      L.querySelectorAll('[data-rmvid]').forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmSheet({ title: 'Remove this video?', message: 'Members will see the photos and the YouTube button again.', confirm: 'Remove', danger: true }))) return;
        try { await api(`/api/admin/exercise-videos/${b.dataset.rmvid}`, { method: 'DELETE' }); Workout.setVideo(b.dataset.rmvid, null); drawExerciseVideos(filter); } catch (err) { toast(err.message, 'bad'); }
      }));
    };
    box.querySelector('[data-q]').addEventListener('input', (e) => { filter.q = e.target.value; draw(); });
    box.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter.f = b.dataset.f; box.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); }));
    draw();
  }

  // ---- automatic WhatsApp reminders ---------------------------------------------------

  async function drawWhatsApp() {
    const box = document.getElementById('wa');
    if (!box) return;
    const [{ settings: w, templates, dueToday }, rem] = await Promise.all([api('/api/admin/whatsapp'), api('/api/admin/reminders')]);
    const ready = w.phoneNumberId && w.hasToken;
    const status = w.enabled
      ? `<span class="badge badge-good"><i class="dot"></i>On</span>`
      : `<span class="badge badge-muted">Off</span>`;
    const log = rem.log.slice(0, 12);
    box.innerHTML = `<div class="panel-head"><div><h2>${icon('whatsapp')} Automatic WhatsApp reminders ${status}</h2><p class="muted" style="font-size:13.5px">Members get a WhatsApp message before their membership ends, from your gym's number, without anyone pressing a button.</p></div></div>
      <form class="form-grid two" id="wa-form" novalidate>
        <label class="toggle-row span"><span><b>Send reminders automatically</b></span><span class="switch"><input type="checkbox" name="enabled" ${w.enabled ? 'checked' : ''}><span></span></span></label>
        <label class="field"><span>Start this many days before the end</span><input class="input" name="daysBefore" type="number" min="1" max="30" value="${w.daysBefore}"></label>
        <label class="field"><span>How often</span><select class="select" name="every"><option value="day" ${w.every === 'day' ? 'selected' : ''}>Every day until it ends</option><option value="some" ${w.every === 'some' ? 'selected' : ''}>On day ${w.daysBefore}, 3, 1 and the last day</option></select></label>
        <label class="field"><span>Send at</span><input class="input" name="sendAt" type="time" value="${esc(w.sendAt)}"></label>
        <label class="field"><span>Country calling code</span><input class="input" name="countryCode" inputmode="numeric" value="${esc(w.countryCode)}" placeholder="92"><small>Turns 0300… into +92 300…</small></label>
        <details class="span wa-setup" ${ready ? '' : 'open'}><summary><b>Connect your WhatsApp number</b> ${ready ? '<span class="badge badge-good">connected</span>' : '<span class="badge badge-warn">needed once</span>'}</summary>
          <ol class="steps" style="margin:12px 0 14px">
            <li>Open <b>business.facebook.com</b> → WhatsApp Manager, and add your gym's number to the <b>WhatsApp Business Platform</b> (the number can't be in the normal WhatsApp app at the same time).</li>
            <li>Create a message template: category <b>Utility</b>, name <code class="copyable" data-copy="${esc(w.templateName)}">${esc(w.templateName)}</code>, language as chosen below, and this text:
              <div class="wa-template"><span data-tpl>${esc(templates[w.templateLang === 'ur' ? 'ur' : 'en'])}</span><button type="button" class="icon-btn" data-copytpl aria-label="Copy text">${icon('copy')}</button></div>
              {{1}} name · {{2}} gym · {{3}} end date · {{4}} days left. Meta usually approves it within a day.</li>
            <li>In <b>API Setup</b>, copy the <b>Phone number ID</b> and a <b>permanent access token</b> (System user token with <i>whatsapp_business_messaging</i>) here.</li></ol>
          <div class="form-grid two">
            <label class="field"><span>Phone number ID</span><input class="input" name="phoneNumberId" inputmode="numeric" value="${esc(w.phoneNumberId)}"></label>
            <label class="field"><span>Access token ${w.hasToken ? '<span class="badge badge-good">saved</span>' : ''}</span><input class="input" name="token" type="password" autocomplete="off" placeholder="${w.hasToken ? 'Leave blank to keep' : 'EAA…'}"></label>
            <label class="field"><span>Template name</span><input class="input" name="templateName" value="${esc(w.templateName)}"></label>
            <label class="field"><span>Template language</span><select class="select" name="templateLang"><option value="en" ${w.templateLang !== 'ur' ? 'selected' : ''}>English (en)</option><option value="ur" ${w.templateLang === 'ur' ? 'selected' : ''}>Urdu (ur) · Roman Urdu text</option></select></label>
          </div></details>
        <div class="span" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" type="submit">${icon('check')}Save reminders</button></div>
      </form>
      <div class="wa-test"><b>Send a test message</b><form class="toolbar" style="margin:8px 0 0" data-watest><input class="input" name="phone" inputmode="tel" placeholder="Your WhatsApp number" style="max-width:240px"><button class="btn btn-soft" ${ready ? '' : 'disabled'}>${icon('whatsapp')}Send test</button></form></div>
      <h3 style="font-size:15px;margin:20px 0 8px">Today ${dueToday ? `· ${dueToday} still to send` : ''}${rem.lastRun ? ` <span class="muted" style="font-weight:600;font-size:13px">· last checked ${new Date(rem.lastRun).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>` : ''}</h3>
      ${log.length ? `<div class="rows">${log.map((r) => memberRow({ ...(r.member || { name: 'Deleted member' }), id: r.memberId }, { sub: `${r.day === 0 ? 'Last day' : `${r.day} day${r.day === 1 ? '' : 's'} before`} · ends ${dateShort(r.expiry)} · ${new Date(r.at).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${r.error ? ` · ${esc(r.error)}` : ''}`, end: r.status === 'sent' ? '<span class="badge badge-good">Sent</span>' : '<span class="badge badge-bad">Failed</span>' })).join('')}</div>`
        : emptyLine(w.enabled ? 'No reminders sent yet. They go out at the time you chose.' : 'Switch reminders on to start sending.')}`;
    const f = box.querySelector('#wa-form');
    f.templateLang.addEventListener('change', () => { box.querySelector('[data-tpl]').textContent = templates[f.templateLang.value === 'ur' ? 'ur' : 'en']; });
    box.querySelector('[data-copytpl]').addEventListener('click', () => navigator.clipboard?.writeText(box.querySelector('[data-tpl]').textContent).then(() => toast('Template text copied'), () => toast('Select the text and copy it', 'bad')));
    box.querySelectorAll('[data-copy]').forEach((c) => c.addEventListener('click', () => navigator.clipboard?.writeText(c.dataset.copy).then(() => toast('Copied'))));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(f.querySelector('[type=submit]'), async () => {
        const body = formData(f);
        body.enabled = f.enabled.checked;
        try { await api('/api/admin/whatsapp', { method: 'PUT', body }); toast(body.enabled ? 'Reminders are on' : 'Saved'); drawWhatsApp(); } catch (err) { toast(err.message, 'bad'); }
      });
    });
    box.querySelector('[data-watest]').addEventListener('submit', (e) => {
      e.preventDefault();
      busy(e.target.querySelector('button'), async () => {
        try { const r = await api('/api/admin/whatsapp/test', { method: 'POST', body: { phone: e.target.phone.value } }); toast(`Test sent to +${r.to}`); } catch (err) { toast(err.message, 'bad'); }
      });
    });
  }

  function bindMachines() {
    drawDevices();
    root.querySelector('[data-addmachine]').addEventListener('click', () => machineWizard());
    root.querySelector('[data-fptest]').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      busy(f.querySelector('button'), async () => {
        try {
          const r = await api('/api/admin/devices/test-punch', { method: 'POST', body: { memberNo: f.memberNo.value } });
          toast(r.result === 'in' ? `${r.member.name} checked in by thumb` : r.result === 'out' ? `${r.member.name} checked out by thumb` : 'Same punch twice within 2 minutes, ignored');
          f.reset();
        } catch (err) { toast(err.message, 'bad'); }
      });
    });
  }

  function bindOwner() {
    drawUsers();
    root.querySelector('[data-adduser]').addEventListener('click', () => userSheet({}));
    document.getElementById('pin-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      busy(f.querySelector('[type=submit]'), async () => {
        try { await api('/api/admin/pins', { method: 'POST', body: formData(f) }); f.reset(); toast('Owner PIN changed'); } catch (err) { toast(err.message, 'bad'); }
      });
    });
    root.querySelector('[data-clear]').addEventListener('click', () => sheet({
      title: 'Delete member data?',
      html: `<p class="muted">All members, payments, attendance, measurements, expenses and enquiries will be deleted. Type <b>DELETE</b> to confirm.</p><input class="input" data-confirm style="margin-top:14px" autocomplete="off">
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger" data-ok>Delete everything</button></div>`,
      onMount: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        try { await api('/api/admin/clear-data', { method: 'POST', body: { confirm: el.querySelector('[data-confirm]').value.trim() } }); await refreshData(); close(); toast('Data cleared'); location.hash = '#/home'; } catch (err) { toast(err.message, 'bad'); }
      }),
    }));
  }

  // ---- staff logins and what each may do -------------------------------------------

  let access = { permissions: [], presets: [], users: [] };

  function accessSummary(perms) {
    const preset = access.presets.find((p) => p.perms.length === perms.length && p.perms.every((x) => perms.includes(x)));
    if (preset) return preset.label;
    const labels = access.permissions.filter((p) => perms.includes(p.id)).map((p) => p.label);
    return `${labels.length} of ${access.permissions.length}: ${labels.slice(0, 3).join(', ')}${labels.length > 3 ? '…' : ''}`;
  }

  async function drawUsers() {
    const box = document.getElementById('users');
    if (!box) return;
    access = await api('/api/admin/users');
    box.innerHTML = access.users.map((u) => `<div class="card item${u.active === false ? ' inactive' : ''}"><span class="avatar">${esc(initials(u.name))}</span>
      <div class="tx"><b>${esc(u.name)}${u.active === false ? ' <span class="badge badge-muted">Switched off</span>' : ''}</b><span>${esc(accessSummary(u.perms))}</span></div>
      <div class="acts"><button class="btn btn-ghost btn-sm" data-user="${esc(u.id)}">${icon('edit')}Access</button></div></div>`).join('')
      || `<div class="note-box" style="margin:0;background:var(--surface-2)">${icon('info')}<span>No staff logins yet. Press <b>Add login</b> to give your front desk their own PIN.</span></div>`;
    box.querySelectorAll('[data-user]').forEach((x) => x.addEventListener('click', () => userSheet(access.users.find((u) => u.id === x.dataset.user))));
  }

  function userSheet(u) {
    const editing = Boolean(u.id);
    const groups = [...new Set(access.permissions.map((p) => p.group))];
    const has = new Set(u.perms || access.presets.find((p) => p.id === 'desk')?.perms || []);
    sheet({
      title: editing ? `${u.name} · access` : 'New staff login',
      wide: true,
      html: `<form class="form-grid two" novalidate>
        <label class="field"><span>Name</span><input class="input" name="name" value="${esc(u.name || '')}" maxlength="40" placeholder="e.g. Bilal" required></label>
        <label class="field"><span>${editing ? 'New PIN' : 'PIN'} (4 to 8 digits)</span><input class="input" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password" ${editing ? 'placeholder="Leave blank to keep"' : 'required'}></label>
        <div class="field span"><span>Quick choice</span><div class="chips-row" style="margin:0">${access.presets.map((p) => `<button type="button" class="chip" data-preset="${esc(p.id)}">${esc(p.label)}</button>`).join('')}</div></div>
        <div class="span perm-groups">${groups.map((g) => `<div class="perm-group"><h4>${esc(g)}</h4>${access.permissions.filter((p) => p.group === g).map((p) => `
          <label class="toggle-row"><span><b>${esc(p.label)}</b>${p.hint ? `<small>${esc(p.hint)}</small>` : ''}</span><span class="switch"><input type="checkbox" data-perm="${esc(p.id)}" ${has.has(p.id) ? 'checked' : ''}><span></span></span></label>`).join('')}</div>`).join('')}</div>
        ${editing ? `<label class="toggle-row span perm-active"><span><b>Login switched on</b><small>Switch off when someone leaves; they are signed out at once.</small></span><span class="switch"><input type="checkbox" name="active" ${u.active !== false ? 'checked' : ''}><span></span></span></label>` : ''}
        <p class="muted span" style="font-size:13px">Only you, the owner, can manage logins and change the owner PIN.</p>
      </form>
      <div class="sheet-actions">${editing ? `<button class="btn btn-danger" data-del>${icon('trash')}Delete</button><span class="grow"></span>` : ''}<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>${icon('check')}${editing ? 'Save' : 'Add login'}</button></div>`,
      onMount: (el, close) => {
        const f = el.querySelector('form');
        const boxes = [...el.querySelectorAll('[data-perm]')];
        const markPreset = () => {
          const on = boxes.filter((b) => b.checked).map((b) => b.dataset.perm);
          el.querySelectorAll('[data-preset]').forEach((c) => {
            const p = access.presets.find((x) => x.id === c.dataset.preset);
            c.setAttribute('aria-pressed', p.perms.length === on.length && p.perms.every((x) => on.includes(x)));
          });
        };
        el.querySelectorAll('[data-preset]').forEach((c) => c.addEventListener('click', () => {
          const p = access.presets.find((x) => x.id === c.dataset.preset);
          boxes.forEach((b) => { b.checked = p.perms.includes(b.dataset.perm); });
          markPreset();
        }));
        boxes.forEach((b) => b.addEventListener('change', markPreset));
        markPreset();
        el.querySelector('[data-ok]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
          const body = { name: f.name.value, perms: boxes.filter((b) => b.checked).map((b) => b.dataset.perm) };
          if (f.pin.value) body.pin = f.pin.value;
          if (editing) body.active = f.active.checked;
          try {
            await api(editing ? `/api/admin/users/${u.id}` : '/api/admin/users', { method: editing ? 'PUT' : 'POST', body });
            close();
            toast(editing ? 'Access saved' : `${body.name} can now sign in with their PIN`);
            drawUsers();
          } catch (err) { toast(err.message, 'bad'); }
        }));
        el.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (!(await confirmSheet({ title: `Delete ${u.name}?`, message: 'Their PIN stops working straight away.', confirm: 'Delete login', danger: true }))) return;
          try { await api(`/api/admin/users/${u.id}`, { method: 'DELETE' }); close(); toast('Login deleted'); drawUsers(); } catch (err) { toast(err.message, 'bad'); }
        });
      },
    });
  }

  // ---- attendance machines -------------------------------------------------------

  let deviceTypes = [];

  async function drawDevices() {
    const box = document.getElementById('devices');
    if (!box) return;
    const { types, devices } = await api('/api/admin/devices');
    deviceTypes = types;
    const typeName = (id) => types.find((t) => t.id === id)?.name || 'Machine';
    const added = devices.filter((dv) => dv.approved);
    const found = devices.filter((dv) => !dv.approved && dv.lastSeen);
    const badge = (dv) => (dv.online ? '<span class="badge badge-good"><i class="dot"></i>Connected</span>' : dv.lastSeen ? '<span class="badge badge-warn">Offline</span>' : '<span class="badge badge-muted">Not connected yet</span>');
    box.innerHTML = `${added.map((dv) => `<div class="card item"><div class="ic-tile">${icon(dv.protocol === 'hik' || dv.type === 'zk-face' ? 'user' : 'fingerprint')}</div>
      <div class="tx"><b>${esc(dv.name)} ${badge(dv)}</b><span>${esc(typeName(dv.type))}${dv.sn ? ` · serial ${esc(dv.sn)}` : ''} · ${dv.punches} punches${dv.lastSeen ? ` · last seen ${new Date(dv.lastSeen).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}${dv.unknownIds?.length ? ` · <span class="money-neg">IDs not matching a member: ${dv.unknownIds.map(esc).join(', ')}</span>` : ''}</span></div>
      <div class="acts"><button class="btn btn-ghost btn-sm" data-setup="${esc(dv.id)}">${icon('info')}Setup</button><button class="btn btn-soft btn-sm" data-check="${esc(dv.id)}">${icon('refresh')}Check</button>${dv.protocol === 'zk' ? `<button class="btn btn-ghost btn-sm" data-syncall="${esc(dv.id)}" title="Put every member's name and number on this machine">${icon('users')}Send members</button>` : ''}<button class="icon-btn" data-rename="${esc(dv.id)}" aria-label="Rename">${icon('edit')}</button><button class="icon-btn" data-rmdev="${esc(dv.id)}" aria-label="Remove">${icon('trash')}</button></div></div>`).join('')}
      ${found.map((dv) => `<div class="card item" style="border-style:dashed"><div class="ic-tile">${icon('alert')}</div><div class="tx"><b>New machine found · serial ${esc(dv.sn)}</b><span>It is calling the server but hasn't been added. Is it yours?</span></div>
        <div class="acts"><button class="btn btn-primary btn-sm" data-addfound="${esc(dv.sn)}">Add it</button><button class="icon-btn" data-rmdev="${esc(dv.id)}" aria-label="Ignore">${icon('x')}</button></div></div>`).join('')}
      ${!added.length && !found.length ? `<div class="note-box" style="margin:0;background:var(--surface-2)">${icon('info')}<span>No machine yet. Press <b>Add machine</b>, pick the one you have, and follow the steps.</span></div>` : ''}`;
    const byId = (id) => devices.find((x) => x.id === id);
    box.querySelectorAll('[data-setup]').forEach((b) => b.addEventListener('click', () => setupSheet(byId(b.dataset.setup))));
    box.querySelectorAll('[data-check]').forEach((b) => b.addEventListener('click', () => setupSheet(byId(b.dataset.check), { checkNow: true })));
    box.querySelectorAll('[data-addfound]').forEach((b) => b.addEventListener('click', () => machineWizard({ sn: b.dataset.addfound })));
    box.querySelectorAll('[data-syncall]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Send all members to this machine?', message: 'Every member\u2019s number and name is added to the machine, ready for a finger or face. Fingerprints already on the machine stay.', confirm: 'Send members' }))) return;
      try { const r = await api(`/api/admin/devices/${b.dataset.syncall}/sync`, { method: 'POST' }); toast(`${r.queued} members will be on the machine within a few minutes`); } catch (err) { toast(err.message, 'bad'); }
    }));
    box.querySelectorAll('[data-rmdev]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Remove this machine?', message: 'Punches from it will be refused until you add it again.', confirm: 'Remove', danger: true }))) return;
      await api(`/api/admin/devices/${b.dataset.rmdev}`, { method: 'DELETE' });
      drawDevices();
    }));
    box.querySelectorAll('[data-rename]').forEach((b) => b.addEventListener('click', () => sheet({
      title: 'Rename machine',
      html: `<input class="input" data-name value="${esc(byId(b.dataset.rename).name)}" maxlength="60"><div class="sheet-actions"><button class="btn btn-primary" data-ok>Save</button></div>`,
      onMount: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => { await api(`/api/admin/devices/${b.dataset.rename}`, { method: 'PUT', body: { name: el.querySelector('[data-name]').value } }); close(); drawDevices(); }),
    })));
  }

  function serverHost() {
    const u = new URL(UI.apiBase() || location.origin, location.origin);
    // On the platform, machines use a plain-http port (most can't do https).
    const mp = window.APP_CONFIG?.machinePort;
    if (mp) return { host: u.hostname, port: mp, https: false, origin: `http://${u.hostname}:${mp}` };
    const https = u.protocol === 'https:';
    return { host: u.hostname, port: u.port || (https ? 443 : 80), https, origin: u.origin };
  }

  // Step 1: which machine do you have? Step 2: what it needs. Then setup steps and a connection check.
  async function machineWizard(prefill = {}) {
    if (!deviceTypes.length) deviceTypes = (await api('/api/admin/devices')).types;
    sheet({
      title: 'Add a machine',
      wide: true,
      html: `<p class="muted" style="margin-bottom:12px">Which machine do you have? It's written on the front or on the sticker at the back.</p>
        <div class="type-list">${deviceTypes.map((t) => `<button class="card type-card" data-type="${t.id}"><span class="brand">${esc(t.brand)}</span><b>${esc(t.name)}</b><small>${esc(t.models)}</small></button>`).join('')}</div>`,
      onMount: (el, close) => el.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
        close();
        setTimeout(() => machineDetails(deviceTypes.find((t) => t.id === b.dataset.type), prefill), 240);
      })),
    });
  }

  function machineDetails(type, prefill = {}) {
    const zk = type.protocol === 'zk';
    sheet({
      title: type.name,
      wide: true,
      html: `<form class="form-grid" novalidate>
        <label class="field"><span>Name for this machine</span><input class="input" name="name" value="${esc(prefill.name || (type.protocol === 'hik' ? 'Face gate' : 'Front gate'))}" maxlength="60"><small>So you can tell machines apart, e.g. "Front gate" or "Ladies section".</small></label>
        ${zk ? `<label class="field"><span>Serial number (S/N)</span><input class="input" name="sn" value="${esc(prefill.sn || '')}" placeholder="e.g. CQUJ223360123" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.04em"><small>On the machine: <b>Menu → System Info → Device Info → Serial Number</b>. It's also on the sticker at the back.</small></label>` : `<div class="note-box" style="margin:0;background:var(--surface-2)">${icon('info')}<span>Nothing to type here. After you press Next you get a private web address to enter in the terminal's <b>HTTP Listening</b> settings.</span></div>`}
        ${type.id === 'zlink' ? `<div class="note-box" style="margin:0">${icon('alert')}<span>ZLink machines normally talk to ZKTeco's own cloud. Remove it from the <b>ZKBio Zlink</b> app first. If the machine's <b>Cloud Server Setting</b> doesn't let you change the server address, it can't connect to this app directly; ask your dealer for ADMS firmware.</span></div>` : ''}
        ${type.id === 'other' ? `<div class="note-box" style="margin:0">${icon('info')}<span>Look in the machine's network menu for <b>ADMS</b>, <b>Cloud Server</b>, <b>Push</b> or <b>iClock</b>. If one of those exists, it will work. If not, this machine can't send attendance over the internet.</span></div>` : ''}
        </form><div class="sheet-actions"><button class="btn btn-ghost" data-back>${icon('chevronLeft')}Back</button><button class="btn btn-primary" data-ok>Next: setup steps${icon('chevronRight')}</button></div>`,
      onMount: (el, close) => {
        el.querySelector('[data-back]').addEventListener('click', () => { close(); setTimeout(() => machineWizard(prefill), 240); });
        const ok = el.querySelector('[data-ok]');
        ok.addEventListener('click', () => busy(ok, async () => {
          const f = el.querySelector('form');
          try {
            const device = await api('/api/admin/devices', { method: 'POST', body: { type: type.id, name: f.name.value, sn: f.sn?.value } });
            close();
            drawDevices();
            setTimeout(() => setupSheet(device), 240);
          } catch (e) { toast(e.message, 'bad'); }
        }));
      },
    });
  }

  function setupSteps(device) {
    const s = serverHost();
    const code = (v) => `<code class="copyable" data-copy="${esc(v)}">${esc(v)}</code>`;
    if (device.protocol === 'hik') {
      const path = `/hik/${device.key}`;
      return `<ol class="steps">
        <li>Connect the terminal to the gym's internet (WiFi or LAN cable).</li>
        <li>Open the terminal's settings: in <b>iVMS-4200</b> or by typing its IP address in a browser on the same WiFi, go to <b>Configuration → Network → Advanced → HTTP Listening</b> (on some firmware: <b>Event → Alarm Server</b>).</li>
        <li>Fill in: <b>Destination IP or domain</b> ${code(s.host)} · <b>URL</b> ${code(path)} · <b>Port</b> ${code(String(s.port))} · <b>Protocol</b> ${s.https ? 'HTTPS' : 'HTTP'}. Save.</li>
        <li>Under <b>Person management</b>, add every member with <b>Employee No. = their member number</b> (on each member's profile) and capture their face.</li>
        <li>Do one face scan at the terminal, then press <b>Check connection</b> below.</li></ol>`;
    }
    return `<ol class="steps">
      <li>Connect the machine to the gym's internet: <b>Menu → COMM → Ethernet</b> (or <b>Wireless/WiFi</b>). It should show an IP address.</li>
      <li>Open <b>Menu → COMM → Cloud Server Setting</b> (on eSSL: <b>ADMS</b>; on some models: <b>Push</b>).</li>
      <li>Set <b>Server mode</b> to ADMS, turn <b>Enable domain name</b> on, then fill in: <b>Server address</b> ${code(s.host)} · <b>Port</b> ${code(String(s.port))} · <b>HTTPS</b> ${s.https ? 'ON' : 'OFF'}. Save and <b>restart</b> the machine.</li>
      <li>Add members on the machine: <b>Menu → User Mgt → New User</b>, with <b>User ID = their member number</b>, then enroll the ${device.type === 'zk-face' ? 'face' : 'thumb'}.</li>
      <li>Wait one minute, then press <b>Check connection</b> below.</li></ol>`;
  }

  function hintsFor(device, result) {
    if (result.code === 'lost') return ['Is the machine switched on and still on the internet (WiFi or cable)?', 'Was the router restarted or the WiFi password changed?', `Is the server address on the machine still ${serverHost().host}?`];
    if (device.protocol === 'hik') return ['Check that HTTP Listening is saved and the URL is copied exactly, including the long code at the end.', 'Do one face scan: Hikvision only sends data when something happens.', 'Make sure the terminal shows an IP address and can reach the internet.', 'If your address starts with https, choose HTTPS in the terminal; otherwise HTTP.'];
    return [
      'On the machine, <b>COMM → Ethernet/WiFi</b> should show an IP address. If not, it isn’t on the internet.',
      `Server address and port must be exactly <b>${esc(serverHost().host)}</b> and <b>${serverHost().port}</b>.`,
      'Some older machines don’t support HTTPS or domain names. Try HTTPS off, or the server’s IP address instead of the name.',
      'Restart the machine after saving the settings.',
      `The serial number you entered (<b>${esc(device.sn || '')}</b>) must match <b>System Info → Device Info</b>.`,
    ];
  }

  function setupSheet(device, { checkNow = false } = {}) {
    sheet({
      title: `Set up ${device.name}`,
      wide: true,
      html: `${setupSteps(device)}<div class="conn" data-conn></div>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>Close</button><button class="btn btn-primary" data-check>${icon('refresh')}Check connection</button></div>`,
      onMount: (el) => {
        const box = el.querySelector('[data-conn]');
        el.querySelectorAll('[data-copy]').forEach((c) => c.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(c.dataset.copy); toast('Copied'); } catch { /* select instead */ }
        }));
        let polling = false;
        const check = async () => {
          if (polling) return;
          polling = true;
          const btn = el.querySelector('[data-check]');
          btn.disabled = true;
          // A machine calls in about once a minute, so keep listening for up to two minutes.
          for (let i = 0; i < 24 && el.isConnected; i++) {
            box.innerHTML = `<div class="conn-wait"><span class="spinner"></span><span>Waiting for the machine to call the server… ${i ? `(${i * 5}s)` : ''}</span></div>`;
            let r;
            try { r = await api(`/api/admin/devices/${device.id}/check`); } catch (e) { r = { ok: false, code: 'error', message: e.message }; }
            if (r.ok) {
              box.innerHTML = `<div class="conn-ok">${icon('check')}<div><b>Connected successfully</b><p>${esc(r.message)} Members can now use the machine; every punch shows up in Attendance and on the entry screen.</p></div></div>`;
              drawDevices();
              btn.disabled = false;
              polling = false;
              return;
            }
            if (r.code === 'wrong-serial' || r.code === 'lost' || i === 23) {
              const others = (r.others || []).filter((o) => o.sn);
              box.innerHTML = `<div class="conn-bad">${icon('alert')}<div><b>Not connected</b><p>${esc(r.message)}</p>
                ${others.length && device.protocol === 'zk' ? `<p style="margin-top:8px">${others.map((o) => `<button class="btn btn-primary btn-sm" data-usesn="${esc(o.sn)}">Use serial ${esc(o.sn)}</button>`).join(' ')}</p>` : ''}
                <ul>${hintsFor(device, r).map((h) => `<li>${h}</li>`).join('')}</ul></div></div>`;
              box.querySelectorAll('[data-usesn]').forEach((b) => b.addEventListener('click', async () => {
                try {
                  device = await api(`/api/admin/devices/${device.id}`, { method: 'PUT', body: { sn: b.dataset.usesn } });
                  polling = false;
                  check();
                } catch (e) { toast(e.message, 'bad'); }
              }));
              btn.disabled = false;
              polling = false;
              return;
            }
            await new Promise((res) => setTimeout(res, 5000));
          }
          btn.disabled = false;
          polling = false;
        };
        el.querySelector('[data-check]').addEventListener('click', check);
        if (checkNow) check();
      },
    });
  }

  // ---- member photo -------------------------------------------------------------

  function photoSheet(m, url, after) {
    sheet({
      title: 'Profile photo',
      html: `<div style="display:grid;justify-items:center;gap:12px;padding:6px 0 4px">${avatar(m, 'xl')}<p class="muted" style="text-align:center">The photo shows on the member's app, the front desk and the entry screen.</p></div>
        <div class="sheet-actions">${m.photo ? `<button class="btn btn-danger" data-remove>${icon('trash')}Remove</button>` : ''}<button class="btn btn-primary" data-pick>${icon('camera')}${m.photo ? 'Change photo' : 'Add photo'}</button></div>`,
      onMount: (el, close) => {
        el.querySelector('[data-pick]').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          try {
            const image = await UI.pickPhoto();
            if (!image) return;
            await busy(btn, () => api(url, { method: 'PUT', body: { image } }));
            close();
            toast('Photo saved');
            after?.();
          } catch (err) { toast(err.message, 'bad'); }
        });
        el.querySelector('[data-remove]')?.addEventListener('click', async () => {
          await api(url, { method: 'DELETE' });
          close();
          toast('Photo removed');
          after?.();
        });
      },
    });
  }

  function editPlan(p) {
    crudSheet('plans', p, p.id ? 'Edit plan' : 'Add plan', `
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(p.name || '')}" maxlength="40" placeholder="Monthly, Quarterly…"></label>
      <label class="field"><span>Length (months)</span><input class="input" name="months" type="number" min="1" max="36" value="${p.months || 1}"></label>
      <label class="field"><span>Price</span><input class="input" name="price" type="number" min="0" step="100" value="${p.price ?? ''}"></label>
      <label class="toggle-row"><span>Highlight as best value</span><span class="switch"><input type="checkbox" name="highlight" ${p.highlight ? 'checked' : ''}><span></span></span></label>
      <label class="field span"><span>What's included (one per line)</span><textarea class="textarea" name="features">${esc((p.features || []).join('\n'))}</textarea></label>
      <label class="toggle-row span"><span>Available</span><span class="switch"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}><span></span></span></label>`, settingsPage);
  }

  function editStaff(s) {
    crudSheet('staff', s, s.id ? 'Edit staff' : 'Add staff', `
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(s.name || '')}" maxlength="60"></label>
      <label class="field"><span>Role</span><input class="input" name="role" value="${esc(s.role || '')}" maxlength="60" placeholder="Trainer, Front desk…"></label>
      <label class="field"><span>Phone</span><input class="input" name="phone" type="tel" value="${esc(s.phone || '')}"></label>
      <label class="field"><span>Monthly salary</span><input class="input" name="salary" type="number" min="0" step="1000" value="${s.salary ?? ''}"></label>
      <label class="field"><span>Colour</span><input class="input" name="color" type="color" value="${esc(s.color || '#f97316')}" style="padding:6px;height:50px"></label>
      <label class="toggle-row"><span>Active</span><span class="switch"><input type="checkbox" name="active" ${s.active !== false ? 'checked' : ''}><span></span></span></label>`, settingsPage);
  }

  // ---- router -------------------------------------------------------------------

  async function refreshData() {
    S.data = await api('/api/admin/data');
    UI.setBusiness(S.data.business);
    UI.setAccent(S.data.business.accent);
  }

  function noAccess(page) {
    shell(page, 'No access', '', `<div class="card empty"><div class="empty-icon">${icon('lock')}</div><h3>You don’t have access to this</h3><p>The owner decides what each login can open. Ask them if you need it.</p><a class="btn btn-primary" href="#/home">Go to the dashboard</a></div>`);
  }

  async function route() {
    document.querySelectorAll('.sheet-backdrop').forEach((x) => x.remove());
    document.body.style.overflow = '';
    if (!S.token) return loginView();
    const [path, query] = (location.hash.slice(1) || '/home').split('?');
    const params = new URLSearchParams(query || '');
    const parts = path.split('/').filter(Boolean);
    const page = parts[0] || 'home';
    window.scrollTo(0, 0);
    if (!allowed(page)) return noAccess(page);
    try {
      if (page === 'member' && parts[1]) return await memberPage(parts[1], params);
      if (page === 'desk') return await deskPage();
      if (page === 'members') return await membersPage(params);
      if (page === 'fees') return await feesPage(params);
      if (page === 'register') return await registerPage(params);
      if (page === 'attendance') return await attendancePage(params);
      if (page === 'classes') return await classesPage(params);
      if (page === 'leads') return await leadsPage();
      if (page === 'expenses') return await expensesPage(params);
      if (page === 'reports') return await reportsPage(params);
      if (page === 'settings') return settingsPage();
      return await homePage();
    } catch (e) {
      if (S.token) toast(e.message, 'bad');
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
    document.title = `${S.data.business.name} · Manager`;
    route();
  }

  if (window.APP_CONFIG?.native && !UI.apiBase()) { location.replace(UI.url('/index.html')); return; }
  window.addEventListener('hashchange', route);
  if (S.token) start(); else loginView();
})();
