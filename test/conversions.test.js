'use strict';
// Runs live conversions for real, with real sample files (test/samples.js).
//
//   npm test                          one conversion per rule (quick)
//   CONVERSIONS=full npm test         every input and every output format of every live rule
//
// A rule whose engine is not installed is not live, so it is simply not tested here; that is
// what keeps the site from offering conversions the server cannot do.
const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../registry');
const { getHandler } = require('../engines');
const { sample, cleanup } = require('./samples');

const FULL = process.env.CONVERSIONS === 'full';

// File signatures for outputs that have a simple one.
const MAGIC = {
  pdf: (b) => b.subarray(0, 5).toString() === '%PDF-',
  png: (b) => b.readUInt32BE(0) === 0x89504e47,
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8,
  gif: (b) => b.subarray(0, 3).toString() === 'GIF',
  zip: (b) => b.readUInt16BE(0) === 0x504b,
  docx: (b) => b.readUInt16BE(0) === 0x504b, xlsx: (b) => b.readUInt16BE(0) === 0x504b, pptx: (b) => b.readUInt16BE(0) === 0x504b,
  odt: (b) => b.readUInt16BE(0) === 0x504b, ods: (b) => b.readUInt16BE(0) === 0x504b, odp: (b) => b.readUInt16BE(0) === 0x504b,
  epub: (b) => b.readUInt16BE(0) === 0x504b,
  '7z': (b) => b.subarray(0, 2).toString('latin1') === '7z',
  gz: (b) => b[0] === 0x1f && b[1] === 0x8b, 'tar-gz': (b) => b[0] === 0x1f && b[1] === 0x8b,
  bz2: (b) => b.subarray(0, 3).toString() === 'BZh', 'tar-bz2': (b) => b.subarray(0, 3).toString() === 'BZh',
  xz: (b) => b.readUInt32BE(0) === 0xfd377a58, 'tar-xz': (b) => b.readUInt32BE(0) === 0xfd377a58,
  mp4: (b) => b.subarray(4, 8).toString() === 'ftyp', mov: (b) => b.subarray(4, 8).toString() === 'ftyp',
  webm: (b) => b.readUInt32BE(0) === 0x1a45dfa3, mkv: (b) => b.readUInt32BE(0) === 0x1a45dfa3,
  wav: (b) => b.subarray(0, 4).toString() === 'RIFF', avi: (b) => b.subarray(0, 4).toString() === 'RIFF',
  flac: (b) => b.subarray(0, 4).toString() === 'fLaC', ogg: (b) => b.subarray(0, 4).toString() === 'OggS',
  woff: (b) => b.subarray(0, 4).toString() === 'wOFF', woff2: (b) => b.subarray(0, 4).toString() === 'wOF2',
  svg: (b) => /<svg[\s>]/.test(b.toString('utf8', 0, 4000)),
};

// Pairs where the generic sample would correctly be refused, and the sample that suits them.
const SAMPLE_FOR = {
  'woff>otf': 'woff-cff', 'woff2>otf': 'woff2-cff',
};
// Single-file compressors need a single-file input.
const SINGLE_FILE_OUT = ['gz', 'bz2', 'xz'];
// Refusals that are the correct behaviour for our samples (asserted, not skipped).
const EXPECTED_REFUSAL = {
  'djvu>txt': /no text layer/, // the sample DjVu is a picture with no OCR text
};

function plan() {
  const live = registry.getConverters({ type: 'all' }).filter((c) => c.handler !== 'image');
  const groups = new Map();
  live.forEach((c) => { if (!groups.has(c.group)) groups.set(c.group, []); groups.get(c.group).push(c); });
  const picks = new Map();
  for (const list of groups.values()) {
    if (!FULL) { picks.set(list[0].id, list[0]); continue; }
    const seenFrom = new Set(), seenTo = new Set();
    for (const c of list) {
      if (SINGLE_FILE_OUT.includes(c.to) && !SINGLE_FILE_OUT.concat(['lz', 'lzma', 'lzo', 'z']).includes(c.from)) continue;
      if (!seenFrom.has(c.from) || !seenTo.has(c.to)) { picks.set(c.id, c); seenFrom.add(c.from); seenTo.add(c.to); }
    }
  }
  return [...picks.values()];
}

test.after(cleanup);

const cases = plan();
test(`plan covers every live rule (${cases.length} conversions${FULL ? ', full' : ''})`, () => {
  const groups = new Set(registry.getConverters({ type: 'all' }).filter((c) => c.handler !== 'image').map((c) => c.group));
  assert.equal(new Set(cases.map((c) => c.group)).size, groups.size);
});

for (const c of cases) {
  test(`${c.from} -> ${c.to} (${c.group})`, { timeout: 240000 }, async () => {
    const from = registry.getFormat(c.from), to = registry.getFormat(c.to);
    const buffer = await sample(SAMPLE_FOR[c.id] || c.from);
    const call = () => getHandler(c.handler)({ buffer, inputExt: from.id, format: to.apiFormat, quality: 80, maxDim: 0, from, to, filename: `sample.${from.extension}` }, c);
    if (EXPECTED_REFUSAL[c.id]) {
      await assert.rejects(call, (e) => !!e.userMessage && EXPECTED_REFUSAL[c.id].test(e.userMessage));
      return;
    }
    const res = await call();
    const out = Buffer.isBuffer(res) ? { buffer: res, ext: to.extension } : res;
    assert.ok(out.buffer.length > 0, 'empty output');
    if (out.ext === 'zip' && to.id !== 'zip') assert.ok(MAGIC.zip(out.buffer), 'multi-file result should be a ZIP');
    else if (MAGIC[to.id]) assert.ok(MAGIC[to.id](out.buffer), `output does not look like ${to.label}`);
  });
}
