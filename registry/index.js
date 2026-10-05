'use strict';
// Central format & converter registry: the single source of truth for what file types
// exist, which category they belong to, and what can be converted to what.
//
//   categories.js  ->  formats.js  ->  converters.js  ->  this file (builds + validates + API)
//
// Nothing else in the project should hard-code a format list or a conversion pair.
// Use the functions exported at the bottom.
//
// STATUS
//   Every converter is 'live', 'experimental' or 'planned' (see converters.js).
//   A format's `input`/`output` are derived from its converters, as the best status found
//   (or false when nothing reads/writes it), so formats and converters cannot disagree.
//
// DEFAULTS for `minStatus`
//   * Catalog lookups (getFormats, getCategories, searchFormats, getFormat*): everything ('planned')
//   * "Can I do this now?" lookups (getConverters, getCompatible*, isConversionSupported,
//     resolveRoute, metadata, getInputFormats/getOutputFormats): only 'live'
//   Pass { minStatus } to change either. The API accepts 'experimental' so unverified
//   decoders (HEIC) still get tried.

const { CATEGORIES } = require('./categories');
const { FORMATS } = require('./formats');
const { ENGINES } = require('./engines');
const { CONVERSION_RULES, COMPRESS_RULES, POPULAR } = require('./converters');

const STATUS_RANK = Object.freeze({ planned: 1, experimental: 2, live: 3 });
const rank = (s) => STATUS_RANK[s] || 0;
const BROWSER_LEVEL = { N: 'native', L: 'library', X: 'none' };
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const uniq = (a) => [...new Set(a)];

const problems = [];
const problem = (msg) => problems.push(msg);

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

// --------------------------------------------------------------- categories --
const categories = CATEGORIES.map((c, order) => ({ ...c, slug: c.id, order, formatIds: [] }));
const categoryById = new Map();
categories.forEach((c) => {
  if (categoryById.has(c.id)) problem(`duplicate category id "${c.id}"`);
  categoryById.set(c.id, c);
});

// ------------------------------------------------------------------ formats --
const formats = FORMATS.map((f, order) => {
  const extension = f.extension || f.id;
  const aliases = f.aliases || [];
  const code = f.browser || 'XX';
  if (!/^[NLX]{2}$/.test(code)) problem(`format "${f.id}": browser must be two letters of N/L/X, got "${code}"`);
  if (!f.mimeType) problem(`format "${f.id}": mimeType is required`);
  if (!f.description) problem(`format "${f.id}": description is required`);
  return {
    id: f.id,
    extension,
    aliases,
    extensions: uniq([extension, ...aliases]),
    name: f.name,
    label: extension.toUpperCase(),
    altLabel: f.altLabel || null,
    fullName: f.fullName || f.name,
    category: f.category,
    alsoIn: f.alsoIn || [],
    categories: uniq([f.category, ...(f.alsoIn || [])]),
    mimeType: f.mimeType,
    mimeTypes: uniq([f.mimeType, ...(f.mimeTypes || [])]),
    description: f.description,
    icon: f.icon || (categoryById.get(f.category) || {}).icon || 'file',
    browserSupport: { read: BROWSER_LEVEL[code[0]], write: BROWSER_LEVEL[code[1]] },
    apiFormat: f.apiFormat || f.id, // the value POST /api/compress accepts as `format`
    traits: { sizeRank: null, alpha: false, ...(f.traits || {}) },
    notes: f.notes || null,
    order,
    // filled in below from the converter registry:
    input: false,
    output: false,
    status: 'planned',
    backendRequired: false,
  };
});

