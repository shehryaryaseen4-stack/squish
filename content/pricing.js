'use strict';
// Plans shown on /pricing. Change prices and features here; pages.js builds the page from it.
// The buy buttons link to the checkout URLs set in the environment (PRO_MONTHLY_URL,
// PRO_YEARLY_URL, PRO_DAY_URL). Until they are set the page says Pro is coming soon, and
// everything stays free.

module.exports = {
  currency: 'USD',
  plans: [
    {
      id: 'free', name: 'Free', price: '$0', period: 'forever',
      blurb: 'Everything you need for everyday files.',
      features: [
        'All 2,400+ file conversions',
        'Compress images and PDFs',
        'Files up to 95 MB each',
        'Batch convert and download as ZIP or one PDF',
        'PDF editor with a small Flipit Free mark on downloads',
        'No sign-up',
      ],
    },
    {
      id: 'pro', name: 'Pro', price: '$4.99', period: 'per month', alt: 'or $29 per year (save 50%)', featured: true,
      blurb: 'For people who edit PDFs often.',
      features: [
        'Everything in Free',
        'PDF editor downloads without the Flipit Free mark',
        'Unlimited PDF editor downloads',
        'All templates, tables, fonts and shapes',
        'No ads',
        'Priority email support',
        'Cancel any time',
      ],
      checkout: [['monthly', 'Get Pro monthly'], ['yearly', 'Get Pro yearly']],
    },
    {
      id: 'day', name: 'Day Pass', price: '$1.99', period: 'one time, 24 hours',
      blurb: 'One job to finish today? No subscription.',
      features: [
        'All Pro features for 24 hours',
        'Pay once, nothing renews',
        'Good for a CV, a form or one contract',
      ],
      checkout: [['day', 'Get a Day Pass']],
    },
  ],
  faq: [
    ['Do I need to pay to convert files?', 'No. Every converter and compressor stays free. Pro is only for heavier use of the PDF editor.'],
    ['How do I cancel?', 'Use the link in your receipt email or in your account at any time. Pro keeps working until the end of the period you paid for, and you are not charged again.'],
    ['Can I get a refund?', 'Yes. If Pro is not right for you, ask within 14 days of your first payment and you get your money back. See the refund policy for details.'],
    ['Which payment methods can I use?', 'Visa, Mastercard, American Express and other cards, PayPal, Apple Pay and Google Pay, from almost every country. Prices are in US dollars; your bank converts them to your currency.'],
    ['Are taxes included?', 'Where VAT or sales tax applies, it is added at checkout according to your country and shown before you pay.'],
    ['Is my payment information safe?', 'Payments are processed by our payment partner. We never see or store your card details.'],
  ],
};
