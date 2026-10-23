import React, { useState, useEffect, useRef } from 'react'
import { OneTapLogo } from '../OneTapLogo'
import './AdobeSplashScreen.css'

export interface AdobeSplashScreenProps {
  isOpen?: boolean
  onComplete?: () => void
  onDone?: () => void
  isPreview?: boolean
  isBootScreen?: boolean
  version?: string
  durationMs?: number
  artworkUrl?: string
}

const DEFAULT_DIAGNOSTIC_STEPS = [
  'Initializing Direct3D 12 GPU hardware pipeline...',
  'Scanning media ingestion devices & high-speed storage...',
  'Mounting sequential batch rendering engine...',
  'Calibrating Premiere Pro & After Effects CEP bridges...',
  'Syncing with Anything Ecosystem...',
  'Starting One Tap...'
]

export const AdobeSplashScreen: React.FC<AdobeSplashScreenProps> = ({
  isOpen = true,
  onComplete,
  onDone,
  isPreview = false,
  isBootScreen = true,
  version = '26.10.12',
  durationMs = 2800,
  artworkUrl
}) => {
  const [progress, setProgress] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const hasTriggeredRef = useRef(false)

  const handleFinish = () => {
    if (hasTriggeredRef.current) return
    hasTriggeredRef.current = true
    setIsFadingOut(true)
    setTimeout(() => {
      if (onComplete) onComplete()
      if (onDone) onDone()
    }, 320)
  }

  useEffect(() => {
    if (!isOpen) {
      setProgress(0)
      setStepIndex(0)
      setIsFadingOut(false)
      hasTriggeredRef.current = false
      return
    }

    const duration = Math.max(1200, durationMs)
    const intervalTime = 30
    const totalSteps = duration / intervalTime
    const increment = 100 / totalSteps
    let curProgress = 0

    const timer = setInterval(() => {
      curProgress += increment
      if (curProgress >= 100) {
        curProgress = 100
        setProgress(100)
        setStepIndex(DEFAULT_DIAGNOSTIC_STEPS.length - 1)
        clearInterval(timer)

        // Smooth studio fadeout
        setTimeout(() => {
          handleFinish()
        }, 220)
      } else {
        setProgress(curProgress)
        const nextStep = Math.min(
          DEFAULT_DIAGNOSTIC_STEPS.length - 1,
          Math.floor((curProgress / 100) * DEFAULT_DIAGNOSTIC_STEPS.length)
        )
        setStepIndex(nextStep)
      }
    }, intervalTime)

    return () => clearInterval(timer)
  }, [isOpen, durationMs])

  if (!isOpen) return null

  return (
    <div
      className={`adobe-splash-backdrop ${isFadingOut ? 'fade-out' : ''}`}
      onClick={(e) => {
        if (isPreview && e.target === e.currentTarget) {
          handleFinish()
        }
      }}
    >
      <div className="adobe-splash-card">
        {/* Top Header & Artwork Canvas */}
        <div className="adobe-splash-artwork">
          {/* Ambient Artwork Texture / Background */}
          {artworkUrl ? (
            <img src={artworkUrl} alt="One Tap Artwork" className="adobe-splash-art-bg" />
          ) : (
            <div className="adobe-splash-art-gradient" />
          )}

          {/* Top Bar: Official Red Squircle Emblem, Title & Fast Skip */}
          <div className="adobe-splash-top-bar">
            <div className="adobe-splash-brand-wrap">
              <OneTapLogo size={58} glow={true} />
              <div>
                <div className="adobe-splash-title-row">
                  <h1 className="adobe-splash-title">One Tap</h1>
                  <span className="adobe-splash-version-pill">{`v${version}`}</span>
                </div>
                <p className="adobe-splash-tagline">
                  Automated Video Production Workstation & High-Speed Media Engine
                </p>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="adobe-splash-skip-btn"
              title="Skip into workspace"
            >
              Skip ➔
            </button>
          </div>

          {/* Bottom Right: Artist Credit Capsule */}
          <div className="adobe-splash-artist-capsule">
            <span className="adobe-splash-capsule-badge">Featured Artwork</span>
            <span className="adobe-splash-capsule-name">Burhanuddin Sounasath</span>
            <span className="adobe-splash-capsule-subtitle">-Designed for Anything Ecosystem</span>
          </div>
        </div>

        {/* Lower Canvas: Real-time Diagnostics & Segmented Loader Bar */}
        <div className="adobe-splash-lower">
          <div className="adobe-splash-diag-row">
            <div className="adobe-splash-diag-left">
              <svg className="adobe-splash-spinner" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="adobe-splash-diag-text">
                {DEFAULT_DIAGNOSTIC_STEPS[stepIndex] || 'Starting One Tap...'}
              </span>
            </div>
            <div className="adobe-splash-diag-right">
              <span style={{ color: '#A1A1AA' }}>Loading</span>
              <span className="adobe-splash-pct">{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Glowing Segmented Loader Bar with Moving Shimmer Sheen */}
          <div className="adobe-splash-bar-track">
            <div
              className="adobe-splash-bar-fill"
              style={{ width: `${progress}%` }}
            >
              <div className="adobe-splash-shimmer-beam" />
            </div>
          </div>

          {/* Footer Metadata & Spectrum Hardware Indicator */}
          <div className="adobe-splash-footer">
            <span className="adobe-splash-footer-left">
              © 1990–2026 Anything Systems Inc. · Architect: Burhanuddin Sounasath (8369811201)
            </span>
            <div className="adobe-splash-footer-right">
              <span className="adobe-splash-led" />
              <span>DirectX 12 GPU · Build 2026.10</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdobeSplashScreen
