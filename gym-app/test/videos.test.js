'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

test('a gym adds short exercise videos: YouTube links or its own clips', async (t) => {
  const server = createServer({ seed: 'empty', reminders: false });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, { method = 'GET', body, token, raw, headers = {} } = {}) => {
    const res = await fetch(base + p, { method, headers: { ...(raw ? { 'Content-Type': 'video/mp4' } : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
    const buf = Buffer.from(await res.arrayBuffer());
    let json = null;
    try { json = JSON.parse(buf.toString()); } catch { /* binary */ }
    return { status: res.status, body: json, buf, headers: res.headers };
  };
  const owner = (await call('/api/admin/login', { method: 'POST', body: { pin: '1234' } })).body.token;
  const ex = 'barbell-bench-press-medium-grip';

  assert.equal((await call(`/api/admin/exercise-videos/${ex}`, { method: 'PUT', token: owner, body: { url: 'https://example.com/x' } })).status, 400);
  const yt = await call(`/api/admin/exercise-videos/${ex}`, { method: 'PUT', token: owner, body: { url: 'https://youtube.com/shorts/abcDEF12345?si=share' } });
  assert.deepEqual([yt.body.type, yt.body.id], ['youtube', 'abcDEF12345']);
  assert.equal((await call('/api/exercise-videos')).body[ex].id, 'abcDEF12345');

  // An uploaded clip replaces the link and plays in pieces.
  const clip = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(5000, 7)]);
  assert.equal((await call(`/api/admin/exercise-videos/${ex}/file`, { method: 'PUT', token: owner, raw: Buffer.from('not a video at all'.repeat(100)) })).status, 400);
  const up = await call(`/api/admin/exercise-videos/${ex}/file`, { method: 'PUT', token: owner, raw: clip });
  assert.equal(up.body.type, 'file');
  const src = up.body.src.split('?')[0];
  const whole = await call(src);
  assert.equal(whole.status, 200);
  assert.equal(whole.buf.length, clip.length);
  const part = await call(src, { headers: { Range: 'bytes=4-11' } });
  assert.equal(part.status, 206);
  assert.equal(part.buf.toString(), 'ftypmp42');
  assert.equal(part.headers.get('content-range'), `bytes 4-11/${clip.length}`);
  assert.match(whole.headers.get('content-security-policy'), /youtube-nocookie/);

  // Only staff who may edit members or settings can change videos.
  await call('/api/admin/users', { method: 'POST', token: owner, body: { name: 'Door', pin: '4444', perms: ['checkin'] } });
  const door = (await call('/api/admin/login', { method: 'POST', body: { pin: '4444' } })).body.token;
  assert.equal((await call(`/api/admin/exercise-videos/${ex}`, { method: 'DELETE', token: door })).status, 403);
  assert.equal((await call(`/api/admin/exercise-videos/${ex}`, { method: 'DELETE', token: owner })).status, 200);
  assert.equal((await call(src)).status, 404);
  assert.deepEqual((await call('/api/exercise-videos')).body, {});
});
