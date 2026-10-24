'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPlatform } = require('../lib/platform');
const { signFor } = require('../lib/platform/paddle');
const { verifyToken } = require('../lib/platform/license');

const DAY = 864e5;

async function start() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-'));
  let clock = new Date('2026-10-19T05:00:00Z').getTime();
  const server = createPlatform({ dataDir, now: () => new Date(clock), ownerEmail: 'me@example.com', ownerPassword: 'a-long-password', log: () => {} });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, { method = 'GET', body, token, headers = {}, raw } = {}) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...(body || raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  const owner = async () => (await call('/api/owner/login', { method: 'POST', body: { email: 'me@example.com', password: 'a-long-password' } })).body.token;
  return {
    server, call, owner, dataDir,
    advance: (days) => { clock += days * DAY; },
    close: () => new Promise((r) => server.close(() => { fs.rmSync(dataDir, { recursive: true, force: true }); r(); })),
  };
}

const signup = (extra = {}) => ({ gymName: 'Fit Zone', email: 'ali@fitzone.com', ownerPin: '4321', country: 'AE', ...extra });

test('a gym signs up, gets its own app and a free trial, then locks when the trial ends', async (t) => {
  const app = await start();
  t.after(app.close);
  const r = await app.call('/api/platform/signup', { method: 'POST', body: signup() });
  assert.equal(r.status, 200);
  assert.equal(r.body.slug, 'fit-zone');

  // Its own settings: UAE money and time zone, plans in AED, no sample data.
  const gym = await app.call('/g/fit-zone/api/gym');
  assert.equal(gym.body.business.name, 'Fit Zone');
  assert.equal(gym.body.business.currency, 'AED');
  assert.equal(gym.body.business.timeZone, 'Asia/Dubai');
  assert.equal(gym.body.plans.find((p) => p.months === 1).price, 250);
  assert.equal(gym.body.demo, false);
  assert.equal(gym.body.staff.length, 0);

  // Pages are rewritten to stay inside the gym.
  const page = await app.call('/g/fit-zone/admin');
  assert.match(page.text, /src="\/g\/fit-zone\/admin\.js"/);
  assert.match((await app.call('/g/fit-zone/config.js')).text, /"apiBase":"\/g\/fit-zone"/);

  const token = (await app.call('/g/fit-zone/api/admin/login', { method: 'POST', body: { pin: '4321' } })).body.token;
  assert.ok(token);
  assert.equal((await app.call('/g/fit-zone/api/admin/login', { method: 'POST', body: { pin: '0000' } })).status, 401);
  const add = await app.call('/g/fit-zone/api/admin/members', { method: 'POST', token, body: { name: 'Sara', phone: '0501234567', gender: 'female', joinDate: '2026-10-19' } });
  assert.equal(add.status, 200);

  // A second gym never sees the first one's members.
  await app.call('/api/platform/signup', { method: 'POST', body: signup({ gymName: 'Iron Den', email: 'x@y.com', ownerPin: '5555', country: 'GB' }) });
  const t2 = (await app.call('/g/iron-den/api/admin/login', { method: 'POST', body: { pin: '5555' } })).body.token;
  assert.equal((await app.call('/g/iron-den/api/admin/members', { token: t2 })).body.length, 0);
  assert.equal((await app.call('/g/iron-den/api/admin/members', { token })).status, 401);

  const status = await app.call('/g/fit-zone/api/platform/status');
  assert.equal(status.body.state, 'trial');
  assert.equal(status.body.daysLeft, 14);

  // Trial plus grace days over: the gym is locked, but its data is kept.
  app.advance(14 + 3 + 1);
  const locked = await app.call('/g/fit-zone/api/admin/members', { token });
  assert.equal(locked.status, 402);
  assert.equal(locked.body.locked, true);
  assert.match(locked.body.billingUrl, /\/billing\?gym=fit-zone$/);
  assert.equal((await app.call('/g/fit-zone/api/gym')).status, 200);

  // The platform owner extends it by hand (paid in cash or by bank).
  const ot = await app.owner();
  const gyms = (await app.call('/api/owner/gyms', { token: ot })).body;
  const fz = gyms.find((g) => g.slug === 'fit-zone');
  assert.equal(fz.access.state, 'expired');
  await app.call(`/api/owner/gyms/${fz.id}`, { method: 'PUT', token: ot, body: { action: 'extend', days: 30 } });
  assert.equal((await app.call('/g/fit-zone/api/admin/members', { token })).body.length, 1);

  // …and can pause it.
  await app.call(`/api/owner/gyms/${fz.id}`, { method: 'PUT', token: ot, body: { action: 'suspend' } });
  assert.equal((await app.call('/g/fit-zone/api/admin/members', { token })).status, 402);
  await app.call(`/api/owner/gyms/${fz.id}`, { method: 'PUT', token: ot, body: { action: 'unsuspend' } });

  // The owner can open any gym's dashboard and reset its PIN.
  const support = (await app.call(`/api/owner/gyms/${fz.id}/login`, { method: 'POST', token: ot })).body.token;
  assert.equal((await app.call('/g/fit-zone/api/admin/data', { token: support })).body.role, 'owner');
  await app.call(`/api/owner/gyms/${fz.id}`, { method: 'PUT', token: ot, body: { action: 'pin', pin: '7777' } });
  assert.equal((await app.call('/g/fit-zone/api/admin/login', { method: 'POST', body: { pin: '7777' } })).status, 200);

  // Only the owner gets into the owner API.
  assert.equal((await app.call('/api/owner/gyms', { token })).status, 401);
  assert.equal((await app.call('/api/owner/login', { method: 'POST', body: { email: 'me@example.com', password: 'nope' } })).status, 401);
  assert.equal((await app.call('/api/platform/signup', { method: 'POST', body: signup({ slug: 'fit-zone' }) })).status, 409);
});

