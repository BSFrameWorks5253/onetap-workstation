import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo
} from 'react'
import './FileViewer.css'
import CodePane from './CodePane'
import DocPane from './DocPane'
import AudioPane from './AudioPane'
import HexDumpPane from './HexDumpPane'
import XlsxPane from './XlsxPane'
import PdfPane from './PdfPane'

// ── Types ────────────────────────────────────────────────────────
export interface FileInfo {
  size: number
  modified: number
  ext: string
  isRaw: boolean
  dimensions?: { width: number; height: number } | null
}

export type ViewerMode =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'doc'
  | 'spreadsheet'
  | 'code'
  | 'markdown'
  | 'unknown'

export interface FileViewerProps {
  filePath: string | null
  onClose: () => void
  isStandaloneWindow?: boolean
}

// ── Extension Sets ───────────────────────────────────────────────
const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.heic', '.avif', '.ico', '.svg'
])

const RAW_EXTS = new Set([
  '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2', '.dng', '.orf', '.rw2',
  '.pef', '.ptx', '.raf', '.raw', '.3fr', '.mef', '.mos', '.erf', '.rwl', '.srw',
  '.x3f', '.dcr', '.kdc', '.mrw'
])

const VIDEO_EXTS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv', '.m4v', '.ts', '.m2ts', '.mpg', '.mpeg'
])

const AUDIO_EXTS = new Set([
  '.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma', '.aiff', '.opus'
])

const SPREADSHEET_EXTS = new Set([
  '.xlsx', '.xls', '.csv', '.tsv', '.ods'
])

const CODE_EXTS = new Set([
  '.txt', '.log', '.json', '.xml', '.html', '.htm', '.css', '.scss', '.js', '.mjs', '.cjs',
  '.ts', '.tsx', '.jsx', '.py', '.sql', '.ini', '.bat', '.cmd', '.sh', '.ps1', '.psd1',
  '.psm1', '.yml', '.yaml', '.env', '.config', '.properties', '.java', '.c', '.cpp', '.h',
  '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.diff', '.patch', '.reg'
])

export function detectViewerMode(ext: string): ViewerMode {
  const e = ext.toLowerCase()
  if (IMAGE_EXTS.has(e) || RAW_EXTS.has(e)) return 'image'
  if (VIDEO_EXTS.has(e)) return 'video'
  if (AUDIO_EXTS.has(e)) return 'audio'
  if (e === '.pdf') return 'pdf'
  if (e === '.docx' || e === '.doc' || e === '.rtf' || e === '.odt') return 'doc'
  if (SPREADSHEET_EXTS.has(e)) return 'spreadsheet'
  if (e === '.md' || e === '.markdown') return 'markdown'
  if (CODE_EXTS.has(e)) return 'code'
  return 'unknown'
}

export function fileViewerIcon(mode: ViewerMode, ext: string): string {
  if (mode === 'video') return '🎬'
  if (mode === 'audio') return '🎵'
  if (mode === 'pdf') return '📄'
  if (mode === 'doc') return '📝'
  if (mode === 'spreadsheet') return '📊'
  if (mode === 'code') return '💻'
  if (mode === 'markdown') return '📋'
  if (RAW_EXTS.has(ext.toLowerCase())) return '📷'
  if (mode === 'image') return '🖼️'
  return '🔍'
}

export function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function fileBasename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

export function toLocalResourceUrl(absolutePath: string): string {
  const forward = absolutePath.replace(/\\/g, '/')
  const encoded = encodeURI(forward)
  return `local-resource:///${encoded.replace(/^\//, '')}`
}

const api = (): any => (window as any).api

// ── Image Viewer Stage ───────────────────────────────────────────
interface ImagePaneProps {
  src: string
  info: FileInfo | null
  zoom: number
  setZoom: React.Dispatch<React.SetStateAction<number>>
  rotate: number
  setRotate: React.Dispatch<React.SetStateAction<number>>
  onFallback?: () => void
}

