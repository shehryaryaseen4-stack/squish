'use strict';
// User accounts, kept in one JSON file (DATA_DIR/accounts.json). That is plenty for tens of
// thousands of users and needs no database server. In Docker, DATA_DIR is a volume so the file
// survives rebuilds (see deploy/update.sh).
//
// A user: { id, email, name, pw ('s1$salt$hash', absent for Google-only users), google (Google
// account id), via ('email' | 'google'), country (from Cloudflare), created, lastSeen, logins,
// downloads }. Times are ISO strings.
// daily: { 'YYYY-MM-DD': { downloads, walls, logins } } for the owner's dashboard. A "wall" is
// the sign-up box shown to a visitor who pressed Download in the PDF editor.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'accounts.json');

let db = null;
let timer = null;

function load() {
  if (db) return db;
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    db = { users: [], daily: {} };
  }
  db.users ||= []; db.daily ||= {};
  // Signs the session cookies. SESSION_SECRET wins; otherwise one is made once and kept here.
  if (!db.secret) { db.secret = crypto.randomBytes(32).toString('hex'); saveNow(); }
  return db;
}

function saveNow() {
  clearTimeout(timer); timer = null;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE); // atomic: a crash never leaves half a file
}
const save = () => { if (!timer) timer = setTimeout(saveNow, 500); };
const flush = () => { if (timer) saveNow(); };
process.once('exit', flush);
for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { flush(); process.exit(0); });

const secret = () => process.env.SESSION_SECRET || load().secret;
const now = () => new Date().toISOString();
// Days on the dashboard follow the owner's time zone (DASHBOARD_TZ, default Pakistan time).
const TZ = process.env.DASHBOARD_TZ || 'Asia/Karachi';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayOf = (iso) => dayFmt.format(new Date(iso));
const today = () => dayOf(Date.now());

const normEmail = (e) => String(e || '').trim().toLowerCase();
const okEmail = (e) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return new Promise((res, rej) => crypto.scrypt(pw, salt, 32, (err, key) => (err ? rej(err) : res(`s1$${salt.toString('hex')}$${key.toString('hex')}`))));
}
function checkPassword(pw, stored) {
  const [v, salt, hash] = String(stored || '').split('$');
  if (v !== 's1' || !salt || !hash) return Promise.resolve(false);
  return new Promise((res) => crypto.scrypt(pw, Buffer.from(salt, 'hex'), 32, (err, key) => res(!err && crypto.timingSafeEqual(key, Buffer.from(hash, 'hex')))));
}

const byId = (id) => load().users.find((u) => u.id === id) || null;
const byEmail = (email) => load().users.find((u) => u.email === normEmail(email)) || null;
const byGoogle = (sub) => load().users.find((u) => u.google === sub) || null;

function create({ email, name = '', pw, google, via, country }) {
  const u = { id: crypto.randomBytes(9).toString('base64url'), email: normEmail(email), name: String(name).slice(0, 80), via, country: country || '', created: now(), lastSeen: now(), logins: 1, downloads: 0 };
  if (pw) u.pw = pw;
  if (google) u.google = google;
  load().users.push(u); save();
  return u;
}
function update(u, fields) { Object.assign(u, fields); save(); return u; }
function remove(id) {
  const d = load(); const n = d.users.length;
  d.users = d.users.filter((u) => u.id !== id);
  if (d.users.length !== n) save();
  return d.users.length !== n;
}
function signedIn(u) { u.lastSeen = now(); u.logins = (u.logins || 0) + 1; count('logins'); save(); }
function seen(u) { // at most one write a minute per user
  if (Date.now() - Date.parse(u.lastSeen || 0) > 60000) { u.lastSeen = now(); save(); }
}
function count(field, n = 1) {
  const day = (load().daily[today()] ||= {});
  day[field] = (day[field] || 0) + n; save();
}

const users = () => load().users;
const daily = () => load().daily;
// Public fields only (never the password hash).
const publicUser = (u) => u && { email: u.email, name: u.name, via: u.via, created: u.created, downloads: u.downloads || 0 };

module.exports = {
  load, flush, secret, normEmail, okEmail, hashPassword, checkPassword,
  byId, byEmail, byGoogle, create, update, remove, signedIn, seen, count, users, daily, publicUser, today, dayOf, TZ, DATA_DIR,
  _reset: () => { db = null; clearTimeout(timer); timer = null; },
};
