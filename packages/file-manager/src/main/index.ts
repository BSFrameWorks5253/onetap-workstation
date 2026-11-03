import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron'
import { join } from 'path'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { pathToFileURL } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-resource', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true, corsEnabled: true } }
])

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

ipcMain.handle('fm:getDrivesWithSpace', async () => {
  const drives: { drive: string; total: number; free: number; usedPercent: number }[] = []
  for (let i = 65; i <= 90; i++) {
    const drive = String.fromCharCode(i) + ':\\'
    try {
      if (fs.existsSync(drive)) {
        let total = 0, free = 0, usedPercent = 0
        try {
          const stats = fs.statfsSync(drive)
          total = stats.blocks * stats.bsize
          free = stats.bavail * stats.bsize
          usedPercent = total > 0 ? Math.round(((total - free) / total) * 100) : 0
        } catch {}
        drives.push({ drive, total, free, usedPercent })
      }
    } catch {}
  }
  return drives
})

ipcMain.handle('fm:getQuickAccess', async () => {
  try {
    const items = [
      { name: 'Home', path: app.getPath('home'), icon: 'home' },
      { name: 'Desktop', path: app.getPath('desktop'), icon: 'desktop' },
      { name: 'Downloads', path: app.getPath('downloads'), icon: 'downloads' },
      { name: 'Pictures', path: app.getPath('pictures'), icon: 'pictures' },
      { name: 'Videos', path: app.getPath('videos'), icon: 'videos' },
      { name: 'Documents', path: app.getPath('documents'), icon: 'documents' }
    ]
    return items.filter(i => fs.existsSync(i.path))
  } catch {
    return []
  }
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

ipcMain.handle('fm:readImageBase64', async (_e, filePath: string) => {
  try {
    const ext = (filePath.split('.').pop() || '').toLowerCase()
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'
    const buf = fs.readFileSync(filePath)
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
})

const fmVideoCache = new Map<string, { duration: number; thumb: string }>()

ipcMain.handle('fm:getVideoMetadata', async (_e, filePath: string) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { ok: false, error: 'File not found', duration: 0, thumb: '' }
    }
    const cached = fmVideoCache.get(filePath)
    if (cached) return { ok: true, duration: cached.duration, thumb: cached.thumb }

    let duration = 0
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        { timeout: 4000 }
      )
      const parsed = parseFloat(stdout.trim())
      if (isFinite(parsed) && parsed > 0) duration = Math.round(parsed * 10) / 10
    } catch {}

    if (duration === 0 && process.platform === 'win32') {
      try {
        const dir = path.dirname(filePath).replace(/'/g, "''")
        const leaf = path.basename(filePath).replace(/'/g, "''")
        const psCmd = `powershell -NoProfile -Command "$shell = New-Object -ComObject Shell.Application; $folder = $shell.Namespace('${dir}'); $item = $folder.ParseName('${leaf}'); $folder.GetDetailsOf($item, 27)"`
        const { stdout } = await execAsync(psCmd, { timeout: 3000 })
        const raw = stdout.trim()
        if (raw && raw.includes(':')) {
          const parts = raw.split(':').map(p => parseInt(p, 10))
          if (parts.length === 3 && parts.every(p => !isNaN(p))) {
            duration = parts[0] * 3600 + parts[1] * 60 + parts[2]
          }
        }
      } catch {}
    }

    let thumb = ''
    let seekSecs = duration > 1 ? Math.min(Math.max(1, duration * 0.1), duration - 0.2) : 0.5
    const seekFormatted = new Date(seekSecs * 1000).toISOString().substr(11, 8) + '.' + String(Math.floor((seekSecs % 1) * 1000)).padStart(3, '0')

    try {
      const cmd = `ffmpeg -ss ${seekFormatted} -i "${filePath}" -vframes 1 -vf "scale=360:-1" -f image2 -update 1 pipe:1`
      const { stdout: buf } = await execAsync(cmd, {
        encoding: 'buffer',
        maxBuffer: 15 * 1024 * 1024,
        timeout: 5000
      })
      if (buf && buf.length > 0) thumb = `data:image/jpeg;base64,${buf.toString('base64')}`
    } catch {}

    const result = { duration, thumb }
    if (thumb || duration > 0) fmVideoCache.set(filePath, result)
    return { ok: true, duration, thumb }
  } catch (err: any) {
    return { ok: false, error: err.message, duration: 0, thumb: '' }
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

app.whenReady().then(() => {
  // Native protocol handler for streaming local video & media with full range seeking
  protocol.handle('local-resource', (request) => {
    try {
      let cleanUrl = request.url.replace(/^local-resource:\/\/?\/?/i, '')
      let rawPath = decodeURIComponent(cleanUrl)
      if (/^\/?[a-zA-Z]:[\\\/]/.test(rawPath)) {
        rawPath = rawPath.replace(/^\//, '')
      }
      rawPath = rawPath.replace(/\//g, '\\')

      if (!fs.existsSync(rawPath)) {
        return new Response('File not found', { status: 404 })
      }

      const fileUrl = pathToFileURL(rawPath).toString()
      return net.fetch(fileUrl)
    } catch {
      return new Response('Error loading resource', { status: 500 })
    }
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
