'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function checkPin(pin, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(pin), salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

/**
 * A JSON file is plenty for one shop's bookings. Every write goes to a temp
 * file first and is renamed into place, so a crash never leaves half a file.
 */
function createStore({ file, seed = 'salon', adminPin = '1234' }) {
  let db;
  if (file && fs.existsSync(file)) {
    db = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    const seedFile = path.join(__dirname, '..', 'seed', `${seed}.json`);
    db = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    db.bookings = [];
    db.admin = { pin: hashPin(adminPin) };
  }
  for (const key of ['categories', 'services', 'staff', 'classes', 'plans', 'bookings']) db[key] ||= [];

  function save() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, file);
  }

  save();
  return { get db() { return db; }, save };
}

module.exports = { createStore, hashPin, checkPin };
