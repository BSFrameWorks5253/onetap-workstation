import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fmApi', {
  listDir: (p: string) => ipcRenderer.invoke('fm:listDir', p),
  getDrives: () => ipcRenderer.invoke('fm:getDrives'),
  getDrivesWithSpace: () => ipcRenderer.invoke('fm:getDrivesWithSpace'),
  getQuickAccess: () => ipcRenderer.invoke('fm:getQuickAccess'),
  openExternal: (p: string) => ipcRenderer.invoke('fm:openExternal', p),
  openInExplorer: (p: string) => ipcRenderer.invoke('fm:openInExplorer', p),
  createFolder: (parent: string, name: string) => ipcRenderer.invoke('fm:createFolder', parent, name),
  readImageBase64: (filePath: string) => ipcRenderer.invoke('fm:readImageBase64', filePath),
  getVideoMetadata: (filePath: string) => ipcRenderer.invoke('fm:getVideoMetadata', filePath),
  getDeepLinkPath: () => ipcRenderer.invoke('fm:getDeepLinkPath'),
  toLocalResourceUrl: (filePath: string) => {
    const f = filePath.replace(/\\/g, '/')
    return `local-resource:///${encodeURI(f).replace(/^\//, '')}`
  },
  onNavigate: (cb: (path: string) => void) => {
    ipcRenderer.on('fm:navigate', (_e, path) => cb(path))
  }
})
