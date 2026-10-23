import React, { useState } from 'react'
import { Modal } from '../Modal'
import OntoLoader from './OntoLoader'
import AstralPreloader from './AstralPreloader'
import WalbiIntroLoader from './WalbiIntroLoader'
import SpasojeLoader from './SpasojeLoader'
import MobilePulseLoader from './MobilePulseLoader'
import OneTapLogo from '../OneTapLogo'
import './LoaderGalleryModal.css'

export type LoaderType = 'adobe' | 'onto' | 'astral' | 'walbi' | 'spasoje' | 'mobile'

interface LoaderGalleryModalProps {
  open: boolean
  onClose: () => void
  onSelect?: (loaderId: LoaderType) => void
}

export default function LoaderGalleryModal({
  open,
  onClose,
  onSelect
}: LoaderGalleryModalProps): JSX.Element | null {
  const [selectedLoader, setSelectedLoader] = useState<LoaderType>(() => {
    return (localStorage.getItem('ot_active_loader_theme') as LoaderType) || 'adobe'
  })
  const [previewProgress, setPreviewProgress] = useState(68)
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light')

  if (!open) return null

  const handleApply = (id: LoaderType) => {
    setSelectedLoader(id)
    localStorage.setItem('ot_active_loader_theme', id)
    if (onSelect) onSelect(id)
  }

  const loaders = [
    {
      id: 'adobe' as LoaderType,
      name: 'Adobe CC Master Studio',
      tag: 'Anything Ecosystem Official',
      desc: 'Official Adobe Creative Cloud master studio window with "Ot" squircle emblem, real-time diagnostic telemetry, and glowing segmented shimmer progress bar.',
      comp: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '280px', padding: '12px', background: '#18181B', borderRadius: '12px', border: '1px solid #2B2B30' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            <OneTapLogo size={32} glow={true} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 900, color: '#FFF' }}>One Tap</span>
              <span style={{ fontSize: '9px', color: '#fda4af', fontFamily: 'monospace' }}>Direct3D 12 Low-Latency</span>
            </div>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#09090B', borderRadius: '999px', overflow: 'hidden', border: '1px solid #3F3F46' }}>
            <div style={{ width: `${previewProgress}%`, height: '100%', background: 'linear-gradient(90deg, #E11D48, #F43F5E, #F59E0B)', borderRadius: '999px', boxShadow: '0 0 10px rgba(225,29,72,0.8)' }} />
          </div>
          <span style={{ fontSize: '10px', color: '#A1A1AA', fontFamily: 'monospace', alignSelf: 'flex-start' }}>Mounting batch rendering engine... {previewProgress}%</span>
        </div>
      )
    },
    {
      id: 'onto' as LoaderType,
      name: 'ONTO Kinetic Typography',
      tag: 'Awwwards Onto Inspired',
      desc: 'Authentic 5-stage mechanical choreography from Awwwards ONTO with rising blocks, cutouts, squeeze, chain merge, and expansion.',
      comp: <OntoLoader progress={previewProgress} theme={previewTheme} />
    },
    {
      id: 'astral' as LoaderType,
      name: 'Astral Frontier Cosmic Polyhedron',
      tag: 'Awwwards Astral Inspired',
      desc: 'Concentric planetary orbital rings and rotating geometric core with telemetry.',
      comp: <AstralPreloader progress={previewProgress} theme={previewTheme} />
    },
    {
      id: 'walbi' as LoaderType,
      name: 'Walbi Audio Soundwave Equalizer',
      tag: 'Awwwards Walbi Inspired',
      desc: 'Audio-frequency reactive bars and ambient pulsing energy glow.',
      comp: <WalbiIntroLoader progress={previewProgress} theme={previewTheme} />
    },
    {
      id: 'spasoje' as LoaderType,
      name: 'Spasoje Perovic Editorial Ticker',
      tag: 'Awwwards Spasoje Inspired',
      desc: 'Bold Swiss typography with massive condensed numerals and razor-thin hairline track.',
      comp: <SpasojeLoader progress={previewProgress} theme={previewTheme} />
    },
    {
      id: 'mobile' as LoaderType,
      name: 'Mobbin Sleek Workstation Dock',
      tag: 'Mobbin Mobile Adapted',
      desc: 'Floating card with step-by-step pipeline status checklist and rounded pill badge.',
      comp: <MobilePulseLoader progress={previewProgress} theme={previewTheme} />
    }
  ]

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="✨ Preloader & Loading Screen Template Showcase"
    >
      <div className="loader-gallery-body">
        <div className="loader-gallery-toolbar">
          <div className="loader-gallery-hint">
            Preview, test progress, and select your favorite boot loading screen for UniDesk Studio.
          </div>
          <div className="loader-gallery-controls">
            <label className="loader-gallery-slider-label">
              <span>Simulate Progress: {previewProgress}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={previewProgress}
                onChange={(e) => setPreviewProgress(Number(e.target.value))}
                className="loader-gallery-range"
              />
            </label>
            <button
              type="button"
              className={`loader-theme-toggle ${previewTheme === 'dark' ? 'active' : ''}`}
              onClick={() => setPreviewTheme(t => t === 'light' ? 'dark' : 'light')}
            >
              {previewTheme === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
        </div>

        <div className="loader-gallery-grid">
          {loaders.map((item) => {
            const isSelected = selectedLoader === item.id
            return (
              <div
                key={item.id}
                className={`loader-gallery-card ${isSelected ? 'active' : ''} theme-preview-${previewTheme}`}
                onClick={() => handleApply(item.id)}
              >
                <div className="loader-card-header">
                  <div className="loader-card-meta">
                    <span className="loader-card-tag">{item.tag}</span>
                    <h4 className="loader-card-title">{item.name}</h4>
                  </div>
                  {isSelected && <span className="loader-badge-active">✔ ACTIVE BOOT SCREEN</span>}
                </div>

                <div className="loader-card-preview-area">
                  {item.comp}
                </div>

                <div className="loader-card-footer">
                  <p className="loader-card-desc">{item.desc}</p>
                  <button
                    type="button"
                    className={`loader-select-btn ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleApply(item.id)
                    }}
                  >
                    {isSelected ? 'Active Boot Screen' : 'Select This Template'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
