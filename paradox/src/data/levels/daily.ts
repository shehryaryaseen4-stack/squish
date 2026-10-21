import type { LevelDef } from '../../game/core/types';

const D = (n: number, d: Omit<LevelDef, 'id' | 'world' | 'number'>): LevelDef => ({
  id: `daily-${n}`,
  world: 0,
  number: n,
  ...d,
});

// A rotating pool of validated daily puzzles. The day of the year picks one,
// so the challenge is deterministic, needs no server and works offline.
export const DAILY: LevelDef[] = [
  D(1, {
    title: 'Morning Ruins',
    objective: 'Stone, plate and key before breakfast.',
    difficulty: 3,
    hint: 'Push the stone straight down onto the plate, then take the key through the lock.',
    map: String.raw`
      #########
      #S.k#...#
      #.B.#.#.#
      #...L.#.#
      ##.####.#
      ##p####P#
      #######E#
    `,
  }),
  D(2, {
    title: 'Rift Errand',
    objective: 'Bend the light through the rift.',
    difficulty: 3,
    hint: 'Cross through the rift and turn the mirror, then come back.',
    map: String.raw`
      #######R#
      #>..(#..#
      #....#)\#
      #S..E####
    `,
  }),
  D(3, {
    title: 'Tidewatch',
    objective: 'Ride the drifting platform and beat the hourglass.',
    difficulty: 3,
    hint: 'Trigger the hourglass only once the platform is coming back toward you.',
    legend: { '!': { kind: 'timer', ch: 0, dur: 6 } },
    map: String.raw`
      S.!=---.
             .
             P
             E
    `,
  }),
  D(4, {
    title: 'Pendulum Lab',
    objective: 'Flip, fall and fetch the key.',
    difficulty: 3,
    gravity: 2,
    flips: 2,
    hint: 'The key is on the ceiling. Reverse beneath it, then reverse again past the gap.',
    map: String.raw`
      ##########
      #...k....#
      #........#
      #S......LE
      ####   ###
    `,
  }),
  D(5, {
    title: 'Echo Errand',
    objective: 'Let yesterday hold the door for today.',
    difficulty: 3,
    echo: 6,
    hint: 'Leave an echo on the plate and walk on.',
    map: String.raw`
      ########
      #S...p.#
      #.######
      #P#
      #E#
      ###
    `,
  }),
  D(6, {
    title: 'Seam Stitch',
    objective: 'Cross a seam twice.',
    difficulty: 3,
    hint: 'The seam leads from the east ledge down onto the lower isle.',
    links: [{ a: [3, 0, 1], b: [0, 3, 0] }],
    map: String.raw`
      S.k.

      #L##
      ..E.
    `,
  }),
  D(7, {
    title: 'Clockwork Garden',
    objective: 'Two plates and a clockwork gate.',
    difficulty: 3,
    hint: 'Hold the plate with the stone, then wait for the clockwork gate.',
    legend: { c: { kind: 'door', when: { period: 3, phases: [0] } } },
    map: String.raw`
      ########
      #S.B..p#
      #......#
      ###P####
        #c#
        #E#
        ###
    `,
  }),
];
