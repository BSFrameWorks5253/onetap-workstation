import { app, BrowserWindow, screen } from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { is } from '@electron-toolkit/utils'

function getAppIconPath(): string {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const devPath = join(__dirname, `../../resources/${iconName}`)
  if (fs.existsSync(devPath)) return devPath
  const prodPath = join(process.resourcesPath, iconName)
  if (fs.existsSync(prodPath)) return prodPath
  const pngDev = join(__dirname, '../../resources/icon.png')
  if (fs.existsSync(pngDev)) return pngDev
  const pngProd = join(process.resourcesPath, 'icon.png')
  if (fs.existsSync(pngProd)) return pngProd
  return devPath
}

const viewerWindows = new Map<string, BrowserWindow>()
let cascadeOffset = 0

export function openViewerWindow(targetFilePath: string): BrowserWindow {
  if (!targetFilePath) throw new Error('File path required to open viewer window')

  const normPath = path.resolve(targetFilePath).replace(/\\/g, '/')

  // If a window for this exact file is already open, focus it
  if (viewerWindows.has(normPath)) {
    const existing = viewerWindows.get(normPath)
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore()
      existing.show()
      existing.focus()
      return existing
    }
    viewerWindows.delete(normPath)
  }

  // Calculate cascade position
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const defaultWidth = Math.min(1240, Math.round(screenWidth * 0.82))
  const defaultHeight = Math.min(840, Math.round(screenHeight * 0.85))

  const baseX = Math.round((screenWidth - defaultWidth) / 2)
  const baseY = Math.round((screenHeight - defaultHeight) / 2)

  cascadeOffset = (cascadeOffset + 24) % 180
  const winX = Math.max(10, baseX + cascadeOffset - 60)
  const winY = Math.max(10, baseY + cascadeOffset - 60)

  const fileName = path.basename(targetFilePath)

  const win = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    x: winX,
    y: winY,
    minWidth: 680,
    minHeight: 460,
    show: false,
    title: `${fileName} — One Tap Viewer`,
    icon: getAppIconPath(),
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'win32' ? 'hidden' : 'default',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#0f172a',
      symbolColor: '#cbd5e1',
      height: 38
    } : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })

  viewerWindows.set(normPath, win)

  // Explicit AppUserModelID on Windows for clean taskbar grouping
  if (process.platform === 'win32') {
    try {
      win.setAppDetails({ appId: 'com.bsframework.onetap.viewer' })
    } catch {}
  }

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  const hash = `file-viewer?file=${encodeURIComponent(normPath)}`
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }

  win.on('closed', () => {
    viewerWindows.delete(normPath)
  })

  return win
}

export function closeAllViewerWindows(): void {
  for (const win of viewerWindows.values()) {
    if (win && !win.isDestroyed()) {
      win.close()
    }
  }
  viewerWindows.clear()
}
