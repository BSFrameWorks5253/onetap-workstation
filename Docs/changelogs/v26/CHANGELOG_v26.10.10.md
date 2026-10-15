# UniDesk Studio Changelog — v26.10.10

> **Release Version**: v26.10.10  
> **Date**: October 15, 2026  
> **Status**: Production Stable / Windows Store Ready  

---

## 🚀 Microsoft Store MSIX Packaging
- **Direct Store Submission**: Added `msix` target to `electron-builder` configuration in `package.json` with `runFullTrust` capabilities, enabling direct package uploads to Microsoft Partner Center without external download URLs.
- **Windows 10/11 Asset Pipeline**: Implemented `scripts/generate_appx_assets.js` with `sharp` to automatically generate high-dpi, centered Start Menu tiles and splash screens (`Square44x44Logo.png`, `Square71x71Logo.png`, `Square150x150Logo.png`, `Square310x310Logo.png`, `Wide310x150Logo.png`, `StoreLogo.png`, `SplashScreen.png`, `BadgeLogo.png`) with obsidian `#0c1017` backdrops.
- **Cross-Platform Studio Integration**: Updated `scripts/make_exe_cross.py` with `build_msix` pipeline execution, GUI toggle switch under Active Stages, `.msix` version-matching asset archiver, and header action button `🚀 Build App (EXE + MSI + MSIX)`.
- **MSIX Architecture Blueprint**: Created `Docs/blueprints/06_MICROSOFT_STORE_MSIX_PACKAGING.md` detailing Partner Center identity mapping, local sideloading certificates, and store submission checklists.

---

## 📚 Cross-Project Architecture Blueprints (`Docs/blueprints/`)
- **Master Blueprint Catalog (`INDEX.md`)**: Complete navigation directory for 6 standalone architecture blueprints.
- **Universal Auto-Update Architecture (`01_AUTO_UPDATE_SYSTEM.md`)**: Specification for manifest-based updates, SHA-256 verification, silent background NSIS installs, and React notification toasts.
- **Professional GitHub Presentation (`02_PROFESSIONAL_GITHUB_REPO_AND_PAGES.md`)**: Best practices for commercial-grade repository branding, animated vector heroes, and GitHub Pages deployments.
- **Token-Saving Context Engine (`03_TOKEN_SAVING_CONTEXT_ENGINE.md`)**: Implementation blueprint for AST delta hashing, hierarchical markdown mirroring, and AI context optimization saving ~892k tokens.
- **Premium Animated Banners & SVGs (`04_PREMIUM_ANIMATED_BANNERS_AND_SVGS.md`)**: Self-contained inline CSS vector animations immune to GitHub Camo caching.
- **Custom Premium Installer & Wizard (`05_CUSTOM_PREMIUM_INSTALLER.md`)**: Two-tier packaging with Modern UI 2 NSIS script and in-app React Setup Wizard.

---

## 🎨 In-App Setup Wizard & Welcome Screen Polish
- **Cyber HUD Hero Header**: Bundled `src/renderer/src/assets/hero_animated.svg` into `SetupWizard.tsx` with dynamic status pulse badge.
- **Glassmorphism CSS Overhaul**: Upgraded `SetupWizard.css` to dark obsidian glass cards, radial glow ambient backdrops, and responsive mobile/desktop layout.
- **Welcome Screen Calligraphy Wipe**: Replaced buggy mask animation with rock-solid RTL `clip-path` wipe (`inset(-150px 0% -150px 100%)` to `inset(-150px 0% -150px 0%)`), ensuring Arabic diacritics render crisply without clipping or disappearing.

---

## 🛡️ Enterprise Licensing & Community Standards
- **Commercial Dual-License (`LICENSE.md`)**: Formulated perpetual royalty-free ownership for all user-rendered videos and media assets while reserving source code copyrights.
- **System Architecture Whitepaper (`Docs/PROJECT_DESCRIPTION.md`)**: Full technical specification, sequential multi-batch benchmarks, and hardware acceleration details.
- **GitHub Community Standards**: Added `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and YAML issue forms (`.github/ISSUE_TEMPLATE/`).
