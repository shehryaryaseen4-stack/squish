// Ready-made page designs for the PDF editor. Each one is a list of ordinary editor objects
// (text, rectangles, circles, lines), so everything in a template can be edited, moved,
// recoloured or deleted like anything the visitor adds. Coordinates are PDF points from the
// top-left of the page. Centred and right-aligned text keeps its anchor (ax) until moved.

const A4 = [595.28, 841.89];
const A4L = [841.89, 595.28];
const A5 = [419.53, 595.28];
const A5L = [595.28, 419.53];
const LETTER = [612, 792];

const T = (text, x, y, size, o = {}) => ({
  type: 'text', text, x, y, size, font: o.font || 'helv', color: o.color || '#1f2937',
  bold: !!o.bold, italic: !!o.italic, underline: false, align: o.align || 'left', opacity: o.op ?? 100,
  w: 10, h: size * 1.2 * text.split('\n').length,
  ...(o.align === 'center' || o.align === 'right' ? { ax: x } : {}),
});
const C = (text, cx, y, size, o = {}) => T(text, cx, y, size, { ...o, align: 'center' });
const RT = (text, rx, y, size, o = {}) => T(text, rx, y, size, { ...o, align: 'right' });
const R = (x, y, w, h, o = {}) => ({
  type: 'rect', x, y, w, h, color: o.stroke || o.fill || '#111827', width: o.sw ?? 1, dash: o.dash || 'solid',
  fill: o.fill || '#ffffff', fillOn: !!o.fill, radius: o.r || 0, opacity: o.op ?? 100,
});
const E = (x, y, w, h, o = {}) => ({
  type: 'ellipse', x, y, w, h, color: o.stroke || o.fill || '#111827', width: o.sw ?? 1, dash: o.dash || 'solid',
  fill: o.fill || '#ffffff', fillOn: !!o.fill, opacity: o.op ?? 100,
});
const L = (x1, y1, x2, y2, o = {}) => {
  const width = o.w || 1, pad = Math.max(width, 4); // same box as the editor's lineBox()
  return { type: 'line', x1, y1, x2, y2, color: o.color || '#d1d5db', width, dash: o.dash || 'solid', opacity: o.op ?? 100,
    x: Math.min(x1, x2) - pad, y: Math.min(y1, y2) - pad, w: Math.abs(x2 - x1) + pad * 2, h: Math.abs(y2 - y1) + pad * 2 };
};
const BOX = (x, y, color = '#9ca3af', s = 11) => R(x, y, s, s, { stroke: color, sw: 1.2, r: 2 });

// a table: header row and body rows with column texts; cols = [[x, align, width], ...]
function table({ x, y, w, cols, head, rows, rowH = 26, headFill, headColor = '#ffffff', line = '#e5e7eb', size = 10, font = 'helv', zebra }) {
  const out = [R(x, y, w, rowH, { fill: headFill })];
  const cell = (txt, c, top, o) => (c[1] === 'right' ? RT(txt, c[0], top, size, o) : c[1] === 'center' ? C(txt, c[0], top, size, o) : T(txt, c[0], top, size, o));
  head.forEach((h, i) => out.push(cell(h, cols[i], y + (rowH - size * 1.2) / 2, { bold: true, color: headColor, font })));
  rows.forEach((r, j) => {
    const top = y + rowH * (j + 1);
    if (zebra && j % 2) out.push(R(x, top, w, rowH, { fill: zebra }));
    r.forEach((t, i) => out.push(cell(t, cols[i], top + (rowH - size * 1.2) / 2, { font })));
    out.push(L(x, top + rowH, x + w, top + rowH, { color: line }));
  });
  return out;
}

const lorem = 'Write a short summary here. Two or three sentences about\nwho you are, what you do best and what you are looking for.';

export const TEMPLATE_CATS = [['all', 'All'], ['resume', 'Resume & letters'], ['business', 'Business'], ['certificate', 'Certificates'], ['marketing', 'Flyers & posters'], ['planning', 'Planning'], ['personal', 'Cards & personal']];

