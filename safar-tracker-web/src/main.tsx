import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'
import './glass.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        // Trigger background check for service worker updates
        reg.update().catch(() => {})
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

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
