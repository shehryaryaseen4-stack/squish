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
const baselineOffset = (font, size, lh = LINE) => { const [a, d] = METRICS[font] || METRICS.helv; return ((lh - a - d) / 2 + a) * size; };

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
  select: 'Click any text to type in it (the PDF text too). Click to select, Shift+click or drag a box over empty space to select several. Drag to move, use the handles to resize. Space+drag moves around the page.',
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
  text: ['color', 'font', 'size', 'style', 'align', 'list', 'spacing', 'opacity'],
  pen: ['color', 'width', 'dash', 'opacity'], line: ['color', 'width', 'dash', 'opacity'], arrow: ['color', 'width', 'dash', 'opacity'],
  check: ['color', 'width'], cross: ['color', 'width'],
  rect: ['color', 'width', 'dash', 'fill', 'radius', 'opacity'], ellipse: ['color', 'width', 'dash', 'fill', 'opacity'],
  highlight: ['color', 'opacity'], whiteout: ['color'], image: ['imgshape', 'flip', 'opacity', 'replace'], icon: ['color', 'width', 'opacity'],
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
  scheduleSave();
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

// pdf.js 6 closes a document through its loading task
const closePdf = (proxy) => { try { if (proxy) (proxy.loadingTask || proxy).destroy(); } catch { /* already closed */ } };
const blankPage = (w, h) => ({ id: uid(), src: null, box: [0, 0, w, h], baseRot: 0, rot: 0, items: [] });

async function openFile(file) {
  if (!isPdf(file)) { toast('Please choose a PDF file.', true); return; }
  busy(true, 'Opening PDF…');
  try {
    const bytes = await readFile(file);
    if (await openProject(bytes, file.name)) return;
    const pages = await addPdf(bytes);
    resetDoc(pages, file.name.replace(/\.pdf$/i, '') + '-edited.pdf', file.name);
  } catch (e) { toast(e.message, true); } finally { busy(false); }
}

// ------------------------------------------------------- editable project --
// A PDF saved here carries its editable project as an attachment (flipit-project.json, plus the
// original PDFs its pages came from). Opening that PDF here again brings back every text box,
// list, photo and shape as it was, instead of flat PDF lines.
const PROJECT_FILE = 'flipit-project.json';
// The whole editable document: pages and their objects, the pictures used, and the original
// PDFs behind the pages (null when those are too big to carry along).
function projectPayload() {
  const docIds = [...new Set(S.pages.filter((p) => p.src).map((p) => p.src.doc))];
  const srcBytes = docIds.reduce((n, id) => n + ((S.docs.get(id) || {}).bytes || []).length, 0);
  if (srcBytes > 25 * 1024 * 1024 || docIds.some((id) => !S.docs.get(id) || !S.docs.get(id).bytes)) return null;
  const used = new Set(S.pages.flatMap((p) => p.items.filter((i) => i.type === 'image').map((i) => i.asset)));
  const proj = {
    app: 'flipitfree', v: 1, title: $('#peDocName').textContent, name: $('#peFileName').value,
    pages: S.pages.map((p) => ({ ...p, src: p.src ? { doc: docIds.indexOf(p.src.doc), index: p.src.index } : null })),
    assets: [...used].map((id) => S.assets.get(id)).filter(Boolean),
  };
  return { proj, sources: docIds.map((id) => S.docs.get(id).bytes) };
}
function attachProject(out) {
  try {
    const pl = projectPayload();
    if (!pl) return;
    const opt = { mimeType: 'application/json', description: 'Editable copy of this document. Open this PDF at flipitfree.com/edit-pdf to keep editing it.' };
    out.attach(new TextEncoder().encode(JSON.stringify(pl.proj)), PROJECT_FILE, opt);
    pl.sources.forEach((b, i) => out.attach(b, `flipit-source-${i}.pdf`, { mimeType: 'application/pdf', description: 'Original pages, for editing again at flipitfree.com' }));
  } catch (e) { console.warn('Could not attach the editable project', e); }
}
// Open a saved project (from a PDF's attachment or from this browser's saved designs).
async function applyProject(proj, sources, fileName) {
  const docMap = [];
  for (let i = 0; i < sources.length; i++) {
    const pages = await addPdf(new Uint8Array(sources[i]));
    docMap[i] = pages.length ? pages[0].src.doc : null;
  }
  if (proj.pages.some((p) => p.src && !docMap[p.src.doc])) return false;
  for (const a of proj.assets || []) if (a && a.id && a.url) S.assets.set(a.id, a);
  const pages = proj.pages.map((p) => ({ ...p, src: p.src ? { doc: docMap[p.src.doc], index: p.src.index } : null }));
  resetDoc(pages, proj.name || fileName, proj.title || fileName);
  return true;
}
async function openProject(bytes, fileName) {
  let proxy;
  try {
    const lib_ = await lib();
    proxy = await lib_.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    const att = await proxy.getAttachments();
    // pdf.js 6 lists attachments in a Map and hands out their bytes separately
    const has = (n) => !!att && (att instanceof Map ? att.has(n) : !!att[n]);
    const bytesOf = async (n) => { const v = att instanceof Map ? att.get(n) : att[n]; return (v && v.content) || (proxy.getAttachmentContent ? proxy.getAttachmentContent(n) : null); };
    if (!has(PROJECT_FILE)) return false;
    const proj = JSON.parse(new TextDecoder().decode(await bytesOf(PROJECT_FILE)));
    if (!proj || proj.app !== 'flipitfree' || !Array.isArray(proj.pages)) return false;
    // the original PDFs behind the pages
    const sources = [];
    for (let i = 0; has(`flipit-source-${i}.pdf`); i++) sources.push(await bytesOf(`flipit-source-${i}.pdf`));
    if (!(await applyProject(proj, sources, fileName))) return false;
    toast('Opened with everything editable again: text boxes, lists, photos and shapes, just as you left them.');
    return true;
  } catch (e) {
    console.warn('No editable project in this PDF', e);
    return false;
  } finally { closePdf(proxy); }
}

function createNew() {
  const [w, h] = SIZES[$('#peNewSize').value] || SIZES.a4;
  const land = $('#peNewOrient').value === 'landscape';
  resetDoc([land ? blankPage(h, w) : blankPage(w, h)], 'document.pdf', 'Untitled document');
  setTool('text');
}

function resetDoc(pages, name, title) {
  S.docs.forEach((d, id) => { if (!pages.some((p) => p.src && p.src.doc === id)) { closePdf(d.proxy); S.docs.delete(id); } });
  S.pages = pages; S.undo = []; S.redo = []; S.sel = null; S.editing = null; S.current = 0; S.dirty = false; S.runs.clear();
  S.projectId = null; // a new design gets its place in "Projects" with its first change
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
  // "+ Add page" under the last page
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'pe-addpage';
  add.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add page';
  add.style.width = `${viewSize(S.pages[S.pages.length - 1])[0] * S.zoom}px`;
  add.addEventListener('click', () => { S.current = S.pages.length - 1; addBlankPage(); });
  view.append(add);
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
      fillText(o, it, z);
      o.dir = 'auto';
      if (it.lh) o.style.lineHeight = String(it.lh);
      Object.assign(o.style, {
        fontFamily: cssFamily(it.font), fontSize: `${it.size * z}px`, color: it.color,
        fontWeight: it.bold ? '700' : '400', fontStyle: it.italic ? 'italic' : 'normal',
        textDecoration: [it.underline && 'underline', it.strike && 'line-through'].filter(Boolean).join(' ') || 'none', textAlign: it.align || 'left',
        textTransform: it.caps ? 'uppercase' : 'none',
      });
      // a text with a column width wraps inside it
      if (it.wrap) { o.classList.add('pe-wrap'); o.style.width = `${it.wrap * z}px`; }
      if (it.minH) o.style.minHeight = `${it.minH * z}px`;
      if (!isStd(it.font)) ensureFont(it.font, it.bold, it.italic);
      if (live && S.editing === it.id) startEditing(o, it, true);
    } else {
      o.style.width = `${it.w * z}px`; o.style.height = `${it.h * z}px`;
      if (it.type === 'image') {
        const a = S.assets.get(it.asset);
        const img = document.createElement('img'); img.alt = ''; img.src = a ? a.url : ''; o.append(img);
        if (it.flipX || it.flipY) img.style.transform = `scale(${it.flipX ? -1 : 1}, ${it.flipY ? -1 : 1})`;
        // an image in a shape fills it (cover) and is cut to an ellipse or a rounded rectangle
        if (it.clip) {
          o.classList.add('pe-clip');
          if (a) placePhotoImg(img, it, a, z);
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
  if (it.type === 'icon') return `<svg viewBox="0 0 24 24" fill="none" stroke="${it.color}" stroke-width="${it.width || 2}" stroke-linecap="round" stroke-linejoin="round"><path d="${it.d}"/></svg>`;
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

// ------------------------------------------------------------- photos --
// A picture in a shape covers it, zoomed by fz (1 = just covers the shape) and shifted by fx / fy
// (0..1: how much of the overflow is cut on the left / top; 0.5 = centred). Screen and PDF use
// the same numbers. Resume photos (photo: true) are moved inside their circle by dragging, and
// zoomed with the slider under them, the mouse wheel or two fingers.
function photoRect(it, a) {
  const s = Math.max(it.w / a.w, it.h / a.h) * (it.fz || 1);
  const w = a.w * s, h = a.h * s;
  return { x: -(w - it.w) * (it.fx ?? 0.5), y: -(h - it.h) * (it.fy ?? 0.5), w, h };
}
function placePhotoImg(img, it, a, z) {
  const r = photoRect(it, a);
  Object.assign(img.style, { inset: 'auto', left: `${r.x * z}px`, top: `${r.y * z}px`, width: `${r.w * z}px`, height: `${r.h * z}px`, maxWidth: 'none', objectFit: 'fill' });
}
const isPhoto = (it) => !!(it && it.type === 'image' && it.photo && it.clip);
// redraw just the picture inside a photo while it is dragged or zoomed (no full redraw)
function refreshPhoto(pageId, it) {
  const o = $(`.pe-page[data-id="${pageId}"] .pe-obj[data-id="${it.id}"] img`), a = S.assets.get(it.asset);
  if (o && a) placePhotoImg(o, it, a, S.zoom);
  const r = $('.pe-photobar input[type=range]');
  if (r) r.value = String(Math.round((it.fz || 1) * 100));
}
function zoomPhoto(pageId, it, fz) {
  it.fz = clamp(fz, 1, 5);
  refreshPhoto(pageId, it);
}
// The photo circle in a template under a click: the circle itself, or the PHOTO / initials text on it.
function photoSlotAt(p, pt, it) {
  if (it.photo && it.type === 'ellipse' && !it.locked) return it;
  if (it.type !== 'text') return null;
  return p.items.find((o) => o.photo && o.type === 'ellipse' && !o.hidden && !o.locked && pt.x >= o.x && pt.x <= o.x + o.w && pt.y >= o.y && pt.y <= o.y + o.h) || null;
}
function choosePhoto(p, slot) {
  imagePick = { mode: 'photo', page: p.id, id: slot.id };
  $('#peImageInput').click();
}
function photoBar(it, layer, z) {
  const bar = document.createElement('div');
  bar.className = 'pe-photobar';
  bar.style.left = `${(it.x + it.w / 2) * z}px`; bar.style.top = `${(it.y + it.h) * z + 12}px`;
  bar.innerHTML = `<button type="button" data-ph="out" aria-label="Zoom out">&minus;</button><input type="range" min="100" max="500" step="1" value="${Math.round((it.fz || 1) * 100)}" aria-label="Zoom photo"><button type="button" data-ph="in" aria-label="Zoom in">+</button><button type="button" data-ph="change">Change photo</button>`;
  const pageId = S.sel.page, range = bar.querySelector('input');
  range.addEventListener('pointerdown', () => snapshot());
  range.addEventListener('keydown', () => snapshot(), { once: true });
  range.addEventListener('input', () => zoomPhoto(pageId, it, Number(range.value) / 100));
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ph]');
    if (!b) return;
    if (b.dataset.ph === 'change') { imagePick = { mode: 'item', sel: { page: pageId, id: it.id } }; $('#peImageInput').click(); return; }
    snapshot();
    zoomPhoto(pageId, it, (it.fz || 1) * (b.dataset.ph === 'in' ? 1.15 : 1 / 1.15));
  });
  layer.append(bar);
}

// ------------------------------------------------------- quick actions --
function flipSelected(axis) {
  const its = selItems().filter((o) => o.type === 'image');
  if (!its.length) return;
  snapshot();
  const k = axis === 'x' ? 'flipX' : 'flipY';
  its.forEach((o) => { o[k] = !o[k]; });
  drawItems(pageIndex(S.sel.page)); updateProps();
}
// Copy style / Paste style: colours, fonts and sizes from one object onto others of the same kind
const STYLE_KEYS = {
  text: ['color', 'font', 'size', 'bold', 'italic', 'underline', 'strike', 'caps', 'align', 'lh', 'ps', 'opacity'],
  shape: ['color', 'fill', 'fillOn', 'width', 'dash', 'radius', 'opacity'],
  image: ['opacity', 'sw', 'stroke'],
  table: ['font', 'size', 'color', 'headFill', 'headColor', 'border', 'bw', 'borders', 'stripe', 'opacity'],
};
const styleKind = (o) => (o.type === 'text' || o.type === 'image' || o.type === 'table' ? o.type : 'shape');
let styleClip = null;
function copyStyle() {
  const it = itemOf(S.sel);
  if (!it) return;
  const keys = STYLE_KEYS[styleKind(it)];
  styleClip = { kind: styleKind(it), props: Object.fromEntries(keys.filter((k) => k in it).map((k) => [k, it[k]])) };
  toast('Style copied. Select other objects and choose Paste style (Ctrl+Alt+V).');
}
function pasteStyle() {
  if (!styleClip) { toast('Copy a style first: right-click an object and choose Copy style.'); return; }
  const its = selItems().filter((o) => styleKind(o) === styleClip.kind && !o.locked);
  if (!its.length) { toast(`That style is for ${styleClip.kind === 'shape' ? 'shapes and lines' : `${styleClip.kind}s`}. Select one of those.`); return; }
  snapshot();
  const p = pageById(S.sel.page);
  for (const o of its) {
    const oldB = o.y + o.h;
    Object.assign(o, styleClip.props);
    if (o.type === 'text' && !isStd(o.font)) ensureFont(o.font, o.bold, o.italic);
    drawItems(pageIndex(p.id));
    if (o.type === 'text') reflowAfter(p, o, oldB);
  }
  drawItems(pageIndex(p.id)); updateProps();
}
function lockSelected() {
  const its = selItems();
  if (!its.length) return;
  snapshot();
  const lock = !its.every((o) => o.locked);
  its.forEach((o) => { o.locked = lock; });
  drawItems(pageIndex(S.sel.page)); decorateSelection(); renderLayers();
  toast(lock ? 'Locked: it cannot be moved or changed until you unlock it.' : 'Unlocked.');
}
// the small bar above the selection: duplicate, lock, delete and the full menu
const QBAR_ICONS = {
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  del: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  group: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M15 3h6v6M3 15v6h6" stroke-dasharray="2 2"/>',
  ungroup: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
};
function quickBar(layer, box, locked, z) {
  const bar = document.createElement('div');
  bar.className = 'pe-qbar';
  const btn = (k, title, ico = k) => `<button type="button" data-q="${k}" title="${title}" aria-label="${title}"><svg viewBox="0 0 24 24">${QBAR_ICONS[ico]}</svg></button>`;
  const grp = S.group ? (selIsOneGroup() ? btn('ungroup', 'Ungroup (Ctrl+Shift+G)') : btn('group', 'Group (Ctrl+G)')) : '';
  bar.innerHTML = grp + btn('dup', 'Duplicate (Ctrl+D)') + btn('lock', locked ? 'Unlock' : 'Lock', locked ? 'lock' : 'unlock') + btn('del', 'Delete (Del)') + btn('more', 'More options');
  const above = box.top * z > 46;
  Object.assign(bar.style, { left: `${(box.left + box.w / 2) * z}px`, top: above ? `${box.top * z - 44}px` : `${(box.top + box.h) * z + 12}px` });
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    if (b.dataset.q === 'group') groupSelected();
    else if (b.dataset.q === 'ungroup') ungroupSelected();
    else if (b.dataset.q === 'dup') duplicateSelected();
    else if (b.dataset.q === 'lock') lockSelected();
    else if (b.dataset.q === 'del') removeSelected();
    else { const r = b.getBoundingClientRect(); showCtx(r.left, r.bottom + 6); }
  });
  layer.append(bar);
}

