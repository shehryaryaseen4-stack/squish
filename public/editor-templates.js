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

// a real table object (editable in the editor: rows, columns, header, lines);
// cols = [[width fraction, align], ...]
function table({ x, y, w, cols, head, rows, rowH = 26, headFill, headColor = '#ffffff', line = '#e5e7eb', size = 10, font = 'helv', zebra }) {
  const cells = [head, ...rows];
  return {
    type: 'table', x, y, w, h: rowH * cells.length, rows: cells.length, cols: cols.length,
    cw: cols.map((c) => c[0]), align: cols.map((c) => c[1]), rh: cells.map(() => rowH), rmin: cells.map(() => rowH), cells,
    head: true, font, size, color: '#1f2937', headFill, headColor, stripe: zebra || '', borders: 'rows', border: line, bw: 1, opacity: 100,
  };
}

const lorem = 'Write a short summary here. Two or three sentences about\nwho you are, what you do best and what you are looking for.';

// ------------------------------------------------------------ resume designs --
// 28 resume designs made from 10 layouts, each with its own colours, fonts and sample person,
// so the resume builder (/resume-maker) has 30 resumes with the two above. style groups them
// in the gallery: modern, classic, simple, creative, ats.
const PEOPLE = [
  { name: 'Ayesha Khan', awards: 'Speaker at DevFest Karachi 2023 on fast React apps\nWinner, Bykea internal hackathon 2022\nMentor for 15 junior developers through Code for Pakistan', role: 'Software Engineer', phone: '+92 300 555 0101', email: 'ayesha.khan@email.com', city: 'Karachi, Pakistan', web: 'github.com/ayeshakhan',
    summary: 'Full-stack engineer with five years of experience building fast,\nreliable web apps in JavaScript, Node.js and React.',
    jobs: [['Senior Software Engineer', 'Bykea, Karachi', '2022 - Present', 'Built the rider tracking service used by 1 million people.\nCut page load time by 45 percent across the web app.'],
      ['Software Engineer', 'Systems Ltd, Lahore', '2019 - 2022', 'Developed banking dashboards in React and Node.js.\nWrote tests that halved production bugs.'],
      ['Intern', 'Arbisoft, Lahore', '2018 - 2019', 'Fixed bugs and built small features in Python and Django.']],
    edu: [['BS Computer Science', 'FAST NUCES, Karachi', '2015 - 2019'], ['AWS Certified Developer', 'Amazon Web Services', '2023']],
    skills: ['JavaScript, TypeScript', 'React and Next.js', 'Node.js, Express', 'PostgreSQL, MongoDB', 'AWS, Docker', 'Git and CI/CD'], langs: ['English', 'Urdu', 'Sindhi'] },
  { name: 'Daniel Brooks', awards: "Marketing Week 'Rising Star' award, 2022\nCampaign of the Year shortlist, The Drum Awards 2021\nGuest lecturer on brand strategy, University of Leeds", role: 'Marketing Manager', phone: '+44 7700 900 123', email: 'daniel.brooks@email.com', city: 'London, UK', web: 'linkedin.com/in/dbrooks',
    summary: 'Marketing manager who grows brands with clear stories and good data.\nLed campaigns with budgets of up to 2 million pounds.',
    jobs: [['Marketing Manager', 'Greenleaf Foods, London', '2020 - Present', 'Grew online sales by 60 percent in two years.\nManage a team of six and four agencies.'],
      ['Digital Marketing Lead', 'Brightside Media, Bristol', '2017 - 2020', 'Ran search and social campaigns for 20 clients.\nLowered cost per lead by 35 percent.'],
      ['Marketing Executive', 'Northwind Travel, Bristol', '2015 - 2017', 'Wrote newsletters and managed the company blog.']],
    edu: [['BA Marketing', 'University of Leeds', '2011 - 2015'], ['Google Ads Certification', 'Google', '2021']],
    skills: ['Brand strategy', 'Google and Meta Ads', 'SEO and content', 'Email marketing', 'Analytics, GA4', 'Team leadership'], langs: ['English', 'French', 'German'] },
  { name: 'Fatima Noor', awards: "Nurse of the Year, Shaukat Khanum Hospital, 2023\nLed the ward's hand-hygiene project: infections down 30 percent\nVolunteer nurse at free medical camps in South Punjab", role: 'Registered Nurse', phone: '+92 321 555 0147', email: 'fatima.noor@email.com', city: 'Lahore, Pakistan', web: 'PNC licence 123456',
    summary: 'Caring registered nurse with seven years in busy medical and\nsurgical wards. Calm under pressure and kind to every patient.',
    jobs: [['Senior Staff Nurse', 'Shaukat Khanum Hospital, Lahore', '2020 - Present', 'Lead a team of eight nurses on a 30-bed surgical ward.\nTrained 25 new nurses in patient safety.'],
      ['Staff Nurse', 'Services Hospital, Lahore', '2017 - 2020', 'Cared for up to 12 patients per shift on a medical ward.\nGave medicines and kept accurate patient records.'],
      ['Nursing Intern', 'Mayo Hospital, Lahore', '2016 - 2017', 'Rotated through emergency, children and maternity wards.']],
    edu: [['BSc Nursing', 'University of Health Sciences', '2012 - 2016'], ['Basic Life Support (BLS)', 'American Heart Association', '2024']],
    skills: ['Patient assessment', 'Wound care', 'IV and medication', 'Infection control', 'Electronic records', 'Teamwork'], langs: ['English', 'Urdu', 'Punjabi'] },
  { name: 'Omar Siddiqui', awards: 'Delivered a 40-storey tower two months ahead of schedule\nZero lost-time accidents across 1.2 million work hours\nMember, Pakistan Engineering Council and Society of Engineers UAE', role: 'Civil Engineer', phone: '+971 50 555 0188', email: 'omar.siddiqui@email.com', city: 'Dubai, UAE', web: 'linkedin.com/in/omarsiddiqui',
    summary: 'Civil engineer with nine years on roads, bridges and high-rise\nprojects. Delivers on time, on budget and safely.',
    jobs: [['Senior Project Engineer', 'Al Futtaim Construction, Dubai', '2019 - Present', 'Manage a 40-storey tower worth 120 million dirhams.\nCoordinate 15 subcontractors and the design team.'],
      ['Site Engineer', 'NLC, Islamabad', '2015 - 2019', 'Supervised 60 km of highway works and quality checks.\nPrepared bills of quantities and progress reports.'],
      ['Graduate Engineer', 'Habib Construction, Karachi', '2014 - 2015', 'Assisted with surveying, drawings and site safety.']],
    edu: [['BSc Civil Engineering', 'UET Lahore', '2010 - 2014'], ['PMP Certification', 'Project Management Institute', '2020']],
    skills: ['AutoCAD, Revit', 'Primavera P6', 'Structural design', 'Cost estimation', 'Site safety', 'Contract management'], langs: ['English', 'Arabic', 'Urdu'] },
  { name: 'Emily Carter', awards: "School's Outstanding Teacher award, 2022\nLed a reading programme adopted by four local schools\nFirst aid certified; Forest School practitioner", role: 'Primary School Teacher', phone: '+44 7700 900 456', email: 'emily.carter@email.com', city: 'Manchester, UK', web: 'QTS 2016',
    summary: 'Enthusiastic primary teacher who makes lessons fun and helps\nevery child feel confident to learn.',
    jobs: [['Year 4 Class Teacher', 'Oakwood Primary School', '2019 - Present', 'Raised reading results by 20 percent in one year.\nRun the school science club and the eco council.'],
      ['Year 2 Class Teacher', 'St Mary\'s Primary School', '2016 - 2019', 'Planned lessons for 30 pupils with different needs.\nWorked closely with parents and teaching assistants.'],
      ['Teaching Assistant', 'Hillside Primary School', '2014 - 2016', 'Supported small reading and maths groups.']],
    edu: [['PGCE Primary Education', 'University of Manchester', '2015 - 2016'], ['BA English Literature', 'University of York', '2011 - 2014']],
    skills: ['Lesson planning', 'Classroom management', 'Phonics teaching', 'Special needs support', 'Google Classroom', 'Parent communication'], langs: ['English', 'Spanish'] },
  { name: 'Hamza Ali', awards: "Dean's Honour List, six semesters\nWinner, NUST case competition 2024 (finance track)\nVolunteer tutor for 30 students in maths and English", role: 'Business Graduate', phone: '+92 333 555 0199', email: 'hamza.ali@email.com', city: 'Islamabad, Pakistan', web: 'linkedin.com/in/hamzaali',
    summary: 'Recent BBA graduate looking for a first role in finance or\noperations. Quick learner, organised and good with numbers.',
    jobs: [['Finance Intern', 'Jazz, Islamabad', 'Jun - Aug 2025', 'Prepared weekly sales reports in Excel for the finance team.\nHelped reconcile 500 vendor invoices.'],
      ['Operations Intern', 'Daraz, Lahore', 'Jun - Aug 2024', 'Tracked delivery delays and suggested fixes to managers.'],
      ['President, Business Society', 'NUST Business School', '2023 - 2025', 'Organised three events with over 400 students each.']],
    edu: [['BBA (Finance)', 'NUST Business School, Islamabad', '2021 - 2025'], ['Intermediate (ICS)', 'Punjab College, Rawalpindi', '2019 - 2021']],
    skills: ['Microsoft Excel', 'Financial analysis', 'PowerPoint', 'Report writing', 'Teamwork', 'Public speaking'], langs: ['English', 'Urdu'] },
  { name: 'Sophia Martinez', awards: "Two Laus awards for packaging design, 2020 and 2022\nWork featured in Behance's 'Best of Branding' gallery\nRuns a monthly typography workshop for beginners", role: 'Graphic Designer', phone: '+34 600 555 012', email: 'sophia.martinez@email.com', city: 'Barcelona, Spain', web: 'sophiamartinez.design',
    summary: 'Graphic designer with a love for bold colour and clean layouts.\nBrand identities, packaging and social media for 50+ clients.',
    jobs: [['Senior Graphic Designer', 'Estudio Luna, Barcelona', '2021 - Present', 'Created brand identities for restaurants, shops and apps.\nLead designer on a packaging range sold in 300 stores.'],
      ['Graphic Designer', 'Pixel and Co, Madrid', '2018 - 2021', 'Designed social media posts, ads and websites.\nWon two national packaging design awards.'],
      ['Junior Designer', 'Freelance', '2016 - 2018', 'Logos, flyers and menus for local businesses.']],
    edu: [['BA Graphic Design', 'Escola Massana, Barcelona', '2012 - 2016'], ['Typography course', 'Domestika', '2020']],
    skills: ['Adobe Illustrator', 'Photoshop, InDesign', 'Figma', 'Brand identity', 'Packaging', 'Typography'], langs: ['Spanish', 'English', 'Catalan'] },
  { name: 'Bilal Hussain', awards: "Top sales executive in the region, 2022 and 2024\nOpened the company's first Riyadh hypermarket account\nCertified in consultative selling (Miller Heiman)", role: 'Sales Executive', phone: '+966 55 555 0123', email: 'bilal.hussain@email.com', city: 'Riyadh, Saudi Arabia', web: 'linkedin.com/in/bilalhussain',
    summary: 'Results-driven sales executive who beat targets six years in\na row. Strong at building trust with B2B customers.',
    jobs: [['Senior Sales Executive', 'Almarai, Riyadh', '2021 - Present', 'Manage 120 retail accounts worth 30 million riyals a year.\nReached 118 percent of target in 2024.'],
      ['Sales Executive', 'Unilever Pakistan, Karachi', '2018 - 2021', 'Opened 85 new shops in the Karachi region.\nTrained five new sales officers.'],
      ['Sales Officer', 'Engro Foods, Karachi', '2016 - 2018', 'Visited 40 shops a day and took orders.']],
    edu: [['MBA Marketing', 'IBA Karachi', '2014 - 2016'], ['BBA', 'University of Karachi', '2010 - 2014']],
    skills: ['Key account management', 'Negotiation', 'CRM (Salesforce)', 'Market research', 'Forecasting', 'Presentations'], langs: ['English', 'Arabic', 'Urdu'] },
  { name: 'Zara Malik', awards: 'Built a churn model that saved 2 million dollars a year\nWinner, Toronto Open Data Hackathon 2021\nTableau Desktop Specialist certification', role: 'Data Analyst', phone: '+1 416 555 0175', email: 'zara.malik@email.com', city: 'Toronto, Canada', web: 'zaramalik.dev',
    summary: 'Data analyst who turns messy data into clear answers.\nFour years with SQL, Python and dashboards for retail and banking.',
    jobs: [['Data Analyst', 'TD Bank, Toronto', '2022 - Present', 'Built Power BI dashboards used by 200 branch managers.\nAutomated reports, saving 15 hours of work a week.'],
      ['Junior Data Analyst', 'Loblaw, Toronto', '2020 - 2022', 'Analysed sales data to plan stock for 50 stores.\nWrote SQL queries for marketing and finance.'],
      ['Research Assistant', 'University of Toronto', '2019 - 2020', 'Cleaned and analysed survey data in Python.']],
    edu: [['MSc Data Science', 'University of Toronto', '2018 - 2020'], ['BS Statistics', 'LUMS, Lahore', '2014 - 2018']],
    skills: ['SQL', 'Python, pandas', 'Power BI, Tableau', 'Excel, VBA', 'Statistics', 'Machine learning basics'], langs: ['English', 'Urdu', 'French'] },
  { name: 'James Wilson', awards: 'Opened a new 300,000 sq ft warehouse on time and on budget\nCut overtime costs by 25 percent in one year\nCompany Leadership Award, 2021', role: 'Operations Manager', phone: '+1 212 555 0142', email: 'james.wilson@email.com', city: 'New York, USA', web: 'linkedin.com/in/jameswilson',
    summary: 'Operations leader with twelve years in logistics and retail.\nBuilds teams and processes that run smoothly at scale.',
    jobs: [['Operations Manager', 'Target, New York', '2018 - Present', 'Run a distribution centre with 250 staff.\nCut shipping errors by 40 percent with new checks.'],
      ['Assistant Operations Manager', 'FedEx, Newark', '2014 - 2018', 'Managed night shifts handling 50,000 parcels.\nImproved on-time delivery to 98 percent.'],
      ['Team Lead', 'Amazon, Edison', '2012 - 2014', 'Led a picking team of 30 associates.']],
    edu: [['MBA Operations', 'Rutgers Business School', '2016 - 2018'], ['Lean Six Sigma Green Belt', 'ASQ', '2017']],
    skills: ['Supply chain', 'Lean and Six Sigma', 'Budgeting', 'People management', 'SAP and WMS', 'Safety compliance'], langs: ['English', 'Spanish'] },
];

