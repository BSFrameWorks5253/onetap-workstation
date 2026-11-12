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
  MessageCircle
} from 'lucide-react'
import OngoingSafarKanban, { type SafarTaskItem, isJunkSafarName } from './components/OngoingSafarKanban'
import PhotoTracker from './components/PhotoTracker'
import EmailLoginModal from './components/EmailLoginModal'
import StandaloneWidgetView from './components/StandaloneWidgetView'
import SafarBriefingView from './components/SafarBriefingView'
import AppLoader from './components/AppLoader'
import {
  sendWhatsAppAlert,
  getStoredAuthUser,
  clearStoredAuthUser,
  DEFAULT_WHATSAPP_PHONE,
  type AuthUser
} from './lib/googleAppsScript'

type Stage = 'editing' | 'rendering' | 'upload' | 'jameya' | 'completed'
export type PhotoStage = 'edited' | 'given_to_murtaza' | 'uploaded'
export const DEFAULT_EDITOR = 'Murtaza'
export const DEFAULT_PHOTO_EDITOR = 'Muffadal Peti'
type View = 'dashboard' | 'ongoing' | 'photos' | 'tracker' | 'archive' | 'editors' | 'pipeline' | 'settings' | 'widget' | 'briefing'

const VIEW_PATHS: Record<View, string> = {
  dashboard: '/',
  ongoing: '/kanban',
  photos: '/photos',
  tracker: '/tracker',
  archive: '/archive',
  editors: '/editors',
  pipeline: '/pipeline',
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
    if (candidate === 'settings') return { view: 'settings', safar: safarParam }
    if (candidate === 'widget' || candidate === 'home-widget' || candidate === 'live-widget') return { view: 'widget', safar: safarParam }
  } catch {}
  return { view: 'dashboard' }
}
type SafarTask = {
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
  editingCount: number
  renderingCount: number
  uploadCount: number
  jameyaCount: number
  completedCount: number
}

