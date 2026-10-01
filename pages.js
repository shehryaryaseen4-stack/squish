'use strict';
// Generates one landing page per supported conversion (e.g. /png-to-webp),
// plus /compress-<format> pages, a hub page, sitemap.xml and robots.txt.
//
// Only conversions this server can genuinely perform get a page. Which ones those are
// is decided by registry/ (status 'live'); HEIC is 'experimental' there, so it gets no
// page until it is verified (see README) and flipped to 'live'.
//
// This file holds page TEMPLATES only. It no longer contains format lists or conversion
// pairs: everything comes from the registry. The templates are still image-specific
// (wording, the Photo/Lossless/... picker groups); making them category-driven is UI work
// for a later phase, so pages are limited to image <-> image conversions for now.

const fs = require('fs');
const path = require('path');
const registry = require('./registry');

const SITE = process.env.SITE_NAME || 'Squish';
const MAX_MB = Number(process.env.MAX_FILE_MB || 40);

const PAGE_TPL = fs.readFileSync(path.join(__dirname, 'views', 'page.html'), 'utf8');
const HUB_TPL = fs.readFileSync(path.join(__dirname, 'views', 'hub.html'), 'utf8');

// ------------------------------------------------------- registry adapters --
// Page templates below were written against a small per-format object. This adapter
// builds that shape from the registry so the templates did not have to change.
//   rank = typical relative file size for the same picture (higher = smaller); used only
//   to choose between "usually smaller" / "often larger" wording.
const formatCache = new Map();
function F(slug) {
  if (!formatCache.has(slug)) {
    const f = registry.getFormat(slug);
    formatCache.set(slug, f && {
      slug: f.id, label: f.label, name: f.name, select: f.apiFormat, rank: f.traits.sizeRank, alpha: f.traits.alpha,
      full: f.fullName, about: f.description,
    });
  }
  return formatCache.get(slug);
}

const isImage = (slug) => { const f = registry.getFormat(slug); return !!f && f.categories.includes('image'); };
const PAGE_SCOPE = { fromCategory: 'image', toCategory: 'image' }; // see header note

const INPUTS = registry.getInputFormats({ category: 'image' }).map((f) => f.id);
const COMPRESSIBLE = registry.getCompressibleFormats().filter((f) => isImage(f.id)).map((f) => f.id);

const isPair = (f, t) => !!registry.getConverter(f, t) && isImage(f) && isImage(t);
const pairPath = (f, t) => registry.getConverterRoute(f, t);
const compressPath = (f) => registry.getCompressRoute(f);

const outputsFor = (slug) => registry.getCompatibleOutputFormats(slug, { category: 'image' }).map((f) => f.id);
const inputsFor = (slug) => registry.getCompatibleInputFormats(slug, { category: 'image' }).map((f) => f.id);

const POPULAR = registry.getPopularConversions().map((c) => [c.from, c.to]).filter(([f, t]) => isPair(f, t));

// ---------------------------------------------------------------- helpers --
const render = (tpl, map) => tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in map ? map[k] : m));
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
const link = (href, text) => `<a href="${href}">${text}</a>`;
const chips = (items) => `<ul class="chips">${items.map(([h, t]) => `<li>${link(h, t)}</li>`).join('')}</ul>`;

const BRAND_SVG = `<svg class="brand-mark" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="2" width="24" height="24" rx="4" fill="#E8A33D"/><path d="M8 14h4M16 14h4M14 8v4M14 16v4" stroke="#16181C" stroke-width="2.4" stroke-linecap="round"/></svg>`;

function topbar() {
  return `<div class="top"><div class="top-row">
    <a class="brand" href="/">${BRAND_SVG}${SITE}</a>
    <div class="top-note">One engine, every format &mdash; the same power professional image pipelines use</div>
    <div class="top-actions"><a class="top-link" href="/converters">All converters</a>
    <button class="theme-toggle" id="themeToggle" type="button">Dark / Light</button></div>
  </div></div>`;
}

function footer() {
  const pop = POPULAR.slice(0, 8).map(([f, t]) => [pairPath(f, t), `${F(f).label} to ${F(t).label}`]);
  return `<footer class="site-footer"><div class="footer-inner">
    <div><strong>${SITE}</strong><p>Free online image converter and compressor.</p></div>
    <div><strong>Popular</strong>${chips(pop)}</div>
    <div>${link('/converters', 'All converters')}<p class="copy">&copy; ${new Date().getFullYear()} ${SITE}</p></div>
  </div></footer>`;
}

