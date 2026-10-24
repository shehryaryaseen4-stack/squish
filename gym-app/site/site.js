// Shared by every page of the sales website: header, footer, prices and Paddle checkout.
(function () {
  const { esc } = UI;
  const configPromise = fetch('/api/platform/config').then((r) => r.json());

  const money = (p) => new Intl.NumberFormat('en', { style: 'currency', currency: p.currency, maximumFractionDigits: p.amount % 1 ? 2 : 0 }).format(p.amount);

  function header(cfg) {
    const el = document.querySelector('[data-site-header]');
    if (!el) return;
    el.className = 'site-head';
    el.innerHTML = `<div class="wrap-site">
      <a class="logo" href="/"><i>${esc(cfg.productName.charAt(0))}</i>${esc(cfg.productName)}</a>
      <nav class="site-nav" id="site-nav"><a href="/#features">Features</a><a href="/#pricing">Pricing</a><a href="/download">Download</a><a href="/#faq">FAQ</a></nav>
      <span class="grow"></span>
      <div class="acts"><a class="btn btn-ghost hide-sm" href="/login">Log in</a><a class="btn btn-primary" href="/signup">Start free trial</a>
        <button class="icon-btn menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">${icon('more')}</button></div></div>`;
    const btn = el.querySelector('.menu-btn');
    btn.addEventListener('click', () => {
      const nav = el.querySelector('.site-nav');
      nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
  }

  function footer(cfg) {
    const el = document.querySelector('[data-site-footer]');
    if (!el) return;
    el.className = 'site-foot';
    const contact = [cfg.supportEmail && `<a href="mailto:${esc(cfg.supportEmail)}">${esc(cfg.supportEmail)}</a>`, cfg.supportWhatsapp && `<a href="https://wa.me/${esc(cfg.supportWhatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>`].filter(Boolean).join(' · ');
    el.innerHTML = `<div class="wrap-site"><div><a class="logo" href="/"><i>${esc(cfg.productName.charAt(0))}</i>${esc(cfg.productName)}</a>
      <p style="margin-top:10px">© ${new Date().getFullYear()} ${esc(cfg.companyName || cfg.productName)}${contact ? ` · ${contact}` : ''}</p></div>
      <nav><a href="/#pricing">Pricing</a><a href="/download">Download</a><a href="/login">Log in</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refund">Refunds</a></nav></div>`;
  }

  function fill(cfg) {
    document.querySelectorAll('[data-product]').forEach((x) => { x.textContent = cfg.productName; });
    document.querySelectorAll('[data-company]').forEach((x) => { x.textContent = cfg.companyName || cfg.productName; });
    document.querySelectorAll('[data-support]').forEach((x) => { x.textContent = cfg.supportEmail || 'our support email'; });
    document.querySelectorAll('[data-trial]').forEach((x) => { x.textContent = cfg.trialDays; });
    document.querySelectorAll('[data-price]').forEach((x) => { const p = cfg.prices[x.dataset.price]; if (p) x.textContent = money(p); });
    document.title = document.title.replace('{product}', cfg.productName);
  }

  // Fade sections in as they scroll into view.
  function reveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) return items.forEach((x) => x.classList.add('in'));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -60px 0px' });
    items.forEach((x) => io.observe(x));
  }

  // Paddle.js is loaded only when someone is about to pay.
  let paddleReady = null;
  function paddle(onDone) {
    paddleReady ||= configPromise.then((cfg) => new Promise((resolve, reject) => {
      if (!cfg.paddle) return reject(new Error('Online payment is not switched on yet.'));
      const s = document.createElement('script');
      s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      s.onload = () => {
        if (cfg.paddle.environment === 'sandbox') window.Paddle.Environment.set('sandbox');
        window.Paddle.Initialize({
          token: cfg.paddle.clientToken,
          eventCallback: (e) => { if (e.name === 'checkout.completed' && paddle.onDone) paddle.onDone(e.data); },
        });
        resolve(window.Paddle);
      };
      s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
      document.head.append(s);
    }));
    paddle.onDone = onDone;
    return paddleReady;
  }

  async function checkout({ plan, customData = {}, email, onDone }) {
    const cfg = await configPromise;
    const price = cfg.prices[plan];
    if (!cfg.paddle || !price?.priceId) return manualPayment(cfg, plan);
    try {
      const P = await paddle(onDone);
      P.Checkout.open({ items: [{ priceId: price.priceId, quantity: 1 }], customData, ...(email ? { customer: { email } } : {}), settings: { displayMode: 'overlay', theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' } });
    } catch (err) {
      UI.toast(err.message, 'bad');
    }
  }

  // Before Paddle is set up, buyers pay by bank, JazzCash and so on, and the owner switches them on.
  function manualPayment(cfg, plan) {
    const wa = cfg.supportWhatsapp && `https://wa.me/${cfg.supportWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I want to buy ${cfg.productName} (${plan}).`)}`;
    UI.sheet({
      title: 'Pay and get started',
      html: `<p class="muted" style="line-height:1.6">Card payment is coming soon. Message us and we'll send you the payment details (bank transfer and local wallets are fine). We switch your account on as soon as it's paid.</p>
        <div style="display:grid;gap:10px;margin-top:18px">${wa ? `<a class="btn btn-primary btn-block" href="${esc(wa)}" target="_blank" rel="noopener">${icon('whatsapp')}Message on WhatsApp</a>` : ''}
        ${cfg.supportEmail ? `<a class="btn btn-ghost btn-block" href="mailto:${esc(cfg.supportEmail)}?subject=${encodeURIComponent(`${cfg.productName} purchase`)}">Email ${esc(cfg.supportEmail)}</a>` : ''}
        ${!wa && !cfg.supportEmail ? '<p class="muted">Contact details will appear here soon.</p>' : ''}</div>`,
    });
  }

  window.Site = { config: configPromise, money, checkout, esc };

  configPromise.then((cfg) => {
    header(cfg);
    footer(cfg);
    fill(cfg);
    reveal();
    document.dispatchEvent(new CustomEvent('site:ready', { detail: cfg }));
  }).catch(() => UI.toast('Could not load the page. Please refresh.', 'bad'));
})();