const W = 595.28, PH = 841.89;
const initials = (n) => n.split(' ').map((s) => s[0]).join('').slice(0, 2);
const lines = (t) => String(t).split('\n').length;

// Each layout returns the page objects for one person p and one look c:
// { acc: accent, dark, soft: light tint, ink, mute, hf: heading font, bf: body font }
const LAYOUTS = {
  // dark sidebar on the left with contact, skills and languages
  sideLeft(p, c) {
    const out = [], sx = 26, mx = 222, mr = 560;
    out.push(R(0, 0, 196, PH, { fill: c.dark }));
    out.push(E(48, 40, 100, 100, { fill: c.acc })); out.push(C(initials(p.name), 98, 72, 30, { color: '#ffffff', bold: true, font: c.hf }));
    let y = 176;
    const sh = (t) => { out.push(T(t, sx, y, 10, { bold: true, color: '#ffffff', font: c.hf }), L(sx, y + 17, 170, y + 17, { color: c.acc, w: 1.2 })); y += 28; };
    sh('CONTACT'); out.push(T(`${p.phone}\n${p.email}\n${p.city}\n${p.web}`, sx, y, 9, { color: '#e5e7eb', font: c.bf })); y += 74;
    sh('SKILLS'); out.push(T(p.skills.join('\n'), sx, y, 9, { color: '#e5e7eb', font: c.bf })); y += p.skills.length * 11 + 22;
    sh('LANGUAGES'); out.push(T(p.langs.join('\n'), sx, y, 9, { color: '#e5e7eb', font: c.bf }));
    out.push(T(p.name.toUpperCase(), mx, 52, 26, { bold: true, color: c.dark, font: c.hf }), T(p.role, mx, 88, 13, { color: c.acc, font: c.hf }));
    y = 130;
    const hd = (t) => { out.push(T(t, mx, y, 11.5, { bold: true, color: c.dark, font: c.hf }), L(mx, y + 19, mr, y + 19, { color: c.acc, w: 1.4 })); y += 30; };
    hd('PROFILE'); out.push(T(p.summary, mx, y, 9.5, { color: c.ink, font: c.bf })); y += 46;
    hd('EXPERIENCE');
    for (const [t, co, d, txt] of p.jobs) { out.push(T(t, mx, y, 11, { bold: true, color: c.dark, font: c.bf }), RT(d, mr, y + 1, 9, { color: c.mute, font: c.bf }), T(co, mx, y + 15, 9.5, { italic: true, color: c.acc, font: c.bf }), T(txt, mx, y + 31, 9.5, { color: c.ink, font: c.bf })); y += 34 + lines(txt) * 12 + 14; }
    hd('EDUCATION');
    for (const [dg, sc, d] of p.edu) { out.push(T(dg, mx, y, 11, { bold: true, color: c.dark, font: c.bf }), RT(d, mr, y + 1, 9, { color: c.mute, font: c.bf }), T(sc, mx, y + 15, 9.5, { color: c.ink, font: c.bf })); y += 38; }
    y += 4; hd('ACHIEVEMENTS'); out.push(T(p.awards.split('\n').map((a) => `-  ${a}`).join('\n'), mx, y, 9.5, { color: c.ink, font: c.bf }));
    return out;
  },
  // light sidebar on the right
  sideRight(p, c) {
    const out = [], mx = 40, mr = 372, sx = 398;
    out.push(R(380, 0, W - 380, PH, { fill: c.soft }));
    out.push(T(p.name, mx, 50, 28, { bold: true, color: c.dark, font: c.hf }), T(p.role.toUpperCase(), mx, 90, 11, { color: c.acc, bold: true, font: c.hf }));
    out.push(R(mx, 116, 46, 3, { fill: c.acc }));
    let y = 140;
    const hd = (t) => { out.push(T(t, mx, y, 12, { bold: true, color: c.acc, font: c.hf })); y += 24; };
    hd('About me'); out.push(T(p.summary.replace('\n', ' ').replace(/(.{1,62})(\s|$)/g, '$1\n').trim(), mx, y, 9.5, { color: c.ink, font: c.bf })); y += 58;
    hd('Work experience');
    for (const [t, co, d, txt] of p.jobs) { out.push(T(t, mx, y, 11, { bold: true, color: c.dark, font: c.bf }), T(`${co}  |  ${d}`, mx, y + 15, 9, { color: c.mute, font: c.bf }), T(txt.replace(/\n/g, '\n'), mx, y + 31, 9, { color: c.ink, font: c.bf })); y += 31 + lines(txt) * 11 + 18; }
    hd('Education');
    for (const [dg, sc, d] of p.edu) { out.push(T(dg, mx, y, 11, { bold: true, color: c.dark, font: c.bf }), T(`${sc}  |  ${d}`, mx, y + 15, 9, { color: c.mute, font: c.bf })); y += 38; }
    let sy = 50;
    const sh = (t) => { out.push(T(t, sx, sy, 11, { bold: true, color: c.dark, font: c.hf }), L(sx, sy + 18, 570, sy + 18, { color: c.acc })); sy += 28; };
    out.push(E(sx + 30, sy, 110, 110, { fill: '#ffffff', stroke: c.acc, sw: 2 }), C('PHOTO', sx + 85, sy + 49, 9, { color: c.mute, bold: true })); sy += 136;
    sh('Contact'); out.push(T(`${p.phone}\n${p.email}\n${p.city}\n${p.web}`, sx, sy, 9, { color: c.ink, font: c.bf })); sy += 74;
    sh('Skills'); out.push(T(p.skills.map((s) => `-  ${s}`).join('\n'), sx, sy, 9, { color: c.ink, font: c.bf })); sy += p.skills.length * 11 + 22;
    sh('Languages'); out.push(T(p.langs.join('\n'), sx, sy, 9, { color: c.ink, font: c.bf }));
    y += 6; hd('Achievements'); out.push(T(p.awards.split('\n').map((a) => `-  ${a}`).join('\n'), mx, y, 9, { color: c.ink, font: c.bf }));
    return out;
  },
  // coloured header band, one column below
  band(p, c) {
    const out = [], x = 50, r = 545;
    out.push(R(0, 0, W, 150, { fill: c.dark }));
    out.push(T(p.name, x, 40, 30, { bold: true, color: '#ffffff', font: c.hf }), T(p.role, x, 80, 13, { color: c.soft, font: c.hf }));
    out.push(T(`${p.phone}    ${p.email}    ${p.city}`, x, 112, 9, { color: '#ffffff', font: c.bf }));
    let y = 180;
    const hd = (t) => { out.push(R(x, y + 2, 4, 14, { fill: c.acc }), T(t, x + 12, y, 12, { bold: true, color: c.dark, font: c.hf })); y += 26; };
    hd('Profile'); out.push(T(p.summary, x, y, 10, { color: c.ink, font: c.bf })); y += 48;
    hd('Experience');
    for (const [t, co, d, txt] of p.jobs) { out.push(T(`${t}, ${co}`, x, y, 11, { bold: true, color: c.dark, font: c.bf }), RT(d, r, y + 1, 9.5, { color: c.acc, bold: true, font: c.bf }), T(txt, x, y + 17, 9.5, { color: c.ink, font: c.bf })); y += 17 + lines(txt) * 12 + 16; }
    hd('Education');
    for (const [dg, sc, d] of p.edu) { out.push(T(`${dg}, ${sc}`, x, y, 10.5, { bold: true, color: c.dark, font: c.bf }), RT(d, r, y + 1, 9.5, { color: c.acc, bold: true, font: c.bf })); y += 22; }
    y += 10; hd('Skills');
    out.push(T(p.skills.slice(0, 3).join('     ·     '), x, y, 9.5, { color: c.ink, font: c.bf }), T(p.skills.slice(3).join('     ·     '), x, y + 15, 9.5, { color: c.ink, font: c.bf })); y += 42;
    hd('Languages'); out.push(T(p.langs.join('   ·   '), x, y, 9.5, { color: c.ink, font: c.bf }));
    y += 40; hd('Achievements'); out.push(T(p.awards.split('\n').map((a) => `-  ${a}`).join('\n'), x, y, 9.5, { color: c.ink, font: c.bf }));
    return out;
  },
  // centred, traditional
  centered(p, c) {
    const out = [], mid = W / 2, x = 60, r = 535;
    out.push(C(p.name, mid, 46, 30, { font: c.hf, color: c.dark }), C(p.role.toUpperCase(), mid, 88, 10.5, { color: c.acc, bold: true, font: c.bf }));
    out.push(C(`${p.city}   |   ${p.phone}   |   ${p.email}`, mid, 108, 9, { color: c.mute, font: c.bf }));
    out.push(L(x, 130, r, 130, { color: c.dark, w: 1.2 }), L(x, 134, r, 134, { color: c.dark, w: 0.5 }));
    let y = 152;
    const hd = (t) => { out.push(C(t, mid, y, 11, { bold: true, color: c.dark, font: c.hf }), L(mid - 40, y + 19, mid + 40, y + 19, { color: c.acc })); y += 30; };
    hd('PROFESSIONAL SUMMARY'); out.push(C(p.summary, mid, y, 10, { color: c.ink, font: c.bf })); y += 46;
    hd('EXPERIENCE');
    for (const [t, co, d, txt] of p.jobs) { out.push(T(t, x, y, 11, { bold: true, color: c.dark, font: c.bf }), RT(d, r, y + 1, 9.5, { italic: true, color: c.mute, font: c.bf }), T(co, x, y + 15, 9.5, { italic: true, color: c.acc, font: c.bf }), T(txt, x, y + 31, 9.5, { color: c.ink, font: c.bf })); y += 31 + lines(txt) * 12 + 16; }
    hd('EDUCATION');
    for (const [dg, sc, d] of p.edu) { out.push(T(dg, x, y, 11, { bold: true, color: c.dark, font: c.bf }), RT(d, r, y + 1, 9.5, { italic: true, color: c.mute, font: c.bf }), T(sc, x, y + 15, 9.5, { color: c.ink, font: c.bf })); y += 38; }
    hd('SKILLS'); out.push(C(p.skills.join('   ·   '), mid, y, 9.5, { color: c.ink, font: c.bf })); y += 30;
    hd('LANGUAGES'); out.push(C(p.langs.join('   ·   '), mid, y, 9.5, { color: c.ink, font: c.bf }));
    y += 30; hd('ACHIEVEMENTS'); out.push(C(p.awards, mid, y, 9.5, { color: c.ink, font: c.bf }));
    return out;
  },
  // header on top, two columns below: details left, experience right
  twoCol(p, c) {
    const out = [], x = 40, r = 555, lx = 40, lr = 182, rx = 210;
    out.push(T(p.name, x, 44, 28, { bold: true, color: c.dark, font: c.hf }), T(p.role, x, 82, 13, { color: c.acc, font: c.hf }));
    out.push(RT(`${p.phone}\n${p.email}\n${p.city}`, r, 48, 9, { color: c.mute, font: c.bf }));
    out.push(R(0, 112, W, 4, { fill: c.acc }));
    out.push(L(196, 136, 196, 800, { color: c.soft, w: 1.2 }));
    let ly = 140;
    const lh = (t) => { out.push(T(t, lx, ly, 10.5, { bold: true, color: c.acc, font: c.hf })); ly += 22; };
    lh('SKILLS'); out.push(T(p.skills.join('\n'), lx, ly, 9, { color: c.ink, font: c.bf })); ly += p.skills.length * 11 + 24;
    lh('EDUCATION'); for (const [dg, sc, d] of p.edu) { out.push(T(dg, lx, ly, 9.5, { bold: true, color: c.dark, font: c.bf }), T(`${sc}\n${d}`, lx, ly + 13, 8.5, { color: c.mute, font: c.bf })); ly += 50; }
    ly += 6; lh('LANGUAGES'); out.push(T(p.langs.join('\n'), lx, ly, 9, { color: c.ink, font: c.bf })); ly += p.langs.length * 11 + 24;
    lh('LINKS'); out.push(T(p.web, lx, ly, 9, { color: c.ink, font: c.bf }));
    let y = 140;
    const hd = (t) => { out.push(T(t, rx, y, 10.5, { bold: true, color: c.acc, font: c.hf })); y += 22; };
    hd('PROFILE'); out.push(T(p.summary, rx, y, 9.5, { color: c.ink, font: c.bf })); y += 48;
    hd('EXPERIENCE');
    for (const [t, co, d, txt] of p.jobs) { out.push(T(t, rx, y, 11, { bold: true, color: c.dark, font: c.bf }), RT(d, r, y + 1, 9, { color: c.mute, font: c.bf }), T(co, rx, y + 15, 9.5, { color: c.acc, font: c.bf }), T(txt, rx, y + 31, 9.5, { color: c.ink, font: c.bf })); y += 31 + lines(txt) * 12 + 20; }
    y += 4; hd('ACHIEVEMENTS'); out.push(T(p.awards.split('\n').map((a) => `-  ${a}`).join('\n'), rx, y, 9.5, { color: c.ink, font: c.bf })); y += 56;
    hd('REFERENCES'); out.push(T('Available on request.', rx, y, 9.5, { italic: true, color: c.mute, font: c.bf }));
    return out;
  },
  // experience on a timeline with dots
  timeline(p, c) {
    const out = [], x = 50, r = 545, tx = 62, cx = 84;
    out.push(T(p.name, x, 48, 30, { bold: true, color: c.dark, font: c.hf }), T(p.role, x, 88, 13, { color: c.acc, font: c.hf }));
    out.push(T(`${p.phone}   ·   ${p.email}   ·   ${p.city}   ·   ${p.web}`, x, 112, 9, { color: c.mute, font: c.bf }));
    let y = 146;
    const hd = (t) => { out.push(T(t, x, y, 12, { bold: true, color: c.dark, font: c.hf }), L(x, y + 20, r, y + 20, { color: c.soft, w: 1.5 })); y += 32; };
    hd('Summary'); out.push(T(p.summary, x, y, 10, { color: c.ink, font: c.bf })); y += 48;
    hd('Experience');
    const top = y + 4;
    for (const [t, co, d, txt] of p.jobs) { out.push(E(tx - 5, y + 2, 10, 10, { fill: c.acc }), T(d, cx, y, 9, { bold: true, color: c.acc, font: c.bf }), T(t, cx, y + 14, 11, { bold: true, color: c.dark, font: c.bf }), T(co, cx, y + 29, 9.5, { italic: true, color: c.mute, font: c.bf }), T(txt, cx, y + 45, 9.5, { color: c.ink, font: c.bf })); y += 45 + lines(txt) * 12 + 16; }
    out.unshift(L(tx, top, tx, y - 18, { color: c.soft, w: 2 }));
    hd('Education');
    for (const [dg, sc, d] of p.edu) { out.push(E(tx - 5, y + 2, 10, 10, { fill: '#ffffff', stroke: c.acc, sw: 2 }), T(d, cx, y, 9, { bold: true, color: c.acc, font: c.bf }), T(`${dg}, ${sc}`, cx, y + 14, 10.5, { bold: true, color: c.dark, font: c.bf })); y += 40; }
    hd('Skills'); out.push(T(p.skills.join('   ·   '), x, y, 9.5, { color: c.ink, font: c.bf }));
    y += 30; hd('Achievements'); out.push(T(p.awards.split('\n').map((a) => `-  ${a}`).join('\n'), x, y, 9.5, { color: c.ink, font: c.bf }));
    return out;
  },
  // quiet design: labels in a narrow left column, content on the right
  minimal(p, c) {
    const out = [], lx = 50, x = 170, r = 545;
    out.push(T(p.name, lx, 60, 32, { color: c.dark, font: c.hf }), T(p.role, lx, 102, 12, { color: c.acc, font: c.bf }));
    out.push(RT(`${p.email}\n${p.phone}\n${p.city}`, r, 64, 9, { color: c.mute, font: c.bf }));
    let y = 160;
    const sec = (t) => { out.push(L(lx, y - 14, r, y - 14, { color: c.soft }), T(t.toUpperCase(), lx, y, 8.5, { bold: true, color: c.acc, font: c.bf })); };
    sec('Profile'); out.push(T(p.summary, x, y, 9.5, { color: c.ink, font: c.bf })); y += 64;
    sec('Experience');
    for (const [t, co, d, txt] of p.jobs) { out.push(T(`${t} - ${co}`, x, y, 10.5, { bold: true, color: c.dark, font: c.bf }), T(d, x, y + 15, 9, { color: c.mute, font: c.bf }), T(txt, x, y + 30, 9.5, { color: c.ink, font: c.bf })); y += 30 + lines(txt) * 12 + 18; }
    y += 6; sec('Education');
    for (const [dg, sc, d] of p.edu) { out.push(T(dg, x, y, 10.5, { bold: true, color: c.dark, font: c.bf }), T(`${sc}, ${d}`, x, y + 15, 9, { color: c.mute, font: c.bf })); y += 38; }
    y += 14; sec('Skills'); out.push(T(p.skills.slice(0, 3).join('\n'), x, y, 9.5, { color: c.ink, font: c.bf }), T(p.skills.slice(3).join('\n'), x + 190, y, 9.5, { color: c.ink, font: c.bf })); y += 58;
    sec('Languages'); out.push(T(p.langs.join(', '), x, y, 9.5, { color: c.ink, font: c.bf }));
    y += 34; sec('Achievements'); out.push(T(p.awards, x, y, 9.5, { color: c.ink, font: c.bf })); y += 64;
    sec('References'); out.push(T('Available on request.', x, y, 9.5, { color: c.mute, font: c.bf }));
    return out;
  },
  // big name next to an accent block, short bars under headings
  bold(p, c) {
    const out = [], x = 56, r = 545;
    out.push(R(0, 36, 34, 92, { fill: c.acc }));
    out.push(T(p.name.split(' ')[0].toUpperCase(), x, 32, 34, { bold: true, color: c.dark, font: c.hf }), T(p.name.split(' ').slice(1).join(' ').toUpperCase(), x, 72, 34, { bold: true, color: c.acc, font: c.hf }));
    out.push(T(p.role, x, 116, 12, { color: c.mute, font: c.bf }));
    out.push(RT(`${p.phone}\n${p.email}\n${p.city}\n${p.web}`, r, 52, 9, { color: c.ink, font: c.bf }));
    let y = 160;
    const hd = (t) => { out.push(T(t, x, y, 13, { bold: true, color: c.dark, font: c.hf }), R(x, y + 21, 32, 3, { fill: c.acc })); y += 34; };
    hd('ABOUT'); out.push(T(p.summary, x, y, 10, { color: c.ink, font: c.bf })); y += 50;
    hd('EXPERIENCE');
    for (const [t, co, d, txt] of p.jobs) { out.push(T(t, x, y, 11.5, { bold: true, color: c.dark, font: c.bf }), RT(d, r, y + 1, 9.5, { bold: true, color: c.acc, font: c.bf }), T(co, x, y + 16, 9.5, { color: c.mute, font: c.bf }), T(txt, x, y + 32, 9.5, { color: c.ink, font: c.bf })); y += 32 + lines(txt) * 12 + 16; }
    hd('EDUCATION');
    for (const [dg, sc, d] of p.edu) { out.push(T(dg, x, y, 11, { bold: true, color: c.dark, font: c.bf }), RT(d, r, y + 1, 9.5, { bold: true, color: c.acc, font: c.bf }), T(sc, x, y + 15, 9.5, { color: c.mute, font: c.bf })); y += 38; }
    hd('SKILLS'); out.push(T(p.skills.slice(0, 3).join('\n'), x, y, 9.5, { color: c.ink, font: c.bf }), T(p.skills.slice(3).join('\n'), x + 200, y, 9.5, { color: c.ink, font: c.bf }));
    y += 58; hd('ACHIEVEMENTS'); out.push(T(p.awards.split('\n').map((a) => `-  ${a}`).join('\n'), x, y, 9.5, { color: c.ink, font: c.bf }));
    return out;
  },
  // plain and dense, best for applicant tracking systems
  ats(p, c) {
    const out = [], x = 54, r = 541;
    out.push(T(p.name, x, 46, 22, { bold: true, color: '#111111', font: c.hf }));
    out.push(T(`${p.role}  |  ${p.city}  |  ${p.phone}  |  ${p.email}  |  ${p.web}`, x, 76, 8.8, { color: '#333333', font: c.bf }));
    let y = 106;
    const hd = (t) => { out.push(T(t, x, y, 10.5, { bold: true, color: c.dark, font: c.hf }), L(x, y + 16, r, y + 16, { color: '#9ca3af', w: 0.8 })); y += 24; };
    hd('SUMMARY'); out.push(T(p.summary, x, y, 9.5, { color: '#222222', font: c.bf })); y += 40;
    hd('WORK EXPERIENCE');
    for (const [t, co, d, txt] of p.jobs) { out.push(T(`${t}, ${co}`, x, y, 10, { bold: true, color: '#111111', font: c.bf }), RT(d, r, y, 9.5, { color: '#333333', font: c.bf }), T(txt.split('\n').map((s) => `-  ${s}`).join('\n'), x, y + 15, 9.5, { color: '#222222', font: c.bf })); y += 15 + lines(txt) * 12 + 14; }
    hd('EDUCATION');
    for (const [dg, sc, d] of p.edu) { out.push(T(`${dg}, ${sc}`, x, y, 10, { bold: true, color: '#111111', font: c.bf }), RT(d, r, y, 9.5, { color: '#333333', font: c.bf })); y += 18; }
    y += 8; hd('SKILLS'); out.push(T(p.skills.join(', '), x, y, 9.5, { color: '#222222', font: c.bf })); y += 30;
    hd('LANGUAGES'); out.push(T(p.langs.join(', '), x, y, 9.5, { color: '#222222', font: c.bf }));
    y += 30; hd('ACHIEVEMENTS'); out.push(T(p.awards.split('\n').map((a) => `-  ${a}`).join('\n'), x, y, 9.5, { color: '#222222', font: c.bf })); y += 52;
    hd('REFERENCES'); out.push(T('Available on request.', x, y, 9.5, { color: '#222222', font: c.bf }));
    return out;
  },
  // colourful: stripe, initials badge and skill bars
  creative(p, c) {
    const out = [], x = 44, r = 551, sx = 392;
    out.push(R(0, 0, W, 10, { fill: c.acc }), R(0, PH - 10, W, 10, { fill: c.acc }));
    out.push(E(x, 40, 84, 84, { fill: c.soft }), C(initials(p.name), x + 42, 66, 28, { bold: true, color: c.acc, font: c.hf }));
    out.push(T(p.name, x + 104, 50, 27, { bold: true, color: c.dark, font: c.hf }), T(p.role, x + 104, 86, 13, { color: c.acc, font: c.bf }));
    out.push(R(x, 146, r - x, 30, { fill: c.soft, r: 8 }), T(`${p.phone}     ${p.email}     ${p.city}`, x + 14, 155, 9, { color: c.dark, font: c.bf }));
    let y = 200;
    const hd = (t, hx = x) => { out.push(T(t, hx, y, 12.5, { bold: true, color: c.acc, font: c.hf })); };
    hd('Hello!'); y += 24; out.push(T(p.summary.replace('\n', ' ').replace(/(.{1,55})(\s|$)/g, '$1\n').trim(), x, y, 9.5, { color: c.ink, font: c.bf }));
    let ry = y + 70;
    y = ry; hd('Experience'); y += 26;
    for (const [t, co, d, txt] of p.jobs) { out.push(T(t, x, y, 11, { bold: true, color: c.dark, font: c.bf }), T(`${co}  ·  ${d}`, x, y + 15, 9, { color: c.mute, font: c.bf }), T(txt.replace(/\n/g, '\n'), x, y + 31, 9, { color: c.ink, font: c.bf })); y += 31 + lines(txt) * 11 + 16; }
    hd('Education'); y += 26;
    for (const [dg, sc, d] of p.edu) { out.push(T(dg, x, y, 10.5, { bold: true, color: c.dark, font: c.bf }), T(`${sc}  ·  ${d}`, x, y + 15, 9, { color: c.mute, font: c.bf })); y += 38; }
    let sy = 200;
    out.push(T('Skills', sx, sy, 12.5, { bold: true, color: c.acc, font: c.hf })); sy += 28;
    p.skills.forEach((s, i) => { const lv = [0.9, 0.8, 0.85, 0.7, 0.75, 0.65][i % 6]; out.push(T(s, sx, sy, 9, { color: c.dark, font: c.bf }), R(sx, sy + 15, 159, 5, { fill: c.soft, r: 2.5 }), R(sx, sy + 15, Math.round(159 * lv), 5, { fill: c.acc, r: 2.5 })); sy += 32; });
    sy += 12; out.push(T('Languages', sx, sy, 12.5, { bold: true, color: c.acc, font: c.hf })); sy += 26;
    out.push(T(p.langs.join('\n'), sx, sy, 9.5, { color: c.ink, font: c.bf })); sy += p.langs.length * 12 + 20;
    out.push(T('Online', sx, sy, 12.5, { bold: true, color: c.acc, font: c.hf }), T(p.web, sx, sy + 26, 9.5, { color: c.ink, font: c.bf }));
    y += 6; hd('Achievements'); y += 26; out.push(T(p.awards.replace(/(.{1,52})(\s|$)/gm, '$1\n').trim().split('\n').slice(0, 6).join('\n'), x, y, 9, { color: c.ink, font: c.bf }));
    return out;
  },
};

