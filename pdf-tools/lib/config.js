'use strict';
// Settings from the environment, with safe defaults. See .env.example.

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

const MAX_UPLOAD_MB = num(process.env.MAX_UPLOAD_MB, 100);

module.exports = {
  PORT: num(process.env.PORT, 3000),
  SITE_NAME: process.env.SITE_NAME || 'Pagefold',
  BASE_URL: (process.env.BASE_URL || '').replace(/\/+$/, ''),
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || '',
  TRUST_PROXY: process.env.TRUST_PROXY || '',
  FORCE_CANONICAL_HOST: process.env.FORCE_CANONICAL_HOST === '1',

  // Uploads to server-side tools.
  MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES: MAX_UPLOAD_MB * 1024 * 1024,
  // Files handled in the browser never reach the server; this only guards the device's memory.
  MAX_BROWSER_MB: num(process.env.MAX_BROWSER_MB, 250),
  RATE_LIMIT_MAX: num(process.env.RATE_LIMIT_MAX, 60),

  // Processing.
  MAX_JOBS: Math.max(1, num(process.env.MAX_JOBS, 2)),
  MAX_QUEUE: Math.max(1, num(process.env.MAX_QUEUE, 20)),
  JOB_TIMEOUT_MS: Math.max(10, num(process.env.JOB_TIMEOUT_S, 240)) * 1000,
  MAX_OUTPUT_BYTES: Math.max(1, num(process.env.MAX_OUTPUT_MB, 400)) * 1024 * 1024,
  MAX_PAGES: Math.max(1, num(process.env.MAX_PAGES, 1000)),
  PYTHON: process.env.PYTHON || 'python3',
  // Command that runs OCRmyPDF; may include an interpreter, e.g. "python3.12 /usr/bin/ocrmypdf".
  OCRMYPDF: (process.env.OCRMYPDF || 'ocrmypdf').split(' ').filter(Boolean),
  DISABLE: new Set(String(process.env.PDFTOOLS_DISABLE || '').split(',').map((s) => s.trim()).filter(Boolean)),

  // Google AdSense (off until ADSENSE_CLIENT is set).
  ADSENSE_CLIENT: /^ca-pub-\d{10,20}$/.test(process.env.ADSENSE_CLIENT || '') ? process.env.ADSENSE_CLIENT : '',
  ADSENSE_SLOTS: {
    top: process.env.ADSENSE_SLOT_TOP || '',
    content: process.env.ADSENSE_SLOT_CONTENT || '',
    tool: process.env.ADSENSE_SLOT_TOOL || '',
    footer: process.env.ADSENSE_SLOT_FOOTER || '',
  },
  // Shows labelled empty boxes where ads would go (for layout work); never on in production.
  SHOW_AD_PLACEHOLDERS: process.env.SHOW_AD_PLACEHOLDERS === '1',

  GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION || '',
  BING_SITE_VERIFICATION: process.env.BING_SITE_VERIFICATION || '',
};
