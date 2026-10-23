import React, { useEffect, useState } from 'react'
import type { PageKey } from '../../types'
import { PAGE_META } from '../../types'
import './Toolbar.css'

import MorphingBrand from '../MorphingBrand'

interface ToolbarProps {
  activePage: PageKey
  onOpenCmdPalette?: () => void
}

export default function Toolbar({ activePage, onOpenCmdPalette }: ToolbarProps): JSX.Element {
  const [clock, setClock] = useState('')
  const [launchInfo, setLaunchInfo] = useState<{ isDemo?: boolean; isTrial?: boolean } | null>(null)
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

  const isImageIcon = typeof meta.icon === 'string' && (
    meta.icon.startsWith('data:') ||
    meta.icon.startsWith('blob:') ||
    meta.icon.includes('/') ||
    meta.icon.includes('.png') ||
    meta.icon.includes('.svg') ||
    meta.icon.includes('assets')
  )

  function openZenInfoWebsite() {
    const url = 'https://www.zeninfo.in/'
    const api = (window as any).api
    if (api && api.shell && typeof api.shell.openExternal === 'function') {
      api.shell.openExternal(url).catch(() => {
        window.open(url, '_blank')
      })
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <header className="toolbar drag-region">
      <div className="toolbar-inner no-drag">
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
            <MorphingBrand logoSize={20} fontSize={13} />
          </span>
          <span className="toolbar-crumb-sep">›</span>
          <span className="toolbar-crumb-page" style={{ color: meta.accent, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {isImageIcon ? (
              <img src={meta.icon} alt={meta.label} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
            ) : (
              <span>{meta.icon}</span>
            )}
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
                <span>⚡</span>
                <span>{launchInfo.isTrial ? '7-Day Free Trial' : 'Creative Cloud Demo'}</span>
              </span>
            )}

            {/* Quick Spotlight Launcher */}
            {onOpenCmdPalette && (
              <button className="toolbar-btn-pill" onClick={onOpenCmdPalette} title="Open Spotlight Launcher (Ctrl+K)">
                <span>🔍 Search</span>
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
    </header>
  )
}
