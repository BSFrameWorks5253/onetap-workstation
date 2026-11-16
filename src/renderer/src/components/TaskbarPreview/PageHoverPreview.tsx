import React from 'react'
import type { PageKey } from '../../types'
import { PAGE_META } from '../../types'
import { PageIcon } from '../PageIcon'
import './PageHoverPreview.css'

interface PageHoverPreviewProps {
  pageKey: PageKey
  position: { top: number; left: number }
  busy?: boolean
  progress?: number | null
}

export default function PageHoverPreview({
  pageKey,
  position,
  busy,
  progress
}: PageHoverPreviewProps): JSX.Element {
  const meta = PAGE_META[pageKey]

  const getPageLiveDetails = () => {
    switch (pageKey) {
      case 'adder': {
        const batchPairs = localStorage.getItem('ot_converter_batch_pairs')
        let count = 0
        try { count = batchPairs ? JSON.parse(batchPairs).length : 0 } catch {}
        return {
          status: busy ? `Rendering (${progress || 0}%)` : (count > 0 ? `${count} Batch(es) Queued` : 'Ready to Render'),
          badgeVariant: busy ? 'warning' : 'success',
          metric: 'Dual-pass HEVC / Auto Audio',
          previewType: 'adder'
        }
      }
      case 'converter': {
        return {
          status: 'Auto-Matched JPG Move',
          badgeVariant: 'info',
          metric: 'Batch-aware photo renaming',
          previewType: 'converter'
        }
      }
      case 'stats': {
        const total = localStorage.getItem('ot_converter_stats_converted') || '0'
        return {
          status: `${total} Completed Renders`,
          badgeVariant: 'success',
          metric: 'Live Production Analytics',
          previewType: 'stats'
        }
      }
      case 'tracker': {
        return {
          status: 'Multi-Drive Autonomous Sentinel',
          badgeVariant: 'info',
          metric: 'Safar & Date production tracker',
          previewType: 'tracker'
        }
      }
      case 'notes': {
        return {
          status: 'Scratchpad & Event Notes',
          badgeVariant: 'info',
          metric: 'Auto-saved persistent storage',
          previewType: 'notes'
        }
      }
      case 'settings': {
        return {
          status: 'Workstation System Engine',
          badgeVariant: 'muted',
          metric: 'Audio, Themes & Paths',
          previewType: 'settings'
        }
      }
      default:
        return {
          status: 'Online & Available',
          badgeVariant: 'muted',
          metric: meta?.subtitle || 'Workstation Tool',
          previewType: 'default'
        }
    }
  }

  const details = getPageLiveDetails()

  // Extract discovered & archived safars for live Task Tracker preview
  const safarData = React.useMemo(() => {
    if (pageKey !== 'tracker') return { ongoing: [], archived: [] }
    try {
      const folderSafarsRaw = localStorage.getItem('ot_stats_folder_safars')
      const folderSafars: Record<string, string> = folderSafarsRaw ? JSON.parse(folderSafarsRaw) : {}
      const archivedRaw = localStorage.getItem('ot_tracker_archived_safar_names')
      const archivedSet = new Set<string>(archivedRaw ? JSON.parse(archivedRaw) : [])

      const allSafars = Array.from(new Set(Object.values(folderSafars))).filter(s => s && s !== 'Unassigned')
      const ongoing = allSafars.filter(s => !archivedSet.has(s)).slice(0, 4)
      const archived = allSafars.filter(s => archivedSet.has(s)).slice(0, 4)

      return { ongoing, archived }
    } catch {
      return { ongoing: [], archived: [] }
    }
  }, [pageKey])

  return (
    <div
      className="taskbar-preview-popover anim-scale-in"
      style={{
        top: `${Math.max(12, position.top - 40)}px`,
        left: `${position.left + 12}px`
      }}
    >
      <div className="taskbar-preview-header">
        <div className="taskbar-preview-title-row">
          <span className="taskbar-preview-icon">
            <PageIcon pageKey={pageKey} size={18} color={meta.accent} />
          </span>
          <span className="taskbar-preview-title">{meta.label}</span>
        </div>
        <span className={`taskbar-preview-chip chip-${details.badgeVariant}`}>
          <span className="taskbar-preview-pulse-dot" />
          {details.status}
        </span>
      </div>

      {/* Miniature Visual Mockup Representation */}
      <div className="taskbar-preview-thumbnail">
        <div className="thumb-window-bar">
          <span className="thumb-dot red" />
          <span className="thumb-dot yellow" />
          <span className="thumb-dot green" />
          <span className="thumb-url-bar">{meta.label.toLowerCase()}://workstation</span>
        </div>

        <div className="thumb-screen-content">
          {details.previewType === 'adder' && (
            <div className="thumb-adder-layout">
              <div className="thumb-row thumb-row-bar" style={{ background: meta.accent }} />
              <div className="thumb-grid">
                <div className="thumb-box" />
                <div className="thumb-box" />
              </div>
              <div className="thumb-action-pill" style={{ background: meta.accent }} />
            </div>
          )}

          {details.previewType === 'converter' && (
            <div className="thumb-converter-layout">
              <div className="thumb-pill-row">
                <span className="thumb-mini-pill" />
                <span className="thumb-mini-pill" />
              </div>
              <div className="thumb-dual-row">
                <div className="thumb-strip-left" />
                <div className="thumb-strip-right" />
              </div>
            </div>
          )}

          {details.previewType === 'tracker' && (
            <div className="thumb-tracker-layout" style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Safars</span>
                <span style={{ color: '#06b6d4', fontWeight: 600 }}>{safarData.ongoing.length} Active</span>
              </div>
              {safarData.ongoing.length > 0 ? (
                safarData.ongoing.map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-primary)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{s}</span>
                    <span style={{ fontSize: '9px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>In Production</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active safars in production</div>
              )}
              {safarData.archived.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>100% Delivered (Archived)</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{safarData.archived.length} Completed</span>
                  </div>
                  {safarData.archived.map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-primary)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{s}</span>
                      <span style={{ fontSize: '9px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>100% Delivered</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {details.previewType !== 'adder' && details.previewType !== 'converter' && details.previewType !== 'tracker' && (
            <div className="thumb-generic-layout">
              <div className="thumb-line full" />
              <div className="thumb-line medium" />
              <div className="thumb-line short" />
            </div>
          )}
        </div>
      </div>

      <div className="taskbar-preview-footer">
        <span className="taskbar-preview-metric">{details.metric}</span>
        <span className="taskbar-preview-shortcut">Click to switch</span>
      </div>
    </div>
  )
}
