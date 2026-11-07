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
              borderTopColor: '#4F46E5',
              borderRightColor: '#818CF8',
              animation: 'spin 1s linear infinite'
            }}
          />
          {/* Inner Logo Box */}
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #312E81 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(79, 70, 229, 0.35)'
            }}
          >
            <Zap size={26} color="#FFFFFF" fill="#FFFFFF" />
          </div>
          <span style={{ position: 'absolute', top: -4, right: -4, color: '#818CF8' }}>
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
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4F46E5', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
            One Tap &middot; AnyShare Nexus
          </div>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>
            {message}
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748B', lineHeight: '1.5' }}>
            {subtext}
          </p>
        </div>

        {/* Shimmer loading track */}
        <div
          style={{
            width: '100%',
            height: '6px',
            background: '#E2E8F0',
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
              background: 'linear-gradient(90deg, #4F46E5, #818CF8, #4F46E5)',
              borderRadius: '999px',
              animation: 'safar-skeleton-shimmer 1.5s infinite ease-in-out'
            }}
          />
        </div>

        <div style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace' }}>
          Port 5253 &middot; Supabase Realtime &middot; GS Photo Sync
        </div>
      </div>
    </div>
  );
}
