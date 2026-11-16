import React, { useState, useEffect, useMemo } from 'react'

interface SheetData {
  name: string
  data: string[][]
}

interface XlsxPaneProps {
  base64?: string
  textCsv?: string
  fileName?: string
}

export default function XlsxPane({ base64, textCsv, fileName }: XlsxPaneProps): JSX.Element {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        if (textCsv) {
          // Plain CSV / TSV text
          const lines = textCsv.split(/\r?\n/).filter((l) => l.trim().length > 0)
          const isTsv = fileName?.endsWith('.tsv')
          const delimiter = isTsv ? '\t' : ','
          const parsedData = lines.map((line) => {
            // Basic CSV splitter preserving quotes
            const row: string[] = []
            let inQuotes = false
            let current = ''
            for (let i = 0; i < line.length; i++) {
              const char = line[i]
              if (char === '"') {
                inQuotes = !inQuotes
              } else if (char === delimiter && !inQuotes) {
                row.push(current.trim())
                current = ''
              } else {
                current += char
              }
            }
            row.push(current.trim())
            return row
          })

          if (mounted) {
            setSheets([{ name: fileName || 'Sheet 1', data: parsedData }])
            setActiveIdx(0)
            setLoading(false)
          }
          return
        }

        if (base64) {
          const XLSX = await import('xlsx')
          const wb = XLSX.read(base64, { type: 'base64' })
          const parsed = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name]
            const data: string[][] = XLSX.utils.sheet_to_json(ws, {
              header: 1,
              defval: '',
              blankrows: false
            }) as string[][]
            return { name, data }
          })

          if (mounted) {
            setSheets(parsed)
            setActiveIdx(0)
            setLoading(false)
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Failed to parse spreadsheet')
          setLoading(false)
        }
      }
    })()

    return () => {
      mounted = false
    }
  }, [base64, textCsv, fileName])

  const activeSheet = sheets[activeIdx]
  const headers = activeSheet?.data[0] || []
  const allRows = useMemo(() => activeSheet?.data.slice(1) || [], [activeSheet])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return allRows
    const term = search.toLowerCase()
    return allRows.filter((row) =>
      row.some((cell) => String(cell || '').toLowerCase().includes(term))
    )
  }, [allRows, search])

  if (loading) {
    return (
      <div className="fv-center">
        <div className="fv-spinner" />
        <span style={{ marginTop: 12, opacity: 0.7 }}>Loading spreadsheet cells…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fv-center">
        <div className="fv-error-icon">⚠️</div>
        <div className="fv-error-msg">{error}</div>
      </div>
    )
  }

  if (!sheets.length || !activeSheet) {
    return <div className="fv-center">Empty spreadsheet</div>
  }

  return (
    <div className="fv-xlsx-wrap">
      {/* Top Header bar with tabs and search filter */}
      <div className="fv-xlsx-topbar">
        {/* Multi-sheet Tabs */}
        <div className="fv-xlsx-tabs">
          {sheets.map((s, i) => (
            <button
              key={s.name || i}
              className={`fv-xlsx-tab ${i === activeIdx ? 'active' : ''}`}
              onClick={() => {
                setActiveIdx(i)
                setSearch('')
              }}
            >
              <span className="fv-xlsx-tab-icon">📊</span>
              <span>{s.name}</span>
              <span className="fv-xlsx-tab-count">({Math.max(0, s.data.length - 1)})</span>
            </button>
          ))}
        </div>

        {/* Live Search and Row Count */}
        <div className="fv-xlsx-filter-group">
          <div className="fv-xlsx-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Filter cell contents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="fv-xlsx-search-clear" onClick={() => setSearch('')}>
                ✕
              </button>
            )}
          </div>

          <div className="fv-xlsx-counter">
            {search ? (
              <span>
                <b>{filteredRows.length}</b> of {allRows.length} rows
              </span>
            ) : (
              <span>
                <b>{allRows.length}</b> rows · <b>{headers.length}</b> cols
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Table with Sticky Header */}
      <div className="fv-xlsx-scroll">
        <table className="fv-xlsx-table">
          <thead>
            <tr>
              <th className="fv-row-num">#</th>
              {headers.map((h, i) => (
                <th key={i} title={String(h)}>
                  <div className="fv-th-inner">
                    <span className="fv-th-col-letter">{String.fromCharCode(65 + (i % 26))}</span>
                    <span className="fv-th-title">{String(h || `Col ${i + 1}`)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="fv-xlsx-empty-cell">
                  {search ? `No rows matching "${search}"` : 'No data in this sheet'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, ri) => (
                <tr key={ri} className="fv-xlsx-row">
                  <td className="fv-row-num">{ri + 1}</td>
                  {headers.map((_h, ci) => {
                    const cellVal = String(row[ci] ?? '')
                    const isMatch = search && cellVal.toLowerCase().includes(search.toLowerCase())
                    return (
                      <td key={ci} title={cellVal} className={isMatch ? 'fv-cell-match' : ''}>
                        {cellVal}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
