'use strict';
// Builds a small, real sample file for every format the live conversions accept, using the
// same tools the server uses (plus a few helpers such as genisoimage and dpkg-deb). Samples are
// made once per test run and cached in a temp directory. Formats whose tools are missing are
// reported as unavailable so the tests can skip them.

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const registry = require('../registry');
const { getHandler } = require('../engines');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'squish-samples-'));
const cache = new Map();
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: DIR, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const file = (name) => path.join(DIR, name);

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#e5322d"/><circle cx="60" cy="40" r="24" fill="#fff"/></svg>';
const MD = '# Quarterly report\n\nRevenue grew **12%** this quarter.\n\n| Region | Sales |\n|---|---|\n| North | 120 |\n| South | 95 |\n';
const FODP = `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0" office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.presentation">
<office:body><office:presentation>
<draw:page draw:name="One"><draw:frame svg:x="2cm" svg:y="2cm" svg:width="20cm" svg:height="3cm"><draw:text-box><text:p>Slide one</text:p></draw:text-box></draw:frame></draw:page>
<draw:page draw:name="Two"><draw:frame svg:x="2cm" svg:y="2cm" svg:width="20cm" svg:height="3cm"><draw:text-box><text:p>Slide two</text:p></draw:text-box></draw:frame></draw:page>
</office:presentation></office:body></office:document>`;

// Convert an existing sample with the server's own handler (the tests check that path separately).
async function via(fromId, toId, handlerOverride) {
  const from = registry.getFormat(fromId), to = registry.getFormat(toId);
  const c = registry.getConverter(from, to);
  const handler = getHandler(handlerOverride || (c && c.handler));
  const res = await handler({ buffer: await sample(fromId), inputExt: fromId, format: to.apiFormat, quality: 80, maxDim: 0, from, to, filename: `sample.${from.extension}` }, c || { pipeline: { decode: 'sharp' } });
  return Buffer.isBuffer(res) ? res : res.buffer;
}

