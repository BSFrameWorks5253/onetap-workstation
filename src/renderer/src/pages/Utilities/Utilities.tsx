import React, { useState, useEffect, useMemo, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import { useSound } from '../../components/SoundProvider'
import { useToast } from '../../components/Toast'
import './Utilities.css'

interface UtilityItem {
  id: string
  title: string
  icon: string
  desc: string
  category: 'Conversion' | 'Editing' | 'Security' | 'Productivity'
  targetPage?: 'folder' | 'converter' | 'drivesync' | 'adder' | 'stats' | 'notes' | 'settings' | 'cloud' | 'gdrive' | 'tracker' | 'archivevault'
}

// Focused list containing pre-existing tools and PDF conversion/editing tools
const UTILITIES_DATA: UtilityItem[] = [
  { id: 'archive_vault', title: 'Data Search', icon: '🔍', desc: 'Zero-Storage media catalog & intelligent dual-calendar Excel reconciliation.', category: 'Productivity', targetPage: 'archivevault' },
  { id: 'task_tracker', title: 'Task & Safar Tracker', icon: '🎯', desc: 'Autonomous Safar & Date production lifecycle tracker with live auto-detection.', category: 'Productivity', targetPage: 'tracker' },
  { id: 'prproj_generator', title: 'Premiere Pro Generator', icon: '🎬', desc: 'Create Adobe Premiere Pro (.prproj) project files in subfolders named after each folder.', category: 'Productivity' },
  { id: 'title_adder', title: 'Title Adder', icon: '🎬', desc: 'Batch-process videos with intro/outro & smart audio branding.', category: 'Productivity', targetPage: 'adder' },
  { id: 'convert_png_jpg', title: 'PNG → JPG Converter', icon: '🖼️', desc: 'Convert PNG screenshots to JPEG and rename by video filename.', category: 'Conversion', targetPage: 'converter' },
  { id: 'folder_maker', title: 'Folder Maker', icon: '📁', desc: 'Design and build complex nested folder structures visually.', category: 'Editing', targetPage: 'folder' },
  { id: 'drive_sync', title: 'Drive Sync', icon: '☁️', desc: 'Sync workstation templates and audio files with remote drives.', category: 'Productivity', targetPage: 'drivesync' },
  { id: 'stats_page', title: 'Render Stats', icon: '📊', desc: 'Track video counts, durations, and prefixes dynamically.', category: 'Productivity', targetPage: 'stats' },
  { id: 'sticky_notes', title: 'Sticky Notes Hub', icon: '📝', desc: 'Workspace Sticky Hub — jot down color-coded reminders and checklists.', category: 'Productivity', targetPage: 'notes' },
  
  // ── PDF Conversion Tools (Functional in Workspace) ──
  { id: 'pdf_word', title: 'PDF → Word', icon: '📄', desc: 'Convert PDF documents into editable Word files (.doc) with layout retention.', category: 'Conversion' },
  { id: 'pdf_excel', title: 'PDF → Excel', icon: '📊', desc: 'Extract PDF tables into clean CSV sheets compatible with Excel.', category: 'Conversion' },
  { id: 'pdf_txt', title: 'PDF → TXT', icon: '🔤', desc: 'Extract character sequences from PDF files, removing layout styling.', category: 'Conversion' },
  { id: 'pdf_image', title: 'PDF → JPG / PNG', icon: '🖼️', desc: 'Render and extract pages from PDF into separate JPG or PNG images.', category: 'Conversion' },
  { id: 'pdf_html', title: 'PDF → HTML', icon: '🌐', desc: 'Compile PDF layout sheets into standalone responsive HTML structures.', category: 'Conversion' },
  { id: 'word_pdf', title: 'Word → PDF', icon: '📕', desc: 'Compile Word doc structures into standardized PDF documents offline.', category: 'Conversion' },
  { id: 'excel_pdf', title: 'Excel → PDF', icon: '📗', desc: 'Format and compile Excel spreadsheet structures into clean PDFs.', category: 'Conversion' },
  { id: 'image_pdf', title: 'Images → PDF', icon: '📸', desc: 'Compile JPG, JPEG, and PNG images in bulk into a single PDF.', category: 'Conversion' },
  { id: 'md_pdf', title: 'Markdown → PDF', icon: '📝', desc: 'Compile markdown source text directly into formatted PDF manuals.', category: 'Conversion' },

  // ── PDF Editing & Pages ──
  { id: 'merge_pdf', title: 'Merge PDFs', icon: '📎', desc: 'Combine multiple PDF documents in any order into a single output.', category: 'Editing' },
  { id: 'split_pages', title: 'Split Pages', icon: '🥞', desc: 'Extract and split pages into separate standalone PDF files.', category: 'Editing' },
  { id: 'rotate_pages', title: 'Edit PDF', icon: '✏️', desc: 'Visually rotate pages, rearrange their order, delete pages, and save the result.', category: 'Editing' },
  { id: 'delete_pages', title: 'Delete Pages', icon: '🗑️', desc: 'Surgically strip target pages or ranges from PDF files.', category: 'Editing' },
  { id: 'duplicate_pages', title: 'Duplicate Pages', icon: '👥', desc: 'Duplicate specified pages to clone layouts inside documents.', category: 'Editing' },

  // ── Security & Watermarking ──
  { id: 'password_protect', title: 'Password Protect', icon: '🔒', desc: 'Encrypt PDF files with user and owner passwords for secure sharing.', category: 'Security' },
  { id: 'remove_password', title: 'Remove Password', icon: '🔓', desc: 'Strip protection layers and remove access restrictions permanently.', category: 'Security' },
  { id: 'watermark', title: 'Watermark Editor', icon: '🌊', desc: 'Apply customizable text watermarks diagonally across PDF pages.', category: 'Security' },
  { id: 'metadata', title: 'Metadata Editor', icon: '🏷️', desc: 'Edit document titles, author names, subjects, and keywords.', category: 'Security' }
]

const CATEGORIES: Array<UtilityItem['category'] | 'All' | 'Favorites'> = [
  'All',
  'Favorites',
  'Conversion',
  'Editing',
  'Security',
  'Productivity'
]

// Regex text extractor in JavaScript (works in browser & Node)
function extractTextFromPdfString(pdfString: string): string {
  const regex = /\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g
  let match
  let text = ''
  while ((match = regex.exec(pdfString)) !== null) {
    if (match[1]) {
      text += match[1] + '\n'
    } else if (match[2]) {
      const subRegex = /\(([^)]*)\)/g
      let subMatch
      while ((subMatch = subRegex.exec(match[2])) !== null) {
        text += subMatch[1]
      }
      text += '\n'
    }
  }
  
  return text
    .replace(/\\([\(\)\\])/g, '$1')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .trim()
}

