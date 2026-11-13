/**
 * ====================================================================
 * DYNAMIC ISLAND & MINI-WIDGET RENDERING MONITOR (src/main/core/dynamicIsland.ts)
 * ====================================================================
 * Always-on-top, frameless, semi-transparent frosted acrylic/mica pill:
 * - Native Windows WS_EX_TOOLWINDOW / WS_EX_TOPMOST (never steals focus)
 * - Compact Idle/Active Pill State: [ ⚡ Title Adder: 42% | 2/5 left ]
 * - Expanded Card State on Hover/Click: Drops down with thumbnail, ETA, FPS, speed, actions
 * - Draggable Picture-in-Picture (PIP) with multi-monitor position persistence
 * - Audio feedback on queue completion (Apple-style chime) + Windows Toast Notification
 * ====================================================================
 */

import { app, BrowserWindow, screen, ipcMain, shell, Notification } from 'electron'
import { openInEcosystemExplorer } from './ecosystemExplorer'
import path, { join } from 'path'
import fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { get, setAndSave } from './settingsManager'
import { pauseJob, resumeJob, cancelJob } from './ffmpegRunner'
import { getVideoEncoder } from './gpuDetector'

export interface IslandState {
  active: boolean
  jobId: string
  videoName: string
  nextVideoName?: string
  currentIdx: number
  totalVideos: number
  percent: number
  fps: string
  speed: string
  eta: string
  thumbnailPath: string
  thumbnailDataUrl?: string
  task: string
  outputFolder: string
  lastOutputPath?: string
  encoder?: string
  done: boolean
  success: boolean
  isPaused: boolean
}

// User dismissal flag — prevents island from auto-showing again on ffmpeg progress ticks after the user closed it
let userDismissed = false
let currentJobId = ''

let islandWindow: BrowserWindow | null = null
let mainWindowRef: (() => BrowserWindow | null) | null = null

const state: IslandState = {
  active: false,
  jobId: '',
  videoName: '',
  nextVideoName: '',
  currentIdx: 0,
  totalVideos: 0,
  percent: 0,
  fps: '',
  speed: '',
  eta: '',
  thumbnailPath: '',
  thumbnailDataUrl: '',
  task: 'Idle',
  outputFolder: '',
  lastOutputPath: '',
  encoder: '',
  done: false,
  success: true,
  isPaused: false
}

function toDataUrl(filePath: string): string {
  if (!filePath) return ''
  try {
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg'
      const buf = fs.readFileSync(filePath)
      if (buf.length < 6 * 1024 * 1024) {
        return `data:${mime};base64,${buf.toString('base64')}`
      }
    }
  } catch {}
  return ''
}

// Strict LRU Cache for base64 thumbnails (max 4 entries to stay well below 150MB heap budget)
const MAX_LRU_THUMBS = 4
const thumbLruCache = new Map<string, string>()

function getCachedThumbDataUrl(filePath: string): string {
  if (!filePath) return ''
  if (thumbLruCache.has(filePath)) {
    const val = thumbLruCache.get(filePath)!
    thumbLruCache.delete(filePath)
    thumbLruCache.set(filePath, val)
    return val
  }
  const dataUrl = toDataUrl(filePath)
  if (dataUrl) {
    if (thumbLruCache.size >= MAX_LRU_THUMBS) {
      const oldestKey = thumbLruCache.keys().next().value
      if (oldestKey) thumbLruCache.delete(oldestKey)
    }
    thumbLruCache.set(filePath, dataUrl)
  }
  return dataUrl
}

export function performIslandMemoryCleanup(): void {
  // Prune LRU thumbnail cache down to current active thumbnail only
  if (state.thumbnailPath && thumbLruCache.has(state.thumbnailPath)) {
    const activeVal = thumbLruCache.get(state.thumbnailPath)!
    thumbLruCache.clear()
    thumbLruCache.set(state.thumbnailPath, activeVal)
  } else {
    thumbLruCache.clear()
  }

  // Silent garbage collection trigger and renderer cache release
  try {
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.webContents.session?.clearImageCache?.().catch(() => {})
      islandWindow.webContents.send('island:gc')
    }
    const mainWin = mainWindowRef ? mainWindowRef() : null
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('island:gc')
    }
  } catch {}

  // Trigger V8 heap compaction if available
  try {
    if (typeof (global as any).gc === 'function') {
      ;(global as any).gc()
    }
  } catch {}
}

