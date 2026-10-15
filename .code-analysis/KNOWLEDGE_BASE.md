# 🧠 UniDesk Studio — Hierarchical Codebase Knowledge Base & Analysis Cache
> **Last Synced**: 2026-10-15 11:35:23  
> **Total Files Indexed**: 228  
> **Unchanged (Cached)**: 222 | **Re-analyzed**: 6  
> **Estimated AI Context Tokens Saved**: ~892,258 tokens!

This document and the mirrored hierarchy under `.code-analysis/` contain pre-analyzed architectural summaries, exports, interfaces, hooks, and IPC channels for every source file.
**AI Agents**: Consult `.code-analysis/<path>.md` before reading full raw source files to conserve context window!

---

## 📂 Subsystem Directory Breakdown

| Subsystem | File Count | Purpose |
|:---|:---:|:---|
| `src/main` | 47 | Electron main process, IPC controllers, FFmpeg & system engines |
| `src/preload` | 1 | ContextBridge IPC exposure for secure renderer communications |
| `src/renderer/src/pages` | 40 | Core workstation pages (TitleAdder, VideoConverter, TaskTracker, Settings, etc.) |
| `src/renderer/src/components` | 104 | Modular UI cards, buttons, loaders, modals, taskbar previews |
| `src/renderer/src/styles` | 3 | CSS design tokens, soft linen light mode & obsidian dark mode |
| `scripts` | 12 | Automated build, cross-packaging, analysis and packaging scripts |

---

## 🗂️ Mirrored Codebase Index


### `scripts/build-win.js`

- **[scripts/build-win.js](scripts/build-win.js.md)**: Automation, Build & Packaging Script (171 lines)

### `scripts/codebase_analyzer.py`

- **[scripts/codebase_analyzer.py](scripts/codebase_analyzer.py.md)**: Automation, Build & Packaging Script (361 lines) — Exports: `get_file_hash`, `analyze_source_file`, `generate_module_markdown`, `run_analysis`

### `scripts/generate_appx_assets.js`

- **[scripts/generate_appx_assets.js](scripts/generate_appx_assets.js.md)**: Automation, Build & Packaging Script (81 lines)

### `scripts/generate_naming_samples.py`

- **[scripts/generate_naming_samples.py](scripts/generate_naming_samples.py.md)**: Automation, Build & Packaging Script (152 lines)

### `scripts/generate_safar_structure.py`

- **[scripts/generate_safar_structure.py](scripts/generate_safar_structure.py.md)**: Automation, Build & Packaging Script (203 lines)

### `scripts/make_exe.py`

- **[scripts/make_exe.py](scripts/make_exe.py.md)**: Automation, Build & Packaging Script (1853 lines) — Exports: `load_env`, `save_github_token`, `check_dependencies`, `get_iscc_path`

### `scripts/make_exe_cross.py`

- **[scripts/make_exe_cross.py](scripts/make_exe_cross.py.md)**: Automation, Build & Packaging Script (2212 lines) — Exports: `load_env`, `save_env_key`, `save_github_token`, `_run_check`

### `scripts/make_exe_gui.py`

- **[scripts/make_exe_gui.py](scripts/make_exe_gui.py.md)**: Automation, Build & Packaging Script (1100 lines) — Exports: `load_env`, `save_github_token`, `get_current_version`, `sanitize_semver`

### `scripts/process_logos.js`

- **[scripts/process_logos.js](scripts/process_logos.js.md)**: Automation, Build & Packaging Script (57 lines)

### `scripts/run-dev.js`

- **[scripts/run-dev.js](scripts/run-dev.js.md)**: Automation, Build & Packaging Script (141 lines)

### `scripts/take_screenshots.js`

- **[scripts/take_screenshots.js](scripts/take_screenshots.js.md)**: Automation, Build & Packaging Script (97 lines)

### `scripts/test_fade_logic.js`

- **[scripts/test_fade_logic.js](scripts/test_fade_logic.js.md)**: Automation, Build & Packaging Script (148 lines)

### `src/main`

