'use strict';
// Site statistics for the owner's dashboard, without cookies or third parties.
//
// Pages send a small beacon when they load (public/script.js -> POST /api/p); conversions are
// counted by the server when a file is converted. A visitor is a hash of IP + browser + a salt
// that changes every day, so a person counts once per day, cannot be followed from one day to
// the next, and no IP address is ever stored. Country comes from Cloudflare (CF-IPCountry).
//
// Stored per day (DATA_DIR/analytics.json, 120 days kept): views, visitors, per-hour views and
// visitors, and counts by page, landing page, source, referring site, country, device,
// conversion pair and event. Plus the last 500 notable events (arrivals, conversions, PDF
// downloads, failures) for the live activity list.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');

const FILE = path.join(store.DATA_DIR, 'analytics.json');
const KEEP_DAYS = 120;
const MAP_CAP = 400; // distinct keys per map per day; the rest are counted as "(other)"
const RECENT = 500;
const LIVE_MS = 5 * 60000;

const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: store.TZ, hour: '2-digit', hourCycle: 'h23' });
const hourOf = (t) => Number(hourFmt.format(new Date(t))) % 24;

let db = null;
let timer = null;
const live = new Map(); // visitor -> last seen (memory only)
const sets = new Map(); // `${day}` and `${day}:${hour}` -> Set of visitors (memory, rebuilt from file)

