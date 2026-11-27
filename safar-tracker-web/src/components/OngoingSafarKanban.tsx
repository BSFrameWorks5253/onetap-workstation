import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Kanban,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  UploadCloud,
  Film,
  FileCheck2,
  AlertTriangle,
  FolderOpen,
  Search,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Archive,
  Camera,
  CheckCircle2,
  Clock,
  MessageCircle,
  Image as ImageIcon,
  ChevronDown,
  Send,
  MoreVertical,
  ShieldAlert,
  Zap,
  X,
  UserCheck,
  Share2
} from 'lucide-react';
import { sendWhatsAppAlert, DEFAULT_WHATSAPP_PHONE } from '../lib/googleAppsScript';
import { AnimatedNumber, getPublicWebsiteOrigin, isCameraOrAssetFolder, isProperDateOrSessionFolder } from '../App';

export function triggerHaptic(type: 'tick' | 'double-pulse' | 'heavy' = 'tick') {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'tick') {
        navigator.vibrate(15);
      } else if (type === 'double-pulse') {
        navigator.vibrate([25, 60, 40]);
      } else if (type === 'heavy') {
        navigator.vibrate(35);
      }
    } catch (_) {}
  }
}

const JUNK_SAFAR_REGEX = /^(?:in[\s_-]?process|pending|to[\s_-]?delete|intel|intelvga|amd|nvidia|system|temp|program|windows|\$rec|delivery|renders?|output|exports?|dptf|mei)$/i;

export function isJunkSafarName(name: string): boolean {
  if (!name) return true;
  const clean = name.trim().toLowerCase();
  if (JUNK_SAFAR_REGEX.test(clean)) return true;
  if (clean.includes('intel') || clean.includes('driver') || clean.includes('vga') || clean.includes('dptf') || clean.includes('mei')) return true;
  if (clean.includes('in process') || clean.includes('to delete') || clean.includes('to upload') || clean.includes('uploaded data')) return true;

  // Session / Date deliverables are NEVER Safar roots (e.g. "01-Agra QMZ", "02-Gwalior Waaz", "Day 01", "1448-05-08 _01M")
  if (/^\d{4}[\s._-]\d{1,2}[\s._-]\d{1,2}\s*_\d{2}[a-z]?/i.test(clean)) return true;
  if (/^day[\s._-]?\d+$/i.test(clean)) return true;
  if (/^\d{1,2}$/.test(clean)) return true;
  if (/^\d{1,2}[\s._-]+(?:[a-z0-9\s._-]+[\s._-]+)?(?:waaz|majlis|isteqbal|misaaq|urs|ziyarat|event|session|bethak|qmz|ziyafat|qadam|milad|ashara|darees|namaz|sermon|aqiqa|nikah|fmb|sharaf|talaqqi|tahneeq|wada|idaraat|mafsuhiyat|zafaf|olda|bm|bq|bz|aq|id|if|ifs|ist|kgs|m|mf|misbah|mkb|mo|mq|mul|myn|mz|n|q|sh|sq|tjr|tq|tnq|tqn|wd|z|zo|oz)\b/i.test(clean)) return true;
  if (/^(?:waaz|majlis|isteqbal|misaaq|urs|ziyarat|event|session|bethak|qmz|ziyafat|qadam|milad|ashara|darees|namaz|sermon|aqiqa|nikah|fmb|sharaf|talaqqi|tahneeq|wada)\b/i.test(clean)) return true;

  return false;
}

export const DEFAULT_EDITOR = 'Murtaza';
export const DEFAULT_PHOTO_EDITOR = 'Muffadal Peti';

export type KanbanStage = 'editing_pending' | 'editing' | 'upload_pending' | 'uploaded' | 'jameya';
export type PhotoStage = 'edited' | 'given_to_murtaza' | 'uploaded';

export interface SafarTaskItem {
  id: string;
  safarName: string;
  dateFolder: string;
  hijriDate?: string;
  stage: KanbanStage;
  dueDate?: string;
  editorName?: string;
  photoStage?: PhotoStage;
  photoEditorName?: string;
  photoUploaded?: boolean;
  updatedAt?: string;
  isPresent?: boolean;
  isMissing?: boolean;
  is_present?: boolean;
  notes?: string;
  comment?: string;
}

interface ColumnConfig {
  id: KanbanStage;
  title: string;
  subtitle: string;
  badgeColor: string;
  headerBg: string;
  icon: React.ReactNode;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'editing_pending',
    title: 'Editing Pending',
    subtitle: 'Awaiting Color & Audio Pass',
    badgeColor: '#f59e0b',
    headerBg: 'rgba(245, 158, 11, 0.08)',
    icon: <Clock size={16} color="#f59e0b" />
  },
  {
    id: 'editing',
    title: 'In Progress',
    subtitle: 'Color & Audio Pass',
    badgeColor: '#3b82f6',
    headerBg: 'rgba(59, 130, 246, 0.08)',
    icon: <Film size={16} color="#3b82f6" />
  },
  {
    id: 'upload_pending',
    title: 'Upload Pending',
    subtitle: 'Render Done · Ready to Push',
    badgeColor: '#06b6d4',
    headerBg: 'rgba(6, 182, 212, 0.08)',
    icon: <Kanban size={16} color="#06b6d4" />
  },
  {
    id: 'uploaded',
    title: 'Uploaded',
    subtitle: 'Cloud Synced & Available',
    badgeColor: '#10b981',
    headerBg: 'rgba(16, 185, 129, 0.08)',
    icon: <UploadCloud size={16} color="#10b981" />
  },
  {
    id: 'jameya',
    title: 'AlJamea Done',
    subtitle: 'Submitted to Al Jamea',
    badgeColor: '#047857',
    headerBg: 'rgba(4, 120, 87, 0.08)',
    icon: <FileCheck2 size={16} color="#047857" />
  }
];

interface KanbanTaskCardProps {
  task: SafarTaskItem;
  col: ColumnConfig;
  colIdx: number;
  isBatchMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onMoveStage: (task: SafarTaskItem, nextStage: KanbanStage) => void;
  onMarkDayAllCompleted: (dayLabelOrFolderName: string) => void;
  onRemoveTask: (task: SafarTaskItem) => void;
  onOpenActionSheet: (task: SafarTaskItem, mode?: 'executive' | 'quick') => void;
}

