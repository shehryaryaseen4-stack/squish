(function(){
  "use strict";

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
    if (d.open) placePanel(d);
  }));
  // A format picker opens downwards when it fits below, upwards when it fits above instead;
  // when it fits on neither side, the page scrolls just enough to show it whole (never cut off).
  function placePanel(d){
    const panel = d.querySelector(":scope > .fmt-panel:not(.mega)");
    if (!panel) return;
    panel.classList.remove("fmt-up");
    const top = (document.querySelector(".top") || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom + 8;
    const room = window.innerHeight - 8;
    const down = panel.getBoundingClientRect();
    if (down.bottom <= room) return;
    panel.classList.add("fmt-up");
    if (panel.getBoundingClientRect().top >= top) return;
    panel.classList.remove("fmt-up");
    const by = Math.min(down.bottom - room, down.top - top);
    if (by > 0) window.scrollBy({ top: by, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  // A click on a menu's button closes every other menu at once (before the browser toggles this
  // one), so two dropdowns are never open together, whatever the browser supports.
  document.addEventListener("click", e => {
    const sum = e.target.closest("details[data-menu] > summary");
    if (!sum) return;
    const mine = sum.parentElement;
    openMenus().forEach(o => { if (o !== mine && !o.contains(mine)) o.removeAttribute("open"); });
  }, true);


  // Count this page view for the owner's dashboard. No cookies and nothing personal: the
  // server keeps only the page, where the visit came from, country and device (accounts/analytics.js).
  const track = (o) => {
    try {
      const body = JSON.stringify(o);
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/p", new Blob([body], { type: "application/json" })))) {
        fetch("/api/p", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
      }
    } catch (_) { /* never let counting break the page */ }
  };
  if (!/^Page not found/.test(document.title)) {
    let utm = null; try { utm = new URLSearchParams(location.search).get("utm_source"); } catch (_) { /* old browser */ }
    track({ p: location.pathname, r: document.referrer, u: utm || undefined });
  }
  window.addEventListener("pe:exported", () => track({ e: "pdf", p: location.pathname }));
  window.addEventListener("pt:done", (e) => track({ e: "tool", p: location.pathname, d: e.detail }));

  // A short thank-you under the download button once a file is ready: no popup, nothing blocked.
  // It names the site and gives two ways back (bookmark, share), once per page.
  const SITE_NAME = (document.querySelector('meta[property="og:site_name"]') || {}).content || "Flipit Free";
  let thanked = false;
  function thanks(){
    if (thanked) return;
    const host = document.querySelector("#app, #pt, #convert");
    if (!host) return;
    thanked = true;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const keep = touch ? "Add us to your home screen" : `Press ${mac ? "⌘" : "Ctrl"}+D to bookmark us`;
    const card = document.createElement("div");
    card.className = "thanks-card";
    card.setAttribute("role", "status");
    card.innerHTML = `<span class="thanks-ico" aria-hidden="true">❤</span>`
      + `<p><strong>Thanks for using ${SITE_NAME}!</strong> Free, fast and no sign-up, every time. ${keep} for your next file.</p>`
      + `<button type="button" class="btn btn-ghost btn-sm thanks-share">Share</button>`;
    card.querySelector(".thanks-share").addEventListener("click", async (e) => {
      const data = { title: SITE_NAME, text: `${SITE_NAME}: free online file converter`, url: location.origin + location.pathname };
      try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(data.url); e.target.textContent = "Link copied"; }
      } catch (_) { /* closed the share sheet */ }
    });
    host.appendChild(card);
  }
  window.addEventListener("pt:done", thanks);
  window.addEventListener("ff:converted", thanks);

  // "How was your experience?": a short rating popup the second time a visitor gets a file ready
  // (on a later page or visit, never the first, so it never gets in the way of a first-time
  // visitor), at most twice, 30 days apart,
  // and never again once they rate. Every rating, high or low, gets the same invitation to review
  // the site (Trustpilot, Google ...; neither allows asking only happy visitors) plus an optional comment
  // for us, which the owner reads on the dashboard (accounts/feedback.js).
  const REVIEW = document.body.dataset.review || "", REVIEW_SITE = document.body.dataset.reviewSite || "a review site";
  const REVIEW_ICON = { Google: '<span class="rate-g" aria-hidden="true">G</span>', Trustpilot: '<span class="rate-tp" aria-hidden="true">&#9733;</span>' }[REVIEW_SITE] || "";
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem("ff:" + k); localStorage.setItem("ff:" + k, v); } catch (_) { /* storage off */ } return null; };
  let askedHere = false, usedHere = false;
  function maybeAsk(){
    if (usedHere) return; // one use per page, however many files or re-renders
    usedHere = true;
    const uses = Number(ls("uses") || 0) + 1;
    ls("uses", String(uses));
    const asks = Number(ls("asks") || 0), last = Number(ls("askedAt") || 0);
    if (askedHere || ls("rated") || uses < 2 || asks >= 2 || Date.now() - last < 30 * 864e5) return;
    askedHere = true;
    setTimeout(() => { if (!document.querySelector("dialog[open]")) askRating(); }, 2500);
  }
  window.addEventListener("pt:done", maybeAsk);
  window.addEventListener("ff:converted", maybeAsk);

  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>';
  function askRating(){
    ls("asks", String(Number(ls("asks") || 0) + 1));
    ls("askedAt", String(Date.now()));
    const dlg = document.createElement("dialog");
    dlg.className = "rate-dlg";
    dlg.setAttribute("aria-labelledby", "rateTitle");
    dlg.innerHTML = `<button type="button" class="rate-x" aria-label="Close">&times;</button>
      <div class="rate-step" data-step="1">
        <div class="rate-badge" aria-hidden="true">${STAR}</div>
        <h2 id="rateTitle">How was your experience with ${esc(SITE_NAME)}?</h2>
        <p class="rate-sub">Your rating helps us keep these tools free, fast and easy to use.</p>
        <div class="rate-stars" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rate-star" role="radio" aria-checked="false" data-n="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">${STAR}</button>`).join("")}</div>
        <div class="rate-scale" aria-hidden="true"><span>Not good</span><span>Excellent</span></div>
      </div>
      <div class="rate-step" data-step="2" hidden>
        <div class="rate-chosen" aria-hidden="true"></div>
        <h2 class="rate-h2"></h2>
        ${REVIEW ? `<p class="rate-sub">Would you share your experience on ${esc(REVIEW_SITE)}? It takes a minute and helps others find tools they can trust.</p>
        <a class="btn btn-brand rate-google" href="${esc(REVIEW)}" target="_blank" rel="noopener">${REVIEW_ICON}Write a review on ${esc(REVIEW_SITE)}</a>
        <div class="rate-or"><span>or tell us directly</span></div>` : ""}
        <label class="rate-label" for="rateText"></label>
        <textarea id="rateText" class="rate-text" rows="3" maxlength="1000"></textarea>
        <div class="rate-actions"><button type="button" class="btn btn-ghost rate-close">No thanks</button><button type="button" class="btn ${REVIEW ? "btn-ghost" : "btn-brand"} rate-send">Send feedback</button></div>
      </div>
      <div class="rate-step" data-step="3" hidden>
        <div class="rate-badge rate-done" aria-hidden="true">&#10003;</div>
        <h2>Thank you!</h2>
        <p class="rate-sub">We read every message. It helps us decide what to improve next.</p>
        <div class="rate-actions"><button type="button" class="btn btn-brand rate-close">Close</button></div>
      </div>`;
    document.body.appendChild(dlg);
    let rating = 0, sent = false;
    const send = (text) => {
      if (sent || !rating) return;
      sent = true;
      fetch("/api/feedback", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, text: text || "", p: location.pathname }) }).catch(() => {});
    };
    const step = (n) => dlg.querySelectorAll(".rate-step").forEach(s => { s.hidden = s.dataset.step !== String(n); });
    const close = () => { send(dlg.querySelector(".rate-text").value.trim()); dlg.close(); };
    dlg.addEventListener("close", () => { send(dlg.querySelector(".rate-text").value.trim()); dlg.remove(); });
    dlg.querySelector(".rate-x").addEventListener("click", close);
    dlg.querySelectorAll(".rate-close").forEach(b => b.addEventListener("click", close));
    dlg.addEventListener("click", e => { if (e.target === dlg) close(); }); // a click outside the card
    const stars = [...dlg.querySelectorAll(".rate-star")];
    const light = (n) => stars.forEach((s, i) => s.classList.toggle("on", i < n));
    stars.forEach(s => {
      s.addEventListener("mouseenter", () => light(Number(s.dataset.n)));
      s.addEventListener("mouseleave", () => light(rating));
      s.addEventListener("click", () => {
        rating = Number(s.dataset.n);
        light(rating);
        stars.forEach(x => x.setAttribute("aria-checked", String(x === s)));
        ls("rated", String(rating));
        dlg.querySelector(".rate-chosen").innerHTML = stars.map((_, i) => `<span class="${i < rating ? "on" : ""}">${STAR}</span>`).join("");
        dlg.querySelector(".rate-h2").textContent = rating >= 4 ? "Thank you! We're glad it helped." : rating === 3 ? "Thanks for your rating." : "Sorry it wasn't better.";
        dlg.querySelector(".rate-label").textContent = rating >= 4 ? "Anything we could make even better? (optional)" : "What went wrong, or what could we improve? (optional)";
        setTimeout(() => { step(2); (dlg.querySelector(".rate-google") || dlg.querySelector(".rate-text")).focus(); }, 250);
      });
    });
    const google = dlg.querySelector(".rate-google");
    if (google) google.addEventListener("click", () => { send(dlg.querySelector(".rate-text").value.trim()); setTimeout(() => dlg.close(), 300); });
    dlg.querySelector(".rate-send").addEventListener("click", () => {
      const text = dlg.querySelector(".rate-text").value.trim();
      if (!text) { dlg.querySelector(".rate-text").focus(); return; }
      send(text);
      step(3);
    });
    dlg.showModal();
  }

  // Ad slots: present only when ADSENSE_CLIENT and slot IDs are set on the server.
  // adsbygoogle.push() throws when a slot is already filled or the ad script is blocked; that must
  // never stop the rest of this file (menus, search, the converter), so each push is guarded.
  document.querySelectorAll("ins.adsbygoogle").forEach(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) { /* ads are optional */ } });


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
      // a format listed in several categories (PDF is a document, an ebook and a vector
      // format) shows once in the results
      const seen = new Set();
      panel.querySelectorAll(".fmt-btn").forEach(b => {
        const key = b.getAttribute("href") + "|" + b.textContent.trim();
        const ok = !term || (b.dataset.name.includes(term) && !seen.has(key));
        if (term && ok) seen.add(key);
        b.hidden = !ok; if (ok) shown++;
      });
      // and categories with nothing left leave no gap
      grids().forEach(g => { g.hidden = !!term && !g.querySelector(".fmt-btn:not([hidden])"); });
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

  // Site search on the home page: tools, conversions and formats, matched as you type.
  (function siteSearch(){
    const wrap = document.querySelector(".site-search");
    if (!wrap) return;
    const input = wrap.querySelector(".ss-input"), list = wrap.querySelector(".ss-list");
    let items = null, loading = null, hits = [], active = -1;
    const KIND = { tool: "Tool", pdf: "PDF tool", convert: "Convert", compress: "Compress", format: "Format" };
    const RANK = { tool: 0, pdf: 1, compress: 2, convert: 3, format: 4 };
    const load = () => loading || (loading = fetch(wrap.dataset.search).then(r => r.json()).then(d => {
      items = d.map(([label, href, kind, words, pop]) => ({ label, href, kind, pop: pop || 0, hay: (label + " " + words).toLowerCase() }));
      if (input.value) run();
    }).catch(() => { loading = null; }));
    const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    function score(it, q, words, pair){
      const l = it.label.toLowerCase();
      if (pair){ // "png to jpg", "png 2 jpg", "png into jpg", "png jpg"
        if (it.kind === "convert" && l === pair[0] + " to " + pair[1]) return 0;
        if (it.kind === "convert" && l.startsWith(pair[0] + " to ") && l.endsWith(" " + pair[1])) return 1;
      }
      if (l === q) return 2;
      if (l.startsWith(q)) return 3 + RANK[it.kind] * 0.1;
      if (!words.every(w => it.hay.includes(w))) return null;
      return (words.every(w => l.includes(w)) ? 5 : 8) + RANK[it.kind] * 0.1;
    }
    function run(){
      const q = input.value.trim().toLowerCase().replace(/\s+/g, " ");
      if (!q){ close(); return; }
      if (!items){ load(); return; }
      const words = q.replace(/\b(to|into|2|convert|converter|online|free)\b/g, " ").split(" ").filter(Boolean);
      const m = /^\.?([\w-]+)\s+(?:to|2|into)\s+\.?([\w-]+)$/.exec(q) || (words.length === 2 && /^[a-z0-9-]{2,6}$/.test(words[0]) && /^[a-z0-9-]{2,6}$/.test(words[1]) ? [0, words[0], words[1]] : null);
      const pair = m ? [m[1], m[2]] : null;
      const scored = [];
      for (const it of items){ const s = score(it, q, words.length ? words : [q], pair); if (s !== null) scored.push([s - it.pop * 0.3, it]); }
      scored.sort((a, b) => a[0] - b[0] || a[1].label.length - b[1].label.length);
      hits = scored.slice(0, 8).map(x => x[1]);
      active = hits.length ? 0 : -1;
      list.innerHTML = hits.length
        ? hits.map((h, i) => `<li role="option" id="ss-${i}" class="ss-item${i === active ? " is-active" : ""}"><a href="${h.href}"><span class="ss-label">${esc(h.label)}</span><span class="ss-kind ss-${h.kind}">${KIND[h.kind]}</span></a></li>`).join("")
        : `<li class="ss-empty">No match for "${esc(input.value.trim())}". Try a format like PDF, JPG or MP4.</li>`;
      list.hidden = false; input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-activedescendant", active >= 0 ? "ss-" + active : "");
    }
    function close(){ list.hidden = true; input.setAttribute("aria-expanded", "false"); }
    function move(d){
      if (!hits.length) return;
      active = (active + d + hits.length) % hits.length;
      list.querySelectorAll(".ss-item").forEach((el, i) => el.classList.toggle("is-active", i === active));
      input.setAttribute("aria-activedescendant", "ss-" + active);
    }
    input.addEventListener("focus", load);
    input.addEventListener("input", run);
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown"){ e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp"){ e.preventDefault(); move(-1); }
      else if (e.key === "Enter"){ e.preventDefault(); if (hits[active]) location.href = hits[active].href; }
      else if (e.key === "Escape"){ close(); }
    });
    document.addEventListener("click", e => { if (!wrap.contains(e.target)) close(); });
    // "/" jumps to the search box, like on many sites
    document.addEventListener("keydown", e => {
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !e.ctrlKey && !e.metaKey){ e.preventDefault(); input.focus(); }
    });
  })();

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

  // After a file is chosen (picked or dropped) in any tool box (converter, PDF tools, the other
  // tools), the box grows with the file, its options and the button to go on, often below the
  // fold, so it looked as if nothing had happened. Scroll down just enough to show the whole box,
  // never hiding its top under the sticky header and never scrolling up. Checked twice, because
  // some tools draw their previews a moment later.
  const TOOL_BOXES = "#convert, #pt, #app";
  function revealBox(box){
    const header = (document.querySelector(".top") || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom;
    const r = box.getBoundingClientRect();
    const by = Math.min(r.top - header - 12, r.bottom - window.innerHeight + 16);
    if (by > 8) window.scrollBy({ top: by, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function afterPick(target){
    const box = target && target.closest && target.closest(TOOL_BOXES);
    if (!box) return;
    setTimeout(() => revealBox(box), 80);
    setTimeout(() => revealBox(box), 600);
  }
  document.addEventListener("change", e => {
    if (e.target.matches && e.target.matches('input[type="file"]') && e.target.files && e.target.files.length) afterPick(e.target);
  }, true);
  document.addEventListener("drop", e => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) afterPick(e.target);
  }, true);

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
      const row = { id: ++seq, file, name: file.name, size: file.size, fmt, state: "ready", quality: 75, reduce: 50, level: "recommended", maxDim: 0, optionsOpen: false };
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
  // as: [id, label, apiFormat] to get a compressed picture in another format ("Download as").
  function requestConversion(row, onProgress, as){
    return new Promise((resolve, reject) => {
      const t = as ? [as[0], as[1], as[2]] : row.targets.find(x => x[0] === row.target);
      const form = new FormData();
      form.append("file", row.file);
      form.append("format", t ? t[2] : row.target);
      if (as) form.append("compress", "1");
      form.append("quality", String(row.quality));
      if (compressMode) form.append("reduce", String(row.reduce)); // "make it N% smaller"
      if (compressMode && isPdfRow(row)) form.append("level", row.level);
      if (row.ocr) { form.append("ocr", "1"); form.append("lang", row.ocrLang || "eng"); }
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
        let notes = [];
        try { notes = JSON.parse(decodeURIComponent(xhr.getResponseHeader("X-Convert-Notes") || "")) || []; } catch (e) { notes = []; }
        resolve({ blob: xhr.response, ext, name, notes });
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
        row.state = "finished"; row.blob = res.blob; row.outExt = res.ext; row.outName = res.name; row.outSize = res.blob.size; row.notes = res.notes || [];
        // Compressing must never hand back a bigger file: keep the original when re-encoding
        // did not help (unless the visitor asked for a resize, which changes the image).
        if (compressMode && !row.maxDim && row.outSize >= row.size) { row.blob = row.file; row.outSize = row.size; }
      }).catch(err => {
        row.state = "error"; row.error = err.message;
      }).finally(() => { active--; render(); pump(); });
    }
  }

  // PDF to Word / HTML: ask first whether to read the PDF's own text (No OCR) or to recognise
  // scanned pages with OCR, as other PDF sites do, and in which language the scan is written.
  const DOC_EXTS = ["docx", "doc", "odt", "rtf", "html"];
  const isPdfToDoc = r => !compressMode && isPdfRow(r) && DOC_EXTS.includes(r.target);
  const OCR_LANGS = [["eng", "English"], ["spa", "Spanish"], ["fra", "French"], ["deu", "German"], ["ita", "Italian"], ["por", "Portuguese"], ["nld", "Dutch"]];
  let ocrDlg = null;
  function askOcr(toHtml){
    if (!ocrDlg) {
      ocrDlg = document.createElement("dialog");
      ocrDlg.className = "pdf-choice ocr-choice";
      ocrDlg.setAttribute("aria-labelledby", "ocrChoiceTitle");
      ocrDlg.innerHTML = `<form method="dialog">
        <button class="pdf-choice-x" value="cancel" aria-label="Close">&times;</button>
        <h2 id="ocrChoiceTitle"></h2>
        <p class="pdf-choice-sub">Can you select the text in your PDF?</p>
        <label class="ocr-opt"><input type="radio" name="ocr" value="0" checked><span><strong>No OCR</strong>
          <span class="ocr-what" data-no></span></span></label>
        <label class="ocr-opt"><input type="radio" name="ocr" value="1"><span><strong>OCR <em class="ocr-free">Free</em></strong>
          <span class="ocr-what" data-yes></span>
          <span class="ocr-lang">Language of the scan <select name="lang" aria-label="Language of the scanned text">${OCR_LANGS.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select></span></span></label>
        <button class="btn btn-brand ocr-go" value="go"></button>
      </form>`;
      document.body.appendChild(ocrDlg);
    }
    const what = toHtml ? "a web page (HTML)" : "an editable Word file";
    ocrDlg.querySelector("h2").textContent = toHtml ? "PDF to HTML" : "PDF to Word";
    ocrDlg.querySelector("[data-no]").textContent = `Uses the text inside the PDF: PDFs whose text you can select become ${what} with the same fonts, pictures, tables and layout. Scanned pages are not read.`;
    ocrDlg.querySelector("[data-yes]").textContent = `Also reads scanned pages (pictures of text) with text recognition, so their text becomes editable. Pages that already have text keep it. Slower.`;
    ocrDlg.querySelector(".ocr-go").textContent = toHtml ? "Convert to HTML" : "Convert to Word";
    ocrDlg.returnValue = "cancel";
    return new Promise(resolve => {
      ocrDlg.addEventListener("close", () => resolve(ocrDlg.returnValue === "go"
        ? { ocr: ocrDlg.querySelector('input[name="ocr"]:checked').value === "1", lang: ocrDlg.querySelector('select[name="lang"]').value } : null), { once: true });
      ocrDlg.showModal();
      ocrDlg.querySelector(".ocr-go").focus();
    });
  }

  convertAllBtn.addEventListener("click", async () => {
    const ready = rows.filter(r => r.state === "ready");
    const docs = ready.filter(isPdfToDoc);
    if (docs.length) {
      const choice = await askOcr(docs.every(r => r.target === "html"));
      if (choice === null) return;
      ready.forEach(r => { r.ocr = choice.ocr && isPdfToDoc(r); r.ocrLang = r.ocr ? choice.lang : ""; });
    }
    ready.filter(r => r.state === "ready").forEach(r => { r.state = "waiting"; r.optionsOpen = false; queue.push(r); });
    render(); pump();
  });

  function save(blob, name){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Several images converted to PDF: ask whether to download one PDF (every image a page, in
  // the order of the list) or separate PDFs. The PDFs are joined here in the browser.
  let pdfLibLoad = null;
  const loadPdfLib = () => pdfLibLoad || (pdfLibLoad = new Promise((resolve, reject) => {
    if (window.PDFLib) return resolve(window.PDFLib);
    const s = document.createElement("script");
    s.src = "/vendor/pdf-lib.min.js";
    s.onload = () => resolve(window.PDFLib);
    s.onerror = () => { pdfLibLoad = null; reject(new Error("The PDF tool could not be loaded. Check your connection and try again.")); };
    document.head.appendChild(s);
  }));
  async function joinPdfs(list){
    const { PDFDocument } = await loadPdfLib();
    const out = await PDFDocument.create();
    for (const r of list) {
      const src = await PDFDocument.load(await r.blob.arrayBuffer(), { ignoreEncryption: true });
      (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
    }
    return new Blob([await out.save()], { type: "application/pdf" });
  }
  const isImagesToPdf = done => !compressMode && done.length > 1
    && done.every(r => r.outExt === "pdf" && r.fmt && catOfExt(r.fmt.ext) === "image");
  let pdfDlg = null;
  function askPdfMode(n){
    if (!pdfDlg) {
      pdfDlg = document.createElement("dialog");
      pdfDlg.className = "pdf-choice";
      pdfDlg.setAttribute("aria-labelledby", "pdfChoiceTitle");
      pdfDlg.innerHTML = `<form method="dialog">
        <button class="pdf-choice-x" value="cancel" aria-label="Close">&times;</button>
        <h2 id="pdfChoiceTitle">How do you want your PDF?</h2>
        <p class="pdf-choice-sub"></p>
        <div class="pdf-choice-opts">
          <button class="pdf-choice-opt" value="one"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 6h15l9 9v27H14z" fill="#FDE8E7" stroke="#E5322D" stroke-width="2.4" stroke-linejoin="round"/><path d="M29 6v9h9" fill="none" stroke="#E5322D" stroke-width="2.4" stroke-linejoin="round"/><path d="M19 23h14M19 28h14M19 33h9" stroke="#E5322D" stroke-width="2.4" stroke-linecap="round"/></svg>
            <strong>One PDF</strong><span class="one-text"></span></button>
          <button class="pdf-choice-opt" value="many"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 10h11l6 6v18H8z" fill="#EEF2FF" stroke="#4F46E5" stroke-width="2.4" stroke-linejoin="round"/><path d="M23 16h11l6 6v18H23z" fill="#EEF2FF" stroke="#4F46E5" stroke-width="2.4" stroke-linejoin="round"/></svg>
            <strong>Separate PDFs</strong><span class="many-text"></span></button>
        </div></form>`;
      document.body.appendChild(pdfDlg);
    }
    pdfDlg.querySelector(".pdf-choice-sub").textContent = `You converted ${n} images to PDF.`;
    pdfDlg.querySelector(".one-text").textContent = `All ${n} images in one file, one per page, in the order of the list.`;
    pdfDlg.querySelector(".many-text").textContent = `${n} PDF files, downloaded together in a ZIP.`;
    pdfDlg.returnValue = "cancel";
    return new Promise(resolve => {
      pdfDlg.addEventListener("close", () => resolve(pdfDlg.returnValue), { once: true });
      pdfDlg.showModal();
      pdfDlg.querySelector('[value="one"]').focus();
    });
  }

  // Download all: one ZIP with every finished file (names made unique).
  zipBtn.addEventListener("click", async () => {
    const done = rows.filter(r => r.state === "finished");
    if (!done.length) return;
    if (done.length === 1) return save(done[0].blob, done[0].outName);
    if (isImagesToPdf(done)) {
      const mode = await askPdfMode(done.length);
      if (mode === "cancel" || !mode) return;
      if (mode === "one") {
        const label = zipBtn.lastChild.textContent;
        zipBtn.disabled = true; zipBtn.lastChild.textContent = "Joining\u2026";
        try {
          save(await joinPdfs(done), done[0].outName.replace(/\.pdf$/i, "") + "-combined.pdf");
          track({ e: "combine", p: location.pathname, d: done.length + " images" });
        } catch (e) {
          barStatus.innerHTML = `<span class="err-text">${esc(e.message || "The PDFs could not be joined.")}</span>`;
        } finally { zipBtn.disabled = false; zipBtn.lastChild.textContent = label; }
        return;
      }
    }
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
        + (row.notes && row.notes.length ? `<span class="warn-text" role="note">${row.notes.map(esc).join("<br>")}</span>` : "")
        + (compressMode ? `<span class="muted"> · ${fmtBytes(row.size)} &rarr; ${fmtBytes(row.outSize)}</span>`
          + (pct > 0 ? `<span class="saved">${pct}% smaller</span>` : `<span class="muted"> · already well compressed</span>`) : "");
    }
    else if (row.state === "error") text = `<span class="err-text">${esc(row.error)}</span>`;
    const action = row.state === "finished" ? `<button class="btn btn-success btn-sm dl-btn" type="button">${DL_ICON}Download</button>` : "";
    return `<div class="file-status"><span class="badge-state ${cls}">${label}</span><div class="status-text">${text}</div>${action}</div>${alsoHtml(row)}${shrinkedHtml(row)}`;
  }
  // Converter pages: after converting, the results can be made smaller in one go. "Compress"
  // (next to Download all) opens a panel: tick the files, pick how much smaller (each file by that
  // percentage of its own size; PDFs by compression level) and compress them all at once. The
  // compressed files replace the results, so Download / Download all give the smaller files.
  const SHRINK_API = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp", avif: "avif", gif: "gif", tif: "tiff", tiff: "tiff", pdf: "pdf" };
  const shrinkable = r => !compressMode && r.state === "finished" && !!SHRINK_API[r.outExt];
  const shrinkBtn = document.getElementById("shrinkBtn");
  const shrinkPanel = document.getElementById("shrinkPanel");
  const shrinkState = { reduce: 30, level: "recommended", busy: false, picked: new Set() };
  function shrinkedHtml(row){
    if (!row.shrunk) return "";
    const pct = Math.round((1 - row.shrunk.to / row.shrunk.from) * 100);
    return `<div class="shrunk-line">${COMPRESS_ICON}Compressed: ${fmtBytes(row.shrunk.from)} &rarr; ${fmtBytes(row.shrunk.to)}`
      + (pct > 0 ? ` <span class="saved">${pct}% smaller</span>` : ` <span class="muted">· already well compressed</span>`) + `</div>`;
  }
  function panelHtml(){
    const list = rows.filter(shrinkable);
    const st = shrinkState;
    const imgs = list.filter(r => r.outExt !== "pdf"), pdfs = list.filter(r => r.outExt === "pdf");
    const sizeOf = r => (r.orig || r.blob).size;
    const items = list.map(r => {
      const est = r.outExt === "pdf" ? "PDF: smaller by level" : `about ${fmtBytes(sizeOf(r) * (1 - st.reduce / 100))}`;
      return `<label class="sp-item"><input type="checkbox" data-pick="${r.id}"${st.picked.has(r.id) ? " checked" : ""}${st.busy ? " disabled" : ""}>
        <span class="sp-name">${esc(r.outName)}</span><span class="sp-size">${fmtBytes(sizeOf(r))} &rarr; <span data-est="${r.id}">${est}</span></span></label>`;
    }).join("");
    const n = list.filter(r => st.picked.has(r.id)).length;
    return `<div class="sp-head"><strong>${COMPRESS_ICON}Compress your files</strong><button type="button" class="sp-x" data-sp-close aria-label="Close"${st.busy ? " disabled" : ""}>&times;</button></div>
      <div class="sp-controls">
        ${imgs.length ? `<label class="sp-range">Make each image smaller by <input type="range" min="10" max="90" step="5" value="${st.reduce}" data-sp-reduce${st.busy ? " disabled" : ""}><strong data-sp-val>${st.reduce}%</strong></label>` : ""}
        ${pdfs.length ? `<label class="sp-level">PDF compression <select data-sp-level${st.busy ? " disabled" : ""}>${PDF_LEVELS.map(([v, l]) => `<option value="${v}"${v === st.level ? " selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
      </div>
      <p class="sp-hint">Each file is made smaller by this share of its own size: 30% of a 1 MB image leaves about 700 KB, 30% of a 2 MB image about 1.4 MB.</p>
      <div class="sp-all"><label><input type="checkbox" data-pick-all${n === list.length ? " checked" : ""}${st.busy ? " disabled" : ""}> Select all (${list.length})</label></div>
      <div class="sp-list">${items}</div>
      <div class="sp-foot"><span class="sp-msg" data-sp-msg>${st.msg || ""}</span>
        <button type="button" class="btn btn-ghost" data-sp-close${st.busy ? " disabled" : ""}>Cancel</button>
        <button type="button" class="btn btn-brand" data-sp-go${st.busy || !n ? " disabled" : ""}>${st.busy ? '<span class="spinner" aria-hidden="true"></span>Compressing…' : `${COMPRESS_ICON}Compress ${n} file${n === 1 ? "" : "s"}`}</button></div>`;
  }
  function drawPanel(){ if (!shrinkPanel.hidden) shrinkPanel.innerHTML = panelHtml(); }
  function openPanel(){
    shrinkState.picked = new Set(rows.filter(shrinkable).map(r => r.id));
    shrinkState.msg = "";
    shrinkPanel.hidden = false;
    drawPanel();
    shrinkPanel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }
  async function shrinkOne(row){
    const src = row.orig || row.blob;  // always from the converted file, never compressed twice
    const form = new FormData();
    form.append("file", src, row.orig ? row.origName : row.outName);
    form.append("format", SHRINK_API[row.outExt]);
    form.append("quality", "75");
    form.append("maxDim", "0");
    if (row.outExt === "pdf") form.append("level", shrinkState.level); else form.append("reduce", String(shrinkState.reduce));
    const res = await fetch("/api/compress", { method: "POST", body: form });
    if (!res.ok) {
      let msg = res.status === 429 ? "Too many files in a short time. Please wait a few minutes." : "could not be made smaller";
      try { msg = (await res.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    let blob = await res.blob();
    if (!row.orig) { row.orig = row.blob; row.origName = row.outName; }
    if (blob.size >= src.size) blob = src;  // never hand back a bigger file
    row.blob = blob;
    row.outName = blob === src ? row.origName : row.origName.replace(/(\.[^.]+)$/, "-compressed$1");
    row.shrunk = { from: src.size, to: blob.size };
  }
  async function shrinkPicked(){
    const list = rows.filter(r => shrinkable(r) && shrinkState.picked.has(r.id));
    if (!list.length) return;
    shrinkState.busy = true; shrinkState.msg = `0 of ${list.length} done`; drawPanel();
    let done = 0, failed = 0;
    const work = list.slice();
    const worker = async () => {
      while (work.length) {
        const row = work.shift();
        try { await shrinkOne(row); } catch (e) { failed++; }
        done++;
        shrinkState.msg = `${done} of ${list.length} done`;
        drawPanel();
      }
    };
    await Promise.all([worker(), worker()]);
    const before = list.reduce((n, r) => n + (r.shrunk ? r.shrunk.from : 0), 0), after = list.reduce((n, r) => n + (r.shrunk ? r.shrunk.to : 0), 0);
    shrinkState.busy = false;
    shrinkPanel.hidden = true;
    render();
    barStatus.innerHTML = `<span class="done-check" aria-hidden="true">&#10003;</span> ${list.length - failed} file${list.length - failed === 1 ? "" : "s"} compressed`
      + (before > after ? ` &middot; saved ${fmtBytes(before - after)}` : "") + (failed ? ` &middot; ${failed} failed` : "");
  }
  if (shrinkBtn && shrinkPanel) {
    shrinkBtn.addEventListener("click", () => (shrinkPanel.hidden ? openPanel() : (shrinkPanel.hidden = true)));
    shrinkPanel.addEventListener("input", e => {
      if (!e.target.matches("[data-sp-reduce]")) return;
      shrinkState.reduce = Number(e.target.value);
      shrinkPanel.querySelector("[data-sp-val]").textContent = e.target.value + "%";
      rows.filter(shrinkable).forEach(r => {
        const el = shrinkPanel.querySelector(`[data-est="${r.id}"]`);
        if (el && r.outExt !== "pdf") el.textContent = `about ${fmtBytes((r.orig || r.blob).size * (1 - shrinkState.reduce / 100))}`;
      });
    });
    shrinkPanel.addEventListener("change", e => {
      const t = e.target;
      if (t.matches("[data-sp-level]")) shrinkState.level = t.value;
      else if (t.matches("[data-pick-all]")) { shrinkState.picked = new Set(t.checked ? rows.filter(shrinkable).map(r => r.id) : []); drawPanel(); }
      else if (t.matches("[data-pick]")) { const id = Number(t.dataset.pick); if (t.checked) shrinkState.picked.add(id); else shrinkState.picked.delete(id); drawPanel(); }
    });
    shrinkPanel.addEventListener("click", e => {
      if (e.target.closest("[data-sp-close]")) shrinkPanel.hidden = true;
      else if (e.target.closest("[data-sp-go]")) shrinkPicked();
    });
  }
  // Compress pages for images: the compressed picture can also be downloaded in another format.
  let ALSO = [];
  try { ALSO = JSON.parse(tool.dataset.also || "[]"); } catch (e) { ALSO = []; }
  function alsoHtml(row){
    if (!compressMode || !ALSO.length || row.state !== "finished" || isPdfRow(row)) return "";
    const own = row.fmt ? row.fmt.ext : "";
    const chips = ALSO.filter(a => a[0] !== own && !(own === "jpeg" && a[0] === "jpg")).map(([id, label]) => {
      const a = (row.also || {})[id] || {};
      const inner = a.state === "busy" ? `<span class="spinner" aria-hidden="true"></span>${esc(label)}`
        : a.state === "done" ? `${DL_ICON}${esc(label)} <span class="also-size">${fmtBytes(a.size)}</span>`
        : esc(label);
      return `<button type="button" class="also-btn${a.state === "error" ? " is-err" : ""}" data-as="${esc(id)}"${a.state === "busy" ? " disabled" : ""}${a.state === "error" ? ` title="${esc(a.error)}"` : ""}>${inner}</button>`;
    }).join("");
    return `<div class="also-row"><span class="also-label">Download as:</span>${chips}</div>`;
  }
  fileList.addEventListener("click", e => {
    const b = e.target.closest(".also-btn");
    if (!b) return;
    const row = rows.find(r => String(r.id) === b.closest("[data-row]").dataset.row);
    const as = ALSO.find(a => a[0] === b.dataset.as);
    if (!row || !as) return;
    row.also = row.also || {};
    const a = row.also[as[0]];
    if (a && a.state === "done") return save(a.blob, a.name);
    if (a && a.state === "busy") return;
    row.also[as[0]] = { state: "busy" };
    render();
    requestConversion(row, () => {}, as).then(res => {
      row.also[as[0]] = { state: "done", blob: res.blob, name: res.name, size: res.blob.size };
      save(res.blob, res.name);
    }).catch(err => {
      row.also[as[0]] = { state: "error", error: err.message };
    }).finally(render);
  });
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
      const showOptions = (isImageTarget(row.target) || isPdfRow(row)) && row.state === "ready";
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
    const options = row.optionsOpen && row.state === "ready" && compressMode && isPdfRow(row) ? `<div class="file-options">
        <label>Compression <select class="lvl-sel">${PDF_LEVELS.map(([v, l]) => `<option value="${v}"${v === row.level ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>` : row.optionsOpen && row.state === "ready" ? `<div class="file-options">
        ${compressMode
          ? `<label>Reduce size by <input type="range" class="r-range" min="10" max="90" step="5" value="${row.reduce}"><span class="q-val">${row.reduce}%</span></label>`
          : `<label>Quality <input type="range" class="q-range" min="10" max="100" value="${row.quality}"><span class="q-val">${row.quality}%</span></label>`}
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
  // PDF compression levels (the server maps them to Ghostscript settings and picture resolution)
  const PDF_LEVELS = [["low", "Light (best quality, smaller saving)"], ["recommended", "Recommended (good quality, good saving)"],
    ["strong", "Strong (smaller file)"], ["extreme", "Extreme (smallest file, lower picture quality)"]];
  const isPdfRow = row => !!(row.fmt && row.fmt.ext === "pdf");
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
    const r = el.querySelector(".r-range");
    if (r) r.addEventListener("input", () => { row.reduce = Number(r.value); el.querySelector(".q-val").textContent = r.value + "%"; });
    const lvl = el.querySelector(".lvl-sel");
    if (lvl) lvl.addEventListener("change", () => { row.level = lvl.value; });
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
    if (shrinkBtn) {
      shrinkBtn.hidden = busy > 0 || !rows.some(shrinkable);
      if (shrinkBtn.hidden && shrinkPanel && !shrinkState.busy) shrinkPanel.hidden = true;
      drawPanel();
    }
    let status;
    if (busy) status = `<span class="spinner" aria-hidden="true"></span> ${compressMode ? "Compressing" : "Converting"} ${busy} file${busy > 1 ? "s" : ""}…`;
    else if (ready) status = `${ready} file${ready > 1 ? "s" : ""} ready`;
    else if (done) status = `<span class="done-check" aria-hidden="true">&#10003;</span> Done${failed ? ` &middot; ${failed} failed` : ""}`;
    else status = failed ? `${failed} file${failed > 1 ? "s" : ""} could not be converted` : "";
    if (done && !busy) window.dispatchEvent(new Event("ff:converted"));
    barStatus.innerHTML = status;
  }

  render();
})();
