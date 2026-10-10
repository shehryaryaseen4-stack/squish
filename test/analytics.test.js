'use strict';
// Visitor statistics: the beacon, conversions counted by the server, and the owner's dashboard,
// which works without accounts (ACCOUNTS off).
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const PORT = 9100 + Math.floor(Math.random() * 800);
const B = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-stats-'));
let srv;

test.before(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), ACCOUNTS: '', DATA_DIR: DATA, ADMIN_EMAIL: 'owner@example.com', ADMIN_PASSWORD: 'owner-pass-123' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${B}/api/health`)).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
test.after(async () => { srv.kill(); await new Promise((r) => (srv.exitCode !== null ? r() : srv.once('exit', r))); fs.rmSync(DATA, { recursive: true, force: true }); });

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36';
const hit = (body, h = {}) => fetch(`${B}/api/p`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'user-agent': UA, ...h }, body: JSON.stringify(body) });

test('sources and devices are recognised', () => {
  const a = require('../accounts/analytics');
  assert.strictEqual(a.sourceOf('google.com.pk'), 'Google');
  assert.strictEqual(a.sourceOf('gemini.google.com'), 'Gemini');
  assert.strictEqual(a.sourceOf('chatgpt.com'), 'ChatGPT');
  assert.strictEqual(a.sourceOf('l.facebook.com'), 'Facebook');
  assert.strictEqual(a.sourceOf('t.co'), 'X (Twitter)');
  assert.strictEqual(a.sourceOf(''), 'Direct');
  assert.strictEqual(a.sourceOf('blog.example'), 'Other sites');
  assert.strictEqual(a.sourceOf('google.com', 'Newsletter'), 'newsletter');
  assert.strictEqual(a.deviceOf(UA), 'Mobile');
  assert.strictEqual(a.deviceOf('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)'), 'Tablet');
  assert.strictEqual(a.deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Desktop');
});

test('visits, conversions and PDF downloads reach the dashboard', async () => {
  assert.strictEqual((await hit({ p: '/png-to-webp', r: 'https://www.google.com/' }, { 'cf-ipcountry': 'PK', 'cf-connecting-ip': '1.1.1.1' })).status, 204);
  await hit({ p: '/edit-pdf', r: `${B}/png-to-webp` }, { 'cf-ipcountry': 'PK', 'cf-connecting-ip': '1.1.1.1' });
  await hit({ e: 'pdf', p: '/edit-pdf' }, { 'cf-connecting-ip': '1.1.1.1' });
  await hit({ p: '/', r: '' }, { 'cf-ipcountry': 'US', 'cf-connecting-ip': '2.2.2.2' });
  await hit({ p: '/', r: '' }, { 'user-agent': 'Googlebot/2.1', 'cf-connecting-ip': '3.3.3.3' }); // ignored
  await hit({ p: '/', r: '' }, { 'cf-connecting-ip': '4.4.4.4', Origin: 'https://evil.example' }); // ignored
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f00' } }).png().toBuffer();
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), 'a.png');
  fd.append('format', 'webp');
  assert.strictEqual((await fetch(`${B}/api/compress`, { method: 'POST', body: fd, headers: { Referer: `${B}/png-to-webp` } })).status, 200);

  // The beacon does not use up the conversion rate limit.
  for (let i = 0; i < 130; i++) await hit({ p: '/x', r: `${B}/` }, { 'cf-connecting-ip': '1.1.1.1' });
  assert.notStrictEqual((await fetch(`${B}/api/health`)).status, 429);

  const login = await fetch(`${B}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'owner-pass-123' }) });
  assert.strictEqual(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const html = await (await fetch(`${B}/admin?range=today`, { headers: { cookie } })).text();
  const tiles = [...html.matchAll(/<strong>([^<]*)<\/strong>/g)].map((m) => m[1]);
  assert.strictEqual(tiles[0], '2', 'two visitors (bot and foreign origin ignored)');
  assert.strictEqual(tiles[2], '1', 'one conversion');
  assert.strictEqual(tiles[3], '1', 'one PDF download');
  assert.match(html, /Arrived from <b>Google<\/b>/);
  assert.match(html, /Converted <b>PNG → WEBP<\/b>/);
  assert.match(html, /Pakistan/);
  assert.doesNotMatch(html, /1\.1\.1\.1/);
  // No accounts: no users section.
  assert.doesNotMatch(html, /ad-users-table/);
  // Other periods render too.
  for (const r of ['yesterday', '7d', '30d', '90d']) assert.strictEqual((await fetch(`${B}/admin?range=${r}`, { headers: { cookie } })).status, 200);
  // Nobody else can see it.
  assert.match(await (await fetch(`${B}/admin`)).text(), /ad-login-form/);
});
