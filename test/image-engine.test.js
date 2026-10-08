'use strict';
// These tests describe the image-only build (no FFmpeg, LibreOffice, ...), so they turn off
// detection of system tools. test/conversions.test.js and test/seo.test.js cover the full build.
process.env.SQUISH_DETECT = '0';
// Runs the live image conversions for real with Sharp. Skipped if Sharp isn't installed.
// BMP input (Jimp) and ICO output (png-to-ico) need those packages and are not covered here.
const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../registry');
const { createImageHandler } = require('../engines/image');

let sharp = null;
try { sharp = require('sharp'); } catch { /* not installed */ }
const skip = sharp ? false : 'sharp is not installed (run npm install)';

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="#e8a33d"/><circle cx="32" cy="24" r="12" fill="#0b6"/></svg>');

async function sample(kind) {
  if (kind === 'svg') return SVG;
  const png = await sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 200, g: 80, b: 40, alpha: 1 } } }).png().toBuffer();
  return kind === 'png' ? png : sharp(png).toFormat(kind === 'jpg' ? 'jpeg' : kind).toBuffer();
}

const PAIRS = [['png', 'jpg'], ['png', 'webp'], ['jpg', 'png'], ['jpg', 'webp'], ['webp', 'png'], ['webp', 'jpg'], ['svg', 'png']];

for (const [from, to] of PAIRS) {
  test(`${from} -> ${to} really converts`, { skip }, async () => {
    const convert = createImageHandler({ sharp, Jimp: null, pngToIco: null });
    const converter = registry.getConverter(from, to);
    const out = await convert({ buffer: await sample(from), inputExt: from, format: registry.getFormat(to).apiFormat, quality: 80, maxDim: 0 }, converter);
    const meta = await sharp(out).metadata();
    assert.equal(meta.format, registry.getFormat(to).apiFormat);
    assert.equal(meta.width, 64);
    assert.equal(meta.height, 48);
  });
}

test('compress keeps the format and honours maxDim', { skip }, async () => {
  const convert = createImageHandler({ sharp, Jimp: null, pngToIco: null });
  const out = await convert({ buffer: await sample('jpg'), inputExt: 'jpg', format: 'jpeg', quality: 50, maxDim: 32 }, registry.getCompressor('jpg'));
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 32);
});

test('asking the handler for an encoder it lacks fails clearly', { skip }, async () => {
  const convert = createImageHandler({ sharp, Jimp: null, pngToIco: null });
  await assert.rejects(convert({ buffer: await sample('png'), inputExt: 'png', format: 'bogus', quality: 80, maxDim: 0 }, registry.getConverter('png', 'jpg')), /no encoder/);
});

test('phone photos with an EXIF orientation flag come out upright', { skip }, async () => {
  const convert = createImageHandler({ sharp, Jimp: null, pngToIco: null });
  // 64x48 pixels stored with orientation 6 ("rotate 90° clockwise to display").
  const sideways = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#c85028' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const out = await convert({ buffer: sideways, inputExt: 'jpg', format: 'png', quality: 80, maxDim: 0 }, registry.getConverter('jpg', 'png'));
  const meta = await sharp(out).metadata();
  assert.deepEqual([meta.width, meta.height], [48, 64]);
});

test('PNG output is a palette below Quality 100 and full colour at 100', { skip }, async () => {
  const convert = createImageHandler({ sharp, Jimp: null, pngToIco: null });
  const src = await sample('jpg');
  const conv = registry.getConverter('jpg', 'png');
  const small = await sharp(await convert({ buffer: src, inputExt: 'jpg', format: 'png', quality: 75, maxDim: 0 }, conv)).metadata();
  const full = await sharp(await convert({ buffer: src, inputExt: 'jpg', format: 'png', quality: 100, maxDim: 0 }, conv)).metadata();
  assert.equal(small.isPalette, true, 'quality 75 gives a palette PNG');
  assert.equal(full.isPalette, false, 'quality 100 gives a full-colour PNG');
});

test('"Reduce size by" really makes images that much smaller, also when already compressed', { skip }, async () => {
  const { compressToSize } = require('../engines/size-target');
  const { convertImage } = require('../engines/image');
  const w = 800, h = 600, raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7 + ((i / 2400) | 0) * 13) % 256;
  for (const q0 of [92, 30]) {
    const input = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: q0 }).toBuffer();
    const job = (q, maxDim) => convertImage({ buffer: input, inputExt: 'jpg', format: 'jpeg', quality: q, maxDim }, { pipeline: { decode: 'sharp' } });
    for (const pct of [50, 80]) {
      const target = Math.floor(input.length * (1 - pct / 100));
      const out = await compressToSize(job, input, target, 0, 'jpeg');
      assert.ok(out.length <= target, `quality ${q0}, ${pct}%: ${input.length} -> ${out.length}, target ${target}`);
      assert.ok(out.length >= target * 0.6, `quality ${q0}, ${pct}%: far smaller than asked (${out.length} for ${target})`);
      assert.equal((await sharp(out).metadata()).format, 'jpeg');
    }
  }
});
