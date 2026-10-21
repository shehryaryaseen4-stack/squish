import {
  A_ECHO,
  A_FLIP,
  A_WAIT,
  Action,
  BeamSeg,
  Compiled,
  Cond,
  DX,
  DY,
  Dir,
  GameEvent,
  State,
  T_EXIT,
  T_HAZARD,
  T_RAIL,
  T_VOID,
  T_WALL,
  opposite,
} from './types';

export function initialState(L: Compiled): State {
  const st: State = {
    p: L.start,
    keys: 0,
    items: L.items.map(() => 0),
    blocks: [...L.blocks],
    toggles: new Array(L.channels).fill(0),
    timers: new Array(L.channels).fill(0),
    mirrors: L.mirrors.map((m) => m.orient),
    plat: L.platforms.map((p) => p.start),
    platDir: L.platforms.map((p) => (p.start >= p.path.length - 1 ? -1 : 1)),
    grav: L.def.gravity ?? -1,
    flips: L.def.flips ?? 0,
    tick: 0,
    echo: 0,
    rec: [],
    snap: null,
    ghost: -1,
    gm: [],
    gt: 0,
    moves: 0,
    status: 0,
    act: new Array(L.channels).fill(false),
    pow: L.receivers.map(() => false),
    beams: [],
    exitOpen: false,
  };
  settleGravity(L, st, []);
  derive(L, st);
  return st;
}

export function cloneState(s: State): State {
  return {
    p: s.p,
    keys: s.keys,
    items: s.items.slice(),
    blocks: s.blocks.slice(),
    toggles: s.toggles.slice(),
    timers: s.timers.slice(),
    mirrors: s.mirrors.slice(),
    plat: s.plat.slice(),
    platDir: s.platDir.slice(),
    grav: s.grav,
    flips: s.flips,
    tick: s.tick,
    echo: s.echo,
    rec: s.rec.slice(),
    snap: s.snap,
    ghost: s.ghost,
    gm: s.gm,
    gt: s.gt,
    moves: s.moves,
    status: s.status,
    act: s.act.slice(),
    pow: s.pow.slice(),
    beams: s.beams,
    exitOpen: s.exitOpen,
  };
}

// Snapshots are shared by reference between all states of one recording, so
// they get a short id instead of being re-serialised for every key.
const snapIds = new WeakMap<State, string>();
let snapKeys = new Map<string, string>();
function snapId(L: Compiled, snap: State): string {
  let id = snapIds.get(snap);
  if (id === undefined) {
    const k = stateKey(L, snap);
    id = snapKeys.get(k);
    if (id === undefined) {
      if (snapKeys.size > 200000) snapKeys = new Map();
      id = `#${L.def.id}:${snapKeys.size}`;
      snapKeys.set(k, id);
    }
    snapIds.set(snap, id);
  }
  return id;
}

/** Identity of a state for search/deduplication (ignores move count). */
export function stateKey(L: Compiled, s: State): string {
  const blocks = s.blocks.length > 1 ? s.blocks.slice().sort((a, b) => a - b).join(',') : s.blocks.join(',');
  let k = `${s.p}|${s.keys}|${s.items.join('')}|${blocks}|${s.toggles.join('')}|${s.timers.join(',')}|${s.mirrors.join('')}|${s.plat.join(',')}/${s.platDir.join(',')}|${s.grav}|${s.flips}|${L.clockPeriod > 1 ? s.tick % L.clockPeriod : 0}|${s.echo}`;
  if (s.echo === 1) k += `|${s.rec.join('')}|${s.snap ? snapId(L, s.snap) : ''}`;
  else if (s.echo === 2) k += `|${s.ghost}|${s.gm.slice(s.gt).join('')}`;
  return k;
}

export function condActive(L: Compiled, s: State, c: Cond | undefined): boolean {
  if (!c) return true;
  let v = true;
  if (c.ch !== undefined) v = !!s.act[c.ch];
  if (c.period) v = v && (c.phases ?? [0]).includes(s.tick % c.period);
  void L;
  return c.invert ? !v : v;
}

export function blockAt(s: State, cell: number): number {
  for (let i = 0; i < s.blocks.length; i++) if (s.blocks[i] === cell) return i;
  return -1;
}

export function platformAt(L: Compiled, s: State, cell: number): number {
  const r = L.railAt[cell];
  if (r < 0) return -1;
  return L.platforms[r].path[s.plat[r]] === cell ? r : -1;
}

