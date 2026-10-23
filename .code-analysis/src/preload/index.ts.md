# Detailed Analysis: `src/preload/index.ts`
> **Role**: Electron Main Process / Background Engine  
> **Metrics**: 609 lines · 32.8 KB · ~8,407 raw tokens → ~220 cached (97.4% saved)  
> **Last Analyzed**: 2026-10-15T00:38:41.766644  

---

## 1. Architectural Purpose & Summary
This file operates as part of the **Electron Main Process / Background Engine** layer. It is indexed in `.code-analysis/` to eliminate redundant raw file reading during AI reasoning and development sessions.

## 5. Electron IPC Channels
- Channel: `admin:resetAllSetup`
- Channel: `archive:cancelScan`
- Channel: `archive:chatQuery`
- Channel: `archive:checkPathExists`
- Channel: `archive:checkUploadStatus`
- Channel: `archive:deleteItem`
- Channel: `archive:deleteSafar`
- Channel: `archive:detectGaps`
- Channel: `archive:exportQueryExcel`
- Channel: `archive:exportSafarPdf`
- Channel: `archive:generateExternalFolderExcel`
- Channel: `archive:generateSafarExcel`
- Channel: `archive:generateTemplateExcel`
- Channel: `archive:getSafarDaysBreakdown`
- Channel: `archive:getSummary`
- Channel: `archive:listDates`
- Channel: `archive:listDrives`
- Channel: `archive:listFolders`
- Channel: `archive:listSafars`
- Channel: `archive:locateFile`
- Channel: `archive:optimizeDb`
- Channel: `archive:reconcileExcel`
- Channel: `archive:renameSafar`
- Channel: `archive:saveDrive`
- Channel: `archive:search`
- Channel: `archive:setUploadStatus`
- Channel: `archive:setupAutoWatcher`
- Channel: `archive:startScan`
- Channel: `archive:syncTrackerStatus`
- Channel: `archive:updateSafarDrive`
- Channel: `audio:addInstrumentalToLibrary`
- Channel: `audio:addToLibrary`
- Channel: `audio:describeMode`
- Channel: `audio:getPool`
- Channel: `audio:poolInfo`
- Channel: `audio:validatePrefixes`
- Channel: `cameraTransfer:cancel`
- Channel: `cameraTransfer:copy`
- Channel: `cameraTransfer:deletePreset`
- Channel: `cameraTransfer:getCameras`
- Channel: `cameraTransfer:getPresets`
- Channel: `cameraTransfer:saveCameras`
- Channel: `cameraTransfer:savePreset`
- Channel: `cameraTransfer:scanFolder`
- Channel: `converter:canUndo`
- Channel: `converter:convert`
- Channel: `converter:listFiles`
- Channel: `converter:rename`
- Channel: `converter:undoRename`
- Channel: `dialog:openFile`
- Channel: `dialog:openFiles`
- Channel: `dialog:openFolder`
- Channel: `dialog:openFolders`
- Channel: `dialog:saveFile`
- Channel: `dialog:writeTextFile`
- Channel: `driveSync:cancel`
- Channel: `driveSync:exportBoth`
- Channel: `driveSync:exportExcel`
- Channel: `driveSync:exportPdf`
- Channel: `driveSync:getDaemonStatus`
- Channel: `driveSync:getDriveCandidates`
- Channel: `driveSync:reconcileDrives`
- Channel: `driveSync:scanDaemonNow`
- Channel: `driveSync:start`
- Channel: `driveSync:toggleDaemon`
- Channel: `email:sendBulk`
- Channel: `email:sendViaEmailJS`
- Channel: `ffmpeg:check`
- Channel: `folderMaker:create`
- Channel: `folderMaker:deletePreset`
- Channel: `folderMaker:getPresets`
- Channel: `folderMaker:savePreset`
- Channel: `inventoryMerger:merge`
- Channel: `island:action`
- Channel: `island:close`
- Channel: `island:getState`
- Channel: `island:hide`
- Channel: `island:isEnabled`
- Channel: `island:preview`
- Channel: `island:savePosition`
- Channel: `island:setEnabled`
- Channel: `island:setSize`
- Channel: `pdf:convert-to-text-file`
- Channel: `pdf:decrypt`
- Channel: `pdf:from-html`
- Channel: `pdf:from-images`
- Channel: `pdf:merge`
- Channel: `pdf:metadata`
- Channel: `pdf:move-file`
- Channel: `pdf:protect`
- Channel: `pdf:simulate-tool`
- Channel: `pdf:split`
- Channel: `pdf:watermark`
- Channel: `pdf:write-file`
- Channel: `prproj:generate`
- Channel: `prproj:getTemplateStatus`
- Channel: `prproj:scan`
- Channel: `prproj:scanSubfolders`
- Channel: `pvSeparator:scanFolder`
- Channel: `pvSeparator:startProcessing`
- Channel: `settings:changeFolder`
- Channel: `settings:completeSetup`
- Channel: `settings:disableConfirm`
- Channel: `settings:filePath`
- Channel: `settings:folder`
- Channel: `settings:generateExcel`
- Channel: `settings:get`
- Channel: `settings:getAll`
- Channel: `settings:isConfirmDisabled`
- Channel: `settings:needsSetup`
- Channel: `settings:openExcel`
- Channel: `settings:resetAll`
- Channel: `settings:resetSection`
- Channel: `settings:set`
- Channel: `settings:setAndSave`
- Channel: `settings:setFilePath`
- Channel: `settings:submitGrievance`
- Channel: `shell:openExternal`
- Channel: `shell:openFolder`
- Channel: `statsDb:deleteFolder`
- Channel: `statsDb:deleteSafar`
- Channel: `statsDb:getAll`
- Channel: `statsDb:insertRecords`
- Channel: `statsDb:reassignSafar`
- Channel: `statsDb:renameSafar`
- Channel: `statsDb:syncOldData`
- Channel: `system:getAutoLaunch`
- Channel: `system:getDriveSpace`
- Channel: `system:getDrives`
- Channel: `system:getEncoder`
- Channel: `system:getStats`
- Channel: `system:notify`
- Channel: `system:setAutoLaunch`
- Channel: `taskTracker:autoDetectDriveFolders`
- Channel: `taskTracker:createDriveFolders`
- Channel: `taskTracker:createFullSafarStructure`
- Channel: `taskTracker:exportExcel`
- Channel: `taskTracker:getAssetStats`
- Channel: `taskTracker:getHistory`
- Channel: `taskTracker:indexCustomDirectory`
- Channel: `taskTracker:locateFile`
- Channel: `taskTracker:moveSafar`
- Channel: `taskTracker:openFolder`
- Channel: `taskTracker:openPath`
- Channel: `taskTracker:renameSafar`
- Channel: `taskTracker:scan`
- Channel: `taskTracker:searchAssets`
- Channel: `taskTracker:setManualStatus`
- Channel: `taskTracker:showInFolder`
- Channel: `taskTracker:startWatch`
- Channel: `taskTracker:stopWatch`
- Channel: `titleAdder:cleanupTempFiles`
- Channel: `titleAdder:getAvailablePrefixes`
- Channel: `titleAdder:listVideos`
- Channel: `titleAdder:previewAudioAssignments`
- Channel: `titleAdder:renameFiles`
- Channel: `titleAdder:resolveSafarFinalPath`
- Channel: `titleAdder:scanStats`
- Channel: `titleAdder:start`
- Channel: `titleAdder:validatePath`
- Channel: `titleAutomode:getSettings`
- Channel: `titleAutomode:saveSettings`
- Channel: `titleAutomode:scanVideos`
- Channel: `update:check`
- Channel: `update:download`
- Channel: `update:getCurrentVersion`
- Channel: `update:install`
- Channel: `userProfile:checkIsAdmin`
- Channel: `userProfile:fetchUserList`
- Channel: `userProfile:load`
- Channel: `userProfile:lockAdmin`
- Channel: `userProfile:logout`
- Channel: `userProfile:registerToSheet`
- Channel: `userProfile:requestAdminOtp`
- Channel: `userProfile:save`
- Channel: `userProfile:sendBroadcast`
- Channel: `userProfile:setAdmin`
- Channel: `userProfile:verifyAdminOtp`
- Channel: `videoTransfer:checkDryRun`
- Channel: `videoTransfer:executeTransfer`
- Channel: `videoTransfer:scanFolder`
- Channel: `videoTransfer:undoTransfer`
- Channel: `viewer:checkRawCodec`
- Channel: `viewer:findFfmpeg`
- Channel: `viewer:getDefaultApps`
- Channel: `viewer:getFileInfo`
- Channel: `viewer:getSiblingFiles`
- Channel: `viewer:getThumbnail`
- Channel: `viewer:getVideoThumbnail`
- Channel: `viewer:isRaw`
- Channel: `viewer:pregenThumbnails`
- Channel: `viewer:readFileBase64`
- Channel: `viewer:readPdfBase64`
- Channel: `viewer:readRaw`
- Channel: `viewer:readText`
- Channel: `viewer:registerFileAssociation`

