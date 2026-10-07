'use strict';
// Free online PDF tools: web server.
//   - server-rendered pages (home, tools, one page per tool, legal pages, sitemap)
//   - POST /api/tools/:slug for the tools that need server-side engines
// Tools that can run in the browser never send files here.

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./lib/config');
const { TOOLS, CATEGORIES, getTool, getCategory } = require('./lib/tools');
const { getProcessor, toolAvailable } = require('./lib/engines');
const { detect } = require('./lib/engines/detect');
const { withSlot, removeDir, sweepTemp, UserError } = require('./lib/engines/runner');
const { uploader, validateFile, validateOptions, baseName } = require('./lib/upload');
const pages = require('./lib/render/pages');

const app = express();
app.disable('x-powered-by');
if (config.TRUST_PROXY) app.set('trust proxy', Number(config.TRUST_PROXY) || config.TRUST_PROXY);
const baseOf = (req) => config.BASE_URL || `${req.protocol}://${req.get('host')}`;

// ----------------------------------------------------------------- security --
// Scripts only from this site (pdf.js, pdf-lib and JSZip are served from node_modules, not a
// CDN). pdf.js needs blob: workers and WebAssembly for some image formats. With AdSense on,
// Google's ad hosts (which change over time) are allowed for scripts, frames and images.
const ADS = !!config.ADSENSE_CLIENT;
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'wasm-unsafe-eval'", ...(ADS ? ['https:', "'unsafe-inline'"] : [])],
      'worker-src': ["'self'", 'blob:'],
      'img-src': ["'self'", 'data:', 'blob:', ...(ADS ? ['https:'] : [])],
      'connect-src': ["'self'", 'blob:', 'data:', ...(ADS ? ['https:'] : [])],
      'frame-src': ADS ? ["'self'", 'https:'] : ["'none'"],
      'font-src': ["'self'", 'data:'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(compression());

// One URL per page: lower case, no trailing slash, optional canonical host.
const CANON = (() => { try { return config.BASE_URL ? new URL(config.BASE_URL) : null; } catch { return null; } })();
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/vendor/')) return next();
  const q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  let p = req.path;
  if (!/\.[a-z0-9]+$/i.test(p)) p = p.toLowerCase();
  p = p.replace(/\/{2,}/g, '/').replace(/\/index\.html?$/i, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
  const wrongHost = config.FORCE_CANONICAL_HOST && CANON
    && (req.hostname !== CANON.hostname || req.protocol !== CANON.protocol.replace(':', ''));
  if (p !== req.path || wrongHost) return res.redirect(301, (wrongHost ? CANON.origin : '') + (p || '/') + q);
  next();
});

// ------------------------------------------------------------ static files --
const year = { maxAge: '365d', immutable: true };
// Only files requested as /file.js?v=<hash> may be cached for good. Modules imported by
// other modules (processors, lib/) have no hash in their URL, so the browser must check
// for a newer copy each time (a cheap 304 when nothing changed).
app.use((req, res, next) => { res.locals.versioned = typeof req.query.v === 'string'; next(); });
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  setHeaders: (res, file) => {
    if (/\.(css|js|mjs)$/.test(file)) res.set('Cache-Control', res.locals.versioned ? 'public, max-age=31536000, immutable' : 'no-cache');
    else res.set('Cache-Control', 'public, max-age=86400');
  },
}));
// Processing libraries, loaded by tool pages only when a file is chosen.
const vendor = (route, file) => app.get(route, (_req, res) => res.sendFile(require.resolve(file), {
  maxAge: '30d', headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
}));
vendor('/vendor/pdf-lib.mjs', 'pdf-lib/dist/pdf-lib.esm.min.js');
vendor('/vendor/fontkit.js', '@pdf-lib/fontkit/dist/fontkit.umd.min.js');
vendor('/vendor/jszip.js', 'jszip/dist/jszip.min.js');
vendor('/vendor/pdfjs/pdf.mjs', 'pdfjs-dist/legacy/build/pdf.min.mjs');
vendor('/vendor/pdfjs/pdf.worker.mjs', 'pdfjs-dist/legacy/build/pdf.worker.min.mjs');
const PDFJS_DIR = path.dirname(require.resolve('pdfjs-dist/package.json'));
for (const sub of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  app.use(`/vendor/pdfjs/${sub}`, express.static(path.join(PDFJS_DIR, sub), { index: false, maxAge: '30d' }));
}

// -------------------------------------------------------------------- pages --
const cache = new Map();
const cached = (key, req, render) => {
  const k = `${baseOf(req)}|${key}`;
  if (!cache.has(k)) cache.set(k, render(baseOf(req)));
  return cache.get(k);
};
const html = (res, body, status = 200) => res.status(status).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }).send(body);

app.get('/', (req, res) => html(res, cached('home', req, pages.home)));
app.get('/tools', (req, res) => html(res, cached('tools', req, pages.allTools)));
app.get('/tools/:cat', (req, res, next) => {
  const c = getCategory(req.params.cat);
  if (!c) return next();
  html(res, cached(`cat:${c.id}`, req, (b) => pages.category(b, c)));
});
for (const name of ['about', 'privacy', 'terms', 'cookies', 'contact']) {
  app.get(`/${name}`, (req, res) => html(res, cached(name, req, pages[name])));
}
app.get('/:slug', (req, res, next) => {
  const t = getTool(req.params.slug);
  if (!t) return next();
  html(res, cached(`tool:${t.slug}`, req, (b) => pages.tool(b, t)));
});

