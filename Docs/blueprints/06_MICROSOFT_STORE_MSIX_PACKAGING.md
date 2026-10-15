# Blueprint 06: Microsoft Store MSIX Packaging & Modern Windows 10/11 Distribution

> **Target Architecture:** Electron 31+, Node.js 20+, `electron-builder` 24.13+, Microsoft Partner Center (Windows 10/11 Desktop Bridge / Centennial)  
> **Applicability:** Desktop applications requiring direct submission to the Microsoft Store without third-party download hosts.

---

## 1. Executive Architecture Overview

**MSIX** is Microsoft's modern Windows application package format. It combines the advantages of traditional MSI installers (full Win32 capability) with modern UWP isolation (clean declarative uninstall, zero file registry rot, tamper-resistant digital signing, and direct ingestion into the Microsoft Store).

### Direct Store Upload vs. External URL
```
┌────────────────────────────────────────────────────────────────────────┐
│                   DIRECT MICROSOFT STORE SUBMISSION                     │
└────────────────────────────────────────────────────────────────────────┘
 [Developer Build] ──► .msix Package ──► Partner Center Portal ────────┐
                                                                       │
                                                       (Store Ingestion Pipeline)
                                                       • Microsoft Re-Signs with Root CA
                                                       • Generates Delta Updates
                                                       • Distributes via Global CDN
                                                                       │
 [End User Windows 10/11] ◄──── Installs in 1-Click via Store ◄────────┘
 (No browser warnings • Automatic silent updates • Clean uninstall)
```

1. **No External URL Required**: You upload the compiled `.msix` file directly into Microsoft Partner Center. Microsoft's Store CDN hosts and serves the binary.
2. **Native Microsoft Trust**: When uploaded to the Store, Microsoft signs the binary with its own trusted Windows root certificate. SmartScreen warnings never appear.
3. **Automatic Delta Updates**: The Windows Store client automatically downloads binary deltas in the background, rendering custom auto-updaters inside the MSIX container redundant (`autoUpdate: false`).

---

## 2. Locating Publisher Details in Microsoft Partner Center

Before compiling the package, you **must reserve your application name** in Microsoft Partner Center to retrieve your unique package identity parameters.

