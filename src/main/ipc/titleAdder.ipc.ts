/**
 * ====================================================================
 * TITLE ADDER IPC HANDLER (titleAdder.ipc.ts)
 * ====================================================================
 * Main Process handler for:
 * 1. Automatic title/intro/outro video overlay generation using FFmpeg.
 * 2. Prefix / Category code extraction from video filenames using 3 logic modes:
 *    - Mode 1: Embedded Camera Sequence Code (e.g. "V-1448-01-22 _02E-10-01Z-30355757" -> "Z")
 *    - Mode 2: Suffix Matching (e.g. "C0220_01-Z" -> "Z")
 *    - Mode 3: Prefix Matching (e.g. "001 Z01" -> "Z")
 * 3. Audio stream detection & silence gap analysis (silencedetect).
 * 4. Dedicated audio routing (Nikah/N-audio, Special1/WAAZ/ID audio, and Pool audio).
 * 5. Folder statistics scanning and batch file renaming.
 * ====================================================================
 */

import { ipcMain, BrowserWindow, shell } from 'electron'
import { spawnSync, execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { get, setAndSave } from '../core/settingsManager'
import { buildAudioPool, getNikahAudio, getAudioForVideo, getSpecialAudioPath, buildInstrumentalAudioPool, getInstrumentalAudioPath, getAllAvailableAudioFiles } from '../core/audioEngine'
import { runFFmpegJob, cancelJob, extractYearFromFileName } from '../core/ffmpegRunner'
import { getFfmpegExePath, getFfprobeExePath } from '../core/gpuDetector'
import { parseSafarFromPath, extractEventCodeFromPath, SafarParsedInfo } from '../core/safarHierarchy'
import { recordRenderFinished } from './taskTracker.ipc'
import { updateIslandState, onTitleAdderProgressBridge } from '../core/dynamicIsland'

type WinGetter = () => BrowserWindow | null

const IMG_EXTS = ['.jpg', '.jpeg', '.png', '.PNG', '.JPG', '.JPEG']
const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.aac']
const VIDEO_EXTS = [
  '.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts', '.mxf', '.wmv',
  '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.mod', '.tod', '.vob', '.divx',
  '.braw', '.crm', '.r3d', '.ari', '.arx', '.cine', '.ts', '.tp', '.m2t',
  '.dv', '.dif', '.hevc', '.h264', '.h265', '.264', '.265', '.f4v',
  '.asf', '.ogv', '.mp4v', '.insv', '.lrf', '.lrv', '.dat',
  '.m2v', '.m4p', '.nev', '.qt', '.rm', '.rmvb', '.vro', '.wtv', '.dvr-ms', '.ogm', '.mpe', '.mpv', '.m2p', '.3g2', '.avchd'
]
const TEMP_EXTS = ['.tmp', '.temp']
const PROJECT_EXTS = new Set(['.prproj', '.aep', '.psd', '.ai'])

function isTempVideoFile(filename: string): boolean {
  if (!filename) return false
  const lower = filename.toLowerCase()
  if (lower.endsWith('.mp4.tmp') || lower.endsWith('.mov.tmp') || lower.endsWith('.avi.tmp')) return true
  if (lower.endsWith('.tmp') || lower.endsWith('.temp')) return true
  return false
}

function getCanonicalStem(filenameOrPath: string): string {
  if (!filenameOrPath) return ''
  const base = path.basename(filenameOrPath)
  return base
    .replace(/\.(tmp|temp)$/i, '')
    .replace(/\.[a-z0-9]{2,6}$/i, '')
    .trim()
    .toLowerCase()
}

export function isGroupPhotoVideo(filenameOrPath: string): boolean {
  if (!filenameOrPath) return false
  const base = path.basename(filenameOrPath)
  const stem = base
    .replace(/\.(tmp|temp)$/i, '')
    .replace(/\.[^/.]+$/, '')
    .trim()
  // Matches "Group_Photo_1", "Group_Photo_2", "Group Photo 1", "Group-Photo-1", "GroupPhoto1", "Group_Photo", etc.
  // OR "GPn" where n can be any number: e.g. "GP1", "GP2", "GP01", "GP-1", "GP_1", "GP 1", etc.
  const isGroupPhoto = /(?:^|[\s_.-])group[_\s-]?photo(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(stem)
  const isGPn = /(?:^|[\s_.-])gp(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(stem)
  return isGroupPhoto || isGPn
}

export function findTransitionFile(titlesFolder: string): string | null {
  if (!titlesFolder || !fs.existsSync(titlesFolder)) return null
  const candidates = [
    'transition.mp4', 'transition.mov', 'transition.mkv', 'transition.avi', 'transition.webm',
    'black.mp4', 'black.mov', 'black_frame.mp4', 'black_transition.mp4',
    'transition.png', 'transition.jpg', 'transition.jpeg',
    'black.png', 'black.jpg', 'black_frame.png', 'black_frame.jpg'
  ]
  try {
    const entries = fs.readdirSync(titlesFolder)
    for (const cand of candidates) {
      const match = entries.find(e => e.toLowerCase() === cand.toLowerCase())
      if (match) {
        return path.join(titlesFolder, match)
      }
    }
  } catch {}
  return null
}

function findVideoFiles(dirPath: string): Array<{ fullPath: string; fileName: string; relPath: string }> {
  if (!dirPath || !fs.existsSync(dirPath)) return []
  const results: Array<{ fullPath: string; fileName: string; relPath: string }> = []

  const scan = (currentDir: string, relPrefix: string = '') => {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })

      // First pass: identify rendered/final video stems in this directory
      const renderedStems = new Set<string>()
      for (const entry of entries) {
        if (entry.isFile()) {
          if (isGroupPhotoVideo(entry.name)) continue
          const ext = path.extname(entry.name).toLowerCase()
          if (VIDEO_EXTS.includes(ext)) {
            renderedStems.add(getCanonicalStem(entry.name))
          }
        }
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.')) {
            scan(fullPath, relPrefix ? path.join(relPrefix, entry.name) : entry.name)
          }
        } else if (entry.isFile()) {
          if (isGroupPhotoVideo(entry.name)) continue
          const ext = path.extname(entry.name).toLowerCase()
          if (VIDEO_EXTS.includes(ext)) {
            results.push({
              fullPath,
              fileName: entry.name,
              relPath: relPrefix ? path.join(relPrefix, entry.name) : entry.name
            })
          } else if (isTempVideoFile(entry.name)) {
            const tempStem = getCanonicalStem(entry.name)
            // Show temp file if final rendered video has not yet completed/appeared
            if (!renderedStems.has(tempStem)) {
              results.push({
                fullPath,
                fileName: entry.name,
                relPath: relPrefix ? path.join(relPrefix, entry.name) : entry.name
              })
            }
          }
        }
      }
    } catch {}
  }

  scan(dirPath)
  results.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' }))
  return results
}

function resolveVideoFolderAndFiles(rootPath: string): { dir: string; files: Array<{ fullPath: string; fileName: string; relPath: string }> } {
  if (!rootPath || !fs.existsSync(rootPath)) return { dir: rootPath || '', files: [] }

  let baseDir = rootPath
  try {
    if (fs.statSync(rootPath).isFile()) {
      baseDir = path.dirname(rootPath)
    }
  } catch {}

  // If baseDir itself is already a DVD or Final folder
  const baseLower = path.basename(baseDir).toLowerCase()
  if (baseLower === 'dvd' || baseLower === 'final' || baseLower === 'final titles') {
    return { dir: baseDir, files: findVideoFiles(baseDir) }
  }

  // Look specifically for a DVD subfolder inside baseDir
  const dvdDir = path.join(baseDir, 'DVD')
  if (fs.existsSync(dvdDir)) {
    const dvdFiles = findVideoFiles(dvdDir)
    return { dir: dvdDir, files: dvdFiles }
  }

  try {
    const subdirs = fs.readdirSync(baseDir, { withFileTypes: true })
    for (const sub of subdirs) {
      if (sub.isDirectory() && sub.name.toLowerCase() === 'dvd') {
        const fullSub = path.join(baseDir, sub.name)
        const subFiles = findVideoFiles(fullSub)
        return { dir: fullSub, files: subFiles }
      }
    }
  } catch {}

  // Check if baseDir has a Final or Final Titles subfolder containing videos
  const finalNames = ['Final', 'final', 'FINAL', 'Final Titles', 'final titles', 'FINAL TITLES']
  for (const fn of finalNames) {
    const subFinal = path.join(baseDir, fn)
    if (fs.existsSync(subFinal)) {
      try {
        if (fs.statSync(subFinal).isDirectory()) {
          const subFiles = findVideoFiles(subFinal)
          if (subFiles.length > 0) {
            return { dir: subFinal, files: subFiles }
          }
        }
      } catch {}
    }
  }

  // Fallback if no DVD or Final subfolder exists
  const directFiles = findVideoFiles(baseDir)
  return { dir: baseDir, files: directFiles }
}

/**
 * Searches a folder for an image or audio file matching a given basename across known extensions.
 * @param folder Absolute folder path
 * @param name File basename (without extension)
 * @returns Full file path if found, or null
 */
function findFile(folder: string, name: string): string | null {
  if (!folder || !name) return null
  for (const ext of [...AUDIO_EXTS, ...IMG_EXTS]) {
    const f = path.join(folder, name + ext)
    if (fs.existsSync(f)) return f
  }
  return null
}

/**
 * Dynamically resolves the titles folder, supporting custom path, project subfolders,
 * Windows OneDrive-synced Documents, and standard user Documents.
 */
function resolveTitlesFolder(customFolder?: string, batchSource?: string): string {
  if (customFolder && fs.existsSync(customFolder)) return customFolder

  // Check batchSource for local project Titles folder
  if (batchSource && fs.existsSync(batchSource)) {
    const candidates = [
      path.join(batchSource, 'Final Titles'),
      path.join(batchSource, 'Titles'),
      path.join(batchSource, 'Title'),
      path.join(batchSource, 'Thumbnails'),
      path.join(path.dirname(batchSource), 'Final Titles'),
      path.join(path.dirname(batchSource), 'Titles'),
      path.join(path.dirname(batchSource), 'Title')
    ]
    for (const c of candidates) {
      if (fs.existsSync(c)) return c
    }
  }

  // Check electron app.getPath('documents')
  try {
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      const doc = app.getPath('documents')
      if (doc) {
        const p = path.join(doc, 'Final Titles')
        if (fs.existsSync(p)) return p
      }
    }
  } catch {}

  // Windows-only: check OneDrive Documents
  if (process.platform === 'win32' && process.env.USERPROFILE) {
    const p = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Final Titles')
    if (fs.existsSync(p)) return p
  }

  // Check standard Documents
  const std = path.join(os.homedir(), 'Documents', 'Final Titles')
  if (fs.existsSync(std)) return std

  // Windows fallback: OneDrive Documents if parent exists
  if (process.platform === 'win32' && process.env.USERPROFILE) {
    const p = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Final Titles')
    if (fs.existsSync(path.join(process.env.USERPROFILE, 'OneDrive', 'Documents'))) return p
  }

  return customFolder || std
}

/**
 * Robustly matches a title image for a video using multi-tiered fallback:
 * 1. Exact prefix match in titlesFolder
 * 2. Case-insensitive / containment in availableImages pool
 * 3. Match by video name or stem
 * 4. Local video folder thumbnail (e.g. video_V.jpg, video.jpg)
 * 5. Generic title fallbacks (ID, Title, Default, Thumbnail, Cover)
 * 6. First available image in availableImages
 */