function getAppIconPath(): string {
  const ico = path.join(app.getAppPath(), 'resources', 'icon.ico')
  if (fs.existsSync(ico)) return ico
  return path.join(app.getAppPath(), 'resources', 'icon.png')
}

/**
 * Calculate dynamic human-readable ETA from current progress, duration and speed (e.g. "1m 24s left")
 */
function calculateEta(percent: number, speedStr: string): string {
  if (percent <= 0) return 'Calculating...'
  if (percent >= 100) return '0s left'
  const speed = parseFloat(speedStr?.replace(/[^\d.]/g, '') || '1.0') || 1.0
  const remainingPercent = 100 - percent
  // Estimate ~60s typical unit time scaled
  const estSeconds = Math.max(1, Math.round((remainingPercent / 100) * (90 / speed)))
  const m = Math.floor(estSeconds / 60)
  const s = estSeconds % 60
  if (m > 0) return `${m}m ${s}s left`
  return `${s}s left`
}

let gcInterval: NodeJS.Timeout | null = null
function startSilentGcTimer(): void {
  if (gcInterval) clearInterval(gcInterval)
  gcInterval = setInterval(() => {
    performIslandMemoryCleanup()
  }, 45000)
}

export function initDynamicIsland(mainWinGetter: () => BrowserWindow | null): void {
  mainWindowRef = mainWinGetter
  try {
    const enc = getVideoEncoder()
    state.encoder = enc.label
  } catch {}

  startSilentGcTimer()
  registerIslandIPC()
}

function createIslandWindow(): BrowserWindow {
  if (islandWindow && !islandWindow.isDestroyed()) {
    return islandWindow
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize

  const defaultWidth = 450
  const defaultHeight = 80

  // Check saved position
  const savedX = get('island_pos_x') as number | null
  const savedY = get('island_pos_y') as number | null

  const x = (typeof savedX === 'number' && !isNaN(savedX))
    ? savedX
    : Math.round((screenWidth - defaultWidth) / 2)
  const y = (typeof savedY === 'number' && !isNaN(savedY))
    ? savedY
    : 14

  islandWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: false, // Never steal focus from games, full-screen apps, or active text editors!
    hasShadow: false,
    backgroundColor: '#00000000',
    type: 'toolbar', // Windows WS_EX_TOOLWINDOW
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  islandWindow.setAlwaysOnTop(true, 'screen-saver')
  islandWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  islandWindow.webContents.on('did-finish-load', () => {
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.webContents.send('island:update', state)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    islandWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#dynamic-island`)
  } else {
    islandWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'dynamic-island' })
  }

  islandWindow.on('moved', () => {
    if (!islandWindow || islandWindow.isDestroyed()) return
    const [curX, curY] = islandWindow.getPosition()
    setAndSave('island_pos_x', curX)
    setAndSave('island_pos_y', curY)
  })

  islandWindow.on('closed', () => {
    islandWindow = null
  })

  return islandWindow
}

export function getIslandState(): IslandState {
  return { ...state }
}

export function updateIslandState(partial: Partial<IslandState>): void {
  // If a new render batch begins or jobId changes, reset user dismissal
  if (partial.jobId && partial.jobId !== currentJobId) {
    currentJobId = partial.jobId
    userDismissed = false
  }

  // Pre-generate base64 data URL for local thumbnails with strict LRU caching to eliminate memory leaks
  if (partial.thumbnailPath) {
    if (partial.thumbnailPath === state.thumbnailPath && state.thumbnailDataUrl) {
      partial.thumbnailDataUrl = state.thumbnailDataUrl
    } else if (!partial.thumbnailDataUrl) {
      const dataUrl = getCachedThumbDataUrl(partial.thumbnailPath)
      if (dataUrl) {
        partial.thumbnailDataUrl = dataUrl
      }
    }
  }

  Object.assign(state, partial)

  const isEnabled = get('island_enabled') !== false

  // If active, enabled, and NOT explicitly dismissed by user, show window
  if (state.active && isEnabled && !userDismissed) {
    if (!islandWindow || islandWindow.isDestroyed()) {
      createIslandWindow()
    } else if (!islandWindow.isVisible()) {
      islandWindow.showInactive()
    }
  }

  // Broadcast state to Island window and main window
  if (islandWindow && !islandWindow.isDestroyed()) {
    islandWindow.webContents.send('island:update', state)
  }

  const mainWin = mainWindowRef ? mainWindowRef() : null
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('island:update', state)
  }

  // Handle completion actions
  if (partial.done) {
    state.active = false
    handleQueueCompletion()
  }
}

