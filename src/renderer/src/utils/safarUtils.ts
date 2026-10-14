/**
 * ============================================================
 * SAFAR & HIERARCHY UTILITIES (src/renderer/src/utils/safarUtils.ts)
 * 
 * Supports parsing real-world hierarchical folder structures:
 * e.g. "D:\TEST-UID-Stats\1447-08 Mumbai - Urs Mubarak Syedna Mohammed Burhanuddin RA\1448-03-13 _01M\01-Mumbai-Bethak\1448-03-13 _01M-02-01AQ-30338708\video.mp4"
 * 
 * Components:
 * 1. Root Safar Folder: "Year-Serial-SafarName" (or without year/serial)
 * 2. Date Folder: "1448-03-13 _01M" / "1448-02-23" / "06-12"
 * 3. Session Folder: "01-Mumbai-Bethak" / "04-Mumbai-QMZ"
 * 4. Item / Category Folder: "-02-01AQ-" / "-01-TNQ-" / "-04-01Z-" / "N"
 * ============================================================
 */

import { hijriFromGregorian } from './dateUtils'

export interface ParsedSafarHierarchy {
  safar: string              // Full Safar identifier e.g. "1447-08 Mumbai - Urs Mubarak Syedna Mohammed Burhanuddin RA"
  safarName: string          // Clean name e.g. "Mumbai - Urs Mubarak Syedna Mohammed Burhanuddin RA"
  safarYear?: number         // e.g. 1447
  safarSerial?: string       // e.g. "08"
  city: string               // e.g. "Mumbai"
  hijriYear?: number         // From date folder e.g. 1448
  hijriMonth?: number        // e.g. 3
  hijriDay?: number          // e.g. 13
  session?: string           // e.g. "Bethak", "QMZ", "Majlis", "Waaz"
  sessionTag?: string        // e.g. "_01M", "_02E"
  eventCode?: string         // e.g. "AQ", "N", "Z", "Q", "MF", "TNQ", "H", "MI", "BQ"
  itemIndex?: string         // e.g. "02"
  itsId?: string             // e.g. "30338708"
  personName?: string        // e.g. "Mulla Murtaza bhai Shaikh Juzer bhai Sounasath"
  rawFolder: string
}

export const KNOWN_PREFIX_NAMES: Record<string, string> = {
  'AQ': 'Aqiqa',
  'BM': 'Bethak Majlis',
  'BQ': 'Bethak Qadam',
  'BZ': 'Bethak Ziyafat',
  'FMB': 'FMB',
  'H': 'Haddiyat',
  'ID': 'Idaraat',
  'IF': 'Iftettah',
  'IFS': 'Iftettah Sharaf',
  'IST': 'Isteqbal',
  'KGS': 'Kg Sharaf',
  'M': 'Majlis',
  'MF': 'Mafsuhiyat',
  'MISBAH': 'Misbah',
  'MKB': 'Mokib',
  'MO': 'Madrasa',
  'MQ': 'Misaq',
  'MUL': 'Mulaqaat',
  'MYN': 'Miyana',
  'MZ': 'Majmui Ziyafat',
  'N': 'Nikah',
  'NAMAZ': 'Namaz',
  'ONLINE': 'Online',
  'Q': 'Qadam',
  'QMZ': 'Qadam Majlis Ziyafat',
  'SH': 'Sharaf',
  'SQ': 'Shifa Qadam',
  'TJR': 'Tijarat',
  'TQ': 'Talaqqi',
  'TQN': 'Tahneeq',
  'WAAZ': 'Waaz',
  'WD': 'Wada',
  'Z': 'Ziyafat',
  'ZO': 'Zafaf Olda',
  'OZ': 'Olda Zafaf'
}

