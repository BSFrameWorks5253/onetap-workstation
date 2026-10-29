import React, { useState, useEffect, useRef, Suspense } from 'react'
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import { SoundProvider, useSound } from './components/SoundProvider'
import WelcomeScreen from './components/WelcomeScreen'
import AdobeSplashScreen from './components/AdobeSplashScreen'
import RadialRefreshLoader from './components/RadialRefreshLoader'
import SetupWizard from './components/SetupWizard'
import Sidebar from './components/Sidebar'
import Toolbar from './components/Toolbar'
import PageLoader from './components/PageLoader'
import TrayDock from './components/TrayDock'
import FileViewer from './components/FileViewer/FileViewer'
import CommandPalette from './components/CommandPalette'
import EmailBroadcastModal from './components/EmailBroadcast/EmailBroadcastModal'
import GlobalDropOverlay from './components/GlobalDropOverlay'
import { AutoUpdateModal } from './components/AutoUpdateModal'
import DynamicIsland from './components/DynamicIsland/DynamicIsland'
import WorkstationErrorBoundary from './components/ErrorBoundary/WorkstationErrorBoundary'
import type { PageKey } from './types'
import './styles/global.css'
import './styles/animations.css'
import zenLogo from './assets/zen_final_nobg.png'

import { ToastProvider, useToast } from './components/Toast'
import { CursorProvider } from './cursor'
import { parseFolderName, detectCity } from './utils/cityUtils'
import { parseSafarHierarchy } from './utils/safarUtils'
import { prprojStore } from './stores/prprojStore'

// Truly code-split pages — evaluated on-demand upon first navigation
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'))
const TitleAdder = React.lazy(() => import('./pages/TitleAdder/TitleAdder'))
const Converter = React.lazy(() => import('./pages/Converter/Converter'))
const DriveSync = React.lazy(() => import('./pages/DriveSync/DriveSync'))
const FolderMaker = React.lazy(() => import('./pages/FolderMaker/FolderMaker'))
const Settings = React.lazy(() => import('./pages/Settings/Settings'))
const Stats = React.lazy(() => import('./pages/Stats/Stats'))
const StickyNotes = React.lazy(() => import('./pages/StickyNotes/StickyNotes'))
const CloudPortal = React.lazy(() => import('./pages/CloudPortal/CloudPortal'))
const GDrivePortal = React.lazy(() => import('./pages/GDrivePortal/GDrivePortal'))
const Utilities = React.lazy(() => import('./pages/Utilities/Utilities'))
const CameraTransfer = React.lazy(() => import('./pages/CameraTransfer/CameraTransfer'))
const PrprojGenerator = React.lazy(() => import('./pages/PrprojGenerator/PrprojGenerator'))
const VideoTransfer = React.lazy(() => import('./pages/VideoTransfer/VideoTransfer'))
const Cleaner = React.lazy(() => import('./pages/Cleaner/Cleaner'))
const PVSeparator = React.lazy(() => import('./pages/PVSeparator/PVSeparator'))
const InventoryMerger = React.lazy(() => import('./pages/InventoryMerger/InventoryMerger'))
const TaskTracker = React.lazy(() => import('./pages/TaskTracker/TaskTracker'))
const ArchiveVault = React.lazy(() => import('./pages/ArchiveVault/ArchiveVault'))

const PAGE_COMPONENTS: Record<PageKey, React.LazyExoticComponent<() => JSX.Element>> = {
  dashboard: Dashboard as any,
  archivevault: ArchiveVault as any,
  tracker: TaskTracker as any,
  adder: TitleAdder as any,
  converter: Converter as any,
  drivesync: DriveSync as any,
  folder: FolderMaker as any,
  stats: Stats as any,
  notes: StickyNotes as any,
  cloud: CloudPortal as any,
  gdrive: GDrivePortal as any,
  settings: Settings as any,
  utilities: Utilities as any,
  cameratransfer: CameraTransfer as any,
  prproj: PrprojGenerator as any,
  videotransfer: VideoTransfer as any,
  pvseparator: PVSeparator as any,
  cleaner: Cleaner as any,
  excelmerger: InventoryMerger as any,
  admin: (() => (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <EmailBroadcastModal
        isOpen={true}
        onClose={() => {
          if (typeof (window as any).showPage === 'function') {
            (window as any).showPage('adder')
          }
        }}
      />
    </div>
  )) as any
}

