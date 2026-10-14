export interface ParsedFolderInfo {
  hijriYear?: number
  hijriMonth?: number // 1-indexed (1 to 12)
  hijriDay?: number
  city?: string
}

export const COMMON_CITIES = [
  'Mumbai', 'Indore', 'Surat', 'Karachi', 'Pune', 'Nagpur',
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

const KNOWN_NON_CITY_WORDS = new Set([
  'ID', 'N', 'MZ', 'Z', 'M', 'Q', 'WAAZ', 'AQ', 'BQ', 'BM', 'BZ', 'OD',
  'OTHER', 'NAMAZ', 'BETHAK', 'ZIYARAT', 'QMZ', 'TEST', 'RUN', 'AIN',
  'VIDEO', 'VIDEOS', 'OUTPUT', 'INPUT', 'BATCH', 'FINAL', 'RENDER',
  'SERMON', 'MAJLIS', 'MADEH', 'MARSIYA', 'ALQURAN', 'TILAWAT', 'DVD'
])

/**
 * Extracts Hijri Year, Month, Day from a folder segment
 * Matches e.g. "1447-03 RAIPUR", "1448-02-23 _01M", "1447-12", "1447_03_15", etc.
 */
function parseSegmentDate(segment: string): { year?: number; month?: number; day?: number } {
  if (!segment) return {}
  const match = segment.match(/(\d{4})[\s-_.](\d{1,2})(?:[\s-_.](\d{1,2}))?/)
  if (!match) return {}
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  const day = match[3] ? parseInt(match[3]) : undefined
  if (year >= 1400 && year <= 1500 && month >= 1 && month <= 12) {
    return { year, month, day }
  }
  return {}
}

/**
 * Robustly extracts City from a folder segment e.g.
 *   "1447-03 RAIPUR"            → "Raipur"
 *   "1447-03-23 RAIPUR"         → "Raipur"
 *   "D:\Test\Test AIN Run (2)\1447-03 RAIPUR" → "Raipur"
 *   "04-Mumbai-QMZ"             → "Mumbai"
 *   "02-Raipur-Bethak"          → "Raipur"
 */
function parseSegmentCity(segment: string): string | undefined {
  if (!segment) return undefined

  // 1. Check COMMON_CITIES keyword anywhere in segment
  const segLower = segment.toLowerCase()
  for (const city of COMMON_CITIES) {
    const regex = new RegExp(`(?:^|[\\s-_.,\\/\\\\])${city.toLowerCase()}(?:$|[\\s-_.,\\/\\\\])`, 'i')
    if (regex.test(segLower)) {
      return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase()
    }
  }

  // 2. Strip date patterns like 1447-03-23 or 1447-03
  let cleaned = segment.replace(/\d{4}[\s-_.]\d{1,2}(?:[\s-_.]\d{1,2})?/, ' ')
  // Strip leading numbers e.g. "04-" or "01_"
  cleaned = cleaned.replace(/^(?:\d+[\s-_.]+)+/, ' ')
  // Strip trailing numbers/codes e.g. "_01M", "01M"
  cleaned = cleaned.replace(/[\s-_.]+\d+[A-Za-z]*$/, ' ')

  // 3. Match explicit format: 04-Mumbai-QMZ or 02-Raipur-Bethak
  const matchCity = cleaned.match(/(?:^|[\s-_]+)([A-Za-z]{3,})(?:[\s-_]+(?:[A-Za-z0-9]+))?$/)
  if (matchCity) {
    const candidate = matchCity[1].trim()
    if (!KNOWN_NON_CITY_WORDS.has(candidate.toUpperCase())) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase()
    }
  }

  // 4. Split remaining string into alphabetic words and pick the first non-reserved word
  const words = cleaned.split(/[\s-_.,()\[\]{}]+/).filter(Boolean)
  for (const w of words) {
    if (/^[A-Za-z]{3,}$/.test(w) && !KNOWN_NON_CITY_WORDS.has(w.toUpperCase())) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    }
  }

  return undefined
}

/**
 * Extracts Hijri Year, Month, Day, and City from a folder name OR full file path.
 * Scans all path segments (innermost to outermost) to combine date and city metadata.
 */
export function parseFolderName(folderNameOrPath: string): ParsedFolderInfo {
  if (!folderNameOrPath) return {}

  const segments = folderNameOrPath.split(/[/\\]/).filter(Boolean)
  let hijriYear: number | undefined = undefined
  let hijriMonth: number | undefined = undefined
  let hijriDay: number | undefined = undefined
  let city: string | undefined = undefined

  // Scan segments from innermost to outermost so closest folder metadata takes priority
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    if (!hijriYear) {
      const dt = parseSegmentDate(seg)
      if (dt.year) {
        hijriYear = dt.year
        hijriMonth = dt.month
        hijriDay = dt.day
      }
    }
    if (!city) {
      const c = parseSegmentCity(seg)
      if (c) {
        city = c
      }
    }
  }

  return { hijriYear, hijriMonth, hijriDay, city }
}

/**
 * Heuristic fallback to detect a city name if the folder isn't standardized.
 * First tries parseFolderName, then keyword matching against COMMON_CITIES,
 * then word extraction from stem and folder.
 */
export function detectCity(stem: string, folder?: string): string {
  // Try parsing the folder path first
  const parsed = parseFolderName(folder || '')
  if (parsed.city) return parsed.city

  // Search stem + folder
  const fullText = `${stem} ${folder || ''}`
  const c = parseSegmentCity(fullText)
  if (c) return c

  // Last-resort fallback: look for a valid alphabetic word in stem
  const parts = stem.split(/[\s-_.,()]+/).filter(Boolean)
  for (const part of parts) {
    if (/^[A-Za-z]{3,}$/.test(part) && !KNOWN_NON_CITY_WORDS.has(part.toUpperCase())) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    }
  }

  return 'Unassigned'
}
