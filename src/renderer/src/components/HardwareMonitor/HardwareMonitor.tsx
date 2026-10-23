import React, { useState, useEffect } from 'react'
import './HardwareMonitor.css'

const api = (window as any).api

export default function HardwareMonitor(): JSX.Element {
  const [stats, setStats] = useState({ cpu: 0, ram: 0, disk: 0 })
  const [activeJob, setActiveJob] = useState(false)

  useEffect(() => {
    if (!api || !api.system || !api.titleAdder) return

    const fetchStats = async () => {
      if (document.hidden) return
      try {
        const res = await api.system.getStats()
        if (res) setStats(res)
      } catch (e) { console.error(e) }
    }
    fetchStats()
    const timer = setInterval(fetchStats, 5000)

    // Listen for render status
    let unAdder: any, unDone: any
    try {
      unAdder = api.titleAdder.onProgress(() => setActiveJob(true))
      unDone  = api.titleAdder.onDone(() => setActiveJob(false))
    } catch (e) { console.warn('Monitor listeners failed:', e) }

    return () => {
      clearInterval(timer)
      if (typeof unAdder === 'function') unAdder()
      if (typeof unDone === 'function') unDone()
    }
  }, [])

  return (
    <div className={`hw-monitor ${activeJob ? 'hw-monitor--active' : ''}`}>
      <div className="hw-header">
        <span className="hw-dot" />
        <span className="hw-title">System Vitals & Hardware Engine</span>
        {activeJob ? (
          <span className="hw-status-tag hw-status-tag--active">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Processing High-Load Render
          </span>
        ) : (
          <span className="hw-status-tag hw-status-tag--ready">â— Optimal</span>
        )}
      </div>

      <div className="hw-bars">
        <div className="hw-bar-row">
          <div className="hw-label">CPU</div>
          <div className="hw-track">
            <div 
              className={`hw-fill hw-fill--cpu ${stats.cpu > 80 ? 'hw-fill--danger' : ''}`} 
              style={{ width: `${Math.max(stats.cpu, 3)}%` }} 
            />
          </div>
          <div className="hw-value">{Math.round(stats.cpu)}%</div>
        </div>

        <div className="hw-bar-row">
          <div className="hw-label">RAM</div>
          <div className="hw-track">
            <div 
              className={`hw-fill hw-fill--ram ${stats.ram > 85 ? 'hw-fill--danger' : ''}`} 
              style={{ width: `${Math.max(stats.ram, 3)}%` }} 
            />
          </div>
          <div className="hw-value">{Math.round(stats.ram)}%</div>
        </div>

        <div className="hw-bar-row">
          <div className="hw-label">DISK</div>
          <div className="hw-track">
            <div 
              className={`hw-fill hw-fill--disk ${stats.disk > 90 ? 'hw-fill--danger' : ''}`} 
              style={{ width: `${Math.max(stats.disk, 3)}%` }} 
            />
          </div>
          <div className="hw-value">{Math.round(stats.disk)}%</div>
        </div>
      </div>

      {activeJob && (
        <div className="hw-pulse">
          <div className="hw-pulse-wave" />
          <p>Engine Active · Processing High-Fidelity Video Feed</p>
        </div>
      )}
    </div>
  )
}

