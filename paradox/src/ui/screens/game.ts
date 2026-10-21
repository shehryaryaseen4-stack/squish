import * as THREE from 'three';
import type { Game } from '../../game/Game';
import type { LevelDef } from '../../game/core/types';
import { $, esc, formatTime, modal, stars, toast } from '../dom';
import { icons } from '../icons';
import { t } from '../../i18n/index';
import { WORLDS } from '../../data/worlds';
import { cosmeticById } from '../../data/cosmetics';
import { parMoves, parTime, starThresholds, starsFor } from '../../game/ProgressionManager';
import { DAILY_CHALLENGE_REWARD } from '../../game/DailyManager';
import { refreshWallet } from './common';
import { settingsBody, bindSettings } from './settings';

const DIR_NAMES = ['north', 'east', 'south', 'west'];

export function gameScreen(game: Game, root: HTMLElement, params: Record<string, unknown>) {
  const def = params.def as LevelDef;
  const isDaily = def.world === 0;
  const world = WORLDS[(isDaily ? (def.number % 5) + 1 : def.world) - 1];
  const [par, two] = starThresholds(def);
  const L = { echo: !!def.echo, flips: !!def.flips };

  root.innerHTML = `
    <section class="screen game" aria-label="Level ${def.number}">
      <header class="hud-top">
        <button class="icon-btn" data-cmd="pause" aria-label="${esc(t('hud.pause'))}">${icons.pause}</button>
        <div class="hud-title">
          <small>${isDaily ? 'Daily challenge' : `${esc(world.name)} · Level ${def.number}`}</small>
          <strong>${esc(def.title)}</strong>
        </div>
        <button class="icon-btn hint-btn" data-cmd="hint" aria-label="${esc(t('hud.hint'))}">${icons.hint}<b data-hints>${game.rewards.hints}</b></button>
      </header>
      <div class="hud-info">
        <span class="chip"><small>${esc(t('hud.moves'))}</small> <b data-moves>0</b></span>
        <span class="chip star-meter" title="3 stars at ${par} actions or fewer, 2 stars at ${two}">${stars(3)}<small data-par>${esc(t('hud.par', { n: par }))}</small></span>
        <span class="chip"><small>Time</small> <b data-time>0:00</b></span>
      </div>
      <div class="hud-status" data-status aria-live="polite"></div>
      <p class="objective" data-objective>${esc(def.objective)}</p>
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
  });
  const session = ctrl.session;
  if (!session.canWait) root.querySelector('[data-needs="wait"]')?.remove();

  function updateHud() {
    const s = session.state;
    movesEl.textContent = String(s.moves);
    const st = starsFor(def, s.moves);
    starEls.forEach((e, i) => e.classList.toggle('on', i < st));
    const chips: string[] = [];
    const Lc = session.L;
    const keysTotal = Lc.items.filter((i) => i.kind === 'key').length;
    if (keysTotal) chips.push(`<span class="chip">🗝 ${s.keys}</span>`);
    const shards = Lc.items.map((it, i) => (it.kind === 'shard' ? s.items[i] : -1)).filter((v) => v >= 0);
    if (shards.length) chips.push(`<span class="chip">◆ ${shards.filter((v) => v === 1).length}/${shards.length}</span>`);
    s.timers.forEach((v, ch) => {
      if (v > 0) chips.push(`<span class="chip timer ch${ch}">⌛ ${v}</span>`);
    });
    if (Lc.clockPeriod > 1) chips.push(`<span class="chip">⏱ beat ${(s.tick % Lc.clockPeriod) + 1}/${Lc.clockPeriod}</span>`);
    if (s.grav >= 0) chips.push(`<span class="chip">⬇ gravity ${DIR_NAMES[s.grav]}</span>`);
    if (def.echo) {
      if (s.echo === 1) chips.push(`<span class="chip rec">● ${esc(t('hud.recording', { n: s.rec.length, max: def.echo }))}</span>`);
      else if (s.echo === 2) chips.push(`<span class="chip echoing">◎ Echo ${s.ghost >= 0 ? `replaying ${Math.min(s.gt, s.gm.length)}/${s.gm.length}` : 'faded'}</span>`);
    }
    if (Lc.receivers.some((r) => r.ch === undefined) || shards.length) chips.push(`<span class="chip ${s.exitOpen ? 'ok' : ''}">${s.exitOpen ? 'Exit awake' : 'Exit dormant'}</span>`);
    statusEl.innerHTML = chips.join('');
    const echoLabel = root.querySelector('[data-echo-label]');
    if (echoLabel) echoLabel.textContent = s.echo === 1 ? t('hud.rewind') : t('hud.echo');
    root.querySelector('.act.echo')?.classList.toggle('recording', s.echo === 1);
    const flips = root.querySelector('[data-flips]');
    if (flips) flips.textContent = `×${s.flips}`;
    root.querySelector('.act.flip')?.toggleAttribute('disabled', s.flips <= 0);
    refreshWallet(game, root);
  }
  updateHud();

  const timer = window.setInterval(() => {
    timeEl.textContent = formatTime(session.elapsedSeconds());
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
        { label: t('pause.resume'), kind: 'primary' },
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
    if (already) pathLabel = 'Show the next moves';
    else if (free) pathLabel = "Show the next moves (today's free hint)";
    else if (tokens > 0) pathLabel = `Show the next moves (1 of ${tokens} tokens)`;
    else pathLabel = '';
    const actions = [{ label: t('common.close'), kind: 'ghost' as const }];
    if (pathLabel)
      actions.push({
        label: pathLabel,
        kind: 'primary' as const,
        onClick: () => {
          revealPath(already ? 'none' : free ? 'free' : 'token');
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
      actions,
      onClose: () => game.controller === ctrl && !ctrl.finished && resume(),
    });
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
                  session.rewindTo(r.keep);
                  ctrl.view.sync(session.state, [], false);
                  updateHud();
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
    const res = game.progress.complete(def, s.moves, seconds, session.usedPathHint);
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
    if (res.coins) lines.push(`${icons.coin} +${res.coins} coins`);
    if (res.hints) lines.push(`${icons.hint} +${res.hints} hint${res.hints > 1 ? 's' : ''}`);
    if (dailyPaid) lines.push(`Daily reward: ${icons.coin} +${DAILY_CHALLENGE_REWARD.coins} ${icons.hint} +${DAILY_CHALLENGE_REWARD.hints}`);
    if (!res.firstClear && !res.coins && !isDaily) lines.push('<span class="muted">Replay: rewards are only paid for new stars.</span>');
    if (isDaily && !dailyPaid) lines.push('<span class="muted">Today\'s daily reward was already collected.</span>');
    const cos = res.cosmetic ? cosmeticById(res.cosmetic) : null;
    const worldDone = res.worldCompleted ? WORLDS[res.worldCompleted - 1] : null;
    const actions = [] as { label: string; kind?: 'primary' | 'ghost'; onClick?: () => void }[];
    actions.push({ label: t('complete.map'), onClick: () => game.show(isDaily ? 'daily' : 'map') });
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
        ${def.story ? `<p class="story">${esc(def.story)}</p>` : ''}`,
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
