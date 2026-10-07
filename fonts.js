'use strict';
// Font files for the PDF editor, fetched once from Google Fonts and kept on disk.
//   GET /fonts/:id/:variant.ttf   variant = 400 | 700 | 400i | 700i (falls back to the closest one)
//   GET /fonts/:id/meta.json      { variants, ascent, descent } (ascent/descent per em, for text placement)
// Only families listed in public/editor-fonts.json can be requested, and only Google's own hosts
// are fetched. TrueType files are used because the PDF writer (pdf-lib + fontkit) embeds them.
const fs = require('fs');
const os = require('os');
const path = require('path');

const CATALOG = require('./public/editor-fonts.json');
const BY_ID = new Map(CATALOG.map((f) => [f.id, f]));
const DIR = process.env.FONT_CACHE_DIR || path.join(os.tmpdir(), 'flipit-fonts');
const VARIANTS = ['400', '700', '400i', '700i'];
const pending = new Map();

async function get(url, as) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
  return as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
}

// variant -> TTF url, from Google's CSS (which serves TrueType to clients that do not say otherwise)
async function sources(fam) {
  const file = path.join(DIR, `${fam.id}.json`);
  try { return JSON.parse(await fs.promises.readFile(file, 'utf8')); } catch { /* not cached yet */ }
  const name = encodeURIComponent(fam.name).replace(/%20/g, '+');
  let css = null;
  for (const axes of [':ital,wght@0,400;0,700;1,400;1,700', ':wght@400;700', '']) {
    try { css = await get(`https://fonts.googleapis.com/css2?family=${name}${axes}`, 'text'); break; } catch (e) { if (e.status !== 400) throw e; }
  }
  const out = {};
  for (const block of String(css).split('@font-face').slice(1)) {
    const style = /font-style:\s*(\w+)/.exec(block), weight = /font-weight:\s*(\d+)/.exec(block);
    const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/.exec(block);
    if (!style || !weight || !url) continue;
    const key = `${weight[1]}${style[1] === 'italic' ? 'i' : ''}`;
    if (VARIANTS.includes(key) && !out[key]) out[key] = url[1];
  }
  if (!out['400']) out['400'] = out['700'] || out['400i'] || Object.values(out)[0];
  if (!out['400']) throw new Error('no TrueType file for this family');
  await fs.promises.mkdir(DIR, { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(out));
  return out;
}

const best = (src, v) => src[v] ? v : (v.endsWith('i') && src[v.slice(0, -1)] ? v.slice(0, -1) : (v === '700i' && src['400i'] ? '400i' : '400'));

async function fontFile(id, variant) {
  const fam = BY_ID.get(id);
  if (!fam || !VARIANTS.includes(variant)) return null;
  const key = `${id}-${variant}`;
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    const src = await sources(fam);
    const v = best(src, variant);
    const file = path.join(DIR, `${id}-${v}.ttf`);
    try { return await fs.promises.readFile(file); } catch { /* download */ }
    const buf = await get(src[v]);
    await fs.promises.writeFile(file, buf);
    return buf;
  })();
  pending.set(key, job);
  try { return await job; } finally { pending.delete(key); }
}

async function fontMeta(id) {
  const fam = BY_ID.get(id);
  if (!fam) return null;
  const src = await sources(fam);
  const buf = await fontFile(id, '400');
  let ascent = 0.9, descent = 0.22;
  try {
    const f = require('@pdf-lib/fontkit').create(buf);
    ascent = f.ascent / f.unitsPerEm; descent = Math.abs(f.descent) / f.unitsPerEm;
  } catch { /* keep defaults */ }
  return { id, name: fam.name, variants: VARIANTS.filter((v) => src[v]), ascent: Math.round(ascent * 1000) / 1000, descent: Math.round(descent * 1000) / 1000 };
}

function routes(app) {
  app.get(/^\/fonts\/([a-z0-9-]+)\/(400|700|400i|700i)\.ttf$/, async (req, res) => {
    try {
      const buf = await fontFile(req.params[0], req.params[1]);
      if (!buf) return res.status(404).type('text/plain').send('Unknown font');
      res.set('Cache-Control', 'public, max-age=2592000, immutable').type('font/ttf').send(buf);
    } catch (e) { console.error('font', req.params[0], e.message); res.status(502).type('text/plain').send('Font not available right now'); }
  });
  app.get(/^\/fonts\/([a-z0-9-]+)\/meta\.json$/, async (req, res) => {
    try {
      const meta = await fontMeta(req.params[0]);
      if (!meta) return res.status(404).json({ error: 'Unknown font' });
      res.set('Cache-Control', 'public, max-age=86400').json(meta);
    } catch (e) { console.error('font', req.params[0], e.message); res.status(502).json({ error: 'Font not available right now' }); }
  });
}

module.exports = { routes, fontFile, fontMeta, CATALOG };