test('Paddle payments renew a gym and sell Windows licences', async (t) => {
  const app = await start();
  t.after(app.close);
  const ot = await app.owner();
  await app.call('/api/owner/settings', {
    method: 'PUT', token: ot,
    body: { paddle: { environment: 'sandbox', clientToken: 'test_abc', webhookSecret: 'pdl_secret' }, prices: { monthly: { amount: 19, currency: 'USD', paddlePriceId: 'pri_month' }, yearly: { amount: 190, currency: 'USD', paddlePriceId: 'pri_year' }, license: { amount: 299, currency: 'USD', paddlePriceId: 'pri_lic' } } },
  });
  const cfg = (await app.call('/api/platform/config')).body;
  assert.equal(cfg.paddle.clientToken, 'test_abc');
  assert.equal(cfg.prices.yearly.priceId, 'pri_year');
  assert.equal(JSON.stringify(cfg).includes('pdl_secret'), false);

  await app.call('/api/platform/signup', { method: 'POST', body: signup() });
  const gym = (await app.call('/api/platform/gym?gym=fit-zone')).body;

  const hook = (evt, secret = 'pdl_secret') => {
    const raw = JSON.stringify(evt);
    return app.call('/paddle/webhook', { method: 'POST', raw, headers: { 'Paddle-Signature': signFor(raw, secret) } });
  };
  const sub = {
    event_id: 'evt_1', event_type: 'subscription.created',
    data: { id: 'sub_1', status: 'active', customer_id: 'ctm_1', custom_data: { gymId: gym.id }, items: [{ price: { id: 'pri_year' } }], current_billing_period: { starts_at: '2026-10-19T05:00:00Z', ends_at: '2027-10-19T05:00:00Z' } },
  };
  assert.equal((await hook(sub, 'wrong')).status, 401);
  assert.equal((await hook(sub)).status, 200);
  const after = (await app.call('/api/platform/gym?gym=fit-zone')).body;
  assert.equal(after.plan, 'yearly');
  assert.equal(after.access.state, 'paid');
  assert.equal(after.subscribed, true);
  app.advance(200);
  assert.equal((await app.call('/g/fit-zone/api/platform/status')).body.state, 'paid');

  // A one-time purchase of the Windows app makes a licence key.
  await hook({ event_id: 'evt_2', event_type: 'transaction.completed', data: { id: 'txn_01abc', custom_data: { email: 'buyer@gym.com' }, items: [{ price: { id: 'pri_lic' }, quantity: 1 }] } });
  await hook({ event_id: 'evt_2', event_type: 'transaction.completed', data: { id: 'txn_01abc', custom_data: { email: 'buyer@gym.com' }, items: [{ price: { id: 'pri_lic' }, quantity: 1 }] } });
  const bought = (await app.call('/api/platform/licence?txn=txn_01abc')).body;
  assert.equal(bought.keys.length, 1);
  const key = bought.keys[0];
  assert.match(key, /^GYM-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // The Windows app activates it (typed loosely), checks it offline, and learns when it is revoked.
  const act = await app.call('/api/license/activate', { method: 'POST', body: { key: key.toLowerCase().replace(/-/g, ' '), device: 'pc-1', deviceName: 'Front desk' } });
  assert.equal(act.status, 200);
  const payload = verifyToken(act.body.publicKey, act.body.token);
  assert.equal(payload.device, 'pc-1');
  const [body, sig] = act.body.token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...payload, device: 'pc-9' })).toString('base64url');
  assert.equal(verifyToken(act.body.publicKey, `${forged}.${sig}`), null);
  assert.ok(body);
  await app.call('/api/license/activate', { method: 'POST', body: { key, device: 'pc-2' } });
  assert.equal((await app.call('/api/license/activate', { method: 'POST', body: { key, device: 'pc-3' } })).status, 409);
  assert.equal((await app.call('/api/license/check', { method: 'POST', body: { token: act.body.token } })).body.status, 'active');
  const lic = (await app.call('/api/owner/licenses', { token: ot })).body[0];
  await app.call(`/api/owner/licenses/${lic.id}`, { method: 'PUT', token: ot, body: { action: 'revoke' } });
  assert.equal((await app.call('/api/license/check', { method: 'POST', body: { token: act.body.token } })).body.status, 'revoked');
  assert.equal((await app.call('/api/license/activate', { method: 'POST', body: { key, device: 'pc-1' } })).status, 403);
});

