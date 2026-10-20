'use strict';

const { isTime, DAYS } = require('./time');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (message, status = 400) => { throw new HttpError(status, message); };

function str(v, { max = 200, required = false, field = 'Value' } = {}) {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (required && !s) fail(`${field} is required`);
  if (s.length > max) fail(`${field} is too long`);
  return s;
}

function num(v, { min = 0, max = 1e9, field = 'Value', int = true } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) fail(`${field} must be a number between ${min} and ${max}`);
  return n;
}

function phone(v) {
  const s = str(v, { max: 24, required: true, field: 'Phone' }).replace(/[\s()-]/g, '');
  if (!/^\+?\d{7,15}$/.test(s)) fail('Enter a valid phone number');
  return s;
}

function color(v) {
  const s = str(v, { max: 7, field: 'Colour' });
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) fail('Colour must be a hex value like #7c5cff');
  return s.toLowerCase();
}

function hours(v) {
  if (!v || typeof v !== 'object') fail('Opening hours are required');
  const out = {};
  for (const day of DAYS) {
    const ranges = Array.isArray(v[day]) ? v[day] : [];
    out[day] = ranges.slice(0, 4).map((r) => {
      if (!Array.isArray(r) || !isTime(r[0]) || !isTime(r[1]) || r[0] >= r[1]) fail(`Check the opening hours for ${day}`);
      return [r[0], r[1]];
    });
  }
  return out;
}

const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 50) : []);

const isoDate = (v, field = 'Date', { required = true } = {}) => {
  const s = str(v, { max: 10, field });
  if (!s && !required) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) fail(`${field} must be a valid date`);
  return s;
};
const optNum = (v, opts) => (v === '' || v == null ? null : num(v, { int: false, ...opts }));
const METHODS = ['Cash', 'Bank transfer', 'JazzCash', 'EasyPaisa', 'Card', 'Other'];
const method = (v) => (METHODS.includes(v) ? v : 'Cash');

// Per-collection sanitisers used by the admin CRUD routes.
const collections = {
  plans: (b) => ({
    name: str(b.name, { max: 40, required: true, field: 'Name' }),
    months: num(b.months, { min: 1, max: 36, field: 'Months' }),
    price: num(b.price, { min: 0, max: 100000000, field: 'Price' }),
    features: (Array.isArray(b.features) ? b.features : String(b.features || '').split('\n'))
      .map((f) => String(f).trim()).filter(Boolean).slice(0, 12).map((f) => f.slice(0, 80)),
    highlight: Boolean(b.highlight),
    active: b.active !== false,
  }),
  staff: (b) => ({
    name: str(b.name, { max: 60, required: true, field: 'Name' }),
    role: str(b.role, { max: 60 }),
    phone: str(b.phone, { max: 24 }),
    salary: num(b.salary || 0, { min: 0, max: 100000000, field: 'Salary' }),
    color: b.color ? color(b.color) : '#f97316',
    active: b.active !== false,
  }),
  classes: (b) => {
    const start = str(b.start, { required: true, field: 'Start time' });
    if (!isTime(start)) fail('Start time must look like 18:30');
    return {
      name: str(b.name, { max: 60, required: true, field: 'Name' }),
      staffId: str(b.staffId, { max: 60 }),
      weekday: num(b.weekday, { min: 0, max: 6, field: 'Day' }),
      start,
      duration: num(b.duration, { min: 10, max: 300, field: 'Duration' }),
      capacity: num(b.capacity, { min: 1, max: 500, field: 'Capacity' }),
      level: str(b.level, { max: 40 }),
      active: b.active !== false,
    };
  },
  expenses: (b) => ({
    date: isoDate(b.date),
    category: str(b.category, { max: 40, required: true, field: 'Category' }),
    amount: num(b.amount, { min: 1, max: 100000000, field: 'Amount' }),
    method: method(b.method),
    note: str(b.note, { max: 200 }),
  }),
  measurements: (b) => ({
    memberId: str(b.memberId, { max: 40, required: true, field: 'Member' }),
    date: isoDate(b.date),
    weight: optNum(b.weight, { min: 10, max: 400, field: 'Weight' }),
    height: optNum(b.height, { min: 50, max: 260, field: 'Height' }),
    bodyFat: optNum(b.bodyFat, { min: 1, max: 80, field: 'Body fat' }),
    chest: optNum(b.chest, { min: 20, max: 250, field: 'Chest' }),
    waist: optNum(b.waist, { min: 20, max: 250, field: 'Waist' }),
    arms: optNum(b.arms, { min: 5, max: 100, field: 'Arms' }),
    note: str(b.note, { max: 200 }),
  }),
  leads: (b) => ({
    name: str(b.name, { max: 60, required: true, field: 'Name' }),
    phone: phone(b.phone),
    interest: str(b.interest, { max: 40 }),
    message: str(b.message, { max: 300 }),
    status: ['new', 'contacted', 'joined', 'lost'].includes(b.status) ? b.status : 'new',
  }),
};

