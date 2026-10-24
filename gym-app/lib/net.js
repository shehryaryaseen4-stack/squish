'use strict';

// The visitor's address. Behind a reverse proxy (Caddy, nginx) every request
// comes from the proxy, so with TRUST_PROXY=1 the forwarded address is used;
// otherwise one person's wrong PINs would lock out every gym.
function clientIp(req) {
  if (typeof process !== 'undefined' && process.env.TRUST_PROXY === '1') {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return req.socket?.remoteAddress || 'local';
}

module.exports = { clientIp };
