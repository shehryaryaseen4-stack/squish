'use strict';

// Windows app for a gym's front desk computer. It works three ways, chosen on
// first start:
//   online  – opens the gym's account on the website (no server here)
//   licence – runs the gym server on this computer after a licence key is
//             activated (phones on the gym Wi-Fi and the fingerprint machine
//             connect to this computer)
//   demo    – a gym full of sample data to look around
// In every mode it can put the entry screen on a second monitor.

const { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER_DIR = app.isPackaged ? path.join(process.resourcesPath, 'server') : path.join(__dirname, '..');
const PORTS = [3100, 3101, 3102, 3103, 3104];
const CHECK_EVERY = 3 * 24 * 60 * 60 * 1000;

let config = {};
try { config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch { /* defaults */ }

let base = '';
let port = 0;
let mainWin = null;
let entryWin = null;
let kioskWin = null;
let setupWin = null;

const userFile = (...p) => path.join(app.getPath('userData'), ...p);
const settingsFile = () => userFile('desktop.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; }
}
function saveSettings(patch) {
  const next = { ...readSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  return next;
}

// The same computer always gets the same id, so a licence counts it once.
function deviceId() {
  const macs = Object.values(os.networkInterfaces()).flat().filter((a) => a && !a.internal && a.mac && a.mac !== '00:00:00:00:00:00').map((a) => a.mac).sort();
  return crypto.createHash('sha256').update([os.hostname(), os.cpus()[0]?.model || '', macs[0] || ''].join('|')).digest('hex').slice(0, 32);
}

function verifyLicence(lic) {
  if (!lic?.token) return null;
  const { verifyToken } = require(path.join(SERVER_DIR, 'lib', 'platform', 'license.js'));
  const payload = verifyToken(config.publicKey || lic.publicKey, lic.token);
  return payload && payload.device === deviceId() ? payload : null;
}

// ---- the gym server on this computer ---------------------------------------------

function startServer({ dir, seed, ownerPin, business, fresh }) {
  const { createServer } = require(path.join(SERVER_DIR, 'server.js'));
  const dataFile = userFile(dir, 'db.json');
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const server = createServer({ dataFile, seed, ownerPin, staffPin: seed === 'demo' ? '0000' : null, business });
  if (fresh) {
    const { cleanStart } = require(path.join(SERVER_DIR, 'lib', 'platform', 'countries.js'));
    cleanStart(server.store.db, fresh.country, fresh.monthlyFee);
    server.store.save();
  }
  return new Promise((resolve, reject) => {
    const tryPort = (i) => {
      if (i >= PORTS.length) return reject(new Error(`Ports ${PORTS.join(', ')} are all in use.`));
      server.once('error', (err) => (err.code === 'EADDRINUSE' ? tryPort(i + 1) : reject(err)));
      // All network cards, so phones and machines on the gym Wi-Fi can reach it.
      server.listen(PORTS[i], '0.0.0.0', () => resolve(PORTS[i]));
    };
    tryPort(0);
  });
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

// ---- windows -----------------------------------------------------------------------

function windowFor(url, opts = {}) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 500,
    backgroundColor: '#0c0c11',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    ...opts,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  // Links to other websites (and the billing page) open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(base)) shell.openExternal(target);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, target) => {
    if (!target.startsWith(base)) { e.preventDefault(); shell.openExternal(target); }
  });
  win.loadURL(base + url);
  return win;
}

// The monitor the dashboard is not on, so the entry screen goes to the TV.
function otherDisplay() {
  const all = screen.getAllDisplays();
  const here = mainWin && !mainWin.isDestroyed() ? screen.getDisplayMatching(mainWin.getBounds()) : screen.getPrimaryDisplay();
  return all.find((d) => d.id !== here.id) || null;
}

function placeOn(win, display) {
  if (win.isFullScreen()) win.setFullScreen(false);
  const { x, y, width, height } = display.workArea;
  win.setBounds({ x, y, width: Math.min(1280, width), height: Math.min(800, height) });
  win.setFullScreen(true);
}

function openEntryScreen({ quiet = false } = {}) {
  if (!base) return { ok: false };
  const target = otherDisplay();
  if (entryWin && !entryWin.isDestroyed()) {
    if (target) placeOn(entryWin, target);
    entryWin.show();
    return { ok: true, secondScreen: !!target };
  }
  entryWin = windowFor('/display', { title: 'Entry screen', show: false });
  entryWin.once('ready-to-show', () => {
    if (target) placeOn(entryWin, target);
    entryWin.show();
  });
  // Esc leaves full screen, F11 goes back, like a browser.
  entryWin.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'Escape' && entryWin.isFullScreen()) entryWin.setFullScreen(false);
    if (input.key === 'F11') entryWin.setFullScreen(!entryWin.isFullScreen());
  });
  entryWin.on('closed', () => {
    entryWin = null;
    if (!app.isQuitting) saveSettings({ entryScreen: false });
  });
  saveSettings({ entryScreen: true });
  if (!target && !quiet) {
    dialog.showMessageBox(mainWin, {
      type: 'info',
      title: 'Entry screen',
      message: 'Only one monitor is connected.',
      detail: 'Connect the wall monitor or TV with an HDMI cable, press Windows + P and choose "Extend". Then click "Entry screen on 2nd monitor" again and it will move there by itself.',
    });
  }
  return { ok: true, secondScreen: !!target };
}