// ---------------------------------------------------------------- elements --
// Ready text styles, icons, lines and a photo circle, placed in the middle of what is in view.
const ICONS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  email: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  location: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  website: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z',
  linkedin: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3.1-.4 6.4-1.5 6.4-7a5.4 5.4 0 0 0-1.5-3.7 5 5 0 0 0-.1-3.8s-1.2-.3-3.9 1.5a13.4 13.4 0 0 0-7 0C6.3 1.7 5.1 2 5.1 2a5 5 0 0 0-.1 3.8A5.4 5.4 0 0 0 3.5 9.5c0 5.4 3.3 6.6 6.4 7a3.4 3.4 0 0 0-.9 2.6V22',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  briefcase: 'M2 7h20v14H2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  education: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5',
  calendar: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  award: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.2 13.9L7 23l5-3 5 3-1.2-9.1',
  language: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  check: 'M20 6L9 17l-5-5',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
};
function viewCentre() {
  const p = S.pages[S.current] || S.pages[0];
  const [vw, vh] = viewSize(p);
  const pageEl = $(`.pe-page[data-id="${p.id}"]`), vr = $('#peView').getBoundingClientRect();
  const pr = pageEl ? pageEl.getBoundingClientRect() : vr;
  const cy = clamp(((Math.max(vr.top, pr.top) + Math.min(vr.bottom, pr.bottom)) / 2 - pr.top) / S.zoom, 30, vh - 30);
  return { p, vw, vh, cx: vw / 2, cy };
}
function addElement(kind) {
  closeElements();
  finishEditing();
  const { p, vw, vh, cx, cy } = viewCentre();
  snapshot();
  let it;
  const TEXTS = {
    heading: { text: 'Add a heading', size: 24, bold: true },
    subheading: { text: 'Add a subheading', size: 15, bold: true },
    body: { text: 'Add a little bit of body text', size: 11, bold: false },
    bullets: { text: `${BULLET}First point\n${BULLET}Second point\n${BULLET}Third point`, size: 11, bold: false, wrap: 220 },
  };
  if (TEXTS[kind]) {
    const d = { ...DEFAULTS.text, italic: false, underline: false, ...TEXTS[kind] };
    it = { id: uid(), type: 'text', ...d, x: cx - 80, y: cy - d.size, w: 160, h: d.size * LINE };
  } else if (ICONS[kind]) {
    it = { id: uid(), type: 'icon', d: ICONS[kind], name: kind, color: DEFAULTS.text.color, width: 2, opacity: 100, x: cx - 10, y: cy - 10, w: 20, h: 20 };
  } else if (kind === 'divider') {
    it = { id: uid(), type: 'line', ...DEFAULTS.line, width: 1, color: '#9ca3af', x1: cx - 120, y1: cy, x2: cx + 120, y2: cy };
    lineBox(it);
  } else if (kind === 'rect' || kind === 'ellipse') {
    it = { id: uid(), type: kind, ...DEFAULTS[kind], x: cx - 60, y: cy - 35, w: 120, h: 70 };
  } else if (kind === 'photo') {
    it = { id: uid(), type: 'ellipse', ...DEFAULTS.ellipse, color: '#d1d5db', width: 0, fill: '#e5e7eb', fillOn: true, photo: true, x: cx - 50, y: cy - 50, w: 100, h: 100 };
  }
  if (!it) return;
  it.x = clamp(it.x, 0, Math.max(0, vw - it.w)); it.y = clamp(it.y, 0, Math.max(0, vh - it.h));
  p.items.push(it);
  drawItems(pageIndex(p.id));
  setTool('select');
  select(p.id, it.id);
  if (it.type === 'text') editText(p.id, it);
  if (kind === 'photo') toast('Photo circle added. Click it to choose your picture.');
}
function openElements(btn) {
  const pop = $('#peElements');
  if (!pop.hidden) { closeElements(); return; }
  const grid = $('#peIconGrid');
  if (!grid.children.length) grid.innerHTML = Object.entries(ICONS).map(([k, d]) => `<button type="button" data-el="${k}" title="${k[0].toUpperCase()}${k.slice(1)}"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></button>`).join('');
  pop.hidden = false;
  const r = btn.getBoundingClientRect();
  pop.style.left = `${clamp(r.left + r.width / 2 - pop.offsetWidth / 2, 8, window.innerWidth - pop.offsetWidth - 8)}px`;
  pop.style.top = `${r.bottom + 8}px`;
}
const closeElements = () => { const pop = $('#peElements'); if (pop) pop.hidden = true; };

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
    it.cells[ce.r][ce.c] = readText(span);
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
  S.group = null;
  S.sel = id ? { page: pageId, id } : null;
  if (!S.cell || S.cell.id !== id) S.cell = null;
  clearSelectionUi();
  if (S.sel) decorateSelection();
  updateProps(); renderLayers();
}
const isLine = (it) => it.type === 'line' || it.type === 'arrow';

// ---------------------------------------------------------- multi-select --
// Several objects on one page can be selected together: Shift (or Ctrl) + click, a drag box over
// empty space, Ctrl+A, or Shift/Ctrl + click in Layers. They move, copy, paste, duplicate and
// delete together, and style changes (colour, font, size ...) apply to all of them.
const isSelId = (id) => (S.group ? S.group.has(id) : !!(S.sel && S.sel.id === id));
function selectGroup(pageId, ids) {
  ids = [...new Set(ids)];
  if (ids.length < 2) { select(ids.length ? pageId : null, ids[0] || null); return; }
  finishEditing();
  S.sel = { page: pageId, id: ids[ids.length - 1] }; S.cell = null;
  S.group = new Set(ids);
  clearSelectionUi(); decorateSelection(); updateProps(); renderLayers();
}
function toggleGroup(pageId, id) {
  const cur = S.sel && S.sel.page === pageId ? (S.group ? [...S.group] : [S.sel.id]) : [];
  selectGroup(pageId, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
}
// the selected objects (one or several), in page order
function selItems() {
  if (!S.sel) return [];
  const p = pageById(S.sel.page);
  if (!p) return [];
  return S.group ? p.items.filter((o) => S.group.has(o.id)) : p.items.filter((o) => o.id === S.sel.id);
}
const shiftY = (o, dy) => { o.y += dy; if (isLine(o)) { o.y1 += dy; o.y2 += dy; } };
function selectAllOnPage() {
  const p = S.pages[S.current];
  if (!p) return;
  const [W, H] = viewSize(p);
  selectGroup(p.id, p.items.filter((o) => !o.hidden && !o.locked && !isBackdrop(o, W, H)).map((o) => o.id));
}
function clearSelectionUi() { $$('.pe-selbox, .pe-handle, .pe-photobar, .pe-gbox, .pe-qbar').forEach((e) => e.remove()); }
// Outline, corner handles and a rotation handle, turned with the object.
function decorateSelection() {
  clearSelectionUi();
  if (S.group && S.sel) {
    const gp = $(`.pe-page[data-id="${S.sel.page}"] .pe-layer`);
    if (!gp) return;
    const z = S.zoom, its = selItems().filter((o) => !o.hidden);
    for (const o of its) {
      const b = document.createElement('div'); b.className = 'pe-selbox pe-gsel';
      Object.assign(b.style, { left: `${o.x * z}px`, top: `${o.y * z}px`, width: `${o.w * z}px`, height: `${o.h * z}px` });
      if (o.rot) b.style.transform = `rotate(${o.rot}deg)`;
      gp.append(b);
    }
    if (its.length) {
      const L = Math.min(...its.map(itemLeft)), T = Math.min(...its.map(itemTop)), R = Math.max(...its.map(itemRight)), B = Math.max(...its.map(itemBottom));
      const g = document.createElement('div'); g.className = 'pe-gbox';
      Object.assign(g.style, { left: `${L * z - 4}px`, top: `${T * z - 4}px`, width: `${(R - L) * z + 8}px`, height: `${(B - T) * z + 8}px` });
      g.dataset.n = `${its.length} selected`;
      gp.append(g);
      quickBar(gp, { left: L, top: T, w: R - L, h: B - T }, its.every((o) => o.locked), z);
    }
    return;
  }
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
    quickBar(layer, { left: itemLeft(it), top: itemTop(it), w: itemRight(it) - itemLeft(it), h: itemBottom(it) - itemTop(it) }, !!it.locked, z);
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
    // text boxes: the sides change the width (the text wraps again), the bottom the height
    if (it.type === 'text') [['w', '0%', '50%'], ['e', '100%', '50%'], ['s', '50%', '100%']].forEach(([h, x, y]) => handle(h, box, x, y));
    handle('rot', box, '50%', 0);
    if (it.type === 'table' && !it.rot) {
      // drag the lines between columns and under rows to resize them
      const xs = colXs(it), ys = rowYs(it);
      for (let c = 1; c < it.cols; c++) { const g = document.createElement('div'); g.className = 'pe-handle pe-tgrip col'; g.dataset.h = 'col'; g.dataset.i = c; g.style.left = `${xs[c] * z}px`; g.title = 'Drag to change the column width'; box.append(g); }
      for (let r = 0; r < it.rows; r++) { const g = document.createElement('div'); g.className = 'pe-handle pe-tgrip row'; g.dataset.h = 'row'; g.dataset.i = r; g.style.top = `${ys[r + 1] * z}px`; g.title = 'Drag to change the row height'; box.append(g); }
    }
  }
  layer.append(box);
  if (isPhoto(it) && !it.locked) photoBar(it, layer, z);
  quickBar(layer, { left: itemLeft(it), top: itemTop(it), w: itemRight(it) - itemLeft(it), h: itemBottom(it) - itemTop(it) }, !!it.locked, z);
}

