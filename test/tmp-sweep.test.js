'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sweepTmp } = require('../engines/cli');

test('old leftovers in the temp folder are removed, new ones and other programs\' files stay', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-root-'));
  const old = Date.now() / 1000 - 7 * 3600;
  const mk = (rel, dir) => { const p = path.join(root, rel); if (dir) fs.mkdirSync(p, { recursive: true }); else { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'x'); } return p; };
  const oldDir = mk('squish-abc', true); fs.writeFileSync(path.join(oldDir, 'f'), 'x');
  const oldUp = mk('squish-up-1');
  const newUp = mk('squish-up-2');
  const other = mk('someone-else');
  const oldRes = mk('squish-results/a.mp4');
  const newRes = mk('squish-results/b.mp4');
  for (const p of [oldDir, oldUp, other, oldRes]) fs.utimesSync(p, old, old);
  fs.utimesSync(path.join(root, 'squish-results'), old, old);
  const n = await sweepTmp(root);
  assert.strictEqual(n, 3);
  assert.ok(!fs.existsSync(oldDir) && !fs.existsSync(oldUp) && !fs.existsSync(oldRes));
  assert.ok(fs.existsSync(newUp) && fs.existsSync(other) && fs.existsSync(newRes) && fs.existsSync(path.join(root, 'squish-results')));
  fs.rmSync(root, { recursive: true, force: true });
});
