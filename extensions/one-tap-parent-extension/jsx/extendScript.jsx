// One Tap Parent Extension ExtendScript - Combined Suite (Batch & Custom Single Export)
// File location: jsx/extendScript.jsx

// Polyfill String.prototype.trim for ExtendScript (ES3 environment)
if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/^\s+|\s+$/g, "");
    };
}

$.runScript = $.runScript || {};

// ----------------------
// 35 Official Events Definitions from Event List.xlsx
// ----------------------
var EVENT_DEFS = {
    AQ:     { code: "AQ",     name: "Aqiqa",                colorIndex: 7, colorName: "Cyan" },
    BM:     { code: "BM",     name: "Bethak Majlis",        colorIndex: 7, colorName: "Teal" },
    BQ:     { code: "BQ",     name: "Bethak Qadam",         colorIndex: 1, colorName: "Coral" },
    BZ:     { code: "BZ",     name: "Bethak Ziyafat",       colorIndex: 2, colorName: "Lavender" },
    FMB:    { code: "FMB",    name: "FMB",                  colorIndex: 0, colorName: "Green" },
    H:      { code: "H",      name: "Haddiyat",             colorIndex: 4, colorName: "Amber" },
    ID:     { code: "ID",     name: "Idaraat",              colorIndex: 6, colorName: "Royal Blue" },
    IF:     { code: "IF",     name: "Iftettah",             colorIndex: 0, colorName: "Lime" },
    IFS:    { code: "IFS",    name: "Iftettah Sharaf",      colorIndex: 0, colorName: "Emerald" },
    IST:    { code: "IST",    name: "Isteqbal",             colorIndex: 6, colorName: "Indigo" },
    KGS:    { code: "KGS",    name: "Kg Sharaf",            colorIndex: 1, colorName: "Rose" },
    M:      { code: "M",      name: "Majlis",               colorIndex: 0, colorName: "Green" },
    MF:     { code: "MF",     name: "Mafsuhiyat",           colorIndex: 3, colorName: "Bronze" },
    MISBAH: { code: "MISBAH", name: "Misbah",               colorIndex: 7, colorName: "Cyan" },
    MKB:    { code: "MKB",    name: "Mokib",                colorIndex: 6, colorName: "Navy" },
    MO:     { code: "MO",     name: "Madrasa",              colorIndex: 6, colorName: "Light Blue" },
    MQ:     { code: "MQ",     name: "Misaq",                colorIndex: 2, colorName: "Violet" },
    MUL:    { code: "MUL",    name: "Mulaqaat",             colorIndex: 3, colorName: "Orange-Red" },
    MYN:    { code: "MYN",    name: "Miyana",               colorIndex: 2, colorName: "Magenta" },
    MZ:     { code: "MZ",     name: "Majmui Ziyafat",       colorIndex: 2, colorName: "Purple" },
    N:      { code: "N",      name: "Nikah",                colorIndex: 4, colorName: "Bright Yellow" },
    NAMAZ:  { code: "NAMAZ",  name: "Namaz",                colorIndex: 4, colorName: "Gold" },
    ONLINE: { code: "ONLINE", name: "Online",               colorIndex: 6, colorName: "Sky Blue" },
    Q:      { code: "Q",      name: "Qadam",                colorIndex: 1, colorName: "Vivid Red" },
    QMZ:    { code: "QMZ",    name: "Qadam Majlis Ziyafat", colorIndex: 2, colorName: "Fuchsia" },
    SH:     { code: "SH",     name: "Sharaf",               colorIndex: 3, colorName: "Peach" },
    SQ:     { code: "SQ",     name: "Shifa Qadam",          colorIndex: 1, colorName: "Dark Red" },
    TJR:    { code: "TJR",    name: "Tijarat",              colorIndex: 0, colorName: "Olive" },
    TQ:     { code: "TQ",     name: "Talaqqi",              colorIndex: 7, colorName: "Turquoise" },
    TNQ:    { code: "TNQ",    name: "Tahani Qadam",         colorIndex: 7, colorName: "Ice Blue" },
    TQN:    { code: "TQN",    name: "Tahneeq",              colorIndex: 7, colorName: "Ice Blue" },
    WAAZ:   { code: "WAAZ",   name: "Waaz",                 colorIndex: 3, colorName: "Warm Orange" },
    WD:     { code: "WD",     name: "Wada",                 colorIndex: 5, colorName: "Slate" },
    Z:      { code: "Z",      name: "Ziyafat",              colorIndex: 6, colorName: "Royal Blue" },
    ZO:     { code: "ZO",     name: "Zafaf Olda",           colorIndex: 2, colorName: "Orchid" }
};

// ----------------------
// Get Marker Names for Audio Exceptions / Selection Modal
// ----------------------
$.runScript.getMarkerNames = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence.";
        var markers = seq.markers;
        if (!markers) return "ERROR|||No markers found.";
        
        var list = [];
        var fps = 25.0;
        try {
            var settings = seq.getSettings && seq.getSettings();
            if (settings && settings.videoFrameRate !== undefined && settings.videoFrameRate !== null) {
                var vr = settings.videoFrameRate;
                if (typeof vr === "number") fps = vr;
                else if (typeof vr === "string") { var pf = parseFloat(vr); if (isFinite(pf) && pf > 0) fps = pf; }
                else if (typeof vr === "object" && vr.numerator && vr.denominator) { var pf2 = vr.numerator / vr.denominator; if (isFinite(pf2) && pf2 > 0) fps = pf2; }
            }
        } catch (eFps) { fps = 25.0; }

        var markerItems = [];
        var mScan = markers.getFirstMarker();
        while (mScan) {
            var mNm = mScan.name || '';
            var mCmt = mScan.comments || '';
            var isGp = isGroupPhotoName(mNm) || (mCmt.indexOf("OT_GP_INSERTED") !== -1) || (/ - (?:GP\s*\d+|Group\s*Photo)/i.test(mNm));
            if (!isGp) {
                var mStart = (mScan.start && !isNaN(Number(mScan.start.seconds))) ? Number(mScan.start.seconds) : 0;
                markerItems.push({ obj: mScan, name: mNm, startSec: mStart });
            }
            mScan = markers.getNextMarker(mScan);
        }
        markerItems.sort(function (a, b) { return a.startSec - b.startSec; });
        var count = 0;
        for (var mi = 0; mi < markerItems.length; mi++) {
            var cur = markerItems[mi];
            var name = cur.name || ("marker_" + count);
            name = name.replace(/[\\\/:*?"<>|]/g, "_"); // Sanitize filename characters
            list.push(name + ".mp4");
            // item processed in for-loop
            count++;
        }
        return "SUCCESS|||" + list.join("|||");
    } catch(e) {
        return "ERROR|||" + e.toString();
    }
};

// Helper to find last used preset or bundled high-speed hardware preset
function getLastUsedEncoderPreset(extPath) {
    try {
        // 1. Direct explicit preset file check
        if (extPath && typeof extPath === "string") {
            try {
                var cleanDirect = extPath.replace(/^file:\/\/\/?/i, "").replace(/\\/g, "/").replace(/\/+$/, "");
                try { cleanDirect = decodeURI(cleanDirect); } catch(eD0) {}
                try { cleanDirect = File.decode(cleanDirect); } catch(eD1) {}
                var directFile = new File(cleanDirect);
                if (directFile.exists && directFile.name.match(/\.epr$/i)) return directFile.fsName;
            } catch (eDir) {}
        }

        var candidates = [];

        // 2. Extension folder presets (raw and decoded URI)
        if (extPath && typeof extPath === "string") {
            try {
                var rawClean = extPath.replace(/^file:\/\/\/?/i, "").replace(/\\/g, "/").replace(/\/+$/, "");
                try { rawClean = decodeURI(rawClean); } catch(eD2) {}
                try { rawClean = File.decode(rawClean); } catch(eD3) {}
                candidates.push(rawClean + "/presets/My One.epr");
                candidates.push(rawClean + "/My One.epr");
            } catch (eExt) {}
        }

        // 3. Current active project folder & DVD presets
        try {
            if (app.project && app.project.path) {
                var prjF = new File(app.project.path);
                if (prjF.exists) {
                    var prjDir = prjF.parent.fsName.replace(/\\/g, "/");
                    candidates.push(prjDir + "/presets/My One.epr");
                    candidates.push(prjDir + "/My One.epr");
                    candidates.push(prjDir + "/DVD/presets/My One.epr");
                }
            }
        } catch (ePrj) {}

        // 4. Script relative directory
        try {
            if (typeof $.fileName !== "undefined" && $.fileName) {
                var scriptFile = new File($.fileName);
                if (scriptFile && scriptFile.exists) {
                    var extFolder = scriptFile.parent.parent;
                    candidates.push(extFolder.fsName.replace(/\\/g, "/") + "/presets/My One.epr");
                }
            }
        } catch (eBundled) {}

        // 5. Common Adobe CEP extension directories (Windows 32/64 & UserData)
        candidates.push("C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/one-tap-extension/presets/My One.epr");
        candidates.push("C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/one-tap-parent-extension/presets/My One.epr");
        candidates.push("C:/Program Files/Common Files/Adobe/CEP/extensions/one-tap-extension/presets/My One.epr");
        candidates.push("C:/Program Files/Common Files/Adobe/CEP/extensions/one-tap-parent-extension/presets/My One.epr");
        try {
            if (Folder.userData && Folder.userData.exists) {
                var uFs = Folder.userData.fsName.replace(/\\/g, "/");
                candidates.push(uFs + "/Adobe/CEP/extensions/one-tap-extension/presets/My One.epr");
                candidates.push(uFs + "/Adobe/CEP/extensions/one-tap-parent-extension/presets/My One.epr");
            }
        } catch (eCep) {}

        // Test all direct candidates
        for (var ci = 0; ci < candidates.length; ci++) {
            try {
                var cFile = new File(candidates[ci]);
                if (cFile && cFile.exists) return cFile.fsName;
            } catch (eCf) {}
        }

        // 6. Scan presets directory if present in extension
        if (extPath && typeof extPath === "string") {
            try {
                var pDir = new Folder(extPath.replace(/\\/g, "/").replace(/\/+$/, "") + "/presets");
                if (pDir && pDir.exists) {
                    var pFiles = pDir.getFiles("*.epr");
                    if (pFiles && pFiles.length > 0) return pFiles[0].fsName;
                }
            } catch (ePdir) {}
        }

        // 7. Scan AME user presets in Documents & AppData
        var latestFile = null;
        var latestTime = 0;

        function scanFolderPresets(folder) {
            if (!folder || !folder.exists) return;
            var files = folder.getFiles();
            if (!files) return;
            for (var i = 0; i < files.length; i++) {
                var item = files[i];
                if (item instanceof Folder) {
                    scanFolderPresets(item);
                } else if (item instanceof File && item.name.match(/\.epr$/i)) {
                    var mod = item.modified ? item.modified.getTime() : 0;
                    if (mod > latestTime) {
                        latestTime = mod;
                        latestFile = item;
                    }
                }
            }
        }

        try {
            var docFolder = Folder.myDocuments;
            if (docFolder && docFolder.exists) {
                var ameDir = new Folder(docFolder.fsName + "/Adobe/Adobe Media Encoder");
                if (ameDir.exists) scanFolderPresets(ameDir);
            }
        } catch (eAmeDoc) {}

        try {
            var appDataFolder = Folder.userData;
            if (appDataFolder && appDataFolder.exists) {
                var ameDataDir = new Folder(appDataFolder.fsName + "/Adobe/Common/AME");
                if (ameDataDir.exists) scanFolderPresets(ameDataDir);
            }
        } catch (eAmeData) {}

        if (latestFile && latestFile.exists) {
            return latestFile.fsName;
        }
    } catch (e) {}
    
    return "";
}

function legacy_getLastUsedEncoderPreset(extPath) {
    try {
        // 1. If explicit preset passed
        if (extPath && typeof extPath === "string") {
            try {
                var directFile = new File(extPath);
                if (directFile.exists && directFile.name.match(/\.epr$/i)) return directFile.fsName;
            } catch (eDir) {}
        }
        // 2. Prioritize bundled high-speed GPU preset in extension
        if (extPath && typeof extPath === "string") {
            try {
                var cleanExt = extPath.replace(/\\/g, "/").replace(/\/+$/, "");
                var directBundled = new File(cleanExt + "/presets/My One.epr");
                if (directBundled && directBundled.exists) return directBundled.fsName;
                var pDir = new Folder(cleanExt + "/presets");
                if (pDir && pDir.exists) {
                    var pFiles = pDir.getFiles("*.epr");
                    if (pFiles && pFiles.length > 0) return pFiles[0].fsName;
                }
            } catch (eExt) {}
        }
        // 3. Prioritize bundled high-speed GPU optimized preset
        try {
            var scriptFile = new File($.fileName);
            if (scriptFile && scriptFile.exists) {
                var extFolder = scriptFile.parent.parent;
                var bundledPreset = new File(extFolder.fsName + "/presets/My One.epr");
                if (bundledPreset && bundledPreset.exists) {
                    return bundledPreset.fsName;
                }
            }
        } catch (eBundled) {}

        // 4. Common CEP extension directories
        var commonCep = [
            "C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/one-tap-extension/presets/My One.epr",
            "C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/one-tap-parent-extension/presets/My One.epr",
            "C:/Program Files/Common Files/Adobe/CEP/extensions/one-tap-extension/presets/My One.epr",
            "C:/Program Files/Common Files/Adobe/CEP/extensions/one-tap-parent-extension/presets/My One.epr"
        ];
        try {
            if (Folder.userData && Folder.userData.exists) {
                commonCep.push(Folder.userData.fsName + "/Adobe/CEP/extensions/one-tap-extension/presets/My One.epr");
                commonCep.push(Folder.userData.fsName + "/Adobe/CEP/extensions/one-tap-parent-extension/presets/My One.epr");
            }
        } catch (eCep) {}
        for (var ci = 0; ci < commonCep.length; ci++) {
            try {
                var cFile = new File(commonCep[ci]);
                if (cFile && cFile.exists) return cFile.fsName;
            } catch (eCf) {}
        }

        var docFolder = Folder.myDocuments;
        var ameDir = new Folder(docFolder.fsName + "/Adobe/Adobe Media Encoder");
        var latestFile = null;
        var latestTime = 0;

        function scanPresets(folder) {
            if (!folder || !folder.exists) return;
            var files = folder.getFiles();
            if (!files) return;
            for (var i = 0; i < files.length; i++) {
                var item = files[i];
                if (item instanceof Folder) {
                    scanPresets(item);
                } else if (item instanceof File && item.name.match(/\.epr$/i)) {
                    var mod = item.modified ? item.modified.getTime() : 0;
                    if (mod > latestTime) {
                        latestTime = mod;
                        latestFile = item;
                    }
                }
            }
        }

        if (ameDir.exists) {
            scanPresets(ameDir);
        }

        var appDataFolder = Folder.userData;
        if (appDataFolder && appDataFolder.exists) {
            var ameDataDir = new Folder(appDataFolder.fsName + "/Adobe/Common/AME");
            if (ameDataDir.exists) scanPresets(ameDataDir);
        }

        if (latestFile && latestFile.exists) {
            return latestFile.fsName;
        }
    } catch (e) {}
    
    return "";
}

// ----------------------
// Auto In/Out Markers (Auto-Numbering & Prefix Breakdown)
// ----------------------
$.runScript.autoInOutMarkers = function (userChoice, addSeqPrefix) {
    var undoStarted = false;
    try {
        if (typeof userChoice === "boolean") {
            addSeqPrefix = userChoice;
            userChoice = null;
        }
        var shouldAddSeqPrefix = (addSeqPrefix === true || addSeqPrefix === "true");

        var seq = app.project.activeSequence;
        if (!seq) return "No active sequence found.";

        // Undo Boundary & Safety snapshot
        try {
            if (typeof app.beginUndoGroup === "function") {
                app.beginUndoGroup("One Tap Auto In/Out Markers");
                undoStarted = true;
            } else if (typeof app.enableUndo === "function") {
                app.enableUndo(true);
            }
        } catch(eUG) {}

        // get fps safely
        var fps = 25.0;
        try {
            var settings = seq.getSettings && seq.getSettings();
            if (settings && settings.videoFrameRate !== undefined && settings.videoFrameRate !== null) {
                var vr = settings.videoFrameRate;
                if (typeof vr === "number") fps = vr;
                else if (typeof vr === "string") {
                    var pf = parseFloat(vr);
                    if (isFinite(pf) && pf > 0) fps = pf;
                } else if (typeof vr === "object" && vr.numerator && vr.denominator) {
                    var pf2 = vr.numerator / vr.denominator;
                    if (isFinite(pf2) && pf2 > 0) fps = pf2;
                }
            }
        } catch (e) { fps = 25.0; }
        var frameDuration = 1.0 / fps;

        var markers = seq.markers;
        if (!markers) return "No markers found in sequence.";

        // collect sequence markers
        var list = [];
        var gpMarkersToPreserve = [];
        var m = markers.getFirstMarker();
        while (m) {
            try {
                var mName = (m.name !== undefined ? m.name : "");
                var mStart = (m.start && !isNaN(Number(m.start.seconds))) ? Number(m.start.seconds) : 0;
                var mEnd = (m.end && !isNaN(Number(m.end.seconds))) ? Number(m.end.seconds) : 0;
                var cIdx = 5;
                if (typeof m.getColorByIndex === "function") {
                    try { cIdx = m.getColorByIndex(0); } catch (eColor) { cIdx = 5; }
                }

                if (isGroupPhotoName(mName)) {
                    // Group Photo markers (GP1, GROUP_PHOTO_1, etc.) must NEVER be treated as video separation markers!
                    gpMarkersToPreserve.push({
                        name: mName,
                        startSec: mStart,
                        endSec: mEnd,
                        comment: (m.comments !== undefined ? m.comments : ""),
                        colorIndex: cIdx
                    });
                } else {
                    list.push({
                        obj: m,
                        name: mName,
                        startSec: mStart,
                        comment: (m.comments !== undefined ? m.comments : ""),
                        colorIndex: cIdx
                    });
                }
            } catch (e) {
                list.push({ obj: m, name: "", startSec: 0, comment: "", colorIndex: 5 });
            }
            m = markers.getNextMarker(m);
        }
        if (list.length < 1) return "No sequence markers found.";

        // sort by start time
        list.sort(function (a, b) { return (a.startSec || 0) - (b.startSec || 0); });
        var lastMarkerStart = Number(list[list.length - 1].startSec || 0);

        // determine sequence end via multiple strategies
        var seqEndSec = null;
        var usedMethod = "none";

        // 1) seq.end.seconds
        try {
            var sEnd = Number(seq.end && seq.end.seconds);
            if (isFinite(sEnd) && sEnd > lastMarkerStart) {
                seqEndSec = sEnd;
                usedMethod = "seq.end.seconds";
            }
        } catch (e) {}

        // 2) seq.getOutPoint()
        if (seqEndSec === null) {
            try {
                if (typeof seq.getOutPoint === "function") {
                    var outp = seq.getOutPoint();
                    var outSec = Number(outp);
                    if (isFinite(outSec) && outSec > lastMarkerStart) {
                        seqEndSec = outSec;
                        usedMethod = "seq.getOutPoint()";
                    }
                }
            } catch (e) {}
        }

        // 3) scan tracks for clip end
        if (seqEndSec === null) {
            try {
                var maxEnd = null;
                var vt = seq.videoTracks;
                if (vt) {
                    for (var vi = 0; vi < vt.numTracks; vi++) {
                        try {
                            var track = vt[vi];
                            if (!track) continue;
                            if (track.clips && typeof track.clips.numItems !== "undefined") {
                                for (var ci = 0; ci < track.clips.numItems; ci++) {
                                    try {
                                        var clip = track.clips[ci];
                                        var ce = Number(clip.end && clip.end.seconds);
                                        if (isFinite(ce)) {
                                            if (maxEnd === null || ce > maxEnd) maxEnd = ce;
                                        }
                                    } catch (cex) {}
                                }
                            }
                        } catch (_) {}
                    }
                }
                var at = seq.audioTracks;
                if (at) {
                    for (var ai = 0; ai < at.numTracks; ai++) {
                        try {
                            var atrack = at[ai];
                            if (!atrack) continue;
                            if (atrack.clips && typeof atrack.clips.numItems !== "undefined") {
                                for (var aci = 0; aci < atrack.clips.numItems; aci++) {
                                    try {
                                        var aclip = atrack.clips[aci];
                                        var ace = Number(aclip.end && aclip.end.seconds);
                                        if (isFinite(ace)) {
                                            if (maxEnd === null || ace > maxEnd) maxEnd = ace;
                                        }
                                    } catch (acex) {}
                                }
                            }
                        } catch (_) {}
                    }
                }
                if (maxEnd !== null && isFinite(maxEnd) && maxEnd > lastMarkerStart) {
                    seqEndSec = maxEnd;
                    usedMethod = "scan track clips";
                }
            } catch (e) {}
        }

        // fallback: last marker start + 1 frame
        if (seqEndSec === null) {
            seqEndSec = lastMarkerStart + frameDuration;
            usedMethod = "fallback lastStart+1frame";
        }

        // ----------------------------------------------------
        // PREFIX SEQUENCE CHECK & AUTO-FIX FOR DUPLICATES
        // ----------------------------------------------------
        var prefixGroups = {};
        var prefixOrderList = [];

        for (var k = 0; k < list.length; k++) {
            var rawName = list[k].name || "";
            var cName = rawName.replace(/^(?:\d{4}[-_.]\d{1,2}[-_.]\d{1,2}|\d{3,})[\s_.-]*/, "").replace(/^\s+|\s+$/g, "");
            list[k].cleanName = cName;

            var parsedInfo = getPrefixFromMarkerName(cName);
            if (parsedInfo && parsedInfo.prefix && parsedInfo.prefix !== "OTHER") {
                var pfxKey = parsedInfo.prefix.toUpperCase();

                if (!prefixGroups.hasOwnProperty(pfxKey)) {
                    prefixGroups[pfxKey] = [];
                    prefixOrderList.push(pfxKey);
                }
                prefixGroups[pfxKey].push({
                    itemIndex: k,
                    rawName: cName,
                    prefix: pfxKey,
                    hasNum: parsedInfo.hasNum,
                    numVal: parsedInfo.numVal,
                    numDigits: parsedInfo.numDigits
                });
            } else {
                var match = cName.match(/^(?:(\d+)[\s_.-]*)?([A-Za-z]+)(?:[\s_.-]*(\d+))?/);
                if (match && match[2]) {
                    var rawPfx = match[2];
                    var pfxKey = rawPfx.toUpperCase();
                    if (pfxKey === "NAMAZ" || pfxKey === "NIKAAH") pfxKey = "N";
                    else if (pfxKey === "BETHAK") pfxKey = "AQ";
                    else if (pfxKey === "ZIYARAT" || pfxKey === "ZIARAT") pfxKey = "Z";
                    else if (pfxKey === "MAJLIS") pfxKey = "M";
                    else if (pfxKey === "QADAM") pfxKey = "Q";

                    var numStr = match[1] || match[3];
                    var hasNum = (numStr !== undefined && numStr !== null && numStr !== "");
                    var numVal = hasNum ? parseInt(numStr, 10) : null;
                    var numDigits = hasNum ? numStr.length : 2;

                    if (!prefixGroups.hasOwnProperty(pfxKey)) {
                        prefixGroups[pfxKey] = [];
                        prefixOrderList.push(pfxKey);
                    }
                    prefixGroups[pfxKey].push({
                        itemIndex: k,
                        rawName: cName,
                        prefix: pfxKey,
                        hasNum: hasNum,
                        numVal: numVal,
                        numDigits: numDigits
                    });
                }
            }
        }

        var sequenceWarnings = [];

        for (var p = 0; p < prefixOrderList.length; p++) {
            var pKey = prefixOrderList[p];
            var itemsInGroup = prefixGroups[pKey];

            var needsCorrection = false;
            
            if (itemsInGroup.length > 1) {
                var numCounts = {};
                for (var n = 0; n < itemsInGroup.length; n++) {
                    var item = itemsInGroup[n];
                    if (!item.hasNum || item.numVal === null) {
                        needsCorrection = true; // missing number in multi-item group
                        break;
                    }
                    if (numCounts.hasOwnProperty(item.numVal)) {
                        needsCorrection = true; // duplicate number found
                        break;
                    }
                    numCounts[item.numVal] = 1;
                    if (item.numVal !== (n + 1)) {
                        needsCorrection = true; // non-sequential number (e.g. 1, 3)
                    }
                }
            } else if (itemsInGroup.length === 1) {
                if (!itemsInGroup[0].hasNum || itemsInGroup[0].numVal === null) {
                    needsCorrection = true; // format single unnumbered marker as Z01
                }
            }

            if (needsCorrection) {
                var pfxCasing = itemsInGroup[0].prefix.toUpperCase();
                var maxDigits = 2;
                for (var md = 0; md < itemsInGroup.length; md++) {
                    if (itemsInGroup[md].numDigits > maxDigits) {
                        maxDigits = itemsInGroup[md].numDigits;
                    }
                }

                sequenceWarnings.push("⚠ PREFIX SEQUENCE CORRECTION (" + pKey + "): Automatically renumbered " + itemsInGroup.length + " marker(s) sequentially (" + pfxCasing + "01, " + pfxCasing + "02...).");

                for (var r = 0; r < itemsInGroup.length; r++) {
                    var newSeqNum = r + 1;
                    var pad = "0000" + newSeqNum;
                    var newNumStr = pad.substr(pad.length - maxDigits);
                    var newCleanName = pfxCasing + newNumStr;

                    var idx = itemsInGroup[r].itemIndex;
                    list[idx].cleanName = newCleanName;
                }
            }
        }

        // prepare segments where last uses seqEndSec
        var segments = [];
        for (var i = 0; i < list.length; i++) {
            var sFrame = Math.round(Number(list[i].startSec || 0) * fps);
            var s = sFrame / fps;
            var e;
            if (i < list.length - 1) {
                var nsFrame = Math.round(Number(list[i + 1].startSec || s) * fps);
                var eFrame = Math.max(sFrame, nsFrame);
                e = eFrame / fps;
            } else {
                var seqEndFrame = Math.round(Number(seqEndSec) * fps);
                var eFrameLast = Math.max(sFrame, seqEndFrame);
                e = eFrameLast / fps;
            }
            if (!isFinite(e) || e < s) e = s;

            var originalName = list[i].name || "";
            var finalName = originalName;

            if (shouldAddSeqPrefix) {
                var seqNumStr = ("00" + (i + 1)).substr(-3);
                var baseName = originalName.replace(/^\d{3,}[\s_.-]*/, "").replace(/^\s+|\s+$/g, "");
                if (baseName.length > 0) {
                    finalName = seqNumStr + " " + baseName;
                } else {
                    finalName = seqNumStr;
                }
            }

            var rawPrefixInfo = getPrefixFromMarkerName(list[i].cleanName || list[i].name || "");
            var assignedColorIdx = (list[i].colorIndex !== undefined && list[i].colorIndex !== 5 && list[i].colorIndex !== 0)
                ? list[i].colorIndex
                : getMarkerColorIndexForPrefix(rawPrefixInfo.prefix);

            segments.push({
                name: finalName,
                cleanName: list[i].cleanName || list[i].name || "",
                comment: list[i].comment,
                colorIndex: assignedColorIdx,
                prefix: rawPrefixInfo.prefix,
                startSec: s,
                endSec: e
            });
        }

        // delete original markers
        var removed = 0;
        try {
            var del = markers.getFirstMarker();
            while (del) {
                markers.deleteMarker(del);
                removed++;
                del = markers.getFirstMarker();
            }
        } catch (e) {
            // continue if deletion fails
        }

        // helper to create Time object
        function timeObj(seconds) {
            var v = Number(seconds);
            if (!isFinite(v) || v < 0) v = 0;
            var T = new Time();
            T.seconds = v;
            return T;
        }

        // create new duration markers
        var created = 0;
        var prefixCounts = {};
        var prefixOrder = [];

        for (var j = 0; j < segments.length; j++) {
            var seg = segments[j];
            try {
                var newM = markers.createMarker(seg.startSec);
                try { newM.name = seg.name; } catch (e) {}
                try { newM.comments = seg.comment; } catch (e) {}

                // Set marker color in Premiere Pro via setColorByIndex
                var targetColorIdx = (seg.colorIndex !== undefined && seg.colorIndex !== null)
                    ? seg.colorIndex
                    : getMarkerColorIndexForPrefix(seg.prefix);
                if (typeof newM.setColorByIndex === "function") {
                    try {
                        newM.setColorByIndex(targetColorIdx, 0);
                    } catch (eColor1) {
                        try { newM.setColorByIndex(targetColorIdx); } catch (eColor2) {}
                    }
                }

                var tEnd = timeObj(seg.endSec);
                var dur = timeObj(Math.max(0, seg.endSec - seg.startSec));

                // try to set end/duration; fallback to numeric if needed
                var endOK = false, durOK = false;
                try { newM.end = tEnd; endOK = true; } catch (e) {
                    try { newM.end = seg.endSec; endOK = true; } catch (e2) { endOK = false; }
                }
                try { newM.duration = dur; durOK = true; } catch (e) {
                    try { newM.duration = Math.max(0, seg.endSec - seg.startSec); durOK = true; } catch (ee) { durOK = false; }
                }
                created++;

                // Track prefix count
                var cName = seg.cleanName || "";
                var pfx = (seg.prefix && seg.prefix !== "OTHER")
                    ? seg.prefix.toUpperCase()
                    : (getPrefixFromMarkerName(cName || seg.name || "").prefix || "Other");
                if (pfx === "OTHER") pfx = "Other";
                if (!prefixCounts.hasOwnProperty(pfx)) {
                    prefixCounts[pfx] = 0;
                    prefixOrder.push(pfx);
                }
                prefixCounts[pfx] = prefixCounts[pfx] + 1;
            } catch (ce) {
                // continue on error
            }
        }

        // Restore preserved Group Photo markers so they remain intact on timeline for GPI
        for (var gpi = 0; gpi < gpMarkersToPreserve.length; gpi++) {
            var gpm = gpMarkersToPreserve[gpi];
            try {
                var restM = markers.createMarker(gpm.startSec);
                if (restM) {
                    restM.name = gpm.name;
                    restM.comments = gpm.comment;
                    if (gpm.endSec > gpm.startSec) {
                        try { restM.end = timeObj(gpm.endSec); } catch(eE) {
                            try { restM.end = gpm.endSec; } catch(eE2) {}
                        }
                    }
                    if (typeof restM.setColorByIndex === "function") {
                        try { restM.setColorByIndex(gpm.colorIndex || 7, 0); } catch(eC1) {
                            try { restM.setColorByIndex(gpm.colorIndex || 7); } catch(eC2) {}
                        }
                    }
                }
            } catch(eRest) {}
        }

        var breakdownLines = [];
        for (var p = 0; p < prefixOrder.length; p++) {
            var pfxKey = prefixOrder[p];
            breakdownLines.push(pfxKey + "=" + prefixCounts[pfxKey]);
        }

        var warnStr = (sequenceWarnings && sequenceWarnings.length > 0) ? sequenceWarnings.join("\n") : "";
        var breakdownStr = breakdownLines.join("\n");

        // Display full-screen workspace modal in Premiere Pro
        try {
            var modalBody = "Total Markers Configured: " + created + "\n\n" +
                            "Event Breakdown:\n" + (breakdownStr ? breakdownStr.split("\n").join("  •  ") : "None") +
                            (warnStr ? ("\n\nNotes & Corrections:\n" + warnStr) : "");
            $.runScript.showWorkspaceModal(
                "One Tap — Auto In/Out Complete",
                created + " Markers Placed on Sequence Timeline",
                modalBody,
                "SUCCESS"
            );
        } catch (eModal) {}

        return "SUCCESS|||" + created + "|||" + breakdownStr + "|||" + warnStr;
    } catch (err) {
        try {
            $.runScript.showWorkspaceModal("One Tap — Marker Processing Error", "Operation Failed", err.toString(), "ERROR");
        } catch (eErr) {}
        return "ERROR|||" + err.toString();
    } finally {
        if (undoStarted) {
            try { if (typeof app.endUndoGroup === "function") app.endUndoGroup(); } catch(eEG) {}
        }
    }
};