function findTitleImageForVideo(
  titlesFolder: string,
  prefix: string,
  videoPath: string,
  availableImages: Array<{ name: string; path: string }>
): string | null {
  // 1. Exact findFile match by prefix in titlesFolder
  if (prefix) {
    const f = findFile(titlesFolder, prefix)
    if (f) return f
  }

  // 2. Case-insensitive exact match in availableImages
  if (prefix && availableImages.length > 0) {
    const norm = prefix.toLowerCase().trim()
    const exact = availableImages.find(img => {
      const stem = path.basename(img.name, path.extname(img.name)).toLowerCase().trim()
      return stem === norm
    })
    if (exact) return exact.path

    // Containment match ONLY for single-char prefixes (e.g. M → M-waaz.jpg).
    // For multi-char prefixes like MZ, ZO, OZ, BQ etc., containment would wrongly
    // match a shorter image (e.g. M.jpg for MZ) — skip it in that case.
    if (norm.length === 1) {
      const contained = availableImages.find(img => {
        const stem = path.basename(img.name, path.extname(img.name)).toLowerCase().trim()
        return stem.startsWith(norm) || stem.includes(`_${norm}`) || stem.includes(`-${norm}`)
      })
      if (contained) return contained.path
    }
  }

  // 3. Match by video stem or video filename
  if (videoPath) {
    const vidStem = path.basename(videoPath, path.extname(videoPath)).toLowerCase().replace(/\.(tmp|temp)$/i, '')
    const vidMatch = availableImages.find(img => {
      const stem = path.basename(img.name, path.extname(img.name)).toLowerCase().trim()
      return stem === vidStem || stem === `${vidStem}_v` || vidStem.startsWith(stem)
    })
    if (vidMatch) return vidMatch.path

    // Check same folder as video for matching thumbnail
    try {
      const vidDir = path.dirname(videoPath)
      for (const ext of IMG_EXTS) {
        const cand1 = path.join(vidDir, `${vidStem}_V${ext}`)
        if (fs.existsSync(cand1)) return cand1
        const cand2 = path.join(vidDir, `${vidStem}${ext}`)
        if (fs.existsSync(cand2)) return cand2
      }
    } catch {}
  }

  // 4. If prefix is an abbreviation/code and its specific title thumbnail does not exist:
  // Fall back to ID (e.g. ID.jpg, ID.png, idaraat) as the default!
  if (prefix) {
    const idCandidates = ['ID', 'id', 'Id', 'Idaraat', 'idaraat', 'IDAARA']
    for (const name of idCandidates) {
      const f = findFile(titlesFolder, name)
      if (f) return f
      const inPool = availableImages.find(img => {
        const stem = path.basename(img.name, path.extname(img.name)).toLowerCase().trim()
        return stem === name.toLowerCase()
      })
      if (inPool) return inPool.path
    }
  }

  // 5. Standard fallback names in titlesFolder or pool: ID, Title, Default, Thumbnail, Cover
  const standardFallbacks = ['ID', 'id', 'Title', 'title', 'Default', 'default', 'Thumbnail', 'thumbnail', 'Cover', 'cover', 'Main', 'main']
  for (const name of standardFallbacks) {
    const f = findFile(titlesFolder, name)
    if (f) return f
    const inPool = availableImages.find(img => {
      const stem = path.basename(img.name, path.extname(img.name)).toLowerCase()
      return stem === name.toLowerCase()
    })
    if (inPool) return inPool.path
  }

  // 6. Only use first available image as last resort when prefix is empty
  // Do NOT fall back to first image when prefix is set — it would override the
  // detected prefix with the wrong image filename (e.g. M.jpg overriding MZ prefix)
  if (!prefix && availableImages.length > 0) {
    return availableImages[0].path
  }

  return null
}

function getVideoInfo(filePath: string): {
  width: number; height: number; duration: number; fps: string
} | null {
  try {
    const ffprobeExe = getFfprobeExePath()
    const out = execFileSync(ffprobeExe, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration,r_frame_rate',
      '-of', 'json', filePath
    ], { windowsHide: true, env: process.env }).toString()
    const s = JSON.parse(out).streams[0]
    return {
      width: parseInt(s.width),
      height: parseInt(s.height),
      duration: parseFloat(s.duration ?? '0'),
      fps: s.r_frame_rate ?? '30/1'
    }
  } catch { return null }
}

function hasAudioStream(filePath: string): boolean {
  try {
    const ffprobeExe = getFfprobeExePath()
    const out = execFileSync(ffprobeExe, [
      '-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=index',
      '-of', 'json', filePath
    ], { windowsHide: true, env: process.env }).toString()
    const parsed = JSON.parse(out)
    return !!(parsed.streams && parsed.streams.length > 0)
  } catch { return false }
}

function getAudioSamples(filePath: string): number {
  const ffprobeExe = getFfprobeExePath()
  try {
    const out = execFileSync(ffprobeExe, [
      '-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=duration,sample_rate',
      '-of', 'json', filePath
    ], { windowsHide: true, env: process.env }).toString()
    const parsed = JSON.parse(out)
    const stream = parsed.streams?.[0]
    if (stream) {
      const duration = parseFloat(stream.duration ?? '0')
      const sampleRate = parseInt(stream.sample_rate ?? '48000')
      return Math.round(duration * sampleRate)
    }
  } catch {}
  try {
    const out = execFileSync(ffprobeExe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json', filePath
    ], { windowsHide: true, env: process.env }).toString()
    const parsed = JSON.parse(out)
    const duration = parseFloat(parsed.format?.duration ?? '0')
    return Math.round(duration * 48000)
  } catch {}
  return 0
}

function detectSilence(filePath: string, vidDuration: number): {
  nonSilent: Array<[number, number]>;
  isSpecialAudioCondition: boolean;
  onlyTitleScreensSilent: boolean;
  startSilenceDuration: number;
  endSilenceDuration: number;
} {
  try {
    const ffmpegExe = getFfmpegExePath()
    const out = spawnSync(ffmpegExe, [
      '-i', filePath, '-map', '0:a',
      '-af', 'silencedetect=n=-45dB:d=1.5',
      '-f', 'null', '-'
    ], { windowsHide: true, env: process.env }).stderr?.toString() ?? ''

    const starts = [...out.matchAll(/silence_start: (\S+)/g)].map(m => parseFloat(m[1]))
    const ends   = [...out.matchAll(/silence_end: (\S+)/g)].map(m => parseFloat(m[1]))

    const silent: Array<[number, number]> = starts.map((s, i) => [
      Math.max(0, s), Math.min(ends[i] ?? vidDuration, vidDuration)
    ] as [number, number]).sort((a, b) => a[0] - b[0])

    // Find silence at the very start
    let startSilenceDuration = 0
    if (silent.length > 0 && silent[0][0] <= 0.1) {
      startSilenceDuration = silent[0][1] - silent[0][0]
    }

    // Find silence at the very end
    let endSilenceDuration = 0
    if (silent.length > 0) {
      const last = silent[silent.length - 1]
      if (last[1] >= vidDuration - 0.1) {
        endSilenceDuration = last[1] - last[0]
      }
    }

    const nonSilent: Array<[number, number]> = []
    let pos = 0
    for (const [ss, se] of silent) {
      if (pos < ss - 0.05) nonSilent.push([pos, ss])
      pos = Math.max(pos, se)
    }
    if (pos < vidDuration - 0.05) nonSilent.push([pos, vidDuration])

    const hasOgAudio = nonSilent.length > 0 && nonSilent.some(([s, e]) => (e - s) > 0.1)
    // Special audio triggers when silence at start OR end is present but
    // LESS than 10 seconds. A short silent region means the video's
    // intro/outro title screens don't have enough room for the regular
    // background audio, so we use a shorter instrumental track from the
    // titles/Special folder instead.
    const isSpecialAudioCondition =
      ((startSilenceDuration > 0 && startSilenceDuration < 10) ||
       (endSilenceDuration > 0 && endSilenceDuration < 10)) &&
      hasOgAudio
    const onlyTitleScreensSilent = silent.every(([s, e]) => 
      (s <= 0.5 && (e - s) <= 2.0) || 
      (e >= vidDuration - 0.5 && (e - s) <= 2.0)
    ) && hasOgAudio

    return { nonSilent, isSpecialAudioCondition, onlyTitleScreensSilent, startSilenceDuration, endSilenceDuration }
  } catch {
    return { nonSilent: [], isSpecialAudioCondition: false, onlyTitleScreensSilent: false, startSilenceDuration: 0, endSilenceDuration: 0 }
  }
}

/**
 * Returns all silent gaps inside the video (derived from nonSilentSegs) that are
 * shorter than maxSilDuration seconds.  These are the segments that get filled
 * with the Instrumental track for mute-exception videos.
 */
function computeShortSilentSegs(
  nonSilentSegs: Array<[number, number]>,
  vidDuration: number,
  maxSilDuration: number
): Array<[number, number]> {
  const result: Array<[number, number]> = []
  let pos = 0
  for (const [ns, ne] of nonSilentSegs) {
    if (ns > pos + 0.05) {
      const silDur = ns - pos
      if (silDur < maxSilDuration) {
        result.push([pos, ns])
      }
    }
    pos = ne
  }
  // Trailing silence after the last non-silent segment
  if (pos < vidDuration - 0.05) {
    const silDur = vidDuration - pos
    if (silDur < maxSilDuration) {
      result.push([pos, vidDuration])
    }
  }
  return result
}


/**
 * Extracts the title prefix/code from a video filename using three optimized matching logic modes:
 *
 * 1. EMBEDDED CAMERA SEQUENCE MATCH (New 3rd Logic):
 *    Handles complex camera/volume serial names such as:
 *    - "V-1448-01-22 _02E-10-01Z-30355757" -> returns "Z"
 *    - "V-1448-01-22 _02E-10-01Z-"          -> returns "Z"
 *    - "V-1448-01-22 _02E-10-01Z"           -> returns "Z"
 *    - "V-1448-01-22 _02E-10-01Q-30355757"  -> returns "Q"
 *    - "V-1448-01-22 _02E-10-01MZ-30355757" -> returns "MZ"
 *
 * 2. SUFFIX MATCHING:
 *    Matches standard suffix formats like "C0220_01-Z", "Clip1_02-AQ", "001_01-Namaz"
 *
 * 3. PREFIX MATCHING:
 *    Matches standard prefix formats like "001 Z01", "002 Q02", "Z01", "WAAZ 01"
 *
 * Supported Codes: Q, M, Z, MZ, ID, WAAZ, AQ, N, BQ, BZ, BM
 * Aliases: NAMAZ/NIKAAH -> N, BETHAK -> AQ, ZIYAFAT -> Z, MAJLIS -> M, QADAM -> Q, IDAARA -> ID
 */
