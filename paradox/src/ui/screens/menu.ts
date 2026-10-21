import type { Game } from '../../game/Game';
import { $, esc, modal, toast } from '../dom';
import { icons } from '../icons';
import { t } from '../../i18n/index';
import { WORLDS } from '../../data/worlds';
import { COMEBACK_REWARD } from '../../game/DailyManager';
import { refreshWallet } from './common';

export function menuScreen(game: Game, root: HTMLElement) {
  const p = game.progress;
  const next = p.nextRecommended();
  const done = p.completedCount();
  const world = WORLDS[next.world - 1];
  const giftReady = game.daily.giftAvailable();
  root.innerHTML = `
    <section class="screen menu">
      <div class="logo">
        <div class="logo-mark" aria-hidden="true"><span></span></div>
        <h1>PARADOX</h1>
        <p>${esc(t('app.subtitle'))}</p>
      </div>
      <div class="menu-progress panel">
        <div>${esc(t('menu.progress', { done, stars: p.totalStars() }))}</div>
        <div class="bar"><span style="width:${done}%"></span></div>
        <small>${esc(world.name)} · ${esc(t('menu.next', { n: next.number, title: next.title }))}</small>
      </div>
      <nav class="menu-buttons">
        <button class="btn primary big" data-go="continue">${icons.play}<span>${done ? esc(t('menu.continue')) : esc(t('menu.play'))}</span></button>
        <button class="btn" data-go="map">${icons.map}<span>${esc(t('menu.map'))}</span></button>
        <button class="btn" data-go="daily">${icons.gift}<span>${esc(t('menu.daily'))}</span>${giftReady ? '<i class="dot" aria-label="Gift ready"></i>' : ''}</button>
        <button class="btn" data-go="rewards">${icons.sparkle}<span>${esc(t('menu.rewards'))}</span></button>
        <button class="btn" data-go="achievements">${icons.trophy}<span>${esc(t('menu.achievements'))}</span></button>
        <button class="btn" data-go="settings">${icons.settings}<span>${esc(t('menu.settings'))}</span></button>
      </nav>
      <footer class="menu-footer">
        <span class="coin-pill">${icons.coin}<b data-coins>${game.rewards.coins}</b></span>
        <span class="hint-pill">${icons.hint}<b data-hints>${game.rewards.hints}</b></span>
        <button class="link" data-go="credits">${esc(t('menu.credits'))}</button>
      </footer>
    </section>`;
  root.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      game.click();
      const go = b.dataset.go!;
      if (go === 'continue') {
        if (!game.saves.data.seen.includes('world-intro-1')) return game.show('levels', { world: 1 });
        return game.play(next);
      }
      game.show(go as never);
    }),
  );
  $(root, '.btn.primary').focus();

  if (game.saves.recovered) {
    game.saves.recovered = false;
    toast('Your saved data was damaged and could not be read, so a fresh save was started.', 'warn', 5000);
  }
  if (game.daily.comebackAvailable()) {
    modal({
      title: 'Welcome back, explorer',
      body: `<p>The worlds waited for you. Here is a little something to get back into the rhythm.</p>
        <p class="reward-line">${icons.coin} +${COMEBACK_REWARD.coins} coins &nbsp; ${icons.hint} +${COMEBACK_REWARD.hints} hint</p>`,
      actions: [
        {
          label: 'Collect',
          kind: 'primary',
          onClick: () => {
            if (game.daily.claimComeback()) {
              game.audio.play('coin');
              refreshWallet(game, root);
            }
          },
        },
      ],
      dismissible: false,
    });
  }
}