function moveEntryScreen() {
  if (!entryWin || entryWin.isDestroyed()) return openEntryScreen();
  const all = screen.getAllDisplays();
  const now = screen.getDisplayMatching(entryWin.getBounds());
  const next = all[(all.findIndex((d) => d.id === now.id) + 1) % all.length];
  placeOn(entryWin, next);
}

function openKiosk() {
  if (!base) return;
  if (kioskWin && !kioskWin.isDestroyed()) return kioskWin.show();
  kioskWin = windowFor('/kiosk', { title: 'Check-in kiosk' });
  kioskWin.on('closed', () => { kioskWin = null; });
}

function showConnectionInfo() {
  const s = readSettings();
  if (s.mode === 'online') {
    const u = new URL(base);
    return dialog.showMessageBox(mainWin, {
      type: 'info',
      title: 'Phones and machines',
      message: 'Your gym is online',
      detail: `Member app: ${base}/\nStaff dashboard: ${base}/admin\n\n• Phones: open the member app link, or type it in the Android app.\n• Fingerprint/face machine: Server address = ${u.hostname}, Port = ${u.port || (u.protocol === 'https:' ? 443 : 80)}. Add the machine in Settings first.`,
    });
  }
  const ips = lanAddresses();
  const links = ips.length ? ips.map((ip) => `http://${ip}:${port}`).join('\n') : '(this computer is not on a network)';
  dialog.showMessageBox(mainWin, {
    type: 'info',
    title: 'Phones and machines',
    message: 'Connect phones and machines to this computer',
    detail: `Server address on the gym Wi-Fi:\n${links}\n\n`
      + '• Phones: open this address in Chrome, or type it in the app when it asks for the gym server.\n'
      + `• Fingerprint/face machine: Server IP = ${ips[0] || 'this computer'}, Port = ${port}.\n`
      + '• Keep this computer on and the app open while the gym is open.\n'
      + '• If Windows asks about the firewall, click "Allow access".',
  });
}

async function backup() {
  const s = readSettings();
  if (s.mode === 'online') return dialog.showMessageBox(mainWin, { type: 'info', message: 'Your gym is online', detail: 'Online gyms are backed up on the server. To keep your own copy, export members, fees and attendance to Excel from Reports.' });
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
    title: 'Back up gym data',
    defaultPath: path.join(app.getPath('documents'), `gym-backup-${stamp}`),
    buttonLabel: 'Save backup',
  });
  if (canceled || !filePath) return;
  fs.cpSync(userFile(s.mode === 'demo' ? 'demo' : 'data'), filePath, { recursive: true });
  dialog.showMessageBox(mainWin, { type: 'info', message: 'Backup saved', detail: filePath });
}

async function changeMode() {
  const { response } = await dialog.showMessageBox(mainWin, {
    type: 'question',
    buttons: ['Cancel', 'Change'],
    defaultId: 0,
    message: 'Use this computer a different way?',
    detail: 'You can switch between your online account, a Windows licence and the demo. Data saved on this computer stays here.',
  });
  if (response !== 1) return;
  saveSettings({ mode: null });
  app.relaunch();
  app.exit(0);
}

