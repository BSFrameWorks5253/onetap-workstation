import { BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import sharp from 'sharp'
import { get, setAndSave } from './settingsManager'
import { getFfmpegExePath } from './gpuDetector'

type WinGetter = () => BrowserWindow | null
let mainWindowRef: WinGetter = () => null
let fsWatcher: fs.FSWatcher | null = null
let autoRestartTimer: NodeJS.Timeout | null = null
const processingFiles = new Set<string>()

export function initWatcher(getWin: WinGetter): void {
  mainWindowRef = getWin
}

/**
 * Intelligent directory resolver that discovers the screenshots folder across multiple sources
 */
export function resolveWatchDirectory(): string {
  const custom = (get('watcher_input_folder', '') as string)?.trim()
  if (custom && fs.existsSync(custom)) return custom

  // 1. Fallback: converter_input
  const convIn = (get('converter_input', '') as string)?.trim()
  if (convIn && fs.existsSync(convIn)) return convIn

  // 2. Fallback: screenshot_folder
  const ssDir = (get('screenshot_folder', '') as string)?.trim()
  if (ssDir && fs.existsSync(ssDir)) return ssDir

  // 3. Fallback: converter_jpeg parent directory (e.g. .../Screenshots/Converted_JPEGs -> .../Screenshots)
  const convJpeg = (get('converter_jpeg', '') as string)?.trim()
  if (convJpeg) {
    const parent = path.dirname(convJpeg)
    if (parent && fs.existsSync(parent) && parent !== convJpeg) return parent
  }

  // 4. Fallback: Windows Standard Screenshots Folders
  try {
    const home = os.homedir()
    const oneDriveScreenshots = path.join(home, 'OneDrive', 'Pictures', 'Screenshots')
    if (fs.existsSync(oneDriveScreenshots)) return oneDriveScreenshots

    const localScreenshots = path.join(home, 'Pictures', 'Screenshots')
    if (fs.existsSync(localScreenshots)) return localScreenshots
  } catch {}

  return ''
}

/**
 * Scan directory immediately on launch to process any pending PNGs
 */
async function scanAndProcessExisting(watchDir: string, outDir: string): Promise<void> {
  try {
    if (!fs.existsSync(watchDir)) return
    const files = await fs.promises.readdir(watchDir)
    for (const f of files) {
      if (path.extname(f).toLowerCase() === '.png') {
        const fullSrc = path.join(watchDir, f)
        if (!processingFiles.has(fullSrc)) {
          processingFiles.add(fullSrc)
          processFile(fullSrc, outDir, f).finally(() => {
            processingFiles.delete(fullSrc)
          })
        }
      }
    }
  } catch (err) {
    console.error('[Folder Watcher] Error scanning existing files:', err)
  }
}

export function startWatcher(): void {
  try {
    stopWatcher()

    const enabled = (get('watcher_enabled', true) as boolean) !== false
    let watchDir = resolveWatchDirectory()
    let outDir = (get('converter_jpeg', '') as string)?.trim()

    console.log('[Folder Watcher] Checking watcher settings:', { enabled, watchDir, outDir })

    if (!enabled || !watchDir) {
      console.log('[Folder Watcher] Watcher disabled or input folder could not be resolved.')
      return
    }

    if (!fs.existsSync(watchDir)) {
      console.warn(`[Folder Watcher] Watch directory does not exist: ${watchDir}`)
      return
    }

    // Persist discovered watchDir into settings if not explicitly saved
    const currentSaved = (get('watcher_input_folder', '') as string)?.trim()
    if (watchDir && currentSaved !== watchDir) {
      try {
        setAndSave('watcher_input_folder', watchDir)
      } catch {}
    }

    // If no dedicated output directory configured, default to a 'Converted_JPEGs' subfolder inside watchDir
    if (!outDir) {
      outDir = path.join(watchDir, 'Converted_JPEGs')
      try {
        setAndSave('converter_jpeg', outDir)
      } catch {}
    }

    // Ensure output directory exists
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }

    console.log(`[Folder Watcher] Active and monitoring: "${watchDir}" -> Output: "${outDir}"`)

    // Sweep existing PNGs right now so nothing is missed
    scanAndProcessExisting(watchDir, outDir)

    // Start robust watcher
    fsWatcher = fs.watch(watchDir, { persistent: true }, async (_eventType, filename) => {
      if (!filename) return
      
      const ext = path.extname(filename).toLowerCase()
      if (ext !== '.png') return

      const srcPath = path.join(watchDir, filename)
      
      // Prevent duplicate simultaneous processing of the same file
      if (processingFiles.has(srcPath)) return
      processingFiles.add(srcPath)

      console.log(`[Folder Watcher] Event detected for PNG: ${filename}`)

      // Convert asynchronously
      processFile(srcPath, outDir, filename).finally(() => {
        // Keep in set for 500ms debounce to ignore trailing change events
        setTimeout(() => {
          processingFiles.delete(srcPath)
        }, 500)
      })
    })

    // Handle unexpected watcher errors to prevent unhandled crashes
    fsWatcher.on('error', (err) => {
      console.error('[Folder Watcher] Watcher runtime error:', err)
      scheduleAutoRestart()
    })

    fsWatcher.on('close', () => {
      console.log('[Folder Watcher] Watcher handle closed.')
    })

  } catch (e) {
    console.error('[Folder Watcher] Failed to start watcher:', e)
    scheduleAutoRestart()
  }
}

