/**
 * FileViewerSettingsCard.tsx
 * Settings card for File Viewer status, Explorer thumbnails guidance,
 * and the "Set Uni Desk as Default Viewer" action.
 */
import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'

const api = (window as any).api

// ── Types ─────────────────────────────────────────────────────────────
interface ThumbnailRow {
  icon: string
  label: string
  formats: string[]
  status: 'native' | 'codec' | 'unsupported'
  note: string
  link?: string
}

type RegCategory = 'images' | 'raw' | 'video' | 'pdf' | 'docs'

interface RegStatus {
  category: RegCategory
  label: string
  registered: boolean | null
}

// ── Status badge ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ThumbnailRow['status'] }) {
  const configs = {
    native:      { label: '✅ Built-in',    bg: 'rgba(34,197,94,0.12)',  color: '#22c55e' },
    codec:       { label: '⚠ Needs Codec',  bg: 'rgba(234,179,8,0.12)',  color: '#ca8a04' },
    unsupported: { label: '❌ No Thumbnail', bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' },
  }
  const c = configs[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: '999px',
      background: c.bg, color: c.color,
      fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {c.label}
    </span>
  )
}

// ── Registration pill ─────────────────────────────────────────────────
function RegPill({ registered }: { registered: boolean | null }) {
  if (registered === null) {
    return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>checking…</span>
  }
  return registered
    ? <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>✅ Set</span>
    : <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Not set</span>
}

