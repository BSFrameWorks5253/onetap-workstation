import React, { useState, useEffect } from 'react'
import { OneTapLogo } from '../OneTapLogo'
import './RadialRefreshLoader.css'

export interface RadialRefreshLoaderProps {
  isOpen: boolean
  onComplete?: () => void
  durationMs?: number
}

export const RadialRefreshLoader: React.FC<RadialRefreshLoaderProps> = ({
  isOpen,
  onComplete,
  durationMs = 650
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const timer = setTimeout(() => {
      setIsFadingOut(true)
      setTimeout(() => {
        if (onComplete) onComplete()
      }, 280)
    }, durationMs)

    return () => clearTimeout(timer)
  }, [isOpen, durationMs, onComplete])

  if (!isOpen && !isFadingOut) return null

  return (
    <div className={`radial-loader-backdrop ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="radial-loader-card">
        <div className="radial-spinner-container">
          <svg className="radial-spinner-svg" viewBox="0 0 80 80" fill="none">
            <defs>
              <linearGradient id="radialGrad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E11D48" />
                <stop offset="60%" stopColor="#F43F5E" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            {/* Background Ring Track */}
            <circle cx="40" cy="40" r="34" strokeWidth="4" className="radial-track" />
            {/* Animated Rotating Radial Arc */}
            <circle cx="40" cy="40" r="34" strokeWidth="4" className="radial-arc" />
          </svg>

          {/* Central Logo Insignia */}
          <div className="radial-center-badge">
            <OneTapLogo size={36} glow={false} />
          </div>
        </div>

        <div className="radial-loader-text-group">
          <h2 className="radial-loader-title">One Tap</h2>
          <p className="radial-loader-sub">Refreshing workspace…</p>
        </div>
      </div>
    </div>
  )
}

export default RadialRefreshLoader
