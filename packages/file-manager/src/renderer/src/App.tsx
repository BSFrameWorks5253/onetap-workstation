import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Folder, File, HardDrive, ChevronRight, ChevronDown, Home, Plus, Search, RefreshCw, ExternalLink, Copy, FolderOpen, ArrowLeft, ArrowRight } from 'lucide-react'

const api = (window as any).fmApi

interface FsEntry { name: string; isDir: boolean; size: number; mtime: number; ext: string; fullPath: string }

function formatSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(2) + ' GB'
}

function formatDate(mtime: number): string {
  if (!mtime) return '—'
  const d = new Date(mtime)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getIcon(entry: FsEntry) {
  if (entry.isDir) return <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
  const imgExts = ['jpg','jpeg','png','gif','webp','bmp']
  const vidExts = ['mp4','mov','mkv','avi','m4v','ts']
  const docExts = ['pdf','doc','docx','txt','md','xlsx','csv']
  if (imgExts.includes(entry.ext)) return <File className="w-4 h-4 text-emerald-400 flex-shrink-0" />
  if (vidExts.includes(entry.ext)) return <File className="w-4 h-4 text-purple-400 flex-shrink-0" />
  if (docExts.includes(entry.ext)) return <File className="w-4 h-4 text-blue-400 flex-shrink-0" />
  return <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
}

function suggestFolderNames(siblingFolders: FsEntry[]): string[] {
  // Detect Safar naming pattern: "1447-08 Mumbai", "2024-09 Surat"
  const safarPattern = /^(\d{4})[\s-_](\d{1,2})[\s-_]+([A-Za-z].+)$/
  const matches = siblingFolders
    .filter(f => f.isDir && safarPattern.test(f.name))
    .map(f => { const m = f.name.match(safarPattern)!; return { year: parseInt(m[1]), month: parseInt(m[2]), city: m[3].trim() } })
  if (matches.length === 0) return []
  const maxMonth = Math.max(...matches.map(m => m.month))
  const lastEntry = matches.find(m => m.month === maxMonth)!
  const nextMonth = maxMonth + 1
  const suggestions = [
    `${lastEntry.year}-${String(nextMonth).padStart(2,'0')} ${lastEntry.city}`,
    `${lastEntry.year}-${String(nextMonth).padStart(2,'0')} [City]`,
  ]
  return suggestions
}

export default function App() {
  const [drives, setDrives] = useState<string[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<FsEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<{x:number,y:number,entry:FsEntry}|null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [copyFeedback, setCopyFeedback] = useState<string|null>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getDrives().then(setDrives)
    api.getDeepLinkPath().then((p: string|null) => {
      if (p) navigate(p)
    })
    api.onNavigate?.((p: string) => navigate(p))
  }, [])

  const navigate = useCallback(async (path: string) => {
    setLoading(true)
    setSearch('')
    const entries = await api.listDir(path)
    setEntries(entries)
    setCurrentPath(path)
    setSelected(null)
    setHistory(prev => { const next = [...prev.slice(0, historyIdx+1), path]; setHistoryIdx(next.length-1); return next })
    setLoading(false)
  }, [historyIdx])

  const goBack = () => { if (historyIdx > 0) { const prev = history[historyIdx-1]; setHistoryIdx(h=>h-1); loadPath(prev) }}
  const goForward = () => { if (historyIdx < history.length-1) { const next = history[historyIdx+1]; setHistoryIdx(h=>h+1); loadPath(next) }}
  
  const loadPath = async (path: string) => {
    setLoading(true); setSearch('')
    const e = await api.listDir(path)
    setEntries(e); setCurrentPath(path); setSelected(null); setLoading(false)
  }

  const breadcrumbs = currentPath.replace(/\\/g, '/').split('/').filter(Boolean)

  const filteredEntries = search ? entries.filter(e => e.name.toLowerCase().includes(search.toLowerCase())) : entries

  const openNewFolder = () => {
    setSuggestions(suggestFolderNames(entries))
    setNewFolderName('')
    setShowNewFolder(true)
    setTimeout(() => newFolderInputRef.current?.focus(), 80)
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    await api.createFolder(currentPath, newFolderName.trim())
    setShowNewFolder(false)
    loadPath(currentPath)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopyFeedback('Copied!')
    setTimeout(() => setCopyFeedback(null), 1500)
  }

  const buildBreadcrumbPath = (idx: number): string => {
    const parts = currentPath.replace(/\\/g, '/').split('/').filter(Boolean)
    return parts.slice(0, idx+1).join('/') + '/'
  }

  return (
    <div className="flex flex-col h-screen bg-[#0D0F14] text-gray-200 select-none" onClick={() => setContextMenu(null)}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#161921]">
        <button onClick={goBack} disabled={historyIdx<=0} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30"><ArrowLeft className="w-4 h-4" /></button>
        <button onClick={goForward} disabled={historyIdx>=history.length-1} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30"><ArrowRight className="w-4 h-4" /></button>
        <button onClick={() => loadPath(currentPath)} className="p-1.5 rounded hover:bg-white/10"><RefreshCw className="w-4 h-4" /></button>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto text-sm">
          <button onClick={() => setCurrentPath('')} className="hover:text-white"><Home className="w-3.5 h-3.5" /></button>
          {breadcrumbs.map((seg, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="w-3 h-3 text-gray-600" />
              <button onClick={() => loadPath(buildBreadcrumbPath(i))} className="hover:text-white whitespace-nowrap max-w-[160px] truncate">{seg}</button>
            </React.Fragment>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-1 text-sm focus:outline-none focus:border-indigo-500" />
        </div>
        <button onClick={openNewFolder} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-lg text-indigo-300 text-sm">
          <Plus className="w-3.5 h-3.5" /><span>New Folder</span>
        </button>
        {copyFeedback && <span className="text-emerald-400 text-xs">{copyFeedback}</span>}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-white/10 bg-[#131519] overflow-y-auto flex flex-col">
          <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Drives</div>
          {drives.map(d => (
            <button key={d} onClick={() => navigate(d)} className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 ${currentPath.startsWith(d) ? 'text-indigo-300 bg-indigo-500/10' : 'text-gray-300'}`}>
              <HardDrive className="w-4 h-4 text-gray-500" />{d}
            </button>
          ))}
          <div className="mt-4 px-3 pb-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Quick Nav</div>
          {entries.filter(e=>e.isDir).slice(0,20).map(e => (
            <button key={e.fullPath} onClick={() => navigate(e.fullPath)} className="flex items-center gap-2 px-4 py-1.5 text-xs hover:bg-white/5 text-gray-400 hover:text-gray-200">
              <Folder className="w-3.5 h-3.5 text-amber-400/70" /><span className="truncate">{e.name}</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-2">
          {!currentPath ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <HardDrive className="w-16 h-16 mb-4 opacity-30" />
              <p>Select a drive to browse</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase border-b border-white/10">
                  <th className="text-left py-1.5 px-2 font-medium">Name</th>
                  <th className="text-right py-1.5 px-2 font-medium w-24">Size</th>
                  <th className="text-right py-1.5 px-2 font-medium w-44">Modified</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(e => (
                  <tr
                    key={e.fullPath}
                    onClick={() => setSelected(e.fullPath)}
                    onDoubleClick={() => e.isDir ? navigate(e.fullPath) : api.openExternal(e.fullPath)}
                    onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setContextMenu({x:ev.clientX,y:ev.clientY,entry:e}) }}
                    className={`cursor-pointer hover:bg-white/5 rounded ${ selected===e.fullPath ? 'bg-indigo-500/10 text-indigo-200' : '' }`}
                  >
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-2">
                        {getIcon(e)}
                        <span className="truncate max-w-[400px]">{e.name}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-400 tabular-nums">{e.isDir ? '—' : formatSize(e.size)}</td>
                    <td className="py-1.5 px-2 text-right text-gray-400 tabular-nums">{formatDate(e.mtime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10 bg-[#161921] text-[11px] text-gray-500">
        <span>{filteredEntries.length} items</span>
        {selected && <span className="truncate max-w-[500px]">{selected}</span>}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#1e2029] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px]"
          style={{top: contextMenu.y, left: contextMenu.x}}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.entry.isDir ? (
            <button onClick={() => { navigate(contextMenu.entry.fullPath); setContextMenu(null) }} className="flex items-center gap-2 px-3 py-2 w-full hover:bg-white/10 text-sm">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />Open
            </button>
          ) : (
            <button onClick={() => { api.openExternal(contextMenu.entry.fullPath); setContextMenu(null) }} className="flex items-center gap-2 px-3 py-2 w-full hover:bg-white/10 text-sm">
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />Open
            </button>
          )}
          <button onClick={() => { api.openInExplorer(contextMenu.entry.fullPath); setContextMenu(null) }} className="flex items-center gap-2 px-3 py-2 w-full hover:bg-white/10 text-sm">
            <FolderOpen className="w-3.5 h-3.5 text-gray-400" />Show in Explorer
          </button>
          <button onClick={() => { copyToClipboard(contextMenu.entry.fullPath); setContextMenu(null) }} className="flex items-center gap-2 px-3 py-2 w-full hover:bg-white/10 text-sm">
            <Copy className="w-3.5 h-3.5 text-gray-400" />Copy Path
          </button>
        </div>
      )}

      {/* New Folder modal */}
      {showNewFolder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowNewFolder(false)}>
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-[440px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">New Folder</h3>
            <input
              ref={newFolderInputRef}
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter') createFolder(); if (e.key==='Escape') setShowNewFolder(false) }}
              placeholder="Folder name..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 mb-3"
            />
            {suggestions.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] text-gray-500 mb-1.5">Recommended names:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => setNewFolderName(s)} className="px-2.5 py-1 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg text-indigo-300 text-xs">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <button onClick={() => setShowNewFolder(false)} className="px-4 py-2 rounded-lg text-sm hover:bg-white/10">Cancel</button>
              <button onClick={createFolder} disabled={!newFolderName.trim()} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
