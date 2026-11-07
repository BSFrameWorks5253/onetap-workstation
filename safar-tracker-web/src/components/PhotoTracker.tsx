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
  Smartphone,
  Search,
  Settings,
  Check,
  AlertCircle
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

export default function PhotoTracker({
  tasks,
  safars,
  onUpdateTaskStage
}: {
  tasks: Array<{ id: string; safarName: string; dateFolder: string; stage: string }>;
  safars: Array<{ safarName: string }>;
  onUpdateTaskStage: (dateFolder: string, safarName: string, stage: string) => void;
}) {
  // Determine available Safars from Task Tracker
  const safarNames = useMemo(() => {
    const set = new Set<string>();
    safars.forEach(s => s.safarName && set.add(s.safarName));
    tasks.forEach(t => t.safarName && set.add(t.safarName));
    return Array.from(set);
  }, [safars, tasks]);

  const [selectedSafar, setSelectedSafar] = useState<string>(() => safarNames[0] || 'Active Safar');

  // Keep selection valid
  useEffect(() => {
    if (!safarNames.includes(selectedSafar) && safarNames.length > 0) {
      setSelectedSafar(safarNames[0]);
    }
  }, [safarNames, selectedSafar]);

  // Extract expected date folders from Task Tracker for this Safar (single source of truth!)
  const expectedDateFolders = useMemo(() => {
    const list = tasks
      .filter(t => t.safarName === selectedSafar)
      .map(t => t.dateFolder);
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [tasks, selectedSafar]);

  const [records, setRecords] = useState<PhotoDeliverable[]>([]);
  const [stats, setStats] = useState<PhotoStats>({ total: 0, uploadedCount: 0, downloadedCount: 0, pendingCount: 0, percentComplete: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'uploaded' | 'pending' | 'downloaded'>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [gsUrlInput, setGsUrlInput] = useState(() => getGsUrl());
  const [sendingAlert, setSendingAlert] = useState(false);

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

  // 1. Mark as Uploaded in Google Drive + System Tracker + Trigger WhatsApp Alert (+91 8369811201)
  const handleMarkUploaded = async (folderName: string) => {
    try {
      // A. Call Google Apps Script to tag Drive folder
      await markDriveFolderUploaded(selectedSafar, folderName, 'One Tap User', window.location.origin);

      // B. Update Task Tracker stage to upload
      onUpdateTaskStage(folderName, selectedSafar, 'upload');

      // C. Update local state
      setRecords(prev => prev.map(r => r.dateFolder === folderName ? { ...r, isUploaded: true, status: r.isDownloaded ? 'downloaded' : 'uploaded' } : r));

      const updatedUploaded = records.filter(r => r.isUploaded || r.dateFolder === folderName).length;
      const updatedPending = Math.max(0, records.length - updatedUploaded);

      // D. Send WhatsApp milestone notification
      await sendWhatsAppAlert({
        folderName,
        uploadedCount: updatedUploaded,
        pendingCount: updatedPending,
        websiteUrl: window.location.origin,
        phone: DEFAULT_WHATSAPP_PHONE
      });

      setNotice(`Folder ${folderName} marked uploaded in Google Drive & WhatsApp alert sent to +91 ${DEFAULT_WHATSAPP_PHONE}!`);
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      setNotice('Notice: ' + (err?.message || 'Updated locally'));
      setTimeout(() => setNotice(''), 3000);
    }
  };

  // 2. Mark as Downloaded
  const handleMarkDownloaded = async (folderName: string) => {
    try {
      await markDriveFolderDownloaded(selectedSafar, folderName, 'Studio Archive');
      setRecords(prev => prev.map(r => r.dateFolder === folderName ? { ...r, isDownloaded: true, status: 'downloaded' } : r));
      setNotice(`Folder ${folderName} marked as downloaded to studio storage.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {}
  };

  // 3. Manual WhatsApp Alert Dispatch
  const handleSendManualWhatsApp = async () => {
    setSendingAlert(true);
    try {
      const uploadedCount = records.filter(r => r.isUploaded).length;
      const pendingCount = Math.max(0, records.length - uploadedCount);
      const targetFolder = records.find(r => r.isUploaded)?.dateFolder || expectedDateFolders[0] || 'Latest Batch';

      const res = await sendWhatsAppAlert({
        folderName: targetFolder,
        uploadedCount,
        pendingCount,
        websiteUrl: window.location.origin,
        phone: DEFAULT_WHATSAPP_PHONE
      });

      setNotice(res?.success
        ? `WhatsApp milestone pushed to +91 ${DEFAULT_WHATSAPP_PHONE} (${uploadedCount} uploaded · ${pendingCount} pending)`
        : 'WhatsApp alert dispatched.');
      setTimeout(() => setNotice(''), 4000);
    } finally {
      setSendingAlert(false);
    }
  };

  // Filtered rows
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filter === 'uploaded' && !r.isUploaded) return false;
      if (filter === 'pending' && r.isUploaded) return false;
      if (filter === 'downloaded' && !r.isDownloaded) return false;
      if (search.trim() && !r.dateFolder.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [records, filter, search]);

  return (
    <section className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Notice Banner */}
      {notice && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '3px 8px', borderRadius: '6px', background: '#FFE4E6', color: '#BE123C' }}>
              Google Drive Photo Tracking
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: '#ECFDF5', color: '#047857' }}>
              WA: +91 {DEFAULT_WHATSAPP_PHONE}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
            Photo Data & Drive Sync
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
            Track date folder uploads in Google Drive and notify WhatsApp (+91 8369811201). Date deliverables derived from Task Tracker.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {safarNames.length > 1 && (
            <select
              value={selectedSafar}
              onChange={e => setSelectedSafar(e.target.value)}
              style={{ fontSize: '12px', fontWeight: 700, padding: '7px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A' }}
            >
              {safarNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          )}

          <button
            type="button"
            onClick={loadPhotoStatus}
            disabled={loading}
            style={{ fontSize: '12px', fontWeight: 700, padding: '7px 14px', borderRadius: '10px', background: '#4F46E5', color: '#FFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Sync with Drive</span>
          </button>

          <button
            type="button"
            onClick={handleSendManualWhatsApp}
            disabled={sendingAlert}
            style={{ fontSize: '12px', fontWeight: 700, padding: '7px 14px', borderRadius: '10px', background: '#059669', color: '#FFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: sendingAlert ? 0.6 : 1 }}
          >
            <MessageSquare size={14} />
            <span>WhatsApp Alert</span>
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

      {/* KPI Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <div style={{ padding: '14px', borderRadius: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Date Folders</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{stats.total || expectedDateFolders.length}</div>
        </div>
        <div style={{ padding: '14px', borderRadius: '14px', background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
          <span style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>Uploaded to Drive</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#065F46', marginTop: '4px' }}>{stats.uploadedCount}</div>
        </div>
        <div style={{ padding: '14px', borderRadius: '14px', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <span style={{ fontSize: '11px', color: '#B45309', fontWeight: 600 }}>Pending Upload</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#92400E', marginTop: '4px' }}>{stats.pendingCount || expectedDateFolders.length - stats.uploadedCount}</div>
        </div>
        <div style={{ padding: '14px', borderRadius: '14px', background: '#FAF5FF', border: '1px solid #E9D5FF' }}>
          <span style={{ fontSize: '11px', color: '#7E22CE', fontWeight: 600 }}>Downloaded</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#581C87', marginTop: '4px' }}>{stats.downloadedCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', padding: '3px', borderRadius: '12px' }}>
          {[
            { id: 'all', label: `All (${records.length})` },
            { id: 'uploaded', label: `Uploaded (${records.filter(r => r.isUploaded).length})` },
            { id: 'pending', label: `Pending (${records.filter(r => !r.isUploaded).length})` },
            { id: 'downloaded', label: `Downloaded (${records.filter(r => r.isDownloaded).length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '9px',
                border: 'none',
                cursor: 'pointer',
                background: filter === tab.id ? '#0F172A' : 'transparent',
                color: filter === tab.id ? '#FFFFFF' : '#64748B'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="search"
            placeholder="Search date folder..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', fontSize: '12px', padding: '7px 12px 7px 32px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none' }}
          />
        </div>
      </div>

      {/* Date Cards Grid */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
          Syncing Google Drive folders with Task Tracker dates...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
          No date folders found for {selectedSafar}. Check your Task Tracker scan.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {filtered.map(rec => (
            <div
              key={rec.dateFolder}
              style={{
                padding: '16px',
                borderRadius: '16px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'monospace', color: '#0F172A' }}>
                  {rec.dateFolder}
                </span>
                {rec.isUploaded ? (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: '#ECFDF5', color: '#065F46', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={13} />
                    Uploaded
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: '#FFFBEB', color: '#92400E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} />
                    Pending
                  </span>
                )}
              </div>

              {/* Status details */}
              <div style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', display: 'grid', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Google Drive:</span>
                  <strong style={{ color: rec.isUploaded ? '#059669' : '#D97706' }}>{rec.isUploaded ? '[UPLOADED] Tagged' : 'Awaiting upload'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Archive Vault:</span>
                  <strong style={{ color: rec.isDownloaded ? '#7E22CE' : '#64748B' }}>{rec.isDownloaded ? 'Downloaded' : 'Pending'}</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {!rec.isUploaded ? (
                    <button
                      type="button"
                      onClick={() => handleMarkUploaded(rec.dateFolder)}
                      style={{ fontSize: '11px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: '#059669', color: '#FFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <UploadCloud size={13} />
                      <span>Mark Uploaded</span>
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={13} />
                      Synced
                    </span>
                  )}

                  {!rec.isDownloaded && rec.isUploaded && (
                    <button
                      type="button"
                      onClick={() => handleMarkDownloaded(rec.dateFolder)}
                      style={{ fontSize: '11px', fontWeight: 600, padding: '6px 10px', borderRadius: '8px', background: '#F3E8FF', color: '#6B21A8', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Download size={13} />
                      <span>Downloaded</span>
                    </button>
                  )}
                </div>

                {rec.driveFolderUrl && (
                  <a
                    href={rec.driveFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#4F46E5', padding: '4px', display: 'flex', alignItems: 'center' }}
                    title="Open Google Drive folder"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            </div>
          ))}
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