function getPrefix(name: string, logicMode?: string): string {
  if (!name) return ''
  const mode = logicMode || (get('code_parsing_logic', 'auto') as string) || 'auto'
  const cleanBase = name.replace(/\.(tmp|temp)$/i, '').trim()
  const rawStem = cleanBase.replace(/\.[^/.]+$/, '').trim()

  // Strip volume/disc tag pattern (e.g. "_01M-", "_02E-", "_01V-") so sequence item codes take precedence
  const stem = rawStem.replace(/_\d{1,3}[A-Za-z](?:-|_|\s|$)/gi, '_')

  const normalizeCode = (raw: string): string => {
    const upper = raw.toUpperCase().trim()
    if (upper === 'NAMAZ' || upper === 'NIKAAH' || upper === 'NIKAH') return 'N'
    if (upper === 'BETHAK') return 'AQ'
    if (upper === 'ZIYAFAT' || upper === 'ZIARAT' || upper === 'ZIYARAT') return 'Z'
    if (upper === 'MAJLIS') return 'M'
    if (upper === 'QADAM') return 'Q'
    if (upper === 'IDAARA') return 'ID'
    if (upper === 'WAAZ') return 'WAAZ'

    const m = upper.match(/^(?:\d+[\s-_]*)?([A-Z]+)(?:[\s-_]*\d+)?$/)
    if (m && m[1]) return m[1]

    return upper
  }

  // List of known category codes ordered by length descending so longer codes take precedence
  const knownCodes = [
    'ONLINE', 'MISBAH', 'NIKAAH', 'NIKAH', 'ZIYAFAT', 'MAJLIS', 'BETHAK', 'IDAARA', 'NAMAZ', 'QADAM', 'WAAZ',
    'QMZ', 'IFS', 'KGS', 'MKB', 'MUL', 'MYN', 'TJR', 'TQN', 'TNQ', 'FMB', 'MZ', 'AQ', 'BM', 'BQ', 'BZ',
    'ID', 'IF', 'IST', 'MF', 'MO', 'MQ', 'OD', 'OZ', 'SH', 'SQ', 'TQ', 'WD', 'ZO',
    'Q', 'M', 'Z', 'N', 'H'
  ]
  const validNormalizedCodes = new Set([
    'Q', 'M', 'Z', 'MZ', 'ID', 'OD', 'OZ', 'ZO', 'WAAZ', 'AQ', 'N', 'BQ', 'BZ', 'BM',
    'FMB', 'QMZ', 'IFS', 'KGS', 'MKB', 'MUL', 'MYN', 'TJR', 'TQN', 'TNQ', 'MISBAH', 'ONLINE',
    'SH', 'SQ', 'TQ', 'WD', 'H', 'IF', 'IST', 'MF', 'MO', 'MQ'
  ])

  const isValidCode = (c: string): boolean => {
    if (!c) return false
    return validNormalizedCodes.has(c) || /^[A-Z]{2,6}$/.test(c)
  }

  // ------------------------------------------------------------------------
  // LOGIC 1: EMBEDDED CAMERA SEQUENCE CODE MATCHING
  // Search for matches and prioritize rightmost/sequence item matches
  // ------------------------------------------------------------------------
  const regPattern = /\d+[\s-_]*(ONLINE|MISBAH|NIKAAH|NIKAH|ZIYAFAT|MAJLIS|BETHAK|IDAARA|NAMAZ|QADAM|WAAZ|QMZ|IFS|KGS|MKB|MUL|MYN|TJR|TQN|TNQ|FMB|MZ|AQ|BM|BQ|BZ|ID|IF|IST|MF|MO|MQ|OD|OZ|SH|SQ|TQ|WD|ZO|Q|M|Z|N|H)(?:[\s-_]*\d+)?(?:[\s-_]|$)/gi

  const matches = [...stem.matchAll(regPattern)]
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1]
    if (lastMatch && lastMatch[1]) {
      const code = normalizeCode(lastMatch[1])
      if (isValidCode(code)) {
        return code
      }
    }
  }

  // Fallback to rawStem matching if stripped stem gave no match
  const rawMatches = [...rawStem.matchAll(regPattern)]
  if (rawMatches.length > 0) {
    const lastMatch = rawMatches[rawMatches.length - 1]
    if (lastMatch && lastMatch[1]) {
      const code = normalizeCode(lastMatch[1])
      if (isValidCode(code)) {
        return code
      }
    }
  }

  // ------------------------------------------------------------------------
  // LOGIC 2: SUFFIX MODE MATCHING
  // Handles formats like "01-Z", "03-Q", "001 01-Z", "C0220_01-Z"
  // ------------------------------------------------------------------------
  if (mode === 'suffix' || mode === 'auto') {
    const suffixMatch = stem.match(/(?:^|[\s-_])(?:(\d{1,3}[\s-_]+)?(ONLINE|MISBAH|NIKAAH|ZIYAFAT|MAJLIS|BETHAK|IDAARA|NAMAZ|QADAM|WAAZ|QMZ|IFS|KGS|MKB|MUL|MYN|TJR|TQN|TNQ|FMB|MZ|AQ|BM|BQ|BZ|ID|IF|IST|MF|MO|MQ|OD|OZ|SH|SQ|TQ|WD|ZO|Q|M|Z|N|H)(?:[\s-_]*\d+)?)(?:[\s-_]|$)/i)

    if (suffixMatch && suffixMatch[2]) {
      const code = normalizeCode(suffixMatch[2])
      if (isValidCode(code)) {
        return code
      }
    }
  }

  // ------------------------------------------------------------------------
  // LOGIC 3: PREFIX MODE MATCHING
  // Handles formats like "001 Z01", "002 Q02", "Z01", "WAAZ 01"
  // ------------------------------------------------------------------------
  if (mode === 'prefix' || mode === 'auto') {
    let cleanName = stem.replace(/^(?:\d+[\s-_]*)+/, '').trim()
    if (!cleanName) cleanName = stem

    const upperClean = cleanName.toUpperCase()
    for (const code of knownCodes) {
      if (upperClean.startsWith(code)) {
        const norm = normalizeCode(code)
        if (isValidCode(norm)) {
          return norm
        }
      }
    }

    const parts = cleanName.split(/[\s-_]+/).filter(Boolean)
    if (parts.length > 0) {
      const token = parts[0]
      const m = token.match(/^([A-Za-z]+)/)
      if (m && m[1]) {
        const norm = normalizeCode(m[1])
        if (isValidCode(norm)) {
          return norm
        }
      }
    }
  }

  // ------------------------------------------------------------------------
  // FALLBACK: Search anywhere in stem for a known category code surrounded by non-alpha characters
  // ------------------------------------------------------------------------
  const upperStem = stem.toUpperCase()
  for (const code of knownCodes) {
    const reg = new RegExp(`(?:^|[^A-Z])${code}(?:[^A-Z]|$)`, 'i')
    if (reg.test(upperStem)) {
      const norm = normalizeCode(code)
      if (isValidCode(norm)) {
        return norm
      }
    }
  }

  return ''
}

function extractStandardizedFolder(paths: (string | undefined)[]): string | null {
  for (const p of paths) {
    if (!p) continue
    const parts = p.split(/[\\/]/).filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      const seg = parts[i]
      if (seg.toLowerCase() === 'dvd') continue
      if (/^\d{4}[- _.]\d{1,2}(?:[- _.]\d{1,2})?(?:[- _.]+(.+))?$/i.test(seg) || /^\d{2}[- _.]+[A-Za-z]+[- _.]+[A-Za-z0-9]+$/i.test(seg)) {
        return seg
      }
    }
  }
  return null
}

function getDateFolderName(sourceOrVideoPath: string): string {
  if (!sourceOrVideoPath) return ''
  let cleanPath = path.normalize(sourceOrVideoPath).replace(/[\\/]+$/, '')
  try {
    if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isFile()) {
      cleanPath = path.dirname(cleanPath)
    }
  } catch {}

  if (path.basename(cleanPath).toLowerCase() === 'dvd') {
    return path.basename(path.dirname(cleanPath))
  }

  const dvdSub = path.join(cleanPath, 'DVD')
  if (fs.existsSync(dvdSub)) {
    return path.basename(cleanPath)
  }

  const stdFolder = extractStandardizedFolder([cleanPath])
  if (stdFolder) {
    return stdFolder
  }

  return path.basename(cleanPath)
}

function parseSafarFromCandidatePaths(paths: (string | undefined)[]): SafarParsedInfo {
  let best: SafarParsedInfo = { safar: 'Unassigned', safarName: 'Unassigned', city: 'Unassigned' }
  for (const p of paths) {
    if (!p) continue
    const info = parseSafarFromPath(p)
    if (info.safar && info.safar !== 'Unassigned') {
      best.safar = info.safar
      best.safarName = info.safarName
      best.safarYear = info.safarYear ?? best.safarYear
      best.safarSerial = info.safarSerial ?? best.safarSerial
      if (info.city && info.city !== 'Unassigned') best.city = info.city
    }
    if (info.city && info.city !== 'Unassigned') best.city = info.city
    if (info.dateFolder) best.dateFolder = info.dateFolder
    if (info.hijriYear) best.hijriYear = info.hijriYear
    if (info.hijriMonth) best.hijriMonth = info.hijriMonth
    if (info.hijriDay) best.hijriDay = info.hijriDay
    if (info.session) best.session = info.session
    if (info.sessionTag) best.sessionTag = info.sessionTag
    if (info.eventCode) best.eventCode = info.eventCode
  }
  return best
}

