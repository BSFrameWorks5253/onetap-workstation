import React, { useState, useRef, useEffect } from 'react'
import './VideoHoverScrub.css'

interface VideoHoverScrubProps {
  src: string
  poster?: string
  width?: number | string
  height?: number | string
  className?: string
  title?: string
  onClick?: () => void
}

export default function VideoHoverScrub({
  src,
  poster,
  width = '100%',
  height = '100%',
  className = '',
  title = '',
  onClick
}: VideoHoverScrubProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hoverPct, setHoverPct] = useState(0)

  // Resolve local-resource URL if raw Windows file path passed
  const resolvedSrc = src.startsWith('http') || src.startsWith('local-resource://')
    ? src
    : `local-resource://${encodeURIComponent(src.replace(/\\/g, '/'))}`

  useEffect(() => {
    if (!isHovering && videoRef.current) {
      videoRef.current.currentTime = 0
    }
  }, [isHovering])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !videoRef.current || duration <= 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width)
    const pct = x / rect.width
    setHoverPct(pct)
    const targetTime = pct * duration
    videoRef.current.currentTime = targetTime
    setCurrentTime(targetTime)
  }

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div
      ref={containerRef}
      className={`vhs-container ${className} ${isHovering ? 'hovering' : ''}`}
      style={{ width, height }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false)
        setHoverPct(0)
      }}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      title={title || 'Hover horizontally to scrub timeline'}
    >
      <video
        ref={videoRef}
        className="vhs-video"
        src={resolvedSrc}
        poster={poster}
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration || 0)
        }}
      />

      {/* Scrub indicator overlay */}
      {isHovering && duration > 0 && (
        <div className="vhs-overlay">
          <div className="vhs-time-pill">
            <span>{formatTime(currentTime)}</span>
            <span className="vhs-time-total">/ {formatTime(duration)}</span>
          </div>

          <div className="vhs-scrub-bar">
            <div className="vhs-scrub-fill" style={{ width: `${hoverPct * 100}%` }} />
            <div className="vhs-scrub-cursor" style={{ left: `${hoverPct * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
