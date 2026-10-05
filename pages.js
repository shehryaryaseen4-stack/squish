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
const GUIDES = require('./content/guides');

const SITE = process.env.SITE_NAME || 'FlipFree';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || '';

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
const link = (href, text) => `<a href="${href}">${text}</a>`;
const chips = (items) => `<ul class="chips">${items.map(([h, t, live]) =>
  `<li>${link(h, t + (live === false ? ' <span class="soon-tag">soon</span>' : ''))}</li>`).join('')}</ul>`;
const pairLabel = (f, t) => `${F(f).label} to ${F(t).label}`;

// Logo (brand.js). The default name uses the outlined FlipFree logo; a custom SITE_NAME gets
// the icon plus the name as text, with a trailing "Free" in red.
const BRAND_SVG = `<svg class="brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${brand.TILE}${brand.MARK}</svg>`;
const brandName = (name) => (/.Free$/.test(name) ? `${esc(name.slice(0, -4))}<b class="brand-free">Free</b>` : esc(name));
const BRAND_LINK = SITE === 'FlipFree'
  ? `<a class="brand" href="/" aria-label="FlipFree home"><svg class="brand-logo" viewBox="0 0 ${brand.W} ${brand.H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${brand.logoInner({ flip: 'currentColor' })}</svg></a>`
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
  convert: '<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v5h-5M3 20v-5h5"/>',
};
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
let topbarCache = null;
function topbar() {
  if (topbarCache) return topbarCache;
  const groups = [];
  groups.push(['popular', 'Popular', POPULAR.map(([f, t]) => ({ id: f, href: pairPath(f, t), text: `${F(f).label} &rarr; ${F(t).label}`, live: true })),
    `<a class="mega-head" href="/converters">All ${TOTAL_COUNT.toLocaleString('en-US')} conversions &rarr;</a>`]);
  CATS.forEach((c) => {
    const items = registry.getFormatsByCategory(c.id).map((f) => ({ id: f.id, href: formatPath(f.id), live: formatIsLive(f.id) }));
    groups.push([c.id, c.converterName, items, `<a class="mega-head" href="${categoryPath(c.id)}">${icon(c.icon)}${c.converterName} &rarr;</a>`]);
  });
  groups.push(['compress', 'Compress', ALL_COMPRESSORS.map((c) => ({ id: c.from, href: c.route, text: `Compress ${F(c.from).label}`, live: c.status === 'live' })),
    '<span class="mega-head">Make files smaller</span>']);

  // Tools mega menu reuses the picker; it groups by explicit lists instead of by category.
  const mega = pickerPanel(groups.map(([, name, items, head]) => [null, name, items, head]), { extraClass: 'mega', heads: true });
  const compress = ALL_COMPRESSORS.map((c) =>
    `<li><a href="${c.route}">${icon('compress')}Compress ${F(c.from).label}${c.status === 'live' ? '' : ' <span class="soon-tag">soon</span>'}</a></li>`).join('');
  const convertList = CATS.map((c) =>
    `<li><a href="${categoryPath(c.id)}">${icon(c.icon)}${c.converterName}${categoryIsLive(c.id) ? '' : ' <span class="soon-tag">soon</span>'}</a></li>`).join('');

  topbarCache = `${SPRITE}<header class="top"><div class="top-row">
    ${BRAND_LINK}
    <nav class="main-nav" aria-label="Main">
      <details class="nav-menu" data-menu><summary class="nav-item">Tools<span class="caret" aria-hidden="true"></span></summary>${mega}</details>
      <details class="nav-menu nav-simple" data-menu><summary class="nav-item">Convert<span class="caret" aria-hidden="true"></span></summary><div class="dropdown"><ul>${convertList}</ul></div></details>
      <details class="nav-menu nav-simple" data-menu><summary class="nav-item">Compress<span class="caret" aria-hidden="true"></span></summary><div class="dropdown"><ul>${compress}</ul></div></details>
      <a class="nav-item nav-link" href="/converters">Formats</a>
    </nav>
    <div class="top-actions">
      <a class="btn btn-brand btn-sm" href="/#convert">Convert now</a>
    </div>
  </div></header>`;
  return topbarCache;
}

