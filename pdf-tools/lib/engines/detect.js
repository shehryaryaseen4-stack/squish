'use strict';
// Finds out, once at startup, which command-line engines this server has.
// A tool whose engine is missing is shown as "not available on this server" instead of failing.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const config = require('../config');

function onPath(bin) {
  if (config.DISABLE.has(bin)) return false;
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    try { fs.accessSync(path.join(dir, bin), fs.constants.X_OK); return true; } catch { /* keep looking */ }
  }
  return false;
}

// True when the command starts and exits cleanly (catches broken installs, not just missing ones).
function runs(cmd, args) {
  if (config.DISABLE.has(path.basename(cmd[cmd.length - 1]))) return false;
  const r = spawnSync(cmd[0], [...cmd.slice(1), ...args], { timeout: 30000, stdio: 'ignore' });
  return r.status === 0;
}

function pythonHas(modules) {
  if (config.DISABLE.has('python')) return false;
  const r = spawnSync(config.PYTHON, ['-c', modules.map((m) => `import ${m}`).join(';')], { timeout: 30000, stdio: 'ignore' });
  return r.status === 0;
}

// LibreOffice: soffice alone cannot open documents; the Writer/Calc/Impress/Draw modules must exist.
function libreofficeModules() {
  if (!onPath('soffice')) return {};
  const roots = ['/usr/lib/libreoffice/program', '/opt/libreoffice/program', '/usr/lib64/libreoffice/program',
    '/Applications/LibreOffice.app/Contents/Frameworks'];
  const has = (lib) => roots.some((r) => fs.existsSync(path.join(r, lib)));
  return {
    writer: has('libswlo.so') || has('libswlo.dylib'),
    calc: has('libsclo.so') || has('libsclo.dylib'),
    impress: has('libsdlo.so') || has('libsdlo.dylib'),
    pdfimport: has('libpdfimportlo.so') || has('libpdfimportlo.dylib'),
  };
}

let cached = null;
function detect() {
  if (cached) return cached;
  if (process.env.PDFTOOLS_DETECT === '0') { cached = {}; return cached; }
  const lo = libreofficeModules();
  cached = {
    soffice: !!(lo.writer && lo.calc && lo.impress),
    sofficePdfImport: !!(lo.impress && lo.pdfimport),
    qpdf: onPath('qpdf'),
    gs: onPath('gs'),
    pdfimages: onPath('pdfimages'),
    tesseract: onPath('tesseract'),
    ocrmypdf: onPath('tesseract') && runs(config.OCRMYPDF, ['--version']),
    pdf2docx: pythonHas(['pdf2docx']),
    pdfplumber: pythonHas(['pdfplumber', 'openpyxl']),
  };
  return cached;
}

/** Languages Tesseract can read, as [code, label] pairs (English first). */
let langs = null;
const LANG_NAMES = {
  eng: 'English', deu: 'German', fra: 'French', spa: 'Spanish', ita: 'Italian', por: 'Portuguese', nld: 'Dutch',
  pol: 'Polish', tur: 'Turkish', rus: 'Russian', ukr: 'Ukrainian', ara: 'Arabic', hin: 'Hindi', urd: 'Urdu',
  ben: 'Bengali', chi_sim: 'Chinese (Simplified)', chi_tra: 'Chinese (Traditional)', jpn: 'Japanese', kor: 'Korean',
  vie: 'Vietnamese', ind: 'Indonesian', swe: 'Swedish', nor: 'Norwegian', dan: 'Danish', fin: 'Finnish', ces: 'Czech',
  ell: 'Greek', heb: 'Hebrew', hun: 'Hungarian', ron: 'Romanian', tha: 'Thai', fas: 'Persian', msa: 'Malay',
};
function ocrLanguages() {
  if (langs) return langs;
  langs = [];
  if (detect().tesseract) {
    const r = spawnSync('tesseract', ['--list-langs'], { timeout: 15000, encoding: 'utf8' });
    const codes = String(r.stdout || '').split('\n').slice(1).map((s) => s.trim()).filter((c) => /^[a-z_]{3,10}$/.test(c) && c !== 'osd' && c !== 'equ');
    langs = codes.map((c) => [c, LANG_NAMES[c] || c]).sort((a, b) => (a[0] === 'eng' ? -1 : b[0] === 'eng' ? 1 : a[1].localeCompare(b[1])));
  }
  return langs;
}

module.exports = { detect, ocrLanguages };
