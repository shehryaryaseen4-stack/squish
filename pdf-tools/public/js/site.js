// Runs on every page: mobile menu, tool search, homepage drop box, ad slots. Kept tiny.
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ------------------------------------------------------------ mobile menu
  var toggle = $('.menu-toggle');
  var menu = $('#mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { toggle.click(); toggle.focus(); }
    });
  }

  // ----------------------------------------------------- all tools: search
  var search = $('[data-tool-search]');
  if (search) {
    var cards = $$('[data-tool-card]');
    var blocks = $$('[data-cat-block]');
    var chips = $$('[data-filter]');
    var status = $('[data-search-status]');
    var empty = $('[data-search-empty]');
    var filter = 'all';
    var norm = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); };
    var apply = function () {
      var words = norm(search.value).split(/\s+/).filter(Boolean);
      var shown = 0;
      cards.forEach(function (c) {
        var hay = c.dataset.name + ' ' + c.dataset.keywords;
        var ok = (filter === 'all' || c.dataset.cat === filter) && words.every(function (w) { return hay.indexOf(w) !== -1; });
        c.hidden = !ok;
        if (ok) shown++;
      });
      blocks.forEach(function (b) { b.hidden = !$$('[data-tool-card]:not([hidden])', b).length; });
      empty.hidden = shown > 0;
      status.textContent = words.length || filter !== 'all' ? shown + (shown === 1 ? ' tool' : ' tools') + ' found' : '';
      var url = new URL(location.href);
      if (search.value) url.searchParams.set('q', search.value); else url.searchParams.delete('q');
      history.replaceState(null, '', url);
    };
    search.addEventListener('input', apply);
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        filter = chip.dataset.filter;
        chips.forEach(function (c) { var on = c === chip; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
        apply();
      });
    });
    var clear = $('[data-search-clear]');
    if (clear) clear.addEventListener('click', function () { search.value = ''; chips[0].click(); search.focus(); });
    var q = new URL(location.href).searchParams.get('q');
    if (q) { search.value = q; apply(); }
  }

  // ------------------------------------------------ homepage drop + suggest
  var home = $('[data-home-drop]');
  if (home) {
    var zone = $('[data-dropzone]', home);
    var input = $('[data-input]', home);
    var box = $('[data-suggest]', home);
    var tools = JSON.parse(($('#suggest-data') || {}).textContent || '[]');
    var extOf = function (n) { var m = /\.([a-z0-9]+)$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
    var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var picked = [];
    var show = function (files) {
      picked = files;
      var exts = files.map(function (f) { return extOf(f.name); });
      var fits = tools.filter(function (t) {
        return exts.every(function (e) { return t.exts.indexOf(e) !== -1; }) && (files.length === 1 || t.multiple);
      }).slice(0, 12);
      var label = files.length === 1 ? files[0].name : files.length + ' files selected';
      if (!fits.length) {
        box.innerHTML = '<p class="hero-suggest__file">' + esc(label) + '</p><p>We don’t have a tool for this kind of file yet. ' +
          (files.length > 1 ? 'Try choosing files of the same type, or one file at a time. ' : '') + '<a href="/tools">See all tools</a>.</p>';
      } else {
        box.innerHTML = '<p class="hero-suggest__file"><svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg><span>' + esc(label) + '</span></p>' +
          '<p class="hint" style="margin:0 0 10px">What would you like to do?</p><div class="hero-suggest__grid">' +
          fits.map(function (t) { return '<button type="button" class="suggest-btn" data-go="' + t.slug + '">' + t.icon + '<span>' + esc(t.name) + '</span></button>'; }).join('') + '</div>';
      }
      box.hidden = false;
      var first = $('button', box);
      if (first) first.focus({ preventScroll: true });
    };
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-go]');
      if (!btn) return;
      var go = function () { location.href = '/' + btn.dataset.go + '#handoff'; };
      btn.disabled = true;
      import('/js/lib/handoff.js').then(function (m) { return m.putFiles(picked); }).then(go, function () { location.href = '/' + btn.dataset.go; });
    });
    $('[data-pick]', home).addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { if (input.files.length) show(Array.prototype.slice.call(input.files)); input.value = ''; });
    var depth = 0;
    home.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; zone.classList.add('is-over'); });
    home.addEventListener('dragover', function (e) { e.preventDefault(); });
    home.addEventListener('dragleave', function () { if (--depth <= 0) { depth = 0; zone.classList.remove('is-over'); } });
    home.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; zone.classList.remove('is-over');
      var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      if (files.length) show(files);
    });
  }

  // -------------------------------------------------------------- AdSense
  if ($('ins.adsbygoogle')) {
    $$('ins.adsbygoogle').forEach(function () { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ad blocked */ } });
  }
})();
