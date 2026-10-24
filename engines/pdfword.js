'use strict';
// PDF -> Word that looks exactly like the PDF (engines/exactdocx_run.py, Python with PyMuPDF,
// OpenCV and python-docx): every page keeps its size, its design stays as a picture behind, and
// every line of text is editable Word text in a borderless text box at the same place, in the same
// font, size and colour. Nothing is reflowed, so nothing moves.
// Pages with no text of their own (scans) are read with OCR (Tesseract); "OCR" in the PDF to Word
// dialog reads every page that way. DOC, ODT and RTF are made from the DOCX with LibreOffice.
// PDF -> HTML is the same exact copy as a web page (engines/pdf.js hands it over).

const fs = require('fs/promises');
const path = require('path');
const { job, run, UserError } = require('./cli');

const RUNNER = path.join(__dirname, 'exactdocx_run.py');
const PYTHON = process.env.PDF2DOCX_PYTHON || 'pdf2docx-python';
const MAX_PAGES = Math.max(1, Number(process.env.PDF2DOCX_MAX_PAGES || 150));
let PY_OK = null;
const available = () => (PY_OK === null ? (PY_OK = !!require('./detect').hasBin(PYTHON)) : PY_OK);

async function convertPdfWord({ buffer, to, ocr: wantOcr = false }) {
  return job(async (dir) => {
    const input = path.join(dir, 'input.pdf');
    const docx = path.join(dir, to.id === 'html' ? 'output.html' : 'output.docx');
    await fs.writeFile(input, buffer);
    let pages = 0;
    try { pages = Number((/Pages:\s+(\d+)/.exec((await run('pdfinfo', [input])).stdout.toString()) || [])[1] || 0); } catch (e) {
      if (/Incorrect password|encrypted/i.test(e.stderr || '')) throw new UserError('This PDF is password-protected. Remove the password with Unlock PDF, then try again.');
      throw new UserError('This PDF could not be read. It may be damaged.', 415);
    }
    if (pages > MAX_PAGES) throw new UserError(`This PDF has ${pages} pages; up to ${MAX_PAGES} can be converted to Word at once. Split it with Split PDF first.`, 413);
    const ocr = require('./ocr');
    if (wantOcr && pages > ocr.MAX_PAGES) throw new UserError(`OCR can read up to ${ocr.MAX_PAGES} pages at once; this PDF has ${pages}. Split it with Split PDF first, or choose No OCR.`, 413);
    const mode = !ocr.available() ? 'text' : wantOcr ? 'ocr' : 'auto';
    try {
      await run(PYTHON, [RUNNER, input, docx, mode, 'eng'], { timeoutMs: Math.max(120, pages * (mode === 'ocr' ? 40 : 15)) * 1000, env: { OMP_THREAD_LIMIT: '1' } });
    } catch (e) {
      if (e.userMessage) throw e;
      if (/exited with code 4/.test(e.message)) throw new UserError('No text was found in this PDF. If it is a photo or scan, try a clearer copy.', 422);
      if (/password|encrypt/i.test(e.stderr || '')) throw new UserError('This PDF is password-protected. Remove the password with Unlock PDF, then try again.');
      throw new UserError('This PDF could not be converted to Word. It may be damaged.', 415);
    }
    if (to.id === 'docx' || to.id === 'html') return { buffer: await fs.readFile(docx), ext: to.id };
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

module.exports = { convertPdfWord, available };
