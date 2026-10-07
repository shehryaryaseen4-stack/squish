'use strict';
// Builds real sample files for the tests (PDFs, images, Office documents) in a temp folder.
// Office files need python-docx/openpyxl/python-pptx; encrypted PDFs need qpdf. Missing
// tools just mean those fixtures are skipped (the tests that need them skip too).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const has = (bin) => spawnSync('sh', ['-c', `command -v ${bin}`]).status === 0;

// A small PNG (red square with a blue stripe), built by hand so no image library is needed.
function makePng(w = 64, h = 48) {
  const zlib = require('zlib');
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const stripe = y > h / 3 && y < (2 * h) / 3;
      raw[o] = stripe ? 30 : 220; raw[o + 1] = stripe ? 80 : 40; raw[o + 2] = stripe ? 200 : 40;
    }
  }
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function samplePdf(pages = 3) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const png = await doc.embedPng(makePng(400, 300));
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Sample page ${i}`, { x: 60, y: 760, size: 28, font, color: rgb(0.1, 0.1, 0.2) });
    p.drawText('The quick brown fox jumps over the lazy dog.', { x: 60, y: 720, size: 14, font });
    if (i === 2) p.drawImage(png, { x: 60, y: 300, width: 400, height: 300 });
  }
  doc.setTitle('Sample title');
  doc.setAuthor('Test author');
  return Buffer.from(await doc.save());
}

async function build() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-fixtures-'));
  const f = (name) => path.join(dir, name);
  fs.writeFileSync(f('sample.pdf'), await samplePdf(3));
  fs.writeFileSync(f('second.pdf'), await samplePdf(2));
  fs.writeFileSync(f('long.pdf'), await samplePdf(12));
  fs.writeFileSync(f('pic.png'), makePng(320, 240));
  fs.writeFileSync(f('not-a-pdf.pdf'), 'MZ this is not a pdf at all');
  fs.writeFileSync(f('page.html'), '<!doctype html><html><head><title>T</title><link rel="stylesheet" href="http://169.254.169.254/x.css"><script>alert(1)</script></head><body><h1>Hello HTML</h1><p style="color:#c00">Paragraph text.</p><img src="file:///etc/passwd"><table border="1"><tr><td>a</td><td>b</td></tr></table></body></html>');
  const src = fs.readFileSync(f('sample.pdf'));
  const broken = Buffer.from(src.toString('latin1').replace(/xref[\s\S]*$/, ''), 'latin1');
  fs.writeFileSync(f('broken.pdf'), broken);

  if (has('pdftoppm')) {
    spawnSync('pdftoppm', ['-jpeg', '-r', '60', '-f', '1', '-l', '1', '-singlefile', f('sample.pdf'), f('photo')]);
    // an image-only "scan" for OCR
    spawnSync('pdftoppm', ['-png', '-r', '150', '-f', '1', '-l', '1', '-singlefile', f('sample.pdf'), f('scanpage')]);
    if (fs.existsSync(f('scanpage.png'))) {
      const doc = await PDFDocument.create();
      const img = await doc.embedPng(fs.readFileSync(f('scanpage.png')));
      doc.addPage([595, 842]).drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
      fs.writeFileSync(f('scan.pdf'), Buffer.from(await doc.save()));
    }
  }
  if (has('qpdf')) {
    spawnSync('qpdf', ['--encrypt', '--user-password=secret', '--owner-password=owner1', '--bits=256', '--', f('sample.pdf'), f('locked.pdf')]);
    spawnSync('qpdf', ['--encrypt', '--user-password=', '--owner-password=owner1', '--bits=256', '--print=none', '--extract=n', '--', f('sample.pdf'), f('restricted.pdf')]);
  }
  const py = process.env.PYTHON || 'python3';
  spawnSync(py, ['-c', `
import sys
d = sys.argv[1]
try:
    import docx
    doc = docx.Document(); doc.add_heading('Hello Word', 1); doc.add_paragraph('A paragraph in a Word file.'); doc.save(d + '/doc.docx')
except Exception: pass
try:
    import openpyxl
    wb = openpyxl.Workbook(); ws = wb.active; ws.append(['Name', 'Qty']); ws.append(['Apples', 3]); ws.append(['Pears', 5]); wb.save(d + '/sheet.xlsx')
except Exception: pass
try:
    from pptx import Presentation
    p = Presentation(); s = p.slides.add_slide(p.slide_layouts[1]); s.shapes.title.text = 'Hello Slides'; p.save(d + '/slides.pptx')
except Exception: pass
`, dir]);
  if (has('soffice')) {
    fs.writeFileSync(f('table.html'), '<table border="1"><tr><th>Item</th><th>Price</th></tr><tr><td>Tea</td><td>3.50</td></tr><tr><td>Coffee</td><td>4.25</td></tr></table>');
    spawnSync('soffice', ['--headless', `-env:UserInstallation=file://${dir}/lo`, '--convert-to', 'pdf', '--outdir', dir, f('table.html')], { env: { ...process.env, HOME: dir } });
  }
  return { dir, f, exists: (n) => fs.existsSync(f(n)) };
}

module.exports = { build, samplePdf, makePng };
if (require.main === module) build().then((r) => console.log(r.dir));