app.get('/favicon.ico', (_req, res) => res.type('image/png').set('Cache-Control', 'public, max-age=86400').sendFile(path.join(__dirname, 'public', 'favicon-32.png')));
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${baseOf(req)}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const base = baseOf(req);
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['/', '/tools', ...CATEGORIES.map((c) => `/tools/${c.id}`),
    ...TOOLS.filter(toolAvailable).map((t) => `/${t.slug}`), '/about', '/contact', '/privacy', '/terms', '/cookies'];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${base}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
});
if (config.ADSENSE_CLIENT) {
  app.get('/ads.txt', (_req, res) => res.type('text/plain').send(`google.com, ${config.ADSENSE_CLIENT.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`));
}

// ---------------------------------------------------------------------- API --
app.use('/api/', (_req, res, next) => { res.set({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' }); next(); });
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'You’ve made a lot of requests in a short time. Please wait a few minutes and try again.' },
}));

app.get('/api/status', (_req, res) => {
  res.json({ tools: Object.fromEntries(TOOLS.map((t) => [t.slug, { runs: t.runs, available: toolAvailable(t) }])) });
});

const disposition = (name) => `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;
const MIME = {
  pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain; charset=utf-8',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg', png: 'image/png', tif: 'image/tiff', jp2: 'image/jp2', ppm: 'image/x-portable-pixmap', pbm: 'image/x-portable-bitmap',
};
const SUFFIX = {
  compress: 'compressed', reduce: 'reduced', optimize: 'optimized', protect: 'protected', unlock: 'unlocked',
  removeRestrictions: 'unrestricted', repair: 'repaired', ocrPdf: 'searchable',
};

app.post('/api/tools/:slug', (req, res) => {
  const tool = getTool(req.params.slug);
  // Clean up the request's temp folder whatever happens, once the response is done.
  const cleanup = () => { if (req.tempDir) { removeDir(req.tempDir); req.tempDir = null; } };
  res.on('close', cleanup);
  const fail = (status, error) => { if (!res.headersSent) res.status(status).json({ error }); };

  if (!tool || tool.runs !== 'server') return fail(404, 'This tool does not exist.');
  if (!toolAvailable(tool)) return fail(503, 'This tool is not available on this server right now.');

  uploader.single('file')(req, res, async (upErr) => {
    try {
      if (upErr) {
        if (upErr.code === 'LIMIT_FILE_SIZE') throw new UserError(`This file is larger than ${config.MAX_UPLOAD_MB} MB, the most this tool accepts. Try compressing or splitting it first.`, 413);
        if (upErr.code === 'LIMIT_FILE_COUNT' || upErr.code === 'LIMIT_UNEXPECTED_FILE') throw new UserError('Please send one file at a time.', 400);
        throw new UserError('The upload did not complete. Please check your connection and try again.', 400);
      }
      if (!req.file) throw new UserError('No file was received. Please choose a file and try again.', 400);
      await validateFile(tool, req.file);
      const options = validateOptions(tool, req.body && req.body.options);
      const processor = getProcessor(tool.engine);
      const result = await withSlot(() => processor.run({ input: req.file.path, dir: req.tempDir, options, name: req.file.originalname }));

      const suffix = result.suffix || SUFFIX[tool.engine];
      const name = `${baseName(req.file.originalname)}${suffix ? `-${suffix}` : ''}.${result.ext}`;
      const size = fs.statSync(result.file).size;
      res.set({
        'Content-Type': MIME[result.ext] || 'application/octet-stream',
        'Content-Length': String(size),
        'Content-Disposition': disposition(name),
        'X-Result-Info': JSON.stringify(result.info || {}),
        'Access-Control-Expose-Headers': 'Content-Disposition, X-Result-Info',
      });
      const stream = fs.createReadStream(result.file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (err) {
      if (err.userMessage) return fail(err.statusCode || 422, err.userMessage);
      // Details go to the server log only; visitors get a plain explanation.
      console.error(`[${tool.slug}]`, err && err.message ? err.message.slice(0, 2000) : err);
      fail(500, 'Something went wrong while processing your file. Please try again or upload a different file.');
    }
  });
});

app.use('/api/', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// ----------------------------------------------------------------- fallback --
app.use((req, res) => html(res, cached('404', req, pages.notFound), 404));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  res.status(500).type('text/plain').send('Something went wrong. Please try again.');
});

// ------------------------------------------------------------------- start --
if (require.main === module) {
  const caps = detect();
  const missing = TOOLS.filter((t) => !toolAvailable(t)).map((t) => t.slug);
  console.log(`Engines: ${Object.entries(caps).map(([k, v]) => `${k}${v ? '' : ' (missing)'}`).join(', ')}`);
  console.log(`${TOOLS.length - missing.length}/${TOOLS.length} tools available${missing.length ? `; unavailable: ${missing.join(', ')}` : ''}.`);
  sweepTemp().catch(() => {});
  setInterval(() => sweepTemp().catch(() => {}), 10 * 60 * 1000).unref();
  app.listen(config.PORT, () => console.log(`Listening on http://localhost:${config.PORT}`));
}

module.exports = app;
