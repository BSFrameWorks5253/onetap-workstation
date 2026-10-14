import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Card, CardHeader } from '../../components/Card'
import { BrowseRow } from '../../components/Input'
import { Button } from '../../components/Button'
import StatCard from '../../components/StatCard'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import confetti from 'canvas-confetti'
import './VideoTransfer.css'

interface MatchItem {
  id: string
  videoPath?: string
  videoName?: string
  thumbnailPath?: string
  thumbnailName?: string
  videoThumbnailPath?: string
  videoThumbnailName?: string
  photoThumbnailPath?: string
  photoThumbnailName?: string
  photoFolderPath?: string
  photoFolderName?: string
  dateFolderName: string
  sequence: string
  prefix: string
  namePart: string
  reason?: string
  status: 'APPROVED' | 'MISMATCH' | 'IGNORED'
  isMatched: boolean
}

export default function VideoTransfer(): JSX.Element {
  const { playTick, playSuccess, playError } = useSound()
  const { showToast } = useToast()

  const [masterFolder, setMasterFolder] = useState('')
  const [videoFolder, setVideoFolder]   = useState('')
  const [photoFolder, setPhotoFolder]   = useState('')
  
  const [scanning, setScanning]       = useState(false)
  const [dateFolders, setDateFolders] = useState<Array<{ name: string; videoCount: number; photoFolderCount: number }>>([])
  const [photoFoldersByDate, setPhotoFoldersByDate] = useState<Record<string, Array<{ name: string; path: string }>>>({})

  const [matched, setMatched]     = useState<MatchItem[]>([])
  const [unmatched, setUnmatched] = useState<MatchItem[]>([])
  const [isApproved, setIsApproved] = useState(false)

  // Filters & Search
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'unmatched' | 'transferred'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Transfer Preview & Inspection States
  const [isPreviewOpen, setIsPreviewOpen]         = useState(false)
  const [hasReviewedPreview, setHasReviewedPreview] = useState(false)
  const [showWarningModal, setShowWarningModal]   = useState(false)
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<{ url: string; title: string } | null>(null)

  // Collision Policy & Dry Run
  const [collisionPolicy, setCollisionPolicy] = useState<'keepBoth' | 'overwrite' | 'skip'>('keepBoth')
  const [dryRunResult, setDryRunResult] = useState<{ totalBytes: number; fileCount: number; freeBytes: number | null; hasSufficientSpace: boolean } | null>(null)
  const [checkingDryRun, setCheckingDryRun] = useState(false)
  const [dateMismatchData, setDateMismatchData] = useState<{ videoDates: string[]; photoDates: string[] } | null>(null)

  // Execution & Progress State
  const [transferring, setTransferring]   = useState(false)
  const [undoing, setUndoing]             = useState(false)
  const [transferProgress, setTransferProgress] = useState(0)
  const [currentFile, setCurrentFile]     = useState('')
  const [speedMbps, setSpeedMbps]         = useState(0)
  const [etaSec, setEtaSec]               = useState(0)
  const [transferredLog, setTransferredLog] = useState<Array<{ videoName: string; photoFolderName: string; targetPath: string; thumbnailTargetPath?: string }>>([])
  const [transferCompleted, setTransferCompleted] = useState(false)

  const api = (window as any).api

  // Register progress listener with Speed & ETA
  useEffect(() => {
    if (!api?.videoTransfer) return
    const unsub = api.videoTransfer.onProgress((data: { percent: number; done: number; total: number; currentFile: string; speedMbps?: number; etaSec?: number }) => {
      setTransferProgress(data.percent)
      setCurrentFile(data.currentFile)
      if (data.speedMbps !== undefined) setSpeedMbps(data.speedMbps)
      if (data.etaSec !== undefined) setEtaSec(data.etaSec)
    })
    return () => {
      unsub()
      api.videoTransfer.removeListeners()
    }
  }, [])

  const handleScan = async (vPath: string = videoFolder, pPath: string = photoFolder, mPath: string = masterFolder) => {
    if (!api?.videoTransfer) return
    if (!mPath && (!vPath || !pPath)) {
      showToast({ title: 'Select Input Directories', message: 'Please select either a Master Directory or both Video & Photo Directories.', type: 'warning' })
      return
    }

    setScanning(true)
    setTransferCompleted(false)
    setTransferredLog([])
    setDryRunResult(null)
    setHasReviewedPreview(false)
    setDateMismatchData(null)

    try {
      const payload = mPath ? { masterFolderPath: mPath } : { videoFolderPath: vPath, photoFolderPath: pPath }
      const res = await api.videoTransfer.scanFolder(payload)
      if (res && res.success) {
        if (res.videoFolderPath) setVideoFolder(res.videoFolderPath)
        if (res.photoFolderPath) setPhotoFolder(res.photoFolderPath)
        setDateFolders(res.dateFolders || [])
        setPhotoFoldersByDate(res.photoFoldersByDate || {})
        setMatched(res.matched || [])
        setUnmatched(res.unmatched || [])
        setIsApproved(res.isApproved ?? false)
        playSuccess()
      } else if (res && res.isDateMismatch) {
        setDateMismatchData({
          videoDates: res.videoDateFolders || [],
          photoDates: res.photoDateFolders || []
        })
        playError()
        showToast({ title: 'Date Folder Mismatch', message: 'The selected video and photo folders are of 2 different names.', type: 'danger' })
      } else {
        throw new Error(res?.error || 'Failed to scan directories.')
      }
    } catch (err: any) {
      console.error('[VideoTransfer] Scan error:', err)
      playError()
      showToast({ title: 'Scan Error', message: err.message || String(err), type: 'danger' })
    } finally {
      setScanning(false)
    }
  }

  const handleBrowseMaster = async () => {
    if (!api?.dialog) return
    const p = await api.dialog.openFolder({ title: 'Select MASTER Directory (contains Video & Photo folders)' })
    if (p) {
      playTick()
      setMasterFolder(p)
      await handleScan('', '', p)
    }
  }

  const handleBrowseVideo = async () => {
    if (!api?.dialog) return
    const p = await api.dialog.openFolder({ title: 'Select 1. VIDEO Main Directory (contains Date Subfolders)' })
    if (p) {
      playTick()
      setVideoFolder(p)
      setMasterFolder('')
      if (photoFolder) {
        await handleScan(p, photoFolder, '')
      }
    }
  }

  const handleBrowsePhoto = async () => {
    if (!api?.dialog) return
    const p = await api.dialog.openFolder({ title: 'Select 2. PHOTO Main Directory (contains Date Subfolders)' })
    if (p) {
      playTick()
      setPhotoFolder(p)
      setMasterFolder('')
      if (videoFolder) {
        await handleScan(videoFolder, p, '')
      }
    }
  }

  const ignoreSingle = (id: string) => {
    playTick()
    const nextUnmatched = unmatched.filter(u => u.id !== id)
    setUnmatched(nextUnmatched)
    if (nextUnmatched.length === 0 && matched.length > 0) {
      setIsApproved(true)
    }
  }

  const ignoreAllMismatches = () => {
    playTick()
    setUnmatched([])
    if (matched.length > 0) {
      setIsApproved(true)
    }
    showToast({ title: 'Mismatches Ignored', message: 'All sequence mismatches ignored.', type: 'info' })
  }

  // Interactive Manual Matcher logic
  const handleManualPair = (item: MatchItem, targetPath: string) => {
    if (!targetPath) return
    playTick()

    const availFolders = photoFoldersByDate[item.dateFolderName] || []
    const targetFolderObj = availFolders.find(f => f.path === targetPath)
    const targetFolderName = targetFolderObj ? targetFolderObj.name : targetPath.split(/[\/\\]/).pop() || 'Target Folder'

    const newMatchedItem: MatchItem = {
      id: `${item.videoPath}_${targetPath}`,
      videoPath: item.videoPath,
      videoName: item.videoName,
      thumbnailPath: item.thumbnailPath,
      thumbnailName: item.thumbnailName,
      photoFolderPath: targetPath,
      photoFolderName: targetFolderName,
      dateFolderName: item.dateFolderName,
      sequence: item.sequence || 'MANUAL',
      prefix: item.prefix || '',
      namePart: item.namePart || '',
      status: 'APPROVED',
      isMatched: true
    }

    setMatched(prev => [...prev, newMatchedItem])
    const nextUnmatched = unmatched.filter(u => u.id !== item.id)
    setUnmatched(nextUnmatched)

    if (nextUnmatched.length === 0) {
      setIsApproved(true)
    }

    showToast({
      title: 'Manual Match Pair Created!',
      message: `Paired ${item.videoName} ➔ ${targetFolderName}`,
      type: 'success'
    })
  }

  // Pre-Flight Dry Run check
  const handleCheckDryRun = async () => {
    if (matched.length === 0 || !api?.videoTransfer) return
    setCheckingDryRun(true)
    playTick()

    try {
      const itemsToCopy = matched
        .filter(m => m.videoPath && m.photoFolderPath)
        .map(m => ({
          videoPath: m.videoPath!,
          thumbnailPath: m.thumbnailPath,
          photoFolderPath: m.photoFolderPath!
        }))

      const res = await api.videoTransfer.checkDryRun(itemsToCopy)
      if (res && res.success) {
        setDryRunResult(res)
        playSuccess()
      } else {
        throw new Error(res?.error || 'Dry run check failed.')
      }
    } catch (err: any) {
      playError()
      showToast({ title: 'Dry Run Error', message: err.message || String(err), type: 'danger' })
    } finally {
      setCheckingDryRun(false)
    }
  }

  const handleStartTransferWithCheck = () => {
    if (matched.length === 0 || transferring) return
    if (!hasReviewedPreview) {
      setShowWarningModal(true)
      playTick()
      return
    }
    handleExecuteTransfer()
  }

  const handleExecuteTransfer = async () => {
    if (matched.length === 0 || !api?.videoTransfer || transferring) return
    
    setTransferring(true)
    setTransferProgress(5)
    setCurrentFile('Preparing file transfer...')
    setSpeedMbps(0)
    setEtaSec(0)
    playTick()

    try {
      const itemsToCopy = matched
        .filter(m => m.videoPath && m.photoFolderPath)
        .map(m => ({
          videoPath: m.videoPath!,
          videoName: m.videoName!,
          thumbnailPath: m.thumbnailPath,
          thumbnailName: m.thumbnailName,
          videoThumbnailPath: m.videoThumbnailPath,
          videoThumbnailName: m.videoThumbnailName,
          photoThumbnailPath: m.photoThumbnailPath,
          photoThumbnailName: m.photoThumbnailName,
          photoFolderPath: m.photoFolderPath!,
          photoFolderName: m.photoFolderName!,
          dateFolderName: m.dateFolderName
        }))

      const res = await api.videoTransfer.executeTransfer({
        itemsToTransfer: itemsToCopy,
        collisionPolicy
      })

      if (res && res.success) {
        setTransferProgress(100)
        setTransferCompleted(true)
        setTransferredLog(res.transferredFiles || [])
        playSuccess()
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })

        showToast({
          title: 'Video Transfer & Rename Complete!',
          message: `Successfully copied & renamed ${res.transferredCount} video clip(s) and photo thumbnail(s).`,
          type: 'success',
          badge: '📹 FILE TRANSFER',
          icon: '📦',
          action: { label: '📂 Open Photo Directory', onClick: () => api.shell.openFolder(photoFolder) }
        })
      } else {
        throw new Error(res?.error || 'Transfer failed.')
      }
    } catch (err: any) {
      console.error('[VideoTransfer] Transfer error:', err)
      playError()
      showToast({ title: 'Transfer Failed', message: err.message || String(err), type: 'danger' })
    } finally {
      setTransferring(false)
    }
  }

  const handleUndoTransfer = async () => {
    if (!transferredLog.length || !api?.videoTransfer || undoing) return

    setUndoing(true)
    playTick()

    try {
      const res = await api.videoTransfer.undoTransfer(transferredLog)
      if (res && res.success) {
        const undoneCount = res.undoneCount || transferredLog.length
        setTransferCompleted(false)
        setTransferredLog([])
        setTransferProgress(0)
        playSuccess()

        showToast({
          title: 'Transfer Undone',
          message: `Successfully removed ${undoneCount} transferred file(s) from target photo subfolders.`,
          type: 'info'
        })
      } else {
        throw new Error(res?.error || 'Failed to undo transfer.')
      }
    } catch (err: any) {
      console.error('[VideoTransfer] Undo error:', err)
      playError()
      showToast({ title: 'Undo Failed', message: err.message || String(err), type: 'danger' })
    } finally {
      setUndoing(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSeconds = (sec: number) => {
    if (!sec || sec <= 0) return '0s'
    const mins = Math.floor(sec / 60)
    const s = sec % 60
    return mins > 0 ? `${mins}m ${s}s` : `${s}s`
  }

  // Filter matched & unmatched clips based on search query
  const filteredMatched = matched.filter(m => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (m.videoName && m.videoName.toLowerCase().includes(q)) ||
      (m.photoFolderName && m.photoFolderName.toLowerCase().includes(q)) ||
      (m.dateFolderName && m.dateFolderName.toLowerCase().includes(q)) ||
      (m.sequence && m.sequence.toLowerCase().includes(q))
    )
  })

  const filteredUnmatched = unmatched.filter(u => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (u.videoName && u.videoName.toLowerCase().includes(q)) ||
      (u.photoFolderName && u.photoFolderName.toLowerCase().includes(q)) ||
      (u.dateFolderName && u.dateFolderName.toLowerCase().includes(q)) ||
      (u.reason && u.reason.toLowerCase().includes(q))
    )
  })

  return (
    <div className="vt-page anim-fade-in">
      
      {/* Engine Status Hero Card */}
      <Card style={{ padding: '20px 24px', borderLeft: '4px solid #8B5CF6' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
              📹
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                Video File ↔ Photo Subfolder Sequence Matcher & Transfer Engine
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Matches video clip names (e.g. 001 Z01.mp4) directly with photo sequence subfolders (e.g. 1448-01-14 _02E-QMZ/001 Z01) and transfers them into their target photo folders.
              </div>
            </div>
          </div>
          {dateFolders.length > 0 && (
            <span style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#6D28D9', border: '1.5px solid rgba(139, 92, 246, 0.3)', padding: '6px 14px', borderRadius: '99px', fontSize: '12px', fontWeight: '800' }}>
              📁 {dateFolders.length} Date Folder(s) Detected
            </span>
          )}
        </div>
      </Card>

      {/* Directory Selector Card */}
      <Card>
        <CardHeader title="1. Select Input Directories (Master Folder OR Dual Video & Photo Folders)" accent="#8B5CF6" />
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <BrowseRow
            label="📁 Master Directory (Auto-detect Video & Photo Folders)"
            value={masterFolder}
            placeholder="Select master directory path to auto-detect both video and photo folders..."
            accent="#3B82F6"
            onBrowse={handleBrowseMaster}
            onChange={v => {
              setMasterFolder(v)
              if (v) handleScan('', '', v)
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-soft)' }} />
            <span>OR SELECT SEPARATE DIRECTORIES</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-soft)' }} />
          </div>

          <BrowseRow
            label="🎬 1. Video Directory (contains Video Files)"
            value={videoFolder}
            placeholder="Select video directory or drag & drop folder path..."
            accent="#8B5CF6"
            onBrowse={handleBrowseVideo}
            onChange={v => { setVideoFolder(v); setMasterFolder('') }}
          />

          <BrowseRow
            label="📷 2. Photo Directory (contains Date & Photo Sequence Subfolders)"
            value={photoFolder}
            placeholder="Select photo directory or drag & drop folder path..."
            accent="#10B981"
            onBrowse={handleBrowsePhoto}
            onChange={v => { setPhotoFolder(v); setMasterFolder('') }}
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <Button
              variant="primary"
              accent="#8B5CF6"
              accentHv="#7C3AED"
              disabled={(!masterFolder && (!videoFolder || !photoFolder)) || scanning}
              onClick={() => handleScan()}
              style={{ padding: '12px 24px', fontWeight: 700 }}
            >
              {scanning ? '🔍 Scanning & Matching Videos & Photos...' : '🔍 Scan & Match Both Directories'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Results HUD */}
      {(matched.length > 0 || unmatched.length > 0) && (
        <>
          {/* Quick Metrics Grid */}
          <div className="vt-stats-grid">
            <StatCard
              icon="📁"
              label="Paired Date Folders"
              value={String(dateFolders.length)}
              accent="#8B5CF6"
              accentSoft="rgba(139, 92, 246, 0.12)"
            />
            <StatCard
              icon="🎬"
              label="Matched Video Clips"
              value={String(matched.length)}
              accent="#10B981"
              accentSoft="rgba(16, 185, 129, 0.12)"
            />
            <StatCard
              icon="📷"
              label="Target Photo Folders"
              value={String(matched.length)}
              accent="#6366F1"
              accentSoft="rgba(99, 102, 241, 0.12)"
            />
            <StatCard
              icon="⚠️"
              label="Sequence Alerts"
              value={String(unmatched.length)}
              accent={unmatched.length > 0 ? "#EF4444" : "#10B981"}
              accentSoft={unmatched.length > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)"}
            />
          </div>

          {/* Toolbar (Tab Filter Buttons & Search Input) — Sticky */}
          <div className="vt-toolbar-sticky-wrap">
            <div className="vt-toolbar-row">
              <div className="vt-tab-group">
                <button
                  className={`vt-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  All Items ({matched.length + unmatched.length})
                </button>
                <button
                  className={`vt-tab-btn ${activeTab === 'matched' ? 'active' : ''}`}
                  onClick={() => setActiveTab('matched')}
                >
                  ✔ Matched ({matched.length})
                </button>
                <button
                  className={`vt-tab-btn ${activeTab === 'unmatched' ? 'active' : ''}`}
                  onClick={() => setActiveTab('unmatched')}
                >
                  🔴 Mismatches ({unmatched.length})
                </button>
                {transferCompleted && (
                  <button
                    className={`vt-tab-btn ${activeTab === 'transferred' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transferred')}
                  >
                    🎉 Transferred ({transferredLog.length})
                  </button>
                )}
              </div>

              <div className="vt-search-wrap">
                <span className="vt-search-icon">🔍</span>
                <input
                  type="text"
                  className="vt-search-input"
                  placeholder="Search clips, sequence #, photo folders..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>


          {/* Top Approved Hero Banner */}
          {isApproved && (
            <div className="vt-approved-banner anim-scale-in">
              <div className="vt-approved-title-group">
                <div className="vt-approved-ring">✓</div>
                <div>
                  <div className="vt-approved-title">ALL SEQUENCES APPROVED & MATCHED PERFECTLY</div>
                  <div className="vt-approved-sub">All video clips pair with corresponding target photo subfolders. Ready for transfer!</div>
                </div>
              </div>
              <span className="vt-approved-badge">APPROVED</span>
            </div>
          )}

          {/* Red Mismatch Container (Interactive Manual Dropdown Matcher) */}
          {(activeTab === 'all' || activeTab === 'unmatched') && filteredUnmatched.length > 0 && (
            <div className="vt-mismatch-container anim-scale-in">
              <div className="vt-mismatch-header">
                <div className="vt-mismatch-title">
                  <span>🔴</span>
                  <span>Sequence Mismatches / Missing Folders ({filteredUnmatched.length})</span>
                </div>
                <div className="vt-btn-row">
                  <button className="vt-ctrl-btn" onClick={ignoreAllMismatches}>Ignore All</button>
                </div>
              </div>

              <div className="vt-mismatch-grid">
                {filteredUnmatched.map(u => {
                  const availablePhotoFolders = photoFoldersByDate[u.dateFolderName] || []
                  return (
                    <div key={u.id} className="vt-mismatch-card">
                      <div className="vt-mismatch-info" style={{ flex: 1 }}>
                        <span className="vt-mismatch-tag">
                          ⚠️ Date Folder "{u.dateFolderName}": {u.videoName || u.photoFolderName}
                        </span>
                        <span className="vt-mismatch-reason">{u.reason}</span>
                      </div>

                      {/* Manual Match Dropdown for Unmatched Videos */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {u.videoPath && availablePhotoFolders.length > 0 && (
                          <select
                            className="vt-dropdown-select"
                            defaultValue=""
                            onChange={e => {
                              if (e.target.value) {
                                handleManualPair(u, e.target.value)
                              }
                            }}
                          >
                            <option value="" disabled>-- Pair with Photo Folder --</option>
                            {availablePhotoFolders.map(pf => (
                              <option key={pf.path} value={pf.path}>
                                📷 {pf.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <button className="vt-ctrl-btn" onClick={() => ignoreSingle(u.id)}>Ignore</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Matched Items Card */}
          {(activeTab === 'all' || activeTab === 'matched') && (
            <Card>
              <CardHeader title={`2. Matched Video ↔ Photo Folders (${filteredMatched.length} Pairs)`} accent="#8B5CF6" />
              <div style={{ padding: '22px' }}>
                <div style={{ overflowX: 'auto', maxHeight: '340px' }}>
                  <table className="vt-table">
                    <thead>
                      <tr>
                        <th>Date Folder</th>
                        <th>Seq #</th>
                        <th>Source Video Clip</th>
                        <th>Target Photo Subfolder</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatched.map((m, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: '700' }}>📁 {m.dateFolderName}</td>
                          <td><span className="vt-seq-tag">{m.sequence || '—'}</span></td>
                          <td style={{ fontFamily: 'monospace' }}>
                            <div>🎬 {m.videoName}</div>
                            {m.thumbnailName && (
                              <span style={{ fontSize: '11px', color: '#10B981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px', marginTop: '3px', display: 'inline-block' }}>
                                🖼️ + Photo ({m.thumbnailName})
                              </span>
                            )}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>📷 {m.photoFolderName}</td>
                          <td>
                            <span style={{ color: '#10B981', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                              APPROVED
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredMatched.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                            No matched items match the search query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pre-Flight Dry Run Metrics Banner */}
                {dryRunResult && (
                  <div className="vt-dry-run-card anim-scale-in" style={{ marginTop: '18px' }}>
                    <div className="vt-dry-run-metrics">
                      <div className="vt-dry-metric">
                        <span className="vt-dry-metric-val">{dryRunResult.fileCount} clips</span>
                        <span className="vt-dry-metric-lbl">Total Files</span>
                      </div>
                      <div className="vt-dry-metric">
                        <span className="vt-dry-metric-val">{formatBytes(dryRunResult.totalBytes)}</span>
                        <span className="vt-dry-metric-lbl">Total Payload Size</span>
                      </div>
                      {dryRunResult.freeBytes !== null && (
                        <div className="vt-dry-metric">
                          <span className="vt-dry-metric-val" style={{ color: dryRunResult.hasSufficientSpace ? '#059669' : '#DC2626' }}>
                            {formatBytes(dryRunResult.freeBytes)}
                          </span>
                          <span className="vt-dry-metric-lbl">Drive Free Space</span>
                        </div>
                      )}
                    </div>
                    <span style={{
                      padding: '6px 14px', borderRadius: '99px', fontSize: '11px', fontWeight: 800,
                      background: dryRunResult.hasSufficientSpace ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: dryRunResult.hasSufficientSpace ? '#065F46' : '#991B1B',
                      border: dryRunResult.hasSufficientSpace ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1.5px solid rgba(239, 68, 68, 0.4)'
                    }}>
                      {dryRunResult.hasSufficientSpace ? '✓ DISK SPACE VALIDATED' : '⚠️ INSUFFICIENT DISK SPACE'}
                    </span>
                  </div>
                )}

                {/* Execution Action Bar (Collision Selector & Pre-Flight Check) */}
                <div style={{ marginTop: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {!transferring && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Collision Handling:</span>
                        <select
                          className="vt-dropdown-select"
                          value={collisionPolicy}
                          onChange={e => setCollisionPolicy(e.target.value as any)}
                        >
                          <option value="keepBoth">Keep Both (Auto-rename copy)</option>
                          <option value="overwrite">Overwrite existing file</option>
                          <option value="skip">Skip if file exists</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                        <Button
                          variant="secondary"
                          disabled={matched.length === 0 || checkingDryRun}
                          onClick={handleCheckDryRun}
                          style={{ padding: '12px 18px', fontSize: '13px', fontWeight: 700 }}
                        >
                          {checkingDryRun ? 'Checking Storage...' : '🛡️ Pre-Flight Storage Check'}
                        </Button>

                        <Button
                          variant="primary"
                          accent="#10B981"
                          accentHv="#059669"
                          disabled={matched.length === 0}
                          onClick={handleStartTransferWithCheck}
                          style={{ padding: '12px 24px', fontSize: '14px', fontWeight: 800 }}
                        >
                          📂 Transfer {matched.length} Matched Video(s)
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Transferring Progress Panel with Speed & ETA */}
                  {transferring && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--surface-2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-soft)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span>Transferring: {currentFile}</span>
                        <span style={{ color: '#10B981', fontWeight: 800 }}>{transferProgress}%</span>
                      </div>

                      <div className="vt-progress-bar-wrap">
                        <div className="vt-progress-bar-fill" style={{ width: `${transferProgress}%` }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>
                        <span>🚀 Speed: <strong style={{ color: '#6D28D9' }}>{speedMbps} MB/s</strong></span>
                        <span>⏱️ ETA: <strong style={{ color: '#6D28D9' }}>{formatSeconds(etaSec)}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Transfer Preview & Dual Thumbnail Inspection Section */}
          {(activeTab === 'all' || activeTab === 'matched') && matched.length > 0 && (
            <div className="vt-preview-section anim-scale-in">
              <div className="vt-preview-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    🔍 Transfer Preview & Dual Thumbnail Inspection ({filteredMatched.length} Items)
                  </span>
                  {hasReviewedPreview ? (
                    <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      ✓ PREVIEW REVIEWED
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      ⚠️ PREVIEW UNCHECKED
                    </span>
                  )}
                </div>
                <button
                  className="vt-tab-btn"
                  onClick={() => {
                    setIsPreviewOpen(prev => !prev)
                    setHasReviewedPreview(true)
                  }}
                  style={{ fontSize: '12px', fontWeight: 700, padding: '6px 14px', background: isPreviewOpen ? 'var(--accent-video, #8B5CF6)' : '#F1F5F9', color: isPreviewOpen ? '#FFFFFF' : '#475569', border: '1px solid var(--border-soft, #E2E8F0)', borderRadius: '8px' }}
                >
                  {isPreviewOpen ? '🔼 Hide Transfer Preview' : '🔽 Open Transfer Preview'}
                </button>
              </div>

              {isPreviewOpen && (
                <div className="vt-preview-grid">
                  {filteredMatched.map((m, idx) => {
                    const vThumbUrl = m.videoThumbnailPath ? `local-resource://${encodeURI(m.videoThumbnailPath.replace(/\\/g, '/'))}` : ''
                    const pThumbUrl = m.photoThumbnailPath ? `local-resource://${encodeURI(m.photoThumbnailPath.replace(/\\/g, '/'))}` : ''

                    return (
                      <div key={idx} className="vt-preview-card">
                        <div className="vt-preview-card-meta">
                          <span>📁 Date Folder: <strong style={{ color: '#D97706' }}>{m.dateFolderName}</strong></span>
                          <span className="vt-seq-tag">Seq #{m.sequence || '—'}</span>
                        </div>

                        <div className="vt-preview-mapping">
                          <div className="vt-preview-mapping-row">
                            <span style={{ color: '#4338CA', minWidth: '110px', fontWeight: 800 }}>🎬 Source Video:</span>
                            <span className="vt-preview-filename-badge" style={{ color: '#312E81', background: '#EEF2FF', border: '1.5px solid #C7D2FE' }}>
                              {m.videoName}
                            </span>
                          </div>
                          <div className="vt-preview-mapping-row">
                            <span style={{ color: '#065F46', minWidth: '110px', fontWeight: 800 }}>📷 Target Folder:</span>
                            <span className="vt-preview-filename-badge" style={{ color: '#064E3B', background: '#ECFDF5', border: '1.5px solid #A7F3D0' }}>
                              {m.photoFolderName}
                            </span>
                          </div>
                        </div>

                        <div className="vt-thumbs-row">
                          {/* Video Thumbnail Box (_V.jpg) */}
                          <div className="vt-thumb-box">
                            <div className="vt-thumb-box-header" style={{ color: '#5B21B6' }}>
                              <span>🎬</span> Video Thumb (_V.jpg)
                            </div>
                            <div
                              className="vt-thumb-img-wrap"
                              onClick={() => {
                                if (vThumbUrl) setActiveLightboxUrl({ url: vThumbUrl, title: `Video Thumb: ${m.videoThumbnailName || m.videoName}` })
                              }}
                            >
                              {vThumbUrl ? (
                                <>
                                  <img src={vThumbUrl} alt="Video Thumb" className="vt-thumb-img" />
                                  <div className="vt-thumb-zoom-overlay">🔍 Zoom</div>
                                </>
                              ) : (
                                <div className="vt-thumb-placeholder">
                                  <span style={{ fontSize: '28px' }}>🎬</span>
                                  <span>No _V.jpg Found</span>
                                </div>
                              )}
                            </div>
                            <div className="vt-thumb-filename" title={m.videoThumbnailName || 'No Video Thumbnail'}>
                              {m.videoThumbnailName || 'No _V.jpg'}
                            </div>
                          </div>

                          {/* Photo Thumbnail Box (_P.jpg) */}
                          <div className="vt-thumb-box">
                            <div className="vt-thumb-box-header" style={{ color: '#065F46' }}>
                              <span>📷</span> Photo Thumb (_P.jpg)
                            </div>
                            <div
                              className="vt-thumb-img-wrap"
                              onClick={() => {
                                if (pThumbUrl) setActiveLightboxUrl({ url: pThumbUrl, title: `Photo Thumb: ${m.photoThumbnailName || m.photoFolderName}` })
                              }}
                            >
                              {pThumbUrl ? (
                                <>
                                  <img src={pThumbUrl} alt="Photo Thumb" className="vt-thumb-img" />
                                  <div className="vt-thumb-zoom-overlay">🔍 Zoom</div>
                                </>
                              ) : (
                                <div className="vt-thumb-placeholder">
                                  <span style={{ fontSize: '28px' }}>📷</span>
                                  <span>No _P.jpg Found</span>
                                </div>
                              )}
                            </div>
                            <div className="vt-thumb-filename" title={m.photoThumbnailName || 'No Photo Thumbnail'}>
                              {m.photoThumbnailName || 'No _P.jpg'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Transferred Files Log */}
          {(activeTab === 'all' || activeTab === 'transferred') && transferCompleted && transferredLog.length > 0 && (
            <Card className="anim-scale-in">
              <CardHeader title="3. Transferred Files Log" accent="#10B981" />
              <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', padding: '16px', borderRadius: '12px', maxHeight: '220px', overflowY: 'auto' }}>
                  {transferredLog.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '12.5px', fontFamily: 'monospace', color: '#065F46', fontWeight: 700, padding: '4px 0' }}>
                      ✔ {item.videoName} ➔ {item.photoFolderName}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Button variant="secondary" onClick={() => api?.shell?.openFolder(photoFolder)}>
                    📂 Open Photo Directory
                  </Button>
                  <Button
                    variant="danger"
                    disabled={undoing}
                    onClick={handleUndoTransfer}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 18px', fontWeight: 800 }}
                  >
                    {undoing ? '↩️ Undoing Transfer...' : '↩️ Undo Last Transfer'}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Unchecked Preview Warning Confirmation Modal — Portal to body */}
      {showWarningModal && ReactDOM.createPortal(
        <div className="vt-modal-overlay">
          <div className="vt-modal-content anim-scale-in">
            <div className="vt-modal-header">
              <span style={{ fontSize: '26px' }}>⚠️</span>
              <div className="vt-modal-title">Unchecked Transfer Preview Warning</div>
            </div>

            <div className="vt-modal-body">
              You haven't opened or reviewed the <strong>Transfer Preview</strong> dropdown yet. Are you sure you want to proceed with transferring without checking the thumbnail previews and matched folder names?
            </div>

            <div className="vt-modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowWarningModal(false)
                  setIsPreviewOpen(true)
                  setHasReviewedPreview(true)
                }}
                style={{ fontWeight: 700, padding: '10px 16px' }}
              >
                🔍 Review Transfer Preview First
              </Button>
              <Button
                variant="primary"
                accent="#10B981"
                onClick={() => {
                  setShowWarningModal(false)
                  setHasReviewedPreview(true)
                  handleExecuteTransfer()
                }}
                style={{ fontWeight: 800, padding: '10px 18px' }}
              >
                🚀 Proceed Transfer Anyway
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Lightbox Fullscreen Image Zoom Modal — Portal to body */}
      {activeLightboxUrl && ReactDOM.createPortal(
        <div className="vt-lightbox-overlay" onClick={() => setActiveLightboxUrl(null)}>
          <div className="vt-lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={activeLightboxUrl.url} alt={activeLightboxUrl.title} className="vt-lightbox-img" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="vt-lightbox-title">{activeLightboxUrl.title}</div>
              <Button variant="secondary" onClick={() => setActiveLightboxUrl(null)} style={{ padding: '6px 16px', fontWeight: 800 }}>
                ✕ Close Preview
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Date Mismatch Popup Warning Modal — Portal to body */}
      {dateMismatchData && ReactDOM.createPortal(
        <div className="vt-modal-overlay">
          <div className="vt-modal-content anim-scale-in" style={{ borderColor: '#EF4444', maxWidth: '540px' }}>
            <div className="vt-modal-header" style={{ color: '#EF4444' }}>
              <span style={{ fontSize: '28px' }}>⚠️</span>
              <div className="vt-modal-title">Folders are of 2 Different Names!</div>
            </div>

            <div className="vt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, lineHeight: 1.5, fontSize: '13.5px' }}>
                The selected <strong>Video</strong> and <strong>Photo</strong> directories belong to 2 different date names and cannot be matched:
              </p>
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', padding: '14px 16px', borderRadius: '10px', fontSize: '13px', color: '#991B1B' }}>
                <div style={{ fontWeight: 700 }}>📹 Video Folder Date(s):</div>
                <div style={{ fontFamily: 'monospace', fontSize: '13.5px', marginTop: '2px', color: '#7F1D1D' }}>
                  {dateMismatchData.videoDates.join(', ') || 'Unknown'}
                </div>
                <div style={{ fontWeight: 700, marginTop: '10px' }}>📷 Photo Folder Date(s):</div>
                <div style={{ fontFamily: 'monospace', fontSize: '13.5px', marginTop: '2px', color: '#7F1D1D' }}>
                  {dateMismatchData.photoDates.join(', ') || 'Unknown'}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#6B7280' }}>
                Please select Video and Photo directories that have matching date folder names.
              </p>
            </div>

            <div className="vt-modal-actions">
              <Button
                variant="danger"
                onClick={() => setDateMismatchData(null)}
                style={{ fontWeight: 800, padding: '10px 22px' }}
              >
                ✕ Close & Re-select Folders
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
