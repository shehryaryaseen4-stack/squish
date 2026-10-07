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

const SHAPES = new Set(['rect', 'ellipse', 'line', 'arrow', 'check', 'cross']);
const HINTS = {
  select: 'Click an object to select it. Drag to move, use the corners to resize.',
  edittext: 'Click on any text in the PDF to change it.',
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
  text: ['color', 'font', 'size', 'style', 'opacity'],
  pen: ['color', 'width', 'opacity'], line: ['color', 'width', 'opacity'], arrow: ['color', 'width', 'opacity'],
  check: ['color', 'width'], cross: ['color', 'width'],
  rect: ['color', 'width', 'fill', 'opacity'], ellipse: ['color', 'width', 'fill', 'opacity'],
  highlight: ['color', 'opacity'], whiteout: ['color'], image: ['opacity'],
};
const DEFAULTS = {
  text: { color: '#111827', font: 'helv', size: 14, bold: false, italic: false, opacity: 100 },
  pen: { color: '#1d3c8f', width: 2, opacity: 100 },
  line: { color: '#111827', width: 2, opacity: 100 },
  arrow: { color: '#e5322d', width: 2, opacity: 100 },
  check: { color: '#1e9e5a', width: 2.5, opacity: 100 },
  cross: { color: '#e5322d', width: 2.5, opacity: 100 },
  rect: { color: '#e5322d', width: 2, fill: '#ffffff', fillOn: false, opacity: 100 },
  ellipse: { color: '#e5322d', width: 2, fill: '#ffffff', fillOn: false, opacity: 100 },
  highlight: { color: '#ffe14d', opacity: 100 },
  whiteout: { color: '#ffffff', opacity: 100 },
  image: { opacity: 100 },
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
  S.sel = null; S.editing = null;
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
    resetDoc(pages, file.name.replace(/\.pdf$/i, '') + '-edited.pdf');
  } catch (e) { toast(e.message, true); } finally { busy(false); }
}

function createNew() {
  const [w, h] = SIZES[$('#peNewSize').value] || SIZES.a4;
  const land = $('#peNewOrient').value === 'landscape';
  resetDoc([land ? blankPage(h, w) : blankPage(w, h)], 'document.pdf');
  setTool('text');
}

function resetDoc(pages, name) {
  S.docs.forEach((d, id) => { if (!pages.some((p) => p.src && p.src.doc === id)) { d.proxy.destroy(); S.docs.delete(id); } });
  S.pages = pages; S.undo = []; S.redo = []; S.sel = null; S.editing = null; S.current = 0; S.dirty = false; S.runs.clear();
  $('#peFileName').value = name;
  $('#peStart').hidden = true; $('#peApp').hidden = false;
  document.body.classList.add('is-editing');
  $('#pe').classList.add('editing');
  S.zoom = fitZoom();
  rebuild(); updateUndo();
  $('#peView').scrollTop = 0;
}

// --------------------------------------------------------------- rendering --
let observer = null;
const renderTasks = new WeakMap();

