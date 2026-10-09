'use strict';
// The owner's dashboard (ADMIN_PATH): sign-ups, PDF editor downloads and the list of users.
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

// One series of daily counts as a bar chart: thin rounded bars, a recessive grid with three
// labelled lines, and a tooltip per bar (bars carry data-tip; admin.js shows it on hover).
function barChart(title, days, values, unit) {
  const W = 960, H = 190, L = 34, B = 22, T = 10;
  const max = Math.max(4, ...values);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const bw = (W - L) / days.length;
  const grid = [0, top / 2, top].map((v) => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(Math.round(v))}</text>`).join('');
  const bars = values.map((v, i) => {
    const x = L + i * bw + 2, w = Math.max(2, bw - 4), h = Math.max(0, y(0) - y(v));
    const label = new Date(`${days[i]}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const tip = `${label}: ${fmt(v)} ${unit}${v === 1 ? '' : 's'}`;
    const r = Math.min(4, w / 2, h);
    const bar = h > 0 ? `<path class="ad-bar" d="M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z"/>` : '';
    return `<g class="ad-col" data-tip="${esc(tip)}"><rect class="ad-hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}"/>${bar}</g>`;
  }).join('');
  const ticks = days.map((d, i) => (i % 7 === days.length % 7 || i === days.length - 1
    ? `<text x="${i === days.length - 1 ? W : L + i * bw + bw / 2}" y="${H - 6}" text-anchor="${i === days.length - 1 ? 'end' : 'middle'}">${new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</text>` : '')).join('');
  const total = values.reduce((a, b) => a + b, 0);
  return `<section class="ad-card ad-chart">
    <div class="ad-chart-head"><h2>${esc(title)}</h2><span class="ad-dim">${fmt(total)} in the last ${days.length} days</span></div>
    <div class="ad-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}, last ${days.length} days"><g class="ad-grid">${grid}</g>${bars}<g class="ad-ticks">${ticks}</g></svg><div class="ad-tip" hidden></div></div>
  </section>`;
}

function dashboard({ users, daily, path, store }) {
  const tz = store.TZ;
  const today = store.today();
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(store.dayOf(Date.now() - i * 864e5));
  const signupsBy = {};
  for (const u of users) { const d = store.dayOf(u.created); signupsBy[d] = (signupsBy[d] || 0) + 1; }
  const signups = days.map((d) => signupsBy[d] || 0);
  const downloads = days.map((d) => (daily[d] && daily[d].downloads) || 0);
  const walls = days.reduce((a, d) => a + ((daily[d] && daily[d].walls) || 0), 0);
  const sum = (a, n = a.length) => a.slice(-n).reduce((x, y) => x + y, 0);
  const totalDownloads = users.reduce((a, u) => a + (u.downloads || 0), 0);
  const google = users.filter((u) => u.via === 'google').length;
  const verified = users.filter((u) => u.verified).length;
  // Of the visitors who met the sign-up box in the editor (30 days), how many signed up.
  const conv = walls ? `${Math.round((100 * Math.min(sum(signups), walls)) / walls)}%` : '–';

  const tile = (label, value, sub) => `<div class="ad-card ad-tile"><span class="ad-label">${label}</span><strong>${value}</strong><span class="ad-dim">${sub}</span></div>`;
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

  return shell(`Dashboard | ${SITE}`, `<header class="ad-top">
  <div class="ad-brand">${MARK}<span>${esc(SITE)}</span><span class="ad-dim">Dashboard</span></div>
  <div class="ad-actions">
    <a class="ad-btn" href="${esc(path)}/users.csv">Download CSV</a>
    <button type="button" class="ad-btn" data-logout>Sign out</button>
  </div>
</header>
<main class="ad-main">
  <div class="ad-tiles">
    ${tile('Users', fmt(users.length), `${fmt(verified)} confirmed &middot; ${fmt(google)} via Google`)}
    ${tile('New today', fmt(signupsBy[today] || 0), `${fmt(sum(signups, 7))} in the last 7 days`)}
    ${tile('PDF downloads today', fmt((daily[today] && daily[today].downloads) || 0), `${fmt(totalDownloads)} by all users so far`)}
    ${tile('Sign-up rate', conv, `of ${fmt(walls)} who saw the sign-up box (30 days)`)}
  </div>
  ${barChart('New sign-ups per day', days, signups, 'sign-up')}
  ${barChart('PDF editor downloads per day', days, downloads, 'download')}
  <section class="ad-card ad-users">
    <div class="ad-users-head">
      <h2>Users <span class="ad-dim">${fmt(users.length)}</span></h2>
      <input type="search" class="ad-search" placeholder="Search email, name or country" aria-label="Search users">
    </div>
    ${users.length ? `<div class="ad-table-wrap"><table class="ad-table">
      <thead><tr><th>Email</th><th>Signed up with</th><th>Country</th><th>Joined</th><th>Last seen</th><th class="ad-num">Downloads</th><th><span class="sr">Actions</span></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>${list.length > PAGE ? `<div class="ad-more-row"><button type="button" class="ad-btn" data-more-btn>Show more users</button></div>` : ''}${list.length > SHOW ? `<p class="ad-dim ad-more">Showing the newest ${fmt(SHOW)}. Download the CSV for everyone.</p>` : ''}
    <p class="ad-dim ad-none" hidden>No user matches your search.</p>`
    : '<p class="ad-empty">No users yet. When someone signs up, they appear here.</p>'}
  </section>
  <p class="ad-dim ad-foot">Times are ${esc(tz.replace('_', ' '))} time.</p>
</main>`, path);
}

function csv(users) {
  const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
  const head = ['email', 'name', 'signed_up_with', 'email_confirmed', 'country', 'joined', 'last_seen', 'logins', 'pdf_downloads'];
  const lines = users.map((u) => [u.email, u.name, u.via, u.verified ? 'yes' : 'no', u.country, u.created, u.lastSeen, u.logins, u.downloads || 0].map(cell).join(','));
  return `${head.join(',')}\n${lines.join('\n')}\n`;
}

module.exports = { loginPage, dashboard, csv };
