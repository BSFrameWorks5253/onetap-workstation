/**
 * ====================================================================
 * FFMPEG RUNNER ENGINE (src/main/core/ffmpegRunner.ts)
 * ====================================================================
 * High-performance FFmpeg process execution service:
 * 1. Spawns child FFmpeg processes with hardware acceleration (NVENC, QSV, AMF) or libx264 fallback.
 * 2. Generates complex multi-stream filtergraphs for:
 *    - Image intro overlay + video stream + image outro overlay concat.
 *    - Watermark overlay filter.
 *    - Smart audio mixing, silence filling for WAAZ/ID, and dedicated Nikah audio alignment.
 * 3. Real-time stdout/stderr progress parsing for UI progress bars.
 * ====================================================================
 */

import { spawn, spawnSync, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { getVideoEncoder, getFfmpegExePath } from './gpuDetector'

export interface FFmpegJobParams {
  jobId: string
  videoPath: string
  outputPath: string
  startImg: string       // intro image
  endImg: string         // outro image
  watermark: string
  audioPrimary?: string  // single audio track (used for bg music or fill for WAAZ/ID)
  useNikahLogic: boolean
  duration: number       // seconds for intro/outro
  totalLength: number    // pre-computed total
  nonSilentSegs?: Array<[number, number]>  // used only for WAAZ/ID fill logic
  fps: string
  width: number
  height: number
  vidDuration: number
  muteOriginal: boolean
  addWatermark: boolean
  /** True when video prefix is WAAZ or ID — keeps OG audio and fills gaps with audioPrimary */
  isWaazId?: boolean
  /** Whether the video file actually has an audio stream */
  hasAudio?: boolean
  /** When true, intro thumbnail is not attached */
  skipFront?: boolean
  /** When true, outro thumbnail is not attached */
  skipBack?: boolean
  /** Optional custom transition video or image (e.g. transition.mp4, black.mp4, transition.png) */
  transitionFile?: string
  /** Duration in seconds for the post-thumbnail transition buffer (defaults to 1.0s) */
  transitionDuration?: number
}

export interface FFmpegEvent {
  type: 'progress' | 'log' | 'done'
  jobId: string
  percent?: number
  status?: string
  fps?: string
  speed?: string
  message?: string
  level?: string
  success?: boolean
}

type EventCallback = (event: FFmpegEvent) => void

const _activeJobs = new Map<string, ChildProcess>()

function timeToSeconds(t: string): number {
  const [h, m, s] = t.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

/**
 * Extracts year from a video filename.
 * Primary rule: checks starting 4 digits (e.g., "1448-03-12 _02E-12-10MZ-30310666" -> "1448")
 * Fallback: checks any 4-digit Hijri (14xx) or Gregorian (20xx) year in the name.
 */
export function extractYearFromFileName(fileName: string): string | null {
  const base = path.basename(fileName)
  const matchStart = base.match(/^(\d{4})/)
  if (matchStart) return matchStart[1]
  const matchAny = base.match(/(?:^|[^\d])(14\d{2}|20\d{2})(?:[^\d]|$)/)
  if (matchAny) return matchAny[1]
  return null
}

export function runFFmpegJob(params: FFmpegJobParams, onEvent: EventCallback): void {
  const {
    jobId, videoPath, outputPath, startImg, endImg, watermark,
    audioPrimary, useNikahLogic, duration, totalLength,
    nonSilentSegs, fps, width, height, vidDuration, muteOriginal,
    addWatermark, isWaazId, hasAudio, skipFront = false, skipBack = false
  } = params

  const introLen = skipFront ? 0 : duration
  const outroLen = skipBack ? 0 : duration
  const hasCustomTrans = !!(params.transitionFile && fs.existsSync(params.transitionFile))
  const transLen = (!skipFront && startImg && hasCustomTrans) ? (params.transitionDuration ?? 1.0) : 0
  const leadDuration = introLen + transLen
  const fadeStart = Math.max(totalLength - 2.0, 0)
  const enc = getVideoEncoder()

  // Dynamic input stream setup
  const dynamicInputs: string[] = []
  let nextInputIdx = 0

  let startImgIdx = -1
  if (!skipFront && startImg) {
    startImgIdx = nextInputIdx++
    dynamicInputs.push('-loop', '1', '-framerate', fps, '-t', String(introLen), '-i', startImg)
  }

  const vidIdx = nextInputIdx++
  dynamicInputs.push('-hwaccel', 'auto', '-i', videoPath)

  let endImgIdx = -1
  if (!skipBack && endImg) {
    endImgIdx = nextInputIdx++
    dynamicInputs.push('-loop', '1', '-framerate', fps, '-t', String(outroLen), '-i', endImg)
  }

  let watermarkIdx = -1
  if (addWatermark && watermark) {
    watermarkIdx = nextInputIdx++
    dynamicInputs.push('-loop', '1', '-i', watermark)
  }

  const isVideoHasAudio = hasAudio ?? true
  const videoAudioSrc = isVideoHasAudio
    ? `[${vidIdx}:a]aresample=48000`
    : `anullsrc=channel_layout=stereo:sample_rate=48000:d=${vidDuration.toFixed(3)}`

  // ── Audio filter ──────────────────────────────────────────
  let audioInputs: string[] = []
  let audioFilter = ''

  // Input index for primary audio if attached
  const audioIdx = String(nextInputIdx)

  // ────────────────────────────────────────────────────────────
  // BRANCH 1 — WAAZ / ID INSTRUMENTAL FILL
  // ────────────────────────────────────────────────────────────
  const leadMs = Math.round(leadDuration * 1000)

  if ((isWaazId || !muteOriginal) && !useNikahLogic) {
    const hasFillAudio = !!audioPrimary && fs.existsSync(audioPrimary)

    if (hasFillAudio) {
      audioInputs = ['-stream_loop', '-1', '-i', audioPrimary!]

      const clips: Array<{ type: 'music' | 'silence'; duration: number; musicStart?: number; musicEnd?: number }> = []

      // 1. Intro + transition buffer — music plays across intro and transition
      if (!skipFront && leadDuration > 0) {
        clips.push({ type: 'music', duration: leadDuration, musicStart: 0, musicEnd: leadDuration })
      }

      let currentMusicTime = leadDuration

      // 2. Walk through video timeline
      let lastPos = 0
      if (nonSilentSegs && nonSilentSegs.length > 0) {
        for (const [start, end] of nonSilentSegs) {
          if (start > lastPos + 0.01) {
            const silDur = start - lastPos
            clips.push({ type: 'music', duration: silDur, musicStart: currentMusicTime, musicEnd: currentMusicTime + silDur })
            currentMusicTime += silDur
          }
          if (end > start + 0.01) {
            clips.push({ type: 'silence', duration: end - start })
          }
          lastPos = end
        }
        if (lastPos < vidDuration - 0.01) {
          const silDur = vidDuration - lastPos
          clips.push({ type: 'music', duration: silDur, musicStart: currentMusicTime, musicEnd: currentMusicTime + silDur })
          currentMusicTime += silDur
        }
      } else {
        if (vidDuration > 0.01) {
          clips.push({ type: 'music', duration: vidDuration, musicStart: currentMusicTime, musicEnd: currentMusicTime + vidDuration })
          currentMusicTime += vidDuration
        }
      }

      // 3. Outro — music only if outro is attached
      if (!skipBack && outroLen > 0) {
        clips.push({ type: 'music', duration: outroLen, musicStart: currentMusicTime, musicEnd: currentMusicTime + outroLen })
      }

      let f = `[${audioIdx}:a]aresample=48000,atrim=0:${(totalLength * 2).toFixed(3)},asetpts=PTS-STARTPTS[bg_full];`

      const musicClips = clips.filter(c => c.type === 'music')
      const numMusicClips = musicClips.length

      if (numMusicClips > 1) {
        f += `[bg_full]asplit=${numMusicClips}`
        for (let i = 0; i < numMusicClips; i++) f += `[bg_split_${i}]`
        f += ';'
      }

      let concatInputs = ''
      let musicIdx = 0
      let silenceIdx = 0
      const filterParts: string[] = []

      for (const clip of clips) {
        if (clip.type === 'music') {
          const inputPad = numMusicClips > 1 ? `[bg_split_${musicIdx}]` : '[bg_full]'
          const outputPad = `[music_clip_${musicIdx}]`
          const fadeDur = Math.min(0.2, clip.duration * 0.4)
          const fadeOutSt = Math.max(clip.duration - fadeDur, 0)
          filterParts.push(
            `${inputPad}atrim=${clip.musicStart!.toFixed(3)}:${clip.musicEnd!.toFixed(3)},` +
            `asetpts=PTS-STARTPTS,` +
            `afade=t=in:st=0:d=${fadeDur.toFixed(3)},` +
            `afade=t=out:st=${fadeOutSt.toFixed(3)}:d=${fadeDur.toFixed(3)}${outputPad}`
          )
          concatInputs += outputPad
          musicIdx++
        } else {
          const outputPad = `[silence_clip_${silenceIdx}]`
          filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=48000:d=${clip.duration.toFixed(3)}${outputPad}`)
          concatInputs += outputPad
          silenceIdx++
        }
      }

      if (clips.length > 0) {
        f += filterParts.join(';') + ';'
        f += `${concatInputs}concat=n=${clips.length}:v=0:a=1[bg_final_mix];`
      } else {
        f += `anullsrc=channel_layout=stereo:sample_rate=48000:d=${totalLength.toFixed(3)}[bg_final_mix];`
      }

      // Delay OG audio to start after the intro and transition
      const delayPart = leadMs > 0 ? `,adelay=${leadMs}|${leadMs}` : ''
      f +=
        `${videoAudioSrc},atrim=0:${vidDuration.toFixed(3)},` +
        `asetpts=PTS-STARTPTS${delayPart}[og_audio];`

      f +=
        `[bg_final_mix]afade=t=in:st=0:d=2[bg_faded];` +
        `[bg_faded][og_audio]amix=inputs=2:normalize=0:duration=longest,` +
        `atrim=0:${totalLength.toFixed(3)},asetpts=PTS-STARTPTS,` +
        `afade=t=out:st=${fadeStart}:d=2[final_audio];`

      audioFilter = f
    } else {
      audioInputs = []
      const delayPart = leadMs > 0 ? `,adelay=${leadMs}|${leadMs}` : ''
      audioFilter =
        `${videoAudioSrc},atrim=0:${vidDuration.toFixed(3)},` +
        `asetpts=PTS-STARTPTS${delayPart},` +
        `afade=t=out:st=${fadeStart}:d=2[final_audio];`
    }

  // ────────────────────────────────────────────────────────────
  // BRANCH 2 — NIKAH (N prefix)
  // ────────────────────────────────────────────────────────────
  } else if (useNikahLogic) {
    audioInputs = ['-stream_loop', '-1', '-i', audioPrimary!]
    audioFilter =
      `[${audioIdx}:a]aresample=48000,atrim=0:${totalLength},asetpts=PTS-STARTPTS,` +
      `afade=t=in:st=0:d=2,afade=t=out:st=${fadeStart}:d=2[final_audio];`

  // ────────────────────────────────────────────────────────────
  // BRANCH 3 — NORMAL (all other prefixes)
  // ────────────────────────────────────────────────────────────
  } else {
    const hasPrimaryAudio = !!audioPrimary && fs.existsSync(audioPrimary)
    if (hasPrimaryAudio) {
      audioInputs = ['-stream_loop', '-1', '-i', audioPrimary!]
      if (!muteOriginal) {
        const delayPart = leadMs > 0 ? `adelay=${leadMs}|${leadMs}[vid_delayed];` : `copy[vid_delayed];`
        audioFilter =
          `[${audioIdx}:a]aresample=48000,atrim=0:${totalLength},asetpts=PTS-STARTPTS,` +
          `afade=t=in:st=0:d=2,afade=t=out:st=${fadeStart}:d=2[bg_full];` +
          `[bg_full]volume=0.12[bg_quiet];` +
          `${videoAudioSrc},atrim=0:${vidDuration},asetpts=PTS-STARTPTS,` +
          delayPart +
          `[bg_quiet][vid_delayed]amix=inputs=2:normalize=0:duration=longest[final_audio];`
      } else {
        audioFilter =
          `[${audioIdx}:a]aresample=48000,atrim=0:${totalLength},asetpts=PTS-STARTPTS,` +
          `afade=t=in:st=0:d=2,afade=t=out:st=${fadeStart}:d=2[final_audio];`
      }
    } else {
      audioInputs = []
      if (!muteOriginal) {
        const delayPart = leadMs > 0 ? `,adelay=${leadMs}|${leadMs}` : ''
        audioFilter =
          `${videoAudioSrc},atrim=0:${vidDuration},asetpts=PTS-STARTPTS` +
          delayPart +
          `,afade=t=out:st=${fadeStart}:d=2[final_audio];`
      } else {
        audioFilter = `anullsrc=channel_layout=stereo:sample_rate=48000:d=${totalLength.toFixed(3)}[final_audio];`
      }
    }
  }

  // ── Video filter ─────────────────────────────────────────
  let videoFilter = ''
  const concatSegments: string[] = []

  if (!skipFront && startImgIdx >= 0) {
    // Starting thumbnail: NO dissolve at start (instant clean display), dissolve ONLY at the end into video
    const titleFadeDur = Math.min(0.5, introLen * 0.5)
    const titleFadeSt = Math.max(introLen - titleFadeDur, 0)
    videoFilter +=
      `[${startImgIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=fast_bilinear,` +
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p,` +
      `fade=t=out:st=${titleFadeSt.toFixed(3)}:d=${titleFadeDur.toFixed(3)}[img_start];`
    concatSegments.push('[img_start]')

    // Custom transition clip (only if an explicit transition file exists on disk)
    if (transLen > 0 && params.transitionFile && fs.existsSync(params.transitionFile)) {
      const transIdx = nextInputIdx++
      const transExt = path.extname(params.transitionFile).toLowerCase()
      const isTransImg = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'].includes(transExt)
      if (isTransImg) {
        dynamicInputs.push('-loop', '1', '-framerate', fps, '-t', String(transLen), '-i', params.transitionFile)
      } else {
        dynamicInputs.push('-hwaccel', 'auto', '-t', String(transLen), '-i', params.transitionFile)
      }
      videoFilter +=
        `[${transIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=fast_bilinear,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p,` +
        `fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(transLen - 0.25, 0).toFixed(3)}:d=0.25[trans_seg];`
      concatSegments.push('[trans_seg]')
    }
  }

  // Preserve 100% of live video content from frame 0 to end (no fade-to-black cutting into speech or action)
  videoFilter += `[${vidIdx}:v]setsar=1,format=yuv420p,null[vid_faded];`
  concatSegments.push('[vid_faded]')

  if (!skipBack && endImgIdx >= 0) {
    // End thumbnail: dissolve AT THE START from video into thumbnail, then hold clean with 0 extra black delay
    const endFadeDur = Math.min(0.5, outroLen * 0.5)
    videoFilter +=
      `[${endImgIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=fast_bilinear,` +
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p,` +
      `fade=t=in:st=0:d=${endFadeDur.toFixed(3)}[img_end];`
    concatSegments.push('[img_end]')
  }

  if (concatSegments.length > 1) {
    videoFilter += `${concatSegments.join('')}concat=n=${concatSegments.length}:v=1:a=0[base_v];`
  } else {
    videoFilter += `[vid_faded]copy[base_v];`
  }

  if (addWatermark && watermarkIdx >= 0) {
    videoFilter +=
      `[${watermarkIdx}:v]scale=${width}:${height}:flags=fast_bilinear[wm_scaled];` +
      `[base_v][wm_scaled]overlay=0:0:shortest=1[final_video]`
  } else {
    videoFilter += `[base_v]copy[final_video]`
  }

  const videoFileName = path.basename(videoPath)
  const videoTitle = path.basename(videoPath, path.extname(videoPath))
  const detectedYear = extractYearFromFileName(videoFileName)

  const metadataArgs: string[] = [
    '-metadata', `title=${videoTitle}`,
    '-metadata', 'artist=Aljamea-tus-Saifiyah',
    '-metadata', 'author=Aljamea-tus-Saifiyah',
    '-metadata', 'album_artist=Aljamea-tus-Saifiyah',
    '-metadata', 'composer=Aljamea-tus-Saifiyah',
    '-metadata', 'copyright=Aljamea-tus-Saifiyah',
    '-metadata', 'publisher=AIN',
    '-metadata', 'organization=AIN',
    '-metadata', 'network=AIN',
    '-metadata', 'genre=AIN',
    '-metadata', 'comment=https://ain53.org/',
    '-metadata', 'author_url=https://ain53.org/',
    '-metadata', 'url=https://ain53.org/',
    '-metadata', `description=${videoTitle}`,
    '-metadata', `synopsis=${videoTitle}`,
    '-metadata', 'encoded_by=AIN'
  ]
  if (detectedYear) {
    metadataArgs.push('-metadata', `date=${detectedYear}`, '-metadata', `year=${detectedYear}`)
  }

  const ffmpegExe = getFfmpegExePath()
  const cmd = [
    ffmpegExe, '-y',
    '-threads', '0',
    ...dynamicInputs,
    ...audioInputs,
    '-filter_complex', audioFilter + videoFilter,
    '-map', '[final_video]', '-map', '[final_audio]',
    ...enc.flags,
    '-c:a', 'aac', '-b:a', '192k', '-threads', '0',
    ...metadataArgs,
    outputPath, '-hide_banner', '-stats'
  ]

  onEvent({ type: 'log', jobId, message: `⚙ Encoding → ${path.basename(outputPath)} [${enc.label}]` })

  const proc = spawn(cmd[0], cmd.slice(1), {
    windowsHide: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  _activeJobs.set(jobId, proc)

  const handleOutput = (data: Buffer): void => {
    const text = data.toString('utf8', 0, data.length)
    
    const matchTime  = text.match(/time=(\d+:\d+:\d+\.\d+)/)
    const matchFps   = text.match(/fps=\s*([\d.]+)/)
    const matchSpeed = text.match(/speed=\s*([\d.x]+)/)

    if (matchTime) {
      const cur = timeToSeconds(matchTime[1])
      const percent = Math.min((cur / Math.max(totalLength, 1)) * 100, 100)
      
      onEvent({ 
        type: 'progress', 
        jobId, 
        percent, 
        status: `${path.basename(videoPath)}: ${Math.round(percent)}%`,
        fps: matchFps ? matchFps[1] : undefined,
        speed: matchSpeed ? matchSpeed[1] : undefined
      })
    }
  }

  proc.stdout?.on('data', handleOutput)
  proc.stderr?.on('data', handleOutput)

  proc.on('close', (code) => {
    _activeJobs.delete(jobId)
    const exists = fs.existsSync(outputPath)
    const size = exists ? fs.statSync(outputPath).size : 0
    const success = code === 0 && exists && size > 1024
    onEvent({
      type: 'done', jobId,
      success,
      message: success
        ? `✔ Done: ${path.basename(outputPath)}`
        : `✖ FAILED (exit ${code}): ${path.basename(outputPath)}`
    })
  })
}

export function cancelJob(jobId: string): void {
  const proc = _activeJobs.get(jobId)
  if (proc) {
    if (process.platform === 'win32' && proc.pid) {
      try {
        spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'])
      } catch {}
    }
    try {
      proc.kill('SIGKILL')
    } catch {}
    _activeJobs.delete(jobId)
  }
}

export function pauseJob(jobId: string): boolean {
  const proc = _activeJobs.get(jobId)
  if (!proc || !proc.pid) return false
  if (process.platform === 'win32') {
    try {
      const psCmd = `powershell -NoProfile -Command "$code = '[DllImport(\\"ntdll.dll\\")] public static extern uint NtSuspendProcess(IntPtr h);'; $type = Add-Type -MemberDefinition $code -Name 'Nt' -Namespace 'Win32' -PassThru; $h = (Get-Process -Id ${proc.pid}).Handle; [void]$type::NtSuspendProcess($h)"`
      require('child_process').execSync(psCmd, { windowsHide: true })
      return true
    } catch {
      return false
    }
  } else {
    try {
      proc.kill('SIGSTOP')
      return true
    } catch {
      return false
    }
  }
}

export function resumeJob(jobId: string): boolean {
  const proc = _activeJobs.get(jobId)
  if (!proc || !proc.pid) return false
  if (process.platform === 'win32') {
    try {
      const psCmd = `powershell -NoProfile -Command "$code = '[DllImport(\\"ntdll.dll\\")] public static extern uint NtResumeProcess(IntPtr h);'; $type = Add-Type -MemberDefinition $code -Name 'Nt' -Namespace 'Win32' -PassThru; $h = (Get-Process -Id ${proc.pid}).Handle; [void]$type::NtResumeProcess($h)"`
      require('child_process').execSync(psCmd, { windowsHide: true })
      return true
    } catch {
      return false
    }
  } else {
    try {
      proc.kill('SIGCONT')
      return true
    } catch {
      return false
    }
  }
}

