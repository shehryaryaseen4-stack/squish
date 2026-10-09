// PDF editor (/edit-pdf). Runs entirely in the browser:
//   pdf.js renders the pages; the edits live in `S.pages[].items` as page coordinates;
//   pdf-lib (global PDFLib) copies the original pages and draws the edits on export.
// Coordinates: every item is stored in "view points" of its page: PDF points, origin at the
// top-left of the page as displayed (after rotation), y going down. Export maps them back to
// the page's own coordinate system with one transformation matrix per page.

const ROOT = document.documentElement;
const VENDOR = new URL(ROOT.dataset.vendor || '/vendor/', document.baseURI).href;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = (v) => Math.round(v * 100) / 100;
let seq = 0;
const uid = () => `i${Date.now().toString(36)}${(++seq).toString(36)}`;

const SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008], a5: [419.53, 595.28] };
const FONT_CSS = {
  helv: 'Helvetica, Arial, "Liberation Sans", sans-serif',
  times: '"Times New Roman", Times, "Liberation Serif", serif',
  courier: '"Courier New", Courier, "Liberation Mono", monospace',
};
// Ascent and descent (in font size units) of the fonts the browser uses for each family.
// They place the PDF baseline where the on-screen text sits.
const METRICS = { helv: [0.905, 0.212], times: [0.891, 0.216], courier: [0.833, 0.3] };
const LINE = 1.2;
const baselineOffset = (font, size) => { const [a, d] = METRICS[font] || METRICS.helv; return ((LINE - a - d) / 2 + a) * size; };

