// Flipit Free — free online file converter and compressor.
// One job: accept ONE image at a time, compress/convert it, return the bytes.
// The frontend (public/script.js) loops over selected files and calls this
// once per file, then optionally bundles the results into a zip in-browser.

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const accounts = require('./accounts');
const analytics = require('./accounts/analytics');
const pages = require('./pages');
const registry = require('./registry');
const { getHandler } = require('./engines');
const { compressToSize, SIZE_TARGET_FORMATS } = require('./engines/size-target');
const pdfTools = require('./engines/pdf-tools');
const seo = require('./seo');

const PORT = process.env.PORT || 3000;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 40);
const MAX_FILES_PER_WINDOW = Number(process.env.RATE_LIMIT_MAX || 120);

const app = express();

// Behind Nginx/Render/Railway etc. set TRUST_PROXY=1 so the rate limiter sees the
// real visitor IP instead of the proxy's, and req.protocol reflects https.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const baseOf = (req) => BASE_URL || `${req.protocol}://${req.get('host')}`;

// --------------------------------------------------------------- security --
// Real, unlimited-looking public tools are exactly what gets abused, so:
//  - helmet: sane default security headers
//  - compression: gzip JSON/error responses (images are already compressed,
//    so this mostly helps the JSON error paths and the static frontend)
//  - rate limiting: caps requests per IP per window. Tune MAX_FILES_PER_WINDOW
//    via env var to match what your server/hosting plan can actually afford —
//    this is the knob that keeps "unlimited free" from becoming a cost spiral.
// Helmet's default CSP allows scripts from this site only, which is why JSZip is served
// from node_modules below rather than a CDN.
// img-src adds blob: for the result thumbnails, which are object URLs of the converted files.
// With AdSense on (ADSENSE_CLIENT set) the policy opens up to HTTPS hosts: AdSense, its
// consent message and its ad-quality checks load scripts, frames and images from many
// Google domains (country domains included) that change over time, so a fixed list breaks ads.
const CSP = pages.ADS_ENABLED
  ? {
    'script-src': ["'self'", "'unsafe-inline'", 'https:'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'frame-src': ["'self'", 'https:'],
    'connect-src': ["'self'", 'https:'],
    'media-src': ["'self'", 'blob:'],
  }
  : {
    'img-src': ["'self'", 'data:', 'blob:'],
    // Cloudflare Web Analytics (visitor counts without cookies), injected by Cloudflare when enabled.
    'script-src': ["'self'", 'https://static.cloudflareinsights.com'],
    'connect-src': ["'self'", 'https://cloudflareinsights.com'],
    // the video trimmer and MP3 cutter preview the chosen file from a blob: URL
    'media-src': ["'self'", 'blob:'],
  };
app.use(helmet({
  // keep Express's "X-Powered-By: Express" header, so technology checkers (Wappalyzer, BuiltWith)
  // can see the site runs on Node.js and Express
  xPoweredBy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { directives: CSP },
  // Ad networks need the page origin to serve and count ads; full URLs still stay private.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(compression());

// ------------------------------------------------------ URL normalisation --
// One URL per page: duplicates (upper case, trailing slash, //, /index.html, http vs https,
// www vs bare domain) 301 to the canonical form so ranking signals are never split.
// Host/protocol redirects only run when BASE_URL is set and FORCE_CANONICAL_HOST=1,
// so local development and preview deployments are not redirected.
const CANON = (() => { try { return BASE_URL ? new URL(BASE_URL) : null; } catch { return null; } })();
const FORCE_HOST = process.env.FORCE_CANONICAL_HOST === '1' && CANON;
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/')) return next();
  const q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  let p = req.path;
  if (p !== '/' && !/\.[a-z0-9]+$/i.test(p)) p = p.toLowerCase(); // never touch static file names
  p = p.replace(/\/{2,}/g, '/').replace(/\/index\.html?$/i, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
  const wrongHost = FORCE_HOST && (req.hostname !== CANON.hostname || req.protocol !== CANON.protocol.replace(':', ''));
  if (p !== req.path || wrongHost) {
    return res.redirect(301, (wrongHost ? CANON.origin : '') + (p || '/') + q);
  }
  next();
});

// API responses and generated images should never show up as search results themselves.
app.use('/api/', (_req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: MAX_FILES_PER_WINDOW,
  // the page-view beacon has its own limit (accounts/index.js); upload pieces and job polling are
  // parts of one conversion, which is counted when it starts
  skip: (req) => req.path === '/p' || /^\/upload\/[a-f0-9]{24}\/\d+$/.test(req.path) || /^\/jobs\//.test(req.path),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this connection. Please wait a few minutes and try again.' },
}));

// Static files are referenced as /style.css?v=<hash>, so they can be cached for a year.
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  setHeaders: (res, _p) => res.set('Cache-Control', 'public, max-age=31536000, immutable'),
}));
app.get('/vendor/jszip.min.js', (_req, res) => res.set('Cache-Control', 'public, max-age=604800')
  .sendFile(require.resolve('jszip/dist/jszip.min.js')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 },
});