function KanbanTaskCard({
  task,
  col,
  colIdx,
  isBatchMode,
  isSelected,
  onToggleSelect,
  onMoveStage,
  onMarkDayAllCompleted,
  onRemoveTask,
  onOpenActionSheet
}: KanbanTaskCardProps) {
  const isMissing = task.isMissing === true || task.isPresent === false || task.is_present === false;
  const isUrgent = (task.notes || task.comment || '').includes('[URGENT]');
  
  // Touch gesture & long-press tracking
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const longPressTimer = useRef<any>(null);

  const startLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      triggerHaptic('heavy');
      onOpenActionSheet(task, 'executive');
      touchStartX.current = null;
      touchStartY.current = null;
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    setIsSwiping(false);
    startLongPress();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      cancelLongPress();
    }

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
      setIsSwiping(true);
      const clamped = Math.max(-110, Math.min(110, dx));
      setSwipeOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    if (swipeOffset > 60) {
      // Swipe Right: Instantly advance date's pipeline state
      if (colIdx < COLUMNS.length - 1 && !isMissing) {
        triggerHaptic('tick');
        onMoveStage(task, COLUMNS[colIdx + 1].id);
      }
    } else if (swipeOffset < -60) {
      // Swipe Left: Quick-actions sheet
      triggerHaptic('tick');
      onOpenActionSheet(task, 'quick');
    }
    setIsSwiping(false);
    setSwipeOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="task-card-swipe-wrapper">
      {/* Swipe Right Background Cue (Advance) */}
      <div
        className="task-swipe-cue task-swipe-cue-left"
        style={{
          opacity: swipeOffset > 20 ? Math.min(1, (swipeOffset - 20) / 40) : 0
        }}
      >
        <ArrowRight size={16} />
        <span>Advance</span>
      </div>

      {/* Swipe Left Background Cue (Quick Actions) */}
      <div
        className="task-swipe-cue task-swipe-cue-right"
        style={{
          opacity: swipeOffset < -20 ? Math.min(1, (-swipeOffset - 20) / 40) : 0
        }}
      >
        <span>Actions</span>
        <Sparkles size={16} />
      </div>

      {/* Card Content */}
      <div
        className="safar-task-card"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenActionSheet(task, 'executive');
        }}
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          border: isUrgent ? '1.5px solid #ef4444' : isMissing ? '1px dashed #cbd5e1' : undefined,
          transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          zIndex: 2,
          background: isUrgent ? 'rgba(254, 242, 242, 0.7)' : undefined
        }}
      >
        {/* Card Header: Folder Title, Checkbox, 1-Tap Done, Action Trigger & Exclude */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
            {isBatchMode && (
              <input
                type="checkbox"
                aria-label={`Select ${task.dateFolder}`}
                className="card-select-checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                style={{ marginTop: '2px' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display-serif, "Lora", serif)',
                  fontSize: '15px',
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: 'var(--color-ink, #0a0a0a)',
                  display: 'block',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}
              >
                {task.dateFolder}
              </span>
              {task.hijriDate && (
                <span style={{ fontSize: '11px', color: '#737373', fontFamily: 'var(--font-ui-sans, "Inter", sans-serif)' }}>
                  {task.hijriDate}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {col.id !== 'jameya' && (
              <button
                type="button"
                className="day-batch-pill"
                title="Mark all items for this day as AlJamea Done in 1 tap"
                onClick={() => onMarkDayAllCompleted(task.dateFolder)}
              >
                ⚡ Done
              </button>
            )}

            {/* Quick Actions Sheet trigger */}
            <button
              type="button"
              title="Open date actions sheet (or long-press card)"
              onClick={() => onOpenActionSheet(task, 'executive')}
              style={{
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.06)',
                color: '#64748b',
                cursor: 'pointer',
                padding: '3px 5px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <MoreVertical size={13} />
            </button>

            {/* Exclude / Remove Button */}
            <button
              type="button"
              title="Exclude this date from Safar task manager"
              onClick={() => {
                if (window.confirm(`Exclude "${task.dateFolder}" from tracking across all views?`)) {
                  onRemoveTask(task);
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Deliverable Cross-Status Badge */}
        {(() => {
          const isPhotoUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded) || (task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed');
          const isVideoUp = task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              {isPhotoUp && isVideoUp ? (
                <span className="media-sync-badge both-uploaded" title="Both Photo & Video Uploaded">
                  <CheckCircle2 size={12} />
                  <span>✓ Both Uploaded</span>
                </span>
              ) : isPhotoUp && !isVideoUp ? (
                <span className="media-sync-badge photo-only" title="Photo Uploaded · Video Pending">
                  <Camera size={12} />
                  <span>Photo Up · Video Pending</span>
                </span>
              ) : !isPhotoUp && isVideoUp ? (
                <span className="media-sync-badge video-only" title="Video Uploaded · Photo Pending">
                  <Film size={12} />
                  <span>Video Up · Photo Pending</span>
                </span>
              ) : (
                <span className="media-sync-badge both-pending" title="Both Photo & Video Pending Upload">
                  <Clock size={12} />
                  <span>Pending Upload</span>
                </span>
              )}
            </div>
          );
        })()}

        {/* Urgent Alert Banner */}
        {isUrgent && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
              width: 'fit-content'
            }}
          >
            <ShieldAlert size={12} />
            <span>URGENT · Audio Sync Issue</span>
          </div>
        )}

        {/* Missing badge constraint */}
        {isMissing && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#fee2e2',
              color: '#b91c1c',
              fontSize: '10.5px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '5px',
              width: 'fit-content'
            }}
          >
            <AlertTriangle size={11} />
            <span>Not on local disk</span>
          </div>
        )}

        {/* Editor & Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#64748b', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
            🎬 <strong style={{ color: '#0f172a' }}>{task.editorName?.trim() || DEFAULT_EDITOR}</strong>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(79, 70, 229, 0.07)', color: '#4338ca', padding: '2px 6px', borderRadius: '4px' }}>
            📷 <strong style={{ color: '#4f46e5' }}>{task.photoEditorName?.trim() || DEFAULT_PHOTO_EDITOR}</strong>
          </span>
        </div>

        {/* Comment / Notes Badge */}
        {(task.notes || task.comment) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '5px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              color: '#334155',
              lineHeight: 1.35
            }}
            title="Task Comment / Notes"
          >
            <span style={{ fontSize: '11px', flexShrink: 0 }}>💬</span>
            <span style={{ wordBreak: 'break-word', fontWeight: 500 }}>{task.notes || task.comment}</span>
          </div>
        )}

        {/* Action buttons to change stage */}
        {!isMissing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              paddingTop: '6px',
              borderTop: '1px solid rgba(0,0,0,0.05)',
              marginTop: '2px'
            }}
          >
            {colIdx > 0 ? (
              <button
                type="button"
                className="kanban-stage-prev-btn"
                onClick={() => onMoveStage(task, COLUMNS[colIdx - 1].id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#64748b',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px'
                }}
              >
                <ArrowLeft size={11} /> Prev
              </button>
            ) : <div />}

            {colIdx < COLUMNS.length - 1 ? (
              <button
                type="button"
                className="kanban-stage-advance-btn"
                onClick={() => onMoveStage(task, COLUMNS[colIdx + 1].id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: COLUMNS[colIdx + 1].badgeColor,
                  background: 'rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  padding: '5px 10px'
                }}
              >
                <span>Next: {COLUMNS[colIdx + 1].title}</span>
                <ArrowRight size={11} />
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: '#047857', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <CheckCircle size={12} /> AlJamea Done
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ExecutiveActionSheetModalProps {
  task: SafarTaskItem;
  mode: 'executive' | 'quick';
  onClose: () => void;
  onUpdateTask: (task: SafarTaskItem, changes: Partial<SafarTaskItem>) => void;
  onMoveStage: (task: SafarTaskItem, nextStage: KanbanStage) => void;
  onOpenBriefingModal?: (safarName: string, initialTab?: 'msg' | 'image') => void;
  showToast: (msg: string) => void;
}

function ExecutiveActionSheetModal({
  task,
  mode,
  onClose,
  onUpdateTask,
  onMoveStage,
  onOpenBriefingModal,
  showToast
}: ExecutiveActionSheetModalProps) {
  const currentStageObj = COLUMNS.find(c => c.id === task.stage) || COLUMNS[0];
  const isUrgent = (task.notes || task.comment || '').includes('[URGENT]');
  const [activeTab, setActiveTab] = useState<'actions' | 'reassign' | 'notes'>('actions');
  const [editorInput, setEditorInput] = useState(task.editorName || DEFAULT_EDITOR);
  const [photoEditorInput, setPhotoEditorInput] = useState(task.photoEditorName || DEFAULT_PHOTO_EDITOR);
  const [notesInput, setNotesInput] = useState(task.notes || task.comment || '');

  const handleSendWhatsAppUpdate = () => {
    triggerHaptic('tick');
    const isPhotoUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded) || (task.stage === 'uploaded' || task.stage === 'jameya');
    const isVideoUp = task.stage === 'uploaded' || task.stage === 'jameya';
    const text = `🎬 *ONE TAP STUDIO · DATE UPDATE*\n━━━━━━━━━━━━━━━━━━━━\n📍 *Safar:* ${task.safarName}\n📁 *Date:* ${task.dateFolder}${task.hijriDate ? ` (${task.hijriDate})` : ''}\n📌 *Pipeline:* ${currentStageObj.title}\n🎬 *Video Editor:* ${task.editorName || DEFAULT_EDITOR} (${isVideoUp ? '✓ Uploaded' : 'In Progress'})\n📷 *Photo Status:* ${isPhotoUp ? '✓ Uploaded' : 'Pending'} (${task.photoEditorName || DEFAULT_PHOTO_EDITOR})${task.notes || task.comment ? `\n💬 *Notes:* ${task.notes || task.comment}` : ''}\n━━━━━━━━━━━━━━━━━━━━\n🔗 ${window.location.origin}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    showToast(`✓ Briefing for ${task.dateFolder} dispatched to WhatsApp!`);
    onClose();
  };

  const handleCopyDateBriefing = () => {
    triggerHaptic('tick');
    const isPhotoUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded) || (task.stage === 'uploaded' || task.stage === 'jameya');
    const isVideoUp = task.stage === 'uploaded' || task.stage === 'jameya';
    const text = `🎬 *ONE TAP STUDIO · DATE UPDATE*\n━━━━━━━━━━━━━━━━━━━━\n📍 *Safar:* ${task.safarName}\n📁 *Date:* ${task.dateFolder}${task.hijriDate ? ` (${task.hijriDate})` : ''}\n📌 *Pipeline:* ${currentStageObj.title}\n🎬 *Video Editor:* ${task.editorName || DEFAULT_EDITOR} (${isVideoUp ? '✓ Uploaded' : 'In Progress'})\n📷 *Photo Status:* ${isPhotoUp ? '✓ Uploaded' : 'Pending'} (${task.photoEditorName || DEFAULT_PHOTO_EDITOR})${task.notes || task.comment ? `\n💬 *Notes:* ${task.notes || task.comment}` : ''}\n━━━━━━━━━━━━━━━━━━━━\n🔗 ${window.location.origin}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`✓ Copied date briefing text to clipboard!`);
    }
  };

  const handleToggleUrgent = () => {
    triggerHaptic('heavy');
    const raw = task.notes || task.comment || '';
    let updated = '';
    if (isUrgent) {
      updated = raw.replace(/\[URGENT\]\s*(?:Audio Sync Issue)?\s*·?\s*/gi, '').trim();
      showToast(`Removed urgent flag from ${task.dateFolder}`);
    } else {
      updated = raw ? `[URGENT] Audio Sync Issue · ${raw}` : '[URGENT] Audio Sync Issue';
      showToast(`⚠️ Flagged ${task.dateFolder} as URGENT / Audio Sync Issue!`);
    }
    onUpdateTask(task, { notes: updated, comment: updated });
    onClose();
  };

  const handleSaveEditor = (videoEd: string, photoEd: string) => {
    triggerHaptic('tick');
    onUpdateTask(task, { editorName: videoEd, photoEditorName: photoEd });
    showToast(`✓ Reassigned editors for ${task.dateFolder}`);
  };

  const handleSaveNotes = () => {
    triggerHaptic('tick');
    onUpdateTask(task, { notes: notesInput, comment: notesInput });
    showToast(`✓ Updated notes for ${task.dateFolder}`);
    onClose();
  };

  const handleTogglePhotoSync = () => {
    triggerHaptic('tick');
    const currentUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded);
    const newStage: PhotoStage = currentUp ? 'edited' : 'uploaded';
    onUpdateTask(task, { photoStage: newStage, photoUploaded: !currentUp });
    showToast(`✓ Photos marked as ${!currentUp ? 'Uploaded' : 'Pending'}`);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="executive-action-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="executive-action-sheet" onClick={e => e.stopPropagation()}>
        <div className="executive-sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                {task.dateFolder}
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: currentStageObj.badgeColor,
                  color: '#ffffff'
                }}
              >
                {currentStageObj.title}
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              {task.safarName} {task.hijriDate ? `· ${task.hijriDate}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(0,0,0,0.05)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.04)',
            borderRadius: '10px',
            padding: '3px',
            gap: '4px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: 700,
              background: activeTab === 'actions' ? '#ffffff' : 'transparent',
              border: 'none',
              boxShadow: activeTab === 'actions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              color: activeTab === 'actions' ? '#0f172a' : '#64748b',
              cursor: 'pointer'
            }}
          >
            ⚡ Quick Actions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reassign')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: 700,
              background: activeTab === 'reassign' ? '#ffffff' : 'transparent',
              border: 'none',
              boxShadow: activeTab === 'reassign' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              color: activeTab === 'reassign' ? '#0f172a' : '#64748b',
              cursor: 'pointer'
            }}
          >
            👤 Editors
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: 700,
              background: activeTab === 'notes' ? '#ffffff' : 'transparent',
              border: 'none',
              boxShadow: activeTab === 'notes' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              color: activeTab === 'notes' ? '#0f172a' : '#64748b',
              cursor: 'pointer'
            }}
          >
            💬 Notes
          </button>
        </div>

        {/* Tab 1: Actions */}
        {activeTab === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* WhatsApp Update */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSendWhatsAppUpdate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#25D366',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                }}
              >
                <Send size={15} />
                <span>🚀 Send WhatsApp Update for this Date</span>
              </button>
              <button
                type="button"
                onClick={handleCopyDateBriefing}
                title="Copy date briefing text"
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: '#0f172a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Share2 size={15} />
              </button>
            </div>

            {/* Open Google Drive */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick');
                window.open('https://drive.google.com', '_blank');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.08)',
                color: '#2563eb',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <FolderOpen size={15} />
              <span>☁️ Open Google Drive Folder</span>
            </button>

            {/* Toggle Photo Sync */}
            <button
              type="button"
              onClick={handleTogglePhotoSync}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'rgba(79, 70, 229, 0.06)',
                color: '#4f46e5',
                border: '1px solid rgba(79, 70, 229, 0.18)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={15} />
                <span>Toggle Photo Sync</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '8px', background: task.photoStage === 'uploaded' || task.photoUploaded ? '#10b981' : '#f59e0b', color: '#fff' }}>
                {task.photoStage === 'uploaded' || task.photoUploaded ? '✓ Uploaded' : 'Pending'}
              </span>
            </button>

            {/* Flag as Urgent / Audio Sync Issue */}
            <button
              type="button"
              onClick={handleToggleUrgent}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: isUrgent ? '#fee2e2' : 'rgba(239, 68, 68, 0.07)',
                color: '#b91c1c',
                border: isUrgent ? '1.5px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <ShieldAlert size={15} />
              <span>{isUrgent ? '✓ Remove Urgent Flag' : '⚠️ Flag as Urgent / Audio Sync Issue'}</span>
            </button>

            {/* Pipeline Stage Jump */}
            <div style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Jump Pipeline Stage:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '6px' }}>
                {COLUMNS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onMoveStage(task, c.id);
                      onClose();
                    }}
                    style={{
                      padding: '8px 6px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: task.stage === c.id ? 800 : 600,
                      background: task.stage === c.id ? c.badgeColor : 'rgba(0,0,0,0.03)',
                      color: task.stage === c.id ? '#ffffff' : '#334155',
                      border: `1px solid ${task.stage === c.id ? c.badgeColor : 'rgba(0,0,0,0.06)'}`,
                      cursor: 'pointer',
                      textAlign: 'center',
                      lineHeight: 1.2
                    }}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Reassign Editors */}
        {activeTab === 'reassign' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                🎬 Video Editor
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {['Murtaza', 'Mustafa', 'Burhanuddin', 'Zainab'].map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setEditorInput(name);
                      handleSaveEditor(name, photoEditorInput);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: editorInput === name ? 700 : 500,
                      background: editorInput === name ? '#4f46e5' : 'rgba(0,0,0,0.04)',
                      color: editorInput === name ? '#ffffff' : '#334155',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={editorInput}
                onChange={e => setEditorInput(e.target.value)}
                onBlur={() => handleSaveEditor(editorInput, photoEditorInput)}
                placeholder="Or custom editor name..."
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
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                📷 Photo Editor
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {['Muffadal Peti', 'Ali', 'Taha', 'Taher'].map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setPhotoEditorInput(name);
                      handleSaveEditor(editorInput, name);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: photoEditorInput === name ? 700 : 500,
                      background: photoEditorInput === name ? '#4f46e5' : 'rgba(0,0,0,0.04)',
                      color: photoEditorInput === name ? '#ffffff' : '#334155',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={photoEditorInput}
                onChange={e => setPhotoEditorInput(e.target.value)}
                onBlur={() => handleSaveEditor(editorInput, photoEditorInput)}
                placeholder="Or custom photo editor name..."
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
          </div>
        )}

        {/* Tab 3: Notes & Comments */}
        {activeTab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
              Task Comment / Progress Notes
            </label>
            <textarea
              rows={4}
              value={notesInput}
              onChange={e => setNotesInput(e.target.value)}
              placeholder="e.g. Audio sync issue on angle 2, waiting for drive re-upload..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Save Notes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function OngoingSafarKanban({
  tasks,
  safars,
  selectedSafar: propSelectedSafar,
  onSelectSafar,
  onUpdateTask,
  onBatchUpdateTasks,
  onRemoveTask,
  onAddTask,
  onResetAndRescan,
  onDeleteSafar,
  onOpenBriefingModal,
  saving,
  connected
}: {
  tasks: SafarTaskItem[];
  safars: Array<{ safarName: string; isArchived?: boolean; isDone?: boolean }>;
  selectedSafar?: string;
  onSelectSafar?: (safarName: string) => void;
  onUpdateTask: (task: SafarTaskItem, changes: Partial<SafarTaskItem>) => void;
  onBatchUpdateTasks?: (items: Array<{ task: SafarTaskItem; changes: Partial<SafarTaskItem> }>) => void;
  onRemoveTask: (task: SafarTaskItem) => void;
  onAddTask: (safarName: string, dateFolder: string, comment?: string) => void;
  onResetAndRescan: () => void;
  onDeleteSafar?: (safarName: string) => void;
  onOpenBriefingModal?: (safarName: string, initialTab?: 'msg' | 'image') => void;
  saving?: boolean;
  connected?: boolean;
}) {
  // 1. Available ongoing (non-archived) Safars
  const ongoingSafars = useMemo(() => {
    const archivedNames = new Set(safars.filter(s => s.isArchived).map(s => s.safarName));
    const names = new Set<string>();
    safars
      .filter(s => !s.isArchived && !isJunkSafarName(s.safarName))
      .forEach(s => s.safarName && names.add(s.safarName));
    tasks
      .filter(t => !isJunkSafarName(t.safarName) && !archivedNames.has(t.safarName))
      .forEach(t => t.safarName && names.add(t.safarName));
    return Array.from(names);
  }, [safars, tasks]);

  const [selectedSafar, setSelectedSafar] = useState<string>(() => {
    if (propSelectedSafar && propSelectedSafar !== 'all') return propSelectedSafar;
    return ongoingSafars[0] || 'Active Safar';
  });

  // Keep selected Safar synchronized when parent changes it (e.g. sidebar navigation or deep link)
  React.useEffect(() => {
    if (propSelectedSafar && propSelectedSafar !== 'all' && propSelectedSafar !== selectedSafar) {
      setSelectedSafar(propSelectedSafar);
    }
  }, [propSelectedSafar]);

  React.useEffect(() => {
    if (!ongoingSafars.includes(selectedSafar) && ongoingSafars.length > 0) {
      const fallback = propSelectedSafar && ongoingSafars.includes(propSelectedSafar) ? propSelectedSafar : ongoingSafars[0];
      setSelectedSafar(fallback);
    }
  }, [ongoingSafars, selectedSafar, propSelectedSafar]);

  const [search, setSearch] = useState('');
  const [newDateInput, setNewDateInput] = useState('');
  const [newCommentInput, setNewCommentInput] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [rescanTriggered, setRescanTriggered] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeMobileStage, setActiveMobileStage] = useState<KanbanStage>('editing_pending');
  const [filterChip, setFilterChip] = useState<'all' | 'my_pending' | 'ready_deliver' | 'needs_photo_review'>('all');
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [actionSheetTask, setActionSheetTask] = useState<SafarTaskItem | null>(null);
  const [actionSheetMode, setActionSheetMode] = useState<'executive' | 'quick'>('executive');
  const kanbanGridRef = useRef<HTMLDivElement>(null);

  const handleGridScroll = () => {
    const grid = kanbanGridRef.current;
    if (!grid || window.innerWidth > 768) return;
    const scrollLeft = grid.scrollLeft;
    const colWidth = grid.offsetWidth;
    if (colWidth <= 0) return;
    const activeIdx = Math.min(COLUMNS.length - 1, Math.max(0, Math.round(scrollLeft / (colWidth * 0.9))));
    if (COLUMNS[activeIdx] && COLUMNS[activeIdx].id !== activeMobileStage) {
      setActiveMobileStage(COLUMNS[activeIdx].id);
    }
  };

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 2. Strict Deduplication and Filtering for Selected Safar
  // Normalized key: remove spaces, dashes, underscores, lowercased
  const safarTasks = useMemo(() => {
    const seen = new Map<string, SafarTaskItem>();
    const list = tasks.filter(t => t.safarName === selectedSafar && !isCameraOrAssetFolder(t.dateFolder) && isProperDateOrSessionFolder(t.dateFolder));

    for (const t of list) {
      const normKey = (t.dateFolder || '').toLowerCase().replace(/[\s_\-]/g, '');
      if (!normKey) continue;
      // Deduplicate: merge incoming item into existing item without rejecting backward stage moves
      if (!seen.has(normKey)) {
        seen.set(normKey, t);
      } else {
        const existing = seen.get(normKey)!;
        seen.set(normKey, { ...existing, ...t });
      }
    }

    return Array.from(seen.values());
  }, [tasks, selectedSafar]);

  // Quick chip counts
  const chipCounts = useMemo(() => {
    const myPending = safarTasks.filter(t => t.stage === 'editing_pending' || t.stage === 'editing' || (t.photoStage === 'edited' && !t.photoUploaded)).length;
    const readyDeliver = safarTasks.filter(t => t.stage === 'upload_pending' || t.stage === 'uploaded' || t.photoStage === 'given_to_murtaza').length;
    const needsPhotoReview = safarTasks.filter(t => t.photoStage === 'given_to_murtaza' || (t.photoStage !== 'uploaded' && !t.photoUploaded)).length;
    return { myPending, readyDeliver, needsPhotoReview, all: safarTasks.length };
  }, [safarTasks]);

  // 3. Search and quick filter
  const filteredTasks = useMemo(() => {
    let list = safarTasks;

    if (filterChip === 'my_pending') {
      list = list.filter(t => t.stage === 'editing_pending' || t.stage === 'editing' || (t.photoStage === 'edited' && !t.photoUploaded));
    } else if (filterChip === 'ready_deliver') {
      list = list.filter(t => t.stage === 'upload_pending' || t.stage === 'uploaded' || t.photoStage === 'given_to_murtaza');
    } else if (filterChip === 'needs_photo_review') {
      list = list.filter(t => t.photoStage === 'given_to_murtaza' || (t.photoStage !== 'uploaded' && !t.photoUploaded));
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(t =>
      (t.dateFolder && t.dateFolder.toLowerCase().includes(q)) ||
      (t.editorName && t.editorName.toLowerCase().includes(q)) ||
      (t.hijriDate && t.hijriDate.toLowerCase().includes(q))
    );
  }, [safarTasks, filterChip, search]);

  const toggleSelectTask = (taskId: string) => {
    try { if ('vibrate' in navigator) navigator.vibrate(10); } catch {}
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectAllInColumn = (stage: KanbanStage) => {
    try { if ('vibrate' in navigator) navigator.vibrate(12); } catch {}
    const colTasks = columnTasks[stage] || [];
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      colTasks.forEach(t => next.add(t.id));
      return next;
    });
  };

  const handleApplyBatchStage = (targetStage: KanbanStage) => {
    try { if ('vibrate' in navigator) navigator.vibrate(20); } catch {}
    const targets = safarTasks.filter(t => selectedTaskIds.has(t.id));
    if (targets.length === 0) return;

    const photoUpdates = (targetStage === 'uploaded' || targetStage === 'jameya' || (targetStage as any) === 'upload' || (targetStage as any) === 'completed')
      ? { photoStage: 'uploaded' as PhotoStage, photoUploaded: true }
      : {};

    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(targets.map(t => ({ task: t, changes: { stage: targetStage, ...photoUpdates } })));
    } else {
      targets.forEach(t => onUpdateTask(t, { stage: targetStage, ...photoUpdates }));
    }

    showToast(`✓ Moved ${targets.length} dates to ${targetStage === 'jameya' ? 'AlJamea Done' : targetStage}!`);
    setSelectedTaskIds(new Set());
  };

  const handleMarkDayAllCompleted = (dayLabelOrFolderName: string) => {
    try { if ('vibrate' in navigator) navigator.vibrate(25); } catch {}
    const dayMatch = dayLabelOrFolderName.match(/Day[\s._-]?(\d{1,2})|^\s*(\d{1,2})[\s._-]/i);
    const dayNum = dayMatch ? parseInt(dayMatch[1] || dayMatch[2], 10) : null;

    const targets = safarTasks.filter(t => {
      if (dayNum !== null) {
        const m = t.dateFolder.match(/Day[\s._-]?(\d{1,2})|^\s*(\d{1,2})[\s._-]/i);
        if (m && parseInt(m[1] || m[2], 10) === dayNum) return true;
      }
      return t.dateFolder.toLowerCase().includes(dayLabelOrFolderName.toLowerCase());
    });

    if (targets.length === 0) {
      showToast(`No matching tasks found for ${dayLabelOrFolderName}.`);
      return;
    }

    const updates = targets.map(t => ({
      task: t,
      changes: { stage: 'jameya' as KanbanStage, photoStage: 'uploaded' as PhotoStage, photoUploaded: true }
    }));

    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(updates);
    } else {
      targets.forEach(t => onUpdateTask(t, { stage: 'jameya', photoStage: 'uploaded', photoUploaded: true }));
    }

    const dayName = dayNum !== null ? `Day ${String(dayNum).padStart(2, '0')}` : dayLabelOrFolderName;
    showToast(`✓ Marked all ${dayName} items (${targets.length}) as AlJamea Done!`);
  };

  // 4. Strict Grouping into 5 Columns with Non-Present constraint
  // "also which arent prsent that should only and only be seen in submitted to jameya"
  const columnTasks = useMemo(() => {
    const map: Record<KanbanStage, SafarTaskItem[]> = {
      editing_pending: [],
      editing: [],
      upload_pending: [],
      uploaded: [],
      jameya: []
    };

    for (const task of filteredTasks) {
      const isMissing = task.isMissing === true || task.isPresent === false || task.is_present === false;
      if (isMissing) {
        // Must ONLY and ONLY be placed into AlJamea Done!
        map['jameya'].push(task);
      } else {
        const stage = String(task.stage || 'editing_pending');
        if (stage === 'editing_pending') {
          map['editing_pending'].push(task);
        } else if (stage === 'editing') {
          map['editing'].push(task);
        } else if (stage === 'upload_pending' || stage === 'rendering') {
          map['upload_pending'].push(task);
        } else if (stage === 'uploaded' || stage === 'upload') {
          map['uploaded'].push(task);
        } else if (stage === 'jameya' || stage === 'completed' || stage === 'submitted') {
          map['jameya'].push(task);
        } else {
          map['editing_pending'].push(task);
        }
      }
    }

    // Sort folders numerically inside each column
    Object.keys(map).forEach(key => {
      map[key as KanbanStage].sort((a, b) =>
        a.dateFolder.localeCompare(b.dateFolder, undefined, { numeric: true })
      );
    });

    return map;
  }, [filteredTasks]);

  // Summary counts
  const totalCount = safarTasks.length;
  const uploadedCount = safarTasks.filter(t => t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed').length;
  const pendingCount = Math.max(0, totalCount - uploadedCount);

  // Move stage
  const handleMoveStage = async (task: SafarTaskItem, nextStage: KanbanStage) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch {}
    const isMissing = task.isMissing === true || task.isPresent === false || task.is_present === false;
    if (isMissing && nextStage !== 'jameya') {
      showToast(`Cannot move "${task.dateFolder}": missing or unmounted folders stay in AlJamea Done archive.`);
      return;
    }

    // Cross-sync rule: when video moves to uploaded or jameya, also mark photo as uploaded!
    const photoUpdates = (nextStage === 'uploaded' || nextStage === 'jameya')
      ? { photoStage: 'uploaded' as PhotoStage, photoUploaded: true }
      : {};

    onUpdateTask(task, { stage: nextStage, ...photoUpdates });

    // WhatsApp milestone notification when marked uploaded or jameya
    if (nextStage === 'uploaded' || nextStage === 'jameya') {
      const remaining = Math.max(0, totalCount - (uploadedCount + 1));
      try {
        await sendWhatsAppAlert(
          task.dateFolder,
          uploadedCount + 1,
          remaining,
          window.location.origin
        );
        showToast(`Moved to ${nextStage === 'jameya' ? 'ALJAMEA DONE' : nextStage.toUpperCase()} · Milestone alert dispatched`);
      } catch (e) {
        showToast(`Moved to ${nextStage === 'jameya' ? 'ALJAMEA DONE' : nextStage.toUpperCase()}`);
      }
    } else {
      showToast(`Moved "${task.dateFolder}" to ${nextStage}`);
    }
  };

  // Add Date Folder
  const handleAddNewDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDateInput.trim()) return;
    const cleanFolder = newDateInput.trim();
    const cleanComment = newCommentInput.trim();
    onAddTask(selectedSafar, cleanFolder, cleanComment || undefined);
    setNewDateInput('');
    setNewCommentInput('');
    setIsAddOpen(false);
    showToast(`Added date folder "${cleanFolder}" to ${selectedSafar}`);
  };

  // Reset & Rescan
  const handleTriggerRescan = () => {
    setRescanTriggered(true);
    onResetAndRescan();
    showToast('Reset initiated: purging unlinked tasks & rescanning workstation disk...');
    setTimeout(() => setRescanTriggered(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Top Banner / Actions Bar */}
      <div className="kanban-top-banner">
        <div className="kanban-banner-hero-section">
          <span className="kanban-banner-badge">
            Active Safar Pipeline
          </span>
          <div className="kanban-banner-selector-row">
            {safars && safars.length > 1 ? (
              <div className="kanban-safar-select-wrapper">
                <label htmlFor="kanban-safar-select" className="visually-hidden">Switch Campaign</label>
                <select
                  id="kanban-safar-select"
                  className="kanban-safar-select"
                  value={selectedSafar}
                  onChange={e => {
                    const newSafar = e.target.value;
                    if (onSelectSafar) onSelectSafar(newSafar);
                  }}
                  aria-label="Switch Campaign on Kanban Board"
                >
                  {safars.map(s => (
                    <option key={s.safarName} value={s.safarName}>
                      {s.safarName} {s.isDone ? '✓ (100% Done)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="kanban-safar-select-caret" />
              </div>
            ) : (
              <h2 className="kanban-banner-campaign-title" title={`Active Campaign: ${selectedSafar}`}>
                {selectedSafar}
              </h2>
            )}

            <div className="kanban-banner-whatsapp-group">
              <button
                type="button"
                className="kanban-banner-whatsapp-btn"
                onClick={() => {
                  if (onOpenBriefingModal) {
                    onOpenBriefingModal(selectedSafar, 'msg');
                  } else {
                    const base = getPublicWebsiteOrigin();
                    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `📢 *Ongoing Safar Update (${selectedSafar})*\n` +
                      `📍 Progress: ${uploadedCount} of ${totalCount} dates delivered (${totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0}%)\n` +
                      `🔗 ${base}/kanban?safar=${encodeURIComponent(selectedSafar)}`
                    )}`;
                    window.open(url, '_blank');
                  }
                }}
                title={`Open WhatsApp text message briefing for ${selectedSafar}`}
              >
                <MessageCircle size={14} />
                <span>WhatsApp Msg</span>
              </button>

              <button
                type="button"
                className="kanban-banner-whatsapp-btn kanban-banner-image-btn"
                onClick={() => {
                  if (onOpenBriefingModal) {
                    onOpenBriefingModal(selectedSafar, 'image');
                  }
                }}
                title={`Generate visual Infographic Image Card for ${selectedSafar}`}
              >
                <ImageIcon size={14} />
                <span>Image Card</span>
              </button>
            </div>

            {onDeleteSafar && selectedSafar && selectedSafar !== 'Active Safar' && (
              <button
                type="button"
                title={`Permanently delete ${selectedSafar} from all views`}
                onClick={() => onDeleteSafar(selectedSafar)}
                className="kanban-banner-delete-btn"
              >
                <Trash2 size={12} />
                <span>Remove Safar</span>
              </button>
            )}
          </div>

          <div className="kanban-banner-stats-pill">
            <AnimatedNumber value={totalCount} /> dates · <strong style={{ color: '#059669' }}><AnimatedNumber value={uploadedCount} /> uploaded</strong> · <strong style={{ color: '#d97706' }}><AnimatedNumber value={pendingCount} /> pending</strong>
          </div>

          {/* Mini Multi-Color Stage Pipeline Bar in Kanban Topbar */}
          {totalCount > 0 && (
            <div className="kanban-banner-pipeline-wrap">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                <span style={{ color: '#4f46e5' }}><AnimatedNumber value={Math.round(((columnTasks.editing_pending.length * 10 + columnTasks.editing.length * 35 + columnTasks.upload_pending.length * 65 + columnTasks.uploaded.length * 90 + columnTasks.jameya.length * 100) / (totalCount || 1)) / 100 * 100)} />% Pipeline</span>
                <span style={{ color: '#059669' }}>
                  {totalCount > 0 && uploadedCount >= totalCount ? (
                    <strong>🏆 100% DONE (<AnimatedNumber value={uploadedCount} />/{totalCount})</strong>
                  ) : (
                    <><AnimatedNumber value={Math.round((uploadedCount / (totalCount || 1)) * 100)} />% Delivered (<AnimatedNumber value={uploadedCount} />/{totalCount})</>
                  )}
                </span>
              </div>
              <div className="multicolor-progress-bar mini" role="progressbar" aria-label={`${selectedSafar} stage progress`}>
                {columnTasks.editing_pending.length > 0 && <span className="stage-segment stage-editing_pending" style={{ width: `${(columnTasks.editing_pending.length / (totalCount || 1)) * 100}%` }} title={`Editing Pending: ${columnTasks.editing_pending.length}`} />}
                {columnTasks.editing.length > 0 && <span className="stage-segment stage-editing" style={{ width: `${(columnTasks.editing.length / (totalCount || 1)) * 100}%` }} title={`In Progress: ${columnTasks.editing.length}`} />}
                {columnTasks.upload_pending.length > 0 && <span className="stage-segment stage-upload_pending" style={{ width: `${(columnTasks.upload_pending.length / (totalCount || 1)) * 100}%` }} title={`Upload Pending: ${columnTasks.upload_pending.length}`} />}
                {columnTasks.uploaded.length > 0 && <span className="stage-segment stage-uploaded" style={{ width: `${(columnTasks.uploaded.length / (totalCount || 1)) * 100}%` }} title={`Uploaded: ${columnTasks.uploaded.length}`} />}
                {columnTasks.jameya.length > 0 && <span className="stage-segment stage-jameya" style={{ width: `${(columnTasks.jameya.length / (totalCount || 1)) * 100}%` }} title={`AlJamea Done: ${columnTasks.jameya.length}`} />}
              </div>
            </div>
          )}
        </div>

        {/* Search, Rescan, Add Date Controls */}
        <div className="kanban-banner-controls-wrap">
          <div className="kanban-search-box-wrap">
            <Search size={15} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search date folder..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="kanban-search-input"
            />
          </div>

          <button
            type="button"
            onClick={handleTriggerRescan}
            title="Reset cache and rescan workstation for present folders only"
            className="kanban-rescan-btn apple-secondary-btn"
          >
            <RotateCw size={14} className={rescanTriggered ? 'animate-spin' : ''} />
            <span>Rescan Disk</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddOpen(!isAddOpen)}
            className="kanban-add-btn apple-primary-btn"
          >
            <Plus size={15} />
            <span>Add Date</span>
          </button>
        </div>
      </div>

      {/* Inline Add Date Dialog */}
      {isAddOpen && (
        <form
          onSubmit={handleAddNewDate}
          className="kanban-add-date-form"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '12px 14px',
            background: 'var(--color-surface-sidebar, #f1f5f9)',
            border: '1px dashed var(--color-hairline, #cbd5e1)',
            borderRadius: '14px',
            boxSizing: 'border-box',
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FolderOpen size={18} color="#475569" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Add date to <em>{selectedSafar}</em>:
            </span>
          </div>
          <input
            type="text"
            placeholder="e.g. 1446-02-14 or Day 14"
            value={newDateInput}
            onChange={e => setNewDateInput(e.target.value)}
            autoFocus
            style={{
              flex: '1 1 180px',
              minWidth: '150px',
              padding: '8px 12px',
              fontSize: '14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <input
            type="text"
            placeholder="Optional comment / notes (e.g. Needs re-edit, Nikaah clip)..."
            value={newCommentInput}
            onChange={e => setNewCommentInput(e.target.value)}
            style={{
              flex: '2 1 240px',
              minWidth: '180px',
              padding: '8px 12px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                minHeight: '38px',
                borderRadius: '8px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save Folder
            </button>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              style={{
                padding: '8px 12px',
                minHeight: '38px',
                borderRadius: '8px',
                background: 'transparent',
                color: '#64748b',
                border: 'none',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Toast Notice */}
      {actionNotice && (
        <div
          role="status"
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            background: '#0f172a',
            color: '#f8fafc',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <Sparkles size={16} color="#38bdf8" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Mobile Stage Switcher Tabs (Thumb-Friendly Native Navigation) */}
      <div className="mobile-kanban-stage-tabs" role="tablist" aria-label="Kanban stage selector">
        {COLUMNS.map(col => {
          const count = (columnTasks[col.id] || []).length;
          return (
            <button
              key={col.id}
              type="button"
              role="tab"
              aria-selected={activeMobileStage === col.id}
              className={`mobile-stage-tab ${activeMobileStage === col.id ? 'active' : ''}`}
              onClick={() => {
                try { if ('vibrate' in navigator) navigator.vibrate(10) } catch {}
                setActiveMobileStage(col.id);
                const el = document.getElementById(`kanban-col-${col.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
              }}
            >
              <span className="mobile-stage-dot" style={{ backgroundColor: col.badgeColor }} />
              <span className="mobile-stage-name">
                {col.id === 'editing_pending' ? 'Pending' : col.id === 'editing' ? 'In Progress' : col.id === 'upload_pending' ? 'Upload Pend' : col.id === 'uploaded' ? 'Uploaded' : 'AlJamea'}
              </span>
              <span className="mobile-stage-count"><AnimatedNumber value={count} /></span>
            </button>
          );
        })}
      </div>

      {/* 5-Column Kanban Board */}
      <div ref={kanbanGridRef} onScroll={handleGridScroll} className="kanban-board-grid">
        {COLUMNS.map((col, colIdx) => {
          const list = columnTasks[col.id] || [];
          return (
            <div
              key={col.id}
              id={`kanban-col-${col.id}`}
              className="kanban-column apple-glass-column"
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '480px'
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  padding: '14px 16px',
                  background: col.headerBg,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {col.icon}
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--text-primary, #0f172a)'
                      }}
                    >
                      {col.title}
                    </h3>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isBatchMode && list.length > 0 && (
                    <button
                      type="button"
                      onClick={() => selectAllInColumn(col.id)}
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: 'transparent',
                        border: `1px solid ${col.badgeColor}`,
                        color: col.badgeColor,
                        cursor: 'pointer'
                      }}
                    >
                      Select All
                    </button>
                  )}
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: col.badgeColor,
                      color: '#ffffff'
                    }}
                  >
                    <AnimatedNumber value={list.length} />
                  </span>
                </div>
              </div>

              {/* Task Cards List */}
              <div
                style={{
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  flex: 1,
                  overflowY: 'auto',
                  maxHeight: '650px'
                }}
              >
                {list.length === 0 ? (
                  <div
                    style={{
                      padding: '32px 16px',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>No dates in this stage</span>
                  </div>
                ) : (
                  list.map(task => (
                    <KanbanTaskCard
                      key={task.id}
                      task={task}
                      col={col}
                      colIdx={colIdx}
                      isBatchMode={isBatchMode}
                      isSelected={selectedTaskIds.has(task.id)}
                      onToggleSelect={() => toggleSelectTask(task.id)}
                      onMoveStage={handleMoveStage}
                      onMarkDayAllCompleted={handleMarkDayAllCompleted}
                      onRemoveTask={onRemoveTask}
                      onOpenActionSheet={(t, mode) => {
                        setActionSheetTask(t);
                        setActionSheetMode(mode || 'executive');
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Floating Batch Action Bar */}
      {selectedTaskIds.size > 0 && (
        <aside className="batch-floating-bar" aria-label="Batch actions toolbar">
          <div className="batch-bar-info">
            <span className="batch-bar-count">{selectedTaskIds.size} selected</span>
            <span>Batch apply stage:</span>
          </div>
          <div className="batch-actions-row">
            <button type="button" className="batch-btn" onClick={() => handleApplyBatchStage('editing_pending')}>
              ⏳ 1. Editing Pending
            </button>
            <button type="button" className="batch-btn" onClick={() => handleApplyBatchStage('editing')}>
              🎬 2. In Progress
            </button>
            <button type="button" className="batch-btn" onClick={() => handleApplyBatchStage('upload_pending')}>
              🌐 3. Upload Pending
            </button>
            <button type="button" className="batch-btn" onClick={() => handleApplyBatchStage('uploaded')}>
              ☁️ 4. Uploaded
            </button>
            <button type="button" className="batch-btn primary" onClick={() => handleApplyBatchStage('jameya')}>
              🏛️ 5. AlJamea Done
            </button>
            <button type="button" className="batch-btn cancel" onClick={() => setSelectedTaskIds(new Set())}>
              ✕ Clear
            </button>
          </div>
        </aside>
      )}

      {/* Executive Action Bottom Sheet */}
      {actionSheetTask && (
        <ExecutiveActionSheetModal
          task={actionSheetTask}
          mode={actionSheetMode}
          onClose={() => setActionSheetTask(null)}
          onUpdateTask={onUpdateTask}
          onMoveStage={handleMoveStage}
          onOpenBriefingModal={onOpenBriefingModal}
          showToast={showToast}
        />
      )}
    </div>
  );
}
