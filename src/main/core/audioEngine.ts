/**
 * ============================================================
 * AUDIO ENGINE  (src/main/core/audioEngine.ts)
 * ============================================================
 * Core service responsible for:
 * 1. Building main and instrumental background audio pools from the Titles directory.
 * 2. Assigning audio tracks to videos based on selected modes (single, alternate, prefix-mapped).
 * 3. Resolving dedicated Nikah (N prefix) and Special (WAAZ / ID prefix) audio files.
 * 4. Resolving special instrumental fill tracks for short silence gaps.
 * ============================================================
 */

import fs from 'fs'
import path from 'path'
import { get } from './settingsManager'

export const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.aac']
export const STANDARD_PREFIXES = ['Q', 'Z', 'MZ', 'M', 'Waaz', 'ID', 'AQ', 'BM', 'BQ', 'BZ', 'N']

/**
 * Scans the main Titles directory for background audio files starting with "Audio" (e.g. Audio 1.mp3, Audio 2.wav).
 * Returns sorted list of absolute file paths forming the standard audio pool.
 */
export function buildAudioPool(titlesPath: string): string[] {
  const pool: string[] = []
  if (!titlesPath || !fs.existsSync(titlesPath)) return pool

  try {
    const files = fs.readdirSync(titlesPath)
    const matched = files.filter(f => {
      const ext = path.extname(f).toLowerCase()
      if (!AUDIO_EXTS.includes(ext)) return false
      const base = path.basename(f, ext).toLowerCase().trim()
      return base.startsWith('audio')
    })

    matched.sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })

    return matched.map(f => path.join(titlesPath, f))
  } catch (e) {
    console.error('[AudioEngine] buildAudioPool failed:', e)
    return []
  }
}

export function buildInstrumentalAudioPool(titlesPath: string): string[] {
  const pool: string[] = []
  if (!titlesPath || !fs.existsSync(titlesPath)) return pool

  const specialFolder = path.join(titlesPath, 'Special')
  if (!fs.existsSync(specialFolder)) return pool

  try {
    const files = fs.readdirSync(specialFolder)
    const matched = files.filter(f => {
      const ext = path.extname(f).toLowerCase()
      if (!AUDIO_EXTS.includes(ext)) return false
      const base = path.basename(f, ext).toLowerCase().trim()
      return base.startsWith('audio')
    })

    matched.sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })

    return matched.map(f => path.join(specialFolder, f))
  } catch (e) {
    console.error('[AudioEngine] buildInstrumentalAudioPool failed:', e)
    return []
  }
}


// ── Name → Path resolution ───────────────────────────────────
export function resolveAudioName(
  audioName: string,
  pool: string[],
  titlesPath: string
): string | null {
  if (!audioName) return pool[0] ?? null
  const lower = audioName.toLowerCase().trim()

  for (const p of pool) {
    if (path.basename(p, path.extname(p)).toLowerCase() === lower) return p
  }
  for (const ext of AUDIO_EXTS) {
    const f = path.join(titlesPath, `${audioName}${ext}`)
    if (fs.existsSync(f)) return f
  }
  return null
}

// ── Per-video audio assignment ───────────────────────────────
export function getAudioForVideo(
  prefix: string,
  index: number,
  pool: string[],
  titlesPath: string,
  logFn?: (msg: string) => void
): string | null {
  if (!pool.length) { logFn?.('⚠ Audio pool empty'); return null }

  const mode = get('audio_assignment_mode', 'single') as string

  if (mode === 'alternate') return pool[index % pool.length]

  if (mode === 'prefix') {
    const assignments = (get('audio_prefix_assignments') ?? {}) as Record<string, string>
    const audioName = assignments[prefix.toUpperCase()]
    if (audioName) {
      const resolved = resolveAudioName(audioName, pool, titlesPath)
      if (resolved) return resolved
      logFn?.(`⚠ Prefix '${prefix}' → '${audioName}' not found — using Audio 1`)
    }
    return pool[0]
  }

  // single mode
  const idx = Math.max(0, Math.min((get('audio_single_index', 0) as number), pool.length - 1))
  return pool[idx]
}

// ── Nikah audio ──────────────────────────────────────────────
export function getNikahAudio(titlesPath: string): string | null {
  const ov = get('nikah_audio_override') as string | null
  if (ov && fs.existsSync(ov)) return ov

  // Check all known filenames for the N-prefix dedicated audio
  const candidates = ['N_A', 'Nikah Audio', 'NikahAudio', 'nikah_audio']
  for (const name of candidates) {
    for (const ext of AUDIO_EXTS) {
      const f = path.join(titlesPath, `${name}${ext}`)
      if (fs.existsSync(f)) return f
    }
  }
  return null
}

// ── Status helpers ───────────────────────────────────────────
export function describeMode(): string {
  const mode = get('audio_assignment_mode', 'single') as string
  if (mode === 'alternate') return 'Alternate (cycles through pool)'
  if (mode === 'prefix') {
    const pm = (get('audio_prefix_assignments') ?? {}) as object
    const n = Object.keys(pm).length
    return `By Prefix (${n} prefix${n !== 1 ? 'es' : ''})`
  }
  const idx = (get('audio_single_index', 0) as number) + 1
  return `Single → Audio ${idx}`
}

export function poolInfo(titlesPath: string): string {
  const pool = buildAudioPool(titlesPath)
  if (!pool.length) return 'Pool: empty — add Audio 1.mp3 to assets folder'
  return 'Pool: ' + pool.map(p => path.basename(p, path.extname(p))).join(' · ')
}