function scheduleAutoRestart(): void {
  if (autoRestartTimer) clearTimeout(autoRestartTimer)
  autoRestartTimer = setTimeout(() => {
    const enabled = (get('watcher_enabled', true) as boolean) !== false
    const watchDir = resolveWatchDirectory()
    if (enabled && watchDir && fs.existsSync(watchDir)) {
      console.log('[Folder Watcher] Auto-recovering folder watcher...')
      startWatcher()
    }
  }, 2500)
}

/**
 * Fast asynchronous file conversion engine
 * Uses sharp (native libvips) for ~10ms high-quality conversion with ffmpeg fallback.
 */
async function processFile(srcPath: string, outDir: string, filename: string): Promise<void> {
  // Wait briefly for file write lock release (e.g. while Windows screenshot or exporter finishes writing)
  let isReady = false
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      if (!fs.existsSync(srcPath)) {
        return
      }
      const stat = await fs.promises.stat(srcPath)
      if (stat.size > 0) {
        // Verify read handle can be acquired
        const handle = await fs.promises.open(srcPath, 'r')
        await handle.close()
        isReady = true
        break
      }
    } catch {
      // File still locked by writing process
    }
    await new Promise(r => setTimeout(r, 40)) // 40ms interval = max 480ms
  }

  if (!isReady || !fs.existsSync(srcPath)) {
    console.warn(`[Folder Watcher] Source file not accessible or removed: ${srcPath}`)
    return
  }

  const baseName = path.basename(filename, path.extname(filename))
  const dstName = `${baseName}.jpg`
  const dstPath = path.join(outDir, dstName)

  console.log(`[Folder Watcher] Instantly converting ${filename} -> ${dstName}`)

  let converted = false

  // 1. Primary Engine: High-performance Sharp (native C++ libvips, ~10ms execution)
  try {
    await sharp(srcPath)
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
        mozjpeg: false
      })
      .toFile(dstPath)

    converted = true
  } catch (sharpErr) {
    console.warn(`[Folder Watcher] Sharp conversion warning for ${filename}:`, sharpErr)
  }

  // 2. Secondary Fallback: FFmpeg (if sharp encounters an anomalous image format)
  if (!converted) {
    try {
      const ffmpegExe = getFfmpegExePath()
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(ffmpegExe, ['-y', '-i', srcPath, '-q:v', '2', dstPath], {
          windowsHide: true,
          stdio: 'ignore'
        })
        proc.on('close', (code) => {
          if (code === 0 && fs.existsSync(dstPath)) resolve()
          else reject(new Error(`FFmpeg exited with code ${code}`))
        })
        proc.on('error', reject)
      })
      converted = true
    } catch (ffmpegErr) {
      console.error(`[Folder Watcher] All conversion engines failed for ${filename}:`, ffmpegErr)
    }
  }

  if (converted && fs.existsSync(dstPath)) {
    console.log(`[Folder Watcher] Conversion successful: ${dstName}`)

    // Delete source PNG file cleanly
    try {
      if (fs.existsSync(srcPath)) {
        await fs.promises.unlink(srcPath)
      }
    } catch (delErr) {
      console.warn(`[Folder Watcher] Could not delete original PNG: ${srcPath}`, delErr)
    }

    // Notify renderer via IPC
    const win = mainWindowRef()
    if (win && !win.isDestroyed()) {
      win.webContents.send('watcher:converted', {
        fileName: dstName,
        filePath: dstPath
      })
    }
  }
}

export function stopWatcher(): void {
  if (autoRestartTimer) {
    clearTimeout(autoRestartTimer)
    autoRestartTimer = null
  }
  if (fsWatcher) {
    try {
      fsWatcher.close()
    } catch {}
    fsWatcher = null
    console.log('[Folder Watcher] Watcher stopped.')
  }
}
