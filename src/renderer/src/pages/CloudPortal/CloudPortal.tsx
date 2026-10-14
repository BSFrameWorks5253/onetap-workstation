import React, { useState, useEffect, useRef } from 'react'
import { PAGE_META } from '../../types'
import { SkeletonWebview } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import './CloudPortal.css'

const SHARAF_MEDIA_URL = 'https://sharaf-media.pages.dev'
const api = (window as any).api

export default function CloudPortal(): JSX.Element {
  const { playTick, playSuccess } = useSound()
  const { showToast } = useToast()

  const [addressBarMediaUrl, setAddressBarMediaUrl] = useState<string>(SHARAF_MEDIA_URL)
  const [mediaLoading, setMediaLoading] = useState<boolean>(true)
  const [mediaInitialLoaded, setMediaInitialLoaded] = useState<boolean>(false)
  const [mediaRefreshKey, setMediaRefreshKey] = useState<number>(0)
  const [hasError, setHasError] = useState<boolean>(false)
  const mediaWebviewRef = useRef<any>(null)

  // Reset load state on refresh
  useEffect(() => {
    setMediaInitialLoaded(false)
    setHasError(false)
  }, [mediaRefreshKey])

  // Synchronize loading overlay and link opening with Electron Webview guest events
  useEffect(() => {
    const webview = mediaWebviewRef.current
    if (!webview) return

    const handleLoadStop = () => {
      setMediaLoading(false)
      setMediaInitialLoaded(true)
      try {
        const currentUrl = webview.getURL()
        if (currentUrl && currentUrl !== 'about:blank') {
          setAddressBarMediaUrl(currentUrl)
        }
      } catch (err) {
        console.error('Failed to get webview URL:', err)
      }
    }

    const handleLoadStart = () => {
      setMediaLoading(true)
      setHasError(false)
    }

    const handleFailLoad = (e: any) => {
      // Ignore ERR_ABORTED (code -3) which happens during in-page redirects
      if (e?.errorCode && e.errorCode !== -3) {
        console.warn('[CloudPortal] Webview failed to load:', e)
        setMediaLoading(false)
        setHasError(true)
      }
    }

    // Intercept any popups or target="_blank" links clicked inside Sharaf Media
    const handleNewWindow = (e: any) => {
      if (e?.url) {
        if (api?.shell?.openExternal) {
          api.shell.openExternal(e.url)
        } else {
          window.open(e.url, '_blank')
        }
      }
    }

    webview.addEventListener('did-start-loading', handleLoadStart)
    webview.addEventListener('did-stop-loading', handleLoadStop)
    webview.addEventListener('dom-ready', handleLoadStop)
    webview.addEventListener('did-fail-load', handleFailLoad)
    webview.addEventListener('new-window', handleNewWindow)

    return () => {
      if (webview) {
        webview.removeEventListener('did-start-loading', handleLoadStart)
        webview.removeEventListener('did-stop-loading', handleLoadStop)
        webview.removeEventListener('dom-ready', handleLoadStop)
        webview.removeEventListener('did-fail-load', handleFailLoad)
        webview.removeEventListener('new-window', handleNewWindow)
      }
    }
  }, [mediaRefreshKey])

  const handleBack = () => {
    playTick()
    const webview = mediaWebviewRef.current
    if (webview && webview.canGoBack()) {
      webview.goBack()
    } else {
      showToast({ title: 'Navigation', message: 'No backward history available.', type: 'info' })
    }
  }

  const handleForward = () => {
    playTick()
    const webview = mediaWebviewRef.current
    if (webview && webview.canGoForward()) {
      webview.goForward()
    } else {
      showToast({ title: 'Navigation', message: 'No forward history available.', type: 'info' })
    }
  }

  const handleRefresh = () => {
    playTick()
    setMediaLoading(true)
    const webview = mediaWebviewRef.current
    if (webview) {
      try {
        webview.reload()
      } catch {
        setMediaRefreshKey(prev => prev + 1)
      }
    } else {
      setMediaRefreshKey(prev => prev + 1)
    }
  }

  const handleOpenExternal = () => {
    playTick()
    let targetUrl = SHARAF_MEDIA_URL
    try {
      const liveUrl = mediaWebviewRef.current?.getURL()
      if (liveUrl && liveUrl !== 'about:blank') {
        targetUrl = liveUrl
      } else if (addressBarMediaUrl) {
        targetUrl = addressBarMediaUrl
      }
    } catch {}

    if (api?.shell?.openExternal) {
      api.shell.openExternal(targetUrl)
    } else {
      window.open(targetUrl, '_blank')
    }

    showToast({
      title: 'External Browser',
      message: 'Opening Sharaf Media portal in your default browser...',
      type: 'success'
    })
  }

  const handleMediaHome = () => {
    playTick()
    const webview = mediaWebviewRef.current
    setMediaLoading(true)
    setAddressBarMediaUrl(SHARAF_MEDIA_URL)
    if (webview) {
      try {
        webview.loadURL(SHARAF_MEDIA_URL)
      } catch {
        setMediaRefreshKey(prev => prev + 1)
      }
    } else {
      setMediaRefreshKey(prev => prev + 1)
    }
  }

  return (
    <div className="cp-page cp-page--fullscreen">
      <div className="cp-viewport-container anim-scale-in">
        {/* Navigation / Address Bar */}
        <div className="cp-address-bar">
          <div className="cp-nav-buttons">
            <button className="cp-nav-btn" onClick={handleBack} title="Back">◀</button>
            <button className="cp-nav-btn" onClick={handleForward} title="Forward">▶</button>
            <button className="cp-nav-btn cp-refresh-btn" onClick={handleRefresh} title="Refresh Live Portal">🔄</button>
            <button className="cp-nav-btn cp-home-btn" onClick={handleMediaHome} title="Go to Sharaf Media Home">🏠</button>
          </div>

          <div className="cp-address-input-wrap">
            <span className="cp-secure-badge">
              🔒 <span className="cp-secure-text">HTTPS Secure</span>
            </span>
            <input
              type="text"
              className="cp-address-input"
              value={addressBarMediaUrl}
              readOnly
              title="Sharaf Media Live Endpoint"
            />
            <span className="cp-host-badge cp-host-drive">Sharaf Media</span>
          </div>

          <div className="cp-action-buttons">
            <button className="cp-action-btn cp-chrome-btn" onClick={handleOpenExternal} title="Launch in external browser">
              🌐 Open Browser
            </button>
          </div>
        </div>

        {/* Quick Link Bookmark Bar */}
        <div className="cp-bookmarks-bar">
          <span className="cp-bookmarks-title">📌 Quick Access:</span>
          <button className="cp-bookmark-btn" onClick={handleMediaHome}>🏠 Dashboard Home</button>
          <button className="cp-bookmark-btn" onClick={handleRefresh}>🔄 Reload Portal</button>
          <button className="cp-bookmark-btn" onClick={handleOpenExternal}>🌐 Launch Chrome / Edge</button>
        </div>

        {/* Live Portal Webview */}
        <div className="cp-iframe-wrapper cp-iframe-wrapper--drive">
          {(!mediaInitialLoaded && mediaLoading && !hasError) && (
            <div className="cp-iframe-loader-overlay">
              <SkeletonWebview
                title="Connecting to Sharaf Media Portal…"
                subtitle="Establishing high-speed encrypted connection with shafar-media.pages.dev"
              />
            </div>
          )}

          {hasError && (
            <div className="cp-iframe-loader-overlay" style={{ background: 'var(--surface-1)' }}>
              <div style={{ textAlign: 'center', padding: '32px', maxWidth: '440px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌐</div>
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Unable to Load Portal</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Could not establish direct connection to Sharaf Media. You can retry or open directly in your system browser.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button className="cp-bookmark-btn" style={{ padding: '8px 18px', background: 'var(--surface-2)' }} onClick={handleRefresh}>
                    🔄 Retry Loading
                  </button>
                  <button className="cp-bookmark-btn" style={{ padding: '8px 18px', background: '#06B6D4', color: '#fff' }} onClick={handleOpenExternal}>
                    🌐 Open in Browser
                  </button>
                </div>
              </div>
            </div>
          )}

          {React.createElement('webview', {
            key: mediaRefreshKey,
            ref: mediaWebviewRef,
            src: SHARAF_MEDIA_URL,
            partition: 'persist:sharaf_media',
            className: 'cp-iframe cp-iframe--drive',
            useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            allowpopups: 'true'
          })}
        </div>
      </div>
    </div>
  )
}
