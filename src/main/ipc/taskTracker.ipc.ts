/**
============================================================
AUTONOMOUS TASK & PRODUCTION TRACKER IPC (taskTracker.ipc.ts)

Main process engine for real-time tracking of Safar and Date
editing, review, upload, and AlJamea submission lifecycles.
Backed by SQLite (tracker.db) for drive-independent persistence.
============================================================
*/

import { ipcMain, BrowserWindow, shell, dialog, app } from 'electron'
import { openInEcosystemExplorer } from '../core/ecosystemExplorer'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync, spawn } from 'child_process'
import * as XLSX from 'xlsx'
import { extractCity } from '../core/safarHierarchy'

const VIDEO_EXTS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts', '.mxf', '.wmv',
  '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp'
])

const AUDIO_EXTS = new Set(['.wav', '.mp3', '.m4a', '.aac', '.flac', '.aiff', '.ogg'])
const PROJECT_EXTS = new Set(['.prproj', '.aep', '.psd', '.ai'])
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.raw', '.cr2', '.cr3', '.arw', '.nef'])

export type TaskStatus =
  | 'editing_pending'
  | 'editing'
  | 'review'
  | 'upload_pending'
  | 'uploaded'
  | 'submitted'

export interface TaskRecord {
  id?: number
  safarName: string
  dateFolder: string
  status: TaskStatus
  firstSeenAt?: number
  prprojModifiedAt?: number
  prprojPath?: string
  renderedAt?: number
  renderDuration?: number
  renderVideoCount?: number
  renderSizeBytes?: number
  uploadedAt?: number
  submittedAt?: number
  workingPath?: string
  finalPath?: string
  uploadPath?: string
  deletePath?: string
  currentDrive?: string
  notes?: string
  metadata?: Record<string, any>
  updatedAt?: number
  isAvailable?: boolean
  isDriveConnected?: boolean
  manualStatus?: 'uploaded' | 'submitted' | null
  isManual?: boolean
}

export interface SafarRecord {
  id?: number
  safarName: string
  safarYear?: number
  safarSerial?: string
  city?: string
  totalDays: number
  completedDays: number
  isSafarDone: boolean
  currentPath?: string
  currentDrive?: string
  isAvailable?: boolean
  isDriveConnected?: boolean
  isPathExists?: boolean
  manualStatus?: 'uploaded' | 'submitted' | null
  isManual?: boolean
  tasks: TaskRecord[]
}

export interface MediaResourceRecord {
  id?: number
  taskId?: number
  safarName: string
  dateFolder?: string
  fileName: string
  filePath: string
  parentDir: string
  fileType: 'video' | 'project' | 'audio' | 'image' | 'folder' | 'other'
  category: 'final_render' | 'working_project' | 'raw_footage' | 'folder' | 'to_upload' | 'to_delete'
  driveRoot: string
  driveLabel?: string
  fileSize: number
  duration?: number
  mtime: number
  updatedAt?: number
  isAvailable?: boolean
  isDriveConnected?: boolean
}

export interface DriveWorkspaceConfig {
  id: string
  driveRoot: string
  inProcessPath?: string
  toUploadPath?: string
  toDeletePath?: string
  pendingPath?: string
  enabled: boolean
}

export interface DriveAutoDetectResult {
  driveRoot: string
  inProcessPath: string
  inProcessExists: boolean
  toUploadPath: string
  toUploadExists: boolean
  toDeletePath: string
  toDeleteExists: boolean
  pendingExists?: boolean
  safarCount: number
}

// ── Physical Drive Volume Label Resolver ──────────────────────

let driveLabelCache: Map<string, string> = new Map()
let lastLabelFetch = 0
let isFetchingLabels = false

// Initialize default drive letters so cache is never completely empty
for (const letter of ['C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'I:', 'J:']) {
  driveLabelCache.set(letter, `Drive ${letter}`)
  driveLabelCache.set(letter + '\\', `Drive ${letter}`)
  driveLabelCache.set(letter.slice(0, 1), `Drive ${letter}`)
}

export function refreshDriveLabelsAsync(): void {
  if (isFetchingLabels) return
  isFetchingLabels = true
  try {
    const ps = spawn('powershell', ['-NoProfile', '-Command', 'Get-Volume | Select-Object DriveLetter, FileSystemLabel | ConvertTo-Json'], {
      windowsHide: true
    })
    let stdout = ''
    ps.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    ps.on('close', (code) => {
      isFetchingLabels = false
      if (code === 0 && stdout.trim()) {
        try {
          const data = JSON.parse(stdout.trim())
          const items = Array.isArray(data) ? data : [data]
          for (const item of items) {
            if (item.DriveLetter) {
              const letter = item.DriveLetter.toUpperCase() + ':'
              const label = (item.FileSystemLabel || '').trim() || `Drive ${letter}`
              driveLabelCache.set(letter, label)
              driveLabelCache.set(letter + '\\', label)
              driveLabelCache.set(letter.slice(0, 1), label)
            }
          }
          lastLabelFetch = Date.now()
        } catch {}
      }
    })
    ps.on('error', () => { isFetchingLabels = false })
  } catch {
    isFetchingLabels = false
  }
}

// Initial trigger in background
setTimeout(() => { refreshDriveLabelsAsync() }, 1000)

export function getDriveVolumeLabels(): Map<string, string> {
  const now = Date.now()
  if (now - lastLabelFetch > 30000) {
    refreshDriveLabelsAsync()
  }
  return driveLabelCache
}

export function resolveDriveLabel(driveRootOrPath: string): string {
  if (!driveRootOrPath) return 'External Drive'
  const parsed = path.parse(driveRootOrPath)
  const root = (parsed.root || driveRootOrPath).toUpperCase().slice(0, 2)
  const labels = getDriveVolumeLabels()
  return labels.get(root) || labels.get(root + '\\') || `Drive ${root}`
}

// ── Python SQLite Database Bridge ─────────────────────────────

function getTrackerScriptPath(): string | null {
  const candidates: string[] = []
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'python', 'tracker_db.py'))
    candidates.push(path.join(process.resourcesPath, 'tracker_db.py'))
  }
  const appPath = app.getAppPath()
  if (appPath.includes('app.asar')) {
    candidates.push(path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'src', 'main', 'python', 'tracker_db.py'))
  } else {
    candidates.push(path.join(appPath, 'src', 'main', 'python', 'tracker_db.py'))
  }
  candidates.push(
    path.join(__dirname, '../../src/main/python/tracker_db.py'),
    path.join(__dirname, '../python/tracker_db.py')
  )

  for (const p of candidates) {
    if (p && !p.includes('app.asar') && fs.existsSync(p)) return p
  }
  return null
}

let detectedPythonCmd: string | null = null

function runTrackerDbAsync(args: string[], stdinData?: string): Promise<any> {
  return new Promise((resolve) => {
    const script = getTrackerScriptPath()
    if (!script) return resolve(null)

    const py = detectedPythonCmd || 'python'
    try {
      const child = spawn(py, [script, ...args], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf-8')
      })

      child.on('error', () => {
        // Fallback to synchronous if spawn failed
        try {
          const syncRes = runTrackerDb(args, stdinData)
          resolve(syncRes)
        } catch {
          resolve(null)
        }
      })

      child.on('close', (code) => {
        if (code === 0 && stdout) {
          detectedPythonCmd = py
          try {
            resolve(JSON.parse(stdout.trim()))
          } catch {
            resolve(null)
          }
        } else {
          resolve(null)
        }
      })

      if (stdinData) {
        child.stdin.write(stdinData)
        child.stdin.end()
      }
    } catch {
      resolve(null)
    }
  })
}

function runTrackerDb(args: string[], stdinData?: string): any {
  const script = getTrackerScriptPath()
  if (!script) return null

  const pythonCmds = detectedPythonCmd ? [detectedPythonCmd] : ['python', 'py', 'python3']
  for (const py of pythonCmds) {
    try {
      const res = spawnSync(py, [script, ...args], {
        input: stdinData,
        encoding: 'utf-8',
        windowsHide: true,
        maxBuffer: 50 * 1024 * 1024,
        timeout: 8000
      })

      if (!res.error && res.status === 0 && res.stdout) {
        if (!detectedPythonCmd) detectedPythonCmd = py
        try {
          return JSON.parse(res.stdout.trim())
        } catch {}
      }
    } catch {}
  }
  return null
}

// ── Directory Watchers Registry ───────────────────────────────

let activeWatchers: fs.FSWatcher[] = []
let watchDebounceTimer: NodeJS.Timeout | null = null

function broadcastChange(): void {
  if (watchDebounceTimer) clearTimeout(watchDebounceTimer)
  watchDebounceTimer = setTimeout(() => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('taskTracker:changed')
      }
    }
  }, 1200)
}

function stopAllWatchers(): void {
  for (const w of activeWatchers) {
    try { w.close() } catch {}
  }
  activeWatchers = []
}

function watchFolderSafe(folderPath: string): void {
  if (!folderPath || !fs.existsSync(folderPath)) return
  const clean = folderPath.trim()
  if (/^[A-Za-z]:[\\/]*$/.test(clean) || clean.length <= 3) return // Never watch bare drive root
  try {
    const watcher = fs.watch(folderPath, { recursive: true }, () => {
      broadcastChange()
    })
    watcher.on('error', () => {})
    activeWatchers.push(watcher)
  } catch (err) {
    console.warn(`[taskTracker] Watch failed on ${folderPath}:`, err)
  }
}

// ── Auto-Drive Watchdog (Drive Reconnect Sentinel) ────────────
let driveSentinelTimer: NodeJS.Timeout | null = null
let lastKnownDrives: Set<string> = new Set()
export let verifiedOnlineDrives: Set<string> = new Set(['C:'])

export function updateOnlineDrives(): Set<string> {
  const list = new Set<string>()
  if (process.platform === 'win32') {
    for (let i = 67; i <= 90; i++) {
      const letter = String.fromCharCode(i) + ':'
      const root = letter + '\\'
      try {
        if (fs.existsSync(root)) {
          list.add(letter)
        }
      } catch {}
    }
  } else {
    list.add('/')
  }
  verifiedOnlineDrives = list
  return list
}

export function startDriveSentinel(): void {
  if (driveSentinelTimer) return

  const scanDrives = (): Set<string> => {
    const list = new Set<string>()
    if (process.platform === 'win32') {
      // Start from 'C' (67) to skip floppy/card-reader interrupts on A and B
      for (let i = 67; i <= 90; i++) {
        const root = String.fromCharCode(i) + ':\\'
        try {
          if (fs.existsSync(root)) {
            list.add(root.toUpperCase())
          }
        } catch {}
      }
    }
    return list
  }

  lastKnownDrives = scanDrives()
  updateOnlineDrives()

  driveSentinelTimer = setInterval(() => {
    const current = scanDrives()
    updateOnlineDrives()
    let changed = false
    const newlyConnected: string[] = []

    for (const d of current) {
      if (!lastKnownDrives.has(d)) {
        changed = true
        newlyConnected.push(d)
      }
    }
    for (const d of lastKnownDrives) {
      if (!current.has(d)) {
        changed = true
      }
    }

    if (changed) {
      lastKnownDrives = current
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('taskTracker:drives-changed', {
            connected: Array.from(current),
            newlyConnected
          })
        }
      }
    }
  }, 15000)
}

// ── Title Adder ➔ Task Tracker Bridge Helper ──────────────────
export function recordRenderFinished(params: {
  safarName: string
  dateFolder: string
  outputPath: string
  duration: number
  fileSizeBytes: number
}): boolean {
  if (!params.safarName || !params.dateFolder) return false

  const task: Partial<TaskRecord> = {
    safarName: params.safarName,
    dateFolder: params.dateFolder,
    status: 'upload_pending',
    renderedAt: Date.now(),
    renderVideoCount: 1,
    renderSizeBytes: params.fileSizeBytes,
    finalPath: path.dirname(params.outputPath),
    metadata: {
      isRendered: true,
      lastRenderFile: path.basename(params.outputPath),
      durationSeconds: params.duration
    }
  }

  try {
    runTrackerDb(['--upsert-batch'], JSON.stringify({
      tasks: [task],
      safars: [{
        safarName: params.safarName,
        totalDays: 1,
        completedDays: 0,
        isSafarDone: false
      }]
    }))
    broadcastChange()
    return true
  } catch (err) {
    console.warn('[taskTracker] recordRenderFinished error:', err)
    return false
  }
}


// ── Helpers for Safar & Date Folder Parsing ───────────────────

const SYSTEM_IGNORED_DIRS = new Set([
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
  'appdata',
  'system volume information',
  '$recycle.bin',
  'winsxs',
  'systemapps',
  'system32',
  'syswow64',
  'recovery',
  'msocache',
  'perflogs',
  'node_modules',
  '.git',
  '.gemini',
  'microsoft',
  'msbuild',
  'windows kits',
  'temp', 'intelvga', 'dptf', 'mei', 'drivers',
  'cache'
])

export function isSystemIgnored(dirName: string): boolean {
  if (!dirName) return true
  const lower = dirName.toLowerCase().trim()
  if (lower.startsWith('$') || lower.startsWith('.')) return true
  return SYSTEM_IGNORED_DIRS.has(lower)
}

export function isContainerFolderName(name: string): boolean {
  if (!name) return true
  const clean = name.trim().toLowerCase()
  if (isSystemIgnored(clean)) return true
  if (/^(?:in[\s_-]?process|pending|to[\s_-]?delete|to[\s_-]?upload|uploaded[\s_-]?data|uploaded|upload|client|clients|safars?|working[\s_-]?safar|working|final|output|exports?|dvd)$/i.test(clean)) return true
  const rootKey = clean.replace(/[\s_-]+/g, ' ')
  if (['in process', 'to upload', 'to delete', 'uploaded data', 'uploaded', 'upload', 'pending', 'safars', 'safar', 'working safar', 'working', 'client', 'clients', 'final', 'output', 'export'].includes(rootKey)) return true
  return false
}