// ----------------------------------------------------------- arrange etc. --
function arrange(where) {
  if (S.group) { arrangeMany(where); return; }
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
// several selected objects go up or down the layers together, keeping their own order
function arrangeMany(where) {
  const p = pageById(S.sel.page);
  const its = selItems();
  if (!p || !its.length) return;
  const rest = p.items.filter((o) => !its.includes(o));
  const first = p.items.indexOf(its[0]), last = p.items.indexOf(its[its.length - 1]);
  // their place in the list without them: past the next (or before the previous) other object
  const before = p.items.slice(0, first).filter((o) => !its.includes(o)).length;
  const upTo = p.items.slice(0, last + 1).filter((o) => !its.includes(o)).length;
  const at = clamp({ tofront: rest.length, toback: 0, forward: upTo + 1, backward: before - 1 }[where], 0, rest.length);
  const next = [...rest.slice(0, at), ...its, ...rest.slice(at)];
  if (next.every((o, i) => o === p.items[i])) return;
  snapshot();
  p.items.splice(0, p.items.length, ...next);
  drawItems(pageIndex(p.id)); decorateSelection(); renderLayers();
}

// ------------------------------------------------------------------ groups --
// Grouped objects share a grp id: one click picks up the whole group, which then moves, copies
// and goes up or down the layers as one. A second click on one of them picks just that one
// (a text then takes typing). Ctrl+G groups, Ctrl+Shift+G ungroups.
function regroup(copies) {
  const map = new Map();
  copies.forEach((c) => { if (c.grp) { if (!map.has(c.grp)) map.set(c.grp, uid()); c.grp = map.get(c.grp); } });
  return copies;
}
const groupOf = (p, it) => (it && it.grp ? p.items.filter((o) => o.grp === it.grp && !o.hidden) : null);
const selIsOneGroup = () => { const its = selItems(); return its.length > 1 && !!its[0].grp && its.every((o) => o.grp === its[0].grp); };
function groupSelected() {
  const its = selItems();
  if (its.length < 2) { toast('Select two or more objects first (Shift+click, or drag a box around them).'); return; }
  snapshot();
  const g = uid(); its.forEach((o) => { o.grp = g; });
  // the group sits together in the layers, where its top object was
  const p = pageById(S.sel.page), top = Math.max(...its.map((o) => p.items.indexOf(o)));
  const below = p.items.slice(0, top + 1).filter((o) => !its.includes(o)), above = p.items.slice(top + 1);
  p.items.splice(0, p.items.length, ...below, ...its, ...above);
  drawItems(pageIndex(p.id)); selectGroup(p.id, its.map((o) => o.id));
  toast('Grouped. Click once to pick up the group, click again to change one part.');
}
function ungroupSelected() {
  const its = selItems().filter((o) => o.grp);
  if (!its.length) return;
  snapshot();
  const p = pageById(S.sel.page), ids = new Set(its.map((o) => o.grp));
  p.items.forEach((o) => { if (ids.has(o.grp)) delete o.grp; });
  decorateSelection(); updateProps(); renderLayers();
  toast('Ungrouped.');
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
  const its = selItems();
  if (!its.length) return false;
  clip = { items: JSON.parse(JSON.stringify(its)), page: S.sel.page };
  if (cut) removeSelected(); else toast(its.length > 1 ? `${its.length} objects copied` : 'Copied');
  return true;
}
function pasteClip() {
  if (!clip) return false;
  const p = S.pages[S.current] || S.pages[0];
  const cs = regroup(clip.items.map((o) => ({ ...JSON.parse(JSON.stringify(o)), id: uid(), locked: false, hidden: false })));
  if (clip.page === p.id) cs.forEach((c) => moveItem(c, 12, 12));
  // keep the whole group on the page
  const [vw, vh] = viewSize(p);
  const L = Math.min(...cs.map(itemLeft)), T = Math.min(...cs.map(itemTop)), R = Math.max(...cs.map(itemRight)), B = Math.max(...cs.map(itemBottom));
  const dx = clamp(L, 0, Math.max(0, vw - (R - L))) - L, dy = clamp(T, 0, Math.max(0, vh - (B - T))) - T;
  if (dx || dy) cs.forEach((c) => moveItem(c, dx, dy));
  snapshot();
  p.items.push(...cs);
  clip = { items: JSON.parse(JSON.stringify(cs)), page: p.id }; // the next paste steps on again
  drawItems(pageIndex(p.id)); setTool('select'); selectGroup(p.id, cs.map((c) => c.id));
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
  const its = selItems();
  if (!its.length) return;
  snapshot();
  const p = pageById(S.sel.page);
  p.items = p.items.filter((i) => !its.includes(i));
  S.sel = null; S.group = null;
  drawItems(pageIndex(p.id)); updateProps(); renderLayers();
}
// Duplicate puts the copy straight under the original (a new job, school or list block) and
// moves what was under it down to make room; what no longer fits goes to the next page.
function duplicateSelected() {
  const its = selItems().filter((o) => !o.locked);
  if (!its.length) return;
  snapshot();
  const p = pageById(S.sel.page);
  const [W, H] = viewSize(p);
  const L = Math.min(...its.map(itemLeft)), R = Math.max(...its.map(itemRight));
  const T = Math.min(...its.map(itemTop)), B = Math.max(...its.map(itemBottom));
  const gap = its.length > 1 ? 12 : 6, dy = B - T + gap;
  const moved = [];
  for (const o of p.items) {
    if (its.includes(o) || o.hidden || o.locked || isBackdrop(o, W, H)) continue;
    if (itemTop(o) < B - 1 || itemLeft(o) >= R - 1 || itemRight(o) <= L + 1) continue;
    shiftY(o, dy); moved.push(o);
  }
  const copies = regroup(its.map((o) => { const c = { ...JSON.parse(JSON.stringify(o)), id: uid(), locked: false, hidden: false }; shiftY(c, dy); return c; }));
  // the copies go right after the last original in the layer order
  p.items.splice(Math.max(...its.map((o) => p.items.indexOf(o))) + 1, 0, ...copies);
  S.flowed = new Set([...moved, ...copies].map((o) => o.id));
  if (spillOver(p, null, null)) {
    rebuild();
    const where = S.pages.find((pg) => pg.items.includes(copies[0]));
    selectGroup(where.id, copies.filter((c) => where.items.includes(c)).map((c) => c.id));
    toast('Duplicated. The page was full, so some of it moved to the next page.');
    return;
  }
  drawItems(pageIndex(p.id));
  selectGroup(p.id, copies.map((c) => c.id));
}
function frontSelected() { arrange('tofront'); }
function moveItem(it, dx, dy) {
  it.x += dx; it.y += dy;
  delete it.ax;
  if (it.type === 'line' || it.type === 'arrow') { it.x1 += dx; it.x2 += dx; it.y1 += dy; it.y2 += dy; }
}

// ------------------------------------------------------------ flowing text --
// Left-aligned text gets a column width (wrap, in points) when it is first edited, so longer
// text breaks into lines inside its column instead of running off the page. While it grows or
// shrinks, everything under it in the same column (headings, lines, other text) moves down or
// up by the same amount, so the gaps stay the same. When editing ends, whatever no longer fits
// on the page moves to the next page; a new page (with the same background) is added if needed.
const itemLeft = (o) => (isLine(o) ? Math.min(o.x1, o.x2) : o.x);
const itemRight = (o) => (isLine(o) ? Math.max(o.x1, o.x2) : o.x + o.w);
const itemTop = (o) => (isLine(o) ? Math.min(o.y1, o.y2) : o.y);
const itemBottom = (o) => (isLine(o) ? Math.max(o.y1, o.y2) : o.y + o.h);
const isBackdrop = (o, W, H) => (o.type === 'rect' || o.type === 'ellipse' || o.type === 'image') && (o.h > H * 0.45 || (o.w > W * 0.9 && o.h > H * 0.2));
function columnWidth(p, it) {
  const [W, H] = viewSize(p);
  const top = it.y, bot = it.y + it.h, right0 = it.x + it.w;
  let limit = W - clamp(it.x, 24, 56); // same margin as on the left
  for (const o of p.items) {
    if (o === it || o.hidden) continue;
    // a coloured column (sidebar) around the text: stay inside it, padded like on its left
    if (o.type === 'rect' && o.fillOn && o.x <= it.x && o.x + o.w >= right0 && o.y <= top && o.y + o.h >= bot && o.w < W * 0.8) limit = Math.min(limit, o.x + o.w - (it.x - o.x));
    // something on the same lines to its right (a date next to a job title)
    else if (o.x >= right0 - 1 && o.y < bot && o.y + o.h > top && !isBackdrop(o, W, H)) limit = Math.min(limit, o.x - 10);
    // the next column: left-aligned text further right, near these lines
    else if (o.type === 'text' && o.ax == null && o.x > right0 + 24 && o.y < bot + 260 && o.y + o.h > top - 260) limit = Math.min(limit, o.x - 18);
  }
  // a line across this column (a section rule) marks its right edge
  const rules = p.items.filter((o) => isLine(o) && !o.hidden && Math.abs(o.y1 - o.y2) < 1 && itemLeft(o) <= it.x + 4 && itemRight(o) > right0 && itemRight(o) <= limit + 40)
    .sort((a, b) => Math.abs(a.y1 - top) - Math.abs(b.y1 - top));
  if (rules.length) limit = Math.min(limit, itemRight(rules[0]));
  return Math.max(it.w, limit - it.x);
}
function giveWrap(p, it) {
  if (it.wrap || it.type !== 'text' || (it.align && it.align !== 'left') || it.rot) return;
  it.wrap = round(columnWidth(p, it));
  delete it.ax;
}
// Move everything below `bottom` in the text's column by dy; returns what moved.
function flowBelow(p, it, bottom, dy) {
  // Pages of an opened PDF: its own content cannot move, so nothing else moves either (as in
  // other PDF editors); only templates and blank pages reflow.
  if (!dy || p.src) return [];
  const [W, H] = viewSize(p);
  // the whole column, even when the box itself was made narrower (dates on the right move too)
  const L = it.x, R = it.x + Math.max(it.w, it.wrap || 0, it.align === 'left' || !it.align ? columnWidth(p, it) : 0);
  const moved = [];
  for (const o of p.items) {
    if (o === it || o.hidden || o.locked || o.cover || isBackdrop(o, W, H)) continue;
    if (itemTop(o) < bottom - 1) continue;           // above or beside the text
    if (itemLeft(o) >= R - 1 || itemRight(o) <= L + 1) continue; // another column
    o.y += dy;
    if (isLine(o)) { o.y1 += dy; o.y2 += dy; }
    moved.push(o);
  }
  return moved;
}
// While typing: keep the things under the text the same distance below it.
function flowWhileTyping(o, it) {
  const p = S.pages.find((pg) => pg.items.includes(it));
  if (!p || !it.wrap) return;
  const nb = it.y + o.offsetHeight / S.zoom;
  if (S.flowB == null) S.flowB = it.y + it.h;
  const dy = nb - S.flowB, from = S.flowB;
  if (Math.abs(dy) < 0.5) return;
  S.flowB = nb;
  const layer = o.closest('.pe-layer');
  for (const m of flowBelow(p, it, from, dy)) {
    const el = layer && layer.querySelector(`.pe-obj[data-id="${m.id}"]`);
    if (el) el.style.top = `${m.y * S.zoom}px`;
    (S.flowed || (S.flowed = new Set())).add(m.id);
  }
}
// Where the text in an element has to be cut so that it ends above `limit` (page points).
function cutAt(o, limit) {
  const walker = document.createTreeWalker(o, NodeFilter.SHOW_TEXT);
  const pageTop = o.closest('.pe-page').getBoundingClientRect().top;
  const r = document.createRange();
  let off = 0, node;
  while ((node = walker.nextNode())) {
    for (let i = 0; i < node.length; i++) {
      r.setStart(node, i); r.setEnd(node, i + 1);
      const b = r.getBoundingClientRect();
      if (b.height && (b.bottom - pageTop) / S.zoom > limit) return textOffset(o, node, i);
    }
    off += node.length;
  }
  return -1;
}
// After editing: move what runs past the bottom of the page to the next page.
function spillOver(p, it, el) {
  const [W, H] = viewSize(p);
  const limit = H - 28, topM = 36;
  const flowed = S.flowed || new Set();
  S.flowed = null;
  const out = [];
  // the edited text itself: split it at the last line that fits
  if (it && it.wrap && it.y + it.h > limit && el) {
    if (it.y >= limit - it.size * LINE) out.push(it);
    else {
      let cut = cutAt(el, limit);
      const full = it.text;
      if (cut > 0 && cut < full.length) {
        const ws = Math.max(full.lastIndexOf('\n', cut), full.lastIndexOf(' ', cut));
        if (ws > 0) cut = ws;
        const rest = full.slice(cut).replace(/^\s+/, '');
        it.text = full.slice(0, cut).replace(/\s+$/, '');
        it.h = Math.max(it.size * LINE, (limit - it.y));
        if (rest) out.push({ ...JSON.parse(JSON.stringify(it)), id: uid(), text: rest, y: it.y + it.h });
      }
    }
  }
  for (const o of p.items) if (o !== it && flowed.has(o.id) && itemBottom(o) > limit) out.push(o);
  if (!out.length) return;
  // the next page made for overflow, or a new one with this page's background
  const i = pageIndex(p.id);
  let next = S.pages[i + 1];
  if (!next || next.flowFrom !== p.id) {
    next = blankPage(W, H);
    next.flowFrom = p.id;
    next.items = p.items.filter((o) => !o.hidden && isBackdrop(o, W, H)).map((o) => ({ ...JSON.parse(JSON.stringify(o)), id: uid() }));
    S.pages.splice(i + 1, 0, next);
  }
  const startY = Math.min(...out.map(itemTop));
  // below what is already on that page in these columns
  const L = Math.min(...out.map(itemLeft)), R = Math.max(...out.map(itemRight));
  const there = next.items.filter((o) => !isBackdrop(o, W, H) && itemLeft(o) < R && itemRight(o) > L);
  const at = there.length ? Math.max(...there.map(itemBottom)) + 14 : topM;
  const dy = at - startY;
  p.items = p.items.filter((o) => !out.includes(o));
  for (const o of out) {
    o.y += dy;
    if (isLine(o)) { o.y1 += dy; o.y2 += dy; }
    next.items.push(o);
  }
  // still too long: carry on to the page after
  const more = next.items.filter((o) => !isBackdrop(o, W, H) && itemBottom(o) > limit && out.includes(o));
  if (more.length && next.items.length < 400) { S.flowed = new Set(more.map((o) => o.id)); spillOver(next, null, null); }
  return true;
}

// ------------------------------------------------------------- paragraphs --
// A text box shows each line of its text (each paragraph) as its own block, so the space between
// paragraphs (ps, points) and list items with a hanging indent (wrapped lines start under the
// text, not under the bullet) look the same on screen and in the PDF.
let measureCtx = null;
function markerWidth(it, marker) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `${it.italic ? 'italic ' : ''}${it.bold ? '700 ' : '400 '}${it.size}px ${cssFamily(it.font)}`;
  return measureCtx.measureText(marker).width;
}
function fillText(o, it, z) {
  o.textContent = '';
  const ps = (it.ps || 0) * z;
  (it.text || '').split('\n').forEach((line, i) => {
    const d = document.createElement('div');
    d.className = 'pe-para';
    if (i && ps) d.style.marginTop = `${ps}px`;
    const m = it.wrap ? LIST_RE.exec(line) : null;
    if (m) { const mw = markerWidth(it, m[1]) * z; d.style.paddingLeft = `${mw}px`; d.style.textIndent = `${-mw}px`; }
    if (line) d.textContent = line; else d.append(document.createElement('br'));
    o.append(d);
  });
}
// Caret position <-> offset in the text (paragraphs joined by \n).
function textOffset(o, node, off) {
  const r = document.createRange(); r.selectNodeContents(o); r.setEnd(node, off);
  const tmp = document.createElement('div'); tmp.append(r.cloneContents());
  return readText(tmp, true).length;
}
function caretRange(o) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !o.contains(sel.anchorNode)) { const n = (o.textContent && readText(o).length) || 0; return [n, n]; }
  const r = sel.getRangeAt(0);
  const a = textOffset(o, r.startContainer, r.startOffset), b = textOffset(o, r.endContainer, r.endOffset);
  return [Math.min(a, b), Math.max(a, b)];
}
function placeCaretAt(o, pos) {
  const paras = [...o.querySelectorAll('.pe-para')];
  const r = document.createRange();
  for (const d of paras) {
    const len = d.textContent.length;
    if (pos <= len) {
      const t = d.firstChild;
      if (t && t.nodeType === 3) r.setStart(t, pos); else r.setStart(d, 0);
      r.collapse(true);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      return;
    }
    pos -= len + 1;
  }
  r.selectNodeContents(o); r.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
}
// Replace the text while typing (Enter, paste) and redraw the paragraphs with the caret kept.
function setEditedText(o, it, text, caret) {
  it.text = text;
  fillText(o, it, S.zoom);
  placeCaretAt(o, caret);
  flowWhileTyping(o, it);
  it.w = o.offsetWidth / S.zoom; it.h = o.offsetHeight / S.zoom;
}
// Enter: a new paragraph; in a list, the next bullet or number (Enter on an empty item ends the
// list). Shift+Enter: a new line without a bullet.
function onEnter(e, o, it) {
  e.preventDefault();
  const [a, b] = caretRange(o);
  const t = readText(o);
  const ls = t.lastIndexOf('\n', a - 1) + 1;
  let le = t.indexOf('\n', a); if (le < 0) le = t.length;
  const line = t.slice(ls, le), m = e.shiftKey ? null : /^(\u2022 |(\d+)\.\s)/.exec(line);
  if (m && !line.slice(m[0].length).trim() && a === b) {
    setEditedText(o, it, t.slice(0, ls) + t.slice(ls + m[0].length), ls);
    return;
  }
  const ins = `\n${m ? (m[2] ? `${Number(m[2]) + 1}. ` : BULLET) : ''}`;
  setEditedText(o, it, t.slice(0, a) + ins + t.slice(b), a + ins.length);
}
function onPasteText(e, o, it) {
  e.preventDefault();
  const txt = ((e.clipboardData || window.clipboardData).getData('text/plain') || '').replace(/\r\n?/g, '\n');
  const [a, b] = caretRange(o), t = readText(o);
  setEditedText(o, it, t.slice(0, a) + txt + t.slice(b), a + txt.length);
}

// ------------------------------------------------------------------ lists --
// A list is ordinary text whose lines start with "• " or "1. ", so it looks the same everywhere
// (screen, PDF, other programs). The buttons add or remove the markers on every line; Enter on a
// list line starts the next item, and Enter on an empty item ends the list.
const BULLET = '\u2022 ';
const LIST_RE = /^(\u2022 |\d+\.\s)/;
function listKind(text) {
  const ls = text.split('\n').filter((l) => l.trim());
  if (!ls.length) return '';
  if (ls.every((l) => l.startsWith(BULLET))) return 'bullet';
  if (ls.every((l) => /^\d+\.\s/.test(l))) return 'number';
  return '';
}
function applyList(text, kind) {
  let n = 0;
  return text.split('\n').map((l) => {
    if (!l.trim()) return l;
    const b = l.replace(LIST_RE, '');
    return kind === 'bullet' ? BULLET + b : kind === 'number' ? `${++n}. ${b}` : b;
  }).join('\n');
}
const renumber = (text) => (listKind(text) === 'number' ? applyList(text, 'number') : text);
function toggleList(kind) {
  const it = itemOf(S.sel);
  if (!it || it.type !== 'text') return;
  const p = pageById(S.sel.page);
  snapshot();
  const oldH = it.h;
  it.text = applyList(it.text || '', listKind(it.text || '') === kind ? '' : kind);
  if (!it.wrap) giveWrap(p, it);
  const wasEditing = S.editing === it.id;
  drawItems(pageIndex(p.id));
  reflowAfter(p, it, it.y + oldH);
  if (wasEditing) { const o = $(`.pe-obj[data-id="${it.id}"]`); if (o) { o.focus(); const r = document.createRange(); r.selectNodeContents(o); r.collapse(false); const sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(r); } }
  updateProps();
}
// After a text changed height outside typing (list, resize): move what is under it, then spill.
function reflowAfter(p, it, oldBottom) {
  const dy = it.y + it.h - oldBottom;
  if (!it.wrap || Math.abs(dy) < 0.5) return;
  const moved = flowBelow(p, it, oldBottom, dy);
  if (!moved.length) return;
  S.flowed = new Set(moved.map((m) => m.id));
  if (spillOver(p, null, null)) rebuild(); else drawItems(pageIndex(p.id));
}

