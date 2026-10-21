import type { Game } from '../../game/Game';
import { esc } from '../dom';
import { icons } from '../icons';
import { t } from '../../i18n/index';
import type { ScreenName } from './index';

/** Standard top bar with a back button, title and currency display. */
export function topBar(game: Game, title: string, back: ScreenName | null = 'menu', backParams: Record<string, unknown> = {}) {
  const html = `
    <header class="topbar">
      ${back ? `<button class="icon-btn" data-back aria-label="${esc(t('common.back'))}">${icons.back}</button>` : '<span></span>'}
      <h1>${esc(title)}</h1>
      <div class="wallet" aria-label="Wallet">
        <span class="coin-pill" title="Coins">${icons.coin}<b data-coins>${game.rewards.coins}</b></span>
        <span class="hint-pill" title="Hint tokens">${icons.hint}<b data-hints>${game.rewards.hints}</b></span>
      </div>
    </header>`;
  const bind = (root: HTMLElement) => {
    root.querySelector('[data-back]')?.addEventListener('click', () => {
      game.click();
      if (back) game.show(back, backParams);
    });
  };
  return { html, bind };
}

export function refreshWallet(game: Game, root: ParentNode = document) {
  root.querySelectorAll('[data-coins]').forEach((e) => (e.textContent = String(game.rewards.coins)));
  root.querySelectorAll('[data-hints]').forEach((e) => (e.textContent = String(game.rewards.hints)));
}
