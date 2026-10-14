import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'

interface FolderNode {
  name: string
  photographers?: string[]
  children?: FolderNode[]
}

interface Preset {
  name: string
  structure: FolderNode[]
}

function getPlatformConfigRoot(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
  }
  return process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config')
}

const PRESETS_FILE = path.join(
  getPlatformConfigRoot(),
  'OneTap',
  'presets.json'
)

function readPresets(): Preset[] {
  try {
    if (!fs.existsSync(PRESETS_FILE)) return []
    return JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf-8'))
  } catch { return [] }
}

function writePresets(presets: Preset[]): void {
  fs.mkdirSync(path.dirname(PRESETS_FILE), { recursive: true })
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2), 'utf-8')
}

function buildTree(base: string, nodes: FolderNode[]): void {
  for (const node of nodes) {
    const full = path.join(base, node.name)
    fs.mkdirSync(full, { recursive: true })
    
    // Create photographer subfolders if any
    if (node.photographers?.length) {
      for (const p of node.photographers) {
        fs.mkdirSync(path.join(full, p), { recursive: true })
      }
    }
    
    if (node.children?.length) buildTree(full, node.children)
  }
}

export function registerFolderMakerIPC(): void {
  ipcMain.handle('folderMaker:create', (_e, params: {
    rootPath: string
    structure: FolderNode[]
  }) => {
    try {
      buildTree(params.rootPath, params.structure)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('folderMaker:getPresets', () => readPresets())

  ipcMain.handle('folderMaker:savePreset', (_e, preset: Preset) => {
    const presets = readPresets().filter(p => p.name !== preset.name)
    presets.push(preset)
    writePresets(presets)
  })

  ipcMain.handle('folderMaker:deletePreset', (_e, name: string) => {
    writePresets(readPresets().filter(p => p.name !== name))
  })
}
