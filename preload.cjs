const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  isDesktop: true,
  saveFile: (opts) => ipcRenderer.invoke('file:save', opts),
  openFiles: (opts) => ipcRenderer.invoke('file:open', opts),
  revealFile: (filePath) => ipcRenderer.invoke('file:reveal', filePath),
  soundsHave: (rels) => ipcRenderer.invoke('sounds:has', rels),
  openSoundsFolder: () => ipcRenderer.invoke('sounds:open-folder'),
  toggleFullscreen: () => ipcRenderer.invoke('win:fullscreen'),
  onFullscreen: (cb) => ipcRenderer.on('win:fullscreen', (_e, value) => cb(value)),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});
