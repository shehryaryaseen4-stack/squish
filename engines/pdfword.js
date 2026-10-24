'use strict';
// PDF -> Word (DOCX, and DOC/ODT/RTF from it) and PDF -> HTML, rebuilt from the PDF's content by
// engines/pdfx (Python: PyMuPDF for text, fonts, pictures, drawings, tables and links; Tesseract
// for OCR; python-docx for Word). Nothing is turned into a page screenshot: text stays text in its
// fonts, pictures are separate images, drawings become shapes, ruled tables become tables.
//   No OCR  the PDF's own text only; scanned pages are reported (and keep their pictures)
//   OCR     scanned pages are read with Tesseract (real recognition, with orientation detection)
// HTML comes back as one self-contained file (styles, pictures and fonts inside it), so it shows
// correctly wherever it is opened.

const fs = require('fs/promises');
const path = require('path');
const { job, run, UserError } = require('./cli');

const RUNNER = path.join(__dirname, 'pdfx', 'run.py');
const PYTHON = process.env.PDF2DOCX_PYTHON || 'pdf2docx-python';
const MAX_PAGES = Math.max(1, Number(process.env.PDF2DOCX_MAX_PAGES || 150));
let PY_OK = null;
const available = () => (PY_OK === null ? (PY_OK = !!require('./detect').hasBin(PYTHON)) : PY_OK);

const EXIT = {
  2: ['This PDF could not be read. It may be damaged.', 415],
  3: ['This PDF is password-protected. Remove the password with Unlock PDF, then try again.', 422],
  5: ['This PDF has no pages.', 422],
  6: ['This PDF is a scan: its pages are pictures with no text in them. Choose OCR to turn the scanned text into editable text.', 422],
  7: ['The Word file made from this PDF did not pass the validity check, so it was not offered for download. Please try again, or contact us with the PDF.', 500],
};

async function convertPdfWord({ buffer, to, ocr: wantOcr = false, lang = '' }) {
  return job(async (dir) => {
    const input = path.join(dir, 'input.pdf');
    await fs.writeFile(input, buffer);
    let pages = 0;
    try { pages = Number((/Pages:\s+(\d+)/.exec((await run('pdfinfo', [input])).stdout.toString()) || [])[1] || 0); } catch (e) {
      if (/Incorrect password|encrypted/i.test(e.stderr || '')) throw new UserError(EXIT[3][0]);
      throw new UserError(EXIT[2][0], 415);
    }
    if (!pages) throw new UserError(EXIT[5][0]);
    if (pages > MAX_PAGES) throw new UserError(`This PDF has ${pages} pages; up to ${MAX_PAGES} can be converted at once. Split it with Split PDF first.`, 413);
    const ocr = require('./ocr');
    const notes = [];
    if (wantOcr && !ocr.available()) {
      throw new UserError('OCR is not available on this server (the Tesseract OCR engine is not installed), so scanned pages cannot be read. Choose No OCR to convert the PDF\'s own text.', 503);
    }
    if (wantOcr && pages > ocr.MAX_PAGES * 5) throw new UserError(`OCR can read up to ${ocr.MAX_PAGES * 5} pages at once; this PDF has ${pages}. Split it with Split PDF first, or choose No OCR.`, 413);
    const installed = ocr.langs().map(([id]) => id);
    let L = String(lang || 'eng');
    if (!installed.includes(L)) {
      if (wantOcr && lang) notes.push(`The OCR language "${L}" is not installed; English was used.`);
      L = 'eng';
    }
    const html = to.id === 'html';
    const out = path.join(dir, html ? 'output.html' : 'output.docx');
    let report = {};
    try {
      const { stdout } = await run(PYTHON, [RUNNER, input, out, wantOcr ? 'ocr' : 'text', L], {
        timeoutMs: Math.max(180, pages * (wantOcr ? 45 : 20)) * 1000, env: { OMP_THREAD_LIMIT: '1' },
      });
      const last = stdout.toString().trim().split('\n').pop();
      try { report = JSON.parse(last); } catch { report = {}; }
    } catch (e) {
      if (e.userMessage) throw e;
      const code = Number((/exited with code (\d+)/.exec(e.message) || [])[1]);
      if (code === 7) console.error('PDF to Word produced an invalid DOCX:', (e.stderr || '').slice(-2000));
      if (EXIT[code]) throw new UserError(EXIT[code][0], EXIT[code][1]);
      if (/password|encrypt/i.test(e.stderr || '')) throw new UserError(EXIT[3][0]);
      console.error('PDF conversion failed:', (e.stderr || e.message || '').slice(-1500));
      throw new UserError(`This PDF could not be converted to ${to.label}. It may be damaged or use features this converter cannot read.`, 415);
    }
    notes.push(...(report.warnings || []));
    if (report.ocr_pages && report.ocr_pages.length) notes.push(`OCR read page${report.ocr_pages.length > 1 ? 's' : ''} ${report.ocr_pages.join(', ')}.`);
    if (report.fonts_substituted && report.fonts_substituted.length) {
      notes.push(`Font${report.fonts_substituted.length > 1 ? 's' : ''} ${report.fonts_substituted.slice(0, 4).join(', ')} could not be embedded and ${report.fonts_substituted.length > 1 ? 'were' : 'was'} replaced by a similar common font.`);
    }
    const result = await fs.readFile(out);
    if (html) return { buffer: result, ext: 'html', mime: 'text/html; charset=utf-8', notes };
    if (to.id === 'docx') return { buffer: result, ext: 'docx', notes };
    // other Word formats from the DOCX
    const filter = { doc: 'doc:MS Word 97', odt: 'odt', rtf: 'rtf:Rich Text Format' }[to.id];
    if (!filter) throw new UserError(`Converting PDF to ${to.label} is not supported yet.`);
    const outDir = path.join(dir, 'out');
    await fs.mkdir(outDir);
    await run('soffice', ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${path.join(dir, 'profile')}`,
      '--convert-to', filter, '--outdir', outDir, out], { env: { HOME: dir } });
    const [f] = await fs.readdir(outDir);
    if (!f) throw new UserError(`This PDF could not be converted to ${to.label}.`, 415);
    return { buffer: await fs.readFile(path.join(outDir, f)), ext: to.extension, notes };
  });
}

module.exports = { convertPdfWord, available };
