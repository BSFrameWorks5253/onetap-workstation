import React from 'react'
import './ProgressBar.css'

interface ProgressBarProps {
  value: number       // 0–100
  accent?: string
  glow?: boolean
  label?: string
  status?: string
}

export default function ProgressBar({ value, accent, glow = true, label, status }: ProgressBarProps): JSX.Element {
  const pct = Math.max(0, Math.min(100, value))

  return (
    <div className="progress-wrap">
      {(label || status) && (
        <div className="progress-meta">
          {label && <span className="progress-label">{label}</span>}
          {status && <span className="progress-status">{status}</span>}
        </div>
      )}
      <div className="progress-track">
        <div
          className={`progress-fill ${glow && pct > 0 ? 'progress-fill--glow' : ''}`}
          style={{
            width: `${pct}%`,
            background: accent ?? 'var(--accent-adder)',
            boxShadow: glow && pct > 0
              ? `0 0 12px 2px ${accent ?? 'var(--accent-adder)'}66`
              : 'none'
          }}
        />
        {pct > 0 && pct < 100 && (
          <div
            className="progress-glow"
            style={{
              left: `${Math.max(0, pct - 10)}%`,
              background: accent ? `${accent}55` : 'rgba(255,255,255,0.35)'
            }}
          />
        )}
      </div>
      <div className="progress-pct">{pct.toFixed(0)}%</div>
    </div>
  )
}
