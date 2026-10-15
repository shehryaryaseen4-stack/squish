// Stand-alone tools (content/apps.js): passport photo maker, text recognition (OCR) and the invoice
// generator. One module; the tool box on the page says which one it is (data-app).
const box = document.getElementById('app');
const $ = (sel, root = box) => root.querySelector(sel);
const $$ = (sel, root = box) => [...root.querySelectorAll(sel)];
const fmtSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const say = (text, bad) => { const m = $('[data-msg]'); if (m) { m.textContent = text || ''; m.classList.toggle('bad', !!bad); } };
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); };
// counted on the owner's dashboard like the other tools (public/script.js listens for pt:done)
const beacon = (what) => window.dispatchEvent(new CustomEvent('pt:done', { detail: what }));

// A drop zone with a hidden file input; calls onFile(file).
function dropZone(onFile) {
  const drop = $('[data-drop]'), input = $('[data-input]');
  $('[data-pick]').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); const f = e.dataTransfer.files[0]; if (f) onFile(f); });
}

// ------------------------------------------------------------- passport photo --
// Sizes in mm; head = chin to top of head as a share of the photo height (the middle of the allowed
// range), top = space above the head. px = the digital file.
const PASSPORT = {
  us: { name: '2x2', w: 50.8, h: 50.8, top: 0.12, head: 0.595, min: 0.5, max: 0.69, px: [600, 600] },
  eu: { name: '35x45mm', w: 35, h: 45, top: 0.09, head: 0.71, min: 0.644, max: 0.756, px: [413, 531] },
  ca: { name: '50x70mm', w: 50, h: 70, top: 0.16, head: 0.479, min: 0.443, max: 0.514, px: [591, 827] },
};
function passport() {
  const canvas = $('[data-canvas]'), ctx = canvas.getContext('2d');
  const st = { img: null, size: 'us', zoom: 1, x: 0, y: 0, rot: 0, bright: 100 };
  const spec = () => PASSPORT[st.size];
  const W = () => canvas.width, H = () => canvas.height;
  const cover = () => Math.max(W() / st.img.width, H() / st.img.height);

  function draw(c = ctx, w = W(), h = H(), guides = true) {
    const k = w / W(); // export at another size: the same picture, scaled
    c.save();
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    if (st.img) {
      c.filter = st.bright !== 100 ? `brightness(${st.bright}%)` : 'none';
      c.translate(w / 2 + st.x * k, h / 2 + st.y * k);
      c.rotate((st.rot * Math.PI) / 180);
      const s = cover() * st.zoom * k;
      c.drawImage(st.img, (-st.img.width * s) / 2, (-st.img.height * s) / 2, st.img.width * s, st.img.height * s);
    }
    c.restore();
    if (!guides) return;
    const p = spec(), top = h * p.top, chin = top + h * p.head;
    c.save();
    c.strokeStyle = 'rgba(229,50,45,.9)'; c.lineWidth = 2; c.setLineDash([10, 7]);
    for (const y of [top, chin]) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.setLineDash([4, 6]); c.strokeStyle = 'rgba(37,99,235,.7)';
    c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
    // face oval between the lines
    c.setLineDash([]); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(w / 2, (top + chin) / 2, (chin - top) * 0.36, (chin - top) / 2, 0, 0, Math.PI * 2); c.stroke();
    c.font = `${Math.round(w / 34)}px system-ui, sans-serif`; c.fillStyle = 'rgba(229,50,45,.95)';
    c.fillText('Top of head', 8, top - 6); c.fillText('Chin', 8, chin - 6);
    c.restore();
  }
  function setSize(size) {
    st.size = size;
    const p = spec();
    canvas.height = Math.round((600 * p.h) / p.w);
    draw();
  }
  async function load(file) {
    say('');
    if (!/^image\//.test(file.type) && !/\.(heic|heif|jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name)) { say('Please choose a photo (JPG, PNG, WEBP or HEIC).', true); return; }
    let img;
    try { img = await createImageBitmap(file); } catch {
      if (/heic|heif/i.test(file.type + file.name)) say('This browser cannot open HEIC photos. Convert it with HEIC to JPG first (link below), then choose the JPG here.', true);
      else say('This photo could not be opened. Try a JPG or PNG.', true);
      $('[data-work]').hidden = false; $('[data-drop]').hidden = true;
      return;
    }
    Object.assign(st, { img, zoom: 1, x: 0, y: 0, rot: 0, bright: 100 });
    $('[data-zoom]').value = 1; $('[data-rot]').value = 0; $('[data-bright]').value = 100;
    $('[data-drop]').hidden = true; $('[data-work]').hidden = false;
    draw();
  }
  dropZone(load);
  $('[data-size]').addEventListener('change', (e) => setSize(e.target.value));
  $('[data-zoom]').addEventListener('input', (e) => { st.zoom = Number(e.target.value); draw(); });
  $('[data-rot]').addEventListener('input', (e) => { st.rot = Number(e.target.value); draw(); });
  $('[data-bright]').addEventListener('input', (e) => { st.bright = Number(e.target.value); draw(); });
  $$('[data-again]').forEach((b) => b.addEventListener('click', () => { st.img = null; $('[data-work]').hidden = true; $('[data-drop]').hidden = false; say(''); }));

  // drag to move, two fingers to zoom, wheel to zoom
  const pts = new Map();
  let base = null;
  const scaleOf = () => W() / canvas.getBoundingClientRect().width; // screen px -> canvas px
  canvas.addEventListener('pointerdown', (e) => {
    if (!st.img) return;
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    base = { pts: new Map(pts), x: st.x, y: st.y, zoom: st.zoom };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !base) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const k = scaleOf();
    if (pts.size >= 2 && base.pts.size >= 2) {
      const [a, b] = [...pts.values()], [a0, b0] = [...base.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
      st.zoom = Math.min(4, Math.max(0.2, (base.zoom * d) / d0));
      $('[data-zoom]').value = st.zoom;
    } else {
      const p0 = base.pts.get(e.pointerId);
      if (!p0) return;
      st.x = base.x + (e.clientX - p0.x) * k; st.y = base.y + (e.clientY - p0.y) * k;
    }
    draw();
  });
  const up = (e) => { pts.delete(e.pointerId); base = pts.size ? { pts: new Map(pts), x: st.x, y: st.y, zoom: st.zoom } : null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    if (!st.img) return;
    e.preventDefault();
    st.zoom = Math.min(4, Math.max(0.2, st.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
    $('[data-zoom]').value = st.zoom; draw();
  }, { passive: false });

  const render = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h, false); return c; };
  const jpg = (c) => new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
  $('[data-dl-photo]').addEventListener('click', async () => {
    if (!st.img) return;
    const [w, h] = spec().px;
    save(await jpg(render(w, h)), `passport-photo-${spec().name}.jpg`);
    say(`Saved a ${w} x ${h} pixel JPG.`); beacon('Passport photo');
  });
  $('[data-dl-sheet]').addEventListener('click', async () => {
    if (!st.img) return;
    // 6 x 4 inch at 300 dpi, as many photos as fit, with thin grey cut lines
    const p = spec(), dpi = 300, mm = dpi / 25.4;
    const pw = Math.round(p.w * mm), ph = Math.round(p.h * mm);
    // landscape or portrait, with a small gap or edge to edge: whichever holds the most photos
    let best = null;
    for (const [SW, SH] of [[1800, 1200], [1200, 1800]]) for (const gap of [12, 0]) {
      const cols = Math.floor((SW + gap) / (pw + gap)), rows = Math.floor((SH + gap) / (ph + gap));
      if (!best || cols * rows > best.cols * best.rows) best = { SW, SH, gap, cols, rows };
    }
    const { SW, SH, gap, cols, rows } = best;
    const sheet = document.createElement('canvas'); sheet.width = SW; sheet.height = SH;
    const c = sheet.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, SW, SH);
    const one = render(pw, ph);
    const ox = Math.round((SW - (cols * pw + (cols - 1) * gap)) / 2), oy = Math.round((SH - (rows * ph + (rows - 1) * gap)) / 2);
    c.strokeStyle = '#bbb'; c.lineWidth = 1;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const x = ox + q * (pw + gap), y = oy + r * (ph + gap);
      c.drawImage(one, x, y);
      c.strokeRect(x - 0.5, y - 0.5, pw + 1, ph + 1);
    }
    save(await jpg(sheet), `passport-photo-${p.name}-4x6-print.jpg`);
    say(`Saved a 4x6 inch sheet with ${cols * rows} photos. Print it as a regular 4x6 photo, without cropping or resizing.`); beacon('Passport sheet');
  });
  setSize('us');
}

