/**
 * ============================================================
 * ARCHIVE CATALOG IPC HANDLER (src/main/ipc/archiveCatalog.ipc.ts)
 * Part of One Tap Workstation
 *
 * Bridges the Electron Main process and renderer with the Python
 * SQLite archive vault, fast scanner, and Excel reconciliation engine.
 * ============================================================
 */

import { ipcMain, app, BrowserWindow, shell, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, spawnSync, ChildProcess } from 'child_process'
import readline from 'readline'
import { generateSafarPdfHtml, exportHtmlToPdf } from '../core/safarPdfGenerator'

type WinGetter = () => BrowserWindow | null

let activeScannerProcess: ChildProcess | null = null

function resolveScriptPath(scriptName: string): string | null {
  const candidates: string[] = []

  // 1. Packaged extraResources on client PC
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'python', scriptName))
    candidates.push(path.join(process.resourcesPath, scriptName))
  }

  // 2. Unpacked asar or dev mode
  const appPath = app.getAppPath()
  if (appPath.includes('app.asar')) {
    candidates.push(path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'src', 'main', 'python', scriptName))
  } else {
    candidates.push(path.join(appPath, 'src', 'main', 'python', scriptName))
  }

  candidates.push(
    path.join(__dirname, '../../src/main/python', scriptName),
    path.join(__dirname, '../python', scriptName)
  )

  for (const p of candidates) {
    // External Python interpreter CANNOT open files inside an asar archive!
    if (p && !p.includes('app.asar') && fs.existsSync(p)) return p
  }
  return null
}

function getPythonExecutables(): string[] {
  const candidates = [
    'C:\\Users\\Burhanuddin\\AppData\\Local\\Python\\bin\\python.exe',
    process.env.PYTHON,
    process.env.PYTHON_PATH
  ].filter((p): p is string => Boolean(p && fs.existsSync(p)))

  return [...candidates, 'python', 'py', 'python3']
}

function runPythonSync(scriptName: string, args: string[]): any {
  const script = resolveScriptPath(scriptName)
  if (!script) {
    return { success: false, error: `Script ${scriptName} not found` }
  }

  const pythonCmds = getPythonExecutables()
  let lastErrorDetail = ''
  for (const py of pythonCmds) {
    try {
      const res = spawnSync(py, [script, ...args], {
        encoding: 'utf-8',
        windowsHide: true,
        maxBuffer: 50 * 1024 * 1024
      })

      if (!res.error && res.stdout) {
        try {
          return JSON.parse(res.stdout.trim())
        } catch {
          lastErrorDetail = res.stdout.trim()
        }
      }
      if (res.stderr && res.stderr.trim()) {
        lastErrorDetail = res.stderr.trim()
      } else if (res.error) {
        lastErrorDetail = res.error.message
      }
    } catch (err: any) {
      lastErrorDetail = err.message
    }
  }
  return { success: false, error: lastErrorDetail || `Failed to execute ${scriptName}` }
}

function runPythonAsync(scriptName: string, args: string[]): Promise<any> {
  const script = resolveScriptPath(scriptName)
  if (!script) {
    return Promise.resolve({ success: false, error: `Script ${scriptName} not found` })
  }

  const pythonCmds = getPythonExecutables()
  return new Promise((resolve) => {
    let proc: ChildProcess | null = null
    for (const py of pythonCmds) {
      try {
        proc = spawn(py, [script, ...args], { windowsHide: true })
        if (proc && proc.pid) break
      } catch {}
    }

    if (!proc || !proc.pid) {
      resolve({ success: false, error: `Failed to spawn ${scriptName}` })
      return
    }

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          resolve(JSON.parse(stdout.trim()))
        } catch {
          resolve({ success: true, result: stdout.trim() })
        }
      } else {
        let errDetail = stderr.trim()
        if (!errDetail && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim())
            if (parsed && parsed.error) errDetail = parsed.error
          } catch {}
        }
        resolve({ success: false, error: errDetail || `Process exited with code ${code}` })
      }
    })

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