// ------------------------------------------------------------- format map --
// What this server accepts is no longer hard-coded here: registry/ says which formats
// can be read and written and which handler does the work. 'experimental' converters
// (e.g. HEIC, whose decoding depends on how libvips was built) are accepted and simply
// fail with a clear message if the build can't decode them.
const ACCEPT = { minStatus: 'experimental' };
const ACCEPTED_OUTPUT_KEYS = new Set(registry.getOutputFormats(ACCEPT).map((f) => f.apiFormat));

function extOf(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : '';
}

function pickAutoFormat(inputExt) {
  // Formats that commonly carry transparency stay lossless (PNG);
  // photographic formats compress to WebP, which beats JPEG at the
  // same visual quality in almost every case a modern browser will see.
  const transparencyProne = ['png', 'gif', 'svg'];
  return transparencyProne.includes(inputExt) ? 'png' : 'webp';
}

// ------------------------------------------------------------------ route --
// One file in, one file out (or a ZIP when a conversion makes several files, e.g. PDF pages).
// `format` is the target format's id ("mp3", "docx", "tar-gz") or its legacy image key ("jpeg").
const MIME_ZIP = 'application/zip';
// "backup.tar.gz" -> "backup" (drops the input format's full extension, not just ".gz")
function safeName(name, inFormat) {
  let base = String(name || 'file');
  const ext = inFormat && inFormat.extensions.find((e) => base.toLowerCase().endsWith(`.${e}`));
  base = ext ? base.slice(0, -(ext.length + 1)) : base.replace(/\.[^.]*$/, '');
  // keep the visitor's own name (spaces, accents); drop only characters unsafe in file names/headers
  return base.replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, '_').trim().slice(0, 120) || 'file';
}
// Content-Disposition with an ASCII fallback plus the exact UTF-8 name (RFC 6266 / 5987).
const disposition = (name) => `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;

// The page the conversion was started from, for the dashboard's activity list.
const fromPage = (req) => { try { return new URL(req.get('referer')).pathname; } catch { return ''; } };

app.post('/api/compress', upload.single('file'), async (req, res) => {
  let pair = '';
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    const originalName = req.file.originalname || 'file';
    const inFormat = registry.getFormatByFilename(originalName);
    const inputExt = inFormat ? inFormat.id : extOf(originalName);
    const originalSize = req.file.size;

    const quality = Math.min(100, Math.max(1, parseInt(req.body.quality, 10) || 75));
    const maxDim = Math.max(0, parseInt(req.body.maxDim, 10) || 0);
    let format = String(req.body.format || 'auto').toLowerCase();

    if (!inFormat) {
      return res.status(415).json({ error: `".${extOf(originalName) || '?'}" isn't a file type this server can read.` });
    }
    if (format === 'auto') {
      if (!inFormat.categories.includes('image')) return res.status(400).json({ error: 'Choose the format you want to convert to.' });
      format = pickAutoFormat(inputExt);
    }
    const outFormat = registry.getFormatByApiFormat(format) || registry.getFormat(format);
    if (!outFormat || !ACCEPTED_OUTPUT_KEYS.has(outFormat.apiFormat)) {
      return res.status(400).json({ error: `Unsupported output format requested: ${format}` });
    }

    // Ask the registry whether this input -> output is something we can do.
    // Same format in and out means "compress".
    const converter = inFormat.id === outFormat.id ? registry.getCompressor(inFormat, ACCEPT)
      : registry.getConverter(inFormat, outFormat, ACCEPT);
    if (!converter) {
      return res.status(415).json({ error: `${inFormat.label} to ${outFormat.label} isn't available on this server yet.` });
    }

    pair = `${inFormat.label} \u2192 ${outFormat.label}`;
    const handler = getHandler(converter.handler);
    const job = (q, dim) => handler(
      { buffer: req.file.buffer, inputExt, format: outFormat.apiFormat, quality: q, maxDim: dim, from: inFormat, to: outFormat, filename: originalName, level: String(req.body.level || '') },
      converter
    );
    // Compressing an image with "Reduce size by N%": aim for that size instead of a fixed quality.
    const reduce = Math.min(90, Math.max(0, parseInt(req.body.reduce, 10) || 0));
    const sizeTarget = reduce && inFormat.id === outFormat.id && SIZE_TARGET_FORMATS.has(outFormat.apiFormat);
    const result = sizeTarget
      ? await compressToSize(job, req.file.buffer, Math.floor(originalSize * (1 - reduce / 100)), maxDim, outFormat.apiFormat)
      : await job(quality, maxDim);
    const out = Buffer.isBuffer(result) ? { buffer: result, ext: outFormat.extension } : result;
    const ext = out.ext || outFormat.extension;
    const mime = ext === 'zip' && outFormat.id !== 'zip' ? MIME_ZIP : (out.mime || outFormat.mimeType);

    res.set({
      'Content-Type': mime,
      'Content-Disposition': disposition(`${safeName(originalName, inFormat)}.${ext}`),
      'X-Original-Size': String(originalSize),
      'X-Compressed-Size': String(out.buffer.length),
      'X-Output-Ext': ext,
    });
    res.send(out.buffer);
    analytics.event(req, inFormat.id === outFormat.id ? 'compress' : 'convert', { pair, p: fromPage(req) });
  } catch (err) {
    if (pair) analytics.event(req, 'fail', { pair, p: fromPage(req) });
    if (err.userMessage) return res.status(err.statusCode || 422).json({ error: err.userMessage });
    if (/unsupported image format|Input buffer contains unsupported/i.test(err.message || '')) {
      return res.status(415).json({ error: 'This file could not be read. It may be damaged, or use a variant of the format this server does not support.' });
    }
    console.error('Conversion error:', err);
    res.status(500).json({ error: 'This file could not be converted. It may be damaged or use an unusual variant of the format.' });
  }
});

