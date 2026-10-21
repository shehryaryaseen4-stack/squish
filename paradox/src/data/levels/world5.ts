import type { LevelDef } from '../../game/core/types';

const W = 5;
const L = (n: number, d: Omit<LevelDef, 'id' | 'world' | 'number'>): LevelDef => ({
  id: `w${W}-${String(n).padStart(2, '0')}`,
  world: W,
  number: 80 + n,
  ...d,
});

// WORLD 5 - THE FINAL PARADOX. Every mechanic returns, then seams in space
// join places that cannot touch. 81-84 portals, 85-88 gravity, 89-92 echoes,
// 93-96 impossible geometry, 97-99 multi-stage trials, 100 the Paradox Core.
export const WORLD5: LevelDef[] = [
  L(1, {
    title: 'Rift Engine',
    objective: 'Drive the light through two pairs of rifts.',
    difficulty: 3,
    hint: 'Weigh the plate first. Then cross through the upper rift and turn the far mirror south.',
    map: String.raw`
      >..(    )./
      ....    ...
      S.B.    ...
      ....      [
      ..].
      .p..
      P.R.
      E
    `,
  }),
  L(2, {
    title: 'Quantum Courier',
    objective: 'Fetch the key, then race the hourglass home.',
    difficulty: 3,
    hint: 'Take the key before you touch the hourglass for the last time. The rift beneath it is the fastest way home.',
    legend: { '!': { kind: 'timer', ch: 0, dur: 8 } },
    map: String.raw`
      S..(     k.!
      ...      . )
      ...
      L
      P
      E
    `,
  }),
  L(3, {
    title: 'Rift Sokoban',
    objective: 'Deliver both stones through the rift to their plates.',
    difficulty: 4,
    hint: 'The far stone must travel first and go all the way to the end. Each push into the rift sends you home.',
    map: String.raw`
      #########
      #S.B.B.(#
      #.......#
      #[#P#####
      ###Q#
        #E#
        ###

        ].).p.q.
    `,
  }),
  L(4, {
    title: 'Two-Way Mirror',
    objective: 'Light the bridge, cross it, then send the light home.',
    difficulty: 4,
    legend: { r: { kind: 'receiver', ch: 0 } },
    hint: 'Turn the mirror from the rift side to raise the bridge. Turn it back from the far shore.',
    map: String.raw`
             R
      >.(  )./..
      S..    . ..
      ...    r ..
      ...bbbbbb.E
    `,
  }),
  L(5, {
    title: 'Inverted Rifts',
    objective: 'Fall through the rift and cross the spikes upside down.',
    difficulty: 3,
    gravity: 2,
    flips: 1,
    hint: 'Reverse gravity as soon as you land, then let the pad bring you down beside the exit.',
    map: String.raw`
      ############
      #S..(......#
      ############
      #........s.#
      #)...x...E.#
      ############
    `,
  }),
  L(6, {
    title: 'Upside Laboratory',
    objective: 'Clear the beam by letting the stone fall upward.',
    difficulty: 3,
    gravity: 2,
    flips: 1,
    hint: 'Turn the mirror first. Reverse gravity only from beside the mirror, close to the exit.',
    map: String.raw`
      #############
      #E..v.......#
      #...........#
      #...........#
      #S../....B.R#
      #############
    `,
  }),
  L(7, {
    title: 'Gravity Rifts',
    objective: 'Ceiling, floor, rift and ceiling again.',
    difficulty: 3,
    gravity: 2,
    hint: 'Ride up for the key, drop back down with the south pad, then fall into the rift. The north pad beyond it lifts you to the lock.',
    map: String.raw`
      ############
      #k..s#)..LE#
      #....#...###
      #Sn..#.n.###
      ###(########
      ############
    `,
  }),
  L(8, {
    title: 'Heavy Heart',
    objective: 'One stone, two plates, one reversal.',
    difficulty: 4,
    gravity: 2,
    flips: 1,
    hint: 'Drop the stone into the floor plate, pass the gate, then reverse: the stone rises to the ceiling plate.',
    map: String.raw`
      #############
      #####q#######
      #.........QE#
      #####.#.....#
      #S.B...P....#
      #####p#######
      #############
    `,
  }),
  L(9, {
    title: 'Echo Rift',
    objective: 'Your echo crosses the rift to hold the distant plate.',
    difficulty: 3,
    echo: 6,
    hint: 'Weigh the near plate with the stone. Then record a trip through the rift onto the far plate.',
    map: String.raw`
      #########  #####
      #S.B..q.#  #).p#
      #.....(.#  #####
      ###P#####
        #Q#
        #E#
        ###
    `,
  }),
  L(10, {
    title: 'Echo Gravity',
    objective: 'Drop your echo onto the plate at exactly the right moment.',
    difficulty: 3,
    gravity: 2,
    echo: 6,
    hint: 'The plate opens one gate and closes the other. Your echo must fall after you pass the striped gate.',
    map: String.raw`
      ##########
      #.S.T.P.E#
      #.########
      #p#
      ###
    `,
  }),
  L(11, {
    title: 'Echo Beam',
    objective: 'Keep the gate in the beam open while you reach the exit.',
    difficulty: 3,
    echo: 6,
    hint: 'One plate takes the stone, the other takes your echo.',
    map: String.raw`
      #########
      #>..P..R#
      #.......#
      #.p.S...#
      #...B.q.#
      ####Q####
         #E#
         ###
    `,
  }),
  L(12, {
    title: 'Echo Clockwork',
    objective: 'Echo and clockwork must agree.',
    difficulty: 4,
    echo: 8,
    hint: 'Your echo must stand on the plate as you reach the solid gate, and leave before you reach the striped one.',
    legend: { c: { kind: 'door', when: { period: 4, phases: [0, 1] } } },
    map: String.raw`
      #########
      #S.p....#
      #.#######
      #c#
      #P#
      #.#
      #T#
      #E#
      ###
    `,
  }),
  L(13, {
    title: 'Impossible Stair',
    objective: 'Walk through the seams between places that cannot touch.',
    difficulty: 2,
    tutorial: 'Glowing seams join edges of the world that should never meet. Walk through one and you continue from its twin, even if that faces another way.',
    hint: 'Walk east off each ledge through its seam.',
    links: [
      { a: [2, 0, 1], b: [4, 2, 3] },
      { a: [6, 2, 1], b: [8, 4, 3] },
    ],
    map: String.raw`
      S..

          .k.

              .LE
    `,
  }),
  L(14, {
    title: 'Penrose Loop',
    objective: 'Push the stones around a corridor that loops back on itself.',
    difficulty: 4,
    hint: 'The east end of the corridor is also its west end. Push the east stone all the way around.',
    links: [{ a: [8, 0, 1], b: [0, 0, 3] }],
    map: String.raw`
      qp.A.S.B.
      ####P####
      ####Q####
      ####E####
    `,
    legend: { A: { kind: 'block' } },
  }),
  L(15, {
    title: 'Aligned Worlds',
    objective: 'Align the seam, but keep the gate open long enough to use it.',
    difficulty: 4,
    hint: 'The switch aligns the seam but closes the striped gate. You will need to throw it more than once.',
    links: [{ a: [6, 1, 1], b: [10, 1, 3], when: { ch: 0 } }],
    map: String.raw`
      ..t.#..
      S.t.T.t   .E
      ....#..
    `,
  }),
  L(16, {
    title: 'Mobius Path',
    objective: 'Light and stone both turn a corner that is not there.',
    difficulty: 4,
    hint: 'The seam turns everything that crosses it to face south. Clear the stone from the beam on the far side.',
    links: [{ a: [3, 1, 1], b: [7, 0, 0] }],
    map: String.raw`
      ....  ....
      >..S  .B..
      ....  ....
            .R..
            .E..
    `,
  }),
  L(17, {
    title: 'The Gauntlet',
    objective: 'Stone, light and sand: clear three rooms in a row.',
    difficulty: 4,
    legend: {
      r: { kind: 'receiver', ch: 1 },
      '!': { kind: 'timer', ch: 2, dur: 7 },
      G: { kind: 'door', when: { ch: 2 } },
    },
    hint: 'Plate, mirror, then the hourglass across the rift. Run back through the rift the moment the sand starts falling.',
    map: String.raw`
      ####################
      #S....#v....#.....(#  )!
      #..B..P.....Q......#
      #...p.#/...r#......#
      ###############G####
                    #E#
                    ###
    `,
  }),
  L(18, {
    title: 'Collapse',
    objective: 'An echo, two reversals and a spiked descent.',
    difficulty: 4,
    gravity: 2,
    echo: 6,
    flips: 2,
    hint: 'Your echo must land on the plate only after you pass the striped gate. In the pit below, cross the spikes upside down.',
    map: String.raw`
      #############
      #.S.T.P.....#
      #.#####.#####
      #p#   #.....#
      ###   #.....#
            #..xxE#
            #######
    `,
  }),
  L(19, {
    title: 'Before the Core',
    objective: 'Seam, stone, light and echo: the last trial before the core.',
    difficulty: 5,
    echo: 4,
    links: [{ a: [7, 1, 1], b: [4, 0, 0] }],
    legend: { r: { kind: 'receiver', ch: 1 }, Z: { kind: 'door', when: { ch: 1, invert: true } } },
    hint: 'Push the stone east through the seam so it lands in the beam. Then leave your echo on the plate.',
    map: String.raw`
      >......r
      S.p..B..
      ###P####
        .Z.
        .E.
    `,
  }),
  L(20, {
    title: 'The Paradox Core',
    objective: 'Route the light, reverse gravity, echo yourself, align the seam and awaken the Core.',
    difficulty: 5,
    gravity: 2,
    flips: 1,
    echo: 4,
    tutorial: 'The Paradox Core. Five trials in one chamber: bend the light through the rifts, reverse gravity, hold two plates at once with your echo and a stone, align the seam, and enter the Core.',
    hint: 'Turn the floor mirror, then reverse gravity through the gap above you. Walk east and climb, take the south pad, drop the stone into its pit, leave your echo on the plate and throw the switch at the far west.',
    story: 'The Core opens, and inside it you see yourself, at the very first step, reaching for a fragment. It was always you. Every world broke the moment you began to mend it. This time, you let the loop close gently.',
    legend: {
      r: { kind: 'receiver', ch: 0 },
      G: { kind: 'door', when: { ch: 2 } },
      h: { kind: 'plate', ch: 2 },
      y: { kind: 'toggle', ch: 3 },
    },
    links: [
      { a: [1, 2, 3], b: [16, 2, 3], when: { ch: 3 } },
      { a: [1, 1, 3], b: [16, 1, 3], when: { ch: 3 } },
    ],
    map: String.raw`
      ####################
      #..........<s.##.R##
      #yGQ.q....B...##..E#
      ########h####.######
      #############.######
      #.......P.....######
      #)............r#####
      #.............######
      ####.###############
      #....v....##########
      #.........##########
      #S.../..(.##########
      ####################
    `,
  }),
];