// The text of an edited box. innerText adds extra blank lines when the browser wraps pasted or
// typed lines in <div>s, so the lines are read from the nodes: a block starts a new line, <br> is one.
function readText(el, keepEnd) {
  let out = '';
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) out += c.data;
      else if (c.nodeName === 'BR') out += '\n';
      else if (c.nodeType === 1) {
        const block = /^(DIV|P|LI)$/.test(c.nodeName);
        if (block && out && !out.endsWith('\n')) out += '\n';
        walk(c);
      }
    }
  };
  walk(el);
  return keepEnd ? out : out.replace(/\n$/, '');
}


// ------------------------------------------------------ saved in this browser --
// Uploads (pictures added before, ready to use again) and Projects (every design, saved
// automatically as you work) live in this browser's IndexedDB: no account or server needed.
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('flipit-editor', 1);
        r.onupgradeneeded = () => { const d = r.result; for (const st of ['uploads', 'projects']) if (!d.objectStoreNames.contains(st)) d.createObjectStore(st, { keyPath: 'id' }); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  }
  return dbp;
}
async function dbDo(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
  });
}
const dbAll = (st) => dbDo(st, 'readonly', (o) => o.getAll()).catch(() => []);
const dbPut = (st, v) => dbDo(st, 'readwrite', (o) => o.put(v)).catch((e) => console.warn('Could not save', e));
const dbDel = (st, id) => dbDo(st, 'readwrite', (o) => o.delete(id)).catch(() => {});
function hashStr(str) {
  let h = 0;
  const step = Math.max(1, Math.floor(str.length / 4000));
  for (let i = 0; i < str.length; i += step) h = (h * 31 + str.charCodeAt(i)) | 0;
  return `${str.length}-${h >>> 0}`;
}
const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

// Uploads ----------------------------------------------------------------------
async function saveUpload(a, name) {
  await dbPut('uploads', { id: hashStr(a.url), url: a.url, mime: a.mime, w: a.w, h: a.h, name, t: Date.now() });
  const pane = $('[data-pane="uploads"]');
  if (pane && !pane.hidden) renderUploads();
}
async function renderUploads() {
  const box = $('#peUploads');
  if (!box) return;
  const list = (await dbAll('uploads')).sort((a, b) => b.t - a.t);
  box.textContent = '';
  if (!list.length) { box.innerHTML = '<p class="pe-side-empty">Pictures you upload appear here, ready to use again in any design.</p>'; return; }
  for (const u of list) {
    const el = document.createElement('div');
    el.className = 'pe-upload';
    el.innerHTML = '<button type="button" class="pe-upload-use" title="Add to the page"><img alt=""></button><button type="button" class="pe-upload-del" title="Remove from uploads" aria-label="Remove from uploads">&times;</button>';
    el.querySelector('img').src = u.url;
    el.querySelector('.pe-upload-use').addEventListener('click', () => useUpload(u));
    el.querySelector('.pe-upload-del').addEventListener('click', async () => { await dbDel('uploads', u.id); renderUploads(); });
    box.append(el);
  }
}
async function useUpload(u) {
  let a;
  try { a = await addAsset(u.url); } catch (e) { toast(e.message, true); return; }
  const it = itemOf(S.sel);
  // a selected photo circle or picture takes it; otherwise it is placed on the page
  if (it && it.photo && it.type === 'ellipse') applyPick({ mode: 'photo', page: S.sel.page, id: it.id }, a);
  else if (it && it.type === 'image') applyPick({ mode: 'item', sel: { ...S.sel } }, a);
  else placeAsset(a, viewSize(S.pages[S.current])[0] * 0.6);
}

// Projects ---------------------------------------------------------------------
let saveT = 0;
function scheduleSave() { S.unsaved = true; clearTimeout(saveT); saveT = setTimeout(saveProject, 1500); }
async function miniThumb(p) {
  const [vw, vh] = viewSize(p);
  const W = 150, k = W / vw;
  const c = document.createElement('canvas'); c.width = W; c.height = Math.round(vh * k);
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  const pc = p.src && $(`.pe-page[data-id="${p.id}"] canvas`);
  if (pc && pc.width > 4) x.drawImage(pc, 0, 0, c.width, c.height);
  for (const it of p.items) {
    if (it.hidden) continue;
    x.globalAlpha = (it.opacity ?? 100) / 100;
    if (it.type === 'rect' || it.type === 'whiteout') { if (it.fillOn || it.type === 'whiteout') { x.fillStyle = it.type === 'whiteout' ? it.color : it.fill; x.fillRect(it.x * k, it.y * k, it.w * k, it.h * k); } }
    else if (it.type === 'ellipse') { x.beginPath(); x.ellipse((it.x + it.w / 2) * k, (it.y + it.h / 2) * k, it.w * k / 2, it.h * k / 2, 0, 0, Math.PI * 2); if (it.fillOn) { x.fillStyle = it.fill; x.fill(); } else { x.strokeStyle = it.color; x.stroke(); } }
    else if (isLine(it)) { x.strokeStyle = it.color; x.lineWidth = Math.max(0.5, (it.width || 1) * k); x.beginPath(); x.moveTo(it.x1 * k, it.y1 * k); x.lineTo(it.x2 * k, it.y2 * k); x.stroke(); }
    else if (it.type === 'text') {
      x.fillStyle = it.color; x.font = `${it.italic ? 'italic ' : ''}${it.bold ? '700 ' : ''}${Math.max(1, it.size * k)}px ${cssFamily(it.font)}`; x.textBaseline = 'top';
      (it.caps ? it.text.toUpperCase() : it.text).split('\n').forEach((l, i) => x.fillText(l, it.x * k, (it.y + i * it.size * (it.lh || LINE)) * k, (it.wrap || 1e4) * k));
    } else if (it.type === 'image') {
      const a = S.assets.get(it.asset);
      if (a) {
        try {
          const im = await loadImg(a.url);
          x.save(); if (it.clip === 'ellipse') { x.beginPath(); x.ellipse((it.x + it.w / 2) * k, (it.y + it.h / 2) * k, it.w * k / 2, it.h * k / 2, 0, 0, Math.PI * 2); x.clip(); }
          const r = it.clip ? photoRect(it, a) : { x: 0, y: 0, w: it.w, h: it.h };
          x.drawImage(im, (it.x + r.x) * k, (it.y + r.y) * k, r.w * k, r.h * k); x.restore();
        } catch { /* skip the picture */ }
      }
    }
  }
  x.globalAlpha = 1;
  return c.toDataURL('image/jpeg', 0.75);
}
async function saveProject() {
  if (!S.unsaved || $('#peApp').hidden || !S.pages.length || !S.pages.some((p) => p.src || p.items.length)) return;
  const pl = projectPayload();
  if (!pl) return;
  S.unsaved = false;
  if (!S.projectId) S.projectId = uid();
  let thumb = '';
  try { thumb = await miniThumb(S.pages[0]); } catch { /* no preview */ }
  await dbPut('projects', { id: S.projectId, title: pl.proj.title || 'Untitled design', updated: Date.now(), pages: S.pages.length, thumb, proj: pl.proj, sources: pl.sources.map((b) => b.slice()) });
  const all = await dbAll('projects');
  if (all.length > 30) for (const r of all.sort((a, b) => b.updated - a.updated).slice(30)) await dbDel('projects', r.id);
  const pane = $('[data-pane="projects"]');
  if (pane && !pane.hidden) renderProjects();
}
async function renderProjects() {
  const list = (await dbAll('projects')).sort((a, b) => b.updated - a.updated);
  $('#peRecent').hidden = !list.length;
  for (const box of $$('[data-projects]')) {
    box.textContent = '';
    if (!list.length) { box.innerHTML = '<p class="pe-side-empty">Designs you make are saved here automatically.</p>'; continue; }
    for (const r of list.slice(0, box.dataset.projects === 'start' ? 8 : 30)) {
      const el = document.createElement('div');
      el.className = `pe-proj${r.id === S.projectId && !$('#peApp').hidden ? ' current' : ''}`;
      el.innerHTML = '<button type="button" class="pe-proj-open"><span class="pe-proj-thumb"><img alt=""></span><strong></strong><span></span></button><button type="button" class="pe-proj-del" title="Delete this design" aria-label="Delete this design">&times;</button>';
      if (r.thumb) el.querySelector('img').src = r.thumb;
      el.querySelector('strong').textContent = r.title;
      el.querySelector('.pe-proj-open > span:last-child').textContent = `${r.pages} page${r.pages > 1 ? 's' : ''} · ${ago(r.updated)}`;
      el.querySelector('.pe-proj-open').addEventListener('click', () => openSaved(r));
      el.querySelector('.pe-proj-del').addEventListener('click', async () => {
        if (!window.confirm(`Delete "${r.title}" from this browser?`)) return;
        await dbDel('projects', r.id);
        if (S.projectId === r.id) S.projectId = null;
        renderProjects();
      });
      box.append(el);
    }
  }
}
async function openSaved(r) {
  if (S.projectId === r.id && !$('#peApp').hidden) return;
  if (S.unsaved) await saveProject();
  busy(true, 'Opening your design…');
  try {
    finishEditing();
    if (await applyProject(r.proj, r.sources || [], r.title)) { S.projectId = r.id; toast(`Opened "${r.title}".`); renderProjects(); }
    else toast('This design could not be opened.', true);
  } catch (e) { toast(e.message || 'This design could not be opened.', true); } finally { busy(false); }
}
function showSide(tab) {
  const side = $('.pe-side');
  side.dataset.tab = tab;
  $$('[data-side]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.side === tab)));
  $$('.pe-side-pane').forEach((pn) => { pn.hidden = pn.dataset.pane !== tab; });
  if (tab === 'uploads') renderUploads();
  if (tab === 'projects') renderProjects();
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
    scheduleSave();
    it.text = readText(o);
    flowWhileTyping(o, it);
    it.w = o.offsetWidth / S.zoom; it.h = o.offsetHeight / S.zoom;
  };
  o.onblur = () => setTimeout(() => { if (S.editing === it.id && document.activeElement !== o) finishEditing(); }, 0);
  o.onpaste = (e) => onPasteText(e, o, it);
  o.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); o.blur(); finishEditing(); return; }
    if (e.key === 'Enter') onEnter(e, o, it);
  };
}
function editText(pageId, it) {
  const o = $(`.pe-page[data-id="${pageId}"] .pe-obj[data-id="${it.id}"]`);
  if (!o) return;
  if (S.editing !== it.id) {
    snapshot(); S.sel = { page: pageId, id: it.id };
    const p = pageById(pageId);
    if (p && !it.wrap) { giveWrap(p, it); if (it.wrap) { o.classList.add('pe-wrap'); o.style.width = `${it.wrap * S.zoom}px`; o.style.left = `${it.x * S.zoom}px`; it.w = it.wrap; } }
    S.flowB = it.y + o.offsetHeight / S.zoom; // the things below are placed for this bottom
  }
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
    if (it.text) it.text = renumber(it.text);
    if (!it.text || !it.text.trim()) {
      p.items = p.items.filter((i) => i !== it);
      if (S.sel && S.sel.id === id) S.sel = null;
    }
    // the box as it is drawn now (not while typing) decides where the things below go
    const flowB = S.flowB; S.flowB = null;
    if (flowB != null && it.wrap && p.items.includes(it)) {
      drawItems(pageIndex(p.id));
      const dy = it.y + it.h - flowB;
      if (Math.abs(dy) >= 0.5) for (const m of flowBelow(p, it, flowB, dy)) (S.flowed || (S.flowed = new Set())).add(m.id);
    }
    const el = $(`.pe-page[data-id="${p.id}"] .pe-obj[data-id="${it.id}"]`);
    if (spillOver(p, p.items.includes(it) ? it : null, el)) {
      if (S.sel && !p.items.some((x) => x.id === S.sel.id)) S.sel = null;
      rebuild();
      toast('The text no longer fitted on the page, so the rest moved to the next page.');
    } else drawItems(pageIndex(p.id));
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

// Lines, boxes and drawings of the PDF itself (its vector paths), in view points, with their
// colour: so Select can pick them up like any object (a heading's underline, a coloured box).
async function vectorRuns(p) {
  const key = runKey('vector', p);
  if (S.runs.has(key)) return S.runs.get(key);
  if (!p.src) { S.runs.set(key, []); return []; }
  const L = await lib();
  const page = await pdfPage(p);
  const vp = page.getViewport({ scale: 1, rotation: rotOf(p) });
  const ops = await page.getOperatorList();
  const O = L.OPS;
  const [vw, vh] = viewSize(p);
  const runs = [];
  let ctm = [1, 0, 0, 1, 0, 0], fill = '#000000', stroke = '#000000', lw = 1;
  const stack = [];
  const STROKE = new Set([O.stroke, O.closeStroke]), FILL = new Set([O.fill, O.eoFill, O.fillStroke, O.eoFillStroke, O.closeFillStroke, O.closeEOFillStroke]);
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i];
    if (fn === O.save) stack.push([ctm, fill, stroke, lw]);
    else if (fn === O.restore) [ctm, fill, stroke, lw] = stack.pop() || [[1, 0, 0, 1, 0, 0], '#000000', '#000000', 1];
    else if (fn === O.transform) ctm = L.Util.transform(ctm, a);
    else if (fn === O.paintFormXObjectBegin) { stack.push([ctm, fill, stroke, lw]); if (a && a[0]) ctm = L.Util.transform(ctm, a[0]); }
    else if (fn === O.paintFormXObjectEnd) [ctm, fill, stroke, lw] = stack.pop() || [ctm, fill, stroke, lw];
    else if (fn === O.setFillRGBColor && typeof a[0] === 'string') fill = a[0];
    else if (fn === O.setStrokeRGBColor && typeof a[0] === 'string') stroke = a[0];
    else if (fn === O.setLineWidth) lw = a[0];
    else if (fn === O.constructPath) {
      const [op, data, mm] = a;
      const isStroke = STROKE.has(op), isFill = FILL.has(op);
      if ((!isStroke && !isFill) || !mm) continue;
      const m = L.Util.transform(vp.transform, ctm);
      const sc = Math.hypot(m[0], m[1]) || 1;
      const half = isStroke ? (lw * sc) / 2 : 0;
      const pts = [[mm[0], mm[1]], [mm[2], mm[1]], [mm[0], mm[3]], [mm[2], mm[3]]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const x = clamp(Math.min(...xs) - half, 0, vw), y = clamp(Math.min(...ys) - half, 0, vh);
      const w = clamp(Math.max(...xs) + half, 0, vw) - x, h = clamp(Math.max(...ys) + half, 0, vh) - y;
      if (w < 0.5 || h < 0.5 || (w < 3 && h < 3) || w * h > vw * vh * 0.5) continue; // specks and page backgrounds
      // only straight lines (no curves) with a few corners: a line or a box we can redraw exactly
      const path = data && data[0];
      let plain = false;
      if (path && typeof path.length === 'number' && !(m[1] || m[2])) {
        plain = true; let n = 0;
        for (let k = 0; k < path.length;) {
          const c = path[k++];
          if (c === 0 || c === 1) { k += 2; n++; } else if (c === 4) { /* close */ } else { plain = false; break; }
        }
        if (n > 5) plain = false;
      }
      const thin = Math.min(w, h) <= Math.max(3, half * 2 + 0.5);
      const kind = thin && plain ? 'line' : plain && isFill && !isStroke ? 'box' : 'art';
      if (runs.some((r) => Math.abs(r.x - x) < 0.5 && Math.abs(r.y - y) < 0.5 && Math.abs(r.w - w) < 0.5 && Math.abs(r.h - h) < 0.5)) continue;
      runs.push({ x, y, w, h, top: y, kind, color: isFill ? fill : stroke, lw: thin ? (isStroke ? lw * sc : Math.min(w, h)) : lw * sc });
    }
  }
  S.runs.set(key, runs);
  return runs;
}