function fitZoom() {
  const view = $('#peView');
  const avail = Math.max(240, (view.clientWidth || window.innerWidth - 220) - 48);
  const widest = Math.max(...S.pages.map((p) => viewSize(p)[0]), 1);
  return clamp(Math.floor((avail / widest) * 20) / 20, 0.25, 1.25);
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
  drawThumbItems(p);
  const el = $(`.pe-page[data-id="${p.id}"]`);
  if (!el) return;
  const layer = el.querySelector('.pe-layer');
  const keepRuns = layer.querySelector('.pe-runs');
  layer.textContent = '';
  if (keepRuns) layer.append(keepRuns);
  renderObjects(layer, p, S.zoom, true);
  if (S.sel && S.sel.page === p.id) decorateSelection();
  // Text boxes size themselves; remember the size so selection and export agree with the screen.
  p.items.forEach((it) => {
    if (it.type !== 'text') return;
    const o = layer.querySelector(`[data-id="${it.id}"]`);
    if (o) { it.w = o.offsetWidth / S.zoom; it.h = o.offsetHeight / S.zoom; }
  });
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
    const o = document.createElement('div');
    o.className = 'pe-obj'; o.dataset.id = it.id;
    o.style.left = `${it.x * z}px`; o.style.top = `${it.y * z}px`;
    o.style.opacity = (it.opacity ?? 100) / 100;
    if (it.type === 'text') {
      o.classList.add('pe-text');
      o.textContent = it.text;
      Object.assign(o.style, {
        fontFamily: FONT_CSS[it.font], fontSize: `${it.size * z}px`, color: it.color,
        fontWeight: it.bold ? '700' : '400', fontStyle: it.italic ? 'italic' : 'normal',
      });
      if (live && S.editing === it.id) startEditing(o, it, true);
    } else {
      o.style.width = `${it.w * z}px`; o.style.height = `${it.h * z}px`;
      if (it.type === 'image') {
        const a = S.assets.get(it.asset);
        const img = document.createElement('img'); img.alt = ''; img.src = a ? a.url : ''; o.append(img);
      } else if (it.type === 'whiteout') {
        o.style.background = it.color;
      } else if (it.type === 'highlight') {
        o.style.background = it.color; o.style.mixBlendMode = 'multiply';
        o.style.opacity = 0.45 * ((it.opacity ?? 100) / 100);
      } else {
        o.innerHTML = svgFor(it);
      }
    }
    layer.append(o);
  });
  S.zoom = zoomSave;
}

