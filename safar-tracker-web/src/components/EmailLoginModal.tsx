import React, { useState } from 'react';
import { Mail, KeyRound, LogIn, X, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendLoginEmail, verifyLoginCode, setStoredAuthUser, AuthUser } from '../lib/googleAppsScript';

export default function EmailLoginModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await sendLoginEmail(email);
      if (res?.success) {
        setStep('verify');
        setSuccess('Verification code sent to your email via Google Apps Script!');
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(res?.error || 'Failed to dispatch verification email. Please check your GS connection.');
      }
    } catch (err: any) {
      setError('Error: ' + (err?.message || 'Failed to send code'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await verifyLoginCode(email, code);
      if (res?.success && res.user) {
        setStoredAuthUser(res.user);
        setSuccess(`Logged in as ${res.user.name} (${res.user.role})!`);
        setTimeout(() => {
          onSuccess(res.user);
          onClose();
        }, 1000);
      } else {
        setError(res?.error || 'Invalid or expired code. Please try again.');
      }
    } catch (err: any) {
      setError('Verification error: ' + (err?.message || 'Failed to verify'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '24px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#4F46E5', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Passwordless Email Sign In</h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Google Apps Script Authentication</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', color: '#94A3B8' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{ padding: '10px 14px', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          {step === 'input' ? (
            <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px' }} />
                  <input
                    type="email"
                    required
                    placeholder="e.g. sounasathburhan5252@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      borderRadius: '12px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      color: '#0F172A',
                      outline: 'none',
                      background: '#F8FAFC'
                    }}
                  />
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748B' }}>
                  Google Apps Script will dispatch a one-time 6-digit magic code from your Gmail to sign in.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '12px',
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? <span>Sending Code...</span> : <><Send size={15} /><span>Send Magic Verification Code</span></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#F1F5F9', fontSize: '12px', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                <span>Code sent to: <strong>{email}</strong></span>
                <button type="button" onClick={() => setStep('input')} style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                  Change
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Enter 6-Digit Code
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <KeyRound size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px' }} />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="e.g. 742918"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      borderRadius: '12px',
                      border: '1px solid #CBD5E1',
                      fontSize: '18px',
                      letterSpacing: '6px',
                      fontWeight: 800,
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      color: '#0F172A',
                      outline: 'none',
                      background: '#F8FAFC'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || code.length < 6}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '12px',
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: (loading || code.length < 6) ? 0.6 : 1
                }}
              >
                {loading ? <span>Verifying...</span> : <><LogIn size={15} /><span>Verify & Enter Portal</span></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
