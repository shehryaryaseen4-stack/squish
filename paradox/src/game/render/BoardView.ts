import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { WorldTheme } from '../../data/worlds';
import { bridgeSolid, condActive, doorOpen, hazardActive, pitOpen, platformAt } from '../core/engine';
import { Compiled, DX, DY, GameEvent, State, T_EXIT, T_FLOOR, T_HAZARD, T_RAIL, T_VOID, T_WALL } from '../core/types';
import type { Stage } from './Stage';
import { arrowTexture, glowTexture, panelTexture, stoneTexture, stripeTexture, swirlTexture } from './textures';

export interface SkinColors {
  cube: number;
  cube2: number;
  trail: string;
  trailColor: number;
  portal: number;
  portal2: number;
}

export const CHANNEL_COLORS = [0xffb347, 0x4fd8ff, 0xff5fd2, 0x7dff8a];
const PORTAL_HUES = [0, 0.33, 0.6];

type SegKind = 'walk' | 'blink' | 'fall' | 'slide';
interface Seg {
  to: THREE.Vector3;
  kind: SegKind;
  dur: number;
  dir?: number;
}
interface Mover {
  obj: THREE.Object3D;
  queue: Seg[];
  from: THREE.Vector3;
  seg: Seg | null;
  t: number;
  baseScale: number;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeIn = (t: number) => t * t;
const approach = (cur: number, target: number, dt: number, k = 12) => cur + (target - cur) * (1 - Math.exp(-dt * k));

/**
 * Builds and animates the 3D diorama for one level. All game rules come from
 * the simulation; this class only mirrors the current State.
 */
export class BoardView {
  readonly root = new THREE.Group();
  /** Rotates with gravity so that "down" always points down on screen. */
  readonly pivot = new THREE.Group();
  readonly gravityMode: boolean;
  private cx: number;
  private cy: number;
  private disposables: { dispose(): void }[] = [];
  private updaters: ((dt: number, t: number) => void)[] = [];
  private movers = new Map<string, Mover>();
  private player!: THREE.Group;
  private playerCube!: THREE.Mesh;
  private playerLight: THREE.PointLight | null = null;
  private recordAura!: THREE.Mesh;
  private ghost!: THREE.Group;
  private blockMeshes: THREE.Mesh[] = [];
  private beamGroup = new THREE.Group();
  private beamPool: THREE.Mesh[] = [];
  private hintGroup = new THREE.Group();
  private gravAngle = 0;
  private gravTarget = 0;
  private state: State;
  private trailTimer = 0;
  private lastPlayerPos = new THREE.Vector3();
  // Per-feature visual state, smoothed every frame.
  private doorVis: { mesh: THREE.Object3D; cell: number; open: number }[] = [];
  private bridgeVis: { mesh: THREE.Mesh; cell: number; on: number }[] = [];
  private hazardVis: { mesh: THREE.Object3D; cell: number; on: number; mat: THREE.MeshStandardMaterial }[] = [];
  private plateVis: { mesh: THREE.Mesh; cell: number; down: number; mat: THREE.MeshStandardMaterial }[] = [];
  private toggleVis: { lever: THREE.Object3D; index: number; ang: number }[] = [];
  private timerVis: { mesh: THREE.Mesh; ch: number; mat: THREE.MeshStandardMaterial; ring: THREE.Mesh }[] = [];
  private mirrorVis: { mesh: THREE.Object3D; index: number; ang: number }[] = [];
  private receiverVis: { mesh: THREE.Mesh; halo: THREE.Sprite; index: number; on: number; mat: THREE.MeshStandardMaterial }[] = [];
  private emitterVis: { lens: THREE.MeshStandardMaterial; index: number }[] = [];
  private itemVis: { obj: THREE.Object3D; index: number; gone: number }[] = [];
  private pitFill: { mesh: THREE.Mesh; index: number; on: number }[] = [];
  private platformVis: { mesh: THREE.Object3D; index: number }[] = [];
  private linkVis: { mat: THREE.MeshBasicMaterial; when?: import('../core/types').Cond }[] = [];
  private exitVis!: { ring: THREE.Mesh; disc: THREE.Mesh; mat: THREE.MeshStandardMaterial; discMat: THREE.MeshBasicMaterial; halo: THREE.Sprite; on: number };
  private hidden = false;

  constructor(
    private stage: Stage,
    readonly L: Compiled,
    initial: State,
    private theme: WorldTheme,
    private skin: SkinColors,
  ) {
    this.gravityMode = L.def.gravity !== undefined;
    this.cx = (L.w - 1) / 2;
    this.cy = (L.h - 1) / 2;
    this.state = initial;
    this.root.add(this.pivot);
    this.pivot.add(this.beamGroup, this.hintGroup);
    this.build();
    this.sync(initial, [], false);
    if (this.gravityMode) {
      this.gravAngle = this.gravTarget = this.angleFor(initial.grav);
      this.pivot.rotation.z = this.gravAngle;
    }
    stage.content.add(this.root);
  }

  // ---------- coordinates ----------

  /** Local (pivot-space) centre of a cell, lifted for bodies. */
  cellPos(cell: number, lift = 0): THREE.Vector3 {
    const x = cell % this.L.w;
    const y = (cell / this.L.w) | 0;
    return this.gridPos(x, y, lift);
  }

  gridPos(x: number, y: number, lift = 0): THREE.Vector3 {
    if (this.gravityMode) return new THREE.Vector3(x - this.cx, this.cy - y, lift);
    return new THREE.Vector3(x - this.cx, lift, y - this.cy);
  }

  private bodyLift() {
    return this.gravityMode ? 0 : 0.4;
  }

  /** Grid direction as a local vector. */
  private dirVec(d: number) {
    return this.gravityMode ? new THREE.Vector3(DX[d], -DY[d], 0) : new THREE.Vector3(DX[d], 0, DY[d]);
  }

  private angleFor(grav: number) {
    // Rotate the chamber so the gravity direction points to screen-down.
    return [Math.PI, -Math.PI / 2, 0, Math.PI / 2][grav] ?? 0;
  }

  get size() {
    return { w: this.L.w, h: this.L.h };
  }

  // ---------- construction ----------

  private track<T extends { dispose(): void }>(o: T): T {
    this.disposables.push(o);
    return o;
  }

