import { ipcMain } from 'electron'
import { readFile, stat } from 'fs/promises'
import { extname, dirname, basename } from 'path'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'

// RAW image extensions that need conversion via sharp
const RAW_EXTENSIONS = new Set([
  '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2',
  '.dng', '.orf', '.rw2', '.pef', '.ptx', '.raf', '.raw',
  '.3fr', '.mef', '.mos', '.erf', '.rwl', '.srw', '.x3f',
  '.dcr', '.kdc', '.mrw'
])

export function registerViewerIPC(): void {

  // ── Read RAW image and convert to JPEG via sharp ───────────────
  ipcMain.handle('viewer:readRaw', async (_event, filePath: string) => {
    try {
      // Lazy-load sharp so it doesn't bloat startup
      const sharp = (await import('sharp')).default
      const jpegBuffer = await sharp(filePath)
        .rotate()           // auto-rotate based on EXIF orientation
        .jpeg({ quality: 92, mozjpeg: false })
        .toBuffer()

      return {
        ok: true,
        dataUrl: `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`
      }
    } catch (err: any) {
      console.error('[viewer:readRaw] Failed:', err)
      return { ok: false, error: err.message ?? String(err) }
    }
  })

  // ── Read any file as base64 (for docx/xlsx parsing in renderer) ─
  ipcMain.handle('viewer:readFileBase64', async (_event, filePath: string) => {
    try {
      const buf = await readFile(filePath)
      return { ok: true, base64: buf.toString('base64') }
    } catch (err: any) {
      return { ok: false, error: err.message ?? String(err) }
    }
  })

  // ── Read text file (markdown, plain text) ──────────────────────
  ipcMain.handle('viewer:readText', async (_event, filePath: string) => {
    try {
      const text = await readFile(filePath, 'utf-8')
      return { ok: true, text }
    } catch (err: any) {
      return { ok: false, error: err.message ?? String(err) }
    }
  })

  // ── Get file metadata ──────────────────────────────────────────
  ipcMain.handle('viewer:getFileInfo', async (_event, filePath: string) => {
    try {
      const info = await stat(filePath)
      const ext = extname(filePath).toLowerCase()
      const isRaw = RAW_EXTENSIONS.has(ext)

      let dimensions: { width: number; height: number } | null = null

      if (isRaw || ['.jpg','.jpeg','.png','.webp','.bmp','.tiff','.tif','.gif'].includes(ext)) {
        try {
          const sharp = (await import('sharp')).default
          const meta = await sharp(filePath).metadata()
          if (meta.width && meta.height) {
            dimensions = { width: meta.width, height: meta.height }
          }
        } catch { /* non-fatal */ }
      }

      return {
        ok: true,
        size: info.size,
        modified: info.mtimeMs,
        ext,
        isRaw,
        dimensions
      }
    } catch (err: any) {
      return { ok: false, error: err.message ?? String(err) }
    }
  })

  // ── Check if extension is a RAW file ──────────────────────────
  ipcMain.handle('viewer:isRaw', (_event, ext: string) => {
    return RAW_EXTENSIONS.has(ext.toLowerCase())
  })

  // ── Generate a thumbnail JPEG for any supported file ───────────────────
  // Used for in-app file browsers, grid views, etc.
  // size = longest edge in pixels (default 256)
  ipcMain.handle('viewer:getThumbnail', async (_event, filePath: string, size = 256) => {
    try {
      const sharp = (await import('sharp')).default
      const buf = await sharp(filePath)
        .rotate()  // respect EXIF orientation
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: false })
        .toBuffer()
      return { ok: true, dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}` }
    } catch (err: any) {
      return { ok: false, error: err.message ?? String(err) }
    }
  })

  // ── Pre-generate and cache thumbnails for a list of files ─────────────
  // Saves .jpg thumbnails to a hidden cache folder next to the source files.
  // This lets any file manager (including Windows Explorer) pick them up.
  ipcMain.handle('viewer:pregenThumbnails', async (_event, filePaths: string[], size = 256) => {
    const sharp = (await import('sharp')).default
    const results: { path: string; thumbPath: string; ok: boolean }[] = []

    for (const filePath of filePaths) {
      try {
        const dir  = dirname(filePath)
        const name = basename(filePath)
        const cacheDir = `${dir}\.thumbcache_ud`
        if (!existsSync(cacheDir)) await mkdir(cacheDir, { recursive: true })

        const thumbPath = `${cacheDir}\\${name}.thumb.jpg`
        await sharp(filePath)
          .rotate()
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toFile(thumbPath)
        results.push({ path: filePath, thumbPath, ok: true })
      } catch {
        results.push({ path: filePath, thumbPath: '', ok: false })
      }
    }
    return { ok: true, results }
  })

  // ── Check Windows RAW Image Extension availability ─────────────────
  // Returns true if a WIC RAW decoder is registered on this machine
  ipcMain.handle('viewer:checkRawCodec', async () => {
    // Windows RAW Image Extension registers CR2/NEF/ARW WIC codecs.
    // We detect it by checking a known registry path via 'reg query'.
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      // The RAW Image Extension registers under this key when installed
      await execAsync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Shell Extensions\\Approved" /f "Microsoft.RawImageExtension" /d',
        { timeout: 3000 }
      )
      return { available: true }
    } catch {
      // Fallback: check if .cr2 has a thumbnail handler registered
      try {
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)
        await execAsync(
          'reg query "HKCR\\.cr2\\ShellEx\\{e357fccd-a995-4576-b01f-234630154e96}"',
          { timeout: 3000 }
        )
        return { available: true }
      } catch {
        return { available: false }
      }
    }
  })

  // ── Locate ffmpeg executable on this machine ──────────────────────────
  // Checks: PATH → common Windows install paths → VLC bundled ffmpeg
  ipcMain.handle('viewer:findFfmpeg', async () => {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    // 1. Check PATH first
    try {
      const checkCmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg 2>/dev/null'
      const { stdout } = await execAsync(checkCmd, { timeout: 3000 })
      const p = stdout.split('\n')[0].trim()
      if (p) return { found: true, path: p }
    } catch { /* not on PATH */ }

    // 2. Common install locations
    const candidates = process.platform === 'win32' ? [
      'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
      `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-release-essentials.zip`,
      `${process.env.USERPROFILE}\\scoop\\shims\\ffmpeg.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\ffmpeg\\bin\\ffmpeg.exe`,
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
    ] : [
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/snap/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg'
    ]

    for (const candidate of candidates) {
      if (candidate && existsSync(candidate)) {
        return { found: true, path: candidate }
      }
    }

    return { found: false, path: null }
  })

  // ── Extract a video frame thumbnail using ffmpeg ───────────────────────
  // Works for MKV, AVI, MOV, FLV, and any format ffmpeg can decode.
  // ffmpegPath: path to ffmpeg.exe (from viewer:findFfmpeg or user-supplied)
  // seekPercent: where in the video to grab the frame (default 0.1 = 10%)
  ipcMain.handle('viewer:getVideoThumbnail', async (
    _event,
    filePath: string,
    ffmpegPath: string,
    size = 256,
    seekPercent = 0.1
  ) => {
    try {
      const os    = await import('os')
      const path  = await import('path')
      const fs    = await import('fs/promises')
      const ffmpeg = (await import('fluent-ffmpeg')).default

      // Set binary path
      ffmpeg.setFfmpegPath(ffmpegPath)

      // Get duration first via ffprobe
      const duration = await new Promise<number>((resolve) => {
        ffmpeg.ffprobe(filePath, (_err, meta) => {
          resolve(meta?.format?.duration ?? 10)
        })
      })

      const seekSecs = Math.max(0, duration * seekPercent)
      const tmpFile  = path.join(os.tmpdir(), `ud_vthumb_${Date.now()}.jpg`)

      await new Promise<void>((resolve, reject) => {
        ffmpeg(filePath)
          .seekInput(seekSecs)
          .outputOptions([
            `-vframes 1`,
            `-vf scale=${size}:${size}:force_original_aspect_ratio=decrease`,
          ])
          .output(tmpFile)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run()
      })

      const buf = await fs.readFile(tmpFile)
      await fs.unlink(tmpFile).catch(() => { /* ignore */ })

      return {
        ok: true,
        dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`,
      }
    } catch (err: any) {
      return { ok: false, error: err.message ?? String(err) }
    }
  })

  // ── Get sibling files in the same directory ──────────────────────────
  ipcMain.handle('viewer:getSiblingFiles', async (_event, filePath: string) => {
    try {
      const { readdir } = await import('fs/promises')
      const { join, dirname, extname } = await import('path')
      const dir = dirname(filePath)
      const files = await readdir(dir, { withFileTypes: true })
      
      const SUPPORTED_EXTS = new Set([
        '.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff','.tif','.heic','.avif','.ico','.svg',
        '.cr2','.cr3','.nef','.nrw','.arw','.srf','.sr2','.dng','.orf','.rw2','.pef','.ptx','.raf','.raw',
        '.3fr','.mef','.mos','.erf','.rwl','.srw','.x3f','.dcr','.kdc','.mrw',
        '.mp4','.mkv','.avi','.mov','.webm','.wmv','.flv','.m4v','.ts','.m2ts','.mpg','.mpeg',
        '.pdf','.docx','.doc','.xlsx','.xls','.md','.markdown'
      ])
      
      const siblingPaths = files
        .filter(f => f.isFile() && SUPPORTED_EXTS.has(extname(f.name).toLowerCase()))
        .map(f => join(dir, f.name).replace(/\\/g, '/'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      
      return { ok: true, siblings: siblingPaths }
    } catch (err: any) {
      return { ok: false, error: err.message ?? String(err) }
    }
  })

  // ── Read a PDF file as base64 (for inline blob-URL rendering) ─────────────
  ipcMain.handle('viewer:readPdfBase64', async (_event, filePath: string) => {
    try {
      const buf = await readFile(filePath)
      return { ok: true, base64: buf.toString('base64'), size: buf.length }
    } catch (err: any) {
      return { ok: false, error: err.message ?? String(err) }
    }
  })

  // ── Register Uni Desk as default viewer for supported file types ──────────
  // Uses reg.exe to write Windows file associations and thumbnail handlers.
  ipcMain.handle('viewer:registerFileAssociation', async (_event, categories: string[]) => {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    const appPath = process.execPath

    // Map category → file extensions
    const categoryMap: Record<string, string[]> = {
      images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.heic', '.avif', '.svg'],
      raw: ['.cr2', '.cr3', '.nef', '.nrw', '.arw', '.dng', '.orf', '.rw2', '.pef', '.raf', '.raw'],
      video: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv', '.m4v'],
      pdf: ['.pdf'],
      docs: ['.docx', '.doc', '.xlsx', '.xls', '.md', '.markdown'],
    }

    const results: { ext: string; ok: boolean; error?: string }[] = []

    const extsToRegister: string[] = []
    for (const cat of categories) {
      if (categoryMap[cat]) extsToRegister.push(...categoryMap[cat])
    }

    if (process.platform !== 'win32') {
      // On Linux/Unix, file associations are managed by desktop .desktop and xdg-mime
      return { ok: true, results: extsToRegister.map(ext => ({ ext, ok: true })) }
    }

    for (const ext of extsToRegister) {
      try {
        const progId = `UniDesk.Viewer${ext.replace('.', '_')}`
        const friendlyName = `Uni Desk File Viewer (${ext.toUpperCase().slice(1)})`

        // Register ProgID with open command
        await execAsync(`reg add "HKCU\\Software\\Classes\\${progId}" /ve /d "${friendlyName}" /f`)
        await execAsync(`reg add "HKCU\\Software\\Classes\\${progId}\\shell\\open\\command" /ve /d "\\"${appPath}\\" \\"%1\\"" /f`)

        // Register DefaultIcon (use the app exe itself for its embedded icon)
        await execAsync(`reg add "HKCU\\Software\\Classes\\${progId}\\DefaultIcon" /ve /d "\\"${appPath}\\",0" /f`)

        // Associate extension → ProgID
        await execAsync(`reg add "HKCU\\Software\\Classes\\${ext}" /ve /d "${progId}" /f`)
        await execAsync(`reg add "HKCU\\Software\\Classes\\${ext}\\OpenWithProgids" /v "${progId}" /d "" /f`)

        // Register in OpenWith list
        await execAsync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${ext}\\OpenWithProgids" /v "${progId}" /d "" /f`)

        results.push({ ext, ok: true })
      } catch (err: any) {
        results.push({ ext, ok: false, error: err.message })
      }
    }

    // Refresh Windows shell icon cache
    try {
      const { exec: execSync } = await import('child_process')
      execSync('ie4uinit.exe -show', { timeout: 3000 })
    } catch { /* non-fatal */ }

    return { ok: true, results }
  })

  // ── Get current default app status for extension categories ──────────────
  ipcMain.handle('viewer:getDefaultApps', async (_event, exts: string[]) => {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    const results: Record<string, { isUniDesk: boolean; currentApp: string }> = {}

    for (const ext of exts) {
      try {
        const { stdout } = await execAsync(
          `reg query "HKCU\\Software\\Classes\\${ext}" /ve`,
          { timeout: 3000 }
        )
        const isUniDesk = stdout.includes('UniDesk.Viewer')
        const match = stdout.match(/REG_SZ\s+(.+)/)
        results[ext] = { isUniDesk, currentApp: match?.[1]?.trim() ?? '' }
      } catch {
        results[ext] = { isUniDesk: false, currentApp: '' }
      }
    }

    return { ok: true, results }
  })
}
