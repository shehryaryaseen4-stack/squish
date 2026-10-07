'use strict';
// Every HTML page of the site. All text that is not page-specific copy lives in content/.

const config = require('../config');
const { CATEGORIES, INPUTS, TOOLS, getTool, getCategory, toolsIn, popularTools } = require('../tools');
const { toolAvailable } = require('../engines');
const { ocrLanguages } = require('../engines/detect');
const site = require('../../content/site-content');
const { page, adSlot, esc, fill, icon, SITE } = require('./layout');

let TOOL_COPY = {};
try { TOOL_COPY = require('../../content/tools-content'); } catch { /* copy not written yet */ }

const copyOf = (t) => TOOL_COPY[t.slug] || {
  title: `${t.name} Online Free`, description: t.short, h1: t.name, lead: t.short, intro: [t.short], steps: [], features: [], faqs: [],
};
const fullTitle = (title) => (`${title} | ${SITE}`.length <= 65 ? `${title} | ${SITE}` : title);

// ------------------------------------------------------------ structured data --
function orgNode(base) {
  return {
    '@type': 'Organization', '@id': `${base}/#org`, name: SITE, url: `${base}/`, logo: `${base}/icon-512.png`,
    ...(config.CONTACT_EMAIL ? { email: config.CONTACT_EMAIL } : {}),
  };
}
const websiteNode = (base) => ({
  '@type': 'WebSite', '@id': `${base}/#website`, url: `${base}/`, name: SITE, publisher: { '@id': `${base}/#org` },
  potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${base}/tools?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
});
const faqNode = (faqs) => ({
  '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: fill(f.q), acceptedAnswer: { '@type': 'Answer', text: fill(f.a) } })),
});
const crumbsNode = (base, items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${base}${p}` })),
});

// ------------------------------------------------------------------ fragments --
function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([name, p], i) => (i === items.length - 1
    ? `<li aria-current="page">${esc(name)}</li>` : `<li><a href="${p}">${esc(name)}</a></li>`)).join('')}</ol></nav>`;
}

function toolCard(t, { big = false } = {}) {
  const where = t.runs === 'browser' ? '<span class="badge badge--local">In browser</span>' : '';
  return `<a class="tool-card${big ? ' tool-card--big' : ''}" href="/${t.slug}" data-tool-card data-name="${esc(t.name.toLowerCase())}" data-keywords="${esc(`${t.keywords || ''} ${t.short}`.toLowerCase())}" data-cat="${t.category}">
  <span class="tile tile--${t.category}">${icon(t.icon)}</span>
  <span class="tool-card__body"><span class="tool-card__name">${esc(t.name)}</span><span class="tool-card__desc">${esc(t.short)}</span>${big ? '' : where}</span>
  ${big ? where : ''}</a>`;
}

function faqList(faqs, id = 'faq') {
  return `<div class="faq" id="${id}">${faqs.map((f) => `<details class="faq__item"><summary><span>${esc(fill(f.q))}</span>${icon('plus', { size: 18, cls: 'faq__icon' })}</summary><div class="faq__a"><p>${esc(fill(f.a))}</p></div></details>`).join('')}</div>`;
}

function categorySection(c, { headingLevel = 'h3' } = {}) {
  return `<section class="cat-block" id="${c.id}" data-cat-block="${c.id}" aria-labelledby="cat-${c.id}">
  <div class="cat-block__head"><${headingLevel} id="cat-${c.id}" class="cat-block__title"><span class="dot" style="--c:${c.color}"></span>${esc(c.name)}</${headingLevel}><p>${esc(c.blurb)}</p></div>
  <div class="tool-grid">${toolsIn(c.id).map((t) => toolCard(t)).join('')}</div>
</section>`;
}

// ----------------------------------------------------------------------- home --
// What the homepage drop box offers for each kind of file (popular tools first).
function suggestData() {
  const order = ['merge-pdf', 'compress-pdf', 'pdf-to-word', 'split-pdf', 'edit-pdf', 'sign-pdf', 'pdf-to-jpg', 'jpg-to-pdf', 'png-to-pdf'];
  const rank = (t) => (order.includes(t.slug) ? order.indexOf(t.slug) : 100);
  return TOOLS.filter(toolAvailable).sort((a, b) => rank(a) - rank(b)).map((t) => ({
    slug: t.slug, name: t.name, exts: INPUTS[t.input].exts, multiple: !!t.multiple, min: t.minFiles || 1,
    icon: `<span class="tile tile--sm tile--${t.category}">${icon(t.icon, { size: 18 })}</span>`,
  }));
}