// ------------------------------------------------------------------ OCR --
function ocr() {
  const maxMb = Number(box.dataset.maxMb || 40);
  let file = null, url = null;
  const show = (part) => { for (const k of ['drop', 'work', 'out', 'done']) $(`[data-${k}]`).hidden = k !== part; };
  dropZone((f) => {
    if (f.size > maxMb * 1024 * 1024) { say(`This file is ${fmtSize(f.size)}; the limit is ${maxMb} MB.`, true); return; }
    file = f;
    $('[data-fname]').textContent = f.name; $('[data-fmeta]').textContent = fmtSize(f.size);
    // a PDF usually wants a searchable PDF back, an image usually wants the text
    const pdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
    if (!box.dataset.picked) $$('input[name="fmt"]').forEach((r) => { r.checked = r.value === (pdf && location.pathname === '/ocr-pdf' ? 'pdf' : 'txt'); });
    show('work'); say('');
  });
  $$('input[name="fmt"]').forEach((r) => r.addEventListener('change', () => { box.dataset.picked = '1'; }));
  $$('[data-again]').forEach((b) => b.addEventListener('click', () => { file = null; show('drop'); say(''); }));
  $('[data-go]').addEventListener('click', () => {
    if (!file) return;
    const fmt = ($$('input[name="fmt"]').find((r) => r.checked) || {}).value || 'txt';
    const form = new FormData();
    form.append('file', file); form.append('lang', $('[data-lang]').value); form.append('format', fmt);
    const go = $('[data-go]'); go.disabled = true;
    say('Uploading...');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/ocr'); xhr.responseType = 'blob';
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) say(e.loaded < e.total ? `Uploading... ${Math.round((e.loaded / e.total) * 100)}%` : 'Reading the text... this can take a few seconds per page.'); };
    xhr.onload = async () => {
      go.disabled = false;
      if (xhr.status !== 200) {
        let msg = 'The text could not be read. Try again with a clearer photo or scan.';
        try { msg = JSON.parse(await xhr.response.text()).error || msg; } catch { /* not JSON */ }
        say(msg, true); return;
      }
      const pages = Number(xhr.getResponseHeader('X-Pages') || 1);
      const name = file.name.replace(/\.[^.]+$/, '') || 'scan';
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(xhr.response);
      beacon(fmt === 'pdf' ? 'OCR to PDF' : 'OCR to text');
      if (fmt === 'pdf') {
        const a = $('[data-dl-pdf]'); a.href = url; a.download = `${name}-searchable.pdf`;
        $('[data-done-text]').textContent = `${pages} page${pages > 1 ? 's' : ''} read. The PDF looks the same as before, and now you can search it and copy its text.`;
        show('done'); return;
      }
      const text = await xhr.response.text();
      $('[data-text]').value = text || '';
      $('[data-out-title]').textContent = text.trim() ? `Text from ${pages} page${pages > 1 ? 's' : ''}` : 'No text was found';
      const a = $('[data-dl]'); a.href = url; a.download = `${name}.txt`;
      show('out');
      if (!text.trim()) say('No text was found. Use a sharper photo, crop it to the text, or pick the right language.', true);
    };
    xhr.onerror = () => { go.disabled = false; say('The connection was lost. Check your internet and try again.', true); };
    xhr.send(form);
  });
  $('[data-copy]').addEventListener('click', async () => {
    const t = $('[data-text]');
    try { await navigator.clipboard.writeText(t.value); } catch { t.select(); document.execCommand('copy'); }
    $('[data-copy]').textContent = 'Copied!'; setTimeout(() => { $('[data-copy]').textContent = 'Copy text'; }, 1500);
  });
}

