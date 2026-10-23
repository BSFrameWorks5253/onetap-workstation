import React, { useState, useCallback } from 'react'
import { Card, CardHeader } from '../../components/Card'
import { Button, GhostButton } from '../../components/Button'
import { BrowseRow } from '../../components/Input'
import { useToast } from '../../components/Toast'
import './Cleaner.css'

const api  = (window as any).api

interface JunkItem {
  name: string
  path: string
  size: number
}

export default function Cleaner(): JSX.Element {
  const { showToast } = useToast()
  const [rootPath, setRootPath] = useState('')
  const [items, setItems] = useState<JunkItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  const [sideWidth, setSideWidth] = useState<number>(() => {
    const saved = localStorage.getItem('ot_cleaner_width')
    return saved ? parseInt(saved, 10) : 340
  })

  const [panelAlign, setPanelAlign] = useState<'left' | 'right'>(() => {
    const saved = localStorage.getItem('ot_cleaner_align')
    return (saved === 'left' || saved === 'right') ? saved : 'right'
  })

  const [isDragging, setIsDragging] = useState(false)

  React.useEffect(() => {
    localStorage.setItem('ot_cleaner_width', String(sideWidth))
  }, [sideWidth])

  React.useEffect(() => {
    localStorage.setItem('ot_cleaner_align', panelAlign)
  }, [panelAlign])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const startX = e.clientX
    const startWidth = sideWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = panelAlign === 'right'
        ? Math.max(260, Math.min(startWidth - deltaX, 600))
        : Math.max(260, Math.min(startWidth + deltaX, 600))
      setSideWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
  }

  const scan = useCallback(async () => {
    if (!rootPath) return
    setScanning(true)
    const results = await api.cleanup.scan(rootPath)
    setItems(results)
    setScanning(false)
    showToast({ 
      title: 'Scan Complete', 
      message: results.length ? `Found ${results.length} junk folders.` : 'No junk found. Your drives are clean!', 
      type: results.length ? 'warning' : 'success' 
    })
  }, [rootPath])

  async function cleanAll() {
    if (items.length === 0) return
    if (!confirm(`Are you sure you want to delete ${items.length} folders? This cannot be undone.`)) return
    
    setCleaning(true)
    const res = await api.cleanup.delete(items.map(i => i.path))
    setCleaning(false)
    
    if (res.success) {
      showToast({ title: 'Drive Cleaned!', message: `Successfully removed ${res.count} junk folders.`, type: 'success' })
      setItems([])
    }
  }

  const totalSize = items.reduce((acc, curr) => acc + curr.size, 0)
  const formattedSize = (totalSize / (1024 * 1024 * 1024)).toFixed(2) + ' GB'

  return (
    <div className="cl-page">

      <div className="cl-controls anim-scale-in">
        <BrowseRow 
          label="Root Project Directory" 
          value={rootPath} 
          placeholder="e.g. D:\Work\2024" 
          onBrowse={() => api.dialog.openFolder().then((p: string) => p && setRootPath(p))}
          onChange={setRootPath}
        />
        <Button variant="primary" accent="var(--danger)" onClick={scan} disabled={scanning || !rootPath}>
          {scanning ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spin-slow"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
              Scanning...
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Scan for Junk
            </span>
          )}
        </Button>
      </div>

      <div 
        className="cl-body"
        style={{
          display: 'grid',
          gridTemplateColumns: panelAlign === 'right' ? `1fr 6px ${sideWidth}px` : `${sideWidth}px 6px 1fr`,
          gap: 0,
          alignItems: 'flex-start'
        }}
      >
        {panelAlign === 'right' ? (
          <>
            <Card className="cl-list-card anim-scale-in">
              <CardHeader 
                title="Detected Junk Folders" 
                accent="var(--danger)" 
                accentSoft="var(--danger-soft)" 
                right={
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <GhostButton size="sm" onClick={() => setPanelAlign(p => p === 'left' ? 'right' : 'left')}>⇆ Layout</GhostButton>
                  </div>
                }
              />
              <div className="cl-list">
                {items.length === 0 ? (
                  <div className="cl-empty">
                    <div className="cl-empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8"/><path d="M19 15v6"/><path d="M22 18h-6"/></svg>
                    </div>
                    <p>{scanning ? 'Scanning project folders...' : 'No junk detected or folder not scanned.'}</p>
                  </div>
                ) : (
                  items.map((item, i) => (
                    <div key={item.path} className="cl-item anim-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                      <div className="cl-item-info">
                        <span className="cl-item-name">{item.name}</span>
                        <span className="cl-item-path truncate">{item.path}</span>
                      </div>
                      <span className="cl-item-size">{(item.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* DRAGGABLE SPLITTER */}
            <div 
              className="cl-splitter"
              onMouseDown={handleMouseDown}
              title="Drag to resize layout"
            />

            <Card className="cl-summary-card anim-scale-in" style={{ animationDelay: '200ms' }}>
              <CardHeader title="Summary" accent="var(--danger)" accentSoft="var(--danger-soft)" />
              <div className="cl-summary-body">
                <div className="cl-stat">
                  <span className="cl-stat-label">Folders Found</span>
                  <span className="cl-stat-value">{items.length}</span>
                </div>
                <div className="cl-stat">
                  <span className="cl-stat-label">Space Reclaimable</span>
                  <span className="cl-stat-value cl-stat-value--highlight">{formattedSize}</span>
                </div>
                <p className="cl-warning-text" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span>This will delete Auto-Saves, Previews, and Proxies. Ensure your projects are safely closed.</span>
                </p>
                <Button 
                  variant="primary" 
                  size="lg" 
                  accent="var(--danger)" 
                  disabled={items.length === 0 || cleaning}
                  onClick={cleanAll}
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  {cleaning ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spin-slow"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      Cleaning...
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      Clean All Junk
                    </span>
                  )}
                </Button>
              </div>
            </Card>
          </>
        ) : (
          <>
            <Card className="cl-summary-card anim-scale-in" style={{ animationDelay: '200ms' }}>
              <CardHeader title="Summary" accent="var(--danger)" accentSoft="var(--danger-soft)" />
              <div className="cl-summary-body">
                <div className="cl-stat">
                  <span className="cl-stat-label">Folders Found</span>
                  <span className="cl-stat-value">{items.length}</span>
                </div>
                <div className="cl-stat">
                  <span className="cl-stat-label">Space Reclaimable</span>
                  <span className="cl-stat-value cl-stat-value--highlight">{formattedSize}</span>
                </div>
                <p className="cl-warning-text" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span>This will delete Auto-Saves, Previews, and Proxies. Ensure your projects are safely closed.</span>
                </p>
                <Button 
                  variant="primary" 
                  size="lg" 
                  accent="var(--danger)" 
                  disabled={items.length === 0 || cleaning}
                  onClick={cleanAll}
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  {cleaning ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spin-slow"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      Cleaning...
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      Clean All Junk
                    </span>
                  )}
                </Button>
              </div>
            </Card>

            {/* DRAGGABLE SPLITTER */}
            <div 
              className="cl-splitter"
              onMouseDown={handleMouseDown}
              title="Drag to resize layout"
            />

            <Card className="cl-list-card anim-scale-in">
              <CardHeader 
                title="Detected Junk Folders" 
                accent="var(--danger)" 
                accentSoft="var(--danger-soft)" 
                right={
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <GhostButton size="sm" onClick={() => setPanelAlign(p => p === 'left' ? 'right' : 'left')}>⇆ Layout</GhostButton>
                  </div>
                }
              />
              <div className="cl-list">
                {items.length === 0 ? (
                  <div className="cl-empty">
                    <div className="cl-empty-icon">🍃</div>
                    <p>{scanning ? 'Scanning project folders...' : 'No junk detected or folder not scanned.'}</p>
                  </div>
                ) : (
                  items.map((item, i) => (
                    <div key={item.path} className="cl-item anim-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                      <div className="cl-item-info">
                        <span className="cl-item-name">{item.name}</span>
                        <span className="cl-item-path truncate">{item.path}</span>
                      </div>
                      <span className="cl-item-size">{(item.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        )}
      </div>
      {isDragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none', background: 'transparent' }} />
      )}
    </div>
  )
}
