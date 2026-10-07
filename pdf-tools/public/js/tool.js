// Tool page controller: upload -> workspace (files, pages or editor) + settings -> processing
// -> result or error. Which processor runs, and where, comes from the tool's config
// (lib/tools.js on the server, embedded in the page as #tool-config).
//
// States: initial | selected | processing | success | error   (app.dataset.state)

import { formatBytes, openForView, renderPage, canvasToBlob, zipBlobs, baseName, parsePages, ToolError } from './lib/pdf.js';
import { takeFiles, putFiles } from './lib/handoff.js';
import { sortable } from './lib/sortable.js';

const cfg = JSON.parse(document.getElementById('tool-config').textContent);
const app = document.getElementById('tool-app');
const initialHTML = app.innerHTML;

// ------------------------------------------------------------------ icons --
const svg = (d, size = 18) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>',
  left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  rotL: '<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/>', rotR: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.5"/>',
  download: '<path d="M12 4v12m-5-5 5 5 5-5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 9m0-5v5h5M4 13a8 8 0 0 0 14.3 4.3L20 15m0 5v-5h-5"/>',
  back: '<path d="M19 12H5m6-6-6 6 6 6"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
  grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// ------------------------------------------------------------------ state --
const state = {
  files: [], // { id, file, name, size, pages, thumb, locked, broken }
  pages: null, // pages workspace: [{ index, rotation, selected }] in display order
  view: null, // pdf.js document for the pages workspace
  editor: null,
  options: Object.fromEntries(cfg.options.map((o) => [o.id, o.default ?? (o.type === 'checkbox' ? false : '')])),
  result: null,
  urls: [],
  xhr: null,
  busy: false,
};
let nextId = 1;
const isPdfInput = cfg.input.kind === 'pdf';
const fileWord = (n = cfg.multiple ? 2 : 1) => `${cfg.input.label} file${n === 1 ? '' : 's'}`;

function setState(s) { app.dataset.state = s; }
function trackUrl(u) { state.urls.push(u); return u; }
function freeUrls() { state.urls.forEach((u) => URL.revokeObjectURL(u)); state.urls = []; }

// ---------------------------------------------------------------- notices --
function notice(type, html, where = app) {
  where.querySelectorAll(':scope > .notice[data-live]').forEach((n) => n.remove());
  if (!html) return;
  const n = h(`<div class="notice notice--${type}" data-live role="${type === 'error' ? 'alert' : 'status'}">${svg(type === 'ok' ? I.check : I.alert, 20)}<div>${html}</div></div>`);
  where.prepend(n);
  if (n.getBoundingClientRect().top < 70) n.scrollIntoView({ block: 'nearest' });
}

// ----------------------------------------------------------- file intake --
const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1]?.toLowerCase() || '';

async function looksLikePdf(file) {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const text = String.fromCharCode(...head);
  return text.includes('%PDF-');
}

async function addFiles(list, { replace = false } = {}) {
  if (state.busy) return;
  const incoming = [...list];
  if (!incoming.length) return;
  const errors = [];
  const ok = [];
  const room = cfg.multiple ? cfg.maxFiles - (replace ? 0 : state.files.length) : 1;
  for (const f of incoming) {
    const ext = extOf(f.name);
    if (!cfg.input.exts.includes(ext)) { errors.push(`“${esc(f.name)}” isn’t a ${esc(cfg.input.label)} file.`); continue; }
    if (!f.size) { errors.push(`“${esc(f.name)}” is empty.`); continue; }
    if (f.size > cfg.maxMB * 1024 * 1024) { errors.push(`“${esc(f.name)}” is ${formatBytes(f.size)}. The limit for this tool is ${cfg.maxMB} MB.`); continue; }
    if (isPdfInput && cfg.slug !== 'repair-pdf' && !(await looksLikePdf(f))) { errors.push(`“${esc(f.name)}” doesn’t look like a real PDF. It may be damaged or renamed.`); continue; }
    if (ok.length >= room) { errors.push(cfg.multiple ? `You can add up to ${cfg.maxFiles} files at a time; “${esc(f.name)}” was left out.` : 'This tool works on one file at a time, so only the first file was used.'); break; }
    ok.push(f);
  }
  if (!ok.length) {
    notice('error', `<strong>That file can’t be used.</strong><p>${errors.join(' ')}</p>`);
    return;
  }
  if (replace || !cfg.multiple) { teardownWorkspace(); state.files = []; }
  for (const f of ok) state.files.push({ id: nextId++, file: f, name: f.name, size: f.size, pages: null, thumb: null });
  await showWorkspace();
  if (errors.length) notice('warn', errors.join(' '));
}

function bindDrop(zone, { replace = false } = {}) {
  const input = zone.querySelector('[data-input]');
  const pick = zone.querySelector('[data-pick]');
  if (pick) pick.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { addFiles(input.files, { replace }); input.value = ''; });
  zone.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === zone) { e.preventDefault(); input.click(); } });
}

// Dropping anywhere on the tool works, in any state that accepts files.
let depth = 0;
app.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; dropTarget()?.classList.add('is-over'); });
app.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
app.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; dropTarget()?.classList.remove('is-over'); } });
app.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault(); depth = 0; dropTarget()?.classList.remove('is-over');
  const st = app.dataset.state;
  if (st === 'processing') return;
  addFiles(e.dataTransfer.files, { replace: st !== 'selected' || !cfg.multiple });
});
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
const dropTarget = () => app.querySelector('[data-dropzone]') || app.querySelector('.workspace .panel');
// Stop the browser from opening a file dropped next to the tool.
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', (e) => { if (hasFiles(e) && !app.contains(e.target)) e.preventDefault(); });

