import { contextBridge, ipcRenderer, webUtils } from 'electron'

// ── Typed window.api exposed to React renderer ───────────────
contextBridge.exposeInMainWorld('api', {
  // WebUtils for bulletproof File paths in Electron 30+
  webUtils: {
    getPathForFile: (file: File) => {
      try {
        return webUtils.getPathForFile(file)
      } catch {
        return (file as any)?.path || ''
      }
    }
  },
  // Settings
  settings: {
    get:               (key: string, def?: unknown) => ipcRenderer.invoke('settings:get', key, def),
    set:               (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    setAndSave:        (key: string, value: unknown) => ipcRenderer.invoke('settings:setAndSave', key, value),
    getAll:            () => ipcRenderer.invoke('settings:getAll'),
    needsSetup:        () => ipcRenderer.invoke('settings:needsSetup'),
    completeSetup:     (folder: string) => ipcRenderer.invoke('settings:completeSetup', folder),
    changeFolder:      (folder: string) => ipcRenderer.invoke('settings:changeFolder', folder),
    setFilePath:       (filePath: string) => ipcRenderer.invoke('settings:setFilePath', filePath),
    filePath:          () => ipcRenderer.invoke('settings:filePath'),
    folder:            () => ipcRenderer.invoke('settings:folder'),
    openExcel:         () => ipcRenderer.invoke('settings:openExcel'),
    generateExcel:     (records: any[], targetFilePath: string) => ipcRenderer.invoke('settings:generateExcel', records, targetFilePath),
    resetSection:      (keys: string[]) => ipcRenderer.invoke('settings:resetSection', keys),
    resetAll:          () => ipcRenderer.invoke('settings:resetAll'),
    isConfirmDisabled: (id: string) => ipcRenderer.invoke('settings:isConfirmDisabled', id),
    disableConfirm:    (id: string) => ipcRenderer.invoke('settings:disableConfirm', id),
    submitGrievance:   (url: string, data: object) => ipcRenderer.invoke('settings:submitGrievance', url, data),
  },

  // Audio Engine
  audio: {
    getPool:                  () => ipcRenderer.invoke('audio:getPool'),
    validatePrefixes:         () => ipcRenderer.invoke('audio:validatePrefixes'),
    addToLibrary:             (src: string) => ipcRenderer.invoke('audio:addToLibrary', src),
    addInstrumentalToLibrary: (src: string) => ipcRenderer.invoke('audio:addInstrumentalToLibrary', src),
    describeMode:             () => ipcRenderer.invoke('audio:describeMode'),
    poolInfo:                 () => ipcRenderer.invoke('audio:poolInfo'),
  },


  // Dialogs
  dialog: {
    openFolder:  (opts?: object) => ipcRenderer.invoke('dialog:openFolder', opts),
    openFolders: (opts?: object) => ipcRenderer.invoke('dialog:openFolders', opts),
    openFile:    (opts?: object) => ipcRenderer.invoke('dialog:openFile', opts),
    openFiles:   (opts?: object) => ipcRenderer.invoke('dialog:openFiles', opts),
    saveFile:    (opts?: object) => ipcRenderer.invoke('dialog:saveFile', opts),
    writeTextFile: (params: { filePath: string; content: string }) =>
      ipcRenderer.invoke('dialog:writeTextFile', params),
  },
  shell: {
    openFolder: (p: string) => ipcRenderer.invoke('shell:openFolder', p),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },


  // FFmpeg check
  ffmpeg: {
    check: () => ipcRenderer.invoke('ffmpeg:check'),
  },

  // Title Adder
  titleAdder: {
    previewAudioAssignments: (params: object) => ipcRenderer.invoke('titleAdder:previewAudioAssignments', params),
    start: (params: object) => ipcRenderer.invoke('titleAdder:start', params),
    cancel: (jobId: string) => ipcRenderer.send(`titleAdder:cancel:${jobId}`),
    validatePath: (targetPath: string) => ipcRenderer.invoke('titleAdder:validatePath', targetPath),
    onProgress: (cb: (d: unknown) => void) => {
      const sub = (_e, d): void => cb(d)
      ipcRenderer.on('titleAdder:progress', sub)
      return () => ipcRenderer.removeListener('titleAdder:progress', sub)
    },
    onLog: (cb: (d: unknown) => void) => {
      const sub = (_e, d): void => cb(d)
      ipcRenderer.on('titleAdder:log', sub)
      return () => ipcRenderer.removeListener('titleAdder:log', sub)
    },
    onDone: (cb: (d: unknown) => void) => {
      const sub = (_e, d): void => cb(d)
      ipcRenderer.on('titleAdder:done', sub)
      return () => ipcRenderer.removeListener('titleAdder:done', sub)
    },
    onFound: (cb: (d: unknown) => void) => {
      const sub = (_e, d): void => cb(d)
      ipcRenderer.on('titleAdder:found', sub)
      return () => ipcRenderer.removeListener('titleAdder:found', sub)
    },
    onVideosDone: (cb: (d: any) => void) => {
      const sub = (_e, d): void => cb(d)
      ipcRenderer.on('titleAdder:videosDone', sub)
      return () => ipcRenderer.removeListener('titleAdder:videosDone', sub)
    },
    onVideoFinished: (cb: (d: any) => void) => {
      const sub = (_e, d): void => cb(d)
      ipcRenderer.on('titleAdder:videoFinished', sub)
      return () => ipcRenderer.removeListener('titleAdder:videoFinished', sub)
    },
    scanStats: (rootPath: string) => ipcRenderer.invoke('titleAdder:scanStats', rootPath),
    removeVideoFinishedListener: () => {
      ipcRenderer.removeAllListeners('titleAdder:videoFinished')
    },
    removeListeners: () => {
      ['titleAdder:progress', 'titleAdder:log', 'titleAdder:done',
       'titleAdder:found', 'titleAdder:videosDone', 'titleAdder:videoFinished', 'titleAdder:setBatchSource'].forEach(ch => ipcRenderer.removeAllListeners(ch))
    },
    listVideos: (folder: string) => ipcRenderer.invoke('titleAdder:listVideos', folder),
    cleanupTempFiles: (folder: string) => ipcRenderer.invoke('titleAdder:cleanupTempFiles', folder),
    renameFiles: (params: { renames: Array<{ originalPath: string; newName: string }> }) => ipcRenderer.invoke('titleAdder:renameFiles', params),
    getAvailablePrefixes: () => ipcRenderer.invoke('titleAdder:getAvailablePrefixes'),
    resolveSafarFinalPath: (videoPath: string) => ipcRenderer.invoke('titleAdder:resolveSafarFinalPath', videoPath),
    getFinalTitles: (customPath?: string) => ipcRenderer.invoke('titleAdder:getFinalTitles', customPath),
    setFinalTitlesFolder: (folderPath: string) => ipcRenderer.invoke('titleAdder:setFinalTitlesFolder', folderPath),
    openFinalTitlesFolder: (customPath?: string) => ipcRenderer.invoke('titleAdder:openFinalTitlesFolder', customPath),
    showFileInFolder: (filePath: string) => ipcRenderer.invoke('titleAdder:showFileInFolder', filePath),
    onSetBatchSource: (cb: (d: string) => void) => {
      const sub = (_e: any, d: string): void => cb(d)
      ipcRenderer.on('titleAdder:setBatchSource', sub)
      return () => ipcRenderer.removeListener('titleAdder:setBatchSource', sub)
    }
  },

  // Converter
  converter: {
    convert:   (params: object) => ipcRenderer.invoke('converter:convert', params),
    rename:    (params: object) => ipcRenderer.invoke('converter:rename', params),
    undoRename: () => ipcRenderer.invoke('converter:undoRename'),
    canUndo:   () => ipcRenderer.invoke('converter:canUndo'),
    listFiles: (params: object) => ipcRenderer.invoke('converter:listFiles', params),
    onProgress: (cb: (d: unknown) => void) => ipcRenderer.on('converter:progress', (_e, d) => cb(d)),
    removeListeners: () => ipcRenderer.removeAllListeners('converter:progress'),
  },

  // Drive Sync
  driveSync: {
    start:  (params: object) => ipcRenderer.invoke('driveSync:start', params),
    cancel: () => ipcRenderer.invoke('driveSync:cancel'),
    exportExcel: (data?: object) => ipcRenderer.invoke('driveSync:exportExcel', data),
    exportPdf:   (data?: object) => ipcRenderer.invoke('driveSync:exportPdf', data),
    exportBoth:  (data?: object) => ipcRenderer.invoke('driveSync:exportBoth', data),
    getDriveCandidates: () => ipcRenderer.invoke('driveSync:getDriveCandidates'),
    reconcileDrives: (params?: { workingDrive?: string; backupDrive?: string; notifyOnMismatch?: boolean }) =>
      ipcRenderer.invoke('driveSync:reconcileDrives', params),
    getDaemonStatus: () => ipcRenderer.invoke('driveSync:getDaemonStatus'),
    toggleDaemon: (active?: boolean) => ipcRenderer.invoke('driveSync:toggleDaemon', active),
    scanDaemonNow: () => ipcRenderer.invoke('driveSync:scanDaemonNow'),
    onDaemonUpdate: (cb: (d: unknown) => void) => {
      const sub = (_e: any, d: unknown): void => cb(d)
      ipcRenderer.on('driveSync:daemonUpdate', sub)
      return () => ipcRenderer.removeListener('driveSync:daemonUpdate', sub)
    },
    onProgress: (cb: (d: unknown) => void) => ipcRenderer.on('driveSync:progress', (_e, d) => cb(d)),
    onDone:     (cb: (d: unknown) => void) => ipcRenderer.on('driveSync:done',     (_e, d) => cb(d)),
    onFound:    (cb: (d: unknown) => void) => ipcRenderer.on('driveSync:found',    (_e, d) => cb(d)),
    onLog:      (cb: (d: unknown) => void) => ipcRenderer.on('driveSync:log',      (_e, d) => cb(d)),
    onStatus:   (cb: (d: unknown) => void) => ipcRenderer.on('driveSync:status',   (_e, d) => cb(d)),
    removeListeners: () => {
      ['driveSync:progress','driveSync:done','driveSync:found','driveSync:log','driveSync:status','driveSync:daemonUpdate']
        .forEach(ch => ipcRenderer.removeAllListeners(ch))
    }
  },

  // Folder Maker
  folderMaker: {
    create:       (params: object) => ipcRenderer.invoke('folderMaker:create', params),
    getPresets:   () => ipcRenderer.invoke('folderMaker:getPresets'),
    savePreset:   (preset: object) => ipcRenderer.invoke('folderMaker:savePreset', preset),
    deletePreset: (name: string) => ipcRenderer.invoke('folderMaker:deletePreset', name),
  },

  // Task Tracker
  taskTracker: {
    scan:                  (input: any) => ipcRenderer.invoke('taskTracker:scan', input),
    autoDetectDriveFolders:(driveRoot: string) => ipcRenderer.invoke('taskTracker:autoDetectDriveFolders', driveRoot),
    createDriveFolders:    (folders: string[], safarName?: string) => ipcRenderer.invoke('taskTracker:createDriveFolders', folders, safarName),
    createFullSafarStructure: (params: { safarName: string; workspaces: any[] }) => ipcRenderer.invoke('taskTracker:createFullSafarStructure', params),
    startWatch:            (input: any) => ipcRenderer.invoke('taskTracker:startWatch', input),
    stopWatch:             () => ipcRenderer.invoke('taskTracker:stopWatch'),
    openPath:              (targetPath: string) => ipcRenderer.invoke('taskTracker:openPath', targetPath),
    showInFolder:          (targetPath: string) => ipcRenderer.invoke('taskTracker:showInFolder', targetPath),
    getHistory:            (filter?: { safarName?: string; dateFolder?: string }) => ipcRenderer.invoke('taskTracker:getHistory', filter),
    setManualStatus:       (payload: { safarNames?: string[]; taskKeys?: { safarName: string; dateFolder: string }[]; status: 'uploaded' | 'submitted' | 'auto' }) => ipcRenderer.invoke('taskTracker:setManualStatus', payload),
    exportExcel:           (payload: any) => ipcRenderer.invoke('taskTracker:exportExcel', payload),
    searchAssets:          (filter?: any) => ipcRenderer.invoke('taskTracker:searchAssets', filter),
    getAssetStats:         () => ipcRenderer.invoke('taskTracker:getAssetStats'),
    indexCustomDirectory:  (targetDir?: string) => ipcRenderer.invoke('taskTracker:indexCustomDirectory', targetDir),
    locateFile:            (targetPath: string) => ipcRenderer.invoke('taskTracker:locateFile', targetPath),
    openFolder:            (targetPath: string) => ipcRenderer.invoke('taskTracker:openFolder', targetPath),
    renameSafar:           (params: { oldSafar: string; newSafar: string; city?: string; year?: number; serial?: string }) =>
      ipcRenderer.invoke('taskTracker:renameSafar', params),
    moveSafar:             (params: { safarName: string; currentPath: string; targetFolder: string; customTargetPath?: string; workspaces?: any[] }) =>
      ipcRenderer.invoke('taskTracker:moveSafar', params),
    onChanged:             (cb: () => void) => {
      const sub = (): void => cb()
      ipcRenderer.on('taskTracker:changed', sub)
      return () => ipcRenderer.removeListener('taskTracker:changed', sub)
    },
    onDrivesChanged:       (cb: (d: { connected: string[]; newlyConnected: string[] }) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('taskTracker:drives-changed', sub)
      return () => ipcRenderer.removeListener('taskTracker:drives-changed', sub)
    }
  },

  // System
  system: {
    notify:        (opts: { title: string; body: string }) => ipcRenderer.invoke('system:notify', opts),
    getStats:      () => ipcRenderer.invoke('system:getStats'),
    getEncoder:    () => ipcRenderer.invoke('system:getEncoder'),
    getDrives:     () => ipcRenderer.invoke('system:getDrives'),
    getDriveSpace: (drivePath?: string) => ipcRenderer.invoke('system:getDriveSpace', drivePath),
    getAutoLaunch: () => ipcRenderer.invoke('system:getAutoLaunch'),
    setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('system:setAutoLaunch', enabled),
    getLaunchInfo: () => ipcRenderer.invoke('system:getLaunchInfo'),
    onAmeRenderComplete: (cb: (data: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('ame:render-complete', sub)
      return () => ipcRenderer.removeListener('ame:render-complete', sub)
    },
    onNavigate: (cb: (page: string) => void) => {
      const sub = (_e: any, page: string): void => cb(page)
      ipcRenderer.on('app:navigate', sub)
      return () => ipcRenderer.removeListener('app:navigate', sub)
    }
  },

  // Updates
  update: {
    check:              (preferredSource?: 'anything' | 'github' | 'all') => ipcRenderer.invoke('update:check', preferredSource),
    download:           (url?: string) => ipcRenderer.invoke('update:download', url),
    install:            () => ipcRenderer.invoke('update:install'),
    getCurrentVersion:  () => ipcRenderer.invoke('update:getCurrentVersion'),
    getUpdateConfig:    () => ipcRenderer.invoke('update:getUpdateConfig'),
    onProgress:         (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('update:progress', sub)
      return () => ipcRenderer.removeListener('update:progress', sub)
    },
    onUpdateAvailable:  (cb: (manifest: any) => void) => {
      const sub = (_e: any, manifest: any): void => cb(manifest)
      ipcRenderer.on('update:available', sub)
      return () => ipcRenderer.removeListener('update:available', sub)
    },
    removeListeners:    () => {
      ['update:progress', 'update:available'].forEach(ch => ipcRenderer.removeAllListeners(ch))
    }
  },

  // Global Window Zoom Event bindings
  zoom: {
    onZoomIn: (cb: () => void) => {
      const sub = (): void => cb()
      ipcRenderer.on('app:zoom-in', sub)
      return () => ipcRenderer.removeListener('app:zoom-in', sub)
    },
    onZoomOut: (cb: () => void) => {
      const sub = (): void => cb()
      ipcRenderer.on('app:zoom-out', sub)
      return () => ipcRenderer.removeListener('app:zoom-out', sub)
    },
    onZoomReset: (cb: () => void) => {
      const sub = (): void => cb()
      ipcRenderer.on('app:zoom-reset', sub)
      return () => ipcRenderer.removeListener('app:zoom-reset', sub)
    }
  },

  // PDF Document Processor
  pdf: {
    merge: (params: { filePaths: string[]; outputPath: string }) => ipcRenderer.invoke('pdf:merge', params),
    split: (params: { filePath: string; outputFolder: string; splitMode: 'single' | 'ranges'; ranges?: string }) => ipcRenderer.invoke('pdf:split', params),
    watermark: (params: { filePath: string; outputPath: string; text: string; opacity?: number }) => ipcRenderer.invoke('pdf:watermark', params),
    protect: (params: { filePath: string; outputPath: string; userPassword?: string; ownerPassword?: string }) => ipcRenderer.invoke('pdf:protect', params),
    decrypt: (params: { filePath: string; outputPath: string; password?: string }) => ipcRenderer.invoke('pdf:decrypt', params),
    metadata: (params: { filePath: string; outputPath: string; title?: string; author?: string; subject?: string; keywords?: string }) => ipcRenderer.invoke('pdf:metadata', params),
    fromHtml: (params: { html: string; outputPath: string }) => ipcRenderer.invoke('pdf:from-html', params),
    fromImages: (params: { imagePaths: string[]; outputPath: string }) => ipcRenderer.invoke('pdf:from-images', params),
    convertToTextFile: (params: { filePath: string; outputPath: string; format: 'txt' | 'doc' | 'csv' }) => ipcRenderer.invoke('pdf:convert-to-text-file', params),
    moveFile: (params: { srcPath: string; destPath: string }) => ipcRenderer.invoke('pdf:move-file', params),
    simulateTool: (params: { filePath: string; outputPath: string }) => ipcRenderer.invoke('pdf:simulate-tool', params),
    writeFile: (params: { base64: string; outputPath: string }) => ipcRenderer.invoke('pdf:write-file', params),
  },
  watcher: {
    onConverted: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('watcher:converted', sub)
      return () => ipcRenderer.removeListener('watcher:converted', sub)
    },
    removeListeners: () => ipcRenderer.removeAllListeners('watcher:converted')
  },

  // Title Automode & Predefine System
  titleAutomode: {
    scanVideos: (dvdPath: string) => ipcRenderer.invoke('titleAutomode:scanVideos', dvdPath),
    getSettings: () => ipcRenderer.invoke('titleAutomode:getSettings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('titleAutomode:saveSettings', settings),
    onTriggered: (callback: (data: { dvdPath: string; autoStart?: boolean; expectedVideos?: string[]; [key: string]: any }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('titleAutomode:triggered', handler)
      return () => ipcRenderer.removeListener('titleAutomode:triggered', handler)
    },
    onAmeRenderComplete: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('ame:render-complete', handler)
      return () => ipcRenderer.removeListener('ame:render-complete', handler)
    },
    onNavigate: (callback: (page: string) => void) => {
      const handler = (_: any, page: string) => callback(page)
      ipcRenderer.on('app:navigate', handler)
      return () => ipcRenderer.removeListener('app:navigate', handler)
    }
  },

  // Premiere Pro Project & XML Sequence Generator
  prproj: {
    getTemplateStatus: () => ipcRenderer.invoke('prproj:getTemplateStatus'),
    scanSubfolders: (params: any) => ipcRenderer.invoke('prproj:scanSubfolders', params),
    scan: (params: any) => ipcRenderer.invoke('prproj:scan', params),
    generate: (params: any) => ipcRenderer.invoke('prproj:generate', params),
    onProgress: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('prproj:progress', sub)
      return () => ipcRenderer.removeListener('prproj:progress', sub)
    },
    removeListeners: () => ipcRenderer.removeAllListeners('prproj:progress')
  },

  // Universal File Viewer
  viewer: {
    readRaw:                (filePath: string) => ipcRenderer.invoke('viewer:readRaw', filePath),
    readFileBase64:         (filePath: string) => ipcRenderer.invoke('viewer:readFileBase64', filePath),
    readPdfBase64:          (filePath: string) => ipcRenderer.invoke('viewer:readPdfBase64', filePath),
    readText:               (filePath: string) => ipcRenderer.invoke('viewer:readText', filePath),
    getFileInfo:            (filePath: string) => ipcRenderer.invoke('viewer:getFileInfo', filePath),
    isRaw:                  (ext: string)      => ipcRenderer.invoke('viewer:isRaw', ext),
    getThumbnail:           (filePath: string, size?: number) => ipcRenderer.invoke('viewer:getThumbnail', filePath, size),
    pregenThumbnails:       (filePaths: string[], size?: number) => ipcRenderer.invoke('viewer:pregenThumbnails', filePaths, size),
    checkRawCodec:          () => ipcRenderer.invoke('viewer:checkRawCodec'),
    findFfmpeg:             () => ipcRenderer.invoke('viewer:findFfmpeg'),
    getVideoThumbnail:      (filePath: string, ffmpegPath: string, size?: number, seekPercent?: number) =>
      ipcRenderer.invoke('viewer:getVideoThumbnail', filePath, ffmpegPath, size, seekPercent),
    getSiblingFiles:        (filePath: string) => ipcRenderer.invoke('viewer:getSiblingFiles', filePath),
    registerFileAssociation:(categories: string[]) => ipcRenderer.invoke('viewer:registerFileAssociation', categories),
    getDefaultApps:         (exts: string[]) => ipcRenderer.invoke('viewer:getDefaultApps', exts),
    onOpenFile: (cb: (filePath: string) => void) => {
      const sub = (_e: any, filePath: string): void => cb(filePath)
      ipcRenderer.on('viewer:openFile', sub)
      return () => ipcRenderer.removeListener('viewer:openFile', sub)
    },
    removeListeners: () => ipcRenderer.removeAllListeners('viewer:openFile')
  },

  // Camera Transfer
  cameraTransfer: {
    copy: (params: object) => ipcRenderer.invoke('cameraTransfer:copy', params),
    cancel: (jobId: string) => ipcRenderer.send('cameraTransfer:cancel', jobId),
    getPresets: () => ipcRenderer.invoke('cameraTransfer:getPresets'),
    savePreset: (preset: object) => ipcRenderer.invoke('cameraTransfer:savePreset', preset),
    deletePreset: (name: string) => ipcRenderer.invoke('cameraTransfer:deletePreset', name),
    getCameras: () => ipcRenderer.invoke('cameraTransfer:getCameras'),
    saveCameras: (cameras: string[]) => ipcRenderer.invoke('cameraTransfer:saveCameras', cameras),
    scanFolder: (folderPath: string) => ipcRenderer.invoke('cameraTransfer:scanFolder', folderPath),
    onProgress: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('cameraTransfer:progress', sub)
      return () => ipcRenderer.removeListener('cameraTransfer:progress', sub)
    },
    onLog: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('cameraTransfer:log', sub)
      return () => ipcRenderer.removeListener('cameraTransfer:log', sub)
    },
    onDone: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('cameraTransfer:done', sub)
      return () => ipcRenderer.removeListener('cameraTransfer:done', sub)
    },
    onFound: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('cameraTransfer:found', sub)
      return () => ipcRenderer.removeListener('cameraTransfer:found', sub)
    },
    onFileDone: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('cameraTransfer:fileDone', sub)
      return () => ipcRenderer.removeListener('cameraTransfer:fileDone', sub)
    },
    removeListeners: () => {
      ['cameraTransfer:progress', 'cameraTransfer:log', 'cameraTransfer:done', 'cameraTransfer:found', 'cameraTransfer:fileDone'].forEach(ch => ipcRenderer.removeAllListeners(ch))
    }
  },

  // Video & Photo Match Transfer
  videoTransfer: {
    scanFolder: (params: any) => ipcRenderer.invoke('videoTransfer:scanFolder', params),
    checkDryRun: (items: any[]) => ipcRenderer.invoke('videoTransfer:checkDryRun', items),
    executeTransfer: (payload: any) => ipcRenderer.invoke('videoTransfer:executeTransfer', payload),
    undoTransfer: (items: any[]) => ipcRenderer.invoke('videoTransfer:undoTransfer', items),
    onProgress: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('videoTransfer:progress', sub)
      return () => ipcRenderer.removeListener('videoTransfer:progress', sub)
    },
    removeListeners: () => ipcRenderer.removeAllListeners('videoTransfer:progress')
  },

  // Ultra-Fast Photo Data Separator & Extractor
  pvSeparator: {
    scanFolder: (sourceDir: string) => ipcRenderer.invoke('pvSeparator:scanFolder', sourceDir),
    startProcessing: (payload: { sourceDir: string; destDir: string; action: 'copy' | 'move' }) => ipcRenderer.invoke('pvSeparator:startProcessing', payload),
    onProgress: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('pvSeparator:progress', sub)
      return () => ipcRenderer.removeListener('pvSeparator:progress', sub)
    },
    removeListeners: () => ipcRenderer.removeAllListeners('pvSeparator:progress')
  },

  // Excel Inventory Report Merger
  inventoryMerger: {
    merge: (params: { file1: string; file2: string; outputPath?: string }) => ipcRenderer.invoke('inventoryMerger:merge', params)
  },

  // SQLite Stats Database
  statsDb: {
    getAll: () => ipcRenderer.invoke('statsDb:getAll'),
    insertRecords: (records: any[]) => ipcRenderer.invoke('statsDb:insertRecords', records),
    reassignSafar: (params: { fromSafar: string; toSafar?: string }) => ipcRenderer.invoke('statsDb:reassignSafar', params),
    deleteSafar: (params: { safar: string }) => ipcRenderer.invoke('statsDb:deleteSafar', params),
    deleteFolder: (params: { folder: string }) => ipcRenderer.invoke('statsDb:deleteFolder', params),
    renameSafar: (params: { fromSafar: string; toSafar: string; newSerial?: string; newYear?: number; newCity?: string }) =>
      ipcRenderer.invoke('statsDb:renameSafar', params),
    syncOldData: (params: { safarDir?: string; mainDir?: string; finalDir?: string }) =>
      ipcRenderer.invoke('statsDb:syncOldData', params),
    onUpdated: (cb: (records: any[]) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('stats-db-updated', sub)
      return () => ipcRenderer.removeListener('stats-db-updated', sub)
    }
  },

  // Virtual Archive Vault & Smart Excel Reconciler
  archiveCatalog: {
    startScan: (params: { folderPath: string; driveLabel?: string; driveLocation?: string }) =>
      ipcRenderer.invoke('archive:startScan', params),
    cancelScan: () => ipcRenderer.invoke('archive:cancelScan'),
    listSafars: () => ipcRenderer.invoke('archive:listSafars'),
    getSummary: (archiveId: number) => ipcRenderer.invoke('archive:getSummary', archiveId),
    search: (filter: {
      query?: string
      archiveId?: number
      mediaType?: string
      eventCode?: string
      searchTarget?: 'all' | 'file' | 'folder'
      minDuration?: number
      maxDuration?: number
      limit?: number
      offset?: number
    }) => ipcRenderer.invoke('archive:search', filter),
    detectGaps: (archiveId: number) => ipcRenderer.invoke('archive:detectGaps', archiveId),
    deleteSafar: (archiveId: number) => ipcRenderer.invoke('archive:deleteSafar', archiveId),
    deleteItem: (itemIdOrParams: number | { id: number; mediaType?: string }) =>
      ipcRenderer.invoke('archive:deleteItem', itemIdOrParams),
    listDrives: () => ipcRenderer.invoke('archive:listDrives'),
    saveDrive: (drive: { label: string; location?: string; notes?: string }) =>
      ipcRenderer.invoke('archive:saveDrive', drive),
    reconcileExcel: (params: {
      excelPath: string
      archiveId: number
      sheetName?: string
      colDate?: string
      colFolder?: string
      colFile?: string
      exportPath?: string
      dateFilter?: string
      dateFrom?: string
      dateTo?: string
    }) => ipcRenderer.invoke('archive:reconcileExcel', params),
    generateSafarExcel: (params: {
      archiveId: number
      defaultName?: string
      folderPath?: string
      dateFilter?: string
      dateFrom?: string
      dateTo?: string
    }) => ipcRenderer.invoke('archive:generateSafarExcel', params),
    generateExternalFolderExcel: (params: {
      folderPath: string
      defaultName?: string
      dateFilter?: string
      dateFrom?: string
      dateTo?: string
    }) => ipcRenderer.invoke('archive:generateExternalFolderExcel', params),
    generateTemplateExcel: () => ipcRenderer.invoke('archive:generateTemplateExcel'),
    listFolders: (archiveId: number) => ipcRenderer.invoke('archive:listFolders', archiveId),
    listDates: (archiveId: number) => ipcRenderer.invoke('archive:listDates', archiveId),
    getSafarDaysBreakdown: (archiveId: number) => ipcRenderer.invoke('archive:getSafarDaysBreakdown', archiveId),
    locateFile: (filePath: string) => ipcRenderer.invoke('archive:locateFile', filePath),
    checkPathExists: (targetPath: string) => ipcRenderer.invoke('archive:checkPathExists', targetPath),
    optimizeDb: () => ipcRenderer.invoke('archive:optimizeDb'),
    checkUploadStatus: (params?: { uploadDirs?: string[]; deleteDirs?: string[]; archiveId?: number }) =>
      ipcRenderer.invoke('archive:checkUploadStatus', params),
    syncTrackerStatus: (params?: { archiveId?: number }) =>
      ipcRenderer.invoke('archive:syncTrackerStatus', params),
    setUploadStatus: (params: { itemId: number; status: string }) =>
      ipcRenderer.invoke('archive:setUploadStatus', params),
    renameSafar: (params: { archiveId?: number; safarName?: string; newName?: string; city?: string; year?: number; serial?: string; driveLabel?: string; driveLetter?: string; rootPath?: string }) =>
      ipcRenderer.invoke('archive:renameSafar', params),
    updateSafarDrive: (params: { archiveId: number; driveLabel?: string; driveLetter?: string; rootPath?: string }) =>
      ipcRenderer.invoke('archive:updateSafarDrive', params),
    exportSafarPdf: (params: { archiveId?: number; defaultName?: string; pdfData?: any }) =>
      ipcRenderer.invoke('archive:exportSafarPdf', params),
    chatQuery: (params: { query: string; archiveId?: number }) =>
      ipcRenderer.invoke('archive:chatQuery', params),
    exportQueryExcel: (params: { query: string; items: any[]; defaultName?: string }) =>
      ipcRenderer.invoke('archive:exportQueryExcel', params),
    onProgress: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('archive:scan-progress', sub)
      return () => ipcRenderer.removeListener('archive:scan-progress', sub)
    },
    onStatus: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('archive:scan-status', sub)
      return () => ipcRenderer.removeListener('archive:scan-status', sub)
    },
    onComplete: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('archive:scan-complete', sub)
      return () => ipcRenderer.removeListener('archive:scan-complete', sub)
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('archive:scan-progress')
      ipcRenderer.removeAllListeners('archive:scan-status')
      ipcRenderer.removeAllListeners('archive:scan-complete')
    },
    setupAutoWatcher: (dirs?: string[]) => ipcRenderer.invoke('archive:setupAutoWatcher', dirs),
    onCatalogUpdated: (cb: () => void) => {
      const sub = (): void => cb()
      ipcRenderer.on('archive:catalog-updated', sub)
      return () => ipcRenderer.removeListener('archive:catalog-updated', sub)
    }
  },

  // ── User Profile & Registration ──────────────────────────────────────────
  userProfile: {
    save: (profile: { name: string; email: string; avatarBase64?: string }) =>
      ipcRenderer.invoke('userProfile:save', profile),
    load: () =>
      ipcRenderer.invoke('userProfile:load'),
    registerToSheet: (params: { profile: any; scriptUrl: string }) =>
      ipcRenderer.invoke('userProfile:registerToSheet', params),
    fetchUserList: (scriptUrl: string) =>
      ipcRenderer.invoke('userProfile:fetchUserList', scriptUrl),
    sendBroadcast: (params: {
      scriptUrl?: string
      subject: string
      htmlBody: string
      recipients: Array<{ name: string; email: string }>
    }) => ipcRenderer.invoke('userProfile:sendBroadcast', params),
    setAdmin: (pin: string) =>
      ipcRenderer.invoke('userProfile:setAdmin', { pin }),
    resetAllSetup: () =>
      ipcRenderer.invoke('admin:resetAllSetup'),
    // ── Admin OTP Flow ────────────────────────────────────────────────────
    requestAdminOtp: (params: { webhookUrl: string; email: string; name?: string }) =>
      ipcRenderer.invoke('userProfile:requestAdminOtp', params),
    verifyAdminOtp: (params: { webhookUrl: string; email: string; otp: string }) =>
      ipcRenderer.invoke('userProfile:verifyAdminOtp', params),
    lockAdmin: () =>
      ipcRenderer.invoke('userProfile:lockAdmin'),
    checkIsAdmin: (params: { webhookUrl: string; email: string }) =>
      ipcRenderer.invoke('userProfile:checkIsAdmin', params),
    logout: () =>
      ipcRenderer.invoke('userProfile:logout'),
  },


  // ── Email Notifications (EmailJS — free, no SMTP needed) ────────────────
  email: {
    sendViaEmailJS: (params: {
      serviceId: string
      templateId: string
      publicKey: string
      templateParams: Record<string, string>
    }) => ipcRenderer.invoke('email:sendViaEmailJS', params),

    sendBulk: (params: {
      serviceId: string
      templateId: string
      publicKey: string
      recipients: Array<{ name: string; email: string }>
      templateParams: Record<string, string>
      delayMs?: number
    }) => ipcRenderer.invoke('email:sendBulk', params),
  },

  // ── Dynamic Island & Mini Rendering Monitor ─────────────────────────────
  island: {
    setSize: (width: number, height: number) => ipcRenderer.invoke('island:setSize', width, height),
    savePosition: (x: number, y: number) => ipcRenderer.invoke('island:savePosition', x, y),
    action: (action: string, payload?: any) => ipcRenderer.invoke('island:action', action, payload),
    close: () => ipcRenderer.invoke('island:close'),
    hide: () => ipcRenderer.invoke('island:hide'),
    preview: () => ipcRenderer.invoke('island:preview'),
    getState: () => ipcRenderer.invoke('island:getState'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('island:setEnabled', enabled),
    isEnabled: () => ipcRenderer.invoke('island:isEnabled'),
    onUpdate: (cb: (d: any) => void) => {
      const sub = (_e: any, d: any): void => cb(d)
      ipcRenderer.on('island:update', sub)
      return () => ipcRenderer.removeListener('island:update', sub)
    }
  }
})