function home(base) {
  const steps = [
    ['upload', 'Upload your file', 'Drag a file onto the page or tap the button. PDFs, images and Office documents all work.'],
    ['layers', 'Choose what to do', 'Pick a tool: merge, convert, compress, sign and more. Adjust the settings if you like.'],
    ['download', 'Download the result', 'Your new file is ready in seconds. Download it, or keep going with another tool.'],
  ];
  const counts = { browser: TOOLS.filter((t) => t.runs === 'browser').length, all: TOOLS.length };
  const body = `
<section class="hero">
  <div class="wrap hero__inner">
    <div class="hero__copy">
      <p class="eyebrow">${icon('gift', { size: 16 })} 100% free · no account needed</p>
      <h1>Free Online PDF Tools for Everyone</h1>
      <p class="hero__lead">Convert, compress, merge, split, edit, sign and protect PDFs in a few clicks. Every tool is free, with no sign-up, no watermarks and no limits hidden behind a paywall.</p>
    </div>
    <div class="hero-drop" data-home-drop>
      <div class="dropzone dropzone--hero" data-dropzone tabindex="-1">
        <span class="dropzone__icon">${icon('upload', { size: 30 })}</span>
        <p class="dropzone__title">Drop a file here to get started</p>
        <p class="dropzone__or">PDF, Word, Excel, PowerPoint, JPG, PNG or HTML</p>
        <button class="btn btn--primary btn--lg" type="button" data-pick>${icon('plus', { size: 20 })}Choose file</button>
        <input type="file" hidden data-input accept=".pdf,.jpg,.jpeg,.jfif,.png,.webp,.tif,.tiff,.bmp,.doc,.docx,.odt,.rtf,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.pps,.ppsx,.html,.htm" multiple>
      </div>
      <div class="hero-suggest" data-suggest hidden aria-live="polite"></div>
      <script type="application/json" id="suggest-data">${JSON.stringify(suggestData()).replace(/</g, '\\u003c')}</script>
      <ul class="hero__trust">
        <li>${icon('check', { size: 16 })}No sign-up</li>
        <li>${icon('check', { size: 16 })}No watermarks</li>
        <li>${icon('check', { size: 16 })}Files deleted automatically</li>
      </ul>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    <ul class="facts">
      <li><strong>${counts.all}</strong><span>PDF tools, all free</span></li>
      <li><strong>${counts.browser}</strong><span>run entirely in your browser</span></li>
      <li><strong>0</strong><span>accounts, trials or paywalls</span></li>
      <li><strong>${config.MAX_UPLOAD_MB} MB</strong><span>upload limit for server tools</span></li>
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="popular">
  <div class="wrap">
    <div class="section__head"><h2 id="popular">Most popular tools</h2><a class="link-more" href="/tools">See all ${TOOLS.length} tools ${icon('arrow-right', { size: 16 })}</a></div>
    <div class="tool-grid tool-grid--popular">${popularTools().map((t) => toolCard(t, { big: true })).join('')}</div>
  </div>
</section>

<div class="wrap">${adSlot('content')}</div>

<section class="section section--alt" aria-labelledby="all-tools">
  <div class="wrap">
    <div class="section__head"><h2 id="all-tools">Every PDF tool you need</h2><p>Organized by what you want to get done.</p></div>
    ${CATEGORIES.map((c) => categorySection(c)).join('')}
  </div>
</section>

<section class="section" aria-labelledby="how">
  <div class="wrap">
    <div class="section__head section__head--center"><h2 id="how">How it works</h2><p>Three steps, no learning curve.</p></div>
    <ol class="steps">${steps.map(([ic, h, p], i) => `<li class="step"><span class="step__num">${i + 1}</span><span class="step__icon">${icon(ic, { size: 26 })}</span><h3>${h}</h3><p>${p}</p></li>`).join('')}</ol>
  </div>
</section>

<section class="section section--dark" aria-labelledby="privacy">
  <div class="wrap privacy">
    <div class="privacy__intro">
      <span class="privacy__badge">${icon('shield', { size: 30 })}</span>
      <h2 id="privacy">Your files stay private</h2>
      <p>Most tools here run right inside your browser, so the file never leaves your device. When a tool needs our server, the file is processed in a private temporary folder and deleted as soon as you get your result.</p>
      <a class="btn btn--light" href="/privacy">Read how we handle files</a>
    </div>
    <ul class="privacy__points">${site.privacySummary.map((p, i) => `<li>${icon(['device', 'clock', 'user', 'shield'][i] || 'check', { size: 22 })}<div><h3>${esc(fill(p.title))}</h3><p>${esc(fill(p.text))}</p></div></li>`).join('')}</ul>
  </div>
</section>

<section class="section" aria-labelledby="faq-h">
  <div class="wrap wrap--narrow">
    <div class="section__head section__head--center"><h2 id="faq-h">Frequently asked questions</h2></div>
    ${faqList(site.homeFaqs)}
  </div>
</section>

<div class="wrap">${adSlot('top')}</div>

<section class="section section--cta">
  <div class="wrap cta">
    <h2>Ready when you are</h2>
    <p>Pick a tool and get your PDF sorted in seconds. Free, today and tomorrow.</p>
    <a class="btn btn--primary btn--lg" href="/tools">Browse all tools</a>
  </div>
</section>`;
  return page({
    title: `Free Online PDF Tools: Convert, Merge, Compress | ${SITE}`.length <= 65
      ? `Free Online PDF Tools: Convert, Merge, Compress | ${SITE}` : `Free Online PDF Tools | ${SITE}`,
    description: `Free online PDF tools: convert PDF to Word, JPG and Excel, merge, split, compress, edit, sign and protect PDFs. No sign-up, no watermarks.`,
    path: '/', body, ads: true, bodyClass: 'page-home', active: '',
    jsonld: [orgNode(base), websiteNode(base), faqNode(site.homeFaqs)],
  }, base);
}