function ImagePane({
  src,
  info,
  zoom,
  setZoom,
  rotate,
  setRotate: _setRotate,
  onFallback
}: ImagePaneProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imgLoaded, setImgLoaded] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // Reset offset and sync loaded state on src change
  useEffect(() => {
    setOffset({ x: 0, y: 0 })
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImgLoaded(true)
    } else {
      setImgLoaded(false)
    }
  }, [src])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.15 : 0.15
      setZoom((z) => Math.min(Math.max(0.1, Math.round((z + delta * z) * 100) / 100), 12))
    },
    [setZoom]
  )

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  function onMouseDown(e: React.MouseEvent): void {
    if (e.button !== 0) return
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

  const dimText = info?.dimensions ? `${info.dimensions.width} × ${info.dimensions.height}px` : ''
  const sizeText = info ? formatFileSize(info.size) : ''
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
        ref={imgRef}
        className="fv-img"
        src={src}
        alt="preview"
        style={{
          transform,
          opacity: imgLoaded ? 1 : 0,
          transition: dragStart.current ? 'none' : 'opacity 0.25s ease'
        }}
        draggable={false}
        onLoad={() => {
          setImgLoaded(true)
        }}
        onError={() => {
          if (onFallback) {
            onFallback()
          } else {
            setImgLoaded(true)
          }
        }}
      />
      {infoText && <div className="fv-img-info">{infoText}</div>}
    </div>
  )
}

