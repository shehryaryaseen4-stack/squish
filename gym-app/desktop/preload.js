'use strict';

// What the dashboard and the first-start screen can ask the desktop app to do.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gymDesktop', {
  openEntryScreen: () => ipcRenderer.invoke('entry-screen'),
  openKiosk: () => ipcRenderer.invoke('kiosk'),
  connectionInfo: () => ipcRenderer.invoke('connection-info'),
  setup: {
    info: () => ipcRenderer.invoke('setup:info'),
    online: (address) => ipcRenderer.invoke('setup:online', address),
    activate: (key, server) => ipcRenderer.invoke('setup:activate', { key, server }),
    gym: (details) => ipcRenderer.invoke('setup:gym', details),
    demo: () => ipcRenderer.invoke('setup:demo'),
    relaunch: () => ipcRenderer.invoke('setup:relaunch'),
  },
});