  private std(color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
    return this.track(new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts }));
  }

  private place(obj: THREE.Object3D, cell: number, lift = 0) {
    obj.position.copy(this.cellPos(cell, lift));
    this.pivot.add(obj);
    return obj;
  }

  private shadows(o: THREE.Object3D, cast = true, receive = true) {
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = cast;
        c.receiveShadow = receive;
      }
    });
  }

  private build() {
    const L = this.L;
    const th = this.theme;
    const stone = stoneTexture();
    const geoTile = this.track(new RoundedBoxGeometry(0.96, 0.32, 0.96, 2, 0.06));
    const geoWall = this.track(new RoundedBoxGeometry(0.94, 0.94, 0.94, 2, 0.08));
    const floorMat = this.std(0xffffff, { map: stone, roughness: 0.85 });
    const wallMat = this.std(0xffffff, { map: stone, roughness: 0.8 });
    const rockMat = this.std(th.rock, { roughness: 0.95, flatShading: true });

    const floorCells: number[] = [];
    const wallCells: number[] = [];
    for (let i = 0; i < L.w * L.h; i++) {
      const t = L.terrain[i];
      if (t === T_WALL && L.emitterAt[i] < 0 && L.mirrorAt[i] < 0 && L.receiverAt[i] < 0) wallCells.push(i);
      const groundUnder = t === T_FLOOR || t === T_EXIT || t === T_HAZARD || t === T_WALL;
      if (!this.gravityMode && groundUnder && !(L.itemAt[i] >= 0 && L.items[L.itemAt[i]].kind === 'pit')) floorCells.push(i);
    }

    if (this.gravityMode) {
      // Laboratory backdrop and abyss markers.
      const back = new THREE.Mesh(
        this.track(new THREE.PlaneGeometry(L.w + 0.6, L.h + 0.6)),
        this.std(th.floorEdge, { map: panelTexture(), roughness: 0.6, metalness: 0.2 }),
      );
      const panel = (back.material as THREE.MeshStandardMaterial).map!;
      panel.repeat.set(L.w + 0.6, L.h + 0.6);
      back.position.set(0, 0, -0.52);
      back.receiveShadow = true;
      this.pivot.add(back);
      const voidMat = this.track(new THREE.MeshBasicMaterial({ color: 0x05030c }));
      const voidGeo = this.track(new THREE.PlaneGeometry(0.98, 0.98));
      for (let i = 0; i < L.w * L.h; i++) {
        if (L.terrain[i] !== T_VOID || L.bridgeAt[i] >= 0) continue;
        const m = new THREE.Mesh(voidGeo, voidMat);
        this.place(m, i, -0.5);
      }
    } else {
      const tiles = new THREE.InstancedMesh(geoTile, floorMat, Math.max(1, floorCells.length));
      const rocks = new THREE.InstancedMesh(this.track(new THREE.ConeGeometry(0.62, 1, 6)), rockMat, Math.max(1, floorCells.length));
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const col = new THREE.Color();
      floorCells.forEach((cell, k) => {
        const p = this.cellPos(cell, -0.16);
        m.compose(p, q, new THREE.Vector3(1, 1, 1));
        tiles.setMatrixAt(k, m);
        col.set(th.floor).offsetHSL(0, 0, (((cell * 7919) % 13) / 13 - 0.5) * 0.08);
        tiles.setColorAt(k, col);
        const h = 0.5 + (((cell * 2654435761) >>> 0) % 100) / 100 * 1.4;
        const rp = this.cellPos(cell, -0.32 - h / 2);
        m.compose(rp, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, (cell % 6) * 0.5, 0)), new THREE.Vector3(1, h, 1));
        rocks.setMatrixAt(k, m);
      });
      tiles.receiveShadow = true;
      tiles.castShadow = true;
      this.pivot.add(tiles, rocks);
    }

    if (wallCells.length) {
      const walls = new THREE.InstancedMesh(geoWall, wallMat, wallCells.length);
      const m = new THREE.Matrix4();
      const col = new THREE.Color();
      wallCells.forEach((cell, k) => {
        const p = this.cellPos(cell, this.gravityMode ? 0 : 0.47);
        m.makeTranslation(p.x, p.y, p.z);
        walls.setMatrixAt(k, m);
        col.set(th.wall).offsetHSL(0, 0, (((cell * 104729) % 11) / 11 - 0.5) * 0.1);
        walls.setColorAt(k, col);
      });
      walls.castShadow = true;
      walls.receiveShadow = true;
      this.pivot.add(walls);
    }

    this.buildFeatures(geoWall);
    this.buildBodies();
  }

  private glowSprite(color: number, scale: number, opacity = 0.8) {
    const s = new THREE.Sprite(
      this.track(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })),
    );
    s.scale.setScalar(scale);
    return s;
  }

  private buildFeatures(geoWall: THREE.BufferGeometry) {
    const L = this.L;
    const g = this.gravityMode;

    // Exit portal.
    {
      const mat = this.std(0x888899, { emissive: this.theme.accent, emissiveIntensity: 0.2, metalness: 0.6, roughness: 0.3 });
      const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.36, 0.06, 12, 32)), mat);
      const discMat = this.track(
        new THREE.MeshBasicMaterial({ map: swirlTexture(), color: this.theme.accent, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      const disc = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.33, 32)), discMat);
      const halo = this.glowSprite(this.theme.accent, 1.6, 0.2);
      const grp = new THREE.Group();
      grp.add(ring, disc, halo);
      if (!g) {
        grp.position.y = 0.42;
        const base = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 24)), this.std(this.theme.floorEdge, { metalness: 0.3 }));
        base.position.y = -0.38;
        grp.add(base);
      }
      this.place(grp, L.exit, g ? 0 : 0);
      if (!g) grp.position.y = 0.42;
      this.shadows(ring);
      this.exitVis = { ring, disc, mat, discMat, halo, on: 0 };
      this.updaters.push((dt, t) => {
        disc.rotation.z -= dt * (0.6 + this.exitVis.on * 2.5);
        grp.rotation.y = g ? 0 : Math.sin(t * 0.4) * 0.3;
      });
    }

    // Hazards: spikes / energy rifts.
    const spikeGeo = this.track(new THREE.ConeGeometry(0.1, 0.34, 6));
    for (let i = 0; i < L.w * L.h; i++) {
      if (L.terrain[i] !== T_HAZARD) continue;
      const mat = this.std(0x552222, { emissive: 0xff2a3a, emissiveIntensity: 1.2, metalness: 0.3 });
      const grp = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(spikeGeo, mat);
        const ox = (k % 2 ? 0.2 : -0.2);
        const oz = (k < 2 ? 0.2 : -0.2);
        if (g) {
          s.rotation.x = Math.PI / 2;
          s.position.set(ox, oz, -0.25);
        } else s.position.set(ox, 0.17, oz);
        grp.add(s);
      }
      const glow = this.glowSprite(0xff3040, 1.1, 0.45);
      glow.position.set(0, g ? 0 : 0.15, 0);
      grp.add(glow);
      this.place(grp, i, g ? 0 : 0);
      this.hazardVis.push({ mesh: grp, cell: i, on: 1, mat });
    }

    // Pits: dark holes that a block can fill.
    L.items.forEach((it, index) => {
      if (it.kind !== 'pit') return;
      const hole = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.9, 0.05, 0.9)), this.track(new THREE.MeshBasicMaterial({ color: 0x050308 })));
      this.place(hole, it.cell, -0.7);
      const fill = new THREE.Mesh(this.track(new RoundedBoxGeometry(0.94, 0.32, 0.94, 2, 0.05)), this.std(this.theme.wall, { map: stoneTexture() }));
      this.place(fill, it.cell, -0.16);
      fill.receiveShadow = true;
      this.pitFill.push({ mesh: fill, index, on: 0 });
    });

    // Keys, locks and shards.
    L.items.forEach((it, index) => {
      if (it.kind === 'key') {
        const grp = new THREE.Group();
        const mat = this.std(0xffd060, { metalness: 0.8, roughness: 0.25, emissive: 0x996600, emissiveIntensity: 0.4 });
        const bow = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.11, 0.035, 8, 16)), mat);
        bow.position.y = 0.12;
        const shaft = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.05, 0.26, 0.05)), mat);
        shaft.position.y = -0.06;
        const tooth = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.09, 0.04, 0.05)), mat);
        tooth.position.set(0.05, -0.15, 0);
        grp.add(bow, shaft, tooth, this.glowSprite(0xffd060, 0.8, 0.5));
        this.place(grp, it.cell, g ? 0 : 0.45);
        this.shadows(grp, true, false);
        const base = grp.position.clone();
        this.updaters.push((_dt, t) => {
          grp.rotation.y = t * 1.8;
          grp.position.copy(base);
          if (g) grp.position.z += 0.0;
          else grp.position.y = base.y + Math.sin(t * 2 + index) * 0.06;
        });
        this.itemVis.push({ obj: grp, index, gone: 0 });
      } else if (it.kind === 'lock') {
        const grp = new THREE.Group();
        const box = new THREE.Mesh(geoWall, this.std(0x8a6a3a, { map: stoneTexture(), metalness: 0.4, roughness: 0.4 }));
        const hole = new THREE.Mesh(
          this.track(new THREE.CircleGeometry(0.12, 16)),
          this.track(new THREE.MeshBasicMaterial({ color: 0xffd060 })),
        );
        if (g) hole.position.z = 0.48;
        else {
          hole.position.set(0, 0.1, 0.48);
        }
        const hole2 = hole.clone();
        if (g) hole2.visible = false;
        else {
          hole2.position.set(0, 0.1, -0.48);
          hole2.rotation.y = Math.PI;
        }
        grp.add(box, hole, hole2);
        this.place(grp, it.cell, g ? 0 : 0.47);
        this.shadows(box);
        this.itemVis.push({ obj: grp, index, gone: 0 });
      } else if (it.kind === 'shard') {
        const mat = this.std(this.theme.accent, { emissive: this.theme.accent, emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.2 });
        const grp = new THREE.Group();
        const m = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.18)), mat);
        m.scale.y = 1.5;
        grp.add(m, this.glowSprite(this.theme.accent, 1, 0.6));
        this.place(grp, it.cell, g ? 0 : 0.45);
        const base = grp.position.clone();
        this.updaters.push((_dt, t) => {
          m.rotation.y = t * 1.5;
          grp.position.copy(base);
          if (!g) grp.position.y = base.y + Math.sin(t * 2.2 + index) * 0.08;
        });
        this.itemVis.push({ obj: grp, index, gone: 0 });
      }
    });

    // Pressure plates.
    for (const pl of L.plates) {
      const color = CHANNEL_COLORS[pl.ch % 4];
      const mat = this.std(0x666677, { emissive: color, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.4 });
      const mesh = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.34, 0.38, 0.08, 24)), mat);
      if (g) {
        mesh.rotation.x = Math.PI / 2;
        this.place(mesh, pl.cell, -0.45);
      } else this.place(mesh, pl.cell, 0.04);
      mesh.receiveShadow = true;
      this.plateVis.push({ mesh, cell: pl.cell, down: 0, mat });
    }

    // Lever switches.
    L.toggles.forEach((tg, index) => {
      const color = CHANNEL_COLORS[tg.ch % 4];
      const grp = new THREE.Group();
      const base = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 16)), this.std(0x555566, { metalness: 0.6, roughness: 0.4 }));
      const pivot = new THREE.Group();
      const lever = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.06, 0.4, 0.06)), this.std(0xcccccc, { metalness: 0.7 }));
      lever.position.y = 0.2;
      const knob = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.08, 12, 8)), this.std(color, { emissive: color, emissiveIntensity: 0.8 }));
      knob.position.y = 0.42;
      pivot.add(lever, knob);
      grp.add(base, pivot);
      if (g) {
        grp.rotation.x = Math.PI / 2;
        this.place(grp, tg.cell, -0.42);
      } else this.place(grp, tg.cell, 0.05);
      this.shadows(grp);
      this.toggleVis.push({ lever: pivot, index, ang: -0.6 });
    });

    // Hourglass switches.
    for (const tm of L.timers) {
      const color = CHANNEL_COLORS[tm.ch % 4];
      const grp = new THREE.Group();
      const mat = this.std(color, { emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
      const top = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.16, 0.22, 12)), mat);
      top.rotation.x = Math.PI;
      top.position.y = 0.36;
      const bot = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.16, 0.22, 12)), mat);
      bot.position.y = 0.14;
      const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.3, 0.025, 8, 32)), this.std(0x999999, { emissive: color, emissiveIntensity: 0.6 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.03;
      grp.add(top, bot, ring);
      if (g) {
        grp.rotation.x = Math.PI / 2;
        this.place(grp, tm.cell, -0.4);
      } else this.place(grp, tm.cell, 0);
      this.timerVis.push({ mesh: top, ch: tm.ch, mat, ring });
      this.updaters.push((_dt, t) => {
        if (this.state.timers[tm.ch] > 0) grp.rotation.y = g ? 0 : t * 3;
      });
    }

    // Doors (solid, striped/inverted, clockwork).
    for (const d of L.doors) {
      const inverted = !!d.when.invert;
      const color = d.when.ch !== undefined ? CHANNEL_COLORS[d.when.ch % 4] : 0xe8e0c8;
      const mat = this.std(color, {
        map: inverted ? stripeTexture() : stoneTexture(),
        emissive: color,
        emissiveIntensity: 0.25,
        metalness: 0.3,
        roughness: 0.5,
      });
      const grp = new THREE.Group();
      const slab = new THREE.Mesh(geoWall, mat);
      grp.add(slab);
      if (d.when.period) {
        const clock = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.3, 0.03, 8, 24)), this.std(0xffffff, { emissive: 0xffc070, emissiveIntensity: 1 }));
        const hand = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.03, 0.24, 0.03)), this.std(0xffffff, { emissive: 0xffc070, emissiveIntensity: 1 }));
        hand.position.y = 0.1;
        const handPivot = new THREE.Group();
        handPivot.add(hand);
        const face = new THREE.Group();
        face.add(clock, handPivot);
        if (g) face.position.z = 0.49;
        else {
          face.position.y = 0.5;
          face.rotation.x = -Math.PI / 2;
        }
        grp.add(face);
        const period = d.when.period;
        this.updaters.push(() => {
          handPivot.rotation.z = -((this.state.tick % period) / period) * Math.PI * 2;
        });
      }
      this.place(grp, d.cell, g ? 0 : 0.47);
      this.shadows(grp);
      this.doorVis.push({ mesh: grp, cell: d.cell, open: 0 });
    }

    // Light bridges / phase blocks.
    for (const b of L.bridges) {
      const color = b.when.ch !== undefined ? CHANNEL_COLORS[b.when.ch % 4] : 0xffe0a0;
      const mat = this.std(color, { emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: 0.75, roughness: 0.2 });
      const mesh = new THREE.Mesh(g ? geoWall : this.track(new RoundedBoxGeometry(0.94, 0.12, 0.94, 2, 0.04)), mat);
      this.place(mesh, b.cell, g ? 0 : -0.06);
      const outline = new THREE.LineSegments(
        this.track(new THREE.EdgesGeometry(this.track(new THREE.BoxGeometry(0.94, g ? 0.94 : 0.12, 0.94)))),
        this.track(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 })),
      );
      this.place(outline, b.cell, g ? 0 : -0.06);
      this.bridgeVis.push({ mesh, cell: b.cell, on: 0 });
    }

    // Emitters.
    L.emitters.forEach((em, index) => {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(geoWall, this.std(0x3a3a48, { metalness: 0.7, roughness: 0.35 }));
      body.scale.setScalar(0.85);
      const lens = this.std(0xffffff, { emissive: 0xff6a5a, emissiveIntensity: 2 });
      const nozzle = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 16)), lens);
      const dv = this.dirVec(em.dir);
      nozzle.position.copy(dv.clone().multiplyScalar(0.42));
      nozzle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv);
      grp.add(body, nozzle);
      this.place(grp, em.cell, g ? 0 : 0.45);
      this.shadows(grp);
      this.emitterVis.push({ lens, index });
    });

    // Mirrors.
    L.mirrors.forEach((mi, index) => {
      const grp = new THREE.Group();
      const ped = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.2, 0.26, 0.16, 12)), this.std(0x555566, { metalness: 0.6 }));
      const plate = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.95, 0.62, 0.06)),
        this.std(0xdff6ff, { metalness: 1, roughness: 0.05, emissive: 0x6688aa, emissiveIntensity: 0.35 }),
      );
      const holder = new THREE.Group();
      holder.add(plate);
      if (g) {
        // Mirror stands across the chamber plane; rotate around the view axis.
        plate.rotation.x = Math.PI / 2;
        grp.add(holder);
      } else {
        ped.position.y = -0.32;
        plate.position.y = 0.0;
        grp.add(ped, holder);
      }
      this.place(grp, mi.cell, g ? 0 : 0.4);
      this.shadows(grp);
      this.mirrorVis.push({ mesh: holder, index, ang: this.mirrorAngle(mi.orient) });
      holder.rotation[g ? 'z' : 'y'] = this.mirrorAngle(mi.orient);
    });

    // Receivers (crystals).
    L.receivers.forEach((r, index) => {
      const color = r.ch !== undefined ? CHANNEL_COLORS[r.ch % 4] : this.theme.accent;
      const mat = this.std(color, { emissive: color, emissiveIntensity: 0.15, metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(this.track(new THREE.IcosahedronGeometry(0.3, 0)), mat);
      const halo = this.glowSprite(color, 1.6, 0);
      const grp = new THREE.Group();
      const ped = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 8)), this.std(0x444455, { metalness: 0.5 }));
      if (!g) {
        ped.position.y = -0.3;
        grp.add(ped);
      }
      grp.add(mesh, halo);
      this.place(grp, r.cell, g ? 0 : 0.45);
      this.shadows(grp);
      this.receiverVis.push({ mesh, halo, index, on: 0, mat });
      this.updaters.push((_dt, t) => {
        mesh.rotation.y = t * (0.5 + this.receiverVis[index].on * 2);
        mesh.rotation.x = t * 0.3;
      });
    });

    // Rifts (portal pairs).
    L.portals.forEach((pt) => {
      const hue = PORTAL_HUES[pt.pair % 3];
      const base = new THREE.Color(this.skin.portal);
      const color = pt.pair === 0 ? base : base.clone().offsetHSL(hue, 0, 0);
      const grp = new THREE.Group();
      const ring = new THREE.Mesh(
        this.track(new THREE.TorusGeometry(0.36, 0.05, 10, 32)),
        this.std(color.getHex(), { emissive: color.getHex(), emissiveIntensity: 1.6, metalness: 0.4 }),
      );
      const disc = new THREE.Mesh(
        this.track(new THREE.CircleGeometry(0.33, 32)),
        this.track(new THREE.MeshBasicMaterial({ map: swirlTexture(), color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })),
      );
      grp.add(ring, disc, this.glowSprite(color.getHex(), 1.4, 0.45));
      this.place(grp, pt.cell, g ? 0 : 0.42);
      if (!g) {
        const pad = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.42, 24)), this.track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 })));
        pad.rotation.x = -Math.PI / 2;
        pad.position.y = -0.41;
        grp.add(pad);
      }
      this.updaters.push((dt, t) => {
        disc.rotation.z += dt * 2.5;
        if (!g) grp.rotation.y = t * 0.6 + pt.pair;
      });
    });

    // Gravity pads.
    for (let i = 0; i < L.w * L.h; i++) {
      const d = L.padAt[i];
      if (d < 0 || !g) continue;
      const mat = this.track(new THREE.MeshBasicMaterial({ map: arrowTexture(), color: 0xa77bff, transparent: true, opacity: 0.95, depthWrite: false }));
      const m = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.8, 0.8)), mat);
      m.rotation.z = [0, -Math.PI / 2, Math.PI, Math.PI / 2][d];
      this.place(m, i, -0.48);
      const glow = this.glowSprite(0xa77bff, 1.2, 0.35);
      this.place(glow, i, -0.3);
      this.updaters.push((_dt, t) => {
        mat.opacity = 0.65 + Math.sin(t * 3 + i) * 0.3;
      });
    }

    // Rails and platforms.
    if (L.platforms.length) {
      const railMat = this.track(new THREE.MeshBasicMaterial({ color: this.theme.accent, transparent: true, opacity: 0.5 }));
      for (let i = 0; i < L.w * L.h; i++) {
        if (L.terrain[i] !== T_RAIL) continue;
        const dot = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.16, 0.04, 0.16)), railMat);
        this.place(dot, i, -0.35);
        for (let d = 1; d <= 2; d++) {
          const x = (i % L.w) + DX[d];
          const y = ((i / L.w) | 0) + DY[d];
          if (x >= L.w || y >= L.h || L.terrain[y * L.w + x] !== T_RAIL) continue;
          const bar = new THREE.Mesh(this.track(new THREE.BoxGeometry(d === 1 ? 1 : 0.05, 0.03, d === 1 ? 0.05 : 1)), railMat);
          const p = this.cellPos(i, -0.35).add(this.dirVec(d).multiplyScalar(0.5));
          bar.position.copy(p);
          this.pivot.add(bar);
        }
      }
      L.platforms.forEach((_pf, index) => {
        const grp = new THREE.Group();
        const slab = new THREE.Mesh(this.track(new RoundedBoxGeometry(0.94, 0.22, 0.94, 2, 0.06)), this.std(this.theme.floorEdge, { map: stoneTexture(), metalness: 0.3 }));
        slab.position.y = -0.16;
        const under = this.glowSprite(this.theme.accent, 1.3, 0.5);
        under.position.y = -0.4;
        grp.add(slab, under);
        this.shadows(slab);
        this.pivot.add(grp);
        this.platformVis.push({ mesh: grp, index });
        this.movers.set(`f${index}`, this.newMover(grp));
      });
    }

    // Seams (non-Euclidean links): a glowing frame on each joined edge.
    for (const l of L.def.links ?? []) {
      const mat = this.track(
        new THREE.MeshBasicMaterial({ color: 0xff7ae0, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTexture() }),
      );
      for (const end of [l.a, l.b]) {
        const [x, y, side] = end;
        const plane = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.96, 0.96)), mat);
        const p = this.gridPos(x, y, g ? 0 : 0.45).add(this.dirVec(side).multiplyScalar(0.5));
        plane.position.copy(p);
        const dv = this.dirVec(side);
        plane.lookAt(p.clone().add(dv));
        this.pivot.add(plane);
        const frame = new THREE.LineSegments(
          this.track(new THREE.EdgesGeometry(this.track(new THREE.PlaneGeometry(0.96, 0.96)))),
          this.track(new THREE.LineBasicMaterial({ color: 0xffb3f0 })),
        );
        frame.position.copy(plane.position);
        frame.quaternion.copy(plane.quaternion);
        this.pivot.add(frame);
      }
      this.linkVis.push({ mat, when: l.when });
    }
  }

  private mirrorAngle(orient: number) {
    // '/' runs bottom-left to top-right on the map.
    if (this.gravityMode) return orient === 0 ? Math.PI / 4 : -Math.PI / 4;
    return orient === 0 ? Math.PI / 4 : -Math.PI / 4;
  }

  private newMover(obj: THREE.Object3D): Mover {
    return { obj, queue: [], from: obj.position.clone(), seg: null, t: 0, baseScale: obj.scale.x };
  }

  private buildBodies() {
    // Blocks.
    const blockGeo = this.track(new RoundedBoxGeometry(0.8, 0.8, 0.8, 3, 0.1));
    const blockMat = this.std(this.theme.wall, { map: stoneTexture(), roughness: 0.75 });
    this.state.blocks.forEach((_c, i) => {
      const m = new THREE.Mesh(blockGeo, blockMat);
      m.castShadow = m.receiveShadow = true;
      this.pivot.add(m);
      this.blockMeshes.push(m);
      this.movers.set(`b${i}`, this.newMover(m));
    });

    // Player cube.
    this.player = new THREE.Group();
    const cubeMat = this.std(this.skin.cube, { emissive: this.skin.cube, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.1 });
    this.playerCube = new THREE.Mesh(this.track(new RoundedBoxGeometry(0.72, 0.72, 0.72, 3, 0.12)), cubeMat);
    this.playerCube.castShadow = true;
    const core = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.22)), this.track(new THREE.MeshBasicMaterial({ color: this.skin.cube2 })));
    const halo = this.glowSprite(this.skin.cube, 2, 0.55);
    this.player.add(this.playerCube, core, halo);
    this.recordAura = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.55, 0.035, 8, 40)),
      this.track(new THREE.MeshBasicMaterial({ color: 0xff4a6a, transparent: true, opacity: 0 })),
    );
    if (!this.gravityMode) this.recordAura.rotation.x = Math.PI / 2;
    this.player.add(this.recordAura);
    if (this.stage.quality !== 'low') {
      this.playerLight = new THREE.PointLight(this.skin.cube, 2.2, 4.5, 2);
      this.player.add(this.playerLight);
    }
    this.pivot.add(this.player);
    this.movers.set('p', this.newMover(this.player));
    this.updaters.push((_dt, t) => {
      core.rotation.y = t * 2;
      core.rotation.x = t * 1.3;
      const rec = this.state.echo === 1;
      const am = this.recordAura.material as THREE.MeshBasicMaterial;
      am.opacity = rec ? 0.55 + Math.sin(t * 8) * 0.35 : 0;
      this.recordAura.rotation.z = t * 2;
    });

    // Echo ghost.
    this.ghost = new THREE.Group();
    const gm = this.track(
      new THREE.MeshStandardMaterial({ color: 0x9ffcff, emissive: 0x6ad8ff, emissiveIntensity: 1.2, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.ghost.add(new THREE.Mesh(this.playerCube.geometry, gm), this.glowSprite(0x9ffcff, 1.6, 0.35));
    this.ghost.visible = false;
    this.pivot.add(this.ghost);
    this.movers.set('g', this.newMover(this.ghost));
    this.updaters.push((_dt, t) => {
      gm.opacity = 0.32 + Math.sin(t * 5) * 0.08;
    });
  }

  // ---------- syncing to simulation state ----------

  /** Mirror `s`. With `animate`, bodies follow the given events step by step. */
  sync(s: State, events: GameEvent[], animate: boolean) {
    const L = this.L;
    const prev = this.state;
    this.state = s;
    const lift = this.bodyLift();
    const fast = this.stage.reducedMotion;
    const walkDur = fast ? 0.08 : 0.15;

    const route = (key: string, who: 'p' | 'g' | 'b', idx: number, finalCell: number) => {
      const mv = this.movers.get(key)!;
      if (!animate || finalCell < 0) {
        this.snapMover(mv, finalCell < 0 ? null : this.cellPos(finalCell, lift));
        return;
      }
      const segs: Seg[] = [];
      for (const e of events) {
        const far = (e.t === 'move' || e.t === 'push') && this.dirBetween(e.from, e.to) === undefined;
        if (e.t === 'move' && who !== 'b' && e.who === who)
          segs.push({ to: this.cellPos(e.to, lift), kind: far ? 'blink' : 'walk', dur: far ? 0.32 : walkDur, dir: this.dirBetween(e.from, e.to) });
        else if (e.t === 'push' && who === 'b' && e.block === idx) segs.push({ to: this.cellPos(e.to, lift), kind: far ? 'blink' : 'slide', dur: far ? 0.32 : walkDur });
        else if ((e.t === 'teleport' || e.t === 'link') && e.who === who && (who !== 'b' || e.block === idx)) {
          segs.push({ to: this.cellPos(e.to, lift), kind: 'blink', dur: fast ? 0.12 : 0.32 });
        } else if (e.t === 'fall' && e.who === who && (who !== 'b' || e.block === idx) && e.to >= 0) {
          const last = segs[segs.length - 1];
          const to = this.cellPos(e.to, lift);
          if (last && last.kind === 'fall') {
            last.to = to;
            last.dur += 0.05;
          } else segs.push({ to, kind: 'fall', dur: 0.09 });
        }
      }
      const final = this.cellPos(finalCell, lift);
      const lastTo = segs.length ? segs[segs.length - 1].to : mv.seg ? mv.seg.to : mv.obj.position;
      if (lastTo.distanceTo(final) > 0.01) segs.push({ to: final, kind: lastTo.distanceTo(final) > 1.5 ? 'blink' : 'slide', dur: walkDur });
      this.finishMover(mv);
      mv.queue.push(...segs);
    };

    // Player
    if (s.status === 2) {
      route('p', 'p', 0, s.p);
    } else route('p', 'p', 0, s.p);
    this.player.visible = !this.hidden;

    // Ghost
    const ghostVisible = s.echo === 2 && s.ghost >= 0;
    if (ghostVisible && !(prev.echo === 2 && prev.ghost >= 0)) {
      this.snapMover(this.movers.get('g')!, this.cellPos(s.ghost, lift));
      if (animate) this.stage.bursts.emit(this.toWorld(this.cellPos(s.ghost, lift)), 0x9ffcff, 30, { speed: 2.5, life: 0.6 });
    } else if (ghostVisible) route('g', 'g', 0, s.ghost);
    this.ghost.visible = ghostVisible;

    // Blocks
    s.blocks.forEach((cell, i) => {
      const mesh = this.blockMeshes[i];
      if (cell < 0) {
        if (mesh.visible && animate) {
          const filled = events.find((e): e is Extract<GameEvent, { t: 'fill' }> => e.t === 'fill' && e.block === i);
          const at = filled ? this.cellPos(filled.cell, -0.2) : mesh.position.clone().add(new THREE.Vector3(0, -1.5, 0));
          route(`b${i}`, 'b', i, -1);
          this.snapMover(this.movers.get(`b${i}`)!, at);
          this.stage.bursts.emit(this.toWorld(at), filled ? 0xd9c49a : 0x888888, 14, { speed: 1.5, life: 0.5 });
        }
        mesh.visible = false;
      } else {
        if (!mesh.visible) this.snapMover(this.movers.get(`b${i}`)!, this.cellPos(cell, lift));
        mesh.visible = true;
        route(`b${i}`, 'b', i, cell);
      }
    });

    // Platforms
    L.platforms.forEach((pf, i) => {
      const cell = pf.path[s.plat[i]];
      const mv = this.movers.get(`f${i}`)!;
      const to = this.cellPos(cell, 0);
      if (!animate) this.snapMover(mv, to);
      else {
        this.finishMover(mv);
        mv.queue.push({ to, kind: 'slide', dur: walkDur });
      }
    });

    // Item states
    for (const iv of this.itemVis) {
      const consumed = s.items[iv.index] === 1;
      if (!animate) iv.gone = consumed ? 1 : 0;
      iv.obj.visible = iv.gone < 0.999;
    }
    for (const pf of this.pitFill) if (!animate) pf.on = s.items[pf.index];

    this.rebuildBeams(s);
    if (this.gravityMode) {
      const target = this.angleFor(s.grav);
      let d = target - this.gravTarget;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.gravTarget += d;
      if (!animate) this.gravAngle = this.gravTarget;
    }
    this.clearHint();
  }

  private dirBetween(a: number, b: number) {
    const dx = (b % this.L.w) - (a % this.L.w);
    const dy = ((b / this.L.w) | 0) - ((a / this.L.w) | 0);
    if (Math.abs(dx) + Math.abs(dy) !== 1) return undefined;
    return dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0;
  }

  private snapMover(mv: Mover, to: THREE.Vector3 | null) {
    mv.queue.length = 0;
    mv.seg = null;
    if (to) mv.obj.position.copy(to);
    mv.obj.scale.setScalar(mv.baseScale);
    if (mv.obj === this.player) this.playerCube.rotation.set(0, 0, 0);
  }

  private finishMover(mv: Mover) {
    // Complete anything still animating so a new action starts cleanly.
    const last = mv.queue.length ? mv.queue[mv.queue.length - 1] : mv.seg;
    if (last) mv.obj.position.copy(last.to);
    mv.queue.length = 0;
    mv.seg = null;
    mv.obj.scale.setScalar(mv.baseScale);
    if (mv.obj === this.player) this.playerCube.rotation.set(0, 0, 0);
  }

  isAnimating() {
    for (const mv of this.movers.values()) if (mv.seg || mv.queue.length) return true;
    return false;
  }

  /** Local position → world. */
  toWorld(v: THREE.Vector3) {
    this.pivot.updateWorldMatrix(true, false);
    return v.clone().applyMatrix4(this.pivot.matrixWorld);
  }

  playerWorld() {
    return this.toWorld(this.player.position);
  }

  private rebuildBeams(s: State) {
    for (const m of this.beamPool) m.visible = false;
    const y = this.gravityMode ? 0 : 0.45;
    s.beams.forEach((b, i) => {
      let m = this.beamPool[i];
      if (!m) {
        const core = new THREE.Mesh(
          this.track(new THREE.CylinderGeometry(0.045, 0.045, 1, 8, 1, true)),
          this.track(new THREE.MeshBasicMaterial({ color: 0xffffff })),
        );
        const glow = new THREE.Mesh(
          this.track(new THREE.CylinderGeometry(0.13, 0.13, 1, 10, 1, true)),
          this.track(new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })),
        );
        m = core;
        m.add(glow);
        this.beamPool[i] = m;
        this.beamGroup.add(m);
      }
      const a = this.gridPos(b.ax, b.ay, y);
      const c = this.gridPos(b.bx, b.by, y);
      const len = a.distanceTo(c);
      m.visible = len > 0.01;
      m.position.copy(a).add(c).multiplyScalar(0.5);
      m.scale.set(1, Math.max(len, 0.001), 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
    });
  }

  // ---------- per-frame ----------

  update(dt: number, t: number) {
    const s = this.state;
    const L = this.L;
    for (const u of this.updaters) u(dt, t);

    for (const mv of this.movers.values()) this.stepMover(mv, dt);

    if (this.gravityMode) {
      this.gravAngle = approach(this.gravAngle, this.gravTarget, dt, this.stage.reducedMotion ? 30 : 6);
      this.pivot.rotation.z = this.gravAngle;
    }

    for (const dv of this.doorVis) {
      dv.open = approach(dv.open, doorOpen(L, s, dv.cell) ? 1 : 0, dt, 14);
      if (this.gravityMode) {
        dv.mesh.scale.setScalar(Math.max(0.05, 1 - dv.open * 0.9));
      } else dv.mesh.position.y = 0.47 - dv.open * 0.9;
    }
    for (const bv of this.bridgeVis) {
      bv.on = approach(bv.on, bridgeSolid(L, s, bv.cell) ? 1 : 0, dt, 12);
      bv.mesh.visible = bv.on > 0.02;
      bv.mesh.scale.set(bv.on, this.gravityMode ? bv.on : 1, bv.on);
    }
    for (const hv of this.hazardVis) {
      hv.on = approach(hv.on, hazardActive(L, s, hv.cell) ? 1 : 0, dt, 16);
      hv.mesh.scale.setScalar(0.2 + hv.on * 0.8);
      hv.mat.emissiveIntensity = 0.2 + hv.on * 1.4 + Math.sin(t * 6 + hv.cell) * 0.2 * hv.on;
    }
    const occupied = (c: number) => s.p === c || s.ghost === c || s.blocks.includes(c);
    for (const pv of this.plateVis) {
      pv.down = approach(pv.down, occupied(pv.cell) ? 1 : 0, dt, 18);
      if (this.gravityMode) pv.mesh.position.z = -0.45 - pv.down * 0.03;
      else pv.mesh.position.y = 0.04 - pv.down * 0.04;
      pv.mat.emissiveIntensity = 0.3 + pv.down * 1.5;
    }
    for (const tv of this.toggleVis) {
      const ch = L.toggles[tv.index].ch;
      tv.ang = approach(tv.ang, s.toggles[ch] ? 0.6 : -0.6, dt, 14);
      tv.lever.rotation.z = tv.ang;
    }
    for (const tm of this.timerVis) {
      const v = s.timers[tm.ch] ?? 0;
      tm.mat.emissiveIntensity = v > 0 ? 1.2 + Math.sin(t * 10) * 0.3 : 0.3;
    }
    for (const mv of this.mirrorVis) {
      mv.ang = approach(mv.ang, this.mirrorAngle(s.mirrors[mv.index]), dt, 14);
      mv.mesh.rotation[this.gravityMode ? 'z' : 'y'] = mv.ang;
    }
    for (const rv of this.receiverVis) {
      rv.on = approach(rv.on, s.pow[rv.index] ? 1 : 0, dt, 10);
      rv.mat.emissiveIntensity = 0.15 + rv.on * 2.2;
      rv.halo.material.opacity = rv.on * 0.8;
    }
    for (const ev of this.emitterVis) {
      const on = condActive(L, s, L.emitters[ev.index].when);
      ev.lens.emissiveIntensity = on ? 2 + Math.sin(t * 8) * 0.4 : 0.2;
    }
    for (const iv of this.itemVis) {
      const consumed = s.items[iv.index] === 1;
      iv.gone = approach(iv.gone, consumed ? 1 : 0, dt, 8);
      const kind = L.items[iv.index].kind;
      if (kind === 'lock') iv.obj.scale.setScalar(Math.max(0.001, 1 - iv.gone));
      else {
        iv.obj.scale.setScalar(Math.max(0.001, 1 - iv.gone * 0.8));
        if (iv.gone > 0.01) iv.obj.position.y += this.gravityMode ? 0 : iv.gone * dt * 3;
      }
      iv.obj.visible = iv.gone < 0.98;
    }
    for (const pf of this.pitFill) {
      pf.on = approach(pf.on, s.items[pf.index] === 1 && !pitOpen(L, s, L.items[pf.index].cell) ? 1 : 0, dt, 10);
      pf.mesh.visible = pf.on > 0.02;
      pf.mesh.position.y = -0.16 - (1 - pf.on) * 0.5;
    }
    for (const lv of this.linkVis) {
      const on = condActive(L, s, lv.when);
      lv.mat.opacity = on ? 0.55 + Math.sin(t * 3) * 0.2 : 0.08;
    }
    const ex = this.exitVis;
    ex.on = approach(ex.on, s.exitOpen ? 1 : 0, dt, 6);
    ex.mat.emissiveIntensity = 0.15 + ex.on * 2.5;
    ex.discMat.opacity = 0.12 + ex.on * 0.75;
    ex.halo.material.opacity = 0.1 + ex.on * 0.7;
    ex.mat.color.setHex(ex.on > 0.5 ? this.theme.accent : 0x777788);

    // Trail cosmetic.
    if (this.skin.trail !== 'trail-none' && !this.hidden) {
      const wp = this.playerWorld();
      if (wp.distanceTo(this.lastPlayerPos) > 0.05) {
        this.trailTimer -= dt;
        if (this.trailTimer <= 0) {
          this.trailTimer = 0.03;
          const n = this.skin.trail === 'trail-stardust' ? 2 : 1;
          this.stage.bursts.emit(wp, this.skin.trailColor, n, {
            speed: this.skin.trail === 'trail-sparks' ? 1.5 : 0.4,
            life: this.skin.trail === 'trail-echo' ? 0.9 : 0.6,
            size: this.skin.trail === 'trail-echo' ? 0.6 : 0.22,
            up: this.skin.trail === 'trail-embers' ? 0.8 : 0,
          });
        }
      }
      this.lastPlayerPos.copy(wp);
    }
    if (this.playerLight) this.playerLight.intensity = 2 + Math.sin(t * 3) * 0.3;
    void platformAt;
  }

  private stepMover(mv: Mover, dt: number) {
    if (!mv.seg) {
      const next = mv.queue.shift();
      if (!next) return;
      mv.seg = next;
      mv.from = mv.obj.position.clone();
      mv.t = 0;
    }
    const seg = mv.seg;
    mv.t += dt / Math.max(0.01, seg.dur);
    const k = Math.min(1, mv.t);
    const isPlayer = mv.obj === this.player;
    if (seg.kind === 'blink') {
      if (k < 0.5) {
        mv.obj.scale.setScalar(mv.baseScale * Math.max(0.01, 1 - k * 2));
      } else {
        mv.obj.position.copy(seg.to);
        mv.obj.scale.setScalar(mv.baseScale * Math.min(1, (k - 0.5) * 2));
      }
      if (k >= 0.5 && mv.t - dt / seg.dur < 0.5) this.stage.bursts.emit(this.toWorld(seg.to), this.skin.portal, 16, { speed: 2, life: 0.4 });
    } else {
      const e = seg.kind === 'fall' ? easeIn(k) : ease(k);
      mv.obj.position.lerpVectors(mv.from, seg.to, e);
      if (seg.kind === 'walk' && !this.gravityMode) {
        mv.obj.position.y += Math.sin(k * Math.PI) * 0.18;
        if (isPlayer && seg.dir !== undefined && !this.stage.reducedMotion) {
          const axis = new THREE.Vector3(DY[seg.dir], 0, -DX[seg.dir]).normalize();
          this.playerCube.quaternion.setFromAxisAngle(axis, -e * (Math.PI / 2));
        }
      }
    }
    if (mv.t >= 1) {
      mv.obj.position.copy(seg.to);
      mv.obj.scale.setScalar(mv.baseScale);
      if (isPlayer) this.playerCube.rotation.set(0, 0, 0);
      mv.seg = null;
    }
  }

  // ---------- effects ----------

  shatter() {
    const at = this.playerWorld();
    this.stage.bursts.emit(at, this.skin.cube, 60, { speed: 4, life: 0.9, gravity: 6, size: 0.3 });
    this.hidden = true;
    this.player.visible = false;
  }

  reveal() {
    this.hidden = false;
    this.player.visible = true;
  }

  celebrate() {
    const at = this.toWorld(this.cellPos(this.L.exit, this.bodyLift()));
    this.stage.bursts.emit(at, this.theme.accent, 90, { speed: 4.5, life: 1.4, gravity: -0.5, size: 0.35 });
    this.stage.bursts.emit(at, this.skin.cube, 50, { speed: 3, life: 1.1, size: 0.3 });
  }

  burstAt(cell: number, color: number, count = 24) {
    this.stage.bursts.emit(this.toWorld(this.cellPos(cell, this.bodyLift())), color, count, { speed: 2.2, life: 0.6 });
  }

  rewindFlash() {
    const at = this.playerWorld();
    this.stage.bursts.emit(at, 0x9ffcff, 70, { speed: 5, life: 0.7, size: 0.3 });
  }

  /** Show the next few moves of a hint as glowing markers. */
  showHint(cells: number[], dirs: (number | null)[]) {
    this.clearHint();
    const lift = this.bodyLift();
    const mat = this.track(new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.9, depthWrite: false }));
    cells.forEach((cell, i) => {
      const d = dirs[i];
      let m: THREE.Mesh;
      if (d !== null && d !== undefined) {
        m = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.14, 0.32, 12)), mat);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.dirVec(d));
      } else m = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.1, 10, 8)), mat);
      m.position.copy(this.cellPos(cell, this.gravityMode ? 0.5 : lift + 0.55));
      m.scale.setScalar(1 - i * 0.12);
      this.hintGroup.add(m);
    });
  }

  clearHint() {
    this.hintGroup.clear();
  }

  // ---------- picking & input mapping ----------

  /** Cell under a normalised device coordinate, or -1. */
  pick(ndc: THREE.Vector2, camera: THREE.Camera): number {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    this.pivot.updateWorldMatrix(true, false);
    const inv = this.pivot.matrixWorld.clone().invert();
    const o = ray.ray.origin.clone().applyMatrix4(inv);
    const d = ray.ray.direction.clone().transformDirection(inv);
    let x: number;
    let y: number;
    if (this.gravityMode) {
      if (Math.abs(d.z) < 1e-6) return -1;
      const k = -o.z / d.z;
      const p = o.add(d.multiplyScalar(k));
      x = Math.round(p.x + this.cx);
      y = Math.round(this.cy - p.y);
    } else {
      if (Math.abs(d.y) < 1e-6) return -1;
      const k = (0.0 - o.y) / d.y;
      const p = o.add(d.multiplyScalar(k));
      x = Math.round(p.x + this.cx);
      y = Math.round(p.z + this.cy);
    }
    if (x < 0 || y < 0 || x >= this.L.w || y >= this.L.h) return -1;
    return y * this.L.w + x;
  }

  /** Screen-space unit vectors (y down) for each grid direction at the player. */
  screenDirs(camera: THREE.Camera, width: number, height: number): THREE.Vector2[] {
    const base = this.player.position.clone();
    const toScreen = (v: THREE.Vector3) => {
      const p = this.toWorld(v).project(camera);
      return new THREE.Vector2((p.x + 1) * 0.5 * width, (1 - p.y) * 0.5 * height);
    };
    const o = toScreen(base);
    return [0, 1, 2, 3].map((d) => toScreen(base.clone().add(this.dirVec(d))).sub(o).normalize());
  }

  /** Board bounds in world space (for camera fitting). */
  bounds() {
    return { w: this.L.w, h: this.L.h, gravity: this.gravityMode };
  }

  dispose() {
    this.stage.content.remove(this.root);
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
