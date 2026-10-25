// Reading members from a spreadsheet: Excel (.xlsx), CSV, or rows pasted from Excel.
// No library: an .xlsx file is a zip of XML files, unzipped with the browser's
// own DecompressionStream.
(function (root) {
  // ---- CSV / pasted rows ----------------------------------------------------------

  function parseCsv(text) {
    text = String(text || '').replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/)[0] || '';
    const count = (ch) => firstLine.split(ch).length - 1;
    const delim = [['\t', count('\t')], [';', count(';')], [',', count(',')]].sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
      } else if (c === '"' && cell === '') quoted = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ''));
  }

  // ---- Excel .xlsx ------------------------------------------------------------------

  async function inflate(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }

  // The files inside the zip, from its central directory.
  async function unzip(buf) {
    const b = new Uint8Array(buf);
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This is not an Excel (.xlsx) file');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const size = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extra = dv.getUint16(p + 30, true);
      const comment = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      files[name] = { method, data: b.subarray(start, start + size) };
      p += 46 + nameLen + extra + comment;
    }
    return {
      async text(name) {
        const f = files[name];
        if (!f) return null;
        return dec.decode(f.method === 8 ? await inflate(f.data) : f.data);
      },
      names: Object.keys(files),
    };
  }

  const xmlText = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

  /** The first sheet of an .xlsx file as rows of cells (numbers stay numbers, so dates can be read). */
  async function readXlsx(buf) {
    const zip = await unzip(buf);
    const shared = [];
    const ss = await zip.text('xl/sharedStrings.xml');
    if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(xmlText(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '')));
    const sheetName = zip.names.filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort((a, z) => Number(a.match(/\d+/)[0]) - Number(z.match(/\d+/)[0]))[0];
    const xml = await zip.text(sheetName || 'xl/worksheets/sheet1.xml');
    if (!xml) throw new Error('The Excel file has no sheet');
    const rows = [];
    for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
        const type = attrs.match(/t="(\w+)"/)?.[1];
        const inner = c[2] || '';
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let value = '';
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = xmlText(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] || '');
        else if (type === 'str' || type === 'e') value = v != null ? xmlText(v) : '';
        else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else if (v != null) value = Number(v);
        const at = ref ? colIndex(ref) : row.length;
        while (row.length < at) row.push('');
        row[at] = typeof value === 'string' ? value.trim() : value;
      }
      if (row.some((x) => x !== '' && x != null)) rows.push(row);
    }
    return rows;
  }

  // ---- understanding the columns ----------------------------------------------------

  const FIELDS = [
    ['memberNo', 'Member no / machine ID', /^(member\s*(no|number|id|#)|id|card\s*(no|number)?|reg(istration)?\s*(no|#)?|machine\s*id|roll\s*no|s\.?\s*no)$/i],
    ['name', 'Name', /^(full\s*)?name$|^member(\s*name)?$|naam|^client$|^customer$/i],
    ['phone', 'Phone', /phone|mobile|cell|contact|whats\s*app|number|^no$/i],
    ['gender', 'Gender', /gender|sex|male|female/i],
    ['joinDate', 'Join date', /join|admission|start(ed)?\s*(date|on)?$|member\s*since|registered/i],
    ['plan', 'Plan', /plan|package|membership|type|duration|months/i],
    ['amount', 'Fee paid', /^(?!.*total).*(fee|amount|paid|payment$|price|\brs\b|pkr)/i],
    ['paidOn', 'Paid on', /paid\s*(on|date)|payment\s*date|fee\s*date|last\s*(fee|payment|paid)|date\s*paid|receipt\s*date/i],
    ['validTill', 'Valid till', /valid|expir|\bend(s|ing)?\b|end\s*date|due\s*date|renew|till|until|next\s*(fee|due|payment)/i],
    ['due', 'Still to pay', /balance|due$|dues|remaining|pending|baqi/i],
    ['dob', 'Date of birth', /birth|dob|b\.?day/i],
    ['address', 'Address', /address|area|city|location/i],
    ['emergencyPhone', 'Emergency phone', /emergency|guardian|father|parent/i],
    ['notes', 'Notes', /note|remark|comment|detail/i],
  ];

  // Which column holds which field, from the header names (more specific fields win).
  function guessColumns(header) {
    const map = {};
    const taken = new Set();
    const order = ['paidOn', 'validTill', 'due', 'dob', 'emergencyPhone', 'memberNo', 'joinDate', 'name', 'phone', 'gender', 'plan', 'amount', 'address', 'notes'];
    for (const key of order) {
      const re = FIELDS.find((f) => f[0] === key)[2];
      const i = header.findIndex((h, idx) => !taken.has(idx) && re.test(String(h).trim()));
      if (i >= 0) { map[key] = i; taken.add(i); }
    }
    return map;
  }

  // ---- dates ------------------------------------------------------------------------------

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, '0');
  const valid = (y, m, d) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
  };

  /** Any date people type (31/12/2026, 12-31-2026, 2026-12-31, 31 Dec 2026) or an Excel date number → "2026-12-31". */
  function toIsoDate(v, dayFirst = true) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
      const n = Math.floor(Number(v));
      if (n < 1000 || n > 80000) return null;
      return new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10);
    }
    const s = String(v).trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ');
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/);
    if (m) {
      let [a, b] = [+m[1], +m[2]];
      let y = +m[3];
      if (y < 100) y += 2000;
      if (a > 12) dayFirst = true;
      else if (b > 12) dayFirst = false;
      return dayFirst ? valid(y, b, a) : valid(y, a, b);
    }
    m = s.match(/^(\d{1,2})[- ]([a-z]{3,9})[- ](\d{2,4})/);
    if (m && MONTHS[m[2].slice(0, 3)]) return valid(+m[3] < 100 ? +m[3] + 2000 : +m[3], MONTHS[m[2].slice(0, 3)], +m[1]);
    m = s.match(/^([a-z]{3,9})[- ](\d{1,2})[- ](\d{2,4})/);
    if (m && MONTHS[m[1].slice(0, 3)]) return valid(+m[3] < 100 ? +m[3] + 2000 : +m[3], MONTHS[m[1].slice(0, 3)], +m[2]);
    return null;
  }

  // Do the dates in these columns put the day first (Pakistan, UK) or the month first (US)?
  function guessDayFirst(rows, cols) {
    let dayFirst = 0;
    let monthFirst = 0;
    for (const r of rows) for (const c of cols) {
      const m = String(r[c] ?? '').match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
      if (!m) continue;
      if (+m[1] > 12) dayFirst++;
      if (+m[2] > 12) monthFirst++;
    }
    return monthFirst <= dayFirst;
  }

  const api = { parseCsv, readXlsx, guessColumns, toIsoDate, guessDayFirst, FIELDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sheet = api;
})(typeof window !== 'undefined' ? window : globalThis);
