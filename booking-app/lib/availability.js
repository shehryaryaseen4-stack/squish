'use strict';

const { DAYS, toMin, fromMin, weekdayOf, addDays } = require('./time');

function workingIntervals(business, staff, date) {
  if ((business.closedDates || []).includes(date)) return [];
  const day = DAYS[weekdayOf(date)];
  if (staff && (staff.daysOff || []).includes(day)) return [];
  const hours = (business.hours && business.hours[day]) || [];
  return hours.map(([a, b]) => [toMin(a), toMin(b)]);
}

function staffForService(db, service) {
  const active = db.staff.filter((s) => s.active !== false);
  if (!service.staffIds || service.staffIds.length === 0) return active;
  return active.filter((s) => service.staffIds.includes(s.id));
}

function busyIntervals(db, staffId, date, ignoreId) {
  return db.bookings
    .filter((b) => b.type === 'service' && b.staffId === staffId && b.date === date
      && b.status === 'confirmed' && (!ignoreId || b.id !== ignoreId))
    .map((b) => [toMin(b.start), toMin(b.end)]);
}

// Earliest minute a customer may book on `date`, or null when the date is out of range.
// Staff (`asAdmin`) may book walk-ins right now and beyond the public window.
function earliestStart(business, date, now, { asAdmin = false } = {}) {
  if (date < now.date) return null;
  if (!asAdmin && date > addDays(now.date, (business.bookingWindowDays || 30) - 1)) return null;
  if (date === now.date) return asAdmin ? now.minutes - (now.minutes % (business.slotStep || 15)) : now.minutes + (business.minNoticeMinutes || 0);
  return 0;
}

/**
 * Open start times for a service on a date. Each slot lists the staff free for
 * the whole duration, so "any professional" can be resolved at booking time.
 */
function serviceSlots(db, { service, staffId, date, now, asAdmin = false, ignoreId }) {
  const business = db.business;
  const earliest = earliestStart(business, date, now, { asAdmin });
  if (earliest === null) return [];
  const step = business.slotStep || 15;
  const duration = service.duration;
  const candidates = staffForService(db, service)
    .filter((s) => !staffId || staffId === 'any' || s.id === staffId);
  const byTime = new Map();
  for (const staff of candidates) {
    const busy = busyIntervals(db, staff.id, date, ignoreId);
    for (const [open, close] of workingIntervals(business, staff, date)) {
      for (let t = Math.ceil(open / step) * step; t + duration <= close; t += step) {
        if (t < earliest) continue;
        if (busy.some(([a, b]) => t < b && t + duration > a)) continue;
        if (!byTime.has(t)) byTime.set(t, []);
        byTime.get(t).push(staff.id);
      }
    }
  }
  return [...byTime.keys()].sort((a, b) => a - b)
    .map((t) => ({ time: fromMin(t), staffIds: byTime.get(t) }));
}

// Among the staff free at a slot, pick whoever has the fewest bookings that day.
function pickStaff(db, staffIds, date) {
  const load = (id) => db.bookings.filter((b) => b.staffId === id && b.date === date && b.status === 'confirmed').length;
  return [...staffIds].sort((a, b) => load(a) - load(b))[0];
}

function classesOn(db, date, now) {
  const wd = weekdayOf(date);
  if ((db.business.closedDates || []).includes(date)) return [];
  return db.classes
    .filter((c) => c.active !== false && c.weekday === wd)
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .map((c) => {
      const booked = db.bookings.filter((b) => b.type === 'class' && b.classId === c.id
        && b.date === date && b.status === 'confirmed').length;
      const started = date < now.date || (date === now.date && toMin(c.start) <= now.minutes);
      return { ...c, end: fromMin(toMin(c.start) + c.duration), booked, spotsLeft: Math.max(0, c.capacity - booked), started };
    });
}

module.exports = { workingIntervals, staffForService, serviceSlots, pickStaff, classesOn, earliestStart };
