'use strict';

// Automatic WhatsApp reminders before a membership runs out, sent through the
// WhatsApp Business Platform (Meta Cloud API) with the gym's own number.
//
// Meta only lets a business start a chat with an approved message template, so
// the gym creates one template (we show the wording to paste) and we fill in
// the member's name, the gym name, the end date and the days left.

const { summarize, indexDb } = require('./members');
const { nowIn, diffDays, addDays } = require('./time');

const GRAPH = 'https://graph.facebook.com/v21.0';

const DEFAULTS = {
  enabled: false,
  phoneNumberId: '',
  token: '',
  templateName: 'membership_reminder',
  templateLang: 'en',
  countryCode: '92',
  daysBefore: 7,
  every: 'day', // 'day' = every day from daysBefore to the last day; 'some' = daysBefore, 3, 1 and the last day
  sendAt: '10:00',
};

const TEMPLATES = {
  en: 'Hi {{1}}! Your {{2}} membership ends on {{3}} ({{4}} days left). Please renew in time so your training doesn’t stop. Thank you!',
  ur: 'Assalam o Alaikum {{1}}! {{2}} mein aap ki membership {{3}} ko khatam ho rahi hai ({{4}} din baqi). Barah-e-karam waqt par fee jama karwa dein. Shukriya!',
};

// "0300 1234567" → "923001234567" with the gym's country code.
function intlPhone(phone, countryCode) {
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) return p.slice(1);
  if (p.startsWith('00')) return p.slice(2);
  const cc = String(countryCode || '').replace(/\D/g, '');
  if (p.startsWith('0')) return cc + p.slice(1);
  if (cc && p.startsWith(cc) && p.length > 10) return p;
  return cc + p;
}

// Which days before the end (0 = the last day) get a message.
function reminderDays(cfg) {
  const n = Math.max(0, Math.min(30, Number(cfg.daysBefore) || 0));
  const days = cfg.every === 'some' ? [n, 3, 1, 0].filter((d) => d <= n) : Array.from({ length: n + 1 }, (_, i) => n - i);
  return [...new Set(days)];
}

function longDate(iso, locale) {
  return new Intl.DateTimeFormat(locale || 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}

function createReminders(store, { now = () => new Date(), send = sendTemplate } = {}) {
  const db = () => store.db;
  const cfgOf = () => ({ ...DEFAULTS, ...(db().whatsapp || {}) });

  // Members due a reminder today that haven't had this one yet.
  function due() {
    const d = db();
    const cfg = cfgOf();
    const t = nowIn(d.business.timeZone, now()).date;
    const ix = indexDb(d);
    const days = new Set(reminderDays(cfg));
    const sent = new Set((d.reminders || []).filter((r) => r.status === 'sent' || r.status === 'skipped').map((r) => `${r.memberId}|${r.expiry}|${r.day}`));
    const out = [];
    for (const m of d.members) {
      if (m.left || !m.phone) continue;
      const s = summarize(d, m, t, ix);
      if (!s.expiry || s.frozen) continue;
      const day = diffDays(t, s.expiry);
      if (!days.has(day)) continue;
      if (sent.has(`${m.id}|${s.expiry}|${day}`)) continue;
      out.push({ member: m, expiry: s.expiry, day });
    }
    return out;
  }

  function params(m, expiry, day) {
    const b = db().business;
    return [m.name.split(' ')[0], b.name, longDate(expiry, b.locale), String(day)];
  }

  async function deliver(cfg, to, values) {
    return send({ phoneNumberId: cfg.phoneNumberId, token: cfg.token, to, template: cfg.templateName, lang: cfg.templateLang, values });
  }

  let running = false;
  async function tick() {
    const cfg = cfgOf();
    if (running || !cfg.enabled || !cfg.phoneNumberId || !cfg.token) return { sent: 0 };
    const local = nowIn(db().business.timeZone, now());
    const [h, mi] = String(cfg.sendAt || '10:00').split(':').map(Number);
    if (local.minutes < h * 60 + mi) return { sent: 0 };
    running = true;
    let count = 0;
    try {
      const d = db();
      d.reminders ||= [];
      for (const r of due().slice(0, 200)) {
        const entry = { id: `rem-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, memberId: r.member.id, expiry: r.expiry, day: r.day, at: new Date(now()).toISOString(), to: intlPhone(r.member.phone, cfg.countryCode) };
        try {
          await deliver(cfg, entry.to, params(r.member, r.expiry, r.day));
          entry.status = 'sent';
          count++;
        } catch (err) {
          entry.status = 'failed';
          entry.error = String(err.message || err).slice(0, 200);
        }
        d.reminders.unshift(entry);
      }
      // A failed one is tried again on the next run, but only the newest attempt is kept.
      const seen = new Set();
      d.reminders = d.reminders.filter((x) => {
        const k = `${x.memberId}|${x.expiry}|${x.day}`;
        if (x.status === 'failed' && seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 2000);
      d.whatsapp = { ...(d.whatsapp || {}), lastRun: new Date(now()).toISOString() };
      store.save();
    } finally {
      running = false;
    }
    return { sent: count };
  }

  async function test(phone) {
    const cfg = cfgOf();
    if (!cfg.phoneNumberId || !cfg.token) throw new Error('Add the phone number ID and access token first');
    const t = nowIn(db().business.timeZone, now()).date;
    const to = intlPhone(phone, cfg.countryCode);
    await deliver(cfg, to, ['Ali', db().business.name, longDate(addDays(t, cfg.daysBefore), db().business.locale), String(cfg.daysBefore)]);
    return { to };
  }

  return { tick, due, test, cfgOf };
}

// One template message through the Cloud API.
async function sendTemplate({ phoneNumberId, token, to, template, lang, values }) {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: template, language: { code: lang }, components: [{ type: 'body', parameters: values.map((text) => ({ type: 'text', text })) }] },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.error_user_msg || data.error?.message || `WhatsApp answered ${res.status}`);
  return data;
}

module.exports = { createReminders, intlPhone, reminderDays, DEFAULTS, TEMPLATES };
