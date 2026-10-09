'use strict';
// Sends account emails (sign-up and password codes) through an email API over HTTPS, so no
// mail server is needed. Set one of:
//   BREVO_API_KEY   brevo.com, free plan 300 emails a day
//   RESEND_API_KEY  resend.com, free plan 100 emails a day
// and MAIL_FROM, e.g. "Flipit Free <no-reply@flipitfree.com>" (the domain must be verified
// with the provider). Without a key, accounts work without email verification.

const BREVO = process.env.BREVO_API_KEY || '';
const RESEND = process.env.RESEND_API_KEY || '';
// MAIL_DEV=1 (local testing only): print the code in the server log instead of emailing it.
const DEV = process.env.MAIL_DEV === '1';
const ON = !!(BREVO || RESEND || DEV);
const SITE = process.env.SITE_NAME || require('../brand').NAME;

function from() {
  const host = (() => { try { return new URL(process.env.BASE_URL).hostname.replace(/^www\./, ''); } catch { return 'localhost'; } })();
  const raw = process.env.MAIL_FROM || `${SITE} <no-reply@${host}>`;
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  return m ? { name: m[1].replace(/^"|"$/g, '') || SITE, email: m[2] } : { name: SITE, email: raw.trim() };
}

async function send({ to, subject, html, text }) {
  if (DEV && !BREVO && !RESEND) { console.log(`[mail] to ${to}: ${subject}`); return; }
  const f = from();
  const r = BREVO
    ? await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: f, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
    })
    : await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${f.name} <${f.email}>`, to: [to], subject, html, text }),
    });
  if (!r.ok) throw new Error(`email API answered ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// purpose: 'signup' | 'reset'
function codeEmail(code, purpose) {
  const what = purpose === 'reset' ? 'reset your password' : 'finish creating your account';
  const subject = `${code} is your ${SITE} code`;
  const text = `Your ${SITE} code is ${code}\n\nEnter it on the website to ${what}. It works for 15 minutes.\n\nIf you did not ask for this, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#F4F5F7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#23262D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:440px;width:100%;background:#fff;border:1px solid #E2E4E8;border-radius:14px">
<tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:700">${esc(SITE)}</td></tr>
<tr><td style="padding:8px 28px 0;font-size:15px;line-height:1.5">Enter this code on the website to ${what}:</td></tr>
<tr><td style="padding:18px 28px"><div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#F4F5F7;border-radius:10px;padding:14px 0;text-align:center">${esc(code)}</div></td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#6B7079">The code works for 15 minutes. If you did not ask for it, you can ignore this email; nothing happens without the code.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

const sendCode = (to, code, purpose) => send({ to, ...codeEmail(code, purpose) });

module.exports = { ON, sendCode, from, _codeEmail: codeEmail };
