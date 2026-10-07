'use strict';
// IndexNow: tells Bing, Yandex, Seznam and Naver about every indexable page in one request, so
// new and changed pages are picked up within minutes. Run after a deploy (update.sh does).
//   INDEXNOW_KEY  the site's key (served at /<key>.txt by server.js)
//   BASE_URL      https://yourdomain.com
const pages = require('../pages');

const key = process.env.INDEXNOW_KEY || '';
const base = (process.env.BASE_URL || '').replace(/\/+$/, '');
if (!/^[a-zA-Z0-9-]{8,128}$/.test(key) || !/^https:\/\//.test(base)) {
  console.log('IndexNow: INDEXNOW_KEY or BASE_URL not set, skipped.');
  process.exit(0);
}
const urlList = pages.allPaths().map((p) => base + p);
fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/${key}.txt`, urlList }),
  signal: AbortSignal.timeout(30000),
}).then((r) => console.log(`IndexNow: ${urlList.length} URLs sent, answer ${r.status} (200 or 202 = accepted)`))
  .catch((e) => console.log(`IndexNow: not sent (${e.message}).`));