export function isSafarFolder(name: string, dirPath?: string): boolean {
  if (!name) return false
  const clean = name.trim()
  if (isSystemIgnored(clean) || isContainerFolderName(clean)) return false
  const rootKey = clean.toUpperCase().replace(/[\s_-]+/g, ' ').trim()
  if (['IN PROCESS', 'TO UPLOAD', 'TO DELETE', 'UPLOADED DATA', 'UPLOADED', 'UPLOAD', 'PENDING', 'SAFARS', 'SAFAR', 'WORKING SAFAR', 'WORKING', 'CLIENT', 'CLIENTS'].includes(rootKey)) return false
  if (/^(?:intelvga|dptf|mei|realtek|nvidia|amd|driver|drivers|windows|system|\$recycle\.bin)/i.test(clean)) return false

  // If a directory on disk contains a Final subfolder or subdirectories that match dates, it is definitely a Safar
  if (dirPath && fs.existsSync(dirPath)) {
    try {
      const subs = fs.readdirSync(dirPath, { withFileTypes: true })
      const hasFinal = subs.some(e => e.isDirectory() && (e.name.toLowerCase() === 'final' || e.name.toLowerCase() === 'final titles'))
      const hasDateSub = subs.some(e => e.isDirectory() && (extractCleanDateFolder(e.name) !== null || /^\d{4}[\s._-]\d{1,2}/.test(e.name)))
      if (hasFinal || hasDateSub) return true
    } catch {}
  }

  // Pure date deliverables without city or with event session tags are dates, not Safars:
  // e.g. "1448-05-08 _01M", "1448-05-08 _02E", "2026-11-05", "1448-05-08"
  if (/^\d{4}[\s._-]\d{1,2}[\s._-]\d{1,2}(?:\s*_\d{2}[A-Za-z]|\s*_\d{2}|\s*waaz|\s*isteqbal|\s*majlis|\s*urs|\s*ziyarat|$)/i.test(clean)) {
    return false
  }

  // If it starts with YYYY-MM-DD or YYYY-Serial-Day followed by a City name (e.g. "1448-05-08 Coimbatore", "1448-01-22 Mumbai"):
  if (/^\d{4}[\s._-]\d{1,2}[\s._-]\d{1,2}[\s._-]+[A-Za-z]/i.test(clean)) {
    return true
  }
  // date deliverables without city handled above
  if (/^day[\s._-]?\d+/i.test(clean)) return false
  if (/^\d{1,2}$/.test(clean)) return false
  if (/^\d{1,3}[\s\-_.]+(?:waaz|majlis|isteqbal|misaaq|ziyarat|event|session|morning|evening|night|day)\b/i.test(clean)) return false
  if (/^(?:waaz|majlis|isteqbal|misaaq|ziyarat|event|session|morning|evening|night)\b/i.test(clean)) return false
  // Standard Safar folder patterns:
  // e.g. "1448-03 Mumbai", "1448_03_Mumbai", "1448 - 03 Mumbai", "1448-03-Mumbai", "1448-03"
  if (/^\d{4}[\s\-_.]+\d{1,3}(?:[\s\-_.]+[A-Za-z].*)?$/i.test(clean)) return true
  // e.g. "03-Mumbai", "03_Mumbai", "03 Mumbai"
  if (/^\d{1,3}[\s\-_.]+[A-Za-z].*$/i.test(clean)) return true
  // e.g. "1448 Mumbai", "1448-Mumbai"
  if (/^\d{4}[\s\-_.]+[A-Za-z].*$/i.test(clean)) return true
  // Explicit "Safar" in name e.g. "Safar 1", "Safar_Mumbai"
  if (/safar|istefad[ah]?|ziyafat|urs|milad/i.test(clean)) return true
  return false
}

function parseSafarMetadata(folderName: string): { name: string; year?: number; serial?: string; city: string } {
  let year: number | undefined
  let serial: string | undefined
  let city = extractCity(folderName) || 'Unassigned'

  // Match e.g. "1448-03 Mumbai", "1448-02 Raipur", "1447-08 Mumbai - Urs Mubarak..."
  const m1 = folderName.match(/^(\d{4})[\s\-_]+(\d{1,3})[\s\-_]+(.+)$/)
  if (m1) {
    year = parseInt(m1[1], 10)
    serial = m1[2].padStart(2, '0')
    if (!city || city === 'Unassigned') {
      const rest = m1[3].split(/[-–—]/)[0].trim()
      if (rest) city = rest
    }
  } else {
    // Match "08-Mumbai..."
    const m2 = folderName.match(/^(\d{1,3})[\s\-_]+([A-Za-z].+)$/)
    if (m2) {
      serial = m2[1].padStart(2, '0')
    } else {
      // Match "1447-Mumbai..."
      const m3 = folderName.match(/^(\d{4})[\s\-_]+([A-Za-z].+)$/)
      if (m3) {
        year = parseInt(m3[1], 10)
      }
    }
  }

  return { name: folderName, year, serial, city }
}

export const excludedFolderKeys = new Set<string>()

export function normalizeDateFolderKey(name: string): string {
  return (name || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim()
}

export function extractCleanDateFolder(name: string): string | null {
  if (!name) return null
  const clean = name.replace(/\.[a-z\d]{2,6}$/i, '').trim()
  if (!clean || isSystemIgnored(clean)) return null
  const lower = clean.toLowerCase()
  if (['final', 'final titles', 'output', 'outputs', 'export', 'exports', 'dvd', 'titles', 'assets', 'raw', 'temp'].includes(lower) || lower.startsWith('$') || lower.startsWith('.')) return null
  if (/^(?:intelvga|dptf|mei|realtek|nvidia|amd|driver|drivers|windows|system)/i.test(clean)) return null
  if (isSafarFolder(clean)) return null

  // 1. Matches standard date format with or without session: e.g. "1448-05-08 _01M", "1448-05-08 _02E", "1448-05-08", "2026-11-05"
  if (/^\d{4}[\s._-]\d{1,2}[\s._-]\d{1,2}/.test(clean)) {
    return clean
  }
  // 2. Matches "01-1448-05" or "14-03-1448"
  if (/^\d{1,2}[\s._-]\d{1,2}[\s._-]\d{2,4}/.test(clean)) {
    return clean
  }
  // 3. Matches "Day 01", "Day 1", "Day-02"
  const dayMatch = clean.match(/^day[\s._\-]?(\d{1,3})/i)
  if (dayMatch) {
    const d = parseInt(dayMatch[1], 10)
    return `Day ${d < 10 ? '0' + d : d}`
  }
  // 4. Session / Waaz formats: "01 Waaz...", "23-01 Waaz Leicester", "Waaz Day 01"
  if (/^\d{1,2}[\s._-]+(?:waaz|majlis|isteqbal|misaaq|ziyarat|event|session)/i.test(clean) || /(?:waaz|majlis|isteqbal)[\s._-]+(?:day[\s._-]?)?\d{1,2}/i.test(clean)) {
    return clean
  }
  // 5. Numbered day folders e.g. "01", "02", "1", "2"
  const numOnly = clean.match(/^(\d{1,2})$/)
  if (numOnly) {
    const d = parseInt(numOnly[1], 10)
    if (d >= 1 && d <= 31) return `Day ${d < 10 ? '0' + d : d}`
  }
  const leadingNumMatch = clean.match(/^(\d{1,2})[\s._\-]+[A-Za-z]/)
  if (leadingNumMatch) {
    return clean
  }
  // 6. Generic session or event folder inside a Safar:
  if (!/^[A-Za-z]+$/.test(clean) && clean.length >= 2) {
    return clean
  }
  return null
}

export function isDateFolder(name: string): boolean {
  return extractCleanDateFolder(name) !== null
}

function _legacyIsDateFolder(name: string): boolean {
  if (!name) return false
  const clean = name.trim().toLowerCase()
  if (
    clean === 'final' ||
    clean === 'final titles' ||
    clean === 'output' ||
    clean === 'export' ||
    clean === 'exports' ||
    clean === 'dvd' ||
    clean === '$recycle.bin' ||
    clean === 'system volume information' ||
    clean.startsWith('.')
  ) {
    return false
  }

  // A folder matching Safar pattern (e.g. "1448-03 Mumbai") is NOT a date folder
  if (isSafarFolder(name)) {
    return false
  }

  // Date pattern matches e.g. "1448-03-13 _01M", "1448-02-28 _02E", "1448-03-13", "2026-09-05", "Day 1", "01", "02"
  return (
    /^\d{4}[\s._\-]\d{1,2}[\s._\-]\d{1,2}/.test(clean) ||
    /^\d{1,2}[\s._\-]\d{1,2}[\s._\-]\d{2,4}/.test(clean) ||
    /^day[\s._\-]?\d+/i.test(clean) ||
    // Reject camera / sub-event items
    (!(/^cam\s*\d+/i.test(clean) || /^cam\b/i.test(clean) || /^\d{1,3}\s*[-_]\s*[a-z]{1,4}\s*[-_]/i.test(clean) || /^[-_]\d{1,4}[a-z]?[-_]/i.test(clean)) && false) ||
    /^\d{2,4}[\s._\-]\d{1,2}[\s._\-]+_?\d{1,2}[a-z]/i.test(clean)
  )
}

function scanFolderMedia(folderPath: string, maxDepth = 2, currentDepth = 0): { videoCount: number; totalSize: number; mtime: number } {
  let videoCount = 0
  let totalSize = 0
  let maxMtime = 0

  if (currentDepth > maxDepth || !folderPath || !fs.existsSync(folderPath)) {
    return { videoCount, totalSize, mtime: 0 }
  }

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true })
    for (const ent of entries) {
      if (isSystemIgnored(ent.name)) continue
      const full = path.join(folderPath, ent.name)
      if (ent.isDirectory()) {
        const sub = scanFolderMedia(full, maxDepth, currentDepth + 1)
        videoCount += sub.videoCount
        totalSize += sub.totalSize
        if (sub.mtime > maxMtime) maxMtime = sub.mtime
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase()
        if (VIDEO_EXTS.has(ext)) {
          videoCount++
          try {
            const st = fs.statSync(full)
            totalSize += st.size
            if (st.mtimeMs > maxMtime) maxMtime = st.mtimeMs
          } catch {}
        }
      }
    }
  } catch {}

  return { videoCount, totalSize, mtime: maxMtime }
}

function checkAdobeProject(folderPath: string): { hasPrproj: boolean; prprojPath?: string; modifiedAt?: number; hasAutoSave: boolean } {
  let hasPrproj = false
  let prprojPath: string | undefined
  let modifiedAt: number | undefined
  let hasAutoSave = false

  if (!fs.existsSync(folderPath)) return { hasPrproj, hasAutoSave }

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true })
    // 1. Direct scan inside the date folder
    for (const ent of entries) {
      const full = path.join(folderPath, ent.name)
      if (ent.isFile() && path.extname(ent.name).toLowerCase() === '.prproj') {
        hasPrproj = true
        prprojPath = full
        try {
          const st = fs.statSync(full)
          modifiedAt = st.mtimeMs
        } catch {}
      } else if (ent.isDirectory() && ent.name.toLowerCase().includes('auto-save')) {
        hasAutoSave = true
      }
    }

    // 2. If no .prproj at root of date folder, inspect 1 level of subfolders (ignoring auto-save)
    if (!hasPrproj) {
      for (const ent of entries) {
        if (ent.isDirectory() && !ent.name.toLowerCase().includes('auto-save') && !ent.name.startsWith('.')) {
          try {
            const subPath = path.join(folderPath, ent.name)
            const subEntries = fs.readdirSync(subPath, { withFileTypes: true })
            for (const sub of subEntries) {
              if (sub.isFile() && path.extname(sub.name).toLowerCase() === '.prproj') {
                hasPrproj = true
                prprojPath = path.join(subPath, sub.name)
                try {
                  const st = fs.statSync(prprojPath)
                  modifiedAt = st.mtimeMs
                } catch {}
                break
              }
            }
          } catch {}
          if (hasPrproj) break
        }
      }
    }
  } catch {}

  return { hasPrproj, prprojPath, modifiedAt, hasAutoSave }
}

// ── Collect Directory & File Names (Fast recursive index of existing folders & renders) ───

function getFolderNamesSet(rootPath: string): Map<string, string> {
  const map = new Map<string, string>() // cleanNameLower -> fullPath
  if (!rootPath || !fs.existsSync(rootPath)) return map

  function walk(dir: string, depth = 0) {
    if (depth > 5) return
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const ent of entries) {
        if (ent.name.startsWith('.') || ent.name.startsWith('._') || ent.name.toLowerCase() === '$recycle.bin') continue

        const full = path.join(dir, ent.name)
        const lower = ent.name.toLowerCase().trim()

        const cleanDate = extractCleanDateFolder(ent.name)
        const parentName = path.basename(dir).toLowerCase().trim()
        if (cleanDate) {
          const normD = normalizeDateFolderKey(cleanDate)
          if (!map.has(normD)) map.set(normD, full)
          if (depth >= 1 && parentName) {
            map.set(`${parentName}::${normD}`, full)
          }
        }
        if (ent.isDirectory()) {
          const stats = scanFolderMedia(full, 2)
          if (stats.videoCount > 0 && !map.has(lower)) {
            map.set(lower, full)
          }
          walk(full, depth + 1)
        } else if (ent.isFile() && depth <= 2) {
          const ext = path.extname(ent.name).toLowerCase()
          if (VIDEO_EXTS.has(ext) || ext === '.zip' || ext === '.rar') {
            const baseNoExt = path.parse(ent.name).name.toLowerCase().trim()
            if (!map.has(baseNoExt)) {
              map.set(baseNoExt, full)
            }
          }
        }
      }
    } catch {}
  }

  walk(rootPath)
  return map
}

