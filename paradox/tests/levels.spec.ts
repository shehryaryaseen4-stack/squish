import { describe, expect, it } from 'vitest';
import { ALL_LEVELS, DAILY_LEVELS, WORLDS_LEVELS } from '../src/data/levels/index';
import SOLUTIONS from '../src/data/solutions.json';
import { compileLevel } from '../src/game/core/compile';
import { replay } from '../src/game/core/engine';
import { solve } from '../src/game/core/solver';

const solutions = SOLUTIONS as Record<string, string>;

describe('level catalogue', () => {
  it('has five worlds of twenty levels', () => {
    expect(WORLDS_LEVELS).toHaveLength(5);
    for (const w of WORLDS_LEVELS) expect(w).toHaveLength(20);
    expect(ALL_LEVELS).toHaveLength(100);
  });

  it('numbers levels 1..100 in order with unique ids', () => {
    ALL_LEVELS.forEach((l, i) => {
      expect(l.number).toBe(i + 1);
      expect(l.world).toBe(Math.floor(i / 20) + 1);
    });
    const ids = new Set([...ALL_LEVELS, ...DAILY_LEVELS].map((l) => l.id));
    expect(ids.size).toBe(ALL_LEVELS.length + DAILY_LEVELS.length);
  });

  it('gives every level a title, objective, hint and difficulty', () => {
    for (const l of [...ALL_LEVELS, ...DAILY_LEVELS]) {
      expect(l.title.length, l.id).toBeGreaterThan(2);
      expect(l.objective.length, l.id).toBeGreaterThan(5);
      expect(l.hint.length, l.id).toBeGreaterThan(5);
      expect(l.difficulty, l.id).toBeGreaterThanOrEqual(1);
      expect(l.difficulty, l.id).toBeLessThanOrEqual(5);
    }
  });

  it('compiles every level with exactly one start and one exit', () => {
    for (const l of [...ALL_LEVELS, ...DAILY_LEVELS]) {
      const c = compileLevel(l);
      expect(c.start, l.id).toBeGreaterThanOrEqual(0);
      expect(c.exit, l.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('introduces each mechanic with a tutorial the first time it appears', () => {
    const seen = new Set<string>(['move']);
    const tutorialFor = ['blocks', 'keys', 'pits', 'shards', 'plates', 'switches', 'beams', 'mirrors', 'portals', 'platforms', 'timers', 'bridges', 'gravity', 'flip', 'echo', 'clockwork', 'links'];
    for (const l of ALL_LEVELS) {
      const mech = compileLevel(l).mechanics.filter((m) => tutorialFor.includes(m) && !seen.has(m));
      if (mech.length) expect(l.tutorial, `${l.id} introduces ${mech.join(', ')}`).toBeTruthy();
      compileLevel(l).mechanics.forEach((m) => seen.add(m));
    }
  });

  it('places the World 5 themes in their promised ranges', () => {
    const w5 = WORLDS_LEVELS[4].map((l) => compileLevel(l));
    for (const c of w5.slice(0, 4)) expect(c.mechanics).toContain('portals');
    for (const c of w5.slice(4, 8)) expect(c.mechanics).toContain('gravity');
    for (const c of w5.slice(8, 12)) expect(c.mechanics).toContain('echo');
    for (const c of w5.slice(12, 16)) expect(c.mechanics).toContain('links');
    const finale = w5[19].mechanics;
    for (const m of ['portals', 'beams', 'gravity', 'flip', 'echo', 'links', 'plates', 'switches']) expect(finale).toContain(m);
  });
});

describe('stored solutions', () => {
  for (const l of [...ALL_LEVELS, ...DAILY_LEVELS]) {
    it(`${l.id} "${l.title}" is completed by its stored solution`, () => {
      const sol = solutions[l.id];
      expect(sol, `missing solution for ${l.id}`).toBeTruthy();
      const end = replay(compileLevel(l), sol);
      expect(end?.status, `${l.id} solution does not win`).toBe(1);
    });
  }
});

describe('independent solvability check (BFS) for levels without echoes', () => {
  for (const l of [...ALL_LEVELS, ...DAILY_LEVELS].filter((d) => !d.echo)) {
    it(`${l.id} is solvable and its par is optimal`, () => {
      const r = solve(compileLevel(l), undefined, 300000);
      expect(r.solution, `${l.id} not solved`).not.toBeNull();
      expect(r.solution!.length).toBe(solutions[l.id].length);
    });
  }
});
