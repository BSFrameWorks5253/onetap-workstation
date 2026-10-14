/**
 * ====================================================================
 * ADOBE PREMIERE PRO PROJECT GENERATOR IPC (prproj.ipc.ts)
 * ====================================================================
 * Main Process IPC Handlers for:
 * 1. Automatic `.prproj` (Premiere Pro XML gzipped project) and Final Cut Pro `.xml` creation.
 * 2. Placing all imported video clips sequentially on Video Track 1 (V1) & Audio Track 1 (A1).
 * 3. Cameraman folder structure detection (e.g., CAM A, CAM B, CAM C).
 * 4. Excel report exporting for date sequence clips and cameraman video counts.
 * 5. Native node XML building & template stream insertion.
 * ====================================================================
 */

import { ipcMain, app } from 'electron'
import { execFile, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import * as XLSX from 'xlsx'
import { get } from '../core/settingsManager'
import { extractEventCodeFromPath } from '../core/safarHierarchy'
import { getFfprobeExePath } from '../core/gpuDetector'

const VIDEO_EXTS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts', '.mxf', '.wmv',
  '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.mod', '.tod', '.vob', '.divx',
  '.braw', '.crm', '.r3d', '.ari', '.arx', '.cine', '.ts', '.tp', '.m2t',
  '.dv', '.dif', '.hevc', '.h264', '.h265', '.264', '.265', '.f4v',
  '.asf', '.ogv', '.mp4v', '.insv', '.lrf', '.lrv', '.dat',
  '.m2v', '.m4p', '.nev', '.qt', '.rm', '.rmvb', '.vro', '.wtv', '.dvr-ms', '.ogm', '.mpe', '.mpv', '.m2p', '.3g2', '.avchd'
])
const OUTPUT_FOLDER_NAMES = new Set([
  'export', 'exports', 'renders', 'temp', 'scratch',
  'proxy', 'proxies', 'pxd', 'thumb', 'thumbs', 'thumbnail', 'thumbnails',
  'preview', 'previews', 'cache', '.git', '.trash', '$recycle.bin', 'system volume information'
])
const SYSTEM_IGNORE_FOLDERS = new Set([
  '.git', '.trash', '$recycle.bin', 'system volume information',
  'adobe premiere pro auto-save', 'thumb', 'thumbs', 'thumbnail', 'thumbnails',
  'preview', 'previews', 'proxy', 'proxies', 'pxd', 'cache'
])

function escapeXml(str: any): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface VideoStreamInfo {
  width: number
  height: number
  duration: number
  fpsNum: number
  fpsDen: number
  fps: number
  timebase: number
  ntsc: boolean
  audioChannels: number
  isValid: boolean
}

const ffprobeCache = new Map<string, VideoStreamInfo>()

async function getVideoInfoNodeAsync(filePath: string): Promise<VideoStreamInfo> {
  const FALLBACK_RES: VideoStreamInfo = {
    width: 1920, height: 1080, duration: 10.0, fpsNum: 30, fpsDen: 1, fps: 30, timebase: 30, ntsc: false, audioChannels: 2, isValid: true
  }

  try {
    if (!filePath || typeof filePath !== 'string') {
      return FALLBACK_RES
    }

    const fileName = path.basename(filePath)
    if (fileName.startsWith('.') || fileName.startsWith('~$')) {
      return { ...FALLBACK_RES, isValid: false }
    }

    const stat = fs.statSync(filePath)
    if (stat.size <= 0) {
      return { ...FALLBACK_RES, isValid: false }
    }

    const cacheKey = `${filePath}_${stat.mtimeMs}_${stat.size}`
    if (ffprobeCache.has(cacheKey)) {
      return ffprobeCache.get(cacheKey)!
    }

    const ffprobeExe = getFfprobeExePath()

    return new Promise((resolve) => {
      execFile(ffprobeExe, [
        '-v', 'error',
        '-show_entries', 'stream=width,height,duration,r_frame_rate,avg_frame_rate,channels,codec_type:format=duration',
        '-of', 'json', filePath
      ], { windowsHide: true, timeout: 15000 }, (error, stdout) => {
        if (error || !stdout) {
          ffprobeCache.set(cacheKey, FALLBACK_RES)
          return resolve(FALLBACK_RES)
        }
        try {
          const parsed = JSON.parse(stdout)
          const streams = parsed.streams || []
          const s = streams.find((st: any) => st.codec_type === 'video')
          const a = streams.find((st: any) => st.codec_type === 'audio')
          const f = parsed.format

          const audioChannels = parseInt(a?.channels) || 2
          const width = parseInt(s?.width) || 1920
          const height = parseInt(s?.height) || 1080

          let durSec = parseFloat(s?.duration)
          if (isNaN(durSec) || durSec <= 0) {
            durSec = parseFloat(f?.duration)
          }
          if (isNaN(durSec) || durSec <= 0) {
            durSec = 10.0
          }
          const duration = Math.max(durSec, 0.1)

          const rateStr = (s?.r_frame_rate && s.r_frame_rate !== '0/0') ? s.r_frame_rate : (s?.avg_frame_rate || '30/1')
          const parts = rateStr.split('/')
          let num = parseInt(parts[0]) || 30
          let den = parseInt(parts[1]) || 1
          let rawFps = den > 0 ? num / den : 30
          if (rawFps <= 0 || !isFinite(rawFps)) rawFps = 30

          let timebase = 30
          let ntsc = false

          if (Math.abs(rawFps - 23.976) < 0.1 || Math.abs(rawFps - 23.98) < 0.1 || (num === 24000 && den === 1001)) {
            timebase = 24; ntsc = true
          } else if (Math.abs(rawFps - 24) < 0.1) {
            timebase = 24; ntsc = false
          } else if (Math.abs(rawFps - 25) < 0.1) {
            timebase = 25; ntsc = false
          } else if (Math.abs(rawFps - 29.97) < 0.1 || (num === 30000 && den === 1001)) {
            timebase = 30; ntsc = true
          } else if (Math.abs(rawFps - 30) < 0.1) {
            timebase = 30; ntsc = false
          } else if (Math.abs(rawFps - 50) < 0.1) {
            timebase = 50; ntsc = false
          } else if (Math.abs(rawFps - 59.94) < 0.1 || (num === 60000 && den === 1001)) {
            timebase = 60; ntsc = true
          } else if (Math.abs(rawFps - 60) < 0.1) {
            timebase = 60; ntsc = false
          } else {
            timebase = Math.round(rawFps) || 30
            ntsc = false
          }

          const res: VideoStreamInfo = { width, height, duration, fpsNum: num, fpsDen: den, fps: rawFps, timebase, ntsc, audioChannels, isValid: true }
          ffprobeCache.set(cacheKey, res)
          return resolve(res)
        } catch {
          ffprobeCache.set(cacheKey, FALLBACK_RES)
          return resolve(FALLBACK_RES)
        }
      })
    })
  } catch {
    return FALLBACK_RES
  }
}

async function getBatchVideoInfosParallel(filePaths: string[], concurrency = 8): Promise<VideoStreamInfo[]> {
  if (filePaths.length === 0) return []
  const results: VideoStreamInfo[] = new Array(filePaths.length)
  let queueIndex = 0
  let activeWorkers = 0

  return new Promise((resolve) => {
    const processNext = () => {
      while (activeWorkers < concurrency && queueIndex < filePaths.length) {
        const idx = queueIndex++
        activeWorkers++

        getVideoInfoNodeAsync(filePaths[idx])
          .then((info) => {
            results[idx] = info
          })
          .catch(() => {
            results[idx] = {
              width: 1920, height: 1080, duration: 10.0, fpsNum: 30, fpsDen: 1, fps: 30, timebase: 30, ntsc: false, audioChannels: 2, isValid: true
            }
          })
          .finally(() => {
            activeWorkers--
            if (activeWorkers === 0 && queueIndex >= filePaths.length) {
              resolve(results)
            } else {
              processNext()
            }
          })
      }
    }

    processNext()
  })
}

export interface VideoFileEntryNode {
  path: string
  folderName: string
  markerName: string
  markerDescription: string
  eventCategory: string
}

export interface FolderMarkerInfo {
  eventFolderName: string
  descriptionFolderName: string
  markerName: string
  markerDescription: string
  eventCategory: string
  markerColor: { red: number; green: number; blue: number; name?: string; colorIndex?: number }
}

