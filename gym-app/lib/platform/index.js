'use strict';

// The multi-gym platform: the sales website, sign-ups with a free trial,
// Paddle billing, offline licences for the Windows app, and the owner panel
// where the platform owner sees and controls every gym.
//
//   /                    sales website (site/)
//   /g/<gym>/…           one gym: member app, dashboard, kiosk, entry screen
//   /owner               the platform owner's panel
//   /iclock/…, /hik/…    attendance machines, routed to their gym by serial / key
//   /paddle/webhook      payments from Paddle

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStore, hashPin, checkPin } = require('../store');
const { createApi } = require('../api');
const { gymHandler, corsFor, send, sendError, readText, readBody, csp, TYPES } = require('../web');
const { HttpError, fail } = require('../validate');
const { COUNTRIES, countryOf, businessFor, cleanStart } = require('./countries');
const lic = require('./license');
const paddle = require('./paddle');
const { clientIp } = require('../net');

const SITE = path.join(__dirname, '..', '..', 'site');
const DAY = 864e5;
const SESSION_MS = 14 * DAY;
const RESERVED = new Set(['admin', 'api', 'www', 'owner', 'app', 'g', 'support', 'help', 'billing', 'signup', 'login', 'static', 'assets', 'demo', 'paddle']);
const SITE_PAGES = {
  '/': 'index.html', '/signup': 'signup.html', '/billing': 'billing.html', '/thanks': 'thanks.html', '/download': 'download.html',
  '/terms': 'terms.html', '/privacy': 'privacy.html', '/refund': 'refund.html', '/owner': 'owner.html', '/login': 'login.html',
};

