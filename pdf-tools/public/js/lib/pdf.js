// Lazy loaders and helpers shared by the browser-side processors.
// Nothing here is downloaded until a tool actually needs it.

let pdfLibP = null;
let pdfjsP = null;
const scripts = new Map();

export function loadScript(src, globalName) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(window[globalName]);
      s.onerror = () => { scripts.delete(src); reject(new Error(`Could not load ${src}`)); };
      document.head.appendChild(s);
    }));
  }
  return scripts.get(src);
}

export function pdfLib() {
  if (!pdfLibP) pdfLibP = import('/vendor/pdf-lib.mjs').catch((e) => { pdfLibP = null; throw e; });
  return pdfLibP;
}
export const jszip = () => loadScript('/vendor/jszip.js', 'JSZip');
export const fontkit = () => loadScript('/vendor/fontkit.js', 'fontkit');

export function pdfjs() {
  if (!pdfjsP) {
    pdfjsP = import('/vendor/pdfjs/pdf.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
      return lib;
    }).catch((e) => { pdfjsP = null; throw e; });
  }
  return pdfjsP;
}

/** Friendly error that the tool page shows as-is. */
export class ToolError extends Error {
  constructor(message, link) { super(message); this.userMessage = message; this.link = link; }
}

export const LOCKED = () => new ToolError('This PDF is password-protected or has security restrictions. Remove them first, then try again.', { href: '/unlock-pdf', label: 'Open Unlock PDF' });
export const DAMAGED = () => new ToolError('This PDF could not be read. It may be damaged. Try Repair PDF, or upload a different file.', { href: '/repair-pdf', label: 'Open Repair PDF' });

/** Open a PDF for rendering with pdf.js (works on a copy: pdf.js takes ownership of the buffer). */
export async function openForView(bytes) {
  const lib = await pdfjs();
  const task = lib.getDocument({
    data: new Uint8Array(bytes).slice(),
    cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true,
    standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
    wasmUrl: '/vendor/pdfjs/wasm/', iccUrl: '/vendor/pdfjs/iccs/',
    isEvalSupported: false, enableXfa: false,
    fontExtraProperties: true, // font names, so edited text keeps bold/regular
  });
  try {
    return await task.promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') throw LOCKED();
    throw DAMAGED();
  }
}

/** Open a PDF for editing with pdf-lib. */
export async function openForEdit(bytes) {
  const { PDFDocument } = await pdfLib();
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (e && /encrypt/i.test(`${e.name} ${e.message}`)) throw LOCKED();
    throw DAMAGED();
  }
}

/** Render one pdf.js page into a new canvas no wider/taller than `box` CSS px (or at `scale`). */
export async function renderPage(page, { box, scale, rotation = 0, background = '#ffffff' } = {}) {
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
  const s = scale || Math.min(box / base.width, box / base.height);
  const dpr = scale ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: s * dpr, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, background }).promise;
  return canvas;
}

export const canvasToBlob = (canvas, type = 'image/png', quality) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new ToolError('Your device ran out of memory while drawing this page. Try a lower quality setting.'))), type, quality);
});

/**
 * "1-3, 5, 8-" -> [0,1,2,4,7,...] (0-based, in the order typed, no duplicates).
 * Throws a ToolError with a helpful message for invalid input.
 */
export function parsePages(text, total, { allowEmpty = true } = {}) {
  const s = String(text || '').trim();
  if (!s) {
    if (allowEmpty) return [...Array(total).keys()];
    throw new ToolError('Please type the pages you want, for example 1-3, 5.');
  }
  const out = [];
  const seen = new Set();
  for (const part of s.split(/[,;]+/).map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d+)?\s*(?:(-)\s*(\d+)?)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) throw new ToolError(`“${part}” isn’t a page range. Use numbers like 2, 4-6 or 9-.`);
    const a = m[1] ? Number(m[1]) : 1;
    const b = m[2] ? (m[3] ? Number(m[3]) : total) : a;
    if (a < 1 || b < 1 || a > total || b > total) throw new ToolError(`This PDF has ${total} page${total === 1 ? '' : 's'}. “${part}” is outside that.`);
    const step = a <= b ? 1 : -1;
    for (let i = a; step > 0 ? i <= b : i >= b; i += step) if (!seen.has(i)) { seen.add(i); out.push(i - 1); }
  }
  return out;
}

/** Group ranges for split: "1-3, 4-8" -> [[0,1,2],[3..7]] */
export function parseRanges(text, total) {
  const s = String(text || '').trim();
  if (!s) throw new ToolError('Please type at least one page range, for example 1-3, 4-6.');
  return s.split(/[,;]+/).map((p) => p.trim()).filter(Boolean).map((p) => parsePages(p, total, { allowEmpty: false }));
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

export function baseName(name) {
  return String(name || 'file').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 100) || 'file';
}

/** Build a ZIP from [{ name, blob }] (names made unique). */
export async function zipBlobs(entries, onProgress) {
  const JSZip = await jszip();
  const zip = new JSZip();
  const used = new Set();
  for (const e of entries) {
    let name = e.name;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = e.name.replace(/(\.[^.]+)?$/, `-${i}$1`);
    used.add(name.toLowerCase());
    zip.file(name, e.blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (m) => onProgress && onProgress(m.percent / 100));
}

/** Let the browser paint between heavy steps. */
export const tick = () => new Promise((r) => setTimeout(r, 0));

export const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' });

/** Hex color -> pdf-lib rgb() */
export async function color(hex) {
  const { rgb } = await pdfLib();
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '') || [0, '000000'];
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Maps "visual" coordinates (as the page is displayed, origin bottom-left, after /Rotate)
 * to the page's own user space, so added content lands where the visitor sees it.
 * `rot` is added to any drawing rotation so text and images appear upright.
 */
export function placer(page) {
  const box = page.getCropBox();
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  const W = box.width; const H = box.height; const x0 = box.x; const y0 = box.y;
  const vw = r === 90 || r === 270 ? H : W;
  const vh = r === 90 || r === 270 ? W : H;
  const toUser = (vx, vy) => {
    if (r === 90) return { x: x0 + (W - vy), y: y0 + vx };
    if (r === 180) return { x: x0 + (W - vx), y: y0 + (H - vy) };
    if (r === 270) return { x: x0 + vy, y: y0 + (H - vx) };
    return { x: x0 + vx, y: y0 + vy };
  };
  return { vw, vh, rot: r, toUser };
}

/** Is `text` drawable with a standard PDF font (WinAnsi)? Otherwise a Unicode font is embedded. */
export function isWinAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return /^[ -~ -ÿ–—‘’“”•…€\n\r\t]*$/.test(text);
}

/** Font for `text` in `doc`: Helvetica (or the given standard font) when possible, DejaVu Sans otherwise. */
export async function fontFor(doc, text, standard = 'Helvetica', cache = {}) {
  const { StandardFonts } = await pdfLib();
  if (isWinAnsi(text)) {
    if (!cache[standard]) cache[standard] = await doc.embedFont(StandardFonts[standard] || StandardFonts.Helvetica);
    return cache[standard];
  }
  if (!cache.unicode) {
    const fk = await fontkit();
    doc.registerFontkit(fk);
    const bytes = await fetch('/fonts/DejaVuSans.ttf').then((r) => { if (!r.ok) throw new Error('font'); return r.arrayBuffer(); });
    cache.unicode = await doc.embedFont(bytes, { subset: true });
  }
  return cache.unicode;
}
