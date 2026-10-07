'use strict';
// Page shell: <head> (meta, social, structured data), header with menus, footer, ad slots.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { CATEGORIES, toolsIn } = require('../tools');
const { icon } = require('./icons');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SITE = config.SITE_NAME;
const fill = (s) => String(s).replaceAll('{site}', SITE).replaceAll('{email}', config.CONTACT_EMAIL);

// Static files are served as /path?v=<content hash> and cached for a year.
const PUBLIC = path.join(__dirname, '..', '..', 'public');
const versions = new Map();
function asset(p) {
  if (!versions.has(p)) {
    let v = 'dev';
    try { v = crypto.createHash('sha1').update(fs.readFileSync(path.join(PUBLIC, p))).digest('hex').slice(0, 10); } catch { /* missing file */ }
    versions.set(p, v);
  }
  return `${p}?v=${versions.get(p)}`;
}

// Logo: a page with a folded corner, the fold forming an arrow (made by us for this site).
const MARK = '<svg class="logo__mark" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" focusable="false">'
  + '<rect width="34" height="34" rx="9" fill="#e8452c"/>'
  + '<path d="M10 7.5h9.5l6 6V25a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 25V9A1.5 1.5 0 0 1 10 7.5z" fill="#fff"/>'
  + '<path d="M19.5 7.5v4.5a1.5 1.5 0 0 0 1.5 1.5h4.5z" fill="#ffc9bd"/>'
  + '<path d="M12.5 17.5h9M12.5 21h6" stroke="#e8452c" stroke-width="1.9" stroke-linecap="round"/></svg>';
// "PDFKaro" -> PDF + <accent>Karo</accent>; other names are shown as they are.
const wordmark = /^PDF.+/.test(SITE) ? `PDF<span class="logo__accent">${esc(SITE.slice(3))}</span>` : esc(SITE);
const logo = (href = '/') => `<a class="logo" href="${href}" aria-label="${esc(SITE)} home">${MARK}<span class="logo__text">${wordmark}</span></a>`;

