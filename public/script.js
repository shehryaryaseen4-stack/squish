(function(){
  "use strict";

  // Ad slots (no-op until the AdSense script is enabled in views/page.html).
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
    const ico = chip.querySelector(".ficon");
    if (ico) ico.className = "ficon ficon-xs fi-" + (id ? primaryCat(id) : "none");
    chip.querySelector(".chip-label").textContent = id ? MAP.fmts[id][0] : "...";
    chip.classList.toggle("chip-empty", !id);
  }

  // "convert [X] to [Y]": choosing the input fills the output picker in place (CloudConvert-style).
  // Without JS the input buttons are plain links to the format page, which renders the same picker.
  const fromMenu = document.querySelector('details[data-role="from"]');
  const toMenu = document.querySelector('details[data-role="to"]');
  let chosenFrom = null;
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
            + '<i class="ficon ficon-xs fi-' + primaryCat(o) + '" aria-hidden="true"></i>' + esc(f[0]) + '</a>';
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
    [fromMenu, toMenu].forEach(m => { if (m && !chosenFrom) { const c = m.querySelector(".chip"); c.classList.remove("is-rotating"); setChip(c, null); } });
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

  const tool = document.getElementById("convert");
  const anyMode = tool && tool.dataset.any === "1"; // home/category: per-file targets for non-images
  const fileInput = document.getElementById("fileInput");
  const formatSel = document.getElementById("formatSel");
  const qualityRange = document.getElementById("qualityRange");
  const qualityVal = document.getElementById("qualityVal");
  const maxDimSel = document.getElementById("maxDimSel");
  const fileList = document.getElementById("fileList");
  const resultsTitle = document.getElementById("resultsTitle");
  const savingsTotal = document.getElementById("savingsTotal");
  const zipBtn = document.getElementById("zipBtn");
  const emptyNote = document.getElementById("emptyNote");
  const results = [];
  let seq = 0;
  const CONCURRENCY = 3; // keep server load predictable when many files are dropped at once

  if (qualityRange) qualityRange.addEventListener("input", () => { qualityVal.textContent = qualityRange.value + "%"; });

  // Which format is this file? Longest matching extension wins ("backup.tar.gz" -> tar-gz).
  const exts = (dropzone.dataset.exts || "").split(",").filter(Boolean);
  function formatOf(name){
    const parts = String(name).toLowerCase().split(".");
    for (let k = 1; k < parts.length; k++){
      const ext = parts.slice(k).join(".");
      if (exts.includes(ext)) return MAP && MAP.ext[ext] ? MAP.ext[ext] : ext;
    }
    return null;
  }
  const isImage = id => !!MAP && (primaryCat(id) === "image" || id === "svg");
  let CATS = {};
  try { CATS = JSON.parse(tool.dataset.cats || "{}"); } catch (e) { CATS = {}; }
  const catOfExt = ext => CATS[ext] || (MAP && MAP.ext[ext] ? primaryCat(MAP.ext[ext]) : "none");

  ["dragenter","dragover"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("drag"); }));
  ["dragleave","drop"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("drag"); }));
  dropzone.addEventListener("drop", e => handleFiles(Array.from(e.dataTransfer.files)));
  const selectBtn = document.getElementById("selectBtn");
  if (selectBtn) selectBtn.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", e => { if (e.key==="Enter" || e.key===" ") fileInput.click(); });
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) handleFiles(Array.from(fileInput.files));
    fileInput.value = "";
  });

  function fmtBytes(n){
    if (n < 1024) return n + " B";
    if (n < 1024*1024) return (n/1024).toFixed(1) + " KB";
    return (n/(1024*1024)).toFixed(2) + " MB";
  }

  // Live targets for a non-image file on home/category pages.
  const targetsFor = id => (MAP && MAP.pairs[id] ? MAP.pairs[id].split(" ").filter(o => LIVE.has(id + ">" + o)) : []);

  const queue = [];
  let active = 0;
  function pump(){
    while (active < CONCURRENCY && queue.length){
      const { file, row } = queue.shift();
      active++;
      row.status = "Converting…"; renderList();
      convertOne(file, row).catch(err => { row.status = err.message || "Couldn't convert this file"; row.error = true; })
        .finally(() => { active--; renderList(); pump(); });
    }
  }
  const enqueue = (file, row) => { row.status = "Queued…"; row.error = false; queue.push({ file, row }); pump(); };

  function handleFiles(files){
    files.forEach(file => {
      const row = { id: ++seq, name: file.name, originalSize: file.size, blob: null, outSize: null, status: "", ext: null, file };
      row.from = formatOf(file.name);
      results.push(row);
      if (!row.from){ row.status = "This file type isn't supported here."; row.error = true; return; }
      if (anyMode && !isImage(row.from)){
        // Non-image on a general page: use the picker's choice if it fits, else ask for a target.
        const targets = targetsFor(row.from);
        if (!targets.length){ row.status = "This file type can't be converted yet."; row.error = true; return; }
        row.targets = targets;
        row.target = targets[0];
        row.needsTarget = true;
        row.status = "";
        return;
      }
      row.format = formatSel ? formatSel.value : "auto";
      enqueue(file, row);
    });
    renderList();
  }

  function filenameFrom(resp, row){
    const cd = resp.headers.get("Content-Disposition") || "";
    const m = /filename="([^"]+)"/.exec(cd);
    return m ? m[1] : row.name.replace(/\.[^.]+$/, "") + "." + row.ext;
  }

  async function convertOne(file, row){
    const form = new FormData();
    form.append("file", file);
    form.append("format", row.format);
    if (qualityRange) form.append("quality", qualityRange.value);
    if (maxDimSel) form.append("maxDim", maxDimSel.value);

    const resp = await fetch("/api/compress", { method: "POST", body: form });
    if (!resp.ok){
      let message = "The server couldn't convert this file.";
      try { const data = await resp.json(); if (data.error) message = data.error; } catch(e){}
      throw new Error(message);
    }
    const blob = await resp.blob();
    row.blob = blob;
    row.outSize = Number(resp.headers.get("X-Compressed-Size")) || blob.size;
    row.ext = resp.headers.get("X-Output-Ext") || "bin";
    row.outName = filenameFrom(resp, row);
    row.status = "done";
    row.needsTarget = false;
    if (row.thumb){ URL.revokeObjectURL(row.thumb); row.thumb = null; }
    if (/^(png|jpe?g|webp|gif|avif|bmp|ico)$/.test(row.ext)) row.thumb = URL.createObjectURL(blob);
  }

  function save(blob, name){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function downloadZip(){
    const done = results.filter(r => r.blob);
    if (!done.length || typeof JSZip === "undefined") return;
    zipBtn.disabled = true;
    zipBtn.textContent = "Zipping…";
    const zip = new JSZip();
    const used = new Set();
    done.forEach(r => {
      let name = r.outName, n = 1;
      while (used.has(name)) name = r.outName.replace(/(\.[^.]+)?$/, m => "-" + (++n) + m);
      used.add(name);
      zip.file(name, r.blob);
    });
    save(await zip.generateAsync({ type: "blob" }), "converted-files.zip");
    zipBtn.disabled = false;
    zipBtn.textContent = "Download all as .zip";
  }
  zipBtn.addEventListener("click", downloadZip);

  function renderList(){
    if (results.length === 0){
      resultsTitle.textContent = "No files yet";
      emptyNote.style.display = "block";
      fileList.innerHTML = "";
      zipBtn.disabled = true;
      savingsTotal.textContent = "";
      return;
    }
    emptyNote.style.display = "none";
    resultsTitle.textContent = results.length + (results.length===1 ? " file" : " files");

    const done = results.filter(r => r.outSize != null && catOfExt(r.ext) === catOfExt((r.name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1]));
    zipBtn.disabled = results.filter(r => r.blob).length < 2;
    const origTotal = done.reduce((s,r)=>s+r.originalSize,0);
    const newTotal = done.reduce((s,r)=>s+r.outSize,0);
    const pctAll = origTotal ? Math.round((1 - newTotal/origTotal) * 100) : 0;
    savingsTotal.textContent = done.length && pctAll > 0 ? pctAll + "% smaller overall" : "";

    fileList.innerHTML = "";
    results.slice().reverse().forEach(row => {
      const el = document.createElement("div");
      el.className = "file-row";
      // Size change is only meaningful between files of the same kind (image to image, PDF compression...).
      const inExt = (row.name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1];
      const sameKind = row.outSize != null && catOfExt(row.ext) === catOfExt(inExt);
      const pct = sameKind ? Math.round((1 - row.outSize/row.originalSize)*100) : null;
      const icon = row.thumb ? `<img class="thumb" src="${row.thumb}" alt="">`
        : `<i class="ficon ficon-md fi-${esc(catOfExt(row.ext || inExt))}" aria-hidden="true"><b>${esc((row.ext || inExt || "?").toUpperCase().slice(0, 5))}</b></i>`;
      let action = "";
      if (row.blob) action = '<button class="dl-btn" type="button">Download</button>';
      else if (row.needsTarget){
        action = `<label class="row-target">to <select aria-label="Convert ${esc(row.name)} to">${row.targets.map(t =>
          `<option value="${esc(t)}"${t === row.target ? " selected" : ""}>${esc(MAP.fmts[t][0])}</option>`).join("")}</select></label>
          <button class="convert-btn" type="button">Convert</button>`;
      }
      el.innerHTML = `
        ${icon}
        <div>
          <div class="fname">${esc(row.name)}</div>
          <div class="fsize mono">${fmtBytes(row.originalSize)}${row.outSize!=null ? ' → ' + fmtBytes(row.outSize) : ''}</div>
        </div>
        <div class="fsave mono ${pct!=null && pct<0 ? 'worse' : ''}">${pct!=null ? (pct>=0? '-'+pct+'%' : '+'+(-pct)+'%') : ''}</div>
        <div class="fstatus${row.error ? ' err' : ''}">${row.outSize!=null ? '' : esc(row.status)}</div>
        <div class="row-actions">${action}</div>
      `;
      if (row.blob) el.querySelector(".dl-btn").addEventListener("click", () => save(row.blob, row.outName));
      if (row.needsTarget){
        const sel = el.querySelector("select");
        sel.addEventListener("change", () => { row.target = sel.value; });
        el.querySelector(".convert-btn").addEventListener("click", () => {
          row.needsTarget = false;
          row.format = MAP.fmts[row.target][3] || row.target;
          enqueue(row.file, row);
        });
      }
      fileList.appendChild(el);
    });
  }

  // Landing pages preselect their target format (e.g. /png-to-webp -> WebP).
  const defFmt = document.body.dataset.defaultFormat;
  if (formatSel && defFmt && Array.from(formatSel.options).some(o => o.value === defFmt)) formatSel.value = defFmt;

  renderList();
})();
