# Blueprint 05: Custom Premium Installer & In-App Setup Wizard Architecture

A complete guide to packaging professional Windows installers with NSIS Modern UI 2 and embedding in-app first-run Setup Wizards with animated cyber banners.

---

## 🏗️ 1. Two-Tier Installation Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                      TWO-TIER INSTALLATION FLOW                        │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 1: Native Windows NSIS Setup (.EXE)                              │
│  • Custom 164x314 Left BMP Branding Banner                             │
│  • Custom 150x57 Top-Right Header Icon                                │
│  • User-level or All-Users Per-Machine toggle                         │
│  • Silent automation flags (/S) for enterprise deployments             │
│                                                                        │
│ TIER 2: In-App First-Run Setup Wizard (React + Electron)              │
│  • Cyber HUD Animated SVG Banner (1:1 matching GitHub presentation)   │
│  • Local Storage Directory Picker (settings.json path)                │
│  • Hardware Acceleration Auto-Detection (NVENC / QSV / CPU)           │
│  • Smooth Spring Scale-In Transitions                                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🪟 2. Native NSIS Modern UI 2 Script (`installer.nsi`)

Save as `installer/installer.nsi`:

```nsi
; ====================================================================
; ENTERPRISE WINDOWS NSIS INSTALLER TEMPLATE
; ====================================================================

Unicode true
!define PRODUCT_NAME "Your App Name"
!define PRODUCT_VERSION "26.10.10"
!define PRODUCT_PUBLISHER "Your Studio Name"
!define PRODUCT_WEB_SITE "https://yourwebsite.com/"

SetCompressor /SOLID lzma
RequestExecutionLevel user

; ── MODERN UI 2 ───────────────────────────────────────────────────────
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "../resources/icon.ico"
!define MUI_UNICON "../resources/icon.ico"

; Custom Left Sidebar Banner (164x314 BMP) & Top Header (150x57 BMP)
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "../resources/installer_small.bmp"
!define MUI_HEADERIMAGE_RIGHT

!define MUI_WELCOMEFINISHPAGE_BITMAP "../resources/installer_banner.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "../resources/installer_banner.bmp"

; ── INSTALLATION PAGES ────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "../resources/LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\YourApp.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Your App Now"
!insertmacro MUI_PAGE_FINISH

; ── UNINSTALLER PAGES ─────────────────────────────────────────────────
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  File /r "..\dist\win-unpacked\*.*"

  ; Create Start Menu & Desktop Shortcuts
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\YourApp.exe"
  CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\YourApp.exe"
  
  ; Register Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\*.*"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  RMDir /r "$INSTDIR"
SectionEnd
```

---

## 🎨 3. In-App Setup Wizard Component (`SetupWizard.tsx`)

Rendered when `settings.json` is missing or on fresh installations:

```tsx
import React, { useState } from 'react'
import './SetupWizard.css'
import heroBannerSvg from '../../assets/hero_animated.svg'

interface SetupWizardProps {
  onDone: () => void
}

export default function SetupWizard({ onDone }: SetupWizardProps): JSX.Element {
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function browse(): Promise<void> {
    const api = (window as any).api
    const p = await api.dialog.openFolder({ title: 'Select Storage Folder' })
    if (p) { setFolder(p); setError('') }
  }

  async function confirm(): Promise<void> {
    if (!folder) { setError('Please select a storage directory.'); return }
    setBusy(true)
    try {
      await (window as any).api.settings.completeSetup(folder)
      onDone()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setup-overlay anim-fade-in">
      <div className="setup-window">
        {/* Animated Cyber Workstation Hero Banner */}
        <div className="setup-hero-banner-wrap">
          <img src={heroBannerSvg} alt="App Banner" className="setup-hero-banner-img" />
          <div className="setup-hero-live-pill">
            <span className="setup-pulse-dot" />
            <span>INITIAL WORKSTATION SETUP</span>
          </div>
        </div>

        <div className="setup-card-body">
          <h2>Select Storage Directory</h2>
          <p>Choose where project files, render caches, and settings will be saved.</p>

          <div className="setup-input-row">
            <input 
              type="text" 
              value={folder} 
              placeholder="C:\Users\YourName\Documents" 
              onChange={e => setFolder(e.target.value)} 
            />
            <button onClick={browse}>Browse...</button>
          </div>

          {error && <div className="setup-error-msg">{error}</div>}

          <div className="setup-actions">
            <button className="btn-confirm" disabled={busy} onClick={confirm}>
              {busy ? 'Configuring...' : 'Initialize Workstation →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## 💅 4. In-App Setup Wizard Styles (`SetupWizard.css`)

```css
.setup-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(11, 15, 25, 0.85);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.setup-window {
  width: 580px;
  background: #0F172A;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(99, 102, 241, 0.35);
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7);
}

.setup-hero-banner-wrap {
  width: 100%;
  height: 156px;
  position: relative;
  overflow: hidden;
  border-bottom: 1.5px solid rgba(99, 102, 241, 0.4);
  background: #0B0F19;
}

.setup-hero-banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.setup-hero-live-pill {
  position: absolute;
  top: 14px;
  right: 16px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(129, 140, 248, 0.4);
  border-radius: 20px;
  font-family: monospace;
  font-size: 10.5px;
  font-weight: 700;
  color: #93C5FD;
}

.setup-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 8px #10B981;
}
```

---

## 🔨 5. Build Commands

```bash
# Compile React/Electron Vite production bundle
npm run build

# Package NSIS Windows Installer
npx electron-builder --win nsis

# Compile custom standalone installer via NSIS CLI
makensis installer/installer.nsi
```