// ------------------------------------------------------------------ all tools --
function allTools(base) {
  const body = `
<section class="page-head">
  <div class="wrap">
    ${crumbs([['Home', '/'], ['All PDF tools', '/tools']])}
    <h1>All PDF tools</h1>
    <p class="page-head__lead">${TOOLS.length} free tools to convert, organize, edit, compress and secure PDF files. Search or browse by category.</p>
    <div class="tool-search" role="search">
      <label class="visually-hidden" for="tool-q">Search PDF tools</label>
      ${icon('search', { size: 20, cls: 'tool-search__icon' })}
      <input id="tool-q" type="search" placeholder="Search PDF tools..." autocomplete="off" data-tool-search>
    </div>
    <div class="chips" role="group" aria-label="Filter by category">
      <button class="chip is-active" type="button" data-filter="all" aria-pressed="true">All</button>
      ${CATEGORIES.map((c) => `<button class="chip" type="button" data-filter="${c.id}" aria-pressed="false">${esc(c.short)}</button>`).join('')}
    </div>
  </div>
</section>
<section class="section section--flush">
  <div class="wrap">
    <p class="search-status" data-search-status aria-live="polite"></p>
    ${CATEGORIES.map((c) => categorySection(c, { headingLevel: 'h2' })).join('')}
    <div class="empty" data-search-empty hidden>
      ${icon('search', { size: 34 })}
      <h2>No tools match your search</h2>
      <p>Try a simpler word like “merge”, “word”, “compress” or “sign”.</p>
      <button class="btn btn--ghost" type="button" data-search-clear>Clear search</button>
    </div>
  </div>
</section>
<div class="wrap">${adSlot('content')}</div>`;
  return page({
    title: fullTitle('All PDF Tools: Free & Online'),
    description: `Browse all ${TOOLS.length} free PDF tools: convert, merge, split, compress, edit, sign, protect, unlock and OCR PDF files online, with no sign-up.`,
    path: '/tools', body, ads: true, active: 'all',
    jsonld: [orgNode(base), crumbsNode(base, [['Home', '/'], ['All PDF tools', '/tools']]),
      { '@type': 'CollectionPage', name: 'All PDF tools', url: `${base}/tools`, isPartOf: { '@id': `${base}/#website` } }],
  }, base);
}

