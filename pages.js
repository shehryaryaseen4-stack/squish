'use strict';
// Server-rendered pages, laid out like CloudConvert:
//   /                     home: "File Converter" hero, convert [X] to [Y] widget, upload tool,
//                         features, popular conversions, every category
//   /converters           every format, grouped by category, plus the live tools
//   /<category>-converter category page (/image-converter, /video-converter, ...)
//   /<format>-converter   format page (/png-converter): every conversion to and from it
//   /<from>-to-<to>       one page per registered conversion
//   /compress-<format>    compressor pages
//   /about, /privacy, /terms, /contact   trust pages (also required by AdSense)
//   /sitemap.xml, /robots.txt
//
// SEO: every page gets a unique title/description, canonical URL, Open Graph + Twitter tags
// with a generated share image (/og/<page>.png), visible breadcrumbs that match the
// BreadcrumbList JSON-LD, and Organization/WebSite/WebApplication/FAQPage structured data.
// Only pages with real, working content are indexable (see allPaths()).
//
// Every conversion in the registry gets a page and appears in the menus, but only 'live'
// ones show the upload tool and are indexed. The rest render a clear "coming soon"
// notice with noindex, so nothing promises a conversion the server cannot perform.
// All lists come from registry/; nothing here hard-codes a format or a pair.

const fs = require('fs');
const path = require('path');
const registry = require('./registry');
const seo = require('./seo');
const brand = require('./brand');
const GUIDES = { ...require('./content/guides'), ...require('./content/guides-more') };
// Resume guides only exist alongside the Resume Builder (part of the PDF editor).
const ARTICLES = [...require('./content/articles'), ...(process.env.PDF_EDITOR === '1' ? require('./content/resume-articles') : [])];
const KEYWORDS = require('./content/keywords');
const USES = require('./content/uses');
const APPS = require('./content/apps');
const APP_BY_SLUG = new Map(APPS.map((t) => [t.slug, t]));
// Variants of a tool (resize to 50 KB, compress video for Discord ...) have pages but stay out of menus.
const MENU_APPS = APPS.filter((t) => t.menu !== false);
const APP_ICON = { passport: 'jpg', ocr: 'txt', invoice: 'pdf', resize: 'jpg', imgedit: 'png', favicon: 'ico', bgremove: 'png', vcompress: 'mp4', trim: 'mp3', words: 'txt', signature: 'png', cover: 'docx' };
// Converters under the names people search for: /pdf-to-word, /word-to-pdf ... (friendlyPage)
const FRIENDLY_ALL = require('./content/friendly-pages');
// Only the file types this server can really convert (LibreOffice, Calibre ... may be missing):
// a page whose conversions are all unavailable is left out entirely. Worked out on first use.
let friendlyCache = null;
function friendlies() {
  if (friendlyCache) return friendlyCache;
  friendlyCache = FRIENDLY_ALL.map((x) => {
    const outputs = x.outputs.filter((o) => x.inputs.some((i) => isLivePair(i, o)));
    const inputs = x.inputs.filter((i) => outputs.some((o) => isLivePair(i, o)));
    return { ...x, inputs, outputs };
  }).filter((x) => x.inputs.length && x.outputs.length);
  return friendlyCache;
}
const friendlyBySlug = (slug) => friendlies().find((x) => x.slug === slug) || null;

// PDF tools with their own pages (/split-pdf, /protect-pdf ...). Those done on the server are
// listed only when its programs (qpdf, Ghostscript) are installed.
const PDFT = require('./content/pdf-tools');
const PDF_TOOLS = PDFT.tools.filter((t) => t.browser || require('./engines/pdf-tools').available(t.op));
const PDF_TOOL_BY_SLUG = new Map(PDF_TOOLS.map((t) => [t.slug, t]));

const SITE = process.env.SITE_NAME || brand.NAME;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || '';
// The site's social profiles (Facebook, YouTube, X...), comma separated; they tell search engines
// which accounts belong to this brand (Organization.sameAs).
const SOCIAL_LINKS = (process.env.SOCIAL_LINKS || '').split(/[\s,]+/).filter((u) => /^https:\/\/[^\s"<>]+$/.test(u));

// Google AdSense. Off until ADSENSE_CLIENT (ca-pub-...) is set; then the AdSense script loads
// on pages that have the converter (never on "coming soon", legal or 404 pages, which AdSense
// counts as screens without publisher content). Ad units appear only for the slot IDs that
// are set; with none set, Auto ads (chosen in the AdSense dashboard) place the ads.
const ADS_CLIENT = /^ca-pub-\d{10,20}$/.test(process.env.ADSENSE_CLIENT || '') ? process.env.ADSENSE_CLIENT : '';
const AD_SLOTS = Object.fromEntries(['TOP', 'BOTTOM', 'LEFT', 'RIGHT'].map((k) => {
  const v = process.env[`ADSENSE_SLOT_${k}`] || '';
  return [k, /^\d{5,20}$/.test(v) ? v : ''];
}));
const adUnit = (slot, side) => {
  if (!ADS_CLIENT || !slot) return '';
  return side
    ? `<div class="side-ad ${side}"><span class="ad-label">Advertisement</span><ins class="adsbygoogle" style="display:block; width:160px; height:600px;" data-ad-client="${ADS_CLIENT}" data-ad-slot="${slot}" data-ad-format="vertical"></ins></div>`
    : `<div class="ad-slot"><span class="ad-label">Advertisement</span><ins class="adsbygoogle" style="display:block; width:100%;" data-ad-client="${ADS_CLIENT}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
};
const adFields = (on) => (on && ADS_CLIENT ? {
  ADS_HEAD: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>`,
  AD_TOP: adUnit(AD_SLOTS.TOP), AD_BOTTOM: adUnit(AD_SLOTS.BOTTOM),
  AD_LEFT: adUnit(AD_SLOTS.LEFT, 'left'), AD_RIGHT: adUnit(AD_SLOTS.RIGHT, 'right'),
} : { ADS_HEAD: '', AD_TOP: '', AD_BOTTOM: '', AD_LEFT: '', AD_RIGHT: '' });

/** ads.txt for AdSense (https://support.google.com/adsense/answer/12171612), or null when ads are off. */
function adsTxt() {
  return ADS_CLIENT ? `google.com, ${ADS_CLIENT.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` : null;
}
const MAX_MB = Number(process.env.MAX_FILE_MB || 40);

const PAGE_TPL = fs.readFileSync(path.join(__dirname, 'views', 'page.html'), 'utf8');
const HUB_TPL = fs.readFileSync(path.join(__dirname, 'views', 'hub.html'), 'utf8');
// The PDF editor (/edit-pdf) is switched on with PDF_EDITOR=1; until then it has no page, link or sitemap entry.
const PDF_EDITOR = process.env.PDF_EDITOR === '1';
const EDITOR_TPL = fs.readFileSync(path.join(__dirname, 'views', 'editor.html'), 'utf8');
const EDITOR_APP = fs.readFileSync(path.join(__dirname, 'views', 'editor-app.html'), 'utf8');

const ANY = { minStatus: 'planned' };

// ------------------------------------------------------- registry adapters --
// Page copy was written against a small per-format object; this builds it from the registry.
//   rank = typical relative file size for the same picture (higher = smaller); used only
//   to choose between "usually smaller" / "often larger" wording.
const formatCache = new Map();
function F(slug) {
  if (!formatCache.has(slug)) {
    const f = registry.getFormat(slug);
    formatCache.set(slug, f && {
      slug: f.id, label: f.label, name: f.name, select: f.apiFormat, rank: f.traits.sizeRank, alpha: f.traits.alpha,
      full: f.fullName, about: f.description, category: f.category, categories: f.categories, traits: f.traits,
    });
  }
  return formatCache.get(slug);
}

const CATS = registry.getCategories();
const catName = (id) => registry.getCategory(id).name;
const isLivePair = (f, t) => registry.getConversionStatus(f, t) === 'live';
const pairPath = (f, t) => registry.getConverterRoute(f, t);
const compressPath = (f) => registry.getCompressRoute(f);
const formatPath = (f) => `/${registry.getFormat(f).id}-converter`;
const categoryPath = (c) => `/${c}-converter`;

const outputsFor = (slug, opts) => registry.getCompatibleOutputFormats(slug, opts).map((f) => f.id);
const inputsFor = (slug, opts) => registry.getCompatibleInputFormats(slug, opts).map((f) => f.id);

const LIVE_INPUTS = registry.getInputFormats().map((f) => f.id);
// Image tool lists (quality/size options only make sense for images).
const isImageFmt = (id) => registry.getFormat(id).category === 'image' || id === 'svg';
const ALL_INPUTS = registry.getInputFormats(ANY).map((f) => f.id);
const COMPRESSIBLE = registry.getCompressibleFormats().map((f) => f.id);
const ALL_COMPRESSORS = registry.getConverters({ ...ANY, type: 'compress' });
const POPULAR = registry.getPopularConversions().map((c) => [c.from, c.to]);
const LIVE_COUNT = registry.getConverters().length;
const TOTAL_COUNT = registry.getConverters(ANY).length;
const FORMAT_COUNT = registry.getFormats().length;

const formatIsLive = (id) => { const f = registry.getFormat(id); return f.input === 'live' || f.output === 'live'; };
// A category counts as live when a live conversion starts from a format whose primary
// category it is (GIF is also listed under Video, but that does not make video conversion live).
const LIVE_CATS = new Set(registry.getConverters({ type: 'all' }).map((c) => registry.getFormat(c.from).category));
const categoryIsLive = (id) => LIVE_CATS.has(id);
const LIVE_CAT_NAMES = CATS.filter((c) => categoryIsLive(c.id)).map((c) => c.name.toLowerCase());
const listWords = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const LIVE_SUMMARY = `${LIVE_COUNT.toLocaleString('en-US')} conversions (${listWords(LIVE_CAT_NAMES)})`;

// ---------------------------------------------------------------- helpers --
const render = (tpl, map) => tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in map ? map[k] : m));
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mailLink = CONTACT_EMAIL ? `<a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>` : '';
const link = (href, text) => `<a href="${href}">${text}</a>`;
const chips = (items) => `<ul class="chips">${items.map(([h, t, live]) =>
  `<li>${link(h, t + (live === false ? ' <span class="soon-tag">soon</span>' : ''))}</li>`).join('')}</ul>`;
const pairLabel = (f, t) => `${F(f).label} to ${F(t).label}`;

// Target keywords (content/keywords.js) are lower case; write them the way the page shows them.
const UPPER = new Set(registry.getFormats().flatMap((f) => [f.id, ...(f.aliases || [])]).concat(['tif', 'jpeg']));
const SPECIAL = { iphone: 'iPhone', powerpoint: 'PowerPoint', quicktime: 'QuickTime' };
const SMALL = new Set(['to', 'from', 'for', 'and', 'of', 'in', 'as', 'a']);
const kwCase = (s, title = true) => s.split(' ').map((w, i) => SPECIAL[w] || (UPPER.has(w) ? w.toUpperCase()
  : (!title || (i && SMALL.has(w)) ? w : w[0].toUpperCase() + w.slice(1)))).join(' ');
// A variant that is another name for the same thing ("jpeg to png"), not "... converter" or "convert ...".
const kwAlt = (k) => k.secondary.find((x) => !/\b(convert|converter|online|free)\b/.test(x));
// The longest title that still fits in a search result (65 characters).
const fitTitle = (name, alt) => [alt && `${name} (${alt}) - Free Online`, alt && `${name} (${alt})`, `${name} - Free Online`]
  .filter(Boolean).map((t) => `${t} | ${SITE}`).find((t) => t.length <= 65) || `${name} | ${SITE}`;

// Logo (brand.js). The default name uses the outlined word mark; a custom SITE_NAME gets
// the icon plus the name as text, with a trailing "Free" in red.
const BRAND_SVG = `<svg class="brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${brand.TILE}${brand.MARK}</svg>`;
const brandName = (name) => (/.Free$/.test(name) ? `${esc(name.slice(0, -4))}<b class="brand-free">Free</b>` : esc(name));
const BRAND_LINK = SITE === brand.NAME
  ? `<a class="brand" href="/" aria-label="${brand.NAME} home"><svg class="brand-logo" viewBox="0 0 ${brand.W} ${brand.H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${brand.logoInner({ flip: 'currentColor' })}</svg></a>`
  : `<a class="brand" href="/">${BRAND_SVG}<span class="brand-name">${brandName(SITE)}</span></a>`;

// Small line icons per category (and a few UI icons). currentColor so they follow the theme.
const ICON_PATHS = {
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
  audio: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  cad: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>',
  document: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
  ebook: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  font: '<path d="M4 20 10 4h1l6 16M6.5 14h8"/><path d="M17 20h4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  pdf: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M8 17v-4h1.5a1.5 1.5 0 0 1 0 3H8M13 13v4h1a2 2 0 0 0 0-4z"/>',
  presentation: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4"/>',
  spreadsheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  vector: '<path d="m12 19 7-7 3 3-7 7z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18z"/><circle cx="11" cy="11" r="2"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4z"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  edit: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="m10 17 5.5-5.5 1.5 1.5L11.5 18.5H10z"/>',
  convert: '<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v5h-5M3 20v-5h5"/>',
};
for (const [k, v] of Object.entries(PDFT.icons)) ICON_PATHS[`t-${k}`] = v;
const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.file}</svg>`;

// File-type icon: a coloured page with the extension on it (colour = category), drawn in CSS.
//   size 'xs' (no text, for picker buttons), 'sm', 'md', 'lg'
const ficon = (id, size = 'sm') => {
  const f = registry.getFormat(id);
  return `<i class="ficon ficon-${size} fi-${f.category}" aria-hidden="true">${size === 'xs' ? '' : `<b>${f.label}</b>`}</i>`;
};

// Category file icons as one SVG sprite per page (see topbar()); each use is a tiny <use>.
// A page with a folded corner in the category colour and a white symbol that says what it is.
const PAGE = '<path d="M3 1h12l6 6v19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" fill="currentColor"/><path d="M15 1v5a1 1 0 0 0 1 1h5z" fill="#fff" opacity=".45"/>';
const GLYPHS = {
  image: '<circle cx="8.5" cy="12" r="1.8" fill="#fff"/><path d="M5 22l4.5-5 3 3 3.5-4.5L19 22z" fill="#fff"/>',
  video: '<path d="M9 12.2v8.6a.6.6 0 0 0 .9.5l7-4.3a.6.6 0 0 0 0-1l-7-4.3a.6.6 0 0 0-.9.5z" fill="#fff"/>',
  audio: '<path d="M10 20.5V12l7-1.6v8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8.6" cy="20.6" r="1.9" fill="#fff"/><circle cx="15.6" cy="18.8" r="1.9" fill="#fff"/>',
  document: '<path d="M6 12h12M6 15.5h12M6 19h12M6 22.5h8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  pdf: '<path d="M7.5 22.5c2.2-3.6 4-7.6 4.6-11 .3-1.6-1.5-1.8-1.5-.2 0 3.2 3.8 7.4 7.2 8.4 1.5.4 1.7-1.2.2-1.3-3.4-.3-7.6 1.4-10 4.1-.9 1 .2 1.6 1.5 0" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>',
  spreadsheet: '<rect x="5.5" y="11" width="13" height="12" rx="1" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M5.5 15h13M5.5 19h13M10 11v12" stroke="#fff" stroke-width="1.5"/>',
  presentation: '<rect x="5" y="11" width="14" height="9" rx="1" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M8.5 17.5l2.5-2.5 2 1.6 3-3.4M12 20v3M9.5 23h5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  archive: '<path d="M11 3h2v2h-2zM13 5h2v2h-2zM11 7h2v2h-2zM13 9h2v2h-2zM11 11h2v2h-2z" fill="#fff"/><rect x="10" y="14" width="6" height="7" rx="1" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M12 17.5h2" stroke="#fff" stroke-width="1.5"/>',
  ebook: '<path d="M12 13.2c-1.8-1.3-4-1.6-6.5-1.2v10c2.5-.4 4.7-.1 6.5 1.2 1.8-1.3 4-1.6 6.5-1.2V12c-2.5-.4-4.7-.1-6.5 1.2zM12 13.2v10" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>',
  font: '<path d="M7 23l5-12 5 12M8.8 19h6.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  vector: '<path d="M6 21c2-6 10-6 12-9" fill="none" stroke="#fff" stroke-width="1.5"/><rect x="4.5" y="19.5" width="3" height="3" fill="#fff"/><rect x="16.5" y="10.5" width="3" height="3" fill="#fff"/><circle cx="12" cy="16.5" r="1.4" fill="#fff"/>',
  cad: '<path d="M6 23V12l11 11z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.5 20.5v-3l3 3z" fill="#fff"/>',
  none: '',
};
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(GLYPHS).map(([k, g]) =>
  `<symbol id="fi-${k}" viewBox="0 0 24 28">${PAGE}${g}</symbol>`).join('')}</svg>`;
// Small category icon (pickers, menus): coloured by .fi-<category>.
const fsvg = (cat) => `<svg class="fsvg fi-${cat}" aria-hidden="true"><use href="#fi-${cat}"/></svg>`;
const fsvgFor = (id) => fsvg(registry.getFormat(id).category);

const SEARCH_ICON = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// --------------------------------------------------------- format pickers --
// Two-pane picker (search + categories on the left + format buttons on the right).
// Every button is a real link, so the pickers are crawlable and work without JavaScript.
//   items: [{ id, href, text?, live }]   grouped by every category the format belongs to.
function groupByCategory(items) {
  return CATS
    .map((c) => [c.id, c.name, items.filter((it) => F(it.id).categories.includes(c.id))])
    .filter(([, , list]) => list.length);
}

function fmtButton({ id, href, text, live, current, dataFmt }) {
  const f = F(id);
  const name = `${(text || f.label)} ${f.name} ${f.full}`.toLowerCase();
  return `<a class="fmt-btn${live ? ' is-live' : ''}" href="${href}" data-name="${esc(name)}"`
    + `${dataFmt ? ` data-fmt="${id}"` : ''}${current ? ' aria-current="true"' : ''}`
    + `${live ? '' : ' title="Coming soon"'}>${fsvgFor(id)}${text || f.label}</a>`;
}

function pickerPanel(groups, { current, extraClass = '', dataFmt = false, heads = false } = {}) {
  // Open on the current format's tab, else the first tab with a working conversion.
  let active = groups.findIndex(([, , items]) => items.some((it) => it.id === current));
  if (active < 0) active = groups.findIndex(([, , items]) => items.some((it) => it.live));
  if (active < 0) active = 0;
  const cats = groups.map(([, name], i) =>
    `<li><button type="button" class="fmt-cat${i === active ? ' is-active' : ''}" data-cat="${i}">${name}<span class="fmt-arrow" aria-hidden="true">&rsaquo;</span></button></li>`).join('');
  const grids = groups.map(([, name, items, head], i) =>
    `<div class="fmt-grid${i === active ? ' is-active' : ''}" data-cat="${i}" aria-label="${esc(name)}">`
    + `${heads && head ? head : ''}${items.map((it) => fmtButton({ ...it, current: it.id === current && !it.text, dataFmt })).join('')}</div>`).join('');
  return `<div class="fmt-panel ${extraClass}">`
    + `<label class="fmt-search">${SEARCH_ICON}<input type="search" class="fmt-q" placeholder="Search Format" autocomplete="off" aria-label="Search format"></label>`
    + `<div class="fmt-body"><ul class="fmt-cats">${cats}</ul><div class="fmt-grids">${grids}<p class="fmt-none">No format found</p></div></div></div>`;
}

function picker(label, groups, { current, align = '', role = '', dataFmt = false, placeholder = false } = {}) {
  const chipIcon = current && !placeholder ? fsvgFor(current) : fsvg('none');
  return `<details class="chip-menu" data-menu${role ? ` data-role="${role}"` : ''}>`
    + `<summary class="chip${placeholder ? ' chip-empty' : ''}" aria-label="Choose format${placeholder ? '' : ` (currently ${label})`}">${chipIcon}<span class="chip-label">${label}</span><span class="caret" aria-hidden="true"></span></summary>`
    + pickerPanel(groups, { current, extraClass: align, dataFmt }) + '</details>';
}

