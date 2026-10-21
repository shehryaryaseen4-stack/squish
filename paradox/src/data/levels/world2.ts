import type { LevelDef } from '../../game/core/types';

const W = 2;
const L = (n: number, d: Omit<LevelDef, 'id' | 'world' | 'number'>): LevelDef => ({
  id: `w${W}-${String(n).padStart(2, '0')}`,
  world: W,
  number: 20 + n,
  ...d,
});

// WORLD 2 - THE FRACTURED REALM. Portals, moving platforms, timed doors,
// light bridges and beams that travel through rifts.
export const WORLD2: LevelDef[] = [
  L(1, {
    title: 'Rift Gate',
    objective: 'Step into the rift to cross the void.',
    difficulty: 1,
    tutorial: 'Paired rifts are connected. Step into one and you emerge from its twin.',
    hint: 'Walk into the swirling rift at the end of the ledge.',
    map: String.raw`
      S..(

          )..
            .
            E
    `,
  }),
  L(2, {
    title: 'Two Rifts',
    objective: 'Choose the rift that leads to the key.',
    difficulty: 1,
    hint: 'The first rift leads to the key. Its twin brings you back.',
    map: String.raw`
      ..(..[..
      S.......

      )k   ]..L.E
    `,
  }),
  L(3, {
    title: 'Through the Rift',
    objective: 'Send the stone through the rift to hold the plate on the far island.',
    difficulty: 2,
    tutorial: 'Blocks travel through rifts too. A rift will not open if its twin is blocked.',
    hint: 'Push the stone into the near rift, then take the other rift and push it onto the plate.',
    map: String.raw`
      ##########
      #S.B.(.P.E
      #...[#####
      ######

        ]..)p.
    `,
  }),
  L(4, {
    title: 'Drifting Stones',
    objective: 'Ride the drifting platform across the void.',
    difficulty: 1,
    tutorial: 'Platforms drift one tile every time you act. Press WAIT (hourglass, or Space) to let time pass.',
    hint: 'Wait at the edge until the platform comes back, then step on.',
    map: String.raw`
      S..=---..E
    `,
  }),
  L(5, {
    title: 'Crossing Currents',
    objective: 'Catch two platforms in a row.',
    difficulty: 2,
    hint: 'Step off the first platform at the far end and wait for the second one to arrive.',
    map: String.raw`
      S.=--.
           .
           .
           =
           -
           -
           .E
    `,
  }),
  L(6, {
    title: 'Hourglass Gate',
    objective: 'Reach the gate before the sand runs out.',
    difficulty: 2,
    tutorial: 'Hourglass switches open their gate for a limited number of moves. The counter shows how long is left.',
    hint: 'Clear the stone from the east corridor first, then hit the hourglass.',
    legend: { '!': { kind: 'timer', ch: 0, dur: 8 } },
    map: String.raw`
      ##########
      #S.....!.#
      #.######.#
      #.....B..#
      ####P#####
         #.#
         #E#
    `,
  }),
  L(7, {
    title: 'Race the Sands',
    objective: 'Chain two hourglasses to reach the exit.',
    difficulty: 3,
    hint: 'The second hourglass lies beyond the first gate. Head straight there without stopping.',
    legend: {
      '!': { kind: 'timer', ch: 0, dur: 4 },
      '?': { kind: 'timer', ch: 1, dur: 7 },
    },
    map: String.raw`
      #############
      #S.!...P...?#
      #.#########.#
      #.#.........#
      #.#####Q#####
      #.....#.#
      #####.#E#
    `,
  }),
  L(8, {
    title: 'Rift Light',
    objective: 'Bend light through the rift to the crystal.',
    difficulty: 2,
    tutorial: 'Light passes through rifts as well, continuing in the same direction.',
    hint: 'Cross through the rift, turn the mirror north, then come back.',
    map: String.raw`
      ########R#
      #>..(.#..#
      #.....#)\#
      #S....#..#
      #....E####
    `,
  }),
  L(9, {
    title: 'Folded Path',
    objective: 'Fold space twice to collect the key.',
    difficulty: 2,
    hint: 'The first rift leads to the key. Then take the second rift, and the third.',
    map: String.raw`
      S.(   ).k
      ..[

       ].{   }.L.E
    `,
  }),
  L(10, {
    title: 'Light Bridges',
    objective: 'Hold the plate to raise the bridge of light.',
    difficulty: 2,
    tutorial: 'Glowing bridges only exist while their channel is powered.',
    hint: 'Push the stone around the corner onto the plate.',
    map: String.raw`
      S.....
      ..B...
      .....p
        b
        b
        b
       .E.
    `,
  }),
  L(11, {
    title: 'Ferry',
    objective: 'Ride to the key island and ferry back.',
    difficulty: 2,
    hint: 'The key waits on the far side. The platform keeps cycling, so you can ride it back.',
    map: String.raw`
      S.=--.k
      .
      L
      .
      E
    `,
  }),
  L(12, {
    title: 'Fleeting Bridge',
    objective: 'Cross the bridge before it fades.',
    difficulty: 3,
    hint: 'Do not shove the stone onto the hourglass. Go around it, then run straight for the bridge.',
    legend: {
      '!': { kind: 'timer', ch: 0, dur: 9 },
    },
    map: String.raw`
      #######
      #S.B.!#
      #.....#
      ##.####
        b
        b
        b
        E
    `,
  }),
  L(13, {
    title: 'Prism Relay',
    objective: 'Relay light through two rifts.',
    difficulty: 3,
    hint: 'Each mirror needs one turn. Visit the islands through the rifts.',
    map: String.raw`
      >..(   [
        .   ...   ...
      S..   )\.  R./.
      ...   ...   .].
      .E.
    `,
  }),
  L(14, {
    title: 'Cargo',
    objective: 'Load the stone onto the platform and meet it on the other side.',
    difficulty: 3,
    hint: 'Push the stone onto the platform, take the rift to the lower dock, and shove the stone onto the plate as it passes.',
    map: String.raw`
      S.B=
      ...-
      ..(-
         -
       ).-p
       P
       E
    `,
  }),
  L(15, {
    title: 'Labyrinth of Rifts',
    objective: 'Gather the three shards scattered across the rifts.',
    difficulty: 3,
    hint: 'Each rift has a twin on a different island. Keep track of where you emerge.',
    map: String.raw`
      S.(   ).*
      ..
      [.E   ]..{
             *
      *.}
    `,
  }),
  L(16, {
    title: 'Shortcut',
    objective: 'The long way is too long. Find a shortcut through space.',
    difficulty: 3,
    hint: 'The rift beside the hourglass lands next to the gate.',
    legend: { '!': { kind: 'timer', ch: 0, dur: 4 } },
    map: String.raw`
      ###########
      #S......!(#
      #######.###
      #.........#
      #.##)######
      #.....P..E#
      ###########
    `,
  }),
  L(17, {
    title: 'Bridge of Light',
    objective: 'Light the crystal to raise the bridge.',
    difficulty: 3,
    hint: 'Turn the mirror toward the crystal, but do not stand in the beam while crossing.',
    legend: { r: { kind: 'receiver', ch: 0 } },
    map: String.raw`
      v.......
      ........
      /..B...r
      ........
      S.......
         b
         b
         E
    `,
  }),
  L(18, {
    title: 'Tidal Platforms',
    objective: 'Time your hops across three drifting platforms.',
    difficulty: 3,
    hint: 'Count the platforms\' rhythm. Waiting on a ledge is free.',
    map: String.raw`
      S.=--. -=.
           . .
           .=-.
              .
              E
    `,
  }),
  L(19, {
    title: 'Scattered Isles',
    objective: 'Recover every shard from the scattered isles.',
    difficulty: 4,
    hint: 'Ride the platform east first, then use the rifts to hop between the outer isles.',
    map: String.raw`
      *.(    [.*
      S.=---.
      .     .
      ]     .).*
      .E
    `,
  }),
  L(20, {
    title: 'The Distant Shore',
    objective: 'Reach the distant shore using every rift, platform and beam.',
    difficulty: 4,
    hint: 'Hold the plate with the stone, ride to the far isle, turn the mirror to raise the bridge, and fetch the key.',
    story: 'The second fragment pulses with blue light. The islands drift closer together, as if remembering where they belong.',
    legend: { r: { kind: 'receiver', ch: 1 } },
    map: String.raw`
      > (   ) /.
             ...
      S...=-..r
      ..B.   d
      ...p   d
      #P##   .k
      #L#
      #E#
    `,
  }),
];
