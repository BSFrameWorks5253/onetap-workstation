import React, { useState, useEffect } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { PAGE_META, PageKey } from '../../types'
import { PageIcon } from '../../components/PageIcon'
import HardwareMonitor from '../../components/HardwareMonitor'
import { useTheme } from '../../theme/ThemeContext'
import './Dashboard.css'
import zenLogo from '../../assets/zen_final_nobg.png'



/** Circular SVG progress ring */
function TaskRing({
  progress, label, pageKey, color
}: { progress: number; label: string; pageKey: PageKey; color: string }) {
  const r = 26
  const circ = 2 * Math.PI * r
  const dash = (progress / 100) * circ

  return (
    <div className="db-task-ring">
      <svg width="68" height="68" viewBox="0 0 68 68">
        {/* Track */}
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="5" />
        {/* Progress arc */}
        <circle
          cx="34" cy="34" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4} /* start from top */
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.4s ease' }}
        />
        <foreignObject x="25" y="14" width="18" height="18">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
            <PageIcon pageKey={pageKey} size={16} color={color} />
          </div>
        </foreignObject>
        <text x="34" y="47" textAnchor="middle" fontSize="9" fill="var(--text-primary)" fontWeight="700" opacity="0.9">
          {Math.round(progress)}%
        </text>
      </svg>
      <span className="db-task-ring-label">{label}</span>
    </div>
  )
}

