import { CursorMetadata, CursorType } from './cursorTypes'

import defaultSvg from '@/assets/cursors/cursor-default.svg'
import hoverSvg from '@/assets/cursors/cursor-hover.svg'
import clickSvg from '@/assets/cursors/cursor-click.svg'
import busySvg from '@/assets/cursors/cursor-busy.svg'
import addSvg from '@/assets/cursors/cursor-add.svg'
import subtractSvg from '@/assets/cursors/cursor-subtract.svg'
import notAllowedSvg from '@/assets/cursors/cursor-not-allowed.svg'
import textSvg from '@/assets/cursors/cursor-text.svg'
import handSvg from '@/assets/cursors/cursor-hand.svg'
import resizeDiagonalSvg from '@/assets/cursors/cursor-resize-diagonal.svg'
import resizeHorizontalSvg from '@/assets/cursors/cursor-resize-horizontal.svg'
import resizeVerticalSvg from '@/assets/cursors/cursor-resize-vertical.svg'
import helpSvg from '@/assets/cursors/cursor-help.svg'
import waitSvg from '@/assets/cursors/cursor-wait.svg'
import moveSvg from '@/assets/cursors/cursor-move.svg'
import precisionSvg from '@/assets/cursors/cursor-precision.svg'
import linkSvg from '@/assets/cursors/cursor-link.svg'
import dragSvg from '@/assets/cursors/cursor-drag.svg'

export interface CursorAssetEntry {
  id: CursorType
  label: string
  description: string
  svgUrl: string
  hotspot: { x: number; y: number }
  fallback: string
}

export const CURSOR_REGISTRY: Record<CursorType, CursorAssetEntry> = {
  default: {
    id: 'default',
    label: 'Normal / Default',
    description: 'macOS authentic black pointer arrow with crisp white outline and drop shadow',
    svgUrl: defaultSvg,
    hotspot: { x: 1, y: 1 },
    fallback: 'default'
  },
  hover: {
    id: 'hover',
    label: 'Hover / Link',
    description: 'macOS & Adobe Acrobat pointing hand cursor with extended index finger',
    svgUrl: hoverSvg,
    hotspot: { x: 4, y: 1 },
    fallback: 'pointer'
  },
  click: {
    id: 'click',
    label: 'Click',
    description: 'macOS pointing hand active click state',
    svgUrl: clickSvg,
    hotspot: { x: 4, y: 2 },
    fallback: 'pointer'
  },
  busy: {
    id: 'busy',
    label: 'Busy',
    description: 'macOS rainbow spinning beachball busy wait indicator',
    svgUrl: busySvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'progress'
  },
  add: {
    id: 'add',
    label: 'Add',
    description: 'macOS pointer arrow with green plus (+) badge',
    svgUrl: addSvg,
    hotspot: { x: 1, y: 1 },
    fallback: 'copy'
  },
  subtract: {
    id: 'subtract',
    label: 'Subtract',
    description: 'macOS pointer arrow with red minus (-) badge',
    svgUrl: subtractSvg,
    hotspot: { x: 1, y: 1 },
    fallback: 'not-allowed'
  },
  'not-allowed': {
    id: 'not-allowed',
    label: 'Not Allowed',
    description: 'macOS forbidden / no entry slash symbol',
    svgUrl: notAllowedSvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'not-allowed'
  },
  text: {
    id: 'text',
    label: 'Text',
    description: 'macOS high-contrast text I-beam with optical serifs',
    svgUrl: textSvg,
    hotspot: { x: 6, y: 7 },
    fallback: 'text'
  },
  hand: {
    id: 'hand',
    label: 'Hand',
    description: 'Adobe Acrobat open palm Hand Tool for panning and grabbing',
    svgUrl: handSvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'grab'
  },
  'resize-diagonal': {
    id: 'resize-diagonal',
    label: 'Resize Diagonal',
    description: 'macOS double-headed diagonal resize arrow',
    svgUrl: resizeDiagonalSvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'nwse-resize'
  },
  'resize-horizontal': {
    id: 'resize-horizontal',
    label: 'Resize Horizontal',
    description: 'macOS double-headed horizontal resize arrow',
    svgUrl: resizeHorizontalSvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'ew-resize'
  },
  'resize-vertical': {
    id: 'resize-vertical',
    label: 'Resize Vertical',
    description: 'macOS double-headed vertical resize arrow',
    svgUrl: resizeVerticalSvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'ns-resize'
  },
  help: {
    id: 'help',
    label: 'Help',
    description: 'macOS pointer arrow with blue question mark (?) badge',
    svgUrl: helpSvg,
    hotspot: { x: 1, y: 1 },
    fallback: 'help'
  },
  wait: {
    id: 'wait',
    label: 'Wait',
    description: 'macOS rainbow beachball wait cursor',
    svgUrl: waitSvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'wait'
  },
  move: {
    id: 'move',
    label: 'Move',
    description: 'Adobe Acrobat 4-direction move cursor',
    svgUrl: moveSvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'move'
  },
  precision: {
    id: 'precision',
    label: 'Precision',
    description: 'macOS high-precision crosshair reticle cursor',
    svgUrl: precisionSvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'crosshair'
  },
  link: {
    id: 'link',
    label: 'Link',
    description: 'macOS / Adobe Acrobat link pointing hand',
    svgUrl: linkSvg,
    hotspot: { x: 4, y: 1 },
    fallback: 'pointer'
  },
  drag: {
    id: 'drag',
    label: 'Drag',
    description: 'Adobe Acrobat closed fist Hand Tool for active drag/pan',
    svgUrl: dragSvg,
    hotspot: { x: 7, y: 7 },
    fallback: 'grabbing'
  }
}

export function getCursorCssValue(type: CursorType): string {
  const entry = CURSOR_REGISTRY[type]
  if (!entry) return 'default'
  return `url("${entry.svgUrl}") ${entry.hotspot.x} ${entry.hotspot.y}, ${entry.fallback}`
}
