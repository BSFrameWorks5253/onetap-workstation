import React, { useEffect, useRef } from 'react'
import './LogBox.css'

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'muted'

export interface LogLine {
  id: number
  message: string
  level?: LogLevel
  ts: string
}

interface LogBoxProps {
  lines: LogLine[]
  onClear?: () => void
  maxHeight?: string
  statusState?: 'idle' | 'running' | 'error'
}

function levelClass(level?: LogLevel): string {
  if (!level) return ''
  return `log-line--${level}`
}

export default function LogBox({ lines, onClear, maxHeight = '280px', statusState = 'idle' }: LogBoxProps): JSX.Element {
  const bodyRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new lines arrive (fully container-isolated, no window jumping)
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [lines.length])

  return (
    <div className="logbox" style={{ maxHeight }}>
      <div className="logbox-header">
        <div className="logbox-dots" title={statusState === 'running' ? 'Task is running...' : statusState === 'error' ? 'Error occurred during processing' : 'Idle — ready to process'}>
          <span className={`logbox-dot dot-red ${statusState === 'error' ? 'dot--active' : ''}`} />
          <span className={`logbox-dot dot-yellow ${statusState === 'running' ? 'dot--active' : ''}`} />
          <span className={`logbox-dot dot-green ${statusState === 'idle' ? 'dot--active' : ''}`} />
        </div>
        <span className="logbox-title">Processing Log</span>
        <span className={`logbox-live ${statusState === 'running' ? 'logbox-live--running' : statusState === 'error' ? 'logbox-live--error' : 'logbox-live--idle'}`}>
          {statusState === 'running' ? 'RUNNING' : statusState === 'error' ? 'ERROR' : 'READY'}
        </span>
        {onClear && (
          <button className="logbox-clear" onClick={onClear} title="Clear log">🗑</button>
        )}
      </div>
      <div ref={bodyRef} className="logbox-body">
        {lines.length === 0 ? (
          <span className="logbox-empty">Log is empty — output will appear here during processing.</span>
        ) : (
          lines.map(line => (
            <div key={line.id} className={`log-line ${levelClass(line.level)}`}>
              <span className="log-ts">{line.ts}</span>
              <span className="log-msg">{line.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/** Hook to manage log lines state */
export function useLogLines(): {
  lines: LogLine[]
  addLine: (msg: string, level?: LogLevel) => void
  clear: () => void
} {
  const [lines, setLines] = React.useState<LogLine[]>([])
  const counterRef = useRef(0)

  function addLine(msg: string, level?: LogLevel): void {
    const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLines(prev => {
      const next = [...prev, { id: counterRef.current++, message: msg, level, ts }]
      if (next.length > 250) {
        return next.slice(next.length - 250)
      }
      return next
    })
  }

  function clear(): void { setLines([]) }

  return { lines, addLine, clear }
}
