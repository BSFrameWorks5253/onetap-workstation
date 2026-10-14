import React, { useState } from 'react'
import './SetupWizard.css'
import zenLogo from '../../assets/zen_final_nobg.png'

interface SetupWizardProps {
  onDone: () => void
}

export default function SetupWizard({ onDone }: SetupWizardProps): JSX.Element {
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function browse(): Promise<void> {
    const api = (window as any).api
    const p = await api.dialog.openFolder({ title: 'Choose Settings Storage Folder' })
    if (p) { setFolder(p); setError('') }
  }

  async function confirmFolder(): Promise<void> {
    if (!folder) { setError('Please choose a folder first.'); return }
    setBusy(true)
    try {
      const api = (window as any).api
      await api.settings.completeSetup(folder)
      onDone()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setup-overlay anim-fade-in">
      <div className="setup-window">
        {/* Hero Header */}
        <div className="setup-hero">
          <div className="setup-hero-inner">
            <div className="setup-hero-logo" style={{ padding: '6px', background: '#F7F4EE', border: '1.5px solid rgba(229,192,123,0.4)' }}>
              <img src={zenLogo} alt="Zen Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div className="setup-hero-text">
              <h1>Welcome to Uni Desk</h1>
              <p>Quick setup — takes under a minute.</p>
            </div>
          </div>
        </div>

        <div className="setup-card">
          <div className="setup-card-body">
            {/* Step badge */}
            <div className="setup-step-badge">
              Choose Storage Folder
            </div>

            <h2 className="setup-section-title">Where should settings.json be saved?</h2>
            <p className="setup-description">
              Choose any folder you own (e.g. Documents). The app will always read your
              settings from this exact location. This is a one-time choice you can change later in Settings.
            </p>

            {/* Path display & interactive input */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div className="setup-path-box" style={{ flex: 1, margin: 0, padding: '8px 12px' }}>
                <span className="setup-path-icon">📂</span>
                <input
                  type="text"
                  value={folder}
                  onChange={(e) => {
                    setFolder(e.target.value)
                    setError('')
                  }}
                  placeholder="Paste folder path or click Browse..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#2d3748',
                    fontSize: '13px',
                    fontWeight: 600,
                    width: '100%'
                  }}
                />
              </div>
              <button
                type="button"
                className="setup-browse-btn"
                onClick={browse}
                style={{ width: 'auto', padding: '0 20px', whiteSpace: 'nowrap' }}
              >
                Browse...
              </button>
            </div>

            {/* Quick Suggestions */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => {
                  setFolder('C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\DATABASE ONT')
                  setError('')
                }}
                style={{
                  background: 'rgba(229, 192, 123, 0.25)',
                  border: '1px solid rgba(229, 192, 123, 0.5)',
                  borderRadius: '12px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#8c6d23',
                  cursor: 'pointer'
                }}
              >
                ⚡ Use: Desktop/DATABASE ONT
              </button>
            </div>

            {error && (
              <p style={{ color: '#e57373', fontSize: 12, margin: '8px 0 0' }}>{error}</p>
            )}

            <div className="setup-divider" />

            <button
              className="setup-start-btn"
              disabled={!folder || busy}
              onClick={confirmFolder}
            >
              {busy ? 'Setting up…' : 'Next: AI Profile →'}
            </button>

            <p className="setup-footer-note">
              Your settings file will be saved securely in the chosen folder.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
