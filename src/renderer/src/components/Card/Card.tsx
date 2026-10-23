import React from 'react'
import './Card.css'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, className = '', style, ...props }: CardProps): JSX.Element {
  return (
    <div 
      className={`card ${className}`} 
      style={{ 
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  accent?: string        // CSS color string
  accentSoft?: string
  right?: React.ReactNode
}

export function CardHeader({ title, accent, accentSoft, right }: CardHeaderProps): JSX.Element {
  return (
    <div
      className="card-header"
      style={{ background: accentSoft ?? 'var(--surface-2)' }}
    >
      <div className="card-header-stripe" style={{ background: accent ?? 'var(--theme-accent)' }} />
      <span className="card-header-title" style={{ color: accent ?? 'var(--theme-accent)' }}>
        {title}
      </span>
      {right && <div className="card-header-right">{right}</div>}
    </div>
  )
}

import { PageIcon } from '../PageIcon'

interface PageHeroProps {
  icon?: React.ReactNode
  label: string
  subtitle: string
  accent: string
  accentSoft: string
  right?: React.ReactNode
}

export function PageHero({ icon, label, subtitle, accent, accentSoft, right }: PageHeroProps): JSX.Element {
  return (
    <div 
      className="page-hero" 
      style={{ 
        background: `linear-gradient(135deg, ${accentSoft} 0%, rgba(255,255,255,0.05) 100%)`, 
        borderColor: 'var(--glass-border)' 
      }}
    >
      <div className="page-hero-stripe" style={{ background: accent }} />
      <div className="page-hero-inner">
        <div className="page-hero-icon" style={{ background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {React.isValidElement(icon) ? (
            icon
          ) : typeof icon === 'string' && (icon.startsWith('data:') || icon.includes('/') || icon.includes('.png') || icon.includes('.svg') || icon.includes('assets')) ? (
            <img src={icon} alt={label} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          ) : (
            <PageIcon pageKey={label?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''} size={24} color="#FFFFFF" />
          )}
        </div>
        <div className="page-hero-text">
          <h2 className="page-hero-title">{label}</h2>
          <p className="page-hero-subtitle">{subtitle}</p>
        </div>
        {right && <div className="page-hero-right">{right}</div>}
      </div>
    </div>
  )
}
