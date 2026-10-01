'use strict';
// Web font wrapping: TTF/OTF <-> WOFF <-> WOFF2.
// WOFF (1.0) is implemented here (it is just zlib-compressed font tables); WOFF2 uses Google's
// encoder compiled to WebAssembly (wawoff2). Outline conversion (TTF <-> OTF) is not done:
// a WOFF that holds an OpenType/CFF font unwraps to OTF, a TrueType one to TTF.

const zlib = require('zlib');
const { UserError } = require('./cli');

const pad4 = (n) => (n + 3) & ~3;
const tagOf = (buf, off) => buf.toString('latin1', off, off + 4);

function readSfnt(buf) {
  if (buf.length < 12) throw new UserError('This is not a valid font file.', 415);
  const flavor = buf.readUInt32BE(0);
  const okFlavor = flavor === 0x00010000 || flavor === 0x4f54544f /* OTTO */ || flavor === 0x74727565 /* true */;
  if (!okFlavor) throw new UserError('This is not a TrueType/OpenType font (it may be a font collection, which is not supported).', 415);
  const n = buf.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    const offset = buf.readUInt32BE(o + 8), length = buf.readUInt32BE(o + 12);
    if (offset + length > buf.length) throw new UserError('This font file is damaged.', 415);
    tables.push({ tag: tagOf(buf, o), checksum: buf.readUInt32BE(o + 4), data: buf.subarray(offset, offset + length) });
  }
  return { flavor, tables };
}

function writeSfnt(flavor, tables) {
  const n = tables.length;
  let es = 0; while ((1 << (es + 1)) <= n) es++;
  const sr = (1 << es) * 16;
  const head = Buffer.alloc(12 + n * 16);
  head.writeUInt32BE(flavor, 0); head.writeUInt16BE(n, 4); head.writeUInt16BE(sr, 6); head.writeUInt16BE(es, 8); head.writeUInt16BE(n * 16 - sr, 10);
  const parts = [head];
  let offset = head.length;
  tables.forEach((t, i) => {
    const o = 12 + i * 16;
    head.write(t.tag, o, 'latin1'); head.writeUInt32BE(t.checksum >>> 0, o + 4); head.writeUInt32BE(offset, o + 8); head.writeUInt32BE(t.data.length, o + 12);
    const padded = Buffer.alloc(pad4(t.data.length)); t.data.copy(padded);
    parts.push(padded); offset += padded.length;
  });
  return Buffer.concat(parts);
}

function sfntToWoff(buf) {
  const { flavor, tables } = readSfnt(buf);
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const n = tables.length;
  const header = Buffer.alloc(44 + n * 20);
  const parts = [header];
  let offset = header.length;
  let total = 12 + n * 16;
  tables.forEach((t, i) => {
    const z = zlib.deflateSync(t.data, { level: 9 });
    const stored = z.length < t.data.length ? z : t.data;
    const o = 44 + i * 20;
    header.write(t.tag, o, 'latin1'); header.writeUInt32BE(offset, o + 4); header.writeUInt32BE(stored.length, o + 8);
    header.writeUInt32BE(t.data.length, o + 12); header.writeUInt32BE(t.checksum >>> 0, o + 16);
    const padded = Buffer.alloc(pad4(stored.length)); stored.copy(padded);
    parts.push(padded); offset += padded.length; total += pad4(t.data.length);
  });
  header.write('wOFF', 0, 'latin1'); header.writeUInt32BE(flavor, 4); header.writeUInt32BE(offset, 8);
  header.writeUInt16BE(n, 12); header.writeUInt32BE(total, 16); header.writeUInt16BE(1, 20);
  return Buffer.concat(parts);
}

function woffToSfnt(buf) {
  if (buf.length < 44 || tagOf(buf, 0) !== 'wOFF') throw new UserError('This is not a valid WOFF file.', 415);
  const flavor = buf.readUInt32BE(4);
  const n = buf.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const off = buf.readUInt32BE(o + 4), comp = buf.readUInt32BE(o + 8), orig = buf.readUInt32BE(o + 12);
    const raw = buf.subarray(off, off + comp);
    const data = comp < orig ? zlib.inflateSync(raw) : raw;
    if (data.length !== orig) throw new UserError('This WOFF file is damaged.', 415);
    tables.push({ tag: tagOf(buf, o), checksum: buf.readUInt32BE(o + 16), data });
  }
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));
  return writeSfnt(flavor, tables);
}

const isCff = (sfnt) => sfnt.readUInt32BE(0) === 0x4f54544f;

async function toSfnt(buffer, from) {
  if (from === 'woff') return woffToSfnt(buffer);
  if (from === 'woff2') {
    try { return Buffer.from(await require('wawoff2').decompress(buffer)); } catch { throw new UserError('This is not a valid WOFF2 file.', 415); }
  }
  readSfnt(buffer); // validates
  return buffer;
}

async function convertFont({ buffer, inputExt, to }) {
  const sfnt = await toSfnt(buffer, inputExt);
  if (to.id === 'woff') return { buffer: sfntToWoff(sfnt), ext: 'woff' };
  if (to.id === 'woff2') return { buffer: Buffer.from(await require('wawoff2').compress(sfnt)), ext: 'woff2' };
  if (to.id === 'ttf' && isCff(sfnt)) throw new UserError('This font has OpenType (CFF) outlines, so it unwraps to OTF. Choose OTF instead.');
  if (to.id === 'otf' && !isCff(sfnt)) throw new UserError('This font has TrueType outlines, so it unwraps to TTF. Choose TTF instead.');
  if (to.id === 'ttf' || to.id === 'otf') return { buffer: sfnt, ext: to.extension };
  throw new UserError(`Converting to ${to.label} is not supported yet.`);
}

module.exports = { convertFont, sfntToWoff, woffToSfnt };
