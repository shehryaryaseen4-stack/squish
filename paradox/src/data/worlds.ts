export interface WorldTheme {
  id: number;
  name: string;
  subtitle: string;
  intro: string;
  mechanics: string;
  /** Scene palette. */
  skyTop: number;
  skyBottom: number;
  fog: number;
  floor: number;
  floorEdge: number;
  rock: number;
  wall: number;
  accent: number;
  particle: number;
  light: number;
  /** CSS gradient for menus. */
  css: string;
}

export const WORLDS: WorldTheme[] = [
  {
    id: 1,
    name: 'The Awakening',
    subtitle: 'Ancient ruins in golden light',
    intro:
      'You wake on a floating ruin with no memory, only a glowing cube that answers your will. Far above, the sky is cracked like glass. A voice made of light whispers: "Gather the five fragments of the Paradox Core, before the cracks reach the ground."',
    mechanics: 'Movement, keys, stones, plates, switches, light beams',
    skyTop: 0x2b1d3a,
    skyBottom: 0xf3b26b,
    fog: 0xd99a6a,
    floor: 0xd9b88a,
    floorEdge: 0xb48a5a,
    rock: 0x7a5a44,
    wall: 0x9a6f48,
    accent: 0xffc861,
    particle: 0xffe0a0,
    light: 0xffe2b8,
    css: 'linear-gradient(160deg,#3b2547 0%,#a5603f 55%,#f3b26b 100%)',
  },
  {
    id: 2,
    name: 'The Fractured Realm',
    subtitle: 'Floating islands and blue rifts',
    intro:
      'Beyond the ruins, the world has shattered into drifting islands. Rifts of blue energy stitch them together. The second fragment hums somewhere among them, pulling the islands apart as it does.',
    mechanics: 'Rifts, moving platforms, hourglass gates, light bridges',
    skyTop: 0x07152f,
    skyBottom: 0x2f7fc1,
    fog: 0x3a76b0,
    floor: 0x9fc4dc,
    floorEdge: 0x5f8fb0,
    rock: 0x3d4f66,
    wall: 0x5d7898,
    accent: 0x52d8ff,
    particle: 0x9fe8ff,
    light: 0xcfe9ff,
    css: 'linear-gradient(160deg,#07152f 0%,#164a7e 55%,#2f7fc1 100%)',
  },
  {
    id: 3,
    name: 'The Gravity Labyrinth',
    subtitle: 'Suspended laboratories that turn on their axis',
    intro:
      'A laboratory hangs in nothing, its corridors turning like the hands of a clock. Here, down is a matter of opinion. Someone built this place to study the Core. Their notes are written in your handwriting.',
    mechanics: 'Gravity pads, reversals, falling stones, rotating chambers',
    skyTop: 0x0f0820,
    skyBottom: 0x3a8a5c,
    fog: 0x2b5e4f,
    floor: 0x9bd1b0,
    floorEdge: 0x5c9d7a,
    rock: 0x2f3a46,
    wall: 0x4f6178,
    accent: 0xa77bff,
    particle: 0x7dffb2,
    light: 0xd8ffe9,
    css: 'linear-gradient(160deg,#0f0820 0%,#3a2a6a 50%,#3a8a5c 100%)',
  },
  {
    id: 4,
    name: 'The Timeless Abyss',
    subtitle: 'Cosmic clockwork in the dark',
    intro:
      'Below the laboratory lies a machine older than time: gears the size of moons turning in the dark. Every step you take echoes, and sometimes the echo arrives before the step.',
    mechanics: 'Time echoes, clockwork gates, pulsing rifts, flickering bridges',
    skyTop: 0x03030a,
    skyBottom: 0x2a1f4a,
    fog: 0x1a1430,
    floor: 0x8f8aa8,
    floorEdge: 0x5d5878,
    rock: 0x24203a,
    wall: 0x4a4466,
    accent: 0xffb347,
    particle: 0xffd27a,
    light: 0xe8dcff,
    css: 'linear-gradient(160deg,#03030a 0%,#1d1736 55%,#3c2c63 100%)',
  },
  {
    id: 5,
    name: 'The Final Paradox',
    subtitle: 'Impossible architecture around the Core',
    intro:
      'The four fragments lead you here, to architecture that folds through itself. Stairs climb into their own beginnings. At the centre waits the Paradox Core, and a figure who looks exactly like you.',
    mechanics: 'Everything combined, plus seams that join impossible places',
    skyTop: 0x12002a,
    skyBottom: 0xd04a8a,
    fog: 0x6a2a6a,
    floor: 0xe6c8f0,
    floorEdge: 0xa47ab8,
    rock: 0x3a2048,
    wall: 0x7a58b0,
    accent: 0xff5fd2,
    particle: 0xffb3f0,
    light: 0xffe6fa,
    css: 'linear-gradient(160deg,#12002a 0%,#5a1a6a 50%,#d04a8a 100%)',
  },
];

export const ENDING_TEXT = [
  'The Core opens.',
  'Inside, you see the first ruin, the first step, the first fragment, and yourself reaching for it.',
  'It was always you. Every world cracked the moment you began to mend it. Every echo was your own.',
  'This time you do not reach. You let the loop close, gently, the way a door closes behind someone who is finally home.',
  'The sky heals. The islands drift back together. Somewhere, a cube of light rests on warm stone and waits for the next explorer.',
];

/** Coin Rush arcade mode shown as its own "world" (id 6) in menus. */
export const RUSH_THEME: WorldTheme = {
  ...WORLDS[0],
  id: 6,
  name: 'Coin Rush',
  subtitle: 'Arcade dash: coins, drones and the clock',
  intro:
    'Quick arcade boards between the worlds. Grab every coin to open the exit, dodge the patrolling drones, and beat the clock for a time bonus. Each board takes about a minute.',
  mechanics: 'Coins, drones, speed',
  css: 'linear-gradient(160deg,#3a1d00 0%,#c2620e 50%,#ffd36a 100%)',
};

/** Visual theme for any level: campaign worlds, the daily pool and Coin Rush. */
export function themeFor(def: { world: number; number: number }): WorldTheme {
  if (def.world >= 1 && def.world <= 5) return WORLDS[def.world - 1];
  if (def.world === 6) return WORLDS[(def.number - 1) % 5];
  return WORLDS[def.number % 5];
}
