import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import Modal from '../../components/Modal'
import { PageIcon } from '../../components/PageIcon'
import {
  SafarGroupItem,
  TrackerTaskItem,
  TaskStatus,
  TrackerAuditLog,
  DriveWorkspaceConfig,
  DriveSpaceInfo
} from '../../types'
import './TaskTracker.css'

const api = (window as any).api

const STATUS_ORDER: TaskStatus[] = [
  'editing_pending',
  'editing',
  'review',
  'upload_pending',
  'uploaded',
  'submitted'
]

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; icon: string; stepIndex: number }> = {
  editing_pending: {
    label: 'Editing Pending',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.15)',
    icon: 'clock',
    stepIndex: 1
  },
  editing: {
    label: 'Editing In Progress',
    color: '#60A5FA',
    bg: 'rgba(59, 130, 246, 0.15)',
    icon: 'videotransfer',
    stepIndex: 2
  },
  review: {
    label: 'Review / Review Editing',
    color: '#A78BFA',
    bg: 'rgba(139, 92, 246, 0.15)',
    icon: 'eye',
    stepIndex: 3
  },
  upload_pending: {
    label: 'Upload Pending (In Final)',
    color: '#22D3EE',
    bg: 'rgba(6, 182, 212, 0.15)',
    icon: 'globe',
    stepIndex: 4
  },
  uploaded: {
    label: 'Uploaded (In To Upload)',
    color: '#34D399',
    bg: 'rgba(16, 185, 129, 0.15)',
    icon: 'check_circle',
    stepIndex: 5
  },
  submitted: {
    label: 'Submitted to AlJamea',
    color: '#10B981',
    bg: 'rgba(5, 150, 105, 0.25)',
    icon: 'landmark',
    stepIndex: 6
  }
}

export function normalizeDrive(d?: string): string {
  if (!d) return ''
  const trimmed = d.trim()
  const m = trimmed.match(/^([A-Za-z]:)/)
  if (m) return m[1].toUpperCase() + '\\'
  return trimmed.toLowerCase().replace(/[\\/]+$/, '')
}

