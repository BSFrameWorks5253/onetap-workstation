import React, { useEffect, useState } from 'react'
import './OntoLoader.css'

interface OntoLoaderProps {
  progress?: number
  onComplete?: () => void
  subtext?: string
  theme?: 'light' | 'dark' | 'auto'
  hideTitle?: boolean
  wordmark?: 'ONTO' | 'UNIDESK'
}

/**
 * OntoLoader
 * Exact 5-stage mechanical kinetic animation inspired by Nelson Noa / Awwwards "ONTO Loading":
 * 1. Staggered Rising Blocks (0.0s - 0.6s)
 * 2. Negative Cutout Punch-Through Display (0.6s - 1.2s)
 * 3. Inward Horizontal Squeeze & Compression (1.2s - 1.8s)
 * 4. Interlocking Infinity Chain-Link Merger (1.8s - 2.2s)
 * 5. Single Capsule Fusion & Viewport Expansion Portal (2.2s - 2.8s)
 */
export default function OntoLoader({
  progress: externalProgress,
  onComplete,
  subtext = 'Professional Workstation Engine',
  theme = 'auto',
  hideTitle = false,
  wordmark = 'ONTO'
}: OntoLoaderProps): JSX.Element {
  const [internalProgress, setInternalProgress] = useState(0)
  const [activeWordmark, setActiveWordmark] = useState<'ONTO' | 'UNIDESK'>(wordmark)

  const activeProgress = externalProgress !== undefined ? externalProgress : internalProgress

  useEffect(() => {
    if (externalProgress !== undefined) return

    let current = 0
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 8) + 3
      if (current >= 100) {
        current = 100
        setInternalProgress(100)
        clearInterval(interval)
        if (onComplete) {
          setTimeout(onComplete, 400)
        }
      } else {
        setInternalProgress(current)
      }
    }, 45)

    return () => clearInterval(interval)
  }, [externalProgress, onComplete])

  const formattedNum = String(Math.min(100, Math.max(0, activeProgress))).padStart(3, '0')

  // Exact vector paths extracted frame-for-frame from Awwwards ONTO
  const ontoOPath =
    'M 9 42 L 3 57 L 0 74 L 1 161 L 7 180 L 17 196 L 29 208 L 49 220 L 58 223 L 248 223 L 267 215 L 282 204 L 300 178 L 306 155 L 306 72 L 300 48 L 290 31 L 275 16 L 264 9 L 244 2 L 227 0 L 67 1 L 49 6 L 30 17 L 17 30 Z M 99 103 L 104 93 L 111 86 L 125 79 L 181 79 L 191 83 L 202 93 L 207 102 L 209 117 L 203 133 L 194 142 L 185 147 L 125 148 L 112 142 L 102 131 L 98 120 Z'

  const ontoNPath =
    'M 0 0 L 0 224 L 64 224 L 64 172 L 196 224 L 307 224 L 307 0 L 243 0 L 243 52 L 111 0 Z'

  const ontoTPath =
    'M 0 0 L 0 118 L 82 118 L 82 224 L 225 224 L 225 118 L 307 118 L 307 0 Z'

  return (
    <div className={`onto-loader-container theme-${theme} ${hideTitle ? 'no-title' : ''}`}>
      <div className="onto-loader-inner">
        {/* Top telemetry bar */}
        <div className="onto-meta-top">
          <div className="onto-tag-group">
            <span className="onto-tag">CORE // RUNTIME</span>
            {!hideTitle && (
              <button
                type="button"
                className="onto-wordmark-toggle"
                onClick={() => setActiveWordmark(w => (w === 'ONTO' ? 'UNIDESK' : 'ONTO'))}
                title="Toggle ONTO / UNIDESK Wordmark"
              >
                {activeWordmark}
              </button>
            )}
          </div>
          <span className="onto-counter">{formattedNum}%</span>
        </div>

        {/* Hero Kinetic Typography: Authentic ONTO or Branded UNIDESK */}
        {!hideTitle && (
          <div className="onto-stage-viewport">
            {activeWordmark === 'ONTO' ? (
              <div className="onto-wordmark-stage">
                {/* Letter 1: O */}
                <div className="onto-glyph-wrapper onto-o1">
                  <svg className="onto-glyph-svg" viewBox="0 0 307 224" aria-label="O">
                    <path d={ontoOPath} fill="currentColor" fillRule="evenodd" />
                  </svg>
                </div>

                {/* Letter 2: N */}
                <div className="onto-glyph-wrapper onto-n">
                  <svg className="onto-glyph-svg" viewBox="0 0 307 224" aria-label="N">
                    <path d={ontoNPath} fill="currentColor" />
                  </svg>
                </div>

                {/* Letter 3: T */}
                <div className="onto-glyph-wrapper onto-t">
                  <svg className="onto-glyph-svg" viewBox="0 0 307 224" aria-label="T">
                    <path d={ontoTPath} fill="currentColor" />
                  </svg>
                </div>

                {/* Letter 4: O */}
                <div className="onto-glyph-wrapper onto-o2">
                  <svg className="onto-glyph-svg" viewBox="0 0 307 224" aria-label="O">
                    <path d={ontoOPath} fill="currentColor" fillRule="evenodd" />
                  </svg>
                </div>

                {/* Central Fused Expansion Portal */}
                <div className="onto-portal-ring">
                  <svg className="onto-portal-svg" viewBox="0 0 307 224">
                    <path d={ontoOPath} fill="currentColor" fillRule="evenodd" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="onto-unidesk-stage">
                <span className="onto-uni-letter onto-u">U</span>
                <span className="onto-uni-letter onto-n">N</span>
                <span className="onto-uni-letter onto-i">I</span>
                <span className="onto-uni-letter onto-d onto-brand">D</span>
                <span className="onto-uni-letter onto-e onto-brand">E</span>
                <span className="onto-uni-letter onto-s onto-brand">S</span>
                <span className="onto-uni-letter onto-k onto-brand">K</span>
              </div>
            )}
          </div>
        )}

        {/* Precision Progress Track with Glowing Pointer */}
        <div className="onto-track">
          <div className="onto-fill" style={{ width: `${activeProgress}%` }} />
          <div className="onto-glow-head" style={{ left: `${activeProgress}%` }} />
        </div>

        {/* Subtext info */}
        <div className="onto-meta-bottom">
          <span className="onto-subtext">{subtext}</span>
          <span className="onto-status">
            {activeProgress < 100 ? 'INITIALIZING BUFFERS...' : 'READY // ONLINE'}
          </span>
        </div>
      </div>
    </div>
  )
}
