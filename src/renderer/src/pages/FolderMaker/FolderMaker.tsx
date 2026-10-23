import React, { useState, useEffect } from 'react'
import { Card, CardHeader } from '../../components/Card'
import { Button, GhostButton } from '../../components/Button'
import { BrowseRow, Input } from '../../components/Input'
import { StatusChip } from '../../components/StatCard'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import confetti from 'canvas-confetti'
import './FolderMaker.css'


const api  = (window as any).api

interface FolderNode {
  id: string
  name: string
  level: number
  children: FolderNode[]
  photographers: string[] // list of PCXX-NAME codes
}

interface Preset { name: string; structure: FolderNode[] }

let _id = Date.now()
function mkNode(name = '', level = 0): FolderNode {
  return { id: `n${_id++}`, name, level, children: [], photographers: [] }
}

const isSequencedName = (name: string): boolean => {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 3) return false
  const hasGlobalSeq = /^\d{3}$/.test(parts[0])
  const hasPrefix = ['MZ', 'Z', 'Q', 'MQ', 'BQ', 'BZ', 'N', 'AQ', 'ID', 'WAAZ'].includes(parts[1].toUpperCase())
  const hasPrefixSeq = /^\d{2}$/.test(parts[2])
  return hasGlobalSeq && hasPrefix && hasPrefixSeq
}

function flattenNodes(nodes: FolderNode[], collapsedIds: string[], depth = 0): { node: FolderNode; depth: number }[] {
  const result: { node: FolderNode; depth: number }[] = []
  for (const n of nodes) {
    result.push({ node: n, depth })
    if (!collapsedIds.includes(n.id)) {
      result.push(...flattenNodes(n.children, collapsedIds, depth + 1))
    }
  }
  return result
}

