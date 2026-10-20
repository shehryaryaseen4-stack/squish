'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { generateDemo } = require('./demo');
const { nowIn } = require('./time');

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function checkPin(pin, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(pin), salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

const DATA = ['members', 'payments', 'attendance', 'measurements', 'expenses', 'leads', 'classBookings'];
const CONFIG = ['plans', 'staff', 'classes'];

/**
 * One JSON file holds the whole gym. Every write goes to a temp file first and
 * is renamed into place, so a crash never leaves half a file.
 */
function createStore({ file, seed = 'demo', ownerPin = '1234', staffPin = '0000', now = () => new Date() }) {
  let db;
  if (file && fs.existsSync(file)) {
    db = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'gym.json'), 'utf8'));
    for (const key of DATA) db[key] = [];
    db.admin = { ownerPin: hashPin(ownerPin), staffPin: hashPin(staffPin), sessions: [] };
    db.memberSessions = [];
    db.devices = [];
    db.receiptSeq = 1;
    db.memberSeq = 1001;
    if (seed === 'demo') generateDemo(db, nowIn(db.business.timeZone, now()), { memberPin: hashPin('1111') });
  }
  for (const key of [...DATA, ...CONFIG, 'memberSessions', 'devices']) db[key] ||= [];
  db.expenseCategories ||= ['Rent', 'Salaries', 'Electricity', 'Equipment', 'Maintenance', 'Other'];

  function save() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, file);
  }

  // Wipes members, money and attendance but keeps the gym's own settings.
  function clearData() {
    for (const key of DATA) db[key] = [];
    db.memberSessions = [];
    db.receiptSeq = 1;
    db.memberSeq = 1001;
    db.demo = false;
    save();
  }

  save();
  return { get db() { return db; }, save, clearData };
}

module.exports = { createStore, hashPin, checkPin };
