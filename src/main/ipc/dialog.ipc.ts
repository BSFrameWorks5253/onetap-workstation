import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import fs from 'fs'
import { openInEcosystemExplorer } from '../core/ecosystemExplorer'

type WinGetter = () => BrowserWindow | null

export function registerDialogIPC(getWin: WinGetter): void {
  const resolveTargetWin = (e?: Electron.IpcMainInvokeEvent): BrowserWindow | undefined => {
    if (e?.sender) {
      const fromSender = BrowserWindow.fromWebContents(e.sender);
      if (fromSender && !fromSender.isDestroyed()) return fromSender;
    }
    const win = getWin();
    if (win && !win.isDestroyed()) return win;
    const focused = BrowserWindow.getFocusedWindow();
    return (focused && !focused.isDestroyed()) ? focused : undefined;
  };

  ipcMain.handle('dialog:openFolder', async (_e, options?: Electron.OpenDialogOptions) => {
    const win = resolveTargetWin(_e);
    if (win && !win.isDestroyed()) win.focus();
    const result = await dialog.showOpenDialog(win as any, {
      properties: ['openDirectory'],
      ...options
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openFolders', async (_e, options?: Electron.OpenDialogOptions) => {
    const win = resolveTargetWin(_e);
    if (win && !win.isDestroyed()) win.focus();
    const result = await dialog.showOpenDialog(win as any, {
      properties: ['openDirectory', 'multiSelections'],
      ...options
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dialog:openFile', async (_e, options?: Electron.OpenDialogOptions) => {
    const win = resolveTargetWin(_e);
    if (win && !win.isDestroyed()) win.focus();
    const result = await dialog.showOpenDialog(win as any, {
      properties: ['openFile'],
      ...options
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openFiles', async (_e, options?: Electron.OpenDialogOptions) => {
    const win = resolveTargetWin(_e);
    if (win && !win.isDestroyed()) win.focus();
    const result = await dialog.showOpenDialog(win as any, {
      properties: ['openFile', 'multiSelections'],
      ...options
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dialog:saveFile', async (_e, options?: Electron.SaveDialogOptions) => {
    const win = resolveTargetWin(_e);
    if (win && !win.isDestroyed()) win.focus();
    const result = await dialog.showSaveDialog(win as any, {
      ...options
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('dialog:writeTextFile', async (_e, params: { filePath: string; content: string }) => {
    try {
      await fs.promises.writeFile(params.filePath, params.content, 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('shell:openFolder', async (_e, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') return
    try {
      await openInEcosystemExplorer(folderPath.trim())
    } catch (e) {
      console.warn('[shell:openFolder] Error opening folder:', folderPath, e)
    }
  })

  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    if (!url || typeof url !== 'string') return
    try {
      let target = url.trim()
      if (!/^https?:\/\//i.test(target) && !/^file:\/\//i.test(target) && !/^mailto:/i.test(target)) {
        target = `https://${target}`
      }
      await shell.openExternal(target)
    } catch (e) {
      console.error('[shell:openExternal] Failed to open external URL:', url, e)
    }
  })
}
