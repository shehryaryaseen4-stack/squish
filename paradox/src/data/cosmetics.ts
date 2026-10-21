export type CosmeticSlot = 'skin' | 'trail' | 'portal';

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  name: string;
  description: string;
  /** Main colour, and secondary colour for gradients/shimmer. */
  color: number;
  color2: number;
  /** How it is obtained. Price in coins, or a source that grants it. */
  price?: number;
  source?: 'default' | 'world' | 'achievement' | 'ad' | 'ending';
  sourceRef?: string;
}

export const COSMETICS: Cosmetic[] = [
  // Cube skins
  { id: 'skin-core', slot: 'skin', name: 'Core Light', description: 'The cube as you found it.', color: 0x6ff3ff, color2: 0x2a8cff, source: 'default' },
  { id: 'skin-ember', slot: 'skin', name: 'Ember', description: 'Warm as the ruins at dusk.', color: 0xffa24a, color2: 0xff4f2a, price: 150 },
  { id: 'skin-verdant', slot: 'skin', name: 'Verdant', description: 'Grown in the laboratory gardens.', color: 0x7dff9a, color2: 0x1fb86a, price: 200 },
  { id: 'skin-violet', slot: 'skin', name: 'Violet Field', description: 'Charged with gravity.', color: 0xc58bff, color2: 0x6b3bff, price: 250 },
  { id: 'skin-gold', slot: 'skin', name: 'Sunstone', description: 'Reward for awakening the first fragment.', color: 0xffd76a, color2: 0xffa500, source: 'world', sourceRef: '1' },
  { id: 'skin-azure', slot: 'skin', name: 'Riftglass', description: 'Reward for the Fractured Realm.', color: 0x8fe3ff, color2: 0x3a6dff, source: 'world', sourceRef: '2' },
  { id: 'skin-obsidian', slot: 'skin', name: 'Obsidian', description: 'Reward for the Gravity Labyrinth.', color: 0x8a8aa8, color2: 0x1a1a2a, source: 'world', sourceRef: '3' },
  { id: 'skin-clockwork', slot: 'skin', name: 'Clockwork', description: 'Reward for the Timeless Abyss.', color: 0xffc56a, color2: 0x8a5a2a, source: 'world', sourceRef: '4' },
  { id: 'skin-prism', slot: 'skin', name: 'Prism', description: 'Optional bonus from a rewarded video.', color: 0xff7ad9, color2: 0x7affe1, source: 'ad' },
  { id: 'skin-paradox', slot: 'skin', name: 'Paradox', description: 'You closed the loop.', color: 0xffffff, color2: 0xff5fd2, source: 'ending' },
  // Trails
  { id: 'trail-none', slot: 'trail', name: 'No Trail', description: 'Clean and quiet.', color: 0xffffff, color2: 0xffffff, source: 'default' },
  { id: 'trail-sparks', slot: 'trail', name: 'Sparks', description: 'Tiny sparks behind every roll.', color: 0xfff1a0, color2: 0xff9a3a, price: 120 },
  { id: 'trail-stardust', slot: 'trail', name: 'Stardust', description: 'A soft cosmic shimmer.', color: 0xb9c8ff, color2: 0xffffff, price: 180 },
  { id: 'trail-embers', slot: 'trail', name: 'Embers', description: 'Glowing embers drift upward.', color: 0xff6a2a, color2: 0xffd27a, source: 'achievement', sourceRef: 'stars-100' },
  { id: 'trail-echo', slot: 'trail', name: 'Afterimage', description: 'Faint echoes of where you were.', color: 0x9ffcff, color2: 0x5a7aff, source: 'achievement', sourceRef: 'echo-first' },
  // Portal colours
  { id: 'portal-azure', slot: 'portal', name: 'Azure Rifts', description: 'The classic rift glow.', color: 0x52d8ff, color2: 0x2a5aff, source: 'default' },
  { id: 'portal-rose', slot: 'portal', name: 'Rose Rifts', description: 'Rifts the colour of dawn.', color: 0xff7ab8, color2: 0xff3a6a, price: 140 },
  { id: 'portal-jade', slot: 'portal', name: 'Jade Rifts', description: 'Calm green rifts.', color: 0x6affb0, color2: 0x1aa86a, price: 140 },
  { id: 'portal-sun', slot: 'portal', name: 'Solar Rifts', description: 'Blazing golden rifts.', color: 0xffd060, color2: 0xff7a1a, source: 'achievement', sourceRef: 'perfect-10' },
  { id: 'portal-void', slot: 'portal', name: 'Void Rifts', description: 'Rifts that drink the light.', color: 0xb07aff, color2: 0x20003a, price: 300 },
];

export const DEFAULT_EQUIPPED = { skin: 'skin-core', trail: 'trail-none', portal: 'portal-azure' };

export const cosmeticById = (id: string) => COSMETICS.find((c) => c.id === id);
