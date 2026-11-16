import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/styles/global.css'
import '@/styles/animations.css'

// Global Uncaught Exception Listeners
window.addEventListener('error', (event) => {
  console.error('[Uni Desk Renderer Error]', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Uni Desk Unhandled Rejection]', event.reason)
})

// Auto-mount Live Edit visual inspection overlay in development
if (import.meta.env.DEV) {
  const initLiveEdit = async () => {
    if ((window as any).__liveEditLoaded) return
    const livePort = 4321
    try {
      const res = await fetch(`http://127.0.0.1:${livePort}/__live/health`, { signal: AbortSignal.timeout(1000) })
      if (!res.ok) return
      const data = await res.json()
      if (data?.ok && data?.root && String(data.root).toLowerCase().includes('one tap')) {
        ;(window as any).__LIVE_TOKEN = data.token
        ;(window as any).__LIVE_ORIGIN = `http://127.0.0.1:${livePort}`
        const script = document.createElement('script')
        script.src = `http://127.0.0.1:${livePort}/__live/client.js`
        document.body.appendChild(script)
        console.log('[Live-Edit] Connected to live-edit overlay on port', livePort)
      }
    } catch {
      // live-edit server not running; skip silently
    }
  }
  initLiveEdit()
}

import WorkstationErrorBoundary from './components/ErrorBoundary/WorkstationErrorBoundary'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WorkstationErrorBoundary moduleName="Uni Desk Core Shell">
      <App />
    </WorkstationErrorBoundary>
  </React.StrictMode>
)