const PATHS = { check: 'M0.12 0.55 L0.4 0.84 L0.9 0.16', cross: 'M0.16 0.16 L0.84 0.84 M0.84 0.16 L0.16 0.84' };
function svgFor(it) {
  const z = S.zoom;
  const sw = (it.width || 2) * z;
  const stroke = `stroke="${it.color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  if (it.type === 'rect') {
    const fill = it.fillOn ? it.fill : 'none';
    return `<svg viewBox="0 0 ${it.w * z} ${it.h * z}" preserveAspectRatio="none"><rect x="${sw / 2}" y="${sw / 2}" width="${Math.max(0, it.w * z - sw)}" height="${Math.max(0, it.h * z - sw)}" fill="${fill}" ${stroke}/></svg>`;
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

function arrowHead(it) {
  const ang = Math.atan2(it.y2 - it.y1, it.x2 - it.x1);
  const len = Math.max(10, (it.width || 2) * 4.5);
  return [ang + Math.PI - 0.45, ang + Math.PI + 0.45].map((a) => [it.x2 + Math.cos(a) * len, it.y2 + Math.sin(a) * len]);
}

// --------------------------------------------------------------- selection --
function select(pageId, id) {
  finishEditing();
  S.sel = id ? { page: pageId, id } : null;
  $$('.pe-sel').forEach((e) => e.classList.remove('pe-sel'));
  $$('.pe-handle').forEach((e) => e.remove());
  if (S.sel) decorateSelection();
  updateProps();
}
function decorateSelection() {
  const it = itemOf(S.sel);
  const pageEl = $(`.pe-page[data-id="${S.sel.page}"]`);
  if (!it || !pageEl) return;
  const o = pageEl.querySelector(`.pe-obj[data-id="${it.id}"]`);
  if (!o) return;
  if (S.editing === it.id) return;
  if (it.type !== 'line' && it.type !== 'arrow') o.classList.add('pe-sel');
  const layer = pageEl.querySelector('.pe-layer');
  const z = S.zoom;
  const add = (h, x, y) => { const d = document.createElement('div'); d.className = 'pe-handle'; d.dataset.h = h; d.style.left = `${x * z}px`; d.style.top = `${y * z}px`; layer.append(d); };
  if (it.type === 'line' || it.type === 'arrow') { add('p1', it.x1, it.y1); add('p2', it.x2, it.y2); return; }
  if (it.type === 'text') return; // text size comes from the font size setting
  add('nw', it.x, it.y); add('ne', it.x + it.w, it.y); add('sw', it.x, it.y + it.h); add('se', it.x + it.w, it.y + it.h);
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
function frontSelected() {
  const it = itemOf(S.sel);
  if (!it) return;
  snapshot();
  const p = pageById(S.sel.page);
  p.items = p.items.filter((i) => i !== it).concat(it);
  drawItems(pageIndex(p.id));
}
function moveItem(it, dx, dy) {
  it.x += dx; it.y += dy;
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
async function textRuns(p) {
  const key = `${p.id}:${rotOf(p)}`;
  if (S.runs.has(key)) return S.runs.get(key);
  if (!p.src) { S.runs.set(key, []); return []; }
  const lib_ = await lib();
  const page = await S.docs.get(p.src.doc).proxy.getPage(p.src.index + 1);
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
    const family = /mono|courier/i.test(`${style.fontFamily} ${name}`) ? 'courier'
      : (/serif/i.test(style.fontFamily || '') && !/sans/i.test(style.fontFamily || '')) || /times|roman|georgia|garamond/i.test(name) ? 'times' : 'helv';
    runs.push({
      str: t.str, size, x: m[4], base: m[5], w: t.width * (vp.scale || 1), top: m[5] - size * 0.92, h: size * 1.18,
      font: family, bold: /bold|black|heavy|semibold|demi/i.test(name), italic: /italic|oblique/i.test(name),
    });
  }
  S.runs.set(key, runs);
  return runs;
}

async function showRuns(pageEl) {
  const p = pageById(pageEl.dataset.id);
  const layer = pageEl.querySelector('.pe-layer');
  if (!p || S.tool !== 'edittext' || layer.querySelector('.pe-runs')) return;
  const runs = await textRuns(p);
  if (S.tool !== 'edittext' || layer.querySelector('.pe-runs')) return;
  const box = document.createElement('div');
  box.className = 'pe-runs';
  const z = S.zoom;
  runs.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'pe-run'; d.dataset.run = i;
    Object.assign(d.style, { left: `${r.x * z}px`, top: `${r.top * z}px`, width: `${r.w * z}px`, height: `${r.h * z}px` });
    box.append(d);
  });
  layer.prepend(box);
  if (!runs.length) toast(p.src ? 'No editable text found on this page. Scanned pages contain pictures of text; use Text to type over them.' : 'This page has no text yet. Use Text to add some.');
}
function hideRuns() { $$('.pe-runs').forEach((e) => e.remove()); }

async function editRunAt(p, pt) {
  const runs = await textRuns(p);
  const run = runs.find((r) => pt.x >= r.x - 1 && pt.x <= r.x + r.w + 1 && pt.y >= r.top - 1 && pt.y <= r.top + r.h + 1);
  if (!run) { toast('Click on a line of text in the PDF to change it.'); return; }
  snapshot();
  const cover = { id: uid(), type: 'whiteout', color: '#ffffff', opacity: 100, x: run.x - 1, y: run.top - 1, w: run.w + 2, h: run.h + 2 };
  const size = Math.round(run.size * 10) / 10;
  const text = { id: uid(), type: 'text', text: run.str, font: run.font, size, bold: run.bold, italic: run.italic, color: '#000000', opacity: 100,
    x: run.x, y: run.base - baselineOffset(run.font, size), w: run.w, h: run.h };
  p.items.push(cover, text);
  drawItems(pageIndex(p.id));
  S.sel = { page: p.id, id: text.id };
  editText(p.id, text);
}

// ------------------------------------------------------------ pointer input --
let drag = null;

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

  if (handle) {
    e.preventDefault();
    const sel = itemOf(S.sel);
    drag = { kind: 'resize', h: handle.dataset.h, page: p, it: sel, start: pt, orig: JSON.parse(JSON.stringify(sel)), moved: false };
    pageEl.setPointerCapture(e.pointerId);
    return;
  }

  const tool = S.tool;
  if (tool === 'select') {
    if (!it) { select(null, null); return; }
    e.preventDefault();
    if (!(S.sel && S.sel.id === it.id)) select(p.id, it.id);
    drag = { kind: 'move', page: p, it, start: pt, last: pt, moved: false, pageEl };
    pageEl.setPointerCapture(e.pointerId);
    return;
  }
  if (tool === 'text') {
    e.preventDefault();
    if (it && it.type === 'text') { editText(p.id, it); return; }
    finishEditing();
    snapshot();
    const d = DEFAULTS.text;
    const t = { id: uid(), type: 'text', text: '', ...d, x: pt.x, y: pt.y - baselineOffset(d.font, d.size), w: 4, h: d.size * LINE };
    p.items.push(t);
    S.editing = null;
    drawItems(pageIndex(p.id));
    S.sel = { page: p.id, id: t.id };
    startEditing(pageEl.querySelector(`.pe-obj[data-id="${t.id}"]`), t);
    updateProps();
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
  drag = { kind: 'shape', tool, page: p, start: pt, end: pt, rub };
  drawRubber(drag);
}

function onPointerMove(e) {
  if (!drag) {
    if (S.tool === 'edittext') {
      const pageEl = e.target.closest('.pe-page');
      if (pageEl) {
        showRuns(pageEl);
        const pt = ptOf(e, pageEl);
        const p = pageById(pageEl.dataset.id);
        const runs = S.runs.get(`${p.id}:${rotOf(p)}`) || [];
        $$('.pe-run.hot').forEach((r) => r.classList.remove('hot'));
        const i = runs.findIndex((r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.top && pt.y <= r.top + r.h);
        if (i >= 0) { const d = pageEl.querySelector(`.pe-run[data-run="${i}"]`); if (d) d.classList.add('hot'); }
      }
    }
    return;
  }
  const pageEl = $(`.pe-page[data-id="${drag.page.id}"]`);
  const pt = ptOf(e, pageEl);
  const [vw, vh] = viewSize(drag.page);
  if (drag.kind === 'move') {
    let dx = pt.x - drag.last.x, dy = pt.y - drag.last.y;
    if (!drag.moved) { if (Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) < 2 / S.zoom) return; snapshot(); drag.moved = true; }
    const it = drag.it;
    dx = clamp(dx, -it.x - it.w + 8, vw - it.x - 8); dy = clamp(dy, -it.y - it.h + 8, vh - it.y - 8);
    moveItem(it, dx, dy);
    drag.last = { x: drag.last.x + dx, y: drag.last.y + dy };
    const o = pageEl.querySelector(`.pe-obj[data-id="${it.id}"]`);
    o.style.left = `${it.x * S.zoom}px`; o.style.top = `${it.y * S.zoom}px`;
    $$('.pe-handle', pageEl).forEach((h) => h.remove());
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
      let { x, y, w, h } = o;
      if (drag.h.includes('e')) w = o.w + dx;
      if (drag.h.includes('s')) h = o.h + dy;
      if (drag.h.includes('w')) { x = o.x + dx; w = o.w - dx; }
      if (drag.h.includes('n')) { y = o.y + dy; h = o.h - dy; }
      if ((it.type === 'image' || it.type === 'check' || it.type === 'cross') && !e.shiftKey) {
        const ratio = o.w / o.h;
        if (Math.abs(w / ratio - o.h) > Math.abs(h * ratio - o.w)) h = w / ratio; else w = h * ratio;
        if (drag.h.includes('w')) x = o.x + o.w - w;
        if (drag.h.includes('n')) y = o.y + o.h - h;
      }
      if (w < 4 || h < 4) return;
      Object.assign(it, { x, y, w, h });
    }
    drawItems(pageIndex(drag.page.id));
    return;
  }
  if (drag.kind === 'pen') {
    const last = drag.pts[drag.pts.length - 1];
    if (Math.hypot(pt.x - last[0], pt.y - last[1]) < 0.8 / S.zoom) return;
    drag.pts.push([clamp(pt.x, 0, vw), clamp(pt.y, 0, vh)]);
    drag.tmp.firstChild.setAttribute('d', drag.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x * S.zoom} ${y * S.zoom}`).join(' '));
    return;
  }
  if (drag.kind === 'shape') { drag.end = { x: clamp(pt.x, 0, vw), y: clamp(pt.y, 0, vh) }; drawRubber(drag); }
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
  if (d.kind === 'move' || d.kind === 'resize') {
    if (d.moved) { drawItems(idx); updateProps(); }
    else if (d.kind === 'move' && d.it.type === 'text' && S.tool !== 'select') editText(p.id, d.it);
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
  $$('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool && !b.closest('.pe-more > .pe-btn:first-child'))));
  const more = $('.pe-more > .pe-btn');
  if (more) more.setAttribute('aria-pressed', String(SHAPES.has(tool)));
  $$('.pe-layer').forEach((l) => { l.className = `pe-layer tool-${tool}`; });
  if (tool !== 'edittext') hideRuns();
  else $$('.pe-page').forEach((el) => { if (el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < window.innerHeight) showRuns(el); });
  if (tool !== 'select') select(null, null); else updateProps();
}

// -------------------------------------------------------------- properties --
const FIELDS = {
  color: $('#pColor'), fill: $('#pFill'), fillOn: $('#pFillOn'), width: $('#pWidth'), font: $('#pFont'),
  size: $('#pSize'), bold: $('#pBold'), italic: $('#pItalic'), opacity: $('#pOpacity'),
};
function propTarget() {
  const it = itemOf(S.sel);
  if (it) return { kind: it.type, obj: it, item: true };
  const d = defaultsFor(S.tool);
  return d ? { kind: S.tool === 'edittext' ? 'text' : S.tool, obj: d, item: false } : null;
}
function updateProps() {
  const t = propTarget();
  const show = new Set(t ? PROPS[t.kind] || [] : []);
  if (t && t.item) show.add('layer');
  $$('.pe-prop').forEach((el) => el.classList.toggle('show', show.has(el.dataset.for)));
  if (t) {
    const o = t.obj;
    if ('color' in o) FIELDS.color.value = o.color;
    if ('fill' in o) { FIELDS.fill.value = o.fill; FIELDS.fillOn.checked = !!o.fillOn; }
    if ('width' in o) { FIELDS.width.value = o.width; $('#pWidthOut').textContent = o.width; }
    if ('font' in o) FIELDS.font.value = o.font;
    if ('size' in o) FIELDS.size.value = o.size;
    if ('bold' in o) FIELDS.bold.setAttribute('aria-pressed', String(!!o.bold));
    if ('italic' in o) FIELDS.italic.setAttribute('aria-pressed', String(!!o.italic));
    if ('opacity' in o) { FIELDS.opacity.value = o.opacity; $('#pOpacityOut').textContent = `${o.opacity}%`; }
  }
  $('#peHint').textContent = t && t.item ? 'Delete key removes the selected object.' : HINTS[S.tool] || '';
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
function bindProps() {
  const end = () => { propSnap = false; };
  FIELDS.color.addEventListener('input', () => setProp('color', FIELDS.color.value));
  FIELDS.fill.addEventListener('input', () => { setProp('fill', FIELDS.fill.value); setProp('fillOn', true); FIELDS.fillOn.checked = true; });
  FIELDS.fillOn.addEventListener('change', () => { setProp('fillOn', FIELDS.fillOn.checked); end(); });
  FIELDS.width.addEventListener('input', () => { $('#pWidthOut').textContent = FIELDS.width.value; setProp('width', Number(FIELDS.width.value)); });
  FIELDS.font.addEventListener('change', () => { setProp('font', FIELDS.font.value); end(); });
  FIELDS.size.addEventListener('input', () => { const v = clamp(Number(FIELDS.size.value) || 0, 4, 200); if (v) setProp('size', v); });
  FIELDS.opacity.addEventListener('input', () => { $('#pOpacityOut').textContent = `${FIELDS.opacity.value}%`; setProp('opacity', Number(FIELDS.opacity.value)); });
  [FIELDS.bold, FIELDS.italic].forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault())); // keep the caret in the text
  FIELDS.bold.addEventListener('click', () => { const v = FIELDS.bold.getAttribute('aria-pressed') !== 'true'; FIELDS.bold.setAttribute('aria-pressed', String(v)); setProp('bold', v); end(); });
  FIELDS.italic.addEventListener('click', () => { const v = FIELDS.italic.getAttribute('aria-pressed') !== 'true'; FIELDS.italic.setAttribute('aria-pressed', String(v)); setProp('italic', v); end(); });
  Object.values(FIELDS).forEach((f) => f.addEventListener('change', end));
}

