import { describe, expect, it } from 'vitest';
import { compileLevel } from '../src/game/core/compile';
import { initialState, nextCell, replay, stateKey, step } from '../src/game/core/engine';
import { level, run, xy } from './helpers';

describe('movement and collisions', () => {
  it('moves onto floor and refuses walls and the void', () => {
    const def = level(`
      S.#E
      .
    `);
    const L = compileLevel(def);
    const s = initialState(L);
    expect(step(L, s, 1)).not.toBeNull(); // east onto floor
    const s1 = step(L, s, 1)!.state;
    expect(step(L, s1, 1)).toBeNull(); // wall
    expect(step(L, s1, 2)).toBeNull(); // void below (1,1)
    expect(step(L, s, 0)).toBeNull(); // off the board
  });

  it('pushes blocks, fills pits, and cannot push into walls', () => {
    const states = run(level('SBo.E'), 'EE');
    const last = states[2];
    expect(last.blocks[0]).toBe(-1); // block fell into the pit
    expect(last.items[0]).toBe(1); // pit filled
    expect(() => run(level('SB#E'), 'E')).toThrow();
  });

  it('only wins on the exit once it is awake', () => {
    const def = level('S*E');
    const s = run(def, 'EE');
    expect(s[1].items[0]).toBe(1);
    expect(s[2].status).toBe(1);
    const dormant = level(`
      S.E
      ..*
    `);
    expect(run(dormant, 'EE')[2].status).toBe(0);
  });

  it('kills on hazards', () => {
    expect(run(level('SxE'), 'E')[1].status).toBe(2);
  });

  it('needs a key for locks and consumes it', () => {
    expect(() => run(level('SLE'), 'E')).toThrow();
    const s = run(level('kSLE'), 'WEEE');
    expect(s[1].keys).toBe(1);
    expect(s[3].keys).toBe(0);
    expect(s[4].status).toBe(1);
  });

  it('opens doors while a plate is held and closes them when released', () => {
    const def = level(`
      Sp.PE
    `);
    const s = run(def, 'E');
    expect(s[1].act[0]).toBe(true);
    expect(run(def, 'EE')[2].act[0]).toBe(false);
    // The door is shut again by the time the player reaches it.
    expect(() => run(def, 'EEE')).toThrow();
  });

  it('lets the player step from a plate straight into its door, which stays open while occupied', () => {
    const def = level('SpPE');
    const s = run(def, 'EEE');
    expect(s[2].act[0]).toBe(false); // plate released...
    expect(s[3].status).toBe(1); // ...but the occupied door let the player through
  });
});

describe('portals', () => {
  it('sends the player to the paired rift', () => {
    const def = level(`
      S(   ).E
    `);
    const s = run(def, 'E');
    const [x] = xy(def, s[1].p);
    expect(x).toBe(5);
    expect(run(def, 'EEE').at(-1)!.status).toBe(1);
  });

  it('resolves pairs independently and blocks when the twin is occupied', () => {
    const def = level(`
      S([ ]B)E
    `);
    const L = compileLevel(def);
    expect(L.portalPartner[1]).toBe(6);
    expect(L.portalPartner[2]).toBe(4);
    // ')' is free, so '(' works; but pushing into '[' would need ']' free.
    const s = initialState(L);
    const r = step(L, s, 1)!;
    expect(r.state.p).toBe(6);
  });

  it('carries beams through rifts', () => {
    const def = level(`
      >.(  ).R
      S......E
    `);
    const L = compileLevel(def);
    expect(initialState(L).exitOpen).toBe(true);
  });
});

describe('gravity', () => {
  const def = level(
    `
    ######
    #.n.E#
    #....#
    #S.e.#
    ######
  `,
    { gravity: 2, flips: 1 },
  );

  it('settles the player on the floor and forbids moving along gravity', () => {
    const L = compileLevel(def);
    const s = initialState(L);
    expect(s.grav).toBe(2);
    expect(step(L, s, 0)).toBeNull();
    expect(step(L, s, 2)).toBeNull();
  });

  it('changes gravity on pads and falls to the new floor', () => {
    const s = run(def, 'EE');
    expect(s[2].grav).toBe(1);
    const [x] = xy(def, s[2].p);
    expect(x).toBe(4); // fell east against the wall
  });

  it('reverses gravity with a limited flip', () => {
    const s = run(def, 'F');
    expect(s[1].grav).toBe(0);
    expect(s[1].flips).toBe(0);
    const L = compileLevel(def);
    expect(step(L, s[1], 6)).toBeNull();
  });

  it('dies when falling out of the chamber', () => {
    const open = level(
      `
      #S.E#
      ## ##
    `,
      { gravity: 2 },
    );
    const s = run(open, 'E');
    expect(s[1].status).toBe(2);
  });
});

