import React, { useState } from 'react'
import {
  Smartphone,
  Tablet,
  X,
  Maximize2,
  RotateCw,
  Sparkles,
  Wifi,
  Battery,
  Layers,
  ExternalLink
} from 'lucide-react'
import type { SafarGroup, Snapshot, SafarTask } from '../App'

interface MobileSimulatorModalProps {
  isOpen: boolean
  onClose: () => void
  currentSafar?: string
  safarGroups: SafarGroup[]
  snapshot: Snapshot
  onShareWhatsApp: (safarName: string, mode: 'msg' | 'image') => void
}

type DevicePreset = 'iphone16' | 'pixel9' | 'compact'

export default function MobileSimulatorModal({
  isOpen,
  onClose,
  currentSafar,
  safarGroups,
  snapshot,
  onShareWhatsApp
}: MobileSimulatorModalProps): JSX.Element | null {
  const [device, setDevice] = useState<DevicePreset>('iphone16')
  const [scale, setScale] = useState<number>(0.9)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pipeline' | 'photos' | 'radar'>('dashboard')

  if (!isOpen) return null

  const ongoingGroup = safarGroups.find(g => g.safarName === currentSafar) || safarGroups[0]

  // Device dimensions
  const deviceSpecs: Record<DevicePreset, { width: number; height: number; name: string }> = {
    iphone16: { width: 393, height: 852, name: 'iPhone 16 Pro (393 × 852)' },
    pixel9: { width: 412, height: 892, name: 'Google Pixel 9 (412 × 892)' },
    compact: { width: 360, height: 780, name: 'Compact Phone (360 × 780)' }
  }

  const currentSpec = deviceSpecs[device]

  return (
    <div className="mobile-simulator-overlay" onClick={onClose}>
      <div
        className="mobile-simulator-window"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Desktop Mobile Device Simulator"
      >
        {/* Top Control Bar */}
        <div className="simulator-header">
          <div className="simulator-title-group">
            <div className="simulator-badge">
              <Smartphone size={14} />
              <span>LIVE DESKTOP MOBILE PREVIEW</span>
            </div>
            <span className="simulator-safar-name">{ongoingGroup?.safarName || 'Active Safar'}</span>
          </div>

          <div className="simulator-controls">
            {/* Device Switcher */}
            <div className="simulator-device-toggles">
              <button
                type="button"
                className={`simulator-toggle-btn ${device === 'iphone16' ? 'active' : ''}`}
                onClick={() => setDevice('iphone16')}
                title="iPhone 16 Pro View"
              >
                iPhone
              </button>
              <button
                type="button"
                className={`simulator-toggle-btn ${device === 'pixel9' ? 'active' : ''}`}
                onClick={() => setDevice('pixel9')}
                title="Pixel 9 View"
              >
                Pixel
              </button>
              <button
                type="button"
                className={`simulator-toggle-btn ${device === 'compact' ? 'active' : ''}`}
                onClick={() => setDevice('compact')}
                title="Compact Phone View"
              >
                Compact
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="simulator-zoom-group">
              <button
                type="button"
                className={`simulator-zoom-btn ${scale === 0.8 ? 'active' : ''}`}
                onClick={() => setScale(0.8)}
              >
                80%
              </button>
              <button
                type="button"
                className={`simulator-zoom-btn ${scale === 0.9 ? 'active' : ''}`}
                onClick={() => setScale(0.9)}
              >
                90%
              </button>
              <button
                type="button"
                className={`simulator-zoom-btn ${scale === 1 ? 'active' : ''}`}
                onClick={() => setScale(1)}
              >
                100%
              </button>
            </div>

            <button
              type="button"
              className="simulator-close-btn"
              onClick={onClose}
              title="Close Mobile Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Simulator Workspace Stage */}
        <div className="simulator-stage">
          <div
            className="smartphone-frame"
            style={{
              width: currentSpec.width,
              height: currentSpec.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top center'
            }}
          >
            {/* Phone Bezel Buttons Simulation */}
            <div className="phone-button-power" />
            <div className="phone-button-volume-up" />
            <div className="phone-button-volume-down" />

            {/* Dynamic Island / Notch */}
            <div className="phone-notch">
              <div className="notch-camera" />
              <div className="notch-sensor" />
            </div>

            {/* Simulated Mobile Status Bar */}
            <div className="phone-status-bar">
              <span className="status-time">9:41</span>
              <div className="status-icons">
                <Wifi size={13} />
                <span className="status-5g">5G</span>
                <Battery size={14} />
              </div>
            </div>

            {/* Simulated Mobile Viewport Content */}
            <div className="phone-screen-content">
              {/* Mobile App Header */}
              <div className="mobile-app-header">
                <div className="mobile-brand-row">
                  <div className="mobile-brand-logo">1T</div>
                  <div>
                    <div className="mobile-brand-title">One Tap Studio</div>
                    <div className="mobile-brand-sub">Mobile Workstation</div>
                  </div>
                </div>
                <div className="mobile-live-sync-pill">
                  <span className="mobile-sync-dot" />
                  <span>Cloud DB</span>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'dashboard' && (
                <div className="mobile-tab-scroll">
                  {/* Active Safar Executive Card */}
                  <div className="mobile-hero-card">
                    <div className="mobile-hero-tag">
                      {ongoingGroup?.isDone ? '🏆 100% COMPLETED' : '📍 ACTIVE ONGOING CAMPAIGN'}
                    </div>
                    <div className="mobile-hero-title">{ongoingGroup?.safarName || 'Mumbai Safar'}</div>
                    <div className="mobile-hero-dates">
                      • {ongoingGroup?.total || 8} Scheduled Dates · {ongoingGroup ? Math.round((ongoingGroup.deliveredCount / (ongoingGroup.total || 1)) * 100) : 50}% Delivered
                    </div>

                    {/* Multi-stage color progress bar */}
                    <div className="mobile-progress-bar-wrap">
                      <div className="mobile-progress-segment amber" style={{ width: '25%' }} />
                      <div className="mobile-progress-segment blue" style={{ width: '15%' }} />
                      <div className="mobile-progress-segment cyan" style={{ width: '10%' }} />
                      <div className="mobile-progress-segment emerald" style={{ width: '50%' }} />
                    </div>

                    {/* Stats pills */}
                    <div className="mobile-spotlight-row">
                      <div className="mobile-spotlight-chip">🎬 {ongoingGroup?.deliveredCount || 4}/{ongoingGroup?.total || 8} Videos</div>
                      <div className="mobile-spotlight-chip">📸 4/8 Photos in Drive</div>
                    </div>

                    {/* WhatsApp Action Buttons */}
                    <button
                      type="button"
                      className="mobile-whatsapp-cta-btn"
                      onClick={() => ongoingGroup && onShareWhatsApp(ongoingGroup.safarName, 'msg')}
                    >
                      <span>💬 Send Daily WhatsApp Briefing</span>
                    </button>

                    <div className="mobile-secondary-actions">
                      <button
                        type="button"
                        className="mobile-sub-btn"
                        onClick={() => ongoingGroup && onShareWhatsApp(ongoingGroup.safarName, 'image')}
                      >
                        🖼️ Image Card
                      </button>
                      <button
                        type="button"
                        className="mobile-sub-btn"
                        onClick={() => setActiveTab('pipeline')}
                      >
                        📊 Open Pipeline
                      </button>
                    </div>
                  </div>

                  {/* Scheduled Dates List */}
                  <div className="mobile-section-header">Scheduled Dates Schedule</div>
                  <div className="mobile-tasks-list">
                    {(ongoingGroup?.tasks || []).slice(0, 6).map((t: SafarTask, idx: number) => (
                      <div key={idx} className="mobile-task-item">
                        <div>
                          <div className="mobile-task-title">{t.dateFolder}</div>
                          <div className="mobile-task-editor">{t.editorName || 'Editor Assigned'}</div>
                        </div>
                        <span className={`mobile-stage-chip ${t.stage}`}>{t.stage.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'pipeline' && (
                <div className="mobile-tab-scroll">
                  <div className="mobile-section-header">Kanban Pipeline</div>
                  <div className="mobile-filter-pills">
                    <span className="mobile-pill active">All ({ongoingGroup?.tasks?.length || 8})</span>
                    <span className="mobile-pill">Editing (2)</span>
                    <span className="mobile-pill">Review (1)</span>
                    <span className="mobile-pill">Uploaded (4)</span>
                  </div>

                  <div className="mobile-tasks-list">
                    {(ongoingGroup?.tasks || []).map((t: SafarTask, idx: number) => (
                      <div key={idx} className="mobile-kanban-card">
                        <div className="mobile-kanban-top">
                          <strong>{t.dateFolder}</strong>
                          <span className={`mobile-stage-chip ${t.stage}`}>{t.stage}</span>
                        </div>
                        <div className="mobile-kanban-meta">Editor: {t.editorName || 'Mustafa'} • 48 mins</div>
                        <button type="button" className="mobile-advance-btn">
                          Advance Stage →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'photos' && (
                <div className="mobile-tab-scroll">
                  <div className="mobile-section-header">Google Drive Photo Tracker</div>
                  <div className="mobile-drive-overview-box">
                    <div className="drive-overview-top">
                      <span>📸 DRIVE SYNC STATUS</span>
                      <strong>680 / 1,020 Photos</strong>
                    </div>
                    <div className="mobile-progress-bar-wrap">
                      <div className="mobile-progress-segment emerald" style={{ width: '68%' }} />
                    </div>
                    <div className="drive-overview-sub">4 of 8 dates fully synced to cloud</div>
                  </div>

                  <div className="mobile-tasks-list">
                    {(ongoingGroup?.tasks || []).map((t: SafarTask, idx: number) => (
                      <div key={idx} className="mobile-photo-item">
                        <div>
                          <div className="mobile-task-title">{t.dateFolder}</div>
                          <div className="mobile-task-editor">120 / 120 Photos</div>
                        </div>
                        <span className="mobile-stage-chip uploaded">Drive Uploaded</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'radar' && (
                <div className="mobile-tab-scroll">
                  <div className="mobile-section-header">Ingest Radar & AI Audio</div>
                  <div className="mobile-radar-banner">
                    <div className="radar-icon-pulse">📡</div>
                    <div>
                      <strong>Sentinel Status: Scanning</strong>
                      <div className="radar-sub">All expected cards verified</div>
                    </div>
                  </div>

                  <div className="mobile-audio-cta-box">
                    <strong>🎙️ AI Audio Briefing Synthesizer</strong>
                    <div className="audio-sub">Generate and listen to spoken daily memo</div>
                    <button type="button" className="mobile-audio-btn">
                      ▶ Play Spoken Memo
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Mobile Navigation Bar */}
              <div className="mobile-bottom-nav">
                <button
                  type="button"
                  className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  <span className="nav-icon">📊</span>
                  <span className="nav-label">Dashboard</span>
                </button>
                <button
                  type="button"
                  className={`mobile-nav-item ${activeTab === 'pipeline' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pipeline')}
                >
                  <span className="nav-icon">⚡</span>
                  <span className="nav-label">Pipeline</span>
                </button>
                <button
                  type="button"
                  className={`mobile-nav-item ${activeTab === 'photos' ? 'active' : ''}`}
                  onClick={() => setActiveTab('photos')}
                >
                  <span className="nav-icon">📸</span>
                  <span className="nav-label">Photos</span>
                </button>
                <button
                  type="button"
                  className={`mobile-nav-item ${activeTab === 'radar' ? 'active' : ''}`}
                  onClick={() => setActiveTab('radar')}
                >
                  <span className="nav-icon">📡</span>
                  <span className="nav-label">Radar</span>
                </button>
              </div>

              {/* Home Indicator Bar */}
              <div className="phone-home-indicator" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