// ----------------------
// Auto MEIO Export (Batch or Selected Custom Markers)
// ----------------------
$.runScript.autoMEIO = function (selectedMarkersStr, explicitExtOrPresetPath) {
    try {
        var selectedList = null;
        if (selectedMarkersStr && selectedMarkersStr !== "") {
            selectedList = selectedMarkersStr.split("|||");
        }

        // Get project folder path
        var projPath = "";
        try { projPath = app.project.path || ""; } catch (e) { projPath = ""; }

        var projectFolder = "";
        if (projPath && projPath !== "") {
            try { 
                var pf = new File(projPath); 
                if (pf.exists) projectFolder = pf.parent.fsName; 
                else projectFolder = Folder.myDocuments.fsName; 
            } catch (e) { 
                projectFolder = Folder.myDocuments.fsName; 
            }
        } else { 
            projectFolder = Folder.myDocuments.fsName; 
        }

        var sep = (projectFolder.indexOf("\\") !== -1) ? "\\" : "/";

        // Always output to a DVD folder inside the project directory
        var outFolder = new Folder(projectFolder + sep + "DVD");
        if (!outFolder.exists) {
            try { outFolder.create(); } catch (e) {}
        }
        var outPath = outFolder.fsName;

        // Use last used Media Encoder preset (or scan for latest .epr in extension/AME)
        var presetPath = getLastUsedEncoderPreset(explicitExtOrPresetPath);
        if (!presetPath) {
            return "ERROR|||Could not find Media Encoder export preset (.epr). Please ensure presets/My One.epr is in the extension folder or save an export preset in Media Encoder.";
        }
        try {
            if (app.encoder && app.encoder.launchEncoder) app.encoder.launchEncoder();
        } catch (eLaunch) {}

        // Active sequence + markers
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence.";
        var markers = seq.markers;
        if (!markers) return "ERROR|||No markers found.";

        // Precise Sequence Frame Rate calculation
        var fps = 25.0;
        var frameDur = 0.04;
        try {
            var settings = seq.getSettings ? seq.getSettings() : null;
            if (settings && settings.videoFrameRate !== undefined && settings.videoFrameRate !== null) {
                var vr = settings.videoFrameRate;
                if (typeof vr === "number" && vr > 0) {
                    fps = vr;
                    frameDur = 1.0 / fps;
                } else if (typeof vr === "string") {
                    var pf = parseFloat(vr);
                    if (isFinite(pf) && pf > 0) {
                        fps = pf;
                        frameDur = 1.0 / fps;
                    }
                } else if (typeof vr === "object") {
                    if (vr.seconds && Number(vr.seconds) > 0) {
                        frameDur = Number(vr.seconds);
                        fps = 1.0 / frameDur;
                    } else if (vr.ticks && Number(vr.ticks) > 0) {
                        fps = 254016000000 / Number(vr.ticks);
                        frameDur = 1.0 / fps;
                    } else if (vr.numerator && vr.denominator && Number(vr.denominator) > 0) {
                        fps = Number(vr.numerator) / Number(vr.denominator);
                        frameDur = 1.0 / fps;
                    }
                }
            }
        } catch (eFps) { fps = 25.0; frameDur = 0.04; }

        var markerItems = [];
        var mScan = markers.getFirstMarker();
        while (mScan) {
            var mNm = mScan.name || '';
            var mCmt = mScan.comments || '';
            var isGp = isGroupPhotoName(mNm) || (mCmt.indexOf("OT_GP_INSERTED") !== -1) || (/ - (?:GP\s*\d+|Group\s*Photo)/i.test(mNm));
            if (!isGp) {
                var mStart = (mScan.start && !isNaN(Number(mScan.start.seconds))) ? Number(mScan.start.seconds) : 0;
                markerItems.push({ obj: mScan, name: mNm, startSec: mStart });
            }
            mScan = markers.getNextMarker(mScan);
        }
        markerItems.sort(function (a, b) { return a.startSec - b.startSec; });
        var count = 0;
        var queuedFiles = [];
        var lastError = "";

        // Queue in Media Encoder
        for (var mi = 0; mi < markerItems.length; mi++) {
            var cur = markerItems[mi];
            try {
                var name = cur.name || ("marker_" + count);
                name = name.replace(/[\\\/:*?"<>|]/g, "_");
                var filename = name + ".mp4";

                var shouldExport = true;
                if (selectedList) {
                    shouldExport = false;
                    for (var k = 0; k < selectedList.length; k++) {
                        var sItem = selectedList[k];
                        if (sItem && (sItem === filename || sItem === name || sItem.replace(/\.mp4$/i, "") === name)) {
                            shouldExport = true;
                            break;
                        }
                    }
                }

                if (shouldExport) {
                    var curObj = cur.obj;
                    var sFrame = Math.round(cur.startSec * fps);
                    var inSec = sFrame / fps;
                    var outSec = inSec + frameDur;
                    var objEnd = (curObj && curObj.end && !isNaN(Number(curObj.end.seconds))) ? Number(curObj.end.seconds) : 0;
                    if (objEnd <= 0 && curObj && curObj.duration) {
                        try {
                            var dSec = (!isNaN(Number(curObj.duration.seconds))) ? Number(curObj.duration.seconds) : Number(curObj.duration);
                            if (dSec > 0) objEnd = cur.startSec + dSec;
                        } catch (eDur) {}
                    }
                    if (objEnd > cur.startSec + (0.5 * frameDur)) {
                        var endFrame = Math.round(objEnd * fps);
                        // Prevent bleed into next marker start
                        if (mi < markerItems.length - 1) {
                            var nextStartFrame = Math.round(markerItems[mi + 1].startSec * fps);
                            if (endFrame >= nextStartFrame) {
                                endFrame = nextStartFrame - 1;
                            }
                        }
                        outSec = Math.max(inSec + frameDur, endFrame / fps);
                    } else if (mi < markerItems.length - 1) {
                        var nextStartFrame = Math.round(markerItems[mi + 1].startSec * fps);
                        var eFrame = Math.max(sFrame + 1, nextStartFrame - 1);
                        outSec = eFrame / fps;
                    } else {
                        var seqEnd = 0;
                        try { seqEnd = Number(seq.end && seq.end.seconds) || 0; } catch (eSeqEnd) {}
                        if (seqEnd <= inSec) {
                            try { seqEnd = Number(seq.getOutPoint && seq.getOutPoint()) || 0; } catch (eOutp) {}
                        }
                        var endFrame = Math.round(Math.max(seqEnd, inSec + 10.0) * fps);
                        var eFrame = Math.max(sFrame + 1, endFrame - 1);
                        outSec = eFrame / fps;
                    }

                    // Move playhead to inSec so timeline visual updates
                    var tIn = new Time();
                    tIn.seconds = inSec;
                    var tOut = new Time();
                    tOut.seconds = outSec;

                    try {
                        if (seq.setPlayerPosition) seq.setPlayerPosition(tIn.ticks);
                    } catch (ePos) {}

                    // Apply In and Out points cleanly across seconds, Time object, and Work Area
                    try { seq.setInPoint(tIn.seconds); } catch (eIn) {
                        try { seq.setInPoint(tIn); } catch (eI2) { seq.setInPoint(String(inSec)); }
                    }
                    try { seq.setOutPoint(tOut.seconds); } catch (eOut) {
                        try { seq.setOutPoint(tOut); } catch (eO2) { seq.setOutPoint(String(outSec)); }
                    }
                    try { if (seq.setWorkAreaInPoint) seq.setWorkAreaInPoint(tIn.seconds); } catch (eW1) {}
                    try { if (seq.setWorkAreaOutPoint) seq.setWorkAreaOutPoint(tOut.seconds); } catch (eW2) {}
                    $.sleep(200);

                    var outFile = outPath + sep + name + ".mp4";

                    // Create placeholder temp file so Title Adder can immediately show and preflight it
                    try {
                        var tf = new File(outFile + ".tmp");
                        if (!tf.exists) {
                            tf.open("w");
                            tf.write("");
                            tf.close();
                        }
                    } catch (eTmp) {}

                    // Range 1 = ENCODE_IN_TO_OUT in Premiere Pro API
                    var encodeRange = 1;
                    if (typeof app.encoder.ENCODE_IN_TO_OUT !== "undefined" && app.encoder.ENCODE_IN_TO_OUT !== null) {
                        encodeRange = app.encoder.ENCODE_IN_TO_OUT;
                    }

                    app.encoder.encodeSequence(
                        seq,
                        outFile,
                        presetPath,
                        encodeRange,
                        1
                    );
                    $.sleep(200);
                    queuedFiles.push(filename);
                    count++;
                }

            } catch (e) {
                lastError = e.toString();
            }

            // item processed in for-loop
        }

        if (count === 0) {
            if (lastError) return "ERROR|||Media Encoder queue error: " + lastError;
            return "ERROR|||No matching markers found to export. Please ensure markers are placed on timeline.";
        }
        return "SUCCESS|||" + outPath + "|||Auto MEIO: Queued " + count + " jobs to Media Encoder.\n\nOpen Media Encoder to start the render.|||" + queuedFiles.join(";;;");

    } catch (err) {
        return "Error in autoMEIO: " + err.toString();
    }
};

// ----------------------
// Timeline Stats: Marker Count, Full Event Breakdown & Raw Duration ("Time Before Editing")
// ----------------------
$.runScript.getTimelineStats = function () {
    try {
        var seq = app.project ? app.project.activeSequence : null;
        if (!seq) {
            return "ERROR|||No active sequence found in Premiere Pro.";
        }

        // 1. Calculate raw imported sequence duration ("Time Before Editing")
        var rawSec = 0;
        try {
            var sEnd = Number(seq.end && seq.end.seconds);
            if (isFinite(sEnd) && sEnd > 0) rawSec = sEnd;
        } catch (e1) {}

        try {
            var vt = seq.videoTracks;
            if (vt) {
                for (var vi = 0; vi < vt.numTracks; vi++) {
                    var vtrack = vt[vi];
                    if (!vtrack || !vtrack.clips) continue;
                    for (var vci = 0; vci < vtrack.clips.numItems; vci++) {
                        var vclip = vtrack.clips[vci];
                        var vce = Number(vclip.end && vclip.end.seconds);
                        if (isFinite(vce) && vce > rawSec) rawSec = vce;
                    }
                }
            }
            var at = seq.audioTracks;
            if (at) {
                for (var ai = 0; ai < at.numTracks; ai++) {
                    var atrack = at[ai];
                    if (!atrack || !atrack.clips) continue;
                    for (var aci = 0; aci < atrack.clips.numItems; aci++) {
                        var aclip = atrack.clips[aci];
                        var ace = Number(aclip.end && aclip.end.seconds);
                        if (isFinite(ace) && ace > rawSec) rawSec = ace;
                    }
                }
            }
        } catch (eClips) {}

        var totalS = Math.round(rawSec);
        var hrs = Math.floor(totalS / 3600);
        var mins = Math.floor((totalS % 3600) / 60);
        var secs = totalS % 60;
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        var formattedRawDuration = pad(hrs) + ":" + pad(mins) + ":" + pad(secs);

        // 2. Scan markers
        var markers = seq.markers;
        var totalMarkers = 0;
        var breakdownMap = {};
        var breakdownOrder = [];

        if (markers) {
            var m = markers.getFirstMarker();
            while (m) {
                var mName = m.name || "";
                var mCmt = m.comments || "";
                if (isGroupPhotoName(mName) || mCmt.indexOf("OT_GP_INSERTED") !== -1 || (/ - (?:GP\s*\d+|Group\s*Photo)/i.test(mName))) {
                    if (!breakdownMap["GP"]) {
                        breakdownMap["GP"] = { count: 0, code: "GP" };
                        breakdownOrder.push("GP");
                    }
                    breakdownMap["GP"].count++;
                } else {
                    totalMarkers++;
                    var pfxInfo = getPrefixFromMarkerName(mName);
                    var code = (pfxInfo && pfxInfo.prefix) ? pfxInfo.prefix.toUpperCase() : "OTHER";
                    if (!breakdownMap[code]) {
                        breakdownMap[code] = { count: 0, code: code };
                        breakdownOrder.push(code);
                    }
                    breakdownMap[code].count++;
                }
                m = markers.getNextMarker(m);
            }
        }

        var breakdownItems = [];
        var totalEvents = 0;
        for (var b = 0; b < breakdownOrder.length; b++) {
            var bCode = breakdownOrder[b];
            var bCount = breakdownMap[bCode].count;
            if (bCode !== "OTHER") {
                totalEvents += bCount;
            }
            var def = (typeof EVENT_DEFS !== "undefined" && EVENT_DEFS[bCode])
                ? EVENT_DEFS[bCode]
                : { name: bCode, colorIndex: 5, colorName: "White" };
            breakdownItems.push("{" +
                "\"code\":\"" + bCode + "\"," +
                "\"name\":\"" + (def.name || bCode).replace(/"/g, '\\"') + "\"," +
                "\"count\":" + bCount + "," +
                "\"colorIndex\":" + (def.colorIndex !== undefined ? def.colorIndex : 5) +
            "}");
        }

        var json = "{" +
            "\"sequenceName\":\"" + (seq.name || "Sequence").replace(/"/g, '\\"') + "\"," +
            "\"totalMarkers\":" + totalMarkers + "," +
            "\"totalEvents\":" + totalEvents + "," +
            "\"rawDurationSec\":" + rawSec + "," +
            "\"rawDurationFormatted\":\"" + formattedRawDuration + "\"," +
            "\"breakdown\":[" + breakdownItems.join(",") + "]" +
        "}";

        return "SUCCESS|||" + json;
    } catch (err) {
        return "ERROR|||" + err.toString();
    }
};

$.runScript.legacy_autoMEIO = function (selectedMarkersStr, explicitExtOrPresetPath) {
    try {
        var selectedList = null;
        if (selectedMarkersStr && selectedMarkersStr !== "") {
            selectedList = selectedMarkersStr.split("|||");
        }

        // Get project folder path
        var projPath = "";
        try { projPath = app.project.path || ""; } catch (e) { projPath = ""; }

        var projectFolder = "";
        if (projPath && projPath !== "") {
            try { 
                var pf = new File(projPath); 
                if (pf.exists) projectFolder = pf.parent.fsName; 
                else projectFolder = Folder.myDocuments.fsName; 
            } catch (e) { 
                projectFolder = Folder.myDocuments.fsName; 
            }
        } else { 
            projectFolder = Folder.myDocuments.fsName; 
        }

        var sep = (projectFolder.indexOf("\\") !== -1) ? "\\" : "/";

        // Always output to a DVD folder inside the project directory
        var outFolder = new Folder(projectFolder + sep + "DVD");
        if (!outFolder.exists) {
            try { outFolder.create(); } catch (e) {}
        }
        var outPath = outFolder.fsName;

        // Use last used Media Encoder preset (or scan for latest .epr in AME user presets folder)
        // Use last used Media Encoder preset (or scan for latest .epr in extension/AME)
        var presetPath = getLastUsedEncoderPreset(explicitExtOrPresetPath);
        if (!presetPath) {
            return "ERROR|||Could not find Media Encoder export preset (.epr). Please ensure presets/My One.epr is in the extension folder or save an export preset in Media Encoder.";
        }
        try {
            if (app.encoder && app.encoder.launchEncoder) app.encoder.launchEncoder();
        } catch (eLaunch) {}

        // Active sequence + markers
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence.";
        var markers = seq.markers;
        if (!markers) return "ERROR|||No markers found.";

        var fps = 25.0;
        try {
            var settings = seq.getSettings && seq.getSettings();
            if (settings && settings.videoFrameRate !== undefined && settings.videoFrameRate !== null) {
                var vr = settings.videoFrameRate;
                if (typeof vr === "number") fps = vr;
                else if (typeof vr === "string") { var pf = parseFloat(vr); if (isFinite(pf) && pf > 0) fps = pf; }
                else if (typeof vr === "object" && vr.numerator && vr.denominator) { var pf2 = vr.numerator / vr.denominator; if (isFinite(pf2) && pf2 > 0) fps = pf2; }
            }
        } catch (eFps) { fps = 25.0; }

        var markerItems = [];
        var mScan = markers.getFirstMarker();
        while (mScan) {
            var mNm = mScan.name || '';
            var mCmt = mScan.comments || '';
            var isGp = isGroupPhotoName(mNm) || (mCmt.indexOf("OT_GP_INSERTED") !== -1) || (/ - (?:GP\s*\d+|Group\s*Photo)/i.test(mNm));
            if (!isGp) {
                var mStart = (mScan.start && !isNaN(Number(mScan.start.seconds))) ? Number(mScan.start.seconds) : 0;
                markerItems.push({ obj: mScan, name: mNm, startSec: mStart });
            }
            mScan = markers.getNextMarker(mScan);
        }
        markerItems.sort(function (a, b) { return a.startSec - b.startSec; });
        var count = 0;
        var queuedFiles = [];
        var lastError = "";

        // Queue in Media Encoder
        for (var mi = 0; mi < markerItems.length; mi++) {
            var cur = markerItems[mi];
            try {
                var name = cur.name || ("marker_" + count);
                name = name.replace(/[\\\/:*?"<>|]/g, "_");
                var filename = name + ".mp4";

                var shouldExport = true;
                if (selectedList) {
                    shouldExport = false;
                    for (var k = 0; k < selectedList.length; k++) {
                        var sItem = selectedList[k];
                        if (sItem && (sItem === filename || sItem === name || sItem.replace(/\.mp4$/i, "") === name)) {
                            shouldExport = true;
                            break;
                        }
                    }
                }

                if (shouldExport) {
                    var curObj = cur.obj;
                    var sFrame = Math.round(cur.startSec * fps);
                    var inSec = sFrame / fps;
                    var outSec = inSec + (1.0 / fps);
                    var objEnd = (curObj && curObj.end && !isNaN(Number(curObj.end.seconds))) ? Number(curObj.end.seconds) : 0;
                    if (objEnd <= 0 && curObj && curObj.duration) {
                        try {
                            var dSec = (!isNaN(Number(curObj.duration.seconds))) ? Number(curObj.duration.seconds) : Number(curObj.duration);
                            if (dSec > 0) objEnd = cur.startSec + dSec;
                        } catch (eDur) {}
                    }
                    if (objEnd > cur.startSec + (0.5 / fps)) {
                        var eFrame = Math.round(objEnd * fps);
                        outSec = Math.max(inSec + (1.0 / fps), eFrame / fps);
                    } else if (mi < markerItems.length - 1) {
                        var nextStartFrame = Math.round(markerItems[mi + 1].startSec * fps);
                        var eFrame = Math.max(sFrame + 1, nextStartFrame - 1);
                        outSec = eFrame / fps;
                    } else {
                        var seqEnd = 0;
                        try { seqEnd = Number(seq.end && seq.end.seconds) || 0; } catch (eSeqEnd) {}
                        if (seqEnd <= inSec) {
                            try { seqEnd = Number(seq.getOutPoint && seq.getOutPoint()) || 0; } catch (eOutp) {}
                        }
                        var endFrame = Math.round(Math.max(seqEnd, inSec + 10.0) * fps);
                        var eFrame = Math.max(sFrame + 1, endFrame - 1);
                        outSec = eFrame / fps;
                    }
                    try {
                        var tPos = new Time();
                        tPos.seconds = inSec;
                        if (seq.setPlayerPosition) seq.setPlayerPosition(tPos.ticks);
                    } catch (ePos) {}
                    try { seq.setInPoint(inSec); } catch (eIn) {
                        try { var tI = new Time(); tI.seconds = inSec; seq.setInPoint(tI); } catch (eI2) { seq.setInPoint(String(inSec)); }
                    }
                    try { seq.setOutPoint(outSec); } catch (eOut) {
                        try { var tO = new Time(); tO.seconds = outSec; seq.setOutPoint(tO); } catch (eO2) { seq.setOutPoint(String(outSec)); }
                    }
                    $.sleep(120);


                    var outFile = outPath + sep + name + ".mp4";

                    // Create placeholder temp file so Title Adder can immediately show and preflight it
                    try {
                        var tf = new File(outFile + ".tmp");
                        if (!tf.exists) {
                            tf.open("w");
                            tf.write("");
                            tf.close();
                        }
                    } catch (eTmp) {}

                    // Only queue — DO NOT START
                    app.encoder.encodeSequence(
                        seq,
                        outFile,
                        presetPath,
                        (typeof app.encoder.ENCODE_IN_TO_OUT !== "undefined" ? app.encoder.ENCODE_IN_TO_OUT : 1),
                        1
                    );
                    $.sleep(60);
                    queuedFiles.push(filename);
                    count++;
                }

            } catch (e) {
                lastError = e.toString();
            }

            // item processed in for-loop
        }

        if (count === 0) {
            if (lastError) return "ERROR|||Media Encoder queue error: " + lastError;
            return "ERROR|||No matching markers found to export. Please ensure markers are placed on timeline.";
        }
        return "SUCCESS|||" + outPath + "|||Auto MEIO: Queued " + count + " jobs to Media Encoder.\n\nOpen Media Encoder to start the render.|||" + queuedFiles.join(";;;");

    } catch (err) {
        return "Error in autoMEIO: " + err.toString();
    }
};

// ----------------------
// Automatic Excel Report Locator & Sequence Timeline Info
// ----------------------
$.runScript.getSequenceTimelineInfo = function () {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence found.";

        var projPath = "";
        try { projPath = app.project.path || ""; } catch (e) { projPath = ""; }

        var projectFolder = "";
        if (projPath && projPath !== "") {
            try {
                var pf = new File(projPath);
                if (pf.exists) projectFolder = pf.parent.fsName;
            } catch (e) {}
        }

        var seqEndSec = 0;
        try {
            var sEnd = Number(seq.end && seq.end.seconds);
            if (isFinite(sEnd) && sEnd > 0) seqEndSec = sEnd;
        } catch (e) {}

        if (seqEndSec <= 0) {
            try {
                var vt = seq.videoTracks;
                if (vt) {
                    for (var vi = 0; vi < vt.numTracks; vi++) {
                        var track = vt[vi];
                        if (!track || !track.clips) continue;
                        for (var ci = 0; ci < track.clips.numItems; ci++) {
                            var clip = track.clips[ci];
                            var ce = Number(clip.end && clip.end.seconds);
                            if (isFinite(ce) && ce > seqEndSec) seqEndSec = ce;
                        }
                    }
                }
            } catch (e) {}
        }

        var seqName = seq.name || "Sequence";
        return "SUCCESS|||" + projectFolder + "|||" + seqName + "|||" + seqEndSec;
    } catch (err) {
        return "ERROR|||" + err.toString();
    }
};

$.runScript.autoFindExcelPath = function () {
    try {
        var projPath = "";
        try { projPath = app.project.path || ""; } catch (e) { projPath = ""; }

        var projectFolder = "";
        if (projPath && projPath !== "") {
            try {
                var pf = new File(projPath);
                if (pf.exists) projectFolder = pf.parent.fsName;
            } catch (e) {}
        }

        if (!projectFolder) {
            return "ERROR|||Project directory could not be determined. Please open a saved project.";
        }

        var dir = new Folder(projectFolder);
        if (!dir.exists) return "ERROR|||Folder does not exist: " + projectFolder;

        var files = dir.getFiles();
        var foundFile = null;
        var latestTime = 0;

        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            if (f instanceof File && f.name.match(/^Sequence_Summary_Report.*\.xlsx$/i)) {
                var modTime = f.modified ? f.modified.getTime() : 0;
                if (modTime >= latestTime) {
                    latestTime = modTime;
                    foundFile = f;
                }
            }
        }

        if (!foundFile && dir.parent && dir.parent.exists) {
            var parentFiles = dir.parent.getFiles();
            for (var j = 0; j < parentFiles.length; j++) {
                var pfFile = parentFiles[j];
                if (pfFile instanceof File && pfFile.name.match(/^Sequence_Summary_Report.*\.xlsx$/i)) {
                    var pModTime = pfFile.modified ? pfFile.modified.getTime() : 0;
                    if (pModTime >= latestTime) {
                        latestTime = pModTime;
                        foundFile = pfFile;
                    }
                }
            }
        }

        if (foundFile && foundFile.exists) {
            return "SUCCESS|||" + foundFile.fsName;
        }

        return "ERROR|||No Excel report (Sequence_Summary_Report_*.xlsx) found in project folder: " + projectFolder;
    } catch (err) {
        return "ERROR|||" + err.toString();
    }
};

function getPrefixFromMarkerName(name) {
    if (!name) return { prefix: "OTHER", numVal: null, numDigits: 2, hasNum: false };

    var raw = String(name).replace(/^\s+|\s+$/g, "");
    var upper = raw.toUpperCase();

    // 0. Explicit exclusions
    if (/\bNAMAZ\b/i.test(upper)) {
        return { prefix: "NAMAZ", numVal: null, numDigits: 2, hasNum: false };
    }

    function normCode(codeStr) {
        if (!codeStr) return null;
        var u = String(codeStr).toUpperCase().replace(/^[^A-Z]+|[^A-Z]+$/g, "");
        if (u === "NAMAZ") return "NAMAZ";
        if (u === "NIKAH" || u === "NIKAAH") return "N";
        if (u === "BETHAK") return "AQ";
        if (u === "ZIYARAT" || u === "ZIARAT" || u === "ZIYAFAT") return "Z";
        if (u === "MAJLIS") return "M";
        if (u === "QADAM") return "Q";
        if (typeof EVENT_DEFS !== "undefined" && EVENT_DEFS[u]) return u;

        // Check if sub-letter precedes a single-letter or known event code (e.g. '11aN', 'AN', 'BN' -> 'N')
        if (u.length >= 2) {
            var tail = u.substring(1);
            if (tail === "N" || tail === "NIKAH" || tail === "NIKAAH") return "N";
            if (typeof EVENT_DEFS !== "undefined" && EVENT_DEFS[tail]) return tail;
        }
        return null;
    }

    // 1. High-priority Miqaat item folder / clip / marker pattern:
    // e.g. "1448-04-05 _02E-43-27N-60446783", "1448-04-05 _02E-43-11aN-", "1448-02-29 _01M-01-01N-40905764", "1448-03-12_02E-16-01MZ-30310666"
    // Structure: -[seqIndex]-([eventNum])?([EventCode])(-[fileId])?
    // NOTE: (\d+)? must ONLY capture pure digits so multi-letter codes like MZ, AQ, BM, BZ, QMZ are NEVER truncated!
    var seqMatch = upper.match(/[-_]\d{1,4}[A-Za-z]?[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i) ||
                   upper.match(/[-_]\d{1,4}[A-Za-z]?[-_](\d+)?([A-Za-z]+)[-_]/i) ||
                   upper.match(/[-_](\d+)?(N)[-_]/i) ||
                   upper.match(/[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i);

    if (seqMatch && seqMatch[2]) {
        var resolvedSeqPfx = normCode(seqMatch[2]);
        if (resolvedSeqPfx) {
            var numStr = seqMatch[1];
            var parsedSeqNum = numStr ? parseInt(numStr, 10) : null;
            return {
                prefix: resolvedSeqPfx,
                numVal: (!isNaN(parsedSeqNum) && parsedSeqNum !== null) ? parsedSeqNum : null,
                numDigits: numStr ? numStr.length : 2,
                hasNum: (!isNaN(parsedSeqNum) && parsedSeqNum !== null)
            };
        }
    }

    // 2. Strip date (e.g. 1448-02-29, 02-29) and session tag (e.g. _01M, 01M, _02E, 02E) cleanly
    // A session tag MUST either have a leading underscore (e.g. _01M) or be followed by a separator / end of string
    var cleaned = upper
        .replace(/^(?:\d{4}[-_.]\d{1,2}[-_.]\d{1,2}|\d{1,2}[-_.]\d{1,2})[\s_.-]*/, "")
        .replace(/^(?:_\s*\d{1,2}[ME][\s_.-]*|\d{1,2}[ME](?:[\s_.-]+|$))/, "")
        .replace(/_\d{1,2}[ME](?:[\s_.-]+|$)/g, "")
        .replace(/^\d{3,}[\s_.-]*/, "")
        .replace(/^\s+|\s+$/g, "");

    // 3. Match leading/trailing numbers with event codes
    // Pattern A: [number] [letters] e.g. "16MZ", "01MZ", "16 MZ", "11aN", "01-MZ", "17Z", "01Z"
    var mNumFirst = cleaned.match(/(?:^|[\s_.-])(\d+)\s*[-_]?\s*([A-Za-z]{1,8})(?:[\s_.-]|$)/);
    if (mNumFirst && mNumFirst[2]) {
        var pfxA = normCode(mNumFirst[2]);
        if (pfxA) {
            var pNumA = parseInt(mNumFirst[1], 10);
            return {
                prefix: pfxA,
                numVal: !isNaN(pNumA) ? pNumA : null,
                numDigits: mNumFirst[1].length,
                hasNum: !isNaN(pNumA)
            };
        }
    }

    // Pattern B: [letters] [number] e.g. "MZ16", "MZ 16", "MZ-16", "Z01", "Z 17", "N-1"
    var mCodeFirst = cleaned.match(/(?:^|[\s_.-])([A-Za-z]{1,8})\s*[-_]?\s*(\d+)(?:[\s_.-]|$)/);
    if (mCodeFirst && mCodeFirst[1]) {
        var pfxB = normCode(mCodeFirst[1]);
        if (pfxB) {
            var pNumB = parseInt(mCodeFirst[2], 10);
            return {
                prefix: pfxB,
                numVal: !isNaN(pNumB) ? pNumB : null,
                numDigits: mCodeFirst[2].length,
                hasNum: !isNaN(pNumB)
            };
        }
    }

    // 4. Match against known official codes sorted by length descending (longest codes match first!)
    var officialCodes = [
        "MISBAH", "ONLINE", "IFTETTAH", "ISTEQBAL", "BETHAK", "MAJLIS", "ZIYARAT", "ZIARAT", "NAMAZ",
        "NIKAAH", "NIKAH", "WAAZ", "QMZ", "TQN", "TNQ", "TJR", "IFS", "KGS", "MKB", "MUL", "MYN",
        "FMB", "AQ", "BM", "BQ", "BZ", "ID", "IF", "MF", "MO", "MQ", "MZ", "SH", "SQ", "TQ", "WD", "ZO",
        "M", "N", "Q", "Z", "H"
    ];

    for (var i = 0; i < officialCodes.length; i++) {
        var p = officialCodes[i];
        var regSuffix = new RegExp("(?:^|[\\s_.-])(?:(\\d+)\\s*[-_]?\\s*)?(" + p + ")(?:\\s*[-_]?\\s*(\\d+))?(?:[\\s_.-]|$)", "i");
        var m = regSuffix.exec(cleaned);
        if (m) {
            var resolved = normCode(p);
            var numCandidate = m[1] || m[3];
            var pNum = numCandidate ? parseInt(numCandidate, 10) : null;
            return {
                prefix: resolved,
                numVal: (!isNaN(pNum) && pNum !== null) ? pNum : null,
                numDigits: numCandidate ? numCandidate.length : 2,
                hasNum: (!isNaN(pNum) && pNum !== null)
            };
        }
    }

    return { prefix: "OTHER", numVal: null, numDigits: 2, hasNum: false };
}

function legacy_getPrefixFromMarkerName(name) {
    if (!name) return { prefix: "OTHER", numVal: null, numDigits: 2, hasNum: false };

    var raw = String(name).replace(/^\s+|\s+$/g, "");
    var upper = raw.toUpperCase();

    // 1. High-priority Miqaat item folder / clip / marker pattern:
    // e.g. "1448-04-05 _02E-43-27N-60446783", "1448-04-05 _02E-43-N-", "1448-02-29 _01M-01-01N-40905764"
    // Structure: -[seqIndex]-([eventNum])?([EventCode])(-[fileId])?
    var seqMatch = upper.match(/[-_]\d{1,4}[A-Za-z]?[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i) ||
                   upper.match(/[-_]\d{1,4}[A-Za-z]?[-_](\d+)?([A-Za-z]+)[-_]/i) ||
                   upper.match(/[-_](\d+)?(N)[-_]/i) ||
                   upper.match(/[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i);

    if (seqMatch && seqMatch[2]) {
        var pfx = seqMatch[2];
        var numStr = seqMatch[1];
        if (pfx === "NAMAZ" || pfx === "NIKAAH" || pfx === "NIKAH") pfx = "N";
        else if (pfx === "BETHAK") pfx = "AQ";
        else if (pfx === "ZIYARAT" || pfx === "ZIARAT") pfx = "Z";
        else if (pfx === "MAJLIS") pfx = "M";
        else if (pfx === "QADAM") pfx = "Q";

        var parsedSeqNum = numStr ? parseInt(numStr, 10) : null;
        var seqDigits = numStr ? numStr.length : 2;
        return {
            prefix: pfx,
            numVal: (!isNaN(parsedSeqNum) && parsedSeqNum !== null) ? parsedSeqNum : null,
            numDigits: seqDigits,
            hasNum: (!isNaN(parsedSeqNum) && parsedSeqNum !== null)
        };
    }

    // 2. Strip date (e.g. 1448-02-29, 02-29) and session tag (e.g. _01M, 01M, _02E, 02E) cleanly
    var cleaned = upper
        .replace(/^(?:\d{4}[-_.]\d{1,2}[-_.]\d{1,2}|\d{1,2}[-_.]\d{1,2})[\s_.-]*/, "")
        .replace(/^(?:_\s*)?\d{1,2}[ME][\s_.-]*/, "")
        .replace(/_\d{1,2}[ME][\s_.-]*/g, "")
        .replace(/^\d{3,}[\s_.-]*/, "")
        .replace(/^\s+|\s+$/g, "");

    var knownPrefixes = ["NAMAZ", "NIKAAH", "NIKAH", "ZIYARAT", "ZIARAT", "BETHAK", "MAJLIS", "QADAM", "IDAARA", "WAAZ", "MZ", "AQ", "ID", "BQ", "BM", "BZ", "Q", "M", "Z", "N"];
    var matchedPfx = null;
    var matchedNumVal = null;
    var matchedNumDigits = 2;

    for (var i = 0; i < knownPrefixes.length; i++) {
        var p = knownPrefixes[i];
        var regSuffix = new RegExp("(?:^|[\\s_.-])(?:(\\d+)\\s*)?(" + p + ")(?:\\s*[-_]?\\s*(\\d+))?(?:[\\s_.-]|$)", "i");
        var m = regSuffix.exec(cleaned);
        if (m) {
            matchedPfx = p;
            var numCandidate = m[1] || m[3];
            if (numCandidate) {
                var pNum = parseInt(numCandidate, 10);
                if (!isNaN(pNum)) {
                    matchedNumVal = pNum;
                    matchedNumDigits = numCandidate.length;
                }
            }
            break;
        }
    }

    if (matchedPfx === "NAMAZ" || matchedPfx === "NIKAAH" || matchedPfx === "NIKAH") matchedPfx = "N";
    else if (matchedPfx === "BETHAK") matchedPfx = "AQ";
    else if (matchedPfx === "ZIYARAT" || matchedPfx === "ZIARAT") matchedPfx = "Z";
    else if (matchedPfx === "MAJLIS") matchedPfx = "M";
    else if (matchedPfx === "QADAM") matchedPfx = "Q";

    if (!matchedPfx) {
        return { prefix: "OTHER", numVal: null, numDigits: 2, hasNum: false };
    }

    return {
        prefix: matchedPfx,
        numVal: matchedNumVal,
        numDigits: matchedNumDigits,
        hasNum: (matchedNumVal !== null)
    };
}

function getMarkerColorIndexForPrefix(pfx) {
    if (!pfx) return 5; // White
    var u = String(pfx).toUpperCase().replace(/^\s+|\s+$/g, "");
    if (typeof EVENT_DEFS !== "undefined" && EVENT_DEFS[u] && EVENT_DEFS[u].colorIndex !== undefined) {
        return EVENT_DEFS[u].colorIndex;
    }
    return 5; // White (Default/Other)
}

function legacy_getMarkerColorIndexForPrefix(pfx) {
    if (!pfx) return 5; // White
    var u = String(pfx).toUpperCase().replace(/^\s+|\s+$/g, "");
    if (u === "WAAZ") return 3; // Orange
    if (u === "MZ" || u === "BZ") return 2; // Purple
    if (u === "AQ" || u === "BM") return 7; // Cyan
    if (u === "ID" || u === "Z") return 6; // Blue
    if (u === "Q" || u === "BQ") return 1; // Red
    if (u === "M") return 0; // Green
    if (u === "N") return 4; // Yellow
    return 5; // White (Default/Other)
}

// ----------------------
// Native ScriptUI Modal Dialog spanning entire Adobe Premiere workspace
// ----------------------
$.runScript.showWorkspaceModal = function(title, subtitle, bodyContent, statusType) {
    try {
        var win = new Window("dialog", title || "One Tap Workstation");
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 14;
        win.margins = 20;

        // Header block
        var hGroup = win.add("group");
        hGroup.orientation = "column";
        hGroup.alignChildren = ["center", "center"];
        hGroup.spacing = 5;

        var iconPrefix = "✓ ";
        if (statusType === "ERROR") iconPrefix = "❌ ";
        else if (statusType === "WARNING") iconPrefix = "⚠️ ";
        else if (statusType === "INFO") iconPrefix = "ℹ️ ";

        var titleTxt = hGroup.add("statictext", undefined, iconPrefix + (title || "One Tap"));
        try { titleTxt.graphics.font = ScriptUI.newFont("Segoe UI", "BOLD", 15); } catch (eF1) {}

        if (subtitle) {
            var subTxt = hGroup.add("statictext", undefined, subtitle);
            try { subTxt.graphics.font = ScriptUI.newFont("Segoe UI", "REGULAR", 12); } catch (eF2) {}
        }

        // Body Content Panel
        if (bodyContent && bodyContent.length > 0) {
            var pnl = win.add("panel", undefined, "Summary & Details");
            pnl.alignChildren = ["fill", "top"];
            pnl.margins = 14;
            pnl.spacing = 8;

            var eBox = pnl.add("edittext", [0, 0, 520, 240], bodyContent, { multiline: true, readonly: true, scrollable: true });
            try { eBox.graphics.font = ScriptUI.newFont("Segoe UI", "REGULAR", 12); } catch (eF3) {}
        }

        // Action Buttons
        var bGroup = win.add("group");
        bGroup.alignment = ["center", "bottom"];
        var okBtn = bGroup.add("button", undefined, "OK / Continue", { name: "ok" });
        okBtn.preferredSize = [140, 34];
        okBtn.onClick = function() {
            win.close();
        };

        win.center();
        win.show();
        return "SUCCESS";
    } catch (eModal) {
        return "ERROR: " + eModal.toString();
    }
};

// ----------------------
// Import Media XML Sequence (One Tap Workstation Integration)
// High-Speed Multi-Tier XML Locator:
// 1. Shared Recent XML Tracker File (written by One Tap Workstation in 0ms)
// 2. Active Premiere Pro Project directory + Parent + Subfolders (XML, Sequences)
// 3. Project Bin Media item filepaths (discovers exact Date folder)
// 4. Fallback File Picker with pre-focused target directory
// ----------------------
// High-Speed Multi-Tier XML Locator (< 1ms):
// 1. Project Directory & BaseName Resolution (with clean suffix stripping)
// 2. Recursive Media Bin Traversal & Active Sequence Footage Directory Discovery
// 3. Fast C++ Native Wildcard Scan (*.xml) in Candidate Directories
// 4. One Tap Shared Recent XML Tracker File Resolution (Newest + Key=Value)
// 5. Pre-focused File Picker Fallback with Instant Auto-Remember
// ----------------------
$.runScript.locateMatchingXmlFile = function() {
    var candidateDirs = [];
    var baseName = "";
    var dateMatch = null;

    function cleanBaseName(rawName) {
        if (!rawName) return "";
        return rawName.replace(/\.prproj$/i, "")
                      .replace(/\.xml$/i, "")
                      .replace(/--\d+$/, "")
                      .replace(/-\d+$/, "")
                      .replace(/\s*-\s*Copy(?:\s*\(\d+\))?$/i, "")
                      .replace(/\s*\(\d+\)$/, "")
                      .replace(/_(?:EDIT|FINAL|MASTER|SEQ|SEQUENCE)$/i, "")
                      .replace(/^\s+|\s+$/g, "");
    }

    // 1. Resolve Project Base Name and Project Directory
    if (app.project) {
        if (app.project.path) {
            var pPath = app.project.path;
            var pFile = new File(pPath);
            if (!pFile.exists) {
                try { pFile = new File(decodeURI(pPath)); } catch(eDec) {}
            }
            if (!pFile.exists) {
                try { pFile = new File(unescape(pPath)); } catch(eUn) {}
            }
            if (pFile.exists) {
                baseName = cleanBaseName(pFile.name);
                var pFolder = pFile.parent;
                if (pFolder && pFolder.exists) {
                    if (/^(?:auto-?save|projects?|pr|premiere)$/i.test(pFolder.name) && pFolder.parent && pFolder.parent.exists) {
                        candidateDirs.push(pFolder.parent);
                    }
                    candidateDirs.push(pFolder);
                }
            }
        }
        if (!baseName && app.project.name) {
            baseName = cleanBaseName(app.project.name);
        }
        if (!baseName && app.project.activeSequence && app.project.activeSequence.name) {
            baseName = cleanBaseName(app.project.activeSequence.name);
        }
    }

    if (baseName) {
        var dm = baseName.match(/\d{4}-\d{2}-\d{2}/);
        if (dm) dateMatch = dm[0];
    }

    // 2. Discover Media Clip Parent Directories from Project Bins & Timeline
    try {
        function findMediaInBin(binItem, maxDepth) {
            if (!binItem || maxDepth <= 0) return null;
            if (typeof binItem.getMediaPath === "function") {
                var mp = binItem.getMediaPath();
                if (mp) return mp;
            }
            if (binItem.children && binItem.children.numItems > 0) {
                var limit = Math.min(binItem.children.numItems, 20);
                for (var b = 0; b < limit; b++) {
                    var found = findMediaInBin(binItem.children[b], maxDepth - 1);
                    if (found) return found;
                }
            }
            return null;
        }

        if (app.project && app.project.rootItem) {
            var mediaPath = findMediaInBin(app.project.rootItem, 4);
            if (mediaPath) {
                var mf = new File(mediaPath);
                if (!mf.exists) {
                    try { mf = new File(decodeURI(mediaPath)); } catch(eD2) {}
                }
                if (mf.exists && mf.parent && mf.parent.exists) {
                    candidateDirs.push(mf.parent);
                    if (mf.parent.parent && mf.parent.parent.exists) {
                        candidateDirs.push(mf.parent.parent);
                    }
                }
            }
        }

        if (app.project && app.project.activeSequence) {
            var aSeq = app.project.activeSequence;
            if (aSeq.videoTracks && aSeq.videoTracks.numTracks > 0) {
                var v0 = aSeq.videoTracks[0];
                if (v0 && v0.clips && v0.clips.numItems > 0) {
                    var c0 = v0.clips[0];
                    if (c0.projectItem && typeof c0.projectItem.getMediaPath === "function") {
                        var cp = c0.projectItem.getMediaPath();
                        if (cp) {
                            var cf = new File(cp);
                            if (cf.exists && cf.parent && cf.parent.exists) {
                                candidateDirs.push(cf.parent);
                                if (cf.parent.parent && cf.parent.parent.exists) {
                                    candidateDirs.push(cf.parent.parent);
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch(eMediaScan) {}

    // 3. Check Candidate Directories for XML (Instant C++ wildcard *.xml)
    var seenDirs = {};
    for (var d = 0; d < candidateDirs.length; d++) {
        var dir = candidateDirs[d];
        if (!dir || !dir.exists) continue;
        var dirKey = dir.fsName.toLowerCase();
        if (seenDirs[dirKey]) continue;
        seenDirs[dirKey] = true;

        // 3a. Direct check for <baseName>.xml using native File constructor
        if (baseName) {
            var exactCandidate = new File(dir, baseName + ".xml");
            if (exactCandidate.exists) return exactCandidate;
        }

        // 3b. Direct check for <dirName>.xml
        var dirCandidate = new File(dir, dir.name + ".xml");
        if (dirCandidate.exists) return dirCandidate;

        // 3c. Fast native C++ wildcard scan *.xml
        try {
            var xmls = dir.getFiles("*.xml");
            if (xmls && xmls.length > 0) {
                if (xmls.length === 1) return xmls[0];

                if (baseName) {
                    var bLow = baseName.toLowerCase();
                    for (var x = 0; x < xmls.length; x++) {
                        var xName = xmls[x].name.toLowerCase().replace(/\.xml$/i, "");
                        if (xName === bLow || xName.indexOf(bLow) !== -1 || bLow.indexOf(xName) !== -1) {
                            return xmls[x];
                        }
                    }
                }
                if (dateMatch) {
                    for (var x2 = 0; x2 < xmls.length; x2++) {
                        if (xmls[x2].name.indexOf(dateMatch) !== -1) return xmls[x2];
                    }
                }
                xmls.sort(function(a, b) {
                    var tA = a.modified ? a.modified.getTime() : 0;
                    var tB = b.modified ? b.modified.getTime() : 0;
                    return tB - tA;
                });
                return xmls[0];
            }
        } catch(eWild) {}

        // 3d. Check subfolders XML/, Sequences/
        var subNames = ["XML", "xml", "Sequences", "sequences", "Final", "final"];
        for (var sn = 0; sn < subNames.length; sn++) {
            var sFolder = new Folder(dir, subNames[sn]);
            if (sFolder.exists) {
                var sXmls = sFolder.getFiles("*.xml");
                if (sXmls && sXmls.length > 0) {
                    sXmls.sort(function(a, b) {
                        var tA = a.modified ? a.modified.getTime() : 0;
                        var tB = b.modified ? b.modified.getTime() : 0;
                        return tB - tA;
                    });
                    return sXmls[0];
                }
            }
        }
    }

    // 4. Check One Tap Shared Recent XML Tracker File(s)
    var trackerLocations = [
        Folder.temp.fsName + "/.onetap_recent_xml.txt",
        Folder.temp.fsName + "/recent_xml.txt",
        Folder.userData.fsName + "/OneTap/recent_xml.txt",
        Folder.userData.fsName + "/UniDesk_App/recent_xml.txt",
        Folder.userData.fsName + "/recent_xml.txt",
        Folder.myDocuments.fsName + "/.onetap_recent_xml.txt"
    ];
    for (var t = 0; t < trackerLocations.length; t++) {
        try {
            var trkFile = new File(trackerLocations[t]);
            if (trkFile.exists) {
                trkFile.open("r");
                var linesContent = trkFile.read();
                trkFile.close();
                if (linesContent) {
                    var lines = linesContent.split(/[\r\n]+/);
                    for (var li = 0; li < lines.length; li++) {
                        var line = lines[li].replace(/^\s+|\s+$/g, "");
                        if (!line || line.indexOf("#") === 0) continue;
                        var linePath = line;
                        if (line.indexOf("=") !== -1) {
                            var parts = line.split("=");
                            var k = parts[0].replace(/^\s+|\s+$/g, "");
                            var v = parts[1].replace(/^\s+|\s+$/g, "");
                            if (baseName && k.toLowerCase() === baseName.toLowerCase()) linePath = v;
                            else if (dateMatch && k.indexOf(dateMatch) !== -1) linePath = v;
                            else linePath = v;
                        }
                        var cand = new File(linePath);
                        if (cand.exists && /\.xml$/i.test(cand.name)) {
                            if (!baseName || cand.name.toLowerCase().indexOf(baseName.toLowerCase()) !== -1 || (dateMatch && cand.name.indexOf(dateMatch) !== -1)) {
                                return cand;
                            }
                            for (var cd = 0; cd < candidateDirs.length; cd++) {
                                if (cand.parent && cand.parent.fsName.toLowerCase() === candidateDirs[cd].fsName.toLowerCase()) {
                                    return cand;
                                }
                            }
                        }
                    }
                    var topCand = new File(lines[0].replace(/^\s+|\s+$/g, ""));
                    if (topCand.exists && /\.xml$/i.test(topCand.name)) {
                        return topCand;
                    }
                }
            }
        } catch(eTrk) {}
    }

    // 5. Pre-focused File Picker Fallback (instant folder focus, remembers choice)
    var defaultDir = (candidateDirs.length > 0 && candidateDirs[0].exists) ? candidateDirs[0] : Folder.myDocuments;
    try { Folder.current = defaultDir; } catch(eCur) {}

    var picked = File.openDialog("Locate Sequence XML File to Import", "XML Files:*.xml,All Files:*.*");
    if (picked && picked.exists) {
        try {
            var saveTrk = new File(Folder.temp.fsName + "/.onetap_recent_xml.txt");
            saveTrk.open("w");
            saveTrk.write(picked.fsName + "\n" + (baseName ? (baseName + "=" + picked.fsName) : ""));
            saveTrk.close();
        } catch(eSave) {}
        return picked;
    }

    return null;
};

$.runScript.browseForXmlFile = function() {
    try {
        var defaultFolder = Folder.myDocuments;
        try {
            if (app.project && app.project.path) {
                var pf = new File(app.project.path);
                if (pf.exists && pf.parent && pf.parent.exists) defaultFolder = pf.parent;
            }
        } catch(eDef) {}

        try { Folder.current = defaultFolder; } catch(eCur) {}

        var picked = File.openDialog("Select XML Sequence File to Import", "XML Files:*.xml,All Files:*.*");
        if (picked && picked.exists) {
            return "SUCCESS|||" + picked.fsName;
        }
        return "CANCEL|||User cancelled XML file selection.";
    } catch(err) {
        return "ERROR|||" + err.toString();
    }
};

$.runScript.importMediaXml = function(explicitXmlPath) {
    try {
        if (!app.project) {
            return "ERROR|||No project is currently open in Premiere Pro. Please open or create a project first.";
        }

        var targetXml = null;
        if (explicitXmlPath && typeof explicitXmlPath === "string" && explicitXmlPath.replace(/^\s+|\s+$/g, "")) {
            var cleanP = explicitXmlPath.replace(/^\s+|\s+$/g, "");
            targetXml = new File(cleanP);
            if (!targetXml.exists) {
                try { targetXml = new File(decodeURIComponent(cleanP)); } catch(eDec) {}
            }
        }

        if (!targetXml || !targetXml.exists) {
            targetXml = $.runScript.locateMatchingXmlFile();
        }

        if (!targetXml || !targetXml.exists) {
            var notFoundMsg = "Could not locate matching sequence XML file.\n\nPlease select the generated .xml file or generate your project in One Tap first.";
            $.runScript.showWorkspaceModal("One Tap — Locate XML", "XML File Not Found", notFoundMsg, "WARNING");
            return "ERROR|||Could not locate sequence XML file.";
        }

        var baseName = targetXml.name.replace(/\.xml$/i, "");

        // Snapshot existing sequence IDs to easily identify the newly imported sequence
        var existingSeqIDs = {};
        try {
            if (app.project && app.project.sequences) {
                for (var i = 0; i < app.project.sequences.numSequences; i++) {
                    var s = app.project.sequences[i];
                    if (s && s.sequenceID) existingSeqIDs[s.sequenceID] = true;
                }
            }
        } catch (eSeqSnap) {}

        // Import the XML file into Premiere Pro
        var importSuccess = false;
        try {
            // Tier 1: suppressUI = false
            try {
                importSuccess = app.project.importFiles([targetXml.fsName], false, app.project.rootItem, false);
            } catch (e1) {
                importSuccess = false;
            }
            if (!importSuccess) { // Tier 2: forward slashes
                try {
                    importSuccess = app.project.importFiles([targetXml.fsName.replace(/\\/g, "/")], false, app.project.rootItem, false);
                } catch (e2) {}
            }
            if (!importSuccess) { // Tier 3: suppressUI = true
                try {
                    importSuccess = app.project.importFiles([targetXml.fsName], true, app.project.rootItem, false);
                } catch (e3) {}
            }
        } catch (eImp) {
            if (true) { $.runScript.showWorkspaceModal("One Tap — XML Import Error", "Import Failed", eImp.toString(), "ERROR");
            return "ERROR|||Import exception: " + eImp.toString();
        }





        }

        // Locate the newly imported sequence
        var targetSeq = null;
        var numSequencesAfter = 0;
        try { numSequencesAfter = app.project.sequences.numSequences; } catch (eNum) { numSequencesAfter = 0; }

        for (var j = 0; j < numSequencesAfter; j++) {
            var candidateSeq = app.project.sequences[j];
            if (candidateSeq && candidateSeq.sequenceID && !existingSeqIDs[candidateSeq.sequenceID]) {
                targetSeq = candidateSeq;
                break;
            }
        }

        // Fallback: match by sequence name or baseName
        if (!targetSeq) {
            for (var k = 0; k < numSequencesAfter; k++) {
                var c = app.project.sequences[k];
                if (c && c.name) {
                    var cNameLower = c.name.toLowerCase();
                    var baseLower = baseName.toLowerCase();
                    if (cNameLower === baseLower || cNameLower.indexOf(baseLower) !== -1 || baseLower.indexOf(cNameLower) !== -1) {
                        targetSeq = c;
                        break;
                    }
                }
            }
        }

        // Fallback: search recursively inside project rootItem bins for the imported Sequence
        if (!targetSeq) {
            function findSeqInItem(item) {
                if (!item) return null;
                if (typeof item.isSequence === "function" && item.isSequence()) {
                    return item;
                }
                if (item.children && item.children.numItems > 0) {
                    for (var ci = 0; ci < item.children.numItems; ci++) {
                        var res = findSeqInItem(item.children[ci]);
                        if (res) return res;
                    }
                }
                return null;
            }
            try {
                var seqProjItem = findSeqInItem(app.project.rootItem);
                if (seqProjItem && seqProjItem.getSequence) {
                    targetSeq = seqProjItem.getSequence();
                }
            } catch (eBinScan) {}
        }

        if (!targetSeq && numSequencesAfter > 0) {
            targetSeq = app.project.sequences[numSequencesAfter - 1];
        }
        if (!targetSeq) {
            targetSeq = app.project.activeSequence;
        }

        // Auto-relink pass: immediately resolve any offline media clips from imported XML
        try {
            var xmlFolder = targetXml.parent ? targetXml.parent.fsName : "";
            function relinkProjectItem(item) {
                if (!item) return;
                if (typeof item.isOffline === "function" && item.isOffline()) {
                    var mPath = "";
                    try { mPath = item.getMediaPath(); } catch(eMp) {}
                    if (mPath && mPath.indexOf("file://") === 0) {
                        var decodedPath = mPath.replace(/^file:\/\/(localhost)?\/?/i, "");
                        decodedPath = decodeURIComponent(decodedPath);
                        if (/^\/[a-zA-Z]:/.test(decodedPath)) decodedPath = decodedPath.substring(1);
                        var checkF = new File(decodedPath);
                        if (checkF.exists && typeof item.changeMediaPath === "function") {
                            item.changeMediaPath(checkF.fsName, true);
                            return;
                        }
                    }
                    if (xmlFolder && item.name) {
                        var localCandidate = new File(xmlFolder + "/" + item.name);
                        if (localCandidate.exists && typeof item.changeMediaPath === "function") {
                            item.changeMediaPath(localCandidate.fsName, true);
                            return;
                        }
                    }
                }
                if (item.children && item.children.numItems > 0) {
                    for (var cIdx = 0; cIdx < item.children.numItems; cIdx++) {
                        relinkProjectItem(item.children[cIdx]);
                    }
                }
            }
            relinkProjectItem(app.project.rootItem);
        } catch(eRelink) {}

        // Open sequence in Timeline and activate
        if (targetSeq) {
            try {
                if (typeof app.project.openSequence === "function" && targetSeq.sequenceID) {
                    try { app.project.openSequence(targetSeq); } catch (eOpenObj) {
                        if (targetSeq.sequenceID) app.project.openSequence(targetSeq.sequenceID);
                    }
                }
            } catch (eOpenSeq) {}
            try { app.project.activeSequence = targetSeq; } catch (eActiveSeq) {}

            var successModalBody = "File: " + targetXml.name + "\n" +
                                   "Opened Sequence: " + targetSeq.name + "\n\n" +
                                   "All media clips and event markers have been successfully placed in the Timeline!";
            $.runScript.showWorkspaceModal("One Tap — XML Sequence Ready", "Import Completed & Timeline Opened", successModalBody, "SUCCESS");

            return "SUCCESS|||Successfully imported '" + targetXml.name + "' and opened sequence '" + targetSeq.name + "' in Timeline!";
        }

        $.runScript.showWorkspaceModal("One Tap — XML Imported", "Import Completed", "File: " + targetXml.name + " has been added to your project items.", "SUCCESS");
        return "SUCCESS|||Successfully imported '" + targetXml.name + "' into project!";
    } catch (err) {
        $.runScript.showWorkspaceModal("One Tap — XML Import Error", "Unexpected Exception", err.toString(), "ERROR");
        return "ERROR|||" + err.toString();
    }
};

// ----------------------
// Helper: Check if clip/marker name matches Group Photo keywords or GP / GPn pattern
function isGroupPhotoName(name) {
    if (!name) return false;
    var s = String(name).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/^\s+|\s+$/g, "");
    if (/group\s*photo|group\s*video|group\s*pic|nikah\s*group|nikaah\s*group|nikah\s*photo|nikaah\s*photo|nikah\s*video|nikaah\s*video/i.test(s)) return true;
    if (/(?:^|[\s_.-])gp(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(s)) return true;
    if (/^gp\s*\d*$/i.test(s)) return true;
    if (/\s*-\s*(?:group\s*photo|gp\b)/i.test(s)) return true;
    return false;
}

// Helper: Robust check for Mango (Color 7) or Lavender (Color 3 / 8) on TrackItem or ProjectItem
function isMangoOrLavenderColor(c) {
    if (!c) return false;
    var vals = [];
    try {
        if (typeof c.getColorLabel === "function") vals.push(c.getColorLabel());
        else if (c.colorLabel !== undefined) vals.push(c.colorLabel);
    } catch(e) {}
    try {
        if (c.projectItem) {
            if (typeof c.projectItem.getColorLabel === "function") vals.push(c.projectItem.getColorLabel());
            else if (c.projectItem.colorLabel !== undefined) vals.push(c.projectItem.colorLabel);
        }
    } catch(e) {}

    for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        if (v === null || v === undefined) continue;
        // In Premiere Pro: 7 = Mango, 3 = Lavender, 8 = Purple / Lavender alternate
        if (v === 7 || v === 3 || v === 8) return true;
        var s = String(v).toLowerCase();
        if (s === "7" || s === "3" || s === "8") return true;
        if (s.indexOf("mango") !== -1 || s.indexOf("lavender") !== -1 || s.indexOf("purple") !== -1) return true;
    }
    return false;
}

// Helper: Extract numeric GP index from name (defaults to 1)
function extractGpNumber(name) {
    if (!name) return 1;
    var s = String(name).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/^\s+|\s+$/g, "");
    var m = s.match(/(?:group[_\s-]*(?:photo|video)|gp)[_\s-]*(\d+)/i);
    if (m && m[1]) return parseInt(m[1], 10);
    var m2 = s.match(/(\d+)[_\s-]*(?:group[_\s-]*(?:photo|video)|gp)/i);
    if (m2 && m2[1]) return parseInt(m2[1], 10);
    return 1;
}

// ============================================================================
// TIMELINE INSERTION: Ripple Insert Target Clip at Marker End Positions
// 1. Target clip placed at the exact end of every detected marker
// 2. Extracts & sorts marker end times chronologically first
// 3. Loops backward (reverse order) from last to first to preserve coordinates
// 4. Uses targetTrack.insertClip(projectItem, timeInSeconds) for native ripple
// 5. Consistent Time units (.seconds / Time object)
// 6. Safe track targeting bounds check
// ============================================================================
function insertClipAtMarkerEndPoints(targetProjectItem, targetTrackIndex) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return false;

        // Rule 7: Track Targeting Safety
        if (typeof targetTrackIndex !== "number" || targetTrackIndex < 0 || targetTrackIndex >= seq.videoTracks.numTracks) {
            targetTrackIndex = 0;
        }
        var targetTrack = seq.videoTracks[targetTrackIndex];
        if (!targetTrack || !targetProjectItem) return false;

        // Rule 3: Collect & Sort Marker End Times First
        var markerEndTimes = [];
        var markers = seq.markers;
        if (!markers) return false;

        var curMarker = markers.getFirstMarker();
        while (curMarker) {
            var endSec = 0;
            if (curMarker.end && !isNaN(curMarker.end.seconds) && curMarker.end.seconds > 0) {
                endSec = curMarker.end.seconds;
            } else if (curMarker.start && !isNaN(curMarker.start.seconds)) {
                endSec = curMarker.start.seconds;
            }
            if (endSec > 0) {
                markerEndTimes.push(endSec);
            }
            curMarker = markers.getNextMarker(curMarker);
        }

        // Sort chronologically (ascending order)
        markerEndTimes.sort(function(a, b) {
            return a - b;
        });

        // Rule 4: Loop Backward (Reverse Order): Iterate from the last marker to the first
        // Prevents earlier ripple insertions from shifting subsequent marker positions
        var insertedCount = 0;
        for (var i = markerEndTimes.length - 1; i >= 0; i--) {
            var timeInSeconds = markerEndTimes[i];

            // Rule 6: Consistent Time Units
            var insertTime = new Time();
            insertTime.seconds = timeInSeconds;

            // Rule 5: Use Ripple Insert (insertClip) instead of overwriteClip()
            try {
                targetTrack.insertClip(targetProjectItem, insertTime);
                insertedCount++;
            } catch (e1) {
                try {
                    targetTrack.insertClip(targetProjectItem, timeInSeconds);
                    insertedCount++;
                } catch (e2) {}
            }
        }

        return insertedCount > 0;
    } catch (eAll) {
        return false;
    }
}
$.runScript.insertClipAtMarkerEndPoints = insertClipAtMarkerEndPoints;

// ----------------------
// Distribute Nikah Group Photo Video across all Nikah (N) Sections with Non-Destructive Multi-Track Ripple Insert
// Shifts downstream video/audio footage forward so NO content is cut or lost
// ----------------------
$.runScript.distributeNikahGroupPhoto = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) {
            $.runScript.showWorkspaceModal("One Tap — Nikah Group Photo", "No Active Sequence", "Please open a sequence in Premiere Pro before running this tool.", "ERROR");
            return "ERROR|||No active sequence found.";
        }

        // Enable QE DOM if available for enhanced timeline operations
        try {
            if (typeof app.enableQE === "function") {
                app.enableQE();
            }
        } catch (eQE) {}

        // Helper: Convert seconds to Time object
        function toTime(sec) {
            var t = new Time();
            t.seconds = Math.max(0, Number(sec));
            return t;
        }

        // Helper: Format seconds to MM:SS
        function formatSec(sec) {
            var total = Math.floor(Math.max(0, Number(sec)));
            var m = Math.floor(total / 60);
            var s = total % 60;
            return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        }

        // 1. Identify all Nikah (N) markers & ceremonies first
        var markers = seq.markers;
        var nikahSegments = [];
        var allMarkersList = [];
        if (markers) {
            var curM = markers.getFirstMarker();
            while (curM) {
                var mStart = (curM.start && !isNaN(Number(curM.start.seconds))) ? Number(curM.start.seconds) : 0;
                var mEnd = (curM.end && !isNaN(Number(curM.end.seconds))) ? Number(curM.end.seconds) : 0;
                var mDur = (curM.duration && !isNaN(Number(curM.duration.seconds))) ? Number(curM.duration.seconds) : 0;
                allMarkersList.push({
                    obj: curM,
                    name: curM.name || "",
                    startSec: mStart,
                    endSec: (mEnd > mStart) ? mEnd : (mStart + mDur)
                });
                curM = markers.getNextMarker(curM);
            }
        }

        allMarkersList.sort(function(a, b) { return a.startSec - b.startSec; });

        for (var mi = 0; mi < allMarkersList.length; mi++) {
            var itemM = allMarkersList[mi];
            var isNikah = isStrictNikaahMarker(itemM.name);
            if (isNikah) {
                var s = itemM.startSec;
                var e = itemM.endSec;
                if (e <= s) {
                    if (mi < allMarkersList.length - 1) {
                        e = allMarkersList[mi + 1].startSec;
                    } else {
                        var foundClipEnd = null;
                        if (seq.videoTracks && seq.videoTracks.numTracks > 0) {
                            var vTrk0 = seq.videoTracks[0];
                            if (vTrk0 && vTrk0.clips) {
                                for (var vci = 0; vci < vTrk0.clips.numItems; vci++) {
                                    var vc = vTrk0.clips[vci];
                                    if (vc && vc.start && vc.start.seconds >= (s - 0.5)) {
                                        var ce = vc.end ? vc.end.seconds : 0;
                                        if (ce > s) {
                                            foundClipEnd = ce;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        if (foundClipEnd !== null) {
                            e = foundClipEnd;
                        } else {
                            try {
                                var sEnd = Number(seq.end && seq.end.seconds);
                                if (isFinite(sEnd) && sEnd > s) e = sEnd;
                                else e = s + 10;
                            } catch (eS) { e = s + 10; }
                        }
                    }
                }
                nikahSegments.push({
                    name: itemM.name,
                    startSec: s,
                    endSec: e
                });
            }
        }

        // Fallback: Scan timeline clips if no markers found
        if (nikahSegments.length === 0 && seq.videoTracks) {
            var clipCandidates = [];
            for (var fvi = 0; fvi < seq.videoTracks.numTracks; fvi++) {
                var fTrk = seq.videoTracks[fvi];
                if (!fTrk || !fTrk.clips) continue;
                for (var fci = 0; fci < fTrk.clips.numItems; fci++) {
                    var fc = fTrk.clips[fci];
                    if (!fc) continue;
                    var fcNm = fc.name || (fc.projectItem && fc.projectItem.name) || "";
                    if (isStrictNikaahMarker(fcNm)) {
                        var fStart = (fc.start && !isNaN(Number(fc.start.seconds))) ? Number(fc.start.seconds) : 0;
                        var fEnd   = (fc.end   && !isNaN(Number(fc.end.seconds)))   ? Number(fc.end.seconds)   : 0;
                        clipCandidates.push({
                            name: fcNm,
                            startSec: fStart,
                            endSec: fEnd
                        });
                    }
                }
            }
            if (clipCandidates.length > 0) {
                clipCandidates.sort(function(a, b) { return a.startSec - b.startSec; });
                for (var cki = 0; cki < clipCandidates.length; cki++) {
                    nikahSegments.push(clipCandidates[cki]);
                }
            }
        }

        if (nikahSegments.length === 0) {
            var noNMsg = "No Nikah markers or timeline clips (containing 'N', 'N01', 'Nikah') were found in this sequence.\n\n" +
                         "Please run 'Auto In/Out Markers' first or verify that your Nikah sections are present on timeline.";
            $.runScript.showWorkspaceModal("One Tap — Nikah Group Photo", "No Nikah Sections Found", noNMsg, "WARNING");
            return "ERROR|||No Nikah sections found in sequence.";
        }

        // Sort Nikah segments chronologically and assign 1-based sequence numbers
        nikahSegments.sort(function(a, b) { return a.startSec - b.startSec; });
        for (var nsi = 0; nsi < nikahSegments.length; nsi++) {
            nikahSegments[nsi].seqNum = nsi + 1;
        }

        // 2. Candidate Detection: 3-stage hierarchy to find default clip suggestion
        var detectedClipName = "";
        var detectedTrackIndex = 0;

        // Stage 1: Mango / Lavender Color Label (Highest Priority - Color 7 or 8)
        try {
            var vtA0 = seq.videoTracks;
            if (vtA0) {
                for (var ti0 = 0; ti0 < vtA0.numTracks; ti0++) {
                    var trk0 = vtA0[ti0];
                    if (!trk0 || !trk0.clips) continue;
                    for (var ci0 = 0; ci0 < trk0.clips.numItems; ci0++) {
                        var c0 = trk0.clips[ci0];
                        if (!c0) continue;
                        if (isMangoOrLavenderColor(c0)) {
                            detectedClipName = c0.name || (c0.projectItem && c0.projectItem.name) || "";
                            detectedTrackIndex = ti0;
                            break;
                        }
                    }
                    if (detectedClipName) break;
                }
            }
        } catch (eMango) {}

        // Stage 2: Current Timeline Selection
        if (!detectedClipName) {
            try {
                var sel = seq.getSelection();
                if (sel && sel.length > 0) {
                    for (var s = 0; s < sel.length; s++) {
                        var itm = sel[s];
                        if (itm && (itm.mediaType === "VIDEO" || itm.projectItem)) {
                            detectedClipName = itm.name || (itm.projectItem && itm.projectItem.name) || "";
                            break;
                        }
                    }
                }
            } catch (eSel) {}
        }

        // Stage 3: Bin / Timeline clip matching "Group Photo" / "GP" keywords
        if (!detectedClipName) {
            try {
                for (var ti1 = 0; ti1 < seq.videoTracks.numTracks; ti1++) {
                    var trk1 = seq.videoTracks[ti1];
                    if (!trk1 || !trk1.clips) continue;
                    for (var ci1 = 0; ci1 < trk1.clips.numItems; ci1++) {
                        var c1 = trk1.clips[ci1];
                        var c1Nm = c1 ? (c1.name || (c1.projectItem && c1.projectItem.name) || "") : "";
                        if (isGroupPhotoName(c1Nm)) {
                            detectedClipName = c1Nm;
                            detectedTrackIndex = ti1;
                            break;
                        }
                    }
                    if (detectedClipName) break;
                }
            } catch (eGpKw) {}
        }

        // Helper: Resolve a clip by user-entered name (searches Timeline Video Tracks & Project Bins)
        function resolveClipByName(queryName) {
            if (!queryName) return null;
            var cleanQuery = String(queryName).replace(/^\s+|\s+$/g, "");
            if (!cleanQuery) return null;
            var qLower = cleanQuery.toLowerCase();
            var qStem = qLower.replace(/\.[a-z0-9]{2,5}$/i, "");

            // A. Search timeline video tracks
            if (seq.videoTracks) {
                for (var tIdx = 0; tIdx < seq.videoTracks.numTracks; tIdx++) {
                    var vTrack = seq.videoTracks[tIdx];
                    if (!vTrack || !vTrack.clips) continue;
                    for (var clIdx = 0; clIdx < vTrack.clips.numItems; clIdx++) {
                        var cObj = vTrack.clips[clIdx];
                        if (!cObj) continue;
                        var cNm = (cObj.name || "").toLowerCase();
                        var pNm = (cObj.projectItem && cObj.projectItem.name) ? cObj.projectItem.name.toLowerCase() : "";
                        var cStem = cNm.replace(/\.[a-z0-9]{2,5}$/i, "");
                        var pStem = pNm.replace(/\.[a-z0-9]{2,5}$/i, "");

                        if (cNm === qLower || pNm === qLower || cStem === qStem || pStem === qStem ||
                            cNm.indexOf(qStem) !== -1 || pNm.indexOf(qStem) !== -1) {
                            var dur = (cObj.duration && cObj.duration.seconds > 0) ? cObj.duration.seconds : (cObj.end.seconds - cObj.start.seconds);
                            var inP = (cObj.inPoint && !isNaN(Number(cObj.inPoint.seconds))) ? Number(cObj.inPoint.seconds) : 0;
                            var outP = (cObj.outPoint && !isNaN(Number(cObj.outPoint.seconds))) ? Number(cObj.outPoint.seconds) : (inP + dur);
                            return {
                                projectItem: cObj.projectItem,
                                name: cObj.name || (cObj.projectItem && cObj.projectItem.name) || cleanQuery,
                                duration: Math.round(dur * 100) / 100,
                                inPoint: inP,
                                outPoint: outP,
                                trackIndex: tIdx
                            };
                        }
                    }
                }
            }

            // B. Search Project Bins recursively
            function searchBinItems(bin) {
                if (!bin || !bin.children) return null;
                for (var bi = 0; bi < bin.children.numItems; bi++) {
                    var bChild = bin.children[bi];
                    if (!bChild) continue;
                    if (bChild.type === 1) { // Bin
                        var sub = searchBinItems(bChild);
                        if (sub) return sub;
                    } else if (bChild.type === 2 || (bChild.isSequence && bChild.isSequence())) {
                        continue;
                    } else {
                        var bNm = (bChild.name || "").toLowerCase();
                        var bStem = bNm.replace(/\.[a-z0-9]{2,5}$/i, "");
                        if (bNm === qLower || bStem === qStem || bNm.indexOf(qStem) !== -1) {
                            var bIn = (bChild.getInPoint && bChild.getInPoint().seconds > 0) ? bChild.getInPoint().seconds : 0;
                            var bOut = (bChild.getOutPoint && bChild.getOutPoint().seconds > 0) ? bChild.getOutPoint().seconds : 0;
                            var bDur = (bOut > bIn) ? (bOut - bIn) : 0;
                            return {
                                projectItem: bChild,
                                name: bChild.name || cleanQuery,
                                duration: Math.round(bDur * 100) / 100,
                                inPoint: bIn,
                                outPoint: bOut,
                                trackIndex: 0
                            };
                        }
                    }
                }
                return null;
            }

            return searchBinItems(app.project.rootItem);
        }

        // 3. User Input Step: Enter Clip Name & Range for each Group Photo
        // Preview list of found Nikaahs
        var markerListText = "";
        for (var nIdx = 0; nIdx < Math.min(nikahSegments.length, 6); nIdx++) {
            markerListText += (nIdx + 1) + ". " + nikahSegments[nIdx].name + "\n";
        }
        if (nikahSegments.length > 6) {
            markerListText += "... (" + (nikahSegments.length - 6) + " more)\n";
        }

        var groupPhotoAssignments = [];
        var assignedIndices = {};
        var gpCounter = 1;

        while (true) {
            // Count unassigned Nikaahs
            var unassigned = [];
            for (var u = 0; u < nikahSegments.length; u++) {
                if (!assignedIndices[u]) unassigned.push(u + 1);
            }
            if (unassigned.length === 0) break;

            var defaultRangeStr = (unassigned.length === nikahSegments.length)
                ? ("1-" + nikahSegments.length)
                : (unassigned[0] + "-" + unassigned[unassigned.length - 1]);

            var defaultClipName = (gpCounter === 1 && detectedClipName)
                ? detectedClipName
                : ("Group Photo " + gpCounter);

            // Step A: Prompt user to enter Group Photo clip name
            var clipPromptMsg = "Found " + nikahSegments.length + " Nikah ceremony marker(s):\n" +
                                markerListText + "\n" +
                                "Step 1 of 2: Enter Clip Name for Group Photo " + gpCounter + ":\n" +
                                "(Matches clip in Timeline or Project Bins)";

            if (gpCounter > 1) {
                clipPromptMsg = "Remaining unassigned Nikaah(s): " + unassigned.join(", ") + "\n\n" +
                                "Enter Clip Name for Group Photo " + gpCounter + "\n" +
                                "(or leave blank / Cancel to proceed with current assignments):";
            }

            var enteredClipName = prompt(clipPromptMsg, defaultClipName);
            if (enteredClipName === null || enteredClipName.replace(/^\s+|\s+$/g, "") === "") {
                if (groupPhotoAssignments.length > 0) {
                    break; // Proceed with existing assignments
                } else {
                    return "ERROR|||Operation cancelled by user.";
                }
            }

            var resolvedClip = resolveClipByName(enteredClipName);
            if (!resolvedClip) {
                alert("Clip '" + enteredClipName + "' was not found on the Timeline or in Project Bins.\n\nPlease check the exact clip name and try again.");
                continue;
            }

            // Ensure valid duration
            if (resolvedClip.duration <= 0) {
                var dPrompt = prompt("Enter video duration in seconds for '" + resolvedClip.name + "' (e.g. 15):", "15");
                var parsedD = parseFloat(dPrompt);
                resolvedClip.duration = (!isNaN(parsedD) && parsedD > 0) ? parsedD : 15.0;
            }

            // Step B: Prompt user to enter Nikaah range for this clip
            var rangePromptMsg = "Step 2 of 2: Enter Nikaah range for '" + resolvedClip.name + "' (" + resolvedClip.duration + "s):\n\n" +
                                 "Examples:\n" +
                                 "• '1-" + nikahSegments.length + "' (all ceremonies)\n" +
                                 "• '1-4' or '5-8' (specific span)\n" +
                                 "• '1,3,5' (specific individual ceremonies)";

            var enteredRange = prompt(rangePromptMsg, defaultRangeStr);
            if (enteredRange === null || enteredRange.replace(/^\s+|\s+$/g, "") === "") {
                if (groupPhotoAssignments.length > 0) break;
                return "ERROR|||Operation cancelled by user.";
            }

            // Parse selected range indices
            var selectedMap = {};
            var cleanRange = enteredRange.replace(/^\s+|\s+$/g, "").toLowerCase();
            if (cleanRange === "all" || cleanRange === "*") {
                for (var allI = 0; allI < nikahSegments.length; allI++) {
                    selectedMap[allI] = true;
                }
            } else {
                var tokens = cleanRange.split(",");
                for (var tk = 0; tk < tokens.length; tk++) {
                    var tok = tokens[tk].replace(/^\s+|\s+$/g, "");
                    if (tok.indexOf("-") > -1) {
                        var parts = tok.split("-");
                        var startI = parseInt(parts[0], 10);
                        var endI = parseInt(parts[1], 10);
                        if (!isNaN(startI) && !isNaN(endI)) {
                            var minK = Math.min(startI, endI);
                            var maxK = Math.max(startI, endI);
                            for (var curI = minK; curI <= maxK; curI++) {
                                if (curI >= 1 && curI <= nikahSegments.length) {
                                    selectedMap[curI - 1] = true;
                                }
                            }
                        }
                    } else {
                        var sVal = parseInt(tok, 10);
                        if (!isNaN(sVal) && sVal >= 1 && sVal <= nikahSegments.length) {
                            selectedMap[sVal - 1] = true;
                        }
                    }
                }
            }

            var matchedNikaahIndices = [];
            for (var mKey in selectedMap) {
                if (selectedMap.hasOwnProperty(mKey)) {
                    var idx = parseInt(mKey, 10);
                    matchedNikaahIndices.push(idx);
                    assignedIndices[idx] = true;
                }
            }

            if (matchedNikaahIndices.length === 0) {
                alert("No valid Nikaah ceremonies matched the range '" + enteredRange + "'. Please try again.");
                continue;
            }

            groupPhotoAssignments.push({
                clip: resolvedClip,
                indices: matchedNikaahIndices
            });

            gpCounter++;
        }

        if (groupPhotoAssignments.length === 0) {
            return "ERROR|||No group photo assignments configured.";
        }

        // 4. User Confirmation Dialog for Ripple Insertion
        var confirmLines = [];
        var totalCeremonies = 0;
        for (var ga = 0; ga < groupPhotoAssignments.length; ga++) {
            var asgn = groupPhotoAssignments[ga];
            var nNums = [];
            for (var gIdx = 0; gIdx < asgn.indices.length; gIdx++) {
                nNums.push(nikahSegments[asgn.indices[gIdx]].seqNum);
            }
            confirmLines.push("• '" + asgn.clip.name + "' (" + asgn.clip.duration + "s) → Nikaah(s): " + nNums.join(", "));
            totalCeremonies += asgn.indices.length;
        }

        var confirmMsg = "Nikah Group Photo — Ripple Insertion Summary\n\n" +
                         confirmLines.join("\n") + "\n\n" +
                         "Total Ceremonies Receiving Group Photos: " + totalCeremonies + "\n" +
                         "All downstream timeline footage will automatically ripple forward.\n\n" +
                         "Proceed with Timeline Ripple Insertion?";

        var userApproved = true;
        try {
            userApproved = confirm(confirmMsg);
        } catch (eConf) { userApproved = true; }

        if (!userApproved) {
            return "ERROR|||Operation cancelled by user.";
        }

        // 5. Build Flat Work Items & Sort Chronologically (Ascending by Marker End Time)
        // Rule 3: Collect & Sort Marker End Times First
        var insertionWorkList = [];
        for (var ai = 0; ai < groupPhotoAssignments.length; ai++) {
            var itemAsgn = groupPhotoAssignments[ai];
            for (var aj = 0; aj < itemAsgn.indices.length; aj++) {
                var targetSeg = nikahSegments[itemAsgn.indices[aj]];
                insertionWorkList.push({
                    seg: targetSeg,
                    clip: itemAsgn.clip
                });
            }
        }

        insertionWorkList.sort(function(a, b) {
            return (Number(a.seg.endSec) || 0) - (Number(b.seg.endSec) || 0);
        });

        // Determine destination video track safely (Rule 7: Track Targeting Safety)
        var targetTrackIndex = (detectedTrackIndex >= 0 && detectedTrackIndex < seq.videoTracks.numTracks) ? detectedTrackIndex : 0;
        var targetVideoTrack = seq.videoTracks[targetTrackIndex];
        if (!targetVideoTrack) {
            targetVideoTrack = seq.videoTracks[0];
        }

        var placedCount = 0;
        var timeSummary = [];
        var totalExtensionSec = 0;

        // Rule 4: Loop Backward (Reverse Order) from the last marker to the first (i = length - 1; i >= 0; i--)
        // This prevents earlier ripple insertions from shifting subsequent marker coordinates
        for (var wi = insertionWorkList.length - 1; wi >= 0; wi--) {
            var workItem = insertionWorkList[wi];
            var seg = workItem.seg;
            var clip = workItem.clip;
            var insertSec = Number(seg.endSec);
            if (isNaN(insertSec) || insertSec < 0) continue;

            var gpProjectItem = clip.projectItem;
            var groupDuration = clip.duration;
            var sourceInPoint = clip.inPoint;

            // Configure projectItem in/out duration so insertClip takes exactly groupDuration
            try {
                if (typeof gpProjectItem.setInPoint === "function" && sourceInPoint >= 0) {
                    gpProjectItem.setInPoint(toTime(sourceInPoint));
                }
                if (typeof gpProjectItem.setOutPoint === "function" && groupDuration > 0) {
                    gpProjectItem.setOutPoint(toTime(sourceInPoint + groupDuration));
                }
            } catch (eIO) {}

            // Rule 5: Use Ripple Insert (insertClip) instead of overwriteClip()
            // Rule 6: Consistent Time Units
            try {
                var insertTime = toTime(insertSec);
                var insertOk = false;
                try {
                    targetVideoTrack.insertClip(gpProjectItem, insertTime);
                    insertOk = true;
                } catch (eIns1) {
                    try {
                        targetVideoTrack.insertClip(gpProjectItem, insertSec);
                        insertOk = true;
                    } catch (eIns2) {}
                }

                if (insertOk) {
                    placedCount++;
                    totalExtensionSec += groupDuration;
                    var startFormatted = formatSec(insertSec);
                    var endFormatted = formatSec(insertSec + groupDuration);
                    timeSummary.unshift("• " + seg.name + ": '" + clip.name + "' inserted at " + startFormatted + " -> " + endFormatted + " (+" + groupDuration + "s ripple)");

                    // Create Timeline Marker for this Group Photo segment
                    try {
                        var gpMarker = markers.createMarker(insertSec);
                        if (gpMarker) {
                            gpMarker.name = seg.name + " - Group Photo";
                            gpMarker.comments = clip.name + " (" + groupDuration + "s)";
                            gpMarker.end = toTime(insertSec + groupDuration);
                            try { gpMarker.setTypeAsChapter(); } catch(eCh) {}
                        }
                    } catch (eMk) {}
                }
            } catch (ePlaceGp) {}
        }

        totalExtensionSec = Math.round(totalExtensionSec * 10) / 10;
        var summaryBody = "Successfully ripple-inserted across " + placedCount + " Nikah ceremony section(s) on Track V" + (targetTrackIndex + 1) + ":\n\n" +
                          "• Total Timeline Extension: +" + totalExtensionSec + "s\n" +
                          "• All downstream footage & audio tracks rippled forward (0% cuts)\n" +
                          "• Synchronized timeline markers created\n\n" +
                          timeSummary.join("\n");

        $.runScript.showWorkspaceModal("One Tap — Nikah Group Photo Complete", placedCount + " Group Photo Videos Inserted", summaryBody, "SUCCESS");
        return "SUCCESS|||" + placedCount + "|||" + (groupPhotoAssignments[0].clip.name) + "|||" + totalExtensionSec;
    } catch (err) {
        $.runScript.showWorkspaceModal("One Tap — Nikah Group Photo", "Error Processing", err.toString(), "ERROR");
        return "ERROR|||" + err.toString();
    }
};

// =============================================================================
// GROUP PHOTO INSERTER — New Feature (One Tap v26.7+)
// Fully additive — does NOT modify any existing function above.
// =============================================================================

// ── Shared helper: check if project item is a bin ────────────────────────────
function isItemBin(item) {
    if (!item) return false;
    try {
        if (item.type === 1) return true;
        if (typeof ProjectItemType !== "undefined" && item.type === ProjectItemType.BIN) return true;
        if (item.children && typeof item.children.numItems === "number" && item.type !== 2) return true;
    } catch(e) {}
    return false;
}
var childIsBin = isItemBin;

// ── Shared helper: sequence frame rate extractor ─────────────────────────────
function getSequenceFps(seq) {
    if (!seq) return 25.0;
    try {
        var settings = seq.getSettings();
        if (settings && settings.videoFrameRate && settings.videoFrameRate.seconds > 0) {
            return 1.0 / settings.videoFrameRate.seconds;
        }
    } catch(e) {}
    try {
        var tv = seq.timebase;
        if (tv) {
            var fpsNum = parseInt(tv, 10);
            if (!isNaN(fpsNum) && fpsNum > 0) return fpsNum;
        }
    } catch(e2) {}
    return 25.0;
}

// ── Shared helper: extract numeric GP index from string ───────────────────────
// e.g. "1" -> 1, "GP 1" -> 1, "GP1" -> 1, "GROUP_PHOTO_1" -> 1, "GROUP PHOTO 2" -> 2
function extractGpNumberFromString(str) {
    if (!str) return null;
    var s = String(str).replace(/^\s+|\s+$/g, "");
    if (!s) return null;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    var mGp = s.match(/^GP[\s_-]*(\d+)/i);
    if (mGp && mGp[1]) return parseInt(mGp[1], 10);
    var mGroup = s.match(/^GROUP[\s_-]*PHOTO[\s_-]*(\d+)/i);
    if (mGroup && mGroup[1]) return parseInt(mGroup[1], 10);
    var mPhoto = s.match(/\bPHOTO[\s_-]*(\d+)/i);
    if (mPhoto && mPhoto[1]) return parseInt(mPhoto[1], 10);
    return null;
}

// ── Shared helper: extract Nikaah ceremony number from marker / clip label ───
// e.g. "16N" -> 16, "01M-01-16N-40905764" -> 16, "-16N-" -> 16, "NIKAH 16" -> 16
function extractNikaahNumber(markerName) {
    if (!markerName) return null;
    var str = String(markerName).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/^\s+|\s+$/g, "");
    var upper = str.toUpperCase();

    // Explicit exclusions: Namaz and Group Photos
    if (/\bNAMAZ\b/i.test(upper) || /\b(?:GROUP[\s_-]*PHOTO|GP\d*|OT_GP)\b/i.test(upper)) {
        return null;
    }

    // 1. Structure like -43-16N- or _01-16N- or -16N- or _16N_ or -16N
    var m1 = upper.match(/[-_](\d{1,4})[a-zA-Z]?N(?:[-_]|\b|$)/i);
    if (m1 && m1[1]) return parseInt(m1[1], 10);

    // 2. Direct 16N or 16 N or 16-N
    var m2 = upper.match(/^(?:.*[\s-_])?(\d{1,4})[\s-_]*N(?:[\s-_]|\b|$)/i);
    if (m2 && m2[1]) return parseInt(m2[1], 10);

    // 3. N16 or N-16 or N 16
    var m3 = upper.match(/(?:^|[\s-_])N[\s-_]*(\d{1,4})(?:[\s-_]|\b|$)/i);
    if (m3 && m3[1]) return parseInt(m3[1], 10);

    // 4. NIKAH 16 or NIKAAH 16 or NIKAH-16
    var m4 = upper.match(/\bNIKAA?H[\s-_]*(\d{1,4})\b/i);
    if (m4 && m4[1]) return parseInt(m4[1], 10);

    // 5. getPrefixFromMarkerName
    try {
        var info = getPrefixFromMarkerName(markerName);
        if (info && info.numVal !== null && !isNaN(info.numVal)) {
            return info.numVal;
        }
    } catch(eInfo) {}

    // 6. Lone digits if in Nikaah context (e.g. "16")
    var mLone = upper.match(/^(\d{1,4})$/);
    if (mLone && mLone[1]) return parseInt(mLone[1], 10);

    return null;
}

// ── Shared helper: strict Nikaah detection (prefix === "N" only) ──────────────
function isStrictNikaahMarker(markerName) {
    if (!markerName) return false;
    var upper = String(markerName).replace(/\.[a-z0-9]{2,5}$/i, "").toUpperCase();

    // 0. EXCLUDE Namaz explicitly! Namaz is a prayer session, not a Nikaah ceremony.
    if (/\bNAMAZ\b/i.test(upper) || /[-_]NAMAZ[-_]/i.test(upper) || /[-_]NAMAZ$/i.test(upper)) {
        return false;
    }

    // 0b. EXCLUDE Group Photo markers explicitly! Never treat GP as a new ceremony or separation marker.
    if (/\b(?:GROUP[\s_-]*PHOTO|GP\d*|OT_GP)\b/i.test(upper) || /[-_]GP\b/i.test(upper) || isGroupPhotoName(upper)) {
        return false;
    }

    // 1. Direct regex for Miqaat / Ceremony Nikah patterns:
    // e.g. "1448-04-05 _02E-43-27N-60446783", "1448-04-05 _02E-43-N-", "01M-01-27N-", "-27N-", "-N-", "NIKAH", "NIKAAH"
    if (/[-_](?:\d+)?N(?:[-_]|\b|\d)/i.test(upper) ||
        /[-_](?:\d+)?N$/i.test(upper) ||
        /\b(?:NIKAH|NIKAAH)(?:\d+)?\b/i.test(upper) ||
        /^(?:0*\d+[\s-_]*)?(?:N\d*|NIKAH|NIKAAH)(?:[\s-_]|$)/i.test(upper.replace(/^\s+|\s+$/g, ""))) {
        return true;
    }

    var info = getPrefixFromMarkerName(markerName);
    if (info && info.prefix === "N") {
        if (/NAMAZ/i.test(upper)) return false;
        return true;
    }

    return false;
}

// ── Color label palette for GP assignments ────────────────────────────────────
// Palette: 1: Green (13), 2: Purple (8), 3: Lavender (3), 4: Mango (7), 5: Teal (10),
//          6: Caribbean (2), 7: Magenta (11), 8: Rose (6), 9: Iris (1), 10: Cerulean (4)
function getAssignmentColorIndex(asgnIdx) {
    var palette = [13, 8, 3, 7, 10, 2, 11, 6, 1, 4];
    var idx = (parseInt(asgnIdx, 10) - 1) % palette.length;
    if (isNaN(idx) || idx < 0) idx = 0;
    return palette[idx];
}

// ── Shared helper: match Nikaah marker against assigned range ────────────────
function findAssignedObjectForNikaah(nk, assignments) {
    if (!nk || !assignments || assignments.length === 0) return null;
    for (var asi = 0; asi < assignments.length; asi++) {
        var asgn = assignments[asi];
        var lo = Math.min(asgn.fromN, asgn.toN);
        var hi = Math.max(asgn.fromN, asgn.toN);

        var inRange = false;
        if (nk.ceremonyNum !== null && nk.ceremonyNum !== undefined && nk.ceremonyNum >= lo && nk.ceremonyNum <= hi) {
            inRange = true;
        } else if (nk.seqNum !== null && nk.seqNum !== undefined && nk.seqNum >= lo && nk.seqNum <= hi) {
            inRange = true;
        } else if (nk.chronologicalIndex !== null && nk.chronologicalIndex !== undefined && nk.chronologicalIndex >= lo && nk.chronologicalIndex <= hi) {
            inRange = true;
        }

        if (inRange) {
            return asgn;
        }
    }
    return null;
}

function findAssignedKeyForNikaah(nk, assignments) {
    var obj = findAssignedObjectForNikaah(nk, assignments);
    return obj ? obj.clipKey : null;
}

// ── Shared helper: detect GROUP_PHOTO_N sequence markers or clips ─────────────
// Scans sequence markers (or video tracks/bins as fallback) for labels matching GROUP_PHOTO_1..9 / GPn
// Returns array of { gpNum, markerName, comments, markerStartSec, clipName, rawClipName, commentClipName, projectItem, duration, inPoint, outPoint, hasClip }
function detectGroupPhotoSources(seq) {
    var found = [];
    if (!seq) return found;

    var allMarkers = [];
    if (seq.markers) {
        var cur = seq.markers.getFirstMarker();
        while (cur) {
            var nm = (cur.name || "").replace(/^\s+|\s+$/g, "");
            if (isGroupPhotoName(nm)) {
                var gpNum = extractGpNumber(nm);
                var startSec = (cur.start && !isNaN(Number(cur.start.seconds))) ? Number(cur.start.seconds) : 0;
                var comments = cur.comments || "";
                allMarkers.push({ gpNum: gpNum, startSec: startSec, markerName: nm, comments: comments });
            }
            cur = seq.markers.getNextMarker(cur);
        }
    }

    // For each found GP marker, locate the video clip closest to that time or matching by name/comment
    var vt = seq.videoTracks;
    for (var mi = 0; mi < allMarkers.length; mi++) {
        var gpm = allMarkers[mi];
        var bestClip = null;
        var bestDist = 9999999;

        // 1. Time distance check on video tracks
        if (vt) {
            for (var ti = 0; ti < vt.numTracks; ti++) {
                var trk = vt[ti];
                if (!trk || !trk.clips) continue;
                for (var ci = 0; ci < trk.clips.numItems; ci++) {
                    var c = trk.clips[ci];
                    if (!c) continue;
                    var cStart = (c.start && !isNaN(Number(c.start.seconds))) ? Number(c.start.seconds) : 0;
                    var cEnd   = (c.end   && !isNaN(Number(c.end.seconds)))   ? Number(c.end.seconds)   : cStart;
                    var dist = Math.abs(cStart - gpm.startSec);
                    var isInside = (gpm.startSec >= (cStart - 0.25) && gpm.startSec <= (cEnd + 0.25));
                    if ((dist < 3.0 || isInside) && dist < bestDist) {
                        bestDist = dist;
                        bestClip = c;
                    }
                }
            }
        }

        // 2. If not found by time, check marker comments: "Group Photo Source #N (actual_clip_name)"
        var commentClipName = "";
        if (!bestClip && gpm.comments) {
            var mComment = gpm.comments.match(/\(([^)]+)\)/);
            if (mComment && mComment[1]) commentClipName = mComment[1].replace(/^\s+|\s+$/g, "");
            if (commentClipName && vt) {
                for (var tiComment = 0; tiComment < vt.numTracks; tiComment++) {
                    var trkComment = vt[tiComment];
                    if (!trkComment || !trkComment.clips) continue;
                    for (var ciComment = 0; ciComment < trkComment.clips.numItems; ciComment++) {
                        var cc = trkComment.clips[ciComment];
                        if (!cc) continue;
                        var ccCandidates = getClipCandidateStrings(cc);
                        if (isClipMatch(ccCandidates, commentClipName)) {
                            bestClip = cc;
                            break;
                        }
                    }
                    if (bestClip) break;
                }
            }
        }

        // 3. If still not found by time or comments, check for clip matching GP number on timeline
        if (!bestClip && vt) {
            for (var ti2 = 0; ti2 < vt.numTracks; ti2++) {
                var trk2 = vt[ti2];
                if (!trk2 || !trk2.clips) continue;
                for (var ci2 = 0; ci2 < trk2.clips.numItems; ci2++) {
                    var c2 = trk2.clips[ci2];
                    if (!c2) continue;
                    var c2Nm = c2.name || (c2.projectItem && c2.projectItem.name) || "";
                    if (isGroupPhotoName(c2Nm) && extractGpNumber(c2Nm) === gpm.gpNum) {
                        bestClip = c2;
                        break;
                    }
                }
                if (bestClip) break;
            }
        }

        // 4. If still not found, check project bins for commentClipName or GP number
        var projItem = bestClip ? (bestClip.projectItem || null) : null;
        if (!projItem && (commentClipName || gpm.gpNum) && app.project && app.project.rootItem) {
            var searchTarget = commentClipName || ("GP" + gpm.gpNum);
            try {
                function searchProjectForClip(bin) {
                    if (!bin || !bin.children || projItem) return;
                    for (var bi = 0; bi < bin.children.numItems; bi++) {
                        var child = bin.children[bi];
                        if (!child) continue;
                        if (isItemBin(child)) searchProjectForClip(child);
                        else {
                            var bCandidates = [child.name];
                            try { if (typeof child.getMediaPath === "function") bCandidates.push(child.getMediaPath()); } catch(e) {}
                            if (isClipMatch(bCandidates, searchTarget)) {
                                projItem = child;
                                return;
                            }
                        }
                    }
                }
                searchProjectForClip(app.project.rootItem);
            } catch(eProj) {}
        }

        var clipName = "Group Photo " + gpm.gpNum;
        var rawName = "";
        var clipDuration = 0;
        var clipInPoint = 0;
        var clipOutPoint = 0;

        if (bestClip) {
            rawName = bestClip.name || (bestClip.projectItem && bestClip.projectItem.name) || "";
            clipName = rawName || clipName;
            if (!projItem) projItem = bestClip.projectItem || null;
            if (bestClip.duration && bestClip.duration.seconds > 0) {
                clipDuration = Number(bestClip.duration.seconds);
            } else if (bestClip.start && bestClip.end && bestClip.end.seconds > bestClip.start.seconds) {
                clipDuration = bestClip.end.seconds - bestClip.start.seconds;
            }
            if (bestClip.inPoint && !isNaN(Number(bestClip.inPoint.seconds))) {
                clipInPoint = Number(bestClip.inPoint.seconds);
            }
            if (bestClip.outPoint && !isNaN(Number(bestClip.outPoint.seconds))) {
                clipOutPoint = Number(bestClip.outPoint.seconds);
            }
        } else if (commentClipName) {
            rawName = commentClipName;
            clipName = commentClipName;
        }

        if (clipDuration <= 0 && clipOutPoint > clipInPoint) {
            clipDuration = clipOutPoint - clipInPoint;
        }
        if (clipOutPoint <= clipInPoint && clipDuration > 0) {
            clipOutPoint = clipInPoint + clipDuration;
        }
        if (clipDuration <= 0 && projItem) {
            try {
                var inP = projItem.getInPoint ? projItem.getInPoint() : null;
                var outP = projItem.getOutPoint ? projItem.getOutPoint() : null;
                if (inP && outP && outP.seconds > inP.seconds) {
                    clipDuration = outP.seconds - inP.seconds;
                }
            } catch (eDurP) {}
        }
        if (clipDuration <= 0 && projItem) {
            try {
                var meta = projItem.getProjectMetadata ? projItem.getProjectMetadata() : "";
                var matchMeta = meta.match(/Column\.Intrinsic\.MediaDuration[^\>]*\>([^\<]+)\</i);
                if (matchMeta && matchMeta[1]) {
                    var pMeta = matchMeta[1].split(/[:;]/);
                    if (pMeta.length === 4) {
                        var totalSecMeta = (parseFloat(pMeta[0]) || 0) * 3600 + (parseFloat(pMeta[1]) || 0) * 60 + (parseFloat(pMeta[2]) || 0) + ((parseFloat(pMeta[3]) || 0) / 25.0);
                        if (totalSecMeta > 0) clipDuration = totalSecMeta;
                    }
                }
            } catch (eMeta) {}
        }
        if (clipDuration <= 0) clipDuration = 15.0;
        if (clipOutPoint <= clipInPoint) clipOutPoint = clipInPoint + clipDuration;

        found.push({
            gpNum: gpm.gpNum,
            markerName: gpm.markerName || ("GROUP_PHOTO_" + gpm.gpNum),
            comments: gpm.comments || "",
            markerStartSec: gpm.startSec,
            clipName: clipName,
            rawClipName: rawName || clipName,
            commentClipName: commentClipName,
            projectItem: projItem,
            duration: clipDuration,
            inPoint: clipInPoint,
            outPoint: clipOutPoint,
            hasClip: (projItem !== null)
        });
    }

    // FALLBACK 1: If no GP markers found, scan video tracks for GP clips directly
    if (found.length === 0 && vt) {
        var seenGps = {};
        for (var ti3 = 0; ti3 < vt.numTracks; ti3++) {
            var trk3 = vt[ti3];
            if (!trk3 || !trk3.clips) continue;
            for (var ci3 = 0; ci3 < trk3.clips.numItems; ci3++) {
                var c3 = trk3.clips[ci3];
                if (!c3) continue;
                var c3Nm = c3.name || (c3.projectItem && c3.projectItem.name) || "";
                var isMango = isMangoOrLavenderColor(c3);

                if (isGroupPhotoName(c3Nm) || isMango) {
                    var gpN = extractGpNumber(c3Nm);
                    if (!seenGps[gpN]) {
                        seenGps[gpN] = true;
                        var dur3 = (c3.duration && c3.duration.seconds > 0) ? Number(c3.duration.seconds) : ((c3.start && c3.end) ? (c3.end.seconds - c3.start.seconds) : 0);
                        var in3 = (c3.inPoint && !isNaN(Number(c3.inPoint.seconds))) ? Number(c3.inPoint.seconds) : 0;
                        var out3 = (c3.outPoint && !isNaN(Number(c3.outPoint.seconds))) ? Number(c3.outPoint.seconds) : (in3 + dur3);
                        found.push({
                            gpNum: gpN,
                            markerName: "GROUP_PHOTO_" + gpN,
                            comments: "",
                            markerStartSec: c3.start ? c3.start.seconds : 0,
                            clipName: c3Nm || ("Group Photo " + gpN),
                            rawClipName: c3Nm,
                            commentClipName: "",
                            projectItem: c3.projectItem || null,
                            duration: dur3 > 0 ? dur3 : 15.0,
                            inPoint: in3,
                            outPoint: out3,
                            hasClip: (c3.projectItem !== null)
                        });
                    }
                }
            }
        }
    }

    // FALLBACK 2: If still no GP found, scan project bin items for GP clips
    if (found.length === 0 && app.project && app.project.rootItem) {
        var binGps = {};
        function scanBinForGps(bin) {
            if (!bin || !bin.children) return;
            for (var bi = 0; bi < bin.children.numItems; bi++) {
                var child = bin.children[bi];
                if (!child) continue;
                if (child.type === 2 || (child.isSequence && child.isSequence())) continue;
                if (isItemBin(child)) {
                    scanBinForGps(child);
                } else {
                    var bNm = child.name || "";
                    if (isGroupPhotoName(bNm)) {
                        var bGpN = extractGpNumber(bNm);
                        if (!binGps[bGpN]) {
                            binGps[bGpN] = true;
                            found.push({
                                gpNum: bGpN,
                                markerName: "GROUP_PHOTO_" + bGpN,
                                comments: "",
                                markerStartSec: 0,
                                clipName: bNm,
                                rawClipName: bNm,
                                commentClipName: "",
                                projectItem: child,
                                duration: 15.0,
                                inPoint: 0,
                                outPoint: 15.0,
                                hasClip: true
                            });
                        }
                    }
                }
            }
        }
        scanBinForGps(app.project.rootItem);
    }

    // Sort by gpNum
    found.sort(function(a, b) { return a.gpNum - b.gpNum; });
    return found;
}

// ── Shared helper: collect all N-prefix markers sorted chronologically ────────
function collectNikaahMarkers(seq) {
    var nikaahList = [];
    if (!seq) return nikaahList;

    var allMarkers = [];
    if (seq.markers) {
        var cur = seq.markers.getFirstMarker();
        while (cur) {
            var startSec = (cur.start && !isNaN(Number(cur.start.seconds))) ? Number(cur.start.seconds) : 0;
            var endSec   = (cur.end   && !isNaN(Number(cur.end.seconds)))   ? Number(cur.end.seconds)   : 0;
            var durSec   = (cur.duration && !isNaN(Number(cur.duration.seconds))) ? Number(cur.duration.seconds) : 0;
            allMarkers.push({
                markerObj: cur,
                name: cur.name || "",
                startSec: startSec,
                endSec: (endSec > startSec) ? endSec : (startSec + durSec)
            });
            cur = seq.markers.getNextMarker(cur);
        }
    }

    allMarkers.sort(function(a, b) { return a.startSec - b.startSec; });

    // Determine sequence end for the last marker boundary
    var seqEndSec = 0;
    try {
        var se = Number(seq.end && seq.end.seconds);
        if (isFinite(se) && se > 0) seqEndSec = se;
    } catch(e) {}
    if (seqEndSec <= 0) {
        try {
            var vt = seq.videoTracks;
            if (vt) {
                for (var vi = 0; vi < vt.numTracks; vi++) {
                    var trk = vt[vi];
                    if (!trk || !trk.clips) continue;
                    for (var ci = 0; ci < trk.clips.numItems; ci++) {
                        var c = trk.clips[ci];
                        var ce = (c.end && !isNaN(Number(c.end.seconds))) ? Number(c.end.seconds) : 0;
                        if (ce > seqEndSec) seqEndSec = ce;
                    }
                }
            }
        } catch(e) {}
    }

    // Extract strictly N-prefix markers with boundary placed at the end of each ceremony
    var nikahCount = 0;
    for (var mi = 0; mi < allMarkers.length; mi++) {
        var item = allMarkers[mi];
        if (!isStrictNikaahMarker(item.name)) continue;

        nikahCount++;
        var cerNum = extractNikaahNumber(item.name);
        var s = item.startSec;
        var e = item.endSec;

        // Find next Nikaah start if available
        var nextNikaahStart = null;
        for (var nj = mi + 1; nj < allMarkers.length; nj++) {
            if (allMarkers[nj].startSec > (s + 0.5) && isStrictNikaahMarker(allMarkers[nj].name)) {
                nextNikaahStart = allMarkers[nj].startSec;
                break;
            }
        }

        if (nextNikaahStart !== null) {
            // If marker had no duration, OR was set with 1-2 frame gap deficit (e < nextNikaahStart <= e + 0.28):
            // Snap e to nextNikaahStart so full ceremony content is preserved without missing frames
            if (e <= s || (e < nextNikaahStart && (nextNikaahStart - e) <= 0.28)) {
                e = nextNikaahStart;
            }
        } else if (seqEndSec > s) {
            if (e <= s || (seqEndSec > e && (seqEndSec - e) <= 0.28)) {
                e = seqEndSec;
            }
        } else if (e <= s) {
            e = s + 5.0;
        }

        var seqNum = (cerNum !== null && cerNum > 0) ? cerNum : nikahCount;

        nikaahList.push({
            markerObj: item.markerObj,
            seqNum: seqNum,                  // Ceremony number if parsed (e.g. 16 for 16N), else sequential
            ceremonyNum: cerNum,             // Exact parsed ceremony number (or null)
            chronologicalIndex: nikahCount,  // 1, 2, 3...
            name: item.name,
            startSec: s,
            endSec: e
        });
    }

    // Fallback: If no markers were found, scan timeline video tracks for Nikaah clips directly
    if (nikaahList.length === 0 && seq.videoTracks) {
        var clipCandidates = [];
        for (var vi2 = 0; vi2 < seq.videoTracks.numTracks; vi2++) {
            var trk2 = seq.videoTracks[vi2];
            if (!trk2 || !trk2.clips) continue;
            for (var ci2 = 0; ci2 < trk2.clips.numItems; ci2++) {
                var c2 = trk2.clips[ci2];
                if (!c2) continue;
                var clipNm = c2.name || (c2.projectItem && c2.projectItem.name) || "";
                if (isStrictNikaahMarker(clipNm)) {
                    var cStart = (c2.start && !isNaN(Number(c2.start.seconds))) ? Number(c2.start.seconds) : 0;
                    var cEnd   = (c2.end   && !isNaN(Number(c2.end.seconds)))   ? Number(c2.end.seconds)   : 0;
                    clipCandidates.push({
                        name: clipNm,
                        startSec: cStart,
                        endSec: cEnd
                    });
                }
            }
        }

        if (clipCandidates.length > 0) {
            clipCandidates.sort(function(a, b) { return a.startSec - b.startSec; });
            for (var cki = 0; cki < clipCandidates.length; cki++) {
                var cNum = extractNikaahNumber(clipCandidates[cki].name);
                var cSeq = (cNum !== null && cNum > 0) ? cNum : (cki + 1);
                nikaahList.push({
                    seqNum: cSeq,
                    ceremonyNum: cNum,
                    chronologicalIndex: cki + 1,
                    name: clipCandidates[cki].name,
                    startSec: clipCandidates[cki].startSec,
                    endSec: clipCandidates[cki].endSec
                });
            }
        }
    }

    return nikaahList;
}

// ── Multi-Tier Clip Name & Path Matching Engine ──────────────────────────────
// Normalizes spaces, hyphens, underscores, file extensions (.mp4, .mov, etc.),
// and compares exact names, substrings, slugs, and disk file basenames.
function isClipMatch(candidateStrings, queryString) {
    if (!queryString) return false;
    var q = String(queryString).replace(/^\s+|\s+$/g, "");
    if (!q) return false;
    var qLower = q.toLowerCase();
    var qClean = qLower.replace(/\.[a-z0-9]{2,5}$/i, "");
    var qSlug = qClean.replace(/[\s_.-]+/g, "");

    for (var i = 0; i < candidateStrings.length; i++) {
        var raw = candidateStrings[i];
        if (!raw) continue;
        var c = String(raw).replace(/^\s+|\s+$/g, "");
        if (!c) continue;
        var cLower = c.toLowerCase();
        var cClean = cLower.replace(/\.[a-z0-9]{2,5}$/i, "");
        var cSlug = cClean.replace(/[\s_.-]+/g, "");

        // 1. Exact match (case-insensitive, with or without extension)
        if (cLower === qLower || cClean === qClean) return true;

        // 2. Substring match
        if (qClean.length >= 2 && (cClean.indexOf(qClean) !== -1 || qClean.indexOf(cClean) !== -1)) return true;

        // 3. Normalized slug match (stripping all spaces, underscores, dots, hyphens)
        // e.g. "1448-05-02_01M" matches "1448-05-02 _01M"
        if (qSlug.length >= 2 && (cSlug.indexOf(qSlug) !== -1 || qSlug.indexOf(cSlug) !== -1)) return true;

        // 4. Basename match if candidate is a full file path (e.g. C:\Footage\01M-10-01W.mp4)
        if (c.indexOf("\\") !== -1 || c.indexOf("/") !== -1) {
            var bName = c.replace(/^.*[\\\/]/, "").toLowerCase().replace(/\.[a-z0-9]{2,5}$/i, "");
            var bSlug = bName.replace(/[\s_.-]+/g, "");
            if (bName === qClean || (qClean.length >= 2 && bName.indexOf(qClean) !== -1)) return true;
            if (qSlug.length >= 2 && (bSlug.indexOf(qSlug) !== -1 || qSlug.indexOf(bSlug) !== -1)) return true;
        }
    }
    return false;
}

function getClipCandidateStrings(tc) {
    var arr = [];
    if (!tc) return arr;
    try { if (tc.name) arr.push(tc.name); } catch(e1) {}
    try { if (tc.projectItem && tc.projectItem.name) arr.push(tc.projectItem.name); } catch(e2) {}
    try {
        if (tc.projectItem && typeof tc.projectItem.getMediaPath === "function") {
            var mp = tc.projectItem.getMediaPath();
            if (mp) arr.push(mp);
        }
    } catch(e3) {}
    try { if (tc.projectItem && tc.projectItem.treePath) arr.push(tc.projectItem.treePath); } catch(e4) {}
    return arr;
}

// ── Universal Clip Source Resolver ──────────────────────────────────────────
// Finds a clip by numeric GP index, GP marker label, clip name (partial, exact, slug, or basename), or timeline selection
function resolveClipSource(seq, clipId, gpSources) {
    if (!clipId) return null;
    var strId = String(clipId).replace(/^\s+|\s+$/g, "");
    if (!strId) return null;

    // 1. Check if strId represents a GP index: e.g. "1", "GP 1", "GP1", "GROUP_PHOTO_1", "GROUP PHOTO 1"
    var gpIdx = extractGpNumberFromString(strId);
    if (gpIdx !== null && gpSources && gpSources.length > 0) {
        for (var i = 0; i < gpSources.length; i++) {
            if (gpSources[i].gpNum === gpIdx) {
                if (gpSources[i].hasClip && gpSources[i].projectItem) return gpSources[i];
            }
        }
    }

    // 2. Check if strId matches any GP source by name, comments, markerName, rawClipName, or projectItem
    if (gpSources && gpSources.length > 0) {
        for (var j = 0; j < gpSources.length; j++) {
            var gp = gpSources[j];
            var gCandidates = [gp.clipName];
            if (gp.markerName) gCandidates.push(gp.markerName);
            if (gp.rawClipName) gCandidates.push(gp.rawClipName);
            if (gp.commentClipName) gCandidates.push(gp.commentClipName);
            if (gp.comments) {
                gCandidates.push(gp.comments);
                var mCom = gp.comments.match(/\(([^)]+)\)/);
                if (mCom && mCom[1]) gCandidates.push(mCom[1]);
            }
            if (gp.projectItem) {
                gCandidates.push(gp.projectItem.name);
                try {
                    if (typeof gp.projectItem.getMediaPath === "function") {
                        var gpMp = gp.projectItem.getMediaPath();
                        if (gpMp) gCandidates.push(gpMp);
                    }
                } catch(eGM) {}
            }
            if (isClipMatch(gCandidates, strId)) {
                return gp;
            }
        }
        // Fallback: if gpIdx was found above, return the gpSource even if hasClip was initially false
        if (gpIdx !== null) {
            for (var k = 0; k < gpSources.length; k++) {
                if (gpSources[k].gpNum === gpIdx) return gpSources[k];
            }
        }
    }

    // 3. Check active sequence timeline selection (seq.getSelection())
    try {
        if (seq && typeof seq.getSelection === "function") {
            var sel = seq.getSelection();
            if (sel && sel.length > 0) {
                for (var si = 0; si < sel.length; si++) {
                    var sc = sel[si];
                    if (!sc) continue;
                    var sCandidates = getClipCandidateStrings(sc);
                    if (strId.toLowerCase() === "selected" || isClipMatch(sCandidates, strId)) {
                        var sDur = (sc.duration && sc.duration.seconds > 0) ? Number(sc.duration.seconds) : ((sc.end && sc.start) ? (sc.end.seconds - sc.start.seconds) : 15);
                        var sIn = (sc.inPoint && !isNaN(Number(sc.inPoint.seconds))) ? Number(sc.inPoint.seconds) : 0;
                        var sOut = (sc.outPoint && !isNaN(Number(sc.outPoint.seconds))) ? Number(sc.outPoint.seconds) : (sIn + sDur);
                        return {
                            gpNum: gpIdx || 1,
                            clipName: sc.name || (sc.projectItem && sc.projectItem.name) || strId,
                            rawClipName: sc.name || "",
                            projectItem: sc.projectItem || null,
                            duration: sDur > 0 ? sDur : 15.0,
                            inPoint: sIn,
                            outPoint: sOut > sIn ? sOut : (sIn + 15.0),
                            hasClip: (sc.projectItem !== null)
                        };
                    }
                }
            }
        }
    } catch(eSel) {}

    // 4. Scan timeline video tracks for matching clip
    try {
        if (seq && seq.videoTracks) {
            for (var ti = 0; ti < seq.videoTracks.numTracks; ti++) {
                var trk = seq.videoTracks[ti];
                if (!trk || !trk.clips) continue;
                for (var ci = 0; ci < trk.clips.numItems; ci++) {
                    var tc = trk.clips[ci];
                    if (!tc) continue;
                    var tcCandidates = getClipCandidateStrings(tc);
                    if (isClipMatch(tcCandidates, strId)) {
                        var tDur = (tc.duration && tc.duration.seconds > 0) ? Number(tc.duration.seconds) : ((tc.end && tc.start) ? (tc.end.seconds - tc.start.seconds) : 15);
                        var tIn = (tc.inPoint && !isNaN(Number(tc.inPoint.seconds))) ? Number(tc.inPoint.seconds) : 0;
                        var tOut = (tc.outPoint && !isNaN(Number(tc.outPoint.seconds))) ? Number(tc.outPoint.seconds) : (tIn + tDur);
                        return {
                            gpNum: gpIdx || 1,
                            clipName: tc.name || (tc.projectItem && tc.projectItem.name) || strId,
                            rawClipName: tc.name || "",
                            projectItem: tc.projectItem || null,
                            duration: tDur > 0 ? tDur : 15.0,
                            inPoint: tIn,
                            outPoint: tOut > tIn ? tOut : (tIn + 15.0),
                            hasClip: (tc.projectItem !== null)
                        };
                    }
                }
            }
        }
    } catch(eTrk) {}

    // 4b. Also scan timeline audio tracks
    try {
        if (seq && seq.audioTracks) {
            for (var ai = 0; ai < seq.audioTracks.numTracks; ai++) {
                var atrk = seq.audioTracks[ai];
                if (!atrk || !atrk.clips) continue;
                for (var aci = 0; aci < atrk.clips.numItems; aci++) {
                    var atc = atrk.clips[aci];
                    if (!atc) continue;
                    var atcCandidates = getClipCandidateStrings(atc);
                    if (isClipMatch(atcCandidates, strId)) {
                        var aDur = (atc.duration && atc.duration.seconds > 0) ? Number(atc.duration.seconds) : ((atc.end && atc.start) ? (atc.end.seconds - atc.start.seconds) : 15);
                        var aIn = (atc.inPoint && !isNaN(Number(atc.inPoint.seconds))) ? Number(atc.inPoint.seconds) : 0;
                        var aOut = (atc.outPoint && !isNaN(Number(atc.outPoint.seconds))) ? Number(atc.outPoint.seconds) : (aIn + aDur);
                        return {
                            gpNum: gpIdx || 1,
                            clipName: atc.name || (atc.projectItem && atc.projectItem.name) || strId,
                            rawClipName: atc.name || "",
                            projectItem: atc.projectItem || null,
                            duration: aDur > 0 ? aDur : 15.0,
                            inPoint: aIn,
                            outPoint: aOut > aIn ? aOut : (aIn + 15.0),
                            hasClip: (atc.projectItem !== null)
                        };
                    }
                }
            }
        }
    } catch(eATrk) {}

    // 5. Scan project bins recursively for projectItem with matching name or mediaPath
    try {
        if (app.project && app.project.rootItem) {
            var matchedItem = null;
            function searchBin(bin) {
                if (!bin || !bin.children || matchedItem) return;
                for (var bi = 0; bi < bin.children.numItems; bi++) {
                    var ch = bin.children[bi];
                    if (!ch) continue;
                    if (isItemBin(ch)) {
                        searchBin(ch);
                    } else {
                        var bCandidates = [ch.name];
                        try {
                            if (typeof ch.getMediaPath === "function") {
                                var mp2 = ch.getMediaPath();
                                if (mp2) bCandidates.push(mp2);
                            }
                        } catch(eMP) {}
                        if (ch.treePath) bCandidates.push(ch.treePath);

                        if (isClipMatch(bCandidates, strId)) {
                            matchedItem = ch;
                            return;
                        }
                    }
                }
            }
            searchBin(app.project.rootItem);
            if (matchedItem) {
                var pDur = 15.0;
                try {
                    var inP = matchedItem.getInPoint ? matchedItem.getInPoint() : null;
                    var outP = matchedItem.getOutPoint ? matchedItem.getOutPoint() : null;
                    if (inP && outP && outP.seconds > inP.seconds) pDur = outP.seconds - inP.seconds;
                } catch(eP) {}
                return {
                    gpNum: gpIdx || 1,
                    clipName: matchedItem.name,
                    rawClipName: matchedItem.name,
                    projectItem: matchedItem,
                    duration: pDur > 0 ? pDur : 15.0,
                    inPoint: 0,
                    outPoint: pDur > 0 ? pDur : 15.0,
                    hasClip: true
                };
            }
        }
    } catch(eBin) {}

    return null;
}

// ── Get Name of Currently Selected Timeline Clip ─────────────────────────────
$.runScript.getSelectedTimelineClipName = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence found.";
        if (typeof seq.getSelection === "function") {
            var sel = seq.getSelection();
            if (sel && sel.length > 0 && sel[0]) {
                var nm = sel[0].name || (sel[0].projectItem && sel[0].projectItem.name) || "";
                if (nm) return "SUCCESS|||" + nm;
            }
        }
        return "ERROR|||No clip currently selected on the timeline. Click a clip in Premiere Pro first.";
    } catch(e) {
        return "ERROR|||" + e.toString();
    }
};

// ── Get All Sequence & Project Clip Names for Autocomplete Suggestions ────────
$.runScript.getSequenceClipNames = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence found.";

        var names = [];
        var seen = {};

        function addName(nm) {
            if (!nm) return;
            var clean = String(nm).replace(/^\s+|\s+$/g, "");
            if (!clean) return;
            var noExt = clean.replace(/\.[a-zA-Z0-9]{2,5}$/, "");
            if (noExt && !seen[noExt.toLowerCase()]) {
                seen[noExt.toLowerCase()] = true;
                names.push(noExt);
            }
            if (noExt !== clean && !seen[clean.toLowerCase()]) {
                seen[clean.toLowerCase()] = true;
                names.push(clean);
            }
        }

        // 1. Sequence video clips
        if (seq.videoTracks) {
            for (var ti = 0; ti < seq.videoTracks.numTracks; ti++) {
                var trk = seq.videoTracks[ti];
                if (!trk || !trk.clips) continue;
                for (var ci = 0; ci < trk.clips.numItems; ci++) {
                    var c = trk.clips[ci];
                    if (!c) continue;
                    addName(c.name);
                    if (c.projectItem) addName(c.projectItem.name);
                }
            }
        }

        // 2. Sequence audio clips
        if (seq.audioTracks) {
            for (var ai = 0; ai < seq.audioTracks.numTracks; ai++) {
                var atrk = seq.audioTracks[ai];
                if (!atrk || !atrk.clips) continue;
                for (var aci = 0; aci < atrk.clips.numItems; aci++) {
                    var ac = atrk.clips[aci];
                    if (!ac) continue;
                    addName(ac.name);
                    if (ac.projectItem) addName(ac.projectItem.name);
                }
            }
        }

        // 3. Project panel bins (searched deeply)
        if (app.project && app.project.rootItem && app.project.rootItem.children) {
            function scanBinNames(bin, depth) {
                if (!bin || !bin.children || depth > 8) return;
                for (var bi = 0; bi < bin.children.numItems; bi++) {
                    var child = bin.children[bi];
                    if (!child) continue;
                    if (isItemBin(child)) {
                        scanBinNames(child, depth + 1);
                    } else if (child.type !== 2) {
                        addName(child.name);
                    }
                }
            }
            scanBinNames(app.project.rootItem, 0);
        }

        return "SUCCESS|||" + names.join("|||");
    } catch(err) {
        return "ERROR|||" + err.toString();
    }
};

// ── Mark Clip as Group Photo on Sequence Timeline ─────────────────────────────
// Finds the clip by name/number on the timeline (or selection) and creates GROUP_PHOTO_N marker
// This allows editors to completely skip manual marker creation and clip coloring!
$.runScript.addGpMarkerAtClip = function(clipIdentifier, gpNumber) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence found.";
        if (!clipIdentifier) return "ERROR|||Please enter a clip name or number.";

        var cleanId = String(clipIdentifier).replace(/^\s+|\s+$/g, "");
        var num = parseInt(gpNumber, 10);
        if (isNaN(num) || num < 1) num = 1;
        var markerName = "GROUP_PHOTO_" + num;

        var foundClip = null;

        // 1. Check currently selected clip
        try {
            if (typeof seq.getSelection === "function") {
                var sel = seq.getSelection();
                if (sel && sel.length > 0) {
                    for (var s = 0; s < sel.length; s++) {
                        var sc = sel[s];
                        if (sc && (sc.mediaType === "VIDEO" || sc.projectItem)) {
                            var scCandidates = getClipCandidateStrings(sc);
                            if (cleanId.toLowerCase() === "selected" || isClipMatch(scCandidates, cleanId)) {
                                foundClip = sc;
                                break;
                            }
                        }
                    }
                }
            }
        } catch(eSel) {}

        // 2. Scan timeline video tracks for matching clip
        if (!foundClip && seq.videoTracks) {
            for (var ti = 0; ti < seq.videoTracks.numTracks; ti++) {
                var trk = seq.videoTracks[ti];
                if (!trk || !trk.clips) continue;
                for (var ci = 0; ci < trk.clips.numItems; ci++) {
                    var tc = trk.clips[ci];
                    if (!tc) continue;
                    var tcCandidates = getClipCandidateStrings(tc);
                    if (isClipMatch(tcCandidates, cleanId)) {
                        foundClip = tc;
                        break;
                    }
                }
                if (foundClip) break;
            }
        }

        // 3. Scan timeline audio tracks for matching clip
        if (!foundClip && seq.audioTracks) {
            for (var ai = 0; ai < seq.audioTracks.numTracks; ai++) {
                var atrk = seq.audioTracks[ai];
                if (!atrk || !atrk.clips) continue;
                for (var aci = 0; aci < atrk.clips.numItems; aci++) {
                    var atc = atrk.clips[aci];
                    if (!atc) continue;
                    var atcCandidates = getClipCandidateStrings(atc);
                    if (isClipMatch(atcCandidates, cleanId)) {
                        foundClip = atc;
                        break;
                    }
                }
                if (foundClip) break;
            }
        }

        if (!foundClip) {
            return "ERROR|||Clip '" + cleanId + "' not found on timeline tracks. Ensure the clip is placed on the sequence or click 'Pick'.";
        }

        var clipStartSec = 0;
        if (foundClip.start && !isNaN(Number(foundClip.start.seconds))) {
            clipStartSec = Number(foundClip.start.seconds);
        } else {
            return "ERROR|||Could not determine start time of clip '" + cleanId + "'.";
        }

        var markers = seq.markers;
        if (!markers) return "ERROR|||Sequence markers not accessible.";

        // Delete any existing marker for this GP number or at this exact position (ONLY if it is a GP recognition marker)
        var cur = markers.getFirstMarker();
        while (cur) {
            var cNm = (cur.name || "").replace(/^\s+|\s+$/g, "");
            var cStart = (cur.start && !isNaN(Number(cur.start.seconds))) ? Number(cur.start.seconds) : -1;
            if (isGroupPhotoName(cNm) && (cNm === markerName || extractGpNumber(cNm) === num || Math.abs(cStart - clipStartSec) < 0.1)) {
                markers.deleteMarker(cur);
                break;
            }
            cur = markers.getNextMarker(cur);
        }

        var newMarker = markers.createMarker(clipStartSec);
        if (!newMarker) return "ERROR|||Failed to create marker on sequence.";
        newMarker.name = markerName;
        newMarker.comments = "Group Photo Source #" + num + " (" + (foundClip.name || cleanId) + ")";
        if (typeof newMarker.setColorByIndex === "function") {
            try { newMarker.setColorByIndex(7, 0); } catch(eColor1) {
                try { newMarker.setColorByIndex(7); } catch(eColor2) {}
            }
        }

        var timeStr = "";
        try {
            var min = Math.floor(clipStartSec / 60);
            var sec = Math.floor(clipStartSec % 60);
            timeStr = (min < 10 ? "0" : "") + min + ":" + (sec < 10 ? "0" : "") + sec;
        } catch(eT) {}

        return "SUCCESS|||" + markerName + "|||" + (foundClip.name || cleanId) + "|||" + timeStr;
    } catch(err) {
        return "ERROR|||" + err.toString();
    }
};

// ── Scan: returns GP sources + Nikaah count ───────────────────────────────────
// Return format: "SUCCESS|||gpCount|||n1Name|n1Has|n1Dur|||n2Name|n2Has|n2Dur|||...|||NIKAAH_COUNT|||total"
$.runScript.groupPhotoInserterScan = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence found.";

        var gpSources = detectGroupPhotoSources(seq);
        var nikaahMarkers = collectNikaahMarkers(seq);

        var parts = ["SUCCESS", String(gpSources.length)];
        for (var i = 0; i < gpSources.length; i++) {
            var gp = gpSources[i];
            var hasClip = gp.hasClip ? "1" : "0";
            var dur = String(Math.round(gp.duration * 10) / 10);
            parts.push(String(gp.gpNum) + "|" + gp.clipName + "|" + hasClip + "|" + dur);
        }
        parts.push("NIKAAH_COUNT");
        parts.push(String(nikaahMarkers.length));

        return parts.join("|||");
    } catch(err) {
        return "ERROR|||" + err.toString();
    }
};

// ── Preview: dry-run plan without touching the timeline ───────────────────────
// assignmentsStr format: "clipKey|fromN|toN;clipKey|fromN|toN;..." (also supports comma)
// e.g. "GP_PHOTO_1|1|10;GP_PHOTO_2|11|25" or "1|1|15"
// Returns "SUCCESS|||line1\nline2\n...\n|||STATS|||inserted=N|skipped=N|warnings=W"
$.runScript.groupPhotoInserterPreview = function(assignmentsStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence found.";

        var gpSources = detectGroupPhotoSources(seq);
        var nikaahMarkers = collectNikaahMarkers(seq);

        if (nikaahMarkers.length === 0) {
            return "ERROR|||No Nikaah (N-prefix) markers found in this sequence. Run Auto In/Out Markers first.";
        }

        // Parse assignments
        var assignments = [];
        var rawTokens = (assignmentsStr || "").replace(/^\s+|\s+$/g, "").split(";");
        for (var ai = 0; ai < rawTokens.length; ai++) {
            var tok = rawTokens[ai].replace(/^\s+|\s+$/g, "");
            if (!tok) continue;
            var fields = tok.indexOf("|") !== -1 ? tok.split("|") : tok.split(",");
            if (fields.length < 3) continue;
            var clipKey = fields[0].replace(/^\s+|\s+$/g, "");
            var fromN   = parseInt(fields[1], 10);
            var toN     = parseInt(fields[2], 10);
            if (!clipKey || isNaN(fromN) || isNaN(toN)) continue;
            assignments.push({ clipKey: clipKey, fromN: fromN, toN: toN });
        }

        if (assignments.length === 0) {
            return "ERROR|||No valid assignments provided. Enter at least one clip name and Nikaah range.";
        }

        // Resolve clips & build assignment map: nikaahSeqNum -> clipKey
        var resolvedClipMap = {};
        var warnings = [];

        for (var asi = 0; asi < assignments.length; asi++) {
            var asgn = assignments[asi];
            var key = asgn.clipKey;
            if (!resolvedClipMap.hasOwnProperty(key)) {
                resolvedClipMap[key] = resolveClipSource(seq, key, gpSources);
            }
            var src = resolvedClipMap[key];
            if (!src) {
                warnings.push("⚠ Clip '" + key + "' not found on timeline or in Project panel.");
            } else if (!src.hasClip || !src.projectItem) {
                warnings.push("⚠ Clip '" + key + "' found but has no project media item.");
            }
        }

        // Generate preview lines
        var lines = [];
        var plannedCount = 0;
        var skippedCount = 0;

        for (var nki = 0; nki < nikaahMarkers.length; nki++) {
            var nk = nikaahMarkers[nki];
            var assignedKey = findAssignedKeyForNikaah(nk, assignments);

            if (assignedKey === undefined || assignedKey === null) {
                lines.push("  — Nikaah " + nk.seqNum + "  [" + nk.name + "]  → (no assignment — skipped)");
                skippedCount++;
            } else {
                var srcGp = resolvedClipMap[assignedKey];
                var gpLabel = srcGp ? srcGp.clipName : assignedKey;
                var dur = srcGp ? (" [" + Math.round(srcGp.duration * 10) / 10 + "s]") : "";
                var noClipWarn = (srcGp && !srcGp.hasClip) ? " ⚠ clip not found!" : "";
                lines.push("  ✓ Nikaah " + nk.seqNum + "  [" + nk.name + "]  →  " + gpLabel + dur + noClipWarn);
                plannedCount++;
            }
        }

        var statsStr = "inserted=" + plannedCount + "|skipped=" + skippedCount + "|warnings=" + warnings.length;
        var warnStr = warnings.join("\n");
        var previewText = lines.join("\n");

        return "SUCCESS|||" + previewText + "|||STATS|||" + statsStr + "|||WARNINGS|||" + warnStr;
    } catch(err) {
        return "ERROR|||" + err.toString();
    }
};

// ── Manual Timeline Snapshot Helper ──────────────────────────────────────────
$.runScript.createProjectSnapshot = function() {
    try {
        if (!app.project) return "ERROR|||No project open.";
        if (typeof app.project.save === "function") {
            app.project.save();
            var d = new Date();
            var timeStr = (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" +
                          (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() + ":" +
                          (d.getSeconds() < 10 ? "0" : "") + d.getSeconds();
            return "SUCCESS|||Snapshot checkpoint saved at " + timeStr;
        }
        return "ERROR|||Project save not supported in this host.";
    } catch(e) {
        return "ERROR|||" + e.toString();
    }
};

// ── Precision Timeline Cut-Point Snapping Helper ─────────────────────────────
// Prevents the 1-2 frame cut offset / jerk effect by snapping insertSec to the
// exact cut point (clip end / next clip start) on the timeline.
function findBestTimelineCutPoint(seq, preferredTrack, targetSec, maxToleranceSec) {
    if (!seq || targetSec === undefined || targetSec === null) return targetSec;
    if (isNaN(Number(targetSec))) return targetSec;
    targetSec = Number(targetSec);
    if (!maxToleranceSec) maxToleranceSec = 0.45; // ~11-13 frames tolerance

    var candidateCuts = [];

    // Prioritize preferredTrack (targetVideoTrack), then other video tracks
    var tracks = [];
    if (preferredTrack && preferredTrack.clips) tracks.push(preferredTrack);
    if (seq.videoTracks) {
        for (var vi = 0; vi < seq.videoTracks.numTracks; vi++) {
            var vt = seq.videoTracks[vi];
            if (vt && vt !== preferredTrack && vt.clips) tracks.push(vt);
        }
    }

    for (var ti = 0; ti < tracks.length; ti++) {
        var trk = tracks[ti];
        for (var ci = 0; ci < trk.clips.numItems; ci++) {
            var clip = trk.clips[ci];
            if (!clip) continue;

            var cStart = (clip.start && !isNaN(Number(clip.start.seconds))) ? Number(clip.start.seconds) : -1;
            var cEnd   = (clip.end   && !isNaN(Number(clip.end.seconds)))   ? Number(clip.end.seconds)   : -1;

            // 1. Clip end point: where the previous clip finishes
            if (cEnd >= 0) {
                var dEnd = Math.abs(cEnd - targetSec);
                if (dEnd <= maxToleranceSec) {
                    // Prioritize cEnd if targetSec is slightly before cEnd (the classic 1-2 frames before cut)
                    var scoreEnd = dEnd;
                    if (cEnd >= targetSec && (cEnd - targetSec) <= 0.28) {
                        scoreEnd = dEnd * 0.4; // strongly prioritize moving forward to complete the clip
                    }
                    candidateCuts.push({ time: cEnd, diff: dEnd, score: scoreEnd, type: "end" });
                }
            }

            // 2. Clip start point: where the next clip begins
            if (cStart >= 0) {
                var dStart = Math.abs(cStart - targetSec);
                if (dStart <= maxToleranceSec) {
                    var scoreStart = dStart;
                    if (targetSec >= cStart && (targetSec - cStart) <= 0.28) {
                        scoreStart = dStart * 0.4;
                    }
                    candidateCuts.push({ time: cStart, diff: dStart, score: scoreStart, type: "start" });
                }
            }
        }
    }

    if (candidateCuts.length === 0) {
        return targetSec;
    }

    // Sort by lowest score (closest and properly oriented cut point)
    candidateCuts.sort(function(a, b) { return a.score - b.score; });
    return candidateCuts[0].time;
}

// ── Execute: ripple-insert with duplicate prevention ─────────────────────────
// assignmentsStr same format as preview
// Returns "SUCCESS|||inserted=N|skipped=N|failed=N|||reportLines"
$.runScript.groupPhotoInserterExecute = function(assignmentsStr) {
    var undoStarted = false;
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence found.";

        // Enable QE DOM if available
        try { if (typeof app.enableQE === "function") app.enableQE(); } catch(eQE) {}

        // Safety 1: Trigger an internal project snapshot before any destructive ripple insert
        try {
            if (app.project && typeof app.project.save === "function") {
                app.project.save();
            }
        } catch(eSave) {}

        // Safety 2: Group all upcoming operations into a single Undo Boundary so Ctrl+Z restores everything in 1 step
        try {
            if (typeof app.beginUndoGroup === "function") {
                app.beginUndoGroup("One Tap Group Photo Ripple Insert");
                undoStarted = true;
            } else if (typeof app.enableUndo === "function") {
                app.enableUndo(true);
            }
        } catch(eUndo) {}

        function toTime(sec) {
            var t = new Time();
            t.seconds = Math.max(0, Number(sec));
            return t;
        }

        function formatSec(sec) {
            var total = Math.floor(Math.max(0, Number(sec)));
            var m = Math.floor(total / 60);
            var s = total % 60;
            return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        }

        // Helper: shift a single clip forward by shiftAmount
        function shiftClipForward(clip, track, shiftAmount) {
            if (!clip || shiftAmount <= 0) return false;
            var oldStart = clip.start ? clip.start.seconds : 0;
            var oldEnd   = clip.end   ? clip.end.seconds   : 0;
            var dur = (oldEnd > oldStart) ? (oldEnd - oldStart) : (clip.duration ? clip.duration.seconds : 0);
            var targetStart = oldStart + shiftAmount;
            var targetEnd   = oldEnd   + shiftAmount;
            var moved = false;

            if (typeof clip.move === "function") {
                try { clip.move(toTime(targetStart)); if (Math.abs(clip.start.seconds - targetStart) < 0.2) moved = true; } catch(e) {}
            }
            if (!moved) {
                try { clip.start = toTime(targetStart); if (Math.abs(clip.start.seconds - targetStart) < 0.2) moved = true; } catch(e) {}
            }
            if (!moved) {
                try {
                    clip.end = toTime(targetEnd);
                    clip.start = toTime(targetStart);
                    if (Math.abs(clip.start.seconds - targetStart) < 0.2) moved = true;
                } catch(e) {}
            }
            if (!moved && clip.projectItem) {
                try {
                    var pItem = clip.projectItem;
                    var inSec  = (clip.inPoint  && !isNaN(clip.inPoint.seconds))  ? clip.inPoint.seconds  : 0;
                    var outSec = (clip.outPoint && !isNaN(clip.outPoint.seconds)) ? clip.outPoint.seconds : (inSec + dur);
                    track.overwriteClip(pItem, toTime(targetStart));
                    for (var ci = track.clips.numItems - 1; ci >= 0; ci--) {
                        var placed = track.clips[ci];
                        if (placed && Math.abs(placed.start.seconds - targetStart) < 0.25) {
                            try { placed.inPoint = toTime(inSec); placed.outPoint = toTime(outSec); } catch(e) {}
                            moved = true;
                            break;
                        }
                    }
                } catch(e) {}
            }
            return moved;
        }

        var gpSources = detectGroupPhotoSources(seq);
        var nikaahMarkers = collectNikaahMarkers(seq);

        if (nikaahMarkers.length === 0) {
            return "ERROR|||No Nikaah (N-prefix) markers found. Run Auto In/Out Markers first.";
        }

        // Build GP lookup
        var gpByNum = {};
        for (var gi = 0; gi < gpSources.length; gi++) {
            gpByNum[gpSources[gi].gpNum] = gpSources[gi];
        }

        // Parse assignments
        var assignments = [];
        var rawTokens = (assignmentsStr || "").replace(/^\s+|\s+$/g, "").split(";");
        for (var ai = 0; ai < rawTokens.length; ai++) {
            var tok = rawTokens[ai].replace(/^\s+|\s+$/g, "");
            if (!tok) continue;
            var fields = tok.indexOf("|") !== -1 ? tok.split("|") : tok.split(",");
            if (fields.length < 3) continue;
            var clipKey = fields[0].replace(/^\s+|\s+$/g, "");
            var fromN   = parseInt(fields[1], 10);
            var toN     = parseInt(fields[2], 10);
            if (!clipKey || isNaN(fromN) || isNaN(toN)) continue;
            assignments.push({ clipKey: clipKey, fromN: fromN, toN: toN, asgnNum: (ai + 1) });
        }

        if (assignments.length === 0) {
            return "ERROR|||No valid assignments provided. Enter at least one clip name and Nikaah range.";
        }

        // Resolve all clips once
        var resolvedClipMap = {};
        for (var rci = 0; rci < assignments.length; rci++) {
            var ck = assignments[rci].clipKey;
            if (!resolvedClipMap.hasOwnProperty(ck)) {
                resolvedClipMap[ck] = resolveClipSource(seq, ck, gpSources);
            }
        }

        // Unlock all tracks
        for (var vi = 0; vi < seq.videoTracks.numTracks; vi++) {
            try {
                var vTrk = seq.videoTracks[vi];
                if (typeof vTrk.isLocked === "function" && vTrk.isLocked()) vTrk.setLocked(false);
                else if (vTrk.isLocked === true) vTrk.isLocked = false;
            } catch(e) {}
        }
        for (var ai2 = 0; ai2 < seq.audioTracks.numTracks; ai2++) {
            try {
                var aTrk = seq.audioTracks[ai2];
                if (typeof aTrk.isLocked === "function" && aTrk.isLocked()) aTrk.setLocked(false);
                else if (aTrk.isLocked === true) aTrk.isLocked = false;
            } catch(e) {}
        }

        var insertedCount = 0;
        var skippedCount = 0;
        var failedCount = 0;
        var reportLines = [];

        // Rule 3: Collect & Sort Marker End Times First: extract all assignments and sort chronologically
        var workList = [];
        for (var nki = 0; nki < nikaahMarkers.length; nki++) {
            var nk = nikaahMarkers[nki];
            var asgnObj = findAssignedObjectForNikaah(nk, assignments);
            if (!asgnObj) continue;
            workList.push({ nk: nk, clipKey: asgnObj.clipKey, asgnNum: asgnObj.asgnNum || 1 });
        }

        workList.sort(function(a, b) {
            return (Number(a.nk.endSec) || 0) - (Number(b.nk.endSec) || 0);
        });

        // Rule 4: Loop Backward (Reverse Order): Iterate from the last marker to the first
        for (var wi = workList.length - 1; wi >= 0; wi--) {
            var nk = workList[wi].nk;
            var clipKey = workList[wi].clipKey;
            var asgnNum = workList[wi].asgnNum || 1;
            var asgnColor = getAssignmentColorIndex(asgnNum);
            var gp = resolvedClipMap[clipKey] || resolveClipSource(seq, clipKey, gpSources);

            if (!gp) {
                reportLines.push("✗ Nikaah " + nk.seqNum + " — Clip '" + clipKey + "' not found on timeline or in Project panel. Skipped.");
                skippedCount++;
                continue;
            }
            if (!gp.hasClip || !gp.projectItem) {
                reportLines.push("✗ Nikaah " + nk.seqNum + " — Clip '" + clipKey + "' has no source media item. Skipped.");
                skippedCount++;
                continue;
            }

            var groupDuration = gp.duration;
            if (groupDuration <= 0) {
                reportLines.push("✗ Nikaah " + nk.seqNum + " — Clip '" + clipKey + "' duration is 0. Skipped.");
                skippedCount++;
                continue;
            }

            // Duplicate prevention: scan target track for clip with OT_GP comment
            var dupKey = "OT_GP_INSERTED|CLIP:" + (gp.clipName || clipKey) + "|NIKAAH:" + nk.seqNum;
            var isDuplicate = false;
            try {
                var vt = seq.videoTracks;
                if (vt) {
                    outer: for (var ti = 0; ti < vt.numTracks; ti++) {
                        var trk = vt[ti];
                        if (!trk || !trk.clips) continue;
                        for (var ci = 0; ci < trk.clips.numItems; ci++) {
                            var c = trk.clips[ci];
                            if (!c) continue;
                            var cmt = "";
                            try { cmt = c.comment || ""; } catch(e) {}
                            if (cmt.indexOf(dupKey) !== -1) {
                                isDuplicate = true;
                                break outer;
                            }
                            var cStart = (c.start && !isNaN(Number(c.start.seconds))) ? Number(c.start.seconds) : -1;
                            if (Math.abs(cStart - nk.endSec) < 0.35) {
                                var cCands = getClipCandidateStrings(c);
                                if (isClipMatch(cCands, gp.clipName || clipKey)) {
                                    isDuplicate = true;
                                    break outer;
                                }
                            }
                        }
                    }
                }
            } catch(eDup) {}

            if (!isDuplicate && seq.markers) {
                try {
                    var chkMk = seq.markers.getFirstMarker();
                    while (chkMk) {
                        var mkCmt = "";
                        try { mkCmt = chkMk.comments || ""; } catch(e) {}
                        var mkNm = chkMk.name || "";
                        if (mkCmt.indexOf(dupKey) !== -1 || mkNm === (nk.name + " - " + (gp.clipName || clipKey))) {
                            isDuplicate = true;
                            break;
                        }
                        chkMk = seq.markers.getNextMarker(chkMk);
                    }
                } catch(eMkDup) {}
            }

            if (isDuplicate) {
                reportLines.push("↷ Nikaah " + nk.seqNum + " — " + (gp.clipName || clipKey) + " already inserted. Skipped (duplicate).");
                skippedCount++;
                continue;
            }

            // Determine target track safely (Rule 7: Track Targeting Safety)
            var targetTrackIndex = 0;
            if (targetTrackIndex >= seq.videoTracks.numTracks) targetTrackIndex = 0;
            var targetVideoTrack = seq.videoTracks[targetTrackIndex];
            if (!targetVideoTrack) {
                failedCount++;
                reportLines.push("✗ Nikaah " + nk.seqNum + " — No valid target video track.");
                continue;
            }

            // Snap insertion point to the exact timeline clip boundary / cut point
            // This prevents cutting 1-2 frames before the natural edit point, eliminating any jerk/flash
            var rawInsertSec = nk.endSec;
            var insertSec = findBestTimelineCutPoint(seq, targetVideoTrack, rawInsertSec, 0.45);
            var gpProjectItem = gp.projectItem;
            var sourceIn = gp.inPoint;
            var sourceOut = gp.outPoint;

            // Set In/Out on projectItem so insertClip takes groupDuration
            try {
                if (typeof gpProjectItem.setInPoint === "function" && sourceIn >= 0) {
                    gpProjectItem.setInPoint(toTime(sourceIn));
                }
                if (typeof gpProjectItem.setOutPoint === "function" && groupDuration > 0) {
                    gpProjectItem.setOutPoint(toTime(sourceIn + groupDuration));
                }
            } catch(eSetIO) {}

            // === RIPPLE INSERT: Place target clip at marker end using native insertClip ===
            // Rule 5: Use Ripple Insert (insertClip) instead of overwriteClip()
            // Rule 6: Consistent Time Units
            var insertOk = false;
            try {
                var insertTime = toTime(insertSec);
                try {
                    targetVideoTrack.insertClip(gpProjectItem, insertTime);
                    insertOk = true;
                } catch(eIns1) {
                    try {
                        targetVideoTrack.insertClip(gpProjectItem, insertSec);
                        insertOk = true;
                    } catch(eIns2) {}
                }

                if (insertOk) {
                    // Tag placed clip with duplicate prevention comment & assignment color label
                    for (var pci = targetVideoTrack.clips.numItems - 1; pci >= 0; pci--) {
                        var placedClip = targetVideoTrack.clips[pci];
                        if (placedClip && Math.abs(placedClip.start.seconds - insertSec) < 0.35) {
                            try { placedClip.comment = dupKey; } catch(eCmt) {}
                            // Color clip based on assignment number:
                            // Assignment 1 = Green (13), Assignment 2 = Purple (8), Assignment 3 = Lavender (3), etc.
                            try {
                                if (typeof placedClip.setColorLabel === "function") {
                                    placedClip.setColorLabel(asgnColor);
                                } else if (placedClip.colorLabel !== undefined) {
                                    placedClip.colorLabel = asgnColor;
                                }
                            } catch(eColClip) {}
                            try {
                                if (placedClip.projectItem) {
                                    if (typeof placedClip.projectItem.setColorLabel === "function") {
                                        placedClip.projectItem.setColorLabel(asgnColor);
                                    } else if (placedClip.projectItem.colorLabel !== undefined) {
                                        placedClip.projectItem.colorLabel = asgnColor;
                                    }
                                }
                            } catch(eColProj) {}
                            break;
                        }
                    }
                } else {
                    failedCount++;
                    reportLines.push("✗ Nikaah " + nk.seqNum + " — insertClip failed on target track.");
                    continue;
                }
            } catch(ePlc) {
                failedCount++;
                reportLines.push("✗ Nikaah " + nk.seqNum + " — insertion failed: " + ePlc.toString());
                continue;
            }

            // === SHIFT: downstream sequence markers forward ===
            try {
                var mList = [];
                var mk = seq.markers.getFirstMarker();
                while (mk) { mList.push(mk); mk = seq.markers.getNextMarker(mk); }
                for (var mki = 0; mki < mList.length; mki++) {
                    var curMk = mList[mki];
                    if (curMk && curMk.start && curMk.start.seconds >= (insertSec - 0.05)) {
                        try {
                            var mkS = curMk.start.seconds;
                            var mkE = (curMk.end && !isNaN(curMk.end.seconds)) ? curMk.end.seconds : mkS;
                            var mkD = (mkE > mkS) ? (mkE - mkS) : 0;
                            curMk.start = toTime(mkS + groupDuration);
                            if (mkD > 0) curMk.end = toTime(mkE + groupDuration);
                        } catch(eMkS) {}
                    }
                }

                // Extend current Nikaah marker's end to cover the inserted Group Photo (if marker has duration)
                if (nk.markerObj) {
                    try {
                        var nkEnd = (nk.markerObj.end && !isNaN(Number(nk.markerObj.end.seconds))) ? Number(nk.markerObj.end.seconds) : 0;
                        if (nkEnd > (nk.startSec || 0)) {
                            nk.markerObj.end = toTime(nkEnd + groupDuration);
                        }
                    } catch(eNkEnd) {}
                }

                // Delete any residual / old insertion markers so they are never treated as separate videos
                try {
                    var cleanMk = seq.markers.getFirstMarker();
                    while (cleanMk) {
                        var cName = cleanMk.name || "";
                        var cCmt = cleanMk.comments || "";
                        var cStart = (cleanMk.start && !isNaN(Number(cleanMk.start.seconds))) ? Number(cleanMk.start.seconds) : -1;
                        if (cCmt.indexOf("OT_GP_INSERTED") !== -1 || (Math.abs(cStart - insertSec) < 0.35 && cName.indexOf(nk.name + " - ") === 0)) {
                            var toDel = cleanMk;
                            cleanMk = seq.markers.getNextMarker(cleanMk);
                            try { seq.markers.deleteMarker(toDel); } catch(eDel) {}
                        } else {
                            cleanMk = seq.markers.getNextMarker(cleanMk);
                        }
                    }
                } catch(eClean) {}

                // NOTE: Marker is deliberately NOT created for the inserted Group Photo!
                // The inserted GP clip is part of the Nikaah video output, avoiding separate video in/out creation.
            } catch(eMkAll) {}

            insertedCount++;
            reportLines.unshift("✓ Nikaah " + nk.seqNum + " [" + nk.name + "] → " + (gp.clipName || clipKey) + " @ " + formatSec(insertSec) + " (+" + groupDuration + "s)");
        }

        // Clean up ONLY the GP recognition markers from the sequence
        // (leaves all Nikaah markers and other event markers 100% untouched)
        var deletedGpCount = 0;
        try {
            if (seq.markers) {
                var curMk = seq.markers.getFirstMarker();
                while (curMk) {
                    var mName = (curMk.name || "").replace(/^\s+|\s+$/g, "");
                    var mCmt = curMk.comments || "";
                    var isGpRec = isGroupPhotoName(mName) || /^GROUP_PHOTO_\d+$/i.test(mName) || /^GP\s*\d+$/i.test(mName) || mCmt.indexOf("Group Photo Source") !== -1 || mCmt.indexOf("OT_GP_INSERTED") !== -1;
                    if (isGpRec) {
                        var toDel = curMk;
                        curMk = seq.markers.getNextMarker(curMk);
                        try {
                            seq.markers.deleteMarker(toDel);
                            deletedGpCount++;
                        } catch(eD) {}
                    } else {
                        curMk = seq.markers.getNextMarker(curMk);
                    }
                }
            }
        } catch(eCleanGp) {}

        if (deletedGpCount > 0) {
            reportLines.push("✓ Cleaned up " + deletedGpCount + " GP recognition marker(s) from timeline.");
        }

        var statsStr = "inserted=" + insertedCount + "|skipped=" + skippedCount + "|failed=" + failedCount;
        var reportStr = reportLines.join("\n");

        var modalBody = "Group Photo Inserter Complete\n\n" +
                        "• Inserted: " + insertedCount + "\n" +
                        "• Skipped: " + skippedCount + "\n" +
                        "• Failed: " + failedCount + "\n\n" +
                        reportStr.split("\n").slice(0, 20).join("\n");

        try {
            $.runScript.showWorkspaceModal(
                "One Tap — Group Photo Inserter",
                insertedCount + " Group Photos Inserted",
                modalBody,
                insertedCount > 0 ? "SUCCESS" : "WARNING"
            );
        } catch(eModal) {}

        return "SUCCESS|||" + statsStr + "|||" + reportStr;
    } catch(err) {
        try {
            $.runScript.showWorkspaceModal("One Tap — Group Photo Inserter", "Error", err.toString(), "ERROR");
        } catch(eErr) {}
        return "ERROR|||" + err.toString();
    } finally {
        if (undoStarted) {
            try {
                if (typeof app.endUndoGroup === "function") {
                    app.endUndoGroup();
                }
            } catch(eEndUndo) {}
        }
    }
};

// ── Delete ONLY Group Photo recognition markers from active sequence ─────────
$.runScript.deleteGroupPhotoMarkers = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq || !seq.markers) return "ERROR|||No active sequence or markers found.";
        var curMk = seq.markers.getFirstMarker();
        var deletedGpCount = 0;
        while (curMk) {
            var mName = (curMk.name || "").replace(/^\s+|\s+$/g, "");
            var mCmt = curMk.comments || "";
            var isGpRec = isGroupPhotoName(mName) || /^GROUP_PHOTO_\d+$/i.test(mName) || /^GP\s*\d+$/i.test(mName) || mCmt.indexOf("Group Photo Source") !== -1 || mCmt.indexOf("OT_GP_INSERTED") !== -1;
            if (isGpRec) {
                var toDel = curMk;
                curMk = seq.markers.getNextMarker(curMk);
                try {
                    seq.markers.deleteMarker(toDel);
                    deletedGpCount++;
                } catch(eD) {}
            } else {
                curMk = seq.markers.getNextMarker(curMk);
            }
        }
        return "SUCCESS|||" + deletedGpCount;
    } catch(err) {
        return "ERROR|||" + err.toString();
    }
};
// ====================================================================
// MEDIA RELOCATION & RELINKING SUITE
// ====================================================================

