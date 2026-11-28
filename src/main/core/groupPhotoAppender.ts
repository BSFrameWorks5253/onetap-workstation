import fs from 'fs'
import path from 'path'
import { execFile, spawnSync } from 'child_process'
import { promisify } from 'util'
import { getFfprobeExePath, getFfmpegExePath } from './gpuDetector'

const execFileAsync = promisify(execFile)

const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts', '.mxf', '.wmv', '.m4v', '.webm', '.ts', '.mpg', '.mpeg']

const IGNORED_SCAN_NAMES = new Set([
  'node_modules', '.git', '.github', '.vscode', 'dist', 'out', 'build',
  'final', 'output', 'converted', '$recycle.bin', '.agent', '.gemini'
])

function isIgnoredFolder(name: string): boolean {
  if (!name) return true
  const lower = name.toLowerCase().trim()
  if (lower.startsWith('.') || lower.startsWith('$')) return true
  return IGNORED_SCAN_NAMES.has(lower)
}

export interface GroupPhotoItem {
  gpNum: number
  fileName: string
  fullPath: string
  duration: number
  sessionIndex?: number
  sessionFolder?: string
  sessionName?: string
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
  if (/(?:^|[\s_.-])group[_\s-]?photo(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(stem)) return true
  if (/(?:^|[\s_.-])gp(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(stem)) {
    // Avoid false positives on words like 'gpa', 'gps', 'gphoto'
    if (/(?:^|[\s_.-])gp[a-z]{1,}/i.test(stem)) return false
    return true
  }
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
 * Probes video duration using ffprobe with ffmpeg banner fallback
 */
export async function probeVideoDuration(filePath: string): Promise<number> {
  try {
    const ffprobeExe = getFfprobeExePath()
    const { stdout } = await execFileAsync(ffprobeExe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=duration:format=duration',
      '-of', 'json',
      filePath
    ], { windowsHide: true, env: process.env, timeout: 1500 })
    const parsed = JSON.parse(stdout.toString())
    const durStr = parsed.streams?.[0]?.duration || parsed.format?.duration
    if (durStr && !isNaN(parseFloat(durStr))) {
      const dur = parseFloat(durStr)
      if (dur > 0) return Math.round(dur * 100) / 100
    }
  } catch {}

  // Fallback: fast banner probe with ffmpeg -i
  try {
    const ffmpegExe = getFfmpegExePath()
    const res = spawnSync(ffmpegExe, ['-hide_banner', '-i', filePath], {
      timeout: 1500,
      windowsHide: true,
      env: process.env
    })
    const out = (res.stderr || '').toString()
    const durMatch = out.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
    if (durMatch) {
      const hours = parseFloat(durMatch[1])
      const mins = parseFloat(durMatch[2])
      const secs = parseFloat(durMatch[3])
      const duration = hours * 3600 + mins * 60 + secs
      if (!isNaN(duration) && duration > 0) {
        return Math.round(duration * 100) / 100
      }
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

  const dirsToScan = new Set<string>()
  dirsToScan.add(folderPath)

  // 1. Direct DVD subfolders
  const dvdSub = path.join(folderPath, 'DVD')
  if (fs.existsSync(dvdSub)) dirsToScan.add(dvdSub)
  const dvdSubLower = path.join(folderPath, 'dvd')
  if (fs.existsSync(dvdSubLower)) dirsToScan.add(dvdSubLower)

  // 2. Sibling DVD folder (e.g. if folderPath is .../Raw or .../Footage or .../Videos or .../Final)
  const parent = path.dirname(folderPath)
  if (parent && parent !== folderPath && fs.existsSync(parent)) {
    const sibDvd = path.join(parent, 'DVD')
    if (fs.existsSync(sibDvd)) dirsToScan.add(sibDvd)
    const sibDvdLower = path.join(parent, 'dvd')
    if (fs.existsSync(sibDvdLower)) dirsToScan.add(sibDvdLower)
  }

  // 3. Any immediate subdirectories containing 'dvd' or 'gp'
  try {
    const subEntries = fs.readdirSync(folderPath, { withFileTypes: true })
    for (const sub of subEntries) {
      if (sub.isDirectory() && !isIgnoredFolder(sub.name)) {
        const lower = sub.name.toLowerCase()
        if (lower === 'dvd' || lower.includes('gp') || lower.includes('group_photo')) {
          dirsToScan.add(path.join(folderPath, sub.name))
        }
      }
    }
  } catch {}

  const seenPaths = new Set<string>()

  for (const dir of dirsToScan) {
    try {
      if (!fs.existsSync(dir)) continue
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const ext = path.extname(entry.name).toLowerCase()
        if (!VIDEO_EXTS.includes(ext)) continue
        if (!isGroupPhotoVideoFile(entry.name)) continue

        const fullPath = path.join(dir, entry.name)
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
  videoList: Array<string | { videoPath: string; sessionIndex?: number; sessionFolder?: string }>,
  availableGps: GroupPhotoItem[]
): Record<string, string> {
  const assignments: Record<string, string> = {}
  if (!videoList || videoList.length === 0 || !availableGps || availableGps.length === 0) {
    return assignments
  }

  // Check if session-aware information is present
  const hasSessions = availableGps.some(g => g.sessionIndex !== undefined) ||
    videoList.some(v => typeof v === 'object' && v.sessionIndex !== undefined)

  if (hasSessions) {
    // Collect all distinct session keys/indices
    const sessionMap = new Map<number | string, {
      videos: Array<{ videoPath: string; cerNum: number }>
      gps: GroupPhotoItem[]
    }>()

    // 1. Group availableGps by session
    for (const gp of availableGps) {
      const sKey = gp.sessionIndex !== undefined ? gp.sessionIndex : (gp.sessionFolder || 0)
      if (!sessionMap.has(sKey)) {
        sessionMap.set(sKey, { videos: [], gps: [] })
      }
      sessionMap.get(sKey)!.gps.push(gp)
    }

    // 2. Group Nikaah videos by session
    for (const v of videoList) {
      const vp = typeof v === 'string' ? v : v.videoPath
      if (!vp || isGroupPhotoVideoFile(vp)) continue
      const cer = extractNikaahNumberFromFileName(vp)
      if (cer === null) continue

      const sKey = (typeof v === 'object' && v.sessionIndex !== undefined)
        ? v.sessionIndex
        : (typeof v === 'object' && v.sessionFolder ? v.sessionFolder : 0)

      if (!sessionMap.has(sKey)) {
        sessionMap.set(sKey, { videos: [], gps: [] })
      }
      sessionMap.get(sKey)!.videos.push({ videoPath: vp, cerNum: cer })
    }

    // 3. For each session, strictly assign that session's GPs to its own Nikaahs
    for (const [, group] of sessionMap.entries()) {
      const { videos: sessionVideos, gps: sessionGps } = group
      if (sessionVideos.length === 0 || sessionGps.length === 0) continue

      sessionVideos.sort((a, b) => a.cerNum - b.cerNum)
      sessionGps.sort((a, b) => a.gpNum - b.gpNum)

      const total = sessionVideos.length
      const gpCount = sessionGps.length
      const step = Math.ceil(total / gpCount)

      for (let gi = 0; gi < gpCount; gi++) {
        const gpItem = sessionGps[gi]
        const startIndex = gi * step
        const endIndex = Math.min((gi + 1) * step, total)
        for (let j = startIndex; j < endIndex; j++) {
          const item = sessionVideos[j]
          assignments[item.videoPath] = gpItem.fullPath
          const base = path.basename(item.videoPath)
          assignments[base] = gpItem.fullPath
        }
      }
    }

    return assignments
  }

  // Filter out any GP videos from the ceremony list
  const ceremonyVideos = videoList
    .map(v => (typeof v === 'string' ? v : v.videoPath))
    .filter(v => v && !isGroupPhotoVideoFile(v))
  if (ceremonyVideos.length === 0) return assignments

  // Identify videos that are specifically Nikaah ceremonies
  const nikaahItems: Array<{ videoPath: string; cerNum: number }> = []
  for (const vp of ceremonyVideos) {
    const cer = extractNikaahNumberFromFileName(vp)
    if (cer !== null) {
      nikaahItems.push({ videoPath: vp, cerNum: cer })
    }
  }

  // If there are no Nikaah ceremonies detected in the folder, do NOT force-assign GP outro
  // to unrelated ceremonies (Waaz, Majlis, Ziyafat, etc.) by default.
  if (nikaahItems.length === 0) {
    return assignments
  }

  nikaahItems.sort((a, b) => a.cerNum - b.cerNum)

  const total = nikaahItems.length
  const gpCount = availableGps.length
  const step = Math.ceil(total / gpCount)

  for (let gi = 0; gi < gpCount; gi++) {
    const gpItem = availableGps[gi]
    const startIndex = gi * step
    const endIndex = Math.min((gi + 1) * step, total)
    for (let j = startIndex; j < endIndex; j++) {
      const item = nikaahItems[j]
      assignments[item.videoPath] = gpItem.fullPath
      const base = path.basename(item.videoPath)
      assignments[base] = gpItem.fullPath
    }
  }

  return assignments
}
