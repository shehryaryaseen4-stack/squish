// Entry screen: put it on a TV at the entrance. Every check-in from the
// fingerprint/face machine, the kiosk or the desk appears here, big.
(function () {
  const { esc, api: rawApi, time12, dateLong, initials, toast, store, money } = UI;
  const root = document.getElementById('root');
  let token = store.get('displayToken', null);
  let gym = null;
  const seen = new Set();
  const queue = [];
  let showing = false;
  let idleTimer = null;
  let sound = false;
  let audio = null;
  let lastFeed = null;
  let failures = 0;

  const api = (path) => rawApi(path, { token });
  const SHOW_MS = 9000;

  function nowParts() {
    const tz = gym?.timeZone || 'Asia/Karachi';
    return {
      clock: new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date()),
      date: (() => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; })(),
    };
  }

  // Green for a good entry, amber when the fee is due soon or money is pending, red when expired.
  function tone(e) {
    if (e.type === 'out') return 'out';
    const s = e.summary;
    if (['expired', 'unpaid', 'left'].includes(s.status)) return 'bad';
    if (s.status === 'expiring' || s.balance > 0) return 'warn';
    return 'in';
  }

  function noteFor(e) {
    const s = e.summary;
    if (e.type === 'out') return `Great workout · ${e.minutes >= 60 ? `${Math.floor(e.minutes / 60)}h ${e.minutes % 60}m` : `${e.minutes} min`}`;
    if (s.status === 'unpaid') return 'Fee not paid · please see the front desk';
    if (s.status === 'expired') return `Membership expired ${-s.daysLeft} day${s.daysLeft === -1 ? '' : 's'} ago · please renew`;
    if (s.status === 'left') return 'Membership closed · please see the front desk';
    if (s.balance > 0) return `${money(s.balance, { zero: null })} pending · please clear at the desk`;
    if (s.status === 'frozen') return 'Membership is frozen';
    if (s.status === 'expiring') return s.daysLeft === 0 ? 'Membership ends today · renew to keep training' : `Only ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left · renew soon`;
    return `Visit ${s.visitsThisMonth} this month · keep it up!`;
  }

  function photo(m) {
    const src = UI.photoSrc(m.photo);
    return `<div class="photo">${src ? `<img src="${esc(src)}" alt="">` : esc(initials(m.name))}</div>`;
  }

  const SOURCE = { fingerprint: ['fingerprint', 'Fingerprint'], face: ['user', 'Face scan'], card: ['tag', 'Card'], kiosk: ['kiosk', 'Kiosk'], desk: ['login', 'Front desk'] };

  function spotlight(e) {
    const el = document.getElementById('spot');
    const t = tone(e);
    const s = e.summary;
    const first = e.member.name.split(' ')[0];
    const days = e.type === 'in' && s.daysLeft != null && s.daysLeft >= 0 && !['unpaid', 'left'].includes(s.status);
    const src = SOURCE[e.source] || null;
    el.className = `spot ${t}`;
    el.innerHTML = `<div class="spot-inner">${photo(e.member)}
      <h2>${e.type === 'in' ? `Welcome, ${esc(first)}!` : `Goodbye, ${esc(first)}!`}</h2>
      <div class="who">${esc(e.member.name)} · #${e.member.memberNo}${s.plan ? ` · ${esc(s.plan.name)}` : ''}</div>
      ${days ? `<div class="days"><b>${s.daysLeft}</b><span>day${s.daysLeft === 1 ? '' : 's'} left${s.expiry ? ` · till ${dateLong(s.expiry)}` : ''}</span></div>` : ''}
      <div class="note">${esc(noteFor(e))}</div>
      <div class="meta">${src ? `${icon(src[0])}${src[1]} · ` : ''}${e.type === 'in' ? 'Checked in' : 'Checked out'} at ${time12(e.time)}</div></div>`;
    if (sound) chime(t);
  }

  function idle() {
    const el = document.getElementById('spot');
    if (!el) return;
    el.className = 'spot idle';
    el.innerHTML = `<div class="spot-inner"><h2>Welcome to ${esc(gym.name)}</h2><p>Scan your finger or face, or type your member number at the kiosk.</p>
      <div class="icons">${icon('fingerprint')}${icon('user')}</div></div>`;
  }

  function next() {
    if (!queue.length) { showing = false; idleTimer = setTimeout(idle, SHOW_MS); return; }
    showing = true;
    clearTimeout(idleTimer);
    spotlight(queue.shift());
    // Busy door: show each entry for less time so nobody waits on the screen.
    setTimeout(next, queue.length ? 3500 : SHOW_MS);
  }

  function drawSide(f) {
    document.getElementById('inside').textContent = f.insideNow;
    document.getElementById('today').textContent = f.checkinsToday;
    document.getElementById('feed').innerHTML = f.events.slice(0, 7).map((e) => {
      const t = tone(e);
      const s = e.summary;
      const tag = e.type === 'out' ? 'Out' : t === 'bad' ? (s.status === 'unpaid' ? 'No fee' : 'Expired') : s.daysLeft != null ? `${s.daysLeft}d left` : 'In';
      return `<div class="feed-row">${UI.avatarHtml(e.member, '', 'var(--accent)')}<div class="tx"><b>${esc(e.member.name)}</b><span>#${e.member.memberNo} · ${time12(e.time)}</span></div><span class="tag ${e.type === 'out' ? 'out' : t}">${esc(tag)}</span></div>`;
    }).join('') || '<p style="color:#77778a;font-size:2vh">No entries yet today.</p>';
  }

  async function poll() {
    try {
      const f = await api('/api/admin/display');
      failures = 0;
      document.querySelector('.live')?.classList.remove('off');
      const fresh = f.events.filter((e) => !seen.has(e.key)).reverse();
      for (const e of f.events) seen.add(e.key);
      // On the first load just list what already happened; spotlight only new entries.
      if (lastFeed) for (const e of fresh) queue.push(e);
      lastFeed = f;
      drawSide(f);
      if (queue.length && !showing) next();
    } catch (e) {
      if (e.status === 401) { token = null; store.remove('displayToken'); return signIn(); }
      failures++;
      if (failures > 2) document.querySelector('.live')?.classList.add('off');
    }
  }

  function chime(kind) {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const notes = kind === 'bad' ? [330, 262] : kind === 'warn' ? [523, 440] : [523, 784];
      notes.forEach((freq, i) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.frequency.value = freq;
        o.connect(g);
        g.connect(audio.destination);
        const t0 = audio.currentTime + i * 0.18;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
        o.start(t0);
        o.stop(t0 + 0.35);
      });
    } catch { /* no audio */ }
  }

  function main() {
    UI.setBusiness(gym);
    UI.setAccent(gym.accent);
    document.title = `${gym.name} · Entry screen`;
    const p = nowParts();
    root.innerHTML = `<div class="ds">
      <header class="ds-top"><div class="mark">${esc(gym.name.charAt(0))}</div><h1>${esc(gym.name)}<span>${dateLong(p.date)}</span></h1><div class="ds-clock" id="clock">${p.clock}</div></header>
      <main class="ds-main"><section class="spot idle" id="spot" aria-live="polite"></section>
        <aside class="side"><div class="stats"><div class="stat-box"><span>In the gym now</span><b id="inside">–</b></div><div class="stat-box"><span>Check-ins today</span><b id="today">–</b></div></div>
          <h3>Latest entries</h3><div class="feed" id="feed"></div></aside></main>
      <footer class="ds-foot"><span class="live"><i></i>Live · updates every 2 seconds</span>
        <span><button data-sound>${icon('bolt')}Sound off</button> <button data-full>${icon('tv')}Full screen</button></span></footer></div>`;
    idle();
    root.querySelector('[data-sound]').addEventListener('click', (e) => {
      sound = !sound;
      e.currentTarget.innerHTML = `${icon('bolt')}Sound ${sound ? 'on' : 'off'}`;
      if (sound) chime('in');
    });
    root.querySelector('[data-full]').addEventListener('click', () => {
      const el = document.documentElement;
      (el.requestFullscreen ? el.requestFullscreen() : Promise.reject()).catch(() => toast('Use the TV browser\'s full screen button (often F11).'));
    });
    poll();
  }

  async function signIn() {
    try { gym = (await rawApi('/api/gym')).business; } catch { gym = { name: 'Gym', accent: '#f97316', timeZone: 'Asia/Karachi' }; }
    UI.setAccent(gym.accent);
    root.innerHTML = `<div class="ds" style="place-items:center;grid-template-rows:1fr"><div style="text-align:center;max-width:420px">
      <div class="mark" style="width:72px;height:72px;border-radius:22px;display:grid;place-items:center;margin:0 auto 16px;font-size:30px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--accent),#222)">${esc(gym.name.charAt(0))}</div>
      <h1 style="font-size:28px">Start the entry screen</h1><p style="color:#9a9ab0;margin-top:6px">Enter the owner or front desk PIN once on this screen.</p>
      <form style="margin-top:22px;display:grid;gap:12px"><input class="input" type="password" inputmode="numeric" maxlength="8" placeholder="PIN" autofocus style="text-align:center;font-size:22px;letter-spacing:.3em"><button class="btn btn-primary btn-block">Start</button></form>
      <p style="margin-top:18px"><a class="link" href="${UI.url('/admin.html')}">← Dashboard</a></p></div></div>`;
    root.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const r = await rawApi('/api/admin/login', { method: 'POST', body: { pin: root.querySelector('input').value } });
        token = r.token;
        store.set('displayToken', token);
        main();
      } catch (err) { toast(err.message, 'bad'); }
    });
  }

  setInterval(() => { const c = document.getElementById('clock'); if (c && gym) c.textContent = nowParts().clock; }, 10000);
  setInterval(() => { if (token && document.getElementById('spot')) poll(); }, 2000);

  (async () => {
    try { gym = (await rawApi('/api/gym')).business; } catch { /* sign-in shows the problem */ }
    if (!token || !gym) return signIn();
    try { await api('/api/admin/display'); main(); } catch { token = null; store.remove('displayToken'); signIn(); }
  })();
})();
