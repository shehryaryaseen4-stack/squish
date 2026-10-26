'use strict';

const crypto = require('node:crypto');
const { checkPin, hashPin } = require('./store');
const { isDate, toMin, fromMin, addDays, addMonths, diffDays, monthKey, monthsBetween, monthEnd, nowIn, weekdayOf } = require('./time');
const { classesOn } = require('./availability');
const { summarize, indexDb, paidOf } = require('./members');
const v = require('./validate');
const { PERMISSIONS, PERM_IDS, PRESETS, migrateAccess } = require('./access');
const { clientIp } = require('./net');
const { createReminders, TEMPLATES } = require('./reminders');
const { createEnroll } = require('./enroll');

const { fail, HttpError } = v;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MEMBER_SESSION_MS = 180 * 24 * 60 * 60 * 1000;

function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= limit) fail('Too many attempts. Please wait a few minutes and try again.', 429);
    list.push(now);
    hits.set(key, list);
  };
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newId = (prefix) => `${prefix}-${crypto.randomBytes(5).toString('hex')}`;
const randomPin = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');
const sum = (list, f) => list.reduce((a, x) => a + (f(x) || 0), 0);
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const normalPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^92/, '0');

// "https://youtube.com/shorts/abc123DEF45", "youtu.be/…", "watch?v=…" → the 11-character video id.
function youtubeId(url) {
  const m = String(url || '').trim().match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:shorts\/|embed\/|live\/|watch\?(?:.*&)?v=|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function memberPublic(m) {
  const { pin, ...rest } = m;
  return rest;
}

function createApi(store, { now: clock = () => new Date() } = {}) {
  const loginLimit = rateLimiter(8, 10 * 60 * 1000);
  const memberLoginLimit = rateLimiter(10, 10 * 60 * 1000);
  const leadLimit = rateLimiter(5, 60 * 60 * 1000);
  const db = () => store.db;
  if (migrateAccess(store.db)) store.save();
  const reminders = createReminders(store, { now: clock });
  const enrollment = createEnroll({ db, store, stamp: () => new Date(clock()).toISOString(), now: () => new Date(clock()).getTime() });
  const now = () => nowIn(db().business.timeZone, clock());
  const today = () => now().date;
  const stamp = () => new Date(clock()).toISOString();

  const findMember = (id) => db().members.find((m) => m.id === id) || fail('Member not found', 404);
  const summaryOf = (m, opts) => summarize(db(), m, today(), indexDb(db()), opts);

  function summaries() {
    const d = db();
    const ix = indexDb(d);
    const t = today();
    return d.members.map((m) => ({ member: m, s: summarize(d, m, t, ix) }));
  }

  function listItem({ member: m, s }) {
    return {
      id: m.id, memberNo: m.memberNo, name: m.name, phone: m.phone, gender: m.gender, joinDate: m.joinDate,
      trainerId: m.trainerId, dob: m.dob, photo: m.photo || null, ...s,
    };
  }

  // ---- sessions -----------------------------------------------------------

  // Who is signed in to the dashboard, and what they may do.
  function adminOf(req) {
    const token = bearer(req);
    const d = db();
    const s = token && (d.admin.sessions || []).find((x) => x.hash === sha(token) && x.expires > Date.now());
    if (!s) fail('Please sign in again', 401);
    if (s.role === 'owner') return { role: 'owner', name: 'Owner', perms: PERM_IDS };
    const user = d.admin.users.find((u) => u.id === s.userId && u.active !== false);
    if (!user) fail('Please sign in again', 401);
    return { role: 'staff', userId: user.id, name: user.name, perms: user.perms.filter((x) => PERM_IDS.includes(x)) };
  }

  function userPublic(u) {
    const { pin, ...rest } = u;
    return rest;
  }

  // Every PIN opens exactly one login, so no two may be the same.
  function pinTaken(pin, exceptUserId) {
    const d = db();
    return checkPin(pin, d.admin.ownerPin) || d.admin.users.some((u) => u.id !== exceptUserId && checkPin(pin, u.pin));
  }

  function staffUser(body, existing = {}) {
    const name = v.str(body.name ?? existing.name, { max: 40, required: true, field: 'Name' });
    const perms = Array.isArray(body.perms) ? [...new Set(body.perms.filter((x) => PERM_IDS.includes(x)))] : existing.perms || [];
    if (!perms.length) fail('Allow at least one thing');
    return { name, perms, active: body.active === undefined ? existing.active !== false : Boolean(body.active) };
  }

  function memberOf(req) {
    const token = bearer(req);
    const s = token && db().memberSessions.find((x) => x.hash === sha(token) && x.expires > Date.now());
    const m = s && db().members.find((x) => x.id === s.memberId);
    if (!m || m.left) fail('Please sign in again', 401);
    return m;
  }

  function openSession(list, extra, ms) {
    const token = crypto.randomBytes(24).toString('hex');
    const kept = list.filter((s) => s.expires > Date.now()).slice(-200);
    kept.push({ hash: sha(token), expires: Date.now() + ms, ...extra });
    return { token, kept };
  }

  // ---- payments -------------------------------------------------------------

  function createPayment(body) {
    const d = db();
    const p = v.payment(body);
    const member = findMember(p.memberId);
    const plan = d.plans.find((x) => x.id === p.planId) || fail('Pick a plan');
    const total = plan.price - p.discount + p.admissionFee;
    if (total < 0) fail('Discount is larger than the fee');
    if (p.paid > total) fail('Amount received is more than the total');
    const payment = {
      id: newId('pay'),
      receiptNo: d.receiptSeq++,
      memberId: member.id,
      planId: plan.id,
      planName: plan.name,
      months: plan.months,
      periodStart: p.periodStart,
      periodEnd: addDays(addMonths(p.periodStart, plan.months), -1),
      price: plan.price,
      discount: p.discount,
      admissionFee: p.admissionFee,
      total,
      installments: p.paid > 0 ? [{ amount: p.paid, method: p.method, date: p.date }] : [],
      date: p.date,
      note: p.note,
      createdAt: stamp(),
    };
    d.payments.push(payment);
    if (member.left) member.left = false;
    return payment;
  }

  // ---- importing members from a spreadsheet ---------------------------------------

  const GENDERS = { m: 'male', male: 'male', man: 'male', boy: 'male', mard: 'male', f: 'female', female: 'female', woman: 'female', girl: 'female', aurat: 'female', larki: 'female' };

  // "Monthly", "3 months", "Quarterly", "1 year"… → one of the gym's plans.
  function planFor(text, months) {
    const d = db();
    const t = String(text || '').toLowerCase().trim();
    const plans = d.plans.filter((p) => p.active !== false);
    if (t) {
      const byName = plans.find((p) => p.name.toLowerCase() === t) || plans.find((p) => t.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(t));
      if (byName) return byName;
      const n = /annual|year|12/.test(t) ? 12 : /half|6/.test(t) ? 6 : /quarter|3/.test(t) ? 3 : /month|1/.test(t) ? 1 : Number(t.match(/\d+/)?.[0]) || 0;
      const byMonths = plans.find((p) => p.months === n);
      if (byMonths) return byMonths;
    }
    if (months) return plans.find((p) => p.months === months) || plans.reduce((a, p) => (Math.abs(p.months - months) < Math.abs(a.months - months) ? p : a), plans[0]);
    return plans.find((p) => p.months === 1) || plans[0];
  }

  /**
   * rows: [{ memberNo, name, phone, gender, joinDate, dob, address, notes, emergencyPhone,
   *          plan, amount, due, paidOn, validTill }] with ISO dates.
   * Keeps old member numbers (the fingerprint machine knows members by them).
   * A row with fee details gets a receipt covering paidOn → validTill.
   */
  function importMembers(rows, { dryRun = false, existing = 'skip' } = {}) {
    const d = db();
    const t = today();
    const result = { created: 0, updated: 0, skipped: [], errors: [], fees: 0, pins: [] };
    const byPhone = new Map(d.members.filter((x) => !x.left).map((x) => [normalPhone(x.phone), x]));
    const usedNos = new Set(d.members.map((x) => x.memberNo));
    const seenInFile = new Set();
    const plan = [];
    rows.slice(0, 5000).forEach((r, i) => {
      const line = i + 2; // spreadsheet row, after the header
      try {
        for (const [k, label] of [['joinDate', 'joining date'], ['paidOn', 'fee date'], ['validTill', 'expiry date'], ['dob', 'date of birth']]) {
          if (r[k] && !/^\d{4}-\d{2}-\d{2}$/.test(r[k])) throw new Error(`Can’t read the ${label} “${String(r[k]).slice(0, 20)}”`);
        }
        const gender = GENDERS[String(r.gender || '').trim().toLowerCase()] || 'male';
        const fee = r.validTill || r.paidOn || r.amount;
        const data = v.member({
          name: r.name, phone: r.phone, gender, dob: r.dob || '', address: r.address, notes: r.notes, emergencyPhone: r.emergencyPhone,
          joinDate: r.joinDate || r.paidOn || t,
        });
        const key = normalPhone(data.phone);
        if (seenInFile.has(key)) { result.skipped.push({ line, name: data.name, reason: 'Same phone as an earlier row' }); return; }
        seenInFile.add(key);
        const found = byPhone.get(key);
        if (found && existing !== 'update') { result.skipped.push({ line, name: data.name, reason: `Already a member (#${found.memberNo})` }); return; }
        let no = Number(String(r.memberNo ?? '').replace(/\D/g, '')) || null;
        if (no && (no > 9999999 || (usedNos.has(no) && found?.memberNo !== no))) no = null;
        let feeRow = null;
        if (fee) {
          const months = r.paidOn && r.validTill ? Math.max(1, Math.round(diffDays(r.paidOn, r.validTill) / 30.4)) : 0;
          const p = planFor(r.plan, months);
          const end = r.validTill || addDays(addMonths(r.paidOn || data.joinDate, p.months), -1);
          const start = r.validTill ? (r.paidOn && r.paidOn <= end ? r.paidOn : addMonths(addDays(end, 1), -p.months)) : (r.paidOn || data.joinDate);
          const paid = Math.max(0, Number(r.amount) || 0);
          const due = Math.max(0, Number(r.due) || 0);
          feeRow = { plan: p, start, end, paid: r.amount === undefined || r.amount === '' ? p.price : paid, due, date: r.paidOn || start };
        }
        plan.push({ line, data, found, no, feeRow });
        if (no) usedNos.add(no);
      } catch (e) {
        result.errors.push({ line, name: r.name || '', reason: e.message });
      }
    });
    if (dryRun) {
      result.created = plan.filter((x) => !x.found).length;
      result.updated = plan.filter((x) => x.found).length;
      result.fees = plan.filter((x) => x.feeRow).length;
      return result;
    }
    for (const x of plan) {
      let member = x.found;
      if (member) {
        Object.assign(member, { ...x.data, joinDate: member.joinDate < x.data.joinDate ? member.joinDate : x.data.joinDate });
        result.updated++;
      } else {
        const pin = randomPin();
        const memberNo = x.no || (() => { while (usedNos.has(d.memberSeq)) d.memberSeq++; usedNos.add(d.memberSeq); return d.memberSeq++; })();
        member = { id: newId('mem'), memberNo, ...x.data, pin: hashPin(pin), freezes: [], left: false, createdAt: stamp(), imported: true };
        d.members.push(member);
        result.created++;
        result.pins.push({ memberNo, name: member.name, phone: member.phone, pin });
        enrollment.syncMember(member);
      }
      // Importing the same file again doesn't add the same fee twice.
      if (x.feeRow && !d.payments.some((p) => p.memberId === member.id && p.periodEnd === x.feeRow.end)) {
        const f = x.feeRow;
        const total = f.paid + f.due;
        d.payments.push({
          id: newId('pay'), receiptNo: d.receiptSeq++, memberId: member.id, planId: f.plan.id, planName: f.plan.name, months: f.plan.months,
          periodStart: f.start, periodEnd: f.end, price: total, discount: 0, admissionFee: 0, total,
          installments: f.paid > 0 ? [{ amount: f.paid, method: 'Cash', date: f.date }] : [], date: f.date, note: 'Imported', createdAt: stamp(),
        });
        result.fees++;
      }
    }
    const maxNo = Math.max(0, ...d.members.map((x) => x.memberNo));
    if (d.memberSeq <= maxNo) d.memberSeq = maxNo + 1;
    store.save();
    return result;
  }

  // Where a renewal should start: the day after the current period, or today if it lapsed.
  function suggestedStart(member) {
    const s = summaryOf(member);
    if (s.expiry && s.expiry >= today()) return addDays(s.expiry, 1);
    return today();
  }

  // ---- attendance -----------------------------------------------------------

  function checkInOut(body, canOverride) {
    const d = db();
    const n = now();
    let member;
    if (body.memberId) member = findMember(body.memberId);
    else {
      const no = Number(String(body.memberNo || '').trim());
      member = d.members.find((m) => m.memberNo === no) || fail(`No member with number ${body.memberNo}`, 404);
    }
    const open = d.attendance.find((a) => a.memberId === member.id && a.date === n.date && !a.out);
    if (open) {
      open.out = fromMin(n.minutes);
      open.outAt = stamp();
      store.save();
      return { action: 'out', visit: open, member: memberPublic(member), summary: summaryOf(member) };
    }
    const s = summaryOf(member);
    const blocked = ['expired', 'unpaid', 'left'].includes(s.status);
    if (blocked && d.business.blockExpiredCheckin && !(body.force && canOverride)) {
      fail(s.status === 'unpaid' ? `${member.name} has not paid a membership fee yet` : `${member.name}'s membership ${s.status === 'left' ? 'is closed' : `expired on ${s.expiry}`}. Please renew first.`, 409);
    }
    const visit = { id: newId('att'), memberId: member.id, date: n.date, in: fromMin(n.minutes), out: null, inAt: stamp(), source: body.source === 'kiosk' ? 'kiosk' : 'desk' };
    d.attendance.push(visit);
    store.save();
    return { action: 'in', visit, member: memberPublic(member), summary: { ...s, inside: true }, warning: blocked || s.balance > 0 || s.status === 'expiring' };
  }

  // ---- dashboard & reports ----------------------------------------------------

  function collected(from, to) {
    const out = [];
    for (const p of db().payments) for (const i of p.installments || []) if (i.date >= from && i.date <= to) out.push({ ...i, payment: p });
    return out;
  }
  const spent = (from, to) => db().expenses.filter((e) => e.date >= from && e.date <= to);

  function dashboard(showMoney) {
    const d = db();
    const n = now();
    const t = n.date;
    const all = summaries();
    const live = all.filter((x) => !x.member.left);
    const byStatus = (st) => live.filter((x) => x.s.status === st);
    const month = monthKey(t);
    const todays = d.attendance.filter((a) => a.date === t);
    const inside = todays.filter((a) => !a.out);
    const memberName = (id) => d.members.find((m) => m.id === id);
    const inactiveDays = d.business.inactiveDays || 10;
    const inactive = live.filter((x) => ['active', 'expiring'].includes(x.s.status) && (x.s.daysSinceVisit === null || x.s.daysSinceVisit >= inactiveDays))
      .sort((a, b) => (b.s.daysSinceVisit ?? 999) - (a.s.daysSinceVisit ?? 999));
    const recentExpired = byStatus('expired').filter((x) => diffDays(x.s.expiry, t) <= 60).sort((a, b) => b.s.expiry.localeCompare(a.s.expiry));
    const dues = live.filter((x) => x.s.balance > 0).sort((a, b) => b.s.balance - a.s.balance);
    const birthdays = live.filter((x) => {
      if (!x.member.dob) return false;
      for (let i = 0; i < 7; i++) if (addDays(t, i).slice(5) === x.member.dob.slice(5)) return true;
      return false;
    });

    // Average check-ins per hour of day over the last 28 days.
    const since = addDays(t, -28);
    const hours = Array.from({ length: 24 }, () => 0);
    for (const a of d.attendance) if (a.date >= since && a.date < t) hours[Math.floor(toMin(a.in) / 60)] += 1;
    const peak = hours.map((c, h) => ({ hour: h, avg: Math.round((c / 28) * 10) / 10 })).filter((x) => x.hour >= 5 && x.hour <= 23);

    const out = {
      today: t,
      now: n,
      demo: Boolean(d.demo),
      counts: {
        members: live.length,
        active: byStatus('active').length + byStatus('expiring').length,
        expiring: byStatus('expiring').length,
        expired: byStatus('expired').length,
        unpaid: byStatus('unpaid').length,
        frozen: byStatus('frozen').length,
        inactive: inactive.length,
        dues: dues.length,
        duesAmount: sum(dues, (x) => x.s.balance),
        newThisMonth: live.filter((x) => monthKey(x.member.joinDate) === month).length,
        checkinsToday: new Set(todays.map((a) => a.memberId)).size,
        insideNow: inside.length,
        newLeads: d.leads.filter((l) => l.status === 'new').length,
      },
      inside: inside.map((a) => ({ ...a, member: pick(memberName(a.memberId)) })).sort((a, b) => b.in.localeCompare(a.in)),
      expiring: byStatus('expiring').sort((a, b) => a.s.daysLeft - b.s.daysLeft).slice(0, 8).map(listItem),
      expired: recentExpired.slice(0, 8).map(listItem),
      dues: dues.slice(0, 8).map(listItem),
      inactive: inactive.slice(0, 8).map(listItem),
      birthdays: birthdays.map(listItem),
      peak,
    };
    if (showMoney) {
      const from = `${month}-01`;
      const months = monthsBetween(addMonths(from, -5), t).map((key) => ({
        month: key,
        revenue: sum(collected(`${key}-01`, monthEnd(key)), (i) => i.amount),
        expenses: sum(spent(`${key}-01`, monthEnd(key)), (e) => e.amount),
      }));
      const rev = sum(collected(from, t), (i) => i.amount);
      const exp = sum(spent(from, t), (e) => e.amount);
      out.money = { today: sum(collected(t, t), (i) => i.amount), month: rev, expenses: exp, profit: rev - exp, months };
    }
    return out;
  }

  function pick(m) {
    return m ? { id: m.id, name: m.name, memberNo: m.memberNo, phone: m.phone, gender: m.gender, photo: m.photo || null } : null;
  }

  function report(month) {
    const d = db();
    const from = `${month}-01`;
    const to = monthEnd(month);
    const income = collected(from, to);
    const costs = spent(from, to);
    const group = (list, key, val) => {
      const g = {};
      for (const x of list) g[key(x)] = (g[key(x)] || 0) + val(x);
      return Object.entries(g).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    };
    const visits = d.attendance.filter((a) => a.date >= from && a.date <= to);
    const visitors = new Set(visits.map((a) => a.memberId));
    const days = monthsBetween(from, to).length && Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i));
    const newMembers = d.members.filter((m) => m.joinDate >= from && m.joinDate <= to);
    const firstPayment = new Map();
    for (const p of [...d.payments].sort((a, b) => a.periodStart.localeCompare(b.periodStart))) if (!firstPayment.has(p.memberId)) firstPayment.set(p.memberId, p.id);
    const paymentsInMonth = d.payments.filter((p) => p.date >= from && p.date <= to);
    const ix = indexDb(d);
    // Members whose fee ran out this month and who have not renewed since.
    const lapsed = d.members.filter((m) => {
      const s = summarize(d, m, to < today() ? to : today(), ix);
      return s.expiry && s.expiry >= from && s.expiry <= to && s.expiry < today();
    });
    return {
      month,
      revenue: sum(income, (i) => i.amount),
      expenses: sum(costs, (e) => e.amount),
      byMethod: group(income, (i) => i.method, (i) => i.amount),
      byPlan: group(income, (i) => i.payment.planName, (i) => i.amount),
      byCategory: group(costs, (e) => e.category, (e) => e.amount),
      admissionFees: sum(paymentsInMonth, (p) => p.admissionFee),
      discounts: sum(paymentsInMonth, (p) => p.discount),
      daily: days.map((date) => ({
        date,
        revenue: sum(income.filter((i) => i.date === date), (i) => i.amount),
        visits: visits.filter((a) => a.date === date).length,
      })),
      newMembers: newMembers.length,
      renewals: paymentsInMonth.filter((p) => firstPayment.get(p.memberId) !== p.id).length,
      lapsed: lapsed.map((m) => ({ id: m.id, name: m.name, memberNo: m.memberNo, phone: m.phone })),
      visits: visits.length,
      visitors: visitors.size,
      payments: paymentsInMonth.length,
    };
  }

  // ---- member detail ------------------------------------------------------------

  function memberDetail(m) {
    const d = db();
    return {
      member: memberPublic(m),
      summary: summaryOf(m, { timeline: true }),
      payments: d.payments.filter((p) => p.memberId === m.id).sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
      attendance: d.attendance.filter((a) => a.memberId === m.id).sort((a, b) => (b.date + b.in).localeCompare(a.date + a.in)),
      measurements: d.measurements.filter((x) => x.memberId === m.id).sort((a, b) => a.date.localeCompare(b.date)),
      bookings: d.classBookings.filter((b) => b.memberId === m.id && b.date >= today()).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
      suggestedStart: suggestedStart(m),
    };
  }

  // ---- class bookings -------------------------------------------------------------

  function bookClass(member, classId, date, { asStaff = false } = {}) {
    const d = db();
    if (!isDate(date)) fail('Pick a date');
    const n = now();
    if (date < n.date || (!asStaff && date > addDays(n.date, (d.business.bookingWindowDays || 7) - 1))) fail('That date is not open for booking yet');
    const s = summaryOf(member);
    if (!asStaff && !['active', 'expiring'].includes(s.status)) fail('Your membership is not active. Please renew at the front desk.', 409);
    const cls = classesOn(d, date, n).find((c) => c.id === classId) || fail('That class does not run on this day', 404);
    if (cls.started && !asStaff) fail('This class has already started', 409);
    if (cls.spotsLeft <= 0) fail('This class is full', 409);
    if (d.classBookings.some((b) => b.classId === classId && b.date === date && b.memberId === member.id && b.status === 'booked')) fail('Already booked for this class', 409);
    const booking = { id: newId('cb'), classId, className: cls.name, date, start: cls.start, end: cls.end, memberId: member.id, status: 'booked', createdAt: stamp() };
    d.classBookings.push(booking);
    store.save();
    return booking;
  }

  // ---- monthly register ----------------------------------------------------------

  /**
   * One row per member for a day or a month: did they come, is the fee paid for
   * that period, and what money came in from them during it.
   */
  function register(from, to) {
    const d = db();
    const t = today();
    const ix = indexDb(d);
    const rows = d.members
      .filter((m) => m.joinDate <= to && (!m.left || (ix.payments.get(m.id) || []).some((p) => p.installments.some((i) => i.date >= from && i.date <= to))))
      .map((m) => {
        const pays = ix.payments.get(m.id) || [];
        const days = new Set((ix.visits.get(m.id) || []).filter((v) => v.date >= from && v.date <= to).map((v) => v.date));
        const covering = pays.filter((p) => p.periodStart <= to && p.periodEnd >= from).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
        const frozen = (m.freezes || []).some((f) => f.from <= to && f.to >= from);
        const received = [];
        for (const p of pays) for (const i of p.installments) if (i.date >= from && i.date <= to) received.push({ amount: i.amount, method: i.method, date: i.date, planName: p.planName, receiptNo: p.receiptNo });
        const s = summarize(d, m, t, ix);
        return {
          id: m.id, memberNo: m.memberNo, name: m.name, phone: m.phone, gender: m.gender, photo: m.photo || null,
          plan: s.plan, status: s.status, expiry: s.expiry, balance: s.balance,
          visits: days.size, lastVisit: [...days].sort().pop() || null,
          paid: covering.length > 0, paidTill: covering[0]?.periodEnd || null, frozen: frozen && !covering.length,
          received: received.sort((a, b) => a.date.localeCompare(b.date)),
          receivedTotal: sum(received, (r) => r.amount),
        };
      });
    const came = rows.filter((r) => r.visits > 0);
    const paid = rows.filter((r) => r.paid);
    const payers = rows.filter((r) => r.receivedTotal > 0);
    return {
      from, to,
      totals: {
        members: rows.length,
        came: came.length,
        notCame: rows.length - came.length,
        paid: paid.length,
        notPaid: rows.filter((r) => !r.paid && !r.frozen).length,
        frozen: rows.filter((r) => r.frozen).length,
        collected: sum(rows, (r) => r.receivedTotal),
        payers: payers.length,
        visits: sum(rows, (r) => r.visits),
      },
      rows: rows.sort((a, b) => a.memberNo - b.memberNo),
    };
  }

  // ---- fingerprint machines ------------------------------------------------------
  //
  // ZKTeco-style attendance machines speak the "push" (ADMS / iclock) protocol:
  // pointed at this server they say hello with a GET, then POST every punch as a
  // tab-separated ATTLOG line: user id, "YYYY-MM-DD HH:MM:SS", status, verify type.
  // The user id on the machine is the member number, so a thumb on the sensor
  // checks that member in, and the next punch checks them out.

  const DUPLICATE_MINUTES = 2;

  function recordPunch(memberNo, date, time, source) {
    const d = db();
    const member = d.members.find((m) => m.memberNo === Number(memberNo));
    if (!member) return 'unknown';
    const mins = toMin(time);
    const todays = d.attendance.filter((a) => a.memberId === member.id && a.date === date).sort((a, b) => a.in.localeCompare(b.in));
    const last = todays[todays.length - 1];
    if (last && !last.out) {
      if (mins - toMin(last.in) < DUPLICATE_MINUTES && mins >= toMin(last.in)) return 'duplicate';
      if (mins < toMin(last.in)) return 'duplicate';
      last.out = time;
      last.outAt = stamp();
      return 'out';
    }
    if (last && last.out && Math.abs(mins - toMin(last.out)) < DUPLICATE_MINUTES) return 'duplicate';
    d.attendance.push({ id: newId('att'), memberId: member.id, date, in: time, out: null, source, inAt: stamp() });
    return 'in';
  }

  function deviceOptions(sn) {
    return [
      `GET OPTION FROM: ${sn}`,
      'ATTLOGStamp=None', 'OPERLOGStamp=9999', 'ATTPHOTOStamp=None',
      'ErrorDelay=30', 'Delay=10', 'TransTimes=00:00;14:05', 'TransInterval=1',
      // OpLog, EnrollFP and FACE make the machine tell us about new fingerprints, faces and cards.
      'TransFlag=TransData AttLog OpLog EnrollUser ChgUser EnrollFP ChgFP FACE', 'Realtime=1', 'Encrypt=None',
    ].join('\n');
  }

  // Machines the gym can add from Settings, and what each one needs.
  const DEVICE_TYPES = [
    { id: 'zk-fingerprint', brand: 'ZKTeco', name: 'ZKTeco fingerprint machine', models: 'K40, K50, F18, F22, MB20, MB360, uFace', protocol: 'zk' },
    { id: 'zk-face', brand: 'ZKTeco', name: 'ZKTeco face machine', models: 'SpeedFace V5L, ProFace X, MB560-VL, Horus, xFace', protocol: 'zk' },
    { id: 'essl', brand: 'eSSL', name: 'eSSL / Identix / Realtime', models: 'eSSL X990, K21, iClock, Identix K90 (ZKTeco based)', protocol: 'zk' },
    { id: 'zlink', brand: 'ZKTeco', name: 'ZKTeco ZLink machine', models: 'Machines set up with the ZKBio Zlink app', protocol: 'zk' },
    { id: 'hik-face', brand: 'Hikvision', name: 'Hikvision face terminal', models: 'DS-K1T341, DS-K1T671, DS-K1T343 (MinMoe)', protocol: 'hik' },
    { id: 'other', brand: 'Other', name: 'Other brand', models: 'Any machine with "ADMS", "Cloud server" or "Push" in its network menu', protocol: 'zk' },
  ];
  const ONLINE_MS = 3 * 60 * 1000;

  const nowMs = () => new Date(clock()).getTime();

  function publicDevice(dv) {
    const seenAgo = dv.lastSeen ? nowMs() - Date.parse(dv.lastSeen) : null;
    const { commands = [], ...rest } = dv;
    return { ...rest, online: seenAgo !== null && seenAgo < ONLINE_MS, seenAgo, waiting: commands.filter((c) => c.status === 'pending' || c.status === 'sent').length };
  }

  function addDevice(body) {
    const d = db();
    const type = DEVICE_TYPES.find((t) => t.id === body.type) || fail('Choose the type of machine');
    const name = v.str(body.name, { max: 60 }) || type.name;
    if (type.protocol === 'zk') {
      const sn = v.str(body.sn, { max: 40, required: true, field: 'Serial number' }).toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z0-9-]{4,40}$/.test(sn)) fail('The serial number has only letters and numbers. Find it under Menu → System Info → Device Info.');
      // The machine may already have knocked on the door before it was added.
      const existing = d.devices.find((x) => x.protocol === 'zk' && x.sn.toUpperCase() === sn);
      if (existing && existing.approved) fail(`This machine (${sn}) is already added as "${existing.name}"`, 409);
      const dv = existing || { id: newId('dev'), sn, firstSeen: null, lastSeen: null, punches: 0, unknownIds: [] };
      Object.assign(dv, { type: type.id, protocol: 'zk', name, approved: true, addedAt: stamp() });
      if (!existing) d.devices.push(dv);
      store.save();
      return publicDevice(dv);
    }
    const dv = { id: newId('dev'), type: type.id, protocol: 'hik', name, key: crypto.randomBytes(12).toString('hex'), approved: true, addedAt: stamp(), firstSeen: null, lastSeen: null, punches: 0, unknownIds: [] };
    d.devices.push(dv);
    store.save();
    return publicDevice(dv);
  }

  // "Check connection": a push machine calls us, so connected means we heard from it recently.
  function checkDevice(dv) {
    const d = db();
    const p = publicDevice(dv);
    if (p.online) {
      return { ok: true, message: `Connected. Last heard from the machine ${Math.max(1, Math.round(p.seenAgo / 1000))} seconds ago.`, device: p };
    }
    const others = d.devices.filter((x) => !x.approved && x.lastSeen && nowMs() - Date.parse(x.lastSeen) < 60 * 60 * 1000).map(publicDevice);
    if (dv.lastSeen) {
      return { ok: false, code: 'lost', message: `The machine was connected, but it has not been heard from since ${new Date(dv.lastSeen).toLocaleString('en-GB', { timeZone: d.business.timeZone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.`, others, device: p };
    }
    if (dv.protocol === 'zk' && others.length) {
      return { ok: false, code: 'wrong-serial', message: `A machine with serial number ${others.map((o) => o.sn).join(', ')} is calling the server, but you entered ${dv.sn}.`, others, device: p };
    }
    return { ok: false, code: 'never', message: 'The machine has not contacted the server yet.', others, device: p };
  }

  // ZKTeco & friends: returns [status, text] for the machine. Unknown machines
  // are listed under "found" in Settings until the owner adds them.
  function handleDevice(method, url, text) {
    const d = db();
    const sn = String(url.searchParams.get('SN') || '').trim().slice(0, 40);
    if (!sn) return [400, 'ERROR: SN missing'];
    let device = d.devices.find((x) => x.protocol === 'zk' && x.sn.toUpperCase() === sn.toUpperCase());
    if (!device) {
      device = { id: newId('dev'), sn, type: 'zk-fingerprint', protocol: 'zk', name: `Machine ${sn}`, approved: false, firstSeen: stamp(), lastSeen: null, punches: 0, unknownIds: [] };
      d.devices.push(device);
    }
    device.firstSeen ||= stamp();
    device.lastSeen = stamp();
    if (!device.approved) { store.save(); return [403, 'ERROR: add this machine in the gym app first']; }
    const path = url.pathname;
    if (method === 'GET' && path === '/iclock/cdata') { store.save(); return [200, deviceOptions(sn)]; }
    // The machine asks for work (register a member, scan a finger) and reports back.
    if (method === 'GET' && path === '/iclock/getrequest') { const reply = enrollment.nextCommands(device); store.save(); return [200, reply]; }
    if (method === 'POST' && path === '/iclock/devicecmd') { enrollment.results(device, text); store.save(); return [200, 'OK']; }
    if (method === 'POST' && path === '/iclock/cdata') {
      const table = url.searchParams.get('table');
      if (table !== 'ATTLOG') {
        const n = enrollment.operlog(text);
        store.save();
        return [200, `OK: ${n}`];
      }
      const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const punches = lines.map((l) => l.split('\t')).filter((f) => f.length >= 2 && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(f[1]))
        .map(([pin, at, , verify]) => ({ pin: pin.trim(), date: at.slice(0, 10), time: at.slice(11, 16), verify }))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      for (const p of punches) {
        const r = recordPunch(p.pin, p.date, p.time, p.verify === '15' ? 'face' : p.verify === '4' ? 'card' : 'fingerprint');
        if (r === 'unknown' && !device.unknownIds.includes(p.pin)) device.unknownIds = [...device.unknownIds, p.pin].slice(-20);
        if (r === 'in' || r === 'out') device.punches++;
      }
      store.save();
      return [200, `OK: ${lines.length}`];
    }
    store.save();
    return [200, 'OK'];
  }

  // Hikvision face terminals post access events to "HTTP Listening" at /hik/<key>.
  // The event JSON carries the person's employee number (= member number).
  function handleHikvision(key, text) {
    const d = db();
    const device = d.devices.find((x) => x.protocol === 'hik' && x.key === key);
    if (!device) return [404, 'Unknown machine'];
    device.firstSeen ||= stamp();
    device.lastSeen = stamp();
    const events = [];
    for (const chunk of String(text || '').split(/\r?\n--/)) {
      const start = chunk.indexOf('{');
      const end = chunk.lastIndexOf('}');
      if (start < 0 || end <= start) continue;
      try { events.push(JSON.parse(chunk.slice(start, end + 1))); } catch { /* not JSON */ }
    }
    for (const e of events) {
      const ace = e.AccessControllerEvent || {};
      const employee = String(ace.employeeNoString || ace.employeeNo || '').trim();
      const at = String(e.dateTime || '');
      if (!employee || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(at)) continue; // heartbeats and door events
      const r = recordPunch(employee, at.slice(0, 10), at.slice(11, 16), ace.currentVerifyMode && /card/i.test(ace.currentVerifyMode) ? 'card' : 'face');
      if (r === 'unknown' && !device.unknownIds.includes(employee)) device.unknownIds = [...device.unknownIds, employee].slice(-20);
      if (r === 'in' || r === 'out') device.punches++;
    }
    store.save();
    return [200, 'OK'];
  }

  // ---- entry screen ---------------------------------------------------------------

  function displayFeed() {
    const d = db();
    const t = today();
    const todays = d.attendance.filter((a) => a.date === t);
    const events = [];
    for (const a of todays) {
      // Order by the gym's local time; the exact stamp only breaks ties within a minute.
      events.push({ key: `${a.id}:in`, type: 'in', at: `${a.in}|${a.inAt || ''}`, time: a.in, visit: a });
      if (a.out) events.push({ key: `${a.id}:out`, type: 'out', at: `${a.out}|${a.outAt || ''}`, time: a.out, visit: a });
    }
    events.sort((a, b) => b.at.localeCompare(a.at));
    const latest = events.slice(0, 8);
    const ix = indexDb(d);
    return {
      gym: { name: d.business.name, accent: d.business.accent },
      insideNow: todays.filter((a) => !a.out).length,
      checkinsToday: new Set(todays.map((a) => a.memberId)).size,
      events: latest.map((e) => {
        const m = d.members.find((x) => x.id === e.visit.memberId);
        if (!m) return null;
        const s = summarize(d, m, t, ix);
        return {
          key: e.key, type: e.type, time: e.time, source: e.visit.source || null,
          minutes: e.type === 'out' ? toMin(e.visit.out) - toMin(e.visit.in) : null,
          member: pick(m),
          summary: { status: s.status, daysLeft: s.daysLeft, expiry: s.expiry, plan: s.plan, balance: s.balance, visitsThisMonth: s.visitsThisMonth },
        };
      }).filter(Boolean),
    };
  }

  // ---- photos -----------------------------------------------------------------------

  function setPhoto(member, image) {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ''));
    if (!match) fail('Choose a photo (JPG or PNG)');
    if (match[2].length > 600 * 1024) fail('That photo is too large. Please choose a smaller one.');
    member.photo = store.savePhoto(member.id, match[2]);
    store.save();
    return { photo: member.photo };
  }

  function clearPhoto(member) {
    store.deletePhoto(member.id);
    delete member.photo;
    store.save();
    return { photo: null };
  }

  // ---- routing ------------------------------------------------------------------

  const COLLECTION_RIGHTS = { plans: ['settings'], staff: ['settings'], classes: ['settings'], expenses: ['expenses'], measurements: ['members.edit'], leads: ['leads'] };

  async function handle(req, res, url, body) {
    const { pathname } = url;
    const q = Object.fromEntries(url.searchParams);
    const m = req.method;
    const ip = clientIp(req);
    const d = db();
    let match;

    // Public
    // Short how-to videos the gym added to exercises.
    if (m === 'GET' && pathname === '/api/exercise-videos') return d.exerciseVideos || {};
    if (m === 'GET' && pathname === '/api/gym') {
      const { closedDates, ...business } = d.business;
      return {
        business: { ...business, closedDates },
        plans: d.plans.filter((p) => p.active !== false),
        classes: d.classes.filter((c) => c.active !== false),
        staff: d.staff.filter((s) => s.active !== false).map(({ id, name, role, color }) => ({ id, name, role, color })),
        today: today(),
        demo: Boolean(d.demo),
        bodyPhotos: d.bodyPhotos || {},
      };
    }
    if (m === 'GET' && pathname === '/api/classes') {
      if (!isDate(q.date)) fail('Pick a date');
      return classesOn(d, q.date, now());
    }
    if (m === 'POST' && pathname === '/api/leads') {
      leadLimit(ip);
      const lead = { id: newId('lead'), ...v.collections.leads({ ...body, status: 'new' }), createdAt: stamp() };
      d.leads.push(lead);
      store.save();
      return { ok: true };
    }

    // Member app
    if (m === 'POST' && pathname === '/api/member/login') {
      memberLoginLimit(ip);
      const idText = String(body.id || '').trim();
      const member = d.members.find((x) => !x.left && (String(x.memberNo) === idText || (normalPhone(idText).length >= 10 && normalPhone(x.phone) === normalPhone(idText))));
      if (!member || !checkPin(String(body.pin || ''), member.pin)) fail('Member number or PIN is wrong', 401);
      const { token, kept } = openSession(d.memberSessions, { memberId: member.id }, MEMBER_SESSION_MS);
      d.memberSessions = kept;
      store.save();
      return { token };
    }
    if (pathname.startsWith('/api/member/')) {
      const member = memberOf(req);
      if (m === 'GET' && pathname === '/api/member/me') {
        const detail = memberDetail(member);
        detail.attendance = detail.attendance.slice(0, 400);
        return detail;
      }
      if (m === 'POST' && pathname === '/api/member/logout') {
        d.memberSessions = d.memberSessions.filter((s) => s.hash !== sha(bearer(req)));
        store.save();
        return { ok: true };
      }
      if (m === 'POST' && pathname === '/api/member/pin') {
        if (!checkPin(String(body.current || ''), member.pin)) fail('Current PIN is wrong', 401);
        if (!/^\d{4,8}$/.test(String(body.next || ''))) fail('New PIN must be 4 to 8 digits');
        member.pin = hashPin(body.next);
        store.save();
        return { ok: true };
      }
      if (m === 'PUT' && pathname === '/api/member/photo') return setPhoto(member, body.image);
      if (m === 'DELETE' && pathname === '/api/member/photo') return clearPhoto(member);
      // One exercise's sets today: [[kg, reps], …]. The coach raises the weight from these.
      if (m === 'PUT' && pathname === '/api/member/lift') {
        const date = v.isoDate(body.date || today());
        const ex = String(body.exerciseId || '');
        if (!/^[a-z0-9-]{2,80}$/.test(ex)) fail('Unknown exercise');
        const sets = (Array.isArray(body.sets) ? body.sets : []).slice(0, 12).map((s) => [
          Math.round(v.num(s[0] ?? 0, { min: 0, max: 500, field: 'Weight', int: false }) * 4) / 4,
          v.num(s[1], { min: 0, max: 200, field: 'Reps' }),
        ]);
        member.lifts ||= {};
        const list = (member.lifts[ex] || []).filter((x) => x.d !== date);
        if (sets.length) list.push({ d: date, s: sets });
        member.lifts[ex] = list.sort((a, b) => a.d.localeCompare(b.d)).slice(-30);
        store.save();
        return member.lifts[ex];
      }
      if (m === 'POST' && pathname === '/api/member/weigh-in') {
        const date = v.isoDate(body.date || today());
        const kg = Math.round(v.num(body.kg, { min: 25, max: 300, field: 'Weight', int: false }) * 10) / 10;
        member.weighIns = [...(member.weighIns || []).filter((x) => x.d !== date), { d: date, kg }].sort((a, b) => a.d.localeCompare(b.d)).slice(-200);
        if (member.body) member.body.weight = Math.round(kg);
        store.save();
        return { weighIns: member.weighIns, body: member.body || null };
      }
      if (m === 'PUT' && pathname === '/api/member/body') {
        const next = v.body(body);
        const old = member.body || {};
        // The journey's clock restarts when the starting look or the wanted body changes.
        const keep = next.target && old.journeyStart && old.target === next.target && old.shape === next.shape;
        const journeyStart = keep ? old.journeyStart : next.target ? today() : null;
        // The journey is measured from the weight on the day it started.
        const startWeight = keep ? old.startWeight || next.weight : next.target ? next.weight : null;
        member.body = { ...next, journeyStart, startWeight, updatedAt: stamp() };
        store.save();
        return member.body;
      }
      if (m === 'PUT' && pathname === '/api/member/plan') {
        member.workoutPlan = { ...v.workoutPlan(body), updatedAt: stamp(), updatedBy: 'member' };
        store.save();
        return member.workoutPlan;
      }
      if (m === 'PUT' && pathname === '/api/member/workout-log') {
        const date = v.isoDate(body.date);
        const done = (Array.isArray(body.done) ? body.done : []).filter((x) => /^[a-z0-9-]{2,80}$/.test(String(x))).slice(0, 30);
        // Keep about two months of ticks so trainers can see how the plan is followed.
        const log = { ...(member.workoutLog || {}), [date]: done };
        member.workoutLog = Object.fromEntries(Object.entries(log).sort().slice(-60));
        store.save();
        return { date, done };
      }
      if (m === 'POST' && pathname === '/api/member/classes') return bookClass(member, body.classId, body.date);
      if (m === 'POST' && (match = pathname.match(/^\/api\/member\/classes\/([\w-]+)\/cancel$/))) {
        const b = d.classBookings.find((x) => x.id === match[1] && x.memberId === member.id) || fail('Booking not found', 404);
        b.status = 'cancelled';
        store.save();
        return b;
      }
      fail('Not found', 404);
    }

    // Owner and front desk
    if (m === 'POST' && pathname === '/api/admin/login') {
      loginLimit(ip);
      const pin = String(body.pin || '');
      const user = checkPin(pin, d.admin.ownerPin) ? null : d.admin.users.find((u) => u.active !== false && checkPin(pin, u.pin));
      if (!user && !checkPin(pin, d.admin.ownerPin)) fail('Wrong PIN', 401);
      const { token, kept } = openSession(d.admin.sessions || [], user ? { role: 'staff', userId: user.id } : { role: 'owner' }, SESSION_MS);
      d.admin.sessions = kept;
      store.save();
      return { token, role: user ? 'staff' : 'owner' };
    }
    if (!pathname.startsWith('/api/admin/')) fail('Not found', 404);
    const me = adminOf(req);
    const { role } = me;
    const can = (perm) => me.perms.includes(perm);
    const owner = () => { if (role !== 'owner') fail('Only the owner can do this', 403); };
    // Any one of the given rights is enough.
    const need = (...perms) => { if (!perms.some(can)) fail('You don’t have access to this. Ask the owner.', 403); };

    if (m === 'POST' && pathname === '/api/admin/logout') {
      d.admin.sessions = d.admin.sessions.filter((s) => s.hash !== sha(bearer(req)));
      store.save();
      return { ok: true };
    }
    if (m === 'GET' && pathname === '/api/admin/data') {
      return {
        role,
        perms: me.perms,
        userName: me.name,
        business: d.business,
        plans: d.plans,
        staff: can('settings') || can('expenses') ? d.staff : d.staff.map(({ salary, ...s }) => s),
        classes: d.classes,
        expenseCategories: d.expenseCategories,
        methods: d.business.paymentMethods || v.METHODS,
        now: now(),
        demo: Boolean(d.demo),
      };
    }
    if (m === 'GET' && pathname === '/api/admin/dashboard') return dashboard(can('reports'));

    // Members
    if (m === 'GET' && pathname === '/api/admin/members') {
      // The front desk searches members to check them in.
      need('members.view', 'checkin');
      const term = String(q.q || '').trim().toLowerCase();
      return summaries()
        .filter((x) => (q.status === 'left' ? x.member.left : !x.member.left || q.status === 'all'))
        .filter((x) => {
          const st = q.status || 'all';
          if (st === 'all' || st === 'left') return true;
          if (st === 'active') return ['active', 'expiring'].includes(x.s.status);
          if (st === 'dues') return x.s.balance > 0;
          if (st === 'inactive') return ['active', 'expiring'].includes(x.s.status) && (x.s.daysSinceVisit === null || x.s.daysSinceVisit >= (d.business.inactiveDays || 10));
          if (st === 'inside') return x.s.inside;
          return x.s.status === st;
        })
        .filter((x) => !q.trainer || x.member.trainerId === q.trainer)
        .filter((x) => !term || [x.member.name, x.member.phone, String(x.member.memberNo)].some((f) => String(f).toLowerCase().includes(term)))
        .map(listItem)
        .sort((a, b) => (q.sort === 'expiry' ? String(a.expiry || '').localeCompare(String(b.expiry || '')) : q.sort === 'name' ? a.name.localeCompare(b.name) : b.memberNo - a.memberNo));
    }
    if (m === 'POST' && pathname === '/api/admin/members/import') {
      need('members.add');
      if (!Array.isArray(body.rows) || !body.rows.length) fail('The file has no members');
      if (body.rows.length > 5000) fail('Import up to 5,000 members at a time');
      if (body.rows.some((r) => r.amount || r.paidOn || r.validTill)) need('fees.collect');
      if (body.existing === 'update') need('members.edit');
      return importMembers(body.rows, { dryRun: Boolean(body.dryRun), existing: body.existing === 'update' ? 'update' : 'skip' });
    }
    if (m === 'POST' && pathname === '/api/admin/members') {
      need('members.add');
      if (body.payment && body.payment.planId) need('fees.collect');
      const data = v.member(body);
      if (d.members.some((x) => !x.left && normalPhone(x.phone) === normalPhone(data.phone))) fail('A member with this phone number already exists', 409);
      const pin = randomPin();
      const member = { id: newId('mem'), memberNo: d.memberSeq++, ...data, pin: hashPin(pin), freezes: [], left: false, createdAt: stamp() };
      d.members.push(member);
      let payment = null;
      if (body.payment && body.payment.planId) {
        try {
          payment = createPayment({ ...body.payment, memberId: member.id });
        } catch (e) {
          d.members.pop();
          d.memberSeq--;
          throw e;
        }
      }
      enrollment.syncMember(member);
      store.save();
      return { member: memberPublic(member), pin, payment };
    }
    if ((match = pathname.match(/^\/api\/admin\/members\/([\w-]+)(?:\/(\w+))?(?:\/(\d+))?$/))) {
      const [, id, action, index] = match;
      const member = findMember(id);
      if (m === 'GET' && !action) {
        need('members.view');
        const detail = memberDetail(member);
        if (!can('fees.view') && !can('fees.collect')) detail.payments = [];
        return detail;
      }
      if (m === 'DELETE' && !action) need('members.delete');
      else if (action === 'classes') need('classes', 'members.edit');
      else need('members.edit');
      if (m === 'PUT' && !action) {
        const data = v.member(body);
        if (d.members.some((x) => x.id !== member.id && !x.left && normalPhone(x.phone) === normalPhone(data.phone))) fail('Another member already uses this phone number', 409);
        const renamed = member.name !== data.name;
        Object.assign(member, data);
        if (renamed) enrollment.syncMember(member);
        store.save();
        return memberPublic(member);
      }
      if (m === 'DELETE' && !action) {
        enrollment.removeMember(member);
        store.deletePhoto(id);
        d.members = d.members.filter((x) => x.id !== id);
        for (const key of ['payments', 'attendance', 'measurements', 'classBookings']) d[key] = d[key].filter((x) => x.memberId !== id);
        d.memberSessions = d.memberSessions.filter((s) => s.memberId !== id);
        store.save();
        return { ok: true };
      }
      if (m === 'POST' && action === 'left') {
        member.left = Boolean(body.left);
        if (member.left) d.memberSessions = d.memberSessions.filter((s) => s.memberId !== id);
        store.save();
        return memberPublic(member);
      }
      if (m === 'POST' && action === 'pin') {
        const pin = randomPin();
        member.pin = hashPin(pin);
        d.memberSessions = d.memberSessions.filter((s) => s.memberId !== id);
        store.save();
        return { pin };
      }
      if (m === 'POST' && action === 'freeze') {
        const from = v.isoDate(body.from, 'From');
        const to = v.isoDate(body.to, 'To');
        if (to < from) fail('The freeze must end after it starts');
        if (diffDays(from, to) > 365) fail('A freeze can be at most a year');
        if ((member.freezes || []).some((f) => f.from <= to && f.to >= from)) fail('This overlaps another freeze');
        member.freezes = [...(member.freezes || []), { from, to, reason: v.str(body.reason, { max: 100 }) }].sort((a, b) => a.from.localeCompare(b.from));
        store.save();
        return memberDetail(member);
      }
      if (m === 'DELETE' && action === 'freeze' && index !== undefined) {
        member.freezes = (member.freezes || []).filter((_, i) => i !== Number(index));
        store.save();
        return memberDetail(member);
      }
      if (m === 'POST' && action === 'classes') return bookClass(member, body.classId, body.date, { asStaff: true });
      if (m === 'PUT' && action === 'photo') return setPhoto(member, body.image);
      if (m === 'DELETE' && action === 'photo') return clearPhoto(member);
      // Register a finger, face, palm, card or PIN on a machine.
      if (action === 'enroll') {
        if (m === 'GET') return enrollment.status(member);
        if (m === 'POST') {
          const device = d.devices.find((x) => x.id === body.deviceId && x.approved) || fail('Choose a machine', 404);
          if (device.protocol !== 'zk') fail('Hikvision terminals register faces on the terminal itself: Person management → add the member with Employee No. ' + member.memberNo + ' → Face.');
          let cmds;
          try { cmds = enrollment.enroll(member, device, body); } catch (e) { fail(e.message); }
          store.save();
          return { commands: cmds.map((c) => c.id), online: publicDevice(device).online };
        }
      }
      if (m === 'PUT' && action === 'plan') {
        member.workoutPlan = { ...v.workoutPlan(body), updatedAt: stamp(), updatedBy: 'trainer' };
        store.save();
        return member.workoutPlan;
      }
    }

    // Payments
    if (m === 'GET' && pathname === '/api/admin/payments') {
      need('fees.view');
      const term = String(q.q || '').trim().toLowerCase();
      const names = new Map(d.members.map((x) => [x.id, x]));
      return d.payments
        .filter((p) => (!q.from || p.date >= q.from) && (!q.to || p.date <= q.to))
        .filter((p) => !q.balance || p.total - paidOf(p) > 0)
        .map((p) => ({ ...p, paid: paidOf(p), member: pick(names.get(p.memberId)) }))
        .filter((p) => !term || [p.member?.name, p.member?.phone, String(p.member?.memberNo), String(p.receiptNo)].some((f) => String(f || '').toLowerCase().includes(term)))
        .sort((a, b) => b.date.localeCompare(a.date) || b.receiptNo - a.receiptNo)
        .slice(0, 1000);
    }
    if (m === 'POST' && pathname === '/api/admin/payments') {
      need('fees.collect');
      const payment = createPayment(body);
      store.save();
      return payment;
    }
    if ((match = pathname.match(/^\/api\/admin\/payments\/([\w-]+)(\/installments)?$/))) {
      const p = d.payments.find((x) => x.id === match[1]) || fail('Payment not found', 404);
      if (m === 'POST' && match[2]) {
        need('fees.collect');
        const amount = v.num(body.amount, { min: 1, max: 100000000, field: 'Amount' });
        if (amount > p.total - paidOf(p)) fail(`Only ${p.total - paidOf(p)} is left to pay on this receipt`);
        p.installments.push({ amount, method: v.method(body.method), date: v.isoDate(body.date || today()) });
        store.save();
        return p;
      }
      if (m === 'DELETE' && !match[2]) {
        need('fees.delete');
        d.payments = d.payments.filter((x) => x.id !== p.id);
        store.save();
        return { ok: true };
      }
    }

    // Attendance
    if (m === 'POST' && pathname === '/api/admin/checkin') { need('checkin'); return checkInOut(body, can('checkin.override')); }
    if (m === 'GET' && pathname === '/api/admin/attendance') {
      // The front desk sees today's log next to the check-in box.
      need('attendance', 'checkin');
      const date = isDate(q.date) ? q.date : today();
      const names = new Map(d.members.map((x) => [x.id, x]));
      const list = d.attendance.filter((a) => a.date === date).map((a) => ({ ...a, member: pick(names.get(a.memberId)) })).sort((a, b) => b.in.localeCompare(a.in));
      const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: list.filter((a) => Math.floor(toMin(a.in) / 60) === h).length }));
      return { date, list, hours };
    }
    if ((match = pathname.match(/^\/api\/admin\/attendance\/([\w-]+)$/))) {
      need('attendance');
      const a = d.attendance.find((x) => x.id === match[1]) || fail('Visit not found', 404);
      if (m === 'PATCH') {
        const inT = body.in ?? a.in;
        const outT = body.out === '' ? null : body.out ?? a.out;
        if (!/^\d{2}:\d{2}$/.test(inT) || (outT && !/^\d{2}:\d{2}$/.test(outT))) fail('Times must look like 18:30');
        if (outT && outT < inT) fail('Check-out must be after check-in');
        Object.assign(a, { in: inT, out: outT });
        store.save();
        return a;
      }
      if (m === 'DELETE') {
        d.attendance = d.attendance.filter((x) => x.id !== a.id);
        store.save();
        return { ok: true };
      }
    }

    // Classes
    if (m === 'GET' && pathname === '/api/admin/class-day') {
      need('classes');
      const date = isDate(q.date) ? q.date : today();
      const names = new Map(d.members.map((x) => [x.id, x]));
      return classesOn(d, date, now()).map((c) => ({
        ...c,
        attendees: d.classBookings.filter((b) => b.classId === c.id && b.date === date && b.status === 'booked').map((b) => ({ bookingId: b.id, ...pick(names.get(b.memberId)) })),
      }));
    }
    if (m === 'POST' && (match = pathname.match(/^\/api\/admin\/class-bookings\/([\w-]+)\/cancel$/))) {
      need('classes');
      const b = d.classBookings.find((x) => x.id === match[1]) || fail('Booking not found', 404);
      b.status = 'cancelled';
      store.save();
      return b;
    }

    // Monthly register (a day or a month)
    if (m === 'GET' && pathname === '/api/admin/register') {
      need('attendance');
      const t = today();
      if (isDate(q.day)) return register(q.day, q.day);
      const month = /^\d{4}-\d{2}$/.test(q.month || '') ? q.month : monthKey(t);
      return register(`${month}-01`, monthEnd(month) < t ? monthEnd(month) : t);
    }

    // Attendance machines (fingerprint / face)
    if (pathname.startsWith('/api/admin/devices') && pathname !== '/api/admin/devices/test-punch') need('machines');
    if (m === 'GET' && pathname === '/api/admin/devices') return { types: DEVICE_TYPES, devices: d.devices.map(publicDevice) };
    if (m === 'POST' && pathname === '/api/admin/devices') return addDevice(body);
    if (m === 'POST' && pathname === '/api/admin/devices/test-punch') {
      need('machines', 'checkin');
      const n = now();
      const result = recordPunch(v.str(body.memberNo, { max: 10, required: true, field: 'Member number' }), n.date, fromMin(n.minutes), 'fingerprint');
      if (result === 'unknown') fail(`No member with number ${body.memberNo}`, 404);
      store.save();
      const member = d.members.find((x) => x.memberNo === Number(body.memberNo));
      return { result, member: memberPublic(member), summary: summaryOf(member) };
    }
    if ((match = pathname.match(/^\/api\/admin\/devices\/([\w.-]+)(\/check|\/sync)?$/))) {
      const device = d.devices.find((x) => x.id === match[1]) || fail('Machine not found', 404);
      if (m === 'GET' && match[2] === '/check') return checkDevice(device);
      if (m === 'POST' && match[2] === '/sync') {
        if (device.protocol !== 'zk') fail('Only ZKTeco-type machines take members from the app');
        enrollment.syncAll(device);
        store.save();
        return { queued: d.members.filter((x) => !x.left).length };
      }
      if (m === 'PUT' && !match[2]) {
        if (body.approved !== undefined) device.approved = Boolean(body.approved);
        if (body.name !== undefined) device.name = v.str(body.name, { max: 60 }) || device.name;
        // Fixing a mistyped serial number: take over the machine that is actually calling.
        if (body.sn !== undefined && device.protocol === 'zk') {
          const sn = v.str(body.sn, { max: 40, required: true, field: 'Serial number' }).toUpperCase().replace(/\s+/g, '');
          if (!/^[A-Z0-9-]{4,40}$/.test(sn)) fail('The serial number has only letters and numbers');
          const found = d.devices.find((x) => x.id !== device.id && x.protocol === 'zk' && x.sn.toUpperCase() === sn);
          if (found && found.approved) fail(`Serial ${sn} is already added as "${found.name}"`, 409);
          if (found) {
            Object.assign(device, { firstSeen: found.firstSeen, lastSeen: found.lastSeen });
            d.devices = d.devices.filter((x) => x.id !== found.id);
          }
          device.sn = sn;
        }
        store.save();
        return publicDevice(device);
      }
      if (m === 'DELETE' && !match[2]) {
        d.devices = d.devices.filter((x) => x.id !== device.id);
        store.save();
        return { ok: true };
      }
    }

    // Entry screen
    if (m === 'GET' && pathname === '/api/admin/display') { need('checkin'); return displayFeed(); }

    // Reports and owner settings
    if (m === 'GET' && pathname === '/api/admin/report') {
      need('reports');
      return report(/^\d{4}-\d{2}$/.test(q.month || '') ? q.month : monthKey(today()));
    }
    if (m === 'GET' && pathname === '/api/admin/expenses') {
      need('expenses');
      return d.expenses.filter((e) => !q.month || monthKey(e.date) === q.month).sort((a, b) => b.date.localeCompare(a.date));
    }
    if (m === 'GET' && pathname === '/api/admin/leads') need('leads');
    if (m === 'GET' && pathname === '/api/admin/leads') return [...d.leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (m === 'PUT' && pathname === '/api/admin/business') {
      need('settings');
      d.business = v.business(body, d.business);
      store.save();
      return d.business;
    }
    if (m === 'PUT' && pathname === '/api/admin/expense-categories') {
      need('settings', 'expenses');
      const list = (Array.isArray(body.categories) ? body.categories : []).map((c) => v.str(c, { max: 40 })).filter(Boolean);
      if (!list.length) fail('Keep at least one category');
      d.expenseCategories = [...new Set(list)].slice(0, 30);
      store.save();
      return d.expenseCategories;
    }
    if (m === 'POST' && pathname === '/api/admin/pins') {
      owner();
      if (!checkPin(String(body.current || ''), d.admin.ownerPin)) fail('Current owner PIN is wrong', 401);
      const pin = String(body.owner || '');
      if (!/^\d{4,8}$/.test(pin)) fail('PINs must be 4 to 8 digits');
      if (d.admin.users.some((u) => checkPin(pin, u.pin))) fail('A staff login already uses this PIN', 409);
      d.admin.ownerPin = hashPin(pin);
      store.save();
      return { ok: true };
    }

    // Staff logins and what each may do (owner only)
    if (pathname === '/api/admin/users' || pathname.startsWith('/api/admin/users/')) {
      owner();
      const id = pathname.split('/')[4];
      if (m === 'GET' && !id) return { permissions: PERMISSIONS, presets: PRESETS, users: d.admin.users.map(userPublic) };
      if (m === 'POST' && !id) {
        const clean = staffUser(body);
        const pin = String(body.pin || '');
        if (!/^\d{4,8}$/.test(pin)) fail('The PIN must be 4 to 8 digits');
        if (pinTaken(pin)) fail('This PIN is already used. Choose another.', 409);
        const user = { id: newId('usr'), ...clean, pin: hashPin(pin), createdAt: stamp() };
        d.admin.users.push(user);
        store.save();
        return userPublic(user);
      }
      const user = d.admin.users.find((u) => u.id === id) || fail('Staff login not found', 404);
      const signOutUser = () => { d.admin.sessions = d.admin.sessions.filter((s) => s.userId !== user.id); };
      if (m === 'PUT') {
        Object.assign(user, staffUser(body, user));
        if (body.pin) {
          const pin = String(body.pin);
          if (!/^\d{4,8}$/.test(pin)) fail('The PIN must be 4 to 8 digits');
          if (pinTaken(pin, user.id)) fail('This PIN is already used. Choose another.', 409);
          user.pin = hashPin(pin);
          signOutUser();
        }
        if (!user.active) signOutUser();
        store.save();
        return userPublic(user);
      }
      if (m === 'DELETE') {
        d.admin.users = d.admin.users.filter((u) => u.id !== user.id);
        signOutUser();
        store.save();
        return { ok: true };
      }
    }
    // Exercise videos: a YouTube / Shorts link or a short clip uploaded by the gym
    // Real photos for the body-type pictures ("male-now-belly", "female-want-toned"…).
    if ((match = pathname.match(/^\/api\/admin\/body-photos\/((?:male|female)-(?:now|want)-[a-z]{3,12})$/))) {
      need('settings');
      const key = match[1];
      d.bodyPhotos ||= {};
      if (m === 'PUT') {
        const img = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
        if (!img) fail('Choose a photo (JPG or PNG)');
        if (img[2].length > 900 * 1024) fail('That photo is too large. Please choose a smaller one.');
        d.bodyPhotos[key] = store.savePhoto(`body-${key}`, img[2]);
        store.save();
        return d.bodyPhotos;
      }
      if (m === 'DELETE') {
        store.deletePhoto(`body-${key}`);
        delete d.bodyPhotos[key];
        store.save();
        return d.bodyPhotos;
      }
    }
    if ((match = pathname.match(/^\/api\/admin\/exercise-videos\/([\w-]{1,80})(\/file)?$/))) {
      need('settings', 'members.edit');
      const exId = match[1];
      d.exerciseVideos ||= {};
      if (m === 'DELETE' && !match[2]) {
        if (d.exerciseVideos[exId]?.type === 'file') store.deleteVideo(exId);
        delete d.exerciseVideos[exId];
        store.save();
        return { ok: true };
      }
      if (m === 'PUT' && match[2]) {
        const buf = body.file;
        // MP4 and MOV files have "ftyp" right after the first 4 bytes.
        if (!Buffer.isBuffer(buf) || buf.length < 1000 || buf.subarray(4, 8).toString('latin1') !== 'ftyp') fail('Upload an MP4 video (most phones record MP4; on iPhone choose "Most compatible" in Camera → Formats)');
        d.exerciseVideos[exId] = { type: 'file', src: store.saveVideo(exId, buf), size: buf.length, addedAt: stamp() };
        store.save();
        return d.exerciseVideos[exId];
      }
      if (m === 'PUT') {
        const id = youtubeId(body.url) || fail('Paste a YouTube or YouTube Shorts link');
        if (d.exerciseVideos[exId]?.type === 'file') store.deleteVideo(exId);
        d.exerciseVideos[exId] = { type: 'youtube', id, short: /\/shorts\//.test(String(body.url)), addedAt: stamp() };
        store.save();
        return d.exerciseVideos[exId];
      }
    }

    // Automatic WhatsApp reminders
    if (pathname === '/api/admin/whatsapp' || pathname === '/api/admin/whatsapp/test') {
      need('settings');
      if (m === 'GET') {
        const { token, ...cfg } = reminders.cfgOf();
        return { settings: { ...cfg, hasToken: Boolean(token) }, templates: TEMPLATES, dueToday: reminders.due().length };
      }
      if (m === 'PUT' && pathname === '/api/admin/whatsapp') {
        const cur = d.whatsapp || {};
        const days = Math.round(Number(body.daysBefore));
        if (!(days >= 1 && days <= 30)) fail('Start reminders 1 to 30 days before');
        if (!/^\d{2}:\d{2}$/.test(String(body.sendAt || ''))) fail('Choose the time to send, like 10:00');
        d.whatsapp = {
          ...cur,
          enabled: Boolean(body.enabled),
          phoneNumberId: v.str(body.phoneNumberId, { max: 40 }).replace(/\D/g, ''),
          // Blank keeps the saved token, so it is never sent back to the browser.
          token: body.token ? v.str(body.token, { max: 600 }) : cur.token || '',
          templateName: v.str(body.templateName, { max: 60 }).toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'membership_reminder',
          templateLang: v.str(body.templateLang, { max: 10 }) || 'en',
          countryCode: v.str(body.countryCode, { max: 4 }).replace(/\D/g, ''),
          daysBefore: days,
          every: body.every === 'some' ? 'some' : 'day',
          sendAt: body.sendAt,
        };
        if (d.whatsapp.enabled && (!d.whatsapp.phoneNumberId || !d.whatsapp.token)) fail('Add the phone number ID and access token to switch reminders on');
        if (!d.whatsapp.countryCode) fail('Enter your country calling code, e.g. 92');
        store.save();
        return { ok: true };
      }
      if (m === 'POST' && pathname === '/api/admin/whatsapp/test') {
        try { return await reminders.test(v.str(body.phone, { max: 24, required: true, field: 'Phone' })); } catch (e) { fail(`WhatsApp: ${e.message}`); }
      }
    }
    if (m === 'GET' && pathname === '/api/admin/reminders') {
      need('members.view');
      const names = new Map(d.members.map((x) => [x.id, x]));
      return {
        log: (d.reminders || []).slice(0, 100).map((r) => ({ ...r, member: pick(names.get(r.memberId)) })),
        due: reminders.due().map((r) => ({ member: pick(r.member), expiry: r.expiry, day: r.day })),
        enabled: Boolean(d.whatsapp?.enabled),
        lastRun: d.whatsapp?.lastRun || null,
      };
    }
    if (m === 'POST' && pathname === '/api/admin/clear-data') {
      owner();
      if (body.confirm !== 'DELETE') fail('Type DELETE to confirm');
      store.clearData();
      return { ok: true };
    }

    // Simple collections
    if ((match = pathname.match(/^\/api\/admin\/(plans|staff|classes|expenses|measurements|leads)(?:\/([\w-]+))?$/))) {
      const [, collection, id] = match;
      if (!(collection === 'staff' && m === 'GET')) need(...COLLECTION_RIGHTS[collection]);
      const list = d[collection];
      if (m === 'POST' && !id) {
        const clean = v.collections[collection](body);
        if (collection === 'measurements') findMember(clean.memberId);
        const item = { id: newId(collection.slice(0, 3)), ...clean, ...(collection === 'leads' ? { createdAt: stamp() } : {}) };
        list.push(item);
        store.save();
        return item;
      }
      if (m === 'PUT' && id) {
        const item = list.find((x) => x.id === id) || fail('Not found', 404);
        Object.assign(item, v.collections[collection]({ ...item, ...body }));
        store.save();
        return item;
      }
      if (m === 'DELETE' && id) {
        if (collection === 'plans' && d.plans.length === 1) fail('Keep at least one plan');
        d[collection] = list.filter((x) => x.id !== id);
        store.save();
        return { ok: true };
      }
    }
    fail('Not found', 404);
  }

  // The platform owner opening a gym's dashboard to help them.
  function ownerToken() {
    const d = db();
    const { token, kept } = openSession(d.admin.sessions || [], { role: 'owner', support: true }, 8 * 60 * 60 * 1000);
    d.admin.sessions = kept;
    store.save();
    return token;
  }

  return { handle, handleDevice, handleHikvision, ownerToken, reminders };
}

module.exports = { createApi, HttpError, weekdayOf, youtubeId };
