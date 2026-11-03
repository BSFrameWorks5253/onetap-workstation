import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron'
import { join } from 'path'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import { pathToFileURL } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// File extension categories
const RAW_EXTS = new Set([
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'raw', 'orf', 'rw2', 'pef', 'sr2', 'srf'
])

const VIDEO_EXTS = new Set([
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'wmv', 'flv', 'm2ts', 'mts', 'mpg', 'mpeg', '3gp', 'vob', 'ogv'
])

const AUDIO_EXTS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff', 'alac', 'mid', 'midi'
])

// Persistent Disk Thumbnail Cache Directory
let thumbCacheDir: string | null = null
function getThumbCacheDir(): string {
  if (!thumbCacheDir) {
    thumbCacheDir = path.join(app.getPath('userData'), 'thumb-cache')
    if (!fs.existsSync(thumbCacheDir)) {
      try {
        fs.mkdirSync(thumbCacheDir, { recursive: true })
      } catch {}
    }
  }
  return thumbCacheDir
}

function getCacheKey(filePath: string, stat: fs.Stats): string {
  return crypto.createHash('md5').update(`${filePath}:${stat.size}:${stat.mtimeMs}`).digest('hex')
}

/**
 * Super-fast pure Node buffer extractor for embedded JPEGs inside Camera RAW files
 */
