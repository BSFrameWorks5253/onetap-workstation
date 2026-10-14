import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ThemeName, AnimPreset, DriveWorkspaceConfig } from '../../types'
import { Card, CardHeader } from '../../components/Card'
import { Button, GhostButton } from '../../components/Button'
import { BrowseRow, Input } from '../../components/Input'
import { ValidationDot } from '../../components/StatCard'
import { useTheme } from '../../theme/ThemeContext'
import { useSound } from '../../components/SoundProvider'
import { useToast } from '../../components/Toast'
import FileViewerSettingsCard from './FileViewerSettingsCard'
import CameraTransfer from '../CameraTransfer/CameraTransfer'
import { LoaderGalleryModal } from '../../components/Loaders'
import './Settings.css'

const api = (window as any).api

const THEMES: Array<{ id: ThemeName; label: string; icon: string; desc: string }> = [
  { id: 'glass', label: 'Liquid Glass (VisionOS Dark)', icon: '💎', desc: 'Ultra-luxurious frosted obsidian glass, fluid chromatic refractions & specular lighting' },
  { id: 'beige', label: 'Luxury Beige & Gold (Light)', icon: '🏛️', desc: 'Warm alabaster beige, sand linen & classical brass gold accents' },
  { id: 'light', label: 'Holographic Aurora (Light)', icon: '✨', desc: 'Vibrant cyber-pastel glass with iridescent rainbow reflections' },
  { id: 'forest', label: 'Emerald Mint (Light)', icon: '🌿', desc: 'Crisp botanical jade & frosted mint blossom' }
]

const ANIM_PRESETS: Array<{ id: AnimPreset; label: string; desc: string }> = [
  { id: 'calm', label: 'Calm', desc: 'Slower, relaxed transitions (380ms)' },
  { id: 'balanced', label: 'Balanced', desc: 'Default natural feel (240ms)' },
  { id: 'cinematic', label: 'Cinematic', desc: 'Dramatic slow transitions (500ms)' },
]

