'use strict';
// Shared plumbing for server-side processing:
//   - every job gets its own private temp folder, always deleted afterwards
//   - commands run without a shell (argument arrays; file names are ours, never the visitor's)
//   - a timeout kills the whole process group
//   - at most MAX_JOBS jobs run at once; the rest wait in a queue
// Errors meant for the visitor are thrown as UserError and shown as-is by the API.

const fs = require('fs/promises');
const fss = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');

const PREFIX = 'pdfkaro-';

class UserError extends Error {
  constructor(message, statusCode = 422) { super(message); this.userMessage = message; this.statusCode = statusCode; }
}

// --------------------------------------------------------------- job queue --
let running = 0;
const waiting = [];
async function acquire() {
  if (running < config.MAX_JOBS) { running++; return; }
  if (waiting.length >= config.MAX_QUEUE) {
    throw new UserError('The server is very busy right now. Please try again in a minute.', 503);
  }
  await new Promise((resolve) => waiting.push(resolve));
  running++;
}
function release() {
  running--;
  const next = waiting.shift();
  if (next) next();
}

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), PREFIX));
}
function removeDir(dir) {
  return fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

/** Runs fn() holding a job slot. */
async function withSlot(fn) {
  await acquire();
  try { return await fn(); } finally { release(); }
}

/**
 * Run a command. Resolves with { stdout, stderr }; rejects on non-zero exit or timeout.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{cwd?: string, env?: object, timeoutMs?: number, okCodes?: number[]}} [opts]
 */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd, env: { ...process.env, ...(opts.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    });
    const out = []; const err = [];
    let size = 0; let errSize = 0;
    child.stdout.on('data', (d) => { size += d.length; if (size < 32 * 1024 * 1024) out.push(d); });
    child.stderr.on('data', (d) => { errSize += d.length; if (errSize < 256 * 1024) err.push(d); });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    }, opts.timeoutMs || config.JOB_TIMEOUT_MS);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(err).toString('utf8');
      const stdout = Buffer.concat(out);
      if (timedOut) return reject(new UserError('This file took too long to process. Try a smaller file.', 422));
      if (code === 0 || (opts.okCodes || []).includes(code)) return resolve({ stdout, stderr, code });
      const e = new Error(`${cmd} exited with code ${code}: ${stderr.slice(-1200)}`);
      e.stderr = stderr; e.stdout = stdout.toString('utf8'); e.code = code;
      reject(e);
    });
  });
}

/** All regular files under dir (recursive), sorted naturally. */
async function listFiles(dir) {
  const out = [];
  async function walk(d) {
    for (const ent of await fs.readdir(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (ent.isFile()) out.push(p);
    }
  }
  await walk(dir);
  return out.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

async function assertOutput(file) {
  let st;
  try { st = await fs.stat(file); } catch { throw new Error(`expected output missing: ${path.basename(file)}`); }
  if (!st.size) throw new Error(`empty output: ${path.basename(file)}`);
  if (st.size > config.MAX_OUTPUT_BYTES) throw new UserError('The result is larger than this server can send back.', 413);
  return st.size;
}

/** Zip several files (read from disk) into dest. */
async function zipFiles(files, dest, baseDir) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  let total = 0;
  for (const f of files) {
    total += (await fs.stat(f)).size;
    if (total > config.MAX_OUTPUT_BYTES) throw new UserError('The result is larger than this server can send back.', 413);
    zip.file(path.relative(baseDir, f), fss.createReadStream(f), { binary: true });
  }
  await new Promise((resolve, reject) => {
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'DEFLATE', compressionOptions: { level: 6 } })
      .pipe(fss.createWriteStream(dest)).on('finish', resolve).on('error', reject);
  });
  return dest;
}

/** Delete our temp folders older than maxAgeMs (left behind by a crash or a kill). */
async function sweepTemp(maxAgeMs = 60 * 60 * 1000) {
  const tmp = os.tmpdir();
  let removed = 0;
  for (const name of await fs.readdir(tmp).catch(() => [])) {
    if (!name.startsWith(PREFIX)) continue;
    const p = path.join(tmp, name);
    try {
      const st = await fs.stat(p);
      if (Date.now() - st.mtimeMs > maxAgeMs) { await removeDir(p); removed++; }
    } catch { /* already gone */ }
  }
  return removed;
}

module.exports = { UserError, run, withSlot, makeTempDir, removeDir, listFiles, assertOutput, zipFiles, sweepTemp, PREFIX };