// ----------------------------------------------------------------- header --
// The Tools mega menu lists every format (about 900 elements). The home page carries it in full;
// other pages load it from /menu.html (cached) when the menu is first hovered or opened, which
// keeps their HTML small. The menu looks and works the same either way.
let megaCache = null, megaVersion = null;
function megaMenu() {
  if (megaCache) return megaCache;
  const groups = [];
  groups.push(['popular', 'Popular', [...friendlies().map((x) => ({ id: x.inputs[0], href: `/${x.slug}`, text: esc(x.h1.replace(/ Converter$/, '')), live: true })),
    ...POPULAR.map(([f, t]) => ({ id: f, href: pairPath(f, t), text: `${F(f).label} &rarr; ${F(t).label}`, live: true }))],
    `<a class="mega-head" href="/converters">All ${TOTAL_COUNT.toLocaleString('en-US')} conversions &rarr;</a>`]);
  groups.push(['pdf-tools', 'PDF tools', pdfGroups().flatMap(([, items]) => items).map(([href, label]) => ({ id: 'pdf', href, text: esc(label), live: true })),
    '<a class="mega-head" href="/pdf-tools">All PDF tools &rarr;</a>']);
  groups.push(['apps', 'More tools', MENU_APPS.map((t) => ({ id: APP_ICON[t.app] || 'jpg', href: `/${t.slug}`, text: esc(t.name), live: true })),
    '<span class="mega-head">Photo, video, text and document tools</span>']);
  CATS.forEach((c) => {
    const items = registry.getFormatsByCategory(c.id).map((f) => ({ id: f.id, href: formatPath(f.id), live: formatIsLive(f.id) }));
    groups.push([c.id, c.converterName, items, `<a class="mega-head" href="${categoryPath(c.id)}">${icon(c.icon)}${c.converterName} &rarr;</a>`]);
  });
  groups.push(['compress', 'Compress', ALL_COMPRESSORS.map((c) => ({ id: c.from, href: c.route, text: `Compress ${F(c.from).label}`, live: c.status === 'live' })),
    '<span class="mega-head">Make files smaller</span>']);

  // Tools mega menu reuses the picker; it groups by explicit lists instead of by category.
  megaCache = pickerPanel(groups.map(([, name, items, head]) => [null, name, items, head]), { extraClass: 'mega', heads: true });
  megaVersion = require('crypto').createHash('sha1').update(megaCache).digest('hex').slice(0, 10);
  return megaCache;
}
const topbarCache = {};
function topbar(full = false) {
  const key = full ? 'full' : 'lazy';
  if (topbarCache[key]) return topbarCache[key];
  const mega = megaMenu();
  const toolsMenu = full
    ? `<details class="nav-menu" data-menu><summary class="nav-item">Tools<span class="caret" aria-hidden="true"></span></summary>${mega}</details>`
    : `<details class="nav-menu" data-menu data-lazy="/menu.html?v=${megaVersion}"><summary class="nav-item">Tools<span class="caret" aria-hidden="true"></span></summary><div class="dropdown mega-wait"><ul><li><a href="/converters">All formats and converters</a></li></ul></div></details>`;
  const compress = ALL_COMPRESSORS.map((c) =>
    `<li><a href="${c.route}">${icon('compress')}Compress ${F(c.from).label}${c.status === 'live' ? '' : ' <span class="soon-tag">soon</span>'}</a></li>`).join('');
  const convertList = CATS.map((c) =>
    `<li><a href="${categoryPath(c.id)}">${icon(c.icon)}${c.converterName}${categoryIsLive(c.id) ? '' : ' <span class="soon-tag">soon</span>'}</a></li>`).join('');

  topbarCache[key] = `${SPRITE}<header class="top"><div class="top-row">
    ${BRAND_LINK}
    <nav class="main-nav" aria-label="Main">
      ${toolsMenu}
      <details class="nav-menu nav-simple" data-menu><summary class="nav-item">Convert<span class="caret" aria-hidden="true"></span></summary><div class="dropdown"><ul>${convertList}</ul></div></details>
      <details class="nav-menu nav-simple" data-menu><summary class="nav-item">Compress<span class="caret" aria-hidden="true"></span></summary><div class="dropdown"><ul>${compress}</ul></div></details>
      <details class="nav-menu nav-simple nav-pdf" data-menu><summary class="nav-item">PDF Tools<span class="caret" aria-hidden="true"></span></summary>${pdfMenu()}</details>
      ${PDF_EDITOR ? '<a class="nav-item nav-link nav-resume" href="/resume-maker">Resume<span class="nav-long">&nbsp;Builder</span></a>' : ''}
    </nav>
    <div class="top-actions">${PDF_EDITOR ? `
      <a class="btn btn-brand btn-sm btn-edit-pdf" href="/edit-pdf">${icon('edit')}Edit PDF</a>` : ''}
    </div>
  </div></header>`;
  return topbarCache[key];
}

function footer() {
  const pop = [...friendlies().slice(0, 4).map((x) => `<li>${link(`/${x.slug}`, esc(x.h1.replace(/ Converter$/, '')))}</li>`),
    ...POPULAR.slice(0, 8).map(([f, t]) => `<li>${link(pairPath(f, t), pairLabel(f, t))}</li>`)].join('');
  const cats = CATS.map((c) => `<li>${link(categoryPath(c.id), c.converterName)}</li>`).join('');
  const comp = COMPRESSIBLE.map((s) => `<li>${link(compressPath(s), `Compress ${F(s).label}`)}</li>`).join('');
  if (!knownPaths) knownPaths = new Set(allPaths());
  const pdf = `<div><h4>PDF tools</h4><ul>${['/edit-pdf', '/merge-pdf', '/split-pdf', '/compress-pdf', '/protect-pdf', '/unlock-pdf', '/resume-maker', '/sign-pdf']
    .filter((x) => knownPaths.has(x)).map((x) => `<li>${link(x, esc(toolName(x)))}</li>`).join('')}<li>${link('/pdf-tools', 'All PDF tools')}</li></ul></div>`;
  return `<footer class="site-footer"><div class="footer-inner${pdf ? ' footer-6' : ''}">
    <div class="footer-brand">${BRAND_LINK}
      <p>Free online file converter. ${LIVE_COUNT.toLocaleString('en-US')} conversions across ${LIVE_CAT_NAMES.length} categories, free and without sign-up.</p></div>
    <div><h4>Converters</h4><ul>${cats}</ul></div>
    <div><h4>Popular</h4><ul>${pop}</ul></div>
    ${pdf}
    <div><h4>Tools</h4><ul>${MENU_APPS.map((t) => `<li>${link(`/${t.slug}`, esc(t.name))}</li>`).join('')}${comp}<li>${link('/converters', 'All formats')}</li></ul></div>
    <div><h4>Company</h4><ul><li>${link('/about', 'About')}</li><li>${link('/guides', 'Guides')}</li><li>${link('/privacy', 'Privacy Policy')}</li><li>${link('/terms', 'Terms of Use')}</li><li>${link('/contact', 'Contact')}</li>${CONTACT_EMAIL ? `<li>${mailLink}</li>` : ''}</ul></div>
  </div><div class="footer-bottom">&copy; ${new Date().getFullYear()} ${SITE}. Files are deleted as soon as they are converted.</div></footer>`;
}

// ------------------------------------------------------------------ hero --
// CloudConvert-style hero: centred title, text, then "convert [X] to [Y]" + Select File.
// crumbs: [[name, path], ...] rendered as a visible breadcrumb trail (matches the JSON-LD).
function breadcrumbs(crumbs) {
  if (!crumbs || crumbs.length < 2) return '';
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map(([n, p], i) => i === crumbs.length - 1
    ? `<li aria-current="page">${n}</li>` : `<li>${link(p, n)}</li>`).join('')}</ol></nav>`;
}

function hero({ h1, intro, widget, withSelect, short, crumbs }) {
  const select = withSelect
    ? `<button class="btn btn-brand btn-select" id="selectBtn" type="button">${icon('upload')}Select File</button>`
    : '';
  return `<section class="hero${short ? ' hero-short' : ''}"><div class="hero-inner">
    ${breadcrumbs(crumbs)}
    <h1>${h1}</h1>
    <p class="hero-text">${intro}</p>
    ${widget || select ? `<div class="converter-box">${widget || ''}${select}</div>
    <ul class="hero-free"><li>100% free</li><li>No sign-up</li><li>No watermark</li><li>Files deleted after conversion</li></ul>` : ''}
  </div></section>`;
}

const convertRow = (fromHtml, toHtml) =>
  `<div class="convert-row"><span class="convert-word">convert</span>${fromHtml}<span class="convert-word">to</span>${toHtml}</div>`;

// Groups for pickers.
const inputItems = (ids, hrefOf, liveOf) => ids.map((id) => ({ id, href: hrefOf(id), live: liveOf(id) }));

function outputPicker(fromSlug, current) {
  const outs = outputsFor(fromSlug, ANY);
  return picker(current ? F(current).label : '...', groupByCategory(inputItems(outs, (o) => pairPath(fromSlug, o), (o) => isLivePair(fromSlug, o))),
    { current, align: 'fmt-right', role: 'to', placeholder: !current });
}

function inputPicker(toSlug, current) {
  const ins = inputsFor(toSlug, ANY);
  return picker(F(current).label, groupByCategory(inputItems(ins, (i) => pairPath(i, toSlug), (i) => isLivePair(i, toSlug))),
    { current, role: 'from' });
}

// "convert [any] to [...]" where picking the input is done client-side (data-fmt) with a
// plain link to the format page as the no-JS fallback.
function anyInputPicker(ids, current) {
  return picker(current ? F(current).label : '...', groupByCategory(inputItems(ids, formatPath, formatIsLive)),
    { current, role: 'from', dataFmt: true, placeholder: !current });
}

const emptyToPicker = () =>
  `<details class="chip-menu" data-menu data-role="to"><summary class="chip chip-empty" aria-label="Choose output format">${fsvg('none')}<span class="chip-label">...</span><span class="caret" aria-hidden="true"></span></summary>`
  + `<div class="fmt-panel fmt-right"><label class="fmt-search">${SEARCH_ICON}<input type="search" class="fmt-q" placeholder="Search Format" autocomplete="off" aria-label="Search format"></label>`
  + '<div class="fmt-body"><ul class="fmt-cats"></ul><div class="fmt-grids"><p class="fmt-hint">Choose the input format first.</p><p class="fmt-none">No format found</p></div></div></div></details>';

// Compact map the client uses to fill the "to" picker after an input is chosen.
// The registry is frozen, so each map is built once per set of inputs and reused.
const mapCache = new Map();
function conversionMap(fromIds) {
  const key = fromIds.join(' ');
  if (!mapCache.has(key)) mapCache.set(key, buildConversionMap(fromIds));
  return mapCache.get(key);
}
function buildConversionMap(fromIds) {
  const pairs = {};
  const fmts = {};
  const live = [];
  fromIds.forEach((f) => {
    const outs = outputsFor(f, ANY);
    pairs[f] = outs.join(' ');
    [f, ...outs].forEach((id) => { if (!fmts[id]) fmts[id] = [F(id).label, F(id).categories, `${F(id).name} ${F(id).full}`.toLowerCase(), registry.getFormat(id).apiFormat]; });
    outs.forEach((o) => { if (isLivePair(f, o)) live.push(`${f}>${o}`); });
  });
  const cats = CATS.map((c) => [c.id, c.name]);
  // file extension -> format id, so the upload tool can tell what a dropped file is
  const ext = {};
  registry.getInputFormats().forEach((f) => f.extensions.forEach((e) => { ext[e] = f.id; }));
  // pairs the hero cycles through (CloudConvert-style "convert PNG to JPG" animation)
  const rotate = POPULAR;
  return `<script type="application/json" id="convMap">${jsonLd({ cats, fmts, pairs, live, ext, rotate })}</script>`;
}

// ----------------------------------------------------------------- tool --
// The working upload tool. Only rendered where at least one conversion is live.
//   inputs   formats this tool accepts
//   outputs  choices for the Output format select
//   any      true on home/category/format pages: files of any accepted type can be dropped, and
//            non-image files get their own "convert to" select in the results list
function toolHtml({ inputs, outputs, dropTitle, dropSub, any = false, compress = false }) {
  const exts = [...new Set(inputs.flatMap((id) => registry.getFormat(id).extensions))];
  // extension -> category, so each file gets the right icon and "JPEG Image" / "MP4 Video" label
  const cats = {};
  [...inputs, ...outputs].forEach((id) => { const f = registry.getFormat(id); f.extensions.forEach((e) => { cats[e] = f.category; }); });
  // Targets offered in each file's "to" select on single-conversion pages: [id, label, apiFormat, category]
  const outs = outputs.map((id) => { const f = registry.getFormat(id); return [f.id, f.label, f.apiFormat, f.category]; });
  // CloudConvert-style flow: drop files -> one card per file ("Convert JPEG -> [PNG]", Options, x)
  // -> Convert -> each card shows FINISHED + Download; "Download all" zips every result.
  // compress: files keep their format; cards read "Compress [PNG]" and the button says Compress
  return `<section class="tool-card" id="convert" aria-label="${compress ? 'Upload and compress' : 'Upload and convert'}"${any ? ' data-any="1"' : ''}${compress ? ' data-mode="compress"' : ''} data-cats="${esc(JSON.stringify(cats))}" data-outputs="${esc(JSON.stringify(outs))}">
  <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Choose files" data-exts="${exts.join(',')}" data-max-mb="${MAX_MB}">
    ${icon('upload', 'drop-ico')}
    <div class="cta">${dropTitle}</div>
    <div class="sub">${dropSub} &middot; up to ${MAX_MB}MB each</div>
    <input type="file" id="fileInput" accept="${exts.map((e) => `.${e}`).join(',')}" multiple>
  </div>
  <div class="file-list" id="fileList" aria-live="polite"></div>
  <div class="tool-bar" id="toolBar" hidden>
    <div class="bar-status" id="barStatus"></div>
    <div class="bar-actions">
      <button class="btn btn-ghost" id="addMoreBtn" type="button">${icon('upload')}Add more files</button>
      <button class="btn btn-success" id="zipBtn" type="button" hidden>${icon('download')}Download all</button>
      <button class="btn btn-brand btn-convert" id="convertAllBtn" type="button">${compress ? `${icon('compress')}Compress` : `${icon('convert')}Convert`}</button>
    </div>
  </div>