// PDF tools that need the server: protect, unlock, repair, PDF/A (the rest run in the browser).
const TOOL_SUFFIX = { protect: 'protected', unlock: 'unlocked', repair: 'repaired', pdfa: 'pdfa' };
app.post('/api/pdf-tool', upload.single('file'), async (req, res) => {
  const op = String(req.body && req.body.op || '');
  const name = pdfTools.OPS[op] ? pdfTools.OPS[op].name : '';
  try {
    if (!name) return res.status(400).json({ error: 'Unknown PDF tool.' });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    const out = await pdfTools.pdfTool({ buffer: req.file.buffer, op, password: req.body.password || '', level: req.body.level });
    const base = safeName(req.file.originalname || 'document.pdf', registry.getFormat('pdf'));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition(`${base}-${TOOL_SUFFIX[op]}.pdf`),
      'X-Original-Size': String(req.file.size),
      'X-Compressed-Size': String(out.buffer.length),
      ...(out.note ? { 'X-Note': out.note } : {}),
    });
    res.send(out.buffer);
    analytics.event(req, 'tool', { pair: name, p: fromPage(req) });
  } catch (err) {
    if (name) analytics.event(req, 'fail', { pair: name, p: fromPage(req) });
    if (err.userMessage) return res.status(err.statusCode || 422).json({ error: err.userMessage });
    console.error('PDF tool error:', err);
    res.status(500).json({ error: 'This PDF could not be processed. It may be damaged or use an unusual variant of PDF.' });
  }
});

