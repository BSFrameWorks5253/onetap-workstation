import React, { useState, useEffect, useRef } from 'react'
import { PAGE_META } from '../../types'
import { Card, CardHeader } from '../../components/Card'
import { Button, DangerButton, GhostButton } from '../../components/Button'
import { BrowseRow, Input } from '../../components/Input'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import {
  hijriFromGregorian,
  daysInHijriMonth,
  HIJRI_MONTH_NAMES_SHORT,
} from '../../utils/dateUtils'
import confetti from 'canvas-confetti'
import './CameraTransfer.css'


interface QueuedFile {
  srcPath: string
  fileName: string
  size: number
}

interface CameraSlot {
  id: string
  name: string
  files: QueuedFile[]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function fmtHijriMonth(month: number) { return String(month + 1).padStart(2, '0') }
function fmtHijriDay(day: number)     { return String(day).padStart(2, '0') }

function range(from: number, to: number) {
  const arr: number[] = []
  for (let i = from; i <= to; i++) arr.push(i)
  return arr
}

const CURRENT_H = hijriFromGregorian(new Date())





// ─────────────────────────────────────────────────────────────────────────────
export default function CameraTransfer(): JSX.Element {
  const meta = PAGE_META['cameratransfer']
  const { showToast } = useToast()
  const { playSuccess, playError, playTick } = useSound()
  const api = (window as any).api

  // Keyboard buffering and search listener for month dropdown selects
  const typedBufferRef = useRef('')
  const bufferTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMonthSelectKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>, setter: (m: number) => void) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      typedBufferRef.current = (typedBufferRef.current + e.key).slice(-2)
      const num = parseInt(typedBufferRef.current)
      if (num >= 1 && num <= 12) {
        setter(num - 1)
      } else {
        const singleNum = parseInt(e.key)
        if (singleNum >= 1 && singleNum <= 12) {
          setter(singleNum - 1)
          typedBufferRef.current = e.key
        }
      }
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current)
      bufferTimeoutRef.current = setTimeout(() => {
        typedBufferRef.current = ''
      }, 1000)
    }
  }

  // ── Folder Config ─────────────────────────────────────────────
  const [parentFolder, setParentFolder] = useState('')

  // ── Session subfolder — Hijri calendar ────────────────────────
  const [sesYear, _setSesYear]     = useState(CURRENT_H.year)
  const [sesMonth, setSesMonth]   = useState(CURRENT_H.month)
  const [sesDay, setSesDay]       = useState(CURRENT_H.day)
  const [timeOfDay, setTimeOfDay] = useState('01M')
  const [eventName, setEventName] = useState('')
  const [presets, setPresets]     = useState<string[]>([])

  // ── Optional Premiere Pro project creation ──────────────────
  const [createPrproj, setCreatePrproj] = useState(true)

  // ── Optional Hijri wrapper folder ─────────────────────────────
  const [useHijriFolder, setUseHijriFolder] = useState(false)
  const [wrapYear, setWrapYear]   = useState(CURRENT_H.year)
  const [wrapMonth, setWrapMonth] = useState(CURRENT_H.month)
  const [wrapFolderName, setWrapFolderName] = useState('')

  // ── Camera Slots ──────────────────────────────────────────────
  const [cameras, setCameras] = useState<CameraSlot[]>([
    { id: `cam_${Date.now()}`, name: 'Camera 1', files: [] }
  ])

  // ── Job State ─────────────────────────────────────────────────
  const [running, setRunning]       = useState(false)
  const [progress, setProgress]     = useState(0)
  const [speed, setSpeed]           = useState('')
  const [eta, setEta]               = useState('')
  const [totalFiles, setTotalFiles] = useState(0)
  const [filesDone, setFilesDone]   = useState(0)
  const [totalSize, setTotalSize]   = useState(0)
  const [bytesDone, setBytesDone]   = useState(0)

  const jobIdRef = useRef(`ct_${Date.now()}`)

  // ── Load saved data ───────────────────────────────────────────
  useEffect(() => {
    if (!api?.cameraTransfer) return
    api.cameraTransfer.getPresets().then((list: any[]) => setPresets(list.map((p: any) => p.name)))
    api.cameraTransfer.getCameras().then((names: string[]) => {
      if (names?.length > 0) {
        setCameras(names.map((n, i) => ({ id: `cam_${Date.now()}_${i}`, name: n, files: [] })))
      }
    })
    api.settings.getAll().then((all: any) => {
      if (all.last_camtransfer_parent) setParentFolder(all.last_camtransfer_parent)
    })
  }, [])

  // ── IPC listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!api?.cameraTransfer) return
    const unsubs: Array<() => void> = []
    unsubs.push(api.cameraTransfer.onProgress((d: any) => {
      setProgress(d.percent ?? 0); setSpeed(d.speed ?? '')
      setEta(d.eta ?? ''); setBytesDone(d.bytesDone ?? 0); setTotalSize(d.totalSize ?? 0)
    }))
    unsubs.push(api.cameraTransfer.onLog((d: any) => console.log('[CT]', d.message)))
    unsubs.push(api.cameraTransfer.onFound((d: any) => { setTotalFiles(d.total); setTotalSize(d.totalSize) }))
    unsubs.push(api.cameraTransfer.onFileDone((d: any) => setFilesDone(d.done)))
    unsubs.push(api.cameraTransfer.onDone((d: any) => {
      setRunning(false); setProgress(100)
      if (d.success) {
        playSuccess()
        confetti({ particleCount: 120, spread: 60, origin: { y: 0.6 }, colors: [meta.accent, '#ffffff', '#34d399'] })
        showToast({
          title: 'Transfer & Rename Complete!',
          message: `Successfully copied, renamed & organized ${d.done} camera files into date session folders.`,
          type: 'success',
          badge: '📷 CAMERA MOVE',
          icon: '📂',
          action: { label: '📂 Open Folder', onClick: () => api.shell.openFolder(d.outputDir) }
        })
        if (createPrproj && d.outputDir && api?.prproj) {
          api.prproj.generate({ parentFolder: d.outputDir, includeSubSubfolders: true }).then((res: any) => {
            if (res && res.success && res.createdCount > 0) {
              showToast({
                title: 'Premiere Projects Created',
                message: `Generated ${res.createdCount} .prproj project file(s) in subfolders.`,
                type: 'success',
                badge: '🎬 PRPROJ CREATOR',
                icon: '⚡',
                action: { label: '📂 Open Folder', onClick: () => api.shell.openFolder(d.outputDir) }
              })
            }
          })
        }
      } else {
        playError()
        showToast({ title: 'Transfer Finished', message: `Copied ${d.done}/${d.total} files. Some skipped.`, type: 'warning' })
      }
    }))
    return () => unsubs.forEach(un => typeof un === 'function' && un())
  }, [])

  // ── Computed ──────────────────────────────────────────────────
  const sesDDMM        = `${fmtHijriDay(sesDay)}-${fmtHijriMonth(sesMonth)}`
  const subfolderName  = [sesDDMM, timeOfDay, eventName].filter(Boolean).join(' ')

  const wrapHijriYYYYMM  = `${wrapYear}-${fmtHijriMonth(wrapMonth)}`
  const hijriWrapperName = useHijriFolder
    ? wrapFolderName.trim() ? `${wrapHijriYYYYMM} ${wrapFolderName.trim()}` : wrapHijriYYYYMM
    : null

  const fullDestPath = (() => {
    if (!parentFolder) return ''
    if (hijriWrapperName && subfolderName) return `${parentFolder}\\${hijriWrapperName}\\${subfolderName}`
    if (hijriWrapperName) return `${parentFolder}\\${hijriWrapperName}`
    if (subfolderName) return `${parentFolder}\\${subfolderName}`
    return ''
  })()

  const totalQueuedFiles = cameras.reduce((sum, c) => sum + c.files.length, 0)
  const totalQueuedSize  = cameras.reduce((sum, c) => sum + c.files.reduce((s, f) => s + f.size, 0), 0)

  // ── Camera Management ─────────────────────────────────────────
  const addCamera = () => { setCameras(prev => [...prev, { id: `cam_${Date.now()}`, name: `Camera ${prev.length + 1}`, files: [] }]); playTick() }
  const removeCamera = (id: string) => { setCameras(prev => prev.filter(c => c.id !== id)); playTick() }
  const updateCameraName = (id: string, name: string) => setCameras(prev => prev.map(c => c.id === id ? { ...c, name } : c))
  const addFilesToCamera = (id: string, newFiles: QueuedFile[]) => {
    setCameras(prev => prev.map(c => {
      if (c.id !== id) return c
      const existing = new Set(c.files.map(f => f.srcPath))
      return { ...c, files: [...c.files, ...newFiles.filter(f => !existing.has(f.srcPath))] }
    }))
  }
  const removeFileFromCamera = (cid: string, srcPath: string) =>
    setCameras(prev => prev.map(c => c.id !== cid ? c : { ...c, files: c.files.filter(f => f.srcPath !== srcPath) }))
  const clearCameraFiles = (id: string) =>
    setCameras(prev => prev.map(c => c.id === id ? { ...c, files: [] } : c))

  // ── Browse / Drop ─────────────────────────────────────────────
  const browseVideosForCamera = async (cameraId: string) => {
    if (!api) return
    const files = await api.dialog.openFiles({
      title: 'Select Videos',
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'mts', 'm2ts', 'wmv', 'webm', 'm4v'] }]
    })
    if (files?.length) {
      addFilesToCamera(cameraId, files.map((f: string) => ({ srcPath: f, fileName: f.split(/[\\\/]/).pop() || '', size: 0 })))
      playTick()
    }
  }

  const handleCameraDrop = (e: React.DragEvent, cameraId: string) => {
    e.preventDefault(); e.stopPropagation()
    const files = e.dataTransfer.files
    if (!files?.length) return
    const videoExts = new Set(['mp4', 'mov', 'avi', 'mkv', 'mts', 'm2ts', 'wmv', 'webm', 'm4v'])
    const valid: QueuedFile[] = Array.from(files)
      .filter(f => videoExts.has(f.name.split('.').pop()?.toLowerCase() ?? ''))
      .map(f => ({ srcPath: (f as any).path, fileName: f.name, size: f.size }))
    if (valid.length > 0) { addFilesToCamera(cameraId, valid); playTick() }
  }

  // ── Presets ────────────────────────────────────────────────────
  const savePreset = async () => {
    if (!eventName.trim() || !api) return
    const updated = await api.cameraTransfer.savePreset({ name: eventName.trim() })
    setPresets(updated.map((p: any) => p.name)); playSuccess()
    showToast({ title: 'Preset Saved', message: `"${eventName.trim()}" saved.`, type: 'success' })
  }
  const deletePreset = async (name: string) => {
    if (!api) return
    const updated = await api.cameraTransfer.deletePreset(name)
    setPresets(updated.map((p: any) => p.name)); playTick()
  }
  const applyPreset = (name: string) => { setEventName(name); playTick() }

  // ── Start Copy ────────────────────────────────────────────────
  const canStart = !!(parentFolder && (hijriWrapperName || subfolderName) && totalQueuedFiles > 0)

  const startCopy = async () => {
    if (!api || !canStart) return
    setRunning(true); setProgress(0); setFilesDone(0); setTotalFiles(0)
    setBytesDone(0); setTotalSize(0); setSpeed(''); setEta('')
    jobIdRef.current = `ct_${Date.now()}`
    api.settings.setAndSave('last_camtransfer_parent', parentFolder)
    api.cameraTransfer.saveCameras(cameras.map(c => c.name))
    await api.cameraTransfer.copy({
      parentFolder,
      subfolderName: subfolderName || '',
      gregorianWrapper: hijriWrapperName || null,
      cameras: cameras
        .filter(c => c.files.length > 0)
        .map(c => ({ cameraName: c.name, files: c.files.map(f => ({ srcPath: f.srcPath, fileName: f.fileName, size: f.size })) })),
      jobId: jobIdRef.current
    })
  }

  const handleCancel = () => api?.cameraTransfer?.cancel(jobIdRef.current)

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="ct-page">
      <div className="ct-layout">

        {/* ── Destination Setup ─────────────────────────────── */}
        <Card className="ct-config-card anim-scale-in">
          <CardHeader title="📁 Destination Setup" accent={meta.accent} accentSoft={meta.accentSoft} />
          <div className="ct-config-body">

            <BrowseRow
              label="Parent Folder"
              value={parentFolder}
              placeholder="Select root folder for all transfers…"
              accent={meta.accent}
              onBrowse={async () => {
                if (!api) return
                const p = await api.dialog.openFolder({ title: 'Select Parent Folder' })
                if (p) setParentFolder(p)
              }}
              onChange={setParentFolder}
            />

            {/* ── Optional: Hijri monthly wrapper ─────────────── */}
            <div className="ct-section-divider">
              <span className="ct-section-label">Optional: Group into a Hijri monthly folder</span>
            </div>

            <div className={`ct-folder-wrapper-block ${useHijriFolder ? 'ct-folder-wrapper-active' : ''}`}>
              <div className="ct-folder-wrapper-header">
                <label className="ct-toggle-label">
                  <div
                    className={`ct-toggle ${useHijriFolder ? 'ct-toggle-on' : ''}`}
                    onClick={() => { setUseHijriFolder(v => !v); playTick() }}
                    role="switch" aria-checked={useHijriFolder}
                  >
                    <div className="ct-toggle-thumb" />
                  </div>
                  <span className="ct-toggle-text">
                    Create Hijri monthly folder
                    <span className="ct-toggle-sub">e.g. 1447-01 Moharram Events</span>
                  </span>
                </label>
              </div>

              {/* ── Optional: Create Premiere Pro (.prproj) project files ────────── */}
              <div style={{ marginTop: '12px', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                <label className="ct-toggle-label">
                  <div
                    className={`ct-toggle ${createPrproj ? 'ct-toggle-on' : ''}`}
                    onClick={() => { setCreatePrproj(v => !v); playTick() }}
                    role="switch" aria-checked={createPrproj}
                  >
                    <div className="ct-toggle-thumb" />
                  </div>
                  <span className="ct-toggle-text">
                    🎬 Create Premiere Pro (.prproj) project file
                    <span className="ct-toggle-sub">Automatically generates .prproj project files named after subfolders</span>
                  </span>
                </label>
              </div>

              {useHijriFolder && (
                <div className="ct-folder-wrapper-fields anim-fade-in">
                  <div className="ct-gf-row">
                    <div className="ct-gf-col">
                      <label className="ct-label">Year (H)</label>
                      <Input
                        type="number"
                        value={wrapYear}
                        onChange={e => {
                          const val = parseInt(e.target.value)
                          if (!isNaN(val)) setWrapYear(val)
                          else setWrapYear(0)
                        }}
                        placeholder="e.g. 1447"
                        accent={meta.accent}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="ct-gf-col">
                      <label className="ct-label">Month</label>
                      <select
                        value={wrapMonth}
                        onChange={e => { setWrapMonth(Number(e.target.value)); playTick() }}
                        onKeyDown={e => handleMonthSelectKeyDown(e, setWrapMonth)}
                        className="ct-select-dropdown"
                        style={{ width: '100%' }}
                      >
                        {HIJRI_MONTH_NAMES_SHORT.map((name, idx) => (
                          <option key={idx} value={idx}>{fmtHijriMonth(idx)} — {name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="ct-gf-col" style={{ marginTop: '10px' }}>
                    <label className="ct-label">Folder Label <span className="ct-optional-badge">optional</span></label>
                    <Input
                      value={wrapFolderName}
                      onChange={e => setWrapFolderName(e.target.value)}
                      placeholder="e.g. Moharram Majalis"
                      accent={meta.accent}
                      style={{ width: '100%' }}
                    />
                    <span className="ct-field-hint">Leave empty to use Hijri date only</span>
                  </div>

                  <div className="ct-gf-preview">
                    <span className="ct-gf-preview-icon">🗂</span>
                    <span className="ct-gf-preview-text">
                      Folder name: <strong>{hijriWrapperName}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Session subfolder — Hijri calendar ──────────── */}
            <div className="ct-section-divider">
              <span className="ct-section-label">Session date (Hijri calendar)</span>
            </div>

            <div className="ct-gf-row" style={{ marginTop: '4px', marginBottom: '10px' }}>
              <div className="ct-gf-col" style={{ flex: 1 }}>
                <label className="ct-label">Day</label>
                <select
                  value={sesDay}
                  onChange={e => { setSesDay(Number(e.target.value)); playTick() }}
                  className="ct-select-dropdown"
                  style={{ width: '100%' }}
                >
                  {range(1, daysInHijriMonth(sesYear, sesMonth)).map(d => (
                    <option key={d} value={d}>{fmtHijriDay(d)}</option>
                  ))}
                </select>
              </div>
              <div className="ct-gf-col" style={{ flex: 2 }}>
                <label className="ct-label">Month</label>
                <select
                  value={sesMonth}
                  onChange={e => { setSesMonth(Number(e.target.value)); playTick() }}
                  onKeyDown={e => handleMonthSelectKeyDown(e, setSesMonth)}
                  className="ct-select-dropdown"
                  style={{ width: '100%' }}
                >
                  {HIJRI_MONTH_NAMES_SHORT.map((name, idx) => (
                    <option key={idx} value={idx}>{fmtHijriMonth(idx)} — {name}</option>
                  ))}
                </select>
              </div>
              <div className="ct-gf-col" style={{ flex: 2 }}>
                <label className="ct-label">Time of Day</label>
                <select
                  value={timeOfDay}
                  onChange={e => { setTimeOfDay(e.target.value); playTick() }}
                  className="ct-select-dropdown"
                  style={{ width: '100%' }}
                >
                  <option value="01M">🌅 01M - Morning</option>
                  <option value="02E">🌇 02E - Evening</option>
                </select>
              </div>
            </div>

            {/* Event name */}
            <div style={{ marginTop: '10px' }}>
              <label className="ct-label">Event / Folder Name</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input
                  value={eventName}
                  onChange={e => setEventName(e.target.value)}
                  placeholder="e.g. Bethak QMZ"
                  accent={meta.accent}
                  style={{ flex: 1 }}
                />
                <GhostButton size="sm" onClick={savePreset} style={{ flexShrink: 0 }}>💾 Save</GhostButton>
              </div>
            </div>

            {presets.length > 0 && (
              <div className="ct-presets-row">
                {presets.map(p => (
                  <span key={p} className="ct-preset-chip" onClick={() => applyPreset(p)}>
                    {p}
                    <span className="ct-preset-delete" onClick={e => { e.stopPropagation(); deletePreset(p) }}>✕</span>
                  </span>
                ))}
              </div>
            )}

            {/* Full path preview */}
            {fullDestPath && (
              <div className="ct-config-preview">
                <span className="ct-preview-icon">📂</span>
                <span className="ct-preview-path-wrap">
                  {useHijriFolder && hijriWrapperName ? (
                    <>
                      {parentFolder}\<span className="ct-preview-wrapper">{hijriWrapperName}</span>\<span className="ct-preview-path">{subfolderName}</span>\
                    </>
                  ) : (
                    <>
                      {parentFolder}\<span className="ct-preview-path">{subfolderName}</span>\
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* ── Camera Persons ────────────────────────────────── */}
        <Card className="anim-scale-in" style={{ animationDelay: '50ms' }}>
          <CardHeader
            title="📷 Camera Persons"
            accent={meta.accent}
            accentSoft={meta.accentSoft}
            right={<span className="ct-queue-badge">{totalQueuedFiles} files · {formatSize(totalQueuedSize)}</span>}
          />
          <div style={{ padding: '12px' }}>
            <div className="ct-cameras-list">
              {cameras.map((cam) => (
                <div key={cam.id} className="ct-camera-card">
                  <div className="ct-camera-header">
                    <div className="ct-camera-header-left">
                      <span className="ct-camera-icon">📷</span>
                      <input
                        className="ct-camera-name-input"
                        value={cam.name}
                        onChange={e => updateCameraName(cam.id, e.target.value)}
                        onBlur={() => api?.cameraTransfer?.saveCameras(cameras.map(c => c.name))}
                        placeholder="Camera name…"
                      />
                    </div>
                    <div className="ct-camera-header-right">
                      <span className="ct-camera-file-count">{cam.files.length} files</span>
                      {cameras.length > 1 && (
                        <button className="ct-camera-remove" onClick={() => removeCamera(cam.id)} title="Remove camera">✕</button>
                      )}
                    </div>
                  </div>

                  <div className="ct-dropzone">
                    {cam.files.length === 0 ? (
                      <div
                        className="ct-dropzone-empty"
                        onClick={() => browseVideosForCamera(cam.id)}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ct-dropzone-active') }}
                        onDragLeave={e => e.currentTarget.classList.remove('ct-dropzone-active')}
                        onDrop={e => { e.currentTarget.classList.remove('ct-dropzone-active'); handleCameraDrop(e, cam.id) }}
                      >
                        <span className="ct-drop-icon">📥</span>
                        <span>Drop videos here or click to browse</span>
                        <span className="ct-drop-sub">MP4, MOV, MKV, MTS and more</span>
                      </div>
                    ) : (
                      <>
                        <div className="ct-file-list scroll-container" onDragOver={e => e.preventDefault()} onDrop={e => handleCameraDrop(e, cam.id)}>
                          {cam.files.map(f => (
                            <div key={f.srcPath} className="ct-file-row">
                              <span className="ct-file-icon">▶</span>
                              <span className="ct-file-name" title={f.srcPath}>{f.fileName}</span>
                              <span className="ct-file-size">{formatSize(f.size)}</span>
                              <button className="ct-file-remove" onClick={() => removeFileFromCamera(cam.id, f.srcPath)}>✕</button>
                            </div>
                          ))}
                        </div>
                        <div className="ct-dropzone-actions">
                          <GhostButton size="sm" onClick={() => browseVideosForCamera(cam.id)}>➕ Add More</GhostButton>
                          <GhostButton size="sm" onClick={() => clearCameraFiles(cam.id)}>🗑 Clear</GhostButton>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="ct-add-camera-btn" onClick={addCamera} style={{ marginTop: '10px', width: '100%' }}>
              ➕ Add Camera Person
            </button>

            {running && (
              <div className="ct-progress-panel">
                <div className="ct-progress-info">
                  <span className="ct-progress-label"><span className="ct-progress-dot" />Copying {filesDone} / {totalFiles} files</span>
                  <span className="ct-progress-speed">{speed} · ETA {eta}</span>
                </div>
                <div className="ct-progress-track">
                  <div className="ct-progress-fill" style={{ width: `${progress}%` }} />
                  <div className="ct-progress-glow" style={{ left: `${Math.max(0, progress - 8)}%`, opacity: progress > 0 && progress < 100 ? 1 : 0 }} />
                </div>
                <div className="ct-progress-bottom">
                  <span>{formatSize(bytesDone)} / {formatSize(totalSize)}</span>
                  <span className="ct-progress-pct">{progress.toFixed(1)}%</span>
                </div>
              </div>
            )}

            <div className="ct-action-bar">
              {running ? (
                <DangerButton onClick={handleCancel} style={{ flex: 1, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ⛔ Cancel Transfer
                </DangerButton>
              ) : (
                <Button
                  accent={meta.accent} accentHv={meta.accentHv} onClick={startCopy} disabled={!canStart}
                  style={{ flex: 1, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 700 }}
                >
                  <span>🚀</span>
                  <span>Start Transfer</span>
                  {totalQueuedFiles > 0 && <span className="ct-btn-badge">{totalQueuedFiles} files · {formatSize(totalQueuedSize)}</span>}
                </Button>
              )}
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}