function handleQueueCompletion(): void {
  // 1. Show Windows Native Action Center Toast Notification
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: '🎬 Title Adder Queue Complete!',
      body: `Successfully processed ${state.totalVideos} videos (${state.videoName || 'Batch'}). Output ready.`,
      icon: getAppIconPath(),
      silent: false
    })

    notif.on('click', () => {
      if (state.outputFolder && fs.existsSync(state.outputFolder)) {
        openInEcosystemExplorer(state.outputFolder)
      } else {
        const mainWin = mainWindowRef ? mainWindowRef() : null
        if (mainWin && !mainWin.isDestroyed()) {
          if (mainWin.isMinimized()) mainWin.restore()
          mainWin.show()
          mainWin.focus()
        }
      }
    })

    notif.show()
  }

  // 2. Display completion capsule briefly, then smoothly dissolve & remove island from screen and app
  const waitMs = state.success ? 2800 : 1500
  setTimeout(() => {
    // Notify both windows to play the dissolve animation
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.webContents.send('island:dissolve')
    }
    const mainWin = mainWindowRef ? mainWindowRef() : null
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('island:dissolve')
    }

    // After dissolve animation completes (650ms), hide standalone window and clear active/done state
    setTimeout(() => {
      if (islandWindow && !islandWindow.isDestroyed()) {
        islandWindow.hide()
      }
      state.active = false
      state.done = false
      state.task = 'Idle'
      userDismissed = false

      if (islandWindow && !islandWindow.isDestroyed()) {
        islandWindow.webContents.send('island:update', state)
      }
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('island:update', state)
      }
      // Silent memory cleanup upon batch completion
      performIslandMemoryCleanup()
    }, 650)
  }, waitMs)
}

