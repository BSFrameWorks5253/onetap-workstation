import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  MessageSquare,
  Search,
  Settings,
  Check,
  Film,
  UserRound,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Trash2,
  Kanban,
  LayoutGrid
} from 'lucide-react';
import {
  fetchPhotoFolders,
  markDriveFolderUploaded,
  markDriveFolderDownloaded,
  sendWhatsAppAlert,
  getGsUrl,
  setGsUrl,
  DEFAULT_WHATSAPP_PHONE,
  PhotoDeliverable,
  PhotoStats
} from '../lib/googleAppsScript';
import { isJunkSafarName } from './OngoingSafarKanban';
import { AnimatedNumber } from '../App';

export const DEFAULT_PHOTO_EDITOR = 'Muffadal Peti';
export const DEFAULT_VIDEO_EDITOR = 'Murtaza';

export type PhotoStage = 'edited' | 'given_to_murtaza' | 'uploaded';

export interface PhotoTaskItem {
  id: string;
  safarName: string;
  dateFolder: string;
  hijriDate?: string;
  stage: string;
  dueDate?: string;
  editorName?: string;
  photoStage?: PhotoStage;
  photoEditorName?: string;
  photoUploaded?: boolean;
  isPresent?: boolean;
  isMissing?: boolean;
}

interface PhotoColumnConfig {
  id: PhotoStage;
  title: string;
  subtitle: string;
  color: string;
  headerBg: string;
  badgeBg: string;
}

const PHOTO_COLUMNS: PhotoColumnConfig[] = [
  {
    id: 'edited',
    title: 'Stage 1: Edited',
    subtitle: 'Photos color-graded & exported',
    color: '#8b5cf6',
    headerBg: 'rgba(139, 92, 246, 0.08)',
    badgeBg: 'rgba(139, 92, 246, 0.15)'
  },
  {
    id: 'given_to_murtaza',
    title: 'Stage 2: Given To Murtaza',
    subtitle: 'Handed over to video lead Murtaza',
    color: '#2563eb',
    headerBg: 'rgba(37, 99, 235, 0.08)',
    badgeBg: 'rgba(37, 99, 235, 0.15)'
  },
  {
    id: 'uploaded',
    title: 'Stage 3: Uploaded',
    subtitle: 'Uploaded to Google Drive & Cloud',
    color: '#059669',
    headerBg: 'rgba(5, 150, 105, 0.08)',
    badgeBg: 'rgba(5, 150, 105, 0.15)'
  }
];

