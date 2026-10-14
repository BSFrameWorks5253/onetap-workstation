import { useState, useEffect } from 'react'

export interface TitleAdderState {
  mode: 'batch' | 'single'
  codeParsingLogic: 'prefix' | 'suffix' | 'serial' | 'embedded' | 'auto'
  batchSource: string
  batchSource2?: string
  batchSources: string[]
  outputFolder: string
  videoFiles: string[]
  availableVideos: string[]
  mutedVideos: string[]
  watermarkedVideos: string[]
  duration: string
  muteOriginal: boolean
  addWatermarkGlobal: boolean
  addToStats: boolean
  running: boolean
  cancelled: boolean
  progress: number
  status: string
  total: number
  done: number
  fps: string
  speed: string
  eta: string
  logs: Array<{ text: string; type?: string }>
  userAudioSelections: Record<string, string>
  userTitleImageSelections: Record<string, string>
  userMuteSelections: Record<string, boolean>
  lastReceivedPayload: any
  hasReceivedExtensionPath: boolean
  expectedVideos: string[]
  autoStartOnEncoderSignal: boolean
  alwaysKeepOgAudioKeywords: string[]
  predefinedVideoMutes: Record<string, boolean>
  predefinedAudioTracks: Record<string, string>
  predefinedTitleImages: Record<string, string>
  predefinedRenames: Record<string, string>
}