// ------------------------------------------------------------------ ad slots --
// Reserved, clearly separated places for Google AdSense. Nothing is rendered until ads are
// configured (ADSENSE_CLIENT + a slot id), so there are no empty boxes or fake ads.
// SHOW_AD_PLACEHOLDERS=1 outlines the reserved places while working on the layout.
function adSlot(name) {
  const slot = config.ADSENSE_SLOTS[name];
  if (config.ADSENSE_CLIENT && slot) {
    return `<aside class="ad ad--${name}" aria-label="Advertisement"><span class="ad__label">Advertisement</span>`
      + `<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(config.ADSENSE_CLIENT)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;
  }
  if (config.SHOW_AD_PLACEHOLDERS) return `<aside class="ad ad--${name} ad--placeholder" aria-hidden="true"><span>Ad space: ${esc(name)}</span></aside>`;
  return '';
}

// --------------------------------------------------------------------- header --
const NAV = [
  { cat: 'convert', label: 'Convert PDF' },
  { cat: 'organize', label: 'Organize PDF' },
  { cat: 'edit', label: 'Edit PDF' },
  { href: '/compress-pdf', label: 'Compress PDF', cat: 'optimize' },
  { cat: 'security', label: 'Security' },
];

function toolLink(t) {
  return `<a class="menu-tool" href="/${t.slug}"><span class="dot tile--${t.category}"></span>${esc(t.name)}</a>`;
}

function megaMenu() {
  return `<div class="mega" role="group" aria-label="All PDF tools">${CATEGORIES.map((c) => `<div class="mega__col"><a class="mega__head" href="/tools/${c.id}">${esc(c.name)}</a>${toolsIn(c.id).map(toolLink).join('')}</div>`).join('')}</div>`;
}

function header(active) {
  const items = NAV.map((n) => {
    const href = n.href || `/tools/${n.cat}`;
    const isActive = active === n.cat ? ' aria-current="page"' : '';
    const drop = n.href ? '' : `<div class="dropdown"><div class="dropdown__inner">${toolsIn(n.cat).map(toolLink).join('')}</div></div>`;
    return `<li class="nav__item${drop ? ' has-drop' : ''}"><a class="nav__link" href="${href}"${isActive}>${esc(n.label)}${drop ? icon('chevron', { size: 14, cls: 'nav__chev' }) : ''}</a>${drop}</li>`;
  }).join('');
  const mobile = CATEGORIES.map((c) => `<details class="m-cat"><summary>${esc(c.name)}${icon('chevron', { size: 16 })}</summary><div class="m-cat__tools">${toolsIn(c.id).map(toolLink).join('')}<a class="m-cat__all" href="/tools/${c.id}">All ${esc(c.short.toLowerCase())} tools</a></div></details>`).join('');
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header__bar">
    ${logo()}
    <nav class="nav" aria-label="Main">
      <ul class="nav__list">
        <li class="nav__item has-drop has-mega"><a class="nav__link" href="/tools"${active === 'all' ? ' aria-current="page"' : ''}>All PDF Tools${icon('chevron', { size: 14, cls: 'nav__chev' })}</a><div class="dropdown dropdown--mega"><div class="dropdown__inner">${megaMenu()}</div></div></li>
        ${items}
      </ul>
    </nav>
    <div class="header__actions">
      <a class="btn btn--primary btn--sm header__cta" href="/tools">${icon('layers', { size: 16 })}All Tools</a>
      <button class="icon-btn menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">${icon('menu')}</button>
    </div>
  </div>
  <div class="mobile-menu" id="mobile-menu" hidden>
    <div class="wrap">
      <a class="btn btn--primary btn--block" href="/tools">${icon('search', { size: 18 })}Search all tools</a>
      ${mobile}
    </div>
  </div>
</header>`;
}

// --------------------------------------------------------------------- footer --
function footer(ads) {
  const cols = CATEGORIES.map((c) => `<div class="footer__col"><h2 class="footer__head"><a href="/tools/${c.id}">${esc(c.name)}</a></h2><ul>${toolsIn(c.id).map((t) => `<li><a href="/${t.slug}">${esc(t.name)}</a></li>`).join('')}</ul></div>`).join('');
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="wrap">
    ${ads ? adSlot('footer') : ''}
    <div class="footer__top">
      <div class="footer__brand">
        ${logo()}
        <p>Free PDF tools that work in your browser. No sign-up, no watermarks, no paywall. Ever.</p>
        <ul class="footer__links">
          <li><a href="/tools">All tools</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/terms">Terms</a></li>
          <li><a href="/cookies">Cookie Policy</a></li>
        </ul>
      </div>
      <div class="footer__cols">${cols}</div>
    </div>
    <div class="footer__bottom">
      <p>© ${year} ${esc(SITE)}. Every tool is free to use.</p>
      <p>${icon('shield', { size: 16 })} Files are processed privately and deleted automatically.</p>
    </div>
  </div>
</footer>`;
}

// ----------------------------------------------------------------------- page --
/**
 * @param {object} p
 * @param {string} p.title         full <title>
 * @param {string} p.description   meta description
 * @param {string} p.path          canonical path ("/merge-pdf")
 * @param {string} p.body          main content HTML
 * @param {object[]} [p.jsonld]    structured data nodes
 * @param {boolean} [p.noindex]
 * @param {string} [p.active]      nav item to mark as current
 * @param {string[]} [p.scripts]   extra module scripts
 * @param {boolean} [p.ads]        page may load the AdSense script
 */
function page(p, base) {
  const url = `${base}${p.path}`;
  const ads = p.ads && config.ADSENSE_CLIENT;
  const graph = p.jsonld && p.jsonld.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': p.jsonld }).replace(/</g, '\\u003c')}</script>` : '';
  const verify = [
    config.GOOGLE_SITE_VERIFICATION && `<meta name="google-site-verification" content="${esc(config.GOOGLE_SITE_VERIFICATION)}">`,
    config.BING_SITE_VERIFICATION && `<meta name="msvalidate.01" content="${esc(config.BING_SITE_VERIFICATION)}">`,
  ].filter(Boolean).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="${p.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE)}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(base)}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="${asset('/css/site.css')}">
${verify}${graph}
<script src="${asset('/js/site.js')}" defer></script>
${(p.scripts || []).map((s) => `<script type="module" src="${asset(s)}"></script>`).join('\n')}
${ads ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(config.ADSENSE_CLIENT)}" crossorigin="anonymous"></script>` : ''}
</head>
<body class="${p.bodyClass || ''}">
${header(p.active)}
<main id="main" tabindex="-1">
${p.body}
</main>
${footer(p.ads)}
</body>
</html>`;
}

module.exports = { page, adSlot, esc, fill, icon, asset, SITE, logo };