/** Open = passable. Doors stay open while something stands in them. */
export function doorOpen(L: Compiled, s: State, cell: number): boolean {
  const d = L.doorAt[cell];
  if (d < 0) return true;
  if (condActive(L, s, L.doors[d].when)) return true;
  return s.p === cell || blockAt(s, cell) >= 0 || s.ghost === cell;
}

export function bridgeSolid(L: Compiled, s: State, cell: number): boolean {
  const b = L.bridgeAt[cell];
  return b >= 0 && condActive(L, s, L.bridges[b].when);
}

export function hazardActive(L: Compiled, s: State, cell: number): boolean {
  if (L.terrain[cell] !== T_HAZARD) return false;
  return condActive(L, s, L.hazardWhen.get(cell));
}

export function lockClosed(L: Compiled, s: State, cell: number): boolean {
  const i = L.itemAt[cell];
  return i >= 0 && L.items[i].kind === 'lock' && s.items[i] === 0;
}

export function pitOpen(L: Compiled, s: State, cell: number): boolean {
  const i = L.itemAt[cell];
  return i >= 0 && L.items[i].kind === 'pit' && s.items[i] === 0;
}

/** Neighbour in direction d, following active non-Euclidean links. -1 = off board. */
export function nextCell(L: Compiled, s: State, cell: number, d: number): { cell: number; dir: Dir; linked: boolean } {
  const link = L.links.get(cell * 4 + d);
  if (link && condActive(L, s, link.when)) return { cell: link.cell, dir: link.dir, linked: true };
  const x = (cell % L.w) + DX[d];
  const y = ((cell / L.w) | 0) + DY[d];
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return { cell: -1, dir: d as Dir, linked: false };
  return { cell: y * L.w + x, dir: d as Dir, linked: false };
}

/** Static solid: walls, emitters, mirrors, receivers, closed locks/doors. */
function solid(L: Compiled, s: State, cell: number): boolean {
  if (L.terrain[cell] === T_WALL) return true;
  if (lockClosed(L, s, cell)) return true;
  if (!doorOpen(L, s, cell)) return true;
  if (L.def.gravity !== undefined && bridgeSolid(L, s, cell))
    return !(s.p === cell || s.ghost === cell || blockAt(s, cell) >= 0);
  return false;
}

/** Can a body rest/stand in this cell (top-down)? */
function groundAt(L: Compiled, s: State, cell: number): boolean {
  const t = L.terrain[cell];
  if (t === T_VOID) return bridgeSolid(L, s, cell);
  if (t === T_RAIL) return platformAt(L, s, cell) >= 0;
  if (pitOpen(L, s, cell)) return false;
  return t !== T_WALL;
}

const gravityMode = (s: State) => s.grav >= 0;

/** In a gravity chamber ' ' is the abyss; everything else that is not solid is air. */
function abyss(L: Compiled, cell: number) {
  return L.terrain[cell] === T_VOID;
}

function onEnter(L: Compiled, s: State, cell: number, who: 'p' | 'g', ev: GameEvent[]) {
  const tg = L.toggleAt[cell];
  if (tg >= 0) {
    s.toggles[L.toggles[tg].ch] ^= 1;
    ev.push({ t: 'toggle', cell });
  }
  const tm = L.timerAt[cell];
  if (tm >= 0) {
    s.timers[L.timers[tm].ch] = L.timers[tm].dur + 1;
    ev.push({ t: 'timer', cell });
  }
  if (who === 'p') {
    const it = L.itemAt[cell];
    if (it >= 0 && s.items[it] === 0) {
      const kind = L.items[it].kind;
      if (kind === 'key') {
        s.items[it] = 1;
        s.keys++;
        ev.push({ t: 'key', cell });
      } else if (kind === 'shard') {
        s.items[it] = 1;
        ev.push({ t: 'shard', cell });
      }
    }
    if (gravityMode(s) && L.padAt[cell] >= 0 && L.padAt[cell] !== s.grav) {
      s.grav = L.padAt[cell];
      ev.push({ t: 'gravity', dir: s.grav });
    }
  }
}

