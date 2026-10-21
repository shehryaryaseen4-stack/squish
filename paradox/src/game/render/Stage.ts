import * as THREE from 'three';
import type { WorldTheme } from '../../data/worlds';
import { cloudTexture, glowTexture } from './textures';

export type QualityLevel = 'low' | 'medium' | 'high';

export class WebGLUnavailableError extends Error {}

export function detectQuality(): QualityLevel {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  if (cores <= 4 || mem <= 3) return 'low';
  if (mobile) return 'medium';
  return 'high';
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: THREE.Color;
  gravity: number;
}

/** Pooled CPU particle bursts rendered as a single Points object. */
export class Bursts {
  readonly points: THREE.Points;
  private parts: Particle[] = [];
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private col: Float32Array;
  private sizes: Float32Array;
  constructor(private max = 400) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.sizes = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture() }, scale: { value: 300 } },
      vertexShader: `
        attribute float size; varying vec3 vColor; uniform float scale;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor * t.a, t.a); }`,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setScale(px: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = px;
  }

  emit(at: THREE.Vector3, color: THREE.ColorRepresentation, count: number, opts: { speed?: number; life?: number; size?: number; gravity?: number; up?: number } = {}) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (this.parts.length >= this.max) this.parts.shift();
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const sp = (opts.speed ?? 2) * (0.3 + Math.random() * 0.7);
      const life = (opts.life ?? 0.8) * (0.6 + Math.random() * 0.6);
      this.parts.push({
        x: at.x,
        y: at.y,
        z: at.z,
        vx: Math.sin(b) * Math.cos(a) * sp,
        vy: Math.cos(b) * sp + (opts.up ?? 0),
        vz: Math.sin(b) * Math.sin(a) * sp,
        life,
        max: life,
        size: (opts.size ?? 0.25) * (0.6 + Math.random() * 0.8),
        color: c,
        gravity: opts.gravity ?? 0,
      });
    }
  }

  update(dt: number) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.97;
      p.vz *= 0.97;
    }
    for (let i = 0; i < this.max; i++) {
      const p = ps[i];
      if (p) {
        const k = p.life / p.max;
        this.pos[i * 3] = p.x;
        this.pos[i * 3 + 1] = p.y;
        this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = p.color.r * k;
        this.col[i * 3 + 1] = p.color.g * k;
        this.col[i * 3 + 2] = p.color.b * k;
        this.sizes[i] = p.size * (0.4 + 0.6 * k);
      } else this.sizes[i] = 0;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(ps.length, 1));
  }

  clear() {
    this.parts.length = 0;
  }
}

