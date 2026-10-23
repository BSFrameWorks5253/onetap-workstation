/**
 * ============================================================
 * DATA SEARCH & VIRTUAL CATALOG (ArchiveVault.tsx)
 * Part of One Tap Workstation
 *
 * Unified Zero-Storage Offline Catalog, High-Speed Name/Event
 * Search, Drive Locator, and Smart Excel Reconciler.
 * ============================================================
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import { SkeletonTable } from '../../components/Skeleton'
import { SafarSearchSelect } from '../../components/SafarSearchSelect'
import { DateSearchSelect, ArchiveDateItem } from '../../components/DateSearchSelect'
import { EventSearchSelect } from '../../components/EventSearchSelect'
import { GenerateExcelModal } from './GenerateExcelModal'
import { extractTargetFinalVideo } from '../../utils/safarUtils'
import type { ScannedArchive, MediaItem, DriveVolume, AuditRecord, AuditSummary, AuditFolderSummary } from '../../types'
import './ArchiveVault.css'

const api: any = new Proxy({}, {
  get: (_target, prop) => {
    const live = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null
    return live ? live[prop] : undefined
  }
})

// Standard Title Adder Event Codes & Descriptions (From Event List.xlsx)
const TITLE_ADDER_EVENTS = [
  { code: '', label: 'ALL EVENTS', desc: 'All Events' },
  { code: 'AQ', label: 'AQ (Aqiqa)', desc: 'Aqiqa' },
  { code: 'BM', label: 'BM (Bethak Majlis)', desc: 'Bethak Majlis' },
  { code: 'BQ', label: 'BQ (Bethak Qadam)', desc: 'Bethak Qadam' },
  { code: 'BZ', label: 'BZ (Bethak Ziyafat)', desc: 'Bethak Ziyafat' },
  { code: 'FMB', label: 'FMB (FMB)', desc: 'FMB' },
  { code: 'H', label: 'H (Haddiyat)', desc: 'Haddiyat' },
  { code: 'ID', label: 'ID (Idaraat)', desc: 'Idaraat' },
  { code: 'IF', label: 'IF (Iftettah)', desc: 'Iftettah' },
  { code: 'IFS', label: 'IFS (Iftettah Sharaf)', desc: 'Iftettah Sharaf' },
  { code: 'IST', label: 'IST (Isteqbal)', desc: 'Isteqbal' },
  { code: 'KGS', label: 'KGS (Kg Sharaf)', desc: 'Kg Sharaf' },
  { code: 'M', label: 'M (Majlis)', desc: 'Majlis' },
  { code: 'MF', label: 'MF (Mafsuhiyat)', desc: 'Mafsuhiyat' },
  { code: 'MISBAH', label: 'Misbah (Misbah)', desc: 'Misbah' },
  { code: 'MKB', label: 'MKB (Mokib)', desc: 'Mokib' },
  { code: 'MO', label: 'MO (Madrasa)', desc: 'Madrasa' },
  { code: 'MQ', label: 'MQ (Misaq)', desc: 'Misaq' },
  { code: 'MUL', label: 'MUL (Mulaqaat)', desc: 'Mulaqaat' },
  { code: 'MYN', label: 'MYN (Miyana)', desc: 'Miyana' },
  { code: 'MZ', label: 'MZ (Majmui Ziyafat)', desc: 'Majmui Ziyafat' },
  { code: 'N', label: 'N (Nikah)', desc: 'Nikah' },
  { code: 'NAMAZ', label: 'Namaz (Namaz)', desc: 'Namaz' },
  { code: 'ONLINE', label: 'Online (Online)', desc: 'Online' },
  { code: 'Q', label: 'Q (Qadam)', desc: 'Qadam' },
  { code: 'QMZ', label: 'QMZ (Qadam Majlis Ziyafat)', desc: 'Qadam Majlis Ziyafat' },
  { code: 'SH', label: 'SH (Sharaf)', desc: 'Sharaf' },
  { code: 'SQ', label: 'SQ (Shifa Qadam)', desc: 'Shifa Qadam' },
  { code: 'TJR', label: 'TJR (Tijarat)', desc: 'Tijarat' },
  { code: 'TQ', label: 'TQ (Talaqqi)', desc: 'Talaqqi' },
  { code: 'TQN', label: 'TQN (Tahneeq)', desc: 'Tahneeq' },
  { code: 'WAAZ', label: 'Waaz (Waaz)', desc: 'Waaz' },
  { code: 'WD', label: 'WD (Wada)', desc: 'Wada' },
  { code: 'Z', label: 'Z (Ziyafat)', desc: 'Ziyafat' },
  { code: 'ZO', label: 'ZO (Zafaf Olda)', desc: 'Zafaf Olda' }
]

export default function ArchiveVault(): JSX.Element {
  const { showToast } = useToast()
  const { playTick, playSuccess, playError } = useSound()

  // ── Main View Modes ──
  // 'search' (Search File or Folder) | 'safars' (Scanned Safars List) | 'scan' (Scan Other Folder) | 'excel' | 'drives' | 'assistant'
  const [activeTab, setActiveTab] = useState<'search' | 'safars' | 'scan' | 'excel' | 'drives' | 'assistant'>('search')
  const [selectedBreakdownSafar, setSelectedBreakdownSafar] = useState<any | null>(null)
  const [isBreakdownLoading, setIsBreakdownLoading] = useState(false)
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false)

  // ── Vault Assistant Chat State ──
  interface ChatMessage {
    id: string
    sender: 'user' | 'assistant'
    text: string
    timestamp: string
    data?: any
  }
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Salam! I am your Vault Intelligence Assistant. You can ask me natural questions about your archived media, event counts, dates, and upload statuses. For example:\n• "how many Qadam were there in 1448-10-18_01M"\n• "how many nikah in karachi"\n• "show unuploaded videos in safar"',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isChatSearching, setIsChatSearching] = useState(false)

  // ── Safar Archive List & Selection ──
  const [safars, setSafars] = useState<ScannedArchive[]>([])
  const [selectedSafarId, setSelectedSafarId] = useState<number | 'all'>('all')
  const [safarSummary, setSafarSummary] = useState<any>(null)
  const [gaps, setGaps] = useState<any[]>([])

  // ── Search & Filter State ──
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [searchTarget, setSearchTarget] = useState<'all' | 'file' | 'folder'>('all')
  const [mediaType, setMediaType] = useState<string>('all')
  const [eventCode, setEventCode] = useState<string>('')
  const [isAllEventsExpanded, setIsAllEventsExpanded] = useState<boolean>(false)
  const [finalVideosOnly, setFinalVideosOnly] = useState<boolean>(false)
  const [statusSubFilter, setStatusSubFilter] = useState<'ALL' | 'uploaded' | 'submitted' | 'rendered_pending' | 'not_uploaded'>('ALL')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [totalMediaCount, setTotalMediaCount] = useState<number>(0)
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(100)
  const [isCheckingUploads, setIsCheckingUploads] = useState(false)
  const [connectivityMap, setConnectivityMap] = useState<Record<string, boolean>>({})

  // ── Excel-like Column Widths & Resizing ──
  const DEFAULT_COL_WIDTHS: Record<string, number> = {
    name: 270,
    type: 85,
    path: 250,
    usedIn: 180,
    size: 95,
    duration: 100,
    status: 160,
    drive: 140,
    actions: 140
  }

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('ot_vault_col_widths')
      if (saved) return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) }
    } catch {}
    return DEFAULT_COL_WIDTHS
  })

  // ── Excel-like Row Density ──
  const [rowDensity, setRowDensity] = useState<'compact' | 'normal' | 'spacious'>(() => {
    return (localStorage.getItem('ot_vault_row_density') as any) || 'normal'
  })

  const resizingColRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null)

  const handleColResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const currentKey = colKey
    resizingColRef.current = {
      colKey,
      startX: e.clientX,
      startWidth: colWidths[colKey] || DEFAULT_COL_WIDTHS[colKey] || 120
    }

    let rafId: number | null = null
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColRef.current) return
      const delta = moveEvent.clientX - resizingColRef.current.startX
      const newWidth = Math.max(65, resizingColRef.current.startWidth + delta)
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        setColWidths(prev => ({ ...prev, [currentKey]: newWidth }))
      })
    }

    const onMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (resizingColRef.current) {
        setColWidths(curr => {
          try {
            localStorage.setItem('ot_vault_col_widths', JSON.stringify(curr))
          } catch {}
          return curr
        })
      }
      resizingColRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleColReset = (colKey: string) => {
    playTick()
    setColWidths(prev => {
      const next = { ...prev, [colKey]: DEFAULT_COL_WIDTHS[colKey] || 120 }
      try {
        localStorage.setItem('ot_vault_col_widths', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const handleResetColWidths = () => {
    playTick()
    setColWidths(DEFAULT_COL_WIDTHS)
    try {
      localStorage.removeItem('ot_vault_col_widths')
    } catch {}
    showToast({
      title: 'Layout Reset 📐',
      message: 'Restored default Excel table column widths.',
      type: 'info'
    })
  }

  const handleRowDensityChange = (density: 'compact' | 'normal' | 'spacious') => {
    playTick()
    setRowDensity(density)
    try {
      localStorage.setItem('ot_vault_row_density', density)
    } catch {}
  }

  // ── Scanner State ──
  const [folderToScan, setFolderToScan] = useState('')
  const [driveLabel, setDriveLabel] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{
    scanned_files?: number
    total_size_bytes?: number
    total_mp4_count?: number
    current_folder?: string
  }>({})

  // ── Excel Reconciler State ──
  const [excelPath, setExcelPath] = useState('')
  const [excelAuditTargetSafar, setExcelAuditTargetSafar] = useState<number | null>(null)
  const [colDate, setColDate] = useState('Date')
  const [colFolder, setColFolder] = useState('Folder')
  const [colFile, setColFile] = useState('File')
  const [isAuditing, setIsAuditing] = useState(false)
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null)
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([])
  const [auditFolderSummary, setAuditFolderSummary] = useState<AuditFolderSummary[]>([])
  const [auditFilterStatus, setAuditFilterStatus] = useState<'ALL' | 'EXACT' | 'SHIFTED' | 'MISSING'>('ALL')
  const [auditFolderFilterStatus, setAuditFolderFilterStatus] = useState<'ALL' | 'BALANCED' | 'COUNT_MISMATCH' | 'MISSING_IN_ARCHIVE' | 'EXTRA_IN_ARCHIVE'>('ALL')
  const [auditTabMode, setAuditTabMode] = useState<'folders' | 'files'>('folders')
  const [auditDateFilter, setAuditDateFilter] = useState<string>('')
  const [auditDates, setAuditDates] = useState<ArchiveDateItem[]>([])
  const [isLoadingAuditDates, setIsLoadingAuditDates] = useState(false)
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; item: MediaItem } | null>(null)

  // ── Safar Rename & Drive Assignment Modal State ──
  const [renameSafarModal, setRenameSafarModal] = useState<{
    isOpen: boolean
    safar: ScannedArchive | null
    newName: string
    city: string
    isStructured: boolean
    year: string
    serial: string
    cityName: string
    driveLabel: string
    driveLetter: string
    customDriveLetter: string
    rootPath: string
    pathExists: boolean
    saving: boolean
  }>({
    isOpen: false,
    safar: null,
    newName: '',
    city: '',
    isStructured: false,
    year: '1448',
    serial: '02',
    cityName: '',
    driveLabel: '',
    driveLetter: 'D',
    customDriveLetter: '',
    rootPath: '',
    pathExists: false,
    saving: false
  })

  // ── Safar Move to Backup Drive Modal State (Issue 9) ──
  const [backupDriveModal, setBackupDriveModal] = useState<{
    isOpen: boolean
    safar: ScannedArchive | null
    driveLetter: string
    driveLabel: string
    saving: boolean
  }>({
    isOpen: false,
    safar: null,
    driveLetter: 'G',
    driveLabel: '',
    saving: false
  })

  // Close context menu on outside click or ESC
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleLoadIntoReconciler = (filePath: string, safarId: number | null) => {
    setExcelPath(filePath)
    if (safarId) {
      setExcelAuditTargetSafar(safarId)
    }
    setActiveTab('excel')
    showToast({
      title: 'Spreadsheet Loaded into Reconciler 📊',
      message: 'Generated audit workbook pre-loaded. Ready to run reconciliation audit!',
      type: 'success'
    })
  }

  // Fetch dates when excelAuditTargetSafar changes
  useEffect(() => {
    if (!excelAuditTargetSafar || !api?.archiveCatalog?.listDates) {
      setAuditDates([])
      return
    }
    let cancelled = false
    setIsLoadingAuditDates(true)
    api.archiveCatalog.listDates(excelAuditTargetSafar).then((res: any) => {
      if (!cancelled && res && res.success) {
        setAuditDates(res.dates || [])
      }
    }).catch((err: any) => {
      console.error('Failed to list audit dates:', err)
    }).finally(() => {
      if (!cancelled) setIsLoadingAuditDates(false)
    })
    return () => {
      cancelled = true
    }
  }, [excelAuditTargetSafar])

  // ── Drive Inventory State ──
  const [drives, setDrives] = useState<DriveVolume[]>([])

  // -----------------------------------------------------------------
  // 1. Initial Data Loading & IPC Listeners
  // -----------------------------------------------------------------

  const loadSafars = useCallback(async () => {
    if (!api?.archiveCatalog?.listSafars) return
    try {
      const res = await api.archiveCatalog.listSafars()
      if (res && res.success) {
        setSafars(res.safars || [])
      }
    } catch (err: any) {
      console.error('[ArchiveVault] Failed to load safars:', err)
    }
  }, [])

  const loadDrives = useCallback(async () => {
    if (!api?.archiveCatalog?.listDrives) return
    try {
      const res = await api.archiveCatalog.listDrives()
      if (res && res.success) {
        setDrives(res.drives || [])
      }
    } catch (err) {
      console.error('[ArchiveVault] Failed to load drives:', err)
    }
  }, [])

  useEffect(() => {
    loadSafars()
    loadDrives()

    // Initialize background auto-watcher for IN PROCESS folders
    if (api?.settings?.getAll && api?.archiveCatalog?.setupAutoWatcher) {
      api.settings.getAll().then((st: any) => {
        const ttDrives = st?.task_tracker_drives || []
        const inProcessDirs = ttDrives
          .filter((d: any) => d.enabled && d.inProcessPath && !/^[A-Za-z]:[\\/]*$/.test(d.inProcessPath.trim()))
          .map((d: any) => d.inProcessPath)
        if (inProcessDirs.length > 0) {
          api.archiveCatalog.setupAutoWatcher(inProcessDirs)
        }
      }).catch(() => {})
    }

    let unsubUpdated: any = null
    if (typeof api?.archiveCatalog?.onCatalogUpdated === 'function') {
      unsubUpdated = api.archiveCatalog.onCatalogUpdated(() => {
        loadSafars()
        loadDrives()
      })
    }

    return () => {
      if (unsubUpdated) unsubUpdated()
    }
  }, [loadSafars, loadDrives])

  // Real-time scanner progress listener
  useEffect(() => {
    if (!api?.archiveCatalog) return

    let unsubProg: any = null
    let unsubComp: any = null

    if (typeof api.archiveCatalog.onProgress === 'function') {
      unsubProg = api.archiveCatalog.onProgress((data: any) => {
        setScanProgress(data)
      })
    }

    if (typeof api.archiveCatalog.onComplete === 'function') {
      unsubComp = api.archiveCatalog.onComplete((result: any) => {
        setIsScanning(false)
        playSuccess()
        showToast({
          title: 'Catalog Scan Complete ⚡',
          message: `Indexed ${result.total_files} files across ${result.safar_name}`,
          type: 'success'
        })
        loadSafars()
        loadDrives()
        setActiveTab('search')
      })
    }

    return () => {
      if (typeof unsubProg === 'function') unsubProg()
      if (typeof unsubComp === 'function') unsubComp()
      if (typeof api?.archiveCatalog?.removeListeners === 'function') {
        api.archiveCatalog.removeListeners()
      }
    }
  }, [loadSafars, loadDrives, playSuccess, showToast])

  // Load summary & sequence gaps when selected Safar changes
  useEffect(() => {
    if (typeof selectedSafarId === 'number' && api?.archiveCatalog) {
      if (api.archiveCatalog.getSummary) {
        api.archiveCatalog.getSummary(selectedSafarId).then((res: any) => {
          if (res && res.success) {
            setSafarSummary(res.summary)
          }
        }).catch(() => {})
      }
      if (api.archiveCatalog.detectGaps) {
        api.archiveCatalog.detectGaps(selectedSafarId).then((res: any) => {
          if (res && res.success) {
            setGaps(res.gaps || [])
          }
        }).catch(() => {})
      }
    } else {
      setSafarSummary(null)
      setGaps([])
    }
  }, [selectedSafarId])

  // -----------------------------------------------------------------
  // 2. High-Speed Live Media & Virtual Catalog Search
  // -----------------------------------------------------------------

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const connectivityCacheRef = useRef<Record<string, { online: boolean; time: number }>>({})

  const checkConnectivityForItems = async (items: MediaItem[]) => {
    if (!api?.archiveCatalog?.checkPathExists) return
    const now = Date.now()
    const checks: Record<string, boolean> = { ...connectivityMap }
    const rootsToCheck: string[] = []

    for (const it of items) {
      const p = it.full_path || it.root_path || ''
      const driveMatch = p.match(/^([A-Za-z]:[\\/])/)?.[0] || p
      if (driveMatch) {
        const cached = connectivityCacheRef.current[driveMatch]
        if (cached && now - cached.time < 10000) {
          checks[driveMatch] = cached.online
        } else if (!rootsToCheck.includes(driveMatch)) {
          rootsToCheck.push(driveMatch)
        }
      }
    }

    if (rootsToCheck.length === 0) {
      setConnectivityMap(checks)
      return
    }

    for (const root of rootsToCheck) {
      try {
        const online = await api.archiveCatalog.checkPathExists(root)
        checks[root] = online
        connectivityCacheRef.current[root] = { online, time: now }
      } catch {
        checks[root] = false
        connectivityCacheRef.current[root] = { online: false, time: now }
      }
    }
    setConnectivityMap(checks)
  }

  const executeSearch = useCallback(async () => {
    if (!api?.archiveCatalog?.search) return
    if (safars.length === 0) return
    setIsSearching(true)
    if (mediaItems.length === 0) {
      setIsLoadingMedia(true)
    }
    try {
      const filter: any = {
        query: searchQuery,
        searchTarget,
        mediaType: mediaType !== 'all' ? mediaType : undefined,
        eventCode: eventCode || undefined,
        finalOnly: finalVideosOnly,
        limit: searchQuery ? 5000 : 300
      }
      if (typeof selectedSafarId === 'number') {
        filter.archiveId = selectedSafarId
      }

      const res = await api.archiveCatalog.search(filter)
      if (res && res.success) {
        const found = res.result?.items || []
        setMediaItems(found)
        setTotalMediaCount(res.result?.total || 0)
        checkConnectivityForItems(found.slice(0, 100))
      }
    } catch (err) {
      console.error('[ArchiveVault] Search error:', err)
    } finally {
      setIsSearching(false)
      setIsLoadingMedia(false)
    }
  }, [searchQuery, searchTarget, selectedSafarId, mediaType, eventCode, finalVideosOnly, safars.length, mediaItems.length])

  // Computed display items applying status sub-filter in Final Videos mode and Date Filter
  const displayedMediaItems = useMemo(() => {
    let items = mediaItems
    if (finalVideosOnly && statusSubFilter !== 'ALL') {
      items = items.filter((item) => {
        const st = item.upload_status || 'unknown'
        if (statusSubFilter === 'uploaded') return st === 'uploaded'
        if (statusSubFilter === 'submitted') return st === 'submitted'
        if (statusSubFilter === 'rendered_pending') return st === 'rendered_pending'
        if (statusSubFilter === 'not_uploaded') {
          const rel = (item.relative_path || '').toLowerCase()
          const fn = (item.file_name || '').toLowerCase()
          const isDvd = st === 'dvd_local' || rel.includes('dvd') || fn.startsWith('dvd_') || fn.includes('_dvd_')
          if (isDvd) return false
          return st === 'not_uploaded' || st === 'unknown'
        }
        return true
      })
    }
    if (dateFilter.trim()) {
      const q = dateFilter.trim().toLowerCase()
      items = items.filter((item) => {
        const h = (item.date_canonical_hijri || '').toLowerCase()
        const g = (item.date_canonical_greg || '').toLowerCase()
        const rel = (item.relative_path || '').toLowerCase()
        const fn = (item.file_name || '').toLowerCase()
        return h.includes(q) || g.includes(q) || rel.includes(q) || fn.includes(q)
      })
    }
    return items
  }, [mediaItems, finalVideosOnly, statusSubFilter, dateFilter])

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, dateFilter, searchTarget, mediaType, eventCode, finalVideosOnly, statusSubFilter, selectedSafarId])

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(displayedMediaItems.length / pageSize))
  const paginatedMediaItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return displayedMediaItems.slice(start, start + pageSize)
  }, [displayedMediaItems, currentPage, pageSize])

  // Summary statistics for Final Videos mode
  const finalStats = useMemo(() => {
    if (!finalVideosOnly) return null
    let uploaded = 0
    let submitted = 0
    let pending = 0
    let notUploaded = 0
    for (const it of mediaItems) {
      const rel = (it.relative_path || '').toLowerCase()
      const fn = (it.file_name || '').toLowerCase()
      const isDvd = it.upload_status === 'dvd_local' || rel.includes('dvd') || fn.startsWith('dvd_') || fn.includes('_dvd_')
      if (isDvd) continue // Exclude DVD from Not Uploaded / Uploaded statistics!
      const st = it.upload_status || 'unknown'
      if (st === 'uploaded') uploaded++
      else if (st === 'submitted') submitted++
      else if (st === 'rendered_pending') pending++
      else notUploaded++
    }
    return { total: mediaItems.length, uploaded, submitted, pending, notUploaded }
  }, [mediaItems, finalVideosOnly])

  useEffect(() => {
    if (safars.length === 0) return
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      executeSearch()
    }, 280) // Smooth 280ms debounce avoids thrashing
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [executeSearch, safars.length])

  // Automated Task Tracker Sync & Drive Upload Verification
  const handleCheckUploads = async () => {
    try {
      setIsCheckingUploads(true)
      playTick()
      let trackerSynced = 0

      // 1. Sync directly with Task Tracker database (tracker.db)
      if (api?.archiveCatalog?.syncTrackerStatus) {
        try {
          const syncRes = await api.archiveCatalog.syncTrackerStatus({
            archiveId: typeof selectedSafarId === 'number' ? selectedSafarId : undefined
          })
          if (syncRes && syncRes.success) {
            trackerSynced = syncRes.synced_count || 0
          }
        } catch (sErr) {
          console.warn('Tracker sync warning:', sErr)
        }
      }

      // 2. Scan connected drives for TO UPLOAD & TO DELETE directories
      if (api?.archiveCatalog?.checkUploadStatus) {
        const res = await api.archiveCatalog.checkUploadStatus({
          archiveId: typeof selectedSafarId === 'number' ? selectedSafarId : undefined
        })
        if (res && res.success) {
          const up = res.stats?.uploaded_count || 0
          const sub = res.stats?.submitted_count || 0
          const pend = res.stats?.rendered_pending_count || 0
          showToast({
            title: 'Tracker & Uploads Synced ⚡',
            message: `Synced with Task Tracker (${trackerSynced} updated: ${up} Uploaded, ${sub} Submitted, ${pend} Pending).`,
            type: 'success'
          })
          playSuccess()
          executeSearch()
        } else {
          showToast({
            title: 'Tracker Synced ⚡',
            message: `Updated ${trackerSynced} records from Task Tracker.`,
            type: 'success'
          })
          playSuccess()
          executeSearch()
        }
      }
    } catch (err: any) {
      showToast({
        title: 'Sync Error',
        message: err.message || 'Failed to sync with Tracker',
        type: 'error'
      })
      playError()
    } finally {
      setIsCheckingUploads(false)
    }
  }

  // -----------------------------------------------------------------
  // 3. Asset Interaction Handlers (Locate, Open, Copy)
  // -----------------------------------------------------------------

  const handleLocateItem = async (item: MediaItem) => {
    playTick()
    if (!api?.archiveCatalog?.locateFile) return
    const target = item.full_path || item.relative_path
    const res = await api.archiveCatalog.locateFile(target)
    if (res && res.success) {
      playSuccess()
      showToast({
        title: 'Asset Located 🎯',
        message: `Highlighted ${item.file_name} in Windows Explorer`,
        type: 'success'
      })
    } else {
      playError()
      showToast({
        title: 'Drive Disconnected 🟡',
        message: res?.error || 'This hard drive is currently offline. Copy path to access when reconnected.',
        type: 'warning'
      })
    }
  }

  const handleOpenFolder = async (item: MediaItem) => {
    playTick()
    const folderPath = item.full_path ? item.full_path.substring(0, item.full_path.lastIndexOf('\\')) : ''
    if (folderPath && api?.shell?.openFolder) {
      await api.shell.openFolder(folderPath)
      showToast({
        title: 'Folder Opened 📂',
        message: 'Opened directory in Windows Explorer',
        type: 'info'
      })
    } else {
      handleCopyPath(item.relative_path || item.file_name)
    }
  }

  const handleCopyPath = (text: string, isOffline = false) => {
    playTick()
    navigator.clipboard.writeText(text)
    showToast({
      title: isOffline ? 'Offline Path Copied 📋' : 'Path Copied 📋',
      message: isOffline
        ? `Drive is offline. Connect drive and paste path into Windows Explorer: ${text}`
        : text,
      type: 'info'
    })
  }

  const handleRowContextMenu = (e: React.MouseEvent, item: MediaItem) => {
    if (item.media_type !== 'video') return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      mouseX: Math.min(e.clientX, window.innerWidth - 240),
      mouseY: Math.min(e.clientY, window.innerHeight - 240),
      item
    })
  }

  const handleSetUploadStatus = async (item: MediaItem, newStatus: string) => {
    setContextMenu(null)
    playTick()
    // Optimistic UI update
    setMediaItems(prev =>
      prev.map(it => (it.id === item.id ? { ...it, upload_status: newStatus as any } : it))
    )
    try {
      if (!api?.archiveCatalog?.setUploadStatus) {
        throw new Error('Upload status update API is unavailable')
      }
      const res = await api.archiveCatalog.setUploadStatus({
        itemId: item.id,
        status: newStatus
      })
      if (res && res.success) {
        playSuccess()
        showToast({
          title: 'Database Status Updated 🟢',
          message: `"${item.file_name}" set to ${newStatus.replace('_', ' ').toUpperCase()}`,
          type: 'success'
        })
      } else {
        throw new Error(res?.error || 'Database rejected status update')
      }
    } catch (err: any) {
      playError()
      showToast({
        title: 'Status Update Error',
        message: err.message || 'Could not update status in SQLite database',
        type: 'danger'
      })
    }
  }

  const handleLocateFolder = async (folderPath: string) => {
    playTick()
    if (!api?.archiveCatalog?.locateFile) return
    const res = await api.archiveCatalog.locateFile(folderPath)
    if (res && res.success) {
      playSuccess()
      showToast({
        title: 'Folder Opened 📂',
        message: `Opened ${folderPath} in Windows Explorer`,
        type: 'success'
      })
    } else {
      playError()
      showToast({
        title: 'Drive Offline 🟡',
        message: res?.error || 'External hard drive is currently offline. Connect drive to open.',
        type: 'warning'
      })
    }
  }

  const handleOpenDaysBreakdown = async (archiveId: number) => {
    playTick()
    setIsBreakdownLoading(true)
    setIsBreakdownModalOpen(true)
    try {
      if (api?.archiveCatalog?.getSafarDaysBreakdown) {
        const res = await api.archiveCatalog.getSafarDaysBreakdown(archiveId)
        if (res && res.success) {
          setSelectedBreakdownSafar(res)
          playSuccess()
        } else {
          showToast({ title: 'Error', message: res?.error || 'Failed to load days breakdown', type: 'error' })
          setIsBreakdownModalOpen(false)
        }
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message, type: 'error' })
      setIsBreakdownModalOpen(false)
    } finally {
      setIsBreakdownLoading(false)
    }
  }

  const handleCopyWhatsAppBreakdown = (breakdown: any) => {
    playTick()
    if (!breakdown) return
    const lines: string[] = []
    lines.push(`*${breakdown.safar_name} — Safar Summary*`)
    lines.push(`🗓️ *Total Duration:* ${breakdown.total_days_count} Days Safar`)
    if (breakdown.first_date && breakdown.last_date) {
      lines.push(`📅 *Date Range:* ${breakdown.first_date} to ${breakdown.last_date}`)
    }
    lines.push(`🎬 *Videos:* ${breakdown.total_mp4_count} | 📸 *Photos:* ${breakdown.total_photo_count}`)
    lines.push(`⏱️ *Total Runtime:* ${breakdown.total_duration_formatted} | 💾 *Storage:* ${formatBytes(breakdown.total_size_bytes)}`)
    lines.push(``)
    lines.push(`*Day-by-Day Schedule:*`)
    if (Array.isArray(breakdown.days)) {
      breakdown.days.forEach((d: any) => {
        const sess = d.sessions && d.sessions.length > 0 ? ` (${d.sessions.join(', ')})` : ''
        lines.push(`• *Day ${d.day_number}:* ${d.date_key}${sess} — ${d.mp4_count} vids, ${d.photo_count} photos, ${d.duration_formatted}`)
      })
    }
    navigator.clipboard.writeText(lines.join('\n'))
    showToast({ title: 'Copied! 📋', message: 'WhatsApp Safar schedule copied to clipboard', type: 'success' })
    playSuccess()
  }

  const handleExportSafarPdf = async (archiveId: number) => {
    playTick()
    if (!api?.archiveCatalog?.exportSafarPdf) {
      showToast({ title: 'Not Available', message: 'PDF export service is unavailable.', type: 'danger' })
      return
    }

    try {
      showToast({ title: 'Generating PDF 📄', message: 'Rendering executive Safar PDF audit report...', type: 'info' })
      const res = await api.archiveCatalog.exportSafarPdf({ archiveId })
      if (res && res.success && res.filePath) {
        playSuccess()
        showToast({
          title: 'PDF Exported 📄',
          message: `Saved executive report to ${res.filePath.split(/[\\/]/).pop()}`,
          type: 'success',
          action: {
            label: 'Open Folder',
            onClick: () => api?.shell?.openFolder?.(res.filePath)
          }
        })
      } else if (res && !res.canceled) {
        playError()
        showToast({ title: 'Export Failed', message: res.error || 'Could not export PDF report.', type: 'danger' })
      }
    } catch (err: any) {
      playError()
      showToast({ title: 'Export Error', message: err.message || String(err), type: 'danger' })
    }
  }

  const handleSendChatQuery = async (queryToRun?: string) => {
    const q = (queryToRun || chatInput).trim()
    if (!q || isChatSearching) return

    playTick()
    setChatInput('')
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setChatMessages(prev => [...prev, userMsg])
    setIsChatSearching(true)

    try {
      const activeArchiveId = selectedSafarId !== 'all' ? selectedSafarId : undefined
      const res = await api?.archiveCatalog?.chatQuery?.({ query: q, archiveId: activeArchiveId })

      if (res && res.success) {
        playSuccess()
        const botMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          sender: 'assistant',
          text: res.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          data: res
        }
        setChatMessages(prev => [...prev, botMsg])
      } else {
        playError()
        const botMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          sender: 'assistant',
          text: res?.error || 'Sorry, I could not parse this query. Please check date or event format.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
        setChatMessages(prev => [...prev, botMsg])
      }
    } catch (err: any) {
      playError()
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: 'assistant',
        text: `Error processing query: ${err.message || String(err)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages(prev => [...prev, botMsg])
    } finally {
      setIsChatSearching(false)
    }
  }

  const handleDownloadQueryExcel = async (queryText: string, items: any[]) => {
    playTick()
    if (!api?.archiveCatalog?.exportQueryExcel) {
      showToast({ title: 'Not Available', message: 'Excel export service is unavailable.', type: 'danger' })
      return
    }

    try {
      showToast({ title: 'Generating Excel 📊', message: `Exporting ${items.length} clips for query...`, type: 'info' })
      const res = await api.archiveCatalog.exportQueryExcel({ query: queryText, items })
      if (res && res.success && res.filePath) {
        playSuccess()
        showToast({
          title: 'Excel Exported 📊',
          message: `Saved query spreadsheet to ${res.filePath.split(/[\\/]/).pop()}`,
          type: 'success',
          action: {
            label: 'Open Folder',
            onClick: () => api?.shell?.openFolder?.(res.filePath)
          }
        })
      } else if (res && !res.canceled) {
        playError()
        showToast({ title: 'Export Failed', message: res.error || 'Failed to export Excel.', type: 'danger' })
      }
    } catch (err: any) {
      playError()
      showToast({ title: 'Export Error', message: err.message || String(err), type: 'danger' })
    }
  }

  const matchingSafar = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase().trim()
    return safars.find(s => {
      const name = (s.safar_name || '').toLowerCase()
      const city = (s.city || '').toLowerCase()
      const serial = String(s.safar_serial || '').toLowerCase()
      const year = String(s.safar_year || '').toLowerCase()
      return name.includes(q) || city.includes(q) || serial === q || year === q
    })
  }, [searchQuery, safars])

  // -----------------------------------------------------------------
  // 4. Folder Scanner Actions
  // -----------------------------------------------------------------

  const handleBrowseFolder = async () => {
    playTick()
    if (!api?.dialog?.openFolder) return
    const res = await api.dialog.openFolder()
    if (res) {
      setFolderToScan(res)
      const m = res.match(/^([A-Za-z]):/)
      if (m && !driveLabel) {
        setDriveLabel(`Drive_${m[1].toUpperCase()}_Archive`)
      }
    }
  }

  const handleStartScan = async () => {
    if (!folderToScan) {
      playError()
      showToast({
        title: 'Folder Required',
        message: 'Please choose a folder or hard drive to scan.',
        type: 'warning'
      })
      return
    }
    if (!api?.archiveCatalog?.startScan) {
      playError()
      showToast({
        title: 'Service Initializing',
        message: 'Archive Catalog engine is not available yet. Please reload or restart.',
        type: 'warning'
      })
      return
    }
    setIsScanning(true)
    setScanProgress({ scanned_files: 0, total_size_bytes: 0, total_mp4_count: 0 })
    playTick()
    showToast({
      title: 'Scan Ingest Started ⚡',
      message: 'Indexing files, folder hierarchy, and video durations...',
      type: 'info'
    })

    const res = await api.archiveCatalog.startScan({
      folderPath: folderToScan,
      driveLabel: driveLabel.trim()
    })

    if (!res?.success) {
      setIsScanning(false)
      playError()
      showToast({
        title: 'Scan Failed',
        message: res?.error || 'Failed to scan folder',
        type: 'danger'
      })
    }
  }

  const handleCancelScan = async () => {
    playTick()
    if (api?.archiveCatalog?.cancelScan) {
      await api.archiveCatalog.cancelScan()
    }
    setIsScanning(false)
    showToast({
      title: 'Scan Cancelled',
      message: 'Folder scan was halted by user.',
      type: 'info'
    })
  }

  const handleDeleteSafar = async (id: number, name: string) => {
    playTick()
    if (!window.confirm(`Are you sure you want to remove '${name}' from the Virtual Catalog? (No actual files will be deleted)`)) {
      return
    }
    if (!api?.archiveCatalog?.deleteSafar) return
    const res = await api.archiveCatalog.deleteSafar(id)
    if (res && res.success) {
      playSuccess()
      showToast({
        title: 'Archive Removed',
        message: `Removed '${name}' from catalog.`,
        type: 'info'
      })
      loadSafars()
      if (selectedSafarId === id) setSelectedSafarId('all')
    }
  }

  const handleOpenRenameSafar = async (safar: ScannedArchive) => {
    playTick()
    const name = safar.safar_name || ''
    const match = name.match(/^(\d{4})[-_](\d{2})?\s*(.*)$/)
    const year = match?.[1] || (safar.safar_year ? String(safar.safar_year) : '1448')
    const serial = match?.[2] || (safar.safar_serial || '02')
    const cityName = match?.[3] || (safar.city && safar.city !== 'Unassigned' ? safar.city : '')

    const rawPath = safar.root_path || ''
    const mLetter = rawPath.match(/^([A-Za-z]):/)
    const currentLetter = mLetter ? mLetter[1].toUpperCase() : 'D'
    const currentDriveLabel = safar.drive_label || (mLetter ? `Drive_${currentLetter}_Archive` : '')

    let online = false
    if (rawPath && api?.archiveCatalog?.checkPathExists) {
      try {
        online = await api.archiveCatalog.checkPathExists(rawPath)
      } catch {}
    }

    setRenameSafarModal({
      isOpen: true,
      safar,
      newName: name,
      city: safar.city || '',
      isStructured: false,
      year,
      serial,
      cityName,
      driveLabel: currentDriveLabel,
      driveLetter: currentLetter,
      customDriveLetter: '',
      rootPath: rawPath,
      pathExists: online,
      saving: false
    })
  }

  const handleSelectDriveLetter = (letter: string) => {
    playTick()
    const cleanL = letter.toUpperCase()
    let updatedPath = renameSafarModal.rootPath
    if (cleanL) {
      if (/^[A-Za-z]:/.test(updatedPath)) {
        updatedPath = updatedPath.replace(/^[A-Za-z]:/, `${cleanL}:`)
      } else if (updatedPath) {
        updatedPath = `${cleanL}:\\${updatedPath.replace(/^[\\/]+/, '')}`
      } else if (renameSafarModal.safar) {
        updatedPath = `${cleanL}:\\${renameSafarModal.safar.safar_folder || renameSafarModal.safar.safar_name}`
      }
    }

    setRenameSafarModal(prev => ({
      ...prev,
      driveLetter: cleanL,
      rootPath: updatedPath
    }))

    if (updatedPath && api?.archiveCatalog?.checkPathExists) {
      api.archiveCatalog.checkPathExists(updatedPath).then((exists: boolean) => {
        setRenameSafarModal(curr => ({ ...curr, pathExists: !!exists }))
      }).catch(() => {})
    }
  }

  const handleBrowseSafarPath = async () => {
    playTick()
    if (!api?.dialog?.openFolder) return
    const res = await api.dialog.openFolder()
    if (res) {
      const mLetter = res.match(/^([A-Za-z]):/)
      const l = mLetter ? mLetter[1].toUpperCase() : ''
      setRenameSafarModal(prev => ({
        ...prev,
        rootPath: res,
        driveLetter: l || prev.driveLetter,
        driveLabel: prev.driveLabel || (l ? `Drive_${l}_Archive` : prev.driveLabel),
        pathExists: true
      }))
    }
  }

  const handleConfirmRenameSafar = async () => {
    const { safar, newName, isStructured, year, serial, cityName, driveLabel, driveLetter, rootPath } = renameSafarModal
    if (!safar) return

    let finalName = ''
    let finalCity = renameSafarModal.city
    let finalYear: number | undefined
    let finalSerial: string | undefined

    if (isStructured) {
      const y = year.trim()
      const s = serial.trim().padStart(2, '0')
      const c = cityName.trim()
      finalName = `${y}-${s}${c ? ' ' + c : ''}`.trim()
      finalCity = c || 'Unassigned'
      finalYear = parseInt(y, 10) || undefined
      finalSerial = s
    } else {
      finalName = newName.trim()
      if (!finalName) {
        showToast({ title: 'Invalid Name', message: 'Safar name cannot be empty', type: 'warning' })
        return
      }
      const m = finalName.match(/^(\d{4})[-_](\d{2})?\s*(.*)$/)
      if (m) {
        finalYear = parseInt(m[1], 10) || undefined
        finalSerial = m[2] || undefined
        if (m[3]?.trim()) finalCity = m[3].trim()
      }
    }

    const finalDriveLabel = driveLabel.trim()
    const finalDriveLetter = driveLetter.trim().toUpperCase()
    const finalRootPath = rootPath.trim()

    const nameChanged = finalName !== safar.safar_name
    const driveChanged = finalDriveLabel !== (safar.drive_label || '') || finalRootPath !== (safar.root_path || '')

    if (!nameChanged && !driveChanged) {
      setRenameSafarModal(prev => ({ ...prev, isOpen: false }))
      return
    }

    setRenameSafarModal(prev => ({ ...prev, saving: true }))
    try {
      // 1. Rename & Reassign Drive in Archive Vault (archive_catalog.db)
      if (api?.archiveCatalog?.renameSafar) {
        const res = await api.archiveCatalog.renameSafar({
          archiveId: safar.id,
          safarName: safar.safar_name,
          newName: finalName,
          city: finalCity,
          year: finalYear,
          serial: finalSerial,
          driveLabel: finalDriveLabel,
          driveLetter: finalDriveLetter,
          rootPath: finalRootPath
        })
        if (!res?.success) {
          throw new Error(res?.error || 'Failed to update safar and drive in archive catalog')
        }
      }

      // 2. Rename in Task Tracker (tracker.db) if name changed
      if (nameChanged && api?.taskTracker?.renameSafar) {
        try {
          await api.taskTracker.renameSafar({
            oldSafar: safar.safar_name,
            newSafar: finalName,
            city: finalCity,
            year: finalYear,
            serial: finalSerial
          })
        } catch {}
      }

      // 3. Rename in Stats Database (stats.db) if name changed
      if (nameChanged && api?.statsDb?.renameSafar) {
        try {
          await api.statsDb.renameSafar({
            fromSafar: safar.safar_name,
            toSafar: finalName,
            newCity: finalCity,
            newYear: finalYear,
            newSerial: finalSerial
          })
        } catch {}
      }

      // 4. Cascade update media_items in Archive Catalog if drive changed (Issue 8)
      if (driveChanged && api?.archiveCatalog?.updateSafarDrive) {
        try {
          await api.archiveCatalog.updateSafarDrive({
            archiveId: safar.id,
            driveLabel: finalDriveLabel,
            driveLetter: finalDriveLetter,
            rootPath: finalRootPath
          })
        } catch (dErr) {
          console.warn('[ArchiveVault] updateSafarDrive cascade warning:', dErr)
        }
      }

      playSuccess()
      showToast({
        title: 'Safar & Drive Updated ✨',
        message: `Successfully updated '${finalName}' → Drive [${finalDriveLetter}:] (${finalDriveLabel || 'Assigned'}).`,
        type: 'success'
      })

      setRenameSafarModal(prev => ({ ...prev, isOpen: false, saving: false }))
      await loadSafars()
      await loadDrives()
      executeSearch()
    } catch (err: any) {
      playError()
      showToast({
        title: 'Update Failed',
        message: err.message || String(err),
        type: 'warning'
      })
      setRenameSafarModal(prev => ({ ...prev, saving: false }))
    }
  }

  // ── Move to Backup Drive Handlers (Issue 9) ──
  const handleOpenBackupDriveModal = (safar: ScannedArchive) => {
    playTick()
    const mLetter = (safar.root_path || '').match(/^([A-Za-z]):/)
    const currentLetter = mLetter ? mLetter[1].toUpperCase() : 'G'
    setBackupDriveModal({
      isOpen: true,
      safar,
      driveLetter: currentLetter,
      driveLabel: safar.drive_label || (currentLetter ? `Drive_${currentLetter}_Backup` : ''),
      saving: false
    })
  }

  const handleConfirmMoveBackupDrive = async () => {
    if (!backupDriveModal.safar || !api?.archiveCatalog?.updateSafarDrive) return
    setBackupDriveModal(prev => ({ ...prev, saving: true }))
    try {
      const cleanLetter = backupDriveModal.driveLetter.trim().toUpperCase()
      const cleanLabel = backupDriveModal.driveLabel.trim() || (cleanLetter ? `Drive_${cleanLetter}_Backup` : 'Backup Drive')
      let newRoot = backupDriveModal.safar.root_path || ''
      if (cleanLetter && /^[A-Za-z]:/.test(newRoot)) {
        newRoot = newRoot.replace(/^[A-Za-z]:/, `${cleanLetter}:`)
      }
      const res = await api.archiveCatalog.updateSafarDrive({
        archiveId: backupDriveModal.safar.id,
        driveLabel: cleanLabel,
        driveLetter: cleanLetter,
        rootPath: newRoot
      })
      if (res && res.success) {
        playSuccess()
        showToast({
          title: 'Moved to Backup Drive ✨',
          message: `Updated '${backupDriveModal.safar.safar_name}' metadata to Drive [${cleanLetter}:] (${cleanLabel}).`,
          type: 'success'
        })
        setBackupDriveModal(prev => ({ ...prev, isOpen: false, saving: false }))
        await loadSafars()
        await loadDrives()
        executeSearch()
      } else {
        throw new Error(res?.error || 'Failed to update backup drive metadata')
      }
    } catch (err: any) {
      setBackupDriveModal(prev => ({ ...prev, saving: false }))
      showToast({
        title: 'Error Updating Drive',
        message: err.message || 'Failed to update drive assignment',
        type: 'error'
      })
      playError()
    }
  }

  const handleDeleteItem = async (item: MediaItem) => {
    playTick()
    const isFolder = item.media_type === 'folder'
    const itemLabel = isFolder ? `folder '${item.file_name}' and its contents` : `'${item.file_name}'`
    if (!window.confirm(`Are you sure you want to delete ${itemLabel} from the Virtual Catalog? (The actual file/folder on disk will NOT be touched)`)) {
      return
    }
    if (!api?.archiveCatalog?.deleteItem) return
    try {
      const res = await api.archiveCatalog.deleteItem({ id: item.id, mediaType: item.media_type })
      if (res && res.success) {
        playSuccess()
        showToast({
          title: 'Record Deleted 🗑️',
          message: `Removed ${itemLabel} from Virtual Catalog.`,
          type: 'info'
        })
        setMediaItems(prev => prev.filter(it => !(it.id === item.id && it.media_type === item.media_type)))
        setTotalMediaCount(prev => Math.max(0, prev - 1))
      } else {
        playError()
        showToast({
          title: 'Delete Failed',
          message: res?.error || 'Could not delete record',
          type: 'warning'
        })
      }
    } catch (err: any) {
      showToast({ title: 'Delete Error', message: err.message || String(err), type: 'warning' })
    }
  }

  // -----------------------------------------------------------------
  // 5. Excel Reconciliation Actions
  // -----------------------------------------------------------------

  const handleBrowseExcel = async () => {
    playTick()
    if (!api?.dialog?.openFile) return
    const res = await api.dialog.openFile({
      filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx', 'xls'] }]
    })
    if (res) {
      setExcelPath(res)
    }
  }

  const handleRunReconciliation = async () => {
    if (!excelPath) {
      playError()
      showToast({
        title: 'Excel Required',
        message: 'Please choose an Excel file to audit.',
        type: 'warning'
      })
      return
    }

    const targetId = excelAuditTargetSafar || (typeof selectedSafarId === 'number' ? selectedSafarId : safars[0]?.id)
    if (!targetId) {
      playError()
      showToast({
        title: 'Select Target Safar',
        message: 'Please select a Target Safar strictly from the dropdown to compare against.',
        type: 'warning'
      })
      return
    }

    if (!api?.archiveCatalog?.reconcileExcel) return

    setIsAuditing(true)
    playTick()
    try {
      const res = await api.archiveCatalog.reconcileExcel({
        excelPath,
        archiveId: targetId,
        colDate: colDate.trim() || undefined,
        colFolder: colFolder.trim() || undefined,
        colFile: colFile.trim() || undefined,
        dateFilter: auditDateFilter || undefined
      })

      if (res && res.success) {
        setAuditSummary(res.summary)
        setAuditRecords(res.records || [])
        setAuditFolderSummary(res.folder_summary || [])
        playSuccess()
        showToast({
          title: 'Reconciliation Audit Complete 📊',
          message: `Audited ${res.summary.total_excel_rows} rows across ${res.summary.total_excel_folders || 0} folders with ${res.summary.accuracy_rate}% accuracy.`,
          type: 'success'
        })
      } else {
        playError()
        showToast({
          title: 'Reconciliation Error',
          message: res?.error || 'Failed to reconcile Excel file.',
          type: 'danger'
        })
      }
    } catch (err: any) {
      playError()
      showToast({
        title: 'Reconciliation Error',
        message: err.message,
        type: 'danger'
      })
    } finally {
      setIsAuditing(false)
    }
  }

  const handleExportAudit = async () => {
    playTick()
    if (!excelPath || !auditRecords.length || !api?.dialog?.saveFile || !api?.archiveCatalog?.reconcileExcel) return
    const savePath = await api.dialog.saveFile({
      defaultPath: `Audit_Reconciliation_${Date.now()}.xlsx`,
      filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx'] }]
    })
    if (!savePath) return

    const targetId = excelAuditTargetSafar || (typeof selectedSafarId === 'number' ? selectedSafarId : safars[0]?.id)
    if (!targetId) return

    const res = await api.archiveCatalog.reconcileExcel({
      excelPath,
      archiveId: targetId,
      colDate,
      colFolder,
      colFile,
      dateFilter: auditDateFilter || undefined,
      exportPath: savePath
    })

    if (res && res.success) {
      playSuccess()
      showToast({
        title: 'Report Exported 📑',
        message: `Saved audit spreadsheet to: ${savePath}`,
        type: 'success'
      })
    }
  }

  const handleGenerateSafarExcel = async () => {
    playTick()
    if (!api?.archiveCatalog?.generateSafarExcel) {
      showToast({ title: 'Not Supported', message: 'Excel generation API not available', type: 'warning' })
      return
    }
    const targetId = excelAuditTargetSafar || (safars.length > 0 ? safars[0].id : null)
    if (!targetId) {
      showToast({ title: 'No Safar Available', message: 'Scan a folder or safar first to generate its Audit Excel.', type: 'warning' })
      return
    }
    const targetSafar = safars.find(s => s.id === targetId)
    setIsGeneratingExcel(true)
    try {
      const res = await api.archiveCatalog.generateSafarExcel({
        archiveId: targetId,
        defaultName: `${targetSafar?.safar_name || 'Safar'}_Audit_Sheet.xlsx`
      })
      if (res && res.success && res.filePath) {
        playSuccess()
        setExcelPath(res.filePath)
        setExcelAuditTargetSafar(targetId)
        showToast({
          title: 'Excel Generated 📊',
          message: `Generated ${res.total_rows || 0} rows from ${targetSafar?.safar_name}. Auto-loaded into Reconciler!`,
          type: 'success'
        })
      } else if (res && !res.canceled) {
        playError()
        showToast({ title: 'Generation Failed', message: res.error || 'Could not generate Excel', type: 'warning' })
      }
    } catch (err: any) {
      playError()
      showToast({ title: 'Generation Error', message: err.message || String(err), type: 'warning' })
    } finally {
      setIsGeneratingExcel(false)
    }
  }

  const handleGenerateTemplateExcel = async () => {
    playTick()
    if (!api?.archiveCatalog?.generateTemplateExcel) {
      showToast({ title: 'Not Supported', message: 'Template generation API not available', type: 'warning' })
      return
    }
    setIsGeneratingExcel(true)
    try {
      const res = await api.archiveCatalog.generateTemplateExcel()
      if (res && res.success && res.filePath) {
        playSuccess()
        setExcelPath(res.filePath)
        showToast({
          title: 'Clean Template Ready 📥',
          message: `Saved Audit Template with all 34 event codes. Loaded into Reconciler!`,
          type: 'success'
        })
      } else if (res && !res.canceled) {
        playError()
        showToast({ title: 'Template Error', message: res.error || 'Could not generate template', type: 'warning' })
      }
    } catch (err: any) {
      playError()
      showToast({ title: 'Template Error', message: err.message || String(err), type: 'warning' })
    } finally {
      setIsGeneratingExcel(false)
    }
  }

  // -----------------------------------------------------------------
  // Formatting Helpers
  // -----------------------------------------------------------------
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B'
    const k = 1024
    const dm = 2
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  const isItemOnline = (item: MediaItem): boolean => {
    const p = item.full_path || item.root_path || ''
    const driveMatch = p.match(/^([A-Za-z]:[\\/])/)?.[0] || p
    return !!connectivityMap[driveMatch]
  }

  const clearAllFilters = () => {
    playTick()
    setSearchQuery('')
    setSearchTarget('all')
    setEventCode('')
    setMediaType('all')
    setSelectedSafarId('all')
    setFinalVideosOnly(false)
    setStatusSubFilter('ALL')
  }

  const handleSearchTargetFinal = (codeOrName: string) => {
    playTick()
    setFinalVideosOnly(true)
    setSearchQuery(codeOrName)
    showToast({
      title: 'Final Video Locator 🎯',
      message: `Searching final videos matching "${codeOrName}"`,
      type: 'info'
    })
  }

  const filteredAuditRecords = auditRecords.filter((rec) => {
    if (auditFilterStatus === 'ALL') return true
    if (auditFilterStatus === 'EXACT') return rec.match_status === 'EXACT'
    if (auditFilterStatus === 'SHIFTED') return rec.match_status.includes('SHIFT')
    if (auditFilterStatus === 'MISSING') return rec.match_status === 'MISSING'
    return true
  })

  const filteredAuditFolders = auditFolderSummary.filter((f) => {
    if (auditFolderFilterStatus === 'ALL') return true
    if (auditFolderFilterStatus === 'BALANCED') return f.status === 'BALANCED'
    if (auditFolderFilterStatus === 'COUNT_MISMATCH') return f.status === 'COUNT_MISMATCH'
    if (auditFolderFilterStatus === 'MISSING_IN_ARCHIVE') return f.status === 'MISSING_IN_ARCHIVE'
    if (auditFolderFilterStatus === 'EXTRA_IN_ARCHIVE') return f.status === 'EXTRA_IN_ARCHIVE'
    return true
  })

  const currentSafarObj = safars.find((s) => s.id === selectedSafarId)
  const isCatalogEmpty = safars.length === 0 && !isScanning

  // ─────────────────────────────────────────────────────────────────
  // ZERO-STATE: NOTHING UNTIL A FOLDER IS SCANNED
  // ─────────────────────────────────────────────────────────────────
  if (isCatalogEmpty) {
    return (
      <div className="vault-container">
        {/* Service Notice if IPC not yet attached */}
        {!api?.archiveCatalog && (
          <div style={{
            background: '#FFFBEB',
            border: '1.5px solid #FDE68A',
            borderRadius: '12px',
            padding: '12px 18px',
            color: '#92400E',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <strong>Archive Catalog Engine Connecting:</strong> Please reload the workstation window (<kbd>Ctrl+R</kbd>) or restart Uni Desk to activate offline search.
            </div>
          </div>
        )}

        <div className="vault-initial-container">
          <div className="vault-initial-card">
            <div className="vault-initial-header">
              <div className="vault-initial-icon">🔍</div>
              <h2 className="vault-initial-title">Data Search & Virtual Catalog</h2>
              <p className="vault-initial-sub">
                Scan your first event folder or external hard drive to start.
                The app indexes file names, folder structures, and MP4 video lengths in seconds with <strong>zero local storage used</strong>.
              </p>
            </div>

            <div className="vault-mapping-row">
              <label>Select Folder or Hard Drive to Scan:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ flex: 1 }}
                  placeholder="Click Browse Folder to select..."
                  value={folderToScan}
                  onChange={(e) => setFolderToScan(e.target.value)}
                />
                <button className="vault-btn vault-btn-primary" onClick={handleBrowseFolder}>
                  Browse Folder
                </button>
              </div>
            </div>

            <div className="vault-mapping-row">
              <label>Drive Volume Label (Optional):</label>
              <input
                placeholder="e.g. SSD-4TB-Safar, Backup-Drive-A"
                value={driveLabel}
                onChange={(e) => setDriveLabel(e.target.value)}
              />
            </div>

            <button
              className="vault-btn vault-btn-primary"
              style={{ padding: '14px', fontSize: '15px', justifyContent: 'center' }}
              onClick={handleStartScan}
            >
              ⚡ Scan Folder & Build Virtual Catalog
            </button>

            <div style={{
              background: '#F0F9FF',
              border: '1.5px solid #BAE6FD',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '12.5px',
              color: '#0369A1',
              lineHeight: 1.5
            }}>
              💡 <strong>Instant Search After Scanning:</strong> Once scanned, you can search files or folders by Name or by Event using Title Adder event codes (<code>AQ</code>, <code>N</code>, <code>MZ</code>, <code>Q</code>, <code>M</code>, <code>Z</code>, <code>BQ</code>, <code>BM</code>, <code>BZ</code>, <code>WAAZ</code>, <code>ID</code>, <code>OD</code>).
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // SCANNED STATE: FULL WORKSTATION DASHBOARD
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="vault-container">
      {/* ── 1. Hero Command Header ── */}
      <div className="vault-header">
        <div className="vault-header-left">
          <div className="vault-hero-icon">🔍</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 className="vault-header-title">Data Search & Virtual Catalog</h1>
              <span className="vault-live-tag">
                <span className="vault-live-dot" />
                ZERO STORAGE ENGINE
              </span>
            </div>
            <p className="vault-header-sub">
              Sub-millisecond search across disconnected hard drives, virtual media catalogs, and Title Adder event structures.
            </p>
          </div>
        </div>

        <div className="vault-header-actions">
          <button
            className={`vault-btn ${activeTab === 'scan' ? 'vault-btn-primary' : 'vault-btn-ghost'}`}
            onClick={() => {
              playTick()
              setActiveTab('scan')
            }}
          >
            <span>⚡</span> Scan Other Folder
          </button>
          <button
            className="vault-btn vault-btn-ghost"
            onClick={() => {
              playTick()
              loadSafars()
              loadDrives()
              executeSearch()
              showToast({
                title: 'Catalog Refreshed 🔄',
                message: 'Virtual catalog and drive status updated.',
                type: 'info'
              })
            }}
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {/* ── Top KPI Bar ── */}
      <div className="vault-stats-grid">
        <div className="vault-stat-card">
          <span className="vault-stat-label">Total Indexed Folders / Safars</span>
          <span className="vault-stat-value">{safars.length}</span>
          <span className="vault-stat-sub">Across {drives.length} Hard Drive Volumes</span>
        </div>
        <div className="vault-stat-card">
          <span className="vault-stat-label">
            {currentSafarObj ? `${currentSafarObj.safar_name} Size` : 'Total Cataloged Storage'}
          </span>
          <span className="vault-stat-value">
            {formatBytes(currentSafarObj ? currentSafarObj.total_size_bytes : safars.reduce((a, b) => a + b.total_size_bytes, 0))}
          </span>
          <span className="vault-stat-sub">0 Bytes local disk impact</span>
        </div>
        <div className="vault-stat-card">
          <span className="vault-stat-label">Total Video / MP4 Files</span>
          <span className="vault-stat-value">
            {currentSafarObj ? currentSafarObj.total_mp4_count : safars.reduce((a, b) => a + b.total_mp4_count, 0)}
          </span>
          <span className="vault-stat-sub">
            Photos: {currentSafarObj ? currentSafarObj.total_photo_count : safars.reduce((a, b) => a + b.total_photo_count, 0)}
          </span>
        </div>
        <div className="vault-stat-card">
          <span className="vault-stat-label">Total Footage Duration</span>
          <span className="vault-stat-value">
            {currentSafarObj ? currentSafarObj.duration_formatted : 'Multi-Hour'}
          </span>
          <span className="vault-stat-sub">Sub-2ms MP4 atom inspection</span>
        </div>
      </div>

      {/* ── Main Tab Navigation (2 Primary Options Requested: Search & Scan Other Folder) ── */}
      <div className="vault-tabs">
        <button
          className={`vault-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => {
            playTick()
            setActiveTab('search')
          }}
        >
          <span>🔍</span> Search File or Folder
        </button>
        <button
          className={`vault-tab-btn ${activeTab === 'safars' ? 'active' : ''}`}
          onClick={() => {
            playTick()
            setActiveTab('safars')
          }}
        >
          <span>📚</span> Scanned Safars ({safars.length})
        </button>
        <button
          className={`vault-tab-btn ${activeTab === 'scan' ? 'active' : ''}`}
          onClick={() => {
            playTick()
            setActiveTab('scan')
          }}
        >
          <span>⚡</span> Scan Other Folder
        </button>
        <button
          className={`vault-tab-btn ${activeTab === 'excel' ? 'active' : ''}`}
          onClick={() => {
            playTick()
            setActiveTab('excel')
          }}
        >
          <span>📊</span> Excel Audit & Reconciler
        </button>
        <button
          className={`vault-tab-btn ${activeTab === 'drives' ? 'active' : ''}`}
          onClick={() => {
            playTick()
            setActiveTab('drives')
          }}
        >
          <span>💾</span> Hard Drive Tracker ({drives.length})
        </button>
        <button
          className={`vault-tab-btn ${activeTab === 'assistant' ? 'active' : ''}`}
          style={{ borderColor: activeTab === 'assistant' ? '#2563EB' : 'rgba(37,99,235,0.3)', background: activeTab === 'assistant' ? '#EFF6FF' : undefined }}
          onClick={() => {
            playTick()
            setActiveTab('assistant')
          }}
        >
          <span>💬</span> Vault Assistant ("Ask Archive")
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: SEARCH FILE OR FOLDER (BY NAME OR EVENT)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'search' && (
        <div className="vault-panel">
          {/* Sequence Break Alert Banner */}
          {gaps.length > 0 && (
            <div className="vault-gap-banner">
              <div className="vault-gap-banner-text">
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <span>
                  <strong>Camera Sequence Break Detected:</strong> {gaps.length} clip(s) missing between recorded files in this Safar (e.g. {gaps[0].missing_filename}).
                </span>
              </div>
              <button
                className="vault-btn vault-btn-ghost"
                style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => {
                  const missingList = gaps.map((g: any) => g.missing_filename || 'Clip').slice(0, 5).join(', ')
                  showToast({
                    type: 'warning',
                    title: `Sequence Break: ${gaps.length} Missing Clip(s)`,
                    message: `Missing clips: ${missingList}${gaps.length > 5 ? ` and ${gaps.length - 5} more` : ''}`,
                    duration: 8000
                  })
                }}
              >
                View Gaps
              </button>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="vault-filter-bar">
            {/* Row 1: Safar Dropdown + Target Toggle + Search Box + Generate Excel Button */}
            <div className="vault-filter-row-primary">
              {/* Searchable Safar Selector */}
              <SafarSearchSelect
                safars={safars}
                selectedId={selectedSafarId}
                onSelect={(val) => {
                  playTick()
                  setSelectedSafarId(val)
                }}
                includeAllOption={true}
                placeholder="Select Scanned Folder..."
                style={{ minWidth: '240px' }}
              />

              {/* Search Target Toggle (All | File Name | Folder Name) */}
              <div className="vault-search-target-toggle">
                <button
                  className={`vault-target-btn ${searchTarget === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    playTick()
                    setSearchTarget('all')
                  }}
                  title="Search both file names and folder directories"
                >
                  🌐 All Names
                </button>
                <button
                  className={`vault-target-btn ${searchTarget === 'file' ? 'active' : ''}`}
                  onClick={() => {
                    playTick()
                    setSearchTarget('file')
                  }}
                  title="Search file name specifically"
                >
                  📄 File Name
                </button>
                <button
                  className={`vault-target-btn ${searchTarget === 'folder' ? 'active' : ''}`}
                  onClick={() => {
                    playTick()
                    setSearchTarget('folder')
                  }}
                  title="Search folder directory name specifically"
                >
                  📁 Folder Name
                </button>
              </div>

              {/* Instant Search Input */}
              <div className="vault-search-box">
                <span className="vault-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder={
                    searchTarget === 'file'
                      ? 'Search clip number or file name (e.g. 40490, C0001.MP4, DSC0123)...'
                      : searchTarget === 'folder'
                      ? 'Search folder name (e.g. 01-Bethak, Majlis, 1448-03-13)...'
                      : 'Search clip number (e.g. 40490), file name, folder, or event...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    className="vault-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search query"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Action Buttons Group */}
              <div className="vault-filter-actions-group">
                <button
                  className="vault-btn vault-btn-primary vault-btn-excel-action"
                  onClick={() => {
                    playTick()
                    setIsExcelModalOpen(true)
                  }}
                  title="Generate a pre-filled Excel audit spreadsheet from a selected Safar or folder"
                >
                  <span>📊</span>
                  <span>Generate Excel</span>
                </button>

                <button
                  className="vault-btn vault-btn-ghost vault-sync-tracker-btn"
                  disabled={isCheckingUploads}
                  onClick={handleCheckUploads}
                  title="Synchronizes video and date folder upload statuses directly from Task Tracker (tracker.db) and verifies connected drives"
                >
                  <span>{isCheckingUploads ? '⏳' : '⚡'}</span>
                  <span>{isCheckingUploads ? 'Syncing...' : 'Sync Tracker'}</span>
                </button>
              </div>
            </div>

            {/* Row 2: Media Type Categories + Final Videos Filter + Date Filter + Density Controls */}
            <div className="vault-filter-row-secondary">
              {/* Media Type Category Pills */}
              <div className="vault-filter-pills">
                {[
                  { key: 'all', label: '🌟 ALL' },
                  { key: 'video', label: '🎥 VIDEOS' },
                  { key: 'photo', label: '🖼️ PHOTOS' },
                  { key: 'audio', label: '🎵 AUDIO' }
                ].map((cat) => (
                  <button
                    key={cat.key}
                    className={`vault-pill ${mediaType === cat.key ? 'active' : ''}`}
                    onClick={() => {
                      playTick()
                      setMediaType(cat.key)
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="vault-filter-divider" />

              {/* Final Videos Filter */}
              <div className="vault-final-filter-compact-group">
                <button
                  type="button"
                  className={`vault-final-toggle-btn ${finalVideosOnly ? 'active' : ''}`}
                  onClick={() => {
                    playTick()
                    setFinalVideosOnly((prev) => !prev)
                  }}
                  title={finalVideosOnly ? 'Click to show all catalog files' : 'Click to filter exclusively for Final Videos'}
                >
                  <span className="vault-final-icon">🎬</span>
                  <span style={{ fontWeight: 700 }}>Final Videos Only</span>
                  <span className={`vault-final-indicator ${finalVideosOnly ? 'on' : 'off'}`}>
                    {finalVideosOnly ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              <div className="vault-filter-divider" />

              {/* Date Filter */}
              <div className="vault-date-filter-group">
                <span style={{ fontSize: '13px' }}>📅</span>
                <input
                  type="text"
                  className="vault-date-input"
                  placeholder="Date e.g. 1448-03..."
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  title="Filter catalog files by Hijri or Gregorian date pattern"
                />
                {dateFilter && (
                  <button
                    type="button"
                    className="vault-date-clear-btn"
                    onClick={() => setDateFilter('')}
                    title="Clear date filter"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="vault-filter-divider" />

              {/* Excel-like Table Density & Width Controls */}
              <div className="vault-excel-controls-group">
                <span className="vault-excel-ctrl-label">Row Height:</span>
                <div className="vault-density-pill-group">
                  <button
                    type="button"
                    className={`vault-density-chip ${rowDensity === 'compact' ? 'active' : ''}`}
                    onClick={() => handleRowDensityChange('compact')}
                    title="Excel-like Compact Rows"
                  >
                    Compact
                  </button>
                  <button
                    type="button"
                    className={`vault-density-chip ${rowDensity === 'normal' ? 'active' : ''}`}
                    onClick={() => handleRowDensityChange('normal')}
                    title="Default Excel Row Height"
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`vault-density-chip ${rowDensity === 'spacious' ? 'active' : ''}`}
                    onClick={() => handleRowDensityChange('spacious')}
                    title="Comfortable Spacious Rows"
                  >
                    Spacious
                  </button>
                </div>

                <button
                  type="button"
                  className="vault-reset-widths-btn"
                  onClick={handleResetColWidths}
                  title="Reset column widths to default Excel sizing"
                >
                  📐 Reset Columns
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Summary Strip */}
          {(searchQuery || searchTarget !== 'all' || eventCode || mediaType !== 'all' || selectedSafarId !== 'all' || finalVideosOnly || dateFilter) && (
            <div className="vault-active-filter-strip">
              <div className="vault-active-tags">
                <span style={{ fontWeight: 700, color: '#0F172A' }}>Active Filters:</span>
                {finalVideosOnly && (
                  <span className="vault-active-tag final-active">
                    🎬 Filter: Final Videos Only
                  </span>
                )}
                {dateFilter && (
                  <span className="vault-active-tag">
                    📅 Date: "{dateFilter}"
                  </span>
                )}
                {searchQuery && (
                  <span className="vault-active-tag">
                    {searchTarget === 'file' ? '📄 File Name:' : searchTarget === 'folder' ? '📁 Folder Name:' : '🔍 Query:'} "{searchQuery}"
                  </span>
                )}
                {eventCode && (
                  <span className="vault-active-tag">
                    🏷️ Event: {eventCode}
                  </span>
                )}
                {mediaType !== 'all' && (
                  <span className="vault-active-tag">
                    📁 Type: {mediaType.toUpperCase()}
                  </span>
                )}
                {selectedSafarId !== 'all' && currentSafarObj && (
                  <span className="vault-active-tag">
                    🌐 Folder: {currentSafarObj.safar_name}
                  </span>
                )}
              </div>
              <button
                className="vault-btn vault-btn-ghost"
                style={{ padding: '3px 10px', fontSize: '11.5px' }}
                onClick={clearAllFilters}
              >
                ✕ Clear All Filters
              </button>
            </div>
          )}

          {/* Final Videos KPI Breakdown Bar */}
          {finalVideosOnly && finalStats && (
            <div className="vault-final-kpi-bar anim-scale-in">
              <div className="vault-final-kpi-label">
                <span>🎬 Final Videos Summary:</span>
              </div>
              <div className="vault-final-kpi-chips">
                <button
                  className={`vault-kpi-chip ${statusSubFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => { playTick(); setStatusSubFilter('ALL') }}
                  title="Show all final videos"
                >
                  All ({finalStats.total})
                </button>
                <button
                  className={`vault-kpi-chip uploaded ${statusSubFilter === 'uploaded' ? 'active' : ''}`}
                  onClick={() => { playTick(); setStatusSubFilter('uploaded') }}
                  title="Show uploaded final videos"
                >
                  📤 Uploaded ({finalStats.uploaded})
                </button>
                <button
                  className={`vault-kpi-chip submitted ${statusSubFilter === 'submitted' ? 'active' : ''}`}
                  onClick={() => { playTick(); setStatusSubFilter('submitted') }}
                  title="Show submitted final videos"
                >
                  ✅ Submitted ({finalStats.submitted})
                </button>
                <button
                  className={`vault-kpi-chip pending ${statusSubFilter === 'rendered_pending' ? 'active' : ''}`}
                  onClick={() => { playTick(); setStatusSubFilter('rendered_pending') }}
                  title="Show rendered final videos pending upload"
                >
                  ⏳ Pending ({finalStats.pending})
                </button>
                <button
                  className={`vault-kpi-chip not-uploaded ${statusSubFilter === 'not_uploaded' ? 'active' : ''}`}
                  onClick={() => { playTick(); setStatusSubFilter('not_uploaded') }}
                  title="Show not uploaded final videos"
                >
                  ⭕ Not Uploaded ({finalStats.notUploaded})
                </button>
              </div>
            </div>
          )}

          {/* Smart Safar Match Banner */}
          {matchingSafar && (
            <div className="safar-search-match-banner anim-scale-in">
              <div className="safar-match-title-row">
                <span style={{ fontSize: '24px' }}>🏕️</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '15px', color: '#0F172A' }}>{matchingSafar.safar_name}</strong>
                    <span className="safar-hero-day-badge">
                      🗓️ {(matchingSafar as any).total_days_count || 1} Days Safar
                    </span>
                    {matchingSafar.city && (
                      <span
                        className={`safar-meta-chip city ${matchingSafar.city === 'Unassigned' ? 'unassigned' : ''}`}
                        title={matchingSafar.city === 'Unassigned' ? 'Location: Unassigned (City not detected in folder name)' : `Location / City: ${matchingSafar.city}`}
                      >
                        📍 {matchingSafar.city}
                      </span>
                    )}
                    {matchingSafar.drive_label && <span className="safar-meta-chip drive">💽 {matchingSafar.drive_label}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
                    {matchingSafar.total_mp4_count} videos · {matchingSafar.total_photo_count} photos · {matchingSafar.duration_formatted} · {formatBytes(matchingSafar.total_size_bytes)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="vault-btn vault-btn-ghost"
                  style={{ padding: '8px 14px', fontSize: '12px', background: '#FFFFFF', border: '1.5px solid #CBD5E1', color: '#0F172A', fontWeight: 600 }}
                  onClick={() => handleOpenRenameSafar(matchingSafar)}
                  title="Rename this Safar across all databases"
                >
                  ✏️ Rename Safar
                </button>
                <button
                  className="safar-days-popup-btn"
                  style={{ flex: 'initial', padding: '8px 18px', fontSize: '13px' }}
                  onClick={() => handleOpenDaysBreakdown(matchingSafar.id)}
                >
                  ✨ View Days Breakdown Popup
                </button>
              </div>
            </div>
          )}

          {/* Table of Cataloged Assets */}
          <div className={`vault-table-wrapper density-${rowDensity}`}>
            {isSearching && (
              <div className="vault-table-searching-indicator">
                <div className="vault-table-searching-bar" />
              </div>
            )}
            {isLoadingMedia && mediaItems.length === 0 ? (
              <SkeletonTable rows={7} columns={finalVideosOnly ? 9 : 8} />
            ) : displayedMediaItems.length === 0 ? (
              <div className="vault-empty-state">
                <span className="vault-empty-state-icon">🔍</span>
                <h3>No Matching Files or Folders Found</h3>
                <p>
                  No assets matched your search query "{searchQuery}" {finalVideosOnly ? '(Final Videos Only)' : ''}.
                  Try clearing filters or scanning another folder.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button className="vault-btn vault-btn-ghost" onClick={clearAllFilters}>
                    ✕ Clear Filters
                  </button>
                  <button className="vault-btn vault-btn-primary" onClick={() => setActiveTab('scan')}>
                    ⚡ Scan Other Folder
                  </button>
                </div>
              </div>
            ) : (
              <table className="vault-table">
                <thead>
                  <tr>
                    <th style={{ width: colWidths.name }} className="av-th-resizable">
                      <span>File / Folder Name</span>
                      <div
                        className="av-col-resizer"
                        onMouseDown={(e) => handleColResizeStart('name', e)}
                        onDoubleClick={() => handleColReset('name')}
                        title="Drag to resize column (Double-click to reset)"
                      />
                    </th>
                    <th style={{ width: colWidths.type }} className="av-th-resizable">
                      <span>Type</span>
                      <div
                        className="av-col-resizer"
                        onMouseDown={(e) => handleColResizeStart('type', e)}
                        onDoubleClick={() => handleColReset('type')}
                        title="Drag to resize column"
                      />
                    </th>
                    <th style={{ width: colWidths.path }} className="av-th-resizable">
                      <span>Folder Path / Safar</span>
                      <div
                        className="av-col-resizer"
                        onMouseDown={(e) => handleColResizeStart('path', e)}
                        onDoubleClick={() => handleColReset('path')}
                        title="Drag to resize column"
                      />
                    </th>
                    <th style={{ width: colWidths.usedIn }} className="av-th-resizable">
                      <span>Used In</span>
                      <div
                        className="av-col-resizer"
                        onMouseDown={(e) => handleColResizeStart('usedIn', e)}
                        onDoubleClick={() => handleColReset('usedIn')}
                        title="Drag to resize column"
                      />
                    </th>
                    <th style={{ width: colWidths.size }} className="av-th-resizable">
                      <span>Size</span>
                      <div
                        className="av-col-resizer"
                        onMouseDown={(e) => handleColResizeStart('size', e)}
                        onDoubleClick={() => handleColReset('size')}
                        title="Drag to resize column"
                      />
                    </th>
                    <th style={{ width: colWidths.duration }} className="av-th-resizable">
                      <span>Duration</span>
                      <div
                        className="av-col-resizer"
                        onMouseDown={(e) => handleColResizeStart('duration', e)}
                        onDoubleClick={() => handleColReset('duration')}
                        title="Drag to resize column"
                      />
                    </th>
                    {finalVideosOnly && (
                      <th style={{ width: colWidths.status }} className="av-th-resizable">
                        <span>Status</span>
                        <div
                          className="av-col-resizer"
                          onMouseDown={(e) => handleColResizeStart('status', e)}
                          onDoubleClick={() => handleColReset('status')}
                          title="Drag to resize column"
                        />
                      </th>
                    )}
                    <th style={{ width: colWidths.drive }} className="av-th-resizable">
                      <span>Drive</span>
                      <div
                        className="av-col-resizer"
                        onMouseDown={(e) => handleColResizeStart('drive', e)}
                        onDoubleClick={() => handleColReset('drive')}
                        title="Drag to resize column"
                      />
                    </th>
                    <th style={{ width: colWidths.actions }} className="av-th-resizable">
                      <span>Actions</span>
                      <div
                        className="av-col-resizer"
                        onMouseDown={(e) => handleColResizeStart('actions', e)}
                        onDoubleClick={() => handleColReset('actions')}
                        title="Drag to resize column"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMediaItems.map((item) => {
                    const isFolder = item.media_type === 'folder'
                    const online = isItemOnline(item)
                    const targetFinal = extractTargetFinalVideo(item.relative_path, item.file_name, {
                      date: item.date_canonical_hijri || item.session_tag,
                      session: item.session_name,
                      eventCode: item.event_code,
                      safar: item.safar_name
                    })
                    return (
                      <tr
                        key={`${item.media_type}-${item.id}`}
                        onContextMenu={(e) => handleRowContextMenu(e, item)}
                      >
                        <td>
                          <strong>{isFolder ? `📁 ${item.file_name}` : item.file_name}</strong>
                          <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <span>{item.safar_name}</span>
                            {item.archive_id && (
                              <button
                                className="vault-btn vault-btn-ghost"
                                style={{ padding: '0px 5px', fontSize: '10px', height: '18px', lineHeight: '18px', borderRadius: '4px' }}
                                onClick={() => handleOpenDaysBreakdown(item.archive_id!)}
                                title="Open Day Count Breakdown Popup"
                              >
                                🗓️ Days
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`vault-type-tag vault-type-${item.media_type}`}>
                            {isFolder ? 'folder' : item.media_type}
                          </span>
                        </td>
                        <td style={{ maxWidth: '300px', wordBreak: 'break-all' }}>
                          <span style={{ opacity: 0.9 }}>📁 {item.relative_path || 'Root'}</span>
                        </td>
                        <td>
                          {targetFinal.isFinalMaster ? (
                            <span className="vault-used-in-pill final-master" title="This file is already an output Final Master video">
                              🎬 Final Master
                            </span>
                          ) : targetFinal.displayCompact !== '—' ? (
                            <span
                              className="vault-used-in-pill"
                              onClick={() => handleSearchTargetFinal(targetFinal.eventCode || targetFinal.displayCompact)}
                              title={`Used in Final Video: ${targetFinal.displayCompact}. Click to search!`}
                            >
                              <span className="vault-used-in-code">{targetFinal.eventCode || targetFinal.displayCompact}</span>
                              {targetFinal.dateSession && (
                                <span className="vault-used-in-date">{targetFinal.dateSession}</span>
                              )}
                            </span>
                          ) : (
                            <span style={{ opacity: 0.35 }}>—</span>
                          )}
                        </td>
                        <td>{formatBytes(item.size_bytes)}</td>
                        <td>{item.duration_formatted || '-'}</td>
                        {finalVideosOnly && (
                          <td className="vault-status-cell">
                            <div
                              style={{ cursor: 'pointer', display: 'inline-flex' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRowContextMenu(e, item)
                              }}
                              title="Click or right-click to view or manually override upload status"
                            >
                              {item.upload_status === 'uploaded' ? (
                                <span
                                  className="vault-upload-badge uploaded"
                                  title={item.uploaded_path ? `Status: Uploaded • ${item.uploaded_path}` : 'Status: Uploaded (Ready in TO UPLOAD)'}
                                >
                                  📤 Uploaded
                                </span>
                              ) : item.upload_status === 'submitted' ? (
                                <span
                                  className="vault-upload-badge submitted"
                                  title={item.uploaded_path ? `Status: Submitted • ${item.uploaded_path}` : 'Status: Submitted (Confirmed in TO DELETE / AlJamea)'}
                                >
                                  ✅ Submitted
                                </span>
                              ) : item.upload_status === 'rendered_pending' ? (
                                <span
                                  className="vault-upload-badge pending"
                                  title={item.uploaded_path ? `Status: Pending Upload • ${item.uploaded_path}` : 'Status: Rendered in Final, pending upload'}
                                >
                                  ⏳ Pending Upload
                                </span>
                              ) : item.upload_status === 'review' ? (
                                <span
                                  className="vault-upload-badge"
                                  style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#d97706', border: '1px solid rgba(234, 179, 8, 0.3)' }}
                                  title={item.uploaded_path ? `Status: In Review • ${item.uploaded_path}` : 'Status: Project rendered, in review'}
                                >
                                  👀 In Review
                                </span>
                              ) : item.upload_status === 'editing' ? (
                                <span
                                  className="vault-upload-badge"
                                  style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                                  title={item.uploaded_path ? `Status: In Editing • ${item.uploaded_path}` : 'Status: Actively in editing'}
                                >
                                  🎬 In Editing
                                </span>
                              ) : (
                                <span
                                  className="vault-upload-badge not-uploaded"
                                  title={item.uploaded_path ? `Status: Not Uploaded • ${item.uploaded_path}` : 'Status: Not Uploaded (Pending in editing or unassigned)'}
                                >
                                  ⭕ Not Uploaded
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className={`vault-conn-status ${online ? 'online' : 'offline'}`}>
                              <span className={`vault-status-dot ${online ? 'online' : 'offline'}`} />
                              <span>{online ? 'Drive Connected' : 'Drive Offline'}</span>
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>
                              💾 {item.drive_label || 'Hard Drive'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="vault-action-group">
                            {online ? (
                              <>
                                {!isFolder && (
                                  <button
                                    className="vault-btn vault-btn-primary"
                                    style={{ padding: '4px 9px', fontSize: '11px' }}
                                    onClick={() => handleLocateItem(item)}
                                    title="Highlight file in Windows Explorer"
                                  >
                                    🎯 Locate
                                  </button>
                                )}
                                <button
                                  className="vault-btn vault-btn-ghost"
                                  style={{ padding: '4px 9px', fontSize: '11px' }}
                                  onClick={() => handleOpenFolder(item)}
                                  title={isFolder ? 'Open this folder in Explorer' : 'Open enclosing folder'}
                                >
                                  📂 Open {isFolder ? 'Folder' : ''}
                                </button>
                              </>
                            ) : (
                              <button
                                className="vault-btn vault-btn-ghost"
                                style={{ padding: '4px 9px', fontSize: '11px' }}
                                onClick={() => handleCopyPath(item.full_path || item.relative_path, true)}
                                title="Copy offline path to paste when hard drive is plugged in"
                              >
                                📋 Copy Path
                              </button>
                            )}
                            <button
                              className="vault-btn vault-btn-danger"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => handleDeleteItem(item)}
                              title="Delete this record from Virtual Catalog"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          {displayedMediaItems.length > 0 && (
            <div className="vault-pagination-bar">
              <div className="vault-pagination-info">
                Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong>–<strong>{Math.min(currentPage * pageSize, displayedMediaItems.length)}</strong> of <strong>{displayedMediaItems.length.toLocaleString()}</strong> items
                {totalMediaCount > displayedMediaItems.length && (
                  <span style={{ opacity: 0.65, marginLeft: '6px' }}>
                    ({totalMediaCount.toLocaleString()} in catalog)
                  </span>
                )}
              </div>
              <div className="vault-pagination-controls">
                <select
                  className="vault-pagination-size-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  title="Items per page"
                >
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={250}>250 / page</option>
                  <option value={500}>500 / page</option>
                </select>
                <button
                  className="vault-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  title="First Page"
                >
                  ««
                </button>
                <button
                  className="vault-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  title="Previous Page"
                >
                  ◀ Prev
                </button>
                <span className="vault-page-counter">
                  Page <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
                </span>
                <button
                  className="vault-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  title="Next Page"
                >
                  Next ▶
                </button>
                <button
                  className="vault-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Last Page"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1.5: SCANNED SAFARS GALLERY & DAY COUNTS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'safars' && (
        <div className="vault-panel anim-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                📚 All Scanned Safars ({safars.length})
              </h2>
              <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                All indexed Safar archives stored permanently in SQLite. Tap any Safar card to view its total count of days, dates, and media breakdown.
              </p>
            </div>
            <button
              className="vault-btn vault-btn-primary"
              onClick={() => {
                playTick()
                setActiveTab('scan')
              }}
            >
              ⚡ Scan New Safar Folder
            </button>
          </div>

          <div className="safars-gallery-grid">
            {safars.map((safar) => {
              const dayCount = (safar as any).total_days_count || 1
              return (
                <div key={safar.id} className="safar-gallery-card">
                  <div className="safar-gallery-card-header">
                    <div>
                      <h3 className="safar-gallery-title">{safar.safar_name}</h3>
                      <div className="safar-gallery-chips" style={{ marginTop: '6px' }}>
                        {safar.city && (
                          <span
                            className={`safar-meta-chip city ${safar.city === 'Unassigned' ? 'unassigned' : ''}`}
                            title={safar.city === 'Unassigned' ? 'Location: Unassigned (City not detected in folder name)' : `Location / City: ${safar.city}`}
                          >
                            📍 {safar.city}
                          </span>
                        )}
                        {safar.safar_year && <span className="safar-meta-chip year">🗓️ {safar.safar_year} H</span>}
                        {safar.safar_serial && <span className="safar-meta-chip serial">#{safar.safar_serial}</span>}
                        {safar.drive_label && <span className="safar-meta-chip drive">💽 {safar.drive_label}</span>}
                      </div>
                    </div>
                    <span className="safar-hero-day-badge">
                      🗓️ {dayCount} {dayCount === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>

                  <div className="safar-gallery-metrics">
                    <div className="safar-metric-item">
                      <span className="safar-metric-label">Videos</span>
                      <span className="safar-metric-val">🎬 {safar.total_mp4_count || 0}</span>
                    </div>
                    <div className="safar-metric-item">
                      <span className="safar-metric-label">Photos</span>
                      <span className="safar-metric-val">📸 {safar.total_photo_count || 0}</span>
                    </div>
                    <div className="safar-metric-item">
                      <span className="safar-metric-label">Duration</span>
                      <span className="safar-metric-val">⏱️ {safar.duration_formatted || '00:00'}</span>
                    </div>
                    <div className="safar-metric-item">
                      <span className="safar-metric-label">Storage</span>
                      <span className="safar-metric-val">📦 {formatBytes(safar.total_size_bytes)}</span>
                    </div>
                  </div>

                  <div className="safar-gallery-actions">
                    <button
                      className="safar-days-popup-btn"
                      onClick={() => handleOpenDaysBreakdown(safar.id)}
                      title="Open rich day count and chronological breakdown popup"
                    >
                      ✨ Days Breakdown
                    </button>
                    {safar.root_path && (
                      <button
                        className="safar-gallery-action-btn explorer"
                        onClick={() => handleLocateFolder(safar.root_path)}
                        title="Open folder location in Explorer"
                      >
                        📂 Explorer
                      </button>
                    )}
                    <button
                      className="safar-gallery-action-btn edit"
                      onClick={() => handleOpenRenameSafar(safar)}
                      title="Change Safar name, assigned drive name, or drive letter"
                    >
                      ✏️ Edit Drive
                    </button>
                    <button
                      className="safar-gallery-action-btn move"
                      onClick={() => handleOpenBackupDriveModal(safar)}
                      title="Update metadata to mark this Safar as moved to a backup drive"
                    >
                      📦 Backup Drive
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SCAN OTHER FOLDER
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'scan' && (
        <div className="vault-panel" style={{ alignItems: 'center' }}>
          <div className="vault-scan-card" style={{ width: '100%' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Scan Other Folder or External Drive</h3>
            <p style={{ margin: '0', fontSize: '13px', color: '#94a3b8' }}>
              Deep-indexes folder names, subdirectories, file sizes, and MP4 video lengths into the SQLite catalog without storing actual video files locally.
            </p>

            <div className="vault-mapping-row">
              <label>Folder or External SSD to Scan:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ flex: 1 }}
                  placeholder="Select folder or external drive..."
                  value={folderToScan}
                  onChange={(e) => setFolderToScan(e.target.value)}
                />
                <button className="vault-btn vault-btn-ghost" onClick={handleBrowseFolder}>
                  Browse Folder
                </button>
              </div>
            </div>

            <div className="vault-mapping-row">
              <label>Hard Drive Volume Label (Optional):</label>
              <input
                placeholder="e.g. HDD-16TB-RED, Seagate_04"
                value={driveLabel}
                onChange={(e) => setDriveLabel(e.target.value)}
              />
            </div>

            {/* Scan Progress Feedback */}
            {isScanning && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div className="vault-progress-bar-bg">
                  <div className="vault-progress-bar-fill" style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#38bdf8' }}>
                  <span>Files Indexed: {scanProgress.scanned_files || 0}</span>
                  <span>Videos (MP4s): {scanProgress.total_mp4_count || 0}</span>
                  <span>Data Size: {formatBytes(scanProgress.total_size_bytes || 0)}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Current folder: {scanProgress.current_folder || 'Reading...'}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              {!isScanning ? (
                <button
                  className="vault-btn vault-btn-primary"
                  style={{ flex: 1, padding: '12px' }}
                  onClick={handleStartScan}
                >
                  ⚡ Start Virtual Catalog Scan
                </button>
              ) : (
                <button
                  className="vault-btn vault-btn-danger"
                  style={{ flex: 1, padding: '12px' }}
                  onClick={handleCancelScan}
                >
                  ⏹ Cancel Scan
                </button>
              )}
            </div>
          </div>

          {/* List of Already Cataloged Safars */}
          <div style={{ width: '100%', maxWidth: '720px', marginTop: '10px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#0F172A' }}>Already Scanned Folders & Drives ({safars.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {safars.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0F172A' }}>{s.safar_name}</strong>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                      {s.total_files} files • {s.total_mp4_count} videos • {formatBytes(s.total_size_bytes)} • {s.duration_formatted}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      className="vault-btn vault-btn-primary"
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                      onClick={() => {
                        playTick()
                        setSelectedSafarId(s.id)
                        setActiveTab('search')
                      }}
                    >
                      🔍 Search in this Folder
                    </button>
                    <button
                      className="vault-btn vault-btn-ghost"
                      style={{ padding: '5px 10px', fontSize: '12px', background: '#F8FAFC', border: '1px solid #CBD5E1' }}
                      onClick={() => handleOpenRenameSafar(s)}
                      title="Rename this Safar"
                    >
                      ✏️
                    </button>
                    <button
                      className="vault-btn vault-btn-danger"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onClick={() => handleDeleteSafar(s.id, s.safar_name)}
                      title="Remove from vault index"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: EXCEL RECONCILER & AUDIT
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'excel' && (
        <div className="vault-panel">
          {/* Workstation Excel Generator Banner */}
          <div className="vault-excel-generator-card">
            <div>
              <div className="vault-excel-generator-title">
                <span style={{ fontSize: '18px' }}>📑</span>
                <span>Workstation Excel Generation</span>
              </div>
              <div className="vault-excel-generator-sub">
                Generate production-ready spreadsheets pre-populated from your scanned safars, or download clean audit templates formatted for this page.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className="vault-btn vault-btn-primary"
                style={{ padding: '8px 14px', fontSize: '12px' }}
                disabled={isGeneratingExcel}
                onClick={() => {
                  playTick()
                  setIsExcelModalOpen(true)
                }}
                title="Select a folder or Safar to generate an official audit spreadsheet (.xlsx)"
              >
                Generate Audit Excel from Scanned Safar
              </button>
              <button
                className="vault-btn vault-btn-ghost"
                style={{ padding: '8px 14px', fontSize: '12px' }}
                disabled={isGeneratingExcel}
                onClick={handleGenerateTemplateExcel}
                title="Download a clean audit spreadsheet template with all 34 official event codes"
              >
                Download Clean Audit Template (.xlsx)
              </button>
            </div>
          </div>

          <div className="vault-audit-setup">
            {/* Left: Drag and drop or browse Excel */}
            <div className="vault-dropzone" onClick={handleBrowseExcel}>
              <span className="vault-dropzone-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
              </span>
              <div>
                <strong>{excelPath ? excelPath.split(/[/\\]/).pop() : 'Click to Browse Current Excel File (.xlsx)'}</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  {excelPath || 'Audits current production sheets against historical archives with dual-calendar normalization.'}
                </p>
              </div>
            </div>

            {/* Right: Mapping & Controls */}
            <div className="vault-mapping-card">
              <div className="vault-mapping-row">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Target Safar to Audit Against:</span>
                  <span style={{ fontSize: '11px', color: '#0284C7', fontWeight: 600 }}>
                    Strictly selected from app dropdown
                  </span>
                </label>
                <SafarSearchSelect
                  safars={safars}
                  selectedId={excelAuditTargetSafar}
                  onSelect={(id) => {
                    playTick()
                    if (typeof id === 'number') {
                      setExcelAuditTargetSafar(id)
                      setAuditDateFilter('')
                    }
                  }}
                  placeholder="Select or search Scanned Safar..."
                  style={{ width: '100%' }}
                />
              </div>

              {/* Optional Date Session Filter */}
              <div className="vault-mapping-row">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Optional Date Filter (Date Folder / Session):</span>
                  {auditDateFilter && (
                    <span
                      style={{ fontSize: '11px', color: '#0284C7', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => setAuditDateFilter('')}
                    >
                      ✕ Clear date filter
                    </span>
                  )}
                </label>
                <DateSearchSelect
                  dates={auditDates}
                  selectedDate={auditDateFilter}
                  onSelect={(dt) => {
                    playTick()
                    setAuditDateFilter(dt)
                  }}
                  loading={isLoadingAuditDates}
                  placeholder="All Date Folders (No filter)"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div className="vault-mapping-row">
                  <label>Date Column:</label>
                  <input value={colDate} onChange={(e) => setColDate(e.target.value)} />
                </div>
                <div className="vault-mapping-row">
                  <label>Folder/Session:</label>
                  <input value={colFolder} onChange={(e) => setColFolder(e.target.value)} />
                </div>
                <div className="vault-mapping-row">
                  <label>Filename Column:</label>
                  <input value={colFile} onChange={(e) => setColFile(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  className="vault-btn vault-btn-primary"
                  style={{ flex: 1 }}
                  disabled={isAuditing}
                  onClick={handleRunReconciliation}
                >
                  {isAuditing ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spin-slow"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      Auditing...
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 9V4s3.03.55 4 2c1.08 1.62 0 5 0 5"/></svg>
                      Run Reconciliation Audit
                    </span>
                  )}
                </button>
                {auditRecords.length > 0 && (
                  <button
                    className="vault-btn vault-btn-ghost"
                    onClick={handleExportAudit}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Export .xlsx
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Shimmering Skeleton Loader during audit */}
          {isAuditing && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0284C7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="vault-live-dot" />
                <span>Reconciling Excel records against SQLite catalog with dual-calendar normalization...</span>
              </div>
              <SkeletonTable rows={6} columns={6} />
            </div>
          )}

          {/* Audit Summary KPIs */}
          {auditSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Folder Summary KPI Bar */}
              <div className="vault-stats-grid">
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Total Excel Folders</span>
                  <span className="vault-stat-value">{auditSummary.total_excel_folders ?? auditFolderSummary.length}</span>
                  <span className="vault-stat-sub">in uploaded Excel</span>
                </div>
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Archive Folders</span>
                  <span className="vault-stat-value">{auditSummary.total_archive_folders ?? '-'}</span>
                  <span className="vault-stat-sub">in target Safar</span>
                </div>
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Balanced Folders</span>
                  <span className="vault-stat-value" style={{ color: '#16a34a' }}>
                    {auditSummary.balanced_folder_count ?? auditFolderSummary.filter(f => f.status === 'BALANCED').length}
                  </span>
                  <span className="vault-stat-sub">File counts & names equal</span>
                </div>
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Count Mismatches</span>
                  <span className="vault-stat-value" style={{ color: '#d97706' }}>
                    {auditSummary.mismatched_folder_count ?? auditFolderSummary.filter(f => f.status === 'COUNT_MISMATCH').length}
                  </span>
                  <span className="vault-stat-sub">File count difference</span>
                </div>
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Missing in Archive</span>
                  <span className="vault-stat-value" style={{ color: '#dc2626' }}>
                    {auditSummary.missing_folder_count ?? auditFolderSummary.filter(f => f.status === 'MISSING_IN_ARCHIVE').length}
                  </span>
                  <span className="vault-stat-sub">Folders not found</span>
                </div>
              </div>

              {/* File Summary KPI Bar */}
              <div className="vault-stats-grid">
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Total Excel Files</span>
                  <span className="vault-stat-value">{auditSummary.total_excel_rows}</span>
                </div>
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Exact Matched Files</span>
                  <span className="vault-stat-value" style={{ color: '#4ade80' }}>
                    {auditSummary.matched_exact_count}
                  </span>
                  <span className="vault-stat-sub">Aligned date & folder</span>
                </div>
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Date/Session Shift</span>
                  <span className="vault-stat-value" style={{ color: '#facc15' }}>
                    {auditSummary.matched_shifted_count}
                  </span>
                  <span className="vault-stat-sub">Found with naming variance</span>
                </div>
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Missing Clips</span>
                  <span className="vault-stat-value" style={{ color: '#f87171' }}>
                    {auditSummary.missing_count}
                  </span>
                  <span className="vault-stat-sub">Not in scanned folders</span>
                </div>
                <div className="vault-stat-card">
                  <span className="vault-stat-label">Overall Accuracy</span>
                  <span className="vault-stat-value">{auditSummary.accuracy_rate}%</span>
                </div>
              </div>
            </div>
          )}

          {/* View Switcher: Folder Breakdown vs File Matrix */}
          {(auditFolderSummary.length > 0 || auditRecords.length > 0) && (
            <div className="vault-panel">
              <div className="vault-view-switch-bar">
                <div className="vault-view-switch-tabs">
                  <button
                    type="button"
                    className={`vault-view-switch-tab ${auditTabMode === 'folders' ? 'active' : ''}`}
                    onClick={() => {
                      playTick()
                      setAuditTabMode('folders')
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      Folder-by-Folder Breakdown ({auditFolderSummary.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`vault-view-switch-tab ${auditTabMode === 'files' ? 'active' : ''}`}
                    onClick={() => {
                      playTick()
                      setAuditTabMode('files')
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                      File-by-File Matrix ({auditRecords.length})
                    </span>
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Target Safar: <strong>{safars.find(s => s.id === excelAuditTargetSafar)?.safar_name || 'Selected Safar'}</strong>
                  {auditDateFilter && <span> • Date: <strong>{auditDateFilter}</strong></span>}
                </div>
              </div>

              {auditTabMode === 'folders' ? (
                /* FOLDER BREAKDOWN VIEW */
                <div>
                  <div className="vault-filter-pills" style={{ marginBottom: '12px' }}>
                    <button
                      className={`vault-pill ${auditFolderFilterStatus === 'ALL' ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setAuditFolderFilterStatus('ALL')
                      }}
                    >
                      ALL FOLDERS ({auditFolderSummary.length})
                    </button>
                    <button
                      className={`vault-pill ${auditFolderFilterStatus === 'BALANCED' ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setAuditFolderFilterStatus('BALANCED')
                      }}
                    >
                      🟢 BALANCED ({auditSummary?.balanced_folder_count ?? auditFolderSummary.filter(f => f.status === 'BALANCED').length})
                    </button>
                    <button
                      className={`vault-pill ${auditFolderFilterStatus === 'COUNT_MISMATCH' ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setAuditFolderFilterStatus('COUNT_MISMATCH')
                      }}
                    >
                      ⚠️ COUNT MISMATCH ({auditSummary?.mismatched_folder_count ?? auditFolderSummary.filter(f => f.status === 'COUNT_MISMATCH').length})
                    </button>
                    <button
                      className={`vault-pill ${auditFolderFilterStatus === 'MISSING_IN_ARCHIVE' ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setAuditFolderFilterStatus('MISSING_IN_ARCHIVE')
                      }}
                    >
                      🔴 MISSING IN ARCHIVE ({auditSummary?.missing_folder_count ?? auditFolderSummary.filter(f => f.status === 'MISSING_IN_ARCHIVE').length})
                    </button>
                    <button
                      className={`vault-pill ${auditFolderFilterStatus === 'EXTRA_IN_ARCHIVE' ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setAuditFolderFilterStatus('EXTRA_IN_ARCHIVE')
                      }}
                    >
                      📦 EXTRA IN ARCHIVE ({auditSummary?.extra_folder_count ?? auditFolderSummary.filter(f => f.status === 'EXTRA_IN_ARCHIVE').length})
                    </button>
                  </div>

                  <div className="vault-table-wrapper">
                    <table className="vault-table">
                      <thead>
                        <tr>
                          <th>Folder / Session Name</th>
                          <th>Matched Archive Folder</th>
                          <th>Date / Session</th>
                          <th style={{ textAlign: 'center' }}>Excel Files</th>
                          <th style={{ textAlign: 'center' }}>Archive Files</th>
                          <th style={{ textAlign: 'center' }}>Matched</th>
                          <th style={{ textAlign: 'center' }}>Missing</th>
                          <th style={{ textAlign: 'center' }}>Difference</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAuditFolders.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                              No folders matching this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredAuditFolders.map((f, idx) => {
                            const diff = f.difference
                            return (
                              <tr key={idx}>
                                <td>
                                  <div className="vault-folder-name-cell">
                                    <span className="vault-folder-main-title">{f.folder_name}</span>
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#334155' }}>
                                    {f.matched_archive_path}
                                  </span>
                                </td>
                                <td>{f.date_val || '-'}</td>
                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{f.excel_file_count}</td>
                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{f.archive_file_count}</td>
                                <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{f.matched_files}</td>
                                <td style={{ textAlign: 'center', color: f.missing_files > 0 ? '#dc2626' : '#94a3b8', fontWeight: 600 }}>
                                  {f.missing_files}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span
                                    className={`vault-diff-badge ${
                                      diff === 0 ? 'diff-zero' : diff > 0 ? 'diff-missing' : 'diff-extra'
                                    }`}
                                  >
                                    {diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span
                                    className={`status-pill ${
                                      f.status === 'BALANCED'
                                        ? 'status-balanced'
                                        : f.status === 'COUNT_MISMATCH'
                                        ? 'status-mismatch'
                                        : f.status === 'MISSING_IN_ARCHIVE'
                                        ? 'status-missing'
                                        : 'status-extra'
                                    }`}
                                  >
                                    {f.status.replace(/_/g, ' ')}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* FILE MATRIX VIEW */
                <div>
                  <div className="vault-filter-pills" style={{ marginBottom: '12px' }}>
                    <button
                      className={`vault-pill ${auditFilterStatus === 'ALL' ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setAuditFilterStatus('ALL')
                      }}
                    >
                      ALL ({auditRecords.length})
                    </button>
                    <button
                      className={`vault-pill ${auditFilterStatus === 'EXACT' ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setAuditFilterStatus('EXACT')
                      }}
                    >
                      🟢 EXACT ({auditSummary?.matched_exact_count})
                    </button>
                    <button
                      className={`vault-pill ${auditFilterStatus === 'SHIFTED' ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setAuditFilterStatus('SHIFTED')
                      }}
                    >
                      🟡 SHIFTED ({auditSummary?.matched_shifted_count})
                    </button>
                    <button
                      className={`vault-pill ${auditFilterStatus === 'MISSING' ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setAuditFilterStatus('MISSING')
                      }}
                    >
                      🔴 MISSING ({auditSummary?.missing_count})
                    </button>
                  </div>

                  <div className="vault-table-wrapper">
                    <table className="vault-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Excel Date</th>
                          <th>Excel Folder</th>
                          <th>Excel Filename</th>
                          <th>Status</th>
                          <th>Confidence</th>
                          <th>Matched Archive Location</th>
                          <th>Duration</th>
                          <th>Explanation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAuditRecords.map((rec) => (
                          <tr key={rec.row_index}>
                            <td>{rec.row_index}</td>
                            <td>{rec.raw_date}</td>
                            <td>{rec.raw_folder}</td>
                            <td>
                              <strong>{rec.raw_file}</strong>
                            </td>
                            <td>
                              <span
                                className={`status-pill ${
                                  rec.match_status === 'EXACT'
                                    ? 'status-exact'
                                    : rec.match_status.includes('SHIFT')
                                    ? 'status-shifted'
                                    : 'status-missing'
                                }`}
                              >
                                {rec.match_status}
                              </span>
                            </td>
                            <td>{Math.round(rec.confidence * 100)}%</td>
                            <td>{rec.matched_item?.folder_path || '-'}</td>
                            <td>{rec.matched_item?.duration_formatted || '-'}</td>
                            <td style={{ maxWidth: '280px', fontSize: '11.5px', opacity: 0.85 }}>
                              {rec.explanation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: HARD DRIVE TRACKER
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'drives' && (
        <div className="vault-panel">
          <div className="vault-table-wrapper">
            <table className="vault-table">
              <thead>
                <tr>
                  <th>Volume Label</th>
                  <th>Safars Stored</th>
                  <th>Total Archived Size</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {drives.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '30px' }}>
                      No physical drives registered yet. Enter a drive label when scanning a folder to track your drives!
                    </td>
                  </tr>
                ) : (
                  drives.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>💾 {d.volume_label}</strong>
                      </td>
                      <td>{d.archive_count || 0} Safars</td>
                      <td>{formatBytes(d.total_stored_bytes || 0)}</td>
                      <td>{d.last_seen_date || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: VAULT INTELLIGENCE ASSISTANT ("ASK ARCHIVE")
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'assistant' && (
        <div className="vault-panel" style={{ padding: '0', background: 'transparent' }}>
          <div className="vault-assistant-container">
            {/* Header */}
            <div className="vault-assistant-header">
              <div className="vault-assistant-title">
                <span style={{ fontSize: '20px' }}>💬</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800 }}>Vault Intelligence Assistant</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>
                    Natural language queries across events, dates, sessions, and upload statuses
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="vault-btn vault-btn-ghost"
                  style={{ color: '#E2E8F0', borderColor: 'rgba(255,255,255,0.2)', fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => {
                    playTick()
                    setChatMessages([
                      {
                        id: 'welcome',
                        sender: 'assistant',
                        text: 'Assistant cleared. Ask me any question about your archived media, event counts, sessions, or missing uploads!',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      }
                    ])
                  }}
                  title="Clear conversation"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Clear Chat
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="vault-assistant-chips-row">
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Quick Prompts:
              </span>
              <button
                type="button"
                className="vault-chip-btn"
                onClick={() => handleSendChatQuery('how many Qadam were there in 1448-10-18_01M')}
              >
                ⚡ How many Qadam in 1448-10-18_01M?
              </button>
              <button
                type="button"
                className="vault-chip-btn"
                onClick={() => handleSendChatQuery('how many nikah in karachi')}
              >
                ⚡ How many Nikah in Karachi?
              </button>
              <button
                type="button"
                className="vault-chip-btn"
                onClick={() => handleSendChatQuery('show unuploaded videos')}
              >
                ⚡ Show unuploaded clips
              </button>
              <button
                type="button"
                className="vault-chip-btn"
                onClick={() => handleSendChatQuery('how many majlis in this safar')}
              >
                ⚡ How many Majlis in this Safar?
              </button>
              <button
                type="button"
                className="vault-chip-btn"
                onClick={() => handleSendChatQuery('how many qadam in 1448')}
              >
                ⚡ Total Qadam in 1448
              </button>
            </div>

            {/* Chat Messages */}
            <div className="vault-chat-messages-area">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`vault-chat-msg ${msg.sender}`}>
                  <div className="vault-chat-bubble">
                    <div style={{ whiteSpace: 'pre-wrap', fontWeight: msg.sender === 'user' ? 600 : 400 }}>
                      {msg.text}
                    </div>

                    {/* Rich Response: Item Preview Table & Actions */}
                    {msg.data && msg.data.items && msg.data.items.length > 0 && (
                      <div className="vault-chat-table-wrapper">
                        <table className="vault-chat-table">
                          <thead>
                            <tr>
                              <th>File Name</th>
                              <th>Event</th>
                              <th>Duration</th>
                              <th>Size</th>
                              <th>Status</th>
                              <th>Date / Session</th>
                            </tr>
                          </thead>
                          <tbody>
                            {msg.data.items.slice(0, 15).map((it: any, idx: number) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 600, color: '#0F172A' }}>{it.file}</td>
                                <td>
                                  <span style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                                    {it.event || '—'}
                                  </span>
                                </td>
                                <td style={{ fontFamily: 'monospace' }}>{it.duration || '—'}</td>
                                <td>{it.size_mb ? it.size_mb.toFixed(1) + ' MB' : '—'}</td>
                                <td>
                                  <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: it.status === 'UPLOADED' ? '#D1FAE5' : '#FEF3C7',
                                    color: it.status === 'UPLOADED' ? '#065F46' : '#92400E'
                                  }}>
                                    {it.status}
                                  </span>
                                </td>
                                <td style={{ color: '#64748B', fontSize: '11px' }}>{it.date || it.folder}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Action Buttons for Assistant Message */}
                    {msg.data && msg.data.items && msg.data.items.length > 0 && (
                      <div className="vault-chat-actions">
                        <button
                          type="button"
                          className="vault-btn vault-btn-primary"
                          style={{ padding: '6px 14px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => handleDownloadQueryExcel(msg.data.query, msg.data.items)}
                          title="Export query matches into a segregated Excel spreadsheet"
                        >
                          <span>📥</span> Download Query Excel ({msg.data.items.length} clips)
                        </button>
                        {msg.data.items[0]?.archive_id && (
                          <button
                            type="button"
                            className="vault-btn vault-btn-ghost"
                            style={{ padding: '6px 14px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => handleExportSafarPdf(msg.data.items[0].archive_id)}
                            title="Export Safar PDF Audit Report"
                          >
                            <span>📄</span> Export Safar PDF
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="vault-chat-time">{msg.timestamp}</div>
                </div>
              ))}

              {isChatSearching && (
                <div className="vault-chat-msg assistant">
                  <div className="vault-chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B' }}>
                    <span>⏳</span>
                    <span>Querying SQLite archive database & analyzing events...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="vault-chat-input-bar">
              <input
                type="text"
                className="vault-chat-input"
                placeholder='Ask a question (e.g. "how many Qadam were there in 1448-10-18_01M" or "how many nikah in karachi")...'
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendChatQuery()
                }}
              />
              <button
                type="button"
                className="vault-chat-send-btn"
                disabled={!chatInput.trim() || isChatSearching}
                onClick={() => handleSendChatQuery()}
              >
                <span>Send</span>
                <span>➤</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workstation Excel Generation Modal */}
      <GenerateExcelModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        safars={safars}
        initialSafarId={typeof selectedSafarId === 'number' ? selectedSafarId : excelAuditTargetSafar}
        onLoadIntoReconciler={handleLoadIntoReconciler}
        playTick={playTick}
        playSuccess={playSuccess}
        playError={playError}
        showToast={showToast}
      />

      {/* ─────────────────────────────────────────────────────────────
          BOUNCY SPRING POPUP MODAL: SAFAR DAYS BREAKDOWN
      ───────────────────────────────────────────────────────────── */}
      {isBreakdownModalOpen && (
        <div className="safar-days-modal-overlay" onClick={() => setIsBreakdownModalOpen(false)}>
          <div
            className="safar-days-modal-card anim-popup-bounce"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="safar-days-modal-header">
              <div className="safar-days-modal-title">
                <span>🗓️</span>
                <span>{selectedBreakdownSafar?.safar_name || 'Safar Day Manifest'}</span>
                {selectedBreakdownSafar?.city && (
                  <span
                    className={`safar-meta-chip city ${selectedBreakdownSafar.city === 'Unassigned' ? 'unassigned' : ''}`}
                    style={{ fontSize: '12px' }}
                    title={selectedBreakdownSafar.city === 'Unassigned' ? 'Location: Unassigned (City not detected in folder name)' : `Location / City: ${selectedBreakdownSafar.city}`}
                  >
                    📍 {selectedBreakdownSafar.city}
                  </span>
                )}
                <button
                  type="button"
                  className="vault-btn vault-btn-ghost"
                  style={{ padding: '3px 8px', fontSize: '11px', border: '1px solid #CBD5E1', borderRadius: '6px', marginLeft: '6px' }}
                  onClick={() => {
                    setIsBreakdownModalOpen(false)
                    const target = safars.find(s => s.id === selectedBreakdownSafar?.archive_id) || selectedBreakdownSafar
                    if (target) handleOpenRenameSafar(target)
                  }}
                  title="Change Drive Name, Letter, or Safar Name"
                >
                  ✏️ Edit Drive
                </button>
              </div>
              <button
                className="safar-days-modal-close"
                onClick={() => setIsBreakdownModalOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="safar-days-modal-body">
              {isBreakdownLoading ? (
                <div style={{ padding: '50px', textAlign: 'center', color: '#94A3B8' }}>
                  <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>Calculating day counts & chronological breakdown...</div>
                </div>
              ) : selectedBreakdownSafar ? (
                <>
                  {/* Glowing Hero Banner */}
                  <div className="safar-days-hero-banner">
                    <div className="safar-hero-count-row">
                      <div className="safar-hero-large-count">
                        <span>🗓️</span>
                        <span>{selectedBreakdownSafar.total_days_count} Days Safar</span>
                      </div>
                      <div className="safar-hero-date-range">
                        📅 {selectedBreakdownSafar.first_date} ➔ {selectedBreakdownSafar.last_date}
                      </div>
                    </div>

                    <div className="safar-hero-summary-grid">
                      <div className="safar-hero-sum-item">
                        <span className="safar-hero-sum-label">Total Videos</span>
                        <span className="safar-hero-sum-val">🎬 {selectedBreakdownSafar.total_mp4_count}</span>
                      </div>
                      <div className="safar-hero-sum-item">
                        <span className="safar-hero-sum-label">Total Photos</span>
                        <span className="safar-hero-sum-val">📸 {selectedBreakdownSafar.total_photo_count}</span>
                      </div>
                      <div className="safar-hero-sum-item">
                        <span className="safar-hero-sum-label">Total Duration</span>
                        <span className="safar-hero-sum-val">⏱️ {selectedBreakdownSafar.total_duration_formatted}</span>
                      </div>
                      <div className="safar-hero-sum-item">
                        <span className="safar-hero-sum-label">Total Storage</span>
                        <span className="safar-hero-sum-val">💾 {formatBytes(selectedBreakdownSafar.total_size_bytes)}</span>
                      </div>
                      <div className="safar-hero-sum-item">
                        <span className="safar-hero-sum-label">Storage Drive</span>
                        <span className="safar-hero-sum-val">💽 {selectedBreakdownSafar.drive_label || 'Hard Drive'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Chronological Day-by-Day List */}
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                      📋 Chronological Day Breakdown ({selectedBreakdownSafar.days?.length || 0} Dates)
                    </h4>
                    <div className="safar-days-timeline-list">
                      {selectedBreakdownSafar.days?.map((day: any) => (
                        <div key={day.day_number} className="safar-day-timeline-card">
                          <div className="safar-day-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span className="safar-day-index-badge">DAY {day.day_number}</span>
                              <span className="safar-day-date-label">📅 {day.date_key}</span>
                              {day.sessions?.map((s: string) => (
                                <span key={s} className="safar-day-session-tag">
                                  🏷️ {s}
                                </span>
                              ))}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#4F46E5' }}>
                              🎬 {day.mp4_count} vids · 📸 {day.photo_count} photos · ⏱️ {day.duration_formatted}
                            </div>
                          </div>

                          {day.folders && day.folders.length > 0 && (
                            <div className="safar-day-subfolders-list">
                              {day.folders.map((f: any) => (
                                <div key={f.id} className="safar-day-subfolder-row">
                                  <span>📁 {f.folder_name}</span>
                                  <span>
                                    {f.mp4_count} vids, {f.photo_count} photos · {formatBytes(f.size_bytes)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="safar-days-modal-footer">
              <button
                className="vault-btn vault-btn-ghost"
                onClick={() => handleCopyWhatsAppBreakdown(selectedBreakdownSafar)}
              >
                📋 Copy WhatsApp Schedule
              </button>
              <button
                className="vault-btn vault-btn-primary"
                style={{ background: '#DC2626', color: '#fff', border: 'none' }}
                onClick={() => handleExportSafarPdf(selectedBreakdownSafar?.archive_id || selectedBreakdownSafar?.id)}
                title="Export executive styled Safar PDF audit report"
              >
                📄 Export PDF Report
              </button>
              <button
                className="vault-btn vault-btn-primary"
                onClick={() => setIsBreakdownModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Right-Click / Badge Status Override Context Menu */}
      {contextMenu && (
        <div
          className="vault-context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.mouseY,
            left: contextMenu.mouseX,
            zIndex: 999999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="vault-context-header">
            <div style={{ fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contextMenu.item.file_name}
            </div>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
              Override Upload Status
            </div>
          </div>
          <button
            type="button"
            className={`vault-context-item ${contextMenu.item.upload_status === 'uploaded' ? 'active' : ''}`}
            onClick={() => handleSetUploadStatus(contextMenu.item, 'uploaded')}
          >
            <span>🟢</span>
            <span>Mark as Uploaded</span>
            {contextMenu.item.upload_status === 'uploaded' && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
          </button>
          <button
            type="button"
            className={`vault-context-item ${contextMenu.item.upload_status === 'rendered_pending' ? 'active' : ''}`}
            onClick={() => handleSetUploadStatus(contextMenu.item, 'rendered_pending')}
          >
            <span>🟡</span>
            <span>Mark as Pending</span>
            {contextMenu.item.upload_status === 'rendered_pending' && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
          </button>
          <button
            type="button"
            className={`vault-context-item ${contextMenu.item.upload_status === 'submitted' ? 'active' : ''}`}
            onClick={() => handleSetUploadStatus(contextMenu.item, 'submitted')}
          >
            <span>🔵</span>
            <span>Mark as Submitted</span>
            {contextMenu.item.upload_status === 'submitted' && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
          </button>
          <div className="vault-context-divider" />
          <button
            type="button"
            className={`vault-context-item ${(!contextMenu.item.upload_status || contextMenu.item.upload_status === 'not_uploaded') ? 'active' : ''}`}
            onClick={() => handleSetUploadStatus(contextMenu.item, 'not_uploaded')}
          >
            <span>⭕</span>
            <span>Reset (Not Uploaded)</span>
            {(!contextMenu.item.upload_status || contextMenu.item.upload_status === 'not_uploaded') && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
          </button>
        </div>
      )}
      {/* Safar Rename Modal */}
      {renameSafarModal.isOpen && renameSafarModal.safar && (
        <div className="safar-days-modal-overlay" onClick={() => setRenameSafarModal(prev => ({ ...prev, isOpen: false }))}>
          <div
            className="safar-days-modal-card anim-popup-bounce"
            style={{ maxWidth: '580px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>✏️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                    Edit Safar & Storage Drive
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Update Safar name, assigned physical drive, and drive letter.
                  </div>
                </div>
              </div>
              <button
                className="vault-btn vault-btn-ghost"
                style={{ padding: '4px 8px' }}
                onClick={() => setRenameSafarModal(prev => ({ ...prev, isOpen: false }))}
              >
                ✕
              </button>
            </div>

            {/* ── SECTION 1: SAFAR IDENTITY ── */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🏷️ Safar Name & Metadata
                </span>
                {/* Mode Switcher */}
                <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '3px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    className={`vault-btn ${!renameSafarModal.isStructured ? 'vault-btn-primary' : 'vault-btn-ghost'}`}
                    style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px' }}
                    onClick={() => setRenameSafarModal(prev => ({ ...prev, isStructured: false }))}
                  >
                    Custom Name
                  </button>
                  <button
                    type="button"
                    className={`vault-btn ${renameSafarModal.isStructured ? 'vault-btn-primary' : 'vault-btn-ghost'}`}
                    style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px' }}
                    onClick={() => setRenameSafarModal(prev => ({ ...prev, isStructured: true }))}
                  >
                    Structured (Year/Serial/City)
                  </button>
                </div>
              </div>

              {!renameSafarModal.isStructured ? (
                <div>
                  <input
                    type="text"
                    value={renameSafarModal.newName}
                    onChange={(e) => setRenameSafarModal(prev => ({ ...prev, newName: e.target.value }))}
                    placeholder="e.g. 1448-02 Raipur"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Hijri Year
                    </label>
                    <input
                      type="text"
                      value={renameSafarModal.year}
                      onChange={(e) => setRenameSafarModal(prev => ({ ...prev, year: e.target.value }))}
                      placeholder="1448"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Serial
                    </label>
                    <input
                      type="text"
                      value={renameSafarModal.serial}
                      onChange={(e) => setRenameSafarModal(prev => ({ ...prev, serial: e.target.value }))}
                      placeholder="02"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      City / Venue
                    </label>
                    <input
                      type="text"
                      value={renameSafarModal.cityName}
                      onChange={(e) => setRenameSafarModal(prev => ({ ...prev, cityName: e.target.value }))}
                      placeholder="Raipur"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── SECTION 2: STORAGE DRIVE & LETTER ASSIGNMENT ── */}
            <div className="vault-drive-section">
              <div className="vault-drive-section-title">
                <span>💾 Storage Drive & Drive Letter</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'none' }}>
                  Auto-updates all media paths
                </span>
              </div>

              {/* Drive Letter Chips Selector */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Select Drive Letter:
                </label>
                <div className="vault-drive-chips-row">
                  {['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Z'].map((letter) => {
                    const isCurrent = renameSafarModal.driveLetter.toUpperCase() === letter
                    return (
                      <button
                        key={letter}
                        type="button"
                        className={`vault-drive-chip ${isCurrent ? 'active' : ''}`}
                        onClick={() => handleSelectDriveLetter(letter)}
                      >
                        {letter}:
                      </button>
                    )
                  })}
                  <input
                    type="text"
                    maxLength={1}
                    value={renameSafarModal.driveLetter}
                    onChange={(e) => handleSelectDriveLetter(e.target.value)}
                    placeholder="Other"
                    title="Enter custom drive letter (A-Z)"
                    style={{
                      width: '45px',
                      padding: '4px 6px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Drive Volume Label Name */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Hard Drive Volume Name / Label:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    list="vault-registered-drives-list"
                    type="text"
                    value={renameSafarModal.driveLabel}
                    onChange={(e) => setRenameSafarModal(prev => ({ ...prev, driveLabel: e.target.value }))}
                    placeholder="e.g. Seagate_16TB_Archive, Drive_D_Archive, WD_Black"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '7px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                  <datalist id="vault-registered-drives-list">
                    {drives.map((d) => (
                      <option key={d.id} value={d.volume_label} />
                    ))}
                  </datalist>
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '3px' }}>
                  Select an existing cataloged drive or enter a new drive volume label to register it.
                </div>
              </div>

              {/* Live Root Path Preview & Folder Browser */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                    Safar Directory Path on Disk:
                  </label>
                  <button
                    type="button"
                    className="vault-btn vault-btn-ghost"
                    style={{ padding: '3px 8px', fontSize: '11px', border: '1px solid #CBD5E1' }}
                    onClick={handleBrowseSafarPath}
                    title="Browse Explorer to pick folder if moved to another path"
                  >
                    📁 Browse Folder...
                  </button>
                </div>
                <div className="vault-path-preview-box">
                  <span className="vault-path-text" title={renameSafarModal.rootPath}>
                    {renameSafarModal.rootPath || 'Path not configured'}
                  </span>
                  <span className={`vault-path-status-badge ${renameSafarModal.pathExists ? 'online' : 'offline'}`}>
                    <span>{renameSafarModal.pathExists ? '🟢 Connected' : '🟡 Drive Offline'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="vault-btn vault-btn-ghost"
                onClick={() => setRenameSafarModal(prev => ({ ...prev, isOpen: false }))}
                disabled={renameSafarModal.saving}
              >
                Cancel
              </button>
              <button
                className="vault-btn vault-btn-primary"
                onClick={handleConfirmRenameSafar}
                disabled={renameSafarModal.saving}
              >
                {renameSafarModal.saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BACKUP DRIVE MODAL (Issue 9) ── */}
      {backupDriveModal.isOpen && backupDriveModal.safar && (
        <div className="vault-modal-backdrop anim-fade-in" onClick={() => setBackupDriveModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="vault-modal-card anim-scale-up" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="vault-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📦</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Move to Backup Drive (Metadata)
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748B' }}>
                    Update storage catalog records when archive is transferred to cold storage or secondary SSD
                  </p>
                </div>
              </div>
              <button
                className="vault-modal-close-btn"
                onClick={() => setBackupDriveModal(prev => ({ ...prev, isOpen: false }))}
              >
                ✕
              </button>
            </div>

            <div className="vault-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 0' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Target Safar</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                  {backupDriveModal.safar.safar_name}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                  Current Path: <code>{backupDriveModal.safar.root_path || 'None'}</code>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  New Backup Drive Letter:
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {['E', 'F', 'G', 'H', 'Z'].map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      className={`vault-drive-chip ${backupDriveModal.driveLetter.toUpperCase() === letter ? 'active' : ''}`}
                      onClick={() => {
                        playTick()
                        setBackupDriveModal(prev => ({ ...prev, driveLetter: letter }))
                      }}
                    >
                      {letter}:
                    </button>
                  ))}
                  <input
                    type="text"
                    maxLength={2}
                    value={backupDriveModal.driveLetter}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase()
                      setBackupDriveModal(prev => ({ ...prev, driveLetter: v }))
                    }}
                    placeholder="Letter"
                    style={{
                      width: '60px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '12px',
                      fontWeight: 700,
                      textAlign: 'center'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Backup Drive Label / Volume Name:
                </label>
                <input
                  type="text"
                  value={backupDriveModal.driveLabel}
                  onChange={(e) => setBackupDriveModal(prev => ({ ...prev, driveLabel: e.target.value }))}
                  placeholder="e.g. WD_4TB_Archive, Seagate_ColdStorage"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '4px' }}>
                  ℹ️ This is a <strong>metadata-only</strong> operation. File contents will not be physically moved over the network.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                className="vault-btn vault-btn-ghost"
                onClick={() => setBackupDriveModal(prev => ({ ...prev, isOpen: false }))}
                disabled={backupDriveModal.saving}
              >
                Cancel
              </button>
              <button
                className="vault-btn vault-btn-primary"
                onClick={handleConfirmMoveBackupDrive}
                disabled={backupDriveModal.saving}
              >
                {backupDriveModal.saving ? 'Saving...' : '📦 Confirm Drive Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
