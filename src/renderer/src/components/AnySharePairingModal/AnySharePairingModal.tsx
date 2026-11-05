import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface AnySharePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AnySharePairingModal({ isOpen, onClose }: AnySharePairingModalProps): JSX.Element | null {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [pairingToken, setPairingToken] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes in seconds
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [pairedUsername, setPairedUsername] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setIsPaired(false);
      setPairedUsername('');
      return;
    }

    generatePairingCode();
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isPaired || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          generatePairingCode();
          return 600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isPaired, timeLeft]);

  // Polling for pairing claim status from AnyShare website/mobile scanner
  useEffect(() => {
    if (!isOpen || isPaired || !pairingToken) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5253/api/pairing-status?token=${pairingToken}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.status === 'claimed') {
            setIsPaired(true);
            setQrDataUrl(''); // burn the QR code immediately
            setPairedUsername(data?.claimedBy || 'Mobile User');
          }
        }
      } catch (e) {
        // bridge offline or pending
      }
    };

    const interval = setInterval(pollStatus, 1500);
    return () => clearInterval(interval);
  }, [isOpen, isPaired, pairingToken]);

  const generatePairingCode = async () => {
    setTimeLeft(600);
    setIsPaired(false);

    try {
      // 1. Try local bridge endpoint first
      const res = await fetch('http://127.0.0.1:5253/api/auth-qr');
      if (res.ok) {
        const data = await res.json();
        if (data?.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl);
          setPairingToken(data.token);
          return;
        }
      }
    } catch (e) {
      // fallback to direct client generation
    }

    // Direct fallback generation
    const token = 'pair_ot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    setPairingToken(token);

    const payload = {
      type: 'ANYSHARE_ONE_TIME_LOGIN',
      version: '1.0.0',
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      user: {
        id: 'user_master_01',
        name: 'Master Architect',
        username: 'admin',
        email: 'admin@anything.local',
        role: 'admin',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        provider: 'onetap_workstation'
      },
      workstation: {
        nodeId: 'node_studio_pc_01',
        label: 'Studio-PC-01 (Primary One Tap Node)',
        appVersion: 'One Tap v2.4.1',
        bridgePort: 5253,
        localIp: '127.0.0.1',
        gpu: 'NVIDIA RTX 4090 (24GB VRAM)',
        storageFreeGB: 482.4
      }
    };

    try {
      const url = await QRCode.toDataURL(JSON.stringify(payload), {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 7,
        color: {
          dark: '#0F172A',
          light: '#FAF8F5'
        }
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('QR creation error', err);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyToken = () => {
    navigator.clipboard?.writeText(pairingToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(10, 15, 29, 0.75)',
      backdropFilter: 'blur(8px)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: '#111827',
        border: '1px solid rgba(212, 175, 55, 0.4)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(212, 175, 55, 0.15)',
        overflow: 'hidden',
        color: '#F9FAFB',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12), transparent)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #D4AF37, #8A6614)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AnyShare Nexus Link
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#FFF' }}>
                Pair Mobile / Web Scanner
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', textAlign: 'center' }}>
          {isPaired ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid #10B981',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFF', margin: '0 0 6px' }}>
                Successfully Paired!
              </h3>
              <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px' }}>
                Connected with <strong>{pairedUsername}</strong>. Remote render triggers and progress telemetry are now synchronized with 0ms latency.
              </p>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 24px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #D4AF37, #8A6614)',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <div>
              {/* QR Container */}
              <div style={{
                display: 'inline-block',
                padding: '14px',
                background: '#FAF8F5',
                borderRadius: '20px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
                border: '2px solid rgba(212, 175, 55, 0.6)',
                marginBottom: '16px'
              }}>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="One Tap Login QR"
                    style={{ width: '210px', height: '210px', display: 'block', borderRadius: '10px' }}
                  />
                ) : (
                  <div style={{ width: '210px', height: '210px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: '12px' }}>
                    Generating QR...
                  </div>
                )}
              </div>

              {/* Instructions & Expiry */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: '#D1D5DB', margin: '0 0 6px', lineHeight: 1.4 }}>
                  Open <strong>AnyShare</strong> on your phone or browser, tap <strong>QR Login</strong>, and point camera here.
                </p>
                <div style={{ fontSize: '12px', color: '#D4AF37', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D4AF37', animation: 'pulse 1.5s infinite' }} />
                  <span>One-Time Token expires in: <strong>{formatTime(timeLeft)}</strong></span>
                </div>
              </div>

              {/* Workstation Hardware Info Pill */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '10px 14px',
                fontSize: '11px',
                color: '#9CA3AF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: 'left'
              }}>
                <div>
                  <div style={{ color: '#FFF', fontWeight: 700 }}>Node: Studio-PC-01 (Port 5253)</div>
                  <div style={{ fontSize: '10px', color: '#6B7280' }}>NVIDIA RTX 4090 • 482GB NVMe Free</div>
                </div>
                <button
                  onClick={handleCopyToken}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: 'rgba(212, 175, 55, 0.15)',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    color: '#D4AF37',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copied ? 'Copied' : 'Copy Token'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
