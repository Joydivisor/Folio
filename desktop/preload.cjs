const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folioDesktop', {
  setLanguage: language => ipcRenderer.invoke('folio:language', language),
  windowCommand: command => ipcRenderer.invoke('folio:window-command', command),
  editCommand: command => ipcRenderer.invoke('folio:edit-command', command),
  setTheme: theme => ipcRenderer.invoke('folio:theme', theme),
  keyStatus: () => ipcRenderer.invoke('folio:key-status'),
  saveKey: (key, remember) => ipcRenderer.invoke('folio:key-save', { key, remember }),
  importKey: remember => ipcRenderer.invoke('folio:key-import', { remember }),
  forgetKey: () => ipcRenderer.invoke('folio:key-forget'),
  requestAI: data => ipcRenderer.invoke('folio:ai-request', data),
  cancelAI: id => ipcRenderer.invoke('folio:ai-cancel', id),
  onCommand(callback) {
    ipcRenderer.on('folio:command', (_event, command) => callback(command));
  },
  onWindowState(callback) {
    ipcRenderer.on('folio:window-state', (_event, state) => callback(state));
  },
});
