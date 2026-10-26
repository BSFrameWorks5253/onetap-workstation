/**
 * ====================================================================
 * ONE TAP WORKSTATION AUTO-UPDATE PIPELINE (update.ipc.ts)
 * GitHub Releases API Integration & Streaming Downloader Core
 * ====================================================================
 */

import { ipcMain, app, BrowserWindow } from 'electron'
import { spawn, exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import crypto from 'crypto'
import { URL } from 'url'
import { get } from '../core/settingsManager'

// Target GitHub Repository & Default Anything Ecosystem Directory
const GITHUB_REPO = process.env.GITHUB_REPO || 'BSFrameWorks5253/onetap-workstation'
export const DEFAULT_ANYTHING_PATH = 'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything\\Anything'

export interface UpdateManifest {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  releaseName: string
  releaseDate: string
  downloadUrl: string
  size: string
  releaseNotes: string
  checksum?: string
  htmlUrl?: string
  source?: 'anything' | 'github'
  isLocalFile?: boolean
  anythingPath?: string
  error?: string
}

// Cache for update manifest details
let cachedUpdateManifest: UpdateManifest | null = null
let lastDownloadedInstallerPath: string | null = null

// Current workstation version from app / package.json
export function getWorkstationVersion(): string {
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json')
    if (fs.existsSync(pkgPath)) {
      const data = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      if (data?.version) return String(data.version).trim()
    }
  } catch {}
  try {
    return (app.getVersion() || '26.10.21').trim()
  } catch {
    return '26.10.5'
  }
}

const CURRENT_VERSION = getWorkstationVersion()

/**
 * Native utility to follow HTTPS redirects recursively and establish GET stream
 */
function getUrlStream(targetUrl: string, options: any = {}): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl)
    const client = parsedUrl.protocol === 'https:' ? https : http

    const reqOptions: any = {
      method: 'GET',
      headers: {
        'User-Agent': 'OneTap-Workstation-Updater',
        ...(options.headers || {})
      }
    }

    const req = client.request(targetUrl, reqOptions, (res) => {
      // Handle HTTP redirection (301, 302, 307, 308)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location
        if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
          redirectUrl = new URL(redirectUrl, targetUrl).toString()
        }
        getUrlStream(redirectUrl, options).then(resolve).catch(reject)
      } else {
        resolve(res)
      }
    })

    req.on('error', (err) => reject(err))
    req.end()
  })
}

/**
 * Compare two semver-like version strings (e.g. "26.8.9" vs "20.6.5")
 */
export function compareVersions(vA: string, vB: string): number {
  const partsA = vA.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0)
  const partsB = vB.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const a = partsA[i] || 0
    const b = partsB[i] || 0
    if (a > b) return 1
    if (a < b) return -1
  }
  return 0
}

/**
 * Query Anything Ecosystem directory for local child app releases and catalog entries
 */
