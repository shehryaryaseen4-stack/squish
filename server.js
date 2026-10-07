// Flipit Free — free online file converter and compressor.
// One job: accept ONE image at a time, compress/convert it, return the bytes.
// The frontend (public/script.js) loops over selected files and calls this
// once per file, then optionally bundles the results into a zip in-browser.

const path = require('path');
const express = require('express');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const pages = require('./pages');
const registry = require('./registry');
const { getHandler } = require('./engines');
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
  }
  : {
    'img-src': ["'self'", 'data:', 'blob:'],
    // Cloudflare Web Analytics (visitor counts without cookies), injected by Cloudflare when enabled.
    'script-src': ["'self'", 'https://static.cloudflareinsights.com'],
    'connect-src': ["'self'", 'https://cloudflareinsights.com'],
  };
app.use(helmet({
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

app.post('/api/compress', upload.single('file'), async (req, res) => {
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

    const result = await getHandler(converter.handler)(
      { buffer: req.file.buffer, inputExt, format: outFormat.apiFormat, quality, maxDim, from: inFormat, to: outFormat, filename: originalName },
      converter
    );
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
  } catch (err) {
    if (err.userMessage) return res.status(err.statusCode || 422).json({ error: err.userMessage });
    if (/unsupported image format|Input buffer contains unsupported/i.test(err.message || '')) {
      return res.status(415).json({ error: 'This file could not be read. It may be damaged, or use a variant of the format this server does not support.' });
    }
    console.error('Conversion error:', err);
    res.status(500).json({ error: 'This file could not be converted. It may be damaged or use an unusual variant of the format.' });
  }
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
if (pages.PDF_EDITOR) {
  const pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const vendorOpts = { index: false, maxAge: '7d' };
  for (const dir of ['build', 'cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    // the legacy build includes the polyfills that older (but still common) browsers need
    app.use(`/vendor/pdfjs${dir === 'build' ? '' : `/${dir}`}`, express.static(path.join(pdfjsDir, dir === 'build' ? 'legacy/build' : dir), vendorOpts));
  }
  app.get('/vendor/pdf-lib.min.js', (_req, res) => res.set('Cache-Control', 'public, max-age=604800')
    .sendFile(require.resolve('pdf-lib/dist/pdf-lib.min.js')));
  app.get('/edit-pdf', (req, res) => sendHtml(res, pages.editorPage(baseOf(req))));
}

app.get('/formats', (_req, res) => res.redirect(301, '/converters'));
app.get(/^\/(about|privacy|terms|contact)$/, (req, res, next) => {
  const r = pages.resolveInfo(req.params[0], baseOf(req));
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

app.use((err, _req, res, _next) => {
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
