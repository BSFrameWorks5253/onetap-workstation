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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button className="gdp-nav-btn" onClick={handleForward} title="Forward">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button className="gdp-nav-btn gdp-refresh-btn" onClick={handleRefresh} title="Refresh Live Portal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            <button className="gdp-nav-btn gdp-home-btn" onClick={handleGoHome} title="Go to Sharaf Media Home">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </button>
          </div>

          <div className="gdp-address-input-wrap">
            <span className="gdp-secure-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span className="gdp-secure-text">HTTPS Secure</span>
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>Open Browser</span>
            </button>
          </div>
        </div>

        {/* Quick Link Bookmark Bar */}
        <div className="gdp-bookmarks-bar">
          <span className="gdp-bookmarks-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A4 4 0 0 1 14 9V5a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v4a4 4 0 0 1-2.11 3.56l-1.78.89A2 2 0 0 0 5 15.24Z"/></svg>
            <span>Quick Access:</span>
          </span>
          <button className="gdp-bookmark-btn" onClick={handleGoHome}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span>Dashboard Home</span>
          </button>
          <button className="gdp-bookmark-btn" onClick={handleRefresh}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <span>Reload App</span>
          </button>
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
