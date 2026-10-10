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
const people = (n) => `${fmt(n)} ${n === 1 ? 'person' : 'people'}`;
const visitorChip = (v) => `<span class="ad-vis" style="--h:${parseInt(String(v).slice(0, 4), 16) % 360}" title="Visitor code (changes every day)">#${esc(String(v).slice(0, 4))}</span>`;
// Daily counts over the last 30 days (accounts section).
function barChart(title, days, values, unit) {
  return bars({ title, sub: `${fmt(values.reduce((a, b) => a + b, 0))} in the last ${days.length} days`, values,
    tips: values.map((v, i) => `${shortDay(days[i])}: ${plural(v, unit)}`),
    ticks: days.map((d, i) => (i % 7 === days.length % 7 || i === days.length - 1 ? shortDay(d) : '')) });
}

// ------------------------------------------------------------ dashboard parts --
const ICON = {
  people: '<path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  convert: '<path d="M4 7h12l-3-3M20 17H8l3 3"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6m-3-3 3 3 3-3"/>',
  mobile: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  desktop: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  enter: '<path d="M10 17l5-5-5-5M15 12H3M21 3v18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const ico = (n, cls = 'ad-ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;
const regionName = (() => { try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); return (cc) => { try { return dn.of(cc); } catch { return cc; } }; } catch { return (cc) => cc; } })();
const countryLabel = (cc) => (cc === '??' || cc === '(other)' || !cc ? '<span class="ad-dim">Unknown</span>' : `<span class="ad-flag">${flag(cc)}</span>${esc(regionName(cc))}`);
const pct = (n, t) => (t ? Math.round((100 * n) / t) : 0);

// Readable page names: /png-to-webp -> "PNG to WEBP", /resume-maker -> "Resume maker".
const LANDING_NAMES = (() => { try { return new Map(require('../content/editor-landings').map((l) => [`/${l.slug}`, l.short])); } catch { return new Map(); } })();
function pageName(p) {
  if (p === '/') return 'Home page';
  if (LANDING_NAMES.has(p)) return LANDING_NAMES.get(p);
  const fixed = { '/edit-pdf': 'Edit PDF', '/converters': 'All converters', '/guides': 'Guides', '/about': 'About', '/privacy': 'Privacy policy', '/terms': 'Terms', '/contact': 'Contact', '/signup': 'Sign up', '/login': 'Sign in', '/account': 'Account' };
  if (fixed[p]) return fixed[p];
  let m = /^\/([a-z0-9-]+?)-to-([a-z0-9-]+)$/.exec(p);
  if (m) return `${m[1].toUpperCase()} to ${m[2].toUpperCase()}`;
  if ((m = /^\/compress-([a-z0-9-]+)$/.exec(p))) return `Compress ${m[1].toUpperCase()}`;
  if ((m = /^\/([a-z0-9-]+)-converter$/.exec(p))) return `${m[1].length <= 5 ? m[1].toUpperCase() : m[1][0].toUpperCase() + m[1].slice(1)} converter`;
  if ((m = /^\/guides\/([a-z0-9-]+)$/.exec(p))) return `Guide: ${m[1].replace(/-/g, ' ')}`;
  return p;
}
const pageLabel = (p) => (p.startsWith('/') && p !== '/(other)'
  ? `<a href="${esc(p)}" target="_blank" rel="noopener" title="Open ${esc(p)}">${esc(pageName(p))}</a><span class="ad-path">${esc(p)}</span>`
  : `<span class="ad-dim">Other pages</span>`);

// Channels share one fixed colour each (validated categorical order: blue, orange, aqua,
// yellow, magenta), used for the stacked bar, its legend and the dots in the source list.
const CHANNELS = [['Search', 'Search engines'], ['Direct', 'Direct'], ['Social', 'Social media'], ['AI', 'AI assistants'], ['Other sites', 'Other websites']];
const CH_HELP = { Search: 'Google, Bing and other search engines', Direct: 'typed the address, a bookmark, or an app such as WhatsApp', Social: 'Facebook, Reddit, YouTube and others', AI: 'ChatGPT, Gemini, Perplexity and others', 'Other sites': 'links on other websites' };
function channelBar(sources, channelOf) {
  const ch = {}; let total = 0;
  for (const [s, n] of Object.entries(sources)) { const c = channelOf(s); ch[c] = (ch[c] || 0) + n; total += n; }
  if (!total) return '';
  const segs = CHANNELS.filter(([k]) => ch[k]).map(([k, name], i) => `<span class="ad-seg ad-c${CHANNELS.findIndex(([x]) => x === k) + 1}" style="flex:${ch[k]}" title="${esc(name)}: ${fmt(ch[k])} (${pct(ch[k], total)}%)"></span>`).join('');
  const legend = CHANNELS.filter(([k]) => ch[k]).map(([k, name]) => `<li title="${esc(CH_HELP[k])}"><i class="ad-dot ad-c${CHANNELS.findIndex(([x]) => x === k) + 1}"></i>${esc(name)} <b>${pct(ch[k], total)}%</b> <span class="ad-dim">${fmt(ch[k])}</span></li>`).join('');
  return `<div class="ad-chbar" role="img" aria-label="Visits by channel">${segs}</div><ul class="ad-legend">${legend}</ul>`;
}

