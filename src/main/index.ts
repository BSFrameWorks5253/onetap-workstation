import { app, BrowserWindow, shell, protocol, session, Tray, Menu, globalShortcut, Notification, dialog } from 'electron'
import path, { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { loadEnv } from './core/envLoader'
import { findAndEnsureFfmpegPath } from './core/gpuDetector'

// Suppress default Electron error dialogs for transient Windows file locks (EBUSY / EPERM / OneDrive locks)
try {
  const originalShowErrorBox = dialog.showErrorBox
  dialog.showErrorBox = (title, content) => {
    const text = String(content || '')
    if (
      text.includes('EBUSY') ||
      text.includes('AMEEncodingLog.txt') ||
      text.includes('resource busy or locked') ||
      text.includes('EPERM')
    ) {
      console.warn('[Suppressed Transient EBUSY ErrorBox]:', title, text)
      return
    }
    return originalShowErrorBox.call(dialog, title, content)
  }
} catch {}

// Process-level safety guards to suppress transient I/O / file lock popups
process.on('uncaughtException', (err: any) => {
  console.error('[Main Process UncaughtException Suppressed]:', err?.message || err)
})
process.on('unhandledRejection', (reason: any) => {
  console.error('[Main Process UnhandledRejection Suppressed]:', reason?.message || reason)
})

// Load environment variables and discover FFmpeg before doing anything else
loadEnv()
findAndEnsureFfmpegPath()

import { initSettings, getAll, flushSaveSync } from './core/settingsManager'
import { initWatcher, startWatcher } from './core/folderWatcher'
import { applyFolderIcon } from './core/folderIconHelper'
import { registerSettingsIPC } from './ipc/settings.ipc'
import { registerDialogIPC } from './ipc/dialog.ipc'
import { registerTitleAdderIPC, isGroupPhotoVideo, getFinalTitlesInfo } from './ipc/titleAdder.ipc'
import { registerConverterIPC } from './ipc/converter.ipc'
import { registerDriveSyncIPC } from './ipc/driveSync.ipc'
import { registerFolderMakerIPC } from './ipc/folderMaker.ipc'
import { registerAudioIPC } from './ipc/audio.ipc'
import { registerSystemIPC } from './ipc/system.ipc'
import { registerTaskTrackerIPC, getProductionSummary } from './ipc/taskTracker.ipc'
import { registerUpdateIPC, triggerSilentStartupCheck } from './ipc/update.ipc'
import { registerPdfIPC } from './ipc/pdf.ipc'
import { registerViewerIPC } from './ipc/viewer.ipc'
import { registerCameraTransferIPC } from './ipc/cameraTransfer.ipc'
import { registerPrprojIPC } from './ipc/prproj.ipc'
import { registerVideoTransferIPC } from './ipc/videoTransfer.ipc'
import { registerPVSeparatorIPC } from './ipc/pvSeparator.ipc'
import { registerInventoryMergerIPC } from './ipc/inventoryMerger.ipc'
import { registerStatsDbIPC } from './ipc/statsDb.ipc'
import { registerArchiveCatalogIPC } from './ipc/archiveCatalog.ipc'
import { registerUserProfileIPC } from './ipc/userProfile.ipc'
import { startDriveWatcherDaemon, stopDriveWatcherDaemon } from './core/driveWatcherDaemon'
import { registerTitleAutomodeIPC } from './ipc/titleAutomode.ipc'
import { initDynamicIsland } from './core/dynamicIsland'
import { resolveChildAppLoaderConfig, showChildAppSplash, ChildAppLoaderConfig } from './core/splash'
import http from 'http'

// Keep user settings database folder compatible with "One Tap" data folder path
const currentAppData = app.getPath('appData')
app.setPath('userData', join(currentAppData, 'One Tap'))


protocol.registerSchemesAsPrivileged([
  { scheme: 'local-resource', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
])

// ── Single-instance lock — ensures Explorer double-click focuses the same app ──
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

// Extract a supported file path from argv (for Explorer double-click launch)
const SUPPORTED_VIEWER_EXTS = new Set([
  '.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff','.tif','.heic','.avif',
  '.cr2','.cr3','.nef','.nrw','.arw','.srf','.sr2','.dng','.orf','.rw2',
  '.pef','.ptx','.raf','.raw','.3fr','.mef','.mos','.erf','.rwl','.srw',
  '.x3f','.dcr','.kdc','.mrw',
  '.mp4','.mkv','.avi','.mov','.webm','.wmv','.flv','.m4v','.ts','.m2ts',
  '.pdf',
  '.docx','.doc',
  '.xlsx','.xls',
  '.md','.markdown'
])

function extractFileFromArgv(argv: string[]): string | null {
  // Electron passes the file path as the last argument that looks like an absolute path
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i]
    if (arg.startsWith('--')) continue
    const lower = arg.toLowerCase()
    const dot = lower.lastIndexOf('.')
    if (dot !== -1 && SUPPORTED_VIEWER_EXTS.has(lower.slice(dot))) {
      return arg
    }
  }
  return null
}

