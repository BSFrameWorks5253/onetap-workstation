import { ipcMain, app, Notification } from 'electron'
import os from 'os'
import fs from 'fs'
import { checkFfmpeg, getVideoEncoder } from '../core/gpuDetector'
import { setAndSave } from '../core/settingsManager'

let lastCPUTime = { idle: 0, total: 0 }
let cachedDiskUsage = 0
let lastDiskCheck = 0

async function updateDiskUsageAsync(): Promise<void> {
  const now = Date.now()
  if (now - lastDiskCheck < 10000) return
  lastDiskCheck = now

  try {
    const rootDir = process.platform === 'win32' ? (process.cwd().match(/^[a-zA-Z]:[\\/]/)?.[0] || 'C:\\') : '/'
    if (typeof (fs as any).statfs === 'function') {
      ;(fs as any).statfs(rootDir, (err: any, stats: any) => {
        if (!err && stats && stats.blocks > 0) {
          const used = stats.blocks - stats.bfree
          cachedDiskUsage = Math.min(100, Math.max(0, Math.round((used / stats.blocks) * 100)))
        }
      })
    }
  } catch {}
}

function getCPUUsage() {
  const cpus = os.cpus()
  let idle = 0, total = 0
  for (const cpu of cpus) {
    for (const type in cpu.times) total += cpu.times[type]
    idle += cpu.times.idle
  }
  const diffIdle = idle - lastCPUTime.idle
  const diffTotal = total - lastCPUTime.total
  lastCPUTime = { idle, total }
  return 100 * (1 - diffIdle / diffTotal)
}

export function registerSystemIPC(): void {
  // System Desktop Notification
  ipcMain.handle('system:notify', (_e, { title, body }: { title: string; body: string }) => {
    try {
      if (Notification.isSupported()) {
        new Notification({ title, body }).show()
        return true
      }
    } catch (err) {
      console.warn('[System] Notification failed:', err)
    }
    return false
  })

  // Auto-launch startup settings
  ipcMain.handle('system:getAutoLaunch', () => {
    try {
      return app.getLoginItemSettings().openAtLogin
    } catch {
      return false
    }
  })

  ipcMain.handle('system:setAutoLaunch', (_e, enabled: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: app.getPath('exe')
      })
      setAndSave('auto_launch', enabled)
      return app.getLoginItemSettings().openAtLogin
    } catch (err) {
      console.error('[System] Failed to update login item settings:', err)
      return false
    }
  })

  // FFmpeg check
  ipcMain.handle('ffmpeg:check', () => {
    return checkFfmpeg()
  })

  // GPU check
  ipcMain.handle('system:getEncoder', () => {
    return getVideoEncoder()
  })

  // Resource stats
  ipcMain.handle('system:getStats', async () => {
    const totalMem = os.totalmem()
    const freeMem  = os.freemem()
    const ramUsage = ((totalMem - freeMem) / totalMem) * 100
    updateDiskUsageAsync()

    return {
      cpu: getCPUUsage() || 0,
      ram: ramUsage,
      disk: cachedDiskUsage
    }
  })

  // List available system drives
  ipcMain.handle('system:getDrives', async () => {
    const fs = require('fs')
    if (process.platform === 'win32') {
      const drives: string[] = []
      // Check all possible drive letters from A: to Z:
      for (let i = 65; i <= 90; i++) {
        const letter = String.fromCharCode(i) + ':\\'
        try {
          if (fs.existsSync(letter)) {
            drives.push(letter)
          }
        } catch {}
      }
      return drives
    }
    const path = require('path')
    const linuxDrives: string[] = ['/']
    const checkRoots = [
      '/mnt',
      '/media',
      process.env.USER ? `/media/${process.env.USER}` : '',
      '/run/media',
      process.env.USER ? `/run/media/${process.env.USER}` : ''
    ].filter(Boolean)

    for (const cr of checkRoots) {
      if (fs.existsSync(cr)) {
        try {
          const entries = fs.readdirSync(cr, { withFileTypes: true })
          for (const ent of entries) {
            if (ent.isDirectory()) {
              const fullP = path.join(cr, ent.name)
              if (!linuxDrives.includes(fullP)) linuxDrives.push(fullP)
            }
          }
        } catch {}
      }
    }
    return linuxDrives
  })

  // Get disk space metrics & health warnings for specific drive or all drives
  ipcMain.handle('system:getDriveSpace', async (_e, drivePath?: string) => {
    const fs = require('fs')
    const getSingleDriveSpace = (p: string) => {
      try {
        let norm = p.trim()
        if (/^[a-zA-Z]:$/.test(norm)) norm = norm + '\\'
        if (!fs.existsSync(norm)) {
          return {
            drive: norm,
            isOnline: false,
            freeGB: 0,
            totalGB: 0,
            usedPercent: 0,
            isLowSpace: false,
            isCritical: false
          }
        }
        if (typeof (fs as any).statfsSync === 'function') {
          const st = (fs as any).statfsSync(norm)
          const freeBytes = Number(st.bavail) * Number(st.bsize)
          const totalBytes = Number(st.blocks) * Number(st.bsize)
          const freeGB = Math.round((freeBytes / (1024 * 1024 * 1024)) * 10) / 10
          const totalGB = Math.round((totalBytes / (1024 * 1024 * 1024)) * 10) / 10
          const usedPercent = totalBytes > 0
            ? Math.min(100, Math.max(0, Math.round(((totalBytes - freeBytes) / totalBytes) * 100)))
            : 0
          return {
            drive: norm,
            isOnline: true,
            freeGB,
            totalGB,
            usedPercent,
            isLowSpace: freeGB < 20,
            isCritical: freeGB < 10
          }
        }
      } catch {}
      return {
        drive: p,
        isOnline: false,
        freeGB: 0,
        totalGB: 0,
        usedPercent: 0,
        isLowSpace: false,
        isCritical: false
      }
    }

    if (drivePath) {
      return getSingleDriveSpace(drivePath)
    }

    const results: Record<string, any> = {}
    if (process.platform === 'win32') {
      for (let i = 65; i <= 90; i++) {
        const root = String.fromCharCode(i) + ':\\'
        if (fs.existsSync(root)) {
          results[root] = getSingleDriveSpace(root)
        }
      }
    }
    return results
  })

  // Anything Ecosystem & Creative Cloud Demo / Trial & Live Loader Config
  ipcMain.handle('system:getLaunchInfo', () => {
    const isDemo = process.argv.includes('--demo')
    const isTrial = process.argv.includes('--trial')
    let loaderConfigPath: string | null = null
    const loaderArg = process.argv.find((a) => a.startsWith('--loader-config='))
    if (loaderArg) {
      loaderConfigPath = loaderArg.split('=')[1]?.replace(/^["']|["']$/g, '') || null
    }

    let loaderConfig: any = null
    if (loaderConfigPath) {
      try {
        const resolvedPath = path.isAbsolute(loaderConfigPath)
          ? loaderConfigPath
          : path.resolve(process.cwd(), loaderConfigPath)
        if (fs.existsSync(resolvedPath)) {
          loaderConfig = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'))
        }
      } catch (err) {
        console.warn('[System] Failed to parse custom loaderConfig:', err)
      }
    }

    return {
      isDemo,
      isTrial,
      loaderConfig,
      argv: process.argv,
      version: app.getVersion()
    }
  })
}

