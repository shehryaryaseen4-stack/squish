import * as THREE from 'three';

/**
 * Frames the current board. Top-down boards get a three-quarter view that can
 * be turned in 90 degree steps; gravity chambers are viewed head-on.
 */
export class CameraController {
  private target = new THREE.Vector3();
  private yaw = 0;
  private yawTarget = 0;
  private dist = 14;
  private distTarget = 14;
  private boardW = 1;
  private boardH = 1;
  /** Gravity chambers turned on their side swap width and height on screen. */
  private swapped = false;
  private pitch = 0.95;
  private gravity = false;
  private shakeT = 0;
  private menuMode = false;
  reducedMotion = false;

  constructor(private camera: THREE.PerspectiveCamera) {}

  frameBoard(w: number, h: number, gravity: boolean) {
    this.menuMode = false;
    this.gravity = gravity;
    this.target.set(0, gravity ? 0 : 0, 0);
    this.yaw = this.yawTarget = 0;
    this.swapped = false;
    this.fit(w, h);
    this.dist = this.distTarget;
  }

  setSwapped(swapped: boolean) {
    if (swapped === this.swapped) return;
    this.swapped = swapped;
    this.fit(this.boardW, this.boardH);
  }

  /** Recompute distance so the whole board fits the current aspect ratio. */
  fit(w: number, h: number) {
    this.boardW = w;
    this.boardH = h;
    const cam = this.camera;
    const vfov = (cam.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
    // Leave room for the HUD at the top and controls at the bottom.
    const padW = this.gravity ? 1.6 : 1.8;
    const padH = this.gravity ? 3.2 : 3.4;
    if (this.gravity) {
      const sw = this.swapped ? h : w;
      const sh = this.swapped ? w : h;
      const dw = (sw + padW) / 2 / Math.tan(hfov / 2);
      const dh = (sh + padH) / 2 / Math.tan(vfov / 2);
      this.distTarget = Math.max(dw, dh, 6) + 0.6;
    } else {
      const diag = Math.hypot(w, h);
      const dw = (diag * 0.82 + padW) / 2 / Math.tan(hfov / 2);
      const dh = (h * 0.85 + 1.2 + padH) / 2 / Math.tan(vfov / 2);
      this.distTarget = Math.max(dw, dh, 7);
    }
    // A slight tilt shows the depth of the chamber walls.
    this.pitch = this.gravity ? 0.16 : 0.92;
  }

  setMenu(on: boolean) {
    this.menuMode = on;
    if (on) {
      this.target.set(0, 2.3, 0);
      const portrait = this.camera.aspect < 0.8;
      this.dist = this.distTarget = portrait ? 17 : 13;
      this.pitch = 0.28;
      this.gravity = false;
    }
  }

  rotate(steps: number) {
    if (this.gravity) return;
    this.yawTarget += (steps * Math.PI) / 2;
  }

  shake(amount = 0.25) {
    if (!this.reducedMotion) this.shakeT = amount;
  }

  update(dt: number, t: number) {
    const k = 1 - Math.exp(-dt * 8);
    if (this.menuMode) this.yawTarget += dt * (this.reducedMotion ? 0 : 0.08);
    this.yaw += (this.yawTarget - this.yaw) * k;
    this.dist += (this.distTarget - this.dist) * (1 - Math.exp(-dt * 4));
    const drift = this.reducedMotion || this.menuMode ? 0 : Math.sin(t * 0.25) * 0.04;
    const pitch = this.pitch + (this.reducedMotion ? 0 : Math.sin(t * 0.18) * 0.015);
    const yaw = this.yaw + drift;
    const p = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch) * this.dist,
      Math.sin(pitch) * this.dist,
      Math.cos(yaw) * Math.cos(pitch) * this.dist,
    ).add(this.target);
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      p.x += (Math.random() - 0.5) * this.shakeT * 0.6;
      p.y += (Math.random() - 0.5) * this.shakeT * 0.6;
    }
    this.camera.position.copy(p);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
  }
}
