import React from 'react'
import OneTapLogo from '../OneTapLogo'

interface MorphingBrandProps {
  logoSize?: number
  fontSize?: number
  compact?: boolean
  version?: string
  onClick?: () => void
}

export default function MorphingBrand({
  logoSize = 36,
  fontSize = 15,
  compact = false,
  version = 'v26.10.20',
  onClick
}: MorphingBrandProps): JSX.Element {
  return (
    <div
      className="morphing-brand-container"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '0' : '10px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none'
      }}
      title={`One Tap Workstation (${version})`}
    >
      <OneTapLogo size={logoSize} glow={true} />

      {!compact && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            height: `${logoSize}px`,
            position: 'relative',
            userSelect: 'none',
            gap: '3px'
          }}
        >
          <div
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: 800,
              fontFamily: 'var(--font-display, "Outfit", "Plus Jakarta Sans", system-ui, sans-serif)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              color: 'var(--text-primary, #1C1917)'
            }}
          >
            One Tap
          </div>

          {version && (
            <div
              style={{
                fontSize: `${Math.max(10, Math.round(fontSize * 0.72))}px`,
                fontWeight: 650,
                fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
                color: 'var(--text-muted, #78716C)',
                letterSpacing: '0.02em',
                lineHeight: 1.1
              }}
            >
              {version}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
