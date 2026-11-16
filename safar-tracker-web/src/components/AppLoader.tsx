import React from 'react';
import { Zap } from 'lucide-react';

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
        backgroundColor: 'rgba(0, 0, 0, 0.28)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '360px',
          borderRadius: '28px',
          border: '1px solid rgba(255, 255, 255, 0.95)',
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(40px) saturate(210%)',
          WebkitBackdropFilter: 'blur(40px) saturate(210%)',
          boxShadow: '0 28px 72px -12px rgba(0, 0, 0, 0.18), inset 0 1px 0 #ffffff, inset 0 0 0 1px rgba(255, 255, 255, 0.35)',
          padding: '36px 30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '22px'
        }}
      >
        {/* Apple iOS Activity Petal Spinner & Logo */}
        <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ios-spinner" style={{ width: '54px', height: '54px' }}>
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
            <div style={{ background: '#007AFF' }} />
          </div>
          <div
            style={{
              position: 'absolute',
              width: '28px',
              height: '28px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)'
            }}
          >
            <Zap size={14} color="#007AFF" fill="#007AFF" />
          </div>
        </div>

        {/* SF Pro Typography Hierarchy */}
        <div style={{ display: 'grid', gap: '6px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: '#007AFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34C759', boxShadow: '0 0 6px #34C759' }} />
            One Tap Studio
          </div>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1c1c1e', letterSpacing: '-0.4px', lineHeight: 1.3 }}>
            {message}
          </h2>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#8e8e93', lineHeight: '1.45', letterSpacing: '-0.1px' }}>
            {subtext}
          </p>
        </div>

        {/* iOS Fluid Loading Track */}
        <div
          style={{
            width: '100%',
            height: '4px',
            background: 'rgba(0, 0, 0, 0.06)',
            borderRadius: '9999px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '45%',
              background: 'linear-gradient(90deg, #007AFF, #5856D6, #007AFF)',
              borderRadius: '9999px',
              animation: 'safar-skeleton-shimmer 1.4s infinite ease-in-out'
            }}
          />
        </div>

        <div style={{ fontSize: '11px', fontWeight: 500, color: '#aeaeb2', letterSpacing: '-0.1px' }}>
          Apple iOS Liquid Glass Engine
        </div>
      </div>
    </div>
  );
}
