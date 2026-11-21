import React, { useState, useEffect } from 'react'
import './HardwareMonitor.css'

const api = (window as any).api

function getMetricColor(val: number): string {
  if (val >= 80) return '#ef4444' // Red (high load)
  if (val >= 50) return '#eab308' // Yellow (medium)
  return '#22c55e' // Green (safe)
}

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
      unAdder = api.titleAdder.onProgress(() => setActiveJob(prev => prev ? prev : true))
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
        <span className="hw-title">System Vitals & Hardware Engine</span>
        {activeJob && (
          <span className="hw-status-tag hw-status-tag--active">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Processing High-Load Render
          </span>
        )}
      </div>

      <div className="hw-bars">
        <div className="hw-bar-row">
          <div className="hw-label">CPU</div>
          <div className="hw-track">
            <div 
              className="hw-fill hw-fill--cpu" 
              style={{ width: `${Math.max(stats.cpu, 3)}%`, background: getMetricColor(stats.cpu) }} 
            />
          </div>
          <div className="hw-value" style={{ color: getMetricColor(stats.cpu) }}>{Math.round(stats.cpu)}%</div>
        </div>

        <div className="hw-bar-row">
          <div className="hw-label">RAM</div>
          <div className="hw-track">
            <div 
              className="hw-fill hw-fill--ram" 
              style={{ width: `${Math.max(stats.ram, 3)}%`, background: getMetricColor(stats.ram) }} 
            />
          </div>
          <div className="hw-value" style={{ color: getMetricColor(stats.ram) }}>{Math.round(stats.ram)}%</div>
        </div>

        <div className="hw-bar-row">
          <div className="hw-label">DISK</div>
          <div className="hw-track">
            <div 
              className="hw-fill hw-fill--disk" 
              style={{ width: `${Math.max(stats.disk, 3)}%`, background: getMetricColor(stats.disk) }} 
            />
          </div>
          <div className="hw-value" style={{ color: getMetricColor(stats.disk) }}>{Math.round(stats.disk)}%</div>
        </div>
      </div>
    </div>
  )
}
