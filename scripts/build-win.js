#!/usr/bin/env node

/**
 * ====================================================================
 * CROSS-PLATFORM WINDOWS PACKAGER FOR UNI DESK (scripts/build-win.js)
 * ====================================================================
 * Allows building Windows releases from Windows or Kali Linux.
 * - On Windows: runs standard electron-builder --win.
 * - On Linux with Wine: runs electron-builder --win (creates NSIS .exe setup).
 * - On Linux without Wine: builds portable Windows packages (zip + win-unpacked).
 * ====================================================================
 */

const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

function log(msg) {
  console.log(`\x1b[36m[UniDesk WinBuild]\x1b[0m ${msg}`)
}

function logSuccess(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`)
}

function logWarn(msg) {
  console.log(`\x1b[33m▲ ${msg}\x1b[0m`)
}

function hasCommand(cmd) {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd} 2>/dev/null`
    execSync(checkCmd, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function ensureWinSharp() {
  const sharpWinPath = path.join(process.cwd(), 'node_modules', '@img', 'sharp-win32-x64')
  if (!fs.existsSync(sharpWinPath)) {
    logWarn('@img/sharp-win32-x64 not found in node_modules. Installing Windows prebuild for sharp...')
    try {
      execSync('npm i --no-save --force @img/sharp-win32-x64', { stdio: 'inherit' })
      logSuccess('Installed @img/sharp-win32-x64 successfully.')
    } catch (e) {
      logWarn('Could not auto-install @img/sharp-win32-x64: ' + e.message)
    }
  }
}

function ensureProcessClosed() {
  if (process.platform === 'win32') {
    try {
      execSync('powershell -NoProfile -Command "Stop-Process -Name \'Uni Desk\', \'electron\' -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' })
    } catch {}

    const unlocker = path.join(__dirname, 'unlock_asar.ps1')
    if (fs.existsSync(unlocker)) {
      try {
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${unlocker}"`, { stdio: 'ignore' })
      } catch {}
    }

    const unpackedDir = path.join(process.cwd(), 'release', 'win-unpacked')
    if (fs.existsSync(unpackedDir)) {
      try {
        fs.rmSync(unpackedDir, { recursive: true, force: true })
      } catch {}
    }
  }
}

function prepareCustomMsiTemplate() {
  try {
    const { generateInstallerAssets } = require('./generate_installer_assets')
    generateInstallerAssets()
  } catch (err) {
    logWarn('Could not auto-generate installer assets: ' + err.message)
  }

  try {
    const msiTargetFile = path.join(process.cwd(), 'node_modules', 'app-builder-lib', 'out', 'targets', 'MsiTarget.js')
    if (fs.existsSync(msiTargetFile)) {
      let code = fs.readFileSync(msiTargetFile, 'utf8')
      if (code.includes('path.join(resourceDir, "installer_banner.bmp")')) {
        code = code.replace(
          'path.join(resourceDir, "installer_banner.bmp")',
          'path.join(this.packager.projectDir, "build", "wix_dialog.bmp")'
        ).replace(
          'path.join(resourceDir, "installer_small.bmp")',
          'path.join(this.packager.projectDir, "build", "wix_banner.bmp")'
        )
        fs.writeFileSync(msiTargetFile, code, 'utf8')
        logSuccess('Routed professional 493x312 WiX dialog bitmap to MsiTarget.')
      }
    }
  } catch (err) {
    logWarn('Could not auto-patch MsiTarget: ' + err.message)
  }

  try {
    const tplPath = path.join(process.cwd(), 'node_modules', 'app-builder-lib', 'templates', 'msi', 'template.xml')
    if (fs.existsSync(tplPath)) {
      let content = fs.readFileSync(tplPath, 'utf8')
      let modified = false
      if (!content.includes('WixUI_ErrorProgressText')) {
        content = content.replace(
          '<UIRef Id="WixUI_InstallDir"/>',
          '<!-- Professional MSI Status & Progress Action Text -->\n      <UIRef Id="WixUI_ErrorProgressText"/>\n      <UIRef Id="WixUI_InstallDir"/>'
        )
        modified = true
      }
      if (content.includes('FindRelatedProducts" Order="5"')) {
        content = content.replace(/<Publish Dialog="InstallScopeDlg" Control="Next" Event="DoAction" Value="FindRelatedProducts" Order="5">1<\/Publish>\r?\n?/, '')
        modified = true
      }
      if (content.includes('wixBannerBmp')) {
        content = content.replace(/\{\{\s*if\s*\((?:typeof\s+wixBannerBmp|wixBannerBmp)[^}]*\}\}[\s\S]*?\{\{\s*\}\s*-\}\}\r?\n?/g, '')
        content = content.replace(/\{\{\s*if\s*\((?:typeof\s+wixDialogBmp|wixDialogBmp)[^}]*\}\}[\s\S]*?\{\{\s*\}\s*-\}\}\r?\n?/g, '')
        modified = true
      }
      if (modified) {
        fs.writeFileSync(tplPath, content, 'utf8')
        logSuccess('Synchronized professional WiX MSI template (ActionText status bar).')
      }
    }
  } catch (err) {
    logWarn('Could not auto-patch WiX template: ' + err.message)
  }
}

async function buildWindows() {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'))
  ensureProcessClosed()
  ensureWinSharp()
  prepareCustomMsiTemplate()

  const requestedTarget = process.argv[2] // e.g. "zip", "nsis", "msi", "msix", "dir"
  let builderTarget = requestedTarget ? requestedTarget : ''

  if (requestedTarget === 'msix' || requestedTarget === 'appx') {
    builderTarget = 'appx'
    try {
      const { generateAppxAssets } = require('./generate_appx_assets')
      generateAppxAssets()
    } catch (e) {
      logWarn('Could not auto-generate MSIX/AppX assets: ' + e.message)
    }
  }

  if (process.platform === 'win32') {
    log(`Building Windows application natively on Windows (${builderTarget || 'nsis'})...`)
    execSync(`npx electron-builder --win ${builderTarget}`, { stdio: 'inherit' })
    if (builderTarget === 'appx') {
      try {
        log('Signing AppX / MSIX package with Windows SDK SignTool and developer certificate...')
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(__dirname, 'sign_appx.ps1')}"`, { stdio: 'inherit' })
        logSuccess('AppX / MSIX package successfully signed with trusted developer certificate!')
      } catch (signErr) {
        logWarn('Could not auto-sign AppX package: ' + signErr.message)
      }

      // Generate .msix copy so user can upload directly to Microsoft Store as .msix or .appx
      try {
        const relDir = path.join(process.cwd(), 'release')
        const files = fs.readdirSync(relDir)
        for (const f of files) {
          if (f.endsWith('.appx')) {
            const msixPath = path.join(relDir, f.replace(/\.appx$/, '.msix'))
            fs.copyFileSync(path.join(relDir, f), msixPath)
            logSuccess(`Created Microsoft Store package: ${path.basename(msixPath)}`)
          }
        }
      } catch (copyErr) {
        logWarn('Could not create .msix alias: ' + copyErr.message)
      }
    }
    logSuccess('Windows compilation finished successfully.')

    // Automatically organize release version-wise and push to GitHub Releases
    try {
      const { publishRelease } = require('./publish_release')
      await publishRelease({ version: pkg.version })
    } catch (pubErr) {
      logWarn('Auto-publish notice: ' + pubErr.message)
    }
    return
  }

  // Running on Linux / non-Windows host
  const hasWine = hasCommand('wine') || hasCommand('wine64')

  if (hasWine && requestedTarget === 'nsis') {
    log('Detected Wine on Linux host. Compiling Windows NSIS installer (.exe)...')
    try {
      execSync(`npx electron-builder --win nsis`, { stdio: 'inherit' })
      logSuccess('Windows NSIS installer built successfully in release/')
      try {
        const { publishRelease } = require('./publish_release')
        await publishRelease({ version: pkg.version })
      } catch (pubErr) {
        logWarn('Auto-publish notice: ' + pubErr.message)
      }
      return
    } catch (err) {
      logWarn('Wine-based NSIS build encountered an issue. Falling back to portable .exe build...')
    }
  }

  // Linux host: Build unpacked binaries then compile professional Setup installer
  const version = pkg.version || '26.10.12'

  // Step 1: Build win-unpacked directory
  log('Packaging Windows unpacked binaries (win-unpacked)...')
  execSync('npx electron-builder --win dir -c.win.signAndEditExecutable=false', { stdio: 'inherit' })
  logSuccess('Windows unpacked binaries created in release/win-unpacked')

  // Step 2: Compile Professional Setup Installer using makensis (if available) or portable
  if (hasCommand('makensis')) {
    log(`Compiling Professional Windows Setup Installer via NSIS (makensis) for v${version}...`)
    try {
      execSync(`makensis -DVERSION=${version} installer/installer.nsi`, { stdio: 'inherit' })
      logSuccess(`Professional Setup Installer generated: release/OneTap-V-${version}.exe`)
      try {
        const { publishRelease } = require('./publish_release')
        await publishRelease({ version })
      } catch (pubErr) {
        logWarn('Auto-publish notice: ' + pubErr.message)
      }
      return
    } catch (nsisErr) {
      logWarn('makensis compilation encountered an issue: ' + nsisErr.message)
    }
  }

  // Fallback to portable executable if makensis is not available
  const target = requestedTarget || 'portable'
  log(`Building fallback Windows package (target: ${target})...`)
  const signFlag = !hasWine ? '-c.win.signAndEditExecutable=false' : ''
  execSync(`npx electron-builder --win ${target} ${signFlag}`, { stdio: 'inherit' })
  logSuccess('Windows build completed successfully in release/')

  try {
    const { publishRelease } = require('./publish_release')
    await publishRelease({ version })
  } catch (pubErr) {
    logWarn('Auto-publish notice: ' + pubErr.message)
  }
}

if (require.main === module) {
  buildWindows()
    .catch((e) => {
      console.error('\x1b[31m[OneTap WinBuild] Failed:\x1b[0m', e.message)
      process.exit(1)
    })
}
