import React, { useState } from 'react'
import {
  ExternalLink,
  Share2,
  Copy,
  Check,
  RefreshCw,
  Film,
  Camera,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldCheck,
  ArrowRight
} from 'lucide-react'
import { AnimatedNumber } from '../App'

interface SafarBriefingViewProps {
  safarName: string
  safarYear?: string | number
  totalDates: number
  deliveredDates: number
  deliveredPercent: number
  videoStats: {
    editingPending?: number
    inProgress?: number
    uploadPending?: number
    uploaded?: number
    aljameaDone?: number
    completed?: number
    jameya?: number
    upload?: number
    rendering?: number
    editing?: number
  }
  photoStats: {
    uploaded: number
    givenToMurtaza: number
    editing: number
  }
  deliveredDatesList: string[]
  pendingDatesList: string[]
  connected: boolean
  lastUpdated?: string
  availableSafars?: string[]
  onSelectSafar?: (name: string) => void
  onRefresh?: () => void
  onCopyBriefing: () => void
  onShareWhatsApp: () => void
  onOpenTracker: () => void
}

export default function SafarBriefingView({
  safarName,
  safarYear,
  totalDates,
  deliveredDates,
  deliveredPercent,
  videoStats,
  photoStats,
  deliveredDatesList,
  pendingDatesList,
  connected,
  lastUpdated,
  availableSafars,
  onSelectSafar,
  onRefresh,
  onCopyBriefing,
  onShareWhatsApp,
  onOpenTracker
}: SafarBriefingViewProps): JSX.Element {
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'delivered' | 'pending'>('all')

  const remaining = Math.max(0, totalDates - deliveredDates)

  const handleCopy = () => {
    try { if ('vibrate' in navigator) navigator.vibrate([20, 30]) } catch {}
    onCopyBriefing()
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    if (onRefresh) await onRefresh()
    setTimeout(() => setRefreshing(false), 800)
  }

  return (
    <div className="safar-briefing-shell">
      <div className="safar-briefing-card anim-scale-in">
        {/* Top bar with verified badge, Safar switcher, and workstation jump */}
        <header className="briefing-topbar">
          <div className="briefing-brand-badge">
            <span className="briefing-brand-logo">One Tap</span>
            <span className="briefing-status-pill">
              <span className={`status-dot ${connected ? 'online' : ''}`} />
              {connected ? 'Live Sync Verified' : 'Stored Snapshot'}
            </span>
          </div>

          <div className="briefing-topbar-actions">
            {availableSafars && availableSafars.length > 1 && (
              <select
                aria-label="Switch Safar"
                value={safarName}
                onChange={e => onSelectSafar?.(e.target.value)}
                className="briefing-safar-select"
                title="Switch Safar Campaign"
              >
                {availableSafars.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            <a
              href={safarName ? `/kanban?safar=${encodeURIComponent(safarName)}` : '/kanban'}
              className="briefing-btn-open-site"
              onClick={(e) => {
                e.preventDefault()
                onOpenTracker()
              }}
              title="Open Interactive Workstation Website"
            >
              <span>Open Website</span>
              <ArrowRight size={13} />
            </a>
          </div>
        </header>

        {/* Hero Section */}
        <div className="briefing-hero">
          <div className="briefing-hero-eyebrow">
            <ShieldCheck size={13} className="briefing-icon-copper" />
            <span>OFFICIAL PRODUCTION BRIEFING · {safarYear ? `${safarYear} H` : '1448 H'}</span>
          </div>
          <h1 className="briefing-title">{safarName || 'Active Safar Campaign'}</h1>
          <p className="briefing-subtitle">
            Synchronized milestones across video editing, color grading, audio master, and Al Jamea uploads.
          </p>
        </div>

        {/* Big Progress Gauge Card */}
        <div className="briefing-progress-card">
          <div className="briefing-progress-header">
            <div>
              <span className="briefing-label-muted">OVERALL DELIVERY PROGRESS</span>
              <div className="briefing-big-percent">
                <AnimatedNumber value={deliveredPercent} />
                <span className="briefing-percent-symbol">%</span>
              </div>
            </div>
            <div className="briefing-stats-summary-box">
              <div className="briefing-stat-row">
                <span className="briefing-dot-completed" />
                <span className="briefing-stat-label">Delivered:</span>
                <strong><AnimatedNumber value={deliveredDates} /> / {totalDates}</strong>
              </div>
              <div className="briefing-stat-row">
                <span className="briefing-dot-pending" />
                <span className="briefing-stat-label">Pending:</span>
                <strong><AnimatedNumber value={remaining} /> dates</strong>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="briefing-bar-track" role="progressbar" aria-valuenow={deliveredPercent} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="briefing-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, deliveredPercent))}%` }}
            />
          </div>
        </div>

        {/* 4 Metric Tiles with Number Animations */}
        <div className="briefing-metrics-grid">
          <div className="briefing-metric-tile">
            <span className="briefing-metric-icon">🎬</span>
            <div className="briefing-metric-val" style={{ color: '#059669' }}>
              <AnimatedNumber value={deliveredDates} />
              <small>/{totalDates}</small>
            </div>
            <span className="briefing-metric-lbl">Video Delivered</span>
          </div>

          <div className="briefing-metric-tile">
            <span className="briefing-metric-icon">📷</span>
            <div className="briefing-metric-val" style={{ color: '#2563eb' }}>
              <AnimatedNumber value={photoStats.uploaded} />
              <small>/{totalDates}</small>
            </div>
            <span className="briefing-metric-lbl">Photos Uploaded</span>
          </div>

          <div className="briefing-metric-tile">
            <span className="briefing-metric-icon">⏳</span>
            <div className="briefing-metric-val" style={{ color: '#d97706' }}>
              <AnimatedNumber value={(videoStats.editingPending || 0) + (videoStats.inProgress || videoStats.editing || 0) + (videoStats.uploadPending || videoStats.rendering || 0)} />
            </div>
            <span className="briefing-metric-lbl">In Production Queue</span>
          </div>

          <div className="briefing-metric-tile">
            <span className="briefing-metric-icon">📅</span>
            <div className="briefing-metric-val" style={{ color: '#4f46e5' }}>
              <AnimatedNumber value={totalDates} />
            </div>
            <span className="briefing-metric-lbl">Total Days</span>
          </div>
        </div>

        {/* Video & Photo Stage Breakdown */}
        <div className="briefing-pipeline-section">
          <div className="briefing-pipeline-row">
            <div className="briefing-pipeline-header">
              <Film size={14} style={{ color: '#059669' }} />
              <strong>Video Status</strong>
            </div>
            <div className="briefing-pill-group">
              {(videoStats.aljameaDone || videoStats.jameya || videoStats.completed || 0) > 0 && <span className="briefing-pill pill-jameya">{(videoStats.aljameaDone || 0) + (videoStats.jameya || 0) + (videoStats.completed || 0)} AlJamea Done</span>}
              {(videoStats.uploaded || videoStats.upload || 0) > 0 && <span className="briefing-pill pill-upload">{(videoStats.uploaded || 0) + (videoStats.upload || 0)} Uploaded</span>}
              {(videoStats.uploadPending || videoStats.rendering || 0) > 0 && <span className="briefing-pill pill-rendering">{(videoStats.uploadPending || 0) + (videoStats.rendering || 0)} Upload Pending</span>}
              {(videoStats.inProgress || videoStats.editing || 0) > 0 && <span className="briefing-pill pill-editing">{(videoStats.inProgress || 0) + (videoStats.editing || 0)} In Progress</span>}
              {(videoStats.editingPending || 0) > 0 && <span className="briefing-pill pill-pending">{videoStats.editingPending} Editing Pending</span>}
              {totalDates === 0 && <span className="briefing-pill pill-neutral">No date folders found</span>}
            </div>
          </div>

          <div className="briefing-pipeline-row">
            <div className="briefing-pipeline-header">
              <Camera size={14} style={{ color: '#2563eb' }} />
              <strong>Photo Status</strong>
            </div>
            <div className="briefing-pill-group">
              <span className="briefing-pill pill-upload">{photoStats.uploaded} Uploaded to Drive</span>
              {photoStats.givenToMurtaza > 0 && <span className="briefing-pill pill-jameya">{photoStats.givenToMurtaza} Given to Murtaza</span>}
              {photoStats.editing > 0 && <span className="briefing-pill pill-editing">{photoStats.editing} Pending Photos</span>}
            </div>
          </div>
        </div>

        {/* Date Breakdown List with Segmented Switcher */}
        <div className="briefing-dates-section">
          <div className="briefing-dates-tab-bar">
            <button
              type="button"
              className={`briefing-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Dates ({totalDates})
            </button>
            <button
              type="button"
              className={`briefing-tab ${activeTab === 'delivered' ? 'active' : ''}`}
              onClick={() => setActiveTab('delivered')}
            >
              ✓ Delivered ({deliveredDatesList.length})
            </button>
            <button
              type="button"
              className={`briefing-tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              ⏳ In Progress ({pendingDatesList.length})
            </button>
          </div>

          <div className="briefing-dates-chips">
            {activeTab !== 'pending' && deliveredDatesList.map(date => (
              <span key={date} className="briefing-date-chip chip-delivered" title={`${date} (Delivered)`}>
                <CheckCircle2 size={12} />
                <span>{date}</span>
              </span>
            ))}

            {activeTab !== 'delivered' && pendingDatesList.map(date => (
              <span key={date} className="briefing-date-chip chip-pending" title={`${date} (Pending / In Editing)`}>
                <Clock size={12} />
                <span>{date}</span>
              </span>
            ))}

            {totalDates === 0 && (
              <p className="briefing-empty-copy">No date folders active for this Safar.</p>
            )}
          </div>
        </div>

        {/* Primary Interactive CTA: Takes user to full tracker website */}
        <div className="briefing-cta-box">
          <a
            href={safarName ? `/kanban?safar=${encodeURIComponent(safarName)}` : '/kanban'}
            className="briefing-primary-website-btn"
            onClick={(e) => {
              e.preventDefault()
              onOpenTracker()
            }}
          >
            <span>🚀 Open Full Workstation Tracker</span>
            <ArrowRight size={16} />
          </a>
          <p className="briefing-cta-hint">
            View the live interactive Kanban board, assign editors, change stages, and manage Google Drive photos.
          </p>
        </div>

        {/* WhatsApp & Copy Quick Actions Footer */}
        <footer className="briefing-footer-actions">
          <button
            type="button"
            className="briefing-action-btn btn-whatsapp"
            onClick={onShareWhatsApp}
            title="Share this briefing update directly to WhatsApp"
          >
            <Share2 size={14} />
            <span>Share WhatsApp Briefing</span>
          </button>

          <button
            type="button"
            className="briefing-action-btn btn-copy"
            onClick={handleCopy}
            title="Copy formatted briefing to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? '✓ Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            type="button"
            className={`briefing-action-btn btn-refresh ${refreshing ? 'is-spinning' : ''}`}
            onClick={handleRefresh}
            title="Refresh latest cloud data"
          >
            <RefreshCw size={13} />
          </button>
        </footer>

        {lastUpdated && (
          <div className="briefing-timestamp">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}
