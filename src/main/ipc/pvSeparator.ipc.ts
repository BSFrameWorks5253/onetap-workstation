/**
 * ====================================================================
 * PV SEPARATOR IPC HANDLER (pvSeparator.ipc.ts)
 * ====================================================================
 * Main Process IPC Backend for:
 * 1. Ultra-fast Photo (P) vs Video (V) file classification, separation, and organization.
 * 2. Multi-threaded directory scanning and format categorization across RAW, raster images, and video containers.
 * 3. File moving/copying with conflict handling and folder hierarchy preservation.
 * ====================================================================
 */

import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'

const PHOTO_EXTENSIONS = new Set([
  // RAW formats
  '.cr2', '.cr3', '.crw', '.arw', '.nef', '.nrw', '.srf', '.sr2', '.dng',
  '.rw2', '.orf', '.gpr', '.pef', '.raf', '.rwl', '.srw', '.3fr', '.fff',
  '.iiq', '.k25', '.kdc', '.bay', '.erf', '.mef', '.mos', '.mrw', '.ptx',
  '.pxn', '.raw',
  // Raster & Web formats
  '.jpg', '.jpeg', '.jpe', '.png', '.heic', '.heif', '.hif', '.webp',
  '.tif', '.tiff', '.bmp', '.dib', '.gif', '.avif', '.jp2', '.j2k',
  '.jpf', '.jpx', '.jpm', '.mj2'
])

const VIDEO_EXTENSIONS = new Set([
  '.mov', '.mp4', '.mts', '.m4v', '.mkv', '.avi', '.flv', '.webm',
  '.wmv', '.3gp', '.mxf', '.mpg', '.mpeg', '.m2ts', '.ts', '.dv',
  '.r3d', '.braw', '.mpv', '.m2v', '.vob', '.ogv'
])

const AUDIO_EXTENSIONS = new Set([
  '.wav', '.mp3', '.aac', '.flac', '.ogg', '.wma', '.m4a', '.aif', '.aiff', '.opus'
])

const PHOTO_SIDECAR_EXTENSIONS = new Set(['.xmp', '.aae', '.nksc', '.cos'])
const VIDEO_SIDECAR_EXTENSIONS = new Set(['.xml', '.srt', '.thm', '.vtt'])
const AUDIO_SIDECAR_EXTENSIONS = new Set(['.pkf'])

const ALL_SIDECAR_EXTENSIONS = new Set([
  ...PHOTO_SIDECAR_EXTENSIONS,
  ...VIDEO_SIDECAR_EXTENSIONS,
  ...AUDIO_SIDECAR_EXTENSIONS
])

const SKIP_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])

export type FileType = 'photo' | 'video' | 'audio' | 'misc'

export interface ScannedFileInfo {
  abs_path: string
  event_folder: string
  rel_within_event: string
  ext: string
  type: FileType
  size: number
}

export interface ScanCache {
  source_dir: string
  event_folders: string[]
  all_files: ScannedFileInfo[]
  photo_bytes: number
}

let activeScanCache: ScanCache | null = null

function classifyFile(filePath: string, ext: string, stemToMediaMap: Record<string, FileType>): FileType {
  if (PHOTO_EXTENSIONS.has(ext)) return 'photo'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio'

  if (ALL_SIDECAR_EXTENSIONS.has(ext)) {
    const stem = path.basename(filePath, ext).toLowerCase()
    const parentType = stemToMediaMap[stem]
    if (parentType) return parentType
    if (PHOTO_SIDECAR_EXTENSIONS.has(ext)) return 'photo'
    if (VIDEO_SIDECAR_EXTENSIONS.has(ext)) return 'video'
    if (AUDIO_SIDECAR_EXTENSIONS.has(ext)) return 'audio'
  }

  return 'misc'
}

const createdDirs = new Set<string>()
const dirCreationPromises = new Map<string, Promise<void>>()

async function ensureDirAsync(dstDir: string): Promise<void> {
  if (createdDirs.has(dstDir)) return
  let p = dirCreationPromises.get(dstDir)
  if (!p) {
    p = fs.promises.mkdir(dstDir, { recursive: true })
      .then(() => {
        createdDirs.add(dstDir)
        dirCreationPromises.delete(dstDir)
      })
      .catch((err) => {
        dirCreationPromises.delete(dstDir)
        throw err
      })
    dirCreationPromises.set(dstDir, p)
  }
  await p
}

