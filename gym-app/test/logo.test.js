'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

// A 1×1 transparent PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('the gym uploads its logo: shown in the app data and used as the app icon', async (t) => {
  const server = createServer({ seed: 'demo', reminders: false });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, token) => {
    const res = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, text, body: (() => { try { return JSON.parse(text); } catch { return null; } })() };
  };
  const owner = (await call('/api/admin/login', 'POST', { pin: '1234' })).body.token;
  const desk = (await call('/api/admin/login', 'POST', { pin: '0000' })).body.token;
  assert.doesNotMatch((await call('/icon.svg')).text, /<image/);

  assert.equal((await call('/api/admin/logo', 'PUT', { image: PNG }, desk)).status, 403);
  assert.equal((await call('/api/admin/logo', 'PUT', { image: 'not an image' }, owner)).status, 400);
  const saved = await call('/api/admin/logo', 'PUT', { image: PNG }, owner);
  assert.equal(saved.status, 200);
  assert.ok(saved.body.logo);
  assert.equal((await call('/api/gym')).body.business.logo, saved.body.logo);
  assert.match((await call('/icon.svg')).text, /<image href="data:image\//);
  assert.match((await call('/icon-maskable.svg')).text, /<image/);

  // Changing other settings keeps the logo.
  const b = (await call('/api/gym')).body.business;
  await call('/api/admin/business', 'PUT', { ...b, tagline: 'New tagline' }, owner);
  assert.equal((await call('/api/gym')).body.business.logo, saved.body.logo);

  await call('/api/admin/logo', 'DELETE', null, owner);
  assert.equal((await call('/api/gym')).body.business.logo, undefined);
  assert.doesNotMatch((await call('/icon.svg')).text, /<image/);
});
