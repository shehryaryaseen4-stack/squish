'use strict';
// Upload handling for server-side tools: one file per request, written to the request's own
// private temp folder (removed once the response is finished), checked by extension AND by
// its first bytes, so a renamed executable or script is refused before any engine sees it.

const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const config = require('./config');
const { INPUTS } = require('./tools');
const { ocrLanguages } = require('./engines/detect');
const { makeTempDir, UserError } = require('./engines/runner');

const uploader = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        req.tempDir = req.tempDir || await makeTempDir();
        cb(null, req.tempDir);
      } catch (e) { cb(e); }
    },
    // Never use the visitor's file name on disk.
    filename: (_req, file, cb) => cb(null, `upload${safeExt(file.originalname) ? `.${safeExt(file.originalname)}` : ''}`),
  }),
  limits: { fileSize: config.MAX_UPLOAD_BYTES, files: 1, fields: 4, fieldSize: 64 * 1024, parts: 6 },
});

function safeExt(name) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

/** Detects what a file really is from its first bytes. */
async function sniff(file) {
  const fh = await fs.open(file, 'r');
  const buf = Buffer.alloc(8192);
  let n = 0;
  try { ({ bytesRead: n } = await fh.read(buf, 0, buf.length, 0)); } finally { await fh.close(); }
  const b = buf.subarray(0, n);
  const starts = (...bytes) => bytes.every((x, i) => b[i] === x);
  if (b.subarray(0, 1024).includes('%PDF-')) return 'pdf';
  if (starts(0xff, 0xd8, 0xff)) return 'jpg';
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (starts(0x49, 0x49, 0x2a, 0x00) || starts(0x4d, 0x4d, 0x00, 0x2a)) return 'tiff';
  if (starts(0x42, 0x4d)) return 'bmp';
  if (starts(0x50, 0x4b, 0x03, 0x04)) return 'zip'; // DOCX/XLSX/PPTX/ODF
  if (starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return 'ole'; // DOC/XLS/PPT
  if (b.subarray(0, 5).toString('latin1') === '{\\rtf') return 'rtf';
  if (n && !b.includes(0)) return 'text';
  return 'unknown';
}

// Which sniffed types are acceptable for each file extension.
const EXT_MAGIC = {
  pdf: ['pdf'], jpg: ['jpg'], jpeg: ['jpg'], jfif: ['jpg'], png: ['png'], webp: ['webp'], tif: ['tiff'], tiff: ['tiff'], bmp: ['bmp'],
  docx: ['zip'], xlsx: ['zip'], pptx: ['zip'], ppsx: ['zip'], odt: ['zip'], ods: ['zip'], odp: ['zip'],
  doc: ['ole'], xls: ['ole'], ppt: ['ole'], pps: ['ole'], rtf: ['rtf'], csv: ['text'], html: ['text'], htm: ['text'],
};

/** Throws a UserError unless the uploaded file matches what the tool accepts. */
async function validateFile(tool, file) {
  const input = INPUTS[tool.input];
  const ext = safeExt(file.originalname);
  const kind = `${input.label} file${tool.input === 'image' ? ' (JPG, PNG, WEBP, TIFF or BMP)' : ''}`;
  if (!input.exts.includes(ext)) throw new UserError(`Please choose a ${kind}. This tool can’t open “.${ext || '?'}” files.`, 415);
  if (!file.size) throw new UserError('This file is empty. Please choose another file.', 400);
  const real = await sniff(file.path);
  if (tool.skipPdfCheck && ext === 'pdf' && real !== 'unknown') return ext; // damaged PDFs may lack a proper header
  if (!(EXT_MAGIC[ext] || []).includes(real)) {
    throw new UserError(`This doesn’t look like a real ${kind}. It may be damaged, or renamed from another type.`, 415);
  }
  if (tool.input === 'html' && !/<[a-z!]/i.test(await fs.readFile(file.path, 'latin1').then((s) => s.slice(0, 65536)))) {
    throw new UserError('This doesn’t look like an HTML file.', 415);
  }
  return ext;
}

/** Checks the submitted settings against the tool's option list; returns clean values. */
function validateOptions(tool, raw) {
  let given = {};
  if (raw) {
    try { given = JSON.parse(raw); } catch { throw new UserError('The settings could not be read. Please reload the page and try again.', 400); }
    if (!given || typeof given !== 'object' || Array.isArray(given)) given = {};
  }
  const out = {};
  for (const opt of tool.options) {
    let v = given[opt.id];
    if (opt.type === 'checkbox') { out[opt.id] = v === undefined ? !!opt.default : v === true || v === 'true'; continue; }
    if (opt.type === 'number') {
      v = v === undefined || v === '' ? opt.default : Number(v);
      if (!Number.isFinite(v)) v = opt.default;
      out[opt.id] = Math.min(opt.max ?? Infinity, Math.max(opt.min ?? -Infinity, Math.round(v)));
      continue;
    }
    v = v === undefined || v === null ? (opt.default ?? '') : String(v);
    if (opt.maxLength && v.length > opt.maxLength) throw new UserError(`“${opt.label}” is too long.`, 400);
    if (opt.type === 'radio' || opt.type === 'select') {
      const choices = opt.choices === 'ocrLanguages' ? ocrLanguages() : opt.choices;
      if (!choices.some(([c]) => c === v)) v = choices.some(([c]) => c === opt.default) ? opt.default : (choices[0] || [''])[0];
    }
    if (opt.required && !v) throw new UserError(`Please fill in “${opt.label}”.`, 400);
    out[opt.id] = v;
  }
  return out;
}

/** "My report.final.PDF" -> "My report.final" (safe for file names and headers). */
function baseName(name) {
  const base = path.basename(String(name || 'file')).replace(/\.[a-z0-9]{1,5}$/i, '');
  return base.replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, '_').trim().slice(0, 100) || 'file';
}

module.exports = { uploader, validateFile, validateOptions, baseName, sniff };