// Fast test for relinkable media extensions
function isRelinkableMediaExt(ext) {
    if (!ext) return false;
    ext = ext.toLowerCase();
    return (
        ext === ".mp4" || ext === ".mov" || ext === ".avi" || ext === ".mkv" ||
        ext === ".mts" || ext === ".m2ts" || ext === ".mxf" || ext === ".braw" ||
        ext === ".crm" || ext === ".r3d" || ext === ".wav" || ext === ".mp3" ||
        ext === ".m4a" || ext === ".aif" || ext === ".aiff" || ext === ".webm" ||
        ext === ".wmv" || ext === ".flv" || ext === ".cine" || ext === ".mpg" ||
        ext === ".mpeg" || ext === ".m4v" || ext === ".prores" || ext === ".hevc" ||
        ext === ".ari" || ext === ".dng" || ext === ".arx"
    );
}

// Clean media path: strip file:// URL scheme, decode URI, fix Windows drive letter
function cleanNativeMediaPath(rawPath) {
    if (!rawPath) return "";
    var p = String(rawPath);
    try {
        if (p.indexOf("file://") === 0) {
            p = p.replace(/^file:\/\/(localhost)?\/?/i, "");
        }
        p = decodeURIComponent(p);
        if (/^\/[a-zA-Z]:/.test(p)) {
            p = p.substring(1);
        }
    } catch (e) {}
    return p;
}

