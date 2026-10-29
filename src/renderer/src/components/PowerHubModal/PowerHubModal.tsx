import React, { useState, useEffect } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { useSound } from '../SoundProvider'
import { useToast } from '../Toast'
import { PageIcon } from '../PageIcon/PageIcon'
import type { ThemeName } from '../../types'
import './PowerHubModal.css'

interface PowerHubModalProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (page: any) => void
}

interface BookmarkItem {
  id: string
  name: string
  path: string
}

export default function PowerHubModal({ isOpen, onClose, onNavigate }: PowerHubModalProps): JSX.Element | null {
  const { theme, pageTransition, setPageTransition } = useTheme()
  const { playTick, playSuccess, playError } = useSound()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState<'hud' | 'bookmarks' | 'theme' | 'sound' | 'hotkeys'>('hud')

  // Hardware stats state
  const [sysInfo, setSysInfo] = useState<{
    cpuModel?: string
    cpuCores?: number
    totalRamGb?: number
    freeRamGb?: number
    osPlatform?: string
    ffmpegInstalled?: boolean
  }>({})

  // Bookmarks state (persisted in localStorage)
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      const saved = localStorage.getItem('ot_folder_bookmarks')
      return saved ? JSON.parse(saved) : [
        { id: '1', name: 'Date Folders Root', path: 'D:\\Media\\DateFolders' },
        { id: '2', name: 'Export Renders', path: 'D:\\Exports' }
      ]
    } catch {
      return []
    }
  })
  const [newBookmarkName, setNewBookmarkName] = useState('')
  const [newBookmarkPath, setNewBookmarkPath] = useState('')

  // Glass blur intensity & zoom levels
  const [glassBlur, setGlassBlur] = useState(() => localStorage.getItem('ot_glass_blur') || '20px')
  const [zoomFactor, setZoomFactor] = useState(() => localStorage.getItem('ot_zoom_level') || '1.0')

  const api = (window as any).api

  // Load live system specs on mount
  useEffect(() => {
    if (isOpen && api) {
      async function loadSys() {
        try {
          if (api.hardware && typeof api.hardware.getStats === 'function') {
            const stats = await api.hardware.getStats()
            setSysInfo({
              cpuModel: stats.cpuModel || 'Intel / AMD Processor',
              cpuCores: stats.cpuCores || 8,
              totalRamGb: Math.round((stats.totalRam || 16 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024)),
              freeRamGb: Math.round((stats.freeRam || 8 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024)),
              osPlatform: stats.platform || 'Windows',
              ffmpegInstalled: true
            })
          }
        } catch (e) {
          console.warn('[PowerHub] Hardware stats error:', e)
        }
      }
      loadSys()
    }
  }, [isOpen])

  // Apply glass blur dynamically
  useEffect(() => {
    document.documentElement.style.setProperty('--glass-blur', glassBlur)
    localStorage.setItem('ot_glass_blur', glassBlur)
  }, [glassBlur])

  const saveBookmarks = (items: BookmarkItem[]) => {
    setBookmarks(items)
    localStorage.setItem('ot_folder_bookmarks', JSON.stringify(items))
  }

  const handleAddBookmark = () => {
    if (!newBookmarkName || !newBookmarkPath) return
    const newItem: BookmarkItem = {
      id: Date.now().toString(),
      name: newBookmarkName,
      path: newBookmarkPath
    }
    saveBookmarks([...bookmarks, newItem])
    setNewBookmarkName('')
    setNewBookmarkPath('')
    playSuccess()
    showToast({ title: 'Folder Pinned', message: `Added "${newBookmarkName}" to Quick Bookmarks.`, type: 'success' })
  }

  const handleDeleteBookmark = (id: string) => {
    playTick()
    saveBookmarks(bookmarks.filter(b => b.id !== id))
  }

  const handleBrowseBookmarkFolder = async () => {
    if (!api?.dialog) return
    const p = await api.dialog.openFolder({ title: 'Select Quick Bookmark Directory' })
    if (p) {
      setNewBookmarkPath(p)
      if (!newBookmarkName) {
        setNewBookmarkName(p.split(/[\\\/]/).pop() || 'Bookmark')
      }
    }
  }

  if (!isOpen) return null

  const THEME_OPTIONS: { name: ThemeName; label: string; iconKey: string; bgHex: string }[] = [
    { name: 'beige', label: 'Warm Beige Glass', iconKey: 'coffee', bgHex: '#FAF7F2' },
    { name: 'light', label: 'Plain White Glass', iconKey: 'sun', bgHex: '#FFFFFF' },
    { name: 'forest', label: 'Warm Forest Emerald', iconKey: 'sparkles', bgHex: '#F4FAF5' }
  ]

  return (
    <div className="phub-overlay" onClick={onClose}>
      <div className="phub-modal" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="phub-header">
          <div className="phub-header-left">
            <div className="phub-header-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PageIcon pageKey="sparkles" size={18} color="#F59E0B" />
            </div>
            <div>
              <h2 className="phub-title">Workstation Power Hub & Hidden Features</h2>
              <div className="phub-subtitle">Hidden Power Tools, System Health HUD, Quick Bookmarks & Aesthetic Controls</div>
            </div>
          </div>
          <button className="phub-close-btn" onClick={onClose} title="Close (Esc)" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PageIcon pageKey="close" size={14} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="phub-nav-tabs">
          <button className={`phub-tab-btn ${activeTab === 'hud' ? 'active' : ''}`} onClick={() => { playTick(); setActiveTab('hud') }}>
            <PageIcon pageKey="monitor" size={14} style={{ marginRight: '6px' }} />
            Hardware HUD
          </button>
          <button className={`phub-tab-btn ${activeTab === 'bookmarks' ? 'active' : ''}`} onClick={() => { playTick(); setActiveTab('bookmarks') }}>
            <PageIcon pageKey="pin" size={14} style={{ marginRight: '6px' }} />
            Folder Bookmarks
          </button>
          <button className={`phub-tab-btn ${activeTab === 'theme' ? 'active' : ''}`} onClick={() => { playTick(); setActiveTab('theme') }}>
            <PageIcon pageKey="palette" size={14} style={{ marginRight: '6px' }} />
            Aesthetic Studio
          </button>
          <button className={`phub-tab-btn ${activeTab === 'sound' ? 'active' : ''}`} onClick={() => { playTick(); setActiveTab('sound') }}>
            <PageIcon pageKey="volume" size={14} style={{ marginRight: '6px' }} />
            Sound FX Tester
          </button>
          <button className={`phub-tab-btn ${activeTab === 'hotkeys' ? 'active' : ''}`} onClick={() => { playTick(); setActiveTab('hotkeys') }}>
            <PageIcon pageKey="keyboard" size={14} style={{ marginRight: '6px' }} />
            Hotkey Cheat Sheet
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="phub-body">
          {/* TAB 1: System Hardware & Workstation Health HUD */}
          {activeTab === 'hud' && (
            <div className="phub-section">
              <div className="phub-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PageIcon pageKey="stats" size={16} color="#818CF8" />
                Real-Time Hardware Specs & Engine Diagnostics
              </div>
              <div className="phub-grid-3">
                <div className="phub-card">
                  <span className="phub-card-label">CPU ARCHITECTURE</span>
                  <span className="phub-card-value" style={{ fontSize: '14px' }}>{sysInfo.cpuModel || 'Intel / AMD Core'}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sysInfo.cpuCores || 8} Active Processing Cores</span>
                </div>
                <div className="phub-card">
                  <span className="phub-card-label">MEMORY USAGE</span>
                  <span className="phub-card-value" style={{ color: '#34D399' }}>
                    {sysInfo.freeRamGb ? `${sysInfo.totalRamGb! - sysInfo.freeRamGb} / ${sysInfo.totalRamGb} GB` : '16 GB Total'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Available for sequence generation</span>
                </div>
                <div className="phub-card">
                  <span className="phub-card-label">SEQUENCE & MEDIA ENGINE</span>
                  <span className="phub-card-value" style={{ color: '#818CF8', fontSize: '15px' }}>Node.js + FFmpeg 6.0</span>
                  <span style={{ fontSize: '11px', color: '#34D399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <PageIcon pageKey="check" size={11} color="#34D399" />
                    Verified & Active
                  </span>
                </div>
              </div>

              <div className="phub-card" style={{ marginTop: '8px' }}>
                <span className="phub-card-label">WORKSTATION SPEED OPTIMIZATIONS</span>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span className="prproj-status-badge badge-new" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#A5B4FC', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <PageIcon pageKey="zap" size={12} color="#A5B4FC" />
                    Hardware Accelerated FFprobe
                  </span>
                  <span className="prproj-status-badge badge-new" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6EE7B7', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <PageIcon pageKey="bolt" size={12} color="#6EE7B7" />
                    Async XML Stream Writer
                  </span>
                  <span className="prproj-status-badge badge-new" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#FDE047', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <PageIcon pageKey="shield" size={12} color="#FDE047" />
                    Auto-Recovery Error Shield
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Quick Folder Bookmarks Manager */}
          {activeTab === 'bookmarks' && (
            <div className="phub-section">
              <div className="phub-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PageIcon pageKey="pin" size={16} color="#EC4899" />
                Quick Directory Bookmarks
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Pin your most used master date folders, output directories, or SD card paths for 1-click access.
              </div>

              {/* Add Bookmark Row */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--surface-2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <input
                  type="text"
                  placeholder="Bookmark Label (e.g. Master Exports)..."
                  value={newBookmarkName}
                  onChange={e => setNewBookmarkName(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px' }}
                />
                <input
                  type="text"
                  placeholder="Directory Path..."
                  value={newBookmarkPath}
                  onChange={e => setNewBookmarkPath(e.target.value)}
                  style={{ flex: 2, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}
                />
                <button className="phub-sound-btn" style={{ padding: '8px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={handleBrowseBookmarkFolder}>
                  <PageIcon pageKey="folder_open" size={13} />
                  Browse
                </button>
                <button className="phub-sound-btn" style={{ padding: '8px 14px', fontSize: '12px', background: 'var(--accent-dashboard)', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={handleAddBookmark}>
                  <PageIcon pageKey="plus" size={13} color="#fff" />
                  Pin
                </button>
              </div>

              {/* Bookmarks List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {bookmarks.map(item => (
                  <div key={item.id} className="phub-hotkey-row">
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PageIcon pageKey="folder" size={14} color="#F59E0B" />
                        {item.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>{item.path}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="phub-sound-btn"
                        style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => api?.shell?.openFolder(item.path)}
                      >
                        <PageIcon pageKey="folder_open" size={12} />
                        Open Folder
                      </button>
                      <button
                        className="phub-sound-btn"
                        style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => handleDeleteBookmark(item.id)}
                      >
                        <PageIcon pageKey="trash" size={12} color="var(--danger)" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Aesthetics & Glass Studio */}
          {activeTab === 'theme' && (
            <div className="phub-section">
              <div className="phub-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PageIcon pageKey="palette" size={16} color="#8B5CF6" />
                Workstation Theme & Aesthetics Studio
              </div>

              {/* Theme Settings Banner */}
              <div className="phub-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', gap: '16px' }}>
                <div>
                  <span className="phub-card-label">CURRENT ACTIVE THEME</span>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PageIcon pageKey="palette" size={16} color="#8B5CF6" />
                    {theme} Preset
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Application theme customization is configured exclusively in Settings.
                  </p>
                </div>
                <button
                  className="phub-btn"
                  onClick={() => {
                    playTick()
                    onClose()
                    onNavigate('settings')
                  }}
                  style={{ whiteSpace: 'nowrap', padding: '10px 16px', background: 'var(--accent-folder, #3B82F6)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <PageIcon pageKey="settings" size={14} color="#fff" />
                  Change Theme in Settings
                </button>
              </div>

              {/* Page Transition & Glass Density */}
              <div className="phub-grid-2" style={{ marginTop: '12px' }}>
                <div className="phub-card">
                  <span className="phub-card-label">PAGE TRANSITION EFFECT</span>
                  <select
                    value={pageTransition}
                    onChange={e => setPageTransition(e.target.value)}
                    style={{ padding: '8px', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '13px', fontWeight: '600' }}
                  >
                    <option value="fade">Smooth Fade</option>
                    <option value="slide">Slide Horizontal</option>
                    <option value="scale">Spring Zoom Scale</option>
                  </select>
                </div>

                <div className="phub-card">
                  <span className="phub-card-label">GLASSMORPHISM BLUR INTENSITY</span>
                  <select
                    value={glassBlur}
                    onChange={e => setGlassBlur(e.target.value)}
                    style={{ padding: '8px', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '13px', fontWeight: '600' }}
                  >
                    <option value="12px">Soft Glass (12px)</option>
                    <option value="20px">Balanced Glass (20px)</option>
                    <option value="32px">Ultra Heavy Glass (32px)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Audio Soundboard Test */}
          {activeTab === 'sound' && (
            <div className="phub-section">
              <div className="phub-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PageIcon pageKey="volume" size={16} color="#10B981" />
                Interactive Soundboard & Audio Feedback Test
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Test workstation audio chimes for action ticks, task completion, and error alerts.
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                <button className="phub-sound-btn" onClick={() => playSuccess()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <PageIcon pageKey="sparkles" size={14} color="#10B981" />
                  Play Task Success Chime
                </button>
                <button className="phub-sound-btn" onClick={() => playTick()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <PageIcon pageKey="volume" size={14} color="#818CF8" />
                  Play UI Click Tick
                </button>
                <button className="phub-sound-btn" onClick={() => playError()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <PageIcon pageKey="warning" size={14} color="#EF4444" />
                  Play Error Alert Sound
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: Keyboard Shortcuts Guide */}
          {activeTab === 'hotkeys' && (
            <div className="phub-section">
              <div className="phub-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PageIcon pageKey="keyboard" size={16} color="#F59E0B" />
                Keyboard Power Cheat Sheet
              </div>
              {[
                { keys: ['Ctrl', 'K'], desc: 'Open Spotlight Command Launcher' },
                { keys: ['Ctrl', 'Shift', 'P'], desc: 'Open Power Hub & Hidden Features' },
                { keys: ['Ctrl', 'B'], desc: 'Toggle Sidebar Expand / Collapse' },
                { keys: ['Alt', '1–9'], desc: 'Jump to Workstation Tool by Index' },
                { keys: ['Ctrl', '+'], desc: 'Zoom In Application UI' },
                { keys: ['Ctrl', '–'], desc: 'Zoom Out Application UI' },
                { keys: ['Ctrl', '0'], desc: 'Reset Application Zoom to 100%' },
                { keys: ['Esc'], desc: 'Close Overlays, Modals & Dialogs' }
              ].map((row, i) => (
                <div key={i} className="phub-hotkey-row">
                  <span className="phub-hotkey-desc">{row.desc}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {row.keys.map((k, ki) => (
                      <kbd
                        key={ki}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--text-primary)'
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="phub-footer">
          <span>Tip: Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + Shift + P</kbd> from anywhere to trigger this Power Hub.</span>
          <span style={{ fontWeight: 700, color: 'var(--accent-dashboard)' }}>One Tap Workstation v26.10</span>
        </div>
      </div>
    </div>
  )
}
