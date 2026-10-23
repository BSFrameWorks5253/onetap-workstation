import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { getFfmpegExePath } from '../core/gpuDetector'

type WinGetter = () => BrowserWindow | null

interface RenameRecord {
  timestamp: number
  moves: Array<{ from: string; to: string }>
}

const renameHistory: RenameRecord[] = []

export function cleanPath(p?: unknown): string {
  if (!p) return ''
  // Guard against accidentally receiving an object (e.g. React SyntheticEvent or Promise)
  if (typeof p === 'object') {
    console.warn('[cleanPath] Received object instead of string path:', p)
    return ''
  }
  return String(p).trim().replace(/^["']|["']$/g, '').trim()
}

export function normalizeForMatching(s: string): string {
  return s
    .toLowerCase()
    .replace(/_v$/i, '')
    .replace(/[\s\-_]+/g, '')
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp']
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.mxf', '.m4v', '.wmv', '.ts', '.mts', '.webm', '.flv', '.3gp']

export interface VideoFileInfo {
  fileName: string
  fullPath: string
  dir: string
}

export interface ImageFileInfo {
  fileName: string
  fullPath: string
  dir: string
}

export function resolveVideoFiles(folder: string): { dir: string; videos: VideoFileInfo[] } {
  const clean = cleanPath(folder)
  if (!clean || !fs.existsSync(clean)) return { dir: clean, videos: [] }

  const results: VideoFileInfo[] = []

  // 1. Direct files in the target directory
  try {
    const entries = fs.readdirSync(clean, { withFileTypes: true })
    for (const ent of entries) {
      if (ent.isFile() && VIDEO_EXTS.includes(path.extname(ent.name).toLowerCase())) {
        results.push({
          fileName: ent.name,
          fullPath: path.join(clean, ent.name),
          dir: clean
        })
      }
    }

    // 2. 1-level deep subdirectories (e.g. Title Adder date folders like 1448-03-12_01M)
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const subPath = path.join(clean, ent.name)
        try {
          const subEntries = fs.readdirSync(subPath, { withFileTypes: true })
          for (const subEnt of subEntries) {
            if (subEnt.isFile() && VIDEO_EXTS.includes(path.extname(subEnt.name).toLowerCase())) {
              results.push({
                fileName: subEnt.name,
                fullPath: path.join(subPath, subEnt.name),
                dir: subPath
              })
            }
          }
        } catch {}
      }
    }
  } catch {}

  results.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }))
  return { dir: clean, videos: results }
}

export function resolveImageFiles(folder: string): { dir: string; images: ImageFileInfo[] } {
  const clean = cleanPath(folder)
  if (!clean || !fs.existsSync(clean)) return { dir: clean, images: [] }

  const results: ImageFileInfo[] = []

  // 1. Check Converted_JPEGs subfolder if present
  const convertedDir = path.join(clean, 'Converted_JPEGs')
  if (fs.existsSync(convertedDir)) {
    try {
      const cEntries = fs.readdirSync(convertedDir, { withFileTypes: true })
      for (const ent of cEntries) {
        if (ent.isFile() && IMAGE_EXTS.includes(path.extname(ent.name).toLowerCase())) {
          results.push({
            fileName: ent.name,
            fullPath: path.join(convertedDir, ent.name),
            dir: convertedDir
          })
        }
      }
    } catch {}
  }

  // 2. Direct files in the clean directory
  try {
    const entries = fs.readdirSync(clean, { withFileTypes: true })
    for (const ent of entries) {
      if (ent.isFile() && IMAGE_EXTS.includes(path.extname(ent.name).toLowerCase())) {
        const full = path.join(clean, ent.name)
        if (!results.some(r => r.fullPath.toLowerCase() === full.toLowerCase())) {
          results.push({
            fileName: ent.name,
            fullPath: full,
            dir: clean
          })
        }
      }
    }

    // 3. 1-level deep subdirectories if no images found yet
    if (results.length === 0) {
      for (const ent of entries) {
        if (ent.isDirectory() && ent.name !== 'Converted_JPEGs') {
          const subPath = path.join(clean, ent.name)
          try {
            const subEntries = fs.readdirSync(subPath, { withFileTypes: true })
            for (const subEnt of subEntries) {
              if (subEnt.isFile() && IMAGE_EXTS.includes(path.extname(subEnt.name).toLowerCase())) {
                results.push({
                  fileName: subEnt.name,
                  fullPath: path.join(subPath, subEnt.name),
                  dir: subPath
                })
              }
            }
          } catch {}
        }
      }
    }
  } catch {}

  results.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }))
  return { dir: clean, images: results }
}