export function parseFolderMarkerInfo(relativeFolders: string[]): FolderMarkerInfo {
  if (!relativeFolders || relativeFolders.length === 0) {
    return {
      eventFolderName: '',
      descriptionFolderName: '',
      markerName: '',
      markerDescription: '',
      eventCategory: 'OTHER',
      markerColor: getMarkerColorForFolder('OTHER')
    }
  }

  const cleanFolders = relativeFolders.filter(f => f && !OUTPUT_FOLDER_NAMES.has(f.toLowerCase()))

  if (cleanFolders.length === 0) {
    return {
      eventFolderName: '',
      descriptionFolderName: '',
      markerName: '',
      markerDescription: '',
      eventCategory: 'OTHER',
      markerColor: getMarkerColorForFolder('OTHER')
    }
  }

  const eventFolder = cleanFolders[0]
  const cameraFolder = cleanFolders.length >= 2 ? cleanFolders[1] : ''
  const cameramanFolder = cleanFolders.length >= 3 ? cleanFolders[2] : ''

  let markerFolder = cameraFolder ? cameraFolder : eventFolder
  let markerName = markerFolder
  let markerDescription = ''

  if (cameramanFolder) {
    markerDescription = cameramanFolder.replace(/^PC[\-_]?\d*[\s\-_]*/i, '').trim()
  }

  if (cameraFolder) {
    const catFromFull = getPrefixCategory(cameraFolder)
    if (catFromFull !== 'OTHER') {
      markerName = cameraFolder
    } else {
      const combinedMatch = cameraFolder.match(/^(\d+[\s_\-]*[A-Za-z]+)[\s_\-]+(.+)$/)
      if (combinedMatch) {
        const candidateCat = getPrefixCategory(combinedMatch[2])
        if (candidateCat !== 'OTHER') {
          markerName = cameraFolder
        } else {
          markerName = combinedMatch[1].trim()
          if (!markerDescription) {
            markerDescription = combinedMatch[2].replace(/^[\-_]/, '').trim()
          }
        }
      }
    }
  }

  let eventCategory = getPrefixCategory(markerName)
  if (eventCategory === 'OTHER') {
    eventCategory = getPrefixCategory(cameraFolder)
  }
  if (eventCategory === 'OTHER') {
    eventCategory = getPrefixCategory(eventFolder)
  }

  const markerColor = getMarkerColorForFolder(eventCategory !== 'OTHER' ? eventCategory : markerName)

  return {
    eventFolderName: eventFolder,
    descriptionFolderName: cameramanFolder || cameraFolder,
    markerName,
    markerDescription,
    eventCategory,
    markerColor
  }
}

export function discoverSubfolderVideosWithFoldersNode(subfolderPath: string): VideoFileEntryNode[] {
  const videoEntries: VideoFileEntryNode[] = []
  if (!subfolderPath || !fs.existsSync(subfolderPath)) return videoEntries

  const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

  function collect(currentDir: string): void {
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => naturalSort(a.name, b.name))
    } catch {
      // Fallback with standard readdirSync if withFileTypes fails
      try {
        const names = fs.readdirSync(currentDir).sort(naturalSort)
        for (const name of names) {
          const cleanName = name.trim()
          if (cleanName.startsWith('.') || cleanName.startsWith('~$')) continue
          const fullP = path.join(currentDir, name)
          try {
            const stat = fs.statSync(fullP)
            if (stat.isFile()) {
              const ext = path.extname(cleanName).toLowerCase().trim()
              if (VIDEO_EXTS.has(ext)) {
                const relPath = path.relative(subfolderPath, currentDir)
                const relFolders = relPath ? relPath.split(path.sep).filter(Boolean) : []
                const markerInfo = parseFolderMarkerInfo(relFolders)
                videoEntries.push({
                  path: fullP,
                  folderName: markerInfo.eventFolderName || path.basename(subfolderPath),
                  markerName: markerInfo.markerName || path.basename(subfolderPath),
                  markerDescription: markerInfo.markerDescription || '',
                  eventCategory: markerInfo.eventCategory
                })
              }
            } else if (stat.isDirectory()) {
              if (!SYSTEM_IGNORE_FOLDERS.has(cleanName.toLowerCase())) {
                collect(fullP)
              }
            }
          } catch {}
        }
      } catch {}
      return
    }

    const relPath = path.relative(subfolderPath, currentDir)
    const relFolders = relPath ? relPath.split(path.sep).filter(Boolean) : []
    const markerInfo = parseFolderMarkerInfo(relFolders)

    // 1. Collect direct video files in currentDir
    for (const entry of entries) {
      const name = entry.name.trim()
      if (name.startsWith('.') || name.startsWith('~$')) continue
      const fullP = path.join(currentDir, entry.name)

      let isFile = false
      try {
        if (typeof entry.isFile === 'function') {
          isFile = entry.isFile() || (typeof entry.isSymbolicLink === 'function' && entry.isSymbolicLink() && fs.statSync(fullP).isFile())
        } else {
          isFile = fs.statSync(fullP).isFile()
        }
      } catch {
        const ext = path.extname(name).toLowerCase().trim()
        if (VIDEO_EXTS.has(ext)) isFile = true
      }

      if (isFile) {
        const ext = path.extname(name).toLowerCase().trim()
        if (VIDEO_EXTS.has(ext)) {
          let fileSize = 1
          try {
            fileSize = fs.statSync(fullP).size
          } catch {}
          if (fileSize > 0) {
            videoEntries.push({
              path: fullP,
              folderName: markerInfo.eventFolderName || path.basename(subfolderPath),
              markerName: markerInfo.markerName || path.basename(subfolderPath),
              markerDescription: markerInfo.markerDescription || '',
              eventCategory: markerInfo.eventCategory
            })
          }
        }
      }
    }

    // 2. Recurse into subdirectories
    for (const entry of entries) {
      const name = entry.name.trim()
      if (name.startsWith('.') || name.startsWith('~$')) continue
      const fullP = path.join(currentDir, entry.name)

      let isDir = false
      try {
        if (typeof entry.isDirectory === 'function') {
          isDir = entry.isDirectory() || (typeof entry.isSymbolicLink === 'function' && entry.isSymbolicLink() && fs.statSync(fullP).isDirectory())
        } else {
          isDir = fs.statSync(fullP).isDirectory()
        }
      } catch {}

      if (isDir) {
        if (!SYSTEM_IGNORE_FOLDERS.has(name.toLowerCase())) {
          collect(fullP)
        }
      }
    }
  }

  collect(subfolderPath)

  const seen = new Set<string>()
  const result: VideoFileEntryNode[] = []
  for (const item of videoEntries) {
    const norm = path.normalize(item.path).toLowerCase()
    if (!seen.has(norm)) {
      seen.add(norm)
      result.push(item)
    }
  }
  return result
}

export function discoverSubfolderVideosNode(subfolderPath: string): string[] {
  return discoverSubfolderVideosWithFoldersNode(subfolderPath).map(v => v.path)
}

export interface EventColorDef {
  code: string
  name: string
  red: number
  green: number
  blue: number
  colorIndex: number
  colorName: string
}

