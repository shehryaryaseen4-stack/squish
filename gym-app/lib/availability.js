'use strict';

const { toMin, fromMin, weekdayOf } = require('./time');

// Classes running on a date, with live head counts.
function classesOn(db, date, now) {
  const wd = weekdayOf(date);
  if ((db.business.closedDates || []).includes(date)) return [];
  return db.classes
    .filter((c) => c.active !== false && c.weekday === wd)
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .map((c) => {
      const booked = db.classBookings.filter((b) => b.classId === c.id && b.date === date && b.status === 'booked').length;
      const started = date < now.date || (date === now.date && toMin(c.start) <= now.minutes);
      return { ...c, end: fromMin(toMin(c.start) + c.duration), booked, spotsLeft: Math.max(0, c.capacity - booked), started };
    });
}

module.exports = { classesOn };