export const PREDEFINED_PREFIX_COLORS: Record<string, { accent: string; soft: string }> = {
  'Q':       { accent: '#3b82f6', soft: 'rgba(59, 130, 246, 0.15)' },
  'QMZ':     { accent: '#2563eb', soft: 'rgba(37, 99, 235, 0.15)' },
  'M':       { accent: '#10b981', soft: 'rgba(16, 185, 129, 0.15)' },
  'Z':       { accent: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.15)' },
  'MZ':      { accent: '#ec4899', soft: 'rgba(236, 72, 153, 0.15)' },
  'N':       { accent: '#6366f1', soft: 'rgba(99, 102, 241, 0.15)' },
  'NAMAZ':   { accent: '#4f46e5', soft: 'rgba(79, 70, 229, 0.15)' },
  'AQ':      { accent: '#eab308', soft: 'rgba(234, 179, 8, 0.15)' },
  'BM':      { accent: '#059669', soft: 'rgba(5, 150, 105, 0.15)' },
  'BQ':      { accent: '#14b8a6', soft: 'rgba(20, 184, 166, 0.15)' },
  'BZ':      { accent: '#a855f7', soft: 'rgba(168, 85, 247, 0.15)' },
  'H':       { accent: '#f43f5e', soft: 'rgba(244, 63, 94, 0.15)' },
  'ID':      { accent: '#f59e0b', soft: 'rgba(245, 158, 11, 0.15)' },
  'IF':      { accent: '#0284c7', soft: 'rgba(2, 132, 199, 0.15)' },
  'IFS':     { accent: '#0369a1', soft: 'rgba(3, 105, 161, 0.15)' },
  'IST':     { accent: '#d97706', soft: 'rgba(217, 119, 6, 0.15)' },
  'KGS':     { accent: '#84cc16', soft: 'rgba(132, 204, 22, 0.15)' },
  'MF':      { accent: '#d946ef', soft: 'rgba(217, 70, 239, 0.15)' },
  'MISBAH':  { accent: '#e11d48', soft: 'rgba(225, 29, 72, 0.15)' },
  'MKB':     { accent: '#0891b2', soft: 'rgba(8, 145, 178, 0.15)' },
  'MO':      { accent: '#16a34a', soft: 'rgba(22, 163, 74, 0.15)' },
  'MQ':      { accent: '#9333ea', soft: 'rgba(147, 51, 234, 0.15)' },
  'MUL':     { accent: '#c026d3', soft: 'rgba(192, 38, 211, 0.15)' },
  'MYN':     { accent: '#7c3aed', soft: 'rgba(124, 58, 237, 0.15)' },
  'ONLINE':  { accent: '#0284c7', soft: 'rgba(2, 132, 199, 0.15)' },
  'SH':      { accent: '#3b82f6', soft: 'rgba(59, 130, 246, 0.15)' },
  'SQ':      { accent: '#06b6d4', soft: 'rgba(6, 182, 212, 0.15)' },
  'TJR':     { accent: '#ea580c', soft: 'rgba(234, 88, 12, 0.15)' },
  'TQ':      { accent: '#0ea5e9', soft: 'rgba(14, 165, 233, 0.15)' },
  'TQN':     { accent: '#38bdf8', soft: 'rgba(56, 189, 248, 0.15)' },
  'WAAZ':    { accent: '#06b6d4', soft: 'rgba(6, 182, 212, 0.15)' },
  'WD':      { accent: '#64748b', soft: 'rgba(100, 116, 139, 0.15)' },
  'ZO':      { accent: '#9333ea', soft: 'rgba(147, 51, 234, 0.15)' },
  'OZ':      { accent: '#9333ea', soft: 'rgba(147, 51, 234, 0.15)' },
  'FMB':     { accent: '#10b981', soft: 'rgba(16, 185, 129, 0.15)' },
  'OTHER':   { accent: '#64748b', soft: 'rgba(100, 116, 139, 0.15)' }
}

/**
 * Returns consistent accent and soft glow colors for any prefix (built-in or dynamically discovered).
 */