export default function Dashboard(): JSX.Element {
  const { textOverrides, orderedNav } = useTheme()
  function navigateToAdder(): void {
    if (typeof (window as any).showPage === 'function') {
      (window as any).showPage('adder')
    }
  }
  ;(window as any).navigateToAdder = navigateToAdder

  const navigate = (window as any).showPage

  // Listen for active background jobs through global state
  const [adderProgress, setAdderProgress] = useState<number | null>(null)
  const [syncProgress, setSyncProgress] = useState<number | null>(null)

  // Real-time render metrics state
  const [statsCount, setStatsCount] = useState(0)
  const [rendersToday, setRendersToday] = useState(0)
  const [_latestRender, setLatestRender] = useState<string | null>(null)

  useEffect(() => {
    const loadStats = () => {
      try {
        const raw = localStorage.getItem('render_stats')
        if (raw) {
          const records = JSON.parse(raw) as any[]
          if (Array.isArray(records)) {
            const normalRecords = records.filter(r => !r.isReedit)
            setStatsCount(normalRecords.length)
            
            // Calculate renders today
            const startOfDay = new Date()
            startOfDay.setHours(0, 0, 0, 0)
            const todayCount = normalRecords.filter(r => r.date && r.date >= startOfDay.getTime()).length
            setRendersToday(todayCount)

            // Get latest render name
            if (normalRecords.length > 0) {
              const sorted = [...normalRecords].sort((a, b) => (b.date || 0) - (a.date || 0))
              setLatestRender(sorted[0].name || sorted[0].prefix || null)
            }
          }
        }
      } catch (e) {
        console.error('Failed to load dashboard stats:', e)
      }
    }

    loadStats()
    window.addEventListener('stats-updated', loadStats)
    return () => window.removeEventListener('stats-updated', loadStats)
  }, [])

  useEffect(() => {
    const api = (window as any).api
    if (!api) return

    let unsubAdderFound: any, unsubAdderProg: any, unsubAdderDone: any
    let unsubSyncFound: any, unsubSyncProg: any, unsubSyncDone: any

    if (api.titleAdder) {
      unsubAdderFound = api.titleAdder.onFound(() => setAdderProgress(0))
      unsubAdderProg  = api.titleAdder.onProgress((d: { percent: number }) => setAdderProgress(d.percent ?? 0))
      unsubAdderDone  = api.titleAdder.onDone(() => setAdderProgress(null))
    }
    if (api.driveSync) {
      unsubSyncFound = api.driveSync.onFound(() => setSyncProgress(0))
      unsubSyncProg  = api.driveSync.onProgress((d: { percent: number }) => setSyncProgress(d.percent ?? 0))
      unsubSyncDone  = api.driveSync.onDone(() => setSyncProgress(null))
    }

    return () => {
      [unsubAdderFound, unsubAdderProg, unsubAdderDone,
       unsubSyncFound, unsubSyncProg, unsubSyncDone]
        .filter(Boolean).forEach(fn => typeof fn === 'function' && fn())
    }
  }, [])

  const hasActiveTasks = adderProgress !== null || syncProgress !== null

  return (
    <div className="db-page">
      <div className="db-top-section anim-scale-in" style={{ animationDelay: '50ms' }}>
        <div className="db-monitor-col">
          <HardwareMonitor />
        </div>
        <div className="db-quick-stats-col">
          <div className="db-quick-stat-card">
            <span className="db-quick-stat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
            </span>
            <div className="db-quick-stat-info">
              <span className="db-quick-stat-val">{statsCount}</span>
              <span className="db-quick-stat-lbl">Total Renders</span>
            </div>
          </div>
          <div className="db-quick-stat-card">
            <span className="db-quick-stat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <div className="db-quick-stat-info">
              <span className="db-quick-stat-val">{rendersToday}</span>
              <span className="db-quick-stat-lbl">Processed Today</span>
            </div>
          </div>
        </div>
      </div>

      <div className="db-grid">
        {/* Main action cards */}
        {orderedNav.filter(k => {
          if (k === 'dashboard' || k === 'drivesync' || k === 'gdrive' || k === 'cameratransfer' || k === 'excelmerger' || k === 'pvseparator') return false
          try {
            const hidden = JSON.parse(textOverrides['hidden_tools'] || '[]')
            return !hidden.includes(k)
          } catch { return true }
        }).map((key, i) => {
          const p = PAGE_META[key as PageKey]
          return (
            <div 
              key={key} 
              className="db-card-wrap anim-scale-in" 
              style={{ animationDelay: `${i * 100}ms` }}
              onClick={() => navigate(key)}
            >
              <Card 
                className="db-action-card"
                style={{ 
                  '--card-accent': p.accent,
                  '--card-accent-soft': p.accentSoft
                } as React.CSSProperties}
              >
                <div className="db-card-icon">
                  <PageIcon pageKey={p.key} size={28} color={p.accent} />
                </div>
                <div className="db-card-content">
                  <h3>{p.label}</h3>
                  <p>{p.subtitle}</p>
                </div>
                <div className="db-card-arrow">→</div>
              </Card>
            </div>
          )
        })}

        {/* Welcome card */}
        <Card className="db-welcome-card anim-scale-in" style={{ animationDelay: '400ms' }}>
          <div className="db-welcome-inner">
             <div className="db-welcome-text">
              <div className="db-welcome-badge-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span 
                  className="db-welcome-badge" 
                  style={{ 
                    fontSize: '10px', 
                    fontWeight: 800, 
                    background: 'color-mix(in srgb, var(--theme-accent) 15%, transparent)', 
                    color: 'var(--theme-accent)', 
                    border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)', 
                    padding: '3px 10px', 
                    borderRadius: 'var(--radius-chip)', 
                    letterSpacing: '0.06em',
                    boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-accent) 15%, transparent)'
                  }}
                >
                  ✦ WORKSTATION READY
                </span>
              </div>
              <h2>{textOverrides['welcome_title'] || 'Welcome to Uni Desk v26.10.5'}</h2>
              <p>{textOverrides['welcome_text'] || 'Everything you need for your professional editing workflow is right here. Select a tool above to get started.'}</p>

              {/* Interactive Quick Launch & Hotkey Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
                <div 
                  className="db-hotkey-hint"
                  style={{ marginTop: 0 }}
                  onClick={() => {
                    const evt = new KeyboardEvent('keydown', { key: '?' })
                    window.dispatchEvent(evt)
                  }}
                  title="Click to view shortcuts"
                >
                  <kbd>?</kbd> <span>Shortcuts</span>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => navigate('adder')}
                  icon={<PageIcon pageKey="adder" size={16} color="currentColor" />}
                >
                  Open Title Adder
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('converter')}
                  icon={<PageIcon pageKey="converter" size={16} color="currentColor" />}
                >
                  Video Converter
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('tracker')}
                  icon={<PageIcon pageKey="tracker" size={16} color="currentColor" />}
                >
                  Task Tracker
                </Button>
              </div>

              {/* Active background task rings */}
              {hasActiveTasks && (
                <div className="db-task-rings-row">
                  {adderProgress !== null && (
                    <TaskRing progress={adderProgress} label="Title Adder" pageKey="adder" color="#A78BFA" />
                  )}
                  {syncProgress !== null && (
                    <TaskRing progress={syncProgress} label="Drive Sync" pageKey="drivesync" color="#34D399" />
                  )}
                </div>
              )}
            </div>
            <div 
              className="db-welcome-logo" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                width: '72px', 
                height: '72px', 
                background: 'color-mix(in srgb, var(--theme-accent) 8%, var(--surface))', 
                borderRadius: 'var(--radius-lg)', 
                border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, var(--border))', 
                boxShadow: '0 8px 24px color-mix(in srgb, var(--theme-accent) 15%, transparent), inset 0 1px 0 var(--specular-highlight)', 
                padding: '8px'
              }}
            >
              {textOverrides['brand_acronym'] ? (
                textOverrides['brand_acronym']
              ) : (
                <img src={zenLogo} alt="Zen Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