function member(b) {
  return {
    name: str(b.name, { max: 60, required: true, field: 'Name' }),
    phone: phone(b.phone),
    gender: ['male', 'female', 'other'].includes(b.gender) ? b.gender : 'male',
    dob: isoDate(b.dob, 'Date of birth', { required: false }),
    address: str(b.address, { max: 200 }),
    emergencyName: str(b.emergencyName, { max: 60 }),
    emergencyPhone: str(b.emergencyPhone, { max: 24 }),
    joinDate: isoDate(b.joinDate, 'Join date'),
    trainerId: str(b.trainerId, { max: 40 }),
    goal: str(b.goal, { max: 60 }),
    notes: str(b.notes, { max: 500 }),
  };
}

function payment(b) {
  return {
    memberId: str(b.memberId, { max: 40, required: true, field: 'Member' }),
    planId: str(b.planId, { max: 40, required: true, field: 'Plan' }),
    periodStart: isoDate(b.periodStart, 'Start date'),
    date: isoDate(b.date, 'Payment date'),
    discount: num(b.discount || 0, { min: 0, max: 100000000, field: 'Discount' }),
    admissionFee: num(b.admissionFee || 0, { min: 0, max: 100000000, field: 'Admission fee' }),
    paid: num(b.paid, { min: 0, max: 100000000, field: 'Amount received' }),
    method: method(b.method),
    note: str(b.note, { max: 200 }),
  };
}

// A weekly workout plan: for each day, the muscle groups and the exercises
// (from the exercise library) with sets and reps. An empty day is a rest day.
function workoutPlan(b) {
  const days = b && typeof b.days === 'object' && b.days ? b.days : {};
  const out = {};
  for (const day of DAYS) {
    const raw = days[day];
    if (!raw) continue;
    const groups = (Array.isArray(raw.groups) ? raw.groups : []).filter((g) => /^[a-z]{2,20}$/.test(g)).slice(0, 6);
    const exercises = (Array.isArray(raw.exercises) ? raw.exercises : []).slice(0, 20).map((e) => {
      if (!e || !/^[a-z0-9-]{2,80}$/.test(String(e.id))) fail('Unknown exercise');
      return { id: e.id, sets: num(e.sets || 3, { min: 1, max: 10, field: 'Sets' }), reps: str(e.reps || '10-12', { max: 12, field: 'Reps' }) };
    });
    if (groups.length || exercises.length) out[day] = { groups, exercises };
  }
  return { days: out };
}

function business(b, current) {
  return {
    ...current,
    name: str(b.name, { max: 60, required: true, field: 'Gym name' }),
    tagline: str(b.tagline, { max: 120 }),
    accent: color(b.accent || current.accent),
    currency: str(b.currency, { max: 3 }).toUpperCase() || 'PKR',
    currencySymbol: str(b.currencySymbol, { max: 4 }) || 'Rs',
    locale: str(b.locale, { max: 10 }) || current.locale || 'en-PK',
    timeZone: validTimeZone(b.timeZone || current.timeZone),
    phone: str(b.phone, { max: 24 }),
    whatsapp: str(b.whatsapp, { max: 20 }).replace(/\D/g, ''),
    email: str(b.email, { max: 80 }),
    address: str(b.address, { max: 200 }),
    mapUrl: safeUrl(b.mapUrl),
    instagram: str(b.instagram, { max: 40 }).replace(/^@/, ''),
    admissionFee: num(b.admissionFee || 0, { min: 0, max: 10000000, field: 'Admission fee' }),
    expiringDays: num(b.expiringDays, { min: 1, max: 60, field: 'Expiry warning days' }),
    inactiveDays: num(b.inactiveDays, { min: 3, max: 90, field: 'Inactive after days' }),
    blockExpiredCheckin: b.blockExpiredCheckin === true || b.blockExpiredCheckin === 'on' || b.blockExpiredCheckin === 'true',
    bookingWindowDays: num(b.bookingWindowDays, { min: 1, max: 60, field: 'Class booking window' }),
    hours: hours(b.hours),
    closedDates: (Array.isArray(b.closedDates) ? b.closedDates : []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 100),
  };
}

function validTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return fail('Unknown time zone');
  }
}

function safeUrl(v) {
  const s = str(v, { max: 500 });
  if (!s) return '';
  if (!/^https:\/\//i.test(s)) fail('Map link must start with https://');
  return s;
}

module.exports = { HttpError, fail, str, num, phone, color, isoDate, method, METHODS, collections, member, payment, business, workoutPlan };