let pendingOpenFile: string | null = extractFileFromArgv(process.argv)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

import fs from 'fs'

function getAppIconPath(): string {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const devPath = join(__dirname, `../../resources/${iconName}`)
  if (fs.existsSync(devPath)) return devPath
  const prodPath = join(process.resourcesPath, iconName)
  if (fs.existsSync(prodPath)) return prodPath
  const pngDev = join(__dirname, '../../resources/icon.png')
  if (fs.existsSync(pngDev)) return pngDev
  const pngProd = join(process.resourcesPath, 'icon.png')
  if (fs.existsSync(pngProd)) return pngProd
  return devPath
}

function createTray(win: BrowserWindow): void {
  try {
    if (tray) return
    const iconPath = getAppIconPath()
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath)
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Open One Tap',
          click: () => {
            win.show()
            win.maximize()
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            (app as any).isQuitting = true
            app.quit()
          }
        }
      ])

      tray.setToolTip('One Tap Workstation')
      tray.setContextMenu(contextMenu)

      tray.on('double-click', () => {
        win.show()
        win.maximize()
      })
    }
  } catch (err) {
    console.error('[Tray] Failed to create tray:', err)
  }
}

async function readLogTailSafely(logFile: string, startPos: number, currentSize: number, retries = 4): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    let fileHandle: fs.promises.FileHandle | null = null
    try {
      fileHandle = await fs.promises.open(logFile, 'r')
      const bufferLength = Math.max(0, currentSize - startPos)
      if (bufferLength === 0) return ''
      const buf = Buffer.alloc(bufferLength)
      await fileHandle.read(buf, 0, bufferLength, startPos)
      return buf.toString('utf8')
    } catch (err: any) {
      if (attempt < retries - 1 && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES')) {
        await new Promise((res) => setTimeout(res, 600 * (attempt + 1)))
        continue
      }
      return ''
    } finally {
      if (fileHandle) {
        try { await fileHandle.close() } catch {}
      }
    }
  }
  return ''
}

function cleanTempFiles(targetDir: string): void {
  try {
    if (!targetDir || !fs.existsSync(targetDir)) return
    const files = fs.readdirSync(targetDir)
    for (const f of files) {
      const lower = f.toLowerCase()
      if (lower.endsWith('.tmp') || lower.endsWith('.temp')) {
        try {
          fs.unlinkSync(path.join(targetDir, f))
          console.log(`[BatchWatcher] Cleaned placeholder temp file: ${f}`)
        } catch {}
      }
    }
  } catch {}
}

let activeBatchWatcherTimer: NodeJS.Timeout | null = null
let activeBatchCompleted = false

function stopDvdBatchWatcher(): void {
  if (activeBatchWatcherTimer) {
    clearInterval(activeBatchWatcherTimer)
    activeBatchWatcherTimer = null
  }
}

function notifyBatchReady(win: BrowserWindow | null, dvdOrBatchPath: string, customMessage?: string): void {
  const cleanPath = (dvdOrBatchPath || '').replace(/[\\/]DVD\b/i, '').replace(/[\\/]+$/, '')
  const folderName = path.basename(cleanPath) || 'Batch'

  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    win.webContents.send('app:navigate', 'title-adder')
  }

  if (Notification.isSupported()) {
    const notif = new Notification({
      title: 'Batch Ready to Render 🎬',
      body: customMessage || `This batch (${folderName}) is ready to start rendering. Confirm everything and click start.`
    })
    notif.on('click', () => {
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
        win.webContents.send('app:navigate', 'title-adder')
      }
    })
    notif.show()
  }
}

