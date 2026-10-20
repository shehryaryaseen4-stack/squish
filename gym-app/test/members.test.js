'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../lib/members');
const { addMonths, monthsBetween } = require('../lib/time');

function gym() {
  return { business: { expiringDays: 7 }, members: [], payments: [], attendance: [] };
}
const member = (extra = {}) => ({ id: 'm1', joinDate: '2026-01-10', freezes: [], ...extra });
const pay = (start, end, total = 5000, paid = total, months = 1) => ({
  id: `p-${start}`, memberId: 'm1', planName: 'Monthly', months, periodStart: start, periodEnd: end, total, installments: paid ? [{ amount: paid, date: start }] : [], date: start,
});
const visit = (date) => ({ id: `v-${date}`, memberId: 'm1', date, in: '18:00', out: '19:15' });

test('addMonths keeps the day, clamping to the end of short months', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.deepEqual(monthsBetween('2025-12-20', '2026-02-01'), ['2025-12', '2026-01', '2026-02']);
});

test('status follows the fee period: active, expiring, expired, unpaid', () => {
  const d = gym();
  const m = member();
  assert.equal(summarize(d, m, '2026-03-01').status, 'unpaid');
  d.payments.push(pay('2026-02-10', '2026-03-09'));
  assert.equal(summarize(d, m, '2026-02-20').status, 'active');
  const s = summarize(d, m, '2026-03-05');
  assert.equal(s.status, 'expiring');
  assert.equal(s.daysLeft, 4);
  assert.equal(summarize(d, m, '2026-03-10').status, 'expired');
  assert.equal(summarize(d, { ...m, left: true }, '2026-02-20').status, 'left');
});

test('a freeze pushes the expiry back and shows as frozen', () => {
  const d = gym();
  d.payments.push(pay('2026-02-10', '2026-03-09'));
  const m = member({ freezes: [{ from: '2026-02-20', to: '2026-02-26' }] });
  assert.equal(summarize(d, m, '2026-02-22').status, 'frozen');
  assert.equal(summarize(d, m, '2026-03-01').expiry, '2026-03-16');
});

test('balance counts unpaid parts of every receipt', () => {
  const d = gym();
  d.payments.push(pay('2026-01-10', '2026-02-09', 7000, 7000), pay('2026-02-10', '2026-03-09', 5000, 2000));
  const s = summarize(d, member(), '2026-02-15');
  assert.equal(s.balance, 3000);
  assert.equal(s.totalPaid, 9000);
});

test('month timeline shows months paid, months attended and months missed', () => {
  const d = gym();
  // Paid Jan and Mar, skipped Feb. Came in Jan and Mar, nothing in Feb or Apr.
  d.payments.push(pay('2026-01-10', '2026-02-09'), pay('2026-03-15', '2026-04-14'));
  d.attendance.push(visit('2026-01-12'), visit('2026-01-15'), visit('2026-03-20'));
  const s = summarize(d, member(), '2026-05-02', undefined, { timeline: true });
  assert.equal(s.monthsMember, 5);
  assert.equal(s.monthsAttended, 2);
  assert.equal(s.monthsMissed, 2);
  assert.deepEqual(s.months.map((x) => x.paid), [true, true, true, true, false]);
  assert.equal(s.monthsUnpaid, 1);
  assert.equal(s.totalVisits, 3);
  assert.equal(s.avgMinutes, 75);
  assert.equal(s.lastVisit, '2026-03-20');
});
