'use strict';
// The "How was your experience?" ratings (accounts/feedback.js) and the review link on pages.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'squish-fb-'));
process.env.DATA_DIR = DIR;
test.after(() => fs.rmSync(DIR, { recursive: true, force: true }));

test('ratings are kept with their comment, newest first, and summed up', () => {
  const fb = require('../accounts/feedback');
  assert.equal(fb.add({ rating: 5, text: '  Great   tool ', page: '/pdf-to-word', country: 'PK' }), true);
  assert.equal(fb.add({ rating: 2, text: 'Slow upload', page: '/compress-pdf' }), true);
  assert.equal(fb.add({ rating: 9 }), false);
  assert.equal(fb.add({ rating: 'x' }), false);
  const s = fb.summary();
  assert.equal(s.count, 2);
  assert.equal(s.average, 3.5);
  assert.deepEqual(s.stars, { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 });
  assert.equal(s.recent[0].c, 'Slow upload');
  assert.equal(s.recent[1].c, 'Great tool');
  fb._reset();
  assert.equal(require('../accounts/feedback').summary().count, 2, 'saved to DATA_DIR/feedback.json');
});

test('pages carry the review link only when it is a valid https URL, with the site named', () => {
  const { execFileSync } = require('child_process');
  const body = (env) => execFileSync(process.execPath, ['-e', "const p=require('./pages'); process.stdout.write(/<body[^>]*>/.exec(p.homePage('https://x'))[0])"],
    { cwd: path.join(__dirname, '..'), env: { ...process.env, REVIEW_URL: '', GOOGLE_REVIEW_URL: '', ...env } }).toString();
  assert.match(body({ REVIEW_URL: 'https://www.trustpilot.com/evaluate/flipitfree.com' }), /data-review="https:\/\/www\.trustpilot\.com\/evaluate\/flipitfree\.com" data-review-site="Trustpilot"/);
  assert.match(body({ GOOGLE_REVIEW_URL: 'https://g.page/r/ABC123/review' }), /data-review="https:\/\/g\.page\/r\/ABC123\/review" data-review-site="Google"/);
  assert.doesNotMatch(body({ REVIEW_URL: 'javascript:alert(1)' }), /data-review/);
  assert.doesNotMatch(body({}), /data-review/);
});

test('Trustpilot TrustBox: in the footer only with both valid IDs', () => {
  const { execFileSync } = require('child_process');
  const home = (env) => execFileSync(process.execPath, ['-e', "process.stdout.write(require('./pages').homePage('https://x'))"],
    { cwd: path.join(__dirname, '..'), env: { ...process.env, TRUSTPILOT_BUSINESS_ID: '', TRUSTPILOT_TEMPLATE_ID: '', ...env } }).toString();
  const on = home({ TRUSTPILOT_BUSINESS_ID: '5f1e2d3c4b5a69788796a5b4', TRUSTPILOT_TEMPLATE_ID: '56278e9abfbbba0bdcd568bc' });
  assert.match(on, /class="trustpilot-widget"[^>]*data-template-id="56278e9abfbbba0bdcd568bc" data-businessunit-id="5f1e2d3c4b5a69788796a5b4"/);
  assert.match(on, /<script async src="https:\/\/widget\.trustpilot\.com\/bootstrap\/v5\/tp\.widget\.bootstrap\.min\.js"><\/script>/);
  assert.doesNotMatch(home({ TRUSTPILOT_BUSINESS_ID: '"><script>', TRUSTPILOT_TEMPLATE_ID: '56278e9abfbbba0bdcd568bc' }), /trustpilot-widget/);
  assert.doesNotMatch(home({}), /trustpilot/);
});
