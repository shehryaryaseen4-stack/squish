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
