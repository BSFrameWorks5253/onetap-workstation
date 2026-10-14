import React, { useEffect, useRef } from 'react'
import './Modal.css'
import { Button, DangerButton } from '../Button'

interface ModalProps {
  show?: boolean
  isOpen?: boolean
  title: string
  message?: string
  icon?: string
  accent?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm?: () => void
  onClose: () => void
  children?: React.ReactNode
}

export default function Modal({
  show, isOpen, title, message, icon = '⚠️', accent,
  confirmText = 'Confirm', cancelText = 'Cancel',
  danger, onConfirm = () => {}, onClose, children
}: ModalProps): JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null)
  const isVisible = show ?? isOpen ?? false

  useEffect(() => {
    if (!isVisible) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      // Note: Enter might conflict with inputs, so we omit auto-confirm if children are present
      if (e.key === 'Enter' && !children && onConfirm) onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isVisible, onConfirm, onClose, children])

  if (!isVisible) return null

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div className="modal-card" role="dialog" aria-modal="true">
        {accent && <div className="modal-stripe" style={{ background: accent }} />}
        <div className="modal-body">
          <div className="modal-header-row">
            <div className="modal-icon">{icon}</div>
            <h3 className="modal-title">{title}</h3>
          </div>
          
          {message && <p className="modal-message">{message}</p>}
          
          {children && <div className="modal-custom-content">{children}</div>}
          
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
            {danger
              ? <DangerButton onClick={onConfirm}>{confirmText}</DangerButton>
              : <Button
                  variant="primary"
                  accent={accent}
                  onClick={onConfirm}
                >{confirmText}</Button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