function isGroupPhotoVideo(filenameOrPath: any): boolean {
  if (!filenameOrPath || typeof filenameOrPath !== 'string') return false
  const base = filenameOrPath.split(/[\\/]/).pop() || ''
  const stem = base.replace(/\.(tmp|temp)$/i, '').replace(/\.[^/.]+$/, '').trim()
  const isGroupPhoto = /(?:^|[\s_.-])group[_\s-]?photo(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(stem)
  const isGPn = /(?:^|[\s_.-])gp(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(stem)
  return isGroupPhoto || isGPn
}

function safeGet(key: string, defaultVal = ''): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return defaultVal
  try {
    return localStorage.getItem(key) ?? defaultVal
  } catch {
    return defaultVal
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {}
}

const defaultSourcesStr = safeGet('ot_ta_batch_sources', '')
let initialSources: string[] = []
try {
  if (defaultSourcesStr) {
    const parsed = JSON.parse(defaultSourcesStr)
    if (Array.isArray(parsed)) initialSources = parsed.filter(Boolean)
  }
} catch {}
if (initialSources.length === 0) {
  const s1 = safeGet('ot_ta_batch_source', '')
  const s2 = safeGet('ot_ta_batch_source_2', '')
  if (s1) initialSources.push(s1)
  if (s2) initialSources.push(s2)
}

const initialState: TitleAdderState = {
  mode: 'batch',
  codeParsingLogic: (safeGet('ot_ta_code_logic', 'prefix') as any),
  batchSources: initialSources,
  batchSource: initialSources[0] || safeGet('ot_ta_batch_source', ''),
  batchSource2: initialSources[1] || safeGet('ot_ta_batch_source_2', ''),
  outputFolder: safeGet('ot_ta_output_folder', ''),
  videoFiles: JSON.parse(safeGet('ot_ta_video_files', '[]')),
  availableVideos: JSON.parse(safeGet('ot_ta_available_videos', '[]')),
  mutedVideos: JSON.parse(safeGet('ot_ta_muted_videos', '[]')),
  watermarkedVideos: JSON.parse(safeGet('ot_ta_watermarked_videos', '[]')),
  duration: safeGet('ot_ta_duration', '3'),
  muteOriginal: true,
  addWatermarkGlobal: true,
  addToStats: true,
  running: false,
  cancelled: false,
  progress: 0,
  status: '',
  total: 0,
  done: 0,
  fps: '',
  speed: '',
  eta: '',
  logs: [],
  userAudioSelections: JSON.parse(safeGet('ot_ta_user_audio_selections', '{}')),
  userTitleImageSelections: JSON.parse(safeGet('ot_ta_user_image_selections', '{}')),
  userMuteSelections: JSON.parse(safeGet('ot_ta_user_mute_selections', '{}')),
  lastReceivedPayload: null,
  hasReceivedExtensionPath: false,
  expectedVideos: JSON.parse(safeGet('ot_ta_expected_videos', '[]')),
  autoStartOnEncoderSignal: safeGet('ot_ta_auto_start_ame', 'true') === 'true',
  alwaysKeepOgAudioKeywords: JSON.parse(safeGet('ot_ta_og_keywords', '["WAAZ", "ID", "SPEECH", "BAYAAN"]')),
  predefinedVideoMutes: JSON.parse(safeGet('ot_ta_predefined_mutes', '{}')),
  predefinedAudioTracks: JSON.parse(safeGet('ot_ta_predefined_audio', '{}')),
  predefinedTitleImages: JSON.parse(safeGet('ot_ta_predefined_images', '{}')),
  predefinedRenames: JSON.parse(safeGet('ot_ta_predefined_renames', '{}'))
}

class TitleAdderStoreManager {
  private state: TitleAdderState = { ...initialState }
  private listeners: Set<() => void> = new Set()
  private isInitialized = false

  constructor() {
    this.initGlobalListeners()
  }

  private initGlobalListeners() {
    if (typeof window === 'undefined') return
    const api = (window as any).api
    if (!api || !api.titleAdder) return
    if (this.isInitialized) return
    this.isInitialized = true

    // Load persisted Title Automode / Predefine settings
    if (api.titleAutomode?.getSettings) {
      api.titleAutomode.getSettings().then((s: any) => {
        if (s && typeof s === 'object') {
          this.setState({
            autoStartOnEncoderSignal: s.autoStartOnEncoderSignal !== undefined ? Boolean(s.autoStartOnEncoderSignal) : this.state.autoStartOnEncoderSignal,
            alwaysKeepOgAudioKeywords: Array.isArray(s.alwaysKeepOgAudioKeywords) ? s.alwaysKeepOgAudioKeywords : this.state.alwaysKeepOgAudioKeywords,
            predefinedVideoMutes: s.predefinedVideoMutes || this.state.predefinedVideoMutes,
            predefinedAudioTracks: s.predefinedAudioTracks || this.state.predefinedAudioTracks,
            predefinedTitleImages: s.predefinedTitleImages || this.state.predefinedTitleImages,
            predefinedRenames: s.predefinedRenames || this.state.predefinedRenames
          })
        }
      }).catch(() => {})
    }

    // Global listener for paths received from Premiere Pro extension
    api.titleAdder.onSetBatchSource?.((rawPayload: string) => {
      let path = ''
      let muteExceptions: string[] = []
      let expectedVideos: string[] = []
      let muteOriginalVal = true
      let payload: any = null

      try {
        payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
        if (payload && typeof payload === 'object') {
          path = payload.path ? String(payload.path).trim().replace(/^["']|["']$/g, '') : ''
          muteExceptions = Array.isArray(payload.muteExceptions) ? payload.muteExceptions : []
          if (Array.isArray(payload.expectedVideos)) {
            expectedVideos = payload.expectedVideos.filter((v: string) => !isGroupPhotoVideo(v))
          }
          if (payload.muteOriginal !== undefined) muteOriginalVal = Boolean(payload.muteOriginal)
        } else {
          path = String(rawPayload || '').trim().replace(/^["']|["']$/g, '')
        }
      } catch {
        path = String(rawPayload || '').trim().replace(/^["']|["']$/g, '')
      }

      if (path) {
        this.setState({
          mode: 'batch',
          batchSource: path,
          muteOriginal: muteOriginalVal,
          expectedVideos: expectedVideos.length > 0 ? expectedVideos : this.state.expectedVideos,
          lastReceivedPayload: payload || { path },
          hasReceivedExtensionPath: true
        })

        localStorage.setItem('ot_ta_batch_source', path)
        if (api.settings?.setAndSave) {
          api.settings.setAndSave('last_source_adder', path)
        } else if (api.settings?.set) {
          api.settings.set('last_source_adder', path)
        }

        // Auto-scan videos immediately so availableVideos & mutedVideos are populated in store
        if (api.titleAdder?.listVideos) {
          api.titleAdder.listVideos(path).then((rawList: string[]) => {
            let list = (rawList || []).filter((f: string) => !isGroupPhotoVideo(f))
            if (expectedVideos && expectedVideos.length > 0) {
              const expSet = new Set(expectedVideos.map((e: string) => {
                const b = e.split(/[\\/]/).pop() || ''
                return b.replace(/\.(tmp|temp)$/i, '').replace(/\.[^/.]+$/, '').trim().toLowerCase()
              }))
              const filtered = list.filter((f: string) => {
                const b = f.split(/[\\/]/).pop() || ''
                const s = b.replace(/\.(tmp|temp)$/i, '').replace(/\.[^/.]+$/, '').trim().toLowerCase()
                return expSet.has(s)
              })
              if (filtered.length > 0) {
                list = filtered
              }
            }
            let muted = list
            if (muteOriginalVal) {
              const exceptionsSet = new Set(muteExceptions.map((e: string) => {
                const lower = e.toLowerCase()
                const lastDot = lower.lastIndexOf('.')
                return lastDot > 0 ? lower.substring(0, lastDot) : lower
              }))
              muted = list.filter((f: string) => {
                const lowerF = f.toLowerCase()
                const dotIdx = lowerF.lastIndexOf('.')
                const stemF = dotIdx > 0 ? lowerF.substring(0, dotIdx) : lowerF
                return !exceptionsSet.has(lowerF) && !exceptionsSet.has(stemF)
              })
            } else {
              muted = []
            }
            this.setState({
              availableVideos: list,
              mutedVideos: muted,
              watermarkedVideos: list
            })
          }).catch((err: any) => console.error('[titleAdderStore] Error auto-scanning batchSource:', err))
        }
      }
    })

    // Listen for Title Automode triggered from Media Encoder
    if (api.titleAutomode?.onTriggered) {
      api.titleAutomode.onTriggered((data: any) => {
        const p = data?.dvdPath ? String(data.dvdPath).trim().replace(/^["']|["']$/g, '') : ''
        if (p) {
          this.setState({
            mode: 'batch',
            batchSource: p,
            hasReceivedExtensionPath: true
          })
          localStorage.setItem('ot_ta_batch_source', p)
        }
      })
    }
  }

  public getState(): TitleAdderState {
    return this.state
  }

  public setState(partial: Partial<TitleAdderState> | ((prev: TitleAdderState) => Partial<TitleAdderState>)) {
    const nextPartial = typeof partial === 'function' ? partial(this.state) : partial
    this.state = { ...this.state, ...nextPartial }

    // Persist critical path fields to localStorage
    if (nextPartial.batchSource !== undefined) {
      safeSet('ot_ta_batch_source', this.state.batchSource)
    }
    if (nextPartial.outputFolder !== undefined) {
      safeSet('ot_ta_output_folder', this.state.outputFolder)
    }
    if (nextPartial.videoFiles !== undefined) {
      safeSet('ot_ta_video_files', JSON.stringify(this.state.videoFiles))
    }
    if (nextPartial.availableVideos !== undefined) {
      safeSet('ot_ta_available_videos', JSON.stringify(this.state.availableVideos))
    }
    if (nextPartial.mutedVideos !== undefined) {
      safeSet('ot_ta_muted_videos', JSON.stringify(this.state.mutedVideos))
    }
    if (nextPartial.watermarkedVideos !== undefined) {
      safeSet('ot_ta_watermarked_videos', JSON.stringify(this.state.watermarkedVideos))
    }
    if (nextPartial.userAudioSelections !== undefined) {
      safeSet('ot_ta_user_audio_selections', JSON.stringify(this.state.userAudioSelections))
    }
    if (nextPartial.duration !== undefined) {
      safeSet('ot_ta_duration', this.state.duration)
    }
    if (nextPartial.autoStartOnEncoderSignal !== undefined) {
      safeSet('ot_ta_auto_start_ame', String(this.state.autoStartOnEncoderSignal))
    }
    if (nextPartial.alwaysKeepOgAudioKeywords !== undefined) {
      safeSet('ot_ta_og_keywords', JSON.stringify(this.state.alwaysKeepOgAudioKeywords))
    }
    if (nextPartial.predefinedVideoMutes !== undefined) {
      safeSet('ot_ta_predefined_mutes', JSON.stringify(this.state.predefinedVideoMutes))
    }
    if (nextPartial.predefinedAudioTracks !== undefined) {
      safeSet('ot_ta_predefined_audio', JSON.stringify(this.state.predefinedAudioTracks))
    }
    if (nextPartial.predefinedTitleImages !== undefined) {
      safeSet('ot_ta_predefined_images', JSON.stringify(this.state.predefinedTitleImages))
    }
    if (nextPartial.predefinedRenames !== undefined) {
      safeSet('ot_ta_predefined_renames', JSON.stringify(this.state.predefinedRenames))
    }
    if (nextPartial.expectedVideos !== undefined) {
      safeSet('ot_ta_expected_videos', JSON.stringify(this.state.expectedVideos))
    }

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

export const titleAdderStore = new TitleAdderStoreManager()

export function useTitleAdderStore(): [TitleAdderState, (partial: Partial<TitleAdderState> | ((prev: TitleAdderState) => Partial<TitleAdderState>)) => void] {
  const [state, setStateState] = useState<TitleAdderState>(titleAdderStore.getState())

  useEffect(() => {
    const unsub = titleAdderStore.subscribe(() => {
      setStateState(titleAdderStore.getState())
    })
    return unsub
  }, [])

  const setStoreState = (partial: Partial<TitleAdderState> | ((prev: TitleAdderState) => Partial<TitleAdderState>)) => {
    titleAdderStore.setState(partial)
  }

  return [state, setStoreState]
}