/** Can a block be pushed into `cell`? Returns final cell (after portal) or -2 for pit fill, -1 invalid. */
function blockTarget(L: Compiled, s: State, cell: number): number {
  if (cell < 0) return -1;
  if (solid(L, s, cell)) return -1;
  if (blockAt(s, cell) >= 0 || s.p === cell) return -1;
  if (L.terrain[cell] === T_HAZARD) return -1;
  const it = L.itemAt[cell];
  if (it >= 0) {
    const k = L.items[it].kind;
    if (k === 'pit' && s.items[it] === 0) return gravityMode(s) ? -1 : -2;
    if ((k === 'key' || k === 'shard') && s.items[it] === 0) return -1;
  }
  if (gravityMode(s)) {
    if (abyss(L, cell)) return -1;
  } else if (!groundAt(L, s, cell)) return -1;
  const partner = L.portalPartner[cell];
  if (partner >= 0) {
    if (blockAt(s, partner) >= 0 || s.p === partner || solid(L, s, partner)) return -1;
    return partner;
  }
  return cell;
}

/** Attempt to move the player one step. Returns false when nothing happens. */
function movePlayer(L: Compiled, s: State, d: number, ev: GameEvent[]): boolean {
  const from = s.p;
  const nx = nextCell(L, s, from, d);
  const t = nx.cell;
  if (t < 0) return false;
  const mi = L.mirrorAt[t];
  if (mi >= 0) {
    if (L.mirrors[mi].fixed) return false;
    s.mirrors[mi] ^= 1;
    ev.push({ t: 'mirror', cell: t });
    return true;
  }
  if (L.terrain[t] === T_WALL) return false;
  if (lockClosed(L, s, t)) {
    if (s.keys <= 0) return false;
    s.keys--;
    s.items[L.itemAt[t]] = 1;
    ev.push({ t: 'unlock', cell: t });
  }
  if (!doorOpen(L, s, t)) return false;
  if (gravityMode(s)) {
    if (abyss(L, t)) return false;
  } else if (!groundAt(L, s, t)) return false;

  const b = blockAt(s, t);
  if (b >= 0) {
    const beyond = nextCell(L, s, t, nx.dir);
    const dest = blockTarget(L, s, beyond.cell);
    if (dest === -1) return false;
    if (dest === -2) {
      s.items[L.itemAt[beyond.cell]] = 1;
      s.blocks[b] = -1;
      ev.push({ t: 'push', block: b, from: t, to: beyond.cell });
      ev.push({ t: 'fill', block: b, cell: beyond.cell });
    } else {
      s.blocks[b] = dest;
      ev.push({ t: 'push', block: b, from: t, to: beyond.cell });
      if (dest !== beyond.cell) ev.push({ t: 'teleport', who: 'b', block: b, from: beyond.cell, to: dest });
    }
  }

  let dest = t;
  const partner = L.portalPartner[t];
  if (partner >= 0) {
    if (blockAt(s, partner) >= 0 || solid(L, s, partner)) return false;
    dest = partner;
  }
  s.p = dest;
  if (nx.linked) ev.push({ t: 'link', who: 'p', from, to: t });
  else ev.push({ t: 'move', who: 'p', from, to: t });
  if (dest !== t) ev.push({ t: 'teleport', who: 'p', from: t, to: dest });
  onEnter(L, s, dest, 'p', ev);
  return true;
}

/** Echoes are intangible: they follow walls and doors but never push. */
function moveGhost(L: Compiled, s: State, d: number, ev: GameEvent[]) {
  if (s.ghost < 0) return;
  const from = s.ghost;
  if (gravityMode(s) && (d === s.grav || d === opposite(s.grav))) return;
  const nx = nextCell(L, s, from, d);
  const t = nx.cell;
  if (t < 0 || solid(L, s, t) || blockAt(s, t) >= 0) return;
  if (gravityMode(s)) {
    if (abyss(L, t)) return;
  } else if (!groundAt(L, s, t)) return;
  let dest = t;
  const partner = L.portalPartner[t];
  if (partner >= 0) {
    if (blockAt(s, partner) >= 0 || solid(L, s, partner)) return;
    dest = partner;
  }
  s.ghost = dest;
  ev.push({ t: nx.linked ? 'link' : 'move', who: 'g', from, to: t });
  if (dest !== t) ev.push({ t: 'teleport', who: 'g', from: t, to: dest });
  onEnter(L, s, dest, 'g', ev);
}

