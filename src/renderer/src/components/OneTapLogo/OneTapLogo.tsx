import React from 'react'

export interface OneTapLogoProps {
  size?: number
  className?: string
  glow?: boolean
  withLabel?: boolean
  compact?: boolean
  version?: string
  onClick?: () => void
  style?: React.CSSProperties
}

/**
 * Clean Adobe CC-style mnemonic squircle insignia ("Ot") for One Tap.
 * Strictly adheres to the Anything child app design standard and color harmony.
 */
export const OneTapLogo: React.FC<OneTapLogoProps> = ({
  size = 36,
  className = '',
  glow = true,
  withLabel = false,
  compact = false,
  version,
  onClick,
  style = {}
}) => {
  const shadowColor = 'rgba(225, 29, 72, 0.45)'

  const emblem = (
    <div
      className={`onetap-logo-emblem ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: `${Math.round(size * 0.22)}px`,
        overflow: 'hidden',
        userSelect: 'none',
        flexShrink: 0,
        boxShadow: glow ? `0 6px 20px ${shadowColor}` : 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative'
      }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id="oneTapEmblemGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#9F1239" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill="url(#oneTapEmblemGrad)" />
        {/* Specular glass highlight rim */}
        <rect
          x="1.5"
          y="1.5"
          width="97"
          height="97"
          rx="20.5"
          stroke="rgba(255,255,255,0.38)"
          strokeWidth="1.5"
        />
        <text
          x="50"
          y="68"
          textAnchor="middle"
          fill="#FFFFFF"
          style={{
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontWeight: 800,
            fontSize: '52px',
            letterSpacing: '-1.5px'
          }}
        >
          Ot
        </text>
      </svg>
    </div>
  )

  if (!withLabel) {
    return emblem
  }

  return (
    <div
      className={`onetap-brand-container ${className}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '0' : '10px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...style
      }}
      title={`One Tap Workstation ${version ? `(${version})` : ''}`}
    >
      {emblem}
      {!compact && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            height: `${size}px`,
            position: 'relative',
            userSelect: 'none',
            gap: '2px'
          }}
        >
          <div
            style={{
              fontSize: `${Math.round(size * 0.44)}px`,
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
                fontSize: `${Math.max(10, Math.round(size * 0.30))}px`,
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

export default OneTapLogo