// -------------------------------------------------------------- reset/init --
function teardownWorkspace() {
  if (state.editor) { state.editor.destroy(); state.editor = null; }
  if (state.view) { state.view.loadingTask.destroy(); state.view = null; }
  if (thumbObserver) { thumbObserver.disconnect(); thumbObserver = null; }
  thumbs.clear();
  thumbQueue.length = 0;
  state.pages = null;
  state.savedWorkspace = null;
}

function reset() {
  if (state.xhr) { state.xhr.abort(); state.xhr = null; }
  teardownWorkspace();
  freeUrls();
  state.files = []; state.result = null; state.busy = false;
  app.innerHTML = initialHTML;
  setState('initial');
  bindDrop(app.querySelector('[data-dropzone]'), { replace: true });
}

// --------------------------------------------------------------- workspace --
async function showWorkspace() {
  setState('selected');
  const editorMode = cfg.workspace === 'editor';
  app.innerHTML = '';
  const ws = h(`<div class="workspace${editorMode ? ' workspace--editor' : ''}"><div class="panel ws-main"></div>${editorMode ? '' : '<div class="side-panel"></div>'}</div>`);
  app.append(ws);
  const main = ws.querySelector('.ws-main');
  if (cfg.workspace === 'pages') await mountPages(main);
  else if (editorMode) await mountEditor(main);
  else mountFiles(main);
  if (!editorMode) mountSide(ws.querySelector('.side-panel'));
}

// files -------------------------------------------------------------------
function mountFiles(main) {
  const grid = cfg.multiple;
  main.innerHTML = `<div class="panel__head"><h2 class="panel__title">${grid ? `Files <span class="muted">(${state.files.length})</span>` : 'Your file'}</h2>
    <button class="btn btn--ghost btn--sm" type="button" data-clear>${svg(I.back, 16)}${grid ? 'Clear all' : 'Choose another file'}</button></div>
    <div class="panel__body"><ul class="files${grid ? ' files--grid' : ''}" data-files></ul>
    ${grid && state.files.length > 1 ? '<p class="hint">Drag the files (or use the arrows) to set the order.</p>' : ''}</div>`;
  main.querySelector('[data-clear]').addEventListener('click', reset);
  const ul = main.querySelector('[data-files]');
  state.files.forEach((f, i) => ul.append(fileCard(f, i)));
  if (grid && state.files.length < cfg.maxFiles) {
    const li = h(`<li class="add-tile" data-dropzone><button type="button" class="add-more" data-pick>${svg(I.plus, 22)}Add more files</button>
      <input type="file" hidden data-input multiple accept="${cfg.input.exts.map((e) => `.${e}`).join(',')}"></li>`);
    ul.append(li);
    bindDrop(li);
  }
  if (grid) {
    sortable(ul, { item: '.file', onMove: (from, to) => { moveFile(from, to); } });
  }
  loadFileDetails();
}

function fileCard(f, i) {
  const many = cfg.multiple;
  const meta = [formatBytes(f.size), f.pages ? `${f.pages} page${f.pages === 1 ? '' : 's'}` : '', f.locked ? `${svg(I.lock, 13)} Password-protected` : '', f.broken ? 'Preview unavailable' : '']
    .filter(Boolean).join(' · ');
  const thumb = f.thumb ? `<img src="${f.thumb}" alt="" loading="lazy">` : `<span>${svg(cfg.input.kind === 'pdf' ? I.doc : I.image, 26)}</span>`;
  const li = h(`<li class="file" data-id="${f.id}">
    ${many ? `<span class="file__order">${i + 1}</span>` : ''}
    <div class="file__thumb">${thumb}</div>
    <div class="file__info"><div class="file__name" title="${esc(f.name)}">${esc(f.name)}</div><div class="file__meta">${meta}</div></div>
    <div class="file__actions">
      ${many ? `<button class="icon-btn icon-btn--sm" type="button" data-move="-1" aria-label="Move ${esc(f.name)} earlier" ${i === 0 ? 'disabled' : ''}>${svg(I.left)}</button>
      <button class="icon-btn icon-btn--sm" type="button" data-move="1" aria-label="Move ${esc(f.name)} later" ${i === state.files.length - 1 ? 'disabled' : ''}>${svg(I.right)}</button>` : ''}
      <button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-remove aria-label="Remove ${esc(f.name)}">${svg(I.trash)}</button>
    </div></li>`);
  li.querySelector('[data-remove]').addEventListener('click', () => removeFile(f.id));
  li.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
    const from = state.files.indexOf(f);
    moveFile(from, from + Number(b.dataset.move), true);
  }));
  return li;
}

function refreshFiles(focusId) {
  const main = app.querySelector('.ws-main');
  if (!main) return;
  mountFiles(main);
  updateAction();
  if (focusId) app.querySelector(`.file[data-id="${focusId}"] [data-move]:not([disabled])`)?.focus();
}
function moveFile(from, to, keepFocus) {
  if (to < 0 || to >= state.files.length) return;
  const [f] = state.files.splice(from, 1);
  state.files.splice(to, 0, f);
  refreshFiles(keepFocus ? f.id : null);
}
function removeFile(id) {
  state.files = state.files.filter((f) => f.id !== id);
  if (!state.files.length) reset(); else refreshFiles();
}

