import React from 'react';
import { Zap, Sparkles } from 'lucide-react';

export default function AppLoader({
  message = 'Connecting to One Tap Workstation & Cloud Drive...',
  subtext = 'Syncing real-time Safar campaigns, render queues, and photo deliverables'
}: {
  message?: string;
  subtext?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        userSelect: 'none'
      }}
    >
      <style>{`:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; } button:active { transform: scale(0.98); } button:disabled { opacity: 0.6; cursor: not-allowed; }`}</style>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '380px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          background: 'rgba(255, 255, 255, 0.94)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '20px'
        }}
      >
        {/* Animated Brand Crest & Spinner */}
        <div style={{ position: 'relative', width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Rotating gradient ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '20px',
              border: '2px solid transparent',
              borderTopColor: 'var(--color-gold)',
              borderRightColor: 'var(--color-gold-2)',
              animation: 'spin 1s linear infinite'
            }}
          />
          {/* Inner Logo Box */}
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--color-gold) 0%, oklch(58% 0.12 70) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px color-mix(in oklch, var(--color-gold) 35%, transparent)'
            }}
          >
            <Zap size={26} color="var(--color-accent-ink)" fill="var(--color-accent-ink)" />
          </div>
          <span style={{ position: 'absolute', top: -4, right: -4, color: 'var(--color-gold)' }}>
            <Sparkles size={16} />
          </span>
        </div>

        {/* Text */}
        <div style={{ display: 'grid', gap: '6px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              color: 'var(--color-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-gold)', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
            One Tap Workspace
          </div>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '-0.3px' }}>
            {message}
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)', lineHeight: '1.5' }}>
            {subtext}
          </p>
        </div>

        {/* Shimmer loading track */}
        <div
          style={{
            width: '100%',
            height: '6px',
            background: 'var(--color-rule)',
            borderRadius: '999px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '50%',
              background: 'linear-gradient(90deg, var(--color-gold), var(--color-gold-2), var(--color-gold))',
              borderRadius: '999px',
              animation: 'safar-skeleton-shimmer 1.5s infinite ease-in-out'
            }}
          />
        </div>

        <div style={{ fontSize: '10px', color: 'var(--color-muted)', fontFamily: 'var(--font-outlier)' }}>
          Supabase Realtime Sync Engine Active
        </div>
      </div>
    </div>
  );
}