function AppInner(): JSX.Element {
  if (window.location.hash.includes('dynamic-island')) {
    return <DynamicIsland />
  }

  const { pageTransition, textOverrides, orderedNav, theme } = useTheme()
  const { showToast } = useToast()
  const { playSuccess } = useSound()
  const [appVersion, setAppVersion] = useState<string>('26.10.12')

  // Detect if this session previously showed the splash, or if the page was refreshed (F5 / Ctrl+R)
  const isReload = useRef((() => {
    try {
      const navEntries = performance.getEntriesByType('navigation')
      if (navEntries.length > 0 && (navEntries[0] as PerformanceNavigationTiming).type === 'reload') {
        return true
      }
    } catch {}
    return sessionStorage.getItem('ot_boot_splash_shown') === 'true'
  })()).current

  const [showSplash, setShowSplash] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'splash') return true
    // On refresh, do not show the heavy rectangular splash!
    if (isReload) return false
    const bootSplash = sessionStorage.getItem('ot_boot_splash_shown')
    return !bootSplash
  })

  // Dedicated radial loader for in-app refresh
  const [isRefreshing, setIsRefreshing] = useState<boolean>(() => {
    return isReload
  })

  const [showWelcome, setShowWelcome] = useState<boolean>(false)
  const [setupDone, setSetupDone] = useState<boolean>(true)

  // Dynamic application zoom state (supports standard browser Ctrl +, Ctrl -, Ctrl 0)
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem('ot_zoom_level')
    return saved ? parseFloat(saved) : 1.0
  })

  // Apply zoom factor to document body ONLY when welcome screen is not actively mounted
  useEffect(() => {
    if (showWelcome) {
      (document.body.style as any).zoom = '1'
      return
    }
    (document.body.style as any).zoom = String(zoomLevel)
    localStorage.setItem('ot_zoom_level', String(zoomLevel))
  }, [zoomLevel, showWelcome])

  // Register main process zoom event listeners
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.zoom) return

    const unsubIn = api.zoom.onZoomIn(() => {
      setZoomLevel(prev => Math.min(prev + 0.1, 2.0))
    })

    const unsubOut = api.zoom.onZoomOut(() => {
      setZoomLevel(prev => Math.max(prev - 0.1, 0.5))
    })

    const unsubReset = api.zoom.onZoomReset(() => {
      setZoomLevel(1.0)
    })

    return () => {
      if (typeof unsubIn === 'function') unsubIn()
      if (typeof unsubOut === 'function') unsubOut()
      if (typeof unsubReset === 'function') unsubReset()
    }
  }, [])

  // Listen for auto-converted files from the folder watcher
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.watcher) return

    const unsub = api.watcher.onConverted((info: { filePath: string; fileName: string }) => {
      // Play confirmation short tune for auto background conversion
      try {
        playSuccess()
      } catch (err) {
        console.warn('Could not play conversion tune:', err)
      }

      showToast({
        title: 'Auto-Converted PNG → JPEG',
        message: `Converted & saved ${info.fileName} successfully.`,
        type: 'success',
        action: {
          label: 'Open Folder',
          onClick: () => {
            if (api.shell) {
              api.shell.openFolder(info.filePath)
            }
          }
        }
      })
    })

    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [showToast, playSuccess])



  const [systemError, setSystemError] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<PageKey>('adder')

  // Listen for batch source from Premiere Pro extension and auto-switch to Title Adder page
  useEffect(() => {
    const api = (window as any).api
    if (!api) return

    const unsubs: Array<(() => void) | undefined> = []

    if (api.titleAdder?.onSetBatchSource) {
      unsubs.push(api.titleAdder.onSetBatchSource(() => {
        setActivePage('adder')
      }))
    }

    if (api.titleAutomode?.onTriggered) {
      unsubs.push(api.titleAutomode.onTriggered(() => {
        setActivePage('adder')
      }))
    }

    if (api.titleAutomode?.onAmeRenderComplete) {
      unsubs.push(api.titleAutomode.onAmeRenderComplete(() => {
        setActivePage('adder')
      }))
    }

    if (api.titleAutomode?.onNavigate) {
      unsubs.push(api.titleAutomode.onNavigate((p: string) => {
        if (p === 'title-adder' || p === 'adder') {
          setActivePage('adder')
        } else if (p in PAGE_COMPONENTS) {
          setActivePage(p as PageKey)
        }
      }))
    }

    return () => {
      unsubs.forEach(u => {
        if (typeof u === 'function') u()
      })
    }
  }, [])

  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const [updateBannerVersion, setUpdateBannerVersion] = useState<string | null>(null)
  const [updateManifest, setUpdateManifest] = useState<any>(null)
  const [updateProgress, setUpdateProgress] = useState<any>(null)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'>('idle')
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [_prevPage, setPrevPage] = useState<PageKey | null>(null)
  const [pageKey, setPageKey] = useState(0) // forces re-mount for transition

  // ── Universal File Viewer state ──────────────────────────────
  const [openFilePath, setOpenFilePath] = useState<string | null>(null)
  const [adderJob, setAdderJob] = useState<{
    running: boolean
    progress: number
    done: number
    total: number
    status: string
    speed?: string
    eta?: string
  }>({
    running: false,
    progress: 0,
    done: 0,
    total: 0,
    status: ''
  })

  const [syncJob, setSyncJob] = useState<{
    running: boolean
    progress: number
    done: number
    total: number
    status: string
    speed?: string
  }>({
    running: false,
    progress: 0,
    done: 0,
    total: 0,
    status: ''
  })

  const [prprojJob, setPrprojJob] = useState<{
    running: boolean
    progress: number
    status: string
  }>({
    running: false,
    progress: 0,
    status: ''
  })

  // Listen for real-time prproj progress updates globally
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.prproj) return

    const unsubProgress = api.prproj.onProgress((data: { percent: number; currentFolder: string; status: string; index: number; total: number }) => {
      const nextStep = data.percent < 30 ? 1 : data.percent < 60 ? 2 : data.percent < 90 ? 3 : 4
      const statusText = data.status || `Processing ${data.currentFolder}...`

      prprojStore.setState({
        progress: data.percent,
        activeProgressStatus: statusText,
        currentStep: nextStep as 1 | 2 | 3 | 4
      })
      prprojStore.appendLog(`[PROGRESS ${data.percent}%] ${statusText}`)

      setPrprojJob({
        running: true,
        progress: data.percent,
        status: statusText
      })
    })

    const unsubStore = prprojStore.subscribe(() => {
      const st = prprojStore.getState()
      setPrprojJob({
        running: st.generating,
        progress: st.progress,
        status: st.activeProgressStatus || (st.generating ? 'Generating sequence files...' : '')
      })
    })

    return () => {
      if (typeof unsubProgress === 'function') unsubProgress()
      if (typeof unsubStore === 'function') unsubStore()
    }
  }, [])

  const startTimeRef = useRef<number>(0)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [adminStudioOpen, setAdminStudioOpen] = useState(false)

  // ── Global Keyboard Shortcuts (Ctrl+K: Spotlight, Ctrl+B: Sidebar) ──
  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdPaletteOpen(prev => !prev)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('toggle-sidebar'))
      }
      // Secret Owner Hotkey (Ctrl + Shift + A to toggle Full-Page Admin Command Center)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        navigate(activePage === 'admin' ? 'adder' : 'admin')
      }
      if (e.key === 'Escape' && activePage === 'admin') {
        navigate('adder')
      }
    }
    window.addEventListener('keydown', handleGlobalHotkeys)
    return () => window.removeEventListener('keydown', handleGlobalHotkeys)
  }, [activePage, navigate])

  // Derive busy pages based on active background tasks
  const busyPages = new Set<PageKey>()
  if (adderJob.running) busyPages.add('adder')
  if (syncJob.running) busyPages.add('drivesync')
  if (prprojJob.running) busyPages.add('prproj')

  // Check first-launch setup & version welcome
  useEffect(() => {
    // Expose navigation & welcome screen & admin studio to global for easy access
    ;(window as any).showPage = navigate
    ;(window as any).showWelcomeScreen = () => setShowWelcome(true)
    ;(window as any).showAdobeSplashScreen = () => setShowSplash(true)
    ;(window as any).openAdminStudio = () => navigate('admin')

    // Listen for cross-app remote navigation (from Anything or local HTTP server)
    let unsubscribeNav: (() => void) | undefined
    try {
      const apiObj = (window as any).api
      if (apiObj?.system?.onNavigate) {
        unsubscribeNav = apiObj.system.onNavigate((page: string) => {
          if (page && typeof navigate === 'function') {
            navigate(page as PageKey)
          }
        })
      }
    } catch {}

    async function check(): Promise<void> {
      try {
        const api = (window as any).api
        if (!api) return

        // 1. Resolve current application version & check first startup
        let curVer = '26.10.12'
        try {
          if (api.update && typeof api.update.getCurrentVersion === 'function') {
            curVer = await api.update.getCurrentVersion()
            setAppVersion(curVer)
          }
        } catch (err) {
          console.warn('[App] Failed to load version:', err)
        }

        // Show welcome screen on first install
        const lastWelcomed = localStorage.getItem('last_welcomed_version')
        if (!lastWelcomed) {
          setShowWelcome(true)
        } else {
          setShowWelcome(false)
        }

        // 2. Check setup with short timeout safeguard
        try {
          if (api.settings && typeof api.settings.needsSetup === 'function') {
            const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 800))
            const needs = await Promise.race([api.settings.needsSetup(), timeoutPromise])
            if (needs) {
              setSetupDone(false)
            } else {
              setSetupDone(true)
            }
          }
        } catch (err) {
          console.warn('[App] Setup check failed, defaulting to setupDone=true:', err)
          setSetupDone(true)
        }

        // 3. Check system dependencies (FFmpeg - non-blocking background check)
        if (api.ffmpeg && typeof api.ffmpeg.check === 'function') {
          api.ffmpeg.check().catch((e) => {
            console.warn('[App] Non-blocking FFmpeg check warning:', e)
          })
        }

        // 4. Auto Check Updates on startup
        const allSettings = await api.settings.getAll()
        if (allSettings.auto_check_updates !== false) {
          setTimeout(async () => {
            try {
              const res = await api.update.check()
              if (res && res.updateAvailable) {
                setUpdateManifest(res)
                setUpdateBannerVersion(res.latestVersion)
              }
            } catch (e) {
              console.warn('[Updater] Startup update check failed:', e)
            }
          }, 3000)
        }

        // 4. Deferred non-blocking background migration for legacy stats
        setTimeout(async () => {
          try {
            if (!allSettings.render_stats) return
            let loadedRecords: any[] = typeof allSettings.render_stats === 'string'
              ? JSON.parse(allSettings.render_stats)
              : allSettings.render_stats as any[]

            const folderCities = (allSettings.stats_folder_cities
              ? (typeof allSettings.stats_folder_cities === 'string' ? JSON.parse(allSettings.stats_folder_cities) : allSettings.stats_folder_cities)
              : {}) as Record<string, string>

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

                const safarHierarchy = parseSafarHierarchy(r.filePath || r.folder || '')
                const isBogusSafar = r.safar && (/^\d{4}[\s-_.]\d{1,2}[\s-_.]\d{1,2}/.test(r.safar) || (/^\d{4}[\s-_.]\d{1,2}/.test(r.safar) && !/[a-zA-Z]{2,}/.test(r.safar)))

                const isMumbai = (r.city && r.city.toLowerCase() === 'mumbai') ||
                  (r.safar && r.safar.toLowerCase().includes('mumbai')) ||
                  (r.folder && r.folder.toLowerCase().includes('mumbai')) ||
                  (r.filePath && r.filePath.toLowerCase().includes('mumbai')) ||
                  (safarHierarchy.city && safarHierarchy.city.toLowerCase() === 'mumbai')

                let resolvedSafar = 'Unassigned'
                let resolvedCity = 'Unassigned'
                let resolvedSafarSerial: string | undefined = undefined
                let resolvedSafarYear: number | undefined = undefined

                if (isMumbai) {
                  resolvedCity = 'Mumbai'
                  if (r.safar && r.safar !== 'Unassigned' && !isBogusSafar) {
                    resolvedSafar = r.safar
                  } else if (safarHierarchy.safar && safarHierarchy.safar !== 'Unassigned') {
                    resolvedSafar = safarHierarchy.safar
                  } else {
                    resolvedSafar = '1448-03 Mumbai'
                  }
                  resolvedSafarSerial = (r.safarSerial && !isBogusSafar) ? r.safarSerial : (safarHierarchy.safarSerial || '03')
                  resolvedSafarYear = (r.safarYear && !isBogusSafar) ? r.safarYear : (safarHierarchy.safarYear || 1448)
                } else if (safarHierarchy.safar && safarHierarchy.safar !== 'Unassigned') {
                  resolvedSafar = safarHierarchy.safar
                  resolvedCity = safarHierarchy.city !== 'Unassigned' ? safarHierarchy.city : (r.city || 'Unassigned')
                  resolvedSafarSerial = safarHierarchy.safarSerial || r.safarSerial
                  resolvedSafarYear = safarHierarchy.safarYear || r.safarYear
                } else if (r.safar && r.safar !== 'Unassigned' && !isBogusSafar) {
                  resolvedSafar = r.safar
                  resolvedCity = r.city || 'Unassigned'
                  resolvedSafarSerial = r.safarSerial
                  resolvedSafarYear = r.safarYear
                } else {
                  resolvedSafar = 'Unassigned'
                  resolvedCity = 'Unassigned'
                }

                const folderInfo = parseFolderName(r.folder || '')
                if (resolvedCity !== r.city || resolvedSafar !== r.safar || resolvedSafarSerial !== r.safarSerial || resolvedSafarYear !== r.safarYear) {
                  migrated = true
                  return {
                    ...r,
                    safar: resolvedSafar,
                    safarSerial: resolvedSafarSerial,
                    safarYear: resolvedSafarYear,
                    city: resolvedCity,
                    hijriYear: folderInfo.hijriYear || safarHierarchy.hijriYear || r.hijriYear,
                    hijriMonth: folderInfo.hijriMonth || safarHierarchy.hijriMonth || r.hijriMonth
                  }
                }
                return r
              })

              if (migrated) {
                console.log('[App] Background stats migration completed.')
                localStorage.setItem('render_stats', JSON.stringify(loadedRecords))
                await api.settings.setAndSave('render_stats', loadedRecords)
              }

              if (api && api.statsDb) {
                api.statsDb.insertRecords(loadedRecords).catch(() => { })
              }
            }
          } catch (migrationErr) {
            console.warn('[App] Deferred migration warning:', migrationErr)
          }
        }, 1500)
      } catch (e) {
        console.error('Initialization error:', e)
        setSetupDone(true)
      }
    }

    const safetyTimer = setTimeout(() => {
      setSetupDone((prev) => (prev === null ? true : prev))
    }, 2500)

    check()

    return () => {
      clearTimeout(safetyTimer)
      unsubscribeNav?.()
    }
  }, [])

  // Listen for real-time video processing updates globally
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.titleAdder) return

    const handleFound = (d: { total: number }) => {
      startTimeRef.current = Date.now()
      setAdderJob(prev => ({ ...prev, running: true, total: d.total, done: 0, progress: 0 }))
    }

    const handleProgress = (d: { percent: number; status: string; fps?: string; speed?: string }) => {
      setAdderJob(prev => {
        let etaStr = 'Calculating...'
        if (prev.running && d.percent > 1) {
          // calculate dynamic eta
          const elapsed = (Date.now() - startTimeRef.current) / 1000
          const totalEst = elapsed / (d.percent / 100)
          const remaining = totalEst - elapsed
          if (remaining > 0) {
            const mins = Math.floor(remaining / 60)
            const secs = Math.round(remaining % 60)
            etaStr = `${mins}m ${secs}s`
          }
        }

        return {
          ...prev,
          running: true,
          progress: d.percent ?? 0,
          status: d.status ?? '',
          speed: d.speed ?? '',
          eta: etaStr
        }
      })
    }

    const handleVideosDone = (d: { done: number }) => {
      setAdderJob(prev => ({ ...prev, done: d.done }))
    }

    const handleDone = (d: { success: boolean; done?: number; total?: number }) => {
      setAdderJob(prev => ({
        ...prev,
        running: false,
        progress: 100,
        done: d.done ?? prev.done,
        total: d.total ?? prev.total,
        status: d.success ? 'Success' : 'Aborted'
      }))
    }

    const unsubFound = api.titleAdder.onFound(handleFound)
    const unsubProg = api.titleAdder.onProgress(handleProgress)
    const unsubVideosDone = api.titleAdder.onVideosDone(handleVideosDone)
    const unsubDone = api.titleAdder.onDone(handleDone)

    return () => {
      if (typeof unsubFound === 'function') unsubFound()
      if (typeof unsubProg === 'function') unsubProg()
      if (typeof unsubVideosDone === 'function') unsubVideosDone()
      if (typeof unsubDone === 'function') unsubDone()
    }
  }, [])

  // Listen for real-time drive sync updates globally
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.driveSync) return

    const handleFound = (d: { total: number }) => {
      setSyncJob(prev => ({ ...prev, running: true, total: d.total, done: 0, progress: 0 }))
    }

    const handleProgress = (d: { percent: number; speedMBs?: string; done?: number }) => {
      setSyncJob(prev => ({
        ...prev,
        running: true,
        progress: d.percent ?? 0,
        done: d.done ?? prev.done,
        speed: d.speedMBs ? `${d.speedMBs} MB/s` : '0 MB/s',
        status: `Syncing files...`
      }))
    }

    const handleDone = (d: { copied: number; cancelled?: boolean }) => {
      setSyncJob(prev => ({
        ...prev,
        running: false,
        progress: 100,
        done: d.copied,
        status: d.cancelled ? 'Cancelled' : 'Finished'
      }))
    }

    // Since drivesync register listeners are bound inside the page, let's hook into these ipc handles or listeners
    // Wait, let's double check if we can register multiple listeners for onFound / onProgress.
    // Yes, they are standard IPC callbacks!
    const unsubFound = api.driveSync.onFound(handleFound)
    const unsubProg = api.driveSync.onProgress(handleProgress)
    const unsubDone = api.driveSync.onDone(handleDone)

    return () => {
      if (typeof unsubFound === 'function') unsubFound()
      if (typeof unsubProg === 'function') unsubProg()
      if (typeof unsubDone === 'function') unsubDone()
    }
  }, [])

  // Global Stat Listener
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.titleAdder || setupDone === null) return

    const handleFinished = async (d: {
      prefix: string,
      stem: string,
      addToStats: boolean,
      folder: string,
      duration: number,
      outputPath?: string,
      videoPath?: string,
      mode?: string,
      safar?: string,
      safarYear?: number,
      safarSerial?: string,
      city?: string,
      hijriYear?: number,
      hijriMonth?: number,
      hijriDay?: number,
      session?: string
    }) => {
      console.log('[App] Video finished event received:', d)
      if (!d.addToStats) return

      let records: any[] = []
      let folderCities: Record<string, string> = {}
      try {
        const all = await api.settings.getAll()
        if (all.render_stats) {
          records = typeof all.render_stats === 'string'
            ? JSON.parse(all.render_stats)
            : all.render_stats as any[]
        }
        if (all.stats_folder_cities) {
          folderCities = typeof all.stats_folder_cities === 'string'
            ? JSON.parse(all.stats_folder_cities)
            : all.stats_folder_cities as Record<string, string>
        }
      } catch (e) {
        console.error('[App] Failed to load stats/cities from settings.json:', e)
      }

      if (records.length === 0) {
        const data = localStorage.getItem('render_stats')
        if (data) {
          try { records = JSON.parse(data) } catch { }
        }
      }

      const parseTarget = d.videoPath || d.outputPath || d.folder || ''
      const safarHierarchy = parseSafarHierarchy(parseTarget)

      const resolvedSafar = d.safar || (safarHierarchy.safar !== 'Unassigned' ? safarHierarchy.safar : 'Unassigned')
      const resolvedSafarSerial = d.safarSerial || safarHierarchy.safarSerial
      const resolvedSafarYear = d.safarYear || safarHierarchy.safarYear

      const override = folderCities[d.folder || '']
      const resolvedCity = (override && override !== 'Unassigned')
        ? override
        : (d.city || (safarHierarchy.city !== 'Unassigned' ? safarHierarchy.city : detectCity(d.stem, parseTarget)))

      const resolvedHijriYear = d.hijriYear || safarHierarchy.hijriYear
      const resolvedHijriMonth = d.hijriMonth || safarHierarchy.hijriMonth
      const resolvedHijriDay = d.hijriDay || safarHierarchy.hijriDay
      const resolvedSession = d.session || safarHierarchy.session

      // Avoid duplicate stats entries if rendered multiple times on the same day
      const today = new Date()
      const existingIdx = records.findIndex(r => {
        const rd = new Date(r.date)
        return r.name === d.stem &&
          r.prefix === d.prefix &&
          (r.folder || '') === (d.folder || '') &&
          rd.getFullYear() === today.getFullYear() &&
          rd.getMonth() === today.getMonth() &&
          rd.getDate() === today.getDate() &&
          !!r.isReedit === (d.mode === 'single')
      })

      const newRecord = {
        prefix: d.prefix,
        name: d.stem,
        date: Date.now(),
        folder: d.folder,
        duration: d.duration,
        safar: resolvedSafar,
        safarYear: resolvedSafarYear,
        safarSerial: resolvedSafarSerial,
        city: resolvedCity,
        hijriYear: resolvedHijriYear,
        hijriMonth: resolvedHijriMonth,
        hijriDay: resolvedHijriDay,
        session: resolvedSession,
        filePath: d.videoPath || d.outputPath || '',
        isReedit: d.mode === 'single'
      }

      if (existingIdx > -1) {
        records[existingIdx] = newRecord
      } else {
        records.push(newRecord)
      }

      localStorage.setItem('render_stats', JSON.stringify(records))
      try {
        await api.settings.setAndSave('render_stats', records)
        if (api.statsDb) {
          await api.statsDb.insertRecords([newRecord]).catch(() => { })
        }
        console.log('[App] Stats successfully synchronized to settings.json, SQLite and localStorage')
        window.dispatchEvent(new CustomEvent('stats-updated', { detail: records }))
      } catch (e) {
        console.error('[App] Failed to write stats:', e)
        window.dispatchEvent(new CustomEvent('stats-updated', { detail: records }))
      }
    }

    const cleanup = api.titleAdder.onVideoFinished(handleFinished)
    console.log('[App] Global stat listener registered successfully')

    return () => {
      if (cleanup && typeof cleanup === 'function') cleanup()
    }
  }, [setupDone])

  // Dead-man switch for white-screen hang
  useEffect(() => {
    const timer = setTimeout(() => {
      setSetupDone(prev => {
        if (prev === null) {
          console.warn('Initialization timeout — forcing reveal.')
          return true
        }
        return prev
      })
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  // ── Listen for file-open events from main process (Explorer double-click) ──
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.viewer) return
    const unsub = api.viewer.onOpenFile((filePath: string) => {
      setOpenFilePath(filePath)
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [])
  // ── Listen for startup auto-update notifications & progress from main process ──────────
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.update) return

    (window as any).openUpdateModal = (manifest?: any) => {
      if (manifest) setUpdateManifest(manifest)
      setUpdateModalOpen(true)
    }

    const unsubAvailable = typeof api.update.onUpdateAvailable === 'function'
      ? api.update.onUpdateAvailable((manifest: any) => {
        console.log('[AutoUpdater] Received update:available push from main:', manifest)
        setUpdateManifest(manifest)
        setUpdateBannerVersion(manifest?.latestVersion || 'latest')
        setUpdateStatus('available')
        setUpdateModalOpen(true)
      })
      : undefined

    const unsubProgress = typeof api.update.onProgress === 'function'
      ? api.update.onProgress((prog: any) => {
        setUpdateProgress(prog)
        if (prog && prog.percent !== undefined) {
          setUpdateStatus(prog.percent >= 100 ? 'ready' : 'downloading')
        }
      })
      : undefined

    return () => {
      delete (window as any).openUpdateModal
      if (typeof unsubAvailable === 'function') unsubAvailable()
      if (typeof unsubProgress === 'function') unsubProgress()
    }
  }, [])

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // '?' shortcut — open shortcut help overlay
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          setShortcutHelpOpen(prev => !prev)
          return
        }
      }

      // Escape — close shortcut help overlay
      if (e.key === 'Escape') {
        setShortcutHelpOpen(false)
        return
      }

      if (e.altKey && !isNaN(Number(e.key))) {
        const idx = Number(e.key) - 1

        // Filter out hidden tools to match visual order
        const visible = orderedNav.filter(key => {
          if (key === 'drivesync' || key === 'folder' || key === 'gdrive' || key === 'cameratransfer' || key === 'pvseparator' || key === 'excelmerger') return false
          try {
            const hidden = JSON.parse(textOverrides['hidden_tools'] || '[]')
            return !hidden.includes(key)
          } catch { return true }
        })

        if (idx >= 0 && idx < visible.length) {
          const target = visible[idx]
          navigate(target)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePage, orderedNav, textOverrides])

  function navigate(page: PageKey): void {
    if (page === activePage) return
    setPrevPage(activePage)
    setActivePage(page)
    setPageKey(k => k + 1)
  }

  // Expose file viewer and navigation globally so any page component can use them
  useEffect(() => {
    (window as any).openFileInViewer = (path: string) => setOpenFilePath(path)
      ; (window as any).navigateToPage = (page: PageKey) => navigate(page)
    const handleNavEvent = (e: any) => {
      if (e?.detail) navigate(e.detail)
    }
    window.addEventListener('navigate-to-page', handleNavEvent)
    return () => {
      delete (window as any).openFileInViewer
      delete (window as any).navigateToPage
      window.removeEventListener('navigate-to-page', handleNavEvent)
    }
  }, [activePage])

  const handleStartDownload = async (): Promise<void> => {
    setUpdateStatus('downloading')
    const api = (window as any).api
    if (api && api.update && typeof api.update.download === 'function') {
      try {
        const res = await api.update.download()
        if (res && res.success) {
          setUpdateStatus('ready')
          showToast({
            title: 'Update Download Complete',
            message: 'Workstation update downloaded successfully! Restart to apply.',
            type: 'success'
          })
        }
      } catch (e) {
        setUpdateStatus('available')
        showToast({
          title: 'Update Download Failed',
          message: String(e),
          type: 'error'
        })
      }
    }
  }

  const handleApplyUpdate = async (): Promise<void> => {
    const api = (window as any).api
    if (api && api.update && typeof api.update.install === 'function') {
      try {
        await api.update.install()
      } catch (e) {
        showToast({ title: 'Install Failed', message: String(e), type: 'error' })
      }
    }
  }

  const ActivePage = PAGE_COMPONENTS[activePage]

  return (
    <>
      <div className="aura-bg">
        <div className="app-watermark-pattern" />
        <div className="aura-blob aura-blob-1" />
        <div className="aura-blob aura-blob-2" />
        <div className="aura-blob aura-blob-3" />
      </div>

      {showSplash && (
        <AdobeSplashScreen
          version={appVersion}
          isOpen={showSplash}
          onComplete={() => {
            sessionStorage.setItem('ot_boot_splash_shown', 'true')
            localStorage.setItem('last_welcomed_version', appVersion)
            setShowSplash(false)
            setShowWelcome(false)
            setActivePage('adder')
          }}
        />
      )}

      {isRefreshing && (
        <RadialRefreshLoader
          isOpen={isRefreshing}
          onComplete={() => {
            setIsRefreshing(false)
            setActivePage('adder')
          }}
        />
      )}

      {showWelcome && !showSplash && !isRefreshing && (
        <WelcomeScreen
          version={appVersion}
          onDone={() => {
            localStorage.setItem('last_welcomed_version', appVersion)
            setShowWelcome(false)
            setActivePage('adder')
          }}
        />
      )}

      {!setupDone && !showWelcome && !showSplash && !isRefreshing && (
        <SetupWizard onDone={() => setSetupDone(true)} />
      )}

      <div
        className="app-shell"
        data-page={activePage}
        style={{
          opacity: !showSplash && !isRefreshing && !showWelcome && setupDone ? 1 : 0,
          transition: 'opacity 0.35s ease',
          pointerEvents: !showSplash && !isRefreshing && !showWelcome && setupDone ? 'auto' : 'none'
        }}
      >
        {/* Liquid Glass chromatic refraction background mesh */}
        <div className="app-liquid-mesh" aria-hidden="true">
          <div className="app-liquid-orb app-liquid-orb-1" />
          <div className="app-liquid-orb app-liquid-orb-2" />
          <div className="app-liquid-orb app-liquid-orb-3" />
          <div className="app-liquid-orb app-liquid-orb-4" />
        </div>

        <Sidebar
          activePage={activePage}
          onNavigate={navigate}
          busyPages={busyPages}
          adderProgress={adderJob.running ? adderJob.progress : null}
          syncProgress={syncJob.running ? syncJob.progress : null}
        />

        <div className="app-main-container">
          <DynamicIsland floating />
          <Toolbar
            activePage={activePage}
            onOpenCmdPalette={() => setCmdPaletteOpen(true)}
          />

          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <Suspense fallback={<PageLoader pageKey={activePage} />}>
              <div
                key={pageKey}
                className={`page-wrapper page-enter-${pageTransition}`}
                data-page={activePage}
                style={{ height: '100%', overflow: 'hidden auto' }}
              >
                <WorkstationErrorBoundary pageKey={activePage}>
                  <ActivePage />
                </WorkstationErrorBoundary>
              </div>
            </Suspense>

            {/* Subtle page watermark logo imprint */}
            {activePage !== 'dashboard' && activePage !== 'admin' && (
              <div className="page-watermark">
                <img src={zenLogo} alt="" className="page-watermark-logo" />
              </div>
            )}
          </div>
        </div>

        <TrayDock
          adderJob={adderJob}
          syncJob={syncJob}
          prprojJob={prprojJob}
          onNavigate={navigate}
        />
      </div>

      {shortcutHelpOpen && (
        <div
          className="shortcut-help-backdrop"
          onClick={() => setShortcutHelpOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div
            className="shortcut-help-panel"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '20px',
              padding: '32px 36px',
              minWidth: '420px',
              maxWidth: '520px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
              animation: 'scaleInCenter 0.25s var(--ease-spring)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>⌨️ Keyboard Shortcuts</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Press <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', padding: '2px 7px', fontFamily: 'monospace', fontSize: '12px' }}>Esc</kbd> to close</p>
              </div>
              <button
                onClick={() => setShortcutHelpOpen(false)}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              >✕</button>
            </div>

            {[
              { keys: ['Ctrl', 'K'], desc: 'Open Command Palette launcher' },
              { keys: ['Ctrl', 'B'], desc: 'Toggle sidebar collapse' },
              { keys: ['Alt', '1–9'], desc: 'Jump to tool by index' },
              { keys: ['?'], desc: 'Toggle this shortcut help panel' },
              { keys: ['Ctrl', '+'], desc: 'Zoom in the workstation' },
              { keys: ['Ctrl', '–'], desc: 'Zoom out the workstation' },
              { keys: ['Ctrl', '0'], desc: 'Reset zoom to 100%' },
              { keys: ['Esc'], desc: 'Close overlays & dialogs' },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 14px', borderRadius: '10px',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
                  marginBottom: '4px'
                }}
              >
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{row.desc}</span>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                  {row.keys.map((k, ki) => (
                    <kbd
                      key={ki}
                      style={{
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '6px', padding: '3px 9px', fontFamily: 'monospace',
                        fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    >{k}</kbd>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ marginTop: '20px', padding: '14px', borderRadius: '12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong>Tip:</strong> Press <strong>?</strong> from anywhere in the app to access this panel instantly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Global Update Progress & Notification Banner ── */}
      {updateBannerVersion && updateStatus !== 'idle' && (
        <div
          className="anim-scale-in"
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: 9999,
            background: 'var(--surface-2, #1E293B)',
            border: updateStatus === 'ready'
              ? '1px solid rgba(34, 197, 94, 0.5)'
              : '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '16px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(20px)',
            minWidth: '340px',
            maxWidth: '440px',
            animation: 'scaleInCenter 0.25s var(--ease-spring)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '10px', background: updateStatus === 'ready' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(139, 92, 246, 0.15)', color: updateStatus === 'ready' ? '#22C55E' : '#A78BFA', flexShrink: 0 }}>
              {updateStatus === 'ready' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : updateStatus === 'downloading' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.5s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
              )}
            </span>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text-primary)' }}>
                {updateStatus === 'ready'
                  ? 'Update Ready to Install!'
                  : updateStatus === 'downloading'
                    ? `Downloading Update v${updateBannerVersion}...`
                    : `Workstation Update Available (v${updateBannerVersion})`}
              </strong>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {updateStatus === 'ready'
                  ? 'Update package ready! Restart One Tap now to apply.'
                  : updateStatus === 'downloading'
                    ? `${updateProgress?.percent ?? 0}% completed ${updateProgress?.speedBytesPerSec ? `· ${(updateProgress.speedBytesPerSec / 1048576).toFixed(1)} MB/s` : ''}`
                    : 'A newer verified version of One Tap is ready from Anything.'}
              </span>
            </div>
            <button
              onClick={() => setUpdateBannerVersion(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
              title="Dismiss"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Live Progress Bar during download */}
          {updateStatus === 'downloading' && (
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(updateProgress?.percent ?? 0, 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
                  borderRadius: '10px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            {updateStatus === 'available' && (
              <>
                <button
                  onClick={() => {
                    navigate('settings')
                  }}
                  style={{
                    padding: '7px 16px',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  View Details
                </button>
                <button
                  onClick={handleStartDownload}
                  style={{
                    padding: '7px 16px',
                    background: 'var(--accent-settings, #6366F1)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Download Update
                </button>
              </>
            )}

            {updateStatus === 'ready' && (
              <button
                onClick={handleApplyUpdate}
                style={{
                  padding: '8px 18px',
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}
              >
                Restart & Install Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Global Drag & Drop Format Inspection Overlay ── */}
      <GlobalDropOverlay activePage={activePage} />

      {/* ── Spotlight Command Palette Overlay (Ctrl + K) ── */}
      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNavigate={navigate}
      />

      {/* ── Universal File Viewer Overlay ── */}
      <FileViewer
        filePath={openFilePath}
        onClose={() => setOpenFilePath(null)}
      />

      {/* ── Auto Update Release Notes & Progress Modal ── */}
      <AutoUpdateModal
        isOpen={updateModalOpen}
        manifest={updateManifest}
        status={updateStatus}
        progress={updateProgress}
        errorMsg={updateError}
        onClose={() => setUpdateModalOpen(false)}
        onStartDownload={handleStartDownload}
        onApplyUpdate={handleApplyUpdate}
      />
    </>
  )
}


export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <SoundProvider>
        <ToastProvider>
          <CursorProvider>
            <AppInner />
          </CursorProvider>
        </ToastProvider>
      </SoundProvider>
    </ThemeProvider>
  )
}
