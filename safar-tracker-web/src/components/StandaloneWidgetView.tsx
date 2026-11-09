import React, { useState } from 'react'
import {
  Share2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Kanban,
  Camera,
  Film,
  Sparkles,
  ArrowRight,
  LayoutDashboard
} from 'lucide-react'

interface StandaloneWidgetViewProps {
  safarName: string
  totalDates: number
  deliveredDates: number
  deliveredPercent: number
  videoStats: {
    uploaded: number
    rendered: number
    editing: number
    completed: number
  }
  photoStats: {
    uploaded: number
    givenToMurtaza: number
    editing: number
  }
  connected: boolean
  lastUpdated?: string
  onRefresh?: () => void
  onCopyBriefing: () => void
  onShareWhatsApp: () => void
  onNavigate: (view: any) => void
}

export default function StandaloneWidgetView({
  safarName,
  totalDates,
  deliveredDates,
  deliveredPercent,
  videoStats,
  photoStats,
  connected,
  lastUpdated,
  onRefresh,
  onCopyBriefing,
  onShareWhatsApp,
  onNavigate
}: StandaloneWidgetViewProps) {
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 40, 30])
    }
    onCopyBriefing()
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    if (onRefresh) {
      await onRefresh()
    }
    setTimeout(() => setRefreshing(false), 800)
  }

  const remaining = Math.max(0, totalDates - deliveredDates)

  return (
    <div className="standalone-widget-shell">
      <div className="standalone-widget-card">
        {/* Top bar with branding & refresh */}
        <header className="widget-header">
          <div className="widget-brand">
            <span className="widget-logo-badge">1</span>
            <div>
              <span className="widget-brand-label">ONE TAP WIDGET</span>
              <span className="widget-sync-status">
                <span className={`live-pip ${connected ? 'online' : ''}`} />
                {connected ? 'LIVE SYNC' : 'OFFLINE CACHE'}
              </span>
            </div>
          </div>

          <div className="widget-header-actions">
            <button
              type="button"
              className={`widget-icon-btn ${refreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              title="Refresh production data"
              aria-label="Refresh widget"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              className="widget-icon-btn"
              onClick={() => onNavigate('dashboard')}
              title="Open full dashboard"
              aria-label="Open Dashboard"
            >
              <LayoutDashboard size={15} />
            </button>
          </div>
        </header>

        {/* Hero Section: Safar Title */}
        <div className="widget-hero">
          <div className="widget-badge-row">
            <span className="widget-pill-active">ONGOING SAFAR</span>
            {lastUpdated && (
              <span className="widget-time">
                {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h1 className="widget-safar-title">{safarName || 'Active Production'}</h1>
        </div>

        {/* Big Progress Gauge Card */}
        <div className="widget-progress-card">
          <div className="widget-gauge-wrap">
            <div
              className="widget-radial-ring"
              style={{
                background: `conic-gradient(var(--brand-primary, #4f46e5) ${deliveredPercent}%, #e2e8f0 0)`
              }}
            >
              <div className="widget-radial-inner">
                <strong className="widget-percent-num">{deliveredPercent}%</strong>
                <span className="widget-percent-label">DELIVERED</span>
              </div>
            </div>
          </div>

          <div className="widget-gauge-details">
            <div className="widget-metric-highlight">
              <strong>{deliveredDates}</strong>
              <span>of {totalDates} dates complete</span>
            </div>
            <div className="widget-linear-bar-wrap">
              <div
                className="widget-linear-bar-fill"
                style={{ width: `${deliveredPercent}%` }}
              />
            </div>
            <span className="widget-remaining-subtext">
              {remaining > 0 ? `⚡ ${remaining} dates remaining to deliver` : '🎉 All dates delivered!'}
            </span>
          </div>
        </div>

        {/* Two-Column Production Pipeline Breakdown */}
        <div className="widget-breakdown-grid">
          {/* Video Box */}
          <div className="widget-breakdown-box video-box">
            <div className="widget-box-head">
              <Film size={14} />
              <span>🎬 Video Pipeline</span>
            </div>
            <div className="widget-box-metrics">
              <div className="widget-stat-pill success">
                <span className="pill-dot" />
                <span className="pill-label">Uploaded</span>
                <strong className="pill-val">{videoStats.uploaded}</strong>
              </div>
              <div className="widget-stat-pill warn">
                <span className="pill-dot" />
                <span className="pill-label">Rendered</span>
                <strong className="pill-val">{videoStats.rendered}</strong>
              </div>
              <div className="widget-stat-pill info">
                <span className="pill-dot" />
                <span className="pill-label">Editing</span>
                <strong className="pill-val">{videoStats.editing}</strong>
              </div>
            </div>
          </div>

          {/* Photo Box */}
          <div className="widget-breakdown-box photo-box">
            <div className="widget-box-head">
              <Camera size={14} />
              <span>📷 Photo Tracker</span>
            </div>
            <div className="widget-box-metrics">
              <div className="widget-stat-pill success">
                <span className="pill-dot" />
                <span className="pill-label">Uploaded</span>
                <strong className="pill-val">{photoStats.uploaded}</strong>
              </div>
              <div className="widget-stat-pill special">
                <span className="pill-dot" />
                <span className="pill-label">To Murtaza</span>
                <strong className="pill-val">{photoStats.givenToMurtaza}</strong>
              </div>
              <div className="widget-stat-pill info">
                <span className="pill-dot" />
                <span className="pill-label">In Editing</span>
                <strong className="pill-val">{photoStats.editing}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 1-Tap Daily WhatsApp Briefing Button */}
        <div className="widget-action-stack">
          <button
            type="button"
            className="widget-briefing-btn"
            onClick={handleCopy}
            title="Copy formatted briefing report to clipboard"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            <span>{copied ? '✓ Copied Daily Briefing!' : 'Copy Daily WhatsApp Briefing'}</span>
          </button>

          <button
            type="button"
            className="widget-whatsapp-btn"
            onClick={onShareWhatsApp}
            title="Share directly into WhatsApp chat"
          >
            <Share2 size={16} />
            <span>Open in WhatsApp</span>
          </button>
        </div>

        {/* Quick Launch Buttons */}
        <div className="widget-nav-footer">
          <button
            type="button"
            className="widget-nav-btn"
            onClick={() => onNavigate('ongoing')}
          >
            <Kanban size={15} />
            <span>Open Kanban Board</span>
            <ArrowRight size={13} style={{ marginLeft: 'auto' }} />
          </button>
          <button
            type="button"
            className="widget-nav-btn"
            onClick={() => onNavigate('photos')}
          >
            <Camera size={15} />
            <span>Open Photo Tracker</span>
            <ArrowRight size={13} style={{ marginLeft: 'auto' }} />
          </button>
        </div>

        {/* Helpful Tip */}
        <div className="widget-tip-box">
          <Sparkles size={14} />
          <span>
            <strong>Home Screen Tip:</strong> In your phone's browser, tap <strong>Share</strong> or <strong>⋮</strong> and select <strong>"Add to Home screen"</strong> for instant 1-tap desktop/mobile widget access!
          </span>
        </div>
      </div>
    </div>
  )
}