// ── Auto-Detect Standard Folders on a Drive ───────────────────

export function autoDetectDriveFolders(driveRoot: string): DriveAutoDetectResult {
  let root = (driveRoot || '').trim()
  if (/^[A-Za-z]:$/.test(root)) {
    root = root + '\\'
  }

  const result: DriveAutoDetectResult = {
    driveRoot: root,
    inProcessPath: path.join(root, 'In Process'),
    inProcessExists: false,
    toUploadPath: path.join(root, 'To Upload'),
    toUploadExists: false,
    toDeletePath: path.join(root, 'To Delete'),
    toDeleteExists: false,
    pendingPath: path.join(root, 'Pending'),
    pendingExists: false,
    safarCount: 0
  }

  if (!root || !fs.existsSync(root)) {
    return result
  }

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)

    // 1. Detect IN PROCESS (Safar data)
    // Priority: 'in process', 'in_process', 'inprocess', 'safar', 'safars', 'working safar', 'working'
    const inProcessCandidates = ['in process', 'in_process', 'inprocess', 'safar', 'safars', 'working safar', 'working']
    for (const cand of inProcessCandidates) {
      const match = dirs.find(d => d.toLowerCase() === cand)
      if (match) {
        result.inProcessPath = path.join(root, match)
        result.inProcessExists = true
        break
      }
    }
    if (!result.inProcessExists) {
      const rootSafars = dirs.filter(
        d => !d.startsWith('.') && d.toLowerCase() !== '$recycle.bin' && isSafarFolder(d)
      )
      if (rootSafars.length > 0) {
        result.inProcessPath = root
        result.inProcessExists = true
        result.safarCount = rootSafars.length
      } else {
        // Deep search up to 2 levels for candidate Safar folders or container directories
        try {
          const deepCandidates: string[] = []
          for (const d of dirs) {
            const dLower = d.toLowerCase()
            if (
              d.startsWith('.') ||
              d.startsWith('$') ||
              dLower.includes('recycle') ||
              dLower === 'system volume information' ||
              dLower === 'node_modules' ||
              dLower === 'windows' ||
              dLower.includes('program files') ||
              dLower.includes('appdata') ||
              dLower.includes('programdata') ||
              dLower.includes('recovery') ||
              dLower.includes('uid data') ||
              dLower.includes('database') ||
              dLower === 'users'
            ) continue
            const subPath = path.join(root, d)
            try {
              const subEntries = fs.readdirSync(subPath, { withFileTypes: true })
              for (const se of subEntries) {
                if (se.isDirectory() && !se.name.startsWith('.') && !se.name.startsWith('$')) {
                  if (isSafarFolder(se.name)) {
                    deepCandidates.push(path.join(subPath, se.name))
                  } else {
                    try {
                      const grandSub = fs.readdirSync(path.join(subPath, se.name), { withFileTypes: true })
                      if (grandSub.some(g => g.isDirectory() && (isDateFolder(g.name) || g.name.toLowerCase() === 'final'))) {
                        deepCandidates.push(path.join(subPath, se.name))
                      }
                    } catch {}
                  }
                }
              }
            } catch {}
          }
          if (deepCandidates.length > 0) {
            result.inProcessPath = path.dirname(deepCandidates[0])
            result.inProcessExists = true
            result.safarCount = deepCandidates.length
          } else {
            result.inProcessExists = fs.existsSync(result.inProcessPath)
          }
        } catch {
          result.inProcessExists = fs.existsSync(result.inProcessPath)
        }
      }
    }

    // Count Safars in IN PROCESS
    if (result.inProcessExists && result.safarCount === 0) {
      try {
        const ipEntries = fs.readdirSync(result.inProcessPath, { withFileTypes: true })
        result.safarCount = ipEntries.filter(
          e => e.isDirectory() && !e.name.startsWith('.') && e.name.toLowerCase() !== '$recycle.bin' && isSafarFolder(e.name)
        ).length
      } catch {}
    }

    // 2. Detect TO UPLOAD / UPLOADED DATA
    // Priority: 'to upload', 'to_upload', 'uploaded data', 'uploaded', 'upload'
    const uploadCandidates = ['to upload', 'to_upload', 'uploaded data', 'uploaded', 'upload']
    for (const cand of uploadCandidates) {
      const match = dirs.find(d => d.toLowerCase() === cand)
      if (match) {
        result.toUploadPath = path.join(root, match)
        result.toUploadExists = true
        break
      }
    }
    if (!result.toUploadExists) {
      const fallbackToUpload = path.join(root, 'To Upload')
      if (fs.existsSync(fallbackToUpload)) {
        result.toUploadPath = fallbackToUpload
        result.toUploadExists = true
      } else {
        result.toUploadExists = fs.existsSync(result.toUploadPath)
      }
    }

    // 3. Detect TO DELETE
    // Priority: 'to delete', 'to_delete', 'delete'
    const deleteCandidates = ['to delete', 'to_delete', 'delete']
    for (const cand of deleteCandidates) {
      const match = dirs.find(d => d.toLowerCase() === cand)
      if (match) {
        result.toDeletePath = path.join(root, match)
        result.toDeleteExists = true
        break
      }
    }
    if (!result.toDeleteExists) {
      result.toDeleteExists = fs.existsSync(result.toDeletePath)
    }

    // 4. Detect PENDING
    const pendingCandidates = ['pending', 'to pending', 'queue', 'working safar']
    for (const cand of pendingCandidates) {
      const match = dirs.find(d => d.toLowerCase() === cand)
      if (match) {
        result.pendingPath = path.join(root, match)
        result.pendingExists = true
        break
      }
    }
    if (!result.pendingExists) {
      result.pendingExists = fs.existsSync(result.pendingPath)
    }

    // Count Safars across all detected workspace containers
    let detectedSafars = 0
    const probeDirs = [
      result.inProcessExists ? result.inProcessPath : null,
      result.pendingExists ? result.pendingPath : null,
      result.toDeleteExists ? result.toDeletePath : null
    ].filter(Boolean) as string[]

    for (const p of probeDirs) {
      try {
        const ents = fs.readdirSync(p, { withFileTypes: true })
        detectedSafars += ents.filter(
          e => e.isDirectory() && !isSystemIgnored(e.name) && isSafarFolder(e.name, path.join(p, e.name))
        ).length
      } catch {}
    }
    result.safarCount = detectedSafars
    if (false) {
    }
  } catch (err) {
    console.error('[taskTracker] autoDetectDriveFolders error:', err)
  }

  return result
}

export function createDriveFolders(folders: string[], safarName?: string): { success: boolean; created: string[]; errors: string[] } {
  const created: string[] = []
  const errors: string[] = []
  for (const f of folders) {
    if (!f) continue
    try {
      if (!fs.existsSync(f)) {
        fs.mkdirSync(f, { recursive: true })
        created.push(f)
      }
    } catch (e: any) {
      errors.push(`${f}: ${e.message}`)
    }
  }

  if (safarName && safarName.trim()) {
    const today = new Date().toISOString().slice(0, 10)
    for (const f of folders) {
      if (!f) continue
      const isRoot = /^[A-Za-z]:[\\/]?$/.test(f.trim())
      const inProcessDir = isRoot ? path.join(f, 'IN PROCESS') : (f.toLowerCase().includes('in process') ? f : null)
      if (inProcessDir) {
        const safarRoot = path.join(inProcessDir, safarName.trim())
        const subDirs = [safarRoot, path.join(safarRoot, today), path.join(safarRoot, 'Final')]
        for (const sd of subDirs) {
          try {
            if (!fs.existsSync(sd)) {
              fs.mkdirSync(sd, { recursive: true })
              created.push(sd)
            }
          } catch (e: any) {
            errors.push(`${sd}: ${e.message}`)
          }
        }
      }
    }
  }

  return { success: errors.length === 0, created, errors }
}

// ── Single Workspace Scanner Helper ────────────────────────────

