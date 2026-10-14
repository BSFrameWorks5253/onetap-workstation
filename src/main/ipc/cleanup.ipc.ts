import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'

const JUNK_FOLDERS = [
  'Adobe Premiere Pro Auto-Save',
  'Adobe Premiere Pro Video Previews',
  'Adobe Premiere Pro Audio Previews',
  'Encrypted Cache',
  'Proxy',
  'Cache',
  'Media Cache Files',
  'Peak Files'
]

interface JunkItem {
  name: string
  path: string
  size: number
}

function getDirSize(dir: string): number {
  let size = 0
  try {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) size += getDirSize(fullPath)
      else size += stat.size
    }
  } catch { /* ignore errors */ }
  return size
}

export function registerCleanupIPC(): void {
  ipcMain.handle('cleanup:scan', (_e, rootPath: string) => {
    if (!rootPath || !fs.existsSync(rootPath)) return []
    
    const junk: JunkItem[] = []
    function findJunk(dir: string, depth = 0) {
      if (depth > 4) return // prevent deep recursion
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (JUNK_FOLDERS.includes(entry.name)) {
              junk.push({
                name: entry.name,
                path: fullPath,
                size: getDirSize(fullPath)
              })
            } else {
              findJunk(fullPath, depth + 1)
            }
          }
        }
      } catch { /* skip */ }
    }
    
    findJunk(rootPath)
    return junk
  })

  ipcMain.handle('cleanup:delete', (_e, paths: string[]) => {
    let count = 0
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          fs.rmSync(p, { recursive: true, force: true })
          count++
        }
      } catch (e) {
        console.error('Delete error:', e)
      }
    }
    return { success: true, count }
  })
}
