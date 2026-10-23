import React from 'react'
import PageIcon from '../PageIcon'
import './StatCard.css'

interface StatCardProps {
  label: string
  value: string
  icon: React.ReactNode | string
  accent?: string
  accentSoft?: string
}

export default function StatCard({ label, value, icon, accent, accentSoft }: StatCardProps): JSX.Element {
  const renderIcon = () => {
    if (React.isValidElement(icon)) return icon
    if (typeof icon === 'string') {
      if (icon === '🖼️' || icon === '🖼') return <PageIcon pageKey="converter" size={18} color={accent} />
      if (icon === '🎬') return <PageIcon pageKey="adder" size={18} color={accent} />
      if (icon === '☁️' || icon === '☁') return <PageIcon pageKey="drivesync" size={18} color={accent} />
      if (icon === '📁' || icon === '📂') return <PageIcon pageKey="folder" size={18} color={accent} />
      if (icon === '📊') return <PageIcon pageKey="stats" size={18} color={accent} />
      if (icon === '🏷' || icon === '🏷️') return <PageIcon pageKey="tag" size={18} color={accent} />
      if (icon === '✖' || icon === '❌') {
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent || 'currentColor'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )
      }
      if (icon === '✔' || icon === '✅') {
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent || 'currentColor'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )
      }
      return <PageIcon pageKey={icon} size={18} color={accent} />
    }
    return icon
  }

  return (
    <div className="stat-card">
      <div className="stat-card-accent-bar" style={{ background: accent ?? 'var(--accent-adder)' }} />
      <div className="stat-card-top">
        <span className="stat-card-icon" style={{ color: accent ?? 'var(--accent-adder)', background: accentSoft ?? 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderIcon()}
        </span>
        <span className="stat-card-label">{label}</span>
      </div>
      <div className="stat-card-value" style={{ color: accent ?? 'var(--accent-adder)' }}>
        {value}
      </div>
    </div>
  )
}

// ── Status chip ───────────────────────────────────────────────
type ChipVariant = 'info' | 'success' | 'warning' | 'danger' | 'muted'

interface StatusChipProps {
  label: string
  variant?: ChipVariant
}

const CHIP_COLORS: Record<ChipVariant, { color: string; bg: string }> = {
  info:    { color: 'var(--info)',    bg: 'var(--info-soft)' },
  success: { color: 'var(--success)', bg: 'var(--success-soft)' },
  warning: { color: 'var(--warning)', bg: 'var(--warning-soft)' },
  danger:  { color: 'var(--danger)',  bg: 'var(--danger-soft)' },
  muted:   { color: 'var(--text-muted)', bg: 'var(--surface-3)' },
}

export function StatusChip({ label, variant = 'info' }: StatusChipProps): JSX.Element {
  const { color, bg } = CHIP_COLORS[variant]
  return (
    <span className="status-chip" style={{ color, background: bg }}>
      {label}
    </span>
  )
}

// ── Validation dot ────────────────────────────────────────────
interface ValidationDotProps {
  valid: boolean | null   // null = unknown/empty
  label?: string
}

export function ValidationDot({ valid, label }: ValidationDotProps): JSX.Element {
  const color = valid === null ? 'var(--text-muted)'
              : valid ? 'var(--success)' : 'var(--danger)'
  return (
    <span
      className="validation-dot"
      title={label ?? (valid === true ? 'Valid' : valid === false ? 'Invalid' : 'Unchecked')}
      style={{ background: color }}
    />
  )
}