function getBatchVideos(batchSource: string): string[] {
  const { files } = resolveVideoFolderAndFiles(batchSource)
  return files.map(f => f.fullPath).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

// ── Special1 audio helper ───────────────────────────────────
// Returns the path to "special1.mp3" (or .wav/.m4a/.aac) in the titles folder.
// Used as default audio for WAAZ and ID prefixed videos.
function getSpecial1AudioPath(titlesFolder: string): string | null {
  if (!titlesFolder || !fs.existsSync(titlesFolder)) return null
  const AUDIO_EXTS_LIST = ['.mp3', '.wav', '.m4a', '.aac']
  // Check main titles folder first, then Special subfolder
  for (const dir of [titlesFolder, path.join(titlesFolder, 'Special')]) {
    for (const ext of AUDIO_EXTS_LIST) {
      const f = path.join(dir, `special1${ext}`)
      if (fs.existsSync(f)) return f
      // Also check case variants
      const fUpper = path.join(dir, `Special1${ext}`)
      if (fs.existsSync(fUpper)) return fUpper
    }
  }
  return null
}

// Returns true if the identifier (prefix, thumbnail path/name, video name) represents WAAZ or ID
export function isSpecialWaazOrId(identifier?: string | null): boolean {
  if (!identifier || typeof identifier !== 'string') return false
  const clean = identifier.replace(/\.(tmp|temp)$/i, '').trim()
  const base = clean.split(/[\\/]/).pop() || clean
  const stem = base.replace(/\.[^/.]+$/, '').trim()
  const upperStem = stem.toUpperCase()

  if (upperStem === 'ID' || upperStem === 'WAAZ' || upperStem === 'IDAARA' || upperStem === 'IDARAAT') {
    return true
  }

  const waazOrIdPattern = /(?:^|[\s_.-])(?:ID|WAAZ|IDAARA|IDARAAT)(?:[\s_.-]|$)/i
  return waazOrIdPattern.test(stem)
}

function isSpecialPrefix(prefix: string): boolean {
  return isSpecialWaazOrId(prefix)
}

// ── Safar Final Output Path Resolver ─────────────────────────────
// Analyzes a video path: resolves its date folder (or DVD folder of that date),
// finds the Safar root folder, checks for the Final folder of that Safar, and verifies if that date exists in Final.
export function resolveSafarFinalPathForVideo(videoPath: string): {
  success: boolean
  targetPath: string
  dateFolder: string
  safarFolder: string
  safarName: string
  finalFolder: string
  dateFolderExistsInFinal: boolean
  reason?: string
} {
  if (!videoPath || typeof videoPath !== 'string') {
    return {
      success: false,
      targetPath: '',
      dateFolder: '',
      safarFolder: '',
      safarName: '',
      finalFolder: '',
      dateFolderExistsInFinal: false,
      reason: 'No video path provided'
    }
  }

  let clean = path.normalize(videoPath.trim()).replace(/[\\/]+$/, '')
  try {
    if (fs.existsSync(clean) && fs.statSync(clean).isFile()) {
      clean = path.dirname(clean)
    }
  } catch {
    if (/\.[a-z0-9]{2,4}$/i.test(clean)) {
      clean = path.dirname(clean)
    }
  }

  // 1. Identify Date folder and DVD folder
  let dateFolderName = ''
  let dateFolderPath = ''

  if (path.basename(clean).toLowerCase() === 'dvd') {
    dateFolderPath = path.dirname(clean)
    dateFolderName = path.basename(dateFolderPath)
  } else {
    const subDvd = path.join(clean, 'DVD')
    const subDvdLower = path.join(clean, 'dvd')
    if (fs.existsSync(subDvd) || fs.existsSync(subDvdLower)) {
      dateFolderPath = clean
      dateFolderName = path.basename(clean)
    } else {
      let temp = clean
      let foundDvd = false
      for (let i = 0; i < 4; i++) {
        if (!temp || temp === path.dirname(temp)) break
        if (path.basename(temp).toLowerCase() === 'dvd') {
          dateFolderPath = path.dirname(temp)
          dateFolderName = path.basename(dateFolderPath)
          foundDvd = true
          break
        }
        temp = path.dirname(temp)
      }

      if (!foundDvd) {
        const stdFolder = extractStandardizedFolder([clean])
        if (stdFolder) {
          dateFolderName = stdFolder
          let walk = clean
          while (walk && walk !== path.dirname(walk)) {
            if (path.basename(walk).toLowerCase() === stdFolder.toLowerCase()) {
              dateFolderPath = walk
              break
            }
            walk = path.dirname(walk)
          }
        }
        if (!dateFolderName) {
          dateFolderPath = clean
          dateFolderName = path.basename(clean)
        }
      }
    }
  }

  // 2. Identify Safar Folder and Final directory
  let safarFolder = ''
  let finalFolder = ''
  let targetPath = ''
  let dateFolderExistsInFinal = false

  // First priority: Check if the date folder itself contains a Final or Final Titles subfolder!
  // e.g. <Safar>/<DateFolder>/Final
  if (dateFolderPath && fs.existsSync(dateFolderPath)) {
    try {
      const dEntries = fs.readdirSync(dateFolderPath, { withFileTypes: true })
      const innerFinal = dEntries.find(e => e.isDirectory() && (e.name.toLowerCase() === 'final' || e.name.toLowerCase() === 'final titles'))
      if (innerFinal) {
        targetPath = path.join(dateFolderPath, innerFinal.name)
        finalFolder = targetPath
        safarFolder = path.dirname(dateFolderPath)
        dateFolderExistsInFinal = true
      }
    } catch {}
  }

  // Second priority: If date folder does not contain Final, search ancestor folders (e.g. <Safar>/Final/<DateFolder>)
  if (!targetPath) {
    let curSearch = dateFolderPath ? path.dirname(dateFolderPath) : clean

    for (let depth = 0; depth < 5; depth++) {
      if (!curSearch || curSearch === path.dirname(curSearch)) break
      try {
        if (fs.existsSync(curSearch)) {
          const entries = fs.readdirSync(curSearch, { withFileTypes: true })
          const finalEnt = entries.find(e => e.isDirectory() && (e.name.toLowerCase() === 'final' || e.name.toLowerCase() === 'final titles'))
          if (finalEnt) {
            safarFolder = curSearch
            finalFolder = path.join(curSearch, finalEnt.name)
            break
          }
        }
      } catch {}
      curSearch = path.dirname(curSearch)
    }

    // Fallback: If no Final folder found on disk yet, use safarHierarchy to determine Safar folder
    if (!safarFolder && dateFolderPath) {
      const parentDir = path.dirname(dateFolderPath)
      safarFolder = parentDir
      finalFolder = path.join(safarFolder, 'Final')
    }

    if (finalFolder) {
      if (fs.existsSync(finalFolder)) {
        try {
          const subEnts = fs.readdirSync(finalFolder, { withFileTypes: true })
          // Exact match
          const exact = subEnts.find(e => e.isDirectory() && e.name.toLowerCase() === dateFolderName.toLowerCase())
          if (exact) {
            targetPath = path.join(finalFolder, exact.name)
            dateFolderExistsInFinal = true
          } else {
            // Date prefix match (e.g. 1448-02-29)
            const dateMatch = dateFolderName.match(/(\d{4}[-_.]\d{1,2}(?:[-_.]\d{1,2})?)/i)
            if (dateMatch) {
              const datePrefix = dateMatch[1].toLowerCase()
              const loose = subEnts.find(e => e.isDirectory() && e.name.toLowerCase().includes(datePrefix))
              if (loose) {
                targetPath = path.join(finalFolder, loose.name)
                dateFolderExistsInFinal = true
              }
            }
          }
        } catch {}
      }

      if (!targetPath) {
        targetPath = path.join(finalFolder, dateFolderName)
        dateFolderExistsInFinal = fs.existsSync(targetPath)
      }
    }
  }

  const safarName = safarFolder ? path.basename(safarFolder) : ''

  if (targetPath) {
    return {
      success: true,
      targetPath,
      dateFolder: dateFolderName,
      safarFolder,
      safarName,
      finalFolder,
      dateFolderExistsInFinal
    }
  }

  return {
    success: false,
    targetPath: clean,
    dateFolder: dateFolderName,
    safarFolder,
    safarName,
    finalFolder,
    dateFolderExistsInFinal: false,
    reason: 'Could not resolve Final directory for Safar'
  }
}

export function registerTitleAdderIPC(getWin: WinGetter): void {
  ipcMain.handle('titleAdder:previewAudioAssignments', async (_e, params: {
    mode: 'batch' | 'single'
    batchSource?: string
    batchSource2?: string
    batchSources?: string[]
    videoFiles?: string[]
  }) => {
    const batchSources = (params.batchSources && params.batchSources.length > 0)
      ? params.batchSources.filter(Boolean)
      : [params.batchSource, params.batchSource2].filter(Boolean) as string[]

    const primarySource = batchSources[0]
    const titlesFolder = resolveTitlesFolder(get('titles_folder') as string, primarySource)
    const pool = buildAudioPool(titlesFolder)
    const nikahAudio = getNikahAudio(titlesFolder)
    const availableAudio = getAllAvailableAudioFiles(titlesFolder)

    const availableTitleImages: Array<{ name: string; path: string }> = []
    const seenImagePaths = new Set<string>()

    const scanDirForImages = (dir: string) => {
      if (!dir || !fs.existsSync(dir)) return
      try {
        const files = fs.readdirSync(dir)
        for (const f of files) {
          const ext = path.extname(f).toLowerCase()
          if (IMG_EXTS.includes(ext)) {
            const p = path.join(dir, f)
            if (!seenImagePaths.has(p.toLowerCase())) {
              seenImagePaths.add(p.toLowerCase())
              availableTitleImages.push({
                name: f,
                path: p
              })
            }
          }
        }
      } catch {}
    }

    if (titlesFolder) scanDirForImages(titlesFolder)

    // Scan all batchSources subdirectories if available
    for (const src of batchSources) {
      if (fs.existsSync(src)) {
        scanDirForImages(path.join(src, 'Final Titles'))
        scanDirForImages(path.join(src, 'Titles'))
        scanDirForImages(path.join(src, 'Title'))
        scanDirForImages(path.join(src, 'Thumbnails'))
      }
    }
    if (availableTitleImages.length === 0) {
      for (const src of batchSources) {
        if (fs.existsSync(src)) {
          scanDirForImages(src)
        }
      }
    }

    let videos: string[] = []
    if (params.mode === 'batch' && batchSources.length > 0) {
      for (const src of batchSources) {
        const bVids = getBatchVideos(src)
        for (const bv of bVids) {
          if (!videos.includes(bv)) {
            videos.push(bv)
          }
        }
      }

      if (params.videoFiles && params.videoFiles.length > 0) {
        const expSet = new Set(params.videoFiles.map(e => getCanonicalStem(e)))
        const filtered = videos.filter(v => expSet.has(getCanonicalStem(v)))
        if (filtered.length > 0) {
          videos = filtered
        }
      }
    } else {
      videos = params.videoFiles ?? []
    }
    videos = videos.filter(v => !isGroupPhotoVideo(v))

    const special1Path = getSpecial1AudioPath(titlesFolder)
    let normalIdx = 0
    const assignments: Array<{
      videoPath: string
      videoName: string
      prefix: string
      defaultAudioPath: string
      defaultAudioName: string
      defaultTitleImagePath: string
      defaultTitleImageName: string
      isNikah: boolean
      isSpecialWaazId: boolean
    }> = []

    for (const videoPath of videos) {
      const cleanBase = path.basename(videoPath).replace(/\.(tmp|temp)$/i, '')
      const stem = cleanBase.replace(/\.[^/.]+$/, '')
      const prefix = getPrefix(cleanBase)
      const defaultImg = findTitleImageForVideo(titlesFolder, prefix, videoPath, availableTitleImages)
      const isNikah = prefix.toUpperCase() === 'N'
      const isWaazId = isSpecialWaazOrId(prefix) || isSpecialWaazOrId(defaultImg) || isSpecialWaazOrId(cleanBase)

      let assignedPath: string | null = null
      if (isNikah) {
        assignedPath = nikahAudio || (pool[0] ?? null)
      } else if (isWaazId && special1Path) {
        // WAAZ and ID prefixes default to special1.mp3 unless overridden by user
        assignedPath = special1Path
      } else {
        assignedPath = getAudioForVideo(prefix, normalIdx, pool, titlesFolder)
        normalIdx++
      }

      const assignedName = assignedPath ? path.basename(assignedPath) : 'None'

      assignments.push({
        videoPath,
        videoName: path.basename(videoPath),
        prefix,
        defaultAudioPath: assignedPath || '',
        defaultAudioName: assignedName,
        defaultTitleImagePath: defaultImg || '',
        defaultTitleImageName: defaultImg ? path.basename(defaultImg) : 'No title image',
        isNikah,
        isSpecialWaazId: isWaazId
      })
    }

    return {
      availableAudio,
      availableTitleImages,
      assignments
    }
  })

  ipcMain.handle('titleAdder:validatePath', async (_e, targetPath: string) => {
    if (!targetPath || typeof targetPath !== 'string') {
      return { valid: false, exists: false, reason: 'No path specified' }
    }
    try {
      const norm = path.resolve(targetPath.trim())
      const parsed = path.parse(norm)
      if (parsed.root && !fs.existsSync(parsed.root)) {
        return { valid: false, exists: false, reason: `Drive "${parsed.root}" does not exist or is disconnected` }
      }
      if (fs.existsSync(norm)) {
        const stat = fs.statSync(norm)
        return { valid: true, exists: true, isDirectory: stat.isDirectory() }
      }
      // Check if parent folder exists so subfolder can be created
      const parent = path.dirname(norm)
      if (fs.existsSync(parent)) {
        return { valid: true, exists: false, canCreate: true }
      }
      return { valid: false, exists: false, reason: `Folder does not exist and parent path is unreachable` }
    } catch (err: any) {
      return { valid: false, exists: false, reason: err?.message || 'Invalid path format' }
    }
  })

  ipcMain.handle('titleAdder:resolveSafarFinalPath', async (_e, videoPath: string) => {
    return resolveSafarFinalPathForVideo(videoPath)
  })

  ipcMain.handle('titleAdder:start', async (_e, params: {
    mode: 'batch' | 'single'
    batchSource?: string
    batchSource2?: string
    batchSources?: string[]
    videoFiles?: string[]
    outputFolder: string
    duration: number
    jobId: string
    addToStats: boolean
    muteOriginal: boolean
    muteExceptions?: string[]
    watermarkExceptions?: string[]
    audioAssignments?: Record<string, string>
    titleImageAssignments?: Record<string, string>
    videoMuteSelections?: Record<string, boolean>
    thumbnailMode?: 'default' | 'front_only' | 'back_only' | 'both'
    thumbnailModeSelections?: Record<string, 'default' | 'front_only' | 'back_only' | 'both'>
    skipFront?: boolean
    skipBack?: boolean
  }) => {
    const win = getWin()
    if (!win) return

    const send = (channel: string, data: unknown): void => {
      try { win.webContents.send(channel, data) } catch { /* win closed */ }
    }

    const batchSources = (params.batchSources && params.batchSources.length > 0)
      ? params.batchSources.filter(Boolean)
      : [params.batchSource, params.batchSource2].filter(Boolean) as string[]

    const primarySource = batchSources[0]
    const titlesFolder = resolveTitlesFolder(get('titles_folder') as string, primarySource)
    const pool = buildAudioPool(titlesFolder)
    const nikahAudio = getNikahAudio(titlesFolder)
    const end = findFile(titlesFolder, 'End')
    const wm  = findFile(titlesFolder, 'Watermark')
    const mode = get('audio_assignment_mode', 'single') as string
    const special1AudioPath = getSpecial1AudioPath(titlesFolder)

    const availableTitleImages: Array<{ name: string; path: string }> = []
    const seenStartImg = new Set<string>()
    const scanStartDir = (dir: string) => {
      if (!dir || !fs.existsSync(dir)) return
      try {
        for (const f of fs.readdirSync(dir)) {
          if (IMG_EXTS.includes(path.extname(f).toLowerCase())) {
            const p = path.join(dir, f)
            if (!seenStartImg.has(p.toLowerCase())) {
              seenStartImg.add(p.toLowerCase())
              availableTitleImages.push({ name: f, path: p })
            }
          }
        }
      } catch {}
    }
    if (titlesFolder) scanStartDir(titlesFolder)
    for (const src of batchSources) {
      if (fs.existsSync(src)) {
        scanStartDir(path.join(src, 'Final Titles'))
        scanStartDir(path.join(src, 'Titles'))
        scanStartDir(path.join(src, 'Title'))
        scanStartDir(path.join(src, 'Thumbnails'))
      }
    }
    if (availableTitleImages.length === 0) {
      for (const src of batchSources) {
        if (fs.existsSync(src)) scanStartDir(src)
      }
    }

    let videos: string[] = []

    if (params.mode === 'batch' && batchSources.length > 0) {
      for (const src of batchSources) {
        const bVids = getBatchVideos(src)
        for (const bv of bVids) {
          if (!videos.includes(bv)) {
            videos.push(bv)
          }
        }
      }
      if (params.videoFiles && params.videoFiles.length > 0) {
        const expSet = new Set(params.videoFiles.map(e => getCanonicalStem(e)))
        const filtered = videos.filter(v => expSet.has(getCanonicalStem(v)))
        if (filtered.length > 0) {
          videos = filtered
        }
      }
      if (videos.length === 0) {
        send('titleAdder:log', { jobId: params.jobId, message: "✖ No video files found in selected source folder(s).", level: 'error' })
        send('titleAdder:done', { jobId: params.jobId, success: false })
        return
      }
    } else {
      videos = params.videoFiles ?? []
    }
    videos = videos.filter(v => !isGroupPhotoVideo(v))

    send('titleAdder:log', { jobId: params.jobId, message: `📋 Processing ${videos.length} video(s)`, level: 'info' })
    send('titleAdder:found', { jobId: params.jobId, total: videos.length })

    // Extract date folder name ONLY in single-batch mode
    let actualOutputDir = params.outputFolder || ''
    if (params.mode === 'batch' && batchSources.length === 1) {
      const dateFolder = getDateFolderName(batchSources[0])
      if (actualOutputDir && dateFolder) {
        const normOut = path.normalize(actualOutputDir).replace(/[\\/]+$/, '')
        const segments = normOut.split(/[\\/]/).filter(Boolean).map(s => s.toLowerCase())
        if (!segments.includes(dateFolder.toLowerCase()) && path.basename(normOut).toLowerCase() !== dateFolder.toLowerCase()) {
          actualOutputDir = path.join(actualOutputDir, dateFolder)
        }
      }
    }

    // Validate that the output drive / directory exists before starting rendering
    const targetOut = actualOutputDir || params.outputFolder || ''
    if (!targetOut) {
      send('titleAdder:log', { jobId: params.jobId, message: '✖ ERROR: Output folder is empty or not specified. Please select a valid output path.', level: 'error' })
      send('titleAdder:done', { jobId: params.jobId, success: false, error: 'No output folder specified' })
      return
    }

    try {
      const parsedOut = path.parse(path.resolve(targetOut))
      if (parsedOut.root && !fs.existsSync(parsedOut.root)) {
        send('titleAdder:log', { jobId: params.jobId, message: `✖ ERROR: Target drive "${parsedOut.root}" does not exist or is disconnected. Please choose a valid output directory.`, level: 'error' })
        send('titleAdder:done', { jobId: params.jobId, success: false, error: `Drive ${parsedOut.root} does not exist` })
        return
      }
      fs.mkdirSync(targetOut, { recursive: true })
    } catch (err: any) {
      send('titleAdder:log', { jobId: params.jobId, message: `✖ ERROR: Cannot access or create output path "${targetOut}": ${err?.message || err}. Please specify a proper existing folder path.`, level: 'error' })
      send('titleAdder:done', { jobId: params.jobId, success: false, error: 'Output path unreachable' })
      return
    }

    // Batch default thumbnail mode (can be overridden per-video)
    const batchDefaultMode = params.thumbnailMode || 'default'
    if (batchDefaultMode !== 'default') {
      const skipLabel = batchDefaultMode === 'both'
        ? 'BOTH Front and End Thumbnails will be EXCLUDED by default'
        : batchDefaultMode === 'front_only'
          ? 'FRONT Thumbnail will be EXCLUDED by default (End Outro only)'
          : 'BACK / End Thumbnail will be EXCLUDED by default (Front Intro only)'
      send('titleAdder:log', { jobId: params.jobId, message: `🖼 Batch Thumbnail Default: ${skipLabel}`, level: 'info' })
    }

    let normalIdx = 0
    let specialIdx = 0
    let done = 0
    let cancelled = false
    const batchOutputs: Record<string, string> = {}

    updateIslandState({
      active: true,
      done: false,
      jobId: params.jobId,
      totalVideos: videos.length,
      currentIdx: 1,
      percent: 0,
      outputFolder: targetOut,
      task: 'Preparing video render queue...'
    })

    // Listen for cancel signal — cancels immediately
    ipcMain.once(`titleAdder:cancel:${params.jobId}`, () => {
      cancelled = true
      cancelJob(params.jobId)
      updateIslandState({ active: false, done: true, success: false, task: 'Rendering Cancelled' })
      send('titleAdder:log', { jobId: params.jobId, message: '⛔ Job was cancelled immediately by user.', level: 'warn' })
      getWin()?.setProgressBar(-1)
      send('titleAdder:done', { jobId: params.jobId, success: false, cancelled: true, done, total: videos.length })
    })

    for (const rawVideoPath of videos) {
      if (cancelled) break

      if (isGroupPhotoVideo(rawVideoPath)) {
        send('titleAdder:log', { jobId: params.jobId, message: `  ⏭ SKIP — "${path.basename(rawVideoPath)}" is a Group Photo video.`, level: 'info' })
        continue
      }

      // If rawVideoPath points to a temp file, resolve to rendered .mp4 if it now exists on disk
      let videoPath = rawVideoPath
      if (isTempVideoFile(videoPath)) {
        const dir = path.dirname(videoPath)
        const cleanName = path.basename(videoPath).replace(/\.(tmp|temp)$/i, '').trim()
        const targetMp4 = cleanName.toLowerCase().endsWith('.mp4') ? path.join(dir, cleanName) : path.join(dir, `${cleanName}.mp4`)
        if (fs.existsSync(targetMp4)) {
          videoPath = targetMp4
        } else {
          send('titleAdder:log', { jobId: params.jobId, message: `  ⏳ SKIP — "${path.basename(rawVideoPath)}" is still pending render in Media Encoder (.mp4 not found yet).`, level: 'warn' })
          continue
        }
      }

      const cleanBase = path.basename(videoPath).replace(/\.(tmp|temp)$/i, '')
      const stem = cleanBase.replace(/\.[^/.]+$/, '')
      const canonicalStem = getCanonicalStem(videoPath)
      let prefix = getPrefix(cleanBase)
      if (!prefix) {
        prefix = extractEventCodeFromPath(videoPath, stem)
      }

      // ── Per-video header ──────────────────────────────────────
      send('titleAdder:log', { jobId: params.jobId, message: `\n━━━ [${done + 1}/${videos.length}] ${path.basename(videoPath)} ━━━`, level: 'info' })
      send('titleAdder:log', { jobId: params.jobId, message: `  Prefix detected: "${prefix}"`, level: 'info' })

      updateIslandState({
        active: true,
        done: false,
        jobId: params.jobId,
        totalVideos: videos.length,
        currentIdx: done + 1,
        videoName: path.basename(videoPath),
        task: `Rendering ${path.basename(videoPath)}`,
        outputFolder: targetOut
      })

      // Check user-selected title image assignment first (direct, stem, or canonical match)
      let explicitImgPath =
        params.titleImageAssignments?.[videoPath] ||
        params.titleImageAssignments?.[rawVideoPath] ||
        params.titleImageAssignments?.[path.basename(videoPath)] ||
        params.titleImageAssignments?.[path.basename(rawVideoPath)] ||
        params.titleImageAssignments?.[stem] ||
        params.titleImageAssignments?.[canonicalStem] ||
        params.titleImageAssignments?.[videoPath.replace(/\\/g, '/')] ||
        params.titleImageAssignments?.[rawVideoPath.replace(/\\/g, '/')] ||
        null

      if (!explicitImgPath && params.titleImageAssignments) {
        for (const [k, v] of Object.entries(params.titleImageAssignments)) {
          if (getCanonicalStem(k) === canonicalStem) {
            explicitImgPath = v
            break
          }
        }
      }

      let titleImg: string | null = null
      if (explicitImgPath && fs.existsSync(explicitImgPath)) {
        titleImg = explicitImgPath
        send('titleAdder:log', { jobId: params.jobId, message: `  🖼 [User Selected] Title image: ${path.basename(titleImg)}`, level: 'info' })
      } else {
        titleImg = findTitleImageForVideo(titlesFolder, prefix, videoPath, availableTitleImages)
        if (!titleImg) {
          send('titleAdder:log', { jobId: params.jobId, message: `  ✖ SKIP — No title image found for prefix "${prefix}" in: ${titlesFolder}`, level: 'warn' })
          send('titleAdder:log', { jobId: params.jobId, message: `       Expected "${prefix}.jpg", "ID.jpg", or "Title.jpg" in: ${titlesFolder}`, level: 'warn' })
          continue
        }
        send('titleAdder:log', { jobId: params.jobId, message: `  🖼 Title image: ${path.basename(titleImg)}`, level: 'info' })
      }

      // If prefix was not detected from filename but titleImg has a specific category name, use it
      if (titleImg && !prefix) {
        const imgCode = path.basename(titleImg, path.extname(titleImg)).toUpperCase().trim()
        if (imgCode && imgCode !== 'DEFAULT' && imgCode !== 'TITLE' && imgCode !== 'ID' && imgCode !== 'THUMBNAIL' && imgCode !== 'COVER') {
          prefix = imgCode
        }
      }

      const info = getVideoInfo(videoPath)
      if (!info) {
        send('titleAdder:log', { jobId: params.jobId, message: `  ✖ SKIP — Could not read video metadata (ffprobe failed). File may be corrupt or unsupported.`, level: 'error' })
        continue
      }
      send('titleAdder:log', { jobId: params.jobId, message: `  📐 ${info.width}×${info.height} · ${info.fps} fps · ${info.duration.toFixed(2)}s`, level: 'info' })

      const videoFilename = path.basename(videoPath).toLowerCase()
      const videoStem = stem.toLowerCase()

      // N prefix default is dedicated Nikah audio unless explicitly assigned by user
      const isNikah = prefix.toUpperCase() === 'N'
      const isWaazId = isSpecialWaazOrId(prefix) || isSpecialWaazOrId(titleImg) || isSpecialWaazOrId(cleanBase)

      const isExcluded = params.muteExceptions?.some(ex => {
        const lowerEx = ex.toLowerCase()
        const exStem = path.basename(lowerEx, path.extname(lowerEx))
        const exCanonical = getCanonicalStem(ex)
        return lowerEx === videoFilename || exStem === videoStem || exCanonical === canonicalStem
      }) ?? false

      let shouldMute = params.muteOriginal && !isExcluded

      // Check user explicit per-video mute selection
      let explicitMute =
        params.videoMuteSelections?.[videoPath] ??
        params.videoMuteSelections?.[rawVideoPath] ??
        params.videoMuteSelections?.[path.basename(videoPath)] ??
        params.videoMuteSelections?.[path.basename(rawVideoPath)] ??
        params.videoMuteSelections?.[stem] ??
        params.videoMuteSelections?.[canonicalStem] ??
        params.videoMuteSelections?.[videoPath.replace(/\\/g, '/')] ??
        params.videoMuteSelections?.[rawVideoPath.replace(/\\/g, '/')]

      if (explicitMute === undefined && params.videoMuteSelections) {
        for (const [k, v] of Object.entries(params.videoMuteSelections)) {
          if (getCanonicalStem(k) === canonicalStem) {
            explicitMute = v
            break
          }
        }
      }

      if (typeof explicitMute === 'boolean') {
        shouldMute = explicitMute
      } else {
        // Thumbnails and videos that are NOT ID or WAAZ MUST be muted automatically!
        shouldMute = !isWaazId
      }

      const isWatermarkExcluded = params.watermarkExceptions?.some(ex => {
        const lowerEx = ex.toLowerCase()
        const exStem = path.basename(lowerEx, path.extname(lowerEx))
        const exCanonical = getCanonicalStem(ex)
        return lowerEx === videoFilename || exStem === videoStem || exCanonical === canonicalStem
      }) ?? false
      const shouldAddWatermark = !isWatermarkExcluded
      const hasAudio = hasAudioStream(videoPath)

      let primary: string | null = null
      let isUserSelectedAudio = false

      // Check if user explicitly assigned an audio file for this video.
      // Lookup by: (1) full videoPath key, (2) rawVideoPath, (3) basename, (4) stem, (5) canonical stem.
      let explicitAudioPath =
        params.audioAssignments?.[videoPath] ||
        params.audioAssignments?.[rawVideoPath] ||
        params.audioAssignments?.[path.basename(videoPath)] ||
        params.audioAssignments?.[path.basename(rawVideoPath)] ||
        params.audioAssignments?.[stem] ||
        params.audioAssignments?.[canonicalStem] ||
        params.audioAssignments?.[videoPath.replace(/\\/g, '/')] ||
        params.audioAssignments?.[rawVideoPath.replace(/\\/g, '/')] ||
        null

      if (!explicitAudioPath && params.audioAssignments) {
        for (const [k, v] of Object.entries(params.audioAssignments)) {
          if (getCanonicalStem(k) === canonicalStem) {
            explicitAudioPath = v
            break
          }
        }
      }

      if (explicitAudioPath && explicitAudioPath.trim()) {
        if (fs.existsSync(explicitAudioPath)) {
          primary = explicitAudioPath
          isUserSelectedAudio = true
          send('titleAdder:log', { jobId: params.jobId, message: `  🎵 [User Selected] Using popup-assigned audio → "${path.basename(primary)}"`, level: 'info' })
        } else {
          send('titleAdder:log', { jobId: params.jobId, message: `  ⚠ Assigned audio file not found on disk: "${explicitAudioPath}". Falling back to default.`, level: 'warn' })
        }
      }

      if (!isUserSelectedAudio) {
        if (isNikah) {
          primary = nikahAudio
          if (primary) {
            send('titleAdder:log', { jobId: params.jobId, message: `  🎵 [Nikah] Using dedicated N-audio → ${path.basename(primary)}`, level: 'info' })
          } else {
            send('titleAdder:log', { jobId: params.jobId, message: `  ✖ SKIP — [Nikah] No N-audio file found in titles folder.`, level: 'error' })
            send('titleAdder:log', { jobId: params.jobId, message: `       Expected: N_A.mp3 / Nikah Audio.mp3 / NikahAudio.mp3 in: ${titlesFolder}`, level: 'error' })
            continue
          }
        } else if (isWaazId && special1AudioPath) {
          // WAAZ and ID prefixes use special1.mp3 by default (user may override in popup)
          primary = special1AudioPath
          send('titleAdder:log', { jobId: params.jobId, message: `  🎵 [WAAZ/ID Default] Using special1 audio → ${path.basename(special1AudioPath)}`, level: 'info' })
        } else {
          primary = getAudioForVideo(prefix, normalIdx, pool, titlesFolder,
            msg => send('titleAdder:log', { jobId: params.jobId, message: `  ⚠ ${msg}`, level: 'warn' }))
          normalIdx++
        }
      }

      if (!primary && !(isWaazId || (isExcluded && !isNikah))) {
        // Skip if no audio AND not a WAAZ/ID (which keeps OG audio) AND not a mute exception
        send('titleAdder:log', { jobId: params.jobId, message: `  ✖ SKIP — No audio found for prefix "${prefix}". Pool has ${pool.length} file(s).`, level: 'warn' })
        send('titleAdder:log', { jobId: params.jobId, message: `       Add "Audio 1.mp3" (or more) to: ${titlesFolder}`, level: 'warn' })
        continue
      }

      // Per-video thumbnail placement mode override
      const perVideoThumbMode =
        params.thumbnailModeSelections?.[videoPath] ||
        params.thumbnailModeSelections?.[rawVideoPath] ||
        params.thumbnailModeSelections?.[path.basename(videoPath)] ||
        params.thumbnailModeSelections?.[path.basename(rawVideoPath)] ||
        params.thumbnailModeSelections?.[stem] ||
        params.thumbnailModeSelections?.[canonicalStem] ||
        params.thumbnailModeSelections?.[videoPath.replace(/\\/g, '/')] ||
        params.thumbnailMode ||
        'default'

      const skipFront = perVideoThumbMode === 'front_only' || perVideoThumbMode === 'both'
      const skipBack = perVideoThumbMode === 'back_only' || perVideoThumbMode === 'both'

      if (skipFront || skipBack) {
        const modeDesc = (skipFront && skipBack)
          ? 'Pure Video (Both Front & Back Thumbnails Skipped)'
          : skipFront
            ? 'Front Thumbnail Skipped (End Outro only)'
            : 'Back Thumbnail Skipped (Front Intro only)'
        send('titleAdder:log', { jobId: params.jobId, message: `  🖼 Thumbnail mode: ${modeDesc}`, level: 'info' })
      }

      const customTransition = (!skipFront && titleImg) ? findTransitionFile(titlesFolder) : null
      const transDuration = customTransition ? 1.0 : 0
      const introDuration = skipFront ? 0 : params.duration
      const outroDuration = skipBack ? 0 : params.duration
      // Per-video output directory resolution for single and multi-folder batches
      let outDir = actualOutputDir || params.outputFolder
      if (params.mode === 'batch' && params.outputFolder) {
        let parentSource = batchSources.find(src => videoPath.toLowerCase().includes(path.normalize(src).toLowerCase()))
        if (!parentSource) {
          const vidDir = path.dirname(videoPath)
          parentSource = path.basename(vidDir).toLowerCase() === 'dvd' ? path.dirname(vidDir) : vidDir
        }

        const dateFolder = parentSource ? getDateFolderName(parentSource) : ''
        if (dateFolder) {
          const normOut = path.normalize(params.outputFolder).replace(/[\\/]+$/, '')
          const segments = normOut.split(/[\\/]/).filter(Boolean).map(s => s.toLowerCase())
          if (!segments.includes(dateFolder.toLowerCase()) && path.basename(normOut).toLowerCase() !== dateFolder.toLowerCase()) {
            outDir = path.join(normOut, dateFolder)
          } else {
            outDir = normOut
          }
        }
        if (parentSource) {
          batchOutputs[parentSource] = outDir
        }
      } else if (actualOutputDir) {
        if (batchSources[0]) {
          batchOutputs[batchSources[0]] = actualOutputDir
        }
      }

      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }
      const outputPath = path.join(outDir, path.basename(videoPath))
      const isCollision = path.resolve(videoPath).toLowerCase() === path.resolve(outputPath).toLowerCase()
      const tempOutputPath = isCollision 
        ? path.join(outDir, `.${path.basename(videoPath, path.extname(videoPath))}_temp_${Date.now()}${path.extname(videoPath)}`) 
        : outputPath
      send('titleAdder:log', { jobId: params.jobId, message: `  📁 Output: ${outputPath}`, level: 'info' })

      let nonSilentSegs: Array<[number, number]> | undefined = undefined

      // Run silence detection for WAAZ/ID (always), mute-exceptions (isExcluded), and non-muted normal videos
      if (!isNikah && (isWaazId || !shouldMute || isExcluded)) {
        send('titleAdder:log', { jobId: params.jobId, message: `  🔍 Analysing audio silence…`, level: 'info' })
        const res = detectSilence(videoPath, info.duration)
        nonSilentSegs = res.nonSilent
        const startSil = res.startSilenceDuration
        const endSil   = res.endSilenceDuration

        send('titleAdder:log', { jobId: params.jobId, message: `     Start silence: ${startSil > 0 ? startSil.toFixed(1) + 's' : 'none'} · End silence: ${endSil > 0 ? endSil.toFixed(1) + 's' : 'none'}`, level: 'info' })

        if (nonSilentSegs && nonSilentSegs.length > 0) {
          send('titleAdder:log', { jobId: params.jobId, message: `     Active audio segments: ${nonSilentSegs.length} (video has real audio)`, level: 'info' })
        } else {
          send('titleAdder:log', { jobId: params.jobId, message: `     No active audio segments detected (video may be fully silent)`, level: 'info' })
        }
      }

      // ── Per-video decision summary ────────────────────────────
      send('titleAdder:log', { jobId: params.jobId, message: `  🔇 Mute original audio: ${isWaazId ? 'NO (WAAZ/ID keeps OG audio)' : shouldMute ? 'YES' : 'NO (kept)'}${params.muteOriginal && isExcluded ? ' [mute exception — OG audio preserved]' : ''}`, level: 'info' })
      send('titleAdder:log', { jobId: params.jobId, message: `  🏷 Watermark: ${shouldAddWatermark ? 'YES' : 'NO (skipped)'}${isWatermarkExcluded ? ' [exception applied]' : ''}`, level: 'info' })
      if (isWaazId) {
        send('titleAdder:log', { jobId: params.jobId, message: `  ⭐ [WAAZ/ID] Instrumental fill mode: OG audio preserved + ${primary ? path.basename(primary) : 'no fill audio'} fills silent gaps`, level: 'info' })
      } else if (!isNikah) {
        send('titleAdder:log', { jobId: params.jobId, message: `  🎵 Audio: ${primary ? path.basename(primary) : '—'}`, level: 'info' })
      }
      if (transDuration > 0) {
        send('titleAdder:log', {
          jobId: params.jobId,
          message: `  🎬 1.0s Transition buffer: ${customTransition ? `Custom file (${path.basename(customTransition)} trimmed to 1.0s)` : 'Native Cinema Black frame (0 live video content cut)'}`,
          level: 'info'
        })
      }
      const videoTitle = path.basename(videoPath, path.extname(videoPath))
      const detectedYear = extractYearFromFileName(videoPath)
      send('titleAdder:log', { jobId: params.jobId, message: `  🏷 Title: "${videoTitle}" · 📅 Year: ${detectedYear || '—'} · © Copyright: "Aljamea-tus-Saifiyah" · Publisher: "AIN" · Author URL: "https://ain53.org/"`, level: 'info' })
      const totalLength = (skipFront ? 0 : introDuration) + (transDuration > 0 ? transDuration : 0) + info.duration + (skipBack ? 0 : outroDuration)
      send('titleAdder:log', { jobId: params.jobId, message: `  ⏱ Total output length: ${totalLength.toFixed(2)}s (${skipFront ? 'no front thumbnail' : introDuration + 's intro'} + ${transDuration > 0 ? transDuration.toFixed(1) + 's buffer + ' : ''}${info.duration.toFixed(2)}s video + ${skipBack ? 'no back thumbnail' : outroDuration + 's outro'})`, level: 'info' })

      await new Promise<void>(resolve => {
        runFFmpegJob({
          jobId: params.jobId,
          videoPath, 
          outputPath: tempOutputPath,
          startImg: titleImg,
          endImg: end ?? titleImg,
          watermark: wm ?? titleImg,
          audioPrimary: primary ?? undefined,
          useNikahLogic: isNikah,
          duration: params.duration,
          totalLength,
          nonSilentSegs,
          fps: info.fps,
          width: info.width,
          height: info.height,
          vidDuration: info.duration,
          muteOriginal: isWaazId ? false : shouldMute,
          addWatermark: shouldAddWatermark,
          isWaazId: isWaazId,
          hasAudio,
          skipFront,
          skipBack,
          transitionFile: customTransition ?? undefined,
          transitionDuration: transDuration
        }, (evt) => {
          if (evt.type === 'progress') {
            send('titleAdder:progress', evt)
            const p = evt.percent ?? 0
            getWin()?.setProgressBar(Math.max(0, Math.min(1, p / 100)))

            onTitleAdderProgressBridge(evt, {
              jobId: params.jobId,
              videoName: path.basename(videoPath),
              currentIdx: done + 1,
              totalVideos: videos.length,
              thumbnailPath: titleImg || '',
              outputFolder: targetOut,
              task: `Rendering subtitle typography for ${path.basename(videoPath)}`
            })
          }
          else if (evt.type === 'log') send('titleAdder:log', { jobId: params.jobId, message: evt.message, level: 'info' })
          else if (evt.type === 'done') {
            if (evt.success && isCollision) {
              try {
                fs.unlinkSync(videoPath)
                fs.renameSync(tempOutputPath, outputPath)
                evt.message = `✔ Done: ${path.basename(outputPath)}`
              } catch (err) {
                evt.success = false
                evt.message = `✖ FAILED to replace original file: ${err instanceof Error ? err.message : String(err)}`
              }
            } else if (!evt.success && isCollision) {
              try {
                if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath)
              } catch {}
            }
            if (evt.message) {
              send('titleAdder:log', {
                jobId: params.jobId,
                message: evt.message,
                level: evt.success ? 'info' : 'error'
              })
            }
            resolve()
          }
        })
      })

      done++

      // Clean up any matching placeholder temp files for this video
      try {
        const dir = path.dirname(videoPath)
        const canonical = getCanonicalStem(videoPath)
        if (fs.existsSync(dir)) {
          const dirEntries = fs.readdirSync(dir)
          for (const ent of dirEntries) {
            if (isTempVideoFile(ent) && getCanonicalStem(ent) === canonical) {
              try { fs.unlinkSync(path.join(dir, ent)) } catch {}
            }
          }
        }
      } catch {}

      let folderName = params.mode === 'batch' && params.batchSource 
        ? path.basename(params.batchSource) 
        : path.basename(params.outputFolder)
        
      // Try to find a standardized folder name in paths (source path, output path, or the video file path itself)
      const stdFolder = extractStandardizedFolder([
        params.batchSource, 
        params.outputFolder, 
        videoPath
      ])
      if (stdFolder) {
        folderName = stdFolder
      }
        
      const safarInfo = parseSafarFromCandidatePaths([videoPath, params.batchSource, outputPath, actualOutputDir, params.outputFolder])
      if (safarInfo.dateFolder) {
        folderName = safarInfo.dateFolder
      }

      send('titleAdder:videoFinished', { 
        prefix, 
        stem, 
        addToStats: params.addToStats,
        folder: folderName,
        duration: info.duration,
        outputPath,
        videoPath,
        mode: params.mode,
        safar: safarInfo.safar,
        safarYear: safarInfo.safarYear,
        safarSerial: safarInfo.safarSerial,
        city: safarInfo.city,
        hijriYear: safarInfo.hijriYear,
        hijriMonth: safarInfo.hijriMonth,
        hijriDay: safarInfo.hijriDay,
      })

      // ── Title Adder ➔ Task Tracker 1-Click Status Bridge ───────
      try {
        let fSize = 0
        if (outputPath && fs.existsSync(outputPath)) {
          fSize = fs.statSync(outputPath).size
        }
        if (safarInfo.safar && folderName) {
          recordRenderFinished({
            safarName: safarInfo.safar,
            dateFolder: folderName,
            outputPath,
            duration: info.duration,
            fileSizeBytes: fSize
          })
        }
      } catch (bridgeErr) {
        console.warn('[TitleAdder] Auto task tracker bridge warning:', bridgeErr)
      }

      send('titleAdder:videosDone', { jobId: params.jobId, done, total: videos.length })
    }

    // Final cleanup pass: remove any leftover .tmp / .temp video placeholder files in batchSource / batchSource2 / DVD dir
    try {
      const cleanupDirs = [...batchSources, actualOutputDir, params.outputFolder].filter(Boolean) as string[]
      for (const cDir of cleanupDirs) {
        if (fs.existsSync(cDir)) {
          const { dir: dvdD } = resolveVideoFolderAndFiles(cDir)
          const targetDirs = [cDir, dvdD].filter((d, i, arr) => d && fs.existsSync(d) && arr.indexOf(d) === i)
          for (const td of targetDirs) {
            const files = fs.readdirSync(td)
            for (const f of files) {
              if (isTempVideoFile(f)) {
                try { fs.unlinkSync(path.join(td, f)) } catch {}
              }
            }
          }
        }
      }
    } catch {}

    const finalOutputDir = (actualOutputDir || params.outputFolder) ? path.resolve(actualOutputDir || params.outputFolder) : ''
      
    if (finalOutputDir) {
      setAndSave('converter_video_target', finalOutputDir)
    }

    getWin()?.setProgressBar(-1)
    updateIslandState({
      active: false,
      done: true,
      success: !cancelled,
      percent: 100,
      task: cancelled ? 'Cancelled' : 'All videos rendered successfully!'
    })
    send('titleAdder:done', { jobId: params.jobId, success: !cancelled, done, total: videos.length, outputFolder: finalOutputDir, batchOutputs })
  })

  ipcMain.handle('titleAdder:scanStats', async (_e, rootPath: string) => {
    if (!rootPath || !fs.existsSync(rootPath)) return []
    const results: any[] = []

    try {
      const videoItems = findVideoFiles(rootPath)
      for (const item of videoItems) {
        const filePath = item.fullPath
        const stem = path.basename(filePath, path.extname(filePath))
        const info = getVideoInfo(filePath)
        const safarInfo = parseSafarFromPath(filePath)
        const prefix = safarInfo.eventCode || getPrefix(stem) || extractEventCodeFromPath(filePath, stem) || 'OTHER'
        let fileDate = Date.now()
        try {
          const st = fs.statSync(filePath)
          fileDate = st.mtimeMs
        } catch {}

        let resolvedDate = fileDate
        if (safarInfo.hijriYear && safarInfo.hijriMonth && safarInfo.hijriDay) {
          try {
            // Gregorian approximation for accurate timestamp sort & range
            const approxYear = safarInfo.hijriYear + 579
            const approxMonth = safarInfo.hijriMonth - 1
            const approxDay = Math.min(28, safarInfo.hijriDay)
            resolvedDate = new Date(approxYear, approxMonth, approxDay, 12, 0, 0).getTime()
          } catch {}
        }

        const resolvedFolder = safarInfo.dateFolder || safarInfo.session || safarInfo.safar || path.basename(path.dirname(filePath))

        results.push({
          prefix,
          name: stem,
          date: resolvedDate,
          folder: resolvedFolder,
          safar: safarInfo.safar,
          safarYear: safarInfo.safarYear,
          safarSerial: safarInfo.safarSerial,
          city: safarInfo.city,
          hijriYear: safarInfo.hijriYear,
          hijriMonth: safarInfo.hijriMonth,
          hijriDay: safarInfo.hijriDay,
          session: safarInfo.session,
          fullPath: filePath,
          duration: info?.duration || 0
        })
      }
    } catch (e) {
      console.error('Scan stats error:', e)
    }
    return results
  })

  ipcMain.handle('titleAdder:listVideos', async (_e, rootPath: string) => {
    try {
      const { files } = resolveVideoFolderAndFiles(rootPath)
      return files.map(f => f.fileName).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    } catch { return [] }
  })

  ipcMain.handle('titleAdder:cleanupTempFiles', async (_e, folderPath: string) => {
    try {
      const { dir } = resolveVideoFolderAndFiles(folderPath)
      const targetDir = dir || folderPath
      if (!fs.existsSync(targetDir)) return { success: false, removed: 0 }
      const files = fs.readdirSync(targetDir)
      let removed = 0
      for (const f of files) {
        if (isTempVideoFile(f)) {
          try {
            fs.unlinkSync(path.join(targetDir, f))
            removed++
          } catch {}
        }
      }
      return { success: true, removed }
    } catch (err: any) {
      return { success: false, error: err.message || String(err), removed: 0 }
    }
  })

  ipcMain.handle('titleAdder:renameFiles', async (_e, params: {
    renames: Array<{ originalPath: string; newName: string }>
  }) => {
    const results: Array<{ success: boolean; error?: string; originalPath: string; newPath: string }> = []
    for (const item of params.renames) {
      try {
        if (!fs.existsSync(item.originalPath)) {
          results.push({ success: false, error: 'File does not exist', originalPath: item.originalPath, newPath: '' })
          continue
        }
        const dir = path.dirname(item.originalPath)
        const newPath = path.join(dir, item.newName)
        
        // Prevent overwriting if destination already exists (unless it's the same file)
        if (fs.existsSync(newPath) && item.originalPath !== newPath) {
          results.push({ success: false, error: 'Destination file already exists', originalPath: item.originalPath, newPath })
          continue
        }
        
        fs.renameSync(item.originalPath, newPath)
        results.push({ success: true, originalPath: item.originalPath, newPath })
      } catch (err: any) {
        results.push({ success: false, error: err.message || String(err), originalPath: item.originalPath, newPath: '' })
      }
    }
    return results
  })

  ipcMain.handle('titleAdder:getAvailablePrefixes', async () => {
    try {
      const titlesFolder = resolveTitlesFolder(get('titles_folder') as string)
      if (!titlesFolder || !fs.existsSync(titlesFolder)) return []
      const files = fs.readdirSync(titlesFolder)
      const stems = files
        .filter(f => {
          const ext = path.extname(f).toLowerCase()
          return IMG_EXTS.includes(ext) || AUDIO_EXTS.includes(ext)
        })
        .map(f => path.basename(f, path.extname(f)).toLowerCase())
      return Array.from(new Set(stems))
    } catch {
      return []
    }
  })

  // ── Premiere Pro Project Generator Handlers ─────────────────
  ipcMain.handle('titleAdder:checkPremiereTemplate', async () => {
    try {
      const titlesFolder = resolveTitlesFolder(get('titles_folder') as string)
      if (!titlesFolder || !fs.existsSync(titlesFolder)) return { exists: false, path: null }
      const candidates = ['Template.prproj', 'template.prproj', 'PREMIERE_TEMPLATE.prproj', 'TEMPLATE.prproj']
      for (const cand of candidates) {
        const p = path.join(titlesFolder, cand)
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          return { exists: true, path: p, filename: cand }
        }
      }
      const files = fs.readdirSync(titlesFolder)
      const prproj = files.find(f => f.toLowerCase().endsWith('.prproj'))
      if (prproj) {
        const p = path.join(titlesFolder, prproj)
        return { exists: true, path: p, filename: prproj }
      }
      return { exists: false, path: null }
    } catch {
      return { exists: false, path: null }
    }
  })

  ipcMain.handle('titleAdder:createPremiereProjects', async (_e, rootPath: string) => {
    try {
      if (!rootPath || !fs.existsSync(rootPath)) {
        return { success: false, error: 'Selected target folder does not exist.' }
      }

      const titlesFolder = resolveTitlesFolder((get('titles_folder') as string) || '', rootPath)
      const scriptCandidates = [
        path.join(process.resourcesPath, 'python', 'create_premiere_projects.py'),
        path.join(process.resourcesPath, 'create_premiere_projects.py'),
        path.join(__dirname, '../../src/main/python/create_premiere_projects.py'),
        path.join(process.cwd(), 'src/main/python/create_premiere_projects.py')
      ]
      let targetScript: string | null = null
      for (const p of scriptCandidates) {
        if (p && !p.includes('app.asar') && fs.existsSync(p)) {
          targetScript = p
          break
        }
      }

      if (targetScript) {
        const pyCmds = ['python3', 'python', 'py']
        for (const pyCmd of pyCmds) {
          try {
            const pyProc = spawnSync(pyCmd, [targetScript, '--folder', rootPath, '--titles-folder', titlesFolder, '--json'], {
              windowsHide: true,
              encoding: 'utf-8'
            })
            if (pyProc.status === 0 && pyProc.stdout) {
              const parsed = JSON.parse(pyProc.stdout.trim())
              if (parsed) return parsed
            }
          } catch {}
        }
      }

      // Node.js fallback execution if python process fails or script is missing
      const candidates = ['Template.prproj', 'template.prproj', 'PREMIERE_TEMPLATE.prproj', 'TEMPLATE.prproj']
      let templatePath: string | null = null
      if (titlesFolder && fs.existsSync(titlesFolder)) {
        for (const cand of candidates) {
          const p = path.join(titlesFolder, cand)
          if (fs.existsSync(p) && fs.statSync(p).isFile()) { templatePath = p; break }
        }
        if (!templatePath) {
          const prproj = fs.readdirSync(titlesFolder).find(f => f.toLowerCase().endsWith('.prproj'))
          if (prproj) templatePath = path.join(titlesFolder, prproj)
        }
      }

      let templateBytes: Buffer
      if (templatePath && fs.existsSync(templatePath)) {
        templateBytes = fs.readFileSync(templatePath)
      } else {
        const zlib = await import('zlib')
        const minimalXml = `<?xml version="1.0" encoding="UTF-8"?><PremiereData Version="3"><Project ObjectRef="1"><Node Version="1"><Properties><ProjectID>00000000-0000-0000-0000-000000000000</ProjectID><Name>UniDesk Premiere Project</Name></Properties></Node></Project></PremiereData>`
        templateBytes = zlib.gzipSync(Buffer.from(minimalXml, 'utf-8'))
      }

      const entries = fs.readdirSync(rootPath)
      const subfolders = entries.filter(e => {
        const p = path.join(rootPath, e)
        return fs.existsSync(p) && fs.statSync(p).isDirectory() && !e.startsWith('.') && !e.startsWith('$')
      }).sort()

      const createdFiles: any[] = []
      let createdCount = 0
      let skippedCount = 0

      for (const folderName of subfolders) {
        const folderPath = path.join(rootPath, folderName)
        const prprojFilename = `${folderName}.prproj`
        const prprojFilepath = path.join(folderPath, prprojFilename)

        if (fs.existsSync(prprojFilepath)) {
          skippedCount++
          createdFiles.push({ folder: folderName, filename: prprojFilename, path: prprojFilepath, status: 'skipped_exists' })
        } else {
          fs.writeFileSync(prprojFilepath, templateBytes)
          createdCount++
          createdFiles.push({ folder: folderName, filename: prprojFilename, path: prprojFilepath, status: 'created' })
        }
      }

      return {
        success: true,
        templateFound: !!templatePath,
        templatePath,
        totalSubfolders: subfolders.length,
        createdCount,
        skippedCount,
        createdFiles
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err)
      }
    }
  })

  // ── Final Titles Folder Management & Two-Way Sync ─────────────────────
  ipcMain.handle('titleAdder:getFinalTitles', (_e, customPath?: string) => {
    return getFinalTitlesInfo(customPath)
  })

  ipcMain.handle('titleAdder:setFinalTitlesFolder', async (_e, folderPath: string) => {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return { success: false, error: 'Directory does not exist' }
    }
    await setAndSave('titles_folder', folderPath)
    return getFinalTitlesInfo(folderPath)
  })

  ipcMain.handle('titleAdder:openFinalTitlesFolder', async (_e, customPath?: string) => {
    const info = getFinalTitlesInfo(customPath)
    if (info && info.folderPath && fs.existsSync(info.folderPath)) {
      await shell.openPath(info.folderPath)
      return { success: true, folderPath: info.folderPath }
    }
    return { success: false, error: 'Folder does not exist' }
  })

  ipcMain.handle('titleAdder:showFileInFolder', async (_e, filePath: string) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath)
      return { success: true }
    }
    return { success: false, error: 'File does not exist' }
  })
}

