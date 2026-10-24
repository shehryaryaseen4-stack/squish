'use strict';
// PDF -> Word with pdf2docx (Python, on PyMuPDF): it rebuilds the page as real Word content, so
// tables, fonts, colours, images and the layout stay in place, unlike an ebook-style reflow.
// DOC, ODT and RTF are made from that DOCX with LibreOffice.
// Scanned PDFs (pages that are only pictures, with no text inside) would come out as pictures in
// Word; for those ocrdocx_run.py reads the text with OCR (Tesseract) and builds a Word file that
// looks like the page: the design as a picture behind, the text editable at its place on top.

const fs = require('fs/promises');
const path = require('path');
const { job, run, UserError } = require('./cli');

const RUNNER = path.join(__dirname, 'pdf2docx_run.py');
const OCR_RUNNER = path.join(__dirname, 'ocrdocx_run.py');
const PYTHON = process.env.PDF2DOCX_PYTHON || 'pdf2docx-python';
const MAX_PAGES = Math.max(1, Number(process.env.PDF2DOCX_MAX_PAGES || 150));

async function convertPdfWord({ buffer, to, ocr: wantOcr = false }) {
  return job(async (dir) => {
    const input = path.join(dir, 'input.pdf');
    const docx = path.join(dir, 'output.docx');
    await fs.writeFile(input, buffer);
    let pages = 0;
    try { pages = Number((/Pages:\s+(\d+)/.exec((await run('pdfinfo', [input])).stdout.toString()) || [])[1] || 0); } catch (e) {
      if (/Incorrect password|encrypted/i.test(e.stderr || '')) throw new UserError('This PDF is password-protected. Remove the password with Unlock PDF, then try again.');
      throw new UserError('This PDF could not be read. It may be damaged.', 415);
    }
    if (pages > MAX_PAGES) throw new UserError(`This PDF has ${pages} pages; up to ${MAX_PAGES} can be converted to Word at once. Split it with Split PDF first.`, 413);
    // a scanned PDF has (almost) no text of its own: read it with OCR so the Word file can be edited
    let chars = 0;
    try { chars = (await run('pdftotext', ['-q', input, '-'])).stdout.toString().replace(/\s+/g, '').length; } catch { chars = 0; }
    // little text and no fonts at all means the pages are pictures (a short real document has fonts)
    let fonts = 1;
    if (chars < 25 * Math.max(1, pages)) {
      try { fonts = (await run('pdffonts', [input])).stdout.toString().trim().split('\n').length - 2; } catch { fonts = 1; }
    }
    const ocr = require('./ocr');
    // the visitor can also ask for OCR ("OCR" in the PDF to Word dialog), e.g. for a PDF that mixes scans and text
    const scanned = (wantOcr || fonts <= 0) && ocr.available();
    if (scanned) {
      // OCR runs inside this job (calling ocr.ocr would wait for a second job slot)
      if (pages > ocr.MAX_PAGES) throw new UserError(`This is a scanned PDF of ${pages} pages; up to ${ocr.MAX_PAGES} scanned pages can be turned into Word at once. Split it with Split PDF first.`, 413);
      try {
        await run(PYTHON, [OCR_RUNNER, input, docx, 'eng'], { timeoutMs: Math.max(120, pages * 40) * 1000, env: { OMP_THREAD_LIMIT: '1' } });
      } catch (e) {
        if (e.userMessage) throw e;
        if (/exited with code 4/.test(e.message)) throw new UserError('No text was found in this PDF. If it is a photo or scan, try a clearer copy.', 422);
        throw new UserError('This PDF could not be read with OCR. It may be damaged.', 415);
      }
    } else try {
      await run(PYTHON, [RUNNER, input, docx], { timeoutMs: Math.max(120, pages * 6) * 1000 });
    } catch (e) {
      if (e.userMessage) throw e;
      if (/password|encrypt/i.test(e.stderr || '')) throw new UserError('This PDF is password-protected. Remove the password with Unlock PDF, then try again.');
      throw new UserError('This PDF could not be converted to Word. It may be damaged.', 415);
    }
    if (to.id === 'docx') return { buffer: await fs.readFile(docx), ext: 'docx' };
    // other Word formats from the DOCX
    const filter = { doc: 'doc:MS Word 97', odt: 'odt', rtf: 'rtf:Rich Text Format' }[to.id];
    if (!filter) throw new UserError(`Converting PDF to ${to.label} is not supported yet.`);
    const outDir = path.join(dir, 'out');
    await fs.mkdir(outDir);
    await run('soffice', ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${path.join(dir, 'profile')}`,
      '--convert-to', filter, '--outdir', outDir, docx], { env: { HOME: dir } });
    const [f] = await fs.readdir(outDir);
    if (!f) throw new UserError(`This PDF could not be converted to ${to.label}.`, 415);
    return { buffer: await fs.readFile(path.join(outDir, f)), ext: to.extension };
  });
}

module.exports = { convertPdfWord };
