import React from 'react'
import './StatCard.css'

interface StatCardProps {
  label: string
  value: string
  icon: string
  accent?: string
  accentSoft?: string
}

export default function StatCard({ label, value, icon, accent, accentSoft }: StatCardProps): JSX.Element {
  return (
    <div className="stat-card">
      <div className="stat-card-accent-bar" style={{ background: accent ?? 'var(--accent-adder)' }} />
      <div className="stat-card-top">
        <span className="stat-card-icon" style={{ color: accent ?? 'var(--accent-adder)', background: accentSoft ?? 'var(--surface-2)' }}>
          {icon}
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
