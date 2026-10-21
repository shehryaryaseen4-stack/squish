import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLDS } from '../../data/worlds';
import type { Stage } from './Stage';
import { glowTexture, stoneTexture } from './textures';

/** The floating island diorama behind the menus, also used to preview skins. */
export class MenuScene {
  readonly root = new THREE.Group();
  private cube: THREE.Mesh;
  private cubeMat: THREE.MeshStandardMaterial;
  private core: THREE.Mesh;
  private coreMat: THREE.MeshStandardMaterial;
  private halo: THREE.Sprite;
  private shards: THREE.Mesh[] = [];
  private disposables: { dispose(): void }[] = [];
  private fragments = 0;

  constructor(private stage: Stage) {
    const t = <T extends { dispose(): void }>(o: T) => (this.disposables.push(o), o);
    const stone = stoneTexture();
    const island = new THREE.Group();
    const top = new THREE.Mesh(t(new THREE.CylinderGeometry(3.2, 3, 0.5, 9)), t(new THREE.MeshStandardMaterial({ color: 0xd9b88a, map: stone, roughness: 0.9, flatShading: true })));
    top.receiveShadow = true;
    const rock = new THREE.Mesh(t(new THREE.ConeGeometry(3, 5, 9)), t(new THREE.MeshStandardMaterial({ color: 0x6a5060, roughness: 1, flatShading: true })));
    rock.rotation.x = Math.PI;
    rock.position.y = -2.75;
    island.add(top, rock);
    // Ruined pillars around the edge.
    const pillarMat = t(new THREE.MeshStandardMaterial({ color: 0xc29b6c, map: stone, roughness: 0.85 }));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const h = 0.6 + ((i * 37) % 10) / 10 * 1.8;
      const p = new THREE.Mesh(t(new RoundedBoxGeometry(0.5, h, 0.5, 2, 0.05)), pillarMat);
      p.position.set(Math.cos(a) * 2.5, 0.25 + h / 2, Math.sin(a) * 2.5);
      p.castShadow = p.receiveShadow = true;
      island.add(p);
    }
    this.root.add(island);

    this.cubeMat = t(new THREE.MeshStandardMaterial({ color: 0x6ff3ff, emissive: 0x6ff3ff, emissiveIntensity: 0.9, roughness: 0.25 }));
    this.cube = new THREE.Mesh(t(new RoundedBoxGeometry(0.8, 0.8, 0.8, 3, 0.12)), this.cubeMat);
    this.cube.position.set(0, 1.1, 1.2);
    this.cube.castShadow = true;
    this.root.add(this.cube);

    this.coreMat = t(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff5fd2, emissiveIntensity: 1.4, roughness: 0.1, transparent: true, opacity: 0.92 }));
    this.core = new THREE.Mesh(t(new THREE.IcosahedronGeometry(0.6, 1)), this.coreMat);
    this.core.position.set(0, 3.1, -0.6);
    this.root.add(this.core);
    this.halo = new THREE.Sprite(t(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff8ae0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.halo.scale.setScalar(4);
    this.halo.position.copy(this.core.position);
    this.root.add(this.halo);

    WORLDS.forEach((w, i) => {
      const m = new THREE.Mesh(
        t(new THREE.OctahedronGeometry(0.28)),
        t(new THREE.MeshStandardMaterial({ color: w.accent, emissive: w.accent, emissiveIntensity: 0.2, roughness: 0.2 })),
      );
      m.userData.index = i;
      this.shards.push(m);
      this.root.add(m);
    });
  }

  setSkin(color: number) {
    this.cubeMat.color.setHex(color);
    this.cubeMat.emissive.setHex(color);
  }

  /** How many worlds are complete: completed fragments glow. */
  setFragments(n: number) {
    this.fragments = n;
  }

  show(on: boolean) {
    if (on && !this.root.parent) this.stage.content.add(this.root);
    if (!on && this.root.parent) this.stage.content.remove(this.root);
  }

  update(_dt: number, t: number) {
    if (!this.root.parent) return;
    this.cube.position.y = 1.1 + Math.sin(t * 1.6) * 0.15;
    this.cube.rotation.y = t * 0.6;
    this.cube.rotation.x = Math.sin(t * 0.7) * 0.2;
    this.core.rotation.y = t * 0.4;
    this.core.rotation.z = t * 0.2;
    const pulse = 1 + Math.sin(t * 2) * 0.05;
    this.core.scale.setScalar(pulse);
    this.coreMat.emissiveIntensity = 0.6 + this.fragments * 0.35;
    this.halo.material.opacity = 0.25 + this.fragments * 0.1;
    this.shards.forEach((m) => {
      const i = m.userData.index as number;
      const a = t * 0.35 + (i / 5) * Math.PI * 2;
      m.position.set(Math.cos(a) * 1.6, 3.1 + Math.sin(t + i) * 0.25, -0.6 + Math.sin(a) * 1.6);
      m.rotation.y = t * 2;
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = i < this.fragments ? 2 : 0.15;
    });
  }

  dispose() {
    this.show(false);
    for (const d of this.disposables) d.dispose();
  }
}
