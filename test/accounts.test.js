'use strict';
// Accounts: sign up, sign in, the download counter and the owner's dashboard, against a real
// server started with ACCOUNTS=1 and a throwaway data folder.
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3000 + Math.floor(Math.random() * 2000) + 5000;
const B = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-acct-'));
let srv;

test.before(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), ACCOUNTS: '1', PDF_EDITOR: '1', DATA_DIR: DATA, ADMIN_EMAIL: 'owner@example.com', ADMIN_PASSWORD: 'owner-pass-123' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${B}/api/health`)).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
test.after(() => { srv.kill(); fs.rmSync(DATA, { recursive: true, force: true }); });

const post = (p, body, cookie = '', headers = {}) => fetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie, ...headers }, body: JSON.stringify(body) });
const cookieOf = (r) => (r.headers.get('set-cookie') || '').split(';')[0];

test('sign up, sign in and count downloads', async () => {
  assert.strictEqual((await post('/api/auth/signup', { email: 'a@example.com', password: 'short' })).status, 400);
  const r = await post('/api/auth/signup', { email: ' A@Example.com ', password: 'password-1' });
  assert.strictEqual(r.status, 200);
  const c = cookieOf(r);
  assert.match(c, /^ff_s=/);
  assert.strictEqual((await (await fetch(`${B}/api/me`, { headers: { cookie: c } })).json()).user.email, 'a@example.com');
  assert.strictEqual((await post('/api/auth/signup', { email: 'a@example.com', password: 'password-2' })).status, 409);
  assert.strictEqual((await post('/api/auth/login', { email: 'a@example.com', password: 'nope-nope' })).status, 401);
  assert.strictEqual((await post('/api/auth/login', { email: 'a@example.com', password: 'password-1' })).status, 200);
  assert.strictEqual((await post('/api/me/event', { type: 'download' })).status, 401);
  assert.strictEqual((await post('/api/me/event', { type: 'download' }, c)).status, 200);
  assert.strictEqual((await (await fetch(`${B}/api/me`, { headers: { cookie: c } })).json()).user.downloads, 1);
  // A forged or tampered cookie is not a session.
  assert.strictEqual((await (await fetch(`${B}/api/me`, { headers: { cookie: `${c}x` } })).json()).user, null);
  // Never the password hash.
  assert.ok(!JSON.stringify(await (await fetch(`${B}/api/me`, { headers: { cookie: c } })).json()).includes('s1$'));
});

test('writes need JSON from this site', async () => {
  assert.strictEqual((await post('/api/me/event', { type: 'wall' }, '', { Origin: 'https://evil.example' })).status, 403);
  const r = await fetch(`${B}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=a' });
  assert.strictEqual(r.status, 415);
});

test('account pages and safe redirects', async () => {
  const acc = await fetch(`${B}/account`, { redirect: 'manual' });
  assert.strictEqual(acc.status, 302);
  assert.match(acc.headers.get('location'), /\/login\?next=\/account$/);
  const login = await fetch(`${B}/login?next=//evil.example`);
  assert.ok(!(await login.text()).includes('evil.example'));
  assert.strictEqual(login.headers.get('cache-control'), 'no-store');
  assert.match(await (await fetch(`${B}/edit-pdf`)).text(), /data-accounts="1"/);
});

test('owner dashboard is private', async () => {
  const anon = await (await fetch(`${B}/admin`)).text();
  assert.match(anon, /ad-login-form/);
  assert.ok(!anon.includes('a@example.com'));
  assert.strictEqual((await fetch(`${B}/admin/users.csv`, { redirect: 'manual' })).status, 302);
  assert.strictEqual((await post('/admin/login', { email: 'owner@example.com', password: 'wrong' })).status, 401);
  const r = await post('/admin/login', { email: 'owner@example.com', password: 'owner-pass-123' });
  assert.strictEqual(r.status, 200);
  const c = cookieOf(r);
  const page = await (await fetch(`${B}/admin`, { headers: { cookie: c } })).text();
  assert.match(page, /a@example\.com/);
  const csv = await (await fetch(`${B}/admin/users.csv`, { headers: { cookie: c } })).text();
  assert.match(csv, /^email,name/);
  assert.match(csv, /a@example\.com,,email/);
  // A user session is not an owner session.
  const u = cookieOf(await post('/api/auth/login', { email: 'a@example.com', password: 'password-1' }));
  assert.match(await (await fetch(`${B}/admin`, { headers: { cookie: u.replace('ff_s', 'ff_a') } })).text(), /ad-login-form/);
});

test('signing in with an unknown email does not crash the server', async () => {
  assert.strictEqual((await post('/api/auth/login', { email: 'nobody@example.com', password: 'whatever-1' })).status, 401);
  assert.strictEqual((await fetch(`${B}/api/health`)).status, 200);
});
