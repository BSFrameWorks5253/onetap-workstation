import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './DynamicIsland.css'

export interface IslandState {
  active: boolean
  jobId: string
  videoName: string
  nextVideoName?: string
  currentIdx: number
  totalVideos: number
  percent: number
  fps: string
  speed: string
  eta: string
  thumbnailPath: string
  thumbnailDataUrl?: string
  task: string
  outputFolder: string
  lastOutputPath?: string
  encoder?: string
  done: boolean
  success: boolean
  isPaused: boolean
}

export function DynamicIsland({ floating = false }: { floating?: boolean }): JSX.Element | null {
  const [state, setState] = useState<IslandState>({
    active: false,
    jobId: '',
    videoName: 'Video_01.mp4',
    nextVideoName: '',
    currentIdx: 1,
    totalVideos: 1,
    percent: 0,
    fps: '60 fps',
    speed: '1.5x',
    eta: '--:--',
    thumbnailPath: '',
    thumbnailDataUrl: '',
    task: 'Initializing render pipeline...',
    outputFolder: '',
    lastOutputPath: '',
    encoder: '',
    done: false,
    success: true,
    isPaused: false
  })

  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState<boolean>(false)
  const [isDissolving, setIsDissolving] = useState<boolean>(false)
  const [isDismissed, setIsDismissed] = useState<boolean>(false)
  const [thumbFailed, setThumbFailed] = useState<boolean>(false)
  const [thumbBase64, setThumbBase64] = useState<string | null>(null)

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dissolveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setThumbFailed(false)
    setThumbBase64(null)

    if (state.thumbnailDataUrl) return

    if (state.thumbnailPath && (window as any).api?.viewer?.readImageBase64) {
      (window as any).api.viewer.readImageBase64(state.thumbnailPath).then((res: any) => {
        if (res && res.ok && res.dataUrl) {
          setThumbBase64(res.dataUrl)
        }
      }).catch(() => {})
    }
  }, [state.thumbnailPath, state.thumbnailDataUrl])

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

    const sysApi = (window as any).api?.system
    if (sysApi?.getEncoder) {
      sysApi.getEncoder().then((enc: any) => {
        if (enc?.label) setState(prev => ({ ...prev, encoder: enc.label }))
      }).catch(() => {})
    }

    // Listen to real-time updates from Title Adder / Main Process
    const unsub = api.onUpdate((data: IslandState) => {
      if (!data) return
      setState(data)

      if (data.active) {
        if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current)
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
        setIsDismissed(false)
        setIsDissolving(false)
      } else if (data.done) {
        // Subtle celebratory chime
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(587.33, ctx.currentTime)
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12)
          gain.gain.setValueAtTime(0.05, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 0.35)
        } catch {}

        const displayDuration = data.success ? 10000 : 3500
        if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current)
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current)

        dissolveTimerRef.current = setTimeout(() => {
          setIsDissolving(true)
          closeTimerRef.current = setTimeout(() => {
            setIsDismissed(true)
            setIsDissolving(false)
            if (!floating) {
              const apiInst = (window as any).api?.island
              if (apiInst?.close) apiInst.close()
              else if (apiInst?.hide) apiInst.hide()
            }
          }, 500)
        }, displayDuration)
      } else if (!data.active && !data.done) {
        setIsDissolving(true)
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
        closeTimerRef.current = setTimeout(() => {
          setIsDismissed(true)
          setIsDissolving(false)
        }, 400)
      }
    })

    const unsubDissolve = api.onDissolve?.(() => {
      setIsDissolving(true)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      closeTimerRef.current = setTimeout(() => {
        setIsDismissed(true)
        setIsDissolving(false)
      }, 500)
    })

    return () => {
      if (typeof unsub === 'function') unsub()
      if (typeof unsubDissolve === 'function') unsubDissolve()
      if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [floating])

  // Sync window size with Electron when toggling compact vs expanded card
  useEffect(() => {
    if (floating) return
    const api = (window as any).api?.island
    if (!api?.setSize) return

    if (isExpanded) {
      api.setSize(470, 226)
    } else {
      api.setSize(440, 72)
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
    }, 260)
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
    setIsDissolving(true)
    if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)

    closeTimerRef.current = setTimeout(() => {
      setIsDismissed(true)
      setIsDissolving(false)
      const api = (window as any).api?.island
      if (api?.close) {
        api.close()
      } else if (api?.hide) {
        api.hide()
      }
    }, 400)
  }

  const handleConfirmCancel = () => {
    setIsCancelConfirmOpen(false)
    triggerAction('cancel')
  }

  const getThumbnailSrc = () => {
    if (state.thumbnailDataUrl) return state.thumbnailDataUrl
    if (thumbBase64) return thumbBase64
    if (!state.thumbnailPath) return null
    if (state.thumbnailPath.startsWith('http') || state.thumbnailPath.startsWith('data:')) return state.thumbnailPath
    if (state.thumbnailPath.startsWith('local-resource://')) return state.thumbnailPath
    if (state.thumbnailPath.startsWith('file://')) return state.thumbnailPath.replace(/^file:\/\//, 'local-resource://')
    const forward = state.thumbnailPath.replace(/\\/g, '/')
    const encoded = encodeURI(forward).replace(/#/g, '%23')
    return `local-resource:///${encoded.replace(/^\//, '')}`
  }

  const thumbUrl = state.thumbnailDataUrl || thumbBase64 || getThumbnailSrc()
  const remainingCount = Math.max(0, (state.totalVideos || 1) - (state.currentIdx || 1))

  if (isDismissed || (floating && !state.active && !state.done)) {
    return null
  }

  return (
    <>
      <div
        className={`dynamic-island-container ${isExpanded ? 'is-expanded' : 'is-compact'} ${state.done ? 'is-done' : ''} ${floating ? 'is-in-app-floating' : ''} ${isDissolving ? 'is-dissolving' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleClose}
      >
        {/* ── Compact Apple VisionOS Island Pill ─────────────────────────── */}
        {!isExpanded ? (
          <div
            className="dynamic-island-pill"
            onClick={() => setIsExpanded(prev => !prev)}
            title="Click or hover to view render details"
          >
            <div className="pill-left">
              {/* Mini Title Artwork Thumbnail Preview */}
              {thumbUrl && !thumbFailed ? (
                <div className="pill-mini-thumb">
                  <img
                    src={thumbUrl}
                    alt="Thumbnail"
                    onError={() => setThumbFailed(true)}
                  />
                </div>
              ) : (
                <div className={`pill-status-dot ${state.done ? 'dot-done' : state.isPaused ? 'dot-paused' : 'dot-active'}`} />
              )}

              {/* Video Title & Queue Counter */}
              <div className="pill-title-container">
                <span
                  className="pill-title"
                  title={state.videoName || (state.done ? 'Batch Complete' : 'Title Adder')}
                >
                  {state.done
                    ? 'Batch Complete'
                    : state.isPaused
                      ? 'Paused'
                      : (state.videoName || 'Rendering Video')}
                </span>
                <span className="pill-sub">
                  {state.done
                    ? `${state.totalVideos} videos processed`
                    : state.nextVideoName && remainingCount > 0
                      ? `Next: ${state.nextVideoName}`
                      : `Video ${state.currentIdx || 1} of ${state.totalVideos || 1}`}
                </span>
              </div>
            </div>

            {/* Minimal Inline Progress Bar */}
            {!state.done && (
              <div className="pill-center-progress">
                <div className="pill-progress-bar-track">
                  <div
                    className="pill-progress-bar-fill"
                    style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pill-right">
              {!state.done ? (
                <span className="pill-percent">
                  {Math.round(state.percent)}%
                </span>
              ) : (
                <span className="pill-all-done">Done</span>
              )}

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
                <div className={`card-status-dot ${state.done ? 'dot-done' : state.isPaused ? 'dot-paused' : 'dot-active'}`} />
                <div className="card-title-group">
                  <h4 className="card-title">
                    {state.done ? 'Render Queue Completed' : 'Title Adder Studio'}
                  </h4>
                  <span className="card-sub">
                    Video {state.currentIdx || 1} of {state.totalVideos || 1}
                    {remainingCount > 0 && ` (${remainingCount} remaining)`}
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
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

            {/* Card Body: Title Thumbnail Preview & Metadata */}
            <div className="card-body">
              <div className="card-thumb-preview" title={state.thumbnailPath ? `Title Image: ${state.thumbnailPath.split(/[/\\]/).pop()}` : 'Title Image'}>
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt="Title Thumbnail Preview"
                    onError={() => setThumbFailed(true)}
                  />
                ) : (
                  <div className="card-thumb-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                      <circle cx="9" cy="9" r="2"/>
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                    </svg>
                  </div>
                )}
              </div>

              <div className="card-info">
                <div className="card-video-name" title={state.videoName}>
                  {state.videoName || 'Processing video'}
                </div>

                <div className="card-meta-row">
                  {state.speed && (
                    <span className="meta-badge">Speed <strong>{state.speed}</strong></span>
                  )}
                  <span className="meta-badge">ETA <strong>{state.eta && state.eta !== '--:--' ? state.eta : 'Calculating...'}</strong></span>
                  {state.fps && (
                    <span className="meta-badge">FPS <strong>{state.fps}</strong></span>
                  )}
                </div>

                {state.nextVideoName && !state.done && remainingCount > 0 && (
                  <div className="card-next-row" title={`Next in queue: ${state.nextVideoName}`}>
                    <span className="card-next-tag">NEXT</span>
                    <span className="card-next-name">{state.nextVideoName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* High Resolution Progress Track */}
            <div className="card-progress-section">
              <div className="card-progress-labels">
                <span>Encoding</span>
                <span className="card-progress-value">{state.percent.toFixed(1)}%</span>
              </div>
              <div className="card-progress-bar-track">
                <div
                  className="card-progress-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }}
                />
              </div>
            </div>

            {/* Actions Footer */}
            <div className="card-footer">
              <div className="card-actions-left">
                {!state.done ? (
                  <>
                    <button
                      className={`card-action-btn ${state.isPaused ? 'btn-resume' : 'btn-pause'}`}
                      onClick={() => triggerAction(state.isPaused ? 'resume' : 'pause')}
                      title={state.isPaused ? 'Resume' : 'Pause'}
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
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="card-action-btn btn-primary"
                    onClick={() => triggerAction('play-video')}
                    type="button"
                  >
                    Play Video
                  </button>
                )}
                {state.outputFolder && (
                  <button
                    className="card-action-btn btn-secondary"
                    onClick={() => triggerAction('open-folder')}
                    title="Open Output Folder"
                    type="button"
                  >
                    Open Folder
                  </button>
                )}
              </div>

              <button
                className="card-action-btn btn-secondary"
                onClick={() => triggerAction('focus-app')}
                title="View in UniDesk App"
                type="button"
              >
                ↗ UniDesk
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cancel Confirmation Modal ───────────────────────────────── */}
      {isCancelConfirmOpen && createPortal(
        <div className="island-modal-backdrop" onClick={() => setIsCancelConfirmOpen(false)}>
          <div className="island-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="island-modal-header">
              <div className="island-modal-warning-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="island-modal-title">Cancel Rendering?</h3>
                <p className="island-modal-sub">This will terminate the active video export.</p>
              </div>
            </div>

            <p className="island-modal-body">
              Any partially rendered file will be halted and the queue will be stopped.
            </p>

            <div className="island-modal-actions">
              <button
                type="button"
                className="island-modal-btn island-btn-secondary"
                onClick={() => setIsCancelConfirmOpen(false)}
              >
                Continue
              </button>
              <button
                type="button"
                className="island-modal-btn island-btn-danger"
                onClick={handleConfirmCancel}
              >
                Cancel Now
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
