import type { Game } from '../../game/Game';
import { esc, stars, toast } from '../dom';
import { icons } from '../icons';
import { t } from '../../i18n/index';
import { WORLDS } from '../../data/worlds';
import { topBar } from './common';

export function mapScreen(game: Game, root: HTMLElement) {
  const next = game.progress.nextRecommended();
  const bar = topBar(game, t('map.title'));
  root.innerHTML = `
    <section class="screen map">
      ${bar.html}
      <div class="map-path scroll">
        ${WORLDS.map((w) => {
          const unlocked = game.progress.isWorldUnlocked(w.id);
          const pr = game.progress.worldProgress(w.id);
          const isNext = next.world === w.id && unlocked;
          return `
          <button class="world-card ${unlocked ? '' : 'locked'} ${isNext ? 'next' : ''}" data-world="${w.id}" style="--world-bg:${w.css}" ${unlocked ? '' : 'aria-disabled="true"'}>
            <div class="world-num">World ${w.id}</div>
            <h2>${esc(w.name)}</h2>
            <p>${esc(w.subtitle)}</p>
            <div class="world-meta">
              ${unlocked ? `<span>${pr.done}/${pr.total} levels</span><span>★ ${pr.stars}/${pr.maxStars}</span>` : `<span class="lock">${icons.lock} ${esc(t('map.locked'))}</span>`}
            </div>
            ${unlocked ? `<div class="bar"><span style="width:${(pr.done / pr.total) * 100}%"></span></div>` : ''}
            ${isNext ? `<span class="badge">${esc(t('map.next'))}: ${next.number}</span>` : ''}
            ${game.saves.data.worldRewards.includes(w.id) ? `<span class="fragment" title="Fragment recovered">◆</span>` : ''}
            <small class="mech">${esc(w.mechanics)}</small>
          </button>`;
        }).join('')}
        <p class="map-foot">${stars(3)} <span>${game.progress.totalStars()} / 300 stars collected</span></p>
      </div>
    </section>`;
  bar.bind(root);
  root.querySelectorAll<HTMLButtonElement>('[data-world]').forEach((b) =>
    b.addEventListener('click', () => {
      const w = Number(b.dataset.world);
      if (!game.progress.isWorldUnlocked(w)) {
        game.audio.play('error');
        toast(t('map.locked'), 'warn');
        return;
      }
      game.click();
      game.show('levels', { world: w });
    }),
  );
  root.querySelector<HTMLElement>('.world-card.next')?.scrollIntoView({ block: 'center' });
}