// Page count and first-page preview, one file at a time.
let detailsRunning = false;
async function loadFileDetails() {
  if (detailsRunning) return;
  detailsRunning = true;
  try {
    for (const f of state.files) {
      if (f.thumb || f.broken || f.locked || f.loading) continue;
      f.loading = true;
      if (cfg.input.kind === 'pdf') {
        try {
          const doc = await openForView(await f.file.arrayBuffer());
          f.pages = doc.numPages;
          const page = await doc.getPage(1);
          const canvas = await renderPage(page, { box: 180 });
          f.thumb = trackUrl(URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.8)));
          canvas.width = canvas.height = 0;
          await doc.loadingTask.destroy();
        } catch (e) {
          if (e.userMessage && /password/i.test(e.userMessage)) f.locked = true; else f.broken = true;
        }
      } else if (['jpg', 'png', 'image'].includes(cfg.input.kind) && /^image\/(jpeg|png|webp|bmp)$/.test(f.file.type)) {
        f.thumb = trackUrl(URL.createObjectURL(f.file));
      } else {
        f.broken = false; f.thumb = null; f.loading = false;
        continue;
      }
      f.loading = false;
      const li = app.querySelector(`.file[data-id="${f.id}"]`);
      if (li) li.replaceWith(fileCard(f, state.files.indexOf(f)));
      if (f.locked && cfg.runs === 'browser') {
        notice('warn', `<strong>“${esc(f.name)}” is password-protected.</strong> Remove the password first with <a href="/unlock-pdf">Unlock PDF</a>, then come back.`, app.querySelector('.ws-main .panel__body') || app);
      }
      if (cfg.loadMetadata && f === state.files[0] && !f.locked && !f.broken) prefillMetadata(f.file);
    }
  } finally { detailsRunning = false; }
}

async function prefillMetadata(file) {
  try {
    const { readMetadata } = await import('./processors/enhance.js');
    const meta = await readMetadata(file);
    for (const [k, v] of Object.entries(meta)) {
      state.options[k] = v;
      const el = app.querySelector(`[name="opt-${k}"]`);
      if (el) el.value = v;
    }
  } catch { /* the form stays empty */ }
}

// pages -------------------------------------------------------------------
let thumbObserver = null;
async function mountPages(main) {
  const f = state.files[0];
  main.innerHTML = '<div class="status-card"><div class="spinner"></div><p>Opening your PDF…</p></div>';
  try {
    state.view = await openForView(await f.file.arrayBuffer());
  } catch (e) {
    main.innerHTML = '';
    teardownWorkspace();
    showError(e);
    return;
  }
  f.pages = state.view.numPages;
  state.pages = [...Array(f.pages).keys()].map((index) => ({ index, rotation: 0, selected: false }));
  const mode = cfg.pageMode;
  const bar = {
    select: `<button class="btn btn--ghost btn--sm" type="button" data-all>Select all</button><button class="btn btn--ghost btn--sm" type="button" data-none>Clear</button>
      <label class="visually-hidden" for="page-pick">Pages to select</label><input class="input" id="page-pick" style="max-width:190px;min-height:38px" placeholder="Type pages, e.g. 1-3, 5" data-pick-pages>
      <span class="grow"></span><span class="muted" data-count></span>`,
    reorder: `<button class="btn btn--ghost btn--sm" type="button" data-reverse>${svg(I.refresh, 16)}Reverse order</button><button class="btn btn--ghost btn--sm" type="button" data-reset>Reset</button><span class="grow"></span><span class="muted">Drag pages to move them</span>`,
    rotate: `<button class="btn btn--ghost btn--sm" type="button" data-rot-all="-90">${svg(I.rotL, 16)}Rotate all left</button><button class="btn btn--ghost btn--sm" type="button" data-rot-all="90">${svg(I.rotR, 16)}Rotate all right</button><button class="btn btn--ghost btn--sm" type="button" data-reset>Reset</button>`,
    view: '<span class="muted">Preview of your pages</span>',
  }[mode];
  main.innerHTML = `<div class="panel__head"><h2 class="panel__title" title="${esc(f.name)}">${esc(f.name.length > 40 ? `${f.name.slice(0, 37)}…` : f.name)} <span class="muted">· ${f.pages} page${f.pages === 1 ? '' : 's'} · ${formatBytes(f.size)}</span></h2>
    <button class="btn btn--ghost btn--sm" type="button" data-clear>${svg(I.back, 16)}Choose another file</button></div>
    <div class="panel__head pages-bar">${bar}</div>
    <div class="panel__body"><div class="pages" data-pages${mode === 'select' ? '' : ' role="list"'}></div></div>`;
  main.querySelector('[data-clear]').addEventListener('click', reset);
  const grid = main.querySelector('[data-pages]');
  thumbObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { thumbObserver.unobserve(en.target); queueThumb(Number(en.target.dataset.src), en.target); } });
  }, { rootMargin: '300px' });
  renderPageGrid(grid);

  const on = (sel, fn) => main.querySelector(sel)?.addEventListener('click', fn);
  on('[data-all]', () => { state.pages.forEach((p) => { p.selected = true; }); renderPageGrid(grid); });
  on('[data-none]', () => { state.pages.forEach((p) => { p.selected = false; }); renderPageGrid(grid); });
  on('[data-reverse]', () => { state.pages.reverse(); renderPageGrid(grid); });
  on('[data-reset]', () => { state.pages.sort((a, b) => a.index - b.index).forEach((p) => { p.rotation = 0; }); renderPageGrid(grid); });
  main.querySelectorAll('[data-rot-all]').forEach((b) => b.addEventListener('click', () => {
    state.pages.forEach((p) => { p.rotation = (p.rotation + Number(b.dataset.rotAll) + 360) % 360; });
    renderPageGrid(grid);
  }));
  const pick = main.querySelector('[data-pick-pages]');
  if (pick) {
    pick.addEventListener('input', () => {
      try {
        const sel = new Set(parsePages(pick.value, state.pages.length, { allowEmpty: false }));
        state.pages.forEach((p) => { p.selected = sel.has(p.index); });
        pick.classList.remove('is-invalid');
        renderPageGrid(grid, true);
      } catch { pick.classList.toggle('is-invalid', !!pick.value.trim()); }
    });
  }
  if (mode === 'reorder') {
    sortable(grid, { item: '.pg', onMove: (from, to) => { const [p] = state.pages.splice(from, 1); state.pages.splice(to, 0, p); renderPageGrid(grid); } });
  }
}

