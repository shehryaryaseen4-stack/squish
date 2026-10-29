// Self check-in screen for a tablet at the gym entrance.
(function () {
  const { esc, api: rawApi, time12, dateLong, initials, toast, store } = UI;
  const root = document.getElementById('root');
  let token = store.get('kioskToken', null);
  let gym = null;
  let code = '';
  let resetTimer = null;
  let inside = [];

  const api = (path, opts = {}) => rawApi(path, { ...opts, token });

  function clock() {
    const el = document.querySelector('.k-clock');
    if (!el || !gym) return;
    el.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: gym.timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date());
  }

  async function signIn() {
    try { gym = (await rawApi('/api/gym')).business; } catch { gym = { name: 'Gym', accent: '#f97316', timeZone: 'Asia/Karachi' }; }
    UI.setAccent(gym.accent);
    root.innerHTML = `<div class="login"><div class="login-card">${UI.brandMark(gym)}<h1>Start the kiosk</h1><p>Enter the owner or front desk PIN once on this device.</p>
      <form style="margin-top:22px;display:grid;gap:12px"><input class="input" type="password" inputmode="numeric" maxlength="8" placeholder="PIN" autofocus style="text-align:center;font-size:22px;letter-spacing:.3em"><button class="btn btn-primary btn-block">Start</button></form>
      <p class="hint"><a class="link" href="${UI.url('/admin.html')}">← Dashboard</a></p></div></div>`;
    root.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const r = await rawApi('/api/admin/login', { method: 'POST', body: { pin: root.querySelector('input').value } });
        token = r.token;
        store.set('kioskToken', token);
        main();
      } catch (err) { toast(err.message, 'bad'); }
    });
  }

  function main() {
    UI.setBusiness(gym);
    root.innerHTML = `<div class="kiosk">
      <header class="k-top">${UI.brandMark(gym)}<h1>${esc(gym.name)}<span>${dateLong(nowDate())}</span></h1><div class="k-clock"></div></header>
      <div class="k-main"><div class="k-entry" id="entry"></div><div class="k-side" id="side"></div></div></div>`;
    clock();
    entry();
    loadInside();
  }

  function nowDate() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: gym.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }

  function entry() {
    code = '';
    const el = document.getElementById('entry');
    el.innerHTML = `<h2>Check in / out</h2><p>Type your member number</p><div class="k-display empty" aria-live="polite">Member number</div>
      <div class="k-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="del" aria-label="Delete">${icon('backspace')}</button><button data-k="0">0</button><button class="go" data-k="go" aria-label="Go">${icon('check')}</button></div>`;
    el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
  }

  function paint() {
    const d = document.querySelector('.k-display');
    if (!d) return;
    d.textContent = code || 'Member number';
    d.classList.toggle('empty', !code);
  }

  async function press(k) {
    if (!document.querySelector('.k-pad')) return;
    if (k === 'del') code = code.slice(0, -1);
    else if (k === 'go') return submit();
    else if (code.length < 6) code += k;
    paint();
  }

  async function submit() {
    if (!code) return;
    const no = code;
    code = '';
    paint();
    try {
      const r = await api('/api/admin/checkin', { method: 'POST', body: { memberNo: no, source: 'kiosk' } });
      show(r);
      loadInside();
    } catch (e) {
      if (e.status === 401) { token = null; store.remove('kioskToken'); return signIn(); }
      show({ error: e.message });
    }
  }

  function show(r) {
    const el = document.getElementById('entry');
    clearTimeout(resetTimer);
    if (r.error) {
      el.innerHTML = `<div class="k-result bad"><div class="empty-icon" style="margin:0 auto;background:var(--bad-soft);color:var(--bad)">${icon('alert')}</div><h2>Sorry</h2><p class="sub">${esc(r.error)}</p><p class="note">Please see the front desk.</p></div>`;
    } else {
      const s = r.summary;
      const first = esc(r.member.name.split(' ')[0]);
      const toM = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      let tone = r.action === 'in' ? 'in' : 'out';
      let note = '';
      if (r.action === 'in') {
        if (['expired', 'unpaid'].includes(s.status)) { tone = 'bad'; note = s.status === 'unpaid' ? 'Your fee is not paid yet. Please see the front desk.' : `Your membership expired on ${dateLong(s.expiry)}. Please renew today.`; }
        else if (s.balance > 0) { tone = 'warn'; note = `You have ${UI.money(s.balance)} pending. Please clear it at the desk.`; }
        else if (s.status === 'expiring') { tone = 'warn'; note = `Your membership ends in ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'}. Renew to keep training.`; }
        else if (s.daysLeft != null) note = `${s.daysLeft} days left on your ${esc(s.plan?.name || '')} membership · ${s.visitsThisMonth} visit${s.visitsThisMonth === 1 ? '' : 's'} this month`;
      } else {
        const mins = toM(r.visit.out) - toM(r.visit.in);
        note = `Great session: ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`}. See you soon!`;
      }
      el.innerHTML = `<div class="k-result ${tone}">${UI.avatarHtml(r.member, '', 'var(--accent)')}
        <h2>${r.action === 'in' ? `Welcome, ${first}!` : `Bye, ${first}!`}</h2><p class="sub">#${r.member.memberNo} · ${r.action === 'in' ? 'Checked in' : 'Checked out'} at ${time12(r.action === 'in' ? r.visit.in : r.visit.out)}</p>${note ? `<p class="note">${note}</p>` : ''}</div>`;
    }
    resetTimer = setTimeout(entry, r.error ? 4000 : 4500);
  }

  async function loadInside() {
    try {
      const day = await api(`/api/admin/attendance?date=${nowDate()}`);
      inside = day.list.filter((a) => !a.out);
      const el = document.getElementById('side');
      if (!el) return;
      el.innerHTML = `<section class="card panel"><div class="panel-head"><h2>In the gym now</h2><b style="font-size:22px">${inside.length}</b></div>
        <div class="rows" style="max-height:52vh;overflow:auto">${inside.map((a) => `<div class="m-row" style="cursor:default">${UI.avatarHtml(a.member, 'sm')}<span class="tx"><b>${esc(a.member?.name || '')}</b><span>since ${time12(a.in)}</span></span></div>`).join('') || '<p class="muted">Nobody yet. Be the first! 💪</p>'}</div>
        <p class="muted" style="font-size:13px;margin-top:12px">${day.list.length} check-ins today</p></section>`;
    } catch { /* keep the last list */ }
  }

  document.addEventListener('keydown', (e) => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') press('go');
  });
  setInterval(clock, 10000);
  setInterval(loadInside, 60000);

  (async () => {
    try { gym = (await rawApi('/api/gym')).business; } catch { /* sign-in shows the error */ }
    if (!token || !gym) return signIn();
    UI.setAccent(gym.accent);
    UI.setBusiness(gym);
    try { await api('/api/admin/attendance'); main(); } catch { token = null; store.remove('kioskToken'); signIn(); }
  })();
})();