// ── Exported Final Titles Scanner ─────────────────────────────────────

export interface FinalTitleFile {
  name: string
  path: string
  size: number
  sizeFormatted: string
  mtime: number
  mtimeFormatted: string
  type: 'video' | 'image' | 'audio' | 'project' | 'other'
  extension: string
}

export interface FinalTitlesPayload {
  success: boolean
  folderPath: string
  exists: boolean
  totalCount: number
  stats: {
    videos: number
    images: number
    audios: number
    projects: number
    others: number
    totalSizeBytes: number
    totalSizeFormatted: string
  }
  files: FinalTitleFile[]
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function getFinalTitlesInfo(customFolder?: string): FinalTitlesPayload {
  const targetFolder = resolveTitlesFolder(customFolder || (get('titles_folder') as string) || '')

  if (!targetFolder || !fs.existsSync(targetFolder)) {
    return {
      success: false,
      folderPath: targetFolder || '',
      exists: false,
      totalCount: 0,
      stats: { videos: 0, images: 0, audios: 0, projects: 0, others: 0, totalSizeBytes: 0, totalSizeFormatted: '0 B' },
      files: []
    }
  }

  try {
    const entries = fs.readdirSync(targetFolder, { withFileTypes: true })
    const files: FinalTitleFile[] = []
    let totalSizeBytes = 0
    let videos = 0
    let images = 0
    let audios = 0
    let projects = 0
    let others = 0

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('$') || entry.name.toLowerCase() === 'thumbs.db') continue
      const fullPath = path.join(targetFolder, entry.name)

      try {
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) continue

        const ext = path.extname(entry.name).toLowerCase()
        let type: FinalTitleFile['type'] = 'other'

        if (VIDEO_EXTS.includes(ext)) {
          type = 'video'
          videos++
        } else if (IMG_EXTS.map(x => x.toLowerCase()).includes(ext)) {
          type = 'image'
          images++
        } else if (AUDIO_EXTS.includes(ext)) {
          type = 'audio'
          audios++
        } else if (PROJECT_EXTS.has(ext)) {
          type = 'project'
          projects++
        } else {
          others++
        }

        totalSizeBytes += stat.size
        files.push({
          name: entry.name,
          path: fullPath,
          size: stat.size,
          sizeFormatted: formatBytes(stat.size),
          mtime: stat.mtimeMs,
          mtimeFormatted: new Date(stat.mtimeMs).toLocaleString(),
          type,
          extension: ext
        })
      } catch {}
    }

    files.sort((a, b) => b.mtime - a.mtime)

    return {
      success: true,
      folderPath: targetFolder,
      exists: true,
      totalCount: files.length,
      stats: {
        videos,
        images,
        audios,
        projects,
        others,
        totalSizeBytes,
        totalSizeFormatted: formatBytes(totalSizeBytes)
      },
      files
    }
  } catch (err: any) {
    return {
      success: false,
      folderPath: targetFolder,
      exists: true,
      totalCount: 0,
      stats: { videos: 0, images: 0, audios: 0, projects: 0, others: 0, totalSizeBytes: 0, totalSizeFormatted: '0 B' },
      files: []
    }
  }
}

