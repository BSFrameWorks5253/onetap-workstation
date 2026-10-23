/**
 * ============================================================
 * SAFAR HIERARCHY PARSER (src/main/core/safarHierarchy.ts)
 * 
 * Main-process hierarchy parser for Safar folders, Date folders,
 * Session folders, and Item/Category folders.
 * ============================================================
 */

import path from 'path'
import fs from 'fs'

export interface SafarParsedInfo {
  safar: string
  safarName: string
  safarYear?: number
  safarSerial?: string
  city: string
  hijriYear?: number
  hijriMonth?: number
  hijriDay?: number
  session?: string
  sessionTag?: string
  eventCode?: string
  dateFolder?: string
}

const COMMON_CITIES = [
  'Mumbai', 'Indore', 'Surat', 'Dumas', 'Dummas', 'Karachi', 'Pune', 'Nagpur',
  'Ahmedabad', 'Rajkot', 'Delhi', 'Dubai', 'London', 'Colombo', 'Ujjain',
  'Udaipur', 'Hyderabad', 'Chennai', 'Kolkata', 'Jaipur', 'Lucknow',
  'Bhopal', 'Vadodara', 'Thane', 'Aurangabad', 'Raipur', 'Dahod',
  'Burhanpur', 'Godhra', 'Ratlam', 'Mandsaur', 'Neemuch', 'Sidhpur',
  'Patan', 'Jamnagar', 'Bhavnagar', 'Gondal', 'Dhoraji', 'Morbi',
  'Anjar', 'Bhuj', 'Nadiad', 'Anand', 'Khambhat', 'Bharuch',
  'Ankleshwar', 'Navsari', 'Valsad', 'Vapi', 'Silvassa', 'Daman',
  'Kuwait', 'Muscat', 'Abu Dhabi', 'Sharjah', 'Doha', 'Bahrain',
  'Riyadh', 'Jeddah', 'Cairo', 'Nairobi', 'Mombasa', 'Dar es Salaam'
]

const IGNORED_PATH_SEGMENTS = new Set([
  'IN PROCESS', 'INPROCESS', 'IN_PROCESS', 'TEST-UID-STATS', 'TEST',
  'INPUT', 'OUTPUT', 'VIDEOS', 'VIDEO', 'CONVERTED_JPEGS', 'DVD',
  'FINAL TITLES', 'ONE TAP', 'RENDER', 'RENDERS', 'CONTRIBUTOR',
  'DOCUMENT', 'CAM 01', 'CAM 02', 'CAM 03', 'CAM 04', 'CAM 05'
])

