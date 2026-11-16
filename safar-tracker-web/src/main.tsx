import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'
import './glass.css'

// In development or local debugging, completely unregister service workers and purge caches
// so that live edits, HMR, and CSS changes reflect instantly without stale browser caching
if ('serviceWorker' in navigator) {
  const isDev = Boolean((import.meta as any).env?.DEV) ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.endsWith('.local')

  if (isDev) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      for (const reg of regs) {
        reg.unregister().catch(() => {})
      }
    }).catch(() => {})
    if ('caches' in window) {
      caches.keys().then(keys => {
        for (const k of keys) caches.delete(k).catch(() => {})
      }).catch(() => {})
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(reg => {
          // Immediate check on boot
          reg.update().catch(() => {})

          // Check for updates every 60 seconds
          setInterval(() => {
            reg.update().catch(() => {})
          }, 60000)

          // Check for updates whenever window regains focus or comes back online
          window.addEventListener('focus', () => reg.update().catch(() => {}))
          window.addEventListener('online', () => reg.update().catch(() => {}))

          // If a new worker is waiting, activate it immediately
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                }
              })
            }
          })
        })
        .catch(() => {})
    })

    // Automatically reload when a fresh service worker takes control so updates appear instantly
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  }
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