const formatById = new Map();
const formatByKey = new Map(); // id, extension and every alias -> format
const formatByApi = new Map();
formats.forEach((f) => {
  if (!ID_RE.test(f.id)) problem(`format id "${f.id}" must match ${ID_RE}`);
  if (f.id.includes('-to-')) problem(`format id "${f.id}" must not contain "-to-" (it would break route parsing)`);
  if (formatById.has(f.id)) problem(`duplicate format id "${f.id}"`);
  formatById.set(f.id, f);
  f.aliases.forEach((a) => { if (!ID_RE.test(a)) problem(`format "${f.id}": alias "${a}" must be url-safe`); });
  uniq([f.id, ...f.extensions]).forEach((k) => {
    const key = k.toLowerCase();
    if (formatByKey.has(key) && formatByKey.get(key) !== f) problem(`"${key}" is claimed by both "${formatByKey.get(key).id}" and "${f.id}"`);
    formatByKey.set(key, f);
  });
  if (f.apiFormat) {
    if (formatByApi.has(f.apiFormat)) problem(`apiFormat "${f.apiFormat}" used twice`);
    formatByApi.set(f.apiFormat, f);
  }
  f.categories.forEach((cid) => {
    const c = categoryById.get(cid);
    if (!c) problem(`format "${f.id}": unknown category "${cid}"`);
    else c.formatIds.push(f.id);
  });
});

// ------------------------------------------------------------------ engines --
// 'system' engines are command-line tools: available only when their binaries are installed.
const { hasBin, hasFilesNextTo } = require('../engines/detect');
const engines = ENGINES.map((e) => {
  if (e.status !== 'system') return { ...e, available: e.status === 'installed' };
  const missing = (e.bins || []).filter((b) => !hasBin(b) || (e.binFiles && e.binFiles[b] && !hasFilesNextTo(b, e.binFiles[b])));
  return { ...e, available: missing.length === 0, missingBins: missing };
});
const engineAvailable = (id) => !!(engineById.get(id) || {}).available;
const engineById = new Map();
engines.forEach((e) => {
  if (engineById.has(e.id)) problem(`duplicate engine id "${e.id}"`);
  engineById.set(e.id, e);
});

// --------------------------------------------------------------- converters --
const converters = [];       // type 'convert', in rule order
const converterIndex = new Map(); // "from>to" -> converter
const compressors = [];      // type 'compress'
const compressorIndex = new Map();

function checkEngine(id, where, needUsable) {
  const e = engineById.get(id);
  if (!e) { problem(`${where}: unknown engine "${id}"`); return; }
  if (needUsable && e.status === 'planned') problem(`${where}: engine "${id}" is only planned, so it cannot power a live/experimental converter`);
}

// A live/experimental rule whose engine is not installed on this machine is treated as planned:
// the conversion stays in the catalogue but is not offered until the tool is installed.
function effectiveStatus(rule) {
  if (rule.status === 'planned') return 'planned';
  const ids = [rule.engine, ...Object.values(rule.decoders || {}), ...Object.values(rule.encoders || {}), ...(rule.requires || [])];
  return ids.every(engineAvailable) ? rule.status : 'planned';
}

function checkRule(rule) {
  if (!STATUS_RANK[rule.status]) problem(`rule "${rule.id}": bad status "${rule.status}"`);
  const active = rule.status !== 'planned';
  checkEngine(rule.engine, `rule "${rule.id}"`, active);
  Object.values(rule.decoders || {}).concat(Object.values(rule.encoders || {})).concat(rule.requires || [])
    .forEach((e) => checkEngine(e, `rule "${rule.id}"`, active));
  if (active && !rule.handler) problem(`rule "${rule.id}": live/experimental rules need a handler`);
}

// Where a conversion runs is decided by the engines in its pipeline. If any of them is
// server-only, the conversion needs backend processing (backendRequired: true).
function runtimeInfo(pipeline) {
  const rts = [pipeline.decode, pipeline.encode].map((id) => (engineById.get(id) || {}).runtime);
  const backendRequired = rts.includes('server');
  return { backendRequired, runtime: backendRequired ? 'server' : rts.every((r) => r === 'browser') ? 'browser' : 'both' };
}

const seenRuleIds = new Set();
function checkRuleId(rule) {
  if (seenRuleIds.has(rule.id)) problem(`duplicate rule id "${rule.id}"`);
  seenRuleIds.add(rule.id);
}

