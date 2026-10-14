import * as XLSX from 'xlsx'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

export interface SyncFileLogItem {
  fileName: string
  src: string
  dst: string
  size: number
  status: 'Copied' | 'Skipped' | 'Failed'
  error?: string
  hash?: string
  hashVerified?: boolean
}

export interface DriveSyncReportData {
  jobId: string
  timestamp: number
  dateStr: string
  sources: string[]
  destination: string
  totalFiles: number
  copiedFiles: number
  skippedFiles: number
  failedFiles: number
  totalBytes: number
  bytesCopied: number
  durationSeconds: number
  avgSpeedMBs: string
  fileLogs: SyncFileLogItem[]
}

function fmtBytes(b: number): string {
  if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`
  if (b >= 1e9)  return `${(b / 1e9).toFixed(2)} GB`
  if (b >= 1e6)  return `${(b / 1e6).toFixed(1)} MB`
  return `${(b / 1024).toFixed(0)} KB`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s.toFixed(1)}s`
}

/** Sanitizes text to standard WinAnsi / ASCII range to avoid pdf-lib encoding errors */
function sanitizePdfText(str: string): string {
  if (!str) return ''
  return str.replace(/[^\x20-\x7E]/g, '').trim()
}

/** Truncate long paths for clean PDF column rendering */
function truncateMiddle(str: string, maxLen: number): string {
  if (!str) return ''
  const clean = sanitizePdfText(str)
  if (clean.length <= maxLen) return clean
  const half = Math.floor((maxLen - 3) / 2)
  return clean.substring(0, half) + '...' + clean.slice(-half)
}

// ── EXCEL GENERATOR ──────────────────────────────────────────
export function generateSyncExcelReport(data: DriveSyncReportData, targetFilePath: string): void {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Executive Summary
  const summaryRows: any[] = []
  summaryRows.push(['ONE TAP WORKSTATION — AUDIT REPORT'])
  summaryRows.push(['Generated Date & Time', data.dateStr])
  summaryRows.push(['Audit Job ID', data.jobId])
  summaryRows.push([''])
  summaryRows.push(['EXECUTIVE SUMMARY'])
  summaryRows.push(['Source Location(s)', data.sources.join('; ')])
  summaryRows.push(['Destination Location', data.destination])
  summaryRows.push(['Total Source Files Evaluated', data.totalFiles])
  summaryRows.push(['Files Successfully Copied', data.copiedFiles])
  summaryRows.push(['Files Skipped (Already Up-to-Date)', data.skippedFiles])
  summaryRows.push(['Files Failed', data.failedFiles])
  summaryRows.push(['Total Source Data Evaluated', fmtBytes(data.totalBytes)])
  summaryRows.push(['Data Transferred in Job', fmtBytes(data.bytesCopied)])
  summaryRows.push(['Transfer Execution Duration', formatDuration(data.durationSeconds)])
  summaryRows.push(['Average Transfer Speed', `${data.avgSpeedMBs} MB/s`])

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)

  // Sheet 2: Itemized File Log
  const inventoryData = data.fileLogs.map((item, idx) => ({
    'S.No': idx + 1,
    'File Name': item.fileName,
    'Source Path': item.src,
    'Destination Path': item.dst,
    'File Size': fmtBytes(item.size),
    'Bytes': item.size,
    'Status': item.status,
    'xxHash64 Checksum': item.hash || '—',
    'Integrity Verification': item.hashVerified ? 'Bit-Exact Match (xxHash64)' : (item.hash ? 'Hash Recorded' : 'Size/Date Match'),
    'Notes / Error': item.error || ''
  }))

  const wsInventory = XLSX.utils.json_to_sheet(inventoryData)

  // Auto-fit Column Widths Helper
  const autofitWidths = (ws: XLSX.WorkSheet) => {
    if (!ws['!ref']) return
    const range = XLSX.utils.decode_range(ws['!ref'])
    const colWidths: { wch: number }[] = []
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxLen = 12
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })]
        if (cell && cell.v !== undefined) {
          const len = String(cell.v).length
          if (len > maxLen) maxLen = len
        }
      }
      colWidths.push({ wch: Math.min(maxLen + 4, 65) })
    }
    ws['!cols'] = colWidths
  }

  autofitWidths(wsSummary)
  autofitWidths(wsInventory)

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Dashboard')
  XLSX.utils.book_append_sheet(wb, wsInventory, 'File Inventory Log')

  const dir = path.dirname(targetFilePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  XLSX.writeFile(wb, targetFilePath)
}

