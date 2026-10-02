'use strict';
// Site-wide SEO assets that are generated rather than written by hand:
//   - head tags shared by every page (Open Graph, Twitter, icons, verification, hreflang)
//   - Open Graph share images (1200x630 PNG), drawn from SVG with Sharp and cached in memory
//   - favicon.ico / apple-touch-icon / PWA icons from the brand SVG
//   - site.webmanifest
//   - the "last modified" date used by the sitemap
//
// Nothing here is a ranking trick. These make pages shareable, correctly attributed and
// verifiable in Search Console / Bing Webmaster Tools.

const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE_NAME || 'FlipFree';
const BRAND = '#E5322D';

// Search-engine ownership verification (paste only the content="..." value into the env var).
const VERIFY = [
  ['google-site-verification', process.env.GOOGLE_SITE_VERIFICATION],
  ['msvalidate.01', process.env.BING_SITE_VERIFICATION],
  ['yandex-verification', process.env.YANDEX_VERIFICATION],
  ['p:domain_verify', process.env.PINTEREST_VERIFICATION],
].filter(([, v]) => v);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Last modified date for the sitemap. SITE_UPDATED (YYYY-MM-DD) wins; otherwise the newest
// modification time of the files that make up page content. Google ignores lastmod values
// that are obviously fake, so this only changes when content files change.
function siteUpdated() {
  if (/^\d{4}-\d{2}-\d{2}/.test(process.env.SITE_UPDATED || '')) return process.env.SITE_UPDATED.slice(0, 10);
  const files = ['pages.js', 'registry/formats.js', 'registry/converters.js', 'views/page.html', 'public/style.css'];
  const newest = Math.max(...files.map((f) => { try { return fs.statSync(path.join(__dirname, f)).mtimeMs; } catch { return 0; } }));
  return new Date(newest || Date.now()).toISOString().slice(0, 10);
}
const LASTMOD = siteUpdated();

// Short content hash for cache-busting static files (/style.css?v=abc123), so they can be
// cached for a year without visitors ever seeing a stale stylesheet after a deploy.
const crypto = require('crypto');
function assetVersion(file) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(path.join(__dirname, 'public', file))).digest('hex').slice(0, 10); } catch { return '1'; }
}
const ASSET_V = { css: assetVersion('style.css'), js: assetVersion('script.js') };

/**
 * Head tags shared by every page.
 * @param {{url: string, title: string, desc: string, image: string, noindex?: boolean, type?: string}} p
 */
function headTags({ url, title, desc, image, noindex, type = 'website' }) {
  const tags = [
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${esc(SITE)}">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${title}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
    `<meta name="twitter:image" content="${image}">`,
    process.env.TWITTER_SITE ? `<meta name="twitter:site" content="${esc(process.env.TWITTER_SITE)}">` : '',
    '<meta name="theme-color" content="#2B2D33">',
    `<meta name="application-name" content="${esc(SITE)}">`,
    `<meta name="apple-mobile-web-app-title" content="${esc(SITE)}">`,
    '<meta name="format-detection" content="telephone=no">',
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    ...(noindex ? [] : [`<link rel="alternate" hreflang="en" href="${url}">`, `<link rel="alternate" hreflang="x-default" href="${url}">`]),
    ...VERIFY.map(([name, v]) => `<meta name="${name}" content="${esc(v)}">`),
  ];
  return tags.filter(Boolean).join('\n');
}

// --------------------------------------------------------------- brand icon --
// Logo mark (same as the header logo in pages.js). With pad the red fills the whole square,
// which maskable app icons need; without it the tile has rounded corners.
const RED = BRAND;
const MARK = `<path d="M12.6 10h4.6l2.8 2.8v8.6a.7.7 0 0 1-.7.7h-6.7a.7.7 0 0 1-.7-.7V10.7a.7.7 0 0 1 .7-.7z" fill="#fff"/><path d="M17.2 10v2.8H20" fill="none" stroke="${RED}" stroke-width="1.1" stroke-linejoin="round"/><g fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 14.2A9.6 9.6 0 0 1 12.4 6.6M9.4 5.6l3.4.9-.9 3.4M25.5 17.8A9.6 9.6 0 0 1 19.6 25.4M22.6 26.4l-3.4-.9.9-3.4"/></g>`;
const ICON_SVG = (size, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${32 + pad * 2} ${32 + pad * 2}">`
  + (pad ? `<rect x="${-pad}" y="${-pad}" width="${32 + pad * 2}" height="${32 + pad * 2}" fill="${BRAND}"/>`
    : `<rect x="1" y="1" width="30" height="30" rx="8" fill="${BRAND}"/>`)
  + `${MARK}</svg>`;

const FAVICON_SVG = ICON_SVG(32);

// ------------------------------------------------------------ share images --
const wrap = (text, max) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  });
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
};

