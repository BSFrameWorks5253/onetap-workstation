import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react'
import './FileViewer.css'

// ── Types ────────────────────────────────────────────────────────
interface FileInfo {
  size: number
  modified: number
  ext: string
  isRaw: boolean
  dimensions?: { width: number; height: number } | null
}

type ViewerMode = 'image' | 'video' | 'pdf' | 'docx' | 'xlsx' | 'markdown' | 'unknown'

interface Props {
  filePath: string | null
  onClose: () => void
}

// ── Helpers ──────────────────────────────────────────────────────
const IMAGE_EXTS = new Set([
  '.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff','.tif','.heic','.avif','.ico','.svg'
])
const RAW_EXTS = new Set([
  '.cr2','.cr3','.nef','.nrw','.arw','.srf','.sr2','.dng','.orf','.rw2',
  '.pef','.ptx','.raf','.raw','.3fr','.mef','.mos','.erf','.rwl','.srw',
  '.x3f','.dcr','.kdc','.mrw'
])
const VIDEO_EXTS = new Set([
  '.mp4','.mkv','.avi','.mov','.webm','.wmv','.flv','.m4v','.ts','.m2ts','.mpg','.mpeg'
])

function detectMode(ext: string): ViewerMode {
  const e = ext.toLowerCase()
  if (IMAGE_EXTS.has(e)) return 'image'
  if (RAW_EXTS.has(e))   return 'image' // raw → converted to image
  if (VIDEO_EXTS.has(e)) return 'video'
  if (e === '.pdf')       return 'pdf'
  if (e === '.docx' || e === '.doc') return 'docx'
  if (e === '.xlsx' || e === '.xls') return 'xlsx'
  if (e === '.md' || e === '.markdown') return 'markdown'
  return 'unknown'
}

function fileIcon(mode: ViewerMode, ext: string): string {
  if (mode === 'video')    return '🎬'
  if (mode === 'pdf')      return '📄'
  if (mode === 'docx')     return '📝'
  if (mode === 'xlsx')     return '📊'
  if (mode === 'markdown') return '📋'
  if (RAW_EXTS.has(ext.toLowerCase())) return '📷'
  return '🖼️'
}

function formatSize(bytes: number): string {
  if (bytes < 1024)          return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3)     return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

/**
 * Convert an absolute Windows or POSIX path to a safe local-resource:// URL.
 * Uses encodeURI which preserves : and / but encodes spaces, Unicode, etc.
 */
function toLocalResourceUrl(absolutePath: string): string {
  // Normalise backslashes → forward slashes
  const forward = absolutePath.replace(/\\/g, '/')
  // encodeURI preserves : / A-Z a-z 0-9 - _ . ~ and URI-reserved chars
  // but encodes spaces, Unicode, and other special filename characters
  const encoded = encodeURI(forward)
  // Always use 3 slashes so the path begins with / on the protocol side
  // e.g. local-resource:///C:/path/to/file.jpg
  return `local-resource:///${encoded.replace(/^\//, '')}`
}

const api = (): any => (window as any).api

// ── Sub-components ───────────────────────────────────────────────

