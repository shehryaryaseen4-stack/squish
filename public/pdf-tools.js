// PDF tools: one page per tool (/split-pdf, /protect-pdf ...), the markup comes from pages.js
// (pdfToolBox). Split, extract, organize and crop run here in the browser: pdf.js draws the page
// previews and pdf-lib (window.PDFLib) writes the new PDF, so the file is never uploaded.
// Protect, unlock, repair and PDF/A send the file to /api/pdf-tool.

const root = document.getElementById('pt');
const $ = (sel, el = root) => el.querySelector(sel);
const $$ = (sel, el = root) => [...el.querySelectorAll(sel)];
const OP = root.dataset.op, NAME = root.dataset.name, BROWSER = 'browser' in root.dataset;
const MAX = Number(root.dataset.maxMb || 40) * 1024 * 1024;
const VENDOR = '/vendor/';

const drop = $('[data-drop]'), work = $('[data-work]'), done = $('[data-done]'), input = $('[data-input]');
const form = $('[data-opts]'), msg = $('[data-msg]'), go = $('[data-go]'), list = $('[data-pages]');

let file = null, bytes = null, srcDoc = null, view = null, count = 0, url = '';

// ------------------------------------------------------------------ helpers --
const say = (text, bad = true) => { msg.innerHTML = text; msg.classList.toggle('bad', !!text && bad); };
const sizeText = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const baseName = (name) => (name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'document');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const busy = (on, text) => { go.disabled = on; go.classList.toggle('is-busy', on); if (text !== undefined) say(text, false); };
const wait = (test) => new Promise((resolve) => { const t = () => (test() ? resolve() : setTimeout(t, 50)); t(); });

let pdfjs = null;
async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(`${VENDOR}pdfjs/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${VENDOR}pdfjs/pdf.worker.min.mjs`;
  return pdfjs;
}

