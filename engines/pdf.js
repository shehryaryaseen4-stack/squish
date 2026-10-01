'use strict';
// PDF in and out:
//   PDF -> JPG/PNG/WebP/TIFF   every page rendered (pdftoppm); several pages come back as a ZIP
//   PDF -> TXT / HTML          pdftotext / pdftohtml
//   PDF -> SVG / EPS / PS      pdftocairo (SVG: one file per page)
//   PDF -> PDF                 compression with Ghostscript (images downsampled to 150 dpi)
//   images -> PDF              pdf-lib, one page per image, page size = image size

const fs = require('fs/promises');
const path = require('path');
const { job, run, listFiles, collect, UserError } = require('./cli');

const RASTER = { jpg: 'jpeg', png: 'png', webp: 'png', tiff: 'png' };

async function pdfOut({ buffer, to }) {
  return job(async (dir) => {
    const input = path.join(dir, 'input.pdf');
    await fs.writeFile(input, buffer);
    const out = path.join(dir, 'out');
    await fs.mkdir(out);
    const fail = (e) => {
      if (/Incorrect password|encrypted/i.test(e.stderr || '')) throw new UserError('This PDF is password-protected. Remove the password and try again.');
      if (/Syntax Error|Couldn't (open|read)|May not be a PDF/i.test(e.stderr || '')) throw new UserError('This PDF could not be read. It may be damaged.', 415);
      throw e;
    };
    try {
      if (RASTER[to.id]) {
        await run('pdftoppm', [`-${RASTER[to.id]}`, '-r', '150', input, path.join(out, 'page')]);
        let files = await listFiles(out);
        if (to.id === 'webp' || to.id === 'tiff') {
          const sharp = require('sharp');
          files = await Promise.all(files.map(async (f) => {
            const dest = f.replace(/\.png$/, `.${to.extension}`);
            await sharp(f)[to.id === 'webp' ? 'webp' : 'tiff']({ quality: 85 }).toFile(dest);
            await fs.unlink(f);
            return dest;
          }));
        }
        return collect(files, to.extension, out);
      }
      if (to.id === 'txt') { await run('pdftotext', ['-layout', '-enc', 'UTF-8', input, path.join(out, 'output.txt')]); }
      else if (to.id === 'html') { await run('pdftohtml', ['-s', '-i', '-noframes', '-q', input, path.join(out, 'output.html')]); }
      else if (to.id === 'svg') {
        const { stdout } = await run('pdfinfo', [input]);
        const pages = Number((/Pages:\s+(\d+)/.exec(stdout.toString()) || [])[1] || 1);
        for (let i = 1; i <= Math.min(pages, 200); i++) {
          await run('pdftocairo', ['-svg', '-f', String(i), '-l', String(i), input, path.join(out, `page-${String(i).padStart(3, '0')}.svg`)]);
        }
      } else if (to.id === 'eps') { await run('pdftocairo', ['-eps', '-f', '1', '-l', '1', input, path.join(out, 'output.eps')]); }
      else if (to.id === 'ps') { await run('pdftocairo', ['-ps', input, path.join(out, 'output.ps')]); }
      else if (to.id === 'pdf') {
        await run('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5',
          '-dPDFSETTINGS=/ebook', `-sOutputFile=${path.join(out, 'output.pdf')}`, input]);
        const [f] = await listFiles(out);
        const smaller = (await fs.stat(f)).size < buffer.length;
        return { buffer: smaller ? await fs.readFile(f) : buffer, ext: 'pdf' };
      } else throw new UserError(`Converting PDF to ${to.label} is not supported yet.`);
    } catch (e) { fail(e); }
    return collect(await listFiles(out), to.extension, out);
  });
}

async function imageToPdf({ buffer, inputExt }) {
  const sharp = require('sharp');
  const { PDFDocument } = require('pdf-lib');
  let png;
  if (inputExt === 'bmp') {
    const { Jimp } = require('jimp');
    png = await (await Jimp.read(buffer)).getBuffer('image/png');
  } else {
    png = await sharp(buffer, { density: 150 }).rotate().png().toBuffer();
  }
  const doc = await PDFDocument.create();
  const isJpeg = inputExt === 'jpg' || inputExt === 'jfif';
  // copy into a standalone Uint8Array: Node Buffers can be views into a shared pool
  const img = isJpeg ? await doc.embedJpg(new Uint8Array(buffer)) : await doc.embedPng(new Uint8Array(png));
  const page = doc.addPage([img.width * 0.75, img.height * 0.75]); // 96 dpi pixels -> points
  page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  return { buffer: Buffer.from(await doc.save()), ext: 'pdf' };
}

async function convertPdf(params) {
  return params.from.id === 'pdf' ? pdfOut(params) : imageToPdf(params);
}

module.exports = { convertPdf };
