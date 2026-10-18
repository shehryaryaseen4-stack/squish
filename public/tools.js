// More stand-alone tools (content/apps.js): image resizer, crop/rotate/flip, favicon generator,
// background remover, video compressor, video/audio trimmer and ringtone maker, word counter,
// signature generator and cover letter generator. The tool box on the page says which one it is
// (data-app); everything image- and text-based runs in the browser.
const box = document.getElementById('app');
const $ = (sel, root = box) => root.querySelector(sel);
const $$ = (sel, root = box) => [...root.querySelectorAll(sel)];
const fmtSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const say = (text, bad, root = box) => { const m = $('[data-msg]', root); if (m) { m.textContent = text || ''; m.classList.toggle('bad', !!bad); } };
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); };
const beacon = (what) => window.dispatchEvent(new CustomEvent('pt:done', { detail: what }));
const baseName = (f) => (f.name || 'file').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'file';
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const EXT_OF = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// A drop zone with a hidden file input; calls onFile(file).
function dropZone(onFile) {
  const drop = $('[data-drop]'), input = $('[data-input]');
  $('[data-pick]').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); const f = e.dataTransfer.files[0]; if (f) onFile(f); });
}
function showWork(on) { $('[data-drop]').hidden = on; $('[data-work]').hidden = !on; }
$$('[data-again]').forEach((b) => b.addEventListener('click', () => { showWork(false); const d = $('[data-done]'); if (d) d.hidden = true; say(''); }));

// Any image the browser can open, upright (EXIF rotation applied).
async function loadImage(file) {
  if (/\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type)) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {
      throw new Error('This browser cannot open HEIC photos. Convert it with HEIC to JPG first, then come back.');
    }
  }
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {
    return new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('This file could not be opened as an image.'));
      img.src = URL.createObjectURL(file);
    });
  }
}
const dims = (img) => [img.naturalWidth || img.width, img.naturalHeight || img.height];

// Draw src scaled to w x h with good quality (halving steps for big reductions).
function scaled(src, w, h, background) {
  let [cw, ch] = dims(src); let cur = src;
  while (cw / 2 >= w && ch / 2 >= h) {
    const c = document.createElement('canvas'); c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, c.width, c.height);
    cur = c; cw = c.width; ch = c.height;
  }
  const out = document.createElement('canvas'); out.width = Math.max(1, Math.round(w)); out.height = Math.max(1, Math.round(h));
  const x = out.getContext('2d');
  if (background) { x.fillStyle = background; x.fillRect(0, 0, out.width, out.height); }
  x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, out.width, out.height);
  return out;
}