function scanSingleWorkspace(
  workingPath: string,
  toUploadPath?: string,
  toDeletePath?: string,
  driveRootOverride?: string,
  pendingPath?: string
): { safars: SafarRecord[]; tasks: TaskRecord[]; resources: MediaResourceRecord[] } {
  const tasksToUpsert: TaskRecord[] = []
  const safarsToUpsert: SafarRecord[] = []
  const resourcesToUpsert: MediaResourceRecord[] = []

  let actualWorkingPath = (workingPath || '').trim()
  if (!actualWorkingPath) {
    return { safars: [], tasks: [], resources: [] }
  }

  // Fast offline check: If the drive letter is not currently verified online, return immediately without touching disk!
  const targetDriveRoot = driveRootOverride || path.parse(actualWorkingPath).root
  const driveLetterMatch = targetDriveRoot.match(/^([A-Za-z]:)/)
  const driveLetter = driveLetterMatch ? driveLetterMatch[1].toUpperCase() : null
  if (actualWorkingPath && fs.existsSync(actualWorkingPath)) {
    if (driveLetter) verifiedOnlineDrives.add(driveLetter)
  } else if (driveLetter && !verifiedOnlineDrives.has(driveLetter)) {
    return { safars: [], tasks: [], resources: [] }
  }

  // Skip system/program directories
  if (isSystemIgnored(path.basename(actualWorkingPath))) {
    return { safars: [], tasks: [], resources: [] }
  }

  if (!fs.existsSync(actualWorkingPath)) {
    // 1. Try case-insensitive lookup in parent directory
    const parent = path.dirname(actualWorkingPath || '')
    if (parent && fs.existsSync(parent)) {
      try {
        const pEntries = fs.readdirSync(parent)
        const base = path.basename(actualWorkingPath).toLowerCase()
        const match = pEntries.find(e => e.toLowerCase() === base)
        if (match) actualWorkingPath = path.join(parent, match)
      } catch {}
    }
    // 2. Try looking in drive root for standard in-process candidates or direct Safar folders
    if (!fs.existsSync(actualWorkingPath)) {
      const driveRoot = driveRootOverride || path.parse(workingPath).root
      if (driveRoot && fs.existsSync(driveRoot)) {
        try {
          const rootDirs = fs.readdirSync(driveRoot)
          const ipCand = ['in process', 'in_process', 'inprocess', 'safars', 'safar', 'working safar', 'working']
          const matchedIp = rootDirs.find(d => ipCand.includes(d.toLowerCase()))
          if (matchedIp) {
            actualWorkingPath = path.join(driveRoot, matchedIp)
          } else {
            // Check if Safar folders live directly in the drive root
            const hasRootSafars = rootDirs.some(d => isSafarFolder(d))
            if (hasRootSafars) {
              actualWorkingPath = driveRoot
            }
          }
        } catch {}
      }
    }
  }

  if (!actualWorkingPath || !fs.existsSync(actualWorkingPath) || isSystemIgnored(path.basename(actualWorkingPath))) {
    return { safars: [], tasks: [], resources: [] }
  }

  const uploadFoldersMap = toUploadPath && fs.existsSync(toUploadPath)
    ? getFolderNamesSet(toUploadPath)
    : new Map<string, string>()
  const deleteFoldersMap = toDeletePath && fs.existsSync(toDeletePath)
    ? getFolderNamesSet(toDeletePath)
    : new Map<string, string>()

  const parsedRoot = path.parse(actualWorkingPath).root
  const workingDrive = driveLetterMatch ? driveLetterMatch[1].toUpperCase() + '\\' : (driveRootOverride || parsedRoot)
  const workingDriveLabel = resolveDriveLabel(workingDrive)

  let safarDirs: string[] = []
  let rootEntries: fs.Dirent[] = []
  try {
    rootEntries = fs.readdirSync(actualWorkingPath, { withFileTypes: true })
  } catch {
    return { safars: [], tasks: [], resources: [] }
  }

  const hasSubFinal = rootEntries.some(
    e => e.isDirectory() && (e.name.toLowerCase() === 'final' || e.name.toLowerCase() === 'final titles')
  )
  const hasSubDateFolders = rootEntries.some(e => e.isDirectory() && isDateFolder(e.name))
  const workingFolderIsSafar = isSafarFolder(path.basename(actualWorkingPath))

  if (workingFolderIsSafar && (hasSubFinal || hasSubDateFolders)) {
    safarDirs = [actualWorkingPath]
  } else {
    const collectDeepSafars = (dir: string, depth = 0): string[] => {
      if (depth > 4) return []
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        const hasFinal = entries.some(e => e.isDirectory() && (e.name.toLowerCase() === 'final' || e.name.toLowerCase() === 'final titles'))
        const hasDates = entries.some(e => e.isDirectory() && isDateFolder(e.name))
        const hasPrproj = entries.some(e => e.isFile() && e.name.toLowerCase().endsWith('.prproj'))
        if (depth > 0 && isSafarFolder(path.basename(dir), dir)) {
          return [dir]
        }
        const found: string[] = []
        for (const ent of entries) {
          if (!ent.isDirectory() || isSystemIgnored(ent.name)) continue
          const folderKey = ent.name.toUpperCase().replace(/[\s_-]+/g, ' ').trim()
          const isClientContainer = ['CLIENT', 'CLIENTS', 'IN PROCESS', 'TO UPLOAD', 'TO DELETE', 'UPLOADED DATA', 'PENDING', 'SAFARS', 'SAFAR', 'WORKING SAFAR', 'WORKING'].includes(folderKey)
          if (depth >= 2 && !isClientContainer && !isSafarFolder(ent.name, path.join(dir, ent.name))) continue
          found.push(...collectDeepSafars(path.join(dir, ent.name), depth + 1))
        }
        return found
      } catch {
        return []
      }
    }
    const discovered = collectDeepSafars(actualWorkingPath)
    if (discovered.length > 0) {
      safarDirs = discovered
    } else {
      safarDirs = rootEntries
        .filter(e => e.isDirectory() && !isSystemIgnored(e.name) && isSafarFolder(e.name, path.join(actualWorkingPath, e.name)))
        .map(e => path.join(actualWorkingPath, e.name))
      if (safarDirs.length === 0 && isSafarFolder(path.basename(actualWorkingPath)) && (hasSubFinal || hasSubDateFolders)) {
        safarDirs = [actualWorkingPath]
      }
    }
  }

  for (const safarPath of safarDirs) {
    const safarFolderName = path.basename(safarPath)
    const safarMeta = parseSafarMetadata(safarFolderName)

    let safarEntries: fs.Dirent[] = []
    try {
      safarEntries = fs.readdirSync(safarPath, { withFileTypes: true })
    } catch {
      continue
    }

    const finalDirEnt = safarEntries.find(
      e => e.isDirectory() && (e.name.toLowerCase() === 'final' || e.name.toLowerCase() === 'final titles')
    )
    const finalDirPath = finalDirEnt ? path.join(safarPath, finalDirEnt.name) : null

    const finalDateFoldersMap = new Map<string, string>()
    const dateFolderNames = new Map<string, string>()
    const dateGroups = new Map<string, { cleanDate: string; sourcePaths: string[] }>()
    const finalRendersByDate = new Map<string, { videoCount: number; totalSize: number; latestMtime: number; finalPaths: string[] }>()

    for (const entry of safarEntries) {
      if (!entry.isDirectory()) continue
      const lower = entry.name.toLowerCase()
      if (['final', 'final titles', 'titles', 'assets', 'raw', 'output', 'outputs', 'export', 'exports'].includes(lower)) continue
      let cleanDate = extractCleanDateFolder(entry.name)
      if (!cleanDate && entry.name.toLowerCase().startsWith(safarFolderName.toLowerCase())) {
        const remainder = entry.name.slice(safarFolderName.length).replace(/^[\s_-]+/, '').trim()
        if (remainder) cleanDate = extractCleanDateFolder(remainder) || remainder
      }
      if (!cleanDate && ['footage', 'dates', 'content', 'videos', 'media', 'raw footage', 'sessions'].includes(lower)) {
        try {
          const subEntries = fs.readdirSync(path.join(safarPath, entry.name), { withFileTypes: true })
          for (const sub of subEntries) {
            if (!sub.isDirectory() || isSystemIgnored(sub.name)) continue
            let subDate = extractCleanDateFolder(sub.name)
            if (!subDate && sub.name.toLowerCase().startsWith(safarFolderName.toLowerCase())) {
              const rem = sub.name.slice(safarFolderName.length).replace(/^[\s_-]+/, '').trim()
              if (rem) subDate = extractCleanDateFolder(rem) || rem
            }
            if (!subDate) subDate = sub.name
            const normKey = normalizeDateFolderKey(subDate)
            const checkKey = `${safarFolderName.toLowerCase()}::${normKey}`
            if (!excludedFolderKeys.has(checkKey)) {
              const group = dateGroups.get(subDate) || { cleanDate: subDate, sourcePaths: [] }
              group.sourcePaths.push(path.join(safarPath, entry.name, sub.name))
              dateGroups.set(subDate, group)
              dateFolderNames.set(normKey, subDate)
            }
          }
        } catch {}
        continue
      }
      if (!cleanDate && !isSystemIgnored(entry.name)) {
        cleanDate = entry.name
      }
      if (cleanDate) {
        const normKey = normalizeDateFolderKey(cleanDate)
        const checkKey = `${safarFolderName.toLowerCase()}::${normKey}`
        if (!excludedFolderKeys.has(checkKey)) {
          const group = dateGroups.get(cleanDate) || { cleanDate, sourcePaths: [] }
          group.sourcePaths.push(path.join(safarPath, entry.name))
          dateGroups.set(cleanDate, group)
          dateFolderNames.set(normKey, cleanDate)
        }
      }
    }

    if (finalDirPath && fs.existsSync(finalDirPath)) {
      try {
        const fSubs = fs.readdirSync(finalDirPath, { withFileTypes: true })
        for (const fsEnt of fSubs) {
          let cleanDate = extractCleanDateFolder(fsEnt.name)
          if (!cleanDate && fsEnt.name.toLowerCase().startsWith(safarFolderName.toLowerCase())) {
            const remainder = fsEnt.name.slice(safarFolderName.length).replace(/^[\s_-]+/, '').trim()
            if (remainder) cleanDate = extractCleanDateFolder(remainder) || remainder.replace(/\.[a-z\d]{2,6}$/i, '')
          }
          if (!cleanDate && !isSystemIgnored(fsEnt.name)) {
            cleanDate = fsEnt.name.replace(/\.[a-z\d]{2,6}$/i, '').trim()
          }
          if (!cleanDate) continue
          const normKey = normalizeDateFolderKey(cleanDate)
          const checkKey = `${safarFolderName.toLowerCase()}::${normKey}`
          if (excludedFolderKeys.has(checkKey)) continue

          const fullPath = path.join(finalDirPath, fsEnt.name)
          const record = finalRendersByDate.get(cleanDate) || { videoCount: 0, totalSize: 0, latestMtime: 0, finalPaths: [] }
          record.finalPaths.push(fullPath)

          if (fsEnt.isDirectory()) {
            finalDateFoldersMap.set(normKey, fullPath)
            const stats = scanFolderMedia(fullPath)
            record.videoCount += stats.videoCount
            record.totalSize += stats.totalSize
            if (stats.mtime > record.latestMtime) record.latestMtime = stats.mtime
          } else if (fsEnt.isFile() && VIDEO_EXTS.has(path.extname(fsEnt.name).toLowerCase())) {
            record.videoCount += 1
            try {
              const st = fs.statSync(fullPath)
              record.totalSize += st.size
              if (st.mtimeMs > record.latestMtime) record.latestMtime = st.mtimeMs
            } catch {}
          }
          finalRendersByDate.set(cleanDate, record)

          if (!dateGroups.has(cleanDate)) {
            dateGroups.set(cleanDate, { cleanDate, sourcePaths: [fullPath] })
            dateFolderNames.set(normKey, cleanDate)
          }
        }
      } catch {}
    }

    /* legacy scan replaced by dateGroups */ if (false as boolean) {
    if (finalDirPath && fs.existsSync(finalDirPath)) {
      try {
        const fSubs = fs.readdirSync(finalDirPath, { withFileTypes: true })
        for (const fsEnt of fSubs) {
          if (fsEnt.isDirectory() && isDateFolder(fsEnt.name)) {
            finalDateFoldersMap.set(normalizeDateFolderKey(fsEnt.name), path.join(finalDirPath, fsEnt.name))
          }
        }
      } catch {}
    }

    const dateFolderNames = new Map<string, string>()
    for (const entry of safarEntries) {
      if (!entry.isDirectory()) continue
      const lower = entry.name.toLowerCase()
      if (lower === 'final' || lower === 'final titles' || lower === 'titles' || lower === 'assets' || lower === 'raw') continue
      if (isDateFolder(entry.name)) {
        const normKey = normalizeDateFolderKey(entry.name)
        const checkKey = `${safarFolderName.toLowerCase()}::${normKey}`
        if (!excludedFolderKeys.has(checkKey)) {
          dateFolderNames.set(normKey, entry.name)
        }
      }
    }
    for (const finalPath of finalDateFoldersMap.values()) {
      const name = path.basename(finalPath)
      const normKey = normalizeDateFolderKey(name)
      const checkKey = `${safarFolderName.toLowerCase()}::${normKey}`
      if (!excludedFolderKeys.has(checkKey) && !dateFolderNames.has(normKey)) {
        if (true) { dateFolderNames.set(normKey, name) /* balanced */
      }
    }
      }
    }

    const hasDirectPrproj = safarEntries.some(e => e.isFile() && e.name.toLowerCase().endsWith('.prproj'))
    const hasDirectVideo = safarEntries.some(e => e.isFile() && VIDEO_EXTS.has(path.extname(e.name).toLowerCase()))

    // If this folder has neither date folders nor a Final folder nor direct project/media, it is not a Safar directory
    if (dateFolderNames.size === 0 && !finalDirPath && !hasDirectPrproj && !hasDirectVideo) {
      continue
    }

    // Catalog only verified Safar roots, after confirming their production layout.
    resourcesToUpsert.push({
      safarName: safarFolderName,
      fileName: safarFolderName,
      filePath: safarPath,
      parentDir: path.dirname(safarPath),
      fileType: 'folder',
      category: 'folder',
      driveRoot: workingDrive,
      driveLabel: workingDriveLabel,
      fileSize: 0,
      mtime: Date.now()
    })

    const safarTasks: TaskRecord[] = []

    if (dateFolderNames.size === 0) {
      // Direct root Safar project/media
      const prInfo = checkAdobeProject(safarPath)
      let status: TaskRecord['status'] = 'editing_pending'
      if (finalDirPath) {
        status = 'upload_pending'
      } else if (prInfo.hasPrproj) {
        const EDITING_THRESHOLD_MS = 48 * 60 * 60 * 1000
        const prAge = prInfo.modifiedAt ? Date.now() - prInfo.modifiedAt : Infinity
        status = prAge < EDITING_THRESHOLD_MS ? 'editing' : 'review'
      }
      const directTask: TaskRecord = {
        safarName: safarFolderName,
        dateFolder: 'Day 1',
        status,
        prprojModifiedAt: prInfo.modifiedAt,
        prprojPath: prInfo.prprojPath,
        workingPath: safarPath,
        finalPath: finalDirPath || undefined,
        currentDrive: workingDrive,
        isAvailable: true,
        isDriveConnected: true,
        metadata: {
          hasPrproj: prInfo.hasPrproj,
          hasAutoSave: prInfo.hasAutoSave,
          isRendered: Boolean(finalDirPath),
          driveLabel: workingDriveLabel
        }
      }
      safarTasks.push(directTask)
      tasksToUpsert.push(directTask)
    }

    for (const dateFolderName of dateFolderNames.values()) {
      const dateKey = normalizeDateFolderKey(dateFolderName)
      const matchedFinalPath = finalDateFoldersMap.get(dateKey) || null
      const group = dateGroups.get(dateFolderName)
      const existingSourcePath = group?.sourcePaths?.find(p => fs.existsSync(p)) || null
      const sourceDateFolderPath = existingSourcePath || path.join(safarPath, dateFolderName)
      const dateFolderPath = fs.existsSync(sourceDateFolderPath) ? sourceDateFolderPath : matchedFinalPath || sourceDateFolderPath

      // Catalog date folder itself
      resourcesToUpsert.push({
        safarName: safarFolderName,
        dateFolder: dateFolderName,
        fileName: dateFolderName,
        filePath: dateFolderPath,
        parentDir: safarPath,
        fileType: 'folder',
        category: 'folder',
        driveRoot: workingDrive,
        driveLabel: workingDriveLabel,
        fileSize: 0,
        mtime: Date.now()
      })

      const renderRecord = finalRendersByDate.get(dateFolderName)
      const isRenderedInFinal = Boolean(matchedFinalPath || (renderRecord && (renderRecord.videoCount > 0 || renderRecord.finalPaths.length > 0)))

      let renderVideoCount = renderRecord?.videoCount || 0
      let renderSizeBytes = renderRecord?.totalSize || 0
      let renderedAtTime: number | undefined = renderRecord?.latestMtime && renderRecord.latestMtime > 0 ? renderRecord.latestMtime : undefined
      let _unusedZero = 0; if (false as boolean) renderVideoCount = _unusedZero
      if (!renderSizeBytes) renderSizeBytes = 0
      if (!renderedAtTime) renderedAtTime = undefined

      // Catalog Final outputs
      if (matchedFinalPath && fs.existsSync(matchedFinalPath)) {
        const stats = scanFolderMedia(matchedFinalPath)
        renderVideoCount = stats.videoCount
        renderSizeBytes = stats.totalSize
        if (stats.mtime > 0) renderedAtTime = stats.mtime

        try {
          const finalFiles = fs.readdirSync(matchedFinalPath, { withFileTypes: true })
          for (const ff of finalFiles) {
            if (ff.isFile()) {
              const ext = path.extname(ff.name).toLowerCase()
              const fullFPath = path.join(matchedFinalPath, ff.name)
              let fSize = 0
              let fMtime = 0
              try {
                const fStat = fs.statSync(fullFPath)
                fSize = fStat.size
                fMtime = fStat.mtimeMs
              } catch {}

              if (VIDEO_EXTS.has(ext)) {
                resourcesToUpsert.push({
                  safarName: safarFolderName,
                  dateFolder: dateFolderName,
                  fileName: ff.name,
                  filePath: fullFPath,
                  parentDir: matchedFinalPath,
                  fileType: 'video',
                  category: 'final_render',
                  driveRoot: workingDrive,
                  driveLabel: workingDriveLabel,
                  fileSize: fSize,
                  mtime: fMtime
                })
              } else if (AUDIO_EXTS.has(ext)) {
                resourcesToUpsert.push({
                  safarName: safarFolderName,
                  dateFolder: dateFolderName,
                  fileName: ff.name,
                  filePath: fullFPath,
                  parentDir: matchedFinalPath,
                  fileType: 'audio',
                  category: 'final_render',
                  driveRoot: workingDrive,
                  driveLabel: workingDriveLabel,
                  fileSize: fSize,
                  mtime: fMtime
                })
              }
            }
          }
        } catch {}
      }

      let prInfo = checkAdobeProject(dateFolderPath)
      if (!prInfo.hasPrproj && group?.sourcePaths) {
        for (const sp of group.sourcePaths) {
          if (fs.existsSync(sp) && sp !== dateFolderPath) {
            const altPr = checkAdobeProject(sp)
            if (altPr.hasPrproj) {
              prInfo = altPr
              break
            }
          }
        }
      }
      if (prInfo.hasPrproj && prInfo.prprojPath) {
        resourcesToUpsert.push({
          safarName: safarFolderName,
          dateFolder: dateFolderName,
          fileName: path.basename(prInfo.prprojPath),
          filePath: prInfo.prprojPath,
          parentDir: dateFolderPath,
          fileType: 'project',
          category: 'working_project',
          driveRoot: workingDrive,
          driveLabel: workingDriveLabel,
          fileSize: (fs.existsSync(prInfo.prprojPath) ? fs.statSync(prInfo.prprojPath).size : 0),
          mtime: prInfo.modifiedAt || Date.now()
        })
      }

      // Secondary check: look for rendered video outputs inside date folder subdirectories (Final, Output) or root
      if (renderVideoCount === 0 && fs.existsSync(dateFolderPath)) {
        try {
          const subs = fs.readdirSync(dateFolderPath, { withFileTypes: true })
          const candDir = subs.find(s => s.isDirectory() && ['final', 'final titles', 'output', 'outputs', 'exports'].includes(s.name.toLowerCase()))
          if (candDir) {
            const candPath = path.join(dateFolderPath, candDir.name)
            const stats = scanFolderMedia(candPath)
            renderVideoCount = stats.videoCount
            renderSizeBytes = stats.totalSize
            if (stats.mtime > 0) renderedAtTime = stats.mtime
          } else {
            for (const ent of subs) {
              if (ent.isFile() && VIDEO_EXTS.has(path.extname(ent.name).toLowerCase())) {
                renderVideoCount++
                try {
                  const st = fs.statSync(path.join(dateFolderPath, ent.name))
                  renderSizeBytes += st.size
                  if (st.mtimeMs > (renderedAtTime || 0)) renderedAtTime = st.mtimeMs
                } catch {}
              }
            }
          }
        } catch {}
      }

      const safarDateKey = `${safarFolderName.toLowerCase()}::${dateKey}`
      const uploadMatchPath = uploadFoldersMap.get(safarDateKey) || (toUploadPath && path.basename(toUploadPath).toLowerCase() === safarFolderName.toLowerCase() ? uploadFoldersMap.get(dateKey) : null) || null
      const deleteMatchPath = deleteFoldersMap.get(safarDateKey) || (toDeletePath && path.basename(toDeletePath).toLowerCase() === safarFolderName.toLowerCase() ? deleteFoldersMap.get(dateKey) : null) || null

      let status: TaskStatus = 'editing_pending'

      if (deleteMatchPath) {
        // Date folder found in "To Delete" → fully submitted to AlJamea
        status = 'submitted'
      } else if (uploadMatchPath) {
        // Date folder found in "To Upload" → uploaded / ready for AlJamea
        status = 'uploaded'
      } else if (isRenderedInFinal || renderVideoCount > 0) {
        // Render exists in Final subfolder, but not yet in To Upload
        status = 'upload_pending'
      } else if (prInfo.hasPrproj) {
        // Determine editing vs review by project file recency:
        //   Modified within last 48 hours → actively being edited
        //   Older / no timestamp → done editing, needs review
        const EDITING_THRESHOLD_MS = 48 * 60 * 60 * 1000 // 48 hours
        const now = Date.now()
        const prAge = prInfo.modifiedAt ? now - prInfo.modifiedAt : Infinity
        status = prAge < EDITING_THRESHOLD_MS ? 'editing' : 'review'
      } else {
        // No prproj found — not started yet
        status = 'editing_pending'
      }

      const task: TaskRecord = {
        safarName: safarFolderName,
        dateFolder: dateFolderName,
        status,
        prprojModifiedAt: prInfo.modifiedAt,
        prprojPath: prInfo.prprojPath,
        renderedAt: renderedAtTime,
        renderVideoCount,
        renderSizeBytes,
        workingPath: dateFolderPath,
        finalPath: matchedFinalPath || undefined,
        uploadPath: uploadMatchPath || undefined,
        deletePath: deleteMatchPath || undefined,
        currentDrive: workingDrive,
        isAvailable: true,
        isDriveConnected: true,
        metadata: {
          hasPrproj: prInfo.hasPrproj,
          hasAutoSave: prInfo.hasAutoSave,
          isRendered: isRenderedInFinal,
          driveLabel: workingDriveLabel
        }
      }

      safarTasks.push(task)
      tasksToUpsert.push(task)
    }

    const totalDays = safarTasks.length
    // "Completed" = uploaded or submitted (rendered to Final alone is NOT done)
    const completedDays = safarTasks.filter(
      t => t.status === 'uploaded' || t.status === 'submitted'
    ).length
    // Safar is 100% done only when every date folder is uploaded or submitted
    const isSafarDone = totalDays > 0 && safarTasks.every(t => t.status === 'uploaded' || t.status === 'submitted')

    const safarItem: SafarRecord = {
      safarName: safarFolderName,
      safarYear: safarMeta.year,
      safarSerial: safarMeta.serial,
      city: safarMeta.city,
      totalDays,
      completedDays,
      isSafarDone,
      currentPath: safarPath,
      currentDrive: workingDrive,
      tasks: safarTasks
    }

    safarsToUpsert.push(safarItem)
  }

  // Recursively index all media files and date folders in toUploadPath and toDeletePath
  function indexDestinationFolder(
    targetDir: string,
    category: 'to_upload' | 'to_delete',
    taskStatus: 'uploaded' | 'submitted'
  ) {
    if (!targetDir || !fs.existsSync(targetDir)) return

    function walk(currentDir: string, currentSafarHint = '', currentDateHint = '', depth = 0) {
      if (depth > 6) return
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true })
        for (const ent of entries) {
          if (ent.name.startsWith('.') || ent.name.startsWith('._') || ent.name.toLowerCase() === '$recycle.bin') continue
          const fullPath = path.join(currentDir, ent.name)

          if (ent.isDirectory()) {
            let nextSafar = currentSafarHint
            let nextDate = currentDateHint

            const fallbackSafar = currentSafarHint || (isContainerFolderName(path.basename(workingPath)) ? (safarsToUpsert.length === 1 ? safarsToUpsert[0].safarName : '') : path.basename(workingPath))
            if (isDateFolder(ent.name) && fallbackSafar) {
              nextDate = ent.name
              tasksToUpsert.push({
                safarName: fallbackSafar,
                dateFolder: ent.name,
                status: taskStatus,
                uploadPath: category === 'to_upload' ? fullPath : undefined,
                deletePath: category === 'to_delete' ? fullPath : undefined,
                currentDrive: workingDrive,
        isAvailable: true,
        isDriveConnected: true,
                metadata: { isRendered: true, driveLabel: workingDriveLabel }
              })
            } else if (isSafarFolder(ent.name)) {
              nextSafar = ent.name
            }

            resourcesToUpsert.push({
              safarName: nextSafar || path.basename(workingPath),
              dateFolder: nextDate || undefined,
              fileName: ent.name,
              filePath: fullPath,
              parentDir: currentDir,
              fileType: 'folder',
              category,
              driveRoot: workingDrive,
              driveLabel: workingDriveLabel,
              fileSize: 0,
              mtime: Date.now()
            })

            walk(fullPath, nextSafar, nextDate, depth + 1)
          } else if (ent.isFile()) {
            const ext = path.extname(ent.name).toLowerCase()
            if (VIDEO_EXTS.has(ext) || ext === '.zip' || ext === '.rar') {
              let fSize = 0
              let fMtime = 0
              try {
                const st = fs.statSync(fullPath)
                fSize = st.size
                fMtime = st.mtimeMs
              } catch {}

              resourcesToUpsert.push({
                safarName: fallbackSafar,
                dateFolder: currentDateHint || undefined,
                fileName: ent.name,
                filePath: fullPath,
                parentDir: currentDir,
                fileType: 'video',
                category,
                driveRoot: workingDrive,
                driveLabel: workingDriveLabel,
                fileSize: fSize,
                mtime: fMtime
              })
            }
          }
        }
      } catch {}
    }

    walk(targetDir)
  }

  if (toUploadPath) {
    indexDestinationFolder(toUploadPath, 'to_upload', 'uploaded')
  }
  if (toDeletePath) {
    indexDestinationFolder(toDeletePath, 'to_delete', 'submitted')
  }

  return { safars: safarsToUpsert, tasks: tasksToUpsert, resources: resourcesToUpsert }
}

