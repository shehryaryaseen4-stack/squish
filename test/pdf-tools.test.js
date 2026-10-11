'use strict';
// PDF tools: the server side (protect, unlock, repair, PDF/A with qpdf and Ghostscript) and the
// pages (/split-pdf ... and /pdf-tools). The browser tools are checked by hand in a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { pdfTool, available } = require('../engines/pdf-tools');
const pages = require('../pages');
const { tools } = require('../content/pdf-tools');

async function samplePdf(n = 3) {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i++) d.addPage().drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 30 });
  return Buffer.from(await d.save());
}

test('protect adds a password and unlock removes it', { skip: !available('protect') && 'qpdf is not installed' }, async () => {
  const src = await samplePdf();
  const locked = await pdfTool({ buffer: src, op: 'protect', password: 'open sesame' });
  assert.ok(locked.buffer.toString('latin1').includes('/Encrypt'));
  await assert.rejects(() => PDFDocument.load(locked.buffer), /encrypt/i);
  await assert.rejects(() => pdfTool({ buffer: locked.buffer, op: 'unlock', password: 'wrong' }), (e) => /not correct/.test(e.userMessage));
  await assert.rejects(() => pdfTool({ buffer: locked.buffer, op: 'protect', password: 'again1' }), (e) => /already has a password/.test(e.userMessage));
  const open = await pdfTool({ buffer: locked.buffer, op: 'unlock', password: 'open sesame' });
  assert.equal((await PDFDocument.load(open.buffer)).getPageCount(), 3);
  assert.match((await pdfTool({ buffer: src, op: 'unlock' })).note, /no password/);
  await assert.rejects(() => pdfTool({ buffer: src, op: 'protect', password: 'abc' }), (e) => /at least 4/.test(e.userMessage));
});

test('repair rebuilds a PDF with a broken cross-reference table', { skip: !available('repair') && 'qpdf/Ghostscript missing' }, async () => {
  const d = await PDFDocument.create();
  for (let i = 0; i < 3; i++) d.addPage();
  const s = Buffer.from(await d.save({ useObjectStreams: false })).toString('latin1')
    .replace(/startxref\s+\d+/, 'startxref\n99999').replace(/xref[\s\S]*?trailer/, 'trailer');
  const fixed = await pdfTool({ buffer: Buffer.from(s, 'latin1'), op: 'repair' });
  assert.equal((await PDFDocument.load(fixed.buffer)).getPageCount(), 3);
  await assert.rejects(() => pdfTool({ buffer: Buffer.from('not a pdf at all'), op: 'repair' }), (e) => /could not be repaired/.test(e.userMessage));
});

test('PDF/A output carries the PDF/A identification and an output intent', { skip: !available('pdfa') && 'Ghostscript missing' }, async () => {
  const out = await pdfTool({ buffer: await samplePdf(1), op: 'pdfa', level: '2' });
  const s = out.buffer.toString('latin1');
  assert.match(s, /pdfaid:part[^0-9]{1,3}2/);
  assert.ok(s.includes('/OutputIntents'));
});

test('every PDF tool page renders with its tool, and the directory links only to real pages', () => {
  const BASE = 'https://example.test';
  const paths = new Set(pages.allPaths());
  for (const t of pages.PDF_TOOLS) {
    const html = pages.resolvePdfTool(t.slug, BASE).html;
    assert.ok(html.includes(`data-op="${t.op}"`), t.slug);
    assert.ok(html.includes('/pdf-tools.js?v='), t.slug);
    assert.ok(paths.has(`/${t.slug}`), t.slug);
    assert.ok(t.desc.length <= 160 && t.faq.length >= 5, t.slug);
  }
  assert.equal(pages.PDF_TOOLS.filter((t) => t.browser).length, tools.filter((t) => t.browser).length);
  const hub = pages.resolvePdfTool('pdf-tools', BASE).html;
  for (const [, href] of hub.matchAll(/class="pt-card" href="([^"]+)"/g)) assert.ok(paths.has(href), href);
  assert.equal(pages.resolvePdfTool('nope', BASE), null);
});
