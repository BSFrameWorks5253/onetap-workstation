/**
 * ====================================================================
 * VIDEO TRANSFER IPC HANDLER (videoTransfer.ipc.ts)
 * Main Process IPC Handler for Video & Photo Date Folder Matching & Transfer
 * Dual Folder Mode: Video Folder + Photo Folder
 * ====================================================================
 */

import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'

const VIDEO_EXTS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts', '.mxf', '.wmv',
  '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.mod', '.tod'
])

const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.thm', '.bmp', '.tiff', '.tif', '.heic', '.avif', '.gif'
])

const normalizeKey = (s: string) => s.toLowerCase().replace(/[\s-_]+/g, ' ').trim()

export interface ParsedSeqName {
  raw: string
  cleanName: string
  sequence: string
  namePart: string
  prefix: string
}

export function parseSequenceName(rawName: string): ParsedSeqName {
  const ext = path.extname(rawName)
  const nameWithoutExt = ext ? path.basename(rawName, ext).trim() : rawName.trim()

  const seqMatch = nameWithoutExt.match(/^(\d+)\s*[-_]?\s*([A-Za-z]+.*)$/)
  
  let sequence = ''
  let namePart = nameWithoutExt
  let prefix = ''

  if (seqMatch) {
    sequence = seqMatch[1]
    namePart = seqMatch[2].trim()
  } else {
    const numOnly = nameWithoutExt.match(/\d+/)
    if (numOnly) sequence = numOnly[0]
  }

  const pfxMatch = namePart.match(/^([A-Za-z]+)/)
  if (pfxMatch) {
    prefix = pfxMatch[1].toUpperCase()
  }

  return {
    raw: rawName,
    cleanName: nameWithoutExt,
    sequence,
    namePart,
    prefix
  }
}

/**
 * Extracts the core camera/shot code from a file or folder name,
 * explicitly ignoring leading sequence numbers (e.g. "001 Z01.mp4" or "005 Z01" -> "z01").
 */
export function getShotCode(rawName: string): string {
  const ext = path.extname(rawName)
  const nameWithoutExt = ext ? path.basename(rawName, ext).trim() : rawName.trim()

  // Strip leading digits followed by separator and text (e.g. "001 Z01" -> "Z01", "005_Z01" -> "Z01")
  const leadingSeqMatch = nameWithoutExt.match(/^(\d+)[\s-_]+([A-Za-z0-9].*)$/)
  let coreName = nameWithoutExt
  if (leadingSeqMatch && leadingSeqMatch[2]) {
    coreName = leadingSeqMatch[2].trim()
  }

  return coreName.toLowerCase().replace(/[\s-_]+/g, ' ').trim()
}

/**
 * Finds matching video thumbnail (_V.jpg) in the video folder
 */
export function findVideoThumbnail(videoPath: string): { path: string; name: string } | undefined {
  const dir = path.dirname(videoPath)
  // Use lowercase ONLY for comparison — never for constructing file names
  const vidStem = path.basename(videoPath, path.extname(videoPath)).toLowerCase().trim()
  const baseNoSuffix = vidStem.replace(/_v$/, '').replace(/_p$/, '').trim()
  const vidShot = getShotCode(path.basename(videoPath))

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const ent of entries) {
      if (!ent.isFile()) continue
      const ext = path.extname(ent.name).toLowerCase()
      if (!IMAGE_EXTS.has(ext)) continue

      // Compare lowercase, but always return the ORIGINAL ent.name to preserve case
      const nameLower = ent.name.toLowerCase()
      const entStem = path.basename(ent.name, ext).toLowerCase().trim()
      const entShot = getShotCode(ent.name)

      if (nameLower.endsWith('_v.jpg') || nameLower.endsWith('_v.png') || nameLower.endsWith('_v.jpeg')) {
        if (entShot === vidShot || entStem.startsWith(baseNoSuffix)) {
          const p = path.join(dir, ent.name)  // ent.name = original case
          return { path: p, name: ent.name }
        }
      }
      if (entShot === vidShot || entStem === vidStem) {
        const p = path.join(dir, ent.name)  // ent.name = original case
        return { path: p, name: ent.name }
      }
    }
  } catch {}

  return undefined
}

/**
 * Finds matching photo thumbnail (_P.jpg) in photo subfolder or video directory.
 * IMPORTANT: Always returns ent.name from readdirSync to preserve exact original case.
 */