### Step-by-Step Navigation:
1. Log in to [Microsoft Partner Center](https://partner.microsoft.com/dashboard).
2. Go to **Apps & Games** ➔ **Windows & Xbox** ➔ **Overview**.
3. Click **New Product** ➔ **MSIX or PWA app** and reserve your app name (e.g., `Uni Desk`).
4. Once reserved, navigate in the left sidebar to:  
   **Product management** ➔ **Product Identity**.

### Mandatory Parameter Mapping:

| Partner Center Field | electron-builder Field (`package.json`) | Example Value | Description |
| :--- | :--- | :--- | :--- |
| **Package/Identity/Name** | `msix.identityName` | `BSFramework.UniDesk` | Unique Store-assigned internal package identity name |
| **Package/Identity/Publisher** | `msix.publisher` | `CN=A1B2C3D4-E5F6-7890-ABCD-EF1234567890` | Publisher Common Name (Subject DN) |
| **Package/Properties/PublisherDisplayName** | `msix.publisherDisplayName` | `BS.Framework` | Human-readable publisher name displayed to users |
| **Application ID** | `msix.applicationId` | `UniDesk` | Alphanumeric identifier of the entrypoint executable |
| *(Reserved Product Name)* | `msix.displayName` | `Uni Desk` | Name shown on Start Menu tiles and Store |

> [!WARNING] Exact Identity Match Required
> If `identityName`, `publisher`, or `publisherDisplayName` differs by even a single character from the values on your Partner Center Product Identity page, the Store ingestion pipeline will reject the upload with `Invalid package identity` or `Invalid publisher`.

---

## 3. Production-Ready `package.json` Configuration

The following configuration demonstrates a production-grade Windows configuration supporting both NSIS desktop setups, WiX MSIs, and Microsoft Store MSIX packages.

```json
{
  "name": "UniDesk_App",
  "version": "26.10.10",
  "scripts": {
    "build": "electron-vite build",
    "build:win": "npm run build && node scripts/build-win.js",
    "build:win:nsis": "npm run build && node scripts/build-win.js nsis",
    "build:win:msi": "node scripts/build-win.js msi",
    "build:win:msix": "npm run build && node scripts/build-win.js msix",
    "assets:appx": "node scripts/generate_appx_assets.js"
  },
  "build": {
    "appId": "com.bsframework.unidesk",
    "productName": "Uni Desk",
    "executableName": "Uni Desk",
    "copyright": "Copyright © 2026 BS.Framework",
    "directories": {
      "output": "release",
      "buildResources": "build"
    },
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "msi", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] },
        { "target": "zip", "arch": ["x64"] }
      ],
      "icon": "resources/icon.ico",
      "publisherName": "BS.Framework"
    },
    "msix": {
      "identityName": "BSFramework.UniDesk",
      "publisherDisplayName": "BS.Framework",
      "publisher": "CN=YOUR-MICROSOFT-PUBLISHER-ID",
      "applicationId": "UniDesk",
      "displayName": "Uni Desk",
      "languages": ["en-US"],
      "backgroundColor": "#0c1017",
      "showNameOnTiles": true,
      "capabilities": [
        "runFullTrust"
      ],
      "artifactName": "${productName}_Store_V${version}.${ext}",
      "autoUpdate": false
    }
  }
}
```

### Critical MSIX Fields Explained:
* **`capabilities: ["runFullTrust"]`**: Mandatory for Electron apps. Tells Windows that the application utilizes the desktop bridge to run full Win32 Node.js APIs.
* **`backgroundColor: "#0c1017"`**: Hex color used as the backdrop for Windows 10/11 Start Menu tiles, search results, and initial splash screen windows.
* **`showNameOnTiles: true`**: Renders the product name typography cleanly over the medium and wide tiles.
* **`autoUpdate: false`**: Disables `electron-updater` inside the MSIX package. The Microsoft Store automatically handles seamless background binary delta updates.

---

## 4. Professional Windows 10/11 Visual Asset Styling

Microsoft Store guidelines require specific icon dimensions for Start Menu live tiles, taskbar lists, and splash screens. Without dedicated assets, Windows falls back to distorted or blurry icons.

### Required Asset Directory: `build/appx/`
Place the following PNG files in `build/appx/`:

| File Name | Dimensions | Purpose |
| :--- | :--- | :--- |
| `Square44x44Logo.png` | 44 × 44 px | Taskbar icon, Start Menu app list, Alt-Tab selector |
| `Square71x71Logo.png` | 71 × 71 px | Windows 10 small Start Menu tile |
| `Square150x150Logo.png` | 150 × 150 px | Windows 10/11 medium Start Menu tile (**Mandatory**) |
| `Square310x310Logo.png` | 310 × 310 px | Windows 10 large Start Menu tile |
| `Wide310x150Logo.png` | 310 × 150 px | Windows 10 wide Start Menu tile (**Mandatory**) |
| `StoreLogo.png` | 50 × 50 px | Microsoft Store app listing icon (**Mandatory**) |
| `SplashScreen.png` | 620 × 300 px | Launch splash screen displayed before Electron DOM loads |
| `BadgeLogo.png` | 24 × 24 px | Lock screen and action center notification badge |

### Automated Generator: `scripts/generate_appx_assets.js`
The project includes an automated script using `sharp` to derive all 8 assets from `resources/icon.png`:

```bash
node scripts/generate_appx_assets.js
```

This ensures proper internal padding (so icons don't touch the edges), centered alignment, and dark `#0c1017` themed backdrops.

---

## 5. Build Script & Studio GUI Integration

### 5.1 CLI Compilation
To build the `.msix` package from your terminal:

```bash
# 1. Generate crisp Windows 10/11 tile assets
node scripts/generate_appx_assets.js

# 2. Build production renderer & main bundles
npm run build

# 3. Compile Windows Store MSIX package
npm run build:win:msix
```

The output file will be generated in:
```text
release/Uni Desk_Store_V26.10.10.msix
```

### 5.2 Studio Cross-Platform GUI (`scripts/make_exe_cross.py`)
The unified packaging studio integrates `.msix` as a first-class build target:

```bash
python scripts/make_exe_cross.py
```

* **GUI Switch**: Toggle `Windows Store (.msix)` under **Active Stages**.
* **Header Button**: Click `🚀 Build App (EXE + MSI + MSIX)` to execute the full pipeline.
* **Auto-Archiving**: The pipeline automatically detects `.msix` files, verifies version matching, and moves them to `release/<version>/` alongside `.exe` and `.msi`.

```python
# Pipeline Execution in scripts/make_exe_cross.py
def build_msix(log_fn) -> bool:
    """Build Windows Store MSIX package via electron-builder."""
    ensure_icon_ico(log_fn)
    log_fn('\n' + '-'*56)
    log_fn('  COMPILING WINDOWS STORE PACKAGE (.msix)  (npm run build:win:msix)')
    log_fn('-'*56 + '\n')
    return _stream_cmd(f'{NPM_CMD} run build:win:msix', log_fn)
```

---

## 6. Local Sideloading & Testing (Before Store Upload)

Because Windows blocks untrusted MSIX installations by default, you can generate a temporary self-signed certificate for local testing:

```powershell
# 1. Create a self-signed developer certificate (Run in Admin PowerShell)
$cert = New-SelfSignedCertificate -Type Custom `
    -Subject "CN=YOUR-MICROSOFT-PUBLISHER-ID" `
    -KeyUsage DigitalSignature `
    -FriendlyName "Uni Desk Test Cert" `
    -CertStoreLocation "Cert:\CurrentUser\My"

# 2. Export to PFX format
$password = ConvertTo-SecureString -String "Test1234!" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "test-cert.pfx" -Password $password

# 3. Trust the certificate locally
Import-Certificate -FilePath "test-cert.pfx" -CertStoreLocation "Cert:\LocalMachine\Root"
```

Once installed into your machine's `Trusted Root Certification Authorities`, double-clicking the generated `.msix` opens the native Windows App Installer dialog.

---

## 7. Microsoft Store Submission Checklist

1. [ ] Log in to [Microsoft Partner Center](https://partner.microsoft.com).
2. [ ] Click your reserved application ➔ **Start your submission**.
3. [ ] Under **Pricing and availability**, configure markets and free/paid options.
4. [ ] Under **Properties**, select Category (e.g. *Developer Tools* or *Productivity*).
5. [ ] Under **Packages**, drag & drop the generated `release/Uni Desk_Store_V26.10.10.msix`.
6. [ ] Wait for automated pre-ingestion validation (green checkmark).
7. [ ] Under **Store listings**, add descriptions, search keywords, and screenshots.
8. [ ] Click **Submit to the Store**. Certification typically takes 24–48 hours.
