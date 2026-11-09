import React, { useState, useMemo } from 'react';
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
  MessageCircle
} from 'lucide-react';
import { sendWhatsAppAlert, DEFAULT_WHATSAPP_PHONE } from '../lib/googleAppsScript';

const JUNK_SAFAR_REGEX = /^(?:in[\s_-]?process|pending|to[\s_-]?delete|intel|intelvga|amd|nvidia|system|temp|program|windows|\$rec|delivery|renders?|output|exports?|dptf|mei)$/i;

export function isJunkSafarName(name: string): boolean {
  if (!name) return true;
  const clean = name.trim().toLowerCase();
  if (JUNK_SAFAR_REGEX.test(clean)) return true;
  if (clean.includes('intel') || clean.includes('driver') || clean.includes('vga') || clean.includes('dptf') || clean.includes('mei')) return true;
  if (clean.includes('in process') || clean.includes('to delete') || clean.includes('to upload') || clean.includes('uploaded data')) return true;
  return false;
}

export const DEFAULT_EDITOR = 'Murtaza';
export const DEFAULT_PHOTO_EDITOR = 'Muffadal Peti';

export type KanbanStage = 'editing' | 'rendering' | 'upload' | 'jameya' | 'completed';
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
    id: 'editing',
    title: 'Stage 1: In Editing',
    subtitle: 'Rough cut & active color/audio pass',
    badgeColor: '#d97706',
    headerBg: 'rgba(217, 119, 6, 0.08)',
    icon: <Film size={17} color="#d97706" />
  },
  {
    id: 'rendering',
    title: 'Stage 2: Rendered',
    subtitle: 'Render complete · Ready for cloud upload',
    badgeColor: '#2563eb',
    headerBg: 'rgba(37, 99, 235, 0.08)',
    icon: <Kanban size={17} color="#2563eb" />
  },
  {
    id: 'upload',
    title: 'Stage 3: Uploaded',
    subtitle: 'Synced to Google Drive & Cloud storage',
    badgeColor: '#059669',
    headerBg: 'rgba(5, 150, 105, 0.08)',
    icon: <UploadCloud size={17} color="#059669" />
  },
  {
    id: 'jameya',
    title: 'Stage 4: Submission to Al Jamea tus Saifiyah',
    subtitle: 'Al Jamea tus Saifiyah delivery & verification',
    badgeColor: '#7c3aed',
    headerBg: 'rgba(124, 58, 237, 0.08)',
    icon: <FileCheck2 size={17} color="#7c3aed" />
  },
  {
    id: 'completed',
    title: 'Stage 5: Completed Every Stage',
    subtitle: 'All stages finished · Production finalized',
    badgeColor: '#0d9488',
    headerBg: 'rgba(13, 148, 136, 0.08)',
    icon: <CheckCircle size={17} color="#0d9488" />
  }
];

