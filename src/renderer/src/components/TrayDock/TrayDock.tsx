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
        <div className="tray-card tray-card--adder" onClick={() => onNavigate('adder')}>
          <div className="tray-header">
            <span className="tray-icon"><PageIcon pageKey="adder" size={18} color="var(--accent-adder)" /></span>
            <span className="tray-title">Title Adder Active</span>
            <span className="tray-pulse" />
          </div>
          <div className="tray-progress-wrap">
            <div className="tray-progress-bar">
              <div className="tray-progress-fill" style={{ width: `${adderJob.progress}%` }} />
            </div>
            <span className="tray-percent">{Math.round(adderJob.progress)}%</span>
          </div>
          <div className="tray-meta">
            <span>{adderJob.done} / {adderJob.total || '?'} videos</span>
            {adderJob.speed && <span>· Speed: {adderJob.speed}</span>}
            {adderJob.eta && <span>· ETA: {adderJob.eta}</span>}
          </div>
        </div>
      )}

      {/* Premiere Project Generator Active Job */}
      {showPrproj && (
        <div className="tray-card tray-card--adder" onClick={() => onNavigate('prproj')} style={{ borderLeftColor: '#9999FF' }}>
          <div className="tray-header">
            <span className="tray-icon"><PageIcon pageKey="prproj" size={18} /></span>
            <span className="tray-title">Sequence Generator Active</span>
            <span className="tray-pulse" />
          </div>
          <div className="tray-progress-wrap">
            <div className="tray-progress-bar">
              <div className="tray-progress-fill" style={{ width: `${prprojJob.progress}%`, background: 'linear-gradient(90deg, #9999FF, #6366F1)' }} />
            </div>
            <span className="tray-percent">{Math.round(prprojJob.progress)}%</span>
          </div>
          <div className="tray-meta">
            <span>{prprojJob.status || 'Generating sequence timelines...'}</span>
          </div>
        </div>
      )}

      {/* Drive Sync Active Job */}
      {showSync && (
        <div className="tray-card tray-card--sync" onClick={() => onNavigate('drivesync')}>
          <div className="tray-header">
            <span className="tray-icon"><PageIcon pageKey="drivesync" size={18} color="#34D399" /></span>
            <span className="tray-title">Drive Sync Active</span>
            <span className="tray-pulse" />
          </div>
          <div className="tray-progress-wrap">
            <div className="tray-progress-bar">
              <div className="tray-progress-fill" style={{ width: `${syncJob.progress}%` }} />
            </div>
            <span className="tray-percent">{Math.round(syncJob.progress)}%</span>
          </div>
          <div className="tray-meta">
            <span>{syncJob.done} / {syncJob.total || '?'} files</span>
            {syncJob.speed && <span>· {syncJob.speed}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