async function walkDirFastAsync(
  sourceDir: string,
  sanitizedMainFolderName: string,
  onFileFound: (info: ScannedFileInfo) => void
): Promise<void> {
  const dirQueue: string[] = [sourceDir]
  const DIR_CONCURRENCY = 16
  let activeWorkers = 0

  return new Promise((resolve) => {
    function processNextDir() {
      while (activeWorkers < DIR_CONCURRENCY && dirQueue.length > 0) {
        const currentDir = dirQueue.shift()!
        activeWorkers++

        fs.promises.readdir(currentDir, { withFileTypes: true })
          .then(async (entries) => {
            const subDirs: string[] = []
            const fileEntries: fs.Dirent[] = []
            const stemMap: Record<string, FileType> = {}

            // Single pass in-memory: collect media stems & find subdirs
            for (const ent of entries) {
              if (ent.name.startsWith('.') || SKIP_FILES.has(ent.name.toLowerCase())) continue
              if (ent.isDirectory()) {
                subDirs.push(path.join(currentDir, ent.name))
              } else if (ent.isFile()) {
                fileEntries.push(ent)
                const ext = path.extname(ent.name).toLowerCase()
                const stem = path.basename(ent.name, ext).toLowerCase()
                if (PHOTO_EXTENSIONS.has(ext)) {
                  stemMap[stem] = 'photo'
                } else if (VIDEO_EXTENSIONS.has(ext)) {
                  stemMap[stem] = 'video'
                } else if (AUDIO_EXTENSIONS.has(ext)) {
                  stemMap[stem] = 'audio'
                }
              }
            }

            if (subDirs.length > 0) {
              dirQueue.push(...subDirs)
            }

            // Parallel async stat for file entries in this directory
            if (fileEntries.length > 0) {
              await Promise.all(
                fileEntries.map(async (ent) => {
                  const filePath = path.join(currentDir, ent.name)
                  const ext = path.extname(ent.name).toLowerCase()
                  const fileType = classifyFile(filePath, ext, stemMap)
                  let fsize = 0
                  try {
                    const st = await fs.promises.stat(filePath)
                    fsize = st.size
                  } catch {
                    fsize = 0
                  }

                  const relFromSource = path.relative(sourceDir, filePath)
                  const parts = relFromSource.split(path.sep)
                  const eventFolder = parts.length > 1 ? parts[0] : sanitizedMainFolderName

                  onFileFound({
                    abs_path: filePath,
                    event_folder: eventFolder,
                    rel_within_event: relFromSource,
                    ext,
                    type: fileType,
                    size: fsize
                  })
                })
              )
            }
          })
          .catch(() => {
            // Ignore unreadable directory
          })
          .finally(() => {
            activeWorkers--
            if (activeWorkers === 0 && dirQueue.length === 0) {
              resolve()
            } else {
              processNextDir()
            }
          })
      }
    }

    processNextDir()
  })
}

const LARGE_FILE_THRESHOLD = 8 * 1024 * 1024 // 8 MB
const COPY_BUFFER_SIZE = 16 * 1024 * 1024 // 16 MB high-watermark stream buffer

async function copyLargeFileStream(src: string, dst: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const readable = fs.createReadStream(src, { highWaterMark: COPY_BUFFER_SIZE })
    const writable = fs.createWriteStream(dst, { highWaterMark: COPY_BUFFER_SIZE })

    readable.on('error', reject)
    writable.on('error', reject)
    writable.on('finish', resolve)

    readable.pipe(writable)
  })
}

async function fastTransferFile(
  src: string,
  dst: string,
  action: 'copy' | 'move',
  fileSize: number
): Promise<void> {
  const dstDir = path.dirname(dst)
  await ensureDirAsync(dstDir)

  if (action === 'move') {
    try {
      // Instant path: Same-volume atomic filesystem rename (0 bytes copied, instant)
      await fs.promises.rename(src, dst)
      return
    } catch {
      // Fallback for cross-device moves (EXDEV)
    }
  }

  // Fast copy strategy: Stream files >= 8 MB with 16MB high-watermark buffer for peak throughput
  if (fileSize >= LARGE_FILE_THRESHOLD) {
    try {
      await copyLargeFileStream(src, dst)
    } catch {
      await fs.promises.copyFile(src, dst)
    }
  } else {
    await fs.promises.copyFile(src, dst)
  }

  // If move mode fell back to cross-device copy, remove source file
  if (action === 'move') {
    try {
      await fs.promises.unlink(src)
    } catch {
      // Ignore unlink error
    }
  }
}

