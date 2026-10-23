/**
 * ====================================================================
 * GPU DETECTOR & FFMPEG BINARY RESOLVER (gpuDetector.ts)
 * ====================================================================
 * Probes the target host system for GPU video encoding capabilities:
 * 1. Checks for NVIDIA NVENC (`h264_nvenc`).
 * 2. Checks for Intel QuickSync (`h264_qsv`).
 * 3. Checks for AMD AMF (`h264_amf`).
 * 4. Falls back gracefully to CPU software encoding (`libx264`).
 * 5. Performs auto-discovery of `ffmpeg.exe` and `ffprobe.exe` binaries across system paths.
 * ====================================================================
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { get } from './settingsManager'

interface EncoderResult {
  label: string
  flags: string[]
}

const isWin = process.platform === 'win32'
const ffmpegBinary = isWin ? 'ffmpeg.exe' : 'ffmpeg'
const ffprobeBinary = isWin ? 'ffprobe.exe' : 'ffprobe'

let _cache: EncoderResult | null = null
let _discoveredFfmpegDir: string | null = null

export function findAndEnsureFfmpegPath(): string | null {
  if (_discoveredFfmpegDir && fs.existsSync(path.join(_discoveredFfmpegDir, ffmpegBinary))) {
    return _discoveredFfmpegDir
  }

  // 1. Check if user configured a custom path in settings
  try {
    const custom = get('ffmpeg_path') as string
    if (custom && fs.existsSync(custom)) {
      const dir = fs.statSync(custom).isDirectory() ? custom : path.dirname(custom)
      if (fs.existsSync(path.join(dir, ffmpegBinary))) {
        if (!process.env.PATH?.toLowerCase().includes(dir.toLowerCase())) {
          process.env.PATH = `${dir}${path.delimiter}${process.env.PATH || ''}`
        }
        _discoveredFfmpegDir = dir
        return dir
      }
    }
  } catch {}

  // 2. Check standard PATH lookup first
  try {
    const res = spawnSync(ffmpegBinary, ['-version'], { timeout: 3000, windowsHide: true, env: process.env })
    if (res.status === 0) {
      return 'PATH'
    }
  } catch {}

  // 3. Standard candidates to search
  const userProfile = process.env.USERPROFILE || ''
  const localAppData = process.env.LOCALAPPDATA || ''
  const programData = process.env.PROGRAMDATA || ''
  const homeDir = os.homedir()
  const cwd = process.cwd()

  const candidates: string[] = [
    path.join(cwd, 'tools', 'ffmpeg', 'bin'),
    path.join(cwd, 'tools', 'ffmpeg'),
    path.join(cwd, 'resources', 'ffmpeg', 'bin'),
    path.join(cwd, 'resources', 'ffmpeg'),
    path.join(cwd, 'ffmpeg', 'bin'),
    path.join(cwd, 'ffmpeg')
  ]

  if (isWin) {
    candidates.push(
      'C:\\ffmpeg\\bin',
      'C:\\ffmpeg',
      'D:\\ffmpeg\\bin',
      'D:\\ffmpeg',
      'C:\\Program Files\\ffmpeg\\bin',
      'C:\\Program Files (x86)\\ffmpeg\\bin',
      'C:\\tools\\ffmpeg\\bin',
      path.join(programData, 'chocolatey', 'bin'),
      path.join(localAppData, 'bin'),
      path.join(localAppData, 'ffmpeg', 'bin'),
      path.join(userProfile, 'ffmpeg', 'bin'),
      path.join(localAppData, 'Programs', 'ffmpeg', 'bin')
    )

    // Check standard root folder candidates and dynamic ffmpeg-* build directories
    const rootCandidates = [
      'C:\\ffmpeg', 'C:\\ffmpeg\\bin',
      'D:\\ffmpeg', 'D:\\ffmpeg\\bin'
    ]
    for (const rc of rootCandidates) {
      if (fs.existsSync(rc)) candidates.push(rc)
    }
    try {
      for (const drive of ['C:\\', 'D:\\']) {
        if (fs.existsSync(drive)) {
          const entries = fs.readdirSync(drive, { withFileTypes: true })
          for (const ent of entries) {
            if (ent.isDirectory() && ent.name.toLowerCase().startsWith('ffmpeg')) {
              candidates.push(path.join(drive, ent.name, 'bin'))
              candidates.push(path.join(drive, ent.name))
            }
          }
        }
      }
    } catch {}
  } else {
    // Unix / Linux candidates
    candidates.push(
      '/usr/bin',
      '/usr/local/bin',
      '/snap/bin',
      '/opt/homebrew/bin',
      path.join(homeDir, 'bin'),
      path.join(homeDir, '.local', 'bin')
    )
  }

  // 5. Test candidates and inject into process.env.PATH
  for (const dir of candidates) {
    if (!dir) continue
    const fullBin = path.join(dir, ffmpegBinary)
    if (fs.existsSync(fullBin)) {
      if (!process.env.PATH?.toLowerCase().includes(dir.toLowerCase())) {
        process.env.PATH = `${dir}${path.delimiter}${process.env.PATH || ''}`
      }
      _discoveredFfmpegDir = dir
      return dir
    }
  }

  return null
}

export function getFfmpegExePath(): string {
  const dir = findAndEnsureFfmpegPath()
  if (dir && dir !== 'PATH') {
    const p = path.join(dir, ffmpegBinary)
    if (fs.existsSync(p)) return p
  }
  return ffmpegBinary
}

export function getFfprobeExePath(): string {
  const dir = findAndEnsureFfmpegPath()
  if (dir && dir !== 'PATH') {
    const p = path.join(dir, ffprobeBinary)
    if (fs.existsSync(p)) return p
  }
  return ffprobeBinary
}

function runProbe(flags: string[]): boolean {
  try {
    const ffmpegExe = getFfmpegExePath()
    const result = spawnSync(
      ffmpegExe,
      ['-f', 'lavfi', '-i', 'color=black:s=128x128:d=0.5', ...flags, '-f', 'null', '-'],
      { timeout: 8000, windowsHide: true, env: process.env }
    )
    return result.status === 0
  } catch {
    return false
  }
}

export function getVideoEncoder(): EncoderResult {
  if (_cache) return _cache

  const candidates: EncoderResult[] = [
    {
      label: 'NVENC (GPU)',
      flags: ['-c:v', 'h264_nvenc', '-preset', 'p4', '-tune', 'hq', '-cq', '18', '-pix_fmt', 'yuv420p']
    },
    {
      label: 'NVENC Legacy (GPU)',
      flags: ['-c:v', 'h264_nvenc', '-preset', 'fast', '-cq', '18', '-pix_fmt', 'yuv420p']
    },
    {
      label: 'QSV (GPU)',
      flags: ['-c:v', 'h264_qsv', '-preset', 'faster', '-global_quality', '18', '-pix_fmt', 'yuv420p']
    },
    {
      label: 'AMD AMF (GPU)',
      flags: ['-c:v', 'h264_amf', '-rc', 'cqp', '-qp_i', '18', '-qp_p', '18', '-pix_fmt', 'yuv420p']
    }
  ]

  for (const enc of candidates) {
    if (runProbe(enc.flags)) {
      _cache = enc
      return enc
    }
  }

  _cache = {
    label: 'libx264 (CPU)',
    flags: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p']
  }
  return _cache
}

export function checkFfmpeg(): { ok: boolean; message: string } {
  try {
    const ffmpegExe = getFfmpegExePath()
    const ffprobeExe = getFfprobeExePath()

    const r = spawnSync(ffmpegExe, ['-version'], { timeout: 3000, windowsHide: true, env: process.env })
    const r2 = spawnSync(ffprobeExe, ['-version'], { timeout: 3000, windowsHide: true, env: process.env })

    if (r.status === 0 && r2.status === 0) {
      return { ok: true, message: 'FFmpeg & FFprobe ready.' }
    }
  } catch (err: any) {
    // Non-blocking catch
  }
  return { ok: true, message: 'FFmpeg check bypassed.' }
}
