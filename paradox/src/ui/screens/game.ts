import * as THREE from 'three';
import type { Game } from '../../game/Game';
import type { LevelDef } from '../../game/core/types';
import { $, esc, formatTime, modal, stars, toast } from '../dom';
import { icons } from '../icons';
import { t } from '../../i18n/index';
import { RUSH_THEME, WORLDS, themeFor } from '../../data/worlds';
import { cosmeticById } from '../../data/cosmetics';
import { SPEED_BONUS, parMoves, parTime, starThresholds, starsFor } from '../../game/ProgressionManager';
import type { Compiled, State } from '../../game/core/types';
import { DAILY_CHALLENGE_REWARD } from '../../game/DailyManager';
import { refreshWallet } from './common';
import { settingsBody, bindSettings } from './settings';

const DIR_NAMES = ['north', 'east', 'south', 'west'];

/** Plain-language checklist of what the level needs, updated live. */
function goals(L: Compiled, s: State, rush: boolean): { text: string; done: boolean }[] {
  const out: { text: string; done: boolean }[] = [];
  const shards = L.items.map((it, i) => (it.kind === 'shard' ? s.items[i] : -1)).filter((v) => v >= 0);
  if (shards.length) {
    const got = shards.filter((v) => v === 1).length;
    out.push({ text: `${rush ? 'Grab every coin' : 'Collect every shard'} (${got}/${shards.length})`, done: got === shards.length });
  }
  const locks = L.items.filter((it) => it.kind === 'lock').length;
  if (locks) {
    const opened = L.items.filter((it, i) => it.kind === 'lock' && s.items[i] === 1).length;
    const keys = L.items.filter((it, i) => it.kind === 'key' && s.items[i] === 1).length;
    out.push({ text: `Pick up the key${locks > 1 ? 's' : ''} (${keys}/${locks})`, done: keys >= locks || opened >= locks });
    out.push({ text: `Open the lock${locks > 1 ? 's' : ''} (${opened}/${locks})`, done: opened >= locks });
  }
  const crystals = L.receivers.map((r, i) => (r.ch === undefined ? i : -1)).filter((i) => i >= 0);
  if (crystals.length) out.push({ text: 'Shine the light on the crystal', done: crystals.every((i) => s.pow[i]) });
  out.push({ text: s.exitOpen ? 'Reach the glowing exit' : 'Then reach the exit', done: s.status === 1 });
  return out;
}

