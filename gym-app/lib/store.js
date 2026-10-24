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
  // Machines saved before devices had ids and types.
  for (const dv of db.devices) { dv.id ||= `dev-${dv.sn}`; dv.type ||= 'zk-fingerprint'; dv.protocol ||= 'zk'; }
  db.expenseCategories ||= ['Rent', 'Salaries', 'Electricity', 'Equipment', 'Maintenance', 'Other'];

  function save() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, file);
  }

  // Member photos live as files next to the data file; without a data file
  // (tests) they stay inline as data URLs.
  const photoDir = file ? path.join(path.dirname(file), 'photos') : null;
  function savePhoto(memberId, base64) {
    if (!photoDir) return `data:image/jpeg;base64,${base64}`;
    fs.mkdirSync(photoDir, { recursive: true });
    fs.writeFileSync(path.join(photoDir, `${memberId}.jpg`), Buffer.from(base64, 'base64'));
    return `/photos/${memberId}.jpg?v=${Date.now().toString(36)}`;
  }
  function deletePhoto(memberId) {
    if (photoDir) fs.rmSync(path.join(photoDir, `${memberId}.jpg`), { force: true });
  }
  function readPhoto(name) {
    if (!photoDir || !/^[\w-]+\.jpg$/.test(name)) return null;
    try { return fs.readFileSync(path.join(photoDir, name)); } catch { return null; }
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
  return { get db() { return db; }, save, clearData, savePhoto, deletePhoto, readPhoto };
}

module.exports = { createStore, hashPin, checkPin };
