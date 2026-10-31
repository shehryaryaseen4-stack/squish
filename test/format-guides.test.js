'use strict';
// Hand-written format page content (content/format-guides.js): every entry is for a live format,
// shows on its /<format>-converter page, puts its FAQs in the FAQPage data and links real guides.
const test = require('node:test');
const assert = require('node:assert/strict');
const pages = require('../pages');
const GUIDES = require('../content/format-guides');
const ARTICLES = require('../content/articles');

test('format guides: on the page, in the FAQ data, with working guide links', () => {
  const slugs = new Set(ARTICLES.map((a) => a.slug));
  for (const [slug, g] of Object.entries(GUIDES)) {
    const r = pages.resolveConverter(slug, 'https://example.com');
    assert.ok(r && r.html, slug);
    const html = r.html;
    assert.match(html, /name="robots" content="index/, slug);
    assert.ok(html.includes(g.about[0].slice(0, 60)), `${slug}: about text`);
    assert.ok(html.includes(g.open.slice(0, 60)), `${slug}: how to open`);
    for (const [q] of g.faq) assert.ok(html.includes(`"name":"${q.replace(/"/g, '\\"')}"`) || html.includes(q), `${slug}: ${q}`);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const faqPage = ld['@graph'].find((x) => x['@type'] === 'FAQPage');
    assert.ok(faqPage.mainEntity.some((e) => e.name === g.faq[0][0]), `${slug}: FAQPage`);
    if (g.desc) { assert.ok(html.includes(g.desc.slice(0, 50)), `${slug}: desc`); assert.ok(g.desc.length <= 160, `${slug}: desc length`); }
    for (const a of g.guides || []) { assert.ok(slugs.has(a), `${slug}: guide ${a}`); assert.ok(html.includes(`href="/guides/${a}"`), `${slug}: link ${a}`); }
    for (const t of [...g.about, g.open, ...g.uses, ...(g.limits || []), ...g.faq.flat()]) assert.ok(!t.includes('<'), `${slug}: no HTML`);
  }
});
