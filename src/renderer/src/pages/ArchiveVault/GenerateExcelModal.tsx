import React, { useState, useEffect, useMemo } from 'react'
import type { ScannedArchive } from '../../types'
import { SafarSearchSelect } from '../../components/SafarSearchSelect'
import { DateSearchSelect, ArchiveDateItem } from '../../components/DateSearchSelect'

const api = typeof window !== 'undefined' ? (window as any).api : null

export interface GenerateExcelModalProps {
  isOpen: boolean
  onClose: () => void
  safars: ScannedArchive[]
  initialSafarId?: number | 'all' | null
  onLoadIntoReconciler: (filePath: string, safarId: number | null) => void
  playTick: () => void
  playSuccess: () => void
  playError: () => void
  showToast: (opts: { title: string; message: string; type: 'success' | 'warning' | 'danger' | 'info' }) => void
}

interface FolderNode {
  id: number
  relative_path: string
  folder_name: string
  event_code?: string
  session_name?: string
  mp4_count?: number
  photo_count?: number
}

export const GenerateExcelModal: React.FC<GenerateExcelModalProps> = ({
  isOpen,
  onClose,
  safars,
  initialSafarId,
  onLoadIntoReconciler,
  playTick,
  playSuccess,
  playError,
  showToast
}) => {
  // Source Mode: 'safar' (already scanned in DB) vs 'external' (folder on disk/hard drive)
  const [sourceMode, setSourceMode] = useState<'safar' | 'external'>('safar')

  // Safar selection state
  const [selectedSafarId, setSelectedSafarId] = useState<number | null>(() => {
    if (typeof initialSafarId === 'number') return initialSafarId
    return safars.length > 0 ? safars[0].id : null
  })

  // External folder path (e.g. newly arrived hard drive folder)
  const [externalFolderPath, setExternalFolderPath] = useState<string>('')

  // Date filter state
  const [availableDates, setAvailableDates] = useState<ArchiveDateItem[]>([])
  const [isLoadingDates, setIsLoadingDates] = useState(false)
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('')

  // Scope: 'entire' or 'folder' (for Safar mode)
  const [scope, setScope] = useState<'entire' | 'folder'>('entire')
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('')
  const [folderSearch, setFolderSearch] = useState<string>('')

  // Generation status state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedResult, setGeneratedResult] = useState<{
    filePath: string
    totalRows: number
    safarId: number | null
    sourceLabel: string
  } | null>(null)

  // Sync initial Safar on open
  useEffect(() => {
    if (isOpen) {
      setGeneratedResult(null)
      setSelectedDateFilter('')
      if (typeof initialSafarId === 'number') {
        setSelectedSafarId(initialSafarId)
      } else if (safars.length > 0 && !selectedSafarId) {
        setSelectedSafarId(safars[0].id)
      }
    }
  }, [isOpen, initialSafarId, safars])

  // Fetch dates when selected Safar changes
  useEffect(() => {
    if (!isOpen || !selectedSafarId || sourceMode !== 'safar') return
    const fetchDates = async () => {
      if (!api?.archiveCatalog?.listDates) return
      setIsLoadingDates(true)
      try {
        const res = await api.archiveCatalog.listDates(selectedSafarId)
        if (res && res.success) {
          setAvailableDates(res.dates || [])
        }
      } catch (err) {
        console.error('Failed to list dates:', err)
      } finally {
        setIsLoadingDates(false)
      }
    }
    fetchDates()
  }, [isOpen, selectedSafarId, sourceMode])

  // Fetch folders when selected Safar changes and scope is 'folder'
  useEffect(() => {
    if (!isOpen || !selectedSafarId || scope !== 'folder' || sourceMode !== 'safar') return
    const fetchFolders = async () => {
      if (!api?.archiveCatalog?.listFolders) return
      setIsLoadingFolders(true)
      try {
        const res = await api.archiveCatalog.listFolders(selectedSafarId)
        if (res && res.success) {
          setFolders(res.folders || [])
          if (res.folders?.length > 0 && !selectedFolderPath) {
            setSelectedFolderPath(res.folders[0].relative_path)
          }
        }
      } catch (err) {
        console.error('Failed to list folders:', err)
      } finally {
        setIsLoadingFolders(false)
      }
    }
    fetchFolders()
  }, [isOpen, selectedSafarId, scope, sourceMode])

  const currentSafar = useMemo(() => {
    return safars.find((s) => s.id === selectedSafarId) || null
  }, [safars, selectedSafarId])

  const filteredFolderList = useMemo(() => {
    const q = folderSearch.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((f) => {
      const relMatch = f.relative_path.toLowerCase().includes(q)
      const nameMatch = f.folder_name.toLowerCase().includes(q)
      const evMatch = f.event_code?.toLowerCase().includes(q)
      return relMatch || nameMatch || evMatch
    })
  }, [folders, folderSearch])

  const handleBrowseExternalFolder = async () => {
    playTick()
    if (!api?.dialog?.openFolder) {
      showToast({ title: 'Dialog Error', message: 'Folder picker dialog is unavailable.', type: 'danger' })
      return
    }
    try {
      const folder = await api.dialog.openFolder({
        title: 'Select Folder from Hard Drive to Generate Excel Audit Sheet'
      })
      if (folder) {
        setExternalFolderPath(folder)
      }
    } catch (err: any) {
      showToast({ title: 'Picker Error', message: err.message || String(err), type: 'danger' })
    }
  }

  if (!isOpen) return null

  const handleGenerate = async () => {
    playTick()

    if (sourceMode === 'safar') {
      if (!selectedSafarId) {
        showToast({ title: 'Select a Safar', message: 'Please select a scanned Safar from the dropdown.', type: 'warning' })
        return
      }
      if (!api?.archiveCatalog?.generateSafarExcel) {
        showToast({ title: 'Not Supported', message: 'Excel generation API is not available.', type: 'warning' })
        return
      }

      setIsGenerating(true)
      try {
        const folderArg = scope === 'folder' && selectedFolderPath ? selectedFolderPath : undefined
        const cleanSafarName = (currentSafar?.safar_name || 'Safar').replace(/[\\/:*?"<>|]/g, '_')
        const cleanFolderSuffix = folderArg ? `_${folderArg.split(/[/\\]/).pop()}` : ''
        const dateSuffix = selectedDateFilter ? `_${selectedDateFilter.replace(/[\\/:*?"<>| ]/g, '_')}` : ''
        const defaultName = `${cleanSafarName}${cleanFolderSuffix}${dateSuffix}_Audit_Sheet.xlsx`

        const res = await api.archiveCatalog.generateSafarExcel({
          archiveId: selectedSafarId,
          defaultName,
          folderPath: folderArg,
          dateFilter: selectedDateFilter || undefined
        })

        if (res && res.success && res.filePath) {
          playSuccess()
          setGeneratedResult({
            filePath: res.filePath,
            totalRows: res.total_rows || 0,
            safarId: selectedSafarId,
            sourceLabel: currentSafar?.safar_name || 'Safar'
          })
          showToast({
            title: 'Excel Generated 📊',
            message: `Generated ${res.total_rows || 0} rows from ${currentSafar?.safar_name}. Ready for Reconciler!`,
            type: 'success'
          })
        } else if (res && !res.canceled) {
          playError()
          showToast({ title: 'Generation Failed', message: res.error || 'Could not generate Excel spreadsheet.', type: 'danger' })
        }
      } catch (err: any) {
        playError()
        showToast({ title: 'Generation Error', message: err.message || String(err), type: 'danger' })
      } finally {
        setIsGenerating(false)
      }
    } else {
      // External hard drive folder mode
      if (!externalFolderPath) {
        showToast({ title: 'Select Folder', message: 'Please browse and select the external hard drive folder.', type: 'warning' })
        return
      }

      const generateFn =
        api?.archiveCatalog?.generateExternalFolderExcel ||
        (api?.archiveCatalog?.generateSafarExcel
          ? (params: any) => api.archiveCatalog.generateSafarExcel({ archiveId: 0, ...params })
          : null)

      if (!generateFn) {
        showToast({
          title: 'Reload App (Ctrl+R)',
          message: 'Please press Ctrl+R in the app to reload the window and activate the newly compiled audit generator.',
          type: 'warning'
        })
        return
      }

      setIsGenerating(true)
      try {
        const folderBase = externalFolderPath.split(/[/\\]/).filter(Boolean).pop() || 'HardDrive_Folder'
        const dateSuffix = selectedDateFilter ? `_${selectedDateFilter.replace(/[\\/:*?"<>| ]/g, '_')}` : ''
        const defaultName = `${folderBase}${dateSuffix}_Audit_Sheet.xlsx`

        const res = await generateFn({
          folderPath: externalFolderPath,
          defaultName,
          dateFilter: selectedDateFilter || undefined
        })

        if (res && res.success && res.filePath) {
          playSuccess()
          setGeneratedResult({
            filePath: res.filePath,
            totalRows: res.total_rows || 0,
            safarId: selectedSafarId || (safars.length > 0 ? safars[0].id : null),
            sourceLabel: folderBase
          })
          showToast({
            title: 'External Folder Excel Generated 📊',
            message: `Crawled and indexed ${res.total_rows || 0} clips from ${folderBase}. Ready for Reconciler!`,
            type: 'success'
          })
        } else if (res && !res.canceled) {
          playError()
          showToast({ title: 'Generation Failed', message: res.error || 'Could not generate external Excel sheet.', type: 'danger' })
        }
      } catch (err: any) {
        playError()
        showToast({ title: 'Generation Error', message: err.message || String(err), type: 'danger' })
      } finally {
        setIsGenerating(false)
      }
    }
  }

  const handleSendToReconciler = () => {
    playTick()
    if (!generatedResult) return
    onLoadIntoReconciler(generatedResult.filePath, generatedResult.safarId)
    onClose()
  }

  const handleRevealFile = async () => {
    playTick()
    if (!generatedResult?.filePath || !api?.archiveCatalog?.locateFile) return
    await api.archiveCatalog.locateFile(generatedResult.filePath)
  }

  return (
    <div className="vault-modal-overlay" onClick={onClose}>
      <div
        className="vault-modal-card"
        style={{ maxWidth: '660px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="vault-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📊</span>
            <div>
              <h3 className="vault-modal-title">Generate Workstation Audit Excel</h3>
              <p className="vault-modal-sub">
                Generate an official Excel sheet (.xlsx) from a scanned Safar or a newly arrived hard drive folder, then audit it in the Reconciler.
              </p>
            </div>
          </div>
          <button className="vault-modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="vault-modal-body">
          {generatedResult ? (
            /* SUCCESS STATE */
            <div className="vault-excel-success-card">
              <div className="vault-excel-success-icon">✅</div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#0F172A' }}>
                Audit Spreadsheet Ready!
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
                Successfully cataloged <strong>{generatedResult.totalRows.toLocaleString()} files</strong> from{' '}
                <strong>{generatedResult.sourceLabel}</strong> with full Date, Folder, File, Event, Duration, and Size columns.
              </p>

              <div className="vault-excel-path-preview">
                📄 {generatedResult.filePath}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                <button
                  className="vault-btn vault-btn-primary"
                  style={{ padding: '12px 18px', fontSize: '14px', justifyContent: 'center' }}
                  onClick={handleSendToReconciler}
                >
                  🚀 Upload & Open in Excel Reconciler
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="vault-btn vault-btn-ghost"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={handleRevealFile}
                  >
                    📂 Show in File Explorer
                  </button>
                  <button
                    className="vault-btn vault-btn-ghost"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={onClose}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* FORM STATE */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Source Selection Tabs */}
              <div style={{ display: 'flex', gap: '10px', background: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
                <button
                  type="button"
                  className={`vault-scope-pill-btn ${sourceMode === 'safar' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    playTick()
                    setSourceMode('safar')
                  }}
                >
                  🏛️ Scanned Safar in App
                </button>
                <button
                  type="button"
                  className={`vault-scope-pill-btn ${sourceMode === 'external' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    playTick()
                    setSourceMode('external')
                  }}
                >
                  💽 Folder on Hard Drive (New / Missing Data)
                </button>
              </div>

              {sourceMode === 'safar' ? (
                /* SAFAR MODE */
                <>
                  {/* Step 1: Select Safar strictly from dropdown */}
                  <div className="vault-mapping-row">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>1. Select Target Scanned Safar:</span>
                      <span style={{ fontSize: '11px', color: '#0284C7', fontWeight: 600 }}>
                        🔍 Searchable by Safar Name, Year & City
                      </span>
                    </label>
                    <SafarSearchSelect
                      safars={safars}
                      selectedId={selectedSafarId}
                      onSelect={(id) => {
                        playTick()
                        if (typeof id === 'number') {
                          setSelectedSafarId(id)
                          setSelectedFolderPath('')
                          setSelectedDateFilter('')
                        }
                      }}
                      placeholder="Choose or search Safar..."
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Safar KPI Badges */}
                  {currentSafar && (
                    <div className="vault-safar-summary-pill">
                      <span>🏛️ <strong>{currentSafar.safar_name}</strong></span>
                      {currentSafar.safar_year && <span>• 📅 Year: {currentSafar.safar_year}</span>}
                      {currentSafar.city && (
                        <span title={currentSafar.city === 'Unassigned' ? 'Location: Unassigned (City not detected in folder name)' : `City: ${currentSafar.city}`}>
                          • 📍 {currentSafar.city === 'Unassigned' ? 'Unassigned City' : currentSafar.city}
                        </span>
                      )}
                      <span>• 📁 {currentSafar.total_files?.toLocaleString()} total files</span>
                    </div>
                  )}

                  {/* Optional Date Filter Dropdown */}
                  <div className="vault-mapping-row">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Optional Date Filter:</span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        Filter clips by canonical date session
                      </span>
                    </label>
                    <DateSearchSelect
                      dates={availableDates}
                      selectedDate={selectedDateFilter}
                      onSelect={(dt) => {
                        playTick()
                        setSelectedDateFilter(dt)
                      }}
                      loading={isLoadingDates}
                      placeholder="All Dates (No filter)"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Step 2: Generation Scope */}
                  <div className="vault-mapping-row">
                    <label>Export Scope:</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className={`vault-scope-pill-btn ${scope === 'entire' ? 'active' : ''}`}
                        onClick={() => {
                          playTick()
                          setScope('entire')
                        }}
                      >
                        🌐 Entire Safar (All Folders & Files)
                      </button>
                      <button
                        type="button"
                        className={`vault-scope-pill-btn ${scope === 'folder' ? 'active' : ''}`}
                        onClick={() => {
                          playTick()
                          setScope('folder')
                        }}
                      >
                        📁 Specific Subfolder Only
                      </button>
                    </div>
                  </div>

                  {/* Step 2b: Folder Dropdown if scope == folder */}
                  {scope === 'folder' && (
                    <div className="vault-mapping-row" style={{ background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1.5px solid #E2E8F0' }}>
                      <label>Select Subfolder to Export:</label>
                      {isLoadingFolders ? (
                        <div style={{ fontSize: '12px', color: '#64748B', padding: '8px' }}>
                          ⏳ Loading folder nodes...
                        </div>
                      ) : folders.length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#EF4444', padding: '8px' }}>
                          No subfolders recorded for this Safar.
                        </div>
                      ) : (
                        <div>
                          <input
                            type="text"
                            placeholder="Filter subfolder path or event code..."
                            value={folderSearch}
                            onChange={(e) => setFolderSearch(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid #CBD5E1',
                              marginBottom: '8px',
                              fontSize: '12.5px'
                            }}
                          />
                          <select
                            className="vault-safar-select"
                            style={{ width: '100%' }}
                            value={selectedFolderPath}
                            onChange={(e) => {
                              playTick()
                              setSelectedFolderPath(e.target.value)
                            }}
                          >
                            {filteredFolderList.map((f) => (
                              <option key={f.id} value={f.relative_path}>
                                {f.relative_path} {f.event_code ? `[${f.event_code}]` : ''} ({f.mp4_count || 0} vids, {f.photo_count || 0} photos)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* EXTERNAL HARD DRIVE FOLDER MODE */
                <>
                  <div className="vault-mapping-row">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Select Folder on Hard Drive:</span>
                      <span style={{ fontSize: '11px', color: '#0284C7', fontWeight: 600 }}>
                        Crawls external drive & extracts metadata
                      </span>
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        readOnly
                        placeholder="Click browse to select hard drive folder..."
                        value={externalFolderPath}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1.5px solid #CBD5E1',
                          background: '#F8FAFC',
                          fontSize: '13px',
                          color: '#0F172A',
                          fontFamily: 'monospace'
                        }}
                      />
                      <button
                        type="button"
                        className="vault-btn vault-btn-primary"
                        onClick={handleBrowseExternalFolder}
                        style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}
                      >
                        📁 Browse Folder...
                      </button>
                    </div>
                  </div>

                  {/* Optional Date Filter for external folder */}
                  <div className="vault-mapping-row">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Optional Date Folder Filter:</span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        e.g. 1448-02-14 or session name
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1448-02-14 or _01M (Leave blank for entire folder)..."
                      value={selectedDateFilter}
                      onChange={(e) => setSelectedDateFilter(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  {/* Target Safar to reconcile with afterwards */}
                  <div className="vault-mapping-row" style={{ background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1.5px solid #E2E8F0' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span>Target Safar in App to Reconcile With:</span>
                      <span style={{ fontSize: '11px', color: '#0284C7', fontWeight: 600 }}>
                        Auto-assigned in Reconciler
                      </span>
                    </label>
                    <SafarSearchSelect
                      safars={safars}
                      selectedId={selectedSafarId}
                      onSelect={(id) => {
                        playTick()
                        if (typeof id === 'number') setSelectedSafarId(id)
                      }}
                      placeholder="Select target Safar..."
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}

              {/* Info Note */}
              <div style={{
                background: '#F0F9FF',
                border: '1.5px solid #BAE6FD',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#0369A1',
                lineHeight: 1.5
              }}>
                💡 <strong>Pre-formatted for Reconciliation:</strong> The generated Excel contains standardized columns (<code>Date</code>, <code>Folder</code>, <code>File</code>, <code>Event</code>, <code>Duration</code>, <code>Size</code>) plus an official 34-event code reference sheet.
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="vault-btn vault-btn-ghost"
                  style={{ flex: 1 }}
                  onClick={onClose}
                  disabled={isGenerating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="vault-btn vault-btn-primary"
                  style={{ flex: 2, justifyContent: 'center' }}
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    (sourceMode === 'safar' ? !selectedSafarId : !externalFolderPath)
                  }
                >
                  {isGenerating ? '⏳ Generating Spreadsheet...' : '⚡ Generate Audit Excel (.xlsx)'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
