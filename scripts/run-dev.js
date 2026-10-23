#!/usr/bin/env node

/**
 * ====================================================================
 * CROSS-PLATFORM DEV & PREVIEW RUNNER (scripts/run-dev.js)
 * ====================================================================
 * Automatically sets the correct Electron executable path for Linux
 * and Windows in a dual-boot or shared-drive environment.
 * ====================================================================
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const rootDir = path.resolve(__dirname, '..')
const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'
const electronDir = path.join(rootDir, 'node_modules', 'electron')

function resolveElectronExec() {
  if (process.env.ELECTRON_EXEC_PATH && fs.existsSync(process.env.ELECTRON_EXEC_PATH)) {
    return process.env.ELECTRON_EXEC_PATH
  }

  if (isWin) {
    const winExe = path.join(electronDir, 'dist', 'electron.exe')
    if (fs.existsSync(winExe)) return winExe
  }

  if (isLinux) {
    const linuxExe = path.join(electronDir, 'dist-linux', 'electron')
    if (fs.existsSync(linuxExe)) {
      return linuxExe
    }

    // Check if standard dist has Linux ELF executable
    const standardExe = path.join(electronDir, 'dist', 'electron')
    if (fs.existsSync(standardExe)) {
      return standardExe
    }

    // Try auto-extracting cached Linux electron zip if available
    const cacheDir = path.join(process.env.HOME || '', '.cache', 'electron')
    if (fs.existsSync(cacheDir)) {
      const zips = fs.readdirSync(cacheDir).filter(f => f.startsWith('electron-') && f.includes('linux-x64') && f.endsWith('.zip'))
      if (zips.length > 0) {
        const zipFile = path.join(cacheDir, zips[0])
        console.log(`[CrossPlatform] Extracting cached Linux Electron from ${zipFile}...`)
        try {
          const extract = require('extract-zip')
          const targetDir = path.join(electronDir, 'dist-linux')
          fs.mkdirSync(targetDir, { recursive: true })
          require('child_process').execSync(`unzip -q -o "${zipFile}" -d "${targetDir}"`)
          if (fs.existsSync(linuxExe)) {
            console.log('[CrossPlatform] Extracted Linux Electron successfully.')
            return linuxExe
          }
        } catch (e) {
          console.warn('[CrossPlatform] Auto-extract failed:', e.message)
        }
      }
    }
  }

  // Fallback to reading path.txt
  const pathTxt = path.join(electronDir, 'path.txt')
  if (fs.existsSync(pathTxt)) {
    const exeName = fs.readFileSync(pathTxt, 'utf-8').trim()
    const exePath = path.join(electronDir, 'dist', exeName)
    if (fs.existsSync(exePath)) return exePath
  }

  return 'electron'
}

function ensureWinDependencies() {
  if (!isWin) return

  const checks = [
    { pkg: '@rollup/rollup-win32-x64-msvc', dir: path.join(rootDir, 'node_modules', '@rollup', 'rollup-win32-x64-msvc') },
    { pkg: '@esbuild/win32-x64', dir: path.join(rootDir, 'node_modules', '@esbuild', 'win32-x64') }
  ]

  const missing = checks.filter(c => !fs.existsSync(c.dir)).map(c => c.pkg)
  if (missing.length > 0) {
    console.log(`\x1b[33m[CrossPlatform] Detected missing Windows native packages: ${missing.join(', ')}. Installing...\x1b[0m`)
    try {
      require('child_process').execSync(`npm i --no-save ${missing.join(' ')}`, { cwd: rootDir, stdio: 'inherit' })
      console.log(`\x1b[32m[CrossPlatform] Installed missing Windows native packages successfully.\x1b[0m`)
    } catch (e) {
      console.warn(`\x1b[33m[CrossPlatform] Warning: Failed to auto-install missing packages: ${e.message}\x1b[0m`)
    }
  }
}

ensureWinDependencies()

const execPath = resolveElectronExec()
process.env.ELECTRON_EXEC_PATH = execPath

const action = process.argv[2] || 'dev'
const extraArgs = process.argv.slice(3)

console.log(`\x1b[36m[CrossPlatform]\x1b[0m Platform: ${process.platform} (${process.arch})`)
console.log(`\x1b[36m[CrossPlatform]\x1b[0m Electron Executable: ${execPath}`)
console.log(`\x1b[36m[CrossPlatform]\x1b[0m Running: electron-vite ${action} ${extraArgs.join(' ')}`)

const viteScript = path.join(rootDir, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')
const isWindowsCmd = isWin && !process.env.SHELL
const viteBin = path.join(rootDir, 'node_modules', '.bin', isWindowsCmd ? 'electron-vite.cmd' : 'electron-vite')

let child
if (fs.existsSync(viteScript)) {
  // Execute via Node directly to avoid cmd.exe shell escaping issues with spaces in paths
  child = spawn(process.execPath, [viteScript, action, ...extraArgs], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
  })
} else {
  child = spawn(
    fs.existsSync(viteBin) ? `"${viteBin}"` : 'npx',
    fs.existsSync(viteBin) ? [action, ...extraArgs] : ['electron-vite', action, ...extraArgs],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
      shell: isWindowsCmd
    }
  )
}

child.on('close', (code, signal) => {
  if (code !== 0 && code !== null) {
    process.exit(code)
  }
  if (signal) {
    process.exit(1)
  }
})
