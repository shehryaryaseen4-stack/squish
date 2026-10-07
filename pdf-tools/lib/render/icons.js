'use strict';
// Line icons on a 24x24 grid (stroke = currentColor). Tool icons sit on a tile coloured by
// category; UI icons are used inline in buttons and lists.

const P = {
  // documents
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  word: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 12l1.2 5 1.8-3.5 1.8 3.5 1.2-5"/>',
  excel: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8 12h8M8 15.5h8M12 12v6.5M8 12v6.5h8V12"/>',
  powerpoint: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M10 18v-6h2.5a2 2 0 0 1 0 4H10"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
  'image-pdf': '<rect x="2.5" y="6" width="11" height="10" rx="1.5"/><path d="M2.5 13.5l3.5-3 3 2.5 4.5-4"/><path d="M15.5 11h3m0 0-1.5-1.5M18.5 11 17 12.5"/><path d="M20 4h-2.5v16H22"/>',
  'word-pdf': '<path d="M11 3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M5.5 8l1 4 1.5-3 1.5 3 1-4"/><path d="M13 11h8v10h-8z"/><path d="M15 15h1.5a1.25 1.25 0 0 0 0-2.5H15V18"/>',
  'excel-pdf': '<path d="M11 3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M5.5 8h5M5.5 11h5M8 8v6"/><path d="M13 11h8v10h-8z"/><path d="M15 15h1.5a1.25 1.25 0 0 0 0-2.5H15V18"/>',
  'powerpoint-pdf': '<path d="M11 3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M6 13V7.5h2a1.75 1.75 0 0 1 0 3.5H6"/><path d="M13 11h8v10h-8z"/><path d="M15 15h1.5a1.25 1.25 0 0 0 0-2.5H15V18"/>',
  html: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  text: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 12.5h7M8.5 15.5h7M8.5 18.5h4"/>',
  // organize
  merge: '<path d="M4 4h6v7H4zM14 4h6v7h-6z"/><path d="M7 11v2.5a2.5 2.5 0 0 0 2.5 2.5h5a2.5 2.5 0 0 0 2.5-2.5V11"/><path d="M12 16v4m-2-2 2 2 2-2"/>',
  split: '<path d="M8 3h8v6H8z"/><path d="M12 9v2.5M12 11.5 6 16M12 11.5l6 4.5"/><path d="M3 16h6v5H3zM15 16h6v5h-6z"/>',
  extract: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 3v5h5v4"/><path d="M15 16h6m-2.5-2.5L21 16l-2.5 2.5"/>',
  delete: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>',
  reorder: '<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="13" width="7" height="8" rx="1.5"/><path d="M14 7h4a2 2 0 0 1 2 2v1m0 0-2-2m2 2 2-2M10 17H6a2 2 0 0 1-2-2v-1m0 0 2 2m-2-2-2 2"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  duplicate: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/><path d="M14 12v5M11.5 14.5h5"/>',
  // edit
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  'add-text': '<path d="M4 6V4h12v2M10 4v14M7.5 18h5"/><path d="M18 13v6m-3-3h6"/>',
  'add-image': '<rect x="3" y="5" width="13" height="12" rx="2"/><circle cx="7.5" cy="9.5" r="1.4"/><path d="M16 14l-3.5-3.5L5 17"/><path d="M19 13v6m-3-3h6"/>',
  shapes: '<rect x="3" y="3" width="8" height="8" rx="1"/><circle cx="17" cy="17" r="4"/><path d="M17 3l4 7h-8z"/>',
  sign: '<path d="M3 17c3-1 4-9 6-9s-1 9 2 9 3-4 5-4 1 4 3 4h2"/><path d="M3 21h18"/>',
  highlight: '<path d="M9 14l-3 3v3h3l3-3"/><path d="M8.5 14.5 16 7l3 3-7.5 7.5z"/><path d="M14 9l3 3"/><path d="M14 21h7"/>',
  annotate: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z"/><path d="M8 8h8M8 12h5"/>',
  watermark: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  // security
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5"/><path d="M12 14.5v2.5"/>',
  'shield-off': '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-1.6-.7-3-1.7-4.1-3"/><path d="M5 15.5A12 12 0 0 1 5 11V6l7-3"/><path d="M3 3l18 18"/>',
  redact: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><rect x="8" y="11" width="8" height="2.6" fill="currentColor"/><rect x="8" y="15.5" width="5" height="2.6" fill="currentColor"/>',
  // optimize
  compress: '<path d="M4 9h16M4 15h16"/><path d="M12 2v5m-2.5-2.5L12 7l2.5-2.5M12 22v-5m-2.5 2.5L12 17l2.5 2.5"/>',
  optimize: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  reduce: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  // ocr
  ocr: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M7.5 16 10 8l2.5 8M8.4 13.5h3.2M15 8v8"/>',
  'image-text': '<rect x="3" y="4" width="11" height="10" rx="1.5"/><path d="M3 11.5l3-2.5 3 2 5-4"/><path d="M15 17h6M15 20.5h6M17 13.5h4M3 17.5h9M3 20.5h7"/>',
  // other
  numbers: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M10.5 14.5l1.5-1v5M10.5 18.5h3"/>',
  metadata: '<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8" cy="8" r="1.5"/>',
  repair: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.6 17.2a1.6 1.6 0 0 0 2.3 2.3l5.7-5.7a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.3-.6-.6-2.3z"/>',
  zip: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M10 3v2h2v2h-2v2h2v2h-2v2"/><rect x="9" y="14" width="3.5" height="4" rx=".8"/>',
  'extract-images': '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M3 12l3.5-3 3 2.5L16 6"/><path d="M13 20h8m-3-3 3 3-3 3"/>',

  // UI
  upload: '<path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  download: '<path d="M12 4v12m-5-5 5 5 5-5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.5"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  device: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>',
  grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
  'rotate-left': '<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/>',
  'rotate-right': '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  'arrow-left': '<path d="M19 12H5m6-6-6 6 6 6"/>',
  'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'arrow-up': '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 9m0-5v5h5M4 13a8 8 0 0 0 14.3 4.3L20 15m0 5v-5h-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 3.5 7 8 12 8zm0 0s1.5-5 4-4.5S17 8 12 8z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
};

function icon(name, { size = 24, cls = '', label = '' } = {}) {
  const body = P[name] || P.doc;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="ic${cls ? ` ${cls}` : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
}

module.exports = { icon, ICONS: P };
