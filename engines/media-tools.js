'use strict';
// Video compressor, video trimmer, MP3 cutter and ringtone maker (FFmpeg).
//   compressVideo  re-encodes to H.264/AAC MP4, either to fit a size (MB) or at a quality level
//   trimMedia      keeps the part between start and end; video -> MP4, audio -> MP3/M4A/WAV,
//                  ringtones -> M4R (iPhone) or MP3 (Android), with optional fade in/out
// Encodes can take minutes, longer than a proxy waits for one response, so they run as
// background jobs (startJob): the page polls /api/jobs/:id and then downloads the result.

const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { job, run, UserError } = require('./cli');

const TIMEOUT_MS = Math.max(60, Number(process.env.MEDIA_TIMEOUT_S || 1800)) * 1000;
const KEEP_MS = 15 * 60 * 1000; // results can be downloaded for 15 minutes
const MAX_WAITING = Math.max(1, Number(process.env.MEDIA_MAX_JOBS || 12)); // queued + running

async function probe(file) {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', file]);
    const j = JSON.parse(stdout.toString());
    const v = (j.streams || []).find((s) => s.codec_type === 'video');
    return { duration: Number(j.format && j.format.duration) || 0, video: v ? { width: v.width, height: v.height } : null, audio: (j.streams || []).some((s) => s.codec_type === 'audio') };
  } catch { throw new UserError('This file could not be read. It may be damaged or use a format FFmpeg does not support.', 415); }
}

const ffmpeg = (args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], { timeoutMs: TIMEOUT_MS }).catch((e) => {
  if (/Invalid data found|could not find codec|Unknown format|moov atom not found/i.test(e.stderr || '')) throw new UserError('This file could not be read. It may be damaged or use a codec FFmpeg does not support.', 415);
  if (e.userMessage) throw e; // timeout
  throw e;
});

const scaleTo = (h) => `scale=-2:'min(${h},trunc(ih/2)*2)'`;

/**
 * @param {string} input  path of the uploaded file
 * @param {{targetMB?: number, quality?: 'high'|'medium'|'low', maxHeight?: number}} o
 * @param {string} dir  job directory
 */
async function compressVideo(input, o, dir) {
  const info = await probe(input);
  if (!info.video) throw new UserError('This file has no video track. To make audio smaller, convert it to MP3.');
  const inSize = (await fs.stat(input)).size;
  const output = path.join(dir, 'output.mp4');
  const audio = info.audio ? ['-c:a', 'aac', '-ac', '2'] : ['-an'];
  let maxH = Math.min(o.maxHeight || 2160, info.video.height || 2160);

  if (o.targetMB) {
    const target = o.targetMB * 1024 * 1024;
    if (target >= inSize) throw new UserError(`This video is already ${(inSize / 1024 / 1024).toFixed(1)} MB, which is under ${o.targetMB} MB.`);
    const dur = info.duration;
    if (!dur) throw new UserError('The length of this video could not be read, so it cannot be fitted to a size. Choose a quality level instead.');
    const aK = info.audio ? (o.targetMB <= 10 ? 64 : 96) : 0;
    let factor = 0.93; // leave room for the container
    for (let attempt = 0; attempt < 2; attempt++) {
      const vK = Math.floor((target * 8 * factor) / 1024 / dur) - aK;
      if (vK < 80) throw new UserError(`This video is too long to fit in ${o.targetMB} MB with watchable quality. Trim it first or choose a larger size.`);
      const h = Math.min(maxH, vK > 3500 ? 1080 : vK > 1600 ? 720 : vK > 700 ? 480 : vK > 300 ? 360 : 240);
      await ffmpeg(['-i', input, '-map', '0:v:0', ...(info.audio ? ['-map', '0:a:0'] : []), '-sn', '-dn', '-map_metadata', '-1',
        '-c:v', 'libx264', '-preset', 'faster', '-b:v', `${vK}k`, '-maxrate', `${Math.round(vK * 1.4)}k`, '-bufsize', `${vK * 2}k`,
        '-pix_fmt', 'yuv420p', '-vf', scaleTo(h), ...audio, ...(info.audio ? ['-b:a', `${aK}k`] : []), '-movflags', '+faststart', output]);
      if ((await fs.stat(output)).size <= target) break;
      factor *= 0.85;
    }
  } else {
    const [crf, cap] = { high: [24, 1080], medium: [28, 720], low: [32, 480] }[o.quality] || [28, 720];
    maxH = Math.min(maxH, cap);
    await ffmpeg(['-i', input, '-map', '0:v:0', ...(info.audio ? ['-map', '0:a:0'] : []), '-sn', '-dn', '-map_metadata', '-1',
      '-c:v', 'libx264', '-preset', 'faster', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-vf', scaleTo(maxH),
      ...audio, ...(info.audio ? ['-b:a', o.quality === 'low' ? '64k' : '128k'] : []), '-movflags', '+faststart', output]);
  }
  const outSize = (await fs.stat(output)).size;
  if (o.targetMB && outSize > o.targetMB * 1024 * 1024) throw new UserError(`This video could not be brought under ${o.targetMB} MB. Trim it or choose a larger size.`);
  return { file: output, ext: 'mp4', type: 'video/mp4', note: { before: inSize, after: outSize } };
}

