/**
 * ============================================================
 * SAFAR PDF GENERATOR (src/main/core/safarPdfGenerator.ts)
 * Part of One Tap Workstation
 *
 * Produces executive-grade, beautifully styled A4 PDF audit
 * reports for Safar stats and drive archives via Chromium printToPDF.
 * ============================================================
 */

import { BrowserWindow } from 'electron'
import fs from 'fs'

export interface SafarPdfData {
  safar_name: string
  city?: string
  safar_year?: number | string
  safar_serial?: string
  drive_label?: string
  total_files: number
  total_mp4_count: number
  total_photo_count?: number
  total_size_bytes?: number
  total_duration_seconds?: number
  duration_formatted?: string
  total_days_count?: number
  events?: Array<{
    code: string
    name: string
    count: number
    duration?: string
    size_mb?: number
  }>
  days?: Array<{
    date_key: string
    date_hijri?: string
    date_greg?: string
    sessions?: string[]
    mp4_count: number
    duration?: string
    size_mb?: number
    events_summary?: string
  }>
  generated_at?: string
}

export function generateSafarPdfHtml(data: SafarPdfData): string {
  const title = data.safar_name || 'Safar Archive Report'
  const location = [data.city, data.safar_year ? `Year ${data.safar_year}` : '']
    .filter(Boolean)
    .join(' • ')
  const drive = data.drive_label ? `Drive: ${data.drive_label}` : 'Local Archive'
  const generated = data.generated_at || new Date().toLocaleString()
  const totalDuration = data.duration_formatted || '00:00'

  const sizeGb = data.total_size_bytes
    ? (data.total_size_bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
    : '0 GB'
  const totalClips = (data.total_mp4_count || data.total_files || 0).toLocaleString()
  const totalDays = data.total_days_count || (data.days ? data.days.length : 1)

  // Event rows HTML
  const eventRowsHtml = (data.events || [])
    .map((ev, i) => {
      const isEven = i % 2 === 0
      return `
        <tr style="background: ${isEven ? '#FFFFFF' : '#F8FAFC'};">
          <td style="padding: 10px 14px; font-weight: 700; color: #1E3A8A; border-bottom: 1px solid #E2E8F0;">
            <span style="background: #EFF6FF; border: 1px solid #BFDBFE; color: #1D4ED8; padding: 2px 8px; border-radius: 6px; font-size: 11px;">${ev.code}</span>
          </td>
          <td style="padding: 10px 14px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E2E8F0;">${ev.name || ev.code}</td>
          <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #0F172A; border-bottom: 1px solid #E2E8F0;">${ev.count}</td>
          <td style="padding: 10px 14px; text-align: center; color: #334155; font-family: 'JetBrains Mono', monospace; font-size: 12px; border-bottom: 1px solid #E2E8F0;">${ev.duration || '—'}</td>
          <td style="padding: 10px 14px; text-align: right; color: #475569; font-size: 12px; border-bottom: 1px solid #E2E8F0;">${ev.size_mb ? ev.size_mb.toFixed(1) + ' MB' : '—'}</td>
        </tr>
      `
    })
    .join('')

  // Day rows HTML
  const dayRowsHtml = (data.days || [])
    .map((day, i) => {
      const isEven = i % 2 === 0
      const sessionList = day.sessions && day.sessions.length > 0 ? day.sessions.join(', ') : 'General'
      return `
        <tr style="background: ${isEven ? '#FFFFFF' : '#F8FAFC'}; page-break-inside: avoid;">
          <td style="padding: 9px 12px; font-weight: 700; color: #0F172A; border-bottom: 1px solid #E2E8F0;">${day.date_key}</td>
          <td style="padding: 9px 12px; color: #475569; font-size: 11px; border-bottom: 1px solid #E2E8F0;">${sessionList}</td>
          <td style="padding: 9px 12px; text-align: center; font-weight: 700; color: #1E3A8A; border-bottom: 1px solid #E2E8F0;">${day.mp4_count}</td>
          <td style="padding: 9px 12px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #334155; border-bottom: 1px solid #E2E8F0;">${day.duration || '—'}</td>
          <td style="padding: 9px 12px; color: #64748B; font-size: 11px; border-bottom: 1px solid #E2E8F0;">${day.events_summary || '—'}</td>
          <td style="padding: 9px 12px; text-align: right; color: #475569; font-size: 11px; border-bottom: 1px solid #E2E8F0;">${day.size_mb ? (day.size_mb / 1024).toFixed(2) + ' GB' : '—'}</td>
        </tr>
      `
    })
    .join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} — Executive Safar Audit</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 10mm 14mm 10mm;
      @bottom-right {
        content: counter(page) " of " counter(pages);
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #FFFFFF;
      color: #0F172A;
      font-size: 12px;
      line-height: 1.4;
      padding: 10px;
    }

    /* ── HEADER BLOCK ── */
    .header-card {
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      color: #FFFFFF;
      border-radius: 14px;
      padding: 24px 28px;
      margin-bottom: 20px;
      position: relative;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.15);
    }

    .brand-tag {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: rgba(59, 130, 246, 0.25);
      border: 1px solid rgba(96, 165, 250, 0.4);
      color: #93C5FD;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 8px;
    }

    .header-title {
      font-family: 'Outfit', sans-serif;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      margin-bottom: 6px;
    }

    .header-meta {
      font-size: 12.5px;
      color: #94A3B8;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-badge {
      position: absolute;
      top: 24px;
      right: 28px;
      text-align: right;
    }

    .status-stamp {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(16, 185, 129, 0.15);
      border: 1.5px solid #10B981;
      color: #34D399;
      font-size: 11px;
      font-weight: 800;
      border-radius: 8px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    /* ── KPI TILES ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 22px;
    }

    .kpi-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    }

    .kpi-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748B;
      margin-bottom: 4px;
    }

    .kpi-value {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.1;
    }

    /* ── SECTION TITLES ── */
    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #2563EB;
      display: inline-block;
    }

    /* ── TABLES ── */
    .table-box {
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 22px;
      background: #FFFFFF;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }

    th {
      background: #0F172A;
      color: #FFFFFF;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 10px 14px;
      text-align: left;
    }

    /* ── FOOTER ── */
    .footer {
      border-top: 1px solid #E2E8F0;
      padding-top: 12px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      color: #94A3B8;
      font-size: 10px;
      font-weight: 500;
    }
  </style>
</head>
<body>

  <!-- ── 1. HEADER ── -->
  <div class="header-card">
    <div class="brand-tag">ONE TAP WORKSTATION • AUDIT SENTINEL</div>
    <h1 class="header-title">${title}</h1>
    <div class="header-meta">
      <span>📍 ${location || 'Verified Tour'}</span>
      <span>•</span>
      <span>💾 ${drive}</span>
      <span>•</span>
      <span>🕒 Generated: ${generated}</span>
    </div>
    <div class="header-badge">
      <div class="status-stamp">VERIFIED ARCHIVE</div>
    </div>
  </div>

  <!-- ── 2. KPI METRIC TILES ── -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Rendered Clips</div>
      <div class="kpi-value" style="color: #2563EB;">${totalClips}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Footage Runtime</div>
      <div class="kpi-value" style="color: #7C3AED;">${totalDuration}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Storage Footprint</div>
      <div class="kpi-value" style="color: #059669;">${sizeGb}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Active Recorded Days</div>
      <div class="kpi-value" style="color: #D97706;">${totalDays} Days</div>
    </div>
  </div>

  <!-- ── 3. EVENT SEGREGATION TABLE ── -->
  ${
    data.events && data.events.length > 0
      ? `
    <div class="section-title">
      <span class="section-dot"></span>
      <span>1. Event Distribution & Category Breakdown</span>
    </div>
    <div class="table-box">
      <table>
        <thead>
          <tr>
            <th style="width: 70px;">Code</th>
            <th>Official Event Name</th>
            <th style="text-align: center; width: 90px;">Clips</th>
            <th style="text-align: center; width: 110px;">Total Runtime</th>
            <th style="text-align: right; width: 110px;">Data Size</th>
          </tr>
        </thead>
        <tbody>
          ${eventRowsHtml}
        </tbody>
      </table>
    </div>
    `
      : ''
  }

  <!-- ── 4. DAY-BY-DAY CHRONOLOGICAL SCHEDULE ── -->
  ${
    data.days && data.days.length > 0
      ? `
    <div class="section-title" style="page-break-before: auto;">
      <span class="section-dot" style="background: #7C3AED;"></span>
      <span>2. Chronological Timeline & Session Schedule</span>
    </div>
    <div class="table-box">
      <table>
        <thead>
          <tr>
            <th style="width: 105px;">Date</th>
            <th style="width: 90px;">Sessions</th>
            <th style="text-align: center; width: 65px;">Clips</th>
            <th style="text-align: center; width: 95px;">Duration</th>
            <th>Events Recorded</th>
            <th style="text-align: right; width: 95px;">Storage</th>
          </tr>
        </thead>
        <tbody>
          ${dayRowsHtml}
        </tbody>
      </table>
    </div>
    `
      : ''
  }

  <!-- ── 5. OFFICIAL FOOTER ── -->
  <div class="footer">
    <div>One Tap Workstation v26.10 • Media Production & Archive Vault</div>
    <div>Confidential Audit Report • Page 1</div>
  </div>

</body>
</html>
  `
}

export async function exportHtmlToPdf(html: string, outputPath: string): Promise<boolean> {
  let win: BrowserWindow | null = null
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true
      }
    })

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        top: 0.3,
        bottom: 0.3,
        left: 0.3,
        right: 0.3
      }
    })

    fs.writeFileSync(outputPath, pdfBuffer)
    return true
  } catch (err) {
    console.error('[SafarPdfGenerator] Error printing PDF:', err)
    throw err
  } finally {
    if (win) win.close()
  }
}
