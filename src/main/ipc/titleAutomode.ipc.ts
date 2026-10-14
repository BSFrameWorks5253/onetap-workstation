import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { get, setAndSave } from '../core/settingsManager'

export interface TitleAutomodeSettings {
  autoStartOnEncoderSignal: boolean
  alwaysKeepOgAudioKeywords: string[]
  predefinedVideoMutes: Record<string, boolean>
  predefinedAudioTracks: Record<string, string>
  predefinedTitleImages: Record<string, string>
  predefinedRenames: Record<string, string>
  expectedVideos: string[]
}

export const DEFAULT_AUTOMODE_SETTINGS: TitleAutomodeSettings = {
  autoStartOnEncoderSignal: true,
  alwaysKeepOgAudioKeywords: ['WAAZ', 'ID', 'SPEECH', 'BAYAAN'],
  predefinedVideoMutes: {},
  predefinedAudioTracks: {},
  predefinedTitleImages: {},
  predefinedRenames: {},
  expectedVideos: []
}

export function registerTitleAutomodeIPC(): void {
  ipcMain.handle('titleAutomode:scanVideos', async (_event, dvdPath: string) => {
    try {
      if (!dvdPath || !fs.existsSync(dvdPath)) return []
      const files = fs.readdirSync(dvdPath)
      return files.filter(f => {
        const ext = path.extname(f).toLowerCase()
        return ext === '.mp4' || ext === '.mov' || ext === '.mkv' || ext === '.avi'
      })
    } catch (e) {
      console.error('[TitleAutomode] Error scanning videos:', e)
      return []
    }
  })

  ipcMain.handle('titleAutomode:getSettings', async () => {
    try {
      const stored = (get('title_automode_settings') as Partial<TitleAutomodeSettings>) || {}
      return {
        ...DEFAULT_AUTOMODE_SETTINGS,
        ...stored
      }
    } catch (e) {
      console.error('[TitleAutomode] Error getting settings:', e)
      return DEFAULT_AUTOMODE_SETTINGS
    }
  })

  ipcMain.handle('titleAutomode:saveSettings', async (_event, settings: Partial<TitleAutomodeSettings>) => {
    try {
      const current = (get('title_automode_settings') as Partial<TitleAutomodeSettings>) || {}
      const merged: TitleAutomodeSettings = {
        ...DEFAULT_AUTOMODE_SETTINGS,
        ...current,
        ...settings
      }
      setAndSave('title_automode_settings', merged)
      return merged
    } catch (e) {
      console.error('[TitleAutomode] Error saving settings:', e)
      return DEFAULT_AUTOMODE_SETTINGS
    }
  })
}
