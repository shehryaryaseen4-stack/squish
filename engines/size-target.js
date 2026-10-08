'use strict';
// Size-targeted image compression for the compress pages.
// "Reduce size by 50%" should give a file about half the size, every time it is used.
// 1. Find the highest quality whose result fits the target.
// 2. If even a low quality is too big (a photo that was already compressed hard), keep a decent
//    quality and shrink the pixel dimensions until it fits.
const SIZE_TARGET_FORMATS = new Set(['jpeg', 'webp', 'avif', 'png', 'gif', 'tiff']);
async function compressToSize(run, input, target, maxDim, format) {
  const job = async (q, dim) => { const r = await run(q, dim); return Buffer.isBuffer(r) ? r : r.buffer; };
  // File size grows roughly exponentially with quality, so interpolate on log(size) between the
  // best quality that fits and the lowest that does not: usually 3 or 4 encodes.
  // PNG and GIF "quality" only sets the palette size, so the first setting that fits is enough.
  // A time budget keeps very large images well inside the proxy's request timeout.
  const palette = format === 'png' || format === 'gif';
  const deadline = Date.now() + 25000;
  let fit = null, over = null; // { q, buf }
  let q = 75;
  for (let i = 0; i < 7 && Date.now() < deadline; i++) {
    const buf = await job(q, maxDim);
    if (buf.length <= target) fit = { q, buf }; else over = { q, buf };
    if (fit && (palette || fit.q >= 92 || fit.buf.length >= target * 0.93)) break;
    if (over && over.q <= 10) break;
    if (fit && over) {
      if (over.q - fit.q <= 1) break;
      const t = (Math.log(target) - Math.log(fit.buf.length)) / (Math.log(over.buf.length) - Math.log(fit.buf.length));
      q = Math.min(over.q - 1, Math.max(fit.q + 1, Math.floor(fit.q + (over.q - fit.q) * t)));
    } else q = fit ? Math.min(92, fit.q + 12) : Math.max(10, over.q - 25);
  }
  if (fit) return fit.buf;
  // Even a low quality is too big (already compressed hard): keep quality 70, shrink dimensions.
  const meta = await require('sharp')(input, { animated: true, limitInputPixels: 268402689 }).metadata();
  let edge = Math.min(maxDim || Infinity, Math.max(meta.width || 0, (meta.pageHeight || meta.height) || 0)) || 4000;
  let buf = await job(70, edge);
  for (let i = 0; i < 8 && buf.length > target && edge > 64 && Date.now() < deadline + 20000; i++) {
    edge = Math.max(64, Math.floor(edge * Math.min(0.9, Math.sqrt(target / buf.length) * 0.97)));
    buf = await job(70, edge);
  }
  return buf;
}

module.exports = { compressToSize, SIZE_TARGET_FORMATS };
