import React, { useEffect, useState } from 'react'
import './MobilePulseLoader.css'

interface MobilePulseLoaderProps {
  progress?: number
  onComplete?: () => void
  theme?: 'light' | 'dark' | 'auto'
}

/**
 * MobilePulseLoader
 * Inspired by Mobbin Mobile Design Systems (Screen 2847f828 & 3573c390):
 * Floating rounded card, progressive steps checklist, fluid micro-pulse loader
 * tailored for modern desktop workstations.
 */
export default function MobilePulseLoader({
  progress: externalProgress,
  onComplete,
  theme = 'auto'
}: MobilePulseLoaderProps): JSX.Element {
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
        if (onComplete) setTimeout(onComplete, 400)
      } else {
        setInternalProgress(current)
      }
    }, 45)

    return () => clearInterval(interval)
  }, [externalProgress, onComplete])

  const steps = [
    { label: 'Probing GPU Decoders', done: activeProgress >= 30 },
    { label: 'Mounting Video Pipelines', done: activeProgress >= 70 },
    { label: 'Workstation Synchronized', done: activeProgress >= 100 }
  ]

  return (
    <div className={`mobile-pulse-container theme-${theme}`}>
      <div className="mobile-pulse-card">
        {/* Top App pill header */}
        <div className="mobile-pulse-header">
          <div className="mobile-pulse-badge">
            <span className="mobile-pulse-ring" />
            <span className="mobile-pulse-icon">⚡</span>
            <span className="mobile-pulse-app">UniDesk Pro</span>
          </div>
          <span className="mobile-pulse-pct">{Math.round(activeProgress)}%</span>
        </div>

        {/* Dynamic step checklist */}
        <div className="mobile-pulse-steps">
          {steps.map((st, i) => (
            <div key={i} className={`mobile-pulse-step ${st.done ? 'step-done' : ''}`}>
              <span className="mobile-step-bullet">{st.done ? '✓' : '•'}</span>
              <span className="mobile-step-text">{st.label}</span>
            </div>
          ))}
        </div>

        {/* Soft rounded progress bar */}
        <div className="mobile-pulse-bar-bg">
          <div 
            className="mobile-pulse-bar-fill" 
            style={{ width: `${activeProgress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
