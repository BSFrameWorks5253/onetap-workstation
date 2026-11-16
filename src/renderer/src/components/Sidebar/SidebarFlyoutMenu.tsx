import React from 'react'
import { createPortal } from 'react-dom'
import type { PageKey } from '../../types'
import { PAGE_META } from '../../types'
import { PageIcon } from '../PageIcon'
import type { SubmenuOption } from './types'
import './SidebarFlyoutMenu.css'

interface SidebarFlyoutMenuProps {
  pageKey: PageKey
  position: { top: number; left: number }
  submenus?: SubmenuOption[]
  onMouseEnter: () => void
  onMouseLeave: () => void
  onSelect: () => void
  busy?: boolean
  progress?: number | null
}

export default function SidebarFlyoutMenu({
  pageKey,
  position,
  submenus,
  onMouseEnter,
  onMouseLeave,
  onSelect,
  busy,
  progress
}: SidebarFlyoutMenuProps): JSX.Element | null {
  const meta = PAGE_META[pageKey]
  const hasSubmenus = Array.isArray(submenus) && submenus.length > 0

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="sidebar-flyout-container anim-scale-in"
      style={{
        top: `${Math.max(12, Math.min(window.innerHeight - 340, position.top - 6))}px`,
        left: `${position.left + 8}px`,
        ['--item-accent' as any]: meta?.accent || 'var(--accent)',
        ['--item-accent-soft' as any]: meta?.accentSoft || 'rgba(99, 102, 241, 0.15)'
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Category Header */}
      <div className="sidebar-flyout-header">
        <div className="sidebar-flyout-icon-box">
          <PageIcon pageKey={pageKey} size={16} color={meta?.accent || 'var(--accent)'} />
        </div>
        <div className="sidebar-flyout-title-wrap">
          <span className="sidebar-flyout-title">{meta?.label || pageKey}</span>
          <span className="sidebar-flyout-subtitle">
            {pageKey === 'adder'
              ? 'Select Automation Mode'
              : pageKey === 'tracker'
              ? 'Ongoing Unarchived Safars'
              : meta?.subtitle || 'Workstation Tool'}
          </span>
        </div>
        {busy && (
          <span className="sidebar-flyout-busy-chip">
            {progress ? `${progress}%` : 'RUNNING'}
          </span>
        )}
      </div>

      <div className="sidebar-flyout-divider" />

      {/* Submenu Items List */}
      {hasSubmenus ? (
        <div className="sidebar-flyout-list">
          {submenus!.map((sub) => (
            <button
              key={sub.id}
              className={`sidebar-flyout-item ${sub.active ? 'sidebar-flyout-item--active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                sub.onClick(e)
                onSelect()
              }}
            >
              <span className="sidebar-flyout-bullet" />
              <div className="sidebar-flyout-item-body">
                <span className="sidebar-flyout-item-label">{sub.label}</span>
                {sub.subLabel && (
                  <span className="sidebar-flyout-item-sublabel">{sub.subLabel}</span>
                )}
              </div>
              {sub.badge && (
                <span className="sidebar-flyout-badge">{sub.badge}</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="sidebar-flyout-empty">
          <span>{meta?.subtitle || 'Click to open page'}</span>
        </div>
      )}
    </div>,
    document.body
  )
}
