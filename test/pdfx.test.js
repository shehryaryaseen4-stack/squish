'use strict';
// PDF to HTML and PDF to Word (engines/pdfword.js + engines/pdfx): a set of test PDFs is built
// (test/fixtures/make_pdfs.py), converted both ways, and the results are checked as files:
// real text (not page pictures), page count, tables, pictures, links, headers/footers, OCR.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const JSZip = require('jszip');

const has = (bin) => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };
const READY = has('pdf2docx-python') && has('pdftotext');
const OCR = READY && has('tesseract');
const skip = !READY && 'the PDF converter (pdf2docx-python) is not installed';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'squish-pdfx-'));
test.after(() => fs.rmSync(DIR, { recursive: true, force: true }));

let made = false;
const fixture = (name) => {
  if (!made) {
    execFileSync('pdf2docx-python', [path.join(__dirname, 'fixtures', 'make_pdfs.py'), DIR], { stdio: 'ignore' });
    made = true;
  }
  return fs.readFileSync(path.join(DIR, name));
};
const registry = () => require('../registry');
const convert = async (name, to, ocr = false) => {
  const { convertPdfWord } = require('../engines/pdfword');
  return convertPdfWord({ buffer: fixture(name), to: registry().getFormat(to), ocr, lang: 'eng' });
};
const words = (text) => (text.normalize('NFKC').match(/[\p{L}\p{N}]{3,}/gu) || []).map((w) => w.toLowerCase());
const pdfWords = (name) => { fixture(name); return words(execFileSync('pdftotext', [path.join(DIR, name), '-']).toString()); };
const coverage = (src, out) => {
  const have = new Set(words(out));
  return src.filter((w) => have.has(w)).length / Math.max(1, src.length);
};
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');

async function html(name, ocr = false) {
  const out = await convert(name, 'html', ocr);
  assert.equal(out.ext, 'zip');
  const zip = await JSZip.loadAsync(out.buffer);
  const index = await zip.file('index.html').async('string');
  assert.ok(zip.file('style.css'), 'the package has its stylesheet');
  const text = decode(index.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' '));
  return { out, zip, index, text };
}

async function docx(name, ocr = false) {
  const out = await convert(name, 'docx', ocr);
  const zip = await JSZip.loadAsync(out.buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const parts = await Promise.all(Object.keys(zip.files).filter((f) => /^word\/(header|footer)\d*\.xml$/.test(f)).map((f) => zip.file(f).async('string')));
  const text = (x) => decode((x.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(' '));
  return { out, zip, xml, text: text(xml), hf: parts.map(text).join(' '), hfXml: parts.join('') };
}

// a page-sized <img> would mean the page was flattened into a picture
const pagePictures = (index) => (index.match(/<img class="[ri]"[^>]*>/g) || []).filter((tag) => {
  const sec = index.slice(0, index.indexOf(tag)).match(/<section class="page"[^>]*style="width:([\d.]+)pt;height:([\d.]+)pt"/g);
  const [, pw, ph] = /width:([\d.]+)pt;height:([\d.]+)pt/.exec(sec[sec.length - 1]);
  const m = /width:([\d.]+)pt;height:([\d.]+)pt/.exec(tag);
  return m && Number(m[1]) >= Number(pw) * 0.9 && Number(m[2]) >= Number(ph) * 0.9;
});

for (const [name, what] of [['simple.pdf', 'paragraphs'], ['styles.pdf', 'fonts and colours'], ['tables.pdf', 'a table'],
  ['multipage.pdf', 'several pages'], ['columns.pdf', 'two columns'], ['rotated.pdf', 'a rotated page'], ['unicode.pdf', 'non-English text'],
  ['images.pdf', 'pictures']]) {
  test(`PDF to HTML: ${what} become real HTML text (${name})`, { skip, timeout: 180000 }, async () => {
    const { index, text } = await html(name);
    const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [path.join(DIR, name)]).toString())[1]);
    assert.equal((index.match(/<section class="page"/g) || []).length, pages, 'one page section per PDF page, in order');
    assert.ok(coverage(pdfWords(name), text) >= 0.97, 'the PDF\'s words are in the HTML as text');
    assert.deepEqual(pagePictures(index), [], 'no page is a full-page picture');
  });
  test(`PDF to Word: ${what} become editable Word text (${name})`, { skip, timeout: 180000 }, async () => {
    const { xml, text, hf, zip } = await docx(name);
    const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [path.join(DIR, name)]).toString())[1]);
    assert.equal((xml.match(/<w:sectPr/g) || []).length, pages, 'one Word section (page) per PDF page');
    assert.ok(coverage(pdfWords(name), `${text} ${hf}`) >= 0.97, 'the PDF\'s words are Word text');
    const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
    assert.ok(media.length <= 2, 'pages are not flattened into pictures');
  });
}

