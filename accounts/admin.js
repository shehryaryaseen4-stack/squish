'use strict';
// The owner's dashboard (ADMIN_PATH): traffic (visitors per hour, sources, pages, countries,
// devices), conversions and PDF downloads, live activity, and, with accounts, the list of users.
// Plain server-rendered HTML; public/admin.js adds the search box, delete and sign-out.

const brand = require('../brand');
const ASSET_V = require('../seo').ASSET_V;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SITE = process.env.SITE_NAME || brand.NAME;
const MARK = `<svg class="ad-mark" viewBox="0 0 32 32" aria-hidden="true">${brand.TILE}${brand.MARK}</svg>`;

function shell(title, body, path) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/admin.css?v=${ASSET_V.adminCss}">
<script src="/admin.js?v=${ASSET_V.adminJs}" defer></script>
</head>
<body data-admin="${esc(path)}">
${body}
</body>
</html>`;
}

function loginPage(path) {
  return shell(`Dashboard sign in | ${SITE}`, `<main class="ad-login">
  <form class="ad-card ad-login-form" novalidate>
    <div class="ad-brand">${MARK}<span>${esc(SITE)}</span></div>
    <h1>Owner dashboard</h1>
    <p class="ad-dim">Only the site owner can sign in here.</p>
    <label for="adEmail">Email</label>
    <input id="adEmail" type="email" autocomplete="username" required>
    <label for="adPass">Password</label>
    <input id="adPass" type="password" autocomplete="current-password" required>
    <button class="ad-btn ad-btn-brand" type="submit">Sign in</button>
    <p class="ad-msg" role="alert" hidden></p>
  </form>
</main>`, path);
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
function when(iso, tz) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function flag(cc) {
  return /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map((c) => 0x1F1A5 + c.charCodeAt(0))) : '';
}

// One series as a bar chart: thin rounded bars, a recessive grid with three labelled lines,
// and a tooltip per bar (bars carry data-tip; admin.js shows it on hover). ticks: label or ''
// for each bar; hi: index of a bar to mark (the current hour).
function bars({ title, sub, values, tips, ticks, hi = -1 }) {
  const W = 960, H = 190, L = 34, B = 22, T = 10, n = values.length;
  const max = Math.max(4, ...values);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const bw = (W - L) / n;
  const grid = [0, top / 2, top].map((v) => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(Math.round(v))}</text>`).join('');
  const cols = values.map((v, i) => {
    const x = L + i * bw + 2, w = Math.max(2, bw - 4), h = Math.max(0, y(0) - y(v));
    const r = Math.min(4, w / 2, h);
    const bar = h > 0 ? `<path class="ad-bar${i === hi ? ' ad-bar-hi' : ''}" d="M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z"/>` : '';
    return `<g class="ad-col" data-tip="${esc(tips[i])}"><rect class="ad-hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}"/>${bar}</g>`;
  }).join('');
  const tk = ticks.map((t, i) => (t ? `<text x="${i === n - 1 && n > 12 ? W : L + i * bw + bw / 2}" y="${H - 6}" text-anchor="${i === n - 1 && n > 12 ? 'end' : 'middle'}">${esc(t)}</text>` : '')).join('');
  return `<section class="ad-card ad-chart">
    <div class="ad-chart-head"><h2>${esc(title)}</h2><span class="ad-dim">${sub}</span></div>
    <div class="ad-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><g class="ad-grid">${grid}</g>${cols}<g class="ad-ticks">${tk}</g></svg><div class="ad-tip" hidden></div></div>
  </section>`;
}
const shortDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;
// Daily counts over the last 30 days (accounts section).
function barChart(title, days, values, unit) {
  return bars({ title, sub: `${fmt(values.reduce((a, b) => a + b, 0))} in the last ${days.length} days`, values,
    tips: values.map((v, i) => `${shortDay(days[i])}: ${plural(v, unit)}`),
    ticks: days.map((d, i) => (i % 7 === days.length % 7 || i === days.length - 1 ? shortDay(d) : '')) });
}

