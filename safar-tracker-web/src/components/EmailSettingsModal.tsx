import React, { useState, useEffect } from 'react'
import {
  Mail,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  KeyRound,
  Users,
  Timer,
  ExternalLink,
  ShieldCheck
} from 'lucide-react'
import { emailNotifier, type EmailNotificationSettings } from '../services/emailNotifier'

interface EmailSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onToast?: (msg: string) => void
}

export default function EmailSettingsModal({ isOpen, onClose, onToast }: EmailSettingsModalProps) {
  const [settings, setSettings] = useState<EmailNotificationSettings>(emailNotifier.getSettings())
  const [recipientInput, setRecipientInput] = useState<string>('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const current = emailNotifier.getSettings()
      setSettings(current)
      setRecipientInput(current.recipients.join(', '))
      setTestResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    // Parse recipients
    const cleanRecipients = recipientInput
      .split(/[,;\n]+/)
      .map(r => r.trim())
      .filter(r => r.length > 0 && r.includes('@'))

    const updated: EmailNotificationSettings = {
      ...settings,
      recipients: cleanRecipients
    }

    emailNotifier.saveSettings(updated)
    setSettings(updated)
    if (onToast) onToast('✓ Email notification preferences saved!')
    onClose()
  }

  const handleTestEmail = async () => {
    setTesting(true)
    setTestResult(null)

    const cleanRecipients = recipientInput
      .split(/[,;\n]+/)
      .map(r => r.trim())
      .filter(r => r.length > 0 && r.includes('@'))

    if (cleanRecipients.length === 0) {
      setTestResult({
        type: 'error',
        msg: 'Please enter at least one recipient email address.'
      })
      setTesting(false)
      return
    }

    try {
      const result = await emailNotifier.sendTestEmail({
        ...settings,
        recipients: cleanRecipients
      })
      setTestResult({
        type: 'success',
        msg: result.message || 'Test email dispatched successfully! Please check your inbox (and Spam folder).'
      })
      if (onToast) onToast('✓ Test email dispatched!')
    } catch (err: any) {
      setTestResult({
        type: 'error',
        msg: err?.message || 'Failed to send test email. Please check your credentials.'
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              <Mail size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>
                Stage Notification Settings
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Free Vercel Tier · 5-minute debounce compiled updates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Master Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            backgroundColor: settings.enabled ? 'rgba(79, 70, 229, 0.05)' : '#f8fafc',
            border: `1px solid ${settings.enabled ? '#c7d2fe' : '#e2e8f0'}`,
            borderRadius: '14px'
          }}
        >
          <div>
            <strong style={{ display: 'block', fontSize: '14px', color: '#1e293b' }}>
              Automatic Stage Update Emails
            </strong>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Sends compiled email notification when dates advance stages
            </span>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={e => setSettings({ ...settings, enabled: e.target.checked })}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: settings.enabled ? '#4f46e5' : '#cbd5e1',
                borderRadius: '34px',
                transition: '0.3s'
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '20px',
                  width: '20px',
                  left: settings.enabled ? '25px' : '3px',
                  bottom: '3px',
                  backgroundColor: '#ffffff',
                  borderRadius: '50%',
                  transition: '0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              />
            </span>
          </label>
        </div>

        {/* Recipients */}
        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#334155',
              marginBottom: '6px'
            }}
          >
            <Users size={16} /> Recipient Email Addresses
          </label>
          <input
            type="text"
            value={recipientInput}
            onChange={e => setRecipientInput(e.target.value)}
            placeholder="e.g. director@example.com, editor@example.com"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
            Separate multiple email recipients with commas.
          </span>
        </div>

        {/* 5-minute Debounce window */}
        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#334155',
              marginBottom: '6px'
            }}
          >
            <Timer size={16} /> Debounce Window (Compile Batch Duration)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 5, 10].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => setSettings({ ...settings, debounceMinutes: mins })}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: settings.debounceMinutes === mins ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                  backgroundColor: settings.debounceMinutes === mins ? '#eef2ff' : '#ffffff',
                  color: settings.debounceMinutes === mins ? '#4338ca' : '#475569',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {mins} {mins === 1 ? 'min' : 'mins'} {mins === 5 ? '(Standard)' : ''}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
            Dates moved within this window are compiled into a single consolidated email.
          </span>
        </div>

        {/* Free Sender Configuration (Gmail SMTP) */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="#059669" />
              <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                Free Sender Configuration (Zero Domain Required)
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: '#4f46e5',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              <HelpCircle size={14} /> {showHelp ? 'Hide instructions' : 'How to get App Password?'}
            </button>
          </div>

          {showHelp && (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
                fontSize: '12px',
                color: '#334155',
                lineHeight: 1.5
              }}
            >
              <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#1e293b' }}>
                Quick 3-step setup (100% Free, 500 emails/day, no custom domain):
              </p>
              <ol style={{ margin: '0 0 8px 18px', padding: 0 }}>
                <li>Make sure 2-Step Verification is enabled on your Google account.</li>
                <li>
                  Open{' '}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    Google App Passwords <ExternalLink size={11} style={{ display: 'inline' }} />
                  </a>
                </li>
                <li>Give it an app name like "One Tap" and copy the 16-character code below.</li>
              </ol>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Note: Standard Google account password will not work; Google requires an App Password for SMTP.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                Your Gmail Address (Sender)
              </label>
              <input
                type="email"
                value={settings.gmailUser}
                onChange={e => setSettings({ ...settings, gmailUser: e.target.value })}
                placeholder="yourname@gmail.com"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '4px'
                }}
              >
                <KeyRound size={13} /> 16-Character Google App Password
              </label>
              <input
                type="password"
                value={settings.gmailAppPass}
                onChange={e => setSettings({ ...settings, gmailAppPass: e.target.value })}
                placeholder="xxxx xxxx xxxx xxxx"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>
        </div>

        {/* Live Feedback Banner */}
        {testResult && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: testResult.type === 'success' ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${testResult.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '12px',
              color: testResult.type === 'success' ? '#065f46' : '#991b1b'
            }}
          >
            {testResult.type === 'success' ? (
              <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            )}
            <div style={{ wordBreak: 'break-word' }}>{testResult.msg}</div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={testing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: testing ? 'not-allowed' : 'pointer'
            }}
          >
            <Send size={14} />
            {testing ? 'Sending Test...' : 'Send Test Email'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 20px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
