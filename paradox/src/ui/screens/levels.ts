import type { Game } from '../../game/Game';
import { esc, modal, stars } from '../dom';
import { icons } from '../icons';
import { t } from '../../i18n/index';
import { RUSH_THEME, WORLDS } from '../../data/worlds';
import { topBar } from './common';

export function levelsScreen(game: Game, root: HTMLElement, params: Record<string, unknown>) {
  const world = Number(params.world ?? 1);
  const w = world === 6 ? RUSH_THEME : WORLDS[world - 1];
  const levels = game.worldLevels(world);
  const next = world === 6 ? game.progress.nextRush() : game.progress.nextRecommended();
  const bar = topBar(game, `${w.name}`, world === 6 ? 'menu' : 'map');
  root.innerHTML = `
    <section class="screen levels" style="--world-bg:${w.css}">
      ${bar.html}
      <p class="levels-sub">${esc(w.subtitle)} · ${esc(t('levels.title'))}</p>
      <div class="level-grid scroll">
        ${levels
          .map((l) => {
            const rec = game.progress.record(l.id);
            const unlocked = game.progress.isUnlocked(l);
            const isNext = l.id === next.id && unlocked && !rec?.done;
            return `<button class="level-tile ${unlocked ? '' : 'locked'} ${rec?.done ? 'done' : ''} ${rec?.skipped && !rec.done ? 'skipped' : ''} ${isNext ? 'next' : ''}" data-id="${l.id}"
                aria-label="Level ${l.number}: ${esc(l.title)}${unlocked ? '' : ' (locked)'}">
              <span class="n">${l.number}</span>
              ${unlocked ? stars(rec?.stars ?? 0) : `<span class="lock">${icons.lock}</span>`}
              <span class="tt">${esc(l.title)}</span>
            </button>`;
          })
          .join('')}
      </div>
      <button class="link story-link" data-story>${icons.info} Story of this world</button>
    </section>`;
  bar.bind(root);
  root.querySelectorAll<HTMLButtonElement>('[data-id]').forEach((b) =>
    b.addEventListener('click', () => {
      const def = levels.find((l) => l.id === b.dataset.id)!;
      if (!game.progress.isUnlocked(def)) {
        game.audio.play('error');
        return;
      }
      game.click();
      game.play(def);
    }),
  );
  const showStory = () =>
    modal({
      title: `World ${w.id}: ${w.name}`,
      body: `<p class="story">${esc(w.intro)}</p><p class="muted">New here: ${esc(w.mechanics)}.</p>`,
      actions: [{ label: t('common.ok'), kind: 'primary' }],
    });
  root.querySelector('[data-story]')!.addEventListener('click', showStory);
  const seenKey = `world-intro-${world}`;
  if (!game.saves.data.seen.includes(seenKey)) {
    game.saves.data.seen.push(seenKey);
    game.saves.save();
    showStory();
  }
}
