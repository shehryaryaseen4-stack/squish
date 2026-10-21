// Generates the PNG app icons in public/icons with a tiny software rasteriser
// (no image libraries needed). Run: npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
function inside(px, py, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function distToSeg(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function render(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const S = size / 512;
  const sc = maskable ? 0.78 : 1;
  const off = 256 * (1 - sc);
  const P = (pts) => pts.map(([x, y]) => [(x * sc + off) * S, (y * sc + off) * S]);
  const hex = P([[256, 96], [400, 176], [400, 336], [256, 416], [112, 336], [112, 176]]);
  const top = P([[256, 150], [352, 204], [256, 258], [160, 204]]);
  const left = P([[160, 204], [256, 258], [256, 366], [160, 312]]);
  const right = P([[352, 204], [256, 258], [256, 366], [352, 312]]);
  const r = (maskable ? 0 : 112) * S;
  const SS = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
        // Rounded-rect mask.
        const cx = Math.min(Math.max(px, r), size - r), cy = Math.min(Math.max(py, r), size - r);
        if (Math.hypot(px - cx, py - cy) > r && r > 0) continue;
        const t = (px + py) / (2 * size);
        let col = t < 0.55 ? mix([18, 0, 42], [74, 26, 106], t / 0.55) : mix([74, 26, 106], [208, 74, 138], (t - 0.55) / 0.45);
        let minD = Infinity;
        for (let i = 0; i < hex.length; i++) minD = Math.min(minD, distToSeg(px, py, hex[i], hex[(i + 1) % hex.length]));
        if (minD < 7 * S * sc) col = mix(col, [255, 154, 232], 0.6);
        if (inside(px, py, top)) col = [230, 254, 255];
        else if (inside(px, py, left)) col = mix([191, 252, 255], [42, 140, 255], (py / size));
        else if (inside(px, py, right)) col = [58, 109, 255];
        acc = [acc[0] + col[0], acc[1] + col[1], acc[2] + col[2], acc[3] + 255];
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      const a = acc[3] / n;
      buf[i] = a ? Math.round(acc[0] / (acc[3] / 255)) : 0;
      buf[i + 1] = a ? Math.round(acc[1] / (acc[3] / 255)) : 0;
      buf[i + 2] = a ? Math.round(acc[2] / (acc[3] / 255)) : 0;
      buf[i + 3] = Math.round(a);
    }
  }
  return png(size, size, buf);
}
const out = new URL('../public/icons/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), render(192, false));
writeFileSync(new URL('icon-512.png', out), render(512, false));
writeFileSync(new URL('icon-maskable-512.png', out), render(512, true));
console.log('icons written');
