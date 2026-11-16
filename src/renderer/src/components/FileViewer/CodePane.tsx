import React, { useState, useMemo } from 'react'

interface CodePaneProps {
  content: string
  ext: string
  filePath?: string
}

export default function CodePane({ content, ext, filePath }: CodePaneProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState('')
  const [wordWrap, setWordWrap] = useState(false)
  const [copied, setCopied] = useState(false)

  const lines = useMemo(() => {
    return content.split(/\r?\n/)
  }, [content])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const matchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0
    const term = searchTerm.toLowerCase()
    let count = 0
    for (const line of lines) {
      let pos = 0
      const lower = line.toLowerCase()
      while ((pos = lower.indexOf(term, pos)) !== -1) {
        count++
        pos += term.length
      }
    }
    return count
  }, [lines, searchTerm])

  return (
    <div className="fv-code-container">
      {/* Code Header Bar */}
      <div className="fv-code-header">
        <div className="fv-code-meta-badge">
          <span className="fv-code-badge-ext">{ext.toUpperCase().replace('.', '') || 'TEXT'}</span>
          <span className="fv-code-badge-lines">{lines.length} lines</span>
          <span className="fv-code-badge-size">{(content.length / 1024).toFixed(1)} KB</span>
        </div>

        {/* Live Filter / Search */}
        <div className="fv-code-search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search in code (Ctrl + F)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <span className="fv-code-match-tag">
              {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>

        <div className="fv-code-actions">
          <button
            className={`fv-code-btn ${wordWrap ? 'active' : ''}`}
            onClick={() => setWordWrap(!wordWrap)}
            title="Toggle Word Wrap"
          >
            Wrap
          </button>
          <button
            className="fv-code-btn fv-code-copy-btn"
            onClick={copyToClipboard}
            title="Copy entire file content"
          >
            {copied ? '✓ Copied' : 'Copy All'}
          </button>
        </div>
      </div>

      {/* Code Scrollable Body with Line Numbers */}
      <div className={`fv-code-scroll ${wordWrap ? 'wrap' : 'nowrap'}`}>
        <table className="fv-code-table">
          <tbody>
            {lines.map((line, idx) => {
              const lineNum = idx + 1
              const hasMatch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase())

              return (
                <tr key={idx} className={`fv-code-row ${hasMatch ? 'has-match' : ''}`}>
                  <td className="fv-code-num" data-line={lineNum}>
                    {lineNum}
                  </td>
                  <td className="fv-code-content">
                    {searchTerm && hasMatch ? (
                      <HighlightText text={line} highlight={searchTerm} />
                    ) : (
                      line || '\u00A0'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) return <>{text}</>
  const parts: React.ReactNode[] = []
  const lower = text.toLowerCase()
  const lowerHighlight = highlight.toLowerCase()
  let lastIdx = 0

  let matchIdx = lower.indexOf(lowerHighlight, lastIdx)
  while (matchIdx !== -1) {
    if (matchIdx > lastIdx) {
      parts.push(text.slice(lastIdx, matchIdx))
    }
    parts.push(
      <mark key={matchIdx} className="fv-code-highlight">
        {text.slice(matchIdx, matchIdx + highlight.length)}
      </mark>
    )
    lastIdx = matchIdx + highlight.length
    matchIdx = lower.indexOf(lowerHighlight, lastIdx)
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }

  return <>{parts}</>
}