// Text recognition (Image to Text, OCR PDF): text back as plain text, or a searchable PDF.
const ocrEngine = require('./engines/ocr');
app.post('/api/ocr', upload.single('file'), async (req, res) => {
  const format = req.body && req.body.format === 'pdf' ? 'pdf' : 'txt';
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    const out = await ocrEngine.ocr({ buffer: req.file.buffer, lang: String(req.body.lang || 'eng'), format });
    const base = String(req.file.originalname || 'scan').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'scan';
    res.set({
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'text/plain; charset=utf-8',
      'Content-Disposition': disposition(format === 'pdf' ? `${base}-searchable.pdf` : `${base}.txt`),
      'X-Pages': String(out.pages),
    });
    res.send(out.buffer);
    analytics.event(req, 'tool', { pair: format === 'pdf' ? 'OCR to PDF' : 'OCR to text', p: fromPage(req) });
  } catch (err) {
    analytics.event(req, 'fail', { pair: 'OCR', p: fromPage(req) });
    if (err.userMessage) return res.status(err.statusCode || 422).json({ error: err.userMessage });
    console.error('OCR error:', err);
    res.status(500).json({ error: 'The text could not be read from this file. Try a clearer photo or scan.' });
  }
});

// Background remover: a PNG with a transparent background (engines/bgremove.js).
const bgEngine = require('./engines/bgremove');
app.post('/api/remove-bg', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    const out = await bgEngine.removeBackground({ buffer: req.file.buffer });
    const base = String(req.file.originalname || 'image').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'image';
    res.set({ 'Content-Type': 'image/png', 'Content-Disposition': disposition(`${base}-no-background.png`) });
    res.send(out.buffer);
    analytics.event(req, 'tool', { pair: 'Remove background', p: fromPage(req) });
  } catch (err) {
    analytics.event(req, 'fail', { pair: 'Remove background', p: fromPage(req) });
    if (err.userMessage) return res.status(err.statusCode || 422).json({ error: err.userMessage });
    console.error('Background removal error:', err);
    res.status(500).json({ error: 'The background could not be removed from this image.' });
  }
});

