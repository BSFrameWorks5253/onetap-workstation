import React from 'react'
import { useToast } from '../Toast'
import './AutoUpdateModal.css'

export interface UpdateManifestData {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  releaseName?: string
  releaseDate?: string
  downloadUrl?: string
  size?: string
  releaseNotes?: string
  htmlUrl?: string
  source?: 'anything' | 'github'
  isLocalFile?: boolean
  anythingPath?: string
}

export interface UpdateProgressData {
  percent: number
  transferredBytes: number
  totalBytes: number
  speedBytesPerSec: number
}

interface AutoUpdateModalProps {
  isOpen: boolean
  manifest: UpdateManifestData | null
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  progress: UpdateProgressData | null
  errorMsg?: string
  onClose: () => void
  onStartDownload: () => void
  onApplyUpdate: () => void
}

export function AutoUpdateModal({
  isOpen,
  manifest,
  status,
  progress,
  errorMsg,
  onClose,
  onStartDownload,
  onApplyUpdate
}: AutoUpdateModalProps) {
  const { showToast } = useToast()

  if (!isOpen || !manifest) return null

  const isAnythingSource = manifest.source === 'anything'

  const formatMB = (bytes: number): string => {
    if (!bytes || isNaN(bytes)) return '0 MB'
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  const formatSpeed = (bytesPerSec: number): string => {
    if (!bytesPerSec || isNaN(bytesPerSec)) return '0 KB/s'
    if (bytesPerSec >= 1048576) return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
  }

  const handleDownloadClick = () => {
    onStartDownload()
  }

  const handleInstallClick = () => {
    showToast({
      title: 'Launching Installer',
      message: 'One Tap will restart now to apply the update.',
      type: 'success'
    })
    onApplyUpdate()
  }

  return (
    <div className="update-modal-backdrop" onClick={onClose}>
      <div className="update-modal-card" onClick={e => e.stopPropagation()}>
        {/* Glow ambient background aura */}
        <div className="update-modal-glow" />

        {/* Header */}
        <div className="update-modal-header">
          <div className="update-modal-header-title">
            <div className="update-modal-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              </svg>
            </div>
            <div>
              <h3 className="update-modal-heading">
                {isAnythingSource ? 'Anything Ecosystem Update' : 'Software Update'}
              </h3>
              <div className="update-modal-tags">
                <span className="update-modal-tag update-modal-tag--version">
                  v{manifest.latestVersion}
                </span>
                <span className="update-modal-tag" style={{ background: isAnythingSource ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)', color: isAnythingSource ? '#10B981' : '#818cf8', border: isAnythingSource ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(99,102,241,0.3)' }}>
                  {isAnythingSource ? 'Anything Hub' : 'GitHub Releases'}
                </span>
                {manifest.releaseDate && (
                  <span className="update-modal-tag update-modal-tag--date">
                    {manifest.releaseDate}
                  </span>
                )}
                {manifest.size && (
                  <span className="update-modal-tag update-modal-tag--size">
                    {manifest.size}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="update-modal-close" onClick={onClose} title="Close" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Release Notes Content */}
        <div className="update-modal-body">
          {manifest.releaseName && (
            <h4 className="update-release-title">{manifest.releaseName}</h4>
          )}

          <div className="update-release-notes">
            {manifest.releaseNotes ? (
              manifest.releaseNotes.split('\n').map((line, i) => (
                <p key={i} className="update-notes-line">
                  {line}
                </p>
              ))
            ) : (
              <p className="update-notes-line">
                {isAnythingSource
                  ? 'A new verified version of One Tap is available from your local Anything ecosystem.'
                  : 'A new version of One Tap Workstation is available on GitHub Releases with performance improvements and bug fixes.'}
              </p>
            )}
          </div>

          {/* Ecosystem / Channel Notice */}
          <div className="update-channel-notice" style={{
            margin: '12px 0',
            padding: '10px 14px',
            borderRadius: '8px',
            background: isAnythingSource ? 'rgba(16, 185, 129, 0.08)' : 'rgba(99, 102, 241, 0.08)',
            border: isAnythingSource ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(99, 102, 241, 0.25)',
            fontSize: '0.82rem',
            color: 'var(--text-muted, #94a3b8)',
            lineHeight: 1.45,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isAnythingSource ? '#10B981' : '#818cf8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <div>
              <strong style={{ color: isAnythingSource ? '#10B981' : '#818cf8', display: 'block', marginBottom: '2px' }}>
                {isAnythingSource ? 'Direct Anything Ecosystem Delivery' : 'Direct GitHub Fast-Track Update'}
              </strong>
              {isAnythingSource
                ? 'Update sourced from Anything (C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\New folder (2)\\Anything). All your local presets, render stats, and configurations are safely preserved.'
                : 'Microsoft Store users get immediate updates directly from GitHub Releases. All your local settings, presets, and project data are safely preserved across updates and reinstalls.'}
            </div>
          </div>

          {errorMsg && (
            <div className="update-error-box">
              <span className="update-error-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Progress Container during download or ready */}
          {(status === 'downloading' || status === 'ready') && (
            <div className="update-progress-container">
              <div className="update-progress-header">
                <span className="update-progress-label">
                  {status === 'ready'
                    ? 'Update Verified — Ready to Install'
                    : (isAnythingSource ? 'Syncing Update Package from Anything...' : 'Downloading Fast Update from GitHub...')}
                </span>
                <span className="update-progress-percent">
                  {status === 'ready' ? '100%' : `${progress?.percent ?? 0}%`}
                </span>
              </div>

              <div className="update-progress-track">
                <div
                  className="update-progress-fill"
                  style={{
                    width: `${status === 'ready' ? 100 : Math.min(100, Math.max(0, progress?.percent ?? 0))}%`
                  }}
                />
              </div>

              {status === 'downloading' && progress && (
                <div className="update-progress-meta">
                  <span>
                    {formatMB(progress.transferredBytes)} / {formatMB(progress.totalBytes)}
                  </span>
                  <span>{formatSpeed(progress.speedBytesPerSec)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="update-modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          <button className="update-btn update-btn--secondary" onClick={onClose}>
            Remind Me Later
          </button>

          {status === 'available' && (
            <>
              <button
                className="update-btn update-btn--primary"
                onClick={handleDownloadClick}
                title={isAnythingSource ? 'Retrieve update from Anything' : 'Download instant update installer from GitHub'}
                style={isAnythingSource ? { background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none' } : {}}
              >
                <span>{isAnythingSource ? 'Update via Anything' : 'Update via GitHub'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            </>
          )}

          {status === 'downloading' && (
            <button className="update-btn update-btn--disabled" disabled>
              <span className="update-spinner" />
              <span>{isAnythingSource ? 'Syncing' : 'Downloading'} ({progress?.percent ?? 0}%)...</span>
            </button>
          )}

          {status === 'ready' && (
            <button className="update-btn update-btn--success" onClick={handleInstallClick}>
              <span>Restart & Install Now</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