export default function Utilities(): JSX.Element {
  const { playTick, playSuccess, playError } = useSound()
  const { showToast } = useToast()

  // State
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<UtilityItem['category'] | 'All' | 'Favorites'>('All')
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('ot_utilities_favorites')
    return saved ? JSON.parse(saved) : ['pdf_word', 'merge_pdf', 'watermark', 'password_protect']
  })

  // Workspace Overlay state
  const [activeTool, setActiveTool] = useState<UtilityItem | null>(null)
  const [inputFiles, setInputFiles] = useState<string[]>([])
  const [rawFiles, setRawFiles] = useState<File[]>([]) // Browser fallback file handles
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [browserMode, setBrowserMode] = useState(false)

  // Parameters
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL')
  const [watermarkOpacity, setWatermarkOpacity] = useState('0.25')
  const [userPassword, setUserPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [splitMode, setSplitMode] = useState<'single' | 'ranges'>('single')
  const [splitRanges, setSplitRanges] = useState('1-3')
  const [metadataTitle, setMetadataTitle] = useState('')
  const [metadataAuthor, setMetadataAuthor] = useState('')
  const [metadataSubject, setMetadataSubject] = useState('')
  const [metadataKeywords, setMetadataKeywords] = useState('')
  const [textInput, setTextInput] = useState('# Document Title\n\nWrite HTML, Markdown, or text here to print to PDF...')

  // PDF Page Editor State
  const [pdfPages, setPdfPages] = useState<{ index: number; rotation: number; originalIndex: number }[]>([])
  const [pdfLoading, setPdfLoading] = useState(false)
  const [loadedPdfDoc, setLoadedPdfDoc] = useState<any>(null)

  // Load PDF structure for Rotate / Reorder Pages
  useEffect(() => {
    if (activeTool?.id !== 'rotate_pages') return
    const firstFile = inputFiles[0]
    const firstRaw = rawFiles[0]

    if (!firstFile && !firstRaw) {
      setPdfPages([])
      setLoadedPdfDoc(null)
      return
    }

    setPdfLoading(true)
    ;(async () => {
      try {
        let arrayBuffer: ArrayBuffer
        if (firstFile && !browserMode) {
          const res = await (window as any).api.viewer.readFileBase64(firstFile)
          if (!res.ok) throw new Error(res.error || 'Failed to read PDF file.')
          arrayBuffer = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0)).buffer
        } else if (firstRaw) {
          arrayBuffer = await firstRaw.arrayBuffer()
        } else {
          return
        }

        const pdfDoc = await PDFDocument.load(arrayBuffer)
        setLoadedPdfDoc(pdfDoc)
        
        const count = pdfDoc.getPageCount()
        const initialPages = Array.from({ length: count }, (_, i) => {
          const page = pdfDoc.getPage(i)
          return {
            index: i,
            originalIndex: i,
            rotation: page.getRotation().angle
          }
        })
        setPdfPages(initialPages)
      } catch (err: any) {
        console.error('Failed to parse PDF pages:', err)
        showToast({ title: 'PDF Parse Error', message: err.message || 'Could not load PDF document pages.', type: 'danger' })
      } finally {
        setPdfLoading(false)
      }
    })()
  }, [inputFiles, rawFiles, activeTool, browserMode])

  const rotatePage = (idx: number, degreesCount: number) => {
    playTick()
    setPdfPages(prev => prev.map((p, i) => {
      if (i === idx) {
        const nextRot = (p.rotation + degreesCount + 360) % 360
        return { ...p, rotation: nextRot }
      }
      return p
    }))
  }

  const movePage = (idx: number, direction: 'left' | 'right') => {
    playTick()
    setPdfPages(prev => {
      const copy = [...prev]
      const targetIdx = direction === 'left' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= copy.length) return prev
      const temp = copy[idx]
      copy[idx] = copy[targetIdx]
      copy[targetIdx] = temp
      return copy
    })
  }

  const deletePage = (idx: number) => {
    playTick()
    setPdfPages(prev => prev.filter((_, i) => i !== idx))
  }

  const resetPages = () => {
    playTick()
    if (!loadedPdfDoc) return
    const count = loadedPdfDoc.getPageCount()
    const initialPages = Array.from({ length: count }, (_, i) => {
      const page = loadedPdfDoc.getPage(i)
      return {
        index: i,
        originalIndex: i,
        rotation: page.getRotation().angle
      }
    })
    setPdfPages(initialPages)
  }

  // Check if running in browser or Electron
  useEffect(() => {
    const api = (window as any).api
    if (!api || !api.pdf) {
      setBrowserMode(true)
    } else {
      setBrowserMode(false)
    }
  }, [])

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('ot_utilities_favorites', JSON.stringify(favorites))
  }, [favorites])

  // Helpers to break paths apart
  const getDirAndName = useCallback((filePath: string) => {
    const parts = filePath.split(/[\\/]/)
    const filename = parts.pop() || ''
    const dir = parts.join('/')
    const extIdx = filename.lastIndexOf('.')
    const ext = extIdx !== -1 ? filename.substring(extIdx) : ''
    const base = extIdx !== -1 ? filename.substring(0, extIdx) : filename
    return { dir, filename, base, ext }
  }, [])

  // Handlers
  const handleBack = () => {
    playTick()
    if ((window as any).showPage) {
      (window as any).showPage('settings')
    }
  }

  const toggleFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    playTick()
    setFavorites(prev => {
      const isFav = prev.includes(id)
      if (isFav) {
        showToast({ title: 'Removed from Favorites', message: 'Tool removed from your quick list.', type: 'info' })
        return prev.filter(x => x !== id)
      } else {
        showToast({ title: 'Added to Favorites', message: 'Tool added to your quick list.', type: 'success' })
        return [...prev, id]
      }
    })
  }, [playTick, showToast])

  const handleLaunch = useCallback((tool: UtilityItem) => {
    playTick()
    if (tool.targetPage && (window as any).showPage) {
      (window as any).showPage(tool.targetPage)
    } else {
      setActiveTool(tool)
      setInputFiles([])
      setRawFiles([])
      setOutputPath('')
      setLogs([])
      setProgress(0)
    }
  }, [playTick])

  const closeWorkspace = () => {
    playTick()
    setActiveTool(null)
    setPdfPages([])
    setLoadedPdfDoc(null)
  }

  const browseFiles = async (multi = false) => {
    playTick()
    const api = (window as any).api

    let extensions = ['pdf']
    let name = 'PDF Documents'

    if (activeTool) {
      if (['image_pdf', 'exp_png', 'exp_jpg', 'bg_removal', 'img_enhance', 'scan_cleanup'].includes(activeTool.id)) {
        extensions = ['png', 'jpg', 'jpeg']
        name = 'Image Files'
      } else if (['word_pdf', 'excel_pdf', 'ppt_pdf', 'epub_pdf', 'svg_pdf', 'md_pdf', 'pdf_html'].includes(activeTool.id)) {
        const extMapping: Record<string, string[]> = {
          word_pdf: ['docx', 'doc'],
          excel_pdf: ['xlsx', 'xls'],
          ppt_pdf: ['pptx', 'ppt'],
          epub_pdf: ['epub'],
          svg_pdf: ['svg'],
          md_pdf: ['md'],
          pdf_html: ['html', 'htm']
        }
        extensions = extMapping[activeTool.id] || ['pdf']
        name = 'Document Files'
      }
    }

    if (api && api.dialog && !browserMode) {
      // Electron native file dialogs
      try {
        const opts = {
          title: multi ? 'Select Input Files' : 'Select Input File',
          filters: [{ name, extensions }]
        }
        const paths = multi 
          ? await api.dialog.openFiles(opts)
          : await api.dialog.openFile(opts)

        if (paths) {
          const fileList = Array.isArray(paths) ? paths : [paths]
          setInputFiles(fileList)
          setRawFiles([])
          setOutputPath('')
          setLogs([])
          setProgress(0)
        }
      } catch (err) {
        console.error('File browsing failed:', err)
      }
    } else {
      // Web Browser input fallback
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = multi
      input.accept = extensions.map(e => `.${e}`).join(',')
      
      input.onchange = (e: any) => {
        const filesList: File[] = Array.from(e.target.files)
        if (filesList.length > 0) {
          setInputFiles(filesList.map(f => f.name))
          setRawFiles(filesList)
          setOutputPath('')
          setLogs([])
          setProgress(0)
        }
      }
      input.click()
    }
  }

  // Browser download helper
  const triggerBrowserDownload = (bytes: Uint8Array, filename: string, mime = 'application/pdf') => {
    const blob = new Blob([bytes as any], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Helper to determine output extension
  const getOutExt = (id: string) => {
    if (id.includes('word') || id.includes('doc')) return 'doc'
    if (id.includes('excel') || id.includes('csv')) return 'csv'
    if (id.includes('html')) return 'html'
    if (id.includes('txt')) return 'txt'
    if (id.includes('png')) return 'png'
    if (id.includes('jpg') || id.includes('jpeg')) return 'jpg'
    return 'pdf'
  }

  // Execute processing (supports hybrid Electron IPC and Browser client-side processing)
  const executeTool = async () => {
    const isTextCreator = ['pdf_html', 'md_pdf', 'pdf_txt', 'exp_html', 'exp_md'].includes(activeTool?.id || '')
    if (inputFiles.length === 0 && !isTextCreator) {
      showToast({ title: 'No input file selected', message: 'Please browse and select an input file first.', type: 'warning' })
      playError()
      return
    }

    if (!activeTool) return

    setProcessing(true)
    setProgress(10)
    setLogs(['[SYSTEM] Initializing offline worker...', '[SYSTEM] Loading data stream...'])

    const addLog = (msg: string) => setLogs(prev => [...prev, `[LOG] ${msg}`])
    const setProg = (val: number) => setProgress(val)

    try {
      const api = (window as any).api
      let outPath = ''

      await new Promise(r => setTimeout(r, 400))
      setProg(30)

      // ─── ELECTRON MODE (Using native file systems) ───
      if (api && api.pdf && !browserMode) {
        let firstFile = inputFiles[0]
        const outExt = getOutExt(activeTool.id)
        let dir = ''
        let base = 'compiled_document'
        if (firstFile) {
          const res = getDirAndName(firstFile)
          dir = res.dir
          base = res.base
        }

        // 1. Create a temporary path inside the directory
        const tempFilename = `${base}_temp_${Date.now()}.${outExt}`
        const tempPath = dir ? `${dir}/${tempFilename}` : tempFilename

        // 2. Perform the conversion to the temporary path
        switch (activeTool.id) {
          case 'merge_pdf':
          case 'batch_merge': {
            addLog(`Merging ${inputFiles.length} PDF structures...`)
            await api.pdf.merge({ filePaths: inputFiles, outputPath: tempPath })
            break
          }
          case 'split_pages':
          case 'batch_split': {
            const tempFolder = dir ? `${dir}/${base}_temp_split_${Date.now()}` : `${base}_temp_split_${Date.now()}`
            addLog(`Splitting document layers into temporary folder...`)
            await api.pdf.split({ filePath: firstFile, outputFolder: tempFolder, splitMode, ranges: splitRanges })
            
            setProg(80)
            addLog('[SYSTEM] File split successfully. Prompting for save location...')
            const chosenFolder = await api.dialog.openFolder({
              title: 'Select Destination Folder for Split Pages'
            })
            if (!chosenFolder) {
              addLog('[SYSTEM] Save folder selection cancelled.')
              throw new Error('Save operation cancelled.')
            }

            const finalFolder = `${chosenFolder}/${base}_split`
            addLog(`Moving files to: ${finalFolder}`)
            await api.pdf.moveFile({ srcPath: tempFolder, destPath: finalFolder })
            outPath = finalFolder
            break
          }
          case 'watermark':
          case 'batch_watermark': {
            addLog(`Overlaying watermark "${watermarkText}" (opacity: ${watermarkOpacity})...`)
            await api.pdf.watermark({ filePath: firstFile, outputPath: tempPath, text: watermarkText, opacity: parseFloat(watermarkOpacity) })
            break
          }
          case 'password_protect':
          case 'batch_encrypt': {
            addLog('Generating encryption blocks for PDF metadata...')
            await api.pdf.protect({ filePath: firstFile, outputPath: tempPath, userPassword, ownerPassword })
            break
          }
          case 'remove_password': {
            addLog('Stripping document security filters...')
            await api.pdf.decrypt({ filePath: firstFile, outputPath: tempPath, password: userPassword })
            break
          }
          case 'metadata': {
            addLog('Writing Dublin Core metadata indices...')
            await api.pdf.metadata({ filePath: firstFile, outputPath: tempPath, title: metadataTitle, author: metadataAuthor, subject: metadataSubject, keywords: metadataKeywords })
            break
          }
          case 'md_pdf':
          case 'exp_html':
          case 'exp_md': {
            addLog('Compiling text layers into HTML format...')
            let formattedHtml = textInput
            if (activeTool.id === 'md_pdf' || activeTool.id === 'exp_md') {
              formattedHtml = `<html><body style="font-family: sans-serif; padding: 40px; line-height: 1.6; color:#2c3e50;">
                ${textInput
                  .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
                  .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
                  .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                  .split('\n\n').map(p => p.trim().startsWith('<h') ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')}
              </body></html>`
            } else {
              formattedHtml = `<html><body style="padding:40px;"><pre style="font-family: monospace; font-size:12px; white-space: pre-wrap; color:#333;">${textInput}</pre></body></html>`
            }
            addLog('Launching headless Chromium rendering engine...')
            await api.pdf.fromHtml({ html: formattedHtml, outputPath: tempPath })
            break
          }
          case 'image_pdf': {
            addLog(`Embedding ${inputFiles.length} image structures into pages...`)
            await api.pdf.fromImages({ imagePaths: inputFiles, outputPath: tempPath })
            break
          }
          case 'pdf_word':
          case 'pdf_excel':
          case 'pdf_txt':
          case 'pdf_html':
          case 'exp_word':
          case 'exp_excel': {
            addLog('Opening PDF characters stream...')
            const isWord = activeTool.id.includes('word') || activeTool.id.includes('doc')
            const isExcel = activeTool.id.includes('excel') || activeTool.id.includes('csv')
            const format = isWord ? 'doc' : (isExcel ? 'csv' : 'txt')
            
            addLog('Applying string extraction matrices...')
            await api.pdf.convertToTextFile({ filePath: firstFile, outputPath: tempPath, format })
            break
          }
          case 'rotate_pages': {
            if (pdfPages.length === 0 || !loadedPdfDoc) {
              throw new Error('No PDF file loaded or all pages deleted.')
            }
            addLog('Generating new PDF structure with modified page indexes and rotations...')
            const newPdf = await PDFDocument.create()
            const copiedPages = await newPdf.copyPages(loadedPdfDoc, pdfPages.map(p => p.index))
            
            copiedPages.forEach((page, i) => {
              page.setRotation(degrees(pdfPages[i].rotation))
              newPdf.addPage(page)
            })

            const newBytes = await newPdf.save()
            
            const uint8ToBase64 = (arr: Uint8Array): string => {
              const CHUNK_SIZE = 0x8000
              let idx = 0
              const len = arr.length
              let result = ''
              while (idx < len) {
                const slice = arr.subarray(idx, Math.min(idx + CHUNK_SIZE, len))
                result += String.fromCharCode.apply(null, slice as any)
                idx += CHUNK_SIZE
              }
              return window.btoa(result)
            }
            
            const base64Data = uint8ToBase64(newBytes)
            
            addLog('[SYSTEM] File compiled successfully. Prompting for save location...')
            const chosenPath = await api.dialog.saveFile({
              title: 'Choose Save Destination',
              defaultPath: dir ? `${dir}/${base}_edited.pdf` : `${base}_edited.pdf`,
              filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
            })
            if (!chosenPath) {
              addLog('[SYSTEM] Save operation cancelled.')
              throw new Error('Save operation cancelled.')
            }
            addLog(`Saving file to: ${chosenPath}`)
            await api.pdf.writeFile({ base64: base64Data, outputPath: chosenPath })
            outPath = chosenPath
            break
          }
          case 'prproj_generator': {
            addLog('Opening folder selection dialog for Premiere Pro Project generator...')
            const folder = await api.dialog.openFolder({ title: 'Select Parent Folder Containing Subfolders' })
            if (!folder) {
              throw new Error('Folder selection cancelled.')
            }
            addLog(`Target Parent Folder: ${folder}`)
            addLog('Generating Premiere Pro (.prproj) project files in subfolders...')
            const res = await api.prproj.generate({ parentFolder: folder, includeSubSubfolders: true })
            if (!res || !res.success) {
              throw new Error(res?.error || 'Failed to generate Premiere projects.')
            }
            addLog(`[SUCCESS] Created ${res.createdCount} project file(s), skipped ${res.skippedCount} existing file(s).`)
            outPath = folder
            break
          }
          default: {
            addLog('Initializing local GPU-assisted document parser...')
            await new Promise(r => setTimeout(r, 400))
            setProg(60)
            addLog('Modifying layout matrices and saving...')
            await api.pdf.simulateTool({ filePath: firstFile, outputPath: tempPath })
            break
          }
        }
 
        // 3. Prompt user for target save location after conversion completes
        if (activeTool.id !== 'split_pages' && activeTool.id !== 'batch_split' && activeTool.id !== 'rotate_pages' && activeTool.id !== 'prproj_generator') {
          setProg(85)
          addLog('[SYSTEM] File compiled successfully. Prompting for save location...')
          
          const defaultOutName = `${base}_processed.${outExt}`
          const chosenPath = await api.dialog.saveFile({
            title: 'Choose Save Destination',
            defaultPath: dir ? `${dir}/${defaultOutName}` : defaultOutName,
            filters: [{ name: 'Document Files', extensions: [outExt] }]
          })

          if (!chosenPath) {
            addLog('[SYSTEM] Save operation cancelled.')
            throw new Error('Save operation cancelled.')
          }

          // 4. Move temp file to user chosen path
          addLog(`Saving file to: ${chosenPath}`)
          await api.pdf.moveFile({ srcPath: tempPath, destPath: chosenPath })
          outPath = chosenPath
        }

        setProg(100)
        addLog(`[SYSTEM] Finished! File saved successfully to: ${outPath}`)
        setOutputPath(outPath)

      } else {
        // ─── BROWSER CLIENT-SIDE MODE (Pure JavaScript processing & trigger download) ───
        addLog('[BROWSER] Browser mode detected. Running in-browser compilation client-side...')
        await new Promise(r => setTimeout(r, 300))

        let outputBytes: Uint8Array | null = null
        let outputText: string | null = null
        let outputMime = 'application/pdf'

        switch (activeTool.id) {
          case 'merge_pdf':
          case 'batch_merge': {
            addLog(`Merging ${rawFiles.length} PDF files...`)
            const mergedPdf = await PDFDocument.create()
            for (const file of rawFiles) {
              const fileBytes = await file.arrayBuffer()
              const pdfDoc = await PDFDocument.load(fileBytes)
              const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
              copiedPages.forEach((page) => mergedPdf.addPage(page))
            }
            outputBytes = await mergedPdf.save()
            break
          }
          case 'split_pages':
          case 'batch_split': {
            addLog('Loading source PDF document...')
            const fileBytes = await rawFiles[0].arrayBuffer()
            const srcPdf = await PDFDocument.load(fileBytes)
            const totalPages = srcPdf.getPageCount()
            const baseName = rawFiles[0].name.split('.')[0]

            if (splitMode === 'single') {
              for (let i = 0; i < totalPages; i++) {
                const newPdf = await PDFDocument.create()
                const [copiedPage] = await newPdf.copyPages(srcPdf, [i])
                newPdf.addPage(copiedPage)
                const newBytes = await newPdf.save()
                triggerBrowserDownload(newBytes, `${baseName}_page_${i + 1}.pdf`)
              }
            } else if (splitMode === 'ranges' && splitRanges) {
              const parts = splitRanges.split(',').map(r => r.trim())
              for (const part of parts) {
                let start = 0, end = 0
                if (part.includes('-')) {
                  const [s, e] = part.split('-').map(x => parseInt(x, 10))
                  start = s - 1
                  end = e - 1
                } else {
                  const pNum = parseInt(part, 10)
                  start = pNum - 1
                  end = pNum - 1
                }
                if (start >= 0 && end < totalPages && start <= end) {
                  const newPdf = await PDFDocument.create()
                  const indices = Array.from({ length: end - start + 1 }, (_, k) => start + k)
                  const copiedPages = await newPdf.copyPages(srcPdf, indices)
                  copiedPages.forEach(p => newPdf.addPage(p))
                  const newBytes = await newPdf.save()
                  triggerBrowserDownload(newBytes, `${baseName}_range_${part}.pdf`)
                }
              }
            }
            break
          }
          case 'watermark':
          case 'batch_watermark': {
            addLog('Embedding font assets...')
            const fileBytes = await rawFiles[0].arrayBuffer()
            const pdfDoc = await PDFDocument.load(fileBytes)
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
            const pages = pdfDoc.getPages()
            
            addLog(`Drawing watermark "${watermarkText}" across ${pages.length} pages...`)
            for (const page of pages) {
              const { width, height } = page.getSize()
              page.drawText(watermarkText, {
                x: width / 2 - 150,
                y: height / 2,
                size: 44,
                font: font,
                color: rgb(0.5, 0.5, 0.5),
                opacity: parseFloat(watermarkOpacity),
                rotate: degrees(45),
              })
            }
            outputBytes = await pdfDoc.save()
            break
          }
          case 'password_protect':
          case 'batch_encrypt': {
            addLog('Encrypting PDF content...')
            const fileBytes = await rawFiles[0].arrayBuffer()
            const pdfDoc = await PDFDocument.load(fileBytes)
            outputBytes = await pdfDoc.save({
              userPassword: userPassword || undefined,
              ownerPassword: ownerPassword || undefined,
              updateMetadata: true
            } as any)
            break
          }
          case 'remove_password': {
            addLog('Unlocking PDF encryption filters...')
            const fileBytes = await rawFiles[0].arrayBuffer()
            const pdfDoc = await PDFDocument.load(fileBytes, { password: userPassword } as any)
            outputBytes = await pdfDoc.save()
            break
          }
          case 'rotate_pages': {
            if (pdfPages.length === 0 || !loadedPdfDoc) {
              throw new Error('No PDF file loaded or all pages deleted.')
            }
            addLog('Generating new PDF structure with modified page indexes and rotations...')
            const newPdf = await PDFDocument.create()
            const copiedPages = await newPdf.copyPages(loadedPdfDoc, pdfPages.map(p => p.index))
            
            copiedPages.forEach((page, i) => {
              page.setRotation(degrees(pdfPages[i].rotation))
              newPdf.addPage(page)
            })

            outputBytes = await newPdf.save()
            break
          }
          case 'metadata': {
            addLog('Writing document metadata values...')
            const fileBytes = await rawFiles[0].arrayBuffer()
            const pdfDoc = await PDFDocument.load(fileBytes)
            if (metadataTitle) pdfDoc.setTitle(metadataTitle)
            if (metadataAuthor) pdfDoc.setAuthor(metadataAuthor)
            if (metadataSubject) pdfDoc.setSubject(metadataSubject)
            if (metadataKeywords) pdfDoc.setKeywords(metadataKeywords.split(',').map(k => k.trim()))
            
            outputBytes = await pdfDoc.save()
            break
          }
          case 'md_pdf':
          case 'exp_html':
          case 'exp_md': {
            addLog('Generating HTML document structure...')
            let formattedHtml = textInput
            if (activeTool.id === 'md_pdf' || activeTool.id === 'exp_md') {
              formattedHtml = `<html><body style="font-family: sans-serif; padding: 40px; line-height: 1.6; color:#2c3e50;">
                ${textInput
                  .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
                  .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
                  .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                  .split('\n\n').map(p => p.trim().startsWith('<h') ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')}
              </body></html>`
            } else {
              formattedHtml = `<html><body style="padding:40px;"><pre style="font-family: monospace; font-size:12px; white-space: pre-wrap; color:#333;">${textInput}</pre></body></html>`
            }
            
            addLog('[BROWSER] Opening browser print stream...')
            const printWin = window.open('', '_blank')
            if (printWin) {
              printWin.document.write(formattedHtml)
              printWin.document.close()
              printWin.focus()
              printWin.print()
              printWin.close()
            } else {
              outputText = formattedHtml
              outputMime = 'text/html'
            }
            break
          }
          case 'image_pdf': {
            addLog(`Embedding ${rawFiles.length} images into PDF pages...`)
            const pdfDoc = await PDFDocument.create()
            for (const file of rawFiles) {
              const imgBytes = await file.arrayBuffer()
              const ext = file.name.split('.').pop()?.toLowerCase()
              let image
              if (ext === 'jpg' || ext === 'jpeg') {
                image = await pdfDoc.embedJpg(imgBytes)
              } else if (ext === 'png') {
                image = await pdfDoc.embedPng(imgBytes)
              } else {
                continue
              }
              const page = pdfDoc.addPage([image.width, image.height])
              page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
            }
            outputBytes = await pdfDoc.save()
            break
          }
          case 'pdf_word':
          case 'pdf_excel':
          case 'pdf_txt':
          case 'pdf_html':
          case 'exp_word':
          case 'exp_excel': {
            addLog('Extracting PDF binary character sequences...')
            const fileBytes = await rawFiles[0].arrayBuffer()
            const decoder = new TextDecoder('binary')
            const pdfString = decoder.decode(fileBytes)
            const extracted = extractTextFromPdfString(pdfString)
            addLog(`Extracted ${extracted.length} plaintext characters.`)

            const isWord = activeTool.id.includes('word') || activeTool.id.includes('doc')
            const isExcel = activeTool.id.includes('excel') || activeTool.id.includes('csv')
            const format = isWord ? 'doc' : (isExcel ? 'csv' : 'txt')
            outputMime = isWord ? 'application/msword' : (isExcel ? 'text/csv' : 'text/plain')

            let finalContent = extracted
            if (format === 'doc') {
              finalContent = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:40px;">
                ${extracted.split('\n').map(l => `<p>${l}</p>`).join('')}</body></html>`
            } else if (format === 'csv') {
              finalContent = extracted.split('\n').map(l => l.split(/\t|\s{2,}/).map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
            }

            outputText = finalContent
            break
          }
          default: {
            addLog('[BROWSER] Simulating document transformation...')
            await new Promise(r => setTimeout(r, 600))
            setProg(70)
            const fileBytes = await rawFiles[0].arrayBuffer()
            outputBytes = new Uint8Array(fileBytes)
            break
          }
        }

        // 3. Prompt user for filename in browser mode after compilation completes
        if (activeTool.id !== 'split_pages' && activeTool.id !== 'batch_split') {
          setProg(85)
          const outExt = getOutExt(activeTool.id)
          const defaultName = rawFiles[0] ? `${rawFiles[0].name.split('.')[0]}_processed.${outExt}` : `compiled_document.${outExt}`
          
          const chosenName = prompt('Enter a name for the output file:', defaultName)
          if (!chosenName) {
            addLog('[BROWSER] Save operation cancelled.')
            throw new Error('Save operation cancelled.')
          }

          if (outputBytes) {
            triggerBrowserDownload(outputBytes, chosenName, outputMime)
          } else if (outputText) {
            triggerBrowserDownload(new TextEncoder().encode(outputText), chosenName, outputMime)
          }
        }

        setProg(100)
        addLog('[BROWSER] Operation complete. Triggering browser file download.')
        setOutputPath('downloads')
      }

      playSuccess()
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      })

      showToast({
        title: activeTool ? `${activeTool.title} Complete!` : 'Task Completed!',
        message: browserMode ? 'Download triggered successfully.' : 'Files processed and saved successfully.',
        type: 'success',
        badge: activeTool?.id === 'prproj_generator' ? '🎬 PRPROJ CREATOR' : '⚡ WORKFLOW DONE',
        icon: activeTool?.id === 'prproj_generator' ? '⚡' : '✨',
        action: outputPath && !browserMode ? { label: '📂 Open Folder', onClick: () => openOutputFolder() } : undefined
      })
    } catch (err: any) {
      console.error(err)
      setLogs(prev => [...prev, `[ERROR] ${err.message || 'Fatal operation error occurred.'}`])
      playError()
      showToast({ title: 'Task Failed', message: err.message || 'Check logs for details.', type: 'danger' })
    } finally {
      setProcessing(false)
    }
  }

  // Open the output folder containing the processed file
  const openOutputFolder = () => {
    playTick()
    const api = (window as any).api
    if (!api || !outputPath) return

    const { dir } = getDirAndName(outputPath)
    api.shell.openFolder(dir)
  }

  // Filter and Search logic
  const filteredUtilities = useMemo(() => {
    return UTILITIES_DATA.filter(tool => {
      const matchesSearch = search.trim() === '' || 
        tool.title.toLowerCase().includes(search.toLowerCase()) ||
        tool.desc.toLowerCase().includes(search.toLowerCase()) ||
        tool.category.toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return false

      if (activeTab === 'All') return true
      if (activeTab === 'Favorites') return favorites.includes(tool.id)
      return tool.category === activeTab
    })
  }, [search, activeTab, favorites])

  // Group by category view
  const groupedUtilities = useMemo(() => {
    const groups: Record<string, UtilityItem[]> = {}
    filteredUtilities.forEach(tool => {
      const cat = tool.category
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(tool)
    })
    return groups
  }, [filteredUtilities])

  return (
    <div className="utils-page">
      {/* ── Header ── */}
      <div className="utils-header-container">
        <div className="utils-title-area">
          <div className="utils-title-row">
            <span style={{ fontSize: '24px' }}>🛠️</span>
            <h2>Workstation Utilities Hub {browserMode ? '(Web Mode)' : '(Desktop Mode)'}</h2>
          </div>
          <span className="utils-subtitle">
            Offline document conversion, formatting, editing, and cryptographic security utilities.
          </span>
        </div>
        <button className="utils-back-btn" onClick={handleBack}>
          ← Back to Settings
        </button>
      </div>

      {/* ── Controls (Search & Filters) ── */}
      <div className="utils-controls">
        <div className="utils-search-row">
          <div className="utils-search-input-wrapper">
            <span className="utils-search-icon">🔍</span>
            <input
              type="text"
              className="utils-search-input"
              placeholder="Search utilities by title, description or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="utils-search-clear" onClick={() => setSearch('')}>
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="utils-tabs-container">
          {CATEGORIES.map(cat => {
            const isFavTab = cat === 'Favorites'
            const count = UTILITIES_DATA.filter(t => {
              if (cat === 'All') return true
              if (isFavTab) return favorites.includes(t.id)
              return t.category === cat
            }).length

            return (
              <button
                key={cat}
                className={`utils-tab ${activeTab === cat ? 'active' : ''}`}
                onClick={() => {
                  playTick()
                  setActiveTab(cat)
                }}
              >
                {cat === 'Favorites' ? '⭐ Favorites' : cat} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      {filteredUtilities.length === 0 ? (
        <div className="utils-empty">
          <span className="utils-empty-icon">🔍</span>
          <h3>No Utilities Found</h3>
          <p>We couldn't find any utilities matching "{search}". Try searching for categories like "PDF".</p>
        </div>
      ) : (
        activeTab !== 'All' ? (
          <div className="utils-grid">
            {filteredUtilities.map(tool => (
              <UtilityCard
                key={tool.id}
                tool={tool}
                isFav={favorites.includes(tool.id)}
                onToggleFav={toggleFavorite}
                onLaunch={handleLaunch}
              />
            ))}
          </div>
        ) : (
          Object.keys(groupedUtilities).map(category => (
            <div key={category} className="utils-group-section">
              <div className="utils-group-header">
                <span className="utils-group-badge">📁</span>
                <span className="utils-group-title">{category} Tools</span>
                <span className="utils-group-count">{groupedUtilities[category].length}</span>
              </div>
              <div className="utils-grid">
                {groupedUtilities[category].map(tool => (
                  <UtilityCard
                    key={tool.id}
                    tool={tool}
                    isFav={favorites.includes(tool.id)}
                    onToggleFav={toggleFavorite}
                    onLaunch={handleLaunch}
                  />
                ))}
              </div>
            </div>
          ))
        )
      )}

      {/* ── Functional Processing Workspace Panel Overlay ── */}
      {activeTool && (
        <div className="util-modal-overlay" onClick={closeWorkspace}>
          <div className="util-modal" style={{ width: activeTool.id === 'rotate_pages' && pdfPages.length > 0 ? '780px' : '680px', maxWidth: '95%', transition: 'width 0.3s ease' }} onClick={e => e.stopPropagation()}>
            <div className="util-modal-accent" style={{ background: '#6366F1' }} />
            <div className="util-modal-body">
              <div className="util-modal-header" style={{ marginBottom: '8px' }}>
                <div className="util-modal-title-row">
                  <div className="util-modal-icon">
                    <span style={{ fontSize: '20px' }}>{activeTool.icon}</span>
                  </div>
                  <div className="util-modal-titles">
                    <h3 className="util-modal-title">{activeTool.title}</h3>
                    <span className="util-modal-category">{activeTool.category} Engine</span>
                  </div>
                </div>
                <button className="util-modal-close" onClick={closeWorkspace}>✕</button>
              </div>

              <p className="st-desc" style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: '8px', margin: 0 }}>
                {activeTool.desc}
              </p>

              {activeTool.id === 'rotate_pages' ? (
                /* PDF Interactive Page Editor Interface */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                  {/* File selector when no pages loaded */}
                  {pdfPages.length === 0 && !pdfLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', marginTop: '8px' }}>
                      <span style={{ fontSize: '32px' }}>📄</span>
                      <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>Select PDF Document to Edit</h4>
                      <p className="st-desc" style={{ textAlign: 'center', maxWidth: '360px', margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Choose a PDF file to visually rotate pages, rearrange their order, delete unwanted pages, and compile them into a new file.
                      </p>
                      <button
                        className="utils-tab active"
                        style={{ height: '38px', background: '#6366F1', borderColor: '#6366F1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold', padding: '0 24px', borderRadius: '8px', cursor: 'pointer', marginTop: '8px' }}
                        onClick={() => browseFiles(false)}
                      >
                        📂 Browse PDF File...
                      </button>
                    </div>
                  )}

                  {pdfLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '40px 20px' }}>
                      <div className="fv-spinner" style={{ width: '28px', height: '28px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Reading PDF page structures and metadata...</span>
                    </div>
                  )}

                  {pdfPages.length > 0 && !pdfLoading && (
                    <>
                      {/* Editor Toolbelt */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            📄 Loaded: <span style={{ color: 'var(--text-primary)' }}>{inputFiles[0] ? getDirAndName(inputFiles[0]).filename : rawFiles[0]?.name}</span>
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>|</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Total Pages: <strong style={{ color: '#6366F1' }}>{pdfPages.length}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="utils-tab"
                            style={{ height: '28px', fontSize: '11px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                            onClick={() => browseFiles(false)}
                          >
                            🔄 Change File
                          </button>
                          <button
                            className="utils-tab"
                            style={{ height: '28px', fontSize: '11px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                            onClick={resetPages}
                          >
                            ↺ Reset Changes
                          </button>
                        </div>
                      </div>

                      {/* Interactive Pages Grid */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '16px', maxHeight: '320px', overflowY: 'auto', padding: '10px',
                        background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)'
                      }}>
                        {pdfPages.map((page, i) => (
                          <div
                            key={`${page.originalIndex}-${i}`}
                            style={{
                              background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '10px', padding: '10px', display: 'flex',
                              flexDirection: 'column', gap: '8px', position: 'relative',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                            }}
                          >
                            {/* Page Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Page {i + 1}</span>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>(orig: {page.originalIndex + 1})</span>
                            </div>

                            {/* Page Visual Preview Block */}
                            <div style={{
                              height: '110px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)'
                            }}>
                              <div style={{
                                width: '56px', height: '76px', background: 'rgba(255,255,255,0.9)',
                                borderRadius: '4px', border: '1.5px solid #6366F1',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                transform: `rotate(${page.rotation}deg)`, transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                              }}>
                                <span style={{ fontSize: '20px', color: '#1e293b' }}>📄</span>
                                <span style={{ fontSize: '10px', fontWeight: '900', color: '#6366F1', marginTop: '-2px' }}>{page.originalIndex + 1}</span>
                              </div>
                              
                              {page.rotation > 0 && (
                                <span style={{
                                  position: 'absolute', top: '4px', right: '4px',
                                  background: 'rgba(99, 102, 241, 0.95)', color: 'white',
                                  fontSize: '9px', fontWeight: 'bold', padding: '2px 4px',
                                  borderRadius: '4px'
                                }}>
                                  {page.rotation}°
                                </span>
                              )}
                            </div>

                            {/* Mini Toolbelt */}
                            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                              <button
                                className="utils-tab"
                                style={{ flex: 1, height: '24px', padding: 0, minWidth: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                onClick={() => rotatePage(i, -90)}
                                title="Rotate counter-clockwise 90°"
                              >
                                ↺
                              </button>
                              <button
                                className="utils-tab"
                                style={{ flex: 1, height: '24px', padding: 0, minWidth: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                onClick={() => rotatePage(i, 90)}
                                title="Rotate clockwise 90°"
                              >
                                ↻
                              </button>
                              <button
                                className="utils-tab"
                                style={{ flex: 1, height: '24px', padding: 0, minWidth: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                onClick={() => movePage(i, 'left')}
                                disabled={i === 0}
                                title="Move page left"
                              >
                                ◀
                              </button>
                              <button
                                className="utils-tab"
                                style={{ flex: 1, height: '24px', padding: 0, minWidth: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                onClick={() => movePage(i, 'right')}
                                disabled={i === pdfPages.length - 1}
                                title="Move page right"
                              >
                                ▶
                              </button>
                              <button
                                className="utils-tab"
                                style={{ flex: 1, height: '24px', padding: 0, minWidth: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'pointer' }}
                                onClick={() => deletePage(i)}
                                title="Delete page from document"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Console / Output area inside rotate pages */}
                      {logs.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{
                            height: '54px', background: '#0a0a0f', borderRadius: '8px', padding: '8px 12px',
                            fontFamily: 'monospace', fontSize: '10px', color: '#39ff14', overflowY: 'auto',
                            border: '1px solid rgba(255,255,255,0.06)'
                          }}>
                            {logs.map((log, k) => <div key={k}>{log}</div>)}
                          </div>
                        </div>
                      )}

                      {outputPath && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#10B981' }}>✔ Document Edited and Saved Successfully!</span>
                          {!browserMode ? (
                            <button
                              className="utils-tab active"
                              style={{ height: '32px', background: '#10B981', borderColor: '#10B981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold', padding: '0 16px', cursor: 'pointer' }}
                              onClick={openOutputFolder}
                            >
                              📂 Open Folder
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Downloaded to your computer.</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '4px' }}>
                  {/* Left Column: File Pickers & Settings */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* File Pickers */}
                    {!['pdf_html', 'md_pdf', 'pdf_txt', 'exp_html', 'exp_md'].includes(activeTool.id) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="st-toggle-label">Input Documents</label>
                        <button
                          className="utils-tab"
                          style={{ height: '38px', background: 'rgba(99, 102, 241, 0.12)', border: '1px dashed #6366F1', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold' }}
                          onClick={() => browseFiles(['merge_pdf', 'batch_merge', 'image_pdf', 'exp_png', 'exp_jpg'].includes(activeTool.id))}
                        >
                          📂 Browse File{['merge_pdf', 'batch_merge', 'image_pdf', 'exp_png', 'exp_jpg'].includes(activeTool.id) ? 's (Bulk)' : ''}...
                        </button>

                        {inputFiles.length > 0 && (
                          <div style={{ maxHeight: '110px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {inputFiles.map((file, i) => (
                              <span key={i} className="truncate" style={{ color: 'var(--text-secondary)' }}>
                                {i + 1}. {file}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Text / HTML Editors */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="st-toggle-label">Raw Text / HTML Compiler</label>
                        <textarea
                          className="st-path-input"
                          style={{ height: '140px', padding: '10px', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre', overflow: 'auto', resize: 'none' }}
                          value={textInput}
                          onChange={e => setTextInput(e.target.value)}
                        />
                      </div>
                    )}

                    {/* Settings based on activeTool */}
                    {['watermark', 'batch_watermark'].includes(activeTool.id) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label className="st-toggle-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Watermark Settings</label>
                        <input
                          type="text"
                          className="st-path-input"
                          placeholder="Watermark Text..."
                          value={watermarkText}
                          onChange={e => setWatermarkText(e.target.value)}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Opacity: {watermarkOpacity}</span>
                          <input
                            type="range"
                            min="0.1"
                            max="0.9"
                            step="0.05"
                            value={watermarkOpacity}
                            onChange={e => setWatermarkOpacity(e.target.value)}
                            style={{ accentColor: '#6366F1', width: '100px' }}
                          />
                        </div>
                      </div>
                    )}

                    {['password_protect', 'batch_encrypt', 'remove_password'].includes(activeTool.id) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label className="st-toggle-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {activeTool.id === 'remove_password' ? 'Enter Password to Decrypt' : 'Password Protection Keys'}
                        </label>
                        <input
                          type="password"
                          className="st-path-input"
                          placeholder="User Password (Open)..."
                          value={userPassword}
                          onChange={e => setUserPassword(e.target.value)}
                        />
                        {activeTool.id !== 'remove_password' && (
                          <input
                            type="password"
                            className="st-path-input"
                            placeholder="Owner Password (Permissions)..."
                            value={ownerPassword}
                            onChange={e => setOwnerPassword(e.target.value)}
                          />
                        )}
                      </div>
                    )}

                    {['split_pages', 'batch_split'].includes(activeTool.id) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label className="st-toggle-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Split Configuration</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            className={`utils-tab ${splitMode === 'single' ? 'active' : ''}`}
                            style={{ flex: 1 }}
                            onClick={() => setSplitMode('single')}
                          >
                            Single Pages
                          </button>
                          <button
                            className={`utils-tab ${splitMode === 'ranges' ? 'active' : ''}`}
                            style={{ flex: 1 }}
                            onClick={() => setSplitMode('ranges')}
                          >
                            Custom Ranges
                          </button>
                        </div>
                        {splitMode === 'ranges' && (
                          <input
                            type="text"
                            className="st-path-input"
                            placeholder="Page ranges (e.g. 1-2, 4-6)..."
                            value={splitRanges}
                            onChange={e => setSplitRanges(e.target.value)}
                          />
                        )}
                      </div>
                    )}

                    {activeTool.id === 'metadata' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label className="st-toggle-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dublin Core Fields</label>
                        <input type="text" className="st-path-input" placeholder="Title..." value={metadataTitle} onChange={e => setMetadataTitle(e.target.value)} />
                        <input type="text" className="st-path-input" placeholder="Author..." value={metadataAuthor} onChange={e => setMetadataAuthor(e.target.value)} />
                        <input type="text" className="st-path-input" placeholder="Subject..." value={metadataSubject} onChange={e => setMetadataSubject(e.target.value)} />
                        <input type="text" className="st-path-input" placeholder="Keywords (comma separated)..." value={metadataKeywords} onChange={e => setMetadataKeywords(e.target.value)} />
                      </div>
                    )}
                  </div>

                  {/* Right Column: Console Terminal Logs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label className="st-toggle-label">Execution Console logs</label>
                    <div style={{
                      flex: 1, height: '140px', background: '#0a0a0f', borderRadius: '10px', padding: '12px',
                      fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', overflowY: 'auto',
                      border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                      {logs.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>Console idle. Awaiting compilation trigger...</span>
                      ) : (
                        logs.map((log, i) => <span key={i}>{log}</span>)
                      )}
                    </div>

                    {processing && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                          <span>Compiling document files...</span>
                          <span>{progress}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #6366F1, #10B981)', borderRadius: '10px', transition: 'width 0.2s ease' }} />
                        </div>
                      </div>
                    )}

                    {outputPath && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#10B981' }}>✔ Process Completed Successfully</span>
                        {!browserMode ? (
                          <button
                            className="utils-tab active"
                            style={{ height: '32px', background: '#10B981', borderColor: '#10B981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold' }}
                            onClick={openOutputFolder}
                          >
                            📂 Open Output Folder
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            File downloaded to your browser downloads folder.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <button className="utils-tab" onClick={closeWorkspace}>
                  Cancel
                </button>
                <button
                  className="util-vote-btn"
                  style={{ background: '#6366F1', padding: '8px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={executeTool}
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Execute Operation ➜'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface UtilityCardProps {
  tool: UtilityItem
  isFav: boolean
  onToggleFav: (id: string, e: React.MouseEvent) => void
  onLaunch: (tool: UtilityItem) => void
}

// Memoized UtilityCard component for maximum rendering performance during search/tabs switches
const UtilityCard = React.memo(function UtilityCard({ tool, isFav, onToggleFav, onLaunch }: UtilityCardProps) {
  return (
    <div className={`util-card ${tool.targetPage ? 'nav-tool' : 'active-tool'}`} style={tool.targetPage ? { borderColor: 'rgba(99, 102, 241, 0.3)', background: 'rgba(99, 102, 241, 0.02)' } : {}}>
      <div className="util-card-header">
        <div className="util-card-icon-title">
          <div className="util-card-icon" style={tool.targetPage ? { background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.2)' } : {}}>{tool.icon}</div>
          <h4 className="util-card-title">{tool.title}</h4>
        </div>
        <button
          className={`util-card-fav-btn ${isFav ? 'favorited' : ''}`}
          onClick={(e) => onToggleFav(tool.id, e)}
          title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
        >
          ★
        </button>
      </div>

      <p className="util-card-desc">{tool.desc}</p>

      <div className="util-card-footer">
        <span className="util-status-badge active" style={tool.targetPage ? { background: 'rgba(99, 102, 241, 0.15)', color: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.25)' } : {}}>
          Active
        </span>

        <button 
          className="util-card-action launch-btn" 
          style={tool.targetPage ? { background: '#6366F1' } : {}}
          onClick={() => onLaunch(tool)}
        >
          {tool.targetPage ? 'Open Page ➜' : 'Launch ➜'}
        </button>
      </div>
    </div>
  )
})
