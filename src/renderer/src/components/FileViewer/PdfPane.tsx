import React, { useState, useEffect } from 'react'

interface PdfPaneProps {
  base64: string | null
  filePath: string
  loading?: boolean
}

export default function PdfPane({ base64, filePath, loading }: PdfPaneProps): JSX.Element {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!base64) return
    try {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setBlobUrl(url)
      return () => {
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Failed to parse PDF bytes:', err)
      return undefined
    }
  }, [base64])

  const openInSystemApp = () => {
    const api = (window as any).api
    if (api?.viewer?.openExternal) {
      api.viewer.openExternal(filePath)
    } else if (api?.shell?.openExternal) {
      api.shell.openExternal(`file:///${filePath.replace(/\\/g, '/')}`)
    }
  }

  const printPdf = () => {
    if (blobUrl) {
      const printWin = window.open(blobUrl)
      printWin?.print()
    } else {
      window.print()
    }
  }

  if (loading || !blobUrl) {
    return (
      <div className="fv-center">
        <div className="fv-pdf-skeleton">
          <div className="fv-skeleton-shimmer" />
        </div>
        <span style={{ marginTop: 12, opacity: 0.6 }}>Rendering PDF Document…</span>
      </div>
    )
  }

  return (
    <div className="fv-pdf-wrap">
      {/* PDF Sub-Toolbar */}
      <div className="fv-pdf-toolbar">
        <div className="fv-pdf-status">
          <span className="fv-pdf-badge">PDF DOCUMENT</span>
          <span className="fv-pdf-hint">Standard Adobe PDF Object Stream</span>
        </div>

        <div className="fv-pdf-actions">
          <button className="fv-pdf-btn" onClick={printPdf} title="Print Document">
            🖨 Print
          </button>
          <button
            className="fv-pdf-btn"
            onClick={() => {
              if (blobUrl) {
                const a = document.createElement('a')
                a.href = blobUrl
                a.download = filePath.replace(/\\/g, '/').split('/').pop() || 'document.pdf'
                a.click()
              }
            }}
            title="Download PDF Copy"
          >
            ⬇ Download
          </button>
          <button className="fv-pdf-btn" onClick={openInSystemApp} title="Open in Adobe Acrobat or Default App">
            ↗ Open in Acrobat
          </button>
        </div>
      </div>

      {/* Embedded PDF View */}
      <embed
        className="fv-pdf-embed"
        src={`${blobUrl}#toolbar=1&navpanes=1`}
        type="application/pdf"
        title="PDF Preview"
      />
    </div>
  )
}