// Makes a little folder of files for the archive samples.
function archiveTree() {
  const t = file('tree');
  if (!fs.existsSync(t)) {
    fs.mkdirSync(path.join(t, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(t, 'readme.txt'), 'hello archive\n'.repeat(50));
    fs.writeFileSync(path.join(t, 'docs', 'notes.md'), MD);
  }
  return t;
}

const MAKERS = {
  // images
  png: () => require('sharp')({ create: { width: 96, height: 64, channels: 4, background: { r: 229, g: 50, b: 45, alpha: 1 } } }).png().toBuffer(),
  jpg: async () => require('sharp')(await sample('png')).jpeg().toBuffer(),
  jfif: () => sample('jpg'),
  webp: async () => require('sharp')(await sample('png')).webp().toBuffer(),
  avif: async () => require('sharp')(await sample('png')).avif().toBuffer(),
  tiff: async () => require('sharp')(await sample('png')).tiff().toBuffer(),
  gif: async () => require('sharp')(await sample('png')).gif().toBuffer(),
  bmp: async () => { fs.writeFileSync(file('s.png'), await sample('png')); sh('convert', ['s.png', 'bmp3:s.bmp']); return fs.readFileSync(file('s.bmp')); },
  svg: () => Buffer.from(SVG),
  svgz: () => zlib.gzipSync(Buffer.from(SVG)),
  psd: async () => { fs.writeFileSync(file('p.png'), await sample('png')); sh('convert', ['p.png', 'p.psd']); return fs.readFileSync(file('p.psd')); },
  ico: () => via('png', 'ico', 'image'),
  ppm: async () => { fs.writeFileSync(file('m.png'), await sample('png')); sh('convert', ['m.png', 'm.ppm']); return fs.readFileSync(file('m.ppm')); },
  // Making HEIC needs an HEVC encoder, which servers do not need (they only decode), so a small
  // real HEIC file is kept in the repo: the test then checks decoding on any machine.
  heic: () => fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.heic')),
  heif: () => sample('heic'),
  // vector
  eps: () => vec('eps'), ps: () => vec('ps'), emf: () => vec('emf'), wmf: () => vec('wmf'), dxf: () => vec('dxf'),
  ai: () => vec('pdf'), // AI files are read through their PDF compatibility stream
  // audio / video
  mp4: () => { sh('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=176x144:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'v.mp4']); return fs.readFileSync(file('v.mp4')); },
  wav: () => { sh('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', 'a.wav']); return fs.readFileSync(file('a.wav')); },
  // documents
  md: () => Buffer.from(MD),
  txt: () => Buffer.from('Quarterly report\n\nRevenue grew 12% this quarter.\n'),
  html: () => Buffer.from('<!doctype html><html><head><title>Report</title></head><body><h1>Quarterly report</h1><p>Revenue grew <b>12%</b>.</p></body></html>'),
  rst: () => Buffer.from('Quarterly report\n================\n\nRevenue grew **12%** this quarter.\n'),
  tex: () => Buffer.from('\\documentclass{article}\\begin{document}\\section{Quarterly report}Revenue grew 12\\% this quarter.\\end{document}\n'),
  docx: () => { fs.writeFileSync(file('d.md'), MD); sh('pandoc', ['d.md', '-o', 'd.docx']); return fs.readFileSync(file('d.docx')); },
  epub: () => { fs.writeFileSync(file('e.md'), MD); sh('pandoc', ['e.md', '-s', '--metadata', 'title=Report', '-o', 'e.epub']); return fs.readFileSync(file('e.epub')); },
  csv: () => Buffer.from('Region,Sales\nNorth,120\nSouth,95\n'),
  odp: async () => {
    const { convertOffice } = require('../engines/office');
    return (await convertOffice({ buffer: Buffer.from(FODP), inputExt: 'fodp', from: registry.getFormat('odp'), to: registry.getFormat('odp') })).buffer;
  },
  pdf: () => via('docx', 'pdf'),
  djvu: async () => { fs.writeFileSync(file('j.png'), await sample('png')); sh('convert', ['j.png', 'j.ppm']); sh('c44', ['j.ppm', 'j.djvu']); return fs.readFileSync(file('j.djvu')); },
  cbz: async () => { const JSZip = require('jszip'); const z = new JSZip(); z.file('page-01.jpg', await sample('jpg')); z.file('page-02.jpg', await sample('jpg')); return z.generateAsync({ type: 'nodebuffer' }); },
  azw: () => sample('mobi'), prc: () => sample('mobi'),
  // fonts
  ttf: () => fs.readFileSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
  otf: () => fs.readFileSync(findCffFont()),
  woff: () => via('ttf', 'woff'),
  woff2: () => via('ttf', 'woff2'),
  'woff-cff': () => via('otf', 'woff'), // a WOFF that wraps an OpenType (CFF) font
  'woff2-cff': () => via('otf', 'woff2'),
  // archives
  tar: () => { sh('bsdtar', ['--format', 'pax', '-cf', 's.tar', '-C', archiveTree(), '.']); return fs.readFileSync(file('s.tar')); },
  zip: () => { sh('bsdtar', ['--format', 'zip', '-cf', 's.zip', '-C', archiveTree(), '.']); return fs.readFileSync(file('s.zip')); },
  jar: () => sample('zip'),
  '7z': () => { sh('bsdtar', ['--format', '7zip', '-cf', 's.7z', '-C', archiveTree(), '.']); return fs.readFileSync(file('s.7z')); },
  'tar-gz': () => { sh('bsdtar', ['-czf', 's.tgz', '-C', archiveTree(), '.']); return fs.readFileSync(file('s.tgz')); },
  'tar-bz2': () => { sh('bsdtar', ['-cjf', 's.tbz2', '-C', archiveTree(), '.']); return fs.readFileSync(file('s.tbz2')); },
  'tar-xz': () => { sh('bsdtar', ['-cJf', 's.txz', '-C', archiveTree(), '.']); return fs.readFileSync(file('s.txz')); },
  'tar-z': async () => sh('compress', ['-c'], { input: await sample('tar'), stdio: ['pipe', 'pipe', 'pipe'] }),
  'tar-lzo': async () => sh('lzop', ['-c'], { input: await sample('tar'), stdio: ['pipe', 'pipe', 'pipe'] }),
  'tar-7z': async () => { fs.writeFileSync(file('t7.tar'), await sample('tar')); sh('7z', ['a', '-bd', 't7.tar.7z', 't7.tar']); return fs.readFileSync(file('t7.tar.7z')); },
  gz: () => sh('gzip', ['-c', path.join(archiveTree(), 'readme.txt')]),
  bz2: () => sh('bzip2', ['-c', path.join(archiveTree(), 'readme.txt')]),
  xz: () => sh('xz', ['-c', path.join(archiveTree(), 'readme.txt')]),
  lz: () => sh('lzip', ['-c', path.join(archiveTree(), 'readme.txt')]),
  lzma: () => sh('xz', ['--format=lzma', '-c', path.join(archiveTree(), 'readme.txt')]),
  lzo: () => sh('lzop', ['-c', path.join(archiveTree(), 'readme.txt')]),
  z: () => sh('compress', ['-c', path.join(archiveTree(), 'readme.txt')]),
  cpio: () => { sh('bsdtar', ['--format', 'cpio', '-cf', 's.cpio', '-C', archiveTree(), '.']); return fs.readFileSync(file('s.cpio')); },
  iso: () => { sh('bsdtar', ['--format', 'iso9660', '-cf', 's.iso', '-C', archiveTree(), '.']); return fs.readFileSync(file('s.iso')); },
  deb: () => {
    const root = file('debpkg');
    fs.mkdirSync(path.join(root, 'DEBIAN'), { recursive: true });
    fs.mkdirSync(path.join(root, 'usr', 'share', 'doc', 'sample'), { recursive: true });
    fs.writeFileSync(path.join(root, 'DEBIAN', 'control'), 'Package: sample\nVersion: 1.0\nArchitecture: all\nMaintainer: Test <t@example.com>\nDescription: sample\n');
    fs.writeFileSync(path.join(root, 'usr', 'share', 'doc', 'sample', 'readme.txt'), 'hello\n');
    sh('dpkg-deb', ['--build', '--root-owner-group', root, 's.deb']);
    return fs.readFileSync(file('s.deb'));
  },
};

function findCffFont() {
  const roots = ['/usr/share/fonts/opentype', '/usr/share/fonts'];
  const stack = roots.filter((r) => fs.existsSync(r));
  while (stack.length) {
    const d = stack.pop();
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (/\.otf$/i.test(ent.name)) {
        const fd = fs.openSync(p, 'r'); const b = Buffer.alloc(4); fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd);
        if (b.toString('latin1') === 'OTTO') return p;
      }
    }
  }
  throw new Error('no CFF .otf font found');
}

