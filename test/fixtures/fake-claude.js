'use strict';
// A stand-in for the Anthropic client (engines/ai.js setClient), for tests and for trying the AI
// pages without an API key: it streams a canned summary, answers and "translations" (upper case).
// Records each request in calls.

function fakeClaude({ delay = 0 } = {}) {
  const calls = [];
  const reply = (p) => {
    if (p.output_config && p.output_config.format) {
      const items = JSON.parse(p.messages[0].content);
      return JSON.stringify({ t: items.map(({ i, s }) => ({ i, s: s.toUpperCase() })) });
    }
    const last = p.messages[p.messages.length - 1].content;
    if (/Summarize this document/.test(last)) {
      return '## Quarterly Sales Report - Acme Incorporated\n\nA short report prepared for Acme Incorporated (p. 1).\n\n'
        + '**Key points**\n- Sales rose **12%** in the quarter (p. 1)\n  - Mostly from new customers\n- Three points are listed:\n  1. First point\n  2. Second point\n\n'
        + '<questions>\nWho is the report for?\nWhat are the three points?\nWhat colour is the large line?';
    }
    return `You asked: "${last}". The document says it was prepared for **Acme Incorporated** (p. 1).`;
  };
  const stream = (p) => {
    calls.push(p);
    const text = reply(p);
    const handlers = [];
    const done = (async () => {
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < text.length; i += 12) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        handlers.forEach((h) => h(text.slice(i, i + 12)));
      }
      return { model: p.model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: {} };
    })();
    return { on(ev, h) { if (ev === 'text') handlers.push(h); return this; }, finalMessage: () => done };
  };
  return { calls, beta: { messages: { stream } } };
}

module.exports = { fakeClaude };