/** Image Viewer with zoom + pan + rotate */
function ImagePane({ src, info }: { src: string; info: FileInfo | null }) {
  const stageRef  = useRef<HTMLDivElement>(null)
  const [zoom, setZoom]     = useState(1)
  const [rotate, setRotate] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imgLoaded, setImgLoaded] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // Fit image to viewport on load
  function resetView(): void {
    setZoom(1); setRotate(0); setOffset({ x: 0, y: 0 }); setImgLoaded(false)
  }
  useEffect(resetView, [src])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.12 : 0.12
    setZoom(z => Math.min(Math.max(0.1, z + delta * z), 12))
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  function onMouseDown(e: React.MouseEvent): void {
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
    stageRef.current?.classList.add('dragging')
  }

  function onMouseMove(e: React.MouseEvent): void {
    if (!dragStart.current) return
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.mx,
      y: dragStart.current.oy + e.clientY - dragStart.current.my
    })
  }

  function onMouseUp(): void {
    dragStart.current = null
    stageRef.current?.classList.remove('dragging')
  }

  const transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotate}deg)`

  const dimText = info?.dimensions
    ? `${info.dimensions.width} × ${info.dimensions.height}px`
    : ''
  const sizeText = info ? formatSize(info.size) : ''
  const infoText = [dimText, sizeText, info?.ext.toUpperCase().slice(1)].filter(Boolean).join('  ·  ')

  return (
    <div
      className="fv-img-stage"
      ref={stageRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {!imgLoaded && (
        <div className="fv-img-skeleton">
          <div className="fv-skeleton-shimmer" />
        </div>
      )}
      <img
        className="fv-img"
        src={src}
        alt="preview"
        style={{ transform, opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
        draggable={false}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgLoaded(true)} // show even on error
      />
      {infoText && <div className="fv-img-info">{infoText}</div>}
    </div>
  )
}

/** Excel viewer with sheet tabs */
function XlsxPane({ base64 }: { base64: string }) {
  const [sheets, setSheets]       = useState<{ name: string; data: string[][] }[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    if (!base64) return
    ;(async () => {
      try {
        // Dynamically load xlsx so it only parses when needed
        const XLSX = await import('xlsx')
        const wb = XLSX.read(base64, { type: 'base64' })
        const parsed = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name]
          const data: string[][] = XLSX.utils.sheet_to_json(ws, {
            header: 1, defval: '', blankrows: false
          }) as string[][]
          return { name, data }
        })
        setSheets(parsed)
        setActiveIdx(0)
      } catch (e: any) {
        setError(e.message ?? 'Failed to parse Excel file')
      }
    })()
  }, [base64])

  if (error) return <div className="fv-center"><div className="fv-error-icon">⚠️</div><div className="fv-error-msg">{error}</div></div>
  if (!sheets.length) return <div className="fv-center"><div className="fv-spinner" /></div>

  const sheet = sheets[activeIdx]
  const headers = sheet.data[0] ?? []
  const rows    = sheet.data.slice(1)

  return (
    <div className="fv-xlsx-wrap">
      {sheets.length > 1 && (
        <div className="fv-xlsx-tabs">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              className={`fv-xlsx-tab${i === activeIdx ? ' active' : ''}`}
              onClick={() => setActiveIdx(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="fv-xlsx-scroll">
        <table className="fv-xlsx-table">
          <thead>
            <tr>
              <th className="fv-row-num">#</th>
              {headers.map((h, i) => <th key={i}>{String(h)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td className="fv-row-num">{ri + 1}</td>
                {headers.map((_h, ci) => (
                  <td key={ci} title={String(row[ci] ?? '')}>{String(row[ci] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Markdown / HTML document renderer */
function DocPane({ html }: { html: string }) {
  return (
    <div className="fv-doc-scroll">
      <div
        className="fv-doc-paper"
        // biome-ignore lint: trusted HTML from mammoth/marked
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

/** Inline PDF viewer using blob URL → <embed> to avoid iframe CSP blocking */
function PdfPane({ base64, filePath: _filePath }: { base64: string | null; filePath: string; loading: boolean }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [_numPages, setNumPages] = useState<number | null>(null)

  useEffect(() => {
    if (!base64) return
    // Convert base64 → Uint8Array → Blob → object URL
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    setNumPages(null)
    return () => { URL.revokeObjectURL(url) }
  }, [base64])

  if (!blobUrl) {
    return (
      <div className="fv-center">
        <div className="fv-pdf-skeleton">
          <div className="fv-skeleton-shimmer" />
        </div>
        <span style={{ marginTop: 12, opacity: 0.6 }}>Loading PDF…</span>
      </div>
    )
  }

  return (
    <div className="fv-pdf-wrap">
      <embed
        className="fv-pdf-embed"
        src={blobUrl}
        type="application/pdf"
        title="PDF Viewer"
      />
      {/* Fallback link if embed doesn't render */}
      <div className="fv-pdf-fallback-bar">
        <span>If the PDF doesn't display,</span>
        <button
          className="fv-btn"
          onClick={() => {
            const link = document.createElement('a')
            link.href = blobUrl
            link.target = '_blank'
            link.click()
          }}
        >
          Open in Browser ↗
        </button>
      </div>
    </div>
  )
}

interface VideoPlayerProps {
  src: string
}

function CustomVideoPlayer({ src }: VideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const seekTrackRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [speed, setSpeed] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [videoReady, setVideoReady] = useState(false)
  const fadeTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setIsPlaying(true)
    setVideoReady(false)
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
      videoRef.current.volume = volume
    }
  }, [src])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play().catch(console.error)
      setIsPlaying(true)
    }
  }

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      // Check if typing in inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKeys)
    return () => window.removeEventListener('keydown', handleKeys)
  }, [isPlaying])

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleDurationChange = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0)
    }
  }

  const handleCanPlay = () => {
    setVideoReady(true)
    videoRef.current?.play().catch(() => setIsPlaying(false))
  }

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !seekTrackRef.current) return
    const rect = seekTrackRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = Math.min(Math.max(0, clickX / rect.width), 1)
    const newTime = percent * duration
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (val: number) => {
    setVolume(val)
    if (videoRef.current) {
      videoRef.current.volume = val
      videoRef.current.muted = val === 0
    }
  }

  const toggleMute = () => {
    if (volume > 0) {
      handleVolumeChange(0)
    } else {
      handleVolumeChange(0.8)
    }
  }

  const handleSpeedChange = (val: number) => {
    setSpeed(val)
    if (videoRef.current) {
      videoRef.current.playbackRate = val
    }
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch(err => {
        console.error('Fullscreen failed:', err)
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      }).catch(err => {
        console.error('Exit fullscreen failed:', err)
      })
    }
  }

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onMove = () => {
      setControlsVisible(true)
      if (fadeTimeout.current) clearTimeout(fadeTimeout.current)
      fadeTimeout.current = setTimeout(() => {
        if (isPlaying) setControlsVisible(false)
      }, 2500)
    }
    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseenter', onMove)
    return () => {
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseenter', onMove)
      if (fadeTimeout.current) clearTimeout(fadeTimeout.current)
    }
  }, [isPlaying])

  const formatTime = (secs: number): string => {
    if (!isFinite(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="fv-video-container" ref={containerRef}>
      {/* Video skeleton while loading */}
      {!videoReady && (
        <div className="fv-video-skeleton">
          <div className="fv-skeleton-shimmer" />
          <div className="fv-video-loading-icon">▶</div>
        </div>
      )}

      <video
        ref={videoRef}
        className="fv-video"
        src={src}
        preload="auto"
        style={{ opacity: videoReady ? 1 : 0 }}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onCanPlay={handleCanPlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      {/* Controls overlay */}
      <div
        className={`fv-video-controls ${controlsVisible ? 'visible' : 'hidden'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Seek bar */}
        <div className="fv-seek-track" ref={seekTrackRef} onClick={handleSeekClick}>
          <div className="fv-seek-fill" style={{ width: `${progressPct}%` }} />
          <div className="fv-seek-thumb" style={{ left: `${progressPct}%` }} />
        </div>

        <div className="fv-controls-row">
          {/* Play/Pause */}
          <button className="fv-ctrl-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Time */}
          <span className="fv-time-label">{formatTime(currentTime)} / {formatTime(duration)}</span>

          <div className="fv-controls-spacer" />

          {/* Volume */}
          <button className="fv-ctrl-btn" onClick={toggleMute} title="Toggle mute">
            {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            className="fv-volume-slider"
            type="range" min={0} max={1} step={0.05}
            value={volume}
            onChange={e => handleVolumeChange(parseFloat(e.target.value))}
            title="Volume"
          />

          {/* Speed */}
          <select
            className="fv-speed-select"
            value={speed}
            onChange={e => handleSpeedChange(parseFloat(e.target.value))}
            title="Playback speed"
          >
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
              <option key={s} value={s}>{s}×</option>
            ))}
          </select>

          {/* Fullscreen */}
          <button className="fv-ctrl-btn" onClick={toggleFullscreen} title="Toggle fullscreen">
            {isFullscreen ? '⊠' : '⛶'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main FileViewer component ────────────────────────────────────
export default function FileViewer({ filePath, onClose }: Props): JSX.Element | null {
  if (!filePath) return null

  const [currentPath, setCurrentPath] = useState<string | null>(filePath)
  const [siblings, setSiblings] = useState<string[]>([])

  useEffect(() => {
    setCurrentPath(filePath)
  }, [filePath])

  const ext = useMemo(() => {
    if (!currentPath) return ''
    const dot = currentPath.lastIndexOf('.')
    return dot !== -1 ? currentPath.slice(dot).toLowerCase() : ''
  }, [currentPath])

  const mode = useMemo(() => detectMode(ext), [ext])
  const name = useMemo(() => currentPath ? basename(currentPath) : '', [currentPath])
  const isRaw = RAW_EXTS.has(ext)

  // ── State ───────────────────────────────────────────────────
  const [imgSrc,   setImgSrc]   = useState<string | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [pdfBase64,setPdfBase64]= useState<string | null>(null)
  const [docHtml,  setDocHtml]  = useState<string | null>(null)
  const [xlsxB64,  setXlsxB64] = useState<string | null>(null)
  const [info,     setInfo]     = useState<FileInfo | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // Zoom state (images only — synced to ImagePane)
  const [zoom,    setZoom]    = useState(1)

  // ── Fetch siblings list ─────────────────────────────────────
  useEffect(() => {
    if (!currentPath) return
    api().viewer.getSiblingFiles(currentPath).then((res: any) => {
      if (res.ok && res.siblings) {
        setSiblings(res.siblings)
      }
    }).catch((err: any) => {
      console.error('Failed to get sibling files:', err)
    })
  }, [currentPath])

  // ── Load file ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentPath) return
    setLoading(true)
    setError(null)
    setImgSrc(null)
    setVideoSrc(null)
    setPdfBase64(null)
    setDocHtml(null)
    setXlsxB64(null)
    setZoom(1)

    const v = api().viewer

    ;(async () => {
      try {
        // File info (size, dimensions, etc.) — non-blocking
        v.getFileInfo(currentPath).then((infoRes: any) => {
          if (infoRes.ok) setInfo(infoRes)
        }).catch(() => { /* non-fatal */ })

        if (mode === 'image') {
          if (isRaw) {
            // RAW → convert via sharp on main process
            const res = await v.readRaw(currentPath)
            if (res.ok) setImgSrc(res.dataUrl)
            else setError(`RAW decode failed: ${res.error}`)
          } else {
            // Build a proper local-resource URL for the image
            setImgSrc(toLocalResourceUrl(currentPath))
          }
        } else if (mode === 'video') {
          // Build a proper local-resource URL — Electron's net.fetch handles Range headers
          setVideoSrc(toLocalResourceUrl(currentPath))
        } else if (mode === 'pdf') {
          // Read PDF as base64 → convert to Blob URL in PdfPane to avoid iframe CSP
          const res = await v.readPdfBase64(currentPath)
          if (res.ok) setPdfBase64(res.base64)
          else setError(`PDF read failed: ${res.error}`)
        } else if (mode === 'docx') {
          const res = await v.readFileBase64(currentPath)
          if (!res.ok) throw new Error(res.error)
          // Parse docx in renderer with mammoth
          const mammoth = await import('mammoth')
          const buf = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0)).buffer
          const result = await mammoth.convertToHtml({ arrayBuffer: buf })
          setDocHtml(result.value)
        } else if (mode === 'xlsx') {
          const res = await v.readFileBase64(currentPath)
          if (!res.ok) throw new Error(res.error)
          setXlsxB64(res.base64)
        } else if (mode === 'markdown') {
          const res = await v.readText(currentPath)
          if (!res.ok) throw new Error(res.error)
          const { marked } = await import('marked')
          const html = await marked(res.text, { gfm: true, breaks: true })
          setDocHtml(typeof html === 'string' ? html : String(html))
        }
      } catch (e: any) {
        setError(e.message ?? String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [currentPath, mode, isRaw])

  const handlePrev = useCallback(() => {
    if (!currentPath || siblings.length <= 1) return
    const idx = siblings.indexOf(currentPath)
    if (idx !== -1) {
      const prevIdx = (idx - 1 + siblings.length) % siblings.length
      setCurrentPath(siblings[prevIdx])
    }
  }, [currentPath, siblings])

  const handleNext = useCallback(() => {
    if (!currentPath || siblings.length <= 1) return
    const idx = siblings.indexOf(currentPath)
    if (idx !== -1) {
      const nextIdx = (idx + 1) % siblings.length
      setCurrentPath(siblings[nextIdx])
    }
  }, [currentPath, siblings])

  // ── Keyboard handling ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, handlePrev, handleNext])

  // ── Zoom controls (images) ──────────────────────────────────
  function zoomIn():    void { setZoom(z => Math.min(z + 0.25, 12)) }
  function zoomOut():   void { setZoom(z => Math.max(z - 0.25, 0.1)) }
  function zoomReset(): void { setZoom(1) }

  // ── File meta display ───────────────────────────────────────
  const metaParts: string[] = []
  if (info) {
    metaParts.push(formatSize(info.size))
    if (info.dimensions) metaParts.push(`${info.dimensions.width}×${info.dimensions.height}`)
    metaParts.push(ext.toUpperCase().slice(1))
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="fv-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {/* ── Toolbar ── */}
      <div className="fv-toolbar">
        <div className="fv-toolbar-left">
          <span className="fv-file-icon">{fileIcon(mode, ext)}</span>
          <div className="fv-file-info">
            <div className="fv-file-name" title={currentPath ?? ''}>{name}</div>
            {metaParts.length > 0 && (
              <div className="fv-file-meta">{metaParts.join('  ·  ')}</div>
            )}
          </div>
        </div>

        {/* ── Image zoom controls ── */}
        {mode === 'image' && !loading && !error && (
          <div className="fv-toolbar-center">
            <button className="fv-btn fv-btn-icon" onClick={zoomOut} title="Zoom out">−</button>
            <span className="fv-zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="fv-btn fv-btn-icon" onClick={zoomIn}  title="Zoom in">+</button>
            <button className="fv-btn" onClick={zoomReset} title="Reset zoom">↺ Fit</button>
          </div>
        )}

        <div className="fv-toolbar-right">
          <button
            className="fv-btn"
            onClick={() => {
              if (currentPath) {
                ;(window as any).api.shell.openExternal(`file:///${currentPath.replace(/\\/g, '/')}`)
              }
            }}
            title="Open in default app"
          >
            ↗ Open With
          </button>
          <div className="fv-divider" />
          <button className="fv-btn fv-btn-close fv-btn-icon" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>
      </div>

      {/* ── Sibling navigation buttons ── */}
      {siblings.length > 1 && (
        <>
          <button
            className="fv-nav-btn fv-nav-left"
            onClick={e => { e.stopPropagation(); handlePrev() }}
            title="Previous (Left Arrow)"
          >
            ◀
          </button>
          <button
            className="fv-nav-btn fv-nav-right"
            onClick={e => { e.stopPropagation(); handleNext() }}
            title="Next (Right Arrow)"
          >
            ▶
          </button>
        </>
      )}

      {/* ── Content ── */}
      <div className="fv-content">
        {loading && (
          <div className="fv-center">
            <div className="fv-spinner" />
            <span>
              {isRaw ? 'Decoding RAW photo…' : mode === 'pdf' ? 'Loading PDF…' : 'Loading…'}
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="fv-center">
            <div className="fv-error-icon">⚠️</div>
            <div className="fv-error-msg">{error}</div>
            <button
              className="fv-btn"
              onClick={() => {
                if (currentPath) {
                  ;(window as any).api.shell.openExternal(`file:///${currentPath.replace(/\\/g, '/')}`)
                }
              }}
            >
              Open in Default App Instead
            </button>
          </div>
        )}

        {!loading && !error && mode === 'image' && imgSrc && (
          <ImagePane src={imgSrc} info={info} />
        )}

        {!loading && !error && mode === 'video' && videoSrc && (
          <CustomVideoPlayer src={videoSrc} />
        )}

        {!loading && !error && mode === 'pdf' && (
          <PdfPane base64={pdfBase64} filePath={currentPath ?? ''} loading={loading} />
        )}

        {!loading && !error && (mode === 'docx' || mode === 'markdown') && docHtml !== null && (
          <DocPane html={docHtml} />
        )}

        {!loading && !error && mode === 'xlsx' && xlsxB64 && (
          <XlsxPane base64={xlsxB64} />
        )}

        {!loading && !error && mode === 'unknown' && (
          <div className="fv-center">
            <div className="fv-error-icon">🗂️</div>
            <span>This file type ({ext || 'unknown'}) is not supported for preview.</span>
            <button
              className="fv-btn"
              onClick={() => {
                if (currentPath) {
                  ;(window as any).api.shell.openExternal(`file:///${currentPath.replace(/\\/g, '/')}`)
                }
              }}
            >
              Open in Default App
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
