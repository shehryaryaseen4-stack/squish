'use strict';
// Video -> JPG/PNG (engines/media.js): still pictures, one per second for short clips, at most
// FRAME_MAX evenly spaced for long videos, named with their time, and SWF video included.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const JSZip = require('jszip');
const media = require('../engines/media');
const registry = require('../registry');

const has = (bin) => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };
const skip = !(has('ffmpeg') && has('ffprobe')) && 'FFmpeg is not installed';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'squish-frames-'));
test.after(() => fs.rmSync(DIR, { recursive: true, force: true }));
const ff = (...args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
const fmt = (id) => registry.getFormat(id);
const names = async (out) => Object.keys((await JSZip.loadAsync(out.buffer)).files).sort();

test('video to JPG and PNG are live for MP4, MOV and SWF, with indexed pages', () => {
  for (const [f, t] of [['mp4', 'jpg'], ['mov', 'jpg'], ['swf', 'jpg'], ['mp4', 'png'], ['swf', 'png']]) {
    assert.ok(registry.getConverter(fmt(f), fmt(t)), `${f} -> ${t}`);
  }
  const pages = require('../pages');
  for (const p of ['/mp4-to-jpg', '/swf-to-jpg', '/video-to-jpg', '/guides/save-pictures-from-video']) {
    assert.ok(pages.sitemap('https://example.com').includes(`https://example.com${p}<`), p);
  }
});

test('a short MP4 gives one full-size JPG per second, named by time', { skip, timeout: 60000 }, async () => {
  const file = path.join(DIR, 'short.mp4');
  ff('-f', 'lavfi', '-i', 'testsrc=duration=5:size=320x240:rate=25', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file);
  const out = await media.convertMedia({ buffer: fs.readFileSync(file), inputExt: 'mp4', to: fmt('jpg') });
  assert.equal(out.ext, 'zip');
  const list = await names(out);
  assert.deepEqual(list, ['frame-001-0m00s.jpg', 'frame-002-0m01s.jpg', 'frame-003-0m02s.jpg', 'frame-004-0m03s.jpg', 'frame-005-0m04s.jpg']);
  const zip = await JSZip.loadAsync(out.buffer);
  const jpg = await zip.file(list[0]).async('nodebuffer');
  const meta = await require('sharp')(jpg).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 320);
});

test('a long video gives FRAME_MAX evenly spaced pictures; a 1-frame clip a single picture', { skip, timeout: 120000 }, async () => {
  const long = path.join(DIR, 'long.mp4');
  ff('-f', 'lavfi', '-i', 'testsrc=duration=150:size=64x48:rate=5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', long);
  const list = await names(await media.convertMedia({ buffer: fs.readFileSync(long), inputExt: 'mp4', to: fmt('jpg') }));
  assert.equal(list.length, media.FRAME_MAX);
  assert.match(list.at(-1), /^frame-060-2m2\ds\.jpg$/);
  const tiny = path.join(DIR, 'tiny.mp4');
  ff('-f', 'lavfi', '-i', 'testsrc=duration=0.5:size=64x48:rate=10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', tiny);
  const one = await media.convertMedia({ buffer: fs.readFileSync(tiny), inputExt: 'mp4', to: fmt('png') });
  assert.equal(one.ext, 'png');
  assert.equal(one.buffer.readUInt32BE(0), 0x89504e47);
});

test('SWF video to PNG; a file with no video is refused with advice', { skip, timeout: 60000 }, async () => {
  const swf = path.join(DIR, 'v.swf');
  ff('-f', 'lavfi', '-i', 'testsrc=duration=3:size=160x120:rate=12', '-c:v', 'flv1', '-f', 'swf', swf);
  const list = await names(await media.convertMedia({ buffer: fs.readFileSync(swf), inputExt: 'swf', to: fmt('png') }));
  assert.equal(list.length, 3);
  assert.ok(list.every((n) => n.endsWith('.png')));
  const audio = path.join(DIR, 'a.mp4');
  ff('-f', 'lavfi', '-i', 'sine=d=2', '-c:a', 'aac', audio);
  await assert.rejects(media.convertMedia({ buffer: fs.readFileSync(audio), inputExt: 'mp4', to: fmt('jpg') }), (e) => /no video pictures/.test(e.userMessage || ''));
});
