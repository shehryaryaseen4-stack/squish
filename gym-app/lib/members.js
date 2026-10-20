'use strict';

const { addDays, diffDays, monthKey, monthsBetween, monthStart, monthEnd } = require('./time');

const sum = (list, f) => list.reduce((a, x) => a + (f(x) || 0), 0);
const paidOf = (p) => sum(p.installments || [], (i) => i.amount);

/**
 * Index payments and attendance by member once, so summarising every member
 * for the list view stays linear in the size of the data.
 */
function indexDb(db) {
  const payments = new Map();
  const visits = new Map();
  for (const p of db.payments) {
    if (!payments.has(p.memberId)) payments.set(p.memberId, []);
    payments.get(p.memberId).push(p);
  }
  for (const v of db.attendance) {
    if (!visits.has(v.memberId)) visits.set(v.memberId, []);
    visits.get(v.memberId).push(v);
  }
  return { payments, visits };
}

function freezeDays(member, until) {
  return sum(member.freezes || [], (f) => (until && f.from <= until ? diffDays(f.from, f.to) + 1 : 0));
}

/**
 * Everything the dashboard shows about one member: membership status, expiry,
 * dues, and a month-by-month record of whether they paid and whether they came.
 */
function summarize(db, member, today, index = indexDb(db), { timeline = false } = {}) {
  const settings = db.business;
  const payments = (index.payments.get(member.id) || []).slice().sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const visits = index.visits.get(member.id) || [];

  const baseExpiry = payments.reduce((max, p) => (p.periodEnd > max ? p.periodEnd : max), '');
  const expiry = baseExpiry ? addDays(baseExpiry, freezeDays(member, baseExpiry)) : null;
  const frozen = (member.freezes || []).find((f) => f.from <= today && today <= f.to) || null;
  const daysLeft = expiry ? diffDays(today, expiry) : null;
  const balance = sum(payments, (p) => p.total - paidOf(p));
  const totalPaid = sum(payments, paidOf);
  const last = payments[payments.length - 1];

  let status;
  if (member.left) status = 'left';
  else if (frozen) status = 'frozen';
  else if (!expiry) status = 'unpaid';
  else if (expiry < today) status = 'expired';
  else if (daysLeft <= (settings.expiringDays ?? 7)) status = 'expiring';
  else status = 'active';

  const days = new Set(visits.map((v) => v.date));
  const visitDates = [...days].sort();
  const lastVisit = visitDates[visitDates.length - 1] || null;
  const thisMonth = monthKey(today);
  const closed = visits.filter((v) => v.out);
  const avgMinutes = closed.length ? Math.round(sum(closed, (v) => toMinutes(v.out) - toMinutes(v.in)) / closed.length) : null;

  // Month-by-month: paid (covered by a fee period or a freeze) and visit count.
  const months = monthsBetween(member.joinDate, today).map((key) => {
    const start = monthStart(key);
    const end = monthEnd(key);
    const covered = payments.some((p) => p.periodStart <= end && p.periodEnd >= start);
    const frozenMonth = (member.freezes || []).some((f) => f.from <= end && f.to >= start);
    const count = visitDates.filter((d) => d.startsWith(key)).length;
    return { month: key, paid: covered, frozen: frozenMonth && !covered, visits: count };
  });
  const past = months.filter((m) => m.month !== thisMonth);

  const s = {
    status,
    expiry,
    daysLeft,
    frozen,
    balance,
    totalPaid,
    plan: last ? { name: last.planName, months: last.months } : null,
    lastPayment: last ? last.date : null,
    lastVisit,
    daysSinceVisit: lastVisit ? diffDays(lastVisit, today) : null,
    totalVisits: days.size,
    visitsThisMonth: visitDates.filter((d) => d.startsWith(thisMonth)).length,
    avgMinutes,
    inside: visits.some((v) => v.date === today && !v.out),
    monthsMember: months.length,
    monthsAttended: months.filter((m) => m.visits > 0).length,
    monthsMissed: past.filter((m) => m.visits === 0 && !m.frozen).length,
    monthsUnpaid: months.filter((m) => !m.paid && !m.frozen).length,
    monthsPaid: sum(payments, (p) => p.months),
  };
  if (timeline) s.months = months;
  return s;
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

module.exports = { summarize, indexDb, paidOf, freezeDays, toMinutes };
