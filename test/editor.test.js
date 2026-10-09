'use strict';
// The PDF editor stays hidden unless PDF_EDITOR=1: no page, no menu link, no sitemap entry.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const probe = (env) => JSON.parse(execFileSync(process.execPath, ['-e', `
  const pages = require('./pages');
  const home = pages.homePage('https://example.test');
  const out = { flag: pages.PDF_EDITOR, link: home.includes('href="/edit-pdf"'), inSitemap: pages.allPaths().includes('/edit-pdf') };
  if (pages.PDF_EDITOR) {
    const html = pages.editorPage('https://example.test');
    out.title = /<title>([^<]*)/.exec(html)[1];
    out.h1 = (html.match(/<h1[^>]*>/g) || []).length;
    out.app = html.includes('id="peApp"') && html.includes('/editor.js?v=') && html.includes('/vendor/pdf-lib.min.js');
    out.jsonld = JSON.parse(/<script type="application\\/ld\\+json">([\\s\\S]*?)<\\/script>/.exec(html)[1])['@graph'].map((n) => n['@type']);
  }
  console.log(JSON.stringify(out));
`], { cwd: ROOT, env: { ...process.env, ...env } }).toString());

test('PDF editor is hidden by default', () => {
  const r = probe({ PDF_EDITOR: '' });
  assert.deepEqual(r, { flag: false, link: false, inSitemap: false });
});

test('PDF_EDITOR=1 adds the page, the menu link and the sitemap entry', () => {
  const r = probe({ PDF_EDITOR: '1' });
  assert.equal(r.flag, true);
  assert.equal(r.link, true);
  assert.equal(r.inSitemap, true);
  assert.match(r.title, /^Edit PDF Online Free/);
  assert.equal(r.h1, 1);
  assert.equal(r.app, true);
  assert.ok(r.jsonld.includes('WebApplication') && r.jsonld.includes('FAQPage'));
});

test('font catalogue: 150+ unique Google families, and only listed fonts can be fetched', async () => {
  const fonts = require('../fonts');
  assert.ok(fonts.CATALOG.length >= 150, `only ${fonts.CATALOG.length} fonts`);
  const ids = new Set(fonts.CATALOG.map((f) => f.id));
  assert.equal(ids.size, fonts.CATALOG.length);
  for (const f of fonts.CATALOG) assert.match(f.id, /^[a-z0-9-]+$/);
  assert.equal(await fonts.fontFile('../../etc/passwd', '400'), null);
  assert.equal(await fonts.fontFile('roboto', 'bold'), null);
  assert.equal(await fonts.fontMeta('not-a-font'), null);
});

test('templates: 20+ editable designs, every font and object valid', async () => {
  const { TEMPLATES, TEMPLATE_CATS } = await import('../public/editor-templates.js');
  const fonts = new Set(['helv', 'times', 'courier', ...require('../public/editor-fonts.json').map((f) => f.id)]);
  const cats = new Set(TEMPLATE_CATS.map(([id]) => id));
  assert.ok(TEMPLATES.length >= 20, `${TEMPLATES.length} templates`);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length, 'unique ids');
  for (const t of TEMPLATES) {
    assert.ok(cats.has(t.cat), `${t.id} category`);
    assert.ok(t.size[0] > 200 && t.size[1] > 200, `${t.id} size`);
    assert.ok(t.items.length >= 8, `${t.id} has content`);
    for (const it of t.items) {
      assert.ok(['text', 'rect', 'ellipse', 'line', 'table'].includes(it.type), `${t.id}: ${it.type}`);
      if (it.type === 'table') {
        assert.ok(fonts.has(it.font), `${t.id}: table font`);
        assert.equal(it.cells.length, it.rows); assert.equal(it.rh.length, it.rows);
        assert.ok(it.cells.every((r) => r.length === it.cols), `${t.id}: ragged table`);
        assert.ok(Math.abs(it.cw.reduce((a, b) => a + b, 0) - 1) < 1e-6, `${t.id}: column widths`);
        assert.equal(it.h, it.rh.reduce((a, b) => a + b, 0));
      }
      for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isFinite(it[k]), `${t.id}: ${it.type} ${k}`);
      if (it.type === 'text') {
        assert.ok(it.text.trim(), `${t.id}: empty text box`);
        assert.ok(fonts.has(it.font), `${t.id}: unknown font ${it.font}`);
        // standard PDF fonts only cover Latin-1, so template text must stay inside it
        assert.ok(/^[\x0a\x20-\x7e\xa0-\xff]*$/.test(it.text), `${t.id}: "${it.text}" has characters outside Latin-1`);
      }
    }
  }
});

test('top bar: Edit PDF button replaces "Convert now"', () => {
  const pages = require('../pages');
  assert.ok(!pages.homePage('https://example.test').includes('Convert now'));
});

test('PDF editor landing pages: unique titles and descriptions, in the sitemap, with og images', () => {
  const [out, extra] = (execFileSync(process.execPath, ['-e', `
    const pages = require('./pages');
    const paths = pages.allPaths();
    console.log(JSON.stringify(pages.EDITOR_LANDINGS.map((l) => {
      const html = pages.editorPage('https://example.test', l.slug);
      return { slug: l.slug, title: /<title>([^<]*)/.exec(html)[1], desc: /<meta name="description" content="([^"]*)"/.exec(html)[1],
        h1: (html.match(/<h1[^>]*>([^<]*)/) || [])[1], h1s: (html.match(/<h1[^>]*>/g) || []).length, canon: /<link rel="canonical" href="([^"]*)"/.exec(html)[1],
        inSitemap: paths.includes('/' + l.slug), og: !!pages.ogSpec(l.slug), faq: html.includes('"FAQPage"'), cat: /data-start-cat="([a-z]+)"/.test(html), kind: l.kind, words: html.replace(/<[^>]+>/g, ' ').split(/\\s+/).length };
    })));
    console.log(JSON.stringify({ unknown: pages.editorPage('https://example.test', 'nope') }));
  `], { cwd: ROOT, env: { ...process.env, PDF_EDITOR: '1' } }).toString().trim().split('\n').map((x) => JSON.parse(x)));
  assert.equal(extra.unknown, null);
  assert.ok(out.length >= 20);
  const titles = new Set(out.map((x) => x.title)), descs = new Set(out.map((x) => x.desc));
  assert.equal(titles.size, out.length);
  assert.equal(descs.size, out.length);
  for (const x of out) {
    assert.ok(x.desc.length >= 90 && x.desc.length <= 160, `${x.slug} description is ${x.desc.length} chars`);
    assert.ok(x.title.length <= 75, `${x.slug} title is ${x.title.length} chars`);
    assert.equal(x.h1s, 1, x.slug);
    assert.equal(x.canon, `https://example.test/${x.slug}`);
    assert.ok(x.inSitemap && x.og && x.faq, x.slug);
    assert.equal(x.cat, x.kind === 'template', x.slug);
  }
});