// ---------------------------------------------------------------- image resizer --
function resize() {
  const st = { file: null, img: null, crop: null, cropAspect: 0, out: null, busy: 0 };
  const kbIn = $('[data-kb]'), wIn = $('[data-w]'), hIn = $('[data-h]'), lock = $('[data-lock]'), pct = $('[data-pct]'), fmt = $('[data-fmt]'), fit = $('[data-fit]');
  const stage = $('[data-stage]'), sx = stage.getContext('2d'), outCv = $('[data-rimg]');
  const mode = () => ($('input[name="mode"]:checked') || {}).value || 'kb';
  const srcDims = () => dims(st.img);
  const outType = () => { const orig = st.file && EXT_OF[st.file.type] ? st.file.type : 'image/jpeg'; return fmt.value === 'same' ? orig : MIME[fmt.value]; };
  // in pixel mode with "keep proportions" off and "crop" chosen, the picture is cropped to the new shape
  const cropping = () => mode() === 'px' && !lock.checked && fit.value === 'crop';

  function targetSize() {
    const [w0, h0] = srcDims();
    if (mode() === 'pct') return [Math.max(1, Math.round((w0 * pct.value) / 100)), Math.max(1, Math.round((h0 * pct.value) / 100))];
    if (mode() === 'px') return [Math.round(Number(wIn.value)), Math.round(Number(hIn.value))];
    return [w0, h0];
  }
  // biggest box of the target shape, centred (or kept where the user put it)
  function fitCrop(force) {
    const [W, H] = srcDims(), [tw, th] = targetSize();
    const a = tw > 0 && th > 0 ? tw / th : W / H;
    if (!force && st.crop && Math.abs(a - st.cropAspect) / a < 0.01) return; // same shape (rounding aside): keep the user's box
    const old = st.crop;
    let w = W, h = w / a; if (h > H) { h = H; w = h * a; }
    const cx = old ? old.x + old.w / 2 : W / 2, cy = old ? old.y + old.h / 2 : H / 2;
    st.crop = { x: Math.min(Math.max(0, cx - w / 2), W - w), y: Math.min(Math.max(0, cy - h / 2), H - h), w, h };
    st.cropAspect = a;
  }

  // ---- the stage: the photo, with the crop box when cropping
  let k = 1;
  function drawStage() {
    if (!st.img) return;
    const [W, H] = srcDims();
    const maxW = Math.max(200, stage.parentElement.clientWidth - 2), maxH = 420;
    k = Math.min(maxW / W, maxH / H, 1);
    stage.width = Math.round(W * k); stage.height = Math.round(H * k);
    sx.clearRect(0, 0, stage.width, stage.height);
    sx.drawImage(st.img, 0, 0, stage.width, stage.height);
    stage.classList.toggle('is-crop', cropping());
    if (!cropping()) return;
    fitCrop();
    const c = st.crop;
    sx.save(); sx.fillStyle = 'rgba(0,0,0,.55)';
    sx.beginPath(); sx.rect(0, 0, stage.width, stage.height); sx.rect(c.x * k, c.y * k, c.w * k, c.h * k); sx.fill('evenodd');
    sx.strokeStyle = '#fff'; sx.lineWidth = 2; sx.strokeRect(c.x * k, c.y * k, c.w * k, c.h * k);
    sx.strokeStyle = 'rgba(255,255,255,.45)'; sx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      sx.beginPath(); sx.moveTo((c.x + (c.w * i) / 3) * k, c.y * k); sx.lineTo((c.x + (c.w * i) / 3) * k, (c.y + c.h) * k); sx.stroke();
      sx.beginPath(); sx.moveTo(c.x * k, (c.y + (c.h * i) / 3) * k); sx.lineTo((c.x + c.w) * k, (c.y + (c.h * i) / 3) * k); sx.stroke();
    }
    sx.fillStyle = '#fff';
    for (const [hx, hy] of corners(c)) sx.fillRect(hx * k - 7, hy * k - 7, 14, 14);
    sx.restore();
  }
  const corners = (c) => [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]];
  let drag = null;
  const pt = (e) => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; };
  stage.addEventListener('mousedown', (e) => e.preventDefault());
  stage.addEventListener('pointerdown', (e) => {
    if (!cropping()) return;
    const [x, y] = pt(e), c = st.crop, tol = 16 / k;
    const ci = corners(c).findIndex(([hx, hy]) => Math.abs(hx - x) < tol && Math.abs(hy - y) < tol);
    if (ci >= 0) drag = { kind: 'corner', ci, start: { ...c } };
    else if (x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h) drag = { kind: 'move', dx: x - c.x, dy: y - c.y };
    else return;
    stage.setPointerCapture(e.pointerId); e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [x, y] = pt(e), [W, H] = srcDims(), c = st.crop, a = st.cropAspect;
    if (drag.kind === 'move') {
      c.x = Math.min(Math.max(0, x - drag.dx), W - c.w); c.y = Math.min(Math.max(0, y - drag.dy), H - c.h);
    } else {
      const s = drag.start, left = drag.ci % 2 === 0, top = drag.ci < 2;
      const ax = left ? s.x + s.w : s.x, ay = top ? s.y + s.h : s.y;
      // a corner can change the shape freely (Shift keeps it); the height box follows the new shape
      let w = Math.max(16, Math.min(Math.abs(Math.min(Math.max(0, x), W) - ax), left ? ax : W - ax));
      let h = Math.max(16, Math.min(Math.abs(Math.min(Math.max(0, y), H) - ay), top ? ay : H - ay));
      if (e.shiftKey) { if (w / h > a) w = h * a; else h = w / a; }
      c.x = left ? ax - w : ax; c.y = top ? ay - h : ay; c.w = w; c.h = h;
      st.cropAspect = w / h;
      hIn.value = Math.max(1, Math.round(Number(wIn.value) / st.cropAspect));
    }
    drawStage(); update();
  });
  const endDrag = () => { drag = null; };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);

  // ---- the result, made at the real size
  function render(scale = 1) {
    const type = outType(), bg = type === 'image/jpeg' ? '#fff' : null;
    const [w0, h0] = srcDims();
    if (mode() !== 'px') { const [w, h] = targetSize(); return scaled(st.img, w * scale, h * scale, bg); }
    const [w, h] = targetSize();
    if (cropping()) {
      fitCrop();
      const c = st.crop, part = document.createElement('canvas');
      part.width = Math.max(1, Math.round(c.w)); part.height = Math.max(1, Math.round(c.h));
      part.getContext('2d').drawImage(st.img, Math.round(c.x), Math.round(c.y), part.width, part.height, 0, 0, part.width, part.height);
      return scaled(part, w * scale, h * scale, bg);
    }
    if (!lock.checked && fit.value === 'pad') {
      const out = document.createElement('canvas'); out.width = Math.round(w * scale); out.height = Math.round(h * scale);
      const x = out.getContext('2d');
      if (bg || $('[data-padbg]').value === 'white') { x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height); }
      const s = Math.min(out.width / w0, out.height / h0), dw = w0 * s, dh = h0 * s;
      x.drawImage(scaled(st.img, dw, dh, bg), (out.width - dw) / 2, (out.height - dh) / 2);
      return out;
    }
    return scaled(st.img, w * scale, h * scale, bg); // stretch, or proportions kept
  }
  async function toTarget(type, target) {
    const [w0, h0] = srcDims();
    let scale = 1;
    for (let round = 0; round < 10; round++) {
      const c = scaled(st.img, w0 * scale, h0 * scale, type === 'image/jpeg' ? '#fff' : null);
      if (type === 'image/png') {
        const b = await toBlob(c, type);
        if (b.size <= target) return { blob: b, w: c.width, h: c.height, canvas: c };
        scale *= Math.max(0.3, Math.sqrt(target / b.size) * 0.95);
        continue;
      }
      let lo = 0.35, hi = 0.95;
      const low = await toBlob(c, type, lo);
      if (low.size > target) { scale *= Math.max(0.3, Math.sqrt(target / low.size) * 0.95); continue; }
      let best = { blob: low, w: c.width, h: c.height, canvas: c };
      for (let i = 0; i < 7; i++) {
        const q = (lo + hi) / 2; const b = await toBlob(c, type, q);
        if (b.size <= target) { best = { blob: b, w: c.width, h: c.height, canvas: c }; lo = q; } else hi = q;
      }
      return best;
    }
    throw new Error('This image could not be made that small. Try a larger size in KB.');
  }
  async function make() {
    const type = outType();
    if (mode() === 'kb') {
      const kb = Number(kbIn.value);
      if (!(kb >= 5)) throw new Error('Enter a size of at least 5 KB.');
      if (st.file.size <= kb * 1024 && type === st.file.type) {
        const [w, h] = srcDims(); return { blob: st.file, w, h, canvas: scaled(st.img, w, h), already: true };
      }
      return toTarget(type, kb * 1024);
    }
    const [w, h] = targetSize();
    if (!(w >= 1 && h >= 1) || w > 12000 || h > 12000) throw new Error('Enter a width and height between 1 and 12000 pixels.');
    const c = render();
    return { blob: await toBlob(c, type, 0.9), w: c.width, h: c.height, canvas: c };
  }

  // live preview: redrawn on every change, encoded a moment after the last one
  let timer = null;
  function update() {
    if (!st.img) return;
    clearTimeout(timer);
    const job = ++st.busy;
    $('[data-rmeta]').textContent = 'Updating…';
    timer = setTimeout(async () => {
      try {
        const r = await make();
        if (job !== st.busy) return;
        st.out = r;
        const prev = r.canvas, max = 360, s = Math.min(max / prev.width, 260 / prev.height, 1);
        outCv.width = Math.max(1, Math.round(prev.width * s)); outCv.height = Math.max(1, Math.round(prev.height * s));
        const ox = outCv.getContext('2d'); ox.clearRect(0, 0, outCv.width, outCv.height); ox.drawImage(prev, 0, 0, outCv.width, outCv.height);
        $('[data-rmeta]').textContent = `${r.w} x ${r.h} px · ${fmtSize(r.blob.size)} (was ${fmtSize(st.file.size)})`;
        say(r.already ? `This image is already under ${kbIn.value} KB, so it stays as it is.` : '');
      } catch (e) { if (job === st.busy) { st.out = null; $('[data-rmeta]').textContent = ''; say(e.message, true); } }
    }, mode() === 'kb' ? 450 : 200);
  }

  const syncMode = () => {
    $$('[data-mode-box]').forEach((el) => { el.hidden = el.dataset.modeBox !== mode(); });
    $('[data-fitbox]').hidden = lock.checked;
    $('[data-padbox]').hidden = lock.checked || fit.value !== 'pad';
    $('[data-stage-hint]').hidden = !cropping();
    drawStage(); update();
  };
  $$('input[name="mode"]').forEach((r) => r.addEventListener('change', syncMode));
  const ratio = () => { const [w, h] = srcDims(); return w / h; };
  wIn.addEventListener('input', () => { if (lock.checked && st.img && wIn.value) hIn.value = Math.max(1, Math.round(wIn.value / ratio())); drawStage(); update(); });
  hIn.addEventListener('input', () => { if (lock.checked && st.img && hIn.value) wIn.value = Math.max(1, Math.round(hIn.value * ratio())); drawStage(); update(); });
  lock.addEventListener('change', () => { if (lock.checked && st.img) hIn.value = Math.max(1, Math.round(wIn.value / ratio())); syncMode(); });
  fit.addEventListener('change', syncMode); $('[data-padbg]').addEventListener('change', update);
  pct.addEventListener('input', () => { $('[data-pct-val]').textContent = `${pct.value}%`; update(); });
  kbIn.addEventListener('input', update); fmt.addEventListener('change', update);
  $$('[data-kbset]').forEach((b) => b.addEventListener('click', () => { kbIn.value = b.dataset.kbset; update(); }));
  $$('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const [w, h] = b.dataset.preset.split('x').map(Number);
    $('input[name="mode"][value="px"]').checked = true; lock.checked = false; fit.value = 'crop'; wIn.value = w; hIn.value = h;
    st.crop = null; syncMode();
  }));
  $('[data-recenter]').addEventListener('click', () => { st.crop = null; fitCrop(true); drawStage(); update(); });
  window.addEventListener('resize', drawStage);

  dropZone(async (file) => {
    say('');
    try { st.img = await loadImage(file); } catch (e) { say(e.message, true); return; }
    st.file = file; st.crop = null;
    const [w, h] = srcDims();
    $('[data-fname]').textContent = file.name; $('[data-fmeta]').textContent = `${w} x ${h} px · ${fmtSize(file.size)}`;
    wIn.value = w; hIn.value = h;
    showWork(true); syncMode();
  });
  const download = () => {
    if (!st.out) { say('Wait a moment for the preview, then try again.', true); return; }
    const ext = EXT_OF[st.out.blob.type] || 'jpg';
    save(st.out.blob, `${baseName(st.file)}-${mode() === 'kb' ? `${kbIn.value}kb` : `${st.out.w}x${st.out.h}`}.${ext}`);
    say('Downloaded.'); beacon('Resize image');
  };
  $('[data-go]').addEventListener('click', download); $('[data-dl]').addEventListener('click', download);
}

