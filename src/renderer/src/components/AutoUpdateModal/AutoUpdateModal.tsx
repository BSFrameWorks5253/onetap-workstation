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
      title: '🚀 Launching Installer',
      message: 'Uni Desk will restart now to apply the update.',
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
            <div className="update-modal-icon">🚀</div>
            <div>
              <h3 className="update-modal-heading">Software Update</h3>
              <div className="update-modal-tags">
                <span className="update-modal-tag update-modal-tag--version">
                  v{manifest.latestVersion}
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
          <button className="update-modal-close" onClick={onClose} title="Close">
            ✕
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
                A new version of Uni Desk Workstation is available on GitHub Releases with performance improvements and bug fixes.
              </p>
            )}
          </div>

          {/* Fast Update / Microsoft Store Notice */}
          <div className="update-channel-notice" style={{
            margin: '12px 0',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            fontSize: '0.82rem',
            color: 'var(--text-muted, #94a3b8)',
            lineHeight: 1.45,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
            <div>
              <strong style={{ color: '#818cf8', display: 'block', marginBottom: '2px' }}>Direct GitHub Fast-Track Update</strong>
              Microsoft Store users get immediate updates directly from GitHub Releases. All your local settings, presets, and project data are safely preserved across updates and reinstalls.
            </div>
          </div>

          {errorMsg && (
            <div className="update-error-box">
              <span className="update-error-icon">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Progress Container during download or ready */}
          {(status === 'downloading' || status === 'ready') && (
            <div className="update-progress-container">
              <div className="update-progress-header">
                <span className="update-progress-label">
                  {status === 'ready'
                    ? '🎉 Download Complete — Ready to Install'
                    : 'Downloading Fast Update from GitHub...'}
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
                className="update-btn update-btn--secondary"
                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                onClick={() => {
                  try {
                    // Try store protocol first, fall back to browser URL
                    (window as any).electronAPI?.openExternal?.('ms-windows-store://pdp/?productid=9NBLGGH4NNS1')
                  } catch {
                    (window as any).electronAPI?.openExternal?.('https://apps.microsoft.com')
                  }
                }}
                title="View Uni Desk in Microsoft Store"
              >
                <span>🏬 Microsoft Store</span>
              </button>

              <button className="update-btn update-btn--primary" onClick={handleDownloadClick} title="Download instant update installer from GitHub">
                <span>⚡ Update via GitHub</span>
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
              <span>Downloading ({progress?.percent ?? 0}%)...</span>
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