// A ranked list with a bar behind each row.
function rank(obj, { label = (k) => esc(k), limit = 8, empty = 'Nothing yet.', dot } = {}) {
  const all = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const total = all.reduce((a, [, n]) => a + n, 0);
  if (!all.length) return `<p class="ad-empty-s">${empty}</p>`;
  const max = all[0][1];
  const row = ([k, n], i) => `<li${i >= limit ? ' hidden data-extra' : ''}><span class="ad-rk-bar" style="width:${Math.max(2, (100 * n) / max).toFixed(1)}%"></span><span class="ad-rk-label">${dot ? `<i class="ad-dot ad-c${dot(k)}"></i>` : ''}${label(k)}</span><span class="ad-rk-n">${fmt(n)}<small>${pct(n, total)}%</small></span></li>`;
  return `<ol class="ad-rank">${all.slice(0, 50).map(row).join('')}</ol>${all.length > limit ? `<button type="button" class="ad-linkbtn" data-extra-btn>Show all ${fmt(Math.min(all.length, 50))}</button>` : ''}`;
}
const card = (title, help, body, cls = '') => `<section class="ad-card ad-box ${cls}"><header class="ad-box-head"><h2>${title}</h2>${help ? `<p>${help}</p>` : ''}</header>${body}</section>`;

// Compared with the period before: "▲ 12%" in green, "▼ 5%" in red.
function delta(now, before, label) {
  if (!before && !now) return `<span class="ad-dim">${label}: no data</span>`;
  if (!before) return `<span class="ad-up">New</span> <span class="ad-dim">${label} had none</span>`;
  const d = Math.round(((now - before) / before) * 100);
  return `<span class="${d > 0 ? 'ad-up' : d < 0 ? 'ad-down' : 'ad-dim'}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${Math.abs(d)}%</span> <span class="ad-dim">vs ${label} (${fmt(before)})</span>`;
}

