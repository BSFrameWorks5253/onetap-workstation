import React, { useState, useEffect, useRef } from 'react'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import { SkeletonWebview } from '../../components/Skeleton'
import './GDrivePortal.css'

const SHARAF_MEDIA_URL = 'https://sharaf-media.pages.dev'
const api = (window as any).api

export default function GDrivePortal(): JSX.Element {
  const { playTick } = useSound()
  const { showToast } = useToast()
  
  const [iframeLoading, setIframeLoading] = useState<boolean>(true)
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const [addressBarUrl, setAddressBarUrl] = useState<string>(SHARAF_MEDIA_URL)
  
  const webviewRef = useRef<any>(null)
  
  // Synchronize loading overlay and page title/URL changes
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleLoadStop = () => {
      setIframeLoading(false)
      try {
        const url = webview.getURL()
        if (url) setAddressBarUrl(url)
      } catch (err) {
        console.error('Failed to get webview URL:', err)
      }
    }

    const handleLoadStart = () => {
      setIframeLoading(true)
    }

    webview.addEventListener('did-start-loading', handleLoadStart)
    webview.addEventListener('did-stop-loading', handleLoadStop)
    webview.addEventListener('dom-ready', handleLoadStop)
    webview.addEventListener('did-fail-load', handleLoadStop)

    return () => {
      if (webview) {
        webview.removeEventListener('did-start-loading', handleLoadStart)
        webview.removeEventListener('did-stop-loading', handleLoadStop)
        webview.removeEventListener('dom-ready', handleLoadStop)
        webview.removeEventListener('did-fail-load', handleLoadStop)
      }
    }
  }, [refreshKey])

  const handleBack = () => {
    const webview = webviewRef.current
    if (webview && webview.canGoBack()) {
      webview.goBack()
      playTick()
    } else {
      showToast({
        title: 'Navigation',
        message: 'No backward history available.',
        type: 'info'
      })
    }
  }

  const handleForward = () => {
    const webview = webviewRef.current
    if (webview && webview.canGoForward()) {
      webview.goForward()
      playTick()
    } else {
      showToast({
        title: 'Navigation',
        message: 'No forward history available.',
        type: 'info'
      })
    }
  }

  const handleRefresh = () => {
    playTick()
    setIframeLoading(true)
    const webview = webviewRef.current
    if (webview) {
      webview.reload()
    } else {
      setRefreshKey(prev => prev + 1)
    }
  }

  const handleGoHome = () => {
    playTick()
    setIframeLoading(true)
    const webview = webviewRef.current
    if (webview) {
      webview.loadURL(SHARAF_MEDIA_URL)
    } else {
      setAddressBarUrl(SHARAF_MEDIA_URL)
      setRefreshKey(prev => prev + 1)
    }
  }

  const handleOpenExternal = () => {
    playTick()
    if (api && api.shell) {
      api.shell.openExternal(addressBarUrl)
    } else {
      window.open(addressBarUrl, '_blank')
    }
    showToast({
      title: 'External Launch',
      message: 'Opening Sharaf Media in default web browser...',
      type: 'success'
    })
  }

  return (
    <div className="gdp-page">
      <div className="gdp-viewport-container anim-scale-in">
        {/* Glassmorphic Address Toolbar */}
        <div className="gdp-address-bar">
          <div className="gdp-nav-buttons">
            <button className="gdp-nav-btn" onClick={handleBack} title="Back">
              ◀
            </button>
            <button className="gdp-nav-btn" onClick={handleForward} title="Forward">
              ▶
            </button>
            <button className="gdp-nav-btn gdp-refresh-btn" onClick={handleRefresh} title="Refresh Live Portal">
              🔄
            </button>
            <button className="gdp-nav-btn gdp-home-btn" onClick={handleGoHome} title="Go to Sharaf Media Home">
              🏠
            </button>
          </div>

          <div className="gdp-address-input-wrap">
            <span className="gdp-secure-badge">
              🔒 <span className="gdp-secure-text">HTTPS Secure</span>
            </span>
            <input
              type="text"
              className="gdp-address-input"
              value={addressBarUrl}
              readOnly
              title="Sharaf Media Live Endpoint"
            />
            <span className="gdp-host-badge">Sharaf Media</span>
          </div>

          <div className="gdp-action-buttons">
            <button className="gdp-action-btn gdp-chrome-btn" onClick={handleOpenExternal} title="Launch in external browser">
              🌐 Open Browser
            </button>
          </div>
        </div>

        {/* Quick Link Bookmark Bar */}
        <div className="gdp-bookmarks-bar">
          <span className="gdp-bookmarks-title">📌 Quick Access:</span>
          <button className="gdp-bookmark-btn" onClick={handleGoHome}>🏠 Dashboard Home</button>
          <button className="gdp-bookmark-btn" onClick={handleRefresh}>🔄 Reload App</button>
        </div>

        {/* Secure Sharaf Media Viewport with Persistent Partition */}
        <div className="gdp-iframe-wrapper">
          {iframeLoading && (
            <div className="gdp-iframe-loader-overlay">
              <SkeletonWebview
                title="Loading Sharaf Media Portal…"
                subtitle="Establishing secure, high-speed tunnel with sharaf-media.pages.dev"
              />
            </div>
          )}
          {React.createElement('webview', {
            key: refreshKey,
            ref: webviewRef,
            src: SHARAF_MEDIA_URL,
            partition: 'persist:sharaf_media',
            className: 'gdp-iframe',
            useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            allowpopups: 'true'
          })}
        </div>
      </div>
    </div>
  )
}
