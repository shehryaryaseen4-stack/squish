'use strict';
// End-to-end test in a real browser (Playwright + Chromium): uploads real files to every tool,
// clicks through the UI, downloads the result and checks its contents.
//
//   npm run test:e2e                 starts the server on a free port
//   BASE=http://localhost:3000 npm run test:e2e   tests a running server
//
// Needs Playwright (npm i -g playwright, or set PLAYWRIGHT_PATH). Server-side tools are
// tested only when their engines are installed.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { build } = require('../fixtures');

let playwright;
for (const p of [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(p); break; } catch { /* next */ }
}
if (!playwright) { console.log('Playwright is not installed; skipping the browser test.'); process.exit(0); }

const { PDFDocument } = require('pdf-lib');
const JSZip = require('jszip');

async function pdfText(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fonts = `${path.dirname(require.resolve('pdfjs-dist/package.json'))}/standard_fonts/`;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, standardFontDataUrl: fonts, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    pages.push(c.items.map((x) => x.str).join(' '));
  }
  await doc.loadingTask.destroy();
  return pages;
}

(async () => {
  const fx = await build();
  let server; let base = process.env.BASE;
  if (!base) {
    const app = require('../../server');
    server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const status = await (await fetch(`${base}/api/status`)).json();
  const serverOk = (slug) => status.tools[slug] && status.tools[slug].available;

  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const results = [];
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) consoleErrors.push(`${page.url()}: ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`${page.url()}: ${e.message}`));

  async function open(slug) {
    await page.goto(`${base}/${slug}`);
    await page.waitForSelector('#tool-app[data-state="initial"]');
  }
  async function upload(...names) {
    await page.setInputFiles('#tool-app [data-input]', names.map(fx.f));
    await page.waitForSelector('#tool-app[data-state="selected"]');
  }
  async function go() {
    await page.click('#tool-app [data-go]');
    await page.waitForSelector('#tool-app[data-state="success"], #tool-app[data-state="error"]', { timeout: 180000 });
    if (await page.$('#tool-app[data-state="error"]')) throw new Error(`tool failed: ${await page.textContent('#tool-app')}`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-download]')]);
    const file = await dl.path();
    return { name: dl.suggestedFilename(), buf: fs.readFileSync(file) };
  }
  const pdfPages = async (buf) => (await PDFDocument.load(buf)).getPageCount();
  const zipNames = async (buf) => Object.keys((await JSZip.loadAsync(buf)).files);

  async function test(name, fn, { needs } = {}) {
    if (needs && !serverOk(needs)) { results.push(['skip', name]); return; }
    const t0 = Date.now();
    try { await fn(); results.push(['ok', name, Date.now() - t0]); } catch (e) {
      results.push(['FAIL', name, e.message]);
      await page.screenshot({ path: path.join(fx.dir, `fail-${name.replace(/\W+/g, '-')}.png`), fullPage: true }).catch(() => {});
    }
  }

  // ---------------------------------------------------------------- organize
  await test('merge-pdf', async () => {
    await open('merge-pdf');
    await upload('sample.pdf', 'second.pdf');
    assert.equal(await page.locator('.file').count(), 2);
    await page.waitForSelector('.file__meta:has-text("3 pages")');
    const r = await go();
    assert.equal(r.name, 'merged.pdf');
    assert.equal(await pdfPages(r.buf), 5);
  });
  await test('merge-pdf: reorder with buttons', async () => {
    await open('merge-pdf');
    await upload('sample.pdf', 'second.pdf');
    await page.click('.file[data-id] >> nth=1 >> [data-move="-1"]');
    const first = await page.textContent('.file >> nth=0 >> .file__name');
    assert.equal(first, 'second.pdf');
    const r = await go();
    assert.equal(await pdfPages(r.buf), 5);
  });
  await test('merge-pdf: invalid file is refused', async () => {
    await open('merge-pdf');
    await page.setInputFiles('#tool-app [data-input]', [fx.f('not-a-pdf.pdf')]);
    await page.waitForSelector('.notice--error');
    assert.equal(await page.getAttribute('#tool-app', 'data-state'), 'initial');
  });
  await test('split-pdf (ranges -> zip)', async () => {
    await open('split-pdf');
    await upload('long.pdf');
    await page.fill('#opt-ranges', '1-3, 4-12');
    const r = await go();
    const names = await zipNames(r.buf);
    assert.deepEqual(names.sort(), ['long-pages-1-3.pdf', 'long-pages-4-12.pdf']);
  });
  await test('split-pdf (every page)', async () => {
    await open('split-pdf');
    await upload('sample.pdf');
    await page.check('input[name="opt-mode"][value="each"]', { force: true });
    const r = await go();
    assert.equal((await zipNames(r.buf)).length, 3);
  });
  await test('extract-pdf-pages', async () => {
    await open('extract-pdf-pages');
    await upload('sample.pdf');
    await page.click('.pg[data-src="0"]');
    await page.click('.pg[data-src="2"]');
    const r = await go();
    const text = await pdfText(r.buf);
    assert.equal(text.length, 2);
    assert.match(text[1], /Sample page 3/);
  });
  await test('delete-pdf-pages', async () => {
    await open('delete-pdf-pages');
    await upload('sample.pdf');
    await page.fill('[data-pick-pages]', '2');
    const r = await go();
    const text = await pdfText(r.buf);
    assert.equal(text.length, 2);
    assert.match(text[1], /Sample page 3/);
  });
  await test('rearrange-pdf-pages', async () => {
    await open('rearrange-pdf-pages');
    await upload('sample.pdf');
    await page.click('.pg[data-src="0"] [data-mv="1"]');
    const r = await go();
    const text = await pdfText(r.buf);
    assert.match(text[0], /Sample page 2/);
    assert.match(text[1], /Sample page 1/);
  });
  await test('rearrange-pdf-pages: drag and drop', async () => {
    await open('rearrange-pdf-pages');
    await upload('sample.pdf');
    const a = await page.locator('.pg[data-src="2"]').boundingBox();
    const b = await page.locator('.pg[data-src="0"]').boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 10, a.y + 20, { steps: 4 });
    await page.mouse.move(b.x + 10, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    const order = await page.$$eval('.pg', (els) => els.map((e) => e.dataset.src));
    assert.deepEqual(order, ['2', '0', '1']);
  });
  await test('rotate-pdf', async () => {
    await open('rotate-pdf');
    await upload('sample.pdf');
    await page.click('.pg[data-src="0"] [data-rot="90"]');
    const r = await go();
    const doc = await PDFDocument.load(r.buf);
    assert.equal(doc.getPage(0).getRotation().angle, 90);
    assert.equal(doc.getPage(1).getRotation().angle, 0);
  });
  await test('duplicate-pdf-pages', async () => {
    await open('duplicate-pdf-pages');
    await upload('sample.pdf');
    await page.click('.pg[data-src="0"]');
    await page.fill('#opt-copies', '2');
    const r = await go();
    const text = await pdfText(r.buf);
    assert.equal(text.length, 5);
    assert.match(text[2], /Sample page 1/);
  });

  // ----------------------------------------------------------------- convert
  await test('pdf-to-jpg (zip)', async () => {
    await open('pdf-to-jpg');
    await upload('sample.pdf');
    await page.check('input[name="opt-dpi"][value="72"]', { force: true });
    const r = await go();
    const names = await zipNames(r.buf);
    assert.equal(names.length, 3);
    assert.ok(names.every((n) => n.endsWith('.jpg')));
  });
  await test('pdf-to-png (one page)', async () => {
    await open('pdf-to-png');
    await upload('sample.pdf');
    await page.fill('#opt-pages', '2');
    const r = await go();
    assert.equal(r.name, 'sample-page-2.png');
    assert.equal(r.buf.subarray(1, 4).toString(), 'PNG');
  });
  await test('jpg-to-pdf', async () => {
    await open('jpg-to-pdf');
    await upload('photo.jpg');
    await page.selectOption('#opt-pageSize', 'a4');
    const r = await go();
    const doc = await PDFDocument.load(r.buf);
    assert.equal(doc.getPageCount(), 1);
    assert.equal(Math.round(doc.getPage(0).getWidth()), 595);
  });
  await test('png-to-pdf', async () => {
    await open('png-to-pdf');
    await upload('pic.png');
    const r = await go();
    assert.equal(await pdfPages(r.buf), 1);
  });
  await test('pdf-to-text', async () => {
    await open('pdf-to-text');
    await upload('sample.pdf');
    const r = await go();
    assert.match(r.buf.toString(), /Sample page 1[\s\S]*Sample page 3/);
    assert.match(await page.inputValue('#result-text'), /quick brown fox/);
  });
  await test('pdf-to-text: scanned PDF explains OCR', async () => {
    await open('pdf-to-text');
    await upload('scan.pdf');
    await page.click('#tool-app [data-go]');
    await page.waitForSelector('#tool-app[data-state="error"]');
    assert.match(await page.textContent('#tool-app'), /OCR PDF/);
  });
  await test('pdf-to-zip (per page)', async () => {
    await open('pdf-to-zip');
    await upload('sample.pdf', 'second.pdf');
    await page.check('#opt-perPage');
    const r = await go();
    assert.equal((await zipNames(r.buf)).filter((n) => n.endsWith('.pdf')).length, 5);
  });

  // ----------------------------------------------------------------- enhance
  await test('add-watermark-to-pdf', async () => {
    await open('add-watermark-to-pdf');
    await upload('sample.pdf');
    await page.fill('#opt-text', 'TOP SECRET');
    await page.check('input[name="opt-layout"][value="tile"]', { force: true });
    const r = await go();
    const text = await pdfText(r.buf);
    assert.match(text[0], /TOP SECRET/);
  });
  await test('pdf-page-numbers', async () => {
    await open('pdf-page-numbers');
    await upload('sample.pdf');
    await page.selectOption('#opt-format', 'page-n-of');
    const r = await go();
    const text = await pdfText(r.buf);
    assert.match(text[2], /Page 3 of 3/);
  });
  await test('pdf-metadata-editor', async () => {
    await open('pdf-metadata-editor');
    await upload('sample.pdf');
    await page.waitForFunction(() => document.querySelector('#opt-title')?.value === 'Sample title');
    await page.fill('#opt-title', 'Quarterly report');
    const r = await go();
    const doc = await PDFDocument.load(r.buf);
    assert.equal(doc.getTitle(), 'Quarterly report');
    assert.equal(doc.getAuthor(), 'Test author');
  });

  // ------------------------------------------------------------------ editor
  async function dragOnPage(n, x1, y1, x2, y2) {
    const box = await page.locator(`.ed-page[data-page="${n}"] .ed-layer`).boundingBox();
    await page.mouse.move(box.x + x1, box.y + y1);
    await page.mouse.down();
    await page.mouse.move(box.x + (x1 + x2) / 2, box.y + (y1 + y2) / 2, { steps: 3 });
    await page.mouse.move(box.x + x2, box.y + y2, { steps: 3 });
    await page.mouse.up();
  }
  await test('edit-pdf: text + rectangle + drawing', async () => {
    await open('edit-pdf');
    await upload('sample.pdf');
    await page.waitForSelector('.ed-page canvas');
    await page.click('[data-tool="text"]');
    const box = await page.locator('.ed-page[data-page="0"] .ed-layer').boundingBox();
    await page.mouse.click(box.x + 80, box.y + 300);
    await page.keyboard.type('Hello from the editor');
    await page.click('[data-tool="rect"]');
    await dragOnPage(0, 60, 400, 260, 480);
    await page.click('[data-tool="draw"]');
    await dragOnPage(0, 300, 420, 450, 470);
    assert.match(await page.textContent('[data-ed-count]'), /3 items/);
    const r = await go();
    const text = await pdfText(r.buf);
    assert.match(text[0], /Hello from the editor/);
  });
  await test('add-image-to-pdf', async () => {
    await open('add-image-to-pdf');
    await upload('sample.pdf');
    await page.waitForSelector('.ed-page canvas');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-pick-img]')]);
    await chooser.setFiles(fx.f('pic.png'));
    await page.waitForSelector('.ed-obj--image');
    const r = await go();
    assert.ok(r.buf.length > 1000);
    assert.equal(await pdfPages(r.buf), 3);
  });
  await test('sign-pdf: drawn signature', async () => {
    await open('sign-pdf');
    await upload('sample.pdf');
    await page.waitForSelector('.modal .sig-pad');
    const pad = await page.locator('.sig-pad').boundingBox();
    await page.mouse.move(pad.x + 40, pad.y + 120);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(pad.x + 40 + i * 25, pad.y + 120 + Math.sin(i) * 40);
    await page.mouse.up();
    await page.click('.modal button:has-text("Use signature")');
    await page.waitForSelector('.ed-obj--signature');
    const r = await go();
    assert.match(r.name, /-signed\.pdf$/);
    const doc = await PDFDocument.load(r.buf);
    assert.equal(doc.getPageCount(), 3);
  });
  await test('sign-pdf: typed signature', async () => {
    await open('sign-pdf');
    await upload('sample.pdf');
    await page.waitForSelector('.modal .sig-pad');
    await page.click('.modal [data-tab="type"]');
    await page.fill('#sig-name', 'Alex Example');
    await page.click('.modal button:has-text("Use signature")');
    await page.waitForSelector('.ed-obj--signature');
    const r = await go();
    assert.ok(r.buf.length > 2000);
  });
  await test('highlight-pdf', async () => {
    await open('highlight-pdf');
    await upload('sample.pdf');
    await page.waitForSelector('.ed-page canvas');
    await dragOnPage(0, 70, 60, 330, 95);
    const r = await go();
    assert.equal(await pdfPages(r.buf), 3);
  });
  await test('annotate-pdf: sticky note becomes a PDF comment', async () => {
    await open('annotate-pdf');
    await upload('sample.pdf');
    await page.waitForSelector('.ed-page canvas');
    const box = await page.locator('.ed-page[data-page="0"] .ed-layer').boundingBox();
    await page.mouse.click(box.x + 200, box.y + 200);
    await page.fill('#note-text', 'Please check this figure');
    await page.click('.modal button:has-text("Add note")');
    const r = await go();
    const raw = r.buf.toString('latin1');
    assert.ok(/\/Subtype\s*\/Text/.test(raw) || (await PDFDocument.load(r.buf)).getPage(0).node.Annots());
  });
  await test('add-shapes-to-pdf: arrow', async () => {
    await open('add-shapes-to-pdf');
    await upload('sample.pdf');
    await page.waitForSelector('.ed-page canvas');
    await page.click('[data-tool="arrow"]');
    await dragOnPage(0, 100, 300, 300, 200);
    const r = await go();
    assert.equal(await pdfPages(r.buf), 3);
  });
  await test('redact-pdf removes the text under the box', async () => {
    await open('redact-pdf');
    await upload('sample.pdf');
    await page.waitForSelector('.ed-page canvas');
    const box = await page.locator('.ed-page[data-page="0"] .ed-layer').boundingBox();
    const s = box.width / 595;
    await dragOnPage(0, 50 * s, 60 * s, 500 * s, 130 * s);
    const r = await go();
    const text = await pdfText(r.buf);
    assert.equal(text.length, 3);
    assert.doesNotMatch(text[0], /Sample page 1/);
    assert.match(text[1], /Sample page 2/);
  });

  // --------------------------------------------------------- server via UI
  await test('compress-pdf (UI, server)', async () => {
    await open('compress-pdf');
    await upload('scan.pdf');
    const r = await go();
    assert.ok(r.buf.subarray(0, 5).toString() === '%PDF-');
  }, { needs: 'compress-pdf' });
  await test('protect-pdf (UI, server): mismatched passwords are caught', async () => {
    await open('protect-pdf');
    await upload('sample.pdf');
    await page.fill('#opt-password', 'abcd1');
    await page.fill('#opt-confirm', 'abcd2');
    await page.click('#tool-app [data-go]');
    await page.waitForSelector('.notice--error');
    await page.fill('#opt-confirm', 'abcd1');
    const r = await go();
    await assert.rejects(PDFDocument.load(r.buf));
  }, { needs: 'protect-pdf' });
  await test('image-to-text (UI, server)', async () => {
    await open('image-to-text');
    await upload('photo.jpg');
    const r = await go();
    assert.match(r.buf.toString(), /Sample page/);
  }, { needs: 'image-to-text' });
  await test('pdf-to-word (UI, server)', async () => {
    await open('pdf-to-word');
    await upload('sample.pdf');
    const r = await go();
    assert.equal(r.name, 'sample.docx');
    assert.equal(r.buf.subarray(0, 2).toString(), 'PK');
  }, { needs: 'pdf-to-word' });
  await test('unlock-pdf (UI, server): wrong password message', async () => {
    await open('unlock-pdf');
    await upload('locked.pdf');
    await page.fill('#opt-password', 'nope');
    await page.click('#tool-app [data-go]');
    await page.waitForSelector('#tool-app[data-state="error"]');
    assert.match(await page.textContent('#tool-app'), /password is not correct/);
    await page.click('[data-again]');
    await page.fill('#opt-password', 'secret');
    const r = await go();
    assert.equal(await pdfPages(r.buf), 3);
  }, { needs: 'unlock-pdf' });

  // ------------------------------------------------------- flows and layout
  await test('home: drop a PDF, pick a tool, file arrives', async () => {
    await page.goto(base);
    await page.setInputFiles('[data-home-drop] [data-input]', [fx.f('sample.pdf')]);
    await page.waitForSelector('[data-suggest] [data-go="split-pdf"]');
    await page.click('[data-suggest] [data-go="split-pdf"]');
    await page.waitForURL(/\/split-pdf$/);
    await page.waitForSelector('#tool-app[data-state="selected"] .pg');
  });
  await test('result: continue with another tool', async () => {
    await open('merge-pdf');
    await upload('sample.pdf', 'second.pdf');
    await go();
    await page.click('[data-next="split-pdf"]');
    await page.waitForURL(/\/split-pdf$/);
    await page.waitForSelector('.pg[data-src="4"]');
  });
  await test('tools page search', async () => {
    await page.goto(`${base}/tools`);
    await page.fill('[data-tool-search]', 'password');
    const visible = await page.$$eval('[data-tool-card]:not([hidden])', (els) => els.map((e) => e.getAttribute('href')));
    assert.ok(visible.includes('/protect-pdf') && visible.includes('/unlock-pdf'));
    assert.ok(!visible.includes('/merge-pdf'));
    await page.fill('[data-tool-search]', 'zzzzqq');
    await page.waitForSelector('[data-search-empty]:not([hidden])');
  });
  await test('no horizontal scrolling on phones', async () => {
    const phone = await browser.newPage({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    const bad = [];
    for (const p of ['/', '/tools', '/merge-pdf', '/edit-pdf', '/privacy', '/tools/convert', '/compress-pdf']) {
      await phone.goto(base + p);
      const w = await phone.evaluate(() => document.documentElement.scrollWidth);
      if (w > 362) bad.push(`${p}: ${w}px`);
    }
    await phone.goto(`${base}/merge-pdf`);
    await phone.setInputFiles('#tool-app [data-input]', [fx.f('sample.pdf'), fx.f('second.pdf')]);
    await phone.waitForSelector('#tool-app[data-state="selected"]');
    const w2 = await phone.evaluate(() => document.documentElement.scrollWidth);
    if (w2 > 362) bad.push(`/merge-pdf with files: ${w2}px`);
    await phone.goto(`${base}/edit-pdf`);
    await phone.setInputFiles('#tool-app [data-input]', [fx.f('sample.pdf')]);
    await phone.waitForSelector('.ed-page canvas');
    const w3 = await phone.evaluate(() => document.documentElement.scrollWidth);
    if (w3 > 362) bad.push(`/edit-pdf with file: ${w3}px`);
    await phone.click('.menu-toggle');
    assert.ok(await phone.isVisible('#mobile-menu'));
    await phone.close();
    assert.deepEqual(bad, []);
  });

  await browser.close();
  if (server) server.close();

  const failed = results.filter((r) => r[0] === 'FAIL');
  for (const r of results) console.log(`${r[0].padEnd(4)} ${r[1]}${r[0] === 'ok' ? ` (${r[2]} ms)` : r[2] ? `: ${r[2]}` : ''}`);
  if (consoleErrors.length) { console.log('\nConsole errors:'); consoleErrors.forEach((e) => console.log(`  ${e}`)); }
  console.log(`\n${results.filter((r) => r[0] === 'ok').length} passed, ${failed.length} failed, ${results.filter((r) => r[0] === 'skip').length} skipped`);
  if (failed.length) console.log(`Screenshots of failures: ${fx.dir}`); else fs.rmSync(fx.dir, { recursive: true, force: true });
  process.exit(failed.length || consoleErrors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
