import React, { useState, useEffect } from 'react'
import { Card } from '../../components/Card'
import { Button, GhostButton } from '../../components/Button'
import { Input } from '../../components/Input'
import { useToast } from '../../components/Toast'
import { useSound } from '../../components/SoundProvider'
import './StickyNotes.css'

const api = (window as any).api

interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

interface StickyItem {
  id: string
  type: 'note' | 'link'
  title: string
  color: string // Yellow, Orange, Red, Pink, Purple, Blue, Green, Teal
  date: number
  x?: number
  y?: number
  
  // Note fields
  body?: string
  checklist?: ChecklistItem[]
  
  // Link fields
  url?: string
  category?: 'drive' | 'script' | 'folder' | 'web'
}

// 8 glow colors map
const COLORS = [
  { name: 'Yellow', hex: '#FFD54F' },
  { name: 'Orange', hex: '#FF7043' },
  { name: 'Red', hex: '#EF5350' },
  { name: 'Pink', hex: '#EC407A' },
  { name: 'Purple', hex: '#AB47BC' },
  { name: 'Blue', hex: '#5C6BC0' },
  { name: 'Green', hex: '#66BB6A' },
  { name: 'Teal', hex: '#26A69A' }
]

// Professional starter presets
const PRESETS: StickyItem[] = [
  {
    id: 'p1',
    type: 'note',
    title: '🎬 Final Quality Checklist',
    color: '#EF5350', // Red
    date: Date.now() - 3600000,
    body: 'Items to verify before transferring output videos to the converter page.',
    checklist: [
      { id: 'c1', text: 'Validate intro and outro segments render seamlessly', completed: true },
      { id: 'c2', text: 'Confirm background music ducking thresholds sound clear', completed: false },
      { id: 'c3', text: 'Check video file metadata matches client prefix specification', completed: false }
    ]
  },
  {
    id: 'p2',
    type: 'link',
    title: '🌐 Sharaf Media Portal',
    color: '#26A69A', // Teal
    date: Date.now() - 7200000,
    category: 'drive',
    url: 'https://sharaf-media.pages.dev'
  },
  {
    id: 'p3',
    type: 'link',
    title: '⚙️ Automated Apps Script Link',
    color: '#AB47BC', // Purple
    date: Date.now() - 10800000,
    category: 'script',
    url: 'https://script.google.com/home'
  },
  {
    id: 'p4',
    type: 'link',
    title: '📂 Workstation Output Folder',
    color: '#FF7043', // Orange
    date: Date.now() - 14400000,
    category: 'folder',
    url: 'C:\\Uni Desk Outputs'
  },
  {
    id: 'p5',
    type: 'note',
    title: '💡 Quick Automation Ideas',
    color: '#5C6BC0', // Blue
    date: Date.now() - 18000000,
    body: 'Explore deeper IPC hooks for Adobe Premiere integration, add more folder structure presets, and keep the user interface looking premium.',
    checklist: []
  }
]

