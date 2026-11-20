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

// Editable PDF (engines/pdfx/editable.py): real text in place of the pictured text, in the same
// color and weight, with the old letters taken out of the picture.
test('OCR to editable PDF: real text, colors and bold kept, nothing left underneath', { skip, timeout: 120000 }, async () => {
  const sharp = require('sharp');
  const { execFileSync } = require('child_process');
  const fs = require('fs'), os = require('os'), path = require('path');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420">'
    + '<rect width="100%" height="100%" fill="#ffffff"/><rect y="250" width="100%" height="170" fill="#1e3a8a"/>'
    + '<text x="40" y="110" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="56" fill="#111111">Industrial Door Solutions</text>'
    + '<text x="40" y="190" font-family="DejaVu Sans, Arial" font-size="30" fill="#555555">Installation and repair across the country</text>'
    + '<text x="40" y="350" font-family="DejaVu Sans, Arial" font-size="40" fill="#ffffff">Call us today for a free quote</text></svg>';
  const img = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = await ocr.ocr({ buffer: img, format: 'editable' });
  assert.equal(out.ext, 'pdf');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'squish-ocr-'));
  try {
    const file = path.join(dir, 'e.pdf');
    fs.writeFileSync(file, out.buffer);
    const fonts = execFileSync('pdffonts', [file]).toString();
    assert.match(fonts, /Helvetica-Bold/, 'the bold heading is set in Helvetica Bold');
    assert.match(fonts, /Helvetica\s/, 'the other lines in Helvetica');
    assert.doesNotMatch(fonts, /GlyphLess/, 'no invisible OCR font');
    const text = execFileSync('pdftotext', ['-layout', file, '-']).toString();
    assert.match(text, /Industrial Door Solutions/);
    assert.match(text, /Call us today for a free quote/);
    // the text colors come from the picture: white on the blue band, grey for the second line
    const bbox = execFileSync('mutool', ['draw', '-F', 'stext', file]).toString();
    assert.match(bbox, /color="#ffffff"|color="#fefefe"|color="#fdfdfd"/i, 'white text on the dark band');
    // the old letters are gone from the picture itself: its blue band has no white letters left
    execFileSync('pdfimages', ['-png', file, path.join(dir, 'bg')]);
    const { data, info } = await sharp(path.join(dir, 'bg-000.png')).raw().toBuffer({ resolveWithObject: true });
    let light = 0;
    for (let y = Math.round(info.height * 0.62); y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i] > 150 && data[i + 1] > 150 && data[i + 2] > 150) light++;
    }
    assert.ok(light < 50, `old white letters left in the picture: ${light} pixels`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
