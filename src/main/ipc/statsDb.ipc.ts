/**
 * ============================================================
 * STATS DB IPC HANDLER (src/main/ipc/statsDb.ipc.ts)
 *
 * Exposes SQLite-backed stats operations to the Electron renderer
 * with automatic fallback and synchronization with settings.json.
 * ============================================================
 */

import { ipcMain, app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, spawnSync } from 'child_process'
import { get, setAndSave, getSettingsFolder } from '../core/settingsManager'

type WinGetter = () => BrowserWindow | null

let cachedScriptPath: string | null = null
let cachedPythonCmd: string | null = null
let cachedDbPath: string | null = null

function getStatsScriptPath(): string | null {
  if (cachedScriptPath && fs.existsSync(cachedScriptPath)) return cachedScriptPath

  const candidates: string[] = []
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'python', 'stats_db.py'))
    candidates.push(path.join(process.resourcesPath, 'stats_db.py'))
  }
  const appPath = app.getAppPath()
  if (appPath.includes('app.asar')) {
    candidates.push(path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'src', 'main', 'python', 'stats_db.py'))
  } else {
    candidates.push(path.join(appPath, 'src', 'main', 'python', 'stats_db.py'))
  }
  candidates.push(
    path.join(__dirname, '../../src/main/python/stats_db.py'),
    path.join(__dirname, '../python/stats_db.py')
  )

  for (const p of candidates) {
    if (p && !p.includes('app.asar') && fs.existsSync(p)) {
      cachedScriptPath = p
      return p
    }
  }
  return null
}

function getStatsDbPath(): string {
  if (cachedDbPath) return cachedDbPath
  const dir = getSettingsFolder()
  cachedDbPath = path.join(dir, 'stats.db')
  return cachedDbPath
}

function getPythonCmds(): string[] {
  if (cachedPythonCmd) {
    return [cachedPythonCmd]
  }
  const candidates = [
    'C:\\Users\\Burhanuddin\\AppData\\Local\\Python\\bin\\python.exe',
    process.env.PYTHON,
    process.env.PYTHON_PATH
  ].filter((p): p is string => Boolean(p && fs.existsSync(p)))

  return [...candidates, 'python', 'py', 'python3']
}

async function runPythonDb(args: string[], stdinData?: string): Promise<any> {
  const script = getStatsScriptPath()
  if (!script) return null

  const dbPath = getStatsDbPath()
  const fullArgs = ['--db', dbPath, ...args]
  const pythonCmds = getPythonCmds()

  for (const py of pythonCmds) {
    try {
      const result = await new Promise<any>((resolve) => {
        const proc = spawn(py, [script, ...fullArgs], {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'ignore']
        })
        let stdout = ''
        if (stdinData && proc.stdin) {
          proc.stdin.write(stdinData)
          proc.stdin.end()
        }
        proc.stdout?.on('data', (d) => { stdout += d.toString() })
        proc.on('close', (code) => {
          if (code === 0 && stdout.trim()) {
            cachedPythonCmd = py
            try {
              resolve(JSON.parse(stdout.trim()))
              return
            } catch {}
          }
          resolve(null)
        })
        proc.on('error', () => resolve(null))
      })
      if (result) return result
    } catch {}
  }

  // Fallback sync if async failed
  for (const py of pythonCmds) {
    try {
      const res = spawnSync(py, [script, ...fullArgs], {
        input: stdinData,
        encoding: 'utf-8',
        windowsHide: true,
        maxBuffer: 50 * 1024 * 1024
      })
      if (!res.error && res.status === 0 && res.stdout) {
        cachedPythonCmd = py
        try {
          return JSON.parse(res.stdout.trim())
        } catch {}
      }
    } catch {}
  }
  return null
}