export function findPhotoThumbnail(photoFolderPath: string, videoPath?: string): { path: string; name: string } | undefined {
  if (photoFolderPath && fs.existsSync(photoFolderPath)) {
    try {
      const entries = fs.readdirSync(photoFolderPath, { withFileTypes: true })
      // First pass: look for _P.jpg thumbnails by suffix only (return original ent.name)
      for (const ent of entries) {
        if (!ent.isFile()) continue
        const ext = path.extname(ent.name).toLowerCase()
        if (!IMAGE_EXTS.has(ext)) continue
        const nameLower = ent.name.toLowerCase()
        if (nameLower.endsWith('_p.jpg') || nameLower.endsWith('_p.png') || nameLower.endsWith('_p.jpeg')) {
          return { path: path.join(photoFolderPath, ent.name), name: ent.name }
        }
      }
    } catch {}
  }

  if (videoPath) {
    const vDir = path.dirname(videoPath)
    const vShot = getShotCode(videoPath)
    const vStemLower = path.basename(videoPath, path.extname(videoPath)).toLowerCase().trim()
    const vBaseNoSuffix = vStemLower.replace(/_v$/, '').replace(/_p$/, '').trim()
    try {
      const vEntries = fs.readdirSync(vDir, { withFileTypes: true })
      for (const ent of vEntries) {
        if (!ent.isFile()) continue
        const ext = path.extname(ent.name).toLowerCase()
        if (!IMAGE_EXTS.has(ext)) continue
        // Compare lowercase only; return original ent.name to preserve case
        const nameLower = ent.name.toLowerCase()
        const entShot = getShotCode(ent.name)
        if ((nameLower.endsWith('_p.jpg') || nameLower.endsWith('_p.png') || nameLower.endsWith('_p.jpeg')) &&
            (entShot === vShot || nameLower.startsWith(vBaseNoSuffix))) {
          return { path: path.join(vDir, ent.name), name: ent.name }
        }
      }
    } catch {}
  }

  return undefined
}

export function findMatchingThumbnailFile(videoPath: string): string | undefined {
  const v = findVideoThumbnail(videoPath)
  return v?.path
}

export interface MatchItem {
  id: string
  videoPath?: string
  videoName?: string
  thumbnailPath?: string
  thumbnailName?: string
  videoThumbnailPath?: string
  videoThumbnailName?: string
  photoThumbnailPath?: string
  photoThumbnailName?: string
  photoFolderPath?: string
  photoFolderName?: string
  dateFolderName: string
  sequence: string
  prefix: string
  namePart: string
  reason?: string
  status: 'APPROVED' | 'MISMATCH' | 'IGNORED'
  isMatched: boolean
}

export function stripVideoSuffix(rawName: string): string {
  const ext = path.extname(rawName)
  let stem = ext ? path.basename(rawName, ext).trim() : rawName.trim()

  // Remove suffixes like -ITS_V, _ITS_V, -ITS_P, _ITS_P, _V, _v, -V, -v, _P, _p, -P, -p
  stem = stem.replace(/[-_]its[-_][vp]$/i, '')
             .replace(/[-_][vp]$/i, '')
             .trim()

  return stem
}

export function extractItemCode(rawName: string): string {
  const ext = path.extname(rawName)
  let name = ext ? path.basename(rawName, ext) : rawName

  // Remove _V, _P, -ITS_V, -ITS_P suffixes
  name = name.replace(/[-_](?:its|v|p)+(?:[-_]v|[-_]p)?$/i, '')

  // Remove volume/disc tags like _01M-, _02E-, _01V-
  name = name.replace(/_\d{1,3}[A-Za-z](?:-|_|\s|$)/gi, '')

  // Remove date prefixes like 1448-02-29
  name = name.replace(/^\d{4}-\d{2}-\d{2}\s*/, '')

  // Extract core sequence code (e.g. 01Q, Q, Z, MZ, OD, BQ)
  const itemMatch = name.match(/([0-9]{0,3}[A-Za-z]{1,4})(?:[-_]|$)/)
  if (itemMatch && itemMatch[1]) {
    return itemMatch[1].toLowerCase().trim()
  }

  return name.toLowerCase().replace(/[\s-_]+/g, '').trim()
}

