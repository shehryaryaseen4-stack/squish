import type { Game } from '../../game/Game';
import { esc, formatCountdown, stars } from '../dom';
import { icons } from '../icons';
import { DAILY_CHALLENGE_REWARD, GIFT_TABLE, msUntilLocalMidnight } from '../../game/DailyManager';
import { refreshWallet, topBar } from './common';

export function dailyScreen(game: Game, root: HTMLElement) {
  const bar = topBar(game, 'Daily');
  const render = () => {
    const d = game.daily;
    const ch = d.challenge();
    const rec = game.progress.record(ch.id);
    const streak = game.saves.data.daily.giftStreak;
    const dayIndex = streak % GIFT_TABLE.length;
    root.innerHTML = `
      <section class="screen daily">
        ${bar.html}
        <div class="scroll stack">
          <div class="panel">
            <h2>${icons.gift} Daily gift</h2>
            <p class="muted">A small gift each day you visit. Missing a day never resets your progress along the gift track.</p>
            <ol class="gift-track">
              ${GIFT_TABLE.map(
                (g, i) => `<li class="${i < dayIndex ? 'got' : ''} ${i === dayIndex ? 'today' : ''}"><span>Day ${i + 1}</span><b>${g.coins}</b>${g.hints ? `<small>+${g.hints} hint</small>` : ''}</li>`,
              ).join('')}
            </ol>
            ${
              d.giftAvailable()
                ? `<button class="btn primary" data-claim>Collect ${d.nextGift().coins} coins${d.nextGift().hints ? ` and ${d.nextGift().hints} hint` : ''}</button>`
                : `<p class="muted">Collected today. Next gift in <b data-countdown>${formatCountdown(msUntilLocalMidnight())}</b> (local midnight).</p>`
            }
          </div>
          <div class="panel">
            <h2>${icons.sparkle} Daily challenge</h2>
            <p><b>${esc(ch.title)}</b> · ${esc(ch.objective)}</p>
            <p class="muted">A new puzzle from the rotating set every day at local midnight. Works offline. Reward once per day: ${DAILY_CHALLENGE_REWARD.coins} coins and ${DAILY_CHALLENGE_REWARD.hints} hint.</p>
            ${rec?.done ? `<p>Best: ${stars(rec.stars)} · ${rec.bestMoves} actions</p>` : ''}
            ${d.challengeDoneToday() ? '<p class="good">Completed today. You can replay it for fun.</p>' : ''}
            <button class="btn ${d.challengeDoneToday() ? '' : 'primary'}" data-play>${icons.play} ${d.challengeDoneToday() ? 'Replay' : 'Play today\'s challenge'}</button>
          </div>
        </div>
      </section>`;
    bar.bind(root);
    root.querySelector('[data-claim]')?.addEventListener('click', () => {
      const g = game.daily.claimGift();
      if (g) {
        game.audio.play('coin');
        render();
        refreshWallet(game, root);
      }
    });
    root.querySelector('[data-play]')!.addEventListener('click', () => {
      game.click();
      game.play(ch);
    });
  };
  render();
  const timer = window.setInterval(() => {
    const c = root.querySelector('[data-countdown]');
    if (c) c.textContent = formatCountdown(msUntilLocalMidnight());
    if (game.daily.giftAvailable() && !root.querySelector('[data-claim]')) render();
  }, 1000);
  return () => clearInterval(timer);
}
