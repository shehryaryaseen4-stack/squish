'use strict';
// Server-side processors, one per `engine` name in lib/tools.js.
//
// Each processor:
//   needs(caps)   -> true when this server has what it takes (caps from detect.js)
//   run(job)      -> { file, ext, suffix?, info? }   (file = absolute path of the result)
// where job = { input, dir, options, name } and `input` is the uploaded file (already validated).
//
// This is the adapter layer: to send a conversion to an external API instead, replace a
// processor's run() with a call to that service; the API route and the UI stay the same.

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { run, listFiles, assertOutput, zipFiles, UserError } = require('./runner');
const { detect } = require('./detect');

const PY = (script) => path.join(__dirname, 'py', script);

const MSG = {
  locked: 'This PDF is password-protected. Remove the password with Unlock PDF first, then try again.',
  damaged: 'This PDF could not be read. It may be damaged. Try Repair PDF first, or upload a different file.',
  scanned: 'No text was found in this PDF. It looks like a scan: run OCR PDF on it first, then try again.',
};

// ------------------------------------------------------------------ helpers --

/** qpdf's view of the file: 'none' (not encrypted), 'restricted' (opens without a password), 'locked'. */
async function encryption(file) {
  if (!detect().qpdf) return 'unknown';
  try {
    await run('qpdf', ['--requires-password', file], { timeoutMs: 30000 });
    return 'locked'; // exit 0: a password is needed
  } catch (e) {
    if (e.code === 2) return 'none'; // not encrypted (or unreadable: the next step reports that)
    if (e.code === 3) return 'restricted';
    return 'unknown';
  }
}

async function pageCount(file) {
  if (!detect().qpdf) return 0;
  try {
    const { stdout } = await run('qpdf', ['--show-npages', file], { timeoutMs: 30000, okCodes: [3] });
    return Number(stdout.toString().trim()) || 0;
  } catch { return 0; }
}

/** Common checks before working on a PDF: readable, not locked, not too many pages. */
async function checkPdf(file, { allowLocked = false } = {}) {
  const enc = await encryption(file);
  if (enc === 'locked' && !allowLocked) throw new UserError(MSG.locked);
  if (enc !== 'locked') {
    const n = await pageCount(file);
    if (n > config.MAX_PAGES) throw new UserError(`This PDF has ${n} pages. This server handles up to ${config.MAX_PAGES} pages per file.`, 413);
  }
  return enc;
}

// LibreOffice gets a fresh profile per job (so jobs can run side by side) with macros off and
// external links blocked, so a document cannot make the server fetch remote or local files.
const LO_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Misc"><prop oor:name="UseOpenCL" oor:op="fuse"><value>false</value></prop></item>
</oor:items>
`;

async function soffice(dir, input, convertTo, inFilter) {
  const profile = path.join(dir, 'lo-profile');
  await fs.mkdir(path.join(profile, 'user'), { recursive: true });
  await fs.writeFile(path.join(profile, 'user', 'registrymodifications.xcu'), LO_PROFILE);
  const outDir = path.join(dir, 'lo-out');
  await fs.mkdir(outDir, { recursive: true });
  const args = ['--headless', '--norestore', '--nolockcheck', '--nodefault', '--nologo', '--nofirststartwizard',
    `-env:UserInstallation=file://${profile}`];
  if (inFilter) args.push(`--infilter=${inFilter}`);
  args.push('--convert-to', convertTo, '--outdir', outDir, input);
  try {
    await run('soffice', args, { env: { HOME: dir } });
  } catch (e) {
    if (e.userMessage) throw e;
    throw new UserError('This file could not be opened. It may be damaged or password-protected.', 415);
  }
  const files = await listFiles(outDir);
  if (!files.length) throw new UserError('This file could not be opened. It may be damaged, password-protected or in an unusual variant of the format.', 415);
  return files[0];
}

/** Write a secret to a private file so it never appears in the process list. */
async function secretFile(dir, name, value) {
  const f = path.join(dir, name);
  await fs.writeFile(f, `${value}\n`, { mode: 0o600 });
  return f;
}