// 34 Official Events from Event List.xlsx with unique aesthetic colors & Premiere marker indices
export const EVENT_DEFINITIONS: Record<string, EventColorDef> = {
  AQ:     { code: 'AQ',     name: 'Aqiqa',                red: 0,   green: 210, blue: 255, colorIndex: 7, colorName: 'Cyan' },
  BM:     { code: 'BM',     name: 'Bethak Majlis',        red: 20,  green: 184, blue: 166, colorIndex: 7, colorName: 'Teal' },
  BQ:     { code: 'BQ',     name: 'Bethak Qadam',         red: 244, green: 63,  blue: 94,  colorIndex: 1, colorName: 'Coral' },
  BZ:     { code: 'BZ',     name: 'Bethak Ziyafat',       red: 168, green: 85,  blue: 247, colorIndex: 2, colorName: 'Lavender' },
  FMB:    { code: 'FMB',    name: 'FMB',                  red: 34,  green: 197, blue: 94,  colorIndex: 0, colorName: 'Green' },
  H:      { code: 'H',      name: 'Haddiyat',             red: 245, green: 158, blue: 11,  colorIndex: 4, colorName: 'Amber' },
  ID:     { code: 'ID',     name: 'Idaraat',              red: 37,  green: 99,  blue: 235, colorIndex: 6, colorName: 'Royal Blue' },
  IF:     { code: 'IF',     name: 'Iftettah',             red: 132, green: 204, blue: 22,  colorIndex: 0, colorName: 'Lime' },
  IFS:    { code: 'IFS',    name: 'Iftettah Sharaf',      red: 16,  green: 185, blue: 129, colorIndex: 0, colorName: 'Emerald' },
  IST:    { code: 'IST',    name: 'Isteqbal',             red: 99,  green: 102, blue: 241, colorIndex: 6, colorName: 'Indigo' },
  KGS:    { code: 'KGS',    name: 'Kg Sharaf',            red: 236, green: 72,  blue: 153, colorIndex: 1, colorName: 'Rose' },
  M:      { code: 'M',      name: 'Majlis',               red: 52,  green: 199, blue: 89,  colorIndex: 0, colorName: 'Green' },
  MF:     { code: 'MF',     name: 'Mafsuhiyat',           red: 180, green: 83,  blue: 9,   colorIndex: 3, colorName: 'Bronze' },
  MISBAH: { code: 'MISBAH', name: 'Misbah',               red: 6,   green: 182, blue: 212, colorIndex: 7, colorName: 'Cyan' },
  MKB:    { code: 'MKB',    name: 'Mokib',                red: 30,  green: 58,  blue: 138, colorIndex: 6, colorName: 'Navy' },
  MO:     { code: 'MO',     name: 'Madrasa',              red: 56,  green: 189, blue: 248, colorIndex: 6, colorName: 'Light Blue' },
  MQ:     { code: 'MQ',     name: 'Misaq',                red: 124, green: 58,  blue: 237, colorIndex: 2, colorName: 'Violet' },
  MUL:    { code: 'MUL',    name: 'Mulaqaat',             red: 234, green: 88,  blue: 12,  colorIndex: 3, colorName: 'Orange-Red' },
  MYN:    { code: 'MYN',    name: 'Miyana',               red: 217, green: 70,  blue: 239, colorIndex: 2, colorName: 'Magenta' },
  MZ:     { code: 'MZ',     name: 'Majmui Ziyafat',       red: 175, green: 82,  blue: 222, colorIndex: 2, colorName: 'Purple' },
  N:      { code: 'N',      name: 'Nikah',                red: 255, green: 214, blue: 10,  colorIndex: 4, colorName: 'Bright Yellow' },
  NAMAZ:  { code: 'NAMAZ',  name: 'Namaz',                red: 234, green: 179, blue: 8,   colorIndex: 4, colorName: 'Gold' },
  ONLINE: { code: 'ONLINE', name: 'Online',               red: 14,  green: 165, blue: 233, colorIndex: 6, colorName: 'Sky Blue' },
  Q:      { code: 'Q',      name: 'Qadam',                red: 255, green: 59,  blue: 48,  colorIndex: 1, colorName: 'Vivid Red' },
  QMZ:    { code: 'QMZ',    name: 'Qadam Majlis Ziyafat', red: 192, green: 38,  blue: 211, colorIndex: 2, colorName: 'Fuchsia' },
  SH:     { code: 'SH',     name: 'Sharaf',               red: 251, green: 146, blue: 60,  colorIndex: 3, colorName: 'Peach' },
  SQ:     { code: 'SQ',     name: 'Shifa Qadam',          red: 185, green: 28,  blue: 28,  colorIndex: 1, colorName: 'Dark Red' },
  TJR:    { code: 'TJR',    name: 'Tijarat',              red: 101, green: 163, blue: 13,  colorIndex: 0, colorName: 'Olive' },
  TQ:     { code: 'TQ',     name: 'Talaqqi',              red: 13,  green: 148, blue: 136, colorIndex: 7, colorName: 'Turquoise' },
  TQN:    { code: 'TQN',    name: 'Tahneeq',              red: 125, green: 211, blue: 252, colorIndex: 7, colorName: 'Ice Blue' },
  WAAZ:   { code: 'WAAZ',   name: 'Waaz',                 red: 255, green: 149, blue: 0,   colorIndex: 3, colorName: 'Warm Orange' },
  WD:     { code: 'WD',     name: 'Wada',                 red: 71,  green: 85,  blue: 105, colorIndex: 5, colorName: 'Slate' },
  Z:      { code: 'Z',      name: 'Ziyafat',              red: 0,   green: 122, blue: 255, colorIndex: 6, colorName: 'Royal Blue' },
  ZO:     { code: 'ZO',     name: 'Zafaf Olda',           red: 244, green: 114, blue: 182, colorIndex: 2, colorName: 'Orchid' }
}

export function getPrefixCategory(folderOrFileName: string): string {
  if (!folderOrFileName || typeof folderOrFileName !== 'string') return 'OTHER'
  const trimmed = folderOrFileName.trim()
  if (!trimmed) return 'OTHER'

  // 1. Primary: Use Title Adder's exact event code extractor
  const hierarchyCode = extractEventCodeFromPath(trimmed, trimmed)
  if (hierarchyCode && hierarchyCode !== 'OTHER') {
    const upHierarchy = hierarchyCode.toUpperCase()
    if (EVENT_DEFINITIONS[upHierarchy]) return upHierarchy
    if (upHierarchy === 'NIKAH' || upHierarchy === 'NIKAAH') return 'N'
    if (upHierarchy === 'AQIQA' || upHierarchy === 'BETHAK') return 'AQ'
    if (upHierarchy === 'ZIYARAT' || upHierarchy === 'ZIARAT') return 'Z'
    return upHierarchy
  }

  const upper = trimmed.toUpperCase()

  // 2. Keyword checks
  if (upper.includes('NAMAZ')) return 'NAMAZ'
  if (upper.includes('NIKAAH') || upper.includes('NIKAH')) return 'N'
  if (upper.includes('WAAZ')) return 'WAAZ'
  if (upper.includes('BETHAK MAJLIS') || upper.includes('BM')) return 'BM'
  if (upper.includes('BETHAK QADAM') || upper.includes('BQ')) return 'BQ'
  if (upper.includes('BETHAK ZIYAFAT') || upper.includes('BZ')) return 'BZ'
  if (upper.includes('BETHAK') || upper.includes('AQIQA')) return 'AQ'
  if (upper.includes('QMZ')) return 'QMZ'
  if (upper.includes('ZIYARAT') || upper.includes('ZIARAT')) return 'Z'
  if (upper.includes('MAJLIS')) return 'M'
  if (upper.includes('QADAM')) return 'Q'
  if (upper.includes('IDAARA') || upper.includes('IDARA')) return 'ID'
  if (upper.includes('FMB')) return 'FMB'
  if (upper.includes('HADDIYAT') || upper.includes('HADIYAH')) return 'H'
  if (upper.includes('IFTE') || upper.includes('IFTETTAH')) return 'IF'
  if (upper.includes('ISTEQBAL')) return 'IST'
  if (upper.includes('SHARAFF') || upper.includes('SHARAF')) return 'SH'
  if (upper.includes('TIJARAT')) return 'TJR'
  if (upper.includes('TALAQQI')) return 'TQ'
  if (upper.includes('TAHNEEQ')) return 'TQN'
  if (upper.includes('WADA')) return 'WD'

  // 3. Match against official event codes ordered by code length descending
  const sortedCodes = Object.keys(EVENT_DEFINITIONS).sort((a, b) => b.length - a.length)
  for (const code of sortedCodes) {
    const regex = new RegExp(`(?:^|[\\s_\\-\\d]|[A-Za-z\\d]+[\\-_\\s]+)(${code})(?:[\\s_\\-\\d]|$)`, 'i')
    if (regex.test(upper)) {
      return code
    }
  }

  return 'OTHER'
}

export function getMarkerColorForFolder(folderNameOrCategory: string): { red: number; green: number; blue: number; name: string; colorIndex: number; standardMarkerColor: string } {
  const PREMIERE_COLOR_NAMES = ['Green', 'Red', 'Purple', 'Orange', 'Yellow', 'White', 'Blue', 'Cyan']
  const DEFAULT_COLOR = { red: 255, green: 255, blue: 255, name: 'White', colorIndex: 5, standardMarkerColor: 'White' }
  if (!folderNameOrCategory || typeof folderNameOrCategory !== 'string') return DEFAULT_COLOR

  const cat = getPrefixCategory(folderNameOrCategory)
  const def = EVENT_DEFINITIONS[cat]
  if (def) {
    const cIdx = (def.colorIndex !== undefined && def.colorIndex >= 0 && def.colorIndex < PREMIERE_COLOR_NAMES.length) ? def.colorIndex : 5
    return {
      red: def.red,
      green: def.green,
      blue: def.blue,
      name: def.colorName,
      colorIndex: cIdx,
      standardMarkerColor: PREMIERE_COLOR_NAMES[cIdx]
    }
  }

  return DEFAULT_COLOR
}

export function formatSecondsToHumanReadable(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60

  const parts: string[] = []
  if (hrs > 0) parts.push(`${hrs} hr${hrs > 1 ? 's' : ''}`)
  if (mins > 0 || hrs > 0) parts.push(`${mins} min${mins !== 1 ? 's' : ''}`)
  parts.push(`${secs} sec${secs !== 1 ? 's' : ''}`)
  return parts.join(' ') || '0 sec'
}