function startDvdBatchWatcher(
  targetDir: string,
  expectedVideos: string[],
  win: BrowserWindow | null
): void {
  stopDvdBatchWatcher()
  if (!targetDir || !fs.existsSync(targetDir)) return

  activeBatchCompleted = false
  const stableSizeMap = new Map<string, { size: number; stableTicks: number }>()
  const startTime = Date.now()
  const MAX_POLL_MS = 1000 * 60 * 180 // 3 hours max monitoring window

  const checkList: string[] = (expectedVideos || []).map(v => {
    const base = path.basename(v).replace(/\.(tmp|temp)$/i, '')
    return base.toLowerCase().endsWith('.mp4') ? base : `${base}.mp4`
  })

  console.log(`[BatchWatcher] Active DVD batch watcher started for: ${targetDir} (${checkList.length} expected files)`)

  activeBatchWatcherTimer = setInterval(() => {
    if (activeBatchCompleted) {
      stopDvdBatchWatcher()
      return
    }

    if (Date.now() - startTime > MAX_POLL_MS) {
      console.warn('[BatchWatcher] Max polling duration exceeded. Stopping watcher.')
      stopDvdBatchWatcher()
      return
    }

    try {
      if (!fs.existsSync(targetDir)) return

      if (checkList.length > 0) {
        let allCompleted = true

        for (const videoName of checkList) {
          const filePath = path.join(targetDir, videoName)
          if (!fs.existsSync(filePath)) {
            allCompleted = false
            break
          }

          let stat: fs.Stats
          try {
            stat = fs.statSync(filePath)
          } catch {
            allCompleted = false
            break
          }

          if (stat.size <= 0) {
            allCompleted = false
            break
          }

          // Verify file is readable and unlocked by Media Encoder
          try {
            const fd = fs.openSync(filePath, 'r')
            fs.closeSync(fd)
          } catch {
            // Still being written by AME
            allCompleted = false
            break
          }

          // Check if file size is stable for at least 2 ticks (4 seconds)
          const prev = stableSizeMap.get(videoName)
          if (!prev || prev.size !== stat.size) {
            stableSizeMap.set(videoName, { size: stat.size, stableTicks: 0 })
            allCompleted = false
          } else {
            prev.stableTicks += 1
            if (prev.stableTicks < 2) {
              allCompleted = false
            }
          }
        }

        if (allCompleted) {
          activeBatchCompleted = true
          stopDvdBatchWatcher()
          console.log(`[BatchWatcher] All ${checkList.length} expected videos rendered and verified in: ${targetDir}`)

          // Clean up temp placeholder files now that the real videos are fully rendered!
          cleanTempFiles(targetDir)

          if (win && !win.isDestroyed()) {
            win.webContents.send('ame:render-complete', {
              dvdPath: targetDir,
              autoStart: false,
              requireConfirmation: true,
              source: 'folder-watcher'
            })
            win.webContents.send('titleAutomode:triggered', {
              dvdPath: targetDir,
              autoStart: false,
              requireConfirmation: true,
              source: 'folder-watcher'
            })
          }

          notifyBatchReady(win, targetDir)
        }
      } else {
        // Fallback when expectedVideos is empty:
        // Watch for .mp4 files appearing where .tmp files were, and stabilizing
        const files = fs.readdirSync(targetDir)
        const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'))
        const tmpFiles = files.filter(f => f.toLowerCase().endsWith('.tmp') || f.toLowerCase().endsWith('.temp'))

        if (mp4Files.length > 0 && tmpFiles.length === 0) {
          let allStable = true
          for (const f of mp4Files) {
            const p = path.join(targetDir, f)
            try {
              const stat = fs.statSync(p)
              if (stat.size <= 0) { allStable = false; break }
              const fd = fs.openSync(p, 'r')
              fs.closeSync(fd)

              const prev = stableSizeMap.get(f)
              if (!prev || prev.size !== stat.size) {
                stableSizeMap.set(f, { size: stat.size, stableTicks: 0 })
                allStable = false
              } else {
                prev.stableTicks += 1
                if (prev.stableTicks < 3) allStable = false
              }
            } catch {
              allStable = false
              break
            }
          }

          if (allStable) {
            activeBatchCompleted = true
            stopDvdBatchWatcher()
            cleanTempFiles(targetDir)
            if (win && !win.isDestroyed()) {
              win.webContents.send('ame:render-complete', { dvdPath: targetDir, autoStart: false, requireConfirmation: true, source: 'folder-watcher-fallback' })
              win.webContents.send('titleAutomode:triggered', { dvdPath: targetDir, autoStart: false, requireConfirmation: true, source: 'folder-watcher-fallback' })
            }
            notifyBatchReady(win, targetDir)
          }
        }
      }
    } catch (err) {
      console.warn('[BatchWatcher] Polling error:', err)
    }
  }, 2000)
}

const watchedLogFiles = new Set<string>()

