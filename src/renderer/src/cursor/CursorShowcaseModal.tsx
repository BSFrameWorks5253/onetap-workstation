import React, { useState } from 'react'
import { CURSOR_REGISTRY } from './cursorAssets'
import { CursorType } from './cursorTypes'
import { CursorArea } from './CursorArea'

interface CursorShowcaseModalProps {
  isOpen: boolean
  onClose: () => void
  isCustomCursorEnabled: boolean
  onToggleEnabled: () => void
}

export const CursorShowcaseModal: React.FC<CursorShowcaseModalProps> = ({
  isOpen,
  onClose,
  isCustomCursorEnabled,
  onToggleEnabled
}) => {
  const [selectedCursor, setSelectedCursor] = useState<CursorType>('default')
  const [activeTestTab, setActiveTestTab] = useState<'grid' | 'playground'>('grid')

  if (!isOpen) return null

  const cursorList = Object.values(CURSOR_REGISTRY)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 14, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '90vh',
          backgroundColor: '#0F1318',
          border: '1px solid #262D37',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
          overflow: 'hidden',
          color: '#E2E8F0',
          fontFamily: 'Plus Jakarta Sans, -apple-system, sans-serif'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1E2530',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #161C24 0%, #0F1318 100%)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>
                Cursor Pack
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#1E293B',
                  color: '#94A3B8'
                }}
              >
                18 Assets
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#64748B'
                }}
              >
                Clean · Modern · Minimal
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>
              Custom vector cursor system for Electron + React matching reference design.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onToggleEnabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: isCustomCursorEnabled ? '#0284C7' : '#334155',
                background: isCustomCursorEnabled ? 'rgba(14, 165, 233, 0.15)' : '#1E293B',
                color: isCustomCursorEnabled ? '#38BDF8' : '#94A3B8'
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isCustomCursorEnabled ? '#38BDF8' : '#64748B'
                }}
              />
              {isCustomCursorEnabled ? 'Custom Cursors: Active' : 'Custom Cursors: Disabled'}
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '20px',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 24px',
            background: '#131820',
            borderBottom: '1px solid #1E2530'
          }}
        >
          <button
            onClick={() => setActiveTestTab('grid')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              background: activeTestTab === 'grid' ? '#263141' : 'transparent',
              color: activeTestTab === 'grid' ? '#F8FAFC' : '#94A3B8',
              cursor: 'pointer'
            }}
          >
            Asset Gallery ({cursorList.length})
          </button>
          <button
            onClick={() => setActiveTestTab('playground')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              background: activeTestTab === 'playground' ? '#263141' : 'transparent',
              color: activeTestTab === 'playground' ? '#F8FAFC' : '#94A3B8',
              cursor: 'pointer'
            }}
          >
            Interactive Testing Zones
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTestTab === 'grid' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '16px'
              }}
            >
              {cursorList.map((entry) => (
                <CursorArea
                  key={entry.id}
                  cursor={entry.id}
                  onClick={() => setSelectedCursor(entry.id)}
                  style={{
                    backgroundColor: selectedCursor === entry.id ? '#1A2332' : '#141A22',
                    border: '1px solid',
                    borderColor: selectedCursor === entry.id ? '#38BDF8' : '#222A36',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '10px',
                      marginBottom: '8px',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={entry.svgUrl}
                      alt={entry.label}
                      style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        fontSize: '9px',
                        color: '#64748B',
                        fontFamily: 'monospace'
                      }}
                    >
                      {entry.hotspot.x},{entry.hotspot.y}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#F1F5F9',
                      marginBottom: '4px'
                    }}
                  >
                    {entry.label}
                  </span>

                  <span
                    style={{
                      fontSize: '11px',
                      color: '#64748B',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {entry.description}
                  </span>

                  <span
                    style={{
                      marginTop: '8px',
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: '#1E2633',
                      color: '#38BDF8'
                    }}
                  >
                    hover me
                  </span>
                </CursorArea>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px'
                }}
              >
                {/* Button & Click Test Zone */}
                <div
                  style={{
                    background: '#141A22',
                    border: '1px solid #222A36',
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#F1F5F9' }}>
                    Button & Click Indicators
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#94A3B8' }}>
                    Hover shows hover spark, press/active triggers click shockwave.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      className="clickable"
                      style={{
                        padding: '10px 18px',
                        background: '#2563EB',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFF',
                        fontWeight: 600,
                        fontSize: '13px'
                      }}
                    >
                      Click & Hold Me
                    </button>
                    <CursorArea
                      cursor="click"
                      style={{
                        padding: '10px 18px',
                        background: '#1E293B',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#94A3B8',
                        fontWeight: 600,
                        fontSize: '13px'
                      }}
                    >
                      Permanent Click Zone
                    </CursorArea>
                  </div>
                </div>

                {/* Text I-Beam Test Zone */}
                <div
                  style={{
                    background: '#141A22',
                    border: '1px solid #222A36',
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#F1F5F9' }}>
                    Text Fields & Editable
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#94A3B8' }}>
                    Hovering text inputs displays custom vector I-beam cursor.
                  </p>
                  <input
                    type="text"
                    placeholder="Type some text here to test..."
                    defaultValue="One Tap V20.6.5 Custom Vector Cursors"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0B0F14',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Drag & Move Zones */}
                <div
                  style={{
                    background: '#141A22',
                    border: '1px solid #222A36',
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#F1F5F9' }}>
                    Hand, Move & Drag
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#94A3B8' }}>
                    For reordering, draggable items, and drag-and-drop targets.
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <CursorArea
                      cursor="hand"
                      style={{
                        flex: 1,
                        padding: '14px',
                        background: '#1E293B',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '12px',
                        border: '1px dashed #475569'
                      }}
                    >
                      Hand Cursor Zone
                    </CursorArea>
                    <CursorArea
                      cursor="move"
                      style={{
                        flex: 1,
                        padding: '14px',
                        background: '#1E293B',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '12px',
                        border: '1px dashed #475569'
                      }}
                    >
                      Move Compass Zone
                    </CursorArea>
                    <CursorArea
                      cursor="drag"
                      style={{
                        flex: 1,
                        padding: '14px',
                        background: '#1E293B',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '12px',
                        border: '1px dashed #475569'
                      }}
                    >
                      Drag Waves Zone
                    </CursorArea>
                  </div>
                </div>

                {/* Resizing Handles */}
                <div
                  style={{
                    background: '#141A22',
                    border: '1px solid #222A36',
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#F1F5F9' }}>
                    Resize Handles
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#94A3B8' }}>
                    Test horizontal, vertical, and diagonal split handles.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <CursorArea
                      cursor="resize-horizontal"
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#1E293B',
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 600
                      }}
                    >
                      ↔ Horizontal
                    </CursorArea>
                    <CursorArea
                      cursor="resize-vertical"
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#1E293B',
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 600
                      }}
                    >
                      ↕ Vertical
                    </CursorArea>
                    <CursorArea
                      cursor="resize-diagonal"
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#1E293B',
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 600
                      }}
                    >
                      ⤢ Diagonal
                    </CursorArea>
                  </div>
                </div>

                {/* Action Badges */}
                <div
                  style={{
                    background: '#141A22',
                    border: '1px solid #222A36',
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#F1F5F9' }}>
                    Action Badges & Semantics
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#94A3B8' }}>
                    Contextual actions: Add, Subtract, Not Allowed, Link, Help, Precision.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(['add', 'subtract', 'not-allowed', 'link', 'help', 'precision', 'busy', 'wait'] as CursorType[]).map((c) => (
                      <CursorArea
                        key={c}
                        cursor={c}
                        style={{
                          padding: '6px 12px',
                          background: '#1E293B',
                          borderRadius: '6px',
                          fontSize: '12px',
                          border: '1px solid #334155'
                        }}
                      >
                        {c}
                      </CursorArea>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #1E2530',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748B',
            background: '#0D1117'
          }}
        >
          <span>
            Shortcut: Press <kbd style={{ padding: '2px 6px', background: '#1E2633', borderRadius: '4px', color: '#94A3B8' }}>Ctrl</kbd> + <kbd style={{ padding: '2px 6px', background: '#1E2633', borderRadius: '4px', color: '#94A3B8' }}>Shift</kbd> + <kbd style={{ padding: '2px 6px', background: '#1E2633', borderRadius: '4px', color: '#94A3B8' }}>C</kbd> to open/close this showcase anytime.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              background: '#263141',
              border: 'none',
              color: '#F8FAFC',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