export default function TaskTracker(): JSX.Element {
  const { showToast } = useToast()
  const { playSuccess, playTick } = useSound()

  // ── Multi-Drive Workspaces State ──
  const [drives, setDrives] = useState<DriveWorkspaceConfig[]>([])
  const [selectedDrive, setSelectedDrive] = useState<string>('all')
  const [driveSpaces, setDriveSpaces] = useState<Record<string, DriveSpaceInfo>>({})

  // Legacy paths fallback for backwards compatibility
  const [workingPath, setWorkingPath] = useState<string>(() => localStorage.getItem('ot_tracker_working_path') || '')
  const [toUploadPath, setToUploadPath] = useState<string>(() => localStorage.getItem('ot_tracker_upload_path') || '')
  const [toDeletePath, setToDeletePath] = useState<string>(() => localStorage.getItem('ot_tracker_delete_path') || '')

  // ── Core Data & UI State ──
  const [safars, setSafars] = useState<SafarGroupItem[]>([])
  const [tasks, setTasks] = useState<TrackerTaskItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [safarStatusFilter, setSafarStatusFilter] = useState<'all' | 'safar_pending' | 'in_process' | 'to_delete' | 'to_upload'>('all')
  const [viewMode, setViewMode] = useState<'safar' | 'pipeline' | 'table'>('safar')
  const [collapsedSafars, setCollapsedSafars] = useState<Record<string, boolean>>({})
  const [selectedSafars, setSelectedSafars] = useState<string[]>([])

  // ── Inspect Modal State ──
  const [inspectTask, setInspectTask] = useState<TrackerTaskItem | null>(null)
  const [historyLogs, setHistoryLogs] = useState<TrackerAuditLog[]>([])
  const [generatingTasks, setGeneratingTasks] = useState<Record<string, boolean>>({})
  const [generatingSafars, setGeneratingSafars] = useState<Record<string, boolean>>({})
  const [moveModalSafar, setMoveModalSafar] = useState<any | null>(null)
  const [isMoving, setIsMoving] = useState<boolean>(false)

  // ── Load Drive Configurations from Settings ──
  const loadDrives = async (): Promise<DriveWorkspaceConfig[]> => {
    let list: DriveWorkspaceConfig[] = []
    if (api?.settings?.getAll) {
      try {
        const all = await api.settings.getAll()
        if (Array.isArray(all.task_tracker_drives) && all.task_tracker_drives.length > 0) {
          list = all.task_tracker_drives
        }
      } catch { }
    }

    if (list.length === 0) {
      const local = localStorage.getItem('ot_tracker_drives')
      if (local) {
        try { list = JSON.parse(local) } catch { }
      }
    }

    // Auto-discover connected drives that have In Process or To Upload (e.g. F:\, D:\)
    if (api?.taskTracker?.autoDetectDriveFolders) {
      try {
        const sysDrives: string[] = (await api?.system?.getDrives?.()) || ['F:\\', 'D:\\', 'E:\\', 'C:\\']
        const prioritized = Array.from(new Set(['F:\\', 'D:\\', 'E:\\', ...sysDrives]))
        let changed = false
        for (const drv of prioritized) {
          const normDrv = normalizeDrive(drv)
          const alreadyExists = list.some(d => normalizeDrive(d.driveRoot) === normDrv)
          if (!alreadyExists) {
            const auto = await api.taskTracker.autoDetectDriveFolders(drv)
            if (auto && auto.inProcessExists) {
              const inPath = auto.inProcessPath
              list.push({
                id: `drive-${drv.toUpperCase().replace(/[\\/:]/g, '')}`,
                driveRoot: auto.driveRoot,
                enabled: true,
                inProcessPath: inPath,
                toUploadPath: auto.toUploadPath,
                toDeletePath: auto.toDeletePath,
                label: `Drive ${auto.driveRoot.replace(/[\\/]/g, '')}`
              })
              changed = true
            }
          }
        }
        if (changed) {
          localStorage.setItem('ot_tracker_drives', JSON.stringify(list))
          if (api?.settings?.setAndSave) {
            await api.settings.setAndSave('task_tracker_drives', list)
          }
        }
      } catch (err) {
        console.error('[taskTracker] Auto drive probe error:', err)
      }
    }

    // Migrate from legacy single paths if still empty
    if (list.length === 0 && workingPath) {
      const rootMatch = workingPath.match(/^[A-Za-z]:[\\/]/)
      const root = rootMatch ? rootMatch[0] : (workingPath.includes(':') ? workingPath.slice(0, 3) : 'F:\\')
      list = [{
        id: 'drive-legacy',
        driveRoot: root,
        enabled: true,
        inProcessPath: workingPath,
        toUploadPath: toUploadPath || (root + 'To Upload'),
        toDeletePath: toDeletePath || (root + 'To Delete'),
        label: `Drive ${root.replace(/[\\/]/g, '')}`
      }]
    }

    setDrives(list)
    refreshDriveSpaces(list)
    return list
  }

  // ── Drive Space & Health Refresh ──
  const refreshDriveSpaces = async (targetDrives?: DriveWorkspaceConfig[]) => {
    const list = targetDrives || drives
    if (!list || list.length === 0 || !api?.system?.getDriveSpace) return
    const map: Record<string, DriveSpaceInfo> = {}
    await Promise.all(
      list.map(async (d) => {
        try {
          const norm = normalizeDrive(d.driveRoot)
          const info = await api.system.getDriveSpace(d.driveRoot)
          if (info) {
            map[norm] = info
          }
        } catch (err) {
          console.error('[taskTracker] Drive space check failed for', d.driveRoot, err)
        }
      })
    )
    setDriveSpaces(prev => ({ ...prev, ...map }))
  }

  // ── Scanning Engine ──
  const isScanningRef = useRef(false)
  const lastScanTimeRef = useRef<number>(0)

  const doScan = async (showNotice = false) => {
    if (!api?.taskTracker || isScanningRef.current) return
    if (!showNotice && Date.now() - lastScanTimeRef.current < 3500) return

    isScanningRef.current = true
    lastScanTimeRef.current = Date.now()
    setLoading(true)

    try {
      const currentDrives = drives.length > 0 ? drives : await loadDrives()
      let res: any = null

      if (currentDrives.length > 0) {
        res = await api.taskTracker.scan({ workspaces: currentDrives })
      } else if (workingPath) {
        res = await api.taskTracker.scan({
          workingPath: workingPath.trim(),
          toUploadPath: toUploadPath.trim(),
          toDeletePath: toDeletePath.trim()
        })
      } else {
        res = await api.taskTracker.scan({})
      }

      if (res) {
        setSafars(res.safars || [])
        setTasks(res.tasks || [])
        if (showNotice) {
          playSuccess()
          showToast({
            title: 'Tracker Auto-Synced',
            message: `Synchronized ${res.safars?.length || 0} Safars across ${currentDrives.length > 0 ? `${currentDrives.filter(d => d.enabled).length} drive(s)` : 'workspace'}.`,
            type: 'success'
          })
        }
      }
    } catch (err: any) {
      console.error('[taskTracker] Scan error:', err)
      if (showNotice) {
        showToast({ title: 'Scan Error', message: err.message || String(err), type: 'warning' })
      }
    } finally {
      setLoading(false)
      isScanningRef.current = false
    }
  }

  // ── Auto-Watcher & Drive Sentinel Hook ──
  useEffect(() => {
    loadDrives().then(loaded => {
      refreshDriveSpaces(loaded)
      doScan()
      if (api?.taskTracker && loaded.length > 0) {
        api.taskTracker.startWatch({ workspaces: loaded })
      } else if (api?.taskTracker && workingPath) {
        api.taskTracker.startWatch({
          workingPath: workingPath.trim(),
          toUploadPath: toUploadPath.trim(),
          toDeletePath: toDeletePath.trim()
        })
      }
    })

    if (api?.taskTracker) {
      const unsub = api.taskTracker.onChanged(() => {
        doScan()
      })

      // Drive Sentinel: Auto-detect drive connection/disconnection
      const unsubDrives = api.taskTracker.onDrivesChanged?.((data: any) => {
        if (data?.newlyConnected && data.newlyConnected.length > 0) {
          playSuccess()
          showToast({
            title: 'Drive Connected',
            message: `External drive detected (${data.newlyConnected.join(', ')}). Synchronizing automatically...`,
            type: 'info'
          })
        }
        // Background silent refresh and scan
        loadDrives().then(loaded => {
          refreshDriveSpaces(loaded)
          doScan(false)
        })
      })

      return () => {
        if (unsub) unsub()
        if (unsubDrives) unsubDrives()
        api.taskTracker?.stopWatch?.()
      }
    }
    return undefined
  }, [])

  // ── Navigate to Settings ──
  const handleOpenSettings = () => {
    localStorage.setItem('ot_settings_open_tab', 'trackerDrives')
    if ((window as any).navigateToPage) {
      (window as any).navigateToPage('settings')
    } else {
      window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: 'settings' }))
    }
  }

  // ── Browse Directory Pickers ──
  const handleBrowse = async (target: 'working' | 'upload' | 'delete') => {
    if (!api?.dialog?.openFolder) return
    const p = await api.dialog.openFolder()
    if (!p) return
    if (target === 'working') setWorkingPath(p)
    else if (target === 'upload') setToUploadPath(p)
    else if (target === 'delete') setToDeletePath(p)
  }

  const handleOpenFolder = async (folderPath?: string, isConnected = true) => {
    if (!folderPath || !api?.taskTracker) return
    playTick()
    if (!isConnected) {
      showToast({ message: 'Drive is currently offline or disconnected. Task history remains saved.', type: 'warning' })
      return
    }
    const res = await api.taskTracker.openPath(folderPath)
    if (res && res.error) {
      showToast({ message: res.error, type: 'error' })
    }
  }

  const handleOpenPrproj = async (prprojPath?: string, isConnected = true) => {
    if (!prprojPath || !api?.taskTracker) return
    playTick()
    if (!isConnected) {
      showToast({ message: 'Project is on an offline drive. Task details remain saved in DB.', type: 'warning' })
      return
    }
    const res = await api.taskTracker.openPath(prprojPath)
    if (res && res.error) {
      showToast({ message: res.error, type: 'error' })
    }
  }

  // ── 1-Click Premiere Project Generator (Single Mode for Date Folder) ──
  const handleGenerateSingleProject = async (task: TrackerTaskItem, safarCurrentPath?: string) => {
    const taskKey = `${task.safarName}-${task.dateFolder}`
    if (generatingTasks[taskKey]) return

    let targetFolder = task.workingPath
    if (!targetFolder && safarCurrentPath) {
      targetFolder = `${safarCurrentPath}\\${task.dateFolder}`
    }
    if (!targetFolder) {
      showToast({
        title: 'Working Folder Missing',
        message: `Could not locate working folder path for ${task.dateFolder}.`,
        type: 'warning'
      })
      return
    }

    if (!api?.prproj?.generate) {
      showToast({
        title: 'Generator Unavailable',
        message: 'Premiere Pro project generator service is not available.',
        type: 'error'
      })
      return
    }

    playTick()
    setGeneratingTasks(prev => ({ ...prev, [taskKey]: true }))
    showToast({
      title: 'Creating Premiere Project',
      message: `Generating .prproj & .xml sequence for ${task.dateFolder} (Single Mode)...`,
      type: 'info'
    })

    try {
      const res = await api.prproj.generate({
        parentFolder: targetFolder,
        mode: 'single',
        includeSubSubfolders: true,
        ignoreOutputFolders: true,
        overwrite: false
      })

      if (res && res.success) {
        playSuccess()
        showToast({
          title: 'Project Ready!',
          message: `Generated Premiere Pro project and timeline sequence for ${task.dateFolder}.`,
          type: 'success'
        })
        await doScan()
      } else {
        showToast({
          title: 'Project Creation Failed',
          message: res?.error || 'Unknown generation error.',
          type: 'error'
        })
      }
    } catch (err: any) {
      showToast({
        title: 'Project Generation Error',
        message: err.message || String(err),
        type: 'error'
      })
    } finally {
      setGeneratingTasks(prev => {
        const next = { ...prev }
        delete next[taskKey]
        return next
      })
    }
  }

  // ── 1-Click Safar Batch Project Generator (Master Data Mode) ──
  const handleGenerateSafarProjects = async (safar: SafarGroupItem) => {
    if (generatingSafars[safar.safarName]) return
    if (!safar.currentPath) {
      showToast({
        title: 'Safar Folder Missing',
        message: `Could not find base folder path for ${safar.safarName}.`,
        type: 'warning'
      })
      return
    }

    if (!api?.prproj?.generate) {
      showToast({
        title: 'Generator Unavailable',
        message: 'Premiere Pro project generator service is not available.',
        type: 'error'
      })
      return
    }

    playTick()
    setGeneratingSafars(prev => ({ ...prev, [safar.safarName]: true }))
    showToast({
      title: 'Generating Safar Projects',
      message: `Batch generating project files for all date subfolders in ${safar.safarName} (Master Data Mode)...`,
      type: 'info'
    })

    try {
      const res = await api.prproj.generate({
        parentFolder: safar.currentPath,
        mode: 'master',
        includeSubSubfolders: true,
        ignoreOutputFolders: true,
        overwrite: false
      })

      if (res && res.success) {
        playSuccess()
        const count = res.createdCount || res.created?.length || 0
        const skipped = res.skippedCount || res.skipped?.length || 0
        showToast({
          title: 'Safar Projects Ready!',
          message: `Created ${count} project file(s) across ${safar.safarName}${skipped > 0 ? ` (${skipped} already existed)` : ''}.`,
          type: 'success'
        })
        await doScan()
      } else {
        showToast({
          title: 'Batch Generation Failed',
          message: res?.error || 'Unknown error occurred.',
          type: 'error'
        })
      }
    } catch (err: any) {
      showToast({
        title: 'Batch Generation Error',
        message: err.message || String(err),
        type: 'error'
      })
    } finally {
      setGeneratingSafars(prev => {
        const next = { ...prev }
        delete next[safar.safarName]
        return next
      })
    }
  }

  // ── Navigate to PrprojGenerator with safar folder pre-loaded ──
  const handleNavigateToPrproj = (safar: SafarGroupItem) => {
    if (!safar.currentPath) {
      showToast({
        title: 'Safar Folder Missing',
        message: `No folder path found for ${safar.safarName}.`,
        type: 'warning'
      })
      return
    }
    playTick()
    // Store the folder path so PrprojGenerator can pick it up
    localStorage.setItem('ot_prproj_preload_folder', safar.currentPath)
    // Navigate to PrprojGenerator page
    if ((window as any).navigateToPage) {
      ;(window as any).navigateToPage('prprojGenerator')
    } else {
      window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: 'prprojGenerator' }))
    }
    // Also fire the preload event in case the page is already mounted
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('prproj-preload-folder', { detail: safar.currentPath }))
    }, 150)
    showToast({
      title: 'Opening Premiere Generator',
      message: `Loading ${safar.safarName} into the project generator...`,
      type: 'info'
    })
  }

  // ── Date Click Handler: Open if exists, else Generate Single Project ──
  const handleDateClick = (task: TrackerTaskItem, safarCurrentPath?: string) => {
    if (task.prprojPath) {
      handleOpenPrproj(task.prprojPath, task.isDriveConnected !== false)
    } else {
      handleGenerateSingleProject(task, safarCurrentPath)
    }
  }

  const handleOpenInspect = async (task: TrackerTaskItem) => {
    playTick()
    setInspectTask(task)
    if (api?.taskTracker) {
      try {
        const logs = await api.taskTracker.getHistory({
          safarName: task.safarName,
          dateFolder: task.dateFolder
        })
        setHistoryLogs(logs || [])
      } catch {
        setHistoryLogs([])
      }
    }
  }

  // ── 1-Click WhatsApp Formatter ──
  const handleCopyWhatsApp = (safar: SafarGroupItem) => {
    playSuccess()
    const pct = safar.totalDays > 0 ? Math.round((safar.completedDays / safar.totalDays) * 100) : 0
    const trophy = safar.isSafarDone ? ' [100% COMPLETE]' : ''
    const header = `*${safar.safarName}* (${safar.completedDays}/${safar.totalDays} Done - ${pct}%)${trophy}\n`

    const lines = (safar.tasks || []).map(t => {
      const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.editing_pending
      let extra = ''
      if (t.renderedAt) {
        extra = ` (Rendered ${new Date(t.renderedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`
      }
      return `• *${t.dateFolder}*: ${cfg.label}${extra}`
    })

    const text = header + lines.join('\n') + `\n\n_Auto-Tracked via Uni Desk One Tap_`
    navigator.clipboard.writeText(text)
    showToast({
      title: 'WhatsApp Status Copied!',
      message: `Clean formatted update for "${safar.safarName}" ready to paste.`,
      type: 'success'
    })
  }

  // ── Safar Directory Mover Handler ──
  const handleMoveSafar = async (targetFolder: 'in_process' | 'to_upload' | 'to_delete' | 'pending') => {
    if (!moveModalSafar) return
    setIsMoving(true)
    try {
      const res = await api?.taskTracker?.moveSafar({
        safarName: moveModalSafar.safarName,
        currentPath: moveModalSafar.currentPath,
        targetFolder,
        workspaces: drives
      })
      if (res && res.success) {
        playSuccess()
        showToast({
          title: 'Safar Moved Successfully',
          message: `Moved "${moveModalSafar.safarName}" to ${targetFolder.replace('_', ' ').toUpperCase()}`,
          type: 'success'
        })
        setMoveModalSafar(null)
        await doScan(false)
      } else {
        playTick()
        showToast({
          title: 'Move Failed',
          message: res?.error || 'Could not move folder.',
          type: 'error'
        })
      }
    } catch (err: any) {
      showToast({
        title: 'Error Moving Safar',
        message: err.message,
        type: 'error'
      })
    } finally {
      setIsMoving(false)
    }
  }

  // ── 1-Click Excel Export ──
  const handleExportExcel = async () => {
    if (!api?.taskTracker) return
    playTick()
    try {
      const res = await api.taskTracker.exportExcel({ safars, tasks })
      if (res?.success && res.filePath) {
        playSuccess()
        showToast({
          title: 'Excel Manifest Exported!',
          message: `Saved to: ${res.filePath}`,
          type: 'success'
        })
      }
    } catch (err: any) {
      showToast({ title: 'Export Failed', message: err.message || String(err), type: 'warning' })
    }
  }

  // ── Multi-Safar Selection & Manual / Auto Status Overrides ──
  const toggleSelectSafar = (name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedSafars(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const handleClearSelection = () => setSelectedSafars([])

  const handleSetManualStatus = async (
    target: { safarNames?: string[]; taskKeys?: { safarName: string; dateFolder: string }[] },
    status: 'uploaded' | 'submitted' | 'auto'
  ) => {
    if (!api?.taskTracker?.setManualStatus) return
    playTick()
    setLoading(true)
    try {
      const res = await api.taskTracker.setManualStatus({
        ...target,
        status
      })
      if (res?.success !== false) {
        playSuccess()
        const statusLabels: Record<string, string> = {
          uploaded: 'Uploaded',
          submitted: 'Submitted to AlJamea',
          auto: 'Auto file tracking'
        }
        const targetLabel = target.safarNames?.length
          ? `${target.safarNames.length} Safar${target.safarNames.length > 1 ? 's' : ''}`
          : target.taskKeys?.length
          ? `${target.taskKeys.length} deliverable${target.taskKeys.length > 1 ? 's' : ''}`
          : 'Deliverables'

        showToast({
          title: status === 'auto' ? 'Reset to Auto Tracking' : 'Status Updated',
          message: `Marked ${targetLabel} as ${statusLabels[status] || status}.`,
          type: 'success'
        })
        await doScan()
      } else {
        showToast({ title: 'Update Failed', message: res?.error || 'Could not update status', type: 'error' })
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || String(err), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // ── Drive-Filtered Scope ──
  const driveFilteredSafars = useMemo(() => {
    if (selectedDrive === 'all') return safars
    const normSelected = normalizeDrive(selectedDrive)
    return safars.filter(s => normalizeDrive(s.currentDrive) === normSelected)
  }, [safars, selectedDrive])

  const driveFilteredTasks = useMemo(() => {
    if (selectedDrive === 'all') return tasks
    const normSelected = normalizeDrive(selectedDrive)
    return tasks.filter(t => normalizeDrive(t.currentDrive) === normSelected)
  }, [tasks, selectedDrive])

  // ── Global KPI Counts ──
  const kpis = useMemo(() => {
    let pending = 0
    let editing = 0
    let review = 0
    let uploadPending = 0
    let uploaded = 0
    let submitted = 0

    for (const t of driveFilteredTasks) {
      if (t.status === 'editing_pending') pending++
      else if (t.status === 'editing') editing++
      else if (t.status === 'review') review++
      else if (t.status === 'upload_pending') uploadPending++
      else if (t.status === 'uploaded') uploaded++
      else if (t.status === 'submitted') submitted++
    }

    const safarsDone = driveFilteredSafars.filter(s => s.isSafarDone).length
    const deliveredCount = uploaded + submitted
    const deliveryPct = driveFilteredTasks.length > 0 ? Math.min(100, Math.round((deliveredCount / driveFilteredTasks.length) * 100)) : 0
    const inProductionCount = pending + editing + review

    return {
      totalSafars: driveFilteredSafars.length,
      totalDays: driveFilteredTasks.length,
      pending,
      editing,
      review,
      uploadPending,
      uploaded,
      submitted,
      safarsDone,
      deliveredCount,
      deliveryPct,
      inProductionCount
    }
  }, [driveFilteredSafars, driveFilteredTasks])

  // ── Safar-Level Status Buckets (Issue 3) ──
  const safarStatusBuckets = useMemo(() => {
    let safarPending = 0    // ALL tasks are editing_pending
    let inProcess = 0       // At least one task is editing or review
    let toDelete = 0        // ALL tasks are submitted (given to Jamea)
    let toUpload = 0        // ALL tasks are upload_pending or uploaded

    for (const s of driveFilteredSafars) {
      const statuses = (s.tasks || []).map(t => t.status)
      if (statuses.length === 0) continue

      const allPending = statuses.every(st => st === 'editing_pending')
      const anyEditing = statuses.some(st => st === 'editing' || st === 'review')
      const allSubmitted = statuses.every(st => st === 'submitted')
      const allUploadReady = statuses.every(st => st === 'upload_pending' || st === 'uploaded')

      if (allSubmitted) toDelete++
      else if (allUploadReady) toUpload++
      else if (anyEditing) inProcess++
      else if (allPending) safarPending++
    }

    return { safarPending, inProcess, toDelete, toUpload }
  }, [driveFilteredSafars])

  // ── Filtered Safars & Tasks (Search & Status, with Safar-level filter) ──
  const filteredSafars = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return driveFilteredSafars
      .map(s => {
        const tasksList = s.tasks || []
        const matchingTasks = tasksList.filter(t => {
          const matchStatus = statusFilter === 'all' || t.status === statusFilter
          const matchSearch =
            !q ||
            t.dateFolder.toLowerCase().includes(q) ||
            s.safarName.toLowerCase().includes(q) ||
            (s.city || '').toLowerCase().includes(q)
          return matchStatus && matchSearch
        })

        const matchSafarSearch = !q || s.safarName.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q)

        // Compute Safar-level bucket for safarStatusFilter
        const statuses = tasksList.map(t => t.status)
        let safarBucket: string = 'safar_pending'
        if (statuses.length > 0) {
          const allSubmitted = statuses.every(st => st === 'submitted')
          const allUploadReady = statuses.every(st => st === 'upload_pending' || st === 'uploaded')
          const anyEditing = statuses.some(st => st === 'editing' || st === 'review')
          if (allSubmitted) safarBucket = 'to_delete'
          else if (allUploadReady) safarBucket = 'to_upload'
          else if (anyEditing) safarBucket = 'in_process'
        }

        const matchSafarStatus = safarStatusFilter === 'all' || safarBucket === safarStatusFilter

        return {
          ...s,
          filteredTasks: statusFilter === 'all' && !q ? tasksList : matchingTasks,
          shouldShow: matchSafarStatus && (matchingTasks.length > 0 || (matchSafarSearch && statusFilter === 'all'))
        }
      })
      .filter(s => s.shouldShow)
  }, [driveFilteredSafars, searchQuery, statusFilter, safarStatusFilter])




  const formatBytes = (bytes = 0) => {
    if (bytes === 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
    return `${mb.toFixed(0)} MB`
  }

  const formatTimestamp = (ts?: number) => {
    if (!ts) return null
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const toggleCollapse = (name: string) => {
    setCollapsedSafars(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const isAllSelected = filteredSafars.length > 0 && filteredSafars.every(s => selectedSafars.includes(s.safarName))
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSafars([])
    } else {
      setSelectedSafars(filteredSafars.map(s => s.safarName))
    }
  }

  return (
    <div className="tracker-page">
      {/* ── 1. Hero Header ── */}
      <div className="tracker-header">
        <div className="tracker-header-left">
          <div className="tracker-hero-icon">
            <PageIcon pageKey="tracker" size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <h1 className="tracker-header-title">Task & Production Tracker</h1>
              <span className="tracker-live-tag">
                <span className="tracker-live-dot" />
                100% AUTONOMOUS ENGINE
              </span>
            </div>
            <p className="tracker-header-sub">
              Autonomous lifecycle tracking across Safars, Final renders, SSD uploads & AlJamea submissions.
            </p>
          </div>
        </div>

        <div className="tracker-header-actions">
          {/* View Switcher */}
          <div className="view-switcher-group">
            <button
              className={`view-switch-btn ${viewMode === 'safar' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('safar')
                playTick()
              }}
              title="Safar Group Accordions"
            >
              <PageIcon pageKey="folder" size={13} style={{ marginRight: 6 }} /> Safars
            </button>
            <button
              className={`view-switch-btn ${viewMode === 'pipeline' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('pipeline')
                playTick()
              }}
              title="Kanban Studio Board"
            >
              <PageIcon pageKey="stats" size={13} style={{ marginRight: 6 }} /> Pipeline
            </button>
            <button
              className={`view-switch-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('table')
                playTick()
              }}
              title="Executive Data Table"
            >
              <PageIcon pageKey="table" size={13} style={{ marginRight: 6 }} /> Table
            </button>
          </div>

          <button className="btn-secondary-action" onClick={handleExportExcel} title="Export full spreadsheet">
            <PageIcon pageKey="excelmerger" size={13} style={{ marginRight: 6 }} /> Export Excel
          </button>
          <button
            className="btn-primary-action"
            onClick={() => doScan(true)}
            disabled={loading}
          >
            <span className={loading ? 'spinning-icon' : ''}>
              <PageIcon pageKey="refresh" size={13} style={{ marginRight: 6 }} />
            </span>
            {loading ? 'Scanning...' : 'Rescan'}
          </button>
        </div>
      </div>

      {/* ── 2. Standard Production Views Toolbar & KPIs ── */}
      {/* Executive Multi-Drive Workspace Bar */}
      <div className="tracker-drives-bar">
        <div className="tracker-drives-left">
          <div className="tracker-drive-tabs">
            <button
              className={`tracker-drive-tab ${selectedDrive === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedDrive('all')}
            >
              <div className="tracker-drive-tab-main">
                <span className="drive-tab-icon">
                  <PageIcon pageKey="globe" size={14} />
                </span>
                <span className="drive-tab-name">All Drives</span>
                <span className="drive-tab-count">({drives.filter(d => d.enabled).length || 1})</span>
              </div>
            </button>

            {drives.filter(d => d.enabled).map(d => {
              const normD = normalizeDrive(d.driveRoot)
              const safarCountOnDrive = safars.filter(
                s => normalizeDrive(s.currentDrive) === normD
              ).length
              const isActive = selectedDrive !== 'all' && normalizeDrive(selectedDrive) === normD
              const space = driveSpaces[normD]
              const isOnline = space !== undefined ? space.isOnline : true
              const isLow = Boolean(space?.isLowSpace)
              const isCritical = Boolean(space?.isCritical)

              return (
                <button
                  key={d.id}
                  className={`tracker-drive-tab ${isActive ? 'active' : ''} ${!isOnline ? 'offline' : 'online'} ${isCritical ? 'critical-space' : isLow ? 'low-space' : ''}`}
                  onClick={() => setSelectedDrive(d.driveRoot)}
                  title={`Filter by drive ${d.driveRoot}${space ? ` • ${space.freeGB} GB free (${space.totalGB} GB total)` : ''}${!isOnline ? ' • Offline' : ''}`}
                >
                  <div className="tracker-drive-tab-main">
                    <span className="drive-tab-icon">
                      <PageIcon pageKey="drive" size={14} />
                    </span>
                    <span className="drive-tab-name">{d.driveRoot}</span>
                    <span className="drive-tab-count">({safarCountOnDrive})</span>
                    <span className={`drive-tab-badge ${isOnline ? 'badge-connected' : 'badge-offline'}`}>
                      {isOnline ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <PageIcon pageKey="dot" size={8} color="#10B981" /> Connected
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <PageIcon pageKey="dot" size={8} color="#EF4444" /> Offline
                        </span>
                      )}
                    </span>
                  </div>

                  {space && isOnline ? (
                    <div className="drive-tab-space-row">
                      <span className={`drive-tab-space-text ${isCritical ? 'text-critical' : isLow ? 'text-low' : ''}`}>
                        {space.freeGB} GB free
                      </span>
                      {isCritical ? (
                        <span className="drive-tab-alert-pill critical" title="Less than 10 GB free! Premiere render or export failure risk.">
                          <PageIcon pageKey="warning" size={11} color="#EF4444" style={{ marginRight: 3 }} /> &lt;10 GB
                        </span>
                      ) : isLow ? (
                        <span className="drive-tab-alert-pill warning" title="Less than 20 GB free. Monitor drive space.">
                          <PageIcon pageKey="warning" size={11} color="#F59E0B" style={{ marginRight: 3 }} /> Low Space
                        </span>
                      ) : null}
                      <div className="drive-tab-space-meter" title={`${space.usedPercent}% used`}>
                        <div
                          className={`drive-tab-space-fill ${isCritical ? 'fill-critical' : isLow ? 'fill-low' : 'fill-ok'}`}
                          style={{ width: `${Math.min(100, Math.max(4, space.usedPercent))}%` }}
                        />
                      </div>
                    </div>
                  ) : !isOnline ? (
                    <div className="drive-tab-space-row offline">
                      <span className="drive-tab-space-text text-offline">Disconnected</span>
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="tracker-drives-right">
          {/* Quick folder auto-binding health indicators */}
          <div className="tracker-folders-status">
            <span className="tracker-status-item" title="Working Safars auto-bound (e.g. F:\In Process)">
              <PageIcon pageKey="folder_open" size={13} style={{ marginRight: 5 }} />
              In Process
            </span>
            <span className="tracker-status-item" title="Uploaded deliverables auto-bound (e.g. F:\To Upload)">
              <PageIcon pageKey="upload" size={13} style={{ marginRight: 5 }} />
              To Upload
            </span>
            <span className="tracker-status-item" title="Cleanup / submitted archives (e.g. F:\To Delete)">
              <PageIcon pageKey="trash" size={13} style={{ marginRight: 5 }} />
              To Delete
            </span>
          </div>

          <button
            className="tracker-settings-btn"
            onClick={handleOpenSettings}
            title="Configure Drives and auto-detected folders in Settings"
          >
            <PageIcon pageKey="settings" size={13} style={{ marginRight: 6 }} /> Manage Drives in Settings
          </button>
        </div>
      </div>

      {/* Banner if no drives configured yet */}
      {drives.length === 0 && (
        <div className="tracker-no-drives-banner anim-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex' }}>
              <PageIcon pageKey="drive" size={24} />
            </span>
            <div>
              <strong style={{ color: '#0F172A', fontSize: '13px' }}>
                Multi-Drive Storage Workspace Not Configured
              </strong>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Select your storage drive(s) in Settings. Standard folders (<code>In Process</code>, <code>To Upload</code>, <code>To Delete</code>) are linked automatically.
              </p>
            </div>
          </div>
          <button className="tracker-banner-setup-btn" onClick={handleOpenSettings}>
            <PageIcon pageKey="settings" size={13} style={{ marginRight: 6 }} /> Setup Drives in Settings
          </button>
        </div>
      )}

      {/* ── 3. KPI Metric Cards ── */}
      <div className="tracker-kpi-grid">
        <div
          className={`tracker-kpi-card kpi-total ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">Total Days</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="file_text" size={17} />
            </span>
          </div>
          <span className="tracker-kpi-val">{kpis.totalDays}</span>
        </div>

        <div
          className={`tracker-kpi-card kpi-pending ${statusFilter === 'editing_pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('editing_pending')}
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">Editing Pending</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="clock" size={17} color="#F59E0B" />
            </span>
          </div>
          <span className="tracker-kpi-val">{kpis.pending}</span>
        </div>

        <div
          className={`tracker-kpi-card kpi-editing ${statusFilter === 'editing' ? 'active' : ''}`}
          onClick={() => setStatusFilter('editing')}
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">In Progress</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="videotransfer" size={17} color="#60A5FA" />
            </span>
          </div>
          <span className="tracker-kpi-val">{kpis.editing}</span>
        </div>

        <div
          className={`tracker-kpi-card kpi-review ${statusFilter === 'review' ? 'active' : ''}`}
          onClick={() => setStatusFilter('review')}
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">Review Stage</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="eye" size={17} color="#A78BFA" />
            </span>
          </div>
          <span className="tracker-kpi-val">{kpis.review}</span>
        </div>

        <div
          className={`tracker-kpi-card kpi-upload-pending ${statusFilter === 'upload_pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('upload_pending')}
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">Upload Pending</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="globe" size={17} color="#22D3EE" />
            </span>
          </div>
          <span className="tracker-kpi-val">{kpis.uploadPending}</span>
        </div>

        <div
          className={`tracker-kpi-card kpi-uploaded ${statusFilter === 'uploaded' ? 'active' : ''}`}
          onClick={() => setStatusFilter('uploaded')}
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">Uploaded</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="check_circle" size={17} color="#34D399" />
            </span>
          </div>
          <span className="tracker-kpi-val">{kpis.uploaded}</span>
        </div>

        <div
          className={`tracker-kpi-card kpi-submitted ${statusFilter === 'submitted' ? 'active' : ''}`}
          onClick={() => setStatusFilter('submitted')}
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">AlJamea Done</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="landmark" size={17} color="#10B981" />
            </span>
          </div>
          <span className="tracker-kpi-val">{kpis.submitted}</span>
        </div>

        <div className="tracker-kpi-card kpi-safars-done">
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">Safars 100% Done</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="trophy" size={17} color="#F59E0B" />
            </span>
          </div>
          <span className="tracker-kpi-val">
            {kpis.safarsDone} / {kpis.totalSafars}
          </span>
        </div>
      </div>

      {/* ── 3.1 Safar-Level Status KPI Cards (Issue 3) ── */}
      <div className="tracker-safar-status-grid">
        <div className="tracker-safar-status-label">
          <PageIcon pageKey="folder" size={14} style={{ marginRight: 6 }} /> Safar-Level Status
        </div>

        <div
          className={`tracker-kpi-card kpi-safar-pending ${safarStatusFilter === 'safar_pending' ? 'active' : ''}`}
          onClick={() => setSafarStatusFilter(prev => prev === 'safar_pending' ? 'all' : 'safar_pending')}
          title="Safars where ALL tasks are still Editing Pending (nothing started)"
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">Safar Pending</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="clock" size={16} color="#F59E0B" />
            </span>
          </div>
          <span className="tracker-kpi-val">{safarStatusBuckets.safarPending}</span>
        </div>

        <div
          className={`tracker-kpi-card kpi-safar-in-process ${safarStatusFilter === 'in_process' ? 'active' : ''}`}
          onClick={() => setSafarStatusFilter(prev => prev === 'in_process' ? 'all' : 'in_process')}
          title="Safars with at least one Editing or Review task in progress"
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">In Process</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="videotransfer" size={16} color="#60A5FA" />
            </span>
          </div>
          <span className="tracker-kpi-val">{safarStatusBuckets.inProcess}</span>
        </div>

        <div
          className={`tracker-kpi-card kpi-safar-to-delete ${safarStatusFilter === 'to_delete' ? 'active' : ''}`}
          onClick={() => setSafarStatusFilter(prev => prev === 'to_delete' ? 'all' : 'to_delete')}
          title="Safars where ALL tasks are Submitted to AlJamea (ready to delete/archive)"
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">To Delete / Jamea</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="trash" size={16} color="#EF4444" />
            </span>
          </div>
          <span className="tracker-kpi-val">{safarStatusBuckets.toDelete}</span>
        </div>

        <div
          className={`tracker-kpi-card kpi-safar-to-upload ${safarStatusFilter === 'to_upload' ? 'active' : ''}`}
          onClick={() => setSafarStatusFilter(prev => prev === 'to_upload' ? 'all' : 'to_upload')}
          title="Safars where ALL tasks are Upload Pending or Uploaded (ready to submit)"
        >
          <div className="tracker-kpi-top">
            <span className="tracker-kpi-label">To Upload</span>
            <span className="tracker-kpi-icon">
              <PageIcon pageKey="upload" size={16} color="#34D399" />
            </span>
          </div>
          <span className="tracker-kpi-val">{safarStatusBuckets.toUpload}</span>
        </div>
      </div>

      {/* ── 3.5 Workstation Delivery & Upload Progress KPI Bar ── */}

      <div className="tracker-upload-progress-card">
        <div className="tracker-upload-progress-header">
          <div className="tracker-upload-progress-left">
            <span className="tracker-upload-icon">
              <PageIcon pageKey="bolt" size={18} color="#22D3EE" />
            </span>
            <div>
              <div className="tracker-upload-title">Overall Workstation Delivery & Upload Progress</div>
              <div className="tracker-upload-subtitle">
                {kpis.deliveredCount} of {kpis.totalDays} day deliverables completed · {kpis.uploadPending} rendered ready to upload · {kpis.inProductionCount} in production
              </div>
            </div>
          </div>
          <div className="tracker-upload-badge-wrapper">
            <span className={`tracker-upload-pct-badge ${kpis.deliveryPct === 100 ? 'done' : ''}`}>
              {kpis.deliveryPct}% DELIVERED
            </span>
          </div>
        </div>
        <div className="tracker-upload-progress-track">
          <div
            className="tracker-upload-progress-fill uploaded"
            style={{ width: `${kpis.totalDays > 0 ? (kpis.uploaded / kpis.totalDays) * 100 : 0}%` }}
            title={`Uploaded: ${kpis.uploaded} days`}
          />
          <div
            className="tracker-upload-progress-fill submitted"
            style={{ width: `${kpis.totalDays > 0 ? (kpis.submitted / kpis.totalDays) * 100 : 0}%` }}
            title={`AlJamea Submitted: ${kpis.submitted} days`}
          />
          <div
            className="tracker-upload-progress-fill pending"
            style={{ width: `${kpis.totalDays > 0 ? (kpis.uploadPending / kpis.totalDays) * 100 : 0}%` }}
            title={`Rendered & Pending Upload: ${kpis.uploadPending} days`}
          />
        </div>
        <div className="tracker-upload-progress-legend">
          <span className="legend-item"><span className="legend-dot green" /> Uploaded ({kpis.uploaded})</span>
          <span className="legend-item"><span className="legend-dot purple" /> Submitted ({kpis.submitted})</span>
          <span className="legend-item"><span className="legend-dot amber" /> Rendered / Ready to Upload ({kpis.uploadPending})</span>
          <span className="legend-item"><span className="legend-dot slate" /> In Production ({kpis.inProductionCount})</span>
        </div>
      </div>

      {/* ── 4. Toolbar: Search & Filter Pills ── */}
      <div className="tracker-toolbar">
        <div className="tracker-search-box">
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <PageIcon pageKey="search" size={14} color="#94A3B8" />
          </span>
          <input
            type="text"
            placeholder="Search Safar, Date folder, City..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              <PageIcon pageKey="cross" size={12} color="#94A3B8" />
            </button>
          )}
        </div>

        <div className="tracker-filter-pills">
          <button
            className={`tracker-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Items ({tasks.length})
          </button>
          {STATUS_ORDER.map(st => {
            const count = tasks.filter(t => t.status === st).length
            return (
              <button
                key={st}
                className={`tracker-pill ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                <PageIcon pageKey={STATUS_CONFIG[st].icon} size={13} color={STATUS_CONFIG[st].color} style={{ marginRight: 6 }} />
                <span>{STATUS_CONFIG[st].label}</span>
                <span style={{ opacity: 0.7 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Selection Tools */}
        {filteredSafars.length > 0 && (
          <div className="tracker-select-tools">
            <button
              className={`tracker-select-all-btn ${isAllSelected ? 'all-selected' : selectedSafars.length > 0 ? 'part-selected' : ''}`}
              onClick={handleToggleSelectAll}
              title={isAllSelected ? 'Deselect all Safars' : 'Select all visible Safars'}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 4 }}>
                {isAllSelected ? (
                  <PageIcon pageKey="check_circle" size={15} color="var(--accent, #6366F1)" />
                ) : selectedSafars.length > 0 ? (
                  <PageIcon pageKey="check" size={15} color="var(--accent, #6366F1)" />
                ) : (
                  <span style={{ display: 'inline-block', width: 13, height: 13, border: '1.5px solid currentColor', borderRadius: 3 }} />
                )}
              </span>
              <span>{isAllSelected ? 'Deselect All' : selectedSafars.length > 0 ? `Selected (${selectedSafars.length})` : 'Select All'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 4.5 Batch Multi-Safar Action Bar ── */}
      {selectedSafars.length > 0 && (
        <div className="tracker-batch-action-bar">
          <div className="batch-bar-left">
            <span className="batch-count-pill">
              <PageIcon pageKey="sparkles" size={13} color="#F59E0B" style={{ marginRight: 5 }} />
              <strong>{selectedSafars.length}</strong> Safar{selectedSafars.length > 1 ? 's' : ''} Selected
            </span>
            <span className="batch-hint-text">
              Mark deliverables manually or revert to auto:
            </span>
          </div>

          <div className="batch-bar-actions">
            <button
              className="batch-action-btn batch-upload"
              onClick={() => handleSetManualStatus({ safarNames: selectedSafars }, 'uploaded')}
              title="Manually mark all deliverables in selected Safars as Uploaded"
            >
              <PageIcon pageKey="check_circle" size={13} color="#34D399" style={{ marginRight: 6 }} /> Mark as Uploaded
            </button>
            <button
              className="batch-action-btn batch-submit"
              onClick={() => handleSetManualStatus({ safarNames: selectedSafars }, 'submitted')}
              title="Manually mark all deliverables in selected Safars as Submitted to AlJamea"
            >
              <PageIcon pageKey="landmark" size={13} color="#10B981" style={{ marginRight: 6 }} /> Mark as Submitted
            </button>
            <button
              className="batch-action-btn batch-auto"
              onClick={() => handleSetManualStatus({ safarNames: selectedSafars }, 'auto')}
              title="Reset selected Safars to automatic file-system detection"
            >
              <PageIcon pageKey="bolt" size={13} color="#F59E0B" style={{ marginRight: 6 }} /> Reset to Auto
            </button>
            <button
              className="batch-action-btn batch-clear"
              onClick={handleClearSelection}
              title="Deselect all"
            >
              <PageIcon pageKey="cross" size={11} style={{ marginRight: 5 }} /> Clear
            </button>
          </div>
        </div>
      )}

      {/* ── 5. View Mode: Safar Groups Accordion ── */}
      {viewMode === 'safar' && (
        <div className="tracker-safars-container">
          {filteredSafars.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                <PageIcon pageKey="folder_open" size={42} color="#64748B" />
              </div>
              <h3 style={{ margin: '0 0 6px 0', color: '#E2E8F0' }}>No Safars Discovered</h3>
              <p style={{ margin: 0, fontSize: '13px' }}>
                Please select your Main Working Directory above to start automatic tracking.
              </p>
            </div>
          ) : (
            filteredSafars.map(safar => {
              const isCollapsed = collapsedSafars[safar.safarName]
              const isSelected = selectedSafars.includes(safar.safarName)
              const pct = safar.totalDays > 0 ? Math.round((safar.completedDays / safar.totalDays) * 100) : 0

              return (
                <div key={safar.safarName} className={`safar-card ${safar.isSafarDone ? 'done' : ''} ${isSelected ? 'selected' : ''}`}>
                  {/* Card Header */}
                  <div className="safar-card-header">
                    <div className="safar-info-left">
                      {/* Safar Selection Checkbox */}
                      <label
                        className="safar-checkbox-label"
                        onClick={e => e.stopPropagation()}
                        title={isSelected ? 'Deselect this Safar' : 'Select this Safar'}
                      >
                        <input
                          type="checkbox"
                          className="safar-checkbox-input"
                          checked={isSelected}
                          onChange={() => toggleSelectSafar(safar.safarName)}
                        />
                        <span className="safar-checkbox-custom" />
                      </label>

                      <div
                        className="safar-folder-icon"
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                        onClick={() => toggleCollapse(safar.safarName)}
                      >
                        {safar.isSafarDone ? (
                          <PageIcon pageKey="trophy" size={20} color="#F59E0B" />
                        ) : (
                          <PageIcon pageKey="folder" size={20} color="var(--accent, #6366F1)" />
                        )}
                      </div>
                      <div>
                        <div className="safar-title-row">
                          <h3
                            className="safar-name"
                            style={{ cursor: 'pointer' }}
                            onClick={() => toggleCollapse(safar.safarName)}
                          >
                            {safar.safarName}
                          </h3>
                          {safar.city && safar.city !== 'Unassigned' && (
                            <span className="safar-city-chip">
                              <PageIcon pageKey="pin" size={11} style={{ marginRight: 4 }} />
                              {safar.city}
                            </span>
                          )}
                          {safar.safarSerial && (
                            <span className="safar-serial-chip">#{safar.safarSerial}</span>
                          )}
                          {safar.currentDrive && (
                            <span className="safar-drive-chip">
                              <PageIcon pageKey="drive" size={11} style={{ marginRight: 4 }} />
                              {safar.currentDrive}
                            </span>
                          )}
                          {safar.isDriveConnected === false && (
                            <span className="safar-offline-chip" title="Drive is disconnected. All task history & progress remain preserved in SQLite.">
                              <PageIcon pageKey="drive" size={11} style={{ marginRight: 4 }} />
                              Drive Disconnected
                            </span>
                          )}
                          {safar.isDriveConnected !== false && safar.isPathExists === false && (
                            <span className="safar-offline-chip moved" title="Folder was moved or completed. Retained in DB.">
                              <PageIcon pageKey="package" size={11} style={{ marginRight: 4 }} />
                              Stored in DB
                            </span>
                          )}
                          {safar.manualStatus ? (
                            <span
                              className="safar-manual-badge"
                              title="Deliverables manually marked. Click 'Auto' in header actions to revert to file tracking."
                            >
                              <PageIcon pageKey="user" size={11} style={{ marginRight: 4 }} />
                              Manual: {safar.manualStatus === 'submitted' ? 'Submitted' : 'Uploaded'}
                            </span>
                          ) : (
                            <span
                              className="safar-auto-badge"
                              title="Tracked automatically from disk."
                            >
                              <PageIcon pageKey="bolt" size={11} color="#10B981" style={{ marginRight: 4 }} />
                              Auto Tracked
                            </span>
                          )}
                          {safar.isSafarDone && (
                            <span className="safar-done-badge">
                              <PageIcon pageKey="sparkles" size={11} color="#10B981" style={{ marginRight: 4 }} />
                              100% SAFAR COMPLETED (All dates in Final)
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="safar-progress-bar-wrap">
                          <div className="safar-progress-track">
                            <div className="safar-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="safar-progress-text">
                            {safar.completedDays} of {safar.totalDays} Days Done ({pct}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="safar-header-actions">
                      <div className="safar-quick-mark-group">
                        <button
                          className="safar-action-btn mark-upload"
                          onClick={() => handleSetManualStatus({ safarNames: [safar.safarName] }, 'uploaded')}
                          title="Manually mark all deliverables in this Safar as Uploaded"
                        >
                          <PageIcon pageKey="check_circle" size={12} color="#34D399" style={{ marginRight: 4 }} />
                          Mark Uploaded
                        </button>
                        <button
                          className="safar-action-btn mark-submit"
                          onClick={() => handleSetManualStatus({ safarNames: [safar.safarName] }, 'submitted')}
                          title="Manually mark all deliverables in this Safar as Submitted to AlJamea"
                        >
                          <PageIcon pageKey="landmark" size={12} color="#10B981" style={{ marginRight: 4 }} />
                          Mark Submitted
                        </button>
                        {(safar.manualStatus || (safar.tasks || []).some(t => t.manualStatus)) && (
                          <button
                            className="safar-action-btn reset-auto"
                            onClick={() => handleSetManualStatus({ safarNames: [safar.safarName] }, 'auto')}
                            title="Reset this Safar to automatic file-system detection"
                          >
                            <PageIcon pageKey="bolt" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                            Auto
                          </button>
                        )}
                      </div>

                      <button
                        className="safar-action-btn move-safar-btn"
                        onClick={() => { playTick(); setMoveModalSafar(safar) }}
                        title="Move this Safar between In Process, To Upload, To Delete, or Pending"
                        disabled={safar.isPathExists === false}
                      >
                        <PageIcon pageKey="package" size={12} style={{ marginRight: 4 }} />
                        Move
                      </button>
                      <button
                        className="safar-action-btn create-all-prproj"
                        onClick={() => handleGenerateSafarProjects(safar)}
                        disabled={generatingSafars[safar.safarName] || safar.isPathExists === false}
                        title="Generate Premiere Pro project files (.prproj & .xml) for all dates in this Safar (Master Data Mode)"
                      >
                        {generatingSafars[safar.safarName] ? (
                          <>
                            <PageIcon pageKey="clock" size={12} style={{ marginRight: 4 }} /> Creating...
                          </>
                        ) : (
                          <>
                            <PageIcon pageKey="prproj" size={13} style={{ marginRight: 4 }} /> Batch .prproj
                          </>
                        )}
                      </button>
                      <button
                        className="safar-action-btn open-prproj-page-btn"
                        onClick={() => handleNavigateToPrproj(safar)}
                        disabled={safar.isPathExists === false}
                        title="Open Premiere Pro Project Generator page with this Safar's folder pre-loaded"
                      >
                        <PageIcon pageKey="prproj" size={13} style={{ marginRight: 4 }} />
                        Open in Generator
                      </button>
                      <button
                        className="safar-action-btn"
                        onClick={() => handleCopyWhatsApp(safar)}
                        title="Copy clean WhatsApp status report"
                      >
                        <PageIcon pageKey="file_text" size={12} style={{ marginRight: 4 }} />
                        Copy WhatsApp
                      </button>
                      <button
                        className="safar-action-btn"
                        onClick={() => handleOpenFolder(safar.currentPath, safar.isDriveConnected !== false && safar.isPathExists !== false)}
                        title={safar.isPathExists === false ? 'Drive offline or folder moved' : 'Open in Explorer'}
                        style={safar.isPathExists === false || safar.isDriveConnected === false ? { opacity: 0.6 } : undefined}
                      >
                        <PageIcon pageKey="folder_open" size={12} style={{ marginRight: 4 }} />
                        Explorer
                      </button>
                      <button
                        className="safar-action-btn"
                        onClick={() => toggleCollapse(safar.safarName)}
                      >
                        {isCollapsed ? '▼ Show Dates' : '▲ Collapse'}
                      </button>
                    </div>
                  </div>

                  {/* Dates List */}
                  {!isCollapsed && (
                    <div className="safar-dates-list">
                      {(safar.filteredTasks || safar.tasks || []).map(task => {
                        const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.editing_pending
                        const currentStep = cfg.stepIndex
                        const renderedTs = formatTimestamp(task.renderedAt)
                        const uploadedTs = formatTimestamp(task.uploadedAt)
                        const submittedTs = formatTimestamp(task.submittedAt)

                        return (
                          <div key={task.dateFolder} className="date-item-row">
                            {/* Col 1: Date Name & Visual Milestone Stepper */}
                            <div className="date-item-name-col">
                              <span className="date-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <PageIcon pageKey={cfg.icon} size={15} color={cfg.color} />
                              </span>
                              <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    className="date-name clickable"
                                    onClick={() => handleDateClick(task, safar.currentPath)}
                                    title={
                                      task.prprojPath
                                        ? `Click to open ${task.dateFolder}.prproj in Premiere Pro`
                                        : `Click to generate ${task.dateFolder}.prproj & .xml sequence (Single Mode)`
                                    }
                                  >
                                    {task.dateFolder}
                                  </span>
                                  {task.currentDrive && (
                                    <span className="date-drive-badge">
                                      {task.currentDrive.replace(/\\$/, '')}
                                    </span>
                                  )}
                                  {task.isDriveConnected === false && (
                                    <span className="date-offline-chip" title="Drive disconnected">
                                      <PageIcon pageKey="drive" size={10} style={{ marginRight: 3 }} />
                                      Offline
                                    </span>
                                  )}
                                </div>

                                {/* Visual Milestone Stepper */}
                                <div className="stepper-progress-line">
                                  <div className={`stepper-node ${currentStep >= 1 ? 'passed' : ''}`}>
                                    <span className="stepper-dot" />
                                    <span>Raw</span>
                                  </div>
                                  <div className={`stepper-connector ${currentStep >= 2 ? 'passed' : ''}`} />
                                  <div className={`stepper-node ${currentStep === 2 ? 'active' : currentStep > 2 ? 'passed' : ''}`}>
                                    <span className="stepper-dot" />
                                    <span>Edit</span>
                                  </div>
                                  <div className={`stepper-connector ${currentStep >= 3 ? 'passed' : ''}`} />
                                  <div className={`stepper-node ${currentStep === 3 ? 'active' : currentStep > 3 ? 'passed' : ''}`}>
                                    <span className="stepper-dot" />
                                    <span>Review</span>
                                  </div>
                                  <div className={`stepper-connector ${currentStep >= 4 ? 'passed' : ''}`} />
                                  <div className={`stepper-node ${currentStep === 4 ? 'active' : currentStep > 4 ? 'passed' : ''}`}>
                                    <span className="stepper-dot" />
                                    <span>Final</span>
                                  </div>
                                  <div className={`stepper-connector ${currentStep >= 5 ? 'passed' : ''}`} />
                                  <div className={`stepper-node ${currentStep === 5 ? 'active' : currentStep > 5 ? 'passed' : ''}`}>
                                    <span className="stepper-dot" />
                                    <span>Upload</span>
                                  </div>
                                  <div className={`stepper-connector ${currentStep >= 6 ? 'passed' : ''}`} />
                                  <div className={`stepper-node ${currentStep === 6 ? 'active' : ''}`}>
                                    <span className="stepper-dot" />
                                    <span>AlJamea</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Status Badge */}
                            <div className="date-status-badge-wrap">
                              <span className={`status-badge ${task.status}`}>
                                <span className="status-dot" />
                                {cfg.label}
                              </span>
                              {task.manualStatus ? (
                                <span
                                  className="date-manual-pill"
                                  title="Deliverable status was manually overridden. Click to reset to Auto."
                                >
                                  <PageIcon pageKey="user" size={10} style={{ marginRight: 3 }} />
                                  Manual
                                </span>
                              ) : (
                                <span
                                  className="date-auto-pill"
                                  title="Deliverable status is auto-detected from drive folders."
                                >
                                  <PageIcon pageKey="bolt" size={10} color="#10B981" style={{ marginRight: 3 }} />
                                  Auto
                                </span>
                              )}
                            </div>

                            {/* Col 3: Timestamps & Metrics */}
                            <div className="date-timestamps-col">
                              {renderedTs ? (
                                <span className="ts-row">
                                  <PageIcon pageKey="sparkles" size={11} color="#60A5FA" style={{ marginRight: 3 }} />
                                  Rendered:{' '}
                                  <strong>
                                    {renderedTs} ({task.renderVideoCount || 0} vids · {formatBytes(task.renderSizeBytes)})
                                  </strong>
                                </span>
                              ) : (
                                <span className="ts-row" style={{ opacity: 0.6 }}>
                                  <PageIcon pageKey="sparkles" size={11} style={{ marginRight: 3 }} />
                                  Rendered: <em>Awaiting Final render</em>
                                </span>
                              )}

                              {uploadedTs && (
                                <span className="ts-row">
                                  <PageIcon pageKey="upload" size={11} color="#34D399" style={{ marginRight: 3 }} />
                                  Uploaded: <strong>{uploadedTs}</strong>
                                </span>
                              )}

                              {submittedTs && (
                                <span className="ts-row">
                                  <PageIcon pageKey="landmark" size={11} color="#10B981" style={{ marginRight: 3 }} />
                                  Submitted to AlJamea: <strong>{submittedTs}</strong>
                                </span>
                              )}
                            </div>

                            {/* Col 4: Actions */}
                            <div className="date-actions-col">
                              {task.status !== 'uploaded' && (
                                <button
                                  className="icon-action-btn mark-status-btn upload"
                                  onClick={() => handleSetManualStatus({ taskKeys: [{ safarName: task.safarName, dateFolder: task.dateFolder }] }, 'uploaded')}
                                  title="Mark this date deliverable as Uploaded"
                                >
                                  <PageIcon pageKey="check_circle" size={13} color="#34D399" />
                                </button>
                              )}
                              {task.status !== 'submitted' && (
                                <button
                                  className="icon-action-btn mark-status-btn submit"
                                  onClick={() => handleSetManualStatus({ taskKeys: [{ safarName: task.safarName, dateFolder: task.dateFolder }] }, 'submitted')}
                                  title="Mark this date deliverable as Submitted to AlJamea"
                                >
                                  <PageIcon pageKey="landmark" size={13} color="#10B981" />
                                </button>
                              )}
                              {task.manualStatus && (
                                <button
                                  className="icon-action-btn mark-status-btn auto"
                                  onClick={() => handleSetManualStatus({ taskKeys: [{ safarName: task.safarName, dateFolder: task.dateFolder }] }, 'auto')}
                                  title="Reset this date deliverable to Auto file tracking"
                                >
                                  <PageIcon pageKey="bolt" size={13} color="#F59E0B" />
                                </button>
                              )}
                              {task.prprojPath ? (
                                <button
                                  className="icon-action-btn prproj-btn ready"
                                  onClick={() => handleOpenPrproj(task.prprojPath, task.isDriveConnected !== false)}
                                  title={`Open Premiere Project: ${task.dateFolder}.prproj`}
                                >
                                  <PageIcon pageKey="prproj" size={13} />
                                </button>
                              ) : (
                                <button
                                  className={`icon-action-btn prproj-btn create ${generatingTasks[`${task.safarName}-${task.dateFolder}`] ? 'spinning' : ''}`}
                                  onClick={() => handleGenerateSingleProject(task, safar.currentPath)}
                                  disabled={generatingTasks[`${task.safarName}-${task.dateFolder}`]}
                                  title={`Create Premiere Project & XML sequence for ${task.dateFolder} (Single Mode)`}
                                >
                                  {generatingTasks[`${task.safarName}-${task.dateFolder}`] ? (
                                    <PageIcon pageKey="clock" size={13} />
                                  ) : (
                                    <PageIcon pageKey="prproj" size={13} />
                                  )}
                                </button>
                              )}
                              <button
                                className="icon-action-btn"
                                onClick={() => handleOpenFolder(task.finalPath || task.workingPath)}
                                title="Open Folder in Explorer"
                              >
                                <PageIcon pageKey="folder_open" size={13} />
                              </button>
                              <button
                                className="icon-action-btn"
                                onClick={() => handleOpenInspect(task)}
                                title="Inspect Details & Timeline"
                              >
                                <PageIcon pageKey="search" size={13} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── 6. View Mode: Pipeline Kanban Board ── */}
      {viewMode === 'pipeline' && (
        <div className="tracker-board-grid">
          {STATUS_ORDER.map(st => {
            const colTasks = driveFilteredTasks.filter(t => t.status === st)
            const cfg = STATUS_CONFIG[st]

            return (
              <div key={st} className={`board-col col-${st}`}>
                <div className="board-col-header">
                  <span className="board-col-title" style={{ color: cfg.color, display: 'inline-flex', alignItems: 'center' }}>
                    <PageIcon pageKey={cfg.icon} size={14} color={cfg.color} style={{ marginRight: 6 }} />
                    {cfg.label}
                  </span>
                  <span className="board-col-count">{colTasks.length}</span>
                </div>

                <div className="board-col-cards">
                  {colTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748B', fontSize: '11px' }}>
                      No tasks in this stage
                    </div>
                  ) : (
                    colTasks.map(t => (
                      <div key={`${t.safarName}-${t.dateFolder}`} className="board-task-card">
                        <span className="board-card-safar" title={t.safarName}>
                          {t.safarName}
                        </span>
                        <span
                          className="board-card-date clickable"
                          onClick={() => handleDateClick(t, t.workingPath)}
                          title={
                            t.prprojPath
                              ? `Click to open ${t.dateFolder}.prproj in Premiere Pro`
                              : `Click to generate ${t.dateFolder}.prproj & .xml sequence (Single Mode)`
                          }
                        >
                          {t.dateFolder}
                        </span>

                        {t.renderedAt && (
                          <span style={{ fontSize: '11px', color: '#94A3B8', display: 'inline-flex', alignItems: 'center' }}>
                            <PageIcon pageKey="sparkles" size={11} color="#94A3B8" style={{ marginRight: 3 }} />
                            {formatTimestamp(t.renderedAt)}
                          </span>
                        )}

                        <div className="board-card-footer">
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            {t.renderVideoCount ? `${t.renderVideoCount} vids · ${formatBytes(t.renderSizeBytes)}` : '0 vids'}
                          </span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {t.prprojPath ? (
                              <button
                                className="icon-action-btn prproj-btn ready"
                                style={{ width: '26px', height: '26px', fontSize: '12px' }}
                                onClick={() => handleOpenPrproj(t.prprojPath, t.isDriveConnected !== false)}
                                title={`Open Premiere Project: ${t.dateFolder}.prproj`}
                              >
                                <PageIcon pageKey="prproj" size={12} />
                              </button>
                            ) : (
                              <button
                                className={`icon-action-btn prproj-btn create ${generatingTasks[`${t.safarName}-${t.dateFolder}`] ? 'spinning' : ''}`}
                                style={{ width: '26px', height: '26px', fontSize: '12px' }}
                                onClick={() => handleGenerateSingleProject(t, t.workingPath)}
                                disabled={generatingTasks[`${t.safarName}-${t.dateFolder}`]}
                                title={`Create Premiere Project & XML sequence for ${t.dateFolder} (Single Mode)`}
                              >
                                {generatingTasks[`${t.safarName}-${t.dateFolder}`] ? (
                                  <PageIcon pageKey="clock" size={12} />
                                ) : (
                                  <PageIcon pageKey="prproj" size={12} />
                                )}
                              </button>
                            )}
                            <button
                              className="icon-action-btn"
                              style={{ width: '26px', height: '26px', fontSize: '12px' }}
                              onClick={() => handleOpenInspect(t)}
                              title="Inspect Details"
                            >
                              <PageIcon pageKey="search" size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 7. View Mode: Studio Data Table ── */}
      {viewMode === 'table' && (
        <div className="tracker-table-container">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>Safar</th>
                <th>Date Folder</th>
                <th>Status</th>
                <th>Rendered (Final)</th>
                <th>Uploaded (SSD)</th>
                <th>Submitted (AlJamea)</th>
                <th>Videos</th>
                <th>Size</th>
                <th>Drive</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {driveFilteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                    No dates discovered yet.
                  </td>
                </tr>
              ) : (
                driveFilteredTasks.map(t => {
                  const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.editing_pending
                  return (
                    <tr key={`${t.safarName}-${t.dateFolder}`}>
                      <td style={{ fontWeight: 700 }}>{t.safarName}</td>
                      <td
                        className="clickable-date-cell"
                        onClick={() => handleDateClick(t, t.workingPath)}
                        title={
                          t.prprojPath
                            ? `Click to open ${t.dateFolder}.prproj in Premiere Pro`
                            : `Click to generate ${t.dateFolder}.prproj & .xml sequence (Single Mode)`
                        }
                      >
                        <span style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--accent, #6366F1)' }}>
                          {t.dateFolder}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${t.status}`}>
                          <span className="status-dot" />
                          {cfg.label}
                        </span>
                      </td>
                      <td>{formatTimestamp(t.renderedAt) || '—'}</td>
                      <td>{formatTimestamp(t.uploadedAt) || '—'}</td>
                      <td>{formatTimestamp(t.submittedAt) || '—'}</td>
                      <td>{t.renderVideoCount || 0}</td>
                      <td>{formatBytes(t.renderSizeBytes)}</td>
                      <td>
                        <span className="date-drive-badge">{t.currentDrive?.replace(/\\$/, '') || '—'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                          {t.status !== 'uploaded' && (
                            <button
                              className="icon-action-btn"
                              style={{ width: '26px', height: '26px' }}
                              onClick={() => handleSetManualStatus({ taskKeys: [{ safarName: t.safarName, dateFolder: t.dateFolder }] }, 'uploaded')}
                              title="Mark as Uploaded"
                            >
                              <PageIcon pageKey="check_circle" size={13} color="#34D399" />
                            </button>
                          )}
                          {t.status !== 'submitted' && (
                            <button
                              className="icon-action-btn"
                              style={{ width: '26px', height: '26px' }}
                              onClick={() => handleSetManualStatus({ taskKeys: [{ safarName: t.safarName, dateFolder: t.dateFolder }] }, 'submitted')}
                              title="Mark as Submitted"
                            >
                              <PageIcon pageKey="landmark" size={13} color="#10B981" />
                            </button>
                          )}
                          {t.manualStatus && (
                            <button
                              className="icon-action-btn"
                              style={{ width: '26px', height: '26px' }}
                              onClick={() => handleSetManualStatus({ taskKeys: [{ safarName: t.safarName, dateFolder: t.dateFolder }] }, 'auto')}
                              title="Reset to Auto"
                            >
                              <PageIcon pageKey="bolt" size={13} color="#F59E0B" />
                            </button>
                          )}
                          {t.prprojPath ? (
                            <button
                              className="icon-action-btn prproj-btn ready"
                              style={{ width: '28px', height: '28px' }}
                              onClick={() => handleOpenPrproj(t.prprojPath, t.isDriveConnected !== false)}
                              title={`Open Premiere Project: ${t.dateFolder}.prproj`}
                            >
                              <PageIcon pageKey="prproj" size={13} />
                            </button>
                          ) : (
                            <button
                              className={`icon-action-btn prproj-btn create ${generatingTasks[`${t.safarName}-${t.dateFolder}`] ? 'spinning' : ''}`}
                              style={{ width: '28px', height: '28px' }}
                              onClick={() => handleGenerateSingleProject(t, t.workingPath)}
                              disabled={generatingTasks[`${t.safarName}-${t.dateFolder}`]}
                              title={`Create Premiere Project & XML sequence for ${t.dateFolder} (Single Mode)`}
                            >
                              {generatingTasks[`${t.safarName}-${t.dateFolder}`] ? (
                                <PageIcon pageKey="clock" size={13} />
                              ) : (
                                <PageIcon pageKey="prproj" size={13} />
                              )}
                            </button>
                          )}
                          <button
                            className="icon-action-btn"
                            style={{ width: '28px', height: '28px' }}
                            onClick={() => handleOpenFolder(t.finalPath || t.workingPath)}
                            title="Open in Explorer"
                          >
                            <PageIcon pageKey="folder_open" size={13} />
                          </button>
                          <button
                            className="icon-action-btn"
                            style={{ width: '28px', height: '28px' }}
                            onClick={() => handleOpenInspect(t)}
                            title="Inspect Details"
                          >
                            <PageIcon pageKey="search" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 8. Task Detail Inspector Modal ── */}
      {inspectTask && (
        <Modal
          show={!!inspectTask}
          title={`Task Inspector — ${inspectTask.dateFolder}`}
          icon="search"
          confirmText="Close"
          onConfirm={() => setInspectTask(null)}
          onClose={() => setInspectTask(null)}
        >
          <div className="detail-drawer-content">
            <div className="detail-section-box">
              <span className="detail-section-title">Safar & Date Identity</span>
              <div className="detail-row">
                <span>Safar Name:</span>
                <strong>{inspectTask.safarName}</strong>
              </div>
              <div className="detail-row">
                <span>Date Folder:</span>
                <strong>{inspectTask.dateFolder}</strong>
              </div>
              <div className="detail-row">
                <span>Current Status:</span>
                <span className={`status-badge ${inspectTask.status}`}>
                  <span className="status-dot" />
                  {STATUS_CONFIG[inspectTask.status]?.label}
                </span>
              </div>
              <div className="detail-row">
                <span>Current Drive:</span>
                <strong>{inspectTask.currentDrive || 'Local'}</strong>
              </div>
            </div>

            {/* Lifecycle Status Control & Override */}
            <div className="detail-section-box">
              <span className="detail-section-title">Tracking Mode & Status Override</span>
              <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>
                Current Mode:{' '}
                {inspectTask.manualStatus ? (
                  <strong style={{ color: '#F59E0B', display: 'inline-flex', alignItems: 'center' }}>
                    <PageIcon pageKey="user" size={12} style={{ marginRight: 4 }} />
                    Manual ({inspectTask.manualStatus === 'submitted' ? 'Submitted to AlJamea' : 'Uploaded'})
                  </strong>
                ) : (
                  <strong style={{ color: '#10B981', display: 'inline-flex', alignItems: 'center' }}>
                    <PageIcon pageKey="bolt" size={12} color="#10B981" style={{ marginRight: 4 }} />
                    Auto File-System Tracking
                  </strong>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className={`btn-choice-status ${inspectTask.status === 'uploaded' ? 'active-upload' : ''}`}
                  onClick={() => {
                    handleSetManualStatus({ taskKeys: [{ safarName: inspectTask.safarName, dateFolder: inspectTask.dateFolder }] }, 'uploaded')
                    setInspectTask(prev => prev ? { ...prev, status: 'uploaded', manualStatus: 'uploaded', isManual: true } : null)
                  }}
                  title="Manually force status to Uploaded"
                >
                  <PageIcon pageKey="check_circle" size={13} color="#34D399" style={{ marginRight: 6 }} /> Mark as Uploaded
                </button>
                <button
                  className={`btn-choice-status ${inspectTask.status === 'submitted' ? 'active-submit' : ''}`}
                  onClick={() => {
                    handleSetManualStatus({ taskKeys: [{ safarName: inspectTask.safarName, dateFolder: inspectTask.dateFolder }] }, 'submitted')
                    setInspectTask(prev => prev ? { ...prev, status: 'submitted', manualStatus: 'submitted', isManual: true } : null)
                  }}
                  title="Manually force status to Submitted (AlJamea)"
                >
                  <PageIcon pageKey="landmark" size={13} color="#10B981" style={{ marginRight: 6 }} /> Mark as Submitted
                </button>
                {inspectTask.manualStatus && (
                  <button
                    className="btn-choice-status reset-auto"
                    onClick={() => {
                      handleSetManualStatus({ taskKeys: [{ safarName: inspectTask.safarName, dateFolder: inspectTask.dateFolder }] }, 'auto')
                      setInspectTask(prev => prev ? { ...prev, manualStatus: null, isManual: false } : null)
                    }}
                    title="Reset to automatic file-system detection"
                  >
                    <PageIcon pageKey="bolt" size={13} color="#F59E0B" style={{ marginRight: 6 }} /> Reset to Auto
                  </button>
                )}
              </div>
            </div>

            <div className="detail-section-box">
              <span className="detail-section-title">Directory Path Correlations</span>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Working Path:</div>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', color: '#0F172A' }}>
                {inspectTask.workingPath || '—'}
              </div>

              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>Final Output Path:</div>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', color: inspectTask.finalPath ? '#0284C7' : '#94A3B8' }}>
                {inspectTask.finalPath || 'Not found in Final/ yet'}
              </div>

              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>To Upload Location:</div>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', color: inspectTask.uploadPath ? '#059669' : '#94A3B8' }}>
                {inspectTask.uploadPath || 'Not in To Upload yet'}
              </div>

              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>To Delete Location (Submitted):</div>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', color: inspectTask.deletePath ? '#10B981' : '#94A3B8' }}>
                {inspectTask.deletePath || 'Not submitted yet'}
              </div>
            </div>

            <div className="detail-section-box">
              <span className="detail-section-title">Timestamps & Metrics</span>
              <div className="detail-row">
                <span>Rendered At:</span>
                <strong>{formatTimestamp(inspectTask.renderedAt) || 'Pending'}</strong>
              </div>
              <div className="detail-row">
                <span>Uploaded At:</span>
                <strong>{formatTimestamp(inspectTask.uploadedAt) || 'Pending'}</strong>
              </div>
              <div className="detail-row">
                <span>Submitted At:</span>
                <strong>{formatTimestamp(inspectTask.submittedAt) || 'Pending'}</strong>
              </div>
              <div className="detail-row">
                <span>Rendered Videos:</span>
                <strong>{inspectTask.renderVideoCount || 0} clips</strong>
              </div>
              <div className="detail-row">
                <span>Total Render Size:</span>
                <strong>{formatBytes(inspectTask.renderSizeBytes)}</strong>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="detail-section-box">
              <span className="detail-section-title">Audit History Timeline</span>
              {historyLogs.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748B' }}>No transitions recorded yet.</div>
              ) : (
                historyLogs.map(h => (
                  <div key={h.id} style={{ display: 'flex', gap: '10px', fontSize: '11px', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px' }}>
                    <span style={{ color: '#64748B', fontFamily: 'monospace' }}>
                      {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: '#0F172A' }}>{h.description}</span>
                  </div>
                ))
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
              {inspectTask.prprojPath && (
                <button
                  className="btn-primary-action"
                  onClick={() => handleOpenPrproj(inspectTask.prprojPath)}
                >
                  <PageIcon pageKey="prproj" size={13} style={{ marginRight: 6 }} /> Open .prproj
                </button>
              )}
              <button
                className="btn-secondary-action"
                onClick={() => handleOpenFolder(inspectTask.finalPath || inspectTask.workingPath)}
              >
                <PageIcon pageKey="folder_open" size={13} style={{ marginRight: 6 }} /> Open Folder
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Move Safar Modal */}
      {moveModalSafar && (
        <Modal
          isOpen={true}
          onClose={() => !isMoving && setMoveModalSafar(null)}
          title={`Move Safar: ${moveModalSafar.safarName}`}
        >
          <div className="move-safar-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
              <div style={{ color: '#64748B', marginBottom: '4px', fontWeight: 600 }}>CURRENT PHYSICAL PATH:</div>
              <div style={{ fontFamily: 'monospace', color: '#0F172A', wordBreak: 'break-all' }}>
                {moveModalSafar.currentPath || 'Unknown Path'}
              </div>
            </div>

            <div style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
              Select target destination folder on disk:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                className="btn-choice-status"
                style={{ background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1D4ED8', padding: '14px', borderRadius: '8px', cursor: isMoving ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}
                onClick={() => handleMoveSafar('in_process')}
                disabled={isMoving}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                  <PageIcon pageKey="refresh" size={14} style={{ marginRight: 6 }} /> In Process
                </div>
                <div style={{ fontSize: '11px', color: '#3B82F6' }}>Active editing directory</div>
              </button>

              <button
                className="btn-choice-status"
                style={{ background: '#F0FDF4', borderColor: '#BBF7D0', color: '#15803D', padding: '14px', borderRadius: '8px', cursor: isMoving ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}
                onClick={() => handleMoveSafar('to_upload')}
                disabled={isMoving}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                  <PageIcon pageKey="upload" size={14} style={{ marginRight: 6 }} /> To Upload
                </div>
                <div style={{ fontSize: '11px', color: '#16A34A' }}>Ready for SSD distribution</div>
              </button>

              <button
                className="btn-choice-status"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C', padding: '14px', borderRadius: '8px', cursor: isMoving ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}
                onClick={() => handleMoveSafar('to_delete')}
                disabled={isMoving}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                  <PageIcon pageKey="trash" size={14} style={{ marginRight: 6 }} /> To Delete
                </div>
                <div style={{ fontSize: '11px', color: '#DC2626' }}>Submitted & ready to purge</div>
              </button>

              <button
                className="btn-choice-status"
                style={{ background: '#FFFBEB', borderColor: '#FDE68A', color: '#B45309', padding: '14px', borderRadius: '8px', cursor: isMoving ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}
                onClick={() => handleMoveSafar('pending')}
                disabled={isMoving}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                  <PageIcon pageKey="clock" size={14} style={{ marginRight: 6 }} /> Pending
                </div>
                <div style={{ fontSize: '11px', color: '#D97706' }}>Raw files awaiting assignment</div>
              </button>
            </div>

            {isMoving && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', color: '#2563EB', fontSize: '13px', fontWeight: 600 }}>
                <span className="spinner-sm" /> Moving Safar folder and updating records...
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                className="btn-secondary-action"
                onClick={() => setMoveModalSafar(null)}
                disabled={isMoving}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
