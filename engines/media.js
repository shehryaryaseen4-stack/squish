'use strict';
// Audio and video conversion with FFmpeg.
// Each output format has a fixed, widely compatible codec choice; inputs are whatever FFmpeg
// can demux. Animated GIF/WebP outputs are scaled down and frame-limited to keep them sane.
// Video -> JPG/PNG saves still pictures (frames): one per second for clips up to a minute, or
// FRAME_MAX evenly spaced over a longer video, as a ZIP (a single picture when there is one).

const fs = require('fs/promises');
const path = require('path');
const { job, run, listFiles, collect, UserError } = require('./cli');

const FRAME_MAX = 60;
const FRAME_ARGS = { jpg: ['-q:v', '2'], png: [] };

// Length of a media file in seconds (0 when FFmpeg cannot tell, as with some SWF files).
async function durationOf(file) {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeoutMs: 30000 });
    const d = parseFloat(String(stdout).trim());
    return Number.isFinite(d) && d > 0 ? d : 0;
  } catch { return 0; }
}
const stamp = (t) => `${Math.floor(t / 60)}m${String(Math.floor(t % 60)).padStart(2, '0')}s`;

// Still pictures from a video: frame-001-0m00s.jpg, frame-002-0m01s.jpg ...
async function videoFrames(dir, input, ext) {
  const dur = await durationOf(input);
  const fps = dur > FRAME_MAX ? FRAME_MAX / dur : 1;
  const outDir = path.join(dir, 'frames');
  await fs.mkdir(outDir);
  try {
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input,
      '-map', '0:v:0', '-vf', `fps=${fps.toFixed(6)}`, '-frames:v', String(FRAME_MAX), ...FRAME_ARGS[ext],
      path.join(outDir, `f-%04d.${ext}`)]);
  } catch (e) {
    if (/matches no streams|does not contain any stream|Output file .* does not contain/i.test(e.stderr || '')) {
      throw new UserError('This file has no video pictures to save. Interactive SWF games and animations cannot be turned into pictures.');
    }
    if (/Invalid data found|could not find codec|Unknown format/i.test(e.stderr || '')) {
      throw new UserError('This file could not be read. It may be damaged or use a codec FFmpeg does not support.', 415);
    }
    throw e;
  }
  const files = await listFiles(outDir);
  if (!files.length) throw new UserError('No pictures could be read from this video. Interactive SWF games and animations cannot be turned into pictures.');
  const named = [];
  for (const [i, f] of files.entries()) {
    const to = path.join(outDir, `frame-${String(i + 1).padStart(3, '0')}-${stamp(i / fps)}.${ext}`);
    await fs.rename(f, to);
    named.push(to);
  }
  return collect(named, ext, outDir);
}

const EVEN = 'scale=trunc(iw/2)*2:trunc(ih/2)*2'; // H.264 and friends need even dimensions
const X264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', EVEN];
const AAC = ['-c:a', 'aac', '-b:a', '160k'];
const A = (...args) => ['-vn', ...args]; // audio only

// Output recipes: args placed between input and output file. `ext` overrides the file extension.
const AUDIO = {
  mp3: A('-c:a', 'libmp3lame', '-q:a', '2'),
  wav: A('-c:a', 'pcm_s16le'),
  aac: A('-c:a', 'aac', '-b:a', '192k', '-f', 'adts'),
  flac: A('-c:a', 'flac'),
  ogg: A('-c:a', 'libvorbis', '-q:a', '5', '-f', 'ogg'),
  oga: A('-c:a', 'libvorbis', '-q:a', '5', '-f', 'ogg'),
  m4a: A('-c:a', 'aac', '-b:a', '192k', '-f', 'ipod'),
  m4b: A('-c:a', 'aac', '-b:a', '128k', '-f', 'ipod'),
  wma: A('-c:a', 'wmav2', '-b:a', '192k', '-f', 'asf'),
  aiff: A('-c:a', 'pcm_s16be', '-f', 'aiff'),
  aifc: A('-c:a', 'pcm_s16be', '-f', 'aiff'),
  opus: A('-c:a', 'libopus', '-b:a', '128k', '-f', 'opus'),
  ac3: A('-c:a', 'ac3', '-b:a', '192k', '-f', 'ac3'),
  alac: A('-c:a', 'alac', '-f', 'ipod'),
  au: A('-c:a', 'pcm_s16be', '-f', 'au'),
  caf: A('-c:a', 'pcm_s16le', '-f', 'caf'),
  voc: A('-c:a', 'pcm_u8', '-ar', '22050', '-ac', '1', '-f', 'voc'),
  weba: A('-c:a', 'libopus', '-b:a', '128k', '-f', 'webm'),
};
const ALAC_EXT = 'm4a'; // ALAC lives in an MP4 container; players expect .m4a

