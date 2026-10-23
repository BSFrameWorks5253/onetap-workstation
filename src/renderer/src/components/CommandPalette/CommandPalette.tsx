import React, { useState, useEffect, useRef } from 'react'
import type { PageKey } from '../../types'
import { useTheme } from '../../theme/ThemeContext'
import { useSound } from '../SoundProvider'
import './CommandPalette.css'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (page: PageKey) => void
}

interface CommandItem {
  id: string
  title: string
  subtitle: string
  icon: string
  shortcut?: string
  isPage?: boolean
  action?: () => void
}

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { theme } = useTheme()
  const { playTick, playHotkeyTrigger } = useSound()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items: CommandItem[] = [
    // Quick Actions
    {
      id: 'action-zoom-reset',
      title: '🔍 Reset UI Zoom Level to 100%',
      subtitle: 'Restore standard 1.0 display scaling ratio',
      icon: '🔍',
      shortcut: 'Ctrl + 0',
      action: () => {
        (document.body.style as any).zoom = '1.0'
        localStorage.setItem('ot_zoom_level', '1.0')
      }
    },
    {
      id: 'action-cursor-showcase',
      title: '🖱️ Custom Cursor Pack Showcase',
      subtitle: 'Preview all 18 vector cursors & test interactive states',
      icon: '🖱️',
      shortcut: 'Ctrl + Shift + C',
      action: () => {
        window.dispatchEvent(new CustomEvent('onetap:open-cursor-showcase'))
      }
    },
    // Page Tools
    { id: 'dashboard', isPage: true, title: 'Dashboard', subtitle: 'Workstation overview & quick system metrics', icon: '📊', shortcut: 'Alt + 1' },
    { id: 'tracker', isPage: true, title: 'Task Tracker', subtitle: 'Autonomous Safar & Date production tracking', icon: '🎯', shortcut: 'Alt + T' },
    { id: 'prproj', isPage: true, title: 'Premiere Project Generator', subtitle: 'Automate .prproj sequence generation & timelines', icon: '🎬', shortcut: 'Alt + 2' },
    { id: 'cameratransfer', isPage: true, title: 'Camera Transfer', subtitle: 'Offload SD cards & auto-organize camera media', icon: '📹', shortcut: 'Alt + 3' },
    { id: 'converter', isPage: true, title: 'Media Converter', subtitle: 'Convert videos, transcode formats & extract audio', icon: '⚡', shortcut: 'Alt + 4' },
    { id: 'adder', isPage: true, title: 'Title Adder', subtitle: 'Batch rename media & apply text overlays', icon: '🏷️', shortcut: 'Alt + 5' },
    { id: 'videotransfer', isPage: true, title: 'Match Video Transfer', subtitle: 'Match videos with photo subfolders in date directories', icon: '📹' },
    { id: 'pvseparator', isPage: true, title: 'PV Separator', subtitle: 'Ultra-Fast Photo Data Separator & Extractor', icon: '📷' },
    { id: 'excelmerger', isPage: true, title: 'Inventory Merger', subtitle: 'Merge Morning & Evening Inventory Reports (.xlsx)', icon: '📑' },
    { id: 'folder', isPage: true, title: 'Folder Maker', subtitle: 'Generate production directory tree structures', icon: '📁' },
    { id: 'drivesync', isPage: true, title: 'Drive Sync', subtitle: 'Sync local project folders with external storage', icon: '🔄' },
    { id: 'cloud', isPage: true, title: 'Cloud Portal', subtitle: 'Access cloud storage, Apps Script & Sharaf Media', icon: '🌐' },
    { id: 'notes', isPage: true, title: 'Sticky Notes', subtitle: 'Quick scratchpad for video editing notes', icon: '📝' },
    { id: 'utilities', isPage: true, title: 'Utilities & Cleaner', subtitle: 'Disk cleanup, cache purger & toolbelt', icon: '🛠️' },
    { id: 'stats', isPage: true, title: 'Hardware Monitor & Stats', subtitle: 'Live CPU, GPU, RAM & disk analytics', icon: '🖥️' },
    { id: 'settings', isPage: true, title: 'Settings & Preferences', subtitle: 'Configure app themes, hotkeys & presets', icon: '⚙️' },
  ]

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      playTick()
      setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      playTick()
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        handleExecute(filteredItems[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const handleExecute = (item: CommandItem) => {
    playHotkeyTrigger()
    if (item.action) {
      item.action()
    } else if (item.isPage) {
      onNavigate(item.id as PageKey)
    }
    onClose()
  }

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && listRef.current.children[selectedIndex]) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-modal" onClick={e => e.stopPropagation()}>
        {/* Search Header */}
        <div className="cmd-header">
          <span className="cmd-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Type a command or search tools... (Esc to close)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cmd-badge">Esc</kbd>
        </div>

        {/* Command List */}
        <div className="cmd-list" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="cmd-empty">No matching tools found for "{query}"</div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={item.id}
                className={`cmd-item ${idx === selectedIndex ? 'cmd-item--selected' : ''}`}
                onClick={() => handleExecute(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="cmd-item-icon">{item.icon}</div>
                <div className="cmd-item-info">
                  <span className="cmd-item-title">{item.title}</span>
                  <span className="cmd-item-subtitle">{item.subtitle}</span>
                </div>
                {item.shortcut && <kbd className="cmd-shortcut">{item.shortcut}</kbd>}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="cmd-footer">
          <span>Navigation: <kbd>↑</kbd> <kbd>↓</kbd> Select: <kbd>↵</kbd> Close: <kbd>Esc</kbd></span>
          <span className="cmd-footer-brand">Uni Desk Spotlight Search</span>
        </div>
      </div>
    </div>
  )
}