function movePlatforms(L: Compiled, s: State, ev: GameEvent[]) {
  for (let i = 0; i < L.platforms.length; i++) {
    const pf = L.platforms[i];
    if (!condActive(L, s, pf.when)) continue;
    let nextIdx = s.plat[i] + s.platDir[i];
    if (nextIdx < 0 || nextIdx >= pf.path.length) {
      s.platDir[i] = -s.platDir[i];
      nextIdx = s.plat[i] + s.platDir[i];
    }
    const from = pf.path[s.plat[i]];
    const to = pf.path[nextIdx];
    s.plat[i] = nextIdx;
    if (nextIdx === 0 || nextIdx === pf.path.length - 1) s.platDir[i] = -s.platDir[i];
    if (s.p === from) {
      s.p = to;
      ev.push({ t: 'move', who: 'p', from, to });
    }
    if (s.ghost === from) {
      s.ghost = to;
      ev.push({ t: 'move', who: 'g', from, to });
    }
    const b = blockAt(s, from);
    if (b >= 0) {
      s.blocks[b] = to;
      ev.push({ t: 'push', block: b, from, to });
    }
  }
}

/** Gravity chamber: everything loose falls one cell at a time until it rests. */
function settleGravity(L: Compiled, s: State, ev: GameEvent[]): boolean {
  if (!gravityMode(s)) return true;
  for (let iter = 0; iter < 300; iter++) {
    let moved = false;
    // Bodies closest to the floor fall first so stacks settle naturally.
    const g = s.grav;
    const depth = (cell: number) => (cell % L.w) * DX[g] + ((cell / L.w) | 0) * DY[g];
    const bodies: { who: 'p' | 'g' | 'b'; idx: number; cell: number }[] = [];
    if (s.p >= 0 && s.status === 0) bodies.push({ who: 'p', idx: 0, cell: s.p });
    if (s.ghost >= 0) bodies.push({ who: 'g', idx: 0, cell: s.ghost });
    s.blocks.forEach((c, i) => c >= 0 && bodies.push({ who: 'b', idx: i, cell: c }));
    bodies.sort((a, b) => depth(b.cell) - depth(a.cell));
    for (const body of bodies) {
      const cur = body.who === 'p' ? s.p : body.who === 'g' ? s.ghost : s.blocks[body.idx];
      if (cur < 0) continue;
      const nx = nextCell(L, s, cur, s.grav);
      const t = nx.cell;
      if (t < 0 || abyss(L, t)) {
        // Fell out of the chamber.
        if (body.who === 'p') {
          s.status = 2;
          ev.push({ t: 'fall', who: 'p', from: cur, to: t < 0 ? cur : t });
          ev.push({ t: 'dead', reason: 'fall' });
          return false;
        }
        if (body.who === 'g') s.ghost = -1;
        else s.blocks[body.idx] = -1;
        ev.push({ t: 'lost', who: body.who, block: body.who === 'b' ? body.idx : undefined });
        moved = true;
        continue;
      }
      if (solid(L, s, t) || blockAt(s, t) >= 0) continue;
      if (body.who !== 'g' && s.p === t) continue;
      if (body.who === 'b' && L.itemAt[t] >= 0 && s.items[L.itemAt[t]] === 0 && L.items[L.itemAt[t]].kind !== 'lock') continue;
      let dest = t;
      const partner = L.portalPartner[t];
      if (partner >= 0) {
        if (blockAt(s, partner) >= 0 || solid(L, s, partner) || (body.who !== 'g' && s.p === partner)) continue;
        dest = partner;
      }
      if (body.who === 'p') s.p = dest;
      else if (body.who === 'g') s.ghost = dest;
      else s.blocks[body.idx] = dest;
      ev.push({ t: 'fall', who: body.who, from: cur, to: t, block: body.who === 'b' ? body.idx : undefined });
      if (dest !== t) ev.push({ t: 'teleport', who: body.who, from: t, to: dest, block: body.who === 'b' ? body.idx : undefined });
      if (body.who !== 'b') onEnter(L, s, dest, body.who, ev);
      moved = true;
      if (body.who === 'p' && hazardActive(L, s, dest)) {
        s.status = 2;
        ev.push({ t: 'dead', reason: 'hazard' });
        return false;
      }
    }
    if (!moved) return true;
  }
  s.status = 2;
  ev.push({ t: 'dead', reason: 'loop' });
  return false;
}

