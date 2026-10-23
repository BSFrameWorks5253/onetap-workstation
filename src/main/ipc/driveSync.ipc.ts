import { ipcMain, BrowserWindow, dialog } from 'electron'
import fs, { promises as fsp } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { get } from '../core/settingsManager'
import {
  generateSyncExcelReport,
  generateSyncPdfReport,
  DriveSyncReportData,
  SyncFileLogItem
} from '../core/syncReportExporter'
import {
  reconcileWorkingAndBackupDrives,
  getDriveCandidates
} from '../core/backupReconciler'
import {
  verifyFilesMatch,
  computeFileXxHash64
} from '../core/hashVerifier'
import {
  getDaemonStatus,
  setDaemonActive,
  triggerDaemonScanNow
} from '../core/driveWatcherDaemon'

type WinGetter = () => BrowserWindow | null

let _cancelFlag = false
let _lastReportData: DriveSyncReportData | null = null

interface CopyItem {
  src: string
  dst: string
  size: number
}

async function collectFilesAsync(
  srcDir: string,
  dstDir: string,
  fileLogs: SyncFileLogItem[],
  verifyHash: boolean = false,
  onLog?: (msg: string, level?: string) => void
): Promise<{ files: CopyItem[]; skipped: number; totalBytesToCopy: number; totalSourceBytes: number; totalSourceCount: number }> {
  const files: CopyItem[] = []
  let skipped = 0
  let totalBytesToCopy = 0
  let totalSourceBytes = 0
  let totalSourceCount = 0

  async function walk(s: string, d: string): Promise<void> {
    if (_cancelFlag) return
    try {
      const entries = await fsp.readdir(s, { withFileTypes: true })
      for (const entry of entries) {
        if (_cancelFlag) break
        const srcPath = path.join(s, entry.name)
        const dstPath = path.join(d, entry.name)

        if (entry.isDirectory()) {
          await walk(srcPath, dstPath)
        } else if (entry.isFile()) {
          try {
            const srcStat = await fsp.stat(srcPath)
            totalSourceCount++
            totalSourceBytes += srcStat.size

            if (fs.existsSync(dstPath)) {
              const dstStat = await fsp.stat(dstPath)
              if (srcStat.size === dstStat.size) {
                if (verifyHash) {
                  // Deep xxHash64 verification for bit-exact match
                  const check = await verifyFilesMatch(srcPath, dstPath)
                  if (check.match) {
                    skipped++
                    fileLogs.push({
                      fileName: entry.name,
                      src: srcPath,
                      dst: dstPath,
                      size: srcStat.size,
                      status: 'Skipped',
                      hash: check.srcHash,
                      hashVerified: true
                    })
                    continue
                  } else {
                    if (onLog) onLog(`⚠️ Hash mismatch on ${entry.name}: re-copying to repair corrupted backup.`, 'warn')
                  }
                } else if (Math.abs(srcStat.mtimeMs - dstStat.mtimeMs) < 2000) {
                  // Fast timestamp and size match
                  skipped++
                  fileLogs.push({
                    fileName: entry.name,
                    src: srcPath,
                    dst: dstPath,
                    size: srcStat.size,
                    status: 'Skipped'
                  })
                  continue
                }
              }
            }
            files.push({ src: srcPath, dst: dstPath, size: srcStat.size })
            totalBytesToCopy += srcStat.size
          } catch {
            // Error reading file stat, skip
          }
        }
      }
    } catch {
      // Error reading directory
    }
  }

  await walk(srcDir, dstDir)
  return { files, skipped, totalBytesToCopy, totalSourceBytes, totalSourceCount }
}

async function copySingleFileAsync(src: string, dst: string, onChunk?: (bytes: number) => void): Promise<void> {
  await fsp.mkdir(path.dirname(dst), { recursive: true })
  const stat = await fsp.stat(src)

  if (stat.size < 16 * 1024 * 1024) {
    await fsp.copyFile(src, dst)
    try { await fsp.utimes(dst, stat.atime, stat.mtime) } catch {}
    if (onChunk) onChunk(stat.size)
    return
  }

  const readStream = fs.createReadStream(src, { highWaterMark: 8 * 1024 * 1024 })
  const writeStream = fs.createWriteStream(dst, { highWaterMark: 8 * 1024 * 1024 })

  if (onChunk) {
    readStream.on('data', (chunk) => {
      onChunk(chunk.length)
    })
  }

  await pipeline(readStream, writeStream)
  try { await fsp.utimes(dst, stat.atime, stat.mtime) } catch {}
}