const thumbs = new Map(); // page index -> object URL
const thumbQueue = [];
let thumbBusy = false;
function queueThumb(index, el) { thumbQueue.push([index, el]); pumpThumbs(); }
async function pumpThumbs() {
  if (thumbBusy) return;
  thumbBusy = true;
  while (thumbQueue.length && state.view) {
    const [index] = thumbQueue.shift();
    if (thumbs.has(index)) { paintThumb(index); continue; }
    try {
      const page = await state.view.getPage(index + 1);
      const canvas = await renderPage(page, { box: 170 });
      thumbs.set(index, trackUrl(URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.8))));
      canvas.width = canvas.height = 0;
      page.cleanup();
    } catch { thumbs.set(index, null); }
    paintThumb(index);
  }
  thumbBusy = false;
}
function paintThumb(index) {
  const el = app.querySelector(`.pg[data-src="${index}"] .pg__frame`);
  const url = thumbs.get(index);
  if (!el || !url) return;
  const p = state.pages.find((x) => x.index === index);
  el.innerHTML = `<img class="pg__img" src="${url}" alt="" draggable="false" style="${rotStyle(p)}">`;
}
const rotStyle = (p) => (p && p.rotation ? `transform: rotate(${p.rotation}deg)${p.rotation % 180 ? ' scale(.74)' : ''}` : '');

function renderPageGrid(grid, keepInput) {
  const mode = cfg.pageMode;
  const selectable = mode === 'select';
  const delMode = cfg.slug === 'delete-pdf-pages';
  grid.innerHTML = '';
  state.pages.forEach((p, i) => {
    const label = `Page ${p.index + 1}`;
    const el = h(`<div class="pg${selectable ? ' pg--selectable' : ''}${mode === 'reorder' ? ' pg--reorder' : ''}${delMode ? ' pg--delete' : ''}${p.selected ? ' is-selected' : ''}" data-src="${p.index}" role="${selectable ? 'button' : 'listitem'}"
      ${selectable ? `tabindex="0" aria-pressed="${p.selected}" aria-label="${label}${delMode ? ', delete' : ', select'}"` : ''}>
      ${selectable ? `<span class="pg__check" aria-hidden="true">${svg(delMode ? I.trash : I.check, 14)}</span>` : ''}
      <div class="pg__frame">${thumbs.get(p.index) ? `<img class="pg__img" src="${thumbs.get(p.index)}" alt="" draggable="false" style="${rotStyle(p)}">` : '<div class="pg__ph"></div>'}</div>
      <span class="pg__num">${label}${p.rotation ? ` · ${p.rotation}°` : ''}</span>
      ${mode === 'rotate' ? `<span class="pg__tools"><button class="icon-btn icon-btn--sm" type="button" data-rot="-90" aria-label="Rotate ${label} left">${svg(I.rotL)}</button><button class="icon-btn icon-btn--sm" type="button" data-rot="90" aria-label="Rotate ${label} right">${svg(I.rotR)}</button></span>` : ''}
      ${mode === 'reorder' ? `<span class="pg__tools"><button class="icon-btn icon-btn--sm" type="button" data-mv="-1" aria-label="Move ${label} earlier" ${i === 0 ? 'disabled' : ''}>${svg(I.left)}</button><button class="icon-btn icon-btn--sm" type="button" data-mv="1" aria-label="Move ${label} later" ${i === state.pages.length - 1 ? 'disabled' : ''}>${svg(I.right)}</button></span>` : ''}
    </div>`);
    if (selectable) {
      const toggle = () => {
        p.selected = !p.selected;
        el.classList.toggle('is-selected', p.selected);
        el.setAttribute('aria-pressed', String(p.selected));
        updateCount();
        if (!keepInput) { const pick = app.querySelector('[data-pick-pages]'); if (pick) pick.value = ''; }
      };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
    }
    el.querySelectorAll('[data-rot]').forEach((b) => b.addEventListener('click', () => {
      p.rotation = (p.rotation + Number(b.dataset.rot) + 360) % 360;
      el.querySelector('.pg__num').textContent = `${label}${p.rotation ? ` · ${p.rotation}°` : ''}`;
      const img = el.querySelector('.pg__img');
      if (img) img.setAttribute('style', rotStyle(p));
    }));
    el.querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', () => {
      const to = i + Number(b.dataset.mv);
      if (to < 0 || to >= state.pages.length) return;
      state.pages.splice(i, 1); state.pages.splice(to, 0, p);
      renderPageGrid(grid);
      grid.querySelector(`.pg[data-src="${p.index}"] [data-mv="${b.dataset.mv}"]:not([disabled])`)?.focus();
    }));
    grid.append(el);
    if (!thumbs.has(p.index)) thumbObserver.observe(el);
  });
  updateCount();
}
function updateCount() {
  const c = app.querySelector('[data-count]');
  if (!c || !state.pages) return;
  const n = state.pages.filter((p) => p.selected).length;
  c.textContent = `${n} of ${state.pages.length} selected`;
  updateAction();
}