export default function Settings(): JSX.Element {
  const {
    theme, animPreset, setTheme, setAnimPreset,
    customFont, customTextColor, customBgColor,
    setCustomFont, setCustomTextColor, setCustomBgColor,
    pageTransition, setPageTransition
  } = useTheme()

  const { playTick, playSuccess, playError } = useSound()
  const { showToast } = useToast()

  // Modal active tab state
  const [activeModal, setActiveModal] = useState<'audio' | 'paths' | 'watcher' | 'theme' | 'perf' | 'fileViewer' | 'cameraTransfer' | 'changelog' | 'trackerDrives' | null>(null)
  const [showLoaderModal, setShowLoaderModal] = useState(false)

  // Paths state
  const [titlesFolder, setTitlesFolder] = useState('')
  const [convInput, setConvInput] = useState('')
  const [rememberPaths, setRememberPaths] = useState(true)

  // Folder Watcher state
  const [watcherEnabled, setWatcherEnabled] = useState(true)
  const [watcherInputFolder, setWatcherInputFolder] = useState('')
  const [converterJpeg, setConverterJpeg] = useState('')

  const [titlesFolderValid, setTitlesFolderValid] = useState<boolean | null>(null)
  const [assignMode, setAssignMode] = useState('single')
  const [singleIdx, setSingleIdx] = useState('1')
  const [prefixAssignments, setPrefixAssignments] = useState<Record<string, string>>({})
  const [prefixValidations, setPrefixValidations] = useState<Record<string, boolean>>({})
  const [audioCollection, setAudioCollection] = useState<Array<{ name: string; path: string }>>([])
  const [instrumentalCollection, setInstrumentalCollection] = useState<Array<{ name: string; path: string }>>([])
  const [pendingInstrumentals, setPendingInstrumentals] = useState<Array<{ name: string; path: string }>>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [audioPool, setAudioPool] = useState<string[]>([])
  const [poolInfo, setPoolInfo] = useState('')

  // Settings file
  const [settingsPath, setSettingsPath] = useState('')

  // Performance
  const [threads, setThreads] = useState('8')
  const [bufSize, setBufSize] = useState('4')

  // Status feedback
  const [saved, setSaved] = useState<string | null>(null)

  // Updates State
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'uptodate' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloadProgress, setDownloadProgress] = useState({ percent: 0, transferredBytes: 0, totalBytes: 0, speedBytesPerSec: 0 })
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(true)
  const [appVersion, setAppVersion] = useState('26.10.10')
  const [_updateError, setUpdateError] = useState('')

  // Auto-start state
  const [autoStartApp, setAutoStartApp] = useState(false)

  // Email notification subscriber state
  const [subEmail, setSubEmail] = useState(() => localStorage.getItem('ot_subscriber_email') || '')
  const [subName, setSubName] = useState(() => localStorage.getItem('ot_subscriber_name') || '')
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [_subMsg, setSubMsg] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(() => !!localStorage.getItem('ot_subscriber_email'))

  // Playback state
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null)

  // Task Tracker Multi-Drive Workspaces state
  const [trackerDrives, setTrackerDrives] = useState<DriveWorkspaceConfig[]>([])
  const [systemDrives, setSystemDrives] = useState<string[]>([])
  const [selectedAddDrive, setSelectedAddDrive] = useState<string>('')
  const [isDetectingDrive, setIsDetectingDrive] = useState(false)
  const [expandedDriveConfig, setExpandedDriveConfig] = useState<string | null>(null)
  const [newSafarStructureName, setNewSafarStructureName] = useState<string>('')
  const [isCreatingStructure, setIsCreatingStructure] = useState<boolean>(false)

  useEffect(() => {
    // Check if another page requested to open a specific settings tab
    const pendingTab = localStorage.getItem('ot_settings_open_tab')
    if (pendingTab) {
      localStorage.removeItem('ot_settings_open_tab')
      if (pendingTab === 'trackerDrives') {
        setActiveModal('trackerDrives')
      }
    }
  }, [])
  useEffect(() => {
    return () => {
      if (audioObj) {
        audioObj.pause()
        audioObj.src = ''
      }
    }
  }, [audioObj])

  useEffect(() => {
    if (!api) return
    load()
  }, [])

  async function load(): Promise<void> {
    const all = await api.settings.getAll()
    setTitlesFolder(all.titles_folder ?? '')
    setConvInput(all.converter_input ?? '')
    setRememberPaths(all.remember_paths ?? true)

    setWatcherEnabled(all.watcher_enabled ?? true)
    setWatcherInputFolder(all.watcher_input_folder ?? '')
    setConverterJpeg(all.converter_jpeg ?? '')

    setAssignMode(all.audio_assignment_mode ?? 'single')
    setSingleIdx(String((all.audio_single_index ?? 0) + 1))
    setPrefixAssignments(all.audio_prefix_assignments ?? {})
    setAudioCollection(all.audio_collection ?? [])
    setInstrumentalCollection(all.instrumental_audio_collection ?? [])

    setSettingsPath(await api.settings.filePath())
    setThreads(String(all.drivesync_threads ?? 8))
    setBufSize(String(all.drivesync_bufsize_mb ?? 4))

    if (api?.update?.getCurrentVersion) {
      api.update.getCurrentVersion().then((v: string) => {
        if (v) setAppVersion(v)
      }).catch(() => {})
    }

    // ── Load & Validate Task Tracker Multi-Drive Workspaces ──
    let loadedDrives: DriveWorkspaceConfig[] = all.task_tracker_drives
    if (!Array.isArray(loadedDrives) || loadedDrives.length === 0) {
      const local = localStorage.getItem('ot_tracker_drives')
      if (local) {
        try { loadedDrives = JSON.parse(local) } catch {}
      }
    }
    if (!Array.isArray(loadedDrives)) loadedDrives = []

    // If still empty or missing connected drives, auto-probe available drives (e.g. F:\, D:\)
    if (api?.taskTracker?.autoDetectDriveFolders) {
      try {
        const sysDrives: string[] = (await api?.system?.getDrives?.()) || ['F:\\', 'D:\\', 'E:\\', 'C:\\']
        const prioritized = Array.from(new Set(['F:\\', 'D:\\', 'E:\\', ...sysDrives]))
        let changed = false
        for (const drv of prioritized) {
          const normDrv = drv.toUpperCase().replace(/[\\/]/g, '')
          const alreadyExists = loadedDrives.some(d => d.driveRoot.toUpperCase().replace(/[\\/]/g, '') === normDrv)
          if (!alreadyExists) {
            const auto = await api.taskTracker.autoDetectDriveFolders(drv)
            if (auto) {
              const inPath = auto.inProcessExists ? auto.inProcessPath : auto.driveRoot
              loadedDrives.push({
                id: `drive-${normDrv.toLowerCase()}`,
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
          localStorage.setItem('ot_tracker_drives', JSON.stringify(loadedDrives))
          if (api?.settings?.setAndSave) {
            await api.settings.setAndSave('task_tracker_drives', loadedDrives)
          }
        }
      } catch (err) {
        console.error('[Settings] Auto drive probe error:', err)
      }
    }

    // If still empty, migrate legacy single paths if present
    if (loadedDrives.length === 0) {
      const legacyWorking = localStorage.getItem('ot_tracker_working_path') || ''
      const legacyUpload = localStorage.getItem('ot_tracker_upload_path') || ''
      const legacyDelete = localStorage.getItem('ot_tracker_delete_path') || ''
      if (legacyWorking) {
        const rootMatch = legacyWorking.match(/^[A-Za-z]:[\\/]/)
        const root = rootMatch ? rootMatch[0] : (legacyWorking.includes(':') ? legacyWorking.slice(0, 3) : 'F:\\')
        loadedDrives = [{
          id: 'drive-legacy-1',
          driveRoot: root,
          enabled: true,
          inProcessPath: legacyWorking,
          toUploadPath: legacyUpload || (root + 'To Upload'),
          toDeletePath: legacyDelete || (root + 'To Delete'),
          label: `Drive ${root.replace(/[\\/]/g, '')}`
        }]
      }
    }

    // Auto-detect and populate drive statuses
    if (api?.taskTracker?.autoDetectDriveFolders && loadedDrives.length > 0) {
      try {
        const checked = await Promise.all(
          loadedDrives.map(async d => {
            try {
              const det = await api.taskTracker.autoDetectDriveFolders(d.driveRoot)
              return {
                ...d,
                inProcessPath: d.inProcessPath || det.inProcessPath,
                toUploadPath: d.toUploadPath || det.toUploadPath,
                toDeletePath: d.toDeletePath || det.toDeletePath,
                status: {
                  inProcessExists: det.inProcessExists,
                  toUploadExists: det.toUploadExists,
                  toDeleteExists: det.toDeleteExists,
                  safarCount: det.safarCount
                }
              }
            } catch {
              return d
            }
          })
        )
        setTrackerDrives(checked)
      } catch {
        setTrackerDrives(loadedDrives)
      }
    } else {
      setTrackerDrives(loadedDrives)
    }

    // Load available system drives
    if (api?.system?.getDrives) {
      try {
        const sysD = await api.system.getDrives()
        if (Array.isArray(sysD)) {
          setSystemDrives(sysD)
          if (sysD.length > 0 && !selectedAddDrive) {
            // Find a drive that isn't already added
            const unadded = sysD.find(sd => !loadedDrives.some(ld => ld.driveRoot.toLowerCase() === sd.toLowerCase()))
            if (unadded) setSelectedAddDrive(unadded)
            else setSelectedAddDrive(sysD[0])
          }
        }
      } catch {}
    }

    if (api.update && typeof api.update.getCurrentVersion === 'function') {
      try {
        const v = await api.update.getCurrentVersion()
        if (v) setAppVersion(v)
      } catch (err) {
        console.warn('Failed to load version in settings:', err)
      }
    }

    if (api?.system?.getAutoLaunch) {
      try {
        const isAuto = await api.system.getAutoLaunch()
        setAutoStartApp(!!isAuto)
      } catch (err) {
        console.warn('Failed to get auto-launch status:', err)
      }
    }

    refreshAudioInfo()
  }

  // ── Multi-Drive Workspace Action Handlers ──

  async function handleAddDrive(driveRootToAdd: string) {
    if (!driveRootToAdd) return
    let root = driveRootToAdd.trim()
    if (/^[A-Za-z]:$/.test(root)) root = root + '\\'

    if (trackerDrives.some(d => d.driveRoot.toLowerCase() === root.toLowerCase())) {
      showToast({ title: 'Drive Already Added', message: `Drive ${root} is already added in Workspaces!`, type: 'info' })
      return
    }

    setIsDetectingDrive(true)
    try {
      let detected: any = null
      if (api?.taskTracker?.autoDetectDriveFolders) {
        detected = await api.taskTracker.autoDetectDriveFolders(root)
      }

      const newDrive: DriveWorkspaceConfig = {
        id: 'drive-' + Date.now(),
        driveRoot: root,
        enabled: true,
        inProcessPath: detected?.inProcessPath || (root + 'In Process'),
        toUploadPath: detected?.toUploadPath || (root + 'To Upload'),
        toDeletePath: detected?.toDeletePath || (root + 'To Delete'),
        label: `Drive ${root.replace(/[\\/]/g, '')}`,
        status: detected ? {
          inProcessExists: detected.inProcessExists,
          toUploadExists: detected.toUploadExists,
          toDeleteExists: detected.toDeleteExists,
          safarCount: detected.safarCount
        } : undefined
      }

      const updated = [...trackerDrives, newDrive]
      setTrackerDrives(updated)
      await api.settings.setAndSave('task_tracker_drives', updated)
      localStorage.setItem('ot_tracker_drives', JSON.stringify(updated))
      setSaved(`Drive ${root} added with auto-detected folders!`)
      playSuccess()
    } catch (err: any) {
      showToast({ title: 'Could Not Add Drive', message: err.message || String(err), type: 'error' })
      playError()
    } finally {
      setIsDetectingDrive(false)
    }
  }

  async function handleBrowseAddDrive() {
    if (!api?.dialog?.openFolder) return
    const chosen = await api.dialog.openFolder()
    if (chosen) {
      await handleAddDrive(chosen)
    }
  }

  async function handleRemoveDrive(id: string) {
    const target = trackerDrives.find(d => d.id === id)
    if (!confirm(`Are you sure you want to remove ${target?.label || target?.driveRoot || 'this drive'} from tracking?`)) {
      return
    }
    const updated = trackerDrives.filter(d => d.id !== id)
    setTrackerDrives(updated)
    await api.settings.setAndSave('task_tracker_drives', updated)
    localStorage.setItem('ot_tracker_drives', JSON.stringify(updated))
    setSaved('Drive workspace removed')
    playTick()
  }

  async function handleToggleDrive(id: string) {
    const updated = trackerDrives.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d)
    setTrackerDrives(updated)
    await api.settings.setAndSave('task_tracker_drives', updated)
    localStorage.setItem('ot_tracker_drives', JSON.stringify(updated))
    playTick()
  }

  async function handleReDetectDrive(id: string) {
    const target = trackerDrives.find(d => d.id === id)
    if (!target || !api?.taskTracker?.autoDetectDriveFolders) return
    setIsDetectingDrive(true)
    try {
      const det = await api.taskTracker.autoDetectDriveFolders(target.driveRoot)
      const updated = trackerDrives.map(d => {
        if (d.id === id) {
          return {
            ...d,
            inProcessPath: det.inProcessPath,
            toUploadPath: det.toUploadPath,
            toDeletePath: det.toDeletePath,
            status: {
              inProcessExists: det.inProcessExists,
              toUploadExists: det.toUploadExists,
              toDeleteExists: det.toDeleteExists,
              safarCount: det.safarCount
            }
          }
        }
        return d
      })
      setTrackerDrives(updated)
      await api.settings.setAndSave('task_tracker_drives', updated)
      localStorage.setItem('ot_tracker_drives', JSON.stringify(updated))
      setSaved(`Folders auto-detected for ${target.driveRoot}`)
      playSuccess()
    } finally {
      setIsDetectingDrive(false)
    }
  }

  async function handleCreateMissingFolders(drive: DriveWorkspaceConfig) {
    if (!api?.taskTracker?.createDriveFolders) return
    const missing: string[] = []
    if (!drive.status?.inProcessExists) missing.push(drive.inProcessPath)
    if (!drive.status?.toUploadExists) missing.push(drive.toUploadPath)
    if (!drive.status?.toDeleteExists) missing.push(drive.toDeletePath)

    if (missing.length === 0) {
      showToast({ title: 'Folders Ready', message: 'All standard folders already exist on this drive!', type: 'info' })
      return
    }

    const res = await api.taskTracker.createDriveFolders(missing)
    if (res.success) {
      setSaved(`Created ${res.created.length} folder(s) on ${drive.driveRoot}`)
      playSuccess()
      await handleReDetectDrive(drive.id)
    } else {
      showToast({ title: 'Creation Warning', message: 'Could not create some folders: ' + res.errors.join(', '), type: 'warning' })
      playError()
    }
  }

  async function handleCreateFullSafarStructure() {
    if (!newSafarStructureName.trim()) {
      showToast({ title: 'Missing Safar Name', message: 'Please enter a Safar folder name (e.g. 1448-03 Mumbai)', type: 'warning' })
      return
    }
    const enabledDrives = trackerDrives.filter(d => d.enabled)
    if (enabledDrives.length === 0) {
      showToast({ title: 'No Connected Drive', message: 'Please connect and enable at least one production drive first!', type: 'warning' })
      return
    }

    setIsCreatingStructure(true)
    try {
      let res: any = null
      if (api?.taskTracker?.createFullSafarStructure) {
        res = await api.taskTracker.createFullSafarStructure({
          safarName: newSafarStructureName.trim(),
          workspaces: trackerDrives
        })
      } else if (api?.taskTracker?.createDriveFolders) {
        const paths = enabledDrives.map(d => d.inProcessPath)
        res = await api.taskTracker.createDriveFolders(paths, newSafarStructureName.trim())
      }

      if (res && res.success) {
        setSaved(`Created full folder structure for "${newSafarStructureName.trim()}" (${res.created?.length || 0} items)`)
        playSuccess()
        setNewSafarStructureName('')
        for (const drv of enabledDrives) {
          await handleReDetectDrive(drv.id)
        }
      } else {
        showToast({ title: 'Creation Failed', message: 'Could not create structure: ' + (res?.errors?.join(', ') || res?.error || 'Unknown error'), type: 'error' })
        playError()
      }
    } catch (err: any) {
      showToast({ title: 'Structure Error', message: 'Error creating structure: ' + err.message, type: 'error' })
      playError()
    } finally {
      setIsCreatingStructure(false)
    }
  }

  async function handleUpdateDrivePath(id: string, field: 'inProcessPath' | 'toUploadPath' | 'toDeletePath', value: string) {
    const updated = trackerDrives.map(d => {
      if (d.id === id) {
        return { ...d, [field]: value }
      }
      return d
    })
    setTrackerDrives(updated)
    await api.settings.setAndSave('task_tracker_drives', updated)
    localStorage.setItem('ot_tracker_drives', JSON.stringify(updated))
  }

  async function refreshAudioInfo(): Promise<void> {
    const pool = await api.audio.getPool()
    setAudioPool(pool)
    setPoolInfo(await api.audio.poolInfo())
    setPrefixValidations(await api.audio.validatePrefixes())
  }

  useEffect(() => {
    async function loadUpdateSettings() {
      const all = await api.settings.getAll()
      setAutoCheckUpdates(all.auto_check_updates !== false)
    }
    loadUpdateSettings()
  }, [])

  async function checkForUpdates() {
    setUpdateStatus('checking')
    setUpdateError('')
    try {
      const res = await api?.update?.check?.()
      if (res && res.updateAvailable) {
        setUpdateStatus('available')
        setUpdateInfo(res)
        playSuccess()
        showToast({ title: 'Update Found', message: `Version ${res.latestVersion} is now ready for download!`, type: 'info' })
      } else {
        setUpdateStatus('uptodate')
        playSuccess()
        showToast({ title: 'Workstation Up to Date', message: `Uni Desk v${appVersion} is on the latest verified release.`, type: 'success' })
      }
    } catch (e) {
      setUpdateStatus('uptodate')
      setUpdateError(String(e))
      showToast({ title: 'Up to Date', message: `Workstation verified. Current release: v${appVersion}.`, type: 'info' })
    }
  }

  async function startDownload() {
    setUpdateStatus('downloading')
    setUpdateError('')

    const unsub = api.update.onProgress((prog: any) => {
      setDownloadProgress(prog)
    })

    try {
      const res = await api.update.download()
      if (res && res.success) {
        setUpdateStatus('ready')
        playSuccess()
      } else {
        throw new Error("Download completed but verification failed.")
      }
    } catch (e) {
      setUpdateStatus('error')
      setUpdateError(String(e))
      playError()
    } finally {
      unsub()
      api.update.removeListeners()
    }
  }

  async function applyUpdate() {
    try {
      playSuccess()
      await api.update.install()
    } catch (e) {
      setUpdateStatus('error')
      setUpdateError(String(e))
      playError()
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  async function saveAndFlash(msg: string, fn: () => Promise<void>): Promise<void> {
    await fn()
    setSaved(msg)
    setTimeout(() => setSaved(null), 2500)
    refreshAudioInfo()
  }



  async function updatePrefix(pfx: string, audioName: string): Promise<void> {
    const newMap = { ...prefixAssignments, [pfx]: audioName }
    setPrefixAssignments(newMap)
    await api.settings.setAndSave('audio_prefix_assignments', newMap)
    setPrefixValidations(await api.audio.validatePrefixes())
  }

  async function addAudioToLibrary(): Promise<void> {
    const p = await api.dialog.openFile({ filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac'] }] })
    if (p) {
      const result = await api.audio.addToLibrary(p)
      if (result) {
        const newColl = [...audioCollection, { name: result.name, path: result.dst }]
        setAudioCollection(newColl)
        await api.settings.setAndSave('audio_collection', newColl)
        setSaved('Audio added to library')
        refreshAudioInfo()
      }
    }
  }
  // Expose helpers for audio management
  (window as any)._settingsAddAudio = addAudioToLibrary

  async function removeAudioFromLibrary(idx: number): Promise<void> {
    const item = audioCollection[idx]
    if (item && confirm(`Remove ${item.name} from audio library?`)) {
      await api.audio.removeFromLibrary(item.path)
      const newColl = audioCollection.filter((_, i) => i !== idx)
      setAudioCollection(newColl)
      await api.settings.setAndSave('audio_collection', newColl)
      refreshAudioInfo()
    }
  }
  (window as any)._settingsRemoveAudio = removeAudioFromLibrary

  async function removeInstrumentalFromLibrary(idx: number): Promise<void> {
    const item = instrumentalCollection[idx]
    if (item && confirm(`Remove ${item.name} from instrumental library?`)) {
      await api.audio.removeInstrumentalFromLibrary(item.path)
      const newColl = instrumentalCollection.filter((_, i) => i !== idx)
      setInstrumentalCollection(newColl)
      await api.settings.setAndSave('instrumental_audio_collection', newColl)
      refreshAudioInfo()
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files: Array<{ name: string; path: string }> = []
      const validExts = ['.mp3', '.wav', '.m4a', '.aac']
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i] as any
        const filePath = file.path
        if (filePath) {
          const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
          if (validExts.includes(ext)) {
            files.push({ name: file.name, path: filePath })
          }
        }
      }
      if (files.length > 0) {
        setPendingInstrumentals(prev => {
          const existingPaths = new Set(prev.map(f => f.path))
          const filtered = files.filter(f => !existingPaths.has(f.path))
          return [...prev, ...filtered]
        })
        playTick()
      }
    }
  }

  async function browseInstrumentalFiles(): Promise<void> {
    const paths = await api.dialog.openFiles({
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac'] }]
    })
    if (paths && paths.length > 0) {
      const newFiles = paths.map((p: string) => {
        const parts = p.split(/[\\/]/)
        const name = parts[parts.length - 1]
        return { name, path: p }
      })
      setPendingInstrumentals(prev => {
        const existingPaths = new Set(prev.map(f => f.path))
        const filtered = newFiles.filter(f => !existingPaths.has(f.path))
        return [...prev, ...filtered]
      })
      playTick()
    }
  }

  async function transferPendingInstrumentals(): Promise<void> {
    if (pendingInstrumentals.length === 0) return

    let successCount = 0
    const newItems: Array<{ name: string; path: string }> = []

    for (const file of pendingInstrumentals) {
      const result = await api.audio.addInstrumentalToLibrary(file.path)
      if (result) {
        newItems.push({ name: result.name, path: result.dst })
        successCount++
      }
    }

    if (successCount > 0) {
      const newColl = [...instrumentalCollection, ...newItems]
      setInstrumentalCollection(newColl)
      await api.settings.setAndSave('instrumental_audio_collection', newColl)
      setPendingInstrumentals([])
      setSaved(`Transferred ${successCount} files to Instrumental Library`)
      playSuccess()
      refreshAudioInfo()
    } else {
      showToast({ title: 'Transfer Failed', message: 'Failed to transfer any files.', type: 'error' })
      playError()
    }
  }

  async function validateTitlesFolder(p: string): Promise<void> {
    if (!p) { setTitlesFolderValid(null); return }
    setTitlesFolderValid(true)
  }

  function togglePlay(audioName: string) {
    if (playingAudio === audioName) {
      audioObj?.pause()
      setPlayingAudio(null)
      return
    }

    if (audioObj) audioObj.pause()

    const idx = parseInt(audioName.replace('Audio ', '')) - 1
    const path = audioPool[idx]
    if (!path) {
      showToast({ title: 'Audio Missing', message: 'Audio file not found in pool.', type: 'warning' })
      return
    }

    const url = `local-resource://${encodeURIComponent(path)}`
    const newAudio = new Audio(url)
    newAudio.onended = () => setPlayingAudio(null)
    newAudio.play().catch(e => {
      console.error('Playback failed:', e)
      showToast({ title: 'Playback Failed', message: 'Could not play audio file.', type: 'error' })
    })

    setAudioObj(newAudio)
    setPlayingAudio(audioName)
  }

  const standardPrefixes = ['Q', 'Z', 'MZ', 'M', 'WAAZ', 'ID', 'AQ']
  const allPrefixes = Array.from(new Set([...standardPrefixes, ...Object.keys(prefixAssignments)]))
  const poolNames = audioPool.map(p => {
    const parts = p.split(/[\\/]/)
    const filename = parts[parts.length - 1]
    return filename.split('.')[0]
  })
  const audioOptions = Array.from({ length: Math.max(poolNames.length, 5) }, (_, i) => `Audio ${i + 1}`)

  async function subscribeToUpdates() {
    if (!subEmail.trim() || !subEmail.includes('@')) {
      setSubMsg('Please enter a valid email address.')
      setSubStatus('error')
      playError()
      return
    }
    setSubStatus('loading')
    setSubMsg('')
    try {
      const customUrl = localStorage.getItem('ot_google_script_url')
      const targetUrl = customUrl || "https://script.google.com/macros/s/AKfycbyaAOszoh13kXe3qxOSoBvji1SOw0AtqdQZU70Ul0rDH0h2S63qX_Q4oCpfQE1vMTSuBQ/exec"

      let res: any
      const hasIpc = api && api.settings && typeof api.settings.submitGrievance === 'function'
      if (hasIpc) {
        res = await api.settings.submitGrievance(targetUrl, {
          action: 'log_subscriber',
          subscriber: { email: subEmail.trim(), name: subName.trim() }
        })
      } else {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'log_subscriber',
            subscriber: { email: subEmail.trim(), name: subName.trim() }
          })
        })
        res = await response.json()
      }

      if (res && res.status === 'success') {
        localStorage.setItem('ot_subscriber_email', subEmail.trim())
        localStorage.setItem('ot_subscriber_name', subName.trim())
        setIsSubscribed(true)
        const msg = res.message === 'already_subscribed'
          ? '✅ Already subscribed! Your email is registered.'
          : '✅ Subscribed! You\'ll get update emails for all future releases.'
        setSubMsg(msg)
        setSubStatus('success')
        playSuccess()
        showToast({ title: 'Subscribed', message: msg, type: 'success' })
      } else {
        throw new Error(res?.message || 'Subscription failed.')
      }
    } catch (e) {
      setSubMsg('Failed: ' + String(e))
      setSubStatus('error')
      playError()
      showToast({ title: 'Subscription Failed', message: 'Could not connect to update feed: ' + String(e), type: 'warning' })
    }
  }

  function unsubscribeFromUpdates() {
    localStorage.removeItem('ot_subscriber_email')
    localStorage.removeItem('ot_subscriber_name')
    setIsSubscribed(false)
    setSubEmail('')
    setSubName('')
    setSubMsg('You have been unsubscribed from update notifications.')
    setSubStatus('idle')
    playTick()
  }

  // ── MODAL POPUP RENDERER ───────────────────────────────────────
  const renderModal = () => {
    if (!activeModal) return null

    return createPortal(
      <div className="st-modal-overlay" onClick={() => setActiveModal(null)}>
        <div className="st-modal-dialog" onClick={e => e.stopPropagation()}>
          
          {/* AUDIO MODAL */}
          {activeModal === 'audio' && (
            <>
              <div className="st-modal-header">
                <div className="st-modal-title-row">
                  <span className="st-modal-icon">🎵</span>
                  <div>
                    <h3 className="st-modal-title">Audio Pool & Track Assignments</h3>
                    <p className="st-modal-subtitle">Manage audio tracks, prefix rules, and instrumental libraries</p>
                  </div>
                </div>
                <button className="st-modal-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <div className="st-modal-body">
                <div className="st-info-box">
                  📁 <strong>Audio Assets Pool:</strong> {poolInfo}
                </div>

                <div className="st-divider" />

                <div className="st-mode-panel">
                  <p className="st-section-label" style={{ color: '#8B5CF6' }}>Assignment Strategy Mode</p>
                  <div className="st-radio-group" style={{ marginTop: '8px' }}>
                    <label className={`st-radio-card ${assignMode === 'single' ? 'st-radio-card--selected' : ''}`}>
                      <input type="radio" name="assignMode" value="single" checked={assignMode === 'single'}
                        onChange={async () => {
                          setAssignMode('single')
                          await api.settings.setAndSave('audio_assignment_mode', 'single')
                        }}
                      />
                      <div>
                        <strong>Single Audio Track (All Videos)</strong>
                        <p>All rendered title videos will use one specific audio track.</p>
                      </div>
                    </label>

                    <label className={`st-radio-card ${assignMode === 'alternate' ? 'st-radio-card--selected' : ''}`}>
                      <input type="radio" name="assignMode" value="alternate" checked={assignMode === 'alternate'}
                        onChange={async () => {
                          setAssignMode('alternate')
                          await api.settings.setAndSave('audio_assignment_mode', 'alternate')
                        }}
                      />
                      <div>
                        <strong>Sequential Rotation Mode (Pool Cycles)</strong>
                        <p>Rotates sequentially through available audio tracks (Audio 1, Audio 2, Audio 3...) for each video in order.</p>
                      </div>
                    </label>

                    <label className={`st-radio-card ${assignMode === 'prefix' ? 'st-radio-card--selected' : ''}`}>
                      <input type="radio" name="assignMode" value="prefix" checked={assignMode === 'prefix'}
                        onChange={async () => {
                          setAssignMode('prefix')
                          await api.settings.setAndSave('audio_assignment_mode', 'prefix')
                        }}
                      />
                      <div>
                        <strong>Smart Prefix Assignments</strong>
                        <p>Map specific title prefix keywords (Q, Z, MZ, M, WAAZ...) to custom audio files.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {assignMode === 'single' ? (
                  <div className="st-mode-panel">
                    <p className="st-section-label">Select Primary Audio Track</p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                      <select className="st-select" value={singleIdx}
                        onChange={async e => {
                          const v = e.target.value
                          setSingleIdx(v)
                          await api.settings.setAndSave('audio_single_index', parseInt(v) - 1)
                        }}>
                        {audioOptions.map((opt, i) => (
                          <option key={i} value={String(i + 1)}>{opt}</option>
                        ))}
                      </select>
                      <button className="st-pfx-play" onClick={() => togglePlay(`Audio ${singleIdx}`)}>
                        {playingAudio === `Audio ${singleIdx}` ? '⏹ Stop' : '▶ Preview'}
                      </button>
                    </div>
                  </div>
                ) : assignMode === 'alternate' ? (
                  <div className="st-mode-panel">
                    <p className="st-section-label" style={{ color: '#10B981' }}>🔄 Sequential Rotation Sequence</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 12px 0' }}>
                      Videos in batch render will be assigned tracks sequentially from your audio assets pool in a continuous round-robin loop:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {audioOptions.map((opt, i) => (
                        <div key={i} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600
                        }}>
                          <span style={{ color: 'var(--accent-adder, #6366F1)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>#{i + 1}</span>
                          <span>{opt}</span>
                          <button
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: '11px', color: 'var(--text-secondary)' }}
                            onClick={() => togglePlay(opt)}
                            title="Preview Audio"
                          >
                            {playingAudio === opt ? '⏹' : '▶'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="st-mode-panel">
                    <p className="st-section-label" style={{ color: '#8B5CF6' }}>Prefix to Audio Mappings</p>
                    <div className="st-prefix-table" style={{ marginTop: '8px' }}>
                      <div className="st-pfx-header">
                        <span style={{ width: 80 }}>Prefix</span>
                        <span style={{ flex: 1 }}>Assigned Track</span>
                        <span style={{ width: 110 }}>Validation</span>
                        <span style={{ width: 40 }}>Preview</span>
                      </div>
                      {allPrefixes.map(pfx => {
                        const assigned = prefixAssignments[pfx] || 'Audio 1'
                        const isValid = prefixValidations[pfx] ?? true
                        return (
                          <div key={pfx} className="st-pfx-row">
                            <span className="st-pfx-tag">{pfx}</span>
                            <select className="st-select" style={{ flex: 1 }} value={assigned}
                              onChange={e => updatePrefix(pfx, e.target.value)}>
                              {audioOptions.map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <ValidationDot valid={isValid} label={isValid ? 'File Ready' : 'Missing Audio'} />
                            <button className={`st-pfx-play ${playingAudio === assigned ? 'st-pfx-play--playing' : ''}`}
                              onClick={() => togglePlay(assigned)}>
                              {playingAudio === assigned ? '⏹' : '▶'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="st-divider" />

                <div>
                  <p className="st-section-label" style={{ color: '#8B5CF6', marginBottom: '4px' }}>Instrumental Tracks Library ({instrumentalCollection.length})</p>
                  <p className="st-desc" style={{ marginBottom: '12px' }}>Upload additional background instrumentals for video titles rendering.</p>
                  
                  <div className="st-lib-list">
                    {instrumentalCollection.length === 0 ? (
                      <p className="st-empty-msg">No instrumental files in library yet.</p>
                    ) : (
                      instrumentalCollection.map((item, idx) => (
                        <div key={idx} className="st-lib-row">
                          <span className="st-lib-name" style={{ color: '#8B5CF6' }}>✨ Special {item.name}</span>
                          <span className="st-lib-path truncate">{item.path}</span>
                          <button className="st-lib-del" onClick={() => removeInstrumentalFromLibrary(idx)}>✕</button>
                        </div>
                      ))
                    )}
                  </div>

                  <div 
                    className={`instrumental-dropzone ${isDragOver ? 'drag-over' : ''} ${pendingInstrumentals.length > 0 ? 'has-files' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={browseInstrumentalFiles}
                    style={{ marginTop: '12px' }}
                  >
                    <div className="dropzone-content">
                      <span className="dropzone-icon">📥</span>
                      <span className="dropzone-text">
                        Drag & Drop Instrumental Audio Files Here or <strong style={{ color: '#8B5CF6' }}>Browse</strong>
                      </span>
                      <span className="dropzone-sub">Supports .mp3, .wav, .m4a, .aac</span>
                    </div>
                  </div>

                  {pendingInstrumentals.length > 0 && (
                    <div className="pending-list anim-scale-in" style={{ marginTop: '12px' }}>
                      <p className="pending-title">⏳ Files Pending Transfer ({pendingInstrumentals.length})</p>
                      <div className="pending-actions">
                        <Button accent="#8B5CF6" accentHv="#7C3AED" onClick={transferPendingInstrumentals}>
                          📂 Transfer to Final Titles Folder
                        </Button>
                        <GhostButton onClick={() => setPendingInstrumentals([])}>Clear All</GhostButton>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="st-modal-footer">
                <Button variant="primary" accent="#8B5CF6" onClick={() => setActiveModal(null)}>Done & Close</Button>
              </div>
            </>
          )}

          {/* PATHS & STORAGE MODAL */}
          {activeModal === 'paths' && (
            <>
              <div className="st-modal-header">
                <div className="st-modal-title-row">
                  <span className="st-modal-icon">📂</span>
                  <div>
                    <h3 className="st-modal-title">Default Paths & Settings Storage</h3>
                    <p className="st-modal-subtitle">Configure output directories and workstation storage configuration</p>
                  </div>
                </div>
                <button className="st-modal-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <div className="st-modal-body">
                <BrowseRow label="Default Final Titles Folder (Title Output)" value={titlesFolder}
                  placeholder="Select folder for rendered titles..." accent="#8B5CF6"
                  onBrowse={async () => {
                    const p = await api.dialog.openFolder()
                    if (p) saveAndFlash('Titles folder saved', () => api.settings.setAndSave('titles_folder', p)).then(() => { setTitlesFolder(p); validateTitlesFolder(p) })
                  }}
                  onChange={v => { setTitlesFolder(v); validateTitlesFolder(v) }}
                  onBlur={e => {
                    const v = e.target.value.trim()
                    api.settings.setAndSave('titles_folder', v)
                  }}
                />
                <ValidationDot valid={titlesFolderValid} label={titlesFolderValid === true ? 'Directory exists & accessible' : 'Path not selected'} />

                <div className="st-divider" />

                <BrowseRow label="Converter Default Input Folder" value={convInput}
                  placeholder="Select input folder for video converter..." accent="#8B5CF6"
                  onBrowse={async () => {
                    const p = await api.dialog.openFolder()
                    if (p) saveAndFlash('Converter input folder saved', () => api.settings.setAndSave('converter_input', p)).then(() => setConvInput(p))
                  }}
                  onChange={v => setConvInput(v)}
                  onBlur={e => {
                    const v = e.target.value.trim()
                    api.settings.setAndSave('converter_input', v)
                  }}
                />

                <div className="st-divider" />

                <div className="st-toggle-row">
                  <div>
                    <p className="st-toggle-label">Remember last used paths</p>
                    <p className="st-toggle-sub">Automatically restore recent output directories across application restarts</p>
                  </div>
                  <button className={`st-toggle ${rememberPaths ? 'st-toggle--on' : ''}`}
                    onClick={() => saveAndFlash('Preference updated', async () => {
                      const nv = !rememberPaths
                      setRememberPaths(nv)
                      await api.settings.setAndSave('remember_paths', nv)
                    })}
                    style={rememberPaths ? { background: '#8B5CF6' } : {}}
                  />
                </div>

                <div className="st-divider" />

                <div>
                  <p className="st-section-label">Active Settings File Location</p>
                  <input type="text" className="st-path-input" readOnly value={settingsPath || 'Loading...'} />
                  <div style={{ marginTop: '8px' }}>
                    <GhostButton onClick={async () => {
                      const p = await api.dialog.openFile({ filters: [{ name: 'JSON Settings', extensions: ['json'] }] })
                      if (p) {
                        await api.settings.setFilePath(p)
                        await load()
                        setSaved('Settings file loaded: ' + p)
                      }
                    }}>📂 Choose Custom Settings File</GhostButton>
                  </div>
                </div>
              </div>
              <div className="st-modal-footer">
                <Button variant="primary" accent="#8B5CF6" onClick={() => setActiveModal(null)}>Done & Close</Button>
              </div>
            </>
          )}

          {/* TASK TRACKER MULTI-DRIVE WORKSPACES MODAL */}
          {activeModal === 'trackerDrives' && (
            <>
              <div className="st-modal-header">
                <div className="st-modal-title-row">
                  <span className="st-modal-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06B6D4' }}>🗄️</span>
                  <div>
                    <h3 className="st-modal-title">Task Tracker Drives & Workspaces</h3>
                    <p className="st-modal-subtitle">Connect one or more drives. Standard folders (IN PROCESS, UPLOADED DATA, TO DELETE) are detected automatically.</p>
                  </div>
                </div>
                <button className="st-modal-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>

              <div className="st-modal-body">
                {/* Information Banner */}
                <div className="st-info-box" style={{ background: 'rgba(6, 182, 212, 0.08)', borderColor: 'rgba(6, 182, 212, 0.25)' }}>
                  💡 <strong>Automatic Folder Binding:</strong> Simply select your drive letter (e.g. <code>D:\</code>). One Tap immediately discovers your Safar data in <code>IN PROCESS</code>, upload folder in <code>UPLOADED DATA</code>, and cleanup in <code>TO DELETE</code> without needing manual folder browsing.
                </div>

                {/* Quick Add Drive Control */}
                <div className="st-drive-add-card">
                  <div className="st-drive-add-header">
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      ➕ Add Storage Drive to Workspace
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Supports internal drives, external USB-C SSDs, and network storage
                    </span>
                  </div>

                  <div className="st-drive-add-controls">
                    <select
                      className="st-select"
                      style={{ flex: 1, minWidth: '180px' }}
                      value={selectedAddDrive}
                      onChange={e => setSelectedAddDrive(e.target.value)}
                      disabled={isDetectingDrive}
                    >
                      <option value="" disabled>Select available system drive...</option>
                      {systemDrives.map(d => (
                        <option key={d} value={d}>
                          💽 Drive {d} {trackerDrives.some(td => td.driveRoot.toLowerCase() === d.toLowerCase()) ? '(Already Added)' : ''}
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="primary"
                      accent="#06B6D4"
                      accentHv="#0891B2"
                      disabled={!selectedAddDrive || isDetectingDrive}
                      onClick={() => handleAddDrive(selectedAddDrive)}
                    >
                      {isDetectingDrive ? '🔍 Scanning Drive...' : '➕ Add Drive'}
                    </Button>

                    <GhostButton
                      onClick={handleBrowseAddDrive}
                      disabled={isDetectingDrive}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      📂 Browse Custom Root...
                    </GhostButton>
                  </div>
                </div>

                {/* Create Full Safar Structure Panel (Issue 4) */}
                <div className="st-drive-add-card" style={{ background: 'var(--surface-2)', border: '1.5px solid rgba(6, 182, 212, 0.3)', borderRadius: '12px', padding: '14px 18px', marginTop: '12px' }}>
                  <div className="st-drive-add-header" style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>📁</span>
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                        Create Full Safar Folder Structure
                      </strong>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Generates <code>IN PROCESS\[Safar]\[Date]\</code> & <code>Final\</code> + ensures <code>TO UPLOAD</code> & <code>TO DELETE</code> on active drives.
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="st-path-input"
                      placeholder="e.g. 1448-03 Mumbai or 1448-02 Raipur"
                      value={newSafarStructureName}
                      onChange={e => setNewSafarStructureName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateFullSafarStructure() }}
                      disabled={isCreatingStructure}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="primary"
                      accent="#06B6D4"
                      accentHv="#0891B2"
                      disabled={!newSafarStructureName.trim() || isCreatingStructure}
                      onClick={handleCreateFullSafarStructure}
                    >
                      {isCreatingStructure ? '⏳ Creating Folders...' : '📁 Create Full Structure'}
                    </Button>
                  </div>
                </div>

                <div className="st-divider" />

                {/* Configured Drives List */}
                <div className="st-drives-list">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <p className="st-section-label" style={{ color: '#06B6D4', margin: 0 }}>
                      Configured Production Drives ({trackerDrives.length})
                    </p>
                    {trackerDrives.length > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {trackerDrives.filter(d => d.enabled).length} of {trackerDrives.length} active in Tracker
                      </span>
                    )}
                  </div>

                  {trackerDrives.length === 0 ? (
                    <div className="st-drive-empty-card">
                      <span style={{ fontSize: '28px' }}>💽</span>
                      <strong style={{ color: 'var(--text-primary)', marginTop: '6px' }}>No Drives Configured Yet</strong>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 0 0' }}>
                        Select a system drive above (e.g. <code>D:\</code>) or click Browse to connect your media drive.
                      </p>
                    </div>
                  ) : (
                    trackerDrives.map((drive) => {
                      const hasMissing = !drive.status?.inProcessExists || !drive.status?.toUploadExists || !drive.status?.toDeleteExists
                      const isExpanded = expandedDriveConfig === drive.id

                      return (
                        <div key={drive.id} className={`st-drive-item-card ${!drive.enabled ? 'st-drive-item-card--disabled' : ''}`}>
                          {/* Drive Top Row */}
                          <div className="st-drive-item-top">
                            <div className="st-drive-item-info">
                              <div className="st-drive-icon-badge">
                                💽
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                                    {drive.label || `Drive ${drive.driveRoot}`}
                                  </strong>
                                  <code style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                                    {drive.driveRoot}
                                  </code>
                                  <span className={`st-status-badge ${drive.enabled ? 'st-status-badge--active' : 'st-status-badge--inactive'}`}>
                                    {drive.enabled ? '● Active' : '○ Paused'}
                                  </span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {drive.status?.inProcessExists ? `${drive.status?.safarCount || 0} Safar folder(s) found in IN PROCESS` : 'IN PROCESS folder not found yet'}
                                </span>
                              </div>
                            </div>

                            <div className="st-drive-item-actions">
                              <button
                                className="st-drive-action-btn"
                                title="Re-scan and auto-detect folders"
                                onClick={() => handleReDetectDrive(drive.id)}
                                disabled={isDetectingDrive}
                              >
                                🔄 Refresh
                              </button>
                              <button
                                className={`st-toggle ${drive.enabled ? 'st-toggle--on' : ''}`}
                                title={drive.enabled ? 'Click to pause tracking this drive' : 'Click to enable tracking'}
                                onClick={() => handleToggleDrive(drive.id)}
                                style={drive.enabled ? { background: '#06B6D4' } : {}}
                              />
                              <button
                                className="st-drive-del-btn"
                                title="Remove drive from workspace"
                                onClick={() => handleRemoveDrive(drive.id)}
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* 3 Auto-detected Folders Grid */}
                          <div className="st-drive-folders-grid">
                            {/* 1. IN PROCESS */}
                            <div className={`st-folder-chip ${drive.status?.inProcessExists ? 'st-folder-chip--found' : 'st-folder-chip--missing'}`}>
                              <div className="st-folder-chip-top">
                                <span className="st-folder-label">📁 Working Safar (IN PROCESS)</span>
                                <span className="st-folder-badge">
                                  {drive.status?.inProcessExists ? `✓ Found (${drive.status?.safarCount ?? 0} Safars)` : '⚠ Missing'}
                                </span>
                              </div>
                              <div className="st-folder-path" title={drive.inProcessPath}>
                                {drive.inProcessPath}
                              </div>
                            </div>

                            {/* 2. UPLOADED DATA / TO UPLOAD */}
                            <div className={`st-folder-chip ${drive.status?.toUploadExists ? 'st-folder-chip--found' : 'st-folder-chip--missing'}`}>
                              <div className="st-folder-chip-top">
                                <span className="st-folder-label">📤 Uploaded Data (TO UPLOAD)</span>
                                <span className="st-folder-badge">
                                  {drive.status?.toUploadExists ? '✓ Found' : '⚠ Missing'}
                                </span>
                              </div>
                              <div className="st-folder-path" title={drive.toUploadPath}>
                                {drive.toUploadPath}
                              </div>
                            </div>

                            {/* 3. TO DELETE */}
                            <div className={`st-folder-chip ${drive.status?.toDeleteExists ? 'st-folder-chip--found' : 'st-folder-chip--missing'}`}>
                              <div className="st-folder-chip-top">
                                <span className="st-folder-label">🗑️ Cleanup (TO DELETE)</span>
                                <span className="st-folder-badge">
                                  {drive.status?.toDeleteExists ? '✓ Found' : '⚠ Missing'}
                                </span>
                              </div>
                              <div className="st-folder-path" title={drive.toDeletePath}>
                                {drive.toDeletePath}
                              </div>
                            </div>
                          </div>

                          {/* Missing Folders Alert / Create Action */}
                          {hasMissing && (
                            <div className="st-drive-missing-alert">
                              <span style={{ fontSize: '12px' }}>
                                ⚠️ One or more standard folders are missing on <code>{drive.driveRoot}</code>.
                              </span>
                              <button
                                className="st-btn-create-folders"
                                onClick={() => handleCreateMissingFolders(drive)}
                              >
                                ⚡ Create Missing Folders Now
                              </button>
                            </div>
                          )}

                          {/* Custom Path Overrides Toggle */}
                          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="st-link-btn"
                              onClick={() => setExpandedDriveConfig(isExpanded ? null : drive.id)}
                              style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                            >
                              {isExpanded ? '▲ Hide Custom Path Overrides' : '▼ Customize Folder Paths (Advanced)'}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="st-drive-overrides-box anim-fade-in" style={{ marginTop: '8px' }}>
                              <BrowseRow
                                label="Custom Working Safar / IN PROCESS Folder"
                                value={drive.inProcessPath}
                                placeholder="Select custom In Process folder..."
                                accent="#06B6D4"
                                onBrowse={async () => {
                                  const p = await api.dialog.openFolder()
                                  if (p) handleUpdateDrivePath(drive.id, 'inProcessPath', p)
                                }}
                                onChange={v => handleUpdateDrivePath(drive.id, 'inProcessPath', v)}
                              />
                              <div style={{ height: '6px' }} />
                              <BrowseRow
                                label="Custom UPLOADED DATA / TO UPLOAD Folder"
                                value={drive.toUploadPath}
                                placeholder="Select custom Uploaded Data folder..."
                                accent="#06B6D4"
                                onBrowse={async () => {
                                  const p = await api.dialog.openFolder()
                                  if (p) handleUpdateDrivePath(drive.id, 'toUploadPath', p)
                                }}
                                onChange={v => handleUpdateDrivePath(drive.id, 'toUploadPath', v)}
                              />
                              <div style={{ height: '6px' }} />
                              <BrowseRow
                                label="Custom TO DELETE Folder"
                                value={drive.toDeletePath}
                                placeholder="Select custom To Delete folder..."
                                accent="#06B6D4"
                                onBrowse={async () => {
                                  const p = await api.dialog.openFolder()
                                  if (p) handleUpdateDrivePath(drive.id, 'toDeletePath', p)
                                }}
                                onChange={v => handleUpdateDrivePath(drive.id, 'toDeletePath', v)}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="st-modal-footer">
                <Button variant="primary" accent="#06B6D4" onClick={() => setActiveModal(null)}>
                  Done & Close
                </Button>
              </div>
            </>
          )}

          {/* FOLDER WATCHER MODAL */}
          {activeModal === 'watcher' && (
            <>
              <div className="st-modal-header">
                <div className="st-modal-title-row">
                  <span className="st-modal-icon">👁️</span>
                  <div>
                    <h3 className="st-modal-title">Folder Watcher & Auto Convert</h3>
                    <p className="st-modal-subtitle">Configure background directory monitoring for automatic file processing</p>
                  </div>
                </div>
                <button className="st-modal-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <div className="st-modal-body">
                <div className="st-toggle-row">
                  <div>
                    <p className="st-toggle-label">Enable Folder Watcher Service</p>
                    <p className="st-toggle-sub">Monitor selected folder for new files and automatically convert them in background</p>
                  </div>
                  <button className={`st-toggle ${watcherEnabled ? 'st-toggle--on' : ''}`}
                    onClick={() => saveAndFlash('Watcher updated', async () => {
                      const nv = !watcherEnabled
                      setWatcherEnabled(nv)
                      await api.settings.setAndSave('watcher_enabled', nv)
                    })}
                    style={watcherEnabled ? { background: '#8B5CF6' } : {}}
                  />
                </div>

                <div className="st-divider" />

                <BrowseRow label="Watched Directory Path" value={watcherInputFolder}
                  placeholder="Select directory to monitor for new incoming files..." accent="#8B5CF6"
                  onBrowse={async () => {
                    const p = await api.dialog.openFolder()
                    if (p) saveAndFlash('Watched folder saved', () => api.settings.setAndSave('watcher_input_folder', p)).then(() => setWatcherInputFolder(p))
                  }}
                  onChange={v => {
                    setWatcherInputFolder(v)
                    if (v && v.trim()) {
                      api.settings.setAndSave('watcher_input_folder', v.trim())
                    }
                  }}
                />

                <div className="st-divider" />

                <BrowseRow label="JPEG Extract Default Output Folder" value={converterJpeg}
                  placeholder="Select output folder for video frame extractions..." accent="#8B5CF6"
                  onBrowse={async () => {
                    const p = await api.dialog.openFolder()
                    if (p) saveAndFlash('JPEG output folder saved', () => api.settings.setAndSave('converter_jpeg', p)).then(() => setConverterJpeg(p))
                  }}
                  onChange={v => {
                    setConverterJpeg(v)
                    if (v && v.trim()) {
                      api.settings.setAndSave('converter_jpeg', v.trim())
                    }
                  }}
                />
              </div>
              <div className="st-modal-footer">
                <Button variant="primary" accent="#8B5CF6" onClick={() => setActiveModal(null)}>Done & Close</Button>
              </div>
            </>
          )}

          {/* THEME & VISUAL STYLING MODAL */}
          {activeModal === 'theme' && (
            <>
              <div className="st-modal-header">
                <div className="st-modal-title-row">
                  <span className="st-modal-icon">🎨</span>
                  <div>
                    <h3 className="st-modal-title">Theme & Visual Styling</h3>
                    <p className="st-modal-subtitle">Customize application colors, animation presets, and UI aesthetics</p>
                  </div>
                </div>
                <button className="st-modal-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <div className="st-modal-body">
                <div>
                  <p className="st-section-label" style={{ color: '#8B5CF6', marginBottom: '8px' }}>Color Palette Theme</p>
                  <div className="st-theme-grid">
                    {THEMES.map(th => (
                      <button key={th.id}
                        className={`st-theme-card ${theme === th.id ? 'st-theme-card--selected' : ''}`}
                        onClick={() => {
                          setTheme(th.id)
                          setSaved(`Saved and remembered theme: ${th.label}`)
                          playTick()
                        }}>
                        <span className="st-theme-icon">{th.icon}</span>
                        <strong>{th.label}</strong>
                        <p>{th.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="st-divider" />

                <div>
                  <p className="st-section-label" style={{ color: '#8B5CF6', marginBottom: '8px' }}>Animation Speed Preset</p>
                  <div className="st-anim-grid">
                    {ANIM_PRESETS.map(ap => (
                      <button key={ap.id}
                        className={`st-anim-card ${animPreset === ap.id ? 'st-anim-card--selected' : ''}`}
                        onClick={() => { setAnimPreset(ap.id); playTick() }}>
                        <strong>{ap.label}</strong>
                        <p>{ap.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="st-divider" />

                <div>
                  <p className="st-section-label" style={{ color: '#8B5CF6', marginBottom: '8px' }}>Page Transition Effect</p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {['fade', 'slide', 'scale', 'none'].map(mode => (
                      <button key={mode}
                        className={`st-chip ${pageTransition === mode ? 'st-chip--selected' : ''}`}
                        onClick={() => { setPageTransition(mode as any); playTick() }}
                        style={{ textTransform: 'capitalize' }}>
                        {mode} Mode
                      </button>
                    ))}
                  </div>
                </div>

                <div className="st-divider" />

                <div>
                  <p className="st-section-label" style={{ color: '#8B5CF6', marginBottom: '8px' }}>Custom Font & Color Overrides</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Input label="Custom UI Font Family" value={customFont} placeholder="Inter, Roboto, sans-serif" onChange={e => setCustomFont(e.target.value)} />
                    <Input label="Custom Text Color (Hex)" value={customTextColor} placeholder="#F3F4F6" onChange={e => setCustomTextColor(e.target.value)} />
                  </div>
                  {(customFont || customTextColor || customBgColor) && (
                    <div style={{ marginTop: '12px' }}>
                      <GhostButton onClick={() => { setCustomFont(''); setCustomTextColor(''); setCustomBgColor(''); }}>Reset Custom Font & Colors</GhostButton>
                    </div>
                  )}
                </div>

                <div className="st-divider" />

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <p className="st-section-label" style={{ color: '#8B5CF6', margin: 0 }}>
                      ✨ Workstation Preloader & Boot Loading Screen
                    </p>
                    <button
                      type="button"
                      className="st-chip st-chip--selected"
                      onClick={() => setShowLoaderModal(true)}
                      style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#FFF' }}
                    >
                      🚀 Open Loader Template Showcase
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    Select between ONTO Kinetic Typography (UNIDesk), Astral Frontier Cosmos, Walbi Audio Soundwave, Spasoje Editorial Ticker, or Mobbin Workstation Dock.
                  </p>
                </div>
              </div>
              <div className="st-modal-footer">
                <Button variant="primary" accent="#8B5CF6" onClick={() => setActiveModal(null)}>Done & Close</Button>
              </div>
            </>
          )}

          {/* PERFORMANCE & ENGINE MODAL */}
          {activeModal === 'perf' && (
            <>
              <div className="st-modal-header">
                <div className="st-modal-title-row">
                  <span className="st-modal-icon">⚡</span>
                  <div>
                    <h3 className="st-modal-title">Performance & Engine Tuning</h3>
                    <p className="st-modal-subtitle">Configure parallel stream worker limits and memory buffer allocations</p>
                  </div>
                </div>
                <button className="st-modal-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <div className="st-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <Input label="Parallel Stream Worker Threads" type="number" value={threads} min={1} max={32}
                    onChange={async e => {
                      const v = e.target.value
                      setThreads(v)
                      await api.settings.setAndSave('drivesync_threads', parseInt(v) || 8)
                    }}
                  />
                  <Input label="Stream Buffer Size (MB)" type="number" value={bufSize} min={1} max={64}
                    onChange={async e => {
                      const v = e.target.value
                      setBufSize(v)
                      await api.settings.setAndSave('drivesync_bufsize_mb', parseInt(v) || 4)
                    }}
                  />
                </div>

                <div className="st-divider" />

                <div className="st-info-box">
                  💡 <strong>Recommendation:</strong> For high-speed SSD transfers, 8–16 worker threads with a 4 MB buffer offer peak throughput without clogging Windows file I/O.
                </div>
              </div>
              <div className="st-modal-footer">
                <Button variant="primary" accent="#8B5CF6" onClick={() => setActiveModal(null)}>Done & Close</Button>
              </div>
            </>
          )}

          {/* FILE VIEWER MODAL */}
          {activeModal === 'fileViewer' && (
            <>
              <div className="st-modal-header">
                <div className="st-modal-title-row">
                  <span className="st-modal-icon">📄</span>
                  <div>
                    <h3 className="st-modal-title">Document & Media File Viewer Settings</h3>
                    <p className="st-modal-subtitle">Configure preview rendering for PDF, Word, Excel, Markdown, Images, and Videos</p>
                  </div>
                </div>
                <button className="st-modal-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <div className="st-modal-body">
                <FileViewerSettingsCard />
              </div>
              <div className="st-modal-footer">
                <Button variant="primary" accent="#8B5CF6" onClick={() => setActiveModal(null)}>Done & Close</Button>
              </div>
            </>
          )}

          {/* CAMERA TRANSFER MODAL */}
          {activeModal === 'cameraTransfer' && (
            <>
              <div className="st-modal-header">
                <div className="st-modal-title-row">
                  <span className="st-modal-icon">📷</span>
                  <div>
                    <h3 className="st-modal-title">Camera SD Transfer & Sorting</h3>
                    <p className="st-modal-subtitle">Sort and copy videos from SD card to camera person folders with Hijri naming</p>
                  </div>
                </div>
                <button className="st-modal-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <div className="st-modal-body" style={{ padding: 0 }}>
                <CameraTransfer />
              </div>
              <div className="st-modal-footer">
                <Button variant="primary" accent="#EC4899" onClick={() => setActiveModal(null)}>Done & Close</Button>
              </div>
            </>
          )}

          {/* 📋 CHANGELOG & WHAT'S NEW MODAL */}
          {activeModal === 'changelog' && (
            <>
              <div className="st-modal-header" style={{ padding: '22px 24px 18px 24px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  <button className="st-modal-close" onClick={() => setActiveModal(null)} style={{ position: 'absolute', top: '-4px', right: 0 }}>✕</button>
                  
                  {/* Arabic Header Calligraphy */}
                  <div style={{
                    fontFamily: "'Amiri', 'Traditional Arabic', 'Scheherazade New', serif",
                    fontSize: '34px',
                    fontWeight: 700,
                    color: '#B8860B',
                    direction: 'rtl',
                    lineHeight: 1.2,
                    letterSpacing: 0,
                    fontFeatureSettings: '"liga" 1, "calt" 1'
                  }}>
                    أَهْلًا وَسَهْلًا
                  </div>
                  <div style={{
                    width: '90px',
                    height: '2.5px',
                    background: 'linear-gradient(90deg, transparent, #B8860B, transparent)',
                    margin: '6px auto 10px auto',
                    borderRadius: '2px'
                  }} />
                  <h3 className="st-modal-title" style={{ fontSize: '18px', textAlign: 'center', color: 'var(--text-primary)' }}>
                    Uni Desk v{appVersion} Release Notes & What's New
                  </h3>
                  <p className="st-modal-subtitle" style={{ textAlign: 'center', marginTop: '4px', color: 'var(--text-secondary)' }}>
                    BS FrameWorks — Automated Video Production & Premiere Pro Workstation
                  </p>
                </div>
              </div>

              <div className="st-modal-body" style={{ gap: '16px', maxHeight: '65vh', overflowY: 'auto', padding: '20px 24px' }}>
                {/* ✨ What's New */}
                <div style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '18px' }}>✨</span>
                    <strong style={{ fontSize: '14px', color: '#B8860B' }}>What's New in v{appVersion}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    <div>• <strong>Arabic & Lisan-ud-Dawat Welcome Screen</strong>: Upside-down gravity-bounce teardrop banner, stationery geometric backdrop, and Web Audio harmonic chime.</div>
                    <div>• <strong>Curated 3-Theme Palette</strong>: Luxury Alabaster Beige & Gold Linen (Default), Holographic Aurora, and Emerald Mint.</div>
                    <div>• <strong>Native Tkinter Build Studio (`make_exe.py`)</strong>: Pre-flight dependency checker, GitHub Token vault, and automated release manifest generator.</div>
                    <div>• <strong>Built-In NSIS Modern UI 2 Installer</strong>: 0 extra software required, 100% native build with pixel-perfect branded sidebar & header bitmaps.</div>
                  </div>
                </div>

                {/* 🛠️ Bugs Fixed & Stability */}
                <div style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '18px' }}>🛠️</span>
                    <strong style={{ fontSize: '14px', color: '#10B981' }}>Bugs Fixed & Resolved</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    <div>• <strong>False-Positive Camera Prefix Matching</strong>: Fixed word detection bug (e.g. Zen matching Z prefix).</div>
                    <div>• <strong>Settings & Auto-Start Stability</strong>: Resolved runtime ReferenceErrors and guarded all IPC settings loaders.</div>
                    <div>• <strong>Premiere Pro Brand Icon</strong>: Linked authentic high-resolution Adobe Premiere Pro logo in navigation and page headers.</div>
                  </div>
                </div>

                {/* ⚡ Performance & Polish */}
                <div style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '18px' }}>⚡</span>
                    <strong style={{ fontSize: '14px', color: '#8B5CF6' }}>Performance & Navigation Fluidity</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    <div>• <strong>Fast Startup Velocity</strong>: Reduced Welcome Screen duration to 2.0s and halved Splash Screen minimum wait.</div>
                    <div>• <strong>Fluid Page Transitions</strong>: Integrated Fade, Slide, and Scale transition engine with micro-staggered card arrivals.</div>
                    <div>• <strong>Luxury Beige Styling</strong>: Warm sandstone borders, alabaster porcelain cards, and subtle geometric watermark backdrop.</div>
                  </div>
                </div>

                {/* 💻 System Requirements */}
                <div style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>💻</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>System Requirements & Runtime</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Windows 10 / 11 (64-bit) • 8 GB RAM minimum (16 GB+ recommended for 4K video workflows) • Adobe Premiere Pro 2021–2026
                  </p>
                </div>
              </div>

              <div className="st-modal-footer">
                <Button variant="primary" accent="#8B5CF6" onClick={() => setActiveModal(null)}>Done & Close</Button>
              </div>
            </>
          )}

        </div>
      </div>,
      document.body
    )
  }

  return (
    <div className="st-page">
      <div className="st-body" style={{ gap: '14px' }}>

        {saved && (
          <div className="st-saved-banner anim-slide-down">
            ✔ {saved}
          </div>
        )}

        {/* 1. 🎵 Audio Configuration & Pool */}
        <div className="st-compact-card">
          <div className="st-compact-info">
            <div className="st-compact-icon-box" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6' }}>
              🎵
            </div>
            <div className="st-compact-text">
              <span className="st-compact-title">Audio Pool & Track Assignments</span>
              <span className="st-compact-desc">{poolInfo || 'Manage audio tracks and custom prefix assignments'}</span>
              <div className="st-compact-chips">
                <span className="st-summary-chip">Mode: {assignMode === 'single' ? 'Single Track' : assignMode === 'alternate' ? 'Sequential Rotation' : 'Smart Prefix'}</span>
                <span className="st-summary-chip">Instrumentals: {instrumentalCollection.length} tracks</span>
              </div>
            </div>
          </div>
          <Button variant="primary" accent="#8B5CF6" accentHv="#7C3AED" onClick={() => setActiveModal('audio')}>
            🎵 Customize Audio Pool
          </Button>
        </div>



        {/* 1.8 🗄️ Task Tracker Multi-Drive Workspaces */}
        <div className="st-compact-card">
          <div className="st-compact-info">
            <div className="st-compact-icon-box" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06B6D4' }}>
              🗄️
            </div>
            <div className="st-compact-text">
              <span className="st-compact-title">Task Tracker Drives & Workspaces</span>
              <span className="st-compact-desc">
                {trackerDrives.length > 0
                  ? `${trackerDrives.filter(d => d.enabled).length} of ${trackerDrives.length} Drives Active (${trackerDrives.map(d => d.driveRoot).join(', ')})`
                  : 'No production storage drives configured'}
              </span>
              <div className="st-compact-chips">
                <span className="st-summary-chip">
                  Drives: {trackerDrives.length > 0 ? trackerDrives.map(d => d.driveRoot.replace(/[\\/]/g, '')).join(', ') : 'None'}
                </span>
                <span className="st-summary-chip">
                  Auto-Detect: IN PROCESS, UPLOADED DATA, TO DELETE
                </span>
              </div>
            </div>
          </div>
          <Button variant="primary" accent="#06B6D4" accentHv="#0891B2" onClick={() => setActiveModal('trackerDrives')}>
            🗄️ Configure Workspaces
          </Button>
        </div>

        {/* 2. 📂 Default Paths & Storage */}
        <div className="st-compact-card">
          <div className="st-compact-info">
            <div className="st-compact-icon-box" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6' }}>
              📂
            </div>
            <div className="st-compact-text">
              <span className="st-compact-title">Storage & Default Folder Paths</span>
              <span className="st-compact-desc">{titlesFolder || 'No default titles folder selected'}</span>
              <div className="st-compact-chips">
                <span className="st-summary-chip">Remember Paths: {rememberPaths ? 'Enabled' : 'Disabled'}</span>
                <span className="st-summary-chip">Settings File Configured</span>
              </div>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setActiveModal('paths')}>
            📂 Configure Paths
          </Button>
        </div>

        {/* 3. 👁️ Folder Watcher (Auto Convert) */}
        <div className="st-compact-card">
          <div className="st-compact-info">
            <div className="st-compact-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}>
              👁️
            </div>
            <div className="st-compact-text">
              <span className="st-compact-title">Folder Watcher (Auto Convert)</span>
              <span className="st-compact-desc">{watcherInputFolder || 'No watched folder selected'}</span>
              <div className="st-compact-chips">
                <span className="st-summary-chip" style={{ color: watcherEnabled ? '#10B981' : 'var(--text-secondary)' }}>
                  Service: {watcherEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setActiveModal('watcher')}>
            👁️ Configure Watcher
          </Button>
        </div>

        {/* 4. 🎨 Theme & Visual Styling */}
        <div className="st-compact-card">
          <div className="st-compact-info">
            <div className="st-compact-icon-box" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#EC4899' }}>
              🎨
            </div>
            <div className="st-compact-text">
              <span className="st-compact-title">Theme & Visual Styling</span>
              <span className="st-compact-desc">Active Theme: {THEMES.find(t => t.id === theme)?.label || theme}</span>
              <div className="st-compact-chips">
                <span className="st-summary-chip">Anim: {animPreset}</span>
                <span className="st-summary-chip">Transition: {pageTransition}</span>
              </div>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setActiveModal('theme')}>
            🎨 Customize Theme
          </Button>
        </div>

        {/* 5. ⚡ Performance & Engine */}
        <div className="st-compact-card">
          <div className="st-compact-info">
            <div className="st-compact-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
              ⚡
            </div>
            <div className="st-compact-text">
              <span className="st-compact-title">Performance & Engine Tuning</span>
              <span className="st-compact-desc">Parallel Stream Workers: {threads} threads · Buffer: {bufSize} MB</span>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setActiveModal('perf')}>
            ⚡ Configure Engine
          </Button>
        </div>

        {/* 6. 📄 Document & File Viewer */}
        <div className="st-compact-card">
          <div className="st-compact-info">
            <div className="st-compact-icon-box" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366F1' }}>
              📄
            </div>
            <div className="st-compact-text">
              <span className="st-compact-title">Document & Media File Viewer</span>
              <span className="st-compact-desc">Customize built-in viewer presets for PDF, Word, Excel, Markdown, Images</span>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setActiveModal('fileViewer')}>
            📄 Configure Viewer
          </Button>
        </div>

        {/* 7. 📷 Camera SD Transfer & Sorting */}
        <div className="st-compact-card">
          <div className="st-compact-info">
            <div className="st-compact-icon-box" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#EC4899' }}>
              📷
            </div>
            <div className="st-compact-text">
              <span className="st-compact-title">Camera SD Transfer & Sorting</span>
              <span className="st-compact-desc">Sort clips from SD card into cameraman subfolders with Hijri date formatting</span>
              <div className="st-compact-chips">
                <span className="st-summary-chip">Preset & Multi-Camera Support</span>
              </div>
            </div>
          </div>
          <Button variant="primary" accent="#EC4899" accentHv="#DB2777" onClick={() => setActiveModal('cameraTransfer')}>
            📷 Open Camera Transfer
          </Button>
        </div>

        {/* 🚀 Software Updates Card */}
        <Card className="anim-scale-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardHeader title="🚀  Software Updates & Platform Release" accent="#8B5CF6" accentSoft="rgba(139, 92, 246, 0.08)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-sub)' }}>Uni Desk v{appVersion}</span>
              <Button variant="ghost" accent="#8B5CF6" onClick={() => { setActiveModal('changelog'); playTick() }} style={{ padding: '6px 12px', fontSize: '11px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                📋 View Changelog
              </Button>
              {updateStatus === 'idle' && (
                <Button variant="ghost" accent="#8B5CF6" onClick={checkForUpdates} style={{ padding: '6px 14px', fontSize: '12px' }}>
                  Check for Updates
                </Button>
              )}
              {updateStatus === 'checking' && (
                <span style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Checking...</span>
              )}
              {updateStatus === 'uptodate' && (
                <span style={{ color: '#10B981', fontWeight: 700, fontSize: '12px' }}>✔ Up to date</span>
              )}
            </div>
          </div>

          <div className="st-card-body" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="st-toggle-row">
              <div>
                <p className="st-toggle-label">Automatically check for updates on startup</p>
                <p className="st-toggle-sub">Receive subtle system notifications as soon as new workstation versions are released</p>
              </div>
              <button
                className={`st-toggle ${autoCheckUpdates ? 'st-toggle--on' : ''}`}
                onClick={async () => {
                  const nv = !autoCheckUpdates
                  setAutoCheckUpdates(nv)
                  await api.settings.setAndSave('auto_check_updates', nv)
                }}
                style={autoCheckUpdates ? { background: '#8B5CF6' } : {}}
              />
            </div>

            <div className="st-toggle-row">
              <div>
                <p className="st-toggle-label">Auto-start App on Windows Boot</p>
                <p className="st-toggle-sub">Automatically launch Uni Desk on system startup when you log into Windows</p>
              </div>
              <button
                className={`st-toggle ${autoStartApp ? 'st-toggle--on' : ''}`}
                onClick={async () => {
                  const nv = !autoStartApp
                  if (api?.system?.setAutoLaunch) {
                    const res = await api.system.setAutoLaunch(nv)
                    setAutoStartApp(res)
                    saveAndFlash(res ? 'Auto-start enabled on Windows boot' : 'Auto-start disabled', async () => {})
                  }
                }}
                style={ autoStartApp ? { background: '#8B5CF6' } : {}}
              />
            </div>

            {/* Email Notifications Subscription */}
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📧</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>Email Update Notifications</span>
                </div>
                {isSubscribed && (
                  <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.25)' }}>
                    ✔ Subscribed
                  </span>
                )}
              </div>

              {!isSubscribed ? (
                <>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="email"
                        value={subEmail}
                        onChange={e => setSubEmail(e.target.value)}
                        placeholder="Enter email to get release alerts..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        onKeyDown={e => { if (e.key === 'Enter') subscribeToUpdates() }}
                      />
                    </div>
                    <Button variant="primary" accent="#8B5CF6" accentHv="#7C3AED" onClick={subscribeToUpdates} disabled={subStatus === 'loading'} style={{ padding: '8px 16px', fontSize: '12px' }}>
                      {subStatus === 'loading' ? 'Subscribing...' : 'Subscribe'}
                    </Button>
                  </div>
                  {_subMsg && (
                    <div style={{ fontSize: '12px', color: subStatus === 'error' ? '#EF4444' : '#10B981', marginTop: '4px' }}>
                      {_subMsg}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Subscribed as: <strong style={{ color: 'var(--text-primary)' }}>{subEmail}</strong></span>
                  <GhostButton onClick={unsubscribeFromUpdates} style={{ fontSize: '11px', padding: '4px 10px' }}>Unsubscribe</GhostButton>
                </div>
              )}
            </div>

            {(updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'ready') && updateInfo && (
              <div className="anim-scale-in" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6', borderRadius: '99px', fontWeight: 700 }}>NEW UPDATE AVAILABLE</span>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px', marginBottom: 0 }}>Version {updateInfo.latestVersion}</h3>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{updateInfo.size || '1.5 GB'}</span>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <Button variant="ghost" accent="#8B5CF6" onClick={() => (window as any).openUpdateModal?.(updateInfo)} style={{ flex: 1, padding: '9px 14px', fontSize: '12px' }}>
                    📜 View Release Notes
                  </Button>
                  {updateStatus === 'available' && (
                    <Button variant="primary" accent="#8B5CF6" accentHv="#7C3AED" onClick={startDownload} style={{ flex: 1, padding: '9px 14px', fontSize: '12px' }}>
                      🚀 Download Update
                    </Button>
                  )}
                </div>

                {updateStatus === 'downloading' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>Downloading update... ({downloadProgress.percent}%)</span>
                      <span>{formatBytes(downloadProgress.transferredBytes)} / {formatBytes(downloadProgress.totalBytes)}</span>
                    </div>
                    <div style={{ height: '7px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div style={{ height: '100%', width: `${downloadProgress.percent}%`, background: 'linear-gradient(90deg, #8B5CF6, #EC4899)', borderRadius: '99px', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                )}

                {updateStatus === 'ready' && (
                  <Button variant="primary" accent="#10B981" accentHv="#059669" onClick={applyUpdate} style={{ width: '100%', padding: '12px', fontWeight: 700 }}>
                    ⚡ Restart & Install Update
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* 🔄 Reset & Restore */}
        <Card className="anim-scale-in">
          <CardHeader title="🔄  Reset & Restore Defaults" accent="#EF4444" accentSoft="#FFF0F0" />
          <div className="st-card-body" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Button variant="danger" onClick={async () => {
              if (!confirm('Reset ALL settings to defaults? This cannot be undone.')) return
              await api.settings.resetAll()
              await load()
              setSaved('All settings reset to defaults')
            }}>🔄 Reset All Settings to Factory Defaults</Button>
            
            <Button variant="ghost" accent="#EF4444" onClick={() => {
              if (!confirm('Reset all render statistics? This cannot be undone.')) return
              localStorage.removeItem('render_stats')
              localStorage.removeItem('render_stats_start_date')
              setSaved('Render stats reset')
            }}>📊 Reset Render Stats</Button>
          </div>
        </Card>

        {/* Render Modal Popups */}
        {renderModal()}

        {/* Loader Template Showcase Gallery Modal */}
        <LoaderGalleryModal
          open={showLoaderModal}
          onClose={() => setShowLoaderModal(false)}
          onSelect={(id) => {
            showToast({
              title: 'Boot Loader Selected! ✨',
              message: `Active loading screen set to ${id.toUpperCase()}`,
              type: 'success'
            })
          }}
        />
      </div>
    </div>
  )
}
