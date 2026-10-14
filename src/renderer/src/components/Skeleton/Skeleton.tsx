import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
  className?: string
}

export default function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius,
  style,
  className = ''
}: SkeletonProps): JSX.Element {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: borderRadius || 'var(--radius-sm, 10px)',
        ...style
      }}
    />
  )
}

export function SkeletonCircle({ size = 44, style, className = '' }: { size?: number | string; style?: React.CSSProperties; className?: string }): JSX.Element {
  return (
    <div
      className={`skeleton skeleton-circle ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        ...style
      }}
    />
  )
}

export function SkeletonText({
  lines = 3,
  gap = 8,
  lastLineWidth = '60%',
  style
}: {
  lines?: number
  gap?: number
  lastLineWidth?: string
  style?: React.CSSProperties
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, width: '100%', ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          borderRadius={4}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({
  height = '160px',
  hasHeader = true,
  style
}: {
  height?: string | number
  hasHeader?: boolean
  style?: React.CSSProperties
}): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--surface, #FFFFFF)',
        border: '1.5px solid var(--border, rgba(0,0,0,0.08))',
        borderRadius: 'var(--radius-card, 22px)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        height,
        boxShadow: 'var(--glass-shadow)',
        overflow: 'hidden',
        position: 'relative',
        ...style
      }}
    >
      {hasHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <SkeletonCircle size={32} />
          <Skeleton width="40%" height={16} borderRadius={4} />
        </div>
      )}
      <SkeletonText lines={3} />
    </div>
  )
}

/** Shimmering Webview Browser Viewport Skeleton (Replaces static spinner) */
export function SkeletonWebview({
  title = 'Connecting to Secure Cloud Tunnel…',
  subtitle = 'Establishing high-speed encrypted stream with remote host'
}: {
  title?: string
  subtitle?: string
}): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg, #FAF6EE)',
        padding: '24px',
        gap: '20px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Top Banner Loader Message */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          background: 'var(--surface, #FFFFFF)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md, 14px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
        }}
      >
        <SkeletonCircle size={40} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        </div>
      </div>

      {/* Shimmering simulated page cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
          flex: 1
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card, 18px)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <Skeleton height={110} borderRadius="var(--radius-md, 14px)" />
            <Skeleton width="75%" height={16} borderRadius={4} />
            <Skeleton width="45%" height={12} borderRadius={4} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Shimmering Table Skeleton for Data Vault & Auditing Views */
export function SkeletonTable({
  rows = 6,
  columns = 8,
  hasHeader = true
}: {
  rows?: number
  columns?: number
  hasHeader?: boolean
}): JSX.Element {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {hasHeader && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 0.8fr 2.5fr 0.8fr 1fr 1fr 1.2fr 1.2fr',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--surface, #FFFFFF)',
            borderRadius: 'var(--radius-md, 12px)',
            border: '1px solid var(--border, #E2E8F0)'
          }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} height={15} width="75%" borderRadius={4} />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 0.8fr 2.5fr 0.8fr 1fr 1fr 1.2fr 1.2fr',
            gap: '12px',
            padding: '14px 16px',
            alignItems: 'center',
            background: 'var(--surface, #FFFFFF)',
            borderRadius: 'var(--radius-md, 12px)',
            border: '1px solid var(--border, #E2E8F0)',
            opacity: Math.max(0.4, 1 - rIdx * 0.1)
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <Skeleton height={14} width="85%" borderRadius={4} />
            <Skeleton height={10} width="50%" borderRadius={3} />
          </div>
          <Skeleton height={20} width={50} borderRadius={6} />
          <Skeleton height={14} width="90%" borderRadius={4} />
          <Skeleton height={18} width={38} borderRadius={6} />
          <Skeleton height={14} width="55%" borderRadius={4} />
          <Skeleton height={14} width="45%" borderRadius={4} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SkeletonCircle size={10} />
            <Skeleton height={12} width={75} borderRadius={3} />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <Skeleton height={24} width={45} borderRadius={6} />
            <Skeleton height={24} width={40} borderRadius={6} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Shimmering Stats Grid Skeleton */
export function SkeletonStatsGrid(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Top Stat metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} height={110} />
        ))}
      </div>
      {/* Middle Chart Skeleton */}
      <Skeleton height={260} borderRadius="var(--radius-card, 22px)" />
      {/* Bottom List Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <SkeletonCard height={200} />
        <SkeletonCard height={200} />
      </div>
    </div>
  )
}
