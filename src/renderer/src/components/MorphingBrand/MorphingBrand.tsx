import React, { useState, useEffect } from 'react'
import OneTapLogo from '../OneTapLogo'

interface MorphingBrandProps {
  logoSize?: number
  fontSize?: number
  compact?: boolean
  version?: string
  maxWidth?: number | string
  singleLine?: boolean
  onClick?: () => void
}

export default function MorphingBrand({
  logoSize = 36,
  fontSize = 15,
  compact = false,
  version = 'v26.10.30',
  maxWidth,
  singleLine = false,
  onClick
}: MorphingBrandProps): JSX.Element {
  const [activeSlide, setActiveSlide] = useState<0 | 1>(0)
  const [userProfile, setUserProfile] = useState<{
    name: string
    username?: string
    userId?: string
  } | null>(null)

  useEffect(() => {
    // 1. Fetch user profile from electron IPC & ecosystem session
    const api = (window as any).api
    const loadProfile = () => {
      if (api?.userProfile?.load) {
        api.userProfile.load().then((p: any) => {
          if (p && (p.name || p.username || p.email)) {
            setUserProfile({
              name: p.name || 'Creator',
              username: p.username || (p.email ? p.email.split('@')[0] : 'creator'),
              userId: p.username || p.userId || 'creator'
            })
          }
        }).catch(() => {})
      }
    }

    loadProfile()

    // 2. Also listen for ecosystem storage events and custom auth changes
    const handleStorage = () => loadProfile()
    window.addEventListener('storage', handleStorage)
    window.addEventListener('anything:ecosystem-auth-change', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('anything:ecosystem-auth-change', handleStorage)
    }
  }, [])

  // Slide-show interval: smoothly alternate between App Info & User Profile every 4.5 seconds!
  useEffect(() => {
    if (!userProfile) return
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev === 0 ? 1 : 0))
    }, 4500)
    return () => clearInterval(interval)
  }, [userProfile])

  const effectiveHandle = userProfile?.username || userProfile?.userId || 'creator'

  return (
    <div
      className="morphing-brand-container"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '0' : '8px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        flexShrink: 0
      }}
      title={`One Tap Workstation · ${userProfile ? `${userProfile.name} (@${effectiveHandle})` : version}`}
    >
      <OneTapLogo size={logoSize} glow={true} />

      {!compact && (
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            justifyContent: 'center',
            height: singleLine ? 'auto' : `${logoSize}px`,
            position: 'relative',
            userSelect: 'none',
            overflow: 'hidden',
            maxWidth: maxWidth ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth) : '240px'
          }}
        >
          {/* Ghost element to dynamically size the parent container to the widest slide */}
          <div
            aria-hidden="true"
            style={{
              visibility: 'hidden',
              height: 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              fontSize: `${singleLine ? fontSize : (userProfile && userProfile.name.length > 12 ? Math.min(fontSize, 11.5) : fontSize)}px`,
              fontWeight: 800,
              fontFamily: 'var(--font-display, "Outfit", "Plus Jakarta Sans", system-ui, sans-serif)',
              letterSpacing: '-0.02em',
              paddingRight: '6px'
            }}
          >
            {userProfile && userProfile.name.length > 7 ? userProfile.name : 'One Tap Work'}
          </div>

          {/* Slide 0: App Name (One Tap) + Version */}
          <div
            style={{
              position: singleLine ? 'relative' : 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: singleLine ? 'auto' : '100%',
              display: 'flex',
              flexDirection: singleLine ? 'row' : 'column',
              alignItems: singleLine ? 'center' : 'flex-start',
              justifyContent: 'center',
              gap: singleLine ? '6px' : '2px',
              transform: activeSlide === 0 ? 'translateY(0%)' : (singleLine ? 'translateY(-120%)' : 'translateY(-105%)'),
              opacity: activeSlide === 0 ? 1 : 0,
              transition: 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-in-out',
              pointerEvents: activeSlide === 0 ? 'auto' : 'none'
            }}
          >
            <div
              style={{
                fontSize: `${fontSize}px`,
                fontWeight: 800,
                fontFamily: 'var(--font-display, "Outfit", "Plus Jakarta Sans", system-ui, sans-serif)',
                letterSpacing: '-0.02em',
                lineHeight: singleLine ? 1.2 : 1.15,
                color: 'var(--text-primary, #1C1917)',
                whiteSpace: 'nowrap'
              }}
            >
              One Tap
            </div>

            {version && !singleLine && (
              <div
                style={{
                  fontSize: `${Math.max(10, Math.round(fontSize * 0.72))}px`,
                  fontWeight: 650,
                  fontFamily: 'var(--font-mono, "SF Mono", "Segoe UI Mono", "Cascadia Code", Consolas, monospace)',
                  color: 'var(--text-muted, #78716C)',
                  letterSpacing: '0.02em',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  WebkitFontSmoothing: 'antialiased'
                }}
              >
                {version}
              </div>
            )}
          </div>

          {/* Slide 1: User Display Name + User ID (@handle) */}
          {userProfile && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: singleLine ? 'auto' : '100%',
                display: 'flex',
                flexDirection: singleLine ? 'row' : 'column',
                alignItems: singleLine ? 'center' : 'flex-start',
                justifyContent: 'center',
                gap: singleLine ? '6px' : '2px',
                transform: activeSlide === 1 ? 'translateY(0%)' : (singleLine ? 'translateY(120%)' : 'translateY(105%)'),
                opacity: activeSlide === 1 ? 1 : 0,
                transition: 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-in-out',
                pointerEvents: activeSlide === 1 ? 'auto' : 'none'
              }}
            >
              <div
                style={{
                  fontSize: `${singleLine ? fontSize : (userProfile.name.length > 12 ? Math.min(fontSize, 11.5) : fontSize)}px`,
                  fontWeight: 800,
                  fontFamily: 'var(--font-display, "Outfit", "Plus Jakarta Sans", system-ui, sans-serif)',
                  letterSpacing: '-0.02em',
                  lineHeight: singleLine ? 1.2 : 1.15,
                  color: 'var(--accent-primary, #0284c7)',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}
                title={userProfile.name}
              >
                {userProfile.name}
              </div>

              {!singleLine && (
                <div
                  style={{
                    fontSize: `${Math.max(10, Math.round((userProfile.name.length > 12 ? Math.min(fontSize, 11.5) : fontSize) * 0.78))}px`,
                    fontWeight: 650,
                    fontFamily: 'var(--font-mono, "SF Mono", "Segoe UI Mono", "Cascadia Code", Consolas, monospace)',
                    color: 'var(--text-muted, #78716C)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.1,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    WebkitFontSmoothing: 'antialiased'
                  }}
                  title={`@${effectiveHandle}`}
                >
                  @{effectiveHandle}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
