import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fmApi', {
  listDir: (p: string) => ipcRenderer.invoke('fm:listDir', p),
  getDrives: () => ipcRenderer.invoke('fm:getDrives'),
  openExternal: (p: string) => ipcRenderer.invoke('fm:openExternal', p),
  openInExplorer: (p: string) => ipcRenderer.invoke('fm:openInExplorer', p),
  createFolder: (parent: string, name: string) => ipcRenderer.invoke('fm:createFolder', parent, name),
  getDeepLinkPath: () => ipcRenderer.invoke('fm:getDeepLinkPath'),
  onNavigate: (cb: (path: string) => void) => {
    ipcRenderer.on('fm:navigate', (_e, path) => cb(path))
  }
})
