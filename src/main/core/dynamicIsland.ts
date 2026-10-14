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
import path, { join } from 'path'
import fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { get, setAndSave } from './settingsManager'
import { pauseJob, resumeJob, cancelJob } from './ffmpegRunner'

export interface IslandState {
  active: boolean
  jobId: string
  videoName: string
  currentIdx: number
  totalVideos: number
  percent: number
  fps: string
  speed: string
  eta: string
  thumbnailPath: string
  task: string
  outputFolder: string
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
  currentIdx: 0,
  totalVideos: 0,
  percent: 0,
  fps: '',
  speed: '',
  eta: '',
  thumbnailPath: '',
  task: 'Idle',
  outputFolder: '',
  done: false,
  success: true,
  isPaused: false
}

function getAppIconPath(): string {
  const ico = path.join(app.getAppPath(), 'resources', 'icon.ico')
  if (fs.existsSync(ico)) return ico
  return path.join(app.getAppPath(), 'resources', 'icon.png')
}

/**
 * Calculate dynamic ETA from current progress, duration and speed
 */
function calculateEta(percent: number, speedStr: string): string {
  if (percent <= 0 || percent >= 100) return '--:--'
  const speed = parseFloat(speedStr?.replace(/[^\d.]/g, '') || '1.0') || 1.0
  const remainingPercent = 100 - percent
  // Estimate ~60s typical unit time scaled
  const estSeconds = Math.max(1, Math.round((remainingPercent / 100) * (90 / speed)))
  const m = Math.floor(estSeconds / 60)
  const s = estSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function initDynamicIsland(mainWinGetter: () => BrowserWindow | null): void {
  mainWindowRef = mainWinGetter

  registerIslandIPC()
}

function createIslandWindow(): BrowserWindow {
  if (islandWindow && !islandWindow.isDestroyed()) {
    return islandWindow
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize

  const defaultWidth = 420
  const defaultHeight = 44

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
      nodeIntegration: false
    }
  })

  islandWindow.setAlwaysOnTop(true, 'screen-saver')
  islandWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

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
        shell.openPath(state.outputFolder)
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

  // 2. Hide island smoothly after 3.5 seconds of displaying the celebration capsule
  setTimeout(() => {
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.hide()
    }
  }, 3500)
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

  // Dismiss / Close / Hide handler
  const dismissIsland = () => {
    userDismissed = true
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.hide()
    }
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
      videoName: 'Video_02_Qadam.mp4',
      currentIdx: 2,
      totalVideos: 5,
      percent: 42,
      fps: '59.94 fps',
      speed: '1.8x',
      eta: '01:24',
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
    } else if (action === 'open-folder') {
      if (state.outputFolder && fs.existsSync(state.outputFolder)) {
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

/**
 * Bridge Title Adder Progress events to Dynamic Island
 */
export function onTitleAdderProgressBridge(evt: any, meta?: {
  jobId?: string
  videoName?: string
  currentIdx?: number
  totalVideos?: number
  thumbnailPath?: string
  outputFolder?: string
  task?: string
}): void {
  const percent = Math.round(evt.percent ?? 0)
  const fps = evt.fps ? `${evt.fps} fps` : ''
  const speed = evt.speed ? `${evt.speed}x` : ''
  const eta = calculateEta(percent, evt.speed || '1.0')

  updateIslandState({
    active: true,
    percent,
    fps,
    speed,
    eta,
    ...(meta || {})
  })
}