export function getPrefixColorTheme(prefix: string): { accent: string; soft: string; accentSoft: string } {
  const upper = (prefix || 'OTHER').toUpperCase().trim()
  if (PREDEFINED_PREFIX_COLORS[upper]) {
    const p = PREDEFINED_PREFIX_COLORS[upper]
    return { accent: p.accent, soft: p.soft, accentSoft: p.soft }
  }

  // Generate deterministic HSL based on prefix string hash
  let hash = 0
  for (let i = 0; i < upper.length; i++) {
    hash = upper.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  const soft = `hsla(${hue}, 80%, 65%, 0.15)`
  return {
    accent: `hsl(${hue}, 80%, 65%)`,
    soft,
    accentSoft: soft
  }
}

/**
 * Human-readable name for any event code.
 */
export function formatPrefixName(prefix: string): string {
  const upper = (prefix || '').toUpperCase().trim()
  return KNOWN_PREFIX_NAMES[upper] || upper || 'Unknown'
}

export const COMMON_CITIES = [
  'Mumbai', 'Indore', 'Surat', 'Dumas', 'Dummas', 'Karachi', 'Pune', 'Nagpur',
  'Ahmedabad', 'Rajkot', 'Delhi', 'Dubai', 'London', 'Colombo', 'Ujjain',
  'Udaipur', 'Hyderabad', 'Chennai', 'Kolkata', 'Jaipur', 'Lucknow',
  'Bhopal', 'Vadodara', 'Thane', 'Aurangabad', 'Raipur', 'Dahod',
  'Burhanpur', 'Godhra', 'Ratlam', 'Mandsaur', 'Neemuch', 'Sidhpur',
  'Patan', 'Jamnagar', 'Bhavnagar', 'Gondal', 'Dhoraji', 'Morbi',
  'Anjar', 'Bhuj', 'Nadiad', 'Anand', 'Khambhat', 'Bharuch',
  'Ankleshwar', 'Navsari', 'Valsad', 'Vapi', 'Silvassa', 'Daman',
  'Kuwait', 'Muscat', 'Abu Dhabi', 'Sharjah', 'Doha', 'Bahrain',
  'Riyadh', 'Jeddah', 'Cairo', 'Nairobi', 'Mombasa', 'Dar es Salaam',
  'Madagascar', 'Reunion', 'Houston', 'Chicago', 'Dallas', 'Los Angeles',
  'New York', 'Toronto', 'Edmonton', 'Calgary', 'Vancouver', 'Sydney',
  'Melbourne', 'Auckland', 'Singapore', 'Bangkok'
]

const IGNORED_PATH_SEGMENTS = new Set([
  'IN PROCESS', 'INPROCESS', 'IN_PROCESS', 'TEST-UID-STATS', 'TEST',
  'INPUT', 'OUTPUT', 'VIDEOS', 'VIDEO', 'CONVERTED_JPEGS', 'DVD',
  'FINAL TITLES', 'FINAL', 'ONE TAP', 'RENDER', 'RENDERS', 'CONTRIBUTOR',
  'DOCUMENT', 'CAM 01', 'CAM 02', 'CAM 03', 'CAM 04', 'CAM 05',
  'ADOBE PREMIERE PRO AUTO-SAVE', 'NEW FOLDER'
])

/**
 * Robust event code extractor from folder item segment, thumbnail, or filename stem.
 * Handles patterns:
 *   - Sequence item folder: "1448-03-13 _01M-02-01AQ-30338708" -> "AQ"
 *   - Sequence item folder: "1448-03-14 _02E-07-04ZO-30304434" -> "ZO"
 *   - Sequence item folder: "1448-03-14 _02E-07a-04SHQ-30387293" -> "SHQ"
 *   - Sequence item folder: "1448-03-13 _01M-18-01N-50423626" -> "N"
 *   - Sequence item folder: "1448-03-13 _01M-01-TNQ-50458093" -> "TNQ"
 *   - Sequence item folder: "1448-03-13 _01M-05-H-" -> "H"
 *   - Aliases: "Bethak" -> "AQ", "Namaz" / "Nikaah" -> "N", "Ziyarat" / "Ziyafat" -> "Z", "Majlis" -> "M", "Qadam" -> "Q"
 *   - Any dynamic code: "MF", "01MF", "MF-01", etc.
 */
export function extractEventCode(text: string): string {
  if (!text) return ''
  const clean = text.replace(/\.[^/.]+$/, '').trim()

  // 1. Check sequence item folder pattern e.g. "1448-04-05 _02E-43-27N-60446783" or "-43-N-"
  const seqMatch = clean.match(/[-_]\d{1,4}[a-z]?[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i) ||
                   clean.match(/[-_]\d{1,4}[a-z]?[-_](\d+)?([A-Za-z]+)[-_]/i) ||
                   clean.match(/[-_](\d+)?(N)[-_]/i) ||
                   clean.match(/[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i)
  if (seqMatch && (seqMatch[2] || seqMatch[1])) {
    const raw = (seqMatch[2] || seqMatch[1]).toUpperCase()
    return normalizeCode(raw)
  }

  // 2. Direct category subfolder e.g. "AQ", "N", "MF", "QMZ"
  if (/^[A-Za-z]{1,4}$/.test(clean)) {
    return normalizeCode(clean.toUpperCase())
  }

  // 3. Aliases in text
  const upper = clean.toUpperCase()
  if (/\b(?:BETHAK|AQIQA)\b/i.test(upper)) return 'AQ'
  if (/\b(?:NAMAZ|NIKAAH|NIKAH)\b/i.test(upper)) return 'N'
  if (/\b(?:ZIYAFAT|ZIYARAT|ZIARAT)\b/i.test(upper)) return 'Z'
  if (/\b(?:MAJLIS)\b/i.test(upper)) return 'M'
  if (/\b(?:QADAM)\b/i.test(upper)) return 'Q'
  if (/\b(?:IDAARA|IDARA)\b/i.test(upper)) return 'ID'
  if (/\b(?:WAAZ)\b/i.test(upper)) return 'WAAZ'

  // 4. Token pattern e.g. "001 Z01", "002 01AQ", "01-MF", "Clip_MF"
  const tokenMatch = upper.match(/(?:^|[\s-_])(?:\d+[\s-_]*)?([A-Z]{1,4})(?:[\s-_]*\d+)?(?:[\s-_]|$)/)
  if (tokenMatch && tokenMatch[1]) {
    const candidate = tokenMatch[1]
    if (!['THE', 'FOR', 'AND', 'CAM', 'CLIP', 'RUN', 'RAW', 'ALL'].includes(candidate)) {
      return normalizeCode(candidate)
    }
  }

  return ''
}

function normalizeCode(code: string): string {
  const up = code.toUpperCase().trim()
  if (up === 'NAMAZ' || up === 'NIKAAH' || up === 'NIKAH') return 'N'
  if (up === 'BETHAK' || up === 'AQIQA' || up === 'AQUEEQAH') return 'AQ'
  if (up === 'ZIYAFAT' || up === 'ZIYARAT' || up === 'ZIARAT') return 'Z'
  if (up === 'MAJLIS') return 'M'
  if (up === 'QADAM') return 'Q'
  if (up === 'IDAARA' || up === 'IDARA') return 'ID'
  if (up === 'WAAZ') return 'WAAZ'
  if (up === 'MISAQ_ZUKOOR' || up === 'MISAQZUKOOR') return 'MZ'
  if (up === 'MISAQ_INAS' || up === 'MISAQINAS' || up === 'MIN') return 'MI'
  if (up === 'TAHANI_QADAM' || up === 'TAHANIQADAM' || up === 'TAHANI') return 'TNQ'
  if (up === 'HADIYAH' || up === 'HADIYA') return 'H'
  if (up === 'BADA_QADAM' || up === 'BADAQADAM') return 'BQ'
  if (up === 'BADI_MAJLIS' || up === 'BADIMAJLIS') return 'BM'
  if (up === 'BADI_ZIYARAT' || up === 'BADIZIYARAT') return 'BZ'
  return up
}

/**
 * Extracts Hijri Year, Month, Day, and optional session tag (_01M, _02E) from a date folder segment.
 * Matches: "1448-03-13 _01M", "1448-03-14 _02E", "1448-02-23", "06-12", "23-02-1448"
 */
function parseDateSegment(segment: string): {
  year?: number
  month?: number
  day?: number
  sessionTag?: string
} {
  if (!segment) return {}

  let sessionTag: string | undefined
  const tagMatch = segment.match(/(_\d{1,2}[A-Za-z])/i)
  if (tagMatch) {
    sessionTag = tagMatch[1].toUpperCase()
  }

  // 1. Matches "1448-03-13" or "1447_08_02"
  const m1 = segment.match(/(\d{4})[\s-_.](\d{1,2})(?:[\s-_.](\d{1,2}))?/)
  if (m1) {
    const y = parseInt(m1[1])
    const m = parseInt(m1[2])
    const d = m1[3] ? parseInt(m1[3]) : undefined
    if (y >= 1400 && y <= 1500 && m >= 1 && m <= 12) {
      return { year: y, month: m, day: d, sessionTag }
    }
  }

  // 2. Matches "23-02-1448" (day-month-year)
  const m2 = segment.match(/(\d{1,2})[\s-_.](\d{1,2})[\s-_.](\d{4})/)
  if (m2) {
    const d = parseInt(m2[1])
    const m = parseInt(m2[2])
    const y = parseInt(m2[3])
    if (y >= 1400 && y <= 1500 && m >= 1 && m <= 12) {
      return { year: y, month: m, day: d, sessionTag }
    }
  }

  // 3. Matches month-day "06-12"
  const m3 = segment.match(/^(\d{1,2})[\s-_.](\d{1,2})(?:$|[\s_])/)
  if (m3) {
    const m = parseInt(m3[1])
    const d = parseInt(m3[2])
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { month: m, day: d, sessionTag }
    }
  }

  return { sessionTag }
}

/**
 * Detects whether a segment is a main Safar folder.
 * Matches:
 *   "1447-08 Mumbai - Urs Mubarak Syedna Mohammed Burhanuddin RA"
 *   "1448-02 Mumbai - Bethak"
 *   "08 Mumbai - Urs Mubarak"
 *   "Mumbai - Urs Mubarak Syedna Mohammed Burhanuddin RA"
 */
function parseSafarSegment(segment: string): {
  isSafar: boolean
  year?: number
  serial?: string
  safarName: string
  city: string
} | null {
  if (!segment) return null
  const upper = segment.toUpperCase()
  if (IGNORED_PATH_SEGMENTS.has(upper)) return null

  // Skip ONLY if it's a pure date folder like "1448-03-13 _01M", "1448-03-13", or "06-12"
  // A Safar like "1448-03 Mumbai" must NOT be skipped — it has city text after the serial
  // Rule: skip if year-month-day (3 numeric parts) OR if year-month ends with session tag, 
  //       but NOT if year-serial is followed by a city name (text starting with a letter)
  const isDateFolderPattern =
    /^\d{4}[\s-_.]\d{1,2}[\s-_.]\d{1,2}/.test(segment) ||          // YYYY-MM-DD
    /^\d{4}[\s-_.]\d{1,2}[\s_]+_\d{1,2}[A-Za-z]/.test(segment) ||  // YYYY-MM _01M (session tag)
    (/^\d{4}[\s-_.]\d{1,2}$/.test(segment))                          // YYYY-MM (exactly, nothing after)
  // IMPORTANT: "1448-03 Mumbai" must pass through (serial followed by city name)
  const hasCityAfterSerial = /^\d{4}[\s-_.]\d{1,2}[\s-_.]+[A-Za-z]/.test(segment)
  if (isDateFolderPattern && !hasCityAfterSerial) {
    return null
  }  // Skip if it's a session folder like "01-Mumbai-Bethak"
  if (/^\d{2}[-_][A-Za-z]+[-_](?:Bethak|QMZ|Majlis|Namaz|Ziyarat|Waaz|Sermon)$/i.test(segment)) {
    return null
  }

  // Pattern 1: [Year]-[Serial] [Safar Name]
  // e.g. "1447-08 Mumbai - Urs Mubarak Syedna Mohammed Burhanuddin RA"
  // or "1448-10-Istefada ilmiyah"
  const p1 = segment.match(/^(\d{4})[\s-_]+(\d{1,3})[\s-_]+([A-Za-z].+)$/)
  if (p1) {
    const y = parseInt(p1[1])
    const serial = p1[2].padStart(2, '0')
    const name = p1[3].trim()
    const detectedCity = extractCity(name) || extractCity(segment)
    const city = (detectedCity && detectedCity !== 'Unassigned') ? detectedCity : name
    return { isSafar: true, year: y, serial, safarName: name, city }
  }

  // Pattern 2: [Serial] [Safar Name] e.g. "08 Mumbai - Urs Mubarak"
  const p2 = segment.match(/^(\d{1,3})[\s-_]+([A-Za-z].+)$/)
  if (p2) {
    const serial = p2[1].padStart(2, '0')
    const name = p2[2].trim()
    const detectedCity = extractCity(name) || extractCity(segment)
    const city = (detectedCity && detectedCity !== 'Unassigned') ? detectedCity : name
    return { isSafar: true, serial, safarName: name, city }
  }

  // Pattern 3: [Year] [Safar Name] e.g. "1447 Mumbai - Urs Mubarak"
  const p3 = segment.match(/^(\d{4})[\s-_]+([A-Za-z].+)$/)
  if (p3) {
    const y = parseInt(p3[1])
    const name = p3[2].trim()
    const detectedCity = extractCity(name) || extractCity(segment)
    const city = (detectedCity && detectedCity !== 'Unassigned') ? detectedCity : name
    return { isSafar: true, year: y, safarName: name, city }
  }

  // Pattern 4: Standalone City or Recognized Safar Name
  const city = extractCity(segment)
  if (city && city !== 'Unassigned') {
    return { isSafar: true, safarName: segment, city }
  }

  return null
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

/**
 * Parses full path or relative path to extract rich Safar hierarchy.
 */
export function parseSafarHierarchy(fullPathOrFolder: string): ParsedSafarHierarchy {
  const result: ParsedSafarHierarchy = {
    safar: 'Unassigned',
    safarName: 'Unassigned',
    city: 'Unassigned',
    rawFolder: fullPathOrFolder || ''
  }

  if (!fullPathOrFolder) return result

  const segments = fullPathOrFolder.split(/[/\\]/).filter(Boolean)
  if (segments.length === 0) return result

  // Step 0: Priority check: folder one step inside IN PROCESS / TO UPLOAD / TO DELETE
  for (let i = 0; i < segments.length; i++) {
    const segUpper = segments[i].toUpperCase().trim()
    if (CONTAINER_ROOTS.has(segUpper) && i + 1 < segments.length) {
      const candidate = segments[i + 1].trim()
      const candUpper = candidate.toUpperCase()
      if (!['FINAL', 'FINAL TITLES', 'OUTPUT', 'EXPORTS', 'DVD', 'NEW FOLDER', '$RECYCLE.BIN'].includes(candUpper)) {
        result.safar = candidate
        const m1 = candidate.match(/^(\d{4})[\s\-_]+(\d{1,3})[\s\-_]+(.*)$/)
        const m2 = candidate.match(/^(\d{1,3})[\s\-_]+(.*)$/)
        const m3 = candidate.match(/^(\d{4})[\s\-_]+(.*)$/)
        if (m1) {
          result.safarYear = parseInt(m1[1], 10)
          result.safarSerial = m1[2].padStart(2, '0')
          result.safarName = m1[3].trim()
        } else if (m2) {
          result.safarSerial = m2[1].padStart(2, '0')
          result.safarName = m2[2].trim()
        } else if (m3) {
          result.safarYear = parseInt(m3[1], 10)
          result.safarName = m3[2].trim()
        } else {
          result.safarName = candidate.trim()
        }
        const detectedCity = extractCity(result.safarName) || extractCity(candidate)
        result.city = (detectedCity && detectedCity !== 'Unassigned') ? detectedCity : result.safarName
        break
      }
    }
  }

  // Step 1: Scan segments from deepest to shallowest
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const upper = seg.toUpperCase()
    if (IGNORED_PATH_SEGMENTS.has(upper)) continue

    // Item folder pattern e.g. "1448-03-13 _01M-02-01AQ-30338708"
    const itemMatch = seg.match(/-(\d{1,3}[a-z]?)-(?:(\d{1,3})?([A-Za-z]+))-(?:(\d{5,8}))?/i)
    if (itemMatch) {
      if (!result.itemIndex && itemMatch[1]) result.itemIndex = itemMatch[1]
      if (!result.eventCode && itemMatch[3]) result.eventCode = normalizeCode(itemMatch[3])
      if (!result.itsId && itemMatch[4]) result.itsId = itemMatch[4]
    }

    // Direct ITS pattern e.g. "-30338708" or "40490"
    if (!result.itsId) {
      const itsMatch = seg.match(/(?:^|[-_])(\d{5,8})(?:\.[a-z0-9]+)?$/i)
      if (itsMatch) {
        result.itsId = itsMatch[1]
      }
    }

    // Person Name pattern: if parent is an item folder or segment looks like a person's full name
    if (!result.personName && i > 0) {
      const parentSeg = segments[i - 1]
      if (/-\d{1,3}[a-z]?-/i.test(parentSeg) && /^[A-Za-z\s.'-]{4,}$/.test(seg) && !IGNORED_PATH_SEGMENTS.has(upper)) {
        result.personName = seg.trim()
      }
    }

    // A. Check for event code in item segment or subfolder
    if (!result.eventCode) {
      const code = extractEventCode(seg)
      if (code) {
        result.eventCode = code
      }
    }

    // B. Check for session folder e.g. "01-Mumbai-Bethak", "02-Mumbai-Waaz", "04-Mumbai-QMZ", "Majlis"
    if (!result.session) {
      if (/bethak/i.test(seg)) result.session = 'Bethak'
      else if (/waaz/i.test(seg)) result.session = 'Waaz'
      else if (/qmz/i.test(seg)) result.session = 'QMZ'
      else if (/majlis/i.test(seg)) result.session = 'Majlis'
      else if (/namaz/i.test(seg)) result.session = 'Namaz'
      else if (/ziyarat/i.test(seg)) result.session = 'Ziyarat'
    }

    // C. Check for date folder e.g. "1448-03-13 _01M"
    if (!result.hijriMonth) {
      const dt = parseDateSegment(seg)
      if (dt.year || dt.month) {
        if (dt.year) result.hijriYear = dt.year
        if (dt.month) result.hijriMonth = dt.month
        if (dt.day) result.hijriDay = dt.day
        if (dt.sessionTag) result.sessionTag = dt.sessionTag
      }
    }

    // D. Check for Safar root folder
    if (result.safar === 'Unassigned') {
      const safarInfo = parseSafarSegment(seg)
      if (safarInfo && safarInfo.isSafar) {
        result.safar = seg
        result.safarName = safarInfo.safarName
        result.safarYear = safarInfo.year
        result.safarSerial = safarInfo.serial
        result.city = safarInfo.city
      }
    }
  }

  // Fallback: If hijriYear is not in date folder, use Safar year
  if (!result.hijriYear && result.safarYear) {
    result.hijriYear = result.safarYear
  }

  // Fallback: If city was detected anywhere, ensure it's not Unassigned
  if (result.city === 'Unassigned') {
    const c = extractCity(fullPathOrFolder)
    if (c) result.city = c
  }

  return result
}

/**
 * Backward compatibility functions with legacy cityUtils
 */
export function parseFolderName(folderNameOrPath: string): {
  hijriYear?: number
  hijriMonth?: number
  hijriDay?: number
  city?: string
  safar?: string
  safarSerial?: string
} {
  const h = parseSafarHierarchy(folderNameOrPath)
  return {
    hijriYear: h.hijriYear,
    hijriMonth: h.hijriMonth,
    hijriDay: h.hijriDay,
    city: h.city !== 'Unassigned' ? h.city : undefined,
    safar: h.safar !== 'Unassigned' ? h.safar : undefined,
    safarSerial: h.safarSerial
  }
}

export function detectCity(stem: string, folder?: string): string {
  const parsed = parseSafarHierarchy(`${folder || ''}/${stem || ''}`)
  return parsed.city
}

export interface TargetFinalInfo {
  isFinalMaster: boolean
  displayCompact: string
  eventCode?: string
  dateSession?: string
  cameraman?: string
}

/**
 * Robustly maps any raw video clip or directory to its target final video.
 * e.g. "1448-02-29 _02E\01-Raipur-QMZ\17-Q\Mustafa bhai...\C001.MP4" -> "17-Q • 1448-02-29 _02E"
 */
export function extractTargetFinalVideo(
  relativePath: string = '',
  fileName: string = '',
  extraContext?: { date?: string; session?: string; eventCode?: string; safar?: string }
): TargetFinalInfo {
  const normRel = (relativePath || '').replace(/\\/g, '/').trim()
  const normFile = (fileName || '').trim()

  // 1. Check if item is already inside Final output tree
  if (/^final(?:$|\/)/i.test(normRel) || /\/final(?:$|\/)/i.test(normRel)) {
    const cleanStem = normFile.replace(/\.[^/.]+$/, '').replace(/_V$/i, '').trim()
    return {
      isFinalMaster: true,
      displayCompact: cleanStem ? `🎬 ${cleanStem}` : '🎬 Final Master',
      eventCode: extractEventCode(cleanStem) || undefined
    }
  }

  const segments = normRel.split('/').filter(Boolean)
  let dateSession = ''
  let eventCode = ''
  let cameraman = ''

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    // A. Detect date / session segment: e.g. "1448-02-29 _02E", "1448-03-04 _01M", "1448-02-29"
    if (!dateSession) {
      const dm = seg.match(/(\d{4}[-_.]\d{1,2}(?:[-_.]\d{1,2})?(?:\s*_\d{1,2}[A-Za-z])?)/i)
      if (dm) {
        dateSession = dm[1].trim()
      } else {
        const dm2 = seg.match(/^(\d{1,2}[-_.]\d{1,2}(?:[-_.]\d{4})?(?:\s*_\d{1,2}[A-Za-z])?)$/i)
        if (dm2) {
          dateSession = dm2[1].trim()
        }
      }
    }

    // B. Detect event folder: e.g. "17-Q", "01-Q", "02-01AQ", "01-M", "05-BZ", "01-Q Qadam", "17-Q_Farhan"
    if (!eventCode) {
      const em = seg.match(/^(\d{1,3}[a-z]?[-_][A-Za-z0-9]{1,6})(?:[\s-_(].*)?$/i)
      if (em) {
        eventCode = em[1].toUpperCase()
      } else {
        const itemMatch = seg.match(/-(\d{1,3}[a-z]?-([A-Za-z0-9]+))-/i)
        if (itemMatch && itemMatch[1]) {
          eventCode = itemMatch[1].toUpperCase()
        } else {
          // Direct event abbreviation subfolder (e.g. "QMZ", "AQ", "N")
          const directCode = extractEventCode(seg)
          if (directCode && ['AQ', 'N', 'Z', 'Q', 'M', 'MZ', 'QMZ', 'WAAZ', 'ID', 'BM', 'BQ', 'BZ'].includes(directCode)) {
            eventCode = directCode
          }
        }
      }
    }

    // C. Detect cameraman folder
    if (eventCode && !cameraman && i > 0) {
      const upper = seg.toUpperCase()
      if (!seg.toUpperCase().includes(eventCode) && !IGNORED_PATH_SEGMENTS.has(upper)) {
        cameraman = seg.trim()
      }
    }
  }

  // Fallback to extraContext if available
  if (!dateSession && extraContext?.date) {
    dateSession = extraContext.date
  }
  if (!eventCode && extraContext?.eventCode) {
    eventCode = extraContext.eventCode
  }

  // If no event folder was in the path, inspect the filename
  if (!eventCode && normFile) {
    const fileEvent = extractEventCode(normFile)
    if (fileEvent) {
      eventCode = fileEvent
    }
  }

  let displayCompact = '—'
  if (eventCode && dateSession) {
    displayCompact = `${eventCode} • ${dateSession}`
  } else if (eventCode) {
    displayCompact = eventCode
  } else if (dateSession) {
    displayCompact = dateSession
  } else if (normRel) {
    const lastSeg = segments[segments.length - 1]
    displayCompact = lastSeg ? lastSeg.substring(0, 18) : 'Raw Footage'
  }

  return {
    isFinalMaster: false,
    displayCompact,
    eventCode: eventCode || undefined,
    dateSession: dateSession || undefined,
    cameraman: cameraman || undefined
  }
}
