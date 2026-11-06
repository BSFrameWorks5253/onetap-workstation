import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Archive, Bell, CalendarDays, ChevronDown, Cloud, Film, LayoutDashboard, ListFilter, Menu, MoreHorizontal, Search, Settings2, Users, UserRound, ArrowUpRight, RotateCcw, X } from 'lucide-react'

type Stage = 'rendering' | 'editing' | 'upload' | 'jameya'
type SafarTask = { id: string; safarName: string; dateFolder: string; hijriDate: string; stage: Stage; dueDate: string; editorName?: string; updatedAt: string }
type SafarSummary = { safarName: string; safarYear?: string | number; totalDays?: number; isArchived?: boolean; isDone?: boolean; archivePriorStages?: Record<string, Stage>; updatedAt?: string }
type Snapshot = { tasks: SafarTask[]; folders: string[]; safars: SafarSummary[]; updatedAt: string; source?: string }
type SafarGroup = SafarSummary & { tasks: SafarTask[]; total: number; completed: number; percent: number }

const STAGES: { id: Stage; label: string }[] = [
  { id: 'rendering', label: 'Rendering' }, { id: 'editing', label: 'Editing' }, { id: 'upload', label: 'Upload' }, { id: 'jameya', label: 'AlJamea submission' }
]
const localKey = 'ot_safar_tracker_snapshot'
const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', 'Sha’ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi’dah', 'Dhu al-Hijjah']

function hijriYearLabel(year?: string | number): string {
  const clean = String(year || '').replace(/\s*(?:AH|H)$/i, '').trim()
  return clean ? `${clean} AH` : ''
}

function dateLabel(dateFolder: string, supplied?: string, safarYear?: string | number): string {
  if (supplied?.trim() && !/[\\/]/.test(supplied) && !/\.[a-z\d]{2,6}$/i.test(supplied.trim())) return supplied.trim()
  const folderDay = dateFolder.match(/Day[_ -]?(\d{1,2})/i)?.[1]
  const calendar = dateFolder.match(/(\d{4})[-_](\d{1,2})[-_](\d{1,2})/)
  const year = String(calendar?.[1] || safarYear || '').replace(/\s*(?:AH|H)$/i, '').trim()
  if (folderDay) return `${Number(folderDay)} Safar ${year}${year ? ' AH' : ''}`
  if (calendar) {
    const month = HIJRI_MONTHS[Number(calendar[2]) - 1]
    if (month) return `${Number(calendar[3])} ${month} ${calendar[1]} AH`
  }
  const dayOnly = dateFolder.match(/^\s*(?:Day[_ -]?)?(\d{1,2})\s*$/i)?.[1]
  return dayOnly ? `Day ${Number(dayOnly)}` : 'Date not provided'
}

function dateFolderName(task: Partial<SafarTask>): string {
  const parts = String(task.dateFolder || '').trim().split(/[\\/]+/).filter(Boolean)
  const folder = parts[parts.length - 1] || ''
  const isDateFolder = /(?:^|\D)\d{4}[\s._-]\d{1,2}(?:[\s._-]\d{1,2})?|^\d{1,2}[\s._-]\d{1,2}(?:[\s._-]\d{4})?|^Day[_ -]?\d{1,3}/i.test(folder)
  return /\.[a-z\d]{2,6}$/i.test(folder) || !isDateFolder ? 'Date folder unavailable' : folder
}

function normalizeSnapshot(value: Partial<Snapshot> | null | undefined): Snapshot {
  const safars = (Array.isArray(value?.safars) ? value.safars : []).filter(safar => Boolean(safar?.safarName)).map(safar => ({
    safarName: String(safar.safarName),
    safarYear: safar.safarYear,
    totalDays: Number(safar.totalDays) || 0,
    isArchived: Boolean(safar.isArchived),
    isDone: Boolean(safar.isDone),
    archivePriorStages: safar.archivePriorStages,
    updatedAt: safar.updatedAt
  }))
  const yearByName = new Map(safars.map(safar => [safar.safarName, safar.safarYear]))
  const tasks = (Array.isArray(value?.tasks) ? value.tasks : []).map((raw: any, index): SafarTask => {
    const dateFolder = dateFolderName({ dateFolder: String(raw.dateFolder || '') })
    const safarName = String(raw.safarName || '')
    return {
      id: String(raw.id || `${safarName}::${dateFolder}::${index}`),
      safarName,
      dateFolder,
      hijriDate: dateLabel(dateFolder, raw.hijriDate || raw.dateLabel, yearByName.get(safarName)),
      stage: STAGES.some(stage => stage.id === raw.stage) ? raw.stage : 'rendering',
      dueDate: String(raw.dueDate || ''),
      updatedAt: String(raw.updatedAt || value?.updatedAt || '')
    }
  }).filter(task => task.safarName && task.dateFolder && task.dateFolder !== 'Date folder unavailable')
  return { tasks, folders: [...new Set(tasks.map(task => task.dateFolder))], safars, updatedAt: String(value?.updatedAt || ''), source: value?.source }
}
const env = (import.meta as any).env
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://dubscvthmkgkeiqdladp.supabase.co'
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || 'sb_publishable_kYApNvq2_6HAfNwJb8hW1g_7iLMSVyk'
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true } })