// What of the PDF itself is under the pointer for Select: a paragraph, else the smallest
// line, box, drawing or image (thin lines are easy to hit: a few pixels around them count).
function pdfThingAt(p, pt) {
  const g = groupAt(p, pt);
  if (g) return { kind: 'text', ...g };
  const tol = 4 / S.zoom;
  const all = [...(S.runs.get(runKey('vector', p)) || []), ...(S.runs.get(runKey('editimage', p)) || []).map((r) => ({ ...r, kind: 'image' }))];
  const covers = p.items.filter((o) => o.cover);
  return all.filter((r) => pt.x >= r.x - tol && pt.x <= r.x + r.w + tol && pt.y >= r.y - tol && pt.y <= r.y + r.h + tol)
    .filter((r) => !covers.some((c) => c.x <= r.x + 0.5 && c.y <= r.y + 0.5 && c.x + c.w >= r.x + r.w - 0.5 && c.y + c.h >= r.y + r.h - 0.5))
    .sort((a, b) => a.w * a.h - b.w * b.h)[0] || null;
}
const pdfRunsReady = (p) => ['edittext', 'vector', 'editimage'].every((k) => S.runs.has(k === 'edittext' ? `groups:${runKey(k, p)}` : runKey(k, p)));
function loadPdfRuns(p) { textGroups(p); vectorRuns(p).catch((e) => { console.warn(e); S.runs.set(runKey('vector', p), []); }); imageRuns(p).catch(() => S.runs.set(runKey('editimage', p), [])); }

// Turn a line, box, drawing or image of the PDF into an object of its own: the original is
// covered in the colour around it and an exact copy (or a cut-out picture) goes on top.
async function liftPdfThing(p, r) {
  const col = pageColors(p, r) || { bg: '#ffffff' };
  const cover = { id: uid(), type: 'whiteout', color: col.bg, opacity: 100, cover: true, x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 };
  let it;
  if (r.kind === 'line') {
    const wide = r.w >= r.h, lw = Math.max(0.3, Math.round(r.lw * 100) / 100);
    it = wide ? { x1: r.x, y1: r.y + r.h / 2, x2: r.x + r.w, y2: r.y + r.h / 2 } : { x1: r.x + r.w / 2, y1: r.y, x2: r.x + r.w / 2, y2: r.y + r.h };
    it = { id: uid(), type: 'line', ...DEFAULTS.line, ...it, color: r.color, width: lw };
    lineBox(it);
  } else if (r.kind === 'box') {
    it = { id: uid(), type: 'rect', ...DEFAULTS.rect, x: r.x, y: r.y, w: r.w, h: r.h, fillOn: true, fill: r.color, color: r.color, width: 0.1 };
  } else {
    const a = await addAsset(await cropPage(p, r));
    it = { id: uid(), type: 'image', asset: a.id, opacity: 100, x: r.x, y: r.y, w: r.w, h: r.h };
  }
  snapshot();
  p.items.push(cover, it);
  drawItems(pageIndex(p.id));
  return it;
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

// "Edit text" shows (and hovers) whole paragraphs and lists, the way clicking picks them up.
async function textGroups(p) {
  const key = `groups:${runKey('edittext', p)}`;
  if (S.runs.has(key)) return S.runs.get(key);
  const merged = mergeLines(await textRuns(p)).sort((a, b) => a.base - b.base);
  const done = new Set(), groups = [];
  for (const line of merged) {
    if (done.has(line)) continue;
    const g = paragraphRuns(merged, line).filter((r) => !done.has(r));
    if (!g.includes(line)) g.push(line);
    g.forEach((r) => done.add(r));
    const x = Math.min(...g.map((r) => r.x)), top = Math.min(...g.map((r) => r.top));
    groups.push({ x, top, w: Math.max(...g.map((r) => r.x + r.w)) - x, h: Math.max(...g.map((r) => r.top + r.h)) - top });
  }
  S.runs.set(key, groups);
  return groups;
}
const RUNS = { edittext: textGroups, editimage: imageRuns };
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
  applyPick(pick, a);
}
function applyPick(pick, a) {
  if (pick.mode === 'pdf') {
    const p = pageById(pick.target.page);
    if (!p) return;
    snapshot();
    const it = { id: uid(), type: 'image', asset: a.id, opacity: 100, ...fitInto(a, pick.target.box) };
    p.items.push(coverFor(pick.target.box), it);
    setTool('select');
    drawItems(pageIndex(p.id)); select(p.id, it.id);
  } else if (pick.mode === 'photo') {
    // a template's photo circle: the picture takes its place, and the PHOTO / initials text on it goes
    const p = pageById(pick.page), sh = p && p.items.find((o) => o.id === pick.id);
    if (!sh) return;
    snapshot();
    const onIt = (o) => {
      if (o.type !== 'text') return false;
      const cx = o.align === 'center' && o.ax !== undefined ? o.ax : o.x + o.w / 2, cy = o.y + o.h / 2;
      return cx > sh.x && cx < sh.x + sh.w && cy > sh.y && cy < sh.y + sh.h && o.w <= sh.w && o.h <= sh.h;
    };
    const outline = sh.width > 0 && !(sh.fillOn && sh.fill === sh.color);
    const it = { id: uid(), type: 'image', asset: a.id, opacity: 100, x: sh.x, y: sh.y, w: sh.w, h: sh.h, rot: sh.rot || 0,
      clip: 'ellipse', r: 0, sw: outline ? sh.width : 0, stroke: sh.color, photo: true, fx: 0.5, fy: 0.5, fz: 1 };
    p.items.splice(p.items.indexOf(sh), 1, it);
    p.items = p.items.filter((o) => !onIt(o));
    setTool('select');
    drawItems(pageIndex(p.id)); select(p.id, it.id);
    toast('Drag the photo to place your face in the circle. Zoom with the slider, the mouse wheel or two fingers.');
  } else if (pick.mode === 'item') {
    const it = itemOf(pick.sel);
    if (!it) return;
    snapshot();
    if (it.clip) Object.assign(it, { asset: a.id, fx: 0.5, fy: 0.5, fz: 1 });
    else Object.assign(it, { asset: a.id }, fitInto(a, { x: it.x, y: it.y, w: it.w, h: it.h }));
    drawItems(pageIndex(pick.sel.page)); select(pick.sel.page, it.id);
  }
}

// The page's own colours around and inside a box (from the rendered page): the background, to
// cover old text with, and the text colour, so edited text keeps its look (blue, grey, white
// on a dark sidebar ...).
function pageColors(p, box) {
  try {
    const cv = $(`.pe-page[data-id="${p.id}"] canvas`);
    const [vw] = viewSize(p);
    if (!cv || cv.width < 4) return null;
    const k = cv.width / vw;
    const x0 = Math.max(0, Math.floor((box.x - 2) * k)), y0 = Math.max(0, Math.floor((box.y - 2) * k));
    const w = Math.min(cv.width - x0, Math.ceil((box.w + 4) * k)), h = Math.min(cv.height - y0, Math.ceil((box.h + 4) * k));
    if (w < 2 || h < 2) return null;
    const d = cv.getContext('2d').getImageData(x0, y0, w, h).data;
    const px = (i) => [d[i], d[i + 1], d[i + 2]];
    const q = (c) => c.map((v) => v >> 4).join(',');
    const tally = new Map(), border = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x > 1 && y > 1 && x < w - 2 && y < h - 2) continue;
      const c = px((y * w + x) * 4); border.push(c);
      tally.set(q(c), (tally.get(q(c)) || 0) + 1);
    }
    const bgKey = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const bg = border.find((c) => q(c) === bgKey);
    const dist = (c) => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
    let best = null, bd = 0;
    for (let i = 0; i < d.length; i += 4) { const c = px(i), dd = dist(c); if (dd > bd) { bd = dd; best = c; } }
    const fg = best; // the strongest pixel is the text colour (the rest is anti-aliased edges)
    const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    return { bg: hex(bg), fg: fg && bd > 60 ? hex(fg) : null };
  } catch { return null; }
}

// The lines of the paragraph (or list) around a clicked line: the same font and size, close
// under each other and starting near the same left edge. Returns them top to bottom.
// Pieces of text on the same line with the same style become one line.
function mergeLines(runs) {
  const out = [];
  const sorted = [...runs].sort((a, b) => a.base - b.base || a.x - b.x);
  for (const r of sorted) {
    const prev = out.find((o) => Math.abs(o.base - r.base) < r.size * 0.3 && Math.abs(o.size - r.size) < 0.6 && o.bold === r.bold && o.italic === r.italic && o.font === r.font
      && r.x >= o.x + o.w - r.size * 0.2 && r.x - (o.x + o.w) < r.size * 1.2);
    if (prev) {
      const gap = r.x - (prev.x + prev.w);
      prev.str += (gap > r.size * 0.15 && !/\s$/.test(prev.str) && !/^\s/.test(r.str) ? ' ' : '') + r.str;
      prev.w = r.x + r.w - prev.x;
      prev.parts.push(r);
    } else out.push({ ...r, parts: [r] });
  }
  return out;
}
function paragraphRuns(runs, run) {
  const same = (r) => Math.abs(r.size - run.size) < 0.6 && r.bold === run.bold && r.italic === run.italic && r.font === run.font;
  const near = (a, b) => b.x >= a.x - run.size * 1.5 && b.x <= a.x + run.size * 2.5; // list lines hang a little to the right
  // a heading in capitals (CONTACT, SKILLS) is not part of the text under it
  const caps = (r) => { const l = r.str.replace(/[^A-Za-z]/g, ''); return l.length > 2 && l === l.toUpperCase(); };
  const sameKind = (a, b) => caps(a) === caps(b);
  const pool = runs.filter((r) => same(r) && r.str.trim()).sort((a, b) => a.top - b.top);
  const out = [run];
  const step = (a, b) => b.base - a.base;
  for (let cur = run; ;) { // down
    const nx = pool.find((r) => r.top > cur.top + cur.h * 0.5 && step(cur, r) <= run.size * 2.6 && near(out[0], r) && sameKind(cur, r) && !out.includes(r));
    if (!nx) break;
    out.push(nx); cur = nx;
  }
  for (let cur = run; ;) { // up
    const pv = [...pool].reverse().find((r) => r.top < cur.top - cur.h * 0.5 && step(r, cur) <= run.size * 2.6 && near(out[0], r) && sameKind(cur, r) && !out.includes(r));
    if (!pv) break;
    out.unshift(pv); cur = pv;
  }
  out.sort((a, b) => a.base - b.base);
  // a list: start at its first item (a company name or heading just above it is not part of it)
  const isItem = (r) => /^\s*(\u2022|[-\u2013*\u25CF\u25AA]|\d+[.)])\s/.test(r.str);
  const first = out.findIndex(isItem);
  if (first > 0 && out.indexOf(run) >= first) out.splice(0, first);
  else if (first > 0) out.splice(first);
  return out;
}
async function editRunAt(p, pt, { edit = true } = {}) {
  const runs = await textRuns(p);
  const merged = mergeLines(runs);
  const run = merged.find((r) => pt.x >= r.x - 1 && pt.x <= r.x + r.w + 1 && pt.y >= r.top - 1 && pt.y <= r.top + r.h + 1);
  if (!run) { if (edit) toast('Click on a line of text in the PDF to change it.'); return null; }
  snapshot();
  const lines = paragraphRuns(merged, run);
  const size = Math.round(run.size * 10) / 10;
  if (!isStd(run.font)) await ensureFont(run.font, run.bold, run.italic);
  // one text box for the whole paragraph: lines that wrapped are joined again, a bullet or a
  // bigger gap starts a new line, and that gap becomes the space between paragraphs
  const steps = lines.slice(1).map((r, i) => r.base - lines[i].base);
  const lineStep = steps.length ? Math.min(...steps) : size * LINE;
  let text = lines[0].str.trim(), extra = [];
  for (let i = 1; i < lines.length; i++) {
    const st = lines[i].str.trim(), gap = steps[i - 1];
    const newItem = /^(•|[-–*●▪]|\d+[.)])\s/.test(st);
    if (gap > lineStep * 1.35) { text += `\n${st}`; extra.push(gap - lineStep); } else if (newItem) text += `\n${st}`; else text += `${/-$/.test(text) ? '' : ' '}${st}`;
  }
  text = text.replace(/^[●▪*-]\s/gm, BULLET);
  const left = Math.min(...lines.map((r) => r.x)), right = Math.max(...lines.map((r) => r.x + r.w));
  const all = { x: left, y: Math.min(...lines.map((r) => r.top)), w: right - left, h: Math.max(...lines.map((r) => r.top + r.h)) - Math.min(...lines.map((r) => r.top)) };
  const col = pageColors(p, all) || { bg: '#ffffff', fg: null };
  // the old lines are covered in the page's own background colour; these covers never move
  const covers = lines.map((r) => ({ id: uid(), type: 'whiteout', color: col.bg, opacity: 100, cover: true, x: r.x - 1, y: r.top - 1, w: r.w + 2, h: r.h + 2 }));
  const lh = lines.length > 1 ? Math.round((lineStep / size) * 100) / 100 : undefined;
  const t = { id: uid(), type: 'text', text, font: run.font, size, bold: run.bold, italic: run.italic, underline: false, align: 'left', color: col.fg || '#000000', opacity: 100,
    x: left, y: lines[0].base - baselineOffset(run.font, size, lh || LINE), w: right - left, h: lines[lines.length - 1].top + lines[lines.length - 1].h - lines[0].top };
  if (lines.length > 1) { t.wrap = Math.round(right - left + 2); t.lh = lh; if (extra.length) t.ps = Math.round(extra.reduce((a, b) => a + b, 0) / extra.length); }
  p.items.push(...covers, t);
  drawItems(pageIndex(p.id));
  S.sel = { page: p.id, id: t.id };
  if (!edit) return t;
  editText(p.id, t);
  if (lines.length > 1) toast(`Editing the whole paragraph (${lines.length} lines). Lines wrap inside the box; drag its sides to change the width.`);
}

