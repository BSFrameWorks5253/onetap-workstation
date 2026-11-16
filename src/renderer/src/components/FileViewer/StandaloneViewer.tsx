import React, { useState, useEffect, useCallback } from 'react'
import FileViewer, { fileBasename } from './FileViewer'
import './FileViewer.css'

function getFilePathFromHash(): string {
  try {
    const hash = window.location.hash
    const queryIndex = hash.indexOf('?')
    if (queryIndex !== -1) {
      const params = new URLSearchParams(hash.slice(queryIndex + 1))
      const f = params.get('file')
      if (f) return decodeURIComponent(f)
    }
  } catch {}
  return ''
}

export default function StandaloneViewer(): JSX.Element {
  const [filePath, setFilePath] = useState<string>(getFilePathFromHash)

  const parsePathFromHash = useCallback(() => {
    const path = getFilePathFromHash()
    if (path) {
      setFilePath(path)
      document.title = `${fileBasename(path)} — One Tap Studio Viewer`
    }
  }, [])

  useEffect(() => {
    parsePathFromHash()
    window.addEventListener('hashchange', parsePathFromHash)
    return () => window.removeEventListener('hashchange', parsePathFromHash)
  }, [parsePathFromHash])

  const handleClose = () => {
    window.close()
  }

  if (!filePath) {
    return (
      <div className="fv-standalone-empty">
        <div className="fv-spinner" />
        <span>Opening document in separate viewer…</span>
      </div>
    )
  }

  return (
    <div className="fv-standalone-root">
      {/* Universal Standalone Desktop Viewer Window */}
      <FileViewer
        filePath={filePath}
        onClose={handleClose}
        isStandaloneWindow={true}
      />
    </div>
  )
}
