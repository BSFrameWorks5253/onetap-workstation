import { useState, useEffect } from 'react'

export interface CameramanFolderInfo {
  name: string
  path: string
  videoCount: number
  markerName?: string
  markerDescription?: string
  markerColor: { red: number; green: number; blue: number; name?: string }
}

export interface SubfolderItem {
  name: string
  path: string
  hasPrproj: boolean
  prprojPath: string
  isOutputFolder?: boolean
  videoCount?: number
  cameramanCount?: number
  cameramanFolders?: CameramanFolderInfo[]
}

export interface PrprojState {
  parentFolder: string
  mode: 'auto' | 'single' | 'master'
  detectedMode: 'single' | 'master'
  activeMode: 'single' | 'master'
  subfolders: SubfolderItem[]
  cameramanFolders: CameramanFolderInfo[]
  totalVideos: number
  targetPrprojName: string
  hasTargetPrproj: boolean
  excelFolder: string
  enableExcelReport: boolean
  showExcelModal: boolean
  generatedExcelPath: string | null
  overwriteExisting: boolean
  excludedPaths: string[]
  loadingScan: boolean
  templateInfo: { available: boolean; templatePath: string | null; isCustom: boolean } | null
  generating: boolean
  currentStep: 1 | 2 | 3 | 4
  isCompleted: boolean
  createdFiles: string[]
  progress: number
  logs: string[]
  search: string
  activeProgressStatus: string
}

const initialState: PrprojState = {
  parentFolder: '',
  mode: 'auto',
  detectedMode: 'single',
  activeMode: 'single',
  subfolders: [],
  cameramanFolders: [],
  totalVideos: 0,
  targetPrprojName: '',
  hasTargetPrproj: false,
  excelFolder: '',
  enableExcelReport: true,
  showExcelModal: false,
  generatedExcelPath: null,
  overwriteExisting: false,
  excludedPaths: [],
  loadingScan: false,
  templateInfo: null,
  generating: false,
  currentStep: 1,
  isCompleted: false,
  createdFiles: [],
  progress: 0,
  logs: [],
  search: '',
  activeProgressStatus: ''
}

class PrprojStoreManager {
  private state: PrprojState = { ...initialState }
  private listeners: Set<() => void> = new Set()

  public getState(): PrprojState {
    return this.state
  }

  public setState(partial: Partial<PrprojState> | ((prev: PrprojState) => Partial<PrprojState>)) {
    const nextPartial = typeof partial === 'function' ? partial(this.state) : partial
    this.state = { ...this.state, ...nextPartial }
    this.notify()
  }

  public appendLog(log: string | string[]) {
    const newLogs = Array.isArray(log) ? log : [log]
    this.state = {
      ...this.state,
      logs: [...this.state.logs, ...newLogs]
    }
    this.notify()
  }

  public resetLogs() {
    this.state = { ...this.state, logs: [] }
    this.notify()
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach(fn => fn())
  }
}

export const prprojStore = new PrprojStoreManager()

export function usePrprojStore(): [PrprojState, (partial: Partial<PrprojState> | ((prev: PrprojState) => Partial<PrprojState>)) => void] {
  const [state, setStateState] = useState<PrprojState>(prprojStore.getState())

  useEffect(() => {
    const unsub = prprojStore.subscribe(() => {
      setStateState(prprojStore.getState())
    })
    return unsub
  }, [])

  const setStoreState = (partial: Partial<PrprojState> | ((prev: PrprojState) => Partial<PrprojState>)) => {
    prprojStore.setState(partial)
  }

  return [state, setStoreState]
}
