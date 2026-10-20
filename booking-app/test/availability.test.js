'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { serviceSlots, classesOn } = require('../lib/availability');
const { nowIn } = require('../lib/time');

function db(overrides = {}) {
  return {
    business: { slotStep: 30, bookingWindowDays: 7, minNoticeMinutes: 60, hours: { mon: [['10:00', '13:00'], ['14:00', '16:00']] }, closedDates: [], ...overrides },
    staff: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', daysOff: ['mon'] }],
    services: [],
    classes: [],
    bookings: [],
  };
}
const svc = { id: 's', duration: 60, staffIds: [] };
const MONDAY = '2026-10-19';
const early = { date: '2026-10-18', minutes: 0 };

test('slots fit inside each opening range and skip the break', () => {
  const slots = serviceSlots(db(), { service: svc, date: MONDAY, now: early });
  assert.deepEqual(slots.map((s) => s.time), ['10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00']);
});

test('staff on their day off are never offered', () => {
  const slots = serviceSlots(db(), { service: svc, date: MONDAY, now: early });
  assert.ok(slots.every((s) => s.staffIds.length === 1 && s.staffIds[0] === 'a'));
});

test('existing bookings block every overlapping start', () => {
  const d = db();
  d.bookings.push({ type: 'service', staffId: 'a', date: MONDAY, start: '11:00', end: '12:00', status: 'confirmed' });
  d.bookings.push({ type: 'service', staffId: 'a', date: MONDAY, start: '14:00', end: '15:00', status: 'cancelled' });
  const times = serviceSlots(d, { service: svc, date: MONDAY, now: early }).map((s) => s.time);
  assert.deepEqual(times, ['10:00', '12:00', '14:00', '14:30', '15:00']);
});

test('minimum notice applies today, and past or far dates are closed', () => {
  const d = db();
  const times = serviceSlots(d, { service: svc, date: MONDAY, now: { date: MONDAY, minutes: 10 * 60 + 5 } }).map((s) => s.time);
  assert.equal(times[0], '11:30');
  assert.deepEqual(serviceSlots(d, { service: svc, date: '2026-10-12', now: early }), []);
  assert.deepEqual(serviceSlots(d, { service: svc, date: '2026-11-30', now: early }), []);
});

test('admins can book the current slot and beyond the public window', () => {
  const d = db();
  const now = { date: MONDAY, minutes: 10 * 60 + 5 };
  assert.equal(serviceSlots(d, { service: svc, date: MONDAY, now, asAdmin: true })[0].time, '10:00');
  assert.ok(serviceSlots(d, { service: svc, date: '2026-11-30', now: early, asAdmin: true }).length > 0);
});

test('closed dates have no slots', () => {
  assert.deepEqual(serviceSlots(db({ closedDates: [MONDAY] }), { service: svc, date: MONDAY, now: early }), []);
});

test('classes report spots left and whether they started', () => {
  const d = db();
  d.classes.push({ id: 'c', weekday: 1, start: '10:00', duration: 45, capacity: 2, active: true });
  d.bookings.push({ type: 'class', classId: 'c', date: MONDAY, status: 'confirmed' });
  const [c] = classesOn(d, MONDAY, { date: MONDAY, minutes: 9 * 60 });
  assert.equal(c.spotsLeft, 1);
  assert.equal(c.end, '10:45');
  assert.equal(c.started, false);
  assert.equal(classesOn(d, MONDAY, { date: MONDAY, minutes: 10 * 60 })[0].started, true);
});

test('nowIn reads the clock in the business time zone', () => {
  assert.deepEqual(nowIn('Asia/Karachi', new Date('2026-10-19T20:30:00Z')), { date: '2026-10-20', minutes: 90 });
});
