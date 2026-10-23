import React, { useState, useEffect } from 'react'
import { PAGE_META } from '../../types'
import { Card, CardHeader, PageHero } from '../../components/Card'
import { PageIcon } from '../../components/PageIcon'
import { Button } from '../../components/Button'
import { BrowseRow } from '../../components/Input'
import StatCard, { StatusChip } from '../../components/StatCard'
import LogBox, { useLogLines } from '../../components/LogBox'
import ProgressBar from '../../components/ProgressBar'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import confetti from 'canvas-confetti'
import './PVSeparator.css'

const meta = PAGE_META['pvseparator']
const api  = (window as any).api

interface ScanResultData {
  total_files: number
  total_photos: number
  total_videos: number
  total_audio: number
  total_misc: number
  photo_bytes: number
  photo_exts: Record<string, number>
  video_exts: Record<string, number>
  audio_exts: Record<string, number>
  misc_exts: Record<string, number>
  event_folders: string[]
  error?: string
}

export default function PVSeparator(): JSX.Element {
  const { playTick, playSuccess, playError } = useSound()
  const { showToast } = useToast()
  const { lines: logLines, addLine: addLog, clear: clearLogs } = useLogLines()

  const [sourceDir, setSourceDir] = useState('')
  const [destDir, setDestDir]     = useState('')
  const [actionMode, setActionMode] = useState<'copy' | 'move'>('copy')

  const [isScanning, setIsScanning]     = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const [scanData, setScanData] = useState<ScanResultData | null>(null)
  const [scannedSource, setScannedSource] = useState<string>('')
  const [statusChip, setStatusChip] = useState<{ label: string; variant: 'info' | 'success' | 'warning' | 'danger' }>({
    label: 'Ready',
    variant: 'info'
  })

  const [progressPct, setProgressPct]     = useState(0)
  const [progressLabel, setProgressLabel] = useState('Ready')
  const [speedMbps, setSpeedMbps]         = useState(0)
  const [etaSec, setEtaSec]               = useState(0)

  // Restore saved paths on mount
  useEffect(() => {
    if (!api || !api.settings) return
    api.settings.getAll().then((all: any) => {
      if (all.pvseparator_source) setSourceDir(all.pvseparator_source)
      if (all.pvseparator_dest)   setDestDir(all.pvseparator_dest)
    }).catch(() => {})
  }, [])

  // Register progress listener with Speed & ETA
  useEffect(() => {
    if (!api || !api.pvSeparator) return

    const unsub = api.pvSeparator.onProgress((data: any) => {
      if (data.total > 0) {
        const pct = Math.round((data.current / data.total) * 100)
        setProgressPct(pct)
      }
      if (data.label) setProgressLabel(data.label)
      if (data.speed_mbps !== undefined) setSpeedMbps(data.speed_mbps)
      if (data.eta_sec !== undefined) setEtaSec(data.eta_sec)

      if (data.log_entry) {
        addLog(data.log_entry, data.log_type || 'info')
      }
    })

    return () => {
      if (typeof unsub === 'function') unsub()
      if (api.pvSeparator?.removeListeners) api.pvSeparator.removeListeners()
    }
  }, [addLog])

  // Browse Source folder
  const handleBrowseSource = async () => {
    playTick()
    try {
      if (!api || !api.dialog) return
      const folder = await api.dialog.openFolder({ title: 'Select Source Directory' })
      if (folder) {
        setSourceDir(folder)
        addLog(`Source directory set: ${folder}`, 'info')
        if (api.settings?.setAndSave) api.settings.setAndSave('pvseparator_source', folder)
      }
    } catch (err: any) {
      playError()
      showToast({ title: 'Browse Error', message: err.message || 'Failed to select source', type: 'danger' })
    }
  }

  // Browse Destination folder
  const handleBrowseDest = async () => {
    playTick()
    try {
      if (!api || !api.dialog) return
      const folder = await api.dialog.openFolder({ title: 'Select Destination Directory' })
      if (folder) {
        setDestDir(folder)
        addLog(`Destination directory set: ${folder}`, 'info')
        if (api.settings?.setAndSave) api.settings.setAndSave('pvseparator_dest', folder)
      }
    } catch (err: any) {
      playError()
      showToast({ title: 'Browse Error', message: err.message || 'Failed to select destination', type: 'danger' })
    }
  }

  // Single Unified Action Button: Auto-Scan & Start Extraction
  const handleSingleAction = async () => {
    playTick()
    if (isProcessing || isScanning) return

    const sDir = sourceDir.trim()
    const dDir = destDir.trim()

    if (!sDir) {
      playError()
      showToast({ title: 'Missing Source', message: 'Please select a source directory first.', type: 'warning' })
      return
    }
    if (!dDir) {
      playError()
      showToast({ title: 'Missing Destination', message: 'Please select a destination directory first.', type: 'warning' })
      return
    }

    try {
      if (!api || !api.pvSeparator) throw new Error('PV Separator API not loaded.')

      let currentScan = scanData

      // Step 1: Scan automatically if not scanned yet or if source directory path changed
      if (!currentScan || scannedSource !== sDir) {
        setIsScanning(true)
        setStatusChip({ label: 'Analyzing Media...', variant: 'info' })
        addLog(`Analyzing source directory: ${sDir}`, 'info')

        const scanResult: ScanResultData = await api.pvSeparator.scanFolder(sDir)
        setIsScanning(false)

        if (scanResult.error) {
          playError()
          addLog(`Analysis failed: ${scanResult.error}`, 'error')
          setStatusChip({ label: 'Analysis Error', variant: 'danger' })
          showToast({ title: 'Analysis Failed', message: scanResult.error, type: 'danger' })
          return
        }

        setScanData(scanResult)
        setScannedSource(sDir)
        currentScan = scanResult

        const photoSizeMB = (scanResult.photo_bytes / (1024 * 1024)).toFixed(1)
        addLog(`Analysis complete: Found ${scanResult.total_photos} photos (${photoSizeMB} MB) across ${scanResult.event_folders.length} folder(s). ${scanResult.total_videos} video files untouched.`, 'success')
      }

      if (currentScan.total_photos === 0) {
        playError()
        setStatusChip({ label: 'No Photos Found', variant: 'warning' })
        showToast({ title: 'No Photos Found', message: 'No photo files were found in the selected source directory.', type: 'warning' })
        return
      }

      // Step 2: Start Extraction Immediately
      setIsProcessing(true)
      setProgressLabel('Starting parallel extraction...')
      setProgressPct(0)
      setSpeedMbps(0)
      setEtaSec(0)
      setStatusChip({ label: 'Extracting Photos...', variant: 'warning' })

      addLog(`Starting high-speed ${actionMode === 'copy' ? 'Copy' : 'Move'} extraction with 16 parallel worker threads...`, 'info')

      const result = await api.pvSeparator.startProcessing({
        sourceDir: sDir,
        destDir: dDir,
        action: actionMode
      })

      if (result.error) {
        playError()
        addLog(`Extraction failed: ${result.error}`, 'error')
        setStatusChip({ label: 'Extraction Failed', variant: 'danger' })
        showToast({ title: 'Extraction Failed', message: result.error, type: 'danger' })
      } else {
        playSuccess()
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
        setProgressPct(100)
        setProgressLabel('Complete!')
        setStatusChip({ label: 'Complete!', variant: 'success' })
        addLog(`Completed! ${result.success_count} photo files processed in ${result.elapsed_sec}s (Avg ${result.avg_speed_mbps} MB/s, ${result.error_count} errors)`, 'success')
        showToast({
          title: 'Extraction & Separation Complete!',
          message: `Successfully processed & moved ${result.success_count} photo files in ${result.elapsed_sec}s!`,
          type: 'success',
          badge: 'MEDIA SEPARATOR',
          action: { label: 'Open Destination', onClick: () => api.shell.openFolder(dDir) }
        })
      }
    } catch (e: any) {
      playError()
      addLog(`Extraction error: ${e.message || String(e)}`, 'error')
      setStatusChip({ label: 'Extraction Error', variant: 'danger' })
    } finally {
      setIsScanning(false)
      setIsProcessing(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatEta = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const renderExtTags = (extsObj?: Record<string, number>, emptyLabel = 'None') => {
    if (!extsObj || Object.keys(extsObj).length === 0) {
      return <div className="pvs-tags-empty">{emptyLabel}</div>
    }
    return Object.entries(extsObj).sort(([a], [b]) => a.localeCompare(b)).map(([ext, count]) => (
      <span key={ext} className="pvs-tag-pill">
        {ext} <span className="pvs-tag-pill-count">({count.toLocaleString()})</span>
      </span>
    ))
  }

  return (
    <div className="pvs-page">

      {/* Page Hero Header Component */}
      <PageHero
        icon={<PageIcon pageKey="pvseparator" size={24} color="#FFFFFF" />}
        label={meta.label}
        subtitle={meta.subtitle}
        accent={meta.accent}
        accentSoft={meta.accentSoft}
        right={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <StatusChip label={`${speedMbps.toFixed(1)} MB/s`} variant="info" />
            <StatusChip label="16 Threads" variant="warning" />
            <StatusChip label="v3.0 Ultra" variant="muted" />
          </div>
        }
      />

      {/* 2-Column Split Workspace */}
      <div className="pvs-grid">

        {/* Left Column: Media Directories, Mode & Single Action Button */}
        <div className="pvs-col-left">

          <Card>
            <CardHeader
              title="MEDIA DIRECTORIES & CONTROLS"
              accent={meta.accent}
              accentSoft={meta.accentSoft}
            />
            <div className="pvs-card-body">
              <div className="pvs-folders-list">
                <BrowseRow
                  label="Source Directory (Photos & Videos)"
                  value={sourceDir}
                  placeholder="Select or drop source directory path..."
                  accent={meta.accent}
                  onBrowse={handleBrowseSource}
                  onChange={(val) => {
                    setSourceDir(val)
                    if (api?.settings?.setAndSave) api.settings.setAndSave('pvseparator_source', val)
                  }}
                />
                <BrowseRow
                  label="Destination Directory (Photo Data Output)"
                  value={destDir}
                  placeholder="Select or drop destination directory path..."
                  accent={meta.accent}
                  onBrowse={handleBrowseDest}
                  onChange={(val) => {
                    setDestDir(val)
                    if (api?.settings?.setAndSave) api.settings.setAndSave('pvseparator_dest', val)
                  }}
                />
              </div>

              <div className="pvs-mode-section">
                <label className="pvs-section-label">Extraction Mode</label>
                <div className="pvs-mode-pills">
                  <button
                    type="button"
                    className={`pvs-mode-pill ${actionMode === 'copy' ? 'active' : ''}`}
                    onClick={() => { playTick(); setActionMode('copy') }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span>Copy (Safe)</span>
                  </button>
                  <button
                    type="button"
                    className={`pvs-mode-pill ${actionMode === 'move' ? 'active' : ''}`}
                    onClick={() => { playTick(); setActionMode('move') }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                    <span>Move</span>
                  </button>
                </div>
              </div>

              {/* Single Unified Action Button */}
              <div className="pvs-main-action-area">
                <Button
                  className="pvs-start-btn"
                  onClick={handleSingleAction}
                  disabled={isScanning || isProcessing || !sourceDir.trim() || !destDir.trim()}
                  variant="primary"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isScanning ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spin-slow"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      <span>Analyzing Media...</span>
                    </>
                  ) : isProcessing ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spin-slow"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      <span>Extracting Photos...</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      <span>Start Photo Extraction</span>
                    </>
                  )}
                </Button>

                <div className="pvs-status-bar">
                  <StatusChip label={statusChip.label} variant={statusChip.variant} />
                </div>
              </div>

            </div>
          </Card>

        </div>

        {/* Right Column: Scan Payload HUD & Inspection */}
        <div className="pvs-col-right">

          {!scanData ? (
            <Card style={{ height: '100%', minHeight: '340px' }}>
              <CardHeader
                title="SCAN ANALYSIS & MEDIA PAYLOAD"
                accent={meta.accent}
                accentSoft={meta.accentSoft}
              />
              <div className="pvs-empty-hud">
                <span className="pvs-empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </span>
                <span className="pvs-empty-title">Ready for Analysis & Extraction</span>
                <span className="pvs-empty-desc">
                  Select your source and destination directories on the left, then click <strong>Start Photo Extraction</strong> to analyze and extract photo data in one click.
                </span>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="SCAN ANALYSIS & MEDIA PAYLOAD"
                accent={meta.accent}
                accentSoft={meta.accentSoft}
              />
              <div className="pvs-card-body">

                {/* Stat Cards HUD */}
                <div className="pvs-stats-grid">
                  <StatCard
                    label="Total Files"
                    value={scanData.total_files.toLocaleString()}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>}
                    accent={meta.accent}
                    accentSoft="var(--surface-2)"
                  />
                  <StatCard
                    label="Photos Extracted"
                    value={scanData.total_photos.toLocaleString()}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
                    accent="#10b981"
                    accentSoft="rgba(16, 185, 129, 0.12)"
                  />
                  <StatCard
                    label="Photo Payload"
                    value={formatBytes(scanData.photo_bytes)}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>}
                    accent="#8b5cf6"
                    accentSoft="rgba(139, 92, 246, 0.12)"
                  />
                  <StatCard
                    label="Videos Untouched"
                    value={scanData.total_videos.toLocaleString()}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>}
                    accent="#f59e0b"
                    accentSoft="rgba(245, 158, 11, 0.12)"
                  />
                </div>

                {/* Extension Column Cards */}
                <div className="pvs-ext-grid">
                  <Card className="pvs-ext-card">
                    <CardHeader
                      title="Photos & Sidecars"
                      accent="#10b981"
                      accentSoft="rgba(16, 185, 129, 0.12)"
                    />
                    <div className="pvs-ext-body">
                      {renderExtTags(scanData.photo_exts, 'No photo extensions found')}
                    </div>
                  </Card>

                  <Card className="pvs-ext-card">
                    <CardHeader
                      title="Videos (In Source)"
                      accent="#f59e0b"
                      accentSoft="rgba(245, 158, 11, 0.12)"
                    />
                    <div className="pvs-ext-body">
                      {renderExtTags(scanData.video_exts, 'No video extensions found')}
                    </div>
                  </Card>

                  <Card className="pvs-ext-card">
                    <CardHeader
                      title="Other Media"
                      accent="#8b5cf6"
                      accentSoft="rgba(139, 92, 246, 0.12)"
                    />
                    <div className="pvs-ext-body">
                      {renderExtTags({ ...scanData.audio_exts, ...scanData.misc_exts }, 'No misc extensions found')}
                    </div>
                  </Card>
                </div>

              </div>
            </Card>
          )}

        </div>

      </div>

      {/* Bottom Execution Panel & Terminal LogBox */}
      <Card>
        <CardHeader
          title="EXTRACTION PROGRESS & TERMINAL"
          accent={meta.accent}
          accentSoft={meta.accentSoft}
        />
        <div className="pvs-card-body">
          <ProgressBar
            value={progressPct}
            accent={meta.accent}
            label={progressLabel}
            status={`${speedMbps.toFixed(1)} MB/s  |  ETA: ${formatEta(etaSec)}`}
          />

          {/* Native LogBox */}
          <LogBox
            lines={logLines}
            onClear={clearLogs}
            maxHeight="200px"
            statusState={isProcessing || isScanning ? 'running' : 'idle'}
          />
        </div>
      </Card>

    </div>
  )
}
