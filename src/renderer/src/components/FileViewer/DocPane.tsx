import React, { useState } from 'react'

interface DocPaneProps {
  html?: string | null
  text?: string | null
  isLegacyDoc?: boolean
  fileName?: string
}

export default function DocPane({ html, text, isLegacyDoc, fileName }: DocPaneProps): JSX.Element {
  const [zoom, setZoom] = useState(100)
  const [pageWidth, setPageWidth] = useState<'standard' | 'wide'>('standard')

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fv-doc-wrapper">
      {/* Document Floating Control Bar */}
      <div className="fv-doc-toolbar">
        <div className="fv-doc-badge">
          <span className="fv-doc-format-tag">
            {isLegacyDoc ? 'Word 97-2003 (.doc)' : 'DOCX Reader'}
          </span>
          {fileName && <span className="fv-doc-filename">{fileName}</span>}
        </div>

        <div className="fv-doc-controls">
          <button
            className="fv-doc-btn"
            onClick={() => setZoom((z) => Math.max(50, z - 15))}
            title="Zoom Out"
          >
            −
          </button>
          <span className="fv-doc-zoom-val">{zoom}%</span>
          <button
            className="fv-doc-btn"
            onClick={() => setZoom((z) => Math.min(200, z + 15))}
            title="Zoom In"
          >
            +
          </button>
          <button
            className="fv-doc-btn"
            onClick={() => setZoom(100)}
            title="Reset Zoom"
          >
            100%
          </button>
          <div className="fv-doc-divider" />
          <button
            className={`fv-doc-btn ${pageWidth === 'wide' ? 'active' : ''}`}
            onClick={() => setPageWidth((w) => (w === 'standard' ? 'wide' : 'standard'))}
            title="Toggle Page Width"
          >
            {pageWidth === 'wide' ? 'Narrow' : 'Wide Page'}
          </button>
          <button
            className="fv-doc-btn fv-doc-print-btn"
            onClick={handlePrint}
            title="Print or Save as PDF"
          >
            🖨 Print
          </button>
        </div>
      </div>

      {/* Printable / Viewable Document Page */}
      <div className="fv-doc-scroll">
        <div
          className={`fv-doc-paper ${pageWidth}`}
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
        >
          {html ? (
            <div
              className="fv-doc-html-content"
              // biome-ignore lint: trusted HTML from mammoth/marked
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : text ? (
            <div className="fv-doc-text-content">
              {isLegacyDoc && (
                <div className="fv-doc-legacy-notice">
                  <span className="fv-doc-notice-icon">ℹ️</span>
                  <span>
                    Viewing extracted text from legacy binary Word (.doc) format. Layout elements and tables are simplified for clarity.
                  </span>
                </div>
              )}
              {text.split(/\n\n+/).map((para, i) => (
                <p key={i} className="fv-doc-paragraph">
                  {para}
                </p>
              ))}
            </div>
          ) : (
            <div className="fv-doc-empty">Empty Document</div>
          )}
        </div>
      </div>
    </div>
  )
}
