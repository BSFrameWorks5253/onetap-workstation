import { shell } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

/**
 * Checks whether Anything File Manager (AFM) is currently installed on this Windows PC.
 * Strictly checks genuine installation locations (AppData/Local/Programs, Program Files, or Anything installed-apps).
 * Does NOT check development workspaces or unpacked build artifacts.
 */
export function getInstalledAfmPath(): string | null {
  try {
    const localAppData = process.env.LOCALAPPDATA || ''
    const appData = process.env.APPDATA || ''
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'

    const candidateInstallPaths = [
      path.join(localAppData, 'Programs', 'Anything File Manager', 'Anything File Manager.exe'),
      path.join(appData, 'Anything', 'installed-apps', 'anything-file-manager', 'Anything File Manager.exe'),
      path.join(programFiles, 'Anything File Manager', 'Anything File Manager.exe'),
      path.join(programFilesX86, 'Anything File Manager', 'Anything File Manager.exe')
    ]

    for (const p of candidateInstallPaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }
  } catch (err) {
    console.warn('[EcosystemExplorer] Error detecting installed AFM:', err)
  }
  return null
}

/**
 * Universal Ecosystem Explorer Bridge
 * - If Anything File Manager is installed: Opens target folder/file in AFM.
 * - Otherwise: Opens directly in the default Windows File Explorer.
 */
export async function openInEcosystemExplorer(folderOrFilePath: string): Promise<boolean> {
  if (!folderOrFilePath) return false
  const target = folderOrFilePath.trim()

  // 1. If AFM is genuinely installed, delegate to AFM
  const installedAfm = getInstalledAfmPath()
  if (installedAfm) {
    try {
      const child = spawn(installedAfm, [target], { detached: true, stdio: 'ignore' })
      child.unref()
      return true
    } catch (e) {
      console.warn('[EcosystemExplorer] AFM launch failed, falling back to default Windows Explorer:', e)
    }
  }

  // 2. Otherwise: Open in Default Windows Explorer
  try {
    let stat: fs.Stats | null = null
    try {
      stat = fs.statSync(target)
    } catch {}
    if (stat && stat.isFile()) {
      shell.showItemInFolder(target)
      return true
    }
    const res = await shell.openPath(target)
    return !res
  } catch {
    return false
  }
}
