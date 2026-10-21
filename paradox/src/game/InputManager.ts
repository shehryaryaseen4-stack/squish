import * as THREE from 'three';

export type Command = 'wait' | 'echo' | 'flip' | 'undo' | 'restart' | 'pause' | 'hint' | 'rotL' | 'rotR';

export interface InputHandlers {
  /** A direction in screen space (x right, y down), already normalised. */
  dir(v: THREE.Vector2): void;
  tap(ndc: THREE.Vector2): void;
  command(c: Command): void;
}

/**
 * Keyboard, swipe and tap input for the game canvas. Directions are reported
 * in screen space; the game maps them onto the board through the camera, so
 * controls stay intuitive however the board is turned.
 */
export class InputManager {
  enabled = false;
  sensitivity = 1;
  private start: { x: number; y: number; id: number; t: number } | null = null;
  private off: (() => void)[] = [];

  constructor(private el: HTMLElement, private h: InputHandlers) {
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.off.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, 'keydown', (e: KeyboardEvent) => this.key(e));
    on(el, 'pointerdown', (e: PointerEvent) => {
      if (!this.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      this.start = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
    });
    on(el, 'pointerup', (e: PointerEvent) => this.release(e));
    on(el, 'pointercancel', () => (this.start = null));
    // Stop the page from scrolling or zooming while swiping on the board.
    on(el, 'touchmove', (e: TouchEvent) => this.enabled && e.preventDefault(), { passive: false });
  }

  private release(e: PointerEvent) {
    const s = this.start;
    this.start = null;
    if (!this.enabled || !s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dist = Math.hypot(dx, dy);
    const threshold = 22 / this.sensitivity;
    if (dist >= threshold) {
      this.h.dir(new THREE.Vector2(dx, dy).normalize());
    } else if (performance.now() - s.t < 600) {
      const r = this.el.getBoundingClientRect();
      this.h.tap(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1));
    }
  }

  private key(e: KeyboardEvent) {
    if (!this.enabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      KeyW: [0, -1],
      ArrowDown: [0, 1],
      KeyS: [0, 1],
      ArrowLeft: [-1, 0],
      KeyA: [-1, 0],
      ArrowRight: [1, 0],
      KeyD: [1, 0],
    };
    const cmds: Record<string, Command> = {
      Space: 'wait',
      Period: 'wait',
      KeyR: 'echo',
      KeyF: 'flip',
      KeyG: 'flip',
      KeyZ: 'undo',
      Backspace: 'undo',
      Escape: 'pause',
      KeyP: 'pause',
      KeyH: 'hint',
      KeyQ: 'rotL',
      KeyE: 'rotR',
    };
    if (dirs[e.code]) {
      e.preventDefault();
      this.h.dir(new THREE.Vector2(...dirs[e.code]));
    } else if (cmds[e.code]) {
      if (e.code === 'Space' && target?.tagName === 'BUTTON') return;
      e.preventDefault();
      this.h.command(cmds[e.code]);
    }
  }

  dispose() {
    this.off.forEach((f) => f());
  }
}