test('PDF to HTML: pictures are separate image files, links and tables are kept', { skip, timeout: 180000 }, async () => {
  const pics = await html('images.pdf');
  assert.equal(Object.keys(pics.zip.files).filter((f) => /^images\/.+\.(png|jpg)$/.test(f)).length, 2, 'both pictures are their own files');
  assert.match(pics.index, /<img class="i" src="images\//);
  const simple = await html('simple.pdf');
  assert.match(simple.index, /<a href="https:\/\/example\.com\/">/, 'the link is a real link');
  assert.match(simple.index, /<h[1-3]>/, 'the title is a heading');
  const styles = await html('styles.pdf');
  assert.match(styles.index, /<ul><li>/, 'the bullet list is a list');
  assert.match(styles.index, /color:#c00000/, 'coloured text keeps its colour');
  const tables = await html('tables.pdf');
  assert.match(tables.index, /<table class="t"/, 'the table is a <table>');
  assert.ok((tables.index.match(/<t[dh][ >]/g) || []).length >= 15, 'every cell is a table cell');
  assert.match(tables.index, /background:#1d4ed8/, 'the header row keeps its colour');
  const uni = await html('unicode.pdf');
  for (const w of ['Größe', 'Καλημέρα', 'Привет', '¿Dónde']) assert.ok(uni.text.includes(w), `${w} is in the HTML`);
});

test('PDF to Word: tables, pictures, links, styles, header/footer and page size', { skip, timeout: 180000 }, async () => {
  const tables = await docx('tables.pdf');
  assert.match(tables.xml, /<w:tbl[ >]/, 'the table is a Word table');
  assert.match(tables.xml, /<w:shd w:val="clear" w:color="auto" w:fill="1D4ED8"\/>/, 'the header row keeps its colour');
  assert.ok((tables.xml.match(/<w:tc>/g) || []).length >= 15);
  const pics = await docx('images.pdf');
  assert.equal(Object.keys(pics.zip.files).filter((f) => f.startsWith('word/media/')).length, 2, 'each picture is its own image');
  const simple = await docx('simple.pdf');
  assert.match(simple.xml, /<w:hyperlink r:id="/, 'the link is a Word hyperlink');
  const rels = await simple.zip.file('word/_rels/document.xml.rels').async('string');
  assert.match(rels, /Target="https:\/\/example\.com\/"/);
  const styles = await docx('styles.pdf');
  assert.match(styles.xml, /<w:b\/>/, 'bold text is bold');
  assert.match(styles.xml, /<w:color w:val="C00000"\/>/, 'red text is red');
  assert.match(styles.xml, /<w:numPr>/, 'the bullet list is a Word list');
  const multi = await docx('multipage.pdf');
  assert.match(multi.hf, /ACME Corporation/, 'the repeated header is the Word header');
  assert.match(multi.hfXml, /<w:instrText[^>]*> PAGE <\/w:instrText>/, 'the page number is a page-number field');
  const rot = await docx('rotated.pdf');
  assert.match(rot.xml, /w:orient="landscape"/, 'the rotated page is a landscape page');
  const settings = await (await docx('styles.pdf')).zip.file('word/settings.xml').async('string');
  assert.ok(settings.length > 0);
});

test('PDF to Word/HTML: a scanned PDF needs OCR, and says so without it', { skip, timeout: 180000 }, async () => {
  await assert.rejects(convert('scanned.pdf', 'docx', false), (e) => /Choose OCR/.test(e.userMessage));
  await assert.rejects(convert('scanned.pdf', 'html', false), (e) => /Choose OCR/.test(e.userMessage));
  const mixed = await docx('mixed.pdf');
  assert.ok(mixed.out.notes.some((n) => /Page 2 is a scanned picture/.test(n)), 'the scanned page is reported');
  assert.match(mixed.text, /Simple document/, 'the text page is converted');
});

test('OCR: scanned and mixed PDFs become editable text in Word and HTML', { skip: !OCR && 'Tesseract is not installed', timeout: 300000 }, async () => {
  const src = pdfWords('styles.pdf');
  const d = await docx('scanned.pdf', true);
  assert.ok(coverage(src, d.text) >= 0.9, 'most words were recognised as Word text');
  assert.ok(d.out.notes.some((n) => /OCR read page 1/.test(n)));
  const h = await html('scanned.pdf', true);
  assert.ok(coverage(src, h.text) >= 0.9, 'most words were recognised as HTML text');
  const m = await docx('mixed.pdf', true);
  assert.match(m.text, /Simple document/);
  assert.match(m.text, /Quarterly Sales Report/);
});

test('PDF to Word/HTML: locked and damaged PDFs get a clear message', { skip, timeout: 120000 }, async () => {
  await assert.rejects(convert('locked.pdf', 'docx'), (e) => /password/i.test(e.userMessage));
  const { convertPdfWord } = require('../engines/pdfword');
  await assert.rejects(convertPdfWord({ buffer: Buffer.from('%PDF-1.7\nthis is not really a pdf'), to: registry().getFormat('docx') }),
    (e) => /could not be read|damaged/i.test(e.userMessage));
});

test('PDF to HTML goes through the PDF route and comes back as a ZIP package', { skip, timeout: 180000 }, async () => {
  const { convertPdf } = require('../engines/pdf');
  const out = await convertPdf({ buffer: fixture('simple.pdf'), from: registry().getFormat('pdf'), to: registry().getFormat('html') });
  assert.equal(out.ext, 'zip');
  const zip = await JSZip.loadAsync(out.buffer);
  assert.match(await zip.file('index.html').async('string'), /Simple document/);
});
