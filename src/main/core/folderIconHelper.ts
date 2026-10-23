import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { app } from 'electron'

/**
 * Applies a custom folder icon in Windows File Explorer by writing desktop.ini
 * and setting folder ReadOnly attribute (attrib +r).
 * Similar to how Adobe apps customize their program & output folder icons.
 */
export function applyFolderIcon(folderPath: string, customIconPath?: string): boolean {
  if (process.platform !== 'win32') return false
  if (!folderPath || !fs.existsSync(folderPath)) return false

  try {
    // Resolve icon path fallback
    let iconPath = customIconPath
    if (!iconPath || !fs.existsSync(iconPath)) {
      // Check resources/icon.ico
      const defaultIcon = path.join(app.getAppPath(), 'resources', 'icon.ico')
      const prodIcon = path.join(process.resourcesPath, 'icon.ico')
      if (fs.existsSync(defaultIcon)) {
        iconPath = defaultIcon
      } else if (fs.existsSync(prodIcon)) {
        iconPath = prodIcon
      } else {
        return false
      }
    }

    const iniPath = path.join(folderPath, 'desktop.ini')
    const iniContent = `[.ShellClassInfo]\r\nIconResource=${iconPath},0\r\n[ViewState]\r\nMode=\r\nVid=\r\nFolderType=Generic\r\n`

    // Remove existing hidden/system attributes on desktop.ini if it exists
    if (fs.existsSync(iniPath)) {
      try {
        exec(`attrib -h -s "${iniPath}"`, { windowsHide: true })
      } catch {}
    }

    fs.writeFileSync(iniPath, iniContent, 'utf-8')

    // Set desktop.ini to hidden + system, and folder to read-only (which tells Windows Explorer to read desktop.ini)
    exec(`attrib +h +s "${iniPath}" & attrib +r "${folderPath}"`, { windowsHide: true }, (err) => {
      if (err) {
        console.error('[FolderIcon] Failed to set attrib on folder:', err)
      }
    })

    return true
  } catch (err) {
    console.error('[FolderIcon] Error applying folder icon:', err)
    return false
  }
}