// ------------------------------------------------------------------- fonts --
// Three standard PDF fonts need no download. The others are Google Fonts served by our own
// server (/fonts/<id>/<variant>.ttf), so the same file is shown on screen and embedded in the PDF.
// Without that server (the static preview) they are shown through Google's CSS only.
const FONTS_BASE = ROOT.dataset.fonts === undefined ? '/fonts/' : ROOT.dataset.fonts;
const STD_FONTS = [{ id: 'helv', name: 'Helvetica', cat: 'standard' }, { id: 'times', name: 'Times', cat: 'standard' }, { id: 'courier', name: 'Courier', cat: 'standard' }];
const FONT_CATS = [['all', 'All'], ['standard', 'Standard'], ['sans', 'Sans'], ['serif', 'Serif'], ['display', 'Display'], ['handwriting', 'Handwriting'], ['mono', 'Mono'], ['languages', 'Urdu & more']];
let CATALOG = STD_FONTS.slice();
const FONT_BY_ID = new Map(STD_FONTS.map((f) => [f.id, f]));
const isStd = (id) => id === 'helv' || id === 'times' || id === 'courier';
const fontInfo = (id) => FONT_BY_ID.get(id) || STD_FONTS[0];
const variantOf = (bold, italic) => `${bold ? 700 : 400}${italic ? 'i' : ''}`;
const FALLBACK = { serif: 'serif', mono: 'monospace', handwriting: 'cursive', display: 'sans-serif', sans: 'sans-serif', languages: 'sans-serif' };
function cssFamily(id) {
  if (isStd(id)) return FONT_CSS[id];
  const f = fontInfo(id);
  return `"pe-${id}", "${f.name}", ${FALLBACK[f.cat] || 'sans-serif'}`;
}
async function loadCatalog() {
  try {
    const list = await (await fetch(new URL('editor-fonts.json', import.meta.url))).json();
    CATALOG = STD_FONTS.concat(list);
    list.forEach((f) => FONT_BY_ID.set(f.id, f));
  } catch { /* standard fonts only */ }
}
const fontLoads = new Map();   // `${id}:${variant}` -> Promise
const fontMeta = new Map();    // id -> meta from the server
function ensureFont(id, bold = false, italic = false) {
  if (!id || isStd(id) || !FONT_BY_ID.has(id)) return Promise.resolve();
  const v = variantOf(bold, italic);
  const key = `${id}:${v}`;
  if (fontLoads.has(key)) return fontLoads.get(key);
  const f = fontInfo(id);
  const job = (async () => {
    if (FONTS_BASE) {
      if (!fontMeta.has(id)) {
        const meta = await fetch(`${FONTS_BASE}${id}/meta.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        fontMeta.set(id, meta);
        if (meta) METRICS[id] = [meta.ascent, meta.descent];
      }
      const face = new FontFace(`pe-${id}`, `url(${FONTS_BASE}${id}/${v}.ttf)`, { weight: bold ? '700' : '400', style: italic ? 'italic' : 'normal' });
      await face.load();
      document.fonts.add(face);
    } else {
      if (!document.querySelector(`link[data-font="${id}"]`)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.dataset.font = id;
        l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.name).replace(/%20/g, '+')}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
        document.head.append(l);
      }
      await document.fonts.load(`${italic ? 'italic ' : ''}${bold ? 700 : 400} 16px "${f.name}"`);
    }
  })().catch(() => {});
  fontLoads.set(key, job);
  // once the font is there, text boxes using it change size: redraw those pages
  job.then(() => S.pages.forEach((p, i) => { if (p.items.some((it) => (it.type === 'text' || it.type === 'table') && it.font === id)) drawItems(i); }));
  return job;
}
let recentFonts = [];
try { recentFonts = JSON.parse(localStorage.getItem('pe-recent-fonts') || '[]').filter((x) => typeof x === 'string').slice(0, 6); } catch { /* storage off */ }
function rememberFont(id) {
  recentFonts = [id, ...recentFonts.filter((x) => x !== id)].slice(0, 6);
  try { localStorage.setItem('pe-recent-fonts', JSON.stringify(recentFonts)); } catch { /* storage off */ }
}
// match a font name found in a PDF to the catalogue ("ABCDEF+Roboto-Bold" -> roboto)
function catalogMatch(name) {
  const n = String(name || '').replace(/^[A-Z]{6}\+/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!n) return null;
  let best = null;
  for (const f of CATALOG) {
    if (isStd(f.id)) continue;
    const k = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (n.startsWith(k) && (!best || k.length > best.k.length)) best = { id: f.id, k };
  }
  return best && best.id;
}

const SHAPES = new Set(['rect', 'ellipse', 'line', 'arrow', 'check', 'cross']);
const HINTS = {
  select: 'Click an object to select it. Drag to move, use the corners to resize (hold Ctrl to resize both sides equally).',
  edittext: 'Click on any text in the PDF to change it.',
  editimage: 'Click on an image in the PDF to replace, move or remove it.',
  text: 'Click anywhere on a page to add text.',
  pen: 'Draw on the page with your mouse or finger.',
  highlight: 'Drag over text to highlight it.',
  whiteout: 'Drag over anything to cover it. The covered content stays in the file underneath, so do not use it to remove private information.',
  rect: 'Drag to draw a rectangle.', ellipse: 'Drag to draw a circle or oval.',
  line: 'Drag to draw a line.', arrow: 'Drag to draw an arrow.',
  check: 'Click to place a check mark.', cross: 'Click to place a cross.',
};
// Which settings each kind of object (or tool) has.
const PROPS = {
  text: ['color', 'font', 'size', 'style', 'align', 'opacity'],
  pen: ['color', 'width', 'dash', 'opacity'], line: ['color', 'width', 'dash', 'opacity'], arrow: ['color', 'width', 'dash', 'opacity'],
  check: ['color', 'width'], cross: ['color', 'width'],
  rect: ['color', 'width', 'dash', 'fill', 'radius', 'opacity'], ellipse: ['color', 'width', 'dash', 'fill', 'opacity'],
  highlight: ['color', 'opacity'], whiteout: ['color'], image: ['imgshape', 'opacity', 'replace'],
  table: ['font', 'size', 'color', 'align', 'table', 'opacity'],
};
const DEFAULTS = {
  text: { color: '#111827', font: 'helv', size: 14, bold: false, italic: false, underline: false, align: 'left', opacity: 100 },
  pen: { color: '#1d3c8f', width: 2, dash: 'solid', opacity: 100 },
  line: { color: '#111827', width: 2, dash: 'solid', opacity: 100 },
  arrow: { color: '#e5322d', width: 2, dash: 'solid', opacity: 100 },
  check: { color: '#1e9e5a', width: 2.5, opacity: 100 },
  cross: { color: '#e5322d', width: 2.5, opacity: 100 },
  rect: { color: '#e5322d', width: 2, dash: 'solid', fill: '#ffffff', fillOn: false, radius: 0, opacity: 100 },
  ellipse: { color: '#e5322d', width: 2, dash: 'solid', fill: '#ffffff', fillOn: false, opacity: 100 },
  highlight: { color: '#ffe14d', opacity: 100 },
  whiteout: { color: '#ffffff', opacity: 100 },
  image: { opacity: 100 },
  table: { font: 'helv', size: 10, color: '#1f2937', head: true, headFill: '#1f2937', headColor: '#ffffff', stripe: '#f3f4f6', borders: 'all', border: '#cbd5e1', bw: 0.75, opacity: 100 },
};
const defaultsFor = (tool) => DEFAULTS[tool === 'edittext' ? 'text' : tool];

// ------------------------------------------------------------------ state --
const S = {
  docs: new Map(),   // docId -> { bytes, proxy }
  pages: [],         // { id, src: {doc, index} | null, box: [x0, y0, w, h], baseRot, rot, items: [] }
  assets: new Map(), // assetId -> { url, mime, w, h }
  tool: 'select', zoom: 1, current: 0,
  sel: null,          // { page, id }
  editing: null,      // id of the text item being typed in
  undo: [], redo: [], dirty: false,
  runs: new Map(),    // pageId:rot -> text runs for "Edit text"
  cell: null,         // { id, r, c }: the table cell rows and columns are added next to
  cellEdit: null,     // { page, id, r, c }: the table cell being typed in
};

// ------------------------------------------------------------ libraries --
let pdfjs = null;
async function lib() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(`${VENDOR}pdfjs/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${VENDOR}pdfjs/pdf.worker.min.mjs`;
  return pdfjs;
}
const PDFLib = () => {
  if (!window.PDFLib) throw new Error('The PDF writer did not load. Check your connection and reload the page.');
  return window.PDFLib;
};

// ------------------------------------------------------------------- utils --
let toastTimer = 0;
function toast(msg, err = false) {
  const t = $('#peToast');
  t.textContent = msg; t.classList.toggle('err', err); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, err ? 6000 : 3200);
}
const readFile = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result)); r.onerror = () => rej(r.error); r.readAsArrayBuffer(file);
});
const readDataUrl = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file);
});
const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This image could not be read.')); i.src = url; });
const hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const isPdf = (f) => f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
const isImage = (f) => f && /^image\//.test(f.type);

const rotOf = (p) => (p.baseRot + p.rot) % 360;
function viewSize(p) { const r = rotOf(p); return r % 180 ? [p.box[3], p.box[2]] : [p.box[2], p.box[3]]; }
const pageById = (id) => S.pages.find((p) => p.id === id);
const pageIndex = (id) => S.pages.findIndex((p) => p.id === id);
const itemOf = (sel) => { const p = sel && pageById(sel.page); return p ? p.items.find((i) => i.id === sel.id) : null; };

// Line items keep their two end points; their box is derived.
function lineBox(it) {
  const pad = Math.max(it.width || 2, 4);
  it.x = Math.min(it.x1, it.x2) - pad; it.y = Math.min(it.y1, it.y2) - pad;
  it.w = Math.abs(it.x2 - it.x1) + pad * 2; it.h = Math.abs(it.y2 - it.y1) + pad * 2;
}

// ---------------------------------------------------------------- history --
function snapshot() {
  S.undo.push(JSON.stringify(S.pages));
  if (S.undo.length > 100) S.undo.shift();
  S.redo = []; S.dirty = true; updateUndo();
}
function restore(json) {
  const before = structureKey();
  S.pages = JSON.parse(json);
  S.sel = null; S.editing = null; S.cell = null; S.cellEdit = null;
  S.current = clamp(S.current, 0, S.pages.length - 1);
  if (structureKey() !== before) rebuild(); else { S.pages.forEach((_, i) => drawItems(i)); updateProps(); }
  updateUndo();
}
function undo() { if (!S.undo.length) return; finishEditing(); S.redo.push(JSON.stringify(S.pages)); restore(S.undo.pop()); }
function redo() { if (!S.redo.length) return; finishEditing(); S.undo.push(JSON.stringify(S.pages)); restore(S.redo.pop()); }
function updateUndo() {
  $('[data-act="undo"]').disabled = !S.undo.length;
  $('[data-act="redo"]').disabled = !S.redo.length;
}
const structureKey = () => S.pages.map((p) => `${p.id}:${p.rot}`).join('|');

// ---------------------------------------------------------- open / create --
async function addPdf(bytes) {
  const lib_ = await lib();
  // Saving copies the original pages with pdf-lib. PDFs it cannot copy (most often ones
  // protected against changes, which open without a password) are saved as page pictures.
  let raster = false;
  try { await PDFLib().PDFDocument.load(bytes, { updateMetadata: false }); } catch { raster = true; }
  let proxy;
  try {
    proxy = await lib_.getDocument({
      data: bytes.slice(), isEvalSupported: false,
      cMapUrl: `${VENDOR}pdfjs/cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${VENDOR}pdfjs/standard_fonts/`, wasmUrl: `${VENDOR}pdfjs/wasm/`, iccUrl: `${VENDOR}pdfjs/iccs/`,
    }).promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') throw new Error('This PDF needs a password to open. Remove the password first, then edit it.');
    console.error(e);
    throw new Error(`This PDF could not be opened (${(e && e.message) || 'unknown error'}).`);
  }
  const docId = uid();
  S.docs.set(docId, { bytes, proxy, raster });
  if (raster) toast('This PDF is protected against changes. You can still edit it; the pages are saved as pictures, so their original text will not be selectable.');
  const pages = [];
  for (let i = 0; i < proxy.numPages; i++) {
    const pg = await proxy.getPage(i + 1);
    const [x0, y0, x1, y1] = pg.view;
    pages.push({ id: uid(), src: { doc: docId, index: i }, box: [x0, y0, x1 - x0, y1 - y0], baseRot: pg.rotate || 0, rot: 0, items: [] });
  }
  return pages;
}

const blankPage = (w, h) => ({ id: uid(), src: null, box: [0, 0, w, h], baseRot: 0, rot: 0, items: [] });

async function openFile(file) {
  if (!isPdf(file)) { toast('Please choose a PDF file.', true); return; }
  busy(true, 'Opening PDF…');
  try {
    const pages = await addPdf(await readFile(file));
    resetDoc(pages, file.name.replace(/\.pdf$/i, '') + '-edited.pdf', file.name);
  } catch (e) { toast(e.message, true); } finally { busy(false); }
}

function createNew() {
  const [w, h] = SIZES[$('#peNewSize').value] || SIZES.a4;
  const land = $('#peNewOrient').value === 'landscape';
  resetDoc([land ? blankPage(h, w) : blankPage(w, h)], 'document.pdf', 'Untitled document');
  setTool('text');
}

function resetDoc(pages, name, title) {
  S.docs.forEach((d, id) => { if (!pages.some((p) => p.src && p.src.doc === id)) { d.proxy.destroy(); S.docs.delete(id); } });
  S.pages = pages; S.undo = []; S.redo = []; S.sel = null; S.editing = null; S.current = 0; S.dirty = false; S.runs.clear();
  $('#peFileName').value = name;
  $('#peDocName').textContent = title || name;
  $('#peStart').hidden = true; $('#peApp').hidden = false;
  document.body.classList.add('is-editing');
  $('#pe').classList.add('editing');
  S.zoom = fitZoom();
  rebuild(); updateUndo();
  showQuick();
  requestAnimationFrame(moveToolIndicator);
  $('#peView').scrollTop = 0;
  // landing pages such as /highlight-pdf pick their tool for the first document
  const st = $('#pe').dataset.startTool;
  if (st) { delete $('#pe').dataset.startTool; requestAnimationFrame(() => setTool(st)); }
}

// --------------------------------------------------------------- rendering --
let observer = null;
const renderTasks = new WeakMap();

function fitZoom() {
  const view = $('#peView');
  // fit the widest page with room on both sides, but never larger than 100%
  const avail = Math.max(240, (view.clientWidth || window.innerWidth - 220) - 96);
  const widest = Math.max(...S.pages.map((p) => viewSize(p)[0]), 1);
  return clamp(Math.floor((avail / widest) * 20) / 20, 0.25, 1);
}

function rebuild() {
  const view = $('#peView');
  view.textContent = '';
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) paintPage(e.target); }), { root: view, rootMargin: '600px 0px' });
  S.pages.forEach((p, i) => {
    const [w, h] = viewSize(p);
    const el = document.createElement('div');
    el.className = 'pe-page'; el.dataset.id = p.id;
    el.style.width = `${w * S.zoom}px`; el.style.height = `${h * S.zoom}px`;
    el.setAttribute('aria-label', `Page ${i + 1}`);
    const canvas = document.createElement('canvas');
    const layer = document.createElement('div');
    layer.className = `pe-layer tool-${S.tool}`;
    el.append(canvas, layer);
    view.append(el);
    observer.observe(el);
    drawItems(i);
  });
  $('#peZoom').textContent = `${Math.round(S.zoom * 100)}%`;
  buildThumbs();
  markCurrent();
  updateProps();
  renderLayers();
  drawRulersSoon();
}

async function paintPage(el) {
  const p = pageById(el.dataset.id);
  if (!p) return;
  const key = `${S.zoom}:${rotOf(p)}:${DPR()}`;
  if (el.dataset.painted === key) return;
  el.dataset.painted = key;
  const canvas = el.querySelector('canvas');
  if (!p.src) { canvas.width = 1; canvas.height = 1; return; }
  const doc = S.docs.get(p.src.doc);
  const page = await doc.proxy.getPage(p.src.index + 1);
  const viewport = page.getViewport({ scale: S.zoom * DPR(), rotation: rotOf(p) });
  const prev = renderTasks.get(canvas);
  if (prev) prev.cancel();
  const off = document.createElement('canvas');
  off.width = Math.ceil(viewport.width); off.height = Math.ceil(viewport.height);
  const task = page.render({ canvas: off, viewport });
  renderTasks.set(canvas, task);
  try {
    await task.promise;
    canvas.width = off.width; canvas.height = off.height;
    canvas.getContext('2d').drawImage(off, 0, 0);
  } catch (e) { if (!e || e.name !== 'RenderingCancelledException') console.error(e); }
}

// ------------------------------------------------------------------- items --
function drawItems(index) {
  const p = S.pages[index];
  if (!p) return;
  const el = $(`.pe-page[data-id="${p.id}"]`);
  if (!el) return;
  const layer = el.querySelector('.pe-layer');
  const keepRuns = layer.querySelector('.pe-runs');
  layer.textContent = '';
  if (keepRuns) layer.append(keepRuns);
  renderObjects(layer, p, S.zoom, true);
  if (S.sel && S.sel.page === p.id) decorateSelection();
  if (layersPage() === p) renderLayers();
  // Text boxes size themselves; remember the size so selection and export agree with the screen.
  // Centred or right-aligned text from a template keeps its anchor (ax) until it is moved.
  p.items.forEach((it) => {
    if (it.type !== 'text') return;
    const o = layer.querySelector(`[data-id="${it.id}"]`);
    if (!o) return;
    it.w = o.offsetWidth / S.zoom; it.h = o.offsetHeight / S.zoom;
    if (it.ax != null && (it.align === 'center' || it.align === 'right')) {
      it.x = it.align === 'center' ? it.ax - it.w / 2 : it.ax - it.w;
      o.style.left = `${it.x * S.zoom}px`;
    }
  });
  // table rows fit their text: never lower than the height the row was given (rmin), taller when
  // the text needs it, and back down when the text gets shorter or the column wider
  let grew = false;
  p.items.forEach((it) => {
    if (it.type !== 'table' || it.hidden) return;
    const o = layer.querySelector(`.pe-obj[data-id="${it.id}"]`);
    if (!o) return;
    const min = minRowH(it);
    const need = it.rh.map((h, r) => Math.max(min, it.rmin ? it.rmin[r] : h));
    o.querySelectorAll('.pe-cell-text').forEach((sp) => {
      const r = Number(sp.parentNode.dataset.r);
      need[r] = Math.max(need[r], Math.ceil((sp.offsetHeight / S.zoom + TPAD.y * 2) * 2) / 2);
    });
    let g = false;
    need.forEach((h, r) => { if (Math.abs(h - it.rh[r]) > 0.5) { it.rh[r] = h; g = true; } });
    if (g) { fixTable(it); grew = true; }
  });
  if (grew && !drawItems.again) {
    if (S.cellEdit) S.cellEdit.busy = true;
    drawItems.again = true; drawItems(index); drawItems.again = false;
    return;
  }
  if (S.sel && S.sel.page === p.id) decorateSelection();
  renderUserGuides(el, p);
  drawThumbItems(p);
}

function drawThumbItems(p) {
  const frame = $(`.pe-thumb[data-id="${p.id}"] .pe-thumb-frame`);
  if (!frame) return;
  let mini = frame.querySelector('.pe-mini-layer');
  if (!mini) { mini = document.createElement('div'); mini.className = 'pe-mini-layer'; frame.append(mini); }
  mini.textContent = '';
  renderObjects(mini, p, frame.clientWidth / viewSize(p)[0], false);
}

// Draws the objects of page `p` into `layer` at zoom `z` (live = the editable page, not a thumbnail).
function renderObjects(layer, p, z, live) {
  const zoomSave = S.zoom;
  S.zoom = z; // svgFor reads the zoom
  p.items.forEach((it) => {
    if (it.hidden) return;
    const o = document.createElement('div');
    o.className = 'pe-obj';
    if (live) o.dataset.id = it.id; // thumbnails get no id, so lookups only find the page copy
    if (live && it.locked) o.classList.add('pe-locked');
    o.style.left = `${it.x * z}px`; o.style.top = `${it.y * z}px`;
    o.style.opacity = (it.opacity ?? 100) / 100;
    if (it.rot) { o.style.transformOrigin = 'center'; o.style.transform = `rotate(${it.rot}deg)`; }
    if (it.type === 'text') {
      o.classList.add('pe-text');
      o.textContent = it.text;
      o.dir = 'auto';
      Object.assign(o.style, {
        fontFamily: cssFamily(it.font), fontSize: `${it.size * z}px`, color: it.color,
        fontWeight: it.bold ? '700' : '400', fontStyle: it.italic ? 'italic' : 'normal',
        textDecoration: it.underline ? 'underline' : 'none', textAlign: it.align || 'left',
      });
      if (!isStd(it.font)) ensureFont(it.font, it.bold, it.italic);
      if (live && S.editing === it.id) startEditing(o, it, true);
    } else {
      o.style.width = `${it.w * z}px`; o.style.height = `${it.h * z}px`;
      if (it.type === 'image') {
        const a = S.assets.get(it.asset);
        const img = document.createElement('img'); img.alt = ''; img.src = a ? a.url : ''; o.append(img);
        // an image in a shape fills it (cover) and is cut to an ellipse or a rounded rectangle
        if (it.clip) {
          o.classList.add('pe-clip');
          const rad = it.clip === 'ellipse' ? '50%' : it.clip === 'rounded' ? `${Math.min(it.r || 0, it.w / 2, it.h / 2) * z}px` : '0';
          o.style.borderRadius = rad;
          if (it.sw > 0) { const b = document.createElement('span'); b.className = 'pe-clip-border'; Object.assign(b.style, { borderRadius: rad, border: `${it.sw * z}px solid ${it.stroke}` }); o.append(b); }
        }
      } else if (it.type === 'whiteout') {
        o.style.background = it.color;
      } else if (it.type === 'highlight') {
        o.style.background = it.color; o.style.mixBlendMode = 'multiply';
        o.style.opacity = 0.45 * ((it.opacity ?? 100) / 100);
      } else if (it.type === 'table') {
        o.classList.add('pe-table');
        o.style.fontFamily = cssFamily(it.font); o.style.fontSize = `${it.size * z}px`;
        o.innerHTML = tableHtml(it, z, live);
        if (!isStd(it.font)) { ensureFont(it.font, false, false); if (it.head) ensureFont(it.font, true, false); }
      } else {
        o.innerHTML = svgFor(it);
      }
    }
    layer.append(o);
    if (it.type === 'table' && live && S.cellEdit && S.cellEdit.id === it.id) startCellEditing(o, it);
  });
  S.zoom = zoomSave;
}

const PATHS = { check: 'M0.12 0.55 L0.4 0.84 L0.9 0.16', cross: 'M0.16 0.16 L0.84 0.84 M0.84 0.16 L0.16 0.84' };
function svgFor(it) {
  const z = S.zoom;
  const sw = (it.width || 2) * z;
  const dash = dashArray(it, sw);
  const stroke = `stroke="${it.color}" stroke-width="${sw}" stroke-linecap="${it.dash === 'dashed' ? 'butt' : 'round'}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash.join(' ')}"` : ''}`;
  if (it.type === 'rect') {
    const fill = it.fillOn ? it.fill : 'none';
    const r = Math.min((it.radius || 0) * z, (it.w * z - sw) / 2, (it.h * z - sw) / 2);
    return `<svg viewBox="0 0 ${it.w * z} ${it.h * z}" preserveAspectRatio="none"><rect x="${sw / 2}" y="${sw / 2}" width="${Math.max(0, it.w * z - sw)}" height="${Math.max(0, it.h * z - sw)}" rx="${Math.max(0, r)}" fill="${fill}" ${stroke}/></svg>`;
  }
  if (it.type === 'ellipse') {
    const fill = it.fillOn ? it.fill : 'none';
    return `<svg viewBox="0 0 ${it.w * z} ${it.h * z}"><ellipse cx="${it.w * z / 2}" cy="${it.h * z / 2}" rx="${Math.max(0, it.w * z / 2 - sw / 2)}" ry="${Math.max(0, it.h * z / 2 - sw / 2)}" fill="${fill}" ${stroke}/></svg>`;
  }
  if (it.type === 'line' || it.type === 'arrow') {
    const x1 = (it.x1 - it.x) * z, y1 = (it.y1 - it.y) * z, x2 = (it.x2 - it.x) * z, y2 = (it.y2 - it.y) * z;
    let d = `M${x1} ${y1} L${x2} ${y2}`;
    if (it.type === 'arrow') arrowHead(it).forEach(([hx, hy]) => { d += ` M${x2} ${y2} L${(hx - it.x) * z} ${(hy - it.y) * z}`; });
    return `<svg viewBox="0 0 ${it.w * z} ${it.h * z}"><path d="${d}" fill="none" ${stroke}/></svg>`;
  }
  if (it.type === 'pen') {
    const sx = it.w / it.w0, sy = it.h / it.h0;
    const d = it.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${round(x * sx * z)} ${round(y * sy * z)}`).join(' ');
    return `<svg viewBox="0 0 ${it.w * z} ${it.h * z}"><path d="${d}" fill="none" ${stroke}/></svg>`;
  }
  if (it.type === 'check' || it.type === 'cross') {
    const d = PATHS[it.type].replace(/([\d.]+) ([\d.]+)/g, (_, a, b) => `${round(a * it.w * z)} ${round(b * it.h * z)}`);
    return `<svg viewBox="0 0 ${it.w * z} ${it.h * z}"><path d="${d}" fill="none" ${stroke}/></svg>`;
  }
  return '';
}

// dash pattern for a stroke width (same numbers on screen and in the PDF)
function dashArray(it, w) {
  if (it.dash === 'dashed') return [round(w * 3), round(w * 2)];
  if (it.dash === 'dotted') return [round(Math.max(0.01, w * 0.01)), round(w * 2)];
  return null;
}

function arrowHead(it) {
  const ang = Math.atan2(it.y2 - it.y1, it.x2 - it.x1);
  const len = Math.max(10, (it.width || 2) * 4.5);
  return [ang + Math.PI - 0.45, ang + Math.PI + 0.45].map((a) => [it.x2 + Math.cos(a) * len, it.y2 + Math.sin(a) * len]);
}

// ------------------------------------------------------- images in shapes --
// Put a picture in a circle, ellipse or rounded box: the picture fills the shape and the rest
// is cut away, on screen and in the PDF. Two ways: pick a shape for a selected image, or place
// the image over a circle or rectangle and choose "Into shape" (it takes the shape's place,
// size, corners and outline).
function setImageShape(kind) {
  const it = itemOf(S.sel);
  if (!it || it.type !== 'image') return;
  snapshot();
  if (kind === 'none') { delete it.clip; delete it.r; it.sw = 0; }
  else {
    // a circle from a rectangular picture: square box around the same centre (stretch it later for an ellipse)
    if (kind === 'ellipse' && !it.clip) { const d = Math.min(it.w, it.h); it.x += (it.w - d) / 2; it.y += (it.h - d) / 2; it.w = d; it.h = d; }
    it.clip = kind;
    if (kind === 'rounded' && !it.r) it.r = Math.round(Math.min(it.w, it.h) / 8);
  }
  drawItems(pageIndex(S.sel.page)); updateProps();
}
function imageIntoShape() {
  const it = itemOf(S.sel);
  if (!it || it.type !== 'image') return;
  const p = pageById(S.sel.page);
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  const area = (o) => Math.max(0, Math.min(it.x + it.w, o.x + o.w) - Math.max(it.x, o.x)) * Math.max(0, Math.min(it.y + it.h, o.y + o.h) - Math.max(it.y, o.y));
  const cands = p.items.filter((o) => (o.type === 'ellipse' || o.type === 'rect') && !o.hidden && !o.locked && area(o) > 0);
  // the shape under the middle of the picture, else the one it overlaps most
  const shape = cands.find((o) => cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h && o === cands.filter((q) => cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h).pop())
    || cands.sort((a, b) => area(b) - area(a))[0];
  if (!shape) { toast('Place the picture over a circle or rectangle first (Shapes), then choose Into shape.'); return; }
  snapshot();
  Object.assign(it, { x: shape.x, y: shape.y, w: shape.w, h: shape.h, rot: shape.rot || 0 });
  it.clip = shape.type === 'ellipse' ? 'ellipse' : shape.radius > 0 ? 'rounded' : 'rect';
  it.r = shape.radius || 0;
  // a visible outline on the shape becomes the picture's border
  const outline = shape.width > 0 && !(shape.fillOn && shape.fill === shape.color);
  it.sw = outline ? shape.width : 0; it.stroke = shape.color;
  // the picture takes the shape's place in the layer order
  p.items = p.items.filter((o) => o !== it);
  p.items.splice(p.items.indexOf(shape), 1, it);
  drawItems(pageIndex(p.id)); select(p.id, it.id);
  toast('The picture is now in the shape. Drag the handles to change its size; it stays filled.');
}

// ------------------------------------------------------------------ tables --
// A table is one object: column widths (fractions of its width), row heights (points), the
// text of every cell, an optional header row and a style. Text wraps inside its cell, and a
// row grows when its text needs more room. Screen and PDF use the same lines and padding.
const TPAD = { x: 6, y: 4 };
const minRowH = (it) => it.size * LINE + TPAD.y * 2;
const colXs = (it) => { const xs = [0]; it.cw.forEach((f) => xs.push(xs[xs.length - 1] + f * it.w)); return xs; };
const rowYs = (it) => { const ys = [0]; it.rh.forEach((h) => ys.push(ys[ys.length - 1] + h)); return ys; };
const isHeadRow = (it, r) => !!it.head && r === 0;
const rowFill = (it, r) => (isHeadRow(it, r) ? it.headFill : it.stripe && (r - (it.head ? 1 : 0)) % 2 === 1 ? it.stripe : '');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function fixTable(it) { it.rows = it.rh.length; it.cols = it.cw.length; it.h = round(it.rh.reduce((a, b) => a + b, 0)); }
function newTable(rows, cols, x, y, w) {
  const it = { id: uid(), type: 'table', ...DEFAULTS.table, x, y, w, cw: Array(cols).fill(1 / cols), align: Array(cols).fill('left') };
  it.cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (it.head && r === 0 ? `Heading ${c + 1}` : '')));
  it.rh = Array(rows).fill(Math.ceil(minRowH(it) + 8));
  it.rmin = it.rh.slice();
  fixTable(it);
  return it;
}
// the border lines in table points: [x1, y1, x2, y2]
function tableLines(it) {
  const xs = colXs(it), ys = rowYs(it), W = it.w, H = it.h, m = it.borders, out = [];
  if (m === 'all' || m === 'outer') out.push([0, 0, W, 0], [W, 0, W, H], [W, H, 0, H], [0, H, 0, 0]);
  if (m === 'all' || m === 'rows') for (let r = 1; r < it.rows; r++) out.push([0, ys[r], W, ys[r]]);
  if (m === 'rows') out.push([0, H, W, H]);
  if (m === 'all') for (let c = 1; c < it.cols; c++) out.push([xs[c], 0, xs[c], H]);
  return out;
}
function tableHtml(it, z, live) {
  const xs = colXs(it), ys = rowYs(it);
  const just = { left: 'flex-start', center: 'center', right: 'flex-end' };
  let html = '';
  for (let r = 0; r < it.rows; r++) for (let c = 0; c < it.cols; c++) {
    const head = isHeadRow(it, r), fill = rowFill(it, r), a = it.align[c] || 'left';
    const active = live && S.cell && S.cell.id === it.id && S.cell.r === r && S.cell.c === c && S.sel && S.sel.id === it.id;
    html += `<div class="pe-cell${active ? ' active' : ''}" data-r="${r}" data-c="${c}" style="left:${xs[c] * z}px;top:${ys[r] * z}px;width:${(xs[c + 1] - xs[c]) * z}px;height:${it.rh[r] * z}px;`
      + `padding:${TPAD.y * z}px ${TPAD.x * z}px;${fill ? `background:${fill};` : ''}justify-content:${just[a]};text-align:${a};color:${head ? it.headColor : it.color};font-weight:${head ? 700 : 400}">`
      + `<span class="pe-cell-text" dir="auto">${escHtml(it.cells[r][c])}</span></div>`;
  }
  return html + tableLinesSvg(it, z);
}
function tableLinesSvg(it, z) {
  const lines = tableLines(it);
  if (!lines.length) return '';
  return `<svg class="pe-tlines" viewBox="0 0 ${it.w * z} ${it.h * z}"><path d="${lines.map(([a, b, c, d]) => `M${round(a * z)} ${round(b * z)}L${round(c * z)} ${round(d * z)}`).join('')}" fill="none" stroke="${it.border}" stroke-width="${it.bw * z}" stroke-linecap="square"/></svg>`;
}
// lines of one paragraph that fit maxW (long words are broken, like the screen does)
async function wrapText(page, fo, para, size, maxW, measure) {
  if (!para) return [''];
  const width = async (t) => (await measure(page, fo, t, size)).width;
  const out = [];
  let cur = '';
  for (const tok of para.split(/(\s+)/)) {
    if (!tok) continue;
    const next = cur + tok;
    if (!cur || (await width(next.trimEnd())) <= maxW) { cur = next; continue; }
    out.push(cur.trimEnd());
    cur = tok.trimStart();
  }
  const res = [];
  for (const line of [...out, cur.trimEnd()]) {
    if (line.length < 2 || (await width(line)) <= maxW) { res.push(line); continue; }
    let part = '';
    for (const ch of Array.from(line)) { if (part && (await width(part + ch)) > maxW) { res.push(part); part = ''; } part += ch; }
    res.push(part);
  }
  return res;
}

// typing in a cell
function caretOffset(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return null;
  const end = sel.getRangeAt(0), r = end.cloneRange();
  r.selectNodeContents(el); r.setEnd(end.endContainer, end.endOffset);
  return r.toString().length;
}
function placeCaret(el, off) {
  const range = document.createRange();
  const t = el.firstChild;
  if (t && t.nodeType === 3 && off != null) { range.setStart(t, Math.min(off, t.length)); range.collapse(true); } else { range.selectNodeContents(el); range.collapse(false); }
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
}
// new row heights without rebuilding the cells (keeps the one being typed in)
function relayoutTable(o, it) {
  const z = S.zoom, ys = rowYs(it);
  o.style.height = `${it.h * z}px`;
  o.querySelectorAll('.pe-cell').forEach((el) => { const r = Number(el.dataset.r); el.style.top = `${ys[r] * z}px`; el.style.height = `${it.rh[r] * z}px`; });
  const old = o.querySelector('.pe-tlines');
  if (old) old.remove();
  o.insertAdjacentHTML('beforeend', tableLinesSvg(it, z));
}
function markActiveCell(it) {
  $$(`.pe-page .pe-obj[data-id="${it.id}"] .pe-cell`).forEach((el) => el.classList.toggle('active', !!S.cell && S.cell.id === it.id && Number(el.dataset.r) === S.cell.r && Number(el.dataset.c) === S.cell.c));
}
function editCell(pageId, it, r, c) {
  if (it.locked) return;
  if (!(S.cellEdit && S.cellEdit.id === it.id)) { finishEditing(); snapshot(); }
  S.sel = { page: pageId, id: it.id };
  S.cell = { id: it.id, r, c };
  S.cellEdit = { page: pageId, id: it.id, r, c, busy: true };
  clearSelectionUi();
  drawItems(pageIndex(pageId));
  updateProps(); renderLayers();
}
function startCellEditing(o, it) {
  const ce = S.cellEdit;
  const span = o.querySelector(`.pe-cell[data-r="${ce.r}"][data-c="${ce.c}"] .pe-cell-text`);
  if (!span) return;
  span.parentNode.classList.add('editing');
  span.contentEditable = 'plaintext-only';
  if (span.contentEditable !== 'plaintext-only') span.contentEditable = 'true';
  span.spellcheck = false;
  // focus now (keys typed right after Tab must land here), and again after layout settles
  const focusIt = () => { if (S.cellEdit !== ce || !span.isConnected) return; span.focus({ preventScroll: true }); placeCaret(span, ce.caret); };
  focusIt();
  requestAnimationFrame(() => { focusIt(); ce.busy = false; });
  span.oninput = () => {
    it.cells[ce.r][ce.c] = span.innerText.replace(/\n$/, '');
    // a taller row moves the cells below in place, so the caret and the typing are not disturbed
    const need = span.offsetHeight / S.zoom + TPAD.y * 2;
    if (need > it.rh[ce.r] + 0.5) { it.rh[ce.r] = Math.ceil(need * 2) / 2; fixTable(it); relayoutTable(o, it); }
    drawThumbItems(pageById(ce.page));
  };
  span.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishEditing(); select(ce.page, it.id); return; }
    if (e.key === 'Tab') { e.preventDefault(); moveCell(it, e.shiftKey ? -1 : 1); }
  };
  span.onblur = () => setTimeout(() => { if (S.cellEdit === ce && !ce.busy && !(document.activeElement && document.activeElement.closest('.pe-cell'))) finishEditing(); }, 0);
  span.onpaste = (e) => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); };
}
// Tab / Shift+Tab: next or previous cell; Tab in the last cell adds a row, as in Word
function moveCell(it, d) {
  const ce = S.cellEdit;
  let n = ce.r * it.cols + ce.c + d;
  if (n < 0) return;
  if (n >= it.rows * it.cols) { addRow(it, it.rows); n = it.rows * it.cols - it.cols; }
  S.cellEdit = { ...ce, r: Math.floor(n / it.cols), c: n % it.cols, caret: null, busy: true };
  S.cell = { id: it.id, r: S.cellEdit.r, c: S.cellEdit.c };
  drawItems(pageIndex(ce.page));
}
function addRow(it, at) {
  it.cells.splice(at, 0, Array(it.cols).fill(''));
  const ref = it.rh[Math.min(at, it.rows - 1)] || minRowH(it) + 8;
  const h = Math.max(minRowH(it), Math.min(ref, minRowH(it) + 8));
  it.rh.splice(at, 0, h);
  if (it.rmin) it.rmin.splice(at, 0, h);
  fixTable(it);
}
// New and deleted columns keep the others in proportion (equal columns stay equal) and the
// table keeps its width.
function addCol(it, at) {
  const from = Math.min(at, it.cols - 1), f = 1 / (it.cols + 1);
  it.cw = it.cw.map((x) => x * (1 - f)); it.cw.splice(at, 0, f);
  it.align.splice(at, 0, it.align[from] || 'left');
  it.cells.forEach((row, r) => row.splice(at, 0, isHeadRow(it, r) ? 'Heading' : ''));
  fixTable(it);
}
function tableOp(op) {
  const it = itemOf(S.sel);
  if (!it || it.type !== 'table') return;
  const cur = S.cell && S.cell.id === it.id ? S.cell : null;
  const r = cur ? cur.r : it.rows - 1, c = cur ? cur.c : it.cols - 1;
  finishEditing();
  if (op.startsWith('align-')) {
    snapshot();
    const a = op.slice(6);
    if (cur) it.align[c] = a; else it.align = it.align.map(() => a);
  } else if (op === 'rowabove' || op === 'rowbelow') {
    snapshot(); addRow(it, op === 'rowabove' ? r : r + 1);
    if (cur) S.cell = { id: it.id, r: op === 'rowabove' ? r : r + 1, c };
  } else if (op === 'colleft' || op === 'colright') {
    snapshot(); addCol(it, op === 'colleft' ? c : c + 1);
    if (cur) S.cell = { id: it.id, r, c: op === 'colleft' ? c : c + 1 };
  } else if (op === 'delrow') {
    if (it.rows < 2) { toast('A table needs at least one row. Use Delete to remove the whole table.'); return; }
    snapshot(); it.cells.splice(r, 1); it.rh.splice(r, 1); if (it.rmin) it.rmin.splice(r, 1); fixTable(it);
    if (cur) S.cell = { id: it.id, r: Math.min(r, it.rows - 1), c };
  } else if (op === 'delcol') {
    if (it.cols < 2) { toast('A table needs at least one column. Use Delete to remove the whole table.'); return; }
    snapshot();
    it.cw.splice(c, 1); const sum = it.cw.reduce((a, b) => a + b, 0); it.cw = it.cw.map((x) => x / sum);
    it.align.splice(c, 1); it.cells.forEach((row) => row.splice(c, 1)); fixTable(it);
    if (cur) S.cell = { id: it.id, r, c: Math.min(c, it.cols - 1) };
  } else if (op === 'head') { snapshot(); it.head = !it.head; }
  else if (op === 'stripe') { snapshot(); it.stripe = it.stripe ? '' : '#f3f4f6'; }
  else if (op === 'equal') { snapshot(); it.cw = it.cw.map(() => 1 / it.cols); }
  else if (op === 'fitwidth') {
    // from margin to margin (40 pt, about 14 mm, on each side)
    snapshot();
    const [vw] = viewSize(pageById(S.sel.page));
    it.x = 40; it.w = round(vw - 80); delete it.ax;
  }
  drawItems(pageIndex(S.sel.page)); updateProps(); updatePanel();
}
// Insert: a size picker under the Table button, like in word processors
function toggleTablePicker() {
  const pop = $('#peTblPop');
  if (!pop.hidden) { pop.hidden = true; return; }
  const btn = $('[data-act="tablepick"]').getBoundingClientRect();
  pop.hidden = false;
  pop.style.left = `${clamp(btn.left, 8, window.innerWidth - pop.offsetWidth - 8)}px`;
  pop.style.top = `${btn.bottom + 6}px`;
  showTableSize(3, 3);
}
function showTableSize(r, c) {
  $$('#peTblGrid i').forEach((cell) => cell.classList.toggle('on', Number(cell.dataset.r) <= r && Number(cell.dataset.c) <= c));
  $('#peTblSize').textContent = `${r} ${r === 1 ? 'row' : 'rows'} x ${c} ${c === 1 ? 'column' : 'columns'}`;
}
function insertTable(rows, cols) {
  $('#peTblPop').hidden = true;
  const p = S.pages[S.current];
  if (!p) return;
  finishEditing();
  const [vw, vh] = viewSize(p);
  const w = Math.min(vw - 96, Math.max(160, cols * 110));
  const pageEl = $(`.pe-page[data-id="${p.id}"]`);
  const view = $('#peView').getBoundingClientRect();
  const visTop = pageEl ? Math.max(0, (view.top - pageEl.getBoundingClientRect().top) / S.zoom) : 0;
  const it = newTable(rows, cols, round((vw - w) / 2), 0, w);
  it.y = round(clamp(visTop + 60, 24, Math.max(24, vh - it.h - 24)));
  snapshot();
  p.items.push(it);
  setTool('select');
  drawItems(pageIndex(p.id));
  select(p.id, it.id);
  toast('Double-click a cell to type. Use the table buttons above to add rows and columns.');
}
function bindTables() {
  const grid = $('#peTblGrid');
  let html = '';
  for (let r = 1; r <= 10; r++) for (let c = 1; c <= 8; c++) html += `<i data-r="${r}" data-c="${c}"></i>`;
  grid.innerHTML = html;
  grid.addEventListener('pointerover', (e) => { const i = e.target.closest('i'); if (i) showTableSize(Number(i.dataset.r), Number(i.dataset.c)); });
  grid.addEventListener('click', (e) => { const i = e.target.closest('i'); if (i) insertTable(Number(i.dataset.r), Number(i.dataset.c)); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#peTblPop') && !e.target.closest('[data-act="tablepick"]')) $('#peTblPop').hidden = true; });
}

// --------------------------------------------------------------- selection --
function select(pageId, id) {
  finishEditing();
  S.sel = id ? { page: pageId, id } : null;
  if (!S.cell || S.cell.id !== id) S.cell = null;
  clearSelectionUi();
  if (S.sel) decorateSelection();
  updateProps(); renderLayers();
}
const isLine = (it) => it.type === 'line' || it.type === 'arrow';
function clearSelectionUi() { $$('.pe-selbox, .pe-handle').forEach((e) => e.remove()); }
// Outline, corner handles and a rotation handle, turned with the object.
function decorateSelection() {
  clearSelectionUi();
  const it = itemOf(S.sel);
  const pageEl = S.sel && $(`.pe-page[data-id="${S.sel.page}"]`);
  if (!it || !pageEl || it.hidden || S.editing === it.id) return;
  const layer = pageEl.querySelector('.pe-layer');
  const z = S.zoom;
  const handle = (h, parent, x, y) => {
    const d = document.createElement('div'); d.className = 'pe-handle'; d.dataset.h = h;
    d.style.left = typeof x === 'number' ? `${x}px` : x; d.style.top = typeof y === 'number' ? `${y}px` : y;
    parent.append(d);
  };
  if (isLine(it)) {
    if (!it.locked) { handle('p1', layer, it.x1 * z, it.y1 * z); handle('p2', layer, it.x2 * z, it.y2 * z); }
    return;
  }
  const box = document.createElement('div');
  box.className = 'pe-selbox';
  Object.assign(box.style, { left: `${it.x * z}px`, top: `${it.y * z}px`, width: `${it.w * z}px`, height: `${it.h * z}px` });
  if (it.rot) box.style.transform = `rotate(${it.rot}deg)`;
  if (it.locked) box.classList.add('no-rot');
  else {
    [['nw', '0%', '0%'], ['ne', '100%', '0%'], ['sw', '0%', '100%'], ['se', '100%', '100%']].forEach(([h, x, y]) => handle(h, box, x, y));
    // tables also get side handles: drag them to make the table wider or narrower only
    if (it.type === 'table') [['w', '0%', '50%'], ['e', '100%', '50%']].forEach(([h, x, y]) => handle(h, box, x, y));
    handle('rot', box, '50%', 0);
    if (it.type === 'table' && !it.rot) {
      // drag the lines between columns and under rows to resize them
      const xs = colXs(it), ys = rowYs(it);
      for (let c = 1; c < it.cols; c++) { const g = document.createElement('div'); g.className = 'pe-handle pe-tgrip col'; g.dataset.h = 'col'; g.dataset.i = c; g.style.left = `${xs[c] * z}px`; g.title = 'Drag to change the column width'; box.append(g); }
      for (let r = 0; r < it.rows; r++) { const g = document.createElement('div'); g.className = 'pe-handle pe-tgrip row'; g.dataset.h = 'row'; g.dataset.i = r; g.style.top = `${ys[r + 1] * z}px`; g.title = 'Drag to change the row height'; box.append(g); }
    }
  }
  layer.append(box);
}

// ----------------------------------------------------------- arrange etc. --
function arrange(where) {
  const it = itemOf(S.sel);
  if (!it) return;
  const p = pageById(S.sel.page);
  const i = p.items.indexOf(it);
  const j = clamp({ tofront: p.items.length - 1, toback: 0, forward: i + 1, backward: i - 1 }[where], 0, p.items.length - 1);
  if (j === i) return;
  snapshot();
  p.items.splice(i, 1); p.items.splice(j, 0, it);
  drawItems(pageIndex(p.id));
}
function toggleFlag(sel, flag) {
  const it = itemOf(sel);
  if (!it) return;
  snapshot();
  it[flag] = !it[flag];
  const i = pageIndex(sel.page);
  if (flag === 'hidden' && it.hidden && S.sel && S.sel.id === it.id) S.sel = null;
  drawItems(i); updateProps(); renderLayers();
}
let clip = null;
function copySel(cut) {
  const it = itemOf(S.sel);
  if (!it) return false;
  clip = { item: JSON.parse(JSON.stringify(it)), page: S.sel.page };
  if (cut) removeSelected(); else toast('Copied');
  return true;
}
function pasteClip() {
  if (!clip) return false;
  const p = S.pages[S.current] || S.pages[0];
  const c = { ...JSON.parse(JSON.stringify(clip.item)), id: uid(), locked: false, hidden: false };
  if (clip.page === p.id) moveItem(c, 12, 12);
  const [vw, vh] = viewSize(p);
  moveItem(c, clamp(c.x, 0, Math.max(0, vw - c.w)) - c.x, clamp(c.y, 0, Math.max(0, vh - c.h)) - c.y);
  snapshot();
  p.items.push(c);
  clip = { item: JSON.parse(JSON.stringify(c)), page: p.id }; // the next paste steps on again
  drawItems(pageIndex(p.id)); setTool('select'); select(p.id, c.id);
  return true;
}
// Paste from outside the editor: an image becomes an image, plain text becomes a text box.
async function pasteExternal(e) {
  const files = Array.from(e.clipboardData.files || []);
  const img = files.find(isImage);
  if (img) { e.preventDefault(); imagePick = null; insertImage(img); return; }
  const text = e.clipboardData.getData('text/plain');
  if (text && text.trim()) {
    e.preventDefault();
    const p = S.pages[S.current];
    const [vw, vh] = viewSize(p);
    snapshot();
    const t = { id: uid(), type: 'text', ...DEFAULTS.text, text: text.replace(/\r/g, '').slice(0, 5000), x: vw * 0.1, y: vh * 0.1, w: 10, h: 10 };
    p.items.push(t);
    drawItems(pageIndex(p.id)); setTool('select'); select(p.id, t.id);
  }
}

function removeSelected() {
  const it = itemOf(S.sel);
  if (!it) return;
  snapshot();
  const p = pageById(S.sel.page);
  p.items = p.items.filter((i) => i !== it);
  S.sel = null;
  drawItems(pageIndex(p.id)); updateProps();
}
function duplicateSelected() {
  const it = itemOf(S.sel);
  if (!it) return;
  snapshot();
  const p = pageById(S.sel.page);
  const c = { ...JSON.parse(JSON.stringify(it)), id: uid() };
  moveItem(c, 12, 12);
  p.items.push(c);
  drawItems(pageIndex(p.id)); select(p.id, c.id);
}
function frontSelected() { arrange('tofront'); }
function moveItem(it, dx, dy) {
  it.x += dx; it.y += dy;
  delete it.ax;
  if (it.type === 'line' || it.type === 'arrow') { it.x1 += dx; it.x2 += dx; it.y1 += dy; it.y2 += dy; }
}

// ------------------------------------------------------------ text editing --
function startEditing(o, it, keepCaret) {
  S.editing = it.id;
  o.contentEditable = 'plaintext-only';
  if (o.contentEditable !== 'plaintext-only') o.contentEditable = 'true';
  o.spellcheck = false;
  if (!keepCaret) {
    o.focus();
    const r = document.createRange(); r.selectNodeContents(o); r.collapse(false);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  o.oninput = () => {
    it.text = o.innerText.replace(/\n$/, '');
    it.w = o.offsetWidth / S.zoom; it.h = o.offsetHeight / S.zoom;
  };
  o.onblur = () => setTimeout(() => { if (S.editing === it.id && document.activeElement !== o) finishEditing(); }, 0);
  o.onpaste = (e) => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); };
  o.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); o.blur(); finishEditing(); } };
}
function editText(pageId, it) {
  const o = $(`.pe-page[data-id="${pageId}"] .pe-obj[data-id="${it.id}"]`);
  if (!o) return;
  if (S.editing !== it.id) { snapshot(); S.sel = { page: pageId, id: it.id }; }
  $$('.pe-handle').forEach((e) => e.remove()); o.classList.remove('pe-sel');
  startEditing(o, it);
  updateProps();
}
function finishEditing() {
  if (S.cellEdit) {
    const ce = S.cellEdit;
    S.cellEdit = null;
    const i = pageIndex(ce.page);
    if (i >= 0) drawItems(i);
    updateProps();
  }
  if (!S.editing) return;
  const id = S.editing;
  S.editing = null;
  for (const p of S.pages) {
    const it = p.items.find((i) => i.id === id);
    if (!it) continue;
    if (!it.text || !it.text.trim()) {
      p.items = p.items.filter((i) => i !== it);
      if (S.sel && S.sel.id === id) S.sel = null;
    }
    drawItems(pageIndex(p.id));
    break;
  }
  updateProps();
}