// -------------------------------------------------------------------- pages --
function buildThumbs() {
  const list = $('#peThumbs');
  list.textContent = '';
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { paintThumb(e.target); io.unobserve(e.target); } }), { root: list, rootMargin: '300px 0px' });
  S.pages.forEach((p, i) => {
    const [w, h] = viewSize(p);
    const tw = list.clientWidth ? Math.min(120, list.clientWidth - 24) : 120;
    const li = document.createElement('li');
    li.className = 'pe-thumb'; li.dataset.id = p.id; li.draggable = true; li.tabIndex = 0;
    li.setAttribute('aria-label', `Page ${i + 1}`);
    li.innerHTML = `<div class="pe-thumb-frame" style="width:${tw}px;height:${(tw * h) / w}px"><canvas></canvas></div>
      <div class="pe-thumb-tools">
        <button type="button" data-pg="rotl" title="Rotate left" aria-label="Rotate page ${i + 1} left"><svg viewBox="0 0 24 24"><path d="M4 4v6h6"/><path d="M5 15a8 8 0 1 0 2-8.5L4 10"/></svg></button>
        <button type="button" data-pg="rotr" title="Rotate right" aria-label="Rotate page ${i + 1} right"><svg viewBox="0 0 24 24"><path d="M20 4v6h-6"/><path d="M19 15a8 8 0 1 1-2-8.5L20 10"/></svg></button>
        <button type="button" data-pg="up" title="Move up" aria-label="Move page ${i + 1} up"><svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6"/></svg></button>
        <button type="button" data-pg="down" title="Move down" aria-label="Move page ${i + 1} down"><svg viewBox="0 0 24 24"><path d="M6 10l6 6 6-6"/></svg></button>
        <button type="button" data-pg="dup" title="Duplicate page" aria-label="Duplicate page ${i + 1}"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>
        <button type="button" data-pg="del" class="pe-danger" title="Delete page" aria-label="Delete page ${i + 1}"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </div>`;
    list.append(li);
    io.observe(li);
    drawThumbItems(p);
  });
  $('#pePageCount').textContent = `${S.pages.length} page${S.pages.length === 1 ? '' : 's'}`;
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
function setCurrent(i) { if (i !== S.current && i >= 0) { S.current = i; markCurrent(); } }
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

