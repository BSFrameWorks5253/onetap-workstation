import React from 'react'
import type { PageKey } from '../../types'
import PageIcon from '../PageIcon'
import './TrayDock.css'

interface ActiveJob {
  running: boolean
  progress: number
  done: number
  total: number
  status: string
  speed?: string
  eta?: string
}

interface PrprojActiveJob {
  running: boolean
  progress: number
  status: string
}

interface TrayDockProps {
  adderJob: ActiveJob
  syncJob: ActiveJob
  prprojJob?: PrprojActiveJob
  onNavigate: (page: PageKey) => void
}

export default function TrayDock({ adderJob, syncJob, prprojJob, onNavigate }: TrayDockProps): JSX.Element {
  const showAdder = adderJob.running
  const showSync = syncJob.running
  const showPrproj = prprojJob?.running

  if (!showAdder && !showSync && !showPrproj) return <></>

  return (
    <div className="tray-dock anim-slide-in-up">
      {/* Video Render Active Job */}
      {showAdder && (
        <div className="tray-card tray-card--adder" onClick={() => onNavigate('adder')} title="Click to view Title Adder workstation">
          <div className="tray-header">
            <div className="tray-icon-box">
              <PageIcon pageKey="adder" size={17} color="var(--accent-adder, #6366f1)" />
            </div>
            <div className="tray-header-info">
              <span className="tray-title">Title Adder Active</span>
              <span className="tray-subtitle">Rendering queue in background</span>
            </div>
            <div className="tray-status-badge">
              <span className="tray-pulse" />
              <span className="tray-status-text">LIVE</span>
            </div>
          </div>
          <div className="tray-progress-wrap">
            <div className="tray-progress-bar">
              <div className="tray-progress-fill" style={{ width: `${adderJob.progress}%` }} />
            </div>
            <span className="tray-percent">{Math.round(adderJob.progress)}%</span>
          </div>
          <div className="tray-meta">
            <span className="tray-meta-chip">
              📹 {adderJob.done} / {adderJob.total || '?'} videos
            </span>
            {adderJob.speed && (
              <span className="tray-meta-chip">
                ⚡ {adderJob.speed}
              </span>
            )}
            {adderJob.eta && (
              <span className="tray-meta-chip">
                ⏱️ {adderJob.eta}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Premiere Project Generator Active Job */}
      {showPrproj && (
        <div className="tray-card tray-card--prproj" onClick={() => onNavigate('prproj')} title="Click to view Premiere Generator">
          <div className="tray-header">
            <div className="tray-icon-box">
              <PageIcon pageKey="prproj" size={17} color="var(--accent-adder, #6366f1)" />
            </div>
            <div className="tray-header-info">
              <span className="tray-title">Sequence Generator Active</span>
              <span className="tray-subtitle">Building Premiere project</span>
            </div>
            <div className="tray-status-badge">
              <span className="tray-pulse" />
              <span className="tray-status-text">LIVE</span>
            </div>
          </div>
          <div className="tray-progress-wrap">
            <div className="tray-progress-bar">
              <div className="tray-progress-fill" style={{ width: `${prprojJob.progress}%` }} />
            </div>
            <span className="tray-percent">{Math.round(prprojJob.progress)}%</span>
          </div>
          <div className="tray-meta">
            <span className="tray-meta-chip">
              📁 {prprojJob.status || 'Generating sequence timelines...'}
            </span>
          </div>
        </div>
      )}

      {/* Drive Sync Active Job */}
      {showSync && (
        <div className="tray-card tray-card--sync" onClick={() => onNavigate('drivesync')} title="Click to view Drive Sync">
          <div className="tray-header">
            <div className="tray-icon-box">
              <PageIcon pageKey="drivesync" size={17} color="var(--accent-drivesync, #10b981)" />
            </div>
            <div className="tray-header-info">
              <span className="tray-title">Drive Sync Active</span>
              <span className="tray-subtitle">Syncing files with cloud</span>
            </div>
            <div className="tray-status-badge">
              <span className="tray-pulse" />
              <span className="tray-status-text">SYNC</span>
            </div>
          </div>
          <div className="tray-progress-wrap">
            <div className="tray-progress-bar">
              <div className="tray-progress-fill" style={{ width: `${syncJob.progress}%` }} />
            </div>
            <span className="tray-percent">{Math.round(syncJob.progress)}%</span>
          </div>
          <div className="tray-meta">
            <span className="tray-meta-chip">
              ☁️ {syncJob.done} / {syncJob.total || '?'} files
            </span>
            {syncJob.speed && (
              <span className="tray-meta-chip">
                ⚡ {syncJob.speed}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
