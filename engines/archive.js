'use strict';
// Archive conversion: unpack with bsdtar (libarchive) or 7-Zip, repack in the target format.
// Single-file compressors (GZ, BZ2, XZ, LZ, LZMA, LZO, Z) are streamed through their tool.
//
// Safety:
//   - unpacked size is capped (MAX_EXTRACT_MB, default 500) to stop zip bombs
//   - bsdtar refuses absolute paths and ".." by default; after unpacking, anything that
//     resolves outside the job directory (e.g. a symlink) is deleted before repacking
//   - RAR and the other legacy formats are read-only
// RAR and CAB: bsdtar first (it reads RAR5, including solid ones); old solid RAR (v2.9/3/4) is
// opened with unar when bsdtar cannot.

const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const fsSync = require('fs');
const { job, run, listFiles, UserError } = require('./cli');

const has = (bin) => (process.env.PATH || '').split(':').some((d) => { try { fsSync.accessSync(path.join(d, bin), fsSync.constants.X_OK); return true; } catch { return false; } });
const UNAR = has('unar') && has('lsar');
const SEVEN_ZIP = has('7z');
// File names inside archives are usually UTF-8 (Windows names with é, ü, Urdu or Chinese
// letters). Under the C locale of a bare container bsdtar refuses such names ("Pathname cannot be
// converted"), so every archive tool runs with a UTF-8 locale.
const UTF8 = { env: { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } };
const UNAR_FALLBACK = new Set(['rar', 'cab']);

const MAX_EXTRACT = Math.max(1, Number(process.env.MAX_EXTRACT_MB || 500)) * 1024 * 1024;
const TOO_BIG = () => new UserError(`This archive unpacks to more than ${MAX_EXTRACT / 1024 / 1024}MB, which is over this server's limit.`, 413);

// Single-file compressors: [command, decompress args, compress args]
const STREAM = {
  gz: ['gzip', ['-dc'], ['-c', '-9']],
  bz2: ['bzip2', ['-dc'], ['-c', '-9']],
  xz: ['xz', ['-dc'], ['-c', '-6']],
  lz: ['lzip', ['-dc'], ['-c']],
  lzma: ['xz', ['--format=lzma', '-dc'], ['--format=lzma', '-c']],
  lzo: ['lzop', ['-dc'], ['-c']],
  z: ['gzip', ['-dc'], null], // gzip can read .Z; writing .Z is not offered
};

// Formats 7-Zip reads better than libarchive.
const SEVEN_ZIP_IN = new Set(['dmg', 'arj', 'chm', 'lzma']);
// Repack recipes (bsdtar): extra args before -cf
const PACK = {
  zip: ['--format', 'zip'],
  '7z': ['--format', '7zip'],
  tar: ['--format', 'pax'],
  'tar-gz': ['--format', 'pax', '-z'],
  'tar-bz2': ['--format', 'pax', '-j'],
  'tar-xz': ['--format', 'pax', '-J'],
};

/** Pipe a file through a command, refusing to write more than `cap` bytes. */
function pipeThrough(cmd, args, inFile, outFile, cap) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...args, inFile], { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = fsSync.createWriteStream(outFile);
    let n = 0; let killed = false; let err = '';
    child.stdout.on('data', (d) => {
      n += d.length;
      if (n > cap) { killed = true; child.kill('SIGKILL'); return; }
      out.write(d);
    });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => {
      out.end(() => {
        if (killed) return reject(TOO_BIG());
        if (code !== 0) return reject(new UserError('This archive could not be read. It may be damaged.', 415));
        resolve(n);
      });
    });
    child.on('error', reject);
  });
}

async function listedSize(cmd, args) {
  const { stdout } = await run(cmd, args, UTF8);
  const text = stdout.toString();
  if (cmd === '7z') return [...text.matchAll(/^Size = (\d+)/gm)].reduce((s, m) => s + Number(m[1]), 0);
  if (cmd === 'lsar') return [...text.matchAll(/"XADFileSize":\s*(\d+)/g)].reduce((s, m) => s + Number(m[1]), 0);
  // bsdtar -tv: "-rw-r--r--  0 user group  1234 Jan  1 00:00 name"
  return text.split('\n').reduce((s, line) => s + (Number(line.trim().split(/\s+/)[4]) || 0), 0);
}

async function removeEscapes(root) {
  const real = await fs.realpath(root);
  async function walk(d) {
    for (const ent of await fs.readdir(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isSymbolicLink()) {
        const target = await fs.realpath(p).catch(() => null);
        if (!target || !target.startsWith(real + path.sep)) await fs.rm(p, { force: true });
      } else if (ent.isDirectory()) await walk(p);
    }
  }
  await walk(root);
}

// Old Windows ZIPs store names in a legacy code page, not UTF-8. Unpacked, such names are not
// valid UTF-8 and cannot be packed again, so they are renamed (read as Windows-1252).
const validUtf8 = (b) => { try { new TextDecoder('utf-8', { fatal: true }).decode(b); return true; } catch { return false; } };
async function fixNames(dir) {
  for (const name of await fs.readdir(dir, { encoding: 'buffer' })) {
    let full = path.join(dir, name.toString());
    if (!validUtf8(name)) {
      const raw = Buffer.concat([Buffer.from(dir + path.sep), name]);
      const base = new TextDecoder('windows-1252').decode(name).replace(/[/\0]/g, '_') || 'file';
      let fixed = path.join(dir, base);
      for (let n = 2; fsSync.existsSync(fixed); n++) fixed = path.join(dir, `${n}-${base}`);
      await fs.rename(raw, fixed);
      full = fixed;
    }
    if ((await fs.lstat(full)).isDirectory()) await fixNames(full);
  }
}

