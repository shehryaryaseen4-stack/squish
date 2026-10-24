'use strict';

// Paddle Billing webhooks. Paddle signs each notification:
//   Paddle-Signature: ts=1671552777;h1=<hex HMAC-SHA256 of "ts:body" with the endpoint secret>
// https://developer.paddle.com/webhooks/signature-verification

const crypto = require('node:crypto');

function verifySignature(rawBody, header, secret, { now = Date.now(), toleranceSec = 300 } = {}) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(';').map((p) => p.split('=')).filter((p) => p.length === 2));
  const ts = Number(parts.ts);
  if (!ts || !parts.h1) return false;
  if (Math.abs(now / 1000 - ts) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.ts}:${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(parts.h1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// For tests and for trying the flow without Paddle.
function signFor(rawBody, secret, ts = Math.floor(Date.now() / 1000)) {
  return `ts=${ts};h1=${crypto.createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex')}`;
}

module.exports = { verifySignature, signFor };
