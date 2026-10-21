import type { Game } from '../../game/Game';
import { esc } from '../dom';
import { ENDING_TEXT, WORLDS } from '../../data/worlds';
import { cosmeticById } from '../../data/cosmetics';

/** Original ending sequence after the Paradox Core awakens. */
export function endingScreen(game: Game, root: HTMLElement) {
  game.menuScene.show(true);
  game.camera.setMenu(true);
  game.menuScene.setFragments(5);
  game.stage.setTheme(WORLDS[4]);
  const reward = cosmeticById('skin-paradox');
  root.innerHTML = `
    <section class="screen ending" aria-live="polite">
      <div class="ending-text">${ENDING_TEXT.map((l, i) => `<p style="--d:${i * 3.2}s">${esc(l)}</p>`).join('')}</div>
      <div class="ending-final" style="--d:${ENDING_TEXT.length * 3.2 + 0.5}s">
        <h2>The loop is closed.</h2>
        <p>You recovered all five fragments of the Paradox Core.</p>
        ${reward && game.rewards.owns(reward.id) ? `<p>Final reward unlocked: <b>${esc(reward.name)}</b> cube skin.</p>` : ''}
        <div class="btn-row">
          <button class="btn primary" data-equip>Wear the Paradox skin</button>
          <button class="btn" data-menu>Return to the menu</button>
        </div>
      </div>
      <button class="link skip" data-skip>Skip</button>
    </section>`;
  game.saves.data.endingSeen = true;
  game.saves.save();
  const pulse = window.setInterval(() => game.stage.bursts.emit(game.stage.camera.position.clone().multiplyScalar(0).setY(3.4), 0xff8ae0, 20, { speed: 3, life: 1.5 }), 900);
  root.querySelector('[data-skip]')!.addEventListener('click', () => root.querySelector('.screen')!.classList.add('skipped'));
  root.querySelector('[data-equip]')!.addEventListener('click', () => {
    if (reward) game.rewards.equip(reward.id);
    game.checkAchievements();
    game.show('menu');
  });
  root.querySelector('[data-menu]')!.addEventListener('click', () => game.show('menu'));
  return () => clearInterval(pulse);
}