export function registerStatsDbIPC(getWin: WinGetter): void {
  // 1. Get all records with auto-migration from settings.json
  ipcMain.handle('statsDb:getAll', async () => {
    // Read settings.json backup
    const raw = get('render_stats')
    let jsonRecords: any[] = []
    if (raw) {
      jsonRecords = typeof raw === 'string' ? JSON.parse(raw) : raw
    }

    // Try SQLite first
    const pyRes = await runPythonDb(['--get-all'])
    if (pyRes && pyRes.success && Array.isArray(pyRes.records) && pyRes.records.length > 0) {
      // If SQLite has records, return them
      return pyRes.records
    }

    // If SQLite is empty or missing, but settings.json has records, migrate to SQLite!
    if (Array.isArray(jsonRecords) && jsonRecords.length > 0) {
      try {
        await runPythonDb(['--insert-batch'], JSON.stringify(jsonRecords))
        console.log(`[StatsDbIPC] Auto-migrated ${jsonRecords.length} records from settings.json to stats.db`)
      } catch (err) {
        console.warn('[StatsDbIPC] Auto-migration error:', err)
      }
      return jsonRecords
    }

    return (pyRes && pyRes.success && Array.isArray(pyRes.records)) ? pyRes.records : []
  })

  // 1b. Explicit migration from JSON to SQLite
  ipcMain.handle('statsDb:migrateFromJson', async () => {
    const raw = get('render_stats')
    let jsonRecords: any[] = []
    if (raw) {
      jsonRecords = typeof raw === 'string' ? JSON.parse(raw) : raw
    }
    if (!Array.isArray(jsonRecords) || jsonRecords.length === 0) {
      return { success: true, count: 0, message: 'No records found in settings.json' }
    }
    const pyRes = await runPythonDb(['--insert-batch'], JSON.stringify(jsonRecords))
    return pyRes && pyRes.success
      ? { success: true, count: pyRes.count }
      : { success: false, error: 'Failed inserting records into SQLite' }
  })

  // 2. Batch insert or update records
  ipcMain.handle('statsDb:insertRecords', async (_e, records: any[]) => {
    if (!Array.isArray(records) || records.length === 0) return { success: true, count: 0 }

    // Sync to SQLite
    const pyRes = await runPythonDb(['--insert-batch'], JSON.stringify(records))

    // Retrieve consolidated records from SQLite or merge with existing to avoid overwriting full history
    let allRecords: any[] = []
    const fullRes = await runPythonDb(['--get-all'])
    if (fullRes && fullRes.success && Array.isArray(fullRes.records) && fullRes.records.length > 0) {
      allRecords = fullRes.records
    } else {
      const raw = get('render_stats')
      let existing: any[] = []
      if (raw) {
        existing = typeof raw === 'string' ? JSON.parse(raw) : raw
      }
      allRecords = [...existing]
      for (const r of records) {
        const idx = allRecords.findIndex(m => m.name === r.name && m.prefix === r.prefix && Math.abs((m.date || 0) - (r.date || 0)) < 86400000)
        if (idx > -1) allRecords[idx] = r
        else allRecords.push(r)
      }
    }

    // Always keep settings.json synchronized as backup with ALL records
    try {
      await setAndSave('render_stats', allRecords)
    } catch (err) {
      console.warn('[StatsDbIPC] Sync to settings.json warning:', err)
    }

    const win = getWin()
    if (win) {
      win.webContents.send('stats-db-updated', allRecords)
    }

    return pyRes && pyRes.success ? pyRes : { success: true, count: records.length, fallback: true }
  })

  // 3. Reassign Safar (e.g. move deleted Safar to Unassigned)
  ipcMain.handle('statsDb:reassignSafar', async (_e, params: { fromSafar: string; toSafar?: string }) => {
    const fromSafar = params.fromSafar
    const toSafar = params.toSafar || 'Unassigned'
    if (!fromSafar) return { success: false, error: 'No fromSafar specified' }

    // Execute in SQLite
    const pyRes = await runPythonDb(['--reassign-safar', '--from-safar', fromSafar, '--to-safar', toSafar])

    // Update settings.json in tandem
    let currentRecords: any[] = []
    const raw = get('render_stats')
    if (raw) {
      currentRecords = typeof raw === 'string' ? JSON.parse(raw) : (raw as any[])
    }

    let updatedCount = 0
    const updatedRecords = currentRecords.map(r => {
      if (r.safar === fromSafar || (!r.safar && r.city === fromSafar)) {
        updatedCount++
        return {
          ...r,
          safar: toSafar,
          city: toSafar
        }
      }
      return r
    })

    try {
      await setAndSave('render_stats', updatedRecords)
    } catch {}

    const win = getWin()
    if (win) {
      win.webContents.send('stats-db-updated', updatedRecords)
    }

    return {
      success: true,
      updated: (pyRes && pyRes.updated) ? pyRes.updated : updatedCount,
      safar: toSafar
    }
  })

  // 3b. Delete Safar (permanently remove Safar and all its records)
  ipcMain.handle('statsDb:deleteSafar', async (_e, params: { safar: string }) => {
    const safar = params.safar
    if (!safar) return { success: false, error: 'No safar specified' }

    // Execute in SQLite
    const pyRes = await runPythonDb(['--delete-safar', '--from-safar', safar])

    // Update settings.json in tandem
    let currentRecords: any[] = []
    const raw = get('render_stats')
    if (raw) {
      currentRecords = typeof raw === 'string' ? JSON.parse(raw) : (raw as any[])
    }

    const filteredRecords = currentRecords.filter(r => r.safar !== safar && !(!r.safar && r.city === safar))

    try {
      await setAndSave('render_stats', filteredRecords)
    } catch {}

    const win = getWin()
    if (win) {
      win.webContents.send('stats-db-updated', filteredRecords)
    }

    return {
      success: true,
      deleted: (pyRes && pyRes.deleted) ? pyRes.deleted : (currentRecords.length - filteredRecords.length),
      safar
    }
  })

  // 3c. Delete Folder (permanently remove Folder and all its records)
  ipcMain.handle('statsDb:deleteFolder', async (_e, params: { folder: string }) => {
    const folder = params.folder
    if (!folder) return { success: false, error: 'No folder specified' }

    // Execute in SQLite
    const pyRes = await runPythonDb(['--delete-folder', '--from-folder', folder])

    // Update settings.json in tandem
    let currentRecords: any[] = []
    const raw = get('render_stats')
    if (raw) {
      currentRecords = typeof raw === 'string' ? JSON.parse(raw) : (raw as any[])
    }

    const filteredRecords = currentRecords.filter(r => r.folder !== folder && !(!r.folder && folder === 'Direct Render'))

    try {
      await setAndSave('render_stats', filteredRecords)
    } catch {}

    const win = getWin()
    if (win) {
      win.webContents.send('stats-db-updated', filteredRecords)
    }

    return {
      success: true,
      deleted: (pyRes && pyRes.deleted) ? pyRes.deleted : (currentRecords.length - filteredRecords.length),
      folder
    }
  })

  // 4. Rename Safar block metadata (name, serial, year, city)
  ipcMain.handle('statsDb:renameSafar', async (_e, params: {
    fromSafar: string
    toSafar: string
    newSerial?: string
    newYear?: number
    newCity?: string
  }) => {
    const { fromSafar, toSafar, newSerial, newYear, newCity } = params
    if (!fromSafar || !toSafar) return { success: false, error: 'Both fromSafar and toSafar required' }

    // Prepare Python arguments
    const pyArgs = ['--rename-safar', '--from-safar', fromSafar, '--to-safar', toSafar]
    if (newSerial) pyArgs.push('--new-serial', newSerial)
    if (newYear) pyArgs.push('--new-year', String(newYear))
    if (newCity) pyArgs.push('--new-city', newCity)

    const pyRes = await runPythonDb(pyArgs)

    // Synchronize settings.json
    let currentRecords: any[] = []
    const raw = get('render_stats')
    if (raw) {
      currentRecords = typeof raw === 'string' ? JSON.parse(raw) : (raw as any[])
    }

    let updatedCount = 0
    const updatedRecords = currentRecords.map(r => {
      if (r.safar === fromSafar || (!r.safar && r.city === fromSafar)) {
        updatedCount++
        return {
          ...r,
          safar: toSafar,
          ...(newSerial ? { safarSerial: newSerial } : {}),
          ...(newYear ? { safarYear: Number(newYear) } : {}),
          ...(newCity ? { city: newCity } : {})
        }
      }
      return r
    })

    try {
      await setAndSave('render_stats', updatedRecords)
    } catch {}

    const win = getWin()
    if (win) {
      win.webContents.send('stats-db-updated', updatedRecords)
    }

    return {
      success: true,
      updated: (pyRes && pyRes.updated) ? pyRes.updated : updatedCount,
      safar: toSafar
    }
  })

  // 5. Locate and sync old historical data into SQLite and settings
  ipcMain.handle('statsDb:syncOldData', async (_e, params: { safarDir?: string; mainDir?: string; finalDir?: string }) => {
    const { safarDir, mainDir, finalDir } = params
    if (!safarDir && (!mainDir || !finalDir)) {
      return { success: false, error: 'Either Safar Directory or both Main and Final Directories are required.' }
    }

    const pyArgs: string[] = []
    if (safarDir) {
      pyArgs.push('--safar-dir', safarDir)
    } else {
      if (mainDir) pyArgs.push('--main-dir', mainDir)
      if (finalDir) pyArgs.push('--final-dir', finalDir)
    }

    const pyRes = await runPythonSync(pyArgs)
    if (pyRes && pyRes.success && Array.isArray(pyRes.records)) {
      // Synchronize settings.json with merged records
      let currentRecords: any[] = []
      const raw = get('render_stats')
      if (raw) {
        currentRecords = typeof raw === 'string' ? JSON.parse(raw) : (raw as any[])
      }

      const merged = [...currentRecords]
      pyRes.records.forEach((r: any) => {
        const exists = merged.some(m => m.name === r.name && m.prefix === r.prefix && m.date === r.date)
        if (!exists) merged.push(r)
      })

      try {
        await setAndSave('render_stats', merged)
      } catch {}

      const win = getWin()
      if (win && !win.isDestroyed()) {
        win.webContents.send('stats-db-updated', merged)
      }

      return {
        success: true,
        totalScanned: pyRes.totalScanned,
        inserted: pyRes.inserted,
        safars: pyRes.safars,
        records: pyRes.records
      }
    }

    return pyRes || { success: false, error: 'Failed to process directory with sync script.' }
  })
}

