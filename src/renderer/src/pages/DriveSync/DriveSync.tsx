import React, { useState, useEffect } from 'react'
import { PAGE_META } from '../../types'
import { Card, CardHeader } from '../../components/Card'
import { Button, DangerButton, GhostButton } from '../../components/Button'
import { BrowseRow, Input } from '../../components/Input'
import ProgressBar from '../../components/ProgressBar'
import StatCard, { StatusChip } from '../../components/StatCard'
import PageIcon from '../../components/PageIcon'
import './DriveSync.css'

const meta = PAGE_META['drivesync']
const api  = (window as any).api

export default function DriveSync(): JSX.Element {
  const [sources, setSources]          = useState<string[]>([])
  const [dest, setDest]                = useState('')
  const [threads, setThreads]          = useState('16')
  const [running, setRunning]          = useState(false)
  const [progress, setProgress]        = useState(0)
  const [speedMBs, setSpeedMBs]       = useState('0')
  const [done, setDone]                = useState(0)
  const [total, setTotal]              = useState(0)
  const [totalBytes, setTotalBytes]     = useState(0)
  const [bytesDone, setBytesDone]       = useState(0)
  const [result, setResult]            = useState<null | { copied: number; cancelled?: boolean }>(null)
  const [log, setLog]                  = useState<Array<{ msg: string; level?: string }>>([])
  
  const [availableDrives, setAvailableDrives] = useState<string[]>([])
  const [isDropActive, setIsDropActive]       = useState(false)
  const [isDestDropActive, setIsDestDropActive] = useState(false)

  const [configWidth, setConfigWidth] = useState<number>(() => {
    const saved = localStorage.getItem('ot_drivesync_width')
    return saved ? parseInt(saved, 10) : 480
  })

  const [panelAlign, setPanelAlign] = useState<'left' | 'right'>(() => {
    const saved = localStorage.getItem('ot_drivesync_align')
    return (saved === 'left' || saved === 'right') ? saved : 'left'
  })

  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    localStorage.setItem('ot_drivesync_width', String(configWidth))
  }, [configWidth])

  useEffect(() => {
    localStorage.setItem('ot_drivesync_align', panelAlign)
  }, [panelAlign])

  // Fetch available system drives
  useEffect(() => {
    if (api && api.system && api.system.getDrives) {
      api.system.getDrives().then((drives: string[]) => {
        if (Array.isArray(drives)) setAvailableDrives(drives)
      }).catch(() => {})
    }
  }, [])

  // Deep xxHash64 verification toggle
  const [verifyHash, setVerifyHash] = useState<boolean>(() => localStorage.getItem('ot_drivesync_verify_hash') === 'true')
  const handleToggleVerifyHash = (checked: boolean) => {
    setVerifyHash(checked)
    localStorage.setItem('ot_drivesync_verify_hash', String(checked))
  }

  // Auto-Detect Daemon
  const [daemonStatus, setDaemonStatus] = useState<any>(null)
  useEffect(() => {
    if (!api || !api.driveSync) return
    if (api.driveSync.getDaemonStatus) {
      api.driveSync.getDaemonStatus().then((st: any) => { if (st) setDaemonStatus(st) }).catch(() => {})
    }
    if (api.driveSync.onDaemonUpdate) {
      const unsub = api.driveSync.onDaemonUpdate((st: any) => {
        if (st) setDaemonStatus(st)
      })
      return () => { if (unsub) unsub() }
    }
    return
  }, [])

  const handleToggleDaemon = async () => {
    if (!api?.driveSync?.toggleDaemon) return
    const res = await api.driveSync.toggleDaemon()
    setDaemonStatus(res)
  }

  const handleDaemonScanNow = async () => {
    if (!api?.driveSync?.scanDaemonNow) return
    const res = await api.driveSync.scanDaemonNow()
    setDaemonStatus(res)
  }

  // Dual-Drive Backup Reconciler
  const [reconciling, setReconciling] = useState(false)
  const [reconcileResult, setReconcileResult] = useState<any>(null)

  const handleRunReconcile = async () => {
    if (!api?.driveSync?.reconcileDrives) return
    setReconciling(true)
    try {
      const res = await api.driveSync.reconcileDrives({ notifyOnMismatch: true })
      setReconcileResult(res)
    } catch (e) {
      console.error('Reconcile error:', e)
    } finally {
      setReconciling(false)
    }
  }

  const handleApplyReconcileSync = () => {
    if (!reconcileResult) return
    const allMissingSources: string[] = []
    if (reconcileResult.missingSafars) {
      for (const item of reconcileResult.missingSafars) {
        allMissingSources.push(item.workingPath)
      }
    }
    if (reconcileResult.missingDateFolders) {
      for (const item of reconcileResult.missingDateFolders) {
        allMissingSources.push(item.workingPath)
      }
    }
    if (reconcileResult.outOfSyncFolders) {
      for (const item of reconcileResult.outOfSyncFolders) {
        allMissingSources.push(item.workingPath)
      }
    }

    if (allMissingSources.length > 0) {
      setSources(Array.from(new Set(allMissingSources)))
    }
    if (reconcileResult.backupSafarRoot) {
      setDest(reconcileResult.backupSafarRoot)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const startX = e.clientX
    const startWidth = configWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = panelAlign === 'left'
        ? Math.max(340, Math.min(startWidth + deltaX, 800))
        : Math.max(340, Math.min(startWidth - deltaX, 800))
      setConfigWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
  }

  const [lastReportData, setLastReportData] = useState<any>(null)
  const [exportStatus, setExportStatus]       = useState<string | null>(null)

  useEffect(() => {
    if (!api || !api.driveSync) return
    api.settings.getAll().then((all: any) => setThreads(String(all.drivesync_threads ?? 16)))
    api.driveSync.onFound((d: any) => { setTotal(d.total); setTotalBytes(d.totalBytes ?? 0) })
    api.driveSync.onProgress((d: any) => {
      setProgress(d.percent ?? 0)
      setSpeedMBs(d.speedMBs ?? '0')
      setDone(d.done ?? 0)
      setBytesDone(d.bytesDone ?? 0)
    })
    api.driveSync.onLog((d: any) => setLog(p => [...p, { msg: d.message, level: d.level }]))
    api.driveSync.onStatus((d: any) => setLog(p => [...p, { msg: d.message }]))
    api.driveSync.onDone((d: any) => {
      setRunning(false)
      setResult({ copied: d.copied, cancelled: d.cancelled })
      if (d.reportData) setLastReportData(d.reportData)
    })
    return () => api.driveSync.removeListeners()
  }, [])

  async function start(): Promise<void> {
    if (sources.length === 0 || !dest) return
    setRunning(true)
    setResult(null)
    setLastReportData(null)
    setExportStatus(null)
    setProgress(0)
    setDone(0)
    setTotal(0)
    setBytesDone(0)
    setLog([])
    api.settings.setAndSave('drivesync_threads', parseInt(threads) || 16)
    await api.driveSync.start({ sources, destination: dest, verifyHash })
  }

  const [savedPath, setSavedPath]               = useState<string | null>(null)

  const handleExportExcel = async () => {
    try {
      const filePath = await api.driveSync.exportExcel(lastReportData)
      if (filePath) {
        setExportStatus(`✅ Excel report saved to file.`)
        setSavedPath(filePath)
      }
    } catch (err: any) {
      setExportStatus(`✖ Export failed: ${err.message || err}`)
    }
  }

  const handleExportPdf = async () => {
    try {
      const filePath = await api.driveSync.exportPdf(lastReportData)
      if (filePath) {
        setExportStatus(`✅ PDF audit report generated.`)
        setSavedPath(filePath)
      }
    } catch (err: any) {
      setExportStatus(`✖ Export failed: ${err.message || err}`)
    }
  }

  const handleExportBoth = async () => {
    try {
      const res = await api.driveSync.exportBoth(lastReportData)
      if (res && (res.folder || res.excelPath)) {
        setExportStatus(`✅ Saved both PDF & Excel reports.`)
        setSavedPath(res.folder || res.excelPath)
      }
    } catch (err: any) {
      setExportStatus(`✖ Export failed: ${err.message || err}`)
    }
  }

  function cancel(): void { api.driveSync.cancel() }

  const fmtBytes = (b: number): string => {
    if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`
    if (b >= 1e9)  return `${(b / 1e9).toFixed(1)} GB`
    if (b >= 1e6)  return `${(b / 1e6).toFixed(0)} MB`
    return `${(b / 1024).toFixed(0)} KB`
  }

  // Multi-folder drag and drop handlers
  const handleSourceDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDropActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedPaths: string[] = []
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const path = (e.dataTransfer.files[i] as any).path
        if (path) droppedPaths.push(path)
      }
      if (droppedPaths.length > 0) {
        setSources(prev => Array.from(new Set([...prev, ...droppedPaths])))
      }
    }
  }

  const handleDestDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDestDropActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedPath = (e.dataTransfer.files[0] as any).path
      if (droppedPath) setDest(droppedPath)
    }
  }

  const handleAddSourceFolders = async () => {
    if (!api || !api.dialog) return
    const selected = await (api.dialog.openFolders ? api.dialog.openFolders() : api.dialog.openFolder())
    if (Array.isArray(selected) && selected.length > 0) {
      setSources(prev => Array.from(new Set([...prev, ...selected])))
    } else if (typeof selected === 'string' && selected) {
      setSources(prev => Array.from(new Set([...prev, selected])))
    }
  }

  const removeSource = (pathToRemove: string) => {
    setSources(prev => prev.filter(p => p !== pathToRemove))
  }

  const renderConfigurationCard = () => (
    <Card className="anim-scale-in">
      <CardHeader 
        title="Multi-Folder Local Drive Copier" 
        accent={meta.accent} 
        accentSoft={meta.accentSoft} 
        right={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <GhostButton size="sm" onClick={() => setPanelAlign(p => p === 'left' ? 'right' : 'left')}>⇆ Layout</GhostButton>
            <StatusChip label={running ? 'Syncing…' : 'Idle'} variant={running ? 'warning' : 'muted'} />
          </div>
        }
      />
      <div className="ds-card-body">
        {/* DUAL-DRIVE BACKUP RECONCILER BAR */}
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(153, 153, 255, 0.1) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PageIcon pageKey="drivesync" size={24} color={meta.accent} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>
                  Dual-Drive Backup Reconciler (Working D: ➔ 4TB Backup)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Enforces <code>&lt;Drive&gt;:\SAFAR DATA\&lt;SafarName&gt;\&lt;DateFolder&gt;</code> and detects unbacked dates.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="sm" variant="secondary" onClick={handleRunReconcile} disabled={reconciling}>
                {reconciling ? 'Scanning Drives…' : 'Scan & Reconcile'}
              </Button>
              {reconcileResult && reconcileResult.totalMissingItems > 0 && (
                <Button size="sm" variant="primary" onClick={handleApplyReconcileSync}>
                  Queue {reconcileResult.totalMissingItems} Missing ({reconcileResult.backupDrive})
                </Button>
              )}
            </div>
          </div>

          {reconcileResult && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '12px' }}>
              {reconcileResult.totalMissingItems === 0 ? (
                <span style={{ color: '#10B981', fontWeight: 600 }}>
                  ✓ Working Drive ({reconcileResult.workingDrive}) and Backup Drive ({reconcileResult.backupDrive}) are fully in sync!
                </span>
              ) : (
                <div style={{ color: '#FBBF24' }}>
                  ⚠️ Found <strong>{reconcileResult.missingSafars.length}</strong> missing Safar(s), <strong>{reconcileResult.missingDateFolders.length}</strong> missing Date folder(s), and <strong>{reconcileResult.outOfSyncFolders.length}</strong> out-of-sync folder(s).
                </div>
              )}
            </div>
          )}

          {/* AUTO-DETECT DAEMON LIVE STATUS */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.3)',
            padding: '7px 12px',
            borderRadius: '8px',
            marginTop: '10px',
            fontSize: '11px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: daemonStatus?.active ? '#10B981' : '#6B7280',
                boxShadow: daemonStatus?.active ? '0 0 8px #10B981' : 'none'
              }} />
              <span style={{ fontWeight: 600, color: daemonStatus?.active ? '#10B981' : '#9CA3AF' }}>
                {daemonStatus?.active ? 'Auto-Detect Daemon Active' : 'Auto-Detect Daemon Paused'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                · Monitoring {daemonStatus?.workingDrive || 'D:'} & {daemonStatus?.backupDrive || 'E:'}
                {daemonStatus?.lastCheck ? ` (${Math.max(1, Math.round((Date.now() - daemonStatus.lastCheck) / 1000))}s ago)` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={handleDaemonScanNow}
                style={{ background: 'transparent', border: 'none', color: '#60A5FA', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
              >
                Scan Now
              </button>
              <button
                type="button"
                onClick={handleToggleDaemon}
                style={{ background: 'transparent', border: 'none', color: daemonStatus?.active ? '#F87171' : '#10B981', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
              >
                {daemonStatus?.active ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>
        </div>

        {/* DRAG & DROP MULTI-FOLDER ZONE */}
        <div 
          className={`ds-dropzone ${isDropActive ? 'ds-dropzone--active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDropActive(true) }}
          onDragLeave={(e) => { e.preventDefault(); setIsDropActive(false) }}
          onDrop={handleSourceDrop}
        >
          <div className="ds-dropzone-icon">
            <PageIcon pageKey="folder" size={32} color={meta.accent} />
          </div>
          <div className="ds-dropzone-text">
            <strong>Drag & Drop Multiple Folders Here</strong>
            <span>Drop 1 or more folders at once to queue them for ultra-fast transfer.</span>
          </div>
          <Button size="sm" variant="secondary" onClick={handleAddSourceFolders} style={{ marginLeft: 'auto' }}>
            Browse Folders
          </Button>
        </div>

        {/* SELECTED SOURCE FOLDERS LIST */}
        <div className="ds-sources-container">
          <div className="ds-sources-header">
            <span>Selected Source Folders ({sources.length}):</span>
            {sources.length > 0 && (
              <GhostButton size="sm" onClick={() => setSources([])}>Clear All</GhostButton>
            )}
          </div>
          {sources.length === 0 ? (
            <div className="ds-sources-empty">
              <span>No source folders added yet. Drag & drop folders above or click "Browse Folders".</span>
            </div>
          ) : (
            <div className="ds-sources-list">
              {sources.map((srcPath, idx) => (
                <div key={srcPath} className="ds-source-item">
                  <span className="ds-source-index">{idx + 1}.</span>
                  <span className="ds-source-icon"><PageIcon pageKey="folder" size={15} /></span>
                  <span className="ds-source-path" title={srcPath}>{srcPath}</span>
                  <button 
                    type="button" 
                    className="ds-source-remove" 
                    onClick={() => removeSource(srcPath)}
                    title="Remove this folder"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DESTINATION FOLDER / DRIVE PICKER */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDestDropActive(true) }}
          onDragLeave={(e) => { e.preventDefault(); setIsDestDropActive(false) }}
          onDrop={handleDestDrop}
          className={isDestDropActive ? 'ds-destzone--active' : ''}
        >
          <BrowseRow label="Destination Folder / Target Drive (TO)" value={dest} placeholder="Drag target folder here or select drive below..."
            accent={meta.accent} onBrowse={async () => { const p = await api.dialog.openFolder(); if (p) setDest(p) }}
            onChange={setDest}
          />
        </div>

        {/* QUICK DRIVE CHOICES */}
        {availableDrives.length > 0 && (
          <div className="ds-drives-picker">
            <span className="ds-drives-label">Quick Target Drive:</span>
            <div className="ds-drives-chips">
              {availableDrives.map(drive => (
                <button
                  key={drive}
                  type="button"
                  className={`ds-drive-chip ${dest === drive ? 'ds-drive-chip--selected' : ''}`}
                  onClick={() => setDest(drive)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="6" y1="12" x2="6.01" y2="12" />
                    <line x1="10" y1="12" x2="10.01" y2="12" />
                  </svg>
                  {drive}
                </button>
              ))}
            </div>
          </div>
        )}

        <Input label="Worker threads (Parallel Stream Transfer)" type="number" value={threads} min={1} max={32}
          accent={meta.accent}
          onChange={e => setThreads(e.target.value)}
          style={{ maxWidth: 220 }}
        />

        {/* xxHash64 INTEGRITY CHECK TOGGLE */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: verifyHash ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.03)',
          border: verifyHash ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          margin: '12px 0'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '12px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PageIcon pageKey="password_protect" size={14} color="#10B981" />
              <span>Deep Integrity Check (xxHash64)</span>
              {verifyHash && <span style={{ fontSize: '10px', padding: '1px 6px', background: '#10B981', color: '#000', borderRadius: '4px', fontWeight: 700 }}>ACTIVE</span>}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Streams 64-bit non-cryptographic xxHash checksums on source and destination to detect bit-rot and ensure zero data corruption.
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginLeft: '12px' }}>
            <input
              type="checkbox"
              checked={verifyHash}
              onChange={e => handleToggleVerifyHash(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10B981' }}
            />
          </label>
        </div>

        {running && (
          <ProgressBar value={progress} accent={meta.accent}
            label={`${done} / ${total || '?'} files (${progress}%)`}
            status={`${speedMBs} MB/s · ${fmtBytes(bytesDone)} / ${fmtBytes(totalBytes)}`}
          />
        )}

        <div className="ds-run-row">
          {running
            ? <DangerButton size="lg" onClick={cancel} style={{ flex: 1 }}>Cancel Transfer</DangerButton>
            : <Button size="lg" variant="primary" accent={meta.accent} accentHv={meta.accentHv}
                disabled={sources.length === 0 || !dest}
                onClick={start}
                style={{ flex: 1 }}
              >Start Multi-Folder Transfer</Button>
          }
          {sources.length > 0 && <Button variant="ghost" onClick={() => api.shell.openFolder(sources[0])}>Open First Source</Button>}
          {dest   && <Button variant="ghost" onClick={() => api.shell.openFolder(dest)}>Open Dest</Button>}
        </div>

        {result && (
          <div className={`ds-result ${result.cancelled ? 'ds-result--warn' : 'ds-result--success'}`}>
            {result.cancelled ? `Cancelled after copying ${result.copied} file(s).` : `Transfer Complete! ${result.copied} file(s) copied at ultra-fast speed across ${sources.length} folder(s).`}
          </div>
        )}

        {lastReportData && (
          <div className="ds-report-card">
            <div className="ds-report-header">
              <span className="ds-report-title">AUDIT REPORT EXPORTER</span>
              <span className="ds-report-sub">Save an official PDF or Excel report of this transfer task</span>
            </div>
            <div className="ds-report-actions">
              <Button variant="secondary" onClick={handleExportPdf}>Export PDF Report</Button>
              <Button variant="secondary" onClick={handleExportExcel}>Export Excel (.xlsx)</Button>
              <Button variant="primary" accent={meta.accent} accentHv={meta.accentHv} onClick={handleExportBoth}>Save Both (PDF & Excel)</Button>
            </div>
            {exportStatus && (
              <div className="ds-report-status">
                <span>{exportStatus}</span>
                {savedPath && (
                  <GhostButton size="sm" onClick={() => api.shell.openFolder(savedPath)}>
                    Open Location
                  </GhostButton>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )

  const renderLogCard = () => (
    <Card className="anim-scale-in">
      <CardHeader title="Sync Log" accent={meta.accent} accentSoft={meta.accentSoft} />
      <div className="ds-log-body">
        {log.map((l, i) => (
          <p key={i} className={`ds-log-line ${l.level === 'error' ? 'ds-log-line--error' : ''}`}>{l.msg}</p>
        ))}
      </div>
    </Card>
  )

  return (
    <div className="ds-page">
      {/* Stats */}
      <div className="ds-stats">
        <StatCard label="Files Found"  value={total > 0 ? String(total) : '—'} icon="📁" accent={meta.accent} accentSoft={meta.accentSoft} />
        <StatCard label="Copied"       value={done > 0 ? String(done) : '—'}   icon="✅" accent="var(--success)" accentSoft="var(--success-soft)" />
        <StatCard label="Transfer Speed" value={running ? `${speedMBs} MB/s` : '—'} icon="⚡" accent="var(--warning)" accentSoft="var(--warning-soft)" />
        <StatCard label="Data Copied"  value={bytesDone > 0 ? fmtBytes(bytesDone) : '—'} icon="💾" accent={meta.accent} accentSoft={meta.accentSoft} />
      </div>

      <div 
        className="ds-body"
        style={{
          display: 'grid',
          gridTemplateColumns: log.length > 0 ? (panelAlign === 'left' ? `${configWidth}px 6px 1fr` : `1fr 6px ${configWidth}px`) : '1fr',
          gap: 0,
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto',
          alignItems: 'flex-start'
        }}
      >
        {panelAlign === 'left' ? (
          <>
            {renderConfigurationCard()}
            {log.length > 0 && <div className="ds-splitter" onMouseDown={handleMouseDown} title="Drag to resize layout" />}
            {log.length > 0 && renderLogCard()}
          </>
        ) : (
          <>
            {log.length > 0 && renderLogCard()}
            {log.length > 0 && <div className="ds-splitter" onMouseDown={handleMouseDown} title="Drag to resize layout" />}
            {renderConfigurationCard()}
          </>
        )}
      </div>
      {isDragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none', background: 'transparent' }} />
      )}
    </div>
  )
}