function extractEmbeddedRawJpeg(filePath: string, forThumbnail = true): Buffer | null {
  try {
    const fd = fs.openSync(filePath, 'r')
    const READ_SIZE = forThumbnail ? 8 * 1024 * 1024 : 16 * 1024 * 1024
    const buf = Buffer.alloc(READ_SIZE)
    const bytesRead = fs.readSync(fd, buf, 0, READ_SIZE, 0)
    fs.closeSync(fd)

    const jpegs: Buffer[] = []
    for (let i = 0; i < bytesRead - 4; i++) {
      if (buf[i] === 0xFF && buf[i+1] === 0xD8 && buf[i+2] === 0xFF) {
        for (let j = i + 100; j < bytesRead - 1; j++) {
          if (buf[j] === 0xFF && buf[j+1] === 0xD9) {
            const slice = buf.subarray(i, j + 2)
            jpegs.push(slice)
            i = j + 2
            break
          }
        }
      }
    }

    if (jpegs.length === 0) return null

    if (forThumbnail) {
      const medium = jpegs.find(b => b.length >= 40 * 1024 && b.length <= 800 * 1024)
      if (medium) return medium
      return jpegs.sort((a, b) => b.length - a.length)[0]
    } else {
      return jpegs.sort((a, b) => b.length - a.length)[0]
    }
  } catch {
    return null
  }
}

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
    if (!filePath || !fs.existsSync(filePath)) {
      return { ok: false, error: 'File not found' }
    }

    const ext = (filePath.split('.').pop() || '').toLowerCase()

    // Camera RAW files: extract high-res preview
    if (RAW_EXTS.has(ext)) {
      const rawBuf = extractEmbeddedRawJpeg(filePath, false)
      if (rawBuf && rawBuf.length > 0) {
        return { ok: true, dataUrl: `data:image/jpeg;base64,${rawBuf.toString('base64')}` }
      }
    }

    const MIME_MAP: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      avif: 'image/avif',
      tiff: 'image/tiff',
      tif: 'image/tiff'
    }

    if (MIME_MAP[ext]) {
      const buf = fs.readFileSync(filePath)
      return { ok: true, dataUrl: `data:${MIME_MAP[ext]};base64,${buf.toString('base64')}` }
    }

    // Check disk thumbnail cache
    const stat = fs.statSync(filePath)
    const cacheKey = getCacheKey(filePath, stat)
    const diskCacheFile = path.join(getThumbCacheDir(), `${cacheKey}.jpg`)
    if (fs.existsSync(diskCacheFile)) {
      const diskBuf = fs.readFileSync(diskCacheFile)
      return { ok: true, dataUrl: `data:image/jpeg;base64,${diskBuf.toString('base64')}` }
    }

    // Fallback: Windows Shell 256x256 native icon
    const icon = await app.getFileIcon(filePath, { size: 'large' })
    return { ok: true, dataUrl: icon.toDataURL() }
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

    const stat = fs.statSync(filePath)
    const cacheKey = getCacheKey(filePath, stat)

    // In-memory cache
    const memCached = fmVideoCache.get(cacheKey)
    if (memCached) return { ok: true, duration: memCached.duration, thumb: memCached.thumb }

    const ext = (filePath.split('.').pop() || '').toLowerCase()
    const isRaw = RAW_EXTS.has(ext)

    // Disk cache check
    const cacheDir = getThumbCacheDir()
    const diskCacheFile = path.join(cacheDir, `${cacheKey}.jpg`)
    const metaCacheFile = path.join(cacheDir, `${cacheKey}.json`)

    if (fs.existsSync(diskCacheFile)) {
      try {
        const thumbBuf = fs.readFileSync(diskCacheFile)
        let duration = 0
        if (fs.existsSync(metaCacheFile)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaCacheFile, 'utf-8'))
            duration = meta.duration || 0
          } catch {}
        }
        const thumb = `data:image/jpeg;base64,${thumbBuf.toString('base64')}`
        const result = { duration, thumb }
        fmVideoCache.set(cacheKey, result)
        return { ok: true, duration, thumb }
      } catch {}
    }

    // 0. Folders: Extract authentic native OS folder icon
    if (stat.isDirectory()) {
      try {
        const icon = await app.getFileIcon(filePath, { size: 'large' })
        const folderThumb = icon.toDataURL()
        fmVideoCache.set(cacheKey, { thumb: folderThumb, duration: 0 })
        return { ok: true, duration: 0, thumb: folderThumb }
      } catch {}
    }

    // 1. Camera RAW files: instant buffer extraction (~5-15ms)
    if (isRaw) {
      const rawBuf = extractEmbeddedRawJpeg(filePath, true)
      if (rawBuf && rawBuf.length > 0) {
        try {
          fs.writeFileSync(diskCacheFile, rawBuf)
        } catch {}
        const thumb = `data:image/jpeg;base64,${rawBuf.toString('base64')}`
        const result = { duration: 0, thumb }
        fmVideoCache.set(cacheKey, result)
        return { ok: true, duration: 0, thumb }
      }
    }

    // 2. Video Files
    if (VIDEO_EXTS.has(ext)) {
      let duration = 0
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
          { timeout: 4000 }
        )
        const parsed = parseFloat(stdout.trim())
        if (isFinite(parsed) && parsed > 0) duration = Math.round(parsed * 10) / 10
      } catch {}

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
        if (buf && buf.length > 0) {
          thumb = `data:image/jpeg;base64,${buf.toString('base64')}`
          try {
            fs.writeFileSync(diskCacheFile, buf)
            fs.writeFileSync(metaCacheFile, JSON.stringify({ duration }))
          } catch {}
        } else {
          try {
            const icon = await app.getFileIcon(filePath, { size: 'large' })
            thumb = icon.toDataURL()
          } catch {}
        }
      } catch {
        try {
          const icon = await app.getFileIcon(filePath, { size: 'large' })
          thumb = icon.toDataURL()
        } catch {}
      }

      const result = { duration, thumb }
      if (thumb || duration > 0) fmVideoCache.set(cacheKey, result)
      return { ok: true, duration, thumb }
    }

    // 3. Audio Files (.MP3, .FLAC, .M4A, .WAV, etc.)
    if (AUDIO_EXTS.has(ext)) {
      let duration = 0
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
          { timeout: 3000 }
        )
        const parsed = parseFloat(stdout.trim())
        if (isFinite(parsed) && parsed > 0) duration = Math.round(parsed * 10) / 10
      } catch {}

      let thumb = ''
      try {
        const { stdout: artBuf } = await execAsync(
          `ffmpeg -ss 0 -i "${filePath}" -vframes 1 -vf "scale=360:-1" -f image2 -update 1 pipe:1`,
          { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 3500 }
        )
        if (artBuf && artBuf.length > 0) {
          thumb = `data:image/jpeg;base64,${artBuf.toString('base64')}`
          try {
            fs.writeFileSync(diskCacheFile, artBuf)
            fs.writeFileSync(metaCacheFile, JSON.stringify({ duration }))
          } catch {}
        }
      } catch {}

      if (!thumb) {
        try {
          const icon = await app.getFileIcon(filePath, { size: 'large' })
          thumb = icon.toDataURL()
        } catch {}
      }

      const result = { duration, thumb }
      if (thumb || duration > 0) fmVideoCache.set(cacheKey, result)
      return { ok: true, duration, thumb }
    }

    // 4. PDF Files (.PDF)
    if (ext === 'pdf') {
      let thumb = ''
      try {
        const { stdout: pdfBuf } = await execAsync(
          `ffmpeg -i "${filePath}" -vframes 1 -vf "scale=360:-1" -f image2 pipe:1`,
          { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 4000 }
        )
        if (pdfBuf && pdfBuf.length > 0) {
          thumb = `data:image/jpeg;base64,${pdfBuf.toString('base64')}`
          try { fs.writeFileSync(diskCacheFile, pdfBuf) } catch {}
        }
      } catch {}

      if (!thumb) {
        try {
          const icon = await app.getFileIcon(filePath, { size: 'large' })
          thumb = icon.toDataURL()
        } catch {}
      }

      const result = { duration: 0, thumb }
      if (thumb) fmVideoCache.set(cacheKey, result)
      return { ok: true, duration: 0, thumb }
    }

    // 5. Universal Windows Shell 256x256 Native Thumbnail / Icon for ALL other files
    // (.DOCX, .XLSX, .PPTX, .ZIP, .RAR, .7Z, .EXE, .TXT, .JS, .PY, .HTML, etc.)
    let shellThumb = ''
    try {
      const icon = await app.getFileIcon(filePath, { size: 'large' })
      shellThumb = icon.toDataURL()
      if (shellThumb) {
        const rawBase64 = shellThumb.replace(/^data:image\/[a-z]+;base64,/, '')
        try {
          fs.writeFileSync(diskCacheFile, Buffer.from(rawBase64, 'base64'))
        } catch {}
      }
    } catch {}

    const result = { duration: 0, thumb: shellThumb }
    if (shellThumb) fmVideoCache.set(cacheKey, result)
    return { ok: true, duration: 0, thumb: shellThumb }
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
      let s = request.url.replace(/^local-resource:\/\//i, '')
      s = s.replace(/^\/+/, '')
      s = s.replace(/^localhost[\/\\]/i, '')
      s = decodeURIComponent(s)

      if (/^[a-zA-Z][\\\/]/.test(s)) {
        s = s[0] + ':' + s.slice(1)
      } else if (/^\/?[a-zA-Z]:[\\\/]/.test(s)) {
        s = s.replace(/^\//, '')
      }
      const rawPath = s.replace(/\//g, '\\')

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