export function gameScreen(game: Game, root: HTMLElement, params: Record<string, unknown>) {
  const def = params.def as LevelDef;
  const isDaily = def.world === 0;
  const isRush = def.style === 'rush';
  const world = isRush ? RUSH_THEME : themeFor(def);
  const easy = () => game.saves.data.settings.easyMode;
  const speedPaid = !!game.progress.record(def.id)?.speedBonus;
  const target = parTime(def);
  const [par, two] = starThresholds(def);
  const L = { echo: !!def.echo, flips: !!def.flips };

  root.innerHTML = `
    <section class="screen game" aria-label="Level ${def.number}">
      <header class="hud-top">
        <button class="icon-btn" data-cmd="pause" aria-label="${esc(t('hud.pause'))}">${icons.pause}</button>
        <div class="hud-title">
          <small>${isDaily ? 'Daily challenge' : isRush ? `⚡ Coin Rush · ${def.number}` : `${esc(world.name)} · Level ${def.number}`}</small>
          <strong>${esc(def.title)}</strong>
        </div>
        <button class="icon-btn hint-btn" data-cmd="hint" aria-label="${esc(t('hud.hint'))}">${icons.hint}<b data-hints>${game.rewards.hints}</b></button>
      </header>
      <div class="hud-info">
        <span class="chip"><small>${esc(t('hud.moves'))}</small> <b data-moves>0</b></span>
        <span class="chip star-meter" title="3 stars at ${par} actions or fewer, 2 stars at ${two}">${stars(3)}<small data-par>${esc(t('hud.par', { n: par }))}</small></span>
        <span class="chip"><small>Time</small> <b data-time>0:00</b></span>
        ${game.progress.record(def.id)?.done ? `<span class="chip"><small>Best</small> <b>${game.progress.record(def.id)!.bestMoves}</b></span>` : ''}
        <span class="chip coins" data-coinchip hidden>${icons.coin} <b data-coincount>0</b></span>
      </div>
      ${speedPaid || isDaily ? '' : `<div class="race" title="Finish within ${formatTime(target)} for +${SPEED_BONUS} coins"><span data-race></span><small data-race-label>⚡ Speed bonus +${SPEED_BONUS}</small></div>`}
      <div class="hud-status" data-status aria-live="polite"></div>
      <div class="goal-card" data-goalcard>
        <p class="objective">${esc(def.objective)}</p>
        <ul class="goals" data-goals></ul>
        <p class="tip" data-tip ${easy() ? '' : 'hidden'}>💡 ${esc(def.hint)}</p>
      </div>
      <div class="popups" data-popups aria-hidden="true"></div>
      <div class="hud-msg" data-msg aria-live="assertive"></div>
      <footer class="hud-bottom">
        <div class="hud-actions">
          <button class="act" data-cmd="undo" aria-label="${esc(t('hud.undo'))}">${icons.undo}<span>${esc(t('hud.undo'))}</span></button>
          <button class="act" data-cmd="restart" aria-label="${esc(t('hud.restart'))}">${icons.restart}<span>${esc(t('hud.restart'))}</span></button>
          ${def.gravity === undefined ? `<button class="act small" data-cmd="rotL" aria-label="Turn view left">${icons.rotL}</button><button class="act small" data-cmd="rotR" aria-label="Turn view right">${icons.rotR}</button>` : ''}
          <button class="act" data-cmd="wait" data-needs="wait" aria-label="${esc(t('hud.wait'))}">${icons.wait}<span>${esc(t('hud.wait'))}</span></button>
          ${L.echo ? `<button class="act echo" data-cmd="echo" aria-label="${esc(t('hud.echo'))}">${icons.echo}<span data-echo-label>${esc(t('hud.echo'))}</span></button>` : ''}
          ${L.flips ? `<button class="act flip" data-cmd="flip" aria-label="${esc(t('hud.flip'))}">${icons.flip}<span>${esc(t('hud.flip'))} <b data-flips></b></span></button>` : ''}
        </div>
        <div class="dpad" aria-label="Direction pad">
          <button data-pad="0,-1" class="up" aria-label="Up">${icons.up}</button>
          <button data-pad="-1,0" class="left" aria-label="Left">${icons.left}</button>
          <button data-pad="1,0" class="right" aria-label="Right">${icons.right}</button>
          <button data-pad="0,1" class="down" aria-label="Down">${icons.down}</button>
        </div>
      </footer>
    </section>`;

  const movesEl = $(root, '[data-moves]');
  const timeEl = $(root, '[data-time]');
  const statusEl = $(root, '[data-status]');
  const msgEl = $(root, '[data-msg]');
  const starEls = root.querySelectorAll<HTMLElement>('.star-meter .stars i');
  let msgTimer = 0;

  const showMsg = (text: string) => {
    msgEl.textContent = text;
    msgEl.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = window.setTimeout(() => msgEl.classList.remove('show'), 1800);
  };

  const ctrl = game.createController(def, {
    onChange: () => updateHud(),
    onWin: () => onWin(),
    onPause: () => openPause(),
    onHint: () => openHint(),
    onMessage: showMsg,
    vibrate: (p) => game.vibrate(p),
    onCoin: (cell, combo) => popup(cell, combo),
  });
  const session = ctrl.session;
  if (!session.canWait) root.querySelector('[data-needs="wait"]')?.remove();
  const coinTotal = isRush ? session.L.items.filter((i) => i.kind === 'shard').length : ctrl.bonusCells.length;
  const coinChip = root.querySelector<HTMLElement>('[data-coinchip]')!;
  if (coinTotal && !isRush) coinChip.hidden = false;
  const goalsEl = $(root, '[data-goals]');
  const popupsEl = $(root, '[data-popups]');

  /** Floating "+1" / combo text above the cell where a coin was taken. */
  function popup(cell: number, combo: number) {
    const v = ctrl.view.cellWorld(cell).project(game.stage.camera);
    const el = document.createElement('div');
    el.className = `popup ${combo >= 3 ? 'big' : ''}`;
    el.textContent = combo >= 2 ? `COMBO ×${combo}!` : '+1';
    el.style.left = `${((v.x + 1) / 2) * 100}%`;
    el.style.top = `${((1 - v.y) / 2) * 100}%`;
    popupsEl.appendChild(el);
    setTimeout(() => el.remove(), 1000);
    if (combo >= 3) game.vibrate(15);
  }

  function updateHud() {
    const s = session.state;
    movesEl.textContent = String(s.moves);
    const st = starsFor(def, s.moves);
    starEls.forEach((e, i) => e.classList.toggle('on', i < st));
    const chips: string[] = [];
    const Lc = session.L;
    s.timers.forEach((v, ch) => {
      if (v > 0) chips.push(`<span class="chip timer ch${ch}">⌛ ${v}</span>`);
    });
    if (Lc.clockPeriod > 1) chips.push(`<span class="chip">⏱ beat ${(s.tick % Lc.clockPeriod) + 1}/${Lc.clockPeriod}</span>`);
    if (s.grav >= 0) chips.push(`<span class="chip">⬇ gravity ${DIR_NAMES[s.grav]}</span>`);
    if (def.echo) {
      if (s.echo === 1) chips.push(`<span class="chip rec">● ${esc(t('hud.recording', { n: s.rec.length, max: def.echo }))}</span>`);
      else if (s.echo === 2) chips.push(`<span class="chip echoing">◎ Echo ${s.ghost >= 0 ? `replaying ${Math.min(s.gt, s.gm.length)}/${s.gm.length}` : 'faded'}</span>`);
    }
    statusEl.innerHTML = chips.join('');
    const list = goals(Lc, s, isRush);
    const current = list.findIndex((g) => !g.done);
    goalsEl.innerHTML = list.map((g, i) => `<li class="${g.done ? 'done' : ''} ${i === current ? 'now' : ''}">${g.done ? '✓' : i === current ? '➜' : '○'} ${esc(g.text)}</li>`).join('');
    root.querySelector('[data-coincount]')!.textContent = `${ctrl.coinsCollected}/${coinTotal}`;
    const echoLabel = root.querySelector('[data-echo-label]');
    if (echoLabel) echoLabel.textContent = s.echo === 1 ? t('hud.rewind') : t('hud.echo');
    root.querySelector('.act.echo')?.classList.toggle('recording', s.echo === 1);
    const flips = root.querySelector('[data-flips]');
    if (flips) flips.textContent = `×${s.flips}`;
    root.querySelector('.act.flip')?.toggleAttribute('disabled', s.flips <= 0);
    refreshWallet(game, root);
  }
  updateHud();

  const raceEl = root.querySelector<HTMLElement>('[data-race]');
  const raceLabel = root.querySelector<HTMLElement>('[data-race-label]');
  let idleHintShown = false;
  const timer = window.setInterval(() => {
    const sec = session.elapsedSeconds();
    timeEl.textContent = formatTime(sec);
    if (raceEl && raceLabel) {
      const left = Math.max(0, 1 - sec / target);
      raceEl.style.width = `${left * 100}%`;
      raceEl.parentElement!.classList.toggle('low', left < 0.25);
      raceLabel.textContent = left > 0 ? `⚡ Speed bonus +${SPEED_BONUS} · ${Math.ceil(target - sec)}s` : 'Speed bonus missed (no problem!)';
    }
    // Easy mode: if you stand still for a while, the next moves light up for free.
    const idle = (performance.now() - ctrl.lastActionAt) / 1000;
    if (easy() && !ctrl.paused && !ctrl.finished && idle > 15 && !idleHintShown && !ctrl.hintActions?.length) {
      idleHintShown = true;
      const r = ctrl.showHint();
      if (r.kind === 'path' && r.actions.length) showMsg('Stuck? Follow the glowing arrows.');
    }
    if (idle < 1) idleHintShown = false;
  }, 500);

  root.querySelectorAll<HTMLButtonElement>('[data-cmd]').forEach((b) =>
    b.addEventListener('click', () => {
      game.audio.unlock();
      ctrl.command(b.dataset.cmd as never);
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-pad]').forEach((b) => {
    const [x, y] = b.dataset.pad!.split(',').map(Number);
    b.addEventListener('click', () => {
      game.audio.unlock();
      ctrl.screenDir(new THREE.Vector2(x, y));
    });
  });

  // ---------- pause ----------
  function openPause() {
    if (ctrl.finished) return;
    ctrl.pause();
    game.input.enabled = false;
    modal({
      title: t('pause.title'),
      body: `<p class="muted">${esc(def.title)} · ${session.state.moves} moves · ${formatTime(session.elapsedSeconds())}</p>`,
      actions: [
        { label: t('pause.settings'), onClick: () => (openSettings(), true) },
        { label: t('pause.quit'), onClick: () => void game.show(isDaily ? 'daily' : 'levels', { world: def.world }) },
        { label: t('pause.restart'), onClick: () => void ctrl.restart() },
        ...(isDaily ? [] : [{ label: 'Skip level', onClick: () => void skipLevel() }]),
        { label: t('pause.resume'), kind: 'primary' as const },
      ],
      onClose: () => {
        if (game.controller === ctrl && !document.querySelector('.modal-backdrop.settings-modal')) resume();
      },
    });
  }
  function resume() {
    ctrl.resume();
    game.input.enabled = true;
  }
  function openSettings() {
    ctrl.pause();
    game.input.enabled = false;
    const m = modal({
      title: 'Settings',
      className: 'settings-modal',
      body: settingsBody(game, true),
      actions: [{ label: t('common.close'), kind: 'primary' }],
      onClose: () => game.controller === ctrl && resume(),
    });
    bindSettings(game, m.root);
  }

  // ---------- hints ----------
  function openHint() {
    if (ctrl.finished) return;
    ctrl.pause();
    game.input.enabled = false;
    const already = session.usedPathHint;
    const free = game.daily.freeHintAvailable();
    const tokens = game.rewards.hints;
    const adOk = game.ads.isRewardedAdAvailable() && game.rewards.adHintsLeftToday(game.daily.today) > 0;
    let pathLabel: string;
    if (already || easy()) pathLabel = easy() && !already ? 'Show the next moves (free in Easy mode)' : 'Show the next moves';
    else if (free) pathLabel = "Show the next moves (today's free hint)";
    else if (tokens > 0) pathLabel = `Show the next moves (1 of ${tokens} tokens)`;
    else pathLabel = '';
    const actions = [{ label: t('common.close'), kind: 'ghost' as const }];
    if (pathLabel)
      actions.push({
        label: pathLabel,
        kind: 'primary' as const,
        onClick: () => {
          revealPath(already || easy() ? 'none' : free ? 'free' : 'token');
        },
      } as never);
    if (!pathLabel && adOk)
      actions.push({
        label: `Watch a video for a hint token${game.ads.isMock ? ' (mock)' : ''}`,
        kind: 'primary' as const,
        onClick: () => {
          watchAdForHint();
        },
      } as never);
    modal({
      title: 'Hint',
      body: `<p class="hint-text">${esc(def.hint)}</p>
        ${
          pathLabel
            ? '<p class="muted">Path hints light up your next moves on the board.</p>'
            : `<p class="muted">You have no hint tokens left. Earn them by clearing levels (one every five), finishing worlds, the daily challenge and achievements.${adOk ? '' : ' Rewarded videos are not available right now.'}</p>`
        }`,
      actions: [...actions, { label: 'Skip level', kind: 'ghost' as const, onClick: () => void skipLevel() }],
      onClose: () => game.controller === ctrl && !ctrl.finished && resume(),
    });
  }

  /** Skipping opens the next level without rewards; you can come back any time. */
  function skipLevel() {
    if (isDaily) return void game.show('daily');
    game.progress.skip(def);
    const next = game.nextLevel(def);
    toast('Level skipped. Come back any time to earn its stars.', 'info');
    if (next) game.play(next);
    else game.show(isRush ? 'levels' : 'map', { world: def.world });
  }

  function revealPath(cost: 'none' | 'free' | 'token') {
    const r = ctrl.showHint();
    if (r.kind === 'path') {
      if (cost === 'free') game.daily.useFreeHint();
      else if (cost === 'token') game.rewards.spendHint();
      if (cost !== 'none') {
        game.saves.data.stats.pathHints++;
        game.saves.save();
      }
      updateHud();
      toast(r.actions.length ? 'Follow the glowing markers.' : 'You are already at the goal.', 'info');
    } else if (r.kind === 'rewind') {
      const undoCount = session.actions.length - r.keep;
      setTimeout(
        () =>
          modal({
            title: 'Off the known path',
            body: `<p>This attempt has drifted away from the route the hint system knows. Undo ${undoCount} move${undoCount === 1 ? '' : 's'} to get back on it (free).</p>`,
            actions: [
              { label: t('common.cancel') },
              {
                label: `Undo ${undoCount}`,
                kind: 'primary',
                onClick: () => {
                  ctrl.rewindTo(r.keep);
                  setTimeout(() => revealPath('none'), 50);
                },
              },
            ],
          }),
        260,
      );
    } else toast('No hint is available for this position. Try undoing a few moves.', 'warn');
  }

  function watchAdForHint() {
    game.ads.showRewardedAd(
      (txId) => {
        if (game.rewards.applyAdReward(txId, 'hint', game.daily.today)) {
          toast('+1 hint token', 'good');
          game.audio.play('coin');
          updateHud();
        }
      },
      () => {
        if (game.controller === ctrl && !ctrl.finished && !document.querySelector('.modal-backdrop')) resume();
      },
      (m) => toast(m, 'warn'),
    );
  }

  // ---------- tutorial ----------
  const tutKey = `tut-${def.id}`;
  if (def.tutorial && !game.saves.data.seen.includes(tutKey)) {
    ctrl.pause();
    game.input.enabled = false;
    modal({
      title: def.title,
      body: `<p>${esc(def.tutorial)}</p>${
        def.number === 1 && !isDaily
          ? `<ul class="controls-help"><li><b>Move:</b> swipe, arrow keys / WASD, the direction pad, or tap a tile.</li><li><b>Undo:</b> Z or Backspace. <b>Pause:</b> Esc.</li><li><b>Turn the view:</b> Q and E, or the rotate buttons.</li></ul>`
          : ''
      }`,
      actions: [{ label: t('common.ok'), kind: 'primary' }],
      onClose: () => {
        game.saves.data.seen.push(tutKey);
        game.saves.save();
        resume();
      },
    });
  }

  // ---------- completion ----------
  function onWin() {
    const s = session.state;
    const seconds = session.elapsedSeconds();
    game.input.enabled = false;
    const res = game.progress.complete(def, s.moves, seconds, session.usedPathHint, { boardCoins: isRush ? 0 : ctrl.coinsCollected });
    let dailyPaid = false;
    if (isDaily) dailyPaid = game.daily.completeChallenge(def.id);
    if (def.echo) {
      game.saves.data.stats.echoes++;
      game.saves.save();
    }
    const unlocked = game.achievements.check();
    const next = game.nextLevel(def);
    const finale = def.id === 'w5-20';
    const lines: string[] = [];
    if (res.firstClear && !isDaily) lines.push(`First clear`);
    if (coinTotal && !isRush) lines.push(`Board coins: ${ctrl.coinsCollected}/${coinTotal}${res.boardCoins ? ` (+${res.boardCoins} new)` : ''}`);
    if (ctrl.bestCombo >= 2) lines.push(`🔥 Best combo ×${ctrl.bestCombo}`);
    if (res.speedBonus) lines.push(`⚡ Speed bonus +${res.speedBonus}`);
    if (res.coins) lines.push(`${icons.coin} +${res.coins} coins in total`);
    if (res.hints) lines.push(`${icons.hint} +${res.hints} hint${res.hints > 1 ? 's' : ''}`);
    if (dailyPaid) lines.push(`Daily reward: ${icons.coin} +${DAILY_CHALLENGE_REWARD.coins} ${icons.hint} +${DAILY_CHALLENGE_REWARD.hints}`);
    if (!res.firstClear && !res.coins && !isDaily) lines.push('<span class="muted">Replay: rewards are only paid for new stars.</span>');
    if (isDaily && !dailyPaid) lines.push('<span class="muted">Today\'s daily reward was already collected.</span>');
    const cos = res.cosmetic ? cosmeticById(res.cosmetic) : null;
    const worldDone = res.worldCompleted ? WORLDS[res.worldCompleted - 1] : null;
    void WORLDS;
    const actions = [] as { label: string; kind?: 'primary' | 'ghost'; onClick?: () => void }[];
    actions.push({ label: t('complete.map'), onClick: () => game.show(isDaily ? 'daily' : isRush ? 'levels' : 'map', { world: def.world }) });
    actions.push({ label: t('complete.replay'), onClick: () => game.play(def) });
    if (finale) actions.push({ label: 'Continue', kind: 'primary', onClick: () => game.show('ending') });
    else if (next && !isDaily) actions.push({ label: t('complete.next'), kind: 'primary', onClick: () => game.play(next) });
    modal({
      title: t('complete.title'),
      className: 'complete',
      dismissible: false,
      body: `
        <div class="complete-stars">${stars(res.stars)}</div>
        <p class="complete-stats">${s.moves} actions · par ${parMoves(def)} · ${formatTime(seconds)} (target ${formatTime(parTime(def))})</p>
        ${res.newBestMoves && !res.firstClear ? '<p class="good">New best!</p>' : ''}
        <div class="reward-lines">${lines.map((l) => `<p>${l}</p>`).join('')}</div>
        ${worldDone ? `<div class="world-done"><h3>Fragment recovered: ${esc(worldDone.name)}</h3><p>+100 coins, +3 hints${cos ? `, and the <b>${esc(cos.name)}</b> skin` : ''}.</p></div>` : ''}
        ${def.story ? `<p class="story">${esc(def.story)}</p>` : ''}
        ${next && next.tutorial && !game.progress.isDone(next.id) ? `<p class="muted">Up next: <b>${esc(next.title)}</b> introduces something new.</p>` : ''}`,
      actions,
    });
    root.querySelector('.modal.panel .complete-stars')?.classList.add('animate');
    game.announce(unlocked);
    refreshWallet(game);
  }

  return () => {
    clearInterval(timer);
    clearTimeout(msgTimer);
    document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
  };
}
