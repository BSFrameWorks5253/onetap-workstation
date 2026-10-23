import React, { useState, useRef, useEffect, useMemo } from 'react'

export interface ArchiveDateItem {
  date_val: string
  date_canonical_hijri?: string
  date_canonical_greg?: string
  session_tag?: string
  folder_count?: number
  total_mp4_count?: number
  total_photo_count?: number
}

export interface DateSearchSelectProps {
  dates: ArchiveDateItem[]
  selectedDate: string
  onSelect: (date: string) => void
  placeholder?: string
  label?: string
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
  loading?: boolean
}

export const DateSearchSelect: React.FC<DateSearchSelectProps> = ({
  dates,
  selectedDate,
  onSelect,
  placeholder = 'All Dates (Optional)',
  label,
  className = '',
  style = {},
  disabled = false,
  loading = false
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

  // Filtered dates based on search
  const filteredDates = useMemo(() => {
    const q = searchFilter.trim().toLowerCase()
    if (!q) return dates
    return dates.filter((d) => {
      const dv = (d.date_val || '').toLowerCase()
      const st = (d.session_tag || '').toLowerCase()
      return dv.includes(q) || st.includes(q)
    })
  }, [dates, searchFilter])

  // Find currently selected item
  const selectedItem = useMemo(() => {
    if (!selectedDate) return null
    return dates.find(
      (d) =>
        d.date_val === selectedDate ||
        (d.session_tag && `${d.date_val} ${d.session_tag}` === selectedDate)
    )
  }, [dates, selectedDate])

  const displayText = useMemo(() => {
    if (loading) return 'Loading Dates...'
    if (selectedItem) {
      const tag = selectedItem.session_tag ? ` (${selectedItem.session_tag})` : ''
      return `${selectedItem.date_val}${tag}`
    }
    if (selectedDate) {
      return `${selectedDate}`
    }
    return placeholder
  }, [selectedItem, selectedDate, loading, placeholder])

  return (
    <div
      ref={containerRef}
      className={`safar-search-select-wrapper date-search-select ${className}`}
      style={{ position: 'relative', display: 'inline-block', minWidth: '200px', ...style }}
    >
      {label && <label className="safar-search-select-label">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        className={`safar-search-select-trigger ${isOpen ? 'active' : ''} ${disabled || loading ? 'disabled' : ''}`}
        disabled={disabled || loading}
        onClick={() => {
          if (!disabled && !loading) setIsOpen((prev) => !prev)
        }}
        title={displayText}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8, flexShrink: 0 }}>
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="safar-search-select-trigger-text">{displayText}</span>
        </span>
        {selectedDate && !disabled && (
          <span
            className="date-search-clear-quick"
            style={{ marginRight: '6px', opacity: 0.6, fontSize: '11px', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect('')
            }}
            title="Clear date filter"
          >
            ✕
          </span>
        )}
        <span className={`safar-search-select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="safar-search-select-dropdown" style={{ minWidth: '280px' }}>
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
              placeholder="Search date, e.g. 1448-02..."
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
            {/* Option to clear / all dates */}
            {!searchFilter && (
              <div
                className={`safar-search-select-option ${!selectedDate ? 'selected' : ''}`}
                onClick={() => {
                  onSelect('')
                  setIsOpen(false)
                }}
              >
                <div className="safar-search-select-option-main">
                  <span className="safar-search-select-option-name">🌐 All Dates / Sessions</span>
                  <span className="safar-search-select-badge">{dates.length} dates</span>
                </div>
                {!selectedDate && <span className="safar-search-select-check">✓</span>}
              </div>
            )}

            {filteredDates.length === 0 ? (
              <div className="safar-search-select-empty">
                <span>No dates found matching "{searchFilter}"</span>
              </div>
            ) : (
              filteredDates.map((item, idx) => {
                const itemVal = item.session_tag
                  ? `${item.date_val} ${item.session_tag}`
                  : item.date_val
                const isSelected = selectedDate === item.date_val || selectedDate === itemVal

                return (
                  <div
                    key={`${item.date_val}_${item.session_tag || idx}`}
                    className={`safar-search-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelect(item.date_val)
                      setIsOpen(false)
                    }}
                  >
                    <div className="safar-search-select-option-main">
                      <div className="safar-search-select-option-title-row">
                        <span className="safar-search-select-option-name">
                          📅 {item.date_val}
                        </span>
                        {item.session_tag && (
                          <span
                            className="safar-search-select-year-tag"
                            style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}
                          >
                            {item.session_tag}
                          </span>
                        )}
                      </div>
                      <div className="safar-search-select-option-meta">
                        {item.folder_count ? (
                          <span>{item.folder_count} folder{item.folder_count > 1 ? 's' : ''}</span>
                        ) : null}
                        {item.total_mp4_count ? (
                          <span> • {item.total_mp4_count} vids</span>
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
