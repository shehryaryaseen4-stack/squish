// Shared types for the deterministic puzzle simulation.
// The simulation is pure data in, data out: the renderer, the hint system and
// the automated solver all drive the very same `step` function.

/** 0 = north (up the map), 1 = east, 2 = south, 3 = west. */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const opposite = (d: number): Dir => ((d + 2) & 3) as Dir;

/** Player actions. Directions 0-3 are moves. */
export const A_WAIT = 4;
export const A_ECHO = 5;
export const A_FLIP = 6;
export type Action = number;
export const ACTION_CHARS = ['N', 'E', 'S', 'W', '.', 'R', 'F'];

/** A condition that makes a door, bridge, hazard, emitter or platform active. */
export interface Cond {
  /** Active while this channel is powered (plate, switch, timer or receiver). */
  ch?: number;
  /** Active on these phases of `tick % period` (clockwork mechanisms). */
  period?: number;
  phases?: number[];
  /** Flip the result. */
  invert?: boolean;
}

export type LegendEntry =
  | { kind: 'wall' }
  | { kind: 'floor' }
  | { kind: 'void' }
  | { kind: 'start' }
  | { kind: 'exit' }
  | { kind: 'hazard'; when?: Cond }
  | { kind: 'pit' }
  | { kind: 'block' }
  | { kind: 'key' }
  | { kind: 'lock' }
  | { kind: 'shard' }
  | { kind: 'plate'; ch: number }
  | { kind: 'toggle'; ch: number }
  | { kind: 'timer'; ch: number; dur: number }
  | { kind: 'door'; when: Cond }
  | { kind: 'bridge'; when: Cond }
  | { kind: 'emitter'; dir: Dir; when?: Cond }
  | { kind: 'mirror'; orient: 0 | 1; fixed?: boolean }
  | { kind: 'receiver'; ch?: number }
  | { kind: 'portal'; pair: number }
  | { kind: 'pad'; dir: Dir }
  | { kind: 'rail' }
  | { kind: 'platform'; when?: Cond };

/** A non-Euclidean connection: leaving cell `a` through side a[2] arrives in `b`
 *  through side b[2] (and vice versa). */
export interface LinkDef {
  a: [number, number, Dir];
  b: [number, number, Dir];
  when?: Cond;
}

export interface LevelDef {
  id: string;
  world: number;
  /** 1..100 for the campaign; daily puzzles use 1..n inside their own pool. */
  number: number;
  title: string;
  objective: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  map: string;
  legend?: Record<string, LegendEntry>;
  /** Shown the first time a level is opened (mechanic introductions). */
  tutorial?: string;
  /** Text hint, always available for free. */
  hint: string;
  /** Initial gravity (side-view chamber). Omit for top-down levels. */
  gravity?: Dir;
  /** Number of manual gravity reversals available. */
  flips?: number;
  /** Time echo: maximum recorded actions. Omit when echoes are not available. */
  echo?: number;
  links?: LinkDef[];
  /** Short story beat shown on completion. */
  story?: string;
}

// Terrain codes
export const T_VOID = 0;
export const T_FLOOR = 1;
export const T_WALL = 2;
export const T_HAZARD = 3;
export const T_EXIT = 4;
export const T_RAIL = 5;

export type ItemKind = 'key' | 'lock' | 'shard' | 'pit';

export interface Compiled {
  def: LevelDef;
  w: number;
  h: number;
  terrain: Uint8Array;
  start: number;
  exit: number;
  hazardWhen: Map<number, Cond>;
  items: { cell: number; kind: ItemKind }[];
  itemAt: Int16Array;
  plates: { cell: number; ch: number }[];
  plateAt: Int16Array;
  toggles: { cell: number; ch: number }[];
  toggleAt: Int16Array;
  timers: { cell: number; ch: number; dur: number }[];
  timerAt: Int16Array;
  doors: { cell: number; when: Cond }[];
  doorAt: Int16Array;
  bridges: { cell: number; when: Cond }[];
  bridgeAt: Int16Array;
  emitters: { cell: number; dir: Dir; when?: Cond }[];
  emitterAt: Int16Array;
  mirrors: { cell: number; orient: 0 | 1; fixed: boolean }[];
  mirrorAt: Int16Array;
  receivers: { cell: number; ch?: number }[];
  receiverAt: Int16Array;
  portals: { cell: number; pair: number }[];
  portalPartner: Int16Array;
  padAt: Int8Array;
  platforms: { path: number[]; start: number; when?: Cond }[];
  railAt: Int16Array;
  blocks: number[];
  links: Map<number, { cell: number; dir: Dir; when?: Cond }>;
  channels: number;
  clockPeriod: number;
  allowWait: boolean;
  mechanics: string[];
}

export interface BeamSeg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface State {
  p: number;
  keys: number;
  /** 1 = consumed (key/shard collected, lock opened, pit filled). */
  items: number[];
  /** Block cells in stable identity order; -1 when destroyed. */
  blocks: number[];
  toggles: number[];
  timers: number[];
  mirrors: number[];
  plat: number[];
  platDir: number[];
  grav: number;
  flips: number;
  tick: number;
  /** 0 none, 1 recording, 2 replaying. */
  echo: number;
  rec: number[];
  snap: State | null;
  ghost: number;
  gm: number[];
  gt: number;
  moves: number;
  /** 0 playing, 1 won, 2 dead. */
  status: number;
  // ---- derived each step (not part of the identity key) ----
  act: boolean[];
  pow: boolean[];
  beams: BeamSeg[];
  exitOpen: boolean;
}

export type GameEvent =
  | { t: 'move'; who: 'p' | 'g'; from: number; to: number }
  | { t: 'push'; block: number; from: number; to: number }
  | { t: 'teleport'; who: 'p' | 'g' | 'b'; from: number; to: number; block?: number }
  | { t: 'link'; who: 'p' | 'g' | 'b'; from: number; to: number }
  | { t: 'fall'; who: 'p' | 'g' | 'b'; from: number; to: number; block?: number }
  | { t: 'fill'; block: number; cell: number }
  | { t: 'key'; cell: number }
  | { t: 'shard'; cell: number }
  | { t: 'unlock'; cell: number }
  | { t: 'toggle'; cell: number }
  | { t: 'timer'; cell: number }
  | { t: 'mirror'; cell: number }
  | { t: 'gravity'; dir: number }
  | { t: 'record' }
  | { t: 'rewind' }
  | { t: 'wait' }
  | { t: 'lost'; who: 'g' | 'b'; block?: number }
  | { t: 'dead'; reason: 'hazard' | 'fall' | 'loop' }
  | { t: 'win' };
