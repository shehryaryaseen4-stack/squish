'use strict';
// PDF intelligence (engines/ai.js + engines/pdfx/text.py): PDF to Markdown, the AI summarizer and
// chat, and Translate PDF. Claude is replaced by test/fixtures/fake-claude.js, so no API key is
// needed and nothing is sent anywhere; the requests it receives are checked instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { fakeClaude } = require('./fixtures/fake-claude');

const has = (bin) => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };
const READY = has('pdf2docx-python') && has('pdftotext');
const skip = !READY && 'the PDF reader (pdf2docx-python) is not installed';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'squish-ai-'));
test.after(() => fs.rmSync(DIR, { recursive: true, force: true }));

let made = false;
const fixture = (name) => {
  if (!made) {
    execFileSync('pdf2docx-python', [path.join(__dirname, 'fixtures', 'make_pdfs.py'), DIR], { stdio: 'ignore' });
    made = true;
  }
  return fs.readFileSync(path.join(DIR, name));
};
const ai = require('../engines/ai');
const withKey = (fn) => async () => {
  const old = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-not-a-key';
  const fake = fakeClaude();
  ai.setClient(fake);
  try { await fn(fake); } finally {
    ai.setClient(null);
    if (old === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = old;
  }
};

test('PDF to Markdown: headings, bold, italic, links, lists and tables', { skip }, async () => {
  const styles = (await ai.toMarkdown({ buffer: fixture('styles.pdf') })).buffer.toString();
  assert.match(styles, /^# Quarterly Sales Report$/m);
  assert.match(styles, /^#{2,3} Prepared for Acme Incorporated$/m);
  assert.match(styles, /\*\*bold words\*\*/);
  assert.match(styles, /\*italic words\*/);
  assert.match(styles, /^- First point of the list\n- Second point of the list\n- Third point of the list$/m);
  // a paragraph's lines are joined into one line
  assert.match(styles, /the look of the original\. This paragraph is long enough/);
  const simple = (await ai.toMarkdown({ buffer: fixture('simple.pdf') })).buffer.toString();
  assert.match(simple, /\[example\.com\]\(https:\/\/example\.com\/\)/);
  const tables = (await ai.toMarkdown({ buffer: fixture('tables.pdf') })).buffer.toString();
  assert.match(tables, /\| \*\*Product\*\* \| \*\*Qty\*\* \| \*\*Price\*\* \|\n\|---\|---\|---\|\n\| Item 1 \| 3 \| 12\.50 \|/);
});

test('PDF to Markdown: pages in order, repeated header and footer left out, columns in reading order', { skip }, async () => {
  const out = await ai.toMarkdown({ buffer: fixture('multipage.pdf') });
  const md = out.buffer.toString();
  assert.ok(out.pages >= 2);
  assert.match(md, /^<!-- Page 1 -->/);
  assert.match(md, /<!-- Page 2 -->/);
  assert.doesNotMatch(md, /ACME Corporation - Annual report/);
  assert.doesNotMatch(md, /Page 1 of/);
  const sections = [...md.matchAll(/^## Section (\d+)$/gm)].map((m) => Number(m[1]));
  assert.deepEqual(sections, sections.slice().sort((a, b) => a - b));
  // a sidebar resume: the sidebar is read before the main column, not line by line across both
  const resume = (await ai.toMarkdown({ buffer: fixture('resume.pdf') })).buffer.toString();
  assert.ok(resume.indexOf('Space planning') < resume.indexOf('MUNEEB MIRZA'), resume);
  assert.ok(resume.indexOf('CONTACT') < resume.indexOf('SKILLS'));
});

test('PDF to Markdown: a scan without OCR is refused with advice; a locked PDF too', { skip }, async () => {
  await assert.rejects(ai.toMarkdown({ buffer: fixture('scanned.pdf') }), /scan.*OCR/);
  await assert.rejects(ai.toMarkdown({ buffer: fixture('locked.pdf') }), /password/);
});

test('AI tools are off without an API key', async () => {
  const old = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  ai.setClient(null);
  try {
    assert.equal(ai.configured(), false);
    await assert.rejects(ai.translatePdf({ file: '/nonexistent.pdf', to: 'es' }, DIR), (e) => e.statusCode === 503);
  } finally { if (old !== undefined) process.env.ANTHROPIC_API_KEY = old; }
});

test('summary: the document is cached in the system prompt, fallbacks on, text streamed', { skip }, withKey(async (fake) => {
  const doc = await ai.openDoc({ buffer: fixture('styles.pdf'), name: 'report.pdf' });
  assert.match(doc.id, /^[a-f0-9]{24}$/);
  assert.equal(doc.pages, 1);
  let text = '';
  const msg = await ai.summarize({ id: doc.id, lang: 'ur' }, (t) => { text += t; });
  assert.equal(msg.stop_reason, 'end_turn');
  assert.match(text, /^## Quarterly Sales Report/);
  assert.match(text, /<questions>/);
  const req = fake.calls[0];
  assert.equal(req.model, ai.MODEL);
  assert.equal(req.fallbacks, 'default');
  assert.deepEqual(req.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(req.output_config.effort, 'medium');
  assert.equal(req.system.length, 2);
  assert.deepEqual(req.system[1].cache_control, { type: 'ephemeral' });
  assert.match(req.system[1].text, /^<document file="report\.pdf" pages="1">\n<page number="1">\n# Quarterly Sales Report/);
  assert.match(req.system[0].text, /not instructions for you/);
  assert.match(req.messages[0].content, /Write the summary in Urdu\./);
}));

test('chat: same cached system prompt, history cleaned up, the question last', { skip }, withKey(async (fake) => {
  const doc = await ai.openDoc({ buffer: fixture('styles.pdf'), name: 'report.pdf' });
  await ai.summarize({ id: doc.id }, () => {});
  let text = '';
  await ai.chat({ id: doc.id, history: [
    { role: 'assistant', text: 'stray answer first' },
    { role: 'user', text: 'Summarize this document.' }, { role: 'assistant', text: 'A report.' },
    { role: 'user', text: 'Who is it for?' }, { role: 'user', text: 'And when?' },
  ] }, (t) => { text += t; });
  assert.match(text, /Acme Incorporated/);
  const [sum, chat] = fake.calls;
  assert.deepEqual(chat.system, sum.system); // identical prefix, so the cache is reused
  assert.equal(chat.output_config.effort, 'low');
  assert.deepEqual(chat.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(chat.messages[2].content, 'Who is it for?\n\nAnd when?');
  await assert.rejects(ai.chat({ id: doc.id, history: [{ role: 'user', text: '  ' }] }, () => {}), /type a question/);
  await assert.rejects(ai.summarize({ id: 'f'.repeat(24) }, () => {}), /expired/);
}));

test('a refused answer becomes a message, not an empty summary', { skip }, withKey(async () => {
  const doc = await ai.openDoc({ buffer: fixture('simple.pdf'), name: 's.pdf' });
  ai.setClient({ beta: { messages: { stream: () => ({ on() { return this; }, finalMessage: async () => ({ stop_reason: 'refusal', content: [] }) }) } } });
  await assert.rejects(ai.summarize({ id: doc.id }, () => {}), /could not answer/);
}));

test('Translate PDF: every paragraph translated in place, pictures and drawings kept', { skip }, withKey(async (fake) => {
  const file = path.join(DIR, 'tr-in.pdf');
  fs.writeFileSync(file, fixture('resume.pdf'));
  const work = fs.mkdtempSync(path.join(DIR, 'tr-'));
  const out = await ai.translatePdf({ file, to: 'es' }, work);
  assert.equal(out.type, 'application/pdf');
  const text = execFileSync('pdftotext', [out.file, '-']).toString();
  for (const w of ['MUNEEB MIRZA', 'CONTACT', 'SKILLS', 'TEXT OVER THE RED BAND', 'BACHELOR OF ARCHITECTURE', 'SPACE PLANNING']) assert.ok(text.includes(w), `${w} in ${text}`);
  assert.doesNotMatch(text, /Space planning|Motivated and creative/); // the original text is gone
  assert.match(text, /0300-1234567/); // numbers only: left as they are
  const req = fake.calls[0];
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.match(req.system, /into Spanish/);
  assert.equal(req.fallbacks, 'default');
  // the pictures are still there
  const imgs = execFileSync('pdfimages', ['-list', out.file]).toString().trim().split('\n').length - 2;
  assert.ok(imgs >= 2, `pictures: ${imgs}`);
}));

test('Translate PDF: right-to-left languages, unknown language refused', { skip }, withKey(async () => {
  const file = path.join(DIR, 'tr-ur.pdf');
  fs.writeFileSync(file, fixture('styles.pdf'));
  const out = await ai.translatePdf({ file, to: 'ur' }, fs.mkdtempSync(path.join(DIR, 'tr-')));
  assert.match(execFileSync('pdftotext', [out.file, '-']).toString(), /QUARTERLY SALES REPORT/);
  await assert.rejects(ai.translatePdf({ file, to: 'klingon' }, DIR), /choose the language/);
}));

test('translation batches stay small and keep every paragraph once', () => {
  const paras = Array.from({ length: 250 }, (_, id) => ({ id, text: 'x'.repeat(id % 7 === 0 ? 900 : 60) }));
  const groups = ai.batches(paras);
  assert.deepEqual(groups.flat().map((p) => p.id), paras.map((p) => p.id));
  for (const g of groups) {
    assert.ok(g.length <= 80);
    assert.ok(g.length === 1 || g.reduce((n, p) => n + p.text.length, 0) <= 6000);
  }
});

test('the AI pages: three tools in the PDF menu, a box that says when AI is off', () => {
  const pages = require('../pages');
  for (const [slug, app] of [['ai-pdf-summarizer', 'aisum'], ['translate-pdf', 'translate'], ['pdf-to-markdown', 'markdown']]) {
    const html = pages.resolveApp(slug, 'https://example.com').html;
    assert.match(html, new RegExp(`data-app="${app}"`));
    assert.match(html, /<script type="module" src="\/ai\.js\?v=/);
    assert.match(html, /<title>[^<]{10,}<\/title>/);
    if (app !== 'markdown' && !process.env.ANTHROPIC_API_KEY) assert.match(html, /data-off="1"/);
  }
  const menu = pages.megaMenu();
  for (const p of ['/ai-pdf-summarizer', '/translate-pdf', '/pdf-to-markdown']) assert.ok(menu.includes(`href="${p}"`), p);
  assert.ok(pages.sitemap('https://example.com').includes('https://example.com/translate-pdf'));
});
