'use strict';

// HTTP plumbing shared by the single-gym server (server.js) and the
// multi-gym platform (lib/platform): static files, the JSON API, member
// photos and attendance machines for one gym.

const fs = require('node:fs');
const path = require('node:path');
const { HttpError } = require('./validate');

const PUBLIC = path.join(__dirname, '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};
const PAGES = { '/': 'index.html', '/admin': 'admin.html', '/admin/': 'admin.html', '/kiosk': 'kiosk.html', '/display': 'display.html' };

const csp = (extra = {}) => [
  "default-src 'self'",
  `script-src 'self'${extra.script ? ` ${extra.script}` : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob:${extra.img ? ` ${extra.img}` : ''}`,
  `connect-src 'self'${extra.connect ? ` ${extra.connect}` : ''}`,
  `frame-src ${extra.frame || "'none'"}`,
  `media-src 'self' blob:${extra.media ? ` ${extra.media}` : ''}`,
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// Gym pages may play exercise videos from YouTube.
const VIDEO_FRAMES = 'https://www.youtube-nocookie.com https://www.youtube.com';
const SECURITY_HEADERS = {
  'Content-Security-Policy': csp({ frame: VIDEO_FRAMES }),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

function readText(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Request is too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readBody(req, limit = 64 * 1024) {
  const text = await readText(req, limit);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, `The video is too big. Keep it under ${Math.round(limit / 1048576)} MB (a short clip of 15-60 seconds).`));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Videos are streamed in pieces (Range requests) so phones can start and seek.
function sendVideo(req, res, file) {
  const size = file.buffer ? file.buffer.length : file.size;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  const head = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400', ...SECURITY_HEADERS };
  let start = 0;
  let end = size - 1;
  if (range) {
    start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
  } else res.writeHead(200, { ...head, 'Content-Length': size });
  if (req.method === 'HEAD') return res.end();
  if (file.buffer) return res.end(file.buffer.subarray(start, end + 1));
  fs.createReadStream(file.path, { start, end }).pipe(res);
}

function sendError(res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error(err);
  send(res, status, JSON.stringify({ error: status === 500 ? 'Something went wrong' : err.message, ...(err.extra || {}) }));
}

// The app icon and manifest are drawn from the business settings, so every
// gym that installs the app gets its own name, colour and initial.
function iconSvg(business, { maskable = false } = {}) {
  const letter = (business.name || 'S').trim().charAt(0).toUpperCase();
  const radius = maskable ? 0 : 112;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${business.accent}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="512" height="512" rx="${radius}" fill="url(#g)"/><text x="256" y="256" dy=".35em" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${maskable ? 220 : 280}" fill="#fff">${letter.replace(/[<&>]/g, '')}</text></svg>`;
}

function manifest(business, admin, prefix = '') {
  return JSON.stringify({
    name: admin ? `${business.name} · Manager` : business.name,
    short_name: admin ? 'Dashboard' : business.name.slice(0, 12),
    description: business.tagline,
    start_url: `${prefix}${admin ? '/admin' : '/'}`,
    scope: `${prefix}${admin ? '/admin' : '/'}`,
    display: 'standalone',
    background_color: '#0c0c11',
    theme_color: business.accent,
    icons: [
      { src: `${prefix}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: `${prefix}/icon-maskable.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  });
}

/**
 * Serves one gym. `prefix` is where the gym lives on the platform
 * ("/g/fitzone"); pages, links and API calls are rewritten to stay inside it.
 * `gate(pathname)` may throw to stop a request (an unpaid gym on the platform).
 */
function gymHandler({ store, api, prefix = '', machines = true, machinePort = null, gate = null }) {
  return async (req, res, url, pathname) => {
    try {
      if (machines && pathname.startsWith('/iclock/')) {
        // Fingerprint attendance machines (ZKTeco push protocol) talk plain text.
        const text = req.method === 'POST' ? await readText(req) : '';
        const [status, reply] = api.handleDevice(req.method, url, text);
        res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        return res.end(reply);
      }
      if (machines && pathname.startsWith('/hik/') && req.method === 'POST') {
        // Hikvision face terminals post events (often with a photo) to HTTP Listening.
        const text = await readText(req, 4 * 1024 * 1024);
        const [status, reply] = api.handleHikvision(pathname.slice(5), text);
        res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        return res.end(reply);
      }
      if (gate) gate(pathname, req);
      // Member profile photos.
      if (pathname.startsWith('/photos/') && (req.method === 'GET' || req.method === 'HEAD')) {
        const data = store.readPhoto(pathname.slice(8));
        if (!data) return send(res, 404, 'Not found', 'text/plain');
        return send(res, 200, data, 'image/jpeg', { 'Cache-Control': 'private, max-age=86400' });
      }
      if (pathname.startsWith('/videos/') && (req.method === 'GET' || req.method === 'HEAD')) {
        const file = store.videoFile(pathname.slice(8));
        if (!file) return send(res, 404, 'Not found', 'text/plain');
        return sendVideo(req, res, file);
      }
      if (pathname.startsWith('/api/')) {
        // An uploaded exercise video comes as the raw file.
        const rawVideo = req.method === 'PUT' && /^\/api\/admin\/exercise-videos\/[\w-]+\/file$/.test(pathname);
        const body = rawVideo ? { file: await readRaw(req, 40 * 1024 * 1024), type: req.headers['content-type'] || '' }
          : ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req, pathname.endsWith('/photo') ? 1024 * 1024 : pathname.endsWith('/members/import') ? 8 * 1024 * 1024 : undefined) : {};
        const result = await api.handle(req, res, Object.assign(new URL(url), { pathname }), body);
        return send(res, 200, JSON.stringify(result), undefined, { 'Cache-Control': 'no-store' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');

      const business = store.db.business;
      if (pathname === '/manifest.webmanifest' || pathname === '/admin.webmanifest') {
        return send(res, 200, manifest(business, pathname.startsWith('/admin'), prefix), TYPES['.webmanifest'], { 'Cache-Control': 'no-cache' });
      }
      if (pathname === '/icon.svg' || pathname === '/icon-maskable.svg') {
        return send(res, 200, iconSvg(business, { maskable: pathname.includes('maskable') }), TYPES['.svg'], { 'Cache-Control': 'no-cache' });
      }
      if (prefix && pathname === '/config.js') {
        return send(res, 200, `window.APP_CONFIG = ${JSON.stringify({ apiBase: prefix, base: prefix, ...(machinePort ? { machinePort: Number(machinePort) } : {}) })};\n`, TYPES['.js'], { 'Cache-Control': 'no-cache' });
      }

      const file = path.normalize(path.join(PUBLIC, PAGES[pathname] || pathname));
      if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, 'Not found', 'text/plain');
      fs.readFile(file, (err, data) => {
        if (err) return send(res, 404, 'Not found', 'text/plain');
        const ext = path.extname(file);
        // Links in the pages point at "/x"; inside a gym they become "/g/<gym>/x".
        const out = prefix && ext === '.html' ? data.toString('utf8').replace(/(src|href)="\/(?!\/)/g, `$1="${prefix}/`) : data;
        send(res, 200, out, TYPES[ext] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
      });
    } catch (err) {
      sendError(res, err);
    }
  };
}

// The Android and iOS apps load their screens from the phone and call the
// server from these origins, so the API answers them across origins.
function corsFor(extraOrigins) {
  const allowed = new Set([
    'capacitor://localhost', 'https://localhost', 'http://localhost', 'ionic://localhost',
    ...String(extraOrigins || '').split(',').map((s) => s.trim()).filter(Boolean),
  ]);
  return (req, res, pathname) => {
    const origin = req.headers.origin;
    if (!origin || !pathname.includes('/api/') || !allowed.has(origin)) return false;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    if (req.method !== 'OPTIONS') return false;
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return true;
  };
}

module.exports = { PUBLIC, TYPES, SECURITY_HEADERS, csp, send, sendError, readText, readBody, iconSvg, manifest, gymHandler, corsFor };
