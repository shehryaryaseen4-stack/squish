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

test('pages carry the Google review link only when it is a valid https URL', () => {
  const { execFileSync } = require('child_process');
  const body = (url) => execFileSync(process.execPath, ['-e', "const p=require('./pages'); process.stdout.write(/<body[^>]*>/.exec(p.homePage('https://x'))[0])"],
    { cwd: path.join(__dirname, '..'), env: { ...process.env, GOOGLE_REVIEW_URL: url } }).toString();
  assert.match(body('https://g.page/r/ABC123/review'), /data-review="https:\/\/g\.page\/r\/ABC123\/review"/);
  assert.doesNotMatch(body('javascript:alert(1)'), /data-review/);
  assert.doesNotMatch(body(''), /data-review/);
});
