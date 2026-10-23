import React, { useState, useEffect, useRef } from 'react'
import { useSound } from '../SoundProvider'
import type { PageKey } from '../../types'
import './GlobalDropOverlay.css'

interface FormatCount {
  raw: number
  video: number
  audio: number
  photo: number
  project: number
  data: number
  folders: number
  total: number
}

const RAW_EXTS = new Set(['arw', 'cr2', 'cr3', 'nef', 'raf', 'dng', 'rw2', 'orf', 'srw', 'pef'])
const VIDEO_EXTS = new Set(['mp4', 'mov', 'mkv', 'mxf', 'avi', 'm4v', 'webm', 'braw', 'prores', 'mts', 'm2ts', 'r3d'])
const AUDIO_EXTS = new Set(['wav', 'mp3', 'aac', 'm4a', 'flac', 'aif', 'aiff', 'ogg', 'wma'])
const PHOTO_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'tif', 'tiff', 'psd', 'bmp', 'svg'])
const PROJECT_EXTS = new Set(['prproj', 'aep', 'xml', 'edl', 'fcpxml', 'drp'])
const DATA_EXTS = new Set(['xlsx', 'xls', 'csv', 'tsv', 'json', 'pdf', 'txt'])

const FILE_ACCEPTING_PAGES = new Set<string>([
  'adder',
  'converter',
  'cameratransfer',
  'videotransfer',
  'pvseparator',
  'cleaner',
  'folder',
  'prproj',
  'utilities',
  'excelmerger',
  'archivevault'
])

export default function GlobalDropOverlay({ activePage }: { activePage?: PageKey }): JSX.Element | null {
  const { playTick } = useSound()
  const [isDragging, setIsDragging] = useState(false)
  const [counts, setCounts] = useState<FormatCount>({
    raw: 0,
    video: 0,
    audio: 0,
    photo: 0,
    project: 0,
    data: 0,
    folders: 0,
    total: 0
  })

  const dragCounter = useRef(0)

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      // Only activate if the active page accepts files/folders
      if (activePage && !FILE_ACCEPTING_PAGES.has(activePage)) {
        return
      }

      e.preventDefault()
      dragCounter.current += 1

      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        setIsDragging(true)
        playTick()

        // Inspect dragged items if available
        const items = e.dataTransfer.items
        const newCounts: FormatCount = {
          raw: 0,
          video: 0,
          audio: 0,
          photo: 0,
          project: 0,
          data: 0,
          folders: 0,
          total: 0
        }

        if (items && items.length > 0) {
          newCounts.total = items.length
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.kind === 'file') {
              const file = item.getAsFile?.()
              if (file && file.name) {
                const parts = file.name.split('.')
                const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : ''
                if (ext) {
                  if (RAW_EXTS.has(ext)) newCounts.raw++
                  else if (VIDEO_EXTS.has(ext)) newCounts.video++
                  else if (AUDIO_EXTS.has(ext)) newCounts.audio++
                  else if (PHOTO_EXTS.has(ext)) newCounts.photo++
                  else if (PROJECT_EXTS.has(ext)) newCounts.project++
                  else if (DATA_EXTS.has(ext)) newCounts.data++
                } else {
                  newCounts.folders++
                }
              } else {
                // If getAsFile is unavailable in dragover, count general item
                if (item.type.startsWith('video/')) newCounts.video++
                else if (item.type.startsWith('audio/')) newCounts.audio++
                else if (item.type.startsWith('image/')) newCounts.photo++
                else newCounts.folders++
              }
            }
          }
        }
        setCounts(newCounts)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current -= 1
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsDragging(false)
      }
    }

    const handleDrop = () => {
      dragCounter.current = 0
      setIsDragging(false)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [playTick, activePage])

  if (!isDragging || (activePage && !FILE_ACCEPTING_PAGES.has(activePage))) return null

  const hasPills =
    counts.raw > 0 ||
    counts.video > 0 ||
    counts.audio > 0 ||
    counts.photo > 0 ||
    counts.project > 0 ||
    counts.data > 0 ||
    counts.folders > 0

  return (
    <div className="g-drop-overlay">
      <div className="g-drop-card">
        <div className="g-drop-icon-wrap">
          <span>📥</span>
        </div>
        <h3 className="g-drop-title">Drop to Ingest & Process</h3>
        <p className="g-drop-subtitle">
          Release your files or folders to load them into the active tool
        </p>

        <div className="g-drop-pills-container">
          {counts.raw > 0 && (
            <span className="g-drop-pill g-drop-pill--raw">
              📷 {counts.raw} Camera RAW
            </span>
          )}
          {counts.video > 0 && (
            <span className="g-drop-pill g-drop-pill--video">
              🎬 {counts.video} Video Footage
            </span>
          )}
          {counts.audio > 0 && (
            <span className="g-drop-pill g-drop-pill--audio">
              🎵 {counts.audio} Audio Track{counts.audio > 1 ? 's' : ''}
            </span>
          )}
          {counts.photo > 0 && (
            <span className="g-drop-pill g-drop-pill--photo">
              🖼️ {counts.photo} Photo{counts.photo > 1 ? 's' : ''}
            </span>
          )}
          {counts.project > 0 && (
            <span className="g-drop-pill g-drop-pill--project">
              📁 {counts.project} Premiere Project{counts.project > 1 ? 's' : ''}
            </span>
          )}
          {counts.data > 0 && (
            <span className="g-drop-pill g-drop-pill--data">
              📊 {counts.data} Data / Sheet{counts.data > 1 ? 's' : ''}
            </span>
          )}
          {counts.folders > 0 && (
            <span className="g-drop-pill g-drop-pill--folder">
              📂 {counts.folders} Folder{counts.folders > 1 ? 's' : ''}
            </span>
          )}
          {!hasPills && counts.total > 0 && (
            <span className="g-drop-pill g-drop-pill--folder">
              📦 {counts.total} Item{counts.total > 1 ? 's' : ''} Ready
            </span>
          )}
          {!hasPills && counts.total === 0 && (
            <span className="g-drop-pill g-drop-pill--folder">
              ✨ Ready to Ingest
            </span>
          )}
        </div>

        <div className="g-drop-hint">
          <span>⚡ Automatic multi-core processing active</span>
        </div>
      </div>
    </div>
  )
}