// ------------------------------------------------------- crop, rotate and flip --
function imgedit() {
  const stage = $('[data-canvas]'), ctx = stage.getContext('2d');
  const st = { file: null, img: null, rot: 0, fh: false, fv: false, work: null, crop: null, aspect: 0, scale: 1 };
  const angle = $('[data-angle]'), aspSel = $('[data-aspect]'), fmt = $('[data-fmt]'), bg = $('[data-bg]');

  // the picture with rotation and flips applied, at full size
  function build() {
    const [w, h] = dims(st.img);
    const r = (st.rot * Math.PI) / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
    const W = Math.round(w * c + h * s), H = Math.round(w * s + h * c);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.translate(W / 2, H / 2); x.rotate(r); x.scale(st.fh ? -1 : 1, st.fv ? -1 : 1);
    x.imageSmoothingQuality = 'high'; x.drawImage(st.img, -w / 2, -h / 2);
    st.work = cv;
    st.crop = fitAspect({ x: 0, y: 0, w: W, h: H });
    draw();
  }
  function fitAspect(c) {
    if (!st.aspect) return c;
    const W = st.work.width, H = st.work.height;
    let w = W, h = w / st.aspect; if (h > H) { h = H; w = h * st.aspect; }
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }
  function draw() {
    const W = st.work.width, H = st.work.height;
    const maxW = Math.min(stage.parentElement.clientWidth || 800, 900), maxH = 560;
    st.scale = Math.min(maxW / W, maxH / H, 1);
    stage.width = Math.round(W * st.scale); stage.height = Math.round(H * st.scale);
    ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.drawImage(st.work, 0, 0, stage.width, stage.height);
    const k = st.scale, c = st.crop;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.rect(0, 0, stage.width, stage.height); ctx.rect(c.x * k, c.y * k, c.w * k, c.h * k); ctx.fill('evenodd');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(c.x * k, c.y * k, c.w * k, c.h * k);
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo((c.x + (c.w * i) / 3) * k, c.y * k); ctx.lineTo((c.x + (c.w * i) / 3) * k, (c.y + c.h) * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x * k, (c.y + (c.h * i) / 3) * k); ctx.lineTo((c.x + c.w) * k, (c.y + (c.h * i) / 3) * k); ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    for (const [hx, hy] of corners(c)) ctx.fillRect(hx * k - 6, hy * k - 6, 12, 12);
    ctx.restore();
    $('[data-cw]').value = Math.round(c.w); $('[data-ch]').value = Math.round(c.h);
    $('[data-size-note]').textContent = `Result: ${Math.round(c.w)} x ${Math.round(c.h)} px`;
  }
  const corners = (c) => [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]];

  // dragging: inside moves the box, a corner resizes it
  let drag = null;
  const pt = (e) => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / st.scale, (e.clientY - r.top) / st.scale]; };
  stage.addEventListener('pointerdown', (e) => {
    if (!st.work) return;
    const [x, y] = pt(e), c = st.crop, tol = 14 / st.scale;
    const ci = corners(c).findIndex(([hx, hy]) => Math.abs(hx - x) < tol && Math.abs(hy - y) < tol);
    if (ci >= 0) drag = { kind: 'corner', ci, start: { ...c } };
    else if (x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h) drag = { kind: 'move', dx: x - c.x, dy: y - c.y };
    else return;
    stage.setPointerCapture(e.pointerId); e.preventDefault();
  });
  stage.addEventListener('mousedown', (e) => e.preventDefault()); // no text selection while dragging
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [x, y] = pt(e), W = st.work.width, H = st.work.height, c = st.crop;
    if (drag.kind === 'move') {
      c.x = Math.min(Math.max(0, x - drag.dx), W - c.w); c.y = Math.min(Math.max(0, y - drag.dy), H - c.h);
    } else {
      const s = drag.start, left = drag.ci % 2 === 0, top = drag.ci < 2;
      const ax = left ? s.x + s.w : s.x, ay = top ? s.y + s.h : s.y; // the fixed corner
      let nx = Math.min(Math.max(0, x), W), ny = Math.min(Math.max(0, y), H);
      let w = Math.max(10, Math.abs(nx - ax)), h = Math.max(10, Math.abs(ny - ay));
      if (st.aspect) { if (w / h > st.aspect) w = h * st.aspect; else h = w / st.aspect; }
      w = Math.min(w, left ? ax : W - ax); h = Math.min(h, top ? ay : H - ay);
      if (st.aspect) { if (w / h > st.aspect) w = h * st.aspect; else h = w / st.aspect; }
      c.x = left ? ax - w : ax; c.y = top ? ay - h : ay; c.w = w; c.h = h;
    }
    draw();
  });
  const end = () => { drag = null; };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

  // typed crop size (kept inside the picture, centred on the current box)
  const typed = () => {
    let w = Math.min(Number($('[data-cw]').value) || 1, st.work.width), h = Math.min(Number($('[data-ch]').value) || 1, st.work.height);
    if (st.aspect) h = w / st.aspect;
    const c = st.crop, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    st.crop = { x: Math.min(Math.max(0, cx - w / 2), st.work.width - w), y: Math.min(Math.max(0, cy - h / 2), st.work.height - h), w, h };
    draw();
  };
  $('[data-cw]').addEventListener('change', typed); $('[data-ch]').addEventListener('change', typed);

  aspSel.addEventListener('change', () => {
    const v = aspSel.value; st.aspect = v === 'free' ? 0 : v === 'orig' ? dims(st.img)[0] / dims(st.img)[1] : v.split(':').reduce((a, b) => a / b);
    st.crop = fitAspect({ x: 0, y: 0, w: st.work.width, h: st.work.height }); draw();
  });
  const setRot = (deg) => { st.rot = ((deg % 360) + 540) % 360 - 180; angle.value = st.rot; $('[data-angle-val]').textContent = `${st.rot}°`; build(); };
  $('[data-rot-l]').addEventListener('click', () => setRot(st.rot - 90));
  $('[data-rot-r]').addEventListener('click', () => setRot(st.rot + 90));
  angle.addEventListener('input', () => setRot(Number(angle.value)));
  $('[data-flip-h]').addEventListener('click', () => { st.fh = !st.fh; build(); });
  $('[data-flip-v]').addEventListener('click', () => { st.fv = !st.fv; build(); });
  $('[data-reset]').addEventListener('click', () => { st.fh = st.fv = false; aspSel.value = 'free'; st.aspect = 0; setRot(0); });
  window.addEventListener('resize', () => { if (st.work) draw(); });

  dropZone(async (file) => {
    say('');
    try { st.img = await loadImage(file); } catch (e) { say(e.message, true); return; }
    st.file = file; st.fh = st.fv = false; st.rot = 0; angle.value = 0; $('[data-angle-val]').textContent = '0°';
    const [w, h] = dims(st.img);
    $('[data-fname]').textContent = file.name; $('[data-fmeta]').textContent = `${w} x ${h} px · ${fmtSize(file.size)}`;
    showWork(true); build();
  });

  $('[data-go]').addEventListener('click', async () => {
    if (!st.work) return;
    const c = st.crop, type = fmt.value === 'same' ? (EXT_OF[st.file.type] ? st.file.type : 'image/png') : MIME[fmt.value];
    const out = document.createElement('canvas'); out.width = Math.round(c.w); out.height = Math.round(c.h);
    const x = out.getContext('2d');
    if (type === 'image/jpeg' || bg.value === 'white') { x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height); }
    x.drawImage(st.work, Math.round(c.x), Math.round(c.y), out.width, out.height, 0, 0, out.width, out.height);
    const blob = await toBlob(out, type, 0.92);
    save(blob, `${baseName(st.file)}-edited.${EXT_OF[blob.type] || 'png'}`);
    say(`Saved: ${out.width} x ${out.height} px, ${fmtSize(blob.size)}.`); beacon('Edit image');
  });
}

