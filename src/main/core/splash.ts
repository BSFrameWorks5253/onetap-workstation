import fs from 'fs'
import path from 'path'
import os from 'os'
import { app, BrowserWindow, screen } from 'electron'

export interface ChildAppLoaderConfig {
  appId: string
  enabled?: boolean
  artworkUrl?: string
  productName?: string
  versionText?: string
  tagline?: string
  artistName?: string
  artworkTitle?: string
  durationMs?: number
  logoText?: string
  badgeGradient?: string
  artworkFit?: 'cover' | 'contain'
  artworkPosition?: string
}

/**
 * Resolves the dynamic loader configuration for this child app.
 */
export function resolveChildAppLoaderConfig(appId: string, fallbackAppName: string): ChildAppLoaderConfig {
  const defaultFallback: ChildAppLoaderConfig = {
    appId,
    enabled: true,
    productName: fallbackAppName,
    versionText: `v${app.getVersion() || '26.10.30'}`,
    tagline: 'Autonomous Video & Media Production Workstation',
    artistName: 'Anything Creative Ecosystem',
    artworkTitle: 'Master Studio Edition',
    durationMs: 2500,
    logoText: 'OT',
    badgeGradient: 'linear-gradient(135deg, #ef4444, #f97316)',
    artworkUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85',
    artworkFit: 'cover',
    artworkPosition: 'center'
  }

  // 1. Check CLI argument --loader-config=...
  for (const arg of process.argv) {
    if (arg.startsWith('--loader-config=')) {
      const cfgPath = arg.replace('--loader-config=', '').replace(/^["']|["']$/g, '')
      if (fs.existsSync(cfgPath)) {
        try {
          return { ...defaultFallback, ...JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) }
        } catch (e) {
          console.warn('[Loader] Error reading CLI config from', cfgPath, e)
        }
      }
    }
  }

  // 2. Check %APPDATA%/Anything/loaders/<appId>.json
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  const candidateGlobalPaths = [
    path.join(appData, 'Anything', 'loaders', `${appId}.json`),
    path.join(appData, 'anything', 'loaders', `${appId}.json`)
  ]

  for (const p of candidateGlobalPaths) {
    if (fs.existsSync(p)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(p, 'utf-8'))
        return { ...defaultFallback, ...loaded }
      } catch (e) {
        console.warn('[Loader] Error reading global config from', p, e)
      }
    }
  }

  // 3. Check bundled or local release loader-config.json
  const candidateLocalPaths = [
    path.join(app.getAppPath(), 'loader-config.json'),
    path.join(process.resourcesPath, 'loader-config.json'),
    path.join(__dirname, '..', 'loader-config.json'),
    path.join(__dirname, '..', '..', 'loader-config.json'),
    path.join(__dirname, 'loader-config.json')
  ]

  for (const p of candidateLocalPaths) {
    if (fs.existsSync(p)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(p, 'utf-8'))
        return { ...defaultFallback, ...loaded }
      } catch {}
    }
  }

  return defaultFallback
}

let splashWindow: BrowserWindow | null = null

function resolveArtworkSource(artworkUrl?: string): string {
  if (!artworkUrl) {
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85'
  }
  if (artworkUrl.startsWith('http://') || artworkUrl.startsWith('https://') || artworkUrl.startsWith('data:')) {
    return artworkUrl
  }
  try {
    if (fs.existsSync(artworkUrl)) {
      const ext = path.extname(artworkUrl).toLowerCase().replace('.', '')
      const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const buf = fs.readFileSync(artworkUrl)
      return `data:${mime};base64,${buf.toString('base64')}`
    }
  } catch {}
  return artworkUrl
}

export function showChildAppSplash(
  config: ChildAppLoaderConfig,
  onFinished: () => void
): BrowserWindow | null {
  if (config.enabled === false) {
    onFinished()
    return null
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const splashWidth = 720
  const splashHeight = 440

  splashWindow = new BrowserWindow({
    width: splashWidth,
    height: splashHeight,
    x: Math.round((screenWidth - splashWidth) / 2),
    y: Math.round((screenHeight - splashHeight) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const artworkSrc = resolveArtworkSource(config.artworkUrl)
  const fitMode = config.artworkFit || 'cover'
  const positionMode = config.artworkPosition || 'center'

  const splashHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
    }
    .splash-card {
      width: ${splashWidth}px;
      height: ${splashHeight}px;
      border-radius: 20px;
      position: relative;
      overflow: hidden;
      background: #0f1117;
      box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.12);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .artwork-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: ${fitMode};
      object-position: ${positionMode};
      opacity: 0.55;
      filter: saturate(1.15) contrast(1.05);
      transform: scale(1.02);
      transition: transform 6s ease-out;
    }
    .vignette {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15, 17, 23, 0.2) 0%, rgba(15, 17, 23, 0.85) 75%, rgba(15, 17, 23, 0.98) 100%);
    }
    .content-top {
      position: relative;
      z-index: 10;
      padding: 28px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand-cluster {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .monogram-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: ${config.badgeGradient || 'linear-gradient(135deg, #ef4444, #f97316)'};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 900;
      font-size: 18px;
      letter-spacing: -0.03em;
      box-shadow: 0 8px 20px rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.25);
    }
    .title-group h1 {
      color: #ffffff;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .version-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #e2e8f0;
    }
    .title-group p {
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-weight: 500;
      margin-top: 2px;
    }
    .content-bottom {
      position: relative;
      z-index: 10;
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .meta-credits {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      font-weight: 500;
    }
    .progress-bar-bg {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      overflow: hidden;
      position: relative;
    }
    .progress-bar-fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #38bdf8, #818cf8, #c084fc);
      border-radius: 9999px;
      animation: loadFill ${Math.max(1800, (config.durationMs || 2500) - 400)}ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    @keyframes loadFill {
      0% { width: 0%; }
      40% { width: 55%; }
      80% { width: 88%; }
      100% { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="splash-card">
    <img class="artwork-bg" src="${artworkSrc}" alt="Artwork" />
    <div class="vignette"></div>

    <div class="content-top">
      <div class="brand-cluster">
        <div class="monogram-box">${config.logoText || 'OT'}</div>
        <div class="title-group">
          <h1>
            <span>${config.productName || 'One Tap'}</span>
            <span class="version-pill">${config.versionText || 'v26.10.30'}</span>
          </h1>
          <p>${config.tagline || 'Autonomous Video & Media Production Workstation'}</p>
        </div>
      </div>
    </div>

    <div class="content-bottom">
      <div class="meta-credits">
        <span>${config.artworkTitle || 'Master Studio Edition'}</span>
        <span>${config.artistName || 'Anything Creative Ecosystem'}</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill"></div>
      </div>
    </div>
  </div>
</body>
</html>`

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)

  splashWindow.once('ready-to-show', () => {
    splashWindow?.show()
  })

  let hasFinished = false
  const finish = () => {
    if (hasFinished) return
    hasFinished = true
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    onFinished()
  }

  const duration = config.durationMs || 2500
  setTimeout(finish, duration)

  return splashWindow
}