// Recursive helper to collect all media clips in a bin
function collectMediaProjectItems(binItem, outList, seenMap) {
    if (!binItem) return;
    try {
        if (typeof binItem.canChangeMediaPath === "function" && binItem.canChangeMediaPath()) {
            var itemId = "";
            try { itemId = binItem.nodeId || binItem.treePath || (binItem.name + "_" + binItem.getMediaPath()); } catch(eId) { itemId = binItem.name; }
            if (!seenMap[itemId]) {
                seenMap[itemId] = true;
                outList.push(binItem);
            }
        }
    } catch (e1) {}

    try {
        if (binItem.children && binItem.children.numItems > 0) {
            for (var i = 0; i < binItem.children.numItems; i++) {
                var child = binItem.children[i];
                if (child) {
                    collectMediaProjectItems(child, outList, seenMap);
                }
            }
        }
    } catch (e2) {}
}

// Helper to collect all media clips referenced on timeline sequence tracks
function collectSequenceTimelineMediaItems(outList, seenMap) {
    if (!app.project || !app.project.sequences) return;
    try {
        var numSeq = app.project.sequences.numSequences || 0;
        for (var s = 0; s < numSeq; s++) {
            var seq = app.project.sequences[s];
            if (!seq) continue;

            // Video tracks
            if (seq.videoTracks) {
                var numVT = seq.videoTracks.numTracks || 0;
                for (var vt = 0; vt < numVT; vt++) {
                    var vTrack = seq.videoTracks[vt];
                    if (!vTrack || !vTrack.clips) continue;
                    for (var vc = 0; vc < vTrack.clips.numItems; vc++) {
                        var vClip = vTrack.clips[vc];
                        if (vClip && vClip.projectItem && typeof vClip.projectItem.canChangeMediaPath === "function") {
                            var pItem = vClip.projectItem;
                            if (pItem.canChangeMediaPath()) {
                                var vId = "";
                                try { vId = pItem.nodeId || pItem.treePath || (pItem.name + "_" + pItem.getMediaPath()); } catch(eV) { vId = pItem.name; }
                                if (!seenMap[vId]) {
                                    seenMap[vId] = true;
                                    outList.push(pItem);
                                }
                            }
                        }
                    }
                }
            }

            // Audio tracks
            if (seq.audioTracks) {
                var numAT = seq.audioTracks.numTracks || 0;
                for (var at = 0; at < numAT; at++) {
                    var aTrack = seq.audioTracks[at];
                    if (!aTrack || !aTrack.clips) continue;
                    for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                        var aClip = aTrack.clips[ac];
                        if (aClip && aClip.projectItem && typeof aClip.projectItem.canChangeMediaPath === "function") {
                            var pAItem = aClip.projectItem;
                            if (pAItem.canChangeMediaPath()) {
                                var aId = "";
                                try { aId = pAItem.nodeId || pAItem.treePath || (pAItem.name + "_" + pAItem.getMediaPath()); } catch(eA) { aId = pAItem.name; }
                                if (!seenMap[aId]) {
                                    seenMap[aId] = true;
                                    outList.push(pAItem);
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (eSeqScan) {}
}

// 1. Scan current project media status (total, offline, online, manifest path)
$.runScript.scanProjectMediaStatus = function () {
    try {
        if (!app.project) {
            return "ERROR|||No project is currently open in Premiere Pro.";
        }

        var projPath = "";
        try { projPath = app.project.path || ""; } catch (e) { projPath = ""; }

        var projectFolder = "";
        var projName = app.project.name || "Untitled Project";

        if (projPath && projPath !== "") {
            try {
                var pf = new File(projPath);
                if (pf.exists) {
                    projectFolder = pf.parent.fsName;
                    projName = pf.name;
                }
            } catch (eF) {}
        }

        var clips = [];
        var seenClips = {};
        if (app.project.rootItem) {
            collectMediaProjectItems(app.project.rootItem, clips, seenClips);
        }
        collectSequenceTimelineMediaItems(clips, seenClips);

        var totalClips = clips.length;
        var offlineClips = 0;
        var onlineClips = 0;

        for (var c = 0; c < clips.length; c++) {
            var item = clips[c];
            var isOff = false;
            try {
                isOff = item.isOffline();
            } catch (eOff) {
                isOff = false;
            }

            // Verify if media path actually exists on disk
            if (!isOff) {
                try {
                    var mPath = cleanNativeMediaPath(item.getMediaPath());
                    if (mPath) {
                        var fCheck = new File(mPath);
                        if (!fCheck.exists) {
                            isOff = true;
                        }
                    }
                } catch (eMp) {}
            }

            if (isOff) {
                offlineClips++;
            } else {
                onlineClips++;
            }
        }

        // Look for Media_Relink_Manifest near project file
        var manifestPath = "";
        var manifestJsonPath = "";

        if (projectFolder) {
            var candidateDirs = [new Folder(projectFolder)];
            var pfDir = new Folder(projectFolder);
            if (pfDir.parent && pfDir.parent.exists) {
                candidateDirs.push(pfDir.parent);
            }

            for (var k = 0; k < candidateDirs.length; k++) {
                var cDir = candidateDirs[k];
                if (!cDir.exists) continue;
                var dirFiles = cDir.getFiles();
                if (!dirFiles) continue;
                for (var j = 0; j < dirFiles.length; j++) {
                    var df = dirFiles[j];
                    if (df instanceof File) {
                        if (!manifestJsonPath && df.name.match(/^Media_Relink_Manifest.*\.json$/i)) {
                            manifestJsonPath = df.fsName;
                        }
                        if (!manifestPath && df.name.match(/^Media_Relink_Manifest.*\.xlsx$/i)) {
                            manifestPath = df.fsName;
                        }
                    }
                }
                if (manifestJsonPath || manifestPath) break;
            }
        }

        var jsonStr = "{" +
            "\"projectPath\":\"" + projPath.replace(/\\/g, "\\\\") + "\"," +
            "\"projectName\":\"" + projName.replace(/"/g, '\\"') + "\"," +
            "\"projectFolder\":\"" + projectFolder.replace(/\\/g, "\\\\") + "\"," +
            "\"totalClips\":" + totalClips + "," +
            "\"offlineClips\":" + offlineClips + "," +
            "\"onlineClips\":" + onlineClips + "," +
            "\"manifestPath\":\"" + (manifestPath || "").replace(/\\/g, "\\\\") + "\"," +
            "\"manifestJsonPath\":\"" + (manifestJsonPath || "").replace(/\\/g, "\\\\") + "\"" +
        "}";

        return "SUCCESS|||" + jsonStr;
    } catch (err) {
        return "ERROR|||" + err.toString();
    }
};

// 2. Browse for Media Folder
$.runScript.browseForMediaFolder = function (promptText) {
    try {
        var defaultFolder = null;
        if (app.project && app.project.path) {
            try {
                var pf = new File(app.project.path);
                if (pf.exists) defaultFolder = pf.parent;
            } catch (e) {}
        }
        var picked = Folder.selectDialog(promptText || "Select Date Folder or Media Directory Containing Video Files", defaultFolder);
        if (picked && picked.exists) {
            return "SUCCESS|||" + picked.fsName;
        }
        return "CANCEL|||User cancelled folder selection.";
    } catch (err) {
        return "ERROR|||" + err.toString();
    }
};

// 3. Browse for Manifest File (.xlsx / .json)
$.runScript.browseForManifestFile = function () {
    try {
        var picked = File.openDialog("Select Media Relink Manifest (.json or .xlsx)", "Manifest Files:*.json;*.xlsx,All Files:*.*");
        if (picked && picked.exists) {
            return "SUCCESS|||" + picked.fsName;
        }
        return "CANCEL|||User cancelled file selection.";
    } catch (err) {
        return "ERROR|||" + err.toString();
    }
};

// 4. Relink Project Media (100% Reliable Offline-to-Online Resolution)
$.runScript.relinkProjectMedia = function (paramsStr) {
    try {
        if (!app.project) {
            return "ERROR|||No active project found in Premiere Pro.";
        }

        var params = {};
        if (paramsStr) {
            try {
                var cleanParamStr = String(paramsStr);
                try { cleanParamStr = decodeURIComponent(cleanParamStr); } catch(eD1) {}
                params = eval("(" + cleanParamStr + ")");
            } catch (pErr) {
                params = {};
            }
        }

        var searchDirStr = params.searchDir || "";
        var manifestPathStr = params.manifestPath || "";
        var offlineOnly = params.offlineOnly !== false;
        var manifestFiles = params.manifestFiles || null;

        var projPath = app.project.path || "";
        var projFolder = null;
        if (projPath) {
            try {
                var pFile = new File(projPath);
                if (pFile.exists) projFolder = pFile.parent;
            } catch (eP) {}
        }

        // Determine base search folder
        var searchFolder = null;
        if (searchDirStr) {
            var sf = new Folder(searchDirStr);
            if (sf.exists) searchFolder = sf;
        }
        if (!searchFolder && projFolder && projFolder.exists) {
            searchFolder = projFolder;
        }

        if (!searchFolder || !searchFolder.exists) {
            searchFolder = Folder.selectDialog("Select Folder Containing Media Files to Relink");
            if (!searchFolder || !searchFolder.exists) {
                return "CANCEL|||No valid search directory selected.";
            }
        }

        // Load Manifest Data if available
        var manifestByFileName = {};
        var manifestByRelPath = {};
        var manifestUsed = "";

        // 1. From external manifestFiles passed by CEP (parsed from Excel by local server)
        if (manifestFiles && manifestFiles.length > 0) {
            manifestUsed = "Workstation Manifest (" + manifestFiles.length + " files)";
            for (var m = 0; m < manifestFiles.length; m++) {
                var mItem = manifestFiles[m];
                if (mItem && mItem.fileName) {
                    var fn = mItem.fileName.toLowerCase();
                    if (!manifestByFileName[fn]) manifestByFileName[fn] = [];
                    manifestByFileName[fn].push(mItem);
                    if (mItem.relPath) {
                        var rp = mItem.relPath.toLowerCase().replace(/\\/g, "/");
                        manifestByRelPath[rp] = mItem;
                    }
                }
            }
        } else {
            // 2. Look for companion .json manifest on disk near project file
            var candidateJson = null;
            if (manifestPathStr && manifestPathStr.match(/\.json$/i)) {
                var jf = new File(manifestPathStr);
                if (jf.exists) candidateJson = jf;
            }
            if (!candidateJson && searchFolder.exists) {
                var sFiles = searchFolder.getFiles();
                if (sFiles) {
                    for (var sfIdx = 0; sfIdx < sFiles.length; sfIdx++) {
                        var curF = sFiles[sfIdx];
                        if (curF instanceof File && curF.name.match(/^Media_Relink_Manifest.*\.json$/i)) {
                            candidateJson = curF;
                            break;
                        }
                    }
                }
            }

            if (candidateJson && candidateJson.exists) {
                try {
                    candidateJson.open("r");
                    var rawJson = candidateJson.read();
                    candidateJson.close();
                    var parsed = eval("(" + rawJson + ")");
                    if (parsed && parsed.files && parsed.files.length > 0) {
                        manifestUsed = candidateJson.fsName;
                        for (var pj = 0; pj < parsed.files.length; pj++) {
                            var pItem = parsed.files[pj];
                            if (pItem && pItem.fileName) {
                                var pfn = pItem.fileName.toLowerCase();
                                if (!manifestByFileName[pfn]) manifestByFileName[pfn] = [];
                                manifestByFileName[pfn].push(pItem);
                                if (pItem.relPath) {
                                    var prp = pItem.relPath.toLowerCase().replace(/\\/g, "/");
                                    manifestByRelPath[prp] = pItem;
                                }
                            }
                        }
                    }
                } catch (readErr) {}
            }
        }

        // Recursive disk scan of searchFolder to index all available media files
        var diskFilesByName = {};
        var diskFilesByRelPath = {};

        function scanFolderRecursive(folder, baseFolder) {
            if (!folder || !folder.exists) return;
            var entries = folder.getFiles();
            if (!entries) return;

            var baseFs = baseFolder.fsName.replace(/\\/g, "/");

            for (var e = 0; e < entries.length; e++) {
                var ent = entries[e];
                if (ent instanceof Folder) {
                    var folName = ent.name.toLowerCase();
                    // Ignore common non-media directories
                    if (folName !== "export" && folName !== "exports" && folName !== "previews" &&
                        folName !== ".git" && folName !== "adobe premiere pro auto-save" &&
                        folName !== "$recycle.bin" && folName !== "system volume information") {
                        scanFolderRecursive(ent, baseFolder);
                    }
                } else if (ent instanceof File) {
                    var lastDot = ent.name.lastIndexOf(".");
                    var ext = lastDot !== -1 ? ent.name.substring(lastDot).toLowerCase() : "";
                    if (isRelinkableMediaExt(ext)) {
                        var lName = ent.name.toLowerCase();
                        if (!diskFilesByName[lName]) {
                            diskFilesByName[lName] = [];
                        }
                        diskFilesByName[lName].push(ent);

                        var entFs = ent.fsName.replace(/\\/g, "/");
                        if (entFs.indexOf(baseFs) === 0) {
                            var rel = entFs.substring(baseFs.length).replace(/^\/+/, "").toLowerCase();
                            diskFilesByRelPath[rel] = ent;
                        }
                    }
                }
            }
        }

        scanFolderRecursive(searchFolder, searchFolder);

        // Collect all clips from both rootItem AND all sequence timelines
        var allClips = [];
        var seenClips = {};
        if (app.project.rootItem) {
            collectMediaProjectItems(app.project.rootItem, allClips, seenClips);
        }
        collectSequenceTimelineMediaItems(allClips, seenClips);

        var relinkedCount = 0;
        var alreadyOnlineCount = 0;
        var unresolvedList = [];

        for (var c = 0; c < allClips.length; c++) {
            var clip = allClips[c];
            if (!clip || typeof clip.canChangeMediaPath !== "function" || !clip.canChangeMediaPath()) {
                continue;
            }

            var isOff = false;
            try { isOff = clip.isOffline(); } catch (eOff) { isOff = false; }

            var curPathRaw = "";
            try { curPathRaw = clip.getMediaPath() || ""; } catch (eMp) { curPathRaw = ""; }
            var curPath = cleanNativeMediaPath(curPathRaw);

            // If offlineOnly is true and clip is currently online and file exists, skip
            if (offlineOnly && !isOff && curPath) {
                var curFile = new File(curPath);
                if (curFile.exists) {
                    alreadyOnlineCount++;
                    continue;
                }
            }

            // Determine target clip file name
            var targetFileName = "";
            if (curPath) {
                targetFileName = curPath.split(/[\\\/]/).pop();
            }
            if (!targetFileName && clip.name) {
                targetFileName = clip.name;
            }
            if (targetFileName) {
                try { targetFileName = decodeURIComponent(targetFileName); } catch(eDec2) {}
            }
            if (!targetFileName) {
                unresolvedList.push("Unknown Clip #" + (c + 1));
                continue;
            }

            var lowerTarget = targetFileName.toLowerCase();
            var matchedFile = null;

            // Extract parent directory and Premiere project bin name for disambiguation
            var parentName = "";
            if (curPath) {
                var curFolder = curPath.replace(/\\/g, "/").split("/");
                if (curFolder.length >= 2) {
                    parentName = curFolder[curFolder.length - 2].toLowerCase();
                }
            }

            var binName = "";
            try {
                if (clip.parent && clip.parent.name) {
                    binName = clip.parent.name.toLowerCase();
                }
            } catch (eBin) {}

            // Helper to verify a manifest entry against disk
            function resolveManifestEntry(entry) {
                if (!entry) return null;
                if (entry.relPath) {
                    var relNorm = entry.relPath.replace(/\\/g, "/").replace(/^\/+/, "");
                    var candRelFile = new File(searchFolder.fsName + "/" + relNorm);
                    if (candRelFile.exists) return candRelFile;
                }
                if (entry.fullPath) {
                    var candFullFile = new File(cleanNativeMediaPath(entry.fullPath));
                    if (candFullFile.exists) return candFullFile;
                }
                return null;
            }

            // Strategy 1: Match by relative path in Manifest (respecting camera/subfolder)
            if (parentName) {
                var parentRelKey = parentName + "/" + lowerTarget;
                if (manifestByRelPath[parentRelKey]) {
                    matchedFile = resolveManifestEntry(manifestByRelPath[parentRelKey]);
                }
            }
            if (!matchedFile && binName) {
                var binRelKey = binName + "/" + lowerTarget;
                if (manifestByRelPath[binRelKey]) {
                    matchedFile = resolveManifestEntry(manifestByRelPath[binRelKey]);
                }
            }

            // Strategy 2: Match by relative path directly on disk
            if (!matchedFile && parentName) {
                var parentDiskKey = parentName + "/" + lowerTarget;
                if (diskFilesByRelPath[parentDiskKey] && diskFilesByRelPath[parentDiskKey].exists) {
                    matchedFile = diskFilesByRelPath[parentDiskKey];
                }
            }
            if (!matchedFile && binName) {
                var binDiskKey = binName + "/" + lowerTarget;
                if (diskFilesByRelPath[binDiskKey] && diskFilesByRelPath[binDiskKey].exists) {
                    matchedFile = diskFilesByRelPath[binDiskKey];
                }
            }

            // Strategy 3: Check Manifest by filename with multi-camera disambiguation
            if (!matchedFile && manifestByFileName[lowerTarget]) {
                var mEntries = manifestByFileName[lowerTarget];
                if (mEntries.length === 1) {
                    matchedFile = resolveManifestEntry(mEntries[0]);
                } else if (mEntries.length > 1) {
                    for (var me = 0; me < mEntries.length; me++) {
                        var curM = mEntries[me];
                        var mSub = curM.subfolder ? curM.subfolder.toLowerCase() : "";
                        var mRel = curM.relPath ? curM.relPath.toLowerCase().replace(/\\/g, "/") : "";
                        if (parentName && (mSub === parentName || mRel.indexOf(parentName) !== -1)) {
                            matchedFile = resolveManifestEntry(curM);
                            if (matchedFile) break;
                        }
                        if (binName && (mSub === binName || mRel.indexOf(binName) !== -1)) {
                            matchedFile = resolveManifestEntry(curM);
                            if (matchedFile) break;
                        }
                    }
                    if (!matchedFile) {
                        matchedFile = resolveManifestEntry(mEntries[0]);
                    }
                }
            }

            // Strategy 4: Match by filename in diskFilesByName (with multi-camera disambiguation)
            if (!matchedFile && diskFilesByName[lowerTarget]) {
                var candidates = diskFilesByName[lowerTarget];
                if (candidates.length === 1 && candidates[0].exists) {
                    matchedFile = candidates[0];
                } else if (candidates.length > 1) {
                    for (var cd = 0; cd < candidates.length; cd++) {
                        var cand = candidates[cd];
                        if (!cand || !cand.exists) continue;
                        var candParent = cand.parent ? cand.parent.name.toLowerCase() : "";
                        var candPathLower = cand.fsName.toLowerCase();

                        if (parentName && (candParent === parentName || candPathLower.indexOf(parentName) !== -1)) {
                            matchedFile = cand;
                            break;
                        }
                        if (binName && (candParent === binName || candPathLower.indexOf(binName) !== -1)) {
                            matchedFile = cand;
                            break;
                        }
                    }

                    if (!matchedFile && candidates[0].exists) {
                        matchedFile = candidates[0];
                    }
                }
            }

            // Strategy 4: Fallback stem match (ignoring transcode / extension differences)
            if (!matchedFile) {
                var stem = lowerTarget.substring(0, lowerTarget.lastIndexOf("."));
                if (stem) {
                    for (var dName in diskFilesByName) {
                        if (diskFilesByName.hasOwnProperty(dName)) {
                            var dStem = dName.substring(0, dName.lastIndexOf("."));
                            if (dStem === stem) {
                                var stemCandidates = diskFilesByName[dName];
                                if (stemCandidates && stemCandidates.length > 0 && stemCandidates[0].exists) {
                                    matchedFile = stemCandidates[0];
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // Apply changeMediaPath & refreshMedia to bring clip online
            if (matchedFile && matchedFile.exists) {
                var changeOk = false;
                var nativeFsPath = matchedFile.fsName;

                try {
                    changeOk = clip.changeMediaPath(nativeFsPath, true);
                    if (changeOk === undefined) changeOk = true;
                } catch (chgErr1) {
                    try {
                        changeOk = clip.changeMediaPath(nativeFsPath);
                        if (changeOk === undefined) changeOk = true;
                    } catch (chgErr2) {
                        changeOk = false;
                    }
                }

                // Force Premiere Pro to reload frames & audio waveforms
                try {
                    if (typeof clip.refreshMedia === "function") {
                        clip.refreshMedia();
                    }
                } catch (eRef) {}

                // Verify online status
                var verifiedOnline = false;
                try {
                    if (typeof clip.isOffline === "function") {
                        verifiedOnline = !clip.isOffline();
                    } else {
                        verifiedOnline = true;
                    }
                } catch (eVer) {
                    verifiedOnline = changeOk;
                }

                var checkMp = cleanNativeMediaPath(clip.getMediaPath());
                if (checkMp && new File(checkMp).exists) {
                    verifiedOnline = true;
                }

                if (verifiedOnline || changeOk) {
                    relinkedCount++;
                } else {
                    unresolvedList.push(targetFileName + " (Premiere relink rejected)");
                }
            } else {
                unresolvedList.push(targetFileName);
            }
        }

        // Return detailed result
        var missingPreview = [];
        for (var u = 0; u < Math.min(unresolvedList.length, 30); u++) {
            missingPreview.push(unresolvedList[u].replace(/"/g, ""));
        }

        var resultJson = "{" +
            "\"relinkedCount\":" + relinkedCount + "," +
            "\"alreadyOnlineCount\":" + alreadyOnlineCount + "," +
            "\"unresolvedCount\":" + unresolvedList.length + "," +
            "\"totalClips\":" + allClips.length + "," +
            "\"searchFolder\":\"" + searchFolder.fsName.replace(/\\/g, "\\\\") + "\"," +
            "\"manifestUsed\":\"" + manifestUsed.replace(/\\/g, "\\\\") + "\"," +
            "\"missingFiles\":[" + (missingPreview.length > 0 ? "\"" + missingPreview.join("\",\"") + "\"" : "") + "]" +
        "}";

        return "SUCCESS|||" + resultJson;
    } catch (err) {
        return "ERROR|||" + err.toString();
    }
};