// ── Library management ───────────────────────────────────────
export function addAudioToLibrary(
  srcPath: string,
  titlesFolder: string
): { dst: string; name: string } | null {
  if (!fs.existsSync(srcPath)) return null
  const ext = path.extname(srcPath).toLowerCase()
  if (!AUDIO_EXTS.includes(ext)) return null

  let i = 1
  while (AUDIO_EXTS.some(e => fs.existsSync(path.join(titlesFolder, `Audio ${i}${e}`)))) i++

  const dst = path.join(titlesFolder, `Audio ${i}${ext}`)
  try {
    fs.mkdirSync(titlesFolder, { recursive: true })
    fs.copyFileSync(srcPath, dst)
    return { dst, name: `Audio ${i}` }
  } catch (e) {
    console.error(`[AudioEngine] Copy failed: ${e}`)
    return null
  }
}

// ── Special Instrumental Library management ──────────────────
export function addInstrumentalAudioToLibrary(
  srcPath: string,
  titlesFolder: string
): { dst: string; name: string } | null {
  if (!fs.existsSync(srcPath)) return null
  const ext = path.extname(srcPath).toLowerCase()
  if (!AUDIO_EXTS.includes(ext)) return null

  const specialFolder = path.join(titlesFolder, 'Special')
  let i = 1
  while (AUDIO_EXTS.some(e => fs.existsSync(path.join(specialFolder, `Audio ${i}${e}`)))) i++

  const dst = path.join(specialFolder, `Audio ${i}${ext}`)
  try {
    fs.mkdirSync(specialFolder, { recursive: true })
    fs.copyFileSync(srcPath, dst)
    return { dst, name: `Audio ${i}` }
  } catch (e) {
    console.error(`[AudioEngine] Special copy failed: ${e}`)
    return null
  }
}

// ── Special Audio Path resolution ────────────────────────────
export function getSpecialAudioPath(
  originalAudioPath: string | null,
  titlesFolder: string
): string | null {
  if (!originalAudioPath) return null
  const ext = path.extname(originalAudioPath)
  const base = path.basename(originalAudioPath, ext)

  // 1. Check in a "Special" subfolder of titlesFolder with the same filename
  const specialSubfolderPath = path.join(titlesFolder, 'Special', `${base}${ext}`)
  if (fs.existsSync(specialSubfolderPath)) {
    return specialSubfolderPath
  }

  // 2. Check in the main titlesFolder with "_Special" suffix
  const specialSuffixPath = path.join(titlesFolder, `${base}_Special${ext}`)
  if (fs.existsSync(specialSuffixPath)) {
    return specialSuffixPath
  }

  return null
}

// ── Instrumental Audio Path resolution ───────────────────────
/**
 * Returns the path to the shared instrumental fill track used for mute-exception
 * videos that have short silent segments (<10 s).
 *
 * Expected file location:  <titlesFolder>/Special/Instrumental.<ext>
 * Supported extensions  :  .mp3 | .wav | .m4a | .aac  (case-insensitive stem match)
 */
export function getInstrumentalAudioPath(titlesFolder: string): string | null {
  if (!titlesFolder) return null
  const specialFolder = path.join(titlesFolder, 'Special')
  if (!fs.existsSync(specialFolder)) return null

  try {
    const files = fs.readdirSync(specialFolder)
    for (const f of files) {
      const ext = path.extname(f).toLowerCase()
      if (!AUDIO_EXTS.includes(ext)) continue
      const base = path.basename(f, ext).toLowerCase().trim()
      if (base === 'instrumental') {
        return path.join(specialFolder, f)
      }
    }
  } catch (e) {
    console.error('[AudioEngine] getInstrumentalAudioPath failed:', e)
  }
  return null
}


// ── Validation ───────────────────────────────────────────────
export function validatePrefixAssignments(titlesPath: string): Record<string, boolean> {
  const pool = buildAudioPool(titlesPath)
  const assignments = (get('audio_prefix_assignments') ?? {}) as Record<string, string>
  const results: Record<string, boolean> = {}
  for (const [prefix, audioName] of Object.entries(assignments)) {
    results[prefix] = resolveAudioName(audioName, pool, titlesPath) !== null
  }
  return results
}

export function getAllAvailableAudioFiles(titlesPath: string): Array<{ name: string; path: string }> {
  const list: Array<{ name: string; path: string }> = []
  if (!titlesPath || !fs.existsSync(titlesPath)) return list

  try {
    const scanDir = (dir: string, labelPrefix: string = '') => {
      if (!fs.existsSync(dir)) return
      const files = fs.readdirSync(dir)
      for (const f of files) {
        const fullP = path.join(dir, f)
        const stat = fs.statSync(fullP)
        if (stat.isFile()) {
          const ext = path.extname(f).toLowerCase()
          if (AUDIO_EXTS.includes(ext)) {
            const displayName = labelPrefix ? `${labelPrefix}/${path.basename(f, ext)}` : path.basename(f, ext)
            list.push({ name: displayName, path: fullP })
          }
        }
      }
    }

    scanDir(titlesPath, '')
    const specialDir = path.join(titlesPath, 'Special')
    scanDir(specialDir, 'Special')

    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  } catch (e) {
    console.error('[AudioEngine] getAllAvailableAudioFiles failed:', e)
  }

  return list
}

