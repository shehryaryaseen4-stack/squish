'use strict';

// Starting settings for a new gym by country: money, time zone, the usual
// ways members pay, and a sensible monthly fee to start the plans from.
// Owners can change all of it later in Settings.
const COUNTRIES = [
  ['PK', 'Pakistan', 'PKR', 'Rs', 'en-PK', 'Asia/Karachi', 5000, ['Cash', 'Bank transfer', 'JazzCash', 'EasyPaisa', 'Card', 'Other'], 'ur'],
  ['IN', 'India', 'INR', '₹', 'en-IN', 'Asia/Kolkata', 1500, ['Cash', 'UPI', 'Card', 'Bank transfer', 'Other'], 'en'],
  ['BD', 'Bangladesh', 'BDT', '৳', 'en-BD', 'Asia/Dhaka', 2000, ['Cash', 'bKash', 'Nagad', 'Card', 'Bank transfer', 'Other'], 'en'],
  ['AE', 'United Arab Emirates', 'AED', 'AED', 'en-AE', 'Asia/Dubai', 250, ['Cash', 'Card', 'Bank transfer', 'Other'], 'en'],
  ['SA', 'Saudi Arabia', 'SAR', 'SAR', 'en-SA', 'Asia/Riyadh', 250, ['Cash', 'Card', 'mada', 'Bank transfer', 'Other'], 'en'],
  ['QA', 'Qatar', 'QAR', 'QAR', 'en-QA', 'Asia/Qatar', 250, ['Cash', 'Card', 'Bank transfer', 'Other'], 'en'],
  ['KW', 'Kuwait', 'KWD', 'KD', 'en-KW', 'Asia/Kuwait', 20, ['Cash', 'Card', 'KNET', 'Bank transfer', 'Other'], 'en'],
  ['OM', 'Oman', 'OMR', 'OMR', 'en-OM', 'Asia/Muscat', 20, ['Cash', 'Card', 'Bank transfer', 'Other'], 'en'],
  ['BH', 'Bahrain', 'BHD', 'BD', 'en-BH', 'Asia/Bahrain', 20, ['Cash', 'Card', 'BenefitPay', 'Bank transfer', 'Other'], 'en'],
  ['GB', 'United Kingdom', 'GBP', '£', 'en-GB', 'Europe/London', 35, ['Card', 'Direct Debit', 'Cash', 'Bank transfer', 'Other'], 'en'],
  ['IE', 'Ireland', 'EUR', '€', 'en-IE', 'Europe/Dublin', 40, ['Card', 'Cash', 'Bank transfer', 'Other'], 'en'],
  ['DE', 'Germany', 'EUR', '€', 'de-DE', 'Europe/Berlin', 35, ['Card', 'SEPA', 'Cash', 'Bank transfer', 'Other'], 'en'],
  ['FR', 'France', 'EUR', '€', 'fr-FR', 'Europe/Paris', 35, ['Card', 'Cash', 'Bank transfer', 'Other'], 'en'],
  ['ES', 'Spain', 'EUR', '€', 'es-ES', 'Europe/Madrid', 35, ['Card', 'Bizum', 'Cash', 'Bank transfer', 'Other'], 'en'],
  ['IT', 'Italy', 'EUR', '€', 'it-IT', 'Europe/Rome', 40, ['Card', 'Cash', 'Bank transfer', 'Other'], 'en'],
  ['NL', 'Netherlands', 'EUR', '€', 'nl-NL', 'Europe/Amsterdam', 35, ['Card', 'iDEAL', 'Cash', 'Bank transfer', 'Other'], 'en'],
  ['TR', 'Türkiye', 'TRY', '₺', 'tr-TR', 'Europe/Istanbul', 1500, ['Cash', 'Card', 'Bank transfer', 'Other'], 'en'],
  ['US', 'United States', 'USD', '$', 'en-US', 'America/New_York', 45, ['Card', 'Cash', 'Zelle', 'Venmo', 'Other'], 'en'],
  ['CA', 'Canada', 'CAD', '$', 'en-CA', 'America/Toronto', 55, ['Card', 'Cash', 'Interac', 'Other'], 'en'],
  ['AU', 'Australia', 'AUD', '$', 'en-AU', 'Australia/Sydney', 70, ['Card', 'Cash', 'Bank transfer', 'Other'], 'en'],
  ['NZ', 'New Zealand', 'NZD', '$', 'en-NZ', 'Pacific/Auckland', 70, ['Card', 'Cash', 'Bank transfer', 'Other'], 'en'],
  ['ZA', 'South Africa', 'ZAR', 'R', 'en-ZA', 'Africa/Johannesburg', 500, ['Card', 'Cash', 'EFT', 'Other'], 'en'],
  ['NG', 'Nigeria', 'NGN', '₦', 'en-NG', 'Africa/Lagos', 25000, ['Cash', 'Bank transfer', 'Card', 'Other'], 'en'],
  ['KE', 'Kenya', 'KES', 'KSh', 'en-KE', 'Africa/Nairobi', 3500, ['M-Pesa', 'Cash', 'Card', 'Other'], 'en'],
  ['EG', 'Egypt', 'EGP', 'E£', 'en-EG', 'Africa/Cairo', 800, ['Cash', 'Card', 'InstaPay', 'Other'], 'en'],
  ['MY', 'Malaysia', 'MYR', 'RM', 'en-MY', 'Asia/Kuala_Lumpur', 150, ['Card', 'Cash', 'DuitNow', 'Other'], 'en'],
  ['SG', 'Singapore', 'SGD', 'S$', 'en-SG', 'Asia/Singapore', 120, ['Card', 'PayNow', 'Cash', 'Other'], 'en'],
  ['ID', 'Indonesia', 'IDR', 'Rp', 'id-ID', 'Asia/Jakarta', 350000, ['Cash', 'QRIS', 'Card', 'Bank transfer', 'Other'], 'en'],
  ['PH', 'Philippines', 'PHP', '₱', 'en-PH', 'Asia/Manila', 1500, ['Cash', 'GCash', 'Card', 'Other'], 'en'],
  ['OTHER', 'Other country', 'USD', '$', 'en-US', 'UTC', 40, ['Cash', 'Card', 'Bank transfer', 'Other'], 'en'],
].map(([code, name, currency, symbol, locale, timeZone, monthly, methods, lang]) => ({ code, name, currency, symbol, locale, timeZone, monthly, methods, lang }));