// A ranked list with a bar behind each row, like "Top pages".
const regionName = (() => { try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); return (cc) => { try { return dn.of(cc); } catch { return cc; } }; } catch { return (cc) => cc; } })();
function rank(title, obj, { label = (k) => esc(k), limit = 10, empty = 'Nothing yet.', note = '' } = {}) {
  const all = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const total = all.reduce((a, [, n]) => a + n, 0);
  const rows = all.slice(0, limit);
  const max = rows.length ? rows[0][1] : 0;
  return `<section class="ad-card ad-rank"><div class="ad-rank-head"><h2>${esc(title)}</h2>${note ? `<span class="ad-dim">${note}</span>` : ''}</div>
    ${rows.length ? `<ol>${rows.map(([k, n]) => `<li><span class="ad-rk-bar" style="width:${Math.max(2, (100 * n) / max).toFixed(1)}%"></span><span class="ad-rk-label">${label(k)}</span><span class="ad-rk-n">${fmt(n)}<small>${total ? Math.round((100 * n) / total) : 0}%</small></span></li>`).join('')}</ol>${all.length > limit ? `<p class="ad-dim ad-rank-more">+ ${fmt(all.length - limit)} more</p>` : ''}`
    : `<p class="ad-dim ad-rank-empty">${empty}</p>`}
  </section>`;
}
const pageLabel = (p) => `<a href="${esc(p)}" target="_blank" rel="noopener">${esc(p)}</a>`;
const countryLabel = (cc) => (cc === '??' || cc === '(other)' ? '<span class="ad-dim">Unknown</span>' : `${flag(cc)} ${esc(regionName(cc))}`);
const EVENT_NAMES = { convert: 'Files converted', compress: 'Files compressed', pdf: 'PDFs downloaded from the editor', combine: 'Images saved as one PDF', fail: 'Conversions that failed' };
function activityText(e) {
  const page = e.p ? ` on ${pageLabel(e.p)}` : '';
  switch (e.k) {
    case 'arrive': return `Arrived from <b>${esc(e.s === 'Other sites' && e.ref ? e.ref : e.s)}</b>${page}`;
    case 'convert': return `Converted <b>${esc(e.d)}</b>${page}`;
    case 'compress': return `Compressed <b>${esc(e.d.split(' → ')[0])}</b>${page}`;
    case 'pdf': return `<b>Downloaded a PDF</b> from the editor${page}`;
    case 'combine': return `Saved <b>${esc(e.d || 'images')}</b> as one PDF${page}`;
    case 'fail': return `<span class="ad-bad">Conversion failed</span>: ${esc(e.d)}${page}`;
    default: return esc(e.k);
  }
}
const visitorChip = (v) => `<span class="ad-vis" style="--h:${parseInt(String(v).slice(0, 4), 16) % 360}">#${esc(String(v).slice(0, 4))}</span>`;

const RANGE_LABELS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']];

