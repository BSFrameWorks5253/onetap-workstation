import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'
import { parseSafarFromPath } from './safarHierarchy'

const PREFIX_NAMES: Record<string, string> = {
  'N': 'Nikaah',
  'Q': 'Qadam',
  'MZ': 'MZ',
  'M': 'Majlis',
  'Z': 'Ziyafat',
  'AQ': 'Aqiqa',
  'WAAZ': 'Waaz',
  'ID': 'Idaara',
  'BQ': 'BQ',
  'BZ': 'BZ',
  'OD': 'OD'
}

const HIJRI_MONTH_NAMES_LONG = [
  'Moharram', 'Safar', 'Rabi I', 'Rabi II',
  'Jumada I', 'Jumada II', 'Rajab', 'Sha\'baan',
  'Ramadaan', 'Shawwal', 'Zilqadah', 'Zilhaj',
]

function formatDuration(seconds?: number): string {
  if (!seconds || seconds < 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDate(timestamp: number): string {
  try {
    const d = new Date(timestamp)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch {
    return ''
  }
}

function shortenPath(filePath?: string, folder?: string): string {
  if (!filePath) return folder || 'Direct Render'
  // Handle both Windows and Unix path separators
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  if (parts.length >= 2) {
    return parts.slice(-2).join('\\')
  }
  return filePath
}

export function generateExcelReport(records: any[], targetFilePath: string): void {
  if (!Array.isArray(records)) return

  // Separate normal records and re-edit records
  const normalRecords = records.filter(r => !r.isReedit)
  const reeditRecords = records.filter(r => r.isReedit)

  // Calculate total rendering duration for normal records
  const totalSecs = normalRecords.reduce((acc, r) => acc + (r.duration || 0), 0)

  // 1. Full Dashboard Sheet Data (Normal Records)
  const dashboardRows: any[] = []
  dashboardRows.push(['ONE TAP WORKFLOWS - SUMMARY DASHBOARD'])
  dashboardRows.push([''])
  dashboardRows.push(['KEY METRICS'])
  dashboardRows.push(['Total Videos Rendered', normalRecords.length])
  dashboardRows.push(['Total Video Duration', formatDuration(totalSecs)])
  
  // Category Breakdown for Dashboard
  const categorySummaryMap: Record<string, { count: number; totalDuration: number }> = {}
  normalRecords.forEach(r => {
    const prefix = (r.prefix || '').toUpperCase().trim()
    const catName = PREFIX_NAMES[prefix] || prefix || 'Other'
    if (!categorySummaryMap[catName]) {
      categorySummaryMap[catName] = { count: 0, totalDuration: 0 }
    }
    categorySummaryMap[catName].count++
    categorySummaryMap[catName].totalDuration += (r.duration || 0)
  })

  const categorySummaryData = Object.entries(categorySummaryMap).map(([cat, stat]) => ({
    'Category': cat,
    'Total Videos': stat.count,
    'Total Duration': formatDuration(stat.totalDuration)
  })).sort((a, b) => b['Total Videos'] - a['Total Videos'])

  // City Breakdown for Dashboard
  const citySummaryMap: Record<string, { count: number; totalDuration: number }> = {}
  normalRecords.forEach(r => {
    const city = r.city || 'Unassigned'
    if (!citySummaryMap[city]) {
      citySummaryMap[city] = { count: 0, totalDuration: 0 }
    }
    citySummaryMap[city].count++
    citySummaryMap[city].totalDuration += (r.duration || 0)
  })

  const citySummaryData = Object.entries(citySummaryMap).map(([city, stat]) => ({
    'City': city,
    'Total Videos': stat.count,
    'Total Duration': formatDuration(stat.totalDuration)
  })).sort((a, b) => b['Total Videos'] - a['Total Videos'])

  // Monthly Summary for Dashboard
  const monthlySummaryMap: Record<string, { count: number; totalDuration: number; monthNum: number; year: number; monthName: string }> = {}
  normalRecords.forEach(r => {
    const year = r.hijriYear || 0
    const monthNum = r.hijriMonth || 0
    const monthName = (monthNum >= 1 && monthNum <= 12) ? HIJRI_MONTH_NAMES_LONG[monthNum - 1] : 'Unassigned'
    const key = `${year}-${monthNum}`

    if (!monthlySummaryMap[key]) {
      monthlySummaryMap[key] = { count: 0, totalDuration: 0, monthNum, year, monthName }
    }
    monthlySummaryMap[key].count++
    monthlySummaryMap[key].totalDuration += (r.duration || 0)
  })

  const monthlySummaryData = Object.values(monthlySummaryMap).map(m => ({
    'Month': m.monthName !== 'Unassigned' ? `${m.monthNum} - ${m.monthName} (${m.year})` : 'Unassigned',
    'Total Videos': m.count,
    'Total Duration': formatDuration(m.totalDuration)
  })).sort((a, b) => {
    // Sort months descending (parse year and month from the formatted string)
    const aMatch = String(a['Month']).match(/(\d+)\s*-\s*([A-Za-z0-9']+)\s*\((\d+)\)/)
    const bMatch = String(b['Month']).match(/(\d+)\s*-\s*([A-Za-z0-9']+)\s*\((\d+)\)/)
    const aYear = aMatch ? parseInt(aMatch[3]) : 0
    const bYear = bMatch ? parseInt(bMatch[3]) : 0
    if (aYear !== bYear) return bYear - aYear
    const aMonthNum = aMatch ? parseInt(aMatch[1]) : 0
    const bMonthNum = bMatch ? parseInt(bMatch[1]) : 0
    return bMonthNum - aMonthNum
  })

  dashboardRows.push(['Active Categories', categorySummaryData.length])
  dashboardRows.push(['Active Production Cities', citySummaryData.length])
  dashboardRows.push([''])

  dashboardRows.push(['CATEGORY BREAKDOWN SUMMARY'])
  dashboardRows.push(['Category', 'Total Videos', 'Total Duration'])
  categorySummaryData.forEach(row => {
    dashboardRows.push([row.Category, row['Total Videos'], row['Total Duration']])
  })
  dashboardRows.push([''])

  dashboardRows.push(['CITY BREAKDOWN SUMMARY'])
  dashboardRows.push(['City', 'Total Videos', 'Total Duration'])
  citySummaryData.forEach(row => {
    dashboardRows.push([row.City, row['Total Videos'], row['Total Duration']])
  })
  dashboardRows.push([''])

  dashboardRows.push(['MONTHLY VOLUME SUMMARY'])
  dashboardRows.push(['Month', 'Total Videos', 'Total Duration'])
  monthlySummaryData.forEach(row => {
    dashboardRows.push([row.Month, row['Total Videos'], row['Total Duration']])
  })
  dashboardRows.push([''])

  // Safar Breakdown for Dedicated Sheet and Dashboard
  interface SafarRowStat {
    serial: string
    safarName: string
    year: string | number
    city: string
    count: number
    totalDuration: number
    eventCounts: Record<string, number>
  }

  const safarSummaryMap: Record<string, SafarRowStat> = {}
  const allEventPrefixesSet = new Set<string>()

  normalRecords.forEach(r => {
    let safar = r.safar
    let serial = r.safarSerial
    let year = r.safarYear
    let city = r.city

    if (!safar || safar === 'Unassigned') {
      const parsed = parseSafarFromPath(r.filePath || r.folder || '')
      if (parsed.safar && parsed.safar !== 'Unassigned') {
        safar = parsed.safar
        serial = serial || parsed.safarSerial
        year = year || parsed.safarYear
        city = city || parsed.city
      }
    }

    safar = safar || 'Unassigned'
    const pfx = (r.prefix || '').toUpperCase().split(/[\s_]/)[0] || 'OTHER'
    allEventPrefixesSet.add(pfx)

    if (!safarSummaryMap[safar]) {
      const parsed = parseSafarFromPath(safar)
      const cleanTitle = parsed.safarName && parsed.safarName.includes(' - ')
        ? parsed.safarName.split(' - ').slice(1).join(' - ').trim()
        : (parsed.safarName !== 'Unassigned' ? parsed.safarName : safar)

      safarSummaryMap[safar] = {
        serial: serial || parsed.safarSerial || '—',
        safarName: cleanTitle,
        year: year || parsed.safarYear || '—',
        city: city || parsed.city || 'Unassigned',
        count: 0,
        totalDuration: 0,
        eventCounts: {}
      }
    }

    safarSummaryMap[safar].count++
    safarSummaryMap[safar].totalDuration += (r.duration || 0)
    safarSummaryMap[safar].eventCounts[pfx] = (safarSummaryMap[safar].eventCounts[pfx] || 0) + 1
  })

  const sortedEventPrefixes = Array.from(allEventPrefixesSet).sort()

  const safarSummaryData = Object.values(safarSummaryMap).map(s => {
    const row: Record<string, any> = {
      'Serial (#)': s.serial,
      'Safar Name': s.safarName,
      'Year (H)': s.year,
      'City': s.city,
      'Total Videos': s.count,
      'Total Duration': formatDuration(s.totalDuration)
    }
    sortedEventPrefixes.forEach(pfx => {
      row[pfx] = s.eventCounts[pfx] || 0
    })
    return row
  }).sort((a, b) => {
    const yA = Number(a['Year (H)']) || 0
    const yB = Number(b['Year (H)']) || 0
    if (yA !== yB) return yB - yA
    return String(a['Serial (#)']).localeCompare(String(b['Serial (#)']))
  })

  // Add Safar Breakdown to Dashboard
  dashboardRows.push(['SAFAR BREAKDOWN SUMMARY'])
  dashboardRows.push(['Serial (#)', 'Safar Name', 'Year (H)', 'City', 'Total Videos', 'Total Duration'])
  safarSummaryData.forEach(row => {
    dashboardRows.push([row['Serial (#)'], row['Safar Name'], row['Year (H)'], row['City'], row['Total Videos'], row['Total Duration']])
  })
  dashboardRows.push([''])

  // 2. Full Detail Sheet Data (Normal Records)
  const fullDetailData = normalRecords.map((r, index) => {
    const prefix = (r.prefix || '').toUpperCase().trim()
    return {
      'S.No': index + 1,
      'Description': r.name || '',
      'Stored Path': shortenPath(r.filePath, r.folder),
      'Type': prefix || 'Other',
      'City': r.city || 'Unassigned',
      'Date & Time Rendered': formatDate(r.date),
      'Duration': formatDuration(r.duration)
    }
  })

  // 3. Re-edit History Sheet Data
  const reeditDetailData = reeditRecords.map((r, index) => {
    const prefix = (r.prefix || '').toUpperCase().trim()
    return {
      'S.No': index + 1,
      'Description': r.name || '',
      'Stored Path': shortenPath(r.filePath, r.folder),
      'Type': prefix || 'Other',
      'City': r.city || 'Unassigned',
      'Date & Time Re-edited': formatDate(r.date),
      'Duration': formatDuration(r.duration)
    }
  })

  // 4. City Wise Sheets (Normal Records)
  // Group records by city
  const cityGroups: Record<string, any[]> = {}
  normalRecords.forEach(r => {
    const city = r.city || 'Unassigned'
    if (!cityGroups[city]) cityGroups[city] = []
    cityGroups[city].push(r)
  })

  // 5. Monthly Overview Sheet Data (Normal Records)
  const uniqueCities = Array.from(new Set(normalRecords.map(r => r.city || 'Unassigned'))).sort()
  
  // Construct headers
  const monthlyOverviewHeaders = ['Month & Year', 'Total Videos', ...uniqueCities]
  const monthlyOverviewRows: any[] = []

  // Group by month
  const monthlyOverviewSorted = Object.values(monthlySummaryMap).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.monthNum - a.monthNum
  })

  monthlyOverviewSorted.forEach(m => {
    const monthKey = m.monthName !== 'Unassigned' ? `${m.monthNum} - ${m.monthName} (${m.year})` : 'Unassigned'
    // Filter records for this month
    const monthRecords = normalRecords.filter(r => {
      const rYear = r.hijriYear || 0
      const rMonthNum = r.hijriMonth || 0
      return rYear === m.year && rMonthNum === m.monthNum
    })

    const row: any[] = [monthKey, monthRecords.length]
    uniqueCities.forEach(city => {
      const cityCount = monthRecords.filter(r => (r.city || 'Unassigned') === city).length
      row.push(cityCount)
    })
    monthlyOverviewRows.push(row)
  })

  // 6. Category Breakdown Sheet Data (Normal Records)
  const categoryBreakdownData = Object.entries(PREFIX_NAMES).map(([prefix, catName]) => {
    const matchingRecords = normalRecords.filter(r => (r.prefix || '').toUpperCase().trim() === prefix)
    return {
      'Prefix': prefix,
      'Category Name': catName,
      'Number of Videos': matchingRecords.length,
      'Total Duration': formatDuration(matchingRecords.reduce((acc, r) => acc + (r.duration || 0), 0))
    }
  })

  // Add "Other" prefix category breakdown if there are any other prefixes in records
  const otherRecords = normalRecords.filter(r => {
    const prefix = (r.prefix || '').toUpperCase().trim()
    return !PREFIX_NAMES[prefix]
  })
  if (otherRecords.length > 0) {
    const otherGroups: Record<string, any[]> = {}
    otherRecords.forEach(r => {
      const prefix = (r.prefix || '').toUpperCase().trim() || 'Other'
      if (!otherGroups[prefix]) otherGroups[prefix] = []
      otherGroups[prefix].push(r)
    })
    Object.entries(otherGroups).forEach(([prefix, recs]) => {
      categoryBreakdownData.push({
        'Prefix': prefix,
        'Category Name': prefix,
        'Number of Videos': recs.length,
        'Total Duration': formatDuration(recs.reduce((acc, r) => acc + (r.duration || 0), 0))
      })
    })
  }

  // Create Workbook
  const wb = XLSX.utils.book_new()

  // Convert AOA / JSON to Sheets
  const wsDash = XLSX.utils.aoa_to_sheet(dashboardRows)
  const wsRaw = XLSX.utils.json_to_sheet(fullDetailData)
  const wsReedit = XLSX.utils.json_to_sheet(reeditDetailData)
  
  // Auto-fit Column Widths Helper
  const autofitWidths = (ws: XLSX.WorkSheet) => {
    if (!ws['!ref']) return
    const range = XLSX.utils.decode_range(ws['!ref'])
    const colWidths: { wch: number }[] = []
    
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxLen = 10 // minimum width
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cellAddress = { c: C, r: R }
        const cellRef = XLSX.utils.encode_cell(cellAddress)
        const cell = ws[cellRef]
        if (cell && cell.v !== undefined) {
          const len = String(cell.v).length
          if (len > maxLen) maxLen = len
        }
      }
      colWidths.push({ wch: Math.min(maxLen + 3, 50) }) // padding, capped at 50 to prevent huge cells
    }
    ws['!cols'] = colWidths
  }

  // Total Row for Safar Summary Sheet
  const safarSheetRows = [...safarSummaryData]
  if (safarSheetRows.length > 0) {
    const totalRow: Record<string, any> = {
      'Serial (#)': 'TOTAL',
      'Safar Name': `${safarSheetRows.length} Safar Blocks`,
      'Year (H)': '—',
      'City': '—',
      'Total Videos': normalRecords.length,
      'Total Duration': formatDuration(totalSecs)
    }
    sortedEventPrefixes.forEach(pfx => {
      const sum = safarSheetRows.reduce((acc, row) => acc + (Number(row[pfx]) || 0), 0)
      totalRow[pfx] = sum
    })
    safarSheetRows.push(totalRow)
  }

  const wsSafar = XLSX.utils.json_to_sheet(safarSheetRows)

  autofitWidths(wsDash)
  autofitWidths(wsSafar)
  autofitWidths(wsRaw)
  autofitWidths(wsReedit)

  // Append worksheets to workbook
  XLSX.utils.book_append_sheet(wb, wsDash, 'Full Dashboard')
  XLSX.utils.book_append_sheet(wb, wsSafar, 'Safar Summary')
  XLSX.utils.book_append_sheet(wb, wsRaw, 'Full Detail')
  XLSX.utils.book_append_sheet(wb, wsReedit, 'Re-edit History')

  // Append city-wise sheets
  const usedNames = new Set<string>()
  Object.entries(cityGroups).forEach(([city, cityRecords]) => {
    const cityDetailRows = cityRecords.map((r, index) => {
      const prefix = (r.prefix || '').toUpperCase().trim()
      return {
        'S.No': index + 1,
        'Description': r.name || '',
        'Stored Path': shortenPath(r.filePath, r.folder),
        'Type': prefix || 'Other',
        'Date & Time Rendered': formatDate(r.date),
        'Duration': formatDuration(r.duration)
      }
    })
    
    const wsCitySheet = XLSX.utils.json_to_sheet(cityDetailRows)
    autofitWidths(wsCitySheet)
    
    // Sanitize and ensure unique sheet name (limit 30 chars)
    let baseName = (city || 'Unassigned').replace(/[\\/?*\[\]:]/g, '_').substring(0, 30)
    let finalName = baseName
    let counter = 1
    while (usedNames.has(finalName.toLowerCase())) {
      const suffix = `_${counter}`
      finalName = baseName.substring(0, 30 - suffix.length) + suffix
      counter++
    }
    usedNames.add(finalName.toLowerCase())
    
    XLSX.utils.book_append_sheet(wb, wsCitySheet, finalName)
  })

  // Append Monthly Overview Sheet
  const monthlyOverviewAOA = [monthlyOverviewHeaders, ...monthlyOverviewRows]
  const wsMonthlyOverview = XLSX.utils.aoa_to_sheet(monthlyOverviewAOA)
  autofitWidths(wsMonthlyOverview)
  XLSX.utils.book_append_sheet(wb, wsMonthlyOverview, 'Monthly Overview')

  // Append Category Breakdown Sheet
  const wsCategoryBreakdown = XLSX.utils.json_to_sheet(categoryBreakdownData)
  autofitWidths(wsCategoryBreakdown)
  XLSX.utils.book_append_sheet(wb, wsCategoryBreakdown, 'Category Breakdown')

  // Write workbook
  try {
    const dir = path.dirname(targetFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    XLSX.writeFile(wb, targetFilePath)
    console.log(`[Excel] Successfully generated stats report at: ${targetFilePath}`)
  } catch (err) {
    console.error(`[Excel] Failed to write file at ${targetFilePath}:`, err)
    throw err
  }
}