// Remove everything from an uploaded HTML file that could make the converter fetch a resource
// (remote URLs, local file:// paths, scripts), keeping text, layout, inline styles and data: images.
function sanitizeHtml(html) {
  let s = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<(iframe|object|embed|frame|frameset|applet|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|iframe|object|embed|frame|link|base|meta\s+http-equiv)\b[^>]*>/gi, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)(?!data:)[^)]*\1\s*\)/gi, 'none');
  // Attributes that load something: keep them only when they hold an inline data: image.
  s = s.replace(/<([a-z][\w:-]*)(\s[^>]*)?>/gi, (tag, name, attrs) => {
    if (!attrs) return tag;
    const isLink = name.toLowerCase() === 'a';
    const cleaned = attrs.replace(/\s([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g, (m, attr, raw) => {
      const a = attr.toLowerCase();
      const v = raw.replace(/^['"]|['"]$/g, '').trim();
      if (a.startsWith('on')) return '';
      if (['src', 'srcset', 'background', 'poster', 'data', 'lowsrc', 'dynsrc', 'xlink:href', 'href', 'action', 'formaction'].includes(a)) {
        if (a === 'href' && isLink && /^(https?:|mailto:|#)/i.test(v)) return m; // plain hyperlinks are not fetched
        return /^data:image\//i.test(v) ? m : '';
      }
      return m;
    });
    return `<${name}${cleaned}>`;
  });
  return s;
}

const ok = (file, ext, extra = {}) => ({ file, ext, ...extra });

// --------------------------------------------------------------- processors --

const PROCESSORS = {
  pdfToWord: {
    needs: (c) => c.pdf2docx || c.sofficePdfImport,
    async run({ input, dir }) {
      await checkPdf(input);
      const out = path.join(dir, 'result.docx');
      if (detect().pdf2docx) {
        try {
          await run(config.PYTHON, [PY('pdf_to_docx.py'), input, out]);
        } catch (e) {
          if (e.userMessage) throw e;
          if (e.code === 3) throw new UserError(MSG.locked);
          if (e.code === 4) throw new UserError(MSG.damaged, 415);
          throw e;
        }
        await assertOutput(out);
        return ok(out, 'docx');
      }
      const f = await soffice(dir, input, 'docx:MS Word 2007 XML', 'writer_pdf_import');
      return ok(f, 'docx');
    },
  },

  pdfToExcel: {
    needs: (c) => c.pdfplumber,
    async run({ input, dir, options }) {
      await checkPdf(input);
      const out = path.join(dir, 'result.xlsx');
      try {
        await run(config.PYTHON, [PY('pdf_to_xlsx.py'), input, out, options.layout === 'single' ? 'single' : 'page']);
      } catch (e) {
        if (e.userMessage) throw e;
        if (e.code === 3) throw new UserError(MSG.locked);
        if (e.code === 4) throw new UserError(MSG.damaged, 415);
        if (e.code === 5) throw new UserError(MSG.scanned);
        throw e;
      }
      await assertOutput(out);
      return ok(out, 'xlsx');
    },
  },

  pdfToPowerpoint: {
    needs: (c) => c.sofficePdfImport,
    async run({ input, dir }) {
      await checkPdf(input);
      const f = await soffice(dir, input, 'pptx:Impress MS PowerPoint 2007 XML', 'impress_pdf_import');
      return ok(f, 'pptx');
    },
  },

  officeToPdf: {
    needs: (c) => c.soffice,
    async run({ input, dir }) {
      const f = await soffice(dir, input, 'pdf');
      return ok(f, 'pdf');
    },
  },

  htmlToPdf: {
    needs: (c) => c.soffice,
    async run({ input, dir }) {
      const raw = await fs.readFile(input);
      const clean = path.join(dir, 'page.html');
      await fs.writeFile(clean, sanitizeHtml(raw.toString('utf8')));
      const f = await soffice(dir, clean, 'pdf:writer_web_pdf_Export');
      return ok(f, 'pdf');
    },
  },

  compress: {
    needs: (c) => c.gs,
    async run({ input, dir, options }) {
      await checkPdf(input);
      const preset = { low: '/printer', recommended: '/ebook', extreme: '/screen' }[options.level] || '/ebook';
      const out = path.join(dir, 'result.pdf');
      await ghostscript(input, out, [`-dPDFSETTINGS=${preset}`]);
      return smallerOrOriginal(input, out);
    },
  },

  reduce: {
    needs: (c) => c.gs,
    async run({ input, dir, options }) {
      await checkPdf(input);
      const dpi = [72, 110, 150, 200].includes(Number(options.dpi)) ? Number(options.dpi) : 110;
      const args = ['-dPDFSETTINGS=/printer',
        '-dDownsampleColorImages=true', '-dDownsampleGrayImages=true', '-dDownsampleMonoImages=true',
        '-dColorImageDownsampleType=/Bicubic', '-dGrayImageDownsampleType=/Bicubic',
        `-dColorImageResolution=${dpi}`, `-dGrayImageResolution=${dpi}`, `-dMonoImageResolution=${Math.max(dpi * 2, 150)}`,
        '-dColorImageDownsampleThreshold=1.0', '-dGrayImageDownsampleThreshold=1.0'];
      if (options.grayscale) args.push('-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray');
      const out = path.join(dir, 'result.pdf');
      await ghostscript(input, out, args);
      return smallerOrOriginal(input, out);
    },
  },

  optimize: {
    needs: (c) => c.qpdf,
    async run({ input, dir, options }) {
      await checkPdf(input);
      const out = path.join(dir, 'result.pdf');
      const args = ['--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9',
        '--remove-unreferenced-resources=yes'];
      if (options.linearize) args.push('--linearize');
      await qpdf([...args, input, out]);
      return smallerOrOriginal(input, out, { keepResultAnyway: !!options.linearize });
    },
  },

  protect: {
    needs: (c) => c.qpdf,
    async run({ input, dir, options }) {
      const enc = await checkPdf(input);
      if (enc === 'restricted') throw new UserError('This PDF already has security settings. Remove them with Remove PDF Restrictions first, then protect it.');
      const pw = String(options.password || '');
      if (pw.length < 4) throw new UserError('Choose a password of at least 4 characters.', 400);
      if (pw !== String(options.confirm || '')) throw new UserError('The two passwords don’t match.', 400);
      const restricted = !options.allowPrint || !options.allowCopy || !options.allowEdit;
      // With restrictions, a random owner password keeps them enforced for people who only know the open password.
      const owner = restricted ? crypto.randomBytes(24).toString('base64url') : pw;
      const out = path.join(dir, 'result.pdf');
      const argsFile = path.join(dir, 'qpdf-args');
      const lines = ['--encrypt', `--user-password=${pw}`, `--owner-password=${owner}`, '--bits=256',
        `--print=${options.allowPrint ? 'full' : 'none'}`, `--extract=${options.allowCopy ? 'y' : 'n'}`,
        `--modify=${options.allowEdit ? 'all' : 'none'}`, '--', input, out];
      if (lines.some((l) => /[\r\n]/.test(l))) throw new UserError('Passwords cannot contain line breaks.', 400);
      await fs.writeFile(argsFile, `${lines.join('\n')}\n`, { mode: 0o600 });
      await qpdf([`@${argsFile}`]);
      return ok(out, 'pdf');
    },
  },

  unlock: {
    needs: (c) => c.qpdf,
    async run({ input, dir, options }) {
      const enc = await checkPdf(input, { allowLocked: true });
      if (enc === 'none') throw new UserError('This PDF has no password or restrictions, so there is nothing to unlock.');
      const pwFile = await secretFile(dir, 'pw', String(options.password || ''));
      const out = path.join(dir, 'result.pdf');
      try {
        await qpdf([`--password-file=${pwFile}`, '--decrypt', input, out], { rethrowPassword: true });
      } catch (e) {
        if (e.passwordError) {
          throw new UserError(options.password ? 'That password is not correct. Please check it and try again.'
            : 'This PDF needs a password to open. Type the password and try again.');
        }
        throw e;
      }
      return ok(out, 'pdf');
    },
  },

  removeRestrictions: {
    needs: (c) => c.qpdf,
    async run({ input, dir }) {
      const enc = await checkPdf(input, { allowLocked: true });
      if (enc === 'locked') throw new UserError('This PDF needs a password to open. Use Unlock PDF and enter the password instead.');
      if (enc === 'none') throw new UserError('This PDF has no restrictions, so there is nothing to remove.');
      const out = path.join(dir, 'result.pdf');
      await qpdf(['--decrypt', input, out]);
      return ok(out, 'pdf');
    },
  },

  repair: {
    needs: (c) => c.qpdf || c.gs,
    async run({ input, dir }) {
      const out = path.join(dir, 'result.pdf');
      const caps = detect();
      let repaired = false;
      if (caps.qpdf) {
        const enc = await encryption(input);
        if (enc === 'locked') throw new UserError(MSG.locked);
        try { await run('qpdf', [input, out], { okCodes: [3] }); repaired = await usablePdf(out); } catch (e) { if (e.userMessage) throw e; }
      }
      if (!repaired && caps.gs) {
        try { await ghostscript(input, out, []); repaired = await usablePdf(out); } catch (e) { if (e.userMessage) throw e; }
      }
      if (!repaired) throw new UserError('Sorry, this file is too badly damaged to repair, or it is not a PDF.', 422);
      return ok(out, 'pdf');
    },
  },

  ocrPdf: {
    needs: (c) => c.ocrmypdf,
    async run({ input, dir, options }) {
      await checkPdf(input);
      const out = path.join(dir, 'result.pdf');
      const [cmd, ...pre] = config.OCRMYPDF;
      try {
        await run(cmd, [...pre, '-l', options.lang, '--skip-text', '--output-type', 'pdf', '--jobs', '1',
          '--optimize', '1', '--quiet', input, out], { env: { TMPDIR: dir, HOME: dir } });
      } catch (e) {
        if (e.userMessage) throw e;
        if (e.code === 8) throw new UserError(MSG.locked);
        if (e.code === 2 || e.code === 7) throw new UserError(MSG.damaged, 415);
        if (e.code === 6) throw new UserError('This PDF already contains text, so it does not need OCR.');
        throw e;
      }
      await assertOutput(out);
      return ok(out, 'pdf');
    },
  },

  imageToText: {
    needs: (c) => c.tesseract,
    async run({ input, dir, options }) {
      const base = path.join(dir, 'result');
      try {
        await run('tesseract', [input, base, '-l', options.lang], { env: { OMP_THREAD_LIMIT: '1' } });
      } catch (e) {
        if (e.userMessage) throw e;
        throw new UserError('This image could not be read. Try a JPG or PNG, or a clearer picture.', 415);
      }
      const out = `${base}.txt`;
      const text = (await fs.readFile(out, 'utf8')).replace(/\f/g, '\n').trim();
      if (!text) throw new UserError('No text was found in this image. Try a sharper, well-lit picture with larger text.');
      await fs.writeFile(out, `${text}\n`);
      return ok(out, 'txt');
    },
  },

  extractImages: {
    needs: (c) => c.pdfimages,
    async run({ input, dir }) {
      await checkPdf(input);
      const imgDir = path.join(dir, 'images');
      await fs.mkdir(imgDir);
      try {
        await run('pdfimages', ['-all', input, path.join(imgDir, 'image')]);
      } catch (e) {
        if (/Incorrect password/i.test(e.stderr || '')) throw new UserError(MSG.locked);
        if (/Syntax Error|Couldn't/i.test(e.stderr || '')) throw new UserError(MSG.damaged, 415);
        throw e;
      }
      // Soft masks and stencils come out as tiny separate files; keep only real pictures.
      const files = [];
      for (const f of await listFiles(imgDir)) {
        if ((await fs.stat(f)).size >= 200) files.push(f); else await fs.unlink(f);
      }
      if (!files.length) throw new UserError('No images were found in this PDF. To save whole pages as pictures, use PDF to JPG instead.');
      const info = { count: files.length };
      if (files.length === 1) return ok(files[0], path.extname(files[0]).slice(1), { info, suffix: 'image' });
      const zip = path.join(dir, 'images.zip');
      await zipFiles(files, zip, imgDir);
      return ok(zip, 'zip', { info, suffix: 'images' });
    },
  },
};

// ------------------------------------------------------- engine wrappers --

async function ghostscript(input, out, extra) {
  try {
    await run('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.6',
      '-dDetectDuplicateImages=true', '-dCompressFonts=true', '-dSubsetFonts=true', '-dAutoRotatePages=/None',
      ...extra, `-sOutputFile=${out}`, input]);
  } catch (e) {
    if (/password/i.test(e.stderr || '')) throw new UserError(MSG.locked);
    if (/Unrecoverable error|Error: \/syntaxerror|Couldn't/i.test(e.stderr || '')) throw new UserError(MSG.damaged, 415);
    throw e;
  }
  await assertOutput(out);
}

async function qpdf(args, { rethrowPassword = false } = {}) {
  try {
    await run('qpdf', args, { okCodes: [3] }); // 3 = finished with warnings
  } catch (e) {
    if (/invalid password/i.test(e.stderr || '')) {
      if (rethrowPassword) { const err = new Error('password'); err.passwordError = true; throw err; }
      throw new UserError(MSG.locked);
    }
    if (/not a PDF file|can't find PDF header|unable to find trailer/i.test(e.stderr || '')) throw new UserError(MSG.damaged, 415);
    throw e;
  }
}

async function usablePdf(file) {
  try {
    if ((await fs.stat(file)).size < 64) return false;
    if (!detect().qpdf) return true;
    return (await pageCount(file)) > 0;
  } catch { return false; }
}

async function smallerOrOriginal(input, out, { keepResultAnyway = false } = {}) {
  const before = (await fs.stat(input)).size;
  const after = (await fs.stat(out)).size;
  if (after < before || keepResultAnyway) return ok(out, 'pdf', { info: { before, after } });
  return ok(input, 'pdf', { info: { before, after: before, notSmaller: true } });
}

// ----------------------------------------------------------------- exports --

function getProcessor(engine) {
  return PROCESSORS[engine];
}

/** Is the server-side tool usable on this server? Browser tools always are. */
function toolAvailable(tool) {
  if (tool.runs !== 'server') return true;
  const p = PROCESSORS[tool.engine];
  return !!(p && p.needs(detect()));
}

module.exports = { getProcessor, toolAvailable, sanitizeHtml, PROCESSORS };