// ── Main card ─────────────────────────────────────────────────────────
export default function FileViewerSettingsCard() {
  const [collapsed, setCollapsed] = useState(true)
  const [rawCodecAvailable, setRawCodecAvailable] = useState<boolean | null>(null)
  const [ffmpegPath, setFfmpegPath] = useState<string | null>(null)
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean>(false)
  const [dismissed, setDismissed] = useState(false)

  // Registration state per category
  const [regStatus, setRegStatus] = useState<RegStatus[]>([
    { category: 'images', label: '🖼️  Images',   registered: null },
    { category: 'raw',    label: '📷  RAW Photos', registered: null },
    { category: 'video',  label: '🎬  Videos',    registered: null },
    { category: 'pdf',    label: '📄  PDF',        registered: null },
    { category: 'docs',   label: '📝  Documents',  registered: null },
  ])
  const [registering, setRegistering] = useState(false)
  const [registerDone, setRegisterDone] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  useEffect(() => {
    if (api?.viewer?.checkRawCodec) {
      api.viewer.checkRawCodec().then((res: { available: boolean }) => {
        setRawCodecAvailable(res?.available ?? false)
      }).catch(() => setRawCodecAvailable(false))
    }

    if (api?.viewer?.findFfmpeg) {
      api.viewer.findFfmpeg().then((res: { found: boolean; path: string | null }) => {
        setFfmpegAvailable(res.found)
        setFfmpegPath(res.path)
      }).catch(() => {
        setFfmpegAvailable(false)
        setFfmpegPath(null)
      })
    }

    // Check current registration status for representative extensions
    if (api?.viewer?.getDefaultApps) {
      const checkExts = ['.jpg', '.cr2', '.mp4', '.pdf', '.docx']
      api.viewer.getDefaultApps(checkExts).then((res: any) => {
        if (!res?.ok) return
        setRegStatus(prev => prev.map(s => {
          const extMap: Record<RegCategory, string> = {
            images: '.jpg', raw: '.cr2', video: '.mp4', pdf: '.pdf', docs: '.docx'
          }
          const ext = extMap[s.category]
          const info = res.results?.[ext]
          return { ...s, registered: info?.isUniDesk ?? false }
        }))
      }).catch(() => { /* non-fatal */ })
    }
  }, [])

  function openLink(url: string) {
    api?.shell?.openExternal?.(url)
  }

  const handleSetDefault = useCallback(async (cats: RegCategory[]) => {
    setRegistering(true)
    setRegisterDone(false)
    setRegisterError(null)
    try {
      const res = await api.viewer.registerFileAssociation(cats)
      if (res.ok) {
        setRegStatus(prev => prev.map(s => ({
          ...s,
          registered: cats.includes(s.category) ? true : s.registered
        })))
        setRegisterDone(true)
        setTimeout(() => setRegisterDone(false), 3000)
      } else {
        setRegisterError('Registration failed. Try running as administrator.')
      }
    } catch (e: any) {
      setRegisterError(e.message ?? 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }, [])

  const rows: ThumbnailRow[] = [
    {
      icon: '🖼️',
      label: 'Standard Images',
      formats: ['JPG', 'PNG', 'GIF', 'BMP', 'WEBP', 'TIFF', 'HEIC'],
      status: 'native',
      note: 'Windows generates thumbnails natively — no extra install needed.',
    },
    {
      icon: '📷',
      label: 'RAW Camera Photos',
      formats: ['CR2', 'CR3', 'NEF', 'ARW', 'DNG', 'ORF', 'RW2', 'RAF', 'RAW'],
      status: rawCodecAvailable ? 'native' : 'codec',
      note: rawCodecAvailable
        ? 'Windows RAW Image Extension is active — Explorer thumbnails enabled.'
        : 'Requires Windows RAW Image Extension (free from Microsoft Store).',
      link: 'ms-windows-store://pdp/?ProductId=9NCTDW2W1BH8',
    },
    {
      icon: '🎬',
      label: 'Videos (MP4 / WMV)',
      formats: ['MP4', 'WMV', 'M4V', 'TS'],
      status: 'native',
      note: 'Windows Media Foundation generates thumbnails natively.',
    },
    {
      icon: '🎞️',
      label: 'Videos (MKV / AVI / MOV / FLV)',
      formats: ['MKV', 'AVI', 'MOV', 'FLV', 'WEBM'],
      status: ffmpegAvailable ? 'native' : 'codec',
      note: ffmpegAvailable
        ? `FFmpeg detected at "${ffmpegPath}" — in-app frame extraction active.`
        : 'Requires K-Lite Codec Pack, VLC, or FFmpeg for Explorer thumbnails.',
      link: 'https://codecguide.com/download_kl.htm',
    },
    {
      icon: '📄',
      label: 'PDF',
      formats: ['PDF'],
      status: 'native',
      note: 'Windows 10/11 generates PDF thumbnails via Microsoft Edge natively.',
    },
    {
      icon: '📝',
      label: 'Word & Excel',
      formats: ['DOCX', 'XLSX'],
      status: 'unsupported',
      note: 'Office thumbnails require Microsoft Office or LibreOffice.',
      link: 'https://www.libreoffice.org/download/download/',
    },
    {
      icon: '📋',
      label: 'Markdown',
      formats: ['MD', 'MARKDOWN'],
      status: 'unsupported',
      note: 'No native thumbnail provider for Markdown — shown as text icon in Explorer.',
    },
  ]

  const allRegistered = regStatus.every(s => s.registered === true)

  return (
    <Card className="anim-scale-in">
      <div onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}><CardHeader title="🖼️  File Viewer & Explorer Thumbnails" accent="#0EA5E9" accentSoft="rgba(14,165,233,0.08)" /></div>
        <span style={{ marginRight: '20px', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none', color: '#0EA5E9', fontWeight: 'bold' }}>▼</span>
      </div>
      {!collapsed && (
        <div className="st-card-body anim-slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p className="st-desc" style={{ marginBottom: 0 }}>
            Uni Desk can open images, videos, PDFs and documents directly from Windows Explorer.
            Use the button below to register it as your default viewer for any file type category.
          </p>

          {/* ── Set as Default Viewer ── */}
          <div style={{
            padding: '16px 18px', borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(14,165,233,0.10), rgba(99,102,241,0.08))',
            border: '1px solid rgba(14,165,233,0.25)',
            display: 'flex', flexDirection: 'column', gap: '14px',
          }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
              🔗 Set Uni Desk as Default Viewer
            </div>

            {/* Per-category status */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {regStatus.map(s => (
                <div key={s.category} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '5px 12px', borderRadius: '999px',
                  background: s.registered ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.05)',
                  border: s.registered ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.1)',
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-sub)' }}>{s.label}</span>
                  <RegPill registered={s.registered} />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant="primary"
                accent="#0EA5E9"
                accentHv="#0284C7"
                onClick={() => handleSetDefault(['images', 'raw', 'video', 'pdf', 'docs'])}
                disabled={registering || allRegistered}
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 700 }}
              >
                {registering ? '⏳ Registering…' : allRegistered ? '✅ All Set' : '⚡ Register All File Types'}
              </Button>

              <button
                onClick={() => handleSetDefault(['images'])}
                disabled={registering}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px', color: 'var(--text-sub)', cursor: 'pointer',
                  fontSize: '12px', padding: '7px 12px',
                }}
              >
                Images only
              </button>
              <button
                onClick={() => handleSetDefault(['video'])}
                disabled={registering}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px', color: 'var(--text-sub)', cursor: 'pointer',
                  fontSize: '12px', padding: '7px 12px',
                }}
              >
                Videos only
              </button>
            </div>

            {registerDone && (
              <div style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>
                ✅ File associations registered successfully! You may need to restart Explorer for changes to take effect.
              </div>
            )}
            {registerError && (
              <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>
                ⚠️ {registerError}
              </div>
            )}

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Registrations are written to <code style={{ fontSize: '11px', background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '4px' }}>HKCU\Software\Classes</code> — no administrator rights needed.
              Changes apply to your user account only.
            </div>
          </div>

          {/* RAW codec banner */}
          {rawCodecAvailable === false && !dismissed && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              padding: '14px 16px', borderRadius: '12px',
              background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,179,8,0.08))',
              border: '1px solid rgba(245,158,11,0.3)',
            }}>
              <span style={{ fontSize: '22px', flexShrink: 0, marginTop: '1px' }}>📷</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '14px', marginBottom: '4px' }}>
                  RAW Photo Thumbnails Need a Codec
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-sub)', lineHeight: 1.5 }}>
                  CR2, NEF, ARW, DNG and other RAW formats won't show thumbnails in Windows Explorer
                  without the <strong>Windows RAW Image Extension</strong> (free from Microsoft Store).
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <Button
                    variant="primary"
                    accent="#F59E0B"
                    accentHv="#D97706"
                    onClick={() => openLink('ms-windows-store://pdp/?ProductId=9NCTDW2W1BH8')}
                    style={{ padding: '7px 16px', fontSize: '13px' }}
                  >
                    Open Microsoft Store →
                  </Button>
                  <button
                    onClick={() => setDismissed(true)}
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: '12px', padding: '7px 10px',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {rawCodecAvailable === true && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderRadius: '10px',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            }}>
              <span style={{ fontSize: '18px' }}>✅</span>
              <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>
                Windows RAW Image Extension detected — RAW photo thumbnails active in Explorer.
              </span>
            </div>
          )}



          {/* Thumbnail support table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
              Explorer Thumbnail Support
            </div>
            {rows.map(row => (
              <div
                key={row.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ fontSize: '20px', flexShrink: 0, width: '28px', textAlign: 'center' }}>{row.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13px' }}>
                    {row.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {row.formats.join(' · ')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: '3px', lineHeight: 1.4 }}>
                    {row.note}
                    {row.link && row.status !== 'native' && (
                      <>
                        {' '}
                        <button
                          onClick={() => openLink(row.link!)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            color: '#0EA5E9', cursor: 'pointer',
                            fontSize: '12px', textDecoration: 'underline',
                          }}
                        >
                          Download →
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
          </div>

          {/* In-app note */}
          <div style={{
            fontSize: '12px', color: 'var(--text-muted)',
            padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.1)',
            lineHeight: 1.6,
          }}>
            💡 <strong>Tip:</strong> Thumbnails in Windows Explorer are generated by Windows' codec system — not by Uni Desk directly.
            When Uni Desk is your default viewer, it handles <em>opening</em> files instantly.
            For RAW and MKV files, installing the matching codec gives you thumbnails <em>everywhere</em> — not just in Uni Desk.
          </div>
        </div>
      )}
    </Card>
  )
}