export function registerArchiveCatalogIPC(getWin: WinGetter): void {
  // 1. Scan Directory with Real-Time Progress Streaming
  ipcMain.handle('archive:startScan', async (_event, params: {
    folderPath: string
    driveLabel?: string
    driveLocation?: string
  }) => {
    const script = resolveScriptPath('archive_scanner.py')
    if (!script) {
      return { success: false, error: 'archive_scanner.py script not found' }
    }

    if (activeScannerProcess) {
      try {
        activeScannerProcess.kill()
      } catch {}
      activeScannerProcess = null
    }

    let cleanPath = (params.folderPath || '').trim().replace(/^["']+|["']+$/g, '').trim()
    if (/^[A-Za-z]:[\\/]*$/.test(cleanPath)) {
      cleanPath = cleanPath.slice(0, 2) + '/'
    } else {
      cleanPath = cleanPath.replace(/[\\/]+$/, '')
    }

    if (!cleanPath || !fs.existsSync(cleanPath)) {
      return { success: false, error: `Folder does not exist: ${params.folderPath}` }
    }

    const args = ['--path', cleanPath]
    if (params.driveLabel && params.driveLabel.trim()) {
      args.push('--drive_label', params.driveLabel.trim())
    }
    if (params.driveLocation && params.driveLocation.trim()) {
      args.push('--drive_location', params.driveLocation.trim())
    }

    const win = getWin()

    return new Promise((resolve) => {
      const pythonCmds = getPythonExecutables()
      let proc: ChildProcess | null = null

      for (const py of pythonCmds) {
        try {
          proc = spawn(py, [script, ...args], { windowsHide: true })
          if (proc && proc.pid) break
        } catch {}
      }

      if (!proc || !proc.pid) {
        resolve({ success: false, error: 'Could not spawn Python scanner process' })
        return
      }

      activeScannerProcess = proc
      let stderrOutput = ''

      if (proc.stdout) {
        const rl = readline.createInterface({ input: proc.stdout })
        rl.on('line', (line) => {
          try {
            const data = JSON.parse(line.trim())
            if (data.type === 'progress') {
              win?.webContents.send('archive:scan-progress', data)
            } else if (data.type === 'status') {
              win?.webContents.send('archive:scan-status', data)
            } else if (data.type === 'complete') {
              win?.webContents.send('archive:scan-complete', data.result)
            }
          } catch {}
        })
      }

      if (proc.stderr) {
        proc.stderr.on('data', (chunk) => {
          stderrOutput += chunk.toString()
        })
      }

      proc.on('close', (code) => {
        activeScannerProcess = null
        if (code === 0) {
          resolve({ success: true })
        } else {
          const detail = stderrOutput.trim() || `Scanner exited with code ${code}`
          resolve({ success: false, error: detail })
        }
      })

      proc.on('error', (err) => {
        activeScannerProcess = null
        resolve({ success: false, error: err.message })
      })
    })
  })

  // 2. Cancel Active Scan
  ipcMain.handle('archive:cancelScan', async () => {
    if (activeScannerProcess) {
      try {
        activeScannerProcess.kill()
        activeScannerProcess = null
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
    return { success: true }
  })

  // 3. List All Safars in Vault
  ipcMain.handle('archive:listSafars', async () => {
    return runPythonAsync('archive_catalog_db.py', ['--action', 'list_safars'])
  })

  // 4. Safar Detailed Summary
  ipcMain.handle('archive:getSummary', async (_event, archiveId: number) => {
    return runPythonAsync('archive_catalog_db.py', ['--action', 'summary', '--archive_id', String(archiveId)])
  })

  // 5. Search Vault Media
  ipcMain.handle('archive:search', async (_event, filter: {
    query?: string
    archiveId?: number
    mediaType?: string
    eventCode?: string
    finalOnly?: boolean
    searchTarget?: 'all' | 'file' | 'folder'
    minDuration?: number
    maxDuration?: number
    limit?: number
    offset?: number
  }) => {
    const args = ['--action', 'search']
    if (filter.query) args.push('--query', filter.query)
    if (filter.archiveId) args.push('--archive_id', String(filter.archiveId))
    if (filter.mediaType) args.push('--media_type', filter.mediaType)
    if (filter.eventCode) args.push('--event_code', filter.eventCode)
    if (filter.finalOnly) args.push('--final_only')
    if (filter.searchTarget) args.push('--search_target', filter.searchTarget)
    if (filter.minDuration) args.push('--min_duration', String(filter.minDuration))
    if (filter.maxDuration) args.push('--max_duration', String(filter.maxDuration))
    if (filter.limit) args.push('--limit', String(filter.limit))
    if (filter.offset) args.push('--offset', String(filter.offset))

    return runPythonAsync('archive_catalog_db.py', args)
  })

  // 6. Detect Camera Sequence Gaps
  ipcMain.handle('archive:detectGaps', async (_event, archiveId: number) => {
    return runPythonAsync('archive_catalog_db.py', ['--action', 'gaps', '--archive_id', String(archiveId)])
  })

  // 7. Delete Archive
  ipcMain.handle('archive:deleteSafar', async (_event, archiveId: number) => {
    return runPythonAsync('archive_catalog_db.py', ['--action', 'delete', '--archive_id', String(archiveId)])
  })

  // 7.5 Delete Individual Media Item or Folder Record
  ipcMain.handle('archive:deleteItem', async (_event, params: { id: number; mediaType?: string } | number) => {
    const itemId = typeof params === 'number' ? params : params.id
    const mediaType = typeof params === 'object' ? params.mediaType : undefined
    const args = ['--action', 'delete_item', '--item_id', String(itemId)]
    if (mediaType) args.push('--media_type', mediaType)
    return runPythonAsync('archive_catalog_db.py', args)
  })

  // 8. List & Save Drives
  ipcMain.handle('archive:listDrives', async () => {
    return runPythonAsync('archive_catalog_db.py', ['--action', 'list_drives'])
  })

  ipcMain.handle('archive:saveDrive', async (_event, drive: {
    label: string
    location?: string
    notes?: string
  }) => {
    const args = ['--action', 'save_drive', '--drive_label', drive.label]
    if (drive.location) args.push('--drive_location', drive.location)
    if (drive.notes) args.push('--drive_notes', drive.notes)
    return runPythonAsync('archive_catalog_db.py', args)
  })

  // 9. Reconcile Excel File Against Archive
  ipcMain.handle('archive:reconcileExcel', async (_event, params: {
    excelPath: string
    archiveId: number
    sheetName?: string
    colDate?: string
    colFolder?: string
    colFile?: string
    exportPath?: string
    dateFilter?: string
    dateFrom?: string
    dateTo?: string
  }) => {
    const args = [
      '--excel', params.excelPath,
      '--archive_id', String(params.archiveId)
    ]
    if (params.sheetName) args.push('--sheet', params.sheetName)
    if (params.colDate) args.push('--col_date', params.colDate)
    if (params.colFolder) args.push('--col_folder', params.colFolder)
    if (params.colFile) args.push('--col_file', params.colFile)
    if (params.exportPath) args.push('--export', params.exportPath)
    if (params.dateFilter) args.push('--date_filter', params.dateFilter)
    if (params.dateFrom) args.push('--date_from', params.dateFrom)
    if (params.dateTo) args.push('--date_to', params.dateTo)

    return runPythonAsync('excel_reconciler.py', args)
  })

  // 10. Locate Asset in Windows Explorer or Check Drive Connection
  ipcMain.handle('archive:locateFile', async (_event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath)
        return { success: true }
      } else {
        return { success: false, error: 'File or external drive is currently disconnected' }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('archive:checkPathExists', async (_event, targetPath: string) => {
    try {
      return fs.existsSync(targetPath)
    } catch {
      return false
    }
  })

  // 10.5. List Folders in Archive
  ipcMain.handle('archive:listFolders', async (_event, archiveId: number) => {
    return runPythonAsync('archive_catalog_db.py', ['--action', 'list_folders', '--archive_id', String(archiveId)])
  })

  // 10.6. List Dates in Archive
  ipcMain.handle('archive:listDates', async (_event, archiveId: number) => {
    return runPythonAsync('archive_catalog_db.py', ['--action', 'list_dates', '--archive_id', String(archiveId)])
  })

  // 10.7. Get Safar Days Breakdown
  ipcMain.handle('archive:getSafarDaysBreakdown', async (_event, archiveId: number) => {
    return runPythonAsync('archive_catalog_db.py', ['--action', 'safar_days_breakdown', '--archive_id', String(archiveId)])
  })

  // 11. Generate Audit Excel from Scanned Safar (or external folder fallback)
  ipcMain.handle('archive:generateSafarExcel', async (_event, params: {
    archiveId?: number
    defaultName?: string
    folderPath?: string
    dateFilter?: string
    dateFrom?: string
    dateTo?: string
  }) => {
    const win = getWin()
    const isExternal = (!params.archiveId || params.archiveId <= 0) && !!params.folderPath
    const defaultOutput = isExternal
      ? `${(params.folderPath ? path.basename(params.folderPath) : 'Folder')}_Audit_Sheet.xlsx`
      : `Safar_${params.archiveId}_Audit_Sheet.xlsx`

    const { canceled, filePath } = await dialog.showSaveDialog(win || BrowserWindow.getFocusedWindow()!, {
      title: isExternal ? 'Save External Folder Audit Excel Workbook' : 'Save Generated Audit Excel Workbook',
      defaultPath: params.defaultName || defaultOutput,
      filters: [{ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const args = isExternal
      ? [
          '--action', 'generate_external',
          '--folder', params.folderPath!,
          '--output', filePath
        ]
      : [
          '--action', 'generate_safar',
          '--archive_id', String(params.archiveId),
          '--output', filePath
        ]
    if (!isExternal && params.folderPath) {
      args.push('--folder_path', params.folderPath)
    }
    if (params.dateFilter) {
      args.push('--date_filter', params.dateFilter)
    }
    if (params.dateFrom) {
      args.push('--date_from', params.dateFrom)
    }
    if (params.dateTo) {
      args.push('--date_to', params.dateTo)
    }

    const res = await runPythonAsync('excel_reconciler.py', args)

    return { ...res, filePath }
  })

  // 11.5. Generate Audit Excel from External Folder directly
  ipcMain.handle('archive:generateExternalFolderExcel', async (_event, params: {
    folderPath: string
    defaultName?: string
    dateFilter?: string
    dateFrom?: string
    dateTo?: string
  }) => {
    const win = getWin()
    const folderBase = path.basename(params.folderPath) || 'Folder'
    const { canceled, filePath } = await dialog.showSaveDialog(win || BrowserWindow.getFocusedWindow()!, {
      title: 'Save External Folder Audit Excel Workbook',
      defaultPath: params.defaultName || `${folderBase}_Audit_Sheet.xlsx`,
      filters: [{ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const args = [
      '--action', 'generate_external',
      '--folder', params.folderPath,
      '--output', filePath
    ]
    if (params.dateFilter) {
      args.push('--date_filter', params.dateFilter)
    }
    if (params.dateFrom) {
      args.push('--date_from', params.dateFrom)
    }
    if (params.dateTo) {
      args.push('--date_to', params.dateTo)
    }

    const res = await runPythonAsync('excel_reconciler.py', args)

    return { ...res, filePath }
  })

  // 12. Generate Clean Blank Audit Template (.xlsx)
  ipcMain.handle('archive:generateTemplateExcel', async () => {
    const win = getWin()
    const { canceled, filePath } = await dialog.showSaveDialog(win || BrowserWindow.getFocusedWindow()!, {
      title: 'Save Clean Audit Template Excel',
      defaultPath: 'One_Tap_Audit_Template.xlsx',
      filters: [{ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const res = await runPythonAsync('excel_reconciler.py', [
      '--action', 'generate_template',
      '--output', filePath
    ])

    return { ...res, filePath }
  })

  // 13. Optimize Database (Reclaim free pages, rebuild indexes, compute optimizer statistics)
  ipcMain.handle('archive:optimizeDb', async () => {
    return runPythonAsync('archive_catalog_db.py', ['--action', 'optimize_db'])
  })

  // 14. Automated Video Upload Determination & JSON Sync
  ipcMain.handle('archive:checkUploadStatus', async (_event, params?: {
    uploadDirs?: string[]
    deleteDirs?: string[]
    archiveId?: number
  }) => {
    const args = ['--json']
    if (params?.uploadDirs && params.uploadDirs.length > 0) {
      args.push('--upload-dirs', ...params.uploadDirs)
    }
    if (params?.deleteDirs && params.deleteDirs.length > 0) {
      args.push('--delete-dirs', ...params.deleteDirs)
    }
    if (params?.archiveId) {
      args.push('--archive-id', String(params.archiveId))
    }
    return runPythonAsync('check_upload_status.py', args)
  })

  // 15. Manual Upload Status Override (Persists directly to SQLite)
  ipcMain.handle('archive:setUploadStatus', async (_event, params: {
    itemId: number
    status: string
  }) => {
    return runPythonAsync('archive_catalog_db.py', [
      '--action', 'set_upload_status',
      '--item_id', String(params.itemId),
      '--upload_status', params.status
    ])
  })

  // 16. Synchronize Upload & Task Statuses directly with Task Tracker (tracker.db)
  ipcMain.handle('archive:syncTrackerStatus', async (_event, params?: { archiveId?: number }) => {
    const args = ['--action', 'sync_tracker']
    if (params?.archiveId) {
      args.push('--archive_id', String(params.archiveId))
    }
    return runPythonAsync('archive_catalog_db.py', args)
  })

  // 17. Rename Safar & Reassign Drive in Archive Vault
  ipcMain.handle('archive:renameSafar', async (_event, params: {
    archiveId?: number
    safarName?: string
    newName?: string
    city?: string
    year?: number
    serial?: string
    driveLabel?: string
    driveLetter?: string
    rootPath?: string
  }) => {
    const args = ['--action', 'rename_safar']
    if (params.newName) args.push('--new_name', params.newName)
    if (params.archiveId) args.push('--archive_id', String(params.archiveId))
    if (params.safarName) args.push('--safar_name', params.safarName)
    if (params.city) args.push('--city', params.city)
    if (params.year) args.push('--year', String(params.year))
    if (params.serial) args.push('--serial', params.serial)
    if (params.driveLabel) args.push('--new_drive_label', params.driveLabel)
    if (params.driveLetter) args.push('--new_drive_letter', params.driveLetter)
    if (params.rootPath) args.push('--new_root_path', params.rootPath)
    return runPythonAsync('archive_catalog_db.py', args)
  })

  // 18. Update Safar Drive Assignment in Archive Vault
  ipcMain.handle('archive:updateSafarDrive', async (_event, params: {
    archiveId: number
    driveLabel?: string
    driveLetter?: string
    rootPath?: string
  }) => {
    const args = ['--action', 'update_safar_drive', '--archive_id', String(params.archiveId)]
    if (params.driveLabel) args.push('--new_drive_label', params.driveLabel)
    if (params.driveLetter) args.push('--new_drive_letter', params.driveLetter)
    if (params.rootPath) args.push('--new_root_path', params.rootPath)
    return runPythonAsync('archive_catalog_db.py', args)
  })

  // 19. Automatic Folder Watcher for IN PROCESS dirs
  ipcMain.handle('archive:setupAutoWatcher', async (_event, dirs?: string[]) => {
    try {
      const paths = dirs && dirs.length > 0 ? dirs : []
      setupArchiveAutoWatcher(paths, getWin)
      return { success: true, watchingCount: activeArchiveWatchers.length }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 20. Executive Styled Safar PDF Report Exporter
  ipcMain.handle('archive:exportSafarPdf', async (_event, params: {
    archiveId?: number
    defaultName?: string
    pdfData?: any
  }) => {
    const win = getWin()
    let data = params.pdfData
    if (!data && params.archiveId) {
      const summaryRes = await runPythonAsync('archive_catalog_db.py', ['--action', 'summary', '--archive_id', String(params.archiveId)])
      const breakdownRes = await runPythonAsync('archive_catalog_db.py', ['--action', 'safar_days_breakdown', '--archive_id', String(params.archiveId)])
      data = {
        safar_name: summaryRes?.safar_name || `Safar_${params.archiveId}`,
        city: summaryRes?.city,
        safar_year: summaryRes?.safar_year,
        drive_label: summaryRes?.volume_label,
        total_files: summaryRes?.total_files || 0,
        total_mp4_count: summaryRes?.total_mp4_count || 0,
        total_size_bytes: summaryRes?.total_size_bytes || 0,
        total_duration_seconds: summaryRes?.total_duration_seconds || 0,
        duration_formatted: summaryRes?.duration_formatted || '00:00',
        total_days_count: breakdownRes?.days?.length || 1,
        events: summaryRes?.event_distribution?.map((e: any) => ({
          code: e.event_code,
          name: e.event_code,
          count: e.count,
          size_mb: e.size ? e.size / (1024 * 1024) : 0
        })) || [],
        days: breakdownRes?.days?.map((d: any) => ({
          date_key: d.date_key,
          sessions: Array.from(d.sessions || []),
          mp4_count: d.mp4_count,
          duration: d.duration_formatted,
          size_mb: d.size_bytes ? d.size_bytes / (1024 * 1024) : 0,
          events_summary: d.events ? Object.entries(d.events).map(([k, v]) => `${k} (${v})`).join(', ') : ''
        })) || []
      }
    }

    if (!data) {
      return { success: false, error: 'No Safar data found to export.' }
    }

    const defaultFilename = params.defaultName || `${(data.safar_name || 'Safar').replace(/[\\/:*?"<>|]/g, '_')}_Audit_Report.pdf`
    const { canceled, filePath } = await dialog.showSaveDialog(win || BrowserWindow.getFocusedWindow()!, {
      title: 'Export Executive Safar PDF Audit Report',
      defaultPath: defaultFilename,
      filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const html = generateSafarPdfHtml(data)
    await exportHtmlToPdf(html, filePath)
    return { success: true, filePath }
  })

  // 21. Natural Language Vault Assistant Chat Query
  ipcMain.handle('archive:chatQuery', async (_event, params: { query: string; archiveId?: number }) => {
    const args = ['--action', 'chat_query', '--query', params.query]
    if (params.archiveId && params.archiveId > 0) {
      args.push('--archive_id', String(params.archiveId))
    }
    return runPythonAsync('archive_catalog_db.py', args)
  })

  // 22. Export Query Results to Custom Excel Workbook
  ipcMain.handle('archive:exportQueryExcel', async (_event, params: {
    query: string
    items: any[]
    defaultName?: string
  }) => {
    const win = getWin()
    const cleanQ = (params.query || 'Query').replace(/[\\/:*?"<>| ]/g, '_').slice(0, 30)
    const defaultOutput = params.defaultName || `Vault_Query_${cleanQ}.xlsx`

    const { canceled, filePath } = await dialog.showSaveDialog(win || BrowserWindow.getFocusedWindow()!, {
      title: 'Save Query Result Excel Workbook',
      defaultPath: defaultOutput,
      filters: [{ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const tempJsonPath = path.join(app.getPath('temp'), `vault_query_${Date.now()}.json`)
    fs.writeFileSync(tempJsonPath, JSON.stringify(params.items || []), 'utf-8')

    try {
      const res = await runPythonAsync('excel_reconciler.py', [
        '--action', 'generate_query',
        '--query', params.query,
        '--items_json', tempJsonPath,
        '--output', filePath
      ])
      return { ...res, filePath }
    } finally {
      if (fs.existsSync(tempJsonPath)) {
        try { fs.unlinkSync(tempJsonPath) } catch {}
      }
    }
  })
}

// ── Background Auto-Watcher for Archive / Data Search ──────────

let activeArchiveWatchers: fs.FSWatcher[] = []
let scanDebounceTimer: NodeJS.Timeout | null = null

export function stopArchiveWatchers(): void {
  for (const w of activeArchiveWatchers) {
    try { w.close() } catch {}
  }
  activeArchiveWatchers = []
}

export function setupArchiveAutoWatcher(pathsToWatch: string[], getWin: WinGetter): void {
  stopArchiveWatchers()
  // STRICT FILTER: Never watch bare drive roots (e.g. D:\, C:\) or database folders!
  const validPaths = pathsToWatch.filter(p => {
    if (!p || typeof p !== 'string') return false
    const trimmed = p.trim().replace(/^["']+|["']+$/g, '').trim()
    if (/^[A-Za-z]:[\\/]*$/.test(trimmed)) return false // Never watch bare root drive
    if (trimmed.length <= 3) return false
    const lower = trimmed.toLowerCase()
    if (lower.includes('uid data') || lower.includes('database') || lower.includes('.db') || lower.includes('appdata')) return false
    return fs.existsSync(trimmed)
  })

  for (const dir of validPaths) {
    try {
      const watcher = fs.watch(dir, { recursive: true }, (_eventType, filename) => {
        if (!filename) return
        const fn = filename.toLowerCase()
        if (
          fn.includes('adobe') ||
          fn.includes('auto-save') ||
          fn.includes('temp') ||
          fn.includes('cache') ||
          fn.includes('uid data') ||
          fn.includes('database') ||
          fn.endsWith('.tmp') ||
          fn.endsWith('.crswap') ||
          fn.endsWith('.db') ||
          fn.endsWith('.db-wal') ||
          fn.endsWith('.db-shm') ||
          fn.endsWith('.journal') ||
          fn.startsWith('.') ||
          fn.startsWith('$')
        ) {
          return
        }

        if (scanDebounceTimer) clearTimeout(scanDebounceTimer)
        scanDebounceTimer = setTimeout(async () => {
          try {
            if (activeScannerProcess) return // Never clash with active user scan
            const parts = filename.split(/[\\/]/)
            const safarSub = parts[0]
            if (safarSub.toLowerCase().includes('uid data') || safarSub.toLowerCase().includes('database') || safarSub.toLowerCase().includes('.db')) {
              return
            }
            const fullSafarPath = path.join(dir, safarSub)
            if (fs.existsSync(fullSafarPath) && fs.statSync(fullSafarPath).isDirectory()) {
              await runPythonAsync('archive_scanner.py', ['--path', fullSafarPath])
            } else {
              await runPythonAsync('archive_scanner.py', ['--path', dir])
            }
            const win = getWin()
            win?.webContents.send('archive:catalog-updated')
          } catch (err) {
            console.warn('[archiveAutoWatcher] Auto-scan error:', err)
          }
        }, 5000)
      })
      activeArchiveWatchers.push(watcher)
    } catch (err) {
      console.warn(`[archiveAutoWatcher] Could not watch directory ${dir}:`, err)
    }
  }
}
