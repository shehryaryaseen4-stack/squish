// The PDF page editor used by Edit PDF, Add Text/Image/Shapes, Sign, Highlight, Annotate and
// Redact. Everything happens in the browser:
//   - pages are drawn with pdf.js; added objects live in an HTML layer above each page
//   - on save, pdf-lib writes the objects into the original PDF (text stays real text,
//     notes become real PDF comments)
//   - redaction re-draws only the affected pages as images with the boxes burnt in, so the
//     covered content is really gone from the file
//
// Object coordinates are in PDF points, measured on the page as displayed (origin top-left).

import {
  pdfLib, pdfjs, openForView, openForEdit, renderPage, canvasToBlob, placer, fontFor, color, baseName, pdfBlob, tick, ToolError,
} from '../lib/pdf.js';

const svg = (d, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const TOOLS = {
  select: { label: 'Select', icon: '<path d="M5 3l14 8-6 1.5L9.5 19z"/>' },
  edittext: { label: 'Edit text', icon: '<path d="M4 7V5h10v2M9 5v12M7 17h4"/><path d="M14 20l1-3.5 5-5 2.5 2.5-5 5z"/>' },
  text: { label: 'Text', icon: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>' },
  image: { label: 'Image', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>' },
  signature: { label: 'Sign', icon: '<path d="M3 17c3-1 4-9 6-9s-1 9 2 9 3-4 5-4 1 4 3 4h2"/><path d="M3 21h18"/>' },
  rect: { label: 'Rectangle', icon: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>' },
  ellipse: { label: 'Ellipse', icon: '<ellipse cx="12" cy="12" rx="9" ry="7"/>' },
  line: { label: 'Line', icon: '<path d="M5 19L19 5"/>' },
  arrow: { label: 'Arrow', icon: '<path d="M5 19L19 5M10 5h9v9"/>' },
  draw: { label: 'Draw', icon: '<path d="M4 20c4 0 4-6 8-6s3 4 6 4 2-6 2-6"/><path d="M15 4l5 5-8 8H7v-5z"/>' },
  highlight: { label: 'Highlight', icon: '<path d="M9 14l-3 3v3h3l3-3"/><path d="M8.5 14.5 16 7l3 3-7.5 7.5z"/><path d="M14 21h7"/>' },
  whiteout: { label: 'White-out', icon: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h10" stroke-dasharray="2 2"/>' },
  note: { label: 'Note', icon: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z"/><path d="M8 8h8M8 12h5"/>' },
  redact: { label: 'Redact', icon: '<rect x="3" y="8" width="18" height="8" rx="1" fill="currentColor"/>' },
};
const UI = {
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>',
  minus: '<path d="M5 12h14"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
  note: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z"/>',
};
const FONTS = { Helvetica: 'Helvetica, Arial, sans-serif', Times: '"Times New Roman", Times, serif', Courier: '"Courier New", Courier, monospace' };
const BASELINE = { Helvetica: 0.94, Times: 0.94, Courier: 0.87 };
const HIGHLIGHTS = [['#ffe14d', 'Yellow'], ['#7cf29a', 'Green'], ['#ff9ed2', 'Pink'], ['#8fd3ff', 'Blue'], ['#ffb35c', 'Orange']];
const RECT_TYPES = new Set(['rect', 'ellipse', 'highlight', 'whiteout', 'redact', 'cover']);

let lastSignature = null; // reused within this visit, never stored

export async function mountEditor(container, fileEntry, cfg, { onChange }) {
  const bytes = await fileEntry.file.arrayBuffer();
  const view = await openForView(bytes);
  const tools = cfg.editorTools;
  const ed = {
    view, bytes, file: fileEntry.file, objects: [], selected: null, tool: cfg.defaultTool || tools[1] || 'select',
    zoom: 1, history: [], pages: [], editing: null,
    style: {
      text: { size: 16, font: 'Helvetica', bold: false, color: '#111111' },
      shape: { stroke: '#e8452c', fill: '', width: 2, opacity: 100 },
      draw: { color: '#1d4ed8', width: 3 },
      highlight: { color: '#ffe14d' },
      note: { color: '#ffd54a' },
    },
  };
  let nextId = 1;
  const isRedact = tools.includes('redact');

  // ------------------------------------------------------------------- DOM
  container.classList.add('editor');
  const toolbar = h('<div class="ed-toolbar" role="toolbar" aria-label="Editing tools"></div>');
  for (const t of tools) {
    const b = h(`<button class="ed-tool" type="button" data-tool="${t}" aria-pressed="false" title="${TOOLS[t].label}">${svg(TOOLS[t].icon)}<span>${TOOLS[t].label}</span></button>`);
    b.addEventListener('click', () => setTool(t));
    toolbar.append(b);
  }
  toolbar.append(h('<span class="ed-sep" aria-hidden="true"></span>'));
  const undoBtn = h(`<button class="ed-tool" type="button" title="Undo">${svg(UI.undo)}<span>Undo</span></button>`);
  const delBtn = h(`<button class="ed-tool" type="button" title="Delete selected">${svg(UI.trash)}<span>Delete</span></button>`);
  const zoomOut = h(`<button class="ed-tool" type="button" title="Zoom out">${svg(UI.minus)}<span>Zoom out</span></button>`);
  const zoomIn = h(`<button class="ed-tool" type="button" title="Zoom in">${svg(UI.plus)}<span>Zoom in</span></button>`);
  toolbar.append(undoBtn, delBtn, zoomOut, zoomIn);
  const props = h('<div class="ed-props" aria-live="polite"></div>');
  const pagesEl = h('<div class="ed-pages" tabindex="0" role="region" aria-label="PDF pages"></div>');
  const imgInput = h('<input type="file" hidden accept=".png,.jpg,.jpeg,image/png,image/jpeg">');
  container.append(toolbar, props, pagesEl, imgInput);

  undoBtn.addEventListener('click', undo);
  delBtn.addEventListener('click', () => removeSelected());
  zoomOut.addEventListener('click', () => setZoom(ed.zoom / 1.25));
  zoomIn.addEventListener('click', () => setZoom(ed.zoom * 1.25));
  imgInput.addEventListener('change', async () => {
    const f = imgInput.files[0];
    imgInput.value = '';
    if (f) await addImage(f);
  });

  // ------------------------------------------------------------ pages
  for (let i = 0; i < view.numPages; i++) {
    const page = await view.getPage(i + 1);
    const vp = page.getViewport({ scale: 1 });
    const pg = { index: i, page, vw: vp.width, vh: vp.height, rendered: 0 };
    pg.el = h(`<div class="ed-page" data-page="${i}"><canvas aria-hidden="true"></canvas><div class="ed-runs" aria-hidden="true"></div><div class="ed-layer" role="group" aria-label="Page ${i + 1}"></div><span class="ed-page__num">Page ${i + 1} of ${view.numPages}</span></div>`);
    pg.canvas = pg.el.querySelector('canvas');
    pg.layer = pg.el.querySelector('.ed-layer');
    pg.runsEl = pg.el.querySelector('.ed-runs');
    pagesEl.append(pg.el);
    ed.pages.push(pg);
    bindLayer(pg);
  }
  const fitScale = () => {
    const avail = Math.max(260, pagesEl.clientWidth - 24);
    const widest = Math.max(...ed.pages.map((p) => p.vw));
    return Math.min(1.3, avail / widest);
  };
  let scale = 1;
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) drawPage(ed.pages[Number(en.target.dataset.page)]); }), { root: pagesEl, rootMargin: '400px' });
  function layout() {
    finishEditing();
    scale = fitScale() * ed.zoom;
    for (const pg of ed.pages) {
      pg.el.style.width = `${pg.vw * scale}px`;
      pg.el.style.height = `${pg.vh * scale}px`;
      if (pg.rendered && Math.abs(pg.rendered - scale) > 0.01) { pg.rendered = 0; io.unobserve(pg.el); io.observe(pg.el); }
      pg.layer.querySelectorAll('.ed-obj').forEach((n) => n.remove());
    }
    ed.objects.forEach(renderObject);
    ed.pages.forEach(renderRuns);
    if (ed.selected) select(ed.selected);
  }
  async function drawPage(pg) {
    if (pg.rendered === scale || pg.drawing) return;
    pg.drawing = true;
    try {
      const target = scale;
      const c = await renderPage(pg.page, { box: Math.max(pg.vw, pg.vh) * target });
      pg.canvas.width = c.width; pg.canvas.height = c.height;
      pg.canvas.getContext('2d').drawImage(c, 0, 0);
      c.width = c.height = 0;
      pg.rendered = target;
      if (ed.tool === 'edittext') ensureRuns(pg).then(() => renderRuns(pg));
    } catch { /* page stays blank; saving still works */ } finally { pg.drawing = false; }
  }
  ed.pages.forEach((pg) => io.observe(pg.el));
  const ro = new ResizeObserver(() => { const s = fitScale() * ed.zoom; if (Math.abs(s - scale) > 0.02) layout(); });
  ro.observe(pagesEl);
  layout();

  function setZoom(z) { ed.zoom = Math.min(4, Math.max(0.4, z)); layout(); }

  // ------------------------------------------------------- existing text
  // Text already in the PDF, as pdf.js reports it: one box per run of text. Clicking a box
  // covers the original (in its own background color) and puts an editable copy on top.
  function ensureRuns(pg) {
    if (!pg.runsP) {
      pg.runsP = (async () => {
        const lib = await pdfjs();
        const vp = pg.page.getViewport({ scale: 1 });
        const tc = await pg.page.getTextContent();
        const runs = [];
        tc.items.forEach((it, i) => {
          if (!it.str || !it.str.trim() || !it.transform) return;
          const m = lib.Util.transform(vp.transform, it.transform);
          if (Math.abs(m[1]) > 0.01 || Math.abs(m[2]) > 0.01 || m[0] <= 0) return; // upright, left-to-right text only
          const size = Math.abs(m[3]);
          if (size < 1) return;
          const st = tc.styles[it.fontName] || {};
          const asc = st.ascent > 0 ? st.ascent : 0.8;
          const desc = st.descent < 0 ? st.descent : -0.2;
          runs.push({ key: `${pg.index}:${i}`, str: it.str, x: m[4], y: m[5] - size * asc, w: Math.max(it.width, size * 0.3), h: size * (asc - desc), size, baseline: m[5], fontName: it.fontName, family: st.fontFamily || '' });
        });
        pg.runs = runs;
        return runs;
      })().catch(() => { pg.runs = []; return []; });
    }
    return pg.runsP;
  }
  function renderRuns(pg) {
    pg.runsEl.textContent = '';
    if (ed.tool !== 'edittext' || !pg.runs) return;
    const used = new Set(ed.objects.map((o) => o.runKey).filter(Boolean));
    const frag = document.createDocumentFragment();
    for (const r of pg.runs) {
      if (used.has(r.key)) continue;
      const el = document.createElement('div');
      el.className = 'ed-run';
      el.dataset.key = r.key;
      Object.assign(el.style, { left: `${r.x * scale}px`, top: `${r.y * scale}px`, width: `${r.w * scale}px`, height: `${r.h * scale}px` });
      frag.append(el);
    }
    pg.runsEl.append(frag);
  }
  function runAt(pg, x, y) {
    if (!pg.runs) return null;
    const used = new Set(ed.objects.map((o) => o.runKey).filter(Boolean));
    const pad = 1.5;
    return pg.runs.find((r) => !used.has(r.key) && x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) || null;
  }
  // Background and ink colors around/inside a run, read from the rendered page.
  function sampleColors(pg, r) {
    const fallback = { bg: '#ffffff', fg: '#000000' };
    if (!pg.rendered || !pg.canvas.width) return fallback;
    try {
      const k = pg.canvas.width / pg.vw;
      const x0 = Math.max(0, Math.floor(r.x * k) - 3); const y0 = Math.max(0, Math.floor(r.y * k) - 3);
      const x1 = Math.min(pg.canvas.width, Math.ceil((r.x + r.w) * k) + 3); const y1 = Math.min(pg.canvas.height, Math.ceil((r.y + r.h) * k) + 3);
      const w = x1 - x0; const hh = y1 - y0;
      if (w < 4 || hh < 4) return fallback;
      const d = pg.canvas.getContext('2d').getImageData(x0, y0, w, hh).data;
      const counts = new Map();
      const px = (x, y) => { const o = (y * w + x) * 4; return [d[o], d[o + 1], d[o + 2]]; };
      for (let y = 0; y < hh; y++) {
        for (let x = 0; x < w; x++) {
          if (x > 1 && x < w - 2 && y > 1 && y < hh - 2) continue; // ring around the text only
          const c = px(x, y).map((v) => Math.round(v / 6) * 6);
          const key = c.join(',');
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
      const bg = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
      const dist = (c) => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
      let max = 0; const inner = [];
      for (let y = 3; y < hh - 3; y++) for (let x = 3; x < w - 3; x++) { const c = px(x, y); const dd = dist(c); inner.push([c, dd]); if (dd > max) max = dd; }
      let fg = [0, 0, 0];
      if (max > 60) {
        const ink = inner.filter(([, dd]) => dd > max * 0.7);
        fg = [0, 1, 2].map((ch) => Math.round(ink.reduce((s, [c]) => s + c[ch], 0) / ink.length));
      } else fg = (bg[0] + bg[1] + bg[2]) / 3 > 128 ? [0, 0, 0] : [255, 255, 255];
      const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
      return { bg: hex(bg), fg: hex(fg) };
    } catch { return fallback; }
  }
  function editRun(pg, r) {
    const { bg, fg } = sampleColors(pg, r);
    let bold = false;
    try { const f = pg.page.commonObjs.get(r.fontName); bold = !!(f.bold || f.black) || /bold|black|heavy|semibold|demi/i.test(f.name || ''); } catch { /* font not loaded */ }
    const font = /serif/i.test(r.family) && !/sans/i.test(r.family) ? 'Times' : /mono/i.test(r.family) ? 'Courier' : 'Helvetica';
    const pad = Math.max(0.6, r.size * 0.08);
    const padY = r.size * 0.15;
    add({ type: 'cover', page: pg.index, x: r.x - pad, y: r.y - padY, w: r.w + pad * 2, h: r.h + padY * 2, color: bg, runKey: r.key });
    const size = Math.round(r.size * 10) / 10;
    const o = add({ type: 'text', page: pg.index, x: r.x, y: r.baseline - size * BASELINE[font], w: r.w, h: size * 1.2, text: r.str, size, font, bold, color: fg, runKey: r.key });
    renderRuns(pg);
    select(o);
    startEditing(o);
  }

  // ------------------------------------------------------- objects
  const snapshot = () => { ed.history.push(ed.objects.map((o) => ({ ...o, points: o.points && o.points.map((p) => [...p]) }))); if (ed.history.length > 60) ed.history.shift(); };
  function undo() {
    if (!ed.history.length) return;
    finishEditing();
    ed.objects = ed.history.pop();
    ed.selected = null;
    layout(); renderProps(); onChange();
  }
  function add(obj) {
    snapshot();
    obj.id = nextId++;
    ed.objects.push(obj);
    renderObject(obj);
    onChange();
    return obj;
  }
  function removeSelected() {
    if (!ed.selected) return;
    snapshot();
    const id = ed.selected.id;
    ed.objects = ed.objects.filter((o) => o.id !== id);
    pagesEl.querySelector(`.ed-obj[data-id="${id}"]`)?.remove();
    ed.selected = null; ed.editing = null;
    renderProps(); onChange();
  }
  const pgOf = (o) => ed.pages[o.page];

  function bbox(o) {
    if (o.points) {
      const xs = o.points.map((p) => p[0]); const ys = o.points.map((p) => p[1]);
      const pad = (o.width || 2) / 2 + (o.type === 'arrow' ? 8 : 2);
      return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    }
    return { x: o.x, y: o.y, w: o.w, h: o.h };
  }

  function renderObject(o) {
    const pg = pgOf(o);
    pg.layer.querySelector(`.ed-obj[data-id="${o.id}"]`)?.remove();
    const b = bbox(o);
    const el = h(`<div class="ed-obj ed-obj--${o.type}" data-id="${o.id}"></div>`);
    Object.assign(el.style, { left: `${b.x * scale}px`, top: `${b.y * scale}px`, width: `${b.w * scale}px`, height: `${b.h * scale}px` });
    if (o.type === 'text') {
      Object.assign(el.style, { width: 'auto', height: 'auto', fontFamily: FONTS[o.font], fontSize: `${o.size * scale}px`, fontWeight: o.bold ? '700' : '400', color: o.color });
      el.textContent = o.text;
      el.setAttribute('role', 'textbox');
      el.setAttribute('aria-label', 'Text box');
    } else if (o.type === 'image' || o.type === 'signature') {
      el.append(h(`<img src="${o.url}" alt="" draggable="false">`));
    } else if (o.type === 'rect' || o.type === 'ellipse') {
      const sw = o.width * scale;
      el.innerHTML = `<svg viewBox="0 0 ${b.w * scale} ${b.h * scale}" preserveAspectRatio="none">${o.type === 'rect'
        ? `<rect x="${sw / 2}" y="${sw / 2}" width="${Math.max(0, b.w * scale - sw)}" height="${Math.max(0, b.h * scale - sw)}"`
        : `<ellipse cx="${b.w * scale / 2}" cy="${b.h * scale / 2}" rx="${Math.max(0, b.w * scale / 2 - sw / 2)}" ry="${Math.max(0, b.h * scale / 2 - sw / 2)}"`} fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.stroke ? sw : 0}" opacity="${o.opacity / 100}"/></svg>`;
    } else if (o.type === 'highlight') {
      el.style.background = o.color; el.style.opacity = '0.45';
    } else if (o.type === 'cover') {
      el.style.background = o.color;
    } else if (o.points) {
      const pts = o.points.map(([x, y]) => [(x - b.x) * scale, (y - b.y) * scale]);
      let body;
      if (o.type === 'draw') body = `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${o.color}" stroke-width="${o.width * scale}" stroke-linecap="round" stroke-linejoin="round"/>`;
      else {
        body = `<line x1="${pts[0][0]}" y1="${pts[0][1]}" x2="${pts[1][0]}" y2="${pts[1][1]}" stroke="${o.color}" stroke-width="${o.width * scale}" stroke-linecap="round"/>`;
        if (o.type === 'arrow') body += arrowHead(pts[0], pts[1], o.width * scale).map(([a, c]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" stroke="${o.color}" stroke-width="${o.width * scale}" stroke-linecap="round"/>`).join('');
      }
      el.innerHTML = `<svg viewBox="0 0 ${b.w * scale} ${b.h * scale}">${body}</svg>`;
    } else if (o.type === 'note') {
      el.innerHTML = svg(UI.note, Math.max(12, 16 * scale));
      el.style.background = o.color;
      el.title = o.text;
      el.setAttribute('aria-label', `Note: ${o.text}`);
    }
    pg.layer.append(el);
    if (ed.selected && ed.selected.id === o.id) decorate(el, o);
    return el;
  }

  function arrowHead(p1, p2, w) {
    const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const len = Math.max(10, w * 4);
    const a = (d) => [p2[0] - len * Math.cos(ang + d), p2[1] - len * Math.sin(ang + d)];
    return [[a(Math.PI / 7), p2], [a(-Math.PI / 7), p2]];
  }

  function decorate(el, o) {
    el.classList.add('is-selected');
    if (o.type !== 'text' && o.type !== 'note' && !o.points) el.append(h('<span class="ed-handle" data-resize aria-hidden="true"></span>'));
    const del = h(`<button class="ed-del" type="button" aria-label="Delete">${svg(UI.close, 14)}</button>`);
    del.addEventListener('pointerdown', (e) => e.stopPropagation());
    del.addEventListener('click', (e) => { e.stopPropagation(); removeSelected(); });
    el.append(del);
  }

  function select(o) {
    pagesEl.querySelectorAll('.ed-obj.is-selected').forEach((n) => { n.classList.remove('is-selected'); n.querySelectorAll('.ed-handle,.ed-del').forEach((x) => x.remove()); });
    ed.selected = o;
    if (o) {
      const el = pagesEl.querySelector(`.ed-obj[data-id="${o.id}"]`);
      if (el) decorate(el, o);
    }
    renderProps();
  }

  // ------------------------------------------------------- text editing
  function startEditing(o) {
    const el = pagesEl.querySelector(`.ed-obj[data-id="${o.id}"]`);
    if (!el) return;
    ed.editing = o;
    el.querySelectorAll('.ed-del').forEach((x) => x.remove());
    try { el.contentEditable = 'plaintext-only'; } catch { el.contentEditable = 'true'; }
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    el.addEventListener('blur', () => finishEditing(), { once: true });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); el.blur(); } e.stopPropagation(); });
  }
  function finishEditing() {
    const o = ed.editing;
    if (!o) return;
    ed.editing = null;
    const el = pagesEl.querySelector(`.ed-obj[data-id="${o.id}"]`);
    const text = el ? el.innerText.replace(/ /g, ' ').replace(/\n$/, '') : o.text;
    if (!text.trim()) { ed.objects = ed.objects.filter((x) => x.id !== o.id); el?.remove(); if (ed.selected === o) ed.selected = null; renderProps(); onChange(); return; }
    o.text = text;
    measureText(o);
    renderObject(o);
    onChange();
  }
  function measureText(o) {
    const el = pagesEl.querySelector(`.ed-obj[data-id="${o.id}"]`);
    if (el) { o.w = el.offsetWidth / scale; o.h = el.offsetHeight / scale; }
  }

  // ------------------------------------------------------- pointer input
  function bindLayer(pg) {
    // keep focus in the text box being typed into (a click on the page would otherwise blur it)
    pg.layer.addEventListener('mousedown', (e) => { if (!e.target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]')) e.preventDefault(); });
    pg.layer.addEventListener('dblclick', (e) => {
      const objEl = e.target.closest('.ed-obj--text');
      const obj = objEl && ed.objects.find((o) => o.id === Number(objEl.dataset.id));
      if (obj && ed.editing !== obj) startEditing(obj);
    });
    pg.layer.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      const rect = pg.layer.getBoundingClientRect();
      const at = (ev) => [Math.min(pg.vw, Math.max(0, (ev.clientX - rect.left) / scale)), Math.min(pg.vh, Math.max(0, (ev.clientY - rect.top) / scale))];
      const [x0, y0] = at(e);
      const objEl = e.target.closest('.ed-obj');
      const obj = objEl && ed.objects.find((o) => o.id === Number(objEl.dataset.id));

      if (ed.editing && objEl && obj === ed.editing) return; // typing / caret placement
      if (ed.editing) finishEditing();

      // Move or resize an existing object (in any tool, so mistakes are easy to fix)
      if (obj && (ed.tool === 'select' || !['draw', 'highlight', 'redact', 'rect', 'ellipse', 'line', 'arrow', 'whiteout'].includes(ed.tool) || e.target.closest('[data-resize]'))) {
        e.preventDefault();
        select(obj);
        const resizing = !!e.target.closest('[data-resize]');
        const start = { ...obj, points: obj.points && obj.points.map((p) => [...p]) };
        let moved = false;
        const onMove = (ev) => {
          const [x, y] = at(ev);
          const dx = x - x0; const dy = y - y0;
          if (!moved && Math.hypot(dx, dy) * scale < 3) return;
          if (!moved) snapshot();
          moved = true;
          if (resizing) {
            const ratio = start.w / start.h;
            let w = Math.max(8, start.w + dx); let hh = Math.max(8, start.h + dy);
            if (obj.type === 'image' || obj.type === 'signature') hh = w / ratio;
            obj.w = Math.min(w, pg.vw - obj.x); obj.h = Math.min(hh, pg.vh - obj.y);
            if (obj.type === 'image' || obj.type === 'signature') { w = Math.min(obj.w, obj.h * ratio); obj.w = w; obj.h = w / ratio; }
          } else if (obj.points) {
            obj.points = start.points.map(([px, py]) => [px + dx, py + dy]);
          } else {
            obj.x = Math.min(pg.vw - Math.min(obj.w, pg.vw) , Math.max(0, start.x + dx));
            obj.y = Math.min(pg.vh - Math.min(obj.h, pg.vh), Math.max(0, start.y + dy));
          }
          renderObject(obj);
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
          if (!moved && obj.type === 'text' && (ed.tool === 'text' || ed.tool === 'edittext')) startEditing(obj);
          if (!moved && obj.type === 'note') editNote(obj);
          if (moved) onChange();
        };
        window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
        return;
      }

      if (ed.tool === 'edittext') {
        e.preventDefault();
        const run = runAt(pg, x0, y0);
        if (run) editRun(pg, run); else select(null);
        return;
      }
      if (ed.tool === 'select') { select(null); return; }
      e.preventDefault();

      if (ed.tool === 'text') {
        const s = ed.style.text;
        const o = add({ type: 'text', page: pg.index, x: x0, y: Math.max(0, y0 - s.size * 0.6), w: 10, h: s.size * 1.2, text: '', ...s });
        select(o);
        startEditing(o);
        return;
      }
      if (ed.tool === 'note') {
        const o = { type: 'note', page: pg.index, x: Math.min(x0, pg.vw - 20), y: Math.min(y0, pg.vh - 20), w: 20, h: 20, text: '', color: ed.style.note.color };
        editNote(o, true);
        return;
      }
      if (ed.tool === 'image' || ed.tool === 'signature') return;

      // Drawing tools: drag out a shape
      let draft = null;
      const style = ed.tool === 'highlight' ? { color: ed.style.highlight.color }
        : ed.tool === 'draw' ? { color: ed.style.draw.color, width: ed.style.draw.width }
          : ed.tool === 'line' || ed.tool === 'arrow' ? { color: ed.style.shape.stroke || '#111111', width: ed.style.shape.width, opacity: ed.style.shape.opacity }
            : ed.tool === 'rect' || ed.tool === 'ellipse' ? { ...ed.style.shape } : {};
      if (ed.tool === 'draw' || ed.tool === 'line' || ed.tool === 'arrow') {
        draft = { type: ed.tool, page: pg.index, points: [[x0, y0], [x0, y0]], ...style };
      } else {
        draft = { type: ed.tool, page: pg.index, x: x0, y: y0, w: 0, h: 0, ...style };
      }
      draft.id = -1;
      const onMove = (ev) => {
        const [x, y] = at(ev);
        if (draft.type === 'draw') {
          const last = draft.points[draft.points.length - 1];
          if (Math.hypot(x - last[0], y - last[1]) * scale > 1.5) draft.points.push([x, y]);
        } else if (draft.points) draft.points[1] = [x, y];
        else { draft.x = Math.min(x, x0); draft.y = Math.min(y, y0); draft.w = Math.abs(x - x0); draft.h = Math.abs(y - y0); }
        renderObject(draft);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        pg.layer.querySelector('.ed-obj[data-id="-1"]')?.remove();
        const b = bbox(draft);
        const tiny = draft.points ? (draft.type === 'draw' ? draft.points.length < 2 : Math.hypot(draft.points[1][0] - draft.points[0][0], draft.points[1][1] - draft.points[0][1]) < 3)
          : (b.w < 3 || b.h < 3);
        if (tiny) {
          if (draft.type === 'rect' || draft.type === 'ellipse' || draft.type === 'whiteout') { Object.assign(draft, { x: Math.min(x0, pg.vw - 120), y: Math.min(y0, pg.vh - 60), w: 120, h: 60 }); } else return;
        }
        if (draft.type === 'draw' && draft.points.length === 2 && draft.points[0][0] === draft.points[1][0]) draft.points[1] = [draft.points[1][0] + 0.5, draft.points[1][1] + 0.5];
        delete draft.id;
        const o = add(draft);
        if (draft.type !== 'draw') select(o);
      };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    });
  }

  // keyboard: delete, escape, nudge
  const onKey = (e) => {
    if (!container.isConnected || ed.editing) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const o = ed.selected;
    if (!o) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); return; }
    if (e.key === 'Escape') { select(null); return; }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      snapshot();
      if (o.points) o.points = o.points.map(([x, y]) => [x + d[0] * step, y + d[1] * step]); else { o.x += d[0] * step; o.y += d[1] * step; }
      renderObject(o);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  };
  document.addEventListener('keydown', onKey);

  // ------------------------------------------------------- images / signature
  function visiblePage() {
    const top = pagesEl.getBoundingClientRect().top;
    let best = ed.pages[0]; let bestDist = Infinity;
    for (const pg of ed.pages) {
      const r = pg.el.getBoundingClientRect();
      const d = Math.abs(r.top - top - 20);
      if (r.bottom > top + 40 && d < bestDist) { best = pg; bestDist = d; }
    }
    return best;
  }
  async function imageObject(blob, type, widthShare) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    let data = buf; let mime = isJpg ? 'image/jpeg' : 'image/png';
    if (!isJpg && !isPng) throw new ToolError('Please choose a PNG or JPG image.');
    const bmp = await createImageBitmap(blob).catch(() => null);
    if (!bmp) throw new ToolError('This image could not be read. Please choose another PNG or JPG file.');
    const iw = bmp.width; const ih = bmp.height;
    bmp.close && bmp.close();
    const pg = visiblePage();
    const w = Math.min(pg.vw * widthShare, iw * 0.75);
    const hh = w * ih / iw;
    return { type, page: pg.index, x: (pg.vw - w) / 2, y: Math.max(10, (pg.vh - hh) / 3), w, h: hh, data, mime, url: URL.createObjectURL(new Blob([data], { type: mime })) };
  }
  async function addImage(file) {
    try {
      const o = add(await imageObject(file, 'image', 0.4));
      setTool('select'); select(o);
    } catch (e) { toast(e.userMessage || 'This image could not be added.'); }
  }
  async function addSignature(blob) {
    const o = add(await imageObject(blob, 'signature', 0.3));
    setTool('select'); select(o);
  }

  // ------------------------------------------------------- tool + props
  function setTool(t) {
    finishEditing();
    ed.tool = t;
    ed.pages.forEach((pg) => { if (t === 'edittext') ensureRuns(pg).then(() => renderRuns(pg)); else renderRuns(pg); });
    toolbar.querySelectorAll('[data-tool]').forEach((b) => { const on = b.dataset.tool === t; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    ed.pages.forEach((pg) => { pg.layer.className = `ed-layer tool-${t}`; });
    if (t !== 'select') select(null); else renderProps();
    if (t === 'image') imgInput.click();
    if (t === 'signature') {
      if (lastSignature) renderProps(); else openSignature();
    }
  }

  function renderProps() {
    const o = ed.selected;
    const t = o ? o.type : ed.tool;
    const target = o || null;
    const val = (k, def) => (target ? target[k] : def);
    const set = (k, v, styleKey) => {
      if (target) { snapshot(); target[k] = v; if (target.type === 'text') { renderObject(target); measureText(target); } renderObject(target); onChange(); }
      if (styleKey) ed.style[styleKey][k] = v;
    };
    let html = '';
    if (t === 'text') {
      const s = ed.style.text;
      html = `<label>Font <select class="select" data-k="font">${Object.keys(FONTS).map((f) => `<option${val('font', s.font) === f ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
        <label>Size <select class="select" data-k="size">${[...new Set([8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72, Number(val('size', s.size))])].sort((a, b) => a - b).map((n) => `<option${Number(val('size', s.size)) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Color <input type="color" data-k="color" value="${val('color', s.color)}"></label>
        <label class="check"><input type="checkbox" data-k="bold"${val('bold', s.bold) ? ' checked' : ''}> Bold</label>
        <span class="ed-props__hint">${o ? 'Double-click the text to edit it.' : 'Click on the page where you want to type.'}</span>`;
    } else if (t === 'rect' || t === 'ellipse') {
      const s = ed.style.shape;
      html = `<label>Border <input type="color" data-k="stroke" value="${val('stroke', s.stroke) || '#000000'}"></label>
        <label>Width <select class="select" data-k="width">${[1, 2, 3, 4, 6, 8].map((n) => `<option${Number(val('width', s.width)) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" data-fill${val('fill', s.fill) ? ' checked' : ''}> Fill</label>
        <label>Fill color <input type="color" data-k="fill" value="${val('fill', s.fill) || '#ffd7cf'}"></label>
        <label>Opacity <input type="range" min="10" max="100" data-k="opacity" value="${val('opacity', s.opacity)}"></label>
        ${o ? '' : '<span class="ed-props__hint">Drag on the page to draw.</span>'}`;
    } else if (t === 'line' || t === 'arrow') {
      const s = ed.style.shape;
      html = `<label>Color <input type="color" data-k="color" value="${val('color', s.stroke || '#111111')}"></label>
        <label>Width <select class="select" data-k="width">${[1, 2, 3, 4, 6, 8].map((n) => `<option${Number(val('width', s.width)) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        ${o ? '' : '<span class="ed-props__hint">Drag on the page to draw.</span>'}`;
    } else if (t === 'draw') {
      const s = ed.style.draw;
      html = `<label>Color <input type="color" data-k="color" value="${val('color', s.color)}"></label>
        <label>Width <select class="select" data-k="width">${[1, 2, 3, 4, 6, 10].map((n) => `<option${Number(val('width', s.width)) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        ${o ? '' : '<span class="ed-props__hint">Draw freely with your mouse, pen or finger.</span>'}`;
    } else if (t === 'highlight') {
      const cur = val('color', ed.style.highlight.color);
      html = `<label>Color <select class="select" data-k="color">${HIGHLIGHTS.map(([c, n]) => `<option value="${c}"${cur === c ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        ${o ? '' : '<span class="ed-props__hint">Drag over the text you want to highlight.</span>'}`;
    } else if (t === 'note') {
      html = o ? `<button class="btn btn--ghost btn--sm" type="button" data-edit-note>Edit note text</button><span class="ed-props__hint">${esc(o.text.slice(0, 80))}</span>`
        : '<span class="ed-props__hint">Click on the page to add a comment. It shows up as a sticky note in PDF readers.</span>';
    } else if (t === 'whiteout') {
      html = `<span class="ed-props__hint">${o ? 'Drag to move, or use the corner to resize.' : 'Drag a box over anything you want to cover with white. Then add new text on top.'}</span>`;
    } else if (t === 'redact') {
      html = `<span class="ed-props__hint">${o ? 'Drag to move, or use the corner to resize.' : 'Drag black boxes over everything that must be removed. The pages you mark are flattened, so the hidden content is gone for good.'}</span>`;
    } else if (t === 'signature') {
      html = o ? '<span class="ed-props__hint">Drag your signature into place and resize it from the corner.</span>'
        : `<button class="btn btn--primary btn--sm" type="button" data-new-sig>New signature</button>${lastSignature ? '<button class="btn btn--ghost btn--sm" type="button" data-reuse-sig>Add my signature again</button>' : ''}`;
    } else if (t === 'image') {
      html = o ? '<span class="ed-props__hint">Drag to move. Resize from the corner.</span>' : '<button class="btn btn--primary btn--sm" type="button" data-pick-img>Choose an image</button><span class="ed-props__hint">PNG or JPG</span>';
    } else {
      html = `<span class="ed-props__hint">${o ? 'Drag to move. Press Delete to remove.' : t === 'edittext' ? 'Click any text in the PDF to change it. Dashed boxes show the text you can edit.' : 'Pick a tool above, then click or drag on the page.'}</span>`;
    }
    props.innerHTML = html;
    props.querySelectorAll('[data-k]').forEach((inp) => {
      const k = inp.dataset.k;
      const styleKey = t === 'text' ? 'text' : (t === 'rect' || t === 'ellipse') ? 'shape' : t === 'draw' ? 'draw' : t === 'highlight' ? 'highlight' : (t === 'line' || t === 'arrow') ? 'shape' : null;
      inp.addEventListener('change', () => {
        let v = inp.type === 'checkbox' ? inp.checked : inp.value;
        if (['size', 'width', 'opacity'].includes(k)) v = Number(v);
        if (k === 'fill' && !props.querySelector('[data-fill]').checked) { props.querySelector('[data-fill]').checked = true; }
        if ((t === 'line' || t === 'arrow') && k === 'color' && !target) { ed.style.shape.stroke = v; return; }
        set(k, v, styleKey);
      });
    });
    props.querySelector('[data-fill]')?.addEventListener('change', (e) => {
      const v = e.target.checked ? props.querySelector('[data-k="fill"]').value : '';
      set('fill', v, 'shape');
    });
    props.querySelector('[data-new-sig]')?.addEventListener('click', openSignature);
    props.querySelector('[data-reuse-sig]')?.addEventListener('click', () => addSignature(lastSignature).catch(() => {}));
    props.querySelector('[data-pick-img]')?.addEventListener('click', () => imgInput.click());
    props.querySelector('[data-edit-note]')?.addEventListener('click', () => editNote(o));
  }

  // ------------------------------------------------------- modals
  function modal(title, bodyHTML, buttons) {
    const m = h(`<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal__box">
      <div class="modal__head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-x aria-label="Close">${svg(UI.close)}</button></div>
      <div class="modal__body">${bodyHTML}</div><div class="modal__foot"></div></div></div>`);
    const foot = m.querySelector('.modal__foot');
    const prev = document.activeElement;
    const close = () => { m.remove(); document.removeEventListener('keydown', esc_); if (prev && prev.focus) prev.focus(); };
    const esc_ = (e) => { if (e.key === 'Escape') close(); };
    for (const [label, cls, fn] of buttons) {
      const b = h(`<button class="btn ${cls}" type="button">${esc(label)}</button>`);
      b.addEventListener('click', async () => { if ((await fn(m)) !== false) close(); });
      foot.append(b);
    }
    m.querySelector('[data-x]').addEventListener('click', close);
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    document.addEventListener('keydown', esc_);
    document.body.append(m);
    (m.querySelector('textarea, input, canvas') || m.querySelector('button')).focus();
    return m;
  }

  function editNote(o, isNew) {
    const m = modal(isNew ? 'Add a note' : 'Edit note', `<label class="opt__label" for="note-text">Comment</label><textarea class="input" id="note-text" rows="5" maxlength="2000" style="resize:vertical">${esc(o.text)}</textarea>
      <p class="opt__help">The note is saved as a real PDF comment. Readers like Adobe Acrobat show it as a sticky note.</p>`, [
      ['Cancel', 'btn--ghost', () => true],
      [isNew ? 'Add note' : 'Save', 'btn--primary', (mm) => {
        const text = mm.querySelector('textarea').value.trim();
        if (!text) { mm.querySelector('textarea').classList.add('is-invalid'); return false; }
        if (isNew) { o.text = text; select(add(o)); } else { snapshot(); o.text = text; renderObject(o); renderProps(); }
        onChange();
        return true;
      }],
    ]);
    return m;
  }

  function openSignature() {
    const m = modal('Create your signature', `
      <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-tab="draw">Draw</button><button type="button" role="tab" aria-selected="false" data-tab="type">Type</button><button type="button" role="tab" aria-selected="false" data-tab="upload">Upload</button></div>
      <div data-pane="draw"><canvas class="sig-pad" aria-label="Signature pad: draw with your mouse or finger"></canvas>
        <div class="sig-colors"><span class="muted" style="font-size:.88rem">Ink:</span>${['#111111', '#1d3fb8', '#b42318'].map((c, i) => `<button type="button" data-ink="${c}" style="background:${c}" aria-label="Ink color ${i + 1}" aria-pressed="${i === 0}"></button>`).join('')}
        <span style="flex:1"></span><button class="btn btn--ghost btn--sm" type="button" data-clear-pad>Clear</button></div></div>
      <div data-pane="type" hidden><label class="opt__label" for="sig-name">Your name</label><input class="input" id="sig-name" maxlength="60" autocomplete="name"><div class="sig-typed" data-typed aria-hidden="true"></div></div>
      <div data-pane="upload" hidden><label class="opt__label" for="sig-file">Image of your signature (PNG or JPG)</label><input class="input" type="file" id="sig-file" accept=".png,.jpg,.jpeg,image/png,image/jpeg"><p class="opt__help">Tip: a PNG with a transparent background looks best.</p></div>
      <p class="opt__help">This adds a picture of your signature to the page. It is not a certificate-based digital signature.</p>`, [
      ['Cancel', 'btn--ghost', () => true],
      ['Use signature', 'btn--primary', async (mm) => {
        const tab = mm.querySelector('[aria-selected="true"]').dataset.tab;
        let blob = null;
        if (tab === 'draw') blob = await padToPng(mm.querySelector('canvas'), drawn);
        if (tab === 'type') blob = await typedToPng(mm.querySelector('#sig-name').value.trim(), ink);
        if (tab === 'upload') blob = mm.querySelector('#sig-file').files[0] || null;
        if (!blob) { toast(tab === 'draw' ? 'Draw your signature first.' : tab === 'type' ? 'Type your name first.' : 'Choose an image first.'); return false; }
        try { await addSignature(blob); } catch (e) { toast(e.userMessage || 'This signature could not be added.'); return false; }
        lastSignature = blob;
        return true;
      }],
    ]);
    let ink = '#111111';
    let drawn = false;
    m.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      m.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      m.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
    }));
    const pad = m.querySelector('canvas');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const sizePad = () => { pad.width = pad.clientWidth * dpr; pad.height = pad.clientHeight * dpr; };
    sizePad();
    const ctx = pad.getContext('2d');
    let last = null;
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); pad.setPointerCapture(e.pointerId); const r = pad.getBoundingClientRect(); last = [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr]; });
    pad.addEventListener('pointermove', (e) => {
      if (!last) return;
      const r = pad.getBoundingClientRect();
      const p = [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr];
      ctx.strokeStyle = ink; ctx.lineWidth = 2.6 * dpr * (e.pressure && e.pointerType === 'pen' ? 0.6 + e.pressure : 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke();
      last = p; drawn = true;
    });
    const up = () => { last = null; };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    m.querySelector('[data-clear-pad]').addEventListener('click', () => { ctx.clearRect(0, 0, pad.width, pad.height); drawn = false; });
    m.querySelectorAll('[data-ink]').forEach((b) => b.addEventListener('click', () => {
      ink = b.dataset.ink;
      m.querySelectorAll('[data-ink]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      m.querySelector('[data-typed]').style.color = ink;
    }));
    const nameIn = m.querySelector('#sig-name');
    nameIn.addEventListener('input', () => { m.querySelector('[data-typed]').textContent = nameIn.value; });
  }

  // ------------------------------------------------------- controller
  setTool(ed.tool);
  if (!isRedact && tools.length > 1 && ed.tool === 'select') renderProps();

  return {
    get objects() { finishEditing(); return ed.objects; },
    get pageCount() { return ed.pages.length; },
    bytes, file: fileEntry.file,
    summary() {
      const n = ed.objects.filter((o) => o.type !== 'cover').length;
      if (isRedact) return n ? `${n} area${n === 1 ? '' : 's'} marked for redaction on ${new Set(ed.objects.map((o) => o.page)).size} page(s)` : 'Drag boxes over the content to remove';
      return n ? `${n} item${n === 1 ? '' : 's'} added` : 'Nothing added yet';
    },
    validate() {
      finishEditing();
      if (!ed.objects.length) throw new ToolError(isRedact ? 'Draw at least one black box over the content you want to remove.' : 'Add something to the PDF first: pick a tool above and click on a page.');
    },
    destroy() {
      io.disconnect(); ro.disconnect();
      document.removeEventListener('keydown', onKey);
      ed.objects.forEach((o) => o.url && URL.revokeObjectURL(o.url));
      view.loadingTask.destroy();
    },
  };
}

// ---------------------------------------------------------- signature images
function trimCanvas(src) {
  const ctx = src.getContext('2d');
  const { width: w, height: hh } = src;
  const data = ctx.getImageData(0, 0, w, hh).data;
  let x1 = w; let y1 = hh; let x2 = -1; let y2 = -1;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
    }
  }
  if (x2 < 0) return null;
  const pad = 6;
  x1 = Math.max(0, x1 - pad); y1 = Math.max(0, y1 - pad); x2 = Math.min(w - 1, x2 + pad); y2 = Math.min(hh - 1, y2 + pad);
  const out = document.createElement('canvas');
  out.width = x2 - x1 + 1; out.height = y2 - y1 + 1;
  out.getContext('2d').drawImage(src, x1, y1, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
async function padToPng(pad, drawn) {
  if (!drawn) return null;
  const c = trimCanvas(pad);
  return c ? canvasToBlob(c, 'image/png') : null;
}
async function typedToPng(name, ink) {
  if (!name) return null;
  const c = document.createElement('canvas');
  const fontSize = 120;
  const ctx = c.getContext('2d');
  const font = `${fontSize}px "Segoe Script", "Brush Script MT", "Snell Roundhand", "Apple Chancery", cursive`;
  ctx.font = font;
  c.width = Math.ceil(ctx.measureText(name).width + 60); c.height = Math.ceil(fontSize * 1.6);
  ctx.font = font; ctx.fillStyle = ink; ctx.textBaseline = 'middle';
  ctx.fillText(name, 30, c.height / 2);
  const t = trimCanvas(c);
  return t ? canvasToBlob(t, 'image/png') : null;
}

function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h(`<div class="toast" role="status">${esc(msg)}</div>`);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

// ================================================================== saving ==
function arrowHeadPts(p1, p2, w) {
  const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  const len = Math.max(10, w * 4);
  const a = (d) => [p2[0] - len * Math.cos(ang + d), p2[1] - len * Math.sin(ang + d)];
  return [a(Math.PI / 7), a(-Math.PI / 7)];
}

export async function apply({ editor, files, progress }) {
  const lib = await pdfLib();
  const { degrees, rgb, BlendMode, LineCapStyle, PDFName, PDFHexString, PDFString } = lib;
  const objects = editor.objects;
  const doc = await openForEdit(editor.bytes);
  const pages = doc.getPages();
  const fonts = {};
  const images = new Map();
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (i % 10 === 0) { progress(i / objects.length * 0.85, `Adding item ${i + 1} of ${objects.length}`); await tick(); }
    const page = pages[o.page];
    const pl = placer(page);
    const r = pl.rot;
    // visual top-left box -> user-space origin of its bottom-left corner
    const origin = (x, y, hh) => pl.toUser(x, pl.vh - y - hh);
    const P = (x, y) => pl.toUser(x, pl.vh - y);
    const sideways = r === 90 || r === 270;

    if (o.type === 'text') {
      const std = o.font === 'Times' ? (o.bold ? 'TimesRomanBold' : 'TimesRoman') : o.font === 'Courier' ? (o.bold ? 'CourierBold' : 'Courier') : (o.bold ? 'HelveticaBold' : 'Helvetica');
      const font = await fontFor(doc, o.text, std, fonts);
      const col = await color(o.color);
      o.text.split('\n').forEach((line, n) => {
        if (!line) return;
        const base = P(o.x, o.y + o.size * (BASELINE[o.font] + n * 1.2));
        page.drawText(line, { x: base.x, y: base.y, size: o.size, font, color: col, rotate: degrees(r) });
      });
    } else if (o.type === 'image' || o.type === 'signature') {
      let img = images.get(o.data);
      if (!img) { img = o.mime === 'image/jpeg' ? await doc.embedJpg(o.data) : await doc.embedPng(o.data); images.set(o.data, img); }
      const at = origin(o.x, o.y, o.h);
      page.drawImage(img, { x: at.x, y: at.y, width: o.w, height: o.h, rotate: degrees(r) });
    } else if (RECT_TYPES.has(o.type) && o.type !== 'ellipse') {
      const at = origin(o.x, o.y, o.h);
      const opts = { x: at.x, y: at.y, width: o.w, height: o.h, rotate: degrees(r) };
      if (o.type === 'whiteout') Object.assign(opts, { color: rgb(1, 1, 1) });
      else if (o.type === 'cover') Object.assign(opts, { color: await color(o.color) });
      else if (o.type === 'redact') Object.assign(opts, { color: rgb(0, 0, 0) });
      else if (o.type === 'highlight') Object.assign(opts, { color: await color(o.color), opacity: 0.45, blendMode: BlendMode.Multiply });
      else {
        const inset = o.stroke ? o.width / 2 : 0;
        const at2 = origin(o.x + inset, o.y + inset, o.h - inset * 2);
        Object.assign(opts, { x: at2.x, y: at2.y, width: Math.max(0.1, o.w - inset * 2), height: Math.max(0.1, o.h - inset * 2) });
        if (o.fill) Object.assign(opts, { color: await color(o.fill), opacity: o.opacity / 100 });
        if (o.stroke) Object.assign(opts, { borderColor: await color(o.stroke), borderWidth: o.width, borderOpacity: o.opacity / 100 });
      }
      page.drawRectangle(opts);
    } else if (o.type === 'ellipse') {
      const c = P(o.x + o.w / 2, o.y + o.h / 2);
      const inset = o.stroke ? o.width / 2 : 0;
      const rx = Math.max(0.1, o.w / 2 - inset); const ry = Math.max(0.1, o.h / 2 - inset);
      const opts = { x: c.x, y: c.y, xScale: sideways ? ry : rx, yScale: sideways ? rx : ry };
      if (o.fill) Object.assign(opts, { color: await color(o.fill), opacity: o.opacity / 100 });
      if (o.stroke) Object.assign(opts, { borderColor: await color(o.stroke), borderWidth: o.width, borderOpacity: o.opacity / 100 });
      page.drawEllipse(opts);
    } else if (o.type === 'line' || o.type === 'arrow') {
      const col = await color(o.color);
      const seg = (a, b) => page.drawLine({ start: P(...a), end: P(...b), thickness: o.width, color: col, opacity: (o.opacity ?? 100) / 100, lineCap: LineCapStyle.Round });
      seg(o.points[0], o.points[1]);
      if (o.type === 'arrow') arrowHeadPts(o.points[0], o.points[1], o.width).forEach((pt) => seg(pt, o.points[1]));
    } else if (o.type === 'draw') {
      const pts = o.points.map(([x, y]) => P(x, y));
      const d = pts.map((p, n) => `${n ? 'L' : 'M'}${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(' ');
      page.drawSvgPath(d, { x: 0, y: 0, borderColor: await color(o.color), borderWidth: o.width, borderLineCap: LineCapStyle.Round });
    } else if (o.type === 'note') {
      const a = P(o.x, o.y + 20); const b = P(o.x + 20, o.y);
      const c = await color(o.color);
      const annot = doc.context.obj({
        Type: 'Annot', Subtype: 'Text', Name: 'Comment', F: 4, Open: false,
        Rect: [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)],
        Contents: PDFHexString.fromText(o.text), T: PDFHexString.fromText('Note'),
        M: PDFString.fromDate(new Date()), C: [c.red, c.green, c.blue],
      });
      const ref = doc.context.register(annot);
      const annots = page.node.lookup(PDFName.of('Annots'));
      if (annots && annots.push) annots.push(ref); else page.node.set(PDFName.of('Annots'), doc.context.obj([ref]));
    }
  }
  progress(0.9, 'Saving PDF');
  const suffix = objects.some((o) => o.type === 'signature') ? 'signed' : 'edited';
  return { name: `${baseName(files[0].file.name)}-${suffix}.pdf`, blob: pdfBlob(await doc.save({ useObjectStreams: true })) };
}

// Redaction: pages with boxes are re-drawn as images with the boxes burnt in, so nothing
// under a box survives (no hidden text layer, no recoverable images). Other pages are copied
// unchanged. Bookmarks, attachments and form data are not carried over.
export async function redact({ editor, files, options, progress }) {
  const { PDFDocument } = await pdfLib();
  const objects = editor.objects.filter((o) => o.type === 'redact');
  const byPage = new Map();
  objects.forEach((o) => { if (!byPage.has(o.page)) byPage.set(o.page, []); byPage.get(o.page).push(o); });
  const src = await openForEdit(editor.bytes);
  const view = await openForView(editor.bytes);
  const out = await PDFDocument.create();
  const n = src.getPageCount();
  try {
    for (let i = 0; i < n; i++) {
      progress(i / n * 0.9, byPage.has(i) ? `Redacting page ${i + 1} of ${n}` : `Copying page ${i + 1} of ${n}`);
      if (!byPage.has(i)) {
        const [p] = await out.copyPages(src, [i]);
        out.addPage(p);
        continue;
      }
      const page = await view.getPage(i + 1);
      const vp = page.getViewport({ scale: 1 });
      let scale = 200 / 72;
      if (vp.width * vp.height * scale * scale > 16e6) scale = Math.sqrt(16e6 / (vp.width * vp.height));
      const canvas = await renderPage(page, { scale });
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      for (const o of byPage.get(i)) ctx.fillRect(Math.floor(o.x * scale) - 1, Math.floor(o.y * scale) - 1, Math.ceil(o.w * scale) + 2, Math.ceil(o.h * scale) + 2);
      const jpg = new Uint8Array(await (await canvasToBlob(canvas, 'image/jpeg', 0.9)).arrayBuffer());
      canvas.width = canvas.height = 0;
      page.cleanup();
      const img = await out.embedJpg(jpg);
      const np = out.addPage([vp.width, vp.height]);
      np.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
      await tick();
    }
  } finally { view.loadingTask.destroy(); }
  if (!options.stripMeta) {
    out.setTitle(src.getTitle() || ''); out.setAuthor(src.getAuthor() || ''); out.setSubject(src.getSubject() || '');
  } else {
    out.setProducer(''); out.setCreator('');
  }
  progress(0.95, 'Saving PDF');
  return { name: `${baseName(files[0].file.name)}-redacted.pdf`, blob: pdfBlob(await out.save({ useObjectStreams: true })) };
}
