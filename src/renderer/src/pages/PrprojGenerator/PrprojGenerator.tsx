import React, { useEffect, useState, useRef } from 'react'
import { Card, CardHeader } from '../../components/Card'
import { BrowseRow } from '../../components/Input'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import confetti from 'canvas-confetti'
import prLogo from '../../assets/pr_logo.png'
import './PrprojGenerator.css'
import { usePrprojStore, CameramanFolderInfo, SubfolderItem } from '../../stores/prprojStore'

export default function PrprojGenerator(): JSX.Element {
  const { playTick, playSuccess, playError } = useSound()
  const { showToast } = useToast()

  const [store, setStore] = usePrprojStore()

  const {
    parentFolder,
    mode,
    detectedMode,
    activeMode,
    subfolders,
    cameramanFolders,
    totalVideos,
    targetPrprojName,
    hasTargetPrproj,
    excelFolder,
    enableExcelReport,
    showExcelModal,
    generatedExcelPath,
    overwriteExisting,
    excludedPaths,
    loadingScan,
    templateInfo,
    generating,
    currentStep,
    isCompleted,
    createdFiles,
    progress,
    logs,
    search,
    activeProgressStatus
  } = store

  const [isDragging, setIsDragging] = useState(false)
  const [resetCountdown, setResetCountdown] = useState<number | null>(null)
  const logBoxRef = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fullResetRef = useRef<() => void>(() => {})

  const setParentFolder = (val: string) => setStore({ parentFolder: val })
  const setMode = (val: 'auto' | 'single' | 'master') => setStore({ mode: val })
  const setDetectedMode = (val: 'single' | 'master') => setStore({ detectedMode: val })
  const setActiveMode = (val: 'single' | 'master') => setStore({ activeMode: val })
  const setSubfolders = (val: SubfolderItem[]) => setStore({ subfolders: val })
  const setCameramanFolders = (val: CameramanFolderInfo[]) => setStore({ cameramanFolders: val })
  const setTotalVideos = (val: number) => setStore({ totalVideos: val })
  const setTargetPrprojName = (val: string) => setStore({ targetPrprojName: val })
  const setHasTargetPrproj = (val: boolean) => setStore({ hasTargetPrproj: val })
  const setExcelFolder = (val: string) => setStore({ excelFolder: val })
  const setEnableExcelReport = (val: boolean) => setStore({ enableExcelReport: val })
  const setShowExcelModal = (val: boolean) => setStore({ showExcelModal: val })
  const setOverwriteExisting = (val: boolean) => setStore({ overwriteExisting: val })
  const setExcludedPaths = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      setStore(prev => ({ excludedPaths: val(prev.excludedPaths) }))
    } else {
      setStore({ excludedPaths: val })
    }
  }
  const setLoadingScan = (val: boolean) => setStore({ loadingScan: val })
  const setTemplateInfo = (val: any) => setStore({ templateInfo: val })
  const setSearch = (val: string) => setStore({ search: val })

  const api = (window as any).api

  // ── Auto-scroll terminal log console ──────────
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight
    }
  }, [logs])

  // ── Load template status ──────────
  useEffect(() => {
    if (api?.prproj && !templateInfo) {
      api.prproj.getTemplateStatus().then((info: any) => setTemplateInfo(info))
    }
  }, [])

  // ── Pick up pre-loaded folder from TaskTracker navigation ──────────
  useEffect(() => {
    const preloadFolder = localStorage.getItem('ot_prproj_preload_folder')
    if (preloadFolder) {
      localStorage.removeItem('ot_prproj_preload_folder')
      handleFolderSelect(preloadFolder)
    }
    // Also listen for subsequent navigation events (e.g. user navigates back)
    const onPreload = (e: Event) => {
      const path = (e as CustomEvent).detail
      if (path) handleFolderSelect(path)
    }
    window.addEventListener('prproj-preload-folder', onPreload)
    return () => window.removeEventListener('prproj-preload-folder', onPreload)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen to IPC Progress Updates ──────────
  useEffect(() => {
    if (!api?.prproj?.onProgress) return
    const unsubscribe = api.prproj.onProgress((data: any) => {
      if (!data) return
      setStore(prev => {
        const newLogs = [...prev.logs]
        if (data.status) {
          newLogs.push(` [PROG ${data.percent || 0}%] ${data.status}`)
        }
        let calcStep = prev.currentStep
        const pct = data.percent || 0
        if (pct < 25) calcStep = 1
        else if (pct < 55) calcStep = 2
        else if (pct < 85) calcStep = 3
        else calcStep = 4

        return {
          progress: pct || prev.progress,
          activeProgressStatus: data.status || prev.activeProgressStatus,
          currentStep: calcStep,
          logs: newLogs
        }
      })
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
      else if (api.prproj?.removeListeners) api.prproj.removeListeners()
    }
  }, [api])

  // ── Scan subfolders / folder mode ───────────────────────────
  const scanFolder = async (folderPath: string, targetMode: 'auto' | 'master' | 'single' = mode) => {
    if (!folderPath || !api?.prproj) return
    setLoadingScan(true)
    try {
      const res = await api.prproj.scanSubfolders({
        parentFolder: folderPath,
        ignoreOutputFolders: true,
        mode: targetMode
      })

      if (res && typeof res === 'object' && res.success !== false) {
        setStore({
          detectedMode: res.detectedMode || 'single',
          activeMode: res.activeMode || 'single',
          subfolders: res.subfolders || [],
          cameramanFolders: res.cameramanFolders || [],
          totalVideos: res.totalVideos || 0,
          targetPrprojName: res.targetPrprojName || '',
          hasTargetPrproj: !!res.hasTargetPrproj,
          excludedPaths: []
        })
      } else {
        setStore({
          subfolders: Array.isArray(res) ? res : [],
          excludedPaths: []
        })
      }
    } catch (err) {
      console.error('[PrprojGenerator] Scan error:', err)
      setStore({
        subfolders: [],
        cameramanFolders: [],
        excludedPaths: []
      })
    } finally {
      setLoadingScan(false)
    }
  }

  const handleModeChange = async (newMode: 'single' | 'master') => {
    playTick()
    setMode(newMode)
    if (parentFolder) {
      await scanFolder(parentFolder, newMode)
    }
  }

  const toggleExclude = (path: string) => {
    playTick()
    setExcludedPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }

  const handleSelectAll = () => {
    playTick()
    setExcludedPaths([])
  }

  const handleDeselectAll = () => {
    playTick()
    setExcludedPaths(subfolders.map(s => s.path))
  }

  const handleFolderSelect = async (path: string) => {
    setParentFolder(path)
    if (path) {
      playTick()
      await scanFolder(path, mode)
    } else {
      setStore({
        subfolders: [],
        cameramanFolders: [],
        excludedPaths: []
      })
    }
  }

  const handleBrowse = async () => {
    if (!api?.dialog) return
    const p = await api.dialog.openFolder({ title: 'Select Directory (Date Folder or Master Folder)' })
    if (p) {
      await handleFolderSelect(p)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const p = (files[0] as any).path
      if (p) await handleFolderSelect(p)
    }
  }

  // ── Run Project Generation ───────────────────────────────────
  const runGeneration = async () => {
    setShowExcelModal(false)
    if (!parentFolder || !api?.prproj || generating) return

    let activeFolders: string[] = []
    if (activeMode === 'single') {
      activeFolders = [parentFolder]
    } else {
      activeFolders = subfolders.filter(s => !excludedPaths.includes(s.path)).map(s => s.path)
    }

    if (activeFolders.length === 0) {
      showToast({ title: 'No Folders Selected', message: 'Please include at least one folder for project creation.', type: 'warning' })
      return
    }

    const finalExcelFolder = enableExcelReport ? parentFolder : undefined

    setStore({
      generating: true,
      isCompleted: false,
      createdFiles: [],
      generatedExcelPath: null,
      currentStep: 1,
      progress: 5,
      activeProgressStatus: 'Initializing sequence engine...',
      logs: [
        `[START] Target directory: ${parentFolder}`,
        `[MODE] ${activeMode === 'single' ? `Single Date Folder Mode (Target: ${targetPrprojName})` : `Master Folder Mode (${activeFolders.length} Date Subfolders)`}`,
        `[OVERWRITE] ${overwriteExisting ? 'Enabled (Will overwrite existing .prproj & .xml files)' : 'Disabled (Will skip date folders with existing .prproj files)'}`,
        ...(finalExcelFolder ? [`[EXCEL] Automatic Report Location: ${finalExcelFolder} (Unedit Time & Edit Time columns included)`] : [])
      ]
    })
    playTick()

    try {
      const result = await api.prproj.generate({
        parentFolder,
        targetFolders: activeFolders,
        mode: activeMode,
        includeSubSubfolders: true,
        ignoreOutputFolders: true,
        overwrite: overwriteExisting,
        excelFolderPath: finalExcelFolder,
        excludedPaths: activeMode === 'single' ? excludedPaths : []
      })

      setStore(prev => ({
        currentStep: 4,
        progress: 90,
        logs: [...prev.logs, `[STEP 4] Writing gzip Premiere Pro project (.prproj), XML sequence (.xml) & Excel report (.xlsx)...`]
      }))
      await new Promise(r => setTimeout(r, 200))

      if (result && result.success) {
        const newLogs: string[] = []
        if (result.templateUsed) {
          newLogs.push(`[ENGINE] Template Used: ${result.templateUsed}`)
        }
        if (result.created && result.created.length > 0) {
          result.created.forEach((f: string) => newLogs.push(` ✔ [SEQUENCE TIMELINE READY] ${f.split(/[\\\/]/).pop()}`))
        }
        if (result.excelReportPath) {
          newLogs.push(` ✔ [EXCEL REPORT CREATED] ${result.excelReportPath} (Includes Unedit Time & Edit Time tracking columns)`)
        }
        if (result.skipped && result.skipped.length > 0) {
          result.skipped.forEach((f: string) => newLogs.push(` ℹ [SKIPPED - EXISTS] ${f.split(/[\\\/]/).pop()}`))
        }
        newLogs.push(`\n✔ Creation Complete! Generated ${result.createdCount} project file(s) with V1/A1 sequence timelines, skipped ${result.skippedCount}.`)

        setStore(prev => ({
          progress: 100,
          isCompleted: true,
          createdFiles: result.created || [],
          generatedExcelPath: result.excelReportPath || null,
          logs: [...prev.logs, ...newLogs]
        }))

        playSuccess()
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })

        showToast({
          title: 'Premiere Projects & Sequences Created!',
          message: `Successfully generated ${result.createdCount} .prproj file(s) with V1/A1 video sequence timelines.${result.excelReportPath ? ' Excel sequence report (Unedit & Edit Time) generated in target folder.' : ''}`,
          type: 'success',
          badge: '🎬 PRPROJ CREATOR',
          icon: '⚡',
          action: { label: '📂 Open Folder', onClick: () => api.shell.openFolder(parentFolder) }
        })

        // Re-scan folder to update UI badges
        await scanFolder(parentFolder, activeMode)

        // Start auto-reset countdown
        setResetCountdown(8)
        if (countdownRef.current) clearInterval(countdownRef.current)
        countdownRef.current = setInterval(() => {
          setResetCountdown(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownRef.current!)
              countdownRef.current = null
              fullResetRef.current()
              return null
            }
            return prev - 1
          })
        }, 1000)
      } else {
        throw new Error(result?.error || 'Generation failed.')
      }
    } catch (err: any) {
      console.error(err)
      setStore(prev => ({
        logs: [...prev.logs, `✖ [ERROR] ${err.message || String(err)}`]
      }))
      playError()
      showToast({ title: 'Generation Failed', message: err.message || 'Check logs for details.', type: 'danger' })
    } finally {
      setStore({ generating: false })
    }
  }

  // Full reset to clean initial landing state
  const handleFullReset = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setResetCountdown(null)
    setStore({
      parentFolder: '',
      isCompleted: false,
      generating: false,
      logs: [],
      createdFiles: [],
      generatedExcelPath: null,
      progress: 0,
      currentStep: 1,
      subfolders: [],
      cameramanFolders: [],
      excludedPaths: [],
      totalVideos: 0,
      targetPrprojName: '',
      hasTargetPrproj: false,
      activeProgressStatus: '',
      mode: 'auto',
      detectedMode: 'single',
      activeMode: 'single',
      search: ''
    })
  }
  fullResetRef.current = handleFullReset

  const handleGenerate = () => {
    runGeneration()
  }

  const renderFormattedLog = (log: string, index: number) => {
    let typeClass = 'log-type-info'
    if (log.includes('✔') || log.includes('[OK]')) typeClass = 'log-type-ok'
    else if (log.includes('ℹ')) typeClass = 'log-type-info'
    else if (log.includes('ENGINE') || log.includes('START') || log.includes('MODE') || log.includes('STEP')) typeClass = 'log-type-engine'
    else if (log.includes('✖') || log.includes('ERROR')) typeClass = 'log-type-error'

    return (
      <div key={index} className="prproj-log-line">
        <span style={{ opacity: 0.4, fontSize: '10px', fontFamily: 'monospace' }}>[{index + 1}]</span>
        <span className={typeClass}>{log}</span>
      </div>
    )
  }

  // Filtered subfolder list for Master Mode
  const filteredSubfolders = subfolders.filter(s =>
    search.trim() === '' || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const activeSubfoldersCount = subfolders.filter(s => !excludedPaths.includes(s.path)).length
  const excludedCount = excludedPaths.length
  const newCount = subfolders.filter(s => !s.hasPrproj && !excludedPaths.includes(s.path)).length
  const existsCount = subfolders.filter(s => s.hasPrproj && !excludedPaths.includes(s.path)).length

  return (
    <div className="prproj-page anim-fade-in">
      {/* ── Page Header ── */}
      <div className="prproj-header">
        <div className="prproj-icon">
          <img src={prLogo} alt="Premiere Pro" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        </div>
        <div>
          <h1 className="prproj-title">Premiere Pro Project Generator</h1>
          <div className="prproj-subtitle">
            Batch build Adobe Premiere Pro (.prproj) project files and sequence timelines directly from media subfolders. Place clips unnested on V1/A1 with camera marker color routing.
          </div>
        </div>
      </div>

      {/* ── Template & Engine Status Banner ── */}
      <Card style={{ padding: '14px 20px', borderLeft: '4px solid #9999FF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>🎞️</span>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                Sequence Generator Engine: Active (Single Date & Master Folder Modes)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Generates .xml & .prproj files with sequence timeline markers for cameraman folders (Q, BQ, M, BM, MZ, Z, BZ, AQ, N, ID, Waaz). Open .xml in Premiere Pro.
              </div>
            </div>
          </div>
          <span className="prproj-status-badge badge-new" style={{ textTransform: 'uppercase' }}>
            {templateInfo?.available ? 'Engine Ready' : 'Ready'}
          </span>
        </div>
      </Card>

      {/* ── Main Folder Selector Card ── */}
      <Card>
        <CardHeader title="1. Select Directory (Drop Date Folder or Master Folder)" accent="#9999FF" />
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <BrowseRow
            label="Target Directory"
            value={parentFolder}
            placeholder="Drop or select a Date folder (e.g. 2026-07-21) or Master folder (e.g. 1448-01-London)..."
            onBrowse={handleBrowse}
            onChange={handleFolderSelect}
            accent="#9999FF"
          />

          <div
            className={`prproj-dropzone ${isDragging ? 'drag-active' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowse}
          >
            <span className="prproj-dropzone-icon">📂</span>
            <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '15px' }}>
              Drag & Drop Date Folder or Master Directory Here
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Drop a single date folder (containing cameraman folders) or a master folder containing multiple date subfolders
            </div>
          </div>
        </div>
      </Card>

      {/* ── Excel Sequence Report Options Card ── */}
      {parentFolder && (
        <Card>
          <CardHeader title="2. Excel Sequence Summary Report (.xlsx)" accent="#10B981" />
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📊 Auto-Generate Date-Wise Excel Sequence Report</span>
                  <span className="prproj-status-badge badge-new" style={{ background: '#059669', color: '#FFF' }}>
                    Automatic Output Path
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                  Generates an Excel (.xlsx) report containing <strong>Unedit Duration</strong> (initial sequence duration) and <strong>Edit Duration</strong> (updated timeline duration after editing) alongside cameraman prefix clip counts. The report is saved automatically directly inside the target directory.
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--surface-2)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-soft)', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={enableExcelReport}
                  onChange={e => { playTick(); setEnableExcelReport(e.target.checked) }}
                  style={{ width: '18px', height: '18px', accentColor: '#10B981', cursor: 'pointer' }}
                />
                <span>Enable Excel Report</span>
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* ── Mode Selector & Folder Preview ── */}
      {parentFolder && (
        <Card>
          <div style={{ padding: '16px 20px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>
                Target Mode:
              </span>
              <div className="prproj-mode-selector">
                <button
                  className={`prproj-mode-tab ${activeMode === 'single' ? 'active' : ''}`}
                  onClick={() => handleModeChange('single')}
                >
                  🎯 Single Date Folder
                </button>
                <button
                  className={`prproj-mode-tab ${activeMode === 'master' ? 'active' : ''}`}
                  onClick={() => handleModeChange('master')}
                >
                  📁 Master Folder ({subfolders.length} Subfolders)
                </button>
              </div>
            </div>

            <span className="prproj-status-badge badge-new" style={{ fontSize: '12px' }}>
              {detectedMode === activeMode ? `✨ Auto-Detected Mode` : `⚙️ Manual Mode Override`}
            </span>
          </div>

          {/* ── Single Date Folder Preview Card ── */}
          {activeMode === 'single' && (() => {
            const isCamExcluded = (cam: CameramanFolderInfo) =>
              excludedPaths.includes(cam.path) || excludedPaths.includes(cam.name)
            const activeCamFolders = cameramanFolders.filter(c => !isCamExcluded(c))
            const activeSingleVideosCount = cameramanFolders.length > 0
              ? activeCamFolders.reduce((sum, c) => sum + (c.videoCount || 0), 0)
              : totalVideos
            const excludedCamCount = cameramanFolders.filter(c => isCamExcluded(c)).length

            return (
              <div style={{ padding: '20px' }}>
                <div className="prproj-single-preview">
                  <div className="prproj-single-header">
                    <div>
                      <div className="prproj-single-title">
                        📅 Date Folder: {parentFolder.split(/[\\\/]/).pop()}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                        Target Project: {targetPrprojName}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {hasTargetPrproj ? (
                        <span className="prproj-status-badge badge-exists">✓ Project File Exists</span>
                      ) : (
                        <span className="prproj-status-badge badge-new">+ Will Create Project</span>
                      )}
                      <span style={{ fontSize: '12px', fontWeight: '700', background: 'var(--surface-2)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-soft)' }}>
                        🎬 {activeSingleVideosCount} Active Clip(s) {excludedCamCount > 0 ? `(${totalVideos - activeSingleVideosCount} Excluded)` : ''}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                        Detected Cameraman Folders ({cameramanFolders.length} Folders{excludedCamCount > 0 ? `, ${excludedCamCount} Excluded` : ''}):
                      </div>
                      {cameramanFolders.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="prproj-btn-sm" onClick={handleSelectAll}>
                            ✓ Include All
                          </button>
                          <button className="prproj-btn-sm" onClick={() => setExcludedPaths(cameramanFolders.map(c => c.path))}>
                            ✖ Exclude All
                          </button>
                          {excludedCamCount > 0 && (
                            <button className="prproj-btn-sm" onClick={() => setExcludedPaths([])}>
                              🔄 Reset
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {cameramanFolders.length === 0 ? (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '12px', borderRadius: '8px' }}>
                        No cameraman subfolders detected. Videos in this date folder will be placed directly on V1/A1.
                      </div>
                    ) : (
                      <div className="cameraman-grid">
                        {cameramanFolders.map((cam, idx) => {
                          const isExcluded = isCamExcluded(cam)
                          const rgb = cam.markerColor || { red: 255, green: 255, blue: 255 }
                          const displayName = cam.markerName || cam.name
                          const description = cam.markerDescription
                          return (
                            <div key={idx} className={`cameraman-card ${isExcluded ? 'is-excluded' : ''}`}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span
                                  className="cameraman-marker-badge"
                                  style={{ backgroundColor: `rgb(${rgb.red}, ${rgb.green}, ${rgb.blue})` }}
                                  title={`Timeline Marker Color: ${rgb.name || ''} RGB(${rgb.red}, ${rgb.green}, ${rgb.blue})`}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: '700', fontSize: '13px', color: isExcluded ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                      🏷️ {displayName}
                                    </span>
                                    {isExcluded && (
                                      <span className="prproj-status-badge badge-excluded" style={{ fontSize: '9px', padding: '1px 5px' }}>
                                        Excluded
                                      </span>
                                    )}
                                  </div>
                                  {description ? (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                                      📝 {description}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', background: 'var(--surface-1)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {cam.videoCount} clip(s)
                                </span>
                                {isExcluded ? (
                                  <button
                                    className="prproj-restore-btn"
                                    title="Re-include this folder in sequence"
                                    onClick={() => toggleExclude(cam.path)}
                                  >
                                    ➕ Include
                                  </button>
                                ) : (
                                  <button
                                    className="prproj-remove-btn"
                                    title="Remove folder from sequence creation"
                                    onClick={() => toggleExclude(cam.path)}
                                  >
                                    🗑️ Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Master Folder Subfolders Table ── */}
          {activeMode === 'master' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="prproj-toolbar">
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {newCount} date folder(s) will receive new .prproj sequence files, {existsCount} already exist
                  {excludedCount > 0 ? `, ${excludedCount} excluded.` : '.'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="prproj-btn-sm" onClick={handleSelectAll}>
                    ✓ Select All
                  </button>
                  <button className="prproj-btn-sm" onClick={handleDeselectAll}>
                    ✖ Remove All
                  </button>
                  {excludedCount > 0 && (
                    <button className="prproj-btn-sm" onClick={() => scanFolder(parentFolder, 'master')}>
                      🔄 Reset List
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Search */}
              <input
                type="text"
                className="utils-search-input"
                placeholder="Search date subfolders by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />

              {loadingScan ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Scanning subfolders and counting video clips...
                </div>
              ) : filteredSubfolders.length === 0 ? (
                <div style={{ textTransform: 'none', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: '12px' }}>
                  No date subfolders found in this parent directory.
                </div>
              ) : (
                <div className="prproj-table-container">
                  <table className="prproj-subfolder-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                        <th>Date Subfolder</th>
                        <th>Clips Detected</th>
                        <th>Target .prproj File</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubfolders.map((item, idx) => {
                        const isExcluded = excludedPaths.includes(item.path)
                        return (
                          <tr key={idx} className={isExcluded ? 'is-excluded' : ''}>
                            <td style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                              {idx + 1}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '16px' }}>📁</span>
                                <span
                                  className="prproj-cell-truncate"
                                  title={item.name}
                                  style={{ fontWeight: '600', color: isExcluded ? 'var(--text-muted)' : 'var(--text-primary)' }}
                                >
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', fontWeight: '700', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                🎬 {item.videoCount || 0} clip(s)
                              </span>
                            </td>
                            <td className="prproj-cell-truncate" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }} title={`${item.name}.prproj`}>
                              {item.name}.prproj
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isExcluded ? (
                                <span className="prproj-status-badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Excluded</span>
                              ) : item.hasPrproj ? (
                                <span className="prproj-status-badge badge-exists">✓ Exists</span>
                              ) : (
                                <span className="prproj-status-badge badge-new">+ Will Create</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isExcluded ? (
                                <button
                                  className="prproj-restore-btn"
                                  title="Re-include this folder"
                                  onClick={() => toggleExclude(item.path)}
                                >
                                  ➕ Include
                                </button>
                              ) : (
                                <button
                                  className="prproj-remove-btn"
                                  title="Remove folder from project creation"
                                  onClick={() => toggleExclude(item.path)}
                                >
                                  🗑️ Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Action & Creation HUD Card ── */}
      <Card>
        <CardHeader title="3. Generate Premiere Projects & Sequences" accent="#9999FF" />
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!generating && !isCompleted && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'var(--surface-2)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-soft)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={e => { playTick(); setOverwriteExisting(e.target.checked) }}
                    style={{ width: '18px', height: '18px', accentColor: '#9999FF', cursor: 'pointer' }}
                  />
                  <span>Force Overwrite Existing .prproj & .xml Files</span>
                </label>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {overwriteExisting
                    ? '⚠️ Will overwrite existing project & sequence files.'
                    : '🛡️ Skipping date folders that already contain a .prproj file.'}
                </div>
              </div>

              <button
                className="prproj-action-btn"
                disabled={!parentFolder || (activeMode === 'master' && activeSubfoldersCount === 0)}
                onClick={handleGenerate}
              >
                {activeMode === 'single'
                  ? `🎬 Generate Premiere Project for Date Folder "${parentFolder.split(/[\\\/]/).pop()}"`
                  : `🎬 Generate Premiere Projects in ${activeSubfoldersCount} Date Subfolders`}
              </button>
            </>
          )}

          {/* ── Active Creation HUD ── */}
          {generating && (
            <div className="prproj-creation-hud">
              <div className="prproj-hud-header">
                <div className="prproj-hud-reel-wrapper">
                  <div className="prproj-hud-reel-bg" />
                  <span className="prproj-hud-reel-icon">🎬</span>
                </div>
                <div>
                  <div className="prproj-hud-title">Creating Premiere Pro Projects & Sequences...</div>
                  <div className="prproj-hud-status-text">
                    <span className="prproj-status-badge badge-new">ENGINE ACTIVE</span>
                    <span>{activeProgressStatus || 'Placing clips unnested on V1/A1 & writing colored markers...'}</span>
                  </div>
                </div>
              </div>

              {/* Steps Grid */}
              <div className="prproj-steps-grid">
                <div className={`prproj-step-card ${currentStep > 1 ? 'completed' : currentStep === 1 ? 'active' : ''}`}>
                  <div className="prproj-step-num">{currentStep > 1 ? '✓' : '1'}</div>
                  <div className="prproj-step-label">1. Media & Camera Scan</div>
                </div>
                <div className={`prproj-step-card ${currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : ''}`}>
                  <div className="prproj-step-num">{currentStep > 2 ? '✓' : '2'}</div>
                  <div className="prproj-step-label">2. Unnested V1/A1 Build</div>
                </div>
                <div className={`prproj-step-card ${currentStep > 3 ? 'completed' : currentStep === 3 ? 'active' : ''}`}>
                  <div className="prproj-step-num">{currentStep > 3 ? '✓' : '3'}</div>
                  <div className="prproj-step-label">3. Camera Color Markers</div>
                </div>
                <div className={`prproj-step-card ${currentStep > 4 || progress === 100 ? 'completed' : currentStep === 4 ? 'active' : ''}`}>
                  <div className="prproj-step-num">{progress === 100 ? '✓' : '4'}</div>
                  <div className="prproj-step-label">4. Output .prproj & Excel</div>
                </div>
              </div>

              {/* Neon Progress Bar */}
              <div className="prproj-progress-container">
                <div className="prproj-progress-header">
                  <span>Creation Engine Progress</span>
                  <span style={{ color: '#34D399' }}>{progress}%</span>
                </div>
                <div className="prproj-progress-track">
                  <div className="prproj-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* ── Completion Celebration Hero Card ── */}
          {isCompleted && (
            <div className="prproj-celebration-card">
              <div className="prproj-celebration-icon-ring">✔</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#FFFFFF' }}>
                  Premiere Pro Projects & Sequences Created!
                </h3>
                <div style={{ fontSize: '13px', color: '#A7F3D0', marginTop: '6px' }}>
                  {activeMode === 'single'
                    ? `Successfully generated 1 Premiere project for Date Folder "${parentFolder.split(/[\\\/]/).pop()}" with V1/A1 unnested clip placement.`
                    : `Successfully generated ${createdFiles.length} Premiere project(s) for date subfolders with V1/A1 unnested clip placement.`}
                </div>
              </div>

              {createdFiles.length > 0 && (
                <div className="prproj-created-files-chips">
                  {createdFiles.map((file, idx) => (
                    <div key={idx} className="prproj-created-chip">
                      <span>🎬</span>
                      <span>{file.split(/[\\\/]/).pop()}</span>
                    </div>
                  ))}
                </div>
              )}

              {generatedExcelPath && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', padding: '12px 18px', borderRadius: '12px', width: '100%', maxWidth: '600px' }}>
                  <span style={{ fontSize: '22px' }}>📊</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#6EE7B7' }}>
                      Excel Sequence Report Created:
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {generatedExcelPath.split(/[\\\/]/).pop()}
                    </div>
                  </div>
                  <button
                    className="prproj-btn-sm"
                    style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '8px 14px', fontSize: '12px', fontWeight: '700' }}
                    onClick={() => api?.shell?.openFolder(generatedExcelPath)}
                  >
                    📂 Open Excel Folder
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                <button
                  className="prproj-action-btn"
                  style={{ width: 'auto', padding: '14px 28px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                  onClick={() => api?.shell?.openFolder(parentFolder)}
                >
                  📂 Open Output Directory
                </button>
                <button
                  className="prproj-action-btn"
                  style={{ width: 'auto', padding: '14px 28px', background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', fontSize: '13px' }}
                  onClick={handleFullReset}
                >
                  🔄 Create Another Project Set
                  {resetCountdown !== null && (
                    <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.25)', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: '800' }}>
                      Auto-reset in {resetCountdown}s
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Cyber Log Console ── */}
          {logs.length > 0 && (
            <div className="prproj-cyber-console">
              <div className="prproj-console-bar">
                <div className="prproj-console-dots">
                  <div className="prproj-console-dot" style={{ background: '#FF5F56' }} />
                  <div className="prproj-console-dot" style={{ background: '#FFBD2E' }} />
                  <div className="prproj-console-dot" style={{ background: '#27C93F' }} />
                </div>
                <div className="prproj-console-title">⚡ SEQUENCE ENGINE TERMINAL CONSOLE</div>
                <button
                  className="prproj-btn-sm"
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(logs.join('\n'))
                    showToast({ title: 'Logs Copied', message: 'Engine console logs copied to clipboard.', type: 'info' })
                  }}
                >
                  📋 Copy Logs
                </button>
              </div>
              <div ref={logBoxRef} className="prproj-log-box" style={{ maxHeight: '220px' }}>
                {logs.map((log, i) => renderFormattedLog(log, i))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