export default function PhotoTracker({
  tasks,
  safars,
  selectedSafar: propSelectedSafar,
  onSelectSafar,
  onUpdateTask,
  onUpdateTaskStage,
  onRemoveTask
}: {
  tasks: PhotoTaskItem[];
  safars: Array<{ safarName: string; safarYear?: string | number }>;
  selectedSafar?: string;
  onSelectSafar?: (safar: string) => void;
  onUpdateTask?: (task: PhotoTaskItem, changes: Partial<PhotoTaskItem>) => void;
  onUpdateTaskStage?: (dateFolder: string, safarName: string, stage: string) => void;
  onRemoveTask?: (task: PhotoTaskItem) => void;
}) {
  // Determine available Safars from Task Tracker
  const safarNames = useMemo(() => {
    const set = new Set<string>();
    safars.forEach(s => s.safarName && !isJunkSafarName(s.safarName) && set.add(s.safarName));
    tasks.forEach(t => t.safarName && !isJunkSafarName(t.safarName) && set.add(t.safarName));
    return Array.from(set);
  }, [safars, tasks]);

  const [internalSelectedSafar, setInternalSelectedSafar] = useState<string>(() => {
    if (propSelectedSafar && propSelectedSafar !== 'all' && safarNames.includes(propSelectedSafar)) {
      return propSelectedSafar;
    }
    return safarNames[0] || 'Active Safar';
  });

  const selectedSafar = (propSelectedSafar && propSelectedSafar !== 'all') ? propSelectedSafar : internalSelectedSafar;

  const handleSafarChange = (name: string) => {
    setInternalSelectedSafar(name);
    if (onSelectSafar) onSelectSafar(name);
  };

  // Keep selection valid
  useEffect(() => {
    if (!safarNames.includes(selectedSafar) && safarNames.length > 0) {
      handleSafarChange(safarNames[0]);
    }
  }, [safarNames, selectedSafar]);

  // Tasks for the selected Safar
  const safarTasks = useMemo(() => {
    return tasks.filter(t => t.safarName === selectedSafar);
  }, [tasks, selectedSafar]);

  // Expected date folders
  const expectedDateFolders = useMemo(() => {
    const list = safarTasks.map(t => t.dateFolder);
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [safarTasks]);

  const [records, setRecords] = useState<PhotoDeliverable[]>([]);
  const [stats, setStats] = useState<PhotoStats>({ total: 0, uploadedCount: 0, downloadedCount: 0, pendingCount: 0, percentComplete: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'edited' | 'given_to_murtaza' | 'uploaded'>('all');
  const [syncFilter, setSyncFilter] = useState<'all' | 'both_uploaded' | 'photo_only' | 'video_only' | 'both_pending'>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [gsUrlInput, setGsUrlInput] = useState(() => getGsUrl());
  const [sendingAlert, setSendingAlert] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'grid'>('kanban');
  const [activeMobileStage, setActiveMobileStage] = useState<PhotoStage>('edited');

  // Sync photo folders with Google Drive & Sheet
  const loadPhotoStatus = async () => {
    if (!selectedSafar || expectedDateFolders.length === 0) return;
    setLoading(true);
    try {
      const res = await fetchPhotoFolders(selectedSafar, expectedDateFolders);
      if (res?.success && Array.isArray(res.folders)) {
        setRecords(res.folders);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.warn('Failed to load photo status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotoStatus();
  }, [selectedSafar, expectedDateFolders.length]);

  // Helper to resolve photo stage
  const getPhotoStage = (task: PhotoTaskItem): PhotoStage => {
    if (task.photoStage) return task.photoStage;
    if (task.photoUploaded || task.stage === 'upload' || task.stage === 'jameya' || task.stage === 'completed') {
      return 'uploaded';
    }
    return 'edited';
  };

  // Group tasks by photo stage
  const tasksByPhotoStage = useMemo(() => {
    const map: Record<PhotoStage, PhotoTaskItem[]> = {
      edited: [],
      given_to_murtaza: [],
      uploaded: []
    };
    for (const t of safarTasks) {
      const st = getPhotoStage(t);
      if (map[st]) map[st].push(t);
      else map['edited'].push(t);
    }
    // Sort folders numerically inside each column
    Object.keys(map).forEach(key => {
      map[key as PhotoStage].sort((a, b) => a.dateFolder.localeCompare(b.dateFolder, undefined, { numeric: true }));
    });
    return map;
  }, [safarTasks]);

  // Overall counts
  const totalCount = safarTasks.length;
  const editedCount = tasksByPhotoStage.edited.length;
  const murtazaCount = tasksByPhotoStage.given_to_murtaza.length;
  const uploadedCount = tasksByPhotoStage.uploaded.length;
  const photoPercent = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;

  // Cross-status calculations
  const crossStatusCounts = useMemo(() => {
    let bothUp = 0;
    let photoOnly = 0;
    let videoOnly = 0;
    let bothPend = 0;
    for (const t of safarTasks) {
      const pUp = getPhotoStage(t) === 'uploaded';
      const vUp = t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed';
      if (pUp && vUp) bothUp++;
      else if (pUp && !vUp) photoOnly++;
      else if (!pUp && vUp) videoOnly++;
      else bothPend++;
    }
    return { bothUp, photoOnly, videoOnly, bothPend };
  }, [safarTasks]);

  // Execute task update with full cross-sync
  const executeUpdate = (task: PhotoTaskItem, changes: Partial<PhotoTaskItem>) => {
    if (onUpdateTask) {
      onUpdateTask(task, changes);
    } else if (onUpdateTaskStage && changes.stage) {
      onUpdateTaskStage(task.dateFolder, task.safarName, changes.stage);
    }
  };

  // Move Photo Stage
  const handleMovePhotoStage = async (task: PhotoTaskItem, nextStage: PhotoStage) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch {}
    const isUploading = nextStage === 'uploaded';
    const changes: Partial<PhotoTaskItem> = {
      photoStage: nextStage,
      photoUploaded: isUploading
    };

    // Cross-sync rule: when marked uploaded in photo tracker, also mark video as upload!
    if (isUploading) {
      if (task.stage === 'editing' || task.stage === 'rendering') {
        changes.stage = 'upload';
      }
    }

    executeUpdate(task, changes);

    if (isUploading) {
      try {
        await markDriveFolderUploaded(selectedSafar, task.dateFolder, 'Muffadal Peti', window.location.origin);
      } catch {}

      const updatedUploaded = uploadedCount + 1;
      const updatedPending = Math.max(0, totalCount - updatedUploaded);
      sendWhatsAppAlert({
        folderName: task.dateFolder,
        uploadedCount: updatedUploaded,
        pendingCount: updatedPending,
        websiteUrl: window.location.origin,
        phone: DEFAULT_WHATSAPP_PHONE
      }).catch(() => {});

      setNotice(`Folder "${task.dateFolder}" marked as Uploaded across Photo & Video!`);
      setTimeout(() => setNotice(''), 4500);
    } else {
      setNotice(`Moved "${task.dateFolder}" to ${nextStage === 'given_to_murtaza' ? 'Given To Murtaza' : 'Edited'}.`);
      setTimeout(() => setNotice(''), 3000);
    }
  };

  // One-click toggle upload
  const handleToggleUpload = (task: PhotoTaskItem) => {
    const isCurrentlyUploaded = getPhotoStage(task) === 'uploaded';
    if (isCurrentlyUploaded) {
      executeUpdate(task, {
        photoStage: 'edited',
        photoUploaded: false,
        stage: 'editing'
      });
      setNotice(`Reset "${task.dateFolder}" to Edited / In Progress.`);
    } else {
      handleMovePhotoStage(task, 'uploaded');
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return safarTasks.filter(t => {
      const pStage = getPhotoStage(t);
      const isPUp = pStage === 'uploaded';
      const isVUp = t.stage === 'upload' || t.stage === 'jameya' || t.stage === 'completed';

      // 1. Core Photo Stage Filter
      if (filter === 'edited' && pStage !== 'edited') return false;
      if (filter === 'given_to_murtaza' && pStage !== 'given_to_murtaza') return false;
      if (filter === 'uploaded' && !isPUp) return false;

      // 2. Deliverables Cross-Sync Sub-Filter
      if (syncFilter === 'both_uploaded' && !(isPUp && isVUp)) return false;
      if (syncFilter === 'photo_only' && !(isPUp && !isVUp)) return false;
      if (syncFilter === 'video_only' && !(!isPUp && isVUp)) return false;
      if (syncFilter === 'both_pending' && !(!isPUp && !isVUp)) return false;

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const str = `${t.dateFolder} ${t.hijriDate || ''} ${t.photoEditorName || ''}`.toLowerCase();
        if (!str.includes(query)) return false;
      }
      return true;
    });
  }, [safarTasks, filter, syncFilter, search]);

  // Group filtered tasks for kanban columns
  const filteredColumnTasks = useMemo(() => {
    const map: Record<PhotoStage, PhotoTaskItem[]> = {
      edited: [],
      given_to_murtaza: [],
      uploaded: []
    };
    for (const t of filteredTasks) {
      const st = getPhotoStage(t);
      if (map[st]) map[st].push(t);
      else map['edited'].push(t);
    }
    return map;
  }, [filteredTasks]);

  return (
    <section className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Notice Banner */}
      {notice && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.2s ease' }}>
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed' }}>
              <Camera size={12} style={{ display: 'inline', marginRight: '4px' }} /> Photo Data Tracker
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: '#EEF2FF', color: '#4338CA' }}>
              Lead Photo Editor: <strong>{DEFAULT_PHOTO_EDITOR}</strong>
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: '#ECFDF5', color: '#047857' }}>
              WA: +91 {DEFAULT_WHATSAPP_PHONE}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
            Photo Pipeline & Delivery Tracker
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
            Track photo deliverables from Edited to Given To Murtaza to Uploaded. When marked Uploaded, changes instantly sync across both Photo & Safar Trackers.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {safarNames.length > 1 && (
            <select
              value={selectedSafar}
              onChange={e => handleSafarChange(e.target.value)}
              style={{ fontSize: '12px', fontWeight: 700, padding: '7px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', cursor: 'pointer' }}
            >
              {safarNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          )}

          {/* Toggle view mode */}
          <div style={{ display: 'flex', background: '#F1F5F9', padding: '2px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              style={{
                border: 'none',
                background: viewMode === 'kanban' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'kanban' ? '#0F172A' : '#64748B',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
              title="Kanban 3-Stage Pipeline View"
            >
              <Kanban size={13} />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                border: 'none',
                background: viewMode === 'grid' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'grid' ? '#0F172A' : '#64748B',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
              title="Card Grid View"
            >
              <LayoutGrid size={13} />
              <span>Grid</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadPhotoStatus}
            disabled={loading}
            style={{ fontSize: '12px', fontWeight: 700, padding: '7px 14px', borderRadius: '10px', background: '#4F46E5', color: '#FFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Sync Drive</span>
          </button>

          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            style={{ padding: '7px 10px', borderRadius: '10px', background: '#F1F5F9', border: '1px solid #E2E8F0', cursor: 'pointer', color: '#475569' }}
            title="Configure Google Apps Script URL"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Photo Pipeline KPI & Multi-Color Stage Progress Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>
              {selectedSafar} Photo Progress
            </span>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              ({uploadedCount} of {totalCount} dates uploaded)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong style={{ fontSize: '18px', fontWeight: 800, color: '#059669' }}>
              {photoPercent}%
            </strong>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
              Photos Delivered
            </span>
          </div>
        </div>

        {/* 3-Stage Photo Pipeline Bar */}
        <div className="photo-progress-bar" role="progressbar" aria-label="Photo stage progress">
          {editedCount > 0 && (
            <span
              className="photo-stage-segment stage-photo-edited"
              style={{ width: `${(editedCount / (totalCount || 1)) * 100}%` }}
              title={`Stage 1: Edited: ${editedCount} dates (${Math.round((editedCount / (totalCount || 1)) * 100)}%)`}
            />
          )}
          {murtazaCount > 0 && (
            <span
              className="photo-stage-segment stage-photo-murtaza"
              style={{ width: `${(murtazaCount / (totalCount || 1)) * 100}%` }}
              title={`Stage 2: Given To Murtaza: ${murtazaCount} dates (${Math.round((murtazaCount / (totalCount || 1)) * 100)}%)`}
            />
          )}
          {uploadedCount > 0 && (
            <span
              className="photo-stage-segment stage-photo-uploaded"
              style={{ width: `${(uploadedCount / (totalCount || 1)) * 100}%` }}
              title={`Stage 3: Uploaded: ${uploadedCount} dates (${Math.round((uploadedCount / (totalCount || 1)) * 100)}%)`}
            />
          )}
        </div>

        {/* Stage Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '11px', fontWeight: 700 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#7C3AED' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B5CF6' }} />
            <AnimatedNumber value={editedCount} /> In Editing
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#1D4ED8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6' }} />
            <AnimatedNumber value={murtazaCount} /> Given To Murtaza
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#047857' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
            <AnimatedNumber value={uploadedCount} /> Uploaded
          </span>
        </div>
      </div>

      {/* Category Pills, Sync Filter, and Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        {/* Core 4 Categories: All, Edited, Given to Murtaza, Uploaded */}
        <div className="photo-category-tabs" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All', count: totalCount },
            { id: 'edited', label: 'In Editing', count: editedCount, dot: '#8b5cf6' },
            { id: 'given_to_murtaza', label: 'Given To Murtaza', count: murtazaCount, dot: '#3b82f6' },
            { id: 'uploaded', label: 'Uploaded', count: uploadedCount, dot: '#10b981' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                try { if ('vibrate' in navigator) navigator.vibrate(10) } catch {}
                setFilter(tab.id as any);
              }}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: filter === tab.id ? '#0f172a' : 'transparent',
                color: filter === tab.id ? '#ffffff' : '#64748b',
                boxShadow: filter === tab.id ? '0 2px 6px rgba(15, 23, 42, 0.2)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.dot && <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: tab.dot }} />}
              <span>{tab.label}</span>
              <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '999px', background: filter === tab.id ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)', color: filter === tab.id ? '#ffffff' : '#334155' }}>
                <AnimatedNumber value={tab.count} />
              </span>
            </button>
          ))}
        </div>

        {/* Deliverables Cross-Sync Dropdown & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', maxWidth: '520px' }}>
          <select
            value={syncFilter}
            onChange={e => setSyncFilter(e.target.value as any)}
            title="Filter by Photo & Video cross-sync status"
            style={{
              padding: '7px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              maxWidth: '240px'
            }}
          >
            <option value="all">Deliverables: All Sync States</option>
            <option value="both_uploaded">✓ Both Uploaded ({crossStatusCounts.bothUp})</option>
            <option value="photo_only">📷 Photo Up · 🎬 Video Pend ({crossStatusCounts.photoOnly})</option>
            <option value="video_only">🎬 Video Up · 📷 Photo Pend ({crossStatusCounts.videoOnly})</option>
            <option value="both_pending">⏳ Both Pending ({crossStatusCounts.bothPend})</option>
          </select>

          <div style={{ position: 'relative', minWidth: '170px', flex: 1 }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="search"
              placeholder="Search date folder..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', fontSize: '13px', padding: '8px 12px 8px 32px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Main Content: Kanban Columns or Grid */}
      {filteredTasks.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
          No date folders match the selected filter.
        </div>
      ) : viewMode === 'kanban' ? (
        <>
          {/* Mobile Stage Switcher for Photo Kanban */}
          <div className="mobile-kanban-stage-tabs" role="tablist" aria-label="Photo stages">
            {PHOTO_COLUMNS.map(col => {
              const count = (filteredColumnTasks[col.id] || []).length;
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
                    const el = document.getElementById(`photo-col-${col.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                  }}
                >
                  <span className="mobile-stage-dot" style={{ backgroundColor: col.color }} />
                  <span className="mobile-stage-name">
                    {col.id === 'edited' ? 'Edited' : col.id === 'given_to_murtaza' ? 'To Murtaza' : 'Uploaded'}
                  </span>
                  <span className="mobile-stage-count"><AnimatedNumber value={count} /></span>
                </button>
              );
            })}
          </div>

          <div className="kanban-board-grid">
            {PHOTO_COLUMNS.map(col => {
              const list = filteredColumnTasks[col.id] || [];
              return (
                <div
                  key={col.id}
                  id={`photo-col-${col.id}`}
                  className="kanban-column"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    minHeight: '440px'
                  }}
                >
                {/* Column Header */}
                <div style={{ padding: '12px 16px', background: col.headerBg, borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                      {col.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>
                      {col.subtitle}
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, background: col.badgeBg, color: col.color, padding: '2px 8px', borderRadius: '999px' }}>
                    {list.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', maxHeight: '620px' }}>
                  {list.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                      No date folders in this stage
                    </div>
                  ) : (
                    list.map(task => {
                      const isPhotoUp = getPhotoStage(task) === 'uploaded';
                      const isVideoUp = task.stage === 'upload' || task.stage === 'jameya' || task.stage === 'completed';

                      return (
                        <div
                          key={task.id}
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}
                        >
                          {/* Folder Name & Cross Status Badge */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                            <div>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', display: 'block' }}>
                                {task.dateFolder}
                              </span>
                              {task.hijriDate && (
                                <span style={{ fontSize: '11px', color: '#64748B' }}>
                                  {task.hijriDate}
                                </span>
                              )}
                            </div>

                            {/* Remove button */}
                            {onRemoveTask && (
                              <button
                                type="button"
                                title="Exclude date"
                                onClick={() => {
                                  if (window.confirm(`Exclude "${task.dateFolder}" from tracking?`)) {
                                    onRemoveTask(task);
                                  }
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px 4px' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {/* Cross-Status Visual Chip */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                            {isPhotoUp && isVideoUp ? (
                              <span className="media-sync-badge both-uploaded" title="Both Photo & Video Uploaded">
                                <CheckCircle2 size={11} /> ✓ Both Uploaded
                              </span>
                            ) : isPhotoUp && !isVideoUp ? (
                              <span className="media-sync-badge photo-only" title="Photo Uploaded by Muffadal Peti · Video Pending">
                                <Camera size={11} /> Photo Up · Video Pend
                              </span>
                            ) : !isPhotoUp && isVideoUp ? (
                              <span className="media-sync-badge video-only" title="Video Uploaded by Murtaza · Photo Pending">
                                <Film size={11} /> Video Up · Photo Pend
                              </span>
                            ) : (
                              <span className="media-sync-badge both-pending" title="Both Photo & Video Pending Upload">
                                <Clock size={11} /> Both Pending
                              </span>
                            )}

                            {/* Quick Upload Checkbox */}
                            <label
                              title="Click to toggle Uploaded for both Photo & Video"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: (isPhotoUp && isVideoUp) ? '#059669' : '#64748B' }}
                            >
                              <input
                                type="checkbox"
                                checked={isPhotoUp && isVideoUp}
                                onChange={() => handleToggleUpload(task)}
                              />
                              <span>{isPhotoUp && isVideoUp ? 'Uploaded' : 'Upload'}</span>
                            </label>
                          </div>

                          {/* Editor Assignments */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', background: '#FFFFFF', padding: '6px 8px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                            <span>Photo: <strong style={{ color: '#7C3AED' }}>{task.photoEditorName || DEFAULT_PHOTO_EDITOR}</strong></span>
                            <span>Video: <strong style={{ color: '#0F172A' }}>{task.editorName || DEFAULT_VIDEO_EDITOR}</strong></span>
                          </div>

                          {/* Stage Transition Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '6px', borderTop: '1px solid #F1F5F9' }}>
                            {col.id === 'edited' && (
                              <button
                                type="button"
                                className="photo-stage-advance-btn"
                                onClick={() => handleMovePhotoStage(task, 'given_to_murtaza')}
                                style={{ width: '100%', fontSize: '12px', fontWeight: 700, minHeight: '42px', padding: '8px 12px', borderRadius: '10px', background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                              >
                                <span>Hand to Murtaza</span>
                                <ArrowRight size={13} />
                              </button>
                            )}

                            {col.id === 'given_to_murtaza' && (
                              <>
                                <button
                                  type="button"
                                  className="photo-stage-prev-btn"
                                  onClick={() => handleMovePhotoStage(task, 'edited')}
                                  style={{ fontSize: '12px', fontWeight: 600, minHeight: '42px', padding: '8px 12px', borderRadius: '10px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <ArrowLeft size={13} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="photo-stage-advance-btn"
                                  onClick={() => handleMovePhotoStage(task, 'uploaded')}
                                  style={{ flex: 1, fontSize: '12px', fontWeight: 700, minHeight: '42px', padding: '8px 12px', borderRadius: '10px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                  <UploadCloud size={13} />
                                  <span>Mark Uploaded</span>
                                </button>
                              </>
                            )}

                            {col.id === 'uploaded' && (
                              <button
                                type="button"
                                className="photo-stage-prev-btn"
                                onClick={() => handleMovePhotoStage(task, 'given_to_murtaza')}
                                style={{ width: '100%', fontSize: '12px', fontWeight: 600, minHeight: '42px', padding: '8px 12px', borderRadius: '10px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                              >
                                <ArrowLeft size={13} />
                                <span>Revert to Murtaza</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      ) : (
        /* Card Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {filteredTasks.map(task => {
            const photoStage = getPhotoStage(task);
            const isPhotoUp = photoStage === 'uploaded';
            const isVideoUp = task.stage === 'upload' || task.stage === 'jameya' || task.stage === 'completed';

            return (
              <div
                key={task.id}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                      {task.dateFolder}
                    </span>
                    {task.hijriDate && (
                      <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>
                        {task.hijriDate}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: photoStage === 'uploaded' ? '#ECFDF5' : photoStage === 'given_to_murtaza' ? '#EEF2FF' : '#F5F3FF', color: photoStage === 'uploaded' ? '#047857' : photoStage === 'given_to_murtaza' ? '#1D4ED8' : '#7C3AED' }}>
                    {photoStage === 'uploaded' ? 'Uploaded' : photoStage === 'given_to_murtaza' ? 'Given To Murtaza' : 'Edited'}
                  </span>
                </div>

                {/* Cross-Status Visual Chip */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                  {isPhotoUp && isVideoUp ? (
                    <span className="media-sync-badge both-uploaded" title="Both Photo & Video Uploaded">
                      <CheckCircle2 size={12} /> ✓ Both Uploaded
                    </span>
                  ) : isPhotoUp && !isVideoUp ? (
                    <span className="media-sync-badge photo-only" title="Photo Uploaded by Muffadal Peti · Video Pending">
                      <Camera size={12} /> Photo Up · Video Pend
                    </span>
                  ) : !isPhotoUp && isVideoUp ? (
                    <span className="media-sync-badge video-only" title="Video Uploaded by Murtaza · Photo Pending">
                      <Film size={12} /> Video Up · Photo Pend
                    </span>
                  ) : (
                    <span className="media-sync-badge both-pending" title="Both Photo & Video Pending Upload">
                      <Clock size={12} /> Both Pending
                    </span>
                  )}

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: (isPhotoUp && isVideoUp) ? '#059669' : '#64748B' }}>
                    <input
                      type="checkbox"
                      checked={isPhotoUp && isVideoUp}
                      onChange={() => handleToggleUpload(task)}
                    />
                    <span>{isPhotoUp && isVideoUp ? 'Uploaded' : 'Upload'}</span>
                  </label>
                </div>

                {/* Editors */}
                <div style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', display: 'grid', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Photo Editor:</span>
                    <strong style={{ color: '#7C3AED' }}>{task.photoEditorName || DEFAULT_PHOTO_EDITOR}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Video Lead:</span>
                    <strong style={{ color: '#0F172A' }}>{task.editorName || DEFAULT_VIDEO_EDITOR}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Video Stage:</span>
                    <strong style={{ color: isVideoUp ? '#059669' : '#D97706' }}>{task.stage}</strong>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {photoStage !== 'uploaded' ? (
                      <button
                        type="button"
                        onClick={() => handleMovePhotoStage(task, 'uploaded')}
                        style={{ fontSize: '11px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: '#059669', color: '#FFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <UploadCloud size={13} />
                        <span>Mark Uploaded</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={13} />
                        Uploaded & Synced
                      </span>
                    )}

                    {photoStage === 'edited' && (
                      <button
                        type="button"
                        onClick={() => handleMovePhotoStage(task, 'given_to_murtaza')}
                        style={{ fontSize: '11px', fontWeight: 600, padding: '6px 10px', borderRadius: '8px', background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', cursor: 'pointer' }}
                      >
                        Hand to Murtaza
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GS URL Config Modal */}
      {isConfigOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '440px', background: '#FFF', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Google Apps Script Configuration</h3>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Web App URL</label>
              <input
                type="url"
                value={gsUrlInput}
                onChange={e => setGsUrlInput(e.target.value)}
                style={{ width: '100%', fontSize: '12px', padding: '8px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontFamily: 'monospace' }}
              />
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', background: '#F8FAFC', padding: '10px', borderRadius: '10px' }}>
              WhatsApp recipient: <strong>+91 {DEFAULT_WHATSAPP_PHONE}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setIsConfigOpen(false)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer', fontSize: '12px' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setGsUrl(gsUrlInput);
                  setIsConfigOpen(false);
                  loadPhotoStatus();
                }}
                style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', background: '#4F46E5', color: '#FFF', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
