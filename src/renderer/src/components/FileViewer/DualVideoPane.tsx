import React, { useState, useRef, useEffect, useCallback } from 'react'

interface DualVideoPaneProps {
  primarySrc: string
  primaryName?: string
  secondarySrc?: string
  secondaryName?: string
  onClose?: () => void
}

export default function DualVideoPane({
  primarySrc,
  primaryName = 'Raw Footage (Video A)',
  secondarySrc: initialSecondarySrc,
  secondaryName: initialSecondaryName = 'Final Render (Video B)',
  onClose
}: DualVideoPaneProps): JSX.Element {
  const [secondarySrc, setSecondarySrc] = useState<string>(initialSecondarySrc || '')
  const [secondaryName, setSecondaryName] = useState<string>(initialSecondaryName)
  const [mode, setMode] = useState<'split' | 'side-by-side'>('split')
  const [splitPos, setSplitPos] = useState<number>(50) // percentage 0 - 100
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [playbackRate, setPlaybackRate] = useState<number>(1.0)
  const [syncDelta, setSyncDelta] = useState<number>(0) // manual frame sync offset in secs

  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingSplit = useRef<boolean>(false)

  // Initialize or update secondary video
  useEffect(() => {
    if (initialSecondarySrc) {
      setSecondarySrc(initialSecondarySrc)
    }
  }, [initialSecondarySrc])

  // Synchronized playback controls
  const togglePlay = useCallback(() => {
    const vA = videoARef.current
    const vB = videoBRef.current
    if (!vA) return

    if (isPlaying) {
      vA.pause()
      vB?.pause()
      setIsPlaying(false)
    } else {
      vA.play().then(() => {
        setIsPlaying(true)
        if (vB) {
          vB.currentTime = Math.max(0, vA.currentTime + syncDelta)
          vB.play().catch(() => {})
        }
      }).catch(console.error)
    }
  }, [isPlaying, syncDelta])

  // Seeking sync
  const handleSeek = (newTime: number) => {
    const vA = videoARef.current
    const vB = videoBRef.current
    if (!vA) return

    vA.currentTime = newTime
    if (vB) vB.currentTime = Math.max(0, newTime + syncDelta)
    setCurrentTime(newTime)
  }

  // Handle split slider drag
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingSplit.current = true
    window.addEventListener('mousemove', handleSplitMouseMove)
    window.addEventListener('mouseup', handleSplitMouseUp)
  }

  const handleSplitMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingSplit.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.min(Math.max(5, ((e.clientX - rect.left) / rect.width) * 100), 95)
    setSplitPos(pct)
  }, [])

  const handleSplitMouseUp = useCallback(() => {
    isDraggingSplit.current = false
    window.removeEventListener('mousemove', handleSplitMouseMove)
    window.removeEventListener('mouseup', handleSplitMouseUp)
  }, [handleSplitMouseMove])

  // Pick secondary file from disk
  const handlePickComparisonVideo = async () => {
    try {
      const api = (window as any).api
      if (api?.dialog?.showOpenDialog) {
        const res = await api.dialog.showOpenDialog({
          title: 'Select Comparison Video (Raw or Final)',
          filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'm4v'] }],
          properties: ['openFile']
        })
        if (res && res.filePaths && res.filePaths.length > 0) {
          const filePath = res.filePaths[0]
          const fileName = filePath.split(/[/\\]/).pop() || 'Comparison Video'
          // Use local-resource stream URL
          const streamUrl = `local-resource://${encodeURIComponent(filePath)}`
          setSecondarySrc(streamUrl)
          setSecondaryName(fileName)
        }
      }
    } catch (err) {
      console.warn('Could not pick comparison video:', err)
    }
  }

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="fv-dual-container" ref={containerRef}>
      {/* Top comparison status bar */}
      <div className="fv-dual-topbar">
        <div className="fv-dual-badge">
          <span className="fv-dual-icon">⚖️</span>
          <span>Dual-Pane Before / After Inspector</span>
        </div>

        <div className="fv-dual-tabs">
          <button
            className={`fv-dual-tab ${mode === 'split' ? 'active' : ''}`}
            onClick={() => setMode('split')}
          >
            ↔ Split Slider
          </button>
          <button
            className={`fv-dual-tab ${mode === 'side-by-side' ? 'active' : ''}`}
            onClick={() => setMode('side-by-side')}
          >
            ⊞ Side-by-Side
          </button>
        </div>

        <div className="fv-dual-actions">
          {!secondarySrc && (
            <button className="fv-dual-btn-load" onClick={handlePickComparisonVideo}>
              + Pick Comparison Video
            </button>
          )}
          {secondarySrc && (
            <button className="fv-dual-btn-load" onClick={handlePickComparisonVideo} title="Change comparison video">
              🔄 Swap ({secondaryName.slice(0, 18)}...)
            </button>
          )}
          {onClose && (
            <button className="fv-dual-btn-close" onClick={onClose} title="Exit comparison mode">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main video comparison viewport */}
      <div className={`fv-dual-viewport ${mode}`}>
        {mode === 'split' ? (
          <div className="fv-dual-split-stage">
            {/* Primary Video (Layer 0, Full width) */}
            <video
              ref={videoARef}
              className="fv-dual-video fv-dual-video-a"
              src={primarySrc}
              preload="auto"
              onTimeUpdate={() => videoARef.current && setCurrentTime(videoARef.current.currentTime)}
              onDurationChange={() => videoARef.current && setDuration(videoARef.current.duration || 0)}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Secondary Video (Layer 1, clipped by splitPos percentage) */}
            {secondarySrc && (
              <div
                className="fv-dual-clip-container"
                style={{ clipPath: `polygon(${splitPos}% 0, 100% 0, 100% 100%, ${splitPos}% 100%)` }}
              >
                <video
                  ref={videoBRef}
                  className="fv-dual-video fv-dual-video-b"
                  src={secondarySrc}
                  preload="auto"
                  muted // mute secondary to avoid audio phasing
                />
              </div>
            )}

            {/* Draggable Divider Handle */}
            {secondarySrc && (
              <div
                className="fv-dual-split-divider"
                style={{ left: `${splitPos}%` }}
                onMouseDown={handleSplitMouseDown}
              >
                <div className="fv-dual-divider-line" />
                <div className="fv-dual-divider-handle">
                  <span>◀</span>
                  <span>▶</span>
                </div>
              </div>
            )}

            {/* Labels overlay */}
            <div className="fv-dual-label-left">{primaryName}</div>
            {secondarySrc && <div className="fv-dual-label-right">{secondaryName}</div>}
          </div>
        ) : (
          <div className="fv-dual-sbs-stage">
            <div className="fv-dual-pane">
              <div className="fv-dual-pane-header">{primaryName}</div>
              <video
                ref={videoARef}
                className="fv-dual-video"
                src={primarySrc}
                preload="auto"
                onTimeUpdate={() => videoARef.current && setCurrentTime(videoARef.current.currentTime)}
                onDurationChange={() => videoARef.current && setDuration(videoARef.current.duration || 0)}
                onEnded={() => setIsPlaying(false)}
              />
            </div>

            <div className="fv-dual-pane">
              <div className="fv-dual-pane-header">
                {secondarySrc ? secondaryName : 'Select comparison video to inspect side-by-side'}
              </div>
              {secondarySrc ? (
                <video
                  ref={videoBRef}
                  className="fv-dual-video"
                  src={secondarySrc}
                  preload="auto"
                  muted
                />
              ) : (
                <div className="fv-dual-empty-pane" onClick={handlePickComparisonVideo}>
                  <span>🎬 Click to select comparison video</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Synchronized timeline control bar */}
      <div className="fv-dual-controls">
        <div
          className="fv-dual-seek-track"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1)
            handleSeek(pct * duration)
          }}
        >
          <div className="fv-dual-seek-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="fv-dual-control-row">
          <div className="fv-dual-playback-group">
            <button className="fv-dual-btn-play" onClick={togglePlay}>
              {isPlaying ? '⏸ Pause' : '▶ Play Synced'}
            </button>
            <span className="fv-dual-timer">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Sync Offset Nudge */}
          <div className="fv-dual-offset-group">
            <span className="fv-dual-offset-label">Sync Nudge:</span>
            <button
              className="fv-dual-btn-nudge"
              onClick={() => {
                setSyncDelta((d) => d - 0.05)
                if (videoBRef.current) videoBRef.current.currentTime = Math.max(0, currentTime + syncDelta - 0.05)
              }}
              title="Nudge B back 50ms"
            >
              -1f
            </button>
            <span className="fv-dual-offset-value">{(syncDelta * 1000).toFixed(0)}ms</span>
            <button
              className="fv-dual-btn-nudge"
              onClick={() => {
                setSyncDelta((d) => d + 0.05)
                if (videoBRef.current) videoBRef.current.currentTime = Math.max(0, currentTime + syncDelta + 0.05)
              }}
              title="Nudge B forward 50ms"
            >
              +1f
            </button>
          </div>

          {/* Speed control */}
          <div className="fv-dual-speed-group">
            {[0.5, 1.0, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                className={`fv-dual-speed-pill ${playbackRate === rate ? 'active' : ''}`}
                onClick={() => {
                  setPlaybackRate(rate)
                  if (videoARef.current) videoARef.current.playbackRate = rate
                  if (videoBRef.current) videoBRef.current.playbackRate = rate
                }}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