export function registerDriveSyncIPC(getWin: WinGetter): void {
  ipcMain.handle('driveSync:start', async (_e, params: {
    sources?: string[] | string
    source?: string
    destination: string
    verifyHash?: boolean
  }) => {
    const win = getWin()
    const send = (ch: string, d: unknown): void => { try { win?.webContents.send(ch, d) } catch { } }

    _cancelFlag = false
    const threads = Math.max(1, Math.min(32, (get('drivesync_threads', 16) as number)))
    const verifyHash = !!params.verifyHash

    let sourceList: string[] = []
    if (Array.isArray(params.sources) && params.sources.length > 0) {
      sourceList = params.sources.filter(Boolean)
    } else if (params.source) {
      sourceList = [params.source]
    } else if (typeof params.sources === 'string' && params.sources) {
      sourceList = [params.sources]
    }

    if (sourceList.length === 0 || !params.destination) {
      send('driveSync:done', { copied: 0, total: 0, message: 'Invalid source folders or destination path.' })
      return
    }

    send('driveSync:status', {
      message: `Scanning ${sourceList.length} source folder(s) ${verifyHash ? '(with xxHash64 deep verification)' : ''}…`,
      percent: 0
    })

    const filesToCopy: CopyItem[] = []
    const fileLogs: SyncFileLogItem[] = []
    let skippedCount = 0
    let totalBytesToCopy = 0
    let totalSourceBytes = 0
    let totalSourceCount = 0

    for (const srcFolder of sourceList) {
      if (_cancelFlag) break
      const srcBasename = path.basename(srcFolder)
      let targetDest = params.destination
      if (srcBasename && path.basename(params.destination).toLowerCase() !== srcBasename.toLowerCase()) {
        targetDest = path.join(params.destination, srcBasename)
      }
      const res = await collectFilesAsync(
        srcFolder,
        targetDest,
        fileLogs,
        verifyHash,
        (msg, level) => send('driveSync:log', { message: msg, level })
      )
      filesToCopy.push(...res.files)
      skippedCount += res.skipped
      totalBytesToCopy += res.totalBytesToCopy
      totalSourceBytes += res.totalSourceBytes
      totalSourceCount += res.totalSourceCount
    }

    if (_cancelFlag) {
      win?.setProgressBar(-1)
      send('driveSync:done', { copied: 0, total: 0, cancelled: true })
      return
    }

    const totalToCopy = filesToCopy.length

    send('driveSync:found', { total: totalSourceCount, totalBytes: totalSourceBytes })

    let doneCount = 0
    let failedCount = 0
    let bytesDone = 0
    const startTime = Date.now()
    let lastReport = 0

    const queue = [...filesToCopy]

    const reportProgress = (): void => {
      const now = Date.now()
      if (now - lastReport < 100 && doneCount < totalToCopy) return
      lastReport = now

      const elapsed = (now - startTime) / 1000
      const speedMBs = elapsed > 0 ? (bytesDone / 1024 / 1024) / elapsed : 0
      const percent = totalToCopy > 0 ? Math.round((doneCount / totalToCopy) * 100) : 100

      const ratio = Math.max(0, Math.min(1, bytesDone / (totalBytesToCopy || 1)))
      win?.setProgressBar(ratio)

      send('driveSync:progress', {
        done: doneCount,
        total: totalToCopy,
        percent,
        speedMBs: speedMBs.toFixed(1),
        bytesDone,
        totalBytes: totalBytesToCopy
      })
    }

    // Launch parallel async workers
    const workerPromises = Array.from({ length: threads }, async () => {
      while (queue.length > 0 && !_cancelFlag) {
        const item = queue.shift()
        if (!item) break

        try {
          await copySingleFileAsync(item.src, item.dst, (chunkBytes) => {
            bytesDone += chunkBytes
            reportProgress()
          })

          let itemHash: string | undefined = undefined
          let isHashVerified = false

          if (verifyHash) {
            const check = await verifyFilesMatch(item.src, item.dst)
            itemHash = check.srcHash
            isHashVerified = check.match
            if (!check.match) {
              throw new Error(`Integrity check failed: destination hash (${check.dstHash}) does not match source (${check.srcHash})`)
            }
          }

          doneCount++
          fileLogs.push({
            fileName: path.basename(item.src),
            src: item.src,
            dst: item.dst,
            size: item.size,
            status: 'Copied',
            hash: itemHash,
            hashVerified: isHashVerified
          })
          reportProgress()
        } catch (e: any) {
          failedCount++
          fileLogs.push({
            fileName: path.basename(item.src),
            src: item.src,
            dst: item.dst,
            size: item.size,
            status: 'Failed',
            error: e.message || String(e)
          })
          send('driveSync:log', { message: `✖ Failed copying ${path.basename(item.src)}: ${e.message || e}`, level: 'error' })
        }
      }
    })

    await Promise.all(workerPromises)

    win?.setProgressBar(-1)
    const elapsedSeconds = Math.max(0.1, (Date.now() - startTime) / 1000)
    const avgSpeedMBs = ((bytesDone / 1024 / 1024) / elapsedSeconds).toFixed(1)
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19)

    // Store report payload for user export calls
    _lastReportData = {
      jobId: `SYNC_${Date.now()}`,
      timestamp: Date.now(),
      dateStr,
      sources: sourceList,
      destination: params.destination,
      totalFiles: totalSourceCount,
      copiedFiles: doneCount,
      skippedFiles: skippedCount,
      failedFiles: failedCount,
      totalBytes: totalSourceBytes,
      bytesCopied: bytesDone,
      durationSeconds: elapsedSeconds,
      avgSpeedMBs,
      fileLogs
    }

    send('driveSync:done', {
      copied: doneCount,
      total: totalSourceCount,
      cancelled: _cancelFlag,
      reportData: _lastReportData
    })
  })

  ipcMain.handle('driveSync:cancel', () => {
    _cancelFlag = true
  })

  // ── Report Exports ──────────────────────────────────────────
  ipcMain.handle('driveSync:exportExcel', async (_e, customReportData?: DriveSyncReportData) => {
    const report = customReportData || _lastReportData
    if (!report) throw new Error('No sync job data available to export report.')

    const win = getWin()
    const defaultName = `OneTap_Sync_Report_${new Date(report.timestamp).toISOString().slice(0,10)}.xlsx`
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? new BrowserWindow(), {
      title: 'Export Drive Sync Excel Report',
      defaultPath: defaultName,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) return null

    generateSyncExcelReport(report, filePath)
    return filePath
  })

  ipcMain.handle('driveSync:exportPdf', async (_e, customReportData?: DriveSyncReportData) => {
    const report = customReportData || _lastReportData
    if (!report) throw new Error('No sync job data available to export report.')

    const win = getWin()
    const defaultName = `OneTap_Sync_Report_${new Date(report.timestamp).toISOString().slice(0,10)}.pdf`
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? new BrowserWindow(), {
      title: 'Export Drive Sync PDF Report',
      defaultPath: defaultName,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    })

    if (canceled || !filePath) return null

    await generateSyncPdfReport(report, filePath)
    return filePath
  })

  ipcMain.handle('driveSync:exportBoth', async (_e, customReportData?: DriveSyncReportData) => {
    const report = customReportData || _lastReportData
    if (!report) throw new Error('No sync job data available to export report.')

    const win = getWin()
    const { canceled, filePaths } = await dialog.showOpenDialog(win ?? new BrowserWindow(), {
      title: 'Select Output Directory for PDF & Excel Reports',
      properties: ['openDirectory', 'createDirectory']
    })

    if (canceled || !filePaths || filePaths.length === 0) return null

    const targetFolder = filePaths[0]
    const baseName = `OneTap_Sync_Report_${new Date(report.timestamp).toISOString().slice(0,10)}`
    const excelPath = path.join(targetFolder, `${baseName}.xlsx`)
    const pdfPath   = path.join(targetFolder, `${baseName}.pdf`)

    generateSyncExcelReport(report, excelPath)
    await generateSyncPdfReport(report, pdfPath)

    return { excelPath, pdfPath, folder: targetFolder }
  })

  // ── Backup Reconciler & Dual-Drive Sync ──────────────────────
  ipcMain.handle('driveSync:getDriveCandidates', async () => {
    return getDriveCandidates()
  })

  ipcMain.handle('driveSync:reconcileDrives', async (_e, params?: {
    workingDrive?: string
    backupDrive?: string
    notifyOnMismatch?: boolean
  }) => {
    const res = await reconcileWorkingAndBackupDrives(
      params?.workingDrive,
      params?.backupDrive,
      params?.notifyOnMismatch ?? true,
      getWin
    )
    return res
  })

  // ── Auto-Detect Daemon ──────────────────────────────────────
  ipcMain.handle('driveSync:getDaemonStatus', () => {
    return getDaemonStatus()
  })

  ipcMain.handle('driveSync:toggleDaemon', (_e, active?: boolean) => {
    const cur = getDaemonStatus()
    return setDaemonActive(active !== undefined ? active : !cur.active)
  })

  ipcMain.handle('driveSync:scanDaemonNow', async () => {
    return await triggerDaemonScanNow()
  })
}