// ----------------------------------------------------- "Edit text" support --
const runKey = (tool, p) => `${tool}:${p.id}:${rotOf(p)}`;
const pdfPage = (p) => S.docs.get(p.src.doc).proxy.getPage(p.src.index + 1);

// Images drawn by the PDF itself, in view points: follows the graphics state through the
// page's drawing operations and maps each image's unit square to the page.
async function imageRuns(p) {
  const key = runKey('editimage', p);
  if (S.runs.has(key)) return S.runs.get(key);
  if (!p.src) { S.runs.set(key, []); return []; }
  const L = await lib();
  const page = await pdfPage(p);
  const vp = page.getViewport({ scale: 1, rotation: rotOf(p) });
  const ops = await page.getOperatorList();
  const O = L.OPS;
  const IMG = new Set([O.paintImageXObject, O.paintInlineImageXObject, O.paintImageMaskXObject, O.paintImageXObjectRepeat, O.paintJpegXObject].filter((v) => v !== undefined));
  const [vw, vh] = viewSize(p);
  const runs = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i];
    if (fn === O.save) stack.push(ctm);
    else if (fn === O.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === O.transform) ctm = L.Util.transform(ctm, a);
    else if (fn === O.paintFormXObjectBegin) { stack.push(ctm); if (a && a[0]) ctm = L.Util.transform(ctm, a[0]); }
    else if (fn === O.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (IMG.has(fn)) {
      const m = L.Util.transform(vp.transform, ctm);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const x = clamp(Math.min(...xs), 0, vw), y = clamp(Math.min(...ys), 0, vh);
      const w = clamp(Math.max(...xs), 0, vw) - x, h = clamp(Math.max(...ys), 0, vh) - y;
      if (w < 6 || h < 6) continue;
      if (runs.some((r) => Math.abs(r.x - x) < 1 && Math.abs(r.y - y) < 1 && Math.abs(r.w - w) < 1 && Math.abs(r.h - h) < 1)) continue;
      runs.push({ x, y, w, h, top: y });
    }
  }
  S.runs.set(key, runs);
  return runs;
}

async function textRuns(p) {
  const key = runKey('edittext', p);
  if (S.runs.has(key)) return S.runs.get(key);
  if (!p.src) { S.runs.set(key, []); return []; }
  const lib_ = await lib();
  const page = await pdfPage(p);
  const vp = page.getViewport({ scale: 1, rotation: rotOf(p) });
  const tc = await page.getTextContent();
  const runs = [];
  for (const t of tc.items) {
    if (!t.str || !t.str.trim()) continue;
    const m = lib_.Util.transform(vp.transform, t.transform);
    if (Math.abs(Math.atan2(m[1], m[0])) > 0.02) continue; // only horizontal text can be retyped in place
    const size = Math.hypot(m[2], m[3]);
    if (size < 2) continue;
    const style = tc.styles[t.fontName] || {};
    let name = '';
    try { const f = page.commonObjs.has(t.fontName) ? page.commonObjs.get(t.fontName) : null; name = (f && f.name) || ''; } catch { /* font not loaded */ }
    const family = catalogMatch(name) || (/mono|courier/i.test(`${style.fontFamily} ${name}`) ? 'courier'
      : (/serif/i.test(style.fontFamily || '') && !/sans/i.test(style.fontFamily || '')) || /times|roman|georgia|garamond/i.test(name) ? 'times' : 'helv');
    runs.push({
      str: t.str, size, x: m[4], base: m[5], w: t.width * (vp.scale || 1), top: m[5] - size * 0.92, h: size * 1.18,
      font: family, bold: /bold|black|heavy|semibold|demi/i.test(name), italic: /italic|oblique/i.test(name),
    });
  }
  S.runs.set(key, runs);
  return runs;
}

const RUNS = { edittext: textRuns, editimage: imageRuns };
async function showRuns(pageEl) {
  const p = pageById(pageEl.dataset.id);
  const layer = pageEl.querySelector('.pe-layer');
  const tool = S.tool;
  if (!p || !RUNS[tool] || layer.querySelector('.pe-runs')) return;
  const runs = await RUNS[tool](p);
  if (S.tool !== tool || layer.querySelector('.pe-runs')) return;
  const box = document.createElement('div');
  box.className = 'pe-runs';
  const z = S.zoom;
  runs.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = tool === 'editimage' ? 'pe-run img' : 'pe-run'; d.dataset.run = i;
    Object.assign(d.style, { left: `${r.x * z}px`, top: `${r.top * z}px`, width: `${r.w * z}px`, height: `${r.h * z}px` });
    box.append(d);
  });
  layer.prepend(box);
  if (!runs.length && !S.runToast && pageIndex(p.id) === S.current) {
    S.runToast = true;
    if (tool === 'editimage') toast(p.src ? 'No images found on this page. Use Image to add one.' : 'This page has no images yet. Use Image to add one.');
    else toast(p.src ? 'No editable text found on this page. Scanned pages contain pictures of text; use Text to type over them.' : 'This page has no text yet. Use Text to add some.');
  }
}
function hideRuns() { $$('.pe-runs').forEach((e) => e.remove()); closeImgMenu(); }

// ------------------------------------------------------------ edit images --
let imgTarget = null;   // { page, box } of the PDF image the menu acts on
let imagePick = null;   // what the chosen file in #peImageInput is for
function openImgMenu(p, run, e) {
  imgTarget = { page: p.id, box: { x: run.x, y: run.y, w: run.w, h: run.h } };
  const m = $('#peImgMenu');
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = `${clamp(e.clientX + 6, 8, window.innerWidth - r.width - 8)}px`;
  m.style.top = `${clamp(e.clientY + 6, 8, window.innerHeight - r.height - 8)}px`;
  m.querySelector('button').focus();
}
function closeImgMenu() { const m = $('#peImgMenu'); if (m) m.hidden = true; }

// The original page (without any edits) cut out at the box, as a PNG.
async function cropPage(p, box) {
  const page = await pdfPage(p);
  const sc = 2.5;
  const vp = page.getViewport({ scale: sc, rotation: rotOf(p) });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(box.w * sc)); c.height = Math.max(1, Math.round(box.h * sc));
  const ctx = c.getContext('2d');
  ctx.translate(-box.x * sc, -box.y * sc);
  await page.render({ canvas: c, canvasContext: ctx, viewport: vp }).promise;
  return c.toDataURL('image/png');
}
// a little larger than the image, so its soft edge pixels are covered too
const coverFor = (box) => ({ id: uid(), type: 'whiteout', color: '#ffffff', opacity: 100, x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 });
const fitInto = (a, box) => { const s = Math.min(box.w / a.w, box.h / a.h); const w = a.w * s, h = a.h * s; return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }; };

async function imgAction(act) {
  closeImgMenu();
  const t = imgTarget;
  if (!t) return;
  const p = pageById(t.page);
  if (!p) return;
  if (act === 'replace') { imagePick = { mode: 'pdf', target: t }; $('#peImageInput').click(); return; }
  if (act === 'delete') {
    snapshot(); p.items.push(coverFor(t.box)); drawItems(pageIndex(p.id));
    toast('Image covered. It stays hidden in the file; it is not removed from it.');
    return;
  }
  if (act === 'move') {
    busy(true, 'Preparing image…');
    try {
      const a = await addAsset(await cropPage(p, t.box));
      snapshot();
      const it = { id: uid(), type: 'image', asset: a.id, opacity: 100, ...t.box };
      p.items.push(coverFor(t.box), it);
      setTool('select');
      drawItems(pageIndex(p.id));
      select(p.id, it.id);
      toast('Drag the image to move it; use the corners to resize it.');
    } catch (e) { toast(e.message, true); } finally { busy(false); }
  }
}

async function replaceWith(file) {
  const pick = imagePick; imagePick = null;
  if (!isImage(file)) { toast('Please choose a PNG, JPG, WebP or GIF image.', true); return; }
  let a;
  try { a = await addAsset(file); } catch (e) { toast(e.message, true); return; }
  if (pick.mode === 'pdf') {
    const p = pageById(pick.target.page);
    if (!p) return;
    snapshot();
    const it = { id: uid(), type: 'image', asset: a.id, opacity: 100, ...fitInto(a, pick.target.box) };
    p.items.push(coverFor(pick.target.box), it);
    setTool('select');
    drawItems(pageIndex(p.id)); select(p.id, it.id);
  } else if (pick.mode === 'item') {
    const it = itemOf(pick.sel);
    if (!it) return;
    snapshot();
    Object.assign(it, { asset: a.id }, fitInto(a, { x: it.x, y: it.y, w: it.w, h: it.h }));
    drawItems(pageIndex(pick.sel.page)); select(pick.sel.page, it.id);
  }
}

async function editRunAt(p, pt) {
  const runs = await textRuns(p);
  const run = runs.find((r) => pt.x >= r.x - 1 && pt.x <= r.x + r.w + 1 && pt.y >= r.top - 1 && pt.y <= r.top + r.h + 1);
  if (!run) { toast('Click on a line of text in the PDF to change it.'); return; }
  snapshot();
  const cover = { id: uid(), type: 'whiteout', color: '#ffffff', opacity: 100, x: run.x - 1, y: run.top - 1, w: run.w + 2, h: run.h + 2 };
  const size = Math.round(run.size * 10) / 10;
  if (!isStd(run.font)) await ensureFont(run.font, run.bold, run.italic);
  const text = { id: uid(), type: 'text', text: run.str, font: run.font, size, bold: run.bold, italic: run.italic, underline: false, align: 'left', color: '#000000', opacity: 100,
    x: run.x, y: run.base - baselineOffset(run.font, size), w: run.w, h: run.h };
  p.items.push(cover, text);
  drawItems(pageIndex(p.id));
  S.sel = { page: p.id, id: text.id };
  editText(p.id, text);
}

// ------------------------------------------------------------ pointer input --
let drag = null;
let lastCellDown = null;

function ptOf(e, pageEl) {
  const r = pageEl.getBoundingClientRect();
  return { x: (e.clientX - r.left) / S.zoom, y: (e.clientY - r.top) / S.zoom };
}