// ---------------------------------------------------------------- ZIP and ICO --
// Small writers so the favicon pack and the Word cover letter need no library.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** files: [[name, Uint8Array|string]] -> Blob (stored, not compressed) */
function zip(files, type = 'application/zip') {
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  for (const [name, data] of files) {
    const d = typeof data === 'string' ? enc.encode(data) : data, n = enc.encode(name), crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true);
    h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, n.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true);
    c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true); c.setUint32(42, off, true);
    parts.push(h, n, d); central.push(c, n); off += 30 + n.length + d.length;
  }
  const size = central.reduce((s, p) => s + p.byteLength, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, e], { type });
}
/** PNG files (Uint8Array, square) -> .ico with PNG entries (every browser since IE 9 reads them) */
function ico(pngs) {
  const head = new DataView(new ArrayBuffer(6 + 16 * pngs.length));
  head.setUint16(2, 1, true); head.setUint16(4, pngs.length, true);
  let off = head.byteLength;
  pngs.forEach(([size, d], i) => {
    const o = 6 + i * 16;
    head.setUint8(o, size >= 256 ? 0 : size); head.setUint8(o + 1, size >= 256 ? 0 : size);
    head.setUint16(o + 4, 1, true); head.setUint16(o + 6, 32, true); head.setUint32(o + 8, d.length, true); head.setUint32(o + 12, off, true);
    off += d.length;
  });
  return new Blob([head, ...pngs.map(([, d]) => d)], { type: 'image/x-icon' });
}
const bytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

// ------------------------------------------------------------ favicon generator --
function favicon() {
  const st = { img: null, src: 'image' };
  const prev = $('[data-preview]');
  const v = (sel) => $(sel).value;
  $$('[data-src-tab]').forEach((b) => b.addEventListener('click', () => {
    st.src = b.dataset.srcTab;
    $$('[data-src-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('[data-src-box]').forEach((x) => { x.hidden = x.dataset.srcBox !== st.src; });
    render();
  }));
  // one square master at 512 px
  function master() {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const shape = v('[data-shape]'), pad = Number(v('[data-pad]')) / 100;
    const clip = () => {
      x.beginPath();
      if (shape === 'circle') x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      else if (shape === 'rounded') x.roundRect(0, 0, S, S, S * 0.2);
      else x.rect(0, 0, S, S);
    };
    if (st.src === 'text') {
      clip(); x.fillStyle = v('[data-bgc]'); x.fill();
      const text = (v('[data-text]') || 'F').trim().slice(0, 3);
      x.fillStyle = v('[data-fgc]'); x.textAlign = 'center'; x.textBaseline = 'middle';
      let fs = S * (text.length === 1 ? 0.7 : text.length === 2 ? 0.52 : 0.4) * (1 - pad);
      x.font = `${v('[data-weight]')} ${fs}px ${v('[data-font]')}`;
      while (x.measureText(text).width > S * 0.86 && fs > 20) { fs -= 8; x.font = `${v('[data-weight]')} ${fs}px ${v('[data-font]')}`; }
      x.fillText(text, S / 2, S / 2 + fs * 0.04);
      return c;
    }
    if (!st.img) return null;
    if (v('[data-fill]') === 'color') { clip(); x.fillStyle = v('[data-bgc2]'); x.fill(); }
    x.save(); clip(); x.clip();
    const [w, h] = dims(st.img), inner = S * (1 - pad);
    const k = v('[data-fit]') === 'cover' ? Math.max(inner / w, inner / h) : Math.min(inner / w, inner / h);
    x.imageSmoothingQuality = 'high'; x.drawImage(st.img, (S - w * k) / 2, (S - h * k) / 2, w * k, h * k);
    x.restore();
    return c;
  }
  function render() {
    const m = master();
    $('[data-out]').hidden = !m;
    if (!m) return;
    $$('[data-pv]').forEach((cv) => { const s = Number(cv.dataset.pv); cv.width = cv.height = s; const x = cv.getContext('2d'); x.clearRect(0, 0, s, s); x.imageSmoothingQuality = 'high'; x.drawImage(m, 0, 0, s, s); });
    prev.dataset.ready = '1';
  }
  $$('[data-src-box] input, [data-src-box] select, [data-shape], [data-pad]').forEach((el) => el.addEventListener('input', render));
  dropZone(async (file) => {
    say('');
    try { st.img = await loadImage(file); } catch (e) { say(e.message, true); return; }
    $('[data-fname]').textContent = file.name; render();
  });
  const SNIPPET = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;
  $('[data-snippet]').value = SNIPPET;
  $('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(SNIPPET); say('HTML copied.'); } catch { $('[data-snippet]').select(); } });
  $('[data-go]').addEventListener('click', async () => {
    const m = master();
    if (!m) { say('Choose an image first, or switch to Text.', true); return; }
    say('Making your favicon pack…');
    const png = async (s, opaque) => { const c = scaled(m, s, s, opaque ? (st.src === 'text' ? null : '#ffffff') : null); return bytes(await toBlob(c, 'image/png')); };
    const p16 = await png(16), p32 = await png(32), p48 = await png(48);
    const name = (v('[data-appname]') || 'My website').trim().slice(0, 60);
    const manifest = JSON.stringify({ name, short_name: name.slice(0, 12), icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }], theme_color: '#ffffff', background_color: '#ffffff', display: 'standalone' }, null, 2);
    const blob = zip([
      ['favicon.ico', await bytes(ico([[16, p16], [32, p32], [48, p48]]))],
      ['favicon-16x16.png', p16], ['favicon-32x32.png', p32],
      ['apple-touch-icon.png', await png(180, true)],
      ['android-chrome-192x192.png', await png(192)], ['android-chrome-512x512.png', await png(512)],
      ['site.webmanifest', manifest], ['how-to-use.html', `<!-- Put these files in the root folder of your website, then add these lines inside <head> -->\n${SNIPPET}\n`],
    ]);
    save(blob, 'favicon.zip'); say('favicon.zip downloaded.'); beacon('Favicon');
  });
  render();
}