const DEFAULT_SETTINGS = {
  productName: 'GymDesk',
  companyName: '',
  supportEmail: '',
  supportWhatsapp: '',
  publicUrl: '',
  trialDays: 14,
  graceDays: 3,
  prices: {
    monthly: { amount: 19, currency: 'USD', paddlePriceId: '' },
    yearly: { amount: 190, currency: 'USD', paddlePriceId: '' },
    license: { amount: 299, currency: 'USD', paddlePriceId: '' },
  },
  paddle: { environment: 'sandbox', clientToken: '', webhookSecret: '' },
  licenseMaxDevices: 2,
  downloads: { windows: '', android: '', androidDemo: '' },
};

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newId = (prefix) => `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);

function merge(defaults, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value === undefined ? defaults : value;
  const out = { ...defaults };
  for (const [k, v] of Object.entries(value)) out[k] = defaults && typeof defaults[k] === 'object' && !Array.isArray(defaults[k]) ? merge(defaults[k], v) : v;
  return out;
}

function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const t = Date.now();
    const list = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (list.length >= limit) fail('Too many attempts. Please wait a few minutes and try again.', 429);
    list.push(t);
    hits.set(key, list);
  };
}

function createPlatform({ dataDir, corsOrigins, machinePort = process.env.MACHINE_PORT, reminderTimer = true, now = () => new Date(), ownerEmail = process.env.OWNER_EMAIL, ownerPassword = process.env.OWNER_PASSWORD, log = console.log } = {}) {
  fs.mkdirSync(path.join(dataDir, 'gyms'), { recursive: true });
  const file = path.join(dataDir, 'platform.json');
  const P = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  P.settings = merge(DEFAULT_SETTINGS, P.settings);
  for (const key of ['gyms', 'licenses', 'events', 'processed', 'unclaimed']) P[key] ||= [];
  P.machines ||= { sn: {}, hik: {} };
  if (!P.admin && ownerEmail && ownerPassword) P.admin = { email: ownerEmail.toLowerCase(), password: hashPin(ownerPassword), sessions: [] };

  // The key that signs Windows app licences. The public half goes into the app.
  const privFile = path.join(dataDir, 'license-private.pem');
  const pubFile = path.join(dataDir, 'license-public.pem');
  if (!fs.existsSync(privFile)) {
    const pair = lic.makeKeyPair();
    fs.writeFileSync(privFile, pair.privateKey, { mode: 0o600 });
    fs.writeFileSync(pubFile, pair.publicKey);
  }
  const privateKey = fs.readFileSync(privFile, 'utf8');
  const publicKey = fs.readFileSync(pubFile, 'utf8');

  // With no owner account yet, the first visit to /owner needs this code from the server log.
  let setupCode = null;
  if (!P.admin) {
    setupCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    log(`Owner panel setup code: ${setupCode}  (open /owner to create the owner account)`);
  }

  function save() {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(P, null, 1));
    fs.renameSync(tmp, file);
  }
  save();

  const nowMs = () => new Date(now()).getTime();
  const iso = (ms = nowMs()) => new Date(ms).toISOString();
  function event(type, text, extra = {}) {
    P.events.unshift({ at: iso(), type, text, ...extra });
    P.events.length = Math.min(P.events.length, 500);
  }

  const signupLimit = rateLimiter(5, 60 * 60 * 1000);
  const ownerLimit = rateLimiter(8, 10 * 60 * 1000);
  const licenseLimit = rateLimiter(30, 60 * 60 * 1000);
  const cors = corsFor(corsOrigins);

  // ---- gyms ------------------------------------------------------------------

  const live = new Map();
  const gymDir = (g) => path.join(dataDir, 'gyms', g.id);
  const gymBySlug = (slug) => P.gyms.find((g) => g.slug === slug);
  const gymById = (id) => P.gyms.find((g) => g.id === id) || fail('Gym not found', 404);

  function runtime(g) {
    if (live.has(g.id)) return live.get(g.id);
    const store = createStore({ file: path.join(gymDir(g), 'db.json'), seed: 'empty', staffPin: null, now });
    const api = createApi(store, { now });
    const prefix = `/g/${g.slug}`;
    const serve = gymHandler({ store, api, prefix, machines: false, machinePort, gate: (pathname, req) => gate(g, pathname, req) });
    const rt = { store, api, serve, prefix };
    live.set(g.id, rt);
    return rt;
  }

  function baseUrl(req) {
    if (P.settings.publicUrl) return P.settings.publicUrl.replace(/\/$/, '');
    const proto = String(req?.headers['x-forwarded-proto'] || '').split(',')[0] || (req?.socket?.encrypted ? 'https' : 'http');
    return `${proto}://${req?.headers.host || 'localhost'}`;
  }
  const billingLink = (g, req) => `${baseUrl(req)}/billing?gym=${encodeURIComponent(g.slug)}`;

  function accessOf(g) {
    const t = nowMs();
    if (g.status === 'suspended') return { ok: false, state: 'suspended', title: 'Account paused', message: 'This gym account is paused. Please contact support.' };
    if (g.plan === 'free') return { ok: true, state: 'free', daysLeft: null };
    const paid = Date.parse(g.paidUntil || '') || 0;
    const until = Math.max(Date.parse(g.trialEnds || '') || 0, paid);
    const daysLeft = Math.ceil((until - t) / DAY);
    if (t <= until) return { ok: true, state: paid >= t ? 'paid' : 'trial', until: iso(until), daysLeft };
    if (t <= until + P.settings.graceDays * DAY) return { ok: true, state: 'grace', until: iso(until), daysLeft };
    return {
      ok: false,
      state: 'expired',
      until: iso(until),
      daysLeft,
      title: paid ? 'Subscription ended' : 'Free trial ended',
      message: `${paid ? 'Your subscription has ended' : 'Your free trial has ended'}. Subscribe to keep using the app. All your members and records are safe.`,
    };
  }

  // Pages still open for a locked gym; every other API call gets 402.
  function gate(g, pathname, req) {
    if (!pathname.startsWith('/api/') || pathname === '/api/gym' || pathname === '/api/admin/login') return;
    const a = accessOf(g);
    if (!a.ok) throw Object.assign(new HttpError(402, a.message), { extra: { locked: true, title: a.title, billingUrl: a.state === 'expired' ? billingLink(g, req) : null } });
  }

  function gymRow(g) {
    const a = accessOf(g);
    let members = null;
    if (live.has(g.id)) members = live.get(g.id).store.db.members.filter((m) => !m.left).length;
    return { ...g, access: a, members, url: `/g/${g.slug}/admin` };
  }

  function validSlug(slug) {
    const s = str(slug, 40).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/.test(s)) fail('The web address can use 4 to 32 letters, numbers and dashes');
    if (RESERVED.has(s) || gymBySlug(s)) fail('That web address is taken. Try another one.', 409);
    return s;
  }

  function slugFrom(name) {
    const base = str(name, 60).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'gym';
    let s = base.length < 4 ? `${base}-gym` : base;
    for (let i = 2; RESERVED.has(s) || gymBySlug(s); i++) s = `${base}-${i}`;
    return s;
  }

  function createGym(body, { source = 'signup', plan = 'trial' } = {}) {
    const name = str(body.gymName, 60) || fail('Enter the gym name');
    const email = str(body.email, 120).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Enter a valid email address');
    const pin = String(body.ownerPin || '');
    if (!/^\d{4,8}$/.test(pin)) fail('The owner PIN must be 4 to 8 digits');
    const slug = body.slug ? validSlug(body.slug) : slugFrom(name);
    const c = countryOf(body.country);
    const g = {
      id: newId('gym'), slug, name, email, phone: str(body.phone, 30), country: c.code, createdAt: iso(), source,
      plan, status: 'active', trialEnds: plan === 'trial' ? iso(nowMs() + P.settings.trialDays * DAY) : null, paidUntil: null, note: '', paddle: null,
    };
    const store = createStore({
      file: path.join(gymDir(g), 'db.json'),
      seed: body.sample ? 'demo' : 'empty',
      ownerPin: pin,
      staffPin: null,
      now,
      business: businessFor(c.code, { name, email, phone: g.phone, timeZone: str(body.timeZone, 60) }),
    });
    if (!body.sample) cleanStart(store.db, c.code, body.monthlyFee);
    store.save();
    P.gyms.push(g);
    event('signup', `${name} joined (${c.name})`, { gymId: g.id });
    save();
    return g;
  }

  function reindexMachines(g) {
    const rt = runtime(g);
    for (const map of [P.machines.sn, P.machines.hik]) for (const [k, v] of Object.entries(map)) if (v === g.id) delete map[k];
    for (const dv of rt.store.db.devices) {
      if (dv.protocol === 'zk' && dv.sn && !P.machines.sn[dv.sn.toUpperCase()]) P.machines.sn[dv.sn.toUpperCase()] = g.id;
      if (dv.protocol === 'hik' && dv.key) P.machines.hik[dv.key] = g.id;
    }
    save();
  }

  // ---- licences ----------------------------------------------------------------

  function issueLicense({ email, name = '', source, txnId = null, note = '' }) {
    const l = {
      id: newId('lic'), key: lic.newKey(), email: str(email, 120).toLowerCase(), name: str(name, 80), status: 'active',
      createdAt: iso(), source, txnId, note: str(note, 200), maxDevices: P.settings.licenseMaxDevices, activations: [],
    };
    P.licenses.unshift(l);
    event('license', `Licence ${l.key} for ${l.email || 'a buyer'} (${source})`);
    return l;
  }
  const findLicense = (key) => P.licenses.find((l) => lic.normalKey(l.key) === lic.normalKey(key));

  // ---- Paddle --------------------------------------------------------------------

  function planOfPrice(priceId) {
    const pr = P.settings.prices;
    if (priceId && priceId === pr.yearly.paddlePriceId) return 'yearly';
    if (priceId && priceId === pr.monthly.paddlePriceId) return 'monthly';
    if (priceId && priceId === pr.license.paddlePriceId) return 'license';
    return null;
  }

  function onPaddle(evt) {
    if (evt.event_id && P.processed.includes(evt.event_id)) return;
    const data = evt.data || {};
    const custom = data.custom_data || {};
    const type = String(evt.event_type || '');
    if (type.startsWith('subscription.')) {
      const g = (custom.gymId && P.gyms.find((x) => x.id === custom.gymId)) || P.gyms.find((x) => x.paddle?.subscriptionId === data.id);
      if (g) {
        const priceId = data.items?.[0]?.price?.id;
        g.paddle = { customerId: data.customer_id, subscriptionId: data.id, status: data.status, priceId };
        const plan = planOfPrice(priceId);
        if (plan === 'monthly' || plan === 'yearly') g.plan = plan;
        const ends = data.current_billing_period?.ends_at;
        if (ends && ['active', 'trialing', 'past_due'].includes(data.status) && Date.parse(ends) > (Date.parse(g.paidUntil || '') || 0)) g.paidUntil = new Date(ends).toISOString();
        event('payment', `${g.name}: subscription ${data.status}`, { gymId: g.id });
      }
    }
    if (type === 'transaction.completed') {
      const items = data.items || [];
      const licenseItems = items.filter((i) => planOfPrice(i.price?.id || i.price_id) === 'license');
      for (const item of licenseItems) {
        for (let n = 0; n < Math.min(Number(item.quantity) || 1, 20); n++) issueLicense({ email: custom.email, name: custom.name, source: 'paddle', txnId: data.id });
      }
      const g = custom.gymId && P.gyms.find((x) => x.id === custom.gymId);
      if (g) {
        const ends = data.billing_period?.ends_at;
        if (ends && Date.parse(ends) > (Date.parse(g.paidUntil || '') || 0)) g.paidUntil = new Date(ends).toISOString();
        event('payment', `${g.name}: payment received`, { gymId: g.id, txnId: data.id });
      }
    }
    if (evt.event_id) {
      P.processed.unshift(evt.event_id);
      P.processed.length = Math.min(P.processed.length, 2000);
    }
    save();
  }

  // ---- owner (platform admin) ------------------------------------------------------

  function ownerSession(req) {
    const token = bearer(req);
    const s = token && P.admin?.sessions.find((x) => x.hash === sha(token) && x.expires > Date.now());
    if (!s) fail('Please sign in again', 401);
  }

  function openOwnerSession() {
    const token = crypto.randomBytes(24).toString('hex');
    P.admin.sessions = P.admin.sessions.filter((s) => s.expires > Date.now()).slice(-20);
    P.admin.sessions.push({ hash: sha(token), expires: Date.now() + SESSION_MS });
    save();
    return token;
  }

  function publicConfig() {
    const s = P.settings;
    return {
      productName: s.productName, companyName: s.companyName, supportEmail: s.supportEmail, supportWhatsapp: s.supportWhatsapp,
      trialDays: s.trialDays,
      prices: Object.fromEntries(Object.entries(s.prices).map(([k, v]) => [k, { amount: v.amount, currency: v.currency, priceId: v.paddlePriceId || null }])),
      paddle: s.paddle.clientToken ? { environment: s.paddle.environment, clientToken: s.paddle.clientToken } : null,
      downloads: s.downloads,
      countries: COUNTRIES.map(({ code, name, currency, timeZone, monthly, symbol }) => ({ code, name, currency, symbol, timeZone, monthly })),
    };
  }

  function overview() {
    const t = nowMs();
    const rows = P.gyms.map((g) => ({ g, a: accessOf(g) }));
    const pr = P.settings.prices;
    const paying = rows.filter((r) => r.a.state === 'paid' || r.a.state === 'grace');
    return {
      gyms: P.gyms.length,
      paying: paying.length,
      trials: rows.filter((r) => r.a.state === 'trial').length,
      locked: rows.filter((r) => !r.a.ok).length,
      newThisMonth: P.gyms.filter((g) => g.createdAt.slice(0, 7) === iso(t).slice(0, 7)).length,
      mrr: Math.round(paying.reduce((a, r) => a + (r.g.plan === 'yearly' ? pr.yearly.amount / 12 : r.g.plan === 'monthly' ? pr.monthly.amount : 0), 0)),
      currency: pr.monthly.currency,
      licenses: P.licenses.filter((l) => l.status === 'active').length,
      events: P.events.slice(0, 30),
      setup: {
        paddle: Boolean(P.settings.paddle.clientToken && P.settings.paddle.webhookSecret && pr.monthly.paddlePriceId),
        contact: Boolean(P.settings.supportEmail || P.settings.supportWhatsapp),
        company: Boolean(P.settings.companyName),
        downloads: Boolean(P.settings.downloads.windows || P.settings.downloads.android),
      },
    };
  }

  function updateSettings(body) {
    const s = P.settings;
    const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
    s.productName = str(body.productName, 40) || s.productName;
    for (const k of ['companyName', 'supportEmail', 'supportWhatsapp', 'publicUrl']) if (body[k] !== undefined) s[k] = str(body[k], 200);
    if (s.publicUrl && !/^https?:\/\//.test(s.publicUrl)) fail('The website address must start with https://');
    s.trialDays = Math.min(90, Math.round(num(body.trialDays, s.trialDays)));
    s.graceDays = Math.min(30, Math.round(num(body.graceDays, s.graceDays)));
    s.licenseMaxDevices = Math.max(1, Math.min(20, Math.round(num(body.licenseMaxDevices, s.licenseMaxDevices))));
    for (const k of ['monthly', 'yearly', 'license']) {
      const b = body.prices?.[k];
      if (!b) continue;
      s.prices[k] = { amount: num(b.amount, s.prices[k].amount), currency: str(b.currency, 3).toUpperCase() || s.prices[k].currency, paddlePriceId: str(b.paddlePriceId, 60) };
    }
    if (body.paddle) {
      s.paddle.environment = body.paddle.environment === 'production' ? 'production' : 'sandbox';
      s.paddle.clientToken = str(body.paddle.clientToken, 100);
      // Blank keeps the saved secret, so it is never sent back to the browser.
      if (body.paddle.webhookSecret) s.paddle.webhookSecret = str(body.paddle.webhookSecret, 200);
    }
    if (body.downloads) for (const k of ['windows', 'android', 'androidDemo']) s.downloads[k] = str(body.downloads[k], 300);
    save();
  }

  const settingsOut = () => ({ ...P.settings, paddle: { ...P.settings.paddle, webhookSecret: '', hasWebhookSecret: Boolean(P.settings.paddle.webhookSecret) } });

  async function ownerApi(req, m, p, body) {
    let match;
    if (m === 'GET' && p === '/api/owner/status') return { setup: !P.admin, email: P.admin?.email || null };
    if (m === 'POST' && p === '/api/owner/setup') {
      if (P.admin) fail('The owner account already exists', 409);
      ownerLimit(clientIp(req));
      if (str(body.code).toUpperCase() !== setupCode) fail('Wrong setup code. It is printed in the server log.', 401);
      const email = str(body.email, 120).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Enter a valid email address');
      if (String(body.password || '').length < 10) fail('Use a password of at least 10 characters');
      P.admin = { email, password: hashPin(body.password), sessions: [] };
      setupCode = null;
      return { token: openOwnerSession() };
    }
    if (m === 'POST' && p === '/api/owner/login') {
      ownerLimit(clientIp(req));
      if (!P.admin || str(body.email).toLowerCase() !== P.admin.email || !checkPin(String(body.password || ''), P.admin.password)) fail('Wrong email or password', 401);
      return { token: openOwnerSession() };
    }
    ownerSession(req);
    if (m === 'POST' && p === '/api/owner/logout') {
      P.admin.sessions = P.admin.sessions.filter((s) => s.hash !== sha(bearer(req)));
      save();
      return { ok: true };
    }
    if (m === 'POST' && p === '/api/owner/password') {
      if (!checkPin(String(body.current || ''), P.admin.password)) fail('Current password is wrong', 401);
      if (String(body.password || '').length < 10) fail('Use a password of at least 10 characters');
      P.admin.password = hashPin(body.password);
      P.admin.sessions = [];
      save();
      return { token: openOwnerSession() };
    }
    if (m === 'GET' && p === '/api/owner/overview') return overview();
    if (m === 'GET' && p === '/api/owner/settings') return { settings: settingsOut(), publicKey, webhookUrl: `${baseUrl(req)}/paddle/webhook` };
    if (m === 'PUT' && p === '/api/owner/settings') { updateSettings(body); return { settings: settingsOut() }; }
    if (m === 'GET' && p === '/api/owner/gyms') return P.gyms.map(gymRow).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (m === 'POST' && p === '/api/owner/gyms') {
      const plan = ['trial', 'free', 'monthly', 'yearly'].includes(body.plan) ? body.plan : 'trial';
      const g = createGym(body, { source: 'owner', plan });
      if (plan === 'monthly' || plan === 'yearly') g.paidUntil = iso(nowMs() + (plan === 'yearly' ? 365 : 30) * DAY);
      save();
      return gymRow(g);
    }
    if ((match = p.match(/^\/api\/owner\/gyms\/([\w-]+)(\/login)?$/))) {
      const g = gymById(match[1]);
      if (m === 'POST' && match[2]) {
        event('support', `Owner opened ${g.name}`, { gymId: g.id });
        save();
        return { token: runtime(g).api.ownerToken(), slug: g.slug, url: `/g/${g.slug}/admin` };
      }
      if (m === 'PUT') {
        const a = body.action;
        if (a === 'extend') {
          const days = Math.round(Number(body.days));
          if (!(days >= 1 && days <= 3650)) fail('Days must be 1 to 3650');
          const from = Math.max(nowMs(), Date.parse(g.paidUntil || '') || 0);
          g.paidUntil = iso(from + days * DAY);
          if (body.plan && ['monthly', 'yearly'].includes(body.plan)) g.plan = body.plan;
          else if (g.plan === 'trial') g.plan = days >= 300 ? 'yearly' : 'monthly';
          event('payment', `${g.name}: +${days} days by owner${body.note ? ` (${str(body.note, 80)})` : ''}`, { gymId: g.id });
        } else if (a === 'suspend' || a === 'unsuspend') {
          g.status = a === 'suspend' ? 'suspended' : 'active';
          event('status', `${g.name} ${a === 'suspend' ? 'paused' : 'switched back on'}`, { gymId: g.id });
        } else if (a === 'plan') {
          if (!['trial', 'free', 'monthly', 'yearly'].includes(body.plan)) fail('Unknown plan');
          g.plan = body.plan;
        } else if (a === 'note') {
          g.note = str(body.note, 500);
        } else if (a === 'details') {
          g.email = str(body.email, 120).toLowerCase() || g.email;
          g.phone = str(body.phone, 30);
        } else if (a === 'pin') {
          if (!/^\d{4,8}$/.test(String(body.pin || ''))) fail('The PIN must be 4 to 8 digits');
          const rt = runtime(g);
          rt.store.db.admin.ownerPin = hashPin(String(body.pin));
          rt.store.db.admin.sessions = rt.store.db.admin.sessions.filter((s) => s.role !== 'owner');
          rt.store.save();
          event('support', `${g.name}: owner PIN reset`, { gymId: g.id });
        } else fail('Unknown action');
        save();
        return gymRow(g);
      }
      if (m === 'DELETE') {
        if (str(body.confirm) !== g.slug) fail(`Type ${g.slug} to confirm`);
        live.delete(g.id);
        const trash = path.join(dataDir, 'deleted');
        fs.mkdirSync(trash, { recursive: true });
        if (fs.existsSync(gymDir(g))) fs.renameSync(gymDir(g), path.join(trash, `${g.id}-${Date.now()}`));
        P.gyms = P.gyms.filter((x) => x.id !== g.id);
        for (const map of [P.machines.sn, P.machines.hik]) for (const [k, v] of Object.entries(map)) if (v === g.id) delete map[k];
        event('status', `${g.name} deleted (kept in the deleted folder)`);
        save();
        return { ok: true };
      }
    }
    if (m === 'GET' && p === '/api/owner/licenses') return P.licenses;
    if (m === 'POST' && p === '/api/owner/licenses') {
      const l = issueLicense({ email: body.email, name: body.name, source: 'manual', note: body.note });
      save();
      return l;
    }
    if ((match = p.match(/^\/api\/owner\/licenses\/([\w-]+)$/)) && m === 'PUT') {
      const l = P.licenses.find((x) => x.id === match[1]) || fail('Licence not found', 404);
      if (body.action === 'revoke') l.status = 'revoked';
      else if (body.action === 'restore') l.status = 'active';
      else if (body.action === 'reset') l.activations = [];
      else if (body.action === 'devices') l.maxDevices = Math.max(1, Math.min(50, Math.round(Number(body.maxDevices) || 1)));
      else fail('Unknown action');
      event('license', `Licence ${l.key}: ${body.action}`);
      save();
      return l;
    }
    if (m === 'GET' && p === '/api/owner/machines') return { unclaimed: P.unclaimed };
    fail('Not found', 404);
  }

  // ---- public API ------------------------------------------------------------------

  async function publicApi(req, m, p, body) {
    if (m === 'GET' && p === '/api/platform/config') return publicConfig();
    if (m === 'POST' && p === '/api/platform/signup') {
      signupLimit(clientIp(req));
      const g = createGym(body);
      return { slug: g.slug, adminUrl: `/g/${g.slug}/admin`, memberUrl: `/g/${g.slug}/`, trialEnds: g.trialEnds };
    }
    if (m === 'GET' && p === '/api/platform/slug') {
      const q = new URL(req.url, 'http://x').searchParams;
      try { validSlug(q.get('slug')); return { ok: true }; } catch (e) { return { ok: false, error: e.message, suggestion: slugFrom(q.get('slug') || 'gym') }; }
    }
    if (m === 'GET' && p === '/api/platform/gym') {
      const g = gymBySlug(str(new URL(req.url, 'http://x').searchParams.get('gym'), 40)) || fail('No gym with that address', 404);
      const a = accessOf(g);
      return { id: g.id, slug: g.slug, name: g.name, email: g.email, plan: g.plan, access: a, subscribed: Boolean(g.paddle && ['active', 'trialing', 'past_due'].includes(g.paddle.status)) };
    }
    if (m === 'GET' && p === '/api/platform/licence') {
      // The thank-you page asks for the key bought in this checkout.
      const txn = str(new URL(req.url, 'http://x').searchParams.get('txn'), 80);
      if (!/^txn_\w+$/.test(txn)) fail('Unknown payment');
      const keys = P.licenses.filter((l) => l.txnId === txn).map((l) => l.key);
      return { ready: keys.length > 0, keys };
    }
    if (m === 'GET' && p === '/api/license/public-key') return { publicKey };
    if (m === 'POST' && p === '/api/license/activate') {
      licenseLimit(clientIp(req));
      const l = findLicense(body.key);
      if (!l) fail('This licence key was not found. Check it and try again.', 404);
      if (l.status !== 'active') fail('This licence key has been switched off. Please contact support.', 403);
      const device = str(body.device, 80) || fail('Missing device');
      let act = l.activations.find((x) => x.device === device);
      if (!act) {
        if (l.activations.length >= l.maxDevices) fail(`This key is already used on ${l.maxDevices} computer${l.maxDevices === 1 ? '' : 's'}. Contact support to move it.`, 409);
        act = { device, name: str(body.deviceName, 80), firstSeen: iso() };
        l.activations.push(act);
        event('license', `Licence ${l.key} activated on ${act.name || 'a computer'}`);
      }
      act.lastSeen = iso();
      save();
      return { token: lic.signToken(privateKey, { lid: l.id, key: l.key, device, email: l.email, iat: iso() }), publicKey };
    }
    if (m === 'POST' && p === '/api/license/check') {
      const payload = lic.verifyToken(publicKey, body.token);
      const l = payload && P.licenses.find((x) => x.id === payload.lid);
      if (!l) return { status: 'unknown' };
      const act = l.activations.find((x) => x.device === payload.device);
      if (act) { act.lastSeen = iso(); save(); }
      return { status: l.status === 'active' && act ? 'active' : l.status === 'active' ? 'moved' : 'revoked' };
    }
    fail('Not found', 404);
  }

  // ---- machines ----------------------------------------------------------------------

  function noteUnclaimed(sn, ip) {
    if (!sn) return;
    const row = P.unclaimed.find((x) => x.sn === sn) || (P.unclaimed.unshift({ sn, firstSeen: iso() }), P.unclaimed[0]);
    row.lastSeen = iso();
    row.ip = ip;
    P.unclaimed.length = Math.min(P.unclaimed.length, 100);
  }

  async function machine(req, res, url, pathname) {
    const ip = clientIp(req);
    let g = null;
    let text = '';
    if (pathname.startsWith('/iclock/')) {
      const sn = String(url.searchParams.get('SN') || '').toUpperCase().trim();
      g = P.machines.sn[sn] && P.gyms.find((x) => x.id === P.machines.sn[sn]);
      if (!g) {
        noteUnclaimed(sn, ip);
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Unknown device. Add its serial number in the gym app first.');
      }
      text = req.method === 'POST' ? await readText(req) : '';
      const [status, reply] = runtime(g).api.handleDevice(req.method, url, text);
      res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      return res.end(reply);
    }
    const key = pathname.slice(5);
    g = P.machines.hik[key] && P.gyms.find((x) => x.id === P.machines.hik[key]);
    if (!g) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Unknown machine'); }
    text = await readText(req, 4 * 1024 * 1024);
    const [status, reply] = runtime(g).api.handleHikvision(key, text);
    res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    return res.end(reply);
  }

  // ---- website files --------------------------------------------------------------------

  const SITE_CSP = csp({
    script: 'https://cdn.paddle.com',
    frame: 'https://buy.paddle.com https://sandbox-buy.paddle.com',
    connect: 'https://*.paddle.com',
    img: 'https://*.paddle.com',
  });

  // The website reuses the app's design system and helpers.
  const SHARED = new Set(['base.css', 'admin.css', 'icons.js', 'common.js']);

  function serveSite(res, pathname) {
    const name = SITE_PAGES[pathname] || pathname.slice(1);
    const dir = SHARED.has(name) ? path.join(SITE, '..', 'public') : SITE;
    const file = path.normalize(path.join(dir, name));
    if (SHARED.has(name)) return fs.readFile(file, (err, data) => (err ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, data, TYPES[path.extname(file)], { 'Content-Security-Policy': SITE_CSP, 'Cache-Control': 'no-cache' })));
    if (!file.startsWith(SITE + path.sep)) return send(res, 404, 'Not found', 'text/plain');
    fs.readFile(file, (err, data) => {
      if (err) {
        return fs.readFile(path.join(SITE, '404.html'), (e2, page) => send(res, 404, page || 'Not found', e2 ? 'text/plain' : TYPES['.html'], { 'Content-Security-Policy': SITE_CSP }));
      }
      const type = TYPES[path.extname(file)] || 'application/octet-stream';
      send(res, 200, data, type, { 'Content-Security-Policy': SITE_CSP, 'Cache-Control': 'no-cache' });
    });
  }

  // ---- the server ------------------------------------------------------------------------

  let lastActiveSave = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    if (cors(req, res, pathname)) return;
    try {
      const gm = pathname.match(/^\/g\/([a-z0-9-]+)(\/.*)?$/);
      if (gm) {
        const g = gymBySlug(gm[1]);
        if (!g) return serveSite(res, '/404');
        const rest = gm[2] || '';
        if (!rest) { res.writeHead(302, { Location: `/g/${g.slug}/` }); return res.end(); }
        if (rest === '/api/platform/status') {
          const a = accessOf(g);
          return send(res, 200, JSON.stringify({ ...a, plan: g.plan, billingUrl: billingLink(g, req), productName: P.settings.productName }), undefined, { 'Cache-Control': 'no-store' });
        }
        const rt = runtime(g);
        await rt.serve(req, res, url, rest);
        if (rest.startsWith('/api/admin/devices') && req.method !== 'GET') reindexMachines(g);
        if (Date.now() - lastActiveSave > 60000) { g.lastActive = iso(); lastActiveSave = Date.now(); save(); } else g.lastActive = iso();
        return;
      }
      if (pathname.startsWith('/iclock/') || (pathname.startsWith('/hik/') && req.method === 'POST')) return await machine(req, res, url, pathname);
      if (pathname === '/paddle/webhook' && req.method === 'POST') {
        const raw = await readText(req, 1024 * 1024);
        if (!paddle.verifySignature(raw, req.headers['paddle-signature'], P.settings.paddle.webhookSecret || process.env.PADDLE_WEBHOOK_SECRET, { now: Date.now() })) {
          return send(res, 401, JSON.stringify({ error: 'Bad signature' }));
        }
        onPaddle(JSON.parse(raw));
        return send(res, 200, JSON.stringify({ ok: true }));
      }
      if (pathname.startsWith('/api/')) {
        const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
        const result = pathname.startsWith('/api/owner/') ? await ownerApi(req, req.method, pathname, body) : await publicApi(req, req.method, pathname, body);
        return send(res, 200, JSON.stringify(result), undefined, { 'Cache-Control': 'no-store' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
      return serveSite(res, pathname);
    } catch (err) {
      sendError(res, err);
    }
  });

  // WhatsApp reminders for every gym that is switched on.
  if (reminderTimer) {
    const run = async () => {
      for (const g of P.gyms) {
        if (!accessOf(g).ok) continue;
        await runtime(g).api.reminders.tick().catch((err) => log(`Reminders for ${g.slug}: ${err.message}`));
      }
    };
    setTimeout(run, 30000).unref();
    setInterval(run, 10 * 60 * 1000).unref();
  }

  // Gyms set up before machines were routed by serial number.
  for (const g of P.gyms) if (fs.existsSync(path.join(gymDir(g), 'db.json'))) reindexMachines(g);

  server.platform = { data: P, accessOf, runtime, onPaddle, publicKey, get setupCode() { return setupCode; } };
  return server;
}

module.exports = { createPlatform };
