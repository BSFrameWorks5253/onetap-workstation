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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const path = (files[0] as any).path
      if (path && onChange) {
        onChange(path)
      }
    }
  }

  return (
    <div 
      className={`input-wrap browse-row-wrap ${isDragActive ? 'drag-active' : ''}`}
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
