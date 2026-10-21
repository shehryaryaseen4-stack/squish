// Visual QA helper: screenshots of chosen levels (default: a sample from every
// world) into test-results/gallery. Requires a build. Usage:
//   node scripts/gallery.mjs [ids...]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['w1-11', 'w1-20', 'w2-03', 'w2-14', 'w2-17', 'w3-09', 'w3-20', 'w4-03', 'w4-12', 'w5-04', 'w5-13', 'w5-20'];
const PORT = 4180;
mkdirSync('test-results/gallery', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 412, height: 860 } })).newPage();
page.on('pageerror', (e) => console.log('pageerror', String(e)));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForSelector('.screen.menu');
await page.evaluate(() => {
  const g = window.__paradox;
  g.progress.devUnlockAll = true;
});
for (const id of ids) {
  await page.evaluate((id) => {
    const g = window.__paradox;
    const all = [1, 2, 3, 4, 5, 6].flatMap((w) => g.worldLevels(w));
    const def = id === 'daily' ? g.daily.challenge() : all.find((l) => l.id === id);
    if (def) g.play(def);
  }, id);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove()));
  await page.evaluate(() => {
    const c = window.__paradox.controller;
    if (c) {
      c.resume();
      window.__paradox.input.enabled = true;
    }
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/gallery/${id}.png` });
}
await browser.close();
server.kill();
console.log('gallery done');
