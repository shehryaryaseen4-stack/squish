'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ocr = require('../engines/ocr');

const skip = !ocr.available() && 'Tesseract is not installed here';

test('OCR reads the text of an image, as text and as a searchable PDF', { skip }, async () => {
  const sharp = require('sharp');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="260"><rect width="100%" height="100%" fill="#fff"/>'
    + '<text x="30" y="110" font-family="DejaVu Sans, Arial" font-size="48">Invoice 2041 total 99.50</text></svg>';
  const img = await sharp(Buffer.from(svg)).png().toBuffer();
  const txt = await ocr.ocr({ buffer: img });
  assert.equal(txt.ext, 'txt');
  assert.match(txt.buffer.toString(), /Invoice 2041 total 99\.50/);
  const pdf = await ocr.ocr({ buffer: img, format: 'pdf' });
  assert.equal(pdf.ext, 'pdf');
  assert.ok(pdf.buffer.subarray(0, 5).toString() === '%PDF-');
});

test('OCR turns away files that are not images or PDFs', { skip }, async () => {
  await assert.rejects(ocr.ocr({ buffer: Buffer.from('hello, not a picture') }), /could not be read/);
});
