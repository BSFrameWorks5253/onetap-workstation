import React, { useState, useEffect, useRef, useMemo } from 'react'
import { PAGE_META } from '../../types'
import { Card, CardHeader } from '../../components/Card'
import { Button, DangerButton, GhostButton } from '../../components/Button'
import { BrowseRow, Input } from '../../components/Input'
import LogBox, { useLogLines } from '../../components/LogBox'
import { StatusChip } from '../../components/StatCard'
import './TitleAdder.css'

import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import confetti from 'canvas-confetti'
import { useTitleAdderStore, titleAdderStore } from '../../stores/titleAdderStore'
import { getPrefixColorTheme } from '../../utils/safarUtils'

interface CustomAudioSelectProps {
  value: string
  options: Array<{ name: string; path: string }>
  defaultPath?: string
  defaultName?: string
  onChange: (path: string) => void
}

export function stripDvdFolderFromPath(folderPath: any): string {
  if (!folderPath) return ''
  let str = String(folderPath).trim()
  str = str.replace(/^["']|["']$/g, '').trim()
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const obj = JSON.parse(str)
      if (obj && typeof obj.path === 'string') {
        return stripDvdFolderFromPath(obj.path)
      }
    } catch {}
  }
  const norm = str.replace(/[\\/]+$/, '')
  if (/[\\/]dvd$/i.test(norm)) {
    return norm.replace(/[\\/]dvd$/i, '')
  }
  return norm
}

export function extractDateFolderFromSource(sourcePath: string): string {
  if (!sourcePath) return ''
  const clean = stripDvdFolderFromPath(sourcePath)
  const base = clean.split(/[\\/]/).filter(Boolean).pop() || ''
  return base
}