const AUDIO_OUT = {
  mp3: [['-c:a', 'libmp3lame', '-b:a', '192k'], 'audio/mpeg'],
  m4a: [['-c:a', 'aac', '-b:a', '192k', '-f', 'ipod'], 'audio/mp4'],
  m4r: [['-c:a', 'aac', '-b:a', '192k', '-f', 'ipod'], 'audio/x-m4r'],
  wav: [['-c:a', 'pcm_s16le'], 'audio/wav'],
};

/**
 * @param {string} input
 * @param {{start: number, end: number, format: string, fadeIn?: number, fadeOut?: number, maxLen?: number}} o
 */
async function trimMedia(input, o, dir) {
  const info = await probe(input);
  const start = Math.max(0, Number(o.start) || 0);
  let end = Number(o.end) || info.duration;
  if (info.duration) end = Math.min(end, info.duration);
  const len = end - start;
  if (!(len > 0.05)) throw new UserError('Choose an end time after the start time.');
  if (o.maxLen && len > o.maxLen + 0.05) throw new UserError(`Ringtones can be at most ${o.maxLen} seconds long. Move the start or end closer together.`);
  const fi = Math.min(Math.max(0, Number(o.fadeIn) || 0), len / 2), fo = Math.min(Math.max(0, Number(o.fadeOut) || 0), len / 2);
  const af = [fi ? `afade=t=in:st=0:d=${fi}` : '', fo ? `afade=t=out:st=${(len - fo).toFixed(3)}:d=${fo}` : ''].filter(Boolean).join(',');
  const seek = ['-ss', start.toFixed(3), '-i', input, '-t', len.toFixed(3)];

  if (o.format === 'mp4') {
    if (!info.video) throw new UserError('This file has no video track. Use the MP3 cutter for audio files.');
    const output = path.join(dir, 'output.mp4');
    await ffmpeg([...seek, '-map', '0:v:0', ...(info.audio ? ['-map', '0:a:0'] : []), '-sn', '-dn', '-c:v', 'libx264', '-preset', 'faster', '-crf', '21',
      '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', ...(info.audio ? ['-c:a', 'aac', '-b:a', '160k', ...(af ? ['-af', af] : [])] : ['-an']),
      '-movflags', '+faststart', output]);
    return { file: output, ext: 'mp4', type: 'video/mp4' };
  }
  const rec = AUDIO_OUT[o.format];
  if (!rec) throw new UserError('Choose MP3, M4A, M4R or WAV.');
  if (!info.audio) throw new UserError('This file has no sound to cut.');
  const output = path.join(dir, `output.${o.format}`);
  await ffmpeg([...seek, '-vn', '-sn', '-dn', '-map', '0:a:0', ...(af ? ['-af', af] : []), ...rec[0], output]);
  return { file: output, ext: o.format, type: rec[1] };
}

// ------------------------------------------------------------------ jobs --
const JOBS = new Map(); // id -> { status: 'queued'|'working'|'done'|'error', error, file, name, type, size, note, at }
const OUT_DIR = path.join(os.tmpdir(), 'squish-results');
fsSync.mkdirSync(OUT_DIR, { recursive: true });

function sweep() {
  const now = Date.now();
  for (const [id, j] of JOBS) {
    if (now - j.at > KEEP_MS && j.status !== 'queued' && j.status !== 'working') {
      JOBS.delete(id);
      if (j.file) fs.rm(j.file, { force: true }).catch(() => {});
    }
  }
}
setInterval(sweep, 60 * 1000).unref();

const pending = () => [...JOBS.values()].filter((j) => j.status === 'queued' || j.status === 'working').length;

/**
 * Start fn(dir) in the background on an uploaded file; the upload is deleted afterwards.
 * fn returns { file, ext, type, note? }. Returns the job id.
 */
function startJob(uploadPath, baseName, fn) {
  if (pending() >= MAX_WAITING) {
    fs.rm(uploadPath, { force: true }).catch(() => {});
    throw new UserError('The server is busy with other videos right now. Please try again in a few minutes.', 503);
  }
  const id = crypto.randomBytes(12).toString('hex');
  const j = { status: 'queued', at: Date.now() };
  JOBS.set(id, j);
  job(async (dir) => {
    j.status = 'working';
    const r = await fn(dir);
    const dest = path.join(OUT_DIR, `${id}.${r.ext}`);
    await fs.copyFile(r.file, dest);
    Object.assign(j, { status: 'done', file: dest, name: `${baseName}.${r.ext}`, type: r.type, size: (await fs.stat(dest)).size, note: r.note || null, at: Date.now() });
  }).catch((e) => {
    Object.assign(j, { status: 'error', at: Date.now(), error: e.userMessage || 'This file could not be processed.', code: e.statusCode || 500 });
    if (!e.userMessage) console.error('Media job error:', e);
  }).finally(() => fs.rm(uploadPath, { force: true }).catch(() => {}));
  return id;
}

const getJob = (id) => (/^[a-f0-9]{24}$/.test(String(id)) ? JOBS.get(id) : null);

module.exports = { compressVideo, trimMedia, probe, startJob, getJob };