function load() {
  if (db) return db;
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    db = {};
  }
  db.days ||= {}; db.recent ||= []; db.salt ||= {};
  for (const [day, b] of Object.entries(db.days)) {
    if (b.vis) sets.set(day, new Set(b.vis));
    if (b.hvis) b.hvis.forEach((arr, h) => arr && sets.set(`${day}:${h}`, new Set(arr)));
  }
  return db;
}
function saveNow() {
  clearTimeout(timer); timer = null;
  const today = store.today();
  // Visitor hashes are only needed while the day can still change.
  for (const [day, b] of Object.entries(db.days)) {
    if (day === today) {
      b.vis = [...(sets.get(day) || [])];
      b.hvis = Array.from({ length: 24 }, (_, h) => [...(sets.get(`${day}:${h}`) || [])]);
    } else { delete b.vis; delete b.hvis; sets.delete(day); for (let h = 0; h < 24; h++) sets.delete(`${day}:${h}`); }
  }
  const cut = store.dayOf(Date.now() - KEEP_DAYS * 864e5);
  for (const day of Object.keys(db.days)) if (day < cut) delete db.days[day];
  fs.mkdirSync(store.DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
const save = () => { if (!timer) timer = setTimeout(saveNow, 5000); };
process.once('exit', () => { if (timer && db) saveNow(); });
for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { if (timer && db) saveNow(); });

// ---------------------------------------------------------------- visitors --
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|curl|wget|python|httpclient|axios|node-fetch|go-http/i;
function ipOf(req) { return String(req.get('cf-connecting-ip') || req.ip || ''); }
function visitorOf(req) {
  const d = load();
  const today = store.today();
  if (d.salt.day !== today) { d.salt = { day: today, value: crypto.randomBytes(16).toString('hex') }; save(); }
  return crypto.createHash('sha256').update(`${d.salt.value}|${ipOf(req)}|${req.get('user-agent') || ''}`).digest('hex').slice(0, 10);
}
function deviceOf(ua) {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return 'Tablet';
  if (/Mobi|iPhone|iPod|Android|Opera Mini|IEMobile/i.test(ua)) return 'Mobile';
  return 'Desktop';
}
const countryOf = (req) => String(req.get('cf-ipcountry') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2).replace(/^(XX|T1)$/, '');

// Where a visit came from: utm_source wins, then the referring site, else Direct.
const SOURCES = [
  [/(^|\.)gemini\.google\./, 'Gemini'], [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/, 'ChatGPT'], [/(^|\.)perplexity\.ai$/, 'Perplexity'],
  [/(^|\.)copilot\.microsoft\.com$/, 'Copilot'], [/(^|\.)claude\.ai$/, 'Claude'],
  [/(^|\.)google\.[a-z.]+$/, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/(^|\.)yahoo\.[a-z.]+$/, 'Yahoo'], [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)yandex\.[a-z.]+$/, 'Yandex'], [/(^|\.)baidu\.com$/, 'Baidu'], [/(^|\.)ecosia\.org$/, 'Ecosia'], [/(^|\.)brave\.com$/, 'Brave Search'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'], [/(^|\.)instagram\.com$/, 'Instagram'], [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X (Twitter)'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'], [/(^|\.)reddit\.com$/, 'Reddit'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)pinterest\.[a-z.]+$/, 'Pinterest'], [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'], [/(^|\.)quora\.com$/, 'Quora'], [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)github\.com$/, 'GitHub'],
];
function sourceOf(refHost, utm) {
  if (utm) return String(utm).toLowerCase().replace(/[^a-z0-9._ -]/g, '').slice(0, 30) || 'Direct';
  if (!refHost) return 'Direct';
  for (const [re, name] of SOURCES) if (re.test(refHost)) return name;
  return 'Other sites';
}
const cleanPath = (p) => {
  const s = String(p || '/').split(/[?#]/)[0].toLowerCase();
  return /^\/[a-z0-9\-/.]{0,100}$/.test(s) ? s.replace(/(.)\/+$/, '$1') : '/(other)';
};

// ----------------------------------------------------------------- counting --
function bucket(day) {
  const d = load();
  return (d.days[day] ||= { views: 0, visitors: 0, hours: Array.from({ length: 24 }, () => [0, 0]), pages: {}, landings: {}, sources: {}, refs: {}, countries: {}, devices: {}, pairs: {}, events: {} });
}
function bump(map, key, n = 1) {
  if (!key) return;
  if (!(key in map) && Object.keys(map).length >= MAP_CAP) key = '(other)';
  map[key] = (map[key] || 0) + n;
}
// Counts a visitor once per day and once per hour; returns true the first time today.
function seen(day, hour, v, b) {
  let s = sets.get(day); if (!s) sets.set(day, (s = new Set()));
  let hs = sets.get(`${day}:${hour}`); if (!hs) sets.set(`${day}:${hour}`, (hs = new Set()));
  if (!hs.has(v)) { hs.add(v); b.hours[hour][1] += 1; }
  if (s.has(v)) return false;
  s.add(v); b.visitors += 1;
  return true;
}
function remember(ev) {
  const d = load();
  d.recent.push(ev);
  if (d.recent.length > RECENT) d.recent.splice(0, d.recent.length - RECENT);
}

// A page view from the beacon: { p: path, r: referrer, u: utm_source }
function pageview(req, body, host) {
  const ua = req.get('user-agent') || '';
  if (BOT.test(ua)) return false;
  const now = Date.now(), day = store.today(), hour = hourOf(now);
  const v = visitorOf(req), b = bucket(day), p = cleanPath(body.p);
  let refHost = '';
  try { refHost = body.r ? new URL(String(body.r)).hostname.replace(/^www\./, '').toLowerCase() : ''; } catch { /* bad referrer */ }
  const internal = refHost && host && refHost === String(host).replace(/^www\./, '').split(':')[0].toLowerCase();
  b.views += 1; b.hours[hour][0] += 1;
  bump(b.pages, p);
  const first = seen(day, hour, v, b);
  const cc = countryOf(req), dev = deviceOf(ua);
  if (first) { bump(b.countries, cc || '??'); bump(b.devices, dev); }
  // An arrival from outside (or typed in / bookmarked) is a new visit: count its source and landing page.
  if (!internal) {
    const src = sourceOf(refHost, body.u);
    bump(b.sources, src);
    bump(b.landings, p);
    if (refHost && src === 'Other sites') bump(b.refs, refHost);
    remember({ t: now, v, cc, dev, k: 'arrive', p, s: src, ref: refHost || '' });
  }
  live.set(v, now);
  save();
  return true;
}

// Things people do: 'convert' / 'compress' (server side), 'pdf' (editor download), 'combine'
// (several images saved as one PDF), 'fail' (a conversion that did not work).
function event(req, kind, detail = {}) {
  const ua = req.get('user-agent') || '';
  if (BOT.test(ua) && kind !== 'convert' && kind !== 'compress') return;
  const now = Date.now(), day = store.today(), b = bucket(day), v = visitorOf(req);
  bump(b.events, kind);
  if (detail.pair) bump(b.pairs, String(detail.pair).slice(0, 60));
  remember({ t: now, v, cc: countryOf(req), dev: deviceOf(ua), k: kind, p: detail.p ? cleanPath(detail.p) : '', d: String(detail.pair || detail.d || '').slice(0, 80) });
  live.set(v, now);
  save();
}

// ------------------------------------------------------------------ reading --
function liveCount() {
  const cut = Date.now() - LIVE_MS;
  for (const [v, t] of live) if (t < cut) live.delete(v);
  return live.size;
}
const RANGES = { today: [0, 0], yesterday: [1, 1], '7d': [6, 0], '30d': [29, 0], '90d': [89, 0] };
function summary(range) {
  const d = load();
  const [from, to] = RANGES[range] || RANGES.today;
  const days = [];
  for (let i = from; i >= to; i--) days.push(store.dayOf(Date.now() - i * 864e5));
  const sum = { views: 0, visitors: 0, hours: Array.from({ length: 24 }, () => [0, 0]), byDay: [], pages: {}, landings: {}, sources: {}, refs: {}, countries: {}, devices: {}, pairs: {}, events: {} };
  for (const day of days) {
    const b = d.days[day];
    sum.byDay.push([day, b ? b.visitors : 0, b ? b.views : 0, b ? Object.values(b.events).reduce((a, n) => a + n, 0) : 0]);
    if (!b) continue;
    sum.views += b.views; sum.visitors += b.visitors;
    b.hours.forEach(([vw, vs], h) => { sum.hours[h][0] += vw; sum.hours[h][1] += vs; });
    for (const k of ['pages', 'landings', 'sources', 'refs', 'countries', 'devices', 'pairs', 'events']) for (const [key, n] of Object.entries(b[k] || {})) sum[k][key] = (sum[k][key] || 0) + n;
  }
  const since = Date.parse(`${days[0]}T00:00:00Z`) - 14 * 36e5; // day starts in local time: allow for the time zone
  sum.recent = d.recent.filter((e) => e.t >= since).slice(-150).reverse();
  sum.live = liveCount();
  sum.days = days;
  sum.hourNow = hourOf(Date.now());
  return sum;
}

module.exports = { pageview, event, summary, liveCount, sourceOf, deviceOf, RANGES, flush: () => { if (timer && db) saveNow(); }, _reset: () => { db = null; live.clear(); sets.clear(); } };