// Video compressor, video trimmer, MP3 cutter, ringtone maker. Videos are big: the page sends the
// file in pieces of up to 32 MB (a proxy such as Cloudflare's free plan refuses a single request
// over 100 MB), they are joined on disk here, and the work runs as a background job the page polls
// (engines/media-tools.js).
const mediaTools = require('./engines/media-tools');
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB || 500);
const CHUNK_MAX = 40 * 1024 * 1024;
const UPLOADS = new Map(); // id -> { path, size, got, next, name, at }
const UP_DIR = require('os').tmpdir();
setInterval(() => { // unfinished or unused uploads are dropped after 30 minutes
  for (const [id, u] of UPLOADS) if (Date.now() - u.at > 30 * 60 * 1000) { UPLOADS.delete(id); fs.promises.rm(u.path, { force: true }).catch(() => {}); }
}, 60 * 1000).unref();
app.post('/api/upload', express.json({ limit: '4kb' }), (req, res) => {
  const size = Number(req.body && req.body.size), name = String((req.body && req.body.name) || 'file').slice(0, 200);
  if (!(size > 0)) return res.status(400).json({ error: 'No file received.' });
  if (size > MAX_VIDEO_MB * 1024 * 1024) return res.status(413).json({ error: `File is larger than the ${MAX_VIDEO_MB}MB limit set on this server.` });
  if (UPLOADS.size >= 50) return res.status(503).json({ error: 'The server is busy with other uploads right now. Please try again in a few minutes.' });
  const id = require('crypto').randomBytes(12).toString('hex');
  UPLOADS.set(id, { path: path.join(UP_DIR, `squish-up-${id}`), size, got: 0, next: 0, name, at: Date.now() });
  res.json({ id, chunk: 32 * 1024 * 1024 });
});
app.put('/api/upload/:id/:n', (req, res) => {
  const u = UPLOADS.get(req.params.id), n = Number(req.params.n);
  if (!u) return res.status(404).json({ error: 'This upload has expired. Please choose the file again.' });
  if (n !== u.next) return res.status(409).json({ error: 'The upload got out of step. Please try again.' });
  let got = 0; let failed = false;
  const out = fs.createWriteStream(u.path, { flags: 'a' });
  const fail = (code, msg) => { if (failed) return; failed = true; req.unpipe(out); out.destroy(); res.status(code).json({ error: msg }); };
  req.on('data', (d) => { got += d.length; if (got > CHUNK_MAX || u.got + got > u.size) fail(413, 'This upload is larger than announced.'); });
  req.pipe(out);
  out.on('finish', () => { if (failed) return; u.got += got; u.next += 1; u.at = Date.now(); res.json({ got: u.got }); });
  out.on('error', () => fail(500, 'The upload could not be saved.'));
});
const mediaBase = (name) => String(name || 'file').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'file';
const startMedia = (name, work) => (req, res) => {
  const u = UPLOADS.get(String(req.body && req.body.upload));
  if (!u || u.got !== u.size) return res.status(400).json({ error: 'The upload is not complete. Please choose the file again.' });
  UPLOADS.delete(String(req.body.upload)); // the job owns the file now and deletes it when done
  try {
    const id = mediaTools.startJob(u.path, work.base(u.name, req.body), (dir) => work.run(u.path, req.body, dir));
    res.json({ id });
    analytics.event(req, 'tool', { pair: name, p: fromPage(req) });
  } catch (err) {
    if (err.userMessage) return res.status(err.statusCode || 422).json({ error: err.userMessage });
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
};
app.post('/api/video/compress', express.json({ limit: '4kb' }), startMedia('Compress video', {
  base: (n) => `${mediaBase(n)}-compressed`,
  run: (file, b, dir) => mediaTools.compressVideo(file, {
    targetMB: Number(b.targetMB) > 0 ? Math.min(Number(b.targetMB), 2000) : 0,
    quality: ['high', 'medium', 'low'].includes(b.quality) ? b.quality : 'medium',
  }, dir),
}));
app.post('/api/media/trim', express.json({ limit: '4kb' }), startMedia('Trim media', {
  base: (n, b) => `${mediaBase(n)}-${b.format === 'm4r' ? 'ringtone' : 'cut'}`,
  run: (file, b, dir) => mediaTools.trimMedia(file, {
    start: Number(b.start), end: Number(b.end), format: String(b.format || 'mp3'),
    fadeIn: Number(b.fadeIn) || 0, fadeOut: Number(b.fadeOut) || 0, maxLen: b.ringtone === '1' ? 40 : 0,
  }, dir),
}));
app.get('/api/jobs/:id', (req, res) => {
  const j = mediaTools.getJob(req.params.id);
  if (!j) return res.status(404).json({ error: 'This result has expired. Please upload the file again.' });
  res.set('Cache-Control', 'no-store').json({ status: j.status, error: j.error, size: j.size, name: j.name, note: j.note });
});
app.get('/api/jobs/:id/file', (req, res) => {
  const j = mediaTools.getJob(req.params.id);
  if (!j || j.status !== 'done') return res.status(404).json({ error: 'This result has expired. Please upload the file again.' });
  res.set({ 'Content-Type': j.type, 'Content-Disposition': disposition(j.name), 'Cache-Control': 'no-store' }).sendFile(j.file);
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));


// ------------------------------------------------------------ SEO pages --
// Every supported conversion gets its own crawlable landing page.
const sendHtml = (res, html) => res.set('Cache-Control', 'public, max-age=3600').type('html').send(html);

// --------------------------------------------------- icons, manifest, OG --
const DAY = 86400;
const sendPng = (res, buf, maxAge = 7 * DAY) => res.set('Cache-Control', `public, max-age=${maxAge}`).type('png').send(buf);
app.get('/favicon.svg', (_req, res) => res.set('Cache-Control', `public, max-age=${30 * DAY}`).type('image/svg+xml').send(seo.FAVICON_SVG));
app.get('/favicon.ico', async (_req, res, next) => {
  try { res.set('Cache-Control', `public, max-age=${30 * DAY}`).type('image/x-icon').send(await seo.faviconIco()); } catch (e) { next(e); }
});
const ICONS = { '/apple-touch-icon.png': [180, 3], '/icon-192.png': [192, 0], '/icon-512.png': [512, 0], '/icon-maskable-512.png': [512, 6] };
app.get(Object.keys(ICONS), async (req, res, next) => {
  try { sendPng(res, await seo.iconPng(...ICONS[req.path]), 30 * DAY); } catch (e) { next(e); }
});
app.get('/site.webmanifest', (_req, res) => res.set('Cache-Control', `public, max-age=${DAY}`).type('application/manifest+json').send(seo.manifest()));

// Open Graph share image for a page: /og/png-to-webp.png. Only keys that map to a real page render.
app.get(/^\/og\/([a-z0-9-]+)\.png$/, async (req, res, next) => {
  const spec = pages.ogSpec(req.params[0]);
  if (!spec) return next();
  try { sendPng(res, await seo.ogPng(req.params[0], spec)); } catch (e) { next(e); }
});

// IndexNow (Bing, Yandex, Seznam...): set INDEXNOW_KEY and this serves the ownership file.
if (/^[a-zA-Z0-9-]{8,128}$/.test(process.env.INDEXNOW_KEY || '')) {
  app.get(`/${process.env.INDEXNOW_KEY}.txt`, (_req, res) => res.type('text/plain').send(process.env.INDEXNOW_KEY));
}

app.get('/', (req, res) => sendHtml(res, pages.homePage(baseOf(req))));
app.get('/converters', (req, res) => sendHtml(res, pages.hubPage(baseOf(req))));

// Format ids can contain hyphens (tar-gz), so the split happens in the registry, not here.
// Converters under the names people search for (/pdf-to-word, /word-to-pdf ...). Before the X-to-Y
// route, which would otherwise read "pdf-to-word" as an unknown pair.
if (pages.friendlies().length) app.get(new RegExp(`^/(${pages.friendlies().map((x) => x.slug).join('|')})$`), (req, res) => sendHtml(res, pages.resolveFriendly(req.params[0], baseOf(req)).html));
// PDF tools (/split-pdf, /protect-pdf ...). Before the X-to-Y route, which would read /pdf-to-pdfa as a pair.
app.get(new RegExp(`^/(${[...pages.PDF_TOOLS.map((t) => t.slug), 'pdf-tools'].join('|')})$`), (req, res) => sendHtml(res, pages.resolvePdfTool(req.params[0], baseOf(req)).html));
// PDF editor landing pages (/resume-maker, /invoice-generator, /sign-pdf ...): the editor with
// its own text. Before the X-to-Y route, since some of them (add-text-to-pdf) look like pairs.
app.get(new RegExp(`^/(${pages.APPS.map((t) => t.slug).join('|')})$`), (req, res) => sendHtml(res, pages.resolveApp(req.params[0], baseOf(req)).html));
if (pages.PDF_EDITOR && pages.EDITOR_LANDINGS.length) {
  app.get(new RegExp(`^/(${pages.EDITOR_LANDINGS.map((l) => l.slug).join('|')})$`), (req, res) => sendHtml(res, pages.editorPage(baseOf(req), req.params[0])));
}
app.get(/^\/([a-z0-9-]+?)-to-([a-z0-9-]+)$/, (req, res, next) => {
  const r = pages.resolvePair(req.params[0], req.params[1], baseOf(req));
  if (!r) return next();
  if (r.redirect) return res.redirect(301, r.redirect);
  sendHtml(res, r.html);
});

app.get(/^\/compress-([a-z0-9-]+)$/, (req, res, next) => {
  const r = pages.resolveCompress(req.params[0], baseOf(req));
  if (!r) return next();
  if (r.redirect) return res.redirect(301, r.redirect);
  sendHtml(res, r.html);
});

// /png-converter (format page) and /image-converter (category page)
app.get(/^\/([a-z0-9-]+)-converter$/, (req, res, next) => {
  const r = pages.resolveConverter(req.params[0], baseOf(req));
  if (!r) return next();
  if (r.redirect) return res.redirect(301, r.redirect);
  sendHtml(res, r.html);
});

// PDF editor: switched on with PDF_EDITOR=1. pdf.js (rendering) and pdf-lib (saving) are served
// from node_modules, like JSZip, so the page needs no third-party scripts.
// PDF writer for the browser: the editor, and "one PDF" when several images are converted to PDF.
app.get('/vendor/pdf-lib.min.js', (_req, res) => res.set('Cache-Control', 'public, max-age=604800')
  .sendFile(require.resolve('pdf-lib/dist/pdf-lib.min.js')));
// pdf.js renders page previews in the editor and the PDF tools (split, organize, crop ...).
{
  const pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const vendorOpts = { index: false, maxAge: '7d' };
  for (const dir of ['build', 'cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    // the legacy build includes the polyfills that older (but still common) browsers need
    app.use(`/vendor/pdfjs${dir === 'build' ? '' : `/${dir}`}`, express.static(path.join(pdfjsDir, dir === 'build' ? 'legacy/build' : dir), vendorOpts));
  }
}
// Google fonts kept on this server: the PDF editor and the signature generator use them.
require('./fonts').routes(app);
if (pages.PDF_EDITOR) {
  app.get('/vendor/fontkit.umd.min.js', (_req, res) => res.set('Cache-Control', 'public, max-age=604800')
    .sendFile(require.resolve('@pdf-lib/fontkit/dist/fontkit.umd.min.js')));
  app.get('/edit-pdf', (req, res) => sendHtml(res, pages.editorPage(baseOf(req))));
}

// The Tools menu for pages that load it on demand (see topbar() in pages.js); versioned, so cached for a year.
// Accounts (ACCOUNTS=1): sign up / sign in, the account page and the owner's dashboard.
accounts.mount(app, { pages, baseOf });

app.get('/search.json', (_req, res) => res.set({ 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Robots-Tag': 'noindex' }).type('json').send(pages.searchIndex().body));
app.get('/menu.html', (_req, res) => res.set({ 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Robots-Tag': 'noindex' }).type('html').send(pages.megaMenu()));
app.get('/formats', (_req, res) => res.redirect(301, '/converters'));
app.get(/^\/(about|privacy|terms|contact)$/, (req, res, next) => {
  const r = pages.resolveInfo(req.params[0], baseOf(req));
  return r ? sendHtml(res, r.html) : next();
});

// How-to articles: /guides lists them, /guides/<slug> is one article.
app.get(/^\/guides(?:\/([a-z0-9-]+))?$/, (req, res, next) => {
  const r = pages.resolveGuide(req.params[0], baseOf(req));
  return r ? sendHtml(res, r.html) : next();
});

app.get('/sitemap.xml', (req, res) => res.set('Cache-Control', 'public, max-age=3600').type('application/xml').send(pages.sitemap(baseOf(req))));
app.get('/ads.txt', (_req, res) => {
  const txt = pages.adsTxt();
  if (!txt) return res.status(404).type('text/plain').send('Not found');
  res.set('Cache-Control', 'public, max-age=86400').type('text/plain').send(txt);
});
app.get('/robots.txt', (req, res) => res.set('Cache-Control', 'public, max-age=3600').type('text/plain').send(pages.robots(baseOf(req))));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.status(404).type('html').send(pages.notFoundPage(baseOf(req)));
});

app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File is larger than the ${MAX_FILE_MB}MB limit set on this server.` });
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`Flipit Free server listening on port ${PORT} (max ${MAX_FILE_MB}MB/file, ${MAX_FILES_PER_WINDOW} req/15min per IP)`);
  // Say which engines are missing, so a half-installed server is obvious in the logs.
  const stats = registry.getStats();
  const missing = registry.getEngines().filter((e) => e.status === 'system' && !e.available);
  console.log(`${stats.converters.live} conversions live, ${stats.compressors.live || 0} compressors live.`);
  missing.forEach((e) => console.warn(`Engine not available: ${e.name} (missing: ${e.missingBins.join(', ')}). Its conversions are switched off.`));
});
