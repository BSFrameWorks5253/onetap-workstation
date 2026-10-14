/**
 * ============================================================
 * SETTINGS MANAGER  (src/main/core/settingsManager.ts)
 *
 * TypeScript port of the Python settings_manager.py.
 * Uses the same two-file strategy:
 *   LOCATOR: %APPDATA%\EditorsToolkit\settings_location.ini
 *     → contains path to the folder the user chose
 *   SETTINGS: <chosen-folder>\settings.json
 *     → contains all app configuration
 *
 * Interoperable with the Python version (same file format).
 * ============================================================
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

// ── Platform-aware config root (APPDATA on Windows, ~/.config on Linux) ──────
function getPlatformConfigRoot(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
  }
  // Linux / macOS: respect XDG_CONFIG_HOME, fall back to ~/.config
  return process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config')
}

// ── Locator file (fixed location, never changes) ────────────
const LOCATOR_DIR = path.join(getPlatformConfigRoot(), 'One Tap')
const LOCATOR_FILE = path.join(LOCATOR_DIR, 'settings_location.ini')

// ── Runtime state ─────────────────────────────────────────────
let _settingsFile = ''
let _needsSetup = false
let _store: Record<string, unknown> = {}

export function getDefaultTitlesFolder(): string {
  // Universal: try electron's documents path first
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

  // Standard cross-platform: ~/Documents/Final Titles
  const std = path.join(os.homedir(), 'Documents', 'Final Titles')
  if (fs.existsSync(std)) return std

  // Windows-only: check OneDrive Documents
  if (process.platform === 'win32' && process.env.USERPROFILE) {
    const oneDrivePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Final Titles')
    if (fs.existsSync(oneDrivePath)) return oneDrivePath
    const oneDriveDir = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents')
    if (fs.existsSync(oneDriveDir)) return path.join(oneDriveDir, 'Final Titles')
  }

  return std
}

// ── Default values for every configurable field ──────────────
export const DEFAULTS: Record<string, unknown> = {
  // ── AI Registration, Broadcast & Over-The-Air Rules Sync ─
  ai_registration_script_url: 'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec',
  ai_rules_url: 'https://raw.githubusercontent.com/BSFrameWorks5253/onetap-workstation/main/resources/ai/ai_rules.json',

  // ── Paths & Assets ────────────────────────────────────────
  titles_folder: getDefaultTitlesFolder(),

  // ── Audio Configuration ───────────────────────────────────
  audio_swap: false, // True → Audio2=primary, Audio1=secondary (normal videos)
  audio_collection: [], // list of {"name": string, "path": string}
  instrumental_audio_collection: [], // list of {"name": string, "path": string}


  // ── Normal Video Audio overrides (non-Nikah) ──────────────
  normal_audio_primary: null, // Full path override for Audio 1
  normal_audio_secondary: null, // Full path override for Audio 2

  // ── Nikah Video Audio override ────────────────────────────
  nikah_audio_override: null, // Full path override for Nikah Audio track

  // ── Legacy global overrides (kept for backward compatibility)
  audio1_override: null,
  audio2_override: null,

  // ── Audio Assignment Mode ─────────────────────────────────
  audio_assignment_mode: 'single', // "single" | "alternate" | "prefix"
  audio_single_index: 0, // 0-based pool index for single mode
  audio_prefix_map: {}, // legacy: {PREFIX: full_audio_path}

  // ── Audio Prefix Assignments (index-based, preferred) ─────
  // Maps each video prefix → audio pool name (e.g. "Audio 1").
  // Resolved against the assets folder at processing time.
  audio_prefix_assignments: {
    Q: 'Audio 1',
    Z: 'Audio 1',
    MZ: 'Audio 1',
    M: 'Audio 1',
    Waaz: 'Audio 1',
    ID: 'Audio 1',
    AQ: 'Audio 1'
  },

  // ── PNG → JPG Converter Paths ─────────────────────────────
  converter_input: '', // Source folder (PNG screenshots)
  converter_output: '', // Output folder (empty = auto: src/Converted_JPEGs)
  converter_source_jpeg: '', // Source folder (JPEG thumbnails to rename & move)
  converter_video_target: '', // Target folder (rendered videos matching JPEGs)
  converter_jpeg: '', // Default output folder for auto watcher
  screenshot_folder: '',
  watcher_enabled: true,
  watcher_input_folder: '',

  // ── Title Adder mode ──────────────────────────────────────
  title_mode: 'batch', // "batch" | "single"
  code_parsing_logic: 'auto', // "auto" default

  // ── Path Memory ───────────────────────────────────────────
  remember_paths: true, // Auto-fill folders from last session
  last_source_adder: '',
  last_output_adder: '',
  last_video_single: '',
  last_output_single: '',

  // ── Theme & Appearance ────────────────────────────────────
  app_theme: 'adobe', // "light" | "dark" | "adobe" ...
  anim_preset: 'balanced',
  font_family: 'Inter',
  font_bold: 'Inter Bold',
  font_mono: 'Consolas',
  sidebar_width: 220,

  // ── Per-page accent colors ────────────────────────────────
  accent_adder: '#6366F1',
  accent_converter: '#10B981',
  accent_single: '#F33996',
  accent_drivesync: '#F59E0B',
  accent_folder: '#8B5CF6',
  accent_settings: '#6366F1',

  // ── Notifications / Confirmations ─────────────────────────
  // {action_id: True} means "skip this dialog"
  confirmations_disabled: {},

  // ── Performance ───────────────────────────────────────────
  drivesync_threads: 8, // ThreadPoolExecutor worker count
  drivesync_bufsize_mb: 4, // Copy buffer size in MB

  // ── Adobe Premiere Integration ────────────────────────────
  adobe_marker_colors_enabled: false,
  adobe_marker_color_mappings: {
    'Qadam': 4, // Cerulean
    'MZ': 6,    // Rose
    'Z': 1,     // Iris
    'BZ': 1,    // Iris
    'Q': 9,     // Blue
    'BQ': 9,    // Blue
    'M': 10,    // Teal
    'BM': 10,   // Teal
    'Waaz': 5,  // Forest
    'ID': 7,    // Mango
    'AQ': 14    // Yellow
  }
}

// ── Candidate Locator & App directories ──────────────────────
const ROAMING_DIR = getPlatformConfigRoot()
const APP_NAMES = ['Uni Desk', 'One Tap', 'UniDesk_App', 'EditorsToolkit']
const PRIMARY_LOCATOR_DIR = path.join(ROAMING_DIR, 'One Tap')
const PRIMARY_LOCATOR_FILE = path.join(PRIMARY_LOCATOR_DIR, 'settings_location.ini')

function getCandidateAppDirs(): string[] {
  const dirs: string[] = []
  try {
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      const uPath = app.getPath('userData')
      if (uPath && !dirs.includes(uPath)) dirs.push(uPath)
    }
  } catch {}

  for (const name of APP_NAMES) {
    const p = path.join(ROAMING_DIR, name)
    if (!dirs.includes(p)) dirs.push(p)
  }
  return dirs
}

// ── Locator helpers ──────────────────────────────────────────
function readLocator(): string | null {
  try {
    const candidateDirs = getCandidateAppDirs()

    // 1. Check all candidate directories for settings_location.ini
    for (const dir of candidateDirs) {
      const locFile = path.join(dir, 'settings_location.ini')
      if (fs.existsSync(locFile)) {
        try {
          const raw = fs.readFileSync(locFile, 'utf-8').trim()
          if (raw) {
            if (fs.existsSync(raw) && fs.statSync(raw).isDirectory()) {
              writeLocator(raw) // sync to all candidate locations
              return raw
            }
            // If the folder path doesn't exist on disk, attempt to create it (never delete locator!)
            try {
              fs.mkdirSync(raw, { recursive: true })
              writeLocator(raw)
              return raw
            } catch (createErr) {
              console.warn(`[Settings] Could not recreate stored folder ${raw}:`, createErr)
              // Keep raw as configured rather than deleting the user's config
              return raw
            }
          }
        } catch (readErr) {
          console.warn(`[Settings] Failed reading ${locFile}:`, readErr)
        }
      }
    }

    // 2. If no valid locator found, check if settings.json already exists in candidate or standard folders
    const potentialSettingsDirs: string[] = [
      ...candidateDirs,
      path.join(os.homedir(), 'Documents', 'Uni Desk'),
      path.join(os.homedir(), 'Documents', 'One Tap'),
      path.join(os.homedir(), 'Documents', 'DATABASE ONT'),
      path.join(os.homedir(), 'Desktop', 'DATABASE ONT'),
      path.join(os.homedir(), 'OneDrive', 'Desktop', 'DATABASE ONT'),
      path.join(os.homedir(), 'OneDrive', 'Documents', 'DATABASE ONT')
    ]

    for (const pDir of potentialSettingsDirs) {
      const candidateSettings = path.join(pDir, 'settings.json')
      if (fs.existsSync(candidateSettings)) {
        console.log(`[Settings] Discovered existing database/settings at: ${pDir}`)
        writeLocator(pDir)
        return pDir
      }
    }

    // 3. Check if client PC already installed the app earlier (profile or previous app data exists)
    const hasPreviousInstallation = candidateDirs.some(dir => {
      if (!fs.existsSync(dir)) return false
      const files = fs.readdirSync(dir)
      return files.some(f => f.includes('ai_profile') || f.includes('settings') || f.endsWith('.db') || f.endsWith('.log'))
    })

    if (hasPreviousInstallation) {
      // Client already installed earlier — automatically assign standard storage without prompting
      const autoDir = path.join(os.homedir(), 'Documents', 'Uni Desk')
      try {
        fs.mkdirSync(autoDir, { recursive: true })
        writeLocator(autoDir)
        console.log(`[Settings] Existing installation detected. Auto-assigned storage to: ${autoDir}`)
        return autoDir
      } catch {
        const fallbackDir = PRIMARY_LOCATOR_DIR
        fs.mkdirSync(fallbackDir, { recursive: true })
        writeLocator(fallbackDir)
        return fallbackDir
      }
    }

    return null
  } catch (e) {
    console.error('[Settings] Error resolving locator:', e)
    return null
  }
}

function writeLocator(folder: string): void {
  try {
    const candidateDirs = getCandidateAppDirs()
    for (const dir of candidateDirs) {
      try {
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, 'settings_location.ini'), folder, 'utf-8')
      } catch {}
    }
  } catch (e) {
    console.error(`[Settings] Could not write locator: ${e}`)
  }
}

function loadFromFile(): void {
  try {
    if (fs.existsSync(_settingsFile)) {
      const raw = fs.readFileSync(_settingsFile, 'utf-8')
      const saved = JSON.parse(raw)
      
      // Auto-migrate legacy light theme to premium adobe dark theme
      if (saved && saved.app_theme === 'light') {
        saved.app_theme = 'adobe'
      }
      
      _store = { ...DEFAULTS, ...saved }
    } else {
      // External drive disconnected or missing! Fall back to permanent Documents backup
      const backupFile = path.join(os.homedir(), 'Documents', 'Uni Desk Data', 'settings.json')
      if (fs.existsSync(backupFile)) {
        try {
          const rawBackup = fs.readFileSync(backupFile, 'utf-8')
          const savedBackup = JSON.parse(rawBackup)
          _store = { ...DEFAULTS, ...savedBackup }
          console.log('[Settings] Primary settings drive offline; successfully restored state from permanent Documents backup.')
          return
        } catch {}
      }
      _store = { ...DEFAULTS }
      return // Do not overwrite with defaults when drive is missing
    }
  } catch {
    _store = { ...DEFAULTS }
  }
  save()
}

let _saveDebounceTimer: NodeJS.Timeout | null = null
let _isSaving = false
let _savePending = false

export function flushSaveSync(): void {
  if (_saveDebounceTimer) {
    clearTimeout(_saveDebounceTimer)
    _saveDebounceTimer = null
  }
  try {
    const dir = path.dirname(_settingsFile)
    fs.mkdirSync(dir, { recursive: true })
    const serialized = JSON.stringify(_store, null, 2)
    fs.writeFileSync(_settingsFile, serialized, 'utf-8')

    try {
      const backupDir = path.join(os.homedir(), 'Documents', 'Uni Desk Data')
      fs.mkdirSync(backupDir, { recursive: true })
      fs.writeFileSync(path.join(backupDir, 'settings.json'), serialized, 'utf-8')
      fs.writeFileSync(path.join(backupDir, 'settings_location.ini'), dir, 'utf-8')
    } catch {}
  } catch (e) {
    console.error(`[Settings] Could not save synchronously: ${e}`)
  }
}

async function performAsyncSave(): Promise<void> {
  if (_isSaving) {
    _savePending = true
    return
  }
  _isSaving = true
  try {
    const dir = path.dirname(_settingsFile)
    await fs.promises.mkdir(dir, { recursive: true })
    const serialized = JSON.stringify(_store, null, 2)
    await fs.promises.writeFile(_settingsFile, serialized, 'utf-8')

    try {
      const backupDir = path.join(os.homedir(), 'Documents', 'Uni Desk Data')
      await fs.promises.mkdir(backupDir, { recursive: true })
      await fs.promises.writeFile(path.join(backupDir, 'settings.json'), serialized, 'utf-8')
      await fs.promises.writeFile(path.join(backupDir, 'settings_location.ini'), dir, 'utf-8')
    } catch {}
  } catch (e) {
    console.error(`[Settings] Async save failed: ${e}`)
  } finally {
    _isSaving = false
    if (_savePending) {
      _savePending = false
      performAsyncSave().catch(() => {})
    }
  }
}

function save(immediate = false): void {
  if (immediate) {
    flushSaveSync()
    return
  }
  if (_saveDebounceTimer) {
    clearTimeout(_saveDebounceTimer)
  }
  _saveDebounceTimer = setTimeout(() => {
    _saveDebounceTimer = null
    performAsyncSave().catch(() => {})
  }, 100)
}

// ── Public lifecycle API ─────────────────────────────────────
export function initSettings(): void {
  const folder = readLocator()
  if (!folder) {
    // Check permanent documents backup (for Microsoft Store re-installation preservation)
    const backupDir = path.join(os.homedir(), 'Documents', 'Uni Desk Data')
    const permanentBackupFile = path.join(backupDir, 'settings.json')
    if (fs.existsSync(permanentBackupFile)) {
      try {
        const raw = fs.readFileSync(permanentBackupFile, 'utf-8')
        const restored = JSON.parse(raw)
        if (restored && typeof restored === 'object') {
          console.log('[Settings] Auto-restoring user data from permanent backup (Microsoft Store reinstall preservation)')
          writeLocator(backupDir)
          _settingsFile = permanentBackupFile
          _needsSetup = false
          _store = { ...DEFAULTS, ...restored }
          save()
          return
        }
      } catch (err) {
        console.warn('[Settings] Error checking permanent backup:', err)
      }
    }
    _needsSetup = true
    _settingsFile = path.join(PRIMARY_LOCATOR_DIR, 'settings.json')
    _store = { ...DEFAULTS }
    return
  }
  _settingsFile = path.join(folder, 'settings.json')
  _needsSetup = false
  loadFromFile()
}

export function needsSetup(): boolean {
  return _needsSetup
}

export function completeSetup(folder: string): void {
  fs.mkdirSync(folder, { recursive: true })
  writeLocator(folder)
  _settingsFile = path.join(folder, 'settings.json')
  _needsSetup = false
  _store = { ...DEFAULTS }
  save()
}

export function changeSettingsFolder(newFolder: string): void {
  const newFile = path.join(newFolder, 'settings.json')
  try {
    fs.mkdirSync(newFolder, { recursive: true })
    if (fs.existsSync(_settingsFile) && _settingsFile !== newFile) {
      fs.copyFileSync(_settingsFile, newFile)
    }
  } catch (e) {
    console.error(`[Settings] Could not copy to new folder: ${e}`)
    return
  }

  writeLocator(newFolder)
  _settingsFile = newFile
  loadFromFile()
}

export function setSettingsFilePath(filePath: string): void {
  try {
    const folder = path.dirname(filePath)
    fs.mkdirSync(folder, { recursive: true })
    writeLocator(folder)
    _settingsFile = filePath
    loadFromFile()
  } catch (e) {
    console.error(`[Settings] Could not set custom settings file path: ${e}`)
  }
}

// ── Public read/write API ─────────────────────────────────────
export function get(key: string, defaultVal?: unknown): unknown {
  if (key in _store) return _store[key]
  if (key in DEFAULTS) return DEFAULTS[key]
  return defaultVal ?? null
}

export function set(key: string, value: unknown): void {
  _store[key] = value
}

export function setAndSave(key: string, value: unknown): void {
  _store[key] = value
  save()
}

export function getAll(): Record<string, unknown> {
  return { ..._store }
}

export function getSettingsFilePath(): string {
  return _settingsFile
}

export function getSettingsFolder(): string {
  return path.dirname(_settingsFile)
}

export function resetSection(keys: string[]): void {
  for (const k of keys) {
    if (k in DEFAULTS) _store[k] = DEFAULTS[k]
  }
  save()
}

export function resetAll(): void {
  _store = { ...DEFAULTS }
  save()
}

export function isConfirmationDisabled(actionId: string): boolean {
  const map = (_store.confirmations_disabled ?? {}) as Record<string, boolean>
  return map[actionId] === true
}

export function disableConfirmation(actionId: string): void {
  const map = ((_store.confirmations_disabled ?? {}) as Record<string, boolean>)
  map[actionId] = true
  _store.confirmations_disabled = map
  save()
}
