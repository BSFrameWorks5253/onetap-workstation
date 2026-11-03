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
  EyeOff,
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
  ArrowUpDown,
  Sun,
  Moon,
  Settings
} from 'lucide-react'

const api = (window as any).fmApi

interface FsEntry {
  name: string
  isDir: boolean
  size: number
  mtime: number
  ext: string
  fullPath: string
  isHidden?: boolean
}

const RAW_EXTS = new Set(['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'raw', 'orf', 'rw2', 'pef', 'sr2', 'srf'])
const STANDARD_IMG_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico', 'tiff', 'tif'])
const IMG_EXTS = new Set([...STANDARD_IMG_EXTS, ...RAW_EXTS])
const VID_EXTS = new Set(['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'wmv', 'flv', 'm2ts', 'mts', 'mpg', 'mpeg', '3gp'])
const DOC_EXTS = new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'xlsx', 'csv'])

const isRawExt = (ext: string) => RAW_EXTS.has(ext.toLowerCase())
const isImgExt = (ext: string) => IMG_EXTS.has(ext.toLowerCase())
const isVidExt = (ext: string) => VID_EXTS.has(ext.toLowerCase())

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

function MacFolderIcon({ size = 64, className = '', type = 'generic' }: { size?: number; className?: string; type?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={`select-none filter drop-shadow-md ${className}`}>
      <defs>
        <linearGradient id="macFolderBackFm" x1="60" y1="18" x2="60" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#53bbf4" />
          <stop offset="100%" stopColor="#1f82e2" />
        </linearGradient>
        <linearGradient id="macFolderFrontFm" x1="60" y1="36" x2="60" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67c7ff" />
          <stop offset="35%" stopColor="#3aa8f7" />
          <stop offset="100%" stopColor="#1072de" />
        </linearGradient>
        <linearGradient id="macFolderRimFm" x1="60" y1="36" x2="60" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="macFolderPaperFm" x1="60" y1="26" x2="60" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <radialGradient id="macFolderShadowFm" cx="50%" cy="100%" r="50%">
          <stop offset="0%" stopColor="#003e8a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#003e8a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M12 28C12 23.5817 15.5817 20 20 20H46C49.5 20 52.8 22 55 25L61 32H100C104.418 32 108 35.5817 108 40V92C108 97.5228 103.523 102 98 102H22C16.4772 102 12 97.5228 12 92V28Z" fill="url(#macFolderBackFm)" />
      <rect x="22" y="27" width="76" height="24" rx="4" fill="url(#macFolderPaperFm)" opacity="0.9" />
      <path d="M10 44C10 39.5817 13.5817 36 18 36H102C106.418 36 110 39.5817 110 44V94C110 99.5228 105.523 104 100 104H20C14.4772 104 10 99.5228 10 94V44Z" fill="url(#macFolderFrontFm)" />
      <path d="M10 44C10 39.5817 13.5817 36 18 36H102C106.418 36 110 39.5817 110 44V48H10V44Z" fill="url(#macFolderRimFm)" />
      <path d="M12 46C12 43 14 41 18 41H102C106 41 108 43 108 46" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.4" strokeLinecap="round" />
      <rect x="10" y="80" width="100" height="24" rx="10" fill="url(#macFolderShadowFm)" />
    </svg>
  )
}

function MacDocumentIcon({ ext = '', size = 64, className = '' }: { ext?: string; size?: number; className?: string }) {
  const cleanExt = (ext || '').toLowerCase().replace('.', '')
  let badgeBg = '#64748b'
  let badgeLabel = cleanExt.toUpperCase() || 'FILE'
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'html', 'css', 'py'].includes(cleanExt)) {
    badgeBg = '#0071e3'
  } else if (['xlsx', 'xls', 'csv'].includes(cleanExt)) {
    badgeBg = '#10b981'
    badgeLabel = 'XLS'
  } else if (['pptx', 'ppt'].includes(cleanExt)) {
    badgeBg = '#f59e0b'
    badgeLabel = 'PPT'
  } else if (['docx', 'doc', 'txt', 'md'].includes(cleanExt)) {
    badgeBg = '#3b82f6'
  } else if (cleanExt === 'pdf') {
    badgeBg = '#ef4444'
    badgeLabel = 'PDF'
  } else if (['zip', 'rar', '7z'].includes(cleanExt)) {
    badgeBg = '#8b5cf6'
    badgeLabel = 'ZIP'
  }
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={`select-none filter drop-shadow-md ${className}`}>
      <defs>
        <linearGradient id="macDocFaceFm" x1="60" y1="12" x2="60" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
        <linearGradient id="macFoldFlapFm" x1="94" y1="14" x2="82" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      <path d="M26 20C26 15.5817 29.5817 12 34 12H76L98 34V100C98 104.418 94.4183 108 90 108H34C29.5817 108 26 104.418 26 100V20Z" fill="url(#macDocFaceFm)" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M74 12V32C74 34 76 36 78 36H98" fill="none" stroke="#94a3b8" strokeWidth="1.2" opacity="0.5" />
      <path d="M76 12L98 34H80C77.7909 34 76 32.2091 76 30V12Z" fill="url(#macFoldFlapFm)" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="36" y="58" width="48" height="22" rx="5" fill={badgeBg} />
      <text x="60" y="73" fill="#ffffff" fontSize="10" fontWeight="800" fontFamily="sans-serif" textAnchor="middle" letterSpacing="0.5">
        {badgeLabel}
      </text>
    </svg>
  )
}

