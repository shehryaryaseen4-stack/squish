import type { LevelDef } from '../../game/core/types';

const W = 4;
const L = (n: number, d: Omit<LevelDef, 'id' | 'world' | 'number'>): LevelDef => ({
  id: `w${W}-${String(n).padStart(2, '0')}`,
  world: W,
  number: 60 + n,
  ...d,
});

// Clockwork building blocks shared by several levels.
const gateA = { kind: 'door', when: { period: 4, phases: [0, 1] } } as const;
const gateB = { kind: 'door', when: { period: 4, phases: [2, 3] } } as const;
const pulse0 = { kind: 'hazard', when: { period: 3, phases: [0] } } as const;
const pulse1 = { kind: 'hazard', when: { period: 3, phases: [1] } } as const;
const pulse2 = { kind: 'hazard', when: { period: 3, phases: [2] } } as const;

// WORLD 4 - THE TIMELESS ABYSS. Time echoes replay your recorded actions;
// clockwork gates, pulsing rifts and hourglasses demand precise timing.
export const WORLD4: LevelDef[] = [
  L(1, {
    title: 'Echoes',
    objective: 'Let your echo hold the plate while you pass the gate.',
    difficulty: 1,
    echo: 8,
    tutorial: 'Press ECHO (or R) to start recording. Act, then press ECHO again: time rewinds and your echo replays every recorded action while you move freely. Echoes press plates and switches but cannot push, carry or block.',
    hint: 'Record yourself walking onto the plate, then rewind and head for the gate.',
    map: String.raw`
      #########
      #S.....p#
      #.#######
      #.#
      #P#
      #E#
      ###
    `,
  }),
  L(2, {
    title: 'Two Places at Once',
    objective: 'Your echo must hold one plate, then the other.',
    difficulty: 2,
    echo: 8,
    hint: 'Record: walk onto the first plate, wait there a moment, then walk on to the second plate.',
    map: String.raw`
      ##########
      #S.p..q..#
      #.########
      #P#
      #.#
      #Q#
      #E#
      ###
    `,
  }),
  L(3, {
    title: 'Clockwork',
    objective: 'Slip through the clockwork gates when they open.',
    difficulty: 1,
    tutorial: 'Clockwork gates open and close on a fixed rhythm. Each action advances the clock by one beat. WAIT to let a gate cycle.',
    hint: 'The gates take turns: two beats open, two beats closed.',
    legend: { c: gateA, g: gateB },
    map: String.raw`
      ##############
      #S..c..g..c..#
      ############.#
                 #E#
                 ###
    `,
  }),
  L(4, {
    title: 'Pulse',
    objective: 'Cross the pulsing rift between beats.',
    difficulty: 2,
    tutorial: 'Pulsing rifts are only deadly on their beat. Watch them flare and step in when they are dark.',
    hint: 'Every pulse flares once in three beats. Move when the next one has just flared.',
    legend: { z: pulse0, y: pulse1, w: pulse2 },
    map: String.raw`
      ##########
      #S.zywzy.#
      #######.##
            #E#
    `,
  }),
  L(5, {
    title: 'Echo Switch',
    objective: 'Have your echo flip the switch on, then off again.',
    difficulty: 2,
    echo: 10,
    hint: 'Record a trip to the switch, a step back, and a second visit.',
    map: String.raw`
      #########
      #S.....t#
      #.#######
      #P#
      #.#
      #T#
      #E#
      ###
    `,
  }),
  L(6, {
    title: 'Synchronised',
    objective: 'Your echo holds the plate; the clock decides the rest.',
    difficulty: 2,
    echo: 6,
    hint: 'Leave an echo on the plate, then time your walk through the clockwork gate.',
    legend: { c: gateA },
    map: String.raw`
      #########
      #S..p...#
      ##.######
      ##P#
      ##.#
      ##c#
      ##E#
      ####
    `,
  }),
  L(7, {
    title: 'Hourglass Echo',
    objective: 'The hourglass is too far from its gate. Send your echo.',
    difficulty: 3,
    echo: 10,
    hint: 'Record the whole walk to the hourglass, rewind, and wait right in front of the gate.',
    legend: { '!': { kind: 'timer', ch: 0, dur: 2 } },
    map: String.raw`
      ############
      #S........!#
      #.##########
      #.#
      #P#
      #E#
      ###
    `,
  }),
  L(8, {
    title: 'Echo Bridges',
    objective: 'Your echo raises one bridge, then the other.',
    difficulty: 3,
    echo: 8,
    hint: 'The bridges hang in sequence. Your echo must hold the first plate, then move to the second.',
    map: String.raw`
      ..p.q.
      S.
      .
      b
      b
      .
      d
      d
      E
    `,
  }),
  L(9, {
    title: 'Phase Shift',
    objective: 'Cross the flickering bridge in rhythm.',
    difficulty: 3,
    tutorial: 'Some bridges flicker with the clock. Never be standing on one when it fades.',
    hint: 'The bridge travels like a wave. Step on as the first tile lights, then keep moving without stopping.',
    legend: {
      i: { kind: 'bridge', when: { period: 4, phases: [0, 1] } },
      j: { kind: 'bridge', when: { period: 4, phases: [1, 2] } },
      k: { kind: 'bridge', when: { period: 4, phases: [2, 3] } },
      l: { kind: 'bridge', when: { period: 4, phases: [3, 0] } },
    },
    map: String.raw`
      S..ijkl..E
    `,
  }),
  L(10, {
    title: 'Echo and Stone',
    objective: 'A stone and an echo for two plates.',
    difficulty: 3,
    echo: 8,
    hint: 'The stone fits only the lower plate. Your echo takes the other one.',
    map: String.raw`
      #########
      #S.B..p.#
      #.....#.#
      #.q...#P#
      ###Q###.#
        #.....#
        #E#####
    `,
  }),
  L(11, {
    title: 'Clockwork Ferry',
    objective: 'Ride the ferry and catch the gate in time.',
    difficulty: 3,
    hint: 'Board when the ferry is beside you, then wait on the far ledge for the gate.',
    legend: { c: { kind: 'door', when: { period: 3, phases: [0] } } },
    map: String.raw`
      S.=---.c.E
    `,
  }),
  L(12, {
    title: 'Shadow Play',
    objective: 'Cast a shadow over the crystal while your echo holds the plate.',
    difficulty: 4,
    echo: 8,
    hint: 'Only solid things cast shadows. Push the stone into the beam and leave your echo on the plate.',
    legend: { r: { kind: 'receiver', ch: 0 } },
    map: String.raw`
      ##########
      #>......r#
      #..B.....#
      #S..q....#
      ######T###
           #.#
           #Q#
           #E#
           ###
    `,
  }),
  L(13, {
    title: 'Relay',
    objective: 'Two hourglasses, two gates, one echo.',
    difficulty: 3,
    echo: 8,
    hint: 'Your echo turns the far hourglass while you turn the near one.',
    legend: {
      '!': { kind: 'timer', ch: 0, dur: 3 },
      '?': { kind: 'timer', ch: 1, dur: 3 },
    },
    map: String.raw`
      ##########
      #?......!#
      #.####.###
      #S...#.#
      ####.#P#
         #..Q#
         ###E#
    `,
  }),
  L(14, {
    title: 'Echo Keys',
    objective: 'Echoes cannot carry keys. Plan around it.',
    difficulty: 3,
    echo: 8,
    hint: 'Grab the key yourself first, then record the walk to the plate.',
    map: String.raw`
      ##########
      #k..S..p.#
      ###.######
        #P#
        #L#
        #E#
        ###
    `,
  }),
  L(15, {
    title: 'Twin Hourglasses',
    objective: 'Both gates must be open at the same moment.',
    difficulty: 4,
    echo: 10,
    hint: 'Your echo turns one hourglass; time your own visit to the other so both gates stand open together.',
    legend: {
      '!': { kind: 'timer', ch: 0, dur: 4 },
      '?': { kind: 'timer', ch: 1, dur: 4 },
    },
    map: String.raw`
      ###########
      #!...S...?#
      #####.#####
          #P#
          #Q#
          #E#
          ###
    `,
  }),
  L(16, {
    title: 'Pendulum',
    objective: 'Dodge the pulses on a swinging platform.',
    difficulty: 3,
    hint: 'The platform waits for no one. Count both rhythms before boarding.',
    legend: { z: pulse0, y: pulse1 },
    map: String.raw`
      S.=---.zy.E
    `,
  }),
  L(17, {
    title: 'Clock Tower',
    objective: 'Climb through gates that keep different time.',
    difficulty: 4,
    hint: 'One gate keeps a beat of three, the others a beat of four. Wait in the safe alcoves.',
    legend: {
      c: gateA,
      g: gateB,
      h: { kind: 'door', when: { period: 3, phases: [0] } },
    },
    map: String.raw`
      #######
      #S.c..#
      ####..#
      #..h..#
      #.#####
      #.g..E#
      #######
    `,
  }),
  L(18, {
    title: 'Paradox Loop',
    objective: 'Send your echo through the rift to the far plate.',
    difficulty: 4,
    echo: 8,
    hint: 'Your echo can use rifts too. Record a trip through the rift onto the plate.',
    map: String.raw`
      #######   #####
      #S...(#   #).p#
      #.#####   #####
      #P#
      #.#
      #E#
      ###
    `,
  }),
  L(19, {
    title: 'Time Lock',
    objective: 'Echo, hourglass and clockwork in a single motion.',
    difficulty: 4,
    echo: 10,
    hint: 'Your echo must step on the hourglass as the clockwork gate swings open.',
    legend: {
      '!': { kind: 'timer', ch: 0, dur: 3 },
      c: { kind: 'door', when: { period: 3, phases: [0, 1] } },
    },
    map: String.raw`
      ###########
      #S.......!#
      #.#########
      #.#
      #c#
      #P#
      #E#
      ###
    `,
  }),
  L(20, {
    title: 'The Timeless Core',
    objective: 'Hold three locks across three moments in time.',
    difficulty: 5,
    echo: 10,
    hint: 'Weigh the first plate with the stone. Record from the second plate: hold it, then walk to the hourglass. Gates stay open while you stand in them.',
    story: 'The fourth fragment ticks like a heart. You hear your own footsteps echoing from a moment that has not happened yet.',
    legend: { '!': { kind: 'timer', ch: 2, dur: 3 }, G: { kind: 'door', when: { ch: 2 } } },
    map: String.raw`
      ###########
      #S.B.p....#
      #.##.####.#
      #...q...!.#
      ###P#######
        #.#
        #Q#
        #G#
        #E#
        ###
    `,
  }),
];