function onPointerDown(e) {
  const pageEl = e.target.closest('.pe-page');
  if (!pageEl || e.button > 0) return;
  const p = pageById(pageEl.dataset.id);
  setCurrent(pageIndex(p.id));
  const pt = ptOf(e, pageEl);
  const objEl = e.target.closest('.pe-obj');
  const handle = e.target.closest('.pe-handle');
  const it = objEl ? p.items.find((i) => i.id === objEl.dataset.id) : null;

  if (it && S.editing === it.id) return; // typing: let the browser place the caret
  const cellEl = it && it.type === 'table' ? e.target.closest('.pe-cell') : null;
  const rc = cellEl ? { r: Number(cellEl.dataset.r), c: Number(cellEl.dataset.c) } : null;
  if (it && S.cellEdit && S.cellEdit.id === it.id && rc) {
    if (rc.r === S.cellEdit.r && rc.c === S.cellEdit.c) return; // typing in this cell
    e.preventDefault(); editCell(p.id, it, rc.r, rc.c); return;
  }
  // double-click (or double-tap) on a cell: type in it. Pointer events carry no click count,
  // and the first click redraws the cell, so the two presses are matched here.
  const now = performance.now(), prev = lastCellDown;
  lastCellDown = rc ? { id: it.id, r: rc.r, c: rc.c, t: now } : null;
  if (rc && prev && prev.id === it.id && prev.r === rc.r && prev.c === rc.c && now - prev.t < 450 && S.tool === 'select') {
    lastCellDown = null; e.preventDefault(); editCell(p.id, it, rc.r, rc.c); return;
  }

  if (handle) {
    e.preventDefault();
    const sel = itemOf(S.sel);
    if (!sel) return;
    const hk = handle.dataset.h;
    drag = { kind: hk === 'rot' ? 'rotate' : hk === 'col' || hk === 'row' ? 'tgrip' : 'resize', h: hk, i: Number(handle.dataset.i), page: p, it: sel, start: pt, orig: JSON.parse(JSON.stringify(sel)), moved: false };
    pageEl.setPointerCapture(e.pointerId);
    return;
  }

  const tool = S.tool;
  if (tool === 'select') {
    if (!it) { select(null, null); return; }
    e.preventDefault();
    if (!(S.sel && S.sel.id === it.id)) select(p.id, it.id);
    drag = { kind: 'move', page: p, it, start: pt, orig: { x: it.x, y: it.y }, moved: false, pageEl, rc };
    pageEl.setPointerCapture(e.pointerId);
    return;
  }
  if (tool === 'text') {
    e.preventDefault();
    if (it && it.type === 'text') { editText(p.id, it); return; }
    if (it && it.type === 'table' && rc) { setTool('select'); editCell(p.id, it, rc.r, rc.c); return; }
    finishEditing();
    snapshot();
    const d = DEFAULTS.text;
    const sp = snapToGuides(p, pt);
    const t = { id: uid(), type: 'text', text: '', ...d, x: sp.x, y: sp.y - baselineOffset(d.font, d.size), w: 4, h: d.size * LINE };
    p.items.push(t);
    S.editing = null;
    drawItems(pageIndex(p.id));
    S.sel = { page: p.id, id: t.id };
    startEditing(pageEl.querySelector(`.pe-obj[data-id="${t.id}"]`), t);
    updateProps();
    return;
  }
  if (tool === 'editimage') {
    e.preventDefault();
    finishEditing();
    if (it && it.type === 'image') { setTool('select'); select(p.id, it.id); return; }
    imageRuns(p).then((runs) => {
      // the smallest image under the pointer (a logo on top of a background picture)
      const hits = runs.filter((r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h).sort((a, b) => a.w * a.h - b.w * b.h);
      if (hits.length) openImgMenu(p, hits[0], e); else toast('Click on an image in the PDF. To add a new one, use Image.');
    });
    return;
  }
  if (tool === 'edittext') {
    e.preventDefault();
    if (it && it.type === 'text') { editText(p.id, it); return; }
    finishEditing();
    editRunAt(p, pt);
    return;
  }
  finishEditing();
  e.preventDefault();
  select(null, null);
  pageEl.setPointerCapture(e.pointerId);
  if (tool === 'pen') {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    path.setAttribute('class', 'pe-obj'); path.style.inset = '0'; path.style.width = '100%'; path.style.height = '100%'; path.style.position = 'absolute';
    const d = DEFAULTS.pen;
    path.innerHTML = `<path fill="none" stroke="${d.color}" stroke-width="${d.width * S.zoom}" stroke-linecap="round" stroke-linejoin="round" opacity="${d.opacity / 100}"/>`;
    pageEl.querySelector('.pe-layer').append(path);
    drag = { kind: 'pen', page: p, pts: [[pt.x, pt.y]], tmp: path };
    return;
  }
  const rub = document.createElement('div');
  rub.className = 'pe-rubber';
  pageEl.querySelector('.pe-layer').append(rub);
  const sp = snapToGuides(p, pt);
  drag = { kind: 'shape', tool, page: p, start: sp, end: sp, rub };
  drawRubber(drag);
}

function onPointerMove(e) {
  if (!drag) {
    if (RUNS[S.tool]) {
      const pageEl = e.target.closest('.pe-page');
      if (pageEl) {
        showRuns(pageEl);
        const pt = ptOf(e, pageEl);
        const p = pageById(pageEl.dataset.id);
        const runs = S.runs.get(runKey(S.tool, p)) || [];
        $$('.pe-run.hot').forEach((r) => r.classList.remove('hot'));
        const hits = runs.map((r, i) => [r, i]).filter(([r]) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.top && pt.y <= r.top + r.h)
          .sort((a, b) => a[0].w * a[0].h - b[0].w * b[0].h);
        if (hits.length) { const d = pageEl.querySelector(`.pe-run[data-run="${hits[0][1]}"]`); if (d) d.classList.add('hot'); }
      }
    }
    return;
  }
  const pageEl = $(`.pe-page[data-id="${drag.page.id}"]`);
  const pt = ptOf(e, pageEl);
  const [vw, vh] = viewSize(drag.page);
  if (drag.kind === 'move') {
    if (!drag.moved) { if (Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) < 2 / S.zoom) return; snapshot(); drag.moved = true; }
    const it = drag.it;
    let nx = clamp(drag.orig.x + pt.x - drag.start.x, -it.w + 8, vw - 8);
    let ny = clamp(drag.orig.y + pt.y - drag.start.y, -it.h + 8, vh - 8);
    const sn = e.altKey ? { x: nx, y: ny } : snapMove(drag.page, it, nx, ny);
    moveItem(it, sn.x - it.x, sn.y - it.y);
    const o = pageEl.querySelector(`.pe-obj[data-id="${it.id}"]`);
    o.style.left = `${it.x * S.zoom}px`; o.style.top = `${it.y * S.zoom}px`;
    showGuides(pageEl, sn.gx, sn.gy);
    decorateSelection();
    updatePanel();
    return;
  }
  if (drag.kind === 'tgrip') {
    if (!drag.moved) { snapshot(); drag.moved = true; }
    const it = drag.it, o = drag.orig, i = drag.i;
    if (drag.h === 'col') {
      const pair = (o.cw[i - 1] + o.cw[i]) * it.w, min = Math.min(28, pair / 2 - 1);
      const left = clamp(o.cw[i - 1] * it.w + pt.x - drag.start.x, min, pair - min);
      it.cw[i - 1] = left / it.w; it.cw[i] = (pair - left) / it.w;
    } else {
      it.rh[i] = Math.max(minRowH(it), round(o.rh[i] + pt.y - drag.start.y));
      it.rmin = (o.rmin || o.rh).slice(); it.rmin[i] = it.rh[i];
      fixTable(it);
    }
    drawItems(pageIndex(drag.page.id));
    updatePanel();
    return;
  }
  if (drag.kind === 'rotate') {
    if (!drag.moved) { snapshot(); drag.moved = true; }
    const it = drag.it;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    let a = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI + 90;
    if (e.shiftKey) a = Math.round(a / 15) * 15;
    else { const r90 = Math.round(a / 90) * 90; if (Math.abs(a - r90) < 4) a = r90; }
    it.rot = Math.round((((a % 360) + 360) % 360) * 10) / 10;
    drawItems(pageIndex(drag.page.id));
    updatePanel();
    return;
  }
  if (drag.kind === 'resize') {
    if (!drag.moved) { snapshot(); drag.moved = true; }
    const it = drag.it, o = drag.orig;
    const dx = pt.x - drag.start.x, dy = pt.y - drag.start.y;
    if (drag.h === 'p1' || drag.h === 'p2') {
      it[`x${drag.h[1]}`] = clamp(o[`x${drag.h[1]}`] + dx, 0, vw); it[`y${drag.h[1]}`] = clamp(o[`y${drag.h[1]}`] + dy, 0, vh);
      lineBox(it);
    } else {
      // work in the object's own (unrotated) frame, keep the opposite corner where it is
      const th = ((o.rot || 0) * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
      const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
      let L = -o.w / 2, R = o.w / 2, T = -o.h / 2, B = o.h / 2;
      // Ctrl (Cmd on Mac) or Alt: resize from the centre, so both sides grow or shrink equally
      const fromCentre = e.ctrlKey || e.metaKey || e.altKey;
      if (drag.h.includes('e')) { R += lx; if (fromCentre) L -= lx; }
      if (drag.h.includes('w')) { L += lx; if (fromCentre) R -= lx; }
      if (drag.h.includes('s')) { B += ly; if (fromCentre) T -= ly; }
      if (drag.h.includes('n')) { T += ly; if (fromCentre) B -= ly; }
      let w = R - L, h = B - T;
      if (((it.type === 'image' && !it.clip) || it.type === 'check' || it.type === 'cross' || it.type === 'text') && !e.shiftKey) {
        const k = Math.max(w / o.w, h / o.h);
        w = o.w * k; h = o.h * k;
        if (fromCentre) { L = -w / 2; R = w / 2; T = -h / 2; B = h / 2; }
        else {
          if (drag.h.includes('w')) L = R - w; else R = L + w;
          if (drag.h.includes('n')) T = B - h; else B = T + h;
        }
      }
      if (w < 4 || h < 4) return;
      const mx = (L + R) / 2, my = (T + B) / 2;
      const cx = o.x + o.w / 2 + mx * cs - my * sn, cy = o.y + o.h / 2 + mx * sn + my * cs;
      if (it.type === 'text') it.size = clamp(Math.round(o.size * (w / o.w) * 10) / 10, 4, 400);
      Object.assign(it, { x: cx - w / 2, y: cy - h / 2, w, h });
      if (it.type === 'table') { it.rh = o.rh.map((rh) => Math.max(minRowH(it), round(rh * (h / o.h)))); it.rmin = it.rh.slice(); fixTable(it); }
    }
    drawItems(pageIndex(drag.page.id));
    updatePanel();
    return;
  }
  if (drag.kind === 'pen') {
    const last = drag.pts[drag.pts.length - 1];
    if (Math.hypot(pt.x - last[0], pt.y - last[1]) < 0.8 / S.zoom) return;
    drag.pts.push([clamp(pt.x, 0, vw), clamp(pt.y, 0, vh)]);
    drag.tmp.firstChild.setAttribute('d', drag.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x * S.zoom} ${y * S.zoom}`).join(' '));
    return;
  }
  if (drag.kind === 'shape') {
    const sp = e.altKey ? pt : snapToGuides(drag.page, pt);
    drag.end = { x: clamp(sp.x, 0, vw), y: clamp(sp.y, 0, vh) }; drawRubber(drag);
  }
}

// Snap a moving object's edges and centre to the page and to other objects (Alt turns it off).
function snapMove(p, it, nx, ny) {
  const [vw, vh] = viewSize(p);
  const th = 5 / S.zoom;
  const xs = [0, vw / 2, vw], ys = [0, vh / 2, vh];
  p.items.forEach((o) => { if (o !== it && !o.hidden) { xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h); } });
  if (guidesOn() && p.guides) { xs.push(...p.guides.v); ys.push(...p.guides.h); }
  const pick = (pos, size, lines) => {
    let best = null;
    for (const off of [0, size / 2, size]) for (const c of lines) {
      const d = c - (pos + off);
      if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, c };
    }
    return best;
  };
  const bx = pick(nx, it.w, xs), by = pick(ny, it.h, ys);
  return { x: nx + (bx ? bx.d : 0), y: ny + (by ? by.d : 0), gx: bx ? bx.c : null, gy: by ? by.c : null };
}
function showGuides(pageEl, gx, gy) {
  $$('.pe-guide').forEach((g) => g.remove());
  if (!pageEl) return;
  const layer = pageEl.querySelector('.pe-layer');
  if (gx != null) { const g = document.createElement('div'); g.className = 'pe-guide v'; g.style.left = `${gx * S.zoom}px`; layer.append(g); }
  if (gy != null) { const g = document.createElement('div'); g.className = 'pe-guide h'; g.style.top = `${gy * S.zoom}px`; layer.append(g); }
}

function drawRubber(d) {
  const z = S.zoom;
  if (d.tool === 'line' || d.tool === 'arrow') {
    const len = Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y);
    const ang = Math.atan2(d.end.y - d.start.y, d.end.x - d.start.x);
    Object.assign(d.rub.style, { left: `${d.start.x * z}px`, top: `${d.start.y * z}px`, width: `${len * z}px`, height: '0px', transformOrigin: '0 0', transform: `rotate(${ang}rad)`, borderWidth: '1px 0 0', background: 'none' });
    return;
  }
  const x = Math.min(d.start.x, d.end.x), y = Math.min(d.start.y, d.end.y);
  Object.assign(d.rub.style, { left: `${x * z}px`, top: `${y * z}px`, width: `${Math.abs(d.end.x - d.start.x) * z}px`, height: `${Math.abs(d.end.y - d.start.y) * z}px` });
  if (d.tool === 'ellipse') d.rub.style.borderRadius = '50%';
}

function onPointerUp() {
  if (!drag) return;
  const d = drag; drag = null;
  const p = d.page, idx = pageIndex(p.id);
  if (d.kind === 'move' || d.kind === 'resize' || d.kind === 'rotate' || d.kind === 'tgrip') {
    showGuides(null);
    if (d.moved) { drawItems(idx); updateProps(); updatePanel(); }
    else if (d.kind === 'move' && d.it.type === 'text' && S.tool !== 'select') editText(p.id, d.it);
    else if (d.kind === 'move' && d.it.type === 'table' && d.rc) { S.cell = { id: d.it.id, ...d.rc }; markActiveCell(d.it); updateProps(); }
    return;
  }
  if (d.kind === 'pen') {
    d.tmp.remove();
    if (d.pts.length < 2) d.pts.push([d.pts[0][0] + 0.5, d.pts[0][1] + 0.5]);
    const xs = d.pts.map((q) => q[0]), ys = d.pts.map((q) => q[1]);
    const pad = DEFAULTS.pen.width;
    const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    const w = Math.max(...xs) - x + pad, h = Math.max(...ys) - y + pad;
    snapshot();
    p.items.push({ id: uid(), type: 'pen', ...DEFAULTS.pen, x, y, w, h, w0: w, h0: h, pts: d.pts.map(([a, b]) => [round(a - x), round(b - y)]) });
    drawItems(idx);
    return;
  }
  d.rub.remove();
  const t = d.tool;
  let { start: s, end: en } = d;
  const tiny = Math.hypot(en.x - s.x, en.y - s.y) < 4;
  const [vw, vh] = viewSize(p);
  snapshot();
  let it;
  if (t === 'line' || t === 'arrow') {
    if (tiny) en = { x: Math.min(vw, s.x + 100), y: s.y };
    it = { id: uid(), type: t, ...DEFAULTS[t], x1: s.x, y1: s.y, x2: en.x, y2: en.y };
    lineBox(it);
  } else {
    const dflt = { highlight: [140, 16], whiteout: [120, 28], check: [22, 22], cross: [20, 20] }[t] || [120, 70];
    let x = Math.min(s.x, en.x), y = Math.min(s.y, en.y), w = Math.abs(en.x - s.x), h = Math.abs(en.y - s.y);
    if (tiny) { w = dflt[0]; h = dflt[1]; x = (t === 'check' || t === 'cross') ? s.x - w / 2 : s.x; y = (t === 'check' || t === 'cross' || t === 'highlight') ? s.y - h / 2 : s.y; }
    x = clamp(x, 0, vw - 4); y = clamp(y, 0, vh - 4);
    it = { id: uid(), type: t, ...DEFAULTS[t], x, y, w, h };
  }
  p.items.push(it);
  drawItems(idx);
  if (t !== 'highlight' && t !== 'whiteout' && t !== 'check' && t !== 'cross') select(p.id, it.id);
}

// ------------------------------------------------------------------ tools --
function setTool(tool) {
  finishEditing();
  S.tool = tool;
  const more = $('.pe-more > .pe-tool');
  $$('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b === more ? SHAPES.has(tool) : b.dataset.tool === tool)));
  moveToolIndicator();
  $$('.pe-layer').forEach((l) => { l.className = `pe-layer tool-${tool}`; });
  $('#peView').dataset.curTool = tool; // guides can be grabbed with the Select tool only
  hideRuns();
  S.runToast = false;
  if (RUNS[tool]) $$('.pe-page').forEach((el) => { if (el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < window.innerHeight) showRuns(el); });
  if (tool !== 'select') select(null, null); else updateProps();
}

// -------------------------------------------------------------- properties --
const FIELDS = {
  color: $('#pColor'), fill: $('#pFill'), fillOn: $('#pFillOn'), width: $('#pWidth'),
  size: $('#pSize'), bold: $('#pBold'), italic: $('#pItalic'), underline: $('#pUnder'), opacity: $('#pOpacity'),
  dash: $('#pDash'), radius: $('#pRadius'),
};
function propTarget() {
  const it = itemOf(S.sel);
  if (it) return { kind: it.type, obj: it, item: true };
  const d = defaultsFor(S.tool);
  return d ? { kind: S.tool === 'edittext' ? 'text' : S.tool, obj: d, item: false } : null;
}
// The raised pill in the tool dock glides to the active tool.
function moveToolIndicator() {
  const dock = $('.pe-tools'), ind = $('.pe-tool-ind');
  if (!dock || !ind) return;
  const btn = $$(':scope > .pe-tool[aria-pressed="true"], :scope > .pe-more > .pe-tool[aria-pressed="true"]', dock)[0];
  dock.classList.toggle('has-ind', !!btn && btn.offsetWidth > 0);
  if (!btn) return;
  const box = btn.closest('.pe-more') || btn;
  ind.style.left = `${box.offsetLeft}px`; ind.style.width = `${btn.offsetWidth}px`;
}
const TOOL_NAMES = { select: 'Select', edittext: 'Edit text', editimage: 'Edit image', text: 'Text', pen: 'Draw', highlight: 'Highlight', whiteout: 'Whiteout', rect: 'Rectangle', ellipse: 'Circle', line: 'Line', arrow: 'Arrow', check: 'Check mark', cross: 'Cross' };
const TOOL_ICONS = { select: '<path d="M6 3l12 9-5.5 1.2L15 20l-2.4 1-2.5-6.6L6 18z"/>', edittext: '<path d="M4 7V5h11v2M9.5 5v14m-2 0h4"/><path d="M14 19l6-6 2 2-6 6h-2z"/>', editimage: '<rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="8" cy="9" r="1.6"/><path d="M17 12l-4-3-7 7"/>' };
function updateContextChip(t) {
  const it = itemOf(S.sel);
  const kind = it ? it.type : S.tool;
  $('#peCtxName').textContent = it ? (it.type === 'text' ? 'Text' : LAYER_NAMES[it.type] || 'Object') : TOOL_NAMES[S.tool] || '';
  $('#peCtxIco').innerHTML = TOOL_ICONS[kind] || LAYER_ICONS[kind] || TOOL_ICONS.select;
  $('#peCtxChip').title = it ? 'Selected object' : 'Current tool';
  return t;
}
function updateProps() {
  const t = propTarget();
  updateContextChip(t);
  const show = new Set(t ? PROPS[t.kind] || [] : []);
  if (t && t.item) show.add('layer');
  $$('.pe-prop').forEach((el) => el.classList.toggle('show', show.has(el.dataset.for)));
  if (t) {
    const o = t.obj;
    if ('color' in o) FIELDS.color.value = o.color;
    if ('fill' in o) { FIELDS.fill.value = o.fill; FIELDS.fillOn.checked = !!o.fillOn; }
    if ('width' in o) { FIELDS.width.value = o.width; $('#pWidthOut').textContent = o.width; }
    if ('font' in o) { const n = $('#pFontName'); n.textContent = fontInfo(o.font).name; n.style.fontFamily = cssFamily(o.font); if (!isStd(o.font)) ensureFont(o.font); }
    if ('size' in o) FIELDS.size.value = o.size;
    if ('bold' in o) FIELDS.bold.setAttribute('aria-pressed', String(!!o.bold));
    if ('italic' in o) FIELDS.italic.setAttribute('aria-pressed', String(!!o.italic));
    if ('underline' in o) FIELDS.underline.setAttribute('aria-pressed', String(!!o.underline));
    const al = o.type === 'table' ? o.align[S.cell && S.cell.id === o.id ? S.cell.c : 0] : o.align;
    $$('[data-align]').forEach((b) => b.setAttribute('aria-pressed', String((al || 'left') === b.dataset.align)));
    if (o.type === 'image') {
      $$('[data-imgshape]').forEach((b) => b.setAttribute('aria-pressed', String((o.clip || 'none') === b.dataset.imgshape)));
      $('#iBorderWrap').hidden = !o.clip;
      $('#iBorder').value = o.stroke || '#ffffff'; $('#iBorderW').value = String(o.sw || 0);
    }
    if (o.type === 'table') {
      $('#tHead').setAttribute('aria-pressed', String(!!o.head));
      $('#tStripe').setAttribute('aria-pressed', String(!!o.stripe));
      $('#tBorders').value = o.borders; $('#tBorder').value = o.border; $('#tHeadFill').value = o.headFill;
    }
    if ('dash' in o) FIELDS.dash.value = o.dash || 'solid';
    if ('radius' in o) { FIELDS.radius.value = o.radius || 0; $('#pRadiusOut').textContent = o.radius || 0; }
    if ('opacity' in o) { FIELDS.opacity.value = o.opacity; $('#pOpacityOut').textContent = `${o.opacity}%`; }
  }
  $('#peHint').textContent = t && t.item ? (t.kind === 'table' ? 'Double-click a cell to type, Tab for the next cell. Click a cell, then Delete removes its row. Drag the side handles to make the table wider.' : 'Delete key removes the selected object.') : HINTS[S.tool] || '';
  updatePanel();
}
let propSnap = false;
function setProp(key, value) {
  const t = propTarget();
  if (!t) return;
  if (t.item && !propSnap) { snapshot(); propSnap = true; }
  t.obj[key] = value;
  if (t.item) {
    // the default for that kind of object follows what was just chosen
    const d = DEFAULTS[t.kind];
    if (d && key in d) d[key] = value;
    if (t.obj.type === 'line' || t.obj.type === 'arrow') lineBox(t.obj);
    const p = pageById(S.sel.page);
    const wasEditing = S.editing;
    drawItems(pageIndex(p.id));
    if (wasEditing) { const o = $(`.pe-obj[data-id="${wasEditing}"]`); if (o) o.focus(); }
  }
}
const toggleProp = (key) => { const t = propTarget(); if (!t || !(key in t.obj || key === 'underline')) return; setProp(key, !t.obj[key]); propSnap = false; updateProps(); };
function bindProps() {
  const end = () => { propSnap = false; };
  FIELDS.color.addEventListener('input', () => setProp('color', FIELDS.color.value));
  FIELDS.fill.addEventListener('input', () => { setProp('fill', FIELDS.fill.value); setProp('fillOn', true); FIELDS.fillOn.checked = true; });
  FIELDS.fillOn.addEventListener('change', () => { setProp('fillOn', FIELDS.fillOn.checked); end(); });
  FIELDS.width.addEventListener('input', () => { $('#pWidthOut').textContent = FIELDS.width.value; setProp('width', Number(FIELDS.width.value)); });
  FIELDS.size.addEventListener('input', () => { const v = clamp(Number(FIELDS.size.value) || 0, 4, 200); if (v) setProp('size', v); });
  FIELDS.opacity.addEventListener('input', () => { $('#pOpacityOut').textContent = `${FIELDS.opacity.value}%`; setProp('opacity', Number(FIELDS.opacity.value)); });
  [FIELDS.bold, FIELDS.italic, FIELDS.underline, ...$$('[data-align]'), $('#pFontBtn')].forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault())); // keep the caret in the text
  FIELDS.bold.addEventListener('click', () => { const t = propTarget(); if (t && t.item && t.obj.type === 'text') ensureFont(t.obj.font, !t.obj.bold, t.obj.italic); toggleProp('bold'); });
  FIELDS.italic.addEventListener('click', () => { const t = propTarget(); if (t && t.item && t.obj.type === 'text') ensureFont(t.obj.font, t.obj.bold, !t.obj.italic); toggleProp('italic'); });
  FIELDS.underline.addEventListener('click', () => toggleProp('underline'));
  $$('[data-align]').forEach((b) => b.addEventListener('click', () => {
    const t = propTarget();
    if (t && t.item && t.obj.type === 'table') tableOp(`align-${b.dataset.align}`);
    else { setProp('align', b.dataset.align); end(); }
    updateProps();
  }));
  $$('[data-imgshape]').forEach((b) => b.addEventListener('click', () => setImageShape(b.dataset.imgshape)));
  $('#iIntoShape').addEventListener('click', imageIntoShape);
  $('#iBorder').addEventListener('input', () => { if (!(Number($('#iBorderW').value) > 0)) { $('#iBorderW').value = '3'; setProp('sw', 3); } setProp('stroke', $('#iBorder').value); });
  $('#iBorderW').addEventListener('change', () => { setProp('sw', Number($('#iBorderW').value)); if (!itemOf(S.sel).stroke) setProp('stroke', '#ffffff'); end(); });
  $('#iBorder').addEventListener('change', end);
  $$('[data-tbl]').forEach((b) => { b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => tableOp(b.dataset.tbl)); });
  $('#tBorders').addEventListener('change', () => { setProp('borders', $('#tBorders').value); end(); });
  $('#tBorder').addEventListener('input', () => setProp('border', $('#tBorder').value));
  $('#tHeadFill').addEventListener('input', () => setProp('headFill', $('#tHeadFill').value));
  [$('#tBorder'), $('#tHeadFill')].forEach((f) => f.addEventListener('change', end));
  FIELDS.dash.addEventListener('change', () => { setProp('dash', FIELDS.dash.value); end(); });
  FIELDS.radius.addEventListener('input', () => { $('#pRadiusOut').textContent = FIELDS.radius.value; setProp('radius', Number(FIELDS.radius.value)); });
  $('#pFontBtn').addEventListener('click', (e) => { e.stopPropagation(); if ($('#peFontPop').hidden) openFontPicker(); else closeFontPicker(); });
  Object.values(FIELDS).forEach((f) => f.addEventListener('change', end));
}

// ------------------------------------------------------------- font picker --
let fontCat = 'all', fontActive = -1, fontIO = null;
function openFontPicker() {
  const pop = $('#peFontPop'), btn = $('#pFontBtn');
  pop.hidden = false;
  const r = btn.getBoundingClientRect();
  pop.style.left = `${clamp(r.left, 8, window.innerWidth - pop.offsetWidth - 8)}px`;
  pop.style.top = `${clamp(r.bottom + 6, 8, window.innerHeight - pop.offsetHeight - 8)}px`;
  $('#peFontSearch').value = '';
  const t = propTarget();
  const own = t && t.item && t.obj.type === 'text' ? t.obj.text.split('\n')[0].trim().slice(0, 48) : '';
  $('#peFontPrevText').textContent = own || 'The quick brown fox';
  previewFont(null);
  renderFontList();
  $('#peFontSearch').focus();
}
function closeFontPicker() {
  if ($('#peFontPop').hidden) return;
  if (fontPreviewing) previewFont(null);
  $('#peFontPop').hidden = true;
}
// Hovering a font shows it at once on the selected text (and in the sample); leaving the list
// or closing the picker puts the real font back. Nothing is saved until a font is clicked.
let fontPreviewing = null;
function previewFont(id) {
  const t = propTarget();
  const base = (t && t.obj.font) || 'helv';
  const fid = id || base;
  fontPreviewing = id;
  const el = t && t.item && t.obj.type === 'text' ? $(`#peView .pe-obj[data-id="${t.obj.id}"]`) : null;
  const apply = () => {
    if (fontPreviewing !== id) return;
    $('#peFontPrevText').style.fontFamily = cssFamily(fid);
    $('#peFontPrevName').textContent = id && id !== base ? `${fontInfo(fid).name} (preview)` : fontInfo(fid).name;
    if (el) el.style.fontFamily = cssFamily(fid);
  };
  apply();
  if (id) ensureFont(id, t && t.obj.bold, t && t.obj.italic).then(apply);
}
function renderFontList() {
  const cats = $('#peFontCats');
  if (!cats.childElementCount) {
    FONT_CATS.forEach(([id, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.cat = id; b.textContent = label;
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { fontCat = id; renderFontList(); });
      cats.append(b);
    });
  }
  $$('button', cats).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === fontCat)));
  const q = $('#peFontSearch').value.trim().toLowerCase();
  const t = propTarget();
  const current = t && t.obj.font;
  const list = $('#peFontList');
  list.textContent = '';
  if (fontIO) fontIO.disconnect();
  fontIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const id = e.target.dataset.font;
    fontIO.unobserve(e.target);
    ensureFont(id).then(() => { e.target.firstChild.style.fontFamily = cssFamily(id); });
  }), { root: list });
  const row = (f) => {
    const li = document.createElement('li');
    li.dataset.font = f.id; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(f.id === current));
    const name = document.createElement('span'); name.textContent = f.name;
    if (isStd(f.id) || fontLoads.has(`${f.id}:400`)) name.style.fontFamily = cssFamily(f.id);
    const tag = document.createElement('small'); tag.textContent = f.note || (f.cat === 'standard' ? 'built in' : f.cat);
    li.append(name, tag);
    li.addEventListener('mousedown', (e) => e.preventDefault());
    li.addEventListener('mouseenter', () => previewFont(f.id));
    li.addEventListener('click', () => chooseFont(f.id));
    list.append(li);
    if (!isStd(f.id)) fontIO.observe(li);
  };
  const head = (text) => { const li = document.createElement('li'); li.className = 'pe-fonthead'; li.textContent = text; list.append(li); };
  const match = (f) => (fontCat === 'all' || f.cat === fontCat) && (!q || f.name.toLowerCase().includes(q) || (f.note || '').toLowerCase().includes(q));
  const recent = recentFonts.map((id) => FONT_BY_ID.get(id)).filter(Boolean).filter(match);
  if (!q && fontCat === 'all' && recent.length) { head('Recent'); recent.forEach(row); head('All fonts'); }
  const all = CATALOG.filter(match);
  all.forEach(row);
  if (!all.length) head('No font matches');
  fontActive = -1;
}
function chooseFont(id) {
  const t = propTarget();
  fontPreviewing = null;
  $('#peFontPop').hidden = true;
  if (!t) return;
  rememberFont(id);
  ensureFont(id, t.obj.bold, t.obj.italic);
  setProp('font', id); propSnap = false;
  updateProps();
}
function fontKeys(e) {
  const items = $$('#peFontList li[data-font]');
  if (e.key === 'Escape') { closeFontPicker(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    fontActive = clamp(fontActive + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
    items.forEach((li, i) => li.classList.toggle('active', i === fontActive));
    if (items[fontActive]) { items[fontActive].scrollIntoView({ block: 'nearest' }); previewFont(items[fontActive].dataset.font); }
  }
  if (e.key === 'Enter') { e.preventDefault(); const li = items[Math.max(0, fontActive)]; if (li) chooseFont(li.dataset.font); }
}

// ---------------------------------------------------- design panel + layers --
const UNITS = { pt: 1, px: 96 / 72, mm: 25.4 / 72, cm: 2.54 / 72, in: 1 / 72 };
let UNIT = 'mm';
try { UNIT = UNITS[localStorage.getItem('pe-unit')] ? localStorage.getItem('pe-unit') : 'mm'; } catch { /* storage off */ }
const toU = (v) => Math.round(v * UNITS[UNIT] * (UNIT === 'in' ? 1000 : 10)) / (UNIT === 'in' ? 1000 : 10);
const fromU = (v) => v / UNITS[UNIT];
const DFIELDS = ['dX', 'dY', 'dW', 'dH', 'dR'];
function updatePanel() {
  const d = $('#peDesign');
  if (!d) return;
  const it = itemOf(S.sel);
  d.hidden = !it;
  if (!it) return;
  const set = (id, v, off) => { const el = $(`#${id}`); if (document.activeElement !== el) el.value = v; el.disabled = !!off; };
  set('dX', toU(it.x)); set('dY', toU(it.y));
  set('dW', toU(it.w), it.type === 'text' || isLine(it)); set('dH', toU(it.h), it.type === 'text' || isLine(it));
  set('dR', Math.round((it.rot || 0) * 10) / 10, isLine(it));
  $('#dLock').setAttribute('aria-pressed', String(!!it.locked));
}
function onDesignInput(id) {
  const it = itemOf(S.sel);
  const v = Number($(`#${id}`).value);
  if (!it || !Number.isFinite(v)) return;
  snapshot();
  if (id === 'dX') moveItem(it, fromU(v) - it.x, 0);
  if (id === 'dY') moveItem(it, 0, fromU(v) - it.y);
  if (id === 'dW' && fromU(v) >= 2) it.w = fromU(v);
  if (id === 'dH' && fromU(v) >= 2) it.h = fromU(v);
  if (id === 'dR') it.rot = ((v % 360) + 360) % 360;
  drawItems(pageIndex(S.sel.page)); updatePanel();
}
function alignTo(where) {
  const it = itemOf(S.sel);
  if (!it) return;
  const [vw, vh] = viewSize(pageById(S.sel.page));
  const nx = { left: 0, hcenter: (vw - it.w) / 2, right: vw - it.w }[where];
  const ny = { top: 0, vcenter: (vh - it.h) / 2, bottom: vh - it.h }[where];
  snapshot();
  moveItem(it, nx === undefined ? 0 : nx - it.x, ny === undefined ? 0 : ny - it.y);
  drawItems(pageIndex(S.sel.page)); updatePanel();
}
function rotateSel(deg) {
  const it = itemOf(S.sel);
  if (!it || isLine(it)) return;
  snapshot();
  it.rot = ((((it.rot || 0) + deg) % 360) + 360) % 360;
  drawItems(pageIndex(S.sel.page)); updatePanel();
}

const LAYER_NAMES = { table: 'Table', image: 'Image', pen: 'Drawing', highlight: 'Highlight', whiteout: 'Whiteout', rect: 'Rectangle', ellipse: 'Circle', line: 'Line', arrow: 'Arrow', check: 'Check mark', cross: 'Cross' };
const LAYER_ICONS = {
  text: '<path d="M5 6V4h14v2M12 4v16m-3 0h6"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  pen: '<path d="M3 21c3-1 4-4 7-7l7-7a2.1 2.1 0 0 0-3-3l-7 7c-3 3-6 4-7 7z"/>', highlight: '<path d="M9 11l-5 5v4h4l5-5"/><path d="M9 11l6-6 4 4-6 6z"/>',
  whiteout: '<rect x="3" y="6" width="18" height="12" rx="1.5"/>', rect: '<rect x="4" y="5" width="16" height="14" rx="1"/>', ellipse: '<ellipse cx="12" cy="12" rx="8" ry="7"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/>',
  line: '<path d="M5 19L19 5"/>', arrow: '<path d="M5 19L19 5m-8 0h8v8"/>', check: '<path d="M5 12l5 5L20 7"/>', cross: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
const EYE_OFF = '<path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1"/>';
const LOCK = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
const UNLOCK = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>';
const layerName = (it) => (it.type === 'text' ? (it.text.split('\n')[0].trim().slice(0, 40) || 'Text') : LAYER_NAMES[it.type] || it.type);
const layersPage = () => (S.sel && pageById(S.sel.page)) || S.pages[S.current];
function renderLayers() {
  const list = $('#peLayers');
  if (!list || $('#peApp').hidden) return;
  const p = layersPage();
  if (!p) return;
  $('#peLayerPage').textContent = `Page ${pageIndex(p.id) + 1}`;
  // Rebuild only when the layers changed; otherwise just move the highlight (a rebuild in the
  // middle of a click would swallow the click).
  const sig = p.id + p.items.map((it) => `|${it.id}:${layerName(it)}:${it.hidden ? 1 : 0}${it.locked ? 1 : 0}:${it.font || ''}`).join('');
  if (list.dataset.sig === sig) {
    $$('li', list).forEach((li) => li.classList.toggle('sel', !!(S.sel && S.sel.id === li.dataset.id)));
    return;
  }
  list.dataset.sig = sig;
  list.textContent = '';
  list.dataset.page = p.id;
  $('#peLayersEmpty').hidden = p.items.length > 0;
  p.items.slice().reverse().forEach((it) => {
    const li = document.createElement('li');
    li.draggable = true; li.dataset.id = it.id;
    li.className = `${S.sel && S.sel.id === it.id ? 'sel' : ''} ${it.hidden ? 'is-hidden' : ''}`;
    li.innerHTML = `<svg viewBox="0 0 24 24">${LAYER_ICONS[it.type] || ''}</svg><span class="pe-lname"></span>
      <button type="button" class="pe-lbtn${it.locked ? ' on' : ''}" data-l="lock" title="${it.locked ? 'Unlock' : 'Lock'}" aria-label="${it.locked ? 'Unlock' : 'Lock'}"><svg viewBox="0 0 24 24">${it.locked ? LOCK : UNLOCK}</svg></button>
      <button type="button" class="pe-lbtn${it.hidden ? ' on' : ''}" data-l="eye" title="${it.hidden ? 'Show' : 'Hide'}" aria-label="${it.hidden ? 'Show' : 'Hide'}"><svg viewBox="0 0 24 24">${it.hidden ? EYE_OFF : EYE}</svg></button>`;
    li.querySelector('.pe-lname').textContent = layerName(it);
    if (it.type === 'text') li.querySelector('.pe-lname').style.fontFamily = cssFamily(it.font);
    list.append(li);
  });
}
function bindLayers() {
  const list = $('#peLayers');
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const pid = list.dataset.page;
    const btn = e.target.closest('[data-l]');
    if (btn) { toggleFlag({ page: pid, id: li.dataset.id }, btn.dataset.l === 'eye' ? 'hidden' : 'locked'); return; }
    const it = itemOf({ page: pid, id: li.dataset.id });
    if (!it || it.hidden) return;
    if (S.tool !== 'select') setTool('select');
    select(pid, li.dataset.id);
    const el = $(`.pe-page[data-id="${pid}"] .pe-obj[data-id="${li.dataset.id}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  list.addEventListener('dblclick', (e) => {
    const li = e.target.closest('li');
    const it = li && itemOf({ page: list.dataset.page, id: li.dataset.id });
    if (it && it.type === 'text' && !it.locked && !it.hidden) editText(list.dataset.page, it);
  });
  let dragId = null;
  const clear = () => $$('li', list).forEach((x) => x.classList.remove('drop-before', 'drop-after'));
  list.addEventListener('dragstart', (e) => { const li = e.target.closest('li'); if (!li) return; dragId = li.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
  list.addEventListener('dragover', (e) => {
    const li = e.target.closest('li');
    if (!dragId || !li) return;
    e.preventDefault(); clear();
    const r = li.getBoundingClientRect();
    li.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  list.addEventListener('dragend', () => { dragId = null; clear(); });
  list.addEventListener('drop', (e) => {
    const li = e.target.closest('li');
    if (!dragId || !li) return;
    e.preventDefault();
    const before = li.classList.contains('drop-before');
    clear();
    const p = pageById(list.dataset.page);
    if (!p || li.dataset.id === dragId) { dragId = null; return; }
    const order = p.items.slice().reverse().map((x) => x.id).filter((id) => id !== dragId); // top of the list = front
    order.splice(order.indexOf(li.dataset.id) + (before ? 0 : 1), 0, dragId);
    snapshot();
    const byId = new Map(p.items.map((x) => [x.id, x]));
    p.items = order.reverse().map((id) => byId.get(id));
    dragId = null;
    drawItems(pageIndex(p.id));
  });
}

// ------------------------------------------------------------------ rulers --
let rulerRaf = 0, rulerMouse = null;
function drawRulersSoon(mouse) { if (mouse !== undefined) rulerMouse = mouse; cancelAnimationFrame(rulerRaf); rulerRaf = requestAnimationFrame(drawRulers); }
function drawRulers() {
  const stage = $('#peStage');
  if (!stage || !stage.classList.contains('rulers') || $('#peApp').hidden) return;
  const p = S.pages[S.current];
  const pageEl = p && $(`.pe-page[data-id="${p.id}"]`);
  const [vw, vh] = p ? viewSize(p) : [0, 0];
  const pr = pageEl ? pageEl.getBoundingClientRect() : null;
  const perUnit = S.zoom / UNITS[UNIT]; // screen px per unit
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const step = steps.find((v) => v * perUnit >= 56) || 5000;
  const sub = step * perUnit / 10 >= 5 ? 10 : step * perUnit / 5 >= 5 ? 5 : 2;
  const dpr = DPR();
  [['x', $('#peRulerX')], ['y', $('#peRulerY')]].forEach(([axis, cv]) => {
    const r = cv.getBoundingClientRect();
    const len = axis === 'x' ? r.width : r.height, thick = axis === 'x' ? r.height : r.width;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#F4F5F7'; ctx.fillRect(0, 0, r.width, r.height);
    if (!pr) return;
    const origin = axis === 'x' ? pr.left - r.left : pr.top - r.top;
    const extent = (axis === 'x' ? vw : vh) * S.zoom;
    ctx.fillStyle = '#FFFFFF';
    if (axis === 'x') ctx.fillRect(origin, 0, extent, thick); else ctx.fillRect(0, origin, thick, extent);
    ctx.strokeStyle = '#A3A9B3'; ctx.fillStyle = '#6B7079'; ctx.lineWidth = 1;
    ctx.font = '600 9px "Source Sans 3", system-ui, sans-serif';
    const minor = step / sub;
    const first = Math.floor(-origin / perUnit / minor) * minor;
    ctx.beginPath();
    for (let v = first, n = 0; (v * perUnit) + origin <= len && n < 5000; v += minor, n++) {
      const pos = Math.round(origin + v * perUnit) + 0.5;
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      const half = !major && sub === 10 && Math.abs((v * 2) / step - Math.round((v * 2) / step)) < 1e-6;
      const t = major ? thick : half ? thick * 0.45 : thick * 0.28;
      if (axis === 'x') { ctx.moveTo(pos, thick); ctx.lineTo(pos, thick - t); } else { ctx.moveTo(thick, pos); ctx.lineTo(thick - t, pos); }
      if (major) {
        const label = String(Math.round(v * 100) / 100);
        if (axis === 'x') ctx.fillText(label, pos + 3, 9);
        else { ctx.save(); ctx.translate(9, pos + 3); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'right'; ctx.fillText(label, 0, 0); ctx.restore(); }
      }
    }
    ctx.stroke();
    if (pr && p.guides && guidesOn()) {
      ctx.fillStyle = GUIDE_COLOR;
      (axis === 'x' ? p.guides.v : p.guides.h).forEach((g) => {
        const pos = origin + g * S.zoom;
        ctx.beginPath();
        if (axis === 'x') { ctx.moveTo(pos - 4, thick - 6); ctx.lineTo(pos + 4, thick - 6); ctx.lineTo(pos, thick); }
        else { ctx.moveTo(thick - 6, pos - 4); ctx.lineTo(thick - 6, pos + 4); ctx.lineTo(thick, pos); }
        ctx.fill();
      });
    }
    if (rulerMouse) {
      const m = axis === 'x' ? rulerMouse.x - r.left : rulerMouse.y - r.top;
      ctx.strokeStyle = '#E5322D'; ctx.beginPath();
      if (axis === 'x') { ctx.moveTo(m + 0.5, 0); ctx.lineTo(m + 0.5, thick); } else { ctx.moveTo(0, m + 0.5); ctx.lineTo(thick, m + 0.5); }
      ctx.stroke();
    }
  });
  $('.pe-ruler-corner').textContent = '';
}
function setRulers(on) {
  $('#peStage').classList.toggle('rulers', on);
  try { localStorage.setItem('pe-rulers', on ? '1' : '0'); } catch { /* storage off */ }
  drawRulersSoon();
}

// --------------------------------------------------------------- templates --
// Ready-made pages (public/editor-templates.js): ordinary objects, so everything stays editable.
let TPL = null;
function loadTemplates() {
  if (!TPL) TPL = import(new URL(ROOT.dataset.templates || 'editor-templates.js', document.baseURI).href).catch(() => ({ TEMPLATES: [], TEMPLATE_CATS: [] }));
  return TPL;
}
function templatePage(t) {
  const p = blankPage(t.size[0], t.size[1]);
  p.items = JSON.parse(JSON.stringify(t.items)).map((it) => {
    it.id = uid();
    if (it.type === 'line' || it.type === 'arrow') lineBox(it);
    return it;
  });
  return p;
}
const isEmptyDoc = () => S.pages.length === 1 && !S.pages[0].src && !S.pages[0].items.length && !S.undo.length;
function useTemplate(t, where) {
  const page = templatePage(t);
  if (where === 'start' || $('#peApp').hidden || isEmptyDoc()) {
    resetDoc([page], `${t.id}.pdf`, t.name);
    hideQuick();
    setTool('select');
    toast('Click any text to change it. Drag a line out of a ruler to line things up.');
    return;
  }
  finishEditing();
  snapshot();
  S.pages.splice(S.current + 1, 0, page);
  S.current += 1;
  rebuild(); scrollToPage(S.current);
  toast(`${t.name} added as page ${S.current + 1}.`);
}
function openTemplates() {
  const dlg = $('#peTplDlg');
  buildGallery($('[data-gallery="dialog"]'), 'dialog');
  dlg.showModal();
}
// draws a template's objects into a preview box; centred text needs its width, so it is measured here
function renderPreview(box, t) {
  const z = box.clientWidth / t.size[0];
  if (!z) return;
  box.textContent = '';
  const fake = { items: t.items };
  renderObjects(box, fake, z, false);
  const els = Array.from(box.children);
  t.items.forEach((it, i) => {
    const o = els[i];
    if (!o || it.type !== 'text' || it.ax == null) return;
    const w = o.offsetWidth / z;
    o.style.left = `${(it.align === 'center' ? it.ax - w / 2 : it.ax - w) * z}px`;
  });
}
let galleryIO = null;
async function buildGallery(host, where) {
  if (!host) return;
  const { TEMPLATES, TEMPLATE_CATS } = await loadTemplates();
  if (!TEMPLATES.length) { host.closest('.pe-tpl-panel, dialog')?.setAttribute('data-empty', ''); return; }
  if (host.dataset.built) return;
  host.dataset.built = '1';
  let cat = 'all';
  const chips = document.createElement('div');
  chips.className = 'pe-tpl-cats'; chips.setAttribute('role', 'tablist');
  chips.innerHTML = TEMPLATE_CATS.filter(([id]) => id === 'all' || TEMPLATES.some((t) => t.cat === id))
    .map(([id, name]) => `<button type="button" role="tab" data-cat="${id}" aria-selected="${id === 'all'}">${name}</button>`).join('');
  const grid = document.createElement('div');
  grid.className = 'pe-tpl-grid';
  grid.innerHTML = TEMPLATES.map((t) => `<button type="button" class="pe-tpl" data-tpl="${t.id}" data-cat="${t.cat}">
    <span class="pe-tpl-frame"><span class="pe-tpl-page ${t.size[0] > t.size[1] ? 'land' : 'port'}" style="aspect-ratio:${t.size[0]} / ${t.size[1]}"></span></span>
    <span class="pe-tpl-name">${t.name}</span></button>`).join('');
  host.append(chips, grid);
  // landing pages such as /resume-maker show their own category first
  const startCat = where === 'start' && $('#pe').dataset.startCat;
  if (startCat) requestAnimationFrame(() => { const b = $(`[data-cat="${startCat}"]`, chips); if (b) b.click(); });
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    cat = b.dataset.cat;
    $$('[data-cat]', chips).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('.pe-tpl', grid).forEach((c) => { c.hidden = cat !== 'all' && c.dataset.cat !== cat; });
    $$('.pe-tpl:not([hidden]) .pe-tpl-page', grid).forEach(paintCard);
  });
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.pe-tpl'); if (!c) return;
    const t = TEMPLATES.find((x) => x.id === c.dataset.tpl);
    if (where === 'dialog') $('#peTplDlg').close();
    useTemplate(t, where);
  });
  // previews are drawn when they scroll into view; their fonts load then, and the card is redrawn
  function paintCard(pageEl) {
    const t = TEMPLATES.find((x) => x.id === pageEl.closest('.pe-tpl').dataset.tpl);
    renderPreview(pageEl, t);
    if (pageEl.dataset.fonts) return;
    pageEl.dataset.fonts = '1';
    const fonts = [...new Set(t.items.filter((it) => it.type === 'text' && !isStd(it.font)).map((it) => `${it.font}|${it.bold ? 1 : 0}|${it.italic ? 1 : 0}`))];
    Promise.all(fonts.map((f) => { const [id, b, i] = f.split('|'); return ensureFont(id, b === '1', i === '1'); })).then(() => renderPreview(pageEl, t));
  }
  if (!galleryIO) galleryIO = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting && en.target.clientWidth) { galleryIO.unobserve(en.target); en.target._paint(en.target); } }), { rootMargin: '200px' });
  $$('.pe-tpl-page', grid).forEach((el) => { el._paint = paintCard; galleryIO.observe(el); });
}

// ------------------------------------------------------------------ guides --
// Guide lines, as in design programs: drag one out of the top ruler (horizontal line) or the
// left ruler (vertical line), drop it on a page, then draw and move objects against it; they
// snap to it. Drag a guide to move it, back onto a ruler (or double-click) to remove it.
// Guides belong to their page (view points, like objects), are undoable and never exported.
const GUIDE_COLOR = '#0EA5E9';
let gdrag = null;
const guidesOn = () => !$('#peStage').classList.contains('noguides');
function setGuidesOn(on) {
  $('#peStage').classList.toggle('noguides', !on);
  localStorageSet('pe-guides', on ? '1' : '0');
  const b = $('[data-act="guides"]'); if (b) b.setAttribute('aria-pressed', String(on));
  drawRulersSoon();
}
function renderUserGuides(el, p) {
  let box = el.querySelector('.pe-uguides');
  if (!box) { box = document.createElement('div'); box.className = 'pe-uguides'; el.append(box); }
  box.textContent = '';
  if (!p.guides) return;
  [['h', p.guides.h], ['v', p.guides.v]].forEach(([axis, list]) => list.forEach((pos, i) => {
    const g = document.createElement('div');
    g.className = `pe-ug ${axis}`; g.dataset.axis = axis; g.dataset.i = i;
    g.title = 'Drag to move. Drag onto a ruler or double-click to remove.';
    if (axis === 'h') g.style.top = `${pos * S.zoom}px`; else g.style.left = `${pos * S.zoom}px`;
    box.append(g);
  }));
}
function snapToGuides(p, pt) {
  if (!guidesOn() || !p.guides) return pt;
  const th = 6 / S.zoom;
  const near = (v, list) => list.reduce((b, g) => (Math.abs(g - v) < th && (b === null || Math.abs(g - v) < Math.abs(b - v)) ? g : b), null);
  const gx = near(pt.x, p.guides.v), gy = near(pt.y, p.guides.h);
  return { x: gx ?? pt.x, y: gy ?? pt.y };
}
// snap a guide being placed to the page edges and centre and to object edges
function snapGuide(p, axis, v) {
  const [vw, vh] = viewSize(p);
  const th = 5 / S.zoom;
  const c = axis === 'h' ? [0, vh / 2, vh] : [0, vw / 2, vw];
  p.items.forEach((o) => { if (!o.hidden) c.push(...(axis === 'h' ? [o.y, o.y + o.h / 2, o.y + o.h] : [o.x, o.x + o.w / 2, o.x + o.w])); });
  let best = v;
  for (const x of c) if (Math.abs(x - v) < th && Math.abs(x - v) < Math.abs(best - v || Infinity)) best = x;
  return round(best);
}
function pageUnder(x, y) {
  return $$('.pe-page').find((el) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }) || null;
}
function startGuideDrag(e, axis, from) {
  e.preventDefault(); e.stopPropagation();
  finishEditing();
  const stage = $('#peStage');
  const line = document.createElement('div');
  line.className = `pe-gline ${axis}`;
  const tag = document.createElement('span');
  tag.className = 'pe-gtag';
  stage.append(line, tag);
  gdrag = { axis, from, line, tag, target: e.currentTarget, id: e.pointerId };
  e.currentTarget.setPointerCapture(e.pointerId);
  if (from) $(`.pe-page[data-id="${from.page}"] .pe-ug.${axis}[data-i="${from.i}"]`)?.classList.add('moving');
  moveGuideDrag(e);
}
function moveGuideDrag(e) {
  if (!gdrag) return;
  const st = $('#peStage').getBoundingClientRect();
  const { axis, line, tag } = gdrag;
  const pageEl = pageUnder(e.clientX, e.clientY);
  let label = 'Drop on a page';
  let screen = axis === 'h' ? e.clientY : e.clientX;
  gdrag.drop = null;
  if (pageEl) {
    const p = pageById(pageEl.dataset.id);
    const r = pageEl.getBoundingClientRect();
    const v = snapGuide(p, axis, axis === 'h' ? (e.clientY - r.top) / S.zoom : (e.clientX - r.left) / S.zoom);
    screen = (axis === 'h' ? r.top : r.left) + v * S.zoom;
    gdrag.drop = { page: p, v };
    label = `${toU(v)} ${UNIT}`;
  } else if (gdrag.from) label = 'Release to remove';
  if (axis === 'h') { line.style.top = `${screen - st.top}px`; } else { line.style.left = `${screen - st.left}px`; }
  line.classList.toggle('off', !pageEl);
  tag.textContent = label;
  tag.style.left = `${e.clientX - st.left + 12}px`; tag.style.top = `${e.clientY - st.top + 14}px`;
  drawRulersSoon({ x: e.clientX, y: e.clientY });
}
function endGuideDrag() {
  if (!gdrag) return;
  const { axis, from, line, tag, drop } = gdrag;
  gdrag = null;
  line.remove(); tag.remove();
  const changed = new Set();
  if (from || drop) snapshot();
  if (from) {
    const fp = pageById(from.page);
    if (fp && fp.guides) { fp.guides[axis].splice(from.i, 1); changed.add(fp); }
  }
  if (drop) {
    if (!drop.page.guides) drop.page.guides = { h: [], v: [] };
    if (!drop.page.guides[axis].includes(drop.v)) drop.page.guides[axis].push(drop.v);
    changed.add(drop.page);
    if (!guidesOn()) setGuidesOn(true);
  }
  changed.forEach((p) => drawItems(pageIndex(p.id)));
  if (!from && drop && !localStorageGet('pe-guide-tip')) { toast('Guide added. Objects now snap to it. Drag it back onto the ruler to remove it.'); localStorageSet('pe-guide-tip', '1'); }
  drawRulersSoon();
}
function clearGuides() {
  const p = S.pages[S.current];
  const all = S.pages.filter((x) => x.guides && (x.guides.h.length || x.guides.v.length));
  if (!all.length) { toast('There are no guides yet. Drag one out of a ruler.'); return; }
  snapshot();
  all.forEach((x) => { x.guides = { h: [], v: [] }; drawItems(pageIndex(x.id)); });
  drawRulersSoon();
  toast(all.length > 1 || all[0] !== p ? 'All guides removed.' : 'Guides removed.');
}
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* storage off */ } }
function bindGuides() {
  $('#peRulerX').addEventListener('pointerdown', (e) => { if (e.button === 0) startGuideDrag(e, 'h', null); });
  $('#peRulerY').addEventListener('pointerdown', (e) => { if (e.button === 0) startGuideDrag(e, 'v', null); });
  // existing guides: capture before the page's own pointerdown (which would deselect)
  $('#peView').addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.pe-ug');
    if (!g || e.button > 0) return;
    startGuideDrag(e, g.dataset.axis, { page: g.closest('.pe-page').dataset.id, i: Number(g.dataset.i) });
  }, true);
  $('#peView').addEventListener('dblclick', (e) => {
    const g = e.target.closest('.pe-ug');
    if (!g) return;
    const p = pageById(g.closest('.pe-page').dataset.id);
    snapshot(); p.guides[g.dataset.axis].splice(Number(g.dataset.i), 1); drawItems(pageIndex(p.id)); drawRulersSoon();
  });
  for (const el of [$('#peRulerX'), $('#peRulerY'), $('#peView')]) {
    el.addEventListener('pointermove', moveGuideDrag);
    el.addEventListener('pointerup', endGuideDrag);
    el.addEventListener('pointercancel', endGuideDrag);
  }
  setGuidesOn(localStorageGet('pe-guides') !== '0');
}

// ------------------------------------------------------------ context menu --
function openCtx(e) {
  const pageEl = e.target.closest('.pe-page');
  if (!pageEl) return;
  e.preventDefault();
  finishEditing();
  const p = pageById(pageEl.dataset.id);
  setCurrent(pageIndex(p.id));
  const objEl = e.target.closest('.pe-obj[data-id]');
  if (objEl) { if (S.tool !== 'select') setTool('select'); select(p.id, objEl.dataset.id); } else select(null, null);
  const it = itemOf(S.sel);
  const m = $('#peCtx');
  $$('[data-ctx]', m).forEach((b) => { b.disabled = b.dataset.ctx === 'paste' ? !clip : !it; });
  const lock = $('[data-ctx="lock"]', m); lock.firstChild.textContent = it && it.locked ? 'Unlock' : 'Lock';
  const cellEl = e.target.closest('.pe-cell');
  if (it && it.type === 'table' && cellEl) { S.cell = { id: it.id, r: Number(cellEl.dataset.r), c: Number(cellEl.dataset.c) }; drawItems(pageIndex(p.id)); }
  $$('.pe-ctx-table', m).forEach((x) => { x.hidden = !(it && it.type === 'table'); });
  $$('.pe-ctx-image', m).forEach((x) => { x.hidden = !(it && it.type === 'image'); });
  $('[data-ctx="delete"]', m).firstChild.textContent = it && it.type === 'table' ? 'Delete table' : 'Delete';
  m.hidden = false;
  m.style.left = `${clamp(e.clientX, 8, window.innerWidth - m.offsetWidth - 8)}px`;
  m.style.top = `${clamp(e.clientY, 8, window.innerHeight - m.offsetHeight - 8)}px`;
}
const closeCtx = () => { const m = $('#peCtx'); if (m) m.hidden = true; };
function ctxAction(a) {
  closeCtx();
  if (a === 'cut') copySel(true);
  else if (a === 'copy') copySel(false);
  else if (a === 'paste') pasteClip();
  else if (a === 'dup') duplicateSelected();
  else if (a === 'delete') removeSelected();
  else if (a === 'lock') toggleFlag(S.sel, 'locked');
  else if (a === 'hide') toggleFlag(S.sel, 'hidden');
  else if (a.startsWith('t-')) tableOp(a.slice(2));
  else if (a === 'intoshape') imageIntoShape();
  else if (a.startsWith('shape-')) setImageShape(a.slice(6));
  else arrange(a);
}

// -------------------------------------------------------------------- pages --
function buildThumbs() {
  const list = $('#peThumbs');
  list.textContent = '';
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { paintThumb(e.target); io.unobserve(e.target); } }), { root: list, rootMargin: '300px 0px' });
  S.pages.forEach((p, i) => {
    const [w, h] = viewSize(p);
    const tw = list.clientWidth ? Math.min(150, list.clientWidth - 30) : 150;
    const li = document.createElement('li');
    li.className = 'pe-thumb'; li.dataset.id = p.id; li.draggable = true; li.tabIndex = 0;
    li.setAttribute('aria-label', `Page ${i + 1}`);
    li.innerHTML = `<div class="pe-thumb-frame" style="width:${tw}px;height:${(tw * h) / w}px"><canvas></canvas>
      <div class="pe-thumb-tools">
        <button type="button" data-pg="rotl" title="Rotate left" aria-label="Rotate page ${i + 1} left"><svg viewBox="0 0 24 24"><path d="M4 4v6h6"/><path d="M5 15a8 8 0 1 0 2-8.5L4 10"/></svg></button>
        <button type="button" data-pg="rotr" title="Rotate right" aria-label="Rotate page ${i + 1} right"><svg viewBox="0 0 24 24"><path d="M20 4v6h-6"/><path d="M19 15a8 8 0 1 1-2-8.5L20 10"/></svg></button>
        <button type="button" data-pg="up" title="Move up" aria-label="Move page ${i + 1} up"><svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6"/></svg></button>
        <button type="button" data-pg="down" title="Move down" aria-label="Move page ${i + 1} down"><svg viewBox="0 0 24 24"><path d="M6 10l6 6 6-6"/></svg></button>
        <button type="button" data-pg="dup" title="Duplicate page" aria-label="Duplicate page ${i + 1}"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>
        <button type="button" data-pg="del" class="pe-danger" title="Delete page" aria-label="Delete page ${i + 1}"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </div></div>`;
    list.append(li);
    io.observe(li);
    drawThumbItems(p);
  });
  $('#pePageCount').textContent = `${S.pages.length} page${S.pages.length === 1 ? '' : 's'}`;
  if (window.matchMedia('(max-width:860px)').matches) $('.pe-body').classList.remove('show-pages');
  markCurrent();
}
async function paintThumb(li) {
  const p = pageById(li.dataset.id);
  if (!p || !p.src) return;
  const canvas = li.querySelector('canvas');
  const page = await S.docs.get(p.src.doc).proxy.getPage(p.src.index + 1);
  const frame = li.querySelector('.pe-thumb-frame');
  const base = page.getViewport({ scale: 1, rotation: rotOf(p) });
  const vp = page.getViewport({ scale: (frame.clientWidth * DPR()) / base.width, rotation: rotOf(p) });
  canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
  try { await page.render({ canvas, viewport: vp }).promise; } catch { /* page removed meanwhile */ }
}
function markCurrent() {
  const id = S.pages[S.current] && S.pages[S.current].id;
  $$('.pe-thumb').forEach((t) => t.classList.toggle('current', t.dataset.id === id));
  $$('.pe-page').forEach((t) => t.classList.toggle('current', t.dataset.id === id && S.pages.length > 1));
}
function setCurrent(i) { if (i !== S.current && i >= 0) { S.current = i; markCurrent(); if (!S.sel) renderLayers(); drawRulersSoon(); } }
function scrollToPage(i) {
  const el = $(`.pe-page[data-id="${S.pages[i].id}"]`);
  if (el) $('#peView').scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
  setCurrent(i);
}

// Rotating a page turns the positions of its objects with it (text and images stay upright).
function rotatePage(p, dir) {
  const [vw, vh] = viewSize(p);
  const tp = dir > 0 ? (x, y) => [vh - y, x] : (x, y) => [y, vw - x];
  p.items.forEach((it) => {
    if (it.type === 'line' || it.type === 'arrow') {
      [it.x1, it.y1] = tp(it.x1, it.y1); [it.x2, it.y2] = tp(it.x2, it.y2); lineBox(it); return;
    }
    if (it.type === 'pen') {
      const abs = it.pts.map(([x, y]) => tp(it.x + (x * it.w) / it.w0, it.y + (y * it.h) / it.h0));
      const xs = abs.map((q) => q[0]), ys = abs.map((q) => q[1]);
      it.x = Math.min(...xs); it.y = Math.min(...ys);
      it.w = it.w0 = Math.max(1, Math.max(...xs) - it.x); it.h = it.h0 = Math.max(1, Math.max(...ys) - it.y);
      it.pts = abs.map(([x, y]) => [round(x - it.x), round(y - it.y)]);
      return;
    }
    const [cx, cy] = tp(it.x + it.w / 2, it.y + it.h / 2);
    if (it.type === 'highlight' || it.type === 'whiteout' || it.type === 'rect' || it.type === 'ellipse') [it.w, it.h] = [it.h, it.w];
    it.x = cx - it.w / 2; it.y = cy - it.h / 2;
  });
  p.items.forEach((it) => { delete it.ax; });
  if (p.guides) {
    // a horizontal guide becomes vertical and the other way round
    const { v, h } = p.guides;
    p.guides = dir > 0 ? { v: h.map((y) => round(vh - y)), h: v.slice() } : { v: h.slice(), h: v.map((x) => round(vw - x)) };
  }
  p.rot = (p.rot + (dir > 0 ? 90 : 270)) % 360;
}

function pageAction(act, id) {
  const i = pageIndex(id);
  const p = S.pages[i];
  if (!p) return;
  finishEditing();
  if (act === 'del') {
    if (S.pages.length === 1) { toast('A PDF needs at least one page.'); return; }
    snapshot(); S.pages.splice(i, 1); S.current = clamp(S.current, 0, S.pages.length - 1);
  } else if (act === 'rotl' || act === 'rotr') { snapshot(); rotatePage(p, act === 'rotr' ? 1 : -1); S.current = i; }
  else if (act === 'up' || act === 'down') {
    const j = act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= S.pages.length) return;
    snapshot(); [S.pages[i], S.pages[j]] = [S.pages[j], S.pages[i]]; S.current = j;
  } else if (act === 'dup') {
    snapshot();
    const c = JSON.parse(JSON.stringify(p)); c.id = uid(); c.items.forEach((it) => { it.id = uid(); });
    S.pages.splice(i + 1, 0, c); S.current = i + 1;
  }
  S.sel = null;
  rebuild();
  if (act !== 'del') scrollToPage(S.current);
}

function addBlankPage() {
  finishEditing();
  const ref = S.pages[S.current] || S.pages[0];
  const [w, h] = ref ? viewSize(ref) : SIZES.a4;
  snapshot();
  S.pages.splice(S.current + 1, 0, blankPage(w, h));
  S.current += 1;
  rebuild(); scrollToPage(S.current);
}

async function addImagePages(files) {
  const list = Array.from(files).filter(isImage);
  if (!list.length) return;
  busy(true, 'Adding pages…');
  try {
    snapshot();
    let at = S.current + 1;
    for (const f of list) {
      const a = await addAsset(f);
      const land = a.w > a.h;
      const [pw, ph] = land ? [SIZES.a4[1], SIZES.a4[0]] : SIZES.a4;
      const m = 24, s = Math.min((pw - m * 2) / a.w, (ph - m * 2) / a.h);
      const w = a.w * s, h = a.h * s;
      const pg = blankPage(pw, ph);
      pg.items.push({ id: uid(), type: 'image', asset: a.id, opacity: 100, x: (pw - w) / 2, y: (ph - h) / 2, w, h });
      S.pages.splice(at, 0, pg); at += 1;
    }
    S.current = at - 1;
    rebuild(); scrollToPage(S.current);
  } catch (e) { toast(e.message, true); } finally { busy(false); }
}

async function mergePdf(file) {
  if (!isPdf(file)) { toast('Please choose a PDF file.', true); return; }
  busy(true, 'Adding pages…');
  try {
    const pages = await addPdf(await readFile(file));
    snapshot();
    S.pages.push(...pages);
    rebuild(); scrollToPage(S.pages.length - pages.length);
    toast(`${pages.length} page${pages.length === 1 ? '' : 's'} added at the end.`);
  } catch (e) { toast(e.message, true); } finally { busy(false); }
}

// ------------------------------------------------------- images + signature --
async function addAsset(fileOrUrl) {
  let url = typeof fileOrUrl === 'string' ? fileOrUrl : await readDataUrl(fileOrUrl);
  const img = await loadImg(url);
  let mime = (/^data:([^;]+);/.exec(url) || [])[1] || '';
  if (mime !== 'image/png' && mime !== 'image/jpeg') {
    // pdf-lib embeds PNG and JPEG; other formats are redrawn as PNG
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    url = c.toDataURL('image/png'); mime = 'image/png';
  }
  const a = { id: uid(), url, mime, w: img.naturalWidth, h: img.naturalHeight };
  S.assets.set(a.id, a);
  return a;
}
function placeAsset(a, maxW) {
  const p = S.pages[S.current];
  const [vw, vh] = viewSize(p);
  const view = $('#peView');
  const pageEl = $(`.pe-page[data-id="${p.id}"]`);
  // centre of the visible part of the current page
  const vr = view.getBoundingClientRect(), pr = pageEl.getBoundingClientRect();
  const cy = clamp(((Math.max(vr.top, pr.top) + Math.min(vr.bottom, pr.bottom)) / 2 - pr.top) / S.zoom, 0, vh);
  const s = Math.min(1, maxW / a.w, (vh * 0.8) / a.h);
  const w = a.w * s, h = a.h * s;
  snapshot();
  const it = { id: uid(), type: 'image', asset: a.id, opacity: 100, x: (vw - w) / 2, y: clamp(cy - h / 2, 0, vh - h), w, h };
  p.items.push(it);
  drawItems(S.current);
  setTool('select');
  select(p.id, it.id);
}
async function insertImage(file) {
  if (!isImage(file)) { toast('Please choose a PNG, JPG, WebP or GIF image.', true); return; }
  try { const a = await addAsset(file); placeAsset(a, viewSize(S.pages[S.current])[0] * 0.6); } catch (e) { toast(e.message, true); }
}

const sign = { drawing: false, strokes: [], tab: 'draw' };
function openSign() {
  finishEditing();
  const dlg = $('#peSignDlg');
  dlg.showModal();
  sizePad();
}
function sizePad() {
  const c = $('#peSignPad');
  const r = c.getBoundingClientRect();
  c.width = Math.round(r.width * DPR()); c.height = Math.round(r.height * DPR());
  redrawPad();
}
function redrawPad() {
  const c = $('#peSignPad'), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = $('#peSignColor').value; ctx.lineWidth = 2.6 * DPR(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  sign.strokes.forEach((s) => { ctx.beginPath(); s.forEach(([x, y], i) => (i ? ctx.lineTo(x * c.width, y * c.height) : ctx.moveTo(x * c.width, y * c.height))); ctx.stroke(); });
}
function bindSign() {
  const c = $('#peSignPad');
  const at = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  c.addEventListener('pointerdown', (e) => { sign.drawing = true; c.setPointerCapture(e.pointerId); sign.strokes.push([at(e)]); redrawPad(); });
  c.addEventListener('pointermove', (e) => { if (sign.drawing) { sign.strokes[sign.strokes.length - 1].push(at(e)); redrawPad(); } });
  c.addEventListener('pointerup', () => { sign.drawing = false; });
  $('#peSignClear').addEventListener('click', () => { sign.strokes = []; redrawPad(); });
  $('#peSignColor').addEventListener('input', () => { redrawPad(); $('#peSignPreview').style.color = $('#peSignColor').value; });
  $('#peSignText').addEventListener('input', () => { $('#peSignPreview').textContent = $('#peSignText').value || 'Your Name'; });
  $$('.pe-tab').forEach((t) => t.addEventListener('click', () => {
    sign.tab = t.dataset.tab;
    $$('.pe-tab').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    $$('.pe-tabpanel').forEach((p) => { p.hidden = p.dataset.panel !== sign.tab; });
    if (sign.tab === 'draw') sizePad(); else $('#peSignText').focus();
  }));
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $('#peSignOk').addEventListener('click', async () => {
    const url = sign.tab === 'draw' ? drawnSignature() : typedSignature();
    if (!url) { toast(sign.tab === 'draw' ? 'Draw your signature first.' : 'Type your name first.'); return; }
    $('#peSignDlg').close();
    const a = await addAsset(url);
    placeAsset(a, 170);
  });
}
// Crops the drawn strokes to their own size.
function drawnSignature() {
  if (!sign.strokes.length) return null;
  const c = $('#peSignPad');
  const pts = sign.strokes.flat();
  const xs = pts.map((q) => q[0] * c.width), ys = pts.map((q) => q[1] * c.height);
  const pad = 6 * DPR();
  const x = Math.max(0, Math.min(...xs) - pad), y = Math.max(0, Math.min(...ys) - pad);
  const w = Math.min(c.width, Math.max(...xs) + pad) - x, h = Math.min(c.height, Math.max(...ys) + pad) - y;
  const out = document.createElement('canvas'); out.width = Math.max(1, w); out.height = Math.max(1, h);
  out.getContext('2d').drawImage(c, x, y, w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}
function typedSignature() {
  const text = $('#peSignText').value.trim();
  if (!text) return null;
  const font = 'italic 96px "Segoe Script","Brush Script MT","Apple Chancery",cursive';
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const w = Math.ceil(m.measureText(text).width) + 40;
  const c = document.createElement('canvas'); c.width = w; c.height = 150;
  const ctx = c.getContext('2d'); ctx.font = font; ctx.fillStyle = $('#peSignColor').value; ctx.textBaseline = 'middle';
  ctx.fillText(text, 20, 78);
  return c.toDataURL('image/png');
}

// ------------------------------------------------------------------ export --
const STD = {
  helv: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'],
  times: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'],
  courier: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'],
};
// Maps view points (origin bottom-left of the displayed page, y up) to the page's own space.
function pageMatrix(p, atOrigin = false) {
  const [x0, y0, W, H] = atOrigin ? [0, 0, p.box[2], p.box[3]] : p.box;
  switch (rotOf(p)) {
    case 90: return [0, 1, -1, 0, x0 + W, y0];
    case 180: return [-1, 0, 0, -1, x0 + W, y0 + H];
    case 270: return [0, -1, 1, 0, x0, y0 + H];
    default: return [1, 0, 0, 1, x0, y0];
  }
}

// fontkit (for embedding TrueType fonts and shaping Urdu/Arabic) is only loaded when needed
let fontkitLoad = null;
function loadFontkit() {
  if (window.fontkit) return Promise.resolve(window.fontkit);
  if (!fontkitLoad) {
    fontkitLoad = new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = `${VENDOR}fontkit.umd.min.js`;
      sc.onload = () => res(window.fontkit);
      sc.onerror = () => { fontkitLoad = null; rej(new Error('The font tool did not load. Check your connection.')); };
      document.head.append(sc);
    });
  }
  return fontkitLoad;
}
const fontFiles = new Map();
function fontFile(id, v) {
  const key = `${id}:${v}`;
  if (!fontFiles.has(key)) {
    fontFiles.set(key, fetch(`${FONTS_BASE}${id}/${v}.ttf`).then((r) => {
      if (!r.ok) throw new Error(`The font ${fontInfo(id).name} could not be downloaded.`);
      return r.arrayBuffer();
    }).then((b) => new Uint8Array(b)).catch((e) => { fontFiles.delete(key); throw e; }));
  }
  return fontFiles.get(key);
}
// Whether pdf-lib can write this font unsubsetted (tried once in a scratch document).
const wholeOk = new Map();
function embedsWhole(key, fk, bytes) {
  if (!wholeOk.has(key)) {
    wholeOk.set(key, (async () => {
      const d = await PDFLib().PDFDocument.create();
      d.registerFontkit(fk);
      const f = await d.embedFont(bytes, { subset: false });
      d.addPage([50, 50]).drawText('Ag', { font: f, size: 10 });
      await d.save();
      return true;
    })().catch(() => false));
  }
  return wholeOk.get(key);
}
const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

async function buildPdf(opts = {}) {
  const L = PDFLib();
  const { PDFDocument, StandardFonts, rgb, degrees, pushGraphicsState, popGraphicsState, concatTransformationMatrix, BlendMode, LineCapStyle, moveTo, lineTo, appendBezierCurve, closePath, clip, endPath } = L;
  // a clipping path for an image in a shape, in PDF points (y up)
  const K = 0.5523; // bezier handle length for quarter circles
  const shapePath = (x, y, w, h, kind, r) => {
    if (kind === 'ellipse') {
      const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
      return [moveTo(cx + rx, cy), appendBezierCurve(cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry), appendBezierCurve(cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy),
        appendBezierCurve(cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry), appendBezierCurve(cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy), closePath()];
    }
    const q = kind === 'rounded' ? Math.max(0, Math.min(r || 0, w / 2, h / 2)) : 0, k = q * (1 - K);
    return [moveTo(x + q, y), lineTo(x + w - q, y), appendBezierCurve(x + w - k, y, x + w, y + k, x + w, y + q), lineTo(x + w, y + h - q),
      appendBezierCurve(x + w, y + h - k, x + w - k, y + h, x + w - q, y + h), lineTo(x + q, y + h), appendBezierCurve(x + k, y + h, x, y + h - k, x, y + h - q),
      lineTo(x, y + q), appendBezierCurve(x, y + k, x + k, y, x + q, y), closePath()];
  };
  // text placement needs each font's metrics: make sure they are known
  await Promise.all(S.pages.flatMap((p) => p.items.filter((it) => it.type === 'text' && !it.hidden).map((it) => ensureFont(it.font, it.bold, it.italic))));
  const out = await PDFDocument.create();
  const sources = new Map();
  const fonts = new Map();
  const images = new Map();
  let replaced = 0, fkReady = false;
  const font = async (f, bold, italic) => {
    if (isStd(f) || !FONTS_BASE || !FONT_BY_ID.has(f)) {
      const name = STD[isStd(f) ? f : 'helv'][(bold ? 1 : 0) + (italic ? 2 : 0)];
      if (!fonts.has(name)) {
        const ft = await out.embedFont(StandardFonts[name]);
        fonts.set(name, { ft, chars: new Set(ft.getCharacterSet()) });
      }
      return fonts.get(name);
    }
    const key = `${f}:${variantOf(bold, italic)}`;
    if (!fonts.has(key)) {
      const fk = await loadFontkit();
      if (!fkReady) { out.registerFontkit(fk); fkReady = true; }
      const bytes = await fontFile(f, variantOf(bold, italic));
      // whole font: subsetting drops glyphs of fonts with ligatures and alternates (Lobster, scripts).
      // A few fonts (Bebas Neue, Dancing Script) break the writer when embedded whole: subset those.
      const ft = await out.embedFont(bytes, { subset: !(await embedsWhole(key, fk, bytes)) });
      fonts.set(key, { ft, chars: new Set(ft.getCharacterSet()), fk: fk.create(bytes) });
    }
    return fonts.get(key);
  };
  const clean = (fo, s) => Array.from(s).map((ch) => { if (fo.chars.has(ch.codePointAt(0))) return ch; replaced++; return '?'; }).join('');
  const color = (hex) => rgb(...hexToRgb(hex));
  // One line of text: its width and how to draw it. Urdu, Arabic and Hebrew are shaped by fontkit
  // and drawn as outlines, because the PDF writer cannot join their letters itself.
  const textLine = async (page, fo, line, size) => {
    if (RTL_RE.test(line) && FONTS_BASE) {
      const covers = (f) => f.fk && Array.from(line).every((ch) => /\s/.test(ch) || f.fk.hasGlyphForCodePoint(ch.codePointAt(0)));
      const f2 = covers(fo) ? fo : await font(/[֐-׿]/.test(line) ? 'noto-sans-hebrew' : 'noto-naskh-arabic', false, false);
      const run = f2.fk.layout(line);
      const sc = size / f2.fk.unitsPerEm;
      let cx = 0, d = '';
      run.glyphs.forEach((g, i) => {
        const pos = run.positions[i];
        d += g.path.scale(sc, -sc).translate(cx + pos.xOffset * sc, -pos.yOffset * sc).toSVG();
        cx += pos.xAdvance * sc;
      });
      return { width: cx, draw: (x, y, col, op) => { if (d) page.drawSvgPath(d, { x, y, color: col, opacity: op }); } };
    }
    const t = clean(fo, line);
    return { width: fo.ft.widthOfTextAtSize(t, size), draw: (x, y, col, op) => page.drawText(t, { x, y, size, font: fo.ft, color: col, opacity: op }) };
  };
  const roundRect = (w, h, r, inset) => {
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    return `M${x0 + r} ${y0} L${x1 - r} ${y0} A${r} ${r} 0 0 1 ${x1} ${y0 + r} L${x1} ${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} L${x0 + r} ${y1} A${r} ${r} 0 0 1 ${x0} ${y1 - r} L${x0} ${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`;
  };
  const total = S.pages.length;

  for (let n = 0; n < total; n++) {
    const p = S.pages[n];
    let page;
    const raster = p.src && S.docs.get(p.src.doc).raster;
    if (raster) {
      // the page as a 200 dpi picture, unrotated, filling a page of the same size
      const src = await S.docs.get(p.src.doc).proxy.getPage(p.src.index + 1);
      const vp = src.getViewport({ scale: 200 / 72, rotation: 0 });
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      await src.render({ canvas: c, viewport: vp, background: '#ffffff' }).promise;
      const jpg = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
      const img = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
      page = out.addPage([p.box[2], p.box[3]]);
      page.drawImage(img, { x: 0, y: 0, width: p.box[2], height: p.box[3] });
    } else if (p.src) {
      if (!sources.has(p.src.doc)) sources.set(p.src.doc, await PDFDocument.load(S.docs.get(p.src.doc).bytes, { updateMetadata: false }));
      [page] = await out.copyPages(sources.get(p.src.doc), [p.src.index]);
      out.addPage(page);
    } else {
      page = out.addPage([p.box[2], p.box[3]]);
    }
    page.setRotation(degrees(rotOf(p)));
    const [VW, VH] = viewSize(p);
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...pageMatrix(p, raster)));

    for (const it of p.items) {
      if (it.hidden) continue;
      const op = (it.opacity ?? 100) / 100;
      const dash = dashArray(it, it.width || 1);
      const cap = it.dash === 'dashed' ? LineCapStyle.Butt : LineCapStyle.Round;
      // rotation turns the object about its centre (clockwise on screen, so negative here)
      if (it.rot && !isLine(it)) {
        const th = (-it.rot * Math.PI) / 180, c = Math.cos(th), sn = Math.sin(th);
        const cx = it.x + it.w / 2, cy = VH - (it.y + it.h / 2);
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(c, sn, -sn, c, cx - c * cx + sn * cy, cy - sn * cx - c * cy));
      }
      if (it.type === 'text') {
        const fo = await font(it.font, it.bold, it.italic);
        const lines = it.text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i]) continue;
          const ln = await textLine(page, fo, lines[i], it.size);
          const x = it.x + (it.align === 'center' ? (it.w - ln.width) / 2 : it.align === 'right' ? it.w - ln.width : 0);
          const y = VH - (it.y + baselineOffset(it.font, it.size) + i * LINE * it.size);
          ln.draw(x, y, color(it.color), op);
          if (it.underline) page.drawLine({ start: { x, y: y - it.size * 0.12 }, end: { x: x + ln.width, y: y - it.size * 0.12 }, thickness: Math.max(0.5, it.size / 16), color: color(it.color), opacity: op });
        }
      } else if (it.type === 'table') {
        const xs = colXs(it), ys = rowYs(it);
        for (let r = 0; r < it.rows; r++) {
          const fill = rowFill(it, r);
          if (fill) page.drawRectangle({ x: it.x, y: VH - it.y - ys[r + 1], width: it.w, height: it.rh[r], color: color(fill), opacity: op });
        }
        for (let r = 0; r < it.rows; r++) for (let c = 0; c < it.cols; c++) {
          const txt = it.cells[r][c];
          if (!txt) continue;
          const head = isHeadRow(it, r);
          const fo = await font(it.font, head, false);
          const maxW = xs[c + 1] - xs[c] - TPAD.x * 2;
          const lines = [];
          for (const para of txt.split('\n')) lines.push(...await wrapText(page, fo, para, it.size, maxW, textLine));
          const top = ys[r] + (it.rh[r] - lines.length * LINE * it.size) / 2;
          const a = it.align[c] || 'left';
          for (let i = 0; i < lines.length; i++) {
            if (!lines[i]) continue;
            const ln = await textLine(page, fo, lines[i], it.size);
            const x = it.x + xs[c] + TPAD.x + (a === 'center' ? (maxW - ln.width) / 2 : a === 'right' ? maxW - ln.width : 0);
            ln.draw(x, VH - (it.y + top + baselineOffset(it.font, it.size) + i * LINE * it.size), color(head ? it.headColor : it.color), op);
          }
        }
        tableLines(it).forEach(([ax, ay, bx, by]) => page.drawLine({ start: { x: it.x + ax, y: VH - it.y - ay }, end: { x: it.x + bx, y: VH - it.y - by }, thickness: it.bw, color: color(it.border), opacity: op, lineCap: LineCapStyle.Projecting }));
      } else if (it.type === 'whiteout') {
        page.drawRectangle({ x: it.x, y: VH - it.y - it.h, width: it.w, height: it.h, color: color(it.color), opacity: op });
      } else if (it.type === 'highlight') {
        page.drawRectangle({ x: it.x, y: VH - it.y - it.h, width: it.w, height: it.h, color: color(it.color), opacity: 0.45 * op, blendMode: BlendMode.Multiply });
      } else if (it.type === 'rect') {
        const bw = it.width;
        const fill = it.fillOn ? { color: color(it.fill), opacity: op } : {};
        if (it.radius > 0) {
          page.drawSvgPath(roundRect(it.w, it.h, it.radius, bw / 2), { x: it.x, y: VH - it.y, borderColor: color(it.color), borderWidth: bw, borderOpacity: op, ...(dash ? { borderDashArray: dash } : {}), borderLineCap: cap, ...fill });
        } else {
          page.drawRectangle({ x: it.x + bw / 2, y: VH - it.y - it.h + bw / 2, width: Math.max(0, it.w - bw), height: Math.max(0, it.h - bw),
            borderColor: color(it.color), borderWidth: bw, borderOpacity: op, ...(dash ? { borderDashArray: dash } : {}), borderLineCap: cap, ...fill });
        }
      } else if (it.type === 'ellipse') {
        page.drawEllipse({ x: it.x + it.w / 2, y: VH - it.y - it.h / 2, xScale: Math.max(0, it.w / 2 - it.width / 2), yScale: Math.max(0, it.h / 2 - it.width / 2),
          borderColor: color(it.color), borderWidth: it.width, borderOpacity: op, ...(dash ? { borderDashArray: dash } : {}), borderLineCap: cap, ...(it.fillOn ? { color: color(it.fill), opacity: op } : {}) });
      } else if (it.type === 'line' || it.type === 'arrow') {
        const seg = (ax, ay, bx, by, dsh) => page.drawLine({ start: { x: ax, y: VH - ay }, end: { x: bx, y: VH - by }, thickness: it.width, color: color(it.color), opacity: op, lineCap: dsh ? cap : LineCapStyle.Round, ...(dsh ? { dashArray: dsh } : {}) });
        seg(it.x1, it.y1, it.x2, it.y2, dash);
        if (it.type === 'arrow') arrowHead(it).forEach(([hx, hy]) => seg(it.x2, it.y2, hx, hy, null));
      } else if (it.type === 'pen' || it.type === 'check' || it.type === 'cross') {
        let d;
        if (it.type === 'pen') {
          const sx = it.w / it.w0, sy = it.h / it.h0;
          d = it.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${round(x * sx)} ${round(y * sy)}`).join(' ');
        } else d = PATHS[it.type].replace(/([\d.]+) ([\d.]+)/g, (_, a, b) => `${round(a * it.w)} ${round(b * it.h)}`);
        page.drawSvgPath(d, { x: it.x, y: VH - it.y, borderColor: color(it.color), borderWidth: it.width, borderOpacity: op, borderLineCap: cap, ...(dash ? { borderDashArray: dash } : {}) });
      } else if (it.type === 'image') {
        const a = S.assets.get(it.asset);
        if (a) {
          if (!images.has(a.id)) {
            const bytes = Uint8Array.from(atob(a.url.split(',')[1]), (ch) => ch.charCodeAt(0));
            images.set(a.id, a.mime === 'image/jpeg' ? await out.embedJpg(bytes) : await out.embedPng(bytes));
          }
          if (it.clip) {
            // cover the shape, cut away what sticks out, then the border on top
            const s0 = Math.max(it.w / a.w, it.h / a.h), dw = a.w * s0, dh = a.h * s0;
            const bx = it.x, by = VH - it.y - it.h;
            page.pushOperators(pushGraphicsState(), ...shapePath(bx, by, it.w, it.h, it.clip, it.r), clip(), endPath());
            page.drawImage(images.get(a.id), { x: bx + (it.w - dw) / 2, y: by + (it.h - dh) / 2, width: dw, height: dh, opacity: op });
            page.pushOperators(popGraphicsState());
            if (it.sw > 0) {
              const sw = it.sw;
              if (it.clip === 'ellipse') page.drawEllipse({ x: bx + it.w / 2, y: by + it.h / 2, xScale: Math.max(0, it.w / 2 - sw / 2), yScale: Math.max(0, it.h / 2 - sw / 2), borderColor: color(it.stroke), borderWidth: sw, borderOpacity: op });
              else if (it.clip === 'rounded' && it.r > 0) page.drawSvgPath(roundRect(it.w, it.h, it.r, sw / 2), { x: it.x, y: VH - it.y, borderColor: color(it.stroke), borderWidth: sw, borderOpacity: op });
              else page.drawRectangle({ x: bx + sw / 2, y: by + sw / 2, width: Math.max(0, it.w - sw), height: Math.max(0, it.h - sw), borderColor: color(it.stroke), borderWidth: sw, borderOpacity: op });
            }
          } else page.drawImage(images.get(a.id), { x: it.x, y: VH - it.y - it.h, width: it.w, height: it.h, opacity: op });
        }
      }
      if (it.rot && !isLine(it)) page.pushOperators(popGraphicsState());
    }

    if (opts.watermark) {
      const fo = await font('helv', true, false);
      const txt = clean(fo, opts.watermark);
      const size = Math.min(VW, VH) / Math.max(6, txt.length * 0.55);
      const tw = fo.ft.widthOfTextAtSize(txt, size);
      const a = Math.PI / 4;
      page.drawText(txt, { x: VW / 2 - (Math.cos(a) * tw) / 2 + (Math.sin(a) * size) / 3, y: VH / 2 - (Math.sin(a) * tw) / 2 - (Math.cos(a) * size) / 3,
        size, font: fo.ft, color: rgb(0.5, 0.5, 0.5), opacity: 0.18, rotate: degrees(45) });
    }
    if (opts.numbers) {
      const fo = await font('helv', false, false);
      const label = { n: `${n + 1}`, 'n/t': `${n + 1} / ${total}`, page: `Page ${n + 1} of ${total}` }[opts.numbersFmt] || `${n + 1}`;
      const size = 10, tw = fo.ft.widthOfTextAtSize(label, size), m = 28;
      const pos = opts.numbersPos || 'bc';
      const x = pos.endsWith('c') ? (VW - tw) / 2 : pos.endsWith('r') ? VW - m - tw : m;
      const y = pos.startsWith('b') ? m - size / 2 : VH - m;
      page.drawText(label, { x, y, size, font: fo.ft, color: rgb(0.3, 0.3, 0.3) });
    }
    page.pushOperators(popGraphicsState());
  }
  out.setProducer('Flipit Free PDF editor');
  out.setCreator('Flipit Free');
  return { bytes: await out.save(), replaced };
}