// ── Smart Video & Photo Thumbnail Component ───────────────────
const videoThumbCache = new Map<string, { thumb: string; duration: number }>()

function RawOrImgPreview({ entry, className }: { entry: FsEntry; className?: string }) {
  const isRaw = isRawExt(entry.ext)
  const [src, setSrc] = useState<string>(() => {
    if (isRaw) return videoThumbCache.get(entry.fullPath)?.thumb || ''
    return api?.toLocalResourceUrl ? api.toLocalResourceUrl(entry.fullPath) : entry.fullPath
  })

  useEffect(() => {
    if (!isRaw) {
      setSrc(api?.toLocalResourceUrl ? api.toLocalResourceUrl(entry.fullPath) : entry.fullPath)
      return
    }
    const cached = videoThumbCache.get(entry.fullPath)?.thumb
    if (cached) setSrc(cached)

    let isCancelled = false
    if ((api as any)?.readImageBase64) {
      (api as any).readImageBase64(entry.fullPath).then((res: any) => {
        if (!isCancelled && res?.ok && res.dataUrl) setSrc(res.dataUrl)
      })
    }
    return () => { isCancelled = true }
  }, [entry.fullPath, isRaw])

  if (!src && isRaw) {
    return (
      <div className="flex flex-col items-center justify-center text-rose-400">
        <ImageIcon className="w-10 h-10 opacity-60 animate-pulse" />
        <span className="text-[10px] font-bold text-rose-300 mt-1 uppercase">RAW Preview</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={entry.name}
      onError={() => {
        if ((api as any)?.readImageBase64) {
          (api as any).readImageBase64(entry.fullPath).then((res: any) => {
            if (res?.ok && res.dataUrl) setSrc(res.dataUrl)
          })
        }
      }}
      className={className || 'w-full h-full object-contain'}
    />
  )
}

function FmVideoDuration({ entry }: { entry: FsEntry }) {
  const isVid = isVidExt(entry.ext)
  const cached = videoThumbCache.get(entry.fullPath)
  const [duration, setDuration] = useState<number>(cached?.duration || 0)

  useEffect(() => {
    if (!isVid) return
    const c = videoThumbCache.get(entry.fullPath)
    if (c && c.duration > 0) {
      setDuration(c.duration)
      return
    }
    let isCancelled = false
    if ((api as any)?.getVideoMetadata) {
      (api as any).getVideoMetadata(entry.fullPath).then((res: any) => {
        if (!isCancelled && res && res.duration > 0) {
          setDuration(res.duration)
          videoThumbCache.set(entry.fullPath, { thumb: res.thumb || '', duration: res.duration })
        }
      })
    }
    return () => {
      isCancelled = true
    }
  }, [entry.fullPath, isVid])

  if (!isVid) return <span className="text-gray-600">—</span>
  if (duration > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold">
        <Clock className="w-3 h-3 text-amber-400" />
        {formatTimelapse(duration)}
      </span>
    )
  }
  return <span className="text-[11px] text-gray-500 font-mono">...</span>
}