export function isGroupPhotoVideo(filenameOrPath: any): boolean {
  if (!filenameOrPath) return false
  const str = String(filenameOrPath).trim()
  const base = str.split(/[\\/]/).pop() || ''
  const stem = base
    .replace(/\.(tmp|temp)$/i, '')
    .replace(/\.[^/.]+$/, '')
    .trim()
  // Matches "Group_Photo_1", "Group_Photo_2", "Group Photo 1", "Group-Photo-1", "GroupPhoto1", "Group_Photo", etc.
  // OR "GPn" where n can be any number: e.g. "GP1", "GP2", "GP01", "GP-1", "GP_1", "GP 1", etc.
  const isGroupPhoto = /(?:^|[\s_.-])group[_\s-]?photo(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(stem)
  const isGPn = /(?:^|[\s_.-])gp(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(stem)
  return isGroupPhoto || isGPn
}

function CustomAudioSelect({ value, options, defaultPath, defaultName, onChange }: CustomAudioSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const allOpts = useMemo(() => {
    const list = [...(options || [])]
    if (defaultPath && !list.some(a => a.path === defaultPath)) {
      list.unshift({ path: defaultPath, name: `${defaultName || 'Default'} (Default)` })
    }
    return list
  }, [options, defaultPath, defaultName])

  const filteredOpts = useMemo(() => {
    if (!searchTerm.trim()) return allOpts
    const q = searchTerm.toLowerCase().trim()
    return allOpts.filter(o => (o.name || '').toLowerCase().includes(q) || (o.path || '').toLowerCase().includes(q))
  }, [allOpts, searchTerm])

  const currentObj = allOpts.find(o => o.path === value)
  const currentLabel = currentObj ? currentObj.name : (value || 'Select Audio Track...')

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="ta-custom-select-wrap" ref={containerRef}>
      <button
        type="button"
        className={`ta-custom-select-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className="ta-custom-select-label" title={currentLabel}>
          <span style={{ fontSize: '12px' }}>🎵</span>
          <span className="truncate" style={{ flex: 1, textAlign: 'left' }}>{currentLabel}</span>
        </span>
        <span className={`ta-custom-select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="ta-custom-select-dropdown align-right anim-scale-in">
          {/* Search box inside dropdown */}
          <div className="ta-custom-select-search-box">
            <input
              ref={searchInputRef}
              type="text"
              className="ta-custom-select-search-input"
              placeholder="🔍 Search audio tracks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {searchTerm && (
              <button
                type="button"
                className="ta-custom-select-search-clear"
                onClick={(e) => {
                  e.stopPropagation()
                  setSearchTerm('')
                  searchInputRef.current?.focus()
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="ta-custom-select-list">
            {filteredOpts.length > 0 ? (
              filteredOpts.map(opt => {
                const isSelected = opt.path === value
                return (
                  <div
                    key={opt.path}
                    className={`ta-custom-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(opt.path)
                      setIsOpen(false)
                    }}
                  >
                    <span style={{ fontSize: '12px', opacity: isSelected ? 1 : 0.5 }}>{isSelected ? '✓' : '🎵'}</span>
                    <span className="truncate" style={{ flex: 1 }}>{opt.name}</span>
                  </div>
                )
              })
            ) : (
              <div className="ta-custom-select-empty">
                <span>🎵</span>
                <span>No matching audio tracks</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface CustomImageSelectProps {
  value: string
  options: Array<{ name: string; path: string }>
  defaultPath?: string
  defaultName?: string
  onChange: (path: string) => void
  onResetDefault: () => void
}

function CustomImageSelect({ value, options, defaultPath, defaultName, onChange, onResetDefault }: CustomImageSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const allOpts = useMemo(() => {
    const list = [...(options || [])]
    if (defaultPath && !list.some(a => a.path === defaultPath)) {
      list.unshift({ path: defaultPath, name: `${defaultName || 'Auto Match'} (Default)` })
    }
    return list
  }, [options, defaultPath, defaultName])

  const filteredOpts = useMemo(() => {
    if (!searchTerm.trim()) return allOpts
    const q = searchTerm.toLowerCase().trim()
    return allOpts.filter(o => (o.name || '').toLowerCase().includes(q) || (o.path || '').toLowerCase().includes(q))
  }, [allOpts, searchTerm])

  const isCustomized = Boolean(value && defaultPath && value.toLowerCase() !== defaultPath.toLowerCase())
  const currentObj = allOpts.find(o => o.path === value)
  const filenameOnly = value ? value.split(/[\\/]/).pop() || value : ''
  const currentLabel = currentObj ? currentObj.name : (filenameOnly || 'Select Image...')

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleBrowseCustomImage = async () => {
    const api = (window as any).api
    if (!api || !api.dialog || !api.dialog.openFiles) return
    try {
      const files = await api.dialog.openFiles({
        title: 'Select Custom Title Overlay Image',
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
      })
      if (files && files.length > 0) {
        onChange(files[0])
        setIsOpen(false)
      }
    } catch (err) {
      console.error('Failed to select custom image:', err)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div className="ta-custom-select-wrap" ref={containerRef} style={{ flex: 1 }}>
        <button
          type="button"
          className={`ta-custom-select-trigger ${isOpen ? 'active' : ''} ${isCustomized ? 'is-customized' : ''}`}
          onClick={() => setIsOpen(prev => !prev)}
        >
          <span className="ta-custom-select-label" title={currentLabel}>
            <span style={{ fontSize: '12px' }}>🖼️</span>
            <span className="truncate" style={{ flex: 1, textAlign: 'left' }}>{currentLabel}</span>
          </span>
          <span className={`ta-custom-select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </button>

        {isOpen && (
          <div className="ta-custom-select-dropdown anim-scale-in">
            <div className="ta-custom-select-search-box">
              <input
                ref={searchInputRef}
                type="text"
                className="ta-custom-select-search-input"
                placeholder="🔍 Search title images..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="ta-custom-select-search-clear"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSearchTerm('')
                    searchInputRef.current?.focus()
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="ta-custom-select-list">
              <div
                className="ta-custom-select-option browse-opt"
                onClick={handleBrowseCustomImage}
                style={{
                  borderBottom: '1px solid var(--border)',
                  marginBottom: '4px',
                  paddingBottom: '8px',
                  color: 'var(--accent-adder, #6366F1)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ fontSize: '13px' }}>📂</span>
                <span style={{ whiteSpace: 'nowrap' }}>Browse Custom Image...</span>
              </div>

              {filteredOpts.length > 0 ? (
                filteredOpts.map(opt => {
                  const isSelected = opt.path === value
                  const isDefaultOpt = defaultPath && opt.path === defaultPath
                  return (
                    <div
                      key={opt.path}
                      className={`ta-custom-select-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        onChange(opt.path)
                        setIsOpen(false)
                      }}
                    >
                      <span style={{ fontSize: '12px', opacity: isSelected ? 1 : 0.5 }}>{isSelected ? '✓' : '🖼️'}</span>
                      <span className="truncate" style={{ flex: 1 }}>{opt.name}</span>
                      {isDefaultOpt && <span style={{ fontSize: '10px', opacity: 0.6, background: 'rgba(99,102,241,0.2)', padding: '1px 5px', borderRadius: '4px' }}>Default</span>}
                    </div>
                  )
                })
              ) : (
                <div className="ta-custom-select-empty">
                  <span>🖼️</span>
                  <span>No matching title images</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isCustomized && (
        <button
          type="button"
          className="ta-set-default-btn"
          title="Reset to default auto-matched title image"
          onClick={onResetDefault}
        >
          ↺ Set Default
        </button>
      )}
    </div>
  )
}

export type ThumbnailMode = 'default' | 'front_only' | 'back_only' | 'both'

interface ThumbnailModeSelectProps {
  value: ThumbnailMode
  onChange: (val: ThumbnailMode) => void
}

const THUMBNAIL_OPTIONS: Array<{
  value: ThumbnailMode
  title: string
  subtitle: string
  pillText: string
  icon: string
  tag: string
}> = [
  {
    value: 'default',
    title: 'Default (Add Both)',
    subtitle: 'Both Front (intro) and Back (end outro) thumbnails will be added',
    pillText: 'Both Added',
    icon: '✨',
    tag: 'Normal'
  },
  {
    value: 'front_only',
    title: 'Front Only',
    subtitle: 'Front thumbnail WON\'T be added (Back outro only)',
    pillText: 'No Front',
    icon: '🚫',
    tag: 'Skip Front'
  },
  {
    value: 'back_only',
    title: 'Back Only',
    subtitle: 'Back thumbnail WON\'T be added (Front intro only)',
    pillText: 'No Back',
    icon: '🚫',
    tag: 'Skip Back'
  },
  {
    value: 'both',
    title: 'Both',
    subtitle: 'Both Front & Back WON\'T be added (Pure video only)',
    pillText: 'No Thumbnails',
    icon: '🚫',
    tag: 'Skip Both'
  }
]

function ThumbnailModeSelect({ value, onChange }: ThumbnailModeSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOpt = THUMBNAIL_OPTIONS.find(o => o.value === value) || THUMBNAIL_OPTIONS[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="ta-thumb-select-wrap" ref={containerRef}>
      <button
        type="button"
        className={`ta-thumb-select-trigger ${isOpen ? 'active' : ''} ${value !== 'default' ? 'is-filtered' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <div className="ta-thumb-select-lead">
          <span className="ta-thumb-select-icon">{selectedOpt.icon}</span>
          <div className="ta-thumb-select-text">
            <div className="ta-thumb-select-title-row">
              <span className="ta-thumb-select-title">{selectedOpt.title}</span>
              <span className={`ta-thumb-badge ${value === 'default' ? 'badge-default' : 'badge-excluded'}`}>
                {selectedOpt.pillText}
              </span>
            </div>
            <span className="ta-thumb-select-sub">{selectedOpt.subtitle}</span>
          </div>
        </div>
        <div className="ta-thumb-select-right">
          <span className={`ta-thumb-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </div>
      </button>

      {isOpen && (
        <div className="ta-thumb-select-dropdown anim-scale-in">
          <div className="ta-thumb-dropdown-header">
            <span>🖼️ Select Thumbnail Placement Mode</span>
            <span className="ta-thumb-dropdown-tip">Controls intro & outro video overlays</span>
          </div>
          <div className="ta-thumb-options-list">
            {THUMBNAIL_OPTIONS.map(opt => {
              const isSelected = opt.value === value
              return (
                <div
                  key={opt.value}
                  className={`ta-thumb-option-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                  }}
                >
                  <div className="ta-thumb-opt-left">
                    <span className="ta-thumb-opt-icon">{opt.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ta-thumb-opt-title">
                        <span>{opt.title}</span>
                        <span className={`ta-thumb-opt-tag ${opt.value === 'default' ? 'tag-normal' : 'tag-skip'}`}>
                          {opt.tag}
                        </span>
                      </div>
                      <div className="ta-thumb-opt-desc">{opt.subtitle}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="ta-thumb-check-icon">✔</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface RowThumbnailSelectProps {
  value: ThumbnailMode
  onChange: (val: ThumbnailMode) => void
}

function RowThumbnailSelect({ value, onChange }: RowThumbnailSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedOpt = THUMBNAIL_OPTIONS.find(o => o.value === value) || THUMBNAIL_OPTIONS[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="ta-row-thumb-select-wrap" ref={ref}>
      <button
        type="button"
        className={`ta-row-thumb-select-trigger mode-${value} ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        title={selectedOpt.subtitle}
      >
        <span className="ta-row-thumb-select-icon">{selectedOpt.icon}</span>
        <span className="ta-row-thumb-select-text">{selectedOpt.pillText}</span>
        <span className="ta-row-thumb-select-caret">▾</span>
      </button>

      {isOpen && (
        <div className="ta-row-thumb-dropdown-menu anim-scale-in">
          {THUMBNAIL_OPTIONS.map(opt => {
            const isSel = opt.value === value
            return (
              <div
                key={opt.value}
                className={`ta-row-thumb-option-item ${isSel ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
              >
                <span className="ta-row-thumb-opt-icon">{opt.icon}</span>
                <div className="ta-row-thumb-opt-labels">
                  <span className="ta-row-thumb-opt-title">{opt.pillText}</span>
                  <span className="ta-row-thumb-opt-sub">{opt.subtitle}</span>
                </div>
                {isSel && <span className="ta-row-thumb-opt-check">✔</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const meta = PAGE_META['adder']

type Mode = 'batch' | 'single'

interface ValidationResult {
  filename: string
  stem: string
  ext: string
  isValid: boolean
  errors: string[]
  suggestedStem: string
}

export function validateFilename(filename: string): ValidationResult {
  const lastDot = filename.lastIndexOf('.')
  const stem = lastDot !== -1 ? filename.substring(0, lastDot) : filename
  const ext = lastDot !== -1 ? filename.substring(lastDot) : ''
  const errors: string[] = []

  // Check double spaces
  if (/\s{2,}/.test(stem)) {
    errors.push('Double spaces')
  }

  // Split parts
  const cleanStem = stem.replace(/\s+/g, ' ').trim()
  const parts = cleanStem.split(' ')

  const STANDARD_PREFIXES = ['N', 'Q', 'MZ', 'M', 'Z', 'AQ', 'WAAZ', 'ID', 'BQ', 'BZ', 'BM', 'OD']
  const prefixSet = new Set(STANDARD_PREFIXES)

  let prefixIndex = -1
  let rawPrefix = ''

  // 1. Check embedded camera sequence pattern (e.g. V-1448-01-22 _02E-10-01Z-30355757, V-1448-01-22 _02E-10-01Z)
  const embeddedMatch = stem.match(/\d+[\s-_]*(WAAZ|NIKAAH|NAMAZ|BETHAK|ZIYAFAT|MAJLIS|QADAM|IDAARA|MZ|AQ|ID|OD|BQ|BM|BZ|Q|M|Z|N)(?:[\s-_]*\d+)?(?:[\s-_]|$)/i)
  if (embeddedMatch && embeddedMatch[1]) {
    rawPrefix = embeddedMatch[1]
    const pUpper = rawPrefix.toUpperCase()
    if (prefixSet.has(pUpper)) {
      prefixIndex = 999 // Mark as found via embedded match
    }
  }

  // 2. Look for a standard prefix case-insensitively in parts
  if (prefixIndex === -1) {
    for (let i = 0; i < parts.length; i++) {
      const pUpper = parts[i].toUpperCase()
      if (prefixSet.has(pUpper)) {
        prefixIndex = i
        rawPrefix = parts[i]
        break
      }
    }
  }

  // 3. Look for any alphabetical part
  if (prefixIndex === -1) {
    for (let i = 0; i < parts.length; i++) {
      if (/^[A-Za-z]+$/.test(parts[i]) && prefixSet.has(parts[i].toUpperCase())) {
        prefixIndex = i
        rawPrefix = parts[i]
        break
      }
    }
  }

  // 4. Look for legacy format like MZ3 or N1
  let legacyMatch: RegExpMatchArray | null = null
  if (prefixIndex === -1) {
    for (let i = 0; i < parts.length; i++) {
      const match = parts[i].match(/^([A-Za-z]+)(\d+)$/)
      if (match && prefixSet.has(match[1].toUpperCase())) {
        prefixIndex = i
        rawPrefix = match[1]
        legacyMatch = match
        break
      }
    }
  }

  let leadingSeq = ''
  let prefix = ''
  let trailingSeq = ''

  if (prefixIndex !== -1) {
    prefix = rawPrefix.toUpperCase()
    if (rawPrefix !== prefix) {
      errors.push(`Incorrect casing for '${rawPrefix}'`)
    }
    if (!prefixSet.has(prefix)) {
      errors.push(`Unrecognized prefix '${prefix}'`)
    }

    if (prefixIndex === 999) {
      // Embedded camera serial format (e.g. V-1448-01-22 _02E-10-01Z-30355757)
      leadingSeq = '001'
      trailingSeq = '01'
    } else {
      const leadingParts = parts.slice(0, prefixIndex)
      if (leadingParts.length === 0) {
        errors.push('Missing leading number')
        leadingSeq = '001'
      } else {
        const leadingVal = leadingParts.join('')
        if (!/^\d+$/.test(leadingVal)) {
          errors.push(`Invalid leading sequence '${leadingVal}'`)
          leadingSeq = leadingVal.replace(/\D/g, '') || '001'
        } else {
          leadingSeq = leadingVal
        }
      }

      if (legacyMatch) {
        errors.push(`Compact legacy format '${parts[prefixIndex]}'`)
        trailingSeq = legacyMatch[2]
      } else {
        const trailingParts = parts.slice(prefixIndex + 1)
        if (trailingParts.length === 0) {
          errors.push('Missing trailing number')
          trailingSeq = '01'
        } else {
          const trailingVal = trailingParts.join('')
          if (!/^\d+$/.test(trailingVal)) {
            errors.push(`Invalid trailing sequence '${trailingVal}'`)
            trailingSeq = trailingVal.replace(/\D/g, '') || '01'
          } else {
            trailingSeq = trailingVal
          }
        }
      }
    }
  } else {
    errors.push('Missing prefix (e.g. ID, MZ)')
    // Extract any numbers
    const numbers = parts.filter(p => /^\d+$/.test(p))
    if (numbers.length >= 2) {
      leadingSeq = numbers[0]
      trailingSeq = numbers[1]
    } else if (numbers.length === 1) {
      leadingSeq = numbers[0]
      trailingSeq = '01'
    } else {
      leadingSeq = '001'
      trailingSeq = '01'
    }
    prefix = 'ID'
  }

  const paddedLeading = leadingSeq.padStart(3, '0')
  const paddedTrailing = trailingSeq.padStart(2, '0')
  const suggestedStem = `${paddedLeading} ${prefix} ${paddedTrailing}`

  // Check padding
  if (leadingSeq && leadingSeq !== paddedLeading) {
    errors.push(`Leading number needs 3 digits`)
  }
  if (trailingSeq && trailingSeq !== paddedTrailing) {
    errors.push(`Trailing number needs 2 digits`)
  }

  const isValid = errors.length === 0 && stem === suggestedStem

  return {
    filename,
    stem,
    ext,
    isValid,
    errors,
    suggestedStem
  }
}

export default function TitleAdder(): JSX.Element {
  const { showToast } = useToast()
  const { playSuccess, playError, playTick, playBatchComplete } = useSound()

  const [storeState, setStoreState] = useTitleAdderStore()

  const mode = storeState.mode
  const setMode = (m: Mode) => setStoreState({ mode: m })

  const batchSources: string[] = useMemo(() => {
    if (storeState.batchSources && storeState.batchSources.length > 0) {
      return storeState.batchSources
    }
    const legacy = [storeState.batchSource, storeState.batchSource2].filter(Boolean) as string[]
    return legacy
  }, [storeState.batchSources, storeState.batchSource, storeState.batchSource2])

  const syncBatchesToConverter = (sources: string[], currentOutput?: string, batchOutputsOverride?: Record<string, string>) => {
    const cleanSources = sources.map(s => (s || '').trim()).filter(Boolean)
    const baseOut = currentOutput !== undefined ? currentOutput : (storeState.outputFolder || '')

    const batchPairs = cleanSources.map((src, idx) => {
      const cleanSrc = stripDvdFolderFromPath(src)
      const dateFolder = extractDateFolderFromSource(src)
      const batchName = dateFolder || `Batch #${idx + 1}`

      let resolvedVideo = baseOut
      if (batchOutputsOverride && (batchOutputsOverride[src] || batchOutputsOverride[cleanSrc])) {
        resolvedVideo = batchOutputsOverride[src] || batchOutputsOverride[cleanSrc]
      } else if (baseOut) {
        const normOut = baseOut.trim().replace(/[\\/]+$/, '')
        const outBase = normOut.split(/[\\/]/).filter(Boolean).pop() || ''
        if (dateFolder && outBase.toLowerCase() !== dateFolder.toLowerCase()) {
          resolvedVideo = `${normOut}\\${dateFolder}`
        } else {
          resolvedVideo = normOut
        }
      }

      return {
        batchIndex: idx,
        batchName,
        sourcePath: src,
        jpegFolder: cleanSrc,
        videoFolder: resolvedVideo
      }
    })

    try {
      localStorage.setItem('ot_converter_batch_pairs', JSON.stringify(batchPairs))
      if (batchPairs.length > 0) {
        const first = batchPairs[0]
        localStorage.setItem('ot_converter_source_jpeg', first.jpegFolder)
        localStorage.setItem('ot_converter_video_target', first.videoFolder)
        sessionStorage.setItem('ot_converter_source_jpeg', first.jpegFolder)
        sessionStorage.setItem('ot_converter_video_folder', first.videoFolder)
        const api = (window as any).api
        if (api?.settings?.setAndSave) {
          api.settings.setAndSave('converter_source_jpeg', first.jpegFolder).catch(() => {})
          api.settings.setAndSave('converter_video_target', first.videoFolder).catch(() => {})
        }
      }
      window.dispatchEvent(new CustomEvent('refresh-converter-paths', { detail: { batchPairs, outputFolder: baseOut, batchOutputs: batchOutputsOverride } }))
    } catch {}
  }

  const setBatchSources = (sources: string[]) => {
    const clean = sources.map(s => (s || '').trim()).filter(Boolean)
    setStoreState({
      batchSources: clean,
      batchSource: clean[0] || '',
      batchSource2: clean[1] || ''
    })
    try {
      localStorage.setItem('ot_ta_batch_sources', JSON.stringify(clean))
      if (clean[0]) {
        localStorage.setItem('ot_ta_batch_source', clean[0])
        const api = (window as any).api
        if (api?.settings?.setAndSave) {
          api.settings.setAndSave('last_source_adder', clean[0])
        }
      } else {
        localStorage.removeItem('ot_ta_batch_source')
      }
      if (clean[1]) {
        localStorage.setItem('ot_ta_batch_source_2', clean[1])
      } else {
        localStorage.removeItem('ot_ta_batch_source_2')
      }
    } catch {}
    syncBatchesToConverter(clean)
  }

  const batchSource = batchSources[0] || ''
  const setBatchSource = (s: string) => {
    const next = [...batchSources]
    if (next.length > 0) next[0] = s
    else if (s) next.push(s)
    setBatchSources(next)
  }

  const batchSource2 = batchSources[1] || ''
  const setBatchSource2 = (s: string) => {
    const next = [...batchSources]
    if (s) {
      if (next.length > 1) next[1] = s
      else next.push(s)
    } else if (next.length > 1) {
      next.splice(1, 1)
    }
    setBatchSources(next)
  }

  const addBatchFolder = async (folderPath?: string) => {
    let pathToAdd = folderPath
    if (!pathToAdd) {
      const api = (window as any).api
      if (api?.dialog?.openFolder) {
        pathToAdd = await api.dialog.openFolder({ title: 'Select Batch Folder (containing DVD subfolder)' })
      }
    }
    if (!pathToAdd) return

    const normalized = pathToAdd.trim()
    if (batchSources.some(s => s.toLowerCase() === normalized.toLowerCase())) {
      showToast({ title: 'Folder Already Added', message: 'This folder is already in your batch queue.', type: 'info' })
      return
    }

    const nextSources = [...batchSources, normalized]
    setBatchSources(nextSources)
    scanVideos(nextSources)
    showToast({ 
      title: `Batch Folder #${nextSources.length} Added 📂`, 
      message: `${normalized.split(/[\\/]/).pop()} added to queue.`, 
      type: 'success' 
    })
    playSuccess()
  }

  const removeBatchFolder = (index: number) => {
    const nextSources = batchSources.filter((_, i) => i !== index)
    setBatchSources(nextSources)
    scanVideos(nextSources)
    showToast({ title: 'Folder Removed', message: 'Removed from batch queue.', type: 'info' })
  }

  const moveBatchFolderUp = (index: number) => {
    if (index <= 0) return
    const nextSources = [...batchSources]
    const temp = nextSources[index - 1]
    nextSources[index - 1] = nextSources[index]
    nextSources[index] = temp
    setBatchSources(nextSources)
    scanVideos(nextSources)
    playTick()
    showToast({ title: 'Queue Reordered 🔀', message: `Folder moved to position #${index}`, type: 'info' })
  }

  const moveBatchFolderDown = (index: number) => {
    if (index >= batchSources.length - 1) return
    const nextSources = [...batchSources]
    const temp = nextSources[index + 1]
    nextSources[index + 1] = nextSources[index]
    nextSources[index] = temp
    setBatchSources(nextSources)
    scanVideos(nextSources)
    playTick()
    showToast({ title: 'Queue Reordered 🔀', message: `Folder moved to position #${index + 2}`, type: 'info' })
  }

  const changeBatchFolder = async (index: number) => {
    const api = (window as any).api
    if (!api?.dialog?.openFolder) return
    const picked = await api.dialog.openFolder({ title: `Select Replacement Folder for Queue #${index + 1}` })
    if (picked) {
      const nextSources = [...batchSources]
      nextSources[index] = picked
      setBatchSources(nextSources)
      scanVideos(nextSources)
      showToast({ title: `Folder #${index + 1} Updated 📂`, message: picked, type: 'info' })
      playSuccess()
    }
  }

  const outputFolder = storeState.outputFolder
  const setOutputFolder = (o: string) => {
    setStoreState({ outputFolder: o })
    if (o) {
      localStorage.setItem('ot_ta_output_folder', o)
      const api = (window as any).api
      if (api?.settings?.setAndSave) {
        api.settings.setAndSave('last_output_adder', o)
      }
    }
    syncBatchesToConverter(batchSources, o)
  }

  const videoFiles = storeState.videoFiles
  const setVideoFiles = (filesOrUpdater: string[] | ((prev: string[]) => string[])) => {
    const next = typeof filesOrUpdater === 'function' ? filesOrUpdater(storeState.videoFiles) : filesOrUpdater
    const filtered = (next || []).filter(f => !isGroupPhotoVideo(f))
    setStoreState({ videoFiles: filtered })
  }

  const [availablePrefixes, setAvailablePrefixes] = useState<string[]>([])
  const [safarFinalInfo, setSafarFinalInfo] = useState<any>(null)

  const autoDetectSafarFinal = async (samplePath: string) => {
    const api = (window as any).api
    if (!api?.titleAdder?.resolveSafarFinalPath || !samplePath) return
    try {
      const res = await api.titleAdder.resolveSafarFinalPath(samplePath)
      if (res && res.success && res.targetPath) {
        setSafarFinalInfo(res)
        setOutputFolder(res.targetPath)
        const check = await validatePathOnDisk(res.targetPath)
        setOutputExists(check.valid)
        setOutputPathError(check.reason || null)
        showToast({
          title: 'Safar Final Path Auto-Selected 🎯',
          message: `${res.safarName ? res.safarName + ' ➔ ' : ''}Final\\${res.dateFolder}`,
          type: 'success'
        })
      }
    } catch (err) {
      console.warn('[TitleAdder] Could not auto-resolve Safar final path:', err)
    }
  }

  useEffect(() => {
    if (mode === 'single' && videoFiles.length > 0 && !safarFinalInfo) {
      autoDetectSafarFinal(videoFiles[0])
    }
  }, [mode, videoFiles])

  const duration = storeState.duration
  const setDuration = (d: string) => setStoreState({ duration: d })

  const running = storeState.running
  const setRunning = (r: boolean) => setStoreState({ running: r })

  const cancelled = storeState.cancelled
  const setCancelled = (c: boolean) => setStoreState({ cancelled: c })

  const progress = storeState.progress
  const setProgress = (p: number) => setStoreState({ progress: p })

  const status = storeState.status
  const setStatus = (st: string) => setStoreState({ status: st })

  const total = storeState.total
  const setTotal = (t: number) => setStoreState({ total: t })

  const done = storeState.done
  const setDone = (dn: number) => setStoreState({ done: dn })

  const [lastRenderedOutputDir, setLastRenderedOutputDir] = useState<string>(() => localStorage.getItem('ot_converter_video_target') || '')

  const [_gpuLabel, _setGpuLabel] = useState('Detecting…')
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(true)

  const addToStats = storeState.addToStats
  const setAddToStats = (a: boolean) => setStoreState({ addToStats: a })

  const muteOriginal = storeState.muteOriginal
  const setMuteOriginal = (m: boolean) => setStoreState({ muteOriginal: m })

  const availableVideos = storeState.availableVideos
  const setAvailableVideos = (vidsOrUpdater: string[] | ((prev: string[]) => string[])) => {
    const next = typeof vidsOrUpdater === 'function' ? vidsOrUpdater(storeState.availableVideos || []) : vidsOrUpdater
    setStoreState({ availableVideos: next })
  }

  const mutedVideos = useMemo(() => new Set(storeState.mutedVideos), [storeState.mutedVideos])
  const setMutedVideos = (muted: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const current = new Set(storeState.mutedVideos)
    const nextSet = typeof muted === 'function' ? muted(current) : muted
    setStoreState({ mutedVideos: Array.from(nextSet) })
  }

  const [isMuteOverlayOpen, setIsMuteOverlayOpen] = useState(false)
  const [muteSearch, setMuteSearch] = useState('')

  const addWatermarkGlobal = storeState.addWatermarkGlobal
  const setAddWatermarkGlobal = (w: boolean) => setStoreState({ addWatermarkGlobal: w })

  const watermarkedVideos = useMemo(() => new Set(storeState.watermarkedVideos), [storeState.watermarkedVideos])
  const setWatermarkedVideos = (wm: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const current = new Set(storeState.watermarkedVideos)
    const nextSet = typeof wm === 'function' ? wm(current) : wm
    setStoreState({ watermarkedVideos: Array.from(nextSet) })
  }

  const [isWatermarkOverlayOpen, setIsWatermarkOverlayOpen] = useState(false)
  const [watermarkSearch, setWatermarkSearch] = useState('')
  const [fps, setFps] = useState('')
  const [speed, setSpeed] = useState('')
  const [eta, setEta] = useState('')
  const startTimeRef = useRef<number>(0)
  const lastStatusRef = useRef<string>('')
  const { lines, addLine, clear } = useLogLines()
  const jobIdRef = useRef(`job_${Date.now()}`)

  // Pre-Render Confirmation Popup states
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false)
  const [isAudioModalFullscreen, setIsAudioModalFullscreen] = useState(true)
  const [audioPreviewAssignments, setAudioPreviewAssignments] = useState<Array<{
    videoPath: string
    videoName: string
    prefix: string
    defaultAudioPath: string
    defaultAudioName: string
    defaultTitleImagePath: string
    defaultTitleImageName: string
    isNikah: boolean
    isSpecialWaazId: boolean
  }>>([])
  const [availableAudioOptions, setAvailableAudioOptions] = useState<Array<{ name: string; path: string }>>([])
  const [availableTitleImageOptions, setAvailableTitleImageOptions] = useState<Array<{ name: string; path: string }>>([])

  const userAudioSelections = storeState.userAudioSelections
  const setUserAudioSelections = (selections: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    const next = typeof selections === 'function' ? selections(storeState.userAudioSelections) : selections
    setStoreState({ userAudioSelections: next })
  }

  const userTitleImageSelections = storeState.userTitleImageSelections
  const setUserTitleImageSelections = (selections: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    const next = typeof selections === 'function' ? selections(storeState.userTitleImageSelections) : selections
    setStoreState({ userTitleImageSelections: next })
  }

  const userMuteSelections = storeState.userMuteSelections
  const setUserMuteSelections = (selections: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => {
    const next = typeof selections === 'function' ? selections(storeState.userMuteSelections) : selections
    setStoreState({ userMuteSelections: next })
  }

  const [audioSearchFilter, setAudioSearchFilter] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [thumbnailMode, setThumbnailMode] = useState<ThumbnailMode>('default')
  const [userThumbnailModeSelections, setUserThumbnailModeSelections] = useState<Record<string, ThumbnailMode>>({})
  const [outputExists, setOutputExists] = useState<boolean | null>(null)
  const [outputPathError, setOutputPathError] = useState<string | null>(null)

  const [audioAssignMode, setAudioAssignMode] = useState<string>('single')
  const [audioSingleIdx, setAudioSingleIdx] = useState<number>(0)

  const reapplyAudioLogic = async (targetMode: string, targetSingleIdx: number) => {
    const api = (window as any).api
    const prefixMap = (await api?.settings?.get?.('audio_prefix_assignments')) || {}
    const nextAudioMap: Record<string, string> = { ...userAudioSelections }
    let normalIdx = 0

    audioPreviewAssignments.forEach(item => {
      if (item.isNikah && item.defaultAudioPath) {
        nextAudioMap[item.videoPath] = item.defaultAudioPath
        return
      }
      if (item.isSpecialWaazId && item.defaultAudioPath) {
        nextAudioMap[item.videoPath] = item.defaultAudioPath
        return
      }

      let selectedPath = ''
      if (targetMode === 'single') {
        const idx = Math.max(0, Math.min(targetSingleIdx, availableAudioOptions.length - 1))
        selectedPath = availableAudioOptions[idx]?.path || item.defaultAudioPath
      } else if (targetMode === 'alternate') {
        if (availableAudioOptions.length > 0) {
          selectedPath = availableAudioOptions[normalIdx % availableAudioOptions.length].path
          normalIdx++
        } else {
          selectedPath = item.defaultAudioPath
        }
      } else if (targetMode === 'prefix') {
        const assignedName = prefixMap[item.prefix.toUpperCase()] || 'Audio 1'
        const matched = availableAudioOptions.find(o => o.name.toLowerCase() === assignedName.toLowerCase())
        selectedPath = matched?.path || item.defaultAudioPath
      }

      if (selectedPath) {
        nextAudioMap[item.videoPath] = selectedPath
        nextAudioMap[item.videoName] = selectedPath
        const stem = getCanonicalStem(item.videoName)
        nextAudioMap[stem] = selectedPath
      }
    })

    setUserAudioSelections(nextAudioMap)
  }

  const getResolvedOutputDir = (sourcePath?: string, outPath?: string): string => {
    const baseOut = outPath || outputFolder
    if (!baseOut) return ''
    if (mode === 'batch' && (sourcePath || batchSource)) {
      const src = (sourcePath || batchSource).trim()
      const dateFolder = src.split(/[\\/]/).filter(Boolean).pop() || ''
      const normOut = baseOut.trim().replace(/[\\/]+$/, '')
      const outBase = normOut.split(/[\\/]/).filter(Boolean).pop() || ''
      if (dateFolder && outBase.toLowerCase() !== dateFolder.toLowerCase()) {
        return `${normOut}\\${dateFolder}`
      }
      return normOut
    }
    return baseOut.trim()
  }

  const validatePathOnDisk = async (dirPath: string): Promise<{ valid: boolean; reason?: string }> => {
    if (!dirPath || !dirPath.trim()) return { valid: false, reason: 'No output folder specified' }
    const api = (window as any).api
    try {
      if (api?.titleAdder?.validatePath) {
        const res = await api.titleAdder.validatePath(dirPath)
        return { valid: Boolean(res?.valid), reason: res?.reason }
      }
      if (api?.archiveCatalog?.checkPathExists) {
        const exists = await api.archiveCatalog.checkPathExists(dirPath)
        return { valid: exists, reason: exists ? undefined : 'Directory does not exist' }
      }
    } catch (err: any) {
      return { valid: false, reason: err?.message || 'Failed to check directory path' }
    }
    return { valid: true }
  }

  const resolvedOutDir = useMemo(() => {
    return getResolvedOutputDir(batchSource, outputFolder)
  }, [batchSource, outputFolder, mode])

  useEffect(() => {
    if (resolvedOutDir) {
      validatePathOnDisk(resolvedOutDir).then(res => {
        setOutputExists(res.valid)
        setOutputPathError(res.reason || null)
      })
    } else {
      setOutputExists(null)
      setOutputPathError(null)
    }
  }, [resolvedOutDir])

  const [controlsWidth, setControlsWidth] = useState<number>(() => {
    const saved = localStorage.getItem('ot_title_adder_width')
    return saved ? parseInt(saved, 10) : 400
  })

  const [panelAlign, setPanelAlign] = useState<'left' | 'right'>(() => {
    const saved = localStorage.getItem('ot_title_adder_align')
    return (saved === 'left' || saved === 'right') ? saved : 'left'
  })

  const [isLogsPopupOpen, setIsLogsPopupOpen] = useState(false)

  const totalVideosFound = mode === 'batch'
    ? ((availableVideos && availableVideos.length > 0) ? availableVideos.length : total)
    : ((videoFiles && videoFiles.length > 0) ? videoFiles.length : total)
  const completedCount = done || 0
  const pendingCount = Math.max(0, totalVideosFound - completedCount)

  const [isDragging, setIsDragging] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const dragCounter = useRef(0)
  const handleMediaEncoderSignalRef = useRef<((dvdPath: string, autoStart?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    localStorage.setItem('ot_title_adder_width', String(controlsWidth))
  }, [controlsWidth])

  useEffect(() => {
    localStorage.setItem('ot_title_adder_align', panelAlign)
  }, [panelAlign])

  // Fetch available asset prefixes from the titles folder to validate videos beforehand
  async function refreshAvailablePrefixes() {
    const api = (window as any).api
    if (!api || !api.titleAdder || !api.titleAdder.getAvailablePrefixes) return
    try {
      const list = await api.titleAdder.getAvailablePrefixes()
      setAvailablePrefixes(list)
    } catch (e) {
      console.error('Error fetching available prefixes:', e)
    }
  }

  const handleSetCodeLogic = async (logic: 'prefix' | 'suffix' | 'serial' | 'auto') => {
    localStorage.setItem('ot_ta_code_logic', logic)
    setStoreState({ codeParsingLogic: logic })
    const api = (window as any).api
    if (api && api.settings && api.settings.set) {
      await api.settings.set('code_parsing_logic', logic)
    }
  }

  function getPrefix(name: string, overrideLogic?: string): string {
    if (!name) return ''
    const logicMode = overrideLogic || storeState.codeParsingLogic || 'auto'
    const rawStem = name.replace(/\.[^/.]+$/, '').trim()
    const stem = rawStem.replace(/_\d{1,3}[A-Za-z](?:-|_|\s|$)/gi, '_')

    const normalizeCode = (raw: string): string => {
      const upper = raw.toUpperCase().trim()
      if (upper === 'NAMAZ' || upper === 'NIKAAH') return 'N'
      if (upper === 'BETHAK') return 'AQ'
      if (upper === 'ZIYAFAT' || upper === 'ZIARAT' || upper === 'ZIYARAT') return 'Z'
      if (upper === 'MAJLIS') return 'M'
      if (upper === 'QADAM') return 'Q'
      if (upper === 'IDAARA') return 'ID'
      if (upper === 'WAAZ') return 'WAAZ'

      const m = upper.match(/^(?:\d+[\s-_]*)?([A-Z]+)(?:[\s-_]*\d+)?$/)
      if (m && m[1]) return m[1]

      return upper
    }

    const knownCodes = [
      'ONLINE', 'MISBAH', 'NIKAAH', 'ZIYAFAT', 'MAJLIS', 'BETHAK', 'IDAARA', 'NAMAZ', 'QADAM', 'WAAZ',
      'QMZ', 'IFS', 'KGS', 'MKB', 'MUL', 'MYN', 'TJR', 'TQN', 'TNQ', 'FMB', 'MZ', 'AQ', 'BM', 'BQ', 'BZ',
      'ID', 'IF', 'IST', 'MF', 'MO', 'MQ', 'OD', 'OZ', 'SH', 'SQ', 'TQ', 'WD', 'ZO',
      'Q', 'M', 'Z', 'N', 'H'
    ]
    const validNormalizedCodes = new Set([
      'Q', 'M', 'Z', 'MZ', 'ID', 'OD', 'OZ', 'ZO', 'WAAZ', 'AQ', 'N', 'BQ', 'BZ', 'BM',
      'FMB', 'QMZ', 'IFS', 'KGS', 'MKB', 'MUL', 'MYN', 'TJR', 'TQN', 'TNQ', 'MISBAH', 'ONLINE',
      'SH', 'SQ', 'TQ', 'WD', 'H', 'IF', 'IST', 'MF', 'MO', 'MQ'
    ])

    const isValidCode = (c: string): boolean => {
      if (!c) return false
      return validNormalizedCodes.has(c) || /^[A-Z]{2,6}$/.test(c)
    }

    // 1. Serial / Embedded mode matching
    if (logicMode === 'serial' || logicMode === 'embedded' || logicMode === 'auto' || logicMode === 'prefix' || logicMode === 'suffix') {
      const regPattern = /\d+[\s-_]*(ONLINE|MISBAH|NIKAAH|ZIYAFAT|MAJLIS|BETHAK|IDAARA|NAMAZ|QADAM|WAAZ|QMZ|IFS|KGS|MKB|MUL|MYN|TJR|TQN|TNQ|FMB|MZ|AQ|BM|BQ|BZ|ID|IF|IST|MF|MO|MQ|OD|OZ|SH|SQ|TQ|WD|ZO|Q|M|Z|N|H)(?:[\s-_]*\d+)?(?:[\s-_]|$)/gi

      const matches = [...stem.matchAll(regPattern)]
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1]
        if (lastMatch && lastMatch[1]) {
          const code = normalizeCode(lastMatch[1])
          if (isValidCode(code)) return code
        }
      }
      const rawMatches = [...rawStem.matchAll(regPattern)]
      if (rawMatches.length > 0) {
        const lastMatch = rawMatches[rawMatches.length - 1]
        if (lastMatch && lastMatch[1]) {
          const code = normalizeCode(lastMatch[1])
          if (isValidCode(code)) return code
        }
      }
    }

    // 2. Suffix mode matching (e.g. "01-Z", "03-Q", "001 01-Z")
    if (logicMode === 'suffix' || logicMode === 'auto') {
      const suffixMatch = stem.match(/(?:^|[\s-_])(?:(\d{1,3}[\s-_]+)?(ONLINE|MISBAH|NIKAAH|ZIYAFAT|MAJLIS|BETHAK|IDAARA|NAMAZ|QADAM|WAAZ|QMZ|IFS|KGS|MKB|MUL|MYN|TJR|TQN|TNQ|FMB|MZ|AQ|BM|BQ|BZ|ID|IF|IST|MF|MO|MQ|OD|OZ|SH|SQ|TQ|WD|ZO|Q|M|Z|N|H)(?:[\s-_]*\d+)?)(?:[\s-_]|$)/i)
      if (suffixMatch && suffixMatch[2]) {
        const code = normalizeCode(suffixMatch[2])
        if (isValidCode(code)) {
          return code
        }
      }
    }

    // 3. Prefix mode matching (e.g. "001 Z01", "002 Q02", "Z01", "Q02")
    if (logicMode === 'prefix' || logicMode === 'auto') {
      let cleanName = stem.replace(/^(?:\d+[\s-_]*)+/, '').trim()
      if (!cleanName) cleanName = stem

      const upperClean = cleanName.toUpperCase()
      for (const code of knownCodes) {
        if (upperClean.startsWith(code)) {
          const norm = normalizeCode(code)
          if (isValidCode(norm)) {
            return norm
          }
        }
      }

      const parts = cleanName.split(/[\s-_]+/).filter(Boolean)
      if (parts.length > 0) {
        const token = parts[0]
        const m = token.match(/^([A-Za-z]+)/)
        if (m && m[1]) {
          const norm = normalizeCode(m[1])
          if (isValidCode(norm)) {
            return norm
          }
        }
      }
    }

    // Fallback: search anywhere in stem for known code
    const upperStem = stem.toUpperCase()
    for (const code of knownCodes) {
      const reg = new RegExp(`(?:^|[^A-Z])${code}(?:[^A-Z]|$)`, 'i')
      if (reg.test(upperStem)) {
        const norm = normalizeCode(code)
        if (isValidCode(norm)) {
          return norm
        }
      }
    }

    return ''
  }

  const missingBatchVideos = React.useMemo(() => {
    if (mode !== 'batch' || !batchSource || availableVideos.length === 0) return []
    return availableVideos.filter(f => {
      const prefix = getPrefix(f.replace(/\.[^/.]+$/, ""))
      return !availablePrefixes.includes(prefix.toLowerCase())
    })
  }, [mode, batchSource, availableVideos, availablePrefixes, storeState.codeParsingLogic])

  useEffect(() => {
    const api = (window as any).api
    if (api && api.settings && api.settings.get) {
      api.settings.get('code_parsing_logic').then((logic: any) => {
        if (logic && (logic === 'prefix' || logic === 'suffix' || logic === 'auto')) {
          setStoreState({ codeParsingLogic: logic })
          localStorage.setItem('ot_ta_code_logic', logic)
        }
      })
    }

    // Pre-populate available title images for Predefine modal & Preflight modal
    if (api?.titleAdder?.previewAudioAssignments) {
      api.titleAdder.previewAudioAssignments({ mode: 'single', videoFiles: [] })
        .then((res: any) => {
          if (res?.availableTitleImages && Array.isArray(res.availableTitleImages)) {
            setAvailableTitleImageOptions(res.availableTitleImages)
          }
        })
        .catch(() => {})
    }

    const unsubs: Array<(() => void) | undefined> = []

    if (api?.titleAutomode?.onTriggered) {
      unsubs.push(api.titleAutomode.onTriggered((data: any) => {
        handleMediaEncoderSignalRef.current?.(data?.dvdPath, data?.autoStart !== false)
      }))
    }

    if (api?.titleAutomode?.onAmeRenderComplete) {
      unsubs.push(api.titleAutomode.onAmeRenderComplete((data: any) => {
        if (data?.dvdPath) {
          handleMediaEncoderSignalRef.current?.(data.dvdPath, data?.autoStart !== false)
        }
      }))
    }

    return () => {
      unsubs.forEach(u => {
        if (typeof u === 'function') u()
      })
    }
  }, [storeState.autoStartOnEncoderSignal, storeState.alwaysKeepOgAudioKeywords, storeState.predefinedVideoMutes])

  // ── Canonical stem helper for matching temp files with final rendered files ──
  const getCanonicalStem = (filenameOrPath: string): string => {
    if (!filenameOrPath) return ''
    const base = filenameOrPath.split(/[\\/]/).pop() || filenameOrPath
    return base
      .replace(/\.(tmp|temp)$/i, '')
      .replace(/\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|ts|m2ts|mpg|mpeg)$/i, '')
      .trim()
      .toLowerCase()
  }

  // ── Original Audio & Predefine System ──────────────────────────────
  const isVideoMuteExcluded = (filename: string, exceptions: string[] = []): boolean => {
    const lower = filename.toLowerCase()
    const cleanBase = filename.replace(/\.(tmp|temp)$/i, '').trim()
    const lastDot = cleanBase.lastIndexOf('.')
    const stem = lastDot > 0 ? cleanBase.substring(0, lastDot).toLowerCase() : cleanBase.toLowerCase()
    const canonical = getCanonicalStem(filename)

    // 1. Check user explicit predefined per-video mute setting
    const preMutes = storeState.predefinedVideoMutes || {}
    if (preMutes[filename] === false || preMutes[cleanBase] === false || preMutes[stem] === false || preMutes[canonical] === false) {
      return true // Keep original audio
    }
    if (preMutes[filename] === true || preMutes[cleanBase] === true || preMutes[stem] === true || preMutes[canonical] === true) {
      return false // Explicitly muted
    }

    for (const [k, v] of Object.entries(preMutes)) {
      if (getCanonicalStem(k) === canonical) {
        return v === false // false means Keep OG Audio
      }
    }

    // 2. Check passed exceptions from Premiere extension
    if (exceptions && exceptions.length > 0) {
      const isEx = exceptions.some(e => {
        const lowerE = e.toLowerCase()
        const dotE = lowerE.lastIndexOf('.')
        const stemE = dotE > 0 ? lowerE.substring(0, dotE) : lowerE
        const canonicalE = getCanonicalStem(e)
        return lower === lowerE || stem === stemE || canonical === canonicalE || stem.includes(stemE) || lowerE.includes(stem)
      })
      if (isEx) return true
    }

    // 3. Check keywords that always keep OG audio (e.g. WAAZ, ID, SPEECH, BAYAAN)
    const keywords = storeState.alwaysKeepOgAudioKeywords || []
    for (const kw of keywords) {
      const k = kw.toLowerCase().trim()
      if (!k) continue
      const reg = new RegExp(`(?:^|[^a-z0-9])${k}(?:[^a-z0-9]|$)`, 'i')
      if (reg.test(lower) || lower.includes(k) || stem.includes(k) || canonical.includes(k)) {
        return true
      }
    }

    return false
  }

  const [isPredefineModalOpen, setIsPredefineModalOpen] = useState(false)
  const [newKeywordInput, setNewKeywordInput] = useState('')
  const [newVideoInput, setNewVideoInput] = useState('')
  const [predefineSearch, setPredefineSearch] = useState('')
  const autoRenderLockRef = useRef<boolean>(false)

  // Triggered when signal arrives from Adobe Media Encoder or HTTP webhook
  const handleMediaEncoderSignal = async (dvdPath: string, autoStart: boolean = true) => {
    if (!dvdPath) return
    const cleanPath = stripDvdFolderFromPath(dvdPath)
    if (!cleanPath) return

    setMode('batch')
    setBatchSource(cleanPath)

    if (autoRenderLockRef.current) return
    autoRenderLockRef.current = true

    showToast({
      title: '🎬 Media Encoder Signal Received',
      message: `Media Encoder finished rendering DVD files. Loading videos...`,
      type: 'info'
    })

    const api = (window as any).api
    if (!api?.titleAdder?.listVideos) {
      autoRenderLockRef.current = false
      return
    }

    // Wait and check if Media Encoder is still writing or has pending .tmp files
    let videos: string[] = []
    const maxWaitMs = 120000 // up to 2 minutes
    const startTime = Date.now()

    const expVideos = titleAdderStore.getState().expectedVideos || []
    const expSet = expVideos.length > 0 ? new Set(expVideos.map((e: string) => getCanonicalStem(e))) : null

    while (Date.now() - startTime < maxWaitMs) {
      try {
        videos = await api.titleAdder.listVideos(cleanPath)
      } catch {}

      const readyVideos = videos.filter(v => {
        if (v.toLowerCase().endsWith('.tmp') || v.toLowerCase().endsWith('.temp')) return false
        if (expSet && !expSet.has(getCanonicalStem(v))) return false
        return true
      })
      const readyStems = new Set(readyVideos.map(r => getCanonicalStem(r)))
      const trulyPendingTmp = videos.filter(v => {
        if (!v.toLowerCase().endsWith('.tmp') && !v.toLowerCase().endsWith('.temp')) return false
        if (expSet && !expSet.has(getCanonicalStem(v))) return false
        return !readyStems.has(getCanonicalStem(v))
      })

      if (readyVideos.length > 0 && trulyPendingTmp.length === 0) {
        // All queued videos in this batch have finished rendering into full video files!
        if (api?.titleAdder?.cleanupTempFiles) {
          try { await api.titleAdder.cleanupTempFiles(cleanPath) } catch {}
        }
        videos = readyVideos
        break
      }

      if (trulyPendingTmp.length > 0) {
        showToast({
          title: '⏳ Media Encoder Batch Rendering',
          message: `Waiting for all videos to finish encoding (${readyVideos.length} ready, ${trulyPendingTmp.length} pending)...`,
          type: 'info'
        })
      }

      await new Promise(r => setTimeout(r, 2000))
    }

    // Proactively clean up any remaining temp placeholder files in cleanPath
    if (api?.titleAdder?.cleanupTempFiles) {
      try { await api.titleAdder.cleanupTempFiles(cleanPath) } catch {}
    }

    // Filter out any leftover .tmp entries and keep only expected videos if specified
    videos = (videos || []).filter(v => {
      if (v.toLowerCase().endsWith('.tmp') || v.toLowerCase().endsWith('.temp')) return false
      if (expSet && !expSet.has(getCanonicalStem(v))) return false
      return true
    })

    if (!videos || videos.length === 0) {
      showToast({
        title: 'Waiting for Videos',
        message: 'Media Encoder signaled completion, but no rendered videos found in DVD folder yet.',
        type: 'warning'
      })
      autoRenderLockRef.current = false
      return
    }

    // Snapshot existing selections made on temp files before replacing availableVideos
    const currentStore = titleAdderStore.getState()
    const prevAvailable = [...(currentStore.availableVideos || availableVideos)]
    const prevMuted = new Set(currentStore.mutedVideos || mutedVideos)
    const prevWatermarked = new Set(currentStore.watermarkedVideos || watermarkedVideos)
    const prevAudioMap = { ...(currentStore.userAudioSelections || {}) }
    const prevImageMap = { ...(currentStore.userTitleImageSelections || {}) }
    const prevMuteMap = { ...(currentStore.userMuteSelections || {}) }

    setAvailableVideos(videos)

    // A. Transfer Mute selections from temp file state to rendered video state
    const nextMuted = new Set<string>()
    for (const v of videos) {
      const stem = getCanonicalStem(v)
      const matchingPrev = Array.from(prevMuted).find(p => getCanonicalStem(p) === stem)
      if (matchingPrev !== undefined) {
        nextMuted.add(v)
      } else {
        const wasInAvailable = prevAvailable.some(a => getCanonicalStem(a) === stem)
        if (!wasInAvailable) {
          if (!isVideoMuteExcluded(v, [])) {
            nextMuted.add(v)
          }
        }
      }
    }
    setMutedVideos(nextMuted)

    // B. Transfer Watermark selections from temp file state to rendered video state
    const nextWatermarked = new Set<string>()
    for (const v of videos) {
      const stem = getCanonicalStem(v)
      const matchingPrev = Array.from(prevWatermarked).find(p => getCanonicalStem(p) === stem)
      if (matchingPrev !== undefined) {
        nextWatermarked.add(v)
      } else {
        const wasInAvailable = prevAvailable.some(a => getCanonicalStem(a) === stem)
        if (!wasInAvailable) {
          nextWatermarked.add(v)
        }
      }
    }
    setWatermarkedVideos(nextWatermarked)

    // C. Transfer Audio Tracks, Title Images (Thumbnails), and Preflight Mutes
    const initAudioMap: Record<string, string> = { ...prevAudioMap }
    const initImageMap: Record<string, string> = { ...prevImageMap }
    const initMuteMap: Record<string, boolean> = { ...prevMuteMap }

    videos.forEach(v => {
      const fullPath = [cleanPath, v].join('/')
      const stemV = getCanonicalStem(v)

      // Audio track transfer
      let matchedAudio = storeState.predefinedAudioTracks[v] || storeState.predefinedAudioTracks[stemV]
      if (!matchedAudio) {
        for (const [k, audioPath] of Object.entries(prevAudioMap)) {
          if (getCanonicalStem(k) === stemV) {
            matchedAudio = audioPath
            break
          }
        }
      }
      if (matchedAudio) {
        initAudioMap[fullPath] = matchedAudio
        initAudioMap[v] = matchedAudio
      }

      // Title image / thumbnail transfer
      let matchedImage = storeState.predefinedTitleImages[v] || storeState.predefinedTitleImages[stemV]
      if (!matchedImage) {
        for (const [k, imgPath] of Object.entries(prevImageMap)) {
          if (getCanonicalStem(k) === stemV) {
            matchedImage = imgPath
            break
          }
        }
      }
      if (matchedImage) {
        initImageMap[fullPath] = matchedImage
        initImageMap[v] = matchedImage
      }

      // Preflight mute selection transfer
      let matchedMute: boolean | undefined =
        storeState.predefinedVideoMutes[v] !== undefined
          ? storeState.predefinedVideoMutes[v]
          : storeState.predefinedVideoMutes[stemV]

      if (matchedMute === undefined) {
        for (const [k, mVal] of Object.entries(prevMuteMap)) {
          if (getCanonicalStem(k) === stemV) {
            matchedMute = mVal
            break
          }
        }
      }
      if (matchedMute !== undefined) {
        initMuteMap[fullPath] = matchedMute
        initMuteMap[v] = matchedMute
      } else {
        initMuteMap[fullPath] = nextMuted.has(v)
      }
    })

    setUserAudioSelections(initAudioMap)
    setUserTitleImageSelections(initImageMap)
    setUserMuteSelections(initMuteMap)

    // Open Pre-Render Setup & Confirmation dialog for pre-flight review
    try {
      const expVideos = titleAdderStore.getState().expectedVideos || []
      const res = await api.titleAdder.previewAudioAssignments({
        mode: 'batch',
        batchSource: cleanPath,
        videoFiles: expVideos.length > 0 ? expVideos : []
      })

      if (res && res.assignments && res.assignments.length > 0) {
        setAudioPreviewAssignments(res.assignments)
        setAvailableAudioOptions(res.availableAudio || [])
        setAvailableTitleImageOptions(res.availableTitleImages || [])

        res.assignments.forEach((item: any) => {
          const canonical = getCanonicalStem(item.videoName)
          if (!initAudioMap[item.videoPath] && item.defaultAudioPath) {
            initAudioMap[item.videoPath] = item.defaultAudioPath
          }
          if (!initImageMap[item.videoPath] && item.defaultTitleImagePath) {
            initImageMap[item.videoPath] = item.defaultTitleImagePath
          }
          if (initMuteMap[item.videoPath] === undefined) {
            initMuteMap[item.videoPath] = item.isSpecialWaazId ? false : nextMuted.has(item.videoName)
          }
        })

        setUserAudioSelections(initAudioMap)
        setUserTitleImageSelections(initImageMap)
        setUserMuteSelections(initMuteMap)
        setWatermarkedVideos(nextWatermarked)

        setIsAudioModalOpen(true)
        playSuccess()
        showToast({
          title: '🎬 Batch Ready for Review',
          message: `Batch is ready to render. Confirm settings and click Start.`,
          type: 'info'
        })
      } else {
        setIsAudioModalOpen(true)
      }
    } catch (err: any) {
      console.warn('Error previewing audio assignments on AME signal:', err)
      setIsAudioModalOpen(true)
    } finally {
      autoRenderLockRef.current = false
    }
  }
  handleMediaEncoderSignalRef.current = handleMediaEncoderSignal



  useEffect(() => {
    refreshAvailablePrefixes()
  }, [mode, batchSource, videoFiles])

  const getFilePath = (file: File): string => {
    const api = (window as any).api
    if (api?.webUtils?.getPathForFile) {
      try {
        const p = api.webUtils.getPathForFile(file)
        if (p) return p
      } catch {}
    }
    return (file as any)?.path || ''
  }

  const removeVideoFile = (indexToRemove: number) => {
    const updated = videoFiles.filter((_, i) => i !== indexToRemove)
    setVideoFiles(updated)
    const basenames = updated.map(f => f.split(/[\\/]/).pop() || '')
    setAvailableVideos(basenames)
    setWatermarkedVideos(new Set(basenames))
    setMutedVideos(prev => {
      const next = new Set<string>()
      for (const m of prev) {
        if (basenames.includes(m)) next.add(m)
      }
      return next
    })
  }

  const clearAllVideoFiles = () => {
    setVideoFiles([])
    setAvailableVideos([])
    setMutedVideos(new Set())
    setWatermarkedVideos(new Set())
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (!isDragActive) {
      setIsDragActive(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragActive(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragActive) {
      setIsDragActive(true)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragActive(false)
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    const api = (window as any).api
    const validExts = ['mp4', 'mov', 'avi', 'mkv', 'm4v', 'wmv', 'flv']
    const droppedPaths = Array.from(files).map(f => getFilePath(f)).filter(Boolean) as string[]
    if (droppedPaths.length === 0) return

    // Detect if dropped items are folders (do not have a recognized video file extension)
    const folderPaths = droppedPaths.filter(p => {
      const ext = p.split('.').pop()?.toLowerCase() || ''
      return !validExts.includes(ext)
    })

    // If 2 or more folders are dropped, or in batch mode with dropped folder(s), queue them directly into batch queue!
    if (folderPaths.length > 0 && (mode === 'batch' || folderPaths.length > 1 || droppedPaths.length === folderPaths.length)) {
      if (mode !== 'batch') {
        setMode('batch')
      }
      const existing = batchSources.filter(Boolean)
      const combined = Array.from(new Set([...existing, ...folderPaths]))
      setBatchSources(combined)
      scanVideos(combined)
      showToast({
        title: folderPaths.length > 1 ? `${folderPaths.length} Folders Queued 📂` : 'Folder Queued 📂',
        message: folderPaths.length > 1 ? `Added ${folderPaths.length} folders to batch render queue.` : `Loaded batch folder: ${folderPaths[0]}`,
        type: 'success'
      })
      playSuccess()
      return
    }

    if (mode === 'batch') {
      const existing = batchSources.filter(Boolean)
      const combined = Array.from(new Set([...existing, ...droppedPaths]))
      setBatchSources(combined)
      scanVideos(combined)
      showToast({
        title: droppedPaths.length > 1 ? `${droppedPaths.length} Folders Queued 📂` : 'Folder Queued 📂',
        message: droppedPaths.length > 1 ? `Added ${droppedPaths.length} folders to batch queue.` : `Loaded batch folder: ${droppedPaths[0]}`,
        type: 'success'
      })
      playSuccess()
    } else {
      const allPaths: string[] = []
      const fileList = Array.from(files)

      for (const f of fileList) {
        const filePath = getFilePath(f)
        if (!filePath) continue
        if (isGroupPhotoVideo(filePath)) continue
        const ext = f.name.split('.').pop()?.toLowerCase() || filePath.split('.').pop()?.toLowerCase() || ''
        if (validExts.includes(ext)) {
          allPaths.push(filePath)
        }
      }

      // If no direct videos matched and exactly 1 folder was dropped, scan it
      if (allPaths.length === 0 && fileList.length === 1) {
        const droppedPath = getFilePath(fileList[0])
        if (droppedPath && api?.titleAdder?.listVideos) {
          try {
            const folderVideos: string[] = await api.titleAdder.listVideos(droppedPath)
            if (folderVideos && folderVideos.length > 0) {
              const fullPaths = folderVideos.map(v => {
                return v.includes('/') || v.includes('\\') ? v : `${droppedPath.replace(/[\\/]+$/, '')}/${v}`
              })
              setVideoFiles(prev => Array.from(new Set([...prev, ...fullPaths])))
              const basenames = folderVideos.map(v => v.split(/[\\/]/).pop() || '')
              setAvailableVideos(prev => Array.from(new Set([...prev, ...basenames])))
              setMutedVideos(new Set())
              setWatermarkedVideos(prev => new Set([...prev, ...basenames]))
              showToast({ title: 'Videos Loaded', message: `Found and loaded ${folderVideos.length} videos from folder`, type: 'success' })
              playSuccess()
              if (fullPaths[0]) {
                autoDetectSafarFinal(fullPaths[0])
              }
              return
            }
          } catch (err) {
            console.error('Error scanning dropped folder:', err)
          }
        }
      }

      if (allPaths.length > 0) {
        setVideoFiles(prev => {
          const combined = Array.from(new Set([...prev, ...allPaths]))
          const basenames = combined.map(p => p.split(/[\\/]/).pop() || '')
          setAvailableVideos(basenames)
          setMutedVideos(new Set())
          setWatermarkedVideos(new Set(basenames))
          return combined
        })
        showToast({ title: 'Videos Loaded', message: `Dragged and loaded ${allPaths.length} video file${allPaths.length > 1 ? 's' : ''}`, type: 'success' })
        playSuccess()
        if (allPaths[0]) {
          autoDetectSafarFinal(allPaths[0])
        }
      } else {
        showToast({ title: 'No Videos Found', message: 'Dragged files are not supported video formats (.mp4, .mov, .mkv)', type: 'warning' })
        playError()
      }
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const startX = e.clientX
    const startWidth = controlsWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = panelAlign === 'left'
        ? Math.max(320, Math.min(startWidth + deltaX, 800))
        : Math.max(320, Math.min(startWidth - deltaX, 800))
      setControlsWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
  }

  // Check FFmpeg + detect GPU
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.ffmpeg || !api.titleAdder) return

    api.ffmpeg.check().then((_r: { ok: boolean; message: string }) => {
      setFfmpegOk(true)
    })
    loadSaved()
    const unsubs: any[] = []
    setupListeners(unsubs)

    // Bulletproof: prevent window from navigating when files are dropped outside dropzones
    const resetDrag = () => {
      dragCounter.current = 0
      setIsDragActive(false)
    }

    const preventDefault = (e: DragEvent) => e.preventDefault()
    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        resetDrag()
      }
    }

    window.addEventListener('dragover', preventDefault)
    window.addEventListener('drop', preventDefault)
    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('dragend', resetDrag)
    window.addEventListener('blur', resetDrag)
    window.addEventListener('mouseup', resetDrag)

    return () => {
      unsubs.forEach(un => typeof un === 'function' && un())
      window.removeEventListener('dragover', preventDefault)
      window.removeEventListener('drop', preventDefault)
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('dragend', resetDrag)
      window.removeEventListener('blur', resetDrag)
      window.removeEventListener('mouseup', resetDrag)
    }
  }, [])

  // Auto-refresh video list when window gets focus
  useEffect(() => {
    if (mode !== 'batch' || batchSources.length === 0 || running) return

    const api = (window as any).api
    if (!api || !api.titleAdder || !api.titleAdder.listVideos) return

    const checkRefresh = async () => {
      if (document.hidden) return
      try {
        scanVideos(batchSources)
      } catch {}
    }

    const handleFocus = () => {
      checkRefresh()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [mode, batchSources, running, availableVideos])

  async function loadSaved(): Promise<void> {
    const api = (window as any).api
    if (!api) return
    const all = await api.settings.getAll()
    const storeStateCurrent = titleAdderStore.getState()

    let loadedSources: string[] = []
    const savedSourcesStr = localStorage.getItem('ot_ta_batch_sources')
    if (savedSourcesStr) {
      try {
        const parsed = JSON.parse(savedSourcesStr)
        if (Array.isArray(parsed)) loadedSources = parsed.filter(Boolean)
      } catch {}
    }
    if (loadedSources.length === 0) {
      const src1 = storeStateCurrent.batchSource || localStorage.getItem('ot_ta_batch_source') || (all.remember_paths ? all.last_source_adder : '') || ''
      const src2 = storeStateCurrent.batchSource2 || localStorage.getItem('ot_ta_batch_source_2') || ''
      if (src1) loadedSources.push(src1)
      if (src2) loadedSources.push(src2)
    }

    const out = storeStateCurrent.outputFolder || localStorage.getItem('ot_ta_output_folder') || (all.remember_paths ? all.last_output_adder : '') || ''

    if (loadedSources.length > 0) {
      setBatchSources(loadedSources)
      if (mode === 'batch' && storeStateCurrent.availableVideos.length === 0) {
        if (storeStateCurrent.lastReceivedPayload && storeStateCurrent.lastReceivedPayload.muteExceptions) {
          scanVideosWithExceptions(
            loadedSources,
            storeStateCurrent.lastReceivedPayload.muteExceptions,
            storeStateCurrent.lastReceivedPayload.muteOriginal !== undefined ? storeStateCurrent.lastReceivedPayload.muteOriginal : true
          )
        } else {
          scanVideos(loadedSources)
        }
      }
    }
    if (out) {
      setOutputFolder(out)
    }

    const savedDur = storeStateCurrent.duration || localStorage.getItem('ot_ta_duration') || all.title_duration
    if (savedDur !== undefined && savedDur !== null) {
      setDuration(String(savedDur))
    }

    const savedAudioMode = (all.audio_assignment_mode as string) || 'single'
    const savedAudioIdx = typeof all.audio_single_index === 'number' ? all.audio_single_index : 0
    setAudioAssignMode(savedAudioMode)
    setAudioSingleIdx(savedAudioIdx)

    async function fetchStatus(): Promise<void> {
      try {
        const mode = await api.audio.describeMode()
        const pool = await api.audio.poolInfo()
        const poolStr = typeof pool === 'string' ? pool : (pool?.total ? `Pool: ${pool.total} tracks loaded` : '')
        setStatus(poolStr ? `${mode} · ${poolStr}` : String(mode || ''))
      } catch (e) {
        console.error('Failed to fetch audio status:', e)
      }
    }
    fetchStatus()
  }

  function setupListeners(unsubs: any[]): void {
    const api = (window as any).api
    if (!api || !api.titleAdder) return
    unsubs.push(api.titleAdder.onFound((d: any) => { setTotal(d.total); addLine(`📋 Found ${d.total} videos to process`, 'info') }))
    unsubs.push(api.titleAdder.onProgress((d: any) => {
      setProgress(d.percent ?? 0)
      setStatus(d.status ?? '')
      setFps(d.fps ?? '')
      setSpeed(d.speed ?? '')

      // ETA Calculation
      if (d.status !== lastStatusRef.current) {
        startTimeRef.current = Date.now()
        lastStatusRef.current = d.status
        setEta('Calculating...')
      } else if (d.percent > 1) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const totalEst = elapsed / (d.percent / 100)
        const remaining = totalEst - elapsed
        
        if (remaining > 0) {
          const mins = Math.floor(remaining / 60)
          const secs = Math.round(remaining % 60)
          setEta(`${mins}m ${secs}s`)
        }
      }
    }))
    unsubs.push(api.titleAdder.onLog((d: any) => addLine(d.message, d.level)))
    unsubs.push(api.titleAdder.onVideosDone((d: any) => {
      setDone(d.done)
      if (d.total) setTotal(d.total)
    }))
    unsubs.push(api.titleAdder.onSetBatchSource?.((rawPayload: string) => {
      let targetPath = ''
      let muteExceptions: string[] = []
      let muteOriginalVal = true
      let expectedVideos: string[] = []

      try {
        const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
        if (payload && typeof payload === 'object') {
          targetPath = stripDvdFolderFromPath(payload.path || '')
          muteExceptions = Array.isArray(payload.muteExceptions) ? payload.muteExceptions : []
          if (Array.isArray(payload.expectedVideos)) {
            expectedVideos = payload.expectedVideos.filter((v: string) => !isGroupPhotoVideo(v))
          }
          if (payload.muteOriginal !== undefined) muteOriginalVal = Boolean(payload.muteOriginal)
        } else {
          targetPath = stripDvdFolderFromPath(rawPayload)
        }
      } catch {
        targetPath = stripDvdFolderFromPath(rawPayload)
      }

      if (targetPath) {
        setMode('batch')
        setBatchSource(targetPath)
        setMuteOriginal(muteOriginalVal)
        if (expectedVideos.length > 0) {
          setStoreState({ expectedVideos })
        }

        if (muteExceptions.length > 0) {
          scanVideosWithExceptions(targetPath, muteExceptions, muteOriginalVal, expectedVideos)
        } else {
          scanVideos(targetPath, expectedVideos)
        }

        showToast({
          title: 'Path Received',
          message: expectedVideos.length > 0 
            ? `Successfully loaded ${expectedVideos.length} video(s) from Premiere Pro!`
            : 'Successfully loaded folder from Premiere Pro!',
          type: 'success'
        })
        playSuccess()
      }
    }))
    unsubs.push(api.titleAdder.onDone((d: any) => {
      setRunning(false)
      setProgress(100)
      if (d.total) setTotal(d.total)
      setStatus(d.done > 0 ? 'Completed' : 'Failed')
      setSpeed('—')
      setFps('—')
      setEta('Done')
      if (d.success && d.done > 0) {
        // Clear earlier exported videos in Single / Custom mode so they do not linger
        if (mode === 'single' || videoFiles.length > 0) {
          clearAllVideoFiles()
        }
        if (d.done === d.total) {
          playBatchComplete()
        } else {
          playSuccess()
        }
        const outDir = d.outputFolder || outputFolder
        if (outDir) {
          setLastRenderedOutputDir(outDir)
          sessionStorage.setItem('ot_converter_video_folder', outDir)
          localStorage.setItem('ot_converter_video_target', outDir)
          const apiInst = (window as any).api
          if (apiInst?.settings?.setAndSave) {
            apiInst.settings.setAndSave('converter_video_target', outDir).catch(() => {})
          }
          syncBatchesToConverter(batchSources, outDir, d.batchOutputs)
          window.dispatchEvent(new CustomEvent('refresh-converter-paths', { detail: { outputFolder: outDir, batchOutputs: d.batchOutputs } }))
        }

        // Desktop Notification
        const apiInst = (window as any).api
        if (apiInst?.system?.notify) {
          apiInst.system.notify({
            title: 'Title Adder Batch Complete! 🎬',
            body: `Processed ${d.done}/${d.total} video titles.`
          })
        }

        if (d.done === d.total) {
          confetti({
            particleCount: 160,
            spread: 80,
            origin: { y: 0.6 },
            colors: [meta.accent, '#ffffff', '#ffd700']
          })
          addLine(`\n✔ All ${d.total} videos processed successfully! Output: ${outDir}`, 'info')
          addLine(`🚀 Output folder saved to session. Opening Converter...`, 'info')
          showToast({
            title: 'Batch Complete! 🎉',
            message: `Successfully processed ${d.done} videos to your output folder.`,
            type: 'success',
            badge: '🎬 VIDEO RENDER',
            icon: '🎬',
            action: {
              label: '🚀 Open Converter',
              onClick: () => {
                if (outDir) {
                  sessionStorage.setItem('ot_converter_video_folder', outDir)
                  localStorage.setItem('ot_converter_video_target', outDir)
                  if (apiInst?.settings?.setAndSave) {
                    apiInst.settings.setAndSave('converter_video_target', outDir).catch(() => {})
                  }
                  window.dispatchEvent(new CustomEvent('refresh-converter-paths'))
                }
                if (typeof (window as any).showPage === 'function') {
                  (window as any).showPage('converter')
                } else {
                  window.location.hash = '#/converter'
                }
                setTimeout(() => window.dispatchEvent(new CustomEvent('refresh-converter-paths')), 50)
              }
            }
          })

          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('refresh-converter-paths'))
            if (typeof (window as any).showPage === 'function') {
              (window as any).showPage('converter')
            } else {
              window.location.hash = '#/converter'
            }
            setTimeout(() => window.dispatchEvent(new CustomEvent('refresh-converter-paths')), 50)
          }, 1200)
        } else {
          addLine(`\n⚠ Completed with warnings: ${d.done}/${d.total} videos processed.`, 'warn')
          showToast({
            title: 'Partial Success',
            message: `Processed ${d.done}/${d.total} videos. Click below to proceed to JPG Rename & Move.`,
            type: 'warning',
            action: {
              label: '🚀 JPG Rename & Move',
              onClick: () => {
                if (outDir) {
                  sessionStorage.setItem('ot_converter_video_folder', outDir)
                  localStorage.setItem('ot_converter_video_target', outDir)
                  if (apiInst?.settings?.setAndSave) {
                    apiInst.settings.setAndSave('converter_video_target', outDir).catch(() => {})
                  }
                  window.dispatchEvent(new CustomEvent('refresh-converter-paths'))
                }
                if (typeof (window as any).showPage === 'function') {
                  (window as any).showPage('converter')
                } else {
                  window.location.hash = '#/converter'
                }
                setTimeout(() => window.dispatchEvent(new CustomEvent('refresh-converter-paths')), 50)
              }
            }
          })
        }
      } else {
        playError()
        addLine(`\n✖ Job failed: ${d.done}/${d.total} completed.`, 'error')
        showToast({
          title: 'Render Failed',
          message: `No videos were processed. Check the logs for errors.`,
          type: 'error'
        })
      }
    }))
  }

  async function handleStartClick(): Promise<void> {
    const api = (window as any).api
    if (!api || !api.titleAdder) {
      showToast({ title: 'Error', message: 'Title Adder IPC service is unavailable.', type: 'error' })
      return
    }

    // Path validation check before scanning or opening pre-render setup
    const targetOut = getResolvedOutputDir(batchSource, outputFolder)
    if (!targetOut) {
      showToast({ title: 'Output Path Required', message: 'Please select an output folder before rendering.', type: 'warning' })
      if (api?.dialog?.openFolder) {
        const picked = await api.dialog.openFolder({ title: 'Select Output Destination Folder' })
        if (picked) setOutputFolder(picked)
      }
      return
    }

    const pathCheck = await validatePathOnDisk(targetOut)
    setOutputExists(pathCheck.valid)
    setOutputPathError(pathCheck.reason || null)

    if (!pathCheck.valid) {
      showToast({
        title: 'Output Folder or Drive Not Found',
        message: pathCheck.reason || `The destination path "${targetOut}" does not exist. Please specify a proper path.`,
        type: 'error'
      })
      if (api?.dialog?.openFolder) {
        const picked = await api.dialog.openFolder({ title: 'Select Valid Output Destination Folder' })
        if (picked) {
          setOutputFolder(picked)
          const reCheck = await validatePathOnDisk(getResolvedOutputDir(batchSource, picked))
          setOutputExists(reCheck.valid)
          setOutputPathError(reCheck.reason || null)
          if (!reCheck.valid) return
        } else {
          return
        }
      } else {
        return
      }
    }

    setPreviewLoading(true)
    try {
      const res = await api.titleAdder.previewAudioAssignments({
        mode,
        batchSource: batchSources[0] || '',
        batchSources,
        videoFiles
      })

      if (!res || !res.assignments || res.assignments.length === 0) {
        showToast({ title: 'No Videos Found', message: 'No valid video files found in the target directory.', type: 'error' })
        setPreviewLoading(false)
        return
      }

      setAudioPreviewAssignments(res.assignments)
      setAvailableAudioOptions(res.availableAudio || [])
      setAvailableTitleImageOptions(res.availableTitleImages || [])

      const initAudioMap: Record<string, string> = {}
      const initImageMap: Record<string, string> = {}
      const initMuteMap: Record<string, boolean> = {}

      const stemLookup = (dict: Record<string, any> | undefined, pathStr: string, nameStr: string, stemStr: string) => {
        if (!dict) return undefined
        if (dict[pathStr] !== undefined) return dict[pathStr]
        if (dict[nameStr] !== undefined) return dict[nameStr]
        if (dict[stemStr] !== undefined) return dict[stemStr]
        for (const [k, v] of Object.entries(dict)) {
          if (getCanonicalStem(k) === stemStr) return v
        }
        return undefined
      }

      res.assignments.forEach((item: any) => {
        const canonical = getCanonicalStem(item.videoName)
        const customAudio = stemLookup(userAudioSelections, item.videoPath, item.videoName, canonical)
          ?? stemLookup(storeState.predefinedAudioTracks, item.videoPath, item.videoName, canonical)
        initAudioMap[item.videoPath] = customAudio || item.defaultAudioPath

        const customImg = stemLookup(userTitleImageSelections, item.videoPath, item.videoName, canonical)
          ?? stemLookup(storeState.predefinedTitleImages, item.videoPath, item.videoName, canonical)
        initImageMap[item.videoPath] = customImg || item.defaultTitleImagePath

        const customMute = stemLookup(userMuteSelections, item.videoPath, item.videoName, canonical)
          ?? stemLookup(storeState.predefinedVideoMutes, item.videoPath, item.videoName, canonical)

        if (customMute !== undefined) {
          initMuteMap[item.videoPath] = customMute
        } else {
          const videoFilename = item.videoName.toLowerCase()
          const isMuteExcluded = availableVideos.length > 0 && availableVideos.filter(f => {
            const lowerF = f.toLowerCase()
            return !Array.from(mutedVideos).some(m => m.toLowerCase() === lowerF)
          }).some(ex => ex.toLowerCase() === videoFilename || getCanonicalStem(ex) === canonical)

          initMuteMap[item.videoPath] = item.isSpecialWaazId ? false : (muteOriginal && !isMuteExcluded)
        }
      })

      setUserAudioSelections(initAudioMap)
      setUserTitleImageSelections(initImageMap)
      setUserMuteSelections(initMuteMap)
      if (watermarkedVideos.size === 0 && res.assignments.length > 0) {
        setWatermarkedVideos(new Set(res.assignments.map((a: any) => a.videoName)))
      }
      setIsAudioModalOpen(true)
    } catch (err: any) {
      console.error('Failed to preview audio assignments:', err)
      showToast({ title: 'Preview Error', message: err?.message || 'Failed to scan videos for audio assignments.', type: 'error' })
    } finally {
      setPreviewLoading(false)
    }
  }

  async function startJob(overrides?: {
    customAssignments?: Record<string, string>
    audioAssignments?: Record<string, string>
    titleImageAssignments?: Record<string, string>
    videoMuteSelections?: Record<string, boolean>
    availableVideos?: string[]
    mutedVideos?: Set<string>
    watermarkedVideos?: Set<string>
    batchSource?: string
    thumbnailMode?: ThumbnailMode
    thumbnailModeSelections?: Record<string, ThumbnailMode>
  } | Record<string, string>): Promise<void> {
    const api = (window as any).api
    if (!api) return

    const currentStore = titleAdderStore.getState()
    const isCustomMap = overrides && typeof overrides === 'object' && !('customAssignments' in overrides) && !('availableVideos' in overrides) && !('titleImageAssignments' in overrides) && !('videoMuteSelections' in overrides)
    const effectiveSources = (opts.batchSources && opts.batchSources.length > 0) ? opts.batchSources : batchSources
    const effectiveSource = opts.batchSource || effectiveSources[0] || currentStore.batchSource || batchSource
    const effectiveThumbMode = opts.thumbnailMode || thumbnailMode
    const effectiveThumbSelections = opts.thumbnailModeSelections || userThumbnailModeSelections

    // Path validation check before initiating rendering
    const targetOut = getResolvedOutputDir(effectiveSource, outputFolder)
    const check = await validatePathOnDisk(targetOut)
    setOutputExists(check.valid)
    setOutputPathError(check.reason || null)
    if (!check.valid) {
      showToast({
        title: 'Destination Path Not Found',
        message: check.reason || 'The final folder drive or path given does not exist. Please specify a valid folder path.',
        type: 'error'
      })
      if (api?.dialog?.openFolder) {
        const picked = await api.dialog.openFolder({ title: 'Select Valid Output Folder' })
        if (picked) {
          setOutputFolder(picked)
          showToast({ title: 'Output Path Updated', message: `Target set to: ${picked}`, type: 'info' })
        }
      }
      return
    }

    const vids = opts.availableVideos || currentStore.availableVideos || availableVideos
    const effectiveMuted = opts.mutedVideos || new Set(currentStore.mutedVideos || mutedVideos)
    const effectiveWatermarked = opts.watermarkedVideos || new Set(currentStore.watermarkedVideos || watermarkedVideos)
    const effectiveAudio = opts.customAssignments || opts.audioAssignments || currentStore.userAudioSelections || userAudioSelections
    const effectiveImages = opts.titleImageAssignments || currentStore.userTitleImageSelections || userTitleImageSelections
    const effectiveMuteSelections = opts.videoMuteSelections || currentStore.userMuteSelections || userMuteSelections

    const dur = parseFloat(duration) || 5
    setRunning(true)
    setCancelled(false)
    setProgress(0)
    setDone(0)
    setTotal(0)
    setStatus('Initializing...')
    setSpeed('')
    setFps('')
    setEta('')
    clear()
    jobIdRef.current = `job_${Date.now()}`

    // Save paths and duration
    if (mode === 'batch' && effectiveSource) api.settings.setAndSave('last_source_adder', effectiveSource)
    api.settings.setAndSave('last_output_adder', outputFolder)
    api.settings.setAndSave('title_duration', dur)

    await api.titleAdder.start({
      mode,
      batchSource: effectiveSource,
      batchSources: effectiveSources,
      videoFiles,
      outputFolder,
      duration: dur,
      jobId: jobIdRef.current, 
      addToStats: addToStats,
      muteOriginal: muteOriginal,
      muteExceptions: vids.filter(f => {
        const lowerF = f.toLowerCase()
        return !Array.from(effectiveMuted).some(m => (m as string).toLowerCase() === lowerF)
      }),
      watermarkExceptions: vids.filter(f => {
        const lowerF = f.toLowerCase()
        return !Array.from(effectiveWatermarked).some(w => (w as string).toLowerCase() === lowerF)
      }),
      audioAssignments: effectiveAudio,
      titleImageAssignments: effectiveImages,
      videoMuteSelections: effectiveMuteSelections,
      thumbnailMode: effectiveThumbMode,
      thumbnailModeSelections: effectiveThumbSelections
    })
  }

  function handleCancel(): void {
    const api = (window as any).api
    // Straight away cancel: immediately update UI state and kill process tree
    setRunning(false)
    setCancelled(true)
    setStatus('Job Cancelled')
    setSpeed('')
    setFps('')
    setEta('')
    if (api?.titleAdder?.cancel) {
      api.titleAdder.cancel(jobIdRef.current)
    }
    addLine('⛔ Job cancelled immediately by user.', 'warn')
    showToast({
      title: 'Render Cancelled',
      message: 'Processing was immediately cancelled.',
      type: 'info'
    })
  }

  const showSecondBatchFolder = batchSources.length > 1
  const setShowSecondBatchFolder = (_val: boolean) => {}

  async function browseSource(): Promise<void> {
    const api = (window as any).api
    if (!api) return
    if (mode === 'batch') {
      const p = await api.dialog.openFolder({ title: 'Select Source Folder' })
      if (p) {
        setBatchSource(p)
        scanVideos(p)
      }
    } else {
      const files = await api.dialog.openFiles({ title: 'Select Video Files', filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'm4v'] }] })
      if (files?.length) {
        const validFiles = files.filter(f => !isGroupPhotoVideo(f))
        if (validFiles.length) {
          setVideoFiles(prev => {
            const combined = Array.from(new Set([...prev, ...validFiles]))
            const basenames = combined.map(f => f.split(/[\\/]/).pop() || '')
            setAvailableVideos(basenames)
            setMutedVideos(new Set())
            setWatermarkedVideos(new Set(basenames))
            return combined
          })
          showToast({ title: 'Videos Selected', message: `Loaded ${validFiles.length} video file${validFiles.length > 1 ? 's' : ''}`, type: 'success' })
          playSuccess()
          if (validFiles[0]) {
            autoDetectSafarFinal(validFiles[0])
          }
        } else {
          showToast({ title: 'Group Photo Skipped', message: 'Group photo videos are skipped and not rendered by Title Adder.', type: 'info' })
        }
      }
    }
  }

  async function browseSource2(): Promise<void> {
    await addBatchFolder()
  }

  function removeSource2(): void {
    if (batchSources.length > 1) {
      removeBatchFolder(1)
    }
  }

  async function scanVideos(root?: string | string[], expectedFilter?: string[], root2?: string) {
    const api = (window as any).api
    if (!api) return

    let sourceList: string[] = []
    if (Array.isArray(root)) {
      sourceList = root.filter(Boolean)
    } else if (root !== undefined) {
      sourceList = [root, root2 || ''].filter(Boolean)
    } else {
      sourceList = (batchSources && batchSources.length > 0 ? batchSources : [batchSource, root2 || '']).filter(Boolean)
    }

    let list: string[] = []
    const seen = new Set<string>()

    for (const src of sourceList) {
      if (!src) continue
      try {
        const raw = await api.titleAdder.listVideos(src)
        const folderVids = (raw || []).filter((f: string) => !isGroupPhotoVideo(f)).sort()
        for (const f of folderVids) {
          if (!seen.has(f.toLowerCase())) {
            seen.add(f.toLowerCase())
            list.push(f)
          }
        }
      } catch {}
    }

    const exp = (expectedFilter && expectedFilter.length > 0) ? expectedFilter : (titleAdderStore.getState().expectedVideos || [])
    if (exp && exp.length > 0) {
      const expSet = new Set(exp.map((e: string) => getCanonicalStem(e)))
      const filtered = list.filter((f: string) => expSet.has(getCanonicalStem(f)))
      if (filtered.length > 0) {
        list = filtered
      }
    }
    const prevAvailable = [...availableVideos]
    setAvailableVideos(list)

    setMutedVideos(prev => {
      const next = new Set<string>()
      const prevArr = Array.from(prev)
      for (const f of list) {
        const stem = getCanonicalStem(f)
        const match = prevArr.find(p => getCanonicalStem(p) === stem)
        if (match !== undefined) {
          next.add(f)
        } else {
          const wasAvailable = prevAvailable.some(a => getCanonicalStem(a) === stem)
          if (!wasAvailable && muteOriginal && !isVideoMuteExcluded(f, [])) {
            next.add(f)
          }
        }
      }
      return next
    })

    setWatermarkedVideos(prev => {
      const next = new Set<string>()
      const prevArr = Array.from(prev)
      for (const f of list) {
        const stem = getCanonicalStem(f)
        const match = prevArr.find(p => getCanonicalStem(p) === stem)
        if (match !== undefined) {
          next.add(f)
        } else {
          const wasAvailable = prevAvailable.some(a => getCanonicalStem(a) === stem)
          if (!wasAvailable) {
            next.add(f)
          }
        }
      }
      return next
    })
  }

  async function scanVideosWithExceptions(root?: string | string[], exceptions: string[] = [], muteOrig: boolean = true, expectedFilter?: string[], root2?: string) {
    const api = (window as any).api
    if (!api) return

    let sourceList: string[] = []
    if (Array.isArray(root)) {
      sourceList = root.filter(Boolean)
    } else if (root !== undefined) {
      sourceList = [root, root2 || ''].filter(Boolean)
    } else {
      sourceList = (batchSources && batchSources.length > 0 ? batchSources : [batchSource, root2 || '']).filter(Boolean)
    }

    let list: string[] = []
    const seen = new Set<string>()

    for (const src of sourceList) {
      if (!src) continue
      try {
        const raw = await api.titleAdder.listVideos(src)
        const folderVids = (raw || []).filter((f: string) => !isGroupPhotoVideo(f)).sort()
        for (const f of folderVids) {
          if (!seen.has(f.toLowerCase())) {
            seen.add(f.toLowerCase())
            list.push(f)
          }
        }
      } catch {}
    }

    const exp = (expectedFilter && expectedFilter.length > 0) ? expectedFilter : (titleAdderStore.getState().expectedVideos || [])
    if (exp && exp.length > 0) {
      const expSet = new Set(exp.map((e: string) => getCanonicalStem(e)))
      const filtered = list.filter((f: string) => expSet.has(getCanonicalStem(f)))
      if (filtered.length > 0) {
        list = filtered
      }
    }
    const prevAvailable = [...availableVideos]
    setAvailableVideos(list)

    setMutedVideos(prev => {
      const next = new Set<string>()
      const prevArr = Array.from(prev)
      for (const f of list) {
        const stem = getCanonicalStem(f)
        const match = prevArr.find(p => getCanonicalStem(p) === stem)
        if (match !== undefined) {
          next.add(f)
        } else {
          const wasAvailable = prevAvailable.some(a => getCanonicalStem(a) === stem)
          if (!wasAvailable && muteOrig && !isVideoMuteExcluded(f, exceptions)) {
            next.add(f)
          }
        }
      }
      return next
    })

    setWatermarkedVideos(prev => {
      const next = new Set<string>()
      const prevArr = Array.from(prev)
      for (const f of list) {
        const stem = getCanonicalStem(f)
        const match = prevArr.find(p => getCanonicalStem(p) === stem)
        if (match !== undefined) {
          next.add(f)
        } else {
          const wasAvailable = prevAvailable.some(a => getCanonicalStem(a) === stem)
          if (!wasAvailable) {
            next.add(f)
          }
        }
      }
      return next
    })
  }

  const handleAddKeyword = () => {
    const kw = newKeywordInput.trim().toUpperCase()
    if (!kw) return
    const current = storeState.alwaysKeepOgAudioKeywords || []
    if (!current.includes(kw)) {
      const updated = [...current, kw]
      setStoreState({ alwaysKeepOgAudioKeywords: updated })
      const api = (window as any).api
      if (api?.titleAutomode?.saveSettings) {
        api.titleAutomode.saveSettings({ alwaysKeepOgAudioKeywords: updated })
      }
      showToast({ title: 'Rule Added', message: `Added keyword rule: ${kw}`, type: 'success' })
    }
    setNewKeywordInput('')
  }

  const handleRemoveKeyword = (kwToRemove: string) => {
    const current = storeState.alwaysKeepOgAudioKeywords || []
    const updated = current.filter(k => k !== kwToRemove)
    setStoreState({ alwaysKeepOgAudioKeywords: updated })
    const api = (window as any).api
    if (api?.titleAutomode?.saveSettings) {
      api.titleAutomode.saveSettings({ alwaysKeepOgAudioKeywords: updated })
    }
  }

  const handleAddPredefineVideo = () => {
    const v = newVideoInput.trim()
    if (!v) return
    const current = storeState.expectedVideos || []
    if (!current.includes(v)) {
      const updated = [...current, v]
      setStoreState({ expectedVideos: updated })
      showToast({ title: 'Video Added', message: `Added video to predefine list: ${v}`, type: 'info' })
    }
    setNewVideoInput('')
  }

  const handleRemovePredefineVideo = (vToRemove: string) => {
    const current = storeState.expectedVideos || []
    const updated = current.filter(v => v !== vToRemove)
    const mutes = { ...(storeState.predefinedVideoMutes || {}) }
    delete mutes[vToRemove]
    delete mutes[getCanonicalStem(vToRemove)]
    setStoreState({ expectedVideos: updated, predefinedVideoMutes: mutes })
  }

  const handleTogglePredefinedMute = (videoName: string) => {
    const stem = getCanonicalStem(videoName)
    const currentMutes = { ...(storeState.predefinedVideoMutes || {}) }
    const currentlyKept = isVideoMuteExcluded(videoName, [])
    // If currently kept (OG audio), switch to muted (true). If currently muted, switch to keep OG audio (false).
    currentMutes[videoName] = currentlyKept
    currentMutes[stem] = currentlyKept
    setStoreState({ predefinedVideoMutes: currentMutes })
    const api = (window as any).api
    if (api?.titleAutomode?.saveSettings) {
      api.titleAutomode.saveSettings({ predefinedVideoMutes: currentMutes })
    }

    // Also update current state if videos are already loaded
    const isMutedNow = currentlyKept
    setMutedVideos(prev => {
      const next = new Set(prev)
      for (const av of availableVideos) {
        if (getCanonicalStem(av) === stem || av === videoName) {
          if (isMutedNow) next.add(av)
          else next.delete(av)
        }
      }
      return next
    })
  }

  const handleSavePredefinedSettings = async () => {
    const api = (window as any).api
    if (api?.titleAutomode?.saveSettings) {
      await api.titleAutomode.saveSettings({
        autoStartOnEncoderSignal: storeState.autoStartOnEncoderSignal,
        alwaysKeepOgAudioKeywords: storeState.alwaysKeepOgAudioKeywords,
        predefinedVideoMutes: storeState.predefinedVideoMutes,
        predefinedAudioTracks: storeState.predefinedAudioTracks,
        predefinedTitleImages: storeState.predefinedTitleImages,
        predefinedRenames: storeState.predefinedRenames,
        expectedVideos: storeState.expectedVideos
      })
    }
    setIsPredefineModalOpen(false)
    showToast({
      title: 'Settings Saved',
      message: 'Predefined audio rules and automode settings saved successfully.',
      type: 'success'
    })
    playSuccess()
  }

  return (
    <div 
      className={`ta-page ${isDragActive ? 'ta-page--drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragActive && (
        <div className="ta-drag-overlay ta-drag-overlay--page">
          <div className="ta-drag-overlay-content">
            <span className="ta-drag-icon">📂</span>
            <p className="ta-drag-text">
              Drop one or more folders to queue for batch rendering
            </p>
          </div>
        </div>
      )}


      {running && (
        <div className="ta-running-header-strip anim-scale-in">
          <div className="ta-running-meta">
            <span className="ta-pulse-indicator" />
            <div className="ta-running-meta-text">
              <span className="ta-running-title">Encoding in progress…</span>
              <span className="ta-running-details">
                {status || 'Rendering'} {speed ? `· Speed ${speed}` : ''} {fps ? `· ${fps} fps` : ''} {eta ? `· ETA ${eta}` : ''}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="ta-instant-cancel-btn"
            onClick={handleCancel}
            title="Immediately stop and cancel all rendering"
          >
            <span className="ta-cancel-icon">⛔</span>
            <span>Stop & Cancel Immediately</span>
          </button>
        </div>
      )}

      {done > 0 && !running && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '12px',
          maxWidth: '860px',
          width: '100%',
          margin: '0 auto 12px auto',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>🎉</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>
                Video Rendering Finished ({done} videos rendered)!
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                Output directory saved. Proceed to JPG Rename & Move to align photo thumbnails.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                const targetDir = lastRenderedOutputDir || outputFolder
                if (targetDir) {
                  sessionStorage.setItem('ot_converter_video_folder', targetDir)
                  localStorage.setItem('ot_converter_video_target', targetDir)
                  const apiInst = (window as any).api
                  if (apiInst?.settings?.setAndSave) {
                    apiInst.settings.setAndSave('converter_video_target', targetDir).catch(() => {})
                  }
                  window.dispatchEvent(new CustomEvent('refresh-converter-paths'))
                }
                if (typeof (window as any).showPage === 'function') {
                  (window as any).showPage('converter')
                } else {
                  window.location.hash = '#/converter'
                }
                setTimeout(() => window.dispatchEvent(new CustomEvent('refresh-converter-paths')), 50)
              }}
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
              }}
            >
              🚀 Proceed to JPG Rename & Move ➜
            </button>
            <button
              type="button"
              onClick={() => (window as any).api?.shell?.openFolder(lastRenderedOutputDir || outputFolder)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '7px 12px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📂 Open Folder
            </button>
          </div>
        </div>
      )}

      <div 
        className="ta-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '860px',
          margin: '0 auto',
          gap: '14px',
          flex: 1,
          minHeight: 0
        }}
      >
        {/* Centered Ergonomic Workstation Controls */}
        <div className="ta-left" style={{ width: '100%', maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Audio mode strip with Dynamic Status Pills & Action Controls */}
          <div className="ta-audio-strip anim-scale-in">
            <div className="ta-audio-strip-top">
              <div className="ta-audio-info">
                <span className="ta-audio-icon">🎵</span>
                <div>
                  <p className="ta-audio-mode">Audio: {status.split('·')[0] || 'Loading…'}</p>
                  <p className="ta-audio-pool">{status.includes('·') ? status.split('·')[1] : '—'}</p>
                </div>
              </div>

              {/* Dynamic Status Pills for Videos: Found, Completed, Pending & Progress */}
              <div className="ta-dynamic-status-pills">
                <div className="ta-pill ta-pill-found" title="Total videos detected in selected source">
                  <span className="ta-pill-dot found" />
                  <span className="ta-pill-label">Found:</span>
                  <span className="ta-pill-val">{totalVideosFound > 0 ? totalVideosFound : '—'}</span>
                </div>
                <div className="ta-pill ta-pill-done" title="Videos successfully processed">
                  <span className="ta-pill-dot done" />
                  <span className="ta-pill-label">Completed:</span>
                  <span className="ta-pill-val">{completedCount}</span>
                </div>
                <div className="ta-pill ta-pill-pending" title="Videos pending processing">
                  <span className="ta-pill-dot pending" />
                  <span className="ta-pill-label">Pending:</span>
                  <span className="ta-pill-val">{totalVideosFound > 0 ? pendingCount : '—'}</span>
                </div>
                {running && (
                  <div className="ta-pill ta-pill-running" title="Live processing progress">
                    <span className="ta-logs-pulse-dot" />
                    <span className="ta-pill-label">{Math.round(progress)}%</span>
                    {speed && <span className="ta-pill-sub">({speed})</span>}
                    {eta && <span className="ta-pill-sub">ETA: {eta}</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="ta-audio-strip-actions">
              <Button
                size="sm"
                onClick={() => setIsPredefineModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                }}
              >
                <span>⚙️</span> Predefine Audio & Rules
                {storeState.alwaysKeepOgAudioKeywords && storeState.alwaysKeepOgAudioKeywords.length > 0 && (
                  <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '10px', fontSize: '10px' }}>
                    {storeState.alwaysKeepOgAudioKeywords.length}
                  </span>
                )}
              </Button>
              <button
                type="button"
                className={`ta-logs-pill-btn ${isLogsPopupOpen ? 'active' : ''}`}
                onClick={() => setIsLogsPopupOpen(true)}
                title="Click to open execution logs popup"
              >
                <span>📜 Logs</span>
                {lines.length > 0 && <span className="ta-logs-pill-count">{lines.length}</span>}
                {running && <span className="ta-logs-pulse-dot" style={{ width: '6px', height: '6px' }} />}
              </button>
              <GhostButton size="sm" onClick={() => (window as any).showPage('settings')}>⚙ Configure</GhostButton>
            </div>
          </div>

              {/* Segmented Mode Switcher Bar */}
              <div className="ta-mode-segmented-bar anim-scale-in">
                <div className="ta-mode-segmented-tabs">
                  <button
                    type="button"
                    className={`ta-mode-segment-btn ${mode === 'batch' ? 'active' : ''}`}
                    onClick={() => setMode('batch')}
                  >
                    <span className="ta-mode-tab-icon">📂</span>
                    <span className="ta-mode-tab-title">Batch Folders Queue</span>
                    {batchSources.filter(Boolean).length > 0 && (
                      <span className="ta-mode-count-badge">{batchSources.filter(Boolean).length}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`ta-mode-segment-btn ${mode === 'single' ? 'active' : ''}`}
                    onClick={() => setMode('single')}
                  >
                    <span className="ta-mode-tab-icon">🎞</span>
                    <span className="ta-mode-tab-title">Single / Custom Files</span>
                    {videoFiles.length > 0 && (
                      <span className="ta-mode-count-badge">{videoFiles.length}</span>
                    )}
                  </button>
                </div>
                <div className="ta-mode-bar-status">
                  <StatusChip
                    label={cancelled ? 'Job Cancelled' : running ? 'Processing Queue…' : 'Workstation Ready'}
                    variant={cancelled ? 'danger' : running ? 'warning' : 'muted'}
                  />
                </div>
              </div>

              {/* Source Workstation Card */}
              <div className="ta-workstation-card anim-scale-in">
                <div className="ta-ws-card-header">
                  <div className="ta-ws-card-title-group">
                    <div className="ta-ws-card-icon-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                      {mode === 'batch' ? '📁' : '🎬'}
                    </div>
                    <div>
                      <h3 className="ta-ws-card-title">
                        {mode === 'batch' ? 'Batch Folder Queue' : 'Custom Video Files'}
                      </h3>
                      <p className="ta-ws-card-sub">
                        {mode === 'batch'
                          ? (batchSources.filter(Boolean).length > 1
                              ? `Folders are processed sequentially in the exact priority order below (#1 first, #2 second, etc.)`
                              : `Add one or more event folders to process. Each folder's DVD subfolder is auto-detected.`)
                          : `Drag & drop individual videos or an entire folder to process custom files.`}
                      </p>
                    </div>
                  </div>
                  {mode === 'batch' && (
                    <div className="ta-ws-card-actions">
                      <button
                        type="button"
                        className="ta-add-queue-folder-btn"
                        onClick={addBatchFolder}
                        title="Add another source folder to the batch queue"
                      >
                        <span>➕</span> Add Folder to Queue
                      </button>
                    </div>
                  )}
                </div>

                <div className="ta-ws-card-body">
                  {mode === 'batch' ? (
                    batchSources.length === 0 || (batchSources.length === 1 && !batchSources[0]) ? (
                      <div
                        className={`ta-queue-empty-dropzone ${isDragActive ? 'active' : ''}`}
                        onClick={() => changeBatchFolder(0)}
                      >
                        <div className="ta-empty-icon">📁</div>
                        <div className="ta-empty-text">No Batch Folders Selected</div>
                        <div className="ta-empty-sub">Click to browse or drag & drop one or more event folders here</div>
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); changeBatchFolder(0); }} style={{ marginTop: '8px' }}>
                          📂 Choose Primary Folder
                        </Button>
                      </div>
                    ) : (
                      <div className="ta-queue-list">
                        {batchSources.map((src, idx) => {
                          const folderName = src ? (src.split(/[\\/]/).filter(Boolean).pop() || src) : 'Click to select folder...'
                          const isFirst = idx === 0
                          const isLast = idx === batchSources.length - 1
                          return (
                            <div key={`${src}_${idx}`} className={`ta-queue-item ${!src ? 'empty' : ''}`}>
                              {/* Order Indicator & Up/Down reorder controls */}
                              <div className="ta-queue-item-order">
                                <div className={`ta-order-pill ${isFirst ? 'primary' : ''}`}>
                                  <span className="ta-order-num">#{idx + 1}</span>
                                  <span className="ta-order-label">{isFirst ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`}</span>
                                </div>
                                {batchSources.length > 1 && (
                                  <div className="ta-reorder-btn-group">
                                    <button
                                      type="button"
                                      className="ta-reorder-btn"
                                      disabled={isFirst}
                                      onClick={() => moveBatchFolderUp(idx)}
                                      title="Move up (process earlier in queue)"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      className="ta-reorder-btn"
                                      disabled={isLast}
                                      onClick={() => moveBatchFolderDown(idx)}
                                      title="Move down (process later in queue)"
                                    >
                                      ▼
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Folder Details */}
                              <div className="ta-queue-item-content" onClick={() => changeBatchFolder(idx)} title={src ? `Path: ${src}\nClick to browse / change` : 'Click to select folder'}>
                                <div className="ta-queue-folder-icon">📂</div>
                                <div className="ta-queue-folder-meta">
                                  <span className="ta-queue-folder-name">{folderName}</span>
                                  <span className="ta-queue-folder-path">{src || 'No folder chosen (Click Browse to select)'}</span>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="ta-queue-item-actions">
                                <button
                                  type="button"
                                  className="ta-queue-action-btn browse"
                                  onClick={() => changeBatchFolder(idx)}
                                  title="Browse another folder for this position"
                                >
                                  📂 Browse
                                </button>
                                {batchSources.length > 1 && (
                                  <button
                                    type="button"
                                    className="ta-queue-action-btn remove"
                                    onClick={() => removeBatchFolder(idx)}
                                    title="Remove this folder from queue"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  ) : (
                    <div className="ta-single-dropzone-container">
                      <div 
                        className={`ta-dropzone-box ${videoFiles.length > 0 ? 'ta-dropzone-box--compact' : ''} ${isDragActive ? 'ta-dropzone-box--active' : ''}`}
                        onClick={browseSource}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') browseSource() }}
                      >
                        <div className="ta-dropzone-icon">{videoFiles.length > 0 ? '➕' : '🎬'}</div>
                        <div className="ta-dropzone-title">{videoFiles.length > 0 ? 'Add more videos (Click or Drop)' : 'Click to Browse or Drag & Drop Video Files'}</div>
                        {videoFiles.length === 0 && (
                          <div className="ta-dropzone-sub">Supports MP4, MOV, MKV, AVI. You can drop individual videos or an entire folder.</div>
                        )}
                      </div>

                      {videoFiles.length > 0 && (
                        <div className="ta-single-loaded-card">
                          <div className="ta-single-loaded-header">
                            <span>Loaded Videos ({videoFiles.length})</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="ta-file-remove-btn"
                                onClick={browseSource}
                                title="Add more videos"
                                style={{ fontWeight: 600, color: 'var(--accent-adder)' }}
                              >
                                + Add More
                              </button>
                              <button
                                type="button"
                                className="ta-file-remove-btn"
                                onClick={clearAllVideoFiles}
                                title="Clear all videos"
                                style={{ fontWeight: 600, color: 'var(--danger)' }}
                              >
                                Clear All
                              </button>
                            </div>
                          </div>
                          <div className="ta-file-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                            {videoFiles.map((f, idx) => {
                              const name = f.split(/[\\/]/).pop() || ''
                              const prefix = getPrefix(name.replace(/\.[^/.]+$/, ""))
                              const isMissing = prefix && !availablePrefixes.includes(prefix.toLowerCase())
                              return (
                                <div 
                                  key={`${f}_${idx}`} 
                                  className="ta-file-row" 
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between', 
                                    gap: '8px',
                                    padding: '4px 6px'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>#{idx + 1}</span>
                                    <span className="truncate" title={f}>{name}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    {isMissing && (
                                      <span 
                                        className="ta-missing-badge"
                                        title={`No matching prefix image/audio found inside titles folder for prefix '${prefix}'`}
                                      >
                                        ⚠️ Missing Title
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      className="ta-file-remove-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        removeVideoFile(idx)
                                      }}
                                      title="Remove this video"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Output Destination Card */}
              <div className="ta-workstation-card anim-scale-in" style={{ marginTop: '12px' }}>
                <div className="ta-ws-card-header compact">
                  <div className="ta-ws-card-title-group">
                    <div className="ta-ws-card-icon-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                      🎯
                    </div>
                    <div>
                      <h3 className="ta-ws-card-title">Output Destination</h3>
                      <p className="ta-ws-card-sub">
                        {mode === 'batch' 
                          ? 'Each folder’s videos will automatically be saved into its own date-named output folder' 
                          : 'Destination directory where processed videos will be saved'}
                      </p>
                    </div>
                  </div>

                  {mode === 'single' && safarFinalInfo && (
                    <div className="ta-safar-badge-wrap">
                      <span
                        className="ta-safar-pill"
                        title={`Safar: ${safarFinalInfo.safarName || 'Detected'}\nTarget: ${safarFinalInfo.targetPath}`}
                      >
                        <span>🎯 Safar: Final\{safarFinalInfo.dateFolder}</span>
                        {safarFinalInfo.dateFolderExistsInFinal && <span className="ta-verified-tick">✓</span>}
                      </span>
                      {outputFolder !== safarFinalInfo.targetPath && (
                        <button
                          type="button"
                          className="ta-safar-reset-btn"
                          onClick={async () => {
                            setOutputFolder(safarFinalInfo.targetPath)
                            const check = await validatePathOnDisk(safarFinalInfo.targetPath)
                            setOutputExists(check.valid)
                            setOutputPathError(check.reason || null)
                          }}
                        >
                          ↺ Reset
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="ta-ws-card-body" style={{ paddingTop: '8px' }}>
                  <BrowseRow
                    value={outputFolder}
                    placeholder="Where to save processed videos…"
                    accent={meta.accent}
                    onBrowse={async () => {
                      const api = (window as any).api
                      if (!api) return
                      const p = await api.dialog.openFolder()
                      if (p) {
                        setOutputFolder(p)
                        const check = await validatePathOnDisk(getResolvedOutputDir(batchSource, p))
                        setOutputExists(check.valid)
                        setOutputPathError(check.reason || null)
                      }
                    }}
                    onChange={(val) => {
                      setOutputFolder(val)
                      if (val) {
                        validatePathOnDisk(getResolvedOutputDir(batchSource, val)).then(check => {
                          setOutputExists(check.valid)
                          setOutputPathError(check.reason || null)
                        })
                      }
                    }}
                  />
                  {outputExists === false && (
                    <div className="ta-output-path-warning anim-scale-in">
                      ⚠️ Destination folder drive or path does not exist on disk! Please select a valid folder.
                    </div>
                  )}
                </div>
              </div>

              {/* Render Command Bar: Duration + Start CTA */}
              <div className="ta-render-command-bar anim-scale-in" style={{ marginTop: '12px' }}>
                <div className="ta-dur-field">
                  <label className="ta-field-label">
                    <span>⏱ Intro/Outro Duration</span>
                    <span className="ta-field-unit">{duration}s</span>
                  </label>
                  <div className="ta-dur-input-wrap">
                    <input
                      type="number"
                      className="ta-dur-input"
                      value={duration}
                      min={1}
                      max={30}
                      step={0.5}
                      onChange={e => {
                        setDuration(e.target.value)
                        const api = (window as any).api
                        if (api) {
                          api.settings.setAndSave('title_duration', parseFloat(e.target.value) || 3)
                        }
                      }}
                    />
                    <span className="ta-dur-suffix">seconds</span>
                  </div>
                </div>

                <div className="ta-start-field">
                  {running ? (
                    <button
                      type="button"
                      className="ta-hero-cancel-btn"
                      onClick={handleCancel}
                    >
                      <span className="ta-hero-btn-icon">⛔</span>
                      <span className="ta-hero-btn-text">Cancel Render Queue</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ta-hero-start-btn"
                      onClick={handleStartClick}
                      disabled={previewLoading || (!batchSource && videoFiles.length === 0) || !outputFolder}
                    >
                      <span className="ta-hero-btn-icon">{previewLoading ? '⌛' : '▶'}</span>
                      <span className="ta-hero-btn-text">
                        {previewLoading
                          ? 'Analyzing Assets...'
                          : totalVideosFound > 0
                          ? `Start Render (${totalVideosFound} Videos)`
                          : 'Start Batch Render'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3-Tile Options Switch Grid */}
              <div className="ta-options-grid anim-scale-in" style={{ marginTop: '12px' }}>
                {/* Option 1: Stats */}
                <div
                  className={`ta-option-card ${addToStats ? 'active' : ''}`}
                  onClick={() => setAddToStats(!addToStats)}
                >
                  <div className="ta-opt-top">
                    <div className="ta-opt-title-wrap">
                      <span className="ta-opt-icon">📊</span>
                      <span className="ta-opt-title">Add to Stats</span>
                    </div>
                    <div className={`ta-switch ${addToStats ? 'on' : ''}`}>
                      <span className="ta-switch-handle" />
                    </div>
                  </div>
                  <div className="ta-opt-bottom">
                    <span className="ta-opt-desc">Log render counts & history in Analytics</span>
                  </div>
                </div>

                {/* Option 2: Mute Original */}
                <div
                  className={`ta-option-card danger ${muteOriginal ? 'active' : ''}`}
                  onClick={() => {
                    const next = !muteOriginal
                    setMuteOriginal(next)
                    if (next) {
                      setMutedVideos(new Set(availableVideos))
                    } else {
                      setMutedVideos(new Set())
                    }
                  }}
                >
                  <div className="ta-opt-top">
                    <div className="ta-opt-title-wrap">
                      <span className="ta-opt-icon">🔇</span>
                      <span className="ta-opt-title">Mute Original Audio</span>
                    </div>
                    <div
                      className={`ta-switch danger ${muteOriginal ? 'on' : ''}`}
                      onClick={e => {
                        e.stopPropagation()
                        const next = !muteOriginal
                        setMuteOriginal(next)
                        if (next) {
                          setMutedVideos(new Set(availableVideos))
                        } else {
                          setMutedVideos(new Set())
                        }
                      }}
                    >
                      <span className="ta-switch-handle" />
                    </div>
                  </div>
                  <div className="ta-opt-bottom">
                    <span className="ta-opt-desc">Remove camera mic audio track</span>
                    {muteOriginal && availableVideos.length > 0 && (
                      <button
                        type="button"
                        className="ta-opt-sub-btn danger"
                        onClick={e => {
                          e.stopPropagation()
                          setIsMuteOverlayOpen(true)
                        }}
                        title="Exclude specific videos from being muted"
                      >
                        ⚙ Exclude
                      </button>
                    )}
                  </div>
                </div>

                {/* Option 3: Watermark */}
                <div
                  className={`ta-option-card brand ${addWatermarkGlobal ? 'active' : ''}`}
                  onClick={() => {
                    const next = !addWatermarkGlobal
                    setAddWatermarkGlobal(next)
                    if (next) {
                      setWatermarkedVideos(new Set(availableVideos))
                    } else {
                      setWatermarkedVideos(new Set())
                    }
                  }}
                >
                  <div className="ta-opt-top">
                    <div className="ta-opt-title-wrap">
                      <span className="ta-opt-icon">🏷️</span>
                      <span className="ta-opt-title">Watermark Overlay</span>
                    </div>
                    <div
                      className={`ta-switch brand ${addWatermarkGlobal ? 'on' : ''}`}
                      onClick={e => {
                        e.stopPropagation()
                        const next = !addWatermarkGlobal
                        setAddWatermarkGlobal(next)
                        if (next) {
                          setWatermarkedVideos(new Set(availableVideos))
                        } else {
                          setWatermarkedVideos(new Set())
                        }
                      }}
                    >
                      <span className="ta-switch-handle" />
                    </div>
                  </div>
                  <div className="ta-opt-bottom">
                    <span className="ta-opt-desc">Overlay transparent logo watermark</span>
                    {addWatermarkGlobal && availableVideos.length > 0 && (
                      <button
                        type="button"
                        className="ta-opt-sub-btn brand"
                        onClick={e => {
                          e.stopPropagation()
                          setIsWatermarkOverlayOpen(true)
                        }}
                        title="Configure watermark exceptions"
                      >
                        ⚙ Exclude
                      </button>
                    )}
                  </div>
                </div>
              </div>
        </div>
      </div>

      {/* Execution & Processing Logs Popup Modal */}
      {isLogsPopupOpen && (
        <div className="ta-modal-overlay anim-fade-in no-drag" onClick={() => setIsLogsPopupOpen(false)}>
          <div 
            className="ta-modal-content anim-scale-in no-drag" 
            onClick={e => e.stopPropagation()}
            style={{
              width: '92%',
              maxWidth: '920px',
              height: '80vh',
              maxHeight: '720px',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden'
            }}
          >
            <div className="ta-modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
              <div className="ta-modal-header-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>📜</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>Execution & Processing Logs</h3>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                    {lines.length} lines logged {running ? '· Live activity' : ''}
                  </p>
                </div>
                {running && <span className="ta-logs-pulse-dot" title="Job in progress" />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  type="button" 
                  className="logbox-clear" 
                  onClick={clear} 
                  title="Clear logs"
                  style={{
                    padding: '5px 12px',
                    fontSize: '11.5px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    background: 'var(--surface-card, #fff)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600
                  }}
                >
                  🗑 Clear
                </button>
                <button 
                  type="button" 
                  className="ta-modal-close" 
                  onClick={() => setIsLogsPopupOpen(false)}
                  title="Close popup"
                  style={{ cursor: 'pointer', fontSize: '18px', background: 'none', border: 'none', color: 'var(--text-secondary)', padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, padding: '14px', overflow: 'hidden' }}>
              <LogBox 
                lines={lines} 
                maxHeight="100%" 
                statusState={running ? 'running' : (lines.some(l => l.level === 'error') || status === 'Failed') ? 'error' : 'idle'} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Mute Exceptions Overlay Modal */}
      {isMuteOverlayOpen && (
        <div className="ta-modal-overlay anim-fade-in no-drag" onClick={() => setIsMuteOverlayOpen(false)}>
          <div className="ta-modal-content anim-scale-in no-drag" onClick={e => e.stopPropagation()}>
            <div className="ta-modal-header">
              <div className="ta-modal-header-title">
                <h3>🔇 Video Mute Preferences</h3>
                <p>Videos are muted by default. Uncheck to keep original audio (exclude from muting).</p>
              </div>
              <button className="ta-modal-close" onClick={() => setIsMuteOverlayOpen(false)}>✕</button>
            </div>

            <div className="ta-modal-body">
              <div className="ta-modal-controls">
                <input
                  type="text"
                  placeholder="🔍 Search video files..."
                  className="input-field ta-modal-search"
                  value={muteSearch}
                  onChange={e => setMuteSearch(e.target.value)}
                />
                <div className="ta-modal-quick-actions">
                  <GhostButton
                    size="sm"
                    onClick={() => {
                      setMutedVideos(new Set(availableVideos))
                      playTick()
                    }}
                  >
                    🔇 Mute All
                  </GhostButton>
                  <GhostButton
                    size="sm"
                    onClick={() => {
                      setMutedVideos(new Set())
                      playTick()
                    }}
                  >
                    🔊 Exclude All
                  </GhostButton>
                </div>
              </div>

              <div className="ta-modal-list scroll-container">
                {availableVideos
                  .filter(f => f.toLowerCase().includes(muteSearch.toLowerCase()))
                  .map(f => {
                    const isMuted = mutedVideos.has(f)
                    return (
                      <label key={f} className={`ta-modal-item ${isMuted ? 'ta-modal-item--muted' : 'ta-modal-item--excluded'}`}>
                        <input
                          type="checkbox"
                          checked={isMuted}
                          onChange={() => {
                            const next = new Set(mutedVideos)
                            if (next.has(f)) next.delete(f)
                            else next.add(f)
                            setMutedVideos(next)
                            playTick()
                          }}
                        />
                        <span className="ta-checkbox-custom" />
                        <div className="ta-item-meta">
                          <span className="truncate ta-item-name" title={f}>
                            {f}
                            {f.toLowerCase().includes('.tmp') && (
                              <span style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                ⏳ Temp (Pending Render)
                              </span>
                            )}
                          </span>
                          <span className={`ta-item-badge ${isMuted ? 'badge--muted' : 'badge--excluded'}`}>
                            {isMuted ? '🔇 Force Muted' : '🔊 Kept Audio'}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                {availableVideos.filter(f => f.toLowerCase().includes(muteSearch.toLowerCase())).length === 0 && (
                  <div className="ta-modal-empty">
                    <span>🎬</span>
                    <p>No video files match your search criteria.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="ta-modal-footer">
              <div className="ta-modal-summary">
                <span>Total: <strong>{availableVideos.length}</strong></span>
                <span className="divider" />
                <span style={{ color: 'var(--danger)' }}>Muted: <strong>{mutedVideos.size}</strong></span>
                <span className="divider" />
                <span style={{ color: 'var(--success)' }}>Kept Audio: <strong>{availableVideos.length - mutedVideos.size}</strong></span>
              </div>
              <Button
                variant="primary"
                accent="var(--danger)"
                onClick={() => {
                  setIsMuteOverlayOpen(false)
                  playSuccess()
                }}
              >
                ✓ Apply Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Watermark Exceptions Overlay Modal */}
      {isWatermarkOverlayOpen && (
        <div className="ta-modal-overlay anim-fade-in no-drag" onClick={() => setIsWatermarkOverlayOpen(false)}>
          <div className="ta-modal-content anim-scale-in no-drag" onClick={e => e.stopPropagation()}>
            <div className="ta-modal-header">
              <div className="ta-modal-header-title">
                <h3>🏷️ Watermark Preferences</h3>
                <p>Select which videos should include the Watermark.png image. Deselect to skip watermarking.</p>
              </div>
              <button className="ta-modal-close" onClick={() => setIsWatermarkOverlayOpen(false)}>✕</button>
            </div>

            <div className="ta-modal-body">
              <div className="ta-modal-controls">
                <input
                  type="text"
                  placeholder="🔍 Search video files..."
                  className="input-field ta-modal-search"
                  value={watermarkSearch}
                  onChange={e => setWatermarkSearch(e.target.value)}
                />
                <div className="ta-modal-quick-actions">
                  <GhostButton
                    size="sm"
                    onClick={() => {
                      setWatermarkedVideos(new Set(availableVideos))
                      playTick()
                    }}
                  >
                    🏷️ Watermark All
                  </GhostButton>
                  <GhostButton
                    size="sm"
                    onClick={() => {
                      setWatermarkedVideos(new Set())
                      playTick()
                    }}
                  >
                    🚫 Skip All
                  </GhostButton>
                </div>
              </div>

              <div className="ta-modal-list scroll-container">
                {availableVideos
                  .filter(f => f.toLowerCase().includes(watermarkSearch.toLowerCase()))
                  .map(f => {
                    const isWatermarked = watermarkedVideos.has(f)
                    return (
                      <label key={f} className={`ta-modal-item ${isWatermarked ? 'ta-modal-item--muted' : 'ta-modal-item--excluded'}`} style={isWatermarked ? { borderColor: 'var(--accent-adder-soft)' } : {}}>
                        <input
                          type="checkbox"
                          checked={isWatermarked}
                          onChange={() => {
                            const next = new Set(watermarkedVideos)
                            if (next.has(f)) next.delete(f)
                            else next.add(f)
                            setWatermarkedVideos(next)
                            playTick()
                          }}
                        />
                        <span className="ta-checkbox-custom" style={isWatermarked ? { backgroundColor: 'var(--accent-adder)', borderColor: 'var(--accent-adder)' } : {}} />
                        <div className="ta-item-meta">
                          <span className="truncate ta-item-name" title={f}>
                            {f}
                            {f.toLowerCase().includes('.tmp') && (
                              <span style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                ⏳ Temp (Pending Render)
                              </span>
                            )}
                          </span>
                          <span className={`ta-item-badge ${isWatermarked ? 'badge--muted' : 'badge--excluded'}`} style={isWatermarked ? { backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-adder)' } : {}}>
                            {isWatermarked ? '🏷️ Watermarked' : '🚫 Skipped'}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                {availableVideos.filter(f => f.toLowerCase().includes(watermarkSearch.toLowerCase())).length === 0 && (
                  <div className="ta-modal-empty">
                    <span>🎬</span>
                    <p>No video files match your search criteria.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="ta-modal-footer">
              <div className="ta-modal-summary">
                <span>Total: <strong>{availableVideos.length}</strong></span>
                <span className="divider" />
                <span style={{ color: 'var(--accent-adder)' }}>Watermarked: <strong>{watermarkedVideos.size}</strong></span>
                <span className="divider" />
                <span style={{ color: 'var(--text-muted)' }}>Skipped: <strong>{availableVideos.length - watermarkedVideos.size}</strong></span>
              </div>
              <Button
                variant="primary"
                accent="var(--accent-adder)"
                onClick={() => {
                  setIsWatermarkOverlayOpen(false)
                  playSuccess()
                }}
              >
                ✓ Apply Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Predefine Audio Rules & Automode Setup Modal */}
      {isPredefineModalOpen && (
        <div className="ta-modal-overlay anim-fade-in" style={{ zIndex: 9999 }} onClick={() => setIsPredefineModalOpen(false)}>
          <div className="ta-modal-card anim-scale-in" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="ta-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="ta-modal-header-icon" style={{ fontSize: '24px' }}>⚙️</div>
                <div>
                  <h3 className="ta-modal-title">Predefine Audio & Automation Rules</h3>
                  <p className="ta-modal-subtitle">Configure which videos preserve original audio and automate Title Adder on Media Encoder exports</p>
                </div>
              </div>
              <button className="ta-modal-close" onClick={() => setIsPredefineModalOpen(false)}>✕</button>
            </div>

            <div className="ta-modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 20px' }}>
              
              {/* Section 1: Keyword Rules */}
              <div style={{ padding: '14px', background: 'var(--surface-card, rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🔊</span>
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Always Keep Original Audio (Never Mute)</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Videos containing any of these keywords in their name will preserve original live audio and skip muting:
                      </div>
                    </div>
                  </div>
                </div>

                {/* Keyword Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', minHeight: '32px', alignItems: 'center' }}>
                  {(storeState.alwaysKeepOgAudioKeywords || []).map(kw => (
                    <span
                      key={kw}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.25) 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: 'var(--success, #10B981)',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    >
                      🔊 {kw}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1 }}
                        title="Remove keyword rule"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {(storeState.alwaysKeepOgAudioKeywords || []).length === 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No keyword rules configured. Add keywords below.</span>
                  )}
                </div>

                {/* Add Keyword input */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Input
                    placeholder="Enter keyword or event code (e.g. WAAZ, ID, SPEECH, BAYAAN, NIKAH)..."
                    value={newKeywordInput}
                    onChange={e => setNewKeywordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddKeyword() }}
                    style={{ flex: 1 }}
                  />
                  <Button size="sm" onClick={handleAddKeyword} disabled={!newKeywordInput.trim()}>
                    + Add Keyword Rule
                  </Button>
                </div>
              </div>

              {/* Section 2: Automation Toggle */}
              <div style={{ padding: '14px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={storeState.autoStartOnEncoderSignal}
                    onChange={e => setStoreState({ autoStartOnEncoderSignal: e.target.checked })}
                    style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--accent, #6366F1)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      ⚡ Auto-Start Rendering when Media Encoder Signals Complete (Title Automode)
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      When Adobe Media Encoder completes rendering clips to the DVD folder, Title Adder will automatically detect the signal, apply all predefined rules (audio muting exceptions, custom tracks, title images), and immediately start processing without manual confirmation.
                    </div>
                  </div>
                </label>
              </div>

              {/* Section 3: Per-Video Predefine List */}
              <div style={{ padding: '14px', background: 'var(--surface-card, rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>🎬 Predefined Videos & Markers ({Array.from(new Set([...availableVideos, ...(storeState.expectedVideos || []), ...Object.keys(storeState.predefinedVideoMutes || {})])).length})</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Predefine or override audio muting, music track, or title overlay for specific video clips:
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Input
                      placeholder="🔍 Search videos..."
                      value={predefineSearch}
                      onChange={e => setPredefineSearch(e.target.value)}
                      style={{ width: '180px', height: '30px', fontSize: '11px' }}
                    />
                  </div>
                </div>

                {/* Quick Add Video / Marker */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Input
                    placeholder="Add expected video filename (e.g. 001 ID 01.mp4, 002 Q 01.mp4)..."
                    value={newVideoInput}
                    onChange={e => setNewVideoInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddPredefineVideo() }}
                    style={{ flex: 1, height: '32px', fontSize: '12px' }}
                  />
                  <Button size="sm" onClick={handleAddPredefineVideo} disabled={!newVideoInput.trim()}>
                    + Add Video
                  </Button>
                </div>

                {/* Video Table List */}
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                  {(() => {
                    const allVids = Array.from(new Set([
                      ...availableVideos,
                      ...(storeState.expectedVideos || []),
                      ...Object.keys(storeState.predefinedVideoMutes || {}),
                      ...Object.keys(storeState.predefinedTitleImages || {})
                    ])).filter(v => !predefineSearch || v.toLowerCase().includes(predefineSearch.toLowerCase()))

                    if (allVids.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          No videos currently loaded or predefined. Add video filenames above, or queue an export from Premiere Pro.
                        </div>
                      )
                    }

                    return allVids.map(vid => {
                      const isKept = isVideoMuteExcluded(vid, [])
                      const isRuleMatch = (storeState.alwaysKeepOgAudioKeywords || []).some(k => k && vid.toLowerCase().includes(k.toLowerCase()))
                      const stem = getCanonicalStem(vid)
                      const currentImg = storeState.predefinedTitleImages?.[vid] || storeState.predefinedTitleImages?.[stem] || userTitleImageSelections[vid] || ''

                      return (
                        <div
                          key={vid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: isKept ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                            border: `1px solid ${isKept ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`,
                            borderRadius: '8px',
                            gap: '12px'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '14px' }}>🎬</span>
                              <strong className="truncate" style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{vid}</strong>
                              {vid.toLowerCase().includes('.tmp') && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                  ⏳ Temp
                                </span>
                              )}
                              {isRuleMatch && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success, #10B981)', fontWeight: 600 }}>
                                  Rule Match
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {/* Predefined Thumbnail / Title Image Selector */}
                            <div style={{ width: '210px' }} title="Set custom title overlay thumbnail image for this video">
                              <CustomImageSelect
                                value={currentImg}
                                options={availableTitleImageOptions}
                                defaultPath=""
                                defaultName="Auto / ID Thumbnail"
                                onChange={(newPath) => {
                                  const updated = {
                                    ...(storeState.predefinedTitleImages || {}),
                                    [vid]: newPath,
                                    [stem]: newPath
                                  }
                                  setStoreState({ predefinedTitleImages: updated })
                                  const api = (window as any).api
                                  if (api?.titleAutomode?.saveSettings) {
                                    api.titleAutomode.saveSettings({ predefinedTitleImages: updated })
                                  }
                                  setUserTitleImageSelections(prev => ({
                                    ...prev,
                                    [vid]: newPath
                                  }))
                                  showToast({ title: 'Thumbnail Selected', message: `Predefined thumbnail saved for ${vid}`, type: 'success' })
                                }}
                                onResetDefault={() => {
                                  const updated = { ...(storeState.predefinedTitleImages || {}) }
                                  delete updated[vid]
                                  delete updated[stem]
                                  setStoreState({ predefinedTitleImages: updated })
                                  const api = (window as any).api
                                  if (api?.titleAutomode?.saveSettings) {
                                    api.titleAutomode.saveSettings({ predefinedTitleImages: updated })
                                  }
                                  showToast({ title: 'Thumbnail Reset', message: `Reset to auto-matched thumbnail for ${vid}`, type: 'info' })
                                }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTogglePredefinedMute(vid)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: isKept
                                  ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                                  : 'rgba(255,255,255,0.08)',
                                color: isKept ? '#FFFFFF' : 'var(--text-secondary)',
                                boxShadow: isKept ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
                              }}
                              title={isKept ? 'Original audio will be preserved (no background music)' : 'Original audio will be muted and background music added'}
                            >
                              {isKept ? '🔊 Keep OG Audio' : '🔇 Muted'}
                            </button>

                            {(storeState.expectedVideos || []).includes(vid) && (
                              <button
                                type="button"
                                onClick={() => handleRemovePredefineVideo(vid)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  padding: '2px 6px'
                                }}
                                title="Remove from expected list"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>

            </div>

            <div className="ta-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
              <GhostButton onClick={() => setIsPredefineModalOpen(false)}>Close</GhostButton>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button
                  onClick={handleSavePredefinedSettings}
                  style={{
                    background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                    color: '#fff',
                    fontWeight: 600
                  }}
                >
                  ✓ Save Predefined Settings
                </Button>
                {availableVideos.length > 0 && (
                  <Button
                    onClick={async () => {
                      await handleSavePredefinedSettings()
                      handleStartClick()
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#fff',
                      fontWeight: 700
                    }}
                  >
                    🚀 Start Render Now
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAudioModalOpen && (
        <div className={`ta-modal-overlay ${isAudioModalFullscreen ? 'is-fullscreen' : ''}`} onClick={() => setIsAudioModalOpen(false)}>
          <div
            className={`ta-modal-card ${isAudioModalFullscreen ? 'ta-modal-fullscreen' : 'anim-scale-in'}`}
            style={isAudioModalFullscreen ? undefined : { maxWidth: '980px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="ta-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="ta-modal-header-icon">🎬</div>
                <div>
                  <h3 className="ta-modal-title">Pre-Render Setup & Confirmation</h3>
                  <p className="ta-modal-subtitle">Verify and customize title images, original audio muting, and audio tracks for each video</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GhostButton
                  size="sm"
                  onClick={() => setIsAudioModalFullscreen(prev => !prev)}
                  title={isAudioModalFullscreen ? 'Restore Window Size' : 'Maximize to Fullscreen'}
                  style={{ fontSize: '13px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  {isAudioModalFullscreen ? '🗗' : '🗖'}
                </GhostButton>
                <GhostButton
                  size="sm"
                  onClick={() => setIsAudioModalOpen(false)}
                  title="Close"
                  style={{ fontSize: '14px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  ✕
                </GhostButton>
              </div>
            </div>

            {/* Summary counters */}
            <div className="ta-audio-summary-bar">
              <div className="ta-audio-summary-badge">
                <span>🎬 Total Videos:</span>
                <strong>{audioPreviewAssignments.length}</strong>
              </div>
              <div className="ta-audio-summary-badge">
                <span>🖼️ Custom Titles:</span>
                <strong>
                  {audioPreviewAssignments.filter(item => {
                    const sel = userTitleImageSelections[item.videoPath]
                    return sel && item.defaultTitleImagePath && sel.toLowerCase() !== item.defaultTitleImagePath.toLowerCase()
                  }).length}
                </strong>
              </div>
              <div className="ta-audio-summary-badge">
                <span>🔇 Muted OG Audio:</span>
                <strong>
                  {audioPreviewAssignments.filter(item => userMuteSelections[item.videoPath] === true).length}
                </strong>
              </div>
              <div className="ta-audio-summary-badge">
                <span>💧 Watermarked:</span>
                <strong>
                  {audioPreviewAssignments.filter(item => watermarkedVideos.has(item.videoName)).length}
                </strong>
              </div>
              <div className="ta-audio-summary-badge">
                <span>🎵 Unique Audio Tracks:</span>
                <strong>
                  {new Set(Object.values(userAudioSelections).filter(Boolean)).size}
                </strong>
              </div>
            </div>

            {/* ── Pre-Flight Configuration Deck (Thumbnail Mode Dropdown + Destination Path) ── */}
            <div className="ta-preflight-deck anim-scale-in">
              {/* Option 1: Thumbnail Mode Dropdown (Before the path) */}
              <div className="ta-preflight-col ta-preflight-col--thumb">
                <div className="ta-preflight-label-row">
                  <span className="ta-preflight-icon">🖼️</span>
                  <span className="ta-preflight-heading">Thumbnail Overlays</span>
                  <span className="ta-preflight-badge-tag">Front & End</span>
                </div>
                <ThumbnailModeSelect
                  value={thumbnailMode}
                  onChange={setThumbnailMode}
                />
              </div>

              {/* Option 2: Audio Assignment Logic */}
              <div className="ta-preflight-col ta-preflight-col--audio">
                <div className="ta-preflight-label-row">
                  <span className="ta-preflight-icon">🎵</span>
                  <span className="ta-preflight-heading">Audio Assignment</span>
                  <span className="ta-preflight-badge-tag">
                    {audioAssignMode === 'single'
                      ? `Single Track (${availableAudioOptions[audioSingleIdx]?.name || `Audio ${audioSingleIdx + 1}`})`
                      : audioAssignMode === 'alternate'
                        ? 'Sequential'
                        : 'Smart Prefix'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    className="st-select"
                    style={{ flex: 1, height: '36px', fontSize: '12px' }}
                    value={audioAssignMode}
                    onChange={async (e) => {
                      const nextMode = e.target.value
                      setAudioAssignMode(nextMode)
                      const api = (window as any).api
                      if (api?.settings?.setAndSave) {
                        await api.settings.setAndSave('audio_assignment_mode', nextMode)
                      }
                      reapplyAudioLogic(nextMode, audioSingleIdx)
                    }}
                  >
                    <option value="single">Single Track (All Videos)</option>
                    <option value="alternate">Sequential Rotation (Pool)</option>
                    <option value="prefix">Smart Prefix Mappings</option>
                  </select>
                  {audioAssignMode === 'single' && availableAudioOptions.length > 0 && (
                    <select
                      className="st-select"
                      style={{ width: '120px', height: '36px', fontSize: '12px' }}
                      value={String(audioSingleIdx)}
                      onChange={async (e) => {
                        const nextIdx = parseInt(e.target.value, 10)
                        setAudioSingleIdx(nextIdx)
                        const api = (window as any).api
                        if (api?.settings?.setAndSave) {
                          await api.settings.setAndSave('audio_single_index', nextIdx)
                        }
                        reapplyAudioLogic('single', nextIdx)
                      }}
                    >
                      {availableAudioOptions.map((opt, i) => (
                        <option key={i} value={String(i)}>{opt.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Option 3: Output Destination Path Display & Live Status */}
              <div className={`ta-preflight-col ta-preflight-col--path ${outputExists === false ? 'is-error' : outputExists === true ? 'is-valid' : ''}`}>
                <div className="ta-preflight-label-row">
                  <span className="ta-preflight-icon">📁</span>
                  <span className="ta-preflight-heading">Output Destination Path</span>
                  {outputExists === true && (
                    <span className="ta-path-status-pill is-ok">✔ Drive & Folder Ready</span>
                  )}
                  {outputExists === false && (
                    <span className="ta-path-status-pill is-missing">✖ Drive or Path Not Found</span>
                  )}
                </div>
                <div className="ta-preflight-path-bar">
                  <div className="ta-preflight-path-value" title={resolvedOutDir}>
                    <span className="ta-preflight-path-icon">📂</span>
                    <span className="ta-preflight-path-string truncate">{resolvedOutDir || 'No output folder specified'}</span>
                  </div>
                  <button
                    type="button"
                    className="ta-preflight-change-path-btn"
                    onClick={async () => {
                      const api = (window as any).api
                      if (!api?.dialog?.openFolder) return
                      const picked = await api.dialog.openFolder({ title: 'Select Valid Destination Output Folder' })
                      if (picked) {
                        setOutputFolder(picked)
                        const check = await validatePathOnDisk(getResolvedOutputDir(batchSource, picked))
                        setOutputExists(check.valid)
                        setOutputPathError(check.reason || null)
                      }
                    }}
                  >
                    Change Path ➜
                  </button>
                </div>
                {outputExists === false && (
                  <div className="ta-preflight-error-banner">
                    ⚠️ {outputPathError || 'This folder drive or path does not exist on disk. Please click Change Path to select a proper folder.'}
                  </div>
                )}
              </div>
            </div>

            {/* Search filter */}
            <div>
              <Input
                placeholder="🔍 Search videos by filename, prefix, or image name..."
                value={audioSearchFilter}
                onChange={e => setAudioSearchFilter(e.target.value)}
              />
            </div>

            {/* Video Audio & Title Overlay Assignment Table */}
            <div className="ta-audio-table-wrapper">
              <table className="ta-audio-table">
                <thead>
                  <tr>
                    <th style={{ width: '44px', textAlign: 'center' }}>#</th>
                    <th style={{ minWidth: '240px' }}>Video File</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Prefix</th>
                    <th style={{ width: '280px', minWidth: '240px' }}>Title Image (Thumbnail)</th>
                    <th style={{ width: '135px', textAlign: 'center' }}>Thumbnails</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>OG Audio</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Watermark</th>
                    <th style={{ width: '280px', minWidth: '240px' }}>Assigned Audio Track</th>
                  </tr>
                </thead>
                <tbody>
                  {audioPreviewAssignments
                    .filter(item => {
                      if (!audioSearchFilter.trim()) return true
                      const q = audioSearchFilter.toLowerCase()
                      const selImg = userTitleImageSelections[item.videoPath] || item.defaultTitleImagePath || ''
                      const selAud = userAudioSelections[item.videoPath] || item.defaultAudioPath || ''
                      return (
                        item.videoName.toLowerCase().includes(q) ||
                        item.prefix.toLowerCase().includes(q) ||
                        selImg.toLowerCase().includes(q) ||
                        selAud.toLowerCase().includes(q)
                      )
                    })
                    .map((item, idx) => {
                      const selectedAudio = userAudioSelections[item.videoPath] ?? item.defaultAudioPath
                      const selectedImage = userTitleImageSelections[item.videoPath] ?? item.defaultTitleImagePath
                      const isMuted = userMuteSelections[item.videoPath] ?? false
                      const isWatermarked = watermarkedVideos.has(item.videoName)
                      const pTheme = getPrefixColorTheme(item.prefix)
                      const curThumbMode = userThumbnailModeSelections[item.videoPath]
                        ?? userThumbnailModeSelections[item.videoName]
                        ?? thumbnailMode

                      return (
                        <tr key={item.videoPath || idx}>
                          <td style={{ opacity: 0.6, fontSize: '12px', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span>🎬</span>
                              <span title={item.videoName}>{item.videoName}</span>
                              {item.videoName.toLowerCase().includes('.tmp') && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                  ⏳ Temp (Pending Render)
                                </span>
                              )}
                              {item.isNikah && <span className="ta-nikah-tag">👰 Nikah Audio</span>}
                              {item.isSpecialWaazId && !item.isNikah && <span className="ta-nikah-tag" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>⭐ Special Audio</span>}
                            </span>
                          </td>
                          <td>
                            <span
                              className="ta-prefix-chip"
                              style={item.prefix ? {
                                color: pTheme.accent,
                                borderColor: pTheme.accent,
                                background: pTheme.soft
                              } : undefined}
                            >
                              {item.prefix ? (
                                <>
                                  <span style={{ fontSize: '11px', opacity: 0.85 }}>🏷️</span>
                                  <span>{item.prefix}</span>
                                </>
                              ) : (
                                '—'
                              )}
                            </span>
                          </td>
                          <td>
                            <CustomImageSelect
                              value={selectedImage}
                              options={availableTitleImageOptions}
                              defaultPath={item.defaultTitleImagePath}
                              defaultName={item.defaultTitleImageName}
                              onChange={(newPath) => {
                                const stem = getCanonicalStem(item.videoName)
                                setUserTitleImageSelections(prev => ({
                                  ...prev,
                                  [item.videoPath]: newPath,
                                  [item.videoName]: newPath,
                                  [stem]: newPath
                                }))
                                const updatedPre = {
                                  ...(storeState.predefinedTitleImages || {}),
                                  [item.videoName]: newPath,
                                  [stem]: newPath
                                }
                                setStoreState({ predefinedTitleImages: updatedPre })
                                const api = (window as any).api
                                if (api?.titleAutomode?.saveSettings) {
                                  api.titleAutomode.saveSettings({ predefinedTitleImages: updatedPre })
                                }
                              }}
                              onResetDefault={() => {
                                const stem = getCanonicalStem(item.videoName)
                                setUserTitleImageSelections(prev => ({
                                  ...prev,
                                  [item.videoPath]: item.defaultTitleImagePath,
                                  [item.videoName]: item.defaultTitleImagePath,
                                  [stem]: item.defaultTitleImagePath
                                }))
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <RowThumbnailSelect
                              value={curThumbMode}
                              onChange={(nextMode) => {
                                setUserThumbnailModeSelections(prev => ({
                                  ...prev,
                                  [item.videoPath]: nextMode,
                                  [item.videoName]: nextMode
                                }))
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={`ta-mute-toggle-btn ${isMuted ? 'muted' : 'unmuted'}`}
                              onClick={() => {
                                const nextVal = !isMuted
                                const stem = getCanonicalStem(item.videoName)
                                setUserMuteSelections(prev => ({
                                  ...prev,
                                  [item.videoPath]: nextVal,
                                  [item.videoName]: nextVal,
                                  [stem]: nextVal
                                }))
                                const updatedPre = {
                                  ...(storeState.predefinedVideoMutes || {}),
                                  [item.videoName]: nextVal,
                                  [stem]: nextVal
                                }
                                setStoreState({ predefinedVideoMutes: updatedPre })
                                const api = (window as any).api
                                if (api?.titleAutomode?.saveSettings) {
                                  api.titleAutomode.saveSettings({ predefinedVideoMutes: updatedPre })
                                }
                                // Update mutedVideos Set
                                setMutedVideos(prev => {
                                  const nextSet = new Set(prev)
                                  if (nextVal) {
                                    nextSet.add(item.videoName)
                                  } else {
                                    nextSet.delete(item.videoName)
                                  }
                                  return nextSet
                                })
                              }}
                              title={isMuted ? 'Original audio is MUTED. Click to Unmute / keep original audio.' : 'Original audio is ON. Click to Mute original audio.'}
                            >
                              {isMuted ? '🔇 Muted' : '🔊 OG On'}
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={`ta-watermark-toggle-btn ${isWatermarked ? 'watermarked' : 'no-watermark'}`}
                              onClick={() => {
                                const nextVal = !isWatermarked
                                setWatermarkedVideos(prev => {
                                  const nextSet = new Set(prev)
                                  if (nextVal) {
                                    nextSet.add(item.videoName)
                                  } else {
                                    nextSet.delete(item.videoName)
                                  }
                                  return nextSet
                                })
                              }}
                              title={isWatermarked ? 'Watermark is enabled. Click to remove watermark.' : 'Watermark is removed. Click to enable watermark.'}
                            >
                              {isWatermarked ? '💧 Watermark' : '🚫 No WM'}
                            </button>
                          </td>
                          <td>
                            <CustomAudioSelect
                              value={selectedAudio}
                              options={availableAudioOptions}
                              defaultPath={item.defaultAudioPath}
                              defaultName={item.defaultAudioName}
                              onChange={(newPath) => {
                                const stem = getCanonicalStem(item.videoName)
                                setUserAudioSelections(prev => ({
                                  ...prev,
                                  [item.videoPath]: newPath,
                                  [item.videoName]: newPath,
                                  [stem]: newPath
                                }))
                                const updatedPre = {
                                  ...(storeState.predefinedAudioTracks || {}),
                                  [item.videoName]: newPath,
                                  [stem]: newPath
                                }
                                setStoreState({ predefinedAudioTracks: updatedPre })
                                const api = (window as any).api
                                if (api?.titleAutomode?.saveSettings) {
                                  api.titleAutomode.saveSettings({ predefinedAudioTracks: updatedPre })
                                }
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="ta-modal-actions">
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {outputExists === false ? (
                  <span style={{ color: '#EF4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⚠️</span>
                    <span>Action required: Destination drive or path does not exist! Please change path before rendering.</span>
                  </span>
                ) : (
                  <>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>✔</span>
                    <span>Ready to render with chosen title images, thumbnail mode ({thumbnailMode === 'default' ? 'Both added' : thumbnailMode === 'front_only' ? 'No front' : thumbnailMode === 'back_only' ? 'No back' : 'No thumbnails'}), audio, and mute settings</span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <GhostButton onClick={() => setIsAudioModalOpen(false)}>
                  Cancel
                </GhostButton>
                <Button
                  accent={meta.accent}
                  accentHv={meta.accentHv}
                  disabled={outputExists === false}
                  onClick={async () => {
                    if (outputExists === false) {
                      showToast({
                        title: 'Invalid Destination Path',
                        message: 'The destination folder or drive does not exist. Please specify a proper path.',
                        type: 'error'
                      })
                      const api = (window as any).api
                      if (api?.dialog?.openFolder) {
                        const picked = await api.dialog.openFolder({ title: 'Select Valid Destination Output Folder' })
                        if (picked) {
                          setOutputFolder(picked)
                          const check = await validatePathOnDisk(getResolvedOutputDir(batchSource, picked))
                          setOutputExists(check.valid)
                          setOutputPathError(check.reason || null)
                        }
                      }
                      return
                    }
                    setIsAudioModalOpen(false)
                    startJob({
                      customAssignments: userAudioSelections,
                      titleImageAssignments: userTitleImageSelections,
                      videoMuteSelections: userMuteSelections,
                      watermarkedVideos: watermarkedVideos,
                      mutedVideos: mutedVideos,
                      availableVideos: audioPreviewAssignments.map(a => a.videoName),
                      batchSource: batchSource,
                      thumbnailMode: thumbnailMode,
                      thumbnailModeSelections: userThumbnailModeSelections
                    })
                  }}
                >
                  {outputExists === false ? '⚠️ Invalid Output Path' : `✔ Confirm & Render (${audioPreviewAssignments.length} Videos)`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}


      {isDragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none', background: 'transparent' }} />
      )}
    </div>
  )
}
