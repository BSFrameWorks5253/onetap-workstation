import { app, BrowserWindow, ipcMain, shell, protocol } from 'electron'
import { join } from 'path'
import fs from 'fs'
import os from 'os'

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

ipcMain.handle('fm:getDeepLinkPath', async () => initialPath)

app.on('open-url', (_e, url) => {
  const parsed = url.replace('filexplorer://', '')
  if (parsed && mainWindow) {
    mainWindow.webContents.send('fm:navigate', decodeURIComponent(parsed))
    initialPath = decodeURIComponent(parsed)
  }
})

app.whenReady().then(() => {
  // Protocol handler for streaming local video & media
  protocol.handle('local-resource', async (request) => {
    try {
      let cleanUrl = request.url.replace(/^local-resource:\/\/?\/?/i, '')
      let rawPath = decodeURIComponent(cleanUrl)
      if (/^\/?[a-zA-Z]:[\\\/]/.test(rawPath)) {
        rawPath = rawPath.replace(/^\//, '')
      }
      rawPath = rawPath.replace(/\//g, '\\')

      const ext = rawPath.includes('.') ? rawPath.slice(rawPath.lastIndexOf('.')).toLowerCase() : ''
      const MIME: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
        '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v',
      }
      const contentType = MIME[ext] || 'application/octet-stream'

      if (!fs.existsSync(rawPath)) {
        return new Response('File not found', { status: 404 })
      }

      const fileStat = fs.statSync(rawPath)
      const fileSize = fileStat.size

      const rangeHeader = request.headers.get('Range')
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = parseInt(match[1], 10)
          const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024, fileSize - 1)
          const chunkSize = end - start + 1
          const stream = fs.createReadStream(rawPath, { start, end })
          const webStream = new ReadableStream({
            start(controller) {
              stream.on('data', chunk => controller.enqueue(chunk))
              stream.on('end', () => controller.close())
              stream.on('error', e => controller.error(e))
            },
            cancel() { stream.destroy() }
          })
          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize),
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      }

      const buf = fs.readFileSync(rawPath)
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(buf.length),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch {
      return new Response('Error loading resource', { status: 500 })
    }
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})


app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
