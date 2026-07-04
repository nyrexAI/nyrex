// preload.js — runs in an isolated context with access to Node + the page.
// Exposes a small, explicit API to the renderer so the UI never gets raw
// Node/IPC access (standard Electron security practice).

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nyrex", {
  sendMessage: (messages, search) => ipcRenderer.invoke("chat:send", { messages, search }),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
});
