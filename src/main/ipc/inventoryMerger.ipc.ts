import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawnSync } from 'child_process'
import XLSX from 'xlsx'

function mergeInventoryReportsJS(file1Path: string, file2Path: string, outputPath?: string) {
  if (!outputPath) {
    const dirName = path.dirname(file1Path)
    const base1 = path.basename(file1Path)
    let outName = ''
    if (base1.includes('_01M')) {
      outName = base1.replace('_01M', '_Merged')
    } else if (base1.includes('_02E')) {
      outName = base1.replace('_02E', '_Merged')
    } else {
      const ext = path.extname(base1)
      outName = path.basename(base1, ext) + '_Merged.xlsx'
    }
    outputPath = path.join(dirName, outName)
  }

  const wb1 = XLSX.readFile(file1Path)
  const wb2 = XLSX.readFile(file2Path)

  const outWb = XLSX.utils.book_new()

  const stats = {
    missingCount: 0,
    folderColsCount: 0,
    cameraSummary: {} as Record<string, { found: number; missing: number }>,
    issueCount: 0
  }

  // 1. Missing Files Sheet
  const mfHeaders = ['Folder Path', 'File Name', 'Status', 'Camera Type']
  const mfRows: any[][] = [mfHeaders]

  for (const wb of [wb1, wb2]) {
    if (wb.SheetNames.includes('Missing Files')) {
      const ws = wb.Sheets['Missing Files']
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
      for (let r = 1; r < data.length; r++) {
        const row = data[r]
        if (row && row.some((v) => v !== undefined && v !== null && String(v).trim() !== '')) {
          mfRows.push([row[0] || '', row[1] || '', row[2] || '', row[3] || ''])
        }
      }
    }
  }
  stats.missingCount = mfRows.length - 1
  const wsMf = XLSX.utils.aoa_to_sheet(mfRows)
  XLSX.utils.book_append_sheet(outWb, wsMf, 'Missing Files')

  // 2. Folder Structure Sheet
  function extractFsCols(wb: XLSX.WorkBook) {
    if (!wb.SheetNames.includes('Folder Structure')) return []
    const ws = wb.Sheets['Folder Structure']
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
    if (data.length < 2) return []

    const maxCols = Math.max(...data.map((r) => (r ? r.length : 0)))
    const cols: { r1: any; r2: any; files: string[] }[] = []

    for (let c = 0; c < maxCols; c++) {
      const r1 = data[0] ? data[0][c] : undefined
      const r2 = data[1] ? data[1][c] : undefined
      if (r1 === undefined && r2 === undefined) continue

      const files: string[] = []
      for (let r = 2; r < data.length; r++) {
        const v = data[r] ? data[r][c] : undefined
        if (v === undefined || v === null) continue
        const sv = String(v).trim()
        if (!sv) continue
        if (/^\.[a-zA-Z0-9]+:\s*\d+$/.test(sv)) continue
        files.push(sv)
      }
      cols.push({ r1, r2, files })
    }
    return cols
  }

  const cols1 = extractFsCols(wb1)
  const cols2 = extractFsCols(wb2)
  const fsMerged: Map<string, { r1: any; r2: any; files: string[] }> = new Map()

  for (const col of [...cols1, ...cols2]) {
    const key = `${col.r1}|||${col.r2}`
    if (!fsMerged.has(key)) {
      fsMerged.set(key, { r1: col.r1, r2: col.r2, files: [] })
    }
    fsMerged.get(key)!.files.push(...col.files)
  }

  const fsAoa: any[][] = []
  const r1Row: any[] = []
  const r2Row: any[] = []
  const colFilesList: string[][] = []

  fsMerged.forEach(({ r1, r2, files }) => {
    r1Row.push(r1)
    r2Row.push(r2)

    const extCounter: Record<string, number> = {}
    const cleanFiles: string[] = []
    for (const f of files) {
      cleanFiles.push(f)
      const m = f.match(/\.([a-zA-Z0-9]+)$/)
      if (m) {
        const ext = m[1].toLowerCase()
        extCounter[ext] = (extCounter[ext] || 0) + 1
      }
    }
    const summaryLines = Object.keys(extCounter)
      .sort()
      .map((ext) => `.${ext}: ${extCounter[ext]}`)
    colFilesList.push([...cleanFiles, ...summaryLines])
  })

  fsAoa.push(r1Row)
  fsAoa.push(r2Row)

  const maxFileRows = colFilesList.length > 0 ? Math.max(...colFilesList.map((l) => l.length)) : 0
  for (let r = 0; r < maxFileRows; r++) {
    const row: any[] = []
    for (let c = 0; c < colFilesList.length; c++) {
      row.push(colFilesList[c][r] !== undefined ? colFilesList[c][r] : '')
    }
    fsAoa.push(row)
  }

  stats.folderColsCount = fsMerged.size
  const wsFs = XLSX.utils.aoa_to_sheet(fsAoa)
  XLSX.utils.book_append_sheet(outWb, wsFs, 'Folder Structure')

  // 3. Camera Summary Sheet
  function extractCsCols(wb: XLSX.WorkBook) {
    if (!wb.SheetNames.includes('Camera Summary')) return {}
    const ws = wb.Sheets['Camera Summary']
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
    if (data.length < 1) return {}

    const headers = data[0] || []
    const result: Record<
      string,
      { files: string[]; tot_found: number | null; tot_missing: number | null }
    > = {}

    for (let c = 0; c < headers.length; c++) {
      const h = headers[c]
      if (!h) continue
      const files: string[] = []
      let tot_found: number | null = null
      let tot_missing: number | null = null

      for (let r = 1; r < data.length; r++) {
        const v = data[r] ? data[r][c] : undefined
        if (v === undefined || v === null) continue
        const sv = String(v).trim()
        if (sv.startsWith('Total Found:')) {
          const parts = sv.split(':')
          if (parts[1]) tot_found = parseInt(parts[1].trim(), 10) || null
        } else if (sv.startsWith('Total Missing:')) {
          const parts = sv.split(':')
          if (parts[1]) tot_missing = parseInt(parts[1].trim(), 10) || null
        } else {
          files.push(sv)
        }
      }
      result[h] = { files, tot_found, tot_missing }
    }
    return result
  }

  const cs1 = extractCsCols(wb1)
  const cs2 = extractCsCols(wb2)
  const allCsHeaders = Array.from(new Set([...Object.keys(cs1), ...Object.keys(cs2)]))

  const csAoa: any[][] = []
  const csHeaderRow = [...allCsHeaders]
  csAoa.push(csHeaderRow)

  const csColData: string[][] = []
  for (const h of allCsHeaders) {
    const files1 = cs1[h]?.files || []
    const files2 = cs2[h]?.files || []
    const tf1 = cs1[h]?.tot_found ?? files1.length
    const tf2 = cs2[h]?.tot_found ?? files2.length
    const tm1 = cs1[h]?.tot_missing ?? 0
    const tm2 = cs2[h]?.tot_missing ?? 0

    const foundSum = tf1 + tf2
    const missingSum = tm1 + tm2
    stats.cameraSummary[h] = { found: foundSum, missing: missingSum }

    const combined = [
      ...files1,
      ...files2,
      `Total Found: ${foundSum}`,
      `Total Missing: ${missingSum}`
    ]
    csColData.push(combined)
  }

  const maxCsRows = csColData.length > 0 ? Math.max(...csColData.map((l) => l.length)) : 0
  for (let r = 0; r < maxCsRows; r++) {
    const row: any[] = []
    for (let c = 0; c < csColData.length; c++) {
      row.push(csColData[c][r] !== undefined ? csColData[c][r] : '')
    }
    csAoa.push(row)
  }
  const wsCs = XLSX.utils.aoa_to_sheet(csAoa)
  XLSX.utils.book_append_sheet(outWb, wsCs, 'Camera Summary')

  // 4. Contributor Sheet
  const conHeaders = ['Folder Path', 'File Name']
  const conRows: any[][] = [conHeaders]
  const seenCon = new Set<string>()

  for (const wb of [wb1, wb2]) {
    if (wb.SheetNames.includes('Contributor')) {
      const ws = wb.Sheets['Contributor']
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
      for (let r = 1; r < data.length; r++) {
        const row = data[r]
        if (row && row.some((v) => v !== undefined && v !== null && String(v).trim() !== '')) {
          const key = `${row[0]}|||${row[1]}`
          if (!seenCon.has(key)) {
            seenCon.add(key)
            conRows.push([row[0] || '', row[1] || ''])
          }
        }
      }
    }
  }
  const wsCon = XLSX.utils.aoa_to_sheet(conRows)
  XLSX.utils.book_append_sheet(outWb, wsCon, 'Contributor')

  // 5. Issues Sheet
  const issHeaders = ['Path', 'Issue Type', 'Description']
  const issRows: any[][] = [issHeaders]
  const seenIss = new Set<string>()

  for (const wb of [wb1, wb2]) {
    if (wb.SheetNames.includes('Issues')) {
      const ws = wb.Sheets['Issues']
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
      for (let r = 1; r < data.length; r++) {
        const row = data[r]
        if (row && row.some((v) => v !== undefined && v !== null && String(v).trim() !== '')) {
          const key = `${row[0]}|||${row[1]}|||${row[2]}`
          if (!seenIss.has(key)) {
            seenIss.add(key)
            issRows.push([row[0] || '', row[1] || '', row[2] || ''])
          }
        }
      }
    }
  }
  stats.issueCount = issRows.length - 1
  const wsIss = XLSX.utils.aoa_to_sheet(issRows)
  XLSX.utils.book_append_sheet(outWb, wsIss, 'Issues')

  XLSX.writeFile(outWb, outputPath)

  return {
    success: true,
    outputPath,
    stats
  }
}