// --------------------------------------------------------------- invoice --
// US Letter for visitors in the Americas (and US English browsers), A4 everywhere else
function letterPaper() {
  try { if (/^America\//.test(Intl.DateTimeFormat().resolvedOptions().timeZone)) return true; } catch { /* old browser */ }
  return /^en-(US|CA)$/i.test(navigator.language || 'en-US');
}
function invoice() {
  const KEY = 'flipit-invoice';
  const today = () => new Date().toISOString().slice(0, 10);
  const plusDays = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const blank = () => ({ number: 'INV-0001', date: today(), due: plusDays(today(), 30), fromName: '', fromAddr: '', toName: '', toAddr: '', notes: '', terms: 'Net 30',
    currency: 'USD', tax: '', discount: '', shipping: '', paid: '', paper: letterPaper() ? 'letter' : 'a4', logo: '', items: [{ desc: '', qty: 1, rate: '' }] });
  let st;
  try { st = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { st = blank(); }
  if (!Array.isArray(st.items) || !st.items.length) st.items = blank().items;
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* full or private mode: still works for this visit */ } };
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const sym = () => { const o = $(`[data-f="currency"] option[value="${st.currency}"]`); return o ? o.dataset.sym : '$'; };
  const money = (v) => `${v < 0 ? '-' : ''}${sym()}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totals = () => {
    const sub = st.items.reduce((s, it) => s + num(it.qty) * num(it.rate), 0);
    const disc = (sub * num(st.discount)) / 100, taxable = sub - disc, tax = (taxable * num(st.tax)) / 100;
    const total = taxable + tax + num(st.shipping);
    return { sub, disc, tax, ship: num(st.shipping), total, paid: num(st.paid), due: total - num(st.paid) };
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderItems() {
    $('[data-items]').innerHTML = st.items.map((it, i) => `<tr data-i="${i}">
      <td><input data-c="desc" value="${esc(it.desc)}" placeholder="Item or service" aria-label="Description"></td>
      <td class="n"><input data-c="qty" type="number" min="0" step="any" value="${esc(it.qty)}" aria-label="Quantity"></td>
      <td class="n"><input data-c="rate" type="number" min="0" step="any" value="${esc(it.rate)}" placeholder="0.00" aria-label="Rate"></td>
      <td class="n amt">${money(num(it.qty) * num(it.rate))}</td>
      <td><button type="button" class="inv-del" data-del aria-label="Remove item"${st.items.length < 2 ? ' disabled' : ''}>&times;</button></td></tr>`).join('');
  }
  function renderTotals() {
    const t = totals();
    $$('[data-items] tr').forEach((tr) => { const it = st.items[tr.dataset.i]; if (it) tr.querySelector('.amt').textContent = money(num(it.qty) * num(it.rate)); });
    $('[data-totals]').innerHTML = [['Subtotal', t.sub], t.disc ? [`Discount (${num(st.discount)}%)`, -t.disc] : null, t.tax ? [`Tax (${num(st.tax)}%)`, t.tax] : null,
      t.ship ? ['Shipping', t.ship] : null, ['Total', t.total, 'tot'], t.paid ? ['Amount paid', -t.paid] : null, t.paid ? ['Balance due', t.due, 'tot'] : null]
      .filter(Boolean).map(([k, v, c]) => `<dt${c ? ` class="${c}"` : ''}>${k}</dt><dd${c ? ` class="${c}"` : ''}>${money(v)}</dd>`).join('');
  }
  function fill() {
    $$('[data-f]').forEach((el) => { el.value = st[el.dataset.f] ?? ''; });
    const img = $('[data-logo-img]');
    img.hidden = !st.logo; $('[data-logo-del]').hidden = !st.logo; if (st.logo) img.src = st.logo;
    renderItems(); renderTotals();
  }
  box.addEventListener('input', (e) => {
    const f = e.target.dataset.f, c = e.target.dataset.c;
    if (f) st[f] = e.target.value;
    if (c) { const i = Number(e.target.closest('tr').dataset.i); st.items[i][c] = e.target.value; }
    if (f || c) { renderTotals(); store(); }
  });
  box.addEventListener('change', (e) => { if (e.target.dataset.f === 'currency') { renderItems(); renderTotals(); store(); } });
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-del]')) { st.items.splice(Number(e.target.closest('tr').dataset.i), 1); renderItems(); renderTotals(); store(); }
  });
  $('[data-add]').addEventListener('click', () => { st.items.push({ desc: '', qty: 1, rate: '' }); renderItems(); renderTotals(); store(); $$('[data-c="desc"]').pop().focus(); });
  $('[data-new]').addEventListener('click', () => {
    const m = /^(.*?)(\d+)$/.exec(st.number || '');
    const next = m ? `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, '0')}` : 'INV-0001';
    Object.assign(st, { number: next, date: today(), due: plusDays(today(), 30), toName: '', toAddr: '', paid: '', items: [{ desc: '', qty: 1, rate: '' }] });
    fill(); store(); say('New invoice started. Your business details, logo, currency and tax rate are kept.');
  });
  // logo: shrunk to at most 500 px and kept as PNG
  const logoInput = $('[data-logo-input]');
  $('[data-logo]').addEventListener('click', () => logoInput.click());
  logoInput.addEventListener('change', async () => {
    const f = logoInput.files[0]; logoInput.value = '';
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f), k = Math.min(1, 500 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      st.logo = c.toDataURL('image/png'); fill(); store();
    } catch { say('This logo could not be opened. Use a PNG or JPG.', true); }
  });
  $('[data-logo-del]').addEventListener('click', () => { st.logo = ''; fill(); store(); });

  // ---------------------------------------------------------- the PDF --
  // Standard PDF fonts only cover Western European letters; anything else becomes "?".
  const WIN = /[^\n\x20-\x7e\xa0-\xff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g;
  const clean = (s) => String(s || '').replace(/\t/g, ' ').replace(/\r/g, '').replace(WIN, '');
  async function makePdf() {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const doc = await PDFDocument.create();
    doc.setTitle(`Invoice ${clean(st.number)}`); doc.setProducer('Flipit Free invoice generator'); doc.setCreator('flipitfree.com');
    const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const [PW, PH] = st.paper === 'a4' ? [595.28, 841.89] : [612, 792];
    const M = 48, ink = rgb(0.13, 0.15, 0.18), dim = rgb(0.42, 0.45, 0.5), line = rgb(0.86, 0.87, 0.9), brand = rgb(0.9, 0.2, 0.18);
    let page = doc.addPage([PW, PH]), y = PH - M;
    const text = (s, x, yy, { f = font, size = 10, color = ink, right = false } = {}) => {
      const t = clean(s); const w = f.widthOfTextAtSize(t, size);
      page.drawText(t, { x: right ? x - w : x, y: yy, size, font: f, color });
    };
    const wrap = (s, width, f = font, size = 10) => {
      const out = [];
      for (const para of clean(s).split('\n')) {
        let cur = '';
        for (const word of para.split(/\s+/)) {
          const tryS = cur ? `${cur} ${word}` : word;
          if (f.widthOfTextAtSize(tryS, size) <= width || !cur) cur = tryS; else { out.push(cur); cur = word; }
        }
        out.push(cur);
      }
      return out;
    };
    // header: logo, "INVOICE", number and dates
    let logoH = 0;
    if (st.logo) {
      try {
        const png = await doc.embedPng(st.logo);
        const k = Math.min(160 / png.width, 64 / png.height);
        logoH = png.height * k;
        page.drawImage(png, { x: M, y: y - logoH, width: png.width * k, height: logoH });
      } catch { /* a broken logo is left out */ }
    }
    text('INVOICE', PW - M, y - 24, { f: bold, size: 26, color: brand, right: true });
    let ry = y - 46;
    const day = (d) => { const x = new Date(`${d}T12:00:00`); return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
    for (const [k, v] of [['Invoice no.', st.number], ['Date', st.date && day(st.date)], ['Due date', st.due && day(st.due)], ['Terms', st.terms]]) {
      if (!v) continue;
      text(k, PW - M - 120, ry, { color: dim, size: 9 }); text(v, PW - M, ry, { f: bold, size: 9.5, right: true }); ry -= 14;
    }
    y = Math.min(y - Math.max(logoH, 0) - 18, ry - 8);
    // from / bill to
    const colW = (PW - 2 * M - 24) / 2;
    const party = (title, name, addr, x) => {
      let yy = y;
      text(title, x, yy, { f: bold, size: 8.5, color: dim }); yy -= 15;
      if (name) { text(name, x, yy, { f: bold, size: 11 }); yy -= 14; }
      for (const l of wrap(addr, colW, font, 9.5)) { text(l, x, yy, { size: 9.5, color: rgb(0.25, 0.27, 0.3) }); yy -= 12.5; }
      return yy;
    };
    y = Math.min(party('FROM', st.fromName, st.fromAddr, M), party('BILL TO', st.toName, st.toAddr, M + colW + 24)) - 14;
    // items
    const cx = { desc: M + 10, qty: PW - M - 190, rate: PW - M - 100, amt: PW - M - 10 };
    const head = () => {
      page.drawRectangle({ x: M, y: y - 8, width: PW - 2 * M, height: 22, color: rgb(0.13, 0.15, 0.18) });
      const w = rgb(1, 1, 1);
      text('DESCRIPTION', cx.desc, y, { f: bold, size: 8.5, color: w }); text('QTY', cx.qty, y, { f: bold, size: 8.5, color: w, right: true });
      text('RATE', cx.rate, y, { f: bold, size: 8.5, color: w, right: true }); text('AMOUNT', cx.amt, y, { f: bold, size: 8.5, color: w, right: true });
      y -= 26;
    };
    head();
    for (const it of st.items) {
      if (!it.desc && !num(it.rate)) continue;
      const lines = wrap(it.desc || '-', cx.qty - cx.desc - 50, font, 10);
      const need = lines.length * 13 + 10;
      if (y - need < M + 40) { page = doc.addPage([PW, PH]); y = PH - M; head(); }
      lines.forEach((l, i) => text(l, cx.desc, y - i * 13));
      text(String(num(it.qty)), cx.qty, y, { right: true });
      text(money(num(it.rate)), cx.rate, y, { right: true });
      text(money(num(it.qty) * num(it.rate)), cx.amt, y, { f: bold, right: true });
      y -= need - 4;
      page.drawLine({ start: { x: M, y: y + 6 }, end: { x: PW - M, y: y + 6 }, thickness: 0.6, color: line });
      y -= 6;
    }
    // totals
    const t = totals();
    const rows = [['Subtotal', t.sub], t.disc ? [`Discount (${num(st.discount)}%)`, -t.disc] : null, t.tax ? [`Tax (${num(st.tax)}%)`, t.tax] : null,
      t.ship ? ['Shipping', t.ship] : null, ['Total', t.total, 1], t.paid ? ['Amount paid', -t.paid] : null, ['Balance due', t.due, 2]].filter(Boolean);
    if (y - rows.length * 18 - 40 < M) { page = doc.addPage([PW, PH]); y = PH - M; }
    y -= 6;
    const tx = PW - M - 200;
    for (const [k, v, strong] of rows) {
      if (strong === 2) { page.drawRectangle({ x: tx - 10, y: y - 8, width: PW - M - tx + 10, height: 24, color: rgb(0.96, 0.96, 0.97) }); }
      text(k, tx, y, { f: strong ? bold : font, size: strong === 2 ? 11 : 10, color: strong ? ink : dim });
      text(money(v), PW - M - 10, y, { f: strong ? bold : font, size: strong === 2 ? 12 : 10, right: true, color: strong === 2 ? brand : ink });
      y -= strong === 2 ? 26 : 18;
    }
    // notes
    if (st.notes) {
      y -= 10;
      if (y < M + 60) { page = doc.addPage([PW, PH]); y = PH - M; }
      text('NOTES', M, y, { f: bold, size: 8.5, color: dim }); y -= 14;
      for (const l of wrap(st.notes, PW - 2 * M, font, 9.5)) { if (y < M) { page = doc.addPage([PW, PH]); y = PH - M; } text(l, M, y, { size: 9.5 }); y -= 12.5; }
    }
    return doc.save();
  }
  $('[data-pdf]').addEventListener('click', async () => {
    if (!window.PDFLib) { say('Still loading, try again in a moment.', true); return; }
    if (!st.items.some((it) => it.desc || num(it.rate))) { say('Add at least one item first.', true); return; }
    try {
      const bytes = await makePdf();
      save(new Blob([bytes], { type: 'application/pdf' }), `Invoice-${clean(st.number).replace(/[^\w.-]+/g, '-') || 'invoice'}.pdf`);
      say('Invoice PDF downloaded.'); beacon('Invoice');
    } catch (e) { say(`The PDF could not be made: ${e.message}`, true); }
  });
  fill();
}

({ passport, ocr, invoice }[box && box.dataset.app] || (() => {}))();
