import {
  Compiled,
  Cond,
  DX,
  DY,
  Dir,
  LegendEntry,
  LevelDef,
  T_EXIT,
  T_FLOOR,
  T_HAZARD,
  T_RAIL,
  T_VOID,
  T_WALL,
} from './types';

/** Characters every level understands without declaring them. */
export const DEFAULT_LEGEND: Record<string, LegendEntry> = {
  '#': { kind: 'wall' },
  '.': { kind: 'floor' },
  ' ': { kind: 'void' },
  S: { kind: 'start' },
  E: { kind: 'exit' },
  x: { kind: 'hazard' },
  o: { kind: 'pit' },
  B: { kind: 'block' },
  k: { kind: 'key' },
  L: { kind: 'lock' },
  '*': { kind: 'shard' },
  p: { kind: 'plate', ch: 0 },
  P: { kind: 'door', when: { ch: 0 } },
  q: { kind: 'plate', ch: 1 },
  Q: { kind: 'door', when: { ch: 1 } },
  t: { kind: 'toggle', ch: 0 },
  T: { kind: 'door', when: { ch: 0, invert: true } },
  u: { kind: 'toggle', ch: 1 },
  U: { kind: 'door', when: { ch: 1, invert: true } },
  '>': { kind: 'emitter', dir: 1 },
  '<': { kind: 'emitter', dir: 3 },
  '^': { kind: 'emitter', dir: 0 },
  v: { kind: 'emitter', dir: 2 },
  '/': { kind: 'mirror', orient: 0 },
  '\\': { kind: 'mirror', orient: 1 },
  R: { kind: 'receiver' },
  '(': { kind: 'portal', pair: 0 },
  ')': { kind: 'portal', pair: 0 },
  '[': { kind: 'portal', pair: 1 },
  ']': { kind: 'portal', pair: 1 },
  '{': { kind: 'portal', pair: 2 },
  '}': { kind: 'portal', pair: 2 },
  n: { kind: 'pad', dir: 0 },
  e: { kind: 'pad', dir: 1 },
  s: { kind: 'pad', dir: 2 },
  w: { kind: 'pad', dir: 3 },
  '-': { kind: 'rail' },
  '=': { kind: 'platform' },
  b: { kind: 'bridge', when: { ch: 0 } },
  d: { kind: 'bridge', when: { ch: 1 } },
};

export function parseMap(map: string): string[] {
  const lines = map.replace(/\r/g, '').split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  let indent = Infinity;
  for (const l of lines) {
    if (l.trim() === '') continue;
    indent = Math.min(indent, l.length - l.trimStart().length);
  }
  if (!isFinite(indent)) indent = 0;
  const rows = lines.map((l) => l.slice(indent).replace(/\s+$/, ''));
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, ' '));
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

export class LevelError extends Error {}

