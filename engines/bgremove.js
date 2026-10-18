'use strict';
// Background removal for /remove-background: an image segmentation model (IS-Net "general use",
// Apache-2.0, from the rembg project) run with ONNX Runtime on the CPU. The model gives a mask
// that becomes the alpha channel of the original picture, so the result keeps full resolution.
//
// The model file lives in models/ (the Dockerfile downloads it; BG_MODEL_PATH overrides). It is
// loaded on first use and unloaded after BG_IDLE_MIN minutes without work, because it holds about
// 1 GB of memory while loaded. One image is processed at a time.

const fs = require('fs');
const path = require('path');
const { UserError } = require('./cli');

const MODEL = process.env.BG_MODEL_PATH || path.join(__dirname, '..', 'models', 'isnet-general-use.onnx');
const SIZE = 1024; // the model's input size
const MAX_SIDE = Math.max(500, Number(process.env.BG_MAX_SIDE || 4000)); // bigger photos are scaled down
const IDLE_MS = Math.max(1, Number(process.env.BG_IDLE_MIN || 10)) * 60 * 1000;
const THREADS = Math.max(1, Number(process.env.BG_THREADS || 2));

let ort = null;
try { ort = require('onnxruntime-node'); } catch { ort = null; }
const available = () => !!ort && fs.existsSync(MODEL);

let session = null; let idleTimer = null;
async function getSession() {
  clearTimeout(idleTimer);
  if (!session) session = await ort.InferenceSession.create(MODEL, { intraOpNumThreads: THREADS, interOpNumThreads: 1, graphOptimizationLevel: 'all' });
  return session;
}
function scheduleUnload() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => { const s = session; session = null; if (s) await s.release().catch(() => {}); }, IDLE_MS);
  idleTimer.unref();
}

// one at a time: the model uses most of the memory and several cores
let chain = Promise.resolve();
const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

/**
 * @param {{buffer: Buffer}} p
 * @returns {Promise<{buffer: Buffer, width: number, height: number}>} a PNG with a transparent background
 */
async function removeBackground({ buffer }) {
  if (!available()) throw new UserError('Background removal is not available on this server yet.', 503);
  const sharp = require('sharp');
  let rgb;
  try {
    rgb = await sharp(buffer, { failOn: 'none' }).rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  } catch {
    throw new UserError('This image could not be read. Upload a JPG, PNG, WEBP or HEIC photo.', 415);
  }
  const { width: W, height: H } = rgb.info;
  return serial(async () => {
    const s = await getSession();
    try {
      // model input: 1024 x 1024, RGB scaled to 0..1 by the brightest value, minus 0.5
      const small = await sharp(rgb.data, { raw: { width: W, height: H, channels: 3 } }).resize(SIZE, SIZE, { fit: 'fill' }).raw().toBuffer();
      let max = 1; for (let i = 0; i < small.length; i++) if (small[i] > max) max = small[i];
      const n = SIZE * SIZE; const input = new Float32Array(3 * n);
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) input[c * n + i] = small[i * 3 + c] / max - 0.5;
      const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
      const pred = out[s.outputNames[0]].data;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) { if (pred[i] < lo) lo = pred[i]; if (pred[i] > hi) hi = pred[i]; }
      const span = hi - lo || 1;
      const m = Buffer.alloc(n);
      for (let i = 0; i < n; i++) m[i] = Math.round(((pred[i] - lo) / span) * 255);
      const mask = await sharp(m, { raw: { width: SIZE, height: SIZE, channels: 1 } }).resize(W, H, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
      const rgba = Buffer.alloc(W * H * 4);
      for (let i = 0, j = 0; i < W * H; i++, j += 3) {
        rgba[i * 4] = rgb.data[j]; rgba[i * 4 + 1] = rgb.data[j + 1]; rgba[i * 4 + 2] = rgb.data[j + 2]; rgba[i * 4 + 3] = mask[i];
      }
      const png = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 6 }).toBuffer();
      return { buffer: png, width: W, height: H };
    } finally { scheduleUnload(); }
  });
}

module.exports = { removeBackground, available };
