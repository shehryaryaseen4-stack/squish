'use strict';
// Archive conversion (engines/archive.js) with the ZIPs people really have: UTF-8 names in any
// script, old Windows names in a legacy code page, and Deflate64 from Windows Explorer.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const JSZip = require('jszip');

const has = (bin) => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };
const skip = !has('bsdtar') && 'bsdtar is not installed';
const { convertArchive } = require('../engines/archive');
const registry = require('../registry');
const F = (id) => registry.getFormat(id);
const list = (file) => execFileSync('bsdtar', ['-tf', file], { env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } }).toString().split('\n').filter(Boolean);
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'squish-arch-'));
test.after(() => fs.rmSync(DIR, { recursive: true, force: true }));

async function convert(buffer, to) {
  const out = await convertArchive({ buffer, from: F('zip'), to: F(to), filename: 'test.zip' });
  const file = path.join(DIR, `out-${to}.${out.ext}`);
  fs.writeFileSync(file, out.buffer);
  return list(file);
}

test('ZIP with UTF-8 names (accents, Urdu, Chinese) converts and keeps the names', { skip }, async () => {
  const zip = new JSZip();
  zip.file('Café menu.txt', 'hello');
  zip.file('صفائی/رپورٹ.txt', 'urdu');
  zip.file('清洁/报告.txt', 'zh');
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  for (const to of ['tar-bz2', '7z', 'tar-gz']) {
    const names = await convert(buf, to);
    for (const n of ['Café menu.txt', 'صفائی/رپورٹ.txt', '清洁/报告.txt']) assert.ok(names.includes(n), `${to}: ${n} in ${names}`);
  }
});

test('ZIP with legacy (non-UTF-8) names converts', { skip }, async () => {
  const zip = new JSZip();
  zip.file('placeholder.txt', 'hello');
  let buf = await zip.generateAsync({ type: 'nodebuffer' });
  // put Windows-1252 bytes into the name, as old Windows tools did ("résumé.txt")
  const legacy = Buffer.from([0x72, 0xe9, 0x73, 0x75, 0x6d, 0xe9, 0x5f, 0x5f, 0x5f, 0x5f, 0x5f, 0x2e, 0x74, 0x78, 0x74]);
  buf = Buffer.from(buf.toString('latin1').split('placeholder.txt').join(legacy.toString('latin1')), 'latin1');
  const names = await convert(buf, 'tar-bz2');
  assert.deepEqual(names, ['résumé_____.txt']);
});

test('Deflate64 ZIP (Windows Explorer, large files) converts', { skip: skip || (!has('7z') && '7z is not installed') }, async () => {
  const src = path.join(DIR, 'd64');
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, 'a.txt'), 'x'.repeat(100000));
  const zipFile = path.join(DIR, 'd64.zip');
  execFileSync('7z', ['a', '-tzip', '-mm=Deflate64', zipFile, path.join(src, 'a.txt')], { stdio: 'ignore' });
  assert.deepEqual(await convert(fs.readFileSync(zipFile), 'tar-gz'), ['a.txt']);
});
