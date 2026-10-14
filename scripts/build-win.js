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
      execSync('powershell -Command "Get-Process -Name \'*Uni Desk*\' -ErrorAction SilentlyContinue | Stop-Process -Force"', { stdio: 'ignore' })
    } catch {}
  }
}

function prepareCustomMsiTemplate() {
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
      if (!content.includes('WixUIBannerBmp') && content.includes('<UIRef Id="WixUI_InstallDir"/>')) {
        content = content.replace(
          '<UIRef Id="WixUI_InstallDir"/>',
          '{{ if (wixBannerBmp) { }}\n      <WixVariable Id="WixUIBannerBmp" Value="${wixBannerBmp}" Overridable="yes"/>\n      {{ } -}}\n      {{ if (wixDialogBmp) { }}\n      <WixVariable Id="WixUIDialogBmp" Value="${wixDialogBmp}" Overridable="yes"/>\n      {{ } -}}\n      <UIRef Id="WixUI_InstallDir"/>'
        )
        modified = true
      }
      if (modified) {
        fs.writeFileSync(tplPath, content, 'utf8')
        logSuccess('Synchronized professional WiX MSI template (ActionText status bar + custom UI branding).')
      }
    }
  } catch (err) {
    logWarn('Could not auto-patch WiX template: ' + err.message)
  }
}

function buildWindows() {
  ensureProcessClosed()
  ensureWinSharp()
  prepareCustomMsiTemplate()

  const requestedTarget = process.argv[2] // e.g. "zip", "nsis", "dir"

  if (process.platform === 'win32') {
    const targetFlag = requestedTarget ? requestedTarget : ''
    log(`Building Windows application natively on Windows (${targetFlag || 'nsis'})...`)
    execSync(`npx electron-builder --win ${targetFlag}`, { stdio: 'inherit' })
    logSuccess('Windows compilation finished successfully.')
    return
  }

  // Running on Linux / non-Windows host
  const hasWine = hasCommand('wine') || hasCommand('wine64')

  if (hasWine && requestedTarget === 'nsis') {
    log('Detected Wine on Linux host. Compiling Windows NSIS installer (.exe)...')
    try {
      execSync(`npx electron-builder --win nsis`, { stdio: 'inherit' })
      logSuccess('Windows NSIS installer built successfully in release/')
      return
    } catch (err) {
      logWarn('Wine-based NSIS build encountered an issue. Falling back to portable .exe build...')
    }
  }

  // Linux host: Build unpacked binaries then compile professional Setup installer
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'))
  const version = pkg.version || '26.9.22'

  // Step 1: Build win-unpacked directory
  log('Packaging Windows unpacked binaries (win-unpacked)...')
  execSync('npx electron-builder --win dir -c.win.signAndEditExecutable=false', { stdio: 'inherit' })
  logSuccess('Windows unpacked binaries created in release/win-unpacked')

  // Step 2: Compile Professional Setup Installer using makensis (if available) or portable
  if (hasCommand('makensis')) {
    log(`Compiling Professional Windows Setup Installer via NSIS (makensis) for v${version}...`)
    try {
      execSync(`makensis -DVERSION=${version} installer/installer.nsi`, { stdio: 'inherit' })
      logSuccess(`Professional Setup Installer generated: release/UniDesk_V${version}_Setup.exe`)
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
}

if (require.main === module) {
  try {
    buildWindows()
  } catch (e) {
    console.error('\x1b[31m[UniDesk WinBuild] Failed:\x1b[0m', e.message)
    process.exit(1)
  }
}
