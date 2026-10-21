import { compileLevel } from './core/compile';
import { cloneState, initialState, levelActions, stateKey, step } from './core/engine';
import { A_ECHO, A_FLIP, A_WAIT, Action, Compiled, GameEvent, LevelDef, State } from './core/types';

export interface ActionOutcome {
  ok: boolean;
  events: GameEvent[];
  prev: State;
  state: State;
}

/**
 * One attempt at one level: current state, undo history and the list of
 * actions taken (used for hints). Purely logical; the view listens to it.
 */
export class GameSession {
  readonly L: Compiled;
  state: State;
  readonly history: State[] = [];
  readonly actions: Action[] = [];
  startedAt = performance.now();
  pausedMs = 0;
  private pauseStart: number | null = null;
  usedPathHint = false;

  constructor(readonly def: LevelDef) {
    this.L = compileLevel(def);
    this.state = initialState(this.L);
  }

  get canWait() {
    return this.L.allowWait;
  }
  get canEcho() {
    return !!this.def.echo;
  }
  get canFlip() {
    return !!this.def.flips;
  }

  act(a: Action): ActionOutcome {
    const prev = this.state;
    const r = step(this.L, prev, a);
    if (!r) return { ok: false, events: [], prev, state: prev };
    this.history.push(prev);
    this.actions.push(a);
    this.state = r.state;
    return { ok: true, events: r.events, prev, state: r.state };
  }

  undo(): State | null {
    const s = this.history.pop();
    if (!s) return null;
    this.actions.pop();
    this.state = s;
    return s;
  }

  /** Undo back to a given number of actions. */
  rewindTo(n: number) {
    while (this.actions.length > n) this.undo();
  }

  restart() {
    this.history.length = 0;
    this.actions.length = 0;
    this.state = initialState(this.L);
    this.startedAt = performance.now();
    this.pausedMs = 0;
  }

  pause() {
    if (this.pauseStart === null) this.pauseStart = performance.now();
  }

  resume() {
    if (this.pauseStart !== null) {
      this.pausedMs += performance.now() - this.pauseStart;
      this.pauseStart = null;
    }
  }

  elapsedSeconds() {
    const now = this.pauseStart ?? performance.now();
    return Math.max(0, (now - this.startedAt - this.pausedMs) / 1000);
  }

  /**
   * Plain walking route to a cell (no pushes, keys, switches or deaths), used
   * for tap-to-move. Returns the actions, or null if there is no such route.
   */
  routeTo(target: number, maxNodes = 4000): Action[] | null {
    const s0 = this.state;
    if (s0.p === target) return [];
    const sig = (s: State) => `${s.items}|${s.blocks}|${s.toggles}|${s.mirrors}|${s.grav}|${s.flips}|${s.echo}|${s.keys}`;
    const base = sig(s0);
    const acts = levelActions(this.L).filter((a) => a <= 3 || a === A_WAIT);
    const queue: { s: State; path: Action[] }[] = [{ s: s0, path: [] }];
    const seen = new Set([stateKey(this.L, s0)]);
    for (let i = 0; i < queue.length && seen.size < maxNodes; i++) {
      const { s, path } = queue[i];
      if (path.length > 40) continue;
      for (const a of acts) {
        const r = step(this.L, s, a);
        if (!r || r.state.status === 2 || sig(r.state) !== base) continue;
        if (r.events.some((e) => e.t === 'toggle' || e.t === 'timer' || e.t === 'mirror')) continue;
        const k = stateKey(this.L, r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        const np = [...path, a];
        if (r.state.p === target) return np;
        queue.push({ s: r.state, path: np });
      }
    }
    return null;
  }

  snapshot() {
    return cloneState(this.state);
  }
}

export { A_ECHO, A_FLIP, A_WAIT };