// [layout, style, name, colours, heading font, body font]
const LOOKS = [
  ['sideLeft', 'modern', 'Navy sidebar', ['#2563eb', '#1e293b', '#dbeafe'], 'montserrat', 'open-sans'],
  ['band', 'modern', 'Teal header', ['#0d9488', '#134e4a', '#ccfbf1'], 'poppins', 'lato'],
  ['centered', 'classic', 'Elegant serif', ['#9a3412', '#1c1917', '#fde68a'], 'playfair-display', 'lora'],
  ['twoCol', 'modern', 'Professional two-column', ['#4f46e5', '#1e1b4b', '#e0e7ff'], 'raleway', 'source-sans-3'],
  ['timeline', 'modern', 'Timeline', ['#0891b2', '#0f172a', '#cffafe'], 'montserrat', 'roboto'],
  ['minimal', 'simple', 'Minimal', ['#64748b', '#0f172a', '#e2e8f0'], 'raleway', 'lato'],
  ['bold', 'creative', 'Bold name', ['#e11d48', '#111827', '#ffe4e6'], 'oswald', 'roboto'],
  ['ats', 'ats', 'ATS simple', ['#111111', '#111111', '#e5e7eb'], 'helv', 'helv'],
  ['creative', 'creative', 'Creative colour', ['#7c3aed', '#2e1065', '#ede9fe'], 'poppins', 'nunito'],
  ['sideRight', 'modern', 'Right sidebar', ['#059669', '#064e3b', '#ecfdf5'], 'montserrat', 'inter'],
  ['sideLeft', 'modern', 'Charcoal sidebar', ['#f59e0b', '#27272a', '#fef3c7'], 'raleway', 'roboto'],
  ['band', 'modern', 'Royal blue header', ['#1d4ed8', '#1e3a8a', '#bfdbfe'], 'montserrat', 'open-sans'],
  ['centered', 'classic', 'Classic Times', ['#1f2937', '#111827', '#e5e7eb'], 'times', 'times'],
  ['twoCol', 'simple', 'Clean two-column', ['#0f766e', '#134e4a', '#ccfbf1'], 'work-sans', 'work-sans'],
  ['timeline', 'creative', 'Coral timeline', ['#f97316', '#1c1917', '#ffedd5'], 'poppins', 'lato'],
  ['minimal', 'classic', 'Minimal serif', ['#7f1d1d', '#1c1917', '#e7e5e4'], 'libre-baskerville', 'source-serif-4'],
  ['bold', 'modern', 'Bold blue', ['#2563eb', '#0f172a', '#dbeafe'], 'bebas-neue', 'inter'],
  ['ats', 'ats', 'ATS serif', ['#1f2937', '#1f2937', '#e5e7eb'], 'times', 'times'],
  ['creative', 'creative', 'Creative teal', ['#0d9488', '#042f2e', '#ccfbf1'], 'montserrat', 'nunito'],
  ['sideRight', 'classic', 'Burgundy sidebar', ['#9f1239', '#4c0519', '#fff1f2'], 'playfair-display', 'lato'],
  ['sideLeft', 'creative', 'Purple sidebar', ['#c084fc', '#3b0764', '#f3e8ff'], 'poppins', 'nunito'],
  ['band', 'classic', 'Executive header', ['#b45309', '#1c1917', '#fde68a'], 'playfair-display', 'source-sans-3'],
  ['centered', 'simple', 'Centred clean', ['#2563eb', '#111827', '#dbeafe'], 'montserrat', 'open-sans'],
  ['twoCol', 'modern', 'Green two-column', ['#16a34a', '#14532d', '#dcfce7'], 'poppins', 'roboto'],
  ['timeline', 'simple', 'Grey timeline', ['#475569', '#0f172a', '#e2e8f0'], 'inter', 'inter'],
  ['minimal', 'modern', 'Minimal blue', ['#0284c7', '#0c4a6e', '#e0f2fe'], 'dm-sans', 'dm-sans'],
  ['ats', 'ats', 'ATS compact', ['#0f172a', '#0f172a', '#e5e7eb'], 'roboto', 'roboto'],
  ['creative', 'creative', 'Creative pink', ['#db2777', '#500724', '#fce7f3'], 'raleway', 'lato'],
];

