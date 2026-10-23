import React, { useState } from 'react'
import { PAGE_META } from '../../types'
import { PageIcon } from '../../components/PageIcon'
import { useToast } from '../../components/Toast'
import './InventoryMerger.css'

const meta = PAGE_META['excelmerger']

interface MergeStats {
  missingCount: number
  folderColsCount: number
  cameraSummary: Record<string, { found: number; missing: number }>
  issueCount: number
}

export default function InventoryMerger(): JSX.Element {
  const { showToast } = useToast()
  
  const [file1, setFile1] = useState<string>('') // Video Inventory Report
  const [file2, setFile2] = useState<string>('') // Photo Inventory Report
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [mergedResult, setMergedResult] = useState<{ path: string; stats: MergeStats } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const api = (window as any).api

  // File 1: Video Inventory Report Picker
  const handlePickVideoReport = async () => {
    try {
      if (!api?.dialog?.openFile) {
        showToast({ message: 'Native file picker not available', type: 'error' })
        return
      }
      const res = await api.dialog.openFile({
        title: 'Select Video Inventory Report (.xlsx)',
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
      })
      
      const selected = typeof res === 'string' ? res : (res && res.filePaths ? res.filePaths[0] : null)
      if (selected) {
        setFile1(selected)
        setErrorMsg(null)
      }
    } catch (err: any) {
      showToast({ message: `Failed to select file: ${err.message}`, type: 'error' })
    }
  }

  // File 2: Photo Inventory Report Picker
  const handlePickPhotoReport = async () => {
    try {
      if (!api?.dialog?.openFile) {
        showToast({ message: 'Native file picker not available', type: 'error' })
        return
      }
      const res = await api.dialog.openFile({
        title: 'Select Photo Inventory Report (.xlsx)',
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
      })

      const selected = typeof res === 'string' ? res : (res && res.filePaths ? res.filePaths[0] : null)
      if (selected) {
        setFile2(selected)
        setErrorMsg(null)
      }
    } catch (err: any) {
      showToast({ message: `Failed to select file: ${err.message}`, type: 'error' })
    }
  }

  const handleLoadDemoFiles = async () => {
    try {
      const demo1 = 'Scratch\\2 Excel which are for Joint\\1448-03-01 _01M_Inventory_Report.xlsx'
      const demo2 = 'Scratch\\2 Excel which are for Joint\\1448-03-01 _02E_Inventory_Report.xlsx'
      setFile1(demo1)
      setFile2(demo2)
      setErrorMsg(null)
      showToast({ message: 'Loaded sample Video & Photo Inventory files', type: 'info' })
    } catch (err: any) {
      showToast({ message: 'Failed to load demo files', type: 'error' })
    }
  }

  const handleMerge = async () => {
    if (!file1 || !file2) {
      showToast({ message: 'Please select both Video Inventory and Photo Inventory reports.', type: 'warning' })
      return
    }

    setIsProcessing(true)
    setErrorMsg(null)
    setMergedResult(null)

    try {
      if (!api?.inventoryMerger?.merge) {
        throw new Error('inventoryMerger API is missing.')
      }

      const res = await api.inventoryMerger.merge({
        file1: file1.trim(),
        file2: file2.trim()
      })

      if (res.success) {
        setMergedResult({
          path: res.outputPath,
          stats: res.stats
        })
        showToast({ message: 'Successfully merged Video & Photo inventory reports!', type: 'success' })
      } else {
        setErrorMsg(res.error || 'Failed to merge inventory reports.')
        showToast({ message: res.error || 'Merge failed', type: 'error' })
      }
    } catch (err: any) {
      const msg = err.message || 'Error executing merge'
      setErrorMsg(msg)
      showToast({ message: msg, type: 'error' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOpenFile = (filePath: string) => {
    if (api?.shell?.openFolder) {
      api.shell.openFolder(filePath)
    } else {
      showToast({ message: `Cannot open file: ${filePath}`, type: 'info' })
    }
  }

  // Drag & drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetFileNum: 1 | 2) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const path = (e.dataTransfer.files[0] as any).path || e.dataTransfer.files[0].name
      if (path) {
        if (targetFileNum === 1) setFile1(path)
        else setFile2(path)
        setErrorMsg(null)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="im-page anim-fade-in">
      {/* Header Banner */}
      <div className="im-hero-banner">
        <div className="im-hero-left">
          <div className="im-hero-icon">
            <PageIcon pageKey="excelmerger" size={26} color="#10B981" />
          </div>
          <div className="im-hero-text">
            <h1 className="im-hero-title">{meta.label}</h1>
            <p className="im-hero-sub">Merge Video Inventory & Photo Inventory reports into a single joint Excel file</p>
          </div>
        </div>
        <button className="im-btn-demo" onClick={handleLoadDemoFiles} title="Load Scratch/2 Excel sample files" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Load Demo Files</span>
        </button>
      </div>

      {/* Main Pickers Card */}
      <div className="im-card">
        <div className="im-card-title">
          <span className="im-card-step-badge">STEP 1 & 2</span>
          <h2>Select Inventory Reports to Merge</h2>
        </div>

        <div className="im-grid-2">
          {/* File 1: Video Inventory Report */}
          <div
            className={`im-picker-box ${file1 ? 'active' : ''}`}
            onDrop={(e) => handleDrop(e, 1)}
            onDragOver={handleDragOver}
          >
            <div className="im-picker-header">
              <div className="im-num-circle">1</div>
              <div className="im-picker-meta">
                <span className="im-picker-label">Video Inventory Report</span>
                <span className="im-picker-sub">Primary video session workbook (e.g. _01M)</span>
              </div>
            </div>
            <div className="im-input-wrapper">
              <input
                type="text"
                className="im-input"
                placeholder="Click Browse or drag & drop Video Report (.xlsx)..."
                value={file1}
                onChange={(e) => setFile1(e.target.value)}
              />
              {file1 && (
                <button className="im-btn-clear" onClick={() => setFile1('')} title="Clear file selection" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
              <button className="im-btn-browse" onClick={handlePickVideoReport}>
                Browse...
              </button>
            </div>
          </div>

          {/* File 2: Photo Inventory Report */}
          <div
            className={`im-picker-box ${file2 ? 'active' : ''}`}
            onDrop={(e) => handleDrop(e, 2)}
            onDragOver={handleDragOver}
          >
            <div className="im-picker-header">
              <div className="im-num-circle">2</div>
              <div className="im-picker-meta">
                <span className="im-picker-label">Photo Inventory Report</span>
                <span className="im-picker-sub">Secondary photo session workbook (e.g. _02E)</span>
              </div>
            </div>
            <div className="im-input-wrapper">
              <input
                type="text"
                className="im-input"
                placeholder="Click Browse or drag & drop Photo Report (.xlsx)..."
                value={file2}
                onChange={(e) => setFile2(e.target.value)}
              />
              {file2 && (
                <button className="im-btn-clear" onClick={() => setFile2('')} title="Clear file selection" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
              <button className="im-btn-browse" onClick={handlePickPhotoReport}>
                Browse...
              </button>
            </div>
          </div>
        </div>

        {/* Start Action Row */}
        <div className="im-action-area">
          <button
            className="im-btn-start"
            disabled={isProcessing || !file1 || !file2}
            onClick={handleMerge}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isProcessing ? (
              <>
                <span className="im-spinner" /> Merging Reports...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>Merge Inventory Reports</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="im-error-box" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Results Section */}
      {mergedResult && (
        <div className="im-card im-result-card anim-scale-in">
          <div className="im-result-header">
            <div className="im-success-pill">✓ MERGE SUCCESSFUL</div>
            <h2>Joint Inventory Report Created</h2>
          </div>

          <div className="im-path-row">
            <div className="im-path-badge">
              <span className="im-path-icon">📄</span>
              <span className="im-path-val">{mergedResult.path}</span>
            </div>
            <button className="im-btn-open-file" onClick={() => handleOpenFile(mergedResult.path)}>
              Open Excel File
            </button>
          </div>

          <div className="im-stats-row">
            <div className="im-stat-card">
              <span className="im-stat-num">{mergedResult.stats.folderColsCount}</span>
              <span className="im-stat-label">Merged Subfolders</span>
            </div>
            <div className="im-stat-card">
              <span className="im-stat-num warning">{mergedResult.stats.missingCount}</span>
              <span className="im-stat-label">Missing Files</span>
            </div>
            <div className="im-stat-card">
              <span className="im-stat-num info">{mergedResult.stats.issueCount}</span>
              <span className="im-stat-label">Notices & Issues</span>
            </div>
          </div>

          {Object.keys(mergedResult.stats.cameraSummary).length > 0 && (
            <div className="im-cam-section">
              <h3>Camera Summary Breakdown</h3>
              <div className="im-cam-grid">
                {Object.entries(mergedResult.stats.cameraSummary).map(([camName, cs]) => (
                  <div key={camName} className="im-cam-box">
                    <span className="im-cam-title">{camName}</span>
                    <div className="im-cam-vals">
                      <span className="found">Found: {cs.found}</span>
                      <span className="missing">Missing: {cs.missing}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
