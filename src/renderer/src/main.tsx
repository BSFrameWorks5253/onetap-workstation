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

import WorkstationErrorBoundary from './components/ErrorBoundary/WorkstationErrorBoundary'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WorkstationErrorBoundary moduleName="Uni Desk Core Shell">
      <App />
    </WorkstationErrorBoundary>
  </React.StrictMode>
)
