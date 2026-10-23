import React, { useState, useEffect } from 'react'
import './RenderingMonitorWidget.css'

export interface RenderMonitorState {
  active: boolean
  jobId: string
  videoName: string
  currentIdx: number
  totalVideos: number
  percent: number
  fps: string
  speed: string
  eta: string
  thumbnailPath: string
  task: string
  outputFolder: string
  done: boolean
  success: boolean
  isPaused: boolean
}

export function RenderingMonitorWidget(): JSX.Element | null {
  const [state, setState] = useState<RenderMonitorState>({
    active: false,
    jobId: '',
    videoName: '',
    currentIdx: 0,
    totalVideos: 0,
    percent: 0,
    fps: '',
    speed: '',
    eta: '',
    thumbnailPath: '',
    task: '',
    outputFolder: '',
    done: false,
    success: true,
    isPaused: false
  })

  const [islandEnabled, setIslandEnabled] = useState(true)
  const [islandVisible, setIslandVisible] = useState(false)

  useEffect(() => {
    const api = (window as any).api?.island
    if (!api) return

    api.isEnabled?.().then((en: boolean) => {
      if (typeof en === 'boolean') setIslandEnabled(en)
    })

    api.getState?.().then((init: RenderMonitorState) => {
      if (init) {
        setState(init)
        if (init.active) setIslandVisible(true)
      }
    })

    const unsub = api.onUpdate?.((data: RenderMonitorState) => {
      setState(data)
      if (data?.active) setIslandVisible(true)
      if (data?.done) {
        setTimeout(() => setIslandVisible(false), 6000)
      }
    })

    return () => {
      if (unsub) unsub()
    }
  }, [])

  const handlePreviewIsland = () => {
    const api = (window as any).api?.island
    if (api?.preview) {
      api.preview()
      setIslandVisible(true)
    }
  }

  const handleHideIsland = () => {
    const api = (window as any).api?.island
    if (api?.hide) {
      api.hide()
      setIslandVisible(false)
    }
  }

  const handleToggleIslandEnabled = async () => {
    const api = (window as any).api?.island
    const nextVal = !islandEnabled
    setIslandEnabled(nextVal)
    if (api?.setEnabled) {
      await api.setEnabled(nextVal)
      if (!nextVal) {
        setIslandVisible(false)
      }
    }
  }

  function navigateToAdder() {
    if (typeof (window as any).showPage === 'function') {
      (window as any).showPage('adder')
    }
  }

  const triggerAction = (action: string) => {
    const api = (window as any).api?.island
    if (api?.action) {
      api.action(action)
    }
  }

  const getThumbnailSrc = () => {
    if (!state.thumbnailPath) return null
    const clean = state.thumbnailPath.replace(/\\/g, '/')
    return clean.startsWith('http') ? clean : `local-resource://${clean}`
  }

  if (!state.active && !state.done) {
    return (
      <div className="rmw-container rmw-idle">
        <div className="rmw-header">
          <div className="rmw-header-left">
            <div className="rmw-badge rmw-badge-idle">
              <span className="rmw-idle-dot" />
              <span className="rmw-badge-text">STANDBY</span>
            </div>
            <h3 className="rmw-title">Title Adder & Rendering Monitor</h3>
            <span className="rmw-queue-counter">0 Active Tasks</span>
          </div>

          <div className="rmw-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Toggle Dynamic Island auto-popup feature */}
            <div
              className={`rmw-island-toggle-pill ${!islandEnabled ? 'is-disabled' : ''}`}
              onClick={handleToggleIslandEnabled}
              title={islandEnabled ? 'Dynamic Island floating pill is ON (click to disable)' : 'Dynamic Island floating pill is OFF (click to enable)'}
            >
              <span>{islandEnabled ? '🏝 Island: ON' : '🏝 Island: OFF'}</span>
            </div>

            {islandEnabled && !islandVisible && (
              <button
                className="rmw-nav-btn rmw-island-preview-btn"
                onClick={handlePreviewIsland}
                title="Launch Dynamic Island preview on top of screen"
              >
                <span>🏝 Test Island</span>
              </button>
            )}

            {islandVisible && (
              <button
                className="rmw-nav-btn rmw-island-hide-btn"
                onClick={handleHideIsland}
                title="Dismiss/Remove Dynamic Island from screen"
              >
                <span>✕ Hide Island</span>
              </button>
            )}

            <button className="rmw-nav-btn" onClick={navigateToAdder} title="Open Title Adder Studio">
              <span>Studio</span> →
            </button>
          </div>
        </div>

        <div className="rmw-idle-content">
          <div className="rmw-idle-icon">⚡</div>
          <div className="rmw-idle-text">
            <strong>Ready for video rendering & subtitle typography automation.</strong>
            <span>
              {islandEnabled
                ? 'When Title Adder renders videos, live speed, thumbnail preview, and countdown (e.g. 2/5 left) stream both here and in the top Dynamic Island pill.'
                : 'In-app dashboard monitor is active. Floating desktop Dynamic Island overlay is turned off.'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const thumbUrl = getThumbnailSrc()

  return (
    <div className={`rmw-container ${state.done ? 'rmw-done' : ''}`}>
      <div className="rmw-header">
        <div className="rmw-header-left">
          <div className="rmw-badge">
            <span className="rmw-pulse-dot" />
            <span className="rmw-badge-text">
              {state.done ? 'COMPLETED' : state.isPaused ? 'PAUSED' : 'LIVE RENDERING'}
            </span>
          </div>

          <h3 className="rmw-title">
            Title Adder Monitor
          </h3>

          <span className="rmw-queue-counter">
            {state.totalVideos > 0
              ? `${state.currentIdx || 1}/${state.totalVideos} videos (${Math.max(0, state.totalVideos - (state.currentIdx || 1))} left)`
              : 'Processing'}
          </span>
        </div>

        <div className="rmw-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {islandVisible ? (
            <button
              className="rmw-nav-btn rmw-island-hide-btn"
              onClick={handleHideIsland}
              title="Dismiss/Remove floating Dynamic Island pill from screen"
            >
              <span>✕ Hide Island</span>
            </button>
          ) : (
            islandEnabled && (
              <button
                className="rmw-nav-btn rmw-island-preview-btn"
                onClick={handlePreviewIsland}
                title="Show floating Dynamic Island pill on screen"
              >
                <span>🏝 Show Island</span>
              </button>
            )
          )}
          <button className="rmw-nav-btn" onClick={navigateToAdder} title="Open Title Adder Studio">
            <span>Studio</span> →
          </button>
        </div>
      </div>

      <div className="rmw-content">
        <div className="rmw-thumb">
          {thumbUrl ? (
            <img src={thumbUrl} alt="Rendering frame" />
          ) : (
            <div className="rmw-thumb-fallback">🎬</div>
          )}
        </div>

        <div className="rmw-details">
          <div className="rmw-task-row">
            <span className="rmw-task-label">Current:</span>
            <span className="rmw-task-val" title={state.task || state.videoName}>
              {state.task || state.videoName || 'Rendering video clip...'}
            </span>
          </div>

          <div className="rmw-bar-row">
            <div className="rmw-bar-track">
              <div
                className="rmw-bar-fill"
                style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }}
              />
            </div>
            <span className="rmw-bar-pct">{state.percent}%</span>
          </div>

          <div className="rmw-meta-row">
            {state.speed && <span className="rmw-pill">⚡ {state.speed}</span>}
            {state.fps && <span className="rmw-pill">🎥 {state.fps}</span>}
            {state.eta && state.eta !== '--:--' && <span className="rmw-pill">⏱ {state.eta}</span>}
            {state.outputFolder && (
              <span className="rmw-pill rmw-pill-clickable" onClick={() => triggerAction('open-folder')} title="Open destination folder">
                📂 Output
              </span>
            )}
          </div>
        </div>

        <div className="rmw-actions">
          {!state.done && (
            <>
              <button
                className={`rmw-action-btn ${state.isPaused ? 'btn-resume' : 'btn-pause'}`}
                onClick={() => triggerAction(state.isPaused ? 'resume' : 'pause')}
              >
                {state.isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                className="rmw-action-btn btn-cancel"
                onClick={() => triggerAction('cancel')}
              >
                ✕ Cancel
              </button>
            </>
          )}

          {state.outputFolder && (
            <button
              className="rmw-action-btn btn-folder"
              onClick={() => triggerAction('open-folder')}
            >
              📂 Open
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default RenderingMonitorWidget
