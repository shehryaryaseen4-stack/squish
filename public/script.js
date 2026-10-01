(function(){
  "use strict";

  // Theme: explicit choice is remembered per browser; otherwise follow the OS setting.
  const root = document.documentElement;
  try { const saved = localStorage.getItem("theme"); if (saved) root.setAttribute("data-theme", saved); } catch (e) {}
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) themeToggle.addEventListener("click", () => {
    const cur = root.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  });

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

  // "convert [X] to [Y]": on pages with a conversion map, choosing the input fills the
  // output picker in place (CloudConvert-style). Without JS the input buttons are plain
  // links to the format page, which renders the same picker server-side.
  const mapEl = document.getElementById("convMap");
  if (mapEl){
    let MAP = null;
    try { MAP = JSON.parse(mapEl.textContent); } catch (e) { MAP = null; }
    const fromMenu = document.querySelector('details[data-role="from"]');
    const toMenu = document.querySelector('details[data-role="to"]');
    if (MAP && fromMenu && toMenu){
      const live = new Set(MAP.live);
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
      const routeOf = (f, t) => "/" + f + "-to-" + t;
      function fillTo(from){
        const outs = (MAP.pairs[from] || "").split(" ").filter(Boolean);
        const groups = MAP.cats.map(([id, name]) => [name, outs.filter(o => MAP.fmts[o][1].includes(id))]).filter(g => g[1].length);
        const panel = toMenu.querySelector(".fmt-panel");
        panel.querySelector(".fmt-cats").innerHTML = groups.map(([name], i) =>
          '<li><button type="button" class="fmt-cat' + (i ? '' : ' is-active') + '" data-cat="' + i + '">' + esc(name) + '<span class="fmt-arrow" aria-hidden="true">&rsaquo;</span></button></li>').join("");
        panel.querySelector(".fmt-grids").innerHTML = groups.map(([name, list], i) =>
          '<div class="fmt-grid' + (i ? '' : ' is-active') + '" data-cat="' + i + '" aria-label="' + esc(name) + '">' + list.map(o => {
            const ok = live.has(from + ">" + o);
            const f = MAP.fmts[o];
            return '<a class="fmt-btn' + (ok ? ' is-live' : '') + '" href="' + routeOf(from, o) + '" data-name="' + esc((f[0] + " " + f[2]).toLowerCase()) + '"' + (ok ? '' : ' title="Coming soon"') + '>' + esc(f[0]) + '</a>';
          }).join("") + '</div>').join("") + '<p class="fmt-none">No format found</p>' + (groups.length ? '' : '<p class="fmt-hint">No conversions for this format yet.</p>');
        toMenu.querySelector(".chip").classList.add("chip-empty");
        toMenu.querySelector(".chip-label").textContent = "...";
      }
      fromMenu.addEventListener("click", e => {
        const b = e.target.closest(".fmt-btn[data-fmt]");
        if (!b || !MAP.pairs[b.dataset.fmt]) return;
        e.preventDefault();
        fromMenu.querySelectorAll(".fmt-btn[aria-current]").forEach(x => x.removeAttribute("aria-current"));
        b.setAttribute("aria-current", "true");
        const chip = fromMenu.querySelector(".chip");
        chip.classList.remove("chip-empty");
        chip.querySelector(".chip-label").textContent = MAP.fmts[b.dataset.fmt][0];
        fromMenu.removeAttribute("open");
        fillTo(b.dataset.fmt);
        // Open after this click has finished bubbling, or the outside-click handler closes it again.
        setTimeout(() => toMenu.setAttribute("open", ""), 0);
      });
    }
  }

  const dropzone = document.getElementById("dropzone");
  if (!dropzone) return; // hub / 404 pages have no upload tool

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

  qualityRange.addEventListener("input", () => { qualityVal.textContent = qualityRange.value + "%"; });

  ["dragenter","dragover"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("drag"); }));
  ["dragleave","drop"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("drag"); }));
  // Accept only the extensions this tool can read (set server-side from the registry).
  const exts = (dropzone.dataset.exts || "").split(",").filter(Boolean);
  const accepted = f => { const m = /\.([a-z0-9]+)$/i.exec(f.name); return !exts.length || (!!m && exts.includes(m[1].toLowerCase())); };
  dropzone.addEventListener("drop", e => {
    const all = Array.from(e.dataTransfer.files);
    const files = all.filter(accepted);
    if (files.length) handleFiles(files);
    if (files.length < all.length) alert("Some files were skipped. This tool accepts: " + exts.map(x => "." + x).join(", "));
  });
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

  async function handleFiles(files){
    const rows = files.map(file => {
      const id = ++seq;
      const row = { id, name: file.name, originalSize: file.size, blob:null, compressedSize:null, status:"Queued…", ext:null };
      results.push(row);
      return { file, row };
    });
    renderList();

    let cursor = 0;
    async function worker(){
      while (cursor < rows.length){
        const { file, row } = rows[cursor++];
        row.status = "Converting…";
        renderList();
        try {
          await compressOne(file, row);
        } catch (err) {
          row.status = err.message || "Couldn't process this file";
        }
        renderList();
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
  }

  async function compressOne(file, row){
    const form = new FormData();
    form.append("file", file);
    form.append("format", formatSel.value);
    form.append("quality", qualityRange.value);
    form.append("maxDim", maxDimSel.value);

    const resp = await fetch("/api/compress", { method: "POST", body: form });
    if (!resp.ok){
      let message = "Server couldn't process this file.";
      try { const data = await resp.json(); if (data.error) message = data.error; } catch(e){}
      throw new Error(message);
    }
    const blob = await resp.blob();
    row.blob = blob;
    row.compressedSize = Number(resp.headers.get("X-Compressed-Size")) || blob.size;
    row.ext = resp.headers.get("X-Output-Ext") || "img";
    row.status = "done";
  }

  function downloadRow(row){
    const base = row.name.replace(/\.[^.]+$/, "");
    const url = URL.createObjectURL(row.blob);
    const a = document.createElement("a");
    a.href = url; a.download = base + "-compressed." + row.ext;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function downloadZip(){
    const done = results.filter(r => r.blob);
    if (!done.length || typeof JSZip === "undefined") return;
    zipBtn.disabled = true;
    zipBtn.textContent = "Zipping…";
    const zip = new JSZip();
    done.forEach(r => {
      const base = r.name.replace(/\.[^.]+$/, "");
      zip.file(base + "-compressed." + r.ext, r.blob);
    });
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url; a.download = "converted-files.zip";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
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

    const done = results.filter(r => r.compressedSize != null);
    zipBtn.disabled = done.length < 2;

    if (done.length){
      const origTotal = done.reduce((s,r)=>s+r.originalSize,0);
      const newTotal = done.reduce((s,r)=>s+r.compressedSize,0);
      const pct = origTotal ? Math.round((1 - newTotal/origTotal) * 100) : 0;
      savingsTotal.textContent = pct + "% smaller overall";
    } else {
      savingsTotal.textContent = "";
    }

    fileList.innerHTML = "";
    results.slice().reverse().forEach(row => {
      const el = document.createElement("div");
      el.className = "file-row";
      const pct = row.compressedSize != null ? Math.round((1 - row.compressedSize/row.originalSize)*100) : null;
      const thumbSrc = row.blob ? URL.createObjectURL(row.blob) : null;
      el.innerHTML = `
        ${thumbSrc ? `<img class="thumb" src="${thumbSrc}" alt="">` : `<div class="thumb"></div>`}
        <div>
          <div class="fname">${row.name}</div>
          <div class="fsize mono">${fmtBytes(row.originalSize)}${row.compressedSize!=null ? ' → ' + fmtBytes(row.compressedSize) : ''}</div>
        </div>
        <div class="fsave mono ${pct!=null && pct<0 ? 'worse' : ''}">${pct!=null ? (pct>=0? '-'+pct+'%' : '+'+(-pct)+'%') : ''}</div>
        <div class="fstatus">${row.compressedSize!=null ? '' : row.status}</div>
        <div>${row.blob ? '<button class="dl-btn" type="button">Download</button>' : ''}</div>
      `;
      if (row.blob) el.querySelector(".dl-btn").addEventListener("click", () => downloadRow(row));
      fileList.appendChild(el);
    });
  }

  // Landing pages preselect their target format (e.g. /png-to-webp -> WebP).
  const defFmt = document.body.dataset.defaultFormat;
  if (defFmt && Array.from(formatSel.options).some(o => o.value === defFmt)) formatSel.value = defFmt;

  renderList();
})();