export const RESUME_STYLES = [['all', 'All resumes'], ['modern', 'Modern'], ['classic', 'Classic'], ['simple', 'Simple'], ['creative', 'Creative'], ['ats', 'ATS-friendly'], ['letter', 'Cover letter']];

const RESUMES = LOOKS.map(([layout, style, name, [acc, dark, soft], hf, bf], i) => ({
  id: `resume-${i + 1}`, name, cat: 'resume', style, size: A4, more: true,
  items: LAYOUTS[layout](PEOPLE[(i * 3) % PEOPLE.length], { acc, dark, soft, ink: '#374151', mute: '#6b7280', hf, bf }),
}));

// A resume with headings and hints only, for "Start a blank resume".
const RESUME_BLANK = {
  id: 'resume-blank', name: 'Blank resume', cat: 'resume', style: 'simple', size: A4, more: true,
  items: [
    T('YOUR NAME', 50, 50, 28, { bold: true, color: '#111827', font: 'montserrat' }),
    T('Job title', 50, 88, 13, { color: '#2563eb', font: 'montserrat' }),
    T('Phone   |   Email   |   City, Country   |   LinkedIn or website', 50, 112, 9.5, { color: '#6b7280' }),
    L(50, 136, 545, 136, { color: '#111827', w: 1.2 }),
    T('PROFILE', 50, 156, 11, { bold: true, color: '#111827', font: 'montserrat' }),
    T('Two or three sentences about who you are, what you are good at\nand the job you are looking for.', 50, 178, 10, { color: '#9ca3af' }),
    T('EXPERIENCE', 50, 236, 11, { bold: true, color: '#111827', font: 'montserrat' }),
    T('Job title, Company, City', 50, 258, 11, { bold: true, color: '#374151' }), RT('Year - Year', 545, 259, 9.5, { color: '#6b7280' }),
    T('-  What you did and what changed because of it, with numbers.\n-  Another achievement.', 50, 276, 10, { color: '#9ca3af' }),
    T('Job title, Company, City', 50, 322, 11, { bold: true, color: '#374151' }), RT('Year - Year', 545, 323, 9.5, { color: '#6b7280' }),
    T('-  What you did and what changed because of it, with numbers.\n-  Another achievement.', 50, 340, 10, { color: '#9ca3af' }),
    T('EDUCATION', 50, 396, 11, { bold: true, color: '#111827', font: 'montserrat' }),
    T('Degree, School or university', 50, 418, 11, { bold: true, color: '#374151' }), RT('Year', 545, 419, 9.5, { color: '#6b7280' }),
    T('SKILLS', 50, 462, 11, { bold: true, color: '#111827', font: 'montserrat' }),
    T('Skill one   ·   Skill two   ·   Skill three   ·   Skill four', 50, 484, 10, { color: '#9ca3af' }),
    T('LANGUAGES', 50, 524, 11, { bold: true, color: '#111827', font: 'montserrat' }),
    T('Language (level)   ·   Language (level)', 50, 546, 10, { color: '#9ca3af' }),
  ],
};

