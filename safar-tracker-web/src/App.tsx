import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  Archive,
  Bell,
  CalendarDays,
  ChevronDown,
  Cloud,
  Film,
  LayoutDashboard,
  ListFilter,
  Menu,
  MoreHorizontal,
  Search,
  Settings2,
  Users,
  UserRound,
  ArrowUpRight,
  RotateCcw,
  X,
  Kanban,
  Camera,
  LogIn,
  LogOut,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Clock,
  Mail,
  Share2,
  Smartphone,
  Download,
  MessageCircle,
  Image as ImageIcon,
  Award,
  Globe,
  Building2,
  FileText,
  Sparkles,
  BarChart3
} from 'lucide-react'
import OngoingSafarKanban, { type SafarTaskItem, isJunkSafarName } from './components/OngoingSafarKanban'
import PhotoTracker from './components/PhotoTracker'
import EmailLoginModal from './components/EmailLoginModal'
import StandaloneWidgetView from './components/StandaloneWidgetView'
import SafarBriefingView from './components/SafarBriefingView'
import WorkstationStatsView from './components/WorkstationStatsView'
import AppLoader from './components/AppLoader'
import WhatsAppBriefingModal from './components/WhatsAppBriefingModal'
import {
  sendWhatsAppAlert,
  getStoredAuthUser,
  clearStoredAuthUser,
  DEFAULT_WHATSAPP_PHONE,
  type AuthUser
} from './lib/googleAppsScript'

export type Stage = 'editing_pending' | 'editing' | 'upload_pending' | 'uploaded' | 'jameya'

export function normalizeStage(raw?: string): Stage {
  const s = String(raw || '').toLowerCase().trim()
  if (s === 'editing_pending' || s === 'pending') return 'editing_pending'
  if (s === 'editing' || s === 'in_progress' || s === 'in progress' || s === 'review') return 'editing'
  if (s === 'upload_pending' || s === 'rendering' || s === 'rendered') return 'upload_pending'
  if (s === 'uploaded' || s === 'upload') return 'uploaded'
  if (s === 'jameya' || s === 'submitted' || s === 'completed' || s === 'aljamea_done') return 'jameya'
  return 'editing_pending'
}
export type PhotoStage = 'edited' | 'given_to_murtaza' | 'uploaded'
export const DEFAULT_EDITOR = 'Murtaza'
export const DEFAULT_PHOTO_EDITOR = 'Muffadal Peti'
type View = 'dashboard' | 'ongoing' | 'photos' | 'tracker' | 'archive' | 'editors' | 'pipeline' | 'stats' | 'settings' | 'widget' | 'briefing'

const VIEW_PATHS: Record<View, string> = {
  dashboard: '/',
  ongoing: '/kanban',
  photos: '/photos',
  tracker: '/tracker',
  archive: '/archive',
  editors: '/editors',
  pipeline: '/pipeline',
  stats: '/stats',
  settings: '/settings',
  widget: '/widget',
  briefing: '/briefing'
}

function parseUrlRoute(): { view: View; safar?: string } {
  try {
    const rawPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/'
    const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '').replace(/\/+$/, '')
    const searchParams = new URLSearchParams(window.location.search)
    const safarParam = searchParams.get('safar') || undefined

    const candidate = hash || rawPath.replace(/^\//, '')

    if (candidate === 'briefing' || candidate === 'safar-briefing' || candidate === 'report') return { view: 'briefing', safar: safarParam }
    if (!candidate || candidate === 'dashboard' || candidate === 'home') return { view: 'dashboard', safar: safarParam }
    if (candidate === 'ongoing' || candidate === 'kanban' || candidate === 'pipeline-board') return { view: 'ongoing', safar: safarParam }
    if (candidate === 'photos' || candidate === 'photo-tracker' || candidate === 'drive') return { view: 'photos', safar: safarParam }
    if (candidate === 'tracker' || candidate === 'safars' || candidate === 'safar-tracker') return { view: 'tracker', safar: safarParam }
    if (candidate === 'archive' || candidate === 'archived') return { view: 'archive', safar: safarParam }
    if (candidate === 'editors' || candidate === 'team') return { view: 'editors', safar: safarParam }
    if (candidate === 'pipeline' || candidate === 'media') return { view: 'pipeline', safar: safarParam }
    if (candidate === 'stats' || candidate === 'telemetry' || candidate === 'app-stats') return { view: 'stats', safar: safarParam }
    if (candidate === 'settings') return { view: 'settings', safar: safarParam }
    if (candidate === 'widget' || candidate === 'home-widget' || candidate === 'live-widget') return { view: 'widget', safar: safarParam }
  } catch {}
  return { view: 'dashboard' }
}

export function getPublicWebsiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.startsWith('file:') && !origin.includes('::1')) {
      return origin
    }
  }
  return 'https://safar-tracker-web.vercel.app'
}
export type SafarTask = {
  id: string
  safarName: string
  dateFolder: string
  hijriDate: string
  stage: Stage
  dueDate: string
  editorName?: string
  photoStage?: PhotoStage
  photoEditorName?: string
  photoUploaded?: boolean
  updatedAt: string
  isPresent?: boolean
  isMissing?: boolean
  is_present?: boolean
  notes?: string
  comment?: string
}
type SafarSummary = {
  safarName: string
  safarYear?: string | number
  totalDays?: number
  isArchived?: boolean
  isDone?: boolean
  archivePriorStages?: Record<string, Stage>
  updatedAt?: string
}
type Snapshot = {
  tasks: SafarTask[]
  folders: string[]
  safars: SafarSummary[]
  stageOverrides?: Record<string, TaskStageOverride>
  deletedTasks?: string[]
  deletedSafars?: string[]
  updatedAt: string
  source?: string
}
type SafarGroup = SafarSummary & {
  tasks: SafarTask[]
  total: number
  completed: number
  percent: number
  deliveredPercent: number
  progressPercent: number
  deliveredCount: number
  photoUploadedCount: number
  photoPercent: number
  editingPendingCount: number
  editingCount: number
  uploadPendingCount: number
  uploadedCount: number
  jameyaCount: number
  // Backward compatibility aliases
  renderingCount: number
  uploadCount: number
  completedCount: number
}

export const STAGES: { id: Stage; label: string; short: string; color: string }[] = [
  { id: 'editing_pending', label: 'Editing Pending', short: 'EP', color: '#f59e0b' },
  { id: 'editing', label: 'In Progress', short: 'IP', color: '#3b82f6' },
  { id: 'upload_pending', label: 'Upload Pending', short: 'UP', color: '#06b6d4' },
  { id: 'uploaded', label: 'Uploaded', short: 'UL', color: '#10b981' },
  { id: 'jameya', label: 'AlJamea Done', short: 'AD', color: '#047857' }
]
const localKey = 'ot_safar_tracker_snapshot'
const deletedTasksKey = 'ot_safar_tracker_deleted_tasks'
const deletedSafarsKey = 'ot_safar_tracker_deleted_safars'
const stageOverridesKey = 'ot_safar_tracker_stage_overrides'

export type TaskStageOverride = {
  stage?: Stage
  editorName?: string
  dueDate?: string
  photoStage?: PhotoStage
  photoEditorName?: string
  photoUploaded?: boolean
  updatedAt: string
}

export function getStageOverrides(): Map<string, TaskStageOverride> {
  try {
    const val = localStorage.getItem(stageOverridesKey)
    if (val) {
      const obj = JSON.parse(val)
      return new Map(Object.entries(obj))
    }
  } catch {}
  return new Map()
}

export function saveStageOverrides(map: Map<string, TaskStageOverride>) {
  try {
    const obj = Object.fromEntries(map.entries())
    localStorage.setItem(stageOverridesKey, JSON.stringify(obj))
  } catch {}
}

export function getDeletedTasks(): Set<string> {
  try {
    const val = localStorage.getItem(deletedTasksKey)
    if (val) return new Set(JSON.parse(val))
  } catch {}
  return new Set()
}

export function saveDeletedTasks(set: Set<string>) {
  try {
    localStorage.setItem(deletedTasksKey, JSON.stringify(Array.from(set)))
  } catch {}
}

export function getDeletedSafars(): Set<string> {
  try {
    const val = localStorage.getItem(deletedSafarsKey)
    if (val) return new Set(JSON.parse(val))
  } catch {}
  return new Set()
}

export function saveDeletedSafars(set: Set<string>) {
  try {
    localStorage.setItem(deletedSafarsKey, JSON.stringify(Array.from(set)))
  } catch {}
}

export function isCameraOrAssetFolder(name: string): boolean {
  if (!name) return true
  const clean = name.trim().toLowerCase()
  if (!clean) return true

  // Camera angles, devices, cards
  if (/^(?:cam|camera|cams|angle|device)[\s._\-]*(?:\d+|[a-z])?$/i.test(clean)) return true
  if (/^cam\b/i.test(clean) || /^camera\b/i.test(clean)) return true
  if (/\b(?:gopro|dji|drone|action[\s._-]?cam|insta360|osmo)\b/i.test(clean)) return true
  if (/^(?:card|sd[\s._-]?card|cfexpress|cfast|memory[\s._-]?card)[\s._-]*(?:[a-z]|\d+)?$/i.test(clean)) return true

  // Audio / Sound / Microphones
  if (/^(?:audio|mic|mics|sound|sound[\s._-]?recording|recorder|zoom|tascam|lav|lavalier|wireless|mixer|boom)[\s._\-]*(?:\d+)?$/i.test(clean)) return true
  if (/\b(?:audio|sound|recording)\b/i.test(clean) && !/\b(?:waaz|majlis|event)\b/i.test(clean)) return true

  // Raw assets, dumps, b-roll, footage
  if (/^(?:b[-_ ]?roll|broll|footage|raw|raw[\s._-]?footage|dumps?|dump[\s._-]?\d+|clips?|stills?|photos?|pictures?)$/i.test(clean)) return true

  // Render, outputs, export, project files, caches
  if (/^(?:renders?|rendering|preview|previews|proxies|proxy|final|final[\s._-]?titles|titles|dvd|outputs?|exports?|masters?)$/i.test(clean)) return true
  if (/^(?:projects?|prproj|premiere|cache|scratch|adobe[\s._-]?premiere[\s._-]?pro[\s._-]?auto[\s._-]?save|auto[\s._-]?save)$/i.test(clean)) return true
  if (/^(?:assets?|graphics?|music|sfx|fonts?|temps?|tmp|backups?|trash|old)$/i.test(clean)) return true

  // Placeholder or missing date strings
  if (/^(?:date[\s._-]*(?:not[\s._-]*provided|folder[\s._-]*unavailable)|date[\s._-]*folder|undefined|null)$/i.test(clean)) return true

  // System folders
  if (clean.startsWith('$') || clean.startsWith('.') || clean === 'system volume information') return true

  return false
}

export function isProperDateOrSessionFolder(name: string): boolean {
  if (!name || isCameraOrAssetFolder(name)) return false
  const clean = name.trim()

  // 1. Standard YYYY-MM-DD, YYYY.MM.DD, YYYY_MM_DD with optional session tag (e.g. "1448-05-08 _01M")
  if (/^\d{4}[\s._-]\d{1,2}[\s._-]\d{1,2}/.test(clean)) return true

  // 2. DD-MM-YYYY, DD.MM.YYYY, DD-MM-YY (e.g. "08-05-1448", "14-03-1448")
  if (/^\d{1,2}[\s._-]\d{1,2}[\s._-]\d{2,4}/.test(clean)) return true

  // 3. Day XX (e.g. "Day 01", "Day 1", "Day-02")
  if (/^day[\s._\-]?\d{1,3}/i.test(clean)) return true

  // 4. Pure numbered day folder: "01" .. "31"
  const numOnly = clean.match(/^(\d{1,2})$/)
  if (numOnly) {
    const d = parseInt(numOnly[1], 10)
    if (d >= 1 && d <= 31) return true
  }

  // 5. Numbered day with session / event or location: e.g. "01-Raipur-Waaz", "02-Bilaspur-Bethak", "01-Bhatapur-QMZ", "04-Takhatpur-QMZ", "01 Waaz", "01-Agra QMZ", "01 Agra QMZ"
  if (/^\d{1,2}[\s._-]+(?:[A-Za-z0-9\s._-]+[\s._-]+)?(?:waaz|majlis|isteqbal|misaaq|urs|ziyarat|event|session|bethak|qmz|ziyafat|qadam|milad|ashara|darees|namaz|sermon|aqiqa|nikah|fmb|sharaf|talaqqi|tahneeq|wada|idaraat|mafsuhiyat|zafaf|olda|bm|bq|bz|aq|id|if|ifs|ist|kgs|m|mf|misbah|mkb|mo|mq|mul|myn|mz|n|q|sh|sq|tjr|tq|tnq|tqn|wd|z|zo|oz)\b/i.test(clean)) return true
  if (/(?:waaz|majlis|isteqbal|bethak|qmz|ziyafat|qadam|namaz)[\s._-]+(?:day[\s._-]?)?\d{1,2}/i.test(clean)) return true

  // 6. Named religious or liturgical sessions containing standard session keywords
  if (/\b(?:waaz|majlis|isteqbal|misaaq|urs|ziyarat|bethak|qmz|ziyafat|qadam|milad|ashara|darees|namaz|sermon|aqiqa|nikah|fmb|sharaf|talaqqi|tahneeq|wada)\b/i.test(clean)) return true

  return false
}

export function extractCleanWebDate(name: string): string {
  if (!name || isCameraOrAssetFolder(name)) return ''
  const clean = name.trim()
  if (isCameraOrAssetFolder(clean)) return ''
  const sessionMatch = clean.match(/(_\d{2}[A-Za-z]|\s*_\d{2}|\s*Session\s*\d+|\s*Morning|\s*Evening|\s*Night)/i)
  const rawTag = sessionMatch ? sessionMatch[1].trim() : ''
  const sessionTag = rawTag.startsWith('_') ? rawTag : (rawTag ? ` ${rawTag}` : '')
  const ymdMatch = clean.match(/(?:^|[^\d])(\d{4})[\s._\-](\d{1,2})[\s._\-](\d{1,2})(?:[^\d]|$)/i)
  if (ymdMatch) return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}${sessionTag}`
  const dmyMatch = clean.match(/(?:^|[^\d])(\d{1,2})[\s._\-](\d{1,2})[\s._\-](\d{4})(?:[^\d]|$)/i)
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}${sessionTag}`
  const dayMatch = clean.match(/day[\s._\-]?(\d{1,3})/i)
  if (dayMatch) { const d = parseInt(dayMatch[1], 10); return `Day ${d < 10 ? '0' + d : d}` }
  const leadingNumMatch = clean.match(/^(\d{1,2})(?:[\s._\-]+.*)?$/)
  if (leadingNumMatch) {
    const d = parseInt(leadingNumMatch[1], 10)
    if (d >= 1 && d <= 31) {
      if (/^\d{1,2}$/.test(clean)) return `Day ${d < 10 ? '0' + d : d}`
      if (isProperDateOrSessionFolder(clean)) return clean
    }
  }
  const dmMatch = clean.match(/^(\d{1,2})[\s._\-](\d{1,2})(?:[\s._\-]+.*)?$/)
  if (dmMatch) {
    const d = parseInt(dmMatch[1], 10)
    const m = parseInt(dmMatch[2], 10)
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return `Day ${d < 10 ? '0' + d : d}`
  }
  if (isProperDateOrSessionFolder(clean)) {
    return clean
  }
  return ''
}

export function getTaskKey(safarName?: string, dateFolder?: string): string {
  const s = String(safarName || '').trim().toLowerCase()
  const rawParts = String(dateFolder || '').trim().split(/[\\/]+/).filter(Boolean)
  const lastPart = rawParts[rawParts.length - 1] || ''
  const clean = extractCleanWebDate(lastPart) || lastPart
  const d = clean.toLowerCase().replace(/[\s_\-]/g, '')
  return `${s}::${d}`
}
const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', 'Sha’ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi’dah', 'Dhu al-Hijjah']

function hijriYearLabel(year?: string | number): string {
  const clean = String(year || '').replace(/\s*(?:AH|H)$/i, '').trim()
  return clean ? `${clean} H` : ''
}

function dateLabel(dateFolder: string, supplied?: string, safarYear?: string | number): string {
  if (supplied?.trim() && !/[\\/]/.test(supplied) && !/\.[a-z\d]{2,6}$/i.test(supplied.trim())) return supplied.trim()
  const folderDay = dateFolder.match(/Day[_ -]?(\d{1,2})/i)?.[1]
  const calendar = dateFolder.match(/(\d{4})[-_](\d{1,2})[-_](\d{1,2})/)
  const year = String(calendar?.[1] || safarYear || '').replace(/\s*(?:AH|H)$/i, '').trim()
  if (folderDay) return `${Number(folderDay)} Safar ${year}${year ? ' H' : ''}`
  if (calendar) {
    const month = HIJRI_MONTHS[Number(calendar[2]) - 1]
    if (month) return `${Number(calendar[3])} ${month} ${calendar[1]} H`
  }
  const dayOnly = dateFolder.match(/^\s*(?:Day[_ -]?)?(\d{1,2})\s*$/i)?.[1]
  return dayOnly ? `Day ${Number(dayOnly)}` : 'Date not provided'
}

function dateFolderName(task: Partial<SafarTask>): string {
  const parts = String(task.dateFolder || '').trim().split(/[\\/]+/).filter(Boolean)
  const folder = parts[parts.length - 1] || ''
  if (!folder || isCameraOrAssetFolder(folder) || !isProperDateOrSessionFolder(folder)) {
    return 'Date folder unavailable'
  }
  const cleanDate = extractCleanWebDate(folder)
  if (cleanDate && !isCameraOrAssetFolder(cleanDate) && isProperDateOrSessionFolder(cleanDate)) return cleanDate
  return 'Date folder unavailable'
}

function isJunkSafarOrHardware(name: string): boolean {
  const s = String(name || '').trim().toLowerCase()
  if (!s) return true
  if (/^(?:intelvga|dptf|mei|realtek|nvidia|amd|driver|drivers|windows|system|\$recycle\.bin)/i.test(s)) return true
  if (s.includes('intel') || s.includes('dptf') || s.includes('mei') || s.includes('driver')) return true
  const rootKey = s.replace(/[\s_-]+/g, ' ')
  if (['in process', 'to upload', 'to delete', 'uploaded data', 'uploaded', 'upload', 'pending', 'safars', 'safar', 'working safar', 'working', 'client', 'clients', 'final', 'output', 'export'].includes(rootKey)) return true
  return false
}

function normalizeSnapshot(value: Partial<Snapshot> | null | undefined): Snapshot {
  const deletedSafars = getDeletedSafars()
  const deletedTasks = getDeletedTasks()
  const overrides = getStageOverrides()

  if ((value as any)?.stageOverrides && typeof (value as any).stageOverrides === 'object') {
    for (const [k, v] of Object.entries((value as any).stageOverrides)) {
      if (v && typeof v === 'object') overrides.set(k, v as TaskStageOverride)
    }
    saveStageOverrides(overrides)
  }
  if (Array.isArray(value?.deletedSafars)) {
    for (const s of value.deletedSafars) if (s) deletedSafars.add(String(s).trim().toLowerCase())
    saveDeletedSafars(deletedSafars)
  }
  if (Array.isArray(value?.deletedTasks)) {
    for (const t of value.deletedTasks) if (t) deletedTasks.add(String(t).trim().toLowerCase())
    saveDeletedTasks(deletedTasks)
  }

  const safars = (Array.isArray(value?.safars) ? value.safars : [])
    .filter(safar => {
      const name = String(safar?.safarName || '').trim()
      if (!name || isJunkSafarOrHardware(name)) return false
      if (deletedSafars.has(name.toLowerCase())) return false
      return true
    })
    .map(safar => ({
      safarName: String(safar.safarName),
      safarYear: safar.safarYear,
      totalDays: Number(safar.totalDays) || 0,
      isArchived: Boolean(safar.isArchived),
      isDone: Boolean(safar.isDone),
      archivePriorStages: safar.archivePriorStages,
      updatedAt: safar.updatedAt
    }))
  const yearByName = new Map(safars.map(safar => [safar.safarName, safar.safarYear]))

  const rawTasks = (Array.isArray(value?.tasks) ? value.tasks : [])
    .filter((raw: any) => {
      const safarName = String(raw?.safarName || '').trim()
      if (!safarName || isJunkSafarOrHardware(safarName)) return false
      if (deletedSafars.has(safarName.toLowerCase())) return false
      const rawFolder = String(raw?.dateFolder || '').trim()
      if (!rawFolder || isCameraOrAssetFolder(rawFolder) || !isProperDateOrSessionFolder(rawFolder)) return false
      const taskKey = getTaskKey(safarName, rawFolder)
      if (deletedTasks.has(taskKey)) return false
      return true
    })
    .map((raw: any, index): SafarTask => {
      const dateFolder = dateFolderName({ dateFolder: String(raw.dateFolder || '') })
      const safarName = String(raw.safarName || '')
      const taskKey = getTaskKey(safarName, dateFolder)
      const override = overrides.get(taskKey)
      const isMissing = raw.isMissing ?? (raw.isPresent === false || raw.is_present === false)
      const isPresent = !isMissing
      // User rule: non-present items must ONLY and ONLY appear in AlJamea Done!
      const defaultStage: Stage = isMissing ? 'jameya' : normalizeStage(raw.stage)
      const stage: Stage = override?.stage ? normalizeStage(override.stage) : defaultStage
      const editorName = override?.editorName !== undefined ? override.editorName : (raw.editorName?.trim() || DEFAULT_EDITOR)
      const dueDate = override?.dueDate !== undefined ? override.dueDate : String(raw.dueDate || '')
      const defaultPhotoStage: PhotoStage = (stage === 'uploaded' || stage === 'jameya' || (stage as any) === 'upload' || (stage as any) === 'completed' || raw.photoUploaded) ? 'uploaded' : (raw.photoStage || 'edited')
      const photoStage: PhotoStage = override?.photoStage || defaultPhotoStage
      const photoEditorName = override?.photoEditorName !== undefined ? override.photoEditorName : (raw.photoEditorName?.trim() || DEFAULT_PHOTO_EDITOR)
      const photoUploaded = Boolean(photoStage === 'uploaded' || override?.photoUploaded || raw.photoUploaded)
      return {
        id: String(raw.id || `${safarName}::${dateFolder}::${index}`),
        safarName,
        dateFolder,
        hijriDate: dateLabel(dateFolder, raw.hijriDate || raw.dateLabel, yearByName.get(safarName)),
        stage,
        editorName,
        dueDate,
        photoStage,
        photoEditorName,
        photoUploaded,
        updatedAt: String(override?.updatedAt || raw.updatedAt || value?.updatedAt || ''),
        isPresent,
        isMissing,
        is_present: isPresent
      }
    }).filter(task => {
      if (!task.safarName || !task.dateFolder || task.dateFolder === 'Date folder unavailable') return false
      if (isCameraOrAssetFolder(task.dateFolder) || !isProperDateOrSessionFolder(task.dateFolder)) return false
      const key = getTaskKey(task.safarName, task.dateFolder)
      if (deletedTasks.has(key)) return false
      return true
    })

  // Strict deduplication by normalized key: safarName + normalized date folder
  const seenKeys = new Map<string, SafarTask>()
  for (const t of rawTasks) {
    const key = getTaskKey(t.safarName, t.dateFolder)
    if (deletedTasks.has(key)) continue
    if (!seenKeys.has(key)) {
      seenKeys.set(key, t)
    } else {
      const existing = seenKeys.get(key)!
      const override = overrides.get(key)
      const stage = normalizeStage(override?.stage || t.stage || existing.stage)
      seenKeys.set(key, {
        ...existing,
        ...t,
        stage,
        editorName: override?.editorName ?? (t.editorName || existing.editorName || DEFAULT_EDITOR),
        dueDate: override?.dueDate ?? (t.dueDate || existing.dueDate || ''),
        photoStage: override?.photoStage ?? (t.photoStage || existing.photoStage || 'edited'),
        photoEditorName: override?.photoEditorName ?? (t.photoEditorName || existing.photoEditorName || DEFAULT_PHOTO_EDITOR),
        photoUploaded: override?.photoUploaded ?? (t.photoUploaded || existing.photoUploaded || false)
      })
    }
  }
  const tasks = Array.from(seenKeys.values())

  return {
    tasks,
    folders: [...new Set(tasks.map(task => task.dateFolder))],
    safars,
    deletedTasks: Array.from(deletedTasks),
    deletedSafars: Array.from(deletedSafars),
    updatedAt: String(value?.updatedAt || ''),
    source: value?.source
  }
}

