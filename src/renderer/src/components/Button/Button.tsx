import React from 'react'
import { useSound } from '../SoundProvider'
import './Button.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  accent?: string
  accentHv?: string
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  children, variant = 'primary', size = 'md',
  accent, accentHv, loading, icon,
  className = '', style, disabled, onClick, ...rest
}: ButtonProps): JSX.Element {
  const { playTick } = useSound()

  const handleInteraction = (e: React.MouseEvent<HTMLButtonElement>) => {
    playTick()
    if (onClick) onClick(e)
  }

  const customStyle = accent ? {
    '--btn-accent':    accent,
    '--btn-accent-hv': accentHv ?? accent,
    ...style
  } as React.CSSProperties : style

  return (
    <button
      className={`btn btn--${variant} btn--${size} ${loading ? 'btn--loading' : ''} ${className}`}
      disabled={disabled || loading}
      style={customStyle}
      onClick={handleInteraction}
      {...rest}
    >
      {loading && <span className="btn-spinner" />}
      {!loading && icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  )
}

/** Small text-only ghost button */
export function GhostButton(props: Omit<ButtonProps, 'variant'>): JSX.Element {
  return <Button variant="ghost" {...props} />
}

/** Red danger button */
export function DangerButton(props: Omit<ButtonProps, 'variant'>): JSX.Element {
  return <Button variant="danger" {...props} />
}