/**
 * Owns the WebGL renderer, camera, sky, lighting and ambient effects. Boards
 * and the menu diorama are attached to `content`.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  readonly content = new THREE.Group();
  readonly bursts = new Bursts();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh;
  private clouds: THREE.Mesh;
  private fill: THREE.DirectionalLight;
  private dust: THREE.Points;
  private islands = new THREE.Group();
  private updaters = new Set<(dt: number, t: number) => void>();
  private running = false;
  private last = 0;
  time = 0;
  quality: QualityLevel = 'high';
  reducedMotion = false;
  private fpsSamples: number[] = [];
  onFrame: (() => void) | null = null;

  constructor(readonly canvas: HTMLCanvasElement, quality: QualityLevel) {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    } catch (e) {
      throw new WebGLUnavailableError(String(e));
    }
    if (!renderer.getContext()) throw new WebGLUnavailableError('No WebGL context');
    this.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.add(this.content);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404060, 1.5);
    this.scene.add(this.hemi);
    // Soft fill from the viewer's side so walls never go fully black.
    this.fill = new THREE.DirectionalLight(0xffffff, 0.55);
    this.fill.position.set(2, 6, 14);
    this.scene.add(this.fill);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(-6, 14, 8);
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 12;
    this.sun.shadow.camera.bottom = -12;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 50;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Gradient sky dome.
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x101030) },
        bottom: { value: new THREE.Color(0x804060) },
        deep: { value: new THREE.Color(0x200818) },
      },
      vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 deep; varying vec3 vPos;
        void main(){
          float h = vPos.y;
          vec3 c = h > 0.0 ? mix(bottom, top, smoothstep(0.0, 0.7, h)) : mix(bottom, deep, smoothstep(0.0, -0.8, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 16), skyMat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(0x804060, 30, 140);

    // A sea of clouds far below the islands gives depth when looking down.
    const ct = cloudTexture();
    ct.repeat.set(6, 6);
    this.clouds = new THREE.Mesh(
      new THREE.CircleGeometry(170, 48),
      new THREE.MeshBasicMaterial({ map: ct, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: true }),
    );
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = -16;
    this.scene.add(this.clouds);

    // Drifting dust motes.
    const n = 260;
    const dg = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - 0.5) * 50;
      p[i * 3 + 1] = (Math.random() - 0.5) * 30;
      p[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    dg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({
        size: 0.18,
        map: glowTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffffff,
        opacity: 0.7,
      }),
    );
    this.scene.add(this.dust);
    this.scene.add(this.islands);
    this.scene.add(this.bursts.points);
    this.buildIslands();
    this.setQuality(quality);
    this.resize();
  }

  private buildIslands() {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.95, flatShading: true });
    const topMat = new THREE.MeshStandardMaterial({ color: 0x889988, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const r = 1.5 + Math.random() * 3;
      const rock = new THREE.Mesh(new THREE.ConeGeometry(r, r * 2.2, 7, 1), rockMat);
      rock.rotation.x = Math.PI;
      rock.position.y = -r * 1.1;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, 0.4, 7), topMat);
      g.add(rock, top);
      const ang = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 28 + Math.random() * 26;
      g.position.set(Math.cos(ang) * dist, -8 + Math.random() * 16, Math.sin(ang) * dist);
      g.rotation.y = Math.random() * Math.PI;
      g.userData.phase = Math.random() * 10;
      g.userData.baseY = g.position.y;
      this.islands.add(g);
    }
    this.islands.userData.rock = rockMat;
    this.islands.userData.top = topMat;
  }

  setTheme(t: WorldTheme) {
    const sm = this.sky.material as THREE.ShaderMaterial;
    sm.uniforms.top.value.set(t.skyTop);
    sm.uniforms.bottom.value.set(t.skyBottom);
    sm.uniforms.deep.value.set(t.fog).lerp(new THREE.Color(t.skyTop), 0.55);
    (this.clouds.material as THREE.MeshBasicMaterial).color.set(t.particle).lerp(new THREE.Color(t.skyBottom), 0.5);
    this.fill.color.set(t.light);
    (this.scene.fog as THREE.Fog).color.set(t.fog);
    (this.dust.material as THREE.PointsMaterial).color.set(t.particle);
    this.hemi.color.set(t.light);
    this.hemi.groundColor.set(t.floorEdge).lerp(new THREE.Color(t.rock), 0.4);
    this.sun.color.set(t.light);
    (this.islands.userData.rock as THREE.MeshStandardMaterial).color.set(t.rock);
    (this.islands.userData.top as THREE.MeshStandardMaterial).color.set(t.floorEdge);
  }

  setQuality(q: QualityLevel) {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1));
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.dust.visible = q !== 'low';
    this.islands.visible = q !== 'low';
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.bursts.setScale(h * this.renderer.getPixelRatio() * 0.5);
  }

  addUpdater(fn: (dt: number, t: number) => void) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }

  private frame(dt: number) {
    this.time += dt;
    const t = this.time;
    for (const u of this.updaters) u(dt, t);
    this.bursts.update(dt);
    if (!this.reducedMotion) {
      this.dust.rotation.y += dt * 0.01;
      const cm = (this.clouds.material as THREE.MeshBasicMaterial).map!;
      cm.offset.x += dt * 0.004;
      cm.offset.y += dt * 0.002;
      this.dust.position.y = Math.sin(t * 0.1) * 0.6;
      for (const g of this.islands.children) {
        g.position.y = g.userData.baseY + Math.sin(t * 0.3 + g.userData.phase) * 0.6;
        g.rotation.y += dt * 0.02;
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
    this.trackFps(dt);
  }

  /** Steps resolution down when the device cannot keep up. */
  private trackFps(dt: number) {
    this.fpsSamples.push(dt);
    if (this.fpsSamples.length < 120) return;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    this.fpsSamples.length = 0;
    const pr = this.renderer.getPixelRatio();
    if (avg > 1 / 38 && pr > 1) {
      this.renderer.setPixelRatio(Math.max(1, pr - 0.25));
      this.resize();
    }
  }
}
