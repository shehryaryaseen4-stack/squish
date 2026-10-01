'use strict';
// Guards the migration: every page, the hub, home, 404, sitemap, robots and the redirect/miss
// behaviour must stay byte-identical to what the pre-registry pages.js produced.
// Fixture generated from the ORIGINAL pages.js (test/fixtures/pages-baseline.json).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const pages = require('../pages');
const baseline = require('./fixtures/pages-baseline.json');

const BASE = 'https://example.test';
const h = (s) => crypto.createHash('sha256').update(s.replace(/&copy; \d{4}/g, '&copy; YEAR')).digest('hex');

test('same URL list as before, in the same order', () => {
  assert.deepEqual(pages.allPaths(), baseline.__paths);
});

test('home, hub, 404, sitemap and robots are unchanged', () => {
  assert.equal(h(pages.homePage(BASE)), baseline['/']);
  assert.equal(h(pages.hubPage(BASE)), baseline['/converters']);
  assert.equal(h(pages.notFoundPage()), baseline['/__404__']);
  assert.equal(h(pages.sitemap(BASE)), baseline['/sitemap.xml']);
  assert.equal(h(pages.robots(BASE)), baseline['/robots.txt']);
});

test('all 56 converter and compressor pages are byte-identical', () => {
  let checked = 0;
  for (const p of baseline.__paths) {
    if (p === '/' || p === '/converters') continue;
    const pair = /^\/([a-z0-9]+)-to-([a-z0-9]+)$/.exec(p);
    const r = pair ? pages.resolvePair(pair[1], pair[2], BASE) : pages.resolveCompress(/^\/compress-(.+)$/.exec(p)[1], BASE);
    assert.equal(h(r.html), baseline[p], `${p} changed`);
    checked++;
  }
  assert.equal(checked, 56);
});

test('redirects and misses behave as before', () => {
  const show = (r) => (r ? JSON.stringify(r.redirect ? r : { html: 'ok' }) : 'null');
  const cases = {
    'redirect:/jpeg-to-png': pages.resolvePair('jpeg', 'png', BASE),
    'redirect:/png-to-jpeg': pages.resolvePair('png', 'jpeg', BASE),
    'redirect:/tif-to-jpeg': pages.resolvePair('tif', 'jpeg', BASE),
    'redirect:/compress-jpeg': pages.resolveCompress('jpeg', BASE),
    'redirect:/compress-tif': pages.resolveCompress('tif', BASE),
    'redirect:/png-to-png': pages.resolvePair('png', 'png', BASE),
    'redirect:/ico-to-png': pages.resolvePair('ico', 'png', BASE),
    'redirect:/svg-to-svg': pages.resolvePair('svg', 'svg', BASE),
    'redirect:/heic-to-jpg': pages.resolvePair('heic', 'jpg', BASE),
    'redirect:/compress-svg': pages.resolveCompress('svg', BASE),
    'redirect:/compress-bmp': pages.resolveCompress('bmp', BASE),
    'redirect:/compress-ico': pages.resolveCompress('ico', BASE),
  };
  for (const [k, v] of Object.entries(cases)) assert.equal(show(v), baseline[k], k);
});

test('new registry-only routes do not leak onto the site yet', () => {
  assert.equal(pages.resolvePair('mp4', 'mp3', BASE), null);
  assert.equal(pages.resolvePair('pdf', 'docx', BASE), null);
  assert.equal(pages.resolveCompress('pdf', BASE), null);
});
