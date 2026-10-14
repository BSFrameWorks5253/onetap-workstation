import { BrowserWindow, Notification } from 'electron'
import {
  reconcileWorkingAndBackupDrives,
  BackupReconcileResult
} from './backupReconciler'

export interface DaemonStatus {
  active: boolean
  workingDrive: string
  backupDrive: string
  workingFound: boolean
  backupFound: boolean
  missingCount: number
  missingSafars: number
  missingDates: number
  outOfSync: number
  lastCheck: number
  lastError?: string
}

let _timer: NodeJS.Timeout | null = null
let _intervalMs = 25000 // 25 seconds
let _isActive = true
let _isScanning = false
let _lastNotificationTime = 0
let _lastNotifiedCount = -1
const NOTIFICATION_COOLDOWN_MS = 15 * 60 * 1000 // 15 mins

let _latestStatus: DaemonStatus = {
  active: true,
  workingDrive: process.platform === 'win32' ? 'D:' : '',
  backupDrive: process.platform === 'win32' ? 'E:' : '',
  workingFound: false,
  backupFound: false,
  missingCount: 0,
  missingSafars: 0,
  missingDates: 0,
  outOfSync: 0,
  lastCheck: 0
}

let _getWin: (() => BrowserWindow | null) | null = null

export function getDaemonStatus(): DaemonStatus {
  return { ..._latestStatus, active: _isActive }
}

export function setDaemonActive(active: boolean): DaemonStatus {
  _isActive = active
  if (!_isActive && _timer) {
    clearInterval(_timer)
    _timer = null
  } else if (_isActive && !_timer && _getWin) {
    startDriveWatcherDaemon(_getWin)
  }
  broadcastStatus()
  return getDaemonStatus()
}

export function setDaemonInterval(seconds: number): void {
  const ms = Math.max(10, Math.min(300, seconds)) * 1000
  _intervalMs = ms
  if (_timer) {
    clearInterval(_timer)
    _timer = setInterval(runScanTick, _intervalMs)
  }
}

function broadcastStatus(): void {
  try {
    const win = _getWin ? _getWin() : null
    if (win && !win.isDestroyed()) {
      win.webContents.send('driveSync:daemonUpdate', getDaemonStatus())
    }
  } catch {}
}

async function runScanTick(): Promise<void> {
  if (!_isActive || _isScanning) return
  _isScanning = true

  try {
    // Run silent reconciliation (we handle notifications with cooldown here)
    const res: BackupReconcileResult = await reconcileWorkingAndBackupDrives(
      undefined,
      undefined,
      false, // don't let reconcileWorkingAndBackupDrives show direct notification
      _getWin || undefined
    )

    const workingFound = res.allDrives.some(d => d.letter === res.workingDrive)
    const backupFound = res.allDrives.some(d => d.letter === res.backupDrive)

    _latestStatus = {
      active: _isActive,
      workingDrive: res.workingDrive,
      backupDrive: res.backupDrive,
      workingFound,
      backupFound,
      missingCount: res.totalMissingItems,
      missingSafars: res.missingSafars.length,
      missingDates: res.missingDateFolders.length,
      outOfSync: res.outOfSyncFolders.length,
      lastCheck: Date.now(),
      lastError: res.error
    }

    broadcastStatus()

    // Handle desktop notification with smart cooldown
    const now = Date.now()
    if (
      res.totalMissingItems > 0 &&
      (res.totalMissingItems !== _lastNotifiedCount || now - _lastNotificationTime > NOTIFICATION_COOLDOWN_MS)
    ) {
      _lastNotifiedCount = res.totalMissingItems
      _lastNotificationTime = now

      if (Notification.isSupported()) {
        try {
          const notif = new Notification({
            title: 'One Tap Drive Watcher',
            body: `⚠️ ${res.totalMissingItems} unbacked Safar / Date items on Working Drive (${res.workingDrive}) need backup to ${res.backupDrive}!`,
            silent: false
          })

          notif.on('click', () => {
            const win = _getWin ? _getWin() : null
            if (win && !win.isDestroyed()) {
              if (win.isMinimized()) win.restore()
              win.focus()
              win.webContents.send('app:navigate', 'drivesync')
            }
          })

          notif.show()
        } catch (notifErr) {
          console.error('[DriveWatcherDaemon] Notification error:', notifErr)
        }
      }
    }
  } catch (err: any) {
    _latestStatus.lastError = err.message || String(err)
    broadcastStatus()
  } finally {
    _isScanning = false
  }
}

export async function triggerDaemonScanNow(): Promise<DaemonStatus> {
  await runScanTick()
  return getDaemonStatus()
}

export function startDriveWatcherDaemon(getWin: () => BrowserWindow | null): void {
  _getWin = getWin
  _isActive = true

  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }

  // Initial immediate scan after a short 3-second startup grace period
  setTimeout(() => {
    runScanTick()
  }, 3000)

  // Recurring background interval
  _timer = setInterval(runScanTick, _intervalMs)
}

export function stopDriveWatcherDaemon(): void {
  _isActive = false
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
}
