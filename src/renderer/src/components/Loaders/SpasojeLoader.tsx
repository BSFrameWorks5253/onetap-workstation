import React, { useEffect, useState } from 'react'
import './SpasojeLoader.css'

interface SpasojeLoaderProps {
  progress?: number
  onComplete?: () => void
  theme?: 'light' | 'dark' | 'auto'
}

/**
 * SpasojeLoader
 * Inspired by Awwwards "Loading Animation - Spasoje Perovic":
 * Oversized typographic ticker (000 - 100), hairline split progress indicator,
 * and minimalist Swiss design discipline.
 */
export default function SpasojeLoader({
  progress: externalProgress,
  onComplete,
  theme = 'auto'
}: SpasojeLoaderProps): JSX.Element {
  const [internalProgress, setInternalProgress] = useState(0)
  const activeProgress = externalProgress !== undefined ? externalProgress : internalProgress

  useEffect(() => {
    if (externalProgress !== undefined) return

    let current = 0
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 5) + 2
      if (current >= 100) {
        current = 100
        setInternalProgress(100)
        clearInterval(interval)
        if (onComplete) setTimeout(onComplete, 400)
      } else {
        setInternalProgress(current)
      }
    }, 40)

    return () => clearInterval(interval)
  }, [externalProgress, onComplete])

  const formatted = String(Math.min(100, Math.round(activeProgress))).padStart(2, '0')

  return (
    <div className={`spasoje-loader-container theme-${theme}`}>
      <div className="spasoje-header">
        <span className="spasoje-label">PORTFOLIO WORKSTATION</span>
        <span className="spasoje-index">EDITION 2026</span>
      </div>

      <div className="spasoje-number-row">
        <div className="spasoje-huge-number">{formatted}</div>
        <div className="spasoje-number-symbol">%</div>
      </div>

      <div className="spasoje-hairline-track">
        <div 
          className="spasoje-hairline-fill" 
          style={{ width: `${activeProgress}%` }}
        />
      </div>

      <div className="spasoje-footer">
        <span>PREPARING SEQUENCES</span>
        <span>INDEXING TIMELINES</span>
      </div>
    </div>
  )
}
