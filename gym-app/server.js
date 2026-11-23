'use strict';

// One gym on one server: the Windows app and a gym's own server use this.
// The multi-gym platform (sign-ups, billing, many gyms) is lib/platform.

const http = require('node:http');
const path = require('node:path');
const { createStore } = require('./lib/store');
const { createApi } = require('./lib/api');
const { gymHandler, corsFor } = require('./lib/web');

function createServer(options = {}) {
  const store = createStore({
    file: options.dataFile,
    seed: options.seed || 'demo',
    ownerPin: options.ownerPin || '1234',
    staffPin: options.staffPin || '0000',
    business: options.business,
    now: options.now,
  });
  const api = createApi(store, { now: options.now });
  const cors = corsFor(options.corsOrigins);
  const serve = gymHandler({ store, api, gate: options.gate });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (cors(req, res, url.pathname)) return;
    serve(req, res, url, url.pathname);
  });
  server.store = store;
  server.api = api;
  // WhatsApp reminders go out on their own, checked every 10 minutes.
  if (options.reminders !== false) {
    const run = () => api.reminders.tick().catch((err) => console.error('Reminders:', err.message));
    setTimeout(run, 20000).unref();
    setInterval(run, 10 * 60 * 1000).unref();
  }
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3100;
  const dataDir = path.join(__dirname, 'data');
  if (process.env.PLATFORM === '1') {
    const { createPlatform } = require('./lib/platform');
    createPlatform({ dataDir: process.env.DATA_DIR || dataDir, corsOrigins: process.env.CORS_ORIGINS })
      .listen(port, () => console.log(`Gym platform on http://localhost:${port}  (owner panel: /owner)`));
  } else {
    const server = createServer({
      dataFile: process.env.DATA_FILE || path.join(dataDir, 'db.json'),
      seed: process.env.SEED,
      ownerPin: process.env.OWNER_PIN,
      staffPin: process.env.STAFF_PIN,
      corsOrigins: process.env.CORS_ORIGINS,
    });
    server.listen(port, () => {
      console.log(`Gym app on http://localhost:${port}  (dashboard: /admin, front-desk kiosk: /kiosk)`);
      const ips = Object.values(require('os').networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.')).map((n) => n.address);
      for (const ip of ips) console.log(`  Phones and machines on this WiFi: ${ip}  port ${port}`);
      console.log('  Calls from other devices (phones, the fingerprint/face machine) are listed below.');
    });
    // Every device that reaches this computer, once a minute per address and page:
    // shows at a glance whether the machine's calls arrive at all.
    const seen = new Map();
    server.on('request', (req) => {
      const ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
      if (ip === '127.0.0.1' || ip === '::1') return;
      const key = `${ip} ${req.method} ${String(req.url).split('?')[0]}`;
      const t = Date.now();
      if (t - (seen.get(key) || 0) < 60000) return;
      seen.set(key, t);
      if (seen.size > 500) seen.clear();
      console.log(`${new Date().toLocaleTimeString('en-GB')}  ${ip}  ${req.method} ${String(req.url).slice(0, 140)}`);
    });
  }
}

module.exports = { createServer };
