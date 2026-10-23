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
  version = 'v26.10.12',
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
            gap: '2px'
          }}
        >
          <div
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: 900,
              fontFamily: '"Outfit", "Plus Jakarta Sans", system-ui, sans-serif',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: '#FFFFFF'
            }}
          >
            One Tap
          </div>

          {version && (
            <div
              style={{
                fontSize: `${Math.max(9, fontSize * 0.65)}px`,
                fontWeight: 650,
                fontFamily: '"Outfit", "Plus Jakarta Sans", system-ui, sans-serif',
                color: 'rgba(244, 63, 94, 0.95)',
                letterSpacing: '0.03em',
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
