'use strict';
// SEO guard rails for every indexable page (everything in the sitemap):
// unique titles/descriptions of sensible length, one H1, canonical + Open Graph tags,
// valid JSON-LD whose breadcrumbs match the visible trail, and no broken internal links.
const test = require('node:test');
const assert = require('node:assert/strict');
const pages = require('../pages');
const registry = require('../registry');

const BASE = 'https://example.test';

// Map a site path to the HTML the server would send (null = 404, { redirect } = 301).
function fetchPath(p) {
  const clean = p.split('#')[0].split('?')[0];
  if (clean === '/') return { html: pages.homePage(BASE) };
  if (clean === '/converters') return { html: pages.hubPage(BASE) };
  let m = /^\/(about|privacy|terms|contact)$/.exec(clean);
  if (m) return pages.resolveInfo(m[1], BASE);
  m = /^\/([a-z0-9-]+)-converter$/.exec(clean);
  if (m) return pages.resolveConverter(m[1], BASE);
  m = /^\/compress-([a-z0-9-]+)$/.exec(clean);
  if (m) return pages.resolveCompress(m[1], BASE);
  const r = registry.parseConverterRoute(clean);
  if (r && r.type === 'convert') return pages.resolvePair(r.from, r.to, BASE);
  return null;
}

const indexable = pages.allPaths().map((p) => ({ p, html: fetchPath(p).html }));
const attr = (html, re) => { const m = re.exec(html); return m ? m[1] : null; };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

test('every sitemap page renders and is indexable', () => {
  assert.ok(indexable.length > 80);
  for (const { p, html } of indexable) {
    assert.ok(html, p);
    assert.match(html, /<meta name="robots" content="index, follow/, p);
  }
});

test('titles and descriptions are unique and a good length', () => {
  const titles = new Map();
  const descs = new Map();
  for (const { p, html } of indexable) {
    const title = decode(attr(html, /<title>([^<]*)<\/title>/));
    const desc = decode(attr(html, /<meta name="description" content="([^"]*)"/));
    assert.ok(title.length >= 15 && title.length <= 65, `${p} title is ${title.length} chars: ${title}`);
    assert.ok(desc.length >= 50 && desc.length <= 165, `${p} description is ${desc.length} chars: ${desc}`);
    assert.ok(!titles.has(title), `${p} duplicates the title of ${titles.get(title)}`);
    assert.ok(!descs.has(desc), `${p} duplicates the description of ${descs.get(desc)}`);
    titles.set(title, p);
    descs.set(desc, p);
  }
});

test('one H1, canonical, Open Graph, Twitter and hreflang on every indexable page', () => {
  for (const { p, html } of indexable) {
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${p} must have exactly one h1`);
    assert.ok(html.includes(`<link rel="canonical" href="${BASE}${p}">`), `${p} canonical`);
    assert.ok(html.includes(`<meta property="og:url" content="${BASE}${p}">`), `${p} og:url`);
    assert.match(html, /<meta property="og:image" content="https:\/\/example\.test\/og\/[a-z0-9-]+\.png">/, p);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/, p);
    assert.ok(html.includes(`<link rel="alternate" hreflang="x-default" href="${BASE}${p}">`), `${p} hreflang`);
    assert.match(html, /<html lang="en">/, p);
  }
});

test('JSON-LD is valid and breadcrumbs match the visible trail', () => {
  for (const { p, html } of indexable) {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
    assert.equal(blocks.length, 1, p);
    const nodes = blocks[0]['@graph'];
    const types = nodes.map((n) => n['@type']);
    assert.ok(types.includes('Organization') && types.includes('WebSite'), `${p} org/site`);
    const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList');
    if (p === '/') continue;
    assert.ok(crumbs, `${p} BreadcrumbList`);
    const visible = [...(attr(html, /<nav class="crumbs" aria-label="Breadcrumb">(.*?)<\/nav>/s) || '').matchAll(/<li[^>]*>(?:<a href="[^"]*">)?([^<]*)/g)].map((m) => m[1]);
    assert.deepEqual(visible, crumbs.itemListElement.map((i) => i.name), `${p} visible breadcrumbs`);
    assert.equal(crumbs.itemListElement.at(-1).item, BASE + p, `${p} last crumb`);
  }
});

test('no broken internal links anywhere on the indexable pages', () => {
  const seen = new Set();
  for (const { p, html } of indexable) {
    for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
      if (seen.has(href) || /\.(css|js|png|ico|svg|webmanifest)(\?|$)/.test(href)) continue;
      seen.add(href);
      const r = fetchPath(href);
      assert.ok(r && (r.html || r.redirect), `${p} links to ${href}, which is a 404`);
      assert.ok(!r.redirect, `${p} links to ${href}, which redirects to ${r && r.redirect} (link the canonical URL)`);
    }
  }
  assert.ok(seen.size > 500);
});

test('share images exist for indexable pages and nothing else', () => {
  for (const { p } of indexable) assert.ok(pages.ogSpec(p === '/' ? 'home' : p.slice(1)), p);
  assert.equal(pages.ogSpec('anything-we-did-not-make'), null);
  assert.equal(pages.ogSpec('jpeg-to-png'), null); // alias: canonical image only
});

test('sitemap has lastmod for every URL; robots points to it', () => {
  const xml = pages.sitemap(BASE);
  const urls = xml.match(/<url>/g).length;
  assert.equal(urls, indexable.length);
  assert.equal(xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g).length, urls);
  assert.match(pages.robots(BASE), /Disallow: \/api\//);
});

test('live pair pages carry unique, useful content', () => {
  const html = pages.resolvePair('png', 'webp', BASE).html;
  assert.match(html, /<h2>How to convert PNG to WEBP<\/h2>/);
  assert.match(html, /<h2>PNG vs WEBP<\/h2>/);
  assert.match(html, /<th scope="row">Transparency<\/th><td>Yes<\/td><td>Yes<\/td>/);
});

test('target keywords lead the title, H1 and description of their pages', () => {
  const KEYWORDS = require('../content/keywords');
  const byPath = new Map(indexable.map((x) => [x.p, x.html]));
  for (const [p, k] of Object.entries(KEYWORDS)) {
    const html = byPath.get(p);
    assert.ok(html, `${p} is in content/keywords.js but not an indexable page`);
    const title = decode(attr(html, /<title>([^<]*)<\/title>/)).toLowerCase();
    const desc = decode(attr(html, /<meta name="description" content="([^"]*)"/)).toLowerCase();
    const h1 = attr(html, /<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, '').toLowerCase();
    assert.ok(title.includes(k.primary), `${p} title lacks "${k.primary}": ${title}`);
    if (p !== '/pdf-converter') assert.ok(desc.includes(k.primary), `${p} description lacks "${k.primary}": ${desc}`);
    assert.ok(h1.includes(k.primary), `${p} H1 lacks "${k.primary}": ${h1}`);
    for (const [q] of k.faq || []) assert.ok(html.includes(esc(q)), `${p} is missing its FAQ "${q}"`);
  }
});
