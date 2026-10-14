/**
 * ====================================================================
 * UNIDESK & ZENINFOSYS - MATCH VIDEO & PHOTO TRANSFER
 * Google Apps Script Web App Backend (Code.gs)
 * Dual-Folder & Single Master Mode + Drive Folder Picker & Search API
 * Google Sheets Audit Report Logging (Optional)
 * ====================================================================
 */

/**
 * MASTER GOOGLE SHEET URL OR ID FOR AUDIT LOGGING
 * Paste your Master Google Sheet URL or ID here in the backend code!
 * All video transfer operations will automatically append audit logs to this sheet.
 */
var MASTER_AUDIT_SHEET_URL = "";

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('UniDesk - Video & Photo Match Transfer')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Extracts folder ID from Google Drive URL or raw ID string
 */
function extractFolderId(input) {
  if (!input) return null;
  var trimmed = input.trim();
  if (trimmed.indexOf('/folders/') !== -1) {
    var match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : trimmed;
  }
  return trimmed;
}

/**
 * Extracts Google Spreadsheet ID from URL or raw ID string
 */
function extractSheetId(input) {
  if (!input) return null;
  var trimmed = input.trim();
  if (trimmed.indexOf('/spreadsheets/d/') !== -1) {
    var match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : trimmed;
  }
  return trimmed;
}

/**
 * Normalizes string key for flexible matching
 */
function normalizeKey(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/[\s-_]+/g, ' ').trim();
}

/**
 * Parses sequence number, name, and prefix from file or folder name
 * e.g., "001 Q01.mp4" -> { sequence: "001", namePart: "Q01", prefix: "Q", cleanName: "001 Q01" }
 */
function parseSequenceName(rawName) {
  var nameWithoutExt = rawName.replace(/\.[^/.]+$/, "").trim();
  
  // Match sequence prefix pattern: e.g. "001 Q01", "001Q01", "002 Zo1", "001-Q01"
  var seqMatch = nameWithoutExt.match(/^(\d+)\s*[-_]?\s*([A-Za-z]+.*)$/);
  
  var sequence = "";
  var namePart = nameWithoutExt;
  var prefix = "";

  if (seqMatch) {
    sequence = seqMatch[1];
    namePart = seqMatch[2].trim();
  } else {
    var numOnly = nameWithoutExt.match(/\d+/);
    if (numOnly) sequence = numOnly[0];
  }

  var pfxMatch = namePart.match(/^([A-Za-z]+)/);
  if (pfxMatch) {
    prefix = pfxMatch[1].toUpperCase();
  }

  return {
    raw: rawName,
    cleanName: nameWithoutExt,
    sequence: sequence,
    namePart: namePart,
    prefix: prefix
  };
}

/**
 * Extracts the core shot/camera code ignoring leading sequence numbers
 * Matches desktop app logic: getShotCode("001 Z01.mp4") -> "z01", getShotCode("005 Z01") -> "z01"
 */
function getShotCode(rawName) {
  var nameWithoutExt = rawName.replace(/\.[^/.]+$/, "").trim();
  
  // Strip leading digits followed by separator and text (e.g. "001 Z01" -> "Z01", "005_Z01" -> "Z01")
  var leadingSeqMatch = nameWithoutExt.match(/^(\d+)[\s-_]+([A-Za-z0-9].*)$/);
  var coreName = nameWithoutExt;
  if (leadingSeqMatch && leadingSeqMatch[2]) {
    coreName = leadingSeqMatch[2].trim();
  }

  return coreName.toLowerCase().replace(/[\s-_]+/g, ' ').trim();
}

/**
 * Returns recent Google Drive folders for quick 1-tap selection
 */
function getUserRecentFolders() {
  try {
    var folders = [];
    var folderIter = DriveApp.getFolders();
    var count = 0;
    var maxResults = 15;

    while (folderIter.hasNext() && count < maxResults) {
      var folder = folderIter.next();
      folders.push({
        id: folder.getId(),
        name: folder.getName(),
        updated: folder.getLastUpdated() ? folder.getLastUpdated().toLocaleDateString() : ''
      });
      count++;
    }

    return { success: true, folders: folders };
  } catch (err) {
    return { success: false, error: err.toString(), folders: [] };
  }
}

/**
 * Searches Google Drive for folders matching a query string
 */
