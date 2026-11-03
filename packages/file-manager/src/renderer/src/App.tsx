import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Folder,
  File,
  HardDrive,
  ChevronRight,
  Home,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  FolderOpen,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  LayoutGrid,
  List,
  Columns,
  SquareCode,
  PanelRight,
  Eye,
  Maximize2,
  X,
  Play,
  Pause,
  RotateCw,
  Camera,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  Clock,
  Monitor,
  Download,
  Image as ImageIcon,
  Film,
  FileText,
  Check,
  Edit2,
  ArrowUpDown
} from 'lucide-react'

const api = (window as any).fmApi

interface FsEntry {
  name: string
  isDir: boolean
  size: number
  mtime: number
  ext: string
  fullPath: string
}

const IMG_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico', 'tiff', 'tif'])
const VID_EXTS = new Set(['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'ts', 'wmv', 'flv'])
const DOC_EXTS = new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'xlsx', 'csv'])

function formatSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(2) + ' GB'
}

function formatDate(mtime: number): string {
  if (!mtime) return '—'
  const d = new Date(mtime)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatTimelapse(secs: number): string {
  if (!isFinite(secs) || secs <= 0) return ''
  if (secs < 60) return `${Math.round(secs)}s`
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}m ${s}s`
}

// ── Smart Video & Photo Thumbnail Component ───────────────────
const videoThumbCache = new Map<string, { thumb: string; duration: number }>()

function MediaThumbnailCard({
  entry,
  onClick,
  onDoubleClick
}: {
  entry: FsEntry
  onClick: () => void
  onDoubleClick: () => void
}) {
  const [thumb, setThumb] = useState<string | null>(() => videoThumbCache.get(entry.fullPath)?.thumb || null)
  const [duration, setDuration] = useState<number>(() => videoThumbCache.get(entry.fullPath)?.duration || 0)
  const [loadingMeta, setLoadingMeta] = useState<boolean>(!videoThumbCache.get(entry.fullPath) && VID_EXTS.has(entry.ext))
  const isImg = IMG_EXTS.has(entry.ext)
  const isVid = VID_EXTS.has(entry.ext)

  useEffect(() => {
    if (!isVid) return
    const cached = videoThumbCache.get(entry.fullPath)
    if (cached && cached.thumb && cached.duration > 0) {
      setThumb(cached.thumb)
      setDuration(cached.duration)
      setLoadingMeta(false)
      return
    }

    let isCancelled = false
    setLoadingMeta(true)

    // 1. Native extraction via IPC (ffprobe/ffmpeg & Windows Shell COM)
    if ((api as any)?.getVideoMetadata) {
      (api as any).getVideoMetadata(entry.fullPath).then((res: any) => {
        if (isCancelled) return
        if (res && res.ok && (res.thumb || res.duration > 0)) {
          setThumb(res.thumb)
          setDuration(res.duration)
          setLoadingMeta(false)
          videoThumbCache.set(entry.fullPath, { thumb: res.thumb, duration: res.duration })
          return
        }
        // Fallback to DOM video if native didn't produce result
        runDomFallback()
      }).catch(() => {
        if (!isCancelled) runDomFallback()
      })
    } else {
      runDomFallback()
    }

    function runDomFallback() {
      const v = document.createElement('video')
      const mediaUrl = api?.toLocalResourceUrl ? api.toLocalResourceUrl(entry.fullPath) : entry.fullPath
      v.src = mediaUrl
      v.preload = 'metadata'
      v.muted = true

      v.onloadedmetadata = () => {
        if (isCancelled) return
        const dur = v.duration || 0
        setDuration(dur)
        setLoadingMeta(false)
        const seekTarget = Math.min(Math.max(1, dur * 0.1), dur > 1 ? dur - 0.5 : 0)
        v.currentTime = seekTarget
      }

      v.onseeked = () => {
        if (isCancelled) return
        try {
          const canvas = document.createElement('canvas')
          const w = v.videoWidth || 320
          const h = v.videoHeight || 180
          canvas.width = Math.min(320, w)
          canvas.height = Math.round((canvas.width / w) * h)
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
            setThumb(dataUrl)
            videoThumbCache.set(entry.fullPath, { thumb: dataUrl, duration: v.duration || 0 })
          }
        } catch {
        } finally {
          v.src = ''
        }
      }

      v.onerror = () => {
        if (!isCancelled) setLoadingMeta(false)
        v.src = ''
      }
    }

    return () => {
      isCancelled = true
    }
  }, [entry.fullPath, isVid])

  const imgUrl = isImg ? (api?.toLocalResourceUrl ? api.toLocalResourceUrl(entry.fullPath) : entry.fullPath) : null

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="group relative flex flex-col bg-[#161922] hover:bg-[#1d212c] border border-white/10 hover:border-indigo-500/50 rounded-xl overflow-hidden cursor-pointer transition-all shadow-md hover:shadow-indigo-500/10"
    >
      {/* Thumbnail viewport */}
      <div className="relative aspect-video w-full bg-black/40 flex items-center justify-center overflow-hidden">
        {isImg ? (
          <img
            src={imgUrl || ''}
            alt={entry.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : isVid ? (
          thumb ? (
            <img
              src={thumb}
              alt={entry.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-purple-400">
              <Play className="w-8 h-8 opacity-70 animate-pulse" />
            </div>
          )
        ) : entry.isDir ? (
          <Folder className="w-12 h-12 text-amber-400/80 group-hover:scale-110 transition-transform" />
        ) : (
          <File className="w-10 h-10 text-gray-400 group-hover:scale-110 transition-transform" />
        )}

        {/* Video Duration / Timelapse Badge (e.g. 10s) */}
        {isVid && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/90 backdrop-blur-md text-amber-300 border border-amber-400/40 text-[11px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 z-10 pointer-events-none">
            <Clock className={`w-3 h-3 text-amber-400 ${loadingMeta ? 'animate-spin' : ''}`} />
            <span>{duration > 0 ? formatTimelapse(duration) : loadingMeta ? '...' : 'VID'}</span>
          </span>
        )}

        {/* Hover Action overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={e => {
              e.stopPropagation()
              onDoubleClick()
            }}
            className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl hover:scale-110 transition-all"
            title="View Media"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="p-2 flex flex-col justify-between flex-1">
        <span className="text-xs font-medium text-gray-200 truncate" title={entry.name}>
          {entry.name}
        </span>
        <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
          <span>{entry.isDir ? 'Folder' : formatSize(entry.size)}</span>
          <span className="uppercase tracking-wider">{entry.ext || (entry.isDir ? 'DIR' : 'FILE')}</span>
        </div>
      </div>
    </div>
  )
}

// ── Built-in High-Definition Media Viewer with Video Frame Zoom ──
function MediaViewerModal({
  entry,
  entries,
  onClose,
  onNavigateFile
}: {
  entry: FsEntry
  entries: FsEntry[]
  onClose: () => void
  onNavigateFile: (e: FsEntry) => void
}) {
  const isVid = VID_EXTS.has(entry.ext)
  const isImg = IMG_EXTS.has(entry.ext)
  const mediaUrl = api?.toLocalResourceUrl ? api.toLocalResourceUrl(entry.fullPath) : entry.fullPath

  // Video State
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null)
  const [rotate, setRotate] = useState(0)

  // Sibling Media list
  const mediaEntries = useMemo(
    () => entries.filter(e => !e.isDir && (IMG_EXTS.has(e.ext) || VID_EXTS.has(e.ext))),
    [entries]
  )
  const currentIdx = mediaEntries.findIndex(e => e.fullPath === entry.fullPath)

  const goPrev = () => {
    if (currentIdx > 0) onNavigateFile(mediaEntries[currentIdx - 1])
  }
  const goNext = () => {
    if (currentIdx < mediaEntries.length - 1) onNavigateFile(mediaEntries[currentIdx + 1])
  }

  // Reset zoom & pan on file change
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setRotate(0)
    setIsPlaying(true)
  }, [entry.fullPath])

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setZoom(z => {
      const next = Math.min(Math.max(1, z + delta * z), 6)
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }

  // Drag to pan zoomed frame
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

  // Frame stepping
  const stepFrame = (frames: number) => {
    if (!videoRef.current) return
    videoRef.current.pause()
    setIsPlaying(false)
    const fps = 30
    const newTime = Math.max(0, Math.min(duration || 99999, videoRef.current.currentTime + frames / fps))
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  // Snapshot frame
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
        setTimeout(() => setSnapshotMsg(null), 2000)
      }
    } catch {
      // non-fatal
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') {
        if (isVid && !isPlaying) stepFrame(-1)
        else goPrev()
      } else if (e.key === 'ArrowRight') {
        if (isVid && !isPlaying) stepFrame(1)
        else goNext()
      } else if (e.key === ' ' && isVid) {
        e.preventDefault()
        if (isPlaying) {
          videoRef.current?.pause()
          setIsPlaying(false)
        } else {
          videoRef.current?.play()
          setIsPlaying(true)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPlaying, isVid, duration, currentIdx, mediaEntries])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col select-none"
      onClick={onClose}
    >
      {/* Top Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-[#11131a]/80 border-b border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white max-w-md truncate">{entry.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
            {formatSize(entry.size)}
          </span>
          {isVid && duration > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimelapse(duration)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Level HUD */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
            <button
              onClick={() => setZoom(z => Math.max(1, z - 0.25))}
              className="p-1 hover:bg-white/10 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-semibold text-indigo-300 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(6, z + 0.25))}
              className="p-1 hover:bg-white/10 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoom > 1 && (
              <button
                onClick={() => {
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
                className="text-[11px] text-amber-400 font-semibold px-1.5 py-0.5 hover:bg-white/10 rounded"
              >
                Fit
              </button>
            )}
          </div>

          {/* Photo Rotate */}
          {isImg && (
            <button
              onClick={() => setRotate(r => (r + 90) % 360)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          {/* Video Snapshot */}
          {isVid && (
            <button
              onClick={captureFrame}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg"
              title="Capture High-Res Frame"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Snapshot</span>
            </button>
          )}

          {snapshotMsg && <span className="text-xs text-emerald-400 font-semibold">{snapshotMsg}</span>}

          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Media Viewport */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={e => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Navigation Arrows */}
        {currentIdx > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all hover:scale-110 shadow-2xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {currentIdx < mediaEntries.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-4 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all hover:scale-110 shadow-2xl"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {isImg ? (
          <img
            src={mediaUrl}
            alt={entry.name}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotate}deg)`,
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              transition: isDragging ? 'none' : 'transform 0.12s ease-out'
            }}
            className="max-h-[85vh] max-w-[90vw] object-contain select-none"
            draggable={false}
          />
        ) : isVid ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transition: isDragging ? 'none' : 'transform 0.12s ease-out'
              }}
              className="max-h-[82vh] max-w-[90vw] object-contain select-none shadow-2xl rounded-lg"
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
        ) : null}
      </div>

      {/* Video Controls Bar */}
      {isVid && (
        <div
          className="px-6 py-3 bg-[#11131a]/90 border-t border-white/10 flex items-center gap-4"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (isPlaying) {
                videoRef.current?.pause()
                setIsPlaying(false)
              } else {
                videoRef.current?.play()
                setIsPlaying(true)
              }
            }}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <span className="text-xs font-mono text-gray-300 w-24">
            {formatTimelapse(currentTime)} / {formatTimelapse(duration)}
          </span>

          {/* Frame Stepping */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => stepFrame(-1)}
              className="px-2 py-1 text-xs text-gray-300 hover:bg-white/10 rounded"
              title="Step -1 Frame (Left arrow)"
            >
              ⏮ -1f
            </button>
            <button
              onClick={() => stepFrame(1)}
              className="px-2 py-1 text-xs text-gray-300 hover:bg-white/10 rounded"
              title="Step +1 Frame (Right arrow)"
            >
              +1f ⏭
            </button>
          </div>

          {/* Seek Track */}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime}
            onChange={e => {
              const val = parseFloat(e.target.value)
              if (videoRef.current) {
                videoRef.current.currentTime = val
                setCurrentTime(val)
              }
            }}
            className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-white/20 rounded-lg"
          />

          <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded">
            ⏱ {formatTimelapse(duration)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Main File Manager App (macOS Finder + Windows Explorer Hybrid) ────
export default function App() {
  const [drives, setDrives] = useState<string[]>([])
  const [drivesWithSpace, setDrivesWithSpace] = useState<{ drive: string; total: number; free: number; usedPercent: number }[]>([])
  const [quickAccess, setQuickAccess] = useState<{ name: string; path: string; icon: string }[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<FsEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | 'photo' | 'video' | 'doc'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'columns' | 'gallery'>('grid')
  const [sortField, setSortField] = useState<'name' | 'date' | 'size' | 'ext'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [isQuickLookOpen, setIsQuickLookOpen] = useState(false)
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState('')
  const [activeMedia, setActiveMedia] = useState<FsEntry | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FsEntry } | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  // Selected item object
  const selectedEntry = useMemo(() => {
    return entries.find(e => e.fullPath === selected) || null
  }, [entries, selected])

  useEffect(() => {
    setPathInput(currentPath)
  }, [currentPath])

  useEffect(() => {
    api?.getDrivesWithSpace?.().then((res: any[]) => {
      if (res && res.length > 0) {
        setDrivesWithSpace(res)
        setDrives(res.map(d => d.drive))
      } else {
        api?.getDrives?.().then(setDrives)
      }
    })

    api?.getQuickAccess?.().then((qa: any[]) => {
      if (qa && qa.length > 0) {
        setQuickAccess(qa)
        const defaultFolder = qa.find(q => q.icon === 'videos' || q.icon === 'pictures' || q.icon === 'desktop') || qa[0]
        if (defaultFolder && !currentPath) {
          navigate(defaultFolder.path)
        }
      }
    })

    api?.getDeepLinkPath?.().then((p: string | null) => {
      if (p) navigate(p)
    })
    api?.onNavigate?.((p: string) => navigate(p))
  }, [])

  const navigate = useCallback(
    async (path: string) => {
      if (!path) return
      setLoading(true)
      setSearch('')
      const items = (await api?.listDir?.(path)) || []
      setEntries(items)
      setCurrentPath(path)
      setSelected(null)
      setHistory(prev => {
        const next = [...prev.slice(0, historyIdx + 1), path]
        setHistoryIdx(next.length - 1)
        return next
      })
      setLoading(false)
    },
    [historyIdx]
  )

  const goBack = () => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1]
      setHistoryIdx(h => h - 1)
      loadPath(prev)
    }
  }

  const goForward = () => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1]
      setHistoryIdx(h => h + 1)
      loadPath(next)
    }
  }

  const goUp = () => {
    if (!currentPath) return
    const clean = currentPath.replace(/\\/g, '/').replace(/\/$/, '')
    const lastSlash = clean.lastIndexOf('/')
    if (lastSlash > 0) {
      const parent = clean.substring(0, lastSlash)
      navigate(parent.endsWith(':') ? parent + '\\' : parent)
    } else if (clean.includes(':')) {
      navigate(clean.substring(0, clean.indexOf(':') + 1) + '\\')
    }
  }

  const loadPath = async (path: string) => {
    if (!path) return
    setLoading(true)
    setSearch('')
    const e = (await api?.listDir?.(path)) || []
    setEntries(e)
    setCurrentPath(path)
    setSelected(null)
    setLoading(false)
  }

  // Keyboard Shortcuts: Spacebar Quick Look & View Hotkeys
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      if (e.code === 'Space') {
        e.preventDefault()
        if (selectedEntry) setIsQuickLookOpen(prev => !prev)
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') { e.preventDefault(); setViewMode('grid') }
        else if (e.key === '2') { e.preventDefault(); setViewMode('table') }
        else if (e.key === '3') { e.preventDefault(); setViewMode('columns') }
        else if (e.key === '4') { e.preventDefault(); setViewMode('gallery') }
        else if (e.key.toLowerCase() === 'i') { e.preventDefault(); setIsInspectorOpen(prev => !prev) }
      }

      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault()
        goUp()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selectedEntry])

  const breadcrumbs = currentPath.replace(/\\/g, '/').split('/').filter(Boolean)

  const handleSortToggle = (field: 'name' | 'date' | 'size' | 'ext') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Filter & Sort entries
  const filteredEntries = useMemo(() => {
    let list = entries
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => e.name.toLowerCase().includes(q))
    }
    if (filterCategory === 'photo') {
      list = list.filter(e => e.isDir || IMG_EXTS.has(e.ext))
    } else if (filterCategory === 'video') {
      list = list.filter(e => e.isDir || VID_EXTS.has(e.ext))
    } else if (filterCategory === 'doc') {
      list = list.filter(e => e.isDir || DOC_EXTS.has(e.ext))
    }

    return [...list].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      else if (sortField === 'date') cmp = a.mtime - b.mtime
      else if (sortField === 'size') cmp = a.size - b.size
      else if (sortField === 'ext') cmp = a.ext.localeCompare(b.ext)
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [entries, search, filterCategory, sortField, sortOrder])

  const openNewFolder = () => {
    setSuggestions(suggestFolderNames(entries))
    setNewFolderName('')
    setShowNewFolder(true)
    setTimeout(() => newFolderInputRef.current?.focus(), 80)
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    await api?.createFolder?.(currentPath, newFolderName.trim())
    setShowNewFolder(false)
    loadPath(currentPath)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopyFeedback('Copied!')
    setTimeout(() => setCopyFeedback(null), 1500)
  }

  const handleEntryOpen = (e: FsEntry) => {
    if (e.isDir) {
      navigate(e.fullPath)
    } else if (IMG_EXTS.has(e.ext) || VID_EXTS.has(e.ext)) {
      setActiveMedia(e)
    } else {
      api?.openExternal?.(e.fullPath)
    }
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pathInput.trim()) navigate(pathInput.trim())
    setIsEditingPath(false)
  }

  const getQuickIcon = (icon: string) => {
    switch (icon) {
      case 'home': return <Home className="w-3.5 h-3.5 text-sky-400" />
      case 'desktop': return <Monitor className="w-3.5 h-3.5 text-indigo-400" />
      case 'downloads': return <Download className="w-3.5 h-3.5 text-emerald-400" />
      case 'pictures': return <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
      case 'videos': return <Film className="w-3.5 h-3.5 text-purple-400" />
      case 'documents': return <FileText className="w-3.5 h-3.5 text-amber-400" />
      default: return <Folder className="w-3.5 h-3.5 text-gray-400" />
    }
  }

  return (
    <div
      className="flex flex-col h-screen bg-[#0A0C10] text-gray-200 select-none overflow-hidden"
      onClick={() => setContextMenu(null)}
    >
      {/* ── Top Windows Explorer + Mac Finder Hybrid Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#13151D]">
        {/* History Nav */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={goBack}
            disabled={historyIdx <= 0}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"
            title="Back (Alt+Left)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goForward}
            disabled={historyIdx >= history.length - 1}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"
            title="Forward (Alt+Right)"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={goUp}
            disabled={!currentPath || currentPath.length <= 3}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"
            title="Up to Parent Folder (Alt+Up)"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => loadPath(currentPath)}
            className="p-1.5 rounded-lg hover:bg-white/10"
            title="Refresh (F5)"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => quickAccess.length > 0 ? navigate(quickAccess[0].path) : drives.length > 0 && navigate(drives[0])}
            className="p-1.5 rounded-lg hover:bg-white/10"
            title="Home"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Windows Explorer Address Bar + Editable Path */}
        <div className="flex-1 flex items-center bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 shadow-inner overflow-hidden">
          {isEditingPath ? (
            <form onSubmit={handlePathSubmit} className="flex items-center w-full gap-2">
              <input
                type="text"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-xs text-white outline-none font-mono"
                placeholder="Type or paste path..."
              />
              <button type="submit" className="text-emerald-400 p-0.5"><Check className="w-4 h-4" /></button>
              <button type="button" onClick={() => setIsEditingPath(false)} className="text-gray-400 p-0.5"><X className="w-4 h-4" /></button>
            </form>
          ) : (
            <div
              className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full cursor-text"
              onClick={() => setIsEditingPath(true)}
              title="Click to edit path"
            >
              {breadcrumbs.length === 0 ? (
                <span className="text-xs text-gray-500">Select a location...</span>
              ) : (
                breadcrumbs.map((crumb, idx) => {
                  const pathUpTo = breadcrumbs.slice(0, idx + 1).join('\\')
                  const isLast = idx === breadcrumbs.length - 1
                  return (
                    <React.Fragment key={pathUpTo}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          navigate(pathUpTo.includes(':') && !pathUpTo.includes('\\') ? pathUpTo + '\\' : pathUpTo)
                        }}
                        className={`text-xs px-1.5 py-0.5 rounded hover:bg-white/10 truncate max-w-[150px] ${
                          isLast ? 'text-white font-bold' : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {crumb}
                      </button>
                      {!isLast && <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
                    </React.Fragment>
                  )
                })
              )}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setIsEditingPath(true)
                }}
                className="ml-auto text-gray-500 hover:text-gray-300 p-1"
                title="Edit path"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-44 lg:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-white"
          />
        </div>

        {/* ── macOS Finder 4-Mode View Switcher ── */}
        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            title="Icons / Grid View (Ctrl+1)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            title="List / Details View (Ctrl+2)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('columns')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'columns' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            title="Columns View (macOS Miller Columns - Ctrl+3)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('gallery')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'gallery' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            title="Gallery View (Filmstrip Stage - Ctrl+4)"
          >
            <SquareCode className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-2 py-1 gap-1 text-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
          <select
            value={sortField}
            onChange={e => handleSortToggle(e.target.value as any)}
            className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer"
          >
            <option value="name" className="bg-[#141620]">Name</option>
            <option value="date" className="bg-[#141620]">Date</option>
            <option value="size" className="bg-[#141620]">Size</option>
            <option value="ext" className="bg-[#141620]">Type</option>
          </select>
          <span className="text-[10px] text-indigo-400 font-bold uppercase">{sortOrder}</span>
        </div>

        {/* Inspector Toggle */}
        <button
          onClick={() => setIsInspectorOpen(prev => !prev)}
          className={`p-1.5 rounded-xl border transition-all ${
            isInspectorOpen ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
          }`}
          title="Toggle Inspector / Details Pane (Alt+P or Ctrl+I)"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* New Folder */}
        <button
          onClick={openNewFolder}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-xs font-semibold shadow-md"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Folder</span>
        </button>
        {copyFeedback && <span className="text-emerald-400 text-xs font-semibold">{copyFeedback}</span>}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Left Sidebar (macOS Traffic Lights + Favorites + Windows Drive Bars) ── */}
        <div className="w-64 flex-shrink-0 border-r border-white/10 bg-[#0e1017] overflow-y-auto flex flex-col p-3">
          {/* macOS Traffic Lights Header */}
          <div className="flex items-center gap-2 px-2 pt-1 pb-3 border-b border-white/5 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] cursor-pointer" />
            </div>
            <span className="text-[11px] font-bold text-gray-400 tracking-wider ml-2 uppercase">
              Finder & Explorer
            </span>
          </div>

          {/* Section 1: Favorites (macOS / Windows Quick Access) */}
          {quickAccess.length > 0 && (
            <>
              <div className="px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Favorites
              </div>
              <div className="space-y-0.5 mb-4">
                {quickAccess.map(qa => {
                  const active = currentPath.toLowerCase() === qa.path.toLowerCase()
                  return (
                    <button
                      key={qa.path}
                      onClick={() => navigate(qa.path)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        active ? 'bg-indigo-600 text-white shadow-md font-semibold' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {getQuickIcon(qa.icon)}
                      <span className="truncate">{qa.name}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Section 2: Locations & Drives (Windows Explorer Storage Bars) */}
          <div className="px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Locations
          </div>
          <div className="space-y-1.5 mb-4">
            {(drivesWithSpace.length > 0 ? drivesWithSpace : drives.map(d => ({ drive: d, total: 0, free: 0, usedPercent: 0 }))).map(d => {
              const active = currentPath.toLowerCase().startsWith(d.drive.toLowerCase())
              return (
                <button
                  key={d.drive}
                  onClick={() => navigate(d.drive)}
                  className={`w-full flex flex-col p-2 rounded-xl text-xs transition-all ${
                    active
                      ? 'bg-indigo-600/15 border border-indigo-500/40 text-indigo-200'
                      : 'border border-white/5 bg-white/[0.02] text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <HardDrive className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-gray-400'}`} />
                      <span className="text-gray-200">Local Disk ({d.drive.replace(/\\/g, '')})</span>
                    </div>
                    {d.total > 0 && <span className="text-[10px] text-gray-500 font-mono">{d.usedPercent}%</span>}
                  </div>
                  {d.total > 0 && (
                    <div className="w-full">
                      <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${d.usedPercent > 90 ? 'bg-rose-500' : d.usedPercent > 75 ? 'bg-amber-400' : 'bg-indigo-500'}`}
                          style={{ width: `${d.usedPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>{formatSize(d.free)} free</span>
                        <span>{formatSize(d.total)}</span>
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Section 3: Smart Media Categories */}
          <div className="px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Categories
          </div>
          <div className="space-y-0.5 mb-4">
            <button
              onClick={() => setFilterCategory('all')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${filterCategory === 'all' ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Folder className="w-3.5 h-3.5 text-indigo-400" />
              <span>All Files</span>
            </button>
            <button
              onClick={() => setFilterCategory('photo')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${filterCategory === 'photo' ? 'bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Photos</span>
            </button>
            <button
              onClick={() => setFilterCategory('video')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${filterCategory === 'video' ? 'bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Film className="w-3.5 h-3.5 text-purple-400" />
              <span>Videos</span>
            </button>
          </div>

          {/* Subfolders Quick Nav */}
          <div className="px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Folders
          </div>
          <div className="space-y-0.5 overflow-y-auto max-h-40">
            {entries.filter(e => e.isDir).map(e => (
              <button
                key={e.fullPath}
                onClick={() => navigate(e.fullPath)}
                className="w-full flex items-center gap-2 px-2.5 py-1 text-xs hover:bg-white/5 text-gray-400 hover:text-gray-200 truncate"
              >
                <Folder className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
                <span className="truncate">{e.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Content Area ── */}
        <div className="flex-1 overflow-auto bg-[#0d0f15] p-3">
          {!currentPath ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <HardDrive className="w-16 h-16 mb-4 opacity-30" />
              <p>Select a drive or location to browse files</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading assets...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-sm">No items in this folder</p>
            </div>
          ) : viewMode === 'grid' ? (
            /* 1. Icons / Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredEntries.map(e => (
                <MediaThumbnailCard
                  key={e.fullPath}
                  entry={e}
                  onClick={() => setSelected(e.fullPath)}
                  onDoubleClick={() => handleEntryOpen(e)}
                />
              ))}
            </div>
          ) : viewMode === 'table' ? (
            /* 2. List / Details View */
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase border-b border-white/10">
                  <th className="text-left py-2 px-3 font-semibold cursor-pointer hover:text-white" onClick={() => handleSortToggle('name')}>Name</th>
                  <th className="text-left py-2 px-3 font-semibold w-24 cursor-pointer hover:text-white" onClick={() => handleSortToggle('ext')}>Type</th>
                  <th className="text-right py-2 px-3 font-semibold w-28 cursor-pointer hover:text-white" onClick={() => handleSortToggle('size')}>Size</th>
                  <th className="text-right py-2 px-3 font-semibold w-44 cursor-pointer hover:text-white" onClick={() => handleSortToggle('date')}>Modified</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(e => (
                  <tr
                    key={e.fullPath}
                    onClick={() => setSelected(e.fullPath)}
                    onDoubleClick={() => handleEntryOpen(e)}
                    onContextMenu={ev => {
                      ev.preventDefault()
                      ev.stopPropagation()
                      setContextMenu({ x: ev.clientX, y: ev.clientY, entry: e })
                    }}
                    className={`cursor-pointer hover:bg-white/5 rounded-lg transition-colors ${selected === e.fullPath ? 'bg-indigo-600/20 text-indigo-200' : ''}`}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        {e.isDir ? (
                          <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        ) : IMG_EXTS.has(e.ext) ? (
                          <ImageIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : VID_EXTS.has(e.ext) ? (
                          <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[400px] font-medium">{e.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs uppercase text-gray-400">{e.isDir ? 'Folder' : e.ext}</td>
                    <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums">{e.isDir ? '—' : formatSize(e.size)}</td>
                    <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums">{formatDate(e.mtime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : viewMode === 'columns' ? (
            /* 3. macOS Miller Columns View */
            <div className="flex h-full overflow-x-auto gap-2">
              <div className="w-64 min-w-[240px] border border-white/10 rounded-xl bg-[#12141c] overflow-y-auto p-1">
                {filteredEntries.map(e => (
                  <button
                    key={e.fullPath}
                    onClick={() => setSelected(e.fullPath)}
                    onDoubleClick={() => handleEntryOpen(e)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      selected === e.fullPath ? 'bg-indigo-600 text-white font-medium' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {e.isDir ? <Folder className="w-3.5 h-3.5 text-amber-400" /> : <File className="w-3.5 h-3.5 text-gray-400" />}
                      <span className="truncate">{e.name}</span>
                    </div>
                    {e.isDir && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* 4. macOS Gallery View (Stage + Filmstrip) */
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center relative p-4 mb-3 border border-white/10">
                {selectedEntry ? (
                  IMG_EXTS.has(selectedEntry.ext) ? (
                    <img
                      src={api?.toLocalResourceUrl ? api.toLocalResourceUrl(selectedEntry.fullPath) : selectedEntry.fullPath}
                      alt={selectedEntry.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : VID_EXTS.has(selectedEntry.ext) ? (
                    <video
                      src={api?.toLocalResourceUrl ? api.toLocalResourceUrl(selectedEntry.fullPath) : selectedEntry.fullPath}
                      autoPlay
                      controls
                      loop
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      <File className="w-16 h-16 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-semibold">{selectedEntry.name}</p>
                    </div>
                  )
                ) : (
                  <p className="text-gray-500 text-sm">Select an item below to view</p>
                )}
              </div>
              <div className="h-24 overflow-x-auto flex items-center gap-2 px-1">
                {filteredEntries.map(e => (
                  <div
                    key={e.fullPath}
                    onClick={() => setSelected(e.fullPath)}
                    onDoubleClick={() => handleEntryOpen(e)}
                    className={`h-20 aspect-video rounded-lg overflow-hidden cursor-pointer flex-shrink-0 border transition-all ${
                      selected === e.fullPath ? 'border-indigo-500 scale-105 shadow-lg' : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <MediaThumbnailCard entry={e} onClick={() => setSelected(e.fullPath)} onDoubleClick={() => handleEntryOpen(e)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Collapsible Right Inspector / Details Pane (Windows & Mac Info) ── */}
        {isInspectorOpen && (
          <div className="w-72 flex-shrink-0 border-l border-white/10 bg-[#0e1017] flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Details & Preview</span>
              <button onClick={() => setIsInspectorOpen(false)} className="text-gray-400 hover:text-white p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            {selectedEntry ? (
              <div className="space-y-4">
                <div className="aspect-video bg-black/60 rounded-xl overflow-hidden flex items-center justify-center border border-white/10">
                  {IMG_EXTS.has(selectedEntry.ext) ? (
                    <img src={api?.toLocalResourceUrl ? api.toLocalResourceUrl(selectedEntry.fullPath) : selectedEntry.fullPath} className="w-full h-full object-contain" />
                  ) : (
                    <File className="w-12 h-12 text-indigo-400 opacity-60" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Name</span>
                  <p className="text-xs font-semibold text-white break-words mt-0.5">{selectedEntry.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Size</span>
                    <p className="font-mono text-gray-200 mt-0.5">{selectedEntry.isDir ? '—' : formatSize(selectedEntry.size)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Type</span>
                    <p className="uppercase text-gray-200 mt-0.5">{selectedEntry.ext || 'Folder'}</p>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Modified</span>
                  <p className="text-xs font-mono text-gray-300 mt-0.5">{formatDate(selectedEntry.mtime)}</p>
                </div>
                <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                  <button
                    onClick={() => handleEntryOpen(selectedEntry)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Open Media</span>
                  </button>
                  <button
                    onClick={() => api?.openInExplorer?.(selectedEntry.fullPath)}
                    className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Show in Explorer</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-xs">
                <File className="w-8 h-8 mb-2 opacity-30" />
                <span>Select a file to inspect</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10 bg-[#12141c] text-[11px] text-gray-500">
        <span>{filteredEntries.length} items</span>
        {selected && <span className="truncate max-w-[500px] text-gray-300">{selected}</span>}
      </div>

      {/* ── macOS Spacebar Quick Look Modal ── */}
      {isQuickLookOpen && selectedEntry && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-6 select-none"
          onClick={() => setIsQuickLookOpen(false)}
        >
          <div
            className="bg-[#141622]/95 border border-white/15 rounded-2xl max-w-4xl max-h-[85vh] w-full flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#181b2a]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56] cursor-pointer" onClick={() => setIsQuickLookOpen(false)} />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                <span className="text-xs font-semibold text-gray-300 ml-2 truncate max-w-md">{selectedEntry.name} — Quick Look</span>
              </div>
              <button onClick={() => setIsQuickLookOpen(false)} className="text-gray-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center p-3 min-h-[400px] max-h-[60vh] overflow-hidden">
              {IMG_EXTS.has(selectedEntry.ext) ? (
                <img src={api?.toLocalResourceUrl ? api.toLocalResourceUrl(selectedEntry.fullPath) : selectedEntry.fullPath} alt={selectedEntry.name} className="max-h-full max-w-full object-contain" />
              ) : VID_EXTS.has(selectedEntry.ext) ? (
                <video src={api?.toLocalResourceUrl ? api.toLocalResourceUrl(selectedEntry.fullPath) : selectedEntry.fullPath} autoPlay controls loop className="max-h-full max-w-full object-contain" />
              ) : (
                <File className="w-16 h-16 text-gray-500" />
              )}
            </div>
            <div className="px-5 py-3 border-t border-white/10 bg-[#161826] flex items-center justify-between text-xs text-gray-400">
              <span>{formatSize(selectedEntry.size)} — {formatDate(selectedEntry.mtime)}</span>
              <span>Press Space or Esc to dismiss</span>
            </div>
          </div>
        </div>
      )}

      {/* Media Viewer Modal */}
      {activeMedia && (
        <MediaViewerModal
          entry={activeMedia}
          entries={entries}
          onClose={() => setActiveMedia(null)}
          onNavigateFile={e => setActiveMedia(e)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#1e2029] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.entry.isDir ? (
            <button
              onClick={() => {
                navigate(contextMenu.entry.fullPath)
                setContextMenu(null)
              }}
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-white/10 text-sm"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              Open
            </button>
          ) : (
            <button
              onClick={() => {
                handleEntryOpen(contextMenu.entry)
                setContextMenu(null)
              }}
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-white/10 text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              View / Open
            </button>
          )}
          <button
            onClick={() => {
              api?.openInExplorer?.(contextMenu.entry.fullPath)
              setContextMenu(null)
            }}
            className="flex items-center gap-2 px-3 py-2 w-full hover:bg-white/10 text-sm"
          >
            <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
            Show in Explorer
          </button>
          <button
            onClick={() => {
              copyToClipboard(contextMenu.entry.fullPath)
              setContextMenu(null)
            }}
            className="flex items-center gap-2 px-3 py-2 w-full hover:bg-white/10 text-sm"
          >
            <Copy className="w-3.5 h-3.5 text-gray-400" />
            Copy Path
          </button>
        </div>
      )}

      {/* New Folder modal */}
      {showNewFolder && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
          onClick={() => setShowNewFolder(false)}
        >
          <div
            className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-[440px] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-4">New Folder</h3>
            <input
              ref={newFolderInputRef}
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createFolder()
                if (e.key === 'Escape') setShowNewFolder(false)
              }}
              placeholder="Folder name..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 mb-3"
            />
            {suggestions.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] text-gray-500 mb-1.5">Recommended names:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => setNewFolderName(s)}
                      className="px-2.5 py-1 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg text-indigo-300 text-xs"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => setShowNewFolder(false)}
                className="px-4 py-2 rounded-lg text-sm hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