- **[src/main/core/audioEngine.ts](src/main/core/audioEngine.ts.md)**: Electron Main Process / Background Engine (304 lines) — Exports: `AUDIO_EXTS`, `STANDARD_PREFIXES`, `buildAudioPool`, `buildInstrumentalAudioPool`
- **[src/main/core/backupReconciler.ts](src/main/core/backupReconciler.ts.md)**: Electron Main Process / Background Engine (348 lines) — Exports: `getDriveCandidates`
- **[src/main/core/driveWatcherDaemon.ts](src/main/core/driveWatcherDaemon.ts.md)**: Electron Main Process / Background Engine (179 lines) — Exports: `getDaemonStatus`, `setDaemonActive`, `setDaemonInterval`, `startDriveWatcherDaemon`
- **[src/main/core/dynamicIsland.ts](src/main/core/dynamicIsland.ts.md)**: Electron Main Process / Background Engine (377 lines) — Exports: `initDynamicIsland`, `getIslandState`, `updateIslandState`, `onTitleAdderProgressBridge`
- **[src/main/core/envLoader.ts](src/main/core/envLoader.ts.md)**: Electron Main Process / Background Engine (44 lines) — Exports: `loadEnv`
- **[src/main/core/excelExporter.ts](src/main/core/excelExporter.ts.md)**: Electron Main Process / Background Engine (469 lines) — Exports: `generateExcelReport`
- **[src/main/core/ffmpegRunner.ts](src/main/core/ffmpegRunner.ts.md)**: Electron Main Process / Background Engine (507 lines) — Exports: `extractYearFromFileName`, `runFFmpegJob`, `cancelJob`, `pauseJob` [Hooks: useNikahLogic]
- **[src/main/core/folderIconHelper.ts](src/main/core/folderIconHelper.ts.md)**: Electron Main Process / Background Engine (55 lines) — Exports: `applyFolderIcon`
- **[src/main/core/folderWatcher.ts](src/main/core/folderWatcher.ts.md)**: Electron Main Process / Background Engine (286 lines) — Exports: `initWatcher`, `resolveWatchDirectory`, `startWatcher`, `stopWatcher`
- **[src/main/core/gpuDetector.ts](src/main/core/gpuDetector.ts.md)**: Electron Main Process / Background Engine (224 lines) — Exports: `findAndEnsureFfmpegPath`, `getFfmpegExePath`, `getFfprobeExePath`, `getVideoEncoder`
- **[src/main/core/hashVerifier.ts](src/main/core/hashVerifier.ts.md)**: Electron Main Process / Background Engine (214 lines) — Exports: `XXHash64`, `computeBufferXxHash64`
- **[src/main/core/safarHierarchy.ts](src/main/core/safarHierarchy.ts.md)**: Electron Main Process / Background Engine (370 lines) — Exports: `extractEventCodeFromPath`, `extractCity`, `extractSafarFromContainerPath`, `parseSafarFromPath`
- **[src/main/core/safarPdfGenerator.ts](src/main/core/safarPdfGenerator.ts.md)**: Electron Main Process / Background Engine (426 lines) — Exports: `generateSafarPdfHtml`
- **[src/main/core/settingsManager.ts](src/main/core/settingsManager.ts.md)**: Electron Main Process / Background Engine (520 lines) — Exports: `getDefaultTitlesFolder`, `DEFAULTS`, `flushSaveSync`, `initSettings`
- **[src/main/core/syncReportExporter.ts](src/main/core/syncReportExporter.ts.md)**: Electron Main Process / Background Engine (308 lines) — Exports: `generateSyncExcelReport`
- **[src/main/index.ts](src/main/index.ts.md)**: Electron Main Process / Background Engine (1151 lines)
- **[src/main/ipc/archiveCatalog.ipc.ts](src/main/ipc/archiveCatalog.ipc.ts.md)**: Electron Main Process / Background Engine (797 lines) — Exports: `registerArchiveCatalogIPC`, `stopArchiveWatchers`, `setupArchiveAutoWatcher`
- **[src/main/ipc/audio.ipc.ts](src/main/ipc/audio.ipc.ts.md)**: Electron Main Process / Background Engine (35 lines) — Exports: `registerAudioIPC`
- **[src/main/ipc/cameraTransfer.ipc.ts](src/main/ipc/cameraTransfer.ipc.ts.md)**: Electron Main Process / Background Engine (356 lines) — Exports: `registerCameraTransferIPC`
- **[src/main/ipc/cleanup.ipc.ts](src/main/ipc/cleanup.ipc.ts.md)**: Electron Main Process / Background Engine (80 lines) — Exports: `registerCleanupIPC`
- **[src/main/ipc/converter.ipc.ts](src/main/ipc/converter.ipc.ts.md)**: Electron Main Process / Background Engine (472 lines) — Exports: `cleanPath`, `normalizeForMatching`, `resolveVideoFiles`, `resolveImageFiles`
- **[src/main/ipc/dialog.ipc.ts](src/main/ipc/dialog.ipc.ts.md)**: Electron Main Process / Background Engine (81 lines) — Exports: `registerDialogIPC`
- **[src/main/ipc/driveSync.ipc.ts](src/main/ipc/driveSync.ipc.ts.md)**: Electron Main Process / Background Engine (422 lines) — Exports: `registerDriveSyncIPC`
- **[src/main/ipc/folderMaker.ipc.ts](src/main/ipc/folderMaker.ipc.ts.md)**: Electron Main Process / Background Engine (82 lines) — Exports: `registerFolderMakerIPC`
- **[src/main/ipc/inventoryMerger.ipc.ts](src/main/ipc/inventoryMerger.ipc.ts.md)**: Electron Main Process / Background Engine (350 lines) — Exports: `registerInventoryMergerIPC`
- **[src/main/ipc/pdf.ipc.ts](src/main/ipc/pdf.ipc.ts.md)**: Electron Main Process / Background Engine (375 lines) — Exports: `registerPdfIPC`
- **[src/main/ipc/prproj.ipc.ts](src/main/ipc/prproj.ipc.ts.md)**: Electron Main Process / Background Engine (1719 lines) — Exports: `parseFolderMarkerInfo`, `discoverSubfolderVideosWithFoldersNode`, `discoverSubfolderVideosNode`, `EVENT_DEFINITIONS`
- **[src/main/ipc/pvSeparator.ipc.ts](src/main/ipc/pvSeparator.ipc.ts.md)**: Electron Main Process / Background Engine (531 lines) — Exports: `registerPVSeparatorIPC`
- **[src/main/ipc/settings.ipc.ts](src/main/ipc/settings.ipc.ts.md)**: Electron Main Process / Background Engine (125 lines) — Exports: `registerSettingsIPC`
- **[src/main/ipc/statsDb.ipc.ts](src/main/ipc/statsDb.ipc.ts.md)**: Electron Main Process / Background Engine (508 lines) — Exports: `registerStatsDbIPC`
- **[src/main/ipc/system.ipc.ts](src/main/ipc/system.ipc.ts.md)**: Electron Main Process / Background Engine (210 lines) — Exports: `registerSystemIPC`
- **[src/main/ipc/taskTracker.ipc.ts](src/main/ipc/taskTracker.ipc.ts.md)**: Electron Main Process / Background Engine (2009 lines) — Exports: `refreshDriveLabelsAsync`, `getDriveVolumeLabels`, `resolveDriveLabel`, `startDriveSentinel`
- **[src/main/ipc/titleAdder.ipc.ts](src/main/ipc/titleAdder.ipc.ts.md)**: Electron Main Process / Background Engine (2018 lines) — Exports: `isGroupPhotoVideo`, `findTransitionFile`, `resolveSafarFinalPathForVideo`, `registerTitleAdderIPC` [Hooks: useNikahLogic]
- **[src/main/ipc/titleAutomode.ipc.ts](src/main/ipc/titleAutomode.ipc.ts.md)**: Electron Main Process / Background Engine (69 lines) — Exports: `DEFAULT_AUTOMODE_SETTINGS`, `registerTitleAutomodeIPC`
- **[src/main/ipc/update.ipc.ts](src/main/ipc/update.ipc.ts.md)**: Electron Main Process / Background Engine (491 lines) — Exports: `getWorkstationVersion`, `compareVersions`, `triggerSilentStartupCheck`, `registerUpdateIPC`
- **[src/main/ipc/userProfile.ipc.ts](src/main/ipc/userProfile.ipc.ts.md)**: Electron Main Process / Background Engine (431 lines) — Exports: `registerUserProfileIPC`
- **[src/main/ipc/videoTransfer.ipc.ts](src/main/ipc/videoTransfer.ipc.ts.md)**: Electron Main Process / Background Engine (807 lines) — Exports: `parseSequenceName`, `getShotCode`, `findVideoThumbnail`, `findPhotoThumbnail`
- **[src/main/ipc/viewer.ipc.ts](src/main/ipc/viewer.ipc.ts.md)**: Electron Main Process / Background Engine (391 lines) — Exports: `registerViewerIPC`
- **[src/main/python/archive_catalog_db.py](src/main/python/archive_catalog_db.py.md)**: Electron Main Process / Background Engine (2016 lines) — Exports: `get_default_db_path`, `get_tracker_db_path`, `get_settings_json_path`, `load_tracker_status_map`
- **[src/main/python/archive_scanner.py](src/main/python/archive_scanner.py.md)**: Electron Main Process / Background Engine (845 lines) — Exports: `is_adobe_folder`, `is_adobe_file`, `get_mp4_duration_fast`, `find_ffprobe`
- **[src/main/python/check_upload_status.py](src/main/python/check_upload_status.py.md)**: Electron Main Process / Background Engine (432 lines) — Exports: `find_file_in_dir`, `determine_video_upload_status`, `scan_catalog_uploads`, `auto_detect_upload_and_delete_dirs`
- **[src/main/python/create_premiere_projects.py](src/main/python/create_premiere_projects.py.md)**: Electron Main Process / Background Engine (834 lines) — Exports: `find_ffprobe`, `get_video_info`, `natural_sort_key`, `get_prefix_category`
- **[src/main/python/excel_reconciler.py](src/main/python/excel_reconciler.py.md)**: Electron Main Process / Background Engine (1404 lines) — Exports: `normalize_session`, `normalize_date_input`, `reconcile_excel_against_archive`, `export_audit_excel`
- **[src/main/python/merge_inventory_reports.py](src/main/python/merge_inventory_reports.py.md)**: Electron Main Process / Background Engine (283 lines) — Exports: `merge_inventory_reports`, `extract_fs_cols`, `extract_cs_cols`
- **[src/main/python/stats_db.py](src/main/python/stats_db.py.md)**: Electron Main Process / Background Engine (303 lines) — Exports: `get_db_path`, `get_connection`, `init_db`, `insert_records`
- **[src/main/python/sync_old_data.py](src/main/python/sync_old_data.py.md)**: Electron Main Process / Background Engine (812 lines) — Exports: `get_mp4_duration_fast`, `find_ffprobe`, `get_video_duration`, `extract_city`
- **[src/main/python/tracker_db.py](src/main/python/tracker_db.py.md)**: Electron Main Process / Background Engine (1095 lines) — Exports: `get_db_path`, `get_connection`, `init_db`, `upsert_tasks`

