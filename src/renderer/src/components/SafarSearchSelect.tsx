import React, { useState, useRef, useEffect, useMemo } from 'react'
import type { ScannedArchive } from '../types'

export interface SafarSearchSelectProps {
  safars: ScannedArchive[]
  selectedId: number | 'all' | null
  onSelect: (id: number | 'all') => void
  includeAllOption?: boolean
  placeholder?: string
  label?: string
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
}

export const SafarSearchSelect: React.FC<SafarSearchSelectProps> = ({
  safars,
  selectedId,
  onSelect,
  includeAllOption = false,
  placeholder = 'Select Scanned Safar...',
  label,
  className = '',
  style = {},
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    } else {
      setSearchFilter('')
    }
  }, [isOpen])

  // Current selected safar object
  const selectedSafar = useMemo(() => {
    if (selectedId === 'all' || selectedId === null) return null
    return safars.find((s) => s.id === selectedId) || null
  }, [safars, selectedId])

  // Filtered safars based on searchFilter
  const filteredSafars = useMemo(() => {
    const q = searchFilter.trim().toLowerCase()
    if (!q) return safars
    return safars.filter((s) => {
      const nameMatch = s.safar_name?.toLowerCase().includes(q)
      const cityMatch = s.city?.toLowerCase().includes(q)
      const yearMatch = String(s.safar_year || '').includes(q)
      const folderMatch = s.safar_folder?.toLowerCase().includes(q)
      return nameMatch || cityMatch || yearMatch || folderMatch
    })
  }, [safars, searchFilter])

  const displayText = useMemo(() => {
    if (selectedId === 'all') {
      return `All Scanned Folders (${safars.length})`
    }
    if (selectedSafar) {
      const yearPrefix = selectedSafar.safar_year ? `${selectedSafar.safar_year} - ` : ''
      return `${yearPrefix}${selectedSafar.safar_name} (${selectedSafar.total_files || 0} files)`
    }
    return placeholder
  }, [selectedId, selectedSafar, safars.length, placeholder])

  return (
    <div
      ref={containerRef}
      className={`safar-search-select-wrapper ${className}`}
      style={{ position: 'relative', display: 'inline-block', minWidth: '240px', ...style }}
    >
      {label && <label className="safar-search-select-label">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        className={`safar-search-select-trigger ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev)
        }}
        title={displayText}
      >
        <span className="safar-search-select-trigger-text">{displayText}</span>
        <span className={`safar-search-select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="safar-search-select-dropdown">
          {/* Live Search Input */}
          <div className="safar-search-select-input-box">
            <span className="safar-search-select-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="text"
              className="safar-search-select-input"
              placeholder="Search safar name, year, city..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false)
                }
              }}
            />
            {searchFilter && (
              <button
                type="button"
                className="safar-search-select-clear-btn"
                onClick={() => setSearchFilter('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* List Options */}
          <div className="safar-search-select-options">
            {includeAllOption && !searchFilter && (
              <div
                className={`safar-search-select-option ${selectedId === 'all' ? 'selected' : ''}`}
                onClick={() => {
                  onSelect('all')
                  setIsOpen(false)
                }}
              >
                <div className="safar-search-select-option-main">
                  <span className="safar-search-select-option-name">
                    All Scanned Folders
                  </span>
                  <span className="safar-search-select-badge">{safars.length} safars</span>
                </div>
                {selectedId === 'all' && <span className="safar-search-select-check">✓</span>}
              </div>
            )}

            {filteredSafars.length === 0 ? (
              <div className="safar-search-select-empty">
                <span>No safars found matching "{searchFilter}"</span>
              </div>
            ) : (
              filteredSafars.map((safar) => {
                const isSelected = selectedId === safar.id
                return (
                  <div
                    key={safar.id}
                    className={`safar-search-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelect(safar.id)
                      setIsOpen(false)
                    }}
                  >
                    <div className="safar-search-select-option-main">
                      <div className="safar-search-select-option-title-row">
                        {safar.safar_year && (
                          <span className="safar-search-select-year-tag">{safar.safar_year}</span>
                        )}
                        <span className="safar-search-select-option-name" title={safar.safar_name}>
                          {safar.safar_name}
                        </span>
                        {safar.city && (
                          <span className="safar-search-select-city-tag">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '3px' }}>
                              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {safar.city}
                          </span>
                        )}
                      </div>
                      <div className="safar-search-select-option-meta">
                        <span>{safar.total_files || 0} files</span>
                        {safar.total_mp4_count ? (
                          <span> • {safar.total_mp4_count} vids</span>
                        ) : null}
                      </div>
                    </div>
                    {isSelected && <span className="safar-search-select-check">✓</span>}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