export const TEMPLATE_CATS = [['all', 'All'], ['resume', 'Resume & letters'], ['business', 'Business'], ['certificate', 'Certificates'], ['marketing', 'Flyers & posters'], ['planning', 'Planning'], ['personal', 'Cards & personal']];

export const TEMPLATES = [
  // ------------------------------------------------------------- resumes --
  {
    id: 'resume-modern', name: 'Modern resume', cat: 'resume', style: 'modern', size: A4,
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
    id: 'resume-classic', name: 'Classic resume', cat: 'resume', style: 'classic', size: A4,
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
    id: 'cover-letter', name: 'Cover letter', cat: 'resume', style: 'letter', size: A4,
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
        table({
          x: 50, y: 250, w: 495, headFill: blue, zebra: '#f8fafc',
          cols: [[0.56, 'left'], [0.12, 'center'], [0.16, 'right'], [0.16, 'right']],
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
        table({
          x: 50, y: 244, w: 495, headFill: '#14532d', line: '#d1fae5',
          cols: [[0.52, 'left'], [0.14, 'center'], [0.17, 'right'], [0.17, 'right']],
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
      table({
        x: 50, y: 190, w: 495, headFill: '#1f2937', rowH: 34, size: 10,
        cols: [[0.16, 'left'], [0.62, 'left'], [0.22, 'left']],
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
  ...RESUMES,
  RESUME_BLANK,
];
