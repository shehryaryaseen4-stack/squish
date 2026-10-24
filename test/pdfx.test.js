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
  assert.equal(out.ext, 'html');
  const index = out.buffer.toString('utf8');
  // one file that needs nothing else: styles inside, pictures and fonts as data: URLs
  assert.match(index, /<style>/);
  assert.doesNotMatch(index, /<link rel="stylesheet"|src="(?!data:)[^"]+"|url\((?!data:)/, 'nothing is loaded from other files');
  const text = decode(index.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' '));
  return { out, index, text };
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
  const sec = index.slice(0, index.indexOf(tag)).match(/<section class="page"[^>]*style="[^"]*width:([\d.]+)pt;height:([\d.]+)pt"/g);
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

test('PDF to HTML: pictures are separate images, links and tables are kept', { skip, timeout: 180000 }, async () => {
  const pics = await html('images.pdf');
  assert.equal((pics.index.match(/<img class="i" src="data:image\/(png|jpeg);base64,/g) || []).length, 2, 'each picture is its own image');
  const simple = await html('simple.pdf');
  assert.match(simple.index, /<a href="https:\/\/example\.com\/">/, 'the link is a real link');
  assert.match(simple.index, /<h[1-3]>/, 'the title is a heading');
  const styles = await html('styles.pdf');
  assert.match(styles.index, /<ul><li>/, 'the bullet list is a list');
  assert.match(styles.index, /color:#c00000/, 'coloured text keeps its colour');
  const tables = await html('tables.pdf');
  assert.match(tables.index, /<table class="t"/, 'the table is a <table>');
  assert.ok((tables.index.match(/<t[dh][ >]/g) || []).length >= 15, 'every cell is a table cell');
  assert.match(tables.index, /fill="#1d4ed8"/, 'the header row keeps its colour (drawn in the drawing layer)');
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

test('PDF to HTML goes through the PDF route and comes back as one HTML file', { skip, timeout: 180000 }, async () => {
  const { convertPdf } = require('../engines/pdf');
  const out = await convertPdf({ buffer: fixture('simple.pdf'), from: registry().getFormat('pdf'), to: registry().getFormat('html') });
  assert.equal(out.ext, 'html');
  assert.match(out.buffer.toString('utf8'), /Simple document/);
});

// ---------------------------------------------------------------- visual regression (HTML) --
// Each HTML file is saved alone in an empty folder (as when it is downloaded and double-clicked),
// opened in Chromium, and every page is compared with the PDF page rendered at the same scale
// (test/fixtures/visual_compare.py): page size, clearly different pixels, and the page composition
// (panels, pictures and text blocks in their places).
let playwright = null;
try { playwright = require('playwright'); } catch {
  try { playwright = require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } catch { playwright = null; }
}
const visualSkip = skip || (!playwright && 'Playwright is not installed');

async function shots(name, { js = true } = {}) {
  const out = await convert(name, 'html');
  const dir = fs.mkdtempSync(path.join(DIR, 'v-'));
  const file = path.join(dir, name.replace(/\.pdf$/, '.html'));
  fs.writeFileSync(file, out.buffer);
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, javaScriptEnabled: js });
    const problems = [];
    page.on('pageerror', (e) => problems.push(e.message));
    page.on('requestfailed', (r) => problems.push(`failed to load ${r.url().slice(0, 80)}`));
    await page.goto(`file://${file}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).length);
    const selectable = await page.evaluate(() => document.querySelector('.page').innerText.trim().length);
    const files = [];
    const sections = await page.$$('section.page');
    for (let i = 0; i < sections.length; i++) {
      files.push(path.join(dir, `page-${i + 1}.png`));
      await sections[i].screenshot({ path: files[i] });
    }
    const report = execFileSync('pdf2docx-python', [path.join(__dirname, 'fixtures', 'visual_compare.py'), path.join(DIR, name), ...files])
      .toString().trim().split('\n').map((l) => JSON.parse(l));
    return { report, broken, problems, selectable };
  } finally { await browser.close(); }
}

for (const name of ['resume.pdf', 'simple.pdf', 'styles.pdf', 'images.pdf', 'tables.pdf', 'multipage.pdf', 'columns.pdf', 'rotated.pdf', 'unicode.pdf']) {
  test(`PDF to HTML looks like the PDF when opened on its own (${name})`, { skip: visualSkip, timeout: 240000 }, async () => {
    const { report, broken, problems, selectable } = await shots(name);
    assert.equal(broken, 0, 'every picture loads');
    assert.deepEqual(problems, [], 'nothing fails to load');
    assert.ok(selectable > 0, 'the page text is real, selectable text');
    for (const p of report) {
      assert.ok(p.size_ok, `page ${p.page}: the HTML page has the PDF page's size (${p.html_px} vs ${p.pdf_px})`);
      assert.ok(p.layout_bad_pct < 1.5, `page ${p.page}: panels, pictures and text are where the PDF has them (${p.layout_bad_pct}% of the page differs)`);
      assert.ok(p.diff_pct < 2.5, `page ${p.page}: ${p.diff_pct}% of the pixels differ`);
    }
  });
}

test('PDF to HTML keeps its layout without JavaScript (resume.pdf)', { skip: visualSkip, timeout: 240000 }, async () => {
  const { report, broken } = await shots('resume.pdf', { js: false });
  assert.equal(broken, 0);
  for (const p of report) assert.ok(p.layout_bad_pct < 1.5 && p.diff_pct < 2.5, JSON.stringify(p));
});

// ------------------------------------------------------------------ DOCX validity (Word) --
// Word refuses documents that break the WordprocessingML schema or the package rules, even when
// LibreOffice opens them. Every Word file is checked with engines/pdfx/validate_docx.py (also run
// by the converter itself before a download is offered) and opened with LibreOffice.
const VALIDATOR = path.join(__dirname, '..', 'engines', 'pdfx', 'validate_docx.py');
const validateDocx = (file) => {
  try { return { ok: true, out: execFileSync('pdf2docx-python', [VALIDATOR, file]).toString() }; } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
};
const openInLibreOffice = (file) => {
  const dir = fs.mkdtempSync(path.join(DIR, 'lo-'));
  execFileSync('soffice', ['--headless', '--norestore', `-env:UserInstallation=file://${dir}/profile`, '--convert-to', 'pdf', '--outdir', dir, file],
    { stdio: 'pipe', timeout: 120000 });
  const pdf = path.join(dir, path.basename(file).replace(/\.docx$/, '.pdf'));
  assert.ok(fs.existsSync(pdf), 'LibreOffice opened the document and exported it');
  lastExport = pdf;
  return Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf]).toString())[1]);
};
let lastExport = null;

