'use strict';
// Ratings from the "How was your experience?" popup (public/script.js): stars 1-5 and an
// optional comment, kept in DATA_DIR/feedback.json (newest 2000) for the owner's dashboard.
// Nothing personal is stored: the page, the country and the time.

const fs = require('fs');
const path = require('path');
const store = require('./store');

const FILE = path.join(store.DATA_DIR, 'feedback.json');
const KEEP = 2000;
let list = null;

function load() {
  if (list) return list;
  try { list = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  return list;
}

function add({ rating, text, page, country }) {
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) return false;
  load().unshift({ t: Date.now(), r, c: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1000), p: String(page || '').slice(0, 120), cc: String(country || '').slice(0, 2) });
  if (list.length > KEEP) list.length = KEEP;
  try {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(list));
    fs.renameSync(`${FILE}.tmp`, FILE);
  } catch (e) { console.error('Could not save feedback:', e.message); }
  return true;
}

/** { count, average, stars: {1..5: n}, recent: [{t, r, c, p, cc}] } */
function summary() {
  const all = load();
  const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const f of all) stars[f.r]++;
  const count = all.length;
  const average = count ? all.reduce((s, f) => s + f.r, 0) / count : 0;
  return { count, average, stars, recent: all.slice(0, 30) };
}

module.exports = { add, summary, _reset: () => { list = null; } };
