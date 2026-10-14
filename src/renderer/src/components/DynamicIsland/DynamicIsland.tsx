import React, { useState, useEffect, useRef } from 'react'
import './DynamicIsland.css'

export interface IslandState {
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

export function DynamicIsland(): JSX.Element {
  const [state, setState] = useState<IslandState>({
    active: false,
    jobId: '',
    videoName: 'Video_01.mp4',
    currentIdx: 1,
    totalVideos: 1,
    percent: 0,
    fps: '60 fps',
    speed: '1.5x',
    eta: '--:--',
    thumbnailPath: '',
    task: 'Initializing render pipeline...',
    outputFolder: '',
    done: false,
    success: true,
    isPaused: false
  })

  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    const rootEl = document.getElementById('root')
    if (rootEl) rootEl.style.background = 'transparent'

    const api = (window as any).api?.island
    if (!api) return

    // Load initial state
    api.getState?.().then((initial: IslandState) => {
      if (initial) setState(initial)
    })

    // Listen to real-time updates from Title Adder
    const unsub = api.onUpdate((data: IslandState) => {
      setState(data)
      if (data?.done) {
        setTimeout(() => {
          handleClose()
        }, 3500)
      }
    })

    return () => {
      if (unsub) unsub()
    }
  }, [])

  // Sync window size with Electron when toggling compact vs expanded card
  useEffect(() => {
    const api = (window as any).api?.island
    if (!api?.setSize) return

    if (isExpanded) {
      api.setSize(440, 220)
    } else {
      api.setSize(420, 44)
    }
  }, [isExpanded])

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setIsExpanded(true)
    }, 180)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false)
    }, 280)
  }

  const triggerAction = (action: string) => {
    const api = (window as any).api?.island
    if (api?.action) {
      api.action(action)
    }
  }

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    const api = (window as any).api?.island
    if (api?.close) {
      api.close()
    } else if (api?.hide) {
      api.hide()
    }
  }

  const getThumbnailSrc = () => {
    if (!state.thumbnailPath) return null
    // Support local-resource protocol for Electron file display
    const clean = state.thumbnailPath.replace(/\\/g, '/')
    return clean.startsWith('http') ? clean : `local-resource://${clean}`
  }

  const thumbUrl = getThumbnailSrc()

  return (
    <div
      className={`dynamic-island-container ${isExpanded ? 'is-expanded' : 'is-compact'} ${state.done ? 'is-done' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleClose}
    >
      {/* ── Compact Pill State ────────────────────────────────────── */}
      {!isExpanded && (
        <div className="dynamic-island-pill" onClick={() => setIsExpanded(true)}>
          <div className="pill-left">
            <span className="pill-pulse-icon">
              {state.done ? '✔' : state.isPaused ? '⏸' : '⚡'}
            </span>
            {/* Animated Audio/Render Waves */}
            {!state.done && !state.isPaused && (
              <div className="pill-soundwave">
                <span className="wave-bar wave-1" />
                <span className="wave-bar wave-2" />
                <span className="wave-bar wave-3" />
                <span className="wave-bar wave-4" />
              </div>
            )}
            <span
              className="pill-title"
              title={state.videoName || (state.done ? 'Batch Complete' : 'Title Adder')}
            >
              {state.done
                ? 'Batch Complete 🎉'
                : state.isPaused
                  ? 'Paused'
                  : (state.videoName || 'Title Adder')}
            </span>
          </div>

          <div className="pill-right">
            {!state.done ? (
              <>
                <span className="pill-percent">{state.percent}%</span>
                <span className="pill-divider">|</span>
                <span className="pill-count">
                  {state.totalVideos > 0
                    ? `${Math.max(0, state.totalVideos - state.currentIdx)} left`
                    : '1 left'}
                </span>
              </>
            ) : (
              <span className="pill-all-done">All Finished 🎉</span>
            )}
            <button
              className="pill-close-btn"
              onClick={handleClose}
              title="Close Dynamic Island (or Right-Click)"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Expanded Detail Card State ────────────────────────────── */}
      {isExpanded && (
        <div className="dynamic-island-card">
          {/* Card Header & Drag Handle */}
          <div className="card-header">
            <div className="card-header-left">
              <span className="card-icon">{state.done ? '✔' : '⚡'}</span>
              <div className="card-title-group">
                <h4 className="card-title">Title Adder Studio</h4>
                <span className="card-sub">
                  Video {state.currentIdx || 1} of {state.totalVideos || 1}
                  {state.totalVideos > 0 && ` (${state.totalVideos - state.currentIdx} left)`}
                </span>
              </div>
            </div>

            <div className="card-header-right" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="card-mini-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(false)
                }}
                title="Collapse to Pill"
              >
                ▼
              </button>
              <button
                className="card-mini-btn card-close-btn"
                onClick={handleClose}
                title="Close / Hide Dynamic Island"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Card Middle: Thumbnail Preview & Task Details */}
          <div className="card-body">
            <div className="card-thumb-preview">
              {thumbUrl ? (
                <img src={thumbUrl} alt="Thumbnail preview" />
              ) : (
                <div className="card-thumb-placeholder">
                  <span>🎬</span>
                </div>
              )}
            </div>

            <div className="card-info">
              <div className="card-task-line" title={state.task || state.videoName}>
                {state.task || `Processing: ${state.videoName}`}
              </div>

              {/* Progress Bar */}
              <div className="card-progress-bar-track">
                <div
                  className="card-progress-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }}
                />
              </div>

              {/* Meta stats: speed, FPS, ETA */}
              <div className="card-meta-row">
                <span className="meta-badge">
                  {state.percent}%
                </span>
                {state.speed && (
                  <span className="meta-pill">⚡ {state.speed}</span>
                )}
                {state.fps && (
                  <span className="meta-pill">🎬 {state.fps}</span>
                )}
                {state.eta && state.eta !== '--:--' && (
                  <span className="meta-pill">⏱ {state.eta}</span>
                )}
              </div>
            </div>
          </div>

          {/* Card Footer: Quick Actions */}
          <div className="card-footer">
            <div className="card-actions-left">
              {!state.done && (
                <>
                  <button
                    className={`card-action-btn ${state.isPaused ? 'btn-resume' : 'btn-pause'}`}
                    onClick={() => triggerAction(state.isPaused ? 'resume' : 'pause')}
                    title={state.isPaused ? 'Resume Rendering' : 'Pause Rendering'}
                  >
                    {state.isPaused ? '▶ Resume' : '⏸ Pause'}
                  </button>

                  <button
                    className="card-action-btn btn-cancel"
                    onClick={() => triggerAction('cancel')}
                    title="Cancel Render Queue"
                  >
                    ✕ Cancel
                  </button>
                </>
              )}

              {state.outputFolder && (
                <button
                  className="card-action-btn btn-folder"
                  onClick={() => triggerAction('open-folder')}
                  title="Open Output Folder in Explorer"
                >
                  📂 Output
                </button>
              )}
            </div>

            <button
              className="card-action-btn btn-focus"
              onClick={() => triggerAction('focus-app')}
              title="Open Uni Desk App"
            >
              ↗ View in App
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DynamicIsland
