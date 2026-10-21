import './styles/main.css';
import { Game } from './game/Game';
import { WebGLUnavailableError } from './game/render/Stage';

function fail(message: string) {
  const ui = document.getElementById('ui')!;
  ui.innerHTML = `
    <section class="screen splash">
      <div class="logo"><div class="logo-mark" aria-hidden="true"><span></span></div><h1>PARADOX</h1></div>
      <div class="panel error-panel"><h2>Unable to start</h2><p>${message}</p>
      <p class="muted">Try updating your browser, enabling hardware acceleration, or opening the game in Chrome on Android.</p></div>
    </section>`;
}

async function boot() {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const ui = document.getElementById('ui')!;
  try {
    const game = new Game(canvas, ui);
    (window as unknown as { __paradox?: Game }).__paradox = game;
    // Give the splash a moment so the logo animation is seen on fast devices.
    await new Promise((r) => setTimeout(r, 700));
    game.start();
  } catch (e) {
    console.error(e);
    if (e instanceof WebGLUnavailableError) fail('Your browser or device could not start 3D graphics (WebGL), which this game needs.');
    else fail('Something went wrong while loading. Please reload the page.');
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}

void boot();
