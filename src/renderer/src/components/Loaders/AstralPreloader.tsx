import React, { useEffect, useState } from 'react'
import './AstralPreloader.css'

interface AstralPreloaderProps {
  progress?: number
  onComplete?: () => void
  theme?: 'light' | 'dark' | 'auto'
}

/**
 * AstralPreloader
 * Inspired by Awwwards "Astral Frontier Preloader":
 * Orbital rings, rotating geometric core, orbital coordinates, and planetary telemetry.
 */
export default function AstralPreloader({
  progress: externalProgress,
  onComplete,
  theme = 'auto'
}: AstralPreloaderProps): JSX.Element {
  const [internalProgress, setInternalProgress] = useState(0)

  const activeProgress = externalProgress !== undefined ? externalProgress : internalProgress

  useEffect(() => {
    if (externalProgress !== undefined) return

    let current = 0
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 6) + 2
      if (current >= 100) {
        current = 100
        setInternalProgress(100)
        clearInterval(interval)
        if (onComplete) setTimeout(onComplete, 500)
      } else {
        setInternalProgress(current)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [externalProgress, onComplete])

  return (
    <div className={`astral-preloader-container theme-${theme}`}>
      <div className="astral-core-wrapper">
        {/* Orbital concentric rings */}
        <div className="astral-orbit astral-orbit-outer" />
        <div className="astral-orbit astral-orbit-middle" />
        <div className="astral-orbit astral-orbit-inner" />

        {/* Central Geometric Core */}
        <div className="astral-polyhedron">
          <div className="astral-node astral-node-1" />
          <div className="astral-node astral-node-2" />
          <div className="astral-node astral-node-3" />
        </div>

        {/* Center Progress Stamp */}
        <div className="astral-center-percent">
          {Math.round(activeProgress)}%
        </div>
      </div>

      <div className="astral-telemetry">
        <span className="astral-telemetry-item">SEC // 04-ORBIT</span>
        <span className="astral-telemetry-item">LAT 34.05° N</span>
        <span className="astral-telemetry-item">SYS READY</span>
      </div>
    </div>
  )
}
