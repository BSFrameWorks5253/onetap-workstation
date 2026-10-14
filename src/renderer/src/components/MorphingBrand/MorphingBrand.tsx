import React from 'react'
import zenLogoImg from '../../assets/zen_final_nobg.png'

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
  version = 'v26.10.5',
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
      title={`Zen Infosys (${version})`}
    >
      {/* Stable ZEN Logo Icon */}
      <div
        style={{
          width: `${logoSize}px`,
          height: `${logoSize}px`,
          minWidth: `${logoSize}px`,
          minHeight: `${logoSize}px`,
          borderRadius: '8px',
          background: '#FAF7F2',
          border: '1px solid rgba(229, 192, 123, 0.4)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${Math.max(2, logoSize * 0.1)}px`,
          boxSizing: 'border-box',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        <img
          src={zenLogoImg}
          alt="ZEN Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      {/* Stable Typography Header */}
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
          {/* Main Brand Title - Zeninfosys in Single Solid Gold */}
          <div
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: 900,
              fontFamily: '"Outfit", "Plus Jakarta Sans", system-ui, sans-serif',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: '#D4AF37'
            }}
          >
            Zeninfosys
          </div>

          {/* Version Sub-Label */}
          {version && (
            <div
              style={{
                fontSize: `${Math.max(9, fontSize * 0.65)}px`,
                fontWeight: 650,
                fontFamily: '"Outfit", "Plus Jakarta Sans", system-ui, sans-serif',
                color: 'rgba(148, 163, 184, 0.95)',
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
