import React, { useState, useEffect } from 'react'

interface HexRow {
  offset: string
  hex: string
  ascii: string
}

interface HexDumpPaneProps {
  filePath: string
  fileSize?: number
  ext?: string
}

export default function HexDumpPane({ filePath, fileSize, ext }: HexDumpPaneProps): JSX.Element {
  const [rows, setRows] = useState<HexRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    const api = (window as any).api
    if (!api?.viewer?.readHexDump) {
      setError('Hex inspector is not supported in this runtime.')
      setLoading(false)
      return
    }

    api.viewer
      .readHexDump(filePath, 4096)
      .then((res: any) => {
        if (!mounted) return
        if (res.ok && res.rows) {
          setRows(res.rows)
        } else {
          setError(res.error || 'Failed to inspect binary headers.')
        }
      })
      .catch((err: any) => {
        if (!mounted) return
        setError(err?.message || String(err))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [filePath])

  const copyHex = () => {
    const text = rows.map((r) => `${r.offset}  ${r.hex}  |${r.ascii}|`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openDefault = () => {
    const api = (window as any).api
    if (api?.viewer?.openExternal) {
      api.viewer.openExternal(filePath)
    } else if (api?.shell?.openExternal) {
      api.shell.openExternal(`file:///${filePath.replace(/\\/g, '/')}`)
    }
  }

  const revealInFolder = () => {
    const api = (window as any).api
    if (api?.viewer?.showItemInFolder) {
      api.viewer.showItemInFolder(filePath)
    }
  }

  return (
    <div className="fv-hex-wrap">
      {/* Overview Card */}
      <div className="fv-hex-header">
        <div className="fv-hex-title-group">
          <div className="fv-hex-icon">🔍</div>
          <div>
            <div className="fv-hex-title">Universal Binary Inspector</div>
            <div className="fv-hex-desc">
              Previewing raw header bytes and ASCII stream for format {ext?.toUpperCase() || 'UNKNOWN'}.
            </div>
          </div>
        </div>

        <div className="fv-hex-actions">
          <button className="fv-hex-action-btn" onClick={openDefault} title="Open in Windows Default App">
            ↗ Open in Default App
          </button>
          <button className="fv-hex-action-btn" onClick={revealInFolder} title="Reveal in File Explorer">
            📁 Reveal in Folder
          </button>
          <button className="fv-hex-action-btn" onClick={copyHex} title="Copy Hex Dump to clipboard">
            {copied ? '✓ Hex Copied' : 'Copy Hex'}
          </button>
        </div>
      </div>

      {/* Hex Stream Table */}
      <div className="fv-hex-body">
        {loading ? (
          <div className="fv-center">
            <div className="fv-spinner" />
            <span style={{ marginTop: 12, opacity: 0.7 }}>Reading file headers…</span>
          </div>
        ) : error ? (
          <div className="fv-center">
            <div className="fv-error-icon">⚠️</div>
            <div className="fv-error-msg">{error}</div>
            <button className="fv-btn" onClick={openDefault} style={{ marginTop: 12 }}>
              Open in Default App
            </button>
          </div>
        ) : (
          <div className="fv-hex-table-scroll">
            <table className="fv-hex-table">
              <thead>
                <tr>
                  <th className="fv-hex-th-offset">OFFSET</th>
                  <th className="fv-hex-th-bytes">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</th>
                  <th className="fv-hex-th-ascii">DECODED TEXT</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="fv-hex-td-offset">{row.offset}</td>
                    <td className="fv-hex-td-bytes">{row.hex}</td>
                    <td className="fv-hex-td-ascii">{row.ascii}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fileSize && fileSize > 4096 && (
              <div className="fv-hex-footer-note">
                Showing first 4,096 bytes of {(fileSize / 1024).toFixed(1)} KB total size.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
