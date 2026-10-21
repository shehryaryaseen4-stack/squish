import { solve } from './core/solver';
import { ACTION_CHARS, Action } from './core/types';
import { solutions } from './ProgressionManager';
import type { GameSession } from './GameSession';

export type HintResult =
  | { kind: 'path'; actions: Action[]; source: 'solution' | 'search' }
  | { kind: 'rewind'; keep: number }
  | { kind: 'none' };

const toActions = (s: string) => [...s].map((c) => ACTION_CHARS.indexOf(c)).filter((a) => a >= 0);

/**
 * Path hints. If the player is still on the stored solution, show its next
 * steps. Otherwise search from the current position with a small budget, and
 * if that is too expensive (echo levels), suggest undoing to the point where
 * the attempt left the known solution.
 */
export class HintManager {
  static compute(session: GameSession, budget = 60000): HintResult {
    const sol = solutions[session.def.id];
    const done = session.actions.map((a) => ACTION_CHARS[a]).join('');
    if (sol && sol.startsWith(done)) return { kind: 'path', actions: toActions(sol.slice(done.length)), source: 'solution' };
    if (!session.def.echo || session.state.echo === 2) {
      const r = solve(session.L, session.state, budget);
      if (r.solution) return { kind: 'path', actions: toActions(r.solution), source: 'search' };
    }
    if (sol) {
      let keep = 0;
      while (keep < done.length && done[keep] === sol[keep]) keep++;
      return { kind: 'rewind', keep };
    }
    return { kind: 'none' };
  }
}