async function vec(ext) {
  const svg = file('base.svg');
  fs.writeFileSync(svg, SVG);
  sh('inkscape', [svg, `--export-filename=${file(`base.${ext}`)}`, '--export-overwrite'], { env: { ...process.env, HOME: DIR } });
  return fs.readFileSync(file(`base.${ext}`));
}

// Formats with no maker are produced by converting from a format that has one.
const DERIVE = {
  video: ['mp4', (id) => via('mp4', id)],
  audio: ['wav', (id) => via('wav', id)],
  document: ['docx', (id) => via('docx', id)],
  spreadsheet: ['csv', (id) => via('csv', id)],
  presentation: ['odp', (id) => via('odp', id)],
  ebook: ['epub', (id) => via('epub', id)],
};

async function sample(id) {
  if (!cache.has(id)) {
    cache.set(id, (async () => {
      if (MAKERS[id]) return Buffer.from(await MAKERS[id]());
      const f = registry.getFormat(id);
      for (const cat of [f.category, ...f.categories]) if (DERIVE[cat]) return Buffer.from(await DERIVE[cat][1](id));
      throw new Error(`no way to make a ${id} sample`);
    })());
  }
  return cache.get(id);
}

function cleanup() { fs.rmSync(DIR, { recursive: true, force: true }); }

module.exports = { sample, cleanup, DIR };