function category(base, c) {
  const others = CATEGORIES.filter((x) => x.id !== c.id);
  const body = `
<section class="page-head">
  <div class="wrap">
    ${crumbs([['Home', '/'], ['All PDF tools', '/tools'], [c.name, `/tools/${c.id}`]])}
    <h1>${esc(c.name)} tools</h1>
    <p class="page-head__lead">${esc(c.blurb)} All free, no sign-up.</p>
  </div>
</section>
<section class="section section--flush">
  <div class="wrap">
    <div class="tool-grid">${toolsIn(c.id).map((t) => toolCard(t)).join('')}</div>
    ${adSlot('content')}
    <h2 class="sub-head">More PDF tools</h2>
    <div class="cat-links">${others.map((o) => `<a class="cat-link" href="/tools/${o.id}"><span class="dot" style="--c:${o.color}"></span><strong>${esc(o.name)}</strong><span>${toolsIn(o.id).length} tools</span></a>`).join('')}</div>
  </div>
</section>`;
  return page({
    title: fullTitle(`${c.name} Tools Online, Free`),
    description: `${c.blurb} ${toolsIn(c.id).length} free online tools, no sign-up or watermark.`.slice(0, 160),
    path: `/tools/${c.id}`, body, ads: true, active: c.id,
    jsonld: [orgNode(base), crumbsNode(base, [['Home', '/'], ['All PDF tools', '/tools'], [c.name, `/tools/${c.id}`]]),
      { '@type': 'CollectionPage', name: `${c.name} tools`, url: `${base}/tools/${c.id}`, isPartOf: { '@id': `${base}/#website` } }],
  }, base);
}

// ----------------------------------------------------------------------- tool --
// Tools offered after a result, that can take the result file straight away.
function nextTools(t) {
  const fits = (x) => x.slug !== t.slug && toolAvailable(x) && INPUTS[x.input].exts.includes(t.output);
  const picks = [...t.related.map(getTool), ...popularTools(), ...TOOLS].filter(fits);
  return [...new Set(picks)].slice(0, 4).map((x) => ({ slug: x.slug, name: x.name, cat: x.category, icon: icon(x.icon, { size: 18 }) }));
}

function clientConfig(t) {
  const input = INPUTS[t.input];
  return {
    slug: t.slug, name: t.name, runs: t.runs, module: t.module, fn: t.fn, params: t.params || {},
    input: { kind: t.input, label: input.label, exts: input.exts, mimes: input.mimes },
    multiple: !!t.multiple, minFiles: t.minFiles || 1, maxFiles: t.multiple ? (t.maxFiles || 20) : 1,
    maxMB: t.runs === 'server' ? config.MAX_UPLOAD_MB : config.MAX_BROWSER_MB,
    workspace: t.workspace, pageMode: t.pageMode || null, editorTools: t.editorTools || null, defaultTool: t.defaultTool || null,
    loadMetadata: !!t.loadMetadata, action: t.action, output: t.output,
    options: t.options.map((o) => (o.choices === 'ocrLanguages' ? { ...o, choices: ocrLanguages() } : o)),
    next: nextTools(t),
  };
}

