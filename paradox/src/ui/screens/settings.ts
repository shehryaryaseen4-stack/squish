import type { Game } from '../../game/Game';
import { confirmDialog, esc, modal, toast } from '../dom';
import { availableLanguages } from '../../i18n/index';
import { topBar } from './common';

export function settingsBody(game: Game, inGame = false) {
  const s = game.saves.data.settings;
  return `
    <form class="settings" onsubmit="return false">
      <label class="row"><span>Music</span><input type="range" min="0" max="1" step="0.05" name="music" value="${s.music}"></label>
      <label class="row"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" name="sfx" value="${s.sfx}"></label>
      <label class="row"><span>Swipe sensitivity</span><input type="range" min="0.5" max="2" step="0.1" name="sensitivity" value="${s.sensitivity}"></label>
      <label class="row"><span>Graphics quality</span>
        <select name="quality">${(['auto', 'low', 'medium', 'high'] as const).map((q) => `<option value="${q}" ${s.quality === q ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}</option>`).join('')}</select></label>
      <label class="row check"><span>Vibration${'vibrate' in navigator ? '' : ' <small>(not supported here)</small>'}</span><input type="checkbox" name="vibration" ${s.vibration ? 'checked' : ''}></label>
      <label class="row check"><span>Reduced motion</span><input type="checkbox" name="reducedMotion" ${s.reducedMotion ? 'checked' : ''}></label>
      <label class="row check"><span>On-screen direction pad</span><input type="checkbox" name="showPad" ${s.showPad ? 'checked' : ''}></label>
      <label class="row"><span>Language</span><select name="language">${availableLanguages.map((l) => `<option value="${l.id}" ${s.language === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
      ${
        inGame
          ? ''
          : `<div class="settings-data">
        <h3>Save data</h3>
        <p class="muted">Progress is stored only on this device${game.saves.persistent ? '' : ' (storage is unavailable, so progress will be lost when you close the page)'}. It does not sync between devices. Use export and import to move it.</p>
        <div class="btn-row">
          <button class="btn" data-export>Export save</button>
          <button class="btn" data-import>Import save</button>
          <button class="btn danger" data-reset>Reset progress</button>
        </div>
      </div>`
      }
    </form>`;
}

export function bindSettings(game: Game, root: HTMLElement) {
  const form = root.querySelector('form.settings')!;
  const s = game.saves.data.settings;
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    const name = t.name as keyof typeof s;
    if (!name) return;
    if (t.type === 'checkbox') (s[name] as boolean) = t.checked;
    else if (t.type === 'range') (s[name] as number) = Number(t.value);
    else (s[name] as string) = t.value;
    game.applySettings();
    game.saves.save();
    if (name === 'sfx') game.audio.play('ui');
  });
  root.querySelector('[data-export]')?.addEventListener('click', () => {
    const code = game.saves.exportString();
    const m = modal({
      title: 'Export save',
      body: `<p class="muted">Copy this code, or download it as a file, and import it on another device.</p><textarea class="code" readonly rows="5">${esc(code)}</textarea>`,
      actions: [
        {
          label: 'Download file',
          onClick: () => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
            a.download = `paradox-save-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            return false;
          },
        },
        {
          label: 'Copy',
          kind: 'primary',
          onClick: () => {
            navigator.clipboard?.writeText(code).then(
              () => toast('Copied', 'good'),
              () => toast('Copy failed: select the text and copy it manually.', 'warn'),
            );
            return false;
          },
        },
        { label: 'Close' },
      ],
    });
    m.root.querySelector<HTMLTextAreaElement>('textarea')?.select();
  });
  root.querySelector('[data-import]')?.addEventListener('click', () => {
    const m = modal({
      title: 'Import save',
      body: `<p class="muted">Paste a save code. This replaces the progress on this device.</p><textarea class="code" rows="5" data-code aria-label="Save code"></textarea>
        <p><input type="file" accept=".txt,.json,text/plain,application/json" data-file aria-label="Save file"></p>`,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Import',
          kind: 'primary',
          onClick: () => {
            const text = m.root.querySelector<HTMLTextAreaElement>('[data-code]')!.value;
            const err = game.saves.importString(text);
            if (err) {
              toast(err, 'warn');
              return false;
            }
            toast('Save imported', 'good');
            game.applySettings();
            game.show('menu');
          },
        },
      ],
    });
    m.root.querySelector<HTMLInputElement>('[data-file]')!.addEventListener('change', async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f && f.size < 2_000_000) m.root.querySelector<HTMLTextAreaElement>('[data-code]')!.value = await f.text();
    });
  });
  root.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const ok = await confirmDialog('Reset all progress?', 'This erases levels, stars, coins, cosmetics and achievements on this device. Settings are kept. This cannot be undone.', 'Erase everything', true);
    if (!ok) return;
    game.saves.reset();
    toast('Progress reset', 'info');
    game.show('menu');
  });
}

export function settingsScreen(game: Game, root: HTMLElement) {
  const bar = topBar(game, 'Settings');
  root.innerHTML = `<section class="screen settings-screen">${bar.html}<div class="panel scroll">${settingsBody(game)}</div></section>`;
  bar.bind(root);
  bindSettings(game, root);
}