export default function StickyNotes(): JSX.Element {
  const { showToast } = useToast()
  const { playTick, playSuccess } = useSound()

  // Central dashboard state
  const [items, setItems] = useState<StickyItem[]>([])
  const [filter, setFilter] = useState<'all' | 'notes' | 'links' | 'drive' | 'script' | 'folder' | 'web'>('all')
  const [layoutMode, setLayoutMode] = useState<'grid' | 'canvas'>(() => {
    return (localStorage.getItem('ot_sticky_layout') as 'grid' | 'canvas') ?? 'grid'
  })
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // Creator modal triggers
  const [showModal, setShowModal] = useState(false)
  const [modalTab, setModalTab] = useState<'note' | 'link'>('note')
  const [editingItem, setEditingItem] = useState<StickyItem | null>(null)

  // Form Fields
  const [formTitle, setFormTitle] = useState('')
  const [formColor, setFormColor] = useState('#AB47BC') // default purple
  
  // Note Form Fields
  const [formBody, setFormBody] = useState('')
  const [formTodoInput, setFormTodoInput] = useState('')
  const [formTodoList, setFormTodoList] = useState<string[]>([])

  // Link Form Fields
  const [formUrl, setFormUrl] = useState('')
  const [formCategory, setFormCategory] = useState<'drive' | 'script' | 'folder' | 'web'>('drive')

  // Load from localStorage on mount
  useEffect(() => {
    const data = localStorage.getItem('ot_sticky_hub')
    let parsed: StickyItem[] = []
    if (data) {
      try {
        parsed = JSON.parse(data)
      } catch (e) {
        parsed = PRESETS
      }
    } else {
      parsed = PRESETS
    }

    // Assure default coordinates exist on load (grid placement on canvas)
    let changed = false
    const updated = parsed.map((item, idx) => {
      if (item.x === undefined || item.y === undefined) {
        const col = idx % 3
        const row = Math.floor(idx / 3)
        item.x = 20 + col * 340
        item.y = 20 + row * 240
        changed = true
      }
      return item
    })

    setItems(updated)
    if (changed || !data) {
      localStorage.setItem('ot_sticky_hub', JSON.stringify(updated))
    }
  }, [])

  // Auto-save helper
  const saveItems = (updated: StickyItem[]) => {
    setItems(updated)
    localStorage.setItem('ot_sticky_hub', JSON.stringify(updated))
  }

  // Browse local system folder for path-based items
  const handleBrowseLocalFolder = async () => {
    if (!api || !api.dialog) return
    const selected = await api.dialog.openFolder()
    if (selected) {
      setFormUrl(selected)
      playTick()
    }
  }

  // Grid Drag and Drop Handlers (Only reorder on Drop to prevent DOM cancellation during DragOver)
  const handleGridDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedId(id)
  }

  const handleGridDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleGridDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleGridDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggedId
    if (!id || id === targetId) return

    const draggedIndex = items.findIndex(item => item.id === id)
    const targetIndex = items.findIndex(item => item.id === targetId)
    if (draggedIndex === -1 || targetIndex === -1) return

    const newItems = [...items]
    const [draggedItem] = newItems.splice(draggedIndex, 1)
    newItems.splice(targetIndex, 0, draggedItem)
    
    saveItems(newItems)
    setDraggedId(null)
  }

  const handleGridDragEnd = () => {
    setDraggedId(null)
  }

  // Free-form Canvas Mouse Dragging Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent, item: StickyItem) => {
    if (layoutMode !== 'canvas') return

    // Ensure we don't start dragging if clicking interactive controls
    const target = e.target as HTMLElement
    if (
      target.closest('button') || 
      target.closest('input') || 
      target.closest('textarea') || 
      target.closest('a') || 
      target.closest('select') ||
      target.closest('.sh-card-edit-btn') ||
      target.closest('.sh-card-delete-btn') ||
      target.closest('label')
    ) {
      return
    }

    // Do NOT preventDefault here to allow clicks to register on Checklist labels/checkboxes
    const startX = e.clientX
    const startY = e.clientY
    const initialX = item.x ?? 0
    const initialY = item.y ?? 0
    let hasDragged = false

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      
      // Filter out small mouse movements/clicks (jitter threshold of 4px)
      if (!hasDragged && Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) {
        return
      }

      if (!hasDragged) {
        hasDragged = true
        setActiveDragId(item.id)
      }

      let newX = initialX + deltaX
      let newY = initialY + deltaY

      // Boundary clamping within .sh-grid container width
      const container = document.querySelector('.sh-grid')
      if (container) {
        const rect = container.getBoundingClientRect()
        newX = Math.max(10, Math.min(newX, rect.width - 330))
        newY = Math.max(10, Math.min(newY, 1500))
      }

      setItems(prev => prev.map(p => p.id === item.id ? { ...p, x: newX, y: newY } : p))
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      setActiveDragId(null)
      if (hasDragged) {
        setItems(latest => {
          localStorage.setItem('ot_sticky_hub', JSON.stringify(latest))
          return latest
        })
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Add todo checklist item in the form before saving
  const handleAddTodoItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = formTodoInput.trim()
    if (!trimmed) return
    setFormTodoList([...formTodoList, trimmed])
    setFormTodoInput('')
    playTick()
  }

  // Remove checklist item from form list
  const handleRemoveTodoItem = (index: number) => {
    setFormTodoList(formTodoList.filter((_, idx) => idx !== index))
    playTick()
  }

  // Trigger Native Shell to open links or folders
  const handleLaunchItem = async (item: StickyItem) => {
    if (!item.url) return
    playTick()
    try {
      if (item.category === 'folder') {
        if (api && api.shell) {
          await api.shell.openFolder(item.url)
          showToast({ title: 'Directory Opened', message: `Opened local path: ${item.url}`, type: 'success' })
        }
      } else {
        if (api && api.shell) {
          await api.shell.openExternal(item.url)
        } else {
          window.open(item.url, '_blank')
        }
      }
    } catch (e) {
      showToast({ title: 'Launch Failed', message: 'Could not open the selected target path.', type: 'danger' })
    }
  }

  // Copy URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    playTick()
    showToast({ title: 'Copied', message: 'Copied link to clipboard successfully.', type: 'success' })
  }

  // Copy full Note text & checklist to clipboard
  const handleCopyNoteText = (item: StickyItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    let text = item.title ? `${item.title}\n` : ''
    if (item.body) {
      text += `${item.body}\n`
    }
    if (item.checklist && item.checklist.length > 0) {
      text += item.checklist.map(c => `${c.completed ? '☑' : '☐'} ${c.text}`).join('\n')
    }
    navigator.clipboard.writeText(text.trim())
    playTick()
    showToast({ title: 'Note Copied', message: 'Copied note text to clipboard.', type: 'success' })
  }

  // Toggle todo check in active note
  const handleToggleChecklist = (noteId: string, todoId: string) => {
    playTick()
    const updated = items.map(item => {
      if (item.id === noteId && item.checklist) {
        const nextCheck = item.checklist.map(chk => {
          if (chk.id === todoId) {
            const nextCompleted = !chk.completed
            if (nextCompleted) {
              // Play success on check complete
              setTimeout(() => playSuccess(), 100)
            }
            return { ...chk, completed: nextCompleted }
          }
          return chk
        })
        return { ...item, checklist: nextCheck }
      }
      return item
    })
    saveItems(updated)
  }

  // Delete Card
  const handleDeleteItem = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      const updated = items.filter(item => item.id !== id)
      saveItems(updated)
      playTick()
      showToast({ title: 'Deleted', message: 'Removed workspace card.', type: 'success' })
    }
  }

  // Start Editing Card
  const handleStartEdit = (item: StickyItem) => {
    setEditingItem(item)
    setModalTab(item.type)
    setFormTitle(item.title)
    setFormColor(item.color)
    if (item.type === 'note') {
      setFormBody(item.body ?? '')
      setFormTodoList(item.checklist?.map(c => c.text) ?? [])
    } else {
      setFormUrl(item.url ?? '')
      setFormCategory(item.category ?? 'drive')
    }
    setShowModal(true)
    playTick()
  }

  // Reset/Save Form values and Close Modal
  const handleCloseModal = () => {
    setShowModal(false)
    setFormTitle('')
    setFormBody('')
    setFormTodoInput('')
    setFormTodoList([])
    setFormUrl('')
    setFormCategory('drive')
    setFormColor('#AB47BC')
    setEditingItem(null)
  }

  // Submit New Card (Note or Link)
  const handleSubmitCard = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = formTitle.trim()
    if (!trimmedTitle) {
      showToast({ title: 'Missing Title', message: 'Please enter a valid title for this card.', type: 'danger' })
      return
    }

    let newItem: StickyItem

    // Compute free spot coordinate for spawning new canvas items
    let spawnX = 20
    let spawnY = 20
    if (items.length > 0) {
      const maxX = Math.max(...items.map(item => item.x ?? 0))
      const maxY = Math.max(...items.map(item => item.y ?? 0))
      const container = document.querySelector('.sh-grid')
      const containerWidth = container ? container.getBoundingClientRect().width : 1000
      if (maxX + 360 < containerWidth - 340) {
        spawnX = maxX + 340
        spawnY = items[items.length - 1]?.y ?? 20
      } else {
        spawnX = 20
        spawnY = maxY + 240
      }
    }

    if (modalTab === 'note') {
      const checklistObj: ChecklistItem[] = formTodoList.map((text, idx) => {
        const existing = editingItem?.checklist?.find(c => c.text === text)
        return {
          id: existing?.id ?? `c_${Date.now()}_${idx}`,
          text,
          completed: existing?.completed ?? false
        }
      })

      newItem = {
        id: editingItem ? editingItem.id : `note_${Date.now()}`,
        type: 'note',
        title: trimmedTitle,
        color: formColor,
        date: editingItem ? editingItem.date : Date.now(),
        body: formBody.trim(),
        checklist: checklistObj,
        x: editingItem ? editingItem.x : spawnX,
        y: editingItem ? editingItem.y : spawnY
      }
    } else {
      const trimmedUrl = formUrl.trim()
      if (!trimmedUrl) {
        showToast({ title: 'Missing URL/Path', message: 'Please specify a target URL or folder path.', type: 'danger' })
        return
      }

      newItem = {
        id: editingItem ? editingItem.id : `link_${Date.now()}`,
        type: 'link',
        title: trimmedTitle,
        color: formColor,
        date: editingItem ? editingItem.date : Date.now(),
        url: trimmedUrl,
        category: formCategory,
        x: editingItem ? editingItem.x : spawnX,
        y: editingItem ? editingItem.y : spawnY
      }
    }

    if (editingItem) {
      const updated = items.map(item => item.id === editingItem.id ? newItem : item)
      saveItems(updated)
      playSuccess()
      showToast({
        title: modalTab === 'note' ? 'Sticky Note Updated' : 'Quick Link Updated',
        message: `Successfully saved changes to "${trimmedTitle}"`,
        type: 'success'
      })
    } else {
      saveItems([newItem, ...items])
      playSuccess()
      showToast({ 
        title: modalTab === 'note' ? 'Sticky Note Added' : 'Quick Link Added', 
        message: `Successfully created "${trimmedTitle}"`, 
        type: 'success' 
      })
    }
    handleCloseModal()
  }

  // Filter logic
  const filteredItems = items.filter(item => {
    if (filter === 'all') return true
    if (filter === 'notes') return item.type === 'note'
    if (filter === 'links') return item.type === 'link'
    // link category specifics
    if (item.type === 'link' && item.category === filter) return true
    return false
  })

  // Format date helper
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="sh-page">
      {/* Modern Filter pills & Inline Create Button */}
      <div className="sh-filters anim-scale-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '100%', gap: '16px', flexWrap: 'wrap' }}>
        <div className="sh-filter-pills" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); playTick() }}>🗂️ All</button>
          <button className={filter === 'notes' ? 'active' : ''} onClick={() => { setFilter('notes'); playTick() }}>📝 Notes</button>
          <button className={filter === 'links' ? 'active' : ''} onClick={() => { setFilter('links'); playTick() }}>🔗 Links</button>
          <div className="sh-filter-divider" />
          <button className={filter === 'drive' ? 'active' : ''} onClick={() => { setFilter('drive'); playTick() }}>🌐 Sharaf Media</button>
          <button className={filter === 'script' ? 'active' : ''} onClick={() => { setFilter('script'); playTick() }}>⚙️ Apps Script</button>
          <button className={filter === 'folder' ? 'active' : ''} onClick={() => { setFilter('folder'); playTick() }}>📁 Directories</button>
          <button className={filter === 'web' ? 'active' : ''} onClick={() => { setFilter('web'); playTick() }}>🌐 Web links</button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Layout Selector */}
          <div className="sh-layout-toggle" style={{ display: 'flex', gap: '2px', background: 'var(--surface-3)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button 
              type="button"
              className={layoutMode === 'grid' ? 'active' : ''} 
              onClick={() => { setLayoutMode('grid'); localStorage.setItem('ot_sticky_layout', 'grid'); playTick() }}
              style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', border: 'none', background: layoutMode === 'grid' ? 'var(--accent-notes)' : 'transparent', color: layoutMode === 'grid' ? 'white' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}
            >
              📊 Grid
            </button>
            <button 
              type="button"
              className={layoutMode === 'canvas' ? 'active' : ''} 
              onClick={() => { setLayoutMode('canvas'); localStorage.setItem('ot_sticky_layout', 'canvas'); playTick() }}
              style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', border: 'none', background: layoutMode === 'canvas' ? 'var(--accent-notes)' : 'transparent', color: layoutMode === 'canvas' ? 'white' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}
            >
              📍 Canvas
            </button>
          </div>

          <Button variant="primary" onClick={() => { setShowModal(true); playTick() }} style={{ padding: '8px 18px', borderRadius: '10px', height: '38px' }}>
            ⚡ Create Card
          </Button>
        </div>
      </div>

      {/* Grid / Canvas view containing all elements */}
      <div className={`sh-grid ${layoutMode === 'canvas' ? 'sh-grid--canvas' : ''}`}>
        {filteredItems.length === 0 ? (
          <div className="sh-empty anim-fade-in">
            <div className="sh-empty-icon">🗂️</div>
            <p>No notes or links match the active filter criteria.</p>
            <GhostButton onClick={() => { setFilter('all'); playTick() }}>Clear Filters</GhostButton>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isDragged = layoutMode === 'grid' && draggedId === item.id;
            return (
              <Card 
                key={item.id} 
                className={`sh-card sh-card--${item.type} ${isDragged ? 'sh-card--dragging' : ''} anim-scale-in`}
                style={{ 
                  animationDelay: `${idx * 40}ms`,
                  '--shadow-glow': `${item.color}55`,
                  borderLeft: `5px solid ${item.color}`,
                  ...(layoutMode === 'canvas' ? {
                    position: 'absolute',
                    left: `${item.x ?? 20}px`,
                    top: `${item.y ?? 20}px`,
                    width: '320px',
                    zIndex: activeDragId === item.id ? 1000 : 10,
                    transition: activeDragId === item.id ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease, left 0.2s ease, top 0.2s ease'
                  } : {})
                } as React.CSSProperties}
                draggable={layoutMode === 'grid'}
                onDragStart={(e) => {
                  if (layoutMode === 'canvas') {
                    e.preventDefault()
                    return
                  }
                  handleGridDragStart(e, item.id)
                }}
                onDragOver={handleGridDragOver}
                onDragEnter={handleGridDragEnter}
                onDrop={(e) => handleGridDrop(e, item.id)}
                onDragEnd={handleGridDragEnd}
                onMouseDown={(e) => handleCanvasMouseDown(e, item)}
              >
                <div className="sh-card-glow" style={{ background: item.color }} />
                
                <div className="sh-card-top">
                  <span className="sh-card-category" style={{ color: item.color, backgroundColor: `${item.color}15` }}>
                    {item.type === 'note' ? '📝 Note' : `🔗 ${item.category?.toUpperCase()}`}
                  </span>
                  <span className="sh-card-date">{formatDate(item.date)}</span>
                </div>

                <h3 
                  className="sh-card-title truncate" 
                  title={item.title}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {item.title}
                </h3>

                {item.type === 'note' && (
                  <div className="sh-card-note-content" onMouseDown={(e) => e.stopPropagation()}>
                    {item.body && (
                      <p 
                        className="sh-card-body" 
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {item.body}
                      </p>
                    )}
                    
                    {item.checklist && item.checklist.length > 0 && (
                      <div className="sh-checklist" onMouseDown={(e) => e.stopPropagation()}>
                        {item.checklist.map(chk => (
                          <label 
                            key={chk.id} 
                            className={`sh-checklist-item ${chk.completed ? 'sh-checklist-item--checked' : ''}`}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <input 
                              type="checkbox" 
                              checked={chk.completed} 
                              onChange={() => handleToggleChecklist(item.id, chk.id)}
                            />
                            <span className="sh-checkbox-custom" style={{ borderColor: item.color, '--check-color': item.color } as React.CSSProperties} />
                            <span 
                              className="sh-checklist-text"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {chk.text}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {item.type === 'link' && (
                  <div className="sh-card-link-content" onMouseDown={(e) => e.stopPropagation()}>
                    <div 
                      className="sh-card-url-bar truncate" 
                      title={item.url}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {item.url}
                    </div>
                    <div className="sh-card-link-actions">
                      <Button 
                        size="sm" 
                        variant="primary" 
                        accent={item.color}
                        onClick={() => handleLaunchItem(item)}
                      >
                        {item.category === 'folder' ? '📁 Open Path' : '🚀 Launch'}
                      </Button>
                      <GhostButton 
                        size="sm" 
                        onClick={() => handleCopyUrl(item.url ?? '')}
                      >
                        📋 Copy
                      </GhostButton>
                    </div>
                  </div>
                )}

                <button 
                  className="sh-card-copy-btn" 
                  onClick={(e) => item.type === 'note' ? handleCopyNoteText(item, e) : handleCopyUrl(item.url ?? '')}
                  title={item.type === 'note' ? 'Copy Note Text' : 'Copy Link URL'}
                >
                  📋
                </button>
                <button 
                  className="sh-card-edit-btn" 
                  onClick={() => handleStartEdit(item)}
                  title="Edit Card"
                >
                  ✏
                </button>
                <button 
                  className="sh-card-delete-btn" 
                  onClick={() => handleDeleteItem(item.id, item.title)}
                  title="Delete Card"
                >
                  ✕
                </button>
              </Card>
            );
          })
        )}
      </div>

      {/* Glassmorphic creation modal overlay */}
      {showModal && (
        <div className="sh-modal-overlay anim-fade-in" onClick={handleCloseModal}>
          <div className="sh-modal-content anim-scale-in" onClick={e => e.stopPropagation()}>
            <div className="sh-modal-header">
              <h3>{editingItem ? 'Edit Hub Card' : 'Create Hub Card'}</h3>
              <button className="sh-modal-close" onClick={handleCloseModal}>✕</button>
            </div>

            {/* Selector between Note and Link */}
            <div className="sh-modal-tabs">
              <button 
                type="button"
                className={`sh-modal-tab ${modalTab === 'note' ? 'active' : ''}`} 
                onClick={() => { setModalTab('note'); playTick() }}
                disabled={!!editingItem}
                style={editingItem ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                📝 Interactive Note
              </button>
              <button 
                type="button"
                className={`sh-modal-tab ${modalTab === 'link' ? 'active' : ''}`} 
                onClick={() => { setModalTab('link'); playTick() }}
                disabled={!!editingItem}
                style={editingItem ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                🔗 Native Launch Link
              </button>
            </div>

            <form onSubmit={handleSubmitCard} className="sh-modal-form">
              <Input 
                label="Card Title" 
                placeholder={modalTab === 'note' ? 'e.g. Video Upload Checklist' : 'e.g. Raw Assets Folder'}
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                accent={formColor}
                required
              />

              {/* Note Tab fields */}
              {modalTab === 'note' && (
                <div className="sh-form-group">
                  <div className="input-wrap">
                    <label className="input-label" style={{ color: formColor }}>Note Body Text</label>
                    <textarea 
                      className="input-field textarea-field" 
                      placeholder="Jot down quick reminders, notes, or explanations..."
                      value={formBody}
                      onChange={e => setFormBody(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="sh-form-checklist-builder">
                    <label className="input-label" style={{ color: formColor }}>Add Todo Checklist Items</label>
                    <div className="sh-checklist-input-row">
                      <input 
                        className="input-field" 
                        placeholder="Type task and press Enter or plus button..."
                        value={formTodoInput}
                        onChange={e => setFormTodoInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddTodoItem()
                          }
                        }}
                      />
                      <button 
                        type="button" 
                        className="sh-checklist-add-btn" 
                        onClick={() => handleAddTodoItem()}
                        style={{ background: formColor }}
                      >
                        +
                      </button>
                    </div>

                    {formTodoList.length > 0 && (
                      <div className="sh-form-todo-preview">
                        {formTodoList.map((todo, idx) => (
                          <div key={idx} className="sh-form-todo-pill">
                            <span>{todo}</span>
                            <button type="button" onClick={() => handleRemoveTodoItem(idx)}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Link Tab fields */}
              {modalTab === 'link' && (
                <div className="sh-form-group">
                  <div className="input-wrap">
                    <label className="input-label" style={{ color: formColor }}>Link Category</label>
                    <select 
                      className="input-field select-field"
                      value={formCategory}
                      onChange={e => {
                        setFormCategory(e.target.value as any)
                        playTick()
                      }}
                    >
                      <option value="drive">🌐 Sharaf Media portal</option>
                      <option value="script">⚙️ Google Apps Script url</option>
                      <option value="folder">📁 Local Folder path</option>
                      <option value="web">🌐 Standard Web link</option>
                    </select>
                  </div>

                  <div className="input-wrap">
                    <label className="input-label" style={{ color: formColor }}>
                      {formCategory === 'folder' ? 'Local Folder Directory Path' : 'Destination URL'}
                    </label>
                    <div className="sh-url-row">
                      <input 
                        className="input-field" 
                        placeholder={formCategory === 'folder' ? 'D:\\Workspace\\RenderedVideos' : 'https://drive.google.com/...'}
                        value={formUrl}
                        onChange={e => setFormUrl(e.target.value)}
                        required
                        style={{ flex: 1 }}
                      />
                      {formCategory === 'folder' && (
                        <button 
                          type="button"
                          className="sh-form-browse-btn"
                          onClick={handleBrowseLocalFolder}
                        >
                          📂 Browse
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Glowing Color Picker Palette */}
              <div className="sh-color-picker">
                <label className="input-label" style={{ color: formColor }}>Glow Accent Hue</label>
                <div className="sh-color-circles">
                  {COLORS.map(c => (
                    <button 
                      key={c.hex} 
                      type="button"
                      className={`sh-color-circle ${formColor === c.hex ? 'active' : ''}`}
                      style={{ 
                        backgroundColor: c.hex,
                        '--shadow-glow': `${c.hex}88`
                      } as React.CSSProperties}
                      onClick={() => {
                        setFormColor(c.hex)
                        playTick()
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="sh-modal-actions">
                <GhostButton type="button" onClick={handleCloseModal}>Cancel</GhostButton>
                <Button type="submit" variant="primary" accent={formColor}>
                  {editingItem ? '💾 Save Changes' : '✅ Add Card'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