const VIDEO = {
  mp4: [...X264, ...AAC, '-movflags', '+faststart', '-f', 'mp4'],
  m4v: [...X264, ...AAC, '-movflags', '+faststart', '-f', 'mp4'],
  mov: [...X264, ...AAC, '-f', 'mov'],
  mkv: [...X264, ...AAC, '-f', 'matroska'],
  webm: ['-c:v', 'libvpx-vp9', '-crf', '33', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '128k', '-f', 'webm'],
  avi: ['-c:v', 'mpeg4', '-q:v', '4', '-vf', EVEN, '-c:a', 'libmp3lame', '-q:a', '4', '-f', 'avi'],
  flv: [...X264, ...AAC, '-ar', '44100', '-f', 'flv'],
  wmv: ['-c:v', 'wmv2', '-q:v', '4', '-vf', EVEN, '-c:a', 'wmav2', '-b:a', '160k', '-f', 'asf'],
  mpeg: ['-c:v', 'mpeg2video', '-q:v', '4', '-vf', EVEN, '-c:a', 'mp2', '-b:a', '192k', '-f', 'mpeg'],
  mpg: ['-c:v', 'mpeg2video', '-q:v', '4', '-vf', EVEN, '-c:a', 'mp2', '-b:a', '192k', '-f', 'mpeg'],
  mod: ['-c:v', 'mpeg2video', '-q:v', '4', '-vf', EVEN, '-c:a', 'mp2', '-b:a', '192k', '-f', 'mpeg'],
  vob: ['-c:v', 'mpeg2video', '-q:v', '4', '-vf', EVEN, '-c:a', 'ac3', '-b:a', '192k', '-f', 'vob'],
  '3gp': ['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-vf', EVEN, '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-f', '3gp'],
  '3gpp': ['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-vf', EVEN, '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-f', '3gp'],
  '3g2': ['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-vf', EVEN, '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-f', '3g2'],
  ogv: ['-c:v', 'libtheora', '-q:v', '6', '-c:a', 'libvorbis', '-q:a', '4', '-f', 'ogg'],
  ts: [...X264, ...AAC, '-f', 'mpegts'],
  mts: [...X264, ...AAC, '-f', 'mpegts'],
  m2ts: [...X264, ...AAC, '-mpegts_m2ts_mode', '1', '-f', 'mpegts'],
  mxf: ['-c:v', 'mpeg2video', '-q:v', '3', '-vf', EVEN, '-c:a', 'pcm_s16le', '-ar', '48000', '-f', 'mxf'],
  dv: ['-vf', 'scale=720:576,setsar=16/15', '-r', '25', '-c:v', 'dvvideo', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-f', 'dv'],
  rm: ['-c:v', 'rv20', '-q:v', '4', '-vf', 'scale=trunc(iw/4)*4:trunc(ih/4)*4', '-c:a', 'ac3', '-b:a', '128k', '-f', 'rm'],
  rmvb: ['-c:v', 'rv20', '-q:v', '4', '-vf', 'scale=trunc(iw/4)*4:trunc(ih/4)*4', '-c:a', 'ac3', '-b:a', '128k', '-f', 'rm'],
  swf: ['-c:v', 'flv1', '-q:v', '4', '-vf', EVEN, '-c:a', 'libmp3lame', '-ar', '44100', '-f', 'swf'],
  wtv: ['-c:v', 'mpeg2video', '-q:v', '4', '-vf', EVEN, '-c:a', 'ac3', '-b:a', '192k', '-f', 'wtv'],
  gif: ['-vf', 'fps=12,scale=min(480\\,iw):-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer', '-loop', '0', '-an', '-f', 'gif'],
  webp: ['-vf', 'fps=12,scale=min(480\\,iw):-1:flags=lanczos', '-c:v', 'libwebp_anim', '-quality', '70', '-loop', '0', '-an', '-f', 'webp'],
};

const RECIPES = { ...AUDIO, ...VIDEO };
const OUTPUTS = Object.keys(RECIPES);

async function convertMedia({ buffer, inputExt, to }) {
  const target = to.id;
  if (FRAME_ARGS[target]) {
    return job(async (dir) => {
      const input = path.join(dir, `input.${inputExt}`);
      await fs.writeFile(input, buffer);
      return videoFrames(dir, input, target);
    });
  }
  const recipe = RECIPES[target];
  if (!recipe) throw new UserError(`Converting to ${to.label} is not supported yet.`);
  return job(async (dir) => {
    const input = path.join(dir, `input.${inputExt}`);
    const outExt = target === 'alac' ? ALAC_EXT : to.extension;
    const output = path.join(dir, `output.${outExt}`);
    await fs.writeFile(input, buffer);
    const isAudioOut = !!AUDIO[target];
    try {
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input,
        // Video: drop subtitle and data tracks. Picture subtitles (Blu-ray PGS, DVD) cannot be
        // re-encoded into most targets and would fail the whole conversion.
        ...(isAudioOut ? [] : ['-map_metadata', '-1', '-sn', '-dn']), ...recipe, output]);
    } catch (e) {
      if (/does not contain any stream|Output file .* does not contain|matches no streams/i.test(e.stderr || '')) {
        throw new UserError(isAudioOut ? 'This file has no audio track to convert.' : 'This file has no video track to convert.');
      }
      if (/Invalid data found|could not find codec|Unknown format/i.test(e.stderr || '')) {
        throw new UserError('This file could not be read. It may be damaged or use a codec FFmpeg does not support.', 415);
      }
      throw e;
    }
    return { buffer: await fs.readFile(output), ext: outExt };
  });
}

module.exports = { convertMedia, FRAME_MAX, OUTPUTS, AUDIO_OUTPUTS: Object.keys(AUDIO), VIDEO_OUTPUTS: Object.keys(VIDEO) };
