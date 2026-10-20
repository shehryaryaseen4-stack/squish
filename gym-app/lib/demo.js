'use strict';

// Builds 14 months of believable gym history ending today, so a fresh install
// shows a living dashboard. The owner can wipe it from Settings.

const { addDays, addMonths, diffDays, weekdayOf, fromMin } = require('./time');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEN = ['Ahmed', 'Ali', 'Hassan', 'Usama', 'Hamza', 'Bilal', 'Fahad', 'Saad', 'Zain', 'Omer', 'Danish', 'Faraz', 'Shahzaib', 'Talha', 'Waleed', 'Haris', 'Asad', 'Junaid', 'Imran', 'Rehan', 'Taimoor', 'Sameer', 'Adeel', 'Kashif', 'Nabeel', 'Shoaib', 'Arslan', 'Moiz'];
const WOMEN = ['Ayesha', 'Fatima', 'Hira', 'Sana', 'Mahnoor', 'Zainab', 'Iqra', 'Maryam', 'Areeba', 'Komal', 'Rabia', 'Noor', 'Anum', 'Sadia', 'Laiba', 'Mehwish'];
const LAST = ['Khan', 'Ahmed', 'Malik', 'Sheikh', 'Qureshi', 'Siddiqui', 'Raza', 'Butt', 'Chaudhry', 'Mirza', 'Hussain', 'Abbasi', 'Javed', 'Iqbal', 'Baig', 'Shah', 'Rana', 'Hashmi'];
const AREAS = ['DHA Phase 5', 'DHA Phase 6', 'Clifton Block 4', 'Bahadurabad', 'PECHS Block 2', 'Gulshan-e-Iqbal 13D', 'Khayaban-e-Bukhari', 'Tariq Road'];
const GOALS = ['Weight loss', 'Muscle gain', 'General fitness', 'Strength', 'Stay active', 'Sports conditioning'];
const METHODS = ['Cash', 'Cash', 'Cash', 'Bank transfer', 'JazzCash', 'EasyPaisa', 'Card'];

