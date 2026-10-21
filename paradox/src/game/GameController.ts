import * as THREE from 'three';
import { initialState, step } from './core/engine';
import { solutions } from './ProgressionManager';
import { A_ECHO, A_FLIP, A_WAIT, ACTION_CHARS, Action, GameEvent, LevelDef, T_FLOOR } from './core/types';
import { GameSession } from './GameSession';
import { HintManager } from './HintManager';
import { BoardView, SkinColors } from './render/BoardView';
import type { Stage } from './render/Stage';
import type { CameraController } from './render/CameraController';
import type { AudioManager, Sfx } from './AudioManager';
import type { WorldTheme } from '../data/worlds';
import { Command, InputManager } from './InputManager';

export interface ControllerHooks {
  onChange(): void;
  onWin(): void;
  onPause(): void;
  onHint(): void;
  onMessage(text: string): void;
  vibrate(ms: number | number[]): void;
  /** A coin was picked up (board bonus coin or Coin Rush coin). */
  onCoin(cell: number, combo: number): void;
}

/**
 * Runs one level: turns input into simulation actions, keeps the 3D view in
 * step and reports progress to the HUD. Rewards are handled by the caller.
 */
export class GameController {
  readonly session: GameSession;
  readonly view: BoardView;
  private queue: Action[] = [];
  private autoPath: Action[] = [];
  private busyUntil = 0;
  private deathTimer: number | null = null;
  private removeUpdater: () => void;
  paused = false;
  finished = false;
  hintActions: Action[] | null = null;
  /** performance.now() of the last player action, for automatic hints. */
  lastActionAt = performance.now();
  /** Bonus coins placed along the known route. */
  readonly bonusCells: number[];
  /** Pickups with the action count at which they happened (so undo can return them). */
  private coinLog: { at: number; cell: number }[] = [];
  private lastPickupAt = -99;
  private combo = 0;
  bestCombo = 0;

  constructor(
    readonly def: LevelDef,
    private stage: Stage,
    private cam: CameraController,
    private audio: AudioManager,
    private input: InputManager,
    theme: WorldTheme,
    skin: SkinColors,
    private hooks: ControllerHooks,
  ) {
    this.session = new GameSession(def);
    this.view = new BoardView(stage, this.session.L, this.session.state, theme, skin);
    this.bonusCells = def.style === 'rush' ? [] : this.placeBonusCoins();
    this.view.setBonusCoins(this.bonusCells);
    cam.frameBoard(this.session.L.w, this.session.L.h, this.view.gravityMode);
    this.frameGravity();
    this.removeUpdater = stage.addUpdater((dt, t) => this.tick(dt, t));
  }

  get state() {
    return this.session.state;
  }

  /** Bonus coins collected in the current attempt. */
  get coinsCollected() {
    return this.coinLog.length;
  }

  /**
   * Scatter a few bonus coins along the stored solution route. They are
   * optional, always reachable, and gently show the way.
   */
  private placeBonusCoins(): number[] {
    const sol = solutions[this.def.id];
    if (!sol) return [];
    const L = this.session.L;
    let s = initialState(L);
    const route: number[] = [];
    for (const ch of sol) {
      const r = step(L, s, ACTION_CHARS.indexOf(ch));
      if (!r) break;
      s = r.state;
      const c = s.p;
      const plain =
        L.terrain[c] === T_FLOOR && L.itemAt[c] < 0 && L.plateAt[c] < 0 && L.toggleAt[c] < 0 && L.timerAt[c] < 0 &&
        L.portalPartner[c] < 0 && L.padAt[c] < 0 && L.doorAt[c] < 0 && L.bridgeAt[c] < 0 && c !== L.start;
      if (plain && !route.includes(c)) route.push(c);
    }
    return route.filter((_c, i) => i % 3 === 1).slice(0, 6);
  }

  private collectedSet() {
    return new Set(this.coinLog.map((c) => c.cell));
  }

  /** Drop pickups made after the current point in history (undo, rewind, restart). */
  private trimCoins() {
    const n = this.session.actions.length;
    this.coinLog = this.coinLog.filter((c) => c.at <= n);
    this.view.syncBonusCoins(this.collectedSet());
  }

  private pickups(events: GameEvent[]) {
    const n = this.session.actions.length;
    const got: number[] = [];
    const p = this.state.p;
    if (this.bonusCells.includes(p) && !this.coinLog.some((c) => c.cell === p)) {
      this.coinLog.push({ at: n, cell: p });
      got.push(p);
    }
    if (this.def.style === 'rush') for (const e of events) if (e.t === 'shard') got.push(e.cell);
    for (const cell of got) {
      this.combo = n - this.lastPickupAt <= 3 ? this.combo + 1 : 1;
      this.lastPickupAt = n;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.view.coinBurst(cell);
      this.audio.coin(this.combo);
      this.hooks.onCoin(cell, this.combo);
    }
    if (got.length) this.view.syncBonusCoins(this.collectedSet());
  }