const STAGES: { id: Stage; label: string }[] = [
  { id: 'editing', label: 'In Editing' },
  { id: 'rendering', label: 'Rendered' },
  { id: 'upload', label: 'Upload' },
  { id: 'jameya', label: 'Submission to Al Jamea tus Saifiyah' },
  { id: 'completed', label: 'Completed Every Stage' }
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

export function extractCleanWebDate(name: string): string {
  if (!name) return ''
  const clean = name.trim()
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
    if (d >= 1 && d <= 31) return `Day ${d < 10 ? '0' + d : d}`
  }
  const dmMatch = clean.match(/^(\d{1,2})[\s._\-](\d{1,2})(?:[\s._\-]+.*)?$/)
  if (dmMatch) {
    const d = parseInt(dmMatch[1], 10)
    const m = parseInt(dmMatch[2], 10)
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return `Day ${d < 10 ? '0' + d : d}`
  }
  return clean.split(/[\s_]+_/)[0].replace(/[-_ ]*(?:waaz|isteqbal|majlis|misaaq|urs|ziyarat|event|morning|evening|night|session).*$/i, '').trim()
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
  const cleanDate = extractCleanWebDate(folder)
  if (cleanDate) return cleanDate
  const isDateFolder = /(?:^|\D)\d{4}[\s._-]\d{1,2}(?:[\s._-]\d{1,2})?|^\d{1,2}[\s._-]\d{1,2}(?:[\s._-]\d{4})?|^Day[_ -]?\d{1,3}/i.test(folder)
  return /\.[a-z\d]{2,6}$/i.test(folder) || !isDateFolder ? 'Date folder unavailable' : folder
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
      // User rule: non-present items must ONLY and ONLY appear in Stage 4: Submitted to Jameya!
      const defaultStage: Stage = isMissing ? 'jameya' : (STAGES.some(s => s.id === raw.stage) ? raw.stage : 'editing')
      const stage: Stage = override?.stage || defaultStage
      const editorName = override?.editorName !== undefined ? override.editorName : (raw.editorName?.trim() || DEFAULT_EDITOR)
      const dueDate = override?.dueDate !== undefined ? override.dueDate : String(raw.dueDate || '')
      const defaultPhotoStage: PhotoStage = (stage === 'upload' || stage === 'jameya' || stage === 'completed' || raw.photoUploaded) ? 'uploaded' : (raw.photoStage || 'edited')
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
      const stage = override?.stage || t.stage || existing.stage
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

function readLocal(): Snapshot {
  try { const value = localStorage.getItem(localKey); if (value) return normalizeSnapshot(JSON.parse(value) as Partial<Snapshot>) } catch {}
  return { tasks: [], folders: [], safars: [], updatedAt: '' }
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
  const editingPct = (group.editingCount / total) * 100
  const renderingPct = (group.renderingCount / total) * 100
  const uploadPct = (group.uploadCount / total) * 100
  const jameyaPct = (group.jameyaCount / total) * 100
  const completedPct = (group.completedCount / total) * 100

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
            {editingPct > 0 && <span className="stage-segment stage-editing" style={{ width: `${editingPct}%` }} title={`Editing: ${group.editingCount}`} />}
            {renderingPct > 0 && <span className="stage-segment stage-rendering" style={{ width: `${renderingPct}%` }} title={`Rendered: ${group.renderingCount}`} />}
            {uploadPct > 0 && <span className="stage-segment stage-upload" style={{ width: `${uploadPct}%` }} title={`Uploaded: ${group.uploadCount}`} />}
            {jameyaPct > 0 && <span className="stage-segment stage-jameya" style={{ width: `${jameyaPct}%` }} title={`Submitted to Jameya: ${group.jameyaCount}`} />}
            {completedPct > 0 && <span className="stage-segment stage-completed" style={{ width: `${completedPct}%` }} title={`Completed Every Stage: ${group.completedCount}`} />}
          </div>
          <div className="multicolor-legend compact">
            <span className="legend-chip chip-editing"><i className="chip-dot" /><AnimatedNumber value={group.editingCount} /> E</span>
            <span className="legend-chip chip-rendering"><i className="chip-dot" /><AnimatedNumber value={group.renderingCount} /> R</span>
            <span className="legend-chip chip-upload"><i className="chip-dot" /><AnimatedNumber value={group.uploadCount} /> U</span>
            <span className="legend-chip chip-jameya"><i className="chip-dot" /><AnimatedNumber value={group.jameyaCount} /> J</span>
            <span className="legend-chip chip-completed"><i className="chip-dot" /><AnimatedNumber value={group.completedCount} /> C</span>
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
        const isPhotoUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded) || (task.stage === 'upload' || task.stage === 'jameya' || task.stage === 'completed')
        const isVideoUp = task.stage === 'upload' || task.stage === 'jameya' || task.stage === 'completed'
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
                    stage: willUpload ? 'upload' : 'editing',
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
  const [initialLoading, setInitialLoading] = useState(() => {
    const cached = readLocal()
    return cached.tasks.length === 0 && cached.safars.length === 0
  })
  const [showBootLoader, setShowBootLoader] = useState(true)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

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
  const [pipelineLimits, setPipelineLimits] = useState<Record<Stage, number>>({ rendering: 40, editing: 40, upload: 40, jameya: 40, completed: 40 })

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
      const editingCount = tasks.filter(task => task.stage === 'editing').length
      const renderingCount = tasks.filter(task => task.stage === 'rendering').length
      const uploadCount = tasks.filter(task => task.stage === 'upload').length
      const jameyaCount = tasks.filter(task => task.stage === 'jameya').length
      const completedCount = tasks.filter(task => task.stage === 'completed').length
      const photoUploadedCount = tasks.filter(task => task.photoStage === 'uploaded' || task.photoUploaded).length
      const total = Math.max(tasks.length, Number(summary.totalDays) || 0)
      const finishedDates = jameyaCount + completedCount
      const isArchived = Boolean(summary.isArchived || (total > 0 && finishedDates >= total))
      const completed = isArchived ? total : finishedDates
      const deliveredCount = isArchived ? total : (uploadCount + jameyaCount + completedCount)
      const deliveredPercent = isArchived ? 100 : total ? Math.min(100, Math.round((deliveredCount / total) * 100)) : 0
      const progressPercent = isArchived ? 100 : total ? Math.min(100, Math.round(((editingCount * 20 + renderingCount * 45 + uploadCount * 75 + jameyaCount * 90 + completedCount * 100) / total) / 100 * 100)) : 0
      const photoPercent = total ? Math.min(100, Math.round((photoUploadedCount / total) * 100)) : 0
      return {
        ...summary,
        isArchived,
        isDone: Boolean(summary.isDone || isArchived),
        tasks,
        total,
        completed,
        percent: deliveredPercent,
        deliveredPercent,
        progressPercent,
        deliveredCount,
        photoUploadedCount,
        photoPercent,
        editingCount: isArchived ? 0 : editingCount,
        renderingCount: isArchived ? 0 : renderingCount,
        uploadCount: isArchived ? 0 : uploadCount,
        jameyaCount: isArchived ? 0 : jameyaCount,
        completedCount: isArchived ? total : completedCount
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
    let editing = 0
    let rendering = 0
    let upload = 0
    let jameya = 0
    let completed = 0
    let photoUploaded = 0
    for (const g of activeSafarGroups) {
      totalDates += g.total
      editing += g.editingCount
      rendering += g.renderingCount
      upload += g.uploadCount
      jameya += g.jameyaCount
      completed += g.completedCount
      photoUploaded += g.photoUploadedCount
    }
    const deliveredDates = upload + jameya + completed
    const deliveredPercent = totalDates > 0 ? Math.min(100, Math.round((deliveredDates / totalDates) * 100)) : 0
    const progressPercent = totalDates > 0 ? Math.min(100, Math.round(((editing * 20 + rendering * 45 + upload * 75 + jameya * 90 + completed * 100) / totalDates) / 100 * 100)) : 0
    const photoPercent = totalDates > 0 ? Math.min(100, Math.round((photoUploaded / totalDates) * 100)) : 0
    return { totalDates, editing, rendering, upload, jameya, completed, deliveredDates, deliveredPercent, progressPercent, photoUploaded, photoPercent, percent: deliveredPercent }
  }, [activeSafarGroups])
  const hasTaskFilters = Boolean(search.trim()) || filter !== 'all' || selectedEditor !== 'all'
  const visibleSafarGroups = matchingSafarGroups.filter(group =>
    (view === 'archive' ? group.isArchived : !group.isArchived && (selectedSafar === 'all' || group.safarName === selectedSafar)) &&
    (!hasTaskFilters || group.tasks.length > 0)
  )

  const pageHeading: Record<typeof view, { title: string; eyebrow: string; description: string }> = {
    dashboard: { title: 'Dashboard', eyebrow: 'LIVE SAFAR OVERVIEW', description: 'A compact view of each active Safar and its completion.' },
    ongoing: { title: 'Ongoing Safar (Kanban)', eyebrow: 'INTERACTIVE DELIVERY PIPELINE', description: 'Real-time 4-stage Kanban tracking dates from editing to Jameya submission.' },
    photos: { title: 'Photo Data Tracker', eyebrow: 'GOOGLE DRIVE & PHOTO SYNC', description: 'Track uploaded and pending photo dates with live Google Drive synchronization.' },
    tracker: { title: 'Safar tracker', eyebrow: 'SAFAR-BY-SAFAR PRODUCTION', description: 'Date folders, assignments, and progress grouped by Safar.' },
    archive: { title: 'Archived Safars', eyebrow: 'COMPLETED & STORED', description: 'Archived Safars remain available here and can be restored at any time.' },
    editors: { title: 'Editors & assignments', eyebrow: 'TEAM WORKLOAD', description: 'See who is working on each date and where it is in the pipeline.' },
    pipeline: { title: 'Media pipeline', eyebrow: 'PRODUCTION STAGES', description: 'Follow each date from rendering through AlJamea submission.' },
    settings: { title: 'Workspace settings', eyebrow: 'YOUR WORKSPACE', description: 'Manage alerts, login credentials, and check your One Tap sync connection.' },
    widget: { title: 'Live Safar Widget', eyebrow: 'MOBILE HOME SCREEN WIDGET', description: 'High-density live status card for home screens and lock screens.' },
    briefing: { title: 'Safar Status Briefing', eyebrow: 'OFFICIAL PRODUCTION UPDATE', description: 'Verified delivery milestones, stage counts, and date breakdown for this Safar.' }
  }

  const shortViewTitles: Record<typeof view, string> = {
    dashboard: 'Dashboard',
    ongoing: 'Kanban',
    photos: 'Photos',
    tracker: 'Safars',
    archive: 'Archive',
    editors: 'Editors',
    pipeline: 'Pipeline',
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
    window.addEventListener('focus', onVisibilityOrFocus)
    document.addEventListener('visibilitychange', onVisibilityOrFocus)
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
          status: isArchived ? 'submitted' : task.stage === 'upload' ? 'uploaded' : (task.stage === 'jameya' || task.stage === 'completed') ? 'submitted' : 'auto'
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
      const total = g.total || g.tasks.length
      const delivered = g.tasks.filter(t => t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed').length
      const pct = total > 0 ? Math.round((delivered / total) * 100) : 0

      lines.push(`📢 *Ongoing Safar Production Update (${g.safarYear || '1448'} H)*`)
      lines.push(`📍 *${g.safarName}*: *${pct}% Delivered* (${delivered}/${total} dates)`)
      lines.push('')

      // Video stage counts
      const videoCompleted = g.tasks.filter(t => t.stage === 'completed').length
      const videoJameya = g.tasks.filter(t => t.stage === 'jameya').length
      const videoUpload = g.tasks.filter(t => t.stage === 'upload').length
      const videoRendered = g.tasks.filter(t => t.stage === 'rendering').length
      const videoEditing = g.tasks.filter(t => t.stage === 'editing').length

      const videoParts: string[] = []
      if (videoCompleted > 0) videoParts.push(`${videoCompleted} Completed`)
      if (videoJameya > 0) videoParts.push(`${videoJameya} Al Jamea`)
      if (videoUpload > 0) videoParts.push(`${videoUpload} Uploaded`)
      if (videoRendered > 0) videoParts.push(`${videoRendered} Rendered`)
      if (videoEditing > 0) videoParts.push(`${videoEditing} In Editing`)

      if (videoParts.length > 0) {
        lines.push(`• 🎬 *Video Pipeline:* ${videoParts.join(' · ')}`)
      }

      // Photo stage counts
      const photoUploaded = g.tasks.filter(t => t.photoStage === 'uploaded' || t.photoUploaded || t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed').length
      const photoGiven = g.tasks.filter(t => t.photoStage === 'given_to_murtaza').length
      const photoEdited = g.tasks.filter(t => t.photoStage === 'edited' && !t.photoUploaded).length

      const photoParts: string[] = []
      if (photoUploaded > 0) photoParts.push(`${photoUploaded} Uploaded`)
      if (photoGiven > 0) photoParts.push(`${photoGiven} Given to Murtaza`)
      if (photoEdited > 0) photoParts.push(`${photoEdited} In Editing`)

      if (photoParts.length > 0) {
        lines.push(`• 📷 *Photo Pipeline:* ${photoParts.join(' · ')}`)
      }

      // Delivered & In Progress Dates
      const deliveredDates = g.tasks.filter(t => t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed').map(dateFolderName)
      const pendingDates = g.tasks.filter(t => t.stage === 'editing' || t.stage === 'rendering').map(dateFolderName)

      if (deliveredDates.length > 0) {
        lines.push('')
        lines.push(`✅ *Delivered Dates (${deliveredDates.length}):* ${deliveredDates.slice(-8).join(', ')}${deliveredDates.length > 8 ? ` +${deliveredDates.length - 8} more` : ''}`)
      }
      if (pendingDates.length > 0) {
        lines.push(`⏳ *Pending Video (${pendingDates.length}):* ${pendingDates.slice(0, 6).join(', ')}${pendingDates.length > 6 ? ` +${pendingDates.length - 6} more` : ''}`)
      }

      lines.push('')
      lines.push(`📱 *Interactive Briefing & Status Card:* ${window.location.origin}/briefing?safar=${encodeURIComponent(g.safarName)}`)
      lines.push(`🔗 *Live Workstation Tracker:* ${window.location.origin}/kanban?safar=${encodeURIComponent(g.safarName)}`)
      lines.push(`_Generated via One Tap Workstation_`)
      return lines.join('\n')
    }

    // Full multi-safar summary
    const lines: string[] = []
    lines.push('📢 *Safar Media Production Update (1448 H)*')
    lines.push('')

    activeSafarGroups.forEach(item => {
      const tot = item.total || item.tasks.length
      const del = item.tasks.filter(t => t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed').length
      const p = tot > 0 ? Math.round((del / tot) * 100) : 0
      lines.push(`📍 *${item.safarName}*: ${p}% Delivered (${del}/${tot} dates)`)

      const vParts: string[] = []
      if (item.uploadCount + item.jameyaCount + item.completedCount > 0) vParts.push(`${item.uploadCount + item.jameyaCount + item.completedCount} Uploaded`)
      if (item.renderingCount > 0) vParts.push(`${item.renderingCount} Rendered`)
      if (item.editingCount > 0) vParts.push(`${item.editingCount} In Editing`)
      if (vParts.length > 0) lines.push(`• 🎬 Video: ${vParts.join(' · ')}`)
    })

    const allDelivered = studioStats.deliveredDates
    const allTotal = studioStats.totalDates
    const allPct = studioStats.percent

    lines.push('')
    lines.push(`📊 *Overall Total:* ${allDelivered} of ${allTotal} dates delivered (${allPct}%)`)
    lines.push(`Generated via One Tap Workstation: ${window.location.origin}`)

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

  function shareDailyBriefingWhatsApp(forSafarName?: string) {
    const text = generateDailyBriefingText(forSafarName)
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
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
      if (task.stage === 'editing' || task.stage === 'rendering') {
        effectiveChanges.stage = 'upload'
      }
    } else if (changes.stage === 'upload' || changes.stage === 'jameya' || changes.stage === 'completed') {
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
        const status = (effectiveChanges.stage === 'jameya' || effectiveChanges.stage === 'completed') ? 'submitted' : effectiveChanges.stage === 'upload' ? 'uploaded' : 'auto'
        await nexusChannelRef.current?.send({ type: 'broadcast', event: 'task_mark_done', payload: { safarName: task.safarName, dateFolder: task.dateFolder, status } })

        // Trigger WhatsApp alert on completion of upload, jameya or completed
        if (effectiveChanges.stage === 'upload' || effectiveChanges.stage === 'jameya' || effectiveChanges.stage === 'completed') {
          const uploadedCount = next.tasks.filter(t => t.safarName === task.safarName && (t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed')).length
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
        const deliveredCount = next.tasks.filter(t => t.safarName === task.safarName && (t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed')).length
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
        if (task.stage === 'editing' || task.stage === 'rendering') {
          effectiveChanges.stage = 'upload'
        }
      } else if (changes.stage === 'upload' || changes.stage === 'jameya' || changes.stage === 'completed') {
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
          const status = (effectiveChanges.stage === 'jameya' || effectiveChanges.stage === 'completed') ? 'submitted' : effectiveChanges.stage === 'upload' ? 'uploaded' : 'auto'
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
  async function handleAddTask(safarName: string, dateFolder: string) {
    const current = snapshotRef.current
    const cleanFolder = dateFolder.trim()
    if (!cleanFolder) return

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
      isPresent: true
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
      payload: { safarName, dateFolder: cleanFolder, stage: 'editing' }
    })
    try {
      await fetch('http://127.0.0.1:5253/api/tasks/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safarName, dateFolder: cleanFolder, stage: 'editing' })
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
    const targetSafarName = selectedSafar !== 'all' ? selectedSafar : effectiveOngoingSafar
    const ongoingGroup = activeSafarGroups.find(g => g.safarName === targetSafarName) || activeSafarGroups[0]
    const deliveredDatesList = ongoingGroup ? ongoingGroup.tasks.filter(t => t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed').map(dateFolderName) : []
    const pendingDatesList = ongoingGroup ? ongoingGroup.tasks.filter(t => t.stage === 'editing' || t.stage === 'rendering').map(dateFolderName) : []

    return (
      <div className="app-shell" style={{ display: 'block', minHeight: '100vh', background: 'radial-gradient(ellipse at 83% 8%, rgba(222, 212, 183, 0.18), transparent 36%), #f5f4ee' }}>
        <SafarBriefingView
          safarName={ongoingGroup?.safarName || targetSafarName || 'Active Safar'}
          safarYear={ongoingGroup?.safarYear || '1448'}
          totalDates={ongoingGroup?.total || ongoingGroup?.tasks.length || 0}
          deliveredDates={ongoingGroup?.deliveredCount || 0}
          deliveredPercent={ongoingGroup?.deliveredPercent || 0}
          videoStats={{
            completed: ongoingGroup?.completedCount || 0,
            jameya: ongoingGroup?.jameyaCount || 0,
            upload: ongoingGroup?.uploadCount || 0,
            rendering: ongoingGroup?.renderingCount || 0,
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
          onRefresh={requestDesktopSync}
          onCopyBriefing={() => copyDailyBriefing(ongoingGroup?.safarName)}
          onShareWhatsApp={() => shareDailyBriefingWhatsApp(ongoingGroup?.safarName)}
          onOpenTracker={() => navigateTo('ongoing')}
        />
        {notice && <div className="toast-note" role="status" aria-live="polite"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
      </div>
    )
  }

  if (view === 'widget') {
    const ongoingGroup = activeSafarGroups.find(g => g.safarName === effectiveOngoingSafar) || activeSafarGroups[0]
    return (
      <div className="app-shell" style={{ display: 'block', minHeight: '100vh', background: '#f5f4ee' }}>
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

      <a className="skip-link" href="#main-content">Skip to main content</a>
      <button type="button" className={`sidebar-overlay ${menuOpen ? 'visible' : ''}`} aria-label="Close navigation menu" onClick={() => { setMenuOpen(false); menuToggleRef.current?.focus() }} tabIndex={menuOpen ? 0 : -1} aria-hidden={!menuOpen}/>
      
      <aside ref={sidebarRef} id="workspace-navigation" className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Workspace navigation" aria-hidden={isMobile && !menuOpen}>
        <div className="brand" onClick={() => navigateTo('dashboard')} style={{ cursor: 'pointer' }} title="Go to Dashboard">
          <div className="brand-mark" aria-hidden="true">1</div>
          <div><strong>One Tap</strong><span>PRODUCTION WORKSPACE</span></div>
          <button ref={sidebarCloseRef} type="button" className="sidebar-close" aria-label="Close navigation menu" onClick={() => { setMenuOpen(false); menuToggleRef.current?.focus() }}><X size={18}/></button>
        </div>

        <nav aria-label="Main navigation">
          <div className="nav-caption">DELIVERY PIPELINE</div>
          <button type="button" aria-current={view === 'dashboard' ? 'page' : undefined} className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => navigateTo('dashboard')}>
            <LayoutDashboard aria-hidden="true" size={17}/> Dashboard
          </button>
          <button type="button" aria-current={view === 'ongoing' ? 'page' : undefined} className={`nav-link ${view === 'ongoing' ? 'active' : ''}`} onClick={() => navigateTo('ongoing')}>
            <Kanban aria-hidden="true" size={17}/> Ongoing Safar <span className="nav-count">{activeSafarGroups.length}</span>
          </button>
          <button type="button" aria-current={view === 'photos' ? 'page' : undefined} className={`nav-link ${view === 'photos' ? 'active' : ''}`} onClick={() => navigateTo('photos')}>
            <Camera aria-hidden="true" size={17}/> Photo Tracker
          </button>
          <button type="button" aria-current={view === 'tracker' ? 'page' : undefined} className={`nav-link ${view === 'tracker' ? 'active' : ''}`} onClick={() => navigateTo('tracker')}>
            <CalendarDays aria-hidden="true" size={17}/> Safar tracker <span className="nav-count">{safars.length}</span>
          </button>
          <button type="button" aria-current={view === 'archive' ? 'page' : undefined} className={`nav-link ${view === 'archive' ? 'active' : ''}`} onClick={() => { setSelectedSafar('all'); setSelectedEditor('all'); navigateTo('archive') }}>
            <Archive aria-hidden="true" size={17}/> Archived Safars <span className="nav-count">{archiveSafarGroups.length}</span>
          </button>
          <button type="button" aria-current={view === 'editors' ? 'page' : undefined} className={`nav-link ${view === 'editors' ? 'active' : ''}`} onClick={() => navigateTo('editors')}>
            <Users aria-hidden="true" size={17}/> Editors <span className="nav-count">{editors.length}</span>
          </button>
          <button type="button" aria-current={view === 'pipeline' ? 'page' : undefined} className={`nav-link ${view === 'pipeline' ? 'active' : ''}`} onClick={() => navigateTo('pipeline')}>
            <Film aria-hidden="true" size={17}/> Media pipeline
          </button>

          <div className="side-divider" />
          <div className="nav-caption">YOUR SAFARS</div>
          {safars.map(name => (
            <button
              type="button"
              key={name}
              aria-pressed={selectedSafar === name}
              className={`safar-link ${selectedSafar === name ? 'selected' : ''}`}
              onClick={() => {
                const target = selectedSafar === name ? 'all' : name
                setSelectedSafar(target)
                navigateTo('ongoing', target)
              }}
            >
              <span className="safar-dot" aria-hidden="true"/>{name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sync-status" role="status">
            <span className={`status-dot ${connected ? 'online' : ''}`} aria-hidden="true"/>
            <div>
              <strong>{connected ? 'Cloud connected' : 'Offline mode'}</strong>
              <span>{snapshot.updatedAt ? `Synced ${new Date(snapshot.updatedAt).toLocaleString()}` : 'Waiting for first sync'}</span>
            </div>
          </div>
          <button type="button" aria-current={view === 'settings' ? 'page' : undefined} className={`nav-link ${view === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')}>
            <Settings2 aria-hidden="true" size={17}/> Settings
          </button>
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
            <button ref={menuToggleRef} type="button" className="icon-button menu-toggle" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-controls="workspace-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              <Menu aria-hidden="true" size={20}/>
            </button>
            <div className="topbar-mobile-brand" onClick={() => navigateTo('dashboard')} title="One Tap Production Workspace" style={{ cursor: 'pointer' }}>
              <div className="brand-mark small" style={{ width: '26px', height: '26px', fontSize: '12px', borderRadius: '7px' }} aria-hidden="true">1</div>
              <strong>One Tap</strong>
            </div>
            <div className="breadcrumb mobile-view-title" aria-label="Breadcrumb">
              <span className="mobile-title-slash" aria-hidden="true">/</span>
              <span className={`status-dot ${connected ? 'online' : ''}`} title={connected ? 'Live Sync Online' : 'Local Storage Mode'} />
              <strong>{shortViewTitles[view] || pageHeading[view]?.title}</strong>
            </div>
          </div>
          
          <div className="topbar-actions">
            {/* Quick Sync Button */}
            <button
              type="button"
              className="notification-button mobile-sync-btn"
              onClick={() => {
                try { if ('vibrate' in navigator) navigator.vibrate(10) } catch {}
                void requestDesktopSync()
              }}
              title={connected ? "Connected to Cloud Sync · Click to refresh" : "Sync with One Tap Workstation"}
            >
              <Cloud aria-hidden="true" size={16} />
              <span className="mobile-sync-label">Sync</span>
            </button>

            {/* Mobile PWA Install Button */}
            {!isStandalone && (
              <button
                type="button"
                className="notification-button install-pwa-btn"
                onClick={handleInstallApp}
                title="Install One Tap to your phone or desktop home screen"
                style={{
                  backgroundColor: 'rgba(79, 70, 229, 0.08)',
                  borderColor: 'rgba(79, 70, 229, 0.25)',
                  color: '#4f46e5',
                  fontWeight: 600
                }}
              >
                <Smartphone aria-hidden="true" size={16} />
                <span className="install-label">Install</span>
              </button>
            )}

            <button type="button" className="notification-button notification-bell-btn" onClick={requestNotifications}>
              <Bell aria-hidden="true" size={17}/><span>Alerts</span>
            </button>

            {/* User Profile / Email Sign-In via Google Apps Script */}
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="topbar-signin-btn"
              >
                <LogIn size={14} />
                <span className="signin-label">Sign in</span>
              </button>
            )}
          </div>
        </header>

        <div className="content-wrap">
          <div className={`page-heading ${view === 'ongoing' || view === 'photos' || view === 'dashboard' ? 'has-dedicated-hero' : ''}`}>
            <div>
              <div className="eyebrow"><span className="live-pip" aria-hidden="true"/> {pageHeading[view]?.eyebrow}</div>
              <h1 ref={pageTitleRef} tabIndex={-1}>{pageHeading[view]?.title}</h1>
              <p>{pageHeading[view]?.description}</p>
            </div>
            <div className="heading-actions">
              {view !== 'settings' && <button type="button" className="button-secondary" onClick={requestNotifications}><Bell aria-hidden="true" size={16}/> Enable alerts</button>}
              <button type="button" className="button-secondary" onClick={requestDesktopSync}><Cloud aria-hidden="true" size={16}/> Sync now</button>
            </div>
          </div>

          {/* VIEW: ONGOING SAFAR KANBAN BOARD */}
          {view === 'ongoing' && (
            initialLoading ? <SafarLoadingSkeleton variant="kanban" /> : (
              <OngoingSafarKanban
                tasks={snapshot.tasks}
                safars={snapshot.safars}
                selectedSafar={selectedSafar === 'all' && effectiveOngoingSafar ? effectiveOngoingSafar : selectedSafar}
                onSelectSafar={safar => navigateTo('ongoing', safar)}
                onUpdateTask={(task, changes) => void updateTask(task as SafarTask, changes as Partial<SafarTask>)}
                onBatchUpdateTasks={items => void updateTasksBatch(items as any)}
                onRemoveTask={task => void handleRemoveTask(task as SafarTask)}
                onAddTask={(safarName, folder) => void handleAddTask(safarName, folder)}
                onResetAndRescan={handleResetAndRescan}
                onDeleteSafar={safarName => void handleDeleteSafar(safarName)}
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
              selectedSafar={selectedSafar}
              onSelectSafar={safar => setSelectedSafar(safar)}
              onUpdateTask={(task, changes) => void updateTask(task as SafarTask, changes as Partial<SafarTask>)}
              onBatchUpdateTasks={items => void updateTasksBatch(items as any)}
              onRemoveTask={task => void handleRemoveTask(task as SafarTask)}
            />
          )}

          {/* VIEW: DASHBOARD */}
          {view === 'dashboard' && initialLoading ? <SafarLoadingSkeleton variant="dashboard"/> : view === 'dashboard' && <section className="dashboard-safars" aria-labelledby="dashboard-safars-title">
            {/* Dedicated Mobile Ongoing Safar Hero Card (Visible on <= 768px) */}
            {(() => {
              const ongoingGroup = activeSafarGroups.find(g => g.safarName === effectiveOngoingSafar) || activeSafarGroups[0]
              if (!ongoingGroup) return null
              const total = Math.max(ongoingGroup.total, 1)
              return (
                <div className="mobile-ongoing-hero-card">
                  <div className="mobile-hero-top">
                    <div>
                      <span className="mobile-hero-badge">📍 ACTIVE ONGOING SAFAR</span>
                      <h2 className="mobile-hero-title">{ongoingGroup.safarName}</h2>
                      <span className="mobile-hero-meta">
                        {hijriYearLabel(ongoingGroup.safarYear)} · {ongoingGroup.total} Scheduled Dates
                      </span>
                    </div>
                    <div className="mobile-hero-percent-badge">
                      <strong>{ongoingGroup.deliveredPercent}%</strong>
                      <span>Delivered</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="multicolor-progress-bar" style={{ height: '8px', margin: '12px 0 8px 0' }}>
                    {ongoingGroup.editingCount > 0 && <span className="stage-segment stage-editing" style={{ width: `${(ongoingGroup.editingCount / total) * 100}%` }} />}
                    {ongoingGroup.renderingCount > 0 && <span className="stage-segment stage-rendering" style={{ width: `${(ongoingGroup.renderingCount / total) * 100}%` }} />}
                    {ongoingGroup.uploadCount > 0 && <span className="stage-segment stage-upload" style={{ width: `${(ongoingGroup.uploadCount / total) * 100}%` }} />}
                    {ongoingGroup.jameyaCount > 0 && <span className="stage-segment stage-jameya" style={{ width: `${(ongoingGroup.jameyaCount / total) * 100}%` }} />}
                    {ongoingGroup.completedCount > 0 && <span className="stage-segment stage-completed" style={{ width: `${(ongoingGroup.completedCount / total) * 100}%` }} />}
                  </div>

                  {/* Status Chips */}
                  <div className="mobile-hero-stats-row">
                    <span>🎬 <strong>{ongoingGroup.uploadCount + ongoingGroup.jameyaCount + ongoingGroup.completedCount}/{ongoingGroup.total}</strong> Video Done</span>
                    <span>📷 <strong>{ongoingGroup.photoUploadedCount}/{ongoingGroup.total}</strong> Photos Done</span>
                  </div>

                  {/* 1-Tap WhatsApp Briefing Trigger */}
                  <button
                    type="button"
                    className="mobile-hero-whatsapp-btn"
                    onClick={() => {
                      try { if ('vibrate' in navigator) navigator.vibrate(15) } catch {}
                      shareDailyBriefingWhatsApp(ongoingGroup.safarName)
                    }}
                  >
                    <MessageCircle size={18} />
                    <span>Send Daily WhatsApp Briefing</span>
                  </button>

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
                <button
                  type="button"
                  className="briefing-btn-whatsapp"
                  onClick={() => shareDailyBriefingWhatsApp(effectiveOngoingSafar)}
                  title={`Send Ongoing Safar (${effectiveOngoingSafar}) briefing to WhatsApp`}
                >
                  <MessageCircle size={16} />
                  <span>WhatsApp Briefing ({effectiveOngoingSafar ? effectiveOngoingSafar.split('-').slice(-1)[0].trim() : 'Ongoing'})</span>
                </button>

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

            {/* Overall Studio Multi-Color Stage Pipeline Bar */}
            {activeSafarGroups.length > 0 && (
              <div className="panel studio-pipeline-summary">
                <div className="studio-pipeline-header">
                  <div>
                    <span className="eyebrow"><span className="live-pip" aria-hidden="true" /> ACTIVE STUDIO WORKLOAD</span>
                    <h2>Production Stage Pipeline Distribution</h2>
                    <p>Live cross-stage status across all {activeSafarGroups.length} campaigns ({studioStats.totalDates} scheduled dates)</p>
                  </div>
                  <div className="studio-pipeline-badge">
                    <strong><AnimatedNumber value={studioStats.percent} />%</strong>
                    <span>Delivered</span>
                  </div>
                </div>
                <div className="multicolor-progress-bar large" role="progressbar" aria-label="Studio-wide pipeline stage distribution">
                  {studioStats.editing > 0 && <span className="stage-segment stage-editing" style={{ width: `${(studioStats.editing / (studioStats.totalDates || 1)) * 100}%` }} title={`In Editing: ${studioStats.editing}`} />}
                  {studioStats.rendering > 0 && <span className="stage-segment stage-rendering" style={{ width: `${(studioStats.rendering / (studioStats.totalDates || 1)) * 100}%` }} title={`Rendered: ${studioStats.rendering}`} />}
                  {studioStats.upload > 0 && <span className="stage-segment stage-upload" style={{ width: `${(studioStats.upload / (studioStats.totalDates || 1)) * 100}%` }} title={`Ready/Uploaded: ${studioStats.upload}`} />}
                  {studioStats.jameya > 0 && <span className="stage-segment stage-jameya" style={{ width: `${(studioStats.jameya / (studioStats.totalDates || 1)) * 100}%` }} title={`AlJamea Submitted: ${studioStats.jameya}`} />}
                  {studioStats.completed > 0 && <span className="stage-segment stage-completed" style={{ width: `${(studioStats.completed / (studioStats.totalDates || 1)) * 100}%` }} title={`Completed Every Stage: ${studioStats.completed}`} />}
                </div>
                <div className="multicolor-legend">
                  <div className="legend-chip chip-editing"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.editing} /></strong> In Editing</div>
                  <div className="legend-chip chip-rendering"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.rendering} /></strong> Rendered</div>
                  <div className="legend-chip chip-upload"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.upload} /></strong> Uploaded</div>
                  <div className="legend-chip chip-jameya"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.jameya} /></strong> Jameya</div>
                  <div className="legend-chip chip-completed"><span className="chip-dot" /><strong><AnimatedNumber value={studioStats.completed} /></strong> Completed</div>
                </div>
              </div>
            )}

            {!activeSafarGroups.length ? <div className="panel safar-empty-state"><h3>No active Safars yet</h3><p>Safar folders from One Tap will appear here as they sync.</p></div> : <div className="dashboard-safar-grid">{activeSafarGroups.map(group => {
              const total = Math.max(group.total, group.tasks.length, 1)
              const editingPct = (group.editingCount / total) * 100
              const renderingPct = (group.renderingCount / total) * 100
              const uploadPct = (group.uploadCount / total) * 100
              const jameyaPct = (group.jameyaCount / total) * 100
              const completedPct = (group.completedCount / total) * 100

              return <article className="panel dashboard-safar-card" key={group.safarName}>
                <div className="dashboard-safar-top">
                  <button type="button" className="dashboard-safar-title" onClick={() => { setSelectedSafar(group.safarName); navigateTo('ongoing') }}>
                    <span>{group.safarName}</span>
                    <small>{hijriYearLabel(group.safarYear)}{group.safarYear && ' · '}{group.total} {group.total === 1 ? 'date' : 'dates'}</small>
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <strong className="dashboard-safar-percent"><AnimatedNumber value={group.deliveredPercent} />%</strong>
                    <span className="dashboard-safar-percent-sub"><AnimatedNumber value={group.deliveredCount} />/{group.total} Delivered</span>
                  </div>
                </div>

                {/* Multi-Color Stage Progress Bar */}
                <div className="multicolor-progress-wrap">
                  <div className="multicolor-progress-bar" role="progressbar" aria-label={`${group.safarName} pipeline progress`}>
                    {editingPct > 0 && <span className="stage-segment stage-editing" style={{ width: `${editingPct}%` }} title={`In Editing: ${group.editingCount} dates (${Math.round(editingPct)}%)`} />}
                    {renderingPct > 0 && <span className="stage-segment stage-rendering" style={{ width: `${renderingPct}%` }} title={`Rendered: ${group.renderingCount} dates (${Math.round(renderingPct)}%)`} />}
                    {uploadPct > 0 && <span className="stage-segment stage-upload" style={{ width: `${uploadPct}%` }} title={`Uploaded: ${group.uploadCount} dates (${Math.round(uploadPct)}%)`} />}
                    {jameyaPct > 0 && <span className="stage-segment stage-jameya" style={{ width: `${jameyaPct}%` }} title={`Submitted: ${group.jameyaCount} dates (${Math.round(jameyaPct)}%)`} />}
                    {completedPct > 0 && <span className="stage-segment stage-completed" style={{ width: `${completedPct}%` }} title={`Completed: ${group.completedCount} dates (${Math.round(completedPct)}%)`} />}
                  </div>
                  <div className="multicolor-legend">
                    <span className="legend-chip chip-editing" title="In Editing"><span className="chip-dot" /><AnimatedNumber value={group.editingCount} /> Editing</span>
                    <span className="legend-chip chip-rendering" title="Rendered"><span className="chip-dot" /><AnimatedNumber value={group.renderingCount} /> Rendered</span>
                    <span className="legend-chip chip-upload" title="Uploaded"><span className="chip-dot" /><AnimatedNumber value={group.uploadCount} /> Upload</span>
                    <span className="legend-chip chip-jameya" title="Submission to Al Jamea tus Saifiyah"><span className="chip-dot" /><AnimatedNumber value={group.jameyaCount} /> Jameya</span>
                    <span className="legend-chip chip-completed" title="Completed Every Stage"><span className="chip-dot" /><AnimatedNumber value={group.completedCount} /> Completed</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: '#64748b', margin: '6px 0 8px', flexWrap: 'wrap' }}>
                  <span><strong><AnimatedNumber value={group.deliveredCount} /></strong> of <strong>{group.total}</strong> dates delivered · <AnimatedNumber value={group.progressPercent} />% pipeline</span>
                  <span style={{ color: '#047857', fontWeight: 700 }}>📷 Photos: <AnimatedNumber value={group.photoUploadedCount} />/{group.total} (<AnimatedNumber value={group.photoPercent} />%)</span>
                </div>

                {group.tasks.length ? <ul className="safar-preview-list">{group.tasks.slice(0, 4).map(task => {
                  const isPhotoUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded) || (task.stage === 'upload' || task.stage === 'jameya' || task.stage === 'completed')
                  const isVideoUp = task.stage === 'upload' || task.stage === 'jameya' || task.stage === 'completed'
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
                })}</ul> : <p className="safar-preview-empty">Waiting for date folders to sync.</p>}

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
                      onClick={() => shareDailyBriefingWhatsApp(group.safarName)}
                      className="btn-card-whatsapp"
                      title={`Send WhatsApp status for ${group.safarName}`}
                    >
                      <MessageCircle size={13} /> WhatsApp
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
              const done = assigned.filter(task => task.stage === 'jameya' || task.stage === 'completed').length
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

        <footer className="site-footer">
          <span>ONE TAP <i>•</i> SAFAR PRODUCTION</span>
          <span>{snapshot.updatedAt ? `Last update ${new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready for workstation sync'}</span>
        </footer>
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
          aria-label="Kanban Board"
        >
          <div className="mobile-nav-icon-wrap">
            <Kanban size={20} />
            {effectiveOngoingSafar ? (
              <span className="mobile-nav-badge">
                {snapshot.tasks.filter(t => t.safarName === effectiveOngoingSafar && t.stage !== 'completed' && t.stage !== 'jameya').length}
              </span>
            ) : null}
          </div>
          <span>Kanban</span>
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