test('fingerprint machines reach their own gym by serial number', async (t) => {
  const app = await start();
  t.after(app.close);
  await app.call('/api/platform/signup', { method: 'POST', body: signup({ country: 'PK' }) });
  const token = (await app.call('/g/fit-zone/api/admin/login', { method: 'POST', body: { pin: '4321' } })).body.token;
  await app.call('/g/fit-zone/api/admin/members', { method: 'POST', token, body: { name: 'Ali', phone: '03001234567', gender: 'male', joinDate: '2026-10-19' } });
  assert.equal((await app.call('/iclock/cdata?SN=ABC12345&options=all')).status, 403);
  const added = await app.call('/g/fit-zone/api/admin/devices', { method: 'POST', token, body: { type: 'zk-fingerprint', sn: 'abc12345', name: 'Door' } });
  assert.equal(added.status, 200);
  assert.equal((await app.call('/iclock/cdata?SN=ABC12345&options=all')).status, 200);
  const punch = await app.call('/iclock/cdata?SN=ABC12345&table=ATTLOG', { method: 'POST', raw: '1001\t2026-10-19 10:00:00\t0\t1\t0\t0', headers: { 'Content-Type': 'text/plain' } });
  assert.equal(punch.status, 200);
  const day = (await app.call('/g/fit-zone/api/admin/attendance?date=2026-10-19', { token })).body;
  assert.equal(day.list.length, 1);
  const owner = await app.owner();
  assert.equal((await app.call('/api/owner/machines', { token: owner })).body.unclaimed[0].sn, 'ABC12345');
});

test('the website and the owner panel are served', async (t) => {
  const app = await start();
  t.after(app.close);
  for (const p of ['/', '/signup', '/billing', '/thanks', '/download', '/terms', '/privacy', '/refund', '/owner']) {
    const r = await app.call(p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-security-policy'), /cdn\.paddle\.com/);
  }
  assert.equal((await app.call('/g/nobody/admin')).status, 404);
});