export function extractEventCodeFromPath(fullPath: string, stem?: string): string {
  if (!fullPath && !stem) return ''

  // 1. Check folder segments from closest parent upwards
  const dir = path.dirname(fullPath)
  const segments = dir.split(/[/\\]/).filter(Boolean)

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const upper = seg.toUpperCase()
    if (IGNORED_PATH_SEGMENTS.has(upper)) continue

    // A. Match sequence item folder pattern e.g. "-43-27N-60446783", "-43-N-", "-02-01AQ-", "-07-04ZO-", "-18-01N-"
    const m = seg.match(/[-_]\d{1,4}[a-z]?[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i) ||
              seg.match(/[-_]\d{1,4}[a-z]?[-_](\d+)?([A-Za-z]+)[-_]/i) ||
              seg.match(/[-_](\d+)?(N)[-_]/i) ||
              seg.match(/[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i)
    if (m && (m[2] || m[1])) {
      return normalizeCode(m[2] || m[1])
    }

    // B. Direct category folder e.g. "AQ", "N", "MF", "QMZ"
    if (/^[A-Za-z]{1,4}$/.test(seg)) {
      return normalizeCode(seg)
    }

    // C. Aliases in segment
    if (/\b(?:BETHAK|AQIQA)\b/i.test(upper)) return 'AQ'
    if (/\b(?:NAMAZ|NIKAAH|NIKAH)\b/i.test(upper)) return 'N'
    if (/\b(?:ZIYAFAT|ZIYARAT|ZIARAT)\b/i.test(upper)) return 'Z'
    if (/\b(?:MAJLIS)\b/i.test(upper)) return 'M'
    if (/\b(?:QADAM)\b/i.test(upper)) return 'Q'
    if (/\b(?:IDAARA|IDARA)\b/i.test(upper)) return 'ID'
    if (/\b(?:WAAZ)\b/i.test(upper)) return 'WAAZ'

    // Stop traversing if reached Safar root folder or date folder
    if (/^\d{4}[\s-_.]\d{1,2}/.test(seg)) break
  }

  // 2. Check stem
  if (stem) {
    const tokenMatch = stem.toUpperCase().match(/(?:^|[\s-_])(?:\d+[\s-_]*)?([A-Z]{1,4})(?:[\s-_]*\d+)?(?:[\s-_]|$)/)
    if (tokenMatch && tokenMatch[1]) {
      const candidate = tokenMatch[1]
      if (!['THE', 'FOR', 'AND', 'CAM', 'CLIP', 'RUN', 'RAW', 'ALL'].includes(candidate)) {
        return normalizeCode(candidate)
      }
    }
  }

  return ''
}

function normalizeCode(code: string): string {
  const up = code.toUpperCase().trim()
  if (up === 'NAMAZ' || up === 'NIKAAH' || up === 'NIKAH') return 'N'
  if (up === 'BETHAK' || up === 'AQIQA') return 'AQ'
  if (up === 'ZIYAFAT' || up === 'ZIYARAT' || up === 'ZIARAT') return 'Z'
  if (up === 'MAJLIS') return 'M'
  if (up === 'QADAM') return 'Q'
  if (up === 'IDAARA' || up === 'IDARA') return 'ID'
  if (up === 'WAAZ') return 'WAAZ'
  return up
}

export function extractCity(text: string): string | null {
  if (!text) return null
  if (/istefada/i.test(text)) return 'Surat'
  if (/dummas|dumas/i.test(text)) return 'Surat'
  for (const city of COMMON_CITIES) {
    const regex = new RegExp(`(?:^|[\\s-_.,/\\\\])${city}(?:$|[\\s-_.,/\\\\])`, 'i')
    if (regex.test(text)) {
      return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase()
    }
  }
  return null
}

const CONTAINER_ROOTS = new Set([
  'IN PROCESS', 'INPROCESS', 'IN_PROCESS',
  'TO UPLOAD', 'TOUPLOAD', 'TO_UPLOAD',
  'TO DELETE', 'TODELETE', 'TO_DELETE',
  'PENDING', 'SAFARS', 'SAFAR', 'WORKING SAFAR', 'WORKING'
])

export function extractSafarFromContainerPath(fullPath: string): {
  safar: string
  safarName: string
  safarYear?: number
  safarSerial?: string
  city: string
} | null {
  if (!fullPath) return null
  const segments = fullPath.split(/[/\\]/).filter(Boolean)

  for (let i = 0; i < segments.length; i++) {
    const segUpper = segments[i].toUpperCase().trim()
    if (CONTAINER_ROOTS.has(segUpper) && i + 1 < segments.length) {
      const candidate = segments[i + 1].trim()
      const candUpper = candidate.toUpperCase()
      if (['FINAL', 'FINAL TITLES', 'OUTPUT', 'EXPORTS', 'DVD', 'NEW FOLDER', '$RECYCLE.BIN'].includes(candUpper)) {
        continue
      }

      const res: {
        safar: string
        safarName: string
        safarYear?: number
        safarSerial?: string
        city: string
      } = {
        safar: candidate,
        safarName: candidate,
        city: candidate
      }

      const m1 = candidate.match(/^(\d{4})[\s\-_]+(\d{1,3})[\s\-_]+(.*)$/)
      if (m1) {
        res.safarYear = parseInt(m1[1], 10)
        res.safarSerial = m1[2].padStart(2, '0')
        res.safarName = m1[3].trim()
      } else {
        const m2 = candidate.match(/^(\d{1,3})[\s\-_]+(.*)$/)
        if (m2) {
          res.safarSerial = m2[1].padStart(2, '0')
          res.safarName = m2[2].trim()
        } else {
          const m3 = candidate.match(/^(\d{4})[\s\-_]+(.*)$/)
          if (m3) {
            res.safarYear = parseInt(m3[1], 10)
            res.safarName = m3[2].trim()
          }
        }
      }

      const detectedCity = extractCity(res.safarName) || extractCity(candidate)
      res.city = (detectedCity && detectedCity !== 'Unassigned') ? detectedCity : res.safarName

      return res
    }
  }
  return null
}

export function parseSafarFromPath(fullPath: string): SafarParsedInfo {
  const result: SafarParsedInfo = {
    safar: 'Unassigned',
    safarName: 'Unassigned',
    city: 'Unassigned'
  }

  if (!fullPath) return result

  // Step 0: Check if fullPath is inside an IN PROCESS / TO UPLOAD container
  // The folder one step inside is unambiguously the Safar main folder!
  const containerSafar = extractSafarFromContainerPath(fullPath)
  if (containerSafar) {
    result.safar = containerSafar.safar
    result.safarName = containerSafar.safarName
    if (containerSafar.safarYear) result.safarYear = containerSafar.safarYear
    if (containerSafar.safarSerial) result.safarSerial = containerSafar.safarSerial
    result.city = containerSafar.city
  }

  // Step 1: Check if directory contains safar_info.json or folder_structure.json
  try {
    let checkDir = fullPath
    if (!fs.existsSync(checkDir) || !fs.statSync(checkDir).isDirectory()) {
      checkDir = path.dirname(fullPath)
    }
    let cur = checkDir
    for (let depth = 0; depth < 4; depth++) {
      const infoPath = path.join(cur, 'safar_info.json')
      const structPath = path.join(cur, 'folder_structure.json')
      const target = fs.existsSync(infoPath) ? infoPath : (fs.existsSync(structPath) ? structPath : null)
      if (target) {
        const data = JSON.parse(fs.readFileSync(target, 'utf-8'))
        if (data.safar) result.safar = data.safar
        if (data.safarName) result.safarName = data.safarName
        if (data.safarYear) result.safarYear = data.safarYear
        if (data.safarSerial) result.safarSerial = String(data.safarSerial).padStart(2, '0')
        if (data.city) result.city = data.city
        if (data.hijriYear && !result.hijriYear) result.hijriYear = data.hijriYear
        if (data.hijriMonth && !result.hijriMonth) result.hijriMonth = data.hijriMonth
        break
      }
      const parent = path.dirname(cur)
      if (parent === cur) break
      cur = parent
    }
  } catch {}

  const segments = fullPath.split(/[/\\]/).filter(Boolean)

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const upper = seg.toUpperCase()
    if (IGNORED_PATH_SEGMENTS.has(upper)) continue

    // Event code
    if (!result.eventCode) {
      const code = extractEventCodeFromPath(seg)
      if (code) result.eventCode = code
    }

    // Session
    if (!result.session) {
      if (/bethak/i.test(seg)) result.session = 'Bethak'
      else if (/qmz/i.test(seg)) result.session = 'QMZ'
      else if (/majlis/i.test(seg)) result.session = 'Majlis'
      else if (/namaz/i.test(seg)) result.session = 'Namaz'
      else if (/ziyarat/i.test(seg)) result.session = 'Ziyarat'
    }

    // Date
    if (!result.hijriMonth) {
      const tagMatch = seg.match(/(_\d{1,2}[A-Za-z])/i)
      if (tagMatch) result.sessionTag = tagMatch[1].toUpperCase()

      const dm1 = seg.match(/(\d{4})[\s-_.](\d{1,2})(?:[\s-_.](\d{1,2}))?/)
      if (dm1) {
        const y = parseInt(dm1[1])
        const m = parseInt(dm1[2])
        if (y >= 1400 && y <= 1500 && m >= 1 && m <= 12) {
          result.hijriYear = y
          result.hijriMonth = m
          if (dm1[3]) result.hijriDay = parseInt(dm1[3])
        }
      } else {
        const dm2 = seg.match(/^(\d{1,2})[\s-_.](\d{1,2})(?:$|[\s_])/)
        if (dm2) {
          const m = parseInt(dm2[1])
          const d = parseInt(dm2[2])
          if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            result.hijriMonth = m
            result.hijriDay = d
          }
        }
      }
    }

    // Safar root folder
    if (result.safar === 'Unassigned') {
      // ── Date folder detection ──────────────────────────────────────────────
      // CRITICAL: "1447-08 Mumbai", "2024-09 Surat" are SAFAR roots, NOT date folders.
      // A segment is a pure date folder ONLY when it has NO city name or meaningful
      // word after the numeric portion. If a word/city follows → it's a Safar root.

      // Does the segment have a real word (2+ letters) after the date numbers?
      const hasMeaningfulWordAfterNumbers = /^\d{4}[\s-_.]\d{1,2}[\s-_.]+[A-Za-z]{2,}/.test(seg) ||
        /^\d{1,3}[\s-_.]+[A-Za-z]{2,}/.test(seg)

      // Does the segment contain any known city name?
      const segLower = seg.toLowerCase()
      const hasCityInSegment = COMMON_CITIES.some(city =>
        segLower.includes(city.toLowerCase())
      )

      // Pure date-only patterns (exact match, no trailing text)
      const isPureDateFolder =
        /^\d{4}[\s-_.]\d{1,2}[\s-_.]\d{1,2}$/.test(seg) ||        // YYYY-MM-DD
        /^\d{4}[\s-_.]\d{1,2}[\s_]+_\d{1,2}[A-Za-z]/.test(seg) || // YYYY-MM _01M
        /^\d{4}[\s-_.]\d{1,2}$/.test(seg)                           // YYYY-MM (exact)

      // Only skip as date folder if purely numeric — if it has a city or word, it's a Safar root
      const isDateFolderPattern = isPureDateFolder && !hasMeaningfulWordAfterNumbers && !hasCityInSegment

      if (isDateFolderPattern) {
        if (!result.dateFolder) result.dateFolder = seg
        continue
      }
      if (/^\d{2}[-_][A-Za-z]+[-_](?:Bethak|QMZ|Majlis|Namaz|Ziyarat|Sermon)$/i.test(seg)) {
        continue
      }

      const p1 = seg.match(/^(\d{4})[\s-_]+(\d{1,3})[\s-_]+([A-Za-z].+)$/)
      if (p1) {
        result.safar = seg
        result.safarYear = parseInt(p1[1])
        result.safarSerial = p1[2].padStart(2, '0')
        result.safarName = p1[3].trim()
        result.city = extractCity(result.safarName) || extractCity(seg) || 'Unassigned'
        continue
      }

      const p2 = seg.match(/^(\d{1,3})[\s-_]+([A-Za-z].+)$/)
      if (p2) {
        result.safar = seg
        result.safarSerial = p2[1].padStart(2, '0')
        result.safarName = p2[2].trim()
        result.city = extractCity(result.safarName) || extractCity(seg) || 'Unassigned'
        continue
      }

      const p3 = seg.match(/^(\d{4})[\s-_]+([A-Za-z].+)$/)
      if (p3) {
        result.safar = seg
        result.safarYear = parseInt(p3[1])
        result.safarName = p3[2].trim()
        result.city = extractCity(result.safarName) || extractCity(seg) || 'Unassigned'
        continue
      }

      const c = extractCity(seg)
      if (c && seg.length > 5) {
        result.safar = seg
        result.safarName = seg.trim()
        result.city = c
      }
    }
  }

  if (!result.hijriYear && result.safarYear) {
    result.hijriYear = result.safarYear
  }

  if (result.city === 'Unassigned') {
    const c = extractCity(fullPath)
    if (c) result.city = c
  }

  return result
}
