'use strict';
// PDF tools that need the server (the others, such as split, extract, organize and crop, run in
// the browser with pdf-lib: public/pdf-tools.js).
//   protect   add a password (qpdf, AES-256)
//   unlock    remove the password (qpdf; needs the password unless only editing is restricted)
//   repair    rebuild a damaged PDF (qpdf, then Ghostscript if qpdf cannot read it)
//   pdfa      PDF/A for archiving (Ghostscript, PDF/A-1b, 2b or 3b)
// Passwords go to qpdf through files in the job's private temp folder, never on a command line.

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { job, run, readCapped, UserError } = require('./cli');

const has = (bin) => (process.env.PATH || '').split(':').some((d) => { try { fsSync.accessSync(path.join(d, bin), fsSync.constants.X_OK); return true; } catch { return false; } });
const QPDF = has('qpdf'), GS = has('gs');

// Ghostscript's sRGB profile, for the PDF/A output intent.
const ICC = (() => {
  try {
    const root = '/usr/share/ghostscript';
    for (const v of fsSync.readdirSync(root).sort().reverse()) {
      const p = path.join(root, v, 'iccprofiles', 'default_rgb.icc');
      if (fsSync.existsSync(p)) return p;
    }
  } catch { /* no Ghostscript */ }
  return '';
})();

const OPS = {
  protect: { needs: () => QPDF, name: 'Protect PDF' },
  unlock: { needs: () => QPDF, name: 'Unlock PDF' },
  repair: { needs: () => QPDF || GS, name: 'Repair PDF' },
  pdfa: { needs: () => GS && !!ICC, name: 'PDF to PDF/A' },
};
const available = (op) => !!(OPS[op] && OPS[op].needs());

// qpdf exits with 3 when it finished but had to fix things (warnings): the output is fine.
async function qpdf(args, out) {
  try { await run('qpdf', args); } catch (e) {
    if (!/exited with code 3\b/.test(e.message) || !fsSync.existsSync(out)) throw e;
  }
}

const isPdf = (buf) => buf.length > 4 && buf.subarray(0, 1024).includes('%PDF');

async function encrypted(input) {
  if (!QPDF) return false;
  try { await run('qpdf', ['--is-encrypted', input]); return true; } catch { return false; }
}

// Only "you need a password to open it" counts as locked; owner-only restrictions do not.
async function needsPassword(input) {
  if (!QPDF) return false;
  try { await run('qpdf', ['--requires-password', input]); return true; } catch { return false; }
}

/**
 * @param {{buffer: Buffer, op: string, password?: string, level?: string}} p
 * @returns {Promise<{buffer: Buffer, note?: string}>}
 */
async function pdfTool({ buffer, op, password = '', level = '2' }) {
  if (!OPS[op]) throw new UserError('Unknown PDF tool.', 400);
  if (!available(op)) throw new UserError(`${OPS[op].name} is not available on this server yet.`, 503);
  if (op !== 'repair' && !isPdf(buffer)) throw new UserError('This is not a PDF file.', 415);
  return job(async (dir) => {
    const input = path.join(dir, 'input.pdf'), out = path.join(dir, 'output.pdf');
    await fs.writeFile(input, buffer);
    const unreadable = () => new UserError('This PDF could not be read. It may be badly damaged; try Repair PDF first.', 415);

    if (op === 'protect') {
      const pw = String(password);
      if (pw.length < 4) throw new UserError('Use a password of at least 4 characters.', 400);
      if (pw.length > 100 || /[\r\n\0]/.test(pw)) throw new UserError('That password cannot be used. Use up to 100 characters on one line.', 400);
      if (await encrypted(input)) throw new UserError('This PDF already has a password. Unlock it first, then protect it with a new one.', 422);
      // qpdf reads its arguments from @file, one per line, so the password never shows in a process list.
      const argFile = path.join(dir, 'args');
      await fs.writeFile(argFile, ['--encrypt', pw, pw, '256', '--', input, out].join('\n'), { mode: 0o600 });
      try { await qpdf([`@${argFile}`], out); } catch (e) { if (/not a PDF|can't find|damaged|xref/i.test(e.stderr || '')) throw unreadable(); throw e; }
      return { buffer: await readCapped(out) };
    }

    if (op === 'unlock') {
      if (!(await encrypted(input))) return { buffer, note: 'This PDF had no password, so it is unchanged.' };
      const pwFile = path.join(dir, 'pw');
      await fs.writeFile(pwFile, String(password).slice(0, 200), { mode: 0o600 });
      try { await qpdf(['--decrypt', `--password-file=${pwFile}`, input, out], out); } catch (e) {
        if (/invalid password/i.test(e.stderr || '')) {
          throw new UserError(password ? 'That password is not correct. Check it and try again.' : 'This PDF needs its password to open. Type the password and try again.', 422);
        }
        throw e;
      }
      return { buffer: await readCapped(out) };
    }

    // Repair and PDF/A cannot open a PDF that needs a password to open.
    if (await needsPassword(input)) throw new UserError('This PDF is password-protected. Unlock it first with Unlock PDF, then try again.', 422);

    if (op === 'repair') {
      let ok = false;
      if (QPDF) { try { await qpdf([input, out], out); ok = true; } catch { /* try Ghostscript */ } }
      if (!ok && GS) {
        try { await run('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite', `-sOutputFile=${out}`, input]); ok = fsSync.existsSync(out) && fsSync.statSync(out).size > 0; } catch { /* below */ }
      }
      if (!ok) throw new UserError('This file could not be repaired. Too much of it is missing or it is not a PDF.', 422);
      return { buffer: await readCapped(out) };
    }

    // pdfa: the output intent (sRGB) is set by a small PostScript prologue, as Ghostscript documents.
    const lvl = ['1', '2', '3'].includes(String(level)) ? String(level) : '2';
    const def = path.join(dir, 'pdfa_def.ps');
    await fs.writeFile(def, `%!
[ /Title (Document) /DOCINFO pdfmark
/ICCProfile (${ICC.replace(/[()\\]/g, '\\$&')}) def
[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark
[{icc_PDFA} << /N 3 >> /PUT pdfmark
[{icc_PDFA} ICCProfile (r) file /PUT pdfmark
[/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark
[{OutputIntent_PDFA} << /Type /OutputIntent /S /GTS_PDFA1 /DestOutputProfile {icc_PDFA} /OutputConditionIdentifier (sRGB) >> /PUT pdfmark
[{Catalog} << /OutputIntents [ {OutputIntent_PDFA} ] >> /PUT pdfmark
`);
    try {
      await run('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', `--permit-file-read=${ICC}`, `-dPDFA=${lvl}`, '-dPDFACompatibilityPolicy=1',
        '-dNOOUTERSAVE', '-sColorConversionStrategy=RGB', '-sProcessColorModel=DeviceRGB', '-sDEVICE=pdfwrite', `-sOutputFile=${out}`, def, input]);
    } catch (e) {
      if (/Unrecoverable|Couldn't|not a PDF|syntaxerror/i.test(e.stderr || '')) throw unreadable();
      throw e;
    }
    return { buffer: await readCapped(out) };
  });
}

module.exports = { pdfTool, available, OPS };