export function formatSecondsToTimecode(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
}

export interface DateSequenceReportData {
  folderName: string
  totalSec: number
  totalClips: number
  categories: Record<string, { count: number; totalDurationSec: number }>
  items: Array<{
    index: number
    folderOrClipName: string
    category: string
    clipCount: number
    startSec: number
    endSec: number
    durationSec: number
  }>
}

export async function collectDateSequenceStatsNode(
  folderName: string,
  entries: VideoFileEntryNode[]
): Promise<DateSequenceReportData> {
  const CATEGORY_LIST = ['Q', 'Z', 'M', 'MZ', 'BQ', 'BZ', 'BM', 'ID', 'WAAZ', 'AQ', 'N', 'OTHER']
  const categories: Record<string, { count: number; totalDurationSec: number }> = {}
  CATEGORY_LIST.forEach(c => {
    categories[c] = { count: 0, totalDurationSec: 0 }
  })

  let totalSec = 0
  const totalClips = entries.length
  let currentTimelineSec = 0

  const itemsList: Array<{
    index: number
    folderOrClipName: string
    category: string
    clipCount: number
    startSec: number
    endSec: number
    durationSec: number
  }> = []

  let itemIdx = 0

  // Parallel probe all video entries using 8 workers + ffprobeCache
  const filePaths = entries.map(e => e.path)
  const videoInfos = await getBatchVideoInfosParallel(filePaths, 8)

  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx]
    const info = videoInfos[idx]
    const clipDur = (info && info.duration > 0) ? info.duration : 10.0
    const cat = getPrefixCategory(entry.folderName || path.basename(entry.path))

    categories[cat].count += 1
    categories[cat].totalDurationSec += clipDur

    const groupKey = entry.folderName || path.basename(entry.path)

    if (itemsList.length > 0 && itemsList[itemsList.length - 1].folderOrClipName === groupKey) {
      const currentGroup = itemsList[itemsList.length - 1]
      currentGroup.clipCount += 1
      currentGroup.durationSec += clipDur
      currentGroup.endSec += clipDur
    } else {
      itemIdx += 1
      itemsList.push({
        index: itemIdx,
        folderOrClipName: groupKey,
        category: cat,
        clipCount: 1,
        startSec: currentTimelineSec,
        endSec: currentTimelineSec + clipDur,
        durationSec: clipDur
      })
    }

    currentTimelineSec += clipDur
    totalSec += clipDur
  }

  return {
    folderName,
    totalSec,
    totalClips,
    categories,
    items: itemsList
  }
}