function tool(base, t) {
  const c = copyOf(t);
  const cat = getCategory(t.category);
  const available = toolAvailable(t);
  const input = INPUTS[t.input];
  const accept = input.exts.map((e) => `.${e}`).join(',');
  const many = t.multiple;
  const fileWord = `${input.label} file${many ? 's' : ''}`;
  const where = t.runs === 'browser'
    ? `<span class="where where--local">${icon('device', { size: 16 })}Runs in your browser: your file never leaves your device</span>`
    : `<span class="where where--server">${icon('shield', { size: 16 })}Secure processing: files are deleted right after</span>`;
  const limit = t.runs === 'server' ? `Up to ${config.MAX_UPLOAD_MB} MB` : (many ? `Up to ${t.maxFiles || 20} files` : 'Large files welcome');
  const related = t.related.map(getTool);
  const crumbItems = [['Home', '/'], [`${cat.name} tools`, `/tools/${cat.id}`], [t.name, `/${t.slug}`]];

  const app = available ? `
<div class="tool-app" id="tool-app" data-state="initial">
  <div class="dropzone dropzone--tool" data-dropzone>
    <span class="dropzone__icon">${icon('upload', { size: 30 })}</span>
    <p class="dropzone__title">Drop ${esc(fileWord)} here</p>
    <p class="dropzone__or">or</p>
    <button class="btn btn--primary btn--lg" type="button" data-pick>${icon('plus', { size: 20 })}Select ${esc(fileWord)}</button>
    <input type="file" hidden data-input accept="${accept}"${many ? ' multiple' : ''}>
    <p class="dropzone__hint">${esc(input.exts.map((e) => e.toUpperCase()).join(', '))} · ${esc(limit)}</p>
  </div>
  <noscript><p class="notice notice--error">This tool needs JavaScript. Please turn it on in your browser to use it.</p></noscript>
</div>
<script type="application/json" id="tool-config">${JSON.stringify(clientConfig(t)).replace(/</g, '\\u003c')}</script>`
    : `<div class="notice notice--warn">${icon('alert', { size: 22 })}<div><strong>${esc(t.name)} isn’t available on this server right now.</strong><p>The engine this tool needs is not installed here. Please try one of the related tools below, or come back later.</p></div></div>`;

  const body = `
<section class="tool-hero">
  <div class="wrap">
    ${crumbs(crumbItems)}
    <div class="tool-hero__head">
      <span class="tile tile--lg tile--${t.category}">${icon(t.icon, { size: 30 })}</span>
      <div>
        <h1>${esc(c.h1)}</h1>
        <p class="tool-hero__lead">${esc(fill(c.lead))}</p>
      </div>
    </div>
    ${where}
    ${app}
  </div>
</section>
<div class="wrap">${adSlot('tool')}</div>
<article class="section tool-content">
  <div class="wrap tool-content__grid">
    <div class="prose">
      <h2>About ${esc(t.name)}</h2>
      ${c.intro.map((p) => `<p>${esc(fill(p))}</p>`).join('')}
      ${c.steps.length ? `<h2>How to use ${esc(t.name)}</h2><ol class="howto">${c.steps.map((s) => `<li>${esc(fill(s))}</li>`).join('')}</ol>` : ''}
      ${c.features.length ? `<div class="features">${c.features.map((f) => `<div class="feature"><h3>${esc(fill(f.title))}</h3><p>${esc(fill(f.text))}</p></div>`).join('')}</div>` : ''}
      ${c.faqs.length ? `<h2>${esc(t.name)} FAQ</h2>${faqList(c.faqs)}` : ''}
    </div>
    <aside class="side">
      <div class="side__box">
        <h2 class="side__title">Related tools</h2>
        <div class="side__tools">${related.map((r) => `<a class="mini-tool" href="/${r.slug}"><span class="tile tile--sm tile--${r.category}">${icon(r.icon, { size: 18 })}</span>${esc(r.name)}</a>`).join('')}</div>
      </div>
      <div class="side__box side__box--soft">
        <h2 class="side__title">${icon('shield', { size: 18 })} Private by design</h2>
        <p>${t.runs === 'browser' ? 'This tool works entirely in your browser. Your file is not uploaded anywhere.' : 'Your file is sent over HTTPS, processed in a private temporary folder and deleted as soon as the result is ready.'} <a href="/privacy">Learn more</a>.</p>
      </div>
    </aside>
  </div>
</article>
<section class="section section--alt">
  <div class="wrap">
    <div class="section__head"><h2>More ${esc(cat.short.toLowerCase())} tools</h2><a class="link-more" href="/tools">All tools ${icon('arrow-right', { size: 16 })}</a></div>
    <div class="tool-grid">${toolsIn(cat.id).filter((x) => x.slug !== t.slug).slice(0, 8).map((x) => toolCard(x)).join('')}</div>
  </div>
</section>`;

  const jsonld = [orgNode(base), crumbsNode(base, crumbItems), {
    '@type': 'WebApplication', name: t.name, url: `${base}/${t.slug}`, description: fill(c.description),
    applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript and a modern web browser',
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@id': `${base}/#org` },
  }];
  if (c.faqs.length) jsonld.push(faqNode(c.faqs));
  return page({
    title: fullTitle(c.title), description: fill(c.description), path: `/${t.slug}`, body, ads: available,
    noindex: !available, active: t.slug === 'compress-pdf' ? 'optimize' : t.category, bodyClass: 'page-tool',
    scripts: available ? ['/js/tool.js'] : [], jsonld,
  }, base);
}

