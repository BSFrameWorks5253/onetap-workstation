import React, { useEffect, useState } from 'react'
import './WalbiIntroLoader.css'

interface WalbiIntroLoaderProps {
  progress?: number
  onComplete?: () => void
  theme?: 'light' | 'dark' | 'auto'
}

/**
 * WalbiIntroLoader
 * Inspired by Awwwards "Intro Loading Animation - Walbi":
 * Sound-wave reactive bars, glowing ambient energy, and high-frequency audio visualization.
 */
export default function WalbiIntroLoader({
  progress: externalProgress,
  onComplete,
  theme = 'auto'
}: WalbiIntroLoaderProps): JSX.Element {
  const [internalProgress, setInternalProgress] = useState(0)
  const activeProgress = externalProgress !== undefined ? externalProgress : internalProgress

  useEffect(() => {
    if (externalProgress !== undefined) return

    let current = 0
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 7) + 3
      if (current >= 100) {
        current = 100
        setInternalProgress(100)
        clearInterval(interval)
        if (onComplete) setTimeout(onComplete, 400)
      } else {
        setInternalProgress(current)
      }
    }, 45)

    return () => clearInterval(interval)
  }, [externalProgress, onComplete])

  const barCount = 14

  return (
    <div className={`walbi-loader-container theme-${theme}`}>
      <div className="walbi-equalizer-wrapper">
        <div className="walbi-ambient-pulse" />
        <div className="walbi-bars">
          {Array.from({ length: barCount }).map((_, i) => (
            <div
              key={i}
              className="walbi-bar"
              style={{
                animationDelay: `${(i * 0.08).toFixed(2)}s`,
                height: `${20 + Math.sin(i / 2) * 22}px`
              }}
            />
          ))}
        </div>
      </div>

      <div className="walbi-info">
        <div className="walbi-pill">
          <span className="walbi-dot animate-pulse-fast" />
          <span className="walbi-title">AUDIO ENGINE CALIBRATING</span>
        </div>
        <span className="walbi-progress-text">{Math.round(activeProgress)}%</span>
      </div>
    </div>
  )
}