function searchFoldersByName(query) {
  if (!query || query.trim().length === 0) {
    return getUserRecentFolders();
  }
  
  try {
    var cleanQuery = query.trim().replace(/'/g, "\\'");
    var searchStr = "title contains '" + cleanQuery + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    var folderIter = DriveApp.searchFolders(searchStr);
    var folders = [];
    var count = 0;
    var maxResults = 20;

    while (folderIter.hasNext() && count < maxResults) {
      var folder = folderIter.next();
      folders.push({
        id: folder.getId(),
        name: folder.getName(),
        updated: folder.getLastUpdated() ? folder.getLastUpdated().toLocaleDateString() : ''
      });
      count++;
    }

    return { success: true, folders: folders };
  } catch (err) {
    return { success: false, error: err.toString(), folders: [] };
  }
}

/**
 * Fetches subfolders of a given folder ID (or Root if folderId is 'root' or empty) for modal browser
 */
function getFolderSubfolders(folderId) {
  try {
    var targetFolder;
    if (!folderId || folderId === 'root') {
      targetFolder = DriveApp.getRootFolder();
    } else {
      var cleanId = extractFolderId(folderId);
      targetFolder = DriveApp.getFolderById(cleanId);
    }

    var currentInfo = {
      id: targetFolder.getId(),
      name: targetFolder.getName()
    };

    var subfolders = [];
    var iter = targetFolder.getFolders();
    var count = 0;
    var maxCount = 50;

    while (iter.hasNext() && count < maxCount) {
      var sf = iter.next();
      subfolders.push({
        id: sf.getId(),
        name: sf.getName(),
        updated: sf.getLastUpdated() ? sf.getLastUpdated().toLocaleDateString() : ''
      });
      count++;
    }

    return {
      success: true,
      current: currentInfo,
      subfolders: subfolders
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Scans a Single Master Event Folder (which contains subfolder named 'Videos'/'Video' and subfolder named 'Photos'/'Photo')
 */
function scanSingleMasterFolder(masterFolderInput) {
  var mId = extractFolderId(masterFolderInput);
  if (!mId) return { success: false, error: "Please enter or select a valid Master Event Folder." };

  try {
    var masterFolder = DriveApp.getFolderById(mId);
    var vSub = null;
    var pSub = null;

    var iter = masterFolder.getFolders();
    while (iter.hasNext()) {
      var f = iter.next();
      var nameLower = f.getName().toLowerCase().trim();
      if (nameLower === 'video' || nameLower === 'videos' || nameLower === 'video clips' || nameLower === 'raw video' || nameLower === 'named videos') {
        vSub = f;
      } else if (nameLower === 'photo' || nameLower === 'photos' || nameLower === 'photo folders' || nameLower === 'raw photo' || nameLower === 'events') {
        pSub = f;
      }
    }

    if (vSub && pSub) {
      return scanTwoFolders(vSub.getId(), pSub.getId());
    } else {
      // Direct scan of master folder for both
      return scanTwoFolders(mId, mId);
    }
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Scans 2 main folders:
 * 1. Video Main Folder (contains Date subfolders with video clips)
 * 2. Photo Main Folder (contains Date subfolders with photo event folders)
 * Uses Shot Code matching (matching desktop app logic!)
 */
function scanTwoFolders(videoFolderInput, photoFolderInput) {
  var vId = extractFolderId(videoFolderInput);
  var pId = extractFolderId(photoFolderInput);

  if (!vId) return { success: false, error: "Please select a valid Video Folder." };
  if (!pId) return { success: false, error: "Please select a valid Photo Folder." };

  try {
    var videoMainFolder = DriveApp.getFolderById(vId);
    var photoMainFolder = DriveApp.getFolderById(pId);

    var videoMainName = videoMainFolder.getName();
    var photoMainName = photoMainFolder.getName();

    // Map date subfolders in Video main folder
    var vDateFolders = {};
    var vSubIter = videoMainFolder.getFolders();
    while (vSubIter.hasNext()) {
      var f = vSubIter.next();
      vDateFolders[f.getName().toLowerCase().trim()] = f;
    }

    // Map date subfolders in Photo main folder
    var pDateFolders = {};
    var pSubIter = photoMainFolder.getFolders();
    while (pSubIter.hasNext()) {
      var pf = pSubIter.next();
      pDateFolders[pf.getName().toLowerCase().trim()] = pf;
    }

    var matched = [];
    var unmatched = [];
    var dateFolderSummaries = [];
    var totalVideosScanned = 0;
    var totalPhotoFoldersScanned = 0;

    // Process matching date folders
    function processDatePair(vFolder, pFolder, dName) {
      var photoFolderList = [];
      
      // 1. Scan Photo Subfolders in Photo Date folder
      var pfIter = pFolder.getFolders();
      while (pfIter.hasNext()) {
        var subP = pfIter.next();
        var spName = subP.getName();
        var parsedPf = parseSequenceName(spName);
        var shotCode = getShotCode(spName);
        
        photoFolderList.push({
          folder: subP,
          id: subP.getId(),
          name: spName,
          parsed: parsedPf,
          shotCode: shotCode,
          isPaired: false
        });
        totalPhotoFoldersScanned++;
      }

      // 2. Scan Video Files in Video Date folder
      var videoExts = ['.mp4', '.mov', '.mkv', '.avi', '.mts', '.m2ts', '.mxf', '.wmv', '.flv', '.webm', '.m4v'];
      var fileIter = vFolder.getFiles();

      while (fileIter.hasNext()) {
        var file = fileIter.next();
        var fileName = file.getName();
        var extIndex = fileName.lastIndexOf('.');
        var ext = extIndex !== -1 ? fileName.substring(extIndex).toLowerCase() : '';

        if (videoExts.indexOf(ext) !== -1 || file.getMimeType().indexOf('video/') === 0) {
          totalVideosScanned++;
          var parsedVid = parseSequenceName(fileName);
          var vidShotCode = getShotCode(fileName);
          var vidNormKey = normalizeKey(parsedVid.cleanName);

          // Tier 1 Match: Core Shot Code match (e.g. "001 Z01.mp4" shot code "z01" matches "005 Z01" shot code "z01")
          var photoFolderMatch = null;
          for (var j = 0; j < photoFolderList.length; j++) {
            if (!photoFolderList[j].isPaired && photoFolderList[j].shotCode === vidShotCode) {
              photoFolderMatch = photoFolderList[j];
              break;
            }
          }

          // Tier 2 Match: Clean Name / Normalized Key match
          if (!photoFolderMatch) {
            for (var k = 0; k < photoFolderList.length; k++) {
              if (!photoFolderList[k].isPaired && normalizeKey(photoFolderList[k].parsed.cleanName) === vidNormKey) {
                photoFolderMatch = photoFolderList[k];
                break;
              }
            }
          }

          var fileSizeMb = Math.round((file.getSize() / (1024 * 1024)) * 10) / 10;

          if (photoFolderMatch) {
            matched.push({
              id: file.getId() + '_' + photoFolderMatch.id,
              videoId: file.getId(),
              videoName: fileName,
              photoFolderId: photoFolderMatch.id,
              photoFolderName: photoFolderMatch.name,
              dateFolderName: dName,
              sequence: parsedVid.sequence || photoFolderMatch.parsed.sequence,
              prefix: parsedVid.prefix || photoFolderMatch.parsed.prefix,
              namePart: parsedVid.namePart,
              fileSizeMb: fileSizeMb,
              status: 'APPROVED',
              isMatched: true
            });
            photoFolderMatch.isPaired = true;
          } else {
            unmatched.push({
              id: 'unmatched_' + file.getId(),
              videoId: file.getId(),
              videoName: fileName,
              photoFolderId: null,
              photoFolderName: null,
              dateFolderName: dName,
              sequence: parsedVid.sequence,
              prefix: parsedVid.prefix,
              namePart: parsedVid.namePart,
              fileSizeMb: fileSizeMb,
              reason: 'No matching photo folder found in Date folder "' + dName + '" for shot code "' + vidShotCode + '"',
              status: 'MISMATCH',
              isMatched: false
            });
          }
        }
      }

      // 3. Find Photo folders without matching videos
      for (var pIdx = 0; pIdx < photoFolderList.length; pIdx++) {
        var pfItem = photoFolderList[pIdx];
        if (!pfItem.isPaired) {
          unmatched.push({
            id: 'unmatched_pf_' + pfItem.id,
            videoId: null,
            videoName: null,
            photoFolderId: pfItem.id,
            photoFolderName: pfItem.name,
            dateFolderName: dName,
            sequence: pfItem.parsed.sequence,
            prefix: pfItem.parsed.prefix,
            namePart: pfItem.parsed.namePart,
            reason: 'Photo folder "' + pfItem.name + '" has no matching video clip',
            status: 'MISMATCH',
            isMatched: false
          });
        }
      }

      dateFolderSummaries.push({
        name: dName,
        videoCount: totalVideosScanned,
        photoFolderCount: photoFolderList.length
      });
    }

    // Pair Date folders by name or index
    var allDateNames = {};
    for (var k1 in vDateFolders) allDateNames[k1] = true;
    for (var k2 in pDateFolders) allDateNames[k2] = true;

    var dateKeys = Object.keys(allDateNames);

    if (dateKeys.length > 0) {
      for (var i = 0; i < dateKeys.length; i++) {
        var key = dateKeys[i];
        var vF = vDateFolders[key];
        var pF = pDateFolders[key];

        if (vF && pF) {
          processDatePair(vF, pF, vF.getName());
        } else if (vF) {
          var pKeys = Object.keys(pDateFolders);
          if (pKeys.length > i && pDateFolders[pKeys[i]]) {
            processDatePair(vF, pDateFolders[pKeys[i]], vF.getName());
          } else {
            processDatePair(vF, photoMainFolder, vF.getName());
          }
        } else if (pF) {
          processDatePair(videoMainFolder, pF, pF.getName());
        }
      }
    } else {
      processDatePair(videoMainFolder, photoMainFolder, videoMainName);
    }

    var isApproved = unmatched.length === 0 && matched.length > 0;

    return {
      success: true,
      videoMainName: videoMainName,
      photoMainName: photoMainName,
      dateFolders: dateFolderSummaries,
      matched: matched,
      unmatched: unmatched,
      totalVideos: totalVideosScanned,
      totalPhotoFolders: totalPhotoFoldersScanned,
      isApproved: isApproved
    };

  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Legacy single-folder scan wrapper for backwards compatibility
 */
function scanMainFolder(folderInput) {
  return scanTwoFolders(folderInput, folderInput);
}

/**
 * Creates or appends audit log entries to a Google Sheet
 */
function logTransferToGoogleSheet(sheetUrlOrId, eventName, transferredItems) {
  if (!transferredItems || transferredItems.length === 0) {
    return { success: false, error: "No items to log." };
  }

  try {
    var ss = null;
    var targetInput = (sheetUrlOrId && sheetUrlOrId.trim()) ? sheetUrlOrId : MASTER_AUDIT_SHEET_URL;
    var sheetId = extractSheetId(targetInput);

    if (sheetId) {
      try {
        ss = SpreadsheetApp.openById(sheetId);
      } catch (e) {
        ss = null;
      }
    }

    // Create a new Spreadsheet if not provided or ID is invalid
    if (!ss) {
      var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
      var title = "UniDesk Video Transfer Audit Report - " + (eventName || "Event") + " (" + dateStr + ")";
      ss = SpreadsheetApp.create(title);
    }

    var sheet = ss.getSheetByName("Transfer Audit Log");
    if (!sheet) {
      sheet = ss.getActiveSheet();
      sheet.setName("Transfer Audit Log");
    }

    // Check if header exists
    if (sheet.getLastRow() === 0) {
      var headers = [
        "Timestamp",
        "Date / Event Subfolder",
        "Video File Name",
        "Video File ID",
        "Target Photo Folder",
        "Target Folder ID",
        "File Size (MB)",
        "Copied File Link",
        "Transfer Status"
      ];
      
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1E1B4B");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    // Append transferred items
    for (var i = 0; i < transferredItems.length; i++) {
      var item = transferredItems[i];
      var fileUrl = item.copiedFileId ? "https://drive.google.com/file/d/" + item.copiedFileId + "/view" : "";
      
      sheet.appendRow([
        timestamp,
        item.dateFolderName || "",
        item.videoName || "",
        item.videoId || "",
        item.photoFolderName || "",
        item.photoFolderId || "",
        item.fileSizeMb || "",
        fileUrl,
        "COPIED SUCCESS"
      ]);
    }

    // Auto-fit column widths
    for (var col = 1; col <= 9; col++) {
      sheet.autoResizeColumn(col);
    }

    return {
      success: true,
      sheetUrl: ss.getUrl(),
      sheetName: ss.getName(),
      loggedCount: transferredItems.length
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Copies matched video files into their target photo folders and automatically logs to Google Sheets
 */
function executeVideoTransfer(matchesToTransfer, sheetUrlOrId, createNewSheet, eventName) {
  if (!matchesToTransfer || !matchesToTransfer.length) {
    return { success: false, error: "No matched files selected for transfer." };
  }

  var transferredCount = 0;
  var errors = [];
  var transferredItems = [];

  for (var i = 0; i < matchesToTransfer.length; i++) {
    var item = matchesToTransfer[i];
    try {
      if (!item.videoId || !item.photoFolderId) continue;

      var videoFile = DriveApp.getFileById(item.videoId);
      var targetFolder = DriveApp.getFolderById(item.photoFolderId);

      var copiedFile = videoFile.makeCopy(videoFile.getName(), targetFolder);
      
      transferredCount++;
      transferredItems.push({
        videoId: item.videoId,
        videoName: videoFile.getName(),
        photoFolderId: item.photoFolderId,
        photoFolderName: targetFolder.getName(),
        copiedFileId: copiedFile.getId(),
        dateFolderName: item.dateFolderName || '',
        fileSizeMb: item.fileSizeMb || Math.round((videoFile.getSize() / (1024 * 1024)) * 10) / 10,
        transferredAt: new Date().toLocaleTimeString()
      });
    } catch (err) {
      errors.push("Failed copying " + (item.videoName || item.videoId) + ": " + err.toString());
    }
  }

  // Handle Google Sheets Logging (Auto-logs to backend MASTER_AUDIT_SHEET_URL or provided URL)
  var sheetLogResult = null;
  if (transferredItems.length > 0) {
    sheetLogResult = logTransferToGoogleSheet(sheetUrlOrId, eventName, transferredItems);
  }

  return {
    success: true,
    transferredCount: transferredCount,
    transferredItems: transferredItems,
    errors: errors,
    sheetLogResult: sheetLogResult
  };
}
