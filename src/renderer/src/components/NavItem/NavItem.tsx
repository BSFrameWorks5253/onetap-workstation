import React, { forwardRef } from 'react'
import type { PageKey } from '../../types'
import { PAGE_META } from '../../types'
import { useSound } from '../SoundProvider'
import { PageIcon } from '../PageIcon'
import './NavItem.css'

interface NavItemProps {
  pageKey: PageKey
  active: boolean
  busy: boolean
  progress?: number | null
  onClick: () => void
  onHoverStart?: (el: HTMLElement) => void
  onHoverEnd?: () => void
}

const NavItem = forwardRef<HTMLDivElement, NavItemProps>(
  ({ pageKey, active, busy, progress, onClick, onHoverStart, onHoverEnd }, ref) => {
    const meta = PAGE_META[pageKey]
    const { playTick } = useSound()
    const hasProgress = progress !== undefined && progress !== null && progress > 0 && progress < 100

    return (
      <div
        ref={ref}
        className={`nav-item ${active ? 'nav-item--active' : ''}`}
        onClick={onClick}
        onMouseEnter={(e) => {
          playTick()
          if (onHoverStart) onHoverStart(e.currentTarget)
        }}
        onMouseLeave={() => {
          if (onHoverEnd) onHoverEnd()
        }}
        role="button"
        tabIndex={0}
        title={meta.label}
        onKeyDown={e => e.key === 'Enter' && onClick()}
        aria-current={active ? 'page' : undefined}
        style={{
          position: 'relative',
          zIndex: 1,  /* Above the sliding indicator background */
          ['--item-accent' as any]: meta.accent,
          ['--item-accent-soft' as any]: meta.accentSoft || `color-mix(in srgb, ${meta.accent} 15%, transparent)`
        }}
      >
        {/* Pro Vector SVG Icon pill */}
        <div className={`nav-item-icon ${active ? 'nav-item-icon--active' : ''}`}>
          <PageIcon pageKey={pageKey} size={20} color={active ? meta.accent : 'currentColor'} />
        </div>

        {/* Label */}
        <span className="nav-item-label">{meta.label}</span>

        {/* Right side: busy badge OR progress circle OR arrow */}
        {hasProgress ? (
          <div className="nav-item-progress-circle">
            <svg width="20" height="20" viewBox="0 0 20 20">
              <circle
                cx="10"
                cy="10"
                r="7"
                fill="none"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="2"
              />
              <circle
                cx="10"
                cy="10"
                r="7"
                fill="none"
                stroke={meta.accent}
                strokeWidth="2"
                strokeDasharray="44"
                strokeDashoffset={44 - (44 * (progress ?? 0)) / 100}
                strokeLinecap="round"
                transform="rotate(-90 10 10)"
                style={{
                  transition: 'stroke-dashoffset 0.3s ease',
                  filter: `drop-shadow(0 0 2px ${meta.accent})`
                }}
              />
            </svg>
          </div>
        ) : busy ? (
          <span className="nav-item-badge">RUN</span>
        ) : (
          <span className={`nav-item-arrow ${active ? 'nav-item-arrow--active' : ''}`}>›</span>
        )}
      </div>
    )
  }
)

NavItem.displayName = 'NavItem'
export default NavItem