const countryOf = (code) => COUNTRIES.find((c) => c.code === code) || COUNTRIES[COUNTRIES.length - 1];

// Plans in the gym's own money: quarterly, half-yearly and annual get a discount.
function plansFor(monthly) {
  const nice = (n) => {
    const step = n >= 10000 ? 500 : n >= 1000 ? 100 : n >= 100 ? 10 : 1;
    return Math.round(n / step) * step;
  };
  return { monthly: nice(monthly), quarterly: nice(monthly * 2.7), half: nice(monthly * 5), annual: nice(monthly * 9), admission: nice(monthly * 0.4) };
}

// A new gym's settings for its country, and a clean start: plans in its own
// money, no sample trainers or classes. Used by sign-up and the Windows app.
function businessFor(code, { name, email = '', phone = '', timeZone } = {}) {
  const c = countryOf(code);
  let tz = timeZone || c.timeZone;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { tz = c.timeZone; }
  return {
    name, tagline: '', phone, whatsapp: String(phone).replace(/\D/g, ''), email, address: '', mapUrl: '', instagram: '',
    currency: c.currency, currencySymbol: c.symbol, locale: c.locale, timeZone: tz, paymentMethods: c.methods, messageLang: c.lang,
  };
}

function cleanStart(db, code, monthlyFee) {
  const c = countryOf(code);
  const pr = plansFor(Number(monthlyFee) > 0 ? Number(monthlyFee) : c.monthly);
  const prices = { 'plan-1m': pr.monthly, 'plan-3m': pr.quarterly, 'plan-6m': pr.half, 'plan-12m': pr.annual };
  const features = { 'plan-1m': ['Full gym access'], 'plan-3m': ['Full gym access', 'Better price'], 'plan-6m': ['Full gym access', 'Freeze up to 15 days'], 'plan-12m': ['Full gym access', 'Best price', 'Freeze up to 30 days'] };
  db.plans = db.plans.map((p) => ({ ...p, price: prices[p.id] ?? p.price, features: features[p.id] || [] }));
  db.business.admissionFee = pr.admission;
  db.staff = [];
  db.classes = [];
}

module.exports = { COUNTRIES, countryOf, plansFor, businessFor, cleanStart };
