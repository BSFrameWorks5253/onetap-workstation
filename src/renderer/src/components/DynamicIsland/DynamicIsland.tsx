import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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

export function DynamicIsland({ floating = false }: { floating?: boolean }): JSX.Element | null {
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
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState<boolean>(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!floating) {
      document.documentElement.style.background = 'transparent'
      document.body.style.background = 'transparent'
      const rootEl = document.getElementById('root')
      if (rootEl) rootEl.style.background = 'transparent'
    }

    const api = (window as any).api?.island
    if (!api) return

    // Load initial state
    api.getState?.().then((initial: IslandState) => {
      if (initial) setState(initial)
    })

    // Listen to real-time updates from Title Adder / Main Process
    const unsub = api.onUpdate((data: IslandState) => {
      if (data) setState(data)
      if (data?.done) {
        setTimeout(() => {
          handleClose()
        }, 4000)
      }
    })

    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [floating])

  // Sync window size with Electron when toggling compact vs expanded card
  useEffect(() => {
    if (floating) return
    const api = (window as any).api?.island
    if (!api?.setSize) return

    if (isExpanded) {
      api.setSize(480, 240)
    } else {
      api.setSize(430, 48)
    }
  }, [isExpanded, floating])

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setIsExpanded(true)
    }, 200)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isCancelConfirmOpen) {
        setIsExpanded(false)
      }
    }, 320)
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

  const handleConfirmCancel = () => {
    setIsCancelConfirmOpen(false)
    triggerAction('cancel')
  }

  const getThumbnailSrc = () => {
    if (!state.thumbnailPath) return null
    const clean = state.thumbnailPath.replace(/\\/g, '/')
    return clean.startsWith('http') ? clean : `local-resource://${clean}`
  }

  const thumbUrl = getThumbnailSrc()
  const remainingCount = Math.max(0, (state.totalVideos || 1) - (state.currentIdx || 1))

  // If used in floating in-app mode, hide when idle
  if (floating && !state.active && !state.done) {
    return null
  }

  return (
    <>
      <div
        className={`dynamic-island-container ${isExpanded ? 'is-expanded' : 'is-compact'} ${state.done ? 'is-done' : ''} ${floating ? 'is-in-app-floating' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleClose}
      >
        {/* ── Compact VisionOS/Apple Pill ─────────────────────────── */}
        {!isExpanded ? (
          <div
            className="dynamic-island-pill"
            onClick={() => setIsExpanded(true)}
            title="Click to view detailed render progress"
          >
            <div className="pill-left">
              {/* Glowing Pulse Dot */}
              <div
                className={`pill-beacon-dot ${state.done ? 'beacon-done' : state.isPaused ? 'beacon-paused' : 'beacon-active'}`}
              />

              {/* Apple Equalizer Audio/Render Waves */}
              {!state.done && !state.isPaused && (
                <div className="pill-soundwave" aria-hidden="true">
                  <span className="wave-bar wave-1" />
                  <span className="wave-bar wave-2" />
                  <span className="wave-bar wave-3" />
                  <span className="wave-bar wave-4" />
                </div>
              )}

              {/* Active Video Title */}
              <span
                className="pill-title"
                title={state.videoName || (state.done ? 'Batch Complete' : 'Title Adder')}
              >
                {state.done
                  ? 'Batch Complete 🎉'
                  : state.isPaused
                    ? 'Paused'
                    : (state.videoName || 'Rendering Video')}
              </span>
            </div>

            {/* Micro Progress Bar (inspired by Tap Studio) */}
            {!state.done && (
              <div className="pill-micro-progress-track">
                <div
                  className="pill-micro-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }}
                />
              </div>
            )}

            <div className="pill-right">
              {!state.done ? (
                <>
                  <span className="pill-percent">
                    {Math.round(state.percent)}%
                  </span>
                  {remainingCount > 0 && (
                    <span className="pill-count">
                      ({remainingCount} left)
                    </span>
                  )}
                </>
              ) : (
                <span className="pill-all-done">Done</span>
              )}

              <svg className="pill-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>

              <button
                className="pill-close-btn"
                onClick={handleClose}
                title="Dismiss Dynamic Island"
                type="button"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* ── Expanded Island Panel ───────────────────────────────── */
          <div className="dynamic-island-card">
            {/* Card Header */}
            <div className="card-header">
              <div className="card-header-left">
                <div className={`card-activity-dot ${state.done ? 'beacon-done' : state.isPaused ? 'beacon-paused' : 'beacon-active'}`} />
                <div className="card-title-group">
                  <h4 className="card-title">
                    {state.done ? 'Render Queue Completed' : state.task || 'Title Adder Studio'}
                  </h4>
                  <span className="card-sub">
                    Video {state.currentIdx || 1} of {state.totalVideos || 1}
                    {remainingCount > 0 && ` (${remainingCount} left)`}
                  </span>
                </div>
              </div>

              <div className="card-header-right">
                <button
                  className="card-mini-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExpanded(false)
                  }}
                  title="Collapse to Pill"
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  className="card-mini-btn card-close-btn"
                  onClick={handleClose}
                  title="Dismiss Dynamic Island"
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Card Body: Thumbnail & Details */}
            <div className="card-body">
              <div className="card-thumb-preview">
                {thumbUrl ? (
                  <img src={thumbUrl} alt="Thumbnail preview" />
                ) : (
                  <div className="card-thumb-placeholder">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="card-info">
                <div className="card-task-line" title={state.videoName}>
                  {state.videoName || 'Staged item'}
                </div>

                {/* Meta Row: Speed, ETA, Remaining */}
                <div className="card-meta-row">
                  <span className="meta-badge">
                    Speed: <strong>{state.speed || '1.2x'}</strong>
                  </span>
                  <span className="meta-badge">
                    ETA: <strong>{state.eta && state.eta !== '--:--' ? state.eta : 'Calculating...'}</strong>
                  </span>
                  <span className="meta-badge">
                    Queue: <strong>{state.currentIdx}/{state.totalVideos}</strong>
                  </span>
                </div>

                {/* High Resolution Progress Track */}
                <div className="card-progress-section">
                  <div className="card-progress-labels">
                    <span>Encoding progress</span>
                    <span className="card-progress-value">{state.percent.toFixed(1)}%</span>
                  </div>
                  <div className="card-progress-bar-track">
                    <div
                      className="card-progress-bar-fill"
                      style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }}
                    />
                  </div>
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
                      type="button"
                    >
                      {state.isPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>

                    <button
                      className="card-action-btn btn-danger-cancel"
                      onClick={() => setIsCancelConfirmOpen(true)}
                      title="Cancel Rendering"
                      type="button"
                    >
                      Cancel Render
                    </button>
                  </>
                )}

                {state.outputFolder && (
                  <button
                    className="card-action-btn btn-folder"
                    onClick={() => triggerAction('open-folder')}
                    title="Open Output Folder in Explorer"
                    type="button"
                  >
                    📂 Output
                  </button>
                )}
              </div>

              <button
                className="card-action-btn btn-focus"
                onClick={() => triggerAction('focus-app')}
                title="View in UniDesk App"
                type="button"
              >
                ↗ View in App
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cancel Confirmation Modal (Inspired by Tap Studio) ───────── */}
      {isCancelConfirmOpen && createPortal(
        <div className="island-modal-backdrop" onClick={() => setIsCancelConfirmOpen(false)}>
          <div className="island-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="island-modal-header">
              <div className="island-modal-warning-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="island-modal-title">Cancel Rendering?</h3>
                <p className="island-modal-sub">This will immediately terminate the active video export.</p>
              </div>
            </div>

            <p className="island-modal-body">
              Any partially rendered file will be halted and the queue will be paused. Do you want to cancel now?
            </p>

            <div className="island-modal-actions">
              <button
                type="button"
                className="island-modal-btn island-btn-secondary"
                onClick={() => setIsCancelConfirmOpen(false)}
              >
                Continue Rendering
              </button>
              <button
                type="button"
                className="island-modal-btn island-btn-danger"
                onClick={handleConfirmCancel}
              >
                Yes, Cancel Now
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default DynamicIsland