function footer() {
  const pop = POPULAR.slice(0, 10).map(([f, t]) => `<li>${link(pairPath(f, t), pairLabel(f, t))}</li>`).join('');
  const cats = CATS.map((c) => `<li>${link(categoryPath(c.id), c.converterName)}</li>`).join('');
  const comp = COMPRESSIBLE.map((s) => `<li>${link(compressPath(s), `Compress ${F(s).label}`)}</li>`).join('');
  return `<footer class="site-footer"><div class="footer-inner">
    <div class="footer-brand">${BRAND_LINK}
      <p>Free online file converter. ${LIVE_COUNT.toLocaleString('en-US')} conversions across ${LIVE_CAT_NAMES.length} categories, free and without sign-up.</p></div>
    <div><h4>Converters</h4><ul>${cats}</ul></div>
    <div><h4>Popular</h4><ul>${pop}</ul></div>
    <div><h4>Tools</h4><ul>${comp}<li>${link('/converters', 'All formats')}</li></ul></div>
    <div><h4>Company</h4><ul><li>${link('/about', 'About')}</li><li>${link('/privacy', 'Privacy Policy')}</li><li>${link('/terms', 'Terms of Use')}</li><li>${link('/contact', 'Contact')}</li></ul></div>
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
  <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Choose files" data-exts="${exts.join(',')}">
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
const ogKey = (urlPath) => (urlPath === '/' ? 'home' : urlPath.slice(1));

function baseFields(base, urlPath, title, desc, extra) {
  const url = base + urlPath;
  return {
    TITLE: esc(title), META_DESC: esc(desc), ROBOTS: 'index, follow, max-image-preview:large, max-snippet:-1', URL: url,
    CANONICAL_TAG: `<link rel="canonical" href="${url}">`,
    TOPBAR: topbar(), FOOTER: footer(), DEFAULT_FORMAT: 'auto', JSONLD: '{}', TOOL: '', CONTENT: '', RELATED: '', BODY: '',
    CSS_V: seo.ASSET_V.css, JS_V: seo.ASSET_V.js,
    _url: url, _title: esc(title), _desc: esc(desc), _image: `${base}/og/${ogKey(urlPath)}.png`, _noindex: false,
    ...extra,
  };
}

// Planned/experimental pages: visible and linked, but kept out of the index.
const noindex = (fields) => ({ ...fields, ROBOTS: 'noindex, follow', CANONICAL_TAG: '', JSONLD: '{}', _noindex: true });

function renderPage(tpl, fields) {
  const ads = adFields(!fields._noindex && !!fields.TOOL);
  return render(tpl, { ...fields, ...ads, HEAD_TAGS: seo.headTags({ url: fields._url, title: fields._title, desc: fields._desc, image: fields._image, noindex: fields._noindex }) });
}

// Structured data. Organization + WebSite are the same on every page (linked by @id);
// the page itself is a WebApplication (tools) or WebPage (lists, legal pages).
function graph(base, urlPath, name, desc, faq, crumbs, { type = 'WebApplication', features } = {}) {
  const url = base + urlPath;
  const org = { '@type': 'Organization', '@id': `${base}/#organization`, name: SITE, url: `${base}/`,
    logo: { '@type': 'ImageObject', url: `${base}/icon-512.png`, width: 512, height: 512 },
    ...(CONTACT_EMAIL ? { email: CONTACT_EMAIL } : {}) };
  const site = { '@type': 'WebSite', '@id': `${base}/#website`, name: SITE, url: `${base}/`, inLanguage: 'en', publisher: { '@id': `${base}/#organization` } };
  const pageNode = type === 'WebApplication'
    ? { '@type': 'WebApplication', '@id': `${url}#app`, name, url, description: desc, inLanguage: 'en',
      applicationCategory: 'MultimediaApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript and a modern browser.',
      isAccessibleForFree: true, image: `${base}/og/${ogKey(urlPath)}.png`, publisher: { '@id': `${base}/#organization` },
      isPartOf: { '@id': `${base}/#website` }, dateModified: seo.LASTMOD,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, ...(features ? { featureList: features } : {}) }
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
function howToSteps(fromLabel, toLabel, verb = 'convert', image = true) {
  return `<section class="howto"><h2>How to ${verb} ${fromLabel}${toLabel ? ` to ${toLabel}` : ''}</h2><ol class="steps">
    <li><strong>Choose your files.</strong> Click <em>Select File</em> or drag your ${fromLabel} files into the upload box. You can add many at once.</li>
    <li><strong>Pick the settings.</strong> ${toLabel ? `${toLabel} is already selected as the output format.` : 'Choose the output format.'}${image ? ' Adjust Quality and Max dimension if you want smaller files.' : ' The conversion starts as soon as a file is added.'}</li>
    <li><strong>Download.</strong> Each file appears in the list with its new size. Download them one by one, or all together as a ZIP.</li>
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
  const faq = [...(guide ? guide.faq : []), ...pairFaq(from, to, imagePair)];
  const notes = pairNotes(from, to);
  if (!imagePair && meta.converter.notes) notes.push(esc(meta.converter.notes));
  if (!notes.length) notes.push(`Your ${from.name} file is converted on our server and the ${to.name} result can be downloaded straight away.`);
  return renderPage(PAGE_TPL, baseFields(base, p, meta.title, meta.description, {
    JSONLD: graph(base, p, meta.schemaName, meta.description, faq, meta.breadcrumbs, { features: TOOL_FEATURES }),
    DEFAULT_FORMAT: to.select,
    HERO: hero({ h1: meta.h1, crumbs: meta.breadcrumbs,
      intro: imagePair
        ? `Convert ${from.name} images to ${to.name} online for free. Upload one file or many, choose the quality and maximum size, then download the ${to.name} results one by one or all together in a ZIP. No sign-up needed.`
        : `Convert ${from.name} files to ${to.name} online for free. Upload one file or many and download the ${to.name} results one by one or all together in a ZIP. No sign-up needed.`,
      widget, withSelect: true }),
    TOOL: toolHtml({ inputs: [fromSlug], outputs: outputsFor(fromSlug), dropTitle: `Drop your ${from.label} files here`, dropSub: `or click to choose ${from.label} files` }),
    CONTENT: howToSteps(from.label, to.label, 'convert', imagePair) + guideHtml(from, to, guide) + cards + compareTable([fromSlug, toSlug])
      + `<section class="notes"><h2>Converting ${from.name} to ${to.name}</h2><ul>${notes.map((x) => `<li>${x}</li>`).join('')}</ul></section>` + faqHtml(faq),
    RELATED: relatedForPair(from, to),
  }));
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
  const faq = [
    [`How do I compress a ${f.label} file?`, `Click Select File or drop your ${f.name} files onto the upload box, choose a Quality and Max dimension, and the smaller versions appear below with a download button. Lower quality and a smaller maximum size give smaller files.`],
    [`How much smaller will my ${f.label} be?`, 'It depends on the image and your settings. Photographs usually shrink the most and simple graphics the least. The list shows the exact before and after size for every file.'],
    ...FAQ_COMMON,
  ];
  const conv = outputsFor(slug).slice(0, 6).map((o) => [pairPath(slug, o), pairLabel(slug, o), true]);
  return renderPage(PAGE_TPL, baseFields(base, p, meta.title, meta.description, {
    JSONLD: graph(base, p, meta.schemaName, meta.description, faq, meta.breadcrumbs, { features: TOOL_FEATURES }),
    DEFAULT_FORMAT: f.select,
    HERO: hero({ h1: meta.h1, crumbs: meta.breadcrumbs,
      intro: isImageFmt(slug)
        ? `Make your ${f.name} images smaller without fuss. Upload one file or many, set the quality and maximum size, and download the compressed versions individually or as a ZIP. No sign-up needed.`
        : `Make your ${f.name} files smaller without fuss. Upload one file or many and download the compressed versions individually or as a ZIP. Images inside are downsampled to 150 dpi. No sign-up needed.`,
      widget, withSelect: true }),
    TOOL: toolHtml({ inputs: [slug], outputs: [slug], compress: true, dropTitle: `Drop your ${f.label} files here`, dropSub: `or click to choose ${f.label} files` }),
    CONTENT: howToSteps(f.label, '', 'compress', isImageFmt(slug)) + `<section class="fcards" aria-label="About the format">${cardHtml(slug)}</section>` + faqHtml(faq),
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
  return renderPage(PAGE_TPL, live ? fields : noindex(fields));
}

function categoryPage(catId, base) {
  const c = registry.getCategory(catId), p = categoryPath(catId);
  const fmts = registry.getFormatsByCategory(catId);
  const live = categoryIsLive(catId);
  const ins = registry.getInputFormats({ ...ANY, category: catId }).map((x) => x.id);
  const title = `${c.converterName} - Free Online | ${SITE}`;
  const desc = `${c.description} ${fmts.length} formats. Free, no sign-up.`;
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
  const desc = `Convert video, audio, images, documents, ebooks, archives and fonts online for free. ${LIVE_COUNT.toLocaleString('en-US')} conversions, batch upload, no sign-up.`;
  const faq = [...FAQ_CATALOG, ...FAQ_COMMON];
  return renderPage(PAGE_TPL, baseFields(base, '/', title, desc, {
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

function notFoundPage(base = '') {
  return renderPage(HUB_TPL, {
    ...noindex(baseFields(base, '/', `Page not found | ${SITE}`, 'This page does not exist.', {})), ROBOTS: 'noindex',
    HERO: hero({ h1: 'Page not found', intro: 'That converter is not available. Here are the ones that are.', short: true }),
    BODY: `<section class="hub-section"><h2>Popular tools</h2>${chips(POPULAR.map(([f, t]) => [pairPath(f, t), pairLabel(f, t), true]))}<p class="more-link">${link('/converters', 'See all formats')}</p></section>`,
  });
}

// ------------------------------------------------------------ trust pages --
// About / Privacy / Terms / Contact. Google's quality guidelines and AdSense both expect a
// site to say who runs it and how it treats data. The privacy text describes what this
// code actually does; review it (and add your company details) before going live.
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
      <p>Questions or suggestions? ${link('/contact', 'Get in touch')}.</p></section>`,
  },
  privacy: {
    title: `Privacy Policy | ${SITE}`, h1: 'Privacy Policy',
    desc: `How ${SITE} handles your files and data: uploads are used only for the conversion and deleted straight away.`,
    body: () => `<section class="prose"><p class="muted">Last updated: ${LEGAL_UPDATED}</p>
      <h2>Files you upload</h2>
      <p>Files are sent to our server only to be converted. Images are processed in memory. Other files (video, audio, documents, ebooks, archives) are written to a private temporary folder for the conversion, and that folder is deleted as soon as the conversion finishes, whether it succeeds or not. Files are never logged or kept after the result has been returned to you. We do not look at, copy or share your files.</p>
      <h2>Data we process</h2>
      <p>Like every website, our server receives your IP address and basic request information (browser type, the page requested). We use your IP address only to apply a rate limit that protects the service from abuse; it is held in memory for up to 15 minutes.</p>
      <h2>Cookies and local storage</h2>
      <p>${SITE} itself sets no cookies and stores nothing in your browser.</p>
      <h2>Advertising</h2>
      <p>If advertising is shown, it is provided by Google AdSense. Google and its partners may use cookies to show ads based on your visits to this and other websites. Visitors in the European Economic Area, the UK and Switzerland are asked for their consent through Google's consent message before personalised ads are shown. You can opt out of personalised advertising at <a href="https://adssettings.google.com/" rel="noopener">Google Ads Settings</a>. See <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">how Google uses information from sites that use its services</a>.</p>
      <h2>Third-party services</h2>
      <p>Pages load fonts from Google Fonts. No other third-party scripts are loaded unless advertising is enabled.</p>
      <h2>Your rights</h2>
      <p>Because we do not store your files or create accounts, we hold no personal data about you beyond the short-lived rate-limit record. For any privacy question, ${contactLine}.</p></section>`,
  },
  terms: {
    title: `Terms of Use | ${SITE}`, h1: 'Terms of Use',
    desc: `The terms for using the free ${SITE} online file converter.`,
    body: () => `<section class="prose"><p class="muted">Last updated: ${LEGAL_UPDATED}</p>
      <h2>Using the service</h2>
      <p>${SITE} is free to use. You may convert files that you own or have the right to convert. Do not upload unlawful content or use the service to infringe anyone's rights.</p>
      <h2>Fair use</h2>
      <p>To keep the service available for everyone, there is a ${MAX_MB}MB limit per file and a limit on how many files one connection can process in a short period. Automated bulk use may be blocked.</p>
      <h2>No warranty</h2>
      <p>The service is provided &ldquo;as is&rdquo;. We work to make conversions accurate, but we cannot guarantee that every file converts perfectly. Keep a copy of your originals.</p>
      <h2>Liability</h2>
      <p>To the extent permitted by law, ${SITE} is not liable for any loss resulting from the use of the service.</p>
      <h2>Changes</h2>
      <p>We may update these terms; the date above shows the latest version. Questions: ${link('/contact', 'contact us')}.</p></section>`,
  },
  contact: {
    title: `Contact | ${SITE}`, h1: `Contact ${SITE}`,
    desc: `Get in touch with the ${SITE} team about the file converter, a missing format or a problem.`,
    body: () => `<section class="prose">
      <p>Found a file that will not convert, want a format added, or have a question about privacy?</p>
      <p>${CONTACT_EMAIL ? `Email us at <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>. We read every message.` : 'Contact details have not been published yet.'}</p>
      <p>When reporting a conversion problem, tell us the file type, its size and the page you used. Please do not send confidential files.</p></section>`,
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
function ogSpec(key) {
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
    ...registry.getFormats().filter((f) => formatIsLive(f.id)).map((f) => formatPath(f.id)),
    ...registry.getConverters().map((c) => c.route),
    ...COMPRESSIBLE.map((s) => compressPath(s)),
    ...Object.keys(INFO_PAGES).map((k) => `/${k}`),
  ];
}

// Higher priority for the home page and the live tools than for lists and legal pages.
// (Google ignores priority/changefreq; Bing and others still read them.)
function sitemapPriority(p) {
  if (p === '/') return '1.0';
  if (/-to-|^\/compress-/.test(p)) return '0.9';
  if (/-converter$/.test(p) || p === '/converters') return '0.8';
  return '0.3';
}

function sitemap(base) {
  const urls = allPaths().map((p) => `  <url><loc>${base}${p}</loc><lastmod>${seo.LASTMOD}</lastmod><priority>${sitemapPriority(p)}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const robots = (base) => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;

module.exports = { homePage, hubPage, notFoundPage, resolvePair, resolveCompress, resolveConverter, resolveInfo, ogSpec, sitemap, robots, allPaths, adsTxt, ADS_ENABLED: !!ADS_CLIENT };
