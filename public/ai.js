// PDF intelligence tools (content/apps.js, engines/ai.js): the AI PDF summarizer with chat,
// Translate PDF and PDF to Markdown. One module; the tool box says which one it is (data-app).
const box = document.getElementById('app');
const $ = (sel, root = box) => root.querySelector(sel);
const $$ = (sel, root = box) => [...root.querySelectorAll(sel)];
const fmtSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const say = (text, bad) => { const m = $('[data-msg]'); if (m) { m.textContent = text || ''; m.classList.toggle('bad', !!bad); } };
const beacon = (what) => window.dispatchEvent(new CustomEvent('pt:done', { detail: what }));
const VENDOR = '/vendor/';
const remember = (k, v) => { try { if (v === undefined) return localStorage.getItem(`ai:${k}`); localStorage.setItem(`ai:${k}`, v); } catch { /* storage off */ } return null; };
const isPdf = (f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);

// A drop zone with a hidden file input; calls onFile(file) for a PDF within the size limit.
function dropZone(onFile) {
  const drop = $('[data-drop]'), input = $('[data-input]');
  const maxMb = Number(box.dataset.maxMb || 40);
  const take = (f) => {
    if (!f) return;
    if (!isPdf(f)) { say('Please choose a PDF file.', true); return; }
    if (f.size > maxMb * 1024 * 1024) { say(`This file is ${fmtSize(f.size)}; the limit is ${maxMb} MB.`, true); return; }
    onFile(f);
  };
  $('[data-pick]').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { take(input.files[0]); input.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); take(e.dataTransfer.files[0]); });
}

// OCR switch: shows the OCR language when it is on; adds ocr and lang to a form.
function ocrOptions() {
  const cb = $('[data-ocr]'), wrap = $('[data-ocr-lang-wrap]');
  if (cb) cb.addEventListener('change', () => { wrap.hidden = !cb.checked; });
  return (form) => { if (cb && cb.checked) { form.append('ocr', '1'); form.append('lang', $('[data-ocr-lang]').value); } };
}

// POST a form with upload progress; resolves with the XHR once it has loaded.
function send(url, form, { onUpload, type = 'json' } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url); xhr.responseType = type;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onUpload) onUpload(e.loaded / e.total); };
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(new Error('The connection was lost. Check your internet and try again.'));
    xhr.send(form);
  });
}
async function errorOf(xhr, fallback) {
  try {
    const body = xhr.responseType === 'blob' ? JSON.parse(await xhr.response.text()) : xhr.response;
    return (body && body.error) || fallback;
  } catch { return fallback; }
}

