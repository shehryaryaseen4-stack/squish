// Builds a MakeHuman body (CC0 assets) for a gender, muscle and weight,
// with clothes painted on as vertex colours.
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const obj = fs.readFileSync(path.join(DIR, 'base.obj'), 'utf8').split('\n');
const base = [];
const groups = {};
let group = '';
const bodyFaces = [];
for (const line of obj) {
  if (line.startsWith('v ')) base.push(line.slice(2).trim().split(/\s+/).map(Number));
  else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ')) {
    const idx = line.slice(2).trim().split(/\s+/).map((t) => Number(t.split('/')[0]) - 1);
    (groups[group] ||= []).push(idx);
    if (group === 'body') bodyFaces.push(idx);
  }
}

const targetCache = {};
function target(name) {
  if (targetCache[name]) return targetCache[name];
  const out = [];
  for (const line of fs.readFileSync(path.join(DIR, 't', `${name}.target`), 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const [i, x, y, z] = line.trim().split(/\s+/).map(Number);
    out.push([i, x, y, z]);
  }
  return (targetCache[name] = out);
}

// How much each vertex belongs to each body part (soft, from the bone weights).
const weights = JSON.parse(fs.readFileSync(path.join(DIR, 'weights.mhw'), 'utf8')).weights;
const W = { armL: [], armR: [], delt: [], top: [], bottom: [], shin: [], foot: [], head: [], clav: [], breast: [] };
for (const k of Object.keys(W)) W[k] = new Float32Array(base.length);
for (const [b, list] of Object.entries(weights)) {
  const arm = /^(upperarm|lowerarm|wrist|finger|metacarpal)/.test(b);
  for (const [v, w] of list) {
    if (arm) W[b.endsWith('.L') ? 'armL' : 'armR'][v] += w;
    if (/^shoulder01/.test(b)) W.delt[v] += w;
    if (/^breast/.test(b)) W.breast[v] += w;
    if (/^clavicle/.test(b)) W.clav[v] += w;
    if (/^(spine|breast|root|pelvis)/.test(b)) W.top[v] += w;
    if (/^(pelvis|root|upperleg|spine01)/.test(b)) W.bottom[v] += w;
    if (/^lowerleg/.test(b)) W.shin[v] += w;
    if (/^(foot|toe)/.test(b)) W.foot[v] += w;
    if (/^(head|jaw|eye|oculi|orbicularis|oris|levator|risorius|special|tongue)/.test(b)) W.head[v] += w;
  }
}

// Neighbours of each vertex, for smoothing small details away (toes into shoes, a smooth sports top).
const near = Array.from({ length: base.length }, () => new Set());
for (const f of bodyFaces) for (let i = 0; i < f.length; i++) { near[f[i]].add(f[(i + 1) % f.length]); near[f[(i + 1) % f.length]].add(f[i]); }
function smoothSome(p, pick, rounds, k = 0.6) {
  const ids = [];
  for (let i = 0; i < p.length; i++) if (near[i].size && pick(i)) ids.push(i);
  for (let r = 0; r < rounds; r++) {
    const next = ids.map((i) => {
      const n = [...near[i]];
      const avg = [0, 1, 2].map((c) => n.reduce((a, j) => a + p[j][c], 0) / n.length);
      return avg.map((v, c) => p[i][c] + (v - p[i][c]) * k);
    });
    ids.forEach((i, t) => { p[i] = next[t]; });
  }
}

// Three-way split around the middle value, as MakeHuman does.
const tri = (v) => (v < 0.5 ? { min: 1 - v * 2, average: v * 2 } : { average: 2 - v * 2, max: v * 2 - 1 });
// add() skips weights <= 0, so let negative ones through for extrapolation.

function build({ sex, muscle, weight, belly = 0 }) {
  const p = base.map((v) => v.slice());
  const add = (name, w) => {
    if (!w) return;
    for (const [i, x, y, z] of target(name)) { p[i][0] += x * w; p[i][1] += y * w; p[i][2] += z * w; }
  };
  for (const e of ['african', 'asian', 'caucasian']) add(`${e}-${sex}-young`, 1 / 3);
  for (const [m, wm] of Object.entries(tri(muscle))) for (const [wt, ww] of Object.entries(tri(weight))) add(`universal-${sex}-young-${m}muscle-${wt}weight`, wm * ww);
  // Values past 1 push further than the targets go (very heavy, very muscular).
  if (belly > 0) add('stomach-pregnant-incr', belly);
  // A sports top holds the chest in.
  if (sex === 'female') add('female-young-averagemuscle-averageweight-mincup-averagefirmness', 0.8);

  const center = (g) => {
    const vs = [...new Set(groups[g].flat())].map((i) => p[i]);
    return [0, 1, 2].map((k) => vs.reduce((a, v) => a + v[k], 0) / vs.length);
  };
  // Bring the arms down from the modelling pose (heavier bodies keep them a little wider).
  for (const [side, sign] of [['l', 1], ['r', -1]]) {
    const j = center(`joint-${side}-shoulder`);
    const h = center(`joint-${side}-hand`);
    const now = Math.atan2(Math.abs(h[0] - j[0]), j[1] - h[1]);
    const want = (9 + weight * 10 + muscle * 6) * Math.PI / 180;
    const a = -(now - want) * sign;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const arm = side === 'l' ? W.armL : W.armR;
    for (let i = 0; i < p.length; i++) {
      const w = Math.min(1, arm[i] + (Math.sign(p[i][0]) === sign ? W.delt[i] * 0.55 : 0));
      if (w <= 0) continue;
      const dx = p[i][0] - j[0];
      const dy = p[i][1] - j[1];
      p[i][0] += w * (j[0] + dx * c - dy * s - p[i][0]);
      p[i][1] += w * (j[1] + dx * s + dy * c - p[i][1]);
    }
  }
  smoothSome(p, (i) => W.foot[i] > 0.15, 30);
  if (sex === 'female') {
    // Everything near the chest, so the top looks like a smooth sports top.
    // The most forward point of each side of the chest.
    const centres = [1, -1].map((side) => {
      let best = null;
      for (let i = 0; i < p.length; i++) if (W.breast[i] > 0.05 && Math.sign(p[i][0]) === side && near[i].size && (!best || p[i][2] > best[2])) best = p[i];
      return best.slice();
    });
    // Press down anything that sticks out more than the surface around it (a blur over x and y).
    const zone = [];
    for (let i = 0; i < p.length; i++) if (near[i].size && p[i][2] > 0.6 && centres.some((c) => Math.hypot(p[i][0] - c[0], p[i][1] - c[1]) < 1.1)) zone.push(i);
    const fit = zone.map((i) => {
      let sz = 0; let sw = 0;
      for (const j of zone) {
        const d = Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]);
        if (d > 0.45) continue;
        const w = 1 - d / 0.45; sz += p[j][2] * w; sw += w;
      }
      return sz / sw;
    });
    zone.forEach((i, t) => { if (p[i][2] > fit[t] + 0.01) p[i][2] = fit[t] + 0.01; });
  }
  const ys = (arr) => p.filter((_, i) => arr[i] > 0.6).map((v) => v[1]);
  const max = (a) => a.reduce((m, x) => (x > m ? x : m), -Infinity);
  const min = (a) => a.reduce((m, x) => (x < m ? x : m), Infinity);
  const thigh = p.filter((_, i) => W.bottom[i] > 0.6 && !(W.top[i] > 0.6)).map((v) => v[1]);
  const knee = center('joint-l-knee')[1];
  const hip = center('joint-l-upper-leg')[1];
  const eyes = [center('joint-l-eye'), center('joint-r-eye')];
  const neck = center('joint-neck');
  const headTop = max(ys(W.head));
  const bottom = min(p.map((v) => v[1]));
  const torsoTop = neck[1];
  const pelvis = center('joint-pelvis')[1];
  const masks = p.map((_, i) => [W.top[i] + W.clav[i] * 0.7, W.armL[i] + W.armR[i] + W.delt[i] * 0.5, W.foot[i], W.head[i]]);
  return {
    p, masks, faces: bodyFaces, eyes, bottom, height: headTop - bottom,
    u: {
      waist: pelvis + (torsoTop - pelvis) * 0.22,
      shortsEnd: sex === 'female' ? bottom + 0.75 : knee + (hip - knee) * 0.38,
      neck: torsoTop, eyeY: eyes[0][1], eyeZ: eyes[0][2], headTop, footTop: center('joint-l-ankle')[1], bottom,
      female: sex === 'female' ? 1 : 0,
    },
  };
}

module.exports = { build };