// editor ------------------------------------------------------------------
async function mountEditor(main) {
  main.innerHTML = '<div class="status-card"><div class="spinner"></div><p>Opening the editor…</p></div>';
  try {
    const { mountEditor: mount } = await import('./processors/editor.js');
    main.innerHTML = '';
    state.editor = await mount(main, state.files[0], cfg, { onChange: updateAction, onReset: reset });
    const opts = renderOptions();
    if (opts) { const box = h('<div class="ed-options"></div>'); box.append(opts); main.append(box); }
    const foot = h(`<div class="ed-footer"><span class="ed-count" data-ed-count></span>
      <div class="btn-row"><button class="btn btn--ghost" type="button" data-clear>${svg(I.back, 16)}Choose another file</button>
      <button class="btn btn--primary btn--lg" type="button" data-go>${esc(cfg.action)}</button></div></div>`);
    main.append(foot);
    foot.querySelector('[data-clear]').addEventListener('click', reset);
    foot.querySelector('[data-go]').addEventListener('click', run);
    updateAction();
  } catch (e) {
    teardownWorkspace();
    showError(e);
  }
}

// settings + action -------------------------------------------------------
function mountSide(side) {
  const box = h(`<div class="panel"><div class="panel__head"><h2 class="panel__title">${cfg.options.length ? 'Settings' : esc(cfg.name)}</h2></div>
    <div class="panel__body" data-opts></div><div class="panel__foot">
    <button class="btn btn--primary btn--lg btn--block" type="button" data-go>${esc(cfg.action)}</button>
    <p class="hint" style="margin:0;text-align:center" data-go-hint></p></div></div>`);
  const opts = renderOptions();
  if (opts) box.querySelector('[data-opts]').append(opts);
  else box.querySelector('[data-opts]').innerHTML = `<p class="muted" style="margin:0">${cfg.runs === 'browser' ? 'Everything happens on your device. Nothing is uploaded.' : 'Your file is uploaded securely, processed, and deleted right after.'}</p>`;
  box.querySelector('[data-go]').addEventListener('click', run);
  side.append(box);
  updateAction();
}

function updateAction() {
  const btn = app.querySelector('[data-go]');
  const hint = app.querySelector('[data-go-hint]');
  if (!btn) return;
  let why = '';
  if (state.files.length < cfg.minFiles) why = `Add at least ${cfg.minFiles} ${fileWord(cfg.minFiles)}.`;
  else if (cfg.pageMode === 'select' && state.pages && !state.pages.some((p) => p.selected)) why = cfg.slug === 'delete-pdf-pages' ? 'Click the pages you want to delete.' : 'Click the pages you want to use.';
  btn.setAttribute('aria-disabled', why ? 'true' : 'false');
  btn.classList.toggle('is-waiting', !!why);
  if (hint) hint.textContent = why;
  const edCount = app.querySelector('[data-ed-count]');
  if (edCount && state.editor) edCount.textContent = state.editor.summary();
}

