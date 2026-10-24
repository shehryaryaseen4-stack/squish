// What each page of the sales website does. The page is named by <body data-page>.
(function () {
  const { esc, toast, busy, sheet } = UI;
  const q = new URLSearchParams(location.search);
  const $ = (sel, el = document) => el.querySelector(sel);

  // <li data-icon="check">Text</li> gets its icon in front.
  document.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
  document.querySelectorAll('[data-host]').forEach((el) => { el.textContent = `${location.host}/g/`; });

  const json = async (path, opts = {}) => {
    const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
    return data;
  };
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  const copyBtn = (text) => `<button class="icon-btn" type="button" data-copy="${esc(text)}" aria-label="Copy">${icon('copy')}</button>`;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    navigator.clipboard?.writeText(b.dataset.copy).then(() => toast('Copied'), () => toast('Select the text and copy it', 'bad'));
  });

  const pages = {
    async home() {
      const cfg = await Site.config;
      const m = cfg.prices.monthly;
      const y = cfg.prices.yearly;
      if (m.currency === y.currency && m.amount * 12 > y.amount) {
        const note = document.querySelector('[data-yearly-note]');
        if (note) note.textContent = `Save ${Site.money({ amount: m.amount * 12 - y.amount, currency: y.currency })} a year`;
      }
      $('[data-buy-license]')?.addEventListener('click', () => sheet({
        title: 'Buy the Windows app',
        html: `<p class="muted" style="line-height:1.6">Your licence key appears right after payment and is emailed with your receipt.</p>
          <form class="form-site" style="margin-top:16px" novalidate><label class="field"><span>Your email</span><input class="input" name="email" type="email" autocomplete="email" required></label>
          <label class="field"><span>Gym name</span><input class="input" name="name" maxlength="80" autocomplete="organization"></label>
          <button class="btn btn-primary btn-block" style="height:50px">Continue to payment · ${esc(Site.money(cfg.prices.license))}</button></form>`,
        onMount: (el, close) => el.querySelector('form').addEventListener('submit', (e) => {
          e.preventDefault();
          const f = e.target;
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) return toast('Enter a valid email address', 'bad');
          close();
          Site.checkout({
            plan: 'license', email: f.email.value.trim(), customData: { email: f.email.value.trim(), name: f.name.value.trim() },
            onDone: (d) => { location.href = `/thanks?type=license&txn=${encodeURIComponent(d.transaction_id)}`; },
          });
        }),
      }));
    },

    async signup() {
      const cfg = await Site.config;
      const f = $('#signup');
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const guess = cfg.countries.find((c) => c.timeZone === tz) || cfg.countries.find((c) => c.code !== 'OTHER' && tz.split('/')[0] === c.timeZone.split('/')[0] && tz === c.timeZone) || cfg.countries.find((c) => c.code === 'OTHER');
      f.country.innerHTML = cfg.countries.map((c) => `<option value="${c.code}" ${c === guess ? 'selected' : ''}>${esc(c.name)}${c.code === 'OTHER' ? '' : ` (${c.currency})`}</option>`).join('');
      const country = () => cfg.countries.find((c) => c.code === f.country.value);
      const feeHint = () => {
        const c = country();
        f.monthlyFee.placeholder = String(c.monthly);
        $('[data-fee-hint]').textContent = `In ${c.currency}. Used to fill in your plans; change them any time.`;
      };
      f.country.addEventListener('change', feeHint);
      feeHint();

      let slugEdited = false;
      let checkTimer = null;
      const hint = $('[data-slug-hint]');
      const checkSlug = () => {
        clearTimeout(checkTimer);
        const s = f.slug.value;
        if (!s) { hint.className = 'hint-line'; hint.textContent = 'Members and staff open the app here.'; return; }
        checkTimer = setTimeout(async () => {
          const r = await json(`/api/platform/slug?slug=${encodeURIComponent(s)}`).catch(() => null);
          if (!r || f.slug.value !== s) return;
          hint.className = `hint-line ${r.ok ? 'ok' : 'bad'}`;
          hint.textContent = r.ok ? `✓ ${location.host}/g/${s} is free` : `${r.error}${r.suggestion ? ` · try ${r.suggestion}` : ''}`;
        }, 300);
      };
      f.gymName.addEventListener('input', () => { if (!slugEdited) { f.slug.value = slugify(f.gymName.value); checkSlug(); } });
      f.slug.addEventListener('input', () => { slugEdited = true; f.slug.value = slugify(f.slug.value); checkSlug(); });

      f.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!f.gymName.value.trim()) return toast('Enter your gym name', 'bad');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) return toast('Enter a valid email address', 'bad');
        if (!/^\d{4,8}$/.test(f.ownerPin.value)) return toast('The owner PIN must be 4 to 8 digits', 'bad');
        if (f.ownerPin.value !== f.pin2.value) return toast('The two PINs are different', 'bad');
        if (!f.terms.checked) return toast('Please agree to the terms', 'bad');
        busy(f.querySelector('[type=submit]'), async () => {
          try {
            const c = country();
            const r = await json('/api/platform/signup', {
              method: 'POST',
              body: JSON.stringify({
                gymName: f.gymName.value.trim(), slug: f.slug.value || undefined, country: c.code, timeZone: c.timeZone === tz || c.code === 'OTHER' ? tz : c.timeZone,
                monthlyFee: f.monthlyFee.value ? Number(f.monthlyFee.value) : undefined, email: f.email.value.trim(), phone: f.phone.value.trim(), ownerPin: f.ownerPin.value, sample: f.sample.checked,
              }),
            });
            const admin = `${location.origin}${r.adminUrl}`;
            const member = `${location.origin}${r.memberUrl}`;
            $('#signup-card').innerHTML = `<div class="done"><div class="big-ic">${icon('check')}</div><h1>Your gym is ready!</h1>
              <p class="lead">Your free trial runs until <b>${new Date(r.trialEnds).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</b>. Save these two links.</p>
              <div class="link-box"><div class="tx"><b>Staff dashboard</b><code>${esc(admin)}</code></div>${copyBtn(admin)}</div>
              <div class="link-box"><div class="tx"><b>Member app</b><code>${esc(member)}</code></div>${copyBtn(member)}</div>
              <div style="display:grid;gap:10px;margin-top:22px"><a class="btn btn-primary btn-block" style="height:52px" href="${esc(r.adminUrl)}">Open my dashboard</a>
              <a class="btn btn-ghost btn-block" href="/billing?gym=${encodeURIComponent(r.slug)}">${q.get('plan') ? 'Subscribe now' : 'See plans'}</a></div>
              <p class="muted" style="margin-top:16px;font-size:14px">Sign in with the owner PIN you just chose.</p></div>`;
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch (err) {
            toast(err.message, 'bad');
          }
        });
      });
    },

    login() {
      const f = $('#find');
      let to = 'admin';
      f.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => { to = b.dataset.to; }));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const slug = slugify(f.slug.value.replace(/^.*\/g\//, ''));
        try {
          await json(`/api/platform/gym?gym=${encodeURIComponent(slug)}`);
          location.href = `/g/${slug}/${to === 'admin' ? 'admin' : ''}`;
        } catch (err) {
          const h = $('[data-find-hint]');
          h.className = 'hint-line bad';
          h.textContent = err.status === 404 ? 'No gym with that address. Check the spelling.' : err.message;
        }
      });
    },

    async billing() {
      const cfg = await Site.config;
      const box = $('#billing');
      const slug = q.get('gym');
      if (!slug) {
        box.innerHTML = `<h1>Your subscription</h1><p class="lead">Enter your gym's web address to see or change its plan.</p>
          <form class="form-site" novalidate><div class="slug-field"><span>${esc(location.host)}/g/</span><input class="input" name="slug" required aria-label="Gym web address"></div><button class="btn btn-primary btn-block">Continue</button></form>`;
        box.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); location.search = `?gym=${encodeURIComponent(slugify(e.target.slug.value))}`; });
        return;
      }
      let gym;
      try { gym = await json(`/api/platform/gym?gym=${encodeURIComponent(slug)}`); } catch (err) {
        box.innerHTML = `<h1>Gym not found</h1><p class="lead">${esc(err.message)}</p><a class="btn btn-primary" href="/billing">Try again</a>`;
        return;
      }
      const a = gym.access;
      const until = a.until ? new Date(a.until).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      const pill = {
        trial: ['warn', `Free trial · ${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left`],
        paid: ['good', `Active · paid until ${until}`],
        grace: ['warn', 'Payment due · a few days left'],
        expired: ['bad', a.title || 'Ended'],
        suspended: ['bad', 'Paused'],
        free: ['good', 'Active'],
      }[a.state] || ['warn', a.state];
      const m = cfg.prices.monthly;
      const y = cfg.prices.yearly;
      const saving = m.currency === y.currency ? m.amount * 12 - y.amount : 0;
      box.innerHTML = `<span class="status-pill ${pill[0]}">${esc(pill[1])}</span>
        <h1 style="margin-top:12px">${esc(gym.name)}</h1><p class="lead">${gym.subscribed ? 'Your subscription is active and renews automatically. Paddle emails you a link to change your card or cancel.' : 'Choose a plan. You can cancel any time.'}</p>
        ${gym.subscribed ? '' : `<form novalidate><div class="plan-pick">
          <label><input type="radio" name="plan" value="monthly"><b>Monthly</b><div class="amt">${esc(Site.money(m))}<small> / month</small></div></label>
          <label><input type="radio" name="plan" value="yearly" checked><b>Yearly</b><div class="amt">${esc(Site.money(y))}<small> / year</small></div>${saving > 0 ? `<span class="save">Save ${esc(Site.money({ amount: saving, currency: y.currency }))}</span>` : ''}</label></div>
          <button class="btn btn-primary btn-block" style="height:52px">${icon('lock')}Subscribe securely</button>
          <p class="muted" style="font-size:13px;margin-top:12px;text-align:center">Payments are handled by Paddle. Cards, PayPal and local methods where available.</p></form>`}
        <a class="btn btn-ghost btn-block" style="margin-top:12px" href="/g/${esc(gym.slug)}/admin">Back to my dashboard</a>`;
      box.querySelector('form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        Site.checkout({
          plan: e.target.plan.value, email: gym.email, customData: { gymId: gym.id },
          onDone: (d) => { location.href = `/thanks?gym=${encodeURIComponent(gym.slug)}&txn=${encodeURIComponent(d.transaction_id)}`; },
        });
      });
    },

    async thanks() {
      const box = $('#thanks');
      const cfg = await Site.config;
      const txn = q.get('txn') || '';
      if (q.get('type') === 'license') {
        box.innerHTML = `<div class="big-ic">${icon('check')}</div><h1>Thank you!</h1><p class="lead">Getting your licence key…</p><div class="skel" style="height:70px;border-radius:16px"></div>`;
        for (let i = 0; i < 40; i++) {
          const r = await json(`/api/platform/licence?txn=${encodeURIComponent(txn)}`).catch(() => null);
          if (r?.ready) {
            box.innerHTML = `<div class="big-ic">${icon('check')}</div><h1>Here's your licence key</h1><p class="lead">Keep it safe. You'll type it into the Windows app once.</p>
              ${r.keys.map((k) => `<div class="key-box">${esc(k)}</div><button class="btn btn-ghost" data-copy="${esc(k)}">${icon('copy')}Copy key</button>`).join('')}
              <div style="display:grid;gap:10px;margin-top:22px">${cfg.downloads.windows ? `<a class="btn btn-primary btn-block" style="height:52px" href="${esc(cfg.downloads.windows)}">${icon('download')}Download for Windows</a>` : ''}<a class="btn btn-ghost btn-block" href="/download">Setup steps</a></div>`;
            return;
          }
          await new Promise((res) => setTimeout(res, 2000));
        }
        box.innerHTML = `<h1>Payment received</h1><p class="lead">Your key is taking longer than usual. It will reach you by email, or contact ${esc(cfg.supportEmail || 'support')} with your order number.</p>`;
        return;
      }
      const slug = q.get('gym');
      box.innerHTML = `<div class="big-ic">${icon('check')}</div><h1>Thank you!</h1><p class="lead">Your payment went through. Switching your gym on…</p>`;
      for (let i = 0; slug && i < 20; i++) {
        const g = await json(`/api/platform/gym?gym=${encodeURIComponent(slug)}`).catch(() => null);
        if (g && g.access.state === 'paid') break;
        await new Promise((res) => setTimeout(res, 2000));
      }
      box.innerHTML = `<div class="big-ic">${icon('check')}</div><h1>You're all set</h1><p class="lead">Your subscription is active. A receipt is on its way to your email.</p>
        ${slug ? `<a class="btn btn-primary btn-block" style="height:52px" href="/g/${esc(slug)}/admin">Open my dashboard</a>` : '<a class="btn btn-primary" href="/login">Open my gym</a>'}`;
    },

    async download() {
      const cfg = await Site.config;
      const d = cfg.downloads;
      const item = (href, ic, title, sub) => `<a class="dl" href="${esc(href || '#')}" ${href ? '' : 'aria-disabled="true"'}><span class="ic">${icon(ic)}</span><span><b>${title}</b><span>${href ? sub : 'Coming soon'}</span></span></a>`;
      $('#downloads').innerHTML = item(d.windows, 'tv', 'Windows app', 'For the front desk computer · .exe')
        + item(d.android, 'phone', 'Android app', 'For staff and members · .apk')
        + item(d.androidDemo, 'sparkles', 'Android demo', 'Try it with sample data, no account needed')
        + item('/login', 'store', 'Open in the browser', 'Any computer, tablet or phone');
    },
  };

  pages[document.body.dataset.page]?.();
})();
