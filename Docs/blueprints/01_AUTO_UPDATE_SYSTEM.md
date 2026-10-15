# Blueprint 01: Universal Desktop Auto-Update Architecture

A production-grade, reliable auto-update architecture designed for Electron, Tauri, and native desktop applications. This blueprint allows any project to distribute updates seamlessly via GitHub Releases or private static CDNs without external paid updater servers.

---

## 🏗️ 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AUTO-UPDATE LIFECYCLE                           │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Check Version ───► Query GitHub Releases API / version.json         │
│ 2. SemVer Compare ──► Compare remote latest tag with app.getVersion()  │
│ 3. Download Asset ──► Stream .EXE / .AppImage with live progress       │
│ 4. Hash Verify ─────► Validate SHA-256 checksum against manifest       │
│ 5. Execute & Exit ──► Launch silent installer with /S switch and quit  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 2. Version Manifest Specification (`version.json`)

Host this file either on GitHub Releases (`update.json`) or your web host:

```json
{
  "version": "26.10.10",
  "releaseDate": "2026-10-15",
  "mandatory": false,
  "downloadUrls": {
    "windows_installer": "https://github.com/YourOrg/YourRepo/releases/download/v26.10.10/App_Setup_V26.10.10.exe",
    "windows_portable": "https://github.com/YourOrg/YourRepo/releases/download/v26.10.10/App_Portable_V26.10.10.exe",
    "linux_appimage": "https://github.com/YourOrg/YourRepo/releases/download/v26.10.10/App_Linux_V26.10.10.AppImage"
  },
  "checksums": {
    "windows_installer": "8cb6e4338d4814ce8b52bea4af076c05e385c1fe895e7504f8554e440426fca0"
  },
  "releaseNotes": [
    "🚀 Accelerated hardware encoding pipeline",
    "✨ Added live taskbar preview popovers",
    "🐛 Fixed background queue stall on sleep"
  ]
}
```

---

## 💻 3. Electron Main Process Implementation (`autoUpdater.ts`)

```typescript
import { app, dialog, shell, ipcMain, BrowserWindow } from 'electron'
import https from 'https'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawn } from 'child_process'

interface UpdateInfo {
  version: string
  downloadUrl: string
  sha256?: string
  releaseNotes: string[]
}

export class WorkstationAutoUpdater {
  private static MANIFEST_URL = 'https://raw.githubusercontent.com/YourOrg/YourRepo/main/version/update.json'

  static async checkForUpdates(mainWindow?: BrowserWindow): Promise<UpdateInfo | null> {
    try {
      const remote = await this.fetchJson(this.MANIFEST_URL)
      const currentVersion = app.getVersion()

      if (this.isNewer(remote.version, currentVersion)) {
        if (mainWindow) {
          mainWindow.webContents.send('update-available', remote)
        }
        return remote
      }
      return null
    } catch (err) {
      console.warn('[AutoUpdater] Update check failed:', err)
      return null
    }
  }

  static isNewer(latest: string, current: string): boolean {
    const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
    const [lMaj, lMin, lPat] = parse(latest)
    const [cMaj, cMin, cPat] = parse(current)

    if (lMaj > cMaj) return true
    if (lMaj === cMaj && lMin > cMin) return true
    if (lMaj === cMaj && lMin === cMin && lPat > cPat) return true
    return false
  }

  static async downloadAndInstall(updateInfo: UpdateInfo, progressCallback: (pct: number) => void): Promise<void> {
    const tempPath = path.join(app.getPath('temp'), path.basename(updateInfo.downloadUrl))
    const file = fs.createWriteStream(tempPath)

    return new Promise((resolve, reject) => {
      https.get(updateInfo.downloadUrl, (res) => {
        const total = parseInt(res.headers['content-length'] || '0', 10)
        let received = 0

        res.on('data', (chunk) => {
          received += chunk.length
          if (total > 0) progressCallback(Math.round((received / total) * 100))
        })

        res.pipe(file)
        file.on('finish', () => {
          file.close(async () => {
            // Verify Checksum if present
            if (updateInfo.sha256) {
              const fileHash = await this.hashFile(tempPath)
              if (fileHash.toLowerCase() !== updateInfo.sha256.toLowerCase()) {
                return reject(new Error('Checksum mismatch. Download corrupted.'))
              }
            }

            // Launch silent NSIS / Inno Setup installer
            if (process.platform === 'win32') {
              spawn(tempPath, ['/S'], { detached: true, stdio: 'ignore' })
              app.quit()
            }
            resolve()
          })
        })
      }).on('error', reject)
    })
  }

  private static hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      stream.on('data', d => hash.update(d))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  private static fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let raw = ''
        res.on('data', chunk => raw += chunk)
        res.on('end', () => resolve(JSON.parse(raw)))
      }).on('error', reject)
    })
  }
}
```

---

## 🎨 4. Renderer Toast & Notification Component (`UpdateModal.tsx`)

```tsx
import React, { useEffect, useState } from 'react'

export const UpdateNotification: React.FC = () => {
  const [update, setUpdate] = useState<any | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    window.api.on('update-available', (info) => setUpdate(info))
    window.api.on('update-progress', (pct) => setProgress(pct))
  }, [])

  if (!update) return null

  return (
    <div className="update-toast-container">
      <div className="update-toast-card">
        <h4>🚀 New Version Available: {update.version}</h4>
        <ul>
          {update.releaseNotes.map((note: string, i: number) => (
            <li key={i}>{note}</li>
          ))}
        </ul>

        {downloading ? (
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            <span>Downloading update: {progress}%</span>
          </div>
        ) : (
          <button onClick={() => { setDownloading(true); window.api.installUpdate(update); }}>
            Update &amp; Restart Now
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## 🔑 5. Key Best Practices
1. **Never Block Application Boot**: Run update checks 5–10 seconds after user opens the app, not on critical startup path.
2. **Always Enforce SHA-256 Checksums**: Never execute downloaded executables without bit-level hash verification.
3. **Preserve User Settings Across Installs**: Ensure `%APPDATA%/YourAppName/` or `%LOCALAPPDATA%` is omitted from NSIS uninstallation blocks.