async function buildPdf(opts = {}) {
  const L = PDFLib();
  const { PDFDocument, StandardFonts, rgb, degrees, pushGraphicsState, popGraphicsState, concatTransformationMatrix, BlendMode, LineCapStyle } = L;
  const out = await PDFDocument.create();
  const sources = new Map();
  const fonts = new Map();
  const images = new Map();
  let replaced = 0;
  const font = async (f, bold, italic) => {
    const name = STD[f][(bold ? 1 : 0) + (italic ? 2 : 0)];
    if (!fonts.has(name)) {
      const ft = await out.embedFont(StandardFonts[name]);
      fonts.set(name, { ft, chars: new Set(ft.getCharacterSet()) });
    }
    return fonts.get(name);
  };
  const clean = (fo, s) => Array.from(s).map((ch) => { if (fo.chars.has(ch.codePointAt(0))) return ch; replaced++; return '?'; }).join('');
  const color = (hex) => rgb(...hexToRgb(hex));
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
      const op = (it.opacity ?? 100) / 100;
      if (it.type === 'text') {
        const fo = await font(it.font, it.bold, it.italic);
        it.text.split('\n').forEach((line, i) => {
          if (!line) return;
          page.drawText(clean(fo, line), { x: it.x, y: VH - (it.y + baselineOffset(it.font, it.size) + i * LINE * it.size), size: it.size, font: fo.ft, color: color(it.color), opacity: op });
        });
      } else if (it.type === 'whiteout') {
        page.drawRectangle({ x: it.x, y: VH - it.y - it.h, width: it.w, height: it.h, color: color(it.color), opacity: op });
      } else if (it.type === 'highlight') {
        page.drawRectangle({ x: it.x, y: VH - it.y - it.h, width: it.w, height: it.h, color: color(it.color), opacity: 0.45 * op, blendMode: BlendMode.Multiply });
      } else if (it.type === 'rect') {
        const bw = it.width;
        page.drawRectangle({ x: it.x + bw / 2, y: VH - it.y - it.h + bw / 2, width: Math.max(0, it.w - bw), height: Math.max(0, it.h - bw),
          borderColor: color(it.color), borderWidth: bw, borderOpacity: op, ...(it.fillOn ? { color: color(it.fill), opacity: op } : {}) });
      } else if (it.type === 'ellipse') {
        page.drawEllipse({ x: it.x + it.w / 2, y: VH - it.y - it.h / 2, xScale: Math.max(0, it.w / 2 - it.width / 2), yScale: Math.max(0, it.h / 2 - it.width / 2),
          borderColor: color(it.color), borderWidth: it.width, borderOpacity: op, ...(it.fillOn ? { color: color(it.fill), opacity: op } : {}) });
      } else if (it.type === 'line' || it.type === 'arrow') {
        const seg = (ax, ay, bx, by) => page.drawLine({ start: { x: ax, y: VH - ay }, end: { x: bx, y: VH - by }, thickness: it.width, color: color(it.color), opacity: op, lineCap: LineCapStyle.Round });
        seg(it.x1, it.y1, it.x2, it.y2);
        if (it.type === 'arrow') arrowHead(it).forEach(([hx, hy]) => seg(it.x2, it.y2, hx, hy));
      } else if (it.type === 'pen' || it.type === 'check' || it.type === 'cross') {
        let d;
        if (it.type === 'pen') {
          const sx = it.w / it.w0, sy = it.h / it.h0;
          d = it.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${round(x * sx)} ${round(y * sy)}`).join(' ');
        } else d = PATHS[it.type].replace(/([\d.]+) ([\d.]+)/g, (_, a, b) => `${round(a * it.w)} ${round(b * it.h)}`);
        page.drawSvgPath(d, { x: it.x, y: VH - it.y, borderColor: color(it.color), borderWidth: it.width, borderOpacity: op, borderLineCap: LineCapStyle.Round });
      } else if (it.type === 'image') {
        const a = S.assets.get(it.asset);
        if (!a) continue;
        if (!images.has(a.id)) {
          const bytes = Uint8Array.from(atob(a.url.split(',')[1]), (ch) => ch.charCodeAt(0));
          images.set(a.id, a.mime === 'image/jpeg' ? await out.embedJpg(bytes) : await out.embedPng(bytes));
        }
        page.drawImage(images.get(a.id), { x: it.x, y: VH - it.y - it.h, width: it.w, height: it.h, opacity: op });
      }
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
  } catch (e) { console.error(e); toast(`The PDF could not be saved: ${e.message}`, true); } finally { busy(false); }
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
  const typing = S.editing || /^(input|select|textarea)$/i.test(e.target.tagName) || e.target.isContentEditable;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if (typing) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); removeSelected(); return; }
  if (e.key === 'Escape') { select(null, null); setTool('select'); return; }
  if (S.sel && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const it = itemOf(S.sel), st = e.shiftKey ? 10 : 1;
    snapshot();
    moveItem(it, e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0);
    drawItems(pageIndex(S.sel.page));
    return;
  }
  if (mod) return;
  const k = { v: 'select', e: 'edittext', t: 'text', p: 'pen', h: 'highlight', w: 'whiteout', r: 'rect' }[e.key.toLowerCase()];
  if (k) setTool(k);
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
  $('#peImageInput').addEventListener('change', (e) => { if (e.target.files[0]) insertImage(e.target.files[0]); e.target.value = ''; });
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
  document.addEventListener('click', (e) => { if (!e.target.closest('.pe-more')) $$('.pe-more.open').forEach((m) => m.classList.remove('open')); });

  const acts = {
    new: () => { if (!S.dirty || window.confirm('Start a new PDF? Changes you have not downloaded will be lost.')) { $('#peApp').hidden = true; $('#peStart').hidden = false; document.body.classList.remove('is-editing'); $('#pe').classList.remove('editing'); } },
    open: () => $('#peOpenInput').click(),
    addpdf: () => $('#peAddPdfInput').click(),
    image: () => $('#peImageInput').click(),
    imgpage: () => $('#peImgPageInput').click(),
    sign: openSign,
    undo, redo,
    zoomin: () => setZoom(S.zoom * 1.2), zoomout: () => setZoom(S.zoom / 1.2), zoomfit: () => setZoom(fitZoom()),
    addpage: addBlankPage,
    delete: removeSelected, dup: duplicateSelected, front: frontSelected,
    export: () => { finishEditing(); $('#peExportNote').textContent = ''; $('#peExportDlg').showModal(); },
  };
  $$('[data-act]').forEach((b) => b.addEventListener('click', () => { const f = acts[b.dataset.act]; if (f) f(); }));
  $('#peExportOk').addEventListener('click', doExport);
  $('#peNumbers').addEventListener('change', () => { $('#peNumbersOpts').hidden = !$('#peNumbers').checked; });
  $('#peWatermark').addEventListener('change', () => { $('#peWatermarkOpts').hidden = !$('#peWatermark').checked; });

  const view = $('#peView');
  view.addEventListener('pointerdown', onPointerDown);
  view.addEventListener('pointermove', onPointerMove);
  view.addEventListener('pointerup', onPointerUp);
  view.addEventListener('pointercancel', onPointerUp);
  view.addEventListener('dblclick', (e) => {
    const o = e.target.closest('.pe-obj'), pageEl = e.target.closest('.pe-page');
    if (!o || !pageEl) return;
    const p = pageById(pageEl.dataset.id), it = p.items.find((i) => i.id === o.dataset.id);
    if (it && it.type === 'text') editText(p.id, it);
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
      if (S.tool === 'edittext') els.forEach((el) => { const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < window.innerHeight) showRuns(el); });
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
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!$('#peApp').hidden) buildThumbs(); }, 200); });
  setTool('select');
  lib().catch(() => {}); // start loading pdf.js while the visitor picks a file
}

init();
// Exposed for tests.
window.__pe = { S, buildPdf, pageMatrix, viewSize, baselineOffset, rotatePage };