export const TEMPLATES = [
  // ------------------------------------------------------------- resumes --
  {
    id: 'resume-modern', name: 'Modern resume', cat: 'resume', size: A4,
    items: (() => {
      const navy = '#1e2a44', acc = '#3b82f6', side = '#cbd5e1';
      const sideHead = (t, y) => [T(t, 28, y, 10, { bold: true, color: '#ffffff', font: 'montserrat' }), L(28, y + 17, 172, y + 17, { color: '#3b4a6b' })];
      const head = (t, y) => [T(t, 228, y, 12, { bold: true, color: navy, font: 'montserrat' }), L(228, y + 20, 556, y + 20, { color: acc, w: 1.5 })];
      const job = (title, place, dates, text, y) => [
        T(title, 228, y, 11.5, { bold: true, color: navy }), RT(dates, 556, y + 1, 9.5, { color: '#6b7280' }),
        T(place, 228, y + 16, 10, { italic: true, color: acc }), T(text, 228, y + 34, 9.5, { color: '#374151' }),
      ];
      return [
        R(0, 0, 200, 841.89, { fill: navy }),
        E(52, 46, 96, 96, { fill: '#334366', stroke: '#4b5d85', sw: 2 }), C('PHOTO', 100, 88, 9, { color: '#8fa0c4', bold: true }),
        ...sideHead('CONTACT', 176), T('+1 555 010 2030\nalex.morgan@email.com\nalexmorgan.design\nNew York, USA', 28, 202, 9.5, { color: side }),
        ...sideHead('SKILLS', 292), T('User research\nWireframing and prototyping\nFigma, Sketch, Adobe XD\nDesign systems\nHTML and CSS basics\nUsability testing', 28, 318, 9.5, { color: side }),
        ...sideHead('LANGUAGES', 444), T('English  (native)\nSpanish  (fluent)\nFrench  (basic)', 28, 470, 9.5, { color: side }),
        ...sideHead('INTERESTS', 540), T('Photography\nTravel\nRunning', 28, 566, 9.5, { color: side }),
        T('ALEX MORGAN', 228, 54, 28, { bold: true, color: navy, font: 'montserrat' }),
        T('Product Designer', 228, 92, 14, { color: acc, font: 'montserrat' }),
        ...head('PROFILE', 140), T(lorem, 228, 170, 9.5, { color: '#374151' }),
        ...head('EXPERIENCE', 222),
        ...job('Senior Product Designer', 'Brightline Studio, New York', '2021 - Present', 'Led the redesign of the mobile app used by 2 million people.\nBuilt a shared design system with 120 components.', 254),
        ...job('Product Designer', 'Northwind Apps, Boston', '2018 - 2021', 'Designed onboarding flows that raised sign-ups by 30 percent.\nRan weekly usability tests with real customers.', 328),
        ...job('Junior Designer', 'Pixel and Co, Boston', '2016 - 2018', 'Created web pages, banners and icons for client projects.', 402),
        ...head('EDUCATION', 470),
        ...job('BA in Graphic Design', 'Rhode Island School of Design', '2012 - 2016', 'Graduated with honours. Focus on interaction design.', 502),
        ...head('CERTIFICATES', 576),
        T('Google UX Design Certificate  -  2020\nNielsen Norman Group UX Certification  -  2022', 228, 606, 9.5, { color: '#374151' }),
      ];
    })(),
  },
  {
    id: 'resume-classic', name: 'Classic resume', cat: 'resume', size: A4,
    items: (() => {
      const ink = '#111827', mid = 297.64;
      const head = (t, y) => [T(t, 60, y, 11, { bold: true, font: 'times', color: ink }), L(60, y + 17, 535, y + 17, { color: '#111827', w: 0.8 })];
      return [
        C('Sarah Ahmed', mid, 50, 30, { font: 'playfair-display', color: ink }),
        C('Accountant  |  Lahore, Pakistan  |  +92 300 1234567  |  sarah.ahmed@email.com', mid, 94, 9.5, { color: '#4b5563' }),
        L(60, 118, 535, 118, { color: '#111827', w: 1.6 }),
        ...head('SUMMARY', 136),
        T('Chartered accountant with six years of experience in audit, tax and financial reporting.\nCareful with numbers, clear with people and comfortable with deadlines.', 60, 162, 10, { font: 'times', color: '#374151' }),
        ...head('EXPERIENCE', 210),
        T('Senior Accountant, Crescent Textiles', 60, 236, 11, { bold: true, font: 'times' }), RT('2020 - Present', 535, 237, 10, { font: 'times', italic: true, color: '#4b5563' }),
        T('-  Prepare monthly and annual financial statements for three companies.\n-  Reduced month-end closing time from 10 to 6 working days.\n-  Coordinate external audits and tax filings.', 60, 254, 10, { font: 'times', color: '#374151' }),
        T('Audit Associate, Riaz Ahmad and Co', 60, 314, 11, { bold: true, font: 'times' }), RT('2017 - 2020', 535, 315, 10, { font: 'times', italic: true, color: '#4b5563' }),
        T('-  Audited manufacturing, retail and banking clients.\n-  Tested internal controls and wrote management letters.', 60, 332, 10, { font: 'times', color: '#374151' }),
        ...head('EDUCATION', 384),
        T('ACCA, Association of Chartered Certified Accountants', 60, 410, 11, { bold: true, font: 'times' }), RT('2019', 535, 411, 10, { font: 'times', italic: true, color: '#4b5563' }),
        T('B.Com (Hons), University of the Punjab', 60, 430, 11, { bold: true, font: 'times' }), RT('2016', 535, 431, 10, { font: 'times', italic: true, color: '#4b5563' }),
        ...head('SKILLS', 474),
        T('IFRS reporting   -   Tax returns   -   SAP and QuickBooks   -   Advanced Excel   -   Team leadership', 60, 500, 10, { font: 'times', color: '#374151' }),
        ...head('REFERENCES', 540),
        T('Available on request.', 60, 566, 10, { font: 'times', italic: true, color: '#374151' }),
      ];
    })(),
  },
  {
    id: 'cover-letter', name: 'Cover letter', cat: 'resume', size: A4,
    items: [
      R(0, 0, 595.28, 10, { fill: '#0f766e' }),
      T('JAMES CARTER', 60, 56, 24, { bold: true, font: 'montserrat', color: '#0f766e' }),
      T('Marketing Manager', 60, 88, 12, { color: '#4b5563' }),
      RT('+44 7700 900123\njames.carter@email.com\nManchester, UK', 535, 58, 9.5, { color: '#4b5563' }),
      L(60, 124, 535, 124, { color: '#d1d5db' }),
      T('12 October 2026', 60, 148, 10.5, { color: '#374151' }),
      T('Hiring Manager\nBlue Harbour Ltd\n25 King Street\nLondon, EC2V 8AA', 60, 180, 10.5, { color: '#374151' }),
      T('Dear Hiring Manager,', 60, 262, 11, { bold: true }),
      T('I am writing to apply for the Marketing Manager role at Blue Harbour. With seven years of\nexperience leading digital campaigns for consumer brands, I would love to help your\nteam reach more customers.', 60, 290, 10.5, { color: '#374151' }),
      T('In my current role at Northfield Foods I lead a team of five and manage a yearly budget of\n1.2 million pounds. Last year our campaigns grew online sales by 45 percent while cutting\nthe cost per customer by a fifth.', 60, 352, 10.5, { color: '#374151' }),
      T('I enjoy turning data into clear plans, and I work closely with design, sales and product\nteams. I would welcome the chance to talk about how I could contribute.', 60, 414, 10.5, { color: '#374151' }),
      T('Thank you for your time and consideration.', 60, 462, 10.5, { color: '#374151' }),
      T('Kind regards,', 60, 500, 10.5, { color: '#374151' }),
      T('James Carter', 60, 530, 22, { font: 'great-vibes', color: '#0f766e' }),
      T('James Carter', 60, 566, 10.5, { bold: true }),
    ],
  },

  // ------------------------------------------------------------ business --
  {
    id: 'invoice', name: 'Invoice', cat: 'business', size: A4,
    items: (() => {
      const blue = '#1d4ed8';
      return [
        R(0, 0, 595.28, 120, { fill: '#eff4ff' }),
        R(50, 40, 40, 40, { fill: blue, r: 8 }), C('YC', 70, 51, 15, { bold: true, color: '#ffffff' }),
        T('Your Company', 100, 42, 16, { bold: true, color: '#111827' }), T('123 Business Road, City\nhello@yourcompany.com', 100, 62, 9, { color: '#4b5563' }),
        RT('INVOICE', 545, 40, 30, { bold: true, color: blue, font: 'montserrat' }),
        RT('Invoice no.  INV-0042\nDate:  12 Oct 2026\nDue:  26 Oct 2026', 545, 78, 9.5, { color: '#374151' }),
        T('BILL TO', 50, 146, 9, { bold: true, color: blue }),
        T('Client Name\nClient Company Ltd\n45 Market Street, City\nclient@email.com', 50, 162, 10, { color: '#374151' }),
        T('PAYMENT', 330, 146, 9, { bold: true, color: blue }),
        T('Bank: City Bank\nAccount: 0123 4567 8910\nIBAN: XX00 CITY 0123 4567', 330, 162, 10, { color: '#374151' }),
        ...table({
          x: 50, y: 250, w: 495, headFill: blue, zebra: '#f8fafc',
          cols: [[62, 'left'], [370, 'center'], [450, 'right'], [533, 'right']],
          head: ['Description', 'Qty', 'Price', 'Amount'],
          rows: [['Website design', '1', '1,200.00', '1,200.00'], ['Logo and brand kit', '1', '450.00', '450.00'], ['Hosting (12 months)', '12', '15.00', '180.00'], ['Content writing, per page', '6', '40.00', '240.00'], ['', '', '', '']],
        }),
        RT('Subtotal', 450, 424, 10, { color: '#4b5563' }), RT('2,070.00', 533, 424, 10),
        RT('Tax (10%)', 450, 444, 10, { color: '#4b5563' }), RT('207.00', 533, 444, 10),
        R(330, 466, 215, 34, { fill: blue, r: 4 }),
        RT('TOTAL', 450, 476, 11, { bold: true, color: '#ffffff' }), RT('2,277.00', 533, 476, 12, { bold: true, color: '#ffffff' }),
        T('Notes', 50, 540, 10, { bold: true }),
        T('Thank you for your business. Please pay within 14 days.', 50, 558, 9.5, { color: '#4b5563' }),
        L(50, 790, 545, 790, { color: '#e5e7eb' }),
        C('Your Company  |  www.yourcompany.com  |  +1 555 0100', 297.64, 800, 8.5, { color: '#9ca3af' }),
      ];
    })(),
  },
  {
    id: 'quotation', name: 'Quotation', cat: 'business', size: A4,
    items: (() => {
      const green = '#15803d';
      return [
        R(0, 0, 14, 841.89, { fill: green }),
        T('QUOTATION', 50, 46, 28, { bold: true, color: green, font: 'oswald' }),
        T('Quote no. Q-2026-118\nDate: 12 Oct 2026\nValid until: 11 Nov 2026', 50, 88, 9.5, { color: '#4b5563' }),
        RT('GreenLeaf Services\n12 Garden Lane, City\n+1 555 0177\nquotes@greenleaf.com', 545, 48, 9.5, { color: '#374151' }),
        R(50, 150, 495, 70, { fill: '#f0fdf4', stroke: '#bbf7d0', r: 6 }),
        T('PREPARED FOR', 64, 162, 8.5, { bold: true, color: green }),
        T('Mr. Daniel Lee\nLee Properties, 8 Hill Road, City', 64, 178, 10.5, { color: '#111827' }),
        ...table({
          x: 50, y: 244, w: 495, headFill: '#14532d', line: '#d1fae5',
          cols: [[62, 'left'], [360, 'center'], [445, 'right'], [533, 'right']],
          head: ['Service', 'Hours', 'Rate', 'Total'],
          rows: [['Garden design plan', '6', '50.00', '300.00'], ['Lawn installation', '16', '35.00', '560.00'], ['Planting and mulching', '10', '30.00', '300.00'], ['Irrigation system', '8', '45.00', '360.00']],
        }),
        L(330, 400, 545, 400, { color: '#14532d', w: 1.5 }),
        RT('Estimated total', 445, 412, 11, { bold: true }), RT('1,520.00', 533, 412, 12, { bold: true, color: green }),
        T('Terms', 50, 470, 10.5, { bold: true }),
        T('-  50 percent deposit to book the work, balance on completion.\n-  Prices include materials listed above.\n-  This quote is valid for 30 days.', 50, 490, 9.5, { color: '#4b5563' }),
        T('Accepted by (signature)', 50, 600, 9, { color: '#6b7280' }), L(50, 640, 250, 640, { color: '#9ca3af' }),
        T('Date', 330, 600, 9, { color: '#6b7280' }), L(330, 640, 545, 640, { color: '#9ca3af' }),
      ];
    })(),
  },
  {
    id: 'receipt', name: 'Payment receipt', cat: 'business', size: A5,
    items: [
      C('CORNER CAFE', 209.76, 40, 18, { bold: true, font: 'montserrat' }),
      C('22 Station Road, City\nTel 555 0144', 209.76, 66, 9, { color: '#6b7280' }),
      L(36, 104, 383, 104, { color: '#9ca3af', dash: 'dashed' }),
      T('Receipt #  10482', 36, 116, 9.5, { color: '#374151' }), RT('12 Oct 2026  14:32', 383, 116, 9.5, { color: '#374151' }),
      L(36, 138, 383, 138, { color: '#9ca3af', dash: 'dashed' }),
      T('2 x  Cappuccino\n1 x  Chicken sandwich\n1 x  Chocolate muffin\n1 x  Bottled water', 36, 152, 10.5, { font: 'courier' }),
      RT('7.00\n6.50\n3.25\n1.50', 383, 152, 10.5, { font: 'courier' }),
      L(36, 220, 383, 220, { color: '#9ca3af', dash: 'dashed' }),
      T('Subtotal\nTax 8%', 36, 232, 10.5, { font: 'courier', color: '#4b5563' }), RT('18.25\n1.46', 383, 232, 10.5, { font: 'courier', color: '#4b5563' }),
      T('TOTAL', 36, 272, 14, { bold: true, font: 'courier' }), RT('19.71', 383, 272, 14, { bold: true, font: 'courier' }),
      T('Paid by card', 36, 296, 10, { font: 'courier', color: '#4b5563' }), RT('**** 4821', 383, 296, 10, { font: 'courier', color: '#4b5563' }),
      L(36, 324, 383, 324, { color: '#9ca3af', dash: 'dashed' }),
      C('Thank you for visiting!', 209.76, 344, 12, { font: 'pacifico', color: '#b45309' }),
      C('Keep this receipt for returns within 7 days.', 209.76, 376, 8.5, { color: '#9ca3af' }),
    ],
  },
  {
    id: 'letterhead', name: 'Company letterhead', cat: 'business', size: A4,
    items: [
      E(50, 40, 44, 44, { fill: '#7c3aed' }), C('N', 72, 51, 18, { bold: true, color: '#ffffff', font: 'montserrat' }),
      T('NOVA', 104, 44, 20, { bold: true, font: 'montserrat', color: '#1f2937' }), T('CONSULTING GROUP', 104, 68, 8.5, { color: '#7c3aed', bold: true }),
      RT('45 Park Avenue, Suite 9\nNew York, NY 10016\n+1 555 0190\ninfo@novaconsulting.com', 545, 42, 8.5, { color: '#6b7280' }),
      L(50, 104, 545, 104, { color: '#7c3aed', w: 2 }),
      T('12 October 2026', 50, 140, 10.5, { color: '#374151' }),
      T('Recipient Name\nCompany\nAddress line\nCity, Postcode', 50, 172, 10.5, { color: '#374151' }),
      T('Subject: Write the subject of your letter here', 50, 252, 11, { bold: true }),
      T('Dear Sir or Madam,\n\nStart writing your letter here. Click this text to change it, or delete it and add\nnew text with the Text tool. Use the rulers and guide lines to keep everything aligned.\n\nYours faithfully,', 50, 284, 10.5, { color: '#374151' }),
      T('Name Surname\nPosition', 50, 420, 10.5, { bold: true }),
      R(0, 812, 595.28, 29.89, { fill: '#7c3aed' }),
      C('www.novaconsulting.com', 297.64, 821, 9, { color: '#ffffff', bold: true }),
    ],
  },
  {
    id: 'memo', name: 'Office memo', cat: 'business', size: A4,
    items: [
      T('MEMO', 50, 50, 40, { bold: true, font: 'oswald', color: '#b91c1c' }),
      T('INTERNAL', 50, 104, 9, { bold: true, color: '#6b7280' }),
      ...[['TO:', 'All staff'], ['FROM:', 'Human Resources'], ['DATE:', '12 October 2026'], ['SUBJECT:', 'Office closed on Friday for maintenance']].flatMap(([k, v], i) => [
        T(k, 50, 140 + i * 30, 10.5, { bold: true }), T(v, 140, 140 + i * 30, 10.5, { color: '#374151' }), L(140, 158 + i * 30, 545, 158 + i * 30, { color: '#e5e7eb' }),
      ]),
      L(50, 272, 545, 272, { color: '#b91c1c', w: 2 }),
      T('Please note that the office will be closed this Friday for electrical maintenance.\nAll staff should work from home on that day. Laptops can be collected from the\nIT desk on Thursday afternoon.\n\nThe office will open as usual on Monday at 9:00.\n\nIf you have any questions, please contact HR on extension 204.', 50, 300, 10.5, { color: '#374151' }),
      T('Thank you,\nHR Team', 50, 440, 10.5, { color: '#374151' }),
    ],
  },

  // -------------------------------------------------------- certificates --
  {
    id: 'cert-achievement', name: 'Certificate of achievement', cat: 'certificate', size: A4L,
    items: (() => {
      const gold = '#b8892b', ink = '#1f2937', mid = 420.95;
      return [
        R(0, 0, 841.89, 595.28, { fill: '#fffdf7' }),
        R(22, 22, 797.89, 551.28, { stroke: gold, sw: 3 }),
        R(34, 34, 773.89, 527.28, { stroke: gold, sw: 1 }),
        C('CERTIFICATE', mid, 92, 44, { font: 'playfair-display', bold: true, color: ink }),
        C('OF ACHIEVEMENT', mid, 152, 15, { color: gold, bold: true, font: 'montserrat' }),
        L(330, 184, 512, 184, { color: gold, w: 1.2 }),
        C('This certificate is proudly presented to', mid, 206, 12, { italic: true, color: '#4b5563', font: 'times' }),
        C('Ayesha Khan', mid, 236, 48, { font: 'great-vibes', color: ink }),
        L(250, 304, 592, 304, { color: '#9ca3af' }),
        C('for outstanding performance and dedication in the Annual Science Fair 2026,\nwinning first place in the senior category.', mid, 320, 12, { color: '#4b5563', font: 'times' }),
        E(386, 404, 70, 70, { fill: gold }), E(394, 412, 54, 54, { stroke: '#fff3d6', sw: 1.5, fill: gold }), C('2026', mid, 432, 12, { bold: true, color: '#ffffff' }),
        L(120, 470, 320, 470, { color: ink }), C('Date', 220, 478, 10, { color: '#6b7280' }), C('12 October 2026', 220, 446, 11, { font: 'times' }),
        L(522, 470, 722, 470, { color: ink }), C('Principal', 622, 478, 10, { color: '#6b7280' }), C('M. Siddiqui', 622, 432, 24, { font: 'sacramento' }),
      ];
    })(),
  },
  {
    id: 'cert-completion', name: 'Course completion', cat: 'certificate', size: A4L,
    items: (() => {
      const teal = '#0e7490';
      return [
        R(0, 0, 250, 595.28, { fill: teal }),
        E(-80, 380, 300, 300, { fill: '#155e75' }), E(140, -90, 200, 200, { fill: '#0891b2', op: 70 }),
        T('FLIPIT\nACADEMY', 40, 60, 22, { bold: true, color: '#ffffff', font: 'montserrat' }),
        T('Certificate no.\nFA-2026-0451', 40, 500, 9, { color: '#cffafe' }),
        T('CERTIFICATE OF COMPLETION', 290, 80, 13, { bold: true, color: teal, font: 'montserrat' }),
        T('Daniel Rivera', 290, 116, 40, { bold: true, color: '#0f172a', font: 'poppins' }),
        L(290, 178, 790, 178, { color: '#e2e8f0', w: 2 }),
        T('has successfully completed the online course', 290, 200, 12, { color: '#475569' }),
        T('Web Development Fundamentals', 290, 224, 22, { bold: true, color: teal, font: 'poppins' }),
        T('40 hours of lessons and projects covering HTML, CSS, JavaScript\nand responsive design, completed with a final score of 92 percent.', 290, 268, 11, { color: '#475569' }),
        T('Instructor', 290, 452, 9.5, { color: '#64748b' }), L(290, 440, 480, 440, { color: '#94a3b8' }), T('Laura Chen', 290, 404, 24, { font: 'sacramento', color: '#0f172a' }),
        T('Date of completion', 560, 452, 9.5, { color: '#64748b' }), L(560, 440, 750, 440, { color: '#94a3b8' }), T('12 October 2026', 560, 418, 12, { color: '#0f172a' }),
      ];
    })(),
  },
  {
    id: 'cert-appreciation', name: 'Certificate of appreciation', cat: 'certificate', size: A4L,
    items: (() => {
      const red = '#9f1239', mid = 420.95;
      return [
        R(0, 0, 841.89, 70, { fill: red }), R(0, 525.28, 841.89, 70, { fill: red }),
        R(0, 70, 841.89, 6, { fill: '#e8b4bc' }), R(0, 519.28, 841.89, 6, { fill: '#e8b4bc' }),
        C('Certificate of Appreciation', mid, 116, 38, { font: 'dm-serif-display', color: red }),
        C('PRESENTED TO', mid, 186, 11, { bold: true, color: '#6b7280', font: 'montserrat' }),
        C('Mohammed Ali', mid, 212, 40, { font: 'allura', color: '#111827' }),
        L(270, 274, 572, 274, { color: red }),
        C('In sincere appreciation of your volunteer work and kindness during\nthe Community Clean-Up Week. Your effort made a real difference.', mid, 294, 12, { color: '#4b5563' }),
        C('Green City Volunteers  -  October 2026', mid, 370, 11, { bold: true, color: red }),
        L(160, 462, 340, 462, { color: '#111827' }), C('Coordinator', 250, 470, 10, { color: '#6b7280' }),
        L(502, 462, 682, 462, { color: '#111827' }), C('Director', 592, 470, 10, { color: '#6b7280' }),
      ];
    })(),
  },

  // ------------------------------------------------------------ marketing --
  {
    id: 'event-flyer', name: 'Event flyer', cat: 'marketing', size: A4,
    items: (() => {
      const dark = '#111827', pink = '#ec4899', mid = 297.64;
      return [
        R(0, 0, 595.28, 841.89, { fill: dark }),
        E(330, -120, 380, 380, { fill: pink, op: 85 }), E(-140, 520, 360, 360, { fill: '#8b5cf6', op: 75 }),
        T('SUMMER', 50, 150, 72, { bold: true, color: '#ffffff', font: 'bebas-neue' }),
        T('MUSIC FEST', 50, 228, 72, { bold: true, color: pink, font: 'bebas-neue' }),
        T('Live bands  -  Food trucks  -  Fireworks', 52, 318, 15, { color: '#e5e7eb', font: 'montserrat' }),
        R(50, 380, 230, 92, { fill: '#ffffff', r: 12 }),
        T('SATURDAY', 70, 396, 12, { bold: true, color: pink, font: 'montserrat' }),
        T('24 August', 70, 416, 26, { bold: true, color: dark, font: 'montserrat' }),
        T('From 5 PM until late', 70, 450, 10.5, { color: '#4b5563' }),
        T('Riverside Park\nMain Stage, Gate B', 310, 396, 15, { bold: true, color: '#ffffff' }),
        T('Free entry for children under 12', 310, 446, 10.5, { color: '#d1d5db' }),
        R(50, 640, 495.28, 62, { fill: pink, r: 31 }),
        C('TICKETS AT WWW.SUMMERFEST.COM', mid, 660, 16, { bold: true, color: '#ffffff', font: 'montserrat' }),
        C('Organised by the City Arts Council', mid, 760, 9.5, { color: '#9ca3af' }),
      ];
    })(),
  },
  {
    id: 'sale-poster', name: 'Sale poster', cat: 'marketing', size: A4,
    items: (() => {
      const red = '#dc2626', yel = '#facc15', mid = 297.64;
      return [
        R(0, 0, 595.28, 841.89, { fill: yel }),
        R(0, 0, 595.28, 300, { fill: red }),
        C('MEGA', mid, 60, 64, { bold: true, color: '#ffffff', font: 'anton' }),
        C('SALE', mid, 140, 110, { bold: true, color: '#ffffff', font: 'anton' }),
        E(197.64, 250, 200, 200, { fill: '#111827' }),
        C('UP TO', mid, 300, 18, { bold: true, color: yel, font: 'montserrat' }),
        C('50%', mid, 322, 62, { bold: true, color: '#ffffff', font: 'anton' }),
        C('OFF', mid, 400, 18, { bold: true, color: yel, font: 'montserrat' }),
        C('On shoes, bags and accessories', mid, 490, 18, { bold: true, color: '#111827' }),
        C('This weekend only  -  Friday to Sunday', mid, 522, 13, { color: '#374151' }),
        R(117.64, 590, 360, 56, { stroke: '#111827', sw: 3, r: 6 }),
        C('SHOP NOW IN STORE AND ONLINE', mid, 608, 15, { bold: true, color: '#111827', font: 'montserrat' }),
        C('www.yourstore.com', mid, 740, 14, { bold: true, color: red }),
      ];
    })(),
  },
  {
    id: 'restaurant-menu', name: 'Restaurant menu', cat: 'marketing', size: A4,
    items: (() => {
      const bg = '#1c1917', gold = '#d4a85a', txt = '#f5f5f4', mid = 297.64;
      const dish = (name, desc, price, y) => [T(name, 70, y, 13, { bold: true, color: txt }), RT(price, 525, y, 13, { bold: true, color: gold }), T(desc, 70, y + 18, 9.5, { italic: true, color: '#a8a29e' })];
      return [
        R(0, 0, 595.28, 841.89, { fill: bg }),
        R(30, 30, 535.28, 781.89, { stroke: gold, sw: 1 }),
        C('La Piazza', mid, 60, 42, { font: 'playfair-display', italic: true, color: gold }),
        C('ITALIAN KITCHEN', mid, 122, 10, { bold: true, color: txt, font: 'montserrat' }),
        C('STARTERS', mid, 172, 15, { bold: true, color: gold, font: 'playfair-display' }), L(250, 196, 345, 196, { color: gold }),
        ...dish('Bruschetta', 'Toasted bread, tomato, basil, olive oil', '7.50', 214),
        ...dish('Burrata', 'Creamy cheese, cherry tomatoes, pesto', '11.00', 258),
        ...dish('Minestrone', 'Vegetable and bean soup with parmesan', '8.00', 302),
        C('MAIN COURSES', mid, 362, 15, { bold: true, color: gold, font: 'playfair-display' }), L(250, 386, 345, 386, { color: gold }),
        ...dish('Margherita pizza', 'Tomato, mozzarella, fresh basil', '12.50', 404),
        ...dish('Spaghetti carbonara', 'Egg, pecorino, black pepper, guanciale', '14.00', 448),
        ...dish('Chicken parmigiana', 'Breaded chicken, tomato sauce, mozzarella', '16.50', 492),
        ...dish('Mushroom risotto', 'Arborio rice, porcini, parmesan', '15.00', 536),
        C('DESSERTS', mid, 596, 15, { bold: true, color: gold, font: 'playfair-display' }), L(250, 620, 345, 620, { color: gold }),
        ...dish('Tiramisu', 'Coffee, mascarpone, cocoa', '7.00', 638),
        ...dish('Panna cotta', 'Vanilla cream, berry sauce', '6.50', 682),
        C('Open daily 12:00 - 23:00  -  Reservations +1 555 0133', mid, 770, 9.5, { color: '#a8a29e' }),
      ];
    })(),
  },
  {
    id: 'report-cover', name: 'Report cover', cat: 'business', size: A4,
    items: [
      R(0, 0, 595.28, 841.89, { fill: '#f8fafc' }),
      R(0, 0, 595.28, 470, { fill: '#0f172a' }),
      R(380, 0, 215.28, 470, { fill: '#1e3a8a' }), R(470, 0, 125.28, 470, { fill: '#2563eb' }),
      T('ANNUAL REPORT', 50, 130, 14, { bold: true, color: '#93c5fd', font: 'montserrat' }),
      T('2026', 50, 156, 96, { bold: true, color: '#ffffff', font: 'oswald' }),
      T('Growing together', 50, 290, 22, { color: '#e2e8f0', font: 'poppins' }),
      R(50, 340, 60, 5, { fill: '#2563eb' }),
      T('Company Name', 50, 520, 22, { bold: true, color: '#0f172a', font: 'poppins' }),
      T('Prepared by the Finance Department\nPublished October 2026', 50, 556, 11, { color: '#475569' }),
      T('CONTENTS', 50, 640, 10, { bold: true, color: '#2563eb' }),
      T('1.  Message from the CEO\n2.  Year in numbers\n3.  Financial statements\n4.  Plans for next year', 50, 660, 11, { color: '#334155' }),
    ],
  },

  // ------------------------------------------------------------- planning --
  {
    id: 'meeting-agenda', name: 'Meeting agenda', cat: 'planning', size: A4,
    items: [
      T('Meeting Agenda', 50, 50, 28, { bold: true, font: 'poppins', color: '#1f2937' }),
      R(50, 98, 70, 4, { fill: '#f97316' }),
      ...[['Date', 'Monday, 12 October 2026'], ['Time', '10:00 - 11:30'], ['Place', 'Meeting room 3 / Video call'], ['Chair', 'Emma Wilson']].flatMap(([k, v], i) => [
        T(k, 50 + (i % 2) * 250, 124 + Math.floor(i / 2) * 22, 9.5, { bold: true, color: '#f97316' }), T(v, 95 + (i % 2) * 250, 124 + Math.floor(i / 2) * 22, 9.5, { color: '#374151' }),
      ]),
      ...table({
        x: 50, y: 190, w: 495, headFill: '#1f2937', rowH: 34, size: 10,
        cols: [[62, 'left'], [140, 'left'], [440, 'left']],
        head: ['Time', 'Topic', 'Lead'],
        rows: [['10:00', 'Welcome and goals for today', 'Emma'], ['10:10', 'Review of last month\'s actions', 'Raj'], ['10:30', 'Sales update and new targets', 'Sofia'], ['10:50', 'Product launch plan', 'Liam'], ['11:15', 'Questions and next steps', 'All'], ['', '', '']],
      }),
      T('Notes', 50, 450, 12, { bold: true }),
      ...Array.from({ length: 10 }, (_, i) => L(50, 490 + i * 28, 545, 490 + i * 28, { color: '#e5e7eb' })),
    ],
  },
  {
    id: 'todo-list', name: 'To-do checklist', cat: 'planning', size: A4,
    items: [
      T('To Do', 60, 50, 40, { font: 'pacifico', color: '#0d9488' }),
      T('Date: ____________________', 360, 72, 10.5, { color: '#6b7280' }),
      R(60, 118, 475, 3, { fill: '#0d9488' }),
      ...Array.from({ length: 18 }, (_, i) => [BOX(64, 150 + i * 34, '#0d9488', 13), L(90, 165 + i * 34, 535, 165 + i * 34, { color: '#e5e7eb' })]).flat(),
      T('Priority today:', 60, 772, 10.5, { bold: true, color: '#0d9488' }), L(150, 784, 535, 784, { color: '#99f6e4' }),
    ],
  },
  {
    id: 'weekly-planner', name: 'Weekly planner', cat: 'planning', size: A4L,
    items: (() => {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#ec4899'];
      const out = [T('Weekly Planner', 40, 30, 26, { bold: true, font: 'poppins', color: '#1f2937' }), T('Week of: ______________', 600, 42, 11, { color: '#6b7280' })];
      days.forEach((d, i) => {
        const col = i % 4, row = Math.floor(i / 4), x = 40 + col * 192, y = 86 + row * 250, w = 180, h = 236;
        out.push(R(x, y, w, h, { stroke: '#e5e7eb', r: 8 }), R(x, y, w, 30, { fill: colors[i], r: 8 }), T(d.toUpperCase(), x + 12, y + 9, 10, { bold: true, color: '#ffffff', font: 'montserrat' }));
        for (let k = 0; k < 6; k++) out.push(L(x + 12, y + 64 + k * 30, x + w - 12, y + 64 + k * 30, { color: '#f1f5f9' }));
      });
      out.push(R(616, 336, 186, 236, { fill: '#f8fafc', stroke: '#e5e7eb', r: 8 }), T('NOTES', 628, 346, 10, { bold: true, color: '#6b7280', font: 'montserrat' }));
      return out;
    })(),
  },
  {
    id: 'lined-notes', name: 'Lined notes', cat: 'planning', size: A4,
    items: [
      T('Notes', 80, 46, 22, { bold: true, font: 'merriweather', color: '#1e3a8a' }),
      T('Date: ______________', 400, 56, 10, { color: '#6b7280' }),
      L(70, 0, 70, 841.89, { color: '#fca5a5', w: 1 }),
      ...Array.from({ length: 30 }, (_, i) => L(40, 100 + i * 24, 555, 100 + i * 24, { color: '#bfdbfe' })),
    ],
  },

  // ------------------------------------------------------------- personal --
  {
    id: 'invitation', name: 'Party invitation', cat: 'personal', size: A5,
    items: (() => {
      const rose = '#be185d', mid = 209.76;
      return [
        R(0, 0, 419.53, 595.28, { fill: '#fff1f5' }),
        R(18, 18, 383.53, 559.28, { stroke: rose, sw: 1.2, r: 10 }),
        E(-60, -60, 180, 180, { fill: '#fbcfe8' }), E(330, 500, 160, 160, { fill: '#fbcfe8' }),
        C('You are invited', mid, 92, 34, { font: 'great-vibes', color: rose }),
        C('TO A BIRTHDAY PARTY FOR', mid, 156, 10, { bold: true, color: '#6b7280', font: 'montserrat' }),
        C('Zara', mid, 178, 64, { font: 'dancing-script', bold: true, color: '#111827' }),
        C('turning 30!', mid, 262, 16, { italic: true, color: rose, font: 'playfair-display' }),
        L(140, 306, 280, 306, { color: rose }),
        C('SATURDAY, 15 NOVEMBER\n7:00 PM', mid, 324, 13, { bold: true, color: '#111827' }),
        C('The Garden Room\n18 Rose Street, City', mid, 380, 12, { color: '#4b5563' }),
        C('Please reply by 1 November\nto Sana on 0300 1234567', mid, 454, 10, { italic: true, color: '#6b7280' }),
      ];
    })(),
  },
  {
    id: 'thank-you', name: 'Thank-you card', cat: 'personal', size: A5L,
    items: [
      R(0, 0, 595.28, 419.53, { fill: '#ecfdf5' }),
      R(0, 0, 210, 419.53, { fill: '#065f46' }),
      E(40, 120, 130, 130, { stroke: '#a7f3d0', sw: 2 }), C('TY', 105, 150, 50, { font: 'great-vibes', color: '#a7f3d0' }),
      T('Thank you', 240, 70, 52, { font: 'great-vibes', color: '#065f46' }),
      T('so much!', 244, 140, 20, { italic: true, font: 'playfair-display', color: '#047857' }),
      T('Your kindness and support mean the world to us.\nWe are truly grateful for everything you have done.', 244, 196, 11, { color: '#374151' }),
      T('With love,', 244, 290, 11, { color: '#374151' }),
      T('The Hassan family', 244, 310, 24, { font: 'sacramento', color: '#065f46' }),
    ],
  },
  {
    id: 'business-cards', name: 'Business cards (10 per page)', cat: 'business', size: A4,
    items: (() => {
      const out = [];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) {
        const x = 40 + c * 263, y = 40 + r * 155, w = 250, h = 145;
        out.push(R(x, y, w, h, { stroke: '#d1d5db', dash: 'dashed', sw: 0.6 }), R(x, y, 8, h, { fill: '#e5322d' }),
          T('Your Name', x + 24, y + 26, 15, { bold: true, font: 'montserrat', color: '#111827' }),
          T('Job title', x + 24, y + 48, 9.5, { color: '#e5322d', bold: true }),
          T('+1 555 0100\nyou@email.com\nwww.yourwebsite.com', x + 24, y + 80, 8.5, { color: '#4b5563' }));
      }
      return out;
    })(),
  },
];