// ── Video Player Component ───────────────────────────────────────
function CustomVideoPlayer({ src }: { src: string }): JSX.Element {
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

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null)

  useEffect(() => {
    setIsPlaying(true)
    setVideoReady(false)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setIsDragging(false)
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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setZoom((z) => {
      const nextZoom = Math.min(Math.max(1, z + delta * z), 6)
      if (nextZoom === 1) setPan({ x: 0, y: 0 })
      return nextZoom
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: pan.x, oy: pan.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return
    setPan({
      x: dragStart.current.ox + (e.clientX - dragStart.current.mx),
      y: dragStart.current.oy + (e.clientY - dragStart.current.my)
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    dragStart.current = null
  }

  const stepFrame = (frames: number) => {
    if (!videoRef.current) return
    videoRef.current.pause()
    setIsPlaying(false)
    const fps = 30
    const newTime = Math.max(0, Math.min(duration || 99999, videoRef.current.currentTime + frames / fps))
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const captureFrame = () => {
    if (!videoRef.current) return
    try {
      const v = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = v.videoWidth || 1920
      canvas.height = v.videoHeight || 1080
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `frame_${Math.round(currentTime * 1000)}ms.jpg`
        a.click()
        setSnapshotMsg('Frame Saved!')
        setTimeout(() => setSnapshotMsg(null), 2200)
      }
    } catch (err) {
      console.error('Frame capture failed:', err)
    }
  }

  const formatTime = (secs: number): string => {
    if (!isFinite(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="fv-video-container" ref={containerRef}>
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
        style={{
          opacity: videoReady ? 1 : 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          transition: isDragging ? 'none' : 'transform 0.12s ease-out'
        }}
        onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
        onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration || 0)}
        onCanPlay={() => {
          setVideoReady(true)
          videoRef.current?.play().catch(() => setIsPlaying(false))
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={() => {
          if (zoom > 1) return
          togglePlay()
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      <div
        className={`fv-video-controls ${controlsVisible ? 'visible' : 'hidden'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="fv-seek-track"
          ref={seekTrackRef}
          onClick={(e) => {
            if (!videoRef.current || !seekTrackRef.current) return
            const rect = seekTrackRef.current.getBoundingClientRect()
            const clickX = e.clientX - rect.left
            const percent = Math.min(Math.max(0, clickX / rect.width), 1)
            const newTime = percent * duration
            videoRef.current.currentTime = newTime
            setCurrentTime(newTime)
          }}
        >
          <div className="fv-seek-fill" style={{ width: `${progressPct}%` }} />
          <div className="fv-seek-thumb" style={{ left: `${progressPct}%` }} />
        </div>

        <div className="fv-controls-row">
          <button className="fv-ctrl-btn" onClick={togglePlay} title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
            {isPlaying ? '⏸' : '▶'}
          </button>

          <span className="fv-time-label">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <button className="fv-ctrl-btn" onClick={() => stepFrame(-1)} title="Step 1 Frame Back">
            ⏮ -1f
          </button>
          <button className="fv-ctrl-btn" onClick={() => stepFrame(1)} title="Step 1 Frame Forward">
            +1f ⏭
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginLeft: 6,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: '2px 6px'
            }}
          >
            <button
              className="fv-ctrl-btn"
              onClick={() =>
                setZoom((z) => {
                  const nz = Math.max(1, z - 0.25)
                  if (nz === 1) setPan({ x: 0, y: 0 })
                  return nz
                })
              }
              title="Zoom Out"
            >
              🔍-
            </button>
            <span style={{ fontSize: 11, color: '#a5b4fc', minWidth: 38, textAlign: 'center', fontWeight: 600 }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="fv-ctrl-btn" onClick={() => setZoom((z) => Math.min(6, z + 0.25))} title="Zoom In">
              🔍+
            </button>
            {zoom > 1 && (
              <button
                className="fv-ctrl-btn"
                onClick={() => {
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
                style={{ color: '#f59e0b', fontSize: 11, padding: '0 6px' }}
              >
                Fit
              </button>
            )}
          </div>

          <button className="fv-ctrl-btn" onClick={captureFrame} title="Snapshot Current Frame" style={{ marginLeft: 6 }}>
            📸 Snapshot
          </button>

          {snapshotMsg && (
            <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600, marginLeft: 4 }}>
              {snapshotMsg}
            </span>
          )}

          <div className="fv-controls-spacer" />

          <button
            className="fv-ctrl-btn"
            onClick={() => {
              if (volume > 0) {
                setVolume(0)
                if (videoRef.current) videoRef.current.volume = 0
              } else {
                setVolume(0.8)
                if (videoRef.current) videoRef.current.volume = 0.8
              }
            }}
          >
            {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>

          <input
            className="fv-volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              setVolume(val)
              if (videoRef.current) videoRef.current.volume = val
            }}
          />

          <select
            className="fv-speed-select"
            value={speed}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              setSpeed(val)
              if (videoRef.current) videoRef.current.playbackRate = val
            }}
          >
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>

          <button
            className="fv-ctrl-btn"
            onClick={() => {
              if (!containerRef.current) return
              if (!document.fullscreenElement) {
                containerRef.current.requestFullscreen().catch(console.error)
                setIsFullscreen(true)
              } else {
                document.exitFullscreen().catch(console.error)
                setIsFullscreen(false)
              }
            }}
          >
            {isFullscreen ? '⊠' : '⛶'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Universal FileViewer Component ───────────────────────────
export default function FileViewer({
  filePath,
  onClose,
  isStandaloneWindow = false
}: FileViewerProps): JSX.Element | null {
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

  const mode = useMemo(() => detectViewerMode(ext), [ext])
  const name = useMemo(() => (currentPath ? fileBasename(currentPath) : ''), [currentPath])
  const isRaw = RAW_EXTS.has(ext)

  // ── States for file contents ──
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [docText, setDocText] = useState<string | null>(null)
  const [isLegacyDoc, setIsLegacyDoc] = useState(false)
  const [xlsxB64, setXlsxB64] = useState<string | null>(null)
  const [csvText, setCsvText] = useState<string | null>(null)
  const [codeContent, setCodeContent] = useState<string | null>(null)
  const [info, setInfo] = useState<FileInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  // ── Load sibling files for navigation ──
  useEffect(() => {
    if (!currentPath) return
    const v = api()?.viewer
    if (v?.getSiblingFiles) {
      v.getSiblingFiles(currentPath)
        .then((res: any) => {
          if (res.ok && Array.isArray(res.siblings)) {
            setSiblings(res.siblings)
          }
        })
        .catch(console.error)
    }
  }, [currentPath])

  // ── Load target file ──
  useEffect(() => {
    if (!currentPath) return
    let active = true
    setLoading(true)
    setError(null)
    setImgSrc(null)
    setVideoSrc(null)
    setAudioSrc(null)
    setPdfBase64(null)
    setDocHtml(null)
    setDocText(null)
    setIsLegacyDoc(false)
    setXlsxB64(null)
    setCsvText(null)
    setCodeContent(null)
    setZoom(1)

    const v = api()?.viewer

    ;(async () => {
      try {
        // Fetch file stats
        if (v?.getFileInfo) {
          v.getFileInfo(currentPath)
            .then((res: any) => {
              if (active && res.ok) setInfo(res)
            })
            .catch(() => {})
        }

        if (mode === 'image') {
          if (isRaw) {
            const res = await v.readRaw(currentPath)
            if (!active) return
            if (res.ok) setImgSrc(res.dataUrl)
            else setError(`RAW decode failed: ${res.error}`)
          } else {
            try {
              if (v?.readImageBase64) {
                const imgRes = await v.readImageBase64(currentPath)
                if (active && imgRes?.ok && imgRes.dataUrl) {
                  setImgSrc(imgRes.dataUrl)
                  return
                }
              }
            } catch {}
            if (active) setImgSrc(toLocalResourceUrl(currentPath))
          }
        } else if (mode === 'video') {
          if (active) setVideoSrc(toLocalResourceUrl(currentPath))
        } else if (mode === 'audio') {
          if (active) setAudioSrc(toLocalResourceUrl(currentPath))
        } else if (mode === 'pdf') {
          const res = await v.readPdfBase64(currentPath)
          if (!active) return
          if (res.ok) setPdfBase64(res.base64)
          else setError(`PDF read failed: ${res.error}`)
        } else if (mode === 'doc') {
          if (ext === '.docx') {
            const res = await v.readFileBase64(currentPath)
            if (!active) return
            if (!res.ok) throw new Error(res.error)
            const mammoth = await import('mammoth')
            const buf = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0)).buffer
            const result = await mammoth.convertToHtml({ arrayBuffer: buf })
            if (active) setDocHtml(result.value)
          } else {
            // Legacy .doc / .rtf
            const res = await v.readDoc(currentPath)
            if (!active) return
            if (!res.ok) throw new Error(res.error)
            if (res.isDocx && res.base64) {
              const mammoth = await import('mammoth')
              const buf = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0)).buffer
              const result = await mammoth.convertToHtml({ arrayBuffer: buf })
              if (active) setDocHtml(result.value)
            } else {
              if (active) {
                setDocText(res.text || '')
                setIsLegacyDoc(true)
              }
            }
          }
        } else if (mode === 'spreadsheet') {
          if (ext === '.csv' || ext === '.tsv') {
            const res = await v.readText(currentPath)
            if (!active) return
            if (!res.ok) throw new Error(res.error)
            setCsvText(res.text)
          } else {
            const res = await v.readFileBase64(currentPath)
            if (!active) return
            if (!res.ok) throw new Error(res.error)
            setXlsxB64(res.base64)
          }
        } else if (mode === 'markdown') {
          const res = await v.readText(currentPath)
          if (!active) return
          if (!res.ok) throw new Error(res.error)
          const { marked } = await import('marked')
          const html = await marked(res.text, { gfm: true, breaks: true })
          if (active) setDocHtml(typeof html === 'string' ? html : String(html))
        } else if (mode === 'code') {
          const res = await v.readText(currentPath)
          if (!active) return
          if (!res.ok) throw new Error(res.error)
          setCodeContent(res.text)
        }
      } catch (err: any) {
        if (active) setError(err?.message || String(err))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [currentPath, mode, ext, isRaw])

  // ── Sibling Navigation ──
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

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && mode !== 'video') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'ArrowRight' && mode !== 'video') {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, handlePrev, handleNext, mode])

  // Actions
  const openInDefaultApp = () => {
    if (!currentPath) return
    const v = api()?.viewer
    if (v?.openExternal) {
      v.openExternal(currentPath)
    } else if (api()?.shell?.openExternal) {
      api().shell.openExternal(`file:///${currentPath.replace(/\\/g, '/')}`)
    }
  }

  const revealInFolder = () => {
    if (!currentPath) return
    const v = api()?.viewer
    if (v?.showItemInFolder) {
      v.showItemInFolder(currentPath)
    }
  }

  const copyPath = () => {
    if (currentPath) navigator.clipboard.writeText(currentPath)
  }

  const metaParts: string[] = []
  if (info) {
    metaParts.push(formatFileSize(info.size))
    if (info.dimensions) metaParts.push(`${info.dimensions.width}×${info.dimensions.height}`)
    metaParts.push(ext.toUpperCase().slice(1) || 'FILE')
  }

  const siblingIndex = currentPath ? siblings.indexOf(currentPath) : -1

  return (
    <div
      className={`fv-backdrop ${isStandaloneWindow ? 'fv-standalone-mode' : ''}`}
      onClick={(e) => {
        if (!isStandaloneWindow && e.target === e.currentTarget) onClose()
      }}
    >
      {/* ── Top Header Toolbar ── */}
      <div className="fv-toolbar">
        <div className="fv-toolbar-left">
          <span className="fv-file-icon">{fileViewerIcon(mode, ext)}</span>
          <div className="fv-file-info">
            <div className="fv-file-name" title={currentPath ?? ''}>
              {name}
            </div>
            {metaParts.length > 0 && <div className="fv-file-meta">{metaParts.join('  ·  ')}</div>}
          </div>
        </div>

        {/* Sibling Counter */}
        {siblings.length > 1 && siblingIndex !== -1 && (
          <div className="fv-toolbar-counter">
            <button className="fv-counter-btn" onClick={handlePrev} title="Previous File (Left Arrow)">
              ◀
            </button>
            <span className="fv-counter-txt">
              {siblingIndex + 1} / {siblings.length}
            </span>
            <button className="fv-counter-btn" onClick={handleNext} title="Next File (Right Arrow)">
              ▶
            </button>
          </div>
        )}

        {/* Image Zoom Controls */}
        {mode === 'image' && !loading && !error && (
          <div className="fv-toolbar-center">
            <button className="fv-btn fv-btn-icon" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.1))} title="Zoom out">
              −
            </button>
            <span className="fv-zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="fv-btn fv-btn-icon" onClick={() => setZoom((z) => Math.min(z + 0.25, 12))} title="Zoom in">
              +
            </button>
            <button className="fv-btn" onClick={() => setZoom(1)} title="Fit to Screen">
              ↺ Fit
            </button>
          </div>
        )}

        {/* Global Right Actions */}
        <div className="fv-toolbar-right">
          <button className="fv-btn" onClick={copyPath} title="Copy absolute file path">
            📋 Copy Path
          </button>
          <button className="fv-btn" onClick={revealInFolder} title="Show in File Explorer">
            📁 Reveal
          </button>
          <button className="fv-btn" onClick={openInDefaultApp} title="Open in Windows Default App">
            ↗ Open With
          </button>
          <div className="fv-divider" />
          <button className="fv-btn fv-btn-close fv-btn-icon" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="fv-content">
        {loading && (
          <div className="fv-center">
            <div className="fv-spinner" />
            <span>
              {isRaw ? 'Decoding RAW camera image…' : mode === 'pdf' ? 'Loading PDF Document…' : 'Preparing File Preview…'}
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="fv-center">
            <div className="fv-error-icon">⚠️</div>
            <div className="fv-error-msg">{error}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="fv-btn" onClick={openInDefaultApp}>
                Open in Default Windows App
              </button>
              <button className="fv-btn" onClick={revealInFolder}>
                Reveal in Explorer
              </button>
            </div>
          </div>
        )}

        {!loading && !error && mode === 'image' && imgSrc && <ImagePane src={imgSrc} info={info} />}

        {!loading && !error && mode === 'video' && videoSrc && <CustomVideoPlayer src={videoSrc} />}

        {!loading && !error && mode === 'audio' && audioSrc && (
          <AudioPane src={audioSrc} fileName={name} />
        )}

        {!loading && !error && mode === 'pdf' && (
          <PdfPane base64={pdfBase64} filePath={currentPath ?? ''} loading={loading} />
        )}

        {!loading && !error && (mode === 'doc' || mode === 'markdown') && (docHtml !== null || docText !== null) && (
          <DocPane
            html={docHtml}
            text={docText}
            isLegacyDoc={isLegacyDoc}
            fileName={name}
          />
        )}

        {!loading && !error && mode === 'spreadsheet' && (xlsxB64 || csvText) && (
          <XlsxPane base64={xlsxB64 || undefined} textCsv={csvText || undefined} fileName={name} />
        )}

        {!loading && !error && mode === 'code' && codeContent !== null && (
          <CodePane content={codeContent} ext={ext} filePath={currentPath ?? undefined} />
        )}

        {/* Universal Fallback Hex Inspector for ANY unknown extension */}
        {!loading && !error && mode === 'unknown' && currentPath && (
          <HexDumpPane filePath={currentPath} fileSize={info?.size} ext={ext} />
        )}
      </div>
    </div>
  )
}
