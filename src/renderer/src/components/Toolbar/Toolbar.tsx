import React, { useEffect, useState } from 'react'
import type { PageKey } from '../../types'
import { PAGE_META } from '../../types'
import { PageIcon } from '../PageIcon'
import './Toolbar.css'
import MorphingBrand from '../MorphingBrand'
import AnySharePairingModal from '../AnySharePairingModal/AnySharePairingModal'

interface ToolbarProps {
  activePage: PageKey
  onOpenCmdPalette?: () => void
}

export default function Toolbar({ activePage, onOpenCmdPalette }: ToolbarProps): JSX.Element {
  const [clock, setClock] = useState('')
  const [launchInfo, setLaunchInfo] = useState<{ isDemo?: boolean; isTrial?: boolean } | null>(null)
  const [isAnySharePairingOpen, setIsAnySharePairingOpen] = useState(false)
  const meta = PAGE_META[activePage]

  useEffect(() => {
    const api = (window as any).api
    if (api?.system?.getLaunchInfo) {
      api.system.getLaunchInfo().then((info: any) => setLaunchInfo(info)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    function tick(): void {
      setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="toolbar">
      <div className="toolbar-inner">
        {/* Breadcrumb */}
        <div className="toolbar-breadcrumb">
          <span 
            className="toolbar-crumb-root" 
            onClick={() => {
              if (typeof (window as any).showAdobeSplashScreen === 'function') {
                (window as any).showAdobeSplashScreen()
              }
            }} 
            title="One Tap Workstation"
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          >
            <MorphingBrand logoSize={22} fontSize={13} maxWidth={260} singleLine={true} />
          </span>
          <span className="toolbar-crumb-sep">›</span>
          <span className="toolbar-crumb-page" style={{ color: meta.accent, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <PageIcon pageKey={activePage} size={16} color={meta.accent} />
            <span>{meta.label}</span>
          </span>
          <span className="toolbar-hint">Workspace</span>
        </div>

        {/* Quick controls + clock */}
        <div className="toolbar-right">
          <div className="toolbar-controls">
            {/* Creative Cloud Demo / Trial Badge */}
            {(launchInfo?.isTrial || launchInfo?.isDemo) && (
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, rgba(225,29,72,0.18), rgba(245,158,11,0.18))',
                  border: '1px solid rgba(244,63,94,0.4)',
                  color: '#fb7185',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  letterSpacing: '0.02em',
                  boxShadow: '0 0 10px rgba(225,29,72,0.15)'
                }}
                title="Creative Cloud Interactive Sandbox Trial Active"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                <span>{launchInfo.isTrial ? '7-Day Free Trial' : 'Creative Cloud Demo'}</span>
              </span>
            )}

            {/* AnyShare Mobile Pairing Button */}
            <button
              className="toolbar-btn-pill"
              onClick={() => setIsAnySharePairingOpen(true)}
              title="Link AnyShare Mobile / Web via One-Time QR Code"
              style={{
                borderColor: 'var(--border, rgba(184, 134, 11, 0.45))',
                background: 'color-mix(in srgb, var(--theme-accent, #b8860b) 12%, var(--surface))',
                color: 'var(--text-primary, #1c1917)',
                fontWeight: 650,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--theme-accent, #b8860b)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01"/>
              </svg>
              <span>Link AnyShare</span>
            </button>

            {/* Quick Spotlight Launcher */}
            {onOpenCmdPalette && (
              <button className="toolbar-btn-pill" onClick={onOpenCmdPalette} title="Open Spotlight Launcher (Ctrl+K)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Search</span>
                <kbd style={{ fontSize: '10px', opacity: 0.7, background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '4px' }}>Ctrl+K</kbd>
              </button>
            )}
          </div>

          <div className="toolbar-live">
            <div className="toolbar-live-dot" />
            <span>Live</span>
          </div>
          <span className="toolbar-clock">{clock}</span>
        </div>
      </div>

      <AnySharePairingModal
        isOpen={isAnySharePairingOpen}
        onClose={() => setIsAnySharePairingOpen(false)}
      />
    </header>
  )
}