export function compileLevel(def: LevelDef): Compiled {
  const rows = parseMap(def.map);
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (!w || !h) throw new LevelError(`${def.id}: empty map`);
  const n = w * h;
  const legend: Record<string, LegendEntry> = { ...DEFAULT_LEGEND, ...(def.legend ?? {}) };
  const neg = () => new Int16Array(n).fill(-1);
  const c: Compiled = {
    def,
    w,
    h,
    terrain: new Uint8Array(n),
    start: -1,
    exit: -1,
    hazardWhen: new Map(),
    items: [],
    itemAt: neg(),
    plates: [],
    plateAt: neg(),
    toggles: [],
    toggleAt: neg(),
    timers: [],
    timerAt: neg(),
    doors: [],
    doorAt: neg(),
    bridges: [],
    bridgeAt: neg(),
    emitters: [],
    emitterAt: neg(),
    mirrors: [],
    mirrorAt: neg(),
    receivers: [],
    receiverAt: neg(),
    portals: [],
    portalPartner: neg(),
    padAt: new Int8Array(n).fill(-1),
    platforms: [],
    railAt: neg(),
    blocks: [],
    links: new Map(),
    channels: 0,
    clockPeriod: 1,
    allowWait: false,
    mechanics: [],
  };
  const conds: Cond[] = [];
  const useCh = (ch: number) => (c.channels = Math.max(c.channels, ch + 1));
  const platformStarts: { cell: number; when?: Cond }[] = [];
  const portalCells: Record<number, number[]> = {};

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const i = y * w + x;
      const e = legend[ch];
      if (!e) throw new LevelError(`${def.id}: unknown map character '${ch}' at ${x},${y}`);
      let t = T_FLOOR;
      switch (e.kind) {
        case 'wall':
          t = T_WALL;
          break;
        case 'void':
          t = T_VOID;
          break;
        case 'floor':
          break;
        case 'start':
          if (c.start >= 0) throw new LevelError(`${def.id}: two starts`);
          c.start = i;
          break;
        case 'exit':
          if (c.exit >= 0) throw new LevelError(`${def.id}: two exits`);
          c.exit = i;
          t = T_EXIT;
          break;
        case 'hazard':
          t = T_HAZARD;
          if (e.when) {
            c.hazardWhen.set(i, e.when);
            conds.push(e.when);
          }
          break;
        case 'pit':
          c.itemAt[i] = c.items.length;
          c.items.push({ cell: i, kind: 'pit' });
          break;
        case 'block':
          c.blocks.push(i);
          break;
        case 'key':
        case 'lock':
        case 'shard':
          c.itemAt[i] = c.items.length;
          c.items.push({ cell: i, kind: e.kind });
          break;
        case 'plate':
          useCh(e.ch);
          c.plateAt[i] = c.plates.length;
          c.plates.push({ cell: i, ch: e.ch });
          break;
        case 'toggle':
          useCh(e.ch);
          c.toggleAt[i] = c.toggles.length;
          c.toggles.push({ cell: i, ch: e.ch });
          break;
        case 'timer':
          useCh(e.ch);
          c.timerAt[i] = c.timers.length;
          c.timers.push({ cell: i, ch: e.ch, dur: e.dur });
          break;
        case 'door':
          conds.push(e.when);
          c.doorAt[i] = c.doors.length;
          c.doors.push({ cell: i, when: e.when });
          break;
        case 'bridge':
          // Top-down: a bridge spans a gap. Gravity chamber: it is a block that phases in.
          t = def.gravity !== undefined ? T_FLOOR : T_VOID;
          conds.push(e.when);
          c.bridgeAt[i] = c.bridges.length;
          c.bridges.push({ cell: i, when: e.when });
          break;
        case 'emitter':
          t = T_WALL;
          if (e.when) conds.push(e.when);
          c.emitterAt[i] = c.emitters.length;
          c.emitters.push({ cell: i, dir: e.dir, when: e.when });
          break;
        case 'mirror':
          t = T_WALL;
          c.mirrorAt[i] = c.mirrors.length;
          c.mirrors.push({ cell: i, orient: e.orient, fixed: !!e.fixed });
          break;
        case 'receiver':
          t = T_WALL;
          if (e.ch !== undefined) useCh(e.ch);
          c.receiverAt[i] = c.receivers.length;
          c.receivers.push({ cell: i, ch: e.ch });
          break;
        case 'portal':
          (portalCells[e.pair] ??= []).push(i);
          c.portals.push({ cell: i, pair: e.pair });
          break;
        case 'pad':
          c.padAt[i] = e.dir;
          break;
        case 'rail':
          t = T_RAIL;
          break;
        case 'platform':
          t = T_RAIL;
          if (e.when) conds.push(e.when);
          platformStarts.push({ cell: i, when: e.when });
          break;
      }
      c.terrain[i] = t;
    }
  }
  if (c.start < 0) throw new LevelError(`${def.id}: missing start`);
  if (c.exit < 0) throw new LevelError(`${def.id}: missing exit`);

  for (const [pair, cells] of Object.entries(portalCells)) {
    if (cells.length !== 2) throw new LevelError(`${def.id}: portal pair ${pair} needs exactly 2 ends`);
    c.portalPartner[cells[0]] = cells[1];
    c.portalPartner[cells[1]] = cells[0];
  }

  // Platforms ride along a connected rail line; order it end to end.
  const isRail = (i: number) => c.terrain[i] === T_RAIL;
  for (const ps of platformStarts) {
    const seen = new Set<number>([ps.cell]);
    const stack = [ps.cell];
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i / w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (isRail(j) && !seen.has(j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    const cells = [...seen];
    const deg = (i: number) =>
      cells.filter((j) => Math.abs((j % w) - (i % w)) + Math.abs(((j / w) | 0) - ((i / w) | 0)) === 1).length;
    const ends = cells.filter((i) => deg(i) <= 1);
    if (cells.length < 2 || ends.length !== 2 || cells.some((i) => deg(i) > 2))
      throw new LevelError(`${def.id}: platform rail must be a simple open path`);
    const path = [ends[0]];
    const used = new Set(path);
    while (path.length < cells.length) {
      const last = path[path.length - 1];
      const nxt = cells.find((j) => !used.has(j) && deg(j) >= 1 &&
        Math.abs((j % w) - (last % w)) + Math.abs(((j / w) | 0) - ((last / w) | 0)) === 1);
      if (nxt === undefined) break;
      path.push(nxt);
      used.add(nxt);
    }
    const idx = c.platforms.length;
    for (const cell of path) {
      if (c.railAt[cell] >= 0) throw new LevelError(`${def.id}: platforms share a rail`);
      c.railAt[cell] = idx;
    }
    c.platforms.push({ path, start: path.indexOf(ps.cell), when: ps.when });
  }

  for (const l of def.links ?? []) {
    const ia = l.a[1] * w + l.a[0];
    const ib = l.b[1] * w + l.b[0];
    // Leaving a through side a[2] arrives in b moving away from side b[2].
    c.links.set(ia * 4 + l.a[2], { cell: ib, dir: ((l.b[2] + 2) & 3) as Dir, when: l.when });
    c.links.set(ib * 4 + l.b[2], { cell: ia, dir: ((l.a[2] + 2) & 3) as Dir, when: l.when });
    if (l.when) conds.push(l.when);
  }

  for (const cd of conds) {
    if (cd.ch !== undefined) useCh(cd.ch);
    if (cd.period) c.clockPeriod = lcm(c.clockPeriod, cd.period);
  }

  if (def.gravity !== undefined && c.platforms.length)
    throw new LevelError(`${def.id}: moving platforms are not supported in gravity chambers`);

  const m = new Set<string>();
  m.add('move');
  if (c.blocks.length) m.add('blocks');
  if (c.items.some((i) => i.kind === 'key')) m.add('keys');
  if (c.items.some((i) => i.kind === 'pit')) m.add('pits');
  if (c.items.some((i) => i.kind === 'shard')) m.add('shards');
  if (c.plates.length) m.add('plates');
  if (c.toggles.length) m.add('switches');
  if (c.timers.length) m.add('timers');
  if (c.doors.length) m.add('doors');
  if (c.bridges.length) m.add('bridges');
  if (c.emitters.length) m.add('beams');
  if (c.mirrors.length) m.add('mirrors');
  if (c.portals.length) m.add('portals');
  if (c.platforms.length) m.add('platforms');
  if (def.gravity !== undefined) m.add('gravity');
  if (def.flips) m.add('flip');
  if (def.echo) m.add('echo');
  if (c.links.size) m.add('links');
  if (c.clockPeriod > 1) m.add('clockwork');
  if (c.hazardWhen.size || c.terrain.includes(T_HAZARD)) m.add('hazards');
  c.mechanics = [...m];
  c.allowWait = !!def.echo || c.platforms.length > 0 || c.timers.length > 0 || c.clockPeriod > 1;
  return c;
}

export const cellX = (c: Compiled, i: number) => i % c.w;
export const cellY = (c: Compiled, i: number) => (i / c.w) | 0;
