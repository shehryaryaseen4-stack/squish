import type { Game } from '../../game/Game';
import { esc } from '../dom';
import { ACHIEVEMENTS } from '../../data/achievements';
import { topBar } from './common';

export function achievementsScreen(game: Game, root: HTMLElement) {
  game.checkAchievements();
  const bar = topBar(game, 'Achievements');
  const got = ACHIEVEMENTS.filter((a) => game.achievements.has(a.id)).length;
  root.innerHTML = `
    <section class="screen achievements">
      ${bar.html}
      <p class="levels-sub">${got} / ${ACHIEVEMENTS.length} unlocked</p>
      <ul class="ach-list scroll">
        ${ACHIEVEMENTS.map((a) => {
          const at = game.saves.data.achievements[a.id];
          return `<li class="ach ${at ? 'got' : ''}">
            <span class="ach-icon" aria-hidden="true">${esc(a.icon)}</span>
            <div><b>${esc(a.name)}</b><p>${esc(a.description)}</p>
            <small>${at ? `Unlocked ${new Date(at).toLocaleDateString()}` : `Reward: ${a.coins} coins${a.hints ? `, ${a.hints} hints` : ''}`}</small></div>
          </li>`;
        }).join('')}
      </ul>
    </section>`;
  bar.bind(root);
}
