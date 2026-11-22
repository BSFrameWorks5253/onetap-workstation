import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getFfprobeExePath } from './gpuDetector'

const execFileAsync = promisify(execFile)

const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts', '.mxf', '.wmv', '.m4v', '.webm', '.ts', '.mpg', '.mpeg']

export interface GroupPhotoItem {
  gpNum: number
  fileName: string
  fullPath: string
  duration: number
}

export interface GroupPhotoAssignmentRule {
  gpNum: number
  gpPath: string
  fromN: number
  toN: number
}

export interface GroupPhotoScanResult {
  availableGps: GroupPhotoItem[]
  suggestedAssignments: Record<string, string> // key: videoPath or videoName -> gpPath
}

/**
 * Checks whether a file name or path is a Group Photo video (e.g. GP1.mp4, GP 2.mov, Group_Photo_1.mp4)
 */
export function isGroupPhotoVideoFile(fileNameOrPath: string): boolean {
  if (!fileNameOrPath) return false
  const base = path.basename(fileNameOrPath)
  const stem = base.replace(/\.(tmp|temp)$/i, '').replace(/\.[^/.]+$/, '').trim()
  if (/group[_\s-]?photo/i.test(stem)) return true
  // Matches "GP", "GP1", "GP 1", "GP_1", "GP-1", "GP01", "GP1_Final", "GP_Outro", "1448_GP1", "43-16N-GP1", etc.
  if (/(?:^|[\s_.-])gp(?:\d+|[_\s-]+\d+)?(?:[\s_.-]|$|_?outro|_?final|[a-z])/i.test(stem)) {
    if (/^gp[a-z]{2,}/i.test(stem)) return false
    return true
  }
  // Also check if containing folder name is GP / Group Photo
  try {
    const dirName = path.basename(path.dirname(fileNameOrPath)).toLowerCase()
    if (dirName === 'gp' || dirName === 'group photo' || dirName === 'group photos' || dirName === 'group_photo' || dirName === 'outro') {
      return true
    }
  } catch {}
  return false
}

/**
 * Extracts numeric GP index (e.g. "GP1" -> 1, "GP 2" -> 2, "Group_Photo_3" -> 3)
 */
export function extractGpNumber(fileNameOrPath: string): number {
  if (!fileNameOrPath) return 1
  const base = path.basename(fileNameOrPath)
  const stem = base.replace(/\.(tmp|temp)$/i, '').replace(/\.[^/.]+$/, '').trim()
  const m = stem.match(/(?:gp|group[_\s-]?photo)[_\s-]*(\d+)/i)
  if (m && m[1]) {
    const num = parseInt(m[1], 10)
    if (!isNaN(num) && num > 0) return num
  }
  const mPre = stem.match(/(\d+)[_\s-]*(?:gp|group[_\s-]?photo)/i)
  if (mPre && mPre[1]) {
    const num = parseInt(mPre[1], 10)
    if (!isNaN(num) && num > 0) return num
  }
  return 1
}

/**
 * Extracts Nikaah ceremony number from video filename (e.g. "1448-04-05_02E-43-16N-60446783.mp4" -> 16, "01N.mp4" -> 1)
 */
export function extractNikaahNumberFromFileName(fileNameOrPath: string): number | null {
  if (!fileNameOrPath) return null
  const base = path.basename(fileNameOrPath)
  const upper = base.replace(/\.[a-z0-9]{2,5}$/i, '').toUpperCase()

  // Exclude Namaz and Group Photos
  if (/\bNAMAZ\b/i.test(upper) || isGroupPhotoVideoFile(base)) {
    return null
  }

  // 1. Structure like -43-16N- or _01-16N- or -16N- or _16N_ or -16N
  const m1 = upper.match(/[-_](\d{1,4})[a-zA-Z]?N(?:[-_]|\b|$)/i)
  if (m1 && m1[1]) return parseInt(m1[1], 10)

  // 2. Direct 16N or 16 N or 16-N
  const m2 = upper.match(/^(?:.*[\s-_])?(\d{1,4})[\s-_]*N(?:[\s-_]|\b|$)/i)
  if (m2 && m2[1]) return parseInt(m2[1], 10)

  // 3. N16 or N-16
  const m3 = upper.match(/(?:^|[\s-_])N[\s-_]*(\d{1,4})(?:[\s-_]|\b|$)/i)
  if (m3 && m3[1]) return parseInt(m3[1], 10)

  // 4. NIKAH 16 or NIKAAH 16
  const m4 = upper.match(/\bNIKAA?H[\s-_]*(\d{1,4})\b/i)
  if (m4 && m4[1]) return parseInt(m4[1], 10)

  return null
}

/**
 * Probes video duration using ffprobe
 */
export async function probeVideoDuration(filePath: string): Promise<number> {
  try {
    const ffprobeExe = getFfprobeExePath()
    const { stdout } = await execFileAsync(ffprobeExe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=duration',
      '-of', 'json',
      filePath
    ], { windowsHide: true, env: process.env, timeout: 8000 })
    const parsed = JSON.parse(stdout.toString())
    const durStr = parsed.streams?.[0]?.duration
    if (durStr && !isNaN(parseFloat(durStr))) {
      return Math.round(parseFloat(durStr) * 100) / 100
    }
  } catch {}

  try {
    const ffprobeExe = getFfprobeExePath()
    const { stdout } = await execFileAsync(ffprobeExe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath
    ], { windowsHide: true, env: process.env, timeout: 8000 })
    const parsed = JSON.parse(stdout.toString())
    const durStr = parsed.format?.duration
    if (durStr && !isNaN(parseFloat(durStr))) {
      return Math.round(parseFloat(durStr) * 100) / 100
    }
  } catch {}

  return 15.0
}

