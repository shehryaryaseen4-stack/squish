import type { LevelDef } from '../../game/core/types';

const W = 1;
const L = (n: number, d: Omit<LevelDef, 'id' | 'world' | 'number'>): LevelDef => ({
  id: `w${W}-${String(n).padStart(2, '0')}`,
  world: W,
  number: n,
  ...d,
});

// WORLD 1 - THE AWAKENING. One idea at a time: movement, shards, keys,
// blocks, plates, switches, pits, beams, mirrors, then combinations.
export const WORLD1: LevelDef[] = [
  L(1, {
    title: 'First Steps',
    objective: 'Reach the glowing exit portal.',
    difficulty: 1,
    tutorial: 'Swipe, use the arrow keys or the on-screen pad to roll the cube one tile at a time. You can also tap a tile to walk there.',
    hint: 'Follow the stone path around the corner.',
    map: String.raw`
      S...
         .
         .
      E...
    `,
  }),
  L(2, {
    title: 'Stone Garden',
    objective: 'Find a way through the ancient pillars.',
    difficulty: 1,
    tutorial: 'Pillars block the way. Undo any step with the undo button or Z.',
    hint: 'The way through starts by heading down.',
    map: String.raw`
      #########
      #S..#...#
      #.#.#.#.#
      #.#...#.#
      #.#####.#
      #...#...#
      ###.#.###
        #...E#
        ######
    `,
  }),
  L(3, {
    title: 'Fragments of Light',
    objective: 'Collect both light shards to awaken the exit.',
    difficulty: 1,
    tutorial: 'The exit stays dormant until every shard in the chamber is collected.',
    hint: 'Visit the far left and far right ends of the ruins, then return to the centre.',
    map: String.raw`
      *..#...#..*
      .#.#.#.#.#.
      ...S...E...
    `,
  }),
  L(4, {
    title: 'The Old Key',
    objective: 'Find the key and open the sealed gate.',
    difficulty: 1,
    tutorial: 'Walk over a key to pick it up. Walk into a lock while holding a key to open it.',
    hint: 'The key waits in the upper alcove.',
    map: String.raw`
      ..k..
      .###.
      S...#.....
      ###.L.###.
        #.#.#E..
    `,
  }),
  L(5, {
    title: 'Heavy Stones',
    objective: 'Push the stone out of the corridor.',
    difficulty: 1,
    tutorial: 'Walk into a stone block to push it. Blocks cannot be pulled, so plan ahead.',
    hint: 'Push the block past the side passage, then slip down beside it.',
    map: String.raw`
      #########
      #S.B...##
      #####.#E#
          #...#
          #####
    `,
  }),
  L(6, {
    title: 'Pressure',
    objective: 'Keep the pressure plate held to open the door.',
    difficulty: 1,
    tutorial: 'Pressure plates open matching doors only while something rests on them.',
    hint: 'Standing on the plate yourself will not help. Push the block onto it.',
    map: String.raw`
      #######
      #S.B.p#
      #.....#
      ###P###
        #.#
        #E#
        ###
    `,
  }),
  L(7, {
    title: 'Lever of Ages',
    objective: 'Use the switch to choose which gate opens.',
    difficulty: 1,
    tutorial: 'Switches stay toggled. Solid gates open when the switch is on; striped gates close.',
    hint: 'Throw the switch once, then take the newly opened gate.',
    map: String.raw`
      #########
      #S..t...#
      ###P#T###
        #.#.#
        #.#x#
        #E#.#
        ###.#
    `,
  }),
  L(8, {
    title: 'The Chasm',
    objective: 'Fill the gaps with stones to cross.',
    difficulty: 2,
    tutorial: 'Push a block into a pit to fill it and make a bridge.',
    hint: 'One stone fills the first pit from the left; the other must be pushed up from below.',
    map: String.raw`
      #########
      #S.B.oo.E
      #.####.##
      #.#..B.#
      #......#
      ########
    `,
  }),
  L(9, {
    title: 'Twin Keys',
    objective: 'Two locks, two keys. Choose your order.',
    difficulty: 2,
    hint: 'Collect the key in the lower hall before opening the first lock.',
    map: String.raw`
      ###########
      #S...L...k#
      #.#####.###
      #...k.#.#
      #####.#L#
          ###.#
            #E#
    `,
  }),
  L(10, {
    title: 'Stone Circle',
    objective: 'Hold both plates down at once.',
    difficulty: 2,
    hint: 'Each block belongs on the plate nearest to it, but the order of pushes matters.',
    map: String.raw`
      #########
      #...p...#
      #.B...B.#
      #S.....q#
      ###PQ####
        #..#
        #E.#
        ####
    `,
  }),
  L(11, {
    title: 'First Light',
    objective: 'Let the beam reach the crystal receiver.',
    difficulty: 2,
    tutorial: 'Emitters fire a beam of light. Light the crystal receiver to power the exit. Blocks, closed gates and your cube stop light.',
    hint: 'The block is in the way of the beam. Push it north or south, out of its path.',
    map: String.raw`
      #########
      #.......#
      #>..B..R#
      #.......#
      #S.....E#
      #########
    `,
  }),
  L(12, {
    title: 'Mirror, Mirror',
    objective: 'Turn the mirror to bend the light.',
    difficulty: 2,
    tutorial: 'Walk into a mirror to rotate it a quarter turn. Mirrors bend light at right angles.',
    hint: 'The mirror must send the beam north toward the crystal.',
    map: String.raw`
      ####R##
      #.....#
      #>..\.#
      #.....#
      #S...E#
      #######
    `,
  }),
  L(13, {
    title: 'Angles',
    objective: 'Two mirrors, one path for light.',
    difficulty: 2,
    hint: 'Turn the left mirror to send light east, then the right mirror to send it down.',
    map: String.raw`
      #########
      #.v.....#
      #.......#
      #./.../.#
      #.......#
      #S....R.#
      ####E####
    `,
  }),
  L(14, {
    title: 'Sunlit Gate',
    objective: 'Light the crystal to open the gate.',
    difficulty: 2,
    tutorial: 'Some crystals are wired to gates instead of the exit.',
    hint: 'Push the block north, out of the beam, then go through the gate.',
    legend: { r: { kind: 'receiver', ch: 0 } },
    map: String.raw`
      ###.#####
      #>.B...r#
      #.......#
      #.###P###
      #S#  .
      ###  E
    `,
  }),
  L(15, {
    title: 'Ember Fields',
    objective: 'Cross the ember field without touching the flames.',
    difficulty: 2,
    tutorial: 'Glowing red tiles are hazards. Touching one sends you back a step. Some fields can be switched off.',
    hint: 'The switch in the corner calms the second field.',
    legend: { f: { kind: 'hazard', when: { ch: 0, invert: true } } },
    map: String.raw`
      ##########
      #S.x...x.#
      #x...x...#
      #..x.x.xt#
      #fffffffff
      #...E....#
      ##########
    `,
  }),
  L(16, {
    title: 'Alternating Halls',
    objective: 'The switch opens one gate and closes another.',
    difficulty: 3,
    hint: 'Take the key, open the solid gate with the left switch, then use the right switch to open the striped gate.',
    map: String.raw`
      ###########
      #S..P...T.#
      #.###.###.#
      #t#k#.#t#.#
      #...#...#L#
      #########.#
              #E#
    `,
  }),
  L(17, {
    title: 'Eclipse',
    objective: 'Block the beam to open the striped gate.',
    difficulty: 3,
    tutorial: 'A powered crystal can also close striped gates. Cast a shadow to open them.',
    hint: 'Push the block into the beam, then walk through the gate it opens.',
    legend: { r: { kind: 'receiver', ch: 0 } },
    map: String.raw`
      #########
      #>.....r#
      #..B....#
      #S......#
      ####T####
         #.#
         #E#
    `,
  }),
  L(18, {
    title: 'Sunken Vault',
    objective: 'Fill the pit, then take the key.',
    difficulty: 3,
    hint: 'Fill the pit with the upper stone. Leave the lower stone alone: pushing it east seals the lock.',
    map: String.raw`
      ##########
      #S.B.o.k.#
      #....#####
      #..B.L...#
      ######.#.#
           #...E
    `,
  }),
  L(19, {
    title: 'Reflections',
    objective: 'Route the light while keeping the plate pressed.',
    difficulty: 3,
    hint: 'Hold the plate with the block so light passes the gate, then turn the far mirror north.',
    map: String.raw`
      ##########
      #v...#..R#
      #\...P..\#
      #....#...#
      #.B..#...#
      #S.p.#..E#
      ##########
    `,
  }),
  L(20, {
    title: 'Chamber of Awakening',
    objective: 'Combine every lesson of the ruins to awaken the first fragment.',
    difficulty: 4,
    hint: 'Turn the far mirror to light the crystal, then hold the plate with the block, then take the key.',
    story: 'The first fragment of the Paradox Core hums in your light. Somewhere above, the sky cracks open.',
    legend: { r: { kind: 'receiver', ch: 1 } },
    map: String.raw`
      ###########
      #>....../.#
      #.........#
      #S.#Q###r##
      #..#...k#.#
      #.x#.B..#.#
      #..#..p.P.#
      #..######L#
      #########E#
    `,
  }),
];
