'use strict';

// Desktop app for the gym's front desk computer. It runs the gym server on
// this computer (phones on the same Wi-Fi and the fingerprint machine connect
// to it), opens the dashboard, and can put the entry screen on a second
// monitor such as a TV on the wall.

const { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER_DIR = app.isPackaged ? path.join(process.resourcesPath, 'server') : path.join(__dirname, '..');
const PORTS = [3100, 3101, 3102, 3103, 3104];

let base = '';
let port = 0;
let mainWin = null;
let entryWin = null;
let kioskWin = null;

const settingsFile = () => path.join(app.getPath('userData'), 'desktop.json');
const dataFile = () => path.join(app.getPath('userData'), 'data', 'db.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; }
}
function saveSettings(patch) {
  const next = { ...readSettings(), ...patch };
  try { fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2)); } catch { /* not important */ }
}

function startServer() {
  const { createServer } = require(path.join(SERVER_DIR, 'server.js'));
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  const server = createServer({ dataFile: dataFile() });
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
  // Links to other websites open in the normal browser.
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
  if (kioskWin && !kioskWin.isDestroyed()) return kioskWin.show();
  kioskWin = windowFor('/kiosk', { title: 'Check-in kiosk' });
  kioskWin.on('closed', () => { kioskWin = null; });
}

function showConnectionInfo() {
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
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
    title: 'Back up gym data',
    defaultPath: path.join(app.getPath('documents'), `gym-backup-${stamp}`),
    buttonLabel: 'Save backup',
  });
  if (canceled || !filePath) return;
  const src = path.dirname(dataFile());
  fs.cpSync(src, filePath, { recursive: true });
  dialog.showMessageBox(mainWin, { type: 'info', message: 'Backup saved', detail: filePath });
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Gym',
      submenu: [
        { label: 'Entry screen on 2nd monitor', accelerator: 'CmdOrCtrl+E', click: () => openEntryScreen() },
        { label: 'Move entry screen to next monitor', accelerator: 'CmdOrCtrl+Shift+E', click: moveEntryScreen },
        { label: 'Check-in kiosk', accelerator: 'CmdOrCtrl+K', click: openKiosk },
        { type: 'separator' },
        { label: 'Phones and machines…', click: showConnectionInfo },
        { label: 'Back up data…', click: backup },
        { label: 'Open data folder', click: () => shell.openPath(path.dirname(dataFile())) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ]));
}

ipcMain.handle('entry-screen', () => openEntryScreen());
ipcMain.handle('kiosk', () => { openKiosk(); return { ok: true }; });
ipcMain.handle('connection-info', () => { showConnectionInfo(); return { ok: true }; });

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
  app.on('before-quit', () => { app.isQuitting = true; });
  app.on('window-all-closed', () => app.quit());

  app.whenReady().then(async () => {
    try {
      port = await startServer();
    } catch (err) {
      dialog.showErrorBox('The gym server could not start', String(err.message || err));
      return app.quit();
    }
    base = `http://localhost:${port}`;
    buildMenu();
    mainWin = windowFor('/admin', { title: 'Gym manager', show: false });
    mainWin.once('ready-to-show', () => { mainWin.maximize(); mainWin.show(); });
    // Closing the dashboard closes the app, so the entry screen does not stay behind.
    mainWin.on('closed', () => { mainWin = null; app.quit(); });

    // Bring the entry screen back on the TV if it was open last time.
    if (readSettings().entryScreen) mainWin.once('show', () => openEntryScreen({ quiet: true }));
    // TV switched on or plugged in later: move the entry screen onto it.
    screen.on('display-added', () => {
      if (entryWin && !entryWin.isDestroyed()) setTimeout(() => { const t = otherDisplay(); if (t) placeOn(entryWin, t); }, 1500);
    });
  });
}