async function doExport() {
  finishEditing();
  const name = ($('#peFileName').value.trim() || 'edited.pdf').replace(/[\\/:*?"<>|]+/g, '_');
  const opts = {
    numbers: $('#peNumbers').checked, numbersPos: $('#peNumbersPos').value, numbersFmt: $('#peNumbersFmt').value,
    watermark: $('#peWatermark').checked ? $('#peWatermarkText').value.trim() : '',
  };
  $('#peExportDlg').close();
  busy(true, 'Saving PDF…');
  try {
    const { bytes, replaced } = await buildPdf(opts);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    S.dirty = false;
    toast(replaced ? `Downloaded. ${replaced} character${replaced === 1 ? '' : 's'} not in the standard PDF fonts became "?".` : 'Your PDF is downloading.');
    window.dispatchEvent(new CustomEvent('pe:exported', { detail: { bytes, name: a.download } }));
    if (ACCOUNTS) postJson('/api/me/event', { type: 'download' }).catch(() => {});
  } catch (e) { console.error(e); toast(`The PDF could not be saved: ${e.message}`, true); } finally { busy(false); }
}

// ----------------------------------------------------------- sign-up gate --
// With accounts on (data-accounts on <html>), downloading needs a free account. The sign-up
// box opens over the editor, and Google sign-in runs in a popup, so the PDF being edited is
// never lost.
const ACCOUNTS = document.documentElement.dataset.accounts === '1';
let me = null;
const postJson = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
async function signedIn() {
  if (me) return true;
  try { me = (await (await fetch('/api/me', { cache: 'no-store' })).json()).user; } catch { me = null; }
  return !!me;
}
async function openExport() {
  finishEditing();
  if (ACCOUNTS && !(await signedIn())) {
    setAuthMode('signup');
    $('#peAuthDlg').showModal();
    postJson('/api/me/event', { type: 'wall' }).catch(() => {});
    return;
  }
  $('#peExportNote').textContent = '';
  $('#peExportDlg').showModal();
}
function setAuthMode(mode) {
  const dlg = $('#peAuthDlg');
  dlg.dataset.mode = mode;
  dlg.querySelectorAll('[data-t-signup]').forEach((el) => { el.textContent = el.dataset[mode === 'signup' ? 'tSignup' : 'tLogin']; });
  $('#peAuthPass').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  $('#peAuthPass').placeholder = mode === 'signup' ? 'At least 8 characters' : '';
  dlg.querySelectorAll('.pe-auth-msg').forEach((m) => { m.hidden = true; });
  $('.pe-auth:not(.pe-auth-code)').hidden = false;
  $('.pe-auth-code').hidden = true;
}
function authed(user) {
  me = user;
  $('#peAuthDlg').close();
  toast(`Signed in as ${user.email}.`);
  $('#peExportNote').textContent = '';
  $('#peExportDlg').showModal();
}
function bindAuth() {
  if (!ACCOUNTS) return;
  const dlg = $('#peAuthDlg'), msg = $('.pe-auth-msg'), go = $('.pe-auth-go');
  const say = (t) => { msg.textContent = t; msg.hidden = !t; };
  if (document.documentElement.dataset.google === '1') dlg.querySelectorAll('[data-google]').forEach((el) => { el.hidden = false; });
  $('[data-auth-switch]').addEventListener('click', () => setAuthMode(dlg.dataset.mode === 'signup' ? 'login' : 'signup'));
  $('.pe-auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const signup = dlg.dataset.mode === 'signup';
    const email = $('#peAuthEmail').value.trim(), password = $('#peAuthPass').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say('Please enter a valid email address.'); $('#peAuthEmail').focus(); return; }
    if (signup ? password.length < 8 : !password) { say(signup ? 'Use at least 8 characters for your password.' : 'Please enter your password.'); $('#peAuthPass').focus(); return; }
    say(''); go.disabled = true;
    try {
      const r = await postJson(`/api/auth/${signup ? 'signup' : 'login'}`, { email, password });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.user) { $('#peAuthPass').value = ''; authed(j.user); return; }
      if (r.ok && j.verify) { $('#peAuthPass').value = ''; showCodeStep(j.email || email); return; }
      if (j.login) setAuthMode('login');
      say(j.error || 'Something went wrong. Please try again.');
    } catch { say('Network error. Check your connection and try again.'); } finally { go.disabled = false; }
  });
  // Email confirmation: the account is created once the emailed 6-digit code is entered.
  const cf = $('.pe-auth-code'), cmsg = $('.pe-auth-msg', cf), cgo = $('.pe-auth-go', cf), code = $('#peAuthCode');
  let codeEmail = '';
  const csay = (t) => { cmsg.textContent = t; cmsg.hidden = !t; };
  function showCodeStep(email) {
    codeEmail = email;
    $('[data-code-email]', cf).textContent = email;
    $('.pe-auth:not(.pe-auth-code)').hidden = true;
    cf.hidden = false; csay(''); code.value = ''; code.focus();
  }
  code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); });
  cf.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (code.value.length !== 6) { csay('Enter the 6-digit code from the email.'); code.focus(); return; }
    csay(''); cgo.disabled = true;
    try {
      const r = await postJson('/api/auth/verify', { email: codeEmail, code: code.value });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.user) { authed(j.user); return; }
      csay(j.error || 'Something went wrong. Please try again.');
    } catch { csay('Network error. Check your connection and try again.'); } finally { cgo.disabled = false; }
  });
  $('[data-code-resend]', cf).addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const r = await postJson('/api/auth/resend', { email: codeEmail, purpose: 'signup' });
      const j = await r.json().catch(() => ({}));
      csay(r.ok ? 'A new code is on its way.' : (j.error || 'Could not send a new code.'));
    } catch { csay('Network error. Check your connection and try again.'); }
    setTimeout(() => { e.target.disabled = false; }, 30000);
  });
  $('[data-code-back]', cf).addEventListener('click', () => setAuthMode('signup'));

  $('.pe-auth-google').addEventListener('click', () => {
    const w = 480, h = 640;
    const win = window.open('/auth/google?popup=1', 'ffgoogle', `width=${w},height=${h},left=${Math.max(0, (screen.width - w) / 2)},top=${Math.max(0, (screen.height - h) / 2)}`);
    if (!win) say('Your browser blocked the Google window. Allow pop-ups for this site, or use your email.');
  });
  window.addEventListener('message', async (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'ff-auth') return;
    if (!e.data.ok) { say('Google sign-in did not work. Please try again or use your email.'); return; }
    me = null;
    if (await signedIn()) authed(me);
  });
}