for (const [name, ocr] of [['simple.pdf'], ['styles.pdf'], ['tables.pdf'], ['images.pdf'], ['multipage.pdf'], ['resume.pdf'], ['mixed.pdf'],
  ['rotated.pdf'], ['unicode.pdf'], ['scanned.pdf', true]]) {
  test(`PDF to Word makes a valid DOCX that opens (${name}${ocr ? ', OCR' : ''})`, { skip: (skip || (ocr && !OCR && 'Tesseract is not installed')), timeout: 240000 }, async () => {
    const out = await convert(name, 'docx', !!ocr);
    assert.equal(out.ext, 'docx');
    assert.equal(out.buffer.subarray(0, 2).toString('latin1'), 'PK', 'a ZIP package, not HTML or text renamed');
    const file = path.join(fs.mkdtempSync(path.join(DIR, 'd-')), name.replace(/\.pdf$/, '.docx'));
    fs.writeFileSync(file, out.buffer);
    const v = validateDocx(file);
    assert.ok(v.ok, `the DOCX passes the package and schema checks:\n${v.out}`);
    const zip = await JSZip.loadAsync(out.buffer);
    for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels']) assert.ok(zip.file(part), `${part} is present`);
    // text is body text, not text boxes (only rotated or vertical text may use one)
    const body = await zip.file('word/document.xml').async('string');
    if (name !== 'rotated.pdf') assert.doesNotMatch(body, /<wps:txbx>|<w:txbxContent>/, 'no text boxes');
    assert.doesNotMatch(body, /<w:tblpPr/, 'no floating tables (they become frames)');
    if (has('soffice')) {
      const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [path.join(DIR, name)]).toString())[1]);
      assert.equal(openInLibreOffice(file), pages, 'LibreOffice shows as many pages as the PDF has');
      if (['resume.pdf', 'styles.pdf', 'tables.pdf', 'images.pdf', 'multipage.pdf', 'mixed.pdf'].includes(name)) {
        // the Word document's first page, as LibreOffice draws it, against the PDF's
        const shot = `${lastExport}-1`;
        execFileSync('pdftoppm', ['-r', '96', '-png', '-singlefile', '-f', '1', '-l', '1', lastExport, shot]);
        const [p] = execFileSync('pdf2docx-python', [path.join(__dirname, 'fixtures', 'visual_compare.py'), path.join(DIR, name), `${shot}.png`])
          .toString().trim().split('\n').map((l) => JSON.parse(l));
        assert.ok(p.size_ok && p.layout_bad_pct < 2, `the Word page looks like the PDF page: ${JSON.stringify(p)}`);
      }
    }
  });
}