function scanAndWatchAmeLogs(win: BrowserWindow | null): void {
  if (!win) return
  const os = require('os')
  const candidateBaseDirs: string[] = []

  try {
    const docPath = app.getPath('documents')
    if (docPath) {
      candidateBaseDirs.push(path.join(docPath, 'Adobe', 'Adobe Media Encoder'))
      candidateBaseDirs.push(path.join(docPath, 'Adobe'))
    }
  } catch {}

  candidateBaseDirs.push(path.join(os.homedir(), 'Documents', 'Adobe', 'Adobe Media Encoder'))
  if (process.platform === 'win32') {
    if (process.env.USERPROFILE) {
      candidateBaseDirs.push(path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Adobe', 'Adobe Media Encoder'))
      candidateBaseDirs.push(path.join(process.env.USERPROFILE, 'Documents', 'Adobe', 'Adobe Media Encoder'))
      candidateBaseDirs.push(path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'Adobe', 'Adobe Media Encoder'))
      candidateBaseDirs.push(path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Adobe', 'Adobe Media Encoder'))
    }
  }

  // Also query Windows registry Personal folder if available
  try {
    if (process.platform === 'win32') {
      const regRes = require('child_process').spawnSync('reg', [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
        '/v',
        'Personal'
      ], { encoding: 'utf8' })
      if (regRes.stdout) {
        const match = regRes.stdout.match(/Personal\s+REG_[^\s]+\s+(.+)/i)
        if (match && match[1]) {
          let p = match[1].trim()
          if (p.includes('%USERPROFILE%') && process.env.USERPROFILE) {
            p = p.replace(/%USERPROFILE%/g, process.env.USERPROFILE)
          }
          if (fs.existsSync(p)) {
            candidateBaseDirs.push(path.join(p, 'Adobe', 'Adobe Media Encoder'))
          }
        }
      }
    }
  } catch {}

  const existingDirs = Array.from(new Set(candidateBaseDirs.filter(d => fs.existsSync(d))))
  if (existingDirs.length === 0) return

  try {
    for (const docsDir of existingDirs) {
      const versions = fs.readdirSync(docsDir).filter(d => {
        try { return fs.statSync(path.join(docsDir, d)).isDirectory() } catch { return false }
      })
      for (const ver of versions) {
        const logFile = path.join(docsDir, ver, 'AMEEncodingLog.txt')
        if (fs.existsSync(logFile) && !watchedLogFiles.has(logFile)) {
          watchedLogFiles.add(logFile)
          let lastSize = fs.statSync(logFile).size
          let debounceTimer: NodeJS.Timeout | null = null

          fs.watchFile(logFile, { interval: 1500 }, (curr) => {
            if (curr.size > lastSize) {
              if (debounceTimer) clearTimeout(debounceTimer)
              debounceTimer = setTimeout(async () => {
                const newSize = curr.size
                const startPos = lastSize
                const chunk = await readLogTailSafely(logFile, startPos, newSize)
                lastSize = newSize

                if (
                  chunk.includes('File successfully created') ||
                  chunk.includes('The file was encoded successfully') ||
                  chunk.includes('Encoding Time:')
                ) {
                  let detectedDvdPath = ''
                  const outMatch = chunk.match(/(?:-\s*Output File:\s*|File successfully created:\s*)([^\r\n]+)/i)
                  const detectedFileNames: string[] = []
                  if (outMatch && outMatch[1]) {
                    const outFilePath = outMatch[1].trim().replace(/^["']|["']$/g, '')
                    try {
                      detectedDvdPath = path.dirname(outFilePath)
                      const baseName = path.basename(outFilePath)
                      if (baseName) detectedFileNames.push(baseName)
                    } catch {}
                  }

                  if (detectedDvdPath) {
                    cleanTempFiles(detectedDvdPath)
                    stopDvdBatchWatcher()
                  }

                  if (win && !win.isDestroyed()) {
                    win.webContents.send('ame:render-complete', {
                      log: chunk.slice(-300),
                      dvdPath: detectedDvdPath,
                      expectedVideos: detectedFileNames.length > 0 ? detectedFileNames : undefined,
                      autoStart: false,
                      requireConfirmation: true,
                      source: 'ame-log'
                    })
                    if (detectedDvdPath) {
                      win.webContents.send('titleAutomode:triggered', {
                        dvdPath: detectedDvdPath,
                        expectedVideos: detectedFileNames.length > 0 ? detectedFileNames : undefined,
                        autoStart: false,
                        requireConfirmation: true,
                        source: 'ame-log'
                      })
                    }
                  }

                  notifyBatchReady(win, detectedDvdPath)
                }
              }, 2500)
            }
          })
        }
      }
    }
  } catch (err) {
    console.warn('[AmeLogMonitor] Log watch warning:', err)
  }
}

function startAmeLogMonitor(win: BrowserWindow | null): void {
  scanAndWatchAmeLogs(win)
}

let isSplashActive = false
let activeLoaderConfig: ChildAppLoaderConfig | null = null

function revealMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.maximize()
      mainWindow.focus()
    }
    createTray(mainWindow)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    title: 'One Tap',
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })

  // Log renderer console messages to main process terminal for easier debugging
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Console - Level ${level}] ${message} (at ${sourceId}:${line})`)
  })

  // Graceful show after paint — avoids white flash
  mainWindow.once('ready-to-show', () => {
    if (!isSplashActive) {
      revealMainWindow()
    }
  })

  // Fallback to ensure window is shown even if ready-to-show event was missed
  const splashDuration = activeLoaderConfig?.durationMs || 2500
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      isSplashActive = false
      revealMainWindow()
    }
  }, isSplashActive ? splashDuration + 1500 : 1000)

  // Send pending file-open (from Explorer double-click on first launch)
  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingOpenFile && mainWindow) {
      // Small delay so React is fully mounted before receiving the event
      setTimeout(() => {
        mainWindow?.webContents.send('viewer:openFile', pendingOpenFile)
        pendingOpenFile = null
      }, 800)
    }

    // Trigger background silent update check via GitHub Releases API
    triggerSilentStartupCheck(() => mainWindow)

    // Start Adobe Media Encoder log file listener
    if (mainWindow) {
      startAmeLogMonitor(mainWindow)
    }
  })

  // Intercept close event to run in background (tray mode)
  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Global Keyboard Zoom & DevTools listener
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        event.preventDefault()
        mainWindow?.webContents.toggleDevTools()
        return
      }

      if (input.control) {
        if (input.key === '=' || input.key === '+') {
          event.preventDefault()
          mainWindow?.webContents.send('app:zoom-in')
        } else if (input.key === '-') {
          event.preventDefault()
          mainWindow?.webContents.send('app:zoom-out')
        } else if (input.key === '0') {
          event.preventDefault()
          mainWindow?.webContents.send('app:zoom-reset')
        }
      }
    }
  })

  // Log renderer file load failures
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Main Window] Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`)
  })

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Set app id for windows taskbar grouping
  app.setAppUserModelId('com.bsframework.onetap')

  // Register protocol to serve local files (Electron 31 compatible, direct fs read)
  protocol.handle('local-resource', async (request) => {
    try {
      // Parse local-resource URL into an absolute file path regardless of Chromium URL normalization
      const u = new URL(request.url)
      const decodedPath = decodeURIComponent(u.pathname)
      let rawPath: string
      if (u.host && /^[a-zA-Z]:?$/.test(u.host)) {
        const drive = u.host.replace(':', '').toUpperCase()
        rawPath = `${drive}:${decodedPath}`
      } else if (/^\/[a-zA-Z]:/.test(decodedPath)) {
        rawPath = decodedPath.slice(1)
      } else {
        rawPath = decodedPath
      }
      rawPath = rawPath.replace(/\\/g, '/')

      console.log('[local-resource] Request URL:', request.url, '→ Resolved path:', rawPath)

      // 5. Determine MIME type from extension
      const extname = rawPath.includes('.')
        ? rawPath.slice(rawPath.lastIndexOf('.')).toLowerCase()
        : ''

      const MIME: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml', '.tiff': 'image/tiff', '.tif': 'image/tiff',
        '.ico': 'image/x-icon', '.avif': 'image/avif', '.heic': 'image/heif',
        '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.webm': 'video/webm', '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv', '.m4v': 'video/x-m4v', '.ts': 'video/mp2t',
        '.m2ts': 'video/mp2t', '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.md': 'text/plain', '.txt': 'text/plain',
      }
      const contentType = MIME[extname] || 'application/octet-stream'

      // 6. Read file from disk and return as Response
      const { readFile, stat } = await import('fs/promises')
      const { existsSync } = await import('fs')

      if (!existsSync(rawPath)) {
        console.error('[local-resource] File not found:', rawPath)
        return new Response('File not found', { status: 404 })
      }

      const fileStat = await stat(rawPath)
      const fileSize = fileStat.size

      // Handle Range requests for video seeking (byte-range streaming)
      const rangeHeader = request.headers.get('Range')
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = parseInt(match[1], 10)
          const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024, fileSize - 1)
          const chunkSize = end - start + 1

          const { createReadStream } = await import('fs')
          const stream = createReadStream(rawPath, { start, end })

          // Convert Node.js stream to WHATWG ReadableStream
          const webStream = new ReadableStream({
            start(controller) {
              stream.on('data', (chunk: string | Buffer) => controller.enqueue(chunk))
              stream.on('end', () => controller.close())
              stream.on('error', (e: Error) => controller.error(e))
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
            }
          })
        }
      }

      // Full file read (images, PDFs, small files)
      const buf = await readFile(rawPath)
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(buf.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        }
      })
    } catch (err: any) {
      console.error('[local-resource] Protocol error:', err.message, 'URL:', request.url)
      return new Response('File not found', { status: 404 })
    }
  })

  // Scoped bypass of X-Frame-Options and Content-Security-Policy only for trusted embedded cloud portals
  const ALLOWED_EMBED_HOSTS = [
    'sharaf-media.pages.dev',
    'script.google.com',
    'script.googleusercontent.com',
    'docs.google.com',
    'sheets.google.com',
    'drive.google.com',
    'accounts.google.com'
  ]

  const isAllowedEmbedUrl = (rawUrl: string): boolean => {
    try {
      const parsed = new URL(rawUrl)
      return ALLOWED_EMBED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))
    } catch {
      return false
    }
  }

  const stripFramingHeaders = (details: any, callback: any): void => {
    const responseHeaders = { ...details.responseHeaders }
    if (isAllowedEmbedUrl(details.url)) {
      Object.keys(responseHeaders).forEach((header) => {
        const lowerHeader = header.toLowerCase()
        if (
          lowerHeader === 'x-frame-options' ||
          lowerHeader === 'frame-options' ||
          lowerHeader === 'content-security-policy' ||
          lowerHeader === 'content-security-policy-report-only'
        ) {
          delete responseHeaders[header]
        }
      })
    }
    callback({ cancel: false, responseHeaders })
  }

  session.defaultSession.webRequest.onHeadersReceived(stripFramingHeaders)

  // Configure persistent Sharaf Media session with seamless login persistence & framing allowances
  const sharafSession = session.fromPartition('persist:sharaf_media')
  sharafSession.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  )
  sharafSession.webRequest.onHeadersReceived(stripFramingHeaders)

  // Configure persistent Google Apps Script session for reliable Google Sheets auth
  const googleScriptSession = session.fromPartition('persist:google_apps_script')
  googleScriptSession.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  )
  googleScriptSession.webRequest.onHeadersReceived(stripFramingHeaders)

  // Setup graceful file download interception for webview downloads (exports, CSVs, reports)
  const setupDownloadHandler = (targetSession: Electron.Session, sessionName: string) => {
    targetSession.on('will-download', (_event, item, _webContents) => {
      const fileName = item.getFilename()
      const downloadsDir = app.getPath('downloads')
      const targetPath = path.join(downloadsDir, fileName)
      item.setSavePath(targetPath)

      item.once('done', (_evt, state) => {
        if (state === 'completed') {
          console.log(`[${sessionName}] Download saved to:`, targetPath)
          if (mainWindow) {
            mainWindow.webContents.send('download:completed', { fileName, filePath: targetPath })
          }
        } else {
          console.warn(`[${sessionName}] Download ended with state:`, state)
        }
      })
    })
  }

  setupDownloadHandler(session.defaultSession, 'DefaultSession')
  setupDownloadHandler(sharafSession, 'SharafMedia')
  setupDownloadHandler(googleScriptSession, 'GoogleAppsScript')

  // Handle popup windows from webviews (e.g. OAuth / Google logins) so they inherit the appropriate persistent partition
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      const isSharaf = url.startsWith('https://sharaf-media.pages.dev')
      const isGoogle = url.includes('accounts.google.com') || url.includes('google.com') || url.includes('script.google.com')
      const targetPartition = isSharaf ? 'persist:sharaf_media' : (isGoogle ? 'persist:google_apps_script' : 'persist:sharaf_media')

      if (
        isSharaf ||
        isGoogle ||
        url.includes('login') ||
        url.includes('auth') ||
        url.includes('signin')
      ) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            width: 720,
            height: 800,
            webPreferences: {
              partition: targetPartition,
              contextIsolation: true,
              sandbox: false
            }
          }
        }
      }
      shell.openExternal(url)
      return { action: 'deny' }
    })
  })

  // Initialise settings before anything else
  initSettings()

  // Initialize and start folder watcher
  initWatcher(() => mainWindow)
  startWatcher()

  // Register all IPC handlers
  registerSettingsIPC()
  registerDialogIPC(() => mainWindow)
  registerTitleAdderIPC(() => mainWindow)
  registerConverterIPC(() => mainWindow)
  registerDriveSyncIPC(() => mainWindow)
  registerFolderMakerIPC()
  registerAudioIPC()
  registerSystemIPC()
  registerTaskTrackerIPC()
  registerUpdateIPC(() => mainWindow)
  registerPdfIPC(() => mainWindow)
  registerViewerIPC()
  registerCameraTransferIPC(() => mainWindow)
  registerPrprojIPC()
  registerVideoTransferIPC()
  registerPVSeparatorIPC()
  registerInventoryMergerIPC()
  registerStatsDbIPC(() => mainWindow)
  registerArchiveCatalogIPC(() => mainWindow)
  registerUserProfileIPC()
  registerTitleAutomodeIPC()

  // ── Universal Child App Loader & Splash Screen Synchronization ──
  const APP_ID = 'one-tap'
  const APP_NAME = 'One Tap'
  activeLoaderConfig = resolveChildAppLoaderConfig(APP_ID, APP_NAME)
  isSplashActive = activeLoaderConfig.enabled !== false

  if (isSplashActive) {
    showChildAppSplash(activeLoaderConfig, () => {
      isSplashActive = false
      revealMainWindow()
    })
  }

  createWindow()
  initDynamicIsland(() => mainWindow)
  startDriveWatcherDaemon(() => mainWindow)
  initWatcher(() => mainWindow)
  startWatcher()

  // Apply Adobe-style custom folder icon branding to program folder in production
  if (app.isPackaged) {
    try {
      const appDir = path.dirname(app.getPath('exe'))
      applyFolderIcon(appDir)
    } catch (err) {
      console.error('[FolderIcon] Startup folder icon apply failed:', err)
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // ── Second-instance: user double-clicked a file while app is already running ──
  app.on('second-instance', (_event, argv) => {
    const filePath = extractFileFromArgv(argv)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      if (filePath) {
        mainWindow.webContents.send('viewer:openFile', filePath)
      }
      const pageArg = argv.find(a => a.startsWith('--page='))
      if (pageArg) {
        const pageKey = pageArg.split('=')[1]
        mainWindow.webContents.send('app:navigate', pageKey)
      }
    }
  })

  app.on('before-quit', () => {
    ;(app as any).isQuitting = true
    flushSaveSync()
  })

function normalizeFolderPath(folderPath: any): string {
  if (!folderPath) return ''
  let str = String(folderPath).trim()
  str = str.replace(/^["']|["']$/g, '').trim()
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const obj = JSON.parse(str)
      if (obj && typeof obj.path === 'string') {
        return normalizeFolderPath(obj.path)
      }
    } catch {}
  }
  return str.replace(/^["']|["']$/g, '').trim()
}

  // Start a local HTTP server to receive commands from the Premiere Pro extension
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/set-batch-source') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        let pathVal = ''
        let muteExceptions: string[] = []
        let expectedVideos: string[] = []
        let muteOriginal = true

        try {
          const parsed = JSON.parse(body)
          if (parsed && typeof parsed === 'object') {
            pathVal = normalizeFolderPath(parsed.path)
            muteExceptions = Array.isArray(parsed.muteExceptions) ? parsed.muteExceptions : []
            if (Array.isArray(parsed.expectedVideos)) {
              expectedVideos = parsed.expectedVideos.filter(v => !isGroupPhotoVideo(v))
            }
            if (parsed.muteOriginal !== undefined) muteOriginal = Boolean(parsed.muteOriginal)
          } else if (typeof parsed === 'string') {
            pathVal = normalizeFolderPath(parsed)
          }
        } catch {
          pathVal = normalizeFolderPath(body)
        }

        let targetDir = ''
        // Create placeholder temp files in target DVD directory so One Tap can immediately show and preflight them
        if (pathVal) {
          try {
            const dvdDir = path.basename(pathVal).toLowerCase() === 'dvd' ? pathVal : path.join(pathVal, 'DVD')
            targetDir = fs.existsSync(dvdDir) ? dvdDir : pathVal
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true })
            }
            if (expectedVideos && expectedVideos.length > 0) {
              for (const v of expectedVideos) {
                if (isGroupPhotoVideo(v)) continue
                const base = path.basename(v).replace(/\.(tmp|temp)$/i, '')
                const mp4Name = base.toLowerCase().endsWith('.mp4') ? base : `${base}.mp4`
                const tmpName = `${mp4Name}.tmp`
                const mp4Path = path.join(targetDir, mp4Name)
                const tmpPath = path.join(targetDir, tmpName)
                if (!fs.existsSync(mp4Path) && !fs.existsSync(tmpPath)) {
                  try { fs.writeFileSync(tmpPath, '') } catch {}
                }
              }
            }
          } catch (e) {
            console.error('Failed to create placeholder temp files:', e)
          }
        }

        const finalPayload = JSON.stringify({
          path: pathVal,
          muteExceptions,
          muteOriginal,
          expectedVideos
        })

        if (mainWindow) {
          mainWindow.webContents.send('titleAdder:setBatchSource', finalPayload)
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
        }

        // Auto-monitor the DVD directory to trigger Title Adder the second Media Encoder finishes!
        if (targetDir) {
          startDvdBatchWatcher(targetDir, expectedVideos, mainWindow)
          scanAndWatchAmeLogs(mainWindow)
        }

        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain'
        })
        res.end('OK')
      })
    } else if (req.method === 'POST' && req.url === '/ame-render-complete') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          const dvdPath = payload.dvdPath ? normalizeFolderPath(payload.dvdPath) : (payload.path ? normalizeFolderPath(payload.path) : '')
          if (dvdPath) {
            cleanTempFiles(dvdPath)
            stopDvdBatchWatcher()
          }
          if (mainWindow) {
            mainWindow.webContents.send('ame:render-complete', { dvdPath, autoStart: false, requireConfirmation: true, ...payload })
            if (dvdPath) {
              mainWindow.webContents.send('titleAutomode:triggered', {
                dvdPath,
                autoStart: false,
                requireConfirmation: true,
                ...payload
              })
            }
          }
          notifyBatchReady(mainWindow, dvdPath, payload.message)
        } catch (e) {
          console.warn('[AME Server] Error parsing ame-render-complete:', e)
        }
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        })
        res.end(JSON.stringify({ success: true }))
      })
    } else if (req.method === 'POST' && req.url === '/encoder-complete') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          const dvdPath = payload.dvdPath ? normalizeFolderPath(payload.dvdPath) : (payload.path ? normalizeFolderPath(payload.path) : '')
          if (dvdPath) {
            cleanTempFiles(dvdPath)
            stopDvdBatchWatcher()
          }
          if (mainWindow) {
            if (dvdPath) {
              mainWindow.webContents.send('titleAutomode:triggered', {
                dvdPath,
                autoStart: false,
                requireConfirmation: true,
                ...payload
              })
            }
            mainWindow.webContents.send('ame:render-complete', { dvdPath, autoStart: false, requireConfirmation: true, ...payload })
          }
          notifyBatchReady(mainWindow, dvdPath, payload.message)
        } catch (e) {
          console.warn('[Encoder-Complete Server] Error parsing:', e)
        }
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        })
        res.end(JSON.stringify({ success: true }))
      })

    } else if (req.method === 'GET' && req.url === '/get-settings') {
      try {
        const allSettings = getAll()
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        })
        res.end(JSON.stringify(allSettings))
      } catch (err) {
        res.writeHead(500, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain'
        })
        res.end('Error retrieving settings: ' + String(err))
      }
    } else if (req.method === 'GET' && req.url === '/tracker-summary') {
      try {
        const summary = getProductionSummary()
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        })
        res.end(JSON.stringify(summary || { success: false, message: 'No production summary available yet' }))
      } catch (err) {
        res.writeHead(500, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        })
        res.end(JSON.stringify({ error: String(err) }))
      }
    } else if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      })
      res.end(JSON.stringify({ status: 'online', app: 'One Tap', version: '26.10.31' }))
    } else if (req.method === 'GET' && req.url === '/final-titles') {
      try {
        const info = getFinalTitlesInfo()
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        })
        res.end(JSON.stringify(info))
      } catch (err) {
        res.writeHead(500, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        })
        res.end(JSON.stringify({ error: String(err) }))
      }
    } else if (req.method === 'POST' && req.url === '/set-final-titles-folder') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}')
          const folder = parsed.folder
          if (folder && fs.existsSync(folder)) {
            const { setAndSave } = require('./core/settingsManager')
            await setAndSave('titles_folder', folder)
            const info = getFinalTitlesInfo(folder)
            res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' })
            res.end(JSON.stringify(info))
          } else {
            res.writeHead(400, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Folder does not exist' }))
          }
        } catch (e: any) {
          res.writeHead(500, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    } else if (req.method === 'POST' && req.url === '/open-final-titles') {
      try {
        const info = getFinalTitlesInfo()
        if (info.folderPath && fs.existsSync(info.folderPath)) {
          shell.openPath(info.folderPath)
          res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, folderPath: info.folderPath }))
        } else {
          res.writeHead(404, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Folder not found' }))
        }
      } catch (e: any) {
        res.writeHead(500, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    } else if (req.method === 'POST' && req.url === '/reveal-file') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}')
          if (parsed.path && fs.existsSync(parsed.path)) {
            shell.showItemInFolder(parsed.path)
            res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true }))
          } else {
            res.writeHead(404, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'File not found' }))
          }
        } catch (e: any) {
          res.writeHead(500, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    } else if (req.method === 'POST' && req.url === '/open-page') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}')
          const targetPage = parsed.page || 'tracker'
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.show()
            mainWindow.focus()
            mainWindow.webContents.send('app:navigate', targetPage)
          }
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          })
          res.end(JSON.stringify({ success: true, navigatedTo: targetPage }))
        } catch (e: any) {
          res.writeHead(400, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          })
          res.end(JSON.stringify({ error: e?.message || 'Invalid JSON' }))
        }
      })
    } else if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      })
      res.end()
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn('Port 49152 is already in use. Premiere Pro extension communication may not be available on this instance.')
    } else {
      console.error('Local server error:', err)
    }
  })

  server.listen(49152, '127.0.0.1', () => {
    console.log('Local server listening on port 49152')
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && (app as any).isQuitting) {
    app.quit()
  }
})

app.on('before-quit', async () => {
  try {
    const sharafSession = session.fromPartition('persist:sharaf_media')
    await sharafSession.cookies.flushStore()
    const googleSession = session.fromPartition('persist:google_apps_script')
    await googleSession.cookies.flushStore()
  } catch (err) {
    console.error('[Session] Error flushing cookies store:', err)
  }
})

app.on('will-quit', () => {
  stopDriveWatcherDaemon()
  globalShortcut.unregisterAll()
})
