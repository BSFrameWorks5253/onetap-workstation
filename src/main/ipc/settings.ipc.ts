import { ipcMain, shell } from 'electron'
import https from 'https'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'
import {
  get, set, setAndSave, getAll, needsSetup, completeSetup,
  changeSettingsFolder, setSettingsFilePath, getSettingsFilePath, getSettingsFolder,
  resetSection, resetAll, isConfirmationDisabled, disableConfirmation
} from '../core/settingsManager'
import { startWatcher } from '../core/folderWatcher'
import { generateExcelReport } from '../core/excelExporter'

export function registerSettingsIPC(): void {
  ipcMain.handle('settings:get', (_e, key: string, def?: unknown) => get(key, def))
  ipcMain.handle('settings:set', (_e, key: string, value: unknown) => { set(key, value) })
  ipcMain.handle('settings:setAndSave', (_e, key: string, value: unknown) => {
    const result = setAndSave(key, value)
    if (key === 'watcher_enabled' || key === 'watcher_input_folder' || key === 'converter_jpeg') {
      try {
        startWatcher()
      } catch (err) {
        console.error('[Settings] Watcher update failed:', err)
      }
    }
    return result
  })
  ipcMain.handle('settings:getAll', () => getAll())
  ipcMain.handle('settings:needsSetup', () => needsSetup())
  ipcMain.handle('settings:completeSetup', (_e, folder: string) => completeSetup(folder))
  ipcMain.handle('settings:changeFolder', (_e, folder: string) => changeSettingsFolder(folder))
  ipcMain.handle('settings:setFilePath', (_e, filePath: string) => setSettingsFilePath(filePath))
  ipcMain.handle('settings:filePath', () => getSettingsFilePath())
  ipcMain.handle('settings:folder', () => getSettingsFolder())
  ipcMain.handle('settings:resetSection', (_e, keys: string[]) => resetSection(keys))
  ipcMain.handle('settings:resetAll', () => resetAll())
  ipcMain.handle('settings:isConfirmDisabled', (_e, id: string) => isConfirmationDisabled(id))
  ipcMain.handle('settings:disableConfirm', (_e, id: string) => disableConfirmation(id))
  ipcMain.handle('settings:openExcel', async () => {
    // 1. Try to open from final title folder (last_output_adder)
    const lastOutputAdder = (get('last_output_adder') as string) || ''
    let xlsxPath = ''
    if (lastOutputAdder && fs.existsSync(lastOutputAdder)) {
      xlsxPath = path.join(lastOutputAdder, 'One_Tap_Stats.xlsx')
    }
    
    // 2. If it doesn't exist there, fall back to the settings folder copy
    if (!xlsxPath || !fs.existsSync(xlsxPath)) {
      const folder = getSettingsFolder()
      xlsxPath = path.join(folder, 'One_Tap_Stats.xlsx')
    }

    if (fs.existsSync(xlsxPath)) {
      try {
        await shell.openPath(xlsxPath)
        return { success: true }
      } catch (err) {
        console.error('[Settings] Failed to open Excel path:', err)
        return { success: false, error: 'Could not open the Excel file. Make sure you have Microsoft Excel or another spreadsheet viewer installed.' }
      }
    } else {
      return { success: false, error: 'Excel file does not exist yet. Please run some renders first.' }
    }
  })

  ipcMain.handle('settings:generateExcel', async (_e, records: any[], targetFilePath: string) => {
    try {
      generateExcelReport(records, targetFilePath)
      return { success: true }
    } catch (err: any) {
      console.error('[Settings] Failed to generate Excel:', err)
      return { success: false, error: err.message || String(err) }
    }
  })


  // Route grievances securely via the main process to completely bypass CORS / fetch blocks
  ipcMain.handle('settings:submitGrievance', async (_e, targetUrl: string, grievanceData: object) => {
    return new Promise((resolve, reject) => {
      function makeRequest(currentUrl: string) {
        console.log(`[Grievance] Sending post request to: ${currentUrl}`)
        const parsedUrl = new URL(currentUrl)
        const client = parsedUrl.protocol === 'https:' ? https : require('http')
        
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          }
        }
        
        const req = client.request(currentUrl, options, (res) => {
          // Follow HTTP 302/301 redirects dynamically
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let redirectUrl = res.headers.location
            if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
              redirectUrl = new URL(redirectUrl, currentUrl).toString()
            }
            console.log(`[Grievance] Following redirect: ${redirectUrl}`)
            makeRequest(redirectUrl)
          } else {
            let body = ''
            res.on('data', chunk => body += chunk)
            res.on('end', () => {
              try {
                resolve(JSON.parse(body))
              } catch (e) {
                resolve({ status: 'success', data: body }) // fallback for raw responses
              }
            })
          }
        })
        
        req.on('error', (err) => {
          console.error('[Grievance] Post request failed:', err)
          reject(err)
        })
        req.write(JSON.stringify(grievanceData))
        req.end()
      }
      
      makeRequest(targetUrl)
    })
  })
}