/** Trace beams and resolve channels to a fixed point. */
export function derive(L: Compiled, s: State) {
  const base = new Array(L.channels).fill(false);
  const occupied = (cell: number) => s.p === cell || s.ghost === cell || blockAt(s, cell) >= 0;
  for (const pl of L.plates) if (occupied(pl.cell)) base[pl.ch] = true;
  for (let ch = 0; ch < L.channels; ch++) if (s.toggles[ch] || s.timers[ch] > 0) base[ch] = true;
  s.act = base.slice();
  let pow: boolean[] = L.receivers.map(() => false);
  let beams: BeamSeg[] = [];
  for (let iter = 0; iter < 6; iter++) {
    ({ pow, beams } = traceBeams(L, s));
    const next = base.slice();
    L.receivers.forEach((r, i) => {
      if (pow[i] && r.ch !== undefined) next[r.ch] = true;
    });
    const same = next.every((v, i) => v === s.act[i]);
    s.act = next;
    if (same) break;
  }
  s.pow = pow;
  s.beams = beams;
  const receiversOk = L.receivers.every((r, i) => r.ch !== undefined || pow[i]);
  const shardsOk = L.items.every((it, i) => it.kind !== 'shard' || s.items[i] === 1);
  s.exitOpen = receiversOk && shardsOk;
}

export function traceBeams(L: Compiled, s: State): { pow: boolean[]; beams: BeamSeg[] } {
  const pow = L.receivers.map(() => false);
  const beams: BeamSeg[] = [];
  const cx = (c: number) => c % L.w;
  const cy = (c: number) => (c / L.w) | 0;
  for (const em of L.emitters) {
    if (!condActive(L, s, em.when)) continue;
    let c = em.cell;
    let d: number = em.dir;
    let sx = cx(c);
    let sy = cy(c);
    const seen = new Set<number>();
    for (let guard = 0; guard < 400; guard++) {
      if (seen.has(c * 4 + d)) break;
      seen.add(c * 4 + d);
      const nx = nextCell(L, s, c, d);
      if (nx.cell < 0) {
        beams.push({ ax: sx, ay: sy, bx: cx(c) + DX[d] * 0.9, by: cy(c) + DY[d] * 0.9 });
        break;
      }
      const n = nx.cell;
      if (nx.linked) {
        // Draw to the edge of this cell, then continue from the far side of the link.
        beams.push({ ax: sx, ay: sy, bx: cx(c) + DX[d] * 0.5, by: cy(c) + DY[d] * 0.5 });
        sx = cx(n) - DX[nx.dir] * 0.5;
        sy = cy(n) - DY[nx.dir] * 0.5;
      }
      d = nx.dir;
      const stopAtFace = () => beams.push({ ax: sx, ay: sy, bx: cx(n) - DX[d] * 0.45, by: cy(n) - DY[d] * 0.45 });
      const ri = L.receiverAt[n];
      if (ri >= 0) {
        pow[ri] = true;
        beams.push({ ax: sx, ay: sy, bx: cx(n) - DX[d] * 0.3, by: cy(n) - DY[d] * 0.3 });
        break;
      }
      const mi = L.mirrorAt[n];
      if (mi >= 0) {
        beams.push({ ax: sx, ay: sy, bx: cx(n), by: cy(n) });
        d = s.mirrors[mi] === 0 ? d ^ 1 : 3 - d;
        c = n;
        sx = cx(n);
        sy = cy(n);
        continue;
      }
      if (L.terrain[n] === T_WALL || lockClosed(L, s, n) || !doorOpen(L, s, n) || blockAt(s, n) >= 0 || s.p === n) {
        stopAtFace();
        break;
      }
      const partner = L.portalPartner[n];
      if (partner >= 0) {
        beams.push({ ax: sx, ay: sy, bx: cx(n), by: cy(n) });
        if (s.p === partner || blockAt(s, partner) >= 0) break;
        c = partner;
        sx = cx(partner);
        sy = cy(partner);
        continue;
      }
      c = n;
    }
  }
  return { pow, beams };
}

/** Is an action meaningful in this level at all (independent of state)? */
export function levelActions(L: Compiled): Action[] {
  const a: Action[] = [0, 1, 2, 3];
  if (L.allowWait) a.push(A_WAIT);
  if (L.def.echo) a.push(A_ECHO);
  if (L.def.flips) a.push(A_FLIP);
  return a;
}

export interface StepResult {
  state: State;
  events: GameEvent[];
}