// One line per visitor: where they came from, the pages they opened and what they did.
function journeys(recent, tz, oneDay, channelOf) {
  const by = new Map();
  for (const e of [...recent].reverse()) { // oldest first inside each journey
    if (!by.has(e.v)) by.set(e.v, { v: e.v, cc: e.cc, dev: e.dev, first: e.t, last: e.t, steps: [], src: '', did: 0 });
    const j = by.get(e.v);
    j.last = e.t; j.cc = j.cc || e.cc; j.dev = j.dev || e.dev;
    if (e.k === 'arrive' && !j.src) j.src = e.s === 'Other sites' && e.ref ? e.ref : e.s;
    if (['convert', 'compress', 'pdf', 'combine'].includes(e.k)) j.did += 1;
    j.steps.push(e);
  }
  const list = [...by.values()].sort((a, b) => b.last - a.last);
  if (!list.length) return '<p class="ad-empty">No visitors in this period yet. As soon as someone opens the site, they appear here with every page they open and every file they convert.</p>';
  const time = (t) => new Date(t).toLocaleString('en-GB', { timeZone: tz, ...(oneDay ? {} : { day: 'numeric', month: 'short' }), hour: '2-digit', minute: '2-digit' });
  const step = (e) => {
    switch (e.k) {
      case 'arrive': case 'view': return `<span class="ad-step">${ico('page', 'ad-ico-s')}${esc(pageName(e.p))}</span>`;
      case 'convert': return `<span class="ad-step ad-step-ok">${ico('convert', 'ad-ico-s')}Converted ${esc(e.d)}</span>`;
      case 'compress': return `<span class="ad-step ad-step-ok">${ico('convert', 'ad-ico-s')}Compressed ${esc(String(e.d).split(' → ')[0])}</span>`;
      case 'pdf': return `<span class="ad-step ad-step-pdf">${ico('pdf', 'ad-ico-s')}Downloaded a PDF</span>`;
      case 'combine': return `<span class="ad-step ad-step-pdf">${ico('pdf', 'ad-ico-s')}Made one PDF from ${esc(e.d || 'images')}</span>`;
      case 'fail': return `<span class="ad-step ad-step-bad">Failed: ${esc(e.d)}</span>`;
      default: return '';
    }
  };
  // collapse repeated views of the same page
  const steps = (j) => j.steps.filter((e, i, a) => !(i && (e.k === 'view' || e.k === 'arrive') && (a[i - 1].k === 'view' || a[i - 1].k === 'arrive') && a[i - 1].p === e.p));
  const devIcon = (d) => ico(d === 'Mobile' ? 'mobile' : d === 'Tablet' ? 'tablet' : 'desktop', 'ad-ico-s');
  return `<div class="ad-jfilter" role="group" aria-label="Show"><button type="button" aria-pressed="true" data-jf="all">Everyone <b>${fmt(list.length)}</b></button><button type="button" aria-pressed="false" data-jf="did">Converted or downloaded <b>${fmt(list.filter((j) => j.did).length)}</b></button></div>
  <ol class="ad-journeys">${list.map((j, i) => `<li class="ad-j${j.did ? ' ad-j-did' : ''}"${i >= 25 ? ' hidden data-jmore' : ''}>
    <div class="ad-j-who">${visitorChip(j.v)}<span class="ad-j-meta">${j.cc ? `<span class="ad-flag" title="${esc(regionName(j.cc))}">${flag(j.cc)}</span>` : ''}<span title="${esc(j.dev || '')}">${devIcon(j.dev)}</span><span class="ad-j-time">${esc(time(j.first))}${j.last - j.first > 60000 ? `–${esc(time(j.last).split(', ').pop())}` : ''}</span></span></div>
    <div class="ad-j-path">${j.src ? `<span class="ad-src"><i class="ad-dot ad-c${CHANNELS.findIndex(([x]) => x === channelOf(j.src)) + 1 || 5}"></i>${esc(j.src)}</span><span class="ad-arrow">→</span>` : ''}${steps(j).map(step).join('<span class="ad-arrow">→</span>')}</div>
  </li>`).join('')}</ol>${list.length > 25 ? `<button type="button" class="ad-linkbtn ad-jmore-btn" data-jmore-btn>Show ${fmt(list.length - 25)} more visitors</button>` : ''}`;
}

const RANGE_LABELS = [['today', 'Today', 'today', 'yesterday'], ['yesterday', 'Yesterday', 'yesterday', 'the day before'], ['7d', '7 days', 'the last 7 days', 'the 7 days before'], ['30d', '30 days', 'the last 30 days', 'the 30 days before'], ['90d', '90 days', 'the last 90 days', 'the 90 days before']];