function MediaThumbnailCard({
  entry,
  onClick,
  onDoubleClick
}: {
  entry: FsEntry
  onClick: () => void
  onDoubleClick: () => void
}) {
  const isRaw = isRawExt(entry.ext)
  const isVid = isVidExt(entry.ext)
  const isDirectImg = isImgExt(entry.ext) && !isRaw

  const [thumb, setThumb] = useState<string | null>(() => videoThumbCache.get(entry.fullPath)?.thumb || null)
  const [duration, setDuration] = useState<number>(() => videoThumbCache.get(entry.fullPath)?.duration || 0)
  const [loadingMeta, setLoadingMeta] = useState<boolean>(!videoThumbCache.get(entry.fullPath) && !isDirectImg)

  useEffect(() => {
    if (isDirectImg) return
    const cached = videoThumbCache.get(entry.fullPath)
    if (cached && cached.thumb) {
      setThumb(cached.thumb)
      setDuration(cached.duration)
      setLoadingMeta(false)
      return
    }

    let isCancelled = false
    setLoadingMeta(true)

    // Universal thumbnail extraction via IPC (Videos, RAW, Audio, PDFs, and Windows Shell icons for all other files)
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
        if (isVid) runDomFallback()
        else setLoadingMeta(false)
      }).catch(() => {
        if (!isCancelled) {
          if (isVid) runDomFallback()
          else setLoadingMeta(false)
        }
      })
    } else {
      if (isVid) runDomFallback()
      else setLoadingMeta(false)
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
  }, [entry.fullPath, isDirectImg, isVid, entry.isDir])

  const imgUrl = isDirectImg ? (api?.toLocalResourceUrl ? api.toLocalResourceUrl(entry.fullPath) : entry.fullPath) : null

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`group relative flex flex-col bg-[#161922] hover:bg-[#1d212c] border border-white/10 hover:border-indigo-500/50 rounded-xl overflow-hidden cursor-pointer transition-all shadow-md hover:shadow-indigo-500/10 ${
        entry.isHidden ? 'opacity-55 hover:opacity-100 border-dashed border-gray-500/40' : ''
      }`}
    >
      {/* Thumbnail viewport */}
      <div className="relative aspect-video w-full bg-black/40 flex items-center justify-center overflow-hidden">
        {isRaw ? (
          thumb ? (
            <img
              src={thumb}
              alt={entry.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-rose-400">
              <ImageIcon className="w-8 h-8 opacity-60 animate-pulse" />
              <span className="text-[10px] font-bold text-rose-300 mt-1 uppercase">RAW</span>
            </div>
          )
        ) : isDirectImg ? (
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
        ) : thumb ? (
          /* Universal Windows Shell Icon for all other files & folders (Shortcuts, Batch, Excel, Zip, TypeScript, Documents, Folders) */
          <div className="w-full h-full flex items-center justify-center p-3">
            <img
              src={thumb}
              alt={entry.name}
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain filter drop-shadow-md transition-transform duration-200 group-hover:scale-110"
            />
          </div>
        ) : entry.isDir ? (
          <MacFolderIcon size={76} />
        ) : (
          <MacDocumentIcon size={68} ext={entry.ext} />
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
  const isVid = isVidExt(entry.ext)
  const isRaw = isRawExt(entry.ext)
  const isImg = isImgExt(entry.ext)
  const mediaUrl = api?.toLocalResourceUrl ? api.toLocalResourceUrl(entry.fullPath) : entry.fullPath

  const [rawPhotoUrl, setRawPhotoUrl] = useState<string | null>(() => {
    return isRaw ? (videoThumbCache.get(entry.fullPath)?.thumb || null) : null
  })

  useEffect(() => {
    if (!isRaw) {
      setRawPhotoUrl(null)
      return
    }
    const cached = videoThumbCache.get(entry.fullPath)?.thumb
    if (cached) setRawPhotoUrl(cached)

    let isCancelled = false
    if ((api as any)?.readImageBase64) {
      (api as any).readImageBase64(entry.fullPath).then((res: any) => {
        if (!isCancelled && res?.ok && res.dataUrl) {
          setRawPhotoUrl(res.dataUrl)
        }
      })
    }
    return () => { isCancelled = true }
  }, [entry.fullPath, isRaw])

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
            src={isRaw ? (rawPhotoUrl || '') : mediaUrl}
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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('fm-theme') as 'dark' | 'light') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode')
      document.documentElement.classList.remove('dark-mode')
    } else {
      document.documentElement.classList.add('dark-mode')
      document.documentElement.classList.remove('light-mode')
    }
    localStorage.setItem('fm-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }
  const [pathInput, setPathInput] = useState('')
  const [activeMedia, setActiveMedia] = useState<FsEntry | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FsEntry } | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  const [showHidden, setShowHidden] = useState<boolean>(() => {
    return localStorage.getItem('fm-show-hidden') === 'true'
  })

  const toggleShowHidden = () => {
    setShowHidden(prev => {
      const next = !prev
      localStorage.setItem('fm-show-hidden', String(next))
      return next
    })
  }

  // Resizable panel & column widths
  const [columnsWidth, setColumnsWidth] = useState(340)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [inspectorWidth, setInspectorWidth] = useState(300)
  const [tableColWidths, setTableColWidths] = useState({
    name: 400,
    type: 85,
    duration: 115,
    size: 100,
    date: 160
  })

  const startColWidthResize = (colKey: keyof typeof tableColWidths, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = tableColWidths[colKey]
    const onMouseMove = (ev: MouseEvent) => {
      const minW = colKey === 'name' ? 180 : 70
      setTableColWidths(prev => ({ ...prev, [colKey]: Math.max(minW, startW + (ev.clientX - startX)) }))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const startMillerColResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = columnsWidth
    const onMouseMove = (ev: MouseEvent) => {
      setColumnsWidth(Math.max(220, Math.min(700, startW + (ev.clientX - startX))))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    const onMouseMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.max(180, Math.min(450, startW + (ev.clientX - startX))))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const startInspectorResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = inspectorWidth
    const onMouseMove = (ev: MouseEvent) => {
      setInspectorWidth(Math.max(220, Math.min(550, startW - (ev.clientX - startX))))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

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

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '.' || e.key === '>')) {
        e.preventDefault()
        toggleShowHidden()
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
    if (!showHidden) {
      list = list.filter(e => !e.isHidden)
    }
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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-3 h-8 text-xs text-[var(--mac-text-primary)] placeholder-gray-400 outline-none focus:border-[var(--mac-accent)] transition-all"
          />
        </div>

        {/* ── Native macOS Segmented View Control ── */}
        <div className="flex items-center bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 p-0.5 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded-md transition-all ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 hover:text-[var(--mac-text-primary)]'
            }`}
            title="Icons / Grid (Ctrl+1)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1 rounded-md transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 hover:text-[var(--mac-text-primary)]'
            }`}
            title="List / Details (Ctrl+2)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('columns')}
            className={`p-1 rounded-md transition-all ${
              viewMode === 'columns'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 hover:text-[var(--mac-text-primary)]'
            }`}
            title="Columns (Ctrl+3)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('gallery')}
            className={`p-1 rounded-md transition-all ${
              viewMode === 'gallery'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 hover:text-[var(--mac-text-primary)]'
            }`}
            title="Gallery (Ctrl+4)"
          >
            <SquareCode className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg px-2 h-8 gap-1 text-xs">
          <ArrowUpDown className="w-3 h-3 text-gray-400" />
          <select
            value={sortField}
            onChange={e => handleSortToggle(e.target.value as any)}
            className="bg-transparent text-xs text-[var(--mac-text-primary)] outline-none cursor-pointer"
          >
            <option value="name" className="bg-[#141620]">Name</option>
            <option value="date" className="bg-[#141620]">Date</option>
            <option value="size" className="bg-[#141620]">Size</option>
            <option value="ext" className="bg-[#141620]">Type</option>
          </select>
          <span className="text-[10px] text-gray-400 font-mono uppercase">{sortOrder}</span>
        </div>

        {/* Inspector Toggle */}
        <button
          onClick={() => setIsInspectorOpen(prev => !prev)}
          className={`p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${
            isInspectorOpen
              ? 'bg-black/10 dark:bg-white/15 border-black/15 dark:border-white/20 text-[var(--mac-text-primary)] shadow-sm'
              : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-gray-400 hover:text-[var(--mac-text-primary)]'
          }`}
          title="Toggle Inspector (Alt+P or Ctrl+I)"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>

        {/* Toggle Hidden Items */}
        <button
          onClick={toggleShowHidden}
          className={`p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${
            showHidden
              ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
              : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-gray-400 hover:text-[var(--mac-text-primary)] hover:bg-black/10 dark:hover:bg-white/10'
          }`}
          title={showHidden ? 'Hide Hidden Items (Ctrl+Shift+.)' : 'Show Hidden Items (Ctrl+Shift+.)'}
        >
          {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>

        {/* macOS Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-gray-400 hover:text-[var(--mac-text-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-slate-700" />
          )}
        </button>

        {/* New Folder */}
        <button
          onClick={openNewFolder}
          className="flex items-center gap-1.5 px-2.5 h-8 bg-black/5 dark:bg-white/[0.08] hover:bg-black/10 dark:hover:bg-white/15 text-[var(--mac-text-primary)] border border-black/10 dark:border-white/10 rounded-lg text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
        {copyFeedback && <span className="text-emerald-500 text-xs font-semibold">{copyFeedback}</span>}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Left Sidebar (macOS Traffic Lights + Favorites + Windows Drive Bars) with Resizable Width ── */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="flex-shrink-0 border-r border-white/10 bg-[#0e1017] overflow-y-auto flex flex-col p-3 select-none"
        >
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
                <MacFolderIcon size={16} className="flex-shrink-0" />
                <span className="truncate">{e.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Resizable Divider between Sidebar and Main Content */}
        <div
          onMouseDown={startSidebarResize}
          className="w-1.5 hover:w-2 bg-transparent hover:bg-indigo-500/50 active:bg-indigo-500 cursor-col-resize z-20 flex-shrink-0 transition-colors"
          title="Drag to resize sidebar"
        />

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
            /* 2. List / Details View with Resizable Columns & Video Timelapse */
            <div className="w-full overflow-x-auto select-none">
              <table className="w-full text-sm border-collapse table-fixed">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase border-b border-white/10 bg-[#12141c]">
                    <th
                      style={{ width: `${tableColWidths.name}px` }}
                      className="relative text-left py-2.5 px-3 font-semibold cursor-pointer hover:text-white"
                      onClick={() => handleSortToggle('name')}
                    >
                      <span>Name</span>
                      <div
                        onMouseDown={e => startColWidthResize('name', e)}
                        className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                        title="Drag to resize column"
                      />
                    </th>

                    <th
                      style={{ width: `${tableColWidths.type}px` }}
                      className="relative text-left py-2.5 px-3 font-semibold cursor-pointer hover:text-white"
                      onClick={() => handleSortToggle('ext')}
                    >
                      <span>Type</span>
                      <div
                        onMouseDown={e => startColWidthResize('type', e)}
                        className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                        title="Drag to resize column"
                      />
                    </th>

                    <th
                      style={{ width: `${tableColWidths.duration}px` }}
                      className="relative text-left py-2.5 px-3 font-semibold"
                    >
                      <div className="flex items-center gap-1 text-amber-300">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Timelapse</span>
                      </div>
                      <div
                        onMouseDown={e => startColWidthResize('duration', e)}
                        className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                        title="Drag to resize column"
                      />
                    </th>

                    <th
                      style={{ width: `${tableColWidths.size}px` }}
                      className="relative text-right py-2.5 px-3 font-semibold cursor-pointer hover:text-white"
                      onClick={() => handleSortToggle('size')}
                    >
                      <span>Size</span>
                      <div
                        onMouseDown={e => startColWidthResize('size', e)}
                        className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                        title="Drag to resize column"
                      />
                    </th>

                    <th
                      style={{ width: `${tableColWidths.date}px` }}
                      className="relative text-right py-2.5 px-3 font-semibold cursor-pointer hover:text-white"
                      onClick={() => handleSortToggle('date')}
                    >
                      <span>Modified</span>
                      <div
                        onMouseDown={e => startColWidthResize('date', e)}
                        className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                        title="Drag to resize column"
                      />
                    </th>

                    <th style={{ width: '60px' }} className="text-center py-2.5 px-2 font-semibold">
                      <span>Preview</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map(e => {
                    const isRaw = isRawExt(e.ext)
                    return (
                      <tr
                        key={e.fullPath}
                        onClick={() => setSelected(e.fullPath)}
                        onDoubleClick={() => handleEntryOpen(e)}
                        onContextMenu={ev => {
                          ev.preventDefault()
                          ev.stopPropagation()
                          setContextMenu({ x: ev.clientX, y: ev.clientY, entry: e })
                        }}
                        className={`group cursor-pointer hover:bg-white/5 rounded-lg transition-colors border-b border-white/[0.03] ${selected === e.fullPath ? 'bg-indigo-600/20 text-indigo-200' : 'text-gray-300'}`}
                      >
                        <td className="py-2 px-3 truncate">
                          <div className="flex items-center gap-2.5 truncate">
                            {e.isDir ? (
                              <MacFolderIcon size={18} className="flex-shrink-0" />
                            ) : isRaw ? (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <ImageIcon className="w-4 h-4 text-rose-400" />
                                <span className="text-[9px] font-bold px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                                  RAW
                                </span>
                              </div>
                            ) : isImgExt(e.ext) ? (
                              <ImageIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            ) : isVidExt(e.ext) ? (
                              <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            ) : (
                              <MacDocumentIcon size={18} ext={e.ext} className="flex-shrink-0" />
                            )}
                            <span className="truncate font-medium" title={e.name}>
                              {e.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-xs uppercase text-gray-400 truncate">{e.isDir ? 'Folder' : e.ext}</td>
                        <td className="py-2 px-3 text-xs">
                          <FmVideoDuration entry={e} />
                        </td>
                        <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums truncate">{e.isDir ? '—' : formatSize(e.size)}</td>
                        <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums truncate">{formatDate(e.mtime)}</td>
                        <td className="py-1 px-2 text-center">
                          {!e.isDir && (
                            <button
                              onClick={ev => {
                                ev.stopPropagation()
                                setSelected(e.fullPath)
                                setIsQuickLookOpen(true)
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-600 text-gray-400 hover:text-white transition-colors"
                              title="Quick Look (Space)"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'columns' ? (
            /* 3. macOS Miller Columns View with Resizable Width */
            <div className="flex h-full overflow-x-auto gap-2">
              <div
                style={{ width: `${columnsWidth}px`, minWidth: `${columnsWidth}px` }}
                className="relative border border-white/10 rounded-xl bg-[#12141c] overflow-y-auto p-1 flex-shrink-0"
              >
                {filteredEntries.map(e => {
                  const isSelected = selected === e.fullPath
                  const isRaw = isRawExt(e.ext)
                  const isVid = isVidExt(e.ext)
                  return (
                    <div
                      key={e.fullPath}
                      onClick={() => setSelected(e.fullPath)}
                      onDoubleClick={() => handleEntryOpen(e)}
                      className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-600 text-white font-medium' : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0 mr-1.5">
                        {e.isDir ? (
                          <MacFolderIcon size={16} className="flex-shrink-0" />
                        ) : isRaw ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-[9px] font-bold px-1 rounded bg-rose-500/20 text-rose-300 uppercase">RAW</span>
                          </div>
                        ) : isImgExt(e.ext) ? (
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : isVid ? (
                          <Film className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        ) : (
                          <MacDocumentIcon size={16} ext={e.ext} className="flex-shrink-0" />
                        )}
                        <span className="truncate" title={e.name}>{e.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isVid && (
                          <FmVideoDuration entry={e} />
                        )}
                        {e.isDir ? (
                          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                        ) : (
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-gray-500'}`}>
                            {formatSize(e.size)}
                          </span>
                        )}
                        {!e.isDir && (
                          <button
                            onClick={ev => {
                              ev.stopPropagation()
                              setSelected(e.fullPath)
                              setIsQuickLookOpen(true)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition-opacity"
                            title="Quick Look (Space)"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Draggable Divider to resize column */}
                <div
                  onMouseDown={startMillerColResize}
                  className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/70 active:bg-indigo-500 z-20 transition-colors"
                  title="Drag to resize column"
                />
              </div>
            </div>
          ) : (
            /* 4. macOS Gallery View (Stage + Filmstrip) */
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center relative p-4 mb-3 border border-white/10">
                {selectedEntry ? (
                  IMG_EXTS.has(selectedEntry.ext) ? (
                    <RawOrImgPreview entry={selectedEntry} className="max-h-full max-w-full object-contain" />
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

        {/* ── Collapsible Right Inspector / Details Pane with Resizable Width ── */}
        {isInspectorOpen && (
          <>
            <div
              onMouseDown={startInspectorResize}
              className="w-1.5 hover:w-2 bg-transparent hover:bg-indigo-500/50 active:bg-indigo-500 cursor-col-resize z-20 flex-shrink-0 transition-colors"
              title="Drag to resize inspector"
            />
            <div
              style={{ width: `${inspectorWidth}px` }}
              className="flex-shrink-0 border-l border-white/10 bg-[#0e1017] flex flex-col p-4 overflow-y-auto"
            >
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
                    <RawOrImgPreview entry={selectedEntry} className="w-full h-full object-contain" />
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
          </>
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
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-6 select-none"
          onClick={() => setIsQuickLookOpen(false)}
        >
          <div
            className="bg-[#141622]/95 border border-white/15 rounded-2xl max-w-4xl max-h-[85vh] w-full flex flex-col shadow-2xl overflow-hidden backdrop-blur-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#181b2a]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56] cursor-pointer" onClick={() => setIsQuickLookOpen(false)} title="Close (Space or Esc)" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f] cursor-pointer" onClick={() => { setIsQuickLookOpen(false); handleEntryOpen(selectedEntry); }} title="Open Fullscreen Studio" />
                <span className="text-xs font-semibold text-gray-200 ml-2 truncate max-w-md">{selectedEntry.name}</span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Quick Look
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Prev / Next buttons */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
                  <button
                    onClick={() => {
                      const idx = filteredEntries.findIndex(e => e.fullPath === selectedEntry.fullPath)
                      if (idx > 0) setSelected(filteredEntries[idx - 1].fullPath)
                    }}
                    className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                    title="Previous (Left Arrow)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const idx = filteredEntries.findIndex(e => e.fullPath === selectedEntry.fullPath)
                      if (idx < filteredEntries.length - 1) setSelected(filteredEntries[idx + 1].fullPath)
                    }}
                    className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                    title="Next (Right Arrow)"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setIsQuickLookOpen(false)
                    handleEntryOpen(selectedEntry)
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Studio</span>
                </button>

                <button onClick={() => setIsQuickLookOpen(false)} className="text-gray-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center p-3 min-h-[400px] max-h-[60vh] overflow-hidden">
              {IMG_EXTS.has(selectedEntry.ext) ? (
                <RawOrImgPreview entry={selectedEntry} className="max-h-full max-w-full object-contain" />
              ) : VID_EXTS.has(selectedEntry.ext) ? (
                <video src={api?.toLocalResourceUrl ? api.toLocalResourceUrl(selectedEntry.fullPath) : selectedEntry.fullPath} autoPlay controls loop className="max-h-full max-w-full object-contain" />
              ) : (
                <File className="w-16 h-16 text-gray-500" />
              )}
            </div>
            <div className="px-5 py-3 border-t border-white/10 bg-[#161826] flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-3">
                <span>Size: <strong className="text-white font-mono">{formatSize(selectedEntry.size)}</strong></span>
                <span>•</span>
                <span>Modified: <strong className="text-white font-mono">{formatDate(selectedEntry.mtime)}</strong></span>
                <span className="uppercase text-indigo-400 font-bold">{selectedEntry.ext}</span>
              </div>
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
