'use strict';
// The newer tools: video compressor and trimmers (FFmpeg), background remover (ONNX model) and
// their pages.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const media = require('../engines/media-tools');
const bg = require('../engines/bgremove');
const pages = require('../pages');

const has = (bin) => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'squish-tools-'));
test.after(() => fs.rmSync(DIR, { recursive: true, force: true }));

const video = () => {
  const f = path.join(DIR, 'v.mp4');
  if (!fs.existsSync(f)) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=duration=8:size=640x360:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8',
      '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', f]);
  }
  return f;
};

test('video compressor fits a target size and keeps MP4', { skip: !has('ffmpeg') && 'FFmpeg missing', timeout: 120000 }, async () => {
  const before = fs.statSync(video()).size;
  const mb = Math.max(0.3, (before / 1024 / 1024) / 3);
  const d = fs.mkdtempSync(path.join(DIR, 'c-'));
  const r = await media.compressVideo(video(), { targetMB: mb }, d);
  assert.equal(r.ext, 'mp4');
  assert.ok(fs.statSync(r.file).size <= mb * 1024 * 1024, 'over the target');
  await assert.rejects(media.compressVideo(video(), { targetMB: 0.01 }, d), /too long to fit/);
});

test('trimmer cuts exactly and makes ringtones', { skip: !has('ffmpeg') && 'FFmpeg missing', timeout: 120000 }, async () => {
  const d = fs.mkdtempSync(path.join(DIR, 't-'));
  const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
  const v = await media.trimMedia(video(), { start: 1, end: 4, format: 'mp4' }, d);
  assert.ok(Math.abs(dur(v.file) - 3) < 0.15, `video is ${dur(v.file)} s`);
  const r = await media.trimMedia(video(), { start: 0, end: 6, format: 'm4r', fadeIn: 1, fadeOut: 2, maxLen: 40 }, d);
  assert.equal(r.ext, 'm4r');
  assert.ok(Math.abs(dur(r.file) - 6) < 0.15);
  await assert.rejects(media.trimMedia(video(), { start: 0, end: 50, format: 'm4r', maxLen: 4 }, d), /at most 4 seconds/);
  await assert.rejects(media.trimMedia(video(), { start: 5, end: 2, format: 'mp3' }, d), /end time after the start/);
});

test('background remover makes the background transparent', { skip: !bg.available() && 'model or ONNX Runtime missing', timeout: 120000 }, async () => {
  const sharp = require('sharp');
  // a red ball on a grey wall
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#9aa3ad"/><circle cx="200" cy="150" r="90" fill="#d22"/></svg>';
  const out = await bg.removeBackground({ buffer: await sharp(Buffer.from(svg)).jpeg().toBuffer() });
  const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  assert.ok(alpha(10, 10) < 40, `corner alpha ${alpha(10, 10)}`);
  assert.ok(alpha(200, 150) > 200, `centre alpha ${alpha(200, 150)}`);
});

test('every tool page has its tool box and script', () => {
  for (const t of pages.APPS) {
    const html = pages.resolveApp(t.slug, 'https://example.test').html;
    assert.match(html, new RegExp(`data-app="${t.app}"`), t.slug);
    assert.match(html, /<script type="module" src="\/(apps|tools)\.js\?v=/, t.slug);
    assert.ok(!/onclick=/.test(html.split('id="app"')[1].split('</section>')[0]), `${t.slug}: inline handlers are blocked by the CSP`);
  }
});

test('resume library: every job has six skills and short lines that fit the designs', async () => {
  const { JOBS, findJob } = await import('../public/resume-library.js');
  assert.ok(JOBS.length >= 40);
  for (const j of JOBS) {
    assert.ok(j.skills.length >= 6 && j.duties.length >= 5 && j.strengths.length === 3, j.id);
    for (const d of j.duties) assert.ok(d.length <= 56, `${j.id}: "${d}" is ${d.length} characters`);
  }
  assert.equal(findJob('rn nurse').id, 'registered-nurse');
  assert.equal(findJob('cashier').id, 'cashier');
});

test('PDF to Word keeps tables and colours (pdf2docx)', { skip: !has('pdf2docx-python') && 'pdf2docx missing', timeout: 120000 }, async () => {
  const fs2 = require('fs');
  const dir = fs2.mkdtempSync(path.join(DIR, 'w-'));
  fs2.writeFileSync(path.join(dir, 't.html'), '<table border="1"><tr><td>Region</td><td>Sales</td></tr><tr><td>North</td><td style="color:#c00">120</td></tr></table>');
  execFileSync('soffice', ['--headless', `-env:UserInstallation=file://${dir}/p`, '--convert-to', 'pdf', '--outdir', dir, path.join(dir, 't.html')], { stdio: 'ignore' });
  const { convertPdfWord } = require('../engines/pdfword');
  const registry = require('../registry');
  const out = await convertPdfWord({ buffer: fs2.readFileSync(path.join(dir, 't.pdf')), to: registry.getFormat('docx') });
  const JSZip = require('jszip');
  const xml = await (await JSZip.loadAsync(out.buffer)).file('word/document.xml').async('string');
  assert.match(xml, /<w:tbl>/, 'the table is a real Word table');
  assert.match(xml, /North/);
  if (has('tesseract')) { // "OCR" chosen in the dialog: the text is read from the page image
    const o2 = await convertPdfWord({ buffer: fs2.readFileSync(path.join(dir, 't.pdf')), to: registry.getFormat('docx'), ocr: true });
    const x2 = await (await JSZip.loadAsync(o2.buffer)).file('word/document.xml').async('string');
    assert.doesNotMatch(x2, /<w:tbl>/); assert.match(x2, /North/);
  }
});

test('PDF to Word reads scanned pages as editable text (OCR)', { skip: (!has('pdf2docx-python') || !has('tesseract')) && 'pdf2docx or tesseract missing', timeout: 120000 }, async () => {
  const fs2 = require('fs');
  const dir = fs2.mkdtempSync(path.join(DIR, 's-'));
  fs2.writeFileSync(path.join(dir, 't.html'), '<h1>Quarterly Sales Report</h1><p>Prepared for Acme Incorporated by the finance team.</p>');
  execFileSync('soffice', ['--headless', `-env:UserInstallation=file://${dir}/p`, '--convert-to', 'pdf', '--outdir', dir, path.join(dir, 't.html')], { stdio: 'ignore' });
  execFileSync('pdftoppm', ['-r', '150', '-png', '-singlefile', path.join(dir, 't.pdf'), path.join(dir, 'page')]);
  const { PDFDocument } = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const img = await pdf.embedPng(fs2.readFileSync(path.join(dir, 'page.png')));
  pdf.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  const { convertPdfWord } = require('../engines/pdfword');
  const registry = require('../registry');
  const out = await convertPdfWord({ buffer: Buffer.from(await pdf.save()), to: registry.getFormat('docx') });
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(out.buffer);
  const xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /Quarterly Sales Report/, 'the scanned text is real Word text');
  assert.match(xml, /<w:framePr [^>]*w:hAnchor="page"/, 'the text sits where it was on the page');
  assert.match(xml, /behindDoc="1"/, 'the design is a picture behind the text');
});
