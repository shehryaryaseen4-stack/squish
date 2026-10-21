import type { LevelDef } from '../../game/core/types';

const R = (n: number, d: Omit<LevelDef, 'id' | 'world' | 'number' | 'style'>): LevelDef => ({
  id: `rush-${String(n).padStart(2, '0')}`,
  world: 6,
  number: n,
  style: 'rush',
  ...d,
});

// COIN RUSH: short arcade boards. Grab every coin to open the exit, dodge the
// patrolling drones, and finish fast for a time bonus. Drones move one tile
// each time you act and bounce off anything in their way.
export const RUSH: LevelDef[] = [
  R(1, {
    title: 'Coin Trail',
    objective: 'Grab every coin, then reach the exit.',
    difficulty: 1,
    tutorial: 'COIN RUSH: collect every coin to open the exit. Finish quickly for a time bonus!',
    hint: 'Just follow the coins.',
    map: String.raw`
      S.*.*
          *
      E.*.*
    `,
  }),
  R(2, {
    title: 'First Drone',
    objective: 'Slip past the red drone.',
    difficulty: 1,
    tutorial: 'Red drones move one tile every time you do, and bounce back off walls. Touching one sends you back a step. WAIT (Space) lets them pass.',
    hint: 'Watch the drone bounce, then cross behind it.',
    map: String.raw`
      #######
      #S.*..#
      #H....#
      #.*..E#
      #######
    `,
  }),
  R(3, {
    title: 'Two Lanes',
    objective: 'Cross two patrol lanes.',
    difficulty: 1,
    hint: 'Cross each lane right after its drone passes you.',
    map: String.raw`
      #########
      #S..*...#
      #H......#
      #...*...#
      #......H#
      #*.....E#
      #########
    `,
  }),
  R(4, {
    title: 'Corner Shop',
    objective: 'Coins in every corner.',
    difficulty: 2,
    hint: 'The drone runs up and down the middle. Sweep one side, then the other.',
    map: String.raw`
      #######
      #*.I.*#
      #.....#
      #..S..#
      #.....#
      #*...*#
      ###E###
    `,
  }),
  R(5, {
    title: 'Stone Wall',
    objective: 'Block the drone with a stone.',
    difficulty: 2,
    tutorial: 'Drones bounce off stones. Push one into a drone lane to shorten its patrol.',
    hint: 'Push the stone down into the lane, then the right side is safe.',
    map: String.raw`
      #########
      #S..B...#
      #H......#
      #....*.*#
      ######E##
    `,
  }),
  R(6, {
    title: 'Zig Zag',
    objective: 'Three coins, three drones.',
    difficulty: 2,
    hint: 'Wait at the edge of each lane for a gap.',
    map: String.raw`
      ###########
      #S.......*#
      #H........#
      #*........#
      #........H#
      #........*#
      #H........#
      #E........#
      ###########
    `,
  }),
  R(7, {
    title: 'Key Run',
    objective: 'Coins, then the key, then the lock.',
    difficulty: 2,
    hint: 'The key is in the drone lane. Grab it right after the drone turns.',
    map: String.raw`
      ########
      #S.*..*#
      #H..k..#
      #......#
      ###L####
        #E#
    `,
  }),
  R(8, {
    title: 'Rift Raid',
    objective: 'Use the rift to reach the island of coins.',
    difficulty: 2,
    hint: 'Drones cannot use rifts. Jump across, grab the coins and jump back.',
    map: String.raw`
      S.(    )..*
      ...    H..
      .E.    *.*
    `,
  }),
  R(9, {
    title: 'Pressure Point',
    objective: 'Hold the gate open with a stone.',
    difficulty: 2,
    hint: 'Push the stone onto the plate, then collect the coin behind the gate.',
    map: String.raw`
      #########
      #S.B.p..#
      #.......#
      #H......#
      ###P#####
      #*.....E#
      #########
    `,
  }),
  R(10, {
    title: 'Drone Ring',
    objective: 'Four drones guard the centre.',
    difficulty: 3,
    hint: 'Move when two drones are moving away from you.',
    map: String.raw`
      #########
      #S.I....#
      #.......#
      #H..*..*#
      #.......#
      #*..*..H#
      #.....I.#
      #E......#
      #########
    `,
  }),
  R(11, {
    title: 'Light Heist',
    objective: 'Light the crystal and grab the coins.',
    difficulty: 3,
    hint: 'Turn the left mirror so the light runs east; the right mirror already sends it up to the crystal.',
    map: String.raw`
      ########
      #v..*.R#
      #......#
      #/.H../#
      #......#
      #S*..*E#
      ########
    `,
  }),
  R(12, {
    title: 'Fast Lane',
    objective: 'A long corridor and a quick drone.',
    difficulty: 3,
    hint: 'Hide in the side pockets while the drone passes.',
    map: String.raw`
      #.#.#.###
      #S......H#
      ##.#.#.#*#
       #*#.#*#E#
    `,
  }),
  R(13, {
    title: 'Hourglass Dash',
    objective: 'Beat the hourglass to the gate.',
    difficulty: 3,
    hint: 'Grab the coins first, then trigger the hourglass and run.',
    legend: { '!': { kind: 'timer', ch: 0, dur: 5 } },
    map: String.raw`
      #########
      #S.*..!.#
      #H......#
      #.*.....#
      #######P#
            #E#
    `,
  }),
  R(14, {
    title: 'Crowded Vault',
    objective: 'Five coins and a crowd of drones.',
    difficulty: 4,
    hint: 'Use the stones as shields; drones bounce off them.',
    map: String.raw`
      #########
      #S.*....#
      #H..B..*#
      #.......#
      #*..B..H#
      #...*...#
      ###E#####
    `,
  }),
  R(15, {
    title: 'Jackpot',
    objective: 'Every trick at once for the big prize.',
    difficulty: 4,
    hint: 'Block the lower drone with the stone, then take the rift to the key.',
    map: String.raw`
      ##########   ####
      #S..*....#   #)k#
      #H.......#   ####
      #...B..(.#
      #*.......#
      #..H....*#
      ###L######
        #E#
    `,
  }),
];