function generateDemo(db, now, { memberPin }) {
  const r = rng(20261020);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const between = (a, b) => a + Math.floor(r() * (b - a + 1));
  const today = now.date;
  const plans = db.plans;
  const planFor = () => {
    const x = r();
    return x < 0.55 ? plans[0] : x < 0.8 ? plans[1] : x < 0.92 ? plans[2] : plans[3];
  };
  let receipt = 1;
  let idSeq = 1;
  const id = (p) => `${p}-${(idSeq++).toString(36).padStart(5, '0')}`;

  const types = ['regular', 'regular', 'regular', 'casual', 'casual', 'casual', 'gappy', 'gappy', 'lapsed', 'lapsed', 'dues', 'new'];
  const COUNT = 100;
  for (let n = 0; n < COUNT; n++) {
    const female = r() < 0.32;
    const first = female ? pick(WOMEN) : pick(MEN);
    const type = types[n % types.length];
    const joinDate = type === 'new' ? addDays(today, -between(1, 20)) : addDays(today, -between(25, 430));
    const member = {
      id: id('mem'),
      memberNo: 1001 + n,
      name: `${first} ${pick(LAST)}`,
      phone: `03${between(0, 4)}${between(0, 9)}${String(between(1000000, 9999999))}`,
      gender: female ? 'female' : 'male',
      dob: addDays(today, -between(17 * 365, 48 * 365)),
      address: pick(AREAS),
      emergencyName: `${pick(MEN)} ${pick(LAST)}`,
      emergencyPhone: `03${between(0, 4)}${between(0, 9)}${String(between(1000000, 9999999))}`,
      joinDate,
      trainerId: r() < 0.3 ? pick(db.staff.slice(0, 3)).id : '',
      goal: pick(GOALS),
      notes: r() < 0.15 ? pick(['Knee injury, avoid heavy squats', 'Prefers morning slot', 'Referred by a friend', 'Student discount']) : '',
      pin: memberPin,
      freezes: [],
      left: false,
      createdAt: `${joinDate}T10:00:00.000Z`,
    };
    db.members.push(member);

    // Fee periods, back to back from the join date, with gaps and lapses by type.
    const periods = [];
    let start = joinDate;
    let cycles = 0;
    const lapseAfter = between(2, 5);
    const plan = planFor();
    while (start <= today) {
      if (type === 'lapsed' && cycles >= lapseAfter) break;
      if (type === 'gappy' && cycles > 0 && r() < 0.3) start = addMonths(start, between(1, 2));
      if (start > today) break;
      const p = cycles > 2 && r() < 0.15 ? planFor() : plan;
      const end = addDays(addMonths(start, p.months), -1);
      const first = cycles === 0;
      const discount = r() < 0.12 ? Math.round(p.price * 0.1 / 100) * 100 : 0;
      const admissionFee = first ? db.business.admissionFee : 0;
      const total = p.price - discount + admissionFee;
      const paidOn = addDays(start, r() < 0.7 ? 0 : between(1, 6));
      const date = paidOn > today ? today : paidOn;
      const isLast = addDays(end, 1) > today;
      let installments = [{ amount: total, method: pick(METHODS), date }];
      if (type === 'dues' && isLast) {
        const part = Math.round(total * 0.5 / 500) * 500;
        installments = [{ amount: part, method: 'Cash', date }];
      }
      db.payments.push({
        id: id('pay'), receiptNo: receipt++, memberId: member.id, planId: p.id, planName: p.name, months: p.months,
        periodStart: start, periodEnd: end, price: p.price, discount, admissionFee, total, installments,
        date, note: discount ? 'Loyalty discount' : '', createdAt: `${date}T12:00:00.000Z`,
      });
      periods.push([start, end]);
      start = addDays(end, 1);
      cycles++;
    }

    // One freeze for a few long-term members.
    if (type === 'regular' && r() < 0.3 && periods.length > 3) {
      const [s] = periods[periods.length - 2];
      const from = addDays(s, between(3, 10));
      member.freezes.push({ from, to: addDays(from, between(7, 14)), reason: pick(['Travel', 'Illness', 'Exams']) });
    }

    // Visits on covered days, at the member's usual time of day.
    const perWeek = { regular: 4.5, casual: 2.5, gappy: 3, lapsed: 3, dues: 3, new: 4 }[type];
    const morning = r() < 0.4;
    const usual = morning ? between(6 * 60, 9 * 60) : between(17 * 60, 21 * 60 + 30);
    const covered = (d) => periods.some(([a, b]) => a <= d && d <= b) && !member.freezes.some((f) => f.from <= d && d <= f.to);
    const span = diffDays(joinDate, today);
    // Some members drift off for a month even though they paid.
    const skipMonth = type === 'casual' && r() < 0.5 ? addMonths(joinDate, between(1, 6)).slice(0, 7) : null;
    for (let i = 0; i <= span; i++) {
      const d = addDays(joinDate, i);
      if (!covered(d) || d.slice(0, 7) === skipMonth) continue;
      const wd = weekdayOf(d);
      const chance = (perWeek / 6) * (wd === 0 ? 0.4 : wd === 5 ? 0.7 : 1);
      if (r() > chance) continue;
      const inMin = Math.max(6 * 60, Math.min(22 * 60, usual + between(-40, 40)));
      const stay = between(45, 110);
      if (d === today) {
        if (inMin > now.minutes) continue;
        const out = inMin + stay <= now.minutes ? fromMin(inMin + stay) : null;
        db.attendance.push({ id: id('att'), memberId: member.id, date: d, in: fromMin(inMin), out });
      } else {
        db.attendance.push({ id: id('att'), memberId: member.id, date: d, in: fromMin(inMin), out: r() < 0.03 ? null : fromMin(Math.min(23 * 60 + 30, inMin + stay)) });
      }
    }

    // Monthly body measurements for about half the members.
    if (r() < 0.5 && span > 40) {
      const gain = member.goal === 'Muscle gain';
      let weight = female ? between(55, 85) : between(68, 105);
      let fat = female ? between(26, 36) : between(17, 30);
      const height = female ? between(152, 170) : between(165, 188);
      for (let d = joinDate; d <= today; d = addMonths(d, 1)) {
        db.measurements.push({
          id: id('mea'), memberId: member.id, date: d, weight, height, bodyFat: fat,
          chest: Math.round(weight * 1.05), waist: Math.round(weight * (female ? 0.95 : 0.98) - (gain ? 4 : 0)), arms: Math.round(weight * 0.4), note: '',
        });
        weight = Math.round((weight + (gain ? r() * 1.2 : -r() * 1.6)) * 10) / 10;
        fat = Math.max(9, Math.round((fat - r() * 0.8) * 10) / 10);
      }
    }
  }

  // Running costs: rent and salaries on the 1st, bills mid-month, the odd repair.
  const startMonth = addMonths(today, -13).slice(0, 7);
  for (let d = `${startMonth}-01`; d <= today; d = addMonths(d, 1)) {
    db.expenses.push({ id: id('exp'), date: d, category: 'Rent', amount: 90000, method: 'Bank transfer', note: 'Monthly rent' });
    for (const s of db.staff) db.expenses.push({ id: id('exp'), date: addDays(d, 1), category: 'Salaries', amount: s.salary, method: 'Bank transfer', note: s.name });
    const bill = addDays(d, 14);
    if (bill <= today) {
      db.expenses.push({ id: id('exp'), date: bill, category: 'Electricity', amount: between(30, 52) * 1000, method: 'Bank transfer', note: 'K-Electric bill' });
      db.expenses.push({ id: id('exp'), date: addDays(bill, 2), category: 'Water & gas', amount: between(4, 9) * 1000, method: 'Cash', note: '' });
    }
    if (r() < 0.4 && addDays(d, 20) <= today) db.expenses.push({ id: id('exp'), date: addDays(d, 20), category: pick(['Maintenance', 'Equipment', 'Marketing', 'Supplements stock']), amount: between(8, 60) * 1000, method: 'Cash', note: pick(['Treadmill belt', 'New dumbbells', 'Instagram ads', 'Cable machine service', 'Protein stock']) });
  }

  for (let i = 0; i < 6; i++) {
    db.leads.push({
      id: id('lead'), name: `${pick(MEN)} ${pick(LAST)}`, phone: `03${between(0, 4)}${between(0, 9)}${String(between(1000000, 9999999))}`,
      interest: pick(plans).name, message: pick(['Want to visit for a trial', 'Fees for couples?', 'Do you have a female trainer?', 'Timings on Friday?', '']),
      status: i < 3 ? 'new' : pick(['contacted', 'joined']), createdAt: `${addDays(today, -i * 2)}T11:00:00.000Z`,
    });
  }

  const ex = (id, sets = 3, reps = '10-12') => ({ id, sets, reps });
  const push = { groups: ['chest', 'shoulders', 'triceps'], exercises: [ex('barbell-bench-press-medium-grip', 4, '8-10'), ex('barbell-incline-bench-press-medium-grip'), ex('dumbbell-flyes'), ex('dumbbell-shoulder-press'), ex('side-lateral-raise', 3, '12-15'), ex('triceps-pushdown'), ex('ez-bar-skullcrusher')] };
  const pull = { groups: ['back', 'biceps'], exercises: [ex('wide-grip-lat-pulldown'), ex('bent-over-barbell-row', 4, '8-10'), ex('seated-cable-rows'), ex('one-arm-dumbbell-row'), ex('barbell-curl'), ex('hammer-curls')] };
  const legs = { groups: ['legs', 'abs'], exercises: [ex('barbell-squat', 4, '8-10'), ex('leg-press'), ex('lying-leg-curls'), ex('leg-extensions'), ex('standing-calf-raises', 4, '15'), ex('hanging-leg-raise', 3, '15'), ex('plank', 3, '45s')] };
  db.members[0].workoutPlan = { days: { mon: push, tue: pull, wed: legs, thu: push, fri: pull, sat: legs }, updatedAt: `${today}T08:00:00.000Z`, updatedBy: 'member' };

  db.receiptSeq = receipt;
  db.memberSeq = 1001 + COUNT;
  db.demo = true;
}

module.exports = { generateDemo };