// ---------------------------------------------------------------------- legal --
function textPage(base, { slug, name, h1, description, updated, sections, paragraphs, extra = '' }) {
  const visible = (s) => (config.CONTACT_EMAIL || !s.includes('{email}'));
  const para = (p) => (visible(p) ? `<p>${linkify(esc(fill(p)))}</p>` : '');
  const body = `
<section class="page-head">
  <div class="wrap wrap--narrow">
    ${crumbs([['Home', '/'], [name, `/${slug}`]])}
    <h1>${esc(h1)}</h1>
    ${updated ? `<p class="muted">Last updated: ${esc(updated)}</p>` : ''}
  </div>
</section>
<section class="section section--flush">
  <div class="wrap wrap--narrow prose">
    ${(paragraphs || []).map(para).join('')}
    ${(sections || []).map((s) => `<h2>${esc(fill(s.heading))}</h2>${(s.paragraphs || []).map(para).join('')}${s.list ? `<ul>${s.list.filter(visible).map((li) => `<li>${linkify(esc(fill(li)))}</li>`).join('')}</ul>` : ''}`).join('')}
    ${extra}
  </div>
</section>`;
  return page({ title: fullTitle(name), description: fill(description), path: `/${slug}`, body, jsonld: [orgNode(base), crumbsNode(base, [['Home', '/'], [name, `/${slug}`]])] }, base);
}
// Plain-text URLs and the contact email become links.
function linkify(s) {
  return s.replace(/https?:\/\/[^\s<]+[^\s<.,;:)]/g, (u) => `<a href="${u}" rel="noopener" target="_blank">${u}</a>`)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+[a-z]/gi, (m) => `<a href="mailto:${m}">${m}</a>`);
}

const about = (base) => textPage(base, { slug: 'about', name: 'About', h1: `About ${SITE}`, ...site.about });
const privacy = (base) => textPage(base, { slug: 'privacy', name: 'Privacy Policy', h1: 'Privacy Policy', ...site.privacy });
const terms = (base) => textPage(base, { slug: 'terms', name: 'Terms of Use', h1: 'Terms of Use', ...site.terms });
const cookies = (base) => textPage(base, { slug: 'cookies', name: 'Cookie Policy', h1: 'Cookie Policy', ...site.cookies });
const contact = (base) => textPage(base, {
  slug: 'contact', name: 'Contact', h1: 'Contact us', ...site.contact,
  extra: config.CONTACT_EMAIL ? `<p class="contact-card">${icon('annotate', { size: 22 })}<a href="mailto:${esc(config.CONTACT_EMAIL)}">${esc(config.CONTACT_EMAIL)}</a></p>` : '',
});

function notFound(base) {
  const body = `<section class="section"><div class="wrap wrap--narrow empty empty--page">
  ${icon('doc', { size: 40 })}
  <h1>We couldn’t find that page</h1>
  <p>The link may be old or mistyped. Every tool is listed on the tools page.</p>
  <div class="btn-row"><a class="btn btn--primary" href="/tools">See all tools</a><a class="btn btn--ghost" href="/">Go to the homepage</a></div>
  <div class="tool-grid tool-grid--compact">${popularTools().slice(0, 6).map((t) => toolCard(t)).join('')}</div>
</div></section>`;
  return page({ title: `Page not found | ${SITE}`, description: 'This page does not exist.', path: '/404', body, noindex: true }, base);
}

module.exports = { home, allTools, category, tool, about, privacy, terms, cookies, contact, notFound, copyOf, fullTitle };
