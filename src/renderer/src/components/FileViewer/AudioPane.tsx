import React, { useState, useRef, useEffect } from 'react'

interface AudioPaneProps {
  src: string
  fileName?: string
}

export default function AudioPane({ src, fileName }: AudioPaneProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const seekRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
      audioRef.current.volume = volume
    }
  }, [src])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !seekRef.current || duration <= 0) return
    const rect = seekRef.current.getBoundingClientRect()
    const pct = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1)
    const newTime = pct * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="fv-audio-wrap">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onDurationChange={() => audioRef.current && setDuration(audioRef.current.duration || 0)}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="fv-audio-card">
        {/* Animated Visualizer graphic */}
        <div className={`fv-audio-visualizer ${isPlaying ? 'playing' : ''}`}>
          <div className="fv-audio-disk">
            <span className="fv-audio-icon">🎵</span>
          </div>
          <div className="fv-audio-bars">
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className="fv-audio-bar"
                style={{
                  animationDelay: `${(i * 0.08).toFixed(2)}s`,
                  height: isPlaying ? undefined : '15%'
                }}
              />
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="fv-audio-info">
          <div className="fv-audio-name" title={fileName}>{fileName || 'Audio Track'}</div>
          <div className="fv-audio-sub">High Fidelity Studio Audio Preview</div>
        </div>

        {/* Progress seek bar */}
        <div className="fv-audio-seek-area">
          <div className="fv-audio-track" ref={seekRef} onClick={handleSeek}>
            <div className="fv-audio-fill" style={{ width: `${progressPct}%` }} />
            <div className="fv-audio-thumb" style={{ left: `${progressPct}%` }} />
          </div>
          <div className="fv-audio-timestamps">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Transport controls */}
        <div className="fv-audio-controls">
          <button
            className="fv-audio-btn-round"
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5)
            }}
            title="Rewind 5 seconds"
          >
            ↺ 5s
          </button>

          <button
            className="fv-audio-btn-play"
            onClick={togglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button
            className="fv-audio-btn-round"
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 5)
            }}
            title="Forward 5 seconds"
          >
            5s ↻
          </button>
        </div>

        {/* Footer controls: Volume & Speed */}
        <div className="fv-audio-footer-row">
          <div className="fv-audio-vol-box">
            <span className="fv-audio-vol-icon">{volume === 0 ? '🔇' : '🔊'}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                setVolume(val)
                if (audioRef.current) audioRef.current.volume = val
              }}
              title="Volume"
            />
          </div>

          <div className="fv-audio-speed-box">
            <span className="fv-audio-speed-label">Speed:</span>
            {[0.75, 1.0, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                className={`fv-audio-speed-pill ${playbackRate === rate ? 'active' : ''}`}
                onClick={() => {
                  setPlaybackRate(rate)
                  if (audioRef.current) audioRef.current.playbackRate = rate
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
