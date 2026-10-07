'use strict';
// Pages, SEO, links and the API. Run with `npm test` (engine tests skip when an engine is missing).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const app = require('../server');
const { TOOLS, CATEGORIES } = require('../lib/tools');
const { sanitizeHtml } = require('../lib/engines');
const { toolAvailable } = require('../lib/engines');
const { build } = require('./fixtures');

let base; let server; let fx;
test.before(async () => {
  server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
  fx = await build();
});
test.after(() => { server.close(); fs.rmSync(fx.dir, { recursive: true, force: true }); });

const PAGES = ['/', '/tools', ...CATEGORIES.map((c) => `/tools/${c.id}`), ...TOOLS.map((t) => `/${t.slug}`),
  '/about', '/contact', '/privacy', '/terms', '/cookies'];
const get = async (p) => { const r = await fetch(base + p, { redirect: 'manual' }); return { status: r.status, headers: r.headers, body: await r.text() }; };
const pick = (re, s) => (re.exec(s) || [])[1];

test('every page renders with unique, well-sized SEO metadata', async () => {
  const titles = new Map(); const descs = new Map();
  for (const p of PAGES) {
    const { status, body } = await get(p);
    assert.equal(status, 200, p);
    const title = pick(/<title>([^<]*)<\/title>/, body);
    const desc = pick(/<meta name="description" content="([^"]*)"/, body);
    assert.ok(title && title.length <= 70, `${p}: title "${title}" (${title && title.length})`);
    assert.ok(desc && desc.length >= 50 && desc.length <= 170, `${p}: description length ${desc && desc.length}`);
    assert.ok(!titles.has(title), `${p}: duplicate title with ${titles.get(title)}`);
    assert.ok(!descs.has(desc), `${p}: duplicate description with ${descs.get(desc)}`);
    titles.set(title, p); descs.set(desc, p);
    assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, `${p}: exactly one h1`);
    assert.ok(body.includes(`<link rel="canonical" href="${base}${p}">`), `${p}: canonical`);
    for (const m of body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
    assert.match(body, /<html lang="en">/);
  }
});

test('tool pages have intro, how-to, FAQ, related links and structured data', async () => {
  for (const t of TOOLS) {
    const { body } = await get(`/${t.slug}`);
    assert.match(body, /class="howto"/, t.slug);
    assert.match(body, /class="faq"/, t.slug);
    assert.match(body, /"@type":"FAQPage"/, t.slug);
    assert.match(body, /"@type":"WebApplication"/, t.slug);
    assert.match(body, /"price":"0"/, t.slug);
    for (const r of t.related) assert.ok(body.includes(`href="/${r}"`), `${t.slug} links to ${r}`);
    if (toolAvailable(t)) assert.match(body, /id="tool-config"/, t.slug);
  }
});

