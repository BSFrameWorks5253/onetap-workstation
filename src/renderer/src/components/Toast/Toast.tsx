import React, { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react'
import { useSound } from '../SoundProvider'
import './Toast.css'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: string
  title?: string
  message: string
  type?: 'success' | 'error' | 'info' | 'warning' | 'danger'
  badge?: string
  icon?: React.ReactNode
  action?: ToastAction
  progress?: number // 0 to 100 for manual progress
  duration?: number // duration in ms, default 5000
  isExiting?: boolean
  createdAt: number
}

export type ShowToastParams = Omit<ToastItem, 'id' | 'createdAt' | 'isExiting'>

interface ToastContextType {
  showToast: (t: ShowToastParams) => void
  removeToast: (id: string) => void
  clearAllToasts: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const { playSuccess, playError } = useSound()
  const autoRemoveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const removeToast = useCallback((id: string) => {
    // Clear any existing timer for this toast
    if (autoRemoveTimers.current.has(id)) {
      clearTimeout(autoRemoveTimers.current.get(id))
      autoRemoveTimers.current.delete(id)
    }

    // Trigger exit animation first
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, isExiting: true } : t))
    )

    // Remove from array after exit transition duration (280ms)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 280)
  }, [])

  const clearAllToasts = useCallback(() => {
    autoRemoveTimers.current.forEach(timer => clearTimeout(timer))
    autoRemoveTimers.current.clear()
    setToasts(prev => prev.map(t => ({ ...t, isExiting: true })))
    setTimeout(() => setToasts([]), 280)
  }, [])

  const showToast = useCallback(
    (t: ShowToastParams) => {
      const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
      const duration = t.duration ?? 5000
      const newToast: ToastItem = {
        ...t,
        id,
        duration,
        createdAt: Date.now()
      }

      setToasts(prev => {
        // Keep max 5 toasts visible to prevent overflow clutter
        const list = prev.length >= 5 ? prev.slice(1) : prev
        return [...list, newToast]
      })

      // Play auditory feedback
      if (t.type === 'success') {
        setTimeout(() => playSuccess(), 80)
      } else if (t.type === 'error' || t.type === 'danger') {
        playError()
      }

      // Set auto-dismiss timer if no manual progress is specified
      if (t.progress === undefined && duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id)
        }, duration)
        autoRemoveTimers.current.set(id, timer)
      }
    },
    [playSuccess, playError, removeToast]
  )

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      autoRemoveTimers.current.forEach(timer => clearTimeout(timer))
      autoRemoveTimers.current.clear()
    }
  }, [])

  const renderIcon = (type?: string, customIcon?: React.ReactNode) => {
    if (customIcon) return <span className="toast-custom-icon">{customIcon}</span>
    switch (type) {
      case 'success':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        )
      case 'error':
      case 'danger':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        )
      case 'warning':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        )
      case 'info':
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        )
    }
  }

  const getTypeLabel = (type?: string, customBadge?: string) => {
    if (customBadge) return customBadge
    switch (type) {
      case 'success': return 'SUCCESS'
      case 'error':
      case 'danger': return 'ERROR'
      case 'warning': return 'WARNING'
      case 'info':
      default: return 'INFO'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, removeToast, clearAllToasts }}>
      {children}
      <div className="toast-container" role="region" aria-label="Notifications">
        {toasts.map(toast => {
          const typeClass = toast.type || 'info'
          const duration = toast.duration || 5000
          const hasAutoDismiss = toast.progress === undefined && duration > 0

          return (
            <div
              key={toast.id}
              className={`toast-card toast--${typeClass} ${toast.isExiting ? 'toast--exiting' : ''}`}
              style={{ '--toast-duration': `${duration}ms` } as React.CSSProperties}
            >
              {/* Background ambient lighting and specular sheen */}
              <div className="toast-glow" />
              <div className="toast-sheen" />

              <div className="toast-content">
                <div className="toast-header">
                  <div className="toast-icon-wrap">
                    <span className="toast-icon">{renderIcon(toast.type, toast.icon)}</span>
                    <span className="toast-icon-pulse" />
                  </div>
                  
                  <div className="toast-title-group">
                    <div className="toast-meta">
                      <span className="toast-badge">{getTypeLabel(toast.type, toast.badge)}</span>
                    </div>
                    <span className="toast-title">{toast.title}</span>
                  </div>

                  <button
                    className="toast-close"
                    onClick={() => removeToast(toast.id)}
                    title="Dismiss"
                    aria-label="Close notification"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>

                {toast.message && <p className="toast-message">{toast.message}</p>}

                {/* Manual progress bar if progress prop passed */}
                {toast.progress !== undefined && (
                  <div className="toast-progress-wrap">
                    <div
                      className="toast-progress-bar toast-progress-bar--manual"
                      style={{ width: `${Math.min(100, Math.max(0, toast.progress))}%` }}
                    />
                  </div>
                )}

                {/* Auto-dismiss countdown bar if auto-dismiss active */}
                {hasAutoDismiss && (
                  <div className="toast-progress-wrap toast-progress-wrap--auto">
                    <div className="toast-progress-bar toast-progress-bar--auto" />
                  </div>
                )}

                {/* Interactive action button if passed */}
                {toast.action && (
                  <button
                    className="toast-action-btn"
                    onClick={() => {
                      toast.action?.onClick()
                      removeToast(toast.id)
                    }}
                  >
                    <span>{toast.action.label}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