CONVERSION_RULES.forEach((rule) => {
  checkRule(rule);
  checkRuleId(rule);
  rule.from.forEach((from) => rule.to.forEach((to) => {
    if (from === to) return; // same-format is compression, handled by COMPRESS_RULES
    if ((rule.except || []).some(([a, b]) => a === from && b === to)) return;
    const ff = formatById.get(from);
    const tf = formatById.get(to);
    if (!ff) { problem(`rule "${rule.id}": unknown from-format "${from}"`); return; }
    if (!tf) { problem(`rule "${rule.id}": unknown to-format "${to}"`); return; }

    const engine = rule.engine;
    const record = {
      id: `${from}>${to}`,
      type: 'convert',
      from, to,
      status: effectiveStatus(rule),
      group: rule.id,
      engine,
      pipeline: { decode: (rule.decoders || {})[from] || engine, encode: (rule.encoders || {})[to] || engine },
      handler: rule.handler || null,
      quality: rule.quality || 'good',
      notes: rule.notes || null,
      route: `/${from}-to-${to}`,
      popularRank: null,
      toIndex: rule.to.indexOf(to),
    };
    Object.assign(record, runtimeInfo(record.pipeline));

    const key = record.id;
    if (converterIndex.has(key)) {
      // Same pair defined twice: keep the position of the first, but upgrade to the better status.
      const existing = converterIndex.get(key);
      if (rank(record.status) > rank(existing.status)) {
        converters[converters.indexOf(existing)] = record;
        converterIndex.set(key, record);
      }
    } else {
      converterIndex.set(key, record);
      converters.push(record);
    }
  }));
});

COMPRESS_RULES.forEach((rule) => {
  checkRule(rule);
  checkRuleId(rule);
  rule.formats.forEach((id) => {
    const f = formatById.get(id);
    if (!f) { problem(`compress rule "${rule.id}": unknown format "${id}"`); return; }
    const record = {
      id: `compress:${id}`, type: 'compress', from: id, to: id, status: effectiveStatus(rule), group: rule.id,
      engine: rule.engine, pipeline: { decode: rule.engine, encode: rule.engine }, handler: rule.handler || null,
      quality: rule.quality || 'good', notes: rule.notes || null,
      route: `/compress-${id}`, popularRank: null, toIndex: 0,
    };
    Object.assign(record, runtimeInfo(record.pipeline));
    if (compressorIndex.has(id)) problem(`compress rule "${rule.id}": "${id}" already has a compressor`);
    compressorIndex.set(id, record);
    compressors.push(record);
  });
});

const popular = [];
POPULAR.forEach(([from, to], i) => {
  const c = converterIndex.get(`${from}>${to}`);
  if (!c) { problem(`POPULAR lists ${from} -> ${to}, which no converter rule defines`); return; }
  c.popularRank = i;
  popular.push(c);
});

// Derive each format's input/output support and status from what converts it.
function bump(f, dir, status) { if (rank(status) > rank(f[dir])) f[dir] = status; }
[...converters, ...compressors].forEach((c) => {
  const from = formatById.get(c.from);
  const to = formatById.get(c.to);
  if (!from || !to) return;
  bump(from, 'input', c.status);
  bump(to, 'output', c.status);
});
formats.forEach((f) => {
  if (!f.input && !f.output) problem(`format "${f.id}" is not used by any converter; remove it or add a converter (no dead formats)`);
  f.status = rank(f.input) >= rank(f.output) ? (f.input || 'planned') : f.output;
  // backendRequired: some direction this format takes part in has no realistic browser implementation.
  f.backendRequired = (!!f.input && f.browserSupport.read === 'none') || (!!f.output && f.browserSupport.write === 'none');
});

if (problems.length) {
  throw new Error(`Invalid format registry (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n - ${problems.join('\n - ')}`);
}

deepFreeze(categories); deepFreeze(formats); deepFreeze(engines); deepFreeze(converters); deepFreeze(compressors);

// ------------------------------------------------------------------ helpers --
function minRank(opts, fallback) {
  const s = (opts && opts.minStatus) || fallback;
  if (!STATUS_RANK[s]) throw new Error(`Unknown status "${s}" (use planned, experimental or live)`);
  return STATUS_RANK[s];
}

/** Accepts a format object, id, extension (".png", "PNG") or alias ("jpeg"). Returns the format or null. */
function getFormat(key) {
  if (key == null || key === '') return null;
  if (typeof key === 'object') return formatById.get(key.id) || null;
  return formatByKey.get(String(key).trim().toLowerCase().replace(/^\./, '')) || null;
}

const idOf = (key) => { const f = getFormat(key); return f ? f.id : null; };