export function indexDirectoryRecursively(
  rootDir: string,
  safarNameHint?: string,
  maxDepth = 5
): MediaResourceRecord[] {
  const results: MediaResourceRecord[] = []
  if (!rootDir || !fs.existsSync(rootDir)) return results

  const parsedRoot = path.parse(rootDir)
  const driveRoot = parsedRoot.root || rootDir.slice(0, 3)
  const driveLabel = resolveDriveLabel(driveRoot)

  function walk(currentDir: string, currentSafar: string, currentDate: string, depth: number) {
    if (depth > maxDepth) return
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const ent of entries) {
      if (ent.name.startsWith('.') || ent.name.toLowerCase() === '$recycle.bin') continue
      const fullPath = path.join(currentDir, ent.name)

      if (ent.isDirectory()) {
        const lower = ent.name.toLowerCase().trim()
        let nextSafar = currentSafar
        let nextDate = currentDate

        if (!nextSafar && (ent.name.includes('Safar') || /^\d{4}[\s\-_]/.test(ent.name))) {
          nextSafar = ent.name
        } else if (nextSafar && !nextDate && isDateFolder(ent.name)) {
          nextDate = ent.name
        }

        const isFinal = lower === 'final' || lower === 'final titles'
        results.push({
          safarName: nextSafar || path.basename(rootDir),
          dateFolder: nextDate || (isFinal ? 'Final' : undefined),
          fileName: ent.name,
          filePath: fullPath,
          parentDir: currentDir,
          fileType: 'folder',
          category: 'folder',
          driveRoot,
          driveLabel,
          fileSize: 0,
          mtime: Date.now()
        })

        walk(fullPath, nextSafar, nextDate, depth + 1)
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase()
        let fileType: 'video' | 'project' | 'audio' | 'image' | 'other' | null = null
        let category: 'final_render' | 'working_project' | 'raw_footage' | 'to_upload' | 'to_delete' = 'raw_footage'

        if (VIDEO_EXTS.has(ext)) {
          fileType = 'video'
        } else if (PROJECT_EXTS.has(ext)) {
          fileType = 'project'
          category = 'working_project'
        } else if (AUDIO_EXTS.has(ext)) {
          fileType = 'audio'
        } else if (IMAGE_EXTS.has(ext)) {
          fileType = 'image'
        }

        if (fileType) {
          const lowerDir = currentDir.toLowerCase()
          if (lowerDir.includes('to delete') || lowerDir.includes('delete')) {
            category = 'to_delete'
          } else if (lowerDir.includes('upload') || lowerDir.includes('to upload') || lowerDir.includes('uploaded data')) {
            category = 'to_upload'
          } else if (lowerDir.includes('final')) {
            category = 'final_render'
          }

          let size = 0
          let mtime = 0
          try {
            const st = fs.statSync(fullPath)
            size = st.size
            mtime = st.mtimeMs
          } catch {}

          results.push({
            safarName: currentSafar || path.basename(rootDir),
            dateFolder: currentDate || undefined,
            fileName: ent.name,
            filePath: fullPath,
            parentDir: currentDir,
            fileType,
            category,
            driveRoot,
            driveLabel,
            fileSize: size,
            mtime
          })
        }
      }
    }
  }

  walk(rootDir, safarNameHint || '', '', 0)
  return results
}

// ── Search Ghost Vault & Enrich with Real-time Drive Status ──

export function searchAssets(filter: {
  query?: string
  fileType?: string
  category?: string
  driveRoot?: string
  limit?: number
}): MediaResourceRecord[] {
  const args = ['--search-resources']
  if (filter.query) args.push('--query', filter.query)
  if (filter.fileType && filter.fileType !== 'all') args.push('--file-type', filter.fileType)
  if (filter.category && filter.category !== 'all') args.push('--category', filter.category)
  if (filter.driveRoot && filter.driveRoot !== 'all') args.push('--drive-root', filter.driveRoot)
  if (filter.limit) args.push('--limit', String(filter.limit))

  const pyRes = runTrackerDb(args)
  const items: MediaResourceRecord[] = pyRes?.results || []
  const driveLabels = getDriveVolumeLabels()

  return items.map(item => {
    let isAvailable = false
    let isDriveConnected = false
    try {
      const root = path.parse(item.filePath).root
      isDriveConnected = fs.existsSync(root)
      if (isDriveConnected) {
        isAvailable = fs.existsSync(item.filePath)
      }
    } catch {}

    const resolvedLabel = item.driveLabel || driveLabels.get(item.driveRoot) || `Drive ${item.driveRoot}`

    return {
      ...item,
      driveLabel: resolvedLabel,
      isAvailable,
      isDriveConnected
    }
  })
}

// ── Core Scanner & Status Computation Engine ──────────────────