// ── PDF GENERATOR ────────────────────────────────────────────
export async function generateSyncPdfReport(data: DriveSyncReportData, targetFilePath: string): Promise<void> {
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)

  const pageWidth = 595.28 // A4 width in points
  const pageHeight = 841.89 // A4 height in points
  const margin = 36

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const drawHeader = (currentPage: typeof page) => {
    // Top Banner
    currentPage.drawRectangle({
      x: 0,
      y: pageHeight - 48,
      width: pageWidth,
      height: 48,
      color: rgb(0.08, 0.09, 0.12)
    })

    currentPage.drawText('ONE TAP WORKSTATION', {
      x: margin,
      y: pageHeight - 32,
      size: 15,
      font: fontBold,
      color: rgb(0.96, 0.62, 0.04) // Amber Accent
    })

    currentPage.drawText('DRIVE SYNC AUDIT REPORT', {
      x: pageWidth - margin - 150,
      y: pageHeight - 30,
      size: 9,
      font: fontBold,
      color: rgb(0.9, 0.9, 0.9)
    })
  }

  drawHeader(page)
  y -= 42

  // Execution Meta Row
  page.drawText(`Date: ${sanitizePdfText(data.dateStr)}`, { x: margin, y, size: 8.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(`Ref ID: ${sanitizePdfText(data.jobId)}`, { x: pageWidth - margin - 140, y, size: 8.5, font: fontMono, color: rgb(0.4, 0.4, 0.4) })
  y -= 16

  // Executive Summary Card
  const boxHeight = 110
  page.drawRectangle({
    x: margin,
    y: y - boxHeight,
    width: pageWidth - (margin * 2),
    height: boxHeight,
    color: rgb(0.97, 0.97, 0.98),
    borderColor: rgb(0.85, 0.85, 0.88),
    borderWidth: 1
  })

  let boxY = y - 18
  page.drawText('TRANSFER SUMMARY', { x: margin + 12, y: boxY, size: 9.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  boxY -= 16

  const leftX = margin + 12
  const midX  = margin + 260

  const srcDisplay = truncateMiddle(data.sources.join(', '), 65)
  const dstDisplay = truncateMiddle(data.destination, 65)

  page.drawText(`Sources: ${srcDisplay}`, { x: leftX, y: boxY, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
  boxY -= 14
  page.drawText(`Destination: ${dstDisplay}`, { x: leftX, y: boxY, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
  boxY -= 16

  page.drawText(`Total Files Evaluated: ${data.totalFiles}`, { x: leftX, y: boxY, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
  page.drawText(`Files Copied: ${data.copiedFiles}`, { x: midX, y: boxY, size: 8, font: fontBold, color: rgb(0.1, 0.6, 0.2) })
  boxY -= 14
  page.drawText(`Files Skipped (Up-to-Date): ${data.skippedFiles}`, { x: leftX, y: boxY, size: 8, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(`Files Failed: ${data.failedFiles}`, { x: midX, y: boxY, size: 8, font: fontBold, color: data.failedFiles > 0 ? rgb(0.8, 0.1, 0.1) : rgb(0.3, 0.3, 0.3) })
  boxY -= 14
  page.drawText(`Data Size: ${fmtBytes(data.bytesCopied)} / ${fmtBytes(data.totalBytes)}`, { x: leftX, y: boxY, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
  page.drawText(`Avg Speed: ${data.avgSpeedMBs} MB/s · Duration: ${formatDuration(data.durationSeconds)}`, { x: midX, y: boxY, size: 8, font: fontBold, color: rgb(0.9, 0.5, 0.0) })

  y -= (boxHeight + 20)

  // Itemized Log Section Header
  page.drawText('ITEMIZED FILE INVENTORY', { x: margin, y, size: 9.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  y -= 14

  const colX = [margin, margin + 24, margin + 200, margin + 410, margin + 470]

  const drawTableHeaders = (p: typeof page, currentY: number) => {
    p.drawRectangle({
      x: margin,
      y: currentY - 14,
      width: pageWidth - (margin * 2),
      height: 18,
      color: rgb(0.12, 0.14, 0.18)
    })
    const textY = currentY - 10
    p.drawText('#', { x: colX[0] + 4, y: textY, size: 8, font: fontBold, color: rgb(1, 1, 1) })
    p.drawText('File Name', { x: colX[1], y: textY, size: 8, font: fontBold, color: rgb(1, 1, 1) })
    p.drawText('Source Path', { x: colX[2], y: textY, size: 8, font: fontBold, color: rgb(1, 1, 1) })
    p.drawText('Size', { x: colX[3], y: textY, size: 8, font: fontBold, color: rgb(1, 1, 1) })
    p.drawText('Status', { x: colX[4], y: textY, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  }

  drawTableHeaders(page, y)
  y -= 20

  // Render Table Rows with Automatic Multi-Page Overflow
  for (let i = 0; i < data.fileLogs.length; i++) {
    if (y < margin + 30) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      drawHeader(page)
      y = pageHeight - 65
      drawTableHeaders(page, y)
      y -= 20
    }

    const item = data.fileLogs[i]
    const isEven = i % 2 === 0
    if (isEven) {
      page.drawRectangle({
        x: margin,
        y: y - 10,
        width: pageWidth - (margin * 2),
        height: 14,
        color: rgb(0.96, 0.96, 0.97)
      })
    }

    const textY = y - 7
    page.drawText(String(i + 1), { x: colX[0] + 4, y: textY, size: 7.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(truncateMiddle(item.fileName, 30), { x: colX[1], y: textY, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(truncateMiddle(item.src, 40), { x: colX[2], y: textY, size: 7, font: fontMono, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(fmtBytes(item.size), { x: colX[3], y: textY, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })

    const statusColor = item.status === 'Copied'
      ? rgb(0.1, 0.6, 0.2)
      : item.status === 'Skipped'
        ? rgb(0.4, 0.4, 0.4)
        : rgb(0.8, 0.1, 0.1)

    page.drawText(item.status, { x: colX[4], y: textY, size: 7.5, font: fontBold, color: statusColor })

    y -= 14
  }

  // Page Numbers Footer
  const pageCount = pdfDoc.getPageCount()
  for (let i = 0; i < pageCount; i++) {
    const p = pdfDoc.getPage(i)
    p.drawText(`Page ${i + 1} of ${pageCount}`, {
      x: pageWidth - margin - 50,
      y: margin - 15,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5)
    })
    p.drawText('Generated by One Tap Workstation', {
      x: margin,
      y: margin - 15,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5)
    })
  }

  const pdfBytes = await pdfDoc.save()
  const dir = path.dirname(targetFilePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(targetFilePath, pdfBytes)
}
