'use strict';
// Which command-line tools are installed on this machine. The registry uses this to switch
// conversions on only where their engine is really available, so the site never offers a
// conversion the server cannot perform.
//
//   SQUISH_DETECT=0          pretend no system tools are installed (used by deterministic tests)
//   SQUISH_DISABLE=a,b       treat these binaries as missing (e.g. to switch off heavy video work)

const fs = require('fs');
const path = require('path');

const disabled = new Set(String(process.env.SQUISH_DISABLE || '').split(',').map((s) => s.trim()).filter(Boolean));
const cache = new Map();

function findBin(name) {
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    const p = path.join(d, name);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* keep looking */ }
  }
  return null;
}

/**
 * True when every file in `files` exists next to the real (symlink-resolved) binary.
 * Used for LibreOffice, whose `soffice` exists even when Writer/Calc/Impress are not installed.
 */
function hasFilesNextTo(bin, files) {
  if (!hasBin(bin)) return false;
  let dir;
  try { dir = path.dirname(fs.realpathSync(findBin(bin))); } catch { return false; }
  return files.every((f) => fs.existsSync(path.join(dir, f)));
}

function hasBin(name) {
  if (process.env.SQUISH_DETECT === '0' || disabled.has(name)) return false;
  if (!cache.has(name)) cache.set(name, !!findBin(name));
  return cache.get(name);
}

module.exports = { hasBin, hasFilesNextTo };
