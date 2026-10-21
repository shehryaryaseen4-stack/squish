import { initialState, levelActions, stateKey, step } from './engine';
import { ACTION_CHARS, Compiled, State } from './types';

export interface SolveResult {
  solution: string | null;
  explored: number;
  exhausted: boolean;
}

/**
 * Breadth-first search over the real simulation. Returns the shortest action
 * string (in actions) that wins, or null if none exists within the node budget.
 */
export function solve(L: Compiled, start?: State, maxNodes = 400000, prune = false): SolveResult {
  const s0 = start ?? initialState(L);
  if (s0.status === 1) return { solution: '', explored: 0, exhausted: false };
  const actions = levelActions(L);
  const states: State[] = [s0];
  const parent: number[] = [-1];
  const via: number[] = [-1];
  const seen = new Set<string>([stateKey(L, s0)]);
  for (let head = 0; head < states.length; head++) {
    if (states.length > maxNodes) return { solution: null, explored: states.length, exhausted: false };
    const s = states[head];
    for (const a of actions) {
      // Optional pruning for offline solving: while recording an echo, never
      // step straight back unless that re-triggers a switch or hourglass.
      if (prune && s.echo === 1 && a <= 3 && s.rec.length) {
        const last = s.rec[s.rec.length - 1];
        if (last <= 3 && ((last + 2) & 3) === a) {
          const prev = neighbour(L, s.p, a);
          if (prev < 0 || (L.toggleAt[prev] < 0 && L.timerAt[prev] < 0)) continue;
        }
      }
      const r = step(L, s, a);
      if (!r || r.state.status === 2) continue;
      const k = stateKey(L, r.state);
      if (seen.has(k)) continue;
      seen.add(k);
      states.push(r.state);
      parent.push(head);
      via.push(a);
      if (r.state.status === 1) {
        let out = '';
        for (let i = states.length - 1; i > 0; i = parent[i]) out = ACTION_CHARS[via[i]] + out;
        return { solution: out, explored: states.length, exhausted: false };
      }
    }
  }
  return { solution: null, explored: states.length, exhausted: true };
}

function neighbour(L: Compiled, cell: number, d: number): number {
  const x = (cell % L.w) + [0, 1, 0, -1][d];
  const y = ((cell / L.w) | 0) + [-1, 0, 1, 0][d];
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return -1;
  return y * L.w + x;
}
