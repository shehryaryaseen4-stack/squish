'use strict';
// The twelve candidate pairs from the brief: what the registry says about each.
// "live" is only allowed where a working engine is installed (and see image-engine.test.js,
// which runs those conversions for real).
const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../registry');

const EXPECTED = [
  // from, to,     engine,        status,   backendRequired
  ['png',  'jpg',  'sharp',       'live',    true],
  ['png',  'webp', 'sharp',       'live',    true],
  ['jpg',  'png',  'sharp',       'live',    true],
  ['jpg',  'webp', 'sharp',       'live',    true],
  ['webp', 'png',  'sharp',       'live',    true],
  ['webp', 'jpg',  'sharp',       'live',    true],
  ['svg',  'png',  'sharp',       'live',    true],
  ['wav',  'mp3',  'ffmpeg',      'planned', true],
  ['mp4',  'gif',  'ffmpeg',      'planned', true],
  ['docx', 'pdf',  'libreoffice', 'planned', true],
  ['csv',  'xlsx', 'sheetjs',     'planned', false], // SheetJS runs in the browser too
  ['ttf',  'woff', 'fonttools',   'planned', true],
];

for (const [from, to, engine, status, backend] of EXPECTED) {
  test(`${from} -> ${to}: ${status}, engine ${engine}, backendRequired ${backend}`, () => {
    assert.ok(registry.isConversionRegistered(from, to));
    assert.equal(registry.getConversionStatus(from, to), status);
    const e = registry.getConversionEngine(from, to);
    assert.equal(e.id, engine);
    assert.equal(e.backendRequired, backend);
    assert.equal(registry.isConversionSupported(from, to), status === 'live'); // default = live only
    assert.ok(registry.getCompatibleOutputFormats(from, { minStatus: 'planned' }).some((f) => f.id === to));
  });
}

test('planned pairs are not mistaken for live ones', () => {
  const liveIds = new Set(registry.getConverters().map((c) => c.id));
  for (const [from, to, , status] of EXPECTED) assert.equal(liveIds.has(`${from}>${to}`), status === 'live');
});

test('no live/experimental converter depends on an engine that is not installed', () => {
  for (const c of registry.getConverters({ minStatus: 'experimental', type: 'all' })) {
    for (const id of new Set([c.engine, c.pipeline.decode, c.pipeline.encode])) {
      assert.equal(registry.getEngine(id).status, 'installed', `${c.id} uses ${id}`);
    }
  }
});

test('unregistered pairs report null / false', () => {
  assert.equal(registry.getConversionStatus('rar', 'zip'), 'planned');
  assert.equal(registry.getConversionStatus('zip', 'rar'), null); // RAR can never be created
  assert.equal(registry.isConversionRegistered('zip', 'rar'), false);
  assert.equal(registry.getConversionEngine('zip', 'rar'), null);
  assert.equal(registry.getConversionStatus('png', 'nope'), null);
});
