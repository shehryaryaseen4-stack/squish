'use strict';
// Sign up / sign in, sessions, and the owner's dashboard. Switched on with ACCOUNTS=1.
//
//   /signup, /login, /account            pages (pages.js renders them)
//   /api/auth/signup|login|logout        JSON, email + password
//   /auth/google, /auth/google/callback  "Continue with Google" (needs GOOGLE_CLIENT_ID and
//                                        GOOGLE_CLIENT_SECRET)
//   /api/me, /api/me/event, /api/me/delete
//   ADMIN_PATH (default /admin)          the owner's dashboard: ADMIN_EMAIL + ADMIN_PASSWORD
//
// Sessions are signed cookies (HMAC), so nothing but the users file is stored on the server.

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const store = require('./store');
const admin = require('./admin');
const mail = require('./mail');
const analytics = require('./analytics');

const ON = process.env.ACCOUNTS === '1';
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE = !!(GOOGLE_ID && GOOGLE_SECRET);
const ADMIN_PATH = `/${(process.env.ADMIN_PATH || 'admin').replace(/^\/+|\/+$/g, '').toLowerCase()}`;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_ON = !!(ADMIN_EMAIL && ADMIN_PASSWORD);

const USER_COOKIE = 'ff_s';
const ADMIN_COOKIE = 'ff_a';
const GOOGLE_COOKIE = 'ff_g';
const USER_DAYS = 90;
const ADMIN_HOURS = 12;

// ---------------------------------------------------------------- cookies --
function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* bad cookie */ } }
  }
  return out;
}
const hmac = (s, key = '') => crypto.createHmac('sha256', store.secret() + key).update(s).digest('base64url');
function sign(value, maxAgeMs, key) {
  const body = `${Buffer.from(JSON.stringify(value)).toString('base64url')}.${Date.now() + maxAgeMs}`;
  return `${body}.${hmac(body, key)}`;
}
function unsign(token, key) {
  const [data, exp, mac] = String(token || '').split('.');
  if (!data || !exp || !mac) return null;
  const want = hmac(`${data}.${exp}`, key);
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  if (Date.now() > Number(exp)) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
}
const secureReq = (req) => req.secure || /^https:/.test(process.env.BASE_URL || '');
function setCookie(req, res, name, value, maxAgeMs) {
  res.cookie(name, value, { httpOnly: true, sameSite: 'lax', secure: secureReq(req), path: '/', maxAge: maxAgeMs });
}
const clearCookie = (req, res, name) => res.clearCookie(name, { httpOnly: true, sameSite: 'lax', secure: secureReq(req), path: '/' });

// Admin sessions are also keyed on the admin password, so changing it signs every admin out.
const adminKey = () => `admin:${crypto.createHash('sha256').update(ADMIN_EMAIL + ADMIN_PASSWORD).digest('hex')}`;

function currentUser(req) {
  const s = unsign(cookies(req)[USER_COOKIE]);
  const u = s && store.byId(s.u);
  if (u) store.seen(u);
  return u;
}
const isAdmin = (req) => ADMIN_ON && !!unsign(cookies(req)[ADMIN_COOKIE], adminKey());
const startSession = (req, res, u) => setCookie(req, res, USER_COOKIE, sign({ u: u.id }, USER_DAYS * 864e5), USER_DAYS * 864e5);
const country = (req) => String(req.get('cf-ipcountry') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2).replace(/^(XX|T1)$/, '');
// Only same-site relative paths, so ?next= can never send someone to another site.
const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[^\s\\]*$/.test(n) ? n : '');

// Blocks cross-site form posts: every write is JSON from our own pages.
function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* bad origin */ }
    if (host !== req.get('host')) return res.status(403).json({ error: 'Forbidden.' });
  }
  if (!req.is('application/json')) return res.status(415).json({ error: 'Send JSON.' });
  next();
}