export function registerVideoTransferIPC(): void {
  ipcMain.handle('videoTransfer:scanFolder', async (_event, params: { videoFolderPath?: string; photoFolderPath?: string; masterFolderPath?: string } | string) => {
    let vPath = ''
    let pPath = ''

    if (typeof params === 'string') {
      vPath = params
      pPath = params
    } else if (params && typeof params === 'object') {
      if (params.masterFolderPath) {
        const master = params.masterFolderPath
        if (fs.existsSync(master)) {
          const subdirs = fs.readdirSync(master, { withFileTypes: true }).filter(d => d.isDirectory())
          const vSub = subdirs.find(d => /video|dvd|vid/i.test(d.name))
          const pSub = subdirs.find(d => /photo|pic/i.test(d.name))
          vPath = vSub ? path.join(master, vSub.name) : master
          pPath = pSub ? path.join(master, pSub.name) : master
        }
      } else {
        vPath = params.videoFolderPath || ''
        pPath = params.photoFolderPath || ''
      }
    }

    if (!vPath || !fs.existsSync(vPath)) {
      return { success: false, error: 'Video Directory does not exist.' }
    }
    if (!pPath || !fs.existsSync(pPath)) {
      return { success: false, error: 'Photo Directory does not exist.' }
    }

    try {
      // 1. Discover ALL Video files and their date folders under vPath
      interface DiscoveredVideo {
        filePath: string
        fileName: string
        dateFolderName: string
        parsed: ParsedSeqName
        shotCode: string
        thumbnailPath?: string
        thumbnailName?: string
      }

      const allDiscoveredVideos: DiscoveredVideo[] = []

      function scanVideoDir(currentDir: string, depth: number) {
        if (depth > 5) return
        try {
          const entries = fs.readdirSync(currentDir, { withFileTypes: true })
          for (const ent of entries) {
            const fullPath = path.join(currentDir, ent.name)
            if (ent.isDirectory()) {
              scanVideoDir(fullPath, depth + 1)
            } else if (ent.isFile()) {
              const ext = path.extname(ent.name).toLowerCase()
              if (VIDEO_EXTS.has(ext)) {
                const rel = path.relative(vPath, fullPath)
                const parts = rel.split(/[/\\]/)

                let dateFolderName = path.basename(vPath)
                if (parts.length > 1) {
                  const topFolder = parts[0]
                  if (/^dvd$/i.test(topFolder) || /^videos?$/i.test(topFolder)) {
                    dateFolderName = parts.length > 2 ? parts[1] : path.basename(vPath)
                  } else {
                    dateFolderName = topFolder
                  }
                }

                const thumb = findVideoThumbnail(fullPath)

                allDiscoveredVideos.push({
                  filePath: fullPath,
                  fileName: ent.name,
                  dateFolderName,
                  parsed: parseSequenceName(ent.name),
                  shotCode: getShotCode(ent.name),
                  thumbnailPath: thumb?.path,
                  thumbnailName: thumb?.name
                })
              }
            }
          }
        } catch {}
      }

      scanVideoDir(vPath, 0)

      // 2. Discover ALL Photo subfolders and their date folders under pPath
      interface PhotoSubfolderEntry {
        path: string
        name: string
        dateFolderName: string
        parsed: ParsedSeqName
        shotCode: string
        paired: boolean
      }

      const allPhotoSubfolders: PhotoSubfolderEntry[] = []

      function scanPhotoDir(currentDir: string, depth: number) {
        if (depth > 5) return
        try {
          const entries = fs.readdirSync(currentDir, { withFileTypes: true })
          const subdirs = entries.filter(e => e.isDirectory())

          for (const sub of subdirs) {
            const fullPath = path.join(currentDir, sub.name)
            const rel = path.relative(pPath, fullPath)
            const parts = rel.split(/[/\\]/)

            let childDirs: fs.Dirent[] = []
            try {
              childDirs = fs.readdirSync(fullPath, { withFileTypes: true }).filter(c => c.isDirectory())
            } catch {}

            if (childDirs.length > 0 && parts.length === 1) {
              // Intermediate date folder (e.g. pPath/2026-08-20) containing photo subfolders
              scanPhotoDir(fullPath, depth + 1)
            } else {
              // Photo subfolder (leaf folder or subfolder containing images)
              let dateFolderName = path.basename(pPath)
              if (parts.length > 1) {
                dateFolderName = parts[0]
              }

              allPhotoSubfolders.push({
                path: fullPath,
                name: sub.name,
                dateFolderName,
                parsed: parseSequenceName(sub.name),
                shotCode: getShotCode(sub.name),
                paired: false
              })

              scanPhotoDir(fullPath, depth + 1)
            }
          }
        } catch {}
      }

      scanPhotoDir(pPath, 0)

      // 3. Extract unique date folder names for Video and Photo
      const videoDateNames = Array.from(new Set(allDiscoveredVideos.map(v => v.dateFolderName)))
      const photoDateNames = Array.from(new Set(allPhotoSubfolders.map(p => p.dateFolderName)))

      const vDateList = videoDateNames.length > 0 ? videoDateNames : [path.basename(vPath)]
      const pDateList = photoDateNames.length > 0 ? photoDateNames : [path.basename(pPath)]

      // Check if there are any matching date folders between Video and Photo
      const matchingDateKeys = vDateList.filter(vDate =>
        pDateList.some(pDate => normalizeKey(vDate) === normalizeKey(pDate))
      )

      // If Video and Photo folders are of different dates / have no matching date folders
      if (matchingDateKeys.length === 0) {
        return {
          success: false,
          isDateMismatch: true,
          error: `Selected folders are of 2 different names!\nVideo Date Folder: ${vDateList.join(', ')}\nPhoto Date Folder: ${pDateList.join(', ')}`,
          videoDateFolders: vDateList,
          photoDateFolders: pDateList
        }
      }

      // Populate photoFoldersByDate lookup
      const photoFoldersByDate: Record<string, Array<{ name: string; path: string }>> = {}
      const allPhotoList: Array<{ name: string; path: string }> = []

      for (const sf of allPhotoSubfolders) {
        if (!photoFoldersByDate[sf.dateFolderName]) {
          photoFoldersByDate[sf.dateFolderName] = []
        }
        photoFoldersByDate[sf.dateFolderName].push({ name: sf.name, path: sf.path })
        allPhotoList.push({ name: `${sf.dateFolderName} / ${sf.name}`, path: sf.path })
      }
      photoFoldersByDate['All Folders'] = allPhotoList

      // 4. Pair Video Files ↔ Photo Subfolders ONLY WITHIN MATCHING DATE FOLDERS
      const matched: MatchItem[] = []
      const unmatched: MatchItem[] = []

      for (const vid of allDiscoveredVideos) {
        const vidStemClean  = stripVideoSuffix(vid.fileName)
        const vidNormKey    = normalizeKey(vidStemClean)
        const vidItemCode   = extractItemCode(vid.fileName)
        const vidShotCode   = getShotCode(vidStemClean)

        // Only search inside photo subfolders that belong to the SAME date folder!
        const pfMatch = allPhotoSubfolders.find(pf => {
          if (pf.paired) return false

          // Match date folder name first
          const dateMatch = normalizeKey(vid.dateFolderName) === normalizeKey(pf.dateFolderName)
          if (!dateMatch) return false

          const pfStemClean = stripVideoSuffix(pf.name)
          const pfNormKey   = normalizeKey(pfStemClean)
          const pfItemCode  = extractItemCode(pf.name)
          const pfShotCode  = getShotCode(pfStemClean)

          return (
            vidStemClean.toLowerCase() === pfStemClean.toLowerCase() ||
            vidNormKey === pfNormKey ||
            vidItemCode === pfItemCode ||
            (vidShotCode === pfShotCode && vidShotCode.length > 0)
          )
        })

        if (pfMatch) {
          const vThumb = findVideoThumbnail(vid.filePath)
          const pThumb = findPhotoThumbnail(pfMatch.path, vid.filePath)

          matched.push({
            id: `${vid.filePath}_${pfMatch.path}`,
            videoPath: vid.filePath,
            videoName: vid.fileName,
            thumbnailPath: vThumb?.path || vid.thumbnailPath,
            thumbnailName: vThumb?.name || vid.thumbnailName,
            videoThumbnailPath: vThumb?.path || vid.thumbnailPath,
            videoThumbnailName: vThumb?.name || vid.thumbnailName,
            photoThumbnailPath: pThumb?.path,
            photoThumbnailName: pThumb?.name,
            photoFolderPath: pfMatch.path,
            photoFolderName: pfMatch.name,
            dateFolderName: pfMatch.dateFolderName || vid.dateFolderName,
            sequence: vid.parsed.sequence || pfMatch.parsed.sequence,
            prefix: vid.parsed.prefix || pfMatch.parsed.prefix,
            namePart: vid.parsed.namePart,
            status: 'APPROVED',
            isMatched: true
          })
          pfMatch.paired = true
        } else {
          const vThumb = findVideoThumbnail(vid.filePath)
          unmatched.push({
            id: `unmatched_vid_${vid.filePath}`,
            videoPath: vid.filePath,
            videoName: vid.fileName,
            thumbnailPath: vThumb?.path || vid.thumbnailPath,
            thumbnailName: vThumb?.name || vid.thumbnailName,
            videoThumbnailPath: vThumb?.path || vid.thumbnailPath,
            videoThumbnailName: vThumb?.name || vid.thumbnailName,
            dateFolderName: vid.dateFolderName,
            sequence: vid.parsed.sequence,
            prefix: vid.parsed.prefix,
            namePart: vid.parsed.namePart,
            reason: `No matching photo subfolder found for video filename "${vid.fileName}" in date folder "${vid.dateFolderName}"`,
            status: 'MISMATCH',
            isMatched: false
          })
        }
      }

      // Collect unpaired photo subfolders
      for (const pf of allPhotoSubfolders) {
        if (!pf.paired) {
          unmatched.push({
            id: `unmatched_pf_${pf.path}`,
            photoFolderPath: pf.path,
            photoFolderName: pf.name,
            dateFolderName: pf.dateFolderName,
            sequence: pf.parsed.sequence,
            prefix: pf.parsed.prefix,
            namePart: pf.parsed.namePart,
            reason: `Photo subfolder "${pf.name}" in date folder "${pf.dateFolderName}" has no matching video file`,
            status: 'MISMATCH',
            isMatched: false
          })
        }
      }

      // Build dateFolders HUD summary
      const dateFolderMap = new Map<string, { videoCount: number; photoFolderCount: number }>()

      for (const m of matched) {
        const dName = m.dateFolderName || 'General'
        const curr = dateFolderMap.get(dName) || { videoCount: 0, photoFolderCount: 0 }
        curr.videoCount++
        dateFolderMap.set(dName, curr)
      }

      for (const pf of allPhotoSubfolders) {
        const dName = pf.dateFolderName
        const curr = dateFolderMap.get(dName) || { videoCount: 0, photoFolderCount: 0 }
        curr.photoFolderCount++
        dateFolderMap.set(dName, curr)
      }

      const dateFolders: Array<{ name: string; videoCount: number; photoFolderCount: number }> = []
      for (const [name, stats] of dateFolderMap.entries()) {
        dateFolders.push({
          name,
          videoCount: stats.videoCount,
          photoFolderCount: stats.photoFolderCount
        })
      }

      const isApproved = unmatched.length === 0 && matched.length > 0

      return {
        success: true,
        videoFolderPath: vPath,
        photoFolderPath: pPath,
        dateFolders,
        photoFoldersByDate,
        matched,
        unmatched,
        isApproved
      }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  // Pre-flight Dry Run check (counting video + thumbnail payload size)
  ipcMain.handle('videoTransfer:checkDryRun', async (_event, items: Array<{ videoPath: string; thumbnailPath?: string; photoFolderPath: string }>) => {
    try {
      let totalBytes = 0
      let fileCount = 0

      for (const item of items) {
        if (item.videoPath && fs.existsSync(item.videoPath)) {
          const stat = fs.statSync(item.videoPath)
          totalBytes += stat.size
          fileCount++
        }
        if (item.thumbnailPath && fs.existsSync(item.thumbnailPath)) {
          const stat = fs.statSync(item.thumbnailPath)
          totalBytes += stat.size
          fileCount++
        }
      }

      let freeBytes: number | null = null
      if (items.length > 0 && items[0].photoFolderPath) {
        try {
          const targetDir = items[0].photoFolderPath
          const checkDir = fs.existsSync(targetDir) ? targetDir : path.dirname(targetDir)
          if ((fs as any).statfsSync) {
            const stats = (fs as any).statfsSync(checkDir)
            freeBytes = stats.bsize * stats.bfree
          }
        } catch {
          // Fallback if statfsSync unavailable
        }
      }

      return {
        success: true,
        totalBytes,
        fileCount,
        freeBytes,
        hasSufficientSpace: freeBytes === null ? true : freeBytes >= totalBytes
      }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  // Execute transfer with Collision Policy & Speed/ETA progress (Copies Video + Thumbnail Photo)
  ipcMain.handle('videoTransfer:executeTransfer', async (event, payload: {
    itemsToTransfer: Array<{
      videoPath: string
      videoName: string
      thumbnailPath?: string
      thumbnailName?: string
      videoThumbnailPath?: string
      photoThumbnailPath?: string
      photoFolderPath: string
      photoFolderName: string
      dateFolderName: string
    }>
    collisionPolicy?: 'keepBoth' | 'overwrite' | 'skip'
  } | Array<any>) => {
    let itemsToTransfer: Array<{
      videoPath: string
      videoName: string
      thumbnailPath?: string
      thumbnailName?: string
      videoThumbnailPath?: string
      photoThumbnailPath?: string
      photoFolderPath: string
      photoFolderName: string
      dateFolderName: string
    }> = []
    let collisionPolicy: 'keepBoth' | 'overwrite' | 'skip' = 'keepBoth'

    if (Array.isArray(payload)) {
      itemsToTransfer = payload
    } else if (payload && typeof payload === 'object') {
      itemsToTransfer = payload.itemsToTransfer || []
      collisionPolicy = payload.collisionPolicy || 'keepBoth'
    }

    if (!itemsToTransfer || !itemsToTransfer.length) {
      return { success: false, error: 'No items selected for transfer.' }
    }

    const total = itemsToTransfer.length
    let done = 0
    const transferredFiles: Array<{
      videoName: string
      photoFolderName: string
      targetPath: string
      thumbnailTargetPath?: string
    }> = []
    const errors: string[] = []

    const startTime = Date.now()
    let totalBytesCopied = 0

    // Compute total size upfront for ETA calculations (including video + thumbnail photo)
    let totalBytesToCopy = 0
    for (const item of itemsToTransfer) {
      if (item.videoPath && fs.existsSync(item.videoPath)) {
        totalBytesToCopy += fs.statSync(item.videoPath).size
      }
      if (item.thumbnailPath && fs.existsSync(item.thumbnailPath)) {
        totalBytesToCopy += fs.statSync(item.thumbnailPath).size
      }
    }

    for (const item of itemsToTransfer) {
      try {
        if (!item.videoPath || !item.photoFolderPath) continue

        if (!fs.existsSync(item.videoPath)) {
          errors.push(`Source video missing: ${item.videoName}`)
          continue
        }

        if (!fs.existsSync(item.photoFolderPath)) {
          fs.mkdirSync(item.photoFolderPath, { recursive: true })
        }

        let targetFilePath = path.join(item.photoFolderPath, path.basename(item.videoPath))

        if (fs.existsSync(targetFilePath)) {
          if (collisionPolicy === 'skip') {
            done++
            continue
          } else if (collisionPolicy === 'keepBoth') {
            const ext = path.extname(item.videoPath)
            const nameBase = path.basename(item.videoPath, ext)
            let copyIdx = 1
            while (fs.existsSync(targetFilePath)) {
              targetFilePath = path.join(item.photoFolderPath, `${nameBase}_${copyIdx}${ext}`)
              copyIdx++
            }
          }
        }

        const fileSize = fs.statSync(item.videoPath).size

        // 1. Copy Video file
        fs.copyFileSync(item.videoPath, targetFilePath)
        totalBytesCopied += fileSize

        let targetVideoThumbPath: string | undefined = undefined
        let targetPhotoThumbPath: string | undefined = undefined

        // Thumbnail destination = PARENT of the matched photo subfolder
        // (one level up — the date folder where all _P.jpg thumbnails live)
        const thumbDestDir = path.dirname(item.photoFolderPath)

        // 2. Copy matching Video Thumbnail (_V.jpg) into the PARENT folder (thumbnail directory)
        const vThumbPath = (item.videoThumbnailPath && fs.existsSync(item.videoThumbnailPath))
          ? item.videoThumbnailPath
          : (item.thumbnailPath && fs.existsSync(item.thumbnailPath))
          ? item.thumbnailPath
          : findVideoThumbnail(item.videoPath)?.path

        if (vThumbPath && fs.existsSync(vThumbPath)) {
          // Preserve exact original filename (no case change)
          const origName = path.basename(vThumbPath)
          const destVThumbPath = path.join(thumbDestDir, origName)
          // Windows is case-insensitive: compare lowercase to detect same-file scenario
          // Thumbnails always use SKIP policy — never create _1 copies of thumbnails
          if (vThumbPath.toLowerCase() !== destVThumbPath.toLowerCase() && !fs.existsSync(destVThumbPath)) {
            if (!fs.existsSync(thumbDestDir)) fs.mkdirSync(thumbDestDir, { recursive: true })
            fs.copyFileSync(vThumbPath, destVThumbPath)
            totalBytesCopied += fs.statSync(vThumbPath).size
          }
          targetVideoThumbPath = destVThumbPath
        }

        // 3. Copy matching Photo Thumbnail (_P.jpg) into the PARENT folder (thumbnail directory)
        let pThumbPath = (item.photoThumbnailPath && fs.existsSync(item.photoThumbnailPath))
          ? item.photoThumbnailPath
          : findPhotoThumbnail(item.photoFolderPath, item.videoPath)?.path

        if (pThumbPath && fs.existsSync(pThumbPath)) {
          // Preserve exact original filename (no case change)
          const origPName = path.basename(pThumbPath)
          const destPThumbPath = path.join(thumbDestDir, origPName)
          // Windows is case-insensitive: compare lowercase to detect same-file scenario
          // Thumbnails always use SKIP policy — never create _1 copies of thumbnails
          if (pThumbPath.toLowerCase() !== destPThumbPath.toLowerCase() && !fs.existsSync(destPThumbPath)) {
            if (!fs.existsSync(thumbDestDir)) fs.mkdirSync(thumbDestDir, { recursive: true })
            fs.copyFileSync(pThumbPath, destPThumbPath)
            totalBytesCopied += fs.statSync(pThumbPath).size
          }
          targetPhotoThumbPath = destPThumbPath
        }

        done++
        transferredFiles.push({
          videoName: item.videoName,
          photoFolderName: item.photoFolderName,
          targetPath: targetFilePath,
          thumbnailTargetPath: targetVideoThumbPath || targetPhotoThumbPath
        })

        const elapsedSec = (Date.now() - startTime) / 1000
        const speedBps = elapsedSec > 0 ? totalBytesCopied / elapsedSec : 0
        const speedMbps = Math.round((speedBps / (1024 * 1024)) * 10) / 10
        
        const remainingBytes = Math.max(0, totalBytesToCopy - totalBytesCopied)
        const etaSec = speedBps > 0 ? Math.ceil(remainingBytes / speedBps) : 0

        const percent = Math.round((done / total) * 100)
        event.sender.send('videoTransfer:progress', {
          percent,
          done,
          total,
          currentFile: item.videoName,
          speedMbps,
          etaSec
        })
      } catch (err: any) {
        errors.push(`Failed to copy ${item.videoName}: ${err.message || String(err)}`)
      }
    }

    return {
      success: true,
      transferredCount: done,
      transferredFiles,
      errors
    }
  })

  // Undo Transfer (Deletes copied video files and thumbnail photos from target subfolders)
  ipcMain.handle('videoTransfer:undoTransfer', async (_event, transferredFiles: Array<{ targetPath: string; thumbnailTargetPath?: string }>) => {
    if (!transferredFiles || !transferredFiles.length) {
      return { success: false, error: 'No transferred items to undo.' }
    }

    try {
      let undoneCount = 0
      const errors: string[] = []

      for (const item of transferredFiles) {
        if (item.targetPath && fs.existsSync(item.targetPath)) {
          try {
            fs.unlinkSync(item.targetPath)
            undoneCount++
          } catch (err: any) {
            errors.push(`Failed to delete ${item.targetPath}: ${err.message}`)
          }
        }
        if (item.thumbnailTargetPath && fs.existsSync(item.thumbnailTargetPath)) {
          try {
            fs.unlinkSync(item.thumbnailTargetPath)
          } catch (err: any) {
            errors.push(`Failed to delete thumbnail ${item.thumbnailTargetPath}: ${err.message}`)
          }
        }
      }

      return {
        success: true,
        undoneCount,
        errors
      }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })
}
