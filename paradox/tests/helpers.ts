import { compileLevel } from '../src/game/core/compile';
import { initialState, step } from '../src/game/core/engine';
import type { LevelDef, State } from '../src/game/core/types';
import { SaveManager, StorageLike } from '../src/game/SaveManager';

export function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

export const freshSaves = (init: Record<string, string> = {}) => new SaveManager(memoryStorage(init));

let n = 0;
export function level(map: string, extra: Partial<LevelDef> = {}): LevelDef {
  return { id: `t-${n++}`, world: 1, number: 1, title: 't', objective: 'o', difficulty: 1, hint: 'h', map, ...extra };
}

/** Run a move string; returns every intermediate state. Throws on an invalid action. */
export function run(def: LevelDef, moves: string): State[] {
  const L = compileLevel(def);
  let s = initialState(L);
  const out = [s];
  for (const c of moves) {
    const r = step(L, s, 'NESW.RF'.indexOf(c));
    if (!r) throw new Error(`invalid action ${c} after ${out.length - 1} actions`);
    s = r.state;
    out.push(s);
  }
  return out;
}

export const xy = (def: LevelDef, cell: number) => {
  const w = compileLevel(def).w;
  return [cell % w, Math.floor(cell / w)];
};