// ------------------------------------------------------------ hover --
// In Select, whatever is under the pointer gets a thin outline (an object, or a paragraph of the
// PDF's own text), so it is clear what a click picks up: one click on text starts typing.
function groupAt(p, pt) {
  const runs = S.runs.get(`groups:${runKey('edittext', p)}`) || [];
  return runs.filter((r) => pt.x >= r.x - 1 && pt.x <= r.x + r.w + 1 && pt.y >= r.top - 1 && pt.y <= r.top + r.h + 1)
    .sort((a, b) => a.w * a.h - b.w * b.h)[0] || null;
}
function hoverOff() {
  $$('.pe-hover').forEach((o) => o.classList.remove('pe-hover'));
  $$('.pe-hoverbox').forEach((o) => o.remove());
}
function hoverAt(e) {
  const pageEl = e.target.closest && e.target.closest('.pe-page');
  const objEl = e.target.closest && e.target.closest('.pe-obj');
  const p = pageEl && pageById(pageEl.dataset.id);
  const it = p && objEl ? p.items.find((i) => i.id === objEl.dataset.id) : null;
  const ok = it && !it.cover && !it.hidden && S.editing !== it.id && !(S.sel && S.sel.id === it.id) && !(S.group && S.group.has(it.id));
  const cur = $('.pe-obj.pe-hover');
  if (ok && cur === objEl) return;
  hoverOff();
  if (ok) {
    objEl.classList.add('pe-hover');
    (groupOf(p, it) || []).forEach((o) => { const el = pageEl.querySelector(`.pe-obj[data-id="${o.id}"]`); if (el) el.classList.add('pe-hover'); });
    return;
  }
  if (!p || !p.src || it) return;
  if (!pdfRunsReady(p)) { loadPdfRuns(p); return; } // read once, outlined from the next move on
  const g = pdfThingAt(p, ptOf(e, pageEl));
  if (!g) return;
  const z = S.zoom, b = document.createElement('div');
  b.className = 'pe-hoverbox';
  Object.assign(b.style, { left: `${(g.x - 2) * z}px`, top: `${(g.top - 2) * z}px`, width: `${(g.w + 4) * z}px`, height: `${(g.h + 4) * z}px` });
  pageEl.querySelector('.pe-layer').append(b);
}
// put the caret where the text was clicked (not at the end)
function caretAt(pageId, it, e) {
  const o = $(`.pe-page[data-id="${pageId}"] .pe-obj[data-id="${it.id}"]`);
  if (!o || !e || e.clientX === undefined) return;
  let r = null;
  if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY);
  else if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(e.clientX, e.clientY); if (c) { r = document.createRange(); r.setStart(c.offsetNode, c.offset); r.collapse(true); } }
  if (!r || !o.contains(r.startContainer)) return;
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}

// ------------------------------------------------------------ pointer input --
let drag = null;
let lastCellDown = null;

function ptOf(e, pageEl) {
  const r = pageEl.getBoundingClientRect();
  return { x: (e.clientX - r.left) / S.zoom, y: (e.clientY - r.top) / S.zoom };
}