// --------------------------------------------------------------------- misc --
function busy(on, msg) {
  if (on) { $('#peToast').classList.remove('err'); $('#peToast').textContent = msg; $('#peToast').hidden = false; clearTimeout(toastTimer); }
  else if ($('#peToast').textContent.endsWith('…')) $('#peToast').hidden = true;
  document.body.style.cursor = on ? 'progress' : '';
}

function setZoom(z) {
  const view = $('#peView');
  const ratio = view.scrollTop / Math.max(1, view.scrollHeight);
  S.zoom = clamp(Math.round(z * 100) / 100, 0.25, 4);
  finishEditing();
  rebuild();
  view.scrollTop = ratio * view.scrollHeight;
}

function onKey(e) {
  if ($('#peApp').hidden) return;
  const typing = S.editing || S.cellEdit || /^(input|select|textarea)$/i.test(e.target.tagName) || e.target.isContentEditable;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  const selIt = itemOf(S.sel);
  if (mod && !e.shiftKey && ['b', 'i', 'u'].includes(e.key.toLowerCase()) && selIt && selIt.type === 'text' && (S.editing === selIt.id || !typing)) {
    e.preventDefault(); toggleProp({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); return;
  }
  if (typing) return;
  if (mod && e.key.toLowerCase() === 'c') { if (copySel(false)) e.preventDefault(); return; }
  if (mod && e.key.toLowerCase() === 'x') { if (copySel(true)) e.preventDefault(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) { e.preventDefault(); arrange(e.code === 'BracketRight' ? (e.shiftKey ? 'tofront' : 'forward') : (e.shiftKey ? 'toback' : 'backward')); return; }
  if (e.key === '?') { $('#peHelpDlg').showModal(); return; }
  if (e.shiftKey && !mod && e.key.toLowerCase() === 'r') { setRulers(!$('#peStage').classList.contains('rulers')); return; }
  if (mod && e.key === ';') { e.preventDefault(); setGuidesOn(!guidesOn()); return; }
  if (e.key === 'Enter' && selIt && selIt.type === 'table') { e.preventDefault(); const c = S.cell && S.cell.id === selIt.id ? S.cell : { r: 0, c: 0 }; editCell(S.sel.page, selIt, c.r, c.c); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selIt && selIt.type === 'table' && S.cell && S.cell.id === selIt.id && selIt.rows > 1) {
    e.preventDefault(); tableOp('delrow'); toast('Row deleted. To remove the whole table, right-click it and choose Delete table.'); return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); removeSelected(); return; }
  if (e.key === 'Escape') { closeImgMenu(); closeCtx(); closeFontPicker(); select(null, null); setTool('select'); return; }
  if (S.sel && e.key.startsWith('Arrow') && !(selIt && selIt.locked)) {
    e.preventDefault();
    const it = itemOf(S.sel), st = e.shiftKey ? 10 : 1;
    snapshot();
    moveItem(it, e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0);
    drawItems(pageIndex(S.sel.page)); updatePanel();
    return;
  }
  if (mod || e.altKey) return;
  const k = { v: 'select', e: 'edittext', i: 'editimage', t: 'text', p: 'pen', h: 'highlight', w: 'whiteout', r: 'rect' }[e.key.toLowerCase()];
  if (k) setTool(k);
}

// ------------------------------------------------------ quick start + tips --
let quickOff = false;
try { quickOff = localStorage.getItem('pe-quick-off') === '1'; } catch { /* storage off */ }
const showQuick = () => { if (!quickOff) $('#peQuick').hidden = false; };
const hideQuick = () => { $('#peQuick').hidden = true; };
function quickAction(a) {
  hideQuick();
  if (a === 'sign') openSign();
  else if (a === 'image') { imagePick = null; $('#peImageInput').click(); }
  else if (a !== 'close') setTool(a);
}
const TIPS = {
  select: ['Select', 'Move, resize and rotate anything you added.', 'V'],
  edittext: ['Edit text', 'Click a line of text in the PDF and type to change it.', 'E'],
  editimage: ['Edit image', 'Click a picture in the PDF to replace, move or remove it.', 'I'],
  text: ['Add text', 'Click anywhere on the page and start typing.', 'T'],
  pen: ['Draw', 'Draw freely with the mouse or your finger.', 'P'],
  highlight: ['Highlight', 'Drag over text to mark it in colour.', 'H'],
  whiteout: ['Whiteout', 'Cover parts of the page with white.', 'W'],
  rect: ['Shapes', 'Rectangles, circles, lines, arrows, check marks and crosses.', 'R'],
  image: ['Insert image', 'Add a logo, photo or stamp from your device.', ''],
  sign: ['Sign', 'Draw or type your signature, then place it.', ''],
  undo: ['Undo', 'Take back the last change.', 'Ctrl+Z'], redo: ['Redo', 'Bring back what you undid.', 'Ctrl+Y'],
  help: ['Shortcuts', 'All keyboard shortcuts.', '?'], export: ['Download', 'Save your edited PDF.', ''],
  panel: ['Design and layers', 'Position, size, rotation and the layer list.', ''],
};
function bindTips() {
  const tip = $('#peTip');
  let timer = 0;
  const hide = () => { clearTimeout(timer); tip.hidden = true; };
  $$('.pe-head [data-tool], .pe-head [data-act]').forEach((el) => {
    const key = el.dataset.tool || el.dataset.act;
    const t = TIPS[key];
    if (!t || el.closest('.pe-pop')) return;
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', t[0]);
    el.removeAttribute('title');
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        $('#peTipTitle').textContent = t[0]; $('#peTipText').textContent = t[1]; $('#peTipKey').textContent = t[2];
        tip.hidden = false;
        const r = el.getBoundingClientRect();
        tip.style.left = `${clamp(r.left + r.width / 2 - tip.offsetWidth / 2, 8, window.innerWidth - tip.offsetWidth - 8)}px`;
        tip.style.top = `${r.bottom + 8}px`;
      }, 380);
    });
    el.addEventListener('pointerleave', hide);
    el.addEventListener('pointerdown', hide);
  });
}

