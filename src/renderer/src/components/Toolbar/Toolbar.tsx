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
      setClock(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }))
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
        </div>

        {/* Quick controls + clock */}
        <div className="toolbar-right">
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