function dashboard({ users, daily, path, store, stats, range = 'today', accounts = false, channelOf = () => 'Other sites' }) {
  const tz = store.TZ;
  const S = stats, P = S.prev || { views: 0, visitors: 0, actors: 0, events: {} };
  const ev = (k, o = S.events) => o[k] || 0;
  const conversions = ev('convert') + ev('compress'), pConversions = ev('convert', P.events) + ev('compress', P.events);
  const pdfs = ev('pdf') + ev('combine'), pPdfs = ev('pdf', P.events) + ev('combine', P.events);
  const oneDay = S.days.length === 1;
  const [, , rangeText, prevText] = RANGE_LABELS.find(([k]) => k === range);
  const tile = (icon, label, value, sub, help, cls = '') => `<div class="ad-card ad-tile ${cls}" title="${esc(help)}"><span class="ad-label">${ico(icon)}${label}</span><strong>${value}</strong><span class="ad-sub">${sub}</span></div>`;

  // Busiest hour / day and the top source, page and conversion, in plain words.
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
  const busy = oneDay ? S.hours.reduce((m, [, vs], h) => (vs > m[1] ? [h, vs] : m), [-1, 0]) : S.byDay.reduce((m, [d, vs]) => (vs > m[1] ? [d, vs] : m), ['', 0]);
  const tSrc = top(S.sources), tPage = top(S.pages), tPair = top(S.pairs);
  const hh = (h) => `${String(h).padStart(2, '0')}:00`;
  const lines = [];
  if (!S.visitors) lines.push(`No visitors yet ${range === 'today' ? 'today' : `in ${rangeText}`}. Numbers appear here as soon as someone opens the site.`);
  else {
    lines.push(`<b>${people(S.visitors)}</b> visited ${range === 'today' ? 'today so far' : rangeText} and opened <b>${plural(S.views, 'page')}</b>.`);
    if (tSrc) lines.push(`Most came from <b>${esc(tSrc[0])}</b> (${pct(tSrc[1], Object.values(S.sources).reduce((a, n) => a + n, 0))}% of visits).`);
    if (busy[1]) lines.push(oneDay ? `The busiest hour was <b>${hh(busy[0])}–${hh((busy[0] + 1) % 24)}</b> with ${plural(busy[1], 'visitor')}.` : `The busiest day was <b>${shortDay(busy[0])}</b> with ${plural(busy[1], 'visitor')}.`);
    if (tPage) lines.push(`The most visited page was <b>${esc(pageName(tPage[0]))}</b>.`);
    lines.push(S.actors ? `<b>${people(S.actors)}</b> (${pct(S.actors, S.visitors)}% of visitors) converted a file or downloaded a PDF${tPair ? `; the favourite was <b>${esc(tPair[0])}</b>` : ''}.` : 'Nobody has converted a file or downloaded a PDF yet.');
  }

  const chart = oneDay
    ? bars({ title: range === 'today' ? 'Visitors per hour, today' : 'Visitors per hour, yesterday', sub: `${plural(S.visitors, 'visitor')} &middot; ${plural(S.views, 'page view')}`,
      values: S.hours.map(([, vs]) => vs),
      tips: S.hours.map(([vw, vs], h) => `${hh(h)}–${hh((h + 1) % 24)}: ${plural(vs, 'visitor')}, ${plural(vw, 'page view')}`),
      ticks: S.hours.map((_, h) => (h % 3 === 0 ? hh(h) : '')), hi: range === 'today' ? S.hourNow : -1 })
    : bars({ title: 'Visitors per day', sub: `${plural(S.visitors, 'visitor')} &middot; ${plural(S.views, 'page view')}`,
      values: S.byDay.map(([, vs]) => vs),
      tips: S.byDay.map(([d, vs, vw, act]) => `${shortDay(d)}: ${plural(vs, 'visitor')}, ${plural(vw, 'page view')}, ${plural(act, 'conversion')}`),
      ticks: S.byDay.map(([d], i) => (S.byDay.length <= 8 || i % Math.ceil(S.byDay.length / 6) === 0 || i === S.byDay.length - 1 ? shortDay(d) : '')) });

  const devTotal = Object.values(S.devices).reduce((a, n) => a + n, 0);
  const devices = devTotal ? `<div class="ad-devs">${['Mobile', 'Desktop', 'Tablet'].map((d) => `<div class="ad-dev">${ico(d.toLowerCase(), 'ad-ico-l')}<b>${pct(S.devices[d] || 0, devTotal)}%</b><span>${d}</span><span class="ad-dim">${fmt(S.devices[d] || 0)}</span></div>`).join('')}</div>` : '<p class="ad-empty-s">No visitors yet.</p>';
  const did = [['convert', 'Files converted', 'convert'], ['compress', 'Files compressed', 'convert'], ['pdf', 'PDFs downloaded from the editor', 'pdf'], ['combine', 'Images saved as one PDF', 'pdf'], ['fail', 'Conversions that failed', 'spark']]
    .map(([k, name, ic]) => `<li class="${k === 'fail' && ev(k) ? 'ad-bad' : ''}">${ico(ic, 'ad-ico-s')}<span>${name}</span><b>${fmt(ev(k))}</b></li>`).join('');

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
    accountsHtml = `<h2 class="ad-section" id="accounts">Accounts${accounts ? '' : ' <span class="ad-dim">(sign-up is switched off)</span>'}</h2>
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

  const updated = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  return shell(`Dashboard | ${SITE}`, `<header class="ad-top">
  <div class="ad-brand">${MARK}<span>${esc(SITE)}</span><span class="ad-dim">Dashboard</span></div>
  <nav class="ad-range" aria-label="Period">${RANGE_LABELS.map(([k, l]) => `<a href="${esc(path)}?range=${k}"${k === range ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  <div class="ad-actions">
    <a class="ad-btn ad-btn-quiet" href="${esc(path)}?range=${esc(range)}" title="Load the latest numbers">${ico('clock', 'ad-ico-s')}Updated ${esc(updated)}</a>
    <button type="button" class="ad-btn" data-logout>Sign out</button>
  </div>
</header>
<main class="ad-main" data-range="${esc(range)}">
  <section class="ad-card ad-summary">
    <div class="ad-live" title="People with the site open in the last 5 minutes"><i class="ad-live-dot"></i><b>${fmt(S.live)}</b> on the site right now</div>
    <h1>${range === 'today' ? 'Today at a glance' : `${RANGE_LABELS.find(([k]) => k === range)[1]} at a glance`}</h1>
    <p>${lines.join(' ')}</p>
  </section>
  <div class="ad-tiles">
    ${tile('people', 'Visitors', fmt(S.visitors), delta(S.visitors, P.visitors, prevText), 'Different people who opened the site. Each person counts once a day.')}
    ${tile('eye', 'Page views', fmt(S.views), delta(S.views, P.views, prevText), 'Every page opened, including several pages by the same person.')}
    ${tile('spark', 'Used a tool', `${fmt(S.actors)}<small>${S.visitors ? ` ${pct(S.actors, S.visitors)}%` : ''}</small>`, delta(S.actors, P.actors, prevText), 'Visitors who converted or compressed a file or downloaded a PDF. The % is the share of all visitors.')}
    ${tile('convert', 'Files converted', fmt(conversions), delta(conversions, pConversions, prevText), 'Files converted plus files compressed.')}
    ${tile('pdf', 'PDF downloads', fmt(pdfs), delta(pdfs, pPdfs, prevText), 'PDFs downloaded from the editor plus images saved as one PDF.')}
  </div>
  ${chart}
  <div class="ad-grid2">
    ${card('How people find you', 'Where each visit started.', `${channelBar(S.sources, channelOf)}${rank(S.sources, { empty: 'No visits yet.', dot: (k) => CHANNELS.findIndex(([x]) => x === channelOf(k)) + 1 })}`)}
    ${card('Most visited pages', 'All page views, by page.', rank(S.pages, { label: pageLabel, empty: 'No page views yet.' }))}
    ${card('First pages people see', 'The page each visit started on: your entrances from Google and other sites.', rank(S.landings, { label: pageLabel, empty: 'No visits yet.' }))}
    ${card('What people convert', 'Conversions and compressions, by file type.', rank(S.pairs, { empty: 'No conversions yet.' }))}
    ${card('Countries', 'Where your visitors are.', rank(S.countries, { label: countryLabel, empty: 'No visitors yet.' }))}
    <div class="ad-stack">
      ${card('Devices', 'What people use to open the site.', devices)}
      ${card('What people did', '', `<ul class="ad-did">${did}</ul>`)}
    </div>
    ${Object.keys(S.refs).length ? card('Websites linking to you', 'Other websites that sent visitors.', rank(S.refs, { label: (k) => `<a href="https://${esc(k)}" target="_blank" rel="noopener nofollow">${esc(k)}</a>` }), 'ad-span2') : ''}
  </div>
  ${card(`Visitor journeys <span class="ad-dim">${range === 'today' ? 'live, newest first' : 'newest first'}</span>`, 'Each line is one visitor: where they came from, the pages they opened and what they did. Visitors are shown as a short code, never by name or IP address.', journeys(S.recent, tz, oneDay, channelOf), 'ad-journey-card')}
  ${accountsHtml}
  <p class="ad-foot">Times are ${esc(tz.replace('_', ' '))} time. ${range === 'today' ? 'This page updates itself every minute. ' : ''}Visitors are counted without cookies: the same person on the same device counts once a day. Search engine robots and visitors who block scripts are not counted.</p>
</main>`, path);
}

function csv(users) {
  const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
  const head = ['email', 'name', 'signed_up_with', 'email_confirmed', 'country', 'joined', 'last_seen', 'logins', 'pdf_downloads'];
  const lines = users.map((u) => [u.email, u.name, u.via, u.verified ? 'yes' : 'no', u.country, u.created, u.lastSeen, u.logins, u.downloads || 0].map(cell).join(','));
  return `${head.join(',')}\n${lines.join('\n')}\n`;
}

module.exports = { loginPage, dashboard, csv };
