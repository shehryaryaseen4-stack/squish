import * as THREE from 'three';

// Small procedural canvas textures, generated once and shared.
const cache = new Map<string, THREE.Texture>();

function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = false) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Soft radial glow for sprites and halos. */
export function glowTexture() {
  return canvasTex('glow', 128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

/** Seeded pseudo-random generator so textures look the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Weathered stone tile: greyscale, tinted by the material colour. */
export function stoneTexture() {
  return canvasTex('stone', 128, (g, s) => {
    const r = rng(7);
    g.fillStyle = '#d8d8d8';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const v = 180 + Math.floor(r() * 70);
      g.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.3})`;
      const w = 1 + r() * 4;
      g.fillRect(r() * s, r() * s, w, w);
    }
    g.strokeStyle = 'rgba(90,90,90,0.35)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      let x = r() * s;
      let y = r() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 30;
        y += (r() - 0.5) * 30;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, s - 3, s - 3);
  });
}

/** Diagonal warning stripes for inverted (striped) gates. */
export function stripeTexture() {
  return canvasTex(
    'stripes',
    64,
    (g, s) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, s, s);
      g.fillStyle = '#3a3a3a';
      for (let i = -s; i < s * 2; i += 16) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + 8, 0);
        g.lineTo(i + 8 - s, s);
        g.lineTo(i - s, s);
        g.closePath();
        g.fill();
      }
    },
    true,
  );
}

/** Laboratory panel grid for gravity-chamber backdrops. */
export function panelTexture() {
  return canvasTex(
    'panel',
    128,
    (g, s) => {
      g.fillStyle = '#9a9a9a';
      g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      g.strokeRect(2, 2, s - 4, s - 4);
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.moveTo(s / 2, 8);
      g.lineTo(s / 2, s - 8);
      g.moveTo(8, s / 2);
      g.lineTo(s - 8, s / 2);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.4)';
      for (const [x, y] of [[10, 10], [s - 10, 10], [10, s - 10], [s - 10, s - 10]]) {
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
    },
    true,
  );
}

/** Swirl used on rift discs and the exit portal. */
export function swirlTexture() {
  return canvasTex('swirl', 128, (g, s) => {
    const c = s / 2;
    const grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 3;
    for (let a = 0; a < 4; a++) {
      g.beginPath();
      for (let t = 0; t < 1; t += 0.02) {
        const ang = a * (Math.PI / 2) + t * 4.5;
        const rr = t * c * 0.95;
        const x = c + Math.cos(ang) * rr;
        const y = c + Math.sin(ang) * rr;
        if (t === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

/** Arrow decal for gravity pads (points up the texture). */
export function arrowTexture() {
  return canvasTex('arrow', 64, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(s / 2, 6);
    g.lineTo(s - 10, s / 2);
    g.lineTo(s / 2 + 8, s / 2);
    g.lineTo(s / 2 + 8, s - 6);
    g.lineTo(s / 2 - 8, s - 6);
    g.lineTo(s / 2 - 8, s / 2);
    g.lineTo(10, s / 2);
    g.closePath();
    g.fill();
  });
}

/** Soft tiling cloud field for the sea of clouds below the islands. */
export function cloudTexture() {
  return canvasTex(
    'clouds',
    256,
    (g, s) => {
      const r = rng(42);
      g.clearRect(0, 0, s, s);
      for (let i = 0; i < 70; i++) {
        const x = r() * s;
        const y = r() * s;
        const rad = 14 + r() * 46;
        for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
          const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
          grd.addColorStop(0, `rgba(255,255,255,${0.18 + r() * 0.2})`);
          grd.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = grd;
          g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
        }
      }
    },
    true,
  );
}
