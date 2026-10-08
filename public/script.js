(function(){
  "use strict";

  // Ad slots: present only when ADSENSE_CLIENT and slot IDs are set on the server.
  document.querySelectorAll("ins.adsbygoogle").forEach(() => { (window.adsbygoogle = window.adsbygoogle || []).push({}); });

  // Every dropdown (header menus and format pickers) is a <details data-menu>.
  // Only one stays open at a time; clicking outside or pressing Escape closes it.
  const openMenus = () => document.querySelectorAll("details[data-menu][open]");
  document.addEventListener("click", e => {
    openMenus().forEach(d => { if (!d.contains(e.target)) d.removeAttribute("open"); });
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") openMenus().forEach(d => d.removeAttribute("open"));
  });
  document.querySelectorAll("details[data-menu]").forEach(d => d.addEventListener("toggle", () => {
    if (d.open) openMenus().forEach(o => { if (o !== d && !o.contains(d)) o.removeAttribute("open"); });
  }));

  // Format picker: category switching + search inside every .fmt-panel
  function wirePanel(panel){
    const q = panel.querySelector(".fmt-q");
    const cats = () => panel.querySelectorAll(".fmt-cat");
    const grids = () => panel.querySelectorAll(".fmt-grid");
    function select(i){
      cats().forEach(c => c.classList.toggle("is-active", c.dataset.cat === i));
      grids().forEach(g => g.classList.toggle("is-active", g.dataset.cat === i));
    }
    function filter(){
      const term = q.value.trim().toLowerCase().replace(/^\./, "");
      let shown = 0;
      panel.querySelectorAll(".fmt-btn").forEach(b => { const ok = !term || b.dataset.name.includes(term); b.hidden = !ok; if (ok) shown++; });
      panel.classList.toggle("searching", !!term);
      panel.classList.toggle("no-match", !!term && shown === 0);
    }
    panel.addEventListener("click", e => {
      const c = e.target.closest(".fmt-cat");
      if (c){ select(c.dataset.cat); q.value = ""; filter(); }
    });
    panel.addEventListener("mouseover", e => {
      const c = e.target.closest(".fmt-cat");
      if (c && !q.value) select(c.dataset.cat);
    });
    q.addEventListener("input", filter);
    // Enter in the search box opens the first visible match.
    q.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      const first = Array.from(panel.querySelectorAll(".fmt-btn")).find(b => !b.hidden && b.offsetParent !== null);
      if (first){ e.preventDefault(); first.click(); }
    });
    const details = panel.closest("details");
    details.addEventListener("toggle", () => {
      if (details.open){ if (window.matchMedia("(min-width: 641px)").matches) setTimeout(() => q.focus(), 0); }
      else { q.value = ""; filter(); }
    });
    panel.__filter = filter;
  }
  document.querySelectorAll(".fmt-panel").forEach(wirePanel);

  // Menus that load their contents on demand (the Tools menu on most pages): fetched on first
  // hover, focus or open, then wired exactly like a menu that was in the page from the start.
  document.querySelectorAll("details[data-lazy]").forEach(d => {
    let loading = null;
    const load = () => loading || (loading = fetch(d.dataset.lazy).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(html => {
      const tpl = document.createElement("template");
      tpl.innerHTML = html.trim();
      const panel = tpl.content.firstElementChild;
      const wait = d.querySelector(".mega-wait");
      if (wait) wait.replaceWith(panel); else d.append(panel);
      wirePanel(panel);
      if (d.open && window.matchMedia("(min-width: 641px)").matches) { const q = panel.querySelector(".fmt-q"); if (q) q.focus(); }
    }).catch(() => { loading = null; }));
    const sum = d.querySelector("summary");
    sum.addEventListener("pointerenter", load);
    sum.addEventListener("focus", load);
    d.addEventListener("toggle", () => { if (d.open) load(); });
  });

  // Conversion map (home, category and format pages): formats, pairs, which pairs are live,
  // file extension -> format, and the pairs the hero animation cycles through.
  let MAP = null;
  const mapEl = document.getElementById("convMap");
  if (mapEl){ try { MAP = JSON.parse(mapEl.textContent); } catch (e) { MAP = null; } }
  const LIVE = new Set(MAP ? MAP.live : []);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const primaryCat = id => (MAP && MAP.fmts[id] ? MAP.fmts[id][1][0] : "none");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Show a format (icon + label) in a picker chip.
  function setChip(chip, id){
    const ico = chip.querySelector(".fsvg");
    if (ico){
      const cat = id ? primaryCat(id) : "none";
      ico.setAttribute("class", "fsvg fi-" + cat);
      ico.querySelector("use").setAttribute("href", "#fi-" + cat);
    }
    chip.querySelector(".chip-label").textContent = id ? MAP.fmts[id][0] : "...";
    chip.classList.toggle("chip-empty", !id);
  }

  // "convert [X] to [Y]": choosing the input fills the output picker in place (CloudConvert-style).
  // Without JS the input buttons are plain links to the format page, which renders the same picker.
  const fromMenu = document.querySelector('details[data-role="from"]');
  const toMenu = document.querySelector('details[data-role="to"]');
  // Format pages (/png-converter) arrive with the input already chosen.
  const curFrom = fromMenu && fromMenu.querySelector(".fmt-btn[data-fmt][aria-current]");
  let chosenFrom = curFrom ? curFrom.dataset.fmt : null;
  let chosenTo = null; // set by the output picker on pages with the upload tool
  const routeOf = (f, t) => "/" + f + "-to-" + t;
  if (MAP && fromMenu && toMenu){
    function fillTo(from){
      const outs = (MAP.pairs[from] || "").split(" ").filter(Boolean);
      const groups = MAP.cats.map(([id, name]) => [name, outs.filter(o => MAP.fmts[o][1].includes(id))]).filter(g => g[1].length);
      // Open on the first tab that has a working conversion (e.g. Image for PNG), not just the first tab.
      let act = groups.findIndex(g => g[1].some(o => LIVE.has(from + ">" + o)));
      if (act < 0) act = 0;
      const panel = toMenu.querySelector(".fmt-panel");
      panel.querySelector(".fmt-cats").innerHTML = groups.map(([name], i) =>
        '<li><button type="button" class="fmt-cat' + (i === act ? ' is-active' : '') + '" data-cat="' + i + '">' + esc(name) + '<span class="fmt-arrow" aria-hidden="true">&rsaquo;</span></button></li>').join("");
      panel.querySelector(".fmt-grids").innerHTML = groups.map(([name, list], i) =>
        '<div class="fmt-grid' + (i === act ? ' is-active' : '') + '" data-cat="' + i + '" aria-label="' + esc(name) + '">' + list.map(o => {
          const ok = LIVE.has(from + ">" + o);
          const f = MAP.fmts[o];
          return '<a class="fmt-btn' + (ok ? ' is-live' : '') + '" href="' + routeOf(from, o) + '" data-name="' + esc((f[0] + " " + f[2]).toLowerCase()) + '"' + (ok ? '' : ' title="Coming soon"') + '>'
            + '<svg class="fsvg fi-' + primaryCat(o) + '" aria-hidden="true"><use href="#fi-' + primaryCat(o) + '"/></svg>' + esc(f[0]) + '</a>';
        }).join("") + '</div>').join("") + '<p class="fmt-none">No format found</p>' + (groups.length ? '' : '<p class="fmt-hint">No conversions for this format yet.</p>');
      setChip(toMenu.querySelector(".chip"), null);
    }
    fromMenu.addEventListener("click", e => {
      const b = e.target.closest(".fmt-btn[data-fmt]");
      if (!b || !MAP.pairs[b.dataset.fmt]) return;
      e.preventDefault();
      stopRotator();
      fromMenu.querySelectorAll(".fmt-btn[aria-current]").forEach(x => x.removeAttribute("aria-current"));
      b.setAttribute("aria-current", "true");
      chosenFrom = b.dataset.fmt;
      chosenTo = null;
      setChip(fromMenu.querySelector(".chip"), chosenFrom);
      fromMenu.removeAttribute("open");
      fillTo(chosenFrom);
      // Open after this click has finished bubbling, or the outside-click handler closes it again.
      setTimeout(() => toMenu.setAttribute("open", ""), 0);
    });
  }

  // Hero animation: while nothing is chosen, the empty chips cycle through popular
  // conversions ("PNG to JPG", "MP4 to MP3", ...) with a short slide. It stops for good as
  // soon as the visitor touches the pickers, and never runs with reduced motion.
  let rotTimer = null;
  function stopRotator(){
    if (rotTimer){ clearInterval(rotTimer); rotTimer = null; }
    [fromMenu, toMenu].forEach(m => { if (m && !chosenFrom) { const c = m.querySelector(".chip"); c.classList.remove("is-rotating", "swap-out", "swap-in"); setChip(c, null); } });
  }
  if (MAP && fromMenu && toMenu && fromMenu.querySelector(".chip-empty") && !reduceMotion){
    const pairs = (MAP.rotate || []).filter(([f, t]) => MAP.fmts[f] && MAP.fmts[t] && LIVE.has(f + ">" + t));
    if (pairs.length > 1){
      const chips = [fromMenu.querySelector(".chip"), toMenu.querySelector(".chip")];
      let i = 0;
      const show = () => {
        const [f, t] = pairs[i % pairs.length]; i++;
        chips.forEach((c, k) => {
          c.classList.add("swap-out");
          setTimeout(() => {
            if (!rotTimer) return; // stopped while this swap was pending
            setChip(c, k ? t : f); c.classList.add("is-rotating");
            c.classList.remove("swap-out"); c.classList.add("swap-in");
            requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove("swap-in")));
          }, 280 + k * 90);
        });
      };
      show();
      rotTimer = setInterval(show, 2600);
      [fromMenu, toMenu].forEach(m => {
        m.addEventListener("toggle", () => { if (m.open) stopRotator(); });
        m.addEventListener("pointerdown", stopRotator, { once: true });
      });
      document.addEventListener("visibilitychange", () => { if (document.hidden) stopRotator(); }, { once: true });
    }
  }

  const dropzone = document.getElementById("dropzone");
  if (!dropzone) return; // hub / 404 pages have no upload tool

  // ---------------------------------------------------------------- upload tool --
  // CloudConvert-style flow:
  //   1. files are added -> one card each: icon, name, "71 KB · JPEG Image",
  //      "Convert [JPEG] -> [PNG v]", Options (images), remove
  //   2. Convert -> cards show WAITING / UPLOADING 40% / CONVERTING
  //   3. done -> FINISHED + output name + size + Download; "Download all" zips every result
  const tool = document.getElementById("convert");
  const anyMode = tool.dataset.any === "1"; // home/category pages: any file type
  const compressMode = tool.dataset.mode === "compress"; // compress pages: same format in and out
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const toolBar = document.getElementById("toolBar");
  const barStatus = document.getElementById("barStatus");
  const addMoreBtn = document.getElementById("addMoreBtn");
  const convertAllBtn = document.getElementById("convertAllBtn");
  const zipBtn = document.getElementById("zipBtn");
  const CONCURRENCY = 3; // the server queues further work itself

  let CATS = {}, OUTS = [];
  try { CATS = JSON.parse(tool.dataset.cats || "{}"); } catch (e) { CATS = {}; }
  try { OUTS = JSON.parse(tool.dataset.outputs || "[]"); } catch (e) { OUTS = []; }
  const KIND = { image: "Image", video: "Video", audio: "Audio", document: "Document", pdf: "Document", spreadsheet: "Spreadsheet",
    presentation: "Presentation", ebook: "Ebook", archive: "Archive", font: "Font", vector: "Vector Image", cad: "Drawing" };
  const catOfExt = ext => CATS[ext] || (MAP && MAP.ext[ext] ? primaryCat(MAP.ext[ext]) : "none");
  const exts = (dropzone.dataset.exts || "").split(",").filter(Boolean);
  const isImageTarget = id => id === "svg" || (MAP && MAP.fmts[id] ? primaryCat(id) === "image" : (OUTS.find(o => o[0] === id) || [])[3] === "image");

  // Which format is this file? Longest matching extension wins ("backup.tar.gz" -> tar-gz).
  function formatOf(name){
    const parts = String(name).toLowerCase().split(".");
    for (let k = 1; k < parts.length; k++){
      const ext = parts.slice(k).join(".");
      if (exts.includes(ext)) return { ext, id: MAP && MAP.ext[ext] ? MAP.ext[ext] : ext };
    }
    return null;
  }

  // Targets for a file: [id, label, apiFormat, category]
  function targetsFor(fromId){
    if (anyMode && MAP){
      return (MAP.pairs[fromId] || "").split(" ").filter(o => o && LIVE.has(fromId + ">" + o))
        .map(o => [o, MAP.fmts[o][0], MAP.fmts[o][3] || o, primaryCat(o)]);
    }
    return OUTS;
  }
  const defFmt = document.body.dataset.defaultFormat; // apiFormat of this page's target, e.g. "png"
  // What most people want from each kind of file, when the page doesn't say (home/category pages).
  const PREFERRED = { image: ["png", "jpg"], video: ["mp4", "mp3"], audio: ["mp3", "wav"], document: ["pdf", "docx"], pdf: ["docx", "jpg"],
    spreadsheet: ["xlsx", "pdf"], presentation: ["pdf", "pptx"], ebook: ["epub", "pdf"], archive: ["zip", "7z"], font: ["woff2", "woff"], vector: ["png", "svg", "pdf"] };

  const fsvgHtml = (cat, cls) => `<svg class="fsvg fi-${esc(cat)}${cls ? " " + cls : ""}" aria-hidden="true"><use href="#fi-${esc(cat)}"/></svg>`;
  function fmtBytes(n){
    if (n < 1024) return n + " B";
    if (n < 1024*1024) return Math.round(n/1024) + " KB";
    return (n/(1024*1024)).toFixed(1) + " MB";
  }

  // Files over the per-file limit are refused here, before a long upload the server would reject.
  const MAX_MB = Number(dropzone.dataset.maxMb) || 0;
  const MAX_BYTES = MAX_MB * 1024 * 1024;
  const tooBig = size => `This file is ${fmtBytes(size)}. The limit is ${MAX_MB} MB per file.`;

  const rows = [];
  let seq = 0;

  function addFiles(files){
    files.forEach(file => {
      const fmt = formatOf(file.name);
      const row = { id: ++seq, file, name: file.name, size: file.size, fmt, state: "ready", quality: 75, maxDim: 0, optionsOpen: false };
      if (!fmt){ row.state = "error"; row.error = "This file type isn't supported here."; }
      else if (MAX_BYTES && file.size > MAX_BYTES){ row.state = "error"; row.error = tooBig(file.size); }
      else {
        row.targets = targetsFor(fmt.id);
        if (!row.targets.length){ row.state = "error"; row.error = "This file type can't be converted yet."; }
        else {
          const pref = (PREFERRED[catOfExt(fmt.ext)] || []).map(id => row.targets.find(t => t[0] === id && id !== fmt.id)).find(Boolean);
          const pick = (chosenTo && row.targets.find(t => t[0] === chosenTo)) || row.targets.find(t => t[2] === defFmt) || pref || row.targets.find(t => t[0] !== fmt.id) || row.targets[0];
          row.target = pick[0];
        }
      }
      rows.push(row);
    });
    render();
  }

  ["dragenter","dragover"].forEach(ev => tool.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("drag"); }));
  ["dragleave","drop"].forEach(ev => tool.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("drag"); }));
  tool.addEventListener("drop", e => addFiles(Array.from(e.dataTransfer.files)));
  const selectBtn = document.getElementById("selectBtn");
  if (selectBtn) selectBtn.addEventListener("click", () => fileInput.click());
  addMoreBtn.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", e => { if (e.key==="Enter" || e.key===" ") { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) addFiles(Array.from(fileInput.files));
    fileInput.value = "";
  });

  // Choosing the output in the banner picker stays on this page (no reload, no jump): the chip
  // shows the choice, the URL and heading become "X to Y", and files added now (and cards not
  // converted yet) default to that output. Pairs that aren't live still open their own page.
  const pageFrom = (location.pathname.match(/^\/(.+?)-to-/) || [])[1] || null;
  if (toMenu){
    toMenu.addEventListener("click", e => {
      const b = e.target.closest("a.fmt-btn");
      const m = b && /(?:^\/|#)([a-z0-9-]+?)-to-([a-z0-9-]+)$/.exec(b.getAttribute("href") || "");
      if (!m) return;
      const [, from, to] = m;
      const usable = anyMode ? from === chosenFrom && LIVE.has(from + ">" + to)
        : from === (pageFrom || chosenFrom) && OUTS.some(o => o[0] === to);
      if (!usable) return;
      e.preventDefault();
      chosenTo = to;
      toMenu.querySelectorAll(".fmt-btn[aria-current]").forEach(x => x.removeAttribute("aria-current"));
      b.setAttribute("aria-current", "true");
      const label = MAP && MAP.fmts[to] ? MAP.fmts[to][0] : b.textContent.trim();
      if (MAP && MAP.fmts[to]) setChip(toMenu.querySelector(".chip"), to);
      else toMenu.querySelector(".chip-label").textContent = label;
      toMenu.removeAttribute("open");
      const fromLabel = MAP && MAP.fmts[from] ? MAP.fmts[from][0] : from.toUpperCase();
      const h1 = document.querySelector(".hero h1");
      if (h1) h1.textContent = fromLabel + " to " + label + " Converter";
      document.title = document.title.replace(/^[^|]*/, fromLabel + " to " + label + " Converter - Free Online ");
      if (!window.__route) try { history.replaceState(null, "", "/" + from + "-to-" + to); } catch (err) { /* sandboxed page */ }
      rows.forEach(r => { if (r.state === "ready" && r.targets && r.targets.some(t => t[0] === to)) r.target = to; });
      render();
      if (selectBtn) selectBtn.focus({ preventScroll: true });
    });
  }

  // "Convert now" (header) on a page that has the upload tool: glide to it instead of jumping,
  // centring it when it fits so the drop area is fully in view below the sticky header.
  document.querySelectorAll('a[href="/#convert"], a[href="#convert"]').forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    const fits = tool.offsetHeight < window.innerHeight - 140;
    tool.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: fits ? "center" : "start" });
  }));

  // One upload + conversion. XHR (not fetch) so the card can show upload progress.
  function requestConversion(row, onProgress){
    return new Promise((resolve, reject) => {
      const t = row.targets.find(x => x[0] === row.target);
      const form = new FormData();
      form.append("file", row.file);
      form.append("format", t ? t[2] : row.target);
      form.append("quality", String(row.quality));
      form.append("maxDim", String(row.maxDim));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/compress");
      xhr.responseType = "blob";
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.upload.onload = () => onProgress(1);
      xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
      xhr.onload = async () => {
        if (xhr.status !== 200){
          let msg = xhr.status === 413 ? tooBig(row.size)
            : xhr.status === 524 || xhr.status === 504 ? "This file took too long to convert. Try a smaller or shorter file."
            : xhr.status === 429 ? "Too many files in a short time. Please wait a few minutes and try again."
            : "The server couldn't convert this file.";
          try { const data = JSON.parse(await xhr.response.text()); if (data.error) msg = data.error; } catch (e) {}
          return reject(new Error(msg));
        }
        const cd = xhr.getResponseHeader("Content-Disposition") || "";
        const ext = xhr.getResponseHeader("X-Output-Ext") || (t ? t[0] : "bin");
        let name = row.name.replace(/\.[^.]+$/, "") + "." + ext;
        const star = /filename\*=UTF-8''([^;]+)/i.exec(cd), plain = /filename="([^"]+)"/.exec(cd);
        try { if (star) name = decodeURIComponent(star[1]); else if (plain) name = plain[1]; } catch (e) {}
        resolve({ blob: xhr.response, ext, name });
      };
      xhr.send(form);
    });
  }

  const queue = [];
  let active = 0;
  function pump(){
    while (active < CONCURRENCY && queue.length){
      const row = queue.shift();
      active++;
      row.state = "uploading"; row.progress = 0; render();
      requestConversion(row, p => {
        row.progress = p;
        if (p >= 1) row.state = "converting";
        updateRow(row);
      }).then(res => {
        row.state = "finished"; row.blob = res.blob; row.outExt = res.ext; row.outName = res.name; row.outSize = res.blob.size;
        // Compressing must never hand back a bigger file: keep the original when re-encoding
        // did not help (unless the visitor asked for a resize, which changes the image).
        if (compressMode && !row.maxDim && row.outSize >= row.size) { row.blob = row.file; row.outSize = row.size; }
      }).catch(err => {
        row.state = "error"; row.error = err.message;
      }).finally(() => { active--; render(); pump(); });
    }
  }

  convertAllBtn.addEventListener("click", () => {
    rows.filter(r => r.state === "ready").forEach(r => { r.state = "waiting"; r.optionsOpen = false; queue.push(r); });
    render(); pump();
  });

  function save(blob, name){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Download all: one ZIP with every finished file (names made unique).
  zipBtn.addEventListener("click", async () => {
    const done = rows.filter(r => r.state === "finished");
    if (!done.length) return;
    if (done.length === 1) return save(done[0].blob, done[0].outName);
    if (typeof JSZip === "undefined") return;
    zipBtn.disabled = true;
    const label = zipBtn.lastChild.textContent;
    zipBtn.lastChild.textContent = "Zipping…";
    const zip = new JSZip();
    const used = new Set();
    done.forEach(r => {
      let name = r.outName, n = 1;
      while (used.has(name)) name = r.outName.replace(/(\.[^.]+)?$/, m => " (" + (++n) + ")" + m);
      used.add(name);
      zip.file(name, r.blob);
    });
    save(await zip.generateAsync({ type: "blob" }), "converted-files.zip");
    zipBtn.disabled = false;
    zipBtn.lastChild.textContent = label;
  });

  // ------------------------------------------------------------------ rendering --
  const BADGE = { waiting: ["WAITING", "st-wait"], uploading: ["UPLOADING", "st-busy"], converting: [compressMode ? "COMPRESSING" : "CONVERTING", "st-busy"],
    finished: ["FINISHED", "st-ok"], error: ["ERROR", "st-err"] };

  function statusHtml(row){
    if (row.state === "ready") return "";
    const [label, cls] = BADGE[row.state];
    let text = "";
    if (row.state === "uploading") text = `<span class="row-progress"><span style="width:${Math.round((row.progress || 0) * 100)}%"></span></span><span class="muted">${Math.round((row.progress || 0) * 100)}%</span>`;
    else if (row.state === "converting") text = `<span class="spinner" aria-hidden="true"></span><span class="muted">${compressMode ? "Compressing…" : `Converting to ${esc(labelOf(row.target))}…`}</span>`;
    else if (row.state === "waiting") text = `<span class="muted">Waiting in queue…</span>`;
    else if (row.state === "finished") {
      // Converting: name only (a new format's size says little and is easy to misread).
      // Compressing: original and compressed size side by side, plus the saving.
      const pct = Math.round((1 - row.outSize / row.size) * 100);
      text = `<span class="out-name">${esc(row.outName)}</span>`
        + (compressMode ? `<span class="muted"> · ${fmtBytes(row.size)} &rarr; ${fmtBytes(row.outSize)}</span>`
          + (pct > 0 ? `<span class="saved">${pct}% smaller</span>` : `<span class="muted"> · already well compressed</span>`) : "");
    }
    else if (row.state === "error") text = `<span class="err-text">${esc(row.error)}</span>`;
    const action = row.state === "finished" ? `<button class="btn btn-success btn-sm dl-btn" type="button">${DL_ICON}Download</button>` : "";
    return `<div class="file-status"><span class="badge-state ${cls}">${label}</span><div class="status-text">${text}</div>${action}</div>`;
  }
  const DL_ICON = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
  const catOf = id => (MAP && MAP.fmts[id] ? primaryCat(id) : ((OUTS.find(o => o[0] === id) || [])[3] || "none"));
  const labelOf = id => { for (const r of rows) { const t = (r.targets || []).find(x => x[0] === id); if (t) return t[1]; } return String(id).toUpperCase(); };

  function rowHtml(row){
    const inCat = row.fmt ? catOfExt(row.fmt.ext) : "none";
    const inLabel = row.fmt ? row.fmt.ext.toUpperCase() : "?";
    const meta = `${fmtBytes(row.size)}${row.fmt ? " · " + esc(inLabel) + " " + (KIND[inCat] || "File") : ""}`;
    let convert = "";
    if (compressMode && row.fmt && row.targets && row.targets.length){
      // Compress: no target to pick, just "Compress [PNG]" and image options.
      const showOptions = isImageTarget(row.target) && row.state === "ready";
      convert = `<div class="file-convert">
          <span class="convert-label">${COMPRESS_ICON}Compress</span>
          <span class="fmt-pill">${fsvgHtml(inCat)}${esc(inLabel)}</span>
          ${showOptions ? `<button class="btn btn-ghost btn-sm opt-btn" type="button" aria-expanded="${row.optionsOpen}">${OPT_ICON}Options</button>` : ""}
        </div>`;
    } else if (row.fmt && row.targets && row.targets.length){
      const locked = row.state !== "ready";
      const opts = row.targets.map(t => `<option value="${esc(t[0])}"${t[0] === row.target ? " selected" : ""}>${esc(t[1])}</option>`).join("");
      const showOptions = isImageTarget(row.target);
      convert = `<div class="file-convert">
          <span class="convert-label">${CONVERT_ICON}Convert</span>
          <span class="fmt-pill">${fsvgHtml(inCat)}${esc(inLabel)}</span>
          <span class="arrow" aria-hidden="true">&rarr;</span>
          ${locked ? `<span class="fmt-pill">${fsvgHtml(catOf(row.target))}${esc(labelOf(row.target))}</span>`
            : `<select class="target-sel" aria-label="Convert ${esc(row.name)} to">${opts}</select>`}
          ${showOptions && !locked ? `<button class="btn btn-ghost btn-sm opt-btn" type="button" aria-expanded="${row.optionsOpen}">${OPT_ICON}Options</button>` : ""}
        </div>`;
    }
    const removable = !["waiting", "uploading", "converting"].includes(row.state);
    const options = row.optionsOpen && row.state === "ready" ? `<div class="file-options">
        <label>Quality <input type="range" class="q-range" min="10" max="100" value="${row.quality}"><span class="q-val">${row.quality}%</span></label>
        <label>Resize <select class="dim-sel">${[[0, "Keep original size"], [2560, "Max 2560px"], [1920, "Max 1920px"], [1280, "Max 1280px"], [800, "Max 800px"]]
          .map(([v, l]) => `<option value="${v}"${v === row.maxDim ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>` : "";
    return `<div class="file-main">
        <span class="file-icon">${fsvgHtml(inCat)}</span>
        <div class="file-info"><div class="fname">${esc(row.name)}</div><div class="fmeta">${meta}</div></div>
        ${convert}
        <button class="remove-btn" type="button" aria-label="Remove ${esc(row.name)}"${removable ? "" : " disabled"}>&times;</button>
      </div>${options}${statusHtml(row)}`;
  }
  const CONVERT_ICON = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v5h-5M3 20v-5h5"/></svg>';
  const COMPRESS_ICON = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>';
  const OPT_ICON = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>';

  function wireRow(el, row){
    const sel = el.querySelector(".target-sel");
    if (sel) sel.addEventListener("change", () => { row.target = sel.value; render(); });
    const opt = el.querySelector(".opt-btn");
    if (opt) opt.addEventListener("click", () => { row.optionsOpen = !row.optionsOpen; render(); });
    const q = el.querySelector(".q-range");
    if (q) q.addEventListener("input", () => { row.quality = Number(q.value); el.querySelector(".q-val").textContent = q.value + "%"; });
    const dim = el.querySelector(".dim-sel");
    if (dim) dim.addEventListener("change", () => { row.maxDim = Number(dim.value); });
    el.querySelector(".remove-btn").addEventListener("click", () => { rows.splice(rows.indexOf(row), 1); render(); });
    const dl = el.querySelector(".dl-btn");
    if (dl) dl.addEventListener("click", () => save(row.blob, row.outName));
  }

  function updateRow(row){
    const el = fileList.querySelector(`[data-row="${row.id}"]`);
    if (!el) return render();
    const old = el.querySelector(".file-status");
    const tmp = document.createElement("div");
    tmp.innerHTML = statusHtml(row);
    if (old) old.replaceWith(tmp.firstElementChild || ""); else if (tmp.firstElementChild) el.appendChild(tmp.firstElementChild);
  }

  function render(){
    fileList.innerHTML = "";
    rows.forEach(row => {
      const el = document.createElement("div");
      el.className = "file-card is-" + row.state;
      el.dataset.row = row.id;
      el.innerHTML = rowHtml(row);
      wireRow(el, row);
      fileList.appendChild(el);
    });
    const ready = rows.filter(r => r.state === "ready").length;
    const busy = rows.filter(r => ["waiting", "uploading", "converting"].includes(r.state)).length;
    const done = rows.filter(r => r.state === "finished").length;
    const failed = rows.filter(r => r.state === "error").length;
    dropzone.hidden = rows.length > 0;
    toolBar.hidden = rows.length === 0;
    convertAllBtn.hidden = ready === 0;
    convertAllBtn.disabled = busy > 0 && ready === 0;
    zipBtn.hidden = done === 0;
    zipBtn.lastChild.textContent = done > 1 ? `Download all (${done})` : "Download";
    let status;
    if (busy) status = `<span class="spinner" aria-hidden="true"></span> ${compressMode ? "Compressing" : "Converting"} ${busy} file${busy > 1 ? "s" : ""}…`;
    else if (ready) status = `${ready} file${ready > 1 ? "s" : ""} ready`;
    else if (done) status = `<span class="done-check" aria-hidden="true">&#10003;</span> Done${failed ? ` &middot; ${failed} failed` : ""}`;
    else status = failed ? `${failed} file${failed > 1 ? "s" : ""} could not be converted` : "";
    barStatus.innerHTML = status;
  }

  render();
})();
