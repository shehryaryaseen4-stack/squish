'use strict';
// Image formats Sharp cannot read or write by itself:
//   read:  HEIC/HEIF (libheif), PSD/ICO/PPM (ImageMagick), EPS/PS (Ghostscript)
//   write: BMP, PSD (ImageMagick), EPS/PS (ImageMagick), PDF (pdf-lib)
// Everything is decoded to PNG first; common targets are then encoded by the normal image handler.

const fs = require('fs/promises');
const path = require('path');
const { job, run, listFiles, UserError } = require('./cli');
const { convertImage } = require('./image');

const SHARP_OUT = ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif', 'ico'];
const IM_IN = ['psd', 'ico', 'ppm'];
const GS_IN = ['eps', 'ps'];
const HEIF_IN = ['heic', 'heif'];

async function decodeToPng(dir, buffer, inputExt) {
  const input = path.join(dir, `input.${inputExt}`);
  await fs.writeFile(input, buffer);
  const png = path.join(dir, 'decoded.png');
  try {
    if (HEIF_IN.includes(inputExt)) {
      await run('heif-convert', ['-q', '100', input, png]);
      // multi-image HEIF files produce decoded-1.png, decoded-2.png...; take the primary (first)
      const files = (await listFiles(dir)).filter((f) => /decoded.*\.png$/.test(f));
      return fs.readFile(files[0]);
    }
    if (GS_IN.includes(inputExt)) {
      await run('gs', ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dEPSCrop', '-sDEVICE=pngalpha', '-r150', '-dFirstPage=1', '-dLastPage=1', `-sOutputFile=${png}`, input]);
      return fs.readFile(png);
    }
    if (IM_IN.includes(inputExt)) {
      // [0] = first layer/frame (PSD composite, largest ICO entry is chosen by -flatten below)
      await run('convert', [inputExt === 'ico' || inputExt === 'icns' ? input : `${input}[0]`, '-flatten', '-strip', `png32:${png}`]);
      const files = (await listFiles(dir)).filter((f) => /decoded.*\.png$/.test(f));
      return fs.readFile(files[files.length - 1]);
    }
    return null; // Sharp/Jimp-readable input
  } catch (e) {
    if (e.userMessage) throw e;
    throw new UserError('This image could not be read. It may be damaged or use an unsupported variant of the format.', 415);
  }
}

async function convertImageX(params) {
  const { buffer, inputExt, to, quality, maxDim } = params;
  return job(async (dir) => {
    let png = await decodeToPng(dir, buffer, inputExt);
    const srcExt = png ? 'png' : inputExt;
    const src = png || buffer;
    if (SHARP_OUT.includes(to.id)) {
      const decode = srcExt === 'bmp' ? 'jimp' : 'sharp';
      return { buffer: await convertImage({ buffer: src, inputExt: srcExt, format: to.apiFormat, quality, maxDim }, { pipeline: { decode } }), ext: to.extension };
    }
    // Everything below starts from a PNG.
    if (!png) png = await convertImage({ buffer: src, inputExt: srcExt, format: 'png', quality: 100, maxDim }, { pipeline: { decode: srcExt === 'bmp' ? 'jimp' : 'sharp' } });
    if (to.id === 'pdf') return require('./pdf').convertPdf({ buffer: png, inputExt: 'png', from: { id: 'png' }, to });
    const pngFile = path.join(dir, 'source.png');
    const outFile = path.join(dir, `output.${to.extension}`);
    await fs.writeFile(pngFile, png);
    const coder = { bmp: 'bmp3', psd: 'psd', eps: 'eps3', ps: 'ps3' }[to.id];
    if (!coder) throw new UserError(`Converting to ${to.label} is not supported yet.`);
    await run('convert', [pngFile, ...(to.id === 'bmp' ? ['-background', 'white', '-alpha', 'remove'] : []), `${coder}:${outFile}`]);
    return { buffer: await fs.readFile(outFile), ext: to.extension };
  });
}

module.exports = { convertImageX, IM_IN, GS_IN, HEIF_IN };