function getSyncScriptPath(): string | null {
  const candidates: string[] = []
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'python', 'sync_old_data.py'))
    candidates.push(path.join(process.resourcesPath, 'sync_old_data.py'))
  }
  const appPath = app.getAppPath()
  if (appPath.includes('app.asar')) {
    candidates.push(path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'src', 'main', 'python', 'sync_old_data.py'))
  } else {
    candidates.push(path.join(appPath, 'src', 'main', 'python', 'sync_old_data.py'))
  }
  candidates.push(
    path.join(__dirname, '../../src/main/python/sync_old_data.py'),
    path.join(__dirname, '../python/sync_old_data.py')
  )

  for (const p of candidates) {
    if (p && !p.includes('app.asar') && fs.existsSync(p)) return p
  }
  return null
}

async function runPythonSync(args: string[]): Promise<any> {
  const script = getSyncScriptPath()
  if (!script) return null

  const dbPath = getStatsDbPath()
  const fullArgs = ['--db', dbPath, ...args]
  const pythonCmds = getPythonCmds()

  for (const py of pythonCmds) {
    try {
      const result = await new Promise<any>((resolve) => {
        const proc = spawn(py, [script, ...fullArgs], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'ignore']
        })
        let stdout = ''
        proc.stdout?.on('data', (d) => { stdout += d.toString() })
        proc.on('close', (code) => {
          if (code === 0 && stdout.trim()) {
            cachedPythonCmd = py
            try {
              resolve(JSON.parse(stdout.trim()))
              return
            } catch {}
          }
          resolve(null)
        })
        proc.on('error', () => resolve(null))
      })
      if (result) return result
    } catch {}
  }

  for (const py of pythonCmds) {
    try {
      const res = spawnSync(py, [script, ...fullArgs], {
        encoding: 'utf-8',
        windowsHide: true,
        maxBuffer: 50 * 1024 * 1024
      })

      if (!res.error && res.status === 0 && res.stdout) {
        cachedPythonCmd = py
        try {
          return JSON.parse(res.stdout.trim())
        } catch {}
      }
    } catch {}
  }
  return null
}
