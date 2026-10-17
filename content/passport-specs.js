'use strict';
// Passport and visa photo sizes for the passport photo maker (pages.js appBox, public/apps.js).
//   id, country, doc, w x h (photo, mm), head [min, max] (chin to top of head, mm), px (digital file;
//   default: the photo size at 300 dpi). Grouped by region in the menu; "Most used" comes first.
// Sizes follow each country's published rules; offices update them, so the page tells people to
// check before printing. Add a country by adding a line.

const S = (id, country, doc, w, h, head, px) => ({ id, country, doc, w, h, head, px });
const SCHENGEN = [32, 36]; // 35 x 45 mm with the face 70-80% of the photo (ICAO), used across Europe

module.exports = [
  ['Most used', [
    S('us', 'United States', 'Passport & visa', 51, 51, [25, 35], [600, 600]),
    S('uk', 'United Kingdom', 'Passport & visa', 35, 45, [29, 34]),
    S('schengen', 'Schengen visa (EU)', 'Visa', 35, 45, SCHENGEN),
    S('ca', 'Canada', 'Passport', 50, 70, [31, 36]),
    S('in', 'India', 'Passport, OCI & visa', 51, 51, [25, 35], [600, 600]),
    S('pk', 'Pakistan', 'Passport, CNIC & visa', 35, 45, SCHENGEN),
    S('au', 'Australia', 'Passport', 35, 45, SCHENGEN),
  ]],
  ['North America', [
    S('us-dv', 'United States', 'Green Card (DV lottery)', 51, 51, [25, 35], [600, 600]),
    S('mx', 'Mexico', 'Passport', 35, 45, SCHENGEN),
  ]],
  ['Europe', [
    S('ie', 'Ireland', 'Passport', 35, 45, SCHENGEN),
    S('de', 'Germany', 'Passport & ID', 35, 45, SCHENGEN),
    S('fr', 'France', 'Passport & ID', 35, 45, SCHENGEN),
    S('it', 'Italy', 'Passport', 35, 45, SCHENGEN),
    S('es', 'Spain', 'Passport', 35, 45, SCHENGEN),
    S('pt', 'Portugal', 'Passport', 35, 45, SCHENGEN),
    S('nl', 'Netherlands', 'Passport', 35, 45, SCHENGEN),
    S('be', 'Belgium', 'Passport', 35, 45, SCHENGEN),
    S('ch', 'Switzerland', 'Passport', 35, 45, SCHENGEN),
    S('at', 'Austria', 'Passport', 35, 45, SCHENGEN),
    S('se', 'Sweden', 'Passport', 35, 45, SCHENGEN),
    S('no', 'Norway', 'Passport', 35, 45, SCHENGEN),
    S('dk', 'Denmark', 'Passport', 35, 45, SCHENGEN),
    S('pl', 'Poland', 'Passport', 35, 45, SCHENGEN),
    S('gr', 'Greece', 'Passport', 35, 45, SCHENGEN),
    S('ru', 'Russia', 'Passport', 35, 45, SCHENGEN),
    S('tr', 'Turkey', 'Passport', 50, 60, SCHENGEN),
  ]],
  ['Asia and Middle East', [
    S('cn', 'China', 'Passport & visa', 33, 48, [28, 33]),
    S('jp', 'Japan', 'Passport', 35, 45, SCHENGEN),
    S('kr', 'South Korea', 'Passport', 35, 45, SCHENGEN),
    S('hk', 'Hong Kong', 'Passport', 40, 50, SCHENGEN),
    S('sg', 'Singapore', 'Passport', 35, 45, [25, 35]),
    S('my', 'Malaysia', 'Passport', 35, 50, [25, 35]),
    S('ph', 'Philippines', 'Passport', 35, 45, SCHENGEN),
    S('id', 'Indonesia', 'Passport & visa', 40, 60, SCHENGEN),
    S('bd', 'Bangladesh', 'Passport', 45, 55, SCHENGEN),
    S('lk', 'Sri Lanka', 'Passport', 35, 45, SCHENGEN),
    S('sa', 'Saudi Arabia', 'Passport & visa', 40, 60, SCHENGEN),
    S('ae', 'United Arab Emirates', 'Visa', 43, 55, SCHENGEN),
  ]],
  ['Africa and Oceania', [
    S('ng', 'Nigeria', 'Passport', 35, 45, SCHENGEN),
    S('za', 'South Africa', 'Passport', 35, 45, SCHENGEN),
    S('eg', 'Egypt', 'Passport', 40, 60, SCHENGEN),
    S('nz', 'New Zealand', 'Passport', 35, 45, SCHENGEN),
  ]],
];