// ------------------------------------------------------------ hand scroll --
// Hold Space (or the middle mouse button) and drag to move around a zoomed page. On a touch
// screen one finger moves the page, unless it starts on the object that is already selected
// (then it moves that object); a tap selects.
let spaceDown = false;
function startScroll(e, extra = {}) {
  const v = $('#peView');
  drag = { kind: 'scroll', x: e.clientX, y: e.clientY, sl: v.scrollLeft, st: v.scrollTop, moved: false, pid: e.pointerId, ...extra };
  v.classList.add('pe-grabbing');
}
function onPointerDown(e) {
  if (drag && drag.kind === 'scroll') return;
  const pageEl = e.target.closest('.pe-page');
  if (!pageEl || e.button > 0 || e.target.closest('.pe-photobar, .pe-qbar')) return;
  const p = pageById(pageEl.dataset.id);
  setCurrent(pageIndex(p.id));
  const pt = ptOf(e, pageEl);
  const objEl = e.target.closest('.pe-obj');
  const handle = e.target.closest('.pe-handle');
  const found = objEl ? p.items.find((i) => i.id === objEl.dataset.id) : null;
  const it = found && found.cover ? null : found; // covers over edited PDF text are not picked up
  hoverOff();

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
  if (tool === 'select' && e.pointerType === 'touch' && !handle && !(it && S.sel && S.sel.id === it.id)) {
    startScroll(e, { page: p, it, start: pt, tap: true });
    pageEl.setPointerCapture(e.pointerId);
    return;
  }
  // a second finger on a photo being dragged: pinch to zoom it
  if (drag && drag.kind === 'pan' && it === drag.it) {
    e.preventDefault();
    drag.pts.set(e.pointerId, pt); rebasePan(drag);
    pageEl.setPointerCapture(e.pointerId);
    return;
  }
  if (tool === 'select' && it && (e.shiftKey || e.ctrlKey || e.metaKey)) { e.preventDefault(); toggleGroup(p.id, it.id); return; }
  const grpIts = tool === 'select' && it && !e.shiftKey && !e.ctrlKey && !e.metaKey && !(S.group && S.group.has(it.id)) && !(S.sel && S.sel.id === it.id) ? groupOf(p, it) : null;
  if (grpIts && grpIts.length > 1) selectGroup(p.id, grpIts.map((o) => o.id));
  if (tool === 'select' && it && S.group && S.group.has(it.id) && S.sel.page === p.id) {
    e.preventDefault();
    const fresh = !!grpIts;
    const its = selItems().filter((o) => !o.locked);
    drag = { kind: 'gmove', page: p, its, orig: its.map((o) => JSON.parse(JSON.stringify(o))), start: pt, moved: false, clickId: it.id, fresh };
    pageEl.setPointerCapture(e.pointerId);
    return;
  }
  const thing = tool === 'select' && !it && e.pointerType !== 'touch' && p.src ? pdfThingAt(p, pt) : null;
  if (thing) {
    // the PDF's own text, lines, boxes and images: a click picks it up (text takes typing), a
    // drag moves it (it becomes an object of its own)
    e.preventDefault();
    select(null, null);
    drag = { kind: 'pdfgrab', page: p, start: pt, moved: false, pageEl, thing };
    pageEl.setPointerCapture(e.pointerId);
    return;
  }
  if (tool === 'select' && !it && e.pointerType !== 'touch') {
    e.preventDefault();
    select(null, null);
    const rub = document.createElement('div'); rub.className = 'pe-marquee';
    pageEl.querySelector('.pe-layer').append(rub);
    drag = { kind: 'marquee', page: p, start: pt, end: pt, rub };
    pageEl.setPointerCapture(e.pointerId);
    return;
  }
  if (tool === 'select' && isPhoto(it) && !it.locked) {
    e.preventDefault();
    if (!(S.sel && S.sel.id === it.id)) select(p.id, it.id);
    drag = { kind: 'pan', page: p, it, pts: new Map([[e.pointerId, pt]]), moved: false, pageEl };
    rebasePan(drag);
    pageEl.setPointerCapture(e.pointerId);
    return;
  }
  if (tool === 'select') {
    if (!it) { select(null, null); return; }
    e.preventDefault();
    if (it.locked) { select(p.id, it.id); return; } // locked: it can be picked (to unlock it), not moved
    const was = !!(S.sel && S.sel.id === it.id);
    if (!was) select(p.id, it.id);
    drag = { kind: 'move', page: p, it, start: pt, orig: { x: it.x, y: it.y }, moved: false, pageEl, rc, was };
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

function rebasePan(d) {
  d.base = { pts: new Map(d.pts), fx: d.it.fx ?? 0.5, fy: d.it.fy ?? 0.5, fz: d.it.fz || 1 };
}
const twoDist = (m) => { const [a, b] = [...m.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
function onPointerMove(e) {
  if (drag && (drag.kind === 'gmove' || drag.kind === 'marquee')) {
    const pageEl = $(`.pe-page[data-id="${drag.page.id}"]`);
    const pt = ptOf(e, pageEl);
    if (drag.kind === 'marquee') {
      drag.end = pt;
      const z = S.zoom, x = Math.min(pt.x, drag.start.x), y = Math.min(pt.y, drag.start.y);
      Object.assign(drag.rub.style, { left: `${x * z}px`, top: `${y * z}px`, width: `${Math.abs(pt.x - drag.start.x) * z}px`, height: `${Math.abs(pt.y - drag.start.y) * z}px` });
      return;
    }
    const dx = pt.x - drag.start.x, dy = pt.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 1.5) return;
    if (!drag.moved) { snapshot(); drag.moved = true; }
    const np = carryToPage(drag, drag.its, e);
    if (np) { drag.start = np; drag.orig = drag.its.map((o) => JSON.parse(JSON.stringify(o))); return; }
    drag.its.forEach((o, i) => {
      const g = drag.orig[i];
      o.x = g.x + dx; o.y = g.y + dy;
      if (isLine(o)) { o.x1 = g.x1 + dx; o.x2 = g.x2 + dx; o.y1 = g.y1 + dy; o.y2 = g.y2 + dy; }
      if (dx) delete o.ax;
    });
    drawItems(pageIndex(drag.page.id));
    showGaps(pageEl, drag.page, drag.its);
    return;
  }
  if (drag && drag.kind === 'pdfgrab') {
    const d = drag;
    if (d.moved || Math.hypot(ptOf(e, d.pageEl).x - d.start.x, ptOf(e, d.pageEl).y - d.start.y) < 3 / S.zoom) return;
    d.moved = true;
    const lift = d.thing.kind === 'text' ? editRunAt(d.page, d.start, { edit: false }) : liftPdfThing(d.page, d.thing);
    lift.then((t) => {
      if (drag !== d) return; // let go already
      if (!t) { drag = null; return; }
      select(d.page.id, t.id);
      drag = { kind: 'move', page: d.page, it: t, start: d.start, orig: { x: t.x, y: t.y }, moved: false, pageEl: d.pageEl, was: true };
    }).catch((err) => { drag = null; toast(err.message, true); });
    return;
  }
  if (drag && drag.kind === 'scroll') {
    if (e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    const v = $('#peView');
    v.scrollLeft = drag.sl - dx; v.scrollTop = drag.st - dy;
    return;
  }
  if (drag && drag.kind === 'pan') {
    if (!drag.pts.has(e.pointerId)) return;
    const d = drag, it = d.it, a = S.assets.get(it.asset);
    if (!a) return;
    d.pts.set(e.pointerId, ptOf(e, d.pageEl));
    const b = d.base;
    if (d.pts.size >= 2) {
      const d0 = twoDist(b.pts);
      if (d0 > 2) {
        if (!d.moved) { snapshot(); d.moved = true; }
        zoomPhoto(d.page.id, it, b.fz * (twoDist(d.pts) / d0));
      }
      return;
    }
    const p0 = b.pts.get(e.pointerId), p1 = d.pts.get(e.pointerId);
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    if (!d.moved && Math.hypot(dx, dy) < 1.5) return;
    if (!d.moved) { snapshot(); d.moved = true; }
    const r = photoRect({ ...it, fz: b.fz }, a), ox = r.w - it.w, oy = r.h - it.h;
    if (ox > 0.5) it.fx = clamp(b.fx - dx / ox, 0, 1);
    if (oy > 0.5) it.fy = clamp(b.fy - dy / oy, 0, 1);
    refreshPhoto(d.page.id, it);
    return;
  }
  if (!drag) {
    if (S.tool === 'select') hoverAt(e);
    if (RUNS[S.tool]) {
      const pageEl = e.target.closest('.pe-page');
      if (pageEl) {
        showRuns(pageEl);
        const pt = ptOf(e, pageEl);
        const p = pageById(pageEl.dataset.id);
        const runs = S.runs.get(S.tool === 'edittext' ? `groups:${runKey('edittext', p)}` : runKey(S.tool, p)) || [];
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
    const np = carryToPage(drag, [it], e);
    if (np) { drag.start = np; drag.orig = { x: it.x, y: it.y }; showGuides(null); return; }
    let nx = clamp(drag.orig.x + pt.x - drag.start.x, -it.w + 8, vw - 8);
    let ny = clamp(drag.orig.y + pt.y - drag.start.y, -it.h + 8, vh - 8);
    const sn = e.altKey ? { x: nx, y: ny } : snapMove(drag.page, it, nx, ny);
    moveItem(it, sn.x - it.x, sn.y - it.y);
    const o = pageEl.querySelector(`.pe-obj[data-id="${it.id}"]`);
    o.style.left = `${it.x * S.zoom}px`; o.style.top = `${it.y * S.zoom}px`;
    showGuides(pageEl, sn.gx, sn.gy);
    decorateSelection();
    showGaps(pageEl, drag.page, [it]);
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
      const textSide = it.type === 'text' && drag.h.length === 1;
      if (textSide) { if (drag.h === 's') h = Math.max(h, 4); }
      else if (((it.type === 'image' && !it.clip) || it.type === 'check' || it.type === 'cross' || it.type === 'icon' || it.type === 'text') && !e.shiftKey) {
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
      if (textSide) {
        if (drag.h === 'e' || drag.h === 'w') { it.wrap = round(Math.max(it.size, w)); delete it.ax; }
        else { it.minH = round(h); if (!it.wrap) { it.wrap = round(o.w); delete it.ax; } }
        w = it.wrap || o.w;
      } else if (it.type === 'text') { it.size = clamp(Math.round(o.size * (w / o.w) * 10) / 10, 4, 400); if (o.wrap) it.wrap = o.wrap * (w / o.w); }
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
// Dragging something onto another page moves it to that page: it belongs to the page it is
// dropped on (so deleting the page it came from no longer deletes it).
function carryToPage(d, its, e) {
  const over = pageUnder(e.clientX, e.clientY);
  if (!over || over.dataset.id === d.page.id || !d.moved) return false;
  const from = d.page, to = pageById(over.dataset.id);
  if (!to) return false;
  const oldEl = $(`.pe-page[data-id="${from.id}"]`);
  const a = ptOf(e, oldEl), b = ptOf(e, over);
  for (const o of its) {
    moveItem(o, b.x - a.x, b.y - a.y);
    from.items.splice(from.items.indexOf(o), 1);
    to.items.push(o);
  }
  d.page = to; d.pageEl = over;
  drawItems(pageIndex(from.id));
  if (its.length > 1) { S.sel = { page: to.id, id: S.sel.id }; S.group = new Set(its.map((o) => o.id)); } else S.sel = { page: to.id, id: its[0].id };
  setCurrent(pageIndex(to.id));
  drawItems(pageIndex(to.id));
  return b;
}

function showGuides(pageEl, gx, gy) {
  $$('.pe-guide').forEach((g) => g.remove());
  if (!pageEl) return;
  const layer = pageEl.querySelector('.pe-layer');
  if (gx != null) { const g = document.createElement('div'); g.className = 'pe-guide v'; g.style.left = `${gx * S.zoom}px`; layer.append(g); }
  if (gy != null) { const g = document.createElement('div'); g.className = 'pe-guide h'; g.style.top = `${gy * S.zoom}px`; layer.append(g); }
}

// While something is dragged: the space to the nearest object above, below, left and right,
// as a pink line with the distance on it (in the ruler's unit), so gaps can be matched by eye.
function showGaps(pageEl, p, its) {
  $$('.pe-gap').forEach((g) => g.remove());
  if (!pageEl || !its || !its.length) return;
  $$('.pe-qbar').forEach((q) => { q.style.visibility = 'hidden'; }); // it would cover the numbers
  const [W, H] = viewSize(p);
  const L = Math.min(...its.map(itemLeft)), T = Math.min(...its.map(itemTop)), R = Math.max(...its.map(itemRight)), B = Math.max(...its.map(itemBottom));
  const others = p.items.filter((o) => !its.includes(o) && !o.hidden && !o.cover && !isBackdrop(o, W, H));
  // on an opened PDF, its own paragraphs count too (not the ones already covered and retyped)
  const covers = p.items.filter((o) => o.cover);
  for (const g of S.runs.get(`groups:${runKey('edittext', p)}`) || []) {
    if (covers.some((c) => c.x < g.x + g.w && c.x + c.w > g.x && c.y < g.top + g.h && c.y + c.h > g.top)) continue;
    others.push({ x: g.x, y: g.top, w: g.w, h: g.h });
  }
  const near = (dir) => {
    let best = null;
    for (const o of others) {
      const l = itemLeft(o), t = itemTop(o), r = itemRight(o), b = itemBottom(o);
      const vert = dir === 'up' || dir === 'down';
      if (vert ? Math.min(r, R) - Math.max(l, L) <= 0 : Math.min(b, B) - Math.max(t, T) <= 0) continue; // not side by side
      const gap = { up: T - b, down: t - B, left: L - r, right: l - R }[dir];
      if (gap < 0.5) continue;
      if (!best || gap < best.gap) best = { gap, l, t, r, b };
    }
    return best;
  };
  const z = S.zoom, layer = pageEl.querySelector('.pe-layer');
  const draw = (dir, n) => {
    if (!n) return;
    const g = document.createElement('div'); g.className = `pe-gap ${dir === 'up' || dir === 'down' ? 'v' : 'h'}`;
    if (dir === 'up' || dir === 'down') {
      const x = (Math.max(n.l, L) + Math.min(n.r, R)) / 2, y = dir === 'up' ? n.b : B;
      Object.assign(g.style, { left: `${x * z}px`, top: `${y * z}px`, height: `${n.gap * z}px` });
    } else {
      const y = (Math.max(n.t, T) + Math.min(n.b, B)) / 2, x = dir === 'left' ? n.r : R;
      Object.assign(g.style, { left: `${x * z}px`, top: `${y * z}px`, width: `${n.gap * z}px` });
    }
    const lab = document.createElement('span'); lab.textContent = String(toU(n.gap));
    g.append(lab); layer.append(g);
  };
  ['up', 'down', 'left', 'right'].forEach((d) => draw(d, near(d)));
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

function onPointerUp(e) {
  if (drag && (drag.kind === 'gmove' || drag.kind === 'marquee')) {
    const d = drag; drag = null;
    showGaps(null);
    if (d.kind === 'gmove') {
      if (!d.moved && !d.fresh) {
        // a click on one of them: just that one (a text takes typing straight away)
        select(d.page.id, d.clickId);
        const one = d.page.items.find((o) => o.id === d.clickId);
        if (one && one.type === 'text' && !one.locked) { editText(d.page.id, one); caretAt(d.page.id, one, e); }
      }
      else { drawItems(pageIndex(d.page.id)); updatePanel(); }
      return;
    }
    d.rub.remove();
    const x1 = Math.min(d.start.x, d.end.x), x2 = Math.max(d.start.x, d.end.x), y1 = Math.min(d.start.y, d.end.y), y2 = Math.max(d.start.y, d.end.y);
    if (x2 - x1 < 3 && y2 - y1 < 3) {
      // a click on the PDF's own text: edit that paragraph, no need to pick "Edit text" first
      if (d.page.src && groupAt(d.page, d.start)) editRunAt(d.page, d.start);
      return;
    }
    const [W, H] = viewSize(d.page);
    const inside = (o) => itemLeft(o) >= x1 && itemRight(o) <= x2 && itemTop(o) >= y1 && itemBottom(o) <= y2;
    const touches = (o) => itemLeft(o) < x2 && itemRight(o) > x1 && itemTop(o) < y2 && itemBottom(o) > y1;
    const ids = d.page.items.filter((o) => !o.hidden && !o.locked && (inside(o) || (touches(o) && !isBackdrop(o, W, H) && o.type === 'text'))).map((o) => o.id);
    selectGroup(d.page.id, ids);
    return;
  }
  if (!drag) return;
  if (drag.kind === 'pdfgrab') {
    const d = drag; drag = null;
    // a click: type in that paragraph, or select the line, box or picture
    if (!d.moved) {
      if (d.thing.kind === 'text') editRunAt(d.page, d.start);
      else liftPdfThing(d.page, d.thing).then((t) => select(d.page.id, t.id)).catch((err) => toast(err.message, true));
    }
    return;
  }
  if (drag.kind === 'scroll') {
    if (e && e.pointerId !== undefined && e.pointerId !== drag.pid) return;
    const d = drag; drag = null;
    $('#peView').classList.remove('pe-grabbing');
    if (d.tap && !d.moved) {
      // a tap: select what is under the finger (a template's photo circle asks for a picture)
      const slot = d.it ? photoSlotAt(d.page, d.start, d.it) : null;
      if (slot) { select(d.page.id, slot.id); choosePhoto(d.page, slot); } else select(d.it ? d.page.id : null, d.it ? d.it.id : null);
    }
    return;
  }
  if (drag.kind === 'pan') {
    if (e && e.pointerId !== undefined) drag.pts.delete(e.pointerId); else drag.pts.clear();
    if (drag.pts.size) { rebasePan(drag); return; }
    const d = drag; drag = null;
    if (d.moved) { drawItems(pageIndex(d.page.id)); updateProps(); }
    return;
  }
  const d = drag; drag = null;
  const p = d.page, idx = pageIndex(p.id);
  if (d.kind === 'move' || d.kind === 'resize' || d.kind === 'rotate' || d.kind === 'tgrip') {
    showGuides(null); showGaps(null);
    const slot = !d.moved && d.kind === 'move' && S.tool === 'select' ? photoSlotAt(p, d.start, d.it) : null;
    if (d.moved) {
      drawItems(idx); updateProps(); updatePanel();
      // a text box made narrower, wider or taller: what is under it moves with it
      if (d.kind === 'resize' && d.it.type === 'text' && d.h.length === 1) reflowAfter(p, d.it, d.orig.y + d.orig.h);
    }
    else if (slot) choosePhoto(p, slot);
    // one click on a text (not a drag): type in it, with the caret where it was clicked
    else if (d.kind === 'move' && d.it.type === 'text' && S.tool === 'select' && !d.it.locked) { editText(p.id, d.it); caretAt(p.id, d.it, e); }
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
  $('#peCtxName').textContent = S.group ? `${S.group.size} selected` : it ? (it.type === 'text' ? 'Text' : LAYER_NAMES[it.type] || 'Object') : TOOL_NAMES[S.tool] || '';
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
    if (o.type === 'text') { $('#pStrike').setAttribute('aria-pressed', String(!!o.strike)); $('#pCaps').setAttribute('aria-pressed', String(!!o.caps)); }
    if (o.type === 'image') $$('[data-flip]').forEach((b) => b.setAttribute('aria-pressed', String(!!o[b.dataset.flip === 'x' ? 'flipX' : 'flipY'])));
    const al = o.type === 'table' ? o.align[S.cell && S.cell.id === o.id ? S.cell.c : 0] : o.align;
    $$('[data-align]').forEach((b) => b.setAttribute('aria-pressed', String((al || 'left') === b.dataset.align)));
    if (o.type === 'text') { $('#pLh').value = String(o.lh || LINE); $('#pPs').value = String(o.ps || 0); }
    if (o.type === 'text') { const lk = listKind(o.text || ''); $$('[data-list]').forEach((b) => b.setAttribute('aria-pressed', String(lk === b.dataset.list))); }
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
  // the same change for every selected object of the same kind
  if (t.item && S.group) for (const o of selItems()) if (o !== t.obj && o.type === t.obj.type && key in t.obj) o[key] = value;
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
  // strikethrough, all capitals, smaller / bigger text, mirrored pictures
  [$('#pStrike'), $('#pCaps'), ...$$('[data-size]')].forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
  $('#pStrike').addEventListener('click', () => { const t = propTarget(); if (t && t.obj.type === 'text') { setProp('strike', !t.obj.strike); end(); updateProps(); } });
  $('#pCaps').addEventListener('click', () => { const t = propTarget(); if (t && t.obj.type === 'text') { setProp('caps', !t.obj.caps); end(); updateProps(); } });
  $$('[data-size]').forEach((b) => b.addEventListener('click', () => {
    const t = propTarget();
    if (!t || !('size' in t.obj)) return;
    const v = clamp(Math.round((t.obj.size + Number(b.dataset.size) * (t.obj.size >= 20 ? 2 : 1)) * 2) / 2, 4, 200);
    FIELDS.size.value = v; setProp('size', v); end();
  }));
  $$('[data-flip]').forEach((b) => b.addEventListener('click', () => flipSelected(b.dataset.flip)));
  // line height and paragraph spacing: the box grows or shrinks, and what is under it follows
  const spacing = (key, el, lo, hi) => {
    el.addEventListener('input', () => {
      const it = itemOf(S.sel);
      if (!it || it.type !== 'text') return;
      const v = clamp(Number(el.value) || 0, lo, hi);
      if (!propSnap) { snapshot(); propSnap = true; }
      const p = pageById(S.sel.page), oldB = it.y + it.h;
      if (!it.wrap) giveWrap(p, it);
      it[key] = v;
      drawItems(pageIndex(p.id));
      reflowAfter(p, it, oldB);
    });
    el.addEventListener('change', end);
  };
  spacing('lh', $('#pLh'), 0.8, 3);
  spacing('ps', $('#pPs'), 0, 48);
  $$('[data-list]').forEach((b) => {
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the caret in the text
    b.addEventListener('click', () => toggleList(b.dataset.list));
  });
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
  if (S.group) {
    const its = selItems().filter((o) => !o.locked);
    if (!its.length) return;
    const [vw, vh] = viewSize(pageById(S.sel.page));
    const L = Math.min(...its.map(itemLeft)), T = Math.min(...its.map(itemTop)), W = Math.max(...its.map(itemRight)) - L, H = Math.max(...its.map(itemBottom)) - T;
    const nx = { left: 0, hcenter: (vw - W) / 2, right: vw - W }[where], ny = { top: 0, vcenter: (vh - H) / 2, bottom: vh - H }[where];
    snapshot();
    its.forEach((o) => moveItem(o, nx === undefined ? 0 : nx - L, ny === undefined ? 0 : ny - T));
    drawItems(pageIndex(S.sel.page)); decorateSelection(); updatePanel();
    return;
  }
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

const LAYER_NAMES = { icon: 'Icon', table: 'Table', image: 'Image', pen: 'Drawing', highlight: 'Highlight', whiteout: 'Whiteout', rect: 'Rectangle', ellipse: 'Circle', line: 'Line', arrow: 'Arrow', check: 'Check mark', cross: 'Cross' };
const LAYER_ICONS = {
  icon: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
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
    $$('li', list).forEach((li) => li.classList.toggle('sel', isSelId(li.dataset.id)));
    return;
  }
  list.dataset.sig = sig;
  list.textContent = '';
  list.dataset.page = p.id;
  $('#peLayersEmpty').hidden = p.items.length > 0;
  p.items.slice().reverse().forEach((it) => {
    const li = document.createElement('li');
    li.draggable = true; li.dataset.id = it.id;
    li.className = `${isSelId(it.id) ? 'sel' : ''} ${it.hidden ? 'is-hidden' : ''}`;
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
    if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleGroup(pid, li.dataset.id); return; }
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
  const { TEMPLATES, TEMPLATE_CATS, RESUME_STYLES = [] } = await loadTemplates();
  if (!TEMPLATES.length) { host.closest('.pe-tpl-panel, dialog')?.setAttribute('data-empty', ''); return; }
  if (host.dataset.built) return;
  host.dataset.built = '1';
  // The resume builder (/resume-maker) shows every resume, grouped by style, blank one first;
  // other galleries show the main templates only (extra resume designs are marked "more").
  const only = where === 'start' && $('#pe').dataset.onlyCat;
  const list = only ? TEMPLATES.filter((t) => t.cat === only).sort((a, b) => (b.id === 'resume-blank') - (a.id === 'resume-blank')) : TEMPLATES.filter((t) => !t.more);
  const groupOf = (t) => (only ? t.style || 'all' : t.cat);
  // "resumes" (the resume builder's first tab) is every resume design, without the cover letter.
  // Job pages (/nurse-resume) add a first tab with their own designs ("feat"); style pages
  // (/ats-resume-template) open on their style.
  const pe = $('#pe').dataset;
  const feat = new Set(only && pe.feature ? pe.feature.split(',') : []);
  let cat = only ? (feat.size ? 'feat' : pe.startStyle || 'resumes') : 'all';
  const inCat = (g, c, id) => c === 'all' || g === c || (c === 'resumes' && g !== 'letter') || (c === 'feat' && feat.has(id));
  if (feat.size) list.sort((a, b) => feat.has(b.id) - feat.has(a.id));
  const chips = document.createElement('div');
  chips.className = 'pe-tpl-cats'; chips.setAttribute('role', 'tablist');
  chips.innerHTML = (only ? [...(feat.size ? [['feat', pe.featureLabel || 'Featured']] : []), ...RESUME_STYLES] : TEMPLATE_CATS).filter(([id]) => id === 'all' || list.some((t) => inCat(groupOf(t), id, t.id)))
    .map(([id, name]) => `<button type="button" role="tab" data-cat="${id}" aria-selected="${id === cat}">${name}${only ? ` <span>${list.filter((t) => t.id !== 'resume-blank' && inCat(groupOf(t), id, t.id)).length}</span>` : ''}</button>`).join('');
  const grid = document.createElement('div');
  grid.className = 'pe-tpl-grid';
  grid.innerHTML = list.map((t) => `<button type="button" class="pe-tpl${t.id === 'resume-blank' ? ' pe-tpl-blank' : ''}" data-tpl="${t.id}" data-cat="${groupOf(t)}">
    <span class="pe-tpl-frame"><span class="pe-tpl-page ${t.size[0] > t.size[1] ? 'land' : 'port'}" style="aspect-ratio:${t.size[0]} / ${t.size[1]}"></span></span>
    <span class="pe-tpl-name">${t.name}</span></button>`).join('');
  $$('.pe-tpl', grid).forEach((c) => { c.hidden = !inCat(c.dataset.cat, cat, c.dataset.tpl); });
  host.append(chips, grid);
  if (!only && where === 'start' && TEMPLATES.some((t) => t.more && t.cat === 'resume')) {
    const more = document.createElement('p');
    more.className = 'pe-tpl-more';
    more.innerHTML = `<a href="/resume-maker">See all ${TEMPLATES.filter((t) => t.cat === 'resume' && t.id.startsWith('resume') && t.id !== 'resume-blank').length} resume templates \u2192</a>`;
    host.append(more);
  }
  // landing pages such as /resume-maker show their own category first
  const startCat = where === 'start' && $('#pe').dataset.startCat;
  if (startCat) requestAnimationFrame(() => { const b = $(`[data-cat="${startCat}"]`, chips); if (b) b.click(); });
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    cat = b.dataset.cat;
    $$('[data-cat]', chips).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('.pe-tpl', grid).forEach((c) => { c.hidden = !inCat(c.dataset.cat, cat, c.dataset.tpl); });
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
  if (objEl) { if (S.tool !== 'select') setTool('select'); if (!isSelId(objEl.dataset.id)) select(p.id, objEl.dataset.id); } else select(null, null);
  const cellEl = e.target.closest('.pe-cell');
  const it0 = itemOf(S.sel);
  if (it0 && it0.type === 'table' && cellEl) { S.cell = { id: it0.id, r: Number(cellEl.dataset.r), c: Number(cellEl.dataset.c) }; drawItems(pageIndex(p.id)); }
  showCtx(e.clientX, e.clientY);
}
function showCtx(x, y) {
  const it = itemOf(S.sel);
  const m = $('#peCtx');
  $$('[data-ctx]', m).forEach((b) => { b.disabled = b.dataset.ctx === 'paste' ? !clip : !it; });
  const lock = $('[data-ctx="lock"]', m); lock.firstChild.textContent = it && it.locked ? 'Unlock' : 'Lock';
  $('[data-ctx="pastestyle"]', m).disabled = !it || !styleClip;
  $$('.pe-ctx-table', m).forEach((x) => { x.hidden = !(it && it.type === 'table'); });
  $('[data-ctx="group"]', m).hidden = !S.group || selIsOneGroup();
  $('[data-ctx="ungroup"]', m).hidden = !selItems().some((o) => o.grp);
  $$('.pe-ctx-image', m).forEach((x) => { x.hidden = !(it && it.type === 'image'); });
  $('[data-ctx="delete"]', m).firstChild.textContent = it && it.type === 'table' ? 'Delete table' : 'Delete';
  m.hidden = false;
  m.style.left = `${clamp(x, 8, window.innerWidth - m.offsetWidth - 8)}px`;
  m.style.top = `${clamp(y, 8, window.innerHeight - m.offsetHeight - 8)}px`;
}
const closeCtx = () => { const m = $('#peCtx'); if (m) m.hidden = true; };
function ctxAction(a) {
  closeCtx();
  if (a === 'cut') copySel(true);
  else if (a === 'copy') copySel(false);
  else if (a === 'paste') pasteClip();
  else if (a === 'dup') duplicateSelected();
  else if (a === 'delete') removeSelected();
  else if (a === 'lock') lockSelected();
  else if (a === 'copystyle') copyStyle();
  else if (a === 'pastestyle') pasteStyle();
  else if (a.startsWith('al-')) alignTo(a.slice(3));
  else if (a.startsWith('flip-')) flipSelected(a.slice(5));
  else if (a === 'hide') toggleFlag(S.sel, 'hidden');
  else if (a === 'group') groupSelected();
  else if (a === 'ungroup') ungroupSelected();
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
  if (typeof fileOrUrl !== 'string') saveUpload(a, fileOrUrl.name || 'image');
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
      // Split the line into right-to-left runs (Urdu, Arabic, Hebrew: shaped by fontkit and drawn
      // as outlines, because the PDF writer cannot join their letters) and the rest (normal text).
      // Runs are placed in reading order: left to right, or right to left when the line starts in Urdu.
      const R = '\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF';
      const parts = line.split(new RegExp(`([${R}](?:[${R}\\s\u060C\u061B\u061F\u06D4\u0660-\u0669\u06F0-\u06F9]*[${R}])?)`)).filter(Boolean);
      const segs = [];
      for (const part of parts) {
        if (RTL_RE.test(part)) {
          const covers = (f) => f.fk && Array.from(part).every((ch) => /\s/.test(ch) || f.fk.hasGlyphForCodePoint(ch.codePointAt(0)));
          const heb = /[\u0590-\u05FF]/.test(part);
          const f2 = covers(fo) ? fo : await font(heb ? 'noto-sans-hebrew' : 'noto-naskh-arabic', false, false);
          const run = f2.fk.layout(part, [], heb ? 'hebr' : 'arab', null, 'rtl');
          const sc = size / f2.fk.unitsPerEm;
          let cx = 0, d = '';
          run.glyphs.forEach((g, i) => {
            const pos = run.positions[i];
            d += g.path.scale(sc, -sc).translate(cx + pos.xOffset * sc, -pos.yOffset * sc).toSVG();
            cx += pos.xAdvance * sc;
          });
          segs.push({ width: cx, draw: (x, y, col, op) => { if (d) page.drawSvgPath(d, { x, y, color: col, opacity: op }); } });
        } else {
          const t = clean(fo, part);
          segs.push({ width: fo.ft.widthOfTextAtSize(t, size), draw: (x, y, col, op) => { if (t.trim()) page.drawText(t, { x, y, size, font: fo.ft, color: col, opacity: op }); } });
        }
      }
      const firstStrong = /[A-Za-z\u00C0-\u024F\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.exec(line);
      if (firstStrong && RTL_RE.test(firstStrong[0])) segs.reverse();
      const width = segs.reduce((n, sg) => n + sg.width, 0);
      return { width, draw: (x, y, col, op) => { let cx = x; for (const sg of segs) { sg.draw(cx, y, col, op); cx += sg.width; } } };
    }
    const t = clean(fo, line);
    return { width: fo.ft.widthOfTextAtSize(t, size), draw: (x, y, col, op) => page.drawText(t, { x, y, size, font: fo.ft, color: col, opacity: op }) };
  };
  const roundRect = (w, h, r, inset) => {
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    return `M${x0 + r} ${y0} L${x1 - r} ${y0} A${r} ${r} 0 0 1 ${x1} ${y0 + r} L${x1} ${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} L${x0 + r} ${y1} A${r} ${r} 0 0 1 ${x0} ${y1 - r} L${x0} ${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`;
  };
  // a mirrored picture: flip the drawing about the picture's centre
  let curVH = 0;
  const flipped = (it, draw) => {
    if (!it.flipX && !it.flipY) { draw(); return; }
    const cx = it.x + it.w / 2, cy = curVH - (it.y + it.h / 2), sx = it.flipX ? -1 : 1, sy = it.flipY ? -1 : 1;
    curPage.pushOperators(pushGraphicsState(), concatTransformationMatrix(sx, 0, 0, sy, cx - sx * cx, cy - sy * cy));
    draw();
    curPage.pushOperators(popGraphicsState());
  };
  let curPage = null;
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

    curPage = page; curVH = VH;
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
        // paragraphs (with the space between them), wrapped to the box; list items hang under their text
        const lhK = it.lh || LINE, lineH = lhK * it.size, base = baselineOffset(it.font, it.size, lhK);
        const rows = [];
        let top = 0;
        const paras = (it.caps ? it.text.toUpperCase() : it.text).split('\n');
        for (let pi = 0; pi < paras.length; pi++) {
          const para = paras[pi], m = it.wrap ? LIST_RE.exec(para) : null;
          if (m) {
            const mw = (await textLine(page, fo, m[1], it.size)).width;
            const body = await wrapText(page, fo, para.slice(m[1].length), it.size, it.wrap + 0.5 - mw, textLine);
            body.forEach((t, k) => { rows.push({ t: k ? t : m[1] + t, dx: k ? mw : 0, top }); top += lineH; });
          } else {
            const ls = it.wrap ? await wrapText(page, fo, para, it.size, it.wrap + 0.5, textLine) : [para];
            ls.forEach((t) => { rows.push({ t, dx: 0, top }); top += lineH; });
          }
          top += it.ps || 0;
        }
        for (const row of rows) {
          if (!row.t) continue;
          const ln = await textLine(page, fo, row.t, it.size);
          const x = it.x + (it.align === 'center' ? (it.w - ln.width) / 2 : it.align === 'right' ? it.w - ln.width : row.dx);
          const y = VH - (it.y + base + row.top);
          ln.draw(x, y, color(it.color), op);
          if (it.underline) page.drawLine({ start: { x, y: y - it.size * 0.12 }, end: { x: x + ln.width, y: y - it.size * 0.12 }, thickness: Math.max(0.5, it.size / 16), color: color(it.color), opacity: op });
          if (it.strike) page.drawLine({ start: { x, y: y + it.size * 0.3 }, end: { x: x + ln.width, y: y + it.size * 0.3 }, thickness: Math.max(0.5, it.size / 16), color: color(it.color), opacity: op });
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
            const pr = photoRect(it, a);
            const bx = it.x, by = VH - it.y - it.h;
            page.pushOperators(pushGraphicsState(), ...shapePath(bx, by, it.w, it.h, it.clip, it.r), clip(), endPath());
            flipped(it, () => page.drawImage(images.get(a.id), { x: bx + pr.x, y: VH - (it.y + pr.y) - pr.h, width: pr.w, height: pr.h, opacity: op }));
            page.pushOperators(popGraphicsState());
            if (it.sw > 0) {
              const sw = it.sw;
              if (it.clip === 'ellipse') page.drawEllipse({ x: bx + it.w / 2, y: by + it.h / 2, xScale: Math.max(0, it.w / 2 - sw / 2), yScale: Math.max(0, it.h / 2 - sw / 2), borderColor: color(it.stroke), borderWidth: sw, borderOpacity: op });
              else if (it.clip === 'rounded' && it.r > 0) page.drawSvgPath(roundRect(it.w, it.h, it.r, sw / 2), { x: it.x, y: VH - it.y, borderColor: color(it.stroke), borderWidth: sw, borderOpacity: op });
              else page.drawRectangle({ x: bx + sw / 2, y: by + sw / 2, width: Math.max(0, it.w - sw), height: Math.max(0, it.h - sw), borderColor: color(it.stroke), borderWidth: sw, borderOpacity: op });
            }
          } else flipped(it, () => page.drawImage(images.get(a.id), { x: it.x, y: VH - it.y - it.h, width: it.w, height: it.h, opacity: op }));
        }
      } else if (it.type === 'icon') {
        page.drawSvgPath(it.d, { x: it.x, y: VH - it.y, scale: it.w / 24, borderColor: color(it.color), borderWidth: it.width || 2, borderOpacity: op, borderLineCap: LineCapStyle.Round });
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
  attachProject(out);
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
  if (mod && e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copyStyle(); return; }
  if (mod && e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteStyle(); return; }
  if (mod && e.key.toLowerCase() === 'c') { if (copySel(false)) e.preventDefault(); return; }
  if (mod && e.key.toLowerCase() === 'x') { if (copySel(true)) e.preventDefault(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); if (e.shiftKey) ungroupSelected(); else groupSelected(); return; }
  if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) { e.preventDefault(); arrange(e.code === 'BracketRight' ? (e.shiftKey ? 'tofront' : 'forward') : (e.shiftKey ? 'toback' : 'backward')); return; }
  if (e.key === '?') { $('#peHelpDlg').showModal(); return; }
  if (e.shiftKey && !mod && e.key.toLowerCase() === 'r') { setRulers(!$('#peStage').classList.contains('rulers')); return; }
  if (mod && e.key === ';') { e.preventDefault(); setGuidesOn(!guidesOn()); return; }
  if (e.key === 'Enter' && selIt && selIt.type === 'table') { e.preventDefault(); const c = S.cell && S.cell.id === selIt.id ? S.cell : { r: 0, c: 0 }; editCell(S.sel.page, selIt, c.r, c.c); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selIt && selIt.type === 'table' && S.cell && S.cell.id === selIt.id && selIt.rows > 1) {
    e.preventDefault(); tableOp('delrow'); toast('Row deleted. To remove the whole table, right-click it and choose Delete table.'); return;
  }
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAllOnPage(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); removeSelected(); return; }
  if (e.key === 'Escape') { closeImgMenu(); closeCtx(); closeFontPicker(); select(null, null); setTool('select'); return; }
  if (S.sel && e.key.startsWith('Arrow') && !(selIt && selIt.locked)) {
    e.preventDefault();
    const st = e.shiftKey ? 10 : 1;
    snapshot();
    for (const it of selItems().filter((o) => !o.locked)) moveItem(it, e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0);
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
  select: ['Select', 'Click any text to type in it. Move, resize and rotate anything.', 'V'],
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
    if (!e.target.closest('#peCtx, .pe-qbar')) closeCtx();
    if (!e.target.closest('#peFontPop') && !e.target.closest('#pFontBtn')) closeFontPicker();
  });
  $$('.pe-menu .pe-pop button').forEach((b) => b.addEventListener('click', () => b.closest('.pe-menu').classList.remove('open')));

  const acts = {
    new: () => { if (!S.dirty || window.confirm('Start a new PDF? Changes you have not downloaded will be lost.')) { $('#peApp').hidden = true; $('#peStart').hidden = false; document.body.classList.remove('is-editing'); $('#pe').classList.remove('editing'); } },
    open: () => $('#peOpenInput').click(),
    addpdf: () => $('#peAddPdfInput').click(),
    image: () => { imagePick = null; $('#peImageInput').click(); },
    replaceimg: () => { if (itemOf(S.sel)) { imagePick = { mode: 'item', sel: { ...S.sel } }; $('#peImageInput').click(); } },
    elements: () => openElements($('[data-act="elements"]')),
    uploadfiles: () => $('#peUploadInput').click(),
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
  $('#peElements').addEventListener('click', (e) => { const b = e.target.closest('[data-el]'); if (b) addElement(b.dataset.el); });
  $$('[data-side]').forEach((b) => b.addEventListener('click', () => showSide(b.dataset.side)));
  $('#peUploadInput').addEventListener('change', async (e) => {
    const files = [...e.target.files].filter(isImage);
    e.target.value = '';
    for (const f of files) { try { await addAsset(f); } catch (err) { toast(err.message, true); } }
    renderUploads();
    if (files.length) toast(`${files.length} picture${files.length > 1 ? 's' : ''} uploaded. Click one to add it to the page.`);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveProject(); });
  renderProjects();
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#peElements, [data-act="elements"]')) closeElements(); });
  $('#peExportOk').addEventListener('click', doExport);
  $('#peNumbers').addEventListener('change', () => { $('#peNumbersOpts').hidden = !$('#peNumbers').checked; });
  $('#peWatermark').addEventListener('change', () => { $('#peWatermarkOpts').hidden = !$('#peWatermark').checked; });

  const view = $('#peView');
  bindGuides();
  bindTables();
  bindAuth();
  // Space + drag, or the middle mouse button: move around the page
  view.addEventListener('pointerdown', (e) => {
    if (!(spaceDown || e.button === 1) || e.pointerType === 'touch') return;
    e.preventDefault(); e.stopImmediatePropagation();
    startScroll(e);
    view.setPointerCapture(e.pointerId);
  }, true);
  const typingNow = (e) => S.editing || S.cellEdit || /^(input|select|textarea|button)$/i.test(e.target.tagName) || e.target.isContentEditable;
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || $('#peApp').hidden || typingNow(e)) return;
    e.preventDefault();
    if (!spaceDown) { spaceDown = true; view.classList.add('pe-grab'); }
  });
  document.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; view.classList.remove('pe-grab'); } });
  window.addEventListener('blur', () => { spaceDown = false; view.classList.remove('pe-grab'); });
  view.addEventListener('pointerdown', onPointerDown);
  view.addEventListener('pointermove', (e) => { onPointerMove(e); drawRulersSoon({ x: e.clientX, y: e.clientY }); });
  view.addEventListener('pointerleave', () => { drawRulersSoon(null); hoverOff(); });
  view.addEventListener('contextmenu', openCtx);
  // Ctrl + mouse wheel (or a trackpad pinch) zooms
  let wheelZoom = 0, wheelT = 0, wheelPhotoT = 0;
  view.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) {
      // the mouse wheel over a selected photo zooms the photo
      const it = itemOf(S.sel), o = e.target.closest('.pe-obj');
      if (isPhoto(it) && !it.locked && o && o.dataset.id === it.id) {
        e.preventDefault();
        if (!wheelPhotoT) snapshot();
        clearTimeout(wheelPhotoT); wheelPhotoT = setTimeout(() => { wheelPhotoT = 0; }, 400);
        zoomPhoto(S.sel.page, it, (it.fz || 1) * Math.exp(-e.deltaY * 0.0015));
      }
      return;
    }
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
