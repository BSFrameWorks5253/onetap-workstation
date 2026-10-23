import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PAGE_META } from '../../types'
import { Card } from '../../components/Card'
import AnimateNumber from '../../components/AnimateNumber'
import { SkeletonStatsGrid } from '../../components/Skeleton'
import { toMisriHijri, HIJRI_MONTH_NAMES_SHORT, HIJRI_MONTH_NAMES_LONG, hijriFromGregorian, HIJRI_MONTH_NAMES_ARABIC } from '../../utils/dateUtils'
import './Stats.css'
import { useToast } from '../../components/Toast'
import { parseFolderName, detectCity } from '../../utils/cityUtils'
import { parseSafarHierarchy, getPrefixColorTheme, formatPrefixName, KNOWN_PREFIX_NAMES } from '../../utils/safarUtils'
import { GhostButton } from '../../components/Button'

const meta = PAGE_META['stats']
const api = (window as any).api

interface StatRecord {
  prefix: string
  name: string
  date: number
  folder?: string
  duration?: number
  safar?: string
  safarYear?: number
  safarSerial?: string
  city?: string
  hijriYear?: number
  hijriMonth?: number
  hijriDay?: number
  session?: string
  filePath?: string
  isReedit?: boolean
}

const PREFIX_NAMES: Record<string, string> = {
  ...KNOWN_PREFIX_NAMES
}

