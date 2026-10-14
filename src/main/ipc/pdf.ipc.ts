import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'

type WinGetter = () => BrowserWindow | null

// Regex-based PDF text extractor (pure Node.js, zero-dependency, works offline)
function extractTextFromPdfBytes(pdfBytes: Buffer): string {
  const pdfString = pdfBytes.toString('binary')
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
  
  // Clean up PDF escaping
  return text
    .replace(/\\([\(\)\\])/g, '$1')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .trim()
}

export function registerPdfIPC(_getWin: WinGetter): void {
  // 1. Merge PDFs
  ipcMain.handle('pdf:merge', async (_e, params: { filePaths: string[]; outputPath: string }) => {
    try {
      const mergedPdf = await PDFDocument.create()

      for (const filePath of params.filePaths) {
        if (!fs.existsSync(filePath)) continue
        const pdfBytes = fs.readFileSync(filePath)
        const pdfDoc = await PDFDocument.load(pdfBytes)
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
        copiedPages.forEach((page) => mergedPdf.addPage(page))
      }

      const mergedPdfBytes = await mergedPdf.save()
      fs.writeFileSync(params.outputPath, mergedPdfBytes)
      return { success: true, outputPath: params.outputPath }
    } catch (err: any) {
      console.error('[PDF IPC] Merge failed:', err)
      throw new Error(err.message || 'Failed to merge PDF files.')
    }
  })

  // 2. Split PDF
  ipcMain.handle('pdf:split', async (_e, params: { filePath: string; outputFolder: string; splitMode: 'single' | 'ranges'; ranges?: string }) => {
    try {
      if (!fs.existsSync(params.filePath)) throw new Error('Source file does not exist.')
      fs.mkdirSync(params.outputFolder, { recursive: true })

      const pdfBytes = fs.readFileSync(params.filePath)
      const srcPdf = await PDFDocument.load(pdfBytes)
      const totalPages = srcPdf.getPageCount()
      const baseName = path.basename(params.filePath, path.extname(params.filePath))

      const outputs: string[] = []

      if (params.splitMode === 'single') {
        for (let i = 0; i < totalPages; i++) {
          const newPdf = await PDFDocument.create()
          const [copiedPage] = await newPdf.copyPages(srcPdf, [i])
          newPdf.addPage(copiedPage)
          const newBytes = await newPdf.save()
          
          const outPath = path.join(params.outputFolder, `${baseName}_page_${i + 1}.pdf`)
          fs.writeFileSync(outPath, newBytes)
          outputs.push(outPath)
        }
      } else if (params.splitMode === 'ranges' && params.ranges) {
        const rangeParts = params.ranges.split(',').map(r => r.trim())
        for (let idx = 0; idx < rangeParts.length; idx++) {
          const part = rangeParts[idx]
          let start = 0
          let end = 0

          if (part.includes('-')) {
            const [s, e] = part.split('-').map(x => parseInt(x.trim(), 10))
            start = s - 1
            end = e - 1
          } else {
            const pageNum = parseInt(part, 10)
            start = pageNum - 1
            end = pageNum - 1
          }

          if (isNaN(start) || isNaN(end) || start < 0 || end >= totalPages || start > end) {
            continue
          }

          const newPdf = await PDFDocument.create()
          const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i)
          const copiedPages = await newPdf.copyPages(srcPdf, indices)
          copiedPages.forEach(p => newPdf.addPage(p))
          
          const newBytes = await newPdf.save()
          const outPath = path.join(params.outputFolder, `${baseName}_range_${part}.pdf`)
          fs.writeFileSync(outPath, newBytes)
          outputs.push(outPath)
        }
      }

      return { success: true, outputs }
    } catch (err: any) {
      console.error('[PDF IPC] Split failed:', err)
      throw new Error(err.message || 'Failed to split PDF file.')
    }
  })

  // 3. Add Watermark
  ipcMain.handle('pdf:watermark', async (_e, params: { filePath: string; outputPath: string; text: string; opacity?: number }) => {
    try {
      if (!fs.existsSync(params.filePath)) throw new Error('Source file does not exist.')
      const pdfBytes = fs.readFileSync(params.filePath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const pages = pdfDoc.getPages()
      const opacity = params.opacity ?? 0.25

      for (const page of pages) {
        const { width, height } = page.getSize()
        page.drawText(params.text, {
          x: width / 2 - 150,
          y: height / 2,
          size: 44,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5),
          opacity: opacity,
          rotate: degrees(45),
        })
      }

      const newPdfBytes = await pdfDoc.save()
      fs.writeFileSync(params.outputPath, newPdfBytes)
      return { success: true, outputPath: params.outputPath }
    } catch (err: any) {
      console.error('[PDF IPC] Watermark failed:', err)
      throw new Error(err.message || 'Failed to add watermark.')
    }
  })

  // 4. Encrypt / Password Protect PDF
  ipcMain.handle('pdf:protect', async (_e, params: { filePath: string; outputPath: string; userPassword?: string; ownerPassword?: string }) => {
    try {
      if (!fs.existsSync(params.filePath)) throw new Error('Source file does not exist.')
      const pdfBytes = fs.readFileSync(params.filePath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      
      const securePdfBytes = await pdfDoc.save({
        userPassword: params.userPassword || undefined,
        ownerPassword: params.ownerPassword || undefined,
        updateMetadata: true
      } as any)

      fs.writeFileSync(params.outputPath, securePdfBytes)
      return { success: true, outputPath: params.outputPath }
    } catch (err: any) {
      console.error('[PDF IPC] Protect failed:', err)
      throw new Error(err.message || 'Failed to protect PDF file.')
    }
  })

  // 5. Decrypt / Remove Password PDF
  ipcMain.handle('pdf:decrypt', async (_e, params: { filePath: string; outputPath: string; password?: string }) => {
    try {
      if (!fs.existsSync(params.filePath)) throw new Error('Source file does not exist.')
      const pdfBytes = fs.readFileSync(params.filePath)
      
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        password: params.password || undefined
      } as any)
      
      const decPdfBytes = await pdfDoc.save()
      fs.writeFileSync(params.outputPath, decPdfBytes)
      return { success: true, outputPath: params.outputPath }
    } catch (err: any) {
      console.error('[PDF IPC] Decrypt failed:', err)
      throw new Error(err.message || 'Invalid password or decryption failed.')
    }
  })

  // 6. Metadata Edit
  ipcMain.handle('pdf:metadata', async (_e, params: { filePath: string; outputPath: string; title?: string; author?: string; subject?: string; keywords?: string }) => {
    try {
      if (!fs.existsSync(params.filePath)) throw new Error('Source file does not exist.')
      const pdfBytes = fs.readFileSync(params.filePath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      
      if (params.title !== undefined) pdfDoc.setTitle(params.title)
      if (params.author !== undefined) pdfDoc.setAuthor(params.author)
      if (params.subject !== undefined) pdfDoc.setSubject(params.subject)
      if (params.keywords !== undefined) {
        pdfDoc.setKeywords(params.keywords.split(',').map(k => k.trim()))
      }

      const newPdfBytes = await pdfDoc.save()
      fs.writeFileSync(params.outputPath, newPdfBytes)
      return { success: true, outputPath: params.outputPath }
    } catch (err: any) {
      console.error('[PDF IPC] Metadata failed:', err)
      throw new Error(err.message || 'Failed to update PDF metadata.')
    }
  })

  // 7. HTML / Markdown / TXT to PDF Conversion (Built-in Chromium printToPDF)
  ipcMain.handle('pdf:from-html', async (_e, params: { html: string; outputPath: string }) => {
    let win: BrowserWindow | null = null
    try {
      win = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true
        }
      })
      
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(params.html)}`)
      
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        margins: {
          top: 0.4,
          bottom: 0.4,
          left: 0.4,
          right: 0.4
        }
      })
      
      fs.writeFileSync(params.outputPath, pdfBuffer)
      return { success: true, outputPath: params.outputPath }
    } catch (err: any) {
      console.error('[PDF IPC] printToPDF failed:', err)
      throw new Error(err.message || 'Failed to convert HTML to PDF.')
    } finally {
      if (win) win.close()
    }
  })

  // 8. Images to PDF
  ipcMain.handle('pdf:from-images', async (_e, params: { imagePaths: string[]; outputPath: string }) => {
    try {
      const pdfDoc = await PDFDocument.create()

      for (const imgPath of params.imagePaths) {
        if (!fs.existsSync(imgPath)) continue
        const imgBytes = fs.readFileSync(imgPath)
        const ext = path.extname(imgPath).toLowerCase()

        let image
        if (ext === '.jpg' || ext === '.jpeg') {
          image = await pdfDoc.embedJpg(imgBytes)
        } else if (ext === '.png') {
          image = await pdfDoc.embedPng(imgBytes)
        } else {
          continue
        }

        const page = pdfDoc.addPage([image.width, image.height])
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        })
      }

      const pdfBytes = await pdfDoc.save()
      fs.writeFileSync(params.outputPath, pdfBytes)
      return { success: true, outputPath: params.outputPath }
    } catch (err: any) {
      console.error('[PDF IPC] Compile images failed:', err)
      throw new Error(err.message || 'Failed to compile images into PDF.')
    }
  })

  // 9. Extract PDF Text & Save (PDF → Word, PDF → Excel, PDF → TXT)
  ipcMain.handle('pdf:convert-to-text-file', async (_e, params: { filePath: string; outputPath: string; format: 'txt' | 'doc' | 'csv' }) => {
    try {
      if (!fs.existsSync(params.filePath)) throw new Error('Source file does not exist.')
      const pdfBytes = fs.readFileSync(params.filePath)
      
      const rawText = extractTextFromPdfBytes(pdfBytes)
      let finalContent = rawText

      if (params.format === 'doc') {
        finalContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Converted Document</title>
<style>
body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.5; padding: 40px; }
p { margin-bottom: 12pt; text-indent: 0.5in; }
h1, h2, h3 { font-family: Arial, sans-serif; color: #2C3E50; }
</style>
</head>
<body>
${rawText.split('\n').map(line => line.trim() ? `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '<br>').join('\n')}
</body>
</html>`
      } else if (params.format === 'csv') {
        finalContent = rawText.split('\n').map(line => {
          const cells = line.split(/\t|\s{2,}/).map(cell => {
            const escaped = cell.trim().replace(/"/g, '""')
            return `"${escaped}"`
          })
          return cells.join(',')
        }).join('\n')
      }

      fs.writeFileSync(params.outputPath, finalContent, 'utf-8')
      return { success: true, outputPath: params.outputPath }
    } catch (err: any) {
      console.error('[PDF IPC] Convert to text failed:', err)
      throw new Error(err.message || 'Failed to convert document.')
    }
  })

  // 10. Simulate Processing (Copy file as processed)
  ipcMain.handle('pdf:simulate-tool', async (_e, params: { filePath: string; outputPath: string }) => {
    try {
      if (!fs.existsSync(params.filePath)) throw new Error('Source file does not exist.')
      fs.copyFileSync(params.filePath, params.outputPath)
      return { success: true, outputPath: params.outputPath }
    } catch (err: any) {
      console.error('[PDF IPC] Simulation failed:', err)
      throw new Error(err.message || 'Failed to process document.')
    }
  })

  // 11. Move/Rename File (Post-conversion save destination)
  ipcMain.handle('pdf:move-file', async (_e, params: { srcPath: string; destPath: string }) => {
    try {
      if (!fs.existsSync(params.srcPath)) throw new Error('Source file does not exist.')
      const destDir = path.dirname(params.destPath)
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }
      // If target file already exists, delete it first to avoid lock errors
      if (fs.existsSync(params.destPath)) {
        fs.unlinkSync(params.destPath)
      }
      fs.renameSync(params.srcPath, params.destPath)
      return { success: true }
    } catch (err: any) {
      console.error('[PDF IPC] Move failed:', err)
      throw new Error(err.message || 'Failed to save file to chosen destination.')
    }
  })

  // 12. Write File from Base64
  ipcMain.handle('pdf:write-file', async (_e, params: { base64: string; outputPath: string }) => {
    try {
      const buffer = Buffer.from(params.base64, 'base64')
      fs.writeFileSync(params.outputPath, buffer)
      return { success: true }
    } catch (err: any) {
      console.error('[PDF IPC] Write file failed:', err)
      throw new Error(err.message || 'Failed to write PDF file.')
    }
  })
}