/** Apply one action. Returns null when the action is not possible (nothing changes). */
export function step(L: Compiled, s0: State, a: Action): StepResult | null {
  if (s0.status !== 0) return null;
  const s = cloneState(s0);
  const ev: GameEvent[] = [];

  if (a === A_ECHO) {
    if (!L.def.echo) return null;
    if (s.echo === 1) return { state: rewind(L, s, ev, true), events: ev };
    // Start (or restart) a recording from here. Any previous echo dissolves.
    const snap = cloneState(s);
    snap.snap = null;
    snap.echo = 0;
    snap.ghost = -1;
    snap.gm = [];
    snap.gt = 0;
    snap.rec = [];
    s.snap = snap;
    s.echo = 1;
    s.rec = [];
    s.ghost = -1;
    s.gm = [];
    s.gt = 0;
    s.moves++;
    derive(L, s);
    ev.push({ t: 'record' });
    return { state: s, events: ev };
  }

  if (a === A_FLIP) {
    if (!L.def.flips || s.flips <= 0 || s.grav < 0 || s.echo === 1) return null;
    s.flips--;
    s.grav = opposite(s.grav);
    ev.push({ t: 'gravity', dir: s.grav });
  } else if (a === A_WAIT) {
    if (!L.allowWait) return null;
    ev.push({ t: 'wait' });
  } else if (a >= 0 && a <= 3) {
    if (gravityMode(s) && (a === s.grav || a === opposite(s.grav))) return null;
    if (!movePlayer(L, s, a, ev)) return null;
  } else return null;

  if (s.echo === 1 && a !== A_FLIP) s.rec.push(a);

  if (s.echo === 2 && s.gt < s.gm.length) {
    const ga = s.gm[s.gt++];
    if (ga <= 3) moveGhost(L, s, ga, ev);
  }

  movePlatforms(L, s, ev);
  if (!settleGravity(L, s, ev)) {
    s.moves++;
    derive(L, s);
    return { state: s, events: ev };
  }

  for (let ch = 0; ch < s.timers.length; ch++) if (s.timers[ch] > 0) s.timers[ch]--;
  s.tick++;
  derive(L, s);

  // Bodies left without ground (vanished bridge) fall away.
  if (!gravityMode(s)) {
    s.blocks.forEach((c, i) => {
      if (c >= 0 && !groundAt(L, s, c)) {
        s.blocks[i] = -1;
        ev.push({ t: 'lost', who: 'b', block: i });
      }
    });
    if (s.ghost >= 0 && !groundAt(L, s, s.ghost)) {
      s.ghost = -1;
      ev.push({ t: 'lost', who: 'g' });
    }
    if (!groundAt(L, s, s.p)) {
      s.status = 2;
      ev.push({ t: 'fall', who: 'p', from: s.p, to: s.p });
      ev.push({ t: 'dead', reason: 'fall' });
    }
  }
  if (s.ghost >= 0 && hazardActive(L, s, s.ghost)) {
    s.ghost = -1;
    ev.push({ t: 'lost', who: 'g' });
  }
  if (s.status === 0 && hazardActive(L, s, s.p)) {
    s.status = 2;
    ev.push({ t: 'dead', reason: 'hazard' });
  }
  s.moves++;
  if (s.status === 0 && s.p === L.exit && L.terrain[L.exit] === T_EXIT && s.exitOpen) {
    s.status = 1;
    ev.push({ t: 'win' });
  }
  if (s.status === 0 && s.echo === 1 && s.rec.length >= (L.def.echo ?? 0)) {
    return { state: rewind(L, s, ev, false), events: ev };
  }
  return { state: s, events: ev };
}

function rewind(L: Compiled, s: State, ev: GameEvent[], countAction: boolean): State {
  const snap = s.snap!;
  const r = cloneState(snap);
  r.snap = null;
  r.echo = 2;
  r.ghost = snap.p;
  r.gm = s.rec.slice();
  r.gt = 0;
  r.rec = [];
  r.moves = s.moves + (countAction ? 1 : 0);
  derive(L, r);
  ev.push({ t: 'rewind' });
  return r;
}

/** Replay a solution string such as "EENW.R". Returns final state or null if an action fails. */
export function replay(L: Compiled, solution: string, from?: State): State | null {
  let s = from ?? initialState(L);
  for (const ch of solution) {
    const a = 'NESW.RF'.indexOf(ch);
    if (a < 0) return null;
    const r = step(L, s, a);
    if (!r) return null;
    s = r.state;
    if (s.status === 2) return s;
  }
  return s;
}

export const isWin = (s: State) => s.status === 1;
export { T_RAIL, T_VOID };
