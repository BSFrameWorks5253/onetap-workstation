import React from 'react'
import OneTapLogo from '../OneTapLogo'
import type { PageKey } from '../../types'
import { PAGE_META } from '../../types'
import './PageLoader.css'

interface PageLoaderProps {
  pageKey: PageKey
}

export default function PageLoader({ pageKey }: PageLoaderProps): JSX.Element {
  const meta = PAGE_META[pageKey] || {
    icon: '⏳',
    label: 'Workspace',
    accent: 'var(--accent-adder)',
    subtitle: ''
  }

  return (
    <div className="page-loader">
      <div className="page-loader-inner">
        {/* Logo with pulse/spin effect */}
        <div className="page-loader-logo-wrap">
          <OneTapLogo size={42} glow={false} />
        </div>
        
        {/* Accent-colored spinner ring */}
        <div
          className="page-loader-ring"
          style={{ '--loader-color': meta.accent } as React.CSSProperties}
        />
        
        {/* Current Page Icon */}
        <span className="page-loader-icon">
          {typeof meta.icon === 'string' && (meta.icon.startsWith('data:') || meta.icon.includes('/') || meta.icon.includes('.png') || meta.icon.includes('.svg') || meta.icon.includes('assets')) ? (
            <img src={meta.icon} alt={meta.label} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          ) : (
            meta.icon
          )}
        </span>
      </div>
      
      <div className="page-loader-text-wrap">
        <p className="page-loader-label">Switching to {meta.label}</p>
        <p className="page-loader-sub">Preparing professional workspace…</p>
      </div>

      {/* Skeleton cards */}
      <div className="page-loader-skeletons">
        {[140, 100, 220].map((h, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: h, borderRadius: 'var(--radius-card)', animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  )
}