// ------------------------------------------------- uploads with progress, jobs --
function upload(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', url); x.responseType = 'blob';
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = async () => {
      if (x.status >= 200 && x.status < 300) return resolve(x.response);
      let msg = `The server answered ${x.status}.`;
      try { msg = JSON.parse(await x.response.text()).error || msg; } catch { /* not JSON */ }
      if (x.status === 413 && !/limit/i.test(msg)) msg = 'This file is too large.';
      reject(new Error(msg));
    };
    x.onerror = () => reject(new Error('The upload failed. Check your connection and try again.'));
    x.send(form);
  });
}
async function waitJob(id, onTick) {
  for (let i = 0; ; i++) {
    await new Promise((r) => setTimeout(r, i < 10 ? 1000 : 2000));
    const r = await fetch(`/api/jobs/${id}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'This result has expired.');
    if (j.status === 'done') return j;
    if (j.status === 'error') throw new Error(j.error || 'This file could not be processed.');
    onTick(j.status);
  }
}
function progress(p, text) { const bar = $('[data-prog]'); if (bar) { bar.hidden = p == null; bar.value = p || 0; } if (text != null) say(text); }

// ----------------------------------------------------------- background remover --
function bgremove() {
  const st = { file: null, cut: null, bg: 'transparent', color: '#ffffff' };
  const view = $('[data-canvas]'), vx = view.getContext('2d');
  function draw(showOrig) {
    if (!st.cut) return;
    const [w, h] = dims(st.cut);
    const k = Math.min(1, 900 / w, 600 / h);
    view.width = Math.round(w * k); view.height = Math.round(h * k);
    vx.clearRect(0, 0, view.width, view.height);
    if (showOrig && st.orig) { vx.drawImage(st.orig, 0, 0, view.width, view.height); return; }
    if (st.bg !== 'transparent') { vx.fillStyle = st.bg === 'white' ? '#fff' : st.color; vx.fillRect(0, 0, view.width, view.height); }
    vx.drawImage(st.cut, 0, 0, view.width, view.height);
    view.classList.toggle('checker', st.bg === 'transparent');
  }
  $$('input[name="bg"]').forEach((r) => r.addEventListener('change', () => { st.bg = r.value; draw(); }));
  $('[data-color]').addEventListener('input', (e) => { st.color = e.target.value; $('input[name="bg"][value="color"]').checked = true; st.bg = 'color'; draw(); });
  const hold = $('[data-orig]');
  ['pointerdown', 'pointerup', 'pointerleave'].forEach((ev) => hold.addEventListener(ev, () => draw(ev === 'pointerdown')));

  dropZone(async (file) => {
    if (!/^image\//.test(file.type) && !/\.(heic|heif|jpe?g|png|webp|avif|bmp|tiff?)$/i.test(file.name)) { say('Choose a photo (JPG, PNG, WEBP or HEIC).', true); return; }
    const max = Number(box.dataset.maxMb) || 40;
    if (file.size > max * 1024 * 1024) { say(`This file is larger than ${max} MB.`, true); return; }
    st.file = file; st.cut = null; showWork(true); $('[data-result]').hidden = true;
    $('[data-fname]').textContent = file.name; $('[data-fmeta]').textContent = fmtSize(file.size);
    st.orig = await loadImage(file).catch(() => null);
    const fd = new FormData(); fd.append('file', file);
    try {
      progress(0, 'Uploading…');
      const png = await upload('/api/remove-bg', fd, (p) => progress(p, p < 1 ? `Uploading… ${Math.round(p * 100)}%` : 'Removing the background… this takes a few seconds.'));
      st.png = png; st.cut = await createImageBitmap(png);
      progress(null, 'Done. Choose a background and download.'); $('[data-result]').hidden = false; draw(); beacon('Remove background');
    } catch (e) { progress(null); say(e.message, true); }
  });
  $('[data-dl]').addEventListener('click', async () => {
    if (!st.cut) return;
    if (st.bg === 'transparent') { save(st.png, `${baseName(st.file)}-no-background.png`); return; }
    const [w, h] = dims(st.cut), c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = st.bg === 'white' ? '#fff' : st.color; x.fillRect(0, 0, w, h); x.drawImage(st.cut, 0, 0);
    save(await toBlob(c, 'image/jpeg', 0.92), `${baseName(st.file)}-new-background.jpg`);
  });
}

// --------------------------------------------------------------- video compressor --
const maxVideoMb = () => Number(box.dataset.maxMb) || 500;
function mediaFile(file, kind) {
  const ok = kind === 'audio' ? /^(audio|video)\//.test(file.type) || /\.(mp3|wav|m4a|aac|flac|ogg|oga|opus|wma|aiff?|amr|mp4|mov|webm|mkv|avi)$/i.test(file.name)
    : /^video\//.test(file.type) || /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv|3gp|mpe?g|ts|mts|m2ts)$/i.test(file.name);
  if (!ok) throw new Error(kind === 'audio' ? 'Choose an audio file (MP3, WAV, M4A ...) or a video.' : 'Choose a video file (MP4, MOV, WEBM, MKV ...).');
  if (file.size > maxVideoMb() * 1024 * 1024) throw new Error(`This file is ${fmtSize(file.size)}; the limit is ${maxVideoMb()} MB. Trim it first with the video trimmer, or compress it on your phone.`);
}
// Big files go up in pieces (a proxy may refuse one request over 100 MB); the server joins them.
function putPiece(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
    x.onload = () => { if (x.status >= 200 && x.status < 300) resolve(); else { let m = `The server answered ${x.status}.`; try { m = JSON.parse(x.responseText).error || m; } catch { /* not JSON */ } reject(Object.assign(new Error(m), { status: x.status })); } };
    x.onerror = () => reject(new Error('The upload failed. Check your connection and try again.'));
    x.send(blob);
  });
}
const postJson = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `The server answered ${r.status}.`);
  return j;
};
async function uploadInPieces(file, onProgress) {
  const { id, chunk } = await postJson('/api/upload', { name: file.name, size: file.size });
  for (let n = 0, off = 0; off < file.size; n++, off += chunk) {
    const piece = file.slice(off, Math.min(file.size, off + chunk));
    for (let tryNo = 0; ; tryNo++) { // a dropped connection is retried twice
      try { await putPiece(`/api/upload/${id}/${n}`, piece, (sent) => onProgress((off + sent) / file.size)); break; } catch (e) {
        if (tryNo >= 2 || (e.status && e.status !== 502 && e.status !== 503 && e.status !== 504)) throw e;
        await new Promise((r) => setTimeout(r, 2000 * (tryNo + 1)));
      }
    }
  }
  return id;
}
async function runJob(url, fd, doneText) {
  progress(0, 'Uploading…');
  const file = fd.get('file'), fields = Object.fromEntries([...fd].filter(([k]) => k !== 'file'));
  const upId = await uploadInPieces(file, (p) => progress(p, `Uploading… ${Math.round(p * 100)}%`));
  const { id } = await postJson(url, { ...fields, upload: upId });
  progress(null, 'Working on it… this can take a minute or two for long videos. Keep this page open.');
  const j = await waitJob(id, (s) => say(s === 'queued' ? 'Waiting for a free slot… keep this page open.' : 'Working on it… keep this page open.'));
  const dl = $('[data-dl-link]'); dl.href = `/api/jobs/${id}/file`; dl.setAttribute('download', j.name);
  $('[data-done]').hidden = false;
  $('[data-done-text]').textContent = doneText(j);
  say('');
  return j;
}
function vcompress() {
  const st = { file: null };
  const target = () => ($('input[name="target"]:checked') || {}).value;
  const sync = () => { $('[data-custom]').hidden = target() !== 'custom'; };
  $$('input[name="target"]').forEach((r) => r.addEventListener('change', sync)); sync();
  dropZone((file) => {
    try { mediaFile(file, 'video'); } catch (e) { say(e.message, true); return; }
    st.file = file; $('[data-fname]').textContent = file.name; $('[data-fmeta]').textContent = fmtSize(file.size);
    $('[data-done]').hidden = true; showWork(true); say('');
    const v = document.createElement('video'); v.preload = 'metadata'; v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => { if (isFinite(v.duration)) $('[data-fmeta]').textContent = `${fmtSize(file.size)} · ${clock(v.duration)}${v.videoWidth ? ` · ${v.videoWidth} x ${v.videoHeight}` : ''}`; };
  });
  $('[data-go]').addEventListener('click', async () => {
    if (!st.file) return;
    const t = target(); const fd = new FormData();
    if (t === 'custom') {
      const mb = Number($('[data-mb]').value);
      if (!(mb >= 1)) { say('Enter a size of at least 1 MB.', true); return; }
      fd.append('targetMB', String(mb));
    } else if (/^\d+$/.test(t)) fd.append('targetMB', t);
    else fd.append('quality', t);
    fd.append('file', st.file);
    const go = $('[data-go]'); go.disabled = true;
    try {
      await runJob('/api/video/compress', fd, (j) => `${fmtSize(st.file.size)} → ${fmtSize(j.size)} (${Math.max(0, Math.round((1 - j.size / st.file.size) * 100))}% smaller). MP4, plays everywhere.`);
      $('[data-work]').hidden = true; beacon('Compress video');
    } catch (e) { progress(null); say(e.message, true); } finally { go.disabled = false; }
  });
}

// ---------------------------------------- video trimmer, MP3 cutter, ringtone maker --
const clock = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; };
const unclock = (t) => { const p = String(t).trim().split(':').map(Number); if (p.some((n) => Number.isNaN(n))) return NaN; return p.reduce((a, n) => a * 60 + n, 0); };
function trim() {
  const kind = box.dataset.kind; // video | audio | ringtone
  const MAX = kind === 'ringtone' ? 40 : Infinity;
  const st = { file: null, dur: 0, start: 0, end: 0 };
  const media = $(kind === 'video' ? 'video[data-media]' : 'audio[data-media]');
  const sIn = $('[data-start]'), eIn = $('[data-end]'), track = $('[data-track]'), sel = $('[data-sel]');
  const hs = $('[data-h="s"]'), he = $('[data-h="e"]'), head = $('[data-head]');
  function paint() {
    const d = st.dur || 1;
    sel.style.left = `${(st.start / d) * 100}%`; sel.style.width = `${((st.end - st.start) / d) * 100}%`;
    hs.style.left = `${(st.start / d) * 100}%`; he.style.left = `${(st.end / d) * 100}%`;
    sIn.value = clock(st.start); eIn.value = clock(st.end);
    $('[data-len]').textContent = `Length: ${clock(st.end - st.start)}${MAX < Infinity ? ` (max ${MAX} s)` : ''}`;
  }
  function set(which, t) {
    t = Math.min(Math.max(0, t), st.dur || t);
    if (which === 's') { st.start = Math.min(t, st.end - 0.1); if (st.end - st.start > MAX) st.end = st.start + MAX; } else { st.end = Math.max(t, st.start + 0.1); if (st.end - st.start > MAX) st.start = st.end - MAX; }
    st.start = Math.max(0, st.start); st.end = Math.min(st.dur || st.end, st.end); paint();
  }
  let drag = null;
  const tAt = (e) => { const r = track.getBoundingClientRect(); return (Math.min(Math.max(0, e.clientX - r.left), r.width) / r.width) * st.dur; };
  [hs, he].forEach((h) => h.addEventListener('pointerdown', (e) => { drag = h.dataset.h; h.setPointerCapture(e.pointerId); e.preventDefault(); }));
  [hs, he].forEach((h) => h.addEventListener('pointermove', (e) => { if (drag) set(drag, tAt(e)); }));
  [hs, he].forEach((h) => h.addEventListener('pointerup', () => { drag = null; }));
  track.addEventListener('click', (e) => { if (e.target === track || e.target === sel) media.currentTime = tAt(e); });
  [hs, he].forEach((h) => h.addEventListener('keydown', (e) => { const d = { ArrowLeft: -0.1, ArrowRight: 0.1, PageDown: -1, PageUp: 1 }[e.key]; if (d) { set(h.dataset.h, (h.dataset.h === 's' ? st.start : st.end) + d); e.preventDefault(); } }));
  sIn.addEventListener('change', () => { const t = unclock(sIn.value); if (t >= 0) set('s', t); else paint(); });
  eIn.addEventListener('change', () => { const t = unclock(eIn.value); if (t >= 0) set('e', t); else paint(); });
  $('[data-set-s]').addEventListener('click', () => set('s', media.currentTime));
  $('[data-set-e]').addEventListener('click', () => set('e', media.currentTime));
  let stopAt = null;
  $('[data-play-sel]').addEventListener('click', () => { media.currentTime = st.start; stopAt = st.end; media.play(); });
  media.addEventListener('timeupdate', () => {
    head.style.left = `${(media.currentTime / (st.dur || 1)) * 100}%`;
    if (stopAt != null && media.currentTime >= stopAt) { media.pause(); stopAt = null; }
  });

  dropZone((file) => {
    try { mediaFile(file, kind === 'video' ? 'video' : 'audio'); } catch (e) { say(e.message, true); return; }
    st.file = file; $('[data-fname]').textContent = file.name; $('[data-fmeta]').textContent = fmtSize(file.size);
    $('[data-done]').hidden = true; showWork(true); say('');
    media.src = URL.createObjectURL(file);
    $('[data-nopreview]').hidden = true;
    media.onloadedmetadata = () => {
      st.dur = isFinite(media.duration) ? media.duration : 0;
      st.start = 0; st.end = Math.min(st.dur, kind === 'ringtone' ? 30 : st.dur);
      $('[data-fmeta]').textContent = `${fmtSize(file.size)} · ${clock(st.dur)}`; paint();
    };
    media.onerror = () => {
      // the browser cannot play this format: times can still be typed, the server does the cutting
      $('[data-nopreview]').hidden = false; st.dur = 3600; st.start = 0; st.end = kind === 'ringtone' ? 30 : 60; paint();
    };
  });
  $('[data-go]').addEventListener('click', async () => {
    if (!st.file) return;
    const fd = new FormData();
    const fmt = kind === 'video' ? 'mp4' : (($('input[name="fmt"]:checked') || {}).value || 'mp3');
    fd.append('start', st.start.toFixed(2)); fd.append('end', st.end.toFixed(2)); fd.append('format', fmt);
    if (kind !== 'video') {
      fd.append('fadeIn', ($('[data-fade-in]') || {}).checked ? '1.5' : '0');
      fd.append('fadeOut', ($('[data-fade-out]') || {}).checked ? '2' : '0');
    }
    if (kind === 'ringtone') fd.append('ringtone', '1');
    fd.append('file', st.file);
    const go = $('[data-go]'); go.disabled = true; media.pause();
    try {
      await runJob('/api/media/trim', fd, (j) => `${clock(st.end - st.start)} long, ${fmtSize(j.size)}. ${fmt === 'm4r' ? 'On iPhone: open the file in GarageBand or add it with Finder/iTunes, then choose it in Settings > Sounds.' : kind === 'ringtone' ? 'On Android: save it to the Ringtones folder, then choose it in Settings > Sound.' : ''}`);
      beacon(kind === 'video' ? 'Trim video' : kind === 'ringtone' ? 'Ringtone' : 'Cut audio');
    } catch (e) { progress(null); say(e.message, true); } finally { go.disabled = false; }
  });
}

// ------------------------------------------------------------------ word counter --
const STOP = new Set('a an and are as at be but by for from has have he her his i if in into is it its me my not of on or our she so than that the their them they this to us was we were what when which who will with you your'.split(' '));
function words() {
  const ta = $('[data-text]');
  const saved = store.get('flipit-words'); if (saved && typeof saved === 'string') ta.value = saved;
  const set = (k, v) => { const el = $(`[data-stat="${k}"]`); if (el) el.textContent = v; };
  const mins = (n, wpm) => { const m = n / wpm; return m < 1 ? `${Math.max(n ? 1 : 0, Math.round(m * 60))} sec` : `${Math.floor(m)} min ${Math.round((m % 1) * 60)} sec`; };
  function update() {
    const t = ta.value;
    const w = t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
    const chars = [...t].length, noSp = [...t.replace(/\s/g, '')].length;
    const sentences = (t.match(/[^.!?…]*[\p{L}\p{N}][^.!?…]*([.!?…]+|$)/gu) || []).filter((s) => s.trim()).length;
    const paras = t.split(/\n\s*\n/).filter((p) => p.trim()).length;
    set('words', w.length.toLocaleString('en-US')); set('chars', chars.toLocaleString('en-US')); set('nospace', noSp.toLocaleString('en-US'));
    set('sentences', sentences.toLocaleString('en-US')); set('paragraphs', paras.toLocaleString('en-US'));
    set('read', mins(w.length, 238)); set('speak', mins(w.length, 150));
    set('avg', w.length ? (w.reduce((s, x) => s + x.length, 0) / w.length).toFixed(1) : '0');
    set('pages', (w.length / 500).toFixed(1));
    $$('[data-limit]').forEach((row) => {
      const max = Number(row.dataset.limit), used = chars, bar = $('progress', row);
      bar.max = max; bar.value = Math.min(used, max); row.classList.toggle('over', used > max);
      $('[data-left]', row).textContent = used > max ? `${(used - max).toLocaleString('en-US')} over` : `${(max - used).toLocaleString('en-US')} left`;
    });
    const freq = new Map();
    for (const x of w) { const k = x.toLowerCase(); if (k.length > 2 && !STOP.has(k)) freq.set(k, (freq.get(k) || 0) + 1); }
    const top = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 10);
    $('[data-kw]').innerHTML = top.length ? top.map(([k, n]) => `<li><span>${k.replace(/[<&>]/g, '')}</span><b>${n} (${((n / w.length) * 100).toFixed(1)}%)</b></li>`).join('') : '<li class="muted">Start typing to see your most used words.</li>';
    store.set('flipit-words', t.length < 200000 ? t : '');
  }
  ta.addEventListener('input', update);
  const cases = {
    upper: (t) => t.toUpperCase(), lower: (t) => t.toLowerCase(),
    title: (t) => t.toLowerCase().replace(/(^|[\s(“"'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
    sentence: (t) => t.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
  };
  $$('[data-case]').forEach((b) => b.addEventListener('click', () => { ta.value = cases[b.dataset.case](ta.value); update(); }));
  $('[data-clear]').addEventListener('click', () => { ta.value = ''; update(); ta.focus(); });
  $('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(ta.value); say('Copied.'); } catch { ta.select(); } });
  update();
}

// ---------------------------------------------------------- signature generator --
function signature() {
  const pad = $('[data-pad]'), px = pad.getContext('2d');
  const st = { mode: 'draw', strokes: [], cur: null, color: '#111827', width: 3 };
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  function sizePad() {
    const w = pad.parentElement.clientWidth || 600, h = Math.round(Math.min(260, w * 0.45));
    pad.width = w * DPR; pad.height = h * DPR; pad.style.height = `${h}px`; redraw();
  }
  function line(ctx, s, k = 1) {
    ctx.strokeStyle = s.color; ctx.lineWidth = s.width * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p = s.pts; if (!p.length) return;
    ctx.beginPath(); ctx.moveTo(p[0][0] * k, p[0][1] * k);
    if (p.length === 1) ctx.lineTo(p[0][0] * k + 0.1, p[0][1] * k);
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0] * k, p[i][1] * k, mx * k, my * k); }
    if (p.length > 1) ctx.lineTo(p[p.length - 1][0] * k, p[p.length - 1][1] * k);
    ctx.stroke();
  }
  function redraw() {
    px.setTransform(1, 0, 0, 1, 0, 0); px.clearRect(0, 0, pad.width, pad.height);
    px.strokeStyle = '#d4d4d8'; px.lineWidth = DPR; px.setLineDash([6 * DPR, 6 * DPR]);
    px.beginPath(); px.moveTo(20 * DPR, pad.height * 0.75); px.lineTo(pad.width - 20 * DPR, pad.height * 0.75); px.stroke(); px.setLineDash([]);
    for (const s of st.strokes) line(px, s, DPR);
    if (st.cur) line(px, st.cur, DPR);
    $('[data-hint]').hidden = st.strokes.length > 0 || !!st.cur;
  }
  const at = (e) => { const r = pad.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); st.cur = { color: st.color, width: st.width, pts: [at(e)] }; redraw(); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (!st.cur) return; const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; for (const ev of evs) st.cur.pts.push(at(ev)); redraw(); });
  const up = () => { if (st.cur) { st.strokes.push(st.cur); st.cur = null; redraw(); } };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  $('[data-undo]').addEventListener('click', () => { st.strokes.pop(); redraw(); });
  $('[data-clear]').addEventListener('click', () => { st.strokes = []; redraw(); });
  $$('[data-pen]').forEach((b) => b.addEventListener('click', () => { st.color = b.dataset.pen; $$('[data-pen]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); typed(); }));
  $('[data-thick]').addEventListener('input', (e) => { st.width = Number(e.target.value); });
  $$('[data-mode-tab]').forEach((b) => b.addEventListener('click', () => {
    st.mode = b.dataset.modeTab;
    $$('[data-mode-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('[data-mode-box]').forEach((x) => { x.hidden = x.dataset.modeBox !== st.mode; });
    if (st.mode === 'draw') sizePad(); else typed();
  }));

  // typed signatures: handwriting fonts kept on this server (fonts.js)
  const loaded = new Map();
  const loadFont = (id) => {
    if (!loaded.has(id)) loaded.set(id, new FontFace(`sig-${id}`, `url(/fonts/${id}/400.ttf)`).load().then((f) => { document.fonts.add(f); return true; }).catch(() => false));
    return loaded.get(id);
  };
  const nameIn = $('[data-name]');
  async function typed() {
    const name = nameIn.value.trim() || 'Your Name';
    for (const el of $$('[data-font-opt]')) {
      const id = el.dataset.fontOpt; const ok = await loadFont(id);
      el.style.fontFamily = ok ? `"sig-${id}", cursive` : 'cursive'; el.style.color = st.color;
      $('span', el).textContent = name;
    }
  }
  nameIn.addEventListener('input', typed);
  $$('[data-font-opt]').forEach((el) => el.addEventListener('click', () => { $$('[data-font-opt]').forEach((x) => x.setAttribute('aria-pressed', String(x === el))); }));

  // the signature as a trimmed canvas at 3x, transparent or on white
  function render(white) {
    let c;
    if (st.mode === 'draw') {
      if (!st.strokes.length) throw new Error('Draw your signature first.');
      const k = 3, pts = st.strokes.flatMap((s) => s.pts), m = Math.max(...st.strokes.map((s) => s.width)) * 2 + 6;
      const x0 = Math.min(...pts.map((p) => p[0])) - m, y0 = Math.min(...pts.map((p) => p[1])) - m;
      const x1 = Math.max(...pts.map((p) => p[0])) + m, y1 = Math.max(...pts.map((p) => p[1])) + m;
      c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0) * k); c.height = Math.ceil((y1 - y0) * k);
      const x = c.getContext('2d'); if (white) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
      x.translate(-x0 * k, -y0 * k); for (const s of st.strokes) line(x, s, k);
    } else {
      const pick = $('[data-font-opt][aria-pressed="true"]') || $('[data-font-opt]');
      const name = nameIn.value.trim();
      if (!name) throw new Error('Type your name first.');
      const font = `140px ${pick.style.fontFamily || 'cursive'}`;
      const t = document.createElement('canvas').getContext('2d'); t.font = font;
      const mt = t.measureText(name), pad2 = 40;
      const asc = mt.actualBoundingBoxAscent || 120, desc = mt.actualBoundingBoxDescent || 40;
      c = document.createElement('canvas'); c.width = Math.ceil(mt.width + pad2 * 2 + 60); c.height = Math.ceil(asc + desc + pad2 * 2);
      const x = c.getContext('2d'); if (white) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
      x.font = font; x.fillStyle = st.color; x.fillText(name, pad2 + 30, pad2 + asc);
    }
    return c;
  }
  $('[data-dl-png]').addEventListener('click', async () => { try { save(await toBlob(render(false), 'image/png'), 'signature.png'); say('Transparent PNG downloaded.'); beacon('Signature'); } catch (e) { say(e.message, true); } });
  $('[data-dl-jpg]').addEventListener('click', async () => { try { save(await toBlob(render(true), 'image/jpeg', 0.95), 'signature.jpg'); say('JPG downloaded.'); beacon('Signature'); } catch (e) { say(e.message, true); } });
  window.addEventListener('resize', () => { if (st.mode === 'draw') sizePad(); });
  sizePad(); typed();
}

// ---------------------------------------------------------- cover letter generator --
const LETTERS = {
  professional: (d) => [
    `I am writing to apply for the ${d.job || '[job title]'} position at ${d.company || '[company]'}. With ${d.years || '[number]'} years of experience in ${d.field || '[your field]'}, I have built strong skills in ${d.skills || '[your main skills]'}, and I am confident I can make a real contribution to your team.`,
    `${d.achievement ? `In my current role, ${d.achievement.replace(/^[a-z]/, (m) => m.toLowerCase()).replace(/\.?$/, '.')} ` : ''}I enjoy solving problems, working closely with colleagues and customers, and taking ownership of results. What draws me to ${d.company || 'your company'} is ${d.why || 'its reputation for quality and the chance to keep learning and growing'}.`,
    'I would welcome the opportunity to discuss how my experience fits your needs. Thank you for your time and consideration. I look forward to hearing from you.',
  ],
  entry: (d) => [
    `I am excited to apply for the ${d.job || '[job title]'} position at ${d.company || '[company]'}. ${d.field ? `As a ${d.field} graduate` : 'As a recent graduate'}, I am eager to start my career with a team where I can learn quickly and contribute from day one.`,
    `Through my studies, internships and projects I developed skills in ${d.skills || '[your main skills]'}. ${d.achievement ? `${d.achievement.replace(/\.?$/, '.')} ` : ''}I am reliable, I learn fast, and I take feedback seriously. I am especially interested in ${d.company || 'your company'} because ${d.why || 'of the work you do and the way you develop new team members'}.`,
    'Thank you for considering my application. I would be glad to talk about how I can help your team, and I am available for an interview at your convenience.',
  ],
  change: (d) => [
    `I am writing to express my interest in the ${d.job || '[job title]'} role at ${d.company || '[company]'}. After ${d.years || '[number]'} years in ${d.field || '[your previous field]'}, I am moving into this field, and I bring transferable skills that would serve your team well.`,
    `My background has given me strong experience in ${d.skills || '[your transferable skills]'}. ${d.achievement ? `${d.achievement.replace(/\.?$/, '.')} ` : ''}I have also been preparing for this change through courses and hands-on practice, and I am motivated to apply what I have learned. ${d.company || 'Your company'} stands out to me because ${d.why || 'of its mission and the people I would work with'}.`,
    'Thank you for your time. I would appreciate the chance to discuss how my experience and fresh perspective could benefit your team.',
  ],
};
// pdf-lib's standard fonts only cover Windows-1252; keep new lines, drop what cannot be shown
const WIN = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
const winText = (s) => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\n\x20-\x7e\xa0-\xff]/g, (ch) => (WIN.has(ch) ? ch : ''));
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function cover() {
  const F = (k) => $(`[data-f="${k}"]`);
  const KEYS = $$('[data-f]').map((el) => el.dataset.f);
  const saved = store.get('flipit-cover') || {};
  for (const k of KEYS) if (saved[k] != null && F(k)) F(k).value = saved[k];
  if (!F('date').value) F('date').value = new Date().toISOString().slice(0, 10);
  if (!saved.paper) F('paper').value = /^America\//.test(Intl.DateTimeFormat().resolvedOptions().timeZone || '') ? 'letter' : 'a4';
  const data = () => Object.fromEntries(KEYS.map((k) => [k, F(k).value.trim()]));
  const persist = () => store.set('flipit-cover', Object.fromEntries(KEYS.map((k) => [k, F(k).value])));
  $$('[data-f]').forEach((el) => el.addEventListener('input', persist));
  $('[data-write]').addEventListener('click', () => {
    const d = data();
    if (F('body').value.trim() && !window.confirm('Replace the letter text you already have?')) return;
    F('body').value = (LETTERS[d.style] || LETTERS.professional)(d).join('\n\n').replace(/\.\./g, '.'); persist();
    say('Letter written. Read it through and make it your own before you send it.');
  });
  const dateText = (d) => { const t = new Date(`${d}T12:00:00`); return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); };
  const parts = () => {
    const d = data();
    const greet = d.manager ? `Dear ${d.manager},` : 'Dear Hiring Manager,';
    const contact = [d.email, d.phone, d.city, d.link].filter(Boolean);
    const to = [d.manager, d.company, d.address].filter(Boolean);
    return { d, greet, contact, to, body: (d.body || '').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean) };
  };
  const check = () => { const { d, body } = parts(); if (!d.name) throw new Error('Add your name first.'); if (!body.length) throw new Error('Write the letter first (or click "Write my letter").'); };
  $('[data-copy]').addEventListener('click', async () => {
    const { d, greet, body } = parts();
    try { await navigator.clipboard.writeText([greet, '', ...body.flatMap((p) => [p, '']), 'Sincerely,', d.name].join('\n')); say('Letter copied.'); } catch { say('Copy is blocked in this browser; select the text and copy it.', true); }
  });
  $('[data-pdf]').addEventListener('click', async () => {
    try { check(); } catch (e) { say(e.message, true); return; }
    if (!window.PDFLib) { say('Still loading, try again in a moment.', true); return; }
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const { d, greet, contact, to, body } = parts();
    const doc = await PDFDocument.create();
    const [PW, PH] = d.paper === 'a4' ? [595.28, 841.89] : [612, 792];
    const M = 72; let page = doc.addPage([PW, PH]); let y = PH - M;
    const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.1, 0.1, 0.12), dim = rgb(0.38, 0.38, 0.42), accent = rgb(0.9, 0.2, 0.18);
    const wrap = (text, w, f, size) => {
      const out = []; let lineText = '';
      for (const word of winText(text).split(/\s+/)) {
        const tryL = lineText ? `${lineText} ${word}` : word;
        if (f.widthOfTextAtSize(tryL, size) > w && lineText) { out.push(lineText); lineText = word; } else lineText = tryL;
      }
      if (lineText) out.push(lineText); return out;
    };
    const put = (text, opts = {}) => {
      const size = opts.size || 11, f = opts.f || font;
      for (const l of wrap(text, PW - 2 * M, f, size)) {
        if (y < M + size) { page = doc.addPage([PW, PH]); y = PH - M; }
        page.drawText(l, { x: M, y, size, font: f, color: opts.color || ink }); y -= size * (opts.lh || 1.5);
      }
    };
    put(d.name, { f: bold, size: 22, lh: 1.3 });
    if (contact.length) put(contact.join('  |  '), { size: 9.5, color: dim });
    y -= 4; page.drawRectangle({ x: M, y, width: 48, height: 2.5, color: accent }); y -= 26;
    put(dateText(d.date), { color: dim }); y -= 8;
    for (const l of to) put(l, { lh: 1.35 });
    y -= 12; put(greet); y -= 4;
    for (const p of body) { put(p); y -= 7; }
    y -= 6; put('Sincerely,'); y -= 18; put(d.name, { f: bold });
    save(new Blob([await doc.save()], { type: 'application/pdf' }), `Cover-Letter-${(d.name || 'me').replace(/[^\w]+/g, '-')}.pdf`);
    say('Cover letter PDF downloaded.'); beacon('Cover letter');
  });
  $('[data-docx]').addEventListener('click', () => {
    try { check(); } catch (e) { say(e.message, true); return; }
    const { d, greet, contact, to, body } = parts();
    const p = (text, o = {}) => `<w:p><w:pPr><w:spacing w:after="${o.after ?? 160}"/></w:pPr><w:r><w:rPr>${o.b ? '<w:b/>' : ''}<w:sz w:val="${o.sz || 22}"/>${o.color ? `<w:color w:val="${o.color}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${
      p(d.name, { b: true, sz: 40, after: 40 })}${contact.length ? p(contact.join('  |  '), { sz: 19, color: '5F5F6B', after: 360 }) : ''}${
      p(dateText(d.date), { after: 240 })}${to.map((l, i) => p(l, { after: i === to.length - 1 ? 240 : 0 })).join('')}${p(greet)}${body.map((x) => p(x)).join('')}${
      p('Sincerely,', { after: 480 })}${p(d.name, { b: true })}<w:sectPr>${d.paper === 'a4' ? '<w:pgSz w:w="11906" w:h="16838"/>' : '<w:pgSz w:w="12240" w:h="15840"/>'}<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const blob = zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
      ['word/document.xml', docXml],
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    save(blob, `Cover-Letter-${(d.name || 'me').replace(/[^\w]+/g, '-')}.docx`);
    say('Word file downloaded.'); beacon('Cover letter');
  });
}

({ resize, imgedit, favicon, bgremove, vcompress, trim, words, signature, cover }[box && box.dataset.app] || (() => {}))();
