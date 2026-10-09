'use strict';
// Email confirmation: with email set up (MAIL_DEV=1 prints the email instead of sending it),
// a sign-up only becomes an account once the emailed code is entered; the same codes reset a
// forgotten password.
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 7000 + Math.floor(Math.random() * 2000);
const B = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-mail-'));
let srv, log = '';

test.before(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), ACCOUNTS: '1', MAIL_DEV: '1', DATA_DIR: DATA, ADMIN_EMAIL: '', ADMIN_PASSWORD: '' },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  srv.stdout.on('data', (d) => { log += d; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${B}/api/health`)).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
test.after(() => { srv.kill(); fs.rmSync(DATA, { recursive: true, force: true }); });

const post = (p, body, cookie = '') => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
const lastCode = async (email) => {
  await new Promise((r) => setTimeout(r, 100));
  const m = [...log.matchAll(new RegExp(`\\[mail\\] to ${email.replace('.', '\\.')}: (\\d{6})`, 'g'))];
  return m.length ? m[m.length - 1][1] : null;
};

test('sign-up waits for the emailed code', async () => {
  const r = await post('/api/auth/signup', { email: 'b@example.com', password: 'password-1' });
  assert.deepStrictEqual(await r.json(), { verify: true, email: 'b@example.com' });
  assert.strictEqual(r.headers.get('set-cookie'), null);
  // No account yet: signing in does not work.
  assert.strictEqual((await post('/api/auth/login', { email: 'b@example.com', password: 'password-1' })).status, 401);
  const code = await lastCode('b@example.com');
  assert.match(code, /^\d{6}$/);
  const wrong = String((Number(code) + 1) % 1e6).padStart(6, '0');
  assert.strictEqual((await post('/api/auth/verify', { email: 'b@example.com', code: wrong })).status, 400);
  // A new code right away is refused (one a minute).
  assert.strictEqual((await post('/api/auth/resend', { email: 'b@example.com', purpose: 'signup' })).status, 429);
  const ok = await post('/api/auth/verify', { email: 'b@example.com', code });
  assert.strictEqual(ok.status, 200);
  const j = await ok.json();
  assert.strictEqual(j.user.verified, true);
  assert.match(ok.headers.get('set-cookie'), /ff_s=/);
  // The code works once.
  assert.strictEqual((await post('/api/auth/verify', { email: 'b@example.com', code })).status, 400);
  assert.strictEqual((await post('/api/auth/login', { email: 'b@example.com', password: 'password-1' })).status, 200);
});

test('five wrong codes burn the code', async () => {
  await post('/api/auth/signup', { email: 'c@example.com', password: 'password-1' });
  const code = await lastCode('c@example.com');
  const wrong = String((Number(code) + 7) % 1e6).padStart(6, '0');
  for (let i = 0; i < 5; i++) await post('/api/auth/verify', { email: 'c@example.com', code: wrong });
  const r = await post('/api/auth/verify', { email: 'c@example.com', code });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /Too many/);
});

test('forgot password resets with a code', async () => {
  // Unknown emails get the same answer and no email.
  const unknown = await post('/api/auth/forgot', { email: 'nobody@example.com' });
  assert.deepStrictEqual(await unknown.json(), { verify: true, email: 'nobody@example.com' });
  assert.strictEqual(await lastCode('nobody@example.com'), null);
  await post('/api/auth/forgot', { email: 'b@example.com' });
  const code = await lastCode('b@example.com');
  assert.strictEqual((await post('/api/auth/reset', { email: 'b@example.com', code, password: 'short' })).status, 400);
  assert.strictEqual((await post('/api/auth/reset', { email: 'b@example.com', code, password: 'new-password-2' })).status, 200);
  assert.strictEqual((await post('/api/auth/login', { email: 'b@example.com', password: 'password-1' })).status, 401);
  assert.strictEqual((await post('/api/auth/login', { email: 'b@example.com', password: 'new-password-2' })).status, 200);
});

test('pages offer the code step and password reset', async () => {
  assert.match(await (await fetch(`${B}/signup`)).text(), /class="auth-code"/);
  assert.match(await (await fetch(`${B}/login`)).text(), /href="\/forgot"/);
  assert.match(await (await fetch(`${B}/forgot`)).text(), /id="authNewPass"/);
});
