/**
============================================================
AUTONOMOUS TASK & PRODUCTION TRACKER IPC (taskTracker.ipc.ts)

Main process engine for real-time tracking of Safar and Date
editing, review, upload, and AlJamea submission lifecycles.
Backed by SQLite (tracker.db) for drive-independent persistence.
============================================================
*/

import { ipcMain, BrowserWindow, shell, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
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

  driveSentinelTimer = setInterval(() => {
    const current = scanDrives()
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

export function isSafarFolder(name: string): boolean {
  if (!name) return false
  const clean = name.trim()
  if (clean.startsWith('.') || clean.startsWith('$') || clean.toLowerCase() === 'system volume information') return false
  // Standard Safar folder patterns:
  // e.g. "1448-03 Mumbai", "1448_03_Mumbai", "1448 - 03 Mumbai", "1448-03-Mumbai", "1448-03"
  if (/^\d{4}[\s\-_.]+\d{1,3}(?:[\s\-_.]+[A-Za-z].*)?$/i.test(clean)) return true
  // e.g. "03-Mumbai", "03_Mumbai", "03 Mumbai"
  if (/^\d{1,3}[\s\-_.]+[A-Za-z].*$/i.test(clean)) return true
  // e.g. "1448 Mumbai", "1448-Mumbai"
  if (/^\d{4}[\s\-_.]+[A-Za-z].*$/i.test(clean)) return true
  // Explicit "Safar" in name e.g. "Safar 1", "Safar_Mumbai"
  if (/safar/i.test(clean)) return true
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

export function isDateFolder(name: string): boolean {
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
    /_\d{1,2}[a-z]/i.test(clean) ||
    /^day[\s._\-]?\d+/i.test(clean) ||
    /^\d{1,2}[\s._\-]\d{1,2}\b/.test(clean) ||
    /^\d{1,2}$/.test(clean)
  )
}

function scanFolderMedia(folderPath: string): { videoCount: number; totalSize: number; mtime: number } {
  let videoCount = 0
  let totalSize = 0
  let maxMtime = 0

  if (!fs.existsSync(folderPath)) {
    return { videoCount, totalSize, mtime: 0 }
  }

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true })
    for (const ent of entries) {
      const full = path.join(folderPath, ent.name)
      if (ent.isDirectory()) {
        const sub = scanFolderMedia(full)
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

        if (ent.isDirectory()) {
          if (!map.has(lower)) {
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
  driveRootOverride?: string
): { safars: SafarRecord[]; tasks: TaskRecord[]; resources: MediaResourceRecord[] } {
  const tasksToUpsert: TaskRecord[] = []
  const safarsToUpsert: SafarRecord[] = []
  const resourcesToUpsert: MediaResourceRecord[] = []

  let actualWorkingPath = (workingPath || '').trim()
  if (!actualWorkingPath || !fs.existsSync(actualWorkingPath)) {
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

  if (!actualWorkingPath || !fs.existsSync(actualWorkingPath)) {
    return { safars: [], tasks: [], resources: [] }
  }

  const uploadFoldersMap = toUploadPath && fs.existsSync(toUploadPath)
    ? getFolderNamesSet(toUploadPath)
    : new Map<string, string>()
  const deleteFoldersMap = toDeletePath && fs.existsSync(toDeletePath)
    ? getFolderNamesSet(toDeletePath)
    : new Map<string, string>()

  const parsedRoot = path.parse(actualWorkingPath).root
  const driveLetterMatch = (driveRootOverride || parsedRoot).match(/^([A-Za-z]:)/)
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

  if (hasSubFinal || hasSubDateFolders) {
    safarDirs = [actualWorkingPath]
  } else {
    const collectDeepSafars = (dir: string, depth = 0): string[] => {
      if (depth > 2) return []
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        const hasFinal = entries.some(e => e.isDirectory() && (e.name.toLowerCase() === 'final' || e.name.toLowerCase() === 'final titles'))
        const hasDates = entries.some(e => e.isDirectory() && isDateFolder(e.name))
        if (hasFinal || hasDates) {
          return [dir]
        }
        const found: string[] = []
        for (const ent of entries) {
          if (!ent.isDirectory() || ent.name.startsWith('.') || ent.name.startsWith('$') || ent.name.toLowerCase() === 'system volume information' || ent.name.toLowerCase() === 'node_modules') continue
          const sub = path.join(dir, ent.name)
          if (isSafarFolder(ent.name)) {
            found.push(sub)
          } else {
            found.push(...collectDeepSafars(sub, depth + 1))
          }
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
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name.toLowerCase() !== '$recycle.bin')
        .map(e => path.join(actualWorkingPath, e.name))
    }
  }

  for (const safarPath of safarDirs) {
    const safarFolderName = path.basename(safarPath)
    const safarMeta = parseSafarMetadata(safarFolderName)

    // Catalog Safar folder itself
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
    if (finalDirPath && fs.existsSync(finalDirPath)) {
      try {
        const fSubs = fs.readdirSync(finalDirPath, { withFileTypes: true })
        for (const fsEnt of fSubs) {
          if (fsEnt.isDirectory()) {
            finalDateFoldersMap.set(fsEnt.name.toLowerCase().trim(), path.join(finalDirPath, fsEnt.name))
          }
        }
      } catch {}
    }

    const dateDirEnts = safarEntries.filter(e => {
      if (!e.isDirectory()) return false
      const lower = e.name.toLowerCase()
      if (lower === 'final' || lower === 'final titles' || lower === 'titles' || lower === 'assets' || lower === 'raw') return false
      if (isDateFolder(e.name)) return true
      try {
        const subFiles = fs.readdirSync(path.join(safarPath, e.name))
        return subFiles.some(f => f.toLowerCase().endsWith('.prproj') || VIDEO_EXTS.has(path.extname(f).toLowerCase()))
      } catch {
        return false
      }
    })

    const hasDirectPrproj = safarEntries.some(e => e.isFile() && e.name.toLowerCase().endsWith('.prproj'))
    const hasDirectVideo = safarEntries.some(e => e.isFile() && VIDEO_EXTS.has(path.extname(e.name).toLowerCase()))

    // If this folder has neither date folders nor a Final folder nor direct project/media, it is not a Safar directory
    if (dateDirEnts.length === 0 && !finalDirPath && !hasDirectPrproj && !hasDirectVideo) {
      continue
    }

    const safarTasks: TaskRecord[] = []

    if (dateDirEnts.length === 0) {
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

    for (const dateEnt of dateDirEnts) {
      const dateFolderName = dateEnt.name
      const dateFolderPath = path.join(safarPath, dateFolderName)
      const dateKey = dateFolderName.toLowerCase().trim()

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

      const matchedFinalPath = finalDateFoldersMap.get(dateKey) || null
      const isRenderedInFinal = !!matchedFinalPath

      let renderVideoCount = 0
      let renderSizeBytes = 0
      let renderedAtTime: number | undefined

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

      const prInfo = checkAdobeProject(dateFolderPath)
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

      const uploadMatchPath = uploadFoldersMap.get(dateKey) || null
      const deleteMatchPath = deleteFoldersMap.get(dateKey) || null

      let status: TaskStatus = 'editing_pending'

      if (deleteMatchPath) {
        // Date folder found in "To Delete" → fully submitted to AlJamea
        status = 'submitted'
      } else if (uploadMatchPath) {
        // Date folder found in "To Upload" → uploaded / ready for AlJamea
        status = 'uploaded'
      } else if (isRenderedInFinal) {
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

            if (isDateFolder(ent.name)) {
              nextDate = ent.name
              tasksToUpsert.push({
                safarName: currentSafarHint || path.basename(workingPath),
                dateFolder: ent.name,
                status: taskStatus,
                uploadPath: category === 'to_upload' ? fullPath : undefined,
                deletePath: category === 'to_delete' ? fullPath : undefined,
                currentDrive: workingDrive,
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
                safarName: currentSafarHint || path.basename(workingPath),
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

  const groupedSafars = dbSafars.map(s => {
    const matchedTasks = enrichedTasks.filter(t => t.safarName === s.safarName)
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

let cachedScanResult: { safars: SafarRecord[]; tasks: TaskRecord[] } | null = null
let lastScanTimestamp = 0
let isScanRunning = false

export function scanTrackerData(input: {
  workingPath?: string
  toUploadPath?: string
  toDeletePath?: string
  workspaces?: DriveWorkspaceConfig[]
  force?: boolean
} | DriveWorkspaceConfig[]): { safars: SafarRecord[]; tasks: TaskRecord[] } {
  const isForce = !Array.isArray(input) && Boolean((input as any)?.force)

  // Fast-path: return cached result if scanned within the last 8 seconds
  if (!isForce && cachedScanResult && Date.now() - lastScanTimestamp < 8000) {
    return cachedScanResult
  }

  // If a scan is already running on the disk, return cached without blocking
  if (isScanRunning) {
    return cachedScanResult || { safars: [], tasks: [] }
  }

  isScanRunning = true
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

  if (workspaceList.length > 0) {
    for (const ws of workspaceList) {
      const workingDir = ws.inProcessPath || ws.driveRoot || ''
      if (workingDir) {
        const res = scanSingleWorkspace(workingDir, ws.toUploadPath, ws.toDeletePath, ws.driveRoot)
        allSafarsToUpsert.push(...res.safars)
        allTasksToUpsert.push(...res.tasks)
        allResourcesToUpsert.push(...res.resources)
      }
    }
  } else if (!Array.isArray(input) && input?.workingPath) {
    const res = scanSingleWorkspace(input.workingPath, input.toUploadPath, input.toDeletePath)
    allSafarsToUpsert = res.safars
    allTasksToUpsert = res.tasks
    allResourcesToUpsert = res.resources
  } else {
    const pyRes = runTrackerDb(['--get-all'])
    if (pyRes && pyRes.success && pyRes.data) {
      return enrichTrackerData(pyRes.data.safars || [], pyRes.data.tasks || [])
    }
    return { safars: [], tasks: [] }
  }

  // Persist tasks, safars, and ghost media resources to SQLite tracker.db
  if (allTasksToUpsert.length > 0 || allSafarsToUpsert.length > 0 || allResourcesToUpsert.length > 0) {
    try {
      runTrackerDb(['--upsert-batch'], JSON.stringify({
        tasks: allTasksToUpsert,
        safars: allSafarsToUpsert,
        resources: allResourcesToUpsert
      }))
    } catch (err) {
      console.warn('[taskTracker] Upsert-batch error:', err)
    }
  }

    // Return full consolidated state from tracker.db so all drives remain visible and preserved
    const pyRes = runTrackerDb(['--get-all'])
    if (pyRes && pyRes.success && pyRes.data && Array.isArray(pyRes.data.safars) && pyRes.data.safars.length > 0) {
      cachedScanResult = enrichTrackerData(pyRes.data.safars, pyRes.data.tasks || [])
    } else {
      cachedScanResult = enrichTrackerData(allSafarsToUpsert, allTasksToUpsert)
    }
    lastScanTimestamp = Date.now()
    return cachedScanResult
  } finally {
    isScanRunning = false
  }
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

// ── Register IPC Handlers ─────────────────────────────────────

export function registerTaskTrackerIPC(): void {
  // Start background auto-drive reconnect sentinel watchdog
  startDriveSentinel()

  // 1. Scan and compute tasks
  ipcMain.handle('taskTracker:scan', (_e, input: any) => {
    try {
      return scanTrackerData(input)
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

  // 4. Open file or directory in Windows Explorer / Premiere Pro
  ipcMain.handle('taskTracker:openPath', async (_e, targetPath: string) => {
    if (!targetPath || !fs.existsSync(targetPath)) {
      return { success: false, error: 'Path not found' }
    }
    try {
      await shell.openPath(targetPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 5. Reveal in Explorer
  ipcMain.handle('taskTracker:showInFolder', async (_e, targetPath: string) => {
    if (!targetPath || !fs.existsSync(targetPath)) return { success: false }
    shell.showItemInFolder(targetPath)
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
}