test('no broken internal links', async () => {
  const seen = new Set();
  for (const p of PAGES) {
    const { body } = await get(p);
    for (const m of body.matchAll(/href="(\/[^"#?]*)/g)) seen.add(m[1]);
  }
  for (const href of seen) {
    const { status } = await get(href);
    assert.equal(status, 200, `${href} -> ${status}`);
  }
});

test('nothing on the site is behind a paywall or account', async () => {
  for (const p of PAGES) {
    const text = (await get(p)).body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    for (const m of text.matchAll(/\b(premium|subscriptions?|subscribe|pricing|upgrade|free trial|credit card|paywall|pro plan|log ?in)\b/gi)) {
      const before = text.slice(Math.max(0, m.index - 40), m.index).toLowerCase();
      assert.match(before, /\bno\b|\bnot\b|without|never|n’t|n't/, `${p}: "${text.slice(m.index - 40, m.index + 30)}"`);
    }
  }
});

test('sitemap, robots, 404 and URL normalisation', async () => {
  const sm = (await get('/sitemap.xml')).body;
  for (const t of TOOLS.filter(toolAvailable)) assert.ok(sm.includes(`/${t.slug}</loc>`), t.slug);
  assert.match((await get('/robots.txt')).body, /Sitemap: /);
  const nf = await get('/no-such-page');
  assert.equal(nf.status, 404);
  assert.match(nf.body, /noindex/);
  const r = await get('/Merge-PDF/');
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/merge-pdf');
});

test('security headers', async () => {
  const { headers } = await get('/');
  assert.match(headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
});

test('HTML sanitizer removes anything that would fetch a resource', () => {
  const out = sanitizeHtml('<link rel=stylesheet href="http://x/a.css"><script>alert(1)</script><img src="file:///etc/passwd"><img src="data:image/png;base64,AAA"><p style="background:url(http://x/y.png)" onclick="x()">Hi</p><a href="https://example.com">link</a><iframe src="http://x"></iframe>');
  assert.doesNotMatch(out, /http:\/\/x|file:|<script|<link|<iframe|onclick/);
  assert.match(out, /data:image\/png/);
  assert.match(out, /href="https:\/\/example.com"/);
  assert.match(out, /Hi/);
});

// ------------------------------------------------------------------------ API
async function api(slug, file, options = {}) {
  const form = new FormData();
  form.append('options', JSON.stringify(options));
  if (file) form.append('file', new Blob([fs.readFileSync(fx.f(file))]), file);
  const r = await fetch(`${base}/api/tools/${slug}`, { method: 'POST', body: form });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, buf, headers: r.headers, json: () => JSON.parse(buf.toString()) };
}

test('API refuses unknown tools, browser-only tools, wrong and fake files', async () => {
  assert.equal((await api('nope', 'sample.pdf')).status, 404);
  assert.equal((await api('merge-pdf', 'sample.pdf')).status, 404);
  const avail = TOOLS.find((t) => t.slug === 'compress-pdf');
  if (!toolAvailable(avail)) return;
  const wrong = await api('compress-pdf', 'pic.png');
  assert.equal(wrong.status, 415);
  assert.match(wrong.json().error, /PDF/);
  const fake = await api('compress-pdf', 'not-a-pdf.pdf');
  assert.equal(fake.status, 415);
  const none = await api('compress-pdf', null);
  assert.equal(none.status, 400);
});

const SERVER_CASES = [
  ['pdf-to-word', 'sample.pdf', {}, (b) => b.subarray(0, 2).toString() === 'PK'],
  ['pdf-to-excel', 'table.pdf', {}, (b) => b.subarray(0, 2).toString() === 'PK'],
  ['pdf-to-powerpoint', 'sample.pdf', {}, (b) => b.subarray(0, 2).toString() === 'PK'],
  ['word-to-pdf', 'doc.docx', {}, (b) => b.subarray(0, 5).toString() === '%PDF-'],
  ['excel-to-pdf', 'sheet.xlsx', {}, (b) => b.subarray(0, 5).toString() === '%PDF-'],
  ['powerpoint-to-pdf', 'slides.pptx', {}, (b) => b.subarray(0, 5).toString() === '%PDF-'],
  ['html-to-pdf', 'page.html', {}, (b) => b.subarray(0, 5).toString() === '%PDF-'],
  ['compress-pdf', 'scan.pdf', { level: 'extreme' }, (b) => b.subarray(0, 5).toString() === '%PDF-'],
  ['reduce-pdf-size', 'scan.pdf', { dpi: '72', grayscale: true }, (b) => b.subarray(0, 5).toString() === '%PDF-'],
  ['optimize-pdf', 'sample.pdf', { linearize: true }, (b) => b.subarray(0, 5).toString() === '%PDF-'],
  ['protect-pdf', 'sample.pdf', { password: 'abcd', confirm: 'abcd' }, (b) => b.toString('latin1').includes('/Encrypt')],
  ['unlock-pdf', 'locked.pdf', { password: 'secret' }, (b) => !b.toString('latin1').includes('/Encrypt')],
  ['remove-pdf-restrictions', 'restricted.pdf', {}, (b) => !b.toString('latin1').includes('/Encrypt')],
  ['repair-pdf', 'broken.pdf', {}, (b) => b.subarray(0, 5).toString() === '%PDF-'],
  ['ocr-pdf', 'scan.pdf', { lang: 'eng' }, (b) => b.subarray(0, 5).toString() === '%PDF-'],
  ['image-to-text', 'photo.jpg', { lang: 'eng' }, (b) => /Sample page/.test(b.toString())],
  ['extract-images-from-pdf', 'sample.pdf', {}, (b) => b.subarray(1, 4).toString() === 'PNG'],
];
for (const [slug, file, options, check] of SERVER_CASES) {
  test(`server tool ${slug}`, async (t) => {
    const tool = TOOLS.find((x) => x.slug === slug);
    if (!toolAvailable(tool)) return t.skip('engine not installed');
    if (!fx.exists(file)) return t.skip(`fixture ${file} not available`);
    const r = await api(slug, file, options);
    assert.equal(r.status, 200, r.buf.toString().slice(0, 300));
    assert.ok(check(r.buf), `${slug} output check`);
    assert.match(r.headers.get('content-disposition'), /attachment/);
  });
}

test('server tools give clear errors', async (t) => {
  const tool = TOOLS.find((x) => x.slug === 'unlock-pdf');
  if (!toolAvailable(tool)) return t.skip('qpdf missing');
  const wrong = await api('unlock-pdf', 'locked.pdf', { password: 'nope' });
  assert.equal(wrong.status, 422);
  assert.match(wrong.json().error, /not correct/);
  const locked = await api('compress-pdf', 'locked.pdf', {});
  assert.match(locked.json().error, /password-protected/);
  const mismatch = await api('protect-pdf', 'sample.pdf', { password: 'abcd', confirm: 'abce' });
  assert.equal(mismatch.status, 400);
});

test('temporary upload folders are removed after each request', async (t) => {
  const tool = TOOLS.find((x) => x.slug === 'compress-pdf');
  if (!toolAvailable(tool)) return t.skip('gs missing');
  const os = require('os');
  const { PREFIX } = require('../lib/engines/runner');
  const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(PREFIX)).length;
  await api('compress-pdf', 'sample.pdf', {});
  await api('compress-pdf', 'not-a-pdf.pdf', {});
  await new Promise((r) => setTimeout(r, 300));
  const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(PREFIX)).length;
  assert.ok(after <= before, `temp folders left behind: ${after - before}`);
});
