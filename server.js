// Squish — server-side image compressor.
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
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: MAX_FILES_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this connection. Please wait a few minutes and try again.' },
}));

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

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
app.post('/api/compress', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    const originalName = req.file.originalname || 'image';
    const inputExt = extOf(originalName);
    const originalSize = req.file.size;

    const quality = Math.min(100, Math.max(1, parseInt(req.body.quality, 10) || 75));
    const maxDim = Math.max(0, parseInt(req.body.maxDim, 10) || 0);
    let format = (req.body.format || 'auto').toLowerCase();

    if (format === 'auto') format = pickAutoFormat(inputExt);
    if (!ACCEPTED_OUTPUT_KEYS.has(format)) {
      return res.status(400).json({ error: `Unsupported output format requested: ${format}` });
    }
    const outFormat = registry.getFormatByApiFormat(format);

    // Ask the registry whether this input -> output is something we can do.
    // Same format in and out means "compress".
    const inFormat = registry.getFormatByExtension(inputExt);
    const converter = !inFormat ? null
      : inFormat.id === outFormat.id ? registry.getCompressor(inFormat, ACCEPT)
        : registry.getConverter(inFormat, outFormat, ACCEPT);
    if (!converter) {
      const err = new Error(`".${inputExt}" isn't a format this server can read.`);
      err.statusCode = 415;
      throw err;
    }

    const outBuffer = await getHandler(converter.handler)(
      { buffer: req.file.buffer, inputExt, format, quality, maxDim },
      converter
    );

    res.set({
      'Content-Type': outFormat.mimeType,
      'Content-Disposition': `attachment; filename="compressed.${outFormat.extension}"`,
      'X-Original-Size': String(originalSize),
      'X-Compressed-Size': String(outBuffer.length),
      'X-Output-Ext': outFormat.extension,
    });
    res.send(outBuffer);
  } catch (err) {
    const statusCode = err.statusCode || (/unsupported image format|Input buffer contains unsupported/i.test(err.message) ? 415 : 500);
    if (statusCode === 415) {
      res.status(415).json({
        error: err.message.includes('read') ? err.message :
          `This server's image library couldn't decode that file. HEIC/HEIF support in particular depends on how libvips was built on this machine — see README "Format support" table.`,
      });
    } else {
      console.error('Compression error:', err);
      res.status(500).json({ error: 'Something went wrong compressing that file.' });
    }
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));


// ------------------------------------------------------------ SEO pages --
// Every supported conversion gets its own crawlable landing page.
const sendHtml = (res, html) => res.set('Cache-Control', 'public, max-age=3600').type('html').send(html);

app.get('/', (req, res) => sendHtml(res, pages.homePage(baseOf(req))));
app.get('/converters', (req, res) => sendHtml(res, pages.hubPage(baseOf(req))));

app.get(/^\/([a-z0-9]+)-to-([a-z0-9]+)$/, (req, res, next) => {
  const r = pages.resolvePair(req.params[0], req.params[1], baseOf(req));
  if (!r) return next();
  if (r.redirect) return res.redirect(301, r.redirect);
  sendHtml(res, r.html);
});

app.get(/^\/compress-([a-z0-9]+)$/, (req, res, next) => {
  const r = pages.resolveCompress(req.params[0], baseOf(req));
  if (!r) return next();
  if (r.redirect) return res.redirect(301, r.redirect);
  sendHtml(res, r.html);
});

app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(pages.sitemap(baseOf(req))));
app.get('/robots.txt', (req, res) => res.type('text/plain').send(pages.robots(baseOf(req))));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.status(404).type('html').send(pages.notFoundPage());
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File is larger than the ${MAX_FILE_MB}MB limit set on this server.` });
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`Squish server listening on port ${PORT} (max ${MAX_FILE_MB}MB/file, ${MAX_FILES_PER_WINDOW} req/15min per IP)`);
});