// "1-3, 5, 8-" -> [[0,1,2],[4],[7..n-1]] (0-based); throws a message for the visitor.
function parseRanges(text, n) {
  const parts = text.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error('Type the pages, for example 1-3, 4-8, 9.');
  return parts.map((part) => {
    const m = /^(\d*)\s*(?:-|–|to)\s*(\d*)$/.exec(part) || /^(\d+)$/.exec(part);
    if (!m) throw new Error(`"${part}" is not a page or a range. Use numbers like 2 or 4-7.`);
    const a = Number(m[1] || 1), b = m[2] === undefined ? a : Number(m[2] || n);
    if (a < 1 || b < 1 || a > n || b > n) throw new Error(`"${part}" is outside this PDF: it has ${plural(n, 'page')}.`);
    const out = [];
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(i - 1);
    return out;
  });
}
// [0,1,2,4] -> "1-3, 5"
function rangeText(idx) {
  const s = [...idx].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${s[i] + 1}-${s[j] + 1}` : `${s[i] + 1}`);
    i = j;
  }
  return out.join(', ');
}

function saveBlob(blob, name, text) {
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(blob);
  const a = $('[data-dl]');
  a.href = url; a.download = name;
  $('[data-done-text]').textContent = text;
  work.hidden = true; done.hidden = false;
  done.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  a.click();
  window.dispatchEvent(new CustomEvent('pt:done', { detail: NAME }));
}

function reset() {
  mfiles = [];
  file = bytes = srcDoc = null; count = 0;
  if (view) { try { (view.loadingTask || view).destroy(); } catch { /* already closed */ } view = null; }
  if (list) list.innerHTML = '';
  if (thumbObserver) thumbObserver.disconnect();
  form.reset(); syncForm();
  say('');
  drop.hidden = false; work.hidden = true; done.hidden = true;
  input.value = '';
}

// --------------------------------------------------------------- open file --
async function open(f) {
  if (!f) return;
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { dropSay('Please choose a PDF file.'); return; }
  if (f.size > MAX) { dropSay(`This file is ${sizeText(f.size)}; the limit is ${sizeText(MAX)}.`); return; }
  dropSay('');
  file = f;
  $('[data-fname]').textContent = f.name;
  $('[data-fmeta]').textContent = sizeText(f.size);
  if (!BROWSER) { drop.hidden = true; work.hidden = false; say(''); (form.querySelector('input') || go).focus(); return; }

  dropSay('Opening your PDF...', false);
  try {
    bytes = new Uint8Array(await f.arrayBuffer());
    await wait(() => window.PDFLib);
    try {
      srcDoc = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    } catch (e) {
      if (/encrypt/i.test(e.message || '')) throw new Error('This PDF is password-protected. Remove the password first with <a href="/unlock-pdf">Unlock PDF</a>, then try again.');
      throw new Error('This PDF could not be read. It may be damaged; try <a href="/repair-pdf">Repair PDF</a> first.');
    }
    count = srcDoc.getPageCount();
    if (!count) throw new Error('This PDF has no pages.');
    const lib = await loadPdfjs();
    view = await lib.getDocument({ data: bytes.slice(), cMapUrl: `${VENDOR}pdfjs/cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${VENDOR}pdfjs/standard_fonts/`, wasmUrl: `${VENDOR}pdfjs/wasm/`, iccUrl: `${VENDOR}pdfjs/iccs/` }).promise;
  } catch (e) {
    file = null; dropSay(e.message || 'This PDF could not be opened.'); return;
  }
  $('[data-fmeta]').textContent = `${plural(count, 'page')} · ${sizeText(f.size)}`;
  dropSay('');
  drop.hidden = true; work.hidden = false; say('');
  setup[OP]();
}
function dropSay(text, bad = true) {
  let p = $('.pt-drop-msg');
  if (!p) { p = document.createElement('p'); p.className = 'pt-drop-msg'; p.setAttribute('role', 'alert'); drop.append(p); }
  p.innerHTML = text; p.classList.toggle('bad', bad);
}

$('[data-pick]').addEventListener('click', () => input.click());
input.addEventListener('change', () => (OP === 'merge' ? addFiles([...input.files]) : open(input.files[0])));
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); if (OP === 'merge') addFiles([...e.dataTransfer.files]); else open(e.dataTransfer.files[0]); });
$$('[data-again]').forEach((b) => b.addEventListener('click', reset));
$$('[data-eye]').forEach((b) => b.addEventListener('click', () => {
  const i = b.previousElementSibling, show = i.type === 'password';
  i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}));

// Show the fields that belong to the chosen option (split: ranges / pages per file).
function syncForm() {
  const mode = form.elements.mode ? form.elements.mode.value : '';
  $$('[data-when]').forEach((el) => { el.hidden = el.dataset.when !== mode; });
}
form.addEventListener('change', () => { syncForm(); if (OP === 'split') markParts(); });
form.addEventListener('input', (e) => { if (OP === 'split') markParts(); if (OP === 'extract' && e.target.name === 'pages') typedPages(); });
syncForm();

// -------------------------------------------------------------- thumbnails --
let thumbObserver = null;
async function drawThumb(canvas, index, width = 150) {
  try {
    const page = await view.getPage(index + 1);
    const vp1 = page.getViewport({ scale: 1 });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vp = page.getViewport({ scale: (width * dpr) / vp1.width });
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
    canvas.classList.add('is-drawn');
  } catch { /* the file was closed meanwhile */ }
}
function thumbCard(index, extra = '') {
  const li = document.createElement('li');
  li.className = 'pt-page';
  li.dataset.i = index;
  li.innerHTML = `<div class="pt-thumb"><canvas width="150" height="200" aria-hidden="true"></canvas></div><span class="pt-num">${index + 1}</span>${extra}`;
  return li;
}
function observe(li, index) {
  if (!thumbObserver) {
    thumbObserver = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      thumbObserver.unobserve(en.target);
      drawThumb(en.target.querySelector('canvas'), Number(en.target.dataset.src ?? en.target.dataset.i));
    }), { rootMargin: '300px' });
  }
  thumbObserver.observe(li);
}
function allThumbs(extra) {
  list.innerHTML = '';
  for (let i = 0; i < count; i++) { const li = thumbCard(i, extra); list.append(li); observe(li, i); }
}

// ------------------------------------------------------------------- tools --
const setup = {
  split() { allThumbs(); markParts(); },
  extract() {
    allThumbs('<span class="pt-tick" aria-hidden="true">&#10003;</span>');
    $$('.pt-page', list).forEach((li) => { li.tabIndex = 0; li.setAttribute('role', 'checkbox'); li.setAttribute('aria-checked', 'false'); li.setAttribute('aria-label', `Page ${Number(li.dataset.i) + 1}`); });
    picked.clear(); showPicked();
  },
  organize() { buildOrganize(); },
  crop() { cropPage = 0; cropBox = { l: 0.05, t: 0.05, r: 0.95, b: 0.95 }; showCropPage(); },
  protect() {}, unlock() {}, repair() {}, pdfa() {},
};

// Split ------------------------------------------------------------------------
function splitParts() {
  const mode = form.elements.mode.value;
  if (mode === 'each') return [...Array(count).keys()].map((i) => [i]);
  if (mode === 'every') {
    const n = Math.max(1, Math.floor(Number(form.elements.every.value) || 1)), out = [];
    for (let i = 0; i < count; i += n) out.push([...Array(Math.min(n, count - i)).keys()].map((k) => i + k));
    return out;
  }
  return parseRanges(form.elements.ranges.value, count);
}
function markParts() {
  if (!count) return;
  $$('.pt-page', list).forEach((li) => { li.removeAttribute('data-part'); li.querySelector('.pt-part')?.remove(); });
  let parts;
  try { parts = splitParts(); } catch (e) { say(form.elements.ranges.value.trim() ? e.message : 'Type the page ranges you want, for example 1-3, 4-8, 9.'); return; }
  parts.forEach((pages, k) => pages.forEach((i) => {
    const li = list.children[i];
    if (!li || li.dataset.part) return;
    li.dataset.part = k % 6;
    if (i === pages[0]) li.insertAdjacentHTML('beforeend', `<span class="pt-part">File ${k + 1}</span>`);
  }));
  say(parts.length === 1 ? 'This makes 1 PDF file.' : `This makes ${parts.length} PDF files, downloaded together as a ZIP.`, false);
}
async function runSplit() {
  const parts = splitParts();
  const base = baseName(file.name), files = [];
  for (let k = 0; k < parts.length; k++) {
    busy(true, `Making file ${k + 1} of ${parts.length}...`);
    const doc = await window.PDFLib.PDFDocument.create();
    (await doc.copyPages(srcDoc, parts[k])).forEach((p) => doc.addPage(p));
    const pages = parts[k], label = pages.length === 1 ? `page-${pages[0] + 1}` : `pages-${rangeText(pages).replace(/, /g, '_')}`;
    files.push([`${base}-${label}.pdf`, await doc.save()]);
  }
  if (files.length === 1) return saveBlob(new Blob([files[0][1]], { type: 'application/pdf' }), files[0][0], 'Your PDF has been split.');
  busy(true, 'Packing the ZIP file...');
  await wait(() => window.JSZip);
  const zip = new window.JSZip();
  files.forEach(([n, b]) => zip.file(n, b));
  saveBlob(await zip.generateAsync({ type: 'blob' }), `${base}-split.zip`, `${plural(files.length, 'PDF file')} in one ZIP file.`);
}

// Extract ------------------------------------------------------------------
const picked = new Set();
function showPicked() {
  $$('.pt-page', list).forEach((li) => { const on = picked.has(Number(li.dataset.i)); li.classList.toggle('is-picked', on); li.setAttribute('aria-checked', String(on)); });
  go.textContent = picked.size ? `Extract ${plural(picked.size, 'page')}` : 'Extract pages';
  say(picked.size ? '' : 'Click the pages you want to keep, or type them above.', false);
}
function typedPages() {
  picked.clear();
  const v = form.elements.pages.value.trim();
  if (v) { try { parseRanges(v, count).flat().forEach((i) => picked.add(i)); } catch (e) { showPicked(); say(e.message); return; } }
  showPicked();
}
function togglePick(li) {
  const i = Number(li.dataset.i);
  if (picked.has(i)) picked.delete(i); else picked.add(i);
  form.elements.pages.value = rangeText(picked);
  showPicked();
}
if (OP === 'extract') {
  list.addEventListener('click', (e) => { const li = e.target.closest('.pt-page'); if (li) togglePick(li); });
  list.addEventListener('keydown', (e) => { const li = e.target.closest('.pt-page'); if (li && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); togglePick(li); } });
  $('[data-all]').addEventListener('click', () => { for (let i = 0; i < count; i++) picked.add(i); form.elements.pages.value = rangeText(picked); showPicked(); });
  $('[data-none]').addEventListener('click', () => { picked.clear(); form.elements.pages.value = ''; showPicked(); });
}
async function runExtract() {
  if (!picked.size) throw new Error('Choose at least one page first.');
  const pages = [...picked].sort((a, b) => a - b), base = baseName(file.name);
  if (form.elements.separate.checked && pages.length > 1) {
    await wait(() => window.JSZip);
    const zip = new window.JSZip();
    for (const i of pages) {
      busy(true, `Saving page ${i + 1}...`);
      const doc = await window.PDFLib.PDFDocument.create();
      doc.addPage((await doc.copyPages(srcDoc, [i]))[0]);
      zip.file(`${base}-page-${i + 1}.pdf`, await doc.save());
    }
    return saveBlob(await zip.generateAsync({ type: 'blob' }), `${base}-pages.zip`, `${plural(pages.length, 'page')}, each as its own PDF, in one ZIP file.`);
  }
  busy(true, 'Saving your pages...');
  const doc = await window.PDFLib.PDFDocument.create();
  (await doc.copyPages(srcDoc, pages)).forEach((p) => doc.addPage(p));
  saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), `${base}-pages-${rangeText(pages).replace(/, /g, '_')}.pdf`.slice(0, 120),
    `A new PDF with ${plural(pages.length, 'page')} (${rangeText(pages)}).`);
}

// Organize -----------------------------------------------------------------
// items: { src: page index or -1 for a blank page, rot: extra rotation, el }
let items = [];
const ORG_BTNS = `<div class="pt-tools">
  <button type="button" data-a="left" aria-label="Move left">&larr;</button><button type="button" data-a="rot" aria-label="Rotate">&#8635;</button>
  <button type="button" data-a="blank" aria-label="Add a blank page after this one">+</button><button type="button" data-a="del" aria-label="Delete page">&times;</button>
  <button type="button" data-a="right" aria-label="Move right">&rarr;</button></div>`;
function orgCard(src) {
  const li = src >= 0 ? thumbCard(src, ORG_BTNS) : (() => {
    const b = document.createElement('li');
    b.className = 'pt-page pt-blank';
    b.innerHTML = `<div class="pt-thumb"><span>Blank page</span></div><span class="pt-num"></span>${ORG_BTNS}`;
    return b;
  })();
  li.draggable = true;
  if (src >= 0) { li.dataset.src = src; observe(li, src); }
  const it = { src, rot: 0, el: li };
  li._item = it;
  return it;
}
function buildOrganize() {
  list.innerHTML = '';
  list.classList.add('pt-org');
  items = [...Array(count).keys()].map((i) => orgCard(i));
  items.forEach((it) => list.append(it.el));
  renumber();
}
function renumber() {
  items.forEach((it, k) => {
    it.el.querySelector('.pt-num').textContent = String(k + 1);
    it.el.querySelector('.pt-thumb').style.transform = it.rot ? `rotate(${it.rot}deg)${it.rot % 180 ? ' scale(.75)' : ''}` : '';
    it.el.querySelector('[data-a="left"]').disabled = k === 0;
    it.el.querySelector('[data-a="right"]').disabled = k === items.length - 1;
  });
  const kept = items.length;
  say(kept ? `${plural(kept, 'page')} in the new PDF.` : 'Every page has been deleted. Click Reset to start again.', !kept);
  go.disabled = !kept;
}
function placeItems() { items.forEach((it) => list.append(it.el)); renumber(); }
if (OP === 'organize') {
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    const it = b.closest('.pt-page')._item, k = items.indexOf(it);
    if (b.dataset.a === 'left' && k > 0) [items[k - 1], items[k]] = [items[k], items[k - 1]];
    if (b.dataset.a === 'right' && k < items.length - 1) [items[k + 1], items[k]] = [items[k], items[k + 1]];
    if (b.dataset.a === 'rot') it.rot = (it.rot + 90) % 360;
    if (b.dataset.a === 'del') { items.splice(k, 1); it.el.remove(); }
    if (b.dataset.a === 'blank') items.splice(k + 1, 0, orgCard(-1));
    placeItems();
    if (b.isConnected) b.focus();
  });
  let dragged = null;
  list.addEventListener('dragstart', (e) => { dragged = e.target.closest('.pt-page'); if (!dragged) return; dragged.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch { /* old browsers */ } });
  list.addEventListener('dragend', () => { if (dragged) dragged.classList.remove('is-drag'); dragged = null; items = [...list.children].map((li) => li._item); renumber(); });
  list.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const over = e.target.closest('.pt-page');
    if (!over || over === dragged) return;
    const r = over.getBoundingClientRect();
    list.insertBefore(dragged, e.clientX > r.left + r.width / 2 ? over.nextSibling : over);
  });
  list.addEventListener('drop', (e) => e.preventDefault());
  $('[data-reset-pages]').addEventListener('click', () => buildOrganize());
}
async function runOrganize() {
  if (!items.length) throw new Error('There are no pages left. Click Reset to start again.');
  busy(true, 'Saving your PDF...');
  const { PDFDocument, degrees } = window.PDFLib;
  const doc = await PDFDocument.create();
  const srcIdx = items.filter((it) => it.src >= 0).map((it) => it.src);
  const copied = await doc.copyPages(srcDoc, srcIdx);
  let c = 0, last = srcDoc.getPage(0).getSize();
  for (const it of items) {
    if (it.src < 0) { const p = doc.addPage([last.width, last.height]); if (it.rot) p.setRotation(degrees(it.rot)); continue; }
    const p = copied[c++];
    last = p.getSize();
    if (it.rot) p.setRotation(degrees((p.getRotation().angle + it.rot) % 360));
    doc.addPage(p);
  }
  saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), `${baseName(file.name)}-organized.pdf`, `Your PDF with ${plural(items.length, 'page')} in the new order.`);
}

// Crop -----------------------------------------------------------------------
// cropBox is in fractions of the page as shown (0..1 from the left and from the top).
let cropPage = 0, cropBox = { l: 0.05, t: 0.05, r: 0.95, b: 0.95 };
const stage = OP === 'crop' ? $('[data-stage]') : null;
const boxEl = OP === 'crop' ? $('[data-box]') : null;
function placeBox() {
  Object.assign(boxEl.style, { left: `${cropBox.l * 100}%`, top: `${cropBox.t * 100}%`, width: `${(cropBox.r - cropBox.l) * 100}%`, height: `${(cropBox.b - cropBox.t) * 100}%` });
}
async function showCropPage() {
  $('[data-pageno]').textContent = `Page ${cropPage + 1} of ${count}`;
  $('[data-prev]').disabled = cropPage === 0;
  $('[data-next]').disabled = cropPage >= count - 1;
  const canvas = $('canvas', stage);
  const vp = (await view.getPage(cropPage + 1)).getViewport({ scale: 1 });
  const width = Math.round(Math.min(560, stage.parentElement.clientWidth - 2 || 560, Math.max(260, window.innerHeight * 0.68) * (vp.width / vp.height)));
  await drawThumb(canvas, cropPage, width);
  canvas.style.width = `${width}px`;
  placeBox();
  say('Drag the box, then click Crop PDF.', false);
}
if (OP === 'crop') {
  $('[data-prev]').addEventListener('click', () => { if (cropPage > 0) { cropPage--; showCropPage(); } });
  $('[data-next]').addEventListener('click', () => { if (cropPage < count - 1) { cropPage++; showCropPage(); } });
  $('[data-crop-reset]').addEventListener('click', () => { cropBox = { l: 0.05, t: 0.05, r: 0.95, b: 0.95 }; placeBox(); });
  const MIN = 0.05;
  let drag = null;
  boxEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    drag = { h: e.target.dataset.h || 'move', x: e.clientX, y: e.clientY, w: r.width, hgt: r.height, start: { ...cropBox } };
    boxEl.setPointerCapture(e.pointerId);
  });
  boxEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / drag.w, dy = (e.clientY - drag.y) / drag.hgt, s = drag.start, b = { ...s };
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    if (drag.h === 'move') {
      const w = s.r - s.l, h = s.b - s.t;
      b.l = clamp(s.l + dx, 0, 1 - w); b.r = b.l + w; b.t = clamp(s.t + dy, 0, 1 - h); b.b = b.t + h;
    } else {
      if (drag.h.includes('w')) b.l = clamp(s.l + dx, 0, s.r - MIN);
      if (drag.h.includes('e')) b.r = clamp(s.r + dx, s.l + MIN, 1);
      if (drag.h.includes('n')) b.t = clamp(s.t + dy, 0, s.b - MIN);
      if (drag.h.includes('s')) b.b = clamp(s.b + dy, s.t + MIN, 1);
    }
    cropBox = b; placeBox();
  });
  const end = () => { drag = null; };
  boxEl.addEventListener('pointerup', end);
  boxEl.addEventListener('pointercancel', end);
  // Arrow keys move the box (Shift: make it smaller from the right/bottom).
  boxEl.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const st = 0.01, b = { ...cropBox };
    if (e.shiftKey) { b.r = Math.max(b.l + MIN, Math.min(1, b.r + d[0] * st)); b.b = Math.max(b.t + MIN, Math.min(1, b.b + d[1] * st)); } else {
      const w = b.r - b.l, h = b.b - b.t;
      b.l = Math.min(1 - w, Math.max(0, b.l + d[0] * st)); b.r = b.l + w; b.t = Math.min(1 - h, Math.max(0, b.t + d[1] * st)); b.b = b.t + h;
    }
    cropBox = b; placeBox();
  });
  window.addEventListener('resize', () => { if (count && !work.hidden) showCropPage(); });
}
// A corner as shown (u from the left, v from the top) -> fractions of the unrotated page (x from the left, y from the bottom).
function unrotate(u, v, rot) {
  switch (((rot % 360) + 360) % 360) {
    case 90: return [v, u];
    case 180: return [1 - u, v];
    case 270: return [1 - v, 1 - u];
    default: return [u, 1 - v];
  }
}
async function runCrop() {
  busy(true, 'Cropping...');
  const doc = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
  const pages = form.elements.apply.value === 'one' ? [cropPage] : [...Array(count).keys()];
  for (const i of pages) {
    const p = doc.getPage(i), base = p.getCropBox(), rot = p.getRotation().angle;
    const [x1, y1] = unrotate(cropBox.l, cropBox.t, rot), [x2, y2] = unrotate(cropBox.r, cropBox.b, rot);
    const x = base.x + Math.min(x1, x2) * base.width, y = base.y + Math.min(y1, y2) * base.height;
    const w = Math.abs(x2 - x1) * base.width, h = Math.abs(y2 - y1) * base.height;
    p.setMediaBox(x, y, w, h);
    p.setCropBox(x, y, w, h);
  }
  saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), `${baseName(file.name)}-cropped.pdf`,
    pages.length === 1 && count > 1 ? `Page ${cropPage + 1} has been cropped.` : `${plural(pages.length, 'page')} cropped.`);
}

// Server tools ---------------------------------------------------------------
async function runServer() {
  const fd = new FormData();
  fd.append('op', OP);
  if (OP === 'protect') {
    const pw = form.elements.password.value, again = form.elements.confirm.value;
    if (pw.length < 4) { form.elements.password.focus(); throw new Error('Use a password of at least 4 characters.'); }
    if (pw !== again) { form.elements.confirm.focus(); throw new Error('The two passwords are not the same. Type them again.'); }
    fd.append('password', pw);
  }
  if (OP === 'unlock') fd.append('password', form.elements.password.value);
  if (OP === 'pdfa') fd.append('level', form.elements.level.value);
  fd.append('file', file, file.name);
  busy(true, OP === 'repair' ? 'Repairing your PDF...' : 'Working on your PDF...');
  let res;
  try { res = await fetch('/api/pdf-tool', { method: 'POST', body: fd }); } catch { throw new Error('Could not reach the server. Check your internet connection and try again.'); }
  if (!res.ok) {
    let text = 'Something went wrong. Please try again.';
    try { text = (await res.json()).error || text; } catch { /* not JSON */ }
    throw new Error(text.replace(/Unlock PDF/, '<a href="/unlock-pdf">Unlock PDF</a>').replace(/Repair PDF/, '<a href="/repair-pdf">Repair PDF</a>'));
  }
  const name = (/filename\*=UTF-8''([^;]+)/.exec(res.headers.get('content-disposition') || '') || [])[1];
  const note = res.headers.get('x-note');
  const DONE = { protect: 'Your PDF is now protected with a password.', unlock: 'The password has been removed.', repair: 'Your PDF has been repaired. Open it and check the pages.', pdfa: 'Your PDF/A file is ready.' };
  saveBlob(await res.blob(), name ? decodeURIComponent(name) : `${baseName(file.name)}.pdf`, note || DONE[OP]);
  form.reset();
}


// Merge ----------------------------------------------------------------------
// mfiles: { file, doc (pdf-lib), pages, el } in the order they will be merged.
let mfiles = [];
const FILE_BTNS = `<div class="pt-tools">
  <button type="button" data-m="left" aria-label="Move earlier">&larr;</button><button type="button" data-m="del" aria-label="Remove this file">&times;</button>
  <button type="button" data-m="right" aria-label="Move later">&rarr;</button></div>`;
async function firstPageThumb(bytes, canvas) {
  try {
    const lib = await loadPdfjs();
    const task = lib.getDocument({ data: bytes, cMapUrl: `${VENDOR}pdfjs/cmaps/`, cMapPacked: true, standardFontDataUrl: `${VENDOR}pdfjs/standard_fonts/`, wasmUrl: `${VENDOR}pdfjs/wasm/`, iccUrl: `${VENDOR}pdfjs/iccs/` });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vp = page.getViewport({ scale: (150 * dpr) / page.getViewport({ scale: 1 }).width });
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
    canvas.classList.add('is-drawn');
    task.destroy();
  } catch { /* the preview is optional */ }
}
async function addFiles(files) {
  if (!files.length) return;
  const bad = [];
  if (!mfiles.length) dropSay('Opening your PDFs...', false);
  await wait(() => window.PDFLib);
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { bad.push(`${f.name} is not a PDF`); continue; }
    if (f.size > MAX) { bad.push(`${f.name} is larger than ${sizeText(MAX)}`); continue; }
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let doc;
      try { doc = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false }); } catch (e) {
        bad.push(/encrypt/i.test(e.message || '') ? `${f.name} has a password (<a href="/unlock-pdf">unlock it</a> first)` : `${f.name} could not be read`);
        continue;
      }
      const li = document.createElement('li');
      li.className = 'pt-page pt-file';
      li.draggable = true;
      li.innerHTML = `<div class="pt-thumb"><canvas width="150" height="200" aria-hidden="true"></canvas></div><span class="pt-fn"></span><span class="pt-num">${plural(doc.getPageCount(), 'page')}</span>${FILE_BTNS}`;
      li.querySelector('.pt-fn').textContent = f.name;
      li.title = f.name;
      const it = { file: f, doc, pages: doc.getPageCount(), el: li };
      li._item = it;
      mfiles.push(it);
      list.append(li);
      firstPageThumb(bytes.slice(), li.querySelector('canvas'));
    } catch { bad.push(`${f.name} could not be opened`); }
  }
  if (!mfiles.length) { dropSay(bad.join('; ') || 'Please choose PDF files.'); input.value = ''; return; }
  dropSay('');
  drop.hidden = true; work.hidden = false;
  showFiles(bad.length ? `Not added: ${bad.join('; ')}.` : '');
  input.value = '';
}
function showFiles(note = '') {
  mfiles.forEach((it, k) => {
    it.el.querySelector('[data-m="left"]').disabled = k === 0;
    it.el.querySelector('[data-m="right"]').disabled = k === mfiles.length - 1;
  });
  const pages = mfiles.reduce((n, it) => n + it.pages, 0), size = mfiles.reduce((n, it) => n + it.file.size, 0);
  $('[data-fname]').textContent = plural(mfiles.length, 'PDF file');
  $('[data-fmeta]').textContent = `${plural(pages, 'page')} · ${sizeText(size)}`;
  go.disabled = mfiles.length < 2;
  if (note) say(note);
  else say(mfiles.length < 2 ? 'Add at least one more PDF to merge.' : `${plural(mfiles.length, 'file')} will be merged into one PDF of ${plural(pages, 'page')}.`, false);
}
if (OP === 'merge') {
  const addInput = $('[data-add-input]');
  $('[data-add]').addEventListener('click', () => addInput.click());
  addInput.addEventListener('change', () => { addFiles([...addInput.files]); addInput.value = ''; });
  work.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  work.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-m]');
    if (!b) return;
    const it = b.closest('.pt-page')._item, k = mfiles.indexOf(it);
    if (b.dataset.m === 'left' && k > 0) [mfiles[k - 1], mfiles[k]] = [mfiles[k], mfiles[k - 1]];
    if (b.dataset.m === 'right' && k < mfiles.length - 1) [mfiles[k + 1], mfiles[k]] = [mfiles[k], mfiles[k + 1]];
    if (b.dataset.m === 'del') { mfiles.splice(k, 1); it.el.remove(); }
    mfiles.forEach((x) => list.append(x.el));
    if (!mfiles.length) { reset(); return; }
    showFiles();
    if (b.isConnected) b.focus();
  });
  let dragged = null;
  list.addEventListener('dragstart', (e) => { dragged = e.target.closest('.pt-page'); if (!dragged) return; dragged.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch { /* old browsers */ } });
  list.addEventListener('dragend', () => { if (dragged) dragged.classList.remove('is-drag'); dragged = null; mfiles = [...list.children].map((li) => li._item); showFiles(); });
  list.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const over = e.target.closest('.pt-page');
    if (!over || over === dragged) return;
    const r = over.getBoundingClientRect();
    list.insertBefore(dragged, e.clientX > r.left + r.width / 2 ? over.nextSibling : over);
  });
}
async function runMerge() {
  if (mfiles.length < 2) throw new Error('Add at least two PDFs to merge.');
  const doc = await window.PDFLib.PDFDocument.create();
  for (let k = 0; k < mfiles.length; k++) {
    busy(true, `Adding file ${k + 1} of ${mfiles.length}...`);
    const src = mfiles[k].doc;
    (await doc.copyPages(src, src.getPageIndices())).forEach((p) => doc.addPage(p));
  }
  busy(true, 'Saving the merged PDF...');
  const pages = doc.getPageCount();
  saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), `${baseName(mfiles[0].file.name)}-merged.pdf`,
    `${plural(mfiles.length, 'PDF')} combined into one PDF of ${plural(pages, 'page')}.`);
}

const RUN = { merge: runMerge, split: runSplit, extract: runExtract, organize: runOrganize, crop: runCrop, protect: runServer, unlock: runServer, repair: runServer, pdfa: runServer };
go.addEventListener('click', async () => {
  if ((OP === 'merge' ? !mfiles.length : !file) || go.disabled) return;
  try {
    await RUN[OP]();
    busy(false, '');
  } catch (e) {
    busy(false);
    say(e.message || 'Something went wrong. Please try again.');
  }
});
form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') { e.preventDefault(); go.click(); } });
