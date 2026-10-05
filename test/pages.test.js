'use strict';
// These tests describe the image-only build (no FFmpeg, LibreOffice, ...), so they turn off
// detection of system tools. test/conversions.test.js and test/seo.test.js cover the full build.
process.env.SQUISH_DETECT = '0';
// Page behaviour: every registered conversion has a page and is in the menus, but only live
// ones show the upload tool and get indexed. Planned ones say "coming soon" and are noindex.
const test = require('node:test');
const assert = require('node:assert/strict');
const pages = require('../pages');
const registry = require('../registry');

const BASE = 'https://example.test';
const ANY = { minStatus: 'planned' };
const hasTool = (html) => html.includes('id="dropzone"');
const isNoindex = (html) => html.includes('<meta name="robots" content="noindex');

test('every live conversion page shows the tool, is indexable and keeps its wording', () => {
  for (const c of registry.getConverters()) {
    const r = pages.resolvePair(c.from, c.to, BASE);
    assert.ok(r && r.html, c.route);
    assert.ok(hasTool(r.html), `${c.route} has no upload tool`);
    assert.ok(!isNoindex(r.html), `${c.route} should be indexable`);
    assert.ok(r.html.includes(`<link rel="canonical" href="${BASE}${c.route}">`), `${c.route} canonical`);
    assert.ok(r.html.includes('id="selectBtn"'), `${c.route} Select File button`);
  }
  const html = pages.resolvePair('jpg', 'png', BASE).html;
  assert.match(html, /<title>JPG to PNG Converter \(JPEG to PNG\) - Free Online \| FlipItFree<\/title>/);
  assert.match(html, /<h1>JPG to PNG Converter<\/h1>/);
  assert.match(html, /data-default-format="png"/);
});

test('planned conversions get a noindex "coming soon" page without the tool', () => {
  for (const [f, t] of [['mp4', 'mp3'], ['pdf', 'docx'], ['docx', 'pdf'], ['cr2', 'jpg'], ['tar-gz', 'zip'], ['heic', 'jpg']]) {
    const r = pages.resolvePair(f, t, BASE);
    assert.ok(r && r.html, `${f}->${t}`);
    assert.ok(!hasTool(r.html), `${f}->${t} must not show the tool`);
    assert.ok(isNoindex(r.html), `${f}->${t} must be noindex`);
    assert.match(r.html, /Coming soon/);
  }
  assert.equal(pages.resolveCompress('pdf', BASE).html.includes('Coming soon'), true);
});

test('redirects and misses', () => {
  assert.deepEqual(pages.resolvePair('jpeg', 'png', BASE), { redirect: '/jpg-to-png' });
  assert.deepEqual(pages.resolvePair('tif', 'jpeg', BASE), { redirect: '/tiff-to-jpg' });
  assert.deepEqual(pages.resolvePair('tgz', 'zip', BASE), { redirect: '/tar-gz-to-zip' });
  assert.deepEqual(pages.resolveCompress('jpeg', BASE), { redirect: '/compress-jpg' });
  assert.deepEqual(pages.resolveConverter('jpeg', BASE), { redirect: '/jpg-converter' });
  assert.equal(pages.resolvePair('png', 'png', BASE), null);
  assert.equal(pages.resolvePair('zip', 'rar', BASE), null); // RAR can never be created
  assert.equal(pages.resolvePair('png', 'nope', BASE), null);
  assert.equal(pages.resolveCompress('svg', BASE), null);
  assert.equal(pages.resolveConverter('nope', BASE), null);
});

test('category and format pages exist for everything in the catalogue', () => {
  for (const c of registry.getCategories()) assert.ok(pages.resolveConverter(c.id, BASE).html, c.id);
  for (const f of registry.getFormats()) {
    const html = pages.resolveConverter(f.id, BASE).html;
    assert.match(html, new RegExp(`<h1>${f.label.replace('.', '\\.')} Converter</h1>`), f.id);
  }
  assert.ok(hasTool(pages.resolveConverter('image', BASE).html));
  assert.ok(!hasTool(pages.resolveConverter('video', BASE).html));
  assert.ok(isNoindex(pages.resolveConverter('video', BASE).html));
  // /pdf-converter is the PDF format page, which lists PDF conversions
  assert.match(pages.resolveConverter('pdf', BASE).html, /Convert PDF to&hellip;/);
});

test('the Tools menu lists every category and links every format', () => {
  const html = pages.homePage(BASE);
  for (const c of registry.getCategories()) assert.ok(html.includes(`>${c.converterName}<`), c.converterName);
  for (const f of registry.getFormats()) assert.ok(html.includes(`href="/${f.id}-converter"`), f.id);
  for (const c of registry.getConverters({ ...ANY, type: 'compress' })) assert.ok(html.includes(`href="${c.route}"`), c.route);
});