// Hero chip that opens a two-pane picker (search + categories + format buttons).
// Every button is a real link, so switching format is a normal, crawlable page
// navigation and the buttons still work without JavaScript.
const FORMAT_GROUPS = [
  ['Photo', ['jpg', 'webp', 'avif']],
  ['Lossless', ['png', 'tiff', 'bmp']],
  ['Animated', ['gif']],
  ['Icon &amp; Vector', ['ico', 'svg']],
];

function chipMenu(currentLabel, currentSlug, options, accent) {
  const groups = FORMAT_GROUPS
    .map(([name, slugs]) => [name, options.filter(([, , slug]) => slugs.includes(slug))])
    .filter(([, items]) => items.length);
  let active = groups.findIndex(([, items]) => items.some(([, , slug]) => slug === currentSlug));
  if (active < 0) active = 0;
  const cats = groups.map(([name], i) =>
    `<li><button type="button" class="fmt-cat${i === active ? ' is-active' : ''}" data-cat="${i}">${name}<span class="fmt-arrow" aria-hidden="true">&rsaquo;</span></button></li>`).join('');
  const grids = groups.map(([name, items], i) =>
    `<div class="fmt-grid${i === active ? ' is-active' : ''}" data-cat="${i}" aria-label="${name}">${items.map(([href, text, slug]) =>
      `<a class="fmt-btn" href="${href}" data-name="${text.toLowerCase()} ${F(slug).name.toLowerCase()} ${F(slug).full.toLowerCase()}"${slug === currentSlug ? ' aria-current="true"' : ''}>${text}</a>`).join('')}</div>`).join('');
  return `<details class="chip-menu"><summary class="chip${accent ? ' chip-accent' : ''}" aria-label="Change format (currently ${currentLabel})">${currentLabel}<span class="caret" aria-hidden="true"></span></summary>`
    + `<div class="fmt-panel${accent ? ' fmt-right' : ''}">`
    + `<label class="fmt-search"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" class="fmt-q" placeholder="Search Format" autocomplete="off" aria-label="Search format"></label>`
    + `<div class="fmt-body"><ul class="fmt-cats">${cats}</ul><div class="fmt-grids">${grids}<p class="fmt-none">No format found</p></div></div></div></details>`;
}

const cardHtml = (slug) => {
  const f = F(slug);
  const more = INPUTS.includes(slug) ? `/converters#from-${slug}` : '/converters';
  return `<article class="fcard"><div class="fcard-icon">${f.label}</div><div>
    <h3>${f.label} <span>&ndash; ${f.full}</span></h3><p>${f.about}</p>
    ${link(more, `More ${f.label} converters`)}</div></article>`;
};

function faqHtml(items) {
  return `<section class="faq"><h2>Frequently asked questions</h2>${items
    .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`;
}

const FAQ_COMMON = [
  ['Is it really free?',
    `Yes. There is no sign-up and no watermark. To keep the service available for everyone there is a ${MAX_MB}MB limit per file and a cap on how many files one connection can process in a short period.`],
  ['Are my files stored?',
    'Your upload is held in the server\u2019s memory only while it is being processed and is not written to disk. Once the result has been sent back, nothing is kept.'],
  ['Will quality drop?',
    'A little, by design. To make files smaller the image is re-encoded at the Quality you choose (default 75%). Move the slider up for more detail or down for smaller files. Converting never restores detail that is already missing from the original.'],
];

// -------------------------------------------------- pair-specific writing --
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
  return n;
}

function pairFaq(from, to) {
  return [
    [`How do I convert ${from.label} to ${to.label}?`,
      `Drop your ${from.name} file onto the upload box, or click it to choose files. Pick the quality and maximum size, and the converted ${to.name} appears in the list below with a download button. You can add many files at once and download them together as a ZIP.`],
    ...FAQ_COMMON,
  ];
}

function relatedForPair(from, to) {
  const a = outputsFor(from.slug).filter((o) => o !== to.slug).slice(0, 6).map((o) => [pairPath(from.slug, o), `${from.label} to ${F(o).label}`]);
  const b = inputsFor(to.slug).filter((i) => i !== from.slug).slice(0, 6).map((i) => [pairPath(i, to.slug), `${F(i).label} to ${to.label}`]);
  const rev = isPair(to.slug, from.slug) ? [[pairPath(to.slug, from.slug), `${to.label} to ${from.label}`]] : [];
  const comp = COMPRESSIBLE.includes(from.slug) ? [[compressPath(from.slug), `Compress ${from.label}`]] : [];
  return `<section class="related"><h2>Related converters</h2>${chips([...rev, ...comp, ...a, ...b])}</section>`;
}