/**
 * Scans a folder (e.g. DVD folder, parent folder, sibling DVD folder, etc.) for rendered Group Photo videos
 */
export async function scanGroupPhotosInFolder(folderPath: string): Promise<GroupPhotoItem[]> {
  const results: GroupPhotoItem[] = []
  if (!folderPath || !fs.existsSync(folderPath)) return results

  const targetDir = fs.statSync(folderPath).isDirectory() ? folderPath : path.dirname(folderPath)
  const dirsToScan = new Set<string>()
  dirsToScan.add(targetDir)

  // 1. Direct and parent DVD subfolders
  const dvdSub = path.join(targetDir, 'DVD')
  if (fs.existsSync(dvdSub)) dirsToScan.add(dvdSub)
  const dvdSubLower = path.join(targetDir, 'dvd')
  if (fs.existsSync(dvdSubLower)) dirsToScan.add(dvdSubLower)

  const parent = path.dirname(targetDir)
  if (parent && parent !== targetDir && fs.existsSync(parent)) {
    dirsToScan.add(parent)
    const sibDvd = path.join(parent, 'DVD')
    if (fs.existsSync(sibDvd)) dirsToScan.add(sibDvd)
    const sibDvdLower = path.join(parent, 'dvd')
    if (fs.existsSync(sibDvdLower)) dirsToScan.add(sibDvdLower)
  }

  // 2. Recursive subdirectory walker up to depth 3
  const queue: Array<{ dir: string; depth: number }> = [{ dir: targetDir, depth: 0 }]
  if (fs.existsSync(dvdSub)) queue.push({ dir: dvdSub, depth: 0 })
  if (parent && parent !== targetDir && fs.existsSync(parent)) queue.push({ dir: parent, depth: 1 })

  const visitedWalk = new Set<string>()
  while (queue.length > 0) {
    const { dir: curDir, depth } = queue.shift()!
    const norm = path.resolve(curDir).toLowerCase()
    if (visitedWalk.has(norm) || depth > 3) continue
    visitedWalk.add(norm)
    dirsToScan.add(curDir)

    try {
      const subEntries = fs.readdirSync(curDir, { withFileTypes: true })
      for (const sub of subEntries) {
        if (sub.isDirectory() && !sub.name.startsWith('.') && !sub.name.startsWith('$')) {
          const subFullPath = path.join(curDir, sub.name)
          const lower = sub.name.toLowerCase()
          if (
            lower === 'dvd' ||
            lower.includes('gp') ||
            lower.includes('group') ||
            lower.includes('photo') ||
            lower.includes('outro') ||
            lower === 'final' ||
            lower === 'output' ||
            depth < 2
          ) {
            dirsToScan.add(subFullPath)
            queue.push({ dir: subFullPath, depth: depth + 1 })
          }
        }
      }
    } catch {}
  }

  const seenPaths = new Set<string>()

  for (const dir of dirsToScan) {
    try {
      if (!fs.existsSync(dir)) continue
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const dirLower = path.basename(dir).toLowerCase()
      const isParentGpFolder = dirLower === 'gp' || dirLower === 'group photo' || dirLower === 'group photos' || dirLower === 'group_photo' || dirLower === 'outro'

      for (const entry of entries) {
        if (!entry.isFile()) continue
        const ext = path.extname(entry.name).toLowerCase()
        if (!VIDEO_EXTS.includes(ext)) continue

        const fullPath = path.join(dir, entry.name)
        const isGp = isGroupPhotoVideoFile(entry.name) || isGroupPhotoVideoFile(fullPath) || isParentGpFolder
        if (!isGp) continue

        const normKey = path.resolve(fullPath).toLowerCase()
        if (seenPaths.has(normKey)) continue
        seenPaths.add(normKey)

        const gpNum = extractGpNumber(entry.name)
        let dur = 15.0
        try {
          dur = await probeVideoDuration(fullPath)
        } catch {
          dur = 15.0
        }

        results.push({
          gpNum,
          fileName: entry.name,
          fullPath,
          duration: dur
        })
      }
    } catch {}
  }

  results.sort((a, b) => a.gpNum - b.gpNum)
  return results
}

/**
 * Automatically builds default Nikaah range assignments if multiple GP files are detected
 * e.g. 2 GPs with 10 Nikaahs -> GP1: 1-5, GP2: 6-10
 */
export function buildDefaultGroupPhotoAssignments(
  videoList: string[],
  availableGps: GroupPhotoItem[]
): Record<string, string> {
  const assignments: Record<string, string> = {}
  if (!videoList || videoList.length === 0 || !availableGps || availableGps.length === 0) {
    return assignments
  }

  // Filter out any GP videos from the ceremony list
  const ceremonyVideos = videoList.filter(v => !isGroupPhotoVideoFile(v))
  if (ceremonyVideos.length === 0) return assignments

  // Determine Nikaah ceremony numbers or sequential indices
  const items: Array<{ videoPath: string; cerNum: number }> = ceremonyVideos.map((vp, idx) => {
    const cer = extractNikaahNumberFromFileName(vp)
    return {
      videoPath: vp,
      cerNum: cer !== null ? cer : (idx + 1)
    }
  })

  items.sort((a, b) => a.cerNum - b.cerNum)

  const total = items.length
  const gpCount = availableGps.length
  const step = Math.ceil(total / gpCount)

  for (let gi = 0; gi < gpCount; gi++) {
    const gpItem = availableGps[gi]
    const startIndex = gi * step
    const endIndex = Math.min((gi + 1) * step, total)
    for (let j = startIndex; j < endIndex; j++) {
      const item = items[j]
      assignments[item.videoPath] = gpItem.fullPath
      const base = path.basename(item.videoPath)
      assignments[base] = gpItem.fullPath
    }
  }

  return assignments
}