/** 1200x630 share image: brand bar, big title, optional "PNG -> WEBP" badges, subtitle. */
function ogSvg({ title, subtitle, from, to }) {
  const lines = wrap(title, 22);
  const titleY = from ? 370 : 270;
  const badge = (x, label, fill, color) => `<rect x="${x}" y="150" width="260" height="110" rx="16" fill="${fill}"/>`
    + `<text x="${x + 130}" y="225" font-size="56" font-weight="800" text-anchor="middle" fill="${color}" font-family="DejaVu Sans, Arial, sans-serif">${esc(label)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F1F2F5"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect width="1200" height="12" fill="${BRAND}"/>
  ${from ? badge(80, from, '#F1F2F4', '#23262D') + `<path d="M380 205h70m-24-26 26 26-26 26" stroke="#9AA0AA" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` + badge(480, to, BRAND, '#FFFFFF') : ''}
  ${lines.map((l, i) => `<text x="80" y="${titleY + i * 78}" font-size="68" font-weight="800" fill="#23262D" font-family="DejaVu Sans, Arial, sans-serif">${esc(l)}</text>`).join('')}
  <text x="80" y="${titleY + lines.length * 78 + 10}" font-size="32" fill="#6B7079" font-family="DejaVu Sans, Arial, sans-serif">${esc(subtitle || '')}</text>
  <g transform="translate(80 518) scale(2.2)"><rect x="1" y="1" width="30" height="30" rx="8" fill="${BRAND}"/>${MARK}</g>
  <text x="166" y="572" font-size="40" font-weight="800" fill="#23262D" font-family="DejaVu Sans, Arial, sans-serif">${/.Free$/.test(SITE) ? `${esc(SITE.slice(0, -4))}<tspan fill="${BRAND}">Free</tspan>` : esc(SITE)}</text>
  <text x="1120" y="572" font-size="28" text-anchor="end" fill="#6B7079" font-family="DejaVu Sans, Arial, sans-serif">100% free &#183; No sign-up &#183; No watermark</text>
</svg>`;
}

// Small bounded cache: share images are requested by crawlers and social sites, rarely by people.
const pngCache = new Map();
const CACHE_MAX = 300;
async function cachedPng(key, makeSvg, resize) {
  if (pngCache.has(key)) return pngCache.get(key);
  const sharp = require('sharp');
  let img = sharp(Buffer.from(makeSvg()));
  if (resize) img = img.resize(resize, resize);
  const buf = await img.png({ compressionLevel: 9 }).toBuffer();
  if (pngCache.size >= CACHE_MAX) pngCache.delete(pngCache.keys().next().value);
  pngCache.set(key, buf);
  return buf;
}

const ogPng = (key, spec) => cachedPng(`og:${key}`, () => ogSvg(spec));
const iconPng = (size, pad) => cachedPng(`icon:${size}:${pad}`, () => ICON_SVG(size, pad));

let icoBuf = null;
async function faviconIco() {
  if (!icoBuf) {
    const pngToIco = require('png-to-ico');
    icoBuf = await pngToIco(await Promise.all([16, 32, 48].map((s) => iconPng(s, 0))));
  }
  return icoBuf;
}

const manifest = () => JSON.stringify({
  name: `${SITE} File Converter`,
  short_name: SITE,
  description: 'Free online file converter and image compressor.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#FFFFFF',
  theme_color: '#2B2D33',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
});

module.exports = { headTags, ogPng, iconPng, faviconIco, manifest, FAVICON_SVG, LASTMOD, ASSET_V, ogSvg };
