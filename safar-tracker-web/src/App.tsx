import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Bell, CalendarDays, Check, ChevronDown, CircleHelp, Cloud, Film, LayoutDashboard, ListFilter, Menu, MoreHorizontal, Search, Settings2, UploadCloud, Users, UserRound, ArrowUpRight, X } from 'lucide-react'

type Stage = 'rendering' | 'editing' | 'upload' | 'jameya'
type SafarTask = { id: string; safarName: string; dateFolder: string; hijriDate: string; stage: Stage; dueDate: string; editorName?: string; updatedAt: string }
type Snapshot = { tasks: SafarTask[]; folders: string[]; updatedAt: string; source?: string }

const STAGES: { id: Stage; label: string }[] = [
  { id: 'rendering', label: 'Rendering' }, { id: 'editing', label: 'Editing' }, { id: 'upload', label: 'Upload' }, { id: 'jameya', label: 'AlJamea submission' }
]
const localKey = 'ot_safar_tracker_snapshot'
const env = (import.meta as any).env
const supabaseUrl = env.SUPABASE_URL || 'https://dubscvthmkgkeiqdladp.supabase.co'
const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || 'sb_publishable_kYApNvq2_6HAfNwJb8hW1g_7iLMSVyk'
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true } })

function readLocal(): Snapshot {
  try { const value = localStorage.getItem(localKey); if (value) return JSON.parse(value) as Snapshot } catch {}
  return { tasks: [], folders: [], updatedAt: '' }
}

function EditorAssignment({ value, onSave }: { value: string; onSave: (value: string) => void }): JSX.Element {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return <input className="editor-input" value={draft} placeholder="Assign editor" onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft.trim() !== value) onSave(draft.trim()) }} />
}

