# UniDesk Studio Changelog — v20.6.5

> **Release Version**: v20.6.5  
> **Date**: October 14, 2026  
> **Status**: Production Stable  

---

## 🐞 Bugs Fixed
- **Settings Persistence**: Fixed settings not saving across sessions by ensuring synchronous memory cache write and persistent file backing in electron store (`settings.json`).
- **Render Logic Lock**: Removed manual dropdown logic selection in Title Adder and enforced rock-solid auto-detection of audio channels, sample rates, and timeline configurations.
- **Audio Logic Run-to-Run Reset**: Fixed bug where switching audio logic reset back to default on subsequent runs; settings are now sticky across renders.
- **Single / Custom Export Artifacts**: Fixed earlier exported videos persisting in the output folder during single/custom export by introducing automatic pre-export cleanup.
- **DVD Single Video Extraction**: Fixed DVD ingestion pulling unintended sub-videos when only single-video mode was selected.
- **Cloud Portal Links**: Removed outdated AppScript link items; cleaned up Sharaf cloud portal endpoints and fixed link routing.
- **Drag & Drop Overlay Bleed**: Fixed global drop overlay activating on non-file pages (Dashboard, Settings, Stats, Notes).
- **Duplicate Path Parsing**: Removed duplicate path sanitization causing redundant re-renders in Converter.

---

## ✨ Features Added
- **Multi-Batch Queue Synchronization**:
  - Full bidirectional sync between Title Adder and Converter (`Converter.tsx`).
  - Automatic folder pairing (`batchPairs`): source folder mapped to photo folder, output path mapped to rendered video subfolder.
  - Interactive batch switcher pills (`#1: Batch 1`, `#2: Batch 2`) in Converter.
  - **⚡ Rename & Move ALL Batches**: One-click sequential execution across all queued batches.
- **Multi-Folder Drag & Drop**:
  - Drag and drop 2 or more folders anywhere in Title Adder to automatically switch to Batch Mode and queue them.
- **Codebase Analysis Caching Engine (`.code-analysis/`)**:
  - SHA-256 incremental hash cache preventing repetitive full-codebase token reads.
  - `npm run analyze:cache` command saving over ~875,000+ AI context tokens per run.
- **Modular Preloader & Loading Screens (`src/renderer/src/components/Loaders/`)**:
  - Integrated modern loaders inspired by Awwwards & Mobbin (ONTO Kinetic Typography, Astral Cosmos, Walbi Audio Pulse, Spasoje Ticker).

---

## ⚡ Performance Improvements
- **Lazy File Scanning**: Replaced unthrottled directory traversal with debounced, memoized filesystem queries.
- **Token Efficiency**: 95%+ context reduction during AI refactoring through `.code-analysis/index.json`.
- **Preload IPC Caching**: Minimized Electron IPC round-trips for disk statistics and hardware telemetry.

---

## 🎨 UI & Visual Polish
- **Calibrated Light Theme**: Softened harsh pure white into architectural ivory/slate (`#F6F5F0`), eliminating eye fatigue.
- **Elevated Dark Theme**: Lifted pitch black into sleek, illuminated obsidian-graphite (`#191B24`) with high-contrast readable typography and luminous accent borders.
- **Micro-Animations**: Smooth cubic-bezier transitions for batch pills, status chips, and drop targets.