export function registerConverterIPC(getWin: WinGetter): void {
  // Action 1 — Convert PNG → JPG using sharp with ffmpeg fallback
  ipcMain.handle('converter:convert', async (_e, params: {
    inputFolder: string
    outputFolder: string
  }) => {
    const results = { done: 0, failed: 0, skipped: 0 }
    const cleanIn = cleanPath(params.inputFolder)
    const cleanOut = cleanPath(params.outputFolder)

    if (!cleanIn || !fs.existsSync(cleanIn)) {
      return { ...results, outputFolder: cleanOut || '' }
    }
    const outDir = cleanOut || path.join(cleanIn, 'Converted_JPEGs')
    fs.mkdirSync(outDir, { recursive: true })

    const files = fs.readdirSync(cleanIn)
      .filter(f => ['.png', '.PNG'].includes(path.extname(f)))

    const ffmpegExe = getFfmpegExePath()

    for (const file of files) {
      const srcPath = path.join(cleanIn, file)
      const dstName = path.basename(file, path.extname(file)) + '.jpg'
      const dstPath = path.join(outDir, dstName)

      let converted = false

      // Try fast native sharp first
      try {
        const sharp = (await import('sharp')).default
        await sharp(srcPath).jpeg({ quality: 92 }).toFile(dstPath)
        converted = true
      } catch (sharpErr) {
        console.warn('[Converter] Sharp conversion failed, falling back to FFmpeg:', sharpErr)
      }

      // Fallback to FFmpeg if sharp fails
      if (!converted) {
        try {
          const { spawnSync } = await import('child_process')
          const r = spawnSync(ffmpegExe, ['-y', '-i', srcPath, '-q:v', '2', dstPath], {
            windowsHide: true
          })
          if (r.status === 0 && fs.existsSync(dstPath)) {
            converted = true
          }
        } catch (ffErr) {
          console.error('[Converter] FFmpeg conversion failed:', ffErr)
        }
      }

      if (converted) {
        try { fs.unlinkSync(srcPath) } catch {}
        results.done++
      } else {
        results.failed++
      }

      const doneTotal = results.done + results.failed
      const percent = files.length > 0 ? Math.round((doneTotal / files.length) * 100) : 0
      const win = getWin()
      win?.setProgressBar(Math.max(0, Math.min(1, doneTotal / (files.length || 1))))
      win?.webContents.send('converter:progress', {
        done: doneTotal,
        total: files.length,
        percent
      })
    }

    getWin()?.setProgressBar(-1)
    return { ...results, outputFolder: outDir }
  })

  // Action 2 — Rename JPEGs to match video filenames (appends _V suffix)
  ipcMain.handle('converter:rename', async (_e, params: {
    jpegFolder: string
    videoFolder: string
  }) => {
    const rawJpeg = cleanPath(params.jpegFolder)
    const rawVideo = cleanPath(params.videoFolder)

    if (!rawJpeg || !rawVideo) {
      return { 
        renamed: 0, 
        total: 0, 
        scannedVideos: 0,
        scannedImages: 0,
        error: 'Please ensure both JPEG Source and Rendered Video Target folders are selected.' 
      }
    }

    if (!fs.existsSync(rawJpeg)) {
      return { 
        renamed: 0, 
        total: 0, 
        scannedVideos: 0,
        scannedImages: 0,
        error: `JPEG Source folder does not exist: "${rawJpeg}"` 
      }
    }

    if (!fs.existsSync(rawVideo)) {
      return { 
        renamed: 0, 
        total: 0, 
        scannedVideos: 0,
        scannedImages: 0,
        error: `Rendered Video Target folder does not exist: "${rawVideo}"` 
      }
    }

    // Auto-resolve image and video files (deep and multi-folder support)
    const resolvedJpeg = resolveImageFiles(rawJpeg)
    const resolvedVideo = resolveVideoFiles(rawVideo)

    if (resolvedVideo.videos.length === 0) {
      return {
        renamed: 0,
        total: 0,
        scannedVideos: 0,
        scannedImages: resolvedJpeg.images.length,
        error: `No video files (.mp4, .mov, etc.) found in "${rawVideo}" or its subfolders.`
      }
    }

    if (resolvedJpeg.images.length === 0) {
      return {
        renamed: 0,
        total: 0,
        scannedVideos: resolvedVideo.videos.length,
        scannedImages: 0,
        error: `No JPG/PNG images found in "${rawJpeg}" or its Converted_JPEGs folder.`
      }
    }

    // Determine candidate images: if an image is in the same directory as a video and already ends with _V,
    // exclude it so it's not reused as an unmatched source photo.
    const candidateImages = resolvedJpeg.images.filter(img => {
      const stem = path.basename(img.fileName, path.extname(img.fileName)).toLowerCase()
      const isAlreadyThumb = stem.endsWith('_v')
      const inVideoDir = resolvedVideo.videos.some(v => v.dir.toLowerCase() === img.dir.toLowerCase())
      return !(isAlreadyThumb && inVideoDir)
    })

    const availablePool = [...candidateImages]
    const matchedPairs: Array<{ video: VideoFileInfo; img: ImageFileInfo; rule: string }> = []

    // Pass 1: Normalized exact stem match (ignores spaces, underscores, hyphens, and casing)
    for (const vid of resolvedVideo.videos) {
      const vidStem = path.basename(vid.fileName, path.extname(vid.fileName))
      const normVid = normalizeForMatching(vidStem)

      const idx = availablePool.findIndex(f => {
        const fStem = path.basename(f.fileName, path.extname(f.fileName))
        const normF = normalizeForMatching(fStem)
        return normF === normVid
      })

      if (idx !== -1) {
        matchedPairs.push({ video: vid, img: availablePool[idx], rule: 'exact-normalized' })
        availablePool.splice(idx, 1)
      }
    }

    // Pass 2: Meaningful token / substring match (e.g. photo is named "_02E-12-10MZ-30310666" or "02E")
    for (const vid of resolvedVideo.videos) {
      if (matchedPairs.some(p => p.video.fullPath === vid.fullPath)) continue
      const vidStem = path.basename(vid.fileName, path.extname(vid.fileName))
      const normVid = normalizeForMatching(vidStem)

      const idx = availablePool.findIndex(f => {
        const fStem = path.basename(f.fileName, path.extname(f.fileName))
        const normF = normalizeForMatching(fStem)
        if (normF.length >= 3 && (normVid.includes(normF) || normF.includes(normVid))) {
          return true
        }
        return false
      })

      if (idx !== -1) {
        matchedPairs.push({ video: vid, img: availablePool[idx], rule: 'token-match' })
        availablePool.splice(idx, 1)
      }
    }

    // Pass 3: Sequential match for remaining unmatched videos (in sorted numeric order)
    for (const vid of resolvedVideo.videos) {
      if (matchedPairs.some(p => p.video.fullPath === vid.fullPath)) continue
      if (availablePool.length > 0) {
        const nextImg = availablePool.shift()!
        matchedPairs.push({ video: vid, img: nextImg, rule: 'sequential' })
      }
    }

    let renamed = 0
    let alreadyOrganized = 0
    const currentMoves: Array<{ from: string; to: string }> = []
    const moveErrors: string[] = []

    for (const pair of matchedPairs) {
      const stem = path.basename(pair.video.fileName, path.extname(pair.video.fileName))
      const targetStem = stem.toLowerCase().endsWith('_v') ? stem : `${stem}_V`
      const srcFile = pair.img.fullPath
      const dstJpeg = path.join(pair.video.dir, targetStem + '.jpg')

      // Safe check: already in destination and correctly named
      if (path.resolve(srcFile).toLowerCase() === path.resolve(dstJpeg).toLowerCase()) {
        alreadyOrganized++
        continue
      }

      try {
        const destDir = path.dirname(dstJpeg)
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true })
        }

        const ext = path.extname(srcFile).toLowerCase()
        if (ext === '.png') {
          // If source is a PNG, convert on the fly to JPEG using sharp
          const sharp = (await import('sharp')).default
          await sharp(srcFile).jpeg({ quality: 92 }).toFile(dstJpeg)
        } else {
          fs.copyFileSync(srcFile, dstJpeg)
        }

        renamed++
        currentMoves.push({ from: srcFile, to: dstJpeg })

        try {
          fs.unlinkSync(srcFile)
        } catch (unlinkErr) {
          console.warn('[Converter] Could not remove source file after moving (may be locked):', srcFile, unlinkErr)
        }
      } catch (err: any) {
        console.error('[Converter] Failed to move:', srcFile, '->', dstJpeg, err)
        moveErrors.push(`${pair.img.fileName}: ${err?.message || err}`)
      }
    }

    if (currentMoves.length > 0) {
      renameHistory.push({
        timestamp: Date.now(),
        moves: currentMoves
      })
    }

    return { 
      renamed, 
      total: matchedPairs.length,
      scannedVideos: resolvedVideo.videos.length,
      scannedImages: resolvedJpeg.images.length,
      alreadyOrganized,
      errors: moveErrors,
      error: moveErrors.length > 0 ? moveErrors.join('; ') : undefined,
      videoDir: resolvedVideo.dir,
      jpegDir: resolvedJpeg.dir
    }
  })

  // Action 2b — Undo Last Rename & Move
  ipcMain.handle('converter:undoRename', async () => {
    const last = renameHistory.pop()
    if (!last || !last.moves || last.moves.length === 0) {
      return { success: false, undone: 0, total: 0, error: 'No rename operation to undo' }
    }

    let undone = 0
    for (const move of last.moves) {
      try {
        if (fs.existsSync(move.to)) {
          const parentDir = path.dirname(move.from)
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true })
          }
          fs.copyFileSync(move.to, move.from)
          fs.unlinkSync(move.to)
          undone++
        }
      } catch (e) {
        console.error('[Converter] Failed to undo move:', move, e)
      }
    }

    return { success: true, undone, total: last.moves.length }
  })

  // Check if undo is available
  ipcMain.handle('converter:canUndo', async () => {
    return renameHistory.length > 0
  })

  // Action 3 — List files for the preview box
  ipcMain.handle('converter:listFiles', async (_e, params: {
    jpegFolder?: string
    videoFolder?: string
  }) => {
    let images: string[] = []
    let videos: string[] = []
    let resolvedJpegDir = ''
    let resolvedVideoDir = ''

    if (params.jpegFolder) {
      const res = resolveImageFiles(params.jpegFolder)
      images = res.images.map(i => i.fileName)
      resolvedJpegDir = res.dir
    }

    if (params.videoFolder) {
      const res = resolveVideoFiles(params.videoFolder)
      videos = res.videos.map(v => v.fileName)
      resolvedVideoDir = res.dir
    }

    return { images, videos, jpegDir: resolvedJpegDir, videoDir: resolvedVideoDir }
  })
}