  private tick(dt: number, t: number) {
    this.view.update(dt, t);
    if (this.paused || this.finished || this.deathTimer !== null) return;
    if (performance.now() < this.busyUntil) return;
    const next = this.queue.shift() ?? this.autoPath.shift();
    if (next !== undefined) this.perform(next);
  }

  /** Called by input: a screen-space direction. */
  screenDir(v: THREE.Vector2) {
    if (!this.acceptsInput()) return;
    const dirs = this.view.screenDirs(this.stage.camera, this.stage.canvas.clientWidth, this.stage.canvas.clientHeight);
    let best = 0;
    let bestDot = -Infinity;
    dirs.forEach((d, i) => {
      const dot = d.dot(v);
      if (dot > bestDot) {
        bestDot = dot;
        best = i;
      }
    });
    this.enqueue(best);
  }

  tap(ndc: THREE.Vector2) {
    if (!this.acceptsInput()) return;
    const cell = this.view.pick(ndc, this.stage.camera);
    if (cell < 0) return;
    const L = this.session.L;
    const p = this.state.p;
    const dx = (cell % L.w) - (p % L.w);
    const dy = ((cell / L.w) | 0) - ((p / L.w) | 0);
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      this.enqueue(dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0);
      return;
    }
    const route = this.session.routeTo(cell);
    if (route && route.length) {
      this.queue.length = 0;
      this.autoPath = route;
    } else if (!route) this.audio.play('error');
  }

  command(c: Command) {
    if (c === 'pause') return this.hooks.onPause();
    if (!this.acceptsInput() && c !== 'undo') return;
    switch (c) {
      case 'wait':
        if (this.session.canWait) this.enqueue(A_WAIT);
        break;
      case 'echo':
        if (this.session.canEcho) this.enqueue(A_ECHO);
        break;
      case 'flip':
        if (this.session.canFlip) this.enqueue(A_FLIP);
        break;
      case 'undo':
        this.undo();
        break;
      case 'restart':
        this.restart();
        break;
      case 'hint':
        this.hooks.onHint();
        break;
      case 'rotL':
        this.cam.rotate(-1);
        break;
      case 'rotR':
        this.cam.rotate(1);
        break;
    }
  }

  private acceptsInput() {
    return !this.paused && !this.finished && this.deathTimer === null;
  }

  enqueue(a: Action) {
    this.autoPath.length = 0;
    if (this.queue.length < 2) this.queue.push(a);
  }

  private perform(a: Action) {
    const out = this.session.act(a);
    if (!out.ok) {
      this.queue.length = 0;
      this.autoPath.length = 0;
      this.audio.play(a === A_ECHO || a === A_FLIP || a === A_WAIT ? 'error' : 'bump');
      this.hooks.vibrate(12);
      return;
    }
    this.lastActionAt = performance.now();
    const rewound = out.events.some((e) => e.t === 'rewind');
    this.view.sync(out.state, rewound ? [] : out.events, !rewound);
    this.frameGravity();
    if (rewound) this.trimCoins();
    else if (out.state.status !== 2) this.pickups(out.events);
    if (out.events.some((e) => e.t === 'push')) this.cam.shake(0.07);
    if (rewound) this.view.rewindFlash();
    this.playSounds(out.events, a);
    this.busyUntil = performance.now() + (this.stage.reducedMotion ? 70 : 140) + this.extraDelay(out.events);
    this.advanceHint(a);
    this.hooks.onChange();
    if (out.state.status === 2) this.die(out.events);
    else if (out.state.status === 1) this.win();
  }

  /** Keep a sideways gravity chamber fitted to the screen. */
  private frameGravity() {
    if (this.view.gravityMode) this.cam.setSwapped(this.state.grav === 1 || this.state.grav === 3);
  }

  private extraDelay(ev: GameEvent[]) {
    const falls = ev.filter((e) => e.t === 'fall').length;
    const blink = ev.some((e) => e.t === 'teleport' || e.t === 'link');
    return falls * 40 + (blink ? 180 : 0) + (ev.some((e) => e.t === 'gravity') ? 200 : 0);
  }

  private playSounds(ev: GameEvent[], a: Action) {
    const has = (t: GameEvent['t']) => ev.some((e) => e.t === t);
    if (has('win')) return;
    if (has('dead')) return;
    if (has('rewind')) return this.audio.play('rewind');
    if (has('record')) return this.audio.play('record');
    if (has('gravity')) this.audio.play('gravity');
    if (has('teleport') || has('link')) this.audio.play('portal');
    if (has('key')) this.audio.play('key');
    if (has('shard')) this.audio.play('shard');
    if (has('unlock')) this.audio.play('unlock');
    if (has('toggle') || has('timer')) this.audio.play('switch');
    if (has('mirror')) this.audio.play('mirror');
    if (has('push')) this.audio.play('push');
    else if (a === A_WAIT) this.audio.play('wait');
    else if (has('move')) this.audio.play('move');
    if (has('fill')) this.cam.shake(0.15);
    for (const e of ev) {
      if (e.t === 'key' || e.t === 'shard') this.view.burstAt(e.cell, 0xffe08a, 20);
      if (e.t === 'unlock') this.view.burstAt(e.cell, 0xffd060, 16);
    }
  }

  private die(ev: GameEvent[]) {
    const reason = ev.find((e) => e.t === 'dead');
    this.audio.play(reason && reason.t === 'dead' && reason.reason === 'fall' ? 'fall' : 'death');
    this.hooks.vibrate([30, 40, 60]);
    this.cam.shake(0.35);
    this.view.shatter();
    this.queue.length = 0;
    this.autoPath.length = 0;
    const msg =
      reason && reason.t === 'dead'
        ? reason.reason === 'fall'
          ? 'Lost to the void. Stepping back…'
          : reason.reason === 'loop'
            ? 'Caught in an endless fall. Stepping back…'
            : 'Zapped! Stepping back…'
        : 'Stepping back…';
    this.hooks.onMessage(msg);
    this.deathTimer = window.setTimeout(() => {
      this.deathTimer = null;
      this.session.undo();
      this.view.sync(this.session.state, [], false);
      this.trimCoins();
      this.frameGravity();
      this.view.reveal();
      this.hooks.onChange();
    }, 750);
  }

  private win() {
    this.finished = true;
    this.queue.length = 0;
    this.autoPath.length = 0;
    this.audio.play('win');
    this.hooks.vibrate([20, 30, 20, 30, 60]);
    this.view.celebrate();
    window.setTimeout(() => this.hooks.onWin(), this.stage.reducedMotion ? 300 : 900);
  }

  undo() {
    if (this.deathTimer !== null || this.finished) return false;
    this.queue.length = 0;
    this.autoPath.length = 0;
    const s = this.session.undo();
    if (!s) {
      this.audio.play('error');
      return false;
    }
    this.view.sync(s, [], false);
    this.trimCoins();
    this.lastActionAt = performance.now();
    this.frameGravity();
    this.audio.play('ui');
    this.refreshHint();
    this.hooks.onChange();
    return true;
  }

  restart() {
    if (this.deathTimer !== null) {
      clearTimeout(this.deathTimer);
      this.deathTimer = null;
    }
    this.finished = false;
    this.queue.length = 0;
    this.autoPath.length = 0;
    this.session.restart();
    this.view.reveal();
    this.view.sync(this.session.state, [], false);
    this.trimCoins();
    this.combo = 0;
    this.lastPickupAt = -99;
    this.lastActionAt = performance.now();
    this.frameGravity();
    this.hintActions = null;
    this.hooks.onChange();
  }

  /** Undo back to `n` actions (used by the hint system). */
  rewindTo(n: number) {
    this.session.rewindTo(n);
    this.view.sync(this.session.state, [], false);
    this.trimCoins();
    this.frameGravity();
    this.hooks.onChange();
  }

  /** Reveal the next steps of a path hint on the board. */
  showHint(): ReturnType<typeof HintManager.compute> {
    const r = HintManager.compute(this.session);
    if (r.kind === 'path') {
      this.session.usedPathHint = true;
      this.hintActions = r.actions;
      this.drawHint();
    }
    return r;
  }

  private drawHint() {
    if (!this.hintActions || !this.hintActions.length) return this.view.clearHint();
    let s = this.session.state;
    const cells: number[] = [];
    const dirs: (number | null)[] = [];
    for (const a of this.hintActions.slice(0, 4)) {
      const r = step(this.session.L, s, a);
      cells.push(s.p);
      dirs.push(a <= 3 ? a : null);
      if (!r) break;
      s = r.state;
    }
    this.view.showHint(cells, dirs);
  }

  private advanceHint(a: Action) {
    if (!this.hintActions) return;
    if (this.hintActions[0] === a) {
      this.hintActions.shift();
      this.drawHint();
    } else {
      this.hintActions = null;
      this.view.clearHint();
    }
  }

  private refreshHint() {
    if (this.hintActions) {
      this.hintActions = null;
      this.view.clearHint();
    }
  }

  pause() {
    this.paused = true;
    this.session.pause();
  }

  resume() {
    this.paused = false;
    this.session.resume();
  }

  dispose() {
    if (this.deathTimer !== null) clearTimeout(this.deathTimer);
    this.removeUpdater();
    this.view.dispose();
    this.input.enabled = false;
  }
}

export type { Sfx };