function enrichTrackerData(dbSafars: SafarRecord[], dbTasks: TaskRecord[]): { safars: SafarRecord[]; tasks: TaskRecord[] } {
  const enrichedTasks = dbTasks.map(t => {
    let isDriveConnected = false
    let isAvailable = false
    try {
      const root = t.currentDrive ? (t.currentDrive.endsWith('\\') || t.currentDrive.endsWith('/') ? t.currentDrive : t.currentDrive + '\\') : ''
      if (root) {
        isDriveConnected = fs.existsSync(root)
      }
      if (isDriveConnected && t.workingPath) {
        isAvailable = fs.existsSync(t.workingPath)
      }
    } catch {}
    return {
      ...t,
      isDriveConnected,
      isAvailable
    }
  })

  const tasksBySafar = new Map<string, TaskRecord[]>()
  for (const task of enrichedTasks) {
    const group = tasksBySafar.get(task.safarName) || []
    group.push(task)
    tasksBySafar.set(task.safarName, group)
  }

  const groupedSafars = dbSafars.map(s => {
    const matchedTasks = tasksBySafar.get(s.safarName) || []
    const completedDays = matchedTasks.filter(t => t.status === 'uploaded' || t.status === 'submitted').length
    const isSafarDone = matchedTasks.length > 0 && matchedTasks.every(t => t.status === 'uploaded' || t.status === 'submitted')
    let isDriveConnected = false
    let isPathExists = false
    try {
      const root = s.currentDrive ? (s.currentDrive.endsWith('\\') || s.currentDrive.endsWith('/') ? s.currentDrive : s.currentDrive + '\\') : ''
      if (root) {
        isDriveConnected = fs.existsSync(root)
      }
      if (isDriveConnected && s.currentPath) {
        isPathExists = fs.existsSync(s.currentPath)
      }
    } catch {}

    const isManualDone = Boolean(s.manualStatus)
    const effectiveCompleted = isManualDone
      ? (matchedTasks.length || s.totalDays || s.completedDays || 0)
      : Math.max(completedDays, s.completedDays || 0)

    return {
      ...s,
      totalDays: matchedTasks.length || s.totalDays,
      completedDays: effectiveCompleted,
      isSafarDone: isSafarDone || isManualDone || (s.completedDays >= s.totalDays && s.totalDays > 0),
      isDriveConnected,
      isPathExists,
      isAvailable: isPathExists,
      tasks: matchedTasks
    }
  })

  return { safars: groupedSafars, tasks: enrichedTasks }
}

type TrackerScanResult = { safars: SafarRecord[]; tasks: TaskRecord[]; websiteSafars?: SafarRecord[]; websiteTasks?: TaskRecord[]; websiteScanComplete?: boolean }
let cachedScanResult: TrackerScanResult | null = null
let lastScanTimestamp = 0
let isScanRunning = false
let lastScanInput: any = null

export function deduplicateTasks(tasks: TaskRecord[]): TaskRecord[] {
  const map = new Map<string, TaskRecord>()
  for (const t of tasks) {
    if (!t.safarName || isContainerFolderName(t.safarName) || isSystemIgnored(t.safarName)) continue
    const key = `${(t.safarName || '').trim().toLowerCase()}::${normalizeDateFolderKey(t.dateFolder)}`
    if (!map.has(key)) {
      map.set(key, t)
    } else {
      const existing = map.get(key)!
      map.set(key, {
        ...existing,
        ...t,
        renderVideoCount: Math.max(existing.renderVideoCount || 0, t.renderVideoCount || 0),
        renderSizeBytes: Math.max(existing.renderSizeBytes || 0, t.renderSizeBytes || 0),
        finalPath: t.finalPath || existing.finalPath,
        uploadPath: t.uploadPath || existing.uploadPath,
        status: t.status !== 'editing_pending' ? t.status : existing.status
      })
    }
  }
  return Array.from(map.values())
}

export function deduplicateSafars(safars: SafarRecord[]): SafarRecord[] {
  const map = new Map<string, SafarRecord>()
  for (const s of safars) {
    if (!s.safarName || isContainerFolderName(s.safarName) || isSystemIgnored(s.safarName)) continue
    const key = (s.safarName || '').trim().toLowerCase()
    if (!map.has(key)) {
      map.set(key, s)
    } else {
      const existing = map.get(key)!
      map.set(key, {
        ...existing,
        ...s,
        totalDays: Math.max(existing.totalDays || 0, s.totalDays || 0),
        completedDays: Math.max(existing.completedDays || 0, s.completedDays || 0)
      })
    }
  }
  return Array.from(map.values())
}

export async function scanTrackerDataAsync(input: {
  workingPath?: string
  toUploadPath?: string
  toDeletePath?: string
  pendingPath?: string
  workspaces?: DriveWorkspaceConfig[]
  force?: boolean
} | DriveWorkspaceConfig[]): Promise<TrackerScanResult> {
  const isForce = !Array.isArray(input) && Boolean((input as any)?.force)

  // Fast-path: return cached result if scanned within the last 6 seconds
  if (!isForce && cachedScanResult && Date.now() - lastScanTimestamp < 6000) {
    return cachedScanResult
  }

  // If a scan is already running on the disk, return cached or db state without blocking
  if (isScanRunning) {
    if (cachedScanResult) return cachedScanResult
    const py = await runTrackerDbAsync(['--get-all'])
    return py?.data ? enrichTrackerData(py.data.safars || [], py.data.tasks || []) : { safars: [], tasks: [] }
  }

  lastScanInput = Array.isArray(input) ? { workspaces: input } : (input || {})
  isScanRunning = true
  updateOnlineDrives()

  try {
    let allSafarsToUpsert: SafarRecord[] = []
    let allTasksToUpsert: TaskRecord[] = []
    let allResourcesToUpsert: MediaResourceRecord[] = []

    let workspaceList: DriveWorkspaceConfig[] = []
    if (Array.isArray(input)) {
      workspaceList = input.filter(w => w.enabled)
    } else if (input?.workspaces && Array.isArray(input.workspaces)) {
      workspaceList = input.workspaces.filter(w => w.enabled)
    }

    if (workspaceList.length === 0 && (!input || !('workingPath' in input) || !input.workingPath)) {
      updateOnlineDrives()
      for (const drvLetter of verifiedOnlineDrives) {
        const root = drvLetter.endsWith('\\') ? drvLetter : drvLetter + '\\'
        const auto = autoDetectDriveFolders(root)
        if (auto.inProcessExists || auto.toDeleteExists || auto.pendingExists || auto.safarCount > 0) {
          workspaceList.push({
            id: `auto_${drvLetter.slice(0, 1)}`,
            driveRoot: root,
            inProcessPath: auto.inProcessPath,
            toUploadPath: auto.toUploadPath,
            toDeletePath: auto.toDeletePath,
            pendingPath: auto.pendingPath,
            enabled: true
          })
        }
      }
    }

    const configuredDriveKeys = new Set(workspaceList.map(ws => normalizeDrive(ws.driveRoot || ws.inProcessPath)).filter(Boolean))
    let websiteScanComplete = false
    if (!workspaceList.length && !Array.isArray(input) && input?.workingPath) {
      const pathDrive = normalizeDrive(input.workingPath)
      if (pathDrive) configuredDriveKeys.add(pathDrive)
    }
    const offlineDriveKeys = new Set([...configuredDriveKeys].filter(root => /^[A-Z]:\\$/i.test(root) && !verifiedOnlineDrives.has(root.slice(0, 2).toUpperCase())))

    if (workspaceList.length > 0) {
      websiteScanComplete = [...configuredDriveKeys].some(root => !/^[A-Z]:\\$/i.test(root) || verifiedOnlineDrives.has(root.slice(0, 2).toUpperCase()))
      for (const ws of workspaceList) {
        // Yield to event loop between workspaces to prevent any UI freezing
        await new Promise(r => setImmediate(r))

        const workingDir = ws.inProcessPath || ws.driveRoot || ''
        const driveLetter = (ws.driveRoot || workingDir).match(/^([A-Za-z]:)/)?.[1]?.toUpperCase()
        const isDriveOnline = driveLetter ? fs.existsSync(driveLetter + '\\') : (workingDir ? fs.existsSync(workingDir) : false)
        if (isDriveOnline && driveLetter) verifiedOnlineDrives.add(driveLetter)
        let resolvedWorkingDir = workingDir
        if ((!resolvedWorkingDir || !fs.existsSync(resolvedWorkingDir)) && ws.driveRoot && fs.existsSync(ws.driveRoot)) {
          try {
            const rEntries = fs.readdirSync(ws.driveRoot)
            const cand = rEntries.find(d => ['in process', 'in_process', 'inprocess', 'safars', 'safar', 'working safar', 'working'].includes(d.toLowerCase()))
            if (cand) resolvedWorkingDir = path.join(ws.driveRoot, cand)
            else if (rEntries.some(d => isSafarFolder(d))) resolvedWorkingDir = ws.driveRoot
          } catch {}
        }
        if (resolvedWorkingDir && fs.existsSync(resolvedWorkingDir)) {
          if (driveLetter) verifiedOnlineDrives.add(driveLetter)
        } else if (driveLetter && !verifiedOnlineDrives.has(driveLetter)) {
          continue // Skip offline drive instantly without touching disk
        }

        const scannedDirs = new Set<string>()
        if (resolvedWorkingDir && fs.existsSync(resolvedWorkingDir)) {
          scannedDirs.add(workingDir.toLowerCase())
          const res = scanSingleWorkspace(resolvedWorkingDir, ws.toUploadPath, ws.toDeletePath, ws.driveRoot, ws.pendingPath)
          allSafarsToUpsert.push(...res.safars)
          allTasksToUpsert.push(...res.tasks)
          allResourcesToUpsert.push(...res.resources)
        }

        const pendingDir = ws.pendingPath || (ws.driveRoot ? path.join(ws.driveRoot, 'Pending') : null)
        if (pendingDir && fs.existsSync(pendingDir) && !scannedDirs.has(pendingDir.toLowerCase())) {
          scannedDirs.add(pendingDir.toLowerCase())
          const resPending = scanSingleWorkspace(pendingDir, ws.toUploadPath, ws.toDeletePath, ws.driveRoot, ws.pendingPath)
          for (const s of resPending.safars.filter(s => !isContainerFolderName(s.safarName))) {
            s.currentFolder = 'pending'
          }
          allSafarsToUpsert.push(...resPending.safars)
          allTasksToUpsert.push(...resPending.tasks.filter(t => !isContainerFolderName(t.safarName)))
          allResourcesToUpsert.push(...resPending.resources)
        }

        const deleteDir = ws.toDeletePath || (ws.driveRoot ? path.join(ws.driveRoot, 'To Delete') : null)
        if (deleteDir && fs.existsSync(deleteDir) && !scannedDirs.has(deleteDir.toLowerCase())) {
          scannedDirs.add(deleteDir.toLowerCase())
          const resDelete = scanSingleWorkspace(deleteDir, ws.toUploadPath, ws.toDeletePath, ws.driveRoot, ws.pendingPath)
          for (const s of resDelete.safars.filter(s => !isContainerFolderName(s.safarName))) {
            s.currentFolder = 'to_delete'
            s.isSafarDone = true
            s.isArchived = true
          }
          for (const t of resDelete.tasks.filter(t => !isContainerFolderName(t.safarName))) {
            t.status = 'submitted'
          }
          allSafarsToUpsert.push(...resDelete.safars)
          allTasksToUpsert.push(...resDelete.tasks)
          allResourcesToUpsert.push(...resDelete.resources)
        }
        if (false as boolean) { /* legacy */
          const res = scanSingleWorkspace(resolvedWorkingDir, ws.toUploadPath, ws.toDeletePath, ws.driveRoot, ws.pendingPath)
          allSafarsToUpsert.push(...res.safars)
          allTasksToUpsert.push(...res.tasks)
          allResourcesToUpsert.push(...res.resources)
        }
      }
    } else if (!Array.isArray(input) && input?.workingPath) {
      const workingDir = input.workingPath
      const driveLetter = workingDir.match(/^([A-Za-z]:)/)?.[1]?.toUpperCase()
      websiteScanComplete = !driveLetter || verifiedOnlineDrives.has(driveLetter)
      if (!driveLetter || verifiedOnlineDrives.has(driveLetter)) {
        const res = scanSingleWorkspace(input.workingPath, input.toUploadPath, input.toDeletePath)
        allSafarsToUpsert = res.safars
        allTasksToUpsert = res.tasks
        allResourcesToUpsert = res.resources

        if (input.toDeletePath && fs.existsSync(input.toDeletePath) && input.toDeletePath.toLowerCase() !== input.workingPath.toLowerCase()) {
          const resDelete = scanSingleWorkspace(input.toDeletePath, input.toUploadPath, input.toDeletePath)
          for (const s of resDelete.safars.filter(s => !isContainerFolderName(s.safarName))) {
            s.currentFolder = 'to_delete'
            s.isSafarDone = true
            s.isArchived = true
          }
          for (const t of resDelete.tasks.filter(t => !isContainerFolderName(t.safarName))) {
            t.status = 'submitted'
          }
          allSafarsToUpsert.push(...resDelete.safars)
          allTasksToUpsert.push(...resDelete.tasks)
          allResourcesToUpsert.push(...resDelete.resources)
        }
      }
    }

    // Persist tasks, safars, and ghost media resources to SQLite tracker.db asynchronously
    if (allTasksToUpsert.length > 0 || allSafarsToUpsert.length > 0 || allResourcesToUpsert.length > 0) {
      try {
        await runTrackerDbAsync(['--upsert-batch'], JSON.stringify({
          tasks: allTasksToUpsert,
          safars: allSafarsToUpsert,
          resources: allResourcesToUpsert
        }))
      } catch (err) {
        console.warn('[taskTracker] Upsert-batch error:', err)
      }
    }

    // Return full consolidated state from tracker.db so all drives remain visible and preserved
    const pyRes = await runTrackerDbAsync(['--get-all'])
    const storedSafars: SafarRecord[] = pyRes?.data?.safars || []
    const storedTasks: TaskRecord[] = pyRes?.data?.tasks || []
    const verifiedSafarNames = new Set(allSafarsToUpsert.map(safar => safar.safarName))
    const retainedOfflineSafars = storedSafars.filter(safar => {
      const driveKey = normalizeDrive(safar.currentDrive || safar.currentPath || '')
      return offlineDriveKeys.has(driveKey) && !verifiedSafarNames.has(safar.safarName)
    })
    const retainedOfflineNames = new Set(retainedOfflineSafars.map(safar => safar.safarName))
    allSafarsToUpsert = deduplicateSafars(allSafarsToUpsert)
    allTasksToUpsert = deduplicateTasks(allTasksToUpsert)
    const presentTaskKeys = new Set(allTasksToUpsert.map(t => `${t.safarName.toLowerCase()}::${normalizeDateFolderKey(t.dateFolder)}`))

    const websiteSafars = deduplicateSafars([...allSafarsToUpsert, ...retainedOfflineSafars])
    const websiteTasks = deduplicateTasks([
      ...allTasksToUpsert,
      ...storedTasks.filter(task => retainedOfflineNames.has(task.safarName) || task.status === 'submitted')
    ])
    void [
    ]
    if (pyRes && pyRes.success && pyRes.data && Array.isArray(pyRes.data.safars) && pyRes.data.safars.length > 0) {
      const verifiedSet = new Set(allSafarsToUpsert.map(safar => safar.safarName))
      const allowedSafars = pyRes.data.safars.filter((safar: SafarRecord) => {
        const driveKey = normalizeDrive(safar.currentDrive || safar.currentPath || '')
        return verifiedSet.has(safar.safarName) || offlineDriveKeys.has(driveKey) || !configuredDriveKeys.has(driveKey)
      })
      const allowedNames = new Set(allowedSafars.map((safar: SafarRecord) => safar.safarName))
      cachedScanResult = {
        ...enrichTrackerData(
          deduplicateSafars(allowedSafars),
          deduplicateTasks(
            (pyRes.data.tasks || []).filter((task: TaskRecord) =>
              allowedNames.has(task.safarName) &&
              (presentTaskKeys.has(`${task.safarName.toLowerCase()}::${normalizeDateFolderKey(task.dateFolder)}`) || task.status === 'submitted')
            )
          )
        ),
        websiteSafars,
        websiteTasks,
        websiteScanComplete
      }
    } else if (allSafarsToUpsert.length > 0) {
      cachedScanResult = { ...enrichTrackerData(allSafarsToUpsert, allTasksToUpsert), websiteSafars, websiteTasks, websiteScanComplete }
    } else if (pyRes?.data?.safars) {
      cachedScanResult = { ...enrichTrackerData(retainedOfflineSafars, storedTasks.filter(task => retainedOfflineNames.has(task.safarName))), websiteSafars, websiteTasks, websiteScanComplete }
    } else {
      cachedScanResult = { safars: [], tasks: [], websiteSafars, websiteTasks, websiteScanComplete }
    }
    lastScanTimestamp = Date.now()
    exportProductionSummary(cachedScanResult)
    return cachedScanResult
  } finally {
    isScanRunning = false
  }
}

