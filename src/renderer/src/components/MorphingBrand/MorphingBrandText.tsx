import React from 'react'

interface MorphingBrandTextProps {
  fontSize?: number
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

export default function MorphingBrandText({
  fontSize = 15,
  className = '',
  style,
  onClick
}: MorphingBrandTextProps): JSX.Element {
  return (
    <span
      className={`morphing-brand-text ${className}`}
      onClick={onClick}
      style={{
        fontSize: `${fontSize}px`,
        fontWeight: 900,
        fontFamily: '"Outfit", "Plus Jakarta Sans", system-ui, sans-serif',
        letterSpacing: '-0.02em',
        color: '#D4AF37',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
    >
      Zeninfosys
    </span>
  )
}