const env = (import.meta as any).env
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://dubscvthmkgkeiqdladp.supabase.co'
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || 'sb_publishable_kYApNvq2_6HAfNwJb8hW1g_7iLMSVyk'
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true } })

export const SAMPLE_STUDIO_SNAPSHOT: Snapshot = {
  safars: [
    {
      safarName: '1447-06 Safar Mubaraka - Mumbai',
      safarYear: '1447',
      totalDays: 8,
      isArchived: false,
      isDone: false,
      updatedAt: new Date().toISOString()
    },
    {
      safarName: '1447-07 Safar Mubaraka - Surat',
      safarYear: '1447',
      totalDays: 5,
      isArchived: false,
      isDone: false,
      updatedAt: new Date().toISOString()
    },
    {
      safarName: '1447-05 Safar Mubaraka - Colombo',
      safarYear: '1447',
      totalDays: 4,
      isArchived: false,
      isDone: true,
      updatedAt: new Date().toISOString()
    }
  ],
  folders: [
    '1447-06-01 _01M Waaz Mubaraka',
    '1447-06-02 _02M Majlis Hasanat',
    '1447-06-03 _03M Isteqbal & QMZ',
    '1447-06-04 _04M Ziyarat Tour',
    '1447-06-05 _05M Darees & Bethak',
    '1447-06-06 _06M Milaad Majlis',
    '1447-06-07 _07M Qadam Mubarak',
    '1447-06-08 _08M Wada Majlis',
    '1447-07-01 _01M Isteqbal Mawla',
    '1447-07-02 _02M Waaz Day 01',
    '1447-07-03 _03M Ziyafat & QMZ',
    '1447-07-04 _04M Waaz Day 02',
    '1447-07-05 _05M Wada & Review',
    '1447-05-01 _01M Waaz Colombo 01',
    '1447-05-02 _02M Waaz Colombo 02',
    '1447-05-03 _03M Milad Colombo',
    '1447-05-04 _04M Wada Colombo'
  ],
  tasks: [
    {
      id: 'sample-mb-1',
      safarName: '1447-06 Safar Mubaraka - Mumbai',
      dateFolder: '1447-06-01 _01M Waaz Mubaraka',
      hijriDate: '1447-06-01',
      stage: 'jameya',
      dueDate: '2026-11-14',
      editorName: 'Murtaza',
      photoStage: 'uploaded',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-mb-2',
      safarName: '1447-06 Safar Mubaraka - Mumbai',
      dateFolder: '1447-06-02 _02M Majlis Hasanat',
      hijriDate: '1447-06-02',
      stage: 'jameya',
      dueDate: '2026-11-15',
      editorName: 'Murtaza',
      photoStage: 'uploaded',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-mb-3',
      safarName: '1447-06 Safar Mubaraka - Mumbai',
      dateFolder: '1447-06-03 _03M Isteqbal & QMZ',
      hijriDate: '1447-06-03',
      stage: 'uploaded',
      dueDate: '2026-11-16',
      editorName: 'Murtaza',
      photoStage: 'uploaded',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-mb-4',
      safarName: '1447-06 Safar Mubaraka - Mumbai',
      dateFolder: '1447-06-04 _04M Ziyarat Tour',
      hijriDate: '1447-06-04',
      stage: 'uploaded',
      dueDate: '2026-11-17',
      editorName: 'Murtaza',
      photoStage: 'given_to_murtaza',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: false,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-mb-5',
      safarName: '1447-06 Safar Mubaraka - Mumbai',
      dateFolder: '1447-06-05 _05M Darees & Bethak',
      hijriDate: '1447-06-05',
      stage: 'upload_pending',
      dueDate: '2026-11-18',
      editorName: 'Mustafa',
      photoStage: 'given_to_murtaza',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: false,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-mb-6',
      safarName: '1447-06 Safar Mubaraka - Mumbai',
      dateFolder: '1447-06-06 _06M Milaad Majlis',
      hijriDate: '1447-06-06',
      stage: 'editing',
      dueDate: '2026-11-19',
      editorName: 'Mustafa',
      photoStage: 'edited',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: false,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-mb-7',
      safarName: '1447-06 Safar Mubaraka - Mumbai',
      dateFolder: '1447-06-07 _07M Qadam Mubarak',
      hijriDate: '1447-06-07',
      stage: 'editing',
      dueDate: '2026-11-20',
      editorName: 'Husain',
      photoStage: 'edited',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: false,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-mb-8',
      safarName: '1447-06 Safar Mubaraka - Mumbai',
      dateFolder: '1447-06-08 _08M Wada Majlis',
      hijriDate: '1447-06-08',
      stage: 'editing_pending',
      dueDate: '2026-11-21',
      editorName: 'Husain',
      photoStage: 'edited',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: false,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-st-1',
      safarName: '1447-07 Safar Mubaraka - Surat',
      dateFolder: '1447-07-01 _01M Isteqbal Mawla',
      hijriDate: '1447-07-01',
      stage: 'uploaded',
      dueDate: '2026-11-22',
      editorName: 'Murtaza',
      photoStage: 'uploaded',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-st-2',
      safarName: '1447-07 Safar Mubaraka - Surat',
      dateFolder: '1447-07-02 _02M Waaz Day 01',
      hijriDate: '1447-07-02',
      stage: 'upload_pending',
      dueDate: '2026-11-23',
      editorName: 'Mustafa',
      photoStage: 'given_to_murtaza',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: false,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-st-3',
      safarName: '1447-07 Safar Mubaraka - Surat',
      dateFolder: '1447-07-03 _03M Ziyafat & QMZ',
      hijriDate: '1447-07-03',
      stage: 'editing',
      dueDate: '2026-11-24',
      editorName: 'Murtaza',
      photoStage: 'edited',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: false,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-st-4',
      safarName: '1447-07 Safar Mubaraka - Surat',
      dateFolder: '1447-07-04 _04M Waaz Day 02',
      hijriDate: '1447-07-04',
      stage: 'editing_pending',
      dueDate: '2026-11-25',
      editorName: 'Husain',
      photoStage: 'edited',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: false,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-st-5',
      safarName: '1447-07 Safar Mubaraka - Surat',
      dateFolder: '1447-07-05 _05M Wada & Review',
      hijriDate: '1447-07-05',
      stage: 'editing_pending',
      dueDate: '2026-11-26',
      editorName: 'Husain',
      photoStage: 'edited',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: false,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-cb-1',
      safarName: '1447-05 Safar Mubaraka - Colombo',
      dateFolder: '1447-05-01 _01M Waaz Colombo 01',
      hijriDate: '1447-05-01',
      stage: 'jameya',
      dueDate: '2026-11-01',
      editorName: 'Murtaza',
      photoStage: 'uploaded',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-cb-2',
      safarName: '1447-05 Safar Mubaraka - Colombo',
      dateFolder: '1447-05-02 _02M Waaz Colombo 02',
      hijriDate: '1447-05-02',
      stage: 'jameya',
      dueDate: '2026-11-02',
      editorName: 'Murtaza',
      photoStage: 'uploaded',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-cb-3',
      safarName: '1447-05 Safar Mubaraka - Colombo',
      dateFolder: '1447-05-03 _03M Milad Colombo',
      hijriDate: '1447-05-03',
      stage: 'jameya',
      dueDate: '2026-11-03',
      editorName: 'Mustafa',
      photoStage: 'uploaded',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sample-cb-4',
      safarName: '1447-05 Safar Mubaraka - Colombo',
      dateFolder: '1447-05-04 _04M Wada Colombo',
      hijriDate: '1447-05-04',
      stage: 'jameya',
      dueDate: '2026-11-04',
      editorName: 'Husain',
      photoStage: 'uploaded',
      photoEditorName: 'Muffadal Peti',
      photoUploaded: true,
      updatedAt: new Date().toISOString()
    }
  ],
  updatedAt: new Date().toISOString(),
  source: 'sample'
}

function readLocal(): Snapshot {
  try {
    const value = localStorage.getItem(localKey)
    if (value) {
      const parsed = JSON.parse(value) as Partial<Snapshot>
      if (parsed && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        return normalizeSnapshot(parsed)
      }
      if (parsed && parsed.source === 'empty') {
        return { tasks: [], folders: [], safars: [], updatedAt: '', source: 'empty' }
      }
    }
  } catch {}
  return normalizeSnapshot(SAMPLE_STUDIO_SNAPSHOT)
}

export function AnimatedNumber({ value, duration = 650 }: { value: number; duration?: number }): JSX.Element {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(value)

  useEffect(() => {
    const startValue = prevValueRef.current
    const endValue = value
    prevValueRef.current = value

    if (startValue === endValue) {
      setDisplayValue(endValue)
      return
    }

    const startTime = performance.now()
    let frameId: number

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Smooth cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startValue + (endValue - startValue) * ease)
      setDisplayValue(current)

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(endValue)
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [value, duration])

  return <span className="tabular-num-anim" style={{ fontVariantNumeric: 'tabular-nums' }}>{displayValue}</span>
}

function EditorAssignment({ value, label, onSave }: { value: string; label: string; onSave: (value: string) => void }): JSX.Element {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return <input className="editor-input" aria-label={label} value={draft} placeholder={`Assign editor (${DEFAULT_EDITOR})`} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(value); event.currentTarget.blur() } }} onBlur={() => { if (draft.trim() !== value) onSave(draft.trim() || DEFAULT_EDITOR) }} />
}

