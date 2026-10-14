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
          {scanning ? '🔄 Scanning...' : '🔍 Scan for Junk'}
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
                <p className="cl-warning-text">
                  ⚠ This will delete Auto-Saves, Previews, and Proxies. Ensure your projects are safely closed.
                </p>
                <Button 
                  variant="primary" 
                  size="lg" 
                  accent="var(--danger)" 
                  disabled={items.length === 0 || cleaning}
                  onClick={cleanAll}
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  {cleaning ? '🧹 Cleaning...' : '🚀 Clean All Junk'}
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
                <p className="cl-warning-text">
                  ⚠ This will delete Auto-Saves, Previews, and Proxies. Ensure your projects are safely closed.
                </p>
                <Button 
                  variant="primary" 
                  size="lg" 
                  accent="var(--danger)" 
                  disabled={items.length === 0 || cleaning}
                  onClick={cleanAll}
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  {cleaning ? '🧹 Cleaning...' : '🚀 Clean All Junk'}
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
