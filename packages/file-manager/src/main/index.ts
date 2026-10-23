import { app, BrowserWindow, ipcMain, shell, protocol } from 'electron'
import { join } from 'path'
import fs from 'fs'
import os from 'os'

let mainWindow: BrowserWindow | null = null
let initialPath: string | null = null

// Parse --path= argument
const pathArg = process.argv.find(a => a.startsWith('--path='))
if (pathArg) initialPath = pathArg.replace('--path=', '')

app.setAsDefaultProtocolClient('filexplorer')

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 700,
    minHeight: 450,
    backgroundColor: '#0D0F14',
    title: 'Uni File Manager',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC: list directory contents
ipcMain.handle('fm:listDir', async (_e, dirPath: string) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries.map(e => {
      const fullPath = join(dirPath, e.name)
      let size = 0, mtime = 0
      try {
        const stat = fs.statSync(fullPath)
        size = stat.size
        mtime = stat.mtimeMs
      } catch {}
      const ext = e.isDirectory() ? '' : (e.name.split('.').pop() || '').toLowerCase()
      return { name: e.name, isDir: e.isDirectory(), size, mtime, ext, fullPath }
    }).sort((a, b) => {
      // Folders first, then files
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  } catch {
    return []
  }
})

// IPC: list available drives
ipcMain.handle('fm:getDrives', async () => {
  const drives: string[] = []
  for (let i = 65; i <= 90; i++) {
    const drive = String.fromCharCode(i) + ':\\\\'
    try { if (fs.existsSync(drive)) drives.push(drive) } catch {}
  }
  return drives
})

ipcMain.handle('fm:openExternal', async (_e, filePath: string) => {
  await shell.openPath(filePath)
  return true
})

ipcMain.handle('fm:openInExplorer', async (_e, dirPath: string) => {
  shell.showItemInFolder(dirPath)
  return true
})

ipcMain.handle('fm:createFolder', async (_e, parentPath: string, name: string) => {
  try {
    const newPath = join(parentPath, name)
    if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true })
    return { success: true, path: newPath }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('fm:getDeepLinkPath', async () => initialPath)

app.on('open-url', (_e, url) => {
  const parsed = url.replace('filexplorer://', '')
  if (parsed && mainWindow) {
    mainWindow.webContents.send('fm:navigate', decodeURIComponent(parsed))
    initialPath = decodeURIComponent(parsed)
  }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