// Timezone-safe local date formatting
const getLocalDateString = (timestamp: number): string => {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${Math.floor(seconds % 60)}s`
}

/** Resolve Safar for a record — follows Title Adder folder reading logic for new records, keeping current unassigned in Unassigned */
function resolveSafar(r: StatRecord, folderSafars?: Record<string, string>): string {
  // 1. Check user custom folder mapping
  if (folderSafars) {
    if (r.folder && folderSafars[r.folder]) return folderSafars[r.folder]
    if (r.filePath) {
      const parts = r.filePath.split(/[\\/]/)
      for (let i = parts.length - 2; i >= 0; i--) {
        const seg = parts[i]
        if (seg && folderSafars[seg]) return folderSafars[seg]
      }
    }
  }

  // Explicit Unassigned (user reassigned or deleted to Unassigned) — MUST NOT be overridden!
  if (r.safar === 'Unassigned') {
    return 'Unassigned'
  }

  // Only video file extensions or pure date strings are bogus
  const isBogus = r.safar && (
    /^\d{4}[\s-_.]\d{1,2}[\s-_.]\d{1,2}$/.test(r.safar.trim()) ||
    /\.(mp4|mov|mkv|avi|m4v|wmv)$/i.test(r.safar)
  )

  // 2. Established Safar on record
  if (r.safar && r.safar !== 'Unassigned' && !isBogus) {
    return r.safar
  }

  // 3. Read folder hierarchy using Title Adder's parser
  const hierarchy = parseSafarHierarchy(r.filePath || r.folder || '')
  if (hierarchy.safar && hierarchy.safar !== 'Unassigned') {
    return hierarchy.safar
  }

  // 4. Check if record belongs to a known city
  if (r.city && r.city !== 'Unassigned') {
    return r.city
  }
  if (hierarchy.city && hierarchy.city !== 'Unassigned') {
    return hierarchy.city
  }

  return 'Unassigned'
}

/** Resolve city for a record — respects manual mapping, Title Adder folder reading, and Mumbai detection */
function resolveCity(r: StatRecord, folderCities?: Record<string, string>): string {
  if (folderCities) {
    if (r.folder && folderCities[r.folder]) return folderCities[r.folder]
    if (r.filePath) {
      const parts = r.filePath.split(/[\\/]/)
      for (let i = parts.length - 2; i >= 0; i--) {
        const seg = parts[i]
        if (seg && folderCities[seg]) return folderCities[seg]
      }
    }
  }

  // Explicit Unassigned — MUST NOT be overridden!
  if (r.city === 'Unassigned' || r.safar === 'Unassigned') {
    return 'Unassigned'
  }

  const isMumbai = (r.city && r.city.toLowerCase() === 'mumbai') ||
                   (r.safar && r.safar.toLowerCase().includes('mumbai')) ||
                   (r.folder && r.folder.toLowerCase().includes('mumbai')) ||
                   (r.filePath && r.filePath.toLowerCase().includes('mumbai'))
  if (isMumbai) return 'Mumbai'

  if (r.city && r.city !== 'Unassigned') {
    return r.city
  }

  const hierarchy = parseSafarHierarchy(r.filePath || r.folder || '')
  if (hierarchy.city && hierarchy.city !== 'Unassigned') {
    return hierarchy.city
  }

  return 'Unassigned'
}

export default function Stats(): JSX.Element {
  const { showToast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [records, setRecords] = useState<StatRecord[]>([])
  const [startDate, setStartDate] = useState<number>(Date.now())
  const [isEditing, setIsEditing] = useState(false)
  const [showTrends, setShowTrends] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [editFolderNameValue, setEditFolderNameValue] = useState('')
  const [groupBy, setGroupBy] = useState<'none' | 'prefix' | 'date' | 'virtual'>('virtual')
  const [folderGroups, setFolderGroups] = useState<Record<string, string>>({})
  const [showEmptyCategories, setShowEmptyCategories] = useState(false)
  const [statsTab, setStatsTabState] = useState<'category' | 'safar' | 'reedit'>(() => {
    return (localStorage.getItem('ot_stats_active_tab') as any) || 'safar'
  })
  const setStatsTab = (tab: 'category' | 'safar' | 'reedit') => {
    try { localStorage.setItem('ot_stats_active_tab', tab) } catch {}
    setStatsTabState(tab)
  }
  const [selectedCity, setSelectedCity] = useState<'all' | string>('all')
  const [folderCities, setFolderCities] = useState<Record<string, string>>({})
  const [folderSafars, setFolderSafars] = useState<Record<string, string>>({})
  const [selectedSafar, setSelectedSafar] = useState<'all' | string>('all')
  const [selectedSafarDetail, setSelectedSafarDetail] = useState<string | null>(null)
  const [selectedAnalyticsYear, setSelectedAnalyticsYear] = useState<number>(() => hijriFromGregorian(new Date()).year)
  const [statsViewMode, setStatsViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('ot_stats_view_mode') as 'grid' | 'list') ?? 'grid'
  })
  const [safarSearchQuery, setSafarSearchQuery] = useState('')
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<number | null>(null)
  const [selectedMonthCategory, setSelectedMonthCategory] = useState<string | null>(null)

  const [hoveredPrefix, setHoveredPrefix] = useState<string | null>(null)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null)
  const [hoveredSafar, setHoveredSafar] = useState<string | null>(null)
  const [hoveredCity, setHoveredCity] = useState<string | null>(null)
  const [selectedCityDetail, setSelectedCityDetail] = useState<string | null>(null)

  // Context Menu & Deletion Modal States
  const [safarContextMenu, setSafarContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    safar: string
  } | null>(null)

  const [safarDeleteModal, setSafarDeleteModal] = useState<{
    isOpen: boolean
    safar: string
    count: number
  } | null>(null)

  const [safarRenameModal, setSafarRenameModal] = useState<{
    isOpen: boolean
    oldSafar: string
    name: string
    serial: string
    year: string
    city: string
    customTag: string
    useDirectTag: boolean
  } | null>(null)

  // Safar Multi-selection State (File manager Ctrl/Shift select)
  const [selectedSafarBlocks, setSelectedSafarBlocks] = useState<string[]>([])
  const [lastSelectedSafarIndex, setLastSelectedSafarIndex] = useState<number | null>(null)
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false)

  // Hidden Sync Old Data Tool State
  const [showSyncOldDataModal, setShowSyncOldDataModal] = useState(false)
  const [syncSafarDir, setSyncSafarDir] = useState('')
  const [syncMainDir, setSyncMainDir] = useState('')
  const [syncFinalDir, setSyncFinalDir] = useState('')
  const [detectedSafarPreview, setDetectedSafarPreview] = useState<{
    safarName?: string
    serial?: string
    year?: number
    city?: string
  } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgressMsg, setSyncProgressMsg] = useState('')
  const [syncResult, setSyncResult] = useState<{
    totalScanned?: number
    inserted?: number
    updated?: number
    safars?: string[]
    error?: string
  } | null>(null)

  const titleClickCountRef = useRef(0)
  const titleClickTimerRef = useRef<any>(null)

  const handleTitleClick = () => {
    titleClickCountRef.current += 1
    if (titleClickTimerRef.current) clearTimeout(titleClickTimerRef.current)
    if (titleClickCountRef.current >= 3) {
      titleClickCountRef.current = 0
      setShowSyncOldDataModal(true)
    } else {
      titleClickTimerRef.current = setTimeout(() => {
        titleClickCountRef.current = 0
      }, 600)
    }
  }

  // Spotlight Search State (Ctrl + F)
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false)
  const [spotlightQuery, setSpotlightQuery] = useState('')
  const [spotlightSelectedIndex, setSpotlightSelectedIndex] = useState(0)
  const [highlightedRecordKey, setHighlightedRecordKey] = useState<string | null>(null)
  const spotlightInputRef = useRef<HTMLInputElement>(null)

  // Unified Export Dropdown Menu State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  // Filter state — default to Hijri calendar mode
  const [filterType, setFilterType] = useState<'relative' | 'hijri' | 'all'>('hijri')
  // Gregorian relative sub-filter
  const [relFilter, setRelFilter] = useState<'today' | 'month' | 'year' | 'total'>('month')
  // Hijri filter
  const [hijriYear, setHijriYear] = useState<number>(() => {
    try {
      const localData = localStorage.getItem('render_stats')
      if (localData) {
        const recs: StatRecord[] = JSON.parse(localData)
        if (recs && recs.length > 0) {
          const years = recs
            .map(r => {
              if (r.hijriYear) return r.hijriYear
              const info = parseSafarHierarchy(r.filePath || r.folder || '')
              if (info.hijriYear) return info.hijriYear
              return hijriFromGregorian(new Date(r.date)).year
            })
            .filter(Boolean) as number[]
          if (years.length > 0) return Math.max(...years)
        }
      }
    } catch {}
    return hijriFromGregorian(new Date()).year
  })
  const [hijriMonth, setHijriMonth] = useState<number | 'all'>('all')

  const [isFoldersOpen, setIsFoldersOpen] = useState(false)

  // Track whether initial load is complete so auto-save effects don't fire prematurely
  const isLoadedRef = useRef(false)

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadStats(): Promise<void> {
      if (!api) { isLoadedRef.current = true; return }
      try {
        const all = await api.settings.getAll()
        let loadedRecords: StatRecord[] = []

        // 1. Try SQLite first with 3.5s timeout protection
        if (api.statsDb) {
          try {
            const dbPromise = api.statsDb.getAll()
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3500))
            const dbRecords = await Promise.race([dbPromise, timeoutPromise])
            if (Array.isArray(dbRecords) && dbRecords.length > 0) {
              loadedRecords = dbRecords
            }
          } catch (e) {
            console.warn('[Stats] SQLite load fallback to settings:', e)
          }
        }

        // 2. Fallback to settings.json or localStorage
        if (!loadedRecords || loadedRecords.length === 0) {
          if (all.render_stats) {
            loadedRecords = typeof all.render_stats === 'string'
              ? JSON.parse(all.render_stats)
              : all.render_stats as StatRecord[]
          }
        }
        if (!loadedRecords || loadedRecords.length === 0) {
          const localData = localStorage.getItem('render_stats')
          if (localData) {
            try {
              loadedRecords = JSON.parse(localData)
            } catch {}
          }
        }
        if (!loadedRecords || loadedRecords.length === 0) {
          const masterCache = localStorage.getItem('ot_render_stats_master_cache')
          if (masterCache) {
            try {
              loadedRecords = JSON.parse(masterCache)
              console.log('[Stats] Drive/DB offline; successfully loaded records from persistent master cache.')
            } catch {}
          }
        }
        if (loadedRecords && loadedRecords.length > 0) {
          localStorage.setItem('ot_render_stats_master_cache', JSON.stringify(loadedRecords))
        }

        let loadedCities: Record<string, string> = {}
        if (all.stats_folder_cities) {
          loadedCities = typeof all.stats_folder_cities === 'string'
            ? JSON.parse(all.stats_folder_cities)
            : all.stats_folder_cities as Record<string, string>
        }
        setFolderCities(loadedCities || {})

        let loadedSafars: Record<string, string> = {}
        if (all.stats_folder_safars) {
          loadedSafars = typeof all.stats_folder_safars === 'string'
            ? JSON.parse(all.stats_folder_safars)
            : all.stats_folder_safars as Record<string, string>
        }
        setFolderSafars(loadedSafars || {})

        // Migrate and ensure Safar metadata is populated for all records
        let migrated = false
        if (loadedRecords && loadedRecords.length > 0) {
          loadedRecords = loadedRecords.map(r => {
            if (r.folder === '06-12 01M Bethak QMZ' || r.folder === 'trial finished' || r.folder === 'trial 2') {
              migrated = true
              return {
                ...r,
                folder: '1447-12 Mumbai',
                safar: '1447-12 Mumbai',
                city: 'Mumbai',
                hijriYear: 1447,
                hijriMonth: 12
              }
            }

            const hierarchy = parseSafarHierarchy(r.filePath || r.folder || '')
            const isBogusSafar = r.safar && (/^\d{4}[\s-_.]\d{1,2}[\s-_.]\d{1,2}/.test(r.safar) || (/^\d{4}[\s-_.]\d{1,2}/.test(r.safar) && !/[a-zA-Z]{2,}/.test(r.safar)))

            let resolvedSafar = r.safar || hierarchy.safar || 'Unassigned'
            let resolvedCity = r.city || hierarchy.city || 'Unassigned'
            let resolvedSerial: string | undefined = r.safarSerial || hierarchy.safarSerial
            let resolvedYear: number | undefined = r.safarYear || hierarchy.safarYear

            if (isBogusSafar) {
              if (hierarchy.safar && hierarchy.safar !== 'Unassigned') {
                resolvedSafar = hierarchy.safar
                resolvedSerial = hierarchy.safarSerial
                resolvedYear = hierarchy.safarYear
                resolvedCity = hierarchy.city || resolvedCity
              }
            }

            if (resolvedSafar !== r.safar || resolvedSerial !== r.safarSerial || resolvedCity !== r.city) {
              migrated = true
              return {
                ...r,
                safar: resolvedSafar,
                safarSerial: resolvedSerial,
                safarYear: resolvedYear,
                city: resolvedCity,
                hijriYear: r.hijriYear || hierarchy.hijriYear,
                hijriMonth: r.hijriMonth || hierarchy.hijriMonth
              }
            }
            return r
          })
        }

        if (migrated) {
          localStorage.setItem('render_stats', JSON.stringify(loadedRecords))
          await api.settings.setAndSave('render_stats', loadedRecords)
          if (api.statsDb) {
            api.statsDb.insertRecords(loadedRecords).catch(() => {})
          }
        }

        setRecords(loadedRecords || [])

        let loadedGroups: Record<string, string> = {}
        if (all.stats_folder_groups) {
          loadedGroups = typeof all.stats_folder_groups === 'string'
            ? JSON.parse(all.stats_folder_groups)
            : all.stats_folder_groups as Record<string, string>
        }
        setFolderGroups(loadedGroups || {})

        let loadedSd = Date.now()
        if (all.render_stats_start_date) {
          loadedSd = Number(all.render_stats_start_date)
        } else {
          const localSd = localStorage.getItem('render_stats_start_date')
          if (localSd) { loadedSd = parseInt(localSd) || Date.now() }
          await api.settings.setAndSave('render_stats_start_date', loadedSd)
        }
        setStartDate(loadedSd)
      } catch (e) {
        console.error('Failed to load stats:', e)
        try { const d = localStorage.getItem('render_stats'); if (d) setRecords(JSON.parse(d)) } catch {}
        try { const d = localStorage.getItem('ot_stats_folder_groups'); if (d) setFolderGroups(JSON.parse(d)) } catch {}
        try { const d = localStorage.getItem('ot_stats_folder_safars'); if (d) setFolderSafars(JSON.parse(d)) } catch {}
        try { const d = localStorage.getItem('render_stats_start_date'); if (d) setStartDate(parseInt(d) || Date.now()) } catch {}
      } finally {
        isLoadedRef.current = true
        setIsLoading(false)
      }
    }
    loadStats()

    const handleStatsUpdated = (e: Event) => {
      const updated = (e as CustomEvent<StatRecord[]>).detail
      if (Array.isArray(updated) && updated.length > 0) {
        setRecords(updated)
      }
    }
    window.addEventListener('stats-updated', handleStatsUpdated)

    const handleDbUpdated = (updated: StatRecord[]) => {
      if (Array.isArray(updated) && updated.length > 0) {
        setRecords(updated)
      }
    }
    let unsubDb: (() => void) | undefined
    if (api && api.statsDb && typeof api.statsDb.onUpdated === 'function') {
      unsubDb = api.statsDb.onUpdated(handleDbUpdated)
    }

    const handleWindowClick = (e: MouseEvent) => {
      setSafarContextMenu(null)
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false)
      }
    }
    window.addEventListener('click', handleWindowClick)

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        setShowSyncOldDataModal(prev => !prev)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setIsSpotlightOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('stats-updated', handleStatsUpdated)
      window.removeEventListener('click', handleWindowClick)
      window.removeEventListener('keydown', handleKeyDown)
      if (unsubDb) unsubDb()
    }
  }, [])

  // Focus spotlight search input upon opening
  useEffect(() => {
    if (isSpotlightOpen) {
      setSpotlightSelectedIndex(0)
      setTimeout(() => spotlightInputRef.current?.focus(), 60)
    } else {
      setSpotlightQuery('')
    }
  }, [isSpotlightOpen])

  // ── Auto-save effects ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoadedRef.current) return
    localStorage.setItem('ot_stats_folder_groups', JSON.stringify(folderGroups))
    if (api) api.settings.setAndSave('stats_folder_groups', folderGroups).catch(() => {})
  }, [folderGroups])

  useEffect(() => {
    if (!isLoadedRef.current) return
    localStorage.setItem('ot_stats_folder_cities', JSON.stringify(folderCities))
    if (api) api.settings.setAndSave('stats_folder_cities', folderCities).catch(() => {})
  }, [folderCities])

  useEffect(() => {
    if (!isLoadedRef.current) return
    localStorage.setItem('ot_stats_folder_safars', JSON.stringify(folderSafars))
    if (api) api.settings.setAndSave('stats_folder_safars', folderSafars).catch(() => {})
  }, [folderSafars])

  useEffect(() => {
    if (!isLoadedRef.current) return
    if (records.length === 0) {
      const cached = localStorage.getItem('ot_render_stats_master_cache')
      if (cached && cached !== '[]') {
        console.warn('[Stats] Drive Disconnect Protection: Refusing to overwrite persistent cache with empty records.')
        return
      }
    }
    localStorage.setItem('render_stats', JSON.stringify(records))
    if (records.length > 0) {
      localStorage.setItem('ot_render_stats_master_cache', JSON.stringify(records))
    }
    if (api) api.settings.setAndSave('render_stats', records).catch(() => {})
  }, [records])

  useEffect(() => {
    if (!isLoadedRef.current) return
    localStorage.setItem('render_stats_start_date', String(startDate))
    if (api) api.settings.setAndSave('render_stats_start_date', startDate).catch(() => {})
  }, [startDate])

  // ── Derived data ───────────────────────────────────────────────────────────

  const normalRecords = useMemo(() => {
    return records.filter(r => !r.isReedit || resolveSafar(r, folderSafars) === 'Unassigned')
  }, [records, folderSafars])

  const uniqueHijriYears = useMemo(() => {
    const s = new Set<number>()
    normalRecords.forEach(r => {
      const info = parseSafarHierarchy(r.filePath || r.folder || '')
      s.add(r.hijriYear || info.hijriYear || hijriFromGregorian(new Date(r.date)).year)
    })
    s.add(hijriFromGregorian(new Date()).year)
    return Array.from(s).sort((a, b) => b - a)
  }, [normalRecords])

  const uniqueYearsList = uniqueHijriYears

  // All unique Safar names present across records
  const uniqueSafarsList = useMemo(() => {
    const s = new Set<string>()
    let hasUnassigned = false
    normalRecords.forEach(r => {
      const safarName = resolveSafar(r, folderSafars)
      if (safarName === 'Unassigned') {
        hasUnassigned = true
      } else if (safarName) {
        s.add(safarName)
      }
    })
    Object.values(folderSafars).forEach(safarName => {
      if (safarName === 'Unassigned') {
        hasUnassigned = true
      } else if (safarName) {
        s.add(safarName)
      }
    })
    const list = Array.from(s).sort()
    if (hasUnassigned || list.length === 0) list.push('Unassigned')
    return list
  }, [normalRecords, folderSafars])

  const searchedSafarsList = useMemo(() => {
    const filtered = uniqueSafarsList.filter(s => selectedSafar === 'all' || s === selectedSafar)
    if (!safarSearchQuery.trim()) return filtered
    const q = safarSearchQuery.toLowerCase().trim()
    const qNum = parseInt(q, 10)
    return filtered.filter(s => {
      if (s.toLowerCase().includes(q)) return true
      const hierarchy = parseSafarHierarchy(s)
      if (hierarchy.safarName && hierarchy.safarName.toLowerCase().includes(q)) return true
      if (hierarchy.safarSerial) {
        if (hierarchy.safarSerial.toLowerCase().includes(q)) return true
        if (!isNaN(qNum) && parseInt(hierarchy.safarSerial, 10) === qNum) return true
      }
      if (hierarchy.safarYear && String(hierarchy.safarYear).includes(q)) return true
      if (hierarchy.city && hierarchy.city.toLowerCase().includes(q)) return true
      return false
    })
  }, [uniqueSafarsList, selectedSafar, safarSearchQuery])

  // Count total video records across currently selected Safar blocks
  const batchSelectedRecordCount = useMemo(() => {
    if (selectedSafarBlocks.length === 0) return 0
    const set = new Set(selectedSafarBlocks)
    return normalRecords.filter(r => set.has(resolveSafar(r, folderSafars))).length
  }, [selectedSafarBlocks, normalRecords, folderSafars])

  // All unique city names present across all records
  const uniqueCitiesList = useMemo(() => {
    const s = new Set<string>()
    let hasUnassigned = false
    normalRecords.forEach(r => {
      const c = resolveCity(r, folderCities)
      if (c === 'Unassigned') {
        hasUnassigned = true
      } else if (c) {
        s.add(c)
      }
    })
    const list = Array.from(s).sort()
    if (hasUnassigned || list.length === 0) list.push('Unassigned')
    return list
  }, [normalRecords, folderCities])

  const searchedCitiesList = useMemo(() => {
    const filtered = uniqueCitiesList.filter(city => selectedCity === 'all' || city === selectedCity)
    if (!safarSearchQuery.trim()) return filtered
    const q = safarSearchQuery.toLowerCase()
    return filtered.filter(city => city.toLowerCase().includes(q))
  }, [uniqueCitiesList, selectedCity, safarSearchQuery])

  // Human-readable label for the current filter period
  const filterLabel = useMemo(() => {
    if (filterType === 'all') {
      return 'All Time (No Filters)'
    }
    if (filterType === 'relative') {
      return relFilter.charAt(0).toUpperCase() + relFilter.slice(1)
    }
    const monthStr = hijriMonth === 'all' ? 'All Months' : HIJRI_MONTH_NAMES_SHORT[(hijriMonth as number) - 1]
    return `${monthStr} ${hijriYear} H`
  }, [filterType, relFilter, hijriYear, hijriMonth])

  /** Core filter: returns true if a record falls in the current filter period */
  const recordMatchesPeriod = useCallback((r: StatRecord): boolean => {
    if (filterType === 'all') return true
    const now = new Date()
    if (filterType === 'relative') {
      if (relFilter === 'total') {
        return r.date >= startDate
      }
      const d = new Date(r.date)
      if (relFilter === 'today') {
        return d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() &&
               d.getDate() === now.getDate()
      }
      if (relFilter === 'year') {
        return d.getFullYear() === now.getFullYear()
      }
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    } else {
      const info = parseSafarHierarchy(r.filePath || r.folder || '')
      const hd = hijriFromGregorian(new Date(r.date))
      const y = r.hijriYear || info.hijriYear || hd.year
      const m = r.hijriMonth || info.hijriMonth || (hd.month + 1)
      if (y !== hijriYear) return false
      if (hijriMonth !== 'all' && m !== hijriMonth) return false
      return true
    }
  }, [filterType, relFilter, hijriYear, hijriMonth, startDate])

  // Filtered records (Safar + period)
  const filteredItems = useMemo(() => {
    return normalRecords.filter(r => {
      if (filterType !== 'all') {
        if (selectedSafar !== 'all') {
          const s = resolveSafar(r, folderSafars)
          if (s !== selectedSafar) return false
        }
      }
      return recordMatchesPeriod(r)
    })
  }, [normalRecords, selectedSafar, folderSafars, recordMatchesPeriod, filterType])

  const filteredReeditItems = useMemo(() => {
    return records.filter(r => {
      if (!r.isReedit) return false
      if (filterType !== 'all') {
        if (selectedSafar !== 'all') {
          const s = resolveSafar(r, folderSafars)
          if (s !== selectedSafar) return false
        }
      }
      return recordMatchesPeriod(r)
    })
  }, [records, selectedSafar, folderSafars, recordMatchesPeriod, filterType])

  // Category counts (for category tab)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredItems.forEach(r => {
      const pfx = (r.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'
      counts[pfx] = (counts[pfx] || 0) + 1
    })
    return counts
  }, [filteredItems])

  // Dynamic prefixes: dynamically discovers ANY new prefix (e.g. MF, TNQ, ZO, etc.)
  const dynamicPrefixes = useMemo(() => {
    const set = new Set<string>()
    Object.keys(KNOWN_PREFIX_NAMES).forEach(p => set.add(p))
    records.forEach(r => {
      const p = (r.prefix || '').toUpperCase().trim()
      if (p) set.add(p)
    })
    return Array.from(set)
  }, [records])

  // Displayed prefixes sorted by count
  const displayedPrefixes = useMemo(() => {
    return dynamicPrefixes.filter(pfx => {
      const count = categoryCounts[pfx] || 0
      return showEmptyCategories || count > 0
    }).sort((a, b) => {
      const diff = (categoryCounts[b] || 0) - (categoryCounts[a] || 0)
      return diff !== 0 ? diff : a.localeCompare(b)
    })
  }, [dynamicPrefixes, categoryCounts, showEmptyCategories])

  const maxPrefixVolume = useMemo(() =>
    Math.max(...displayedPrefixes.map(p => categoryCounts[p] || 0), 1),
    [displayedPrefixes, categoryCounts])

  // Safar counts (for Safar tab, within filtered period)
  const safarCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredItems.forEach(r => {
      const s = resolveSafar(r, folderSafars)
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [filteredItems, folderSafars])

  // Safar card precomputed summaries (O(N) single pass to eliminate O(S*N) render overhead)
  const safarCardSummaries = useMemo(() => {
    const map: Record<string, {
      periodCount: number
      overallCount: number
      safarDuration: number
      sessionList: string[]
      eventEntries: [string, number][]
      cleanTitle: string
      hierarchy: ReturnType<typeof parseSafarHierarchy>
      isUnassigned: boolean
    }> = {}

    const allBySafar: Record<string, StatRecord[]> = {}
    normalRecords.forEach(r => {
      const s = resolveSafar(r, folderSafars)
      if (!allBySafar[s]) allBySafar[s] = []
      allBySafar[s].push(r)
    })

    const periodBySafar: Record<string, number> = {}
    filteredItems.forEach(r => {
      const s = resolveSafar(r, folderSafars)
      periodBySafar[s] = (periodBySafar[s] || 0) + 1
    })

    uniqueSafarsList.forEach(safar => {
      const allRecs = allBySafar[safar] || []
      const periodCount = periodBySafar[safar] || 0
      const overallCount = allRecs.length
      const hierarchy = parseSafarHierarchy(safar)
      const isUnassigned = safar === 'Unassigned'

      let safarDuration = 0
      const sessionsSet = new Set<string>()
      const eventCounts: Record<string, number> = {}

      for (let j = 0; j < allRecs.length; j++) {
        const r = allRecs[j]
        safarDuration += (r.duration || 0)
        if (r.session && r.session !== 'Unassigned') {
          sessionsSet.add(r.session)
        } else {
          const info = parseSafarHierarchy(r.filePath || r.folder || '')
          if (info.session) sessionsSet.add(info.session)
        }
        const pfx = (r.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'
        eventCounts[pfx] = (eventCounts[pfx] || 0) + 1
      }

      const sessionList = Array.from(sessionsSet).sort()
      const eventEntries = Object.entries(eventCounts).sort((a, b) => b[1] - a[1])

      const cleanTitle = isUnassigned
        ? 'Unassigned Videos'
        : (hierarchy.safarName && hierarchy.safarName.includes(' - ')
          ? hierarchy.safarName.split(' - ').slice(1).join(' - ').trim() || hierarchy.safarName
          : hierarchy.safarName || safar)

      map[safar] = {
        periodCount,
        overallCount,
        safarDuration,
        sessionList,
        eventEntries,
        cleanTitle,
        hierarchy,
        isUnassigned
      }
    })

    return map
  }, [normalRecords, filteredItems, uniqueSafarsList, folderSafars])

  // Max Safar count for progress bars (O(S) instant lookup)
  const maxSafarVolume = useMemo(() => {
    let maxV = 1
    for (const key in safarCardSummaries) {
      if (safarCardSummaries[key].overallCount > maxV) {
        maxV = safarCardSummaries[key].overallCount
      }
    }
    return maxV
  }, [safarCardSummaries])

  // City counts (within filtered period)
  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredItems.forEach(r => {
      const c = resolveCity(r, folderCities)
      counts[c] = (counts[c] || 0) + 1
    })
    return counts
  }, [filteredItems, folderCities])
  const maxCityVolume = useMemo(() =>
    Math.max(...uniqueCitiesList.map(c => cityCounts[c] || 0), 1),
    [uniqueCitiesList, cityCounts])

  // Safar Context Menu & Delete Handlers
  const handleSafarContextMenu = (e: React.MouseEvent, safar: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSafarContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      safar
    })
  }

  const openDeleteModal = (safar: string) => {
    const count = normalRecords.filter(r => resolveSafar(r, folderSafars) === safar).length
    setSafarDeleteModal({
      isOpen: true,
      safar,
      count
    })
    setSafarContextMenu(null)
  }

  // 1. Move records to Unassigned & remove Safar block
  const handleConfirmReassignDeleteSafar = async () => {
    if (!safarDeleteModal) return
    const safarToDelete = safarDeleteModal.safar
    const count = safarDeleteModal.count

    // Set records to Unassigned
    const nextRecords = records.map(r => {
      if (resolveSafar(r, folderSafars) === safarToDelete) {
        return {
          ...r,
          safar: 'Unassigned',
          city: 'Unassigned',
          safarSerial: undefined,
          safarYear: undefined
        }
      }
      return r
    })

    // Update folderSafars mapping
    const nextFolderSafars = { ...folderSafars }
    Object.keys(nextFolderSafars).forEach(k => {
      if (nextFolderSafars[k] === safarToDelete) {
        nextFolderSafars[k] = 'Unassigned'
      }
    })

    // Also map folders of records belonging to this safar to 'Unassigned'
    records.forEach(r => {
      if (resolveSafar(r, folderSafars) === safarToDelete && r.folder) {
        nextFolderSafars[r.folder] = 'Unassigned'
      }
    })

    setRecords(nextRecords)
    setFolderSafars(nextFolderSafars)
    localStorage.setItem('render_stats', JSON.stringify(nextRecords))
    localStorage.setItem('ot_stats_folder_safars', JSON.stringify(nextFolderSafars))

    if (api) {
      await api.settings.setAndSave('render_stats', nextRecords).catch(() => {})
      await api.settings.setAndSave('stats_folder_safars', nextFolderSafars).catch(() => {})
      if (api.statsDb) {
        await api.statsDb.reassignSafar({ fromSafar: safarToDelete, toSafar: 'Unassigned' }).catch(() => {})
      }
    }

    showToast({
      title: 'Safar Block Removed',
      message: `"${safarToDelete}" removed. ${count} videos moved to Unassigned.`,
      type: 'success'
    })

    setSafarDeleteModal(null)
    if (selectedSafarDetail === safarToDelete) {
      setSelectedSafarDetail(null)
    }
  }

  // 2. Permanently delete all records & remove Safar block
  const handleConfirmDeleteSafarPermanently = async () => {
    if (!safarDeleteModal) return
    const safarToDelete = safarDeleteModal.safar
    const count = safarDeleteModal.count

    // Filter out all records for this Safar
    const nextRecords = records.filter(r => resolveSafar(r, folderSafars) !== safarToDelete)

    // Remove any folder mappings pointing to this Safar
    const nextFolderSafars = { ...folderSafars }
    Object.keys(nextFolderSafars).forEach(k => {
      if (nextFolderSafars[k] === safarToDelete) {
        delete nextFolderSafars[k]
      }
    })

    setRecords(nextRecords)
    setFolderSafars(nextFolderSafars)
    localStorage.setItem('render_stats', JSON.stringify(nextRecords))
    localStorage.setItem('ot_stats_folder_safars', JSON.stringify(nextFolderSafars))

    if (api) {
      await api.settings.setAndSave('render_stats', nextRecords).catch(() => {})
      await api.settings.setAndSave('stats_folder_safars', nextFolderSafars).catch(() => {})
      if (api.statsDb && typeof api.statsDb.deleteSafar === 'function') {
        await api.statsDb.deleteSafar({ safar: safarToDelete }).catch(() => {})
      }
    }

    showToast({
      title: 'Safar & Records Deleted',
      message: `"${safarToDelete}" and ${count} video records permanently deleted from stats.`,
      type: 'success'
    })

    setSafarDeleteModal(null)
    if (selectedSafarDetail === safarToDelete) {
      setSelectedSafarDetail(null)
    }
  }

  // Batch Safar Operations (Multi-select)
  const handleConfirmBatchMoveToUnassigned = async () => {
    const safarsToMove = selectedSafarBlocks.filter(s => s !== 'Unassigned')
    if (safarsToMove.length === 0) {
      setBatchDeleteModalOpen(false)
      return
    }

    const safarSet = new Set(safarsToMove)
    const nextRecords = records.map(r => {
      if (safarSet.has(resolveSafar(r, folderSafars))) {
        return {
          ...r,
          safar: 'Unassigned',
          city: 'Unassigned',
          safarSerial: undefined,
          safarYear: undefined
        }
      }
      return r
    })

    const nextFolderSafars = { ...folderSafars }
    Object.keys(nextFolderSafars).forEach(k => {
      if (safarSet.has(nextFolderSafars[k])) {
        nextFolderSafars[k] = 'Unassigned'
      }
    })
    records.forEach(r => {
      if (safarSet.has(resolveSafar(r, folderSafars)) && r.folder) {
        nextFolderSafars[r.folder] = 'Unassigned'
      }
    })

    setRecords(nextRecords)
    setFolderSafars(nextFolderSafars)
    localStorage.setItem('render_stats', JSON.stringify(nextRecords))
    localStorage.setItem('ot_stats_folder_safars', JSON.stringify(nextFolderSafars))

    if (api) {
      await api.settings.setAndSave('render_stats', nextRecords).catch(() => {})
      await api.settings.setAndSave('stats_folder_safars', nextFolderSafars).catch(() => {})
      if (api.statsDb && api.statsDb.reassignSafar) {
        for (const s of safarsToMove) {
          await api.statsDb.reassignSafar({ fromSafar: s, toSafar: 'Unassigned' }).catch(() => {})
        }
      }
    }

    showToast({
      title: 'Safar Blocks Moved',
      message: `${safarsToMove.length} Safar block(s) moved to Unassigned. ${batchSelectedRecordCount} video records kept intact.`,
      type: 'success'
    })

    if (selectedSafarDetail && safarSet.has(selectedSafarDetail)) {
      setSelectedSafarDetail(null)
    }
    setSelectedSafarBlocks([])
    setBatchDeleteModalOpen(false)
  }

  const handleConfirmBatchDeletePermanently = async () => {
    const safarsToDelete = selectedSafarBlocks.filter(s => s !== 'Unassigned')
    if (safarsToDelete.length === 0) {
      setBatchDeleteModalOpen(false)
      return
    }

    const safarSet = new Set(safarsToDelete)
    const nextRecords = records.filter(r => !safarSet.has(resolveSafar(r, folderSafars)))

    const nextFolderSafars = { ...folderSafars }
    Object.keys(nextFolderSafars).forEach(k => {
      if (safarSet.has(nextFolderSafars[k])) {
        delete nextFolderSafars[k]
      }
    })

    setRecords(nextRecords)
    setFolderSafars(nextFolderSafars)
    localStorage.setItem('render_stats', JSON.stringify(nextRecords))
    localStorage.setItem('ot_stats_folder_safars', JSON.stringify(nextFolderSafars))

    if (api) {
      await api.settings.setAndSave('render_stats', nextRecords).catch(() => {})
      await api.settings.setAndSave('stats_folder_safars', nextFolderSafars).catch(() => {})
      if (api.statsDb && typeof api.statsDb.deleteSafar === 'function') {
        for (const s of safarsToDelete) {
          await api.statsDb.deleteSafar({ safar: s }).catch(() => {})
        }
      }
    }

    showToast({
      title: 'Safar Blocks & Records Deleted',
      message: `${safarsToDelete.length} Safar block(s) and ${batchSelectedRecordCount} video records permanently deleted.`,
      type: 'success'
    })

    if (selectedSafarDetail && safarSet.has(selectedSafarDetail)) {
      setSelectedSafarDetail(null)
    }
    setSelectedSafarBlocks([])
    setBatchDeleteModalOpen(false)
  }

  const handleSafarCardClick = (e: React.MouseEvent, safar: string, index: number, summary: any) => {
    // Ctrl / Cmd Click: Toggle individual card in selection
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      setSelectedSafarBlocks(prev => {
        if (prev.includes(safar)) {
          return prev.filter(s => s !== safar)
        } else {
          return [...prev, safar]
        }
      })
      setLastSelectedSafarIndex(index)
      return
    }

    // Shift Click: Range select from last clicked index to current index
    if (e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      if (lastSelectedSafarIndex !== null) {
        const start = Math.min(lastSelectedSafarIndex, index)
        const end = Math.max(lastSelectedSafarIndex, index)
        const range = searchedSafarsList.slice(start, end + 1)
        setSelectedSafarBlocks(prev => {
          const set = new Set(prev)
          range.forEach(s => set.add(s))
          return Array.from(set)
        })
      } else {
        setSelectedSafarBlocks([safar])
        setLastSelectedSafarIndex(index)
      }
      return
    }

    // Normal Click: open detail view
    if (selectedSafarBlocks.length > 0) {
      setSelectedSafarBlocks([])
    }
    setLastSelectedSafarIndex(index)
    setSelectedSafarDetail(safar)
    setSelectedAnalyticsYear(summary.hierarchy.safarYear || currentHijriYear)
    setSelectedMonthDetail(safar === 'Unassigned' ? -1 : null)
    setSelectedMonthCategory(null)
  }

  const handleToggleSafarCheckbox = (e: React.MouseEvent, safar: string, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedSafarBlocks(prev => {
      if (prev.includes(safar)) {
        return prev.filter(s => s !== safar)
      } else {
        return [...prev, safar]
      }
    })
    setLastSelectedSafarIndex(index)
  }

  // Keyboard shortcut listener for Safar Multi-selection (Delete / Backspace / Esc / Ctrl+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (statsTab !== 'safar') return
      const activeEl = document.activeElement
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      if (isInput) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSafarBlocks.length > 0) {
        e.preventDefault()
        setBatchDeleteModalOpen(true)
      } else if (e.key === 'Escape' && selectedSafarBlocks.length > 0) {
        e.preventDefault()
        setSelectedSafarBlocks([])
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelectedSafarBlocks([...searchedSafarsList])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [statsTab, selectedSafarBlocks, searchedSafarsList])

  const openRenameModal = (safar: string) => {
    const hierarchy = parseSafarHierarchy(safar)
    const cleanName = hierarchy.safarName && hierarchy.safarName.includes(' - ')
      ? hierarchy.safarName.split(' - ').slice(1).join(' - ').trim()
      : (hierarchy.safarName !== 'Unassigned' ? hierarchy.safarName : safar)

    setSafarRenameModal({
      isOpen: true,
      oldSafar: safar,
      name: cleanName,
      serial: hierarchy.safarSerial || '',
      year: hierarchy.safarYear ? String(hierarchy.safarYear) : '',
      city: hierarchy.city && hierarchy.city !== 'Unassigned' ? hierarchy.city : '',
      customTag: safar,
      useDirectTag: false
    })
    setSafarContextMenu(null)
  }

  const handleOpenSafarFolder = async (safar: string) => {
    setSafarContextMenu(null)
    const api = (window as any).api
    if (!api || !api.shell || !api.shell.openFolder) {
      showToast({ title: 'Not Available', message: 'Shell API is not available.', type: 'danger' })
      return
    }

    const matching = records.find(r => resolveSafar(r, folderSafars) === safar && (r.filePath || r.folder))
    if (!matching) {
      showToast({ title: 'Folder Not Found', message: 'No local path recorded for this Safar block.', type: 'warning' })
      return
    }

    const p = matching.filePath || matching.folder || ''
    let safarDir = ''
    const safarIdx = p.indexOf(safar)
    if (safarIdx !== -1) {
      safarDir = p.substring(0, safarIdx + safar.length)
    } else {
      safarDir = matching.folder || p.substring(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')))
    }

    try {
      await api.shell.openFolder(safarDir)
      showToast({ title: 'Folder Opened', message: `Opened: ${safarDir}`, type: 'success' })
    } catch (err: any) {
      showToast({ title: 'Error Opening Folder', message: err.message || String(err), type: 'danger' })
    }
  }

  const handleCopySafarSummary = (safar: string) => {
    setSafarContextMenu(null)
    const safarRecords = normalRecords.filter(r => resolveSafar(r, folderSafars) === safar)
    const totalSecs = safarRecords.reduce((acc, r) => acc + (r.duration || 0), 0)

    const catCounts: Record<string, number> = {}
    safarRecords.forEach(r => {
      const pfx = (r.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'
      catCounts[pfx] = (catCounts[pfx] || 0) + 1
    })

    const breakdown = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} (${v})`)
      .join(', ')

    const text = `🏕️ ${safar}\nTotal Videos: ${safarRecords.length} | Duration: ${formatDuration(totalSecs)}\nBreakdown: ${breakdown || 'None'}`

    navigator.clipboard.writeText(text)
    showToast({ title: 'Summary Copied', message: 'Safar summary copied to clipboard.', type: 'success' })
  }

  const handleConfirmRenameSafar = async () => {
    if (!safarRenameModal) return
    const { oldSafar, name, serial, year, city, customTag, useDirectTag } = safarRenameModal
    const cleanName = name.trim()
    const cleanSerial = serial.trim() ? serial.trim().padStart(2, '0') : ''
    const cleanYear = year.trim() ? parseInt(year.trim()) : undefined
    const cleanCity = city.trim()

    let newSafarTag = ''
    if (useDirectTag && customTag && customTag.trim()) {
      newSafarTag = customTag.trim()
    } else {
      if (!cleanName && !cleanSerial) {
        showToast({ title: 'Invalid Name', message: 'Please provide a valid title or serial number.', type: 'warning' })
        return
      }

      const prefixParts: string[] = []
      if (cleanYear) prefixParts.push(String(cleanYear))
      if (cleanSerial) prefixParts.push(cleanSerial)

      if (prefixParts.length > 0) {
        newSafarTag = prefixParts.join('-') + ' '
      }
      if (cleanCity) {
        newSafarTag += cleanCity + ' - '
      }
      newSafarTag += cleanName
      newSafarTag = newSafarTag.trim()
    }

    if (!newSafarTag) {
      showToast({ title: 'Invalid Name', message: 'Safar name cannot be empty.', type: 'warning' })
      return
    }

    const api = (window as any).api

    const nextRecords = records.map(r => {
      if (resolveSafar(r, folderSafars) === oldSafar) {
        return {
          ...r,
          safar: newSafarTag,
          ...(cleanSerial ? { safarSerial: cleanSerial } : {}),
          ...(cleanYear ? { safarYear: cleanYear } : {}),
          ...(cleanCity ? { city: cleanCity } : {}),
          safarName: cleanName || newSafarTag
        }
      }
      return r
    })

    const nextFolderSafars = { ...folderSafars }
    Object.keys(nextFolderSafars).forEach(k => {
      if (nextFolderSafars[k] === oldSafar) {
        nextFolderSafars[k] = newSafarTag
      }
    })

    setRecords(nextRecords)
    setFolderSafars(nextFolderSafars)
    localStorage.setItem('render_stats', JSON.stringify(nextRecords))
    localStorage.setItem('folder_safars', JSON.stringify(nextFolderSafars))

    if (selectedSafarDetail === oldSafar) {
      setSelectedSafarDetail(newSafarTag)
    }

    if (api) {
      api.settings.setAndSave('render_stats', nextRecords).catch(() => {})
      api.settings.setAndSave('stats_folder_safars', nextFolderSafars).catch(() => {})
      if (api.statsDb && api.statsDb.renameSafar) {
        api.statsDb.renameSafar({
          fromSafar: oldSafar,
          toSafar: newSafarTag,
          newSerial: cleanSerial || undefined,
          newYear: cleanYear,
          newCity: cleanCity || undefined
        }).catch(console.error)
      }
    }

    showToast({
      title: 'Safar Renamed',
      message: `Updated to "${newSafarTag}"`,
      type: 'success'
    })

    setSafarRenameModal(null)
  }

  const handleBrowseSyncSafarDir = async () => {
    const api = (window as any).api
    if (api && api.dialog && api.dialog.openFolder) {
      const p = await api.dialog.openFolder({ title: 'Select Main Safar Folder (e.g. 1448-10-Istefada ilmiyah or E:\\In Process)' })
      if (p) {
        setSyncSafarDir(p)
        const parsed = parseSafarHierarchy(p)
        setDetectedSafarPreview({
          safarName: parsed.safarName !== 'Unassigned' ? parsed.safarName : (parsed.safar || p.split(/[\\/]/).pop()),
          serial: parsed.safarSerial,
          year: parsed.safarYear,
          city: parsed.city
        })
      }
    }
  }

  const handleBrowseSyncMainDir = async () => {
    const api = (window as any).api
    if (api && api.dialog && api.dialog.openFolder) {
      const p = await api.dialog.openFolder({ title: 'Select Main Directory (Contains Safar folders; "Final" folder will be skipped)' })
      if (p) setSyncMainDir(p)
    }
  }

  const handleBrowseSyncFinalDir = async () => {
    const api = (window as any).api
    if (api && api.dialog && api.dialog.openFolder) {
      const p = await api.dialog.openFolder({ title: 'Select Final Directory (Contains rendered videos date-wise)' })
      if (p) setSyncFinalDir(p)
    }
  }

  const handleRunSyncOldData = async () => {
    const targetSafarDir = syncSafarDir.trim()
    const targetMain = syncMainDir.trim()
    const targetFinal = syncFinalDir.trim()

    if (!targetSafarDir && (!targetMain || !targetFinal)) {
      showToast({ title: 'Folder Missing', message: 'Please select a Main Safar Folder (e.g. E:\\In Process\\1448-10-Istefada ilmiyah).', type: 'warning' })
      return
    }

    const api = (window as any).api
    if (!api || !api.statsDb || !api.statsDb.syncOldData) {
      showToast({ title: 'Not Supported', message: 'Stats DB syncOldData IPC is not available.', type: 'danger' })
      return
    }

    try {
      setIsSyncing(true)
      setSyncProgressMsg('Analyzing directory structure, sessions & video durations...')
      setSyncResult(null)

      const payload = targetSafarDir
        ? { safarDir: targetSafarDir }
        : { mainDir: targetMain, finalDir: targetFinal }

      const res = await api.statsDb.syncOldData(payload)

      if (res && res.success) {
        setSyncResult({
          totalScanned: res.totalScanned,
          inserted: res.inserted,
          updated: res.updated,
          safars: res.safars
        })
        showToast({
          title: 'Sync Successful! 🎉',
          message: `Imported ${res.inserted || 0} records across ${res.safars?.length || 0} Safar(s).`,
          type: 'success'
        })

        // 1. Immediately merge newly imported records into state & local storage
        const importedRecords: StatRecord[] = res.records || []
        if (importedRecords.length > 0) {
          setRecords(prev => {
            const map = new Map<string, StatRecord>()
            prev.forEach(r => map.set(`${r.name}_${r.prefix}_${r.date}`, r))
            importedRecords.forEach((r: StatRecord) => map.set(`${r.name}_${r.prefix}_${r.date}`, r))
            const merged = Array.from(map.values())
            localStorage.setItem('render_stats', JSON.stringify(merged))
            return merged
          })
        } else if (api.statsDb && api.statsDb.getAll) {
          try {
            const fresh = await api.statsDb.getAll()
            if (Array.isArray(fresh) && fresh.length > 0) {
              setRecords(fresh)
              localStorage.setItem('render_stats', JSON.stringify(fresh))
            }
          } catch {}
        }

        // 2. Automatically align view filters so the newly synced Safar is immediately visible on screen!
        const targetSafar = res.safars && res.safars.length > 0 ? res.safars[0] : null
        const firstRec = importedRecords[0]
        const targetYear = firstRec?.hijriYear || firstRec?.safarYear

        if (targetYear) {
          setHijriYear(targetYear)
        }
        if (targetSafar) {
          setSelectedSafar(targetSafar)
        } else {
          setSelectedSafar('all')
        }
        setFilterType('all') // Switch to 'all' so records are not hidden by date boundaries
        setStatsTab('safar') // Jump to Safar view
        setSelectedCity('all')
        setSelectedCategoryFilter(null)
        setSelectedMonthDetail(null)
      } else {
        const errMsg = res?.error || 'Unknown error occurred while running data sync.'
        setSyncResult({ error: errMsg })
        showToast({ title: 'Sync Failed', message: errMsg, type: 'danger' })
      }
    } catch (err: any) {
      const msg = err?.message || String(err)
      setSyncResult({ error: msg })
      showToast({ title: 'Sync Error', message: msg, type: 'danger' })
    } finally {
      setIsSyncing(false)
      setSyncProgressMsg('')
    }
  }

  // ── Global Spotlight Search Engine ──────────────────────────
  const spotlightResults = useMemo(() => {
    if (!isSpotlightOpen) return []
    const q = spotlightQuery.trim().toLowerCase()
    if (!q) {
      // Default to 15 most recent records
      return normalRecords.slice(-15).reverse()
    }
    const tokens = q.split(/\s+/).filter(Boolean)

    const matches: { record: StatRecord; score: number }[] = []

    for (const r of normalRecords) {
      const name = (r.name || '').toLowerCase()
      const safar = (resolveSafar(r, folderSafars) || '').toLowerCase()
      const city = (resolveCity(r, folderCities) || '').toLowerCase()
      const prefix = (r.prefix || '').toLowerCase()
      const prefixName = (PREFIX_NAMES[r.prefix] || '').toLowerCase()
      const session = (r.session || '').toLowerCase()
      const gregorianDate = getLocalDateString(r.date).toLowerCase()
      const hijriDate = toMisriHijri(r.date).toLowerCase()
      const folder = (r.folder || '').toLowerCase()
      const filePath = (r.filePath || '').toLowerCase()

      const searchable = `${name} ${safar} ${city} ${prefix} ${prefixName} ${session} ${gregorianDate} ${hijriDate} ${folder} ${filePath}`

      const allTokensMatch = tokens.every(t => searchable.includes(t))
      if (!allTokensMatch) continue

      let score = 0
      if (name === q) score += 50
      else if (name.startsWith(q)) score += 25
      else if (name.includes(q)) score += 15

      if (session === q) score += 30
      else if (session.includes(q)) score += 15

      if (prefix === q) score += 35
      else if (prefix.includes(q)) score += 15

      if (safar.includes(q)) score += 12
      if (gregorianDate.includes(q) || hijriDate.includes(q)) score += 20

      matches.push({ record: r, score })
    }

    matches.sort((a, b) => b.score - a.score || b.record.date - a.record.date)
    return matches.slice(0, 40).map(m => m.record)
  }, [normalRecords, spotlightQuery, folderSafars, folderCities, isSpotlightOpen])

  const handleSelectSpotlightRecord = (rec: StatRecord) => {
    const targetSafar = resolveSafar(rec, folderSafars)
    const recordKey = `${rec.name}_${rec.date}_${rec.prefix}`
    setHighlightedRecordKey(recordKey)

    const info = parseSafarHierarchy(rec.filePath || rec.folder || '')
    const y = rec.hijriYear || info.hijriYear || hijriFromGregorian(new Date(rec.date)).year
    const m = rec.hijriMonth || info.hijriMonth || (hijriFromGregorian(new Date(rec.date)).month + 1)
    const monthIdx = m - 1

    setStatsTab('safar')
    setSelectedSafarDetail(targetSafar && targetSafar !== 'Unassigned' ? targetSafar : 'Unassigned')
    setSelectedAnalyticsYear(y)
    setSelectedMonthDetail(monthIdx >= 0 && monthIdx < 12 ? monthIdx : -1)
    setSelectedMonthCategory(null)
    setFilterType('all')

    setIsSpotlightOpen(false)

    setTimeout(() => {
      const el = document.getElementById(`record-${recordKey}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 260)

    setTimeout(() => {
      setHighlightedRecordKey(null)
    }, 4500)
  }

  // ── SVG Donut/Pie helpers & memos ──────────────────────────
  const getPieSlicePath = (startAngle: number, endAngle: number, radius: number, innerRadius: number): string => {
    const startRad = (startAngle - 90) * Math.PI / 180
    const endRad = (endAngle - 90) * Math.PI / 180
    
    const x1 = radius * Math.cos(startRad)
    const y1 = radius * Math.sin(startRad)
    const x2 = radius * Math.cos(endRad)
    const y2 = radius * Math.sin(endRad)
    
    const ix1 = innerRadius * Math.cos(startRad)
    const iy1 = innerRadius * Math.sin(startRad)
    const ix2 = innerRadius * Math.cos(endRad)
    const iy2 = innerRadius * Math.sin(endRad)
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
  }

  const categorySlices = useMemo(() => {
    const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0)
    if (total === 0) return []
    
    let currentAngle = 0
    const colors: Record<string, string> = {
      MZ: '#8B5CF6',
      Z: '#EC4899',
      Q: '#06B6D4',
      M: '#3B82F6',
      N: '#10B981',
      AQ: '#F59E0B',
      WAAZ: '#EF4444',
      ID: '#6366F1',
      BQ: '#84CC16',
      BZ: '#14B8A6',
      OD: '#F97316',
      OTHER: '#64748B'
    }
    
    return displayedPrefixes
      .map(pfx => {
        const count = categoryCounts[pfx] || 0
        const pct = count / total
        const angleRange = pct * 360
        const startAngle = currentAngle
        const endAngle = currentAngle + angleRange
        currentAngle = endAngle
        
        const label = pfx === 'OTHER' ? 'Other' : formatPrefixName(pfx)
        const color = colors[pfx] || getPrefixColorTheme(pfx).accent
        
        return {
          prefix: pfx,
          label,
          count,
          pct,
          startAngle,
          endAngle,
          color
        }
      })
      .filter(s => s.count > 0)
  }, [categoryCounts, displayedPrefixes])

  const centerText = useMemo(() => {
    const activePrefix = hoveredPrefix || selectedCategoryFilter
    if (activePrefix) {
      const slice = categorySlices.find(s => s.prefix === activePrefix)
      if (slice) {
        return {
          title: slice.label,
          sub: `${slice.count} video${slice.count !== 1 ? 's' : ''}`,
          pct: `${(slice.pct * 100).toFixed(1)}%`
        }
      }
    }
    const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0)
    return {
      title: 'Total',
      sub: `${total} video${total !== 1 ? 's' : ''}`,
      pct: '100%'
    }
  }, [hoveredPrefix, selectedCategoryFilter, categorySlices, categoryCounts])

  const activeCities = useMemo(() => {
    return uniqueCitiesList
      .map(city => ({
        name: city,
        count: cityCounts[city] || 0
      }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [uniqueCitiesList, cityCounts])

  const maxCityCount = useMemo(() => {
    return Math.max(...activeCities.map(c => c.count), 1)
  }, [activeCities])

  // ── Trends (14-day) ────────────────────────────────────────────────────────
  const trendsData = useMemo(() => {
    if (!showTrends) {
      return { days: [], dayCounts: [], dayBreakdowns: [], totalTrendCount: 0, points: [], linePath: '', areaPath: '' }
    }
    const dayMs = 24 * 60 * 60 * 1000
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayTs = todayStart.getTime()
    const days = Array.from({ length: 14 }).map((_, i) => getLocalDateString(todayTs - (13 - i) * dayMs))
    const dayCounts = days.map(d => normalRecords.filter(r => getLocalDateString(r.date) === d).length)
    const dayBreakdowns = days.map(d => {
      const recs = normalRecords.filter(r => getLocalDateString(r.date) === d)
      const bd: Record<string, number> = {}
      recs.forEach(r => { const p = (r.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'; bd[p] = (bd[p] || 0) + 1 })
      return bd
    })
    const totalTrendCount = dayCounts.reduce((a, b) => a + b, 0)
    const maxVal = Math.max(...dayCounts, 1)
    const points = dayCounts.map((count, i) => {
      const x = i * (800 / 13)
      const y = 155 - (count / maxVal) * 120
      return { x, y, count, day: days[i], breakdown: dayBreakdowns[i] }
    })
    let linePath = '', areaPath = ''
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y}`
      for (let i = 0; i < points.length - 1; i++) {
        const c = points[i], n = points[i + 1]
        const cpX1 = c.x + (n.x - c.x) / 3, cpX2 = c.x + 2 * (n.x - c.x) / 3
        linePath += ` C ${cpX1} ${c.y}, ${cpX2} ${n.y}, ${n.x} ${n.y}`
      }
      areaPath = `${linePath} L ${points[points.length - 1].x} 175 L ${points[0].x} 175 Z`
    }
    return { days, dayCounts, dayBreakdowns, totalTrendCount, points, linePath, areaPath }
  }, [normalRecords, showTrends])

  // ── Folder aggregates ──────────────────────────────────────────────────────
  const folderAggregates = useMemo(() => {
    const fMap: Record<string, { folder: string; count: number; breakdown: Record<string, number>; firstDate: number }> = {}
    filteredItems.forEach(r => {
      const f = r.folder || 'Direct Render'
      if (!fMap[f]) fMap[f] = { folder: f, count: 0, breakdown: {}, firstDate: r.date }
      fMap[f].count++
      const pfx = (r.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'Other'
      fMap[f].breakdown[pfx] = (fMap[f].breakdown[pfx] || 0) + 1
      if (r.date < fMap[f].firstDate) fMap[f].firstDate = r.date
    })
    const list = Object.values(fMap).sort((a, b) => b.firstDate - a.firstDate)
    if (groupBy === 'prefix') {
      const g: Record<string, typeof list> = {}
      list.forEach(f => { const top = Object.entries(f.breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other'; if (!g[top]) g[top] = []; g[top].push(f) })
      return g
    }
    if (groupBy === 'date') {
      const g: Record<string, typeof list> = {}
      list.forEach(f => { const d = new Date(f.firstDate).toLocaleDateString(); if (!g[d]) g[d] = []; g[d].push(f) })
      return g
    }
    if (groupBy === 'virtual') {
      const g: Record<string, typeof list> = {}
      list.forEach(f => { const gr = folderGroups[f.folder] || 'Un-grouped'; if (!g[gr]) g[gr] = []; g[gr].push(f) })
      return g
    }
    return { 'All Folders': list }
  }, [filteredItems, groupBy, folderGroups])

  const displayedFolders = useMemo(() => {
    const list: Record<string, typeof folderAggregates[string]> = {}
    let totalCount = 0
    Object.entries(folderAggregates).forEach(([gn, folders]) => {
      const matched = folders.filter(f => f.folder.toLowerCase().includes(searchTerm.toLowerCase()))
      if (matched.length > 0) { list[gn] = matched; totalCount += matched.length }
    })
    return { list, totalCount }
  }, [folderAggregates, searchTerm])

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (window.confirm('⚠️ Reset Stats?\n\nThis will clear all recorded counts and move the start date to TODAY. This cannot be undone.')) {
      setRecords([])
      setStartDate(Date.now())
    }
  }, [])

  const handleShareSummary = useCallback(() => {
    const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0)
    const duration = filteredItems.reduce((acc, r) => acc + (r.duration || 0), 0)
    let text = `📊 *Uni Desk Work Summary*\n`
    text += `📅 Period: ${filterLabel}\n━━━━━━━━━━━━━━━━━━\n`
    text += `✅ Total Videos: ${total}\n⏳ Total Time: ${formatDuration(duration)}\n\n*Breakdown:*\n`
    Object.entries(categoryCounts).forEach(([pfx, count]) => {
      if (count > 0) text += `• ${pfx === 'OTHER' ? 'Other' : (PREFIX_NAMES[pfx] || pfx)}: ${count}\n`
    })
    text += `\n_Generated via Uni Desk_`
    navigator.clipboard.writeText(text)
    showToast({ title: 'Summary Copied', message: 'Report copied to clipboard.', type: 'success' })
  }, [categoryCounts, filteredItems, filterLabel, formatDuration, showToast])

  const handleGenerateExcel = useCallback(async () => {
    if (!api || !api.settings || !api.settings.generateExcel || !api.dialog || !api.dialog.saveFile) {
      showToast({ title: 'Not Available', message: 'Excel feature not supported in this version.', type: 'danger' })
      return
    }
    try {
      const activeSafarLabel = (selectedSafar && selectedSafar !== 'all') ? selectedSafar : 'One_Tap_Stats'
      const defaultName = `${activeSafarLabel.replace(/[\\/:*?"<>| ]/g, '_')}_Stats.xlsx`
      const targetPath = await api.dialog.saveFile({
        title: 'Save Excel Report',
        defaultPath: defaultName,
        filters: [{ name: 'Excel Spreadsheets', extensions: ['xlsx'] }]
      })

      if (!targetPath) {
        return // User cancelled
      }

      const itemsToExport = (filteredItems.length > 0 && selectedSafar !== 'all') ? filteredItems : records
      const res = await api.settings.generateExcel(itemsToExport, targetPath)
      if (res && res.success) {
        showToast({ title: 'Excel Generated 📊', message: 'Spreadsheet generated successfully.', type: 'success' })
        if (api.shell && api.shell.openFolder) {
          await api.shell.openFolder(targetPath)
        }
      } else {
        showToast({ title: 'Generation Failed', message: res.error || 'Could not generate Excel file.', type: 'danger' })
      }
    } catch (err) {
      showToast({ title: 'Error', message: 'An error occurred while generating Excel.', type: 'danger' })
    }
  }, [records, filteredItems, selectedSafar, showToast])

  const handleExportCsvReport = useCallback(async () => {
    try {
      const itemsToExport = (filteredItems.length > 0) ? filteredItems : records
      if (itemsToExport.length === 0) {
        showToast({ title: 'No Data', message: 'There are no records to export in the current view.', type: 'warning' })
        return
      }

      const headers = ['Video Name', 'Prefix', 'Event Type', 'Hijri Date', 'Gregorian Date', 'Duration (s)', 'Duration', 'Safar', 'City', 'Folder']
      const rows = itemsToExport.map(it => {
        const sec = it.duration || 0
        const durFmt = formatDuration(sec)
        const eventName = PREFIX_NAMES[it.prefix] || it.prefix
        const dStr = getLocalDateString(it.date)
        const hijriStr = it.hijriYear && it.hijriMonth && it.hijriDay 
          ? `${it.hijriYear}-${String(it.hijriMonth).padStart(2, '0')}-${String(it.hijriDay).padStart(2, '0')}`
          : ''
        return [
          `"${(it.name || '').replace(/"/g, '""')}"`,
          `"${(it.prefix || '').replace(/"/g, '""')}"`,
          `"${(eventName || '').replace(/"/g, '""')}"`,
          `"${hijriStr}"`,
          `"${dStr}"`,
          sec,
          `"${durFmt}"`,
          `"${(it.safar || '').replace(/"/g, '""')}"`,
          `"${(it.city || '').replace(/"/g, '""')}"`,
          `"${(it.folder || '').replace(/"/g, '""')}"`
        ].join(',')
      })

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
      const activeSafarLabel = (selectedSafar && selectedSafar !== 'all') ? selectedSafar : 'One_Tap_Stats'
      const defaultName = `${activeSafarLabel.replace(/[\\/:*?"<>| ]/g, '_')}_Export.csv`

      if (api?.dialog?.saveFile && api?.dialog?.writeTextFile) {
        const targetPath = await api.dialog.saveFile({
          title: 'Export Stats to CSV',
          defaultPath: defaultName,
          filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        })
        if (!targetPath) return
        const res = await api.dialog.writeTextFile({ filePath: targetPath, content: csvContent })
        if (res && res.success) {
          showToast({ title: 'CSV Exported 📑', message: 'Saved CSV file successfully.', type: 'success' })
          if (api.shell?.openFolder) {
            api.shell.openFolder(targetPath)
          }
        } else {
          showToast({ title: 'Export Failed', message: res?.error || 'Could not save CSV file.', type: 'danger' })
        }
      } else {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showToast({ title: 'CSV Exported 📑', message: 'Downloaded CSV file.', type: 'success' })
      }
    } catch (err: any) {
      showToast({ title: 'Export Error', message: err.message || String(err), type: 'danger' })
    }
  }, [filteredItems, records, selectedSafar, showToast])

  const handleExportPdfReport = useCallback(async () => {
    const exportFn = api?.archiveCatalog?.exportSafarPdf
    if (!exportFn) {
      showToast({ title: 'Not Available', message: 'PDF export service is not available.', type: 'danger' })
      return
    }

    try {
      const activeSafarLabel = (selectedSafar && selectedSafar !== 'all') ? selectedSafar : 'Workstation Master Stats'
      const activeCity = (selectedCity && selectedCity !== 'all') ? selectedCity : 'All Cities'
      const activeYear = filterType === 'hijri' ? hijriYear : undefined

      const totalDurSec = filteredItems.reduce((acc, it) => acc + (it.duration || 0), 0)
      const hrs = Math.floor(totalDurSec / 3600)
      const mins = Math.floor((totalDurSec % 3600) / 60)
      const secs = Math.floor(totalDurSec % 60)
      const durationFmt = hrs > 0
        ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

      const daysGroup: Record<string, number> = {}
      filteredItems.forEach(it => {
        const dStr = getLocalDateString(it.date)
        daysGroup[dStr] = (daysGroup[dStr] || 0) + 1
      })

      const daysList = Object.entries(daysGroup)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dStr, count]) => ({
          date_key: dStr,
          mp4_count: count,
          sessions: [],
          duration: '',
          size_mb: 0
        }))

      const eventsList = Object.entries(categoryCounts || {})
        .filter(([_, c]) => (c as number) > 0)
        .map(([code, count]) => ({
          code,
          name: PREFIX_NAMES[code] || code,
          count: count as number,
          duration: '',
          size_mb: 0
        }))

      const pdfData = {
        safar_name: activeSafarLabel,
        city: activeCity,
        safar_year: activeYear,
        total_files: filteredItems.length,
        total_mp4_count: filteredItems.length,
        total_size_bytes: filteredItems.length * 500 * 1024 * 1024,
        total_duration_seconds: totalDurSec,
        duration_formatted: durationFmt,
        total_days_count: daysList.length || 1,
        events: eventsList,
        days: daysList
      }

      showToast({ title: 'Generating PDF 📄', message: 'Rendering executive Safar PDF audit report...', type: 'info' })
      const res = await exportFn({ pdfData, defaultName: `${activeSafarLabel.replace(/[\\/:*?"<>| ]/g, '_')}_Audit_Report.pdf` })
      if (res && res.success && res.filePath) {
        showToast({
          title: 'PDF Exported 📄',
          message: `Saved executive report to ${res.filePath.split(/[\\/]/).pop()}`,
          type: 'success'
        })
      } else if (res && !res.canceled) {
        showToast({ title: 'Export Failed', message: res.error || 'Failed to export PDF.', type: 'danger' })
      }
    } catch (err: any) {
      showToast({ title: 'Export Error', message: err.message || String(err), type: 'danger' })
    }
  }, [selectedSafar, selectedCity, filterType, hijriYear, filteredItems, categoryCounts, showToast])

  const handleImport = useCallback(async () => {
    const p = await api.dialog.openFolder({ title: 'Select Final Rendered Folder' })
    if (!p) return
    try {
      const results = await api.titleAdder.scanStats(p)
      if (results.length > 0) {
        const newRecords: StatRecord[] = []
        results.forEach(r => {
          const isDup = records.some(n => {
            if (n.filePath && r.fullPath && n.filePath.toLowerCase() === r.fullPath.toLowerCase()) return true
            return n.name === r.name && n.prefix === r.prefix && (n.folder || '') === (r.folder || '') && Math.abs((n.date || 0) - (r.date || 0)) < 86400000
          })
          if (!isDup) {
            const parseTarget = r.fullPath || r.folder || ''
            const hierarchy = parseSafarHierarchy(parseTarget)
            const folderInfo = parseFolderName(parseTarget)
            const safarOverride = folderSafars[r.folder || '']
            const resolvedSafar = (safarOverride && safarOverride !== 'Unassigned')
              ? safarOverride
              : (r.safar || hierarchy.safar || 'Unassigned')
            const cityOverride = folderCities[r.folder || '']
            const resolvedCity = (cityOverride && cityOverride !== 'Unassigned')
              ? cityOverride
              : (r.city || hierarchy.city || folderInfo.city || detectCity(r.name, parseTarget))

            newRecords.push({
              prefix: r.prefix,
              name: r.name,
              date: r.date,
              folder: r.folder,
              duration: r.duration || 0,
              safar: resolvedSafar,
              safarYear: r.safarYear || hierarchy.safarYear,
              safarSerial: r.safarSerial || hierarchy.safarSerial,
              city: resolvedCity,
              hijriYear: r.hijriYear || hierarchy.hijriYear || folderInfo.hijriYear,
              hijriMonth: r.hijriMonth || hierarchy.hijriMonth || folderInfo.hijriMonth,
              hijriDay: r.hijriDay || hierarchy.hijriDay,
              session: r.session || hierarchy.session,
              filePath: r.fullPath || ''
            })
          }
        })
        if (newRecords.length > 0) {
          const updated = [...records, ...newRecords]
          setRecords(updated)
          if (api.statsDb) {
            api.statsDb.insertBatch(newRecords).catch(console.error)
          }
          showToast({ title: 'Import Successful', message: `Added ${newRecords.length} new records.`, type: 'success' })
        } else {
          showToast({ title: 'No New Records', message: 'All items already counted.', type: 'info' })
        }
      } else {
        showToast({ title: 'No Videos Found', message: 'No rendered videos found in that folder.', type: 'warning' })
      }
    } catch (e) {
      console.error('[Stats] Import failed:', e)
      showToast({ title: 'Import Failed', message: 'An error occurred during import.', type: 'danger' })
    }
  }, [records, folderCities, showToast])

  const handleRenameFolder = useCallback((oldName: string, newName: string) => {
    if (editingFolder !== oldName) return
    if (!newName.trim() || oldName === newName) { setEditingFolder(null); return }
    setRecords(prev => prev.map(r => (r.folder === oldName || (!r.folder && oldName === 'Direct Render')) ? { ...r, folder: newName } : r))
    setEditingFolder(null)
    showToast({ title: 'Folder Renamed', message: `Renamed to "${newName}"`, type: 'success' })
  }, [editingFolder, showToast])

  const handleDeleteFolder = useCallback(async (folderName: string) => {
    if (window.confirm(`Remove "${folderName}" and all its records from statistics?`)) {
      const nextRecords = records.filter(r => r.folder !== folderName && !(!r.folder && folderName === 'Direct Render'))
      const newGroups = { ...folderGroups }
      delete newGroups[folderName]
      setRecords(nextRecords)
      setFolderGroups(newGroups)
      localStorage.setItem('render_stats', JSON.stringify(nextRecords))
      localStorage.setItem('ot_stats_folder_groups', JSON.stringify(newGroups))
      if (api) {
        await api.settings.setAndSave('render_stats', nextRecords).catch(() => {})
        await api.settings.setAndSave('stats_folder_groups', newGroups).catch(() => {})
        if (api.statsDb && typeof api.statsDb.deleteFolder === 'function') {
          await api.statsDb.deleteFolder({ folder: folderName }).catch(() => {})
        }
      }
      showToast({ title: 'Folder Removed', message: `Removed all records for "${folderName}"`, type: 'info' })
    }
  }, [records, folderGroups, showToast])

  const handleMoveToGroup = useCallback((folderName: string, groupName: string) => {
    setFolderGroups(prev => ({ ...prev, [folderName]: groupName }))
    showToast({ title: 'Moved', message: `"${folderName}" → "${groupName || 'Un-grouped'}"`, type: 'success' })
  }, [showToast])

  // Donut chart slice renderer
  const renderDonutSlice = (slice: any, _index: number) => {
    const radius = 90
    const innerRadius = 55
    const cx = 100
    const cy = 100
    const isSelected = selectedCategoryFilter === slice.prefix
    const isHovered = hoveredPrefix === slice.prefix
    
    if (slice.pct >= 0.999) {
      return (
        <circle
          key={slice.prefix}
          cx={cx}
          cy={cy}
          r={(radius + innerRadius) / 2}
          stroke={slice.color}
          strokeWidth={radius - innerRadius}
          fill="none"
          onClick={() => {
            setSelectedCategoryFilter(prev => prev === slice.prefix ? null : slice.prefix)
          }}
          onMouseEnter={() => setHoveredPrefix(slice.prefix)}
          onMouseLeave={() => setHoveredPrefix(null)}
          style={{
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            opacity: selectedCategoryFilter ? (isSelected ? 1 : 0.4) : 1,
            transform: isHovered ? 'scale(1.03)' : 'none',
            transformOrigin: `${cx}px ${cy}px`
          }}
        />
      )
    }
    
    const pathData = getPieSlicePath(slice.startAngle, slice.endAngle, radius, innerRadius)
    
    return (
      <path
        key={slice.prefix}
        d={pathData}
        fill={slice.color}
        onClick={() => {
          setSelectedCategoryFilter(prev => prev === slice.prefix ? null : slice.prefix)
        }}
        onMouseEnter={() => setHoveredPrefix(slice.prefix)}
        onMouseLeave={() => setHoveredPrefix(null)}
        style={{
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          opacity: selectedCategoryFilter ? (isSelected ? 1 : 0.4) : 1,
          transform: isHovered ? 'scale(1.05)' : 'none',
          transformOrigin: `${cx}px ${cy}px`
        }}
      />
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const currentHijriYear = hijriFromGregorian(new Date()).year

  return (
    <div className="stats-page">

      {/* ── TOP BAR ── */}
      <div className="stats-topbar animate-fade-in">
        {/* Left: Title + Tabs */}
        <div className="stats-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2
            className="stats-title"
            onClick={handleTitleClick}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            title="Stats (Secret: Triple click or Ctrl+Shift+O to locate & sync old data)"
          >
            📊 Stats
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="stats-tab-group">
              <button
                className={`stats-tab-btn ${statsTab === 'category' ? 'active' : ''}`}
                onClick={() => { setStatsTab('category'); setSelectedSafarDetail(null); setSelectedMonthDetail(null); setSelectedMonthCategory(null) }}
              >
                📊 By Category
              </button>
              <button
                className={`stats-tab-btn ${statsTab === 'safar' ? 'active' : ''}`}
                onClick={() => { setStatsTab('safar'); setSelectedSafarDetail(null); setSelectedMonthDetail(null); setSelectedMonthCategory(null) }}
              >
                🏕️ By Safar
              </button>
              <button
                className={`stats-tab-btn ${statsTab === 'reedit' ? 'active' : ''}`}
                onClick={() => { setStatsTab('reedit'); setSelectedSafarDetail(null); setSelectedMonthDetail(null); setSelectedMonthCategory(null) }}
              >
                🔄 Re-edit History
              </button>
            </div>

            <div className="stats-tab-group">
              <button
                type="button"
                className={`stats-tab-btn ${statsViewMode === 'grid' ? 'active' : ''}`}
                onClick={() => { setStatsViewMode('grid'); localStorage.setItem('ot_stats_view_mode', 'grid') }}
                title="Grid View"
              >
                📊 Grid
              </button>
              <button
                type="button"
                className={`stats-tab-btn ${statsViewMode === 'list' ? 'active' : ''}`}
                onClick={() => { setStatsViewMode('list'); localStorage.setItem('ot_stats_view_mode', 'list') }}
                title="List View"
              >
                📝 List
              </button>
            </div>
          </div>
        </div>

        {/* Right: Action buttons */}
        <div className="stats-topbar-right">
          <button
            className="stats-action-btn search-trigger-btn"
            onClick={() => setIsSpotlightOpen(true)}
            title="Spotlight Search across all videos, safars, dates, and sessions (Ctrl + F)"
          >
            🔍 Search <span className="stats-kbd-pill">Ctrl+F</span>
          </button>
          <button className={`stats-action-btn ${showTrends ? 'active' : ''}`} onClick={() => setShowTrends(!showTrends)} title="Show 14-day trend chart">
            📈 Trends
          </button>
          {/* Unified Export Menu (Excel, PDF, CSV) */}
          <div className="stats-export-dropdown-wrapper" ref={exportDropdownRef}>
            <button
              type="button"
              className={`stats-action-btn export-unified-btn ${isExportMenuOpen ? 'active' : ''}`}
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              title="Export Analytics & Records in Excel (.xlsx), PDF (.pdf), or CSV (.csv)"
            >
              <span>📤 Export Reports</span>
              <span className="export-chevron">{isExportMenuOpen ? '▴' : '▾'}</span>
            </button>
            {isExportMenuOpen && (
              <div className="stats-export-menu anim-scale-in">
                <div className="stats-export-header">EXPORT REPORTS &amp; AUDITS</div>

                <button
                  type="button"
                  className="stats-export-menu-item excel-item"
                  onClick={() => {
                    setIsExportMenuOpen(false)
                    handleGenerateExcel()
                  }}
                >
                  <div className="export-item-icon-box excel-icon-box">📊</div>
                  <div className="export-item-text">
                    <div className="export-item-title">Excel Spreadsheet (.xlsx)</div>
                    <div className="export-item-desc">Comprehensive workbook with sheets, formulas &amp; summaries</div>
                  </div>
                  <span className="export-item-badge xlsx-badge">XLSX</span>
                </button>

                <button
                  type="button"
                  className="stats-export-menu-item pdf-item"
                  onClick={() => {
                    setIsExportMenuOpen(false)
                    handleExportPdfReport()
                  }}
                >
                  <div className="export-item-icon-box pdf-icon-box">📄</div>
                  <div className="export-item-text">
                    <div className="export-item-title">Executive PDF Report (.pdf)</div>
                    <div className="export-item-desc">High-resolution printable Safar audit report with charts</div>
                  </div>
                  <span className="export-item-badge pdf-badge">PDF</span>
                </button>

                <button
                  type="button"
                  className="stats-export-menu-item csv-item"
                  onClick={() => {
                    setIsExportMenuOpen(false)
                    handleExportCsvReport()
                  }}
                >
                  <div className="export-item-icon-box csv-icon-box">📑</div>
                  <div className="export-item-text">
                    <div className="export-item-title">Raw CSV Data (.csv)</div>
                    <div className="export-item-desc">Universal comma-delimited export of all filtered records</div>
                  </div>
                  <span className="export-item-badge csv-badge">CSV</span>
                </button>
              </div>
            )}
          </div>
          <button className="stats-action-btn" onClick={handleShareSummary} title="Copy summary to clipboard">
            🔗 Copy Report
          </button>
          <button className="stats-action-btn" onClick={handleImport} title="Import from folder">
            📥 Import
          </button>
          <button
            className="stats-action-btn"
            onClick={() => setShowSyncOldDataModal(true)}
            title="Scan & Sync historical Safar folders into Stats (Ctrl+Shift+O)"
          >
            ⚡ Sync Safar
          </button>
          <button className="stats-action-btn danger" onClick={handleReset} title="Reset all stats">
            🔄 Reset
          </button>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="stats-filterbar anim-scale-in">
        {/* Period type toggle */}
        <div className="filterbar-section">
          <span className="filterbar-label">Period</span>
          <div className="filter-mode-switch">
            <button
              className={`mode-switch-btn ${filterType === 'hijri' ? 'active' : ''}`}
              onClick={() => setFilterType('hijri')}
            >
              🌙 Hijri
            </button>
            <button
              className={`mode-switch-btn ${filterType === 'relative' ? 'active' : ''}`}
              onClick={() => setFilterType('relative')}
            >
              📅 Gregorian
            </button>
            <button
              className={`mode-switch-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              🌍 All Records
            </button>
          </div>
        </div>

        {filterType !== 'all' && <div className="filterbar-divider" />}

        {/* Period-specific inputs */}
        {filterType === 'hijri' ? (
          <div className="filterbar-section hijri-section">
            {/* Year spinner */}
            <div className="hijri-input-group">
              <label>Year:</label>
              <div className="year-spinner">
                <button className="spinner-btn" onClick={() => setHijriYear(p => p - 1)}>◀</button>
                <input
                  type="number"
                  className="hijri-year-input"
                  value={hijriYear}
                  onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setHijriYear(v) }}
                />
                <button className="spinner-btn" onClick={() => setHijriYear(p => p + 1)}>▶</button>
              </div>
            </div>

            {/* Month select */}
            <div className="hijri-input-group">
              <label>Month:</label>
              <select
                className="hijri-month-select"
                value={hijriMonth}
                onChange={e => setHijriMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">All Months</option>
                {HIJRI_MONTH_NAMES_LONG.map((name, idx) => (
                  <option key={idx} value={idx + 1}>{idx + 1}. {name}</option>
                ))}
              </select>
            </div>

            {/* Quick year pills */}
            <div className="hijri-quick-years">
              {uniqueHijriYears.map(y => (
                <button
                  key={y}
                  className={`quick-year-btn ${hijriYear === y ? 'active' : ''}`}
                  onClick={() => { setFilterType('hijri'); setHijriYear(y) }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        ) : filterType === 'relative' ? (
          <div className="filterbar-section">
            {/* Gregorian sub-filter pills */}
            <div className="stats-filters">
              {(['today', 'month', 'year', 'total'] as const).map(f => (
                <button
                  key={f}
                  className={`stats-filter-btn ${relFilter === f ? 'active' : ''}`}
                  onClick={() => setRelFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {relFilter === 'total' && (
              <div className="stats-info" style={{ marginLeft: '12px' }}>
                <span className="icon">📅</span>
                Since:&nbsp;
                {isEditing ? (
                  <input
                    type="date"
                    className="stats-date-input"
                    value={getLocalDateString(startDate)}
                    onChange={e => {
                      const parts = e.target.value.split('-')
                      if (parts.length === 3) {
                        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
                        if (!isNaN(d.getTime())) setStartDate(d.getTime())
                      }
                    }}
                    onBlur={() => setIsEditing(false)}
                    onKeyDown={e => e.key === 'Enter' && setIsEditing(false)}
                    autoFocus
                  />
                ) : (
                  <strong className="stats-date-display" onClick={() => setIsEditing(true)} title="Click to change">
                    {new Date(startDate).toLocaleDateString()}
                    <span className="hijri-badge">{toMisriHijri(startDate)}</span>
                  </strong>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="filterbar-section">
            <span style={{ fontSize: '12px', opacity: 0.75, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✨ Showing all time records without any date filters or limits.
            </span>
          </div>
        )}

        {/* Safar filter (hidden in All Records mode as per requested "no classification no filters everything") */}
        {filterType !== 'all' && (
          <>
            <div className="filterbar-divider" />
            <div className="filterbar-section">
              <span className="filterbar-label">Safar</span>
              <select
                value={selectedSafar}
                onChange={e => { setSelectedSafar(e.target.value); setSelectedSafarDetail(null); setSelectedMonthDetail(null); setSelectedMonthCategory(null) }}
                className="hijri-month-select"
              >
                <option value="all">🏕️ All Safars</option>
                {uniqueSafarsList.map(s => {
                  const hierarchy = parseSafarHierarchy(s)
                  const label = s === 'Unassigned' ? '🌍 Unassigned' : (hierarchy.safarName ? `${hierarchy.safarSerial ? `[${hierarchy.safarSerial}] ` : ''}${hierarchy.safarName}` : s)
                  return (
                    <option key={s} value={s}>
                      {s === 'Unassigned' ? '🌍 Unassigned' : `🏕️ ${label}`}
                    </option>
                  )
                })}
              </select>
            </div>
          </>
        )}

        {/* Show empty categories toggle (category tab only) */}
        {statsTab === 'category' && records.length > 0 && (
          <>
            <div className="filterbar-divider" />
            <div className="filterbar-section">
              <label className="show-empty-checkbox">
                <input type="checkbox" checked={showEmptyCategories} onChange={e => setShowEmptyCategories(e.target.checked)} />
                <span>Show Empty</span>
              </label>
            </div>
          </>
        )}


      </div>

      {/* Period label pill */}
      <div className="period-label-row">
        <span className="period-label-pill">Showing: <strong>{filterLabel}</strong></span>
        <span className="period-total-pill">
          {filteredItems.length} record{filteredItems.length !== 1 ? 's' : ''}
          {filterType !== 'all' && selectedCity !== 'all' && <> · 🌆 {selectedCity}</>}
        </span>
      </div>

      {/* ── TRENDS CHART ── */}
      {showTrends && (
        <div className="stats-trends-wrap anim-scale-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
          <Card className="trends-card">
            <div className="trends-header">
              <div className="trends-header-left">
                <h3>Render Activity — Last 14 Days</h3>
                <p>Click any point to see breakdown</p>
              </div>
              <div className="trends-total-badge">
                <span className="trends-total-label">14-Day Total:</span>
                <span className="trends-total-value">{trendsData.totalTrendCount} videos</span>
              </div>
            </div>
            <div className="trends-chart-container" style={{ padding: '24px 0', height: '240px' }}>
              <svg viewBox="0 -10 800 230" width="100%" height="100%" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="trendsLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="50%" stopColor="#EC4899" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                  <linearGradient id="trendsAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(139, 92, 246, 0.2)" />
                    <stop offset="100%" stopColor="rgba(139, 92, 246, 0.0)" />
                  </linearGradient>
                  <filter id="trendsShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#8B5CF6" floodOpacity="0.3" />
                  </filter>
                </defs>
                {[25, 65, 105, 145, 175].map((y, idx) => (
                  <line key={idx} x1="0" y1={y} x2="800" y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 6" opacity={idx === 4 ? 0.8 : 0.25} />
                ))}
                {trendsData.areaPath && <path d={trendsData.areaPath} fill="url(#trendsAreaGrad)" />}
                {trendsData.linePath && (
                  <path d={trendsData.linePath} fill="none" stroke="url(#trendsLineGrad)" strokeWidth="4.5" strokeLinecap="round" filter="url(#trendsShadow)" />
                )}
                {trendsData.points.map((pt, i) => {
                  const isSel = selectedDay === pt.day
                  return (
                    <g key={i} className="chart-point-group" style={{ cursor: pt.count > 0 ? 'pointer' : 'default' }} onClick={() => pt.count > 0 && setSelectedDay(isSel ? null : pt.day)}>
                      {isSel && <circle cx={pt.x} cy={pt.y} r="14" fill="none" stroke="#8B5CF6" strokeWidth="2" opacity="0.6" />}
                      <circle cx={pt.x} cy={pt.y} r="12" fill="rgba(139,92,246,0.2)" opacity="0" className="chart-point-glow" />
                      <circle cx={pt.x} cy={pt.y} r={isSel ? 7 : 5.5} fill={isSel ? '#8B5CF6' : '#ffffff'} stroke="#8B5CF6" strokeWidth="3.5" />
                      {pt.count > 0 && !isSel && (
                        <g className="chart-tooltip-group">
                          <rect x={pt.x - 18} y={pt.y - 32} width="36" height="20" rx="5" fill="var(--surface-3)" stroke="var(--border)" strokeWidth="1" />
                          <text x={pt.x} y={pt.y - 18} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text-primary)">{pt.count}</text>
                        </g>
                      )}
                      <text x={pt.x} y="198" textAnchor="middle" fontSize="10" fontWeight={isSel ? '800' : '600'} fill={isSel ? '#a78bfa' : 'var(--text-muted)'}>
                        {new Date(pt.day).toLocaleDateString(undefined, { weekday: 'short' })}
                      </text>
                      <text x={pt.x} y="210" textAnchor="middle" fontSize="9" fill={isSel ? '#a78bfa' : 'var(--text-muted)'} opacity={isSel ? 1 : 0.6}>
                        {new Date(pt.day).getDate()}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
            {selectedDay && (() => {
              const pt = trendsData.points.find(p => p.day === selectedDay)
              if (!pt || pt.count === 0) return null
              const sorted = Object.entries(pt.breakdown).sort((a, b) => b[1] - a[1])
              const maxV = sorted[0]?.[1] || 1
              const fullDate = new Date(pt.day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              return (
                <div className="day-breakdown-panel anim-scale-in">
                  <div className="day-breakdown-header">
                    <div className="day-breakdown-title">
                      <span className="day-breakdown-icon">📅</span>
                      <div>
                        <div className="day-breakdown-date">{fullDate}</div>
                        <div className="day-breakdown-sub">{pt.count} video{pt.count !== 1 ? 's' : ''} rendered</div>
                      </div>
                    </div>
                    <button className="day-breakdown-close" onClick={() => setSelectedDay(null)}>✕</button>
                  </div>
                  <div className="day-breakdown-items">
                    {sorted.map(([pfx, count]) => (
                      <div key={pfx} className="day-breakdown-item">
                        <div className="day-breakdown-item-top">
                          <span className="day-breakdown-name">{pfx === 'OTHER' ? 'Other' : (PREFIX_NAMES[pfx] || pfx)}</span>
                          <span className="day-breakdown-count">{count}</span>
                        </div>
                        <div className="day-breakdown-bar-track">
                          <div className="day-breakdown-bar-fill" style={{ width: `${(count / maxV) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </Card>

          {/* Row 2: Side-by-Side Category and City Charts Dashboard */}
          <div className="trends-dashboard-grid">
            {/* Category Charts Card */}
            {categorySlices.length > 0 && (
              <Card className="trends-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', padding: '24px', alignItems: 'center', margin: 0 }}>
                
                {/* Left: Donut Chart */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Category Share</h4>
                  <div style={{ width: '180px', height: '180px', position: 'relative' }}>
                    <svg viewBox="0 0 200 200" width="100%" height="100%">
                      <g transform="translate(100, 100)">
                        {categorySlices.map((slice, idx) => renderDonutSlice(slice, idx))}
                        <g>
                          <text textAnchor="middle" y="-12" fontSize="13" fontWeight="800" fill="var(--text-primary)">{centerText.title}</text>
                          <text textAnchor="middle" y="8" fontSize="11" fontWeight="600" fill="var(--text-secondary)">{centerText.sub}</text>
                          <text textAnchor="middle" y="24" fontSize="10" fontWeight="700" fill="var(--text-muted)">{centerText.pct}</text>
                        </g>
                      </g>
                    </svg>
                  </div>
                  {selectedCategoryFilter && (
                    <GhostButton size="xs" onClick={() => setSelectedCategoryFilter(null)} style={{ marginTop: '8px' }}>Reset Filter</GhostButton>
                  )}
                </div>

                {/* Right: Bar Chart List */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Top Category Volumes</h4>
                  <div className="stats-charts-bars-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {categorySlices.slice(0, 6).map(slice => {
                      const isSelected = selectedCategoryFilter === slice.prefix
                      const isHovered = hoveredPrefix === slice.prefix
                      const maxVal = Math.max(...categorySlices.map(s => s.count), 1)
                      const barPct = (slice.count / maxVal) * 100
                      
                      return (
                        <div
                          key={slice.prefix}
                          className={`stats-chart-bar-row ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setStatsTab('category')
                            setSelectedCategoryFilter(prev => prev === slice.prefix ? null : slice.prefix)
                          }}
                          onMouseEnter={() => setHoveredPrefix(slice.prefix)}
                          onMouseLeave={() => setHoveredPrefix(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            transition: 'all 0.2s',
                            background: isSelected ? 'var(--surface-3)' : (isHovered ? 'var(--surface-2)' : 'transparent'),
                            border: isSelected ? '1px solid var(--accent-folder-soft)' : '1px solid transparent'
                          }}
                        >
                          <div style={{ width: '45px', fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>{slice.prefix}</div>
                          <div style={{ flex: 1, height: '8px', background: 'var(--surface-3)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${barPct}%`,
                                background: slice.color,
                                borderRadius: '4px',
                                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            />
                          </div>
                          <div style={{ width: '55px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {slice.count} vids
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* City Distribution Card */}
            {activeCities.length > 0 && (
              <Card className="trends-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', margin: 0 }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  City Distribution Comparison
                </h4>
                <div className="city-distribution-bars-container">
                  {activeCities.map((city, idx) => {
                    const barHeight = (city.count / maxCityCount) * 140
                    const isHovered = hoveredCity === city.name
                    
                    const hues = [250, 150, 320, 45, 190, 280, 10, 80, 220, 350]
                    const hue = hues[idx % hues.length]
                    const isUnassigned = city.name === 'Unassigned'
                    const barColor = isUnassigned ? '#94a3b8' : `hsl(${hue}, 80%, 65%)`
                    const barColorSoft = isUnassigned ? 'rgba(148, 163, 184, 0.15)' : `hsla(${hue}, 80%, 65%, 0.15)`
                    
                    return (
                      <div
                        key={city.name}
                        className={`stats-chart-city-bar-wrapper ${isHovered ? 'hovered' : ''}`}
                        onMouseEnter={() => setHoveredCity(city.name)}
                        onMouseLeave={() => setHoveredCity(null)}
                        onClick={() => {
                          setSelectedCity(city.name === 'Unassigned' ? 'all' : city.name)
                          setSelectedCityDetail(city.name)
                          setSelectedAnalyticsYear(currentHijriYear)
                          setSelectedMonthDetail(null)
                          setSelectedMonthCategory(null)
                        }}
                      >
                        {/* Tooltip on Hover */}
                        {isHovered && (
                          <div className="city-chart-tooltip">
                            {city.count} video{city.count !== 1 ? 's' : ''}
                          </div>
                        )}
                        
                        {/* The Bar */}
                        <div
                          className="city-chart-bar"
                          style={{
                            height: `${barHeight}px`,
                            background: isHovered ? barColor : barColorSoft,
                            border: `1.5px solid ${barColor}`,
                            boxShadow: isHovered ? `0 0 12px ${barColor}40` : 'none'
                          }}
                        >
                          <div className="city-chart-bar-val">
                            {city.count}
                          </div>
                        </div>
                        
                        {/* Label (Rotated X-Axis Label) */}
                        <div className="city-chart-bar-label" title={city.name}>
                          {isUnassigned ? 'Unassigned' : city.name}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      {isLoading ? (
        <div style={{ padding: '8px 0' }}>
          <SkeletonStatsGrid />
        </div>
      ) : ((statsTab === 'category' && filteredItems.length === 0) || (statsTab === 'reedit' && filteredReeditItems.length === 0) || (statsTab === 'safar' && normalRecords.length === 0)) ? (
        <div className="stats-empty-state anim-scale-in">
          <div className="empty-state-icon">📊</div>
          <h3>No Records for This Period</h3>
          <p>
            No {statsTab === 'reedit' ? 're-edited' : 'rendered'} videos found for <strong>{filterLabel}</strong>
            {selectedCity !== 'all' && <> in <strong>{selectedCity}</strong></>}.
            {statsTab !== 'reedit' && 'Try a different period or city, or import a folder.'}
          </p>
          {statsTab !== 'reedit' && (
            <button className="empty-state-btn" onClick={handleImport}>📥 Import Folder</button>
          )}
        </div>
      ) : (
        <>
          {/* ── CATEGORY TAB ── */}
          {statsTab === 'category' && (
            <>
              <div className={statsViewMode === 'grid' ? 'stats-grid' : 'stats-list-container'}>
                {displayedPrefixes.map((pfx, i) => {
                  const count = categoryCounts[pfx] || 0
                  const label = pfx === 'OTHER' ? 'Other / Unmatched' : formatPrefixName(pfx)
                  const isSelected = selectedCategoryFilter === pfx
                  const theme = getPrefixColorTheme(pfx)
                  const sliceColor = categorySlices.find(s => s.prefix === pfx)?.color || theme.accent
                  
                  return (
                    <Card
                      key={pfx}
                      onClick={() => {
                        setSelectedCategoryFilter(prev => prev === pfx ? null : pfx)
                      }}
                      className={`stat-card anim-scale-in ${statsViewMode === 'list' ? 'stat-card--list' : ''} ${isSelected ? 'selected-category-card' : ''}`}
                      style={{
                        animationDelay: `${i * 30}ms`,
                        cursor: 'pointer',
                        opacity: selectedCategoryFilter ? (isSelected ? 1 : 0.45) : 1,
                        transition: 'opacity 0.2s, transform 0.2s, border-color 0.2s',
                        transform: isSelected ? 'scale(1.02)' : 'none',
                        border: isSelected ? `1.5px solid ${sliceColor}` : undefined,
                        boxShadow: isSelected ? `0 4px 14px ${sliceColor}25` : undefined,
                        ...(statsViewMode === 'list' ? {
                          gridColumn: '1 / -1',
                          width: '100%'
                        } : {})
                      }}
                    >
                      {statsViewMode === 'list' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
                          <div className="stat-label" style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>{label}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div className="stat-prefix" style={{ margin: 0 }}>Prefix: {pfx}</div>
                            <div className="stat-value-row" style={{ margin: 0 }}>
                              <strong style={{ fontSize: '18px', color: sliceColor }}><AnimateNumber value={count} /></strong>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>video{count !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <div style={{ width: '120px' }}>
                            <div className="stat-progress" style={{ margin: 0, height: '6px' }}>
                              <div className="stat-progress-bar" style={{ width: `${(count / maxPrefixVolume) * 100}%`, background: sliceColor }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="stat-label">{label}</div>
                          <div className="stat-prefix">Prefix: {pfx}</div>
                          <div className="stat-value-row">
                            <div className="stat-value"><AnimateNumber value={count} /></div>
                            <div className="stat-unit">video{count !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="stat-progress">
                            <div className="stat-progress-bar" style={{ width: `${(count / maxPrefixVolume) * 100}%`, background: sliceColor }} />
                          </div>
                        </>
                      )}
                    </Card>
                  )
                })}
              </div>

              {/* Summary bar */}
              <div className="stats-summary anim-fade-in">
                <Card className="summary-card compact-summary-card">
                  <div className="summary-item">
                    <span className="summary-label">Total Videos ({filterLabel})</span>
                    <span className="summary-value"><AnimateNumber value={Object.values(categoryCounts).reduce((a, b) => a + b, 0)} /></span>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <span className="summary-label">Duration Processed</span>
                    <span className="summary-value">
                      <AnimateNumber value={filteredItems.reduce((acc, r) => acc + (r.duration || 0), 0)} formatter={formatDuration} />
                    </span>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <span className="summary-label">Top Category</span>
                    <span className="summary-value highlight">
                      {(() => {
                        const top = Object.entries(categoryCounts).reduce((a, b) => a[1] > b[1] ? a : b, ['N/A', 0])
                        return top[1] > 0 ? (top[0] === 'OTHER' ? 'Other' : (PREFIX_NAMES[top[0]] || top[0])) : 'None'
                      })()}
                    </span>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* ── SAFAR TAB ── */}
          {statsTab === 'safar' && (
            <>
              {uniqueSafarsList.filter(s => selectedSafar === 'all' || s === selectedSafar).length === 0 ? (
                <div className="stats-empty-state anim-scale-in">
                  <div className="empty-state-icon">🏕️</div>
                  <h3>No Safar Data</h3>
                  <p>No Safar information found. Ensure your folders follow the format <strong>1447-08 Mumbai - Urs Mubarak</strong> or use the 🏕️ button in the Folders table to assign Safars manually.</p>
                </div>
              ) : selectedSafarDetail === null ? (
                /* ==========================================
                   LEVEL 1: SAFARS GRID/LIST VIEW
                   ========================================== */
                <>
                  {/* Search Bar for Safars (Serial, Name, Year) */}
                  <div className="stats-search-row anim-scale-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', maxWidth: '380px' }}>
                      <span style={{ position: 'absolute', left: '12px', opacity: 0.6 }}>🔍</span>
                      <input
                        type="text"
                        placeholder="Search by serial (e.g. 08), name (Mumbai), or year (1447)..."
                        value={safarSearchQuery}
                        onChange={e => setSafarSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 16px 10px 36px',
                          borderRadius: '12px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          outline: 'none',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                      {safarSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setSafarSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      💡 <em>Ctrl+Click or Shift+Click cards to select multiple · Del to delete or unassign</em>
                    </div>
                  </div>

                  {/* Multi-selection Toolbar */}
                  {selectedSafarBlocks.length > 0 && (
                    <div className="safar-selection-bar anim-scale-in">
                      <div className="safar-selection-info">
                        <span className="safar-selection-badge">{selectedSafarBlocks.length}</span>
                        <span className="safar-selection-text">
                          <strong>{selectedSafarBlocks.length}</strong> Safar block{selectedSafarBlocks.length > 1 ? 's' : ''} selected
                          <span className="safar-selection-sub">({batchSelectedRecordCount} video records)</span>
                        </span>
                      </div>
                      <div className="safar-selection-actions">
                        <button
                          type="button"
                          className="safar-sel-btn"
                          onClick={() => setSelectedSafarBlocks([...searchedSafarsList])}
                          title="Select all filtered Safars (Ctrl+A)"
                        >
                          Select All ({searchedSafarsList.length})
                        </button>
                        <button
                          type="button"
                          className="safar-sel-btn"
                          onClick={() => setSelectedSafarBlocks([])}
                          title="Clear selection (Esc)"
                        >
                          Clear (Esc)
                        </button>
                        <button
                          type="button"
                          className="safar-sel-btn danger"
                          onClick={() => setBatchDeleteModalOpen(true)}
                          title="Delete or Move selected Safar blocks (Del)"
                        >
                          🗑️ Delete / Unassign ({selectedSafarBlocks.length})
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={statsViewMode === 'grid' ? 'stats-grid' : 'stats-list-container'}>
                    {searchedSafarsList.map((safar, i) => {
                      const summary = safarCardSummaries[safar] || {
                        periodCount: 0,
                        overallCount: 0,
                        safarDuration: 0,
                        sessionList: ['1'],
                        eventEntries: [],
                        cleanTitle: safar,
                        hierarchy: parseSafarHierarchy(safar),
                        isUnassigned: safar === 'Unassigned'
                      }
                      const {
                        periodCount,
                        overallCount,
                        safarDuration,
                        sessionList,
                        eventEntries,
                        cleanTitle,
                        hierarchy,
                        isUnassigned
                      } = summary

                      const isSelected = selectedSafarBlocks.includes(safar)

                      return (
                        <Card
                          key={safar}
                          className={`stat-card safar-card anim-scale-in ${statsViewMode === 'list' ? 'stat-card--list' : ''} ${isSelected ? 'selected' : ''}`}
                          style={{
                            animationDelay: `${i * 30}ms`,
                            cursor: 'pointer',
                            ...(statsViewMode === 'list' ? {
                              gridColumn: '1 / -1',
                              width: '100%'
                            } : {})
                          }}
                          onClick={(e) => handleSafarCardClick(e, safar, i, summary)}
                          onContextMenu={(e) => handleSafarContextMenu(e, safar)}
                        >
                          {/* Multi-selection Checkbox Indicator */}
                          <div
                            className={`safar-card-checkbox ${isSelected ? 'checked' : ''}`}
                            onClick={(e) => handleToggleSafarCheckbox(e, safar, i)}
                            title={isSelected ? 'Deselect block' : 'Select block (Ctrl+Click)'}
                          >
                            {isSelected ? '✓' : ''}
                          </div>
                          {statsViewMode === 'list' ? (
                            <div className="city-list-layout" style={{ width: '100%' }}>
                              <div className="city-list-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  {hierarchy.safarSerial && (
                                    <span className="safar-serial-badge">#{hierarchy.safarSerial}</span>
                                  )}
                                  {hierarchy.safarYear && (
                                    <span className="safar-year-badge">{hierarchy.safarYear} H</span>
                                  )}
                                  {hierarchy.city && hierarchy.city !== 'Unassigned' && (
                                    <span className="safar-city-badge">📍 {hierarchy.city}</span>
                                  )}
                                  <span className="safar-title-text" style={{ fontSize: '15px' }}>
                                    {cleanTitle}
                                  </span>
                                  {!isUnassigned && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); openRenameModal(safar); }}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '13px', padding: '2px 4px', marginLeft: '4px' }}
                                        title="Rename Safar Block"
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); openDeleteModal(safar); }}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '13px', padding: '2px 4px' }}
                                        title="Delete Safar Block"
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                                      >
                                        🗑️
                                      </button>
                                    </>
                                  )}
                                </div>

                                {/* Dynamic Category Mini Badges */}
                                <div className="safar-chips-grid" style={{ margin: 0 }}>
                                  {eventEntries.slice(0, 6).map(([pfx, cnt]) => {
                                    const pfxTheme = getPrefixColorTheme(pfx)
                                    return (
                                      <span
                                        key={pfx}
                                        className="safar-chip"
                                        title={`Click to filter ${formatPrefixName(pfx)} (${cnt})`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedSafarDetail(safar)
                                          setSelectedAnalyticsYear(hierarchy.safarYear || currentHijriYear)
                                          setSelectedMonthDetail(-1)
                                          setSelectedMonthCategory(pfx)
                                        }}
                                      >
                                        <span className="safar-chip-dot" style={{ background: pfxTheme.accent }} />
                                        <strong>{pfx}</strong>
                                        <span className="safar-chip-count">{cnt}</span>
                                      </span>
                                    )
                                  })}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                      <AnimateNumber value={overallCount} /> <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filterType !== 'all' && periodCount > 0 ? `vids (${periodCount} in period)` : 'vids'}</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      ⏱ {formatDuration(safarDuration)}
                                    </div>
                                  </div>
                                  <div style={{ width: '100px' }}>
                                    <div className="safar-progress-wrap">
                                      <div className="safar-progress-fill" style={{ width: `${Math.min((overallCount / maxSafarVolume) * 100, 100)}%` }} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="safar-card-header">
                                <div className="safar-badges-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {hierarchy.safarSerial && (
                                      <span className="safar-serial-badge">#{hierarchy.safarSerial}</span>
                                    )}
                                    {hierarchy.safarYear && (
                                      <span className="safar-year-badge">{hierarchy.safarYear} H</span>
                                    )}
                                    {hierarchy.city && hierarchy.city !== 'Unassigned' && (
                                      <span className="safar-city-badge">📍 {hierarchy.city}</span>
                                    )}
                                  </div>
                                  {!isUnassigned && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); openRenameModal(safar); }}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '13px', padding: '2px 4px' }}
                                        title="Rename Safar Block"
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); openDeleteModal(safar); }}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '13px', padding: '2px 4px' }}
                                        title="Delete Safar Block"
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <h4 className="safar-title-text" title={safar}>
                                  {cleanTitle}
                                </h4>
                              </div>

                              <div className="safar-value-section">
                                <div className="safar-big-number">
                                  <AnimateNumber value={overallCount} />
                                </div>
                                <div className="safar-number-unit">
                                  {filterType !== 'all' && periodCount > 0 ? (
                                    <>total videos <span style={{ opacity: 0.85, color: 'var(--accent-folder)' }}>({periodCount} in period)</span></>
                                  ) : (
                                    <>video{overallCount !== 1 ? 's' : ''} in Safar</>
                                  )}
                                </div>
                              </div>

                              {/* Dynamic event counting block chips */}
                              {eventEntries.length > 0 && (
                                <div className="safar-chips-grid">
                                  {eventEntries.map(([pfx, cnt]) => {
                                    const pfxTheme = getPrefixColorTheme(pfx)
                                    return (
                                      <span
                                        key={pfx}
                                        className="safar-chip"
                                        title={`Click to filter ${formatPrefixName(pfx)} (${cnt})`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedSafarDetail(safar)
                                          setSelectedAnalyticsYear(hierarchy.safarYear || currentHijriYear)
                                          setSelectedMonthDetail(-1)
                                          setSelectedMonthCategory(pfx)
                                        }}
                                      >
                                        <span className="safar-chip-dot" style={{ background: pfxTheme.accent }} />
                                        <strong>{pfx}</strong>
                                        <span className="safar-chip-count">{cnt}</span>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}

                              <div className="safar-card-footer">
                                <div className="safar-footer-row">
                                  <span>📁 Sessions:</span>
                                  <strong>{sessionList.length > 0 ? `${sessionList.length} (${sessionList.join(', ')})` : '1'}</strong>
                                </div>
                                <div className="safar-footer-row">
                                  <span>⏱ Duration:</span>
                                  <strong>{formatDuration(safarDuration)}</strong>
                                </div>
                                <div className="safar-footer-row">
                                  <span>🌎 All-time:</span>
                                  <strong>{overallCount} video{overallCount !== 1 ? 's' : ''}</strong>
                                </div>
                                <div className="safar-progress-wrap">
                                  <div
                                    className="safar-progress-fill"
                                    style={{ width: `${Math.min((overallCount / maxSafarVolume) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </Card>
                      )
                    })}
                  </div>

                  {/* Summary bar */}
                  <div className="stats-summary anim-fade-in" style={{ marginTop: '20px' }}>
                    <Card className="summary-card compact-summary-card">
                      <div className="summary-item">
                        <span className="summary-label">Total Videos ({filterLabel})</span>
                        <span className="summary-value"><AnimateNumber value={Object.values(safarCounts).reduce((a, b) => a + b, 0)} /></span>
                      </div>
                      <div className="summary-divider" />
                      <div className="summary-item">
                        <span className="summary-label">Duration Processed</span>
                        <span className="summary-value">
                          <AnimateNumber value={filteredItems.reduce((acc, r) => acc + (r.duration || 0), 0)} formatter={formatDuration} />
                        </span>
                      </div>
                      <div className="summary-divider" />
                      <div className="summary-item">
                        <span className="summary-label">Top Safar</span>
                        <span className="summary-value highlight">
                          {(() => {
                            const top = Object.entries(safarCounts).filter(([s]) => s !== 'Unassigned').reduce((a, b) => a[1] > b[1] ? a : b, ['—', 0] as [string, number])
                            return top[1] > 0 ? top[0] : '—'
                          })()}
                        </span>
                      </div>
                    </Card>
                  </div>
                </>
              ) : selectedMonthDetail === null ? (
                /* ==========================================
                   LEVEL 2: SAFAR DETAIL SUB-PAGE VIEW
                   ========================================== */
                (() => {
                  const safar = selectedSafarDetail
                  const hierarchy = parseSafarHierarchy(safar)
                  const isUnassigned = safar === 'Unassigned'
                  const cleanTitle = (() => {
                    if (isUnassigned) return 'Unassigned Videos'
                    if (hierarchy.safarName && hierarchy.safarName.includes(' - ')) {
                      const parts = hierarchy.safarName.split(' - ')
                      return parts.slice(1).join(' - ').trim() || hierarchy.safarName
                    }
                    return hierarchy.safarName || safar
                  })()

                  const theme = getPrefixColorTheme(safar)
                  const accent = 'var(--theme-accent, #6366f1)'

                  const safarAllRecords = normalRecords.filter(r => resolveSafar(r, folderSafars) === safar)
                  const overallCount = safarAllRecords.length
                  const safarYearRecords = isUnassigned
                    ? safarAllRecords
                    : safarAllRecords.filter(r => {
                        const info = parseSafarHierarchy(r.filePath || r.folder || '')
                        const y = r.hijriYear || info.hijriYear || hijriFromGregorian(new Date(r.date || Date.now())).year
                        return y === selectedAnalyticsYear
                      })
                  const totalDuration = safarYearRecords.reduce((acc, r) => acc + (r.duration || 0), 0)
                  const monthlyCounts = Array.from({ length: 12 }).map((_, mi) =>
                    safarYearRecords.filter(r => {
                      const info = parseSafarHierarchy(r.filePath || r.folder || '')
                      const m = r.hijriMonth || info.hijriMonth || (hijriFromGregorian(new Date(r.date)).month + 1)
                      return m === (mi + 1)
                    }).length
                  )
                  const maxMonthVal = Math.max(...monthlyCounts, 1)

                  return (
                    <div className="stats-details-wrap anim-scale-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Back button */}
                      <div>
                        <button
                          type="button"
                          onClick={() => { setSelectedSafarDetail(null); setSelectedMonthCategory(null); }}
                          className="stats-action-btn"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                        >
                          ← Back to Safars
                        </button>
                      </div>

                      <Card className="city-analytics-panel" style={{ flexDirection: 'column', padding: '24px', background: 'var(--surface)', border: '1.5px solid var(--border)' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-soft)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '28px' }}>🏕️</span>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {hierarchy.safarSerial && (
                                  <span className="safar-serial-badge">#{hierarchy.safarSerial}</span>
                                )}
                                {hierarchy.safarYear && (
                                  <span className="safar-year-badge">{hierarchy.safarYear} H</span>
                                )}
                                {hierarchy.city && hierarchy.city !== 'Unassigned' && (
                                  <span className="safar-city-badge">📍 {hierarchy.city}</span>
                                )}
                              </div>
                              <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {cleanTitle}
                              </h3>
                              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Hijri monthly breakdown for this Safar</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Year:</span>
                            <select
                              value={selectedAnalyticsYear}
                              onChange={e => setSelectedAnalyticsYear(Number(e.target.value))}
                              className="hijri-month-select"
                              style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text-primary)', cursor: 'pointer' }}
                            >
                              {uniqueYearsList.map(y => <option key={y} value={y}>{y} H</option>)}
                            </select>

                            {safar === 'Unassigned' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedMonthDetail(-1); setSelectedMonthCategory(null); }}
                                  className="stats-action-btn"
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'var(--theme-accent, #6366f1)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}
                                >
                                  📋 View All Unassigned Videos
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => openRenameModal(safar)}
                                  className="stats-action-btn"
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}
                                  title="Rename Safar Block"
                                >
                                  ✏️ Rename
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openDeleteModal(safar)}
                                  className="stats-action-btn danger"
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                                  title="Delete Safar Block"
                                >
                                  🗑️ Delete Block
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Summary mini cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                          <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '12px 14px', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{selectedAnalyticsYear} H Total</div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--theme-accent, #6366f1)', marginTop: '4px' }}>{safarYearRecords.length} vids</div>
                          </div>
                          <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '12px 14px', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Year Duration</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '4px' }}>{formatDuration(totalDuration)}</div>
                          </div>
                          <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '12px 14px', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>All-Time Total</div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{overallCount} vids</div>
                          </div>
                        </div>

                        {/* Timeline */}
                        <div style={{ background: 'var(--surface-3)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                          <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            📅 Month-by-Month ({selectedAnalyticsYear} H) — <span style={{ color: accent }}>Click a month row to view video stats list</span>
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px 16px' }}>
                            {HIJRI_MONTH_NAMES_SHORT.map((name, idx) => {
                              const count = monthlyCounts[idx]
                              const pct = (count / maxMonthVal) * 100
                              return (
                                <div
                                  key={idx}
                                  className="city-detail-month-row"
                                  onClick={() => { setSelectedMonthDetail(idx); setSelectedMonthCategory(null); }}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    background: 'rgba(255,255,255,0.01)',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-soft)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                      {idx + 1}. {name}
                                      <span style={{ opacity: 0.45, fontSize: '10px', marginLeft: '5px' }}>({HIJRI_MONTH_NAMES_ARABIC[idx]})</span>
                                    </span>
                                    <strong style={{ fontSize: '12px', color: count > 0 ? accent : 'var(--text-muted)' }}>
                                      {count} video{count !== 1 ? 's' : ''} {count > 0 && '➔'}
                                    </strong>
                                  </div>
                                  <div style={{ height: '5px', background: 'var(--bg)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: count > 0 ? accent : 'rgba(255,255,255,0.03)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </Card>
                    </div>
                  )
                })()
              ) : (
                /* ==========================================
                   LEVEL 3: MONTH STATS DRILLDOWN VIEW
                   ========================================== */
                (() => {
                  const safar = selectedSafarDetail
                  const hierarchy = parseSafarHierarchy(safar)
                  const isUnassigned = safar === 'Unassigned'
                  const monthIndex = selectedMonthDetail
                  const isAllMonths = monthIndex === -1
                  const monthName = isAllMonths ? 'All Months' : HIJRI_MONTH_NAMES_SHORT[monthIndex]
                  const monthNameLong = isAllMonths ? 'All Months Summary' : HIJRI_MONTH_NAMES_LONG[monthIndex]
                  const monthNameArabic = isAllMonths ? 'جميع الأشهر' : HIJRI_MONTH_NAMES_ARABIC[monthIndex]

                  const safarAllRecords = normalRecords.filter(r => resolveSafar(r, folderSafars) === safar)
                  const safarYearRecords = isUnassigned
                    ? safarAllRecords
                    : safarAllRecords.filter(r => {
                        const info = parseSafarHierarchy(r.filePath || r.folder || '')
                        const y = r.hijriYear || info.hijriYear || hijriFromGregorian(new Date(r.date || Date.now())).year
                        return y === selectedAnalyticsYear
                      })
                  
                  // Filter specific month or all months
                  const monthVideos = (isAllMonths || isUnassigned)
                    ? safarYearRecords
                    : safarYearRecords.filter(r => {
                        const info = parseSafarHierarchy(r.filePath || r.folder || '')
                        const m = r.hijriMonth || info.hijriMonth || (hijriFromGregorian(new Date(r.date || Date.now())).month + 1)
                        return m === (monthIndex + 1)
                      })

                  // Group by category prefix dynamically
                  const monthCategoryCounts = (() => {
                    const counts: Record<string, number> = {}
                    monthVideos.forEach(r => {
                      const pfx = (r.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'
                      counts[pfx] = (counts[pfx] || 0) + 1
                    })
                    return counts
                  })()

                  const monthDisplayedPrefixes = (() => {
                    const set = new Set(Object.keys(monthCategoryCounts))
                    return Array.from(set).filter(pfx => monthCategoryCounts[pfx] > 0).sort((a, b) => {
                      return monthCategoryCounts[b] - monthCategoryCounts[a]
                    })
                  })()

                  const maxMonthPrefixVolume = Math.max(...monthDisplayedPrefixes.map(p => monthCategoryCounts[p] || 0), 1)

                  const filteredMonthVideos = selectedMonthCategory
                    ? monthVideos.filter(v => {
                        const pfx = (v.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'
                        return pfx === selectedMonthCategory
                      })
                    : monthVideos

                    const theme = getPrefixColorTheme(safar)
                  const accent = 'var(--theme-accent, #6366f1)'
                  const cleanTitle = (() => {
                    if (isUnassigned) return 'Unassigned Videos'
                    if (hierarchy.safarName && hierarchy.safarName.includes(' - ')) {
                      const parts = hierarchy.safarName.split(' - ')
                      return parts.slice(1).join(' - ').trim() || hierarchy.safarName
                    }
                    return hierarchy.safarName || safar
                  })()

                  return (
                    <div className="stats-details-wrap anim-scale-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Back button */}
                      <div>
                        <button
                          type="button"
                          onClick={() => { setSelectedMonthDetail(null); setSelectedMonthCategory(null); }}
                          className="stats-action-btn"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                        >
                          ← Back to {cleanTitle} {isAllMonths ? 'Safars' : 'Months'}
                        </button>
                      </div>

                      <Card className="city-analytics-panel" style={{ flexDirection: 'column', padding: '24px', background: 'var(--surface)', border: '1.5px solid var(--border)' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-soft)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '28px' }}>📅</span>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                {hierarchy.safarSerial && (
                                  <span className="safar-serial-badge">#{hierarchy.safarSerial}</span>
                                )}
                                {hierarchy.safarYear && (
                                  <span className="safar-year-badge">{hierarchy.safarYear} H</span>
                                )}
                                {hierarchy.city && hierarchy.city !== 'Unassigned' && (
                                  <span className="safar-city-badge">📍 {hierarchy.city}</span>
                                )}
                              </div>
                              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {cleanTitle} — {monthNameLong} ({monthNameArabic})
                              </h3>
                              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                {selectedMonthCategory
                                  ? `Showing ${formatPrefixName(selectedMonthCategory)} videos rendered in ${monthName} (${selectedAnalyticsYear} H)`
                                  : `Showing category breakdown and videos for ${monthName} (${selectedAnalyticsYear} H)`
                                }
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedMonthCategory && (
                              <button
                                onClick={() => setSelectedMonthCategory(null)}
                                className="stats-action-btn"
                                style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                              >
                                Clear Filter
                              </button>
                            )}
                            <span style={{ fontSize: '13px', background: isUnassigned ? 'rgba(148, 163, 184, 0.12)' : theme.accentSoft, color: accent, padding: '5px 12px', borderRadius: '6px', fontWeight: 700 }}>
                              {selectedMonthCategory
                                ? `${filteredMonthVideos.length} / ${monthVideos.length} Video${monthVideos.length !== 1 ? 's' : ''}`
                                : `${monthVideos.length} Video${monthVideos.length !== 1 ? 's' : ''}`
                              }
                            </span>
                          </div>
                        </div>

                        {/* Dynamic Category Stats Cards (Grid or List View) */}
                        {monthDisplayedPrefixes.length > 0 && (
                          <div style={{ marginBottom: '24px' }}>
                            {statsViewMode === 'grid' ? (
                              <div className="month-cat-grid">
                                {monthDisplayedPrefixes.map((pfx) => {
                                  const count = monthCategoryCounts[pfx] || 0
                                  const label = formatPrefixName(pfx)
                                  const isSelected = selectedMonthCategory === pfx
                                  const pfxTheme = getPrefixColorTheme(pfx)

                                  return (
                                    <div
                                      key={pfx}
                                      className={`month-cat-card ${isSelected ? 'active' : ''}`}
                                      onClick={() => setSelectedMonthCategory(isSelected ? null : pfx)}
                                      style={{ borderLeftColor: pfxTheme.accent }}
                                    >
                                      <div className="month-cat-card-header">
                                        <span className="month-cat-title">{label}</span>
                                        <span className="month-cat-prefix" style={{ color: pfxTheme.accent }}>PREFIX: {pfx}</span>
                                      </div>
                                      <div className="month-cat-card-body">
                                        <span className="month-cat-count" style={{ color: pfxTheme.accent }}>{count}</span>
                                        <span className="month-cat-unit">VIDEOS</span>
                                      </div>
                                      <div className="month-cat-progress">
                                        <div
                                          className="month-cat-progress-bar"
                                          style={{ width: `${(count / maxMonthPrefixVolume) * 100}%`, background: pfxTheme.accent }}
                                        />
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="stats-list-container">
                                {monthDisplayedPrefixes.map((pfx) => {
                                  const count = monthCategoryCounts[pfx] || 0
                                  const label = formatPrefixName(pfx)
                                  const isSelected = selectedMonthCategory === pfx
                                  const pfxTheme = getPrefixColorTheme(pfx)

                                  return (
                                    <div
                                      key={pfx}
                                      className={`month-cat-list-row ${isSelected ? 'active' : ''}`}
                                      onClick={() => setSelectedMonthCategory(isSelected ? null : pfx)}
                                    >
                                      <div className="month-cat-list-info">
                                        <span className="month-cat-title">{label}</span>
                                        <span className="month-cat-prefix" style={{ color: pfxTheme.accent }}>PREFIX: {pfx}</span>
                                      </div>
                                      <div className="month-cat-list-stats">
                                        <span className="month-cat-count" style={{ color: pfxTheme.accent }}>{count}</span>
                                        <span className="month-cat-unit">VIDEOS</span>
                                      </div>
                                      <div className="month-cat-list-progress-wrap">
                                        <div className="month-cat-progress">
                                          <div
                                            className="month-cat-progress-bar"
                                            style={{ width: `${(count / maxMonthPrefixVolume) * 100}%`, background: pfxTheme.accent }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Videos Table */}
                        <div className="details-table-wrap">
                          <table className="details-table">
                            <thead>
                              <tr>
                                <th>Video Title</th>
                                <th>Prefix Category</th>
                                <th>Render Date & Time</th>
                                <th style={{ width: 120 }}>Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredMonthVideos.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="empty-row" style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    No videos processed for this category.
                                  </td>
                                </tr>
                              ) : (
                                filteredMonthVideos.map((v, index) => {
                                  const pfx = (v.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'
                                  const categoryName = formatPrefixName(pfx)
                                  const pfxTheme = getPrefixColorTheme(pfx)
                                  const recKey = `${v.name}_${v.date}_${v.prefix}`
                                  const isHighlighted = highlightedRecordKey === recKey
                                  return (
                                    <tr
                                      key={index}
                                      id={`record-${recKey}`}
                                      className={isHighlighted ? 'record-spotlight-highlight' : ''}
                                    >
                                      <td className="folder-name-cell" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                        🎥 {v.name}
                                      </td>
                                      <td className="breakdown-cell">
                                        <span className="pfx-mini-badge" title={categoryName} style={{ background: pfxTheme.accentSoft, borderColor: pfxTheme.accent, color: pfxTheme.accent }}>
                                          {pfx}: {categoryName}
                                        </span>
                                      </td>
                                      <td className="date-cell">
                                        <div className="date-stack">
                                          <span>{new Date(v.date).toLocaleDateString()}</span>
                                          <span className="hijri-sub" style={{ fontSize: '10px', opacity: 0.6 }}>
                                            {new Date(v.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="count-cell" style={{ fontWeight: 700, color: accent }}>
                                        ⏱ {formatDuration(v.duration || 0)}
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  )
                })()
              )}
            </>
          )}

          {/* ── REEDIT TAB ── */}
          {statsTab === 'reedit' && (
            <div className="stats-reedit-container anim-scale-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
              {/* Overview Summary Card */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <Card className="stat-card" style={{ '--card-accent': '#f59e0b', '--card-accent-soft': 'rgba(245, 158, 11, 0.1)' } as React.CSSProperties}>
                  <div className="sh-card-glow" style={{ background: '#f59e0b' }} />
                  <div className="stat-label">Total Re-edited</div>
                  <div className="stat-value-row">
                    <div className="stat-value"><AnimateNumber value={filteredReeditItems.length} /></div>
                    <div className="stat-unit">video{filteredReeditItems.length !== 1 ? 's' : ''}</div>
                  </div>
                </Card>
                <Card className="stat-card" style={{ '--card-accent': '#f59e0b', '--card-accent-soft': 'rgba(245, 158, 11, 0.1)' } as React.CSSProperties}>
                  <div className="sh-card-glow" style={{ background: '#f59e0b' }} />
                  <div className="stat-label">Total Re-edit Time</div>
                  <div className="stat-value-row">
                    <div className="stat-value">
                      <AnimateNumber 
                        value={filteredReeditItems.reduce((acc, r) => acc + (r.duration || 0), 0)} 
                        formatter={formatDuration} 
                      />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Main Re-edit Table */}
              <Card style={{ padding: '24px', flexDirection: 'column', background: 'var(--surface-2)' }}>
                <div className="sh-card-glow" style={{ background: '#f59e0b' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🔄 Re-edited Videos History
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Videos rendered using Single/Custom Render mode
                  </span>
                </div>

                <div className="details-table-wrap">
                  <table className="details-table">
                    <thead>
                      <tr>
                        <th>Video Title</th>
                        <th>Prefix Category</th>
                        <th>City</th>
                        <th>Folder</th>
                        <th>Re-edit Date & Time</th>
                        <th style={{ width: 120 }}>Duration</th>
                        <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReeditItems.map((v, index) => {
                        const pfx = (v.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'
                        const categoryName = PREFIX_NAMES[pfx] || pfx
                        return (
                          <tr key={index}>
                            <td className="folder-name-cell" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              🎥 {v.name}
                            </td>
                            <td className="breakdown-cell">
                              <span className="pfx-mini-badge" title={categoryName} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                                {pfx}: {categoryName}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              📍 {v.city || 'Unassigned'}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                              📁 {v.folder || 'Direct Render'}
                            </td>
                            <td className="date-cell">
                              <div className="date-stack">
                                <span>{new Date(v.date).toLocaleDateString()}</span>
                                <span className="hijri-sub" style={{ fontSize: '10px', opacity: 0.6 }}>
                                  {new Date(v.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </td>
                            <td className="count-cell" style={{ fontWeight: 700, color: '#f59e0b' }}>
                              ⏱ {formatDuration(v.duration || 0)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {v.filePath && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if ((window as any).api && (window as any).api.shell) {
                                      (window as any).api.shell.openFolder(v.filePath)
                                    }
                                  }}
                                  className="stats-action-btn"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    background: 'var(--surface-3)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: 'var(--text-primary)'
                                  }}
                                  title="Locate Video File"
                                >
                                  📂 Open
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── FOLDERS ACCORDION (Trigger Card for Full-Screen View) ── */}
      <div className="stats-details-wrap anim-scale-in" style={{ animationDelay: '200ms', marginTop: '16px' }}>
        <Card className="details-card collapsible-card collapsed">
          <div className="collapsible-header" onClick={() => setIsFoldersOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="details-title-group">
              <h3>
                <span className="folder-icon">📂</span> Source Folders
                <span className="folders-count-badge">{displayedFolders.totalCount} folders</span>
              </h3>
              <p>Folders contributing to the current view — click to view in full-screen</p>
            </div>
            <div className="details-header-right">
              <span className="collapse-arrow" style={{ transform: 'rotate(-90deg)' }}>▼</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── FULL SCREEN FOLDERS VIEW OVERLAY (Solid Modal) ── */}
      {isFoldersOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setIsFoldersOpen(false)}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '1200px',
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
            borderRadius: '20px'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-2)'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  📂 Source Folders Breakdown
                  <span className="folders-count-badge" style={{ fontSize: '12px', background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)', padding: '2px 8px', borderRadius: '10px' }}>
                    {displayedFolders.totalCount} folders
                  </span>
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Detailed view of all folders contributing to the current stats selection.
                </p>
              </div>
              
              <button 
                onClick={() => setIsFoldersOpen(false)}
                className="btn"
                style={{
                  padding: '8px 16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.7)'
                }}
              >
                ✕ Close View
              </button>
            </div>

            {/* Actions Bar */}
            <div className="details-actions-bar" style={{ padding: '16px 24px', background: 'var(--surface-3)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="group-control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>Group by:</span>
                <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)}>
                  <option value="none">No Grouping</option>
                  <option value="virtual">By Virtual Group</option>
                  <option value="prefix">By Prefix</option>
                  <option value="date">By Date</option>
                </select>
              </div>
              <div className="details-search" style={{ flex: 1, minWidth: '200px' }}>
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Search folders..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>


            {/* Scrollable Table Content */}
            <div className="details-table-wrap" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <table className="details-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Folder / Source</th>
                    <th>Videos</th>
                    <th>Breakdown</th>
                    <th>Safar / City</th>
                    <th>Date</th>
                    <th style={{ width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedFolders.totalCount === 0 ? (
                    <tr><td colSpan={6} className="empty-row">{searchTerm ? 'No folders match your search.' : 'No folders for this period.'}</td></tr>
                  ) : (
                    Object.entries(displayedFolders.list).map(([groupName, folders]) => (
                      <React.Fragment key={groupName}>
                        {groupBy !== 'none' && (
                          <tr className="group-header-row"><td colSpan={6}>{groupName}</td></tr>
                        )}
                        {folders.map((f, idx) => {
                          const folderSafar = (() => {
                            const override = folderSafars[f.folder]
                            if (override && override !== 'Unassigned') return override
                            const info = parseSafarHierarchy(f.folder)
                            if (info.safar && info.safar !== 'Unassigned') return info.safar
                            return 'Unassigned'
                          })()
                          const folderCity = (() => {
                            const override = folderCities[f.folder]
                            if (override && override !== 'Unassigned') return override
                            const info = parseFolderName(f.folder)
                            if (info.city) return info.city
                            return detectCity('', f.folder)
                          })()
                          return (
                            <tr key={idx}>
                              <td className="folder-name-cell">
                                <span className="folder-icon">📂</span>
                                {editingFolder === f.folder ? (
                                  <input
                                    className="folder-edit-input"
                                    value={editFolderNameValue}
                                    onChange={e => setEditFolderNameValue(e.target.value)}
                                    onBlur={() => handleRenameFolder(f.folder, editFolderNameValue)}
                                    onKeyDown={e => e.key === 'Enter' && handleRenameFolder(f.folder, editFolderNameValue)}
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (
                                  <span className="folder-name-text" title={f.folder} onClick={e => { e.stopPropagation(); setEditingFolder(f.folder); setEditFolderNameValue(f.folder) }}>
                                    {f.folder}
                                  </span>
                                )}
                              </td>
                              <td className="count-cell">{f.count}</td>
                              <td className="breakdown-cell">
                                {Object.entries(f.breakdown).map(([pfx, count]) => (
                                  <span key={pfx} className="pfx-mini-badge" title={PREFIX_NAMES[pfx] || pfx}>{pfx}: {count}</span>
                                ))}
                              </td>
                              <td className="city-cell">
                                <span className="pfx-badge" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)', color: '#10b981' }}>
                                  {folderSafar !== 'Unassigned' ? `🏕️ ${folderSafar}` : (folderCity !== 'Unassigned' ? `🌆 ${folderCity}` : '🌍 Unassigned')}
                                </span>
                              </td>
                              <td className="date-cell">
                                <div className="date-stack">
                                  <span>{new Date(f.firstDate).toLocaleDateString()}</span>
                                  <span className="hijri-sub">{toMisriHijri(f.firstDate)}</span>
                                </div>
                              </td>
                              <td className="actions-cell" onClick={e => e.stopPropagation()}>
                                <button className="row-action-btn edit" onClick={() => { setEditingFolder(f.folder); setEditFolderNameValue(f.folder) }} title="Rename">✏️</button>

                                <div className="group-move-wrap">
                                  <button className="row-action-btn move" title="Move to Group">📁</button>
                                  <div className="group-move-menu">
                                    <div className="menu-header">Move to Group</div>
                                    <div className="menu-items">
                                      <button onClick={() => handleMoveToGroup(f.folder, '')}>Un-grouped</button>
                                      {Array.from(new Set(Object.values(folderGroups))).filter(g => g).map(g => (
                                        <button key={g} onClick={() => handleMoveToGroup(f.folder, g)}>{g}</button>
                                      ))}
                                      <div className="menu-divider" />
                                      <button onClick={() => { const n = window.prompt('New group name:'); if (n) handleMoveToGroup(f.folder, n) }}>+ New Group…</button>
                                    </div>
                                  </div>
                                </div>

                                <div className="group-move-wrap">
                                  <button className="row-action-btn move" title="Assign Safar" style={{ background: 'rgba(16,185,129,0.05)', color: '#10b981', borderColor: 'rgba(16,185,129,0.1)' }}>🏕️</button>
                                  <div className="group-move-menu">
                                    <div className="menu-header">Assign Safar</div>
                                    <div className="menu-items">
                                      <button onClick={() => { const next = { ...folderSafars }; delete next[f.folder]; setFolderSafars(next); showToast({ title: 'Safar Reset', message: 'Using auto-detect', type: 'info' }) }}>Auto Detect</button>
                                      {uniqueSafarsList.map(s => (
                                        <button key={s} onClick={() => { setFolderSafars(prev => ({ ...prev, [f.folder]: s })); showToast({ title: 'Safar Set', message: `→ ${s}`, type: 'success' }) }}>{s}</button>
                                      ))}
                                      <div className="menu-divider" />
                                      <button onClick={() => { const n = window.prompt('New Safar name (e.g. 1447-08 Mumbai - Urs Mubarak):'); if (n) { setFolderSafars(prev => ({ ...prev, [f.folder]: n.trim() })); showToast({ title: 'Safar Set', message: `→ ${n.trim()}`, type: 'success' }) } }}>+ New Safar…</button>
                                    </div>
                                  </div>
                                </div>

                                <div className="group-move-wrap">
                                  <button className="row-action-btn move" title="Assign City" style={{ background: 'rgba(139,92,246,0.05)', color: 'var(--accent-folder)', borderColor: 'rgba(139,92,246,0.1)' }}>🌆</button>
                                  <div className="group-move-menu">
                                    <div className="menu-header">Assign City</div>
                                    <div className="menu-items">
                                      <button onClick={() => { const next = { ...folderCities }; delete next[f.folder]; setFolderCities(next); showToast({ title: 'City Reset', message: 'Using auto-detect', type: 'info' }) }}>Auto Detect</button>
                                      {uniqueCitiesList.map(c => (
                                        <button key={c} onClick={() => { setFolderCities(prev => ({ ...prev, [f.folder]: c })); showToast({ title: 'City Set', message: `→ ${c}`, type: 'success' }) }}>{c}</button>
                                      ))}
                                      <div className="menu-divider" />
                                      <button onClick={() => { const n = window.prompt('New city name:'); if (n) { const cap = n.trim().charAt(0).toUpperCase() + n.trim().slice(1); setFolderCities(prev => ({ ...prev, [f.folder]: cap })); showToast({ title: 'City Set', message: `→ ${cap}`, type: 'success' }) } }}>+ New City…</button>
                                    </div>
                                  </div>
                                </div>

                                <button className="row-action-btn delete" onClick={() => handleDeleteFolder(f.folder)} title="Remove from Stats">🗑️</button>
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ── SAFAR CONTEXT MENU ── */}
      {safarContextMenu && safarContextMenu.visible && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
            onClick={() => setSafarContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setSafarContextMenu(null) }}
          />
          <div
            className="safar-context-menu"
            style={{
              left: Math.min(safarContextMenu.x, window.innerWidth - 250),
              top: Math.min(safarContextMenu.y, window.innerHeight - 220)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              🏕️ {safarContextMenu.safar}
            </div>

            {safarContextMenu.safar !== 'Unassigned' && (
              <button
                type="button"
                className="safar-context-item"
                onClick={() => openRenameModal(safarContextMenu.safar)}
              >
                ✏️ Rename Safar Block
              </button>
            )}

            <button
              type="button"
              className="safar-context-item"
              onClick={() => handleOpenSafarFolder(safarContextMenu.safar)}
            >
              📂 Open Folder in Explorer
            </button>

            <button
              type="button"
              className="safar-context-item"
              onClick={() => handleCopySafarSummary(safarContextMenu.safar)}
            >
              📋 Copy Formatted Summary
            </button>

            <div className="safar-context-divider" />

            {safarContextMenu.safar !== 'Unassigned' ? (
              <button
                type="button"
                className="safar-context-item danger"
                onClick={() => openDeleteModal(safarContextMenu.safar)}
              >
                🗑️ Delete Safar Block
              </button>
            ) : (
              <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <em>Default unassigned group</em>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── SAFAR DELETE CONFIRMATION MODAL ── */}
      {safarDeleteModal && safarDeleteModal.isOpen && (
        <div className="safar-modal-overlay" onClick={() => setSafarDeleteModal(null)}>
          <div className="safar-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="safar-modal-header">
              <div className="safar-modal-icon">⚠️</div>
              <div>
                <h3 className="safar-modal-title">Delete Safar Block</h3>
                <p className="safar-modal-subtitle">Choose how to delete "{safarDeleteModal.safar}"</p>
              </div>
            </div>

            <div className="safar-modal-warning-box">
              <strong>{safarDeleteModal.safar}</strong> ({safarDeleteModal.count} video records)
              <br /><br />
              How would you like to delete this block?
              <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: '12px', lineHeight: '1.6' }}>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Move to Unassigned:</strong> Removes this Safar block from "By Safar". The {safarDeleteModal.count} videos remain in statistics under the "Unassigned" block so overall counts stay 100% intact.
                </li>
                <li>
                  <strong>Delete All Records:</strong> Permanently deletes this Safar block AND wipes out all {safarDeleteModal.count} video records from statistics and database.
                </li>
              </ul>
            </div>

            <div className="safar-modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="safar-modal-btn cancel"
                onClick={() => setSafarDeleteModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="safar-modal-btn"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}
                onClick={handleConfirmReassignDeleteSafar}
                title="Remove Safar block and move records to Unassigned"
              >
                📦 Move to Unassigned
              </button>
              <button
                type="button"
                className="safar-modal-btn danger"
                onClick={handleConfirmDeleteSafarPermanently}
                title="Permanently delete this Safar block and all its video records"
              >
                🗑️ Delete All Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BATCH SAFAR DELETE / UNASSIGN MODAL ── */}
      {batchDeleteModalOpen && selectedSafarBlocks.length > 0 && (
        <div className="safar-modal-overlay" onClick={() => setBatchDeleteModalOpen(false)}>
          <div className="safar-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="safar-modal-header">
              <div className="safar-modal-icon">⚠️</div>
              <div>
                <h3 className="safar-modal-title">Delete or Unassign {selectedSafarBlocks.length} Safar Blocks</h3>
                <p className="safar-modal-subtitle">Choose action for {selectedSafarBlocks.length} selected Safar blocks</p>
              </div>
            </div>

            <div className="safar-modal-warning-box">
              <div style={{ marginBottom: '8px' }}>
                <strong>Selected Safar Blocks ({selectedSafarBlocks.length}):</strong>
                <div style={{ maxHeight: '90px', overflowY: 'auto', marginTop: '6px', fontSize: '11.5px', background: 'rgba(0, 0, 0, 0.2)', padding: '6px 10px', borderRadius: '6px', lineHeight: '1.5' }}>
                  {selectedSafarBlocks.join(', ')}
                </div>
              </div>
              <div style={{ fontSize: '12.5px', marginTop: '6px' }}>
                Total videos across selected blocks: <strong>{batchSelectedRecordCount} records</strong>
              </div>
              <br />
              How would you like to handle these {selectedSafarBlocks.length} Safar blocks?
              <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: '12px', lineHeight: '1.6' }}>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Move to Unassigned:</strong> Removes these Safar blocks from "By Safar". The {batchSelectedRecordCount} videos remain in statistics under the "Unassigned" block so overall counts stay 100% intact.
                </li>
                <li>
                  <strong>Delete All Records:</strong> Permanently deletes these Safar blocks AND wipes out all {batchSelectedRecordCount} video records from statistics and database.
                </li>
              </ul>
            </div>

            <div className="safar-modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="safar-modal-btn cancel"
                onClick={() => setBatchDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="safar-modal-btn"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}
                onClick={handleConfirmBatchMoveToUnassigned}
                title="Move all records from selected Safar blocks to Unassigned"
              >
                📦 Move All to Unassigned
              </button>
              <button
                type="button"
                className="safar-modal-btn danger"
                onClick={handleConfirmBatchDeletePermanently}
                title="Permanently delete selected Safar blocks and all their records"
              >
                🗑️ Delete All Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SAFAR RENAME MODAL ── */}
      {safarRenameModal && safarRenameModal.isOpen && (
        <div className="safar-modal-overlay" onClick={() => setSafarRenameModal(null)}>
          <div className="safar-modal-card rename-modal" onClick={e => e.stopPropagation()}>
            <div className="safar-modal-header">
              <div className="safar-modal-icon rename-icon">
                ✏️
              </div>
              <div>
                <h3 className="safar-modal-title">Rename Safar Block</h3>
                <p className="safar-modal-subtitle">Update Safar title, serial number, year, and city</p>
              </div>
            </div>

            <div className="safar-rename-fields">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => setSafarRenameModal({ ...safarRenameModal, useDirectTag: true })}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: safarRenameModal.useDirectTag ? 'var(--theme-accent, #6366f1)' : 'var(--surface-3)',
                    color: safarRenameModal.useDirectTag ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  ✏️ Direct Custom Name
                </button>
                <button
                  type="button"
                  onClick={() => setSafarRenameModal({ ...safarRenameModal, useDirectTag: false })}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: !safarRenameModal.useDirectTag ? 'var(--theme-accent, #6366f1)' : 'var(--surface-3)',
                    color: !safarRenameModal.useDirectTag ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  ⚡ Structured (Year/Serial/City)
                </button>
              </div>

              {safarRenameModal.useDirectTag ? (
                <div className="safar-modal-field">
                  <label className="safar-modal-label">Safar Full Title / Tag</label>
                  <input
                    type="text"
                    className="safar-modal-input"
                    placeholder="e.g. 1448-02 Raipur"
                    value={safarRenameModal.customTag}
                    onChange={e => setSafarRenameModal({ ...safarRenameModal, customTag: e.target.value })}
                  />
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Type the exact name you want to assign to this Safar block across all records.
                  </p>
                </div>
              ) : (
                <>
                  <div className="safar-modal-row">
                    <div className="safar-modal-field" style={{ flex: 1 }}>
                      <label className="safar-modal-label">Hijri Year</label>
                      <input
                        type="number"
                        className="safar-modal-input"
                        placeholder="e.g. 1447"
                        value={safarRenameModal.year}
                        onChange={e => setSafarRenameModal({ ...safarRenameModal, year: e.target.value })}
                      />
                    </div>
                    <div className="safar-modal-field" style={{ flex: 1 }}>
                      <label className="safar-modal-label">Serial Number (#)</label>
                      <input
                        type="text"
                        className="safar-modal-input"
                        placeholder="e.g. 08"
                        value={safarRenameModal.serial}
                        onChange={e => setSafarRenameModal({ ...safarRenameModal, serial: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="safar-modal-field">
                    <label className="safar-modal-label">City</label>
                    <input
                      type="text"
                      className="safar-modal-input"
                      placeholder="e.g. Mumbai"
                      value={safarRenameModal.city}
                      onChange={e => setSafarRenameModal({ ...safarRenameModal, city: e.target.value })}
                    />
                  </div>

                  <div className="safar-modal-field">
                    <label className="safar-modal-label">Safar Name / Occasion</label>
                    <input
                      type="text"
                      className="safar-modal-input"
                      placeholder="e.g. Urs Mubarak Syedna Mohammed Burhanuddin RA"
                      value={safarRenameModal.name}
                      onChange={e => setSafarRenameModal({ ...safarRenameModal, name: e.target.value })}
                    />
                  </div>

                  {/* Tag Preview */}
                  <div className="safar-tag-preview-box">
                    <span className="safar-tag-preview-label">Resulting Tag Preview:</span>
                    <div className="safar-tag-preview-val">
                      🏕️ {(() => {
                        const prefixParts: string[] = []
                        if (safarRenameModal.year.trim()) prefixParts.push(safarRenameModal.year.trim())
                        if (safarRenameModal.serial.trim()) prefixParts.push(safarRenameModal.serial.trim().padStart(2, '0'))
                        let res = prefixParts.join('-')
                        if (res) res += ' '
                        if (safarRenameModal.city.trim()) res += safarRenameModal.city.trim() + ' - '
                        res += safarRenameModal.name.trim() || 'Untitled Safar'
                        return res
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="safar-modal-actions">
              <button
                type="button"
                className="safar-modal-btn cancel"
                onClick={() => setSafarRenameModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="safar-modal-btn primary"
                onClick={handleConfirmRenameSafar}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HIDDEN SYNC OLD DATA MODAL (Triggered via Ctrl+Shift+O or triple-click on Stats) ── */}
      {showSyncOldDataModal && (
        <div className="safar-modal-backdrop animate-fade-in" onClick={() => !isSyncing && setShowSyncOldDataModal(false)}>
          <div className="safar-modal-card sync-old-data-modal anim-scale-in" onClick={e => e.stopPropagation()}>
            <div className="safar-modal-header">
              <div className="safar-modal-title-group">
                <span className="safar-modal-badge">⚡ Hidden Utility</span>
                <h3 className="safar-modal-title">Locate &amp; Sync Old Stats</h3>
              </div>
              <button
                type="button"
                className="safar-modal-close"
                disabled={isSyncing}
                onClick={() => setShowSyncOldDataModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="safar-modal-body">
              <p className="sync-modal-description">
                Select your Safar folder (e.g. <code>E:\In Process\1448-10-Istefada ilmiyah</code> or container <code>E:\In Process</code>).
                The scanner extracts the Safar name, serial, year, and groups all videos by their exact Hijri month, date, and session slot (e.g. <code>1448-04-18 _01M</code>), reads video durations in seconds, and adds them to your Stats database.
              </p>

              {/* Primary: Single Safar Folder Input */}
              <div className="safar-modal-field">
                <label className="safar-modal-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  📁 Main Safar Folder or Container
                </label>
                <div className="sync-folder-input-row">
                  <input
                    type="text"
                    className="safar-modal-input"
                    placeholder="e.g. E:\In Process\1448-10-Istefada ilmiyah or E:\In Process"
                    value={syncSafarDir}
                    onChange={e => {
                      const val = e.target.value
                      setSyncSafarDir(val)
                      if (val.trim()) {
                        const parsed = parseSafarHierarchy(val)
                        setDetectedSafarPreview({
                          safarName: parsed.safarName !== 'Unassigned' ? parsed.safarName : (parsed.safar || val.split(/[\\/]/).pop()),
                          serial: parsed.safarSerial,
                          year: parsed.safarYear,
                          city: parsed.city
                        })
                      } else {
                        setDetectedSafarPreview(null)
                      }
                    }}
                    disabled={isSyncing}
                  />
                  <button
                    type="button"
                    className="sync-browse-btn"
                    onClick={handleBrowseSyncSafarDir}
                    disabled={isSyncing}
                    title="Choose folder in File Explorer"
                  >
                    📂 Browse...
                  </button>
                </div>
              </div>

              {/* Detected Safar Metadata Preview Pill */}
              {detectedSafarPreview && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  marginBottom: '16px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontWeight: 600, color: '#818cf8' }}>⚡ Detected Safar:</span>
                  <span>🏕️ <strong>{detectedSafarPreview.safarName}</strong></span>
                  {detectedSafarPreview.serial && <span>🔢 Serial: <strong>{detectedSafarPreview.serial}</strong></span>}
                  {detectedSafarPreview.year && <span>📅 Year: <strong>{detectedSafarPreview.year}</strong></span>}
                  {detectedSafarPreview.city && <span>📍 City: <strong>{detectedSafarPreview.city}</strong></span>}
                </div>
              )}

              {/* Accordion / Alternative Mode: Legacy Separate Folders */}
              <details style={{ marginTop: '4px', marginBottom: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <summary style={{ cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
                  ⚙️ Advanced: Specify Separate Main &amp; Final Directories
                </summary>
                <div style={{ marginTop: '10px', padding: '12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div className="safar-modal-field" style={{ marginBottom: '10px' }}>
                    <label className="safar-modal-label">Main Directory (skips 'Final')</label>
                    <div className="sync-folder-input-row">
                      <input
                        type="text"
                        className="safar-modal-input"
                        placeholder="e.g. E:\In Process\1448-10-Istefada ilmiyah"
                        value={syncMainDir}
                        onChange={e => setSyncMainDir(e.target.value)}
                        disabled={isSyncing}
                      />
                      <button type="button" className="sync-browse-btn" onClick={handleBrowseSyncMainDir} disabled={isSyncing}>
                        📁 Browse
                      </button>
                    </div>
                  </div>
                  <div className="safar-modal-field">
                    <label className="safar-modal-label">Final Directory (Rendered Videos)</label>
                    <div className="sync-folder-input-row">
                      <input
                        type="text"
                        className="safar-modal-input"
                        placeholder="e.g. E:\In Process\1448-10-Istefada ilmiyah\Final"
                        value={syncFinalDir}
                        onChange={e => setSyncFinalDir(e.target.value)}
                        disabled={isSyncing}
                      />
                      <button type="button" className="sync-browse-btn" onClick={handleBrowseSyncFinalDir} disabled={isSyncing}>
                        📁 Browse
                      </button>
                    </div>
                  </div>
                </div>
              </details>

              <div className="sync-modal-notice">
                <span className="sync-modal-notice-icon">🛡️</span>
                <div className="sync-modal-notice-text">
                  <strong>Safe &amp; Read-Only:</strong> Videos in <code>Final</code> are read for durations using fast binary atom parsing. Zero files are created or modified on external drives.
                </div>
              </div>

              {/* Progress & Result Box */}
              {isSyncing && (
                <div className="sync-status-box syncing">
                  <span className="sync-spinner">⏳</span>
                  <span>{syncProgressMsg}</span>
                </div>
              )}

              {syncResult && (
                <div className={`sync-status-box ${syncResult.error ? 'error' : 'success'}`}>
                  {syncResult.error ? (
                    <div>
                      <strong>⚠️ Sync Failed:</strong> {syncResult.error}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                        ✅ Scan &amp; Import Complete!
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.9 }}>
                        Scanned: <strong>{syncResult.totalScanned}</strong> | Inserted: <strong>{syncResult.inserted}</strong> record(s)
                      </div>
                      {syncResult.safars && syncResult.safars.length > 0 && (
                        <div style={{ marginTop: '6px', fontSize: '11px', maxHeight: '60px', overflowY: 'auto' }}>
                          <strong>Safars:</strong> {syncResult.safars.join(', ')}
                        </div>
                      )}
                      <button
                        type="button"
                        className="safar-modal-btn primary"
                        style={{ marginTop: '12px', width: '100%', padding: '9px 14px', fontSize: '12px', fontWeight: 700 }}
                        onClick={() => setShowSyncOldDataModal(false)}
                      >
                        👀 View Imported Safar in Stats Now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="safar-modal-actions">
              <button
                type="button"
                className="safar-modal-btn cancel"
                onClick={() => setShowSyncOldDataModal(false)}
                disabled={isSyncing}
              >
                Close
              </button>
              <button
                type="button"
                className="safar-modal-btn primary sync-run-btn"
                onClick={handleRunSyncOldData}
                disabled={isSyncing || (!syncSafarDir.trim() && (!syncMainDir.trim() || !syncFinalDir.trim()))}
              >
                {isSyncing ? 'Analyzing...' : '🚀 Start Analysis & Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GLOBAL SPOTLIGHT SEARCH MODAL (Ctrl + F) ── */}
      {isSpotlightOpen && (
        <div
          className="spotlight-backdrop animate-fade-in"
          onClick={() => setIsSpotlightOpen(false)}
        >
          <div
            className="spotlight-modal anim-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Search Header */}
            <div className="spotlight-header">
              <span className="spotlight-search-icon">🔍</span>
              <input
                ref={spotlightInputRef}
                type="text"
                className="spotlight-input"
                placeholder="Search videos, Safar, date (1448-03-14), session (01M), event code (AQ)..."
                value={spotlightQuery}
                onChange={e => {
                  setSpotlightQuery(e.target.value)
                  setSpotlightSelectedIndex(0)
                }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSpotlightSelectedIndex(prev =>
                      spotlightResults.length > 0 ? (prev + 1) % spotlightResults.length : 0
                    )
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSpotlightSelectedIndex(prev =>
                      spotlightResults.length > 0 ? (prev - 1 + spotlightResults.length) % spotlightResults.length : 0
                    )
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (spotlightResults[spotlightSelectedIndex]) {
                      handleSelectSpotlightRecord(spotlightResults[spotlightSelectedIndex])
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setIsSpotlightOpen(false)
                  }
                }}
              />
              {spotlightQuery && (
                <button
                  type="button"
                  className="spotlight-clear-btn"
                  onClick={() => {
                    setSpotlightQuery('')
                    setSpotlightSelectedIndex(0)
                    spotlightInputRef.current?.focus()
                  }}
                >
                  ✕
                </button>
              )}
              <div className="spotlight-kbd-badge">
                <kbd>ESC</kbd> to close
              </div>
            </div>

            {/* Quick Filter Suggestion Chips */}
            <div className="spotlight-quick-filters">
              <span className="spotlight-quick-label">Quick Filters:</span>
              {['01M', '02E', 'AQ', 'N', 'MZ', 'Q', 'M', 'Z', 'BQ', 'BM', 'BZ', 'TNQ', 'H', 'WAAZ', 'ID', 'OD'].map(chip => (
                <button
                  key={chip}
                  type="button"
                  className={`spotlight-chip ${spotlightQuery.toLowerCase().includes(chip.toLowerCase()) ? 'active' : ''}`}
                  onClick={() => {
                    setSpotlightQuery(prev => (prev ? `${prev} ${chip}` : chip))
                    setSpotlightSelectedIndex(0)
                    spotlightInputRef.current?.focus()
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="spotlight-results-container">
              {spotlightResults.length === 0 ? (
                <div className="spotlight-empty-state">
                  <span className="spotlight-empty-icon">🔍</span>
                  <div className="spotlight-empty-title">No matching records found</div>
                  <div className="spotlight-empty-subtitle">
                    Try searching by video title, date (e.g. <code>1448-03-14</code>), session (<code>01M</code>), event code (<code>AQ</code>), or Safar name.
                  </div>
                </div>
              ) : (
                <div className="spotlight-results-list">
                  <div className="spotlight-section-label">
                    {spotlightQuery.trim()
                      ? `Found ${spotlightResults.length} Matching Video${spotlightResults.length !== 1 ? 's' : ''}`
                      : 'Recent Videos & Quick Matches'}
                  </div>
                  {spotlightResults.map((rec, idx) => {
                    const pfx = (rec.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'
                    const pfxTheme = getPrefixColorTheme(pfx)
                    const categoryName = formatPrefixName(pfx)
                    const safarTag = resolveSafar(rec, folderSafars)
                    const isSelected = idx === spotlightSelectedIndex

                    return (
                      <div
                        key={`${rec.name}_${rec.date}_${idx}`}
                        className={`spotlight-result-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectSpotlightRecord(rec)}
                        onMouseEnter={() => setSpotlightSelectedIndex(idx)}
                      >
                        <div className="spotlight-item-left">
                          <span
                            className="spotlight-item-pfx-badge"
                            style={{
                              background: pfxTheme.accentSoft,
                              borderColor: pfxTheme.accent,
                              color: pfxTheme.accent
                            }}
                            title={categoryName}
                          >
                            {pfx}
                          </span>
                          <div className="spotlight-item-info">
                            <div className="spotlight-item-name">
                              🎥 {rec.name}
                            </div>
                            <div className="spotlight-item-tags">
                              {safarTag && safarTag !== 'Unassigned' && (
                                <span className="spotlight-tag safar">
                                  🏕️ {safarTag}
                                </span>
                              )}
                              {rec.session && (
                                <span className="spotlight-tag session">
                                  🕒 {rec.session}
                                </span>
                              )}
                              <span className="spotlight-tag date">
                                📅 {toMisriHijri(rec.date)}
                              </span>
                              {rec.duration ? (
                                <span className="spotlight-tag duration">
                                  ⏱ {formatDuration(rec.duration)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="spotlight-item-right">
                          {rec.filePath && (
                            <button
                              type="button"
                              className="spotlight-reveal-btn"
                              title="Reveal file in Explorer"
                              onClick={e => {
                                e.stopPropagation()
                                if (api?.shell?.openFolder) {
                                  api.shell.openFolder(rec.filePath)
                                }
                              }}
                            >
                              📂 Open
                            </button>
                          )}
                          <span className="spotlight-jump-hint">
                            ↵ Jump
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="spotlight-footer">
              <div className="spotlight-footer-keys">
                <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
                <span><kbd>↵</kbd> Select &amp; View</span>
                <span><kbd>ESC</kbd> Close</span>
              </div>
              <span className="spotlight-footer-total">
                {records.length} total database records
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