### `src/preload`

- **[src/preload/index.ts](src/preload/index.ts.md)**: Electron Main Process / Background Engine (609 lines)

### `src/renderer`

- **[src/renderer/src/App.tsx](src/renderer/src/App.tsx.md)**: Utility / Helper Module (1282 lines) — Exports: `App` [Hooks: useEffect, useRef, useSound]
- **[src/renderer/src/components/AnimateNumber/AnimateNumber.tsx](src/renderer/src/components/AnimateNumber/AnimateNumber.tsx.md)**: Modular UI Component (51 lines) — Exports: `AnimateNumber` [Hooks: useEffect, useRef, useState]
- **[src/renderer/src/components/AnimateNumber/index.ts](src/renderer/src/components/AnimateNumber/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/AutoUpdateModal/AutoUpdateModal.css](src/renderer/src/components/AutoUpdateModal/AutoUpdateModal.css.md)**: Modular UI Component (346 lines)
- **[src/renderer/src/components/AutoUpdateModal/AutoUpdateModal.tsx](src/renderer/src/components/AutoUpdateModal/AutoUpdateModal.tsx.md)**: Modular UI Component (245 lines) — Exports: `AutoUpdateModal` [Hooks: useToast]
- **[src/renderer/src/components/AutoUpdateModal/index.ts](src/renderer/src/components/AutoUpdateModal/index.ts.md)**: Modular UI Component (1 lines)
- **[src/renderer/src/components/Button/Button.css](src/renderer/src/components/Button/Button.css.md)**: Modular UI Component (247 lines)
- **[src/renderer/src/components/Button/Button.tsx](src/renderer/src/components/Button/Button.tsx.md)**: Modular UI Component (58 lines) — Exports: `Button`, `GhostButton`, `DangerButton` [Hooks: useSound]
- **[src/renderer/src/components/Button/index.ts](src/renderer/src/components/Button/index.ts.md)**: Modular UI Component (1 lines)
- **[src/renderer/src/components/Card/Card.css](src/renderer/src/components/Card/Card.css.md)**: Modular UI Component (193 lines)
- **[src/renderer/src/components/Card/Card.tsx](src/renderer/src/components/Card/Card.tsx.md)**: Modular UI Component (82 lines) — Exports: `Card`, `CardHeader`, `PageHero`
- **[src/renderer/src/components/Card/index.ts](src/renderer/src/components/Card/index.ts.md)**: Modular UI Component (1 lines)
- **[src/renderer/src/components/CommandPalette/CommandPalette.css](src/renderer/src/components/CommandPalette/CommandPalette.css.md)**: Modular UI Component (216 lines)
- **[src/renderer/src/components/CommandPalette/CommandPalette.tsx](src/renderer/src/components/CommandPalette/CommandPalette.tsx.md)**: Modular UI Component (179 lines) — Exports: `CommandPalette` [Hooks: useEffect, useRef, useSound]
- **[src/renderer/src/components/CommandPalette/index.ts](src/renderer/src/components/CommandPalette/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/DateSearchSelect.tsx](src/renderer/src/components/DateSearchSelect.tsx.md)**: Modular UI Component (238 lines) — Exports: `DateSearchSelect` [Hooks: useEffect, useMemo, useRef]
- **[src/renderer/src/components/DynamicIsland/DynamicIsland.css](src/renderer/src/components/DynamicIsland/DynamicIsland.css.md)**: Modular UI Component (480 lines)
- **[src/renderer/src/components/DynamicIsland/DynamicIsland.tsx](src/renderer/src/components/DynamicIsland/DynamicIsland.tsx.md)**: Modular UI Component (316 lines) — Exports: `DynamicIsland` [Hooks: useEffect, useRef, useState]
- **[src/renderer/src/components/EmailBroadcast/EmailBroadcastModal.css](src/renderer/src/components/EmailBroadcast/EmailBroadcastModal.css.md)**: Modular UI Component (849 lines)
- **[src/renderer/src/components/EmailBroadcast/EmailBroadcastModal.tsx](src/renderer/src/components/EmailBroadcast/EmailBroadcastModal.tsx.md)**: Modular UI Component (1109 lines) — Exports: `EmailBroadcastModal` [Hooks: useEffect, useRef, useState]
- **[src/renderer/src/components/ErrorBoundary/WorkstationErrorBoundary.css](src/renderer/src/components/ErrorBoundary/WorkstationErrorBoundary.css.md)**: Modular UI Component (337 lines)
- **[src/renderer/src/components/ErrorBoundary/WorkstationErrorBoundary.tsx](src/renderer/src/components/ErrorBoundary/WorkstationErrorBoundary.tsx.md)**: Modular UI Component (197 lines) — Exports: `WorkstationErrorBoundary`
- **[src/renderer/src/components/EventSearchSelect.tsx](src/renderer/src/components/EventSearchSelect.tsx.md)**: Modular UI Component (238 lines) — Exports: `EventSearchSelect` [Hooks: useEffect, useMemo, useRef]
- **[src/renderer/src/components/FileViewer/FileViewer.css](src/renderer/src/components/FileViewer/FileViewer.css.md)**: Modular UI Component (788 lines)
- **[src/renderer/src/components/FileViewer/FileViewer.tsx](src/renderer/src/components/FileViewer/FileViewer.tsx.md)**: Modular UI Component (840 lines) — Exports: `FileViewer` [Hooks: useCallback, useEffect, useMemo]
- **[src/renderer/src/components/FileViewer/index.ts](src/renderer/src/components/FileViewer/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/GlobalDropOverlay/GlobalDropOverlay.css](src/renderer/src/components/GlobalDropOverlay/GlobalDropOverlay.css.md)**: Modular UI Component (181 lines)
- **[src/renderer/src/components/GlobalDropOverlay/GlobalDropOverlay.tsx](src/renderer/src/components/GlobalDropOverlay/GlobalDropOverlay.tsx.md)**: Modular UI Component (224 lines) — Exports: `GlobalDropOverlay` [Hooks: useEffect, useRef, useSound]
- **[src/renderer/src/components/GlobalDropOverlay/index.ts](src/renderer/src/components/GlobalDropOverlay/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/HardwareMonitor/HardwareMonitor.css](src/renderer/src/components/HardwareMonitor/HardwareMonitor.css.md)**: Modular UI Component (261 lines)
- **[src/renderer/src/components/HardwareMonitor/HardwareMonitor.tsx](src/renderer/src/components/HardwareMonitor/HardwareMonitor.tsx.md)**: Modular UI Component (90 lines) — Exports: `HardwareMonitor` [Hooks: useEffect, useState]
- **[src/renderer/src/components/HardwareMonitor/index.ts](src/renderer/src/components/HardwareMonitor/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/Input/Input.css](src/renderer/src/components/Input/Input.css.md)**: Modular UI Component (144 lines)
- **[src/renderer/src/components/Input/Input.tsx](src/renderer/src/components/Input/Input.tsx.md)**: Modular UI Component (111 lines) — Exports: `Input`, `BrowseRow` [Hooks: useState]
- **[src/renderer/src/components/Input/index.ts](src/renderer/src/components/Input/index.ts.md)**: Modular UI Component (1 lines)
- **[src/renderer/src/components/Loaders/AstralPreloader.css](src/renderer/src/components/Loaders/AstralPreloader.css.md)**: Modular UI Component (139 lines)
- **[src/renderer/src/components/Loaders/AstralPreloader.tsx](src/renderer/src/components/Loaders/AstralPreloader.tsx.md)**: Modular UI Component (71 lines) — Exports: `AstralPreloader` [Hooks: useEffect, useState]
- **[src/renderer/src/components/Loaders/LoaderGalleryModal.css](src/renderer/src/components/Loaders/LoaderGalleryModal.css.md)**: Modular UI Component (187 lines)
- **[src/renderer/src/components/Loaders/LoaderGalleryModal.tsx](src/renderer/src/components/Loaders/LoaderGalleryModal.tsx.md)**: Modular UI Component (149 lines) — Exports: `LoaderGalleryModal` [Hooks: useState]
- **[src/renderer/src/components/Loaders/MobilePulseLoader.css](src/renderer/src/components/Loaders/MobilePulseLoader.css.md)**: Modular UI Component (138 lines)
- **[src/renderer/src/components/Loaders/MobilePulseLoader.tsx](src/renderer/src/components/Loaders/MobilePulseLoader.tsx.md)**: Modular UI Component (82 lines) — Exports: `MobilePulseLoader` [Hooks: useEffect, useState]
- **[src/renderer/src/components/Loaders/OntoLoader.css](src/renderer/src/components/Loaders/OntoLoader.css.md)**: Modular UI Component (423 lines)
- **[src/renderer/src/components/Loaders/OntoLoader.tsx](src/renderer/src/components/Loaders/OntoLoader.tsx.md)**: Modular UI Component (159 lines) — Exports: `OntoLoader` [Hooks: useEffect, useState]
- **[src/renderer/src/components/Loaders/SpasojeLoader.css](src/renderer/src/components/Loaders/SpasojeLoader.css.md)**: Modular UI Component (82 lines)
- **[src/renderer/src/components/Loaders/SpasojeLoader.tsx](src/renderer/src/components/Loaders/SpasojeLoader.tsx.md)**: Modular UI Component (70 lines) — Exports: `SpasojeLoader` [Hooks: useEffect, useState]
- **[src/renderer/src/components/Loaders/WalbiIntroLoader.css](src/renderer/src/components/Loaders/WalbiIntroLoader.css.md)**: Modular UI Component (125 lines)
- **[src/renderer/src/components/Loaders/WalbiIntroLoader.tsx](src/renderer/src/components/Loaders/WalbiIntroLoader.tsx.md)**: Modular UI Component (71 lines) — Exports: `WalbiIntroLoader` [Hooks: useEffect, useState]
- **[src/renderer/src/components/Loaders/index.ts](src/renderer/src/components/Loaders/index.ts.md)**: Modular UI Component (6 lines)
- **[src/renderer/src/components/LogBox/LogBox.css](src/renderer/src/components/LogBox/LogBox.css.md)**: Modular UI Component (245 lines)
- **[src/renderer/src/components/LogBox/LogBox.tsx](src/renderer/src/components/LogBox/LogBox.tsx.md)**: Modular UI Component (90 lines) — Exports: `LogBox`, `useLogLines` [Hooks: useEffect, useLogLines, useRef]
- **[src/renderer/src/components/LogBox/index.ts](src/renderer/src/components/LogBox/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/Modal/Modal.css](src/renderer/src/components/Modal/Modal.css.md)**: Modular UI Component (80 lines)
- **[src/renderer/src/components/Modal/Modal.tsx](src/renderer/src/components/Modal/Modal.tsx.md)**: Modular UI Component (70 lines) — Exports: `Modal` [Hooks: useEffect, useRef]
- **[src/renderer/src/components/Modal/index.ts](src/renderer/src/components/Modal/index.ts.md)**: Modular UI Component (3 lines)
- **[src/renderer/src/components/MorphingBrand/MorphingBrand.tsx](src/renderer/src/components/MorphingBrand/MorphingBrand.tsx.md)**: Modular UI Component (108 lines) — Exports: `MorphingBrand`
- **[src/renderer/src/components/MorphingBrand/MorphingBrandText.tsx](src/renderer/src/components/MorphingBrand/MorphingBrandText.tsx.md)**: Modular UI Component (33 lines) — Exports: `MorphingBrandText`
- **[src/renderer/src/components/MorphingBrand/index.ts](src/renderer/src/components/MorphingBrand/index.ts.md)**: Modular UI Component (3 lines)
- **[src/renderer/src/components/NavItem/NavItem.css](src/renderer/src/components/NavItem/NavItem.css.md)**: Modular UI Component (191 lines)
- **[src/renderer/src/components/NavItem/NavItem.tsx](src/renderer/src/components/NavItem/NavItem.tsx.md)**: Modular UI Component (100 lines) [Hooks: useSound]
- **[src/renderer/src/components/NavItem/index.ts](src/renderer/src/components/NavItem/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/PageLoader/PageLoader.css](src/renderer/src/components/PageLoader/PageLoader.css.md)**: Modular UI Component (78 lines)
- **[src/renderer/src/components/PageLoader/PageLoader.tsx](src/renderer/src/components/PageLoader/PageLoader.tsx.md)**: Modular UI Component (60 lines) — Exports: `PageLoader`
- **[src/renderer/src/components/PageLoader/index.ts](src/renderer/src/components/PageLoader/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/PixelMorphingLogo/PixelMorphingLogo.tsx](src/renderer/src/components/PixelMorphingLogo/PixelMorphingLogo.tsx.md)**: Modular UI Component (239 lines) — Exports: `PixelMorphingLogo` [Hooks: useEffect, useRef]
- **[src/renderer/src/components/PixelMorphingLogo/index.ts](src/renderer/src/components/PixelMorphingLogo/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/PowerHubModal/PowerHubModal.css](src/renderer/src/components/PowerHubModal/PowerHubModal.css.md)**: Modular UI Component (291 lines)
- **[src/renderer/src/components/PowerHubModal/PowerHubModal.tsx](src/renderer/src/components/PowerHubModal/PowerHubModal.tsx.md)**: Modular UI Component (401 lines) — Exports: `PowerHubModal` [Hooks: useEffect, useSound, useState]
- **[src/renderer/src/components/PowerHubModal/index.ts](src/renderer/src/components/PowerHubModal/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/ProgressBar/ProgressBar.css](src/renderer/src/components/ProgressBar/ProgressBar.css.md)**: Modular UI Component (88 lines)
- **[src/renderer/src/components/ProgressBar/ProgressBar.tsx](src/renderer/src/components/ProgressBar/ProgressBar.tsx.md)**: Modular UI Component (47 lines) — Exports: `ProgressBar`
- **[src/renderer/src/components/ProgressBar/index.ts](src/renderer/src/components/ProgressBar/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/RenderingMonitorWidget/RenderingMonitorWidget.css](src/renderer/src/components/RenderingMonitorWidget/RenderingMonitorWidget.css.md)**: Modular UI Component (399 lines)
- **[src/renderer/src/components/RenderingMonitorWidget/RenderingMonitorWidget.tsx](src/renderer/src/components/RenderingMonitorWidget/RenderingMonitorWidget.tsx.md)**: Modular UI Component (304 lines) — Exports: `RenderingMonitorWidget` [Hooks: useEffect, useState]
- **[src/renderer/src/components/SafarSearchSelect.tsx](src/renderer/src/components/SafarSearchSelect.tsx.md)**: Modular UI Component (206 lines) — Exports: `SafarSearchSelect` [Hooks: useEffect, useMemo, useRef]
- **[src/renderer/src/components/SetupWizard/SetupWizard.css](src/renderer/src/components/SetupWizard/SetupWizard.css.md)**: Modular UI Component (309 lines)
- **[src/renderer/src/components/SetupWizard/SetupWizard.tsx](src/renderer/src/components/SetupWizard/SetupWizard.tsx.md)**: Modular UI Component (139 lines) — Exports: `SetupWizard` [Hooks: useState]
- **[src/renderer/src/components/SetupWizard/index.ts](src/renderer/src/components/SetupWizard/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/Sidebar/Sidebar.css](src/renderer/src/components/Sidebar/Sidebar.css.md)**: Modular UI Component (278 lines)
- **[src/renderer/src/components/Sidebar/Sidebar.tsx](src/renderer/src/components/Sidebar/Sidebar.tsx.md)**: Modular UI Component (204 lines) — Exports: `Sidebar` [Hooks: useEffect, useRef, useState]
- **[src/renderer/src/components/Sidebar/index.ts](src/renderer/src/components/Sidebar/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/Skeleton/Skeleton.tsx](src/renderer/src/components/Skeleton/Skeleton.tsx.md)**: Modular UI Component (272 lines) — Exports: `Skeleton`, `SkeletonCircle`, `SkeletonText`, `SkeletonCard`
- **[src/renderer/src/components/Skeleton/index.ts](src/renderer/src/components/Skeleton/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/SoundProvider/SoundProvider.tsx](src/renderer/src/components/SoundProvider/SoundProvider.tsx.md)**: Modular UI Component (261 lines) — Exports: `useSound`, `SoundProvider` [Hooks: useCallback, useContext, useEffect]
- **[src/renderer/src/components/SoundProvider/index.ts](src/renderer/src/components/SoundProvider/index.ts.md)**: Modular UI Component (1 lines)
- **[src/renderer/src/components/SplashScreen/SplashScreen.css](src/renderer/src/components/SplashScreen/SplashScreen.css.md)**: Modular UI Component (477 lines)
- **[src/renderer/src/components/SplashScreen/SplashScreen.tsx](src/renderer/src/components/SplashScreen/SplashScreen.tsx.md)**: Modular UI Component (342 lines) — Exports: `SplashScreen` [Hooks: useEffect, useRef, useState]
- **[src/renderer/src/components/SplashScreen/index.ts](src/renderer/src/components/SplashScreen/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/StatCard/StatCard.css](src/renderer/src/components/StatCard/StatCard.css.md)**: Modular UI Component (113 lines)
- **[src/renderer/src/components/StatCard/StatCard.tsx](src/renderer/src/components/StatCard/StatCard.tsx.md)**: Modular UI Component (70 lines) — Exports: `StatCard`, `StatusChip`, `ValidationDot`
- **[src/renderer/src/components/StatCard/index.ts](src/renderer/src/components/StatCard/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/TaskbarPreview/PageHoverPreview.css](src/renderer/src/components/TaskbarPreview/PageHoverPreview.css.md)**: Modular UI Component (246 lines)
- **[src/renderer/src/components/TaskbarPreview/PageHoverPreview.tsx](src/renderer/src/components/TaskbarPreview/PageHoverPreview.tsx.md)**: Modular UI Component (156 lines) — Exports: `PageHoverPreview`
- **[src/renderer/src/components/Toast/Toast.css](src/renderer/src/components/Toast/Toast.css.md)**: Modular UI Component (532 lines)
- **[src/renderer/src/components/Toast/Toast.tsx](src/renderer/src/components/Toast/Toast.tsx.md)**: Modular UI Component (251 lines) — Exports: `useToast`, `ToastProvider` [Hooks: useCallback, useContext, useEffect]
- **[src/renderer/src/components/Toast/index.ts](src/renderer/src/components/Toast/index.ts.md)**: Modular UI Component (1 lines)
- **[src/renderer/src/components/Toolbar/Toolbar.css](src/renderer/src/components/Toolbar/Toolbar.css.md)**: Modular UI Component (211 lines)
- **[src/renderer/src/components/Toolbar/Toolbar.tsx](src/renderer/src/components/Toolbar/Toolbar.tsx.md)**: Modular UI Component (93 lines) — Exports: `Toolbar` [Hooks: useEffect, useState]
- **[src/renderer/src/components/Toolbar/index.ts](src/renderer/src/components/Toolbar/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/TrayDock/TrayDock.css](src/renderer/src/components/TrayDock/TrayDock.css.md)**: Modular UI Component (172 lines)
- **[src/renderer/src/components/TrayDock/TrayDock.tsx](src/renderer/src/components/TrayDock/TrayDock.tsx.md)**: Modular UI Component (101 lines) — Exports: `TrayDock`
- **[src/renderer/src/components/TrayDock/index.ts](src/renderer/src/components/TrayDock/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/WelcomeScreen/WelcomeScreen.css](src/renderer/src/components/WelcomeScreen/WelcomeScreen.css.md)**: Modular UI Component (257 lines)
- **[src/renderer/src/components/WelcomeScreen/WelcomeScreen.tsx](src/renderer/src/components/WelcomeScreen/WelcomeScreen.tsx.md)**: Modular UI Component (259 lines) — Exports: `WelcomeScreen` [Hooks: useEffect, useMemo, useRef]
- **[src/renderer/src/components/WelcomeScreen/index.ts](src/renderer/src/components/WelcomeScreen/index.ts.md)**: Modular UI Component (2 lines)
- **[src/renderer/src/components/index.ts](src/renderer/src/components/index.ts.md)**: Modular UI Component (30 lines)
- **[src/renderer/src/cursor/CursorArea.tsx](src/renderer/src/cursor/CursorArea.tsx.md)**: Utility / Helper Module (26 lines) — Exports: `CursorArea`
- **[src/renderer/src/cursor/CursorProvider.tsx](src/renderer/src/cursor/CursorProvider.tsx.md)**: Utility / Helper Module (215 lines) — Exports: `CursorContext`, `CursorProvider` [Hooks: useCallback, useEffect, useMemo]
- **[src/renderer/src/cursor/CursorShowcaseModal.tsx](src/renderer/src/cursor/CursorShowcaseModal.tsx.md)**: Utility / Helper Module (585 lines) — Exports: `CursorShowcaseModal` [Hooks: useState]
- **[src/renderer/src/cursor/cursor.css](src/renderer/src/cursor/cursor.css.md)**: Design Tokens & Stylesheet (229 lines)
- **[src/renderer/src/cursor/cursorAssets.ts](src/renderer/src/cursor/cursorAssets.ts.md)**: Utility / Helper Module (182 lines) — Exports: `CURSOR_REGISTRY`, `getCursorCssValue`
- **[src/renderer/src/cursor/cursorTypes.ts](src/renderer/src/cursor/cursorTypes.ts.md)**: Utility / Helper Module (44 lines)
- **[src/renderer/src/cursor/index.ts](src/renderer/src/cursor/index.ts.md)**: Electron Main Process / Background Engine (6 lines) [Hooks: useCursor]
- **[src/renderer/src/cursor/useCursor.ts](src/renderer/src/cursor/useCursor.ts.md)**: Utility / Helper Module (37 lines) — Exports: `useCursor`, `useScopedCursor` [Hooks: useContext, useCursor, useScopedCursor]
- **[src/renderer/src/main.tsx](src/renderer/src/main.tsx.md)**: Electron Main Process / Background Engine (24 lines)
- **[src/renderer/src/pages/ArchiveVault/ArchiveVault.css](src/renderer/src/pages/ArchiveVault/ArchiveVault.css.md)**: Renderer UI Page View (3136 lines)
- **[src/renderer/src/pages/ArchiveVault/ArchiveVault.tsx](src/renderer/src/pages/ArchiveVault/ArchiveVault.tsx.md)**: Renderer UI Page View (4151 lines) — Exports: `ArchiveVault` [Hooks: useCallback, useEffect, useMemo]
- **[src/renderer/src/pages/ArchiveVault/GenerateExcelModal.tsx](src/renderer/src/pages/ArchiveVault/GenerateExcelModal.tsx.md)**: Renderer UI Page View (648 lines) — Exports: `GenerateExcelModal` [Hooks: useEffect, useMemo, useState]
- **[src/renderer/src/pages/CameraTransfer/CameraTransfer.css](src/renderer/src/pages/CameraTransfer/CameraTransfer.css.md)**: Renderer UI Page View (753 lines)
- **[src/renderer/src/pages/CameraTransfer/CameraTransfer.tsx](src/renderer/src/pages/CameraTransfer/CameraTransfer.tsx.md)**: Renderer UI Page View (598 lines) — Exports: `CameraTransfer` [Hooks: useEffect, useHijriFolder, useRef]
- **[src/renderer/src/pages/Cleaner/Cleaner.css](src/renderer/src/pages/Cleaner/Cleaner.css.md)**: Renderer UI Page View (182 lines)
- **[src/renderer/src/pages/Cleaner/Cleaner.tsx](src/renderer/src/pages/Cleaner/Cleaner.tsx.md)**: Renderer UI Page View (265 lines) — Exports: `Cleaner` [Hooks: useCallback, useEffect, useState]
- **[src/renderer/src/pages/CloudPortal/CloudPortal.css](src/renderer/src/pages/CloudPortal/CloudPortal.css.md)**: Renderer UI Page View (566 lines)
- **[src/renderer/src/pages/CloudPortal/CloudPortal.tsx](src/renderer/src/pages/CloudPortal/CloudPortal.tsx.md)**: Renderer UI Page View (249 lines) — Exports: `CloudPortal` [Hooks: useEffect, useRef, useSound]
- **[src/renderer/src/pages/Converter/Converter.css](src/renderer/src/pages/Converter/Converter.css.md)**: Renderer UI Page View (425 lines)
- **[src/renderer/src/pages/Converter/Converter.tsx](src/renderer/src/pages/Converter/Converter.tsx.md)**: Renderer UI Page View (875 lines) — Exports: `Converter` [Hooks: useEffect, useRef, useSound]
- **[src/renderer/src/pages/Dashboard/Dashboard.css](src/renderer/src/pages/Dashboard/Dashboard.css.md)**: Renderer UI Page View (424 lines)
- **[src/renderer/src/pages/Dashboard/Dashboard.tsx](src/renderer/src/pages/Dashboard/Dashboard.tsx.md)**: Renderer UI Page View (296 lines) — Exports: `Dashboard` [Hooks: useEffect, useState, useTheme]
- **[src/renderer/src/pages/DriveSync/DriveSync.css](src/renderer/src/pages/DriveSync/DriveSync.css.md)**: Renderer UI Page View (317 lines)
- **[src/renderer/src/pages/DriveSync/DriveSync.tsx](src/renderer/src/pages/DriveSync/DriveSync.tsx.md)**: Renderer UI Page View (621 lines) — Exports: `DriveSync` [Hooks: useEffect, useState]
- **[src/renderer/src/pages/FolderMaker/FolderMaker.css](src/renderer/src/pages/FolderMaker/FolderMaker.css.md)**: Renderer UI Page View (449 lines)
- **[src/renderer/src/pages/FolderMaker/FolderMaker.tsx](src/renderer/src/pages/FolderMaker/FolderMaker.tsx.md)**: Renderer UI Page View (589 lines) — Exports: `FolderMaker` [Hooks: useEffect, useSound, useState]
- **[src/renderer/src/pages/GDrivePortal/GDrivePortal.css](src/renderer/src/pages/GDrivePortal/GDrivePortal.css.md)**: Renderer UI Page View (292 lines)
- **[src/renderer/src/pages/GDrivePortal/GDrivePortal.tsx](src/renderer/src/pages/GDrivePortal/GDrivePortal.tsx.md)**: Renderer UI Page View (190 lines) — Exports: `GDrivePortal` [Hooks: useEffect, useRef, useSound]
- **[src/renderer/src/pages/InventoryMerger/InventoryMerger.css](src/renderer/src/pages/InventoryMerger/InventoryMerger.css.md)**: Renderer UI Page View (495 lines)
- **[src/renderer/src/pages/InventoryMerger/InventoryMerger.tsx](src/renderer/src/pages/InventoryMerger/InventoryMerger.tsx.md)**: Renderer UI Page View (318 lines) — Exports: `InventoryMerger` [Hooks: useState, useToast]
- **[src/renderer/src/pages/PVSeparator/PVSeparator.css](src/renderer/src/pages/PVSeparator/PVSeparator.css.md)**: Renderer UI Page View (261 lines)
- **[src/renderer/src/pages/PVSeparator/PVSeparator.tsx](src/renderer/src/pages/PVSeparator/PVSeparator.tsx.md)**: Renderer UI Page View (484 lines) — Exports: `PVSeparator` [Hooks: useEffect, useLogLines, useSound]
- **[src/renderer/src/pages/PrprojGenerator/PrprojGenerator.css](src/renderer/src/pages/PrprojGenerator/PrprojGenerator.css.md)**: Renderer UI Page View (837 lines)
- **[src/renderer/src/pages/PrprojGenerator/PrprojGenerator.tsx](src/renderer/src/pages/PrprojGenerator/PrprojGenerator.tsx.md)**: Renderer UI Page View (998 lines) — Exports: `PrprojGenerator` [Hooks: useEffect, usePrprojStore, useRef]
- **[src/renderer/src/pages/Settings/FileViewerSettingsCard.tsx](src/renderer/src/pages/Settings/FileViewerSettingsCard.tsx.md)**: Renderer UI Page View (414 lines) — Exports: `FileViewerSettingsCard` [Hooks: useCallback, useEffect, useState]
- **[src/renderer/src/pages/Settings/Settings.css](src/renderer/src/pages/Settings/Settings.css.md)**: Renderer UI Page View (1396 lines)
- **[src/renderer/src/pages/Settings/Settings.tsx](src/renderer/src/pages/Settings/Settings.tsx.md)**: Renderer UI Page View (2135 lines) — Exports: `Settings` [Hooks: useEffect, useSound, useState]
- **[src/renderer/src/pages/Stats/Stats.css](src/renderer/src/pages/Stats/Stats.css.md)**: Renderer UI Page View (3211 lines)
- **[src/renderer/src/pages/Stats/Stats.tsx](src/renderer/src/pages/Stats/Stats.tsx.md)**: Renderer UI Page View (4665 lines) — Exports: `Stats` [Hooks: useCallback, useDirectTag, useEffect]
- **[src/renderer/src/pages/StickyNotes/StickyNotes.css](src/renderer/src/pages/StickyNotes/StickyNotes.css.md)**: Renderer UI Page View (798 lines)
- **[src/renderer/src/pages/StickyNotes/StickyNotes.tsx](src/renderer/src/pages/StickyNotes/StickyNotes.tsx.md)**: Renderer UI Page View (889 lines) — Exports: `StickyNotes` [Hooks: useEffect, useSound, useState]
- **[src/renderer/src/pages/TaskTracker/TaskTracker.css](src/renderer/src/pages/TaskTracker/TaskTracker.css.md)**: Renderer UI Page View (2062 lines)
- **[src/renderer/src/pages/TaskTracker/TaskTracker.tsx](src/renderer/src/pages/TaskTracker/TaskTracker.tsx.md)**: Renderer UI Page View (2177 lines) — Exports: `normalizeDrive`, `TaskTracker` [Hooks: useEffect, useMemo, useRef]
- **[src/renderer/src/pages/TitleAdder/TitleAdder.css](src/renderer/src/pages/TitleAdder/TitleAdder.css.md)**: Renderer UI Page View (3640 lines)
- **[src/renderer/src/pages/TitleAdder/TitleAdder.tsx](src/renderer/src/pages/TitleAdder/TitleAdder.tsx.md)**: Renderer UI Page View (4571 lines) — Exports: `stripDvdFolderFromPath`, `isGroupPhotoVideo`, `validateFilename`, `TitleAdder` [Hooks: useEffect, useLogLines, useMemo]
- **[src/renderer/src/pages/Utilities/Utilities.css](src/renderer/src/pages/Utilities/Utilities.css.md)**: Renderer UI Page View (641 lines)
- **[src/renderer/src/pages/Utilities/Utilities.tsx](src/renderer/src/pages/Utilities/Utilities.tsx.md)**: Renderer UI Page View (1492 lines) — Exports: `Utilities` [Hooks: useCallback, useEffect, useMemo]
- **[src/renderer/src/pages/VideoTransfer/VideoTransfer.css](src/renderer/src/pages/VideoTransfer/VideoTransfer.css.md)**: Renderer UI Page View (727 lines)
- **[src/renderer/src/pages/VideoTransfer/VideoTransfer.tsx](src/renderer/src/pages/VideoTransfer/VideoTransfer.tsx.md)**: Renderer UI Page View (1034 lines) — Exports: `VideoTransfer` [Hooks: useEffect, useSound, useState]
- **[src/renderer/src/stores/prprojStore.ts](src/renderer/src/stores/prprojStore.ts.md)**: Global State Store (Zustand / Event Emitter) (136 lines) — Exports: `prprojStore`, `usePrprojStore` [Hooks: useEffect, usePrprojStore, useState]
- **[src/renderer/src/stores/titleAdderStore.ts](src/renderer/src/stores/titleAdderStore.ts.md)**: Global State Store (Zustand / Event Emitter) (341 lines) — Exports: `titleAdderStore`, `useTitleAdderStore` [Hooks: useEffect, useState, useTitleAdderStore]
- **[src/renderer/src/styles/animations.css](src/renderer/src/styles/animations.css.md)**: Design Tokens & Stylesheet (325 lines)
- **[src/renderer/src/styles/global.css](src/renderer/src/styles/global.css.md)**: Design Tokens & Stylesheet (837 lines)
- **[src/renderer/src/styles/tokens.css](src/renderer/src/styles/tokens.css.md)**: Design Tokens & Stylesheet (738 lines)
- **[src/renderer/src/theme/ThemeContext.tsx](src/renderer/src/theme/ThemeContext.tsx.md)**: Utility / Helper Module (307 lines) — Exports: `ThemeProvider`, `useTheme` [Hooks: useCallback, useContext, useEffect]
- **[src/renderer/src/types/index.ts](src/renderer/src/types/index.ts.md)**: Electron Main Process / Background Engine (510 lines) — Exports: `PAGE_META`, `NAV_ORDER`
- **[src/renderer/src/utils/cityUtils.ts](src/renderer/src/utils/cityUtils.ts.md)**: Utility / Helper Module (154 lines) — Exports: `COMMON_CITIES`, `parseFolderName`, `detectCity`
- **[src/renderer/src/utils/dateUtils.ts](src/renderer/src/utils/dateUtils.ts.md)**: Utility / Helper Module (296 lines) — Exports: `HIJRI_MONTH_NAMES_SHORT`, `HIJRI_MONTH_NAMES_LONG`, `HIJRI_MONTH_NAMES_ARABIC`, `ARABIC_INDIC_DIGITS`
- **[src/renderer/src/utils/safarUtils.ts](src/renderer/src/utils/safarUtils.ts.md)**: Utility / Helper Module (666 lines) — Exports: `KNOWN_PREFIX_NAMES`, `PREDEFINED_PREFIX_COLORS`, `getPrefixColorTheme`, `formatPrefixName`
- **[src/renderer/src/vite-env.d.ts](src/renderer/src/vite-env.d.ts.md)**: Utility / Helper Module (1 lines)

### `tools/Converter_v3.py`

- **[tools/Converter_v3.py](tools/Converter_v3.py.md)**: Utility / Helper Module (154 lines) — Exports: `convert_cr3_to_jpg`, `App`, `__init__`, `build_ui`

### `tools/Converterv_2.py`

- **[tools/Converterv_2.py](tools/Converterv_2.py.md)**: Utility / Helper Module (134 lines) — Exports: `apply_tuning`, `find_optimal_settings`, `convert_cr3_to_jpg`

### `tools/merge_inventory_reports.py`

- **[tools/merge_inventory_reports.py](tools/merge_inventory_reports.py.md)**: Utility / Helper Module (283 lines) — Exports: `merge_inventory_reports`, `extract_fs_cols`, `extract_cs_cols`