function readLocal(): Snapshot {
  try { const value = localStorage.getItem(localKey); if (value) return normalizeSnapshot(JSON.parse(value) as Partial<Snapshot>) } catch {}
  return { tasks: [], folders: [], safars: [], updatedAt: '' }
}

function EditorAssignment({ value, label, onSave }: { value: string; label: string; onSave: (value: string) => void }): JSX.Element {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return <input className="editor-input" aria-label={label} value={draft} placeholder="Assign editor" onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(value); event.currentTarget.blur() } }} onBlur={() => { if (draft.trim() !== value) onSave(draft.trim()) }} />
}

function SafarProductionGroup({ group, expanded, onToggle, onArchive, onUpdateTask }: {
  group: SafarGroup
  expanded: boolean
  onToggle: () => void
  onArchive: (isArchived: boolean) => void
  onUpdateTask: (task: SafarTask, changes: Partial<SafarTask>) => void
}): JSX.Element {
  const year = hijriYearLabel(group.safarYear)
  return <article className="panel safar-group-card">
    <div className="safar-group-header">
      <button type="button" className="safar-group-toggle" aria-expanded={expanded} onClick={onToggle}>
        <span className="safar-group-heading"><strong>{group.safarName}</strong><small>{year}{year && ' · '}{group.total} {group.total === 1 ? 'date' : 'dates'}</small></span>
        <span className="safar-group-progress"><strong>{group.percent}%</strong><span>{group.completed} of {group.total} submitted</span><i role="progressbar" aria-label={`${group.safarName} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={group.percent}><b style={{ width: `${group.percent}%` }}/></i></span>
        <ChevronDown aria-hidden="true" size={19} className={expanded ? 'expanded' : ''}/>
      </button>
      <button type="button" className="button-secondary safar-archive-action" aria-label={`${group.isArchived ? 'Restore' : 'Archive'} ${group.safarName}`} onClick={() => onArchive(!group.isArchived)}>
        {group.isArchived ? <RotateCcw aria-hidden="true" size={16}/> : <Archive aria-hidden="true" size={16}/>}{group.isArchived ? 'Restore' : 'Archive'}
      </button>
    </div>
    {expanded && <div className="safar-date-list">
      <div className="safar-date-list-heading"><span>Date folder</span><span>Editor</span><span>Stage</span><span>Due date</span></div>
      {group.tasks.length ? group.tasks.map(task => <div className="safar-date-row" key={task.id}>
        <span className="safar-date-value" title={dateFolderName(task)}>{dateFolderName(task)}</span>
        <div className="safar-edit-cell" data-label="Editor"><EditorAssignment label={`Editor assigned to ${dateFolderName(task)}`} value={task.editorName || ''} onSave={editorName => onUpdateTask(task, { editorName })}/></div>
        <div className="safar-edit-cell" data-label="Stage"><select aria-label={`Production stage for ${dateFolderName(task)}`} className={`stage-select stage-${task.stage}`} value={task.stage} onChange={event => onUpdateTask(task, { stage: event.target.value as Stage })}>{STAGES.map((stage, index) => <option key={stage.id} value={stage.id}>{index + 1}. {stage.label}</option>)}</select></div>
        <div className="safar-edit-cell" data-label="Due date"><input className="due-input" aria-label={`Due date for ${dateFolderName(task)}`} type="date" value={task.dueDate} onChange={event => onUpdateTask(task, { dueDate: event.target.value})}/></div>
      </div>) : <p className="safar-empty-dates">No date folders match these filters.</p>}
    </div>}
  </article>
}

export default function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<Snapshot>(readLocal)
  const [search, setSearch] = useState('')
  const [selectedSafar, setSelectedSafar] = useState('all')
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'dashboard' | 'tracker' | 'archive' | 'editors' | 'pipeline' | 'settings'>('dashboard')
  const [selectedEditor, setSelectedEditor] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const [connected, setConnected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [panelMenuOpen, setPanelMenuOpen] = useState(false)
  const [expandedSafars, setExpandedSafars] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(0)
  const [pipelineLimits, setPipelineLimits] = useState<Record<Stage, number>>({ rendering: 40, editing: 40, upload: 40, jameya: 40 })
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

  const safarGroups = useMemo<SafarGroup[]>(() => {
    const grouped = new Map<string, { summary: SafarSummary; tasks: SafarTask[] }>()
    for (const summary of snapshot.safars || []) {
      if (summary.safarName) grouped.set(summary.safarName, { summary, tasks: [] })
    }
    for (const task of snapshot.tasks) {
      if (!grouped.has(task.safarName)) grouped.set(task.safarName, { summary: { safarName: task.safarName }, tasks: [] })
      grouped.get(task.safarName)!.tasks.push(task)
    }
    return [...grouped.values()].map(({ summary, tasks }) => {
      tasks.sort((a, b) => a.dateFolder.localeCompare(b.dateFolder, undefined, { numeric: true }))
      const submitted = tasks.filter(task => task.stage === 'jameya').length
      const total = Math.max(tasks.length, Number(summary.totalDays) || 0)
      const isArchived = Boolean(summary.isArchived || (total > 0 && submitted >= total))
      const completed = isArchived ? total : submitted
      return { ...summary, isArchived, isDone: Boolean(summary.isDone || isArchived), tasks, total, completed, percent: isArchived ? 100 : total ? Math.round(completed / total * 100) : 0 }
    }).sort((a, b) => a.safarName.localeCompare(b.safarName, undefined, { numeric: true }))
  }, [snapshot.safars, snapshot.tasks])
  const safars = useMemo(() => safarGroups.filter(group => !group.isArchived).map(group => group.safarName), [safarGroups])
  const searchTerm = search.trim().toLowerCase()
  const rows = useMemo(() => snapshot.tasks.filter(task =>
    (selectedSafar === 'all' || task.safarName === selectedSafar) &&
    (selectedEditor === 'all' || task.editorName === selectedEditor) &&
    (filter === 'all' || task.stage === filter) &&
    `${task.safarName} ${task.dateFolder} ${task.hijriDate}`.toLowerCase().includes(searchTerm)
  ), [snapshot.tasks, selectedSafar, selectedEditor, filter, searchTerm])
  const editors = useMemo(() => [...new Set(snapshot.tasks.map(task => task.editorName?.trim()).filter((name): name is string => Boolean(name)))].sort(), [snapshot.tasks])
  const tasksByEditor = useMemo(() => {
    const grouped = new Map<string, SafarTask[]>()
    for (const task of snapshot.tasks) {
      if (!task.editorName) continue
      const group = grouped.get(task.editorName) || []
      group.push(task)
      grouped.set(task.editorName, group)
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
  const hasTaskFilters = Boolean(search.trim()) || filter !== 'all' || selectedEditor !== 'all'
  const visibleSafarGroups = matchingSafarGroups.filter(group =>
    (view === 'archive' ? group.isArchived : !group.isArchived && (selectedSafar === 'all' || group.safarName === selectedSafar)) &&
    (!hasTaskFilters || group.tasks.length > 0)
  )
  const pageHeading: Record<typeof view, { title: string; eyebrow: string; description: string }> = {
    dashboard: { title: 'Dashboard', eyebrow: 'LIVE SAFAR OVERVIEW', description: 'A compact view of each active Safar and its completion.' },
    tracker: { title: 'Safar tracker', eyebrow: 'SAFAR-BY-SAFAR PRODUCTION', description: 'Date folders, assignments, and progress grouped by Safar.' },
    archive: { title: 'Archived Safars', eyebrow: 'COMPLETED & STORED', description: 'Archived Safars remain available here and can be restored at any time.' },
    editors: { title: 'Editors & assignments', eyebrow: 'TEAM WORKLOAD', description: 'See who is working on each date and where it is in the pipeline.' },
    pipeline: { title: 'Media pipeline', eyebrow: 'PRODUCTION STAGES', description: 'Follow each date from rendering through AlJamea submission.' },
    settings: { title: 'Workspace settings', eyebrow: 'YOUR WORKSPACE', description: 'Manage alerts and check your One Tap sync connection.' }
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
    const load = async () => {
      const { data, error } = await supabase!.from('safar_tracker_snapshots').select('snapshot, updated_at').eq('id', 'primary').maybeSingle()
      if (alive && !error && data?.snapshot) applySnapshot(data.snapshot as Snapshot)
      else if (alive && error) setNotice('Cloud sync needs the Safar Tracker database set up.')
    }
    load()
    const trackerChannel = supabase.channel('one_tap_safar_tracker', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'snapshot' }, ({ payload }) => { if (payload?.snapshot) applySnapshot(payload.snapshot as Snapshot) })
      .subscribe(status => {
        if (!alive) return
        const isConnected = status === 'SUBSCRIBED'
        setConnected(isConnected)
        if (isConnected) trackerChannel.send({ type: 'broadcast', event: 'request_snapshot', payload: { requestedAt: new Date().toISOString() } })
      })
    const nexusChannel = supabase.channel('anyshare_realtime_nexus', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'website_user_notification' }, ({ payload }) => {
        const id = String(payload?.id || `${payload?.type || 'update'}:${payload?.timestamp || ''}:${payload?.title || ''}`)
        if (notifiedIdsRef.current.has(id)) return
        notifiedIdsRef.current.add(id)
        if (notifiedIdsRef.current.size > 200) notifiedIdsRef.current = new Set([...notifiedIdsRef.current].slice(-100))
        void notify(payload?.title || 'One Tap update', payload?.message || 'Production status updated.')
      })
      .on('broadcast', { event: 'safar_status_changed' }, ({ payload }) => {
        if (payload?.safarName) applySafarStatus(String(payload.safarName), Boolean(payload.isArchived), Boolean(payload.isDone), false)
      })
      .subscribe()
    trackerChannelRef.current = trackerChannel
    nexusChannelRef.current = nexusChannel
    return () => {
      alive = false
      trackerChannelRef.current = null
      nexusChannelRef.current = null
      supabase!.removeChannel(trackerChannel)
      supabase!.removeChannel(nexusChannel)
    }
  }, [])

  useEffect(() => {
    document.title = `${pageHeading[view].title} · One Tap Safar Tracker`
  }, [view])

  useEffect(() => setPage(0), [search, filter, selectedSafar, selectedEditor, view])

  useEffect(() => {
    if (menuOpen && isMobile) sidebarCloseRef.current?.focus()
  }, [menuOpen, isMobile])

  useEffect(() => {
    if (sidebarRef.current) sidebarRef.current.inert = isMobile && !menuOpen
  }, [menuOpen, isMobile])

  function applySnapshot(next: Snapshot) {
    const normalized = normalizeSnapshot(next)
    const current = snapshotRef.current
    const previousSafars = new Map((current.safars || []).map(safar => [safar.safarName, safar]))
    const hasSafarMetadata = Array.isArray((next as any)?.safars)
    const mergedSafars = hasSafarMetadata
      ? normalized.safars.map(safar => ({ ...previousSafars.get(safar.safarName), ...safar, isArchived: safar.isArchived ?? previousSafars.get(safar.safarName)?.isArchived ?? false }))
      : current.safars
    const merged = { ...normalized, safars: mergedSafars }
    const incomingTime = merged.updatedAt ? Date.parse(merged.updatedAt) : 0
    const currentTime = snapshotRef.current.updatedAt ? Date.parse(snapshotRef.current.updatedAt) : 0
    if (incomingTime && currentTime && incomingTime < currentTime) return
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
      const { error } = await supabase.from('safar_tracker_snapshots').upsert({ id: 'primary', snapshot: next, updated_at: next.updatedAt })
      if (error) throw error
      await trackerChannelRef.current?.send({ type: 'broadcast', event: 'snapshot', payload: { snapshot: next } })
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
        ? { ...task, stage: 'jameya' as Stage, updatedAt: new Date().toISOString() }
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
          status: isArchived ? 'submitted' : task.stage === 'upload' ? 'uploaded' : task.stage === 'jameya' ? 'submitted' : 'auto'
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
  async function notify(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker?.getRegistration()
        if (registration) await registration.showNotification(title, { body, icon: '/logo.svg', tag: `${title}:${body}` })
        else if (document.visibilityState === 'visible') new Notification(title, { body, icon: '/logo.svg' })
      } catch { setNotice('The update arrived, but this device could not display the notification.') }
    } else if (document.visibilityState === 'visible') {
      setNotice(body)
      window.setTimeout(() => setNotice(''), 5000)
    }
  }
  async function requestNotifications() {
    if (!('Notification' in window)) return setNotice('This browser does not support notifications.')
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') setNotice('Notifications are enabled on this device.')
      else setNotice(permission === 'denied' ? 'Notifications are blocked in this browser. Allow them in site settings to receive alerts.' : 'Notifications were not enabled.')
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
  async function updateTask(task: SafarTask, changes: Partial<SafarTask>) {
    const updatedAt = new Date().toISOString()
    const next: Snapshot = { ...snapshot, updatedAt, source: 'website', tasks: snapshot.tasks.map(row => row.id === task.id ? { ...row, ...changes, updatedAt } : row) }
    applySnapshot(next)
    saveCountRef.current += 1
    setSaving(true)
    try {
      const { error } = await supabase.from('safar_tracker_snapshots').upsert({ id: 'primary', snapshot: next, updated_at: updatedAt })
      if (error) setNotice('Saved on this device. Cloud history needs the Safar Tracker database setup.')
      await trackerChannelRef.current?.send({ type: 'broadcast', event: 'snapshot', payload: { snapshot: next } })
      if (changes.stage) {
        const status = changes.stage === 'jameya' ? 'submitted' : changes.stage === 'upload' ? 'uploaded' : 'auto'
        await nexusChannelRef.current?.send({ type: 'broadcast', event: 'task_mark_done', payload: { safarName: task.safarName, dateFolder: task.dateFolder, status } })
      }
    } catch {
      setNotice('Saved on this device. Cloud sync is temporarily unavailable.')
    } finally {
      saveCountRef.current = Math.max(0, saveCountRef.current - 1)
      setSaving(saveCountRef.current > 0)
    }
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

  function navigateTo(next: typeof view) {
    setView(next)
    setMenuOpen(false)
    window.requestAnimationFrame(() => pageTitleRef.current?.focus())
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <button type="button" className={`sidebar-overlay ${menuOpen ? 'visible' : ''}`} aria-label="Close navigation menu" onClick={() => { setMenuOpen(false); menuToggleRef.current?.focus() }} tabIndex={menuOpen ? 0 : -1} aria-hidden={!menuOpen}/>
    <aside ref={sidebarRef} id="workspace-navigation" className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Workspace navigation" aria-hidden={isMobile && !menuOpen}>
      <div className="brand"><div className="brand-mark" aria-hidden="true">1</div><div><strong>One Tap</strong><span>PRODUCTION WORKSPACE</span></div><button ref={sidebarCloseRef} type="button" className="sidebar-close" aria-label="Close navigation menu" onClick={() => { setMenuOpen(false); menuToggleRef.current?.focus() }}><X size={18}/></button></div>
      <nav aria-label="Main navigation">
      <div className="nav-caption">WORKSPACE</div>
      <button type="button" aria-current={view === 'dashboard' ? 'page' : undefined} className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => navigateTo('dashboard')}><LayoutDashboard aria-hidden="true" size={17}/> Dashboard</button>
      <button type="button" aria-current={view === 'tracker' ? 'page' : undefined} className={`nav-link ${view === 'tracker' ? 'active' : ''}`} onClick={() => navigateTo('tracker')}><CalendarDays aria-hidden="true" size={17}/> Safar tracker <span className="nav-count">{safars.length}</span></button>
      <button type="button" aria-current={view === 'archive' ? 'page' : undefined} className={`nav-link ${view === 'archive' ? 'active' : ''}`} onClick={() => { setSelectedSafar('all'); setSelectedEditor('all'); navigateTo('archive') }}><Archive aria-hidden="true" size={17}/> Archived Safars <span className="nav-count">{archiveSafarGroups.length}</span></button>
      <button type="button" aria-current={view === 'editors' ? 'page' : undefined} className={`nav-link ${view === 'editors' ? 'active' : ''}`} onClick={() => navigateTo('editors')}><Users aria-hidden="true" size={17}/> Editors <span className="nav-count">{editors.length}</span></button>
      <button type="button" aria-current={view === 'pipeline' ? 'page' : undefined} className={`nav-link ${view === 'pipeline' ? 'active' : ''}`} onClick={() => navigateTo('pipeline')}><Film aria-hidden="true" size={17}/> Media pipeline</button>
      <div className="side-divider" />
      <div className="nav-caption">YOUR SAFARS</div>
      {safars.map(name => <button type="button" key={name} aria-pressed={selectedSafar === name} className={`safar-link ${selectedSafar === name ? 'selected' : ''}`} onClick={() => { setSelectedSafar(selectedSafar === name ? 'all' : name); navigateTo('tracker') }}><span className="safar-dot" aria-hidden="true"/>{name}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="sync-status" role="status"><span className={`status-dot ${connected ? 'online' : ''}`} aria-hidden="true"/><div><strong>{connected ? 'Cloud connected' : 'Offline mode'}</strong><span>{snapshot.updatedAt ? `Synced ${new Date(snapshot.updatedAt).toLocaleString()}` : 'Waiting for first sync'}</span></div></div><button type="button" aria-current={view === 'settings' ? 'page' : undefined} className={`nav-link ${view === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')}><Settings2 aria-hidden="true" size={17}/> Settings</button></div>
    </aside>

    <main id="main-content" className="main-content" tabIndex={-1}>
      <header className="topbar"><button ref={menuToggleRef} type="button" className="icon-button menu-toggle" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-controls="workspace-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu aria-hidden="true" size={20}/></button><div className="breadcrumb" aria-label="Breadcrumb">Workspace <span aria-hidden="true">/</span> <strong>{pageHeading[view].title}</strong></div><div className="topbar-actions"><button type="button" className="notification-button" onClick={requestNotifications}><Bell aria-hidden="true" size={17}/><span>Notifications</span></button><div className="avatar" role="img" aria-label="Signed in as Burhan">B</div></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><div className="eyebrow"><span className="live-pip" aria-hidden="true"/> {pageHeading[view].eyebrow}</div><h1 ref={pageTitleRef} tabIndex={-1}>{pageHeading[view].title}</h1><p>{pageHeading[view].description}</p></div><div className="heading-actions">{view !== 'settings' && <button type="button" className="button-secondary" onClick={requestNotifications}><Bell aria-hidden="true" size={16}/> Enable alerts</button>}{(view === 'tracker' || view === 'dashboard') && <button type="button" className="button-secondary" onClick={requestDesktopSync}><Cloud aria-hidden="true" size={16}/> Sync now</button>}</div></div>

        {view === 'dashboard' && <section className="dashboard-safars" aria-labelledby="dashboard-safars-title">
          <div className="dashboard-safars-heading"><div><h2 id="dashboard-safars-title">Safars in production</h2><p>Progress and the next dates for each active Safar.</p></div><button type="button" className="button-secondary" onClick={() => { setSelectedSafar('all'); setSelectedEditor('all'); navigateTo('archive') }}><Archive aria-hidden="true" size={16}/> Archive <span className="nav-count">{archiveSafarGroups.length}</span></button></div>
          {!activeSafarGroups.length ? <div className="panel safar-empty-state"><h3>No active Safars yet</h3><p>Safar folders from One Tap will appear here as they sync.</p></div> : <div className="dashboard-safar-grid">{activeSafarGroups.map(group => <article className="panel dashboard-safar-card" key={group.safarName}>
            <div className="dashboard-safar-top"><button type="button" className="dashboard-safar-title" onClick={() => { setSelectedSafar(group.safarName); navigateTo('tracker') }}><span>{group.safarName}</span><small>{hijriYearLabel(group.safarYear)}{group.safarYear && ' · '}{group.total} {group.total === 1 ? 'date' : 'dates'}</small></button><strong className="dashboard-safar-percent">{group.percent}%</strong></div>
            <div className="dashboard-progress" role="progressbar" aria-label={`${group.safarName} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={group.percent}><span style={{ width: `${group.percent}%` }}/></div>
            <p className="dashboard-safar-progress-copy">{group.completed} of {group.total} dates submitted</p>
            {group.tasks.length ? <ul className="safar-preview-list">{group.tasks.slice(0, 3).map(task => <li key={task.id}><strong title={dateFolderName(task)}>{dateFolderName(task)}</strong></li>)}</ul> : <p className="safar-preview-empty">Waiting for date folders to sync.</p>}
            <button type="button" className="safar-open-link" onClick={() => { setSelectedSafar(group.safarName); navigateTo('tracker') }}>View Safar details <ArrowUpRight aria-hidden="true" size={15}/></button>
          </article>)}</div>}
        </section>}

        {(view === 'tracker' || view === 'archive') && <section className="panel safar-view-panel" aria-labelledby="safar-view-title">
          <div className="panel-heading"><div><h2 id="safar-view-title">{view === 'archive' ? 'Archived Safars' : 'Active Safars by date'}</h2><p>Date folder names only. Open a Safar to update its assignments, stage, or due date.</p></div><span className="safar-group-count">{view === 'archive' ? archiveSafarGroups.length : activeSafarGroups.length} Safars</span></div>
          <div className="toolbar"><div className="search-box"><Search aria-hidden="true" size={16}/><label className="visually-hidden" htmlFor="safar-search">Search Safar or date folder</label><input id="safar-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Safar or date folder"/></div><div className="toolbar-actions"><label className="filter-select"><ListFilter aria-hidden="true" size={15}/><span className="visually-hidden">Filter by stage</span><select aria-label="Filter by stage" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All stages</option>{STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><button type="button" className="button-secondary export-button" onClick={exportCsv}><Cloud aria-hidden="true" size={15}/> Export CSV</button></div></div>
          <div className="safar-groups-list">{visibleSafarGroups.map(group => <SafarProductionGroup key={group.safarName} group={group} expanded={expandedSafars.has(group.safarName)} onToggle={() => toggleSafarExpanded(group.safarName)} onArchive={archived => void setSafarArchived(group, archived)} onUpdateTask={(task, changes) => void updateTask(task, changes)}/>)}
            {!visibleSafarGroups.length && <div className="safar-empty-state"><h3>{view === 'archive' ? archiveSafarGroups.length ? 'No archived dates match' : 'Your archive is empty' : activeSafarGroups.length ? 'No dates match these filters' : 'No active Safars'}</h3><p>{view === 'archive' ? archiveSafarGroups.length ? 'Clear the filters to see all archived Safars.' : 'Archived Safars will stay here until you restore them.' : activeSafarGroups.length ? 'Try a different search or stage filter.' : 'Safar folders from One Tap will appear here after sync.'}</p></div>}
          </div>
          <div className="table-footer"><span>Folder names and task details sync across your devices.</span><span className="footer-sync">{saving ? 'Saving changes…' : connected ? 'Live sync connected' : 'Saved on this device'} <span className={`status-dot ${connected ? 'online' : ''}`}/></span></div>
        </section>}

        {view === 'editors' && <section className="editor-overview" aria-label="Editor workloads">
          {editors.length === 0 ? <div className="panel editor-empty"><div className="empty-orb" aria-hidden="true"><Users size={24}/></div><div><h2>No editors assigned yet</h2><p>Assign a date to an editor in the table below. Their workload and stage progress will appear here.</p></div></div> : editors.map((editor, index) => {
            const assigned = tasksByEditor.get(editor) || []
            const done = assigned.filter(task => task.stage === 'jameya').length
            const activeStage = STAGES.find(stage => assigned.some(task => task.stage === stage.id))?.label || 'All caught up'
            return <button type="button" className="editor-card" key={editor} aria-pressed={selectedEditor === editor} onClick={() => setSelectedEditor(selectedEditor === editor ? 'all' : editor)}>
              <div className={`editor-avatar editor-avatar-${index % 4}`} aria-hidden="true"><UserRound size={19}/></div>
              <div className="editor-card-main"><span className="editor-label">EDITOR</span><strong>{editor}</strong><span className="editor-current">Current work · {activeStage}</span><div className="editor-progress" role="progressbar" aria-label={`${editor} submitted work`} aria-valuemin={0} aria-valuemax={assigned.length} aria-valuenow={done}><i aria-hidden="true" style={{ width: `${assigned.length ? done / assigned.length * 100 : 0}%` }}/></div></div>
              <div className="editor-stats"><strong>{assigned.length}</strong><span>ASSIGNED</span><small>{done} submitted</small></div><ArrowUpRight aria-hidden="true" size={17} className="editor-arrow"/>
            </button>
          })}
        </section>}

        {(view === 'editors' || view === 'pipeline') && <section className="panel task-panel"><div className="panel-heading"><div><div className="panel-title-row"><h2>{view === 'editors' ? selectedEditor === 'all' ? 'Editor assignments' : `${selectedEditor}’s assignments` : 'Production pipeline'}</h2><span className="live-label"><i/> LIVE</span></div><p>{view === 'editors' ? 'Assigned date folders and current delivery stage.' : 'Select a task card to move it to the next production stage.'}</p></div><div className="panel-menu-wrap"><button className="more-button" onClick={() => setPanelMenuOpen(!panelMenuOpen)} aria-label="More options">{<MoreHorizontal size={19}/>}</button>{panelMenuOpen && <div className="panel-menu"><button onClick={() => { exportCsv(); setPanelMenuOpen(false) }}>Export filtered dates</button><button onClick={() => { setSearch(''); setFilter('all'); setSelectedEditor('all'); setSelectedSafar('all'); setPanelMenuOpen(false) }}>Clear filters</button></div>}</div></div>
          <div className="toolbar"><div className="search-box"><Search aria-hidden="true" size={16}/><label className="visually-hidden" htmlFor="task-search">Search Safar or date folder</label><input id="task-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Safar or date folder"/></div><div className="toolbar-actions"><label className="filter-select"><ListFilter aria-hidden="true" size={15}/><span className="visually-hidden">Filter by stage</span><select aria-label="Filter by stage" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All stages</option>{STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><button type="button" className="button-secondary export-button" onClick={exportCsv}><Cloud aria-hidden="true" size={15}/> Export CSV</button></div></div>
          {view === 'pipeline' && <div className="pipeline-board">{STAGES.map((stage, index) => { const stageTasks = tasksByStage.get(stage.id) || []; return <section className="pipeline-column" key={stage.id}><div className="pipeline-column-head"><span className={`pipeline-dot pipeline-${stage.id}`}/><strong>{stage.label}</strong><span>{stageTasks.length}</span></div>{stageTasks.length === 0 ? <div className="pipeline-empty">No dates in this stage</div> : stageTasks.slice(0, pipelineLimits[stage.id]).map(task => <article className="pipeline-task" key={task.id}><strong>{dateFolderName(task)}</strong><small>{task.safarName}{task.editorName ? ` · Editor ${task.editorName}` : ' · Unassigned'}{task.dueDate ? ` · Due ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</small>{index < STAGES.length - 1 && <button className="pipeline-advance" onClick={() => updateTask(task, { stage: STAGES[index + 1].id })}>Move to {STAGES[index + 1].label} →</button>}</article>)}{stageTasks.length > pipelineLimits[stage.id] && <button type="button" className="pipeline-load-more" onClick={() => setPipelineLimits(current => ({ ...current, [stage.id]: current[stage.id] + 40 }))}>Show next 40 ({stageTasks.length - pipelineLimits[stage.id]} remaining)</button>}</section> })}</div>}
          {view === 'editors' && <div className="table-wrap"><table><caption className="visually-hidden">Editor assignments, Safar date folders, and production progress</caption><thead><tr><th scope="col">DATE FOLDER</th><th scope="col">SAFAR</th><th scope="col">EDITOR</th><th scope="col">PROGRESS STAGE</th><th scope="col">DUE DATE</th><th scope="col">LAST UPDATED</th></tr></thead><tbody>{visibleRows.map(task => <tr key={task.id}><td><strong className="event-folder-cell" title={dateFolderName(task)}>{dateFolderName(task)}</strong></td><td><span className="hijri-date">{task.safarName}</span></td><td><EditorAssignment label={`Editor assigned to ${dateFolderName(task)}`} value={task.editorName || ''} onSave={editorName => updateTask(task, { editorName })}/></td><td><select aria-label={`Production stage for ${dateFolderName(task)}`} className={`stage-select stage-${task.stage}`} value={task.stage} onChange={event => updateTask(task, { stage: event.target.value as Stage })}>{STAGES.map((stage, index) => <option key={stage.id} value={stage.id}>{index + 1}. {stage.label}</option>)}</select></td><td><input className="due-input" aria-label={`Due date for ${dateFolderName(task)}`} type="date" value={task.dueDate} onChange={event => updateTask(task, { dueDate: event.target.value })}/></td><td><span className="updated-cell"><time dateTime={task.updatedAt}>{new Date(task.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></span></td></tr>)}</tbody></table>{visibleRows.length === 0 && <div className="empty-state" role="status">No dates match your search.</div>}</div>}
          {view === 'editors' && rows.length > pageSize && <nav className="pagination" aria-label="Editor assignment pages"><button type="button" className="button-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" className="button-secondary" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
          <div className={`table-footer ${view === 'pipeline' ? 'hidden-view' : ''}`}><span>Showing <strong>{visibleRows.length}</strong> of <strong>{rows.length}</strong> matching dates</span><span className="footer-sync">{saving ? 'Syncing changes…' : connected ? 'Changes sync in real time' : 'Changes saved on this device'} <span className={`status-dot ${connected ? 'online' : ''}`}/></span></div>
        </section>}
        {view === 'settings' && <section className="settings-grid"><article className="panel settings-card"><div className="settings-icon"><Bell size={18}/></div><div><h2>Notifications</h2><p>Get alerts when a Media Encoder batch is ready for title adding and when title processing finishes.</p><button className="button-secondary" onClick={requestNotifications}>{'Notification' in window && Notification.permission === 'granted' ? 'Alerts enabled' : 'Enable alerts'}</button></div></article><article className="panel settings-card"><div className="settings-icon"><Cloud size={18}/></div><div><h2>One Tap cloud sync</h2><p>{connected ? 'Connected. Safar folder names and task updates are arriving in real time.' : 'Sync connection is currently offline or not configured.'}</p><span className="settings-status"><i className={`status-dot ${connected ? 'online' : ''}`}/>{connected ? 'Connected' : 'Waiting for connection'}</span><button className="button-secondary settings-action" onClick={requestSyncFromSettings}>Sync from One Tap</button></div></article><article className="panel settings-card"><div className="settings-icon"><CalendarDays size={18}/></div><div><h2>Synced data</h2><p>Only Safar names, date folder names, editor assignments, stages, and due dates are shared with the tracker.</p><span className="settings-status">Last sync · {snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleString() : 'Not synced yet'}</span></div></article><article className="panel settings-card"><div className="settings-icon"><Users size={18}/></div><div><h2>Editor assignments</h2><p>Assign editors by name in the Safar tracker table. The Editors page groups each person’s dates and current stage.</p><button className="button-secondary" onClick={() => navigateTo('editors')}>Open editors</button></div></article></section>}
        {notice && <div className="toast-note" role="status" aria-live="polite"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
      </div>
      <footer className="site-footer"><span>ONE TAP <i>•</i> SAFAR PRODUCTION</span><span>{snapshot.updatedAt ? `Last update ${new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready for workstation sync'}</span></footer>
    </main>
  </div>
}