// ------------------------------------------------------------ email codes --
// 6 digits, valid 15 minutes, 5 wrong tries, at most one email a minute and 5 an hour per address.
const CODE_MS = 15 * 60000;
const codeHash = (email, code) => crypto.createHmac('sha256', store.secret()).update(`${email}:${code}`).digest('hex');
async function issueCode(email, purpose, extra) {
  const old = store.getCode(email);
  const sent = ((old && old.sent) || []).filter((t) => t > Date.now() - 36e5);
  if (sent.length && Date.now() - sent[sent.length - 1] < 60000) return { status: 429, error: 'We just sent a code. Please wait a minute before asking for another.' };
  if (sent.length >= 5) return { status: 429, error: 'Too many codes for this email. Please try again in an hour.' };
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  try { await mail.sendCode(email, code, purpose); } catch (e) {
    console.error('Email failed:', e.message);
    return { status: 502, error: 'We could not send the email. Please check the address or try again in a minute.' };
  }
  store.setCode(email, { purpose, hash: codeHash(email, code), exp: Date.now() + CODE_MS, tries: 0, sent: [...sent, Date.now()], ...extra });
  return null;
}
function checkCode(email, purpose, code) {
  const rec = store.getCode(email);
  const bad = { error: 'That code is not right. Check the email and try again.' };
  if (!rec || rec.purpose !== purpose) return { error: 'This code has expired. Ask for a new one.' };
  if (rec.exp < Date.now()) return { error: 'This code has expired. Ask for a new one.' };
  if (rec.tries >= 5) return { error: 'Too many wrong codes. Ask for a new one.' };
  const want = Buffer.from(rec.hash), got = Buffer.from(codeHash(email, String(code || '').replace(/\D/g, '')));
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) { rec.tries += 1; store.setCode(email, rec); return bad; }
  return { rec };
}

// A real-looking hash for unknown emails, so they take as long to check as real ones.
const DUMMY_HASH = `s1$${'0'.repeat(32)}$${'0'.repeat(64)}`;

const noStore = (res) => res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });

function mount(app, { pages, baseOf }) {
  store.load();
  const json = express.json({ limit: '10kb' });
  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait 15 minutes and try again.' } });
  const html = (res, body) => noStore(res).type('html').send(body);

  // --------------------------------------------------------------- statistics --
  // The page-view beacon from public/script.js, and events such as an editor download. Always on
  // (it feeds the owner's dashboard); it has its own rate limit, separate from conversions.
  const beaconLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: false, legacyHeaders: false });
  const beaconJson = express.json({ limit: '2kb', type: () => true });
  app.post('/api/p', beaconLimit, beaconJson, (req, res) => {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const origin = req.get('origin');
    if (origin) { try { if (new URL(origin).host !== req.get('host')) return res.status(204).end(); } catch { return res.status(204).end(); } }
    if (b.e === 'pdf' || b.e === 'combine') analytics.event(req, b.e, { p: b.p, d: b.d });
    else analytics.pageview(req, b, req.get('host'));
    res.set('Cache-Control', 'no-store').status(204).end();
  });

  if (ON) mountAccounts();
  mountAdmin();
  return;

  function mountAccounts() {
  // ----------------------------------------------------------------- pages --
  app.get('/signup', (req, res) => {
    if (currentUser(req)) return res.redirect(safeNext(req.query.next) || '/account');
    html(res, pages.authPage('signup', baseOf(req), { google: GOOGLE, mail: mail.ON, next: safeNext(req.query.next) }));
  });
  app.get('/login', (req, res) => {
    if (currentUser(req)) return res.redirect(safeNext(req.query.next) || '/account');
    html(res, pages.authPage('login', baseOf(req), { google: GOOGLE, mail: mail.ON, next: safeNext(req.query.next), error: req.query.error ? 'Google sign-in did not work. Please try again or use your email.' : '' }));
  });
  app.get('/forgot', (req, res) => html(res, pages.authPage('forgot', baseOf(req), { mail: mail.ON, next: safeNext(req.query.next) })));
  app.get('/account', (req, res) => {
    const u = currentUser(req);
    if (!u) return res.redirect('/login?next=/account');
    html(res, pages.accountPage(baseOf(req), store.publicUser(u)));
  });

  // ------------------------------------------------------------------- API --
  app.post('/api/auth/signup', authLimit, json, sameOrigin, async (req, res) => {
    const email = store.normEmail(req.body.email);
    const pw = String(req.body.password || '');
    if (!store.okEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.', field: 'email' });
    if (pw.length < 8 || pw.length > 200) return res.status(400).json({ error: 'Use at least 8 characters for your password.', field: 'password' });
    const old = store.byEmail(email);
    if (old) {
      return res.status(409).json({ error: old.pw ? 'You already have an account with this email. Sign in instead.' : 'This email is linked to Google. Use Continue with Google.', field: 'email', login: true });
    }
    const hash = await store.hashPassword(pw);
    // With email set up, the account is only created once the emailed code is entered.
    if (mail.ON) {
      const err = await issueCode(email, 'signup', { pw: hash });
      if (err) return res.status(err.status).json({ error: err.error });
      return noStore(res).json({ verify: true, email });
    }
    const u = store.create({ email, name: String(req.body.name || '').trim(), pw: hash, via: 'email', country: country(req) });
    startSession(req, res, u);
    noStore(res).json({ user: store.publicUser(u) });
  });

  // Enter the emailed code: finishes a sign-up.
  app.post('/api/auth/verify', authLimit, json, sameOrigin, (req, res) => {
    const email = store.normEmail(req.body.email);
    const c = checkCode(email, 'signup', req.body.code);
    if (c.error) return res.status(400).json({ error: c.error });
    store.delCode(email);
    let u = store.byEmail(email);
    if (u) store.update(u, { verified: true }); // signed up twice in parallel, or via Google meanwhile
    else u = store.create({ email, pw: c.rec.pw, via: 'email', verified: true, country: country(req) });
    startSession(req, res, u);
    noStore(res).json({ user: store.publicUser(u) });
  });

  app.post('/api/auth/resend', authLimit, json, sameOrigin, async (req, res) => {
    const email = store.normEmail(req.body.email);
    const old = store.getCode(email);
    if (!old || old.purpose !== req.body.purpose) return res.status(400).json({ error: 'Start again: the code request has expired.' });
    const err = await issueCode(email, old.purpose, { pw: old.pw });
    if (err) return res.status(err.status).json({ error: err.error });
    noStore(res).json({ ok: true });
  });

  // Forgot password: email a code, then set a new password with it. The answer is the same
  // whether or not the email has an account, so nobody can find out who is signed up.
  app.post('/api/auth/forgot', authLimit, json, sameOrigin, async (req, res) => {
    const email = store.normEmail(req.body.email);
    if (!store.okEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!mail.ON) return res.status(503).json({ error: 'Password reset by email is not available yet. Please contact us.' });
    if (store.byEmail(email)) {
      const err = await issueCode(email, 'reset', {});
      if (err && err.status !== 429) return res.status(err.status).json({ error: err.error });
    }
    noStore(res).json({ verify: true, email });
  });
  app.post('/api/auth/reset', authLimit, json, sameOrigin, async (req, res) => {
    const email = store.normEmail(req.body.email);
    const pw = String(req.body.password || '');
    if (pw.length < 8 || pw.length > 200) return res.status(400).json({ error: 'Use at least 8 characters for your new password.', field: 'password' });
    const c = checkCode(email, 'reset', req.body.code);
    const u = store.byEmail(email);
    if (c.error || !u) return res.status(400).json({ error: c.error || 'That code is not right. Check the email and try again.' });
    store.delCode(email);
    store.update(u, { pw: await store.hashPassword(pw), verified: true });
    store.signedIn(u);
    startSession(req, res, u);
    noStore(res).json({ user: store.publicUser(u) });
  });

  app.post('/api/auth/login', authLimit, json, sameOrigin, async (req, res) => {
    const u = store.byEmail(req.body.email);
    const pw = String(req.body.password || '');
    // Check a password even for unknown emails, so the response time does not reveal who has an account.
    const ok = await store.checkPassword(pw, (u && u.pw) || DUMMY_HASH);
    if (!u || !ok) {
      if (u && !u.pw) return res.status(401).json({ error: 'This email signs in with Google. Use Continue with Google.' });
      return res.status(401).json({ error: 'Wrong email or password.' });
    }
    store.signedIn(u);
    startSession(req, res, u);
    noStore(res).json({ user: store.publicUser(u) });
  });

  app.post('/api/auth/logout', json, sameOrigin, (req, res) => { clearCookie(req, res, USER_COOKIE); noStore(res).json({ ok: true }); });

  app.get('/api/me', (req, res) => noStore(res).json({ user: store.publicUser(currentUser(req)), google: GOOGLE }));

  // download: an edited PDF was saved. wall: the sign-up box was shown before a download.
  app.post('/api/me/event', json, sameOrigin, (req, res) => {
    const type = req.body.type;
    if (type === 'wall') store.count('walls');
    else if (type === 'download') {
      const u = currentUser(req);
      if (!u) return res.status(401).json({ error: 'Sign in first.' });
      store.update(u, { downloads: (u.downloads || 0) + 1 });
      store.count('downloads');
    } else return res.status(400).json({ error: 'Unknown event.' });
    noStore(res).json({ ok: true });
  });

  app.post('/api/me/delete', json, sameOrigin, (req, res) => {
    const u = currentUser(req);
    if (!u) return res.status(401).json({ error: 'Sign in first.' });
    store.remove(u.id);
    clearCookie(req, res, USER_COOKIE);
    noStore(res).json({ ok: true });
  });

  app.get('/logout', (req, res) => { clearCookie(req, res, USER_COOKIE); res.redirect('/'); });

  // ---------------------------------------------------------------- Google --
  // The standard server-side OAuth flow. The editor opens it in a popup (?popup=1) so the
  // PDF being edited stays open; the last page then tells the editor and closes itself.
  if (GOOGLE) {
    const redirectUri = (req) => `${baseOf(req)}/auth/google/callback`;
    app.get('/auth/google', authLimit, (req, res) => {
      const state = crypto.randomBytes(16).toString('base64url');
      setCookie(req, res, GOOGLE_COOKIE, sign({ state, next: safeNext(req.query.next), popup: req.query.popup === '1' }, 10 * 60000), 10 * 60000);
      const q = new URLSearchParams({ client_id: GOOGLE_ID, redirect_uri: redirectUri(req), response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
      noStore(res).redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
    });
    app.get('/auth/google/callback', async (req, res) => {
      const st = unsign(cookies(req)[GOOGLE_COOKIE]);
      clearCookie(req, res, GOOGLE_COOKIE);
      const done = (ok) => (st && st.popup
        ? html(res, pages.authDonePage(ok))
        : res.redirect(ok ? (st && st.next) || '/account' : '/login?error=google'));
      if (!st || !req.query.code || req.query.state !== st.state) return done(false);
      try {
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code: String(req.query.code), client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, redirect_uri: redirectUri(req), grant_type: 'authorization_code' }),
        });
        const tok = await r.json();
        // The ID token came straight from Google over TLS, so its signature need not be checked again.
        const p = JSON.parse(Buffer.from(String(tok.id_token || '').split('.')[1] || '', 'base64url').toString() || '{}');
        if (!r.ok || p.aud !== GOOGLE_ID || !/^(https:\/\/)?accounts\.google\.com$/.test(p.iss) || !p.sub || !p.email || p.email_verified === false) return done(false);
        let u = store.byGoogle(p.sub) || store.byEmail(p.email);
        if (u) {
          store.update(u, { google: p.sub, name: u.name || p.name || '', verified: true });
          store.signedIn(u);
        } else {
          u = store.create({ email: p.email, name: p.name || '', google: p.sub, via: 'google', verified: true, country: country(req) });
        }
        startSession(req, res, u);
        done(true);
      } catch (e) {
        console.error('Google sign-in failed:', e.message);
        done(false);
      }
    });
  }

  }

  // ------------------------------------------------------------ dashboard --
  // Works with or without accounts: traffic, sources, pages, conversions and (with accounts) users.
  function mountAdmin() {
  if (!ADMIN_ON) return;
  const A = ADMIN_PATH;
  app.get(A, (req, res) => {
    if (!isAdmin(req)) return html(res, admin.loginPage(A));
    const range = analytics.RANGES[req.query.range] ? req.query.range : 'today';
    html(res, admin.dashboard({ users: store.users(), daily: store.daily(), path: A, store, stats: analytics.summary(range), range, accounts: ON, channelOf: analytics.channelOf }));
  });
  app.post(`${A}/login`, authLimit, json, sameOrigin, (req, res) => {
    const same = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(); return crypto.timingSafeEqual(x, crypto.createHash('sha256').update(String(b)).digest()); };
    const ok = same(String(req.body.email || '').trim().toLowerCase(), ADMIN_EMAIL) & same(req.body.password || '', ADMIN_PASSWORD);
    if (!ok) return res.status(401).json({ error: 'Wrong email or password.' });
    setCookie(req, res, ADMIN_COOKIE, sign({ a: 1 }, ADMIN_HOURS * 36e5, adminKey()), ADMIN_HOURS * 36e5);
    noStore(res).json({ ok: true });
  });
  app.post(`${A}/logout`, json, sameOrigin, (req, res) => { clearCookie(req, res, ADMIN_COOKIE); noStore(res).json({ ok: true }); });
  app.post(`${A}/delete`, json, sameOrigin, (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Sign in first.' });
    noStore(res).json({ ok: store.remove(String(req.body.id || '')) });
  });
  app.get(`${A}/users.csv`, (req, res) => {
    if (!isAdmin(req)) return res.redirect(A);
    noStore(res).type('text/csv').attachment(`flipitfree-users-${store.today()}.csv`).send(admin.csv(store.users()));
  });
  }
}

module.exports = { mount, ON, GOOGLE, ADMIN_PATH, MAIL: mail.ON, _internals: { sign, unsign, safeNext } };