// ── Exported Production Summary for Anything & External Hubs ──

export function exportProductionSummary(data: { safars: SafarRecord[]; tasks: TaskRecord[] }): any {
  try {
    const safars = data.safars || []
    const tasks = data.tasks || []

    const activeSafar = safars.find(s => !s.isSafarDone) || safars[0] || null

    let pendingCount = 0
    let inProgressCount = 0
    let reviewCount = 0
    let uploadPendingCount = 0
    let uploadedCount = 0
    let submittedCount = 0

    for (const t of tasks) {
    if (!t.safarName || isContainerFolderName(t.safarName) || isSystemIgnored(t.safarName)) continue
      if (t.status === 'editing_pending') pendingCount++
      else if (t.status === 'in_progress') inProgressCount++
      else if (t.status === 'review') reviewCount++
      else if (t.status === 'upload_pending') uploadPendingCount++
      else if (t.status === 'uploaded') uploadedCount++
      else if (t.status === 'submitted') submittedCount++
    }

    const payload = {
      updatedAt: Date.now(),
      activeSafar: activeSafar ? activeSafar.safarName : null,
      city: activeSafar?.city || 'Unassigned',
      totalDays: activeSafar?.totalDays || 0,
      completedDays: activeSafar?.completedDays || 0,
      percent: activeSafar && activeSafar.totalDays > 0
        ? Math.round((activeSafar.completedDays / activeSafar.totalDays) * 100)
        : 0,
      isSafarDone: activeSafar?.isSafarDone || false,
      currentPath: activeSafar?.currentPath || null,
      currentDrive: activeSafar?.currentDrive || null,
      totalSafars: safars.length,
      counts: {
        editingPending: pendingCount,
        inProgress: inProgressCount,
        review: reviewCount,
        uploadPending: uploadPendingCount,
        uploaded: uploadedCount,
        submitted: submittedCount,
        totalTasks: tasks.length
      },
      recentTasks: tasks.slice(0, 6).map(t => ({
        safarName: t.safarName,
        dateFolder: t.dateFolder,
        status: t.status,
        renderedAt: t.renderedAt,
        finalPath: t.finalPath,
        currentDrive: t.currentDrive
      }))
    }

    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    const primaryDir = path.join(appData, 'One Tap')
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true })
    }
    const primaryFile = path.join(primaryDir, 'production_summary.json')
    fs.writeFileSync(primaryFile, JSON.stringify(payload, null, 2), 'utf-8')

    // Also write to custom settings location if present
    const locFile = path.join(primaryDir, 'settings_location.ini')
    if (fs.existsSync(locFile)) {
      try {
        const customDir = fs.readFileSync(locFile, 'utf-8').trim()
        if (customDir && fs.existsSync(customDir) && customDir !== primaryDir) {
          fs.writeFileSync(path.join(customDir, 'production_summary.json'), JSON.stringify(payload, null, 2), 'utf-8')
        }
      } catch {}
    }

    return payload
  } catch (err) {
    console.warn('[taskTracker] exportProductionSummary error:', err)
    return null
  }
}

export function getProductionSummary(): any {
  try {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    const primaryFile = path.join(appData, 'One Tap', 'production_summary.json')
    if (fs.existsSync(primaryFile)) {
      return JSON.parse(fs.readFileSync(primaryFile, 'utf-8'))
    }
    // Check custom settings location if primary does not exist yet
    const locFile = path.join(appData, 'One Tap', 'settings_location.ini')
    if (fs.existsSync(locFile)) {
      const customDir = fs.readFileSync(locFile, 'utf-8').trim()
      const customFile = path.join(customDir, 'production_summary.json')
      if (fs.existsSync(customFile)) {
        return JSON.parse(fs.readFileSync(customFile, 'utf-8'))
      }
    }
  } catch {}
  return null
}

export function scanTrackerData(input: any): { safars: SafarRecord[]; tasks: TaskRecord[] } {
  if (cachedScanResult && Date.now() - lastScanTimestamp < 8000) {
    return cachedScanResult
  }
  const pyRes = runTrackerDb(['--get-all'])
  if (pyRes && pyRes.success && pyRes.data) {
    cachedScanResult = enrichTrackerData(pyRes.data.safars || [], pyRes.data.tasks || [])
    exportProductionSummary(cachedScanResult)
    return cachedScanResult
  }
  return { safars: [], tasks: [] }
}

// ── Safar Directory Mover ──────────────────────────────────────

export function moveSafarDirectory(params: {
  safarName: string
  currentPath: string
  targetFolder: 'in_process' | 'to_upload' | 'to_delete' | 'pending' | 'custom'
  customTargetPath?: string
  workspaces?: DriveWorkspaceConfig[]
}): { success: boolean; newPath?: string; error?: string } {
  const { safarName, currentPath, targetFolder, customTargetPath, workspaces } = params
  if (!currentPath || !fs.existsSync(currentPath)) {
    return { success: false, error: `Current folder path not found: ${currentPath}` }
  }

  const safarBaseName = path.basename(currentPath) || safarName
  const currentRoot = path.parse(currentPath).root.toUpperCase()

  let destinationDir = ''

  if (targetFolder === 'custom' && customTargetPath) {
    destinationDir = customTargetPath
  } else {
    // Find matching workspace for this drive or use defaults
    const matchingWs = (workspaces || []).find(w => {
      if (!w.driveRoot) return false
      return w.driveRoot.toUpperCase().slice(0, 2) === currentRoot.slice(0, 2)
    })

    if (targetFolder === 'in_process') {
      destinationDir = matchingWs?.inProcessPath || path.join(currentRoot, 'IN PROCESS')
    } else if (targetFolder === 'to_upload') {
      destinationDir = matchingWs?.toUploadPath || path.join(currentRoot, 'TO UPLOAD')
    } else if (targetFolder === 'to_delete') {
      destinationDir = matchingWs?.toDeletePath || path.join(currentRoot, 'TO DELETE')
    } else if (targetFolder === 'pending') {
      destinationDir = path.join(currentRoot, 'PENDING')
    }
  }

  if (!destinationDir) {
    return { success: false, error: 'Could not determine destination directory' }
  }

  // Ensure destination directory exists
  if (!fs.existsSync(destinationDir)) {
    try {
      fs.mkdirSync(destinationDir, { recursive: true })
    } catch (e: any) {
      return { success: false, error: `Could not create destination directory: ${e.message}` }
    }
  }

  const targetPath = path.join(destinationDir, safarBaseName)

  // Check if target is same as current
  if (path.resolve(currentPath).toLowerCase() === path.resolve(targetPath).toLowerCase()) {
    return { success: true, newPath: currentPath }
  }

  // If target already exists, prevent overwrite
  if (fs.existsSync(targetPath)) {
    return { success: false, error: `Destination folder already exists: ${targetPath}` }
  }

  const destRoot = path.parse(targetPath).root.toUpperCase()

  try {
    if (currentRoot.slice(0, 2) === destRoot.slice(0, 2)) {
      // Same volume: atomic rename is instantaneous (< 10ms)!
      fs.renameSync(currentPath, targetPath)
    } else {
      // Cross-volume: copy recursively then delete source
      fs.cpSync(currentPath, targetPath, { recursive: true })
      if (fs.existsSync(targetPath)) {
        fs.rmSync(currentPath, { recursive: true, force: true })
      } else {
        return { success: false, error: 'Copy failed during cross-volume move' }
      }
    }
  } catch (err: any) {
    return { success: false, error: `Failed to move folder: ${err.message}` }
  }

  // Update SQLite tracker.db
  try {
    const newDrive = destRoot.slice(0, 2)
    runTrackerDb(['--update-safar-path'], JSON.stringify({
      safar_name: safarName,
      old_path: currentPath,
      new_path: targetPath,
      new_drive: newDrive
    }))
  } catch (err) {
    console.warn('[taskTracker] SQLite path update error:', err)
  }

  broadcastChange()
  return { success: true, newPath: targetPath }
}

export function removeTaskTrackerRecord(safarName: string, dateFolder: string): { success: boolean; error?: string } {
  const sName = (safarName || '').trim()
  const dName = (dateFolder || '').trim()
  if (!sName || !dName) return { success: false, error: 'safarName and dateFolder required' }

  const normKey = `${sName.toLowerCase()}::${normalizeDateFolderKey(dName)}`
  excludedFolderKeys.add(normKey)

  const result = runTrackerDb(['--remove-task', '--safar', sName, '--date', dName])
  if (!result?.success) return { success: false, error: result?.error || 'Could not remove task record.' }

  if (cachedScanResult) {
    cachedScanResult.tasks = (cachedScanResult.tasks || []).filter(t =>
      !(t.safarName.toLowerCase() === sName.toLowerCase() && normalizeDateFolderKey(t.dateFolder) === normalizeDateFolderKey(dName))
    )
    if (cachedScanResult.websiteTasks) {
      cachedScanResult.websiteTasks = (cachedScanResult.websiteTasks || []).filter(t =>
        !(t.safarName.toLowerCase() === sName.toLowerCase() && normalizeDateFolderKey(t.dateFolder) === normalizeDateFolderKey(dName))
      )
    }
  }
  broadcastChange()
  return { success: true }
}

export async function resetAndCleanTrackerRecords(input?: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    await runTrackerDbAsync(['--clean-reset'])
    cachedScanResult = null
    lastScanTimestamp = 0
    const scanArgs = (input && Object.keys(input).length > 0) ? input : (lastScanInput || {})
    const fresh = await scanTrackerDataAsync({ ...(scanArgs || {}), force: true })
    broadcastChange()
    return { success: true, data: fresh }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Reset failed' }
  }
}

export async function addManualDateFolderRecord(safarName: string, dateFolder: string, datePath?: string): Promise<{ success: boolean; error?: string }> {
  const sName = (safarName || '').trim()
  const dName = (dateFolder || '').trim()
  if (!sName || !dName) return { success: false, error: 'safarName and dateFolder required' }

  const normKey = `${sName.toLowerCase()}::${normalizeDateFolderKey(dName)}`
  excludedFolderKeys.delete(normKey)

  const directTask: TaskRecord = {
    safarName: sName,
    dateFolder: dName,
    status: 'editing_pending',
    workingPath: datePath || undefined,
    currentDrive: datePath ? normalizeDrive(datePath) : undefined
  }
  await runTrackerDbAsync(['--upsert-batch'], JSON.stringify({
    tasks: [directTask],
    safars: [{ safarName: sName, totalDays: 1, completedDays: 0, isSafarDone: false }]
  }))
  cachedScanResult = null
  lastScanTimestamp = 0
  broadcastChange()
  return { success: true }
}

export function getLatestTrackerData(): { safars: SafarRecord[]; tasks: TaskRecord[] } {
  return cachedScanResult || { safars: [], tasks: [] }
}