function renderOptions() {
  if (!cfg.options.length) return null;
  const wrap = h('<div class="opts"></div>');
  for (const o of cfg.options) {
    const id = `opt-${o.id}`;
    const v = state.options[o.id];
    let field;
    if (o.type === 'radio') {
      field = `<fieldset class="opt" style="border:0;margin:0;padding:0"><legend class="opt__label">${esc(o.label)}</legend><div class="seg">${o.choices.map(([val, lab]) => `<label class="seg__opt"><input type="radio" name="${id}" value="${esc(val)}"${String(v) === val ? ' checked' : ''}><span>${esc(lab)}</span></label>`).join('')}</div></fieldset>`;
    } else if (o.type === 'select') {
      field = `<div class="opt"><label for="${id}">${esc(o.label)}</label><select class="select" id="${id}" name="${id}">${o.choices.map(([val, lab]) => `<option value="${esc(val)}"${String(v) === val ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select></div>`;
    } else if (o.type === 'checkbox') {
      field = `<div class="opt"><label class="check"><input type="checkbox" id="${id}" name="${id}"${v ? ' checked' : ''}><span>${esc(o.label)}</span></label></div>`;
    } else if (o.type === 'range') {
      field = `<div class="opt"><label for="${id}">${esc(o.label)}</label><div class="range-row"><input type="range" id="${id}" name="${id}" min="${o.min}" max="${o.max}" value="${esc(v)}"><output for="${id}">${esc(v)}${esc(o.unit || '')}</output></div></div>`;
    } else if (o.type === 'color') {
      field = `<div class="opt"><label for="${id}">${esc(o.label)}</label><div class="color-row"><input type="color" id="${id}" name="${id}" value="${esc(v)}"></div></div>`;
    } else if (o.type === 'image') {
      field = `<div class="opt"><label for="${id}">${esc(o.label)}</label><input class="input" type="file" id="${id}" name="${id}" accept=".png,.jpg,.jpeg,image/png,image/jpeg"></div>`;
    } else if (o.type === 'password') {
      field = `<div class="opt"><label for="${id}">${esc(o.label)}${o.required ? '' : ' <span class="muted">(optional)</span>'}</label><div class="pw"><input class="input" type="password" id="${id}" name="${id}" autocomplete="new-password" value="${esc(v)}"${o.maxLength ? ` maxlength="${o.maxLength}"` : ''}>
        <button class="icon-btn" type="button" data-reveal aria-label="Show password">${svg(I.eye)}</button></div></div>`;
    } else {
      const type = o.type === 'number' ? 'number' : 'text';
      field = `<div class="opt"><label for="${id}">${esc(o.label)}</label><input class="input" type="${type}" id="${id}" name="${id}" value="${esc(v)}"${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}${o.min !== undefined ? ` min="${o.min}"` : ''}${o.max !== undefined ? ` max="${o.max}"` : ''}${o.maxLength ? ` maxlength="${o.maxLength}"` : ''}${type === 'number' ? ' inputmode="numeric"' : ''}></div>`;
    }
    const el = h(field);
    el.dataset.opt = o.id;
    if (o.help) el.append(h(`<p class="opt__help">${esc(o.help)}</p>`));
    wrap.append(el);
    el.addEventListener('input', (e) => onOptionInput(o, e.target));
    el.addEventListener('change', (e) => onOptionInput(o, e.target));
    const reveal = el.querySelector('[data-reveal]');
    if (reveal) {
      reveal.addEventListener('click', () => {
        const inp = el.querySelector('input');
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        reveal.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    }
  }
  applyShowIf(wrap);
  return wrap;
}

function onOptionInput(o, target) {
  if (o.type === 'checkbox') state.options[o.id] = target.checked;
  else if (o.type === 'image') state.options[o.id] = target.files[0] || null;
  else if (o.type === 'number') state.options[o.id] = target.value === '' ? '' : Number(target.value);
  else state.options[o.id] = target.value;
  if (o.type === 'range') { const out = target.parentElement.querySelector('output'); if (out) out.textContent = `${target.value}${o.unit || ''}`; }
  target.classList?.remove('is-invalid');
  applyShowIf(app);
}

function visibleOption(o) {
  if (!o.showIf) return true;
  return Object.entries(o.showIf).every(([k, vals]) => vals.includes(String(state.options[k])));
}
function applyShowIf(root) {
  for (const o of cfg.options) {
    const el = root.querySelector(`[data-opt="${o.id}"]`);
    if (el) el.hidden = !visibleOption(o);
  }
}

/** Checks the settings; returns the values to use, or null after pointing at the problem. */
function collectOptions() {
  const out = {};
  for (const o of cfg.options) {
    if (!visibleOption(o)) continue;
    let v = state.options[o.id];
    const el = app.querySelector(`[name="opt-${o.id}"]`);
    const bad = (msg) => {
      if (el) { el.classList.add('is-invalid'); el.focus(); }
      throw new ToolError(msg);
    };
    if (o.type === 'number') {
      if (v === '' || !Number.isFinite(Number(v))) v = o.default;
      v = Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, Number(v)));
    }
    if (o.required && !v) bad(`Please fill in “${o.label}”.`);
    if (o.minLength && String(v || '').length < o.minLength) bad(`“${o.label}” needs at least ${o.minLength} characters.`);
    if (o.matches && v !== state.options[o.matches]) bad('The two passwords don’t match. Please type them again.');
    out[o.id] = v;
  }
  return out;
}

// -------------------------------------------------------------- processing --
let progressEl = null;
function showProgress(title) {
  setState('processing');
  app.innerHTML = '';
  const card = h(`<div class="panel status-card" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div>
    <h2>${esc(title)}</h2><p>${cfg.runs === 'browser' ? 'Working on your device. Please keep this tab open.' : 'Please keep this tab open. This usually takes a few seconds.'}</p>
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress__bar"></div></div>
    <div class="progress__label" data-label></div>
    ${cfg.runs === 'server' ? `<button class="btn btn--ghost btn--sm" type="button" data-cancel>Cancel</button>` : ''}</div>`);
  app.append(card);
  card.querySelector('[data-cancel]')?.addEventListener('click', () => { reset(); });
  progressEl = card;
  app.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function progress(fraction, label) {
  if (!progressEl) return;
  const bar = progressEl.querySelector('.progress');
  if (fraction === null) bar.classList.add('is-indeterminate');
  else {
    bar.classList.remove('is-indeterminate');
    const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
    bar.firstElementChild.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
  }
  if (label !== undefined) progressEl.querySelector('[data-label]').textContent = label;
}

async function run() {
  const btn = app.querySelector('[data-go]');
  if (state.busy) return;
  notice(null);
  if (btn && btn.getAttribute('aria-disabled') === 'true') {
    notice('warn', esc(app.querySelector('[data-go-hint]')?.textContent || 'Add your files first.'));
    return;
  }
  let options;
  try {
    options = collectOptions();
    if (state.editor) state.editor.validate();
  } catch (e) {
    notice('error', esc(e.userMessage || 'Please check the settings.'));
    return;
  }
  state.busy = true;
  // keep the workspace so "Start over" can come back to it with everything as it was
  const workspace = [...app.childNodes];
  const keep = document.createDocumentFragment();
  workspace.forEach((n) => keep.append(n));
  state.savedWorkspace = keep;
  showProgress(`${cfg.action}…`.replace('……', '…'));
  try {
    let result;
    if (cfg.runs === 'browser') {
      progress(0, 'Loading tools');
      const mod = await import(`./processors/${cfg.module}.js`);
      result = await mod[cfg.fn]({
        files: state.files, pages: state.pages, options, params: cfg.params, editor: state.editor, progress,
      });
      if (result.entries) {
        progress(0.9, 'Packing files into a ZIP');
        result = { name: result.zipName, blob: await zipBlobs(result.entries, (f) => progress(0.9 + f * 0.1)), count: result.entries.length };
      }
    } else {
      result = await upload(options);
    }
    progress(1, 'Done');
    showSuccess(result);
  } catch (e) {
    if (e && e.aborted) return;
    showError(e);
  } finally {
    state.busy = false;
  }
}

function upload(options) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    const sendable = { ...options };
    form.append('options', JSON.stringify(sendable));
    form.append('file', state.files[0].file, state.files[0].name);
    const xhr = new XMLHttpRequest();
    state.xhr = xhr;
    xhr.open('POST', `/api/tools/${cfg.slug}`);
    xhr.responseType = 'blob';
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(e.loaded / e.total * 0.5, `Uploading… ${Math.round(e.loaded / e.total * 100)}%`);
    };
    xhr.upload.onload = () => progress(null, 'Processing your file…');
    xhr.onprogress = (e) => { if (e.lengthComputable && xhr.status === 200) progress(0.5 + e.loaded / e.total * 0.5, 'Downloading result…'); };
    xhr.onload = async () => {
      state.xhr = null;
      if (xhr.status === 200) {
        const cd = xhr.getResponseHeader('Content-Disposition') || '';
        const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) || /filename="([^"]+)"/i.exec(cd);
        let info = {};
        try { info = JSON.parse(xhr.getResponseHeader('X-Result-Info') || '{}'); } catch { /* none */ }
        resolve({ blob: xhr.response, name: m ? decodeURIComponent(m[1]) : `result.${cfg.output}`, info });
        return;
      }
      let msg = '';
      try { msg = JSON.parse(await xhr.response.text()).error; } catch { /* not JSON (e.g. a proxy page) */ }
      if (!msg && xhr.status === 413) msg = `This file is too large for this tool. The limit is ${cfg.maxMB} MB.`;
      if (!msg && xhr.status === 429) msg = 'You’ve made a lot of requests in a short time. Please wait a few minutes and try again.';
      if (!msg && xhr.status >= 502) msg = 'The server is busy or restarting. Please try again in a minute.';
      reject(new ToolError(msg || 'Something went wrong while processing your file. Please try again or upload a different file.', linkFor(msg)));
    };
    xhr.onerror = () => { state.xhr = null; reject(new ToolError('We couldn’t reach the server. Please check your internet connection and try again.')); };
    xhr.ontimeout = () => { state.xhr = null; reject(new ToolError('This is taking too long. Please try again with a smaller file.')); };
    xhr.onabort = () => { const e = new Error('aborted'); e.aborted = true; reject(e); };
    xhr.send(form);
  });
}

function linkFor(msg = '') {
  if (/Unlock PDF/.test(msg) && cfg.slug !== 'unlock-pdf') return { href: '/unlock-pdf', label: 'Open Unlock PDF' };
  if (/Repair PDF/.test(msg)) return { href: '/repair-pdf', label: 'Open Repair PDF' };
  if (/OCR PDF/.test(msg)) return { href: '/ocr-pdf', label: 'Open OCR PDF' };
  if (/Remove PDF Restrictions/.test(msg)) return { href: '/remove-pdf-restrictions', label: 'Open Remove PDF Restrictions' };
  return null;
}

// ----------------------------------------------------------------- results --
function backToWorkspace() {
  if (!state.savedWorkspace) { reset(); return; }
  app.innerHTML = '';
  app.append(state.savedWorkspace);
  state.savedWorkspace = null;
  setState('selected');
  if (state.result) { URL.revokeObjectURL(state.result.url); state.result = null; }
  updateAction();
  app.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

async function showSuccess(result) {
  setState('success');
  const url = URL.createObjectURL(result.blob);
  state.result = { ...result, url };
  const info = result.info || {};
  let stats = '';
  if (info.before && info.after && !info.notSmaller) {
    const saved = Math.round((1 - info.after / info.before) * 100);
    stats = saved > 0
      ? `<p class="result-stats"><span>Before: ${formatBytes(info.before)}</span><span>After: ${formatBytes(info.after)}</span><strong>${saved}% smaller</strong></p>`
      : `<p class="result-stats"><span>Before: ${formatBytes(info.before)}</span><span>After: ${formatBytes(info.after)}</span><span>Fast web view adds a small index, so the size barely changes.</span></p>`;
  }
  const notSmaller = info.notSmaller ? `<div class="notice notice--info" style="text-align:left;margin:0 0 18px">${svg(I.alert, 20)}<div>This PDF is already well optimized, so we couldn’t make it any smaller. You’ll get your original file back. ${cfg.slug !== 'reduce-pdf-size' ? 'For a bigger reduction, try <a href="/reduce-pdf-size">Reduce PDF Size</a> with a lower resolution.' : 'Try a lower resolution or grayscale.'}</div></div>` : '';
  const count = result.count ? ` · ${result.count} files` : (info.count ? ` · ${info.count} image${info.count === 1 ? '' : 's'}` : '');
  const isText = /\.txt$/i.test(result.name);
  const text = isText ? await result.blob.text() : '';
  const next = (cfg.next || []).map((t) => `<button class="mini-tool" type="button" data-next="${t.slug}"><span class="tile tile--sm tile--${t.cat}">${t.icon}</span>${esc(t.name)}</button>`).join('');
  app.innerHTML = '';
  const card = h(`<div class="panel status-card" tabindex="-1">
    <span class="result-icon">${svg(I.check, 36)}</span>
    <h2>Your file is ready</h2>
    <div class="result-file">${svg(I.doc, 20)}<span>${esc(result.name)}</span><small>${formatBytes(result.blob.size)}${count}</small></div>
    ${stats}${notSmaller}
    ${isText ? `<label class="visually-hidden" for="result-text">Extracted text</label><textarea class="result-text" id="result-text" readonly>${esc(text.length > 500000 ? `${text.slice(0, 500000)}\n…` : text)}</textarea>` : ''}
    <div class="result-actions">
      <a class="btn btn--primary btn--lg" href="${url}" download="${esc(result.name)}" data-download>${svg(I.download, 20)}Download ${esc(extOf(result.name).toUpperCase())}</a>
      ${isText ? `<button class="btn btn--ghost btn--lg" type="button" data-copy>${svg(I.copy)}Copy text</button>` : ''}
    </div>
    <div class="btn-row" style="margin-top:12px">
      <button class="btn btn--ghost btn--sm" type="button" data-again>${svg(I.back, 16)}Start over</button>
      <button class="btn btn--ghost btn--sm" type="button" data-new>${svg(I.plus, 16)}Process another file</button>
    </div>
    ${next ? `<div class="next-tools"><h3>Continue with this file</h3><div class="next-tools__list">${next}</div></div>` : ''}
    ${cfg.runs === 'server' ? '<p class="hint">Your upload and the result have already been deleted from our server.</p>' : '<p class="hint">Processed on your device. Nothing was uploaded.</p>'}
  </div>`);
  app.append(card);
  card.querySelector('[data-again]').addEventListener('click', backToWorkspace);
  card.querySelector('[data-new]').addEventListener('click', reset);
  card.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(text); e.currentTarget.lastChild.textContent = 'Copied'; } catch {
      const ta = card.querySelector('textarea'); ta.focus(); ta.select();
    }
  });
  card.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const type = result.blob.type || (/\.pdf$/i.test(result.name) ? 'application/pdf' : '');
    try { await putFiles([new File([result.blob], result.name, { type })]); location.href = `/${b.dataset.next}#handoff`; } catch { location.href = `/${b.dataset.next}`; }
  }));
  card.focus({ preventScroll: true });
  app.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function showError(e) {
  setState('error');
  const msg = (e && e.userMessage) || 'Something went wrong while processing your file. Please try again or upload a different file.';
  if (!(e && e.userMessage)) console.error(e); // unexpected: keep details for debugging, never shown to visitors
  const link = e && e.link;
  app.innerHTML = '';
  const card = h(`<div class="panel status-card" role="alert" tabindex="-1">
    <span class="result-icon result-icon--err">${svg(I.alert, 36)}</span>
    <h2>We couldn’t finish that</h2>
    <p style="max-width:560px;margin:0 auto 20px;color:var(--ink-2)">${esc(msg)}</p>
    <div class="result-actions">
      ${link ? `<a class="btn btn--primary" href="${esc(link.href)}">${esc(link.label)}</a>` : ''}
      ${state.savedWorkspace ? `<button class="btn ${link ? 'btn--ghost' : 'btn--primary'}" type="button" data-again>${svg(I.refresh, 18)}Try again</button>` : ''}
      <button class="btn btn--ghost" type="button" data-new>Choose a different file</button>
    </div></div>`);
  app.append(card);
  card.querySelector('[data-again]')?.addEventListener('click', backToWorkspace);
  card.querySelector('[data-new]').addEventListener('click', reset);
  card.focus({ preventScroll: true });
}

// -------------------------------------------------------------------- start --
bindDrop(app.querySelector('[data-dropzone]'), { replace: true });
setState('initial');
if (location.hash === '#handoff') {
  history.replaceState(null, '', location.pathname + location.search);
  takeFiles().then((files) => { if (files.length) addFiles(files, { replace: true }); });
}
// Warm up the processing code while the visitor picks a file.
const warm = () => {
  if (cfg.runs === 'browser') import(`./processors/${cfg.module}.js`).catch(() => {});
  if (isPdfInput) import('./lib/pdf.js').then((m) => m.pdfjs()).catch(() => {});
};
if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2500);
