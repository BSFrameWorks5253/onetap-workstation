import React, { forwardRef } from 'react'
import './Input.css'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  accent?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, accent, error, className = '', style, ...rest }, ref) => (
    <div className="input-wrap" style={style}>
      {label && (
        <label className="input-label" style={{ color: accent ?? 'var(--text-secondary)' }}>
          {accent && <span className="input-label-dot" style={{ background: accent }} />}
          {label.toUpperCase()}
        </label>
      )}
      <input
        ref={ref}
        className={`input-field ${error ? 'input-field--error' : ''} ${className}`}
        {...rest}
      />
      {error && <span className="input-error">{error}</span>}
    </div>
  )
)
Input.displayName = 'Input'

interface BrowseRowProps {
  label?: string
  value: string
  placeholder?: string
  accent?: string
  onBrowse: () => void
  onChange?: (v: string) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  readOnly?: boolean
}

export function BrowseRow({ label, value, placeholder, accent, onBrowse, onChange, onBlur, onKeyDown, readOnly }: BrowseRowProps): JSX.Element {
  const [isDragActive, setIsDragActive] = React.useState(false)
  const dragCounter = React.useRef(0)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current += 1
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    setIsDragActive(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    if (!isDragActive) setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragActive(false)
    const files = e.dataTransfer?.files
    let droppedPath = ''
    if (files && files.length > 0) {
      const file = files[0]
      const api = (window as any).api
      if (api?.webUtils?.getPathForFile) {
        try {
          droppedPath = api.webUtils.getPathForFile(file)
        } catch {}
      }
      if (!droppedPath) {
        droppedPath = (file as any)?.path || ''
      }
    }
    if (!droppedPath) {
      droppedPath = e.dataTransfer?.getData('text/plain') || ''
    }
    if (droppedPath) {
      let clean = droppedPath.trim().replace(/^["']|["']$/g, '')
      if (clean.startsWith('file:///')) {
        clean = decodeURIComponent(clean.replace(/^file:\/\/\//, '')).replace(/^\/([a-zA-Z]:)/, '$1')
      }
      if (onChange) {
        onChange(clean)
      }
    }
  }

  return (
    <div 
      className={`input-wrap browse-row-wrap ${isDragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {label && (
        <label className="input-label" style={{ color: accent ?? 'var(--text-secondary)' }}>
          {accent && <span className="input-label-dot" style={{ background: accent }} />}
          {label.toUpperCase()}
        </label>
      )}
      <div 
        className="browse-row"
        style={isDragActive ? { 
          borderColor: accent ?? 'var(--accent-adder)', 
          boxShadow: `0 0 12px ${accent ? accent + '44' : 'rgba(139,92,246,0.3)'}` 
        } : {}}
      >
        <input
          className="input-field"
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          style={{ flex: 1 }}
        />
        <button
          className="browse-btn"
          onClick={onBrowse}
          type="button"
          style={accent ? { color: accent, borderColor: `${accent}44` } : {}}
        >
          Browse
        </button>
      </div>
    </div>
  )
}