test('the DOCX validator rejects what Word would refuse', { skip, timeout: 180000 }, async () => {
  const out = await convert('styles.pdf', 'docx');
  const zip = await JSZip.loadAsync(out.buffer);
  const xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /<w:numPr>/, 'the sample has a list');
  // the bug Word refused: list numbering after other paragraph properties
  const wrong = xml.replace(/(<w:widowControl w:val="0"\/>)(<w:numPr>.*?<\/w:numPr>)(<w:autoSpaceDE w:val="0"\/><w:autoSpaceDN w:val="0"\/>)/, '$1$3$2');
  assert.notEqual(wrong, xml);
  zip.file('word/document.xml', wrong);
  const dir = fs.mkdtempSync(path.join(DIR, 'bad-'));
  fs.writeFileSync(path.join(dir, 'order.docx'), await zip.generateAsync({ type: 'nodebuffer' }));
  const v = validateDocx(path.join(dir, 'order.docx'));
  assert.ok(!v.ok && /numPr/.test(v.out), `misordered paragraph properties are caught:\n${v.out}`);
  // a picture whose relationship is missing
  const zip2 = await JSZip.loadAsync((await convert('images.pdf', 'docx')).buffer);
  const rels = await zip2.file('word/_rels/document.xml.rels').async('string');
  zip2.file('word/_rels/document.xml.rels', rels.replace(/<Relationship [^>]*Type="[^"]*\/image"[^>]*\/>/, ''));
  fs.writeFileSync(path.join(dir, 'rel.docx'), await zip2.generateAsync({ type: 'nodebuffer' }));
  const v2 = validateDocx(path.join(dir, 'rel.docx'));
  assert.ok(!v2.ok && /not a relationship of this part/.test(v2.out), `a missing picture relationship is caught:\n${v2.out}`);
  fs.writeFileSync(path.join(dir, 'html.docx'), '<html><body>not a docx</body></html>');
  assert.ok(!validateDocx(path.join(dir, 'html.docx')).ok, 'HTML renamed to .docx is caught');
});

test('PDF to Word: a two-column resume becomes flowing text in a borderless layout table', { skip, timeout: 240000 }, async () => {
  const { xml, text } = await docx('resume.pdf');
  const body = xml.slice(xml.indexOf('<w:body>'));
  assert.doesNotMatch(body, /<wps:txbx>|<w:txbxContent>/, 'no text boxes');
  const tbl = /<w:tbl>([\s\S]*?)<\/w:tbl>/.exec(body);
  assert.ok(tbl, 'the sidebar and the main column sit in a layout table');
  assert.equal((tbl[1].match(/<w:gridCol /g) || []).length, 2, 'two columns');
  assert.match(tbl[1], /<w:insideV w:val="nil"\/>/, 'without borders');
  assert.match(tbl[1], /<w:tblCellMar><w:top w:w="0"/, 'without cell padding');
  const cells = tbl[1].split('<w:tc>').slice(1);
  assert.match(cells[0], /CONTACT[\s\S]*SKILLS/, 'the sidebar text is in the first column');
  assert.match(cells[1], /MUNEEB MIRZA[\s\S]*PROFILE/, 'the main text is in the second column');
  assert.match(body, /behindDoc="1"/, 'the sidebar panel and the photo stay behind the text');
  assert.match(text, /Architect \| Architectural Designer/);
});