## 6. Key Functions & Methods
| Line | Function Signature |
|:---:|:---|
| 75 | `sub(_e, d)` |
| 80 | `sub(_e, d)` |
| 85 | `sub(_e, d)` |
| 90 | `sub(_e, d)` |
| 95 | `sub(_e, d)` |
| 100 | `sub(_e, d)` |
| 118 | `sub(_e: any, d: string)` |
| 149 | `sub(_e: any, d: unknown)` |
| 195 | `sub()` |
| 200 | `sub(_e: any, d: any)` |
| 216 | `sub(_e: any, d: any)` |
| 229 | `sub(_e: any, d: any)` |
| 234 | `sub(_e: any, manifest: any)` |
| 246 | `sub()` |
| 251 | `sub()` |
| 256 | `sub()` |
| 279 | `sub(_e: any, d: any)` |
| 292 | `handler(_: any, data: any)` |
| 297 | `handler(_: any, data: any)` |
| 302 | `handler(_: any, page: string)` |
| 315 | `sub(_e: any, d: any)` |
| 340 | `sub(_e: any, filePath: string)` |
| 358 | `sub(_e: any, d: any)` |
| 363 | `sub(_e: any, d: any)` |
| 368 | `sub(_e: any, d: any)` |
| 373 | `sub(_e: any, d: any)` |
| 378 | `sub(_e: any, d: any)` |
| 394 | `sub(_e: any, d: any)` |
| 406 | `sub(_e: any, d: any)` |
| 430 | `sub(_e: any, d: any)` |

## 8. Dependencies & Module Linkages
- **External Packages**: `electron`

---
*Generated by UniDesk Studio Hierarchical Codebase Analysis Engine.*