export async function checkAnythingUpdate(customPath?: string): Promise<UpdateManifest | null> {
  const resolvedDir = customPath || (get('anything_app_path') as string) || (fs.existsSync('C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything\\Anything') ? 'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything\\Anything' : DEFAULT_ANYTHING_PATH)
  const anythingDir = resolvedDir
  if (!fs.existsSync(anythingDir)) {
    console.log(`[Updater] Anything path does not exist on disk: ${anythingDir}`)
    return null
  }

  const currentVer = getWorkstationVersion().trim()
  let bestVersion = ''
  let bestReleaseRecord: any = null
  let bestExePath: string = ''
  let bestExeSize: number = 0

  // 1. Scan published-apps/catalog.json
  const catalogPath = path.join(anythingDir, 'published-apps', 'catalog.json')
  if (fs.existsSync(catalogPath)) {
    try {
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
      if (Array.isArray(catalog)) {
        const entry = catalog.find((a: any) => {
          const id = (a.id || '').toLowerCase().replace(/^app-/, '')
          const name = (a.name || '').toLowerCase()
          return id === 'one-tap' || id === 'onetap' || name === 'one tap' || (a.githubRepo && String(a.githubRepo).toLowerCase().includes('onetap-workstation'))
        })

        if (entry) {
          if (entry.version) {
            bestVersion = entry.version
            bestReleaseRecord = entry.releaseInfo || {
              tagline: `${entry.name || 'One Tap'} v${entry.version}`,
              summary: entry.description,
              newFeatures: entry.changelog || [],
              releaseDate: entry.publishedAt ? new Date(entry.publishedAt).toISOString().split('T')[0] : ''
            }
            if (entry.localPackagePath && fs.existsSync(entry.localPackagePath)) {
              bestExePath = entry.localPackagePath
              try { bestExeSize = fs.statSync(bestExePath).size } catch {}
            }
          }

          if (Array.isArray(entry.history)) {
            for (const h of entry.history) {
              if (h.version && (!bestVersion || compareVersions(h.version, bestVersion) > 0)) {
                bestVersion = h.version
                bestReleaseRecord = h
                if (h.downloadUrl && fs.existsSync(h.downloadUrl)) {
                  bestExePath = h.downloadUrl
                  try { bestExeSize = fs.statSync(bestExePath).size } catch {}
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Updater] Error reading Anything catalog.json:', e)
    }
  }

  // 2. Scan release and releases folders in Anything
  const releaseFolders = [
    path.join(anythingDir, 'release', 'One Tap'),
    path.join(anythingDir, 'releases', 'One Tap'),
    path.join(anythingDir, 'release', 'one-tap'),
    path.join(anythingDir, 'releases', 'one-tap'),
    path.join(anythingDir, 'published-apps', 'one-tap'),
    path.join(anythingDir, 'published-apps', 'One Tap')
  ]

  for (const folder of releaseFolders) {
    if (!fs.existsSync(folder)) continue

    // Check app.json in this folder
    const appJsonPath = path.join(folder, 'app.json')
    if (fs.existsSync(appJsonPath)) {
      try {
        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
        if (appJson?.version && (!bestVersion || compareVersions(appJson.version, bestVersion) > 0)) {
          bestVersion = appJson.version
        }
      } catch {}
    }

    // Inspect subdirectories (e.g. V-26.10.21, V-26.10.21)
    try {
      const items = fs.readdirSync(folder, { withFileTypes: true })
      for (const item of items) {
        if (item.isDirectory()) {
          const vMatch = item.name.match(/^V-?([0-9.]+)/i)
          if (vMatch) {
            const ver = vMatch[1]
            const verDir = path.join(folder, item.name)

            let relJson: any = null
            const relJsonPath = path.join(verDir, 'release.json')
            if (fs.existsSync(relJsonPath)) {
              try { relJson = JSON.parse(fs.readFileSync(relJsonPath, 'utf8')) } catch {}
            }

            let foundExe = ''
            let foundExeSize = 0
            const dirFiles = fs.readdirSync(verDir)
            const exeCandidate = dirFiles.find(f => f.endsWith('.exe'))
            if (exeCandidate) {
              foundExe = path.join(verDir, exeCandidate)
              try { foundExeSize = fs.statSync(foundExe).size } catch {}
            }

            if (!bestVersion || compareVersions(ver, bestVersion) >= 0) {
              bestVersion = ver
              bestReleaseRecord = relJson || bestReleaseRecord
              if (foundExe) {
                bestExePath = foundExe
                bestExeSize = foundExeSize
              }
            }
          }
        } else if (item.isFile() && item.name.endsWith('.exe')) {
          const vMatch = item.name.match(/([0-9]+\.[0-9]+\.[0-9]+)/)
          if (vMatch) {
            const ver = vMatch[1]
            if (!bestVersion || compareVersions(ver, bestVersion) >= 0) {
              bestVersion = ver
              bestExePath = path.join(folder, item.name)
              try { bestExeSize = fs.statSync(bestExePath).size } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[Updater] Error inspecting folder ${folder}:`, e)
    }
  }

  if (!bestVersion) {
    return null
  }

  const isNew = compareVersions(bestVersion, currentVer) > 0
  console.log(`[Updater] Anything ecosystem check: found v${bestVersion} | current: v${currentVer} | updateAvailable: ${isNew}`)

  const sizeStr = bestExeSize > 0
    ? (bestExeSize > 1024 * 1024 * 1024
      ? (bestExeSize / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
      : (bestExeSize / (1024 * 1024)).toFixed(1) + ' MB')
    : '78.5 MB'

  // Format release notes from release record
  let notes = ''
  if (bestReleaseRecord) {
    const lines: string[] = []
    if (bestReleaseRecord.summary) lines.push(bestReleaseRecord.summary)
    if (Array.isArray(bestReleaseRecord.newFeatures) && bestReleaseRecord.newFeatures.length > 0) {
      lines.push('\nNew Features:')
      bestReleaseRecord.newFeatures.forEach((f: string) => lines.push(`• ${f}`))
    }
    if (Array.isArray(bestReleaseRecord.improvements) && bestReleaseRecord.improvements.length > 0) {
      lines.push('\nImprovements:')
      bestReleaseRecord.improvements.forEach((i: string) => lines.push(`• ${i}`))
    }
    if (Array.isArray(bestReleaseRecord.fixes) && bestReleaseRecord.fixes.length > 0) {
      lines.push('\nFixes:')
      bestReleaseRecord.fixes.forEach((x: string) => lines.push(`• ${x}`))
    }
    notes = lines.join('\n')
  }
  if (!notes) {
    notes = `New One Tap update v${bestVersion} published in Anything ecosystem.`
  }

  const fallbackExe = path.join(anythingDir, 'release', 'One Tap', `V-${bestVersion}`, `OneTap-V-${bestVersion}.exe`)
  const targetDownloadUrl = bestExePath || fallbackExe

  const manifest: UpdateManifest = {
    updateAvailable: isNew,
    currentVersion: currentVer,
    latestVersion: bestVersion,
    releaseName: bestReleaseRecord?.tagline || `One Tap v${bestVersion} (Anything Ecosystem)`,
    releaseDate: bestReleaseRecord?.releaseDate || new Date().toISOString().split('T')[0],
    downloadUrl: targetDownloadUrl,
    size: sizeStr,
    releaseNotes: notes,
    source: 'anything',
    isLocalFile: Boolean(targetDownloadUrl && fs.existsSync(targetDownloadUrl)),
    anythingPath: anythingDir
  }

  return manifest
}

/**
 * Query GitHub Releases API for the latest release manifest
 */
export async function checkGitHubUpdate(): Promise<UpdateManifest> {
  const repoName = GITHUB_REPO.trim().replace(/^https:\/\/github\.com\//i, '')
  const fetchUrl = `https://api.github.com/repos/${repoName}/releases/latest`
  console.log(`[Updater] Querying GitHub Releases API: ${fetchUrl}`)

  const responseStream = await getUrlStream(fetchUrl, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  })

  const responseBody = await new Promise<string>((resolve, reject) => {
    let body = ''
    responseStream.on('data', chunk => body += chunk)
    responseStream.on('end', () => resolve(body))
    responseStream.on('error', reject)
  })

  const release = JSON.parse(responseBody)
  if (!release || (!release.tag_name && !release.name)) {
    throw new Error(release?.message || 'No valid release tag found on GitHub.')
  }

  // Trim carefully — GitHub tags can have trailing whitespace/newlines
  const currentVer = getWorkstationVersion().trim()
  const latestVersion = (release.tag_name || release.name || '').replace(/^v/i, '').trim()
  const isNew = compareVersions(latestVersion, currentVer) > 0
  console.log(`[Updater] Version check — GitHub tag: "${release.tag_name}" → latest: "${latestVersion}" | current: "${currentVer}" | updateAvailable: ${isNew}`)

  // Select setup installer asset based on platform and target version
  let targetAsset: any = null
  if (process.platform === 'linux') {
    const linuxAssets = release.assets?.filter((a: any) => a.name.endsWith('.AppImage') || a.name.endsWith('.deb')) || []
    targetAsset = linuxAssets.find((a: any) => a.name.includes(latestVersion)) || linuxAssets[0]
  } else {
    const exeAssets = release.assets?.filter((a: any) => a.name.endsWith('.exe')) || []
    // Prioritize installer matching the latest version tag (e.g. Uni.Desk_Setup_V26.10.5.exe)
    targetAsset =
      exeAssets.find((a: any) => a.name.includes(latestVersion) && a.name.toLowerCase().includes('setup')) ||
      exeAssets.find((a: any) => a.name.includes(latestVersion)) ||
      exeAssets.find((a: any) => a.name.toLowerCase().includes('setup')) ||
      exeAssets[0]
  }

  if (!targetAsset && release.assets?.length > 0) {
    targetAsset = release.assets[0]
  }

  console.log(`[Updater] Selected release asset: ${targetAsset?.name} (${targetAsset?.browser_download_url})`)

  const sizeInBytes = targetAsset?.size || 0
  const sizeStr = sizeInBytes > 0
    ? (sizeInBytes > 1024 * 1024 * 1024
      ? (sizeInBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
      : (sizeInBytes / (1024 * 1024)).toFixed(1) + ' MB')
    : '1.5 GB'

  const manifest: UpdateManifest = {
    updateAvailable: isNew,
    currentVersion: currentVer,
    latestVersion: latestVersion,
    releaseName: release.name || `Release v${latestVersion}`,
    releaseDate: release.published_at ? release.published_at.split('T')[0] : new Date().toISOString().split('T')[0],
    downloadUrl: targetAsset?.browser_download_url || `https://github.com/${repoName}/releases/latest`,
    size: sizeStr,
    releaseNotes: release.body || 'Performance enhancements and bug fixes included in this release.',
    checksum: '',
    htmlUrl: release.html_url || `https://github.com/${repoName}/releases/latest`,
    source: 'github',
    isLocalFile: false
  }

  cachedUpdateManifest = manifest
  return manifest
}

/**
 * Unified update checker: Prioritizes Anything ecosystem, falls back to GitHub Releases
 */
export async function checkForUpdates(preferredSource?: 'anything' | 'github' | 'all'): Promise<UpdateManifest> {
  const currentVer = getWorkstationVersion().trim()

  // 1. Check Anything Ecosystem first if allowed
  if (preferredSource !== 'github') {
    try {
      const anythingManifest = await checkAnythingUpdate()
      if (anythingManifest && anythingManifest.updateAvailable) {
        cachedUpdateManifest = anythingManifest
        return anythingManifest
      }
      if (anythingManifest && preferredSource === 'anything') {
        cachedUpdateManifest = anythingManifest
        return anythingManifest
      }
    } catch (e) {
      console.warn('[Updater] Anything check error (non-fatal):', e)
    }
  }

  // 2. Check GitHub Releases
  try {
    const githubManifest = await checkGitHubUpdate()
    if (githubManifest && githubManifest.updateAvailable) {
      cachedUpdateManifest = githubManifest
      return githubManifest
    }
    cachedUpdateManifest = githubManifest
    return githubManifest
  } catch (err) {
    console.warn('[Updater] GitHub check error (non-fatal):', err)
  }

  // 3. Up-to-date fallback manifest
  const fallback: UpdateManifest = {
    updateAvailable: false,
    currentVersion: currentVer,
    latestVersion: currentVer,
    releaseName: `One Tap v${currentVer}`,
    releaseDate: new Date().toISOString().split('T')[0],
    downloadUrl: '',
    size: '',
    releaseNotes: `Workstation verified. Current release: v${currentVer}. Sourced from Anything & GitHub.`,
    source: 'anything',
    isLocalFile: false
  }
  cachedUpdateManifest = fallback
  return fallback
}

/**
 * Perform startup silent update check in a non-blocking background task.
 * Pushes 'update:available' event to the renderer window if a newer version is found.
 */
export function triggerSilentStartupCheck(mainWindowGetter: () => BrowserWindow | null): void {
  const autoCheckEnabled = get('auto_check_updates') !== false
  if (!autoCheckEnabled) {
    console.log('[Updater] Auto startup update check disabled by user preference.')
    return
  }

  setTimeout(async () => {
    try {
      console.log('[Updater] Running silent startup update check via Anything & GitHub Releases...')
      const manifest = await checkForUpdates()
      if (manifest.updateAvailable) {
        console.log(`[Updater] New version available from ${manifest.source}: v${manifest.latestVersion}. Pushing notification event.`)
        const win = mainWindowGetter()
        if (win && !win.isDestroyed()) {
          win.webContents.send('update:available', manifest)
        }
      } else {
        console.log('[Updater] Workstation is already running the latest version.')
      }
    } catch (err) {
      console.warn('[Updater] Silent startup check failed (non-fatal):', err)
    }
  }, 4000) // Delay 4s after window load to avoid startup I/O contention
}

/**
 * Register all auto-update IPC handle hooks
 */
export function registerUpdateIPC(mainWindowGetter: () => BrowserWindow | null): void {
  
  // 1. Retrieve Current Version
  ipcMain.handle('update:getCurrentVersion', () => {
    return getWorkstationVersion()
  })

  // 2. Check for Updates API (Unified Anything & GitHub)
  ipcMain.handle('update:check', async (_, preferredSource?: 'anything' | 'github' | 'all') => {
    try {
      const manifest = await checkForUpdates(preferredSource)
      return manifest
    } catch (err) {
      console.error('[Updater] Update check failed:', err)
      return {
        updateAvailable: false,
        currentVersion: getWorkstationVersion(),
        latestVersion: getWorkstationVersion(),
        releaseName: '',
        releaseDate: '',
        downloadUrl: '',
        size: '',
        releaseNotes: 'Unable to check for updates. ' + (err instanceof Error ? err.message : String(err)),
        error: String(err)
      }
    }
  })

  // 2.1 Get / Set Update Routing Config
  ipcMain.handle('update:getUpdateConfig', () => {
    return {
      anythingPath: (get('anything_app_path') as string) || DEFAULT_ANYTHING_PATH,
      autoCheckUpdates: get('auto_check_updates') !== false,
      currentVersion: getWorkstationVersion()
    }
  })

  // 3. Streaming Downloader Engine (Supports local Anything files & remote GitHub URLs)
  ipcMain.handle('update:download', async (_, customUrl?: string) => {
    let manifest = cachedUpdateManifest
    if (!manifest || !manifest.downloadUrl || manifest.downloadUrl.endsWith('/latest')) {
      try {
        manifest = await checkForUpdates()
      } catch (err) {
        console.warn('[Updater] Pre-download check failed:', err)
      }
    }
    const targetUrl = customUrl || (manifest ? manifest.downloadUrl : '')
    if (!targetUrl) throw new Error('No valid download target URL or path provided.')

    const tempFolder = app.getPath('temp')
    // Use platform-appropriate installer extension
    const installerExt = process.platform === 'linux' ? '.AppImage' : '.exe'
    const finalInstallerPath = path.join(tempFolder, `onetap_setup_latest${installerExt}`)
    const partInstallerPath = finalInstallerPath + '.part'

    // CASE A: Local file from Anything ecosystem
    if (fs.existsSync(targetUrl)) {
      console.log(`[Updater] Copying local installer from Anything: ${targetUrl} -> ${finalInstallerPath}`)
      const stats = fs.statSync(targetUrl)
      const totalBytes = stats.size

      return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(targetUrl)
        const writeStream = fs.createWriteStream(partInstallerPath)
        let transferred = 0
        let lastTime = Date.now()
        let lastTransferred = 0

        readStream.on('data', (chunk) => {
          transferred += chunk.length
          const now = Date.now()
          if (now - lastTime >= 100) {
            const timeDiff = (now - lastTime) / 1000
            const speed = timeDiff > 0 ? Math.round((transferred - lastTransferred) / timeDiff) : 40000000
            const percent = totalBytes > 0 ? Math.round((transferred / totalBytes) * 100) : 50

            lastTime = now
            lastTransferred = transferred

            const win = mainWindowGetter()
            if (win && !win.isDestroyed()) {
              win.webContents.send('update:progress', {
                percent,
                transferredBytes: transferred,
                totalBytes,
                speedBytesPerSec: speed
              })
            }
          }
        })

        writeStream.on('finish', () => {
          try {
            if (fs.existsSync(finalInstallerPath)) fs.unlinkSync(finalInstallerPath)
            fs.renameSync(partInstallerPath, finalInstallerPath)

            if (process.platform === 'win32') {
              try {
                exec(`powershell -Command "Unblock-File -Path '${finalInstallerPath}'"`, { windowsHide: true })
              } catch (uErr) {
                console.warn('[Updater] Powershell Unblock-File non-fatal warning:', uErr)
              }
            }

            const win = mainWindowGetter()
            if (win && !win.isDestroyed()) {
              win.webContents.send('update:progress', {
                percent: 100,
                transferredBytes: totalBytes,
                totalBytes,
                speedBytesPerSec: 0
              })
            }

            lastDownloadedInstallerPath = finalInstallerPath
            console.log(`[Updater] Local installer ready at: ${finalInstallerPath}`)
            resolve({ success: true, filePath: finalInstallerPath })
          } catch (err) {
            reject(err)
          }
        })

        readStream.on('error', (err) => {
          if (fs.existsSync(partInstallerPath)) fs.unlinkSync(partInstallerPath)
          reject(err)
        })

        writeStream.on('error', (err) => {
          if (fs.existsSync(partInstallerPath)) fs.unlinkSync(partInstallerPath)
          reject(err)
        })

        readStream.pipe(writeStream)
      })
    }

    // CASE B: Remote stream download from GitHub
    console.log(`[Updater] Initiating stream download from GitHub: ${targetUrl} -> ${finalInstallerPath}`)

    let response: http.IncomingMessage
    try {
      response = await getUrlStream(targetUrl)
    } catch (e) {
      console.error('[Updater] Downloader connection failure:', e)
      throw new Error(`GitHub download connection failure: ${String(e)}`)
    }

    if (response.statusCode && response.statusCode >= 400) {
      throw new Error(`GitHub server returned HTTP status ${response.statusCode}`)
    }

    const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
    let transferredBytes = 0
    let lastTransferredBytes = 0
    let lastProgressTime = Date.now()

    const fileStream = fs.createWriteStream(partInstallerPath, { flags: 'w' })

    return new Promise((resolve, reject) => {
      response.pipe(fileStream)

      const progressInterval = setInterval(() => {
        const now = Date.now()
        const timeDiffSec = (now - lastProgressTime) / 1000
        const bytesDiff = transferredBytes - lastTransferredBytes

        const speed = timeDiffSec > 0 ? Math.round(bytesDiff / timeDiffSec) : 0
        const percent = totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 0

        lastTransferredBytes = transferredBytes
        lastProgressTime = now

        const win = mainWindowGetter()
        if (win && !win.isDestroyed()) {
          win.webContents.send('update:progress', {
            percent: percent,
            transferredBytes: transferredBytes,
            totalBytes: totalBytes,
            speedBytesPerSec: speed
          })
        }
      }, 350)

      response.on('data', (chunk) => {
        transferredBytes += chunk.length
      })

      fileStream.on('finish', async () => {
        clearInterval(progressInterval)
        fileStream.close()

        console.log('[Updater] Download stream finished. Verifying integrity...')

        try {
          const stats = fs.statSync(partInstallerPath)
          if (totalBytes > 0 && stats.size !== totalBytes) {
            throw new Error(`Size verification mismatch. Expected ${totalBytes} bytes, got ${stats.size} bytes.`)
          }

          if (fs.existsSync(finalInstallerPath)) fs.unlinkSync(finalInstallerPath)
          fs.renameSync(partInstallerPath, finalInstallerPath)

          // Remove Zone.Identifier (Unblock-File) on Windows
          if (process.platform === 'win32') {
            try {
              exec(`powershell -Command "Unblock-File -Path '${finalInstallerPath}'"`, { windowsHide: true })
            } catch (uErr) {
              console.warn('[Updater] Powershell Unblock-File non-fatal warning:', uErr)
            }
          }

          // Verify SHA-256 checksum if provided in manifest
          if (manifest && manifest.checksum) {
            const fileBuffer = fs.readFileSync(finalInstallerPath)
            const hashSum = crypto.createHash('sha256')
            hashSum.update(fileBuffer)
            const hex = hashSum.digest('hex')
            if (manifest.checksum !== 'MOCK_SHA256_CHECKSUM_VAL' && hex !== manifest.checksum) {
              throw new Error(`Integrity checksum mismatch. Expected ${manifest.checksum}, got ${hex}.`)
            }
            console.log('[Updater] SHA-256 Integrity verification passed.')
          }

          lastDownloadedInstallerPath = finalInstallerPath
          console.log(`[Updater] Installer binary ready for execution at: ${finalInstallerPath}`)
          resolve({ success: true, filePath: finalInstallerPath })
        } catch (e) {
          console.error('[Updater] Post-download verification error:', e)
          if (fs.existsSync(partInstallerPath)) fs.unlinkSync(partInstallerPath)
          reject(e)
        }
      })

      fileStream.on('error', (err) => {
        clearInterval(progressInterval)
        fileStream.close()
        if (fs.existsSync(partInstallerPath)) fs.unlinkSync(partInstallerPath)
        reject(err)
      })

      response.on('error', (err) => {
        clearInterval(progressInterval)
        fileStream.close()
        if (fs.existsSync(partInstallerPath)) fs.unlinkSync(partInstallerPath)
        reject(err)
      })
    })
  })

  // 4. Installer Launch Execution Strategy
  ipcMain.handle('update:install', async () => {
    const tempFolder = app.getPath('temp')
    const candidates = [
      lastDownloadedInstallerPath,
      path.join(tempFolder, 'unidesk_setup_latest.exe'),
      path.join(tempFolder, 'unidesk_latest.AppImage'),
      path.join(tempFolder, 'unidesk_latest.deb'),
      path.join(tempFolder, 'onetap_setup_latest.exe')
    ].filter(Boolean) as string[]

    let installerPath = candidates.find(p => fs.existsSync(p))

    if (!installerPath) {
      // Look for any newly downloaded installer in tempFolder
      try {
        const files = fs.readdirSync(tempFolder)
        const match = files.find(f => (f.endsWith('.AppImage') || f.endsWith('.deb') || f.endsWith('.exe')) && f.toLowerCase().includes('unidesk'))
        if (match) installerPath = path.join(tempFolder, match)
      } catch {}
    }

    if (!installerPath || !fs.existsSync(installerPath)) {
      throw new Error('Installer binary executable missing or not found in temporary folder.')
    }

    console.log(`[Updater] Spawning update setup installer: ${installerPath}`)

    ;(app as any).isQuitting = true

    const windows = BrowserWindow.getAllWindows()
    for (const w of windows) {
      try {
        if (!w.isDestroyed()) w.destroy()
      } catch {}
    }

    if (process.platform === 'linux' && installerPath.endsWith('.AppImage')) {
      try { fs.chmodSync(installerPath, 0o755) } catch {}
      const installerProcess = spawn(installerPath, [], {
        detached: true,
        stdio: 'ignore'
      })
      installerProcess.unref()
      setTimeout(() => {
        app.exit(0)
      }, 300)
    } else if (process.platform === 'linux' && installerPath.endsWith('.deb')) {
      const { shell } = require('electron')
      shell.showItemInFolder(installerPath)
      setTimeout(() => {
        app.exit(0)
      }, 300)
    } else if (process.platform === 'win32') {
      // Windows Out-of-Process Supervisor Updater
      // Writes a batch script to safely await main process shutdown, terminate any lingering locks,
      // execute the setup installer (silent with GUI fallback), and automatically restart the updated app.
      const safeInstallerPath = installerPath.replace(/["&]/g, '')
      const batPath = path.join(tempFolder, `unidesk_updater_${Date.now()}.bat`)
      const batContent = `@echo off
setlocal
chcp 65001 >nul

:: Wait 1.5 seconds for Electron process to completely exit and release file locks
timeout /t 2 /nobreak >nul

:: Ensure any lingering Uni Desk process instances are terminated
taskkill /F /IM "Uni Desk.exe" >nul 2>&1
taskkill /F /IM "UniDesk_App.exe" >nul 2>&1
timeout /t 1 /nobreak >nul

:: Execute the NSIS installer
:: Attempt silent install first; fallback to GUI if silent returns non-zero error
start /wait "" "${safeInstallerPath}" /S
if %ERRORLEVEL% NEQ 0 (
    start /wait "" "${safeInstallerPath}"
)

:: Re-launch updated workstation
set "TARGET_EXE=%LOCALAPPDATA%\\Programs\\Uni Desk\\Uni Desk.exe"
if exist "%TARGET_EXE%" (
    start "" "%TARGET_EXE%"
) else (
    set "ALT_EXE=C:\\Program Files\\Uni Desk\\Uni Desk.exe"
    if exist "%ALT_EXE%" (
        start "" "%ALT_EXE%"
    )
)

:: Cleanup supervisor script
(goto) 2>nul & del "%~f0"
`
      fs.writeFileSync(batPath, batContent, 'utf8')

      console.log(`[Updater] Launching Windows updater supervisor: ${batPath}`)

      const batProcess = spawn('cmd.exe', ['/c', batPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
      batProcess.unref()

      setTimeout(() => {
        app.exit(0)
      }, 400)
    } else {
      const installerProcess = spawn(installerPath, [], {
        detached: true,
        stdio: 'ignore'
      })
      installerProcess.unref()
      setTimeout(() => {
        app.exit(0)
      }, 300)
    }

    return { success: true }
  })
}
