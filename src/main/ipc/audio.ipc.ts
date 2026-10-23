import { ipcMain } from 'electron'
import { buildAudioPool, validatePrefixAssignments, addAudioToLibrary, addInstrumentalAudioToLibrary, describeMode, poolInfo } from '../core/audioEngine'
import { get } from '../core/settingsManager'

export function registerAudioIPC(): void {
  ipcMain.handle('audio:getPool', () => {
    const titlesFolder = get('titles_folder') as string
    return buildAudioPool(titlesFolder)
  })

  ipcMain.handle('audio:validatePrefixes', () => {
    const titlesFolder = get('titles_folder') as string
    return validatePrefixAssignments(titlesFolder)
  })

  ipcMain.handle('audio:addToLibrary', (_e, srcPath: string) => {
    const titlesFolder = get('titles_folder') as string
    return addAudioToLibrary(srcPath, titlesFolder)
  })

  ipcMain.handle('audio:addInstrumentalToLibrary', (_e, srcPath: string) => {
    const titlesFolder = get('titles_folder') as string
    return addInstrumentalAudioToLibrary(srcPath, titlesFolder)
  })

  ipcMain.handle('audio:describeMode', () => {
    return describeMode()
  })

  ipcMain.handle('audio:poolInfo', () => {
    const titlesFolder = get('titles_folder') as string
    return poolInfo(titlesFolder)
  })
}

