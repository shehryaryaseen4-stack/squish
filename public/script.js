(function(){
  "use strict";

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) themeToggle.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", cur==="dark" ? "light" : "dark");
  });

  if (!window.__chipMenuCloser){
    window.__chipMenuCloser = true;
    document.addEventListener("click", e => {
      document.querySelectorAll("details.chip-menu[open]").forEach(d => { if (!d.contains(e.target)) d.removeAttribute("open"); });
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") document.querySelectorAll("details.chip-menu[open]").forEach(d => d.removeAttribute("open"));
    });
  }

  // Format picker: category switching + search inside every .fmt-panel
  document.querySelectorAll(".fmt-panel").forEach(panel => {
    const cats = panel.querySelectorAll(".fmt-cat");
    const grids = panel.querySelectorAll(".fmt-grid");
    const btns = panel.querySelectorAll(".fmt-btn");
    const q = panel.querySelector(".fmt-q");
    function select(i){
      cats.forEach(c => c.classList.toggle("is-active", c.dataset.cat === i));
      grids.forEach(g => g.classList.toggle("is-active", g.dataset.cat === i));
    }
    cats.forEach(c => {
      c.addEventListener("click", () => { select(c.dataset.cat); q.value = ""; filter(); });
      c.addEventListener("mouseenter", () => { if (!q.value) select(c.dataset.cat); });
    });
    function filter(){
      const term = q.value.trim().toLowerCase();
      let shown = 0;
      btns.forEach(b => { const ok = !term || b.dataset.name.includes(term); b.hidden = !ok; if (ok) shown++; });
      panel.classList.toggle("searching", !!term);
      panel.classList.toggle("no-match", !!term && shown === 0);
    }
    q.addEventListener("input", filter);
    panel.closest("details").addEventListener("toggle", e => { if (e.target.open) setTimeout(() => q.focus(), 0); else { q.value = ""; filter(); } });
  });

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
  dropzone.addEventListener("drop", e => {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|tiff?|gif|bmp|svg|heic|heif)$/i.test(f.name));
    if (files.length) handleFiles(files);
  });
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
        row.status = "Compressing…";
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
    a.href = url; a.download = "compressed-images.zip";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    zipBtn.disabled = false;
    zipBtn.textContent = "Download all as .zip";
  }
  zipBtn.addEventListener("click", downloadZip);

  function renderList(){
    if (results.length === 0){
      resultsTitle.textContent = "No images yet";
      emptyNote.style.display = "block";
      fileList.innerHTML = "";
      zipBtn.disabled = true;
      savingsTotal.textContent = "";
      return;
    }
    emptyNote.style.display = "none";
    resultsTitle.textContent = results.length + (results.length===1 ? " image" : " images");

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