// "report.pdf.gz" -> "report.pdf"; anything unusable -> "file"
const innerName = (filename) => String(filename || '').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'file';

async function unpack(dir, input, fromId, filename) {
  const x = path.join(dir, 'x');
  await fs.mkdir(x);
  if (STREAM[fromId]) {
    const [cmd, dArgs] = STREAM[fromId];
    await pipeThrough(cmd, dArgs, input, path.join(x, innerName(filename)), MAX_EXTRACT);
    return x;
  }
  if (fromId === 'tar-7z') {
    const mid = path.join(dir, 'mid');
    await fs.mkdir(mid);
    if (await listedSize('7z', ['l', '-slt', input]) > MAX_EXTRACT) throw TOO_BIG();
    await run('7z', ['x', '-y', '-bd', `-o${mid}`, input], UTF8);
    const [tarFile] = await listFiles(mid);
    if (!tarFile) throw new UserError('This archive is empty.');
    return unpackWith(dir, x, tarFile, false);
  }
  const final = (e) => e.statusCode === 413 || /password/.test(e.userMessage || '');
  const fresh = async () => { await fs.rm(x, { recursive: true, force: true }); await fs.mkdir(x); };
  try {
    return await unpackWith(dir, x, input, SEVEN_ZIP_IN.has(fromId));
  } catch (e) {
    if (final(e)) throw e;
    // a second opinion: 7-Zip reads ZIP variants libarchive does not (Deflate64 from Windows,
    // odd headers), then unar for old RAR and CAB
    if (SEVEN_ZIP && !SEVEN_ZIP_IN.has(fromId)) {
      await fresh();
      try { return await unpackWith(dir, x, input, true); } catch (e2) { if (final(e2)) throw e2; }
    }
    if (!UNAR || !UNAR_FALLBACK.has(fromId)) throw e;
    await fresh();
    return unpackWithUnar(x, input);
  }
}

async function unpackWithUnar(x, input) {
  try {
    if (await listedSize('lsar', ['-j', input]) > MAX_EXTRACT) throw TOO_BIG();
    await run('unar', ['-q', '-f', '-D', '-p', '', '-o', x, input], UTF8);
  } catch (e) {
    if (e.userMessage) throw e;
    if (/passw|encrypt/i.test(`${e.stderr || ''}${e.stdout || ''}`)) throw new UserError('This archive is password-protected.');
    throw new UserError('This archive could not be read. It may be damaged or use an unsupported variant.', 415);
  }
  await removeEscapes(x);
  await fixNames(x);
  return x;
}

async function unpackWith(dir, x, input, use7z) {
  try {
    if (use7z) {
      if (await listedSize('7z', ['l', '-slt', input]) > MAX_EXTRACT) throw TOO_BIG();
      await run('7z', ['x', '-y', '-bd', '-snl-', `-o${x}`, input], UTF8);
    } else {
      if (await listedSize('bsdtar', ['-tvf', input]) > MAX_EXTRACT) throw TOO_BIG();
      await run('bsdtar', ['-xf', input, '-C', x, '--no-same-owner', '--no-same-permissions'], UTF8);
    }
  } catch (e) {
    if (e.userMessage) throw e;
    if (/passw|encrypt/i.test(e.stderr || '')) throw new UserError('This archive is password-protected.');
    throw new UserError('This archive could not be read. It may be damaged or use an unsupported variant.', 415);
  }
  await removeEscapes(x);
  await fixNames(x);
  return x;
}

async function convertArchive({ buffer, from, to, filename }) {
  return job(async (dir) => {
    const input = path.join(dir, `input.${from.extension}`);
    await fs.writeFile(input, buffer);
    const x = await unpack(dir, input, from.id, filename);
    const files = await listFiles(x);
    if (!files.length) throw new UserError('This archive is empty.');
    const output = path.join(dir, `output.${to.extension}`);

    if (STREAM[to.id]) {
      if (files.length !== 1) {
        throw new UserError(`${to.label} can hold only one file, but this archive contains ${files.length}. Choose TAR.GZ, ZIP or 7Z instead.`);
      }
      const [cmd, , cArgs] = STREAM[to.id];
      await pipeThrough(cmd, cArgs, files[0], output, Number.MAX_SAFE_INTEGER);
    } else if (to.id === 'tar-7z') {
      const tarFile = path.join(dir, 'bundle.tar');
      await run('bsdtar', ['--format', 'pax', '-cf', tarFile, '-C', x, ...(await fs.readdir(x))], UTF8);
      await run('7z', ['a', '-t7z', '-bd', output, tarFile], UTF8);
    } else if (PACK[to.id]) {
      await run('bsdtar', [...PACK[to.id], '-cf', output, '-C', x, ...(await fs.readdir(x))], UTF8);
    } else {
      throw new UserError(`Creating ${to.label} archives is not supported.`);
    }
    return { buffer: await fs.readFile(output), ext: to.extension };
  });
}

module.exports = { convertArchive, STREAM, PACK };
