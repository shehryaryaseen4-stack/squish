import type { Game } from '../../game/Game';
import { topBar } from './common';

export function creditsScreen(game: Game, root: HTMLElement, params: Record<string, unknown>) {
  const bar = topBar(game, 'Credits & Privacy');
  const tab = params.tab === 'privacy' ? 'privacy' : 'credits';
  root.innerHTML = `
    <section class="screen credits">
      ${bar.html}
      <div class="tabs" role="tablist">
        <button class="tab ${tab === 'credits' ? 'on' : ''}" data-tab="credits">Credits</button>
        <button class="tab ${tab === 'privacy' ? 'on' : ''}" data-tab="privacy">Privacy</button>
      </div>
      <div class="panel scroll prose">
      ${
        tab === 'credits'
          ? `<h2>PARADOX: The Impossible Worlds</h2>
        <p>Game design, puzzles, code, procedural art and synthesised audio created for this project.</p>
        <h3>Libraries</h3>
        <ul>
          <li><b>three.js</b> (MIT License): 3D rendering, including the RoundedBoxGeometry add-on.</li>
          <li><b>Vite</b> and <b>TypeScript</b> (MIT / Apache-2.0): build tooling.</li>
          <li><b>Vitest</b> (MIT): automated tests.</li>
        </ul>
        <h3>Assets</h3>
        <p>No external images, models, fonts or audio files are used. Every texture, model and sound is generated at runtime from code.</p>
        <p class="muted">Version 1.0.0</p>`
          : `<h2>Privacy</h2>
        <p><b>Your progress stays on your device.</b> Levels, stars, coins, cosmetics, achievements and settings are saved in your browser's local storage. Nothing is uploaded, and there are no accounts.</p>
        <p>Because saves are local, they do not sync between devices or browsers, and clearing your browser data erases them. Use <i>Settings → Export save</i> to keep a copy.</p>
        <h3>Analytics and tracking</h3>
        <p>This game contains no analytics, tracking or advertising identifiers.</p>
        <h3>Advertising</h3>
        <p>${
          game.ads.name === 'none'
            ? 'No advertising network is connected in this build. Rewarded-video buttons stay hidden or disabled.'
            : game.ads.isMock
              ? 'This build uses a <b>development mock</b> for rewarded videos. It shows a labelled placeholder, contacts no ad network and collects no data.'
              : 'Rewarded videos are provided by the native app wrapper and its advertising partner, under that app\'s privacy policy. They are always optional and never interrupt a puzzle.'
        }</p>
        <h3>Offline use</h3>
        <p>When installed, the game caches its own files so it can run offline. The cache contains only the game itself.</p>`
      }
      </div>
    </section>`;
  bar.bind(root);
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => game.show('credits', { tab: b.dataset.tab })));
}
