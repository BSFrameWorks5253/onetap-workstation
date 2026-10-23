import React, { useEffect, useRef, useState } from 'react'
import type { PageKey } from '../../types'
import { PAGE_META } from '../../types'
import NavItem from '../NavItem'
import { useTheme } from '../../theme/ThemeContext'
import './Sidebar.css'
import MorphingBrand from '../MorphingBrand'
import PageHoverPreview from '../TaskbarPreview/PageHoverPreview'

interface SidebarProps {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  busyPages: Set<PageKey>
  adderProgress: number | null
  syncProgress: number | null
}

export default function Sidebar({ activePage, onNavigate, busyPages, adderProgress, syncProgress }: SidebarProps): JSX.Element {
  const { textOverrides, orderedNav } = useTheme()
  const indicatorRef = useRef<HTMLDivElement>(null)
  const navRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [indicatorY, setIndicatorY] = useState(0)
  const [indicatorH, setIndicatorH] = useState(60)
  const [version, setVersion] = useState('26.10.21')
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    console.log('[Sidebar] Initializing collapsed state from localStorage:', saved)
    return saved === 'true'
  })
  const [hoveredPage, setHoveredPage] = useState<PageKey | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ top: number; left: number } | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleHoverStart = (key: PageKey, el: HTMLElement) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      const rect = el.getBoundingClientRect()
      setHoverPosition({ top: rect.top, left: rect.right })
      setHoveredPage(key)
    }, 240)
  }

  const handleHoverEnd = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredPage(null)
      setHoverPosition(null)
    }, 140)
  }

  useEffect(() => {
    if (window.api && window.api.update && typeof window.api.update.getCurrentVersion === 'function') {
      window.api.update.getCurrentVersion()
        .then((v: string) => setVersion(v))
        .catch(err => console.error('[Sidebar] Failed to load version:', err))
    } else {
      console.warn('[Sidebar] window.api.update.getCurrentVersion is not defined')
    }
  }, [])

  // Animate nav indicator to the active item
  useEffect(() => {
    const el = navRefs.current[activePage]
    if (!el) return
    const container = el.closest('.sidebar-nav-panel')
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const elRect     = el.getBoundingClientRect()
    setIndicatorY(elRect.top - containerRect.top)
    setIndicatorH(elRect.height)
  }, [activePage, collapsed])

  const toggleSidebar = () => {
    const next = !collapsed
    console.log('[Sidebar] Toggling sidebar to:', next ? 'collapsed' : 'expanded')
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  useEffect(() => {
    const handleToggle = () => {
      setCollapsed(prev => {
        const next = !prev
        localStorage.setItem('sidebar_collapsed', String(next))
        return next
      })
    }
    window.addEventListener('toggle-sidebar', handleToggle)
    return () => window.removeEventListener('toggle-sidebar', handleToggle)
  }, [])

  function openZenInfoWebsite() {
    const url = 'https://www.zeninfo.in/'
    const api = (window as any).api
    if (api && api.shell && typeof api.shell.openExternal === 'function') {
      api.shell.openExternal(url).catch(() => {
        window.open(url, '_blank')
      })
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Dynamic glow strip on top */}
      <div 
        className="sidebar-glow-strip" 
        style={{ 
          background: `linear-gradient(90deg, ${PAGE_META[activePage].accentSoft}, ${PAGE_META[activePage].accent})`,
          transition: 'background var(--dur-normal) var(--ease-out)'
        }}
      />

      {/* Brand card */}
      <div 
        className="sidebar-brand" 
        onClick={() => {
          if (typeof (window as any).showAdobeSplashScreen === 'function') {
            (window as any).showAdobeSplashScreen()
          } else if (typeof (window as any).showWelcomeScreen === 'function') {
            (window as any).showWelcomeScreen()
          }
        }} 
        title="One Tap Workstation"
        style={{ cursor: 'pointer', padding: '6px' }}
      >
        <MorphingBrand logoSize={34} fontSize={15} compact={collapsed} version={`v${version}`} />
      </div>

      {/* Section label */}
      <div className="sidebar-section-label">
        <div className="sidebar-section-stripe" />
        {!collapsed && <span>CREATIVE TOOLS</span>}
      </div>

      {/* Nav items */}
      <div className="sidebar-nav-panel">
        <div
          ref={indicatorRef}
          className="sidebar-nav-indicator"
          style={{
            transform: `translateY(${indicatorY}px)`,
            height: indicatorH
          }}
        />

        <nav className="sidebar-nav" style={{ position: 'relative' }}>
          {orderedNav.filter(key => {
            if (key === 'drivesync' || key === 'folder' || key === 'gdrive' || key === 'cameratransfer' || key === 'pvseparator' || key === 'excelmerger') return false // Hide folder, drivesync, gdrive, cameratransfer, pvseparator, and excelmerger from sidebar
            try {
              const hidden = JSON.parse(textOverrides['hidden_tools'] || '[]')
              return !hidden.includes(key)
            } catch { return true }
          }).map(key => (
            <NavItem
              key={key}
              pageKey={key}
              active={activePage === key}
              busy={busyPages.has(key)}
              progress={key === 'adder' ? adderProgress : key === 'drivesync' ? syncProgress : null}
              onClick={() => onNavigate(key)}
              onHoverStart={(el) => handleHoverStart(key, el)}
              onHoverEnd={handleHoverEnd}
              ref={el => { navRefs.current[key] = el }}
            />
          ))}
        </nav>

        <div className="sidebar-sep" />

        <div className="sidebar-bottom-nav">
          <NavItem
            pageKey="settings"
            active={activePage === 'settings'}
            busy={false}
            onClick={() => onNavigate('settings')}
            onHoverStart={(el) => handleHoverStart('settings', el)}
            onHoverEnd={handleHoverEnd}
            ref={el => { navRefs.current['settings'] = el }}
          />
        </div>
      </div>

      {/* Floating Windows-Style Taskbar Hover Live Preview */}
      {hoveredPage && hoverPosition && (
        <PageHoverPreview
          pageKey={hoveredPage}
          position={hoverPosition}
          busy={busyPages.has(hoveredPage)}
          progress={hoveredPage === 'adder' ? adderProgress : hoveredPage === 'drivesync' ? syncProgress : null}
        />
      )}

      {/* Toggle button */}
      <div className="sidebar-toggle-wrap">
        <button className="sidebar-toggle-btn" onClick={toggleSidebar} title="Toggle Sidebar (Ctrl + B)">
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="sidebar-footer">
          <span>© Burhanuddin Sounasath 8369811201</span>
        </div>
      )}
    </aside>
  )
}
