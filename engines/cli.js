'use strict';
// Shared plumbing for handlers that run command-line tools (FFmpeg, LibreOffice, ...):
//   - every job gets its own temp directory, always deleted afterwards
//   - commands run without a shell (arguments are an array; file names are ours, never the user's)
//   - a timeout kills the whole process group
//   - at most MAX_JOBS conversions run at once; the rest wait in a queue
//
// Errors meant for the visitor are thrown as UserError and shown as-is by the API.

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const MAX_JOBS = Math.max(1, Number(process.env.MAX_JOBS || 2));
const TIMEOUT_MS = Math.max(5, Number(process.env.JOB_TIMEOUT_S || 180)) * 1000;
const MAX_OUTPUT_BYTES = Math.max(1, Number(process.env.MAX_OUTPUT_MB || 500)) * 1024 * 1024;

class UserError extends Error {
  constructor(message, statusCode = 422) { super(message); this.userMessage = message; this.statusCode = statusCode; }
}

// --------------------------------------------------------------- job queue --
let running = 0;
const waiting = [];
async function acquire() {
  if (running < MAX_JOBS) { running++; return; }
  await new Promise((resolve) => waiting.push(resolve));
  running++;
}
function release() {
  running--;
  const next = waiting.shift();
  if (next) next();
}

/** Runs fn(dir) with a fresh temp directory and a job slot; cleans up whatever happens. */
async function job(fn) {
  await acquire();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'squish-'));
  try {
    return await fn(dir);
  } finally {
    release();
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Run a command. Resolves with { stdout, stderr }; rejects on non-zero exit or timeout.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{cwd?: string, env?: object, timeoutMs?: number, input?: Buffer}} [opts]
 */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd, env: { ...process.env, ...(opts.env || {}) },
      stdio: [opts.input ? 'pipe' : 'ignore', 'pipe', 'pipe'], detached: true,
    });
    const out = []; const err = [];
    let size = 0;
    child.stdout.on('data', (d) => { size += d.length; if (size < 64 * 1024 * 1024) out.push(d); });
    child.stderr.on('data', (d) => { if (err.length < 200) err.push(d); });
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      reject(new UserError('This file took too long to convert. Try a smaller or shorter file.', 422));
    }, opts.timeoutMs || TIMEOUT_MS);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(err).toString('utf8');
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr });
      else {
        const e = new Error(`${cmd} exited with code ${code}: ${stderr.slice(-800)}`);
        e.stderr = stderr;
        reject(e);
      }
    });
    if (opts.input) child.stdin.end(opts.input);
  });
}

/** All regular files under dir (recursive), sorted by path. */
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

async function readCapped(file) {
  const st = await fs.stat(file);
  if (st.size > MAX_OUTPUT_BYTES) throw new UserError('The converted file is larger than this server allows.', 413);
  return fs.readFile(file);
}

/** One output file -> { buffer, ext }; several -> a ZIP of them. */
async function collect(files, ext, baseDir) {
  if (!files.length) throw new Error('converter produced no output');
  if (files.length === 1) return { buffer: await readCapped(files[0]), ext };
  const JSZip = require('jszip');
  const zip = new JSZip();
  for (const f of files) zip.file(path.relative(baseDir || path.dirname(f), f), await readCapped(f));
  return { buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), ext: 'zip' };
}

module.exports = { job, run, listFiles, collect, readCapped, UserError, MAX_OUTPUT_BYTES };
