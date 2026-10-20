'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createStore } = require('./lib/store');
const { createApi, HttpError } = require('./lib/api');

const PUBLIC = path.join(__dirname, 'public');
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
const PAGES = { '/': 'index.html', '/admin': 'admin.html', '/admin/': 'admin.html', '/kiosk': 'kiosk.html' };

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
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

function readBody(req, limit = 64 * 1024) {
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
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// The app icon and manifest are drawn from the business settings, so every
// shop that installs the app gets its own name, colour and initial.
function iconSvg(business, { maskable = false } = {}) {
  const letter = (business.name || 'S').trim().charAt(0).toUpperCase();
  const radius = maskable ? 0 : 112;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${business.accent}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="512" height="512" rx="${radius}" fill="url(#g)"/><text x="256" y="256" dy=".35em" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${maskable ? 220 : 280}" fill="#fff">${letter.replace(/[<&>]/g, '')}</text></svg>`;
}

function manifest(business, admin) {
  return JSON.stringify({
    name: admin ? `${business.name} · Manager` : business.name,
    short_name: admin ? 'Dashboard' : business.name.slice(0, 12),
    description: business.tagline,
    start_url: admin ? '/admin' : '/',
    scope: admin ? '/admin' : '/',
    display: 'standalone',
    background_color: '#0c0c11',
    theme_color: business.accent,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  });
}

function createServer(options = {}) {
  const store = createStore({
    file: options.dataFile,
    seed: options.seed || 'demo',
    ownerPin: options.ownerPin || '1234',
    staffPin: options.staffPin || '0000',
    now: options.now,
  });
  const api = createApi(store, { now: options.now });
  const allowedOrigins = new Set([
    'capacitor://localhost', 'https://localhost', 'http://localhost', 'ionic://localhost',
    ...String(options.corsOrigins || '').split(',').map((s) => s.trim()).filter(Boolean),
  ]);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;
    // The Android and iOS apps load their screens from the phone and call this
    // server from these origins, so the API answers them across origins.
    const origin = req.headers.origin;
    if (origin && pathname.startsWith('/api/') && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        });
        return res.end();
      }
    }
    try {
      // Fingerprint attendance machines (ZKTeco push protocol) talk plain text.
      if (pathname.startsWith('/iclock/')) {
        const text = req.method === 'POST' ? await readText(req) : '';
        const [status, reply] = api.handleDevice(req.method, url, text);
        res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        return res.end(reply);
      }
      if (pathname.startsWith('/api/')) {
        const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
        const result = await api.handle(req, res, url, body);
        return send(res, 200, JSON.stringify(result), undefined, { 'Cache-Control': 'no-store' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');

      const business = store.db.business;
      if (pathname === '/manifest.webmanifest' || pathname === '/admin.webmanifest') {
        return send(res, 200, manifest(business, pathname.startsWith('/admin')), TYPES['.webmanifest'], { 'Cache-Control': 'no-cache' });
      }
      if (pathname === '/icon.svg' || pathname === '/icon-maskable.svg') {
        return send(res, 200, iconSvg(business, { maskable: pathname.includes('maskable') }), TYPES['.svg'], { 'Cache-Control': 'no-cache' });
      }

      const file = path.normalize(path.join(PUBLIC, PAGES[pathname] || pathname));
      if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, 'Not found', 'text/plain');
      fs.readFile(file, (err, data) => {
        if (err) return send(res, 404, 'Not found', 'text/plain');
        send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
      });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      send(res, status, JSON.stringify({ error: status === 500 ? 'Something went wrong' : err.message }));
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3100;
  createServer({
    dataFile: process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json'),
    seed: process.env.SEED,
    ownerPin: process.env.OWNER_PIN,
    staffPin: process.env.STAFF_PIN,
    corsOrigins: process.env.CORS_ORIGINS,
  }).listen(port, () => console.log(`Gym app on http://localhost:${port}  (dashboard: /admin, front-desk kiosk: /kiosk)`));
}

module.exports = { createServer };