// ---------------------------------------------------------------- categories --
/** Accepts a category object, id or display name. */
function getCategory(key) {
  if (key == null) return null;
  if (typeof key === 'object') return categoryById.get(key.id) || null;
  const k = String(key).trim().toLowerCase();
  return categoryById.get(k) || categories.find((c) => c.name.toLowerCase() === k) || null;
}

/**
 * All categories in menu order, each with a formatCount.
 * Empty categories (e.g. "Other") are hidden unless includeEmpty is true.
 * @param {{minStatus?: string, includeEmpty?: boolean}} [opts]
 */
function getCategories(opts = {}) {
  const minR = minRank(opts, 'planned');
  return categories
    .map((c) => ({
      id: c.id, slug: c.slug, name: c.name, converterName: c.converterName, icon: c.icon, description: c.description, order: c.order,
      formatCount: c.formatIds.filter((id) => rank(formatById.get(id).status) >= minR).length,
    }))
    .filter((c) => opts.includeEmpty || c.formatCount > 0);
}

// ------------------------------------------------------------------ formats --
function inCategory(f, cat) {
  const c = getCategory(cat);
  return !!c && f.categories.includes(c.id);
}

function statusOk(f, role, minR) {
  if (role === 'input') return rank(f.input) >= minR;
  if (role === 'output') return rank(f.output) >= minR;
  return rank(f.status) >= minR;
}

/**
 * List formats in registry order.
 * @param {{category?: string, role?: 'input'|'output', minStatus?: string}} [opts]
 *   category  id or name; formats listed under it as primary or "also in" category both match
 *   role      only formats that can be read (input) or written (output) at minStatus
 */
function getFormats(opts = {}) {
  const minR = minRank(opts, 'planned');
  if (opts.category && !getCategory(opts.category)) return [];
  return formats.filter((f) => (!opts.category || inCategory(f, opts.category)) && statusOk(f, opts.role, minR));
}

const getFormatsByCategory = (category, opts = {}) => getFormats({ ...opts, category });
const getFormatByExtension = (ext) => getFormat(ext);
const getFormatByApiFormat = (key) => formatByApi.get(String(key || '').toLowerCase()) || null;

/** Detects a format from a file name; understands two-part extensions ("backup.tar.gz"). */
function getFormatByFilename(name) {
  const parts = String(name || '').toLowerCase().split('.');
  for (let k = 1; k < parts.length; k++) { // longest suffix first
    const f = formatByKey.get(parts.slice(k).join('.'));
    if (f) return f;
  }
  return null;
}

/** All formats that use a MIME type (several formats can share one, e.g. video/mpeg). */
function getFormatsByMimeType(mime) {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  return formats.filter((f) => f.mimeTypes.some((t) => t.toLowerCase().split(';')[0].trim() === m));
}
const getFormatByMimeType = (mime) => getFormatsByMimeType(mime)[0] || null;

// -------------------------------------------------------------- conversions --
const allConverters = () => [...converters, ...compressors];

/**
 * List converters (one record per from->to pair) in rule order.
 * @param {{from?: string, to?: string, fromCategory?: string, toCategory?: string,
 *          minStatus?: string, type?: 'convert'|'compress'|'all', popular?: boolean}} [opts]
 */
function getConverters(opts = {}) {
  const minR = minRank(opts, 'live');
  const pool = opts.type === 'all' ? allConverters() : opts.type === 'compress' ? compressors : converters;
  const from = opts.from != null ? idOf(opts.from) : null;
  const to = opts.to != null ? idOf(opts.to) : null;
  if ((opts.from != null && !from) || (opts.to != null && !to)) return [];
  return pool.filter((c) =>
    rank(c.status) >= minR &&
    (!from || c.from === from) && (!to || c.to === to) &&
    (!opts.fromCategory || inCategory(formatById.get(c.from), opts.fromCategory)) &&
    (!opts.toCategory || inCategory(formatById.get(c.to), opts.toCategory)) &&
    (!opts.popular || c.popularRank !== null));
}

/** The converter for from -> to, or null. Different formats only; same-format is getCompressor(). */
function getConverter(from, to, opts = {}) {
  const f = idOf(from), t = idOf(to);
  if (!f || !t || f === t) return null;
  const c = converterIndex.get(`${f}>${t}`);
  return c && rank(c.status) >= minRank(opts, 'live') ? c : null;
}