function registerIslandIPC(): void {
  // Set Window Size (for smooth expand/collapse between capsule and card)
  ipcMain.handle('island:setSize', (_e, width: number, height: number) => {
    if (!islandWindow || islandWindow.isDestroyed()) return
    islandWindow.setSize(Math.round(width), Math.round(height))
  })

  // Set Window Position (PIP dragging)
  ipcMain.handle('island:savePosition', (_e, x: number, y: number) => {
    setAndSave('island_pos_x', Math.round(x))
    setAndSave('island_pos_y', Math.round(y))
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.setPosition(Math.round(x), Math.round(y))
    }
  })

  // Get current state
  ipcMain.handle('island:getState', () => {
    return { ...state }
  })

  // Dismiss / Close / Hide handler with dissolve transition
  const dismissIsland = () => {
    userDismissed = true
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.webContents.send('island:dissolve')
    }
    const mainWin = mainWindowRef ? mainWindowRef() : null
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('island:dissolve')
    }

    setTimeout(() => {
      if (islandWindow && !islandWindow.isDestroyed()) {
        islandWindow.hide()
      }
      state.active = false
      state.done = false
      state.task = 'Idle'

      if (islandWindow && !islandWindow.isDestroyed()) {
        islandWindow.webContents.send('island:update', state)
      }
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('island:update', state)
      }
    }, 550)

    return { success: true }
  }

  ipcMain.handle('island:close', dismissIsland)
  ipcMain.handle('island:hide', dismissIsland)

  // Toggle or Preview Dynamic Island on Demand
  ipcMain.handle('island:preview', () => {
    userDismissed = false
    if (!islandWindow || islandWindow.isDestroyed()) {
      createIslandWindow()
    } else {
      islandWindow.showInactive()
    }
    updateIslandState({
      active: true,
      done: false,
      videoName: '1448-03-12_02E-12-10MZ-30310666.mp4',
      nextVideoName: '1448-03-14_Video_03.mp4',
      currentIdx: 2,
      totalVideos: 5,
      percent: 42,
      fps: '59.94 fps',
      speed: '1.8x',
      eta: '01:24',
      thumbnailPath: getAppIconPath(),
      task: 'Rendering subtitle typography for Video_02.mp4',
      outputFolder: (get('last_output_adder') as string) || ''
    })
    return { success: true }
  })

  // Toggle or check if Dynamic Island is enabled
  ipcMain.handle('island:setEnabled', (_e, enabled: boolean) => {
    setAndSave('island_enabled', enabled)
    if (!enabled) {
      userDismissed = true
      if (islandWindow && !islandWindow.isDestroyed()) {
        islandWindow.hide()
      }
    } else {
      userDismissed = false
      if (state.active) {
        if (!islandWindow || islandWindow.isDestroyed()) {
          createIslandWindow()
        } else if (!islandWindow.isVisible()) {
          islandWindow.showInactive()
        }
      }
    }
    return { success: true, enabled }
  })

  ipcMain.handle('island:isEnabled', () => {
    return get('island_enabled') !== false
  })

  // Quick action controller
  ipcMain.handle('island:action', async (_e, action: string) => {
    console.log(`[DynamicIsland] Action triggered: ${action}`)
    if (action === 'close' || action === 'dismiss' || action === 'hide') {
      dismissIsland()
    } else if (action === 'pause') {
      if (state.jobId) {
        const paused = pauseJob(state.jobId)
        updateIslandState({ isPaused: paused })
      }
    } else if (action === 'resume') {
      if (state.jobId) {
        const resumed = resumeJob(state.jobId)
        updateIslandState({ isPaused: !resumed })
      }
    } else if (action === 'cancel') {
      if (state.jobId) {
        cancelJob(state.jobId)
        updateIslandState({ active: false, done: true, success: false })
      }
    } else if (action === 'open-folder' || action === 'reveal-output') {
      const folder = state.outputFolder || (state.lastOutputPath ? path.dirname(state.lastOutputPath) : '')
      if (folder && fs.existsSync(folder)) {
        openInEcosystemExplorer(folder)
      }
    } else if (action === 'play-video' || action === 'open-video') {
      if (state.lastOutputPath && fs.existsSync(state.lastOutputPath)) {
        shell.openPath(state.lastOutputPath)
      } else if (state.outputFolder && fs.existsSync(state.outputFolder)) {
        shell.openPath(state.outputFolder)
      }
    } else if (action === 'focus-app') {
      const mainWin = mainWindowRef ? mainWindowRef() : null
      if (mainWin && !mainWin.isDestroyed()) {
        if (mainWin.isMinimized()) mainWin.restore()
        mainWin.show()
        mainWin.focus()
        mainWin.webContents.send('app:navigate', 'adder')
      }
    }
    return { success: true }
  })
}

// Throttle tracker to prevent IPC event flooding on high-FPS renders
let lastBridgeTick = 0

/**
 * Bridge Title Adder Progress events to Dynamic Island
 */
export function onTitleAdderProgressBridge(evt: any, meta?: {
  jobId?: string
  videoName?: string
  nextVideoName?: string
  currentIdx?: number
  totalVideos?: number
  thumbnailPath?: string
  thumbnailDataUrl?: string
  outputFolder?: string
  lastOutputPath?: string
  task?: string
}): void {
  const percent = Math.round(evt.percent ?? 0)
  const now = Date.now()
  const isBoundary = percent <= 0 || percent >= 100 || (meta?.jobId && meta.jobId !== state.jobId)

  // Throttle updates to at most once every 250ms unless starting, completing, or switching jobs
  if (!isBoundary && now - lastBridgeTick < 250) {
    return
  }
  lastBridgeTick = now

  const fps = evt.fps ? `${evt.fps} fps` : ''
  const speedVal = evt.speed ? (typeof evt.speed === 'number' ? evt.speed.toFixed(1) : String(evt.speed).replace(/x$/i, '')) : ''
  const speed = speedVal ? `${speedVal}x` : (state.speed || '1.0x')
  const eta = calculateEta(percent, speedVal || '1.0')

  updateIslandState({
    active: true,
    percent,
    fps,
    speed,
    eta,
    ...(meta || {})
  })
}
