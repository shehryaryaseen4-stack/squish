'use strict';

// Offline licences for the Windows app.
//
// A buyer gets a short key to type (GYM-7K2M-9QXF-4HTP). The first time the
// app starts it activates the key online and receives a token signed with the
// platform's private key. After that the app checks the signature offline on
// every start, and asks the platform now and then whether the key was revoked.

const crypto = require('node:crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to misread
const b64 = (buf) => Buffer.from(buf).toString('base64url');

function newKey() {
  const bytes = crypto.randomBytes(16);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `GYM-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}`;
}

const normalKey = (k) => String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^GYM/, '');

function makeKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

function signToken(privateKeyPem, payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.sign(null, Buffer.from(body), privateKeyPem);
  return `${body}.${b64(sig)}`;
}

function verifyToken(publicKeyPem, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  try {
    if (!crypto.verify(null, Buffer.from(body), publicKeyPem, Buffer.from(sig, 'base64url'))) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = { newKey, normalKey, makeKeyPair, signToken, verifyToken };