// ── Register IPC Handlers ─────────────────────────────────────

export function registerTaskTrackerIPC(): void {
  // Start background auto-drive reconnect sentinel watchdog
  startDriveSentinel()

  // 1. Scan and compute tasks
  ipcMain.handle('taskTracker:scan', async (_e, input: any) => {
    try {
      return await scanTrackerDataAsync(input)
    } catch (e) {
      console.error('[taskTracker] Scan error:', e)
      return { safars: [], tasks: [] }
    }
  })

  // 1.1 Move Safar between In Process, To Upload, To Delete, Pending
  ipcMain.handle('taskTracker:moveSafar', async (_e, params: {
    safarName: string
    currentPath: string
    targetFolder: 'in_process' | 'to_upload' | 'to_delete' | 'pending' | 'custom'
    customTargetPath?: string
    workspaces?: DriveWorkspaceConfig[]
  }) => {
    try {
      return moveSafarDirectory(params)
    } catch (e: any) {
      console.error('[taskTracker] moveSafar error:', e)
      return { success: false, error: e.message }
    }
  })

  // 1.5 Auto-detect folders on a drive root
  ipcMain.handle('taskTracker:autoDetectDriveFolders', (_e, driveRoot: string) => {
    try {
      return autoDetectDriveFolders(driveRoot)
    } catch (e) {
      console.error('[taskTracker] autoDetectDriveFolders error:', e)
      return {
        driveRoot,
        inProcessPath: path.join(driveRoot, 'IN PROCESS'),
        inProcessExists: false,
        toUploadPath: path.join(driveRoot, 'UPLOADED DATA'),
        toUploadExists: false,
        toDeletePath: path.join(driveRoot, 'TO DELETE'),
        toDeleteExists: false,
    pendingPath: path.join(root, 'Pending'),
    pendingExists: false,
        safarCount: 0
      }
    }
  })

  // 1.6 Create missing folders on a drive
  ipcMain.handle('taskTracker:createDriveFolders', (_e, folders: string[], safarName?: string) => {
    try {
      return createDriveFolders(folders, safarName)
    } catch (e: any) {
      return { success: false, created: [], errors: [e.message] }
    }
  })

  // 1.7 Create Full Safar Folder Structure inside IN PROCESS dirs (Issue 4)
  ipcMain.handle('taskTracker:createFullSafarStructure', async (
    _e,
    params: { safarName: string; workspaces: DriveWorkspaceConfig[] }
  ) => {
    const { safarName, workspaces } = params
    if (!safarName || !safarName.trim()) return { success: false, error: 'Safar name is required' }

    const created: string[] = []
    const errors: string[] = []

    const today = new Date().toISOString().slice(0, 10)
    const subFolders = [today, 'Final', 'Final Titles']

    const enabledWorkspaces = (workspaces || []).filter(w => w.enabled && w.inProcessPath)
    if (enabledWorkspaces.length === 0) return { success: false, error: 'No active workspaces with IN PROCESS path configured' }

    for (const ws of enabledWorkspaces) {
      // 1. Also ensure root To Upload and To Delete exist on this workspace
      if (ws.toUploadPath && !fs.existsSync(ws.toUploadPath)) {
        try { fs.mkdirSync(ws.toUploadPath, { recursive: true }); created.push(ws.toUploadPath) } catch (e: any) { errors.push(e.message) }
      }
      if (ws.toDeletePath && !fs.existsSync(ws.toDeletePath)) {
        try { fs.mkdirSync(ws.toDeletePath, { recursive: true }); created.push(ws.toDeletePath) } catch (e: any) { errors.push(e.message) }
      }

      // 2. Create Safar root and sub-folders
      const safarRoot = path.join(ws.inProcessPath!, safarName.trim())
      try {
        if (!fs.existsSync(safarRoot)) {
          fs.mkdirSync(safarRoot, { recursive: true })
          created.push(safarRoot)
        }
        for (const sub of subFolders) {
          const subPath = path.join(safarRoot, sub)
          try {
            if (!fs.existsSync(subPath)) {
              fs.mkdirSync(subPath, { recursive: true })
              created.push(subPath)
            }
          } catch (e: any) {
            errors.push(`${subPath}: ${e.message}`)
          }
        }
      } catch (e: any) {
        errors.push(`${safarRoot}: ${e.message}`)
      }
    }

    broadcastChange()
    return { success: errors.length === 0, created, errors, safarName }
  })


  ipcMain.handle('taskTracker:startWatch', (_e, input: any) => {
    stopAllWatchers()

    const pathsToWatch = new Set<string>()

    if (Array.isArray(input)) {
      for (const ws of input) {
        if (ws.enabled) {
          if (ws.inProcessPath) pathsToWatch.add(ws.inProcessPath)
          if (ws.toUploadPath) pathsToWatch.add(ws.toUploadPath)
          if (ws.toDeletePath) pathsToWatch.add(ws.toDeletePath)
        }
      }
    } else if (input?.workspaces && Array.isArray(input.workspaces)) {
      for (const ws of input.workspaces) {
        if (ws.enabled) {
          if (ws.inProcessPath) pathsToWatch.add(ws.inProcessPath)
          if (ws.toUploadPath) pathsToWatch.add(ws.toUploadPath)
          if (ws.toDeletePath) pathsToWatch.add(ws.toDeletePath)
        }
      }
    } else if (input) {
      if (input.workingPath) pathsToWatch.add(input.workingPath)
      if (input.toUploadPath) pathsToWatch.add(input.toUploadPath)
      if (input.toDeletePath) pathsToWatch.add(input.toDeletePath)
    }

    for (const p of pathsToWatch) {
      watchFolderSafe(p)
    }

    return { success: true, count: activeWatchers.length }
  })

  // 3. Stop background file watchers
  ipcMain.handle('taskTracker:stopWatch', () => {
    stopAllWatchers()
    return { success: true }
  })

  // 4. Open file or directory in Anything File Manager / Ecosystem Explorer
  ipcMain.handle('taskTracker:openPath', async (_e, targetPath: string) => {
    if (!targetPath || !fs.existsSync(targetPath)) {
      return { success: false, error: 'Path not found' }
    }
    try {
      await openInEcosystemExplorer(targetPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 5. Reveal in Explorer / AFM
  ipcMain.handle('taskTracker:showInFolder', async (_e, targetPath: string) => {
    if (!targetPath || !fs.existsSync(targetPath)) return { success: false }
    await openInEcosystemExplorer(targetPath)
    return { success: true }
  })

  // 6. Get Audit History
  ipcMain.handle('taskTracker:getHistory', (_e, filter?: { safarName?: string; dateFolder?: string }) => {
    const args = ['--get-history']
    if (filter?.safarName) args.push('--safar', filter.safarName)
    if (filter?.dateFolder) args.push('--date', filter.dateFolder)
    const res = runTrackerDb(args)
    return res?.logs || []
  })

  // 6.5 Set Manual Status (Uploaded / Submitted / Auto)
  ipcMain.handle('taskTracker:setManualStatus', async (_e, payload: {
    safarNames?: string[]
    taskKeys?: { safarName: string; dateFolder: string }[]
    status: 'uploaded' | 'submitted' | 'auto'
  }) => {
    try {
      const res = runTrackerDb(['--set-manual-status'], JSON.stringify(payload))
      broadcastChange()
      return res || { success: true }
    } catch (err: any) {
      console.error('[taskTracker] setManualStatus error:', err)
      return { success: false, error: err.message }
    }
  })

  // 7. Export Status Manifest to Excel
  ipcMain.handle('taskTracker:exportExcel', async (_e, payload: { safars: SafarRecord[]; tasks: TaskRecord[] }) => {
    try {
      const saveRes = await dialog.showSaveDialog({
        title: 'Export Production Tracker Manifest',
        defaultPath: `Safar_Production_Tracker_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      })

      if (saveRes.canceled || !saveRes.filePath) {
        return { success: false, canceled: true }
      }

      const rows: any[] = []
      for (const s of payload.safars || []) {
        for (const t of s.tasks || []) {
          rows.push({
            'Safar Name': s.safarName,
            'City': s.city || 'Unassigned',
            'Year': s.safarYear || '',
            'Safar Serial': s.safarSerial || '',
            'Date Folder': t.dateFolder,
            'Lifecycle Status': t.status.toUpperCase().replace('_', ' '),
            'Rendered To Final': t.renderedAt ? new Date(t.renderedAt).toLocaleString() : 'Pending',
            'Uploaded To SSD': t.uploadedAt ? new Date(t.uploadedAt).toLocaleString() : 'Pending',
            'Submitted To AlJamea': t.submittedAt ? new Date(t.submittedAt).toLocaleString() : 'Pending',
            'Rendered Videos Count': t.renderVideoCount || 0,
            'Rendered Size (MB)': t.renderSizeBytes ? (t.renderSizeBytes / (1024 * 1024)).toFixed(1) : '0',
            'Current Drive': t.currentDrive || '',
            'Working Directory': t.workingPath || '',
            'Final Output Path': t.finalPath || '',
            'Safar 100% Done': s.isSafarDone ? 'YES' : 'NO'
          })
        }
      }

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Production Tracker')

      XLSX.writeFile(wb, saveRes.filePath)
      return { success: true, filePath: saveRes.filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 8. Ghost Vault Asset Search Engine ──
  ipcMain.handle('taskTracker:searchAssets', (_e, filter: any) => {
    try {
      return searchAssets(filter || {})
    } catch (err: any) {
      console.error('[taskTracker] searchAssets error:', err)
      return []
    }
  })

  // ── 9. Ghost Vault Summary Stats ──
  ipcMain.handle('taskTracker:getAssetStats', () => {
    try {
      const res = runTrackerDb(['--resource-stats'])
      return res?.stats || { totalCount: 0, totalBytes: 0, types: {}, categories: {}, drives: [] }
    } catch {
      return { totalCount: 0, totalBytes: 0, types: {}, categories: {}, drives: [] }
    }
  })

  // ── 10. Deep Index Folder / Drive into Ghost Vault ──
  ipcMain.handle('taskTracker:indexCustomDirectory', async (_e, targetDir?: string) => {
    try {
      let dir = targetDir
      if (!dir) {
        const choice = await dialog.showOpenDialog({
          title: 'Select Folder or Drive to Deep Index into Ghost Vault',
          properties: ['openDirectory']
        })
        if (choice.canceled || choice.filePaths.length === 0) {
          return { canceled: true }
        }
        dir = choice.filePaths[0]
      }

      if (!fs.existsSync(dir)) {
        return { success: false, error: 'Directory does not exist' }
      }

      const resources = indexDirectoryRecursively(dir, undefined, 5)
      if (resources.length > 0) {
        runTrackerDb(['--upsert-resources'], JSON.stringify(resources))
      }

      const totalBytes = resources.reduce((acc, r) => acc + (r.fileSize || 0), 0)
      return { success: true, count: resources.length, totalBytes, dir }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 11. Smart Locate File in Explorer (with Offline Fallback) ──
  ipcMain.handle('taskTracker:locateFile', async (_e, targetPath: string) => {
    if (!targetPath) return { success: false, error: 'No path specified' }
    try {
      if (fs.existsSync(targetPath)) {
        shell.showItemInFolder(targetPath)
        return { success: true, isConnected: true }
      } else {
        const root = path.parse(targetPath).root
        const isMounted = fs.existsSync(root)
        return {
          success: false,
          isConnected: isMounted,
          error: isMounted ? 'File was moved or deleted.' : `Drive ${root} is currently disconnected.`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 12. Smart Open Folder in Explorer (with Offline Fallback) ──
  ipcMain.handle('taskTracker:openFolder', async (_e, targetPath: string) => {
    if (!targetPath) return { success: false, error: 'No folder specified' }
    try {
      if (fs.existsSync(targetPath)) {
        await shell.openPath(targetPath)
        return { success: true, isConnected: true }
      } else {
        const root = path.parse(targetPath).root
        const isMounted = fs.existsSync(root)
        return {
          success: false,
          isConnected: isMounted,
          error: isMounted ? 'Folder does not exist.' : `Drive ${root} is currently disconnected.`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 13. Rename Safar Across Task Tracker ──
  ipcMain.handle('taskTracker:renameSafar', async (_e, params: {
    oldSafar: string
    newSafar: string
    city?: string
    year?: number
    serial?: string
  }) => {
    if (!params?.oldSafar || !params?.newSafar) {
      return { success: false, error: 'Missing oldSafar or newSafar' }
    }
    const args = [
      '--rename-safar',
      '--old-safar', params.oldSafar,
      '--new-safar', params.newSafar
    ]
    if (params.city) args.push('--city', params.city)
    if (params.year) args.push('--year', String(params.year))
    if (params.serial) args.push('--serial', params.serial)

    return runTrackerDb(args)
  })

  // ── 14. Remove Task Record (and exclude from tracker) ──
  ipcMain.handle('taskTracker:removeTask', (_e, params: { safarName: string; dateFolder: string }) => {
    try {
      return removeTaskTrackerRecord(params.safarName, params.dateFolder)
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to remove task' }
    }
  })

  // ── 15. Reset and Clean Tracker for Fresh Rescan ──
  ipcMain.handle('taskTracker:resetAndRescan', async (_e, input?: any) => {
    try {
      return await resetAndCleanTrackerRecords(input)
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to reset and rescan' }
    }
  })

  // ── 16. Manually Add Date Folder ──
  ipcMain.handle('taskTracker:addDateFolder', async (_e, params: { safarName: string; dateFolder: string; datePath?: string }) => {
    try {
      return await addManualDateFolderRecord(params.safarName, params.dateFolder, params.datePath)
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to add date folder' }
    }

  })
}
