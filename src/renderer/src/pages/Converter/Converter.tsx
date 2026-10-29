import React, { useState, useEffect, useRef } from 'react'
import { PAGE_META } from '../../types'
import { Card, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { BrowseRow } from '../../components/Input'
import ProgressBar from '../../components/ProgressBar'
import StatCard, { StatusChip } from '../../components/StatCard'
import { useSound } from '../../components/SoundProvider'
import { useToast } from '../../components/Toast'
import confetti from 'canvas-confetti'
import PageIcon from '../../components/PageIcon'
import './Converter.css'

const meta = PAGE_META['converter']
const api  = (window as any).api

const cleanPath = (p?: string | null): string => {
  if (!p) return ''
  return String(p).trim().replace(/^["']|["']$/g, '').trim()
}

export interface BatchPair {
  batchIndex: number
  batchName: string
  sourcePath: string
  jpegFolder: string
  videoFolder: string
}

export default function Converter(): JSX.Element {
  const { playTick, playSuccess, playBatchComplete, playError } = useSound()
  const { showToast } = useToast()

  const [inputFolder, setInputFolder]   = useState(() => localStorage.getItem('ot_converter_png_source') || '')
  const [outputFolder, setOutputFolder] = useState('')
  const [jpegFolder, setJpegFolder]     = useState(() => localStorage.getItem('ot_converter_source_jpeg') || '')
  const [videoFolder, setVideoFolder]   = useState(() => localStorage.getItem('ot_converter_video_target') || '')
  const [convertRunning, setConvertRunning] = useState(false)
  const [renameRunning,  setRenameRunning]  = useState(false)
  const [batchRunningAll, setBatchRunningAll] = useState(false)
  const [batchPairs, setBatchPairs] = useState<BatchPair[]>(() => {
    try {
      const raw = localStorage.getItem('ot_converter_batch_pairs')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number>(0)
  const [convertResult, setConvertResult] = useState<null | { done: number; failed: number; outputFolder: string }>(null)
  const [renameResult,  setRenameResult]  = useState<null | { 
    renamed: number; 
    total: number; 
    scannedVideos?: number; 
    scannedImages?: number; 
    error?: string 
  }>(null)
  const [progress, setProgress] = useState(0)
  const [showOutputFolder, setShowOutputFolder] = useState(false)
  const [convertCollapsed, setConvertCollapsed] = useState(true)
  const [renameCollapsed, setRenameCollapsed] = useState(false)
  const [folderImages, setFolderImages] = useState<string[]>([])
  const [folderVideos, setFolderVideos] = useState<string[]>([])
  const [filesLoading, setFilesLoading] = useState(false)

  // Persistent stats states
  const [statsConverted, setStatsConverted] = useState<number>(() => {
    const saved = localStorage.getItem('ot_converter_stats_converted')
    return saved ? parseInt(saved, 10) : 0
  })
  const [statsFailed, setStatsFailed] = useState<number>(() => {
    const saved = localStorage.getItem('ot_converter_stats_failed')
    return saved ? parseInt(saved, 10) : 0
  })
  const [statsRenamed, setStatsRenamed] = useState<number>(() => {
    const saved = localStorage.getItem('ot_converter_stats_renamed')
    return saved ? parseInt(saved, 10) : 0
  })

  const chainedHandledRef = useRef(false)

  useEffect(() => {
    // Check if chained or synchronized from Title Adder
    const checkChained = (evt?: any) => {
      const evtDetail = evt?.detail
      let latestBatchPairs: BatchPair[] | null = null

      if (evtDetail?.batchPairs && Array.isArray(evtDetail.batchPairs)) {
        latestBatchPairs = evtDetail.batchPairs
      } else {
        try {
          const rawPairs = localStorage.getItem('ot_converter_batch_pairs')
          if (rawPairs) {
            latestBatchPairs = JSON.parse(rawPairs)
          }
        } catch {}
      }

      const chainedVideo = evtDetail?.outputFolder ||
                            sessionStorage.getItem('ot_converter_video_folder') ||
                            localStorage.getItem('ot_converter_video_target')
      const existingUserJpeg = localStorage.getItem('ot_converter_source_jpeg') || ''
      const chainedJpeg = evtDetail?.jpegFolder || existingUserJpeg

      if (Array.isArray(latestBatchPairs) && latestBatchPairs.length > 0) {
        setBatchPairs(latestBatchPairs)
        const targetIdx = selectedBatchIndex < latestBatchPairs.length ? selectedBatchIndex : 0
        const activePair = latestBatchPairs[targetIdx]
        if (activePair) {
          const jTarget = cleanPath(existingUserJpeg || activePair.jpegFolder || chainedJpeg)
          const vTarget = cleanPath((targetIdx === 0 && chainedVideo) ? chainedVideo : activePair.videoFolder)
          if (jTarget && !jpegFolder) {
            setJpegFolder(jTarget)
            localStorage.setItem('ot_converter_source_jpeg', jTarget)
          }
          if (vTarget) {
            setVideoFolder(vTarget)
            localStorage.setItem('ot_converter_video_target', vTarget)
            if (api?.settings?.setAndSave) {
              api.settings.setAndSave('converter_video_target', vTarget).catch(() => {})
            }
          }
          setRenameCollapsed(false)
          loadFiles(jTarget || undefined, vTarget)
        }
      } else if (chainedVideo || chainedJpeg) {
        if (chainedJpeg && !jpegFolder) {
          const jClean = cleanPath(chainedJpeg)
          setJpegFolder(jClean)
          localStorage.setItem('ot_converter_source_jpeg', jClean)
        }
        if (chainedVideo) {
          const vClean = cleanPath(chainedVideo)
          setVideoFolder(vClean)
          localStorage.setItem('ot_converter_video_target', vClean)
          if (api?.settings?.setAndSave) {
            api.settings.setAndSave('converter_video_target', vClean).catch(() => {})
          }
          loadFiles(undefined, vClean)
        }
        setRenameCollapsed(false)
      }
    }

    checkChained()
    window.addEventListener('refresh-converter-paths', checkChained)

    if (!api || !api.converter) return
    api.settings.getAll().then((all: any) => {
      if (all.converter_input) {
        setInputFolder(all.converter_input)
        localStorage.setItem('ot_converter_png_source', all.converter_input)
      }
      if (all.converter_output) {
        setOutputFolder(all.converter_output)
        setShowOutputFolder(true)
      }
      // Keep JPEG source folder intact — NEVER overwrite with video target or converter output
      let activeJpeg = localStorage.getItem('ot_converter_source_jpeg') || jpegFolder
      if (all.converter_source_jpeg) {
        const safeJpeg = String(all.converter_source_jpeg).trim()
        setJpegFolder(safeJpeg)
        activeJpeg = safeJpeg
        localStorage.setItem('ot_converter_source_jpeg', safeJpeg)
      } else if (!activeJpeg && all.converter_jpeg) {
        const safeJpeg = String(all.converter_jpeg).trim()
        setJpegFolder(safeJpeg)
        activeJpeg = safeJpeg
      }

      if (!chainedHandledRef.current) {
        const savedTarget = localStorage.getItem('ot_converter_video_target') || all.converter_video_target
        if (savedTarget) {
          const safeVideo = cleanPath(savedTarget)
          setVideoFolder(safeVideo)
          localStorage.setItem('ot_converter_video_target', safeVideo)
        }
      }

      if (all.converter_stats_converted !== undefined) setStatsConverted(Number(all.converter_stats_converted))
      if (all.converter_stats_failed !== undefined) setStatsFailed(Number(all.converter_stats_failed))
      if (all.converter_stats_renamed !== undefined) setStatsRenamed(Number(all.converter_stats_renamed))
    })
    api.converter.onProgress((d: any) => setProgress(d.percent ?? 0))
    return () => {
      api.converter.removeListeners()
      window.removeEventListener('refresh-converter-paths', checkChained)
    }
  }, [])

  useEffect(() => {
    if (convertRunning) {
      setConvertCollapsed(false)
    }
  }, [convertRunning])

  useEffect(() => {
    if (renameRunning) {
      setRenameCollapsed(false)
    }
  }, [renameRunning])

  // Auto-refresh file list whenever either folder path changes (incl. on mount after settings restore)
  useEffect(() => {
    if (!api?.converter?.listFiles) return
    if (!jpegFolder && !videoFolder) { setFolderImages([]); setFolderVideos([]); return }
    let cancelled = false
    setFilesLoading(true)
    api.converter.listFiles({ jpegFolder: jpegFolder || undefined, videoFolder: videoFolder || undefined })
      .then((res: any) => {
        if (cancelled) return
        setFolderImages(res.images ?? [])
        setFolderVideos(res.videos ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFilesLoading(false) })
    return () => { cancelled = true }
  }, [jpegFolder, videoFolder])

  async function loadFiles(jpeg?: string, video?: string): Promise<void> {
    const jf = jpeg  ?? jpegFolder
    const vf = video ?? videoFolder
    if (!jf && !vf) { setFolderImages([]); setFolderVideos([]); return }
    setFilesLoading(true)
    try {
      const res = await api.converter.listFiles({ jpegFolder: jf || undefined, videoFolder: vf || undefined })
      setFolderImages(res.images ?? [])
      setFolderVideos(res.videos ?? [])
    } catch { /* silent */ } finally {
      setFilesLoading(false)
    }
  }

  const selectBatch = (idx: number) => {
    if (!batchPairs[idx]) return
    setSelectedBatchIndex(idx)
    const pair = batchPairs[idx]
    if (pair.jpegFolder) {
      const jClean = cleanPath(pair.jpegFolder)
      setJpegFolder(jClean)
      localStorage.setItem('ot_converter_source_jpeg', jClean)
      if (api?.settings?.setAndSave) {
        api.settings.setAndSave('converter_source_jpeg', jClean).catch(() => {})
      }
    }
    if (pair.videoFolder) {
      const vClean = cleanPath(pair.videoFolder)
      setVideoFolder(vClean)
      localStorage.setItem('ot_converter_video_target', vClean)
      if (api?.settings?.setAndSave) {
        api.settings.setAndSave('converter_video_target', vClean).catch(() => {})
      }
    }
    setRenameCollapsed(false)
    loadFiles(pair.jpegFolder, pair.videoFolder)
    playTick()
  }

  async function runBatchRenameAll(): Promise<void> {
    if (!batchPairs || batchPairs.length === 0) return
    setBatchRunningAll(true)
    setRenameRunning(true)
    setRenameResult(null)
    setUndoResult(null)
    let totalRenamed = 0
    let totalFiles = 0
    const errors: string[] = []

    try {
      for (let i = 0; i < batchPairs.length; i++) {
        const pair = batchPairs[i]
        const jFolder = cleanPath(pair.jpegFolder)
        const vFolder = cleanPath(pair.videoFolder)
        if (!jFolder || !vFolder) continue

        setSelectedBatchIndex(i)
        setJpegFolder(jFolder)
        setVideoFolder(vFolder)
        showToast({
          title: `Processing Batch #${i + 1}/${batchPairs.length}`,
          message: `${pair.batchName}: Renaming & moving JPGs...`,
          type: 'info'
        })

        try {
          const res = await api.converter.rename({ jpegFolder: jFolder, videoFolder: vFolder })
          if (res?.error) {
            errors.push(`Batch #${i + 1} (${pair.batchName}): ${res.error}`)
          } else {
            totalRenamed += (res?.renamed || 0)
            totalFiles += (res?.total || 0)
          }
        } catch (err: any) {
          errors.push(`Batch #${i + 1} (${pair.batchName}): ${err?.message || 'Failed'}`)
        }
      }

      const newRenamed = statsRenamed + totalRenamed
      setStatsRenamed(newRenamed)
      localStorage.setItem('ot_converter_stats_renamed', String(newRenamed))
      if (api) api.settings.setAndSave('converter_stats_renamed', newRenamed).catch(() => {})

      loadFiles()

      if (totalRenamed > 0) {
        playBatchComplete()
        confetti({
          particleCount: 200,
          spread: 90,
          origin: { y: 0.6 },
          colors: [meta.accent, '#ffffff', '#ffd700']
        })
        if (api?.system?.notify) {
          api.system.notify({
            title: 'All Batches Renamed & Moved! 🎉',
            body: `Renamed & moved ${totalRenamed} photos across ${batchPairs.length} batches.`
          })
        }
        showToast({
          title: 'All Batches Complete! 🎉',
          message: `Successfully organized ${totalRenamed} photos across ${batchPairs.length} batches!`,
          type: 'success'
        })
      } else if (errors.length > 0) {
        playError()
        showToast({
          title: 'Batch Issues Encountered',
          message: errors.join('; '),
          type: 'error'
        })
      } else {
        playSuccess()
        showToast({
          title: 'All Batches Checked',
          message: 'All videos in all batches already have matching thumbnails.',
          type: 'info'
        })
      }
      setRenameResult({
        renamed: totalRenamed,
        total: totalFiles,
        error: errors.length > 0 ? errors.join(' | ') : undefined
      })
    } catch (e: any) {
      console.error('Batch rename all failed:', e)
      playError()
      showToast({
        title: 'Batch Rename Failed',
        message: e?.message || 'Error occurred during multi-batch rename',
        type: 'error'
      })
    } finally {
      setBatchRunningAll(false)
      setRenameRunning(false)
    }
  }

  async function runConvert(): Promise<void> {
    setConvertRunning(true)
    setConvertResult(null)
    setProgress(0)
    try {
      const cleanIn = cleanPath(inputFolder)
      const cleanOut = cleanPath(outputFolder)
      const res = await api.converter.convert({ inputFolder: cleanIn, outputFolder: cleanOut || '' })
      setConvertResult(res)
      
      const newConverted = statsConverted + res.done
      setStatsConverted(newConverted)
      localStorage.setItem('ot_converter_stats_converted', String(newConverted))
      if (api) api.settings.setAndSave('converter_stats_converted', newConverted).catch(() => {})

      const newFailed = statsFailed + res.failed
      setStatsFailed(newFailed)
      localStorage.setItem('ot_converter_stats_failed', String(newFailed))
      if (api) api.settings.setAndSave('converter_stats_failed', newFailed).catch(() => {})
      
      // Auto-populate JPEG source in Card 2 with the converted folder
      if (res?.outputFolder) {
        setJpegFolder(res.outputFolder)
        localStorage.setItem('ot_converter_source_jpeg', res.outputFolder)
        if (api) {
          api.settings.setAndSave('converter_source_jpeg', res.outputFolder).catch(() => {})
          api.settings.setAndSave('converter_jpeg', res.outputFolder).catch(() => {})
        }
        loadFiles(res.outputFolder, undefined)
      }

      playSuccess()
    } catch (e) {
      console.error('Conversion failed:', e)
      playError()
    } finally {
      setConvertRunning(false)
      setProgress(100)
    }
  }

  const [undoRunning, setUndoRunning] = useState(false)
  const [undoResult, setUndoResult] = useState<null | { undone: number; total: number }>(null)
  const [canUndo, setCanUndo] = useState(false)

  // Check canUndo on mount and after operations
  useEffect(() => {
    if (api?.converter?.canUndo) {
      api.converter.canUndo().then(setCanUndo).catch(() => {})
    }
  }, [renameResult, undoResult])

  async function runRename(overrideJpeg?: string, overrideVideo?: string): Promise<void> {
    const jFolder = cleanPath(String(overrideJpeg || jpegFolder || '').trim())
    const vFolder = cleanPath(String(overrideVideo || videoFolder || '').trim())

    if (!jFolder || !vFolder) {
      showToast({
        title: 'Missing Folder',
        message: 'Please ensure both JPEG Source and Rendered Video Target folders are selected.',
        type: 'warning'
      })
      return
    }
    setRenameRunning(true)
    setRenameResult(null)
    setUndoResult(null)
    try {
      const res = await api.converter.rename({ jpegFolder: jFolder, videoFolder: vFolder })
      setRenameResult(res)
      setCanUndo(true)

      const newRenamed = statsRenamed + (res?.renamed || 0)
      setStatsRenamed(newRenamed)
      localStorage.setItem('ot_converter_stats_renamed', String(newRenamed))
      if (api) api.settings.setAndSave('converter_stats_renamed', newRenamed).catch(() => {})

      // Refresh file preview list
      loadFiles(jFolder, vFolder)

      if (res && res.renamed > 0) {
        playBatchComplete()
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: [meta.accent, '#ffffff', '#ffd700']
        })
        if (api?.system?.notify) {
          api.system.notify({
            title: 'Rename & Move Complete! 🎉',
            body: `Batch finished! Renamed & moved ${res.renamed} JPG photos into matching video folders.`
          })
        }
        showToast({
          title: 'Rename & Move Complete! 🎉',
          message: `Successfully organized ${res.renamed} photo(s) into video folders!`,
          type: 'success'
        })
      } else if (res?.error) {
        playError()
        showToast({
          title: 'Rename & Move Notice',
          message: res.error,
          type: 'error'
        })
      } else {
        playSuccess()
        const scannedCount = res?.scannedVideos ?? folderVideos.length
        if (api?.system?.notify) {
          api.system.notify({
            title: 'Rename & Move Done',
            body: `Scan completed: All ${scannedCount} videos already have matching thumbnails.`
          })
        }
        showToast({
          title: 'Scan Complete',
          message: `All files are already organized (${scannedCount} videos scanned).`,
          type: 'info'
        })
      }
    } catch (e: any) {
      console.error('Renaming failed:', e)
      playError()
      showToast({
        title: 'Rename & Move Failed',
        message: e?.message || 'Error occurred during Rename & Move',
        type: 'error'
      })
    } finally {
      setRenameRunning(false)
    }
  }

  async function runUndo(): Promise<void> {
    setUndoRunning(true)
    setUndoResult(null)
    try {
      const res = await api.converter.undoRename()
      setUndoResult(res)
      if (res && res.success) {
        playSuccess()
        setRenameResult(null)
        setCanUndo(false)
        // Refresh file list
        if (api?.converter?.listFiles) {
          api.converter.listFiles({ jpegFolder, videoFolder }).then((f: any) => {
            if (f) {
              setFolderImages(f.images || [])
              setFolderVideos(f.videos || [])
            }
          }).catch(() => {})
        }
      } else {
        playError()
      }
    } catch (e) {
      console.error('Undo failed:', e)
      playError()
    } finally {
      setUndoRunning(false)
    }
  }

  const hasFiles = folderImages.length > 0 || folderVideos.length > 0
  const countsMatch = folderImages.length > 0 && folderImages.length === folderVideos.length
  const countsMismatch = hasFiles && folderImages.length !== folderVideos.length
  const countBadgeClass = `cv-files-count ${countsMatch ? 'cv-files-count--match' : countsMismatch ? 'cv-files-count--mismatch' : ''}`
  const countTitle = countsMatch
    ? `✔ Match: ${folderImages.length} image(s) and ${folderVideos.length} video(s)`
    : countsMismatch
    ? `⚠ Mismatch: ${folderImages.length} image(s) vs ${folderVideos.length} video(s)`
    : 'No files detected'

  return (
    <div className="cv-page">
      {/* Stats */}
      <div className="cv-stats">
        <StatCard label="Converted" value={String(statsConverted)} icon="🖼️" accent={meta.accent} accentSoft={meta.accentSoft} />
        <StatCard label="Failed"    value={String(statsFailed)} icon="✖" accent="var(--danger)" accentSoft="var(--danger-soft)" />
        <StatCard label="Renamed"   value={String(statsRenamed)} icon="🏷" accent="var(--success)" accentSoft="var(--success-soft)" />
      </div>

      <div className="cv-body">
        {/* PNG → JPG Converter */}
        <Card className="anim-scale-in">
          <div className="cv-collapsible-header" onClick={() => setConvertCollapsed(!convertCollapsed)}>
            <CardHeader 
              title="PNG → JPG Converter" 
              accent={meta.accent} 
              accentSoft={meta.accentSoft} 
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <StatusChip label={convertRunning ? 'Converting…' : 'Idle'} variant={convertRunning ? 'warning' : 'muted'} />
                  <span style={{ 
                    transition: 'transform 0.2s', 
                    transform: convertCollapsed ? 'rotate(-90deg)' : 'none', 
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: meta.accent,
                    userSelect: 'none'
                  }}>▼</span>
                </div>
              }
            />
          </div>
          {!convertCollapsed && (
            <div className="cv-card-body">
            <p className="cv-desc">Batch-converts all PNG screenshots to JPEG (deletes originals after conversion).</p>
            <BrowseRow label="PNG Source folder" value={inputFolder} placeholder="Folder containing PNG files…"
              accent={meta.accent}
              onBrowse={async () => { const p = await api.dialog.openFolder(); if (p) { setInputFolder(p); api.settings.setAndSave('converter_input', p) } }}
              onChange={setInputFolder}
            />
            {!showOutputFolder ? (
              <button
                type="button"
                className="cv-toggle-btn"
                onClick={() => setShowOutputFolder(true)}
              >
                Set Custom Output Folder (Optional)
              </button>
            ) : (
              <div className="cv-optional-row">
                <BrowseRow label="JPEG Output folder (optional — defaults to Source/Converted_JPEGs)"
                  value={outputFolder} placeholder="Leave blank for auto subfolder…"
                  accent={meta.accent}
                  onBrowse={async () => { 
                    const p = await api.dialog.openFolder(); 
                    if (p) { 
                      setOutputFolder(p); 
                      api.settings.setAndSave('converter_output', p);
                    } 
                  }}
                  onChange={(val) => {
                    setOutputFolder(val);
                    api.settings.setAndSave('converter_output', val);
                  }}
                />
                <button
                  type="button"
                  className="cv-remove-btn"
                  onClick={() => {
                    setShowOutputFolder(false);
                    setOutputFolder('');
                    api.settings.setAndSave('converter_output', '');
                  }}
                >
                  ✕ Clear & Hide Output Folder
                </button>
              </div>
            )}
            {(convertRunning || progress > 0) && (
              <ProgressBar value={progress} accent={meta.accent} label="Converting…" />
            )}
            <Button variant="primary" accent={meta.accent} accentHv={meta.accentHv}
              loading={convertRunning}
              disabled={!inputFolder}
              onClick={runConvert}
            >
              Convert PNG → JPG
            </Button>
            {convertResult && (
              <div className="cv-result cv-result--success">
                ✔ Done! {convertResult.done} converted · Output: {convertResult.outputFolder}
              </div>
            )}
            </div>
          )}
        </Card>

        {/* Rename by Video */}
        <Card className="anim-scale-in">
          <div className="cv-collapsible-header" onClick={() => setRenameCollapsed(!renameCollapsed)}>
            <CardHeader 
              title="Rename JPEGs by Video Name" 
              accent={meta.accent} 
              accentSoft={meta.accentSoft} 
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <StatusChip label={renameRunning ? (batchRunningAll ? 'Renaming All…' : 'Renaming…') : 'Idle'} variant={renameRunning ? 'warning' : 'muted'} />
                  <span style={{ 
                    transition: 'transform 0.2s', 
                    transform: renameCollapsed ? 'rotate(-90deg)' : 'none', 
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: meta.accent,
                    userSelect: 'none'
                  }}>▼</span>
                </div>
              }
            />
          </div>
          {!renameCollapsed && (
            <div className="cv-card-body">
            <p className="cv-desc">
              Copies JPEG thumbnails into your video folder, renaming them to match video filenames in sorted order.
            </p>

            {/* Multi-Batch Queue Selector Strip (if Title Adder has 2+ batches) */}
            {batchPairs.length > 1 && (
              <div className="cv-batch-selector-strip">
                <div className="cv-batch-selector-label">
                  <span className="cv-batch-label-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <PageIcon pageKey="adder" size={14} color="#f59e0b" />
                    Batches Synced from Title Adder ({batchPairs.length}):
                  </span>
                  <span className="cv-batch-selector-hint">Select a batch to inspect its source & target paths, or run all</span>
                </div>
                <div className="cv-batch-pills">
                  {batchPairs.map((b, idx) => {
                    const isActive = selectedBatchIndex === idx
                    return (
                      <button
                        key={b.sourcePath || idx}
                        type="button"
                        className={`cv-batch-pill ${isActive ? 'active' : ''}`}
                        onClick={() => selectBatch(idx)}
                        title={`Folder: ${b.sourcePath}\nTarget: ${b.videoFolder}`}
                      >
                        <span className="cv-batch-pill-order">#{idx + 1}</span>
                        <span className="cv-batch-pill-name">{b.batchName || `Batch ${idx + 1}`}</span>
                        {isActive && <span className="cv-batch-pill-check">✔ Active</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <BrowseRow label="JPEG folder (source thumbnails)" value={jpegFolder} placeholder="Folder with numbered JPEGs…"
              accent={meta.accent}
              onBrowse={async () => { 
                const p = await api.dialog.openFolder(); 
                if (p) { 
                  const clean = cleanPath(p)
                  setJpegFolder(clean) 
                  localStorage.setItem('ot_converter_source_jpeg', clean)
                  sessionStorage.setItem('ot_converter_source_jpeg', clean)
                  api.settings.setAndSave('converter_source_jpeg', clean)
                  api.settings.setAndSave('converter_jpeg', clean)
                  setBatchPairs(prev => {
                    if (!prev || prev.length === 0) return prev
                    const next = [...prev]
                    const idx = selectedBatchIndex < next.length ? selectedBatchIndex : 0
                    if (next[idx]) next[idx] = { ...next[idx], jpegFolder: clean }
                    try { localStorage.setItem('ot_converter_batch_pairs', JSON.stringify(next)) } catch {}
                    return next
                  })
                  loadFiles(clean, undefined)
                } 
              }}
              onChange={(val) => {
                const clean = cleanPath(val)
                setJpegFolder(clean) 
                localStorage.setItem('ot_converter_source_jpeg', clean)
                sessionStorage.setItem('ot_converter_source_jpeg', clean)
                api.settings.setAndSave('converter_source_jpeg', clean)
                api.settings.setAndSave('converter_jpeg', clean)
                setBatchPairs(prev => {
                  if (!prev || prev.length === 0) return prev
                  const next = [...prev]
                  const idx = selectedBatchIndex < next.length ? selectedBatchIndex : 0
                  if (next[idx]) next[idx] = { ...next[idx], jpegFolder: clean }
                  try { localStorage.setItem('ot_converter_batch_pairs', JSON.stringify(next)) } catch {}
                  return next
                })
              }}
            />
            <BrowseRow label="Video folder / Output path (rename target)" value={videoFolder} placeholder="Exact folder containing rendered videos (target destination for renamed JPEGs)…"
              accent={meta.accent}
              onBrowse={async () => { 
                const p = await api.dialog.openFolder()
                if (p) { 
                  const clean = cleanPath(p)
                  setVideoFolder(clean)
                  localStorage.setItem('ot_converter_video_target', clean)
                  sessionStorage.setItem('ot_converter_video_folder', clean)
                  if (api?.settings?.setAndSave) {
                    api.settings.setAndSave('converter_video_target', clean)
                  }
                  setBatchPairs(prev => {
                    if (!prev || prev.length === 0) return prev
                    const next = [...prev]
                    const idx = selectedBatchIndex < next.length ? selectedBatchIndex : 0
                    if (next[idx]) next[idx] = { ...next[idx], videoFolder: clean }
                    try { localStorage.setItem('ot_converter_batch_pairs', JSON.stringify(next)) } catch {}
                    return next
                  })
                  loadFiles(undefined, clean)
                }
              }}
              onChange={(val) => {
                const clean = cleanPath(val)
                setVideoFolder(clean)
                localStorage.setItem('ot_converter_video_target', clean)
                sessionStorage.setItem('ot_converter_video_folder', clean)
                if (api?.settings?.setAndSave) {
                  api.settings.setAndSave('converter_video_target', clean)
                }
                setBatchPairs(prev => {
                  if (!prev || prev.length === 0) return prev
                  const next = [...prev]
                  const idx = selectedBatchIndex < next.length ? selectedBatchIndex : 0
                  if (next[idx]) next[idx] = { ...next[idx], videoFolder: clean }
                  try { localStorage.setItem('ot_converter_batch_pairs', JSON.stringify(next)) } catch {}
                  return next
                })
              }}
            />

            {/* File Preview Box */}
            {(jpegFolder || videoFolder) && (
              <div className="cv-files-box">
                <div className="cv-files-box-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="cv-files-box-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <PageIcon pageKey="folder" size={14} color="currentColor" />
                      Files in Folders
                    </span>
                    {countsMatch && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--success, #10b981)', background: 'var(--success-soft, rgba(16,185,129,0.12))', border: '1px solid var(--success, #10b981)', borderRadius: '10px', padding: '1px 7px' }}>
                        ✔ Counts Match ({folderImages.length})
                      </span>
                    )}
                    {countsMismatch && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--danger, #ef4444)', background: 'var(--danger-soft, rgba(239,68,68,0.12))', border: '1px solid var(--danger, #ef4444)', borderRadius: '10px', padding: '1px 7px' }}>
                        ⚠ Count Mismatch ({folderImages.length} vs {folderVideos.length})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="cv-files-refresh"
                    onClick={() => loadFiles()}
                    disabled={filesLoading}
                    title="Refresh file list"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: filesLoading ? 'spin 1s linear infinite' : 'none' }}>
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Refresh
                  </button>
                </div>
                <div className="cv-files-panels">
                  {/* Images panel */}
                  <div className="cv-files-panel">
                    <div className="cv-files-panel-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <PageIcon pageKey="converter" size={14} color={meta.accent} />
                      Images in Source&nbsp;
                      <span className={countBadgeClass} title={countTitle}>{folderImages.length}</span>
                    </div>
                    <div className="cv-files-list">
                      {filesLoading ? (
                        <span className="cv-files-empty">Loading…</span>
                      ) : folderImages.length === 0 ? (
                        <span className="cv-files-empty">
                          {jpegFolder ? 'No images found' : 'No source folder selected'}
                        </span>
                      ) : (
                        folderImages.map(f => (
                          <div key={f} className="cv-files-item cv-files-item--image">
                            <span className="cv-files-icon"><PageIcon pageKey="converter" size={14} color={meta.accent} /></span>
                            <span className="cv-files-name" title={f}>{f}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="cv-files-divider" />

                  {/* Videos panel */}
                  <div className="cv-files-panel">
                    <div className="cv-files-panel-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <PageIcon pageKey="adder" size={14} color="#8B5CF6" />
                      Videos in Destination&nbsp;
                      <span className={countBadgeClass} title={countTitle}>{folderVideos.length}</span>
                    </div>
                    <div className="cv-files-list">
                      {filesLoading ? (
                        <span className="cv-files-empty">Loading…</span>
                      ) : folderVideos.length === 0 ? (
                        <span className="cv-files-empty">
                          {videoFolder ? 'No videos found' : 'No destination folder selected'}
                        </span>
                      ) : (
                        folderVideos.map(f => (
                          <div key={f} className="cv-files-item cv-files-item--video">
                            <span className="cv-files-icon"><PageIcon pageKey="adder" size={14} color="#8B5CF6" /></span>
                            <span className="cv-files-name" title={f}>{f}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
              <Button variant="primary" accent={meta.accent} accentHv={meta.accentHv}
                loading={renameRunning && !batchRunningAll}
                disabled={renameRunning || !jpegFolder || !videoFolder}
                onClick={() => runRename()}
              >
                {batchPairs.length > 1 ? 'Rename & Move (Active Batch)' : 'Rename & Move JPEGs by Video'}
              </Button>

              {batchPairs.length > 1 && (
                <Button
                  variant="primary"
                  loading={batchRunningAll}
                  disabled={renameRunning}
                  onClick={runBatchRenameAll}
                  title="Sequentially rename and move JPGs for all batches in order"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  Rename & Move ALL ({batchPairs.length} Batches)
                </Button>
              )}

              {(canUndo || renameResult) && (
                <Button
                  variant="secondary"
                  loading={undoRunning}
                  onClick={runUndo}
                  title="Restore renamed JPEGs back to original names and location"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5'
                  }}
                >
                  ↩ Undo Last Rename & Move
                </Button>
              )}
            </div>

            {renameResult && (
              <div 
                className={`cv-result ${renameResult.error ? 'cv-result--error' : renameResult.renamed > 0 ? 'cv-result--success' : 'cv-result--info'}`} 
                style={{ marginTop: '10px' }}
              >
                {renameResult.error
                  ? `✖ ${renameResult.error}`
                  : renameResult.renamed > 0
                  ? `✔ Renamed & moved ${renameResult.renamed} / ${renameResult.total} file(s).`
                  : `ℹ All ${renameResult.scannedVideos ?? folderVideos.length} video(s) already have matching thumbnails.`}
              </div>
            )}

            {undoResult && (
              <div
                className={`cv-result ${undoResult.undone > 0 ? 'cv-result--success' : 'cv-result--error'}`}
                style={{ marginTop: '10px' }}
              >
                {undoResult.undone > 0
                  ? `↩ Undone! Restored ${undoResult.undone} / ${undoResult.total} file(s) to original JPEG folder.`
                  : '✖ Nothing to undo or files could not be restored.'}
              </div>
            )}
          </div>
          )}
        </Card>
      </div>
    </div>
  )
}