export function registerInventoryMergerIPC(): void {
  ipcMain.handle(
    'inventoryMerger:merge',
    async (_event, params: { file1: string; file2: string; outputPath?: string }) => {
      try {
        const { file1, file2, outputPath } = params
        if (!file1 || !fs.existsSync(file1)) {
          return { success: false, error: 'Report 1 file not found or invalid path.' }
        }
        if (!file2 || !fs.existsSync(file2)) {
          return { success: false, error: 'Report 2 file not found or invalid path.' }
        }

        // Discover script path across dev, electron-vite out, and production bundle locations
        const candidatePaths = [
          path.join(process.cwd(), 'src', 'main', 'python', 'merge_inventory_reports.py'),
          path.join(__dirname, '../../src/main/python/merge_inventory_reports.py'),
          path.join(__dirname, '../python/merge_inventory_reports.py'),
          path.join(process.cwd(), 'tools', 'merge_inventory_reports.py')
        ]

        if (process.resourcesPath) {
          candidatePaths.push(
            path.join(process.resourcesPath, 'python', 'merge_inventory_reports.py'),
            path.join(process.resourcesPath, 'merge_inventory_reports.py')
          )
        }
        if (app) {
          try {
            const appPath = app.getAppPath()
            if (appPath.includes('app.asar')) {
              candidatePaths.push(path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'src', 'main', 'python', 'merge_inventory_reports.py'))
            } else {
              candidatePaths.push(
                path.join(appPath, 'src', 'main', 'python', 'merge_inventory_reports.py'),
                path.join(appPath, 'out', 'python', 'merge_inventory_reports.py')
              )
            }
          } catch {}
        }

        let targetScript = ''
        for (const p of candidatePaths) {
          if (p && !p.includes('app.asar') && fs.existsSync(p)) {
            targetScript = p
            break
          }
        }

        if (targetScript) {
          const pythonCmds = ['python', 'py', 'python3']
          for (const pyCmd of pythonCmds) {
            const args = [targetScript, '--file1', file1, '--file2', file2, '--json']
            if (outputPath) args.push('--output', outputPath)
            const res = spawnSync(pyCmd, args, { encoding: 'utf-8', windowsHide: true })
            if (!res.error && res.status === 0 && res.stdout) {
              try {
                const parsed = JSON.parse(res.stdout.trim())
                if (parsed.success) return parsed
              } catch {}
            }
          }
        }

        // Fallback to native JS/TS Excel Merger using XLSX package
        return mergeInventoryReportsJS(file1, file2, outputPath)
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Unknown error occurred while merging Excel reports.'
        }
      }
    }
  )
}

