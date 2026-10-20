'use strict';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function fromMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
}

function weekdayOf(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The current date and minute-of-day in the business's own time zone, so a
// server running in UTC still offers the right "today" to a shop in Karachi.
function nowIn(timeZone, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

module.exports = { DAYS, toMin, fromMin, isDate, isTime, weekdayOf, addDays, nowIn };

// ---- month helpers used by memberships ----------------------------------

const monthKey = (date) => String(date).slice(0, 7);

function addMonths(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// Every 'YYYY-MM' from the month of `from` to the month of `to`, inclusive.
function monthsBetween(from, to) {
  const out = [];
  let [y, m] = monthKey(from).split('-').map(Number);
  const [ty, tm] = monthKey(to).split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

const monthStart = (key) => `${key}-01`;
const monthEnd = (key) => addDays(addMonths(`${key}-01`, 1), -1);

module.exports.monthKey = monthKey;
module.exports.addMonths = addMonths;
module.exports.diffDays = diffDays;
module.exports.monthsBetween = monthsBetween;
module.exports.monthStart = monthStart;
module.exports.monthEnd = monthEnd;