export function generateExcelSequenceReportNode(
  reports: DateSequenceReportData[],
  excelFolder: string,
  parentFolderName: string = 'Project'
): string {
  const wb = XLSX.utils.book_new()
  const CATEGORY_LIST = ['Q', 'Z', 'M', 'MZ', 'BQ', 'BZ', 'BM', 'ID', 'WAAZ', 'AQ', 'N', 'OTHER']

  // 1. Overview Summary Sheet
  const overviewRows: any[][] = [
    ['PREMIERE PRO PROJECT SEQUENCE SUMMARY REPORT'],
    [`Generated: ${new Date().toLocaleString()}`, `Parent Directory: ${parentFolderName}`],
    [],
    [
      'Sequence / Date Folder',
      'Total Clips',
      'Unedit Time (Initial Sequence Time)',
      'Edit Time (Timeline Time After Edit)',
      'Total Sequence Timecode (HH:MM:SS)',
      ...CATEGORY_LIST.map(c => `${c} Clips`),
      ...CATEGORY_LIST.map(c => `${c} Unedit Time`),
      ...CATEGORY_LIST.map(c => `${c} Edit Time`)
    ]
  ]

  let grandTotalClips = 0
  let grandTotalSec = 0
  const grandCategoryCounts: Record<string, number> = {}
  const grandCategorySecs: Record<string, number> = {}
  CATEGORY_LIST.forEach(c => {
    grandCategoryCounts[c] = 0
    grandCategorySecs[c] = 0
  })

  for (const rep of reports) {
    grandTotalClips += rep.totalClips
    grandTotalSec += rep.totalSec

    const catCounts = CATEGORY_LIST.map(c => rep.categories[c]?.count || 0)
    const catTimes = CATEGORY_LIST.map(c => formatSecondsToHumanReadable(rep.categories[c]?.totalDurationSec || 0))

    CATEGORY_LIST.forEach(c => {
      grandCategoryCounts[c] += (rep.categories[c]?.count || 0)
      grandCategorySecs[c] += (rep.categories[c]?.totalDurationSec || 0)
    })

    overviewRows.push([
      rep.folderName,
      rep.totalClips,
      formatSecondsToHumanReadable(rep.totalSec),
      formatSecondsToHumanReadable(rep.totalSec), // Edit Time (initially matches Unedit Time, updated by Premiere extension)
      formatSecondsToTimecode(rep.totalSec),
      ...catCounts,
      ...catTimes,
      ...catTimes
    ])
  }

  // Grand Total Row
  overviewRows.push([
    'TOTAL COMBINED',
    grandTotalClips,
    formatSecondsToHumanReadable(grandTotalSec),
    formatSecondsToHumanReadable(grandTotalSec),
    formatSecondsToTimecode(grandTotalSec),
    ...CATEGORY_LIST.map(c => grandCategoryCounts[c]),
    ...CATEGORY_LIST.map(c => formatSecondsToHumanReadable(grandCategorySecs[c])),
    ...CATEGORY_LIST.map(c => formatSecondsToHumanReadable(grandCategorySecs[c]))
  ])

  const overviewWs = XLSX.utils.aoa_to_sheet(overviewRows)
  overviewWs['!cols'] = [
    { wch: 28 }, { wch: 14 }, { wch: 32 }, { wch: 32 }, { wch: 25 },
    ...CATEGORY_LIST.map(() => ({ wch: 12 })),
    ...CATEGORY_LIST.map(() => ({ wch: 20 })),
    ...CATEGORY_LIST.map(() => ({ wch: 20 }))
  ]
  XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview Summary')

  // 2. Date-Wise Sub-Sheets
  const usedSheetNames = new Set<string>(['Overview Summary'])

  for (const rep of reports) {
    let sheetName = rep.folderName.replace(/[\\/?*:[\]]/g, '_').trim()
    if (sheetName.length > 31) sheetName = sheetName.substring(0, 31)
    if (!sheetName) sheetName = 'Sequence'

    let uniqueName = sheetName
    let counter = 1
    while (usedSheetNames.has(uniqueName)) {
      const suffix = `_${counter}`
      uniqueName = sheetName.substring(0, 31 - suffix.length) + suffix
      counter++
    }
    usedSheetNames.add(uniqueName)

    const dateRows: any[][] = [
      [`SEQUENCE SUMMARY: ${rep.folderName}`],
      [`Unedit Time (Created Sequence Time): ${formatSecondsToHumanReadable(rep.totalSec)} (${formatSecondsToTimecode(rep.totalSec)})`],
      [`Edit Time (Timeline Time After Edit): ${formatSecondsToHumanReadable(rep.totalSec)} (${formatSecondsToTimecode(rep.totalSec)})`],
      [`Total Clips in Sequence: ${rep.totalClips}`],
      [],
      ['PREFIX CATEGORY BREAKDOWN'],
      ['Category / Prefix', 'Clip Count', 'Unedit Time', 'Edit Time', '% of Sequence Time']
    ]

    let catTotalClips = 0
    let catTotalSec = 0

    for (const cat of CATEGORY_LIST) {
      const cData = rep.categories[cat] || { count: 0, totalDurationSec: 0 }
      catTotalClips += cData.count
      catTotalSec += cData.totalDurationSec
      const pct = rep.totalSec > 0 ? ((cData.totalDurationSec / rep.totalSec) * 100).toFixed(1) + '%' : '0%'

      dateRows.push([
        cat,
        cData.count,
        formatSecondsToHumanReadable(cData.totalDurationSec),
        formatSecondsToHumanReadable(cData.totalDurationSec),
        pct
      ])
    }

    dateRows.push([
      'TOTAL',
      catTotalClips,
      formatSecondsToHumanReadable(catTotalSec),
      formatSecondsToHumanReadable(catTotalSec),
      '100%'
    ])

    dateRows.push([])
    dateRows.push(['ITEMIZED SEQUENCE TIMELINE'])
    dateRows.push(['#', 'Subfolder / Clip Name', 'Category Prefix', 'Clip Count', 'Start Timecode', 'End Timecode', 'Unedit Time', 'Edit Time', 'Duration (HH:MM:SS)'])

    for (const item of rep.items) {
      dateRows.push([
        item.index,
        item.folderOrClipName,
        item.category,
        item.clipCount,
        formatSecondsToTimecode(item.startSec),
        formatSecondsToTimecode(item.endSec),
        formatSecondsToHumanReadable(item.durationSec),
        formatSecondsToHumanReadable(item.durationSec),
        formatSecondsToTimecode(item.durationSec)
      ])
    }

    const dateWs = XLSX.utils.aoa_to_sheet(dateRows)
    dateWs['!cols'] = [
      { wch: 8 }, { wch: 35 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 25 }, { wch: 20 }
    ]
    XLSX.utils.book_append_sheet(wb, dateWs, uniqueName)
  }

  if (!fs.existsSync(excelFolder)) {
    fs.mkdirSync(excelFolder, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const cleanParentName = parentFolderName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const excelFileName = `Sequence_Summary_Report_${cleanParentName}_${timestamp}.xlsx`
  const excelFilePath = path.join(excelFolder, excelFileName)
  const standardExcelFilePath = path.join(excelFolder, `Sequence_Summary_Report_${cleanParentName}.xlsx`)

  let finalReturnedPath = standardExcelFilePath
  XLSX.writeFile(wb, excelFilePath)
  try {
    XLSX.writeFile(wb, standardExcelFilePath)
  } catch (lockErr) {
    console.warn(`[Prproj IPC] Could not overwrite standard Excel file (file may be open in Microsoft Excel): ${standardExcelFilePath}`, lockErr)
    finalReturnedPath = excelFilePath
  }

  return finalReturnedPath
}

function pathToPathUrl(filePath: string): string {
  const abs = path.resolve(filePath).replace(/\\/g, '/')
  const parts = abs.split('/')
  const encodedParts = parts.map((part, i) => {
    // Preserve literal drive letter with colon on Windows (e.g. 'C:' or 'D:').
    // Premiere Pro fails to resolve drive letters when colon is percent-encoded as %3a!
    if (i === 0 && /^[a-zA-Z]:$/.test(part)) {
      return part.toUpperCase()
    }
    return encodeURIComponent(part)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A')
  })
  return `file://localhost/${encodedParts.join('/')}`
}

function inferFolderMarkerInfoFromPath(filePath: string): {
  folderName: string
  markerName: string
  markerDescription: string
  eventCategory: string
} {
  const parts = filePath.replace(/\\/g, '/').split('/')
  parts.pop() // remove file name
  const relFolders = parts.slice(1)
  const info = parseFolderMarkerInfo(relFolders)
  return {
    folderName: info.eventFolderName || parts[parts.length - 1] || '',
    markerName: info.markerName || parts[parts.length - 1] || '',
    markerDescription: info.markerDescription || '',
    eventCategory: info.eventCategory
  }
}

async function buildXmemlXmlNode(sequenceName: string, videoInputs: Array<string | VideoFileEntryNode>): Promise<string> {
  const rawEntries: VideoFileEntryNode[] = videoInputs.map(v => {
    if (typeof v === 'string') {
      const inferred = inferFolderMarkerInfoFromPath(v)
      return {
        path: v,
        folderName: inferred.folderName,
        markerName: inferred.markerName,
        markerDescription: inferred.markerDescription,
        eventCategory: inferred.eventCategory
      }
    }
    const mName = v.markerName || v.folderName || ''
    return {
      path: v.path,
      folderName: v.folderName || '',
      markerName: mName,
      markerDescription: v.markerDescription || '',
      eventCategory: v.eventCategory || getPrefixCategory(mName) || getPrefixCategory(v.folderName)
    }
  })

  // Parallel probe all video clips (uses ffprobeCache for instant lookups)
  const filePaths = rawEntries.map(e => e.path)
  const probedInfos = await getBatchVideoInfosParallel(filePaths, 8)

  // Derive sequence resolution & frame rate timebase from the first successfully probed video clip
  const firstValid = probedInfos.find(info => info && info.isValid && info.duration > 0)
  const primary: VideoStreamInfo = firstValid || {
    width: 1920, height: 1080, duration: 10.0, fpsNum: 30, fpsDen: 1, fps: 30, timebase: 30, ntsc: false, audioChannels: 2, isValid: true
  }

  const seqWidth = primary.width
  const seqHeight = primary.height
  const seqTb = primary.timebase
  const seqNtscStr = primary.ntsc ? 'TRUE' : 'FALSE'

  const entries: VideoFileEntryNode[] = []
  const videoInfos: VideoStreamInfo[] = []

  // Guarantee 100% of discovered video files in folder are included on the timeline
  for (let idx = 0; idx < rawEntries.length; idx++) {
    const raw = rawEntries[idx]
    let info = probedInfos[idx]
    if (!info || !info.isValid || isNaN(info.duration) || info.duration <= 0) {
      info = {
        width: (info && info.width > 0) ? info.width : seqWidth,
        height: (info && info.height > 0) ? info.height : seqHeight,
        duration: (info && info.duration > 0) ? info.duration : 10.0,
        fpsNum: (info && info.fpsNum > 0) ? info.fpsNum : primary.fpsNum,
        fpsDen: (info && info.fpsDen > 0) ? info.fpsDen : primary.fpsDen,
        fps: (info && info.fps > 0) ? info.fps : primary.fps,
        timebase: (info && info.timebase > 0) ? info.timebase : seqTb,
        ntsc: (info && typeof info.ntsc === 'boolean') ? info.ntsc : primary.ntsc,
        audioChannels: (info && typeof info.audioChannels === 'number') ? info.audioChannels : primary.audioChannels,
        isValid: true
      }
    }
    entries.push(raw)
    videoInfos.push(info)
  }

  let currentFrame = 0
  let vClipsXml = ''
  let aClipsXml = ''
  let markersXml = ''
  let currentMarkerKey = ''
  let audioTrackClipCount = 0

  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx]
    const vidPath = entry.path
    const info = videoInfos[idx]
    const tb = info.timebase
    const ntscStr = info.ntsc ? 'TRUE' : 'FALSE'
    const sourceClipFrames = Math.max(1, Math.round(info.duration * tb))
    const seqClipFrames = Math.max(1, Math.round(info.duration * seqTb))
    const clipName = path.basename(vidPath)
    const fileId = `file-${idx + 1}`
    const masterId = `masterclip-${idx + 1}`
    const vClipId = `vclip-${idx + 1}`
    const aClipId = `aclip-${idx + 1}`
    const startFrame = currentFrame
    const endFrame = currentFrame + seqClipFrames
    const pathUrlStr = pathToPathUrl(vidPath)

    // Sequence-level timeline marker for every new marker group start
    const markerName = entry.markerName || entry.folderName
    const markerDescription = entry.markerDescription || ''
    const markerKey = `${markerName}||${markerDescription}`

    if (markerName && markerKey !== currentMarkerKey) {
      currentMarkerKey = markerKey
      const color = getMarkerColorForFolder(entry.eventCategory !== 'OTHER' ? entry.eventCategory : entry.folderName)
      markersXml += `
    <marker>
      <name>${escapeXml(markerName)}</name>
      <comment>${escapeXml(markerDescription)}</comment>
      <in>${startFrame}</in>
      <out>${startFrame}</out>
      <color>${escapeXml(color.standardMarkerColor || color.name || 'White')}</color>
    </marker>`
    }

    // Full <file> definition on V1
    const fileXml = `
          <file id="${fileId}">
            <name>${escapeXml(clipName)}</name>
            <pathurl>${pathUrlStr}</pathurl>
            <rate><timebase>${tb}</timebase><ntsc>${ntscStr}</ntsc></rate>
            <duration>${sourceClipFrames}</duration>
            <timecode>
              <rate><timebase>${tb}</timebase><ntsc>${ntscStr}</ntsc></rate>
              <string>00:00:00:00</string>
              <frame>0</frame>
              <displayformat>NDF</displayformat>
            </timecode>
            <media>
              <video>
                <samplecharacteristics>
                  <width>${info.width}</width>
                  <height>${info.height}</height>
                  <pixelaspectratio>square</pixelaspectratio>
                </samplecharacteristics>
              </video>
              <audio>
                <channelcount>${info.audioChannels}</channelcount>
                <samplecharacteristics>
                  <depth>16</depth>
                  <samplerate>48000</samplerate>
                </samplecharacteristics>
              </audio>
            </media>
          </file>`

    const hasAudioTrack = info.audioChannels > 0
    if (hasAudioTrack) {
      audioTrackClipCount++
    }

    const vClipIndex = idx + 1
    const aClipIndex = audioTrackClipCount

    const linkXml = hasAudioTrack ? `
          <link>
            <linkclipref>${vClipId}</linkclipref>
            <mediatype>video</mediatype>
            <trackindex>1</trackindex>
            <clipindex>${vClipIndex}</clipindex>
          </link>
          <link>
            <linkclipref>${aClipId}</linkclipref>
            <mediatype>audio</mediatype>
            <trackindex>1</trackindex>
            <clipindex>${aClipIndex}</clipindex>
          </link>` : ''

    vClipsXml += `
        <clipitem id="${vClipId}">
          <masterclipid>${masterId}</masterclipid>
          <name>${escapeXml(clipName)}</name>
          <enabled>TRUE</enabled>
          <duration>${sourceClipFrames}</duration>
          <rate><timebase>${seqTb}</timebase><ntsc>${seqNtscStr}</ntsc></rate>
          <start>${startFrame}</start>
          <end>${endFrame}</end>
          <in>0</in>
          <out>${sourceClipFrames}</out>
          ${fileXml}
          <sourcetrack>
            <mediatype>video</mediatype>
            <trackindex>1</trackindex>
          </sourcetrack>
          ${linkXml}
        </clipitem>`

    // Reference self-closing <file id="..."/> on A1 to eliminate Premiere duplicate file relink/offline bugs
    if (hasAudioTrack) {
      aClipsXml += `
        <clipitem id="${aClipId}">
          <masterclipid>${masterId}</masterclipid>
          <name>${escapeXml(clipName)}</name>
          <enabled>TRUE</enabled>
          <duration>${sourceClipFrames}</duration>
          <rate><timebase>${seqTb}</timebase><ntsc>${seqNtscStr}</ntsc></rate>
          <start>${startFrame}</start>
          <end>${endFrame}</end>
          <in>0</in>
          <out>${sourceClipFrames}</out>
          <file id="${fileId}"/>
          <sourcetrack>
            <mediatype>audio</mediatype>
            <trackindex>1</trackindex>
          </sourcetrack>
          ${linkXml}
        </clipitem>`
    }

    currentFrame = endFrame
  }

  // Generate V1 (clips) + V2 (empty overlay track for Nikah group photo/titles)
  const emptyVTrackXml = `
        <track>
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
        </track>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${escapeXml(sequenceName)}</name>
    <duration>${currentFrame}</duration>
    <rate><timebase>${seqTb}</timebase><ntsc>${seqNtscStr}</ntsc></rate>
    <timecode>
      <rate><timebase>${seqTb}</timebase><ntsc>${seqNtscStr}</ntsc></rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
${markersXml}
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${seqWidth}</width>
            <height>${seqHeight}</height>
            <pixelaspectratio>square</pixelaspectratio>
          </samplecharacteristics>
        </format>
        <track>
          ${vClipsXml}
        </track>
${emptyVTrackXml}
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
        <outputs>
          <group>
            <index>1</index>
            <numchannels>1</numchannels>
            <downmix>0</downmix>
            <channel><index>1</index></channel>
          </group>
          <group>
            <index>2</index>
            <numchannels>1</numchannels>
            <downmix>0</downmix>
            <channel><index>2</index></channel>
          </group>
        </outputs>
        <track>
          ${aClipsXml}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`
}

