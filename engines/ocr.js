'use strict';
// OCR (text recognition) with Tesseract, for the /image-to-text and /ocr-pdf pages.
//   images (JPG, PNG, WEBP, TIFF, BMP, GIF, HEIC ...)  -> read as one page
//   PDF                                                 -> each page rendered at 300 dpi (pdftoppm), then read
// Output: plain text (pages separated by a form feed and a "Page N" line) or a searchable PDF (the
// page images with an invisible text layer, made by Tesseract and joined with qpdf).

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { job, run, readCapped, UserError } = require('./cli');

const has = (bin) => (process.env.PATH || '').split(':').some((d) => { try { fsSync.accessSync(path.join(d, bin), fsSync.constants.X_OK); return true; } catch { return false; } });
const TESSERACT = has('tesseract');
const MAX_PAGES = Math.max(1, Number(process.env.OCR_MAX_PAGES || 20));

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

const isPdf = (buf) => buf.length > 4 && buf.subarray(0, 1024).includes('%PDF');

/**
 * @param {{buffer: Buffer, filename?: string, lang?: string, format?: 'txt'|'pdf'}} p
 * @returns {Promise<{buffer: Buffer, ext: string, pages: number}>}
 */
async function ocr({ buffer, lang = 'eng', format = 'txt' }) {
  if (!available()) throw new UserError('Text recognition is not available on this server yet.', 503);
  // "eng" or "eng+spa": only installed languages, at most three
  const langs = String(lang).split('+').filter((l) => LANGS.includes(l)).slice(0, 3);
  const L = (langs.length ? langs : ['eng']).join('+');
  const out = format === 'pdf' ? 'pdf' : 'txt';
  return job(async (dir) => {
    let pages = [];
    if (isPdf(buffer)) {
      const input = path.join(dir, 'input.pdf');
      await fs.writeFile(input, buffer);
      try { await run('pdftoppm', ['-r', '300', '-gray', '-png', '-l', String(MAX_PAGES), input, path.join(dir, 'p')]); } catch (e) {
        if (/Incorrect password|encrypted/i.test(e.stderr || '')) throw new UserError('This PDF is password-protected. Remove the password with Unlock PDF, then try again.', 422);
        throw new UserError('This PDF could not be read. It may be damaged.', 415);
      }
      pages = (await fs.readdir(dir)).filter((f) => /^p-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).map((f) => path.join(dir, f));
      if (!pages.length) throw new UserError('This PDF has no pages to read.', 415);
    } else {
      // Any image: normalise to a grey PNG first (also handles HEIC, WEBP, AVIF, rotated phone photos)
      const sharp = require('sharp');
      const png = path.join(dir, 'p-1.png');
      try { await sharp(buffer, { failOn: 'none' }).rotate().grayscale().png().toFile(png); } catch {
        throw new UserError('This file could not be read. Upload a photo or scan (JPG, PNG, WEBP, HEIC, TIFF) or a PDF.', 415);
      }
      pages = [png];
    }
    const env = { OMP_THREAD_LIMIT: '1' }; // one core per page; several jobs can run side by side
    if (out === 'txt') {
      const texts = [];
      for (const [i, img] of pages.entries()) {
        const { stdout } = await run('tesseract', [img, 'stdout', '-l', L, '--psm', '3'], { env });
        const t = stdout.toString('utf8').replace(/\f/g, '').replace(/[ \t]+\n/g, '\n').trim();
        texts.push(pages.length > 1 ? `--- Page ${i + 1} ---\n${t}` : t);
      }
      const text = texts.join('\n\n').trim();
      return { buffer: Buffer.from(text ? `${text}\n` : '', 'utf8'), ext: 'txt', pages: pages.length };
    }
    const parts = [];
    for (const img of pages) {
      const base = img.replace(/\.png$/, '');
      await run('tesseract', [img, base, '-l', L, '--psm', '3', 'pdf'], { env });
      parts.push(`${base}.pdf`);
    }
    let file = parts[0];
    if (parts.length > 1) {
      file = path.join(dir, 'searchable.pdf');
      await run('qpdf', ['--empty', '--pages', ...parts, '--', file]);
    }
    return { buffer: await readCapped(file), ext: 'pdf', pages: pages.length };
  });
}

module.exports = { ocr, available, langs: () => LANGS.map((id) => [id, LANG_NAMES[id]]), MAX_PAGES };