function buildMenu() {
  const s = readSettings();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Gym',
      submenu: [
        { label: 'Entry screen on 2nd monitor', accelerator: 'CmdOrCtrl+E', click: () => openEntryScreen(), enabled: !!base },
        { label: 'Move entry screen to next monitor', accelerator: 'CmdOrCtrl+Shift+E', click: moveEntryScreen, enabled: !!base },
        { label: 'Check-in kiosk', accelerator: 'CmdOrCtrl+K', click: openKiosk, enabled: !!base },
        { type: 'separator' },
        { label: 'Phones and machines…', click: showConnectionInfo, enabled: !!base },
        { label: 'Back up data…', click: backup, enabled: !!base },
        { label: 'Open data folder', click: () => shell.openPath(app.getPath('userData')), visible: s.mode !== 'online' },
        { label: s.mode === 'licence' ? `Licence ${s.licence?.key || ''}` : 'Use a different way…', click: changeMode },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ]));
}

function openMain() {
  buildMenu();
  mainWin = windowFor('/admin', { title: 'Gym manager', show: false });
  mainWin.once('ready-to-show', () => { mainWin.maximize(); mainWin.show(); });
  // Closing the dashboard closes the app, so the entry screen does not stay behind.
  mainWin.on('closed', () => { mainWin = null; if (!setupWin) app.quit(); });
  if (readSettings().entryScreen) mainWin.once('show', () => openEntryScreen({ quiet: true }));
  screen.on('display-added', () => {
    if (entryWin && !entryWin.isDestroyed()) setTimeout(() => { const t = otherDisplay(); if (t) placeOn(entryWin, t); }, 1500);
  });
}

// ---- first start: choose how to use this computer ------------------------------------------

function openSetup(note = '') {
  buildMenu();
  setupWin = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 420,
    minHeight: 560,
    backgroundColor: '#f6f6f9',
    autoHideMenuBar: true,
    title: 'Welcome',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  setupWin.loadFile(path.join(__dirname, 'setup.html'), { query: { note } });
  setupWin.on('closed', () => { setupWin = null; if (!mainWin) app.quit(); });
}

async function getJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The server answered ${res.status}`);
  return data;
}

// Turns "fit-zone", "yourdomain.com/g/fit-zone" or a full link into the gym's address.
function gymUrl(input) {
  let text = String(input || '').trim().replace(/\/(admin|display|kiosk)(\.html)?\/?$/, '').replace(/\/+$/, '');
  if (!text) throw new Error('Enter your gym’s address');
  if (/^[a-z0-9-]+$/i.test(text)) {
    if (!config.platformUrl) throw new Error('Enter the full address, for example https://yourdomain.com/g/your-gym');
    text = `${config.platformUrl.replace(/\/$/, '')}/g/${text.toLowerCase()}`;
  }
  if (!/^https?:\/\//.test(text)) text = `https://${text}`;
  return text;
}

ipcMain.handle('setup:info', () => {
  const { COUNTRIES } = require(path.join(SERVER_DIR, 'lib', 'platform', 'countries.js'));
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    platformUrl: config.platformUrl || '',
    productName: config.productName || 'Gym Manager',
    countries: COUNTRIES.map(({ code, name, currency, monthly }) => ({ code, name, currency, monthly })),
    country: (COUNTRIES.find((c) => c.timeZone === tz) || {}).code || 'OTHER',
    licence: readSettings().licence?.key || null,
  };
});

ipcMain.handle('setup:online', async (e, input) => {
  try {
    const url = gymUrl(input);
    const gym = await getJson(`${url}/api/gym`);
    saveSettings({ mode: 'online', online: { url }, entryScreen: false });
    return { ok: true, name: gym.business?.name };
  } catch (err) {
    return { ok: false, error: /fetch failed|ENOTFOUND|timeout/i.test(err.message) ? 'Could not reach that address. Check it and your internet.' : err.message };
  }
});