function getCompressor(format, opts = {}) {
  const id = idOf(format);
  const c = id && compressorIndex.get(id);
  return c && rank(c.status) >= minRank(opts, 'live') ? c : null;
}

/**
 * True when from -> to can be done. Asking about the same format (png -> png) means
 * "can it be re-encoded smaller", i.e. compression.
 */
function isConversionSupported(from, to, opts = {}) {
  const f = idOf(from), t = idOf(to);
  if (!f || !t) return false;
  return f === t ? !!getCompressor(f, opts) : !!getConverter(f, t, opts);
}

const isCompressSupported = (format, opts = {}) => !!getCompressor(format, opts);

/** True when a from -> to rule exists at ANY status (planned included). Same format = compression. */
function isConversionRegistered(from, to) {
  return isConversionSupported(from, to, { minStatus: 'planned' });
}

/** 'live' | 'experimental' | 'planned', or null when no rule exists for this pair. */
function getConversionStatus(from, to) {
  const f = idOf(from), t = idOf(to);
  const c = f && t && (f === t ? compressorIndex.get(f) : converterIndex.get(`${f}>${t}`));
  return c ? c.status : null;
}

/** The engine that performs from -> to (any status), or null. `backendRequired` and `runtime` say where it runs. */
function getConversionEngine(from, to) {
  const f = idOf(from), t = idOf(to);
  const c = f && t && (f === t ? compressorIndex.get(f) : converterIndex.get(`${f}>${t}`));
  return c ? { ...engineById.get(c.engine), pipeline: c.pipeline, backendRequired: c.backendRequired, runtime: c.runtime } : null;
}

function inCat(list, category) { return category ? list.filter((f) => inCategory(f, category)) : list; }

/** Formats `from` can be converted to, in converter order. The list behind an "output format" dropdown. */
function getCompatibleOutputFormats(from, opts = {}) {
  const f = idOf(from);
  if (!f) return [];
  return inCat(uniq(getConverters({ ...opts, from: f }).map((c) => c.to)).map((id) => formatById.get(id)), opts.category);
}

/** Formats that can be converted to `to`, in converter order. */
function getCompatibleInputFormats(to, opts = {}) {
  const t = idOf(to);
  if (!t) return [];
  return inCat(uniq(getConverters({ ...opts, to: t }).map((c) => c.from)).map((id) => formatById.get(id)), opts.category);
}

/**
 * Compatible outputs grouped by category, in menu order, for a CloudConvert-style
 * "convert to ANY" dropdown. A format listed under two categories appears in both.
 * @returns {{category: object, formats: object[]}[]}
 */
function getOutputFormatsByCategory(from, opts = {}) {
  const outs = getCompatibleOutputFormats(from, opts);
  const summaries = getCategories({ includeEmpty: true });
  return summaries
    .map((category) => ({ category, formats: outs.filter((f) => f.categories.includes(category.id)) }))
    .filter((g) => g.formats.length);
}

/** Formats that appear as an input anywhere at minStatus, ordered by first appearance in the converter rules. */
function getInputFormats(opts = {}) {
  const minR = minRank(opts, 'live');
  const ids = uniq(allConverters().filter((c) => rank(c.status) >= minR).map((c) => c.from));
  return inCat(ids.map((id) => formatById.get(id)), opts.category);
}

/** Formats that appear as an output anywhere at minStatus, ordered by first appearance. */
function getOutputFormats(opts = {}) {
  const minR = minRank(opts, 'live');
  const ids = [];
  const groups = uniq(allConverters().filter((c) => rank(c.status) >= minR).map((c) => c.group));
  groups.forEach((g) => allConverters().filter((c) => c.group === g && rank(c.status) >= minR)
    .sort((a, b) => a.toIndex - b.toIndex).forEach((c) => ids.push(c.to)));
  return inCat(uniq(ids).map((id) => formatById.get(id)), opts.category);
}

/** Formats with a compressor, in order. */
function getCompressibleFormats(opts = {}) {
  const minR = minRank(opts, 'live');
  return compressors.filter((c) => rank(c.status) >= minR).map((c) => formatById.get(c.from));
}

