import React, { useState, useRef, useEffect, useMemo } from 'react'

export interface EventItem {
  code: string
  label: string
  desc: string
}

export interface EventSearchSelectProps {
  events: EventItem[]
  selectedCode: string
  onSelect: (code: string) => void
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
}

export const EventSearchSelect: React.FC<EventSearchSelectProps> = ({
  events,
  selectedCode,
  onSelect,
  className = '',
  style = {},
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
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

  const selectedItem = useMemo(() => {
    if (!selectedCode) return null
    return events.find((e) => e.code.toUpperCase() === selectedCode.toUpperCase()) || null
  }, [events, selectedCode])

  const filteredEvents = useMemo(() => {
    const q = searchFilter.trim().toLowerCase()
    const nonAllEvents = events.filter((e) => e.code !== '')
    if (!q) return nonAllEvents
    return nonAllEvents.filter((e) => {
      const c = e.code.toLowerCase()
      const d = e.desc.toLowerCase()
      const l = e.label.toLowerCase()
      return c.includes(q) || d.includes(q) || l.includes(q)
    })
  }, [events, searchFilter])

  const displayText = useMemo(() => {
    if (selectedItem) {
      return `${selectedItem.code} - ${selectedItem.desc}`
    }
    return 'All Events (34)'
  }, [selectedItem])

  return (
    <div
      ref={containerRef}
      className={`safar-search-select-wrapper event-search-select ${className}`}
      style={{ position: 'relative', display: 'inline-block', minWidth: '190px', ...style }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className={`safar-search-select-trigger ${isOpen ? 'active' : ''} ${selectedCode ? 'has-value' : ''}`}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev)
        }}
        title={displayText}
        style={{
          padding: '7px 12px',
          borderRadius: '10px',
          fontSize: '12px',
          height: '34px',
          borderColor: selectedCode ? '#059669' : '#CBD5E1',
          background: selectedCode ? '#F0FDF4' : '#FFFFFF',
          color: selectedCode ? '#15803D' : '#334155'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <span>🏷️</span>
          <span className="safar-search-select-trigger-text" style={{ fontWeight: selectedCode ? 700 : 500 }}>
            {displayText}
          </span>
        </span>

        {selectedCode && !disabled ? (
          <span
            className="event-search-clear"
            style={{
              marginLeft: '6px',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#059669',
              background: 'rgba(5, 150, 105, 0.12)',
              cursor: 'pointer'
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect('')
            }}
            title="Clear event filter"
          >
            ✕
          </span>
        ) : (
          <span className={`safar-search-select-arrow ${isOpen ? 'open' : ''}`} style={{ fontSize: '10px' }}>
            ▼
          </span>
        )}
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div
          className="safar-search-select-dropdown"
          style={{ minWidth: '280px', maxHeight: '320px', zIndex: 1200 }}
        >
          {/* Live Search Input */}
          <div className="safar-search-select-input-box">
            <span className="safar-search-select-search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              className="safar-search-select-input"
              placeholder="Search event (e.g. Majlis, AQ, WAAZ)..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false)
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
          <div className="safar-search-select-options" style={{ maxHeight: '240px' }}>
            {!searchFilter && (
              <div
                className={`safar-search-select-option ${!selectedCode ? 'selected' : ''}`}
                onClick={() => {
                  onSelect('')
                  setIsOpen(false)
                }}
              >
                <div className="safar-search-select-option-main">
                  <span className="safar-search-select-option-name" style={{ fontWeight: 600 }}>
                    🌐 All Events
                  </span>
                  <span className="safar-search-select-badge">34 types</span>
                </div>
                {!selectedCode && <span className="safar-search-select-check">✓</span>}
              </div>
            )}

            {filteredEvents.length === 0 ? (
              <div className="safar-search-select-empty">
                <span>No event found matching "{searchFilter}"</span>
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const isSelected = selectedCode.toUpperCase() === ev.code.toUpperCase()
                return (
                  <div
                    key={ev.code}
                    className={`safar-search-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelect(ev.code)
                      setIsOpen(false)
                    }}
                  >
                    <div className="safar-search-select-option-main">
                      <div className="safar-search-select-option-title-row" style={{ gap: '8px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            background: isSelected ? '#10B981' : '#E2E8F0',
                            color: isSelected ? '#FFFFFF' : '#334155'
                          }}
                        >
                          {ev.code}
                        </span>
                        <span className="safar-search-select-option-name" style={{ fontSize: '12.5px' }}>
                          {ev.desc}
                        </span>
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
