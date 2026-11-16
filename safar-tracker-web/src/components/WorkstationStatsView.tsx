import React, { useState, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  Film,
  Camera,
  Share2,
  Copy,
  Check,
  RefreshCw,
  Calendar,
  Users,
  ShieldCheck,
  Cloud,
  Flame,
  ArrowUpRight,
  HardDrive,
  Search,
  Filter
} from 'lucide-react'
import { AnimatedNumber, type SafarTask, type Stage } from '../App'

interface WorkstationStatsViewProps {
  tasks: SafarTask[]
  safars: Array<{
    safarName: string
    safarYear?: string | number
    totalDays?: number
    isArchived?: boolean
    isDone?: boolean
    updatedAt?: string
  }>
  activeSafarGroups: Array<{
    safarName: string
    total: number
    completed: number
    percent: number
    deliveredCount: number
    photoUploadedCount: number
    editingPendingCount: number
    editingCount: number
    uploadPendingCount: number
    uploadedCount: number
    jameyaCount: number
    tasks: SafarTask[]
  }>
  lastUpdated?: string
  connected: boolean
  onRefresh?: () => Promise<void> | void
  onNavigateToSafar?: (safarName: string) => void
}

export default function WorkstationStatsView({
  tasks,
  safars,
  activeSafarGroups,
  lastUpdated,
  connected,
  onRefresh,
  onNavigateToSafar
}: WorkstationStatsViewProps): JSX.Element {
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterArchived, setFilterArchived] = useState<'all' | 'active' | 'archived'>('active')

  // Calculate Overall Metrics
  const metrics = useMemo(() => {
    let aljameaDone = 0
    let uploaded = 0
    let uploadPending = 0
    let editing = 0
    let pending = 0
    let photoUploaded = 0

    tasks.forEach((t) => {
      const stage = (t.stage || 'editing_pending') as Stage
      if (stage === 'jameya') aljameaDone++
      else if (stage === 'uploaded') uploaded++
      else if (stage === 'upload_pending') uploadPending++
      else if (stage === 'editing') editing++
      else pending++

      if (t.photoUploaded || t.photoStage === 'uploaded') {
        photoUploaded++
      }
    })

    const totalTasks = tasks.length
    const delivered = aljameaDone + uploaded
    const completionRate = totalTasks > 0 ? Math.round((delivered / totalTasks) * 100) : 0
    const inProgress = editing + uploadPending

    return {
      totalSafars: safars.length,
      activeSafars: safars.filter((s) => !s.isArchived).length,
      totalTasks,
      delivered,
      aljameaDone,
      uploaded,
      inProgress,
      uploadPending,
      editing,
      pending,
      photoUploaded,
      completionRate
    }
  }, [tasks, safars])

  // Editor Productivity Stats
  const editorStats = useMemo(() => {
    const map = new Map<string, { total: number; done: number; inProgress: number; pending: number }>()

    tasks.forEach((t) => {
      const editor = t.editorName?.trim() || 'Unassigned'
      const cur = map.get(editor) || { total: 0, done: 0, inProgress: 0, pending: 0 }
      cur.total++

      const stage = t.stage || 'editing_pending'
      if (stage === 'jameya' || stage === 'uploaded') {
        cur.done++
      } else if (stage === 'editing' || stage === 'upload_pending') {
        cur.inProgress++
      } else {
        cur.pending++
      }

      map.set(editor, cur)
    })

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        rate: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
  }, [tasks])

  // Filtered Safars for the Table
  const filteredSafars = useMemo(() => {
    return activeSafarGroups
      .filter((g) => {
        if (filterArchived === 'active') {
          const s = safars.find((sf) => sf.safarName === g.safarName)
          if (s?.isArchived) return false
        }
        if (filterArchived === 'archived') {
          const s = safars.find((sf) => sf.safarName === g.safarName)
          if (!s?.isArchived) return false
        }
        if (!searchQuery) return true
        return g.safarName.toLowerCase().includes(searchQuery.toLowerCase())
      })
      .sort((a, b) => b.total - a.total)
  }, [activeSafarGroups, safars, filterArchived, searchQuery])

  // Handle Refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      if (onRefresh) await onRefresh()
    } finally {
      setTimeout(() => setRefreshing(false), 600)
    }
  }

  // Copy Text Summary to Clipboard
  const handleCopySummary = () => {
    const text = [
      `📊 ONE TAP PRODUCTION & WORKSTATION STATS SUMMARY`,
      `📅 Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      `---------------------------------------`,
      `📍 Total Safars: ${metrics.totalSafars} (${metrics.activeSafars} Active)`,
      `🎬 Total Video Sessions: ${metrics.totalTasks}`,
      `✅ Delivered / Ready: ${metrics.delivered} (${metrics.completionRate}%)`,
      `   • AlJamea Done: ${metrics.aljameaDone}`,
      `   • Uploaded: ${metrics.uploaded}`,
      `   • In Progress: ${metrics.inProgress}`,
      `   • Pending: ${metrics.pending}`,
      `📸 Photos Processed & Uploaded: ${metrics.photoUploaded}`,
      `---------------------------------------`,
      `☁️ Cloud Sync: 24/7 Active (Frozen daily at midnight · Client offline-resilient)`
    ].join('\n')

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    const text = `📊 *ONE TAP STATS BRIEFING*\n` +
      `📍 *Safars:* ${metrics.activeSafars} Active / ${metrics.totalSafars} Total\n` +
      `🎬 *Videos Delivered:* ${metrics.delivered} / ${metrics.totalTasks} (${metrics.completionRate}%)\n` +
      `📸 *Photos Uploaded:* ${metrics.photoUploaded}\n` +
      `⚡ *In Progress:* ${metrics.inProgress} | *Pending:* ${metrics.pending}\n` +
      `☁️ _24/7 Cloud Synced & Offline Resilient_`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="stats-view-container anim-fade-in" style={{ paddingBottom: 48 }}>
      {/* ── 24/7 Cloud Sync Banner (Explains Offline Resilience & Zero DB Overload) ── */}
      <section
        className="glass-card"
        style={{
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.88) 100%)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(79, 70, 229, 0.1)',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Cloud size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink)' }}>
                24/7 Cloud-Synced Workstation Telemetry
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  color: connected ? '#047857' : '#b45309'
                }}
              >
                {connected ? '● LIVE SYNCED' : '○ CACHED OFFLINE'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-mid-gray)', margin: '2px 0 0' }}>
              Snapshot updates nightly &amp; on workstation exit. Always online even when the client laptop is powered off.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopySummary}
            title="Copy formatted stats summary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy Stats'}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleShareWhatsApp}
            title="Share via WhatsApp"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <Share2 size={14} />
            <span>Share</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
            <span>Sync Now</span>
          </button>
        </div>
      </section>

      {/* ── Key Metrics Grid ── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 24
        }}
      >
        {/* Total Safars */}
        <div className="glass-card" style={{ padding: 18, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-mid-gray)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Safars Tracked
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(79, 70, 229, 0.08)', color: '#4f46e5' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-ink)', marginTop: 8, lineHeight: 1.1 }}>
            <AnimatedNumber value={metrics.totalSafars} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-mid-gray)', marginTop: 6 }}>
            <strong style={{ color: '#047857' }}>{metrics.activeSafars} Active</strong> · {metrics.totalSafars - metrics.activeSafars} Archived
          </div>
        </div>

        {/* Total Videos */}
        <div className="glass-card" style={{ padding: 18, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-mid-gray)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Video Sessions
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6' }}>
              <Film size={18} />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-ink)', marginTop: 8, lineHeight: 1.1 }}>
            <AnimatedNumber value={metrics.totalTasks} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-mid-gray)', marginTop: 6 }}>
            Across all dated folders &amp; clips
          </div>
        </div>

        {/* Delivered / Completed */}
        <div className="glass-card" style={{ padding: 18, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-mid-gray)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Delivered &amp; Uploaded
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#047857', marginTop: 8, lineHeight: 1.1 }}>
            <AnimatedNumber value={metrics.delivered} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-mid-gray)', marginTop: 6 }}>
            <strong>{metrics.completionRate}%</strong> overall completion rate
          </div>
        </div>

        {/* Photos Uploaded */}
        <div className="glass-card" style={{ padding: 18, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-mid-gray)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Photos Uploaded
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(236, 72, 153, 0.08)', color: '#ec4899' }}>
              <Camera size={18} />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#be185d', marginTop: 8, lineHeight: 1.1 }}>
            <AnimatedNumber value={metrics.photoUploaded} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-mid-gray)', marginTop: 6 }}>
            Verified on Google Drive
          </div>
        </div>

        {/* In Progress */}
        <div className="glass-card" style={{ padding: 18, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-mid-gray)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              In Production
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#b45309', marginTop: 8, lineHeight: 1.1 }}>
            <AnimatedNumber value={metrics.inProgress} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-mid-gray)', marginTop: 6 }}>
            {metrics.editing} editing · {metrics.uploadPending} render/upload
          </div>
        </div>
      </section>

      {/* ── Two-Column Row: Stage Pipeline Breakdown & Editor Leaderboard ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Stage Funnel Visual Breakdown */}
        <div className="glass-card" style={{ padding: 22, borderRadius: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
                Delivery Pipeline Funnel
              </h3>
              <p style={{ fontSize: 12, color: 'var(--color-mid-gray)', margin: '2px 0 0' }}>
                Distribution of video tasks across all production stages
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(79, 70, 229, 0.08)', color: '#4f46e5' }}>
              {metrics.totalTasks} Total
            </span>
          </div>

          {/* Stacked Progress Bar */}
          <div
            style={{
              width: '100%',
              height: 12,
              borderRadius: 999,
              overflow: 'hidden',
              display: 'flex',
              background: '#e2e8f0',
              marginBottom: 18
            }}
          >
            <div
              style={{
                width: `${metrics.totalTasks ? (metrics.aljameaDone / metrics.totalTasks) * 100 : 0}%`,
                background: '#047857'
              }}
              title={`AlJamea Done: ${metrics.aljameaDone}`}
            />
            <div
              style={{
                width: `${metrics.totalTasks ? (metrics.uploaded / metrics.totalTasks) * 100 : 0}%`,
                background: '#10b981'
              }}
              title={`Uploaded: ${metrics.uploaded}`}
            />
            <div
              style={{
                width: `${metrics.totalTasks ? (metrics.uploadPending / metrics.totalTasks) * 100 : 0}%`,
                background: '#06b6d4'
              }}
              title={`Upload Pending: ${metrics.uploadPending}`}
            />
            <div
              style={{
                width: `${metrics.totalTasks ? (metrics.editing / metrics.totalTasks) * 100 : 0}%`,
                background: '#3b82f6'
              }}
              title={`In Progress: ${metrics.editing}`}
            />
            <div
              style={{
                width: `${metrics.totalTasks ? (metrics.pending / metrics.totalTasks) * 100 : 0}%`,
                background: '#f59e0b'
              }}
              title={`Editing Pending: ${metrics.pending}`}
            />
          </div>

          {/* Funnel Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'AlJamea Done (Completed)', count: metrics.aljameaDone, color: '#047857', bg: 'rgba(4, 120, 87, 0.1)' },
              { label: 'Uploaded & Ready', count: metrics.uploaded, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
              { label: 'Upload Pending / Rendering', count: metrics.uploadPending, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
              { label: 'Editing / In Progress', count: metrics.editing, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
              { label: 'Editing Pending (Queue)', count: metrics.pending, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }
            ].map((st) => {
              const pct = metrics.totalTasks > 0 ? Math.round((st.count / metrics.totalTasks) * 100) : 0
              return (
                <div key={st.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: st.color }} />
                    <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{st.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{st.count}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-mid-gray)', minWidth: 32, textAlign: 'right' }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Editor Performance Leaderboard */}
        <div className="glass-card" style={{ padding: 22, borderRadius: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
                Team &amp; Editor Performance
              </h3>
              <p style={{ fontSize: 12, color: 'var(--color-mid-gray)', margin: '2px 0 0' }}>
                Completed output vs pending load per assigned editor
              </p>
            </div>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(79, 70, 229, 0.08)', color: '#4f46e5' }}>
              <Users size={18} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {editorStats.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-mid-gray)', textAlign: 'center', padding: '24px 0' }}>
                No editor assignments found.
              </p>
            ) : (
              editorStats.map((ed) => (
                <div key={ed.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 999,
                          background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {ed.name[0]?.toUpperCase() || 'E'}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{ed.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-mid-gray)' }}>
                        {ed.done} / {ed.total} tasks
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: ed.rate >= 80 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(79, 70, 229, 0.1)',
                          color: ed.rate >= 80 ? '#047857' : '#4f46e5'
                        }}
                      >
                        {ed.rate}%
                      </span>
                    </div>
                  </div>

                  {/* Editor Mini Progress Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: 6,
                      borderRadius: 999,
                      background: 'rgba(0, 0, 0, 0.05)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${ed.rate}%`,
                        height: '100%',
                        background: ed.rate >= 80 ? '#10b981' : '#4f46e5',
                        borderRadius: 999,
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Safar Breakdown Performance Table ── */}
      <section className="glass-card" style={{ padding: 22, borderRadius: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16
          }}
        >
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
              Safar Production Breakdown
            </h3>
            <p style={{ fontSize: 12, color: 'var(--color-mid-gray)', margin: '2px 0 0' }}>
              Granular progress per tour and event
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Safar…"
                style={{
                  height: 32,
                  padding: '0 12px 0 30px',
                  borderRadius: 8,
                  border: '1px solid var(--color-hairline)',
                  fontSize: 12,
                  background: 'var(--color-card-paper)',
                  color: 'var(--color-ink)',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filter Toggle */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(0,0,0,0.04)',
                borderRadius: 8,
                padding: 2
              }}
            >
              {(['active', 'all', 'archived'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterArchived(mode)}
                  style={{
                    border: 'none',
                    background: filterArchived === mode ? '#fff' : 'transparent',
                    color: filterArchived === mode ? 'var(--color-ink)' : 'var(--color-mid-gray)',
                    fontSize: 11,
                    fontWeight: filterArchived === mode ? 700 : 500,
                    padding: '4px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    boxShadow: filterArchived === mode ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-hairline)', color: 'var(--color-mid-gray)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Safar Name</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Dates</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Videos Done</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Photos</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Delivery Rate</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSafars.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-mid-gray)' }}>
                    No Safars matched your filter.
                  </td>
                </tr>
              ) : (
                filteredSafars.map((g) => {
                  const s = safars.find((sf) => sf.safarName === g.safarName)
                  const isArchived = Boolean(s?.isArchived)
                  const delivered = g.deliveredCount || (g.jameyaCount + g.uploadedCount)
                  const rate = g.total > 0 ? Math.round((delivered / g.total) * 100) : 0

                  return (
                    <tr
                      key={g.safarName}
                      style={{
                        borderBottom: '1px solid rgba(0,0,0,0.04)',
                        cursor: onNavigateToSafar ? 'pointer' : 'default',
                        transition: 'background 0.15s'
                      }}
                      onClick={() => onNavigateToSafar?.(g.safarName)}
                    >
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{g.safarName}</span>
                          {onNavigateToSafar && <ArrowUpRight size={13} color="#94a3b8" />}
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-mid-gray)' }}>{g.total}</td>
                      <td style={{ padding: '12px', color: '#047857', fontWeight: 600 }}>
                        {delivered} / {g.total}
                      </td>
                      <td style={{ padding: '12px', color: '#be185d', fontWeight: 600 }}>
                        {g.photoUploadedCount || 0}
                      </td>
                      <td style={{ padding: '12px', minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 999,
                              background: 'rgba(0,0,0,0.06)',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${rate}%`,
                                height: '100%',
                                background: rate === 100 ? '#10b981' : rate > 50 ? '#4f46e5' : '#f59e0b',
                                borderRadius: 999
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>
                            {rate}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: isArchived
                              ? 'rgba(100, 116, 139, 0.1)'
                              : rate === 100
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(79, 70, 229, 0.1)',
                            color: isArchived
                              ? '#475569'
                              : rate === 100
                              ? '#047857'
                              : '#4f46e5'
                          }}
                        >
                          {isArchived ? 'Archived' : rate === 100 ? 'Completed' : 'In Progress'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