/** Featured conversions (footer, home, 404), in editorial order. Not-yet-live ones are skipped by default. */
function getPopularConversions(opts = {}) {
  const minR = minRank(opts, 'live');
  return popular.filter((c) => rank(c.status) >= minR);
}

// ------------------------------------------------------------------- search --
/**
 * Search formats by extension, alias, name, long name, category name or description.
 * Best matches first (exact extension, then prefix, then name, ...).
 * @param {string} query
 * @param {{category?: string, role?: 'input'|'output', minStatus?: string,
 *          compatibleWith?: string, limit?: number}} [opts]
 *   compatibleWith  only formats that this format can convert to (powers the "ANY" dropdown search)
 */
function searchFormats(query, opts = {}) {
  const q = String(query == null ? '' : query).trim().toLowerCase().replace(/^\./, '');
  let pool;
  if (opts.compatibleWith != null) {
    pool = getCompatibleOutputFormats(opts.compatibleWith, { minStatus: opts.minStatus || 'live', category: opts.category });
  } else {
    pool = getFormats({ minStatus: opts.minStatus, role: opts.role, category: opts.category });
  }
  let out;
  if (!q) {
    out = pool.slice();
  } else {
    out = pool.map((f) => {
      const keys = uniq([f.id, ...f.extensions]).map((k) => k.toLowerCase());
      let score = 0;
      if (keys.includes(q)) score = 100;
      else if (keys.some((k) => k.startsWith(q))) score = 80;
      else if (f.name.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)) score = 60;
      else if (f.fullName.toLowerCase().includes(q)) score = 40;
      else if (f.categories.some((id) => categoryById.get(id).name.toLowerCase().includes(q))) score = 30;
      else if (q.length >= 3 && f.description.toLowerCase().includes(q)) score = 10;
      return { f, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.f.order - b.f.order).map((x) => x.f);
  }
  return opts.limit > 0 ? out.slice(0, opts.limit) : out;
}

// ------------------------------------------------------------------- routes --
/** "/png-to-webp". Aliases are canonicalized (jpeg -> jpg). Returns null for unknown formats. Does not check support. */
function getConverterRoute(from, to) {
  const f = idOf(from), t = idOf(to);
  return f && t ? `/${f}-to-${t}` : null;
}

/** "/compress-png", or null for an unknown format. */
function getCompressRoute(format) {
  const id = idOf(format);
  return id ? `/compress-${id}` : null;
}

/** Splits a URL path into its raw parts without judging whether the formats exist. */
function parseConverterRoute(path) {
  const p = String(path || '').replace(/\/+$/, '') || '/';
  let m = /^\/compress-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(p);
  if (m) return { type: 'compress', from: m[1], to: m[1] };
  m = /^\/([a-z0-9]+(?:-[a-z0-9]+)*?)-to-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(p); // ids never contain "-to-", so the first split is exact
  return m ? { type: 'convert', from: m[1], to: m[2] } : null;
}

/**
 * Resolve a URL path to a converter page.
 * @returns null (no such page) | { redirect } (alias spelling, send a 301) |
 *          { type, from, to, converter, path } (canonical page)
 */
function resolveRoute(path, opts = {}) {
  const parsed = parseConverterRoute(path);
  if (!parsed) return null;
  const p = String(path).replace(/\/+$/, '');
  const from = getFormat(parsed.from), to = getFormat(parsed.to);
  if (!from || !to) return null;
  if (parsed.type === 'compress') {
    const converter = getCompressor(from, opts);
    if (!converter) return null;
    return p !== converter.route ? { redirect: converter.route } : { type: 'compress', from, to: from, converter, path: converter.route };
  }
  const converter = getConverter(from, to, opts);
  if (!converter) return null;
  return p !== converter.route ? { redirect: converter.route } : { type: 'convert', from, to, converter, path: converter.route };
}

/** Every canonical converter URL at minStatus (home and hub pages are not included). */
function getAllRoutes(opts = {}) {
  const minR = minRank(opts, 'live');
  return allConverters().filter((c) => rank(c.status) >= minR).map((c) => c.route);
}

// ----------------------------------------------------------------- metadata --
const bothIn = (a, b, cat) => inCategory(a, cat) && inCategory(b, cat);

function converterSummary(c) {
  return { status: c.status, engine: c.engine, pipeline: c.pipeline, runtime: c.runtime, quality: c.quality,
    backendRequired: c.backendRequired, notes: c.notes, group: c.group };
}

/**
 * Page metadata for a conversion: title, description, headings, breadcrumbs, keywords
 * and how it is processed. Wording for image conversions matches the existing pages.
 * @param {{siteName?: string, minStatus?: string}} [opts]
 */
function getConverterMetadata(from, to, opts = {}) {
  const c = getConverter(from, to, opts);
  if (!c) return null;
  const f = formatById.get(c.from), t = formatById.get(c.to);
  const site = opts.siteName || 'FlipItFree';
  const alt = f.altLabel || t.altLabel ? ` (${f.altLabel || f.label} to ${t.altLabel || t.label})` : '';
  const image = bothIn(f, t, 'image');
  const h1 = `${f.label} to ${t.label} Converter`;
  return {
    type: 'convert', path: c.route, canonicalPath: c.route, from: f, to: t,
    category: getCategory(f.category), toCategory: getCategory(t.category),
    title: `${h1}${alt} - Free Online | ${site}`,
    description: image
      ? `Convert ${f.label} to ${t.label} online. Adjust quality and size, convert many files at once and download them as a ZIP. Free, no sign-up.`
      : `Convert ${f.label} to ${t.label} online. Upload your file, choose your options and download the result. Free, no sign-up.`,
    h1, schemaName: h1,
    breadcrumbs: [['Home', '/'], ['Converters', '/converters'], [`${f.label} to ${t.label}`, c.route]],
    keywords: [`${f.label} to ${t.label}`, `convert ${f.label} to ${t.label}`, `${f.name} to ${t.name} converter`, `${f.extension} to ${t.extension}`],
    converter: converterSummary(c),
  };
}

/** Page metadata for a compressor page (/compress-png). */
function getCompressMetadata(format, opts = {}) {
  const c = getCompressor(format, opts);
  if (!c) return null;
  const f = formatById.get(c.from);
  const site = opts.siteName || 'FlipItFree';
  const image = inCategory(f, 'image');
  const noun = image ? 'images' : 'files';
  return {
    type: 'compress', path: c.route, canonicalPath: c.route, from: f, to: f, category: getCategory(f.category),
    title: `Compress ${f.label} - Free Online ${f.label} Compressor | ${site}`,
    description: `Reduce the file size of ${f.label} ${noun} online. Set the quality and maximum size, compress many files at once and download them as a ZIP. Free, no sign-up.`,
    h1: `Compress ${f.label} ${image ? 'Images' : 'Files'} Online`, schemaName: `${f.label} Compressor`,
    breadcrumbs: [['Home', '/'], ['Converters', '/converters'], [`Compress ${f.label}`, c.route]],
    keywords: [`compress ${f.label}`, `${f.label} compressor`, `reduce ${f.label} size`],
    converter: converterSummary(c),
  };
}

// ---------------------------------------------------------------- engines etc --
const getEngines = (opts = {}) => engines.filter((e) => !opts.status || e.status === opts.status);
const getEngine = (id) => engineById.get(id) || null;

/** Counts for dashboards, tests and debugging. */
function getStats() {
  const by = (list) => list.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});
  return { categories: getCategories().length, formats: formats.length, converters: by(converters), compressors: by(compressors), engines: engines.length };
}

module.exports = {
  STATUS_RANK,
  // categories
  getCategories, getCategory,
  // formats
  getFormats, getFormat, getFormatByExtension, getFormatByFilename, getFormatByMimeType, getFormatsByMimeType,
  getFormatByApiFormat, getFormatsByCategory, getInputFormats, getOutputFormats, searchFormats,
  // conversions
  getConverters, getConverter, getCompressor, isConversionSupported, isCompressSupported,
  getCompatibleOutputFormats, getCompatibleInputFormats, getOutputFormatsByCategory,
  isConversionRegistered, getConversionStatus, getConversionEngine,
  getCompressibleFormats, getPopularConversions,
  // routes + metadata
  getConverterRoute, getCompressRoute, parseConverterRoute, resolveRoute, getAllRoutes,
  getConverterMetadata, getCompressMetadata,
  // engines + misc
  getEngines, getEngine, getStats,
};