// ------------------------------------------------------------- page makers --
function baseFields(base, urlPath, title, desc, extra) {
  const url = base + urlPath;
  return {
    TITLE: title, META_DESC: desc, ROBOTS: 'index, follow', URL: url,
    CANONICAL_TAG: `<link rel="canonical" href="${url}">`,
    TOPBAR: topbar(), FOOTER: footer(), MAX_MB: String(MAX_MB), ...extra,
  };
}

function graph(base, urlPath, name, desc, faq, crumbs) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebApplication', name, url: base + urlPath, description: desc,
        applicationCategory: 'MultimediaApplication', operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      { '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, p], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: base + p })) },
    ],
  });
}

function pairPage(fromSlug, toSlug, base) {
  const from = F(fromSlug), to = F(toSlug), p = pairPath(fromSlug, toSlug);
  const meta = registry.getConverterMetadata(fromSlug, toSlug, { siteName: SITE });
  const title = meta.title;
  const desc = meta.description;
  const faq = pairFaq(from, to);
  const notes = pairNotes(from, to);
  return render(PAGE_TPL, baseFields(base, p, title, desc, {
    JSONLD: graph(base, p, meta.schemaName, desc, faq, meta.breadcrumbs),
    DEFAULT_FORMAT: to.select, H1: meta.h1,
    INTRO: `Convert ${from.name} images to ${to.name} online for free. Upload one file or many, choose the quality and maximum size, then download the ${to.name} results one by one or all together in a ZIP. No sign-up needed.`,
    HERO_VISUAL: `<div class="hero-visual">${chipMenu(from.label, fromSlug,
      inputsFor(toSlug).map((i) => [pairPath(i, toSlug), F(i).label, i]), false)}<div class="chip-to" aria-hidden="true">TO</div>${chipMenu(to.label, toSlug,
      outputsFor(fromSlug).map((o) => [pairPath(fromSlug, o), F(o).label, o]), true)}</div>`,
    DROP_TITLE: `Select your ${from.label} file to convert`, DROP_SUB: `or drop your ${from.label} file here`,
    CARDS: cardHtml(fromSlug) + cardHtml(toSlug),
    NOTES_SECTION: `<section class="notes"><h2>Converting ${from.name} to ${to.name}</h2><ul>${notes.map((x) => `<li>${x}</li>`).join('')}</ul></section>`,
    FAQ_SECTION: faqHtml(faq), RELATED_SECTION: relatedForPair(from, to),
  }));
}

function compressPage(slug, base) {
  const f = F(slug), p = compressPath(slug);
  const meta = registry.getCompressMetadata(slug, { siteName: SITE });
  const title = meta.title;
  const desc = meta.description;
  const faq = [
    [`How do I compress a ${f.label} file?`, `Drop your ${f.name} files onto the upload box, choose a Quality and Max dimension, and the smaller versions appear below with a download button. Lower quality and a smaller maximum size give smaller files.`],
    [`How much smaller will my ${f.label} be?`, 'It depends on the image and your settings. Photographs usually shrink the most and simple graphics the least. The list shows the exact before and after size for every file.'],
    ...FAQ_COMMON,
  ];
  const others = COMPRESSIBLE.filter((s) => s !== slug).map((s) => [compressPath(s), `Compress ${F(s).label}`]);
  const conv = outputsFor(slug).slice(0, 5).map((o) => [pairPath(slug, o), `${f.label} to ${F(o).label}`]);
  return render(PAGE_TPL, baseFields(base, p, title, desc, {
    JSONLD: graph(base, p, meta.schemaName, desc, faq, meta.breadcrumbs),
    DEFAULT_FORMAT: f.select, H1: meta.h1,
    INTRO: `Make your ${f.name} images smaller without fuss. Upload one file or many, set the quality and maximum size, and download the compressed versions individually or as a ZIP. No sign-up needed.`,
    HERO_VISUAL: `<div class="hero-visual">${chipMenu(f.label, slug,
      COMPRESSIBLE.map((c) => [compressPath(c), F(c).label, c]), false)}<div class="chip-to" aria-hidden="true">SMALLER</div><div class="chip chip-accent">${f.label}</div></div>`,
    DROP_TITLE: `Select your ${f.label} files to compress`, DROP_SUB: `or drop your ${f.label} files here`,
    CARDS: cardHtml(slug),
    NOTES_SECTION: '', FAQ_SECTION: faqHtml(faq),
    RELATED_SECTION: `<section class="related"><h2>Related tools</h2>${chips([...others, ...conv])}</section>`,
  }));
}

