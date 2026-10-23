export type CursorType =
  | 'default'
  | 'hover'
  | 'click'
  | 'busy'
  | 'add'
  | 'subtract'
  | 'not-allowed'
  | 'text'
  | 'hand'
  | 'resize-diagonal'
  | 'resize-horizontal'
  | 'resize-vertical'
  | 'help'
  | 'wait'
  | 'move'
  | 'precision'
  | 'link'
  | 'drag'

export interface CursorHotspot {
  x: number
  y: number
}

export interface CursorMetadata {
  id: CursorType
  label: string
  description: string
  hotspot: CursorHotspot
  fallback: string
}

export interface CursorContextValue {
  currentCursor: CursorType
  setCursor: (type: CursorType) => void
  resetCursor: () => void
  isCustomCursorEnabled: boolean
  setCustomCursorEnabled: (enabled: boolean) => void
  toggleCustomCursor: () => void
  isShowcaseOpen: boolean
  openShowcase: () => void
  closeShowcase: () => void
}
