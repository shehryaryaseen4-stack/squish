// Helpers shared by the customer app and the owner dashboard.
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // In the native app the server can also be chosen on first launch (see app.js).
  function apiBase() {
    const cfg = window.APP_CONFIG || {};
    if (cfg.apiBase) return cfg.apiBase;
    if (!cfg.native) return '';
    try { return localStorage.getItem('serverUrl') || ''; } catch { return ''; }
  }

  async function api(path, { method = 'GET', body, token } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(`${apiBase()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw Object.assign(new Error('You seem to be offline. Check your connection and try again.'), { status: 0 });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
    return data;
  }

  let biz = { locale: 'en-PK', currencySymbol: 'Rs', currency: 'PKR' };
  const setBusiness = (b) => { biz = b; };

  function money(n, { zero = 'Free' } = {}) {
    if (!n && zero) return zero;
    return `${biz.currencySymbol || ''} ${Number(n).toLocaleString(biz.locale || 'en-PK')}`.trim();
  }

  function time12(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  const asDate = (iso) => new Date(`${iso}T12:00:00Z`);
  const fmt = (iso, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(asDate(iso));
  const dateLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateShort = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
  const dayName = (iso) => fmt(iso, { weekday: 'short' });
  const dayNum = (iso) => fmt(iso, { day: 'numeric' });
  const monthName = (iso) => fmt(iso, { month: 'short' });
  function addDays(iso, n) {
    const d = asDate(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const DAY_LABELS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  const weekday = (iso) => asDate(iso).getUTCDay();

  function duration(min) {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? 's' : ''}`;
  }

  const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  function toast(message, kind = 'good') {
    let host = document.querySelector('.toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.append(host);
    }
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `${icon(kind === 'bad' ? 'alert' : 'check')}<span>${esc(message)}</span>`;
    host.append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, kind === 'bad' ? 4200 : 2600);
  }

  /**
   * Opens a bottom sheet. `render(close)` returns inner HTML; `onMount(root, close)`
   * wires events. Resolves with whatever is passed to close().
   */
  function sheet({ title, html, onMount, wide = false, label }) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const backdrop = document.createElement('div');
      backdrop.className = 'sheet-backdrop';
      backdrop.innerHTML = `<div class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(label || title || 'Dialog')}">
        ${title ? `<div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>` : ''}
        <div class="sheet-body">${html}</div></div>`;
      let done = false;
      const close = (value) => {
        if (done) return;
        done = true;
        backdrop.classList.add('closing');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => { backdrop.remove(); document.body.style.overflow = ''; prevFocus?.focus?.(); }, 220);
        resolve(value);
      };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop || e.target.closest('[data-close]')) close();
      });
      document.addEventListener('keydown', onKey);
      document.body.append(backdrop);
      document.body.style.overflow = 'hidden';
      const root = backdrop.querySelector('.sheet');
      onMount?.(root, close);
      (root.querySelector('[autofocus]') || root.querySelector('button, input, select, textarea'))?.focus({ preventScroll: true });
    });
  }

  function confirmSheet({ title, message, confirm = 'Confirm', cancel = 'Keep it', danger = false }) {
    return sheet({
      label: title,
      html: `<div class="confirm-sheet"><div class="empty-icon${danger ? ' danger' : ''}">${icon(danger ? 'alert' : 'info')}</div>
        <h3>${esc(title)}</h3><p class="muted">${esc(message)}</p></div>
        <div class="sheet-actions"><button class="btn btn-ghost" data-close>${esc(cancel)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirm)}</button></div>`,
      onMount: (root, close) => root.querySelector('[data-ok]').addEventListener('click', () => close(true)),
    });
  }

  async function busy(button, fn) {
    if (button.disabled) return;
    const html = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>';
    try {
      return await fn();
    } finally {
      button.disabled = false;
      button.innerHTML = html;
    }
  }

  function setAccent(hex) {
    document.documentElement.style.setProperty('--accent', hex);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    document.documentElement.style.setProperty('--accent-ink', lum > 0.45 ? '#12121a' : '#ffffff');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex);
  }

  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* private mode */ }
    },
  };

  // A calendar file the customer can add to Google/Apple Calendar.
  function icsFor(b, business) {
    const stamp = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Slotly//Booking//EN', 'BEGIN:VEVENT',
      `UID:${b.id}@slotly`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;TZID=${business.timeZone}:${stamp(b.date, b.start)}`,
      `DTEND;TZID=${business.timeZone}:${stamp(b.date, b.end)}`,
      `SUMMARY:${b.serviceName} at ${business.name}`,
      `LOCATION:${(business.address || '').replace(/,/g, '\\,')}`,
      `DESCRIPTION:Booking code ${b.code}${b.staffName ? ` · with ${b.staffName}` : ''}`,
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `booking-${b.code}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const waLink = (number, text) => `https://wa.me/${String(number || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  // Member photos: stored paths come from the server, data URLs are used as is.
  function photoSrc(p) {
    if (!p) return null;
    return p.startsWith('data:') ? p : `${apiBase()}${p}`;
  }

  // A round member picture, or their initials when there is no photo yet.
  function avatarHtml(m, size = '', color) {
    const c = color || (m?.gender === 'female' ? '#e5487f' : 'var(--accent)');
    const src = photoSrc(m?.photo);
    return src
      ? `<span class="avatar has-photo ${size}" style="--c:${c}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"></span>`
      : `<span class="avatar ${size}" style="--c:${c}">${esc(initials(m?.name || '?'))}</span>`;
  }

  // Lets the person take or choose a photo, then crops it to a centred square
  // and shrinks it, so uploads stay small. Resolves with a JPEG data URL, or
  // null if they cancel.
  function pickPhoto({ size = 360 } = {}) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null);
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          canvas.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a photo we can read. Try a JPG or PNG.')); };
        img.src = url;
      });
      input.click();
    });
  }

  window.UI = {
    esc, api, apiBase, money, time12, dateLong, dateShort, dayName, dayNum, monthName, addDays, weekday, duration,
    initials, toast, sheet, confirmSheet, busy, setAccent, store, icsFor, waLink, setBusiness, DAYS, DAY_LABELS,
    photoSrc, avatarHtml, pickPhoto,
  };
})();
