import React from 'react'
import OneTapLogo from '../OneTapLogo'
import type { PageKey } from '../../types'
import { PAGE_META } from '../../types'
import { PageIcon } from '../PageIcon'
import './PageLoader.css'

interface PageLoaderProps {
  pageKey: PageKey
}

export default function PageLoader({ pageKey }: PageLoaderProps): JSX.Element {
  const meta = PAGE_META[pageKey] || {
    icon: '⚡',
    label: 'Workspace',
    accent: '#E11D48',
    subtitle: 'Preparing high-speed video production engine...'
  }

  return (
    <div className="page-loader" data-page={pageKey}>
      {/* Top Floating Glass Island Loader Status HUD */}
      <div className="page-loader-hud">
        <div className="page-loader-hud-left">
          <div
            className="page-loader-conic-spinner"
            style={{ '--accent-glow': meta.accent } as React.CSSProperties}
          >
            <svg viewBox="0 0 40 40" className="page-loader-spinner-svg">
              <defs>
                <linearGradient id={`pageLoaderGrad-${pageKey}`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={meta.accent && !meta.accent.startsWith('var') ? meta.accent : '#E11D48'} />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>
              </defs>
              <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="spinner-track" />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke={`url(#pageLoaderGrad-${pageKey})`}
                strokeWidth="3"
                strokeDasharray="65 35"
                strokeLinecap="round"
                className="spinner-arc"
              />
            </svg>
            <div className="page-loader-center-icon">
              <OneTapLogo size={18} glow={false} />
            </div>
          </div>

          <div className="page-loader-info">
            <div className="page-loader-title-row">
              <span className="page-loader-page-icon">
                <PageIcon pageKey={pageKey} size={16} color={meta.accent} />
              </span>
              <span className="page-loader-title">Switching to {meta.label}</span>
              <span className="page-loader-dots">
                <span className="dot dot-1">.</span>
                <span className="dot dot-2">.</span>
                <span className="dot dot-3">.</span>
              </span>
            </div>
            <span className="page-loader-sub">
              {meta.subtitle || 'Preparing professional workspace & media engine...'}
            </span>
          </div>
        </div>

        <div className="page-loader-hud-badge">
          <span className="page-loader-live-dot" />
          <span>Mounting Module</span>
        </div>
      </div>

      {/* Contextual High-Fidelity Skeletons based on Target Page */}
      <div className="page-loader-body">
        {pageKey === 'adder' && (
          <div className="page-loader-skeleton-group adder-skeleton">
            {/* Top preset bar */}
            <div className="skeleton-bar-row">
              <div className="page-skeleton-pill" style={{ width: '140px' }} />
              <div className="page-skeleton-pill" style={{ width: '110px' }} />
              <div className="page-skeleton-pill" style={{ width: '130px' }} />
              <div style={{ flex: 1 }} />
              <div className="page-skeleton-btn" style={{ width: '160px' }} />
            </div>

            {/* Large central dropzone card */}
            <div className="page-skeleton-dropzone">
              <div className="dropzone-shimmer-ring">
                <div className="page-skeleton-icon-box" />
              </div>
              <div className="page-skeleton-line" style={{ width: '320px', height: '18px', marginTop: '16px' }} />
              <div className="page-skeleton-line" style={{ width: '220px', height: '12px', marginTop: '8px', opacity: 0.6 }} />
              <div className="page-skeleton-btn" style={{ width: '180px', height: '36px', marginTop: '20px' }} />
            </div>

            {/* Bottom configuration cards grid */}
            <div className="page-skeleton-grid cols-2">
              <div className="page-skeleton-card">
                <div className="skeleton-card-header">
                  <div className="page-skeleton-pill" style={{ width: '120px' }} />
                  <div className="page-skeleton-pill" style={{ width: '60px' }} />
                </div>
                <div className="page-skeleton-line" style={{ width: '90%', height: '14px' }} />
                <div className="page-skeleton-line" style={{ width: '75%', height: '14px' }} />
                <div className="page-skeleton-line" style={{ width: '85%', height: '14px' }} />
              </div>
              <div className="page-skeleton-card">
                <div className="skeleton-card-header">
                  <div className="page-skeleton-pill" style={{ width: '150px' }} />
                </div>
                <div className="page-skeleton-line" style={{ width: '100%', height: '38px', borderRadius: '10px' }} />
                <div className="page-skeleton-line" style={{ width: '60%', height: '12px' }} />
              </div>
            </div>
          </div>
        )}

        {pageKey === 'stats' && (
          <div className="page-loader-skeleton-group stats-skeleton">
            {/* Top 4 KPI Metric Cards */}
            <div className="page-skeleton-grid cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="page-skeleton-card stat-kpi-card">
                  <div className="page-skeleton-line" style={{ width: '50%', height: '12px' }} />
                  <div className="page-skeleton-line" style={{ width: '70%', height: '28px', margin: '8px 0' }} />
                  <div className="page-skeleton-pill" style={{ width: '60px', height: '18px' }} />
                </div>
              ))}
            </div>

            {/* Main Visual Chart Viewport */}
            <div className="page-skeleton-card chart-card">
              <div className="skeleton-card-header">
                <div className="page-skeleton-line" style={{ width: '180px', height: '16px' }} />
                <div className="page-skeleton-pill" style={{ width: '120px' }} />
              </div>
              <div className="chart-mock-bars">
                {[45, 75, 55, 90, 60, 85, 40, 70, 95, 65, 80, 50].map((h, idx) => (
                  <div key={idx} className="chart-bar-col" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>

            {/* Table summary */}
            <div className="page-skeleton-card">
              <div className="page-skeleton-line" style={{ width: '100%', height: '32px' }} />
              <div className="page-skeleton-line" style={{ width: '100%', height: '24px', opacity: 0.7 }} />
              <div className="page-skeleton-line" style={{ width: '100%', height: '24px', opacity: 0.5 }} />
            </div>
          </div>
        )}

        {(pageKey === 'archivevault' || pageKey === 'tracker') && (
          <div className="page-loader-skeleton-group vault-skeleton">
            {/* Search and Filters row */}
            <div className="skeleton-bar-row">
              <div className="page-skeleton-line" style={{ width: '280px', height: '38px', borderRadius: '12px' }} />
              <div className="page-skeleton-pill" style={{ width: '130px', height: '38px' }} />
              <div className="page-skeleton-pill" style={{ width: '110px', height: '38px' }} />
              <div style={{ flex: 1 }} />
              <div className="page-skeleton-btn" style={{ width: '140px', height: '38px' }} />
            </div>

            {/* Table skeleton */}
            <div className="page-skeleton-card table-skeleton-card">
              <div className="table-header-row">
                <div className="page-skeleton-line" style={{ width: '40px', height: '14px' }} />
                <div className="page-skeleton-line" style={{ width: '180px', height: '14px' }} />
                <div className="page-skeleton-line" style={{ width: '120px', height: '14px' }} />
                <div className="page-skeleton-line" style={{ width: '90px', height: '14px' }} />
                <div className="page-skeleton-line" style={{ width: '80px', height: '14px' }} />
                <div className="page-skeleton-line" style={{ width: '100px', height: '14px' }} />
              </div>
              {[1, 2, 3, 4, 5, 6].map((row) => (
                <div key={row} className="table-data-row" style={{ opacity: Math.max(0.35, 1 - row * 0.1) }}>
                  <div className="page-skeleton-line" style={{ width: '24px', height: '14px' }} />
                  <div className="page-skeleton-line" style={{ width: '220px', height: '14px' }} />
                  <div className="page-skeleton-pill" style={{ width: '90px', height: '20px' }} />
                  <div className="page-skeleton-line" style={{ width: '80px', height: '14px' }} />
                  <div className="page-skeleton-pill" style={{ width: '65px', height: '20px' }} />
                  <div className="page-skeleton-btn" style={{ width: '70px', height: '26px' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {(pageKey === 'converter' || pageKey === 'folder') && (
          <div className="page-loader-skeleton-group converter-skeleton">
            <div className="skeleton-bar-row">
              <div className="page-skeleton-pill" style={{ width: '160px', height: '36px' }} />
              <div className="page-skeleton-pill" style={{ width: '160px', height: '36px' }} />
            </div>

            <div className="page-skeleton-grid cols-2">
              <div className="page-skeleton-dropzone" style={{ minHeight: '190px' }}>
                <div className="page-skeleton-icon-box" style={{ width: '44px', height: '44px' }} />
                <div className="page-skeleton-line" style={{ width: '180px', height: '14px', marginTop: '12px' }} />
              </div>
              <div className="page-skeleton-dropzone" style={{ minHeight: '190px' }}>
                <div className="page-skeleton-icon-box" style={{ width: '44px', height: '44px' }} />
                <div className="page-skeleton-line" style={{ width: '180px', height: '14px', marginTop: '12px' }} />
              </div>
            </div>

            <div className="page-skeleton-card">
              <div className="page-skeleton-line" style={{ width: '100%', height: '32px' }} />
              <div className="page-skeleton-line" style={{ width: '100%', height: '28px', opacity: 0.7 }} />
              <div className="page-skeleton-line" style={{ width: '100%', height: '28px', opacity: 0.5 }} />
            </div>
          </div>
        )}

        {(pageKey === 'drivesync' || pageKey === 'videotransfer' || pageKey === 'cameratransfer') && (
          <div className="page-loader-skeleton-group drive-skeleton">
            {/* Dual Storage Drive Monitors */}
            <div className="page-skeleton-grid cols-2">
              <div className="page-skeleton-card drive-card">
                <div className="skeleton-card-header">
                  <div className="page-skeleton-pill" style={{ width: '140px' }} />
                  <div className="page-skeleton-pill" style={{ width: '70px' }} />
                </div>
                <div className="page-skeleton-line" style={{ width: '100%', height: '16px', borderRadius: '8px' }} />
                <div className="page-skeleton-line" style={{ width: '50%', height: '12px' }} />
              </div>
              <div className="page-skeleton-card drive-card">
                <div className="skeleton-card-header">
                  <div className="page-skeleton-pill" style={{ width: '140px' }} />
                  <div className="page-skeleton-pill" style={{ width: '70px' }} />
                </div>
                <div className="page-skeleton-line" style={{ width: '100%', height: '16px', borderRadius: '8px' }} />
                <div className="page-skeleton-line" style={{ width: '50%', height: '12px' }} />
              </div>
            </div>

            {/* Transfer queue */}
            <div className="page-skeleton-card">
              <div className="page-skeleton-line" style={{ width: '100%', height: '40px' }} />
              <div className="page-skeleton-line" style={{ width: '100%', height: '36px', opacity: 0.7 }} />
              <div className="page-skeleton-line" style={{ width: '100%', height: '36px', opacity: 0.5 }} />
            </div>
          </div>
        )}

        {/* Generic/Default fallback for settings, utilities, notes, cleaner, dashboard */}
        {!['adder', 'stats', 'archivevault', 'tracker', 'converter', 'folder', 'drivesync', 'videotransfer', 'cameratransfer'].includes(pageKey) && (
          <div className="page-loader-skeleton-group generic-skeleton">
            <div className="skeleton-bar-row">
              <div className="page-skeleton-pill" style={{ width: '130px' }} />
              <div className="page-skeleton-pill" style={{ width: '150px' }} />
              <div className="page-skeleton-pill" style={{ width: '120px' }} />
            </div>

            <div className="page-skeleton-card">
              <div className="skeleton-card-header">
                <div className="page-skeleton-line" style={{ width: '220px', height: '18px' }} />
                <div className="page-skeleton-pill" style={{ width: '60px' }} />
              </div>
              <div className="page-skeleton-line" style={{ width: '80%', height: '14px' }} />
              <div className="page-skeleton-line" style={{ width: '65%', height: '14px' }} />
            </div>

            <div className="page-skeleton-card">
              <div className="skeleton-card-header">
                <div className="page-skeleton-line" style={{ width: '260px', height: '18px' }} />
              </div>
              <div className="page-skeleton-line" style={{ width: '90%', height: '14px' }} />
              <div className="page-skeleton-line" style={{ width: '70%', height: '14px' }} />
            </div>

            <div className="page-skeleton-card">
              <div className="skeleton-card-header">
                <div className="page-skeleton-line" style={{ width: '200px', height: '18px' }} />
              </div>
              <div className="page-skeleton-line" style={{ width: '85%', height: '14px' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