export default function OngoingSafarKanban({
  tasks,
  safars,
  selectedSafar: propSelectedSafar,
  onSelectSafar,
  onUpdateTask,
  onRemoveTask,
  onAddTask,
  onResetAndRescan,
  onDeleteSafar,
  saving,
  connected
}: {
  tasks: SafarTaskItem[];
  safars: Array<{ safarName: string; isArchived?: boolean; isDone?: boolean }>;
  selectedSafar?: string;
  onSelectSafar?: (safarName: string) => void;
  onUpdateTask: (task: SafarTaskItem, changes: Partial<SafarTaskItem>) => void;
  onRemoveTask: (task: SafarTaskItem) => void;
  onAddTask: (safarName: string, dateFolder: string) => void;
  onResetAndRescan: () => void;
  onDeleteSafar?: (safarName: string) => void;
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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [rescanTriggered, setRescanTriggered] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeMobileStage, setActiveMobileStage] = useState<KanbanStage>('editing');

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 2. Strict Deduplication and Filtering for Selected Safar
  // Normalized key: remove spaces, dashes, underscores, lowercased
  const safarTasks = useMemo(() => {
    const seen = new Map<string, SafarTaskItem>();
    const list = tasks.filter(t => t.safarName === selectedSafar);

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

  // 3. Search filter
  const filteredTasks = useMemo(() => {
    if (!search.trim()) return safarTasks;
    const q = search.toLowerCase();
    return safarTasks.filter(t =>
      (t.dateFolder && t.dateFolder.toLowerCase().includes(q)) ||
      (t.editorName && t.editorName.toLowerCase().includes(q)) ||
      (t.hijriDate && t.hijriDate.toLowerCase().includes(q))
    );
  }, [safarTasks, search]);

  // 4. Strict Grouping into 5 Columns with Non-Present constraint
  // "also which arent prsent that should only and only be seen in submitted to jameya"
  const columnTasks = useMemo(() => {
    const map: Record<KanbanStage, SafarTaskItem[]> = {
      editing: [],
      rendering: [],
      upload: [],
      jameya: [],
      completed: []
    };

    for (const task of filteredTasks) {
      const isMissing = task.isMissing === true || task.isPresent === false || task.is_present === false;
      if (isMissing) {
        // Must ONLY and ONLY be placed into Stage 4: Submitted to Jameya!
        map['jameya'].push(task);
      } else {
        const stage = task.stage || 'editing';
        if (map[stage]) {
          map[stage].push(task);
        } else {
          map['editing'].push(task);
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
  const uploadedCount = safarTasks.filter(t => t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed').length;
  const pendingCount = Math.max(0, totalCount - uploadedCount);

  // Move stage
  const handleMoveStage = async (task: SafarTaskItem, nextStage: KanbanStage) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch {}
    const isMissing = task.isMissing === true || task.isPresent === false || task.is_present === false;
    if (isMissing && nextStage !== 'jameya' && nextStage !== 'completed') {
      showToast(`Cannot move "${task.dateFolder}": missing or unmounted folders stay in Submitted to Jameya archive.`);
      return;
    }

    // Cross-sync rule: when video moves to upload, jameya or completed, also mark photo as uploaded!
    const photoUpdates = (nextStage === 'upload' || nextStage === 'jameya' || nextStage === 'completed')
      ? { photoStage: 'uploaded' as PhotoStage, photoUploaded: true }
      : {};

    onUpdateTask(task, { stage: nextStage, ...photoUpdates });

    // WhatsApp milestone notification when marked uploaded or jameya or completed
    if (nextStage === 'upload' || nextStage === 'jameya' || nextStage === 'completed') {
      const remaining = Math.max(0, totalCount - (uploadedCount + 1));
      try {
        await sendWhatsAppAlert(
          task.dateFolder,
          uploadedCount + 1,
          remaining,
          window.location.origin
        );
        showToast(`Moved to ${nextStage === 'completed' ? 'COMPLETED EVERY STAGE' : nextStage.toUpperCase()} · Milestone alert dispatched`);
      } catch (e) {
        showToast(`Moved to ${nextStage === 'completed' ? 'COMPLETED EVERY STAGE' : nextStage.toUpperCase()}`);
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
    onAddTask(selectedSafar, cleanFolder);
    setNewDateInput('');
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
      <div
        className="kanban-top-banner"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border, rgba(0,0,0,0.08))',
          borderRadius: '16px',
          padding: '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
              Active Safar Pipeline
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <select
                aria-label="Select Ongoing Safar"
                value={selectedSafar}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedSafar(val);
                  onSelectSafar?.(val);
                }}
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--text-primary, #0f172a)',
                  background: 'var(--surface-sunken, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {ongoingSafars.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `📢 *Ongoing Safar Update (${selectedSafar})*\n` +
                    `📍 Progress: ${uploadedCount} of ${totalCount} dates delivered (${totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0}%)\n` +
                    `🔗 ${window.location.origin}/kanban?safar=${encodeURIComponent(selectedSafar)}`
                  )}`;
                  window.open(url, '_blank');
                }}
                style={{
                  background: '#25D366',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)'
                }}
                title={`Share WhatsApp update for ${selectedSafar}`}
              >
                <MessageCircle size={13} />
                <span>WhatsApp Briefing</span>
              </button>

              {onDeleteSafar && selectedSafar && selectedSafar !== 'Active Safar' && (
                <button
                  type="button"
                  title={`Permanently delete ${selectedSafar} from all views`}
                  onClick={() => onDeleteSafar(selectedSafar)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#ef4444',
                    borderRadius: '8px',
                    padding: '5px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={12} />
                  <span>Remove Safar</span>
                </button>
              )}

              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                {totalCount} dates · <strong style={{ color: '#059669' }}>{uploadedCount} uploaded</strong> · <strong style={{ color: '#d97706' }}>{pendingCount} pending</strong>
              </span>
            </div>

            {/* Mini Multi-Color Stage Pipeline Bar in Kanban Topbar */}
            {totalCount > 0 && (
              <div style={{ marginTop: '8px', maxWidth: '420px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                  <span style={{ color: '#4f46e5' }}>{Math.round(((columnTasks.editing.length * 20 + columnTasks.rendering.length * 45 + columnTasks.upload.length * 75 + columnTasks.jameya.length * 90 + columnTasks.completed.length * 100) / (totalCount || 1)) / 100 * 100)}% Pipeline</span>
                  <span style={{ color: '#059669' }}>{Math.round((uploadedCount / (totalCount || 1)) * 100)}% Delivered ({uploadedCount}/{totalCount})</span>
                </div>
                <div className="multicolor-progress-bar mini" role="progressbar" aria-label={`${selectedSafar} stage progress`}>
                  {columnTasks.editing.length > 0 && <span className="stage-segment stage-editing" style={{ width: `${(columnTasks.editing.length / (totalCount || 1)) * 100}%` }} title={`Editing: ${columnTasks.editing.length}`} />}
                  {columnTasks.rendering.length > 0 && <span className="stage-segment stage-rendering" style={{ width: `${(columnTasks.rendering.length / (totalCount || 1)) * 100}%` }} title={`Rendered: ${columnTasks.rendering.length}`} />}
                  {columnTasks.upload.length > 0 && <span className="stage-segment stage-upload" style={{ width: `${(columnTasks.upload.length / (totalCount || 1)) * 100}%` }} title={`Uploaded: ${columnTasks.upload.length}`} />}
                  {columnTasks.jameya.length > 0 && <span className="stage-segment stage-jameya" style={{ width: `${(columnTasks.jameya.length / (totalCount || 1)) * 100}%` }} title={`Submitted to Jameya: ${columnTasks.jameya.length}`} />}
                  {columnTasks.completed.length > 0 && <span className="stage-segment stage-completed" style={{ width: `${(columnTasks.completed.length / (totalCount || 1)) * 100}%` }} title={`Completed Every Stage: ${columnTasks.completed.length}`} />}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search, Rescan, Add Date Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search date folder..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                padding: '7px 12px 7px 32px',
                fontSize: '13px',
                borderRadius: '10px',
                border: '1px solid var(--border, #e2e8f0)',
                background: 'var(--surface-sunken, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                outline: 'none',
                minWidth: '180px'
              }}
            />
          </div>

          {/* Reset & Clean Rescan Button */}
          <button
            type="button"
            onClick={handleTriggerRescan}
            title="Reset cache and rescan workstation for present folders only"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCw size={14} className={rescanTriggered ? 'animate-spin' : ''} />
            <span>Reset & Clean Rescan</span>
          </button>

          {/* Add Date Folder Button */}
          <button
            type="button"
            onClick={() => setIsAddOpen(!isAddOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '10px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.2)'
            }}
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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            background: '#f1f5f9',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px'
          }}
        >
          <FolderOpen size={18} color="#475569" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
            Add new date folder to <em>{selectedSafar}</em>:
          </span>
          <input
            type="text"
            placeholder="e.g. 1446-02-14 or Day 14"
            value={newDateInput}
            onChange={e => setNewDateInput(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              maxWidth: '300px',
              padding: '6px 12px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 16px',
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
              padding: '6px 12px',
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
                {col.id === 'editing' ? 'Editing' : col.id === 'rendering' ? 'Render' : col.id === 'upload' ? 'Upload' : col.id === 'jameya' ? 'Jameya' : 'Done'}
              </span>
              <span className="mobile-stage-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 5-Column Kanban Board */}
      <div className="kanban-board-grid">
        {COLUMNS.map((col, colIdx) => {
          const list = columnTasks[col.id] || [];
          return (
            <div
              key={col.id}
              id={`kanban-col-${col.id}`}
              className="kanban-column"
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, rgba(0,0,0,0.08))',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                minHeight: '480px'
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  padding: '14px 16px',
                  background: col.headerBg,
                  borderBottom: '1px solid var(--border, rgba(0,0,0,0.06))',
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
                    <p
                      style={{
                        margin: 0,
                        fontSize: '11px',
                        color: '#64748b'
                      }}
                    >
                      {col.subtitle}
                    </p>
                  </div>
                </div>
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
                  {list.length}
                </span>
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
                  list.map(task => {
                    const isMissing = task.isMissing === true || task.isPresent === false || task.is_present === false;
                    return (
                      <div
                        key={task.id}
                        style={{
                          background: isMissing ? 'rgba(241, 245, 249, 0.7)' : 'var(--surface-sunken, #f8fafc)',
                          border: isMissing ? '1px dashed #cbd5e1' : '1px solid var(--border, #e2e8f0)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          transition: 'transform 0.1s ease, box-shadow 0.1s ease'
                        }}
                      >
                        {/* Card Header: Folder Title & Remove */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: 'var(--text-primary, #0f172a)',
                                display: 'block',
                                wordBreak: 'break-all'
                              }}
                            >
                              {task.dateFolder}
                            </span>
                            {task.hijriDate && (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                {task.hijriDate}
                              </span>
                            )}
                          </div>

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

                        {/* Deliverable Cross-Status Badge & Quick Upload Checkbox */}
                        {(() => {
                          const isPhotoUp = task.photoStage === 'uploaded' || Boolean(task.photoUploaded) || (task.stage === 'upload' || task.stage === 'jameya' || task.stage === 'completed');
                          const isVideoUp = task.stage === 'upload' || task.stage === 'jameya' || task.stage === 'completed';
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                              {isPhotoUp && isVideoUp ? (
                                <span className="media-sync-badge both-uploaded" title="Both Photo & Video Uploaded">
                                  <CheckCircle2 size={12} />
                                  <span>✓ Both Uploaded</span>
                                </span>
                              ) : isPhotoUp && !isVideoUp ? (
                                <span className="media-sync-badge photo-only" title="Photo Uploaded by Muffadal Peti · Video Pending">
                                  <Camera size={12} />
                                  <span>📷 Photo Uploaded · 🎬 Video Pending</span>
                                </span>
                              ) : !isPhotoUp && isVideoUp ? (
                                <span className="media-sync-badge video-only" title="Video Uploaded by Murtaza · Photo Pending">
                                  <Film size={12} />
                                  <span>🎬 Video Uploaded · 📷 Photo Pending</span>
                                </span>
                              ) : (
                                <span className="media-sync-badge both-pending" title="Both Photo & Video Pending Upload">
                                  <Clock size={12} />
                                  <span>⏳ Both Pending Upload</span>
                                </span>
                              )}

                              <label
                                title={isVideoUp && isPhotoUp ? 'Folder Uploaded across Photo & Video' : 'Tick to mark Uploaded in both trackers'}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  color: (isVideoUp && isPhotoUp) ? '#059669' : '#64748b'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isVideoUp && isPhotoUp}
                                  onChange={e => {
                                    const willUpload = e.target.checked;
                                    if (willUpload) {
                                      handleMoveStage(task, 'upload');
                                    } else {
                                      onUpdateTask(task, { stage: 'editing', photoStage: 'edited', photoUploaded: false });
                                      showToast(`Reset "${task.dateFolder}" to Editing`);
                                    }
                                  }}
                                />
                                <span>{isVideoUp && isPhotoUp ? 'Uploaded' : 'Upload'}</span>
                              </label>
                            </div>
                          );
                        })()}

                        {/* Missing badge constraint */}
                        {isMissing && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '6px',
                              width: 'fit-content'
                            }}
                          >
                            <AlertTriangle size={12} />
                            <span>Not on local disk (Submitted Archive)</span>
                          </div>
                        )}

                        {/* Editor & Metadata */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                          <span>Editor: <strong style={{ color: '#0f172a' }}>{task.editorName?.trim() || DEFAULT_EDITOR}</strong></span>
                          <span>Photo: <strong style={{ color: '#4f46e5' }}>{task.photoEditorName?.trim() || DEFAULT_PHOTO_EDITOR}</strong></span>
                        </div>

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
                                onClick={() => handleMoveStage(task, COLUMNS[colIdx - 1].id)}
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
                                onClick={() => handleMoveStage(task, COLUMNS[colIdx + 1].id)}
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
                                <span>Move to {COLUMNS[colIdx + 1].title.split(':')[1]?.trim() || COLUMNS[colIdx + 1].id}</span>
                                <ArrowRight size={11} />
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCircle size={12} /> Completed
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
