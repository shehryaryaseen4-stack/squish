'use strict';
// Vector graphics with Inkscape: SVG, SVGZ, EPS, PS, PDF, EMF, WMF, AI (PDF-compatible)
// to each other, and to raster images (rendered as PNG by Inkscape, then encoded by Sharp).
// EPS/PS input is first turned into PDF by Ghostscript (Inkscape's own PostScript import
// needs a display); AI files are read through their embedded PDF.

const fs = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { job, run, UserError } = require('./cli');

const EXPORT = { svg: 'svg', eps: 'eps', ps: 'ps', pdf: 'pdf', emf: 'emf', wmf: 'wmf', png: 'png' };
const RASTER = ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif'];

async function convertVector({ buffer, inputExt, to }) {
  return job(async (dir) => {
    // AI files are opened through their embedded PDF; SVGZ is just gzip-compressed SVG.
    let inExt = inputExt === 'ai' ? 'pdf' : inputExt === 'svgz' ? 'svg' : inputExt;
    let input = path.join(dir, `input.${inExt}`);
    let data = buffer;
    if (inputExt === 'svgz') {
      try { data = zlib.gunzipSync(buffer); } catch { throw new UserError('This SVGZ file is damaged.', 415); }
    }
    await fs.writeFile(input, data);
    if (inExt === 'eps' || inExt === 'ps') {
      const pdf = path.join(dir, 'input.pdf');
      try {
        await run('gs', ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pdfwrite', ...(inExt === 'eps' ? ['-dEPSCrop'] : []), `-sOutputFile=${pdf}`, input]);
      } catch { throw new UserError('This PostScript file could not be read. It may be damaged.', 415); }
      if (to.id === 'pdf') return { buffer: await fs.readFile(pdf), ext: 'pdf' };
      input = pdf; inExt = 'pdf';
    }
    const target = RASTER.includes(to.id) ? 'png' : to.id === 'svgz' ? 'svg' : to.id;
    if (!EXPORT[target]) throw new UserError(`Converting to ${to.label} is not supported yet.`);
    const output = path.join(dir, `output.${target}`);
    const args = [input, `--export-filename=${output}`, '--export-overwrite'];
    if (target === 'svg') args.push('--export-plain-svg');
    if (target === 'png') args.push('--export-dpi=150', '--export-background-opacity=0');
    if (inExt === 'pdf') args.unshift('--pdf-poppler');
    try {
      await run('inkscape', args, { env: { HOME: dir, XDG_RUNTIME_DIR: dir } });
    } catch (e) {
      throw new UserError('This drawing could not be opened. It may be damaged or use an unsupported variant of the format.', 415);
    }
    let out = await fs.readFile(output).catch(() => null);
    if (!out || !out.length) throw new UserError('This drawing could not be converted.', 422);
    if (to.id === 'svgz') out = zlib.gzipSync(out, { level: 9 });
    if (RASTER.includes(to.id) && to.id !== 'png') {
      const sharp = require('sharp');
      const img = sharp(out);
      out = await (to.id === 'jpg' ? img.flatten({ background: '#ffffff' }).jpeg({ quality: 90 }) : img.toFormat(to.id === 'tiff' ? 'tiff' : to.id)).toBuffer();
    }
    return { buffer: out, ext: to.extension };
  });
}

module.exports = { convertVector };