</section>`;
}

// Accepts every live input; each file gets its own "to" list of live targets.
const anyTool = (inputs = LIVE_INPUTS) => toolHtml({
  inputs, outputs: [], any: true,
  dropTitle: 'Drop your files here', dropSub: `${inputs.length} file types, including ${inputs.slice(0, 6).map((i) => F(i).label).join(', ')}`,
});

function soonBox(title, text, alternatives) {
  return `<section class="soon-box" id="convert">
    <span class="badge badge-soon">Coming soon</span>
    <h2>${title}</h2>
    <p>${text}</p>
    ${alternatives.length ? `<h3>Available right now</h3>${chips(alternatives)}` : ''}
    <p class="soon-more">${link('/converters', 'Browse every format')} &middot; ${link('/', 'Image converter')}</p>
  </section>`;
}

// ------------------------------------------------------------- content --
const cardHtml = (slug) => {
  const f = F(slug);
  return `<article class="fcard">${ficon(slug, 'lg')}<div>
    <h3>${f.label} <span>&ndash; ${esc(f.full)}</span></h3><p>${esc(f.about)}</p>
    ${link(formatPath(slug), `More ${f.label} conversions`)}</div></article>`;
};

function faqHtml(items) {
  return `<section class="faq"><h2>Frequently asked questions</h2>${items
    .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`;
}

const FAQ_COMMON = [
  ['Is it really free?',
    `Yes. There is no sign-up and no watermark. To keep the service available for everyone there is a ${MAX_MB}MB limit per file and a cap on how many files one connection can process in a short period.`],
  ['Are my files stored?',
    'Your upload is used only to make the converted file. Images are processed in memory; other files are written to a private temporary folder that is deleted as soon as the conversion finishes. Nothing is kept after the result has been sent back.'],
  ['Will quality drop?',
    'For images, a little, by design: the image is re-encoded at the Quality you choose (default 75%). Audio and video are re-encoded with high-quality settings; documents keep their text and layout as far as the target format allows. Converting never restores detail that is already missing from the original.'],
];

const FAQ_CATALOG = [
  ['Which conversions work today?',
    `${LIVE_SUMMARY} work on this server right now. The rest of the ${TOTAL_COUNT.toLocaleString('en-US')} conversions in the menus are on the roadmap and are clearly marked \u201ccoming soon\u201d until they work.`],
];

function pairNotes(from, to) {
  const n = [];
  if (from.rank !== null && to.rank !== null) {
    if (to.rank > from.rank) n.push(`${to.name} files are usually smaller than ${from.name} files at similar visual quality, so converting ${from.name} to ${to.name} typically saves storage and speeds up page loads.`);
    else if (to.rank < from.rank) n.push(`${to.name} files are often larger than ${from.name} files. If size matters, lower the Quality slider or choose a smaller Max dimension.`);
    else n.push(`${from.name} and ${to.name} produce files of broadly similar size, so the main reasons to convert are compatibility and workflow.`);
  }
  if (to.slug === 'jpg') n.push('JPG cannot store transparency, so any transparent areas are filled with white.');
  if (to.slug === 'gif') n.push('GIF is limited to 256 colours per frame, so smooth gradients and photographs can look banded.');
  if (to.slug === 'webp') n.push('WebP is supported by current versions of all major browsers.');
  if (to.slug === 'avif') n.push('AVIF often gives the smallest files, but older browsers and some apps cannot open it, and it takes longer to create.');
  if (to.slug === 'tiff') n.push('TIFF is aimed at print and archiving; most websites need JPG, PNG or WebP instead.');
  if (to.slug === 'png') n.push('PNG keeps transparency and sharp edges. To keep files small, the number of colours is reduced to match your Quality setting.');
  if (to.slug === 'ico') n.push('The result is a multi-size .ico containing 16, 32, 48, 64, 128 and 256 pixel versions. Images that are not square are cropped to a square.');
  if (from.slug === 'gif' && ['png', 'jpg', 'avif', 'tiff', 'ico'].includes(to.slug)) n.push('Animated GIFs are converted to a single still frame.');
  if (from.slug === 'gif' && to.slug === 'webp') n.push('Animation is preserved when converting an animated GIF to WebP.');
  if (from.slug === 'webp' && to.slug !== 'webp') n.push('If the WebP file is animated, only its first frame is converted.');
  if (from.slug === 'svg') n.push('SVG is a vector format, so it is rasterised (drawn as pixels) at the size declared inside the file.');
  if (from.slug === 'bmp') n.push('BMP files are often uncompressed, so the converted file is frequently dramatically smaller.');
  if (from.slug === 'jfif') n.push('JFIF files contain ordinary JPEG data, so they are read directly without any extra loss.');
  return n;
}

function pairFaq(from, to, imagePair = true) {
  return [
    [`How do I convert ${from.label} to ${to.label}?`,
      `Click Select File or drop your ${from.name} file onto the upload box.${imagePair ? ' Pick the quality and maximum size, and the' : ' The'} converted ${to.name} appears in the list below with a download button. You can add many files at once and download them together as a ZIP.`],
    ...FAQ_COMMON,
  ];
}

// Hand-written guide for a popular conversion (content/guides.js), or '' when there is none.
function guideHtml(from, to, g) {
  if (!g) return '';
  return `<section class="guide prose">
    <h2>Why convert ${from.label} to ${to.label}?</h2><p>${g.why}</p>
    <h2>When to keep the ${from.label}</h2><p>${g.keep}</p>
    <h2>Tips for the best result</h2><ul>${g.tips.map((t) => `<li>${t}</li>`).join('')}</ul>
    <h2>Common problems and fixes</h2><dl class="problems">${g.problems.map(([q, a]) => `<dt>${q}</dt><dd>${a}</dd>`).join('')}</dl>
  </section>`;
}

function relatedForPair(from, to) {
  const a = outputsFor(from.slug, ANY).filter((o) => o !== to.slug).slice(0, 8).map((o) => [pairPath(from.slug, o), pairLabel(from.slug, o), isLivePair(from.slug, o)]);
  const b = inputsFor(to.slug, ANY).filter((i) => i !== from.slug).slice(0, 8).map((i) => [pairPath(i, to.slug), pairLabel(i, to.slug), isLivePair(i, to.slug)]);
  const rev = registry.getConversionStatus(to.slug, from.slug) ? [[pairPath(to.slug, from.slug), pairLabel(to.slug, from.slug), isLivePair(to.slug, from.slug)]] : [];
  const comp = COMPRESSIBLE.includes(from.slug) ? [[compressPath(from.slug), `Compress ${from.label}`, true]] : [];
  return `<section class="related"><h2>Related converters</h2>${chips([...rev, ...comp, ...a, ...b])}</section>`;
}

// Conversions for one format, grouped by the target category.
function conversionLists(slug, dir) {
  const ids = dir === 'out' ? outputsFor(slug, ANY) : inputsFor(slug, ANY);
  return groupByCategory(ids.map((id) => ({ id }))).map(([, name, items]) =>
    `<div class="conv-group"><h3>${name}</h3>${chips(items.map(({ id }) => dir === 'out'
      ? [pairPath(slug, id), pairLabel(slug, id), isLivePair(slug, id)]
      : [pairPath(id, slug), pairLabel(id, slug), isLivePair(id, slug)]))}</div>`).join('');
}

const FEATURES = () => [
  ['layers', `${FORMAT_COUNT}+ formats`, `${LIVE_COUNT.toLocaleString('en-US')} conversions work today across ${listWords(LIVE_CAT_NAMES)} files. The rest of the catalogue is marked and being added.`],
  ['shield', 'Data security', 'Files are used only to make your conversion and are deleted as soon as it is finished. Nothing is kept, shared or looked at.'],
  ['star', 'High-quality conversions', 'Built on trusted open-source engines: libvips, FFmpeg, LibreOffice, Pandoc, Calibre, Ghostscript and Inkscape.'],
  ['gift', 'Free, no sign-up', 'No account, no watermark, no email. Convert many files at once and download them together as a ZIP.'],
];

const featuresHtml = () => `<section class="features">${FEATURES().map(([ic, t, d]) =>
  `<div class="feature">${icon(ic, 'feature-ico')}<h3>${t}</h3><p>${d}</p></div>`).join('')}</section>`;

function categoryCards() {
  return `<section class="cat-section"><h2 class="section-title">Explore all converters</h2>
    <p class="section-sub">Pick a category, or open the <strong>Tools</strong> menu to jump straight to a format.</p>
    <div class="cat-grid">${CATS.map((c) => {
    const fmts = registry.getFormatsByCategory(c.id);
    const live = categoryIsLive(c.id);
    return `<a class="cat-card" href="${categoryPath(c.id)}">
      <span class="cat-ico">${icon(c.icon)}</span>
      <span class="cat-body"><strong>${c.converterName}</strong>
      <span class="cat-formats">${fmts.slice(0, 7).map((f) => f.label).join(' &middot; ')}${fmts.length > 7 ? ` +${fmts.length - 7}` : ''}</span></span>
      <span class="badge ${live ? 'badge-live' : 'badge-soon'}">${live ? 'Available' : 'Soon'}</span></a>`;
  }).join('')}</div></section>`;
}

function popularCards() {
  return `<section class="pop-section"><h2 class="section-title">Popular conversions</h2><div class="pop-grid">${POPULAR.map(([f, t]) =>
    `<a class="pop-card" href="${pairPath(f, t)}"><span class="pop-fmt">${F(f).label}</span><span class="pop-arrow" aria-hidden="true">&rarr;</span><span class="pop-fmt pop-to">${F(t).label}</span></a>`).join('')}</div></section>`;
}

// ------------------------------------------------------------- page makers --
// Share-image key for a URL path: '/' -> 'home', '/png-to-webp' -> 'png-to-webp'.
const ogKey = (urlPath) => (urlPath === '/' ? 'home' : urlPath.slice(1).replace(/\//g, '-'));

const PRIVACY_SERVER = '<strong>How this works:</strong> your file is uploaded over HTTPS and converted on this server with open-source engines (libvips for images, FFmpeg for audio and video, LibreOffice and Pandoc for documents, Calibre for ebooks, Ghostscript and Inkscape for PDF and vector files). Images are processed in memory; other files use a private temporary folder that is deleted as soon as the conversion finishes.';
function baseFields(base, urlPath, title, desc, extra) {
  const url = base + urlPath;
  return {
    TITLE: esc(title), META_DESC: esc(desc), ROBOTS: 'index, follow, max-image-preview:large, max-snippet:-1', URL: url,
    CANONICAL_TAG: `<link rel="canonical" href="${url}">`,
    TOPBAR: topbar(), FOOTER: footer(), DEFAULT_FORMAT: 'auto', JSONLD: '{}', TOOL: '', CONTENT: '', RELATED: '', BODY: '', PRIVACY: PRIVACY_SERVER, SCRIPTS: '',
    CSS_V: seo.ASSET_V.css, JS_V: seo.ASSET_V.js,
    _url: url, _title: esc(title), _desc: esc(desc), _image: `${base}/og/${ogKey(urlPath)}.png`, _noindex: false,
    ...extra,
  };
}

// Which working pages search engines are asked to index. Every conversion keeps working; the
// many rare pairs (CR2 to TGA, MKV to WMA...) are 'noindex, follow' and left out of the sitemap,
// so search engines spend their time on the pages people actually search for.
const COMMON = new Set(('jpg png webp gif bmp tiff heic avif svg ico jfif pdf docx doc odt rtf txt html xlsx xls csv pptx ppt '
  + 'epub mobi mp4 mov avi mkv webm wmv mp3 wav aac m4a flac ogg wma opus zip rar 7z ttf otf woff woff2').split(' '));
const POPULAR_SET = new Set(registry.getPopularConversions().map((c) => `${c.from}>${c.to}`));
// Rarer pairs that Google Search Console shows people already finding (October 2026): kept indexed.
const SEEN_IN_SEARCH = new Set(('txt>rst xz>tar-xz cbz>mobi txt>dot ppsx>odp pot>odp swf>mod rtf>tex swf>webp wav>oga djvu>tiff pptx>jpg flv>swf prc>oeb '
  + 'docm>docx odt>doc ttf>woff docx>html rtf>doc mobi>txt mod>mov mod>avi wmv>mpg swf>gif bmp>pdf txt>docx txt>doc pdf>mobi pdf>prc docx>txt doc>txt').split(' '));
const pairIndexable = (f, t) => POPULAR_SET.has(`${f}>${t}`) || SEEN_IN_SEARCH.has(`${f}>${t}`) || !!GUIDES[`${f}>${t}`] || !!KEYWORDS[pairPath(f, t)] || (COMMON.has(f) && COMMON.has(t));
// Every working format page is indexed: Search Console shows even rare ones (LZ, XZ, TCR) ranking
// on page one, because few sites cover them.
const formatIndexable = () => true;
// Working page, not indexed: keeps its tool, ads and structured data.
const notIndexed = (fields) => ({ ...fields, ROBOTS: 'noindex, follow', _soft: true });

// Planned/experimental pages: visible and linked, but kept out of the index.
const noindex = (fields) => ({ ...fields, ROBOTS: 'noindex, follow', CANONICAL_TAG: '', JSONLD: '{}', _noindex: true });

function renderPage(tpl, fields) {
  const ads = adFields(!fields._noindex && !!fields.TOOL);
  return render(tpl, { ...fields, ...ads, HEAD_TAGS: seo.headTags({ url: fields._url, title: fields._title, desc: fields._desc, image: fields._image, noindex: fields._noindex || fields._soft }) });
}

// Structured data. Organization + WebSite are the same on every page (linked by @id);
// the page itself is a WebApplication (tools) or WebPage (lists, legal pages).
function graph(base, urlPath, name, desc, faq, crumbs, { type = 'WebApplication', features, article } = {}) {
  const url = base + urlPath;
  const org = { '@type': 'Organization', '@id': `${base}/#organization`, name: SITE, url: `${base}/`,
    logo: { '@type': 'ImageObject', url: `${base}/icon-512.png`, width: 512, height: 512 },
    ...(CONTACT_EMAIL ? { email: CONTACT_EMAIL, contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: CONTACT_EMAIL, availableLanguage: ['English', 'Urdu'] } } : {}),
    ...(SOCIAL_LINKS.length ? { sameAs: SOCIAL_LINKS } : {}) };
  const site = { '@type': 'WebSite', '@id': `${base}/#website`, name: SITE, url: `${base}/`, inLanguage: 'en', publisher: { '@id': `${base}/#organization` } };
  const pageNode = type === 'WebApplication'
    ? { '@type': 'WebApplication', '@id': `${url}#app`, name, url, description: desc, inLanguage: 'en',
      applicationCategory: 'MultimediaApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript and a modern browser.',
      isAccessibleForFree: true, image: `${base}/og/${ogKey(urlPath)}.png`, publisher: { '@id': `${base}/#organization` },
      isPartOf: { '@id': `${base}/#website` }, dateModified: seo.LASTMOD,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, ...(features ? { featureList: features } : {}) }
    : type === 'Article'
      ? { '@type': 'Article', '@id': `${url}#article`, headline: name, url, description: desc, inLanguage: 'en', mainEntityOfPage: url,
        image: `${base}/og/${ogKey(urlPath)}.png`, datePublished: article.date, dateModified: article.updated || article.date,
        author: { '@id': `${base}/#organization` }, publisher: { '@id': `${base}/#organization` }, isPartOf: { '@id': `${base}/#website` } }
      : { '@type': type, '@id': `${url}#webpage`, name, url, description: desc, inLanguage: 'en', isPartOf: { '@id': `${base}/#website` }, dateModified: seo.LASTMOD };
  return jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      org, site, pageNode,
      ...(faq && faq.length ? [{ '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : []),
      ...(crumbs && crumbs.length > 1 ? [{ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumbs.map(([n, p], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: base + p })) }] : []),
    ],
  });
}

const TOOL_FEATURES = ['Batch conversion', 'Download all as ZIP', 'Adjustable quality', 'Resize to a maximum dimension', 'No sign-up', 'Files are not stored'];