function homePage(base) {
  const title = `Image Compressor and Converter - JPG, PNG, WebP, AVIF, GIF | ${SITE}`;
  const desc = 'Compress and convert images online: JPG, PNG, WebP, AVIF, TIFF, GIF, BMP, SVG and ICO. Batch process and download as a ZIP. Free, no sign-up.';
  const faq = FAQ_COMMON;
  const pop = POPULAR.map(([f, t]) => [pairPath(f, t), `${F(f).label} to ${F(t).label}`]);
  const comp = COMPRESSIBLE.slice(0, 4).map((s) => [compressPath(s), `Compress ${F(s).label}`]);
  return render(PAGE_TPL, baseFields(base, '/', title, desc, {
    JSONLD: graph(base, '/', `${SITE} Image Compressor and Converter`, desc, faq, [['Home', '/']]),
    DEFAULT_FORMAT: 'auto', H1: 'Compress and convert images online',
    INTRO: 'Squeeze image files down or switch them between JPG, PNG, WebP, AVIF, TIFF, GIF, BMP, SVG and ICO. Drop in as many files as you like, choose the quality, and download the results one by one or as a ZIP.',
    HERO_VISUAL: '', DROP_TITLE: 'Select your images', DROP_SUB: 'JPG, PNG, WebP, AVIF, TIFF, GIF, BMP, SVG or drop them here',
    CARDS: '', NOTES_SECTION: '', FAQ_SECTION: faqHtml(faq),
    RELATED_SECTION: `<section class="related"><h2>Popular tools</h2>${chips([...pop, ...comp])}</section>`,
  }));
}

function hubPage(base) {
  const sections = INPUTS.map((i) => {
    const items = outputsFor(i).map((o) => [pairPath(i, o), `${F(i).label} to ${F(o).label}`]);
    return `<section id="from-${i}" class="hub-section"><h2>Convert ${F(i).label}</h2>${chips(items)}</section>`;
  }).join('');
  const comp = `<section id="compress" class="hub-section"><h2>Compress images</h2>${chips(COMPRESSIBLE.map((s) => [compressPath(s), `Compress ${F(s).label}`]))}</section>`;
  return render(HUB_TPL, {
    TITLE: `All Image Converters and Compressors | ${SITE}`,
    META_DESC: 'Every image conversion and compression tool in one place: JPG, PNG, WebP, AVIF, TIFF, GIF, BMP, SVG and ICO.',
    ROBOTS: 'index, follow', CANONICAL_TAG: `<link rel="canonical" href="${base}/converters">`,
    TOPBAR: topbar(), FOOTER: footer(), H1: 'All image converters',
    INTRO: 'Pick the conversion you need. Every tool works the same way: drop in files, set the quality, download the result.',
    BODY: comp + sections,
  });
}

function notFoundPage() {
  return render(HUB_TPL, {
    TITLE: `Page not found | ${SITE}`, META_DESC: 'This page does not exist.', ROBOTS: 'noindex', CANONICAL_TAG: '',
    TOPBAR: topbar(), FOOTER: footer(), H1: 'Page not found',
    INTRO: 'That converter is not available. Here are the ones that are.',
    BODY: `<section class="hub-section"><h2>Popular tools</h2>${chips(POPULAR.map(([f, t]) => [pairPath(f, t), `${F(f).label} to ${F(t).label}`]))}<p>${link('/converters', 'See all converters')}</p></section>`,
  });
}

// ---------------------------------------------------------------- routing --
// URL resolution (aliases, redirects, "is this pair supported") lives in the registry.
// This only limits it to the image pages these templates can render (see header note).
const isImagePage = (r) => !!r && r.from && r.to && isImage(r.from.id) && isImage(r.to.id);

function resolvePage(urlPath) {
  const r = registry.resolveRoute(urlPath);
  if (!r) return null;
  if (r.redirect) return isImagePage(registry.resolveRoute(r.redirect)) ? { redirect: r.redirect } : null;
  return isImagePage(r) ? r : null;
}

function resolvePair(rawFrom, rawTo, base) {
  const r = resolvePage(`/${rawFrom}-to-${rawTo}`);
  if (!r) return null;
  if (r.redirect) return { redirect: r.redirect };
  return { html: pairPage(r.from.id, r.to.id, base) };
}

function resolveCompress(raw, base) {
  const r = resolvePage(`/compress-${raw}`);
  if (!r) return null;
  if (r.redirect) return { redirect: r.redirect };
  return { html: compressPage(r.from.id, base) };
}

function allPaths() {
  return [
    '/', '/converters',
    ...registry.getConverters(PAGE_SCOPE).map((c) => c.route),
    ...COMPRESSIBLE.map((s) => compressPath(s)),
  ];
}

function sitemap(base) {
  const urls = allPaths().map((p) => `  <url><loc>${base}${p === '/' ? '/' : p}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const robots = (base) => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;

module.exports = { homePage, hubPage, notFoundPage, resolvePair, resolveCompress, sitemap, robots, allPaths };
