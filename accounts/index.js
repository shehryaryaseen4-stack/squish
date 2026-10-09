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

const noStore = (res) => res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });

function mount(app, { pages, baseOf }) {
  if (!ON) return;
  store.load();
  const json = express.json({ limit: '10kb' });
  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait 15 minutes and try again.' } });
  const html = (res, body) => noStore(res).type('html').send(body);

  // ----------------------------------------------------------------- pages --
  app.get('/signup', (req, res) => {
    if (currentUser(req)) return res.redirect(safeNext(req.query.next) || '/account');
    html(res, pages.authPage('signup', baseOf(req), { google: GOOGLE, next: safeNext(req.query.next) }));
  });
  app.get('/login', (req, res) => {
    if (currentUser(req)) return res.redirect(safeNext(req.query.next) || '/account');
    html(res, pages.authPage('login', baseOf(req), { google: GOOGLE, next: safeNext(req.query.next), error: req.query.error ? 'Google sign-in did not work. Please try again or use your email.' : '' }));
  });
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
    const u = store.create({ email, name: String(req.body.name || '').trim(), pw: await store.hashPassword(pw), via: 'email', country: country(req) });
    startSession(req, res, u);
    noStore(res).json({ user: store.publicUser(u) });
  });

  app.post('/api/auth/login', authLimit, json, sameOrigin, async (req, res) => {
    const u = store.byEmail(req.body.email);
    const pw = String(req.body.password || '');
    // Check a password even for unknown emails, so the response time does not reveal who has an account.
    const ok = await store.checkPassword(pw, u ? u.pw : 's1$00$00');
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
          store.update(u, { google: p.sub, name: u.name || p.name || '' });
          store.signedIn(u);
        } else {
          u = store.create({ email: p.email, name: p.name || '', google: p.sub, via: 'google', country: country(req) });
        }
        startSession(req, res, u);
        done(true);
      } catch (e) {
        console.error('Google sign-in failed:', e.message);
        done(false);
      }
    });
  }

  // ------------------------------------------------------------ dashboard --
  if (!ADMIN_ON) return;
  const A = ADMIN_PATH;
  app.get(A, (req, res) => html(res, isAdmin(req) ? admin.dashboard({ users: store.users(), daily: store.daily(), path: A, store }) : admin.loginPage(A)));
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

module.exports = { mount, ON, GOOGLE, ADMIN_PATH, _internals: { sign, unsign, safeNext } };