// "How to convert" steps: visible on the page.
// Everyday jobs the tool is used for (content/uses.js), on the pages that have them.
function usesHtml(p, what) {
  const list = USES[p];
  if (!list) return '';
  return `<section class="notes uses"><h2>Popular uses for ${esc(what)}</h2><ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
}
function howToSteps(fromLabel, toLabel, verb = 'convert', image = true) {
  return `<section class="howto"><h2>How to ${verb} ${fromLabel}${toLabel ? ` to ${toLabel}` : ''}</h2><ol class="steps">
    <li><strong>Choose your files.</strong> Click <em>Select File</em> or drag your ${fromLabel} files into the upload box. You can add many at once.</li>
    <li><strong>Pick the settings.</strong> ${toLabel ? `${toLabel} is already selected as the output format.` : 'Choose the output format.'}${image ? (verb === 'compress' ? ' Open Options to choose how much smaller each file should be (50% by default) and an optional maximum size.' : ' Adjust Quality and Max dimension if you want smaller files.') : verb === 'compress' ? ' Open Options to choose Light, Recommended, Strong or Extreme compression (Recommended by default).' : ' The conversion starts as soon as a file is added.'}</li>
    <li><strong>Download.</strong> Each file appears in the list when it is ready. Download them one by one, or all together with Download all.</li>
  </ol></section>`;
}

// Side-by-side facts for two live formats (uses the comparison traits in registry/formats.js).
const yesNo = (v) => (v ? 'Yes' : 'No');
function compareTable(slugs) {
  const fs_ = slugs.map(F).filter((f) => f.traits && f.traits.compression);
  if (!fs_.length) return '';
  const rows = [
    ['Full name', (f) => esc(f.full)],
    ['Compression', (f) => f.traits.compression],
    ['Transparency', (f) => yesNo(f.traits.alpha)],
    ['Animation', (f) => yesNo(f.traits.animation)],
    ['Introduced', (f) => f.traits.year || '&ndash;'],
    ['Developed by', (f) => f.traits.developer || '&ndash;'],
    ['Best for', (f) => f.traits.bestFor || '&ndash;'],
  ];
  const heading = fs_.length === 2 ? `${fs_[0].label} vs ${fs_[1].label}` : `${fs_[0].label} at a glance`;
  return `<section class="compare"><h2>${heading}</h2><div class="table-wrap"><table>
    <thead><tr><th scope="col">Feature</th>${fs_.map((f) => `<th scope="col">${f.label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([k, fn]) => `<tr><th scope="row">${k}</th>${fs_.map((f) => `<td>${fn(f)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div></section>`;
}

function pairPage(fromSlug, toSlug, base) {
  const from = F(fromSlug), to = F(toSlug), p = pairPath(fromSlug, toSlug);
  const live = isLivePair(fromSlug, toSlug);
  const meta = registry.getConverterMetadata(fromSlug, toSlug, { siteName: SITE, minStatus: 'planned' });
  const widget = convertRow(inputPicker(toSlug, fromSlug), outputPicker(fromSlug, toSlug));
  const cards = `<section class="fcards" aria-label="About the formats">${cardHtml(fromSlug)}${cardHtml(toSlug)}</section>`;

  if (!live) {
    const alts = outputsFor(fromSlug).map((o) => [pairPath(fromSlug, o), pairLabel(fromSlug, o), true]);
    const note = meta.converter.notes ? ` ${esc(meta.converter.notes)}` : '';
    return renderPage(PAGE_TPL, noindex(baseFields(base, p, meta.title, meta.description, {
      HERO: hero({ h1: meta.h1, crumbs: meta.breadcrumbs, intro: `Convert ${from.name} files to ${to.name}. This conversion is on our roadmap and not available on this server yet.`, widget }),
      TOOL: soonBox(`${from.label} to ${to.label} is coming soon`,
        `We list every conversion we plan to support so you can find it later, but we only switch one on once it really works.${note}`, alts),
      CONTENT: cards,
      RELATED: relatedForPair(from, to),
    })));
  }

  const imagePair = isImageFmt(fromSlug) && isImageFmt(toSlug);
  const guide = GUIDES[`${fromSlug}>${toSlug}`];
  const kw = KEYWORDS[p];
  const faq = [...(guide ? guide.faq : []), ...(kw && kw.faq ? kw.faq : []), ...pairFaq(from, to, imagePair)];
  let { title, description, h1 } = meta;
  let lead = '';
  if (kw) {
    const name = kwCase(kw.primary), alt = kwAlt(kw);
    title = fitTitle(`${name} Converter`, alt && kwCase(alt));
    const also = alt && / to /.test(alt) ? ` (${kwCase(alt)})` : '';
    description = kw.desc || `Free ${name} converter${also}. Convert ${from.label} files to ${to.label} online, many at once, and download them as a ZIP. No sign-up, no watermark.`;
    h1 = `${name} Converter`;
    lead = `This ${name} converter works in your browser on any computer or phone. `;
  }
  const notes = pairNotes(from, to);
  if (!imagePair && meta.converter.notes) notes.push(esc(meta.converter.notes));
  if (!notes.length) notes.push(`Your ${from.name} file is converted on our server and the ${to.name} result can be downloaded straight away.`);
  const pairFields = baseFields(base, p, title, description, {
    JSONLD: graph(base, p, kw ? h1 : meta.schemaName, description, faq, meta.breadcrumbs, { features: TOOL_FEATURES }),
    DEFAULT_FORMAT: to.select,
    HERO: hero({ h1, crumbs: meta.breadcrumbs,
      intro: lead + (imagePair
        ? `Convert ${from.name} images to ${to.name} online for free. Upload one file or many, choose the quality and maximum size, then download the ${to.name} results one by one or all together in a ZIP. No sign-up needed.`
        : `Convert ${from.name} files to ${to.name} online for free. Upload one file or many and download the ${to.name} results one by one or all together in a ZIP. No sign-up needed.`),
      widget, withSelect: true }),
    TOOL: toolHtml({ inputs: [fromSlug], outputs: outputsFor(fromSlug), dropTitle: `Drop your ${from.label} files here`, dropSub: `or click to choose ${from.label} files` }),
    CONTENT: howToSteps(from.label, to.label, 'convert', imagePair) + usesHtml(p, kw ? `${kwCase(kw.primary)} conversion` : `${from.label} to ${to.label}`) + guideHtml(from, to, guide) + cards + compareTable([fromSlug, toSlug])
      + `<section class="notes"><h2>Converting ${from.name} to ${to.name}</h2><ul>${notes.map((x) => `<li>${x}</li>`).join('')}</ul></section>`
      + friendlyLinks(fromSlug, toSlug) + readMore(p) + faqHtml(faq),
    RELATED: relatedForPair(from, to),
  });
  return renderPage(PAGE_TPL, pairIndexable(fromSlug, toSlug) ? pairFields : notIndexed(pairFields));
}

// A converter under a friendly name (content/friendly-pages.js): the same upload tool as the pair
// pages, accepting every file type the name covers, with its own title, text and FAQ. Links to
// pages that are switched off (the PDF editor) become plain text.
let knownPaths = null;
function liveLinks(html) {
  if (!knownPaths) knownPaths = new Set(allPaths());
  return html.replace(/<a href="(\/[^"#?]*)[^"]*">([\s\S]*?)<\/a>/g, (m, href, text) => (knownPaths.has(href) ? m : text));
}
function friendlyPage(slug, base) {
  const x = friendlyBySlug(slug);
  if (!x) return null;
  const p = `/${x.slug}`;
  const crumbs = [['Home', '/'], [x.h1.replace(/ Converter$/, ''), p]];
  const inLabels = x.inputs.map((i) => F(i).label);
  const see = x.see.filter((s) => { if (!knownPaths) knownPaths = new Set(allPaths()); return knownPaths.has(s); })
    .map((s) => [s, friendlyBySlug(s.slice(1)) ? friendlyBySlug(s.slice(1)).h1.replace(/ Converter$/, '') : toolName(s), true]);
  const more = friendlies().filter((o) => o.slug !== x.slug).map((o) => [`/${o.slug}`, o.h1.replace(/ Converter$/, ''), true]);
  return renderPage(PAGE_TPL, baseFields(base, p, `${x.title} | ${SITE}`, x.desc, {
    JSONLD: graph(base, p, x.h1, x.desc, x.faq, crumbs, { features: TOOL_FEATURES }),
    DEFAULT_FORMAT: F(x.outputs[0]).select,
    HERO: hero({ h1: x.h1, crumbs, intro: x.intro }),
    TOOL: toolHtml({ inputs: x.inputs, outputs: x.outputs, dropTitle: `Drop your ${inLabels.length > 3 ? 'files' : inLabels.join(' or ')} here`, dropSub: `${inLabels.join(', ')}` }),
    CONTENT: usesHtml(p, x.h1.replace(/ Converter$/, '')) + x.sections.map(([h, html]) => `<section class="notes prose-block"><h2>${esc(h)}</h2>${liveLinks(html)}</section>`).join('')
      + `<section class="related-tools"><h2>Related tools</h2>${chips(see)}<h3>More popular converters</h3>${chips(more)}</section>`
      + readMore(p) + faqHtml(x.faq),
  }));
}
const resolveFriendly = (slug, base) => (friendlyBySlug(slug) ? { html: friendlyPage(slug, base) } : null);

// "Also try": the friendly-name converters that cover this pair (PDF to DOCX -> PDF to Word).
function friendlyLinks(from, to) {
  const hits = friendlies().filter((x) => x.inputs.includes(from) && x.outputs.includes(to));
  return hits.length ? `<p class="also-try">Also available as ${hits.map((x) => link(`/${x.slug}`, esc(x.h1))).join(' and ')}, which accepts ${hits.map((x) => x.inputs.map((i) => F(i).label).join(', ')).join('; ')} files.</p>` : '';
}

// ------------------------------------------------------------- PDF tools --
// /split-pdf, /protect-pdf ...: the tool (public/pdf-tools.js) with its own text and FAQ, and
// /pdf-tools, every PDF tool on the site in groups.
const PRIVACY_BROWSER = '<strong>How this works:</strong> this tool runs in your browser with open-source code (pdf.js to show the pages, pdf-lib to save the PDF). Your file is read on your own device and is never uploaded to our server.';
const PRIVACY_PDF_SERVER = '<strong>How this works:</strong> your PDF is uploaded over HTTPS and processed on this server with open-source tools (qpdf and Ghostscript) in a private temporary folder, which is deleted as soon as the result is ready. Passwords are used once and never stored or logged.';
const tIcon = (name) => `<span class="pt-tile pt-tile-${name}">${icon(`t-${name}`)}</span>`;
// The directory, without tools this server does not have (editor pages when PDF_EDITOR is off).
function pdfGroups() {
  if (!knownPaths) knownPaths = new Set(allPaths());
  return PDFT.groups.map(([name, items]) => [name, items.filter(([p]) => knownPaths.has(p))]).filter(([, items]) => items.length);
}
function pdfMenu() {
  return `<div class="dropdown pdf-menu">${pdfGroups().map(([name, items]) => `<div class="pdf-menu-group"><h3>${esc(name)}</h3><ul>${items
    .map(([p, label, ic]) => `<li><a href="${p}">${tIcon(ic)}${esc(label)}</a></li>`).join('')}</ul></div>`).join('')}
    <a class="pdf-menu-all" href="/pdf-tools">See all PDF tools &rarr;</a></div>`;
}

const pwField = (name, label, auto, extra = '') => `<label class="pt-field"><span>${label}</span><span class="pt-pw"><input type="password" name="${name}" autocomplete="${auto}" maxlength="100" spellcheck="false"${extra}><button type="button" class="pt-eye" data-eye aria-label="Show password">Show</button></span></label>`;
const PT_OPTS = {
  merge: `<p class="pt-hint">Drag the files into the order you want, or use the arrows. The first file comes first in the merged PDF.</p>
    <div class="pt-row"><button type="button" class="pt-link" data-add>+ Add more PDFs</button><input type="file" accept="application/pdf,.pdf" multiple data-add-input hidden></div>`,
  split: `<fieldset class="pt-radios"><legend>How to split</legend>
      <label><input type="radio" name="mode" value="each" checked> Every page as its own PDF</label>
      <label><input type="radio" name="mode" value="ranges"> Custom page ranges</label>
      <label><input type="radio" name="mode" value="every"> Fixed number of pages per file</label></fieldset>
    <label class="pt-field" data-when="ranges" hidden><span>Page ranges, separated by commas</span><input type="text" name="ranges" placeholder="e.g. 1-3, 4-8, 9" inputmode="numeric" autocomplete="off"></label>
    <label class="pt-field pt-field-s" data-when="every" hidden><span>Pages per file</span><input type="number" name="every" min="1" value="2"></label>`,
  extract: `<label class="pt-field"><span>Pages to extract (click the pages below, or type them)</span><input type="text" name="pages" placeholder="e.g. 1, 3, 5-7" inputmode="numeric" autocomplete="off"></label>
    <div class="pt-row"><button type="button" class="pt-link" data-all>Select all</button><button type="button" class="pt-link" data-none>Clear</button>
    <label class="pt-check"><input type="checkbox" name="separate"> Save each page as its own PDF</label></div>`,
  organize: `<p class="pt-hint">Drag a page to move it, or use the arrows. Rotate, delete or add a blank page with the buttons on each page.</p>
    <div class="pt-row"><button type="button" class="pt-link" data-reset-pages>Reset</button></div>`,
  crop: `<p class="pt-hint">Drag the corners or edges of the box. Everything outside it is cropped away.</p>
    <div class="pt-row"><fieldset class="pt-radios pt-inline"><legend class="sr">Apply to</legend><label><input type="radio" name="apply" value="all" checked> All pages</label><label><input type="radio" name="apply" value="one"> This page only</label></fieldset>
    <button type="button" class="pt-link" data-crop-reset>Reset box</button></div>
    <div class="pt-crop"><div class="pt-crop-nav"><button type="button" class="pt-link" data-prev aria-label="Previous page">&lsaquo; Prev</button><span data-pageno></span><button type="button" class="pt-link" data-next aria-label="Next page">Next &rsaquo;</button></div>
    <div class="pt-crop-stage" data-stage><canvas></canvas><div class="pt-crop-box" data-box tabindex="0" aria-label="Crop area">${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<i data-h="${h}"></i>`).join('')}</div></div></div>`,
  protect: `${pwField('password', 'Password', 'new-password', ' minlength="4" required')}${pwField('confirm', 'Type it again', 'new-password', ' required')}
    <p class="pt-hint">Use 8 or more characters. Keep the password safe: without it nobody can open the PDF, not even us.</p>`,
  unlock: `${pwField('password', 'Password (leave empty if the PDF opens without one)', 'current-password')}
    <p class="pt-hint">Only unlock PDFs you own or are allowed to change.</p>`,
  repair: '<p class="pt-hint">The file is checked and rebuilt. Click <strong>Repair PDF</strong> to start.</p>',
  pdfa: `<label class="pt-field pt-field-s"><span>PDF/A version</span><select name="level"><option value="1">PDF/A-1b</option><option value="2" selected>PDF/A-2b (recommended)</option><option value="3">PDF/A-3b</option></select></label>`,
};
const PT_GO = { merge: 'Merge PDF', split: 'Split PDF', extract: 'Extract pages', organize: 'Save PDF', crop: 'Crop PDF', protect: 'Protect PDF', unlock: 'Unlock PDF', repair: 'Repair PDF', pdfa: 'Convert to PDF/A' };

function pdfToolBox(t) {
  const next = t.see.filter((s) => knownPaths.has(s)).slice(0, 4).map((s) => link(s, esc(toolName(s)))).join('');
  return `<section class="pt" id="pt" data-op="${t.op}" data-name="${esc(t.name)}" data-max-mb="${MAX_MB}"${t.browser ? ' data-browser' : ''}>
  <div class="pt-drop" data-drop>
    <input type="file" accept="application/pdf,.pdf" data-input hidden${t.multi ? ' multiple' : ''}>
    ${icon('upload', 'pt-drop-ico')}
    <button class="btn btn-brand btn-select" type="button" data-pick>${icon('upload')}Select PDF file${t.multi ? 's' : ''}</button>
    <p class="pt-drop-sub">or drop ${t.multi ? 'PDFs' : 'a PDF'} here &middot; up to ${MAX_MB} MB${t.multi ? ' each' : ''}</p>
    <p class="pt-private">${icon('shield')}${t.browser ? `Your ${t.multi ? 'PDFs never leave' : 'PDF never leaves'} your device` : 'Files are deleted as soon as they are done'}</p>
  </div>
  <div class="pt-work" data-work hidden>
    <div class="pt-filebar">${icon('pdf')}<span class="pt-fname" data-fname></span><span class="pt-fmeta" data-fmeta></span><button type="button" class="pt-link" data-again>Choose another file</button></div>
    <form class="pt-opts" data-opts autocomplete="off" onsubmit="return false">${PT_OPTS[t.op]}</form>
    ${t.browser && t.op !== 'crop' ? '<ol class="pt-pages" data-pages></ol>' : ''}
    <div class="pt-bar"><p class="pt-msg" data-msg role="status" aria-live="polite"></p><button type="button" class="btn btn-brand pt-go" data-go>${PT_GO[t.op]}</button></div>
  </div>
  <div class="pt-done" data-done hidden>
    <span class="pt-done-ico" aria-hidden="true">&#10003;</span>
    <h2 class="pt-done-h">Done!</h2>
    <p class="pt-done-text" data-done-text></p>
    <div class="pt-done-btns"><a class="btn btn-brand" data-dl href="#" download>${icon('download')}Download</a><button type="button" class="btn btn-ghost" data-again>Start over</button></div>
    ${next ? `<p class="pt-next">Continue with: ${next}</p>` : ''}
  </div>
  <noscript><p class="pt-msg">This tool needs JavaScript. Please turn it on and reload the page.</p></noscript>
</section>`;
}

function pdfToolPage(slug, base) {
  const t = PDF_TOOL_BY_SLUG.get(slug);
  if (!knownPaths) knownPaths = new Set(allPaths());
  const p = `/${t.slug}`;
  const crumbs = [['Home', '/'], ['PDF Tools', '/pdf-tools'], [t.name, p]];
  const see = t.see.filter((s) => knownPaths.has(s)).map((s) => [s, esc(toolName(s)), true]);
  const steps = `<section class="howto"><h2>${t.howto ? esc(t.howto) : `How to ${esc(t.name.replace(/^PDF to /, 'convert PDF to ').replace(/^(\w)/, (c) => c.toLowerCase()).replace(/ pdf$/i, ' a PDF'))}`}</h2><ol class="steps">${t.steps
    .map(([s, d]) => `<li><strong>${s}</strong> ${d}</li>`).join('')}</ol></section>`;
  return renderPage(PAGE_TPL, baseFields(base, p, `${t.title} | ${SITE}`, t.desc, {
    JSONLD: graph(base, p, t.h1, t.desc, t.faq, crumbs, { features: [t.browser ? 'Runs in the browser, no upload' : 'Files deleted after processing', 'No sign-up', 'No watermark', 'Free'] }),
    HERO: hero({ h1: t.h1, crumbs, intro: t.intro }),
    TOOL: pdfToolBox(t),
    CONTENT: steps + usesHtml(p, t.h1) + t.sections.map(([h, html]) => `<section class="notes prose-block"><h2>${esc(h)}</h2>${liveLinks(html)}</section>`).join('')
      + `<section class="related-tools"><h2>Related tools</h2>${chips(see)}<p class="also-try">Need something else? See ${link('/pdf-tools', 'all PDF tools')}.</p></section>`
      + readMore(p) + faqHtml(t.faq),
    PRIVACY: t.browser ? PRIVACY_BROWSER : PRIVACY_PDF_SERVER,
    SCRIPTS: `<script src="/vendor/pdf-lib.min.js?v=${seo.ASSET_V.pdfTools}" defer></script>\n<script type="module" src="/pdf-tools.js?v=${seo.ASSET_V.pdfTools}"></script>\n`,
  }));
}

function pdfToolsHub(base) {
  const p = '/pdf-tools';
  const title = `All PDF Tools - Free Online PDF Toolkit | ${SITE}`;
  const desc = 'Every free PDF tool in one place: merge, split, compress, convert, edit, sign, crop, protect and unlock PDF files online. No sign-up, no watermark.';
  const crumbs = [['Home', '/'], ['PDF Tools', p]];
  const groups = pdfGroups();
  const body = groups.map(([name, items]) => `<section class="hub-section"><h2>${esc(name)}</h2><ul class="pt-grid">${items
    .map(([href, label, ic]) => `<li><a class="pt-card" href="${href}">${tIcon(ic)}<strong>${esc(label)}</strong><span>${esc(PDFT.blurbs[href] || '')}</span></a></li>`).join('')}</ul></section>`).join('');
  const count = groups.reduce((n, [, items]) => n + items.length, 0);
  const faq = [
    ['Are these PDF tools free?', 'Yes. Every tool is free to use, with no sign-up, no email and no watermark on your files.'],
    ['Are my files safe?', 'Many tools (split, extract, organize, crop and the editor) run in your browser, so the file never leaves your device. The others process files over HTTPS and delete them as soon as they are done.'],
    ['Do the tools work on a phone?', 'Yes. They work in the browser on Android and iPhone, with no app to install.'],
  ];
  return renderPage(HUB_TPL, baseFields(base, p, title, desc, {
    JSONLD: graph(base, p, 'All PDF tools', desc, faq, crumbs, { type: 'CollectionPage' }),
    HERO: hero({ h1: 'Every PDF tool you need, free', crumbs, intro: `${count} free tools to merge, split, compress, convert, edit, sign and protect PDF files. No sign-up, no watermark, and many of them never upload your file.`, short: true }),
    BODY: body + faqHtml(faq),
  }));
}

// ------------------------------------------------------------ app pages --
// Stand-alone tools (content/apps.js): passport photo maker, image to text / OCR PDF, invoice
// generator. Same layout as the PDF tool pages; the tool box is driven by public/apps.js.
const OCR_LANGS = () => require('./engines/ocr').langs();
const PASSPORT_SPECS = require('./content/passport-specs');
// every size in the menu, as a table on the page (searches like "pakistan passport photo size")
const passportTableHtml = () => `<table><thead><tr><th>Country</th><th>Document</th><th>Photo size</th><th>Head (chin to top)</th><th>Digital file</th></tr></thead><tbody>${PASSPORT_SPECS
  .flatMap(([, list]) => list).map((x) => `<tr><td>${esc(x.country)}</td><td>${esc(x.doc)}</td><td>${photoSize(x)}${x.w === 51 && x.h === 51 ? ' (51 x 51 mm)' : ''}</td><td>${x.head[0]}\u2013${x.head[1]} mm</td><td>${(x.px || [Math.round((x.w / 25.4) * 300), Math.round((x.h / 25.4) * 300)]).join(' x ')} px</td></tr>`).join('')}</tbody></table>`;
const photoSize = (x) => (x.w === 51 && x.h === 51 ? '2 x 2 in' : `${x.w} x ${x.h} mm`);
// Tool boxes for the newer tools (driven by public/tools.js).
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB || 100);
const SIG_FONTS = [['great-vibes', 'Great Vibes'], ['dancing-script', 'Dancing Script'], ['sacramento', 'Sacramento'], ['allura', 'Allura'],
  ['alex-brush', 'Alex Brush'], ['mr-dafoe', 'Mr Dafoe'], ['herr-von-muellerhoff', 'Herr Von Muellerhoff'], ['homemade-apple', 'Homemade Apple']];
const dropBox = (accept, label, sub, note) => `<div class="pt-drop" data-drop>
    <input type="file" accept="${accept}" data-input hidden>
    ${icon('upload', 'pt-drop-ico')}
    <button class="btn btn-brand btn-select" type="button" data-pick>${icon('upload')}${label}</button>
    <p class="pt-drop-sub">${sub}</p>
    <p class="pt-private">${icon('shield')}${note}</p>
  </div>`;
const fileBar = (again = 'Choose another file') => `<div class="pt-filebar">${icon('file')}<span class="pt-fname" data-fname></span><span class="pt-fmeta" data-fmeta></span><button type="button" class="pt-link" data-again>${again}</button></div>`;
const NOSCRIPT = '<noscript><p class="pt-msg">This tool needs JavaScript. Please turn it on and reload the page.</p></noscript>';
const IMG_ACCEPT = 'image/*,.heic,.heif';
const fmtSelect = (same = true) => `<label>Save as<select data-fmt>${same ? '<option value="same">Same as original</option>' : ''}<option value="jpg"${same ? '' : ' selected'}>JPG</option><option value="png">PNG</option><option value="webp">WEBP</option></select></label>`;
const jobDone = (title, again) => `<div class="pt-done" data-done hidden>
    <span class="pt-done-ico" aria-hidden="true">&#10003;</span>
    <h2 class="pt-done-h">${title}</h2>
    <p class="pt-done-text" data-done-text></p>
    <div class="pt-done-btns"><a class="btn btn-brand" data-dl-link href="#" download>${icon('download')}Download</a><button type="button" class="btn btn-ghost" data-again>${again}</button></div>
  </div>`;

function toolBox(t) {
  const open = (extra = '') => `<section class="app app-${t.app}" id="app" data-app="${t.app}"${extra}>`;
  if (t.app === 'resize') {
    const kb = t.kb || 100;
    return `${open()}
  ${dropBox(IMG_ACCEPT, 'Select image', 'or drop an image here &middot; JPG, PNG, WEBP, GIF, BMP', 'Your image never leaves your device')}
  <div class="pt-work" data-work hidden>
    ${fileBar('Choose another image')}
    <div class="rs-grid">
      <img class="rs-preview" data-preview alt="Your image">
      <form class="pt-opts" autocomplete="off" onsubmit="return false">
        <fieldset class="pt-radios"><legend>Resize by</legend>
          <label><input type="radio" name="mode" value="kb"${t.mode === 'px' ? '' : ' checked'}> File size (KB)</label>
          <label><input type="radio" name="mode" value="px"${t.mode === 'px' ? ' checked' : ''}> Width and height</label>
          <label><input type="radio" name="mode" value="pct"> Percentage</label></fieldset>
        <div data-mode-box="kb"><label>Target size (KB)<input type="number" data-kb min="5" max="20000" step="1" value="${kb}"></label>
          <p class="rs-chips">${[20, 50, 100, 200, 500].map((n) => `<button type="button" class="chip-btn" data-kbset="${n}">${n} KB</button>`).join('')}</p></div>
        <div data-mode-box="px" hidden><div class="rs-wh"><label>Width (px)<input type="number" data-w min="1" max="12000"></label><label>Height (px)<input type="number" data-h min="1" max="12000"></label></div>
          <label class="rs-lock"><input type="checkbox" data-lock checked> Keep proportions</label>
          <p class="rs-chips">${[['1080x1080', 'Instagram post'], ['1080x1920', 'Story / Reel'], ['1200x630', 'Facebook / link'], ['1280x720', 'YouTube thumbnail'], ['1920x1080', 'Full HD'], ['600x600', 'Passport (2x2)']]
    .map(([s, n]) => `<button type="button" class="chip-btn" data-preset="${s}">${n}</button>`).join('')}</p></div>
        <div data-mode-box="pct" hidden><label>Scale <span data-pct-val>50%</span><input type="range" data-pct min="5" max="100" step="1" value="50"></label></div>
        ${fmtSelect(t.mode === 'px')}
      </form>
    </div>
    <div class="rs-result" data-result hidden><img data-rimg alt="Resized image"><div><p class="rs-meta" data-rmeta></p><button type="button" class="btn btn-brand" data-dl>${icon('download')}Download</button></div></div>
    <div class="pt-bar"><p class="pt-msg" data-msg role="status" aria-live="polite"></p><button type="button" class="btn btn-brand pt-go" data-go>Resize image</button></div>
  </div>
  ${NOSCRIPT}
</section>`;
  }
  if (t.app === 'imgedit') {
    return `${open(` data-mode="${t.mode || 'crop'}"`)}
  ${dropBox(IMG_ACCEPT, 'Select image', 'or drop an image here &middot; JPG, PNG, WEBP, GIF, BMP', 'Your image never leaves your device')}
  <div class="pt-work" data-work hidden>
    ${fileBar('Choose another image')}
    <div class="ie-tools">
      <label>Crop shape<select data-aspect><option value="free">Free</option><option value="orig">Original</option><option value="1:1">Square 1:1</option><option value="4:5">Portrait 4:5 (Instagram)</option><option value="9:16">Story 9:16</option><option value="16:9">Wide 16:9</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="2:3">2:3</option></select></label>
      <span class="ie-btns"><button type="button" class="btn btn-ghost btn-sm" data-rot-l title="Rotate left">&#8634; Left</button><button type="button" class="btn btn-ghost btn-sm" data-rot-r title="Rotate right">&#8635; Right</button>
        <button type="button" class="btn btn-ghost btn-sm" data-flip-h>&#8596; Flip horizontal</button><button type="button" class="btn btn-ghost btn-sm" data-flip-v>&#8597; Flip vertical</button>
        <button type="button" class="pt-link" data-reset>Reset</button></span>
      <label class="ie-angle">Angle <span data-angle-val>0&deg;</span><input type="range" data-angle min="-180" max="180" step="1" value="0"></label>
    </div>
    <div class="ie-stage"><canvas data-canvas aria-label="Drag the box to move it, drag a corner to resize"></canvas></div>
    <div class="ie-tools"><label>Width (px)<input type="number" data-cw min="1"></label><label>Height (px)<input type="number" data-ch min="1"></label>
      ${fmtSelect()}<label>Corners after rotating<select data-bg><option value="clear">Transparent (PNG, WEBP)</option><option value="white">White</option></select></label></div>
    <div class="pt-bar"><p class="pt-msg" data-msg role="status" aria-live="polite"></p><span class="ie-size" data-size-note></span><button type="button" class="btn btn-brand pt-go" data-go>${icon('download')}Download image</button></div>
  </div>
  ${NOSCRIPT}
</section>`;
  }
  if (t.app === 'favicon') {
    return `${open()}
  <div class="fv-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-src-tab="image">From an image</button><button type="button" role="tab" aria-selected="false" data-src-tab="text">From text</button></div>
  <div data-src-box="image">${dropBox('image/*,.svg', 'Select image or logo', 'or drop it here &middot; PNG, SVG, JPG or WEBP, ideally square', 'Made in your browser, nothing is uploaded')}
    <p class="fv-fname" data-fname></p>
    <div class="pt-opts fv-opts"><label>Fit<select data-fit><option value="contain">Whole image</option><option value="cover">Fill the square</option></select></label>
      <label>Background<select data-fill><option value="none">Transparent</option><option value="color">Colour</option></select></label><label>Colour<input type="color" data-bgc2 value="#ffffff"></label></div></div>
  <div data-src-box="text" hidden><div class="pt-opts fv-opts">
    <label>Letters<input type="text" data-text maxlength="3" value="F"></label>
    <label>Font<select data-font><option value="system-ui, sans-serif">Sans</option><option value="Georgia, serif">Serif</option><option value="ui-monospace, monospace">Mono</option><option value="'Brush Script MT', cursive">Script</option></select></label>
    <label>Weight<select data-weight><option value="800">Bold</option><option value="500">Regular</option></select></label>
    <label>Background<input type="color" data-bgc value="#e5322d"></label><label>Text<input type="color" data-fgc value="#ffffff"></label></div></div>
  <div class="pt-opts fv-opts"><label>Shape<select data-shape><option value="square">Square</option><option value="rounded">Rounded</option><option value="circle">Circle</option></select></label>
    <label>Padding<input type="range" data-pad min="0" max="30" step="1" value="0"></label>
    <label>Website name (for the manifest)<input type="text" data-appname placeholder="My website" maxlength="60"></label></div>
  <div class="fv-out" data-out hidden>
    <div class="fv-preview" data-preview>${[16, 32, 48, 180, 192].map((s) => `<figure><canvas data-pv="${s}" width="${s}" height="${s}"></canvas><figcaption>${s} px</figcaption></figure>`).join('')}</div>
    <label class="fv-code">HTML to add inside &lt;head&gt;<textarea data-snippet rows="5" readonly spellcheck="false"></textarea></label>
    <div class="pt-bar"><button type="button" class="btn btn-ghost btn-sm" data-copy>Copy HTML</button><p class="pt-msg" data-msg role="status" aria-live="polite"></p><button type="button" class="btn btn-brand pt-go" data-go>${icon('download')}Download favicon.zip</button></div>
  </div>
  ${NOSCRIPT}
</section>`;
  }
  if (t.app === 'bgremove') {
    return `${open(` data-max-mb="${MAX_MB}"`)}
  ${dropBox(IMG_ACCEPT, 'Select photo', `or drop a photo here &middot; JPG, PNG, WEBP or HEIC, up to ${MAX_MB} MB`, 'Photos are deleted as soon as the background is removed')}
  <div class="pt-work" data-work hidden>
    ${fileBar('Choose another photo')}
    <progress class="pt-prog" data-prog max="1" value="0" hidden></progress>
    <div class="bg-result" data-result hidden>
      <div class="bg-stage"><canvas class="checker" data-canvas></canvas></div>
      <div class="pt-opts bg-opts"><fieldset class="pt-radios"><legend>Background</legend>
        <label><input type="radio" name="bg" value="transparent" checked> Transparent (PNG)</label>
        <label><input type="radio" name="bg" value="white"> White</label>
        <label><input type="radio" name="bg" value="color"> Colour <input type="color" data-color value="#2563eb"></label></fieldset>
        <button type="button" class="btn btn-ghost btn-sm" data-orig>Hold to see the original</button>
        <button type="button" class="btn btn-brand" data-dl>${icon('download')}Download</button></div>
    </div>
    <p class="pt-msg" data-msg role="status" aria-live="polite"></p>
  </div>
  ${NOSCRIPT}
</section>`;
  }
  if (t.app === 'vcompress') {
    const opts = [['10', 'Discord: under 10 MB'], ['25', 'Email: under 25 MB'], ['50', 'Under 50 MB'], ['custom', 'Custom size'], ['high', 'High quality (smaller)'], ['medium', 'Balanced (much smaller)'], ['low', 'Smallest file']];
    const def = String(t.targetMB || 'medium');
    return `${open(` data-max-mb="${MAX_VIDEO_MB}"`)}
  ${dropBox('video/*,.mkv,.mov,.avi,.wmv,.flv,.3gp,.ts,.mts', 'Select video', `or drop a video here &middot; MP4, MOV, WEBM, MKV, AVI, up to ${MAX_VIDEO_MB} MB`, 'Videos are deleted after 15 minutes')}
  <div class="pt-work" data-work hidden>
    ${fileBar('Choose another video')}
    <form class="pt-opts" autocomplete="off" onsubmit="return false">
      <fieldset class="pt-radios vc-opts"><legend>Make it</legend>${opts.map(([v, n]) => `<label><input type="radio" name="target" value="${v}"${v === def ? ' checked' : ''}> ${n}</label>`).join('')}</fieldset>
      <label data-custom hidden>Size (MB)<input type="number" data-mb min="1" max="2000" step="1" value="8"></label>
    </form>
    <progress class="pt-prog" data-prog max="1" value="0" hidden></progress>
    <div class="pt-bar"><p class="pt-msg" data-msg role="status" aria-live="polite"></p><button type="button" class="btn btn-brand pt-go" data-go>Compress video</button></div>
  </div>
  ${jobDone('Your video is ready', 'Compress another video')}
  ${NOSCRIPT}
</section>`;
  }
  if (t.app === 'trim') {
    const kind = t.kind || 'video';
    const accept = kind === 'video' ? 'video/*,.mkv,.mov,.avi,.wmv,.flv,.3gp,.ts,.mts' : 'audio/*,video/*,.mp3,.m4a,.wav,.flac,.ogg,.opus,.aac,.wma,.amr';
    const formats = kind === 'ringtone' ? [['m4r', 'iPhone ringtone (M4R)'], ['mp3', 'Android ringtone (MP3)']] : kind === 'audio' ? [['mp3', 'MP3'], ['m4a', 'M4A'], ['wav', 'WAV']] : [];
    const player = kind === 'video' ? '<video data-media controls playsinline preload="metadata"></video>' : '<audio data-media controls preload="metadata"></audio>';
    return `${open(` data-kind="${kind}" data-max-mb="${MAX_VIDEO_MB}"`)}
  ${dropBox(accept, kind === 'video' ? 'Select video' : 'Select audio or video', `or drop it here &middot; ${kind === 'video' ? 'MP4, MOV, WEBM, MKV' : 'MP3, M4A, WAV, FLAC or a video'}, up to ${MAX_VIDEO_MB} MB`, 'Files are deleted after 15 minutes')}
  <div class="pt-work" data-work hidden>
    ${fileBar()}
    <div class="tr-player">${player}<p class="pt-msg" data-nopreview hidden>This browser cannot play this format, so there is no preview. Type the start and end times; the cut is still made exactly.</p></div>
    <div class="tr-track" data-track><div class="tr-sel" data-sel></div><span class="tr-head" data-head></span>
      <button type="button" class="tr-h" data-h="s" aria-label="Start"></button><button type="button" class="tr-h" data-h="e" aria-label="End"></button></div>
    <div class="tr-times">
      <label>Start<input type="text" data-start inputmode="decimal" value="0:00.0"></label><button type="button" class="btn btn-ghost btn-sm" data-set-s>Set to current</button>
      <label>End<input type="text" data-end inputmode="decimal" value="0:00.0"></label><button type="button" class="btn btn-ghost btn-sm" data-set-e>Set to current</button>
      <button type="button" class="btn btn-ghost btn-sm" data-play-sel>&#9654; Play selection</button><span class="tr-len" data-len></span>
    </div>
    ${kind === 'video' ? '' : `<div class="pt-opts tr-opts"><fieldset class="pt-radios"><legend>Save as</legend>${formats.map(([v, n], i) => `<label><input type="radio" name="fmt" value="${v}"${i === 0 ? ' checked' : ''}> ${n}</label>`).join('')}</fieldset>
      <fieldset class="pt-radios"><legend>Fade</legend><label><input type="checkbox" data-fade-in${kind === 'ringtone' ? ' checked' : ''}> Fade in</label><label><input type="checkbox" data-fade-out${kind === 'ringtone' ? ' checked' : ''}> Fade out</label></fieldset></div>`}
    <progress class="pt-prog" data-prog max="1" value="0" hidden></progress>
    <div class="pt-bar"><p class="pt-msg" data-msg role="status" aria-live="polite"></p><button type="button" class="btn btn-brand pt-go" data-go>${kind === 'video' ? 'Cut video' : kind === 'ringtone' ? 'Make ringtone' : 'Cut audio'}</button></div>
  </div>
  ${jobDone(kind === 'video' ? 'Your video is ready' : kind === 'ringtone' ? 'Your ringtone is ready' : 'Your audio is ready', 'Start over')}
  ${NOSCRIPT}
</section>`;
  }
  if (t.app === 'words') {
    const stats = [['words', 'Words'], ['chars', 'Characters'], ['nospace', 'Characters without spaces'], ['sentences', 'Sentences'], ['paragraphs', 'Paragraphs'], ['read', 'Reading time'], ['speak', 'Speaking time'], ['avg', 'Average word length'], ['pages', 'Pages (500 words each)']];
    const order = t.focus === 'chars' ? ['chars', 'nospace', 'words', ...stats.map((s) => s[0]).filter((k) => !['chars', 'nospace', 'words'].includes(k))] : stats.map((s) => s[0]);
    const limits = [[280, 'X (Twitter) post'], [60, 'Google title'], [160, 'Meta description'], [160, 'SMS text'], [2200, 'Instagram caption'], [3000, 'LinkedIn post'], [100, 'YouTube title'], [5000, 'YouTube description']];
    return `${open()}
  <div class="wc-grid">
    <div class="wc-main"><textarea class="wc-text" data-text rows="14" placeholder="Type or paste your text here" aria-label="Your text"></textarea>
      <div class="wc-bar"><span>${[['upper', 'UPPERCASE'], ['lower', 'lowercase'], ['title', 'Title Case'], ['sentence', 'Sentence case']].map(([k, n]) => `<button type="button" class="btn btn-ghost btn-sm" data-case="${k}">${n}</button>`).join('')}</span>
        <span><button type="button" class="btn btn-ghost btn-sm" data-copy>Copy</button><button type="button" class="btn btn-ghost btn-sm" data-clear>Clear</button></span></div>
      <p class="pt-msg" data-msg role="status" aria-live="polite"></p></div>
    <aside class="wc-side"><dl class="wc-stats">${order.map((k) => `<div><dt>${stats.find((s) => s[0] === k)[1]}</dt><dd data-stat="${k}">0</dd></div>`).join('')}</dl>
      <h3>Character limits</h3><ul class="wc-limits">${limits.map(([n, l]) => `<li data-limit="${n}"><span>${l} <small>(${n.toLocaleString('en-US')})</small></span><progress></progress><small data-left></small></li>`).join('')}</ul>
      <h3>Most used words</h3><ol class="wc-kw" data-kw></ol></aside>
  </div>
  ${NOSCRIPT}
</section>`;
  }
  if (t.app === 'signature') {
    return `${open()}
  <div class="fv-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-mode-tab="draw">Draw</button><button type="button" role="tab" aria-selected="false" data-mode-tab="type">Type</button></div>
  <div class="sg-pens">Ink ${[['#111827', 'Black'], ['#1d3fb8', 'Blue'], ['#0b1f5c', 'Dark blue']].map(([c, n], i) => `<button type="button" class="sg-pen" data-pen="${c}" style="background:${c}" aria-label="${n}" aria-pressed="${i === 0}"></button>`).join('')}
    <label>Thickness<input type="range" data-thick min="1" max="8" step="0.5" value="3"></label></div>
  <div data-mode-box="draw"><div class="sg-padwrap"><canvas class="sg-pad" data-pad></canvas><p class="sg-hint" data-hint>Sign here with your mouse, finger or stylus</p></div>
    <div class="sg-row"><button type="button" class="btn btn-ghost btn-sm" data-undo>Undo</button><button type="button" class="btn btn-ghost btn-sm" data-clear>Clear</button></div></div>
  <div data-mode-box="type" hidden><label class="sg-name">Your name<input type="text" data-name maxlength="40" placeholder="Your Name" autocomplete="name"></label>
    <div class="sg-fonts">${SIG_FONTS.map(([id, n], i) => `<button type="button" class="sg-font" data-font-opt="${id}" aria-pressed="${i === 0}" title="${n}"><span>Your Name</span></button>`).join('')}</div></div>
  <div class="pt-bar"><p class="pt-msg" data-msg role="status" aria-live="polite"></p><button type="button" class="btn btn-ghost" data-dl-jpg>${icon('download')}JPG (white)</button><button type="button" class="btn btn-brand pt-go" data-dl-png>${icon('download')}Transparent PNG</button></div>
  ${NOSCRIPT}
</section>`;
  }
  // cover letter
  const f = (name, label, ph = '', type = 'text') => `<label>${label}<input type="${type}" data-f="${name}" placeholder="${esc(ph)}"></label>`;
  return `${open()}
  <form class="cl-form" autocomplete="off" onsubmit="return false">
    <fieldset><legend>About you</legend><div class="cl-grid">${f('name', 'Full name', 'Jane Smith')}${f('email', 'Email', 'jane@email.com', 'email')}${f('phone', 'Phone', '(555) 123-4567')}${f('city', 'City', 'Austin, TX')}${f('link', 'LinkedIn or website', 'linkedin.com/in/janesmith')}${f('date', 'Date', '', 'date')}</div></fieldset>
    <fieldset><legend>The job</legend><div class="cl-grid">${f('job', 'Job title', 'Marketing Coordinator')}${f('company', 'Company', 'Acme Inc.')}${f('manager', 'Hiring manager (if known)', 'Ms. Taylor Brown')}${f('address', 'Company address (optional)', '100 Market St, Austin, TX')}</div></fieldset>
    <fieldset><legend>Write it for me</legend><div class="cl-grid">
      <label>Letter style<select data-f="style"><option value="professional">Experienced professional</option><option value="entry">Student or first job</option><option value="change">Career change</option></select></label>
      ${f('years', 'Years of experience', '5', 'number')}${f('field', 'Your field or degree', 'digital marketing')}${f('skills', 'Top skills', 'social media, SEO and content writing')}
      ${f('achievement', 'One achievement (optional)', 'I grew our email list by 40% in one year')}${f('why', 'Why this company? (optional)', 'your focus on sustainable products')}</div>
      <button type="button" class="btn btn-ghost" data-write>Write my letter</button></fieldset>
    <label class="cl-body">Your letter (edit freely; leave a blank line between paragraphs)<textarea data-f="body" rows="14" placeholder="Click 'Write my letter' for a first draft, or write your own."></textarea></label>
    <div class="pt-bar"><label class="inv-paper">Paper<select data-f="paper"><option value="letter">US Letter</option><option value="a4">A4</option></select></label>
      <button type="button" class="btn btn-ghost btn-sm" data-copy>Copy text</button><p class="pt-msg" data-msg role="status" aria-live="polite"></p>
      <button type="button" class="btn btn-ghost" data-docx>${icon('download')}Word (DOCX)</button><button type="button" class="btn btn-brand pt-go" data-pdf>${icon('download')}PDF</button></div>
  </form>
  ${NOSCRIPT}
</section>`;
}

function appBox(t) {
  if (TOOLS_JS.has(t.app)) return toolBox(t);
  if (t.app === 'passport') {
    return `<section class="app app-passport" id="app" data-app="passport">
  <div class="pt-drop" data-drop>
    <input type="file" accept="image/*,.heic,.heif" data-input hidden>
    ${icon('upload', 'pt-drop-ico')}
    <button class="btn btn-brand btn-select" type="button" data-pick>${icon('upload')}Select photo</button>
    <p class="pt-drop-sub">or drop a photo here &middot; JPG, PNG, WEBP or HEIC</p>
    <p class="pt-private">${icon('shield')}Your photo never leaves your device</p>
  </div>
  <div class="pp-work" data-work hidden>
    <div class="pp-stage"><canvas class="pp-canvas" data-canvas width="600" height="600" aria-label="Drag to move the photo, scroll or pinch to zoom"></canvas><p class="pp-hint">Drag to move &middot; scroll, pinch or use the slider to zoom. Top of head on the upper line, chin on the lower line.</p></div>
    <form class="pp-opts" autocomplete="off" onsubmit="return false">
      <label>Country and document<select data-size>${PASSPORT_SPECS.map(([group, list]) => `<optgroup label="${esc(group)}">${list
        .map((x) => `<option value="${x.id}" data-w="${x.w}" data-h="${x.h}" data-hmin="${x.head[0]}" data-hmax="${x.head[1]}"${x.px ? ` data-px="${x.px.join('x')}"` : ''}>${esc(x.country)} \u2013 ${esc(x.doc)} (${photoSize(x)})</option>`).join('')}</optgroup>`).join('')}
        <optgroup label="Other"><option value="custom">Custom size (any country)</option></optgroup></select></label>
      <div class="pp-custom" data-custom hidden><label>Width (mm)<input type="number" data-cw min="20" max="100" step="1" value="35"></label><label>Height (mm)<input type="number" data-ch min="20" max="100" step="1" value="45"></label></div>
      <p class="pp-spec" data-spec aria-live="polite"></p>
      <label>Zoom<input type="range" data-zoom min="0.2" max="4" step="0.01" value="1"></label>
      <label>Straighten<input type="range" data-rot min="-15" max="15" step="0.5" value="0"></label>
      <label>Brightness<input type="range" data-bright min="70" max="140" step="1" value="100"></label>
      <div class="pp-btns">
        <button type="button" class="btn btn-brand" data-dl-photo>${icon('download')}Digital photo (JPG)</button>
        <button type="button" class="btn btn-ghost" data-dl-sheet>${icon('download')}4x6 print sheet</button>
        <button type="button" class="pt-link" data-again>Choose another photo</button>
      </div>
      <p class="pt-msg" data-msg role="status" aria-live="polite"></p>
    </form>
  </div>
  <noscript><p class="pt-msg">This tool needs JavaScript. Please turn it on and reload the page.</p></noscript>
</section>`;
  }
  if (t.app === 'ocr') {
    const langs = OCR_LANGS();
    const pdfFirst = t.accept === 'pdf';
    return `<section class="app app-ocr" id="app" data-app="ocr" data-max-mb="${MAX_MB}">
  <div class="pt-drop" data-drop>
    <input type="file" accept="image/*,.heic,.heif,application/pdf,.pdf" data-input hidden>
    ${icon('upload', 'pt-drop-ico')}
    <button class="btn btn-brand btn-select" type="button" data-pick>${icon('upload')}Select file</button>
    <p class="pt-drop-sub">or drop ${pdfFirst ? 'a scanned PDF or an image' : 'an image or a scanned PDF'} here &middot; up to ${MAX_MB} MB</p>
    <p class="pt-private">${icon('shield')}Files are deleted as soon as the text is read</p>
  </div>
  <div class="pt-work" data-work hidden>
    <div class="pt-filebar">${icon('file')}<span class="pt-fname" data-fname></span><span class="pt-fmeta" data-fmeta></span><button type="button" class="pt-link" data-again>Choose another file</button></div>
    <form class="pt-opts" autocomplete="off" onsubmit="return false">
      <label>Language<select data-lang>${(langs.length ? langs : [['eng', 'English']]).map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}</select></label>
      <fieldset class="pt-radios"><legend>Result</legend>
        <label><input type="radio" name="fmt" value="txt"${pdfFirst ? '' : ' checked'}> Text (copy or TXT)</label>
        <label><input type="radio" name="fmt" value="pdf"${pdfFirst ? ' checked' : ''}> Searchable PDF</label></fieldset>
    </form>
    <div class="pt-bar"><p class="pt-msg" data-msg role="status" aria-live="polite"></p><button type="button" class="btn btn-brand pt-go" data-go>Read text</button></div>
  </div>
  <div class="ocr-out" data-out hidden>
    <div class="ocr-out-bar"><strong data-out-title>Text</strong><span class="ocr-btns"><button type="button" class="btn btn-ghost btn-sm" data-copy>Copy text</button><a class="btn btn-brand btn-sm" data-dl href="#" download>${icon('download')}Download TXT</a><button type="button" class="pt-link" data-again>New file</button></span></div>
    <textarea class="ocr-text" data-text rows="14" spellcheck="false" aria-label="Recognised text"></textarea>
  </div>
  <div class="pt-done" data-done hidden>
    <span class="pt-done-ico" aria-hidden="true">&#10003;</span>
    <h2 class="pt-done-h">Your searchable PDF is ready</h2>
    <p class="pt-done-text" data-done-text></p>
    <div class="pt-done-btns"><a class="btn btn-brand" data-dl-pdf href="#" download>${icon('download')}Download PDF</a><button type="button" class="btn btn-ghost" data-again>Start over</button></div>
  </div>
  <noscript><p class="pt-msg">This tool needs JavaScript. Please turn it on and reload the page.</p></noscript>
</section>`;
  }
  // invoice
  const cur = [['USD', '$', 'US dollar'], ['EUR', '\u20ac', 'Euro'], ['GBP', '\u00a3', 'British pound'], ['CAD', 'C$', 'Canadian dollar'], ['AUD', 'A$', 'Australian dollar'],
    ['NZD', 'NZ$', 'New Zealand dollar'], ['CHF', 'CHF ', 'Swiss franc'], ['INR', 'Rs. ', 'Indian rupee'], ['PKR', 'Rs ', 'Pakistani rupee'], ['AED', 'AED ', 'UAE dirham'], ['SAR', 'SAR ', 'Saudi riyal']];
  const f = (name, label, ph = '', type = 'text') => `<label>${label}<input type="${type}" data-f="${name}" placeholder="${esc(ph)}"></label>`;
  const ta = (name, label, ph = '') => `<label>${label}<textarea data-f="${name}" rows="3" placeholder="${esc(ph)}"></textarea></label>`;
  return `<section class="app app-invoice" id="app" data-app="invoice">
  <form class="inv-form" autocomplete="off" onsubmit="return false">
    <div class="inv-row inv-top">
      <div class="inv-logo"><input type="file" accept="image/png,image/jpeg,image/webp" data-logo-input hidden><button type="button" class="btn btn-ghost btn-sm" data-logo>${icon('image')}Add logo</button><img data-logo-img alt="" hidden><button type="button" class="pt-link" data-logo-del hidden>Remove logo</button></div>
      <div class="inv-meta">${f('number', 'Invoice number', 'INV-0001')}${f('date', 'Invoice date', '', 'date')}${f('due', 'Due date', '', 'date')}</div>
    </div>
    <div class="inv-row inv-parties">
      <fieldset><legend>From (your business)</legend>${f('fromName', 'Name', 'Your business name')}${ta('fromAddr', 'Address, email, phone, tax number', '123 Main St, Austin, TX 78701\nhello@yourbusiness.com')}</fieldset>
      <fieldset><legend>Bill to (your client)</legend>${f('toName', 'Name', 'Client name')}${ta('toAddr', 'Address and email', 'Client address\nclient@email.com')}</fieldset>
    </div>
    <div class="inv-items-wrap"><table class="inv-items"><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th><th aria-label="Remove"></th></tr></thead><tbody data-items></tbody></table>
      <button type="button" class="btn btn-ghost btn-sm" data-add>+ Add item</button></div>
    <div class="inv-row inv-bottom">
      <div class="inv-notes">${ta('notes', 'Notes and payment details', 'Payment by bank transfer or PayPal within 30 days. Thank you for your business!')}${f('terms', 'Payment terms', 'Net 30')}</div>
      <div class="inv-sum">
        <label>Currency<select data-f="currency">${cur.map(([c, sym, n]) => `<option value="${c}" data-sym="${esc(sym)}">${c} (${n})</option>`).join('')}</select></label>
        <label>Tax rate (%)<input type="number" data-f="tax" min="0" step="0.01" placeholder="0"></label>
        <label>Discount (%)<input type="number" data-f="discount" min="0" max="100" step="0.01" placeholder="0"></label>
        <label>Shipping<input type="number" data-f="shipping" min="0" step="0.01" placeholder="0"></label>
        <label>Amount paid<input type="number" data-f="paid" min="0" step="0.01" placeholder="0"></label>
        <dl class="inv-totals" data-totals></dl>
      </div>
    </div>
    <div class="pt-bar inv-bar"><label class="inv-paper">Paper<select data-f="paper"><option value="letter">US Letter</option><option value="a4">A4</option></select></label>
      <button type="button" class="pt-link" data-new>New invoice</button>
      <p class="pt-msg" data-msg role="status" aria-live="polite"></p>
      <button type="button" class="btn btn-brand pt-go" data-pdf>${icon('download')}Download invoice PDF</button></div>
  </form>
  <noscript><p class="pt-msg">This tool needs JavaScript. Please turn it on and reload the page.</p></noscript>
</section>`;
}

const TOOLS_JS = new Set(['resize', 'imgedit', 'favicon', 'bgremove', 'vcompress', 'trim', 'words', 'signature', 'cover']);
const IN_BROWSER = '<strong>How this works:</strong> everything happens in your browser with open-source code. Nothing is uploaded to our server and nothing is stored.';
const APP_PRIVACY = {
  resize: IN_BROWSER, imgedit: IN_BROWSER, favicon: IN_BROWSER, words: '<strong>How this works:</strong> your text is counted in your browser and never sent to our server. It is kept only in this browser so it is still here if you reload the page.',
  signature: IN_BROWSER, cover: '<strong>How this works:</strong> the letter is written and saved as PDF or Word in your browser. Your details are kept only in this browser for next time; nothing is sent to our server.',
  bgremove: '<strong>How this works:</strong> your photo is uploaded over HTTPS and processed on this server with an open-source image segmentation model (IS-Net), in memory. Nothing is kept or shared.',
  vcompress: '<strong>How this works:</strong> your video is uploaded over HTTPS and re-encoded on this server with FFmpeg. The upload is deleted when the work is done and the result 15 minutes later.',
  trim: '<strong>How this works:</strong> the file is uploaded over HTTPS and cut on this server with FFmpeg. The upload is deleted when the work is done and the result 15 minutes later.',
  passport: '<strong>How this works:</strong> your photo is cropped and sized in your browser. It is never uploaded to our server and nothing is stored.',
  ocr: '<strong>How this works:</strong> your file is uploaded over HTTPS and read on this server with Tesseract, the open-source OCR engine, in a private temporary folder that is deleted as soon as the text is ready. Nothing is kept or shared.',
  invoice: '<strong>How this works:</strong> the invoice is built in your browser with open-source code (pdf-lib) and saved straight to your device. Your details are kept only in this browser so the next invoice is quicker; nothing is sent to our server.',
};
function appPage(slug, base) {
  const t = APP_BY_SLUG.get(slug);
  const passportTable = t.app === 'passport' ? passportTableHtml() : '';
  if (!knownPaths) knownPaths = new Set(allPaths());
  const p = `/${t.slug}`;
  const crumbs = [['Home', '/'], [t.name, p]];
  const see = t.see.filter((s) => knownPaths.has(s)).map((s) => [s, esc(toolName(s)), true]);
  const steps = `<section class="howto"><h2>${esc(t.howto)}</h2><ol class="steps">${t.steps
    .map(([a, d]) => `<li><strong>${a}</strong> ${d}</li>`).join('')}</ol></section>`;
  const other = MENU_APPS.filter((x) => x.slug !== t.slug && !t.see.includes(`/${x.slug}`)).map((x) => [`/${x.slug}`, esc(x.name), true]);
  return renderPage(PAGE_TPL, baseFields(base, p, `${t.title} | ${SITE}`, t.desc, {
    JSONLD: graph(base, p, t.h1, t.desc, t.faq, crumbs, { features: [t.browser ? 'Runs in the browser, no upload' : 'Files deleted after processing', 'No sign-up', 'No watermark', 'Free'] }),
    HERO: hero({ h1: t.h1, crumbs, intro: t.intro }),
    TOOL: appBox(t),
    CONTENT: steps + usesHtml(p, t.name) + t.sections.map(([h, html]) => `<section class="notes prose-block"><h2>${esc(h)}</h2>${liveLinks(html.replace('{{PASSPORT_TABLE}}', passportTable))}</section>`).join('')
      + `<section class="related-tools"><h2>Related tools</h2>${chips([...see, ...other])}</section>`
      + readMore(p) + faqHtml(t.faq),
    PRIVACY: APP_PRIVACY[t.app],
    SCRIPTS: `${t.app === 'invoice' || t.app === 'cover' ? `<script src="/vendor/pdf-lib.min.js?v=${seo.ASSET_V.pdfTools}" defer></script>\n` : ''}${TOOLS_JS.has(t.app)
      ? `<script type="module" src="/tools.js?v=${seo.ASSET_V.tools}"></script>` : `<script type="module" src="/apps.js?v=${seo.ASSET_V.apps}"></script>`}\n`,
  }));
}
const resolveApp = (slug, base) => (APP_BY_SLUG.has(slug) ? { html: appPage(slug, base) } : null);

function resolvePdfTool(slug, base) {
  if (slug === 'pdf-tools') return { html: pdfToolsHub(base) };
  return PDF_TOOL_BY_SLUG.has(slug) ? { html: pdfToolPage(slug, base) } : null;
}

function compressPage(slug, base) {
  const f = F(slug), p = compressPath(slug);
  const c = registry.getCompressor(slug, ANY);
  const others = ALL_COMPRESSORS.filter((x) => x.from !== slug).map((x) => [x.route, `Compress ${F(x.from).label}`, x.status === 'live']);
  const items = ALL_COMPRESSORS.map((x) => ({ id: x.from, href: x.route, live: x.status === 'live' }));
  const widget = `<div class="convert-row"><span class="convert-word">compress</span>${picker(f.label, groupByCategory(items), { current: slug })}</div>`;

  if (c.status !== 'live') {
    const title = `Compress ${f.label} - Free Online ${f.label} Compressor | ${SITE}`;
    return renderPage(PAGE_TPL, noindex(baseFields(base, p, title, `Reduce the file size of ${f.label} files online.`, {
      HERO: hero({ h1: `Compress ${f.label} Files Online`, crumbs: [['Home', '/'], ['Converters', '/converters'], [`Compress ${f.label}`, p]], intro: `Make ${f.name} files smaller. This tool is on our roadmap and not available on this server yet.`, widget }),
      TOOL: soonBox(`${f.label} compression is coming soon`, 'We only switch a tool on once it really works.', COMPRESSIBLE.map((s) => [compressPath(s), `Compress ${F(s).label}`, true])),
      CONTENT: `<section class="fcards" aria-label="About the format">${cardHtml(slug)}</section>`,
      RELATED: `<section class="related"><h2>Related tools</h2>${chips(others)}</section>`,
    })));
  }

  const meta = registry.getCompressMetadata(slug, { siteName: SITE });
  const kw = KEYWORDS[p];
  let { title, description } = meta;
  if (kw) {
    const name = kwCase(kw.primary), alt = kw.secondary.find((x) => x.startsWith('reduce'));
    title = `${name}${alt ? ` - ${kwCase(alt)}` : ''} Online Free | ${SITE}`;
    description = `${name} online for free with our ${kwCase(kw.secondary[0], false)}. ${isImageFmt(slug)
      ? 'Make files up to 90% smaller' : 'Choose from four compression levels'}, compress many files at once and download a ZIP. No sign-up.`;
  }
  const faq = [
    ...(kw && kw.faq ? kw.faq : []),
    isImageFmt(slug)
      ? [`How do I compress a ${f.label} file?`, `Click Select File or drop your ${f.name} files onto the upload box, open Options to choose how much smaller each file should be (50% by default) and, if you like, a maximum size. The list shows the original and new size of every file.`]
      : [`How do I compress a ${f.label} file?`, `Click Select File or drop your ${f.name} files onto the upload box and open Options to choose Light, Recommended, Strong or Extreme compression. The list shows the original and new size of every file.`],
    isImageFmt(slug)
      ? [`How much smaller will my ${f.label} be?`, 'It depends on the image and your settings. Photographs usually shrink the most and simple graphics the least. The list shows the exact before and after size for every file.']
      : [`How much smaller will my ${f.label} be?`, `It depends on what is inside. ${f.label} files full of photos or scans shrink the most, often by 70 to 95% with Strong or Extreme; files that are mostly text are already small and change less. The list shows the exact before and after size.`],
    ...FAQ_COMMON,
  ];
  const conv = outputsFor(slug).slice(0, 6).map((o) => [pairPath(slug, o), pairLabel(slug, o), true]);
  return renderPage(PAGE_TPL, baseFields(base, p, title, description, {
    JSONLD: graph(base, p, meta.schemaName, description, faq, meta.breadcrumbs, { features: TOOL_FEATURES }),
    DEFAULT_FORMAT: f.select,
    HERO: hero({ h1: meta.h1, crumbs: meta.breadcrumbs,
      intro: isImageFmt(slug)
        ? `Make your ${f.name} images smaller without fuss. Upload one file or many, choose how much smaller they should be, and download the compressed versions individually or as a ZIP. No sign-up needed.`
        : `Make your ${f.name} files smaller without fuss. Upload one file or many, choose Light, Recommended, Strong or Extreme compression, and download the compressed versions individually or as a ZIP. No sign-up needed.`,
      widget, withSelect: true }),
    TOOL: toolHtml({ inputs: [slug], outputs: [slug], compress: true, dropTitle: `Drop your ${f.label} files here`, dropSub: `or click to choose ${f.label} files` }),
    CONTENT: howToSteps(f.label, '', 'compress', isImageFmt(slug)) + usesHtml(p, `compressing ${f.label} files`) + `<section class="fcards" aria-label="About the format">${cardHtml(slug)}</section>` + readMore(p) + faqHtml(faq),
    RELATED: `<section class="related"><h2>Related tools</h2>${chips([...others, ...conv])}</section>`,
  }));
}

function formatPage(slug, base) {
  const f = F(slug), p = formatPath(slug);
  const fmt = registry.getFormat(slug);
  const live = formatIsLive(slug);
  const outs = outputsFor(slug, ANY);
  const ins = inputsFor(slug, ANY);
  const title = `${f.label} Converter - Convert ${f.label} Files Online | ${SITE}`;
  const desc = `Convert ${f.label} (${f.full}) files to and from ${outs.length + ins.length > 0 ? `${[...new Set([...outs, ...ins])].length} other formats` : 'other formats'}. Free, no sign-up.`;
  const widget = convertRow(anyInputPicker(ALL_INPUTS, fmt.input ? slug : null), fmt.input ? outputPicker(slug, null) : emptyToPicker());
  const liveOuts = outputsFor(slug);
  const canCompress = COMPRESSIBLE.includes(slug);

  const sections = [
    `<section class="fcards" aria-label="About the format">${cardHtml(slug)}</section>`,
    live ? compareTable([slug]) : '',
    outs.length ? `<section class="conv-section"><h2>Convert ${f.label} to&hellip;</h2>${conversionLists(slug, 'out')}</section>` : '',
    ins.length ? `<section class="conv-section"><h2>Convert to ${f.label} from&hellip;</h2>${conversionLists(slug, 'in')}</section>` : '',
  ].join('');
  const crumbs = [['Home', '/'], ['Converters', '/converters'], [`${f.label} Converter`, p]];
  const faq = live ? FAQ_COMMON : FAQ_CATALOG;
  const fields = baseFields(base, p, title, desc, {
    JSONLD: live ? graph(base, p, `${f.label} Converter`, desc, faq, crumbs, { features: TOOL_FEATURES }) : '{}',
    HERO: hero({ h1: `${f.label} Converter`, crumbs,
      intro: `${esc(fmt.fullName)} &mdash; convert ${f.label} files to and from other formats.${live ? '' : ' Conversions for this format are coming soon.'}`,
      widget, withSelect: liveOuts.length > 0 }),
    TOOL: liveOuts.length
      ? toolHtml({ inputs: [slug], outputs: liveOuts, dropTitle: `Drop your ${f.label} files here`, dropSub: `or click to choose ${f.label} files` })
      : '',
    CONTENT: conversionMap(ALL_INPUTS) + sections + faqHtml(faq),
    RELATED: canCompress ? `<section class="related"><h2>Related tools</h2>${chips([[compressPath(slug), `Compress ${f.label}`, true]])}</section>` : '',
  });
  return renderPage(PAGE_TPL, !live ? noindex(fields) : formatIndexable(slug) ? fields : notIndexed(fields));
}

function categoryPage(catId, base) {
  const c = registry.getCategory(catId), p = categoryPath(catId);
  const fmts = registry.getFormatsByCategory(catId);
  const live = categoryIsLive(catId);
  const ins = registry.getInputFormats({ ...ANY, category: catId }).map((x) => x.id);
  const kw = KEYWORDS[p];
  const alt = kw && kw.secondary.find((x) => !/\bonline\b/.test(x) && x !== kw.primary);
  const title = fitTitle(c.converterName, alt && kwCase(alt));
  const desc = kw ? `Free online ${kw.primary}. ${c.description} ${fmts.length} formats, no sign-up.` : `${c.description} ${fmts.length} formats. Free, no sign-up.`;
  const widget = convertRow(anyInputPicker(ins, null), emptyToPicker());
  const liveIns = LIVE_INPUTS.filter((i) => F(i).category === catId); // primary category only (GIF is not a video tool)
  const fmtGrid = `<section class="conv-section"><h2>Supported ${c.name.toLowerCase()} formats</h2><div class="fmt-cards">${fmts.map((f) =>
    `<a class="fmt-card" href="${formatPath(f.id)}">${ficon(f.id, 'md')}<strong>${f.label}</strong><span>${esc(f.fullName)}</span>${formatIsLive(f.id) ? '<em class="badge badge-live">Live</em>' : '<em class="badge badge-soon">Soon</em>'}</a>`).join('')}</div></section>`;
  const livePairs = registry.getConverters({ fromCategory: catId });
  const liveSection = livePairs.length
    ? `<section class="conv-section"><h2>Available right now</h2>${chips(livePairs.map((x) => [x.route, pairLabel(x.from, x.to), true]))}</section>` : '';
  const crumbs = [['Home', '/'], ['Converters', '/converters'], [c.converterName, p]];
  const faq = live ? FAQ_COMMON : FAQ_CATALOG;
  const fields = baseFields(base, p, title, desc, {
    JSONLD: live ? graph(base, p, c.converterName, desc, faq, crumbs, { features: TOOL_FEATURES }) : '{}',
    HERO: hero({ h1: c.converterName, crumbs, intro: `${esc(c.description)}${live ? '' : ' These conversions are on our roadmap and coming soon.'}`, widget, withSelect: liveIns.length > 0 }),
    TOOL: liveIns.length ? anyTool(liveIns) : '',
    CONTENT: conversionMap(ins) + fmtGrid + liveSection + faqHtml(faq),
  });
  return renderPage(PAGE_TPL, live ? fields : noindex(fields));
}

function homePage(base) {
  const title = `File Converter - Convert Any File Online Free | ${SITE}`;
  const desc = `Free online file converter for video, audio, images, documents, ebooks, archives and fonts. ${LIVE_COUNT.toLocaleString('en-US')} conversions, batch upload, no sign-up.`;
  const faq = [...FAQ_CATALOG, ...FAQ_COMMON];
  return renderPage(PAGE_TPL, baseFields(base, '/', title, desc, {
    TOPBAR: topbar(true),
    JSONLD: graph(base, '/', `${SITE} File Converter`, desc, faq, [['Home', '/']], { features: TOOL_FEATURES }),
    HERO: hero({ h1: 'File Converter',
      intro: `${SITE} is an online file converter. We support ${LIVE_COUNT.toLocaleString('en-US')} conversions between audio, video, document, ebook, archive, image, spreadsheet, presentation and font formats. To get started, choose your formats or use the button below to select files from your computer.`,
      widget: convertRow(anyInputPicker(ALL_INPUTS, null), emptyToPicker()), withSelect: true }),
    TOOL: anyTool(),
    CONTENT: conversionMap(ALL_INPUTS) + featuresHtml() + popularCards() + categoryCards() + faqHtml(faq),
  }));
}

function hubPage(base) {
  const sections = CATS.map((c) => {
    const items = registry.getFormatsByCategory(c.id).map((f) => [formatPath(f.id), `${f.label} <small>${esc(f.fullName)}</small>`, formatIsLive(f.id)]);
    return `<section id="cat-${c.id}" class="hub-section"><h2>${icon(c.icon)}${link(categoryPath(c.id), c.converterName)}</h2>${chips(items)}</section>`;
  }).join('');
  const liveSection = `<section id="available" class="hub-section"><h2>Available right now</h2><p class="section-note">${LIVE_SUMMARY}. Pick a format to see everything it converts to.</p>${chips(LIVE_INPUTS.map((i) =>
    [formatPath(i), `${F(i).label} <small>${outputsFor(i).length} conversions</small>`, true]))}</section>`;
  const comp = `<section id="compress" class="hub-section"><h2>${icon('compress')}Compress</h2>${chips(ALL_COMPRESSORS.map((x) => [x.route, `Compress ${F(x.from).label}`, x.status === 'live']))}</section>`;
  const jump = `<nav class="jump" aria-label="Categories">${CATS.map((c) => `<a href="#cat-${c.id}">${c.name}</a>`).join('')}<a href="#available">Available now</a></nav>`;
  const title = `All File Formats and Converters | ${SITE}`;
  const desc = `Every format we convert or plan to convert, grouped by category: ${FORMAT_COUNT} formats and ${TOTAL_COUNT.toLocaleString('en-US')} conversions.`;
  const crumbs = [['Home', '/'], ['Converters', '/converters']];
  return renderPage(HUB_TPL, baseFields(base, '/converters', title, desc, {
    JSONLD: graph(base, '/converters', 'All file formats', desc, null, crumbs, { type: 'CollectionPage' }),
    HERO: hero({ h1: 'All formats', crumbs, intro: `${FORMAT_COUNT} formats and ${TOTAL_COUNT.toLocaleString('en-US')} conversions. ${LIVE_COUNT.toLocaleString('en-US')} conversions work today; formats marked <span class="soon-tag">soon</span> are on the roadmap.`, short: true }),
    BODY: jump + liveSection + comp + sections,
  }));
}

// PDF editor: the app itself is static markup (views/editor-app.html) driven by public/editor.js.
const EDITOR_FAQ = [
  ['Is the PDF editor free?', process.env.ACCOUNTS === '1' ? 'Yes. Editing is free and needs no account. To download your PDF you create a free account with your email or Google; there is no watermark and nothing to pay.' : 'Yes. Editing and downloading are free, with no sign-up and no watermark.'],
  ['Is my PDF uploaded to a server?', 'No. The editor runs in your browser, so the PDF is opened, edited and saved on your own device and never sent to us.'],
  ['Can I change the existing text in a PDF?', 'Yes. Choose Edit text and click a line of text. It is covered and retyped so you can change it. The replacement uses Helvetica, Times or Courier, so a special font may look slightly different, and the original text stays hidden underneath in the file. Scanned PDFs only contain pictures of text; type over them with the Text tool instead.'],
  ['Can I replace or move an image in a PDF?', 'Yes. Choose Edit image and click a picture in the PDF. You can replace it with your own image, move or resize it, or remove it.'],
  ['How do I sign a PDF?', 'Click Sign, draw your signature with the mouse or your finger, or type your name, then place and resize it on the page and download the PDF.'],
  ['Can I add, delete, rotate or reorder pages?', 'Yes. Use the buttons on each page in the side bar, drag pages to reorder them, add blank pages or image pages, and use Merge to add the pages of another PDF.'],
  ['Can I create a new PDF from scratch?', 'Yes. Choose Create a new PDF, pick the page size, then add text, images, shapes and more pages.'],
  ['Can I use whiteout to remove private information?', 'No. Whiteout and Edit text cover content so it is not visible, but the original text is still inside the file and can be copied out. Do not use them to remove passwords, account numbers or other private data.'],
  ['Which fonts can I use?', 'More than 150: Helvetica, Times and Courier plus popular Google Fonts such as Roboto, Montserrat, Playfair Display, Lobster and Dancing Script. The font you pick is embedded in the PDF, so it looks the same on every device.'],
  ['Can I type in Urdu or Arabic?', 'Yes. Type Urdu, Arabic or Hebrew and choose Noto Naskh Arabic or Noto Sans Arabic (Urdu & more in the font list); the letters are joined correctly in the downloaded PDF. Chinese, Japanese and Hindi are not supported yet.'],
  ['How do I edit a PDF without Adobe Acrobat?', 'Open the PDF here in any browser, on Windows, Mac, Linux, Android or iPhone. You can change text, add images, sign and rearrange pages without installing Acrobat or any other program.'],
  ['Can I edit a PDF on my phone?', 'Yes. The editor works in mobile browsers such as Chrome and Safari. Tap to add text, draw your signature with your finger and download the PDF to your phone.'],
  ['Can I make a resume, invoice or certificate?', 'Yes. Start from one of more than 20 ready-made templates: resumes, cover letters, invoices, quotations, receipts, letterheads, certificates, flyers, menus, invitations, business cards and planners. Every word and colour can be changed.'],
  ['Can I edit a scanned PDF?', 'A scanned PDF is a picture of the page, so its words cannot be retyped directly. Cover them with Whiteout and type new text on top, or add text, signatures and images anywhere on the page.'],
  ['Does it have layers like Figma?', 'Yes. The Layers panel lists everything on the page. Drag layers to change their order, hide or lock them, and use Bring to front or Send to back. You can also set exact position, size and rotation, align objects to the page, and turn on rulers.'],
];
// Landing pages that are the editor plus their own text (content/editor-landings.js).
const EDITOR_LANDINGS = PDF_EDITOR ? require('./content/editor-landings') : [];
const LANDING_BY_SLUG = new Map(EDITOR_LANDINGS.map((l) => [l.slug, l]));
const landingLinks = (except) => {
  const group = (kind, h) => `<h3>${h}</h3><ul class="pe-links">${EDITOR_LANDINGS.filter((l) => l.kind === kind && l.slug !== except)
    .map((l) => `<li>${link(`/${l.slug}`, esc(l.short))}</li>`).join('')}</ul>`;
  const resumeFirst = except && LANDING_BY_SLUG.get(except) && (LANDING_BY_SLUG.get(except).kind === 'resume' || except === 'resume-maker');
  const resumes = `<h3>Resume templates by job and style</h3><ul class="pe-links">${[['resume-maker', 'All resume templates'], ...EDITOR_LANDINGS.filter((l) => l.kind === 'resume').map((l) => [l.slug, l.short])]
    .filter(([s]) => s !== except).map(([s, t]) => `<li>${link(`/${s}`, esc(t))}</li>`).join('')}</ul>`;
  return `<section class="pe-related"><h2>${resumeFirst ? 'More resume templates and tools' : except ? 'More free PDF tools and makers' : 'Free templates and PDF tools'}</h2>
    ${resumeFirst ? resumes : ''}${group('template', 'Make a document from a template')}${group('tool', 'Work on an existing PDF')}${resumeFirst ? '' : resumes}
    ${except ? `<p class="more-link">${link('/edit-pdf', 'Open the full PDF editor')}</p>` : ''}</section>`;
};
// The start screen's hero and template panel carry the landing's own words; the editor reads
// data-start-cat (template category to show first) and data-start-tool (tool to pick once a
// PDF is open) from #pe.
function editorApp(l) {
  let app = ACCOUNTS ? EDITOR_APP.replace('<li>Free, no sign-up</li>', '<li>Free account to download</li>') : EDITOR_APP;
  if (!l) return app;
  app = app.replace('<div class="pe" id="pe">', `<div class="pe" id="pe"${l.cat ? ` data-start-cat="${l.cat}"` : ''}${l.tool ? ` data-start-tool="${l.tool}"` : ''}>`)
    .replace('<p class="pe-kicker">Free PDF editor</p>', `<p class="pe-kicker">${esc(l.kicker)}</p>`)
    .replace('<h1>Edit PDF</h1>', `<h1>${esc(l.h1)}</h1>`)
    .replace(/<p class="pe-lede">[^<]*<\/p>/, `<p class="pe-lede">${esc(l.lede)}</p>`);
  if (l.panel) app = app.replace(/<h2>Start from a template<\/h2><p>[^<]*<\/p>/, `<h2>${esc(l.panel[0])}</h2><p>${esc(l.panel[1])}</p>`);
  // The resume builder: every resume design, and two ways in besides the gallery (blank, own PDF).
  // The blank-page card stays in the markup, hidden, because the editor script binds to it.
  if (l.only) {
    const card = (href, ico, title, text, btn, cls) => `<a class="pe-card pe-link-card" href="${href}"><span class="pe-card-ico ${cls}"><svg viewBox="0 0 24 24" aria-hidden="true">${ico}</svg></span><strong>${title}</strong><span>${text}</span><span class="btn ${cls === 'pe-card-ico-alt' ? 'btn-dark' : 'btn-brand'} btn-sm pe-card-btn">${btn}</span></a>`;
    app = app.replace('<div class="pe" id="pe"', `<div class="pe pe-only" id="pe" data-only-cat="${l.only}"${l.feature ? ` data-feature="${esc(l.feature.join(','))}" data-feature-label="${esc(l.chip)}"` : ''}${l.style ? ` data-start-style="${esc(l.style)}"` : ''}`)
      .replace('<div class="pe-choices">', `<div class="pe-choices">${card(`/${l.slug}?template=resume-blank`, '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6m-3-3h6"/>', 'Start a blank resume', 'Headings ready, you fill in the rest', 'Start blank', 'pe-card-ico-alt')}`)
      .replace('<strong>Open a PDF</strong>', '<strong>Edit your resume PDF</strong>')
      .replace('<span>Drop it here or click to choose</span>', '<span>Open the resume you already have</span>')
      .replace('<div class="pe-card pe-new">', '<div class="pe-card pe-new" hidden>')
      .replace('<div class="pe-tpl-panel">', '<div class="pe-tpl-panel" id="peTemplates">');
  }
  return app;
}
function editorPage(base, slug) {
  const l = slug ? LANDING_BY_SLUG.get(slug) : null;
  if (slug && !l) return null;
  const p = l ? `/${l.slug}` : '/edit-pdf';
  const title = l ? `${l.title} | ${SITE}` : `Edit PDF Online Free - PDF Editor | ${SITE}`;
  const desc = l ? l.desc : 'Free online PDF editor: edit PDF text and images, sign, fill forms, highlight and add pages. Resume, invoice and certificate templates. No watermark.';
  const crumbs = l ? [['Home', '/'], ['Edit PDF', '/edit-pdf'], [l.short, p]] : [['Home', '/'], ['Edit PDF', p]];
  const faq = l ? l.faq : EDITOR_FAQ;
  const info = `<div class="pe-info">
    <h2>How to edit a PDF</h2>
    <ol class="steps">
      <li><strong>Open your PDF</strong> or create a blank one. It opens in your browser; nothing is uploaded.</li>
      <li><strong>Choose a tool</strong> from the bar: Edit text, Edit image, Text, Draw, Highlight, Whiteout, Shapes, Image or Sign, then click on the page.</li>
      <li><strong>Download</strong> the edited PDF, with page numbers or a watermark if you like.</li>
    </ol>
    <h2>Everything you can do</h2>
    <ul class="feat">
      <li><strong>Change existing text</strong>Click a line in the PDF and retype it.</li>
      <li><strong>Replace images</strong>Swap, move, resize or remove the pictures already in the PDF.</li>
      <li><strong>Add text</strong>150+ fonts, size, colour, bold, italic, underline and alignment, also in Urdu.</li>
      <li><strong>Layers and arrange</strong>Reorder by dragging, hide, lock, bring to front or send to back.</li>
      <li><strong>Precise layout</strong>Rulers, snapping guides, exact position, size and rotation, align to page.</li>
      <li><strong>Sign</strong>Draw or type your signature and place it anywhere.</li>
      <li><strong>Highlight and whiteout</strong>Mark important lines or hide content.</li>
      <li><strong>Draw and shapes</strong>Freehand pen, rectangles, circles, lines, arrows, check marks and crosses.</li>
      <li><strong>Images</strong>Insert PNG, JPG or WebP pictures, or add them as new pages.</li>
      <li><strong>Pages</strong>Add, delete, duplicate, rotate and reorder pages, or merge another PDF.</li>
      <li><strong>Page numbers and watermark</strong>Added when you download.</li>
      <li><strong>Ready-made templates</strong>Resumes, cover letters, invoices, quotations, receipts, certificates, flyers, menus and more.</li>
      <li><strong>Tables</strong>Real tables with rows and columns for invoices, price lists and agendas.</li>
    </ul>`;
  const body = l
    ? `<div class="pe-info pe-landing">${l.sections.map(([h, html]) => `<section><h2>${esc(h)}</h2>${html}</section>`).join('')}${readMore(p)}${landingLinks(l.slug)}</div>${faqHtml(faq)}`
    : `${info}${landingLinks('')}</div>${faqHtml(faq)}`;
  return render(EDITOR_TPL, {
    ...baseFields(base, p, title, desc, {}),
    HEAD_TAGS: seo.headTags({ url: base + p, title: esc(title), desc: esc(desc), image: `${base}/og/${ogKey(p)}.png` }),
    JSONLD: graph(base, p, l ? l.h1 : 'PDF Editor', desc, faq, crumbs, { features: ['Edit existing text', 'Replace images', 'Add text', '150+ fonts', 'Resume and invoice templates', 'Certificates and flyers', 'Tables', 'Layers', 'Rulers and alignment', 'Sign PDF', 'Fill PDF forms', 'Highlight', 'Whiteout', 'Draw', 'Shapes', 'Insert images', 'Add, delete, rotate and reorder pages', 'Merge PDF', 'Page numbers', 'Watermark'] }),
    EDITOR: editorApp(l) + `<div class="wrap">${body}</div>`,
    ACCOUNTS_ATTR: ACCOUNTS ? ` data-accounts="1"${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? ' data-google="1"' : ''}` : '',
    EDITOR_CSS_V: seo.ASSET_V.editorCss, EDITOR_JS_V: seo.ASSET_V.editorJs, EDITOR_TPL_V: seo.ASSET_V.editorTpl,
  });
}

function notFoundPage(base = '') {
  return renderPage(HUB_TPL, {
    ...noindex(baseFields(base, '/', `Page not found | ${SITE}`, 'This page does not exist.', {})), ROBOTS: 'noindex',
    HERO: hero({ h1: 'Page not found', intro: 'That converter is not available. Here are the ones that are.', short: true }),
    BODY: `<section class="hub-section"><h2>Popular tools</h2>${chips(POPULAR.map(([f, t]) => [pairPath(f, t), pairLabel(f, t), true]))}<p class="more-link">${link('/converters', 'See all formats')}</p></section>`,
  });
}

// ---------------------------------------------------------------- guides --
// /guides and /guides/<slug>: how-to articles from content/articles.js. Each converter page an
// article is about links back to it (readMore), so the guides and the tools support each other.
const articlePath = (slug) => `/guides/${slug}`;
const ARTICLE_BY_SLUG = new Map(ARTICLES.map((a) => [a.slug, a]));
const articlesFor = (toolPath) => ARTICLES.filter((a) => a.tools.includes(toolPath));
const toolName = (p) => {
  if (p === '/edit-pdf') return 'Edit PDF';
  if (LANDING_BY_SLUG.has(p.slice(1))) return LANDING_BY_SLUG.get(p.slice(1)).short;
  if (friendlyBySlug(p.slice(1))) return friendlyBySlug(p.slice(1)).h1.replace(/ Converter$/, '');
  if (PDF_TOOL_BY_SLUG.has(p.slice(1))) return PDF_TOOL_BY_SLUG.get(p.slice(1)).name;
  if (APP_BY_SLUG.has(p.slice(1))) return APP_BY_SLUG.get(p.slice(1)).name;
  if (p === '/pdf-tools') return 'All PDF tools';
  const r = registry.resolveRoute(p, ANY);
  return r && r.type === 'compress' ? `Compress ${r.from.label}` : r ? `${r.from.label} to ${r.to.label}` : p;
};
const longDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const readingMinutes = (a) => Math.max(2, Math.round(`${a.intro} ${a.sections.map(([h, b]) => `${h} ${b}`).join(' ')}`.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 220));

function readMore(toolPath) {
  const list = articlesFor(toolPath);
  if (!list.length) return '';
  return `<section class="read-more"><h2>Related ${list.length > 1 ? 'guides' : 'guide'}</h2><ul class="guide-links">${list
    .map((a) => `<li>${link(articlePath(a.slug), esc(a.h1))}<span>${esc(a.desc)}</span></li>`).join('')}</ul></section>`;
}

function articlePage(a, base) {
  const p = articlePath(a.slug);
  const crumbs = [['Home', '/'], ['Guides', '/guides'], [a.h1, p]];
  const tools = `<div class="article-tools">${a.tools.map((t, i) => `<a class="btn ${i ? 'btn-ghost' : 'btn-brand'} btn-sm" href="${t}">${icon('convert')}${esc(toolName(t))}</a>`).join('')}</div>`;
  const others = ARTICLES.filter((x) => x !== a).map((x) => [articlePath(x.slug), esc(x.h1), true]);
  return renderPage(HUB_TPL, baseFields(base, p, a.title, a.desc, {
    JSONLD: graph(base, p, a.h1, a.desc, a.faq, crumbs, { type: 'Article', article: a }),
    HERO: hero({ h1: esc(a.h1), crumbs, intro: esc(a.intro), short: true }),
    BODY: `<article class="prose article">
      <p class="muted article-meta">Updated <time datetime="${a.updated || a.date}">${longDate(a.updated || a.date)}</time> &middot; ${readingMinutes(a)} min read</p>
      ${tools}
      ${a.sections.map(([h, html]) => `<h2>${esc(h)}</h2>${html}`).join('\n')}
    </article>${faqHtml(a.faq.map(([q, ans]) => [esc(q), esc(ans)]))}
    <section class="related"><h2>More guides</h2>${chips(others)}</section>`,
  }));
}

function guidesHub(base) {
  const p = '/guides';
  const crumbs = [['Home', '/'], ['Guides', p]];
  const title = `File Conversion Guides and How-Tos | ${SITE}`;
  const desc = 'Step-by-step guides for converting and compressing images, PDFs, documents, video, audio and ebooks: the right settings, common problems and fixes.';
  return renderPage(HUB_TPL, baseFields(base, p, title, desc, {
    JSONLD: graph(base, p, 'Guides', desc, null, crumbs, { type: 'CollectionPage' }),
    HERO: hero({ h1: 'Guides', crumbs, intro: 'Practical how-tos for everyday file problems: smaller images, lighter PDFs, photos that will not open and videos that will not play.', short: true }),
    BODY: `<section class="hub-section"><ul class="guide-links guide-list">${ARTICLES.map((a) =>
      `<li>${link(articlePath(a.slug), esc(a.h1))}<span>${esc(a.desc)}</span></li>`).join('')}</ul></section>`,
  }));
}

function resolveGuide(slug, base) {
  if (slug === undefined) return { html: guidesHub(base) };
  const a = ARTICLE_BY_SLUG.get(slug);
  return a ? { html: articlePage(a, base) } : null;
}

// ------------------------------------------------------------ trust pages --
// About / Privacy / Terms / Contact. Google's quality guidelines and AdSense both expect a
// site to say who runs it and how it treats data. The privacy text describes what this
// code actually does; review it (and add your company details) before going live.
// ------------------------------------------------------------- accounts --
// Sign up / sign in (email + password, or Google when it is set up) and the account page.
// A free account is needed to download from the PDF editor. Off unless ACCOUNTS=1 (see
// accounts/index.js); never indexed.
const ACCOUNTS = process.env.ACCOUNTS === '1';
const GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.9 6.5-9.6 6.5-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C3 17.1 2 20.4 2 24s1 6.9 2.5 9.9z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>';
function accountShell(base, p, title, desc, body) {
  return renderPage(HUB_TPL, {
    ...noindex(baseFields(base, p, title, desc, {})), ROBOTS: 'noindex, nofollow', HERO: '',
    BODY: `<div class="acct">${body}</div><script src="/account.js?v=${seo.ASSET_V.account}" defer></script>`,
  });
}
// kind: 'login' | 'signup' | 'forgot'. With email set up (mail), sign-up and password reset
// continue with a 6-digit code sent by email (the .auth-code step, run by account.js).
const ICON_MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
function authPage(kind, base, { google = false, mail = false, next = '', error = '' } = {}) {
  const signup = kind === 'signup', forgot = kind === 'forgot';
  const q = next ? `?next=${encodeURIComponent(next)}` : '';
  const T = {
    signup: ['/signup', 'Create your free account', `Create a free ${SITE} account.`, 'Free forever. You need it to download from the PDF editor.', 'Create account'],
    login: ['/login', 'Welcome back', `Sign in to ${SITE}.`, `Sign in to your ${esc(SITE)} account.`, 'Sign in'],
    forgot: ['/forgot', 'Reset your password', `Reset your ${SITE} password.`, mail ? 'Enter your email and we will send you a code to set a new password.' : 'Password reset by email is not available yet.', 'Send code'],
  }[kind];
  const helpLine = CONTACT_EMAIL ? `email ${mailLink} from your account address and we will help` : `${link('/contact', 'contact us')} and we will help`;
  const codeStep = mail && !(kind === 'login') ? `<form class="auth-code" data-purpose="${forgot ? 'reset' : 'signup'}" hidden novalidate>
      <span class="auth-ico">${ICON_MAIL}</span>
      <h1>Check your email</h1>
      <p class="auth-lede">We sent a 6-digit code to <strong data-email></strong>. Enter it below. It works for 15 minutes.</p>
      <label for="authCode">Code</label>
      <input id="authCode" class="auth-code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required>
      ${forgot ? `<label for="authNewPass">New password</label>
      <input type="password" id="authNewPass" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required>` : ''}
      <button type="submit" class="btn btn-brand">${forgot ? 'Set new password' : 'Verify and create account'}</button>
      <p class="auth-msg" role="alert" hidden></p>
      <p class="auth-small">No email? Look in your spam or promotions folder. <button type="button" class="auth-link" data-resend>Send a new code</button> &middot; <button type="button" class="auth-link" data-back>Use a different email</button></p>
    </form>` : '';
  const form = forgot && !mail
    ? `<p class="auth-small">Forgot your password? Please ${helpLine}.</p>`
    : `<form class="auth-form" data-auth="${kind}" data-next="${esc(next)}" novalidate>
      <label for="authEmail">Email address</label>
      <input type="email" id="authEmail" name="email" autocomplete="email" placeholder="you@example.com" required>
      ${forgot ? '' : `<label for="authPass">Password</label>
      <input type="password" id="authPass" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" placeholder="${signup ? 'At least 8 characters' : ''}" required>`}
      <button type="submit" class="btn btn-brand">${T[4]}</button>
      <p class="auth-msg" role="alert"${error ? '' : ' hidden'}>${esc(error)}</p>
    </form>`;
  return accountShell(base, T[0], `${forgot ? 'Reset password' : signup ? 'Create your free account' : 'Sign in'} | ${SITE}`, T[2], `<section class="auth-card">
    <a class="auth-brand" href="/">${BRAND_SVG}<span>${brandName(SITE)}</span></a>
    <div class="auth-step1">
    <h1>${T[1]}</h1>
    <p class="auth-lede">${T[3]}</p>
    ${google && !forgot ? `<a class="auth-google" href="/auth/google${q}">${GOOGLE_G}Continue with Google</a>
    <div class="auth-or"><span>or</span></div>` : ''}
    ${form}
    ${signup ? `<p class="auth-small">${mail ? 'We will email you a code to confirm your address. ' : ''}By creating an account you agree to our ${link('/terms', 'Terms')} and ${link('/privacy', 'Privacy Policy')}.</p>`
    : kind === 'login' ? `<p class="auth-small">${mail ? `${link(`/forgot${q}`, 'Forgot your password?')}` : `Forgot your password? Please ${helpLine}.`}</p>` : ''}
    <p class="auth-switch">${signup ? `Already have an account? ${link(`/login${q}`, 'Sign in')}` : forgot ? `Remembered it? ${link(`/login${q}`, 'Sign in')}` : `New to ${esc(SITE)}? ${link(`/signup${q}`, 'Create a free account')}`}</p>
    </div>
    ${codeStep}
  </section>
  ${signup ? '<ul class="auth-perks"><li>Download your edited PDFs</li><li>Converters stay free without an account</li></ul>' : ''}`);
}
function accountPage(base, u) {
  const joined = new Date(u.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return accountShell(base, '/account', `Your account | ${SITE}`, 'Your account.', `<div class="ac">
    <h1>Your account</h1>
    <p class="ac-email">Signed in as <strong>${esc(u.email)}</strong> &middot; <a href="/logout">Sign out</a></p>
    <section class="ac-card ac-plan">
      <div><span class="ac-label">Free account</span><h2>${u.downloads ? `${u.downloads} PDF${u.downloads === 1 ? '' : 's'} downloaded` : 'Ready to edit'}</h2><p>Member since ${esc(joined)}${u.via === 'google' ? ' &middot; signs in with Google' : ''}.</p></div>
      <a class="btn btn-brand" href="/edit-pdf">${icon('edit')}Edit a PDF</a>
    </section>
    <section class="ac-card ac-danger">
      <span class="ac-label">Delete account</span>
      <p>Remove your account and your email address from ${esc(SITE)} for good.</p>
      <button type="button" class="btn btn-ghost" data-delete>Delete my account</button>
    </section>
  </div>`);
}
// Last page of Google sign-in opened from the editor: tells the editor and closes itself.
function authDonePage(ok) {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>${ok ? 'Signed in' : 'Sign-in failed'}</title></head>
<body data-ok="${ok ? 1 : 0}" style="font:16px system-ui,sans-serif;text-align:center;padding:48px 16px"><p>${ok ? 'Signed in. You can close this window.' : 'Google sign-in did not work. Close this window and try again.'}</p><script src="/account.js?v=${seo.ASSET_V.account}"></script></body></html>`;
}

const LEGAL_UPDATED = seo.LASTMOD;
const contactLine = CONTACT_EMAIL
  ? `email <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>`
  : 'use the contact details published on this page once the site owner adds them (set CONTACT_EMAIL)';

const INFO_PAGES = {
  about: {
    title: `About ${SITE} - Free Online File Converter`, h1: `About ${SITE}`,
    desc: `${SITE} is a free online file converter and image compressor. Learn how it works and what it can convert.`,
    body: () => `<section class="prose">
      <p>${SITE} is a free online file converter. It started as an image compressor and now handles ${LIVE_SUMMARY}.</p>
      <h2>How it works</h2>
      <p>Your file is uploaded over an encrypted connection, converted on our server with open-source engines (<a href="https://sharp.pixelplumbing.com/" rel="noopener">libvips</a>, <a href="https://ffmpeg.org/" rel="noopener">FFmpeg</a>, <a href="https://www.libreoffice.org/" rel="noopener">LibreOffice</a>, <a href="https://pandoc.org/" rel="noopener">Pandoc</a>, <a href="https://calibre-ebook.com/" rel="noopener">Calibre</a>, Ghostscript and Inkscape), and sent straight back to your browser. Nothing is kept afterwards.</p>
      <h2>What we are adding</h2>
      <p>Our catalogue lists ${FORMAT_COUNT} formats across ${CATS.length} categories. Conversions that are not ready yet are clearly marked <span class="soon-tag">soon</span>; we only switch one on once it really works.</p>
      <h2>Contact</h2>
      <p>Questions or suggestions? ${CONTACT_EMAIL ? `Email ${mailLink} or see our ${link('/contact', 'contact page')}` : link('/contact', 'Get in touch')}.</p></section>`,
  },
  privacy: {
    title: `Privacy Policy | ${SITE}`, h1: 'Privacy Policy',
    desc: `How ${SITE} handles your files and data: uploads are used only for the conversion and deleted straight away.`,
    body: () => `<section class="prose"><p class="muted">Last updated: ${LEGAL_UPDATED}</p>
      <h2>Files you upload</h2>
      <p>Files are sent to our server only to be converted. Images are processed in memory. Other files (video, audio, documents, ebooks, archives) are written to a private temporary folder for the conversion, and that folder is deleted as soon as the conversion finishes, whether it succeeds or not. Files are never logged or kept after the result has been returned to you. We do not look at, copy or share your files.</p>
      <h2>Data we process</h2>
      <p>Like every website, our server receives your IP address and basic request information (browser type, the page requested). We use your IP address only to apply a rate limit that protects the service from abuse; it is held in memory for up to 15 minutes.</p>
      <h2>Visitor statistics</h2>
      <p>To see how the site is used, we count page visits ourselves, without cookies and without any outside analytics company. For each visit we record the page, the website you came from (for example a search engine), your country and whether you use a phone, tablet or computer, plus which conversions were made. Your IP address is not stored: it is mixed with your browser type and a random value that changes every day into a short code, so we can count each visitor once a day but cannot recognise you on another day or find out who you are.</p>
${ACCOUNTS ? `      <h2>Your account</h2>
      <p>You need a free account to download PDFs from the ${link('/edit-pdf', 'PDF editor')}; the converters work without one. For an account we keep your email address, your name if you signed in with Google, your password in scrambled (hashed) form so nobody can read it, when you joined and last signed in, the country your connection comes from, and how many PDFs you downloaded from the editor. We use this only to run your account and to understand how the site is used. The only emails we send are the codes that confirm your address or reset your password; they are delivered by our email delivery provider. We never sell it or share it, and we do not send marketing email without asking you first.</p>
      <p>If you choose Continue with Google, Google tells us your email address and name; we receive nothing else from your Google account. You can delete your account at any time on your ${link('/account', 'account page')}, which removes everything we hold about you.</p>
` : ''}      <h2>Cookies and local storage</h2>
      <p>${ACCOUNTS ? `When you sign in, ${SITE} sets one cookie that keeps you signed in. It is needed for the account to work and is not used for tracking. Without an account, ${SITE} sets no cookies of its own.` : `${SITE} itself sets no cookies and stores nothing in your browser.`}</p>
      <h2>Advertising</h2>
      <p>If advertising is shown, it is provided by Google AdSense. Google and its partners may use cookies to show ads based on your visits to this and other websites. Visitors in the European Economic Area, the UK and Switzerland are asked for their consent through Google's consent message before personalised ads are shown. You can opt out of personalised advertising at <a href="https://adssettings.google.com/" rel="noopener">Google Ads Settings</a>. See <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">how Google uses information from sites that use its services</a>.</p>
      <h2>Third-party services</h2>
      <p>Fonts are served from this site; no third-party scripts are loaded unless advertising is enabled.</p>
      <h2>Your rights</h2>
      <p>${ACCOUNTS ? 'We do not store your files. If you have an account, you can delete it and all its data yourself, or ask us to show, correct or delete what we hold' : 'Because we do not store your files or create accounts, we hold no personal data about you beyond the short-lived rate-limit record and the anonymous visit counts described above'}. For any privacy question, ${contactLine}.</p></section>`,
  },
  terms: {
    title: `Terms of Use | ${SITE}`, h1: 'Terms of Use',
    desc: `The terms for using the free ${SITE} online file converter.`,
    body: () => `<section class="prose"><p class="muted">Last updated: ${LEGAL_UPDATED}</p>
      <h2>Using the service</h2>
      <p>${SITE} is free to use. You may convert files that you own or have the right to convert. Do not upload unlawful content or use the service to infringe anyone's rights.</p>
${ACCOUNTS ? `      <h2>Accounts</h2>
      <p>The converters need no account. To download from the PDF editor you need a free account. Give a real email address you can use, keep your password to yourself, and use one account per person. We may close accounts that are used for abuse or automated downloading.</p>
` : ''}      <h2>Fair use</h2>
      <p>To keep the service available for everyone, there is a ${MAX_MB}MB limit per file and a limit on how many files one connection can process in a short period. Automated bulk use may be blocked.</p>
      <h2>No warranty</h2>
      <p>The service is provided &ldquo;as is&rdquo;. We work to make conversions accurate, but we cannot guarantee that every file converts perfectly. Keep a copy of your originals.</p>
      <h2>Liability</h2>
      <p>To the extent permitted by law, ${SITE} is not liable for any loss resulting from the use of the service.</p>
      <h2>Changes</h2>
      <p>We may update these terms; the date above shows the latest version. Questions: ${CONTACT_EMAIL ? `email ${mailLink} or see the ${link('/contact', 'contact page')}` : link('/contact', 'contact us')}.</p></section>`,
  },
  contact: {
    title: `Contact | ${SITE}`, h1: `Contact ${SITE}`,
    desc: `Contact ${SITE}${CONTACT_EMAIL ? ` at ${CONTACT_EMAIL}` : ''}: questions about the free file converter, a missing format, a conversion problem or privacy.`,
    body: () => `<section class="prose">
      ${CONTACT_EMAIL
    ? `<p class="contact-mail">Email: ${mailLink}</p><p>We read every message and usually reply within a few working days.</p>`
    : '<p>Contact details have not been published yet.</p>'}
      <h2>Report a conversion problem</h2>
      <p>Tell us the file type, its size and the page you used (for example ${link('/jpg-to-png', 'JPG to PNG')}). Please do not send confidential files.</p>
      <h2>Request a format</h2>
      <p>Missing a conversion? Let us know which formats you need; the most requested ones are added first.</p>
      <h2>Privacy and data requests</h2>
      <p>We do not keep uploaded files${ACCOUNTS ? '; account holders can delete their account at any time' : ' or create accounts'}. See the ${link('/privacy', 'Privacy Policy')} for details, and write to us with any question about your data.</p>
      <h2>Copyright or abuse reports</h2>
      <p>If you believe the service is being misused, email us with the details and we will look into it promptly.</p></section>`,
  },

};

function infoPage(key, base) {
  const pg = INFO_PAGES[key];
  const p = `/${key}`;
  const crumbs = [['Home', '/'], [pg.h1, p]];
  return renderPage(HUB_TPL, baseFields(base, p, pg.title, pg.desc, {
    JSONLD: graph(base, p, pg.h1, pg.desc, null, crumbs, { type: key === 'about' ? 'AboutPage' : key === 'contact' ? 'ContactPage' : 'WebPage' }),
    HERO: hero({ h1: pg.h1, crumbs, intro: pg.desc, short: true }),
    BODY: pg.body(),
  }));
}
const resolveInfo = (key, base) => (Object.prototype.hasOwnProperty.call(INFO_PAGES, key) ? { html: infoPage(key, base) } : null);

// ------------------------------------------------------------ share images --
/** What to draw on /og/<key>.png, or null for an unknown key (so nobody can make us render arbitrary text). */
function ogSpec(rawKey) {
  const key = String(rawKey).replace(/\//g, '-');
  if (key === 'guides') return { title: 'File Conversion Guides', subtitle: 'How-to articles for images, PDFs, video and more' };
  if (key.startsWith('guides-')) {
    const a = ARTICLE_BY_SLUG.get(key.slice(7));
    return a ? { title: a.h1.length > 48 ? `${a.h1.slice(0, 46).replace(/\s+\S*$/, '')}...` : a.h1, subtitle: 'Guide' } : null;
  }
  if (friendlyBySlug(key)) { const x = friendlyBySlug(key); return { title: x.h1, subtitle: 'Free online converter \u00b7 No sign-up \u00b7 No watermark' }; }
  if (PDF_TOOL_BY_SLUG.has(key)) return { title: PDF_TOOL_BY_SLUG.get(key).h1, subtitle: 'Free online PDF tool \u00b7 No sign-up \u00b7 No watermark' };
  if (APP_BY_SLUG.has(key)) return { title: APP_BY_SLUG.get(key).h1, subtitle: 'Free online tool \u00b7 No sign-up \u00b7 No watermark' };
  if (key === 'pdf-tools') return { title: 'All PDF Tools', subtitle: 'Merge, split, compress, convert, edit and protect PDFs free' };
  if (key === 'edit-pdf') return { title: 'Free PDF Editor', subtitle: 'Edit, sign and fill PDFs. Resume and invoice templates' };
  if (LANDING_BY_SLUG.has(key)) { const l = LANDING_BY_SLUG.get(key); return { title: l.h1, subtitle: l.kicker }; }
  if (key === 'home') return { title: 'Free Online File Converter', subtitle: `${LIVE_COUNT.toLocaleString('en-US')} conversions \u00b7 Video, audio, documents, images` };
  if (key === 'converters') return { title: 'All File Formats', subtitle: `${FORMAT_COUNT} formats in ${CATS.length} categories` };
  if (INFO_PAGES[key]) return { title: INFO_PAGES[key].h1, subtitle: 'Free online file converter' };
  const conv = /^(.+)-converter$/.exec(key);
  if (conv) {
    const f = registry.getFormat(conv[1]);
    if (f && f.id === conv[1]) return { title: `${f.label} Converter`, subtitle: f.fullName };
    const c = CATS.find((x) => x.id === conv[1]);
    return c ? { title: c.converterName, subtitle: `${registry.getFormatsByCategory(c.id).length} formats` } : null;
  }
  const r = registry.resolveRoute(`/${key}`, ANY);
  if (!r || r.redirect) return null;
  if (r.type === 'compress') return { title: `Compress ${r.from.label}`, subtitle: `Make ${r.from.name} files smaller online for free` };
  return { title: `${r.from.label} to ${r.to.label} Converter`, subtitle: `Convert ${r.from.name} to ${r.to.name} online for free`, from: r.from.label, to: r.to.label };
}

// ---------------------------------------------------------------- routing --
// URL resolution (aliases, redirects, "is this pair registered") lives in the registry.
function resolvePair(rawFrom, rawTo, base) {
  const r = registry.resolveRoute(`/${rawFrom}-to-${rawTo}`, ANY);
  if (!r) return null;
  if (r.redirect) return { redirect: r.redirect };
  return { html: pairPage(r.from.id, r.to.id, base) };
}

function resolveCompress(raw, base) {
  const r = registry.resolveRoute(`/compress-${raw}`, ANY);
  if (!r) return null;
  if (r.redirect) return { redirect: r.redirect };
  return { html: compressPage(r.from.id, base) };
}

/** /<format>-converter or /<category>-converter. A format wins when a name is both (pdf). */
function resolveConverter(raw, base) {
  const f = registry.getFormat(raw);
  if (f) {
    if (raw !== f.id) return { redirect: formatPath(f.id) };
    return { html: formatPage(f.id, base) };
  }
  const c = CATS.find((x) => x.id === raw);
  return c ? { html: categoryPage(c.id, base) } : null;
}

// Only pages that show a working tool (or index one) go into the sitemap.
function allPaths() {
  return [
    '/', '/converters',
    ...CATS.filter((c) => categoryIsLive(c.id) && !registry.getFormat(c.id)).map((c) => categoryPath(c.id)),
    ...registry.getFormats().filter((f) => formatIsLive(f.id) && formatIndexable(f.id)).map((f) => formatPath(f.id)),
    ...registry.getConverters().filter((c) => pairIndexable(c.from, c.to)).map((c) => c.route),
    ...COMPRESSIBLE.map((s) => compressPath(s)),
    ...Object.keys(INFO_PAGES).map((k) => `/${k}`),
    '/guides', ...ARTICLES.map((a) => articlePath(a.slug)),
    ...friendlies().map((x) => `/${x.slug}`),
    '/pdf-tools', ...PDF_TOOLS.map((t) => `/${t.slug}`),
    ...APPS.map((t) => `/${t.slug}`),
    ...(PDF_EDITOR ? ['/edit-pdf', ...EDITOR_LANDINGS.map((l) => `/${l.slug}`)] : []),
  ];
}

// Higher priority for the home page and the live tools than for lists and legal pages.
// (Google ignores priority/changefreq; Bing and others still read them.)
function sitemapPriority(p) {
  if (p === '/') return '1.0';
  if (friendlyBySlug(p.slice(1)) || PDF_TOOL_BY_SLUG.has(p.slice(1)) || APP_BY_SLUG.has(p.slice(1)) || p === '/pdf-tools') return '1.0';
  if (/-to-|^\/compress-|^\/edit-pdf$/.test(p) || LANDING_BY_SLUG.has(p.slice(1))) return '0.9';
  if (/-converter$/.test(p) || p === '/converters') return '0.8';
  if (p.startsWith('/guides')) return '0.6';
  return '0.3';
}

function sitemap(base) {
  const urls = allPaths().map((p) => `  <url><loc>${base}${p}</loc><lastmod>${seo.LASTMOD}</lastmod><priority>${sitemapPriority(p)}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const robots = (base) => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;

module.exports = {
  megaMenu, PDF_TOOLS, resolvePdfTool, APPS, resolveApp,
  ACCOUNTS, authPage, accountPage, authDonePage, resolveFriendly, friendlies,
  editorPage, PDF_EDITOR, EDITOR_LANDINGS, homePage, resolveGuide, hubPage, notFoundPage, resolvePair, resolveCompress, resolveConverter, resolveInfo, ogSpec, sitemap, robots, allPaths, adsTxt, ADS_ENABLED: !!ADS_CLIENT };