// ------------------------------------------------------------------- Markdown --
// A small, safe Markdown renderer for the AI's answers and the PDF to Markdown preview: text is
// escaped first, and only http(s) and mailto links are made. "(p. 3)" becomes a button that shows
// page 3 of the PDF.
const escHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function inline(text) {
  const codes = [];
  let s = escHtml(text).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\\([\\`*_[\]<>|#])/g, (m, c) => `&#${c.charCodeAt(0)};`)
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/\((?:p|pp|page|pages)\.?\s*(\d{1,4})(?:\s*[-–,]\s*\d{1,4})*\)/gi, (m, n) => `<button type="button" class="ai-pref" data-page="${n}" title="Show page ${n}">${m.slice(1, -1)}</button>`);
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codes[Number(i)]}</code>`);
}
function markdown(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      const code = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i]);
      out.push(`<pre><code>${escHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^<!--.*-->$/.test(line.trim())) { flush(); const m = /Page (\d+)/.exec(line); if (m) out.push(`<p class="md-page">Page ${m[1]}</p>`); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); const n = Math.min(6, h[1].length + 1); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/<br>/g, ' ')));
      const head = cells(line);
      const rows = [];
      i += 1;
      while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1])) rows.push(cells(lines[++i]));
      out.push(`<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*([-*+]|\d{1,3}[.)])\s+/.test(line)) {
      flush();
      // a list, nested by indentation
      const stack = [];
      let j = i;
      for (; j < lines.length; j++) {
        const m = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/.exec(lines[j]);
        if (!m) {
          if (lines[j].trim() && stack.length && /^\s{2,}\S/.test(lines[j])) { out.push(` ${inline(lines[j].trim())}`); continue; }
          break;
        }
        const depth = m[1].replace(/\t/g, '    ').length;
        const tag = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (stack.length && depth < stack[stack.length - 1].depth) { out.push(`</li></${stack.pop().tag}>`); }
        if (!stack.length || depth > stack[stack.length - 1].depth) {
          stack.push({ depth, tag });
          out.push(`<${tag}${tag === 'ol' && /^\d+/.test(m[2]) && parseInt(m[2], 10) !== 1 ? ` start="${parseInt(m[2], 10)}"` : ''}><li>${inline(m[3])}`);
        } else {
          out.push(`</li><li>${inline(m[3])}`);
        }
      }
      while (stack.length) out.push(`</li></${stack.pop().tag}>`);
      i = j - 1;
      continue;
    }
    if (/^>\s?/.test(line)) { flush(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim());
  }
  flush();
  return out.join('');
}

// Reads a server-sent event stream from a POST; onText(piece) for each text piece.
async function stream(url, body, onText, signal) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok || !/event-stream/.test(res.headers.get('Content-Type') || '')) {
    let msg = 'Something went wrong. Please try again.';
    try { msg = (await res.json()).error || msg; } catch { /* not JSON */ }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', done = false;
  while (!done) {
    const r = await reader.read();
    if (r.done) break;
    buf += dec.decode(r.value, { stream: true });
    let k;
    while ((k = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, k); buf = buf.slice(k + 2);
      const ev = (/^event: (.*)$/m.exec(raw) || [])[1];
      const data = (/^data: (.*)$/m.exec(raw) || [])[1];
      if (!ev || !data) continue;
      const d = JSON.parse(data);
      if (ev === 'text') onText(d.t);
      else if (ev === 'error') throw new Error(d.error);
      else if (ev === 'done') done = true;
    }
  }
  if (!done) throw new Error('The answer was cut off. Please try again.');
}

// ------------------------------------------------------------ PDF preview --
let pdfjs = null;
async function pdfLib() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(`${VENDOR}pdfjs/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${VENDOR}pdfjs/pdf.worker.min.mjs`;
  return pdfjs;
}
// Every page of the PDF, drawn when it scrolls into view.
async function preview(file, holder) {
  holder.innerHTML = '';
  const lib = await pdfLib();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: `${VENDOR}pdfjs/cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${VENDOR}pdfjs/standard_fonts/`, wasmUrl: `${VENDOR}pdfjs/wasm/`, iccUrl: `${VENDOR}pdfjs/iccs/` }).promise;
  const first = await doc.getPage(1);
  const v1 = first.getViewport({ scale: 1 });
  const io = new IntersectionObserver((entries) => entries.forEach(async (e) => {
    if (!e.isIntersecting || e.target.dataset.drawn) return;
    e.target.dataset.drawn = '1';
    io.unobserve(e.target);
    const page = await doc.getPage(Number(e.target.dataset.n));
    const width = Math.max(200, e.target.clientWidth);
    const vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: (width / vp0.width) * Math.min(2, window.devicePixelRatio || 1) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    canvas.setAttribute('aria-label', `Page ${e.target.dataset.n}`);
    await page.render({ canvas, viewport: vp }).promise;
    e.target.querySelector('.ai-page-sheet').append(canvas);
  }), { root: holder, rootMargin: '400px 0px' });
  for (let n = 1; n <= doc.numPages; n++) {
    const el = document.createElement('div');
    el.className = 'ai-page'; el.dataset.n = n; el.id = `ai-page-${n}`;
    el.innerHTML = `<div class="ai-page-sheet" style="aspect-ratio:${v1.width} / ${v1.height}"></div><span class="ai-page-n">${n}</span>`;
    holder.append(el);
    io.observe(el);
  }
  return doc.numPages;
}

// --------------------------------------------------------- AI summarizer --
function summarizer() {
  let file = null, docId = null, busy = false, ctl = null;
  let history = []; // [{role, text}] the summary first, then the chat
  const show = (part) => { for (const k of ['drop', 'work', 'pane']) $(`[data-${k}]`).hidden = k !== part; box.classList.toggle('is-open', part === 'pane'); };
  const addOcr = ocrOptions();
  const sumLang = $('[data-sum-lang]');
  if (remember('sumLang')) sumLang.value = remember('sumLang');
  sumLang.addEventListener('change', () => remember('sumLang', sumLang.value));
  const q = $('[data-q]'), sendBtn = $('[data-send]'), scroll = $('[data-scroll]');
  const atBottom = () => scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
  const toBottom = () => { scroll.scrollTop = scroll.scrollHeight; };
  const ready = (on) => { busy = !on; q.disabled = !on; sendBtn.disabled = !on || !q.value.trim(); };

  dropZone((f) => {
    file = f;
    $('[data-fname]').textContent = f.name; $('[data-fmeta]').textContent = fmtSize(f.size);
    show('work'); say('');
  });
  $$('[data-again]').forEach((b) => b.addEventListener('click', () => {
    if (ctl) ctl.abort();
    file = null; docId = null; history = [];
    show('drop'); say('');
  }));

  // live rendering of a streamed answer: at most once a frame
  const painter = (el, split) => {
    let text = '', queued = false;
    return {
      add(t) {
        text += t;
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          const follow = atBottom();
          el.innerHTML = markdown(split ? text.split(/\n?\s*<questions>/i)[0] : text);
          if (follow) toBottom();
        });
      },
      get text() { return text; },
    };
  };

  $('[data-go]').addEventListener('click', async () => {
    if (!file || busy) return;
    const form = new FormData();
    form.append('file', file);
    addOcr(form);
    const go = $('[data-go]'); go.disabled = true;
    say('Uploading...');
    let xhr;
    try {
      xhr = await send('/api/ai/open', form, { onUpload: (p) => say(p < 1 ? `Uploading... ${Math.round(p * 100)}%` : 'Reading your PDF...') });
    } catch (e) { go.disabled = false; say(e.message, true); return; }
    go.disabled = false;
    if (xhr.status !== 200) { say(await errorOf(xhr, 'This PDF could not be read.'), true); return; }
    const info = xhr.response;
    docId = info.id; history = [];
    $('[data-doc-name]').textContent = file.name;
    $('[data-doc-meta]').textContent = `${info.pages} page${info.pages > 1 ? 's' : ''}`;
    const summary = $('[data-summary]');
    summary.innerHTML = `<p class="ai-thinking"><span></span><span></span><span></span> Reading and summarizing...</p>${(info.notes || []).map((n) => `<p class="ai-note">${escHtml(n)}</p>`).join('')}`;
    $('[data-suggest]').hidden = true; $('[data-chat]').innerHTML = ''; $('[data-copy-sum]').hidden = true;
    show('pane'); say('');
    ready(false);
    preview(file, $('[data-pages]')).catch(() => { $('[data-pages]').innerHTML = '<p class="ai-note">The preview could not be shown, but the summary still works.</p>'; });
    const notes = (info.notes || []).map((n) => `<p class="ai-note">${escHtml(n)}</p>`).join('');
    const p = painter(summary, true);
    let first = true;
    ctl = new AbortController();
    try {
      await stream('/api/ai/summary', { id: docId, lang: sumLang.value }, (t) => { if (first) { summary.innerHTML = ''; first = false; } p.add(t); }, ctl.signal);
      const [text, qs = ''] = p.text.split(/\n?\s*<questions>/i);
      summary.innerHTML = markdown(text) + notes;
      history = [{ role: 'user', text: 'Summarize this document.' }, { role: 'assistant', text: text.trim() }];
      const list = qs.split('\n').map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 3);
      $('[data-suggest-list]').innerHTML = list.map((s) => `<button type="button" class="ai-chip">${escHtml(s)}</button>`).join('');
      $('[data-suggest]').hidden = !list.length;
      $('[data-copy-sum]').hidden = false;
      beacon('AI summary');
    } catch (e) {
      if (e.name === 'AbortError') return;
      summary.innerHTML = `<p class="ai-error">${escHtml(e.message)}</p>${notes}`;
    } finally {
      ctl = null;
      ready(!!docId);
    }
  });

  async function ask(question) {
    if (!docId || busy || !question.trim()) return;
    const chat = $('[data-chat]');
    const me = document.createElement('div'); me.className = 'ai-msg ai-me'; me.textContent = question.trim();
    const bot = document.createElement('div'); bot.className = 'ai-msg ai-bot ai-md';
    bot.innerHTML = '<p class="ai-thinking"><span></span><span></span><span></span></p>';
    chat.append(me, bot); toBottom();
    q.value = ''; q.style.height = '';
    history.push({ role: 'user', text: question.trim() });
    ready(false);
    const p = painter(bot, false);
    let first = true;
    ctl = new AbortController();
    try {
      await stream('/api/ai/chat', { id: docId, messages: history }, (t) => { if (first) { bot.innerHTML = ''; first = false; } p.add(t); }, ctl.signal);
      bot.innerHTML = markdown(p.text);
      history.push({ role: 'assistant', text: p.text });
      beacon('AI chat');
    } catch (e) {
      if (e.name === 'AbortError') return;
      history.pop();
      bot.classList.add('ai-error'); bot.textContent = e.message;
    } finally {
      ctl = null;
      ready(!!docId);
      q.focus();
    }
  }
  $('[data-suggest-list]').addEventListener('click', (e) => { const b = e.target.closest('.ai-chip'); if (b) ask(b.textContent); });
  $('[data-ask]').addEventListener('submit', (e) => { e.preventDefault(); ask(q.value); });
  q.addEventListener('input', () => { sendBtn.disabled = busy || !q.value.trim(); q.style.height = ''; q.style.height = `${Math.min(140, q.scrollHeight)}px`; });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(q.value); } });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.ai-pref');
    if (!b) return;
    const el = document.getElementById(`ai-page-${b.dataset.page}`);
    if (!el) return;
    const holder = $('[data-pages]');
    holder.scrollTo({ top: el.offsetTop - holder.offsetTop - 8, behavior: 'smooth' });
    if (window.matchMedia('(max-width: 860px)').matches) holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
  });
  $('[data-copy-sum]').addEventListener('click', async () => {
    const t = history[1] ? history[1].text : '';
    try { await navigator.clipboard.writeText(t); } catch { return; }
    const b = $('[data-copy-sum]'); b.textContent = 'Copied!'; setTimeout(() => { b.textContent = 'Copy summary'; }, 1500);
  });
}

// --------------------------------------------------------- Translate PDF --
function translate() {
  let file = null, timer = null;
  const show = (part) => { for (const k of ['drop', 'work', 'done']) $(`[data-${k}]`).hidden = k !== part; };
  const addOcr = ocrOptions();
  const to = $('[data-to]');
  const saved = remember('to');
  if (saved && [...to.options].some((o) => o.value === saved)) to.value = saved;
  else {
    // the visitor's own language, or English
    const nav = (navigator.language || 'en').toLowerCase();
    const hit = [...to.options].find((o) => o.value === nav) || [...to.options].find((o) => o.value === nav.split('-')[0]);
    to.value = hit && hit.value !== 'en' ? hit.value : 'en';
  }
  to.addEventListener('change', () => remember('to', to.value));
  const progress = (text) => { $('[data-progress]').hidden = !text; if (text) $('[data-progress-text]').textContent = text; };
  dropZone((f) => {
    file = f;
    $('[data-fname]').textContent = f.name; $('[data-fmeta]').textContent = fmtSize(f.size);
    show('work'); say(''); progress('');
  });
  $$('[data-again]').forEach((b) => b.addEventListener('click', () => { clearTimeout(timer); file = null; show('drop'); say(''); progress(''); }));
  $('[data-go]').addEventListener('click', async () => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file); form.append('to', to.value);
    addOcr(form);
    const go = $('[data-go]'); go.disabled = true;
    say('');
    progress('Uploading...');
    let xhr;
    try {
      xhr = await send('/api/ai/translate', form, { onUpload: (p) => progress(p < 1 ? `Uploading... ${Math.round(p * 100)}%` : 'Reading the PDF...') });
    } catch (e) { go.disabled = false; progress(''); say(e.message, true); return; }
    if (xhr.status !== 200) { go.disabled = false; progress(''); say(await errorOf(xhr, 'This PDF could not be translated.'), true); return; }
    const { id } = xhr.response;
    const lang = to.selectedOptions[0].textContent;
    const started = Date.now();
    const poll = async () => {
      let j;
      try { j = await (await fetch(`/api/jobs/${id}`, { cache: 'no-store' })).json(); } catch { timer = setTimeout(poll, 4000); return; }
      if (j.status === 'done') {
        go.disabled = false; progress('');
        const a = $('[data-dl]'); a.href = `/api/jobs/${id}/file`; a.download = j.name || 'translated.pdf';
        $('[data-done-text]').textContent = `Translated into ${lang}, with the original layout, pictures and colours.${j.note ? ` ${j.note}` : ''}`;
        show('done'); beacon('Translate PDF');
        a.click();
        return;
      }
      if (j.status === 'error' || j.error) { go.disabled = false; progress(''); say(j.error || 'This PDF could not be translated.', true); return; }
      const s = Math.round((Date.now() - started) / 1000);
      progress(`Translating into ${lang}... ${s < 8 ? '' : `${s} s - long documents take a minute or two.`}`);
      timer = setTimeout(poll, 2000);
    };
    poll();
  });
}

// ------------------------------------------------------- PDF to Markdown --
function toMarkdown() {
  let file = null, url = null;
  const show = (part) => { for (const k of ['drop', 'work', 'out']) $(`[data-${k}]`).hidden = k !== part; };
  const addOcr = ocrOptions();
  dropZone((f) => {
    file = f;
    $('[data-fname]').textContent = f.name; $('[data-fmeta]').textContent = fmtSize(f.size);
    show('work'); say('');
  });
  $$('[data-again]').forEach((b) => b.addEventListener('click', () => { file = null; show('drop'); say(''); }));
  const tab = (name) => {
    $$('[data-tab]').forEach((b) => { const on = b.dataset.tab === name; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    $('[data-text]').hidden = name !== 'md';
    $('[data-preview]').hidden = name !== 'preview';
    if (name === 'preview') $('[data-preview]').innerHTML = markdown($('[data-text]').value);
  };
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => tab(b.dataset.tab)));
  $('[data-go]').addEventListener('click', async () => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    addOcr(form);
    const go = $('[data-go]'); go.disabled = true;
    say('Uploading...');
    let xhr;
    try {
      xhr = await send('/api/pdf-markdown', form, { type: 'blob', onUpload: (p) => say(p < 1 ? `Uploading... ${Math.round(p * 100)}%` : 'Converting... this takes a few seconds per page.') });
    } catch (e) { go.disabled = false; say(e.message, true); return; }
    go.disabled = false;
    if (xhr.status !== 200) { say(await errorOf(xhr, 'This PDF could not be converted to Markdown.'), true); return; }
    const text = await xhr.response.text();
    const pages = Number(xhr.getResponseHeader('X-Pages') || 1);
    let notes = [];
    try { notes = JSON.parse(decodeURIComponent(xhr.getResponseHeader('X-Convert-Notes') || '%5B%5D')); } catch { /* none */ }
    $('[data-text]').value = text;
    $('[data-out-title]').textContent = `Markdown from ${pages} page${pages > 1 ? 's' : ''}`;
    const n = $('[data-notes]'); n.hidden = !notes.length; n.textContent = notes.join(' ');
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = $('[data-dl]'); a.href = url; a.download = `${file.name.replace(/\.[^.]+$/, '') || 'document'}.md`;
    tab('md'); show('out'); say('');
    beacon('PDF to Markdown');
  });
  $('[data-copy]').addEventListener('click', async () => {
    const t = $('[data-text]');
    try { await navigator.clipboard.writeText(t.value); } catch { t.hidden = false; t.select(); document.execCommand('copy'); }
    $('[data-copy]').textContent = 'Copied!'; setTimeout(() => { $('[data-copy]').textContent = 'Copy Markdown'; }, 1500);
  });
}

if (box) {
  if (box.dataset.off) $$('[data-go]').forEach((b) => { b.disabled = true; });
  ({ aisum: summarizer, translate, markdown: toMarkdown }[box.dataset.app] || (() => {}))();
}

export { markdown };
