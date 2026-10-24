'use strict';

// What the dashboard can ask the desktop app to do.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gymDesktop', {
  openEntryScreen: () => ipcRenderer.invoke('entry-screen'),
  openKiosk: () => ipcRenderer.invoke('kiosk'),
  connectionInfo: () => ipcRenderer.invoke('connection-info'),
});
