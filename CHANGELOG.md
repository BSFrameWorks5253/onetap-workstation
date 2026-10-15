# Changelog

All notable changes to the **UniDesk Studio** workstation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [26.10.10] - 2026-10-15

### 🚀 Microsoft Store & Modern Packaging
- **MSIX Packaging Target**: Configured `electron-builder` to target native `.msix` with `runFullTrust` desktop bridge capabilities for direct Microsoft Store submission without third-party download hosts.
- **Automated Windows 10/11 Tile Generator**: Added `scripts/generate_appx_assets.js` using `sharp` to derive high-dpi, centered, obsidian-themed tile and splash assets (`Square44x44Logo.png`, `Square71x71Logo.png`, `Square150x150Logo.png`, `Square310x310Logo.png`, `Wide310x150Logo.png`, `StoreLogo.png`, `SplashScreen.png`, `BadgeLogo.png`).
- **Studio GUI Integration**: Extended `scripts/make_exe_cross.py` with native `build_msix` pipeline execution, GUI toggle switch under Active Stages, `.msix` version-matching asset archiver, and header action button `🚀 Build App (EXE + MSI + MSIX)`.
- **Microsoft Store Blueprint**: Authored `Docs/blueprints/06_MICROSOFT_STORE_MSIX_PACKAGING.md` covering Partner Center product identity mapping, PowerShell self-signed testing certificates, and store submission checklists.

### 📚 Modular Architecture Blueprints Suite
- **Universal Auto-Update Architecture (`01_AUTO_UPDATE_SYSTEM.md`)**: Self-hosted manifest specification, SHA-256 integrity verification, silent `/S` background NSIS updates, and React toast notification patterns.
- **Professional GitHub Presentation Suite (`02_PROFESSIONAL_GITHUB_REPO_AND_PAGES.md`)**: Self-contained SVG hero banners, live terminal typing simulations, YAML issue forms, PR templates, and GitHub Pages CI/CD.
- **Token-Saving Context Engine (`03_TOKEN_SAVING_CONTEXT_ENGINE.md`)**: AST-aware delta MD5 hashing engine (`scripts/codebase_analyzer.py`) saving ~892k tokens per AI programming session.
- **Premium Animated Banners & SVGs (`04_PREMIUM_ANIMATED_BANNERS_AND_SVGS.md`)**: Camo-proxy-proof vector graphic templates with inline CSS `@keyframes`, laser scanlines, and particle highways.
- **Custom Premium Installer & Setup Wizard (`05_CUSTOM_PREMIUM_INSTALLER.md`)**: Dual-layer desktop onboarding with Modern UI 2 NSIS script and in-app cyber HUD wizard.
- **Master Blueprint Catalog (`INDEX.md`)**: Comprehensive directory and cross-project navigation hub.

### 🎨 In-App Setup Wizard & UI Polish
- **Cyber HUD Hero Header**: Integrated `src/renderer/src/assets/hero_animated.svg` into `SetupWizard.tsx` with dynamic status pulse pill.
- **Glassmorphism CSS Overhaul**: Upgraded `SetupWizard.css` to dark obsidian glass cards, radial glow ambient backdrops, and responsive mobile/desktop layout.
- **Welcome Screen Arabic Calligraphy**: Fixed text clipping and disappearance using a rock-solid `clip-path` feathered RTL wipe (`inset(-150px 0% -150px 100%)` to `inset(-150px 0% -150px 0%)`), ensuring non-Latin diacritics render crisply without mask freeze bugs.

### 🛡️ Enterprise Licensing & Community Standards
- **Commercial Dual-License**: Formulated `LICENSE.md` granting 100% royalty-free perpetual ownership of all media, video, and audio renders produced by the workstation while protecting proprietary source code.
- **Comprehensive Project Description**: Created `Docs/PROJECT_DESCRIPTION.md` detailing technical stack, batch rendering benchmarks, and architecture.
- **GitHub Community Standards**: Added `SECURITY.md` (vulnerability disclosure policy), `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1), and `CONTRIBUTING.md`.
- **Interactive Issue Forms**: Added bug report (`.github/ISSUE_TEMPLATE/01_bug_report.yml`) and feature request (`.github/ISSUE_TEMPLATE/02_feature_request.yml`) templates.

---

## [20.6.5] - 2026-10-14

### 🐞 Bugs Fixed
- **Settings Persistence**: Ensured synchronous memory cache flush and persistent JSON file backing in Electron store.
- **Render Logic Auto-Detection**: Enforced automated detection of audio channels, sample rates, and timeline configurations.
- **Sticky Audio Logic**: Fixed issue where audio logic reset between sequential render jobs.
- **Pre-Export Folder Cleanup**: Automatically clean legacy export artifacts before starting single/custom video exports.
- **Drag & Drop Bleed**: Restricted drop overlays to active media conversion and rendering tabs.

### ✨ Features Added
- **Bidirectional Multi-Batch Queue**: Full synchronization between Title Adder and Video Converter with folder pairing and one-click sequential batch processing.
- **Multi-Folder Drag & Drop**: Drop multiple directories to queue them into discrete processing batches.
- **AST Codebase Analyzer**: Initial implementation of hierarchical `.code-analysis/` cache.
- **Kinetic Preloaders**: Introduced ONTO kinetic typography, Astral Cosmos, and Walbi audio pulse loaders.

---

<sub>For older releases and legacy milestone records, refer to [`Docs/changelogs/`](Docs/changelogs/).</sub>