async function removeEmptyDirsAsync(dir: string, stopAtDir: string): Promise<void> {
  if (!fs.existsSync(dir)) return
  let entries: fs.Dirent[] = []
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      await removeEmptyDirsAsync(path.join(dir, ent.name), stopAtDir)
    }
  }
  try {
    let remaining = await fs.promises.readdir(dir)

    if (remaining.length > 0) {
      const nonJunk = remaining.filter(name => !SKIP_FILES.has(name.toLowerCase()) && !name.startsWith('.'))
      if (nonJunk.length === 0) {
        for (const f of remaining) {
          try {
            await fs.promises.unlink(path.join(dir, f))
          } catch {
            // Ignore unlink error
          }
        }
        remaining = await fs.promises.readdir(dir)
      }
    }

    if (remaining.length === 0 && path.resolve(dir) !== path.resolve(stopAtDir)) {
      await fs.promises.rmdir(dir)
    }
  } catch {
    // Ignore rmdir error
  }
}

export function registerPVSeparatorIPC(): void {
  ipcMain.handle('pvSeparator:scanFolder', async (_event, sourceDir: string) => {
    try {
      if (!sourceDir || !fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
        return { error: 'Source directory does not exist.' }
      }

      let entries: fs.Dirent[] = []
      try {
        entries = await fs.promises.readdir(sourceDir, { withFileTypes: true })
      } catch (err: any) {
        return { error: `Failed to read directory: ${err.message}` }
      }

      const subDirs: string[] = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

      const mainFolderName = path.basename(sourceDir)
      const sanitizedMainFolderName = (!mainFolderName || mainFolderName.endsWith(':')) ? 'Source' : mainFolderName
      const eventFolders = subDirs.length > 0 ? subDirs : [sanitizedMainFolderName]

      const allFiles: ScannedFileInfo[] = []
      const photoExts: Record<string, number> = {}
      const videoExts: Record<string, number> = {}
      const audioExts: Record<string, number> = {}
      const miscExts: Record<string, number> = {}
      let totalPhotos = 0
      let totalVideos = 0
      let totalAudio = 0
      let totalMisc = 0
      let photoBytes = 0

      // High-speed parallel single-pass directory traversal
      await walkDirFastAsync(sourceDir, sanitizedMainFolderName, (finfo) => {
        allFiles.push(finfo)

        const extDisplay = finfo.ext || '.no_ext'
        if (finfo.type === 'photo') {
          photoExts[extDisplay] = (photoExts[extDisplay] || 0) + 1
          totalPhotos++
          photoBytes += finfo.size
        } else if (finfo.type === 'video') {
          videoExts[extDisplay] = (videoExts[extDisplay] || 0) + 1
          totalVideos++
        } else if (finfo.type === 'audio') {
          audioExts[extDisplay] = (audioExts[extDisplay] || 0) + 1
          totalAudio++
        } else {
          miscExts[extDisplay] = (miscExts[extDisplay] || 0) + 1
          totalMisc++
        }
      })

      if (allFiles.length === 0) {
        return { error: 'No files found in the source directory.' }
      }

      activeScanCache = {
        source_dir: sourceDir,
        event_folders: eventFolders,
        all_files: allFiles,
        photo_bytes: photoBytes
      }

      return {
        total_files: allFiles.length,
        total_photos: totalPhotos,
        total_videos: totalVideos,
        total_audio: totalAudio,
        total_misc: totalMisc,
        photo_bytes: photoBytes,
        photo_exts: photoExts,
        video_exts: videoExts,
        audio_exts: audioExts,
        misc_exts: miscExts,
        event_folders: eventFolders
      }
    } catch (err: any) {
      return { error: err.message || String(err) }
    }
  })

  ipcMain.handle('pvSeparator:startProcessing', async (event, payload: { sourceDir: string; destDir: string; action: 'copy' | 'move' }) => {
    const { sourceDir, destDir, action } = payload
    if (!activeScanCache || activeScanCache.source_dir !== sourceDir) {
      return { error: 'No scan data. Please scan files first.' }
    }

    const photoFiles = activeScanCache.all_files.filter(f => f.type === 'photo')
    const totalPhotoCount = photoFiles.length

    if (totalPhotoCount === 0) {
      return { error: 'No photo files found to process.' }
    }

    const totalBytes = photoFiles.reduce((acc, f) => acc + f.size, 0)
    const photoRoot = path.join(destDir, 'Photo Data')
    const rawMainFolderName = path.basename(sourceDir)
    const mainFolderName = (!rawMainFolderName || rawMainFolderName.endsWith(':')) ? '' : rawMainFolderName

    const actionVerb = action === 'copy' ? 'Copying' : 'Moving'

    let copiedBytes = 0
    let completedCount = 0
    let errorCount = 0
    const processedPhotoPaths: string[] = []

    const startTime = Date.now()
    let lastProgressTime = 0

    const sendProgress = (current: number, total: number, label = '', logEntry?: string, logType = 'info', speedMbps = 0, etaSec = 0) => {
      try {
        event.sender.send('pvSeparator:progress', {
          current,
          total,
          label,
          speed_mbps: speedMbps,
          eta_sec: etaSec,
          copied_bytes: copiedBytes,
          total_bytes: totalBytes,
          log_entry: logEntry,
          log_type: logType
        })
      } catch {
        // Ignore send errors
      }
    }

    sendProgress(0, totalPhotoCount, `Extracting photo data...`, `Started high-speed ${actionVerb}`, 'info')

    // Detect volume root to optimize concurrency
    const srcRoot = path.parse(sourceDir).root.toLowerCase()
    const destRoot = path.parse(destDir).root.toLowerCase()
    const isSameVolume = srcRoot === destRoot

    // Dynamic volume-aware worker queue:
    // 128 workers for same-volume instant atomic rename (0 bytes copied)
    // 32 workers for same-volume copy
    // 16 workers for cross-volume hardware transfers (saturates NVMe/USB3 while preventing HDD head thrashing)
    const CONCURRENCY = isSameVolume ? (action === 'move' ? 128 : 32) : 16
    let queueIndex = 0
    let activeWorkers = 0

    return new Promise<any>((resolve) => {
      const processNext = () => {
        while (activeWorkers < CONCURRENCY && queueIndex < photoFiles.length) {
          const finfo = photoFiles[queueIndex++]
          activeWorkers++

          const absPath = finfo.abs_path
          const relFromSource = path.relative(sourceDir, absPath)
          const photoDest = mainFolderName
            ? path.join(photoRoot, mainFolderName, relFromSource)
            : path.join(photoRoot, relFromSource)

          fastTransferFile(absPath, photoDest, action, finfo.size)
            .then(() => {
              copiedBytes += finfo.size
              completedCount++
              processedPhotoPaths.push(absPath)
            })
            .catch((err: any) => {
              errorCount++
              const relShort = path.relative(sourceDir, absPath)
              sendProgress(
                completedCount,
                totalPhotoCount,
                `${actionVerb} photos...`,
                `${relShort} — ${err.message || String(err)}`,
                'error'
              )
            })
            .finally(() => {
              activeWorkers--
              const now = Date.now()
              const totalProcessed = completedCount + errorCount
              if (now - lastProgressTime > 40 || totalProcessed === totalPhotoCount) {
                lastProgressTime = now
                const elapsedSec = Math.max(0.001, (now - startTime) / 1000)
                const speedMbps = Math.round(((copiedBytes / (1024 * 1024)) / elapsedSec) * 10) / 10
                const remainingBytes = Math.max(0, totalBytes - copiedBytes)
                const bytesPerSec = elapsedSec > 0 ? copiedBytes / elapsedSec : 1
                const etaSec = bytesPerSec > 0 ? Math.ceil(remainingBytes / bytesPerSec) : 0

                sendProgress(
                  totalProcessed,
                  totalPhotoCount,
                  `${actionVerb} photos... (${speedMbps} MB/s)`,
                  undefined,
                  'info',
                  speedMbps,
                  etaSec
                )
              }

              if (activeWorkers === 0 && queueIndex >= photoFiles.length) {
                finishProcessing()
              } else {
                processNext()
              }
            })
        }
      }

      const finishProcessing = async () => {
        const totalElapsedSec = Math.max(0.001, (Date.now() - startTime) / 1000)
        const avgSpeedMbps = Math.round(((totalBytes / (1024 * 1024)) / totalElapsedSec) * 10) / 10

        if (action === 'move') {
          await removeEmptyDirsAsync(sourceDir, sourceDir)
        }

        const doneMsg = `Complete! Processed ${completedCount} photos in ${totalElapsedSec.toFixed(1)}s (Avg ${avgSpeedMbps} MB/s, ${errorCount} errors)`
        sendProgress(
          totalPhotoCount,
          totalPhotoCount,
          'Complete!',
          doneMsg,
          'success',
          avgSpeedMbps,
          0
        )

        resolve({
          success_count: completedCount,
          error_count: errorCount,
          elapsed_sec: Math.round(totalElapsedSec * 10) / 10,
          avg_speed_mbps: avgSpeedMbps
        })
      }

      processNext()
    })
  })
}
