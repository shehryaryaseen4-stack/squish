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

// Per-collection sanitisers used by the admin CRUD routes.
const collections = {
  categories: (b) => ({
    name: str(b.name, { max: 40, required: true, field: 'Name' }),
    icon: str(b.icon, { max: 20 }) || 'sparkles',
  }),
  services: (b) => ({
    categoryId: str(b.categoryId, { max: 60, required: true, field: 'Category' }),
    name: str(b.name, { max: 80, required: true, field: 'Name' }),
    description: str(b.description, { max: 400 }),
    duration: num(b.duration, { min: 5, max: 600, field: 'Duration' }),
    price: num(b.price, { min: 0, max: 10000000, field: 'Price' }),
    staffIds: ids(b.staffIds),
    popular: Boolean(b.popular),
    active: b.active !== false,
  }),
  staff: (b) => ({
    name: str(b.name, { max: 60, required: true, field: 'Name' }),
    role: str(b.role, { max: 60 }),
    color: b.color ? color(b.color) : '#7c5cff',
    rating: b.rating === '' || b.rating == null ? null : num(b.rating, { min: 0, max: 5, int: false, field: 'Rating' }),
    daysOff: ids(b.daysOff).filter((d) => DAYS.includes(d)),
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
      price: num(b.price || 0, { min: 0, max: 10000000, field: 'Price' }),
      level: str(b.level, { max: 40 }),
      active: b.active !== false,
    };
  },
  plans: (b) => ({
    name: str(b.name, { max: 40, required: true, field: 'Name' }),
    price: num(b.price, { min: 0, max: 100000000, field: 'Price' }),
    period: str(b.period, { max: 30, required: true, field: 'Period' }),
    features: (Array.isArray(b.features) ? b.features : String(b.features || '').split('\n'))
      .map((f) => String(f).trim()).filter(Boolean).slice(0, 12).map((f) => f.slice(0, 80)),
    highlight: Boolean(b.highlight),
    active: b.active !== false,
  }),
};

function business(b, current) {
  const mode = b.mode === 'gym' ? 'gym' : 'salon';
  return {
    ...current,
    name: str(b.name, { max: 60, required: true, field: 'Business name' }),
    tagline: str(b.tagline, { max: 120 }),
    mode,
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
    slotStep: num(b.slotStep, { min: 5, max: 120, field: 'Slot step' }),
    bookingWindowDays: num(b.bookingWindowDays, { min: 1, max: 365, field: 'Booking window' }),
    minNoticeMinutes: num(b.minNoticeMinutes, { min: 0, max: 10080, field: 'Minimum notice' }),
    cancelNoticeMinutes: num(b.cancelNoticeMinutes, { min: 0, max: 10080, field: 'Cancellation notice' }),
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

module.exports = { HttpError, fail, str, num, phone, color, collections, business };
