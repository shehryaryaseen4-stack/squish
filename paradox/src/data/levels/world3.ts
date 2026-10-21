import type { LevelDef } from '../../game/core/types';

const W = 3;
const L = (n: number, d: Omit<LevelDef, 'id' | 'world' | 'number'>): LevelDef => ({
  id: `w${W}-${String(n).padStart(2, '0')}`,
  world: W,
  number: 40 + n,
  ...d,
});

// WORLD 3 - THE GRAVITY LABYRINTH. Side-view chambers: gravity pulls the
// cube until it rests on something solid. Arrow pads and reversals rotate the
// whole chamber, so any wall can become the floor.
export const WORLD3: LevelDef[] = [
  L(1, {
    title: 'The Drop',
    objective: 'Descend through the laboratory to the exit.',
    difficulty: 1,
    gravity: 2,
    tutorial: 'Gravity chambers are seen from the side. You can only walk along the floor: there is no jumping, so every drop is one way.',
    hint: 'Walk off each ledge in turn.',
    map: String.raw`
      #########
      #S......#
      ####.####
      #.......#
      #.#######
      #......E#
      #########
    `,
  }),
  L(2, {
    title: 'Ceiling Walk',
    objective: 'Let the arrow pad pull you onto the ceiling.',
    difficulty: 1,
    gravity: 2,
    tutorial: 'Arrow pads change the direction of gravity. The chamber turns so that down is always down for you.',
    hint: 'Step on the arrow pad and walk along the ceiling.',
    map: String.raw`
      ##########
      #.......E#
      ##.#######
      #Sn..#...#
      ##########
    `,
  }),
  L(3, {
    title: 'Wall Walker',
    objective: 'Walk up the wall and along the ceiling.',
    difficulty: 1,
    gravity: 2,
    hint: 'The west pad turns the left wall into a floor. The north pad at the top does the same for the ceiling.',
    map: String.raw`
      ########
      #n....E#
      #.######
      #.###
      #.###
      #S.w#
      #####
    `,
  }),
  L(4, {
    title: 'Reversal',
    objective: 'Reverse gravity to cross the abyss.',
    difficulty: 2,
    gravity: 2,
    flips: 2,
    tutorial: 'Some chambers let you reverse gravity yourself. Each reversal is limited, so use them wisely. Empty black space is the abyss: falling into it ends the attempt.',
    hint: 'Reverse at the edge, cross on the ceiling, and reverse again above the exit.',
    map: String.raw`
      #########
      #.......#
      #.......#
      #S.....E#
      ###   ###
    `,
  }),
  L(5, {
    title: 'Falling Stones',
    objective: 'Drop stones into the spike pits to cross them.',
    difficulty: 2,
    gravity: 2,
    tutorial: 'Stones fall too. A stone resting in a pit covers the spikes beneath it.',
    hint: 'Push each stone into the pit just ahead of it.',
    map: String.raw`
      ############
      #S.B.B.....#
      ####x##x##E#
      ############
    `,
  }),
  L(6, {
    title: 'Pad Chain',
    objective: 'Follow the chain of pads to drop into the sealed room.',
    difficulty: 2,
    gravity: 2,
    hint: 'West, then north, then south.',
    map: String.raw`
      #########
      #n..s...#
      #.##.##.#
      #.#...#.#
      #.#.E.#.#
      #.#####.#
      #w.S....#
      #########
    `,
  }),
  L(7, {
    title: 'Weight of Stone',
    objective: 'Drop one stone onto the plate and one over the spikes.',
    difficulty: 2,
    gravity: 2,
    hint: 'The first stone bridges the spikes; the second must reach the plate pit.',
    map: String.raw`
      ############
      #S.B.B...P.E
      ####x##p####
      ############
    `,
  }),
  L(8, {
    title: 'Upside Key',
    objective: 'Fetch the key from the ceiling.',
    difficulty: 2,
    gravity: 2,
    hint: 'The north pad lifts you to the key, the south pad drops you back down.',
    map: String.raw`
      ###########
      #....k.s..#
      #.........#
      #S.n....LE#
      ###########
    `,
  }),
  L(9, {
    title: 'Shards in Orbit',
    objective: 'Circle the chamber to collect every shard.',
    difficulty: 2,
    gravity: 2,
    hint: 'Head west first. Each corner pad turns the next wall into the floor.',
    map: String.raw`
      #########
      #n..*..e#
      #.......#
      #*.....*#
      #.......#
      #w..E.Ss#
      #########
    `,
  }),
  L(10, {
    title: 'Alternating Current',
    objective: 'Weave between floor and ceiling with only four reversals.',
    difficulty: 3,
    gravity: 2,
    flips: 4,
    hint: 'Reverse only when a pillar blocks your way.',
    map: String.raw`
      ################
      #......#.....#.#
      #..............#
      #S..#.....#...E#
      ################
    `,
  }),
  L(11, {
    title: 'Switchback',
    objective: 'Throw each switch as you fall past it.',
    difficulty: 2,
    gravity: 2,
    hint: 'The lower switch reopens the striped gate.',
    map: String.raw`
      ###########
      #S..t..P..#
      #########.#
      #E...T.t..#
      ###########
    `,
  }),
  L(12, {
    title: 'Rift Fall',
    objective: 'Fall into the right rift.',
    difficulty: 3,
    gravity: 2,
    flips: 2,
    tutorial: 'You keep falling after passing through a rift.',
    hint: 'The first rift drops you onto spikes. Cross it upside down.',
    map: String.raw`
      ##########
      #S.......#
      ###[##(###
      #]...)...#
      #.###.##.#
      #x###E##.#
      ##########
    `,
  }),
  L(13, {
    title: 'Spiked Labyrinth',
    objective: 'Rotate the chamber to avoid the spikes.',
    difficulty: 2,
    gravity: 2,
    tutorial: 'You also die if you fall onto spikes, so read each pad before you step on it.',
    hint: 'Each pad carries you past the next spike. Just keep moving east.',
    map: String.raw`
      #############
      #...sx...sx.#
      #Snx...nx..E#
      #############
    `,
  }),
  L(14, {
    title: 'Laboratory Light',
    objective: 'Aim the beam at the crystal from the right floor.',
    difficulty: 3,
    gravity: 2,
    flips: 1,
    hint: 'Turn the mirror from its west side, then reverse gravity under the exit.',
    map: String.raw`
      ##########
      #..Ev....#
      #........#
      #........#
      #........#
      #S../...R#
      ##########
    `,
  }),
  L(15, {
    title: 'Counterweight',
    objective: 'Make the stone fall upward onto the ceiling plate.',
    difficulty: 3,
    gravity: 2,
    flips: 1,
    hint: 'Stand clear of the stone before you reverse gravity.',
    map: String.raw`
      ##########
      ###p######
      #.....P.E#
      #S.B.....#
      ##########
    `,
  }),
  L(16, {
    title: 'Rotating Chamber',
    objective: 'Turn the chamber four times to reach the key and the exit.',
    difficulty: 3,
    gravity: 2,
    hint: 'Go west first. The key waits on the west wall; the lock is on the east wall.',
    map: String.raw`
      #########
      #n.....e#
      #.#####.#
      #k#...#.#
      #.#.#.#L#
      #.#.#.#.#
      #.#...#E#
      #w.S...##
      #########
    `,
  }),
  L(17, {
    title: 'Gravity Well',
    objective: 'Use rifts and pads to climb the well.',
    difficulty: 3,
    gravity: 2,
    hint: 'The rift on the floor sends you to the top. Pick the pad that keeps you up there.',
    map: String.raw`
      ##########
      #.)n....E#
      ###.#.####
      #........#
      #S..(....#
      ##########
    `,
  }),
  L(18, {
    title: 'Phase Blocks',
    objective: 'Switch the phase blocks into existence and walk across them.',
    difficulty: 3,
    gravity: 2,
    tutorial: 'Phase blocks become solid while their switch is on.',
    hint: 'Two switches cancel each other out. Step back onto one before crossing.',
    map: String.raw`
      #############
      #S.t.t.....E#
      #######bbb###
    `,
  }),
  L(19, {
    title: 'Laboratory Lock',
    objective: 'Key, stone and a single reversal.',
    difficulty: 4,
    gravity: 2,
    flips: 1,
    hint: 'Bridge the spike pit with the stone, walk back west, then reverse to reach the key.',
    map: String.raw`
      ############
      #...ks###..#
      #.....###..#
      #S.B.....L.E
      ######x#####
      ############
    `,
  }),
  L(20, {
    title: 'Heart of the Labyrinth',
    objective: 'Master gravity, rifts and stone to claim the third fragment.',
    difficulty: 4,
    gravity: 2,
    flips: 2,
    hint: 'Stones rise when gravity reverses. Weigh the plate, rise through the rift, then reverse again so the stone drops back.',
    story: 'The third fragment spins in every direction at once. For a moment you see the laboratory from above, below and inside.',
    map: String.raw`
      #############
      #.(.......PE#
      #.###########
      #.#....)....#
      #S..B.......#
      ######p######
      #############
    `,
  }),
];
