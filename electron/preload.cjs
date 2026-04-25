const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('axonDesktop', {
  getRuntimeInfo: () => ipcRenderer.invoke('axon:runtime-info'),
  openExternal: (url) => ipcRenderer.invoke('axon:open-external', url),
});