describe('time echo', () => {
  const def = level(
    `
    #######
    #S...p#
    #.#####
    #P#
    #E#
  `,
    { echo: 8 },
  );

  it('records, rewinds and replays deterministically', () => {
    const moves = 'REEEERS...SS';
    const a = run(def, moves);
    const b = run(def, moves);
    expect(a.map((s) => stateKey(compileLevel(def), s))).toEqual(b.map((s) => stateKey(compileLevel(def), s)));
    const rewound = a[6];
    expect(rewound.echo).toBe(2);
    expect(rewound.ghost).toBe(rewound.p); // echo starts where recording began
    expect(rewound.gm).toEqual([1, 1, 1, 1]);
    expect(a.at(-1)!.status).toBe(1);
  });

  it('auto-rewinds when the recording limit is reached', () => {
    const short = { ...def, echo: 2 };
    const s = run(short, 'REE');
    expect(s[3].echo).toBe(2);
    expect(s[3].gm).toHaveLength(2);
  });

  it('never lets the echo push blocks', () => {
    const d2 = level('S.B.E', { echo: 4 });
    const s = run(d2, 'REER..');
    const rewound = s[4];
    expect(rewound.blocks[0]).toBe(2); // the push was undone by the rewind
    expect(s[5].ghost).toBe(1);
    expect(s[6].ghost).toBe(1); // bumps into the block instead of pushing it
    expect(s[6].blocks[0]).toBe(2);
  });

  it('gives identical results when replaying a stored solution', () => {
    const L = compileLevel(def);
    expect(replay(L, 'REEEERS...SS')?.status).toBe(1);
  });
});

describe('seams (non-Euclidean links)', () => {
  it('joins distant edges and turns direction', () => {
    const def = level(
      `
      S.

        .
        E
    `,
      { links: [{ a: [1, 0, 1], b: [2, 2, 0] }] },
    );
    const L = compileLevel(def);
    const s = initialState(L);
    const n = nextCell(L, s, 1, 1);
    expect(n.cell).toBe(2 * L.w + 2);
    expect(n.dir).toBe(2); // now heading south
    expect(run(def, 'EES').at(-1)!.status).toBe(1);
  });

  it('only connects while aligned', () => {
    const def = level(
      `
      St.

        .
        E
    `,
      { links: [{ a: [2, 0, 1], b: [2, 2, 0], when: { ch: 0 } }] },
    );
    expect(() => run(def, 'EWEEE')).toThrow(); // switch on then off again: not aligned
    expect(run(def, 'E').at(-1)!.act[0]).toBe(true);
    expect(run(def, 'EEES').at(-1)!.status).toBe(1);
  });
});

describe('platforms, timers and clockwork', () => {
  it('carries the player along the rail', () => {
    const def = level('S=--.E');
    const s = run(def, 'E');
    const [x] = xy(def, s[1].p);
    expect(x).toBe(2);
  });

  it('keeps hourglass gates open for a limited number of moves', () => {
    const def = level(
      `
      S!..PE
    `,
      { legend: { '!': { kind: 'timer', ch: 0, dur: 3 } } },
    );
    expect(run(def, 'EEEEE').at(-1)!.status).toBe(1);
    const slow = level(
      `
      S!...PE
    `,
      { legend: { '!': { kind: 'timer', ch: 0, dur: 2 } } },
    );
    expect(() => run(slow, 'EEEEE')).toThrow();
  });

  it('opens clockwork gates on their beat', () => {
    const def = level('SgE', { legend: { g: { kind: 'door', when: { period: 2, phases: [1] } } } });
    expect(() => run(def, 'E')).toThrow();
    expect(run(def, '.EE').at(-1)!.status).toBe(1);
  });
});