export function findPrprojTemplate(customPath?: string): { templatePath: string | null; isCustom: boolean } {
  if (customPath && fs.existsSync(customPath)) {
    return { templatePath: customPath, isCustom: true }
  }

  const titlesFolder = get('titles_folder') as string | undefined
  if (titlesFolder && fs.existsSync(titlesFolder)) {
    const candidates = ['Template.prproj', 'template.prproj', 'Premiere_Template.prproj', 'Premiere2026.prproj']
    for (const name of candidates) {
      const p = path.join(titlesFolder, name)
      if (fs.existsSync(p)) return { templatePath: p, isCustom: true }
    }
    try {
      const files = fs.readdirSync(titlesFolder)
      const prprojFile = files.find(f => f.toLowerCase().endsWith('.prproj'))
      if (prprojFile) return { templatePath: path.join(titlesFolder, prprojFile), isCustom: true }
    } catch {}
  }

  const rootTemplate = path.join(process.cwd(), 'resources', 'templates', 'template.prproj')
  if (fs.existsSync(rootTemplate)) return { templatePath: rootTemplate, isCustom: false }

  const appPath = app.getAppPath()
  const resourceTemplate = path.join(appPath, 'resources', 'templates', 'template.prproj')
  if (fs.existsSync(resourceTemplate)) return { templatePath: resourceTemplate, isCustom: false }

  return { templatePath: null, isCustom: false }
}

function buildPrprojBuffer(folderName: string, templatePath?: string | null): Buffer {
  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PremiereData Version="3">
	<Project ObjectRef="1"/>
	<Project id="1" ClassID="9fd8536f-e3c3-4d76-8809-e855734e5a9c" Version="38">
		<Node Version="1">
			<Properties Version="1">
				<ProjectName>${escapeXml(folderName)}</ProjectName>
				<ProjectID>00000000-0000-0000-0000-000000000001</ProjectID>
			</Properties>
		</Node>
		<RootProjectItem ObjectRef="2"/>
	</Project>
	<RootProjectGroup id="2" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>Root</Name>
			</Properties>
		</Node>
		<Items Version="1">
			<Item Index="0" ObjectRef="3"/>
		</Items>
	</RootProjectGroup>
	<Sequence id="3" ClassID="18d84411-9a74-4b53-b39f-16a75f10b50e" Version="7">
		<Node Version="1">
			<Properties Version="1">
				<Name>${escapeXml(folderName)} Sequence</Name>
			</Properties>
		</Node>
		<Media ObjectRef="4"/>
	</Sequence>
	<Media id="4" ClassID="587dfa4e-d007-4ef8-a400-bdfeb00d8bc3" Version="27">
		<VideoTrackGroup ObjectRef="5"/>
		<AudioTrackGroup ObjectRef="6"/>
	</Media>
	<VideoTrackGroup id="5" ClassID="0ba20fe6-5ef1-4043-9828-ea0808bfa0d2" Version="4">
		<Tracks Version="1">
			<Track Index="0" ObjectRef="7"/>
		</Tracks>
	</VideoTrackGroup>
	<VideoTrack id="7" ClassID="a437ae5d-ad4c-41b2-bf89-53fcb749d05e" Version="4">
		<ClipItems Version="1"/>
	</VideoTrack>
	<AudioTrackGroup id="6" ClassID="47e7d9eb-fffa-42f5-93ae-c98f0e53a290" Version="4">
		<Tracks Version="1">
			<Track Index="0" ObjectRef="8"/>
		</Tracks>
	</AudioTrackGroup>
	<AudioTrack id="8" ClassID="1eb6ff82-bf72-4632-a50d-c014798695d6" Version="4">
		<ClipItems Version="1"/>
	</AudioTrack>
</PremiereData>`

  if (templatePath && fs.existsSync(templatePath)) {
    try {
      const rawBuf = fs.readFileSync(templatePath)
      let str = ''
      if (rawBuf.length > 2 && rawBuf[0] === 0x1f && rawBuf[1] === 0x8b) {
        str = zlib.gunzipSync(rawBuf).toString('utf-8')
      } else {
        str = rawBuf.toString('utf-8')
      }
      if (str.includes('<PremiereData') || str.includes('<ProjectName>')) {
        if (str.includes('<ProjectName>')) {
          str = str.replace(/<ProjectName>.*?<\/ProjectName>/g, `<ProjectName>${escapeXml(folderName)}</ProjectName>`)
        }
        xmlContent = str
      }
    } catch (e) {
      console.warn('[Prproj IPC] Could not parse custom template, fallback to standard Premiere project:', e)
    }
  }

  return zlib.gzipSync(Buffer.from(xmlContent, 'utf-8'))
}

export interface CameramanFolderInfo {
  name: string
  path: string
  videoCount: number
  markerName?: string
  markerDescription?: string
  markerColor: { red: number; green: number; blue: number; name?: string; colorIndex?: number }
}

export interface ScanSubfolderItemNode {
  name: string
  path: string
  hasPrproj: boolean
  prprojPath: string
  isOutputFolder?: boolean
  videoCount: number
  cameramanCount?: number
  cameramanFolders?: CameramanFolderInfo[]
}

export function getCameramanFoldersInFolder(folderPath: string): CameramanFolderInfo[] {
  const cameramanFolders: CameramanFolderInfo[] = []
  if (!folderPath || !fs.existsSync(folderPath)) return cameramanFolders

  try {
    const videos = discoverSubfolderVideosWithFoldersNode(folderPath)
    if (videos.length === 0) return cameramanFolders

    const grouped = new Map<string, {
      name: string
      path: string
      videoCount: number
      markerName: string
      markerDescription: string
      eventCategory: string
      markerColor: { red: number; green: number; blue: number }
    }>()

    for (const v of videos) {
      const key = `${v.markerName}||${v.markerDescription}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: v.folderName,
          path: path.dirname(v.path),
          videoCount: 0,
          markerName: v.markerName,
          markerDescription: v.markerDescription,
          eventCategory: v.eventCategory,
          markerColor: getMarkerColorForFolder(v.eventCategory !== 'OTHER' ? v.eventCategory : v.folderName)
        })
      }
      grouped.get(key)!.videoCount += 1
    }

    for (const info of grouped.values()) {
      cameramanFolders.push({
        name: info.name,
        path: info.path,
        videoCount: info.videoCount,
        markerName: info.markerName,
        markerDescription: info.markerDescription,
        markerColor: info.markerColor
      })
    }
  } catch {}

  return cameramanFolders
}