ipcMain.handle('setup:activate', async (e, { key, server }) => {
  try {
    const host = String(server || config.platformUrl || '').replace(/\/$/, '');
    if (!/^https?:\/\//.test(host)) throw new Error('Enter the website you bought the licence from, for example https://yourdomain.com');
    const r = await getJson(`${host}/api/license/activate`, { method: 'POST', body: JSON.stringify({ key, device: deviceId(), deviceName: os.hostname() }) });
    const licence = { key: String(key).toUpperCase().trim(), token: r.token, publicKey: config.publicKey || r.publicKey, server: host, checkedAt: Date.now() };
    if (!verifyLicence(licence)) throw new Error('The licence could not be checked. Contact the seller.');
    saveSettings({ licence });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: /fetch failed|ENOTFOUND|timeout/i.test(err.message) ? 'Could not reach the licence server. Check your internet.' : err.message };
  }
});

ipcMain.handle('setup:gym', async (e, details) => {
  try {
    if (!verifyLicence(readSettings().licence)) throw new Error('Activate the licence first');
    if (!/^\d{4,8}$/.test(String(details.ownerPin || ''))) throw new Error('The owner PIN must be 4 to 8 digits');
    if (!String(details.name || '').trim()) throw new Error('Enter the gym name');
    const { businessFor } = require(path.join(SERVER_DIR, 'lib', 'platform', 'countries.js'));
    const business = businessFor(details.country, { name: String(details.name).trim().slice(0, 60), email: details.email || '', phone: details.phone || '' });
    port = await startServer({ dir: 'data', seed: 'empty', ownerPin: String(details.ownerPin), business, fresh: { country: details.country, monthlyFee: details.monthlyFee } });
    base = `http://localhost:${port}`;
    saveSettings({ mode: 'licence', gymReady: true });
    setupWin?.close();
    openMain();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('setup:demo', async () => {
  saveSettings({ mode: 'demo', entryScreen: false });
  port = await startServer({ dir: 'demo', seed: 'demo' });
  base = `http://localhost:${port}`;
  setupWin?.close();
  openMain();
  return { ok: true };
});

ipcMain.handle('setup:relaunch', () => { app.relaunch(); app.exit(0); });

ipcMain.handle('entry-screen', () => openEntryScreen());
ipcMain.handle('kiosk', () => { openKiosk(); return { ok: true }; });
ipcMain.handle('connection-info', () => { showConnectionInfo(); return { ok: true }; });

// Ask the licence server now and then whether the key was switched off.
async function recheckLicence(lic) {
  if (!lic?.server || Date.now() - (lic.checkedAt || 0) < CHECK_EVERY) return;
  try {
    const r = await getJson(`${lic.server}/api/license/check`, { method: 'POST', body: JSON.stringify({ token: lic.token }) });
    if (r.status === 'revoked' || r.status === 'moved') {
      saveSettings({ licence: null, mode: null });
      dialog.showMessageBoxSync({ type: 'warning', message: 'This licence has been switched off', detail: 'Please contact the seller. Your gym data is still saved on this computer.' });
      app.relaunch();
      app.exit(0);
      return;
    }
    saveSettings({ licence: { ...lic, checkedAt: Date.now() } });
  } catch { /* offline: try again next time */ }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { const w = mainWin || setupWin; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.on('before-quit', () => { app.isQuitting = true; });
  app.on('window-all-closed', () => app.quit());

  app.whenReady().then(async () => {
    const s = readSettings();
    try {
      if (s.mode === 'online' && s.online?.url) {
        base = s.online.url;
        return openMain();
      }
      if (s.mode === 'licence') {
        if (!verifyLicence(s.licence)) return openSetup('licence');
        if (!s.gymReady) return openSetup('gym');
        port = await startServer({ dir: 'data', seed: 'empty' });
        base = `http://localhost:${port}`;
        openMain();
        return recheckLicence(s.licence);
      }
      if (s.mode === 'demo') {
        port = await startServer({ dir: 'demo', seed: 'demo' });
        base = `http://localhost:${port}`;
        return openMain();
      }
      openSetup();
    } catch (err) {
      dialog.showErrorBox('The gym app could not start', String(err.message || err));
      app.quit();
    }
  });
}
