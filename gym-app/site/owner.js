// Platform owner panel: every gym, its subscription, licences and settings.
(function () {
  const { esc, toast, sheet, confirmSheet, busy, store } = UI;
  const root = document.getElementById('root');
  let token = store.get('ownerToken', null);

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) { token = null; store.remove('ownerToken'); start(); }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
    return data;
  }

  const date = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const when = (iso) => {
    const d = (Date.now() - Date.parse(iso)) / 864e5;
    if (d < 1 / 24) return 'just now';
    if (d < 1) return `${Math.round(d * 24)}h ago`;
    if (d < 30) return `${Math.round(d)}d ago`;
    return date(iso);
  };
  const STATE = {
    trial: ['badge-warn', 'Trial'], paid: ['badge-good', 'Paying'], grace: ['badge-warn', 'Payment due'], free: ['badge-accent', 'Free'], expired: ['badge-bad', 'Locked'], suspended: ['badge-bad', 'Paused'],
  };
  const stateBadge = (a) => { const [cls, label] = STATE[a.state] || ['badge-muted', a.state]; return `<span class="badge ${cls}">${label}${a.state === 'trial' ? ` · ${a.daysLeft}d` : ''}</span>`; };
  const copyLine = (text) => `<div class="copy-line"><span>${esc(text)}</span><button class="icon-btn" type="button" data-copy="${esc(text)}" aria-label="Copy">${icon('copy')}</button></div>`;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (b) navigator.clipboard?.writeText(b.dataset.copy).then(() => toast('Copied'), () => toast('Select and copy it', 'bad'));
  });
  const form = (el) => Object.fromEntries(new FormData(el).entries());

  // ---- sign in -------------------------------------------------------------------

  async function start() {
    if (token) return route();
    const s = await api('/api/owner/status');
    root.innerHTML = `<div class="login"><div class="login-card wide"><div class="brand-mark">${icon('lock')}</div>
      <h1>${s.setup ? 'Create the owner account' : 'Owner panel'}</h1><p>${s.setup ? 'Use the setup code printed in the server log when it started.' : 'Sign in to manage every gym.'}</p>
      <form novalidate>${s.setup ? '<label class="field"><span>Setup code</span><input class="input" name="code" autocomplete="off" required></label>' : ''}
        <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="username" required></label>
        <label class="field"><span>Password${s.setup ? ' (10+ characters)' : ''}</span><input class="input" name="password" type="password" autocomplete="${s.setup ? 'new-password' : 'current-password'}" required></label>
        <button class="btn btn-primary btn-block" type="submit">${s.setup ? 'Create account' : 'Sign in'}</button></form></div></div>`;
    const f = root.querySelector('form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(f.querySelector('button'), async () => {
        try {
          const r = await api(s.setup ? '/api/owner/setup' : '/api/owner/login', { method: 'POST', body: form(f) });
          token = r.token;
          store.set('ownerToken', token);
          route();
        } catch (err) { toast(err.message, 'bad'); }
      });
    });
  }

  // ---- shell ------------------------------------------------------------------------

  const PAGES = [['overview', 'chart', 'Overview'], ['gyms', 'store', 'Gyms'], ['licences', 'tag', 'Licences'], ['machines', 'fingerprint', 'Machines'], ['settings', 'settings', 'Settings'], ['account', 'user', 'Account']];
  const BOTTOM = ['overview', 'gyms', 'licences', 'settings'];

  function shell(page, title, sub, body, actions = '') {
    root.innerHTML = `<div class="shell">
      <aside class="side"><div class="side-brand"><div class="brand-mark">${icon('lock')}</div><div><b>Owner panel</b><span>All gyms</span></div></div>
        ${PAGES.map(([id, ic, label]) => `<a class="nav-item" href="#/${id}" ${id === page ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}
        <div class="spacer"></div><a class="nav-item" href="/" target="_blank">${icon('external')}Website</a></aside>
      <div class="content"><header class="top"><h1>${esc(title)}${sub ? `<span class="sub">${sub}</span>` : ''}</h1>${actions}</header><div class="wrap view">${body}</div></div>
      <nav class="bottom-nav" aria-label="Main">${PAGES.filter(([id]) => BOTTOM.includes(id)).map(([id, ic, label]) => `<a class="nav-item" href="#/${id}" ${id === page ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('')}
        <a class="nav-item" href="#/account" ${page === 'account' || page === 'machines' ? 'aria-current="page"' : ''}>${icon('more')}<span>More</span></a></nav></div>`;
  }

  // ---- overview ------------------------------------------------------------------------

  async function overview() {
    shell('overview', 'Overview', 'Your gyms and sales at a glance', '<div class="skel" style="height:300px;border-radius:22px"></div>');
    const o = await api('/api/owner/overview');
    const kpi = (ic, label, val, sub, href) => `<a class="card kpi link" href="${href}"><div class="k-head">${icon(ic)}${label}</div><div class="k-val tnum">${val}</div><div class="k-sub">${sub}</div></a>`;
    const money = new Intl.NumberFormat('en', { style: 'currency', currency: o.currency, maximumFractionDigits: 0 }).format(o.mrr);
    const steps = [
      [o.setup.company, 'Add your business name and support contact', '#/settings'],
      [o.setup.paddle, 'Connect Paddle so gyms can pay by card', '#/settings'],
      [o.setup.downloads, 'Add the download links for the apps', '#/settings'],
      [o.gyms > 0, 'Get your first gym (or add one yourself)', '#/gyms'],
    ];
    root.querySelector('.wrap').innerHTML = `<div class="kpis owner">
        ${kpi('store', 'Gyms', o.gyms, `${o.newThisMonth} new this month`, '#/gyms')}
        ${kpi('wallet', 'Paying', o.paying, 'active subscriptions', '#/gyms?f=paid')}
        ${kpi('clock', 'On trial', o.trials, 'free trial running', '#/gyms?f=trial')}
        ${kpi('lock', 'Locked', o.locked, 'trial or payment ended', '#/gyms?f=expired')}
        ${kpi('trending', 'Monthly income', money, 'from subscriptions', '#/gyms?f=paid')}
        ${kpi('tag', 'Licences', o.licenses, 'Windows, active', '#/licences')}</div>
      <div class="grid-2 section-gap">
        <section class="card panel"><div class="panel-head"><h2>Get ready to sell</h2></div><div class="setup-list">${steps.map(([ok, text, href]) => `<a class="${ok ? 'done' : ''}" href="${href}">${icon(ok ? 'check' : 'alert')}${esc(text)}</a>`).join('')}</div></section>
        <section class="card panel"><div class="panel-head"><h2>Latest activity</h2></div><div class="events">${o.events.map((e) => `<div><time>${when(e.at)}</time><span>${esc(e.text)}</span></div>`).join('') || '<p class="muted">Nothing yet.</p>'}</div></section>
      </div>`;
  }

  // ---- gyms -------------------------------------------------------------------------------

  let gymsCache = [];
  async function gyms(params) {
    const f = params.get('f') || 'all';
    shell('gyms', 'Gyms', 'Everyone using the app online', '<div class="skel" style="height:300px;border-radius:22px"></div>', `<button class="btn btn-primary btn-sm" data-add>${icon('plus')}Add gym</button>`);
    root.querySelector('[data-add]').addEventListener('click', addGym);
    gymsCache = await api('/api/owner/gyms');
    const FILTERS = [['all', 'All'], ['trial', 'Trial'], ['paid', 'Paying'], ['expired', 'Locked'], ['suspended', 'Paused']];
    root.querySelector('.wrap').innerHTML = `<div class="toolbar-o"><input class="input" type="search" placeholder="Search name, address or email" data-q>
      <div class="chips-row" style="margin:0" role="group">${FILTERS.map(([id, l]) => `<button class="chip" data-f="${id}" aria-pressed="${f === id}">${l} · ${id === 'all' ? gymsCache.length : gymsCache.filter((g) => g.access.state === id || (id === 'paid' && g.access.state === 'grace')).length}</button>`).join('')}</div></div>
      <div class="item-list" id="gym-list"></div>`;
    const draw = () => {
      const term = root.querySelector('[data-q]').value.trim().toLowerCase();
      const list = gymsCache.filter((g) => f === 'all' || g.access.state === f || (f === 'paid' && g.access.state === 'grace'))
        .filter((g) => !term || [g.name, g.slug, g.email, g.phone].some((x) => String(x || '').toLowerCase().includes(term)));
      root.querySelector('#gym-list').innerHTML = list.map((g) => `<div class="card item gym-row"><span class="avatar">${esc(UI.initials(g.name))}</span>
        <div class="tx"><b>${esc(g.name)} ${stateBadge(g.access)}</b><div class="meta"><span>/g/${esc(g.slug)}</span><span>${esc(g.email)}</span><span>${esc(g.country)}</span><span>${g.plan}</span><span>${g.access.until ? `until ${date(g.access.until)}` : ''}</span>${g.members != null ? `<span>${g.members} members</span>` : ''}<span>joined ${date(g.createdAt)}</span></div></div>
        <div class="acts"><button class="btn btn-soft btn-sm" data-manage="${esc(g.id)}">Manage</button></div></div>`).join('')
        || `<div class="card empty"><div class="empty-icon">${icon('store')}</div><h3>No gyms here yet</h3><p>Share your website or add a gym yourself.</p></div>`;
      root.querySelectorAll('[data-manage]').forEach((b) => b.addEventListener('click', () => manageGym(gymsCache.find((g) => g.id === b.dataset.manage))));
    };
    root.querySelector('[data-q]').addEventListener('input', draw);
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/gyms?f=${b.dataset.f}`; }));
    draw();
  }

  const reloadGyms = () => route();

  function manageGym(g) {
    sheet({
      title: g.name,
      wide: true,
      html: `<div class="kv-o"><span>Address</span><b>/g/${esc(g.slug)}</b><span>Status</span><span style="color:var(--ink)">${stateBadge(g.access)}</span><span>Plan</span><b>${esc(g.plan)}${g.paddle ? ` · Paddle ${esc(g.paddle.status)}` : ''}</b>
          <span>Paid until</span><b>${date(g.paidUntil)}</b><span>Trial ends</span><b>${date(g.trialEnds)}</b><span>Email</span><b>${esc(g.email)}</b><span>Phone</span><b>${esc(g.phone || '—')}</b><span>Last active</span><b>${g.lastActive ? when(g.lastActive) : '—'}</b></div>
        <div class="actions-grid">
          <button class="btn btn-primary" data-open>${icon('external')}Open their dashboard</button>
          <button class="btn btn-soft" data-extend>${icon('calendar')}Add paid time</button>
          <button class="btn btn-ghost" data-pin>${icon('lock')}Reset owner PIN</button>
          <button class="btn btn-ghost" data-pause>${icon(g.status === 'suspended' ? 'refresh' : 'snow')}${g.status === 'suspended' ? 'Switch back on' : 'Pause gym'}</button>
          <button class="btn btn-ghost" data-free>${icon('gift')}${g.plan === 'free' ? 'End free use' : 'Make free (no charge)'}</button>
          <button class="btn btn-ghost" data-del style="color:var(--bad)">${icon('trash')}Delete gym</button></div>
        <label class="field" style="margin-top:16px"><span>Private note</span><textarea class="input" rows="2" data-note maxlength="500">${esc(g.note || '')}</textarea></label>`,
      onMount: (el, close) => {
        const act = async (body, msg) => { try { await api(`/api/owner/gyms/${g.id}`, { method: 'PUT', body }); toast(msg); close(); reloadGyms(); } catch (err) { toast(err.message, 'bad'); } };
        el.querySelector('[data-open]').addEventListener('click', async () => {
          const r = await api(`/api/owner/gyms/${g.id}/login`, { method: 'POST' });
          try { localStorage.setItem(`/g/${r.slug}|adminToken`, JSON.stringify(r.token)); } catch { /* ignore */ }
          window.open(r.url, '_blank');
        });
        el.querySelector('[data-extend]').addEventListener('click', () => sheet({
          title: 'Add paid time',
          html: `<form class="form-o" novalidate><p class="muted">For payments by bank, wallet or cash. Time is added after the current paid date.</p>
            <div class="chips-row" style="margin:0">${[[30, '1 month'], [90, '3 months'], [182, '6 months'], [365, '1 year']].map(([d, l]) => `<button type="button" class="chip" data-days="${d}">${l}</button>`).join('')}</div>
            <div class="two"><label class="field"><span>Days</span><input class="input" name="days" type="number" min="1" max="3650" value="30"></label>
            <label class="field"><span>Plan</span><select class="input" name="plan"><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label></div>
            <label class="field"><span>Note (e.g. JazzCash ref.)</span><input class="input" name="note" maxlength="80"></label>
            <button class="btn btn-primary btn-block">Add time</button></form>`,
          onMount: (el2) => {
            const f = el2.querySelector('form');
            el2.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { f.days.value = b.dataset.days; f.plan.value = Number(b.dataset.days) >= 300 ? 'yearly' : 'monthly'; }));
            f.addEventListener('submit', (e) => { e.preventDefault(); act({ action: 'extend', ...form(f), days: Number(f.days.value) }, `${f.days.value} days added`).then(() => document.querySelectorAll('.sheet-backdrop').forEach((x) => x.remove())); });
          },
        }));
        el.querySelector('[data-pin]').addEventListener('click', () => sheet({
          title: 'Reset owner PIN',
          html: '<form class="form-o" novalidate><p class="muted">For when the gym owner forgets it. Tell them the new PIN.</p><label class="field"><span>New PIN (4 to 8 digits)</span><input class="input" name="pin" inputmode="numeric" maxlength="8" autocomplete="off"></label><button class="btn btn-primary btn-block">Set PIN</button></form>',
          onMount: (el2) => el2.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); act({ action: 'pin', pin: e.target.pin.value }, 'PIN changed').then(() => document.querySelectorAll('.sheet-backdrop').forEach((x) => x.remove())); }),
        }));
        el.querySelector('[data-pause]').addEventListener('click', async () => {
          if (g.status !== 'suspended' && !(await confirmSheet({ title: `Pause ${g.name}?`, message: 'Their staff and members can’t use the app until you switch it back on. Their data is kept.', confirm: 'Pause', danger: true }))) return;
          act({ action: g.status === 'suspended' ? 'unsuspend' : 'suspend' }, g.status === 'suspended' ? 'Switched back on' : 'Paused');
        });
        el.querySelector('[data-free]').addEventListener('click', () => act({ action: 'plan', plan: g.plan === 'free' ? 'trial' : 'free' }, 'Plan changed'));
        el.querySelector('[data-note]').addEventListener('change', (e) => api(`/api/owner/gyms/${g.id}`, { method: 'PUT', body: { action: 'note', note: e.target.value } }).then(() => toast('Note saved')));
        el.querySelector('[data-del]').addEventListener('click', () => sheet({
          title: `Delete ${g.name}?`,
          html: `<form class="form-o" novalidate><p class="muted">The gym disappears from the website. Its files move to the "deleted" folder on the server in case you need them. Type <b>${esc(g.slug)}</b> to confirm.</p><input class="input" name="confirm" autocomplete="off"><button class="btn btn-danger btn-block">Delete gym</button></form>`,
          onMount: (el2) => el2.querySelector('form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try { await api(`/api/owner/gyms/${g.id}`, { method: 'DELETE', body: { confirm: e.target.confirm.value.trim() } }); document.querySelectorAll('.sheet-backdrop').forEach((x) => x.remove()); toast('Gym deleted'); reloadGyms(); } catch (err) { toast(err.message, 'bad'); }
          }),
        }));
      },
    });
  }

  async function addGym() {
    const cfg = await api('/api/platform/config');
    sheet({
      title: 'Add a gym',
      wide: true,
      html: `<form class="form-o" novalidate><p class="muted">For gyms that paid you directly. They get their own address and sign in with the PIN you set.</p>
        <div class="two"><label class="field"><span>Gym name</span><input class="input" name="gymName" required></label><label class="field"><span>Web address (optional)</span><input class="input" name="slug" placeholder="made from the name"></label></div>
        <div class="two"><label class="field"><span>Owner email</span><input class="input" name="email" type="email" required></label><label class="field"><span>Phone</span><input class="input" name="phone"></label></div>
        <div class="two"><label class="field"><span>Country</span><select class="input" name="country">${cfg.countries.map((c) => `<option value="${c.code}">${esc(c.name)}</option>`).join('')}</select></label><label class="field"><span>Owner PIN</span><input class="input" name="ownerPin" inputmode="numeric" maxlength="8" required></label></div>
        <label class="field"><span>Start as</span><select class="input" name="plan"><option value="trial">Free trial (${cfg.trialDays} days)</option><option value="monthly">Paid · 1 month</option><option value="yearly">Paid · 1 year</option><option value="free">Free, no charge</option></select></label>
        <button class="btn btn-primary btn-block">Create gym</button></form>`,
      onMount: (el, close) => {
        const f = el.querySelector('form');
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          busy(f.querySelector('button'), async () => {
            try {
              const g = await api('/api/owner/gyms', { method: 'POST', body: form(f) });
              close();
              sheet({ title: 'Gym created', html: `<p class="muted">Send these to ${esc(g.email)}:</p><div style="display:grid;gap:8px;margin-top:12px">${copyLine(`${location.origin}/g/${g.slug}/admin`)}${copyLine(`${location.origin}/g/${g.slug}/`)}</div>` });
              reloadGyms();
            } catch (err) { toast(err.message, 'bad'); }
          });
        });
      },
    });
  }

  // ---- licences --------------------------------------------------------------------------

  async function licences() {
    shell('licences', 'Licences', 'Windows app keys, sold or given', '<div class="skel" style="height:300px;border-radius:22px"></div>', `<button class="btn btn-primary btn-sm" data-add>${icon('plus')}New licence</button>`);
    root.querySelector('[data-add]').addEventListener('click', () => sheet({
      title: 'New licence',
      html: `<form class="form-o" novalidate><p class="muted">For a buyer who paid you directly.</p><label class="field"><span>Buyer email</span><input class="input" name="email" type="email"></label><label class="field"><span>Gym / buyer name</span><input class="input" name="name"></label><label class="field"><span>Note</span><input class="input" name="note" placeholder="e.g. paid by bank, ref 1234"></label><button class="btn btn-primary btn-block">Create key</button></form>`,
      onMount: (el, close) => el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const l = await api('/api/owner/licenses', { method: 'POST', body: form(e.target) });
          close();
          sheet({ title: 'Licence key', html: `<p class="muted">Send this key to the buyer.</p><div style="margin-top:12px">${copyLine(l.key)}</div>` });
          licences();
        } catch (err) { toast(err.message, 'bad'); }
      }),
    }));
    const list = await api('/api/owner/licenses');
    root.querySelector('.wrap').innerHTML = `<div class="item-list">${list.map((l) => `<div class="card item${l.status === 'revoked' ? ' inactive' : ''}"><div class="ic-tile">${icon('tag')}</div>
      <div class="tx"><b><span class="key-mono">${esc(l.key)}</span> ${l.status === 'revoked' ? '<span class="badge badge-bad">Switched off</span>' : '<span class="badge badge-good">Active</span>'}</b>
        <span>${esc(l.email || 'no email')}${l.name ? ` · ${esc(l.name)}` : ''} · ${l.activations.length}/${l.maxDevices} computers · ${l.source} · ${date(l.createdAt)}${l.note ? ` · ${esc(l.note)}` : ''}</span></div>
      <div class="acts"><button class="icon-btn" data-copy="${esc(l.key)}" aria-label="Copy key">${icon('copy')}</button><button class="btn btn-ghost btn-sm" data-lic="${esc(l.id)}">Manage</button></div></div>`).join('')
      || `<div class="card empty"><div class="empty-icon">${icon('tag')}</div><h3>No licences yet</h3><p>Keys appear here when someone buys the Windows app, or when you create one.</p></div>`}</div>`;
    root.querySelectorAll('[data-lic]').forEach((b) => b.addEventListener('click', () => {
      const l = list.find((x) => x.id === b.dataset.lic);
      sheet({
        title: l.key,
        html: `<div class="kv-o"><span>Email</span><b>${esc(l.email || '—')}</b><span>Bought</span><b>${date(l.createdAt)} · ${esc(l.source)}</b><span>Computers</span><b>${l.activations.map((a) => `${esc(a.name || a.device.slice(0, 8))} (last seen ${when(a.lastSeen)})`).join(', ') || 'not activated yet'}</b></div>
          <div class="actions-grid"><button class="btn ${l.status === 'active' ? 'btn-danger' : 'btn-primary'}" data-a="${l.status === 'active' ? 'revoke' : 'restore'}">${l.status === 'active' ? 'Switch off' : 'Switch back on'}</button>
          <button class="btn btn-ghost" data-a="reset">Free up computers</button></div>
          <label class="field" style="margin-top:14px"><span>Computers allowed</span><input class="input" type="number" min="1" max="50" value="${l.maxDevices}" data-max></label>`,
        onMount: (el, close) => {
          const act = async (body, msg) => { try { await api(`/api/owner/licenses/${l.id}`, { method: 'PUT', body }); toast(msg); close(); licences(); } catch (err) { toast(err.message, 'bad'); } };
          el.querySelectorAll('[data-a]').forEach((x) => x.addEventListener('click', () => act({ action: x.dataset.a }, 'Done')));
          el.querySelector('[data-max]').addEventListener('change', (e) => act({ action: 'devices', maxDevices: Number(e.target.value) }, 'Saved'));
        },
      });
    }));
  }

  // ---- machines -----------------------------------------------------------------------------

  async function machines() {
    shell('machines', 'Machines', 'Fingerprint machines calling the server', '<div class="skel" style="height:200px;border-radius:22px"></div>');
    const { unclaimed } = await api('/api/owner/machines');
    root.querySelector('.wrap').innerHTML = `<div class="note-box">${icon('info')}<span>Machines reach their gym by serial number. These are calling the server but no gym has added their serial yet, often because of a typo. Tell the gym the exact serial to enter.</span></div>
      <div class="item-list">${unclaimed.map((u) => `<div class="card item"><div class="ic-tile">${icon('fingerprint')}</div><div class="tx"><b class="key-mono">${esc(u.sn)}</b><span>last call ${when(u.lastSeen)} · from ${esc(u.ip || '?')}</span></div></div>`).join('') || '<p class="muted">No unknown machines.</p>'}</div>`;
  }

  // ---- settings ------------------------------------------------------------------------------

  async function settings() {
    shell('settings', 'Settings', 'Your product, prices and payments', '<div class="skel" style="height:400px;border-radius:22px"></div>');
    const { settings: s, publicKey, webhookUrl } = await api('/api/owner/settings');
    const price = (k, label) => `<div class="two" style="grid-template-columns:1fr 90px 1.4fr"><label class="field"><span>${label}</span><input class="input" name="${k}.amount" type="number" min="0" step="any" value="${s.prices[k].amount}"></label>
      <label class="field"><span>Currency</span><input class="input" name="${k}.currency" maxlength="3" value="${esc(s.prices[k].currency)}"></label>
      <label class="field"><span>Paddle price ID</span><input class="input" name="${k}.paddlePriceId" placeholder="pri_…" value="${esc(s.prices[k].paddlePriceId)}"></label></div>`;
    root.querySelector('.wrap').innerHTML = `<form id="set" novalidate>
      <section class="card form-section"><h2>Your product</h2><p>Shown on the website, in emails and the legal pages.</p><div class="form-o">
        <div class="two"><label class="field"><span>Product name</span><input class="input" name="productName" value="${esc(s.productName)}" maxlength="40"></label><label class="field"><span>Business / legal name</span><input class="input" name="companyName" value="${esc(s.companyName)}"></label></div>
        <div class="two"><label class="field"><span>Support email</span><input class="input" name="supportEmail" type="email" value="${esc(s.supportEmail)}"></label><label class="field"><span>Support WhatsApp</span><input class="input" name="supportWhatsapp" value="${esc(s.supportWhatsapp)}" placeholder="923001234567"></label></div>
        <label class="field"><span>Website address</span><input class="input" name="publicUrl" value="${esc(s.publicUrl)}" placeholder="https://yourdomain.com"></label></div></section>
      <section class="card form-section"><h2>Prices</h2><p>What the website shows. Paddle charges the price set on each Paddle price ID.</p><div class="form-o">
        ${price('monthly', 'Online · monthly')}${price('yearly', 'Online · yearly')}${price('license', 'Windows · one-time')}
        <div class="two"><label class="field"><span>Free trial (days)</span><input class="input" name="trialDays" type="number" min="0" max="90" value="${s.trialDays}"></label><label class="field"><span>Extra days after payment is due</span><input class="input" name="graceDays" type="number" min="0" max="30" value="${s.graceDays}"></label></div>
        <label class="field"><span>Computers per Windows licence</span><input class="input" name="licenseMaxDevices" type="number" min="1" max="20" value="${s.licenseMaxDevices}"></label></div></section>
      <section class="card form-section"><h2>Paddle payments</h2><p>From your Paddle dashboard: Developer tools → Authentication (client-side token) and Notifications (webhook secret). Start with sandbox to test.</p><div class="form-o">
        <div class="two"><label class="field"><span>Environment</span><select class="input" name="paddle.environment"><option value="sandbox" ${s.paddle.environment === 'sandbox' ? 'selected' : ''}>Sandbox (testing)</option><option value="production" ${s.paddle.environment === 'production' ? 'selected' : ''}>Live</option></select></label>
          <label class="field"><span>Client-side token</span><input class="input" name="paddle.clientToken" value="${esc(s.paddle.clientToken)}" placeholder="test_… or live_…"></label></div>
        <label class="field"><span>Webhook secret ${s.paddle.hasWebhookSecret ? '<span class="badge badge-good">saved</span>' : ''}</span><input class="input" name="paddle.webhookSecret" type="password" autocomplete="off" placeholder="${s.paddle.hasWebhookSecret ? 'Leave blank to keep' : 'pdl_ntfset_…'}"></label>
        <div class="field"><span>Webhook URL to add in Paddle (events: subscription.*, transaction.completed)</span>${copyLine(webhookUrl)}</div></div></section>
      <section class="card form-section"><h2>Downloads</h2><p>Links shown on the Download page and after a licence is bought.</p><div class="form-o">
        <label class="field"><span>Windows app (.exe)</span><input class="input" name="downloads.windows" value="${esc(s.downloads.windows)}" placeholder="https://…/gym-app-setup.exe"></label>
        <div class="two"><label class="field"><span>Android app (.apk)</span><input class="input" name="downloads.android" value="${esc(s.downloads.android)}"></label><label class="field"><span>Android demo (.apk)</span><input class="input" name="downloads.androidDemo" value="${esc(s.downloads.androidDemo)}"></label></div></div></section>
      <div class="save-bar"><button class="btn btn-primary" type="submit">${icon('check')}Save settings</button></div></form>
      <section class="card form-section"><h2>Licence public key</h2><p>Licences are signed with this server's private key (kept in the data folder; back it up). The Windows app checks signatures with this public key.</p>${copyLine(publicKey.trim())}</section>`;
    const f = document.getElementById('set');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const flat = form(f);
      const body = { prices: { monthly: {}, yearly: {}, license: {} }, paddle: {}, downloads: {} };
      for (const [k, v] of Object.entries(flat)) {
        const [a, b] = k.split('.');
        if (!b) body[a] = v;
        else if (a in body.prices) body.prices[a][b] = v;
        else body[a][b] = v;
      }
      busy(f.querySelector('[type=submit]'), async () => {
        try { await api('/api/owner/settings', { method: 'PUT', body }); toast('Settings saved'); settings(); } catch (err) { toast(err.message, 'bad'); }
      });
    });
  }

  // ---- account ----------------------------------------------------------------------------------

  async function account() {
    const s = await api('/api/owner/status');
    shell('account', 'Account', esc(s.email || ''), `<section class="card form-section"><h2>Change password</h2><p>Signs you out everywhere else.</p>
      <form class="form-o" id="pw" novalidate><label class="field"><span>Current password</span><input class="input" name="current" type="password" autocomplete="current-password"></label>
      <label class="field"><span>New password (10+ characters)</span><input class="input" name="password" type="password" autocomplete="new-password"></label><button class="btn btn-primary">Change password</button></form></section>
      <div class="actions-grid" style="max-width:520px"><a class="btn btn-ghost" href="#/machines">${icon('fingerprint')}Unknown machines</a><button class="btn btn-ghost" data-out>${icon('logout')}Sign out</button></div>`);
    root.querySelector('#pw').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { const r = await api('/api/owner/password', { method: 'POST', body: form(e.target) }); token = r.token; store.set('ownerToken', token); e.target.reset(); toast('Password changed'); } catch (err) { toast(err.message, 'bad'); }
    });
    root.querySelector('[data-out]').addEventListener('click', async () => { await api('/api/owner/logout', { method: 'POST' }).catch(() => {}); token = null; store.remove('ownerToken'); start(); });
  }

  async function route() {
    if (!token) return start();
    document.querySelectorAll('.sheet-backdrop').forEach((x) => x.remove());
    const [path, query] = (location.hash.slice(1) || '/overview').split('?');
    const params = new URLSearchParams(query || '');
    const page = path.split('/').filter(Boolean)[0] || 'overview';
    try {
      if (page === 'gyms') return await gyms(params);
      if (page === 'licences') return await licences();
      if (page === 'machines') return await machines();
      if (page === 'settings') return await settings();
      if (page === 'account') return await account();
      return await overview();
    } catch (e) {
      if (token) toast(e.message, 'bad');
    }
  }

  window.addEventListener('hashchange', route);
  start().catch((e) => toast(e.message, 'bad'));
})();