export function detectFolderMode(parentFolder: string): 'master' | 'single' {
  if (!parentFolder || !fs.existsSync(parentFolder)) return 'single'

  try {
    const entries = fs.readdirSync(parentFolder)
    const validDirs: string[] = []

    for (const entry of entries) {
      const fullP = path.join(parentFolder, entry)
      try {
        if (fs.statSync(fullP).isDirectory() && !OUTPUT_FOLDER_NAMES.has(entry.toLowerCase())) {
          validDirs.push(fullP)
        }
      } catch {}
    }

    if (validDirs.length === 0) return 'single'

    // Check if any child directory has nested child directories that contain videos (Level 3 depth = Master -> Date -> Cameraman -> Video)
    for (const dirPath of validDirs) {
      try {
        const childEntries = fs.readdirSync(dirPath)
        for (const child of childEntries) {
          const childFullP = path.join(dirPath, child)
          if (fs.statSync(childFullP).isDirectory() && !OUTPUT_FOLDER_NAMES.has(child.toLowerCase())) {
            const nestedVideos = discoverSubfolderVideosNode(childFullP)
            if (nestedVideos.length > 0) {
              return 'master' // Detected date subfolders containing cameraman folders!
            }
          }
        }
      } catch {}
    }
  } catch {}

  return 'single' // Folder contains cameraman folders or direct video files
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export function registerPrprojIPC(): void {
  ipcMain.handle('prproj:getTemplateStatus', async () => {
    const res = findPrprojTemplate()
    return {
      available: !!res.templatePath,
      templatePath: res.templatePath,
      isCustom: res.isCustom
    }
  })

  // Alias for scan
  ipcMain.handle('prproj:scan', async (_e, params) => {
    const parentFolder = typeof params === 'string' ? params : params?.parentFolder
    const ignoreOutput = typeof params === 'object' ? params.ignoreOutputFolders !== false : true
    const requestedMode = (typeof params === 'object' ? params.mode : 'auto') || 'auto'
    if (!parentFolder || !fs.existsSync(parentFolder)) {
      return {
        success: false, parentFolder: parentFolder || '', detectedMode: 'single', activeMode: 'single',
        subfolders: [], cameramanFolders: [], totalVideos: 0, targetPrprojName: '', targetPrprojPath: '', hasTargetPrproj: false
      }
    }
    const detectedMode = detectFolderMode(parentFolder)
    const activeMode = (requestedMode === 'master' || requestedMode === 'single') ? requestedMode : detectedMode
    const folderName = path.basename(parentFolder)
    const expectedTargetPrproj = path.join(parentFolder, `${folderName}.prproj`)
    const rootVideos = discoverSubfolderVideosNode(parentFolder)

    if (activeMode === 'single') {
      const cameramanFolders = getCameramanFoldersInFolder(parentFolder)
      const item: ScanSubfolderItemNode = {
        name: `${folderName} (Date Folder)`, path: parentFolder, hasPrproj: fs.existsSync(expectedTargetPrproj),
        prprojPath: expectedTargetPrproj, isOutputFolder: false, videoCount: rootVideos.length,
        cameramanCount: cameramanFolders.length, cameramanFolders
      }
      return {
        success: true, parentFolder, detectedMode, activeMode: 'single', subfolders: [item],
        cameramanFolders, totalVideos: rootVideos.length, targetPrprojName: `${folderName}.prproj`,
        targetPrprojPath: expectedTargetPrproj, hasTargetPrproj: fs.existsSync(expectedTargetPrproj)
      }
    } else {
      const entries = fs.readdirSync(parentFolder).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      const subfolders: ScanSubfolderItemNode[] = []
      for (const entry of entries) {
        const fullPath = path.join(parentFolder, entry)
        try {
          if (fs.statSync(fullPath).isDirectory()) {
            const isOutput = OUTPUT_FOLDER_NAMES.has(entry.toLowerCase())
            if (ignoreOutput && isOutput) continue
            const expectedPrproj = path.join(fullPath, `${entry}.prproj`)
            const hasPrproj = fs.existsSync(expectedPrproj)
            const videos = discoverSubfolderVideosNode(fullPath)
            const cameramanFolders = getCameramanFoldersInFolder(fullPath)
            subfolders.push({
              name: entry, path: fullPath, hasPrproj, prprojPath: expectedPrproj, isOutputFolder: isOutput,
              videoCount: videos.length, cameramanCount: cameramanFolders.length, cameramanFolders
            })
          }
        } catch {}
      }
      return {
        success: true, parentFolder, detectedMode, activeMode: 'master', subfolders,
        cameramanFolders: getCameramanFoldersInFolder(parentFolder), totalVideos: rootVideos.length,
        targetPrprojName: `${folderName}.prproj`, targetPrprojPath: expectedTargetPrproj, hasTargetPrproj: fs.existsSync(expectedTargetPrproj)
      }
    }
  })

  // Scan parent folder and return subfolders with .prproj status, mode detection & cameraman breakdowns
  ipcMain.handle('prproj:scanSubfolders', async (_e, params: { parentFolder: string; ignoreOutputFolders?: boolean; mode?: 'auto' | 'master' | 'single' } | string) => {
    const parentFolder = typeof params === 'string' ? params : params?.parentFolder
    const ignoreOutput = typeof params === 'object' ? params.ignoreOutputFolders !== false : true
    const requestedMode = (typeof params === 'object' ? params.mode : 'auto') || 'auto'

    if (!parentFolder || !fs.existsSync(parentFolder)) {
      return {
        success: false,
        parentFolder: parentFolder || '',
        detectedMode: 'single',
        activeMode: 'single',
        subfolders: [],
        cameramanFolders: [],
        totalVideos: 0,
        targetPrprojName: '',
        targetPrprojPath: '',
        hasTargetPrproj: false
      }
    }

    try {
      const detectedMode = detectFolderMode(parentFolder)
      const activeMode = (requestedMode === 'master' || requestedMode === 'single') ? requestedMode : detectedMode
      const folderName = path.basename(parentFolder)
      const expectedTargetPrproj = path.join(parentFolder, `${folderName}.prproj`)
      const rootVideos = discoverSubfolderVideosNode(parentFolder)

      if (activeMode === 'single') {
        const cameramanFolders = getCameramanFoldersInFolder(parentFolder)
        const item: ScanSubfolderItemNode = {
          name: `${folderName} (Date Folder)`,
          path: parentFolder,
          hasPrproj: fs.existsSync(expectedTargetPrproj),
          prprojPath: expectedTargetPrproj,
          isOutputFolder: false,
          videoCount: rootVideos.length,
          cameramanCount: cameramanFolders.length,
          cameramanFolders
        }

        return {
          success: true,
          parentFolder,
          detectedMode,
          activeMode: 'single',
          subfolders: [item],
          cameramanFolders,
          totalVideos: rootVideos.length,
          targetPrprojName: `${folderName}.prproj`,
          targetPrprojPath: expectedTargetPrproj,
          hasTargetPrproj: fs.existsSync(expectedTargetPrproj)
        }
      } else {
        // Master Folder Mode: list Date subfolders
        const entries = fs.readdirSync(parentFolder).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        const subfolders: ScanSubfolderItemNode[] = []

        for (const entry of entries) {
          const fullPath = path.join(parentFolder, entry)
          try {
            if (fs.statSync(fullPath).isDirectory()) {
              const isOutput = OUTPUT_FOLDER_NAMES.has(entry.toLowerCase())
              if (ignoreOutput && isOutput) continue

              const expectedPrproj = path.join(fullPath, `${entry}.prproj`)
              const hasPrproj = fs.existsSync(expectedPrproj)
              const videos = discoverSubfolderVideosNode(fullPath)
              const cameramanFolders = getCameramanFoldersInFolder(fullPath)

              subfolders.push({
                name: entry,
                path: fullPath,
                hasPrproj,
                prprojPath: expectedPrproj,
                isOutputFolder: isOutput,
                videoCount: videos.length,
                cameramanCount: cameramanFolders.length,
                cameramanFolders
              })
            }
          } catch {}
          await new Promise(r => setTimeout(r, 0))
        }

        return {
          success: true,
          parentFolder,
          detectedMode,
          activeMode: 'master',
          subfolders,
          cameramanFolders: getCameramanFoldersInFolder(parentFolder),
          totalVideos: rootVideos.length,
          targetPrprojName: `${folderName}.prproj`,
          targetPrprojPath: expectedTargetPrproj,
          hasTargetPrproj: fs.existsSync(expectedTargetPrproj)
        }
      }
    } catch (err) {
      console.error('[Prproj IPC] Scan failed:', err)
      return {
        success: false,
        parentFolder,
        detectedMode: 'single',
        activeMode: 'single',
        subfolders: [],
        cameramanFolders: [],
        totalVideos: 0,
        targetPrprojName: '',
        targetPrprojPath: '',
        hasTargetPrproj: false
      }
    }
  })

  // Batch-generate Premiere Pro project files (.prproj & .xml) in subfolders or single date folder
  ipcMain.handle('prproj:generate', async (_e, params: {
    parentFolder: string
    targetFolders?: string[]
    mode?: 'master' | 'single'
    customTemplatePath?: string
    includeSubSubfolders?: boolean
    ignoreOutputFolders?: boolean
    overwrite?: boolean
    excelFolderPath?: string
    excludedPaths?: string[]
  }) => {
    try {
      if (!params.parentFolder || !fs.existsSync(params.parentFolder)) {
        return { success: false, error: 'Target parent directory does not exist.', created: [], skipped: [] }
      }

      const { templatePath } = findPrprojTemplate(params.customTemplatePath)
      const created: string[] = []
      const skipped: string[] = []
      const allDateReports: DateSequenceReportData[] = []
      const ignoreOutput = params.ignoreOutputFolders !== false // default true
      const mode = params.mode || 'master'

      let targetDirs: string[] = []

      if (mode === 'single') {
        targetDirs = [params.parentFolder]
      } else if (Array.isArray(params.targetFolders) && params.targetFolders.length > 0) {
        targetDirs = params.targetFolders.filter(d => fs.existsSync(d) && fs.statSync(d).isDirectory())
      } else {
        const entries = fs.readdirSync(params.parentFolder)

        for (const entry of entries) {
          const fullPath = path.join(params.parentFolder, entry)
          try {
            if (fs.statSync(fullPath).isDirectory()) {
              if (ignoreOutput && OUTPUT_FOLDER_NAMES.has(entry.toLowerCase())) continue
              targetDirs.push(fullPath)
            }
          } catch {}
        }
      }

      const totalDirs = targetDirs.length
      let index = 0

      for (const dirPath of targetDirs) {
        index++
        const folderName = path.basename(dirPath)
        const prprojName = `${folderName}.prproj`
        const xmlName = `${folderName}.xml`

        const destPrprojPath = path.join(dirPath, prprojName)
        const destXmlPath = path.join(dirPath, xmlName)

        const percent = Math.round((index / totalDirs) * 100)
        _e.sender.send('prproj:progress', {
          percent,
          currentFolder: folderName,
          index,
          total: totalDirs,
          status: `Generating sequence project for "${folderName}" (${index}/${totalDirs})...`
        })

        const overwrite = params.overwrite === true
        const hasPrprojFile = fs.existsSync(destPrprojPath) || (fs.existsSync(dirPath) && fs.readdirSync(dirPath).some(f => f.toLowerCase().endsWith('.prproj')))

        if (!overwrite && hasPrprojFile) {
          skipped.push(destPrprojPath)
          console.log(`[Prproj IPC] Skipped "${folderName}" because a .prproj file already exists in this folder.`)
          continue
        }

        try {
          let videos = discoverSubfolderVideosWithFoldersNode(dirPath)

          // Filter out clips inside excluded paths/folders
          if (Array.isArray(params.excludedPaths) && params.excludedPaths.length > 0) {
            const excludedNorm = params.excludedPaths.map(p => path.normalize(p).toLowerCase())
            videos = videos.filter(v => {
              const vDir = path.normalize(path.dirname(v.path)).toLowerCase()
              const vFile = path.normalize(v.path).toLowerCase()
              return !excludedNorm.some(ex => {
                if (vFile === ex || vDir === ex) return true
                const exWithSep = ex.endsWith(path.sep) ? ex : ex + path.sep
                return vFile.startsWith(exWithSep) || vDir.startsWith(exWithSep)
              })
            })
          }

          // Collect stats for date-wise Excel report
          try {
            const dateReport = await collectDateSequenceStatsNode(folderName, videos)
            allDateReports.push(dateReport)
          } catch (stErr) {
            console.warn(`[Prproj IPC] Failed to collect sequence stats for ${folderName}:`, stErr)
          }

          // 1. Write Premiere Interchange XML (.xml) containing V1/A1 clip placements and folder start timeline markers
          const xmlStr = await buildXmemlXmlNode(folderName, videos)
          const xmlBuffer = Buffer.from(xmlStr, 'utf-8')
          fs.writeFileSync(destXmlPath, xmlBuffer)

          // Save recent XML location to tracker files so Premiere Pro extension can locate it in 0ms
          try {
            const osMod = require('os')
            const tmpTrk = path.join(osMod.tmpdir(), '.onetap_recent_xml.txt')
            const tmpTrk2 = path.join(osMod.tmpdir(), 'recent_xml.txt')
            const entry = `${folderName}=${destXmlPath}`
            let existing = ''
            if (fs.existsSync(tmpTrk)) {
              try { existing = fs.readFileSync(tmpTrk, 'utf-8') } catch (_) {}
            }
            const lines = existing.split(/\r?\n/).filter(l => l.trim() && !l.startsWith(entry) && l.trim() !== destXmlPath)
            const newContent = [destXmlPath, entry, ...lines].slice(0, 50).join('\n')
            fs.writeFileSync(tmpTrk, newContent, 'utf-8')
            fs.writeFileSync(tmpTrk2, newContent, 'utf-8')
            const userDir = app.getPath('userData')
            if (userDir) {
              const appDataTrk = path.join(userDir, 'recent_xml.txt')
              fs.writeFileSync(appDataTrk, newContent, 'utf-8')
            }
          } catch (eTrk) {}

          // 2. Write valid Premiere Pro Project (.prproj) gzip stream
          const prprojBuffer = buildPrprojBuffer(folderName, templatePath)
          fs.writeFileSync(destPrprojPath, prprojBuffer)

          created.push(destPrprojPath)
          console.log(`[Prproj IPC] Generated Premiere project & XML sequence for ${folderName} (${videos.length} videos on V1/A1)`)
        } catch (genErr) {
          console.warn(`[Prproj IPC] Project generation error for ${folderName}:`, genErr)
          if (templatePath && fs.existsSync(templatePath)) {
            try {
              fs.copyFileSync(templatePath, destPrprojPath)
              created.push(destPrprojPath)
            } catch {}
          }
        }
        // Yield event loop instantly between folders to keep renderer UI smooth and responsive
        await new Promise(r => setImmediate(r))
      }

      let excelReportPath: string | null = null
      const targetExcelFolder = params.excelFolderPath || params.parentFolder
      if (targetExcelFolder && allDateReports.length > 0) {
        try {
          excelReportPath = generateExcelSequenceReportNode(
            allDateReports,
            targetExcelFolder,
            path.basename(params.parentFolder)
          )
          console.log(`[Prproj IPC] Generated Excel Sequence Report at: ${excelReportPath}`)
        } catch (exErr) {
          console.error(`[Prproj IPC] Excel report generation error:`, exErr)
        }
      }

      return {
        success: true,
        templateUsed: templatePath || 'Sequence Timeline Generator',
        createdCount: created.length,
        skippedCount: skipped.length,
        created,
        skipped,
        excelReportPath
      }
    } catch (err: any) {
      console.error('[Prproj IPC] Generation failed:', err)
      return { success: false, error: err.message || String(err), created: [], skipped: [] }
    }
  })
}