function SafarLoadingSkeleton({ variant }: { variant: 'dashboard' | 'tracker' | 'kanban' }): JSX.Element {
  return <section className={`safar-loading-skeleton ${variant}`} role="status" aria-label="Loading Safar production data" aria-busy="true">
    <span className="visually-hidden">Loading your Safar folders and progress…</span>
    {variant === 'dashboard' ? <>
      <div className="skeleton-section-heading"><i/><i/></div>
      <div className="skeleton-dashboard-grid">{[0, 1, 2].map(item => <div className="skeleton-card" key={item} aria-hidden="true">
        <div className="skeleton-title-row"><i/><i/></div><i className="skeleton-progress"/><i className="skeleton-copy"/><i className="skeleton-date"/><i className="skeleton-date short"/>
      </div>)}</div>
    </> : variant === 'kanban' ? (
      <div className="skeleton-kanban-grid">
        {[0, 1, 2, 3].map(col => (
          <div key={col} className="skeleton-kanban-col">
            <div className="skeleton-kanban-head">
              <div className="skeleton-shimmer" style={{ width: '130px', height: '18px' }} />
              <div className="skeleton-shimmer" style={{ width: '28px', height: '18px', borderRadius: '12px' }} />
            </div>
            {[0, 1, 2].map(card => (
              <div key={card} className="skeleton-kanban-item">
                <div className="skeleton-shimmer" style={{ width: '75%', height: '16px' }} />
                <div className="skeleton-shimmer" style={{ width: '45%', height: '12px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                  <div className="skeleton-shimmer" style={{ width: '35%', height: '10px' }} />
                  <div className="skeleton-shimmer" style={{ width: '22%', height: '10px' }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    ) : <div className="skeleton-tracker-list" aria-hidden="true">{[0, 1, 2].map(item => <div className="skeleton-card" key={item}>
      <div className="skeleton-title-row"><i/><i/></div><i className="skeleton-progress"/><i className="skeleton-copy"/>
    </div>)}</div>}
    <p className="skeleton-status-copy">Getting your Safar folders ready…</p>
  </section>
}

function SafarProductionGroup({ group, expanded, onToggle, onArchive, onUpdateTask, onDelete, onRemoveTask }: {
  group: SafarGroup
  expanded: boolean
  onToggle: () => void
  onArchive: (isArchived: boolean) => void
  onUpdateTask: (task: SafarTask, changes: Partial<SafarTask>) => void
  onDelete?: (safarName: string) => void
  onRemoveTask?: (task: SafarTask) => void
}): JSX.Element {
  const year = hijriYearLabel(group.safarYear)
  const total = Math.max(group.total, group.tasks.length, 1)
  const editingPendingPct = (group.editingPendingCount / total) * 100
  const editingPct = (group.editingCount / total) * 100
  const uploadPendingPct = (group.uploadPendingCount / total) * 100
  const uploadedPct = (group.uploadedCount / total) * 100
  const jameyaPct = (group.jameyaCount / total) * 100

  return <article className="panel safar-group-card">
    <div className="safar-group-header">
      <button type="button" className="safar-group-toggle" aria-expanded={expanded} onClick={onToggle}>
        <span className="safar-group-heading"><strong>{group.safarName}</strong><small>{year}{year && ' · '}{group.total} {group.total === 1 ? 'date' : 'dates'}</small></span>
        <div className="safar-group-progress-wrap">
          <div className="safar-group-progress-info">
            <strong><AnimatedNumber value={group.percent} />%</strong>
            <span><AnimatedNumber value={group.completed} /> of {group.total} completed</span>
          </div>
          <div className="multicolor-progress-bar mini" role="progressbar" aria-label={`${group.safarName} pipeline progress`}>
            {editingPendingPct > 0 && <span className="stage-segment stage-editing_pending" style={{ width: `${editingPendingPct}%` }} title={`Editing Pending: ${group.editingPendingCount}`} />}
            {editingPct > 0 && <span className="stage-segment stage-editing" style={{ width: `${editingPct}%` }} title={`In Progress: ${group.editingCount}`} />}
            {uploadPendingPct > 0 && <span className="stage-segment stage-upload_pending" style={{ width: `${uploadPendingPct}%` }} title={`Upload Pending: ${group.uploadPendingCount}`} />}
            {uploadedPct > 0 && <span className="stage-segment stage-uploaded" style={{ width: `${uploadedPct}%` }} title={`Uploaded: ${group.uploadedCount}`} />}
            {jameyaPct > 0 && <span className="stage-segment stage-jameya" style={{ width: `${jameyaPct}%` }} title={`AlJamea Done: ${group.jameyaCount}`} />}
          </div>
          <div className="multicolor-legend compact">
            <span className="legend-chip chip-editing_pending"><i className="chip-dot" /><AnimatedNumber value={group.editingPendingCount} /> EP</span>
            <span className="legend-chip chip-editing"><i className="chip-dot" /><AnimatedNumber value={group.editingCount} /> IP</span>
            <span className="legend-chip chip-upload_pending"><i className="chip-dot" /><AnimatedNumber value={group.uploadPendingCount} /> UP</span>
            <span className="legend-chip chip-uploaded"><i className="chip-dot" /><AnimatedNumber value={group.uploadedCount} /> UL</span>
            <span className="legend-chip chip-jameya"><i className="chip-dot" /><AnimatedNumber value={group.jameyaCount} /> AD</span>
          </div>
        </div>
        <ChevronDown aria-hidden="true" size={19} className={expanded ? 'expanded' : ''}/>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button type="button" className="button-secondary safar-archive-action" aria-label={`${group.isArchived ? 'Restore' : 'Archive'} ${group.safarName}`} onClick={() => onArchive(!group.isArchived)}>
          {group.isArchived ? <RotateCcw aria-hidden="true" size={16}/> : <Archive aria-hidden="true" size={16}/>}{group.isArchived ? 'Restore' : 'Archive'}
        </button>
        {onDelete && <button type="button" className="button-secondary" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)', padding: '6px 8px' }} aria-label={`Remove ${group.safarName}`} title={`Permanently remove ${group.safarName}`} onClick={() => onDelete(group.safarName)}><Trash2 aria-hidden="true" size={14}/></button>}
      </div>
    </div>
    {expanded && <div className="safar-date-list">
      <div className="safar-date-list-heading"><span>Date folder</span><span>Deliverables</span><span>Editor</span><span>Stage</span><span>Due date</span><span>Action</span></div>
      {group.tasks.length ? group.tasks.map(task => {
        const isPhotoUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded) || (task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed')
        const isVideoUp = task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed'
        return <div className="safar-date-row" key={task.id}>
          <span className="safar-date-value" title={dateFolderName(task)}>{dateFolderName(task)}</span>
          <div className="safar-edit-cell" data-label="Deliverables" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {isPhotoUp && isVideoUp ? (
              <span className="media-sync-badge both-uploaded" title="Both Photo & Video Uploaded">
                <CheckCircle2 size={11} /> Both Uploaded
              </span>
            ) : isPhotoUp && !isVideoUp ? (
              <span className="media-sync-badge photo-only" title="Photo Uploaded by Muffadal Peti · Video Pending">
                <Camera size={11} /> Photo Up · Video Pend
              </span>
            ) : !isPhotoUp && isVideoUp ? (
              <span className="media-sync-badge video-only" title="Video Uploaded by Murtaza · Photo Pending">
                <Film size={11} /> Video Up · Photo Pend
              </span>
            ) : (
              <span className="media-sync-badge both-pending" title="Both Photo & Video Pending Upload">
                <Clock size={11} /> Both Pending
              </span>
            )}
            <label title={isVideoUp && isPhotoUp ? 'Folder Uploaded across Photo & Video' : 'Click to mark Uploaded across both trackers'} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: (isVideoUp && isPhotoUp) ? '#059669' : '#64748b' }}>
              <input
                type="checkbox"
                checked={isVideoUp && isPhotoUp}
                onChange={e => {
                  const willUpload = e.target.checked
                  onUpdateTask(task, {
                    stage: willUpload ? 'uploaded' : 'editing_pending',
                    photoStage: willUpload ? 'uploaded' : 'edited',
                    photoUploaded: willUpload
                  })
                }}
              />
              <span>{isVideoUp && isPhotoUp ? 'Uploaded' : 'Upload'}</span>
            </label>
          </div>
          <div className="safar-edit-cell" data-label="Editor"><EditorAssignment label={`Editor assigned to ${dateFolderName(task)}`} value={task.editorName || ''} onSave={editorName => onUpdateTask(task, { editorName })}/></div>
          <div className="safar-edit-cell" data-label="Stage"><select aria-label={`Production stage for ${dateFolderName(task)}`} className={`stage-select stage-${task.stage}`} value={task.stage} onChange={event => onUpdateTask(task, { stage: event.target.value as Stage })}>{STAGES.map((stage, index) => <option key={stage.id} value={stage.id}>{index + 1}. {stage.label}</option>)}</select></div>
          <div className="safar-edit-cell" data-label="Due date"><input className="due-input" aria-label={`Due date for ${dateFolderName(task)}`} type="date" value={task.dueDate} onChange={event => onUpdateTask(task, { dueDate: event.target.value})}/></div>
          <div className="safar-edit-cell" data-label="Action">
          {onRemoveTask && (
            <button
              type="button"
              className="button-icon-subtle"
              title={`Exclude "${dateFolderName(task)}"`}
              onClick={() => {
                if (window.confirm(`Exclude "${dateFolderName(task)}" from tracking?`)) {
                  onRemoveTask(task)
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>}) : <p className="safar-empty-dates">No date folders match these filters.</p>}
    </div>}
  </article>
}

export default function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<Snapshot>(readLocal)
  const [initialLoading, setInitialLoading] = useState(false)
  const [showBootLoader, setShowBootLoader] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  const handleLoadSampleData = () => {
    const sample = normalizeSnapshot(SAMPLE_STUDIO_SNAPSHOT)
    setSnapshot(sample)
    try {
      localStorage.setItem(localKey, JSON.stringify(sample))
    } catch {}
    setNotice('Loaded sample studio production pipeline.')
  }

  const handleClearSampleData = () => {
    const empty: Snapshot = { tasks: [], folders: [], safars: [], updatedAt: new Date().toISOString(), source: 'empty' }
    setSnapshot(empty)
    try {
      localStorage.setItem(localKey, JSON.stringify(empty))
    } catch {}
    setNotice('Cleared sample data. Ready for One Tap workstation sync.')
  }

  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
  })
  const [pullProgress, setPullProgress] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pullProgressRef = useRef(0)
  const pullingRef = useRef(false)
  const startYRef = useRef(0)

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Touch pull-to-refresh for mobile PWA (Ref-based, zero re-render listener churn)
    const handleTouchStart = (e: TouchEvent) => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
      if (scrollY <= 1 && e.touches.length === 1) {
        startYRef.current = e.touches[0].clientY
        pullingRef.current = true
      } else {
        pullingRef.current = false
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current) return
      const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
      if (scrollY > 1) {
        pullingRef.current = false
        pullProgressRef.current = 0
        setPullProgress(0)
        return
      }
      const currentY = e.touches[0].clientY
      const diff = currentY - startYRef.current
      if (diff > 0) {
        // Elastic dampened tension feel
        const clamped = Math.min(diff * 0.42, 82)
        pullProgressRef.current = clamped
        setPullProgress(clamped)
      } else {
        pullingRef.current = false
        pullProgressRef.current = 0
        setPullProgress(0)
      }
    }

    const handleTouchEnd = () => {
      if (pullingRef.current && pullProgressRef.current >= 48) {
        setIsRefreshing(true)
        setPullProgress(60)
        try { if ('vibrate' in navigator) navigator.vibrate(15) } catch {}
        setNotice('⚡ Pull to refresh: Syncing latest Safar production data...')
        void requestDesktopSync().finally(() => {
          setTimeout(() => {
            setIsRefreshing(false)
            setPullProgress(0)
            pullProgressRef.current = 0
          }, 650)
        })
      } else {
        setPullProgress(0)
        pullProgressRef.current = 0
      }
      pullingRef.current = false
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  const handleInstallApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice?.outcome === 'accepted') {
        setIsStandalone(true)
        setNotice('✓ One Tap Tracker installed to your device home screen!')
      }
      setInstallPrompt(null)
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
      if (isIOS) {
        alert('To install on your iPhone / iPad:\n1. Tap the Share button at the bottom of Safari (square with arrow up ⎋)\n2. Scroll down and tap "Add to Home Screen" ⊕')
      } else {
        setNotice('To install: click the Install icon in your browser URL bar or browser menu.')
      }
    }
  }

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredAuthUser())

  const initialRoute = useMemo(() => parseUrlRoute(), [])
  const [search, setSearch] = useState('')
  const [selectedSafar, setSelectedSafar] = useState<string>(() => initialRoute.safar || 'all')
  const [filter, setFilter] = useState('all')
  const [safarStatusFilter, setSafarStatusFilter] = useState<'all' | 'pending' | 'in_process' | 'to_delete' | 'to_upload' | 'done'>('all')
  const [view, setView] = useState<View>(() => initialRoute.view)
  const [selectedEditor, setSelectedEditor] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const [connected, setConnected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [panelMenuOpen, setPanelMenuOpen] = useState(false)
  const [expandedSafars, setExpandedSafars] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(0)
  const [pipelineLimits, setPipelineLimits] = useState<Record<Stage, number>>({ editing_pending: 40, editing: 40, upload_pending: 40, uploaded: 40, jameya: 40 })

  const trackerChannelRef = useRef<any>(null)
  const nexusChannelRef = useRef<any>(null)
  const notifiedIdsRef = useRef<Set<string>>(new Set())
  const sidebarRef = useRef<HTMLElement>(null)
  const pageTitleRef = useRef<HTMLHeadingElement>(null)
  const saveCountRef = useRef(0)
  const snapshotRef = useRef(snapshot)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const sidebarCloseRef = useRef<HTMLButtonElement>(null)
  snapshotRef.current = snapshot

  const [showScriptableGuide, setShowScriptableGuide] = useState(false)
  const [briefingModalState, setBriefingModalState] = useState<{ safarName: string; initialTab: 'msg' | 'image' } | null>(null)

  // Clear legacy notification keys to avoid stale browser cache
  useEffect(() => {
    try {
      localStorage.removeItem('ot_email_notifications_config')
      localStorage.removeItem('ot_email_queue')
      localStorage.removeItem('email_modal_open')
    } catch {}
  }, [])

  // Dismiss luxury bootloader after brief animation
  useEffect(() => {
    const timer = window.setTimeout(() => setShowBootLoader(false), 800)
    return () => window.clearTimeout(timer)
  }, [])

  const safarGroups = useMemo<SafarGroup[]>(() => {
    const grouped = new Map<string, { summary: SafarSummary; tasks: SafarTask[] }>()
    for (const summary of snapshot.safars || []) {
      if (summary.safarName && !isJunkSafarName(summary.safarName)) grouped.set(summary.safarName, { summary, tasks: [] })
    }
    for (const task of snapshot.tasks) {
      if (isJunkSafarName(task.safarName)) continue
      if (!grouped.has(task.safarName)) grouped.set(task.safarName, { summary: { safarName: task.safarName }, tasks: [] })
      grouped.get(task.safarName)!.tasks.push(task)
    }
    return [...grouped.values()].map(({ summary, tasks }) => {
      tasks.sort((a, b) => a.dateFolder.localeCompare(b.dateFolder, undefined, { numeric: true }))
      const editingPendingCount = tasks.filter(task => task.stage === 'editing_pending').length
      const editingCount = tasks.filter(task => task.stage === 'editing').length
      const uploadPendingCount = tasks.filter(task => task.stage === 'upload_pending' || (task.stage as any) === 'rendering').length
      const uploadedCount = tasks.filter(task => task.stage === 'uploaded' || (task.stage as any) === 'upload').length
      const jameyaCount = tasks.filter(task => task.stage === 'jameya' || (task.stage as any) === 'completed' || (task.stage as any) === 'submitted').length
      const photoUploadedCount = tasks.filter(task => task.photoStage === 'uploaded' || task.photoUploaded).length
      const total = tasks.length > 0 ? tasks.length : (Number(summary.totalDays) || 0)
      const finishedDates = jameyaCount
      const isArchived = Boolean(summary.isArchived || (total > 0 && finishedDates >= total))
      const completed = isArchived ? total : finishedDates
      const rawDelivered = uploadedCount + jameyaCount
      const isAllUploaded = total > 0 && rawDelivered >= total
      const deliveredCount = (isArchived || isAllUploaded) ? total : rawDelivered
      const deliveredPercent = (isArchived || isAllUploaded) ? 100 : total ? Math.min(100, Math.round((deliveredCount / total) * 100)) : 0
      const progressPercent = (isArchived || isAllUploaded) ? 100 : total ? Math.min(100, Math.round(((editingPendingCount * 10 + editingCount * 35 + uploadPendingCount * 65 + uploadedCount * 90 + jameyaCount * 100) / total) / 100 * 100)) : 0
      const photoPercent = (isArchived || (total > 0 && photoUploadedCount >= total)) ? 100 : total ? Math.min(100, Math.round((photoUploadedCount / total) * 100)) : 0
      return {
        ...summary,
        isArchived,
        isDone: Boolean(summary.isDone || isArchived || isAllUploaded),
        tasks,
        total,
        completed,
        percent: deliveredPercent,
        deliveredPercent,
        progressPercent,
        deliveredCount,
        photoUploadedCount,
        photoPercent,
        editingPendingCount: isArchived ? 0 : editingPendingCount,
        editingCount: isArchived ? 0 : editingCount,
        uploadPendingCount: isArchived ? 0 : uploadPendingCount,
        uploadedCount: isArchived ? 0 : uploadedCount,
        jameyaCount: isArchived ? 0 : jameyaCount,
        renderingCount: isArchived ? 0 : uploadPendingCount,
        uploadCount: isArchived ? 0 : uploadedCount,
        completedCount: isArchived ? total : jameyaCount
      }
    }).sort((a, b) => a.safarName.localeCompare(b.safarName, undefined, { numeric: true }))
  }, [snapshot.safars, snapshot.tasks])

  const safars = useMemo(() => safarGroups.filter(group => !group.isArchived).map(group => group.safarName), [safarGroups])
  const searchTerm = search.trim().toLowerCase()
  const rows = useMemo(() => snapshot.tasks.filter(task =>
    !isJunkSafarName(task.safarName) &&
    (selectedSafar === 'all' || task.safarName === selectedSafar) &&
    (selectedEditor === 'all' || (task.editorName || DEFAULT_EDITOR) === selectedEditor) &&
    (filter === 'all' || task.stage === filter) &&
    `${task.safarName} ${task.dateFolder} ${task.hijriDate}`.toLowerCase().includes(searchTerm)
  ), [snapshot.tasks, selectedSafar, selectedEditor, filter, searchTerm])

  const editors = useMemo(() => {
    const set = new Set([DEFAULT_EDITOR, ...snapshot.tasks.map(task => task.editorName?.trim()).filter((name): name is string => Boolean(name))])
    return Array.from(set).sort()
  }, [snapshot.tasks])
  const tasksByEditor = useMemo(() => {
    const grouped = new Map<string, SafarTask[]>()
    for (const task of snapshot.tasks) {
      const ed = task.editorName?.trim() || DEFAULT_EDITOR
      const group = grouped.get(ed) || []
      group.push(task)
      grouped.set(ed, group)
    }
    return grouped
  }, [snapshot.tasks])

  const tasksByStage = useMemo(() => {
    const grouped = new Map<Stage, SafarTask[]>(STAGES.map(stage => [stage.id, []]))
    for (const task of rows) grouped.get(task.stage)?.push(task)
    return grouped
  }, [rows])

  const matchingSafarGroups = useMemo(() => {
    const rowIds = new Set(rows.map(task => task.id))
    return safarGroups.map(group => ({ ...group, tasks: group.tasks.filter(task => rowIds.has(task.id)) }))
  }, [rows, safarGroups])

  const activeSafarGroups = safarGroups.filter(group => !group.isArchived)
  const archiveSafarGroups = safarGroups.filter(group => group.isArchived)

  const [ongoingSafarName, setOngoingSafarName] = useState<string>(() => {
    try {
      return localStorage.getItem('onetap_ongoing_safar_name') || ''
    } catch {
      return ''
    }
  })

  const effectiveOngoingSafar = useMemo(() => {
    if (ongoingSafarName && activeSafarGroups.some(g => g.safarName === ongoingSafarName)) {
      return ongoingSafarName
    }
    return activeSafarGroups[0]?.safarName || ''
  }, [ongoingSafarName, activeSafarGroups])

  const handleSetOngoingSafar = (name: string) => {
    setOngoingSafarName(name)
    try {
      localStorage.setItem('onetap_ongoing_safar_name', name)
    } catch {}
    setNotice(`📍 Set "${name}" as the active Ongoing Safar for WhatsApp reports.`)
  }

  const studioStats = useMemo(() => {
    let totalDates = 0
    let editingPending = 0
    let editing = 0
    let uploadPending = 0
    let uploaded = 0
    let jameya = 0
    let photoUploaded = 0
    for (const g of activeSafarGroups) {
      totalDates += g.total
      editingPending += g.editingPendingCount
      editing += g.editingCount
      uploadPending += g.uploadPendingCount
      uploaded += g.uploadedCount
      jameya += g.jameyaCount
      photoUploaded += g.photoUploadedCount
    }
    const safarsDone = activeSafarGroups.filter(g => g.isArchived || (g.total > 0 && g.deliveredCount >= g.total)).length
    const deliveredDates = uploaded + jameya
    const isAllTotalDelivered = totalDates > 0 && deliveredDates >= totalDates
    const deliveredPercent = isAllTotalDelivered ? 100 : totalDates > 0 ? Math.min(100, Math.round((deliveredDates / totalDates) * 100)) : 0
    const progressPercent = isAllTotalDelivered ? 100 : totalDates > 0 ? Math.min(100, Math.round(((editingPending * 10 + editing * 35 + uploadPending * 65 + uploaded * 90 + jameya * 100) / totalDates) / 100 * 100)) : 0
    const photoPercent = totalDates > 0 ? (photoUploaded >= totalDates ? 100 : Math.min(100, Math.round((photoUploaded / totalDates) * 100))) : 0
    return {
      totalDates,
      editingPending,
      editing,
      uploadPending,
      uploaded,
      jameya,
      safarsDone,
      totalSafars: activeSafarGroups.length,
      deliveredDates,
      deliveredPercent,
      progressPercent,
      photoUploaded,
      photoPercent,
      percent: deliveredPercent,
      // Legacy aliases
      rendering: uploadPending,
      upload: uploaded,
      completed: jameya
    }
  }, [activeSafarGroups])

  const safarStatusBuckets = useMemo(() => {
    let safarPending = 0
    let inProcess = 0
    let toDelete = 0
    let toUpload = 0
    for (const s of activeSafarGroups) {
      const statuses = (s.tasks || []).map(t => t.stage)
      if (statuses.length === 0) continue
      const allPending = statuses.every(st => st === 'editing_pending')
      const anyEditing = statuses.some(st => st === 'editing' || st === 'upload_pending')
      const allJamea = statuses.every(st => st === 'jameya')
      const allToUpload = statuses.every(st => st === 'upload_pending' || st === 'uploaded')
      if (allPending) safarPending++
      if (anyEditing) inProcess++
      if (allJamea) toDelete++
      if (allToUpload) toUpload++
    }
    return {
      safarPending,
      inProcess,
      toDelete,
      toUpload,
      archived: archiveSafarGroups.length
    }
  }, [activeSafarGroups, archiveSafarGroups])
  const hasTaskFilters = Boolean(search.trim()) || filter !== 'all' || selectedEditor !== 'all'
  const visibleSafarGroups = matchingSafarGroups.filter(group => {
    if (view === 'archive') return group.isArchived
    if (group.isArchived) return false
    if (selectedSafar !== 'all' && group.safarName !== selectedSafar) return false
    if (hasTaskFilters && group.tasks.length === 0) return false

    if (safarStatusFilter !== 'all') {
      const origGroup = safarGroups.find(g => g.safarName === group.safarName)
      const tasks = origGroup?.tasks || []
      if (safarStatusFilter === 'pending') {
        const allPending = tasks.length > 0 && tasks.every(t => t.stage === 'editing_pending')
        if (!allPending) return false
      } else if (safarStatusFilter === 'in_process') {
        const anyEditing = tasks.some(t => t.stage === 'editing' || t.stage === 'upload_pending')
        if (!anyEditing) return false
      } else if (safarStatusFilter === 'to_delete') {
        const allJamea = tasks.length > 0 && tasks.every(t => t.stage === 'jameya')
        if (!allJamea) return false
      } else if (safarStatusFilter === 'to_upload') {
        const allToUpload = tasks.length > 0 && tasks.every(t => t.stage === 'upload_pending' || t.stage === 'uploaded')
        if (!allToUpload) return false
      } else if (safarStatusFilter === 'done') {
        const isDone = origGroup ? (origGroup.isArchived || (origGroup.total > 0 && origGroup.deliveredCount >= origGroup.total)) : false
        if (!isDone) return false
      }
    }

    return true
  })

  const pageHeading: Record<typeof view, { title: string; eyebrow: string; description: string }> = {
    dashboard: { title: 'Dashboard', eyebrow: 'LIVE SAFAR OVERVIEW', description: 'A compact view of each active Safar and its completion.' },
    ongoing: { title: 'Pipeline Board', eyebrow: 'INTERACTIVE DELIVERY PIPELINE', description: 'Real-time multi-stage pipeline tracking dates from editing to Jameya submission.' },
    photos: { title: 'Photo Data Tracker', eyebrow: 'GOOGLE DRIVE & PHOTO SYNC', description: 'Track uploaded and pending photo dates with live Google Drive synchronization.' },
    tracker: { title: 'Safar tracker', eyebrow: 'SAFAR-BY-SAFAR PRODUCTION', description: 'Date folders, assignments, and progress grouped by Safar.' },
    archive: { title: 'Archived Safars', eyebrow: 'COMPLETED & STORED', description: 'Archived Safars remain available here and can be restored at any time.' },
    editors: { title: 'Editors & assignments', eyebrow: 'TEAM WORKLOAD', description: 'See who is working on each date and where it is in the pipeline.' },
    pipeline: { title: 'Media pipeline', eyebrow: 'PRODUCTION STAGES', description: 'Follow each date from rendering through AlJamea submission.' },
    stats: { title: 'App & Workstation Stats', eyebrow: 'TELEMETRY & WORKSPACE PERFORMANCE', description: 'Real-time production metrics, team velocity, and 24/7 cloud-synced workstation records.' },
    settings: { title: 'Workspace settings', eyebrow: 'YOUR WORKSPACE', description: 'Manage alerts, login credentials, and check your One Tap sync connection.' },
    widget: { title: 'Live Safar Widget', eyebrow: 'MOBILE HOME SCREEN WIDGET', description: 'High-density live status card for home screens and lock screens.' },
    briefing: { title: 'Safar Status Briefing', eyebrow: 'OFFICIAL PRODUCTION UPDATE', description: 'Verified delivery milestones, stage counts, and date breakdown for this Safar.' }
  }

  const shortViewTitles: Record<typeof view, string> = {
    dashboard: 'Dashboard',
    ongoing: 'Pipeline',
    photos: 'Photos',
    tracker: 'Safars',
    archive: 'Archive',
    editors: 'Editors',
    pipeline: 'Pipeline',
    stats: 'Stats',
    settings: 'Settings',
    widget: 'Widget',
    briefing: 'Briefing'
  }

  const pageSize = 40
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const updateMobile = () => setIsMobile(media.matches)
    media.addEventListener('change', updateMobile)
    return () => media.removeEventListener('change', updateMobile)
  }, [])

  useEffect(() => {
    if (!menuOpen && !panelMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setPanelMenuOpen(false)
        if (menuOpen) menuToggleRef.current?.focus()
      }
      if (event.key === 'Tab' && menuOpen && isMobile) {
        const focusable = document.querySelectorAll<HTMLElement>('#workspace-navigation a[href], #workspace-navigation button:not([disabled]), #workspace-navigation input, #workspace-navigation select')
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target && menuOpen && !target.closest('.sidebar') && !target.closest('.menu-toggle')) setMenuOpen(false)
      if (target && panelMenuOpen && !target.closest('.panel-menu-wrap')) setPanelMenuOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutside)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutside)
    }
  }, [menuOpen, panelMenuOpen, isMobile])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    const loadingTimeout = initialLoading ? window.setTimeout(() => {
      if (!alive) return
      setInitialLoading(false)
      setNotice('Cloud sync is taking longer than usual. You can keep working and use Sync now to retry.')
    }, 7000) : undefined

    const load = async () => {
      try {
        const { data, error } = await supabase!.from('safar_tracker_snapshots').select('snapshot, updated_at').eq('id', 'primary').maybeSingle()
        if (alive && !error && data?.snapshot) {
          const cloudSnap = data.snapshot as Snapshot
          if (cloudSnap.tasks && cloudSnap.tasks.length > 0) {
            applySnapshot(cloudSnap)
            // If cloud storage had old camera or invalid folders, re-persist normalized clean snapshot to purge them permanently
            const hasInvalid = cloudSnap.tasks.some(t => isCameraOrAssetFolder(t.dateFolder) || !isProperDateOrSessionFolder(t.dateFolder))
            if (hasInvalid) {
              const cleaned = normalizeSnapshot(cloudSnap)
              void persistSnapshot(cleaned)
            }
          } else {
            // If cloud snapshot has 0 tasks, check local storage on this device:
            const local = readLocal()
            if (local.tasks && local.tasks.length > 0) {
              void persistSnapshot(local)
            }
          }
        } else if (alive && error) {
          setNotice('Cloud sync needs the Safar Tracker database set up.')
        }
      } catch {
        if (alive) setNotice('Cloud sync is unavailable right now. Showing saved data from this device.')
      } finally {
        if (alive) setInitialLoading(false)
        if (loadingTimeout !== undefined) window.clearTimeout(loadingTimeout)
      }
    }
    load()

    // Multi-device realtime listener: Instant database row updates
    const dbChangesChannel = supabase.channel('safar_tracker_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safar_tracker_snapshots' }, (payload: any) => {
        if (!alive) return
        if (payload?.new && (payload.new as any).snapshot) {
          applySnapshot((payload.new as any).snapshot as Snapshot)
        }
      })
      .subscribe()

    // Broadcast channel for instantaneous ephemeral updates
    const trackerChannel = supabase.channel('one_tap_safar_tracker', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'snapshot' }, ({ payload }) => { if (payload?.snapshot) applySnapshot(payload.snapshot as Snapshot) })
      .subscribe(status => {
        if (!alive) return
        const isConnected = status === 'SUBSCRIBED'
        setConnected(isConnected)
        if (isConnected) trackerChannel.send({ type: 'broadcast', event: 'request_snapshot', payload: { requestedAt: new Date().toISOString() } })
      })

    // Listen to focus and tab visibility changes to guarantee fresh data across devices
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const onOnline = () => {
      setNotice('Network reconnected! Synchronizing latest Safar updates...')
      void persistSnapshot(snapshotRef.current)
      void load()
    }
    const onOffline = () => {
      setNotice('Offline mode active. All progress is cached locally and will sync once reconnected.')
    }
    window.addEventListener('focus', onVisibilityOrFocus)
    window.addEventListener('visibilitychange', onVisibilityOrFocus)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const syncInterval = window.setInterval(load, 15000)

    const nexusChannel = supabase.channel('anyshare_realtime_nexus', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'website_user_notification' }, ({ payload }) => {
        const id = String(payload?.id || `${payload?.type || 'update'}:${payload?.timestamp || ''}:${payload?.title || ''}`)
        if (notifiedIdsRef.current.has(id)) return
        notifiedIdsRef.current.add(id)
        if (notifiedIdsRef.current.size > 200) notifiedIdsRef.current = new Set([...notifiedIdsRef.current].slice(-100))

        const type = String(payload?.type || '')
        let title = String(payload?.title || 'One Tap update')
        let message = String(payload?.message || 'Production status updated.')
        let url = '/'

        if (type === 'batch_render_complete' || type === 'title_adder_complete') {
          title = `🎬 ${title || 'Batch Render Complete!'}`
          message = message || 'Media Encoder finished rendering batch. Videos are ready for Title Adder review.'
          url = '/ongoing'
          try { if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 300]) } catch {}
        } else if (type === 'group_photos_inserted') {
          title = `💍 ${title || 'Group Photos Inserted!'}`
          message = message || `${payload?.details?.inserted || ''} Group Photos inserted into timeline (${payload?.sequenceName || 'Sequence'}).`
          url = '/ongoing'
          try { if ('vibrate' in navigator) navigator.vibrate([150, 80, 150]) } catch {}
          void load()
        } else if (type === 'markers_generated' || type === 'premiere_sync') {
          title = `⚡ ${title || 'Premiere Pro Sync'}`
          message = message || `${payload?.details?.total || ''} Sequence markers configured in ${payload?.sequenceName || 'Premiere Pro'}.`
          url = '/ongoing'
          void load()
        }

        void notify(title, message, url)
      })
      .on('broadcast', { event: 'safar_status_changed' }, ({ payload }) => {
        if (payload?.safarName) applySafarStatus(String(payload.safarName), Boolean(payload.isArchived), Boolean(payload.isDone), false)
      })
      .subscribe()

    trackerChannelRef.current = trackerChannel
    nexusChannelRef.current = nexusChannel

    return () => {
      alive = false
      if (loadingTimeout !== undefined) window.clearTimeout(loadingTimeout)
      window.removeEventListener('focus', onVisibilityOrFocus)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(syncInterval)
      trackerChannelRef.current = null
      nexusChannelRef.current = null
      supabase!.removeChannel(dbChangesChannel)
      supabase!.removeChannel(trackerChannel)
      supabase!.removeChannel(nexusChannel)
    }
  }, [])

  useEffect(() => {
    document.title = `${pageHeading[view]?.title || 'Safar Tracker'} · One Tap Production`
  }, [view])

  useEffect(() => setPage(0), [search, filter, selectedSafar, selectedEditor, view])

  useEffect(() => {
    if (menuOpen && isMobile) sidebarCloseRef.current?.focus()
  }, [menuOpen, isMobile])

  useEffect(() => {
    if (sidebarRef.current) sidebarRef.current.inert = isMobile && !menuOpen
  }, [menuOpen, isMobile])

  function applySnapshot(next: Snapshot) {
    const isFromDesktop = (next as any)?.source === 'onetap-desktop'
    const delSafars = getDeletedSafars()
    const delTasks = getDeletedTasks()
    const overrides = getStageOverrides()

    if (!isFromDesktop && (next as any)?.stageOverrides && typeof (next as any).stageOverrides === 'object') {
      overrides.clear()
      for (const [k, v] of Object.entries((next as any).stageOverrides)) {
        if (v && typeof v === 'object') overrides.set(k, v as TaskStageOverride)
      }
      saveStageOverrides(overrides)
    } else if ((next as any)?.stageOverrides && typeof (next as any).stageOverrides === 'object') {
      for (const [k, v] of Object.entries((next as any).stageOverrides)) {
        if (v && typeof v === 'object') overrides.set(k, v as TaskStageOverride)
      }
      saveStageOverrides(overrides)
    }
    if (!isFromDesktop && Array.isArray((next as any)?.deletedSafars)) {
      delSafars.clear()
      for (const s of (next as any).deletedSafars) if (s) delSafars.add(String(s).trim().toLowerCase())
      saveDeletedSafars(delSafars)
    } else if (Array.isArray((next as any)?.deletedSafars)) {
      for (const s of (next as any).deletedSafars) if (s) delSafars.add(String(s).trim().toLowerCase())
      saveDeletedSafars(delSafars)
    }
    if (!isFromDesktop && Array.isArray((next as any)?.deletedTasks)) {
      delTasks.clear()
      for (const t of (next as any).deletedTasks) if (t) delTasks.add(String(t).trim().toLowerCase())
      saveDeletedTasks(delTasks)
    } else if (Array.isArray((next as any)?.deletedTasks)) {
      for (const t of (next as any).deletedTasks) if (t) delTasks.add(String(t).trim().toLowerCase())
      saveDeletedTasks(delTasks)
    }
    const normalized = normalizeSnapshot(next)
    const current = snapshotRef.current
    const previousSafars = new Map((current.safars || []).map(safar => [safar.safarName, safar]))
    const hasSafarMetadata = Array.isArray((next as any)?.safars)
    const rawSafars = hasSafarMetadata ? normalized.safars : current.safars
    const mergedSafars = rawSafars
      .filter(safar => !delSafars.has(safar.safarName.trim().toLowerCase()))
      .map(safar => ({
        ...previousSafars.get(safar.safarName),
        ...safar,
        isArchived: safar.isArchived ?? previousSafars.get(safar.safarName)?.isArchived ?? false
      }))
    const prevTaskMap = new Map((current.tasks || []).map(t => [getTaskKey(t.safarName, t.dateFolder), t]))

    const mergedTasks = normalized.tasks
      .filter(t =>
        !delSafars.has(t.safarName.trim().toLowerCase()) &&
        !delTasks.has(getTaskKey(t.safarName, t.dateFolder))
      )
      .map(t => {
        const key = getTaskKey(t.safarName, t.dateFolder)
        const override = overrides.get(key)
        const existing = prevTaskMap.get(key)

        // When receiving desktop scans/syncs, the desktop app reports Safar names and folder presence.
        // It must NEVER revert or overwrite stages, photo stages, or editor assignments set in web app!
        const finalStage = isFromDesktop
          ? (override?.stage || existing?.stage || t.stage || 'editing')
          : (t.stage || override?.stage || existing?.stage || 'editing')

        const finalPhotoStage = isFromDesktop
          ? (override?.photoStage || existing?.photoStage || t.photoStage || 'edited')
          : (t.photoStage || override?.photoStage || existing?.photoStage || 'edited')

        const finalPhotoUploaded = isFromDesktop
          ? (override?.photoUploaded !== undefined ? override.photoUploaded : (existing?.photoUploaded ?? t.photoUploaded ?? false))
          : (t.photoUploaded ?? override?.photoUploaded ?? existing?.photoUploaded ?? false)

        const finalEditor = isFromDesktop
          ? (override?.editorName || existing?.editorName || t.editorName || DEFAULT_EDITOR)
          : (t.editorName || override?.editorName || existing?.editorName || DEFAULT_EDITOR)

        const finalDueDate = isFromDesktop
          ? (override?.dueDate || existing?.dueDate || t.dueDate || '')
          : (t.dueDate || override?.dueDate || existing?.dueDate || '')

        const finalPhotoEditor = isFromDesktop
          ? (override?.photoEditorName || existing?.photoEditorName || t.photoEditorName || 'Muffadal Peti')
          : (t.photoEditorName || override?.photoEditorName || existing?.photoEditorName || 'Muffadal Peti')

        return {
          ...t,
          stage: finalStage,
          editorName: finalEditor,
          dueDate: finalDueDate,
          photoStage: finalPhotoStage,
          photoEditorName: finalPhotoEditor,
          photoUploaded: finalPhotoUploaded
        }
      })

    // Retain existing tasks from other safars not present in a partial desktop scan
    if (isFromDesktop && current.tasks && current.tasks.length > 0) {
      const scannedKeys = new Set(mergedTasks.map(t => getTaskKey(t.safarName, t.dateFolder)))
      for (const t of current.tasks) {
        const k = getTaskKey(t.safarName, t.dateFolder)
        if (!scannedKeys.has(k) && !delSafars.has(t.safarName.trim().toLowerCase()) && !delTasks.has(k)) {
          if (!isCameraOrAssetFolder(t.dateFolder) && isProperDateOrSessionFolder(t.dateFolder)) {
            mergedTasks.push({
              ...t,
              editorName: t.editorName || 'Murtaza',
              dueDate: t.dueDate || '',
              photoStage: t.photoStage || 'edited',
              photoEditorName: t.photoEditorName || 'Muffadal Peti',
              photoUploaded: Boolean(t.photoUploaded)
            })
          }
        }
      }
    }
    const merged: Snapshot = {
      ...normalized,
      tasks: mergedTasks,
      safars: mergedSafars,
      stageOverrides: Object.fromEntries(overrides.entries()),
      deletedTasks: Array.from(delTasks),
      deletedSafars: Array.from(delSafars)
    }

    // PWA Mobile Push Notifications on remote stage changes, new footage, and photos
    if (current.tasks && current.tasks.length > 0) {
      const prevMap = new Map(current.tasks.map(t => [getTaskKey(t.safarName, t.dateFolder), t]))
      const moved: { task: SafarTask; newStage: string; isPhoto: boolean }[] = []

      for (const t of mergedTasks) {
        const prev = prevMap.get(getTaskKey(t.safarName, t.dateFolder))
        if (prev) {
          if (t.stage !== prev.stage) {
            moved.push({ task: t, newStage: t.stage, isPhoto: false })
          } else if (t.photoStage && t.photoStage !== prev.photoStage) {
            moved.push({ task: t, newStage: t.photoStage, isPhoto: true })
          }
        }
      }

      // 1. Detect New Footage uploaded for a Safar day
      const newlyAdded = mergedTasks.filter(t => !prevMap.has(getTaskKey(t.safarName, t.dateFolder)) && !delTasks.has(getTaskKey(t.safarName, t.dateFolder)))
      if (newlyAdded.length > 0) {
        if (newlyAdded.length === 1) {
          void notify(
            `📸 New Footage: ${newlyAdded[0].dateFolder}`,
            `New footage uploaded for ${newlyAdded[0].safarName}`,
            `/ongoing?safar=${encodeURIComponent(newlyAdded[0].safarName)}`
          )
        } else {
          void notify(
            `📸 New Footage Uploaded (${newlyAdded.length} dates)`,
            `${newlyAdded[0].safarName}: ${newlyAdded.map(t => t.dateFolder).slice(0, 3).join(', ')}${newlyAdded.length > 3 ? '...' : ''}`,
            `/ongoing?safar=${encodeURIComponent(newlyAdded[0].safarName)}`
          )
        }
      }

      // 2. Detect Photos uploaded to Google Drive
      const photosUploaded = mergedTasks.filter(t => {
        const prev = prevMap.get(getTaskKey(t.safarName, t.dateFolder))
        return t.photoUploaded && (!prev || !prev.photoUploaded)
      })
      if (photosUploaded.length > 0) {
        const p = photosUploaded[0]
        void notify(
          `📷 Photos Uploaded to Cloud`,
          `${photosUploaded.length > 1 ? `${photosUploaded.length} dates uploaded` : p.dateFolder} (${p.safarName}) photos ready on Google Drive.`,
          `/photos?safar=${encodeURIComponent(p.safarName)}`
        )
      }

      // 3. Detect Stage moved to "Review" or "Pending Upload"
      const reviewPendingItems = moved.filter(m => ['upload', 'rendering', 'jameya', 'given_to_murtaza'].includes(m.newStage))
      for (const item of reviewPendingItems) {
        const badge = item.newStage === 'given_to_murtaza'
          ? '📷 Photo Review Needed'
          : item.newStage === 'upload'
            ? '☁️ Pending Upload'
            : item.newStage === 'jameya'
              ? '🏛️ Ready for Al Jamea'
              : '⚡ Render Review'
        void notify(
          `${badge}: ${item.task.dateFolder}`,
          `${item.task.safarName} is now ${item.newStage.replace(/_/g, ' ')}. Action required by Lead Editor.`,
          item.isPhoto ? `/photos?safar=${encodeURIComponent(item.task.safarName)}` : `/ongoing?safar=${encodeURIComponent(item.task.safarName)}`
        )
      }

      // 4. Other general stage progressions
      const otherMoved = moved.filter(m => !['upload', 'rendering', 'jameya', 'given_to_murtaza'].includes(m.newStage))
      if (otherMoved.length === 1) {
        const item = otherMoved[0]
        const stLabel = item.isPhoto
          ? (item.newStage === 'uploaded' ? 'Photos Uploaded' : item.newStage === 'given_to_murtaza' ? 'Photos Given to Murtaza' : 'Photos Edited')
          : (STAGES.find(s => s.id === item.newStage)?.label || item.newStage)
        void notify(
          `${item.isPhoto ? '📷' : '🎬'} ${item.task.dateFolder} advanced`,
          `Moved to ${stLabel} (${item.task.safarName})`,
          `/ongoing?safar=${encodeURIComponent(item.task.safarName)}`
        )
      } else if (otherMoved.length > 1) {
        void notify(
          `⚡ ${otherMoved.length} Dates Advanced Stages`,
          `${otherMoved[0].task.safarName}: ${otherMoved.map(m => m.task.dateFolder).slice(0, 3).join(', ')}${otherMoved.length > 3 ? '...' : ''}`,
          `/ongoing?safar=${encodeURIComponent(otherMoved[0].task.safarName)}`
        )
      }
    }

    snapshotRef.current = merged
    setSnapshot(merged)
    try { localStorage.setItem(localKey, JSON.stringify(merged)) } catch {}
  }

  function applySafarStatus(safarName: string, isArchived: boolean, isDone: boolean, persist = true) {
    const current = snapshotRef.current
    const existing = current.safars.find(safar => safar.safarName === safarName)
    const next: Snapshot = {
      ...current,
      updatedAt: new Date().toISOString(),
      source: 'website',
      safars: [...current.safars.filter(safar => safar.safarName !== safarName), { ...existing, safarName, totalDays: existing?.totalDays || current.tasks.filter(task => task.safarName === safarName).length, isArchived, isDone, updatedAt: new Date().toISOString() }]
    }
    applySnapshot(next)
    if (persist) void persistSnapshot(next)
  }

  async function persistSnapshot(next: Snapshot) {
    try {
      const overrides = getStageOverrides()
      const delSafars = getDeletedSafars()
      const delTasks = getDeletedTasks()
      const payload: Snapshot = {
        ...next,
        stageOverrides: Object.fromEntries(overrides.entries()),
        deletedSafars: Array.from(delSafars),
        deletedTasks: Array.from(delTasks),
        updatedAt: next.updatedAt || new Date().toISOString()
      }
      const { error } = await supabase.from('safar_tracker_snapshots').upsert({ id: 'primary', snapshot: payload, updated_at: payload.updatedAt })
      if (error) throw error
      await trackerChannelRef.current?.send({ type: 'broadcast', event: 'snapshot', payload: { snapshot: payload } })
    } catch {
      setNotice('Saved on this device. Cloud sync is temporarily unavailable.')
    }
  }

  async function setSafarArchived(group: SafarGroup, isArchived: boolean) {
    const current = snapshotRef.current
    const summary = current.safars.find(safar => safar.safarName === group.safarName)
    const tasks = current.tasks.map(task => {
      if (task.safarName !== group.safarName) return task
      const priorStage = summary?.archivePriorStages?.[task.id]
      return isArchived
        ? { ...task, stage: 'completed' as Stage, updatedAt: new Date().toISOString() }
        : { ...task, stage: priorStage || task.stage, updatedAt: new Date().toISOString() }
    })
    const archivePriorStages = isArchived
      ? Object.fromEntries(current.tasks.filter(task => task.safarName === group.safarName).map(task => [task.id, task.stage]))
      : undefined
    const next: Snapshot = {
      ...current,
      tasks,
      updatedAt: new Date().toISOString(),
      source: 'website',
      safars: [...current.safars.filter(safar => safar.safarName !== group.safarName), {
        ...summary,
        safarName: group.safarName,
        totalDays: group.total,
        isArchived,
        isDone: isArchived,
        archivePriorStages,
        updatedAt: new Date().toISOString()
      }]
    }
    applySnapshot(next)
    await persistSnapshot(next)
    const result = await nexusChannelRef.current?.send({
      type: 'broadcast',
      event: 'safar_mark_done',
      payload: {
        safarName: group.safarName,
        isDone: isArchived,
        isArchived,
        taskStatuses: tasks.filter(task => task.safarName === group.safarName).map(task => ({
          dateFolder: task.dateFolder,
          status: isArchived ? 'submitted' : task.stage === 'uploaded' ? 'uploaded' : task.stage === 'jameya' ? 'submitted' : 'auto'
        }))
      }
    })
    if (result === 'ok') setNotice(isArchived ? `${group.safarName} moved to the archive.` : `${group.safarName} restored to active Safars.`)
  }

  function toggleSafarExpanded(safarName: string) {
    setExpandedSafars(current => {
      const next = new Set(current)
      if (next.has(safarName)) next.delete(safarName)
      else next.add(safarName)
      return next
    })
  }

  function applyStageFilter(stageId: string, targetView: View = 'tracker') {
    const nextFilter = filter === stageId ? 'all' : stageId
    setFilter(nextFilter)
    setSafarStatusFilter('all')
    if (nextFilter !== 'all') {
      const matching = safarGroups.filter(g => !g.isArchived && g.tasks.some(t => t.stage === nextFilter))
      const names = new Set(matching.map(g => g.safarName))
      setExpandedSafars(current => new Set([...current, ...names]))
    }
    if (view !== targetView) navigateTo(targetView)
  }

  function applySafarStatusFilter(status: 'all' | 'pending' | 'in_process' | 'to_delete' | 'to_upload' | 'done', targetView: View = 'tracker') {
    const nextStatus = safarStatusFilter === status ? 'all' : status
    setSafarStatusFilter(nextStatus)
    setFilter('all')
    if (nextStatus !== 'all') {
      const matching = safarGroups.filter(g => {
        if (g.isArchived) return false
        const tasks = g.tasks || []
        if (nextStatus === 'pending') return tasks.length > 0 && tasks.every(t => t.stage === 'editing_pending')
        if (nextStatus === 'in_process') return tasks.some(t => t.stage === 'editing' || t.stage === 'upload_pending')
        if (nextStatus === 'to_delete') return tasks.length > 0 && tasks.every(t => t.stage === 'jameya')
        if (nextStatus === 'to_upload') return tasks.length > 0 && tasks.every(t => t.stage === 'upload_pending' || t.stage === 'uploaded')
        if (nextStatus === 'done') return g.total > 0 && g.deliveredCount >= g.total
        return false
      })
      const names = new Set(matching.map(g => g.safarName))
      setExpandedSafars(current => new Set([...current, ...names]))
    }
    if (view !== targetView) navigateTo(targetView)
  }

  async function notify(title: string, body: string, targetUrl: string = '/') {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        let registration = await navigator.serviceWorker?.getRegistration()
        if (!registration && navigator.serviceWorker) {
          registration = await navigator.serviceWorker.ready
        }
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, {
            body,
            icon: '/logo.svg',
            badge: '/logo.svg',
            tag: `onetap-${Date.now()}`,
            data: { url: targetUrl }
          } as any)
          return
        } else if (document.visibilityState === 'visible') {
          new Notification(title, { body, icon: '/logo.svg' })
          return
        }
      } catch (err) {
        console.warn('[PWA Notification Error]', err)
      }
    } else if (document.visibilityState === 'visible') {
      setNotice(`${title} · ${body}`)
      window.setTimeout(() => setNotice(''), 6000)
    }
  }

  async function requestNotifications() {
    if (!('Notification' in window)) return setNotice('This browser does not support notifications.')
    try {
      if (Notification.permission === 'granted') {
        try { if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]) } catch {}
        setNotice('✓ Push alerts already active for Editors & Team Leads! Testing alert...')
        void notify('🔔 One Tap Push Active', 'You will receive instant alerts when batches finish rendering, stages enter review, or new footage is uploaded.')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        try { if ('vibrate' in navigator) navigator.vibrate([150, 80, 150]) } catch {}
        setNotice('✓ PWA notifications enabled! You will receive live alerts on stage changes.')
        void notify('One Tap Alerts Activated', 'You will receive real-time stage updates on this device.')
      } else {
        setNotice(permission === 'denied' ? 'Notifications are blocked in this browser. Allow them in site settings to receive alerts.' : 'Notifications were not enabled.')
      }
    } catch { setNotice('This browser could not enable notifications.') }
  }

  function exportCsv() {
    if (rows.length === 0) { setNotice('There are no dates to export yet.'); return }
    const header = ['Safar', 'Date folder', 'Editor', 'Stage', 'Due date', 'Last updated']
    const values = rows.map(task => [task.safarName, dateFolderName(task), task.editorName || '', STAGES.find(stage => stage.id === task.stage)?.label || task.stage, task.dueDate, task.updatedAt])
    const quote = (value: string) => `"${String(value).replace(/"/g, '""')}"`
    const csv = [header, ...values].map(row => row.map(value => quote(String(value))).join(',')).join('\r\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `One-Tap-Safar-Tracker-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function generateDailyBriefingText(forSafarName?: string): string {
    const isAllMode = forSafarName === 'ALL'
    const targetName = isAllMode ? '' : (forSafarName || effectiveOngoingSafar)
    const g = !isAllMode ? activeSafarGroups.find(group => group.safarName === targetName) : undefined

    if (g) {
      const lines: string[] = []
      const total = g.tasks.length > 0 ? g.tasks.length : (g.total || 0)
      const delivered = g.tasks.filter(t => t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed').length
      const is100Done = total > 0 && delivered >= total
      const pct = is100Done ? 100 : total > 0 ? Math.round((delivered / total) * 100) : 0

      lines.push('🎬 *ONE TAP STUDIO · PRODUCTION BRIEFING*')
      lines.push('══════════════════════════════════')
      lines.push(`📍 *CAMPAIGN:* ${g.safarName}`)
      lines.push(`🗓️ *HIJRI ERA:* ${g.safarYear || '1447'} H · Scheduled Dates: ${total}`)
      lines.push(`⏰ *REPORTED:* ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`)
      lines.push('')

      if (is100Done) {
        lines.push('🏆 *STATUS: 100% DONE — ALL DATES DELIVERED*')
        lines.push(`🎉 *All ${total} of ${total} scheduled date folders have been uploaded, verified, and completed!*`)
      } else {
        lines.push(`📊 *DELIVERY RATE:* ${pct}% Delivered (${delivered}/${total} dates completed)`)
      }
      lines.push('')

      // Video stage counts (5 production stages)
      const videoJameya = g.tasks.filter(t => t.stage === 'jameya' || (t.stage as any) === 'completed' || (t.stage as any) === 'submitted').length
      const videoUploaded = g.tasks.filter(t => t.stage === 'uploaded' || (t.stage as any) === 'upload').length
      const videoUploadPending = g.tasks.filter(t => t.stage === 'upload_pending' || (t.stage as any) === 'rendering').length
      const videoInProgress = g.tasks.filter(t => t.stage === 'editing').length
      const videoEditingPending = g.tasks.filter(t => t.stage === 'editing_pending').length

      const videoParts: string[] = []
      if (videoJameya > 0) videoParts.push(`🏛️ ${videoJameya} AlJamea Done`)
      if (videoUploaded > 0) videoParts.push(`☁️ ${videoUploaded} Uploaded`)
      if (videoUploadPending > 0) videoParts.push(`⏳ ${videoUploadPending} Upload Pending`)
      if (videoInProgress > 0) videoParts.push(`🎞️ ${videoInProgress} In Progress`)
      if (videoEditingPending > 0) videoParts.push(`📋 ${videoEditingPending} Editing Pending`)

      if (videoParts.length > 0) {
        lines.push(`• 🎬 *Video Pipeline:* ${videoParts.join(' · ')}`)
      }

      // Photo stage counts
      const photoUploaded = g.tasks.filter(t => t.photoStage === 'uploaded' || t.photoUploaded || t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed').length
      const photoGiven = g.tasks.filter(t => t.photoStage === 'given_to_murtaza').length
      const photoEdited = g.tasks.filter(t => t.photoStage === 'edited' && !t.photoUploaded).length

      const photoParts: string[] = []
      if (photoUploaded > 0) photoParts.push(`☁️ ${photoUploaded} In Drive`)
      if (photoGiven > 0) photoParts.push(`🤝 ${photoGiven} Given to Murtaza`)
      if (photoEdited > 0) photoParts.push(`🎨 ${photoEdited} In Editing`)

      if (photoParts.length > 0) {
        lines.push(`• 📷 *Photo Pipeline:* ${photoParts.join(' · ')}`)
      }

      // Delivered & In Progress Dates
      const deliveredDates = g.tasks.filter(t => t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed').map(dateFolderName)
      const pendingDates = g.tasks.filter(t => t.stage === 'editing_pending' || t.stage === 'editing' || t.stage === 'upload_pending' || (t.stage as any) === 'rendering').map(dateFolderName)

      if (deliveredDates.length > 0) {
        lines.push('')
        lines.push(`✅ *Delivered Dates (${deliveredDates.length}):*`)
        lines.push(deliveredDates.map(d => `   ✓ ${d}`).join('\n'))
      }
      if (pendingDates.length > 0) {
        lines.push('')
        lines.push(`⏳ *Pending Dates (${pendingDates.length}):*`)
        lines.push(pendingDates.map(d => `   • ${d}`).join('\n'))
      }

      const publicBase = getPublicWebsiteOrigin()
      lines.push('')
      lines.push('──────────────────────────────────')
      lines.push(`📱 *Interactive Briefing & Status Card:*`)
      lines.push(`${publicBase}/briefing?safar=${encodeURIComponent(g.safarName)}`)
      lines.push(`🔗 *Live Workstation Tracker:*`)
      lines.push(`${publicBase}/kanban?safar=${encodeURIComponent(g.safarName)}`)
      lines.push('')
      lines.push(`_One Tap Studio · Real-time Production Engine_`)
      return lines.join('\n')
    }

    // Full multi-safar summary
    const lines: string[] = []
    lines.push('🎬 *ONE TAP STUDIO · ALL SAFARS BRIEFING*')
    lines.push('══════════════════════════════════')
    lines.push(`🗓️ *ERA:* 1448 H · Active Safars: ${activeSafarGroups.length}`)
    lines.push('')

    activeSafarGroups.forEach(item => {
      const tot = item.tasks.length > 0 ? item.tasks.length : (item.total || 0)
      const del = item.tasks.filter(t => t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed').length
      const isDone = tot > 0 && del >= tot
      const p = isDone ? 100 : tot > 0 ? Math.round((del / tot) * 100) : 0
      lines.push(`📍 *${item.safarName}*: ${isDone ? '🏆 100% DONE' : `${p}% Delivered`} (${del}/${tot} dates)`)

      const vParts: string[] = []
      if (item.jameyaCount > 0) vParts.push(`${item.jameyaCount} AlJamea Done`)
      if (item.uploadedCount > 0) vParts.push(`${item.uploadedCount} Uploaded`)
      if (item.uploadPendingCount > 0) vParts.push(`${item.uploadPendingCount} Upload Pending`)
      if (item.editingCount > 0) vParts.push(`${item.editingCount} In Progress`)
      if (item.editingPendingCount > 0) vParts.push(`${item.editingPendingCount} Editing Pending`)
      if (vParts.length > 0) lines.push(`   • 🎬 Video: ${vParts.join(' · ')}`)
    })

    const allDelivered = studioStats.deliveredDates
    const allTotal = studioStats.totalDates
    const allPct = studioStats.percent

    const publicBase = getPublicWebsiteOrigin()
    lines.push('')
    lines.push('──────────────────────────────────')
    lines.push(`📊 *Overall Total:* ${allDelivered} of ${allTotal} dates delivered (${allPct}%)`)
    lines.push(`🔗 *Live Production Hub:* ${publicBase}`)

    return lines.join('\n')
  }

  function copyDailyBriefing(forSafarName?: string) {
    const text = generateDailyBriefingText(forSafarName)
    const label = forSafarName === 'ALL' ? 'All Safars' : (forSafarName || effectiveOngoingSafar)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setNotice(`✓ WhatsApp daily briefing for "${label}" copied to clipboard! Ready to paste into WhatsApp / Telegram.`)
      }).catch(() => {
        setNotice('Briefing copied to clipboard.')
      })
    } else {
      setNotice('Clipboard unavailable.')
    }
  }

  function shareDailyBriefingWhatsApp(forSafarName?: string, format: 'msg' | 'image' = 'msg') {
    const target = forSafarName || effectiveOngoingSafar || (activeSafarGroups[0]?.safarName ?? '')
    if (target && target !== 'ALL') {
      setBriefingModalState({ safarName: target, initialTab: format })
    } else {
      const text = generateDailyBriefingText(forSafarName)
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
      window.open(url, '_blank')
    }
  }

  async function updateTask(task: SafarTask, changes: Partial<SafarTask>) {
    const updatedAt = new Date().toISOString()
    const targetKey = getTaskKey(task.safarName, task.dateFolder)

    // Cross-sync rule: when marked as Uploaded in either Photo Tracker or Safar Tracker,
    // mark that date/session folder as Uploaded in BOTH trackers!
    const effectiveChanges: Partial<SafarTask> = { ...changes }
    if (changes.photoStage === 'uploaded' || changes.photoUploaded === true) {
      effectiveChanges.photoStage = 'uploaded'
      effectiveChanges.photoUploaded = true
      if (task.stage === 'editing_pending' || task.stage === 'editing' || task.stage === 'upload_pending') {
        effectiveChanges.stage = 'uploaded'
      }
    } else if (changes.stage === 'uploaded' || changes.stage === 'jameya') {
      effectiveChanges.photoStage = 'uploaded'
      effectiveChanges.photoUploaded = true
    }

    // Save changes into persistent overrides store so they survive reloads and desktop scans
    const overrides = getStageOverrides()
    const currentOverride = overrides.get(targetKey) || { updatedAt }
    overrides.set(targetKey, {
      ...currentOverride,
      ...(effectiveChanges.stage ? { stage: effectiveChanges.stage } : {}),
      ...(effectiveChanges.editorName !== undefined ? { editorName: effectiveChanges.editorName } : {}),
      ...(effectiveChanges.dueDate !== undefined ? { dueDate: effectiveChanges.dueDate } : {}),
      ...(effectiveChanges.photoStage ? { photoStage: effectiveChanges.photoStage } : {}),
      ...(effectiveChanges.photoEditorName !== undefined ? { photoEditorName: effectiveChanges.photoEditorName } : {}),
      ...(effectiveChanges.photoUploaded !== undefined ? { photoUploaded: effectiveChanges.photoUploaded } : {}),
      updatedAt
    })
    saveStageOverrides(overrides)

    const next: Snapshot = {
      ...snapshot,
      updatedAt,
      source: 'website',
      stageOverrides: Object.fromEntries(overrides.entries()),
      deletedSafars: Array.from(getDeletedSafars()),
      deletedTasks: Array.from(getDeletedTasks()),
      tasks: snapshot.tasks.map(row => {
        if (row.id === task.id || getTaskKey(row.safarName, row.dateFolder) === targetKey) {
          return { ...row, ...effectiveChanges, updatedAt }
        }
        return row
      })
    }
    applySnapshot(next)
    saveCountRef.current += 1
    setSaving(true)
    try {
      const { error } = await supabase.from('safar_tracker_snapshots').upsert({ id: 'primary', snapshot: next, updated_at: updatedAt })
      if (error) setNotice('Saved on this device. Cloud history needs the Safar Tracker database setup.')
      await trackerChannelRef.current?.send({ type: 'broadcast', event: 'snapshot', payload: { snapshot: next } })
      if (effectiveChanges.stage) {
        const status = effectiveChanges.stage === 'jameya' ? 'submitted' : effectiveChanges.stage === 'uploaded' ? 'uploaded' : 'auto'
        await nexusChannelRef.current?.send({ type: 'broadcast', event: 'task_mark_done', payload: { safarName: task.safarName, dateFolder: task.dateFolder, status } })

        // Trigger WhatsApp alert on completion of uploaded or jameya
        if (effectiveChanges.stage === 'uploaded' || effectiveChanges.stage === 'jameya') {
          const uploadedCount = next.tasks.filter(t => t.safarName === task.safarName && (t.stage === 'uploaded' || t.stage === 'jameya')).length
          const totalCount = next.tasks.filter(t => t.safarName === task.safarName).length
          const pendingCount = Math.max(0, totalCount - uploadedCount)
          sendWhatsAppAlert(task.dateFolder, uploadedCount, pendingCount, window.location.origin).catch(() => {})
        }
      }

      // Trigger smart compiled stage email notification (5-minute batch debounce)
      const isStageChanged = Boolean(effectiveChanges.stage && effectiveChanges.stage !== task.stage)
      const isPhotoStageChanged = Boolean(effectiveChanges.photoStage && effectiveChanges.photoStage !== task.photoStage)

      if (isStageChanged || isPhotoStageChanged) {
        const activeStage = effectiveChanges.stage || task.stage
        const activeStageLabel = STAGES.find(s => s.id === activeStage)?.label || activeStage
        const photoStageLabel = effectiveChanges.photoStage === 'uploaded'
          ? 'Uploaded'
          : effectiveChanges.photoStage === 'given_to_murtaza'
            ? 'Given to Murtaza'
            : 'Edited'

        const totalCount = next.tasks.filter(t => t.safarName === task.safarName).length
        const deliveredCount = next.tasks.filter(t => t.safarName === task.safarName && (t.stage === 'uploaded' || t.stage === 'jameya')).length
        const deliveredPercent = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0

        const mediaType: 'video' | 'photo' | 'both' = (isStageChanged && isPhotoStageChanged)
          ? 'both'
          : isPhotoStageChanged && !isStageChanged
            ? 'photo'
            : 'video'

        // Dispatch local PWA notification immediately
        const pwaStageLabel = mediaType === 'photo' ? photoStageLabel : activeStageLabel
        void notify(
          `${mediaType === 'photo' ? '📷' : '🎬'} ${task.dateFolder} advanced to ${pwaStageLabel}`,
          `${task.safarName} · Editor: ${mediaType === 'photo' ? (effectiveChanges.photoEditorName || task.photoEditorName || DEFAULT_PHOTO_EDITOR) : (effectiveChanges.editorName || task.editorName || DEFAULT_EDITOR)}`,
          `/kanban?safar=${encodeURIComponent(task.safarName)}`
        )
      }
    } catch {
      setNotice('Saved on this device. Cloud sync is temporarily unavailable.')
    } finally {
      saveCountRef.current = Math.max(0, saveCountRef.current - 1)
      setSaving(saveCountRef.current > 0)
    }
  }

  async function updateTasksBatch(updates: Array<{ task: SafarTask; changes: Partial<SafarTask> }>) {
    if (!updates || updates.length === 0) return
    const updatedAt = new Date().toISOString()
    const overrides = getStageOverrides()
    const updatesMap = new Map<string, Partial<SafarTask>>()

    updates.forEach(({ task, changes }) => {
      const targetKey = getTaskKey(task.safarName, task.dateFolder)
      const effectiveChanges: Partial<SafarTask> = { ...changes }
      if (changes.photoStage === 'uploaded' || changes.photoUploaded === true) {
        effectiveChanges.photoStage = 'uploaded'
        effectiveChanges.photoUploaded = true
        if (task.stage === 'editing_pending' || task.stage === 'editing' || task.stage === 'upload_pending') {
          effectiveChanges.stage = 'uploaded'
        }
      } else if (changes.stage === 'uploaded' || changes.stage === 'jameya') {
        effectiveChanges.photoStage = 'uploaded'
        effectiveChanges.photoUploaded = true
      }

      updatesMap.set(targetKey, effectiveChanges)

      const currentOverride = overrides.get(targetKey) || { updatedAt }
      overrides.set(targetKey, {
        ...currentOverride,
        ...(effectiveChanges.stage ? { stage: effectiveChanges.stage } : {}),
        ...(effectiveChanges.editorName !== undefined ? { editorName: effectiveChanges.editorName } : {}),
        ...(effectiveChanges.dueDate !== undefined ? { dueDate: effectiveChanges.dueDate } : {}),
        ...(effectiveChanges.photoStage ? { photoStage: effectiveChanges.photoStage } : {}),
        ...(effectiveChanges.photoEditorName !== undefined ? { photoEditorName: effectiveChanges.photoEditorName } : {}),
        ...(effectiveChanges.photoUploaded !== undefined ? { photoUploaded: effectiveChanges.photoUploaded } : {}),
        updatedAt
      })
    })

    saveStageOverrides(overrides)

    const next: Snapshot = {
      ...snapshot,
      updatedAt,
      source: 'website',
      stageOverrides: Object.fromEntries(overrides.entries()),
      deletedSafars: Array.from(getDeletedSafars()),
      deletedTasks: Array.from(getDeletedTasks()),
      tasks: snapshot.tasks.map(row => {
        const key = getTaskKey(row.safarName, row.dateFolder)
        const ch = updatesMap.get(key)
        if (ch) {
          return { ...row, ...ch, updatedAt }
        }
        return row
      })
    }

    applySnapshot(next)
    saveCountRef.current += 1
    setSaving(true)

    try {
      const { error } = await supabase.from('safar_tracker_snapshots').upsert({ id: 'primary', snapshot: next, updated_at: updatedAt })
      if (error) setNotice('Saved on this device. Cloud history needs the Safar Tracker database setup.')
      await trackerChannelRef.current?.send({ type: 'broadcast', event: 'snapshot', payload: { snapshot: next } })

      // Dispatch nexus signals for tasks that updated their stage
      for (const { task, changes } of updates) {
        const targetKey = getTaskKey(task.safarName, task.dateFolder)
        const effectiveChanges = updatesMap.get(targetKey) || changes
        if (effectiveChanges.stage) {
          const status = effectiveChanges.stage === 'jameya' ? 'submitted' : effectiveChanges.stage === 'uploaded' ? 'uploaded' : 'auto'
          await nexusChannelRef.current?.send({ type: 'broadcast', event: 'task_mark_done', payload: { safarName: task.safarName, dateFolder: task.dateFolder, status } })
        }
      }

      setNotice(`✓ Batch updated ${updates.length} items successfully!`)
      setTimeout(() => setNotice(''), 4000)
    } catch {
      setNotice('Saved on this device. Cloud sync is temporarily unavailable.')
    } finally {
      saveCountRef.current = Math.max(0, saveCountRef.current - 1)
      setSaving(saveCountRef.current > 0)
    }
  }

  // Remove / Exclude a task from tracking
  async function handleRemoveTask(taskToRemove: { safarName: string; dateFolder: string; id?: string }) {
    const targetKey = getTaskKey(taskToRemove.safarName, taskToRemove.dateFolder)
    const delTasks = getDeletedTasks()
    delTasks.add(targetKey)
    saveDeletedTasks(delTasks)

    const overrides = getStageOverrides()
    overrides.delete(targetKey)
    saveStageOverrides(overrides)

    const current = snapshotRef.current
    const tasks = current.tasks.filter(t => {
      if (taskToRemove.id && t.id === taskToRemove.id) return false
      if (getTaskKey(t.safarName, t.dateFolder) === targetKey) return false
      return true
    })
    const updatedAt = new Date().toISOString()
    const next: Snapshot = {
      ...current,
      tasks,
      deletedTasks: Array.from(delTasks),
      updatedAt,
      source: 'website'
    }
    applySnapshot(next)
    await persistSnapshot(next)
    await nexusChannelRef.current?.send({
      type: 'broadcast',
      event: 'task_remove',
      payload: { safarName: taskToRemove.safarName, dateFolder: taskToRemove.dateFolder }
    })
    try {
      await fetch('http://127.0.0.1:5253/api/tasks/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safarName: taskToRemove.safarName, dateFolder: taskToRemove.dateFolder })
      })
    } catch {}
    setNotice(`Excluded "${taskToRemove.dateFolder}" from tracking across all pages.`)
  }

  // Manually add a date folder to the active Safar
  async function handleAddTask(safarName: string, dateFolder: string, comment?: string) {
    const current = snapshotRef.current
    const cleanFolder = dateFolder.trim()
    if (!cleanFolder || isCameraOrAssetFolder(cleanFolder) || !isProperDateOrSessionFolder(cleanFolder)) {
      setNotice(`"${cleanFolder}" is a camera or asset folder and cannot be added as a task.`)
      setTimeout(() => setNotice(''), 4000)
      return
    }

    // Un-delete if previously excluded
    const targetKey = getTaskKey(safarName, cleanFolder)
    const delTasks = getDeletedTasks()
    if (delTasks.has(targetKey)) {
      delTasks.delete(targetKey)
      saveDeletedTasks(delTasks)
    }

    const id = `${safarName}::${cleanFolder}::${Date.now()}`
    const newTask: SafarTask = {
      id,
      safarName,
      dateFolder: cleanFolder,
      hijriDate: cleanFolder,
      stage: 'editing',
      editorName: DEFAULT_EDITOR,
      dueDate: '',
      updatedAt: new Date().toISOString(),
      isPresent: true,
      notes: comment ? comment.trim() : undefined,
      comment: comment ? comment.trim() : undefined
    }
    const cleanNorm = cleanFolder.toLowerCase().replace(/[\s_\-]/g, '')
    const tasks = [...current.tasks.filter(t => !(t.safarName === safarName && t.dateFolder.toLowerCase().replace(/[\s_\-]/g, '') === cleanNorm)), newTask]
    const updatedAt = new Date().toISOString()
    const next: Snapshot = {
      ...current,
      tasks,
      deletedTasks: Array.from(delTasks),
      updatedAt,
      source: 'website'
    }
    applySnapshot(next)
    await persistSnapshot(next)
    await nexusChannelRef.current?.send({
      type: 'broadcast',
      event: 'task_add',
      payload: { safarName, dateFolder: cleanFolder, stage: 'editing', notes: comment ? comment.trim() : undefined }
    })
    try {
      await fetch('http://127.0.0.1:5253/api/tasks/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safarName, dateFolder: cleanFolder, stage: 'editing', notes: comment ? comment.trim() : undefined })
      })
    } catch {}
    setNotice(`Added date "${cleanFolder}" to ${safarName}.`)
  }

  // Permanently delete a Safar and all its tasks
  async function handleDeleteSafar(safarName: string) {
    if (!window.confirm(`Permanently remove "${safarName}" and all its task records?`)) return
    const normName = safarName.trim().toLowerCase()
    const delSafars = getDeletedSafars()
    delSafars.add(normName)
    saveDeletedSafars(delSafars)

    const overrides = getStageOverrides()
    for (const k of overrides.keys()) {
      if (k.startsWith(`${normName}::`)) overrides.delete(k)
    }
    saveStageOverrides(overrides)

    const current = snapshotRef.current
    const tasks = current.tasks.filter(t => t.safarName.trim().toLowerCase() !== normName)
    const safars = (current.safars || []).filter(s => s.safarName.trim().toLowerCase() !== normName)
    const updatedAt = new Date().toISOString()
    const next: Snapshot = {
      ...current,
      tasks,
      safars,
      deletedSafars: Array.from(delSafars),
      updatedAt,
      source: 'website'
    }
    if (selectedSafar.trim().toLowerCase() === normName) {
      setSelectedSafar('all')
    }
    applySnapshot(next)
    await persistSnapshot(next)
    await nexusChannelRef.current?.send({
      type: 'broadcast',
      event: 'safar_delete',
      payload: { safarName }
    })
    try {
      await fetch('http://127.0.0.1:5253/api/tasks/delete-safar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safarName })
      })
    } catch {}
    setNotice(`Removed ${safarName} permanently from all views.`)
  }

  // Reset and Rescan present folders on workstation disk
  async function handleResetAndRescan() {
    setNotice('Resetting tasks, clearing tombstones, and rescanning workstation disk...')
    try {
      localStorage.removeItem(localKey)
      localStorage.removeItem(deletedTasksKey)
      localStorage.removeItem(deletedSafarsKey)
      localStorage.removeItem(stageOverridesKey)
    } catch {}
    await nexusChannelRef.current?.send({
      type: 'broadcast',
      event: 'reset_and_rescan',
      payload: { requestedAt: new Date().toISOString() }
    })
    await trackerChannelRef.current?.send({
      type: 'broadcast',
      event: 'reset_and_rescan',
      payload: { requestedAt: new Date().toISOString(), forceRescan: true }
    })
    await trackerChannelRef.current?.send({
      type: 'broadcast',
      event: 'request_snapshot',
      payload: { requestedAt: new Date().toISOString(), forceRescan: true }
    })
    setNotice('Reset broadcast sent to One Tap Workstation. Rescanning disk for present folders...')
  }

  async function requestDesktopSync() {
    if (!trackerChannelRef.current) { setNotice('Cloud sync is not configured. Connect Supabase in the website settings first.'); return }
    const result = await trackerChannelRef.current.send({ type: 'broadcast', event: 'request_snapshot', payload: { requestedAt: new Date().toISOString() } })
    setNotice(result === 'ok' ? 'Sync requested from One Tap.' : 'One Tap is not connected. Showing the most recent saved snapshot.')
  }

  async function requestSyncFromSettings() {
    if (!trackerChannelRef.current) { setNotice('Connecting to the cloud sync channel. Try again in a moment.'); return }
    await trackerChannelRef.current.send({ type: 'broadcast', event: 'request_snapshot', payload: { requestedAt: new Date().toISOString() } })
    setNotice('Sync requested. One Tap will send a fresh Safar scan when it is online.')
  }

  // Sync URL on initial mount so home / displays /kanban or /dashboard professionally
  useEffect(() => {
    try {
      const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/'
      if (currentPath === '/' || currentPath === '') {
        const basePath = VIEW_PATHS[initialRoute.view] || '/kanban'
        const url = new URL(window.location.href)
        url.pathname = basePath
        if (initialRoute.safar && initialRoute.safar !== 'all') {
          url.searchParams.set('safar', initialRoute.safar)
        }
        window.history.replaceState({ view: initialRoute.view, safar: initialRoute.safar }, '', url.toString())
      }
    } catch {}

    const handlePopState = () => {
      const { view: targetView, safar } = parseUrlRoute()
      setView(targetView)
      if (safar) setSelectedSafar(safar)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [initialRoute])

  function navigateTo(next: View, safar?: string) {
    try {
      if ('vibrate' in navigator) navigator.vibrate(10)
    } catch {}
    setView(next)
    if (safar !== undefined) {
      setSelectedSafar(safar)
    }
    setMenuOpen(false)
    window.requestAnimationFrame(() => pageTitleRef.current?.focus())

    try {
      const basePath = VIEW_PATHS[next] || `/${next}`
      const url = new URL(window.location.href)
      url.pathname = basePath
      if (safar && safar !== 'all') {
        url.searchParams.set('safar', safar)
      } else {
        url.searchParams.delete('safar')
      }
      window.history.pushState({ view: next, safar }, '', url.toString())
    } catch {}
  }

  if (view === 'briefing') {
    if (initialLoading) {
      return (
        <div className="app-shell" style={{ display: 'block', minHeight: '100vh', background: 'transparent', padding: '24px 16px' }}>
          <SafarLoadingSkeleton variant="tracker" />
        </div>
      )
    }

    const targetSafarName = selectedSafar !== 'all' ? selectedSafar : effectiveOngoingSafar
    const norm = (targetSafarName || '').trim().toLowerCase()
    const cleanTarget = norm.replace(/[-_\s]+/g, ' ').trim()
    const cityKey = norm.replace(/^\d+[-_\s]*/, '').replace(/[-_\s]+/g, ' ').trim()

    const ongoingGroup =
      safarGroups.find(g => g.safarName.trim().toLowerCase() === norm) ||
      safarGroups.find(g => g.safarName.trim().toLowerCase().replace(/[-_\s]+/g, ' ').trim() === cleanTarget) ||
      safarGroups.find(g => {
        const gClean = g.safarName.trim().toLowerCase().replace(/[-_\s]+/g, ' ').trim()
        return gClean.includes(cleanTarget) || cleanTarget.includes(gClean)
      }) ||
      (cityKey && cityKey.length >= 3 ? safarGroups.find(g => g.safarName.trim().toLowerCase().includes(cityKey)) : undefined) ||
      activeSafarGroups.find(g => g.safarName === targetSafarName) ||
      (targetSafarName && targetSafarName !== 'all' ? {
        safarName: targetSafarName.replace(/[-_]/g, ' '),
        safarYear: targetSafarName.match(/^\d{4}/)?.[0] || '1448',
        totalDays: 0,
        total: 0,
        completed: 0,
        deliveredCount: 0,
        deliveredPercent: 0,
        editingPendingCount: 0,
        editingCount: 0,
        uploadPendingCount: 0,
        uploadedCount: 0,
        jameyaCount: 0,
        renderingCount: 0,
        uploadCount: 0,
        completedCount: 0,
        photoUploadedCount: 0,
        photoPercent: 0,
        isArchived: false,
        isDone: false,
        tasks: []
      } : activeSafarGroups[0])

    const deliveredDatesList = ongoingGroup ? ongoingGroup.tasks.filter(t => (t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed') && !isCameraOrAssetFolder(t.dateFolder) && isProperDateOrSessionFolder(t.dateFolder)).map(dateFolderName) : []
    const pendingDatesList = ongoingGroup ? ongoingGroup.tasks.filter(t => (t.stage === 'editing_pending' || t.stage === 'editing' || t.stage === 'upload_pending' || (t.stage as any) === 'rendering') && !isCameraOrAssetFolder(t.dateFolder) && isProperDateOrSessionFolder(t.dateFolder)).map(dateFolderName) : []
    const briefingSafars = safars.filter(Boolean)

    return (
      <div className="app-shell" style={{ display: 'block', minHeight: '100vh', background: 'transparent' }}>
        <SafarBriefingView
          safarName={ongoingGroup?.safarName || targetSafarName || 'Active Safar'}
          safarYear={ongoingGroup?.safarYear || '1448'}
          totalDates={ongoingGroup?.total || ongoingGroup?.tasks.length || 0}
          deliveredDates={ongoingGroup?.deliveredCount || 0}
          deliveredPercent={ongoingGroup?.deliveredPercent || 0}
          videoStats={{
            editingPending: ongoingGroup?.editingPendingCount || 0,
            inProgress: ongoingGroup?.editingCount || 0,
            uploadPending: ongoingGroup?.uploadPendingCount || 0,
            uploaded: ongoingGroup?.uploadedCount || 0,
            aljameaDone: ongoingGroup?.jameyaCount || 0,
            completed: ongoingGroup?.jameyaCount || 0,
            jameya: ongoingGroup?.jameyaCount || 0,
            upload: ongoingGroup?.uploadedCount || 0,
            rendering: ongoingGroup?.uploadPendingCount || 0,
            editing: ongoingGroup?.editingCount || 0
          }}
          photoStats={{
            uploaded: ongoingGroup?.tasks.filter(t => t.photoStage === 'uploaded' || t.photoUploaded).length || 0,
            givenToMurtaza: ongoingGroup?.tasks.filter(t => t.photoStage === 'given_to_murtaza').length || 0,
            editing: ongoingGroup?.tasks.filter(t => t.photoStage === 'edited' && !t.photoUploaded).length || 0
          }}
          deliveredDatesList={deliveredDatesList}
          pendingDatesList={pendingDatesList}
          connected={connected}
          lastUpdated={snapshot.updatedAt}
          availableSafars={briefingSafars}
          onSelectSafar={safar => {
            setSelectedSafar(safar)
            navigateTo('briefing', safar)
          }}
          onRefresh={requestDesktopSync}
          onCopyBriefing={() => copyDailyBriefing(ongoingGroup?.safarName || targetSafarName)}
          onShareWhatsApp={(format?: 'msg' | 'image') => shareDailyBriefingWhatsApp(ongoingGroup?.safarName || targetSafarName, format || 'msg')}
          onOpenTracker={() => navigateTo('ongoing', ongoingGroup?.safarName || targetSafarName)}
        />
        {briefingModalState && (
          <WhatsAppBriefingModal
            isOpen={Boolean(briefingModalState)}
            onClose={() => setBriefingModalState(null)}
            safarName={briefingModalState.safarName}
            initialTab={briefingModalState.initialTab}
            safarYear={ongoingGroup?.safarYear || '1448'}
            tasks={snapshot.tasks}
            publicOrigin={getPublicWebsiteOrigin()}
          />
        )}
        {notice && <div className="toast-note" role="status" aria-live="polite"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
      </div>
    )
  }

  if (view === 'widget') {
    const ongoingGroup = activeSafarGroups.find(g => g.safarName === effectiveOngoingSafar) || activeSafarGroups[0]
    return (
      <div className="app-shell" style={{ display: 'block', minHeight: '100vh', background: '#f8fafc' }}>
        <StandaloneWidgetView
          safarName={ongoingGroup?.safarName || effectiveOngoingSafar || 'Active Safar'}
          totalDates={ongoingGroup?.total || ongoingGroup?.tasks.length || 0}
          deliveredDates={ongoingGroup?.deliveredCount || 0}
          deliveredPercent={ongoingGroup?.deliveredPercent || 0}
          videoStats={{
            uploaded: ongoingGroup ? ongoingGroup.uploadCount + ongoingGroup.jameyaCount + ongoingGroup.completedCount : 0,
            rendered: ongoingGroup?.renderingCount || 0,
            editing: ongoingGroup?.editingCount || 0,
            completed: ongoingGroup?.completedCount || 0
          }}
          photoStats={{
            uploaded: ongoingGroup?.tasks.filter(t => t.photoStage === 'uploaded' || t.photoUploaded).length || 0,
            givenToMurtaza: ongoingGroup?.tasks.filter(t => t.photoStage === 'given_to_murtaza').length || 0,
            editing: ongoingGroup?.tasks.filter(t => t.photoStage === 'edited' && !t.photoUploaded).length || 0
          }}
          connected={connected}
          lastUpdated={snapshot.updatedAt}
          onRefresh={requestDesktopSync}
          onCopyBriefing={() => copyDailyBriefing(ongoingGroup?.safarName)}
          onShareWhatsApp={() => shareDailyBriefingWhatsApp(ongoingGroup?.safarName)}
          onNavigate={navigateTo}
        />
        {notice && <div className="toast-note" role="status" aria-live="polite"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* Luxury Cold Boot Loader */}
      {showBootLoader && <AppLoader message="Connecting to One Tap Workstation & Cloud Drive..." subtext="Syncing real-time Safar campaigns, render queues, and photo deliverables" />}

      {/* Passwordless Email Login Modal */}
      <EmailLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={user => {
          setCurrentUser(user)
          setIsLoginModalOpen(false)
          setNotice(`Welcome back, ${user.name}!`)
        }}
      />

      {/* WhatsApp Briefing Modal (Image Infographic / Formatted Message) */}
      {briefingModalState && (
        <WhatsAppBriefingModal
          isOpen={Boolean(briefingModalState)}
          onClose={() => setBriefingModalState(null)}
          safarName={briefingModalState.safarName}
          initialTab={briefingModalState.initialTab}
          safarYear={activeSafarGroups.find(g => g.safarName === briefingModalState.safarName)?.safarYear || '1448'}
          tasks={snapshot.tasks}
          publicOrigin={getPublicWebsiteOrigin()}
        />
      )}

      <a className="skip-link" href="#main-content">Skip to main content</a>
      <button type="button" className={`sidebar-overlay ${menuOpen ? 'visible' : ''}`} aria-label="Close navigation menu" onClick={() => { setMenuOpen(false); menuToggleRef.current?.focus() }} tabIndex={menuOpen ? 0 : -1} aria-hidden={!menuOpen}/>
      
      <aside ref={sidebarRef} id="workspace-navigation" className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Workspace navigation" aria-hidden={isMobile && !menuOpen}>
        <div className="brand" onClick={() => navigateTo('dashboard')} style={{ cursor: 'pointer' }} title="Go to Dashboard">
          <img src="/logo.svg" alt="One Tap Logo" style={{ width: 32, height: 32, borderRadius: 8, display: 'block' }} aria-hidden="true" />
          <div className="brand-copy">
            <strong>One Tap Studio</strong>
            <span className="brand-badge">MEDIA WORKSTATION</span>
          </div>
          <button ref={sidebarCloseRef} type="button" className="sidebar-close" aria-label="Close navigation menu" onClick={() => { setMenuOpen(false); menuToggleRef.current?.focus() }}><X size={18}/></button>
        </div>

        <nav aria-label="Main navigation" className="sidebar-nav">
          <div className="nav-caption">PRODUCTION PIPELINE</div>
          <button type="button" aria-current={view === 'dashboard' ? 'page' : undefined} className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => navigateTo('dashboard')}>
            <LayoutDashboard aria-hidden="true" size={17}/> <span>Dashboard</span>
          </button>
          <button type="button" aria-current={view === 'ongoing' ? 'page' : undefined} className={`nav-link ${view === 'ongoing' ? 'active' : ''}`} onClick={() => navigateTo('ongoing')}>
            <Kanban aria-hidden="true" size={17}/> <span>Kanban Board</span> <span className="nav-count">{activeSafarGroups.length}</span>
          </button>
          <button type="button" aria-current={view === 'photos' ? 'page' : undefined} className={`nav-link ${view === 'photos' ? 'active' : ''}`} onClick={() => navigateTo('photos')}>
            <Camera aria-hidden="true" size={17}/> <span>Photo Tracker</span>
          </button>
          <button type="button" aria-current={view === 'pipeline' ? 'page' : undefined} className={`nav-link ${view === 'pipeline' ? 'active' : ''}`} onClick={() => navigateTo('pipeline')}>
            <Film aria-hidden="true" size={17}/> <span>Media Pipeline</span>
          </button>

          <div className="nav-caption">CAMPAIGN ASSETS</div>
          <button type="button" aria-current={view === 'tracker' ? 'page' : undefined} className={`nav-link ${view === 'tracker' ? 'active' : ''}`} onClick={() => navigateTo('tracker')}>
            <CalendarDays aria-hidden="true" size={17}/> <span>Safars Directory</span> <span className="nav-count">{safars.length}</span>
          </button>
          <button type="button" aria-current={view === 'archive' ? 'page' : undefined} className={`nav-link ${view === 'archive' ? 'active' : ''}`} onClick={() => { setSelectedSafar('all'); setSelectedEditor('all'); navigateTo('archive') }}>
            <Archive aria-hidden="true" size={17}/> <span>Archived Safars</span> <span className="nav-count">{archiveSafarGroups.length}</span>
          </button>
          <button type="button" aria-current={view === 'editors' ? 'page' : undefined} className={`nav-link ${view === 'editors' ? 'active' : ''}`} onClick={() => navigateTo('editors')}>
            <Users aria-hidden="true" size={17}/> <span>Editor Team</span> <span className="nav-count">{editors.length}</span>
          </button>

          <div className="nav-caption">INSIGHTS & SYSTEM</div>
          <button type="button" aria-current={view === 'stats' ? 'page' : undefined} className={`nav-link ${view === 'stats' ? 'active' : ''}`} onClick={() => navigateTo('stats')}>
            <BarChart3 aria-hidden="true" size={17}/> <span>App Telemetry</span>
          </button>
          <button type="button" aria-current={(view as string) === 'widget' ? 'page' : undefined} className={`nav-link ${(view as string) === 'widget' ? 'active' : ''}`} onClick={() => navigateTo('widget')}>
            <Smartphone aria-hidden="true" size={17}/> <span>Live Widget</span>
          </button>
          <button type="button" aria-current={view === 'settings' ? 'page' : undefined} className={`nav-link ${view === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')}>
            <Settings2 aria-hidden="true" size={17}/> <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-engine-card">
            <div className="engine-status-row">
              <span className={`status-dot ${connected ? 'online' : ''}`} />
              <strong>Engine v26.11</strong>
            </div>
            <span className="engine-subtext">{connected ? 'Live Sync Active' : 'Local Storage Mode'}</span>
          </div>
        </div>
      </aside>

      <main id="main-content" className={`main-content view-${view}`} tabIndex={-1}>
        {/* Mobile Pull-to-Refresh Visual Indicator */}
        {(pullProgress > 0 || isRefreshing) && (
          <div
            style={{
              position: 'fixed',
              top: `${Math.min(pullProgress, 72)}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              padding: '7px 18px',
              borderRadius: '9999px',
              boxShadow: '0 6px 20px rgba(79, 70, 229, 0.4)',
              fontSize: '12px',
              fontWeight: 700,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              transition: isRefreshing ? 'top 0.25s ease' : 'top 0.08s ease',
              pointerEvents: 'none'
            }}
          >
            <RefreshCw size={14} className={isRefreshing || pullProgress >= 48 ? 'spinning' : ''} />
            <span>
              {isRefreshing
                ? 'Syncing latest data…'
                : pullProgress >= 48
                  ? 'Release to refresh'
                  : 'Pull down to refresh'}
            </span>
          </div>
        )}

        <header className="topbar">
          <div className="topbar-left">
            <button
              ref={menuToggleRef}
              type="button"
              className="menu-toggle"
              aria-label="Toggle navigation menu"
              onClick={() => setMenuOpen(prev => !prev)}
            >
              <Menu size={18} />
            </button>

            <div className="topbar-brand" onClick={() => navigateTo('dashboard')} title="One Tap Production Workspace" style={{ cursor: 'pointer' }}>
              <img src="/logo.svg" alt="One Tap Logo" style={{ width: 26, height: 26, borderRadius: 7, display: 'block' }} aria-hidden="true" />
              <div className="topbar-brand-text">
                <strong>One Tap Studio</strong>
                <span className="topbar-brand-sub">PRODUCTION</span>
              </div>
            </div>
            <span className="topbar-slash" aria-hidden="true">/</span>
            <span className="topbar-view-title">{shortViewTitles[view] || pageHeading[view]?.title}</span>
            {activeSafarGroups.length > 0 && (
              <div className="topbar-universal-safar-wrap">
                <select
                  className="topbar-universal-safar-select"
                  title="Universal Active Safar (Syncs Video, Photos & Dashboard)"
                  value={effectiveOngoingSafar}
                  onChange={e => {
                    handleSetOngoingSafar(e.target.value)
                    setSelectedSafar(e.target.value)
                  }}
                >
                  {activeSafarGroups.map(g => (
                    <option key={g.safarName} value={g.safarName}>{g.safarName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="topbar-actions">
            {/* Live Connection Status Pill */}
            <div className={`topbar-status-pill ${connected ? 'online' : 'offline'}`} title={connected ? 'Realtime live sync active with workstation' : 'Working in local cache mode'}>
              <span className="status-dot-pulse" />
              <span className="status-label">{connected ? 'Live Sync' : 'Local Mode'}</span>
            </div>

            {/* Sync Now Button */}
            <button
              type="button"
              className="topbar-btn-secondary"
              onClick={() => void requestDesktopSync()}
              title="Sync latest data from workstation"
            >
              <RefreshCw size={13} className={saving || isRefreshing ? 'spinning' : ''} />
              <span className="topbar-btn-text">Sync</span>
            </button>

            {/* WhatsApp Quick Briefing (Msg & Image Card) */}
            {effectiveOngoingSafar && (
              <div className="topbar-whatsapp-group">
                <button
                  type="button"
                  className="topbar-btn-whatsapp"
                  onClick={() => shareDailyBriefingWhatsApp(effectiveOngoingSafar, 'msg')}
                  title={`Send WhatsApp text message briefing for ${effectiveOngoingSafar}`}
                >
                  <MessageCircle size={13} />
                  <span className="topbar-btn-text">WhatsApp</span>
                </button>
                <button
                  type="button"
                  className="topbar-btn-whatsapp topbar-btn-image"
                  onClick={() => shareDailyBriefingWhatsApp(effectiveOngoingSafar, 'image')}
                  title={`Generate WhatsApp infographic status card for ${effectiveOngoingSafar}`}
                >
                  <ImageIcon size={13} />
                  <span className="topbar-btn-text">Image Card</span>
                </button>
              </div>
            )}

            {/* Sample Pipeline Badge / Toggle */}
            {snapshot.source === 'sample' ? (
              <button
                type="button"
                className="topbar-sample-badge"
                onClick={handleClearSampleData}
                title="Currently viewing sample data. Click to clear."
              >
                <Sparkles size={12} />
                <span>Sample Data (Clear)</span>
              </button>
            ) : snapshot.tasks.length === 0 ? (
              <button
                type="button"
                className="topbar-sample-badge load"
                onClick={handleLoadSampleData}
                title="Load sample production pipeline to preview the dashboard"
              >
                <Sparkles size={12} />
                <span>Load Sample Data</span>
              </button>
            ) : null}

            {/* User Profile / Email Sign In */}
            {currentUser ? (
              <div className="topbar-user-wrap">
                <div className="avatar" role="img" title={currentUser.email} aria-label={`Signed in as ${currentUser.name}`}>
                  {currentUser.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <button
                  type="button"
                  title="Sign out"
                  onClick={() => {
                    clearStoredAuthUser()
                    setCurrentUser(null)
                    setNotice('Logged out.')
                  }}
                  className="topbar-logout-btn"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="topbar-btn-login"
                onClick={() => setIsLoginModalOpen(true)}
                title="Sign in with Email"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        <div className="content-wrap">
          {view !== 'ongoing' && view !== 'photos' && (
            <div className={`page-heading ${view === 'dashboard' ? 'has-dedicated-hero' : ''}`}>
              <div>
                <div className="eyebrow">{pageHeading[view]?.eyebrow}</div>
                <h1 ref={pageTitleRef} tabIndex={-1}>{pageHeading[view]?.title}</h1>
                <p>{pageHeading[view]?.description}</p>
              </div>
            </div>
          )}

          {/* VIEW: ONGOING SAFAR KANBAN BOARD */}
          {view === 'ongoing' && (
            initialLoading ? <SafarLoadingSkeleton variant="kanban" /> : (
              <OngoingSafarKanban
                tasks={snapshot.tasks}
                safars={snapshot.safars}
                selectedSafar={selectedSafar === 'all' && effectiveOngoingSafar ? effectiveOngoingSafar : selectedSafar}
                onSelectSafar={safar => {
                  setSelectedSafar(safar)
                  handleSetOngoingSafar(safar)
                  navigateTo('ongoing', safar)
                }}
                onUpdateTask={(task, changes) => void updateTask(task as SafarTask, changes as Partial<SafarTask>)}
                onBatchUpdateTasks={items => void updateTasksBatch(items as any)}
                onRemoveTask={task => void handleRemoveTask(task as SafarTask)}
                onAddTask={(safarName, folder, comment) => void handleAddTask(safarName, folder, comment)}
                onResetAndRescan={handleResetAndRescan}
                onDeleteSafar={safarName => void handleDeleteSafar(safarName)}
                onOpenBriefingModal={(safar, format) => shareDailyBriefingWhatsApp(safar, format || 'msg')}
                saving={saving}
                connected={connected}
              />
            )
          )}

          {/* VIEW: PHOTO DATA & GOOGLE DRIVE SYNC */}
          {view === 'photos' && (
            <PhotoTracker
              tasks={snapshot.tasks}
              safars={snapshot.safars}
              selectedSafar={selectedSafar === 'all' && effectiveOngoingSafar ? effectiveOngoingSafar : selectedSafar}
              onSelectSafar={safar => {
                setSelectedSafar(safar)
                handleSetOngoingSafar(safar)
              }}
              onUpdateTask={(task, changes) => void updateTask(task as SafarTask, changes as Partial<SafarTask>)}
              onBatchUpdateTasks={items => void updateTasksBatch(items as any)}
              onRemoveTask={task => void handleRemoveTask(task as SafarTask)}
            />
          )}

          {/* VIEW: DASHBOARD */}
          {view === 'dashboard' && initialLoading ? <SafarLoadingSkeleton variant="dashboard"/> : view === 'dashboard' && <section className="dashboard-safars" aria-labelledby="dashboard-safars-title">
            {/* Studio Production Command Center Hero Banner (Desktop & Mobile) */}
            {(() => {
              const ongoingGroup = activeSafarGroups.find(g => g.safarName === effectiveOngoingSafar) || activeSafarGroups[0]
              if (!ongoingGroup) {
                return (
                  <div className="dashboard-hero-card empty-hero">
                    <div className="empty-hero-content">
                      <span className="mobile-hero-badge">⚡ PRODUCTION PIPELINE</span>
                      <h2 className="mobile-hero-title">Welcome to One Tap Studio</h2>
                      <p className="empty-hero-desc">
                        Live production pipeline, multi-batch video rendering, color grading, and Google Drive photo delivery workstation.
                      </p>
                      <div className="mobile-hero-actions-grid" style={{ maxWidth: 420, marginTop: 16 }}>
                        <button
                          type="button"
                          className="mobile-hero-sub-btn primary"
                          onClick={handleLoadSampleData}
                        >
                          <Sparkles size={14} />
                          <span>Load Sample Pipeline</span>
                        </button>
                        <button
                          type="button"
                          className="mobile-hero-sub-btn"
                          onClick={() => void requestDesktopSync()}
                        >
                          <RefreshCw size={14} />
                          <span>Sync from Desktop</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }
              const total = Math.max(ongoingGroup.total, 1)
              return (
                <div className="dashboard-hero-card mobile-ongoing-hero-card">
                  <div className="mobile-hero-top">
                    <div>
                      <span className="mobile-hero-badge">📍 ACTIVE ONGOING CAMPAIGN</span>
                      <h2 className="mobile-hero-title">{ongoingGroup.safarName}</h2>
                      <span className="mobile-hero-meta">
                        {hijriYearLabel(ongoingGroup.safarYear)} · {ongoingGroup.total} Scheduled Dates
                      </span>
                    </div>
                    <div className="mobile-hero-percent-badge" style={ongoingGroup.deliveredPercent === 100 ? { borderColor: 'rgba(5, 150, 105, 0.4)', background: 'rgba(5, 150, 105, 0.08)' } : undefined}>
                      <strong style={ongoingGroup.deliveredPercent === 100 ? { color: '#059669' } : undefined}>
                        {ongoingGroup.deliveredPercent}%
                      </strong>
                      <span style={ongoingGroup.deliveredPercent === 100 ? { color: '#047857', fontWeight: 700 } : undefined}>
                        {ongoingGroup.deliveredPercent === 100 ? '🏆 100% DONE' : 'Delivered'}
                      </span>
                    </div>
                  </div>

                  {/* Multi-stage Progress bar */}
                  <div className="multicolor-progress-bar" style={{ height: '9px', margin: '14px 0 10px 0', borderRadius: '999px', overflow: 'hidden' }}>
                    {ongoingGroup.editingCount > 0 && <span className="stage-segment stage-editing" style={{ width: `${(ongoingGroup.editingCount / total) * 100}%` }} title={`In Progress: ${ongoingGroup.editingCount}`} />}
                    {ongoingGroup.renderingCount > 0 && <span className="stage-segment stage-rendering" style={{ width: `${(ongoingGroup.renderingCount / total) * 100}%` }} title={`Render/Upload Pending: ${ongoingGroup.renderingCount}`} />}
                    {ongoingGroup.uploadCount > 0 && <span className="stage-segment stage-upload" style={{ width: `${(ongoingGroup.uploadCount / total) * 100}%` }} title={`Uploaded: ${ongoingGroup.uploadCount}`} />}
                    {ongoingGroup.jameyaCount > 0 && <span className="stage-segment stage-jameya" style={{ width: `${(ongoingGroup.jameyaCount / total) * 100}%` }} title={`AlJamea Done: ${ongoingGroup.jameyaCount}`} />}
                    {ongoingGroup.completedCount > 0 && <span className="stage-segment stage-completed" style={{ width: `${(ongoingGroup.completedCount / total) * 100}%` }} title={`Completed: ${ongoingGroup.completedCount}`} />}
                  </div>

                  {/* Status Chips */}
                  <div className="mobile-hero-stats-row">
                    <span>🎬 <strong>{ongoingGroup.uploadCount + ongoingGroup.jameyaCount + ongoingGroup.completedCount}/{ongoingGroup.total}</strong> Video Delivered</span>
                    <span>📷 <strong>{ongoingGroup.photoUploadedCount}/{ongoingGroup.total}</strong> Photos in Drive</span>
                  </div>

                  <div className="dashboard-hero-actions-container">
                    {/* WhatsApp Briefing Options: Text Message vs Visual Infographic Image Card */}
                    <div className="mobile-hero-whatsapp-group">
                      <button
                        type="button"
                        className="mobile-hero-whatsapp-btn whatsapp-opt-msg"
                        onClick={() => {
                          try { if ('vibrate' in navigator) navigator.vibrate(15) } catch {}
                          shareDailyBriefingWhatsApp(ongoingGroup.safarName, 'msg')
                        }}
                        title="Open formatted WhatsApp text message briefing"
                      >
                        <MessageCircle size={16} />
                        <span>WhatsApp Message</span>
                      </button>

                      <button
                        type="button"
                        className="mobile-hero-whatsapp-btn mobile-hero-whatsapp-img-btn whatsapp-opt-img"
                        onClick={() => {
                          try { if ('vibrate' in navigator) navigator.vibrate(15) } catch {}
                          shareDailyBriefingWhatsApp(ongoingGroup.safarName, 'image')
                        }}
                        title="Generate high-res Infographic status card image for WhatsApp"
                      >
                        <ImageIcon size={16} />
                        <span>Infographic Image</span>
                      </button>
                    </div>

                    <div className="mobile-hero-actions-grid">
                      <button
                        type="button"
                        className="mobile-hero-sub-btn"
                        onClick={() => {
                          try { if ('vibrate' in navigator) navigator.vibrate(10) } catch {}
                          copyDailyBriefing(ongoingGroup.safarName)
                        }}
                      >
                        <Share2 size={14} />
                        <span>Copy Status</span>
                      </button>

                      <button
                        type="button"
                        className="mobile-hero-sub-btn primary"
                        onClick={() => {
                          try { if ('vibrate' in navigator) navigator.vibrate(10) } catch {}
                          setSelectedSafar(ongoingGroup.safarName)
                          navigateTo('ongoing', ongoingGroup.safarName)
                        }}
                      >
                        <Kanban size={14} />
                        <span>Open Kanban →</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="dashboard-safars-heading">
              <div className="dashboard-title-row">
                <div>
                  <h2 id="dashboard-safars-title">Safars in production</h2>
                  <p>Multi-stage pipeline and completion across all campaigns.</p>
                </div>

                {/* Active Ongoing Safar Selector */}
                {activeSafarGroups.length > 0 && (
                  <div className="ongoing-safar-selector-pill">
                    <span className="selector-label">📍 Ongoing Safar:</span>
                    <select
                      value={effectiveOngoingSafar}
                      onChange={e => handleSetOngoingSafar(e.target.value)}
                      className="ongoing-select"
                      title="Set active ongoing safar for WhatsApp updates"
                    >
                      {activeSafarGroups.map(g => (
                        <option key={g.safarName} value={g.safarName}>{g.safarName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="dashboard-action-buttons">
                <div className="briefing-action-group">
                  <button
                    type="button"
                    className="briefing-btn-whatsapp"
                    onClick={() => shareDailyBriefingWhatsApp(effectiveOngoingSafar, 'msg')}
                    title={`Send text WhatsApp briefing for Ongoing Safar (${effectiveOngoingSafar})`}
                  >
                    <MessageCircle size={15} />
                    <span>WhatsApp Msg ({effectiveOngoingSafar ? effectiveOngoingSafar.split('-').slice(-1)[0].trim() : 'Ongoing'})</span>
                  </button>

                  <button
                    type="button"
                    className="briefing-btn-whatsapp briefing-btn-image"
                    onClick={() => shareDailyBriefingWhatsApp(effectiveOngoingSafar, 'image')}
                    title={`Generate status infographic image for Ongoing Safar (${effectiveOngoingSafar})`}
                  >
                    <ImageIcon size={15} />
                    <span>Image Card</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="briefing-btn-copy"
                  onClick={() => copyDailyBriefing(effectiveOngoingSafar)}
                  title={`Copy Ongoing Safar (${effectiveOngoingSafar}) briefing to clipboard`}
                >
                  <Share2 size={16} />
                  <span>Copy Ongoing Briefing</span>
                </button>

                <button
                  type="button"
                  className="button-secondary briefing-btn-secondary"
                  onClick={() => copyDailyBriefing('ALL')}
                  title="Copy full summary of all active Safars to clipboard"
                >
                  <span>Copy All Safars</span>
                </button>

                <button
                  type="button"
                  className="button-secondary briefing-btn-secondary"
                  onClick={() => { setSelectedSafar('all'); setSelectedEditor('all'); navigateTo('archive') }}
                >
                  <Archive aria-hidden="true" size={16}/> Archive <span className="nav-count">{archiveSafarGroups.length}</span>
                </button>
              </div>
            </div>

            {/* ── 1. Top KPI Cards Row (Desktop Aligned) ── */}
            <div className="tracker-kpi-grid" role="region" aria-label="Studio Production KPIs">
              <div
                className={`tracker-kpi-card kpi-total ${filter === 'all' && safarStatusFilter === 'all' ? 'active' : ''}`}
                onClick={() => applyStageFilter('all')}
                title="Total scheduled dates across active Safars (Click to view all)"
              >
                <div className="tracker-kpi-top">
                  <span className="tracker-kpi-label">TOTAL DAYS</span>
                  <span className="tracker-kpi-icon"><FileText size={16} /></span>
                </div>
                <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.totalDates} /></span>
              </div>

              <div
                className={`tracker-kpi-card kpi-pending ${filter === 'editing_pending' ? 'active' : ''}`}
                onClick={() => applyStageFilter('editing_pending')}
                title="Dates awaiting editing pass (Click to filter)"
              >
                <div className="tracker-kpi-top">
                  <span className="tracker-kpi-label">EDITING PENDING</span>
                  <span className="tracker-kpi-icon"><Clock size={16} /></span>
                </div>
                <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.editingPending} /></span>
              </div>

              <div
                className={`tracker-kpi-card kpi-editing ${filter === 'editing' ? 'active' : ''}`}
                onClick={() => applyStageFilter('editing')}
                title="Dates currently in editing / color grading (Click to filter)"
              >
                <div className="tracker-kpi-top">
                  <span className="tracker-kpi-label">IN PROGRESS</span>
                  <span className="tracker-kpi-icon"><Film size={16} /></span>
                </div>
                <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.editing} /></span>
              </div>

              <div
                className={`tracker-kpi-card kpi-upload-pending ${filter === 'upload_pending' ? 'active' : ''}`}
                onClick={() => applyStageFilter('upload_pending')}
                title="Dates rendered and pending upload (Click to filter)"
              >
                <div className="tracker-kpi-top">
                  <span className="tracker-kpi-label">UPLOAD PENDING</span>
                  <span className="tracker-kpi-icon"><Globe size={16} /></span>
                </div>
                <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.uploadPending} /></span>
              </div>

              <div
                className={`tracker-kpi-card kpi-uploaded ${filter === 'uploaded' ? 'active' : ''}`}
                onClick={() => applyStageFilter('uploaded')}
                title="Dates uploaded to cloud (Click to filter)"
              >
                <div className="tracker-kpi-top">
                  <span className="tracker-kpi-label">UPLOADED</span>
                  <span className="tracker-kpi-icon"><CheckCircle2 size={16} /></span>
                </div>
                <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.uploaded} /></span>
              </div>

              <div
                className={`tracker-kpi-card kpi-jameya ${filter === 'jameya' ? 'active' : ''}`}
                onClick={() => applyStageFilter('jameya')}
                title="Dates submitted and completed with AlJamea (Click to filter)"
              >
                <div className="tracker-kpi-top">
                  <span className="tracker-kpi-label">ALJAMEA DONE</span>
                  <span className="tracker-kpi-icon"><Building2 size={16} /></span>
                </div>
                <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.jameya} /></span>
              </div>

              <div
                className={`tracker-kpi-card kpi-safars-done ${safarStatusFilter === 'done' ? 'active' : ''}`}
                onClick={() => applySafarStatusFilter('done')}
                title="Safars with 100% of dates completed (Click to filter completed Safars)"
              >
                <div className="tracker-kpi-top">
                  <span className="tracker-kpi-label">SAFARS 100% DONE</span>
                  <span className="tracker-kpi-icon"><Award size={16} /></span>
                </div>
                <span className="tracker-kpi-val">
                  <AnimatedNumber value={studioStats.safarsDone} /> / {studioStats.totalSafars}
                </span>
              </div>
            </div>

            {/* ── 2. Safar-Level Status Row (Issue 3 / Desktop Aligned) ── */}
            <div className="tracker-safar-status-grid" role="region" aria-label="Safar-Level Status Overview">
              <span className="tracker-safar-status-label">
                📁 SAFAR-LEVEL STATUS
              </span>

              <button
                type="button"
                className={`kpi-safar-badge-btn kpi-safar-pending ${safarStatusFilter === 'pending' ? 'active' : ''}`}
                onClick={() => applySafarStatusFilter('pending')}
                title="Safars where all dates are still pending editing (Click to filter)"
              >
                <Clock size={13} />
                <span>SAFAR PENDING: <strong>{safarStatusBuckets.safarPending}</strong></span>
              </button>

              <button
                type="button"
                className={`kpi-safar-badge-btn kpi-safar-in-process ${safarStatusFilter === 'in_process' ? 'active' : ''}`}
                onClick={() => applySafarStatusFilter('in_process')}
                title="Safars actively in editing or render pipeline (Click to filter)"
              >
                <Film size={13} />
                <span>IN PROCESS: <strong>{safarStatusBuckets.inProcess}</strong></span>
              </button>

              <button
                type="button"
                className={`kpi-safar-badge-btn kpi-safar-to-delete ${safarStatusFilter === 'to_delete' ? 'active' : ''}`}
                onClick={() => applySafarStatusFilter('to_delete')}
                title="Safars fully delivered to Jamea / safe to clean up (Click to filter)"
              >
                <Trash2 size={13} />
                <span>TO DELETE / JAMEA: <strong>{safarStatusBuckets.toDelete}</strong></span>
              </button>

              <button
                type="button"
                className={`kpi-safar-badge-btn kpi-safar-to-upload ${safarStatusFilter === 'to_upload' ? 'active' : ''}`}
                onClick={() => applySafarStatusFilter('to_upload')}
                title="Safars where all tasks are rendered / ready to upload (Click to filter)"
              >
                <Globe size={13} />
                <span>TO UPLOAD: <strong>{safarStatusBuckets.toUpload}</strong></span>
              </button>

              <button
                type="button"
                className="kpi-safar-badge-btn kpi-safar-archived"
                onClick={() => navigateTo('archive')}
                title="Safars preserved in archive storage (Click to open archive)"
              >
                <Archive size={13} />
                <span>ARCHIVED SAFARS: <strong>{safarStatusBuckets.archived}</strong></span>
              </button>
            </div>

            {/* Overall Studio Multi-Color Stage Pipeline Bar */}
            {activeSafarGroups.length > 0 && (
              <div className="panel studio-pipeline-summary">
                <div className="studio-pipeline-header">
                  <div>
                    <span className="eyebrow">ACTIVE STUDIO WORKLOAD</span>
                    <h2>Production Stage Pipeline Distribution</h2>
                    <p>Live cross-stage status across all {activeSafarGroups.length} campaigns ({studioStats.totalDates} scheduled dates)</p>
                  </div>
                  <div className="studio-pipeline-badge">
                    <div className="badge-val-row">
                      <strong className="badge-number"><AnimatedNumber value={studioStats.percent} /></strong>
                      <span className="badge-pct-sym">%</span>
                    </div>
                    <span className="badge-label">Delivered</span>
                  </div>
                </div>
                <div className="multicolor-progress-bar large" role="progressbar" aria-label="Studio-wide pipeline stage distribution">
                  {studioStats.editingPending > 0 && <span className="stage-segment stage-editing_pending" style={{ width: `${(studioStats.editingPending / (studioStats.totalDates || 1)) * 100}%` }} title={`Editing Pending: ${studioStats.editingPending}`} />}
                  {studioStats.editing > 0 && <span className="stage-segment stage-editing" style={{ width: `${(studioStats.editing / (studioStats.totalDates || 1)) * 100}%` }} title={`In Progress: ${studioStats.editing}`} />}
                  {studioStats.uploadPending > 0 && <span className="stage-segment stage-upload_pending" style={{ width: `${(studioStats.uploadPending / (studioStats.totalDates || 1)) * 100}%` }} title={`Upload Pending: ${studioStats.uploadPending}`} />}
                  {studioStats.uploaded > 0 && <span className="stage-segment stage-uploaded" style={{ width: `${(studioStats.uploaded / (studioStats.totalDates || 1)) * 100}%` }} title={`Uploaded: ${studioStats.uploaded}`} />}
                  {studioStats.jameya > 0 && <span className="stage-segment stage-jameya" style={{ width: `${(studioStats.jameya / (studioStats.totalDates || 1)) * 100}%` }} title={`AlJamea Done: ${studioStats.jameya}`} />}
                </div>
                <div className="multicolor-legend">
                  <div className="legend-chip chip-editing_pending"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.editingPending} /></strong> Editing Pending</div>
                  <div className="legend-chip chip-editing"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.editing} /></strong> In Progress</div>
                  <div className="legend-chip chip-upload_pending"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.uploadPending} /></strong> Upload Pending</div>
                  <div className="legend-chip chip-uploaded"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.uploaded} /></strong> Uploaded</div>
                  <div className="legend-chip chip-jameya"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.jameya} /></strong> AlJamea Done</div>
                </div>
              </div>
            )}

            {!activeSafarGroups.length ? <div className="panel safar-empty-state"><h3>No active Safars yet</h3><p>Safar folders from One Tap will appear here as they sync.</p></div> : <div className="dashboard-safar-grid">{activeSafarGroups.map(group => {
              const total = Math.max(group.total, group.tasks.length, 1)
              const editingPendingPct = (group.editingPendingCount / total) * 100
              const editingPct = (group.editingCount / total) * 100
              const uploadPendingPct = (group.uploadPendingCount / total) * 100
              const uploadedPct = (group.uploadedCount / total) * 100
              const jameyaPct = (group.jameyaCount / total) * 100

              return <article className="panel dashboard-safar-card" key={group.safarName}>
                <div className="dashboard-safar-top">
                  <button type="button" className="dashboard-safar-title" onClick={() => { setSelectedSafar(group.safarName); navigateTo('ongoing') }}>
                    <span>{group.safarName}</span>
                    <small>{hijriYearLabel(group.safarYear)}{group.safarYear && ' · '}{group.total} {group.total === 1 ? 'date' : 'dates'}</small>
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <strong className="dashboard-safar-percent">
                      {group.deliveredPercent === 100 ? (
                        <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={16} color="#059669" /> 100%
                        </span>
                      ) : (
                        <><AnimatedNumber value={group.deliveredPercent} />%</>
                      )}
                    </strong>
                    <span className="dashboard-safar-percent-sub">
                      {group.deliveredPercent === 100 ? (
                        <span style={{ color: '#059669', fontWeight: 700 }}>100% DONE</span>
                      ) : (
                        <><AnimatedNumber value={group.deliveredCount} />/{group.total} Delivered</>
                      )}
                    </span>
                  </div>
                </div>

                {/* Multi-Color Stage Progress Bar */}
                <div className="multicolor-progress-wrap">
                  <div className="multicolor-progress-bar" role="progressbar" aria-label={`${group.safarName} pipeline progress`}>
                    {editingPendingPct > 0 && <span className="stage-segment stage-editing_pending" style={{ width: `${editingPendingPct}%` }} title={`Editing Pending: ${group.editingPendingCount} dates (${Math.round(editingPendingPct)}%)`} />}
                    {editingPct > 0 && <span className="stage-segment stage-editing" style={{ width: `${editingPct}%` }} title={`In Progress: ${group.editingCount} dates (${Math.round(editingPct)}%)`} />}
                    {uploadPendingPct > 0 && <span className="stage-segment stage-upload_pending" style={{ width: `${uploadPendingPct}%` }} title={`Upload Pending: ${group.uploadPendingCount} dates (${Math.round(uploadPendingPct)}%)`} />}
                    {uploadedPct > 0 && <span className="stage-segment stage-uploaded" style={{ width: `${uploadedPct}%` }} title={`Uploaded: ${group.uploadedCount} dates (${Math.round(uploadedPct)}%)`} />}
                    {jameyaPct > 0 && <span className="stage-segment stage-jameya" style={{ width: `${jameyaPct}%` }} title={`AlJamea Done: ${group.jameyaCount} dates (${Math.round(jameyaPct)}%)`} />}
                  </div>
                  <div className="multicolor-legend">
                    <span className="legend-chip chip-editing_pending" title="Editing Pending"><span className="chip-dot" /><AnimatedNumber value={group.editingPendingCount} /> EP</span>
                    <span className="legend-chip chip-editing" title="In Progress"><span className="chip-dot" /><AnimatedNumber value={group.editingCount} /> IP</span>
                    <span className="legend-chip chip-upload_pending" title="Upload Pending"><span className="chip-dot" /><AnimatedNumber value={group.uploadPendingCount} /> UP</span>
                    <span className="legend-chip chip-uploaded" title="Uploaded"><span className="chip-dot" /><AnimatedNumber value={group.uploadedCount} /> UL</span>
                    <span className="legend-chip chip-jameya" title="AlJamea Done"><span className="chip-dot" /><AnimatedNumber value={group.jameyaCount} /> AD</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: '#64748b', margin: '6px 0 8px', flexWrap: 'wrap' }}>
                  <span><strong><AnimatedNumber value={group.deliveredCount} /></strong> of <strong>{group.total}</strong> dates delivered · <AnimatedNumber value={group.progressPercent} />% pipeline</span>
                  <span style={{ color: '#047857', fontWeight: 700 }}>📷 Photos: <AnimatedNumber value={group.photoUploadedCount} />/{group.total} (<AnimatedNumber value={group.photoPercent} />%)</span>
                </div>

                {(() => {
                  const pendingDates = group.tasks.filter(task => {
                    const isPhotoUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded) || (task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed')
                    const isVideoUp = task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed'
                    return !(isPhotoUp && isVideoUp)
                  })
                  const completedCount = group.tasks.length - pendingDates.length

                  if (group.tasks.length === 0) {
                    return <p className="safar-preview-empty">Waiting for date folders to sync.</p>
                  }

                  if (pendingDates.length === 0) {
                    return (
                      <div className="safar-all-done-banner">
                        <CheckCircle2 size={15} color="#059669" />
                        <span>All {group.total} scheduled date deliverables are 100% completed & uploaded!</span>
                      </div>
                    )
                  }

                  return (
                    <>
                      <ul className="safar-preview-list safar-preview-list-scrollable">
                        {pendingDates.map(task => {
                          const isPhotoUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded) || (task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed')
                          const isVideoUp = task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed'
                          return (
                            <li key={task.id} className="safar-preview-row">
                              <div className="safar-preview-date">
                                <span className={`chip-dot dot-${task.stage}`} title={`Stage: ${task.stage}`} />
                                <strong title={dateFolderName(task)}>{dateFolderName(task)}</strong>
                              </div>
                              <div className="safar-preview-status">
                                {isPhotoUp && isVideoUp ? (
                                  <span className="media-sync-badge both-uploaded" title="Both Photo & Video Uploaded">
                                    <CheckCircle2 size={11} /> Both Uploaded
                                  </span>
                                ) : isPhotoUp && !isVideoUp ? (
                                  <span className="media-sync-badge photo-only" title="Photo Uploaded · Video Pending">
                                    <Camera size={11} /> Photo Up
                                  </span>
                                ) : !isPhotoUp && isVideoUp ? (
                                  <span className="media-sync-badge video-only" title="Video Uploaded · Photo Pending">
                                    <Film size={11} /> Video Up
                                  </span>
                                ) : (
                                  <span className={`stage-tag stage-${task.stage}`}>
                                    {STAGES.find(s => s.id === task.stage)?.label || task.stage}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="preview-remove-btn"
                                  title={`Exclude ${dateFolderName(task)}`}
                                  onClick={e => {
                                    e.stopPropagation()
                                    if (window.confirm(`Exclude "${dateFolderName(task)}" from tracking?`)) {
                                      void handleRemoveTask(task)
                                    }
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                      {completedCount > 0 && (
                        <div className="safar-completed-dates-note">
                          <span>✓ {completedCount} 100% completed dates hidden</span>
                        </div>
                      )}
                    </>
                  )
                })()}

                <div className="dashboard-safar-card-footer">
                  <div className="footer-left">
                    <button type="button" className="safar-open-link" onClick={() => { setSelectedSafar(group.safarName); navigateTo('ongoing') }}>
                      View Safar Kanban <ArrowUpRight aria-hidden="true" size={14}/>
                    </button>
                    {group.safarName === effectiveOngoingSafar ? (
                      <span className="badge-active-ongoing" title="Designated as Ongoing Safar">
                        ★ Active Ongoing
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetOngoingSafar(group.safarName)}
                        className="btn-set-ongoing"
                        title="Set this as the active ongoing safar for WhatsApp updates"
                      >
                        Set as Ongoing
                      </button>
                    )}
                  </div>
                  <div className="footer-right">
                    <button
                      type="button"
                      onClick={() => shareDailyBriefingWhatsApp(group.safarName, 'msg')}
                      className="btn-card-whatsapp"
                      title={`Send WhatsApp text status for ${group.safarName}`}
                    >
                      <MessageCircle size={13} /> Msg
                    </button>
                    <button
                      type="button"
                      onClick={() => shareDailyBriefingWhatsApp(group.safarName, 'image')}
                      className="btn-card-whatsapp btn-card-image"
                      title={`Generate WhatsApp infographic card for ${group.safarName}`}
                    >
                      <ImageIcon size={13} /> Image
                    </button>
                    <button
                      type="button"
                      title={`Remove ${group.safarName} from tracker`}
                      onClick={e => { e.stopPropagation(); void handleDeleteSafar(group.safarName) }}
                      className="button-safar-remove"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </article>
            })}</div>}
          </section>}

          {/* VIEW: SAFAR TRACKER / ARCHIVE */}
          {(view === 'tracker' || view === 'archive') && initialLoading ? <SafarLoadingSkeleton variant="tracker"/> : (view === 'tracker' || view === 'archive') && <section className="panel safar-view-panel" aria-labelledby="safar-view-title">
            <div className="panel-heading">
              <div><h2 id="safar-view-title">{view === 'archive' ? 'Archived Safars' : 'Active Safars by date'}</h2><p>Date folder names only. Open a Safar to update its assignments, stage, or due date.</p></div>
              <span className="safar-group-count">{view === 'archive' ? archiveSafarGroups.length : activeSafarGroups.length} Safars</span>
            </div>

            {/* ── Top KPI Cards Row for Quick Filter in Tracker ── */}
            {view === 'tracker' && (
              <>
                <div className="tracker-kpi-grid" role="region" aria-label="Studio Production KPIs">
                  <div
                    className={`tracker-kpi-card kpi-total ${filter === 'all' && safarStatusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => applyStageFilter('all')}
                    title="Show all dates"
                  >
                    <div className="tracker-kpi-top">
                      <span className="tracker-kpi-label">TOTAL DAYS</span>
                      <span className="tracker-kpi-icon"><FileText size={16} /></span>
                    </div>
                    <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.totalDates} /></span>
                  </div>

                  <div
                    className={`tracker-kpi-card kpi-pending ${filter === 'editing_pending' ? 'active' : ''}`}
                    onClick={() => applyStageFilter('editing_pending')}
                    title="Filter by Editing Pending"
                  >
                    <div className="tracker-kpi-top">
                      <span className="tracker-kpi-label">EDITING PENDING</span>
                      <span className="tracker-kpi-icon"><Clock size={16} /></span>
                    </div>
                    <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.editingPending} /></span>
                  </div>

                  <div
                    className={`tracker-kpi-card kpi-editing ${filter === 'editing' ? 'active' : ''}`}
                    onClick={() => applyStageFilter('editing')}
                    title="Filter by In Progress"
                  >
                    <div className="tracker-kpi-top">
                      <span className="tracker-kpi-label">IN PROGRESS</span>
                      <span className="tracker-kpi-icon"><Film size={16} /></span>
                    </div>
                    <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.editing} /></span>
                  </div>

                  <div
                    className={`tracker-kpi-card kpi-upload-pending ${filter === 'upload_pending' ? 'active' : ''}`}
                    onClick={() => applyStageFilter('upload_pending')}
                    title="Filter by Upload Pending"
                  >
                    <div className="tracker-kpi-top">
                      <span className="tracker-kpi-label">UPLOAD PENDING</span>
                      <span className="tracker-kpi-icon"><Globe size={16} /></span>
                    </div>
                    <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.uploadPending} /></span>
                  </div>

                  <div
                    className={`tracker-kpi-card kpi-uploaded ${filter === 'uploaded' ? 'active' : ''}`}
                    onClick={() => applyStageFilter('uploaded')}
                    title="Filter by Uploaded"
                  >
                    <div className="tracker-kpi-top">
                      <span className="tracker-kpi-label">UPLOADED</span>
                      <span className="tracker-kpi-icon"><CheckCircle2 size={16} /></span>
                    </div>
                    <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.uploaded} /></span>
                  </div>

                  <div
                    className={`tracker-kpi-card kpi-jameya ${filter === 'jameya' ? 'active' : ''}`}
                    onClick={() => applyStageFilter('jameya')}
                    title="Filter by AlJamea Done"
                  >
                    <div className="tracker-kpi-top">
                      <span className="tracker-kpi-label">ALJAMEA DONE</span>
                      <span className="tracker-kpi-icon"><Building2 size={16} /></span>
                    </div>
                    <span className="tracker-kpi-val"><AnimatedNumber value={studioStats.jameya} /></span>
                  </div>

                  <div
                    className={`tracker-kpi-card kpi-safars-done ${safarStatusFilter === 'done' ? 'active' : ''}`}
                    onClick={() => applySafarStatusFilter('done')}
                    title="Completed Safars (Click to filter 100% completed)"
                  >
                    <div className="tracker-kpi-top">
                      <span className="tracker-kpi-label">SAFARS 100% DONE</span>
                      <span className="tracker-kpi-icon"><Award size={16} /></span>
                    </div>
                    <span className="tracker-kpi-val">
                      <AnimatedNumber value={studioStats.safarsDone} /> / {studioStats.totalSafars}
                    </span>
                  </div>
                </div>

                {/* ── 2. Safar-Level Status Row (Tracker View) ── */}
                <div className="tracker-safar-status-grid" role="region" aria-label="Safar-Level Status Overview">
                  <span className="tracker-safar-status-label">
                    📁 SAFAR-LEVEL STATUS
                  </span>

                  <button
                    type="button"
                    className={`kpi-safar-badge-btn kpi-safar-pending ${safarStatusFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => applySafarStatusFilter('pending')}
                    title="Safars where all dates are still pending editing"
                  >
                    <Clock size={13} />
                    <span>SAFAR PENDING: <strong>{safarStatusBuckets.safarPending}</strong></span>
                  </button>

                  <button
                    type="button"
                    className={`kpi-safar-badge-btn kpi-safar-in-process ${safarStatusFilter === 'in_process' ? 'active' : ''}`}
                    onClick={() => applySafarStatusFilter('in_process')}
                    title="Safars actively in editing or render pipeline"
                  >
                    <Film size={13} />
                    <span>IN PROCESS: <strong>{safarStatusBuckets.inProcess}</strong></span>
                  </button>

                  <button
                    type="button"
                    className={`kpi-safar-badge-btn kpi-safar-to-delete ${safarStatusFilter === 'to_delete' ? 'active' : ''}`}
                    onClick={() => applySafarStatusFilter('to_delete')}
                    title="Safars fully delivered to Jamea (safe to clean up)"
                  >
                    <Trash2 size={13} />
                    <span>TO DELETE / JAMEA: <strong>{safarStatusBuckets.toDelete}</strong></span>
                  </button>

                  <button
                    type="button"
                    className={`kpi-safar-badge-btn kpi-safar-to-upload ${safarStatusFilter === 'to_upload' ? 'active' : ''}`}
                    onClick={() => applySafarStatusFilter('to_upload')}
                    title="Safars where all tasks are rendered / ready to upload"
                  >
                    <Globe size={13} />
                    <span>TO UPLOAD: <strong>{safarStatusBuckets.toUpload}</strong></span>
                  </button>

                  <button
                    type="button"
                    className="kpi-safar-badge-btn kpi-safar-archived"
                    onClick={() => navigateTo('archive')}
                    title="Safars preserved in archive storage"
                  >
                    <Archive size={13} />
                    <span>ARCHIVED SAFARS: <strong>{safarStatusBuckets.archived}</strong></span>
                  </button>
                </div>

                {/* ── Active Filter Bar ── */}
                {(filter !== 'all' || safarStatusFilter !== 'all' || selectedEditor !== 'all' || selectedSafar !== 'all' || search.trim()) && (
                  <div className="active-filter-indicator-bar anim-fade-in">
                    <div className="filter-pill-active">
                      <span>Filtered by:</span>
                      {filter !== 'all' && (
                        <span className="filter-badge stage-badge">
                          Stage: <strong>{STAGES.find(s => s.id === filter)?.label || filter}</strong>
                        </span>
                      )}
                      {safarStatusFilter !== 'all' && (
                        <span className="filter-badge safar-status-badge">
                          Safar Status: <strong>{safarStatusFilter === 'done' ? '100% Completed' : safarStatusFilter === 'pending' ? 'Safar Pending' : safarStatusFilter === 'in_process' ? 'In Process' : safarStatusFilter === 'to_delete' ? 'To Delete / Jamea' : 'To Upload'}</strong>
                        </span>
                      )}
                      {selectedEditor !== 'all' && (
                        <span className="filter-badge editor-badge">
                          Editor: <strong>{selectedEditor}</strong>
                        </span>
                      )}
                      {selectedSafar !== 'all' && (
                        <span className="filter-badge safar-badge">
                          Safar: <strong>{selectedSafar}</strong>
                        </span>
                      )}
                      {search.trim() && (
                        <span className="filter-badge search-badge">
                          Search: <strong>"{search.trim()}"</strong>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-clear-active-filter"
                      onClick={() => {
                        setFilter('all')
                        setSafarStatusFilter('all')
                        setSelectedEditor('all')
                        setSelectedSafar('all')
                        setSearch('')
                      }}
                      title="Clear all active filters"
                    >
                      <X size={13} /> Clear Filters
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="toolbar">
              <div className="search-box">
                <Search aria-hidden="true" size={16}/>
                <label className="visually-hidden" htmlFor="safar-search">Search Safar or date folder</label>
                <input id="safar-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Safar or date folder"/>
              </div>
              <div className="toolbar-actions">
                <label className="filter-select">
                  <ListFilter aria-hidden="true" size={15}/>
                  <span className="visually-hidden">Filter by stage</span>
                  <select aria-label="Filter by stage" value={filter} onChange={event => setFilter(event.target.value)}>
                    <option value="all">All stages</option>
                    {STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
                  </select>
                </label>
                <button type="button" className="button-secondary export-button" onClick={exportCsv}><Cloud aria-hidden="true" size={15}/> Export CSV</button>
              </div>
            </div>
            <div className="safar-groups-list">
              {visibleSafarGroups.map(group => <SafarProductionGroup key={group.safarName} group={group} expanded={expandedSafars.has(group.safarName)} onToggle={() => toggleSafarExpanded(group.safarName)} onArchive={archived => void setSafarArchived(group, archived)} onUpdateTask={(task, changes) => void updateTask(task, changes)} onDelete={safarName => void handleDeleteSafar(safarName)} onRemoveTask={task => void handleRemoveTask(task)}/>)}
              {!visibleSafarGroups.length && <div className="safar-empty-state">
                <h3>{view === 'archive' ? archiveSafarGroups.length ? 'No archived dates match' : 'Your archive is empty' : activeSafarGroups.length ? 'No dates match these filters' : 'No active Safars'}</h3>
                <p>{view === 'archive' ? archiveSafarGroups.length ? 'Clear the filters to see all archived Safars.' : 'Archived Safars will stay here until you restore them.' : activeSafarGroups.length ? 'Try a different search or stage filter.' : 'Safar folders from One Tap will appear here after sync.'}</p>
              </div>}
            </div>
            <div className="table-footer"><span>Folder names and task details sync across your devices.</span><span className="footer-sync">{saving ? 'Saving changes…' : connected ? 'Live sync connected' : 'Saved on this device'} <span className={`status-dot ${connected ? 'online' : ''}`}/></span></div>
          </section>}

          {/* VIEW: EDITORS */}
          {view === 'editors' && <section className="editor-overview" aria-label="Editor workloads">
            {editors.length === 0 ? <div className="panel editor-empty"><div className="empty-orb" aria-hidden="true"><Users size={24}/></div><div><h2>No editors assigned yet</h2><p>Assign a date to an editor in the table below. Their workload and stage progress will appear here.</p></div></div> : editors.map((editor, index) => {
              const assigned = tasksByEditor.get(editor) || []
              const done = assigned.filter(task => task.stage === 'jameya' || (task.stage as any) === 'completed' || task.stage === 'uploaded').length
              const activeStage = STAGES.find(stage => assigned.some(task => task.stage === stage.id))?.label || 'All caught up'
              return <button type="button" className="editor-card" key={editor} aria-pressed={selectedEditor === editor} onClick={() => setSelectedEditor(selectedEditor === editor ? 'all' : editor)}>
                <div className={`editor-avatar editor-avatar-${index % 4}`} aria-hidden="true"><UserRound size={19}/></div>
                <div className="editor-card-main"><span className="editor-label">EDITOR</span><strong>{editor}</strong><span className="editor-current">Current work · {activeStage}</span><div className="editor-progress" role="progressbar" aria-label={`${editor} submitted work`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={assigned.length ? Math.round(done / assigned.length * 100) : 0}><i aria-hidden="true" style={{ width: `${assigned.length ? done / assigned.length * 100 : 0}%` }}/></div></div>
                <div className="editor-stats"><strong>{assigned.length}</strong><span>ASSIGNED</span><small>{done} submitted</small></div><ArrowUpRight aria-hidden="true" size={17} className="editor-arrow"/>
              </button>
            })}
          </section>}

          {(view === 'editors' || view === 'pipeline') && <section className="panel task-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-title-row"><h2>{view === 'editors' ? selectedEditor === 'all' ? 'Editor assignments' : `${selectedEditor}’s assignments` : 'Production pipeline'}</h2><span className="live-label"><i/> LIVE</span></div>
                <p>{view === 'editors' ? 'Assigned date folders and current delivery stage.' : 'Select a task card to move it to the next production stage.'}</p>
              </div>
              <div className="panel-menu-wrap">
                <button className="more-button" onClick={() => setPanelMenuOpen(!panelMenuOpen)} aria-label="More options">{<MoreHorizontal size={19}/>}</button>
                {panelMenuOpen && <div className="panel-menu"><button onClick={() => { exportCsv(); setPanelMenuOpen(false) }}>Export filtered dates</button><button onClick={() => { setSearch(''); setFilter('all'); setSelectedEditor('all'); setSelectedSafar('all'); setPanelMenuOpen(false) }}>Clear filters</button></div>}
              </div>
            </div>
            <div className="toolbar">
              <div className="search-box"><Search aria-hidden="true" size={16}/><label className="visually-hidden" htmlFor="task-search">Search Safar or date folder</label><input id="task-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Safar or date folder"/></div>
              <div className="toolbar-actions"><label className="filter-select"><ListFilter aria-hidden="true" size={15}/><span className="visually-hidden">Filter by stage</span><select aria-label="Filter by stage" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All stages</option>{STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><button type="button" className="button-secondary export-button" onClick={exportCsv}><Cloud aria-hidden="true" size={15}/> Export CSV</button></div>
            </div>
            {view === 'pipeline' && <div className="pipeline-board">{STAGES.map((stage, index) => { const stageTasks = tasksByStage.get(stage.id) || []; return <section className="pipeline-column" key={stage.id}><div className="pipeline-column-head"><span className={`pipeline-dot pipeline-${stage.id}`}/><strong>{stage.label}</strong><span>{stageTasks.length}</span></div>{stageTasks.length === 0 ? <div className="pipeline-empty">No dates in this stage</div> : stageTasks.slice(0, pipelineLimits[stage.id]).map(task => <article className="pipeline-task" key={task.id}><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}><strong>{dateFolderName(task)}</strong><button type="button" title={`Exclude ${dateFolderName(task)}`} onClick={() => { if (window.confirm(`Exclude "${dateFolderName(task)}" from tracking?`)) void handleRemoveTask(task) }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}><Trash2 size={12} /></button></div><small>{task.safarName} · Editor {task.editorName || DEFAULT_EDITOR}{task.dueDate ? ` · Due ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</small>{index < STAGES.length - 1 && <button className="pipeline-advance" onClick={() => updateTask(task, { stage: STAGES[index + 1].id })}>Move to {STAGES[index + 1].label} →</button>}</article>)}{stageTasks.length > pipelineLimits[stage.id] && <button type="button" className="pipeline-load-more" onClick={() => setPipelineLimits(current => ({ ...current, [stage.id]: current[stage.id] + 40 }))}>Show next 40 ({stageTasks.length - pipelineLimits[stage.id]} remaining)</button>}</section> })}</div>}
            {view === 'editors' && <div className="table-wrap"><table><caption className="visually-hidden">Editor assignments, Safar date folders, and production progress</caption><thead><tr><th scope="col">DATE FOLDER</th><th scope="col">SAFAR</th><th scope="col">EDITOR</th><th scope="col">PROGRESS STAGE</th><th scope="col">DUE DATE</th><th scope="col">LAST UPDATED</th><th scope="col">ACTION</th></tr></thead><tbody>{visibleRows.map(task => <tr key={task.id}><td><strong className="event-folder-cell" title={dateFolderName(task)}>{dateFolderName(task)}</strong></td><td><span className="hijri-date">{task.safarName}</span></td><td><EditorAssignment label={`Editor assigned to ${dateFolderName(task)}`} value={task.editorName || ''} onSave={editorName => updateTask(task, { editorName })}/></td><td><select aria-label={`Production stage for ${dateFolderName(task)}`} className={`stage-select stage-${task.stage}`} value={task.stage} onChange={event => updateTask(task, { stage: event.target.value as Stage })}>{STAGES.map((stage, index) => <option key={stage.id} value={stage.id}>{index + 1}. {stage.label}</option>)}</select></td><td><input className="due-input" aria-label={`Due date for ${dateFolderName(task)}`} type="date" value={task.dueDate} onChange={event => updateTask(task, { dueDate: event.target.value })}/></td><td><span className="updated-cell"><time dateTime={task.updatedAt}>{new Date(task.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></span></td><td><button type="button" title={`Exclude ${dateFolderName(task)}`} onClick={() => { if (window.confirm(`Exclude "${dateFolderName(task)}" from tracking?`)) void handleRemoveTask(task) }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}><Trash2 size={13} /></button></td></tr>)}</tbody></table>{visibleRows.length === 0 && <div className="empty-state" role="status">No dates match your search.</div>}</div>}
            {view === 'editors' && rows.length > pageSize && <nav className="pagination" aria-label="Editor assignment pages"><button type="button" className="button-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" className="button-secondary" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
            <div className={`table-footer ${view === 'pipeline' ? 'hidden-view' : ''}`}><span>Showing <strong>{visibleRows.length}</strong> of <strong>{rows.length}</strong> matching dates</span><span className="footer-sync">{saving ? 'Syncing changes…' : connected ? 'Changes sync in real time' : 'Changes saved on this device'} <span className={`status-dot ${connected ? 'online' : ''}`}/></span></div>
          </section>}

          {/* VIEW: WORKSTATION & APP STATS */}
          {view === 'stats' && (
            <WorkstationStatsView
              tasks={snapshot.tasks}
              safars={snapshot.safars}
              activeSafarGroups={activeSafarGroups}
              lastUpdated={snapshot.updatedAt}
              connected={connected}
              onRefresh={requestDesktopSync}
              onNavigateToSafar={(safar) => {
                setSelectedSafar(safar)
                navigateTo('ongoing', safar)
              }}
            />
          )}

          {/* VIEW: SETTINGS */}
          {view === 'settings' && <section className="settings-grid">
            <article className="panel settings-card">
              <div className="settings-icon"><LogIn size={18}/></div>
              <div>
                <h2>Google Apps Script Authentication</h2>
                <p>{currentUser ? `Signed in as ${currentUser.name} (${currentUser.email}). You receive instant email verifications and status broadcasts.` : 'Sign in using your email address. A 6-digit one-time code will be dispatched directly to your inbox.'}</p>
                {currentUser ? (
                  <button className="button-secondary" onClick={() => { clearStoredAuthUser(); setCurrentUser(null); setNotice('Signed out successfully.') }}>Sign out</button>
                ) : (
                  <button className="button-secondary" onClick={() => setIsLoginModalOpen(true)}>Email Sign In</button>
                )}
              </div>
            </article>

            <article className="panel settings-card">
              <div className="settings-icon"><Bell size={18}/></div>
              <div>
                <h2>Milestone Alerts & WhatsApp</h2>
                <p>Upload completions automatically notify WhatsApp number <strong>{DEFAULT_WHATSAPP_PHONE}</strong> with remaining date counts and site links.</p>
                <button className="button-secondary" onClick={requestNotifications}>
                  {'Notification' in window && Notification.permission === 'granted' ? 'Device notifications enabled' : 'Enable device alerts'}
                </button>
              </div>
            </article>

            <article className="panel settings-card">
              <div className="settings-icon"><Cloud size={18}/></div>
              <div>
                <h2>One Tap cloud sync</h2>
                <p>{connected ? 'Connected. Safar folder names and task updates are arriving in real time.' : 'Sync connection is currently offline or not configured.'}</p>
                <span className="settings-status"><i className={`status-dot ${connected ? 'online' : ''}`}/>{connected ? 'Connected' : 'Waiting for connection'}</span>
                <button className="button-secondary settings-action" onClick={requestSyncFromSettings}>Sync from One Tap</button>
              </div>
            </article>

            <article className="panel settings-card">
              <div className="settings-icon"><RefreshCw size={18}/></div>
              <div>
                <h2>Workstation Disk Rescan</h2>
                <p>Purge ghost entries and enforce disk synchronization so only present folders appear in active stages.</p>
                <button className="button-secondary" onClick={handleResetAndRescan}>Reset & Clean Rescan</button>
              </div>
            </article>

            <article className="panel settings-card">
              <div className="settings-icon"><Sparkles size={18}/></div>
              <div>
                <h2>PWA Cache & Update Refresh</h2>
                <p>Purge local device caches, refresh the Service Worker, and hard-reload the newest version of the website.</p>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={async () => {
                    setNotice('Clearing PWA cache and fetching latest website build...')
                    try {
                      if ('caches' in window) {
                        const keys = await caches.keys()
                        await Promise.all(keys.map(k => caches.delete(k)))
                      }
                      if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations()
                        for (const r of regs) await r.unregister()
                      }
                    } catch {}
                    window.location.href = window.location.pathname + '?v=' + Date.now()
                  }}
                >
                  <RefreshCw size={14} /> Clear Cache & Update PWA
                </button>
              </div>
            </article>

            <article className="panel settings-card" style={{ gridColumn: 'span 2' }}>
              <div className="settings-icon"><Smartphone size={18}/></div>
              <div>
                <h2>Mobile Home Screen Widgets (PWA & iOS)</h2>
                <p>Track the active Safar with zero clicks right on your phone's home screen, lock screen, or desktop widget area.</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => navigateTo('widget')}
                  >
                    <Smartphone size={14} /> Open Live Widget View
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(`${window.location.origin}/widget`)
                        setNotice('✓ Widget URL copied to clipboard!')
                      }
                    }}
                  >
                    Copy Widget URL
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setShowScriptableGuide(prev => !prev)}
                  >
                    {showScriptableGuide ? 'Hide iOS Setup' : '🍎 Native iOS Widget (Scriptable)'}
                  </button>
                </div>

                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
                  <p style={{ margin: '4px 0' }}>
                    📱 <strong>Android PWA Shortcut:</strong> Long-press the One Tap app icon on your phone home screen, then touch & hold <strong>"Live Safar Widget"</strong> and drag it to place it anywhere on your home screen.
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    🌐 <strong>Zero-Domain Free API:</strong> Works natively with Vercel serverless endpoint <code>/api/widget-data</code>.
                  </p>
                </div>

                {showScriptableGuide && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '14px',
                      background: 'var(--surface-2, #f8fafc)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px', color: '#0f172a' }}>
                        iOS Scriptable Widget Code (1-Tap Copy)
                      </strong>
                      <button
                        type="button"
                        className="button-secondary"
                        style={{ height: '28px', fontSize: '10px' }}
                        onClick={() => {
                          const script = `// One Tap Safar Production Widget for iOS Scriptable\nconst API_URL = "${window.location.origin}/api/widget-data";\nconst req = new Request(API_URL);\nconst data = await req.loadJSON();\n\nconst widget = new ListWidget();\nwidget.backgroundColor = new Color("#ffffff");\n\nconst title = widget.addText(data.safarName || "Ongoing Safar");\ntitle.font = Font.boldSystemFont(14);\ntitle.textColor = new Color("#0f172a");\n\nwidget.addSpacer(4);\nconst pct = widget.addText(\`\${data.deliveredPercent || 0}% Delivered\`);\npct.font = Font.heavySystemFont(18);\npct.textColor = new Color("#4f46e5");\n\nconst dates = widget.addText(\`\${data.deliveredDates || 0} / \${data.totalDates || 0} dates completed\`);\ndates.font = Font.systemFont(11);\ndates.textColor = new Color("#64748b");\n\nwidget.addSpacer(6);\nconst video = widget.addText(\`🎬 Video: \${data.video?.uploaded || 0} Up · \${data.video?.rendered || 0} Ren\`);\nvideo.font = Font.mediumSystemFont(10);\nvideo.textColor = new Color("#334155");\n\nconst photo = widget.addText(\`📷 Photo: \${data.photos?.uploaded || 0} Up · \${data.photos?.givenToMurtaza || 0} Murtaza\`);\nphoto.font = Font.mediumSystemFont(10);\nphoto.textColor = new Color("#334155");\n\nwidget.url = "${window.location.origin}/widget";\nif (config.runsInWidget) {\n  Script.setWidget(widget);\n} else {\n  widget.presentMedium();\n}\nScript.complete();`
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(script)
                            setNotice('✓ Scriptable iOS code copied to clipboard!')
                          }
                        }}
                      >
                        📋 Copy Scriptable Code
                      </button>
                    </div>
                    <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 8px' }}>
                      Instructions: Install the free <strong>Scriptable</strong> app from the App Store, create a new script, paste this code, and add a Scriptable widget to your iPhone Home Screen.
                    </p>
                  </div>
                )}
              </div>
            </article>
          </section>}

          {notice && <div className="toast-note" role="status" aria-live="polite"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
        </div>
      </main>

      {/* Native-Feel Mobile Fixed Bottom Navigation Bar (Thumb Zone) */}
      <nav className="mobile-bottom-bar" aria-label="Mobile navigation">
        <button
          type="button"
          className={`mobile-nav-item ${view === 'dashboard' ? 'active' : ''}`}
          onClick={() => navigateTo('dashboard')}
          aria-label="Dashboard"
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${view === 'ongoing' ? 'active' : ''}`}
          onClick={() => navigateTo('ongoing')}
          aria-label="Pipeline"
        >
          <div className="mobile-nav-icon-wrap">
            <Kanban size={20} />
            {effectiveOngoingSafar ? (
              <span className="mobile-nav-badge">
                {snapshot.tasks.filter(t => t.safarName === effectiveOngoingSafar && t.stage !== 'jameya' && t.stage !== 'uploaded').length}
              </span>
            ) : null}
          </div>
          <span>Pipeline</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${view === 'photos' ? 'active' : ''}`}
          onClick={() => navigateTo('photos')}
          aria-label="Photos Tracker"
        >
          <div className="mobile-nav-icon-wrap">
            <Camera size={20} />
          </div>
          <span>Photos</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${view === 'tracker' ? 'active' : ''}`}
          onClick={() => navigateTo('tracker')}
          aria-label="Safars Tracker"
        >
          <CalendarDays size={20} />
          <span>Safars</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  )
}