export default function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<Snapshot>(readLocal)
  const [search, setSearch] = useState('')
  const [selectedSafar, setSelectedSafar] = useState('all')
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'dashboard' | 'tracker' | 'editors' | 'pipeline' | 'settings'>('dashboard')
  const [selectedEditor, setSelectedEditor] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [panelMenuOpen, setPanelMenuOpen] = useState(false)
  const trackerChannelRef = useRef<any>(null)
  const nexusChannelRef = useRef<any>(null)

  const safars = useMemo(() => [...new Set(snapshot.tasks.map(task => task.safarName))], [snapshot.tasks])
  const rows = useMemo(() => snapshot.tasks.filter(task =>
    (selectedSafar === 'all' || task.safarName === selectedSafar) &&
    (selectedEditor === 'all' || task.editorName === selectedEditor) &&
    (filter === 'all' || task.stage === filter) &&
    `${task.safarName} ${task.dateFolder} ${task.hijriDate}`.toLowerCase().includes(search.toLowerCase())
  ), [snapshot.tasks, selectedSafar, selectedEditor, filter, search])
  const editors = useMemo(() => [...new Set(snapshot.tasks.map(task => task.editorName?.trim()).filter((name): name is string => Boolean(name)))].sort(), [snapshot.tasks])
  const counts = useMemo(() => STAGES.map(stage => ({ ...stage, count: snapshot.tasks.filter(task => task.stage === stage.id).length })), [snapshot.tasks])
  const completed = snapshot.tasks.filter(task => task.stage === 'jameya').length
  const pageHeading: Record<typeof view, { title: string; eyebrow: string; description: string }> = {
    dashboard: { title: 'Dashboard', eyebrow: 'LIVE PRODUCTION OVERVIEW', description: 'A clear view of Safar progress across the whole team.' },
    tracker: { title: 'Safar tracker', eyebrow: 'DATE-BY-DATE PRODUCTION', description: 'Every Safar date, moving through the delivery stages.' },
    editors: { title: 'Editors & assignments', eyebrow: 'TEAM WORKLOAD', description: 'See who is working on each date and where it is in the pipeline.' },
    pipeline: { title: 'Media pipeline', eyebrow: 'PRODUCTION STAGES', description: 'Follow each date from rendering through AlJamea submission.' },
    settings: { title: 'Workspace settings', eyebrow: 'YOUR WORKSPACE', description: 'Manage alerts and check your One Tap sync connection.' }
  }
  const visibleRows = view === 'dashboard' ? rows.slice(0, 5) : rows

  useEffect(() => {
    if (!menuOpen && !panelMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); setPanelMenuOpen(false) }
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
  }, [menuOpen, panelMenuOpen])

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
      .on('broadcast', { event: 'website_user_notification' }, ({ payload }) => notify(payload?.title || 'One Tap update', payload?.message || 'Production status updated.'))
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

  function applySnapshot(next: Snapshot) {
    const incomingTime = next.updatedAt ? Date.parse(next.updatedAt) : 0
    const currentTime = snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : 0
    if (incomingTime && currentTime && incomingTime < currentTime) return
    setSnapshot(next)
    try { localStorage.setItem(localKey, JSON.stringify(next)) } catch {}
  }
  async function notify(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker?.getRegistration()
      if (registration) await registration.showNotification(title, { body, icon: '/logo.svg' })
      else new Notification(title, { body, icon: '/logo.svg' })
    }
    setNotice(body)
    window.setTimeout(() => setNotice(''), 5000)
  }
  async function requestNotifications() {
    if (!('Notification' in window)) return setNotice('This browser does not support notifications.')
    const permission = await Notification.requestPermission()
    if (permission === 'granted') setNotice('Notifications are enabled on this device.')
  }
  function exportCsv() {
    if (rows.length === 0) { setNotice('There are no dates to export yet.'); return }
    const header = ['Safar', 'Date folder', 'Safar date', 'Editor', 'Stage', 'Due date', 'Last updated']
    const values = rows.map(task => [task.safarName, task.dateFolder, task.hijriDate, task.editorName || '', STAGES.find(stage => stage.id === task.stage)?.label || task.stage, task.dueDate, task.updatedAt])
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
    setSaving(true)
    const { error } = await supabase.from('safar_tracker_snapshots').upsert({ id: 'primary', snapshot: next, updated_at: updatedAt })
    if (error) setNotice('Saved here. Live updates are sent, but durable cloud history needs the Supabase table setup.')
    await trackerChannelRef.current?.send({ type: 'broadcast', event: 'snapshot', payload: { snapshot: next } })
    if (changes.stage) {
      const status = changes.stage === 'jameya' ? 'submitted' : changes.stage === 'upload' ? 'uploaded' : 'auto'
      await nexusChannelRef.current?.send({ type: 'broadcast', event: 'task_mark_done', payload: { safarName: task.safarName, dateFolder: task.dateFolder, status } })
    }
    setSaving(false)
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
  }

  return <div className="app-shell">
    <button className={`sidebar-overlay ${menuOpen ? 'visible' : ''}`} aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} tabIndex={menuOpen ? 0 : -1}/>
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark">1</div><div><strong>One Tap</strong><span>PRODUCTION WORKSPACE</span></div><button className="sidebar-close" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
      <div className="nav-caption">WORKSPACE</div>
      <button className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => navigateTo('dashboard')}><LayoutDashboard size={17}/> Dashboard</button>
      <button className={`nav-link ${view === 'tracker' ? 'active' : ''}`} onClick={() => navigateTo('tracker')}><CalendarDays size={17}/> Safar tracker <span className="nav-count">{safars.length}</span></button>
      <button className={`nav-link ${view === 'editors' ? 'active' : ''}`} onClick={() => navigateTo('editors')}><Users size={17}/> Editors <span className="nav-count">{editors.length}</span></button>
      <button className={`nav-link ${view === 'pipeline' ? 'active' : ''}`} onClick={() => navigateTo('pipeline')}><Film size={17}/> Media pipeline</button>
      <div className="side-divider" />
      <div className="nav-caption">YOUR SAFARS</div>
      {safars.map(name => <button key={name} className={`safar-link ${selectedSafar === name ? 'selected' : ''}`} onClick={() => { setSelectedSafar(selectedSafar === name ? 'all' : name); navigateTo('tracker') }}><span className="safar-dot"/>{name}</button>)}
      <div className="sidebar-bottom"><div className="sync-status"><span className={`status-dot ${connected ? 'online' : ''}`}/><div><strong>{connected ? 'Cloud connected' : 'Offline mode'}</strong><span>{snapshot.updatedAt ? `Synced ${new Date(snapshot.updatedAt).toLocaleString()}` : 'Waiting for first sync'}</span></div></div><button className={`nav-link ${view === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')}><Settings2 size={17}/> Settings</button></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><button className="icon-button menu-toggle" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{pageHeading[view].title}</strong></div><div className="topbar-actions"><button className="notification-button" onClick={requestNotifications}><Bell size={17}/><span>Notifications</span></button><div className="avatar">B</div></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><div className="eyebrow"><span className="live-pip"/> {pageHeading[view].eyebrow}</div><h1>{pageHeading[view].title}</h1><p>{pageHeading[view].description}</p></div><div className="heading-actions">{view !== 'settings' && <button className="button-secondary" onClick={requestNotifications}><Bell size={16}/> Enable alerts</button>}{(view === 'tracker' || view === 'dashboard') && <button className="button-secondary" onClick={requestDesktopSync}><Cloud size={16}/> Sync now</button>}</div></div>

        {view !== 'settings' && <section className="summary-grid"><div className="summary-card main-summary"><div className="summary-top"><span>OVERALL COMPLETION</span><span className="period-pill">{safars.length} {safars.length === 1 ? 'Safar' : 'Safars'} <ChevronDown size={13}/></span></div><div className="summary-main"><div><strong>{snapshot.tasks.length ? Math.round(completed / snapshot.tasks.length * 100) : 0}<small>%</small></strong><p>{completed} of {snapshot.tasks.length} dates submitted</p></div><div className="ring" style={{ '--progress': `${snapshot.tasks.length ? completed / snapshot.tasks.length * 100 : 0}%` } as React.CSSProperties}><div><b>{completed}</b><span>DONE</span></div></div></div><div className="summary-progress"><span style={{ width: `${snapshot.tasks.length ? completed / snapshot.tasks.length * 100 : 0}%` }}/></div></div>
          {counts.map((item, index) => <div className="summary-card stage-summary" key={item.id}><div className={`stage-icon icon-${item.id}`}>{index === 0 ? <Film size={17}/> : index === 1 ? <MoreHorizontal size={17}/> : index === 2 ? <UploadCloud size={17}/> : <Check size={17}/>}</div><span className="stage-caption">{item.label.toUpperCase()}</span><strong>{item.count.toString().padStart(2, '0')}</strong><span className="stage-foot">{snapshot.tasks.length - item.count} remaining</span><div className="mini-bars">{[0,1,2,3,4,5,6,7,8,9,10,11].map((n) => <i key={n} className={n < Math.round(item.count / Math.max(1, snapshot.tasks.length) * 12) ? `filled fill-${index}` : ''}/>)}</div></div>)}
        </section>}

        {view === 'editors' && <section className="editor-overview">{editors.length === 0 ? <div className="panel editor-empty"><div className="empty-orb"><Users size={24}/></div><div><h2>No editors assigned yet</h2><p>Assign a date to an editor in the table below. Their workload and stage progress will appear here.</p></div></div> : editors.map((editor, index) => { const assigned = snapshot.tasks.filter(task => task.editorName === editor); const done = assigned.filter(task => task.stage === 'jameya').length; const activeStage = STAGES.find(stage => assigned.some(task => task.stage === stage.id))?.label || 'All caught up'; return <button className="editor-card" key={editor} onClick={() => setSelectedEditor(selectedEditor === editor ? 'all' : editor)}><div className={`editor-avatar editor-avatar-${index % 4}`}><UserRound size={19}/></div><div className="editor-card-main"><span className="editor-label">EDITOR</span><strong>{editor}</strong><span className="editor-current">Current work · {activeStage}</span><div className="editor-progress"><i style={{ width: `${assigned.length ? done / assigned.length * 100 : 0}%` }}/></div></div><div className="editor-stats"><strong>{assigned.length}</strong><span>ASSIGNED</span><small>{done} submitted</small></div><ArrowUpRight size={17} className="editor-arrow"/></button>})}</section>}

        {view !== 'settings' && <section className="panel task-panel"><div className="panel-heading"><div><div className="panel-title-row"><h2>{view === 'editors' ? selectedEditor === 'all' ? 'Editor assignments' : `${selectedEditor}’s assignments` : view === 'dashboard' ? 'Latest production dates' : view === 'pipeline' ? 'Production pipeline' : 'Production dates'}</h2><span className="live-label"><i/> LIVE</span></div><p>{view === 'editors' ? 'Assigned date folders and current delivery stage.' : view === 'pipeline' ? 'Select a task card to move it to the next production stage.' : view === 'dashboard' ? 'A quick look at the current work in progress.' : 'Track each date through the full delivery process.'}</p></div><div className="panel-menu-wrap"><button className="more-button" onClick={() => view === 'dashboard' ? navigateTo('tracker') : setPanelMenuOpen(!panelMenuOpen)} aria-label={view === 'dashboard' ? 'Open full Safar tracker' : 'More options'}>{view === 'dashboard' ? <ArrowUpRight size={18}/> : <MoreHorizontal size={19}/>}</button>{panelMenuOpen && <div className="panel-menu"><button onClick={() => { exportCsv(); setPanelMenuOpen(false) }}>Export filtered dates</button><button onClick={() => { setSearch(''); setFilter('all'); setSelectedEditor('all'); setSelectedSafar('all'); setPanelMenuOpen(false) }}>Clear filters</button></div>}</div></div>
          <div className="toolbar"><div className="search-box"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Safar or date folder"/></div><div className="toolbar-actions"><label className="filter-select"><ListFilter size={15}/><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All stages</option>{STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><button className="button-secondary export-button" onClick={exportCsv}><Cloud size={15}/> Export CSV</button></div></div>
          {view === 'pipeline' && <div className="pipeline-board">{STAGES.map((stage, index) => { const stageTasks = rows.filter(task => task.stage === stage.id); return <section className="pipeline-column" key={stage.id}><div className="pipeline-column-head"><span className={`pipeline-dot pipeline-${stage.id}`}/><strong>{stage.label}</strong><span>{stageTasks.length}</span></div>{stageTasks.length === 0 ? <div className="pipeline-empty">No dates in this stage</div> : stageTasks.map(task => <article className="pipeline-task" key={task.id}><span>{task.safarName}</span><strong>{task.dateFolder}</strong><small>{task.editorName ? `Editor · ${task.editorName}` : 'Unassigned'}{task.dueDate ? ` · Due ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</small>{index < STAGES.length - 1 && <button className="pipeline-advance" onClick={() => updateTask(task, { stage: STAGES[index + 1].id })}>Move to {STAGES[index + 1].label} →</button>}</article>)}</section> })}</div>}
          <div className={`table-wrap ${view === 'pipeline' ? 'hidden-view' : ''}`}><table><thead><tr><th>DATE FOLDER</th><th>SAFAR DATE</th><th>EDITOR</th><th>PROGRESS STAGE</th><th>DUE DATE</th><th>LAST UPDATED</th></tr></thead><tbody>{visibleRows.map(task => <tr key={task.id}><td><div className="date-cell"><div className="date-icon"><CalendarDays size={16}/></div><div><strong>{task.dateFolder}</strong><span>{task.safarName}</span></div></div></td><td><span className="hijri-date">{task.hijriDate || '—'}</span></td><td><EditorAssignment value={task.editorName || ''} onSave={editorName => updateTask(task, { editorName })}/></td><td><select className={`stage-select stage-${task.stage}`} value={task.stage} onChange={event => updateTask(task, { stage: event.target.value as Stage })}>{STAGES.map((stage, index) => <option key={stage.id} value={stage.id}>{index + 1}. {stage.label}</option>)}</select></td><td><input className="due-input" aria-label={`Due date for ${task.dateFolder}`} type="date" value={task.dueDate} onChange={event => updateTask(task, { dueDate: event.target.value })}/></td><td><span className="updated-cell">{new Date(task.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></td></tr>)}</tbody></table>{visibleRows.length === 0 && view !== 'pipeline' && <div className="empty-state">No dates match your search.</div>}</div>
          <div className={`table-footer ${view === 'pipeline' ? 'hidden-view' : ''}`}><span>Showing <strong>{visibleRows.length}</strong> of <strong>{snapshot.tasks.length}</strong> dates</span><span className="footer-sync">{saving ? 'Syncing changes…' : connected ? 'Changes sync in real time' : 'Changes saved on this device'} <span className={`status-dot ${connected ? 'online' : ''}`}/></span></div>
        </section>}
        {view === 'settings' && <section className="settings-grid"><article className="panel settings-card"><div className="settings-icon"><Bell size={18}/></div><div><h2>Notifications</h2><p>Get alerts when a Media Encoder batch is ready for title adding and when title processing finishes.</p><button className="button-secondary" onClick={requestNotifications}>{'Notification' in window && Notification.permission === 'granted' ? 'Alerts enabled' : 'Enable alerts'}</button></div></article><article className="panel settings-card"><div className="settings-icon"><Cloud size={18}/></div><div><h2>One Tap cloud sync</h2><p>{connected ? 'Connected. Safar folder names and task updates are arriving in real time.' : 'Sync connection is currently offline or not configured.'}</p><span className="settings-status"><i className={`status-dot ${connected ? 'online' : ''}`}/>{connected ? 'Connected' : 'Waiting for connection'}</span><button className="button-secondary settings-action" onClick={requestSyncFromSettings}>Sync from One Tap</button></div></article><article className="panel settings-card"><div className="settings-icon"><CalendarDays size={18}/></div><div><h2>Synced data</h2><p>Only Safar names, date folder names, editor assignments, stages, and due dates are shared with the tracker.</p><span className="settings-status">Last sync · {snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleString() : 'Not synced yet'}</span></div></article><article className="panel settings-card"><div className="settings-icon"><Users size={18}/></div><div><h2>Editor assignments</h2><p>Assign editors by name in the Safar tracker table. The Editors page groups each person’s dates and current stage.</p><button className="button-secondary" onClick={() => navigateTo('editors')}>Open editors</button></div></article></section>}
        {view === 'dashboard' && <div className="bottom-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Production notifications</h2><p>Updates from your One Tap workflow.</p></div></div><div className="activity-row"><div className="activity-icon render"><Film size={15}/></div><div><strong>Media Encoder batch ready</strong><span>One Tap notifies you when all videos finish rendering.</span></div><time>Live</time></div><div className="activity-row"><div className="activity-icon upload"><UploadCloud size={15}/></div><div><strong>Title adder completion</strong><span>Get an alert when title processing finishes.</span></div><time>Live</time></div></section>
          <section className="panel sync-panel"><div className="sync-illustration"><div className="cloud-circle"><Cloud size={23}/></div><span className="sync-orbit orbit-one"/><span className="sync-orbit orbit-two"/></div><div className="sync-copy"><h3>One Tap is your source</h3><p>Safar names and date folders sync from your workstation. Task details stay editable here.</p><div className="sync-meta"><span className={`status-dot ${connected ? 'online' : ''}`}/>{connected ? 'Connected to cloud' : 'Waiting for cloud setup'}</div></div><button className="help-button" title="Sync information" onClick={() => setNotice('One Tap publishes a fresh Safar snapshot at startup and every ten minutes while online.')}><CircleHelp size={16}/></button></section></div>}
        {notice && <div className="toast-note"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
      </div>
      <footer className="site-footer"><span>ONE TAP <i>•</i> SAFAR PRODUCTION</span><span>{snapshot.updatedAt ? `Last update ${new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready for workstation sync'}</span></footer>
    </main>
  </div>
}
