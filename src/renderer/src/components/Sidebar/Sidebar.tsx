import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { PageKey } from '../../types'
import { PAGE_META } from '../../types'
import NavItem from '../NavItem'
import { useTheme } from '../../theme/ThemeContext'
import './Sidebar.css'
import MorphingBrand from '../MorphingBrand'
import SidebarFlyoutMenu from './SidebarFlyoutMenu'
import type { SubmenuOption } from './types'
import { useTitleAdderStore, titleAdderStore } from '../../stores/titleAdderStore'

interface ActiveSafarItem {
  safarName: string
  city?: string
  totalDays?: number
  completedDays?: number
  percent?: number
  currentDrive?: string
  isArchived?: boolean
}

interface SidebarProps {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  busyPages: Set<PageKey>
  adderProgress: number | null
  syncProgress: number | null
}

export default function Sidebar({
  activePage,
  onNavigate,
  busyPages,
  adderProgress,
  syncProgress
}: SidebarProps): JSX.Element {
  const { textOverrides, orderedNav } = useTheme()
  const [adderStoreState] = useTitleAdderStore()
  const [version, setVersion] = useState('v26.11.12')
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    return saved === 'true'
  })

  // Active unarchived Safars for Task Tracker
  const [activeSafars, setActiveSafars] = useState<ActiveSafarItem[]>([])

  // Hover state for Dropdown Flyout Menu (comes ON HOVER ONLY)
  const [hoveredPage, setHoveredPage] = useState<PageKey | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ top: number; left: number } | null>(null)
  const [selectedTrackerSafar, setSelectedTrackerSafar] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isHoveringFlyoutRef = useRef<boolean>(false)

  useEffect(() => {
    const handleSelect = (e: any) => {
      if (e.detail?.safarName) {
        setSelectedTrackerSafar(e.detail.safarName)
      } else if (e.detail && 'safarName' in e.detail && !e.detail.safarName) {
        setSelectedTrackerSafar(null)
      }
    }
    const handleResetOverview = () => setSelectedTrackerSafar(null)
    window.addEventListener('ot-select-safar', handleSelect)
    window.addEventListener('ot-safars-overview', handleResetOverview)
    return () => {
      window.removeEventListener('ot-select-safar', handleSelect)
      window.removeEventListener('ot-safars-overview', handleResetOverview)
    }
  }, [])

  // Load and refresh active unarchived safars
  const refreshActiveSafars = useCallback(() => {
    try {
      const rawActive = localStorage.getItem('ot_active_safars')
      if (rawActive) {
        const parsed: ActiveSafarItem[] = JSON.parse(rawActive)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActiveSafars(parsed.filter((s) => !s.isArchived))
          return
        }
      }

      // Fallback: derive from folder safars & archived safars
      const folderSafarsRaw = localStorage.getItem('ot_stats_folder_safars')
      const folderSafars: Record<string, string> = folderSafarsRaw ? JSON.parse(folderSafarsRaw) : {}
      const archivedRaw = localStorage.getItem('ot_tracker_archived_safar_names')
      const archivedSet = new Set<string>(archivedRaw ? JSON.parse(archivedRaw) : [])

      const allSafars = Array.from(new Set(Object.values(folderSafars))).filter(
        (s) => s && s !== 'Unassigned'
      )
      const unarchived = allSafars
        .filter((s) => !archivedSet.has(s))
        .map((name) => ({ safarName: name }))

      setActiveSafars(unarchived)
    } catch {
      setActiveSafars([])
    }
  }, [])

  useEffect(() => {
    refreshActiveSafars()
    const handleSafarsUpdated = () => refreshActiveSafars()
    window.addEventListener('ot-safars-updated', handleSafarsUpdated)
    window.addEventListener('storage', handleSafarsUpdated)
    return () => {
      window.removeEventListener('ot-safars-updated', handleSafarsUpdated)
      window.removeEventListener('storage', handleSafarsUpdated)
    }
  }, [refreshActiveSafars])

  useEffect(() => {
    if (window.api && window.api.update && typeof window.api.update.getCurrentVersion === 'function') {
      window.api.update
        .getCurrentVersion()
        .then((v: string) => setVersion(v))
        .catch((err) => console.error('[Sidebar] Failed to load version:', err))
    }
  }, [])



  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  useEffect(() => {
    const handleToggle = () => {
      setCollapsed((prev) => {
        const next = !prev
        localStorage.setItem('sidebar_collapsed', String(next))
        return next
      })
    }
    window.addEventListener('toggle-sidebar', handleToggle)
    return () => window.removeEventListener('toggle-sidebar', handleToggle)
  }, [])

  // Hover handlers: immediate display on hover with smooth grace period
  const handleHoverStart = (key: PageKey, el: HTMLElement) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    const rect = el.getBoundingClientRect()
    setHoverPosition({ top: rect.top, left: rect.right })
    setHoveredPage(key)
  }

  const handleHoverEnd = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHoveringFlyoutRef.current) {
        setHoveredPage(null)
        setHoverPosition(null)
      }
    }, 240)
  }

  const handleFlyoutMouseEnter = () => {
    isHoveringFlyoutRef.current = true
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
  }

  const handleFlyoutMouseLeave = () => {
    isHoveringFlyoutRef.current = false
    handleHoverEnd()
  }

  // Build submenus structure for each page
  const getSubmenusForPage = (key: PageKey): SubmenuOption[] | undefined => {
    if (key === 'adder') {
      const isBatch = adderStoreState.mode !== 'single'
      return [
        {
          id: 'batch',
          label: 'Batch Mode',
          badge: 'Default',
          subLabel: 'Auto-detect all folder clips',
          active: isBatch,
          onClick: () => {
            titleAdderStore.setState({ mode: 'batch' })
            onNavigate('adder')
          }
        },
        {
          id: 'single',
          label: 'Single / Custom',
          subLabel: 'Custom titles & individual trims',
          active: !isBatch,
          onClick: () => {
            titleAdderStore.setState({ mode: 'single' })
            onNavigate('adder')
          }
        }
      ]
    }

    if (key === 'tracker') {
      if (activeSafars.length === 0) {
        return [
          {
            id: '__all__',
            label: 'Open Task Tracker',
            subLabel: 'All Safars 100% / Archived',
            badge: '0 Pending',
            active: true,
            onClick: () => {
              setSelectedTrackerSafar(null)
              onNavigate('tracker')
            }
          }
        ]
      }

      const items: SubmenuOption[] = [
        {
          id: '__overview__',
          label: 'All Active Safars',
          badge: `${activeSafars.length} Active`,
          active: !selectedTrackerSafar || selectedTrackerSafar === '__overview__',
          onClick: () => {
            setSelectedTrackerSafar(null)
            onNavigate('tracker')
          }
        }
      ]

      activeSafars.slice(0, 10).forEach((s) => {
        const daysBadge = s.totalDays ? `${s.completedDays || 0}/${s.totalDays}d` : undefined
        items.push({
          id: s.safarName,
          label: s.safarName,
          subLabel: s.city || s.currentDrive,
          badge: daysBadge,
          active: selectedTrackerSafar === s.safarName,
          onClick: () => {
            setSelectedTrackerSafar(s.safarName)
            onNavigate('tracker')
            window.dispatchEvent(
              new CustomEvent('ot-select-safar', { detail: { safarName: s.safarName } })
            )
          }
        })
      })

      return items
    }

    return undefined
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Dynamic glow strip on top */}
      <div
        className="sidebar-glow-strip"
        style={{
          background: `linear-gradient(90deg, ${PAGE_META[activePage]?.accentSoft || 'rgba(99,102,241,0.15)'}, ${PAGE_META[activePage]?.accent || 'var(--accent)'})`,
          transition: 'background var(--dur-normal) var(--ease-out)'
        }}
      />

      {/* Brand card */}
      <div
        className="sidebar-brand"
        onClick={() => {
          if (typeof (window as any).showAdobeSplashScreen === 'function') {
            ;(window as any).showAdobeSplashScreen()
          } else if (typeof (window as any).showWelcomeScreen === 'function') {
            ;(window as any).showWelcomeScreen()
          }
        }}
        title="One Tap Workstation"
        style={{ cursor: 'pointer', padding: '6px' }}
      >
        <MorphingBrand
          logoSize={32}
          fontSize={13}
          compact={collapsed}
          version={`v${version}`}
          maxWidth="100%"
        />
      </div>

      {/* Nav items */}
      <div className="sidebar-nav-panel">
        <nav className="sidebar-nav">
          {orderedNav
            .filter((key) => {
              if (
                key === 'drivesync' ||
                key === 'folder' ||
                key === 'gdrive' ||
                key === 'cameratransfer' ||
                key === 'pvseparator' ||
                key === 'excelmerger' ||
                key === 'videotransfer'
              )
                return false
              try {
                const hidden = JSON.parse(textOverrides['hidden_tools'] || '[]')
                return !hidden.includes(key)
              } catch {
                return true
              }
            })
            .map((key) => {
              const submenus = getSubmenusForPage(key)
              const isHovered = hoveredPage === key && Boolean(submenus && submenus.length > 0)
              return (
                <div
                  key={key}
                  className={`nav-item-group ${isHovered ? 'nav-item-group--hovered' : ''}`}
                  onMouseEnter={(e) => handleHoverStart(key, e.currentTarget)}
                  onMouseLeave={handleHoverEnd}
                >
                  <NavItem
                    pageKey={key}
                    active={activePage === key}
                    busy={busyPages.has(key)}
                    progress={
                      key === 'adder' ? adderProgress : key === 'drivesync' ? syncProgress : null
                    }
                    hasSubmenus={Boolean(submenus && submenus.length > 0)}
                    isSubmenuOpen={isHovered}
                    onClick={() => {
                      // If clicking Title Adder directly, ensure default mode is batch as requested
                      if (key === 'adder' && !adderStoreState.mode) {
                        titleAdderStore.setState({ mode: 'batch' })
                      }
                      onNavigate(key)
                    }}
                    onHoverStart={(el) => handleHoverStart(key, el)}
                    onHoverEnd={handleHoverEnd}
                  />

                  {/* Inline Submenu (shows on hover only, in expanded sidebar) */}
                  {!collapsed && submenus && submenus.length > 0 && (
                    <div
                      className="nav-submenu"
                      style={{
                        ['--item-accent' as any]: PAGE_META[key]?.accent || 'var(--accent)',
                        ['--item-accent-soft' as any]:
                          PAGE_META[key]?.accentSoft || 'rgba(99, 102, 241, 0.15)'
                      }}
                    >
                      {submenus.map((sub) => (
                        <div
                          key={sub.id}
                          className={`nav-subitem ${sub.active ? 'nav-subitem--active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            sub.onClick(e)
                            setHoveredPage(null)
                          }}
                          role="button"
                          tabIndex={0}
                          title={sub.subLabel || sub.label}
                        >
                          <div className="nav-subitem-main">
                            <div className="nav-subitem-header">
                              <span className="nav-subitem-dot" />
                              <span className="nav-subitem-label">{sub.label}</span>
                              {sub.badge && <span className="nav-subitem-badge">{sub.badge}</span>}
                            </div>
                            {sub.subLabel && (
                              <div className="nav-subitem-sublabel">{sub.subLabel}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
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
          />
        </div>
      </div>

      {/* Floating Flyout Menu (Only in Collapsed Sidebar mode, matching reference diagram) */}
      {collapsed && hoveredPage && hoverPosition && Boolean(getSubmenusForPage(hoveredPage)) && (
        <SidebarFlyoutMenu
          pageKey={hoveredPage}
          position={hoverPosition}
          submenus={getSubmenusForPage(hoveredPage)}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
          onSelect={() => {
            setHoveredPage(null)
            setHoverPosition(null)
          }}
          busy={busyPages.has(hoveredPage)}
          progress={
            hoveredPage === 'adder' ? adderProgress : hoveredPage === 'drivesync' ? syncProgress : null
          }
        />
      )}

      {/* Toggle button */}
      <div className="sidebar-toggle-wrap">
        <button
          className="sidebar-toggle-btn"
          onClick={toggleSidebar}
          title="Toggle Sidebar (Ctrl + B)"
        >
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
