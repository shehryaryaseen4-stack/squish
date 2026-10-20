'use strict';

const crypto = require('node:crypto');
const { checkPin, hashPin } = require('./store');
const { isDate, isTime, toMin, fromMin, addDays, nowIn } = require('./time');
const { serviceSlots, pickStaff, classesOn, workingIntervals } = require('./availability');
const v = require('./validate');

const { fail, HttpError } = v;
const STATUSES = ['confirmed', 'completed', 'no-show', 'cancelled'];
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

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

function bookingCode(db) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    const code = Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
    if (!db.bookings.some((b) => b.code === code)) return code;
  }
}

function publicBooking(b, { withToken = false } = {}) {
  const { token, ...rest } = b;
  return withToken ? { ...rest, token } : rest;
}

function createApi(store, { now: clock = () => new Date() } = {}) {
  const loginLimit = rateLimiter(8, 10 * 60 * 1000);
  const bookingLimit = rateLimiter(20, 60 * 60 * 1000);
  const lookupLimit = rateLimiter(20, 10 * 60 * 1000);
  const db = () => store.db;
  const now = () => nowIn(db().business.timeZone, clock());

  const findService = (id) => db().services.find((s) => s.id === id && s.active !== false) || fail('That service is no longer available', 404);

  function publicData() {
    const d = db();
    const { closedDates, ...business } = d.business;
    return {
      business: { ...business, closedDates },
      categories: d.categories,
      services: d.services.filter((s) => s.active !== false),
      staff: d.staff.filter((s) => s.active !== false).map(({ id, name, role, color, rating, daysOff }) => ({ id, name, role, color, rating, daysOff })),
      classes: d.business.mode === 'gym' ? d.classes.filter((c) => c.active !== false) : [],
      plans: d.business.mode === 'gym' ? d.plans.filter((p) => p.active !== false) : [],
      today: now().date,
    };
  }

  function createServiceBooking(body, { asAdmin = false } = {}) {
    const d = db();
    const service = findService(body.serviceId);
    if (!isDate(body.date) || !isTime(body.time)) fail('Pick a date and time');
    const staffId = body.staffId && body.staffId !== 'any' ? body.staffId : 'any';
    const slot = serviceSlots(d, { service, staffId, date: body.date, now: now(), asAdmin })
      .find((s) => s.time === body.time);
    if (!slot) fail('Sorry, that time was just taken. Please pick another slot.', 409);
    const chosen = staffId === 'any' ? pickStaff(d, slot.staffIds, body.date) : staffId;
    const staff = d.staff.find((s) => s.id === chosen);
    return {
      type: 'service',
      serviceId: service.id,
      serviceName: service.name,
      staffId: staff.id,
      staffName: staff.name,
      anyStaff: staffId === 'any',
      date: body.date,
      start: body.time,
      end: fromMin(toMin(body.time) + service.duration),
      duration: service.duration,
      price: service.price,
    };
  }

  function createClassBooking(body, customerPhone, { asAdmin = false } = {}) {
    const d = db();
    if (!isDate(body.date)) fail('Pick a date');
    const today = now();
    if (body.date < today.date || (!asAdmin && body.date > addDays(today.date, (d.business.bookingWindowDays || 30) - 1))) fail('That date is not open for booking yet');
    const cls = classesOn(d, body.date, today).find((c) => c.id === body.classId) || fail('That class does not run on this day', 404);
    if (cls.started && !asAdmin) fail('This class has already started', 409);
    if (cls.spotsLeft <= 0) fail('This class is full', 409);
    if (d.bookings.some((b) => b.classId === cls.id && b.date === body.date && b.status === 'confirmed' && b.customer.phone === customerPhone)) {
      fail('You already have a spot in this class', 409);
    }
    const coach = d.staff.find((s) => s.id === cls.staffId);
    return {
      type: 'class',
      classId: cls.id,
      serviceName: cls.name,
      staffId: cls.staffId,
      staffName: coach ? coach.name : '',
      date: body.date,
      start: cls.start,
      end: cls.end,
      duration: cls.duration,
      price: cls.price || 0,
    };
  }

  function createBooking(body, { asAdmin = false } = {}) {
    const customer = {
      name: v.str(body.name, { max: 60, required: true, field: 'Name' }),
      phone: v.phone(body.phone),
    };
    const note = v.str(body.note, { max: 300 });
    const details = body.type === 'class' ? createClassBooking(body, customer.phone, { asAdmin }) : createServiceBooking(body, { asAdmin });
    const booking = {
      id: newId('bk'),
      code: bookingCode(db()),
      token: crypto.randomBytes(16).toString('hex'),
      ...details,
      customer,
      note,
      status: 'confirmed',
      source: asAdmin ? 'staff' : 'online',
      createdAt: new Date(clock()).toISOString(),
    };
    db().bookings.push(booking);
    store.save();
    return booking;
  }

  function minutesUntil(b) {
    const n = now();
    const days = Math.round((Date.parse(`${b.date}T00:00:00Z`) - Date.parse(`${n.date}T00:00:00Z`)) / 86400000);
    return days * 1440 + toMin(b.start) - n.minutes;
  }

  // ---- admin --------------------------------------------------------------

  function requireAdmin(req) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const sessions = db().admin.sessions || [];
    const hashed = token && sha(token);
    const s = hashed && sessions.find((x) => x.hash === hashed && x.expires > Date.now());
    if (!s) fail('Please sign in again', 401);
  }

  function overview(date) {
    const d = db();
    const live = (b) => b.status === 'confirmed' || b.status === 'completed';
    const day = d.bookings.filter((b) => b.date === date && b.status !== 'cancelled');
    const week = Array.from({ length: 7 }, (_, i) => addDays(date, i)).map((dt) => {
      const list = d.bookings.filter((b) => b.date === dt && live(b));
      return { date: dt, count: list.length, revenue: list.reduce((a, b) => a + b.price, 0) };
    });
    const since = addDays(date, -30);
    const recent = d.bookings.filter((b) => b.date >= since && b.date <= date);
    const top = {};
    for (const b of recent.filter(live)) top[b.serviceName] = (top[b.serviceName] || 0) + 1;
    const n = now();
    return {
      date,
      now: n,
      today: {
        bookings: day.filter(live).length,
        revenue: day.filter(live).reduce((a, b) => a + b.price, 0),
        completed: day.filter((b) => b.status === 'completed').length,
        noShows: day.filter((b) => b.status === 'no-show').length,
      },
      week,
      last30: {
        total: recent.length,
        cancelled: recent.filter((b) => b.status === 'cancelled').length,
        noShows: recent.filter((b) => b.status === 'no-show').length,
        revenue: recent.filter((b) => b.status === 'completed').reduce((a, b) => a + b.price, 0),
        customers: new Set(recent.map((b) => b.customer.phone)).size,
      },
      topServices: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
      upcoming: d.bookings
        .filter((b) => b.status === 'confirmed' && (b.date > n.date || (b.date === n.date && toMin(b.end) > n.minutes)))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        .slice(0, 8).map((b) => publicBooking(b)),
    };
  }

  function listBookings(q) {
    const term = String(q.q || '').trim().toLowerCase();
    return db().bookings
      .filter((b) => (!q.from || b.date >= q.from) && (!q.to || b.date <= q.to))
      .filter((b) => !q.status || q.status === 'all' || b.status === q.status)
      .filter((b) => !q.staffId || b.staffId === q.staffId)
      .filter((b) => !term || [b.customer.name, b.customer.phone, b.code, b.serviceName, b.staffName]
        .some((x) => String(x).toLowerCase().includes(term)))
      .sort((a, b) => (q.order === 'desc' ? -1 : 1) * (a.date + a.start).localeCompare(b.date + b.start))
      .slice(0, 500)
      .map((b) => publicBooking(b));
  }

  function updateBooking(id, body) {
    const d = db();
    const b = d.bookings.find((x) => x.id === id) || fail('Booking not found', 404);
    if ((body.date || body.time || body.staffId) && b.type === 'service') {
      const service = d.services.find((s) => s.id === b.serviceId) || fail('This service was deleted, so the booking cannot be moved');
      const date = body.date || b.date;
      const time = body.time || b.start;
      const staffId = body.staffId || b.staffId;
      if (!isDate(date) || !isTime(time)) fail('Pick a valid date and time');
      const slot = serviceSlots(d, { service, staffId, date, now: now(), asAdmin: true, ignoreId: b.id }).find((s) => s.time === time);
      if (!slot) fail(`${d.staff.find((s) => s.id === staffId)?.name || 'That team member'} is not free at that time`, 409);
      const staff = d.staff.find((s) => s.id === staffId);
      Object.assign(b, { date, start: time, end: fromMin(toMin(time) + b.duration), staffId, staffName: staff.name, anyStaff: false });
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) fail('Unknown status');
      // Restoring a cancelled appointment must not double-book whoever took the slot since.
      if (body.status === 'confirmed' && b.status !== 'confirmed' && b.type === 'service') {
        const clash = d.bookings.some((x) => x.id !== b.id && x.type === 'service' && x.staffId === b.staffId && x.date === b.date
          && x.status === 'confirmed' && toMin(x.start) < toMin(b.end) && toMin(x.end) > toMin(b.start));
        if (clash) fail(`${b.staffName} already has another booking at that time. Reschedule it instead.`, 409);
      }
      b.status = body.status;
    }
    if (body.note !== undefined) b.note = v.str(body.note, { max: 300 });
    b.updatedAt = new Date(clock()).toISOString();
    store.save();
    return publicBooking(b);
  }

  function upsert(collection, id, body) {
    const clean = v.collections[collection](body || {});
    const d = db();
    if (collection === 'services' && !d.categories.some((c) => c.id === clean.categoryId)) fail('Pick a category');
    const list = d[collection];
    if (id) {
      const item = list.find((x) => x.id === id) || fail('Not found', 404);
      Object.assign(item, clean);
      store.save();
      return item;
    }
    const prefix = { categories: 'cat', services: 'svc', staff: 'st', classes: 'cls', plans: 'plan' }[collection];
    const item = { id: newId(prefix), ...clean };
    list.push(item);
    store.save();
    return item;
  }

  function remove(collection, id) {
    const d = db();
    if (collection === 'categories' && d.services.some((s) => s.categoryId === id)) fail('Move or delete the services in this category first', 409);
    const before = d[collection].length;
    d[collection] = d[collection].filter((x) => x.id !== id);
    if (d[collection].length === before) fail('Not found', 404);
    if (collection === 'staff') for (const s of d.services) s.staffIds = (s.staffIds || []).filter((x) => x !== id);
    store.save();
    return { ok: true };
  }

  // ---- routing ------------------------------------------------------------

  const COLLECTIONS = Object.keys(v.collections);

  async function handle(req, res, url, body) {
    const { pathname } = url;
    const q = Object.fromEntries(url.searchParams);
    const m = req.method;
    const ip = req.socket.remoteAddress || 'local';
    let match;

    if (m === 'GET' && pathname === '/api/business') return publicData();

    if (m === 'GET' && pathname === '/api/availability') {
      const service = findService(q.serviceId);
      if (!isDate(q.date)) fail('Pick a date');
      return { date: q.date, slots: serviceSlots(db(), { service, staffId: q.staffId, date: q.date, now: now() }) };
    }

    if (m === 'GET' && pathname === '/api/calendar') {
      const d = db();
      const service = q.serviceId ? findService(q.serviceId) : null;
      const n = now();
      const days = Math.min(Number(q.days) || d.business.bookingWindowDays || 14, 60);
      return Array.from({ length: days }, (_, i) => {
        const date = addDays(n.date, i);
        if (service) return { date, slots: serviceSlots(d, { service, staffId: q.staffId, date, now: n }).length };
        const anyStaff = d.staff.some((s) => workingIntervals(d.business, s, date).length);
        return { date, slots: anyStaff ? classesOn(d, date, n).filter((c) => !c.started).length : 0 };
      });
    }

    if (m === 'GET' && pathname === '/api/classes') {
      if (!isDate(q.date)) fail('Pick a date');
      return classesOn(db(), q.date, now()).map(({ booked, ...c }) => c);
    }

    if (m === 'POST' && pathname === '/api/bookings') {
      bookingLimit(ip);
      return publicBooking(createBooking(body), { withToken: true });
    }

    if (m === 'POST' && pathname === '/api/bookings/lookup') {
      lookupLimit(ip);
      const code = v.str(body.code, { max: 10, required: true, field: 'Booking code' }).toUpperCase();
      const phone = v.phone(body.phone);
      const b = db().bookings.find((x) => x.code === code && x.customer.phone === phone);
      if (!b) fail('No booking matches that code and phone number', 404);
      return publicBooking(b, { withToken: true });
    }

    if ((match = pathname.match(/^\/api\/bookings\/([\w-]+)(\/cancel)?$/))) {
      const b = db().bookings.find((x) => x.id === match[1]);
      const token = m === 'GET' ? q.token : body.token;
      if (!b || !token || b.token !== token) fail('Booking not found', 404);
      if (m === 'GET' && !match[2]) return publicBooking(b);
      if (m === 'POST' && match[2]) {
        if (b.status !== 'confirmed') fail('This booking can no longer be cancelled', 409);
        const notice = db().business.cancelNoticeMinutes || 0;
        if (minutesUntil(b) < notice) fail(`Online cancellation closes ${notice >= 60 ? `${notice / 60} hour${notice === 60 ? '' : 's'}` : `${notice} minutes`} before your appointment. Please call us instead.`, 409);
        b.status = 'cancelled';
        b.cancelledBy = 'customer';
        b.updatedAt = new Date(clock()).toISOString();
        store.save();
        return publicBooking(b);
      }
    }

    if (m === 'POST' && pathname === '/api/admin/login') {
      loginLimit(ip);
      if (!checkPin(String(body.pin || ''), db().admin.pin)) fail('Wrong PIN', 401);
      const token = crypto.randomBytes(24).toString('hex');
      const sessions = (db().admin.sessions || []).filter((s) => s.expires > Date.now()).slice(-20);
      sessions.push({ hash: sha(token), expires: Date.now() + SESSION_MS });
      db().admin.sessions = sessions;
      store.save();
      return { token };
    }

    if (!pathname.startsWith('/api/admin/')) fail('Not found', 404);
    requireAdmin(req);
    const d = db();

    if (m === 'POST' && pathname === '/api/admin/logout') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      d.admin.sessions = (d.admin.sessions || []).filter((s) => s.hash !== sha(token));
      store.save();
      return { ok: true };
    }
    if (m === 'GET' && pathname === '/api/admin/data') {
      return { business: d.business, categories: d.categories, services: d.services, staff: d.staff, classes: d.classes, plans: d.plans, now: now() };
    }
    if (m === 'GET' && pathname === '/api/admin/overview') return overview(isDate(q.date) ? q.date : now().date);
    if (m === 'GET' && pathname === '/api/admin/bookings') return listBookings(q);
    if (m === 'GET' && pathname === '/api/admin/availability') {
      const service = d.services.find((s) => s.id === q.serviceId) || fail('Pick a service');
      if (!isDate(q.date)) fail('Pick a date');
      return { date: q.date, slots: serviceSlots(d, { service, staffId: q.staffId, date: q.date, now: now(), asAdmin: true, ignoreId: q.ignoreId }) };
    }
    if (m === 'POST' && pathname === '/api/admin/bookings') return publicBooking(createBooking(body, { asAdmin: true }));
    if (m === 'PATCH' && (match = pathname.match(/^\/api\/admin\/bookings\/([\w-]+)$/))) return updateBooking(match[1], body);
    if (m === 'PUT' && pathname === '/api/admin/business') {
      d.business = v.business(body, d.business);
      store.save();
      return d.business;
    }
    if (m === 'POST' && pathname === '/api/admin/pin') {
      if (!checkPin(String(body.current || ''), d.admin.pin)) fail('Current PIN is wrong', 401);
      if (!/^\d{4,8}$/.test(String(body.next || ''))) fail('New PIN must be 4 to 8 digits');
      d.admin.pin = hashPin(body.next);
      store.save();
      return { ok: true };
    }
    if ((match = pathname.match(/^\/api\/admin\/(\w+)(?:\/([\w-]+))?$/)) && COLLECTIONS.includes(match[1])) {
      const [, collection, id] = match;
      if (m === 'POST' && !id) return upsert(collection, null, body);
      if (m === 'PUT' && id) return upsert(collection, id, body);
      if (m === 'DELETE' && id) return remove(collection, id);
    }
    fail('Not found', 404);
  }

  return { handle };
}

module.exports = { createApi, HttpError };