export default function FolderMaker(): JSX.Element {
  const { showToast } = useToast()
  const { playSuccess } = useSound()
  const [rootPath, setRootPath]   = useState('')
  const [structure, setStructure] = useState<FolderNode[]>([])
  const [presets, setPresets]     = useState<Preset[]>([])
  const [presetName, setPresetName] = useState('')
  const [result, setResult]       = useState<null | { success: boolean; error?: string }>(null)
  
  const [activeSeqNodeId, setActiveSeqNodeId] = useState<string | null>(null)
  const [seqCounts, setSeqCounts] = useState<Record<string, number>>({
    MZ: 0, Z: 0, Q: 0, MQ: 0, BQ: 0, BZ: 0, N: 0, AQ: 0, ID: 0, WAAZ: 0
  })
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<string[]>([])
  
  const toggleCollapse = (id: string) => {
    setCollapsedNodeIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }
  
  const [sideWidth, setSideWidth] = useState<number>(() => {
    const saved = localStorage.getItem('ot_foldermaker_width')
    return saved ? parseInt(saved, 10) : 340
  })

  const [panelAlign, setPanelAlign] = useState<'left' | 'right'>(() => {
    const saved = localStorage.getItem('ot_foldermaker_align')
    return (saved === 'left' || saved === 'right') ? saved : 'right'
  })

  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    localStorage.setItem('ot_foldermaker_width', String(sideWidth))
  }, [sideWidth])

  useEffect(() => {
    localStorage.setItem('ot_foldermaker_align', panelAlign)
  }, [panelAlign])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const startX = e.clientX
    const startWidth = sideWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = panelAlign === 'right'
        ? Math.max(260, Math.min(startWidth - deltaX, 600))
        : Math.max(260, Math.min(startWidth + deltaX, 600))
      setSideWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
  }
  
  // Photographers logic
  const [photoInput, setPhotoInput] = useState('')
  const [photoCodes, setPhotoCodes] = useState<string[]>([])
  
  // Quick Builder
  const [showQuickBuilder, setShowQuickBuilder] = useState(false)
  const [qbParents, setQbParents] = useState('')
  const [qbMap, setQbMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!api || !api.folderMaker) return
    api.folderMaker.getPresets().then((p: Preset[]) => setPresets(p))
    // Default structure
    setStructure([
      { id: `n${_id++}`, name: 'Project_Root', level: 0, children: [
        mkNode('Output', 1),
        mkNode('Assets', 1),
        mkNode('Archive', 1)
      ], photographers: [] }
    ])
  }, [])

  const flat = flattenNodes(structure, collapsedNodeIds)

  // ── Photographers ──────────────────────────────────────────
  function generateCodes(): void {
    const names = photoInput.split(',').map(n => n.trim().toUpperCase()).filter(Boolean)
    const codes = names.map((n, i) => `PC${String(i + 1).padStart(2, '0')}-${n}`)
    setPhotoCodes(codes)
  }

  // ── Tree Mutations ─────────────────────────────────────────
  function addSibling(id: string): void {
    setStructure(prev => addSiblingTo(prev, id))
  }
  function addChild(id: string): void {
    setStructure(prev => addChildTo(prev, id))
  }
  function removeNode(id: string): void {
    setStructure(prev => removeNodeFrom(prev, id))
  }
  function renameNode(id: string, name: string): void {
    setStructure(prev => renameNodeIn(prev, id, name))
  }
  function togglePhoto(nodeId: string, code: string): void {
    setStructure(prev => togglePhotoIn(prev, nodeId, code))
  }
  function duplicateNode(id: string): void {
    setStructure(prev => duplicateNodeIn(prev, id))
  }

  // ── Quick Builder ──────────────────────────────────────────
  function runQuickBuilder(): void {
    const parents = qbParents.split(',').map(p => p.trim()).filter(Boolean)
    const newRoot: FolderNode[] = parents.map(pName => {
      const childrenRaw = qbMap[pName] || ''
      const children = childrenRaw.split(',').map(c => c.trim()).filter(Boolean).map(cName => mkNode(cName, 1))
      return { ...mkNode(pName, 0), children }
    })
    setStructure(prev => [...prev, ...newRoot])
    setShowQuickBuilder(false)
    setQbParents('')
    setQbMap({})
  }

  // ── IO ─────────────────────────────────────────────────────
  async function create(): Promise<void> {
    setResult(null)
    if (!rootPath) return
    
    const structureToCreate = stripIds(structure)
    const res = await api.folderMaker.create({ rootPath, structure: structureToCreate })
    setResult(res)
    if (res.success) {
      playSuccess()
      confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } })
      showToast({
        title: 'Project Structure Created!',
        message: 'Successfully generated folder structure and template files.',
        type: 'success',
        badge: '📁 FOLDER MAKER',
        icon: '🗂',
        action: { label: '📂 Open Project', onClick: () => api.shell.openFolder(rootPath) }
      })
    }
  }

  async function savePreset(): Promise<void> {
    if (!presetName.trim()) return
    const p: Preset = { name: presetName.trim(), structure }
    await api.folderMaker.savePreset(p)
    setPresets(prev => [...prev.filter(x => x.name !== p.name), p])
    setPresetName('')
  }

  const isCreateDisabled = !rootPath || structure.length === 0

  // ── Main Column JSX ────────────────────────────────────────
  const mainCol = (
    <div className="fm-main-col">
      {/* Photographer Input */}
      <Card className="anim-scale-in">
        <CardHeader 
          title="👤 Photographers" 
          accent="var(--accent-folder)" 
          accentSoft="var(--accent-folder-soft)" 
          right={<StatusChip label={photoCodes.length > 0 ? `${photoCodes.length} Photographers` : 'No Photographers'} variant={photoCodes.length > 0 ? 'info' : 'muted'} />}
        />
        <div className="fm-card-body fm-row">
          <Input 
            placeholder="Comma separated names (e.g. Ali, Zara, Khalid)..." 
            value={photoInput} 
            onChange={e => setPhotoInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button variant="primary" accent="var(--accent-folder)" onClick={generateCodes}>Generate Codes</Button>
        </div>
        {photoCodes.length > 0 && (
          <div className="fm-codes-list">
            {photoCodes.map(c => <span key={c} className="fm-code-tag">{c}</span>)}
          </div>
        )}
      </Card>

      {/* Tree Builder */}
      <Card className="anim-scale-in">
        <CardHeader title="📁 Folder Structure Builder" accent="var(--accent-folder)" accentSoft="var(--accent-folder-soft)"
          right={
            <div className="fm-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <GhostButton size="sm" onClick={() => setPanelAlign(p => p === 'left' ? 'right' : 'left')}>⇆ Layout</GhostButton>
              <GhostButton size="sm" onClick={() => {
                const allParentIds = flat.filter(x => x.node.children.length > 0).map(x => x.node.id)
                setCollapsedNodeIds(allParentIds)
              }}>Collapse All</GhostButton>
              <GhostButton size="sm" onClick={() => setCollapsedNodeIds([])}>Expand All</GhostButton>
              <GhostButton size="sm" onClick={() => setShowQuickBuilder(true)}>⚡ Quick Builder</GhostButton>
              <GhostButton size="sm" onClick={() => setStructure([mkNode('New Project', 0)])}>Reset</GhostButton>
            </div>
          }
        />
        <div className="fm-card-body">
          <div className="fm-tree">
            {flat.map(({ node, depth }) => (
              <div key={node.id} className={`fm-tree-row-wrap ${isSequencedName(node.name) ? 'fm-tree-row-wrap--compact' : ''} anim-slide-in`}>
                <div className="fm-tree-row" style={{ paddingLeft: depth * 28 + 12 }}>
                  <div className="fm-tree-guide" style={{ left: depth * 28 + 4 }} />
                  
                  {/* Collapse Toggle Caret */}
                  <button 
                    className={`fm-collapse-btn ${node.children.length > 0 ? '' : 'fm-collapse-btn--empty'}`}
                    onClick={() => node.children.length > 0 && toggleCollapse(node.id)}
                    title={collapsedNodeIds.includes(node.id) ? 'Expand' : 'Collapse'}
                  >
                    {node.children.length > 0 ? (collapsedNodeIds.includes(node.id) ? '▶' : '▼') : ''}
                  </button>

                  <span className="fm-tree-icon">{node.children.length > 0 ? '📂' : '📁'}</span>
                  <input 
                    className="fm-tree-input" 
                    value={node.name} 
                    onChange={e => renameNode(node.id, e.target.value)}
                    placeholder="Folder Name..."
                  />

                  {/* Subfolder Count Badge */}
                  {node.children.length > 0 && (
                    <span className="fm-tree-count-badge" title={`${node.children.length} subfolders`}>
                      {node.children.length}
                    </span>
                  )}

                  <div className="fm-tree-actions">
                    <button className="fm-icon-btn fm-icon-btn--seq" title="Add Sequence" onClick={() => {
                      setActiveSeqNodeId(prev => prev === node.id ? null : node.id)
                      setSeqCounts({
                        MZ: 30, Z: 0, Q: 0, MQ: 0, BQ: 0, BZ: 0, N: 0, AQ: 0, ID: 0, WAAZ: 0
                      })
                    }}>🔢</button>
                    <button className="fm-icon-btn fm-icon-btn--add" title="Add Subfolder" onClick={() => addChild(node.id)}>+</button>
                    <button className="fm-icon-btn fm-icon-btn--sib" title="Add Sibling" onClick={() => addSibling(node.id)}>≡</button>
                    <button className="fm-icon-btn fm-icon-btn--dup" title="Duplicate" onClick={() => duplicateNode(node.id)}>⧉</button>
                    <button className="fm-icon-btn fm-icon-btn--del" title="Delete" onClick={() => removeNode(node.id)}>✕</button>
                  </div>
                </div>

                {/* Inline Multi-Sequence Grid Form */}
                {activeSeqNodeId === node.id && (
                  <div className="fm-inline-seq-form anim-slide-in" style={{ paddingLeft: depth * 28 + 44 }}>
                    <div className="fm-inline-seq-header">
                      <span className="fm-seq-form-title">🔢 Enter Sequence Counts for Subfolders:</span>
                    </div>
                    <div className="fm-inline-seq-grid">
                      {['MZ', 'Z', 'Q', 'MQ', 'BQ', 'BZ', 'N', 'AQ', 'ID', 'WAAZ'].map(p => (
                        <div key={p} className="fm-inline-seq-field">
                          <label>{p}</label>
                          <input 
                            type="number" 
                            min="0" 
                            placeholder="0"
                            className="input-field" 
                            value={seqCounts[p] || ''} 
                            onChange={e => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                              setSeqCounts(prev => ({ ...prev, [p]: val }))
                            }} 
                          />
                        </div>
                      ))}
                    </div>
                    <div className="fm-inline-seq-actions">
                      <Button 
                        size="sm" 
                        accent="var(--accent-folder)" 
                        onClick={() => {
                          setStructure(prev => addSequencesToNode(prev, node.id, seqCounts))
                          // Auto-collapse parent folder to avoid cluttering the tree view
                          setCollapsedNodeIds(prev => prev.includes(node.id) ? prev : [...prev, node.id])
                          setActiveSeqNodeId(null)
                        }}
                      >
                        Add Selected Sequences
                      </Button>
                      <GhostButton size="sm" onClick={() => setActiveSeqNodeId(null)}>Cancel</GhostButton>
                    </div>
                  </div>
                )}

                {/* Photographer assignment */}
                {photoCodes.length > 0 && (
                  <div className="fm-node-photos" style={{ paddingLeft: depth * 28 + 44 }}>
                    <div className="fm-node-photos-list">
                      {photoCodes.map(code => (
                        <button 
                          key={code} 
                          className={`fm-photo-chip ${node.photographers.includes(code) ? 'fm-photo-chip--active' : ''}`}
                          onClick={() => togglePhoto(node.id, code)}
                        >
                          <span>👤</span> {code.split('-')[1]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setStructure(p => [...p, mkNode('New Root', 0)])}>+ Add Root Folder</Button>
        </div>
      </Card>
    </div>
  )

  // ── Side Column JSX ─────────────────────────────────────────
  const sideCol = (
    <div className="fm-side-col">
      {/* Create Card */}
      <Card className="anim-scale-in">
        <CardHeader title="🚀 Execution" accent="var(--success)" accentSoft="var(--success-soft)" />
        <div className="fm-card-body">
          <BrowseRow 
            label="Target Directory" 
            value={rootPath} 
            placeholder="Where to create folders..."
            accent="var(--success)"
            onBrowse={async () => { const p = await api.dialog.openFolder(); if (p) setRootPath(p) }}
            onChange={setRootPath}
          />
          {rootPath && (
            <div style={{ marginTop: '8px' }}>
              <GhostButton 
                size="sm" 
                onClick={() => {
                  try {
                    const req = (window as any).require || require
                    const { shell } = req('electron')
                  } catch(e) {}
                  if (api?.shell?.openExternal) {
                    api.shell.openExternal(`filexplorer://${rootPath}`)
                  } else {
                    window.open(`filexplorer://${rootPath}`)
                  }
                }}
              >
                📁 Open in File Manager
              </GhostButton>
            </div>
          )}
          <Button 
            variant="primary" 
            size="lg" 
            accent="var(--success)" 
            disabled={isCreateDisabled}
            onClick={create}
            style={{ width: '100%', marginTop: 8 }}
          >
            Create Structure
          </Button>
          {result && (
            <div className={`fm-result-box ${result.success ? 'fm-result--ok' : 'fm-result--err'}`}>
              {result.success ? '✅ Success! Folders created.' : `✖ Error: ${result.error}`}
            </div>
          )}
        </div>
      </Card>

      {/* Presets Card */}
      <Card className="anim-scale-in">
        <CardHeader title="💾 Presets" accent="var(--info)" accentSoft="var(--info-soft)" />
        <div className="fm-card-body">
          <div className="fm-preset-save-row">
            <Input placeholder="Preset name..." value={presetName} onChange={e => setPresetName(e.target.value)} />
            <Button variant="ghost" size="sm" onClick={savePreset}>Save</Button>
          </div>
          <div className="fm-presets-list">
            {presets.length === 0 ? <p className="fm-empty">No saved presets.</p> : presets.map(p => (
              <div key={p.name} className="fm-preset-item">
                <span>{p.name}</span>
                <div className="fm-preset-btns">
                  <button onClick={() => setStructure(p.structure)}>Load</button>
                  <button className="fm-del-text" onClick={async () => { await api.folderMaker.deletePreset(p.name); setPresets(x => x.filter(y => y.name !== p.name)) }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="fm-page">
      <div 
        className="fm-body"
        style={{
          display: 'grid',
          gridTemplateColumns: panelAlign === 'right' ? `1fr 6px ${sideWidth}px` : `${sideWidth}px 6px 1fr`,
          gap: 0,
          alignItems: 'flex-start'
        }}
      >
        {panelAlign === 'right' ? (
          <>
            {mainCol}
            <div className="fm-splitter" onMouseDown={handleMouseDown} title="Drag to resize layout" />
            {sideCol}
          </>
        ) : (
          <>
            {sideCol}
            <div className="fm-splitter" onMouseDown={handleMouseDown} title="Drag to resize layout" />
            {mainCol}
          </>
        )}
      </div>

      {/* Quick Builder Modal */}
      <Modal 
        show={showQuickBuilder} 
        title="⚡ Quick Folder Builder"
        onClose={() => setShowQuickBuilder(false)}
        onConfirm={runQuickBuilder}
      >
        <div className="fm-qb-body">
          <p className="fm-qb-desc">Enter parent folders (comma separated). Then define subfolders for each.</p>
          <Input 
            label="Parent Folders" 
            placeholder="cam1, cam2, cam3..." 
            value={qbParents} 
            onChange={e => setQbParents(e.target.value)} 
          />
          <div className="fm-qb-mapping">
            {qbParents.split(',').map(p => p.trim()).filter(Boolean).map(p => (
              <div key={p} className="fm-qb-row">
                <span className="fm-qb-pname">{p}</span>
                <Input 
                  placeholder="Subfolders (q1, q2, q3)..." 
                  value={qbMap[p] || ''} 
                  onChange={e => setQbMap(prev => ({ ...prev, [p]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>
      {isDragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none', background: 'transparent' }} />
      )}
    </div>
  )
}

// ── Tree Mutation Helpers ─────────────────────────────────────
function addSequencesToNode(nodes: FolderNode[], parentId: string, counts: Record<string, number>): FolderNode[] {
  return nodes.map(n => {
    if (n.id === parentId) {
      let currentChildren = [...n.children]
      const prefixes = ['MZ', 'Z', 'Q', 'MQ', 'BQ', 'BZ', 'N', 'AQ', 'ID', 'WAAZ']
      
      for (const prefix of prefixes) {
        const count = counts[prefix] || 0
        if (count <= 0) continue
        
        const globalStart = currentChildren.length + 1
        const prefixUpper = prefix.toUpperCase()
        const existingPrefixCount = currentChildren.filter(c => {
          const parts = c.name.trim().split(/\s+/)
          return (parts[1] || '').toUpperCase() === prefixUpper
        }).length
        
        for (let i = 1; i <= count; i++) {
          const gSeq = String(globalStart + i - 1).padStart(3, '0')
          const pSeq = String(existingPrefixCount + i).padStart(2, '0')
          currentChildren.push(mkNode(`${gSeq} ${prefixUpper} ${pSeq}`, n.level + 1))
        }
      }
      return { ...n, children: currentChildren }
    }
    return { ...n, children: addSequencesToNode(n.children, parentId, counts) }
  })
}

function addChildTo(nodes: FolderNode[], id: string): FolderNode[] {
  return nodes.map(n => {
    if (n.id === id) return { ...n, children: [...n.children, mkNode('Sub Folder', n.level + 1)] }
    return { ...n, children: addChildTo(n.children, id) }
  })
}
function addSiblingTo(nodes: FolderNode[], id: string): FolderNode[] {
  const idx = nodes.findIndex(n => n.id === id)
  if (idx !== -1) {
    const sibling = mkNode('New Folder', nodes[idx].level)
    return [...nodes.slice(0, idx + 1), sibling, ...nodes.slice(idx + 1)]
  }
  return nodes.map(n => ({ ...n, children: addSiblingTo(n.children, id) }))
}
function removeNodeFrom(nodes: FolderNode[], id: string): FolderNode[] {
  return nodes.filter(n => n.id !== id).map(n => ({ ...n, children: removeNodeFrom(n.children, id) }))
}
function renameNodeIn(nodes: FolderNode[], id: string, name: string): FolderNode[] {
  return nodes.map(n => n.id === id ? { ...n, name } : { ...n, children: renameNodeIn(n.children, id, name) })
}
function togglePhotoIn(nodes: FolderNode[], id: string, code: string): FolderNode[] {
  return nodes.map(n => {
    if (n.id === id) {
      const exists = n.photographers.includes(code)
      return { ...n, photographers: exists ? n.photographers.filter(c => c !== code) : [...n.photographers, code] }
    }
    return { ...n, children: togglePhotoIn(n.children, id, code) }
  })
}
function duplicateNodeIn(nodes: FolderNode[], id: string): FolderNode[] {
  const idx = nodes.findIndex(n => n.id === id)
  if (idx !== -1) {
    const original = nodes[idx]
    const clone = JSON.parse(JSON.stringify(original))
    clone.id = `n${_id++}`
    clone.name = `${clone.name} (Copy)`
    // Recursive re-id for children if any
    const reId = (node: FolderNode) => {
      node.id = `n${_id++}`
      node.children.forEach(reId)
    }
    clone.children.forEach(reId)
    return [...nodes.slice(0, idx + 1), clone, ...nodes.slice(idx + 1)]
  }
  return nodes.map(n => ({ ...n, children: duplicateNodeIn(n.children, id) }))
}
function stripIds(nodes: FolderNode[]): any[] {
  return nodes.map(({ name, level, children, photographers }) => ({
    name, level, photographers, children: stripIds(children)
  }))
}