test('format pages link every conversion the registry knows for that format', () => {
  for (const id of ['png', 'mp4', 'docx', 'zip']) {
    const html = pages.resolveConverter(id, BASE).html;
    for (const o of registry.getCompatibleOutputFormats(id, ANY)) assert.ok(html.includes(`href="/${id}-to-${o.id}"`), `${id} -> ${o.id}`);
    for (const i of registry.getCompatibleInputFormats(id, ANY)) assert.ok(html.includes(`href="/${i.id}-to-${id}"`), `${i.id} -> ${id}`);
  }
});

test('home page conversion map covers every input format', () => {
  const html = pages.homePage(BASE);
  const map = JSON.parse(/<script type="application\/json" id="convMap">(.*?)<\/script>/s.exec(html)[1]);
  for (const f of registry.getInputFormats(ANY)) assert.ok(map.pairs[f.id], f.id);
  assert.ok(map.live.includes('png>webp'));
  assert.ok(!map.live.includes('mp4>mp3'));
});

test('sitemap only lists pages that are indexable', () => {
  const paths = pages.allPaths();
  assert.equal(new Set(paths).size, paths.length, 'no duplicates');
  for (const c of registry.getConverters({ type: 'all' })) assert.ok(paths.includes(c.route), c.route);
  assert.ok(paths.includes('/image-converter') && paths.includes('/png-converter') && paths.includes('/jfif-to-png'));
  assert.ok(!paths.includes('/mp4-to-mp3') && !paths.includes('/video-converter') && !paths.includes('/mp4-converter'));
  for (const p of paths.filter((x) => x !== '/' && x !== '/converters' && !/^\/(about|privacy|terms|contact)$/.test(x))) {
    const m = /^\/(.+)-converter$/.exec(p);
    const r = m ? null : registry.parseConverterRoute(p);
    const html = m ? pages.resolveConverter(m[1], BASE).html
      : r.type === 'compress' ? pages.resolveCompress(r.from, BASE).html
        : pages.resolvePair(r.from, r.to, BASE).html;
    assert.ok(!isNoindex(html), `${p} is in the sitemap but noindex`);
  }
  assert.match(pages.sitemap(BASE), /<loc>https:\/\/example\.test\/png-to-webp<\/loc>/);
  assert.match(pages.robots(BASE), /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
});

test('hub and 404', () => {
  const hub = pages.hubPage(BASE);
  for (const c of registry.getCategories()) assert.ok(hub.includes(`id="cat-${c.id}"`), c.id);
  assert.ok(pages.notFoundPage().includes('<meta name="robots" content="noindex">'));
});

test('ads are off by default and, when configured, only on pages with the converter', () => {
  const html = pages.resolvePair('jpg', 'png', BASE).html;
  assert.ok(!html.includes('adsbygoogle') && !html.includes('{{AD'), 'no ad markup without ADSENSE_CLIENT');
  assert.equal(pages.adsTxt(), null);
  const { execFileSync } = require('node:child_process');
  const out = execFileSync(process.execPath, ['-e', `
    const p = require('./pages');
    const B = 'https://example.test';
    console.log(JSON.stringify({
      live: p.resolvePair('jpg', 'png', B).html, soon: p.resolvePair('mp4', 'mp3', B).html,
      privacy: p.resolveInfo('privacy', B).html, ads: p.adsTxt() }));`],
  { cwd: require('node:path').join(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, SQUISH_DETECT: '0', ADSENSE_CLIENT: 'ca-pub-1234567890123456', ADSENSE_SLOT_TOP: '1111111111' } });
  const r = JSON.parse(out);
  assert.match(r.live, /adsbygoogle\.js\?client=ca-pub-1234567890123456/);
  assert.match(r.live, /data-ad-slot="1111111111"/);
  assert.ok(!r.live.includes('data-ad-slot=""'), 'unset slots render nothing');
  assert.ok(!r.soon.includes('adsbygoogle'), 'no ads on coming-soon pages');
  assert.ok(!r.privacy.includes('adsbygoogle'), 'no ads on legal pages');
  assert.equal(r.ads, 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
});

test('popular conversions carry their hand-written guide and extra FAQ', () => {
  const GUIDES = require('../content/guides');
  for (const [key, g] of Object.entries(GUIDES)) {
    const [from, to] = key.split('>');
    const r = pages.resolvePair(from, to, BASE);
    assert.ok(r && r.html, key);
    for (const field of ['why', 'keep']) assert.ok(typeof g[field] === 'string' && g[field].length > 80, `${key} ${field}`);
    assert.ok(g.tips.length >= 3 && g.problems.length >= 2 && g.faq.length >= 2, `${key} lists`);
    if (!registry.getConversionStatus(from, to) || !r.html.includes('id="dropzone"')) continue; // engine missing in this build
    assert.ok(r.html.includes('class="guide prose"'), `${key} renders its guide`);
    assert.ok(r.html.includes(JSON.stringify(g.faq[0][0]).slice(1, -1)), `${key} FAQ in structured data`);
  }
  const html = pages.resolvePair('jpg', 'png', BASE).html;
  assert.match(html, /<h2>Why convert JPG to PNG\?<\/h2>/);
  assert.ok(!pages.resolvePair('png', 'gif', BASE).html.includes('class="guide'), 'pairs without a guide are unchanged');
});
