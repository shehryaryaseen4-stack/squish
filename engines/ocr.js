'use strict';
// OCR (text recognition) with Tesseract, for the /image-to-text and /ocr-pdf pages.
//   images (JPG, PNG, WEBP, TIFF, BMP, GIF, HEIC ...)  -> read as one page
//   PDF                                                 -> each page rendered at 300 dpi (pdftoppm), then read
// Output: plain text (pages separated by a form feed and a "Page N" line), a searchable PDF (the
// page images with an invisible text layer, made by Tesseract and joined with qpdf), or an
// editable PDF (engines/pdfx/editable.py: the recognised lines taken out of the picture and
// written back as real text in the same size, color and weight, so they edit cleanly).

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { job, run, readCapped, UserError } = require('./cli');

const has = (bin) => (process.env.PATH || '').split(':').some((d) => { try { fsSync.accessSync(path.join(d, bin), fsSync.constants.X_OK); return true; } catch { return false; } });
const TESSERACT = has('tesseract');
const MAX_PAGES = Math.max(1, Number(process.env.OCR_MAX_PAGES || 20));
// Pages are read side by side (Tesseract uses one core each); one OCR job leaves a core for others.
const OCR_PARALLEL = Math.max(1, Number(process.env.OCR_PARALLEL || Math.min(4, Math.max(1, require('os').cpus().length - 1))));
// A page is rendered at 300 dpi, but never longer than this many pixels: a huge page (a long
// screenshot saved as PDF, a poster) would otherwise make a giant picture that takes Tesseract
// many times longer to read, with no better result.
const MAX_SIDE_PX = Math.max(1000, Number(process.env.OCR_MAX_SIDE_PX || 4200));

/** Runs fn over items, at most n at a time; results in order. */
async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

/** Resolution for rendering a PDF: 300 dpi, lower for very big pages (see MAX_SIDE_PX). */
async function renderDpi(file) {
  try {
    const { stdout } = await run('pdfinfo', [file], { timeoutMs: 20000 });
    const m = /Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(stdout.toString());
    if (!m) return 300;
    const side = Math.max(Number(m[1]), Number(m[2]));
    return Math.max(72, Math.min(300, Math.floor((MAX_SIDE_PX * 72) / side)));
  } catch { return 300; }
}

// Languages people pick from (the installed ones are offered); Tesseract codes.
const LANG_NAMES = { eng: 'English', spa: 'Spanish', fra: 'French', deu: 'German', ita: 'Italian', por: 'Portuguese', nld: 'Dutch' };
let LANGS = [];
if (TESSERACT) {
  try {
    const out = require('child_process').execFileSync('tesseract', ['--list-langs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    LANGS = out.split('\n').map((s) => s.trim()).filter((s) => LANG_NAMES[s]);
  } catch { LANGS = []; }
}
const available = () => TESSERACT && LANGS.includes('eng');

const PYTHON = process.env.PDF2DOCX_PYTHON || 'pdf2docx-python';
const EDITABLE = path.join(__dirname, 'pdfx', 'editable.py');
const isPdf = (buf) => buf.length > 4 && buf.subarray(0, 1024).includes('%PDF');

/**
 * @param {{buffer: Buffer, filename?: string, lang?: string, format?: 'txt'|'pdf'|'editable'}} p
 * @returns {Promise<{buffer: Buffer, ext: string, pages: number}>}
 */
async function ocr({ buffer, lang = 'eng', format = 'txt' }) {
  if (!available()) throw new UserError('Text recognition is not available on this server yet.', 503);
  // "eng" or "eng+spa": only installed languages, at most three
  const langs = String(lang).split('+').filter((l) => LANGS.includes(l)).slice(0, 3);
  const L = (langs.length ? langs : ['eng']).join('+');
  const out = ['pdf', 'editable'].includes(format) ? format : 'txt';
  const color = out === 'editable'; // the editable PDF keeps the picture's colors
  return job(async (dir) => {
    let pages = [];
    let dpi = 300;
    if (isPdf(buffer)) {
      const input = path.join(dir, 'input.pdf');
      await fs.writeFile(input, buffer);
      dpi = await renderDpi(input);
      try { await run('pdftoppm', ['-r', String(dpi), ...(color ? [] : ['-gray']), '-png', '-l', String(MAX_PAGES), input, path.join(dir, 'p')]); } catch (e) {
        if (/Incorrect password|encrypted/i.test(e.stderr || '')) throw new UserError('This PDF is password-protected. Remove the password with Unlock PDF, then try again.', 422);
        throw new UserError('This PDF could not be read. It may be damaged.', 415);
      }
      pages = (await fs.readdir(dir)).filter((f) => /^p-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).map((f) => path.join(dir, f));
      if (!pages.length) throw new UserError('This PDF has no pages to read.', 415);
    } else {
      // Any image: normalise to a grey PNG first (also handles HEIC, WEBP, AVIF, rotated phone photos)
      const sharp = require('sharp');
      const png = path.join(dir, 'p-1.png');
      try {
        let img = sharp(buffer, { failOn: 'none' }).rotate();
        if (!color) img = img.grayscale();
        else img = img.flatten({ background: '#ffffff' }); // transparent areas become white, not black
        await img.png().toFile(png);
      } catch {
        throw new UserError('This file could not be read. Upload a photo or scan (JPG, PNG, WEBP, HEIC, TIFF) or a PDF.', 415);
      }
      pages = [png];
    }
    const env = { OMP_THREAD_LIMIT: '1' }; // one core per page; several jobs can run side by side
    if (out === 'txt') {
      const texts = await mapLimit(pages, OCR_PARALLEL, async (img, i) => {
        const { stdout } = await run('tesseract', [img, 'stdout', '-l', L, '--psm', '3'], { env });
        const t = stdout.toString('utf8').replace(/\f/g, '').replace(/[ \t]+\n/g, '\n').trim();
        return pages.length > 1 ? `--- Page ${i + 1} ---\n${t}` : t;
      });
      const text = texts.join('\n\n').trim();
      return { buffer: Buffer.from(text ? `${text}\n` : '', 'utf8'), ext: 'txt', pages: pages.length };
    }
    if (out === 'editable') {
      const file = path.join(dir, 'editable.pdf');
      // pictures are taken as screen pixels (96 per inch), PDF pages were rendered at 300 dpi
      await run(PYTHON, [EDITABLE, file, L, isPdf(buffer) ? String(dpi) : '96', ...pages], { env: { ...env, OCR_PARALLEL: String(OCR_PARALLEL) } });
      return { buffer: await readCapped(file), ext: 'pdf', pages: pages.length };
    }
    const parts = await mapLimit(pages, OCR_PARALLEL, async (img) => {
      const base = img.replace(/\.png$/, '');
      // the page keeps its size: Tesseract is told the resolution it was rendered at
      await run('tesseract', [img, base, '-l', L, '--psm', '3', ...(isPdf(buffer) ? ['--dpi', String(dpi)] : []), 'pdf'], { env });
      return `${base}.pdf`;
    });
    let file = parts[0];
    if (parts.length > 1) {
      file = path.join(dir, 'searchable.pdf');
      await run('qpdf', ['--empty', '--pages', ...parts, '--', file]);
    }
    return { buffer: await readCapped(file), ext: 'pdf', pages: pages.length };
  });
}

module.exports = { ocr, available, langs: () => LANGS.map((id) => [id, LANG_NAMES[id]]), MAX_PAGES };
