import React, { Component, ErrorInfo, ReactNode } from 'react'
import './WorkstationErrorBoundary.css'

interface Props {
  children: ReactNode
  pageKey?: string
  moduleName?: string
  onResetPage?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  copied: boolean
  showDetails: boolean
}

export class WorkstationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error(`[Workstation Crash Isolated: ${this.props.pageKey || 'Root'}]`, error, errorInfo)
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.pageKey !== this.props.pageKey && this.state.hasError) {
      this.handleRetry()
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false
    })
    try {
      sessionStorage.removeItem('ot_boot_splash_shown')
      if (typeof (window as any).navigateToPage === 'function') {
        (window as any).navigateToPage('adder')
      }
    } catch {}
    if (this.props.onResetPage) {
      this.props.onResetPage()
    }
  }

  handleCopyReport = (): void => {
    const { pageKey, moduleName } = this.props
    const { error, errorInfo } = this.state
    const report = [
      '### One Tap Workstation Diagnostic Report',
      `• Module: ${moduleName || pageKey || 'General'}`,
      `• Timestamp: ${new Date().toISOString()}`,
      `• Error Name: ${error?.name || 'Error'}`,
      `• Error Message: ${error?.message || String(error)}`,
      '',
      '```stack',
      error?.stack || 'No stack trace captured',
      errorInfo?.componentStack ? `\nComponent Hierarchy:${errorInfo.componentStack}` : '',
      '```'
    ].join('\n')

    navigator.clipboard.writeText(report).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2500)
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = report
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2500)
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { pageKey, moduleName } = this.props
      const { error, copied, showDetails } = this.state
      const displayName = moduleName || (pageKey ? pageKey.replace(/-/g, ' ').toUpperCase() : 'Workstation')

      return (
        <div className="ws-error-container">
          <div className="ws-error-card">
            {/* Top Specular Glow Header */}
            <div className="ws-error-header">
              <div className="ws-error-badge">
                <span className="ws-error-badge-pulse" />
                <span>DIAGNOSTIC ISOLATION SHIELD</span>
              </div>
              <span className="ws-error-chip">Module: {displayName}</span>
            </div>

            {/* Icon & Title */}
            <div className="ws-error-hero">
              <div className="ws-error-icon-box">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="ws-error-title-wrap">
                <h2 className="ws-error-title">Module Interruption Encountered</h2>
                <p className="ws-error-subtitle">
                  One Tap safely isolated an unexpected event in <strong>{displayName}</strong>. Your session, active media files, and rendering tasks remain intact.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="ws-error-msg-box">
              <div className="ws-error-msg-label">EXCEPTION REASON</div>
              <div className="ws-error-msg-text">
                {error?.message || String(error) || 'An unhandled component rendering issue occurred.'}
              </div>
            </div>

            {/* Collapsible Diagnostics */}
            {showDetails && (
              <div className="ws-error-stack-wrap">
                <div className="ws-error-stack-header">
                  <span>Stack Trace & Diagnostics</span>
                  <button
                    className="ws-error-copy-btn"
                    onClick={this.handleCopyReport}
                    title="Copy diagnostic report to clipboard"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    {copied ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Copied to Clipboard</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        <span>Copy Report</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="ws-error-stack-code">
                  {error?.stack || 'No extended stack trace available.'}
                </pre>
              </div>
            )}

            {/* Action Bar */}
            <div className="ws-error-actions">
              <button
                className="ws-btn ws-btn-primary"
                onClick={this.handleRetry}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                <span>Recover & Reload Module</span>
              </button>

              <button
                className="ws-btn ws-btn-secondary"
                onClick={() => window.location.reload()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                <span>Reload Workstation</span>
              </button>

              <button
                className="ws-btn ws-btn-ghost"
                onClick={() => this.setState({ showDetails: !showDetails })}
              >
                {showDetails ? 'Hide Diagnostics' : 'Inspect Stack Trace'}
              </button>

              {!showDetails && (
                <button
                  className="ws-btn ws-btn-ghost"
                  onClick={this.handleCopyReport}
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  {copied ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      <span>Copy Report</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default WorkstationErrorBoundary