function bindDrop(el, onFiles) {
  el.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); el.classList.add('is-over'); } });
  el.addEventListener('dragleave', () => el.classList.remove('is-over'));
  el.addEventListener('drop', (e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); el.classList.remove('is-over'); onFiles(e.dataTransfer.files); });
}

function init() {
  const pe = $('#pe');
  if (!pe) return;
  $('#peOpenInput').addEventListener('change', (e) => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; });
  $('#peAddPdfInput').addEventListener('change', (e) => { if (e.target.files[0]) mergePdf(e.target.files[0]); e.target.value = ''; });
  $('#peImageInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) { imagePick = null; return; }
    if (imagePick) replaceWith(f); else insertImage(f);
  });
  $$('#peImgMenu [data-img]').forEach((b) => b.addEventListener('click', () => imgAction(b.dataset.img)));
  $('#peImgPageInput').addEventListener('change', (e) => { addImagePages(e.target.files); e.target.value = ''; });
  $('#peNewBtn').addEventListener('click', createNew);
  bindDrop($('#peDrop'), (files) => openFile(files[0]));
  bindDrop($('#peView'), (files) => { const f = files[0]; if (isPdf(f)) mergePdf(f); else if (isImage(f)) insertImage(f); });

  $$('[data-tool]').forEach((b) => b.addEventListener('click', (e) => {
    const more = b.closest('.pe-more');
    if (more && b.parentElement === more) {
      e.stopPropagation();
      const open = !more.classList.contains('open');
      more.classList.toggle('open', open);
      if (open) { const r = b.getBoundingClientRect(); const sub = $('.pe-sub', more); sub.style.left = `${Math.min(r.left, window.innerWidth - 260)}px`; sub.style.top = `${r.bottom + 4}px`; }
      return;
    }
    if (more) more.classList.remove('open');
    setTool(b.dataset.tool);
  }));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.pe-more')) $$('.pe-more.open').forEach((m) => m.classList.remove('open'));
    if (!e.target.closest('.pe-menu')) $$('.pe-menu.open').forEach((m) => m.classList.remove('open'));
    if (!e.target.closest('#peImgMenu') && !e.target.closest('.pe-page')) closeImgMenu();
    if (!e.target.closest('#peCtx')) closeCtx();
    if (!e.target.closest('#peFontPop') && !e.target.closest('#pFontBtn')) closeFontPicker();
  });
  $$('.pe-menu .pe-pop button').forEach((b) => b.addEventListener('click', () => b.closest('.pe-menu').classList.remove('open')));

  const acts = {
    new: () => { if (!S.dirty || window.confirm('Start a new PDF? Changes you have not downloaded will be lost.')) { $('#peApp').hidden = true; $('#peStart').hidden = false; document.body.classList.remove('is-editing'); $('#pe').classList.remove('editing'); } },
    open: () => $('#peOpenInput').click(),
    addpdf: () => $('#peAddPdfInput').click(),
    image: () => { imagePick = null; $('#peImageInput').click(); },
    replaceimg: () => { if (itemOf(S.sel)) { imagePick = { mode: 'item', sel: { ...S.sel } }; $('#peImageInput').click(); } },
    filemenu: () => $('#peFileMenu').classList.toggle('open'),
    pages: () => $('.pe-body').classList.toggle(window.matchMedia('(max-width:860px)').matches ? 'show-pages' : 'no-pages'),
    imgpage: () => $('#peImgPageInput').click(),
    sign: openSign,
    undo, redo,
    zoomin: () => setZoom(S.zoom * 1.2), zoomout: () => setZoom(S.zoom / 1.2), zoomfit: () => setZoom(fitZoom()),
    addpage: addBlankPage,
    delete: removeSelected, dup: duplicateSelected, front: frontSelected,
    tofront: () => arrange('tofront'), forward: () => arrange('forward'), backward: () => arrange('backward'), toback: () => arrange('toback'),
    lock: () => toggleFlag(S.sel, 'locked'), rotl: () => rotateSel(-90), rotr: () => rotateSel(90),
    help: () => $('#peHelpDlg').showModal(),
    templates: openTemplates,
    tablepick: toggleTablePicker,
    rulers: () => setRulers(!$('#peStage').classList.contains('rulers')),
    guides: () => setGuidesOn(!guidesOn()),
    clearguides: clearGuides,
    panel: () => $('.pe-body').classList.toggle('show-right'),
    export: openExport,
  };
  $$('[data-act]').forEach((b) => b.addEventListener('click', () => { const f = acts[b.dataset.act]; if (f) f(); }));
  $('#peExportOk').addEventListener('click', doExport);
  $('#peNumbers').addEventListener('change', () => { $('#peNumbersOpts').hidden = !$('#peNumbers').checked; });
  $('#peWatermark').addEventListener('change', () => { $('#peWatermarkOpts').hidden = !$('#peWatermark').checked; });

  const view = $('#peView');
  bindGuides();
  bindTables();
  bindAuth();
  view.addEventListener('pointerdown', onPointerDown);
  view.addEventListener('pointermove', (e) => { onPointerMove(e); drawRulersSoon({ x: e.clientX, y: e.clientY }); });
  view.addEventListener('pointerleave', () => drawRulersSoon(null));
  view.addEventListener('contextmenu', openCtx);
  // Ctrl + mouse wheel (or a trackpad pinch) zooms
  let wheelZoom = 0, wheelT = 0;
  view.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    wheelZoom = (wheelZoom || S.zoom) * Math.exp(-e.deltaY * 0.0025);
    $('#peZoom').textContent = `${Math.round(clamp(wheelZoom, 0.25, 4) * 100)}%`;
    clearTimeout(wheelT); wheelT = setTimeout(() => { setZoom(wheelZoom); wheelZoom = 0; }, 160);
  }, { passive: false });
  $$('#peCtx [data-ctx]').forEach((b) => b.addEventListener('click', () => ctxAction(b.dataset.ctx)));
  DFIELDS.forEach((id) => {
    const el = $(`#${id}`);
    el.addEventListener('change', () => onDesignInput(id));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  });
  $$('[data-align-to]').forEach((b) => b.addEventListener('click', () => alignTo(b.dataset.alignTo)));
  const unit = $('#peUnit');
  unit.value = UNIT;
  unit.addEventListener('change', () => { UNIT = unit.value; try { localStorage.setItem('pe-unit', UNIT); } catch { /* storage off */ } updatePanel(); drawRulersSoon(); });
  // rulers start off on phones (they take space there) unless switched on before
  let rulersPref = null;
  try { rulersPref = localStorage.getItem('pe-rulers'); } catch { /* storage off */ }
  if (rulersPref === '0' || (rulersPref === null && window.matchMedia('(max-width:640px)').matches)) $('#peStage').classList.remove('rulers');
  $('#peFontSearch').addEventListener('input', renderFontList);
  $('#peFontSearch').addEventListener('keydown', fontKeys);
  bindLayers();
  bindTips();
  $$('[data-quick]').forEach((b) => b.addEventListener('click', () => quickAction(b.dataset.quick)));
  $('#peQuickOff').addEventListener('change', (e) => { quickOff = e.target.checked; try { localStorage.setItem('pe-quick-off', quickOff ? '1' : '0'); } catch { /* storage off */ } });
  $$('.pe-head [data-tool], .pe-head [data-act]').forEach((b) => b.addEventListener('click', () => { if (!b.closest('.pe-menu')) hideQuick(); }));
  view.addEventListener('pointerdown', hideQuick);
  $('#peFontList').addEventListener('mouseleave', () => { if (fontPreviewing) previewFont(null); });
  document.addEventListener('paste', (e) => {
    if ($('#peApp').hidden || S.editing || /^(input|textarea)$/i.test(e.target.tagName)) return;
    const files = Array.from(e.clipboardData.files || []);
    if (!files.some(isImage) && clip) { e.preventDefault(); pasteClip(); return; }
    pasteExternal(e);
  });
  view.addEventListener('pointerup', onPointerUp);
  view.addEventListener('pointercancel', onPointerUp);
  view.addEventListener('dblclick', (e) => {
    const o = e.target.closest('.pe-obj'), pageEl = e.target.closest('.pe-page');
    if (!o || !pageEl) return;
    const p = pageById(pageEl.dataset.id), it = p.items.find((i) => i.id === o.dataset.id);
    if (it && it.type === 'text') editText(p.id, it);
    const cell = e.target.closest('.pe-cell');
    if (it && it.type === 'table' && cell) editCell(p.id, it, Number(cell.dataset.r), Number(cell.dataset.c));
  });
  let scrollRaf = 0;
  view.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      const top = view.getBoundingClientRect().top + 80;
      const els = $$('.pe-page', view);
      let best = 0;
      els.forEach((el, i) => { if (el.getBoundingClientRect().top <= top) best = i; });
      setCurrent(best);
      closeImgMenu(); closeCtx();
      drawRulersSoon();
      if (RUNS[S.tool]) els.forEach((el) => { const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < window.innerHeight) showRuns(el); });
    });
  });

  const thumbs = $('#peThumbs');
  thumbs.addEventListener('click', (e) => {
    const li = e.target.closest('.pe-thumb');
    if (!li) return;
    const btn = e.target.closest('[data-pg]');
    if (btn) { pageAction(btn.dataset.pg, li.dataset.id); return; }
    scrollToPage(pageIndex(li.dataset.id));
  });
  thumbs.addEventListener('keydown', (e) => { const li = e.target.closest('.pe-thumb'); if (li && e.key === 'Enter' && e.target === li) scrollToPage(pageIndex(li.dataset.id)); });
  let dragId = null;
  thumbs.addEventListener('dragstart', (e) => { const li = e.target.closest('.pe-thumb'); if (li) { dragId = li.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); } });
  thumbs.addEventListener('dragover', (e) => { const li = e.target.closest('.pe-thumb'); if (dragId && li) { e.preventDefault(); $$('.drag-over', thumbs).forEach((x) => x.classList.remove('drag-over')); li.classList.add('drag-over'); } });
  thumbs.addEventListener('dragend', () => { dragId = null; $$('.drag-over', thumbs).forEach((x) => x.classList.remove('drag-over')); });
  thumbs.addEventListener('drop', (e) => {
    const li = e.target.closest('.pe-thumb');
    if (!dragId || !li || li.dataset.id === dragId) return;
    e.preventDefault();
    const from = pageIndex(dragId), to = pageIndex(li.dataset.id);
    snapshot();
    const [moved] = S.pages.splice(from, 1);
    S.pages.splice(to, 0, moved);
    S.current = to; dragId = null;
    rebuild(); scrollToPage(to);
  });

  bindProps();
  bindSign();
  document.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!$('#peApp').hidden) { buildThumbs(); drawRulersSoon(); moveToolIndicator(); } }, 200); });
  setTool('select');
  loadCatalog().then(() => {
    buildGallery($('[data-gallery="start"]'), 'start');
    // /edit-pdf?template=invoice opens that template straight away (links from the landing pages)
    const tq = new URLSearchParams(location.search).get('template');
    if (tq) loadTemplates().then(({ TEMPLATES }) => { const t = TEMPLATES.find((x) => x.id === tq); if (t) useTemplate(t, 'start'); });
  });
  lib().catch(() => {}); // start loading pdf.js while the visitor picks a file
}

init();
// Exposed for tests.
window.__pe = { S, buildPdf, pageMatrix, viewSize, baselineOffset, rotatePage, imageRuns, textRuns, select, arrange, setTool, drawItems };