function dashboard({ users, daily, path, store, stats, range = 'today', accounts = false }) {
  const tz = store.TZ;
  const S = stats;
  const ev = (k) => S.events[k] || 0;
  const conversions = ev('convert') + ev('compress');
  const oneDay = S.days.length === 1;
  const rangeName = RANGE_LABELS.find(([k]) => k === range)[1].toLowerCase();
  const tile = (label, value, sub, cls = '') => `<div class="ad-card ad-tile ${cls}"><span class="ad-label">${label}</span><strong>${value}</strong><span class="ad-dim">${sub}</span></div>`;

  // Visitors per hour for one day, per day otherwise.
  const chart = oneDay
    ? bars({ title: range === 'today' ? 'Visitors per hour today' : 'Visitors per hour yesterday', sub: `${plural(S.visitors, 'visitor')} &middot; ${plural(S.views, 'page view')}`,
      values: S.hours.map(([, vs]) => vs),
      tips: S.hours.map(([vw, vs], h) => `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00: ${plural(vs, 'visitor')}, ${plural(vw, 'view')}`),
      ticks: S.hours.map((_, h) => (h % 3 === 0 ? `${String(h).padStart(2, '0')}:00` : '')), hi: range === 'today' ? S.hourNow : -1 })
    : bars({ title: 'Visitors per day', sub: `${plural(S.visitors, 'visitor')} &middot; ${plural(S.views, 'page view')} in ${rangeName}`,
      values: S.byDay.map(([, vs]) => vs),
      tips: S.byDay.map(([d, vs, vw, act]) => `${shortDay(d)}: ${plural(vs, 'visitor')}, ${plural(vw, 'view')}, ${plural(act, 'action')}`),
      ticks: S.byDay.map(([d], i) => (S.byDay.length <= 8 || i % Math.ceil(S.byDay.length / 6) === 0 || i === S.byDay.length - 1 ? shortDay(d) : '')) });

  const activity = S.recent.length ? `<div class="ad-table-wrap"><table class="ad-table ad-activity">
      <thead><tr><th>Time</th><th>Visitor</th><th>Country</th><th>Device</th><th>What happened</th></tr></thead>
      <tbody>${S.recent.map((e, i) => `<tr class="ad-k-${esc(e.k)}"${i >= 30 ? ' hidden data-later' : ''}><td>${esc(new Date(e.t).toLocaleString('en-GB', { timeZone: tz, ...(oneDay ? {} : { day: 'numeric', month: 'short' }), hour: '2-digit', minute: '2-digit' }))}</td><td>${visitorChip(e.v)}</td><td>${e.cc ? `${flag(e.cc)} ${esc(e.cc)}` : '<span class="ad-dim">–</span>'}</td><td>${esc(e.dev || '')}</td><td class="ad-what">${activityText(e)}</td></tr>`).join('')}</tbody>
    </table></div>${S.recent.length > 30 ? `<div class="ad-more-row"><button type="button" class="ad-btn" data-later-btn>Show ${fmt(S.recent.length - 30)} more</button></div>` : ''}` : '<p class="ad-empty">No activity yet in this period. Visits, conversions and PDF downloads appear here as they happen.</p>';

  // Accounts (only when sign-up is on, or users exist from before).
  let accountsHtml = '';
  if (accounts || users.length) {
    const days = [];
    for (let i = 29; i >= 0; i--) days.push(store.dayOf(Date.now() - i * 864e5));
    const signupsBy = {};
    for (const u of users) { const d = store.dayOf(u.created); signupsBy[d] = (signupsBy[d] || 0) + 1; }
    const verified = users.filter((u) => u.verified).length, google = users.filter((u) => u.via === 'google').length;
    const list = [...users].sort((a, b) => (a.created < b.created ? 1 : -1));
    const SHOW = 2000, PAGE = 50;
    const rows = list.slice(0, SHOW).map((u, i) => `<tr${i >= PAGE ? ' hidden data-more' : ''} data-id="${esc(u.id)}" data-q="${esc(`${u.email} ${u.name} ${u.country}`.toLowerCase())}">
      <td class="ad-email">${esc(u.email)}${u.verified ? '<b class="ad-ok" title="Email confirmed">&#10003;</b>' : '<b class="ad-unv" title="Email not confirmed">not confirmed</b>'}${u.name ? `<span>${esc(u.name)}</span>` : ''}</td>
      <td><span class="ad-pill ad-pill-${u.via === 'google' ? 'g' : 'e'}">${u.via === 'google' ? 'Google' : 'Email'}</span></td>
      <td>${u.country ? `${flag(u.country)} ${esc(u.country)}` : '<span class="ad-dim">–</span>'}</td>
      <td>${esc(when(u.created, tz))}</td>
      <td>${esc(when(u.lastSeen, tz))}</td>
      <td class="ad-num">${fmt(u.downloads)}</td>
      <td><button type="button" class="ad-del" data-del aria-label="Delete ${esc(u.email)}">Delete</button></td>
    </tr>`).join('');
    accountsHtml = `<h2 class="ad-section">Accounts${accounts ? '' : ' <span class="ad-dim">(sign-up is switched off)</span>'}</h2>
  ${barChart('New sign-ups per day', days, days.map((d) => signupsBy[d] || 0), 'sign-up')}
  <section class="ad-card ad-users">
    <div class="ad-users-head">
      <h2>Users <span class="ad-dim">${fmt(users.length)} &middot; ${fmt(verified)} confirmed &middot; ${fmt(google)} via Google</span></h2>
      <div class="ad-users-tools"><input type="search" class="ad-search" placeholder="Search email, name or country" aria-label="Search users"><a class="ad-btn" href="${esc(path)}/users.csv">CSV</a></div>
    </div>
    ${users.length ? `<div class="ad-table-wrap"><table class="ad-table ad-users-table">
      <thead><tr><th>Email</th><th>Signed up with</th><th>Country</th><th>Joined</th><th>Last seen</th><th class="ad-num">Downloads</th><th><span class="sr">Actions</span></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>${list.length > PAGE ? '<div class="ad-more-row"><button type="button" class="ad-btn" data-more-btn>Show more users</button></div>' : ''}${list.length > SHOW ? `<p class="ad-dim ad-more">Showing the newest ${fmt(SHOW)}. Download the CSV for everyone.</p>` : ''}
    <p class="ad-dim ad-none" hidden>No user matches your search.</p>`
    : '<p class="ad-empty">No users yet. When someone signs up, they appear here.</p>'}
  </section>`;
  }

  return shell(`Dashboard | ${SITE}`, `<header class="ad-top">
  <div class="ad-brand">${MARK}<span>${esc(SITE)}</span><span class="ad-dim">Dashboard</span></div>
  <nav class="ad-range" aria-label="Period">${RANGE_LABELS.map(([k, l]) => `<a href="${esc(path)}?range=${k}"${k === range ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  <div class="ad-actions">
    <a class="ad-btn" href="${esc(path)}?range=${esc(range)}" title="Refresh">Refresh</a>
    <button type="button" class="ad-btn" data-logout>Sign out</button>
  </div>
</header>
<main class="ad-main" data-range="${esc(range)}">
  <div class="ad-tiles ad-tiles-5">
    ${tile('Visitors', fmt(S.visitors), S.visitors ? `${(S.views / S.visitors).toFixed(1)} pages each` : 'People, counted once a day')}
    ${tile('Page views', fmt(S.views), `${fmt(Object.values(S.sources).reduce((a, n) => a + n, 0))} visits started`)}
    ${tile('Conversions', fmt(conversions), `${fmt(ev('convert'))} converted &middot; ${fmt(ev('compress'))} compressed${ev('fail') ? ` &middot; <span class="ad-bad">${fmt(ev('fail'))} failed</span>` : ''}`)}
    ${tile('PDF downloads', fmt(ev('pdf') + ev('combine')), `${fmt(ev('pdf'))} from the editor &middot; ${fmt(ev('combine'))} combined`)}
    ${tile('<i class="ad-live-dot"></i>Right now', fmt(S.live), 'active in the last 5 minutes', 'ad-tile-live')}
  </div>
  ${chart}
  <div class="ad-grid2">
    ${rank('Where visitors come from', S.sources, { note: 'source of each visit', empty: 'No visits yet.' })}
    ${rank('Top pages', S.pages, { label: pageLabel, note: 'page views', empty: 'No page views yet.' })}
    ${rank('Conversions', S.pairs, { note: 'files converted or compressed', empty: 'No conversions yet.' })}
    ${rank('Landing pages', S.landings, { label: pageLabel, note: 'first page of a visit', empty: 'No visits yet.' })}
    ${rank('Countries', S.countries, { label: countryLabel, note: 'visitors', empty: 'No visitors yet.' })}
    ${rank('What people did', Object.fromEntries(Object.entries(S.events).map(([k, n]) => [EVENT_NAMES[k] || k, n])), { empty: 'No conversions or downloads yet.' })}
    ${rank('Devices', S.devices, { note: 'visitors', empty: 'No visitors yet.' })}
    ${rank('Other websites', S.refs, { note: 'links from other sites', empty: 'No visits from other websites yet.' })}
  </div>
  <section class="ad-card ad-users">
    <div class="ad-users-head"><h2>Live activity <span class="ad-dim">newest first${range === 'today' ? ' &middot; updates every minute' : ''}</span></h2></div>
    ${activity}
  </section>
  ${accountsHtml}
  <p class="ad-dim ad-foot">Times are ${esc(tz.replace('_', ' '))} time. Visitors are counted without cookies: the same person on the same device counts once a day. Visitors who block scripts are not counted.</p>
</main>`, path);
}

function csv(users) {
  const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
  const head = ['email', 'name', 'signed_up_with', 'email_confirmed', 'country', 'joined', 'last_seen', 'logins', 'pdf_downloads'];
  const lines = users.map((u) => [u.email, u.name, u.via, u.verified ? 'yes' : 'no', u.country, u.created, u.lastSeen, u.logins, u.downloads || 0].map(cell).join(','));
  return `${head.join(',')}\n${lines.join('\n')}\n`;
}

module.exports = { loginPage, dashboard, csv };
