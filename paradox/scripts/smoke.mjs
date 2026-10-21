// Browser smoke test: builds must exist (npm run build). Starts `vite preview`,
// drives the real game in headless Chromium and saves screenshots to
// test-results/. Covers menu, map, level 1 completion, save/reload, a gravity
// level, an echo level and Level 100 with the ending.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const solutions = JSON.parse(readFileSync(new URL('../src/data/solutions.json', import.meta.url), 'utf8'));
mkdirSync('test-results', { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview server did not start')), 20000);
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && (clearTimeout(t), resolve()));
});

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return { ctx, page };
}

/** Play a level through the real controller, one action at a time. */
async function playSolution(page, id) {
  const sol = solutions[id];
  await page.waitForFunction(() => window.__paradox?.controller);
  for (const ch of sol) {
    const a = 'NESW.RF'.indexOf(ch);
    await page.evaluate((a) => window.__paradox.controller.enqueue(a), a);
    await page.waitForFunction(() => {
      const c = window.__paradox.controller;
      return !c || c.finished || !c.view.isAnimating();
    });
    await page.waitForTimeout(170);
  }
  await page.waitForSelector('.modal-backdrop.complete', { timeout: 10000 });
}

async function closeModals(page) {
  for (let i = 0; i < 4; i++) {
    const btn = await page.$('.modal-backdrop .modal-actions .btn.primary');
    if (!btn) break;
    await btn.click();
    await page.waitForTimeout(300);
  }
}

try {
  // ---- Phone portrait: menu, map, first level, save/reload ----
  const { ctx, page } = await newPage({ width: 412, height: 860 });
  await page.goto(BASE);
  await page.waitForSelector('.screen.menu', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/01-menu.png' });
  check('menu renders', !!(await page.$('.menu-buttons .btn.primary')));

  await page.click('[data-go="map"]');
  await page.waitForSelector('.world-card');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/02-map.png' });
  check('map shows 5 worlds plus Coin Rush', (await page.$$('.world-card:not(.rush-card)')).length === 5 && !!(await page.$('.rush-card')));
  check('worlds 2-5 locked at start', (await page.$$('.world-card.locked')).length === 4);

  await page.click('.world-card[data-world="1"]');
  await page.waitForSelector('.level-tile');
  await closeModals(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/03-levels.png' });
  check('20 level tiles', (await page.$$('.level-tile')).length === 20);
  check('level 2 locked before level 1', !!(await page.$('.level-tile.locked[data-id="w1-02"]')));

  await page.click('.level-tile[data-id="w1-01"]');
  await page.waitForSelector('.screen.game');
  await closeModals(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/04-level1.png' });

  // Real input: one swipe east on the canvas, then keyboard for the rest.
  const before = await page.evaluate(() => window.__paradox.controller.state.p);
  await page.mouse.move(200, 430);
  await page.mouse.down();
  await page.mouse.move(280, 430, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__paradox.controller.state.p);
  check('swipe moves the cube', after !== before, `${before} -> ${after}`);
  await page.click('[data-cmd="undo"]');
  await page.waitForTimeout(300);
  check('undo restores position', (await page.evaluate(() => window.__paradox.controller.state.p)) === before);

  await playSolution(page, 'w1-01');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/05-complete.png' });
  const coins = await page.evaluate(() => window.__paradox.rewards.coins);
  check('level 1 completion pays first-clear coins', coins > 0, `coins=${coins}`);

  // Replay must not pay again.
  await page.click('.modal-actions .btn:has-text("Replay")');
  await page.waitForSelector('.screen.game');
  await closeModals(page);
  await playSolution(page, 'w1-01');
  const coins2 = await page.evaluate(() => window.__paradox.rewards.coins);
  check('replay does not pay first-clear coins again', coins2 === coins, `coins=${coins2}`);

  // Hints, pause and resume on level 2.
  await page.click('.modal-actions .btn.primary'); // Next level
  await page.waitForSelector('.screen.game');
  await closeModals(page);
  await page.click('[data-cmd="hint"]');
  await page.waitForSelector('.modal-backdrop .hint-text');
  await page.click('.modal-backdrop .modal-actions .btn.primary');
  await page.waitForTimeout(400);
  const hint = await page.evaluate(() => ({
    steps: window.__paradox.controller.hintActions?.length ?? 0,
    free: window.__paradox.daily.freeHintAvailable(),
    tokens: window.__paradox.rewards.hints,
  }));
  check('Easy mode path hint is free and shows the next moves', hint.steps > 0 && hint.free && hint.tokens === 3, JSON.stringify(hint));
  check('goal checklist is shown', (await page.$$('.goals li')).length >= 1);
  await page.screenshot({ path: 'test-results/05b-hint.png' });
  await page.click('[data-cmd="pause"]');
  await page.waitForSelector('.modal-backdrop .modal');
  check('pause stops input', await page.evaluate(() => window.__paradox.controller.paused));
  await page.click('.modal-backdrop .modal-actions .btn.primary');
  await page.waitForTimeout(300);
  await page.goBack();
  await page.waitForSelector('.modal-backdrop .modal');
  check('back button pauses instead of leaving the game', (await page.evaluate(() => window.__paradox.current)) === 'game');
  await page.click('.modal-backdrop .modal-actions .btn.primary');
  await page.waitForTimeout(300);
  check('resume restores input', await page.evaluate(() => !window.__paradox.controller.paused));

  // Coin Rush: drones, coins, combo popups.
  await page.evaluate(() => window.__paradox.show('levels', { world: 6 }));
  await page.waitForSelector('.level-tile');
  await closeModals(page);
  await page.click('.level-tile[data-id="rush-01"]');
  await page.waitForSelector('.screen.game');
  await closeModals(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/05e-rush.png' });
  const rc0 = await page.evaluate(() => window.__paradox.rewards.coins);
  await playSolution(page, 'rush-01');
  const rc1 = await page.evaluate(() => window.__paradox.rewards.coins);
  check('Coin Rush board completes and pays coins', rc1 > rc0, `${rc0} -> ${rc1}`);
  await page.screenshot({ path: 'test-results/05f-rush-complete.png' });

  // Daily gift and cosmetics.
  await page.evaluate(() => window.__paradox.show('daily'));
  await page.waitForSelector('[data-claim]');
  const c0 = await page.evaluate(() => window.__paradox.rewards.coins);
  await page.click('[data-claim]');
  await page.waitForTimeout(200);
  const c1 = await page.evaluate(() => window.__paradox.rewards.coins);
  check('daily gift pays once', c1 > c0 && !(await page.$('[data-claim]')), `${c0} -> ${c1}`);
  await page.screenshot({ path: 'test-results/05c-daily.png' });
  await page.evaluate(() => window.__paradox.show('rewards'));
  await page.waitForSelector('.cos');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/05d-rewards.png' });

  await page.reload();
  await page.waitForSelector('.screen.menu', { timeout: 20000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('paradox.save')));
  check('progress persists after reload', saved?.levels?.['w1-01']?.done === true);
  await ctx.close();

  // ---- Unlock everything via an imported save, then gravity, echo and Level 100 ----
  const { ctx: ctx2, page: p2 } = await newPage({ width: 412, height: 860 });
  await p2.goto(BASE);
  await p2.waitForSelector('.screen.menu', { timeout: 20000 });
  await p2.evaluate((ids) => {
    const g = window.__paradox;
    for (const id of ids) g.saves.data.levels[id] = { done: true, stars: 3, bestMoves: 1, bestTime: 1, hintFree: true };
    g.saves.data.seen.push('world-intro-1', 'world-intro-3', 'world-intro-4', 'world-intro-5');
    g.saves.save();
  }, Object.keys(solutions).filter((id) => id.startsWith('w') && id !== 'w5-20'));
  await p2.reload();
  await p2.waitForSelector('.screen.menu');

  for (const id of ['w3-02', 'w4-01']) {
    await p2.evaluate((id) => {
      const g = window.__paradox;
      const def = [...g.worldLevels(Number(id[1]))].find((l) => l.id === id);
      g.play(def);
    }, id);
    await p2.waitForSelector('.screen.game');
    await closeModals(p2);
    await p2.waitForTimeout(500);
    await p2.screenshot({ path: `test-results/06-${id}.png` });
    await playSolution(p2, id);
    check(`${id} completes`, true);
    await p2.screenshot({ path: `test-results/07-${id}-complete.png` });
  }

  await p2.evaluate(() => {
    const g = window.__paradox;
    g.play(g.worldLevels(5)[19]);
  });
  await p2.waitForSelector('.screen.game');
  await closeModals(p2);
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: 'test-results/08-level100.png' });
  await playSolution(p2, 'w5-20');
  await p2.screenshot({ path: 'test-results/09-level100-complete.png' });
  await p2.click('.modal-actions .btn.primary');
  await p2.waitForSelector('.screen.ending');
  await p2.waitForTimeout(2500);
  await p2.screenshot({ path: 'test-results/10-ending.png' });
  const end = await p2.evaluate(() => ({ owns: window.__paradox.rewards.owns('skin-paradox'), ach: !!window.__paradox.saves.data.achievements.paradox }));
  check('Level 100 unlocks the ending reward and achievement', end.owns && end.ach);
  await ctx2.close();

  // ---- Offline (installed PWA) ----
  const { ctx: ctx5, page: p5 } = await newPage({ width: 412, height: 860 });
  await p5.goto(BASE);
  await p5.waitForSelector('.screen.menu', { timeout: 20000 });
  await p5.evaluate(() => navigator.serviceWorker.ready);
  await p5.waitForTimeout(800);
  await ctx5.setOffline(true);
  await p5.reload();
  const offlineOk = await p5.waitForSelector('.screen.menu', { timeout: 20000 }).then(() => true, () => false);
  check('reloads and runs offline via the service worker', offlineOk);
  await ctx5.close();

  // ---- Phone landscape layout ----
  const { ctx: ctx4, page: p4 } = await newPage({ width: 860, height: 400 });
  await p4.goto(BASE);
  await p4.waitForSelector('.screen.menu', { timeout: 20000 });
  await p4.waitForTimeout(600);
  await p4.screenshot({ path: 'test-results/13-landscape-menu.png' });
  await p4.evaluate(() => window.__paradox.play(window.__paradox.worldLevels(1)[0]));
  await p4.waitForSelector('.screen.game');
  await closeModals(p4);
  await p4.waitForTimeout(600);
  await p4.screenshot({ path: 'test-results/14-landscape-game.png' });
  await ctx4.close();

  // ---- Desktop landscape layout ----
  const { ctx: ctx3, page: p3 } = await newPage({ width: 1366, height: 768 });
  await p3.goto(BASE);
  await p3.waitForSelector('.screen.menu', { timeout: 20000 });
  await p3.waitForTimeout(600);
  await p3.screenshot({ path: 'test-results/11-desktop-menu.png' });
  await p3.evaluate(() => window.__paradox.play(window.__paradox.worldLevels(1)[0]));
  await p3.waitForSelector('.screen.game');
  await closeModals(p3);
  await p3.waitForTimeout(600);
  await p3.screenshot({ path: 'test-results/12-desktop-game.png' });
  await ctx3.close();
} catch (e) {
  check('smoke run', false, String(e));
} finally {
  await browser.close();
  server.kill();
}
check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `${failed} check(s) failed` : 'all smoke checks passed');
process.exit(failed ? 1 : 0);
