const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folioDesktop', {
  platform: process.platform,
  openDownload:url=>ipcRenderer.invoke('folio:open-download',url),
  setLanguage: language => ipcRenderer.invoke('folio:language', language),
  windowCommand: command => ipcRenderer.invoke('folio:window-command', command),
  editCommand: command => ipcRenderer.invoke('folio:edit-command', command),
  setTheme: theme => ipcRenderer.invoke('folio:theme', theme),
  keyStatus: baseUrl => ipcRenderer.invoke('folio:key-status', {baseUrl}),
  saveKey: (key, remember, baseUrl) => ipcRenderer.invoke('folio:key-save', { key, remember, baseUrl }),
  importKey: (remember, baseUrl) => ipcRenderer.invoke('folio:key-import', { remember, baseUrl }),
  forgetKey: baseUrl => ipcRenderer.invoke('folio:key-forget', {baseUrl}),
  listModels: config => ipcRenderer.invoke('folio:models', config),
  requestAI: data => ipcRenderer.invoke('folio:ai-request', data),
  cancelAI: id => ipcRenderer.invoke('folio:ai-cancel', id),
  onCommand(callback) {
    ipcRenderer.on('folio:command', (_event, command) => callback(command));
  },
  onWindowState(callback) {
    ipcRenderer.on('folio:window-state', (_event, state) => callback(state));
  },
});
