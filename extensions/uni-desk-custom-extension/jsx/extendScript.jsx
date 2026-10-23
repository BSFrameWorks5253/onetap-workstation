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
// Get Marker Names for Audio Exceptions / Selection Modal
// ----------------------
$.runScript.getMarkerNames = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence.";
        var markers = seq.markers;
        if (!markers) return "ERROR|||No markers found.";
        
        var list = [];
        var cur = markers.getFirstMarker();
        var count = 0;
        while (cur) {
            var name = cur.name || ("marker_" + count);
            name = name.replace(/[\\\/:*?"<>|]/g, "_"); // Sanitize filename characters
            list.push(name + ".mp4");
            cur = markers.getNextMarker(cur);
            count++;
        }
        return "SUCCESS|||" + list.join("|||");
    } catch(e) {
        return "ERROR|||" + e.toString();
    }
};

// Helper to find last used preset or bundled high-speed hardware preset
function getLastUsedEncoderPreset() {
    try {
        // 1. Prioritize bundled high-speed GPU optimized preset
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
    try {
        if (typeof userChoice === "boolean") {
            addSeqPrefix = userChoice;
            userChoice = null;
        }
        var shouldAddSeqPrefix = (addSeqPrefix === true || addSeqPrefix === "true");

        var seq = app.project.activeSequence;
        if (!seq) return "No active sequence found.";

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
        var m = markers.getFirstMarker();
        while (m) {
            try {
                var cIdx = 5;
                if (typeof m.getColorByIndex === "function") {
                    try { cIdx = m.getColorByIndex(0); } catch (eColor) { cIdx = 5; }
                }
                list.push({
                    obj: m,
                    name: (m.name !== undefined ? m.name : ""),
                    startSec: (m.start && !isNaN(Number(m.start.seconds))) ? Number(m.start.seconds) : 0,
                    comment: (m.comments !== undefined ? m.comments : ""),
                    colorIndex: cIdx
                });
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
            var s = Number(list[i].startSec || 0);
            var e;
            if (i < list.length - 1) {
                var ns = Number(list[i + 1].startSec || s);
                e = ns - frameDuration;
            } else {
                e = seqEndSec;
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
                var pMatch = cName.match(/^([A-Za-z]+)/);
                var pfx = pMatch ? pMatch[1].toUpperCase() : "Other";
                if (!prefixCounts.hasOwnProperty(pfx)) {
                    prefixCounts[pfx] = 0;
                    prefixOrder.push(pfx);
                }
                prefixCounts[pfx] = prefixCounts[pfx] + 1;
            } catch (ce) {
                // continue on error
            }
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
    }
};

// ----------------------
// Auto MEIO Export (Batch or Selected Custom Markers)
// ----------------------
$.runScript.autoMEIO = function (selectedMarkersStr) {
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
        var presetPath = getLastUsedEncoderPreset();

        // Active sequence + markers
        var seq = app.project.activeSequence;
        if (!seq) return "No active sequence.";
        var markers = seq.markers;
        if (!markers) return "No markers found.";

        var cur = markers.getFirstMarker();
        var count = 0;
        var queuedFiles = [];

        // Queue in Media Encoder
        while (cur) {
            try {
                var name = cur.name || ("marker_" + count);
                name = name.replace(/[\\\/:*?"<>|]/g, "_");
                var filename = name + ".mp4";

                var shouldExport = true;
                if (selectedList) {
                    shouldExport = false;
                    for (var k = 0; k < selectedList.length; k++) {
                        if (selectedList[k] === filename) {
                            shouldExport = true;
                            break;
                        }
                    }
                }

                if (shouldExport) {
                    seq.setInPoint(cur.start.seconds);
                    seq.setOutPoint(cur.end.seconds);

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
                        app.encoder.ENCODE_IN_TO_OUT,
                        1
                    );
                    queuedFiles.push(filename);
                    count++;
                }

            } catch (e) {
                // continue with next marker
            }

            cur = markers.getNextMarker(cur);
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

    var picked = File.openDialog("Locate Sequence XML File to Import", "XML Files:*.xml;All Files:*.*");
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

$.runScript.importMediaXml = function() {
    try {
        var targetXml = $.runScript.locateMatchingXmlFile();

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
            importSuccess = app.project.importFiles([targetXml.fsName], true, app.project.rootItem, false);
        } catch (eImp) {
            $.runScript.showWorkspaceModal("One Tap — XML Import Error", "Import Failed", eImp.toString(), "ERROR");
            return "ERROR|||Import exception: " + eImp.toString();
        }

        if (!importSuccess) {
            var failMsg = "Premiere Pro could not import XML sequence file:\n" + targetXml.fsName;
            $.runScript.showWorkspaceModal("One Tap — XML Import Error", "Premiere Pro Import Failed", failMsg, "ERROR");
            return "ERROR|||" + failMsg;
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
                if (item.type === 2 || (item.isSequence && item.isSequence())) {
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
                    app.project.openSequence(targetSeq.sequenceID);
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
    if (/group\s*photo|group\s*video|nikah\s*group|nikaah\s*group|nikah\s*photo|nikah\s*video/i.test(s)) return true;
    if (/(?:^|[\s_.-])gp(?:[_\s-]*\d+)?(?:[\s_.-]|$)/i.test(s)) return true;
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

        // 1. Identify the Group Photo Video Clip & its Native Duration
        var groupProjectItem = null;
        var detectedDuration = 0;
        var sourceInPoint = 0;
        var sourceOutPoint = 0;
        var selectedClipTrackIndex = null;

        // Strategy A0: Scan timeline video tracks for Mango-colored clip (Label index 7 or 8)
        try {
            var vtA0 = seq.videoTracks;
            if (vtA0) {
                for (var ti0 = 0; ti0 < vtA0.numTracks; ti0++) {
                    var trk0 = vtA0[ti0];
                    if (!trk0 || !trk0.clips) continue;
                    for (var ci0 = 0; ci0 < trk0.clips.numItems; ci0++) {
                        var c0 = trk0.clips[ci0];
                        if (!c0) continue;
                        var cColor = (typeof c0.getColorLabel === "function") ? c0.getColorLabel() : -1;
                        var pColor = (c0.projectItem && typeof c0.projectItem.getColorLabel === "function") ? c0.projectItem.getColorLabel() : -1;
                        if (cColor === 7 || cColor === 8 || pColor === 7 || pColor === 8) {
                            groupProjectItem = c0.projectItem;
                            if (c0.duration && c0.duration.seconds > 0) {
                                detectedDuration = c0.duration.seconds;
                            } else if (c0.start && c0.end && c0.end.seconds > c0.start.seconds) {
                                detectedDuration = c0.end.seconds - c0.start.seconds;
                            }
                            if (c0.inPoint && !isNaN(Number(c0.inPoint.seconds))) {
                                sourceInPoint = Number(c0.inPoint.seconds);
                            }
                            if (c0.outPoint && !isNaN(Number(c0.outPoint.seconds))) {
                                sourceOutPoint = Number(c0.outPoint.seconds);
                            }
                            selectedClipTrackIndex = ti0;
                            break;
                        }
                    }
                    if (groupProjectItem) break;
                }
            }
        } catch (eMango) {}

        // Strategy A: Check current selection in timeline
        if (!groupProjectItem) {
            try {
                var sel = seq.getSelection();
                if (sel && sel.length > 0) {
                    for (var s = 0; s < sel.length; s++) {
                        var itm = sel[s];
                        if (itm && (itm.mediaType === "VIDEO" || itm.projectItem)) {
                            groupProjectItem = itm.projectItem;
                            if (itm.duration && itm.duration.seconds > 0) {
                                detectedDuration = itm.duration.seconds;
                            } else if (itm.start && itm.end && itm.end.seconds > itm.start.seconds) {
                                detectedDuration = itm.end.seconds - itm.start.seconds;
                            }
                            if (itm.inPoint && !isNaN(Number(itm.inPoint.seconds))) {
                                sourceInPoint = Number(itm.inPoint.seconds);
                            }
                            if (itm.outPoint && !isNaN(Number(itm.outPoint.seconds))) {
                                sourceOutPoint = Number(itm.outPoint.seconds);
                            }
                            // Detect track index
                            for (var vi = 0; vi < seq.videoTracks.numTracks; vi++) {
                                var vTrk = seq.videoTracks[vi];
                                if (!vTrk || !vTrk.clips) continue;
                                for (var cvi = 0; cvi < vTrk.clips.numItems; cvi++) {
                                    var tc = vTrk.clips[cvi];
                                    if (tc === itm || (tc.projectItem === itm.projectItem && Math.abs(tc.start.seconds - itm.start.seconds) < 0.05)) {
                                        selectedClipTrackIndex = vi;
                                        break;
                                    }
                                }
                                if (selectedClipTrackIndex !== null) break;
                            }
                            break;
                        }
                    }
                }
            } catch (eSel) {}
        }

        // Strategy B: Scan sequence video tracks for clip name matching group photo keywords
        if (!groupProjectItem) {
            var vt = seq.videoTracks;
            if (vt) {
                for (var ti = 0; ti < vt.numTracks; ti++) {
                    var trk = vt[ti];
                    if (!trk || !trk.clips) continue;
                    for (var ci = 0; ci < trk.clips.numItems; ci++) {
                        var c = trk.clips[ci];
                        var cName = (c && c.name) ? c.name : "";
                        var pName = (c && c.projectItem && c.projectItem.name) ? c.projectItem.name : "";
                        if (isGroupPhotoName(cName) || isGroupPhotoName(pName)) {
                            groupProjectItem = c.projectItem;
                            if (c.duration && c.duration.seconds > 0) {
                                detectedDuration = c.duration.seconds;
                            } else if (c.start && c.end && c.end.seconds > c.start.seconds) {
                                detectedDuration = c.end.seconds - c.start.seconds;
                            }
                            if (c.inPoint && !isNaN(Number(c.inPoint.seconds))) {
                                sourceInPoint = Number(c.inPoint.seconds);
                            }
                            if (c.outPoint && !isNaN(Number(c.outPoint.seconds))) {
                                sourceOutPoint = Number(c.outPoint.seconds);
                            }
                            selectedClipTrackIndex = ti;
                            break;
                        }
                    }
                    if (groupProjectItem) break;
                }
            }
        }

        // Strategy C: Check project items in project bins
        if (!groupProjectItem) {
            function findGpInBin(bin) {
                if (!bin || !bin.children) return null;
                for (var b = 0; b < bin.children.numItems; b++) {
                    var child = bin.children[b];
                    if (!child) continue;
                    if (child.type === 2 || (child.isSequence && child.isSequence())) continue;
                    if (child.type === 1) { // BIN
                        var subFound = findGpInBin(child);
                        if (subFound) return subFound;
                    } else {
                        var nm = child.name || "";
                        if (isGroupPhotoName(nm)) {
                            return child;
                        }
                    }
                }
                return null;
            }
            groupProjectItem = findGpInBin(app.project.rootItem);
        }

        if (!groupProjectItem) {
            var warnMsg = "Could not automatically identify the Nikah Group Photo video clip.\n\n" +
                          "How to use:\n" +
                          "1. Select your Group Photo video clip on the Timeline\n" +
                          "   OR name the clip in your Bin 'Group Photo' / 'GP1' / 'GP'\n" +
                          "2. Click 'Nikah Group Photo' again.";
            $.runScript.showWorkspaceModal("One Tap — Nikah Group Photo", "Group Photo Video Not Found", warnMsg, "WARNING");
            return "ERROR|||Group photo video clip not found. Please select it on timeline.";
        }

        // Determine effective duration of group photo video
        var groupDuration = detectedDuration;
        if (groupDuration <= 0 && sourceOutPoint > sourceInPoint) {
            groupDuration = sourceOutPoint - sourceInPoint;
        }
        if (groupDuration <= 0 && groupProjectItem) {
            try {
                var inP = groupProjectItem.getInPoint ? groupProjectItem.getInPoint() : null;
                var outP = groupProjectItem.getOutPoint ? groupProjectItem.getOutPoint() : null;
                if (outP && outP.seconds > 0) {
                    var inPSec = (inP && inP.seconds > 0) ? inP.seconds : 0;
                    if (outP.seconds > inPSec) groupDuration = outP.seconds - inPSec;
                }
            } catch (eDurP) {}
        }
        if (groupDuration <= 0 && groupProjectItem) {
            try {
                var meta = groupProjectItem.getProjectMetadata ? groupProjectItem.getProjectMetadata() : "";
                var match = meta.match(/Column\.Intrinsic\.MediaDuration[^\>]*\>([^\<]+)\</i);
                if (match && match[1]) {
                    var p = match[1].split(/[:;]/);
                    if (p.length === 4) {
                        var totalSec = (parseFloat(p[0]) || 0) * 3600 + (parseFloat(p[1]) || 0) * 60 + (parseFloat(p[2]) || 0) + ((parseFloat(p[3]) || 0) / 25.0);
                        if (totalSec > 0) groupDuration = totalSec;
                    }
                }
            } catch (eMeta) {}
        }
        // Fallback: place temporarily far downstream to inspect intrinsic duration
        if (groupDuration <= 0 && groupProjectItem && seq.videoTracks && seq.videoTracks.numTracks > 0) {
            try {
                var farEnd = 86400;
                try {
                    var sE = Number(seq.end && seq.end.seconds);
                    if (isFinite(sE) && sE > 0) farEnd = sE + 3600;
                } catch(eFE) {}
                var testTrk = seq.videoTracks[0];
                testTrk.overwriteClip(groupProjectItem, toTime(farEnd));
                for (var tci = testTrk.clips.numItems - 1; tci >= 0; tci--) {
                    var tClip = testTrk.clips[tci];
                    if (tClip && Math.abs(tClip.start.seconds - farEnd) < 0.5) {
                        if (tClip.duration && tClip.duration.seconds > 0) {
                            groupDuration = tClip.duration.seconds;
                        } else if (tClip.end && tClip.start && tClip.end.seconds > tClip.start.seconds) {
                            groupDuration = tClip.end.seconds - tClip.start.seconds;
                        }
                        try { tClip.end = toTime(farEnd + 0.001); } catch(eRm) {}
                        break;
                    }
                }
            } catch(eTempDur) {}
        }
        if (groupDuration <= 0) {
            var promptVal = prompt("Enter Group Photo Video duration in seconds (e.g. 15 or 20):", "15");
            var parsedVal = parseFloat(promptVal);
            groupDuration = (parsedVal && !isNaN(parsedVal) && parsedVal > 0) ? parsedVal : 15.0;
        }

        // Round duration to 2 decimal places for clean calculations
        groupDuration = Math.round(groupDuration * 100) / 100;
        var clipNameDisplay = groupProjectItem.name || "Group Photo Video";

        // 2. Identify all Nikah (N) markers
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
                        // Look for end of video clip on timeline near s
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

        // FALLBACK: If no Nikah markers found in seq.markers, scan timeline video tracks for Nikaah clips directly
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

        // Sort Nikah segments chronologically
        nikahSegments.sort(function(a, b) { return a.startSec - b.startSec; });

        // Prompt user to select which Nikah sequence marker(s) to place the Group Photo into
        var defaultRange = "1-" + nikahSegments.length;
        var markerListText = "";
        for (var nIdx = 0; nIdx < Math.min(nikahSegments.length, 8); nIdx++) {
            markerListText += (nIdx + 1) + ". " + nikahSegments[nIdx].name + "\n";
        }
        if (nikahSegments.length > 8) {
            markerListText += "... (" + (nikahSegments.length - 8) + " more)\n";
        }

        var rangeInput = prompt(
            "Found " + nikahSegments.length + " Nikah (N) marker(s):\n\n" +
            markerListText + "\n" +
            "Enter sequence range to place into (e.g. 1-" + nikahSegments.length + " or 1,2 or 'all'):",
            defaultRange
        );

        if (rangeInput === null) {
            return "ERROR|||Operation cancelled by user.";
        }

        // Filter nikahSegments based on rangeInput
        var activeNikahSegments = [];
        var cleanInput = (rangeInput || "").replace(/^\s+|\s+$/g, "").toLowerCase();
        if (!cleanInput || cleanInput === "all" || cleanInput === "*") {
            activeNikahSegments = nikahSegments;
        } else {
            var selectedIndices = {};
            var rangeTokens = cleanInput.split(",");
            for (var rk = 0; rk < rangeTokens.length; rk++) {
                var tok = rangeTokens[rk].replace(/^\s+|\s+$/g, "");
                if (tok.indexOf("-") > -1) {
                    var parts = tok.split("-");
                    var startI = parseInt(parts[0], 10);
                    var endI = parseInt(parts[1], 10);
                    if (!isNaN(startI) && !isNaN(endI)) {
                        var minK = Math.min(startI, endI);
                        var maxK = Math.max(startI, endI);
                        for (var curI = minK; curI <= maxK; curI++) {
                            if (curI >= 1 && curI <= nikahSegments.length) {
                                selectedIndices[curI - 1] = true;
                            }
                        }
                    }
                } else {
                    var sVal = parseInt(tok, 10);
                    if (!isNaN(sVal) && sVal >= 1 && sVal <= nikahSegments.length) {
                        selectedIndices[sVal - 1] = true;
                    }
                }
            }
            for (var si = 0; si < nikahSegments.length; si++) {
                if (selectedIndices[si]) {
                    activeNikahSegments.push(nikahSegments[si]);
                }
            }
        }

        if (activeNikahSegments.length === 0) {
            activeNikahSegments = nikahSegments;
        }
        nikahSegments = activeNikahSegments;

        // 3. User Confirmation Dialog for Ripple Insert
        var confirmMsg = "Nikah Group Photo Video — Ripple Insertion\n\n" +
                         "• Video Asset: " + clipNameDisplay + "\n" +
                         "• Video Duration: " + groupDuration + " seconds\n" +
                         "• Target Nikah Ceremonies: " + nikahSegments.length + "\n" +
                         "• Insertion Point: END of each Nikah ceremony (Recommended)\n\n" +
                         "All downstream timeline video tracks & audio tracks will shift forward by +" + groupDuration + "s so ZERO content is cut.\n\n" +
                         "Proceed with Ripple Insertion?";
        var userApproved = true;
        try {
            userApproved = confirm(confirmMsg);
        } catch (eConf) { userApproved = true; }

        if (!userApproved) {
            return "ERROR|||Operation cancelled by user.";
        }

        // Determine destination video track (V1 default, or track of selected clip)
        var targetTrackIndex = (selectedClipTrackIndex !== null && selectedClipTrackIndex < seq.videoTracks.numTracks) ? selectedClipTrackIndex : 0;
        var targetVideoTrack = seq.videoTracks[targetTrackIndex];

        // Ensure all tracks are unlocked
        for (var vi = 0; vi < seq.videoTracks.numTracks; vi++) {
            try {
                var vTrk = seq.videoTracks[vi];
                if (typeof vTrk.isLocked === "function" && vTrk.isLocked()) vTrk.setLocked(false);
                else if (vTrk.isLocked === true) vTrk.isLocked = false;
            } catch (eVLk) {}
        }
        for (var ai = 0; ai < seq.audioTracks.numTracks; ai++) {
            try {
                var aTrk = seq.audioTracks[ai];
                if (typeof aTrk.isLocked === "function" && aTrk.isLocked()) aTrk.setLocked(false);
                else if (aTrk.isLocked === true) aTrk.isLocked = false;
            } catch (eALk) {}
        }

        // Helper: Shift an individual clip forward by shiftAmount seconds
        function shiftClipForward(clip, track, shiftAmount) {
            if (!clip || shiftAmount <= 0) return false;
            var oldStart = clip.start ? clip.start.seconds : 0;
            var oldEnd = clip.end ? clip.end.seconds : 0;
            var dur = (oldEnd > oldStart) ? (oldEnd - oldStart) : (clip.duration ? clip.duration.seconds : 0);
            var targetStartSec = oldStart + shiftAmount;
            var targetEndSec = oldEnd + shiftAmount;

            var moved = false;

            // Attempt 1: clip.move(Time) if supported by Premiere Pro version
            if (typeof clip.move === "function") {
                try {
                    clip.move(toTime(targetStartSec));
                    if (Math.abs(clip.start.seconds - targetStartSec) < 0.2) moved = true;
                } catch (eMv) {}
            }

            // Attempt 2: Direct assignment of Time to clip.start (safe because shifting right-to-left into empty space)
            if (!moved) {
                try {
                    clip.start = toTime(targetStartSec);
                    if (Math.abs(clip.start.seconds - targetStartSec) < 0.2) moved = true;
                } catch (eSt) {}
            }

            // Attempt 3: Assign clip.end first then clip.start
            if (!moved) {
                try {
                    clip.end = toTime(targetEndSec);
                    clip.start = toTime(targetStartSec);
                    if (Math.abs(clip.start.seconds - targetStartSec) < 0.2) moved = true;
                } catch (eEndSt) {}
            }

            // Attempt 4: Overwrite recreation fallback
            if (!moved && clip.projectItem) {
                try {
                    var pItem = clip.projectItem;
                    var inSec = (clip.inPoint && !isNaN(clip.inPoint.seconds)) ? clip.inPoint.seconds : 0;
                    var outSec = (clip.outPoint && !isNaN(clip.outPoint.seconds)) ? clip.outPoint.seconds : (inSec + dur);

                    track.overwriteClip(pItem, toTime(targetStartSec));
                    for (var ci = track.clips.numItems - 1; ci >= 0; ci--) {
                        var placed = track.clips[ci];
                        if (placed && Math.abs(placed.start.seconds - targetStartSec) < 0.25) {
                            try {
                                placed.inPoint = toTime(inSec);
                                placed.outPoint = toTime(outSec);
                            } catch (eInO) {}
                            moved = true;
                            break;
                        }
                    }
                } catch (eOv) {}
            }

            return moved;
        }

        // 4. Reverse-Chronological Processing (N_last -> N_1)
        // Shifting and inserting from the end ensures earlier Nikah timestamps are never shifted or corrupted
        var placedCount = 0;
        var timeSummary = [];

        for (var ni = nikahSegments.length - 1; ni >= 0; ni--) {
            var seg = nikahSegments[ni];
            var insertSec = seg.endSec; // Default insertion at the END of the Nikah ceremony

            // A. Shift all downstream clips across ALL Video Tracks (Right-to-Left)
            for (var vIdx = 0; vIdx < seq.videoTracks.numTracks; vIdx++) {
                var vTrk = seq.videoTracks[vIdx];
                if (!vTrk || !vTrk.clips) continue;

                var vClipsToShift = [];
                var vSpanningClips = [];

                // Scan right-to-left (from end of timeline backwards)
                for (var ci = vTrk.clips.numItems - 1; ci >= 0; ci--) {
                    var c = vTrk.clips[ci];
                    if (!c) continue;
                    var cStart = c.start ? c.start.seconds : 0;
                    var cEnd = c.end ? c.end.seconds : 0;

                    if (cStart >= (insertSec - 0.05)) {
                        vClipsToShift.push(c);
                    } else if (cStart < (insertSec - 0.05) && cEnd > (insertSec + 0.05)) {
                        vSpanningClips.push(c);
                    }
                }

                // Shift downstream clips from right to left
                for (var si = 0; si < vClipsToShift.length; si++) {
                    shiftClipForward(vClipsToShift[si], vTrk, groupDuration);
                }

                // Handle spanning clips (trim left half, replicate right half after gap)
                for (var sp = 0; sp < vSpanningClips.length; sp++) {
                    var spClip = vSpanningClips[sp];
                    try {
                        var oStart = spClip.start.seconds;
                        var oEnd = spClip.end.seconds;
                        var oIn = (spClip.inPoint && !isNaN(spClip.inPoint.seconds)) ? spClip.inPoint.seconds : 0;
                        var pItm = spClip.projectItem;

                        // Trim original clip to end at insertSec
                        spClip.end = toTime(insertSec);

                        // Recreate the second half starting at insertSec + groupDuration
                        if (pItm) {
                            var secondHalfStart = insertSec + groupDuration;
                            var secondHalfIn = oIn + (insertSec - oStart);
                            var secondHalfDur = oEnd - insertSec;
                            vTrk.overwriteClip(pItm, toTime(secondHalfStart));

                            for (var rci = vTrk.clips.numItems - 1; rci >= 0; rci--) {
                                var repClip = vTrk.clips[rci];
                                if (repClip && Math.abs(repClip.start.seconds - secondHalfStart) < 0.25) {
                                    try {
                                        repClip.inPoint = toTime(secondHalfIn);
                                        repClip.outPoint = toTime(secondHalfIn + secondHalfDur);
                                    } catch (eRep) {}
                                    break;
                                }
                            }
                        }
                    } catch (eSpanV) {}
                }
            }

            // B. Shift all downstream clips across ALL Audio Tracks (Right-to-Left)
            for (var aIdx = 0; aIdx < seq.audioTracks.numTracks; aIdx++) {
                var aTrk = seq.audioTracks[aIdx];
                if (!aTrk || !aTrk.clips) continue;

                var aClipsToShift = [];
                var aSpanningClips = [];

                for (var aci = aTrk.clips.numItems - 1; aci >= 0; aci--) {
                    var ac = aTrk.clips[aci];
                    if (!ac) continue;
                    var acStart = ac.start ? ac.start.seconds : 0;
                    var acEnd = ac.end ? ac.end.seconds : 0;

                    if (acStart >= (insertSec - 0.05)) {
                        aClipsToShift.push(ac);
                    } else if (acStart < (insertSec - 0.05) && acEnd > (insertSec + 0.05)) {
                        aSpanningClips.push(ac);
                    }
                }

                // Shift downstream audio clips from right to left
                for (var asi = 0; asi < aClipsToShift.length; asi++) {
                    shiftClipForward(aClipsToShift[asi], aTrk, groupDuration);
                }

                // Handle spanning audio clips
                for (var asp = 0; asp < aSpanningClips.length; asp++) {
                    var aspClip = aSpanningClips[asp];
                    try {
                        var aoStart = aspClip.start.seconds;
                        var aoEnd = aspClip.end.seconds;
                        var aoIn = (aspClip.inPoint && !isNaN(aspClip.inPoint.seconds)) ? aspClip.inPoint.seconds : 0;
                        var apItm = aspClip.projectItem;

                        aspClip.end = toTime(insertSec);

                        if (apItm) {
                            var aSecondStart = insertSec + groupDuration;
                            var aSecondIn = aoIn + (insertSec - aoStart);
                            var aSecondDur = aoEnd - insertSec;
                            aTrk.overwriteClip(apItm, toTime(aSecondStart));

                            for (var arci = aTrk.clips.numItems - 1; arci >= 0; arci--) {
                                var arepClip = aTrk.clips[arci];
                                if (arepClip && Math.abs(arepClip.start.seconds - aSecondStart) < 0.25) {
                                    try {
                                        arepClip.inPoint = toTime(aSecondIn);
                                        arepClip.outPoint = toTime(aSecondIn + aSecondDur);
                                    } catch (eARep) {}
                                    break;
                                }
                            }
                        }
                    } catch (eSpanA) {}
                }
            }

            // C. Insert Group Photo Video at the cleared window [insertSec, insertSec + groupDuration]
            try {
                targetVideoTrack.overwriteClip(groupProjectItem, toTime(insertSec));

                // Find the placed group photo clip to enforce trimmed in/out and duration
                var placedClip = null;
                for (var pci = targetVideoTrack.clips.numItems - 1; pci >= 0; pci--) {
                    var candClip = targetVideoTrack.clips[pci];
                    if (candClip && Math.abs(candClip.start.seconds - insertSec) < 0.35) {
                        placedClip = candClip;
                        break;
                    }
                }

                if (placedClip) {
                    try {
                        if (sourceInPoint > 0 || sourceOutPoint > sourceInPoint) {
                            placedClip.inPoint = toTime(sourceInPoint);
                            placedClip.outPoint = toTime(sourceInPoint + groupDuration);
                        }
                    } catch (eIO2) {}

                    try {
                        placedClip.end = toTime(insertSec + groupDuration);
                    } catch (eEnd2) {}
                }

                // Place audio on Audio Track 1 if sequence has audio tracks
                if (seq.audioTracks && seq.audioTracks.numTracks > 0) {
                    try {
                        seq.audioTracks[0].overwriteClip(groupProjectItem, toTime(insertSec));
                        for (var apci = seq.audioTracks[0].clips.numItems - 1; apci >= 0; apci--) {
                            var aCand = seq.audioTracks[0].clips[apci];
                            if (aCand && Math.abs(aCand.start.seconds - insertSec) < 0.35) {
                                try {
                                    if (sourceInPoint > 0 || sourceOutPoint > sourceInPoint) {
                                        aCand.inPoint = toTime(sourceInPoint);
                                        aCand.outPoint = toTime(sourceInPoint + groupDuration);
                                    }
                                } catch (eAIO2) {}
                                try {
                                    aCand.end = toTime(insertSec + groupDuration);
                                } catch (eAEnd2) {}
                                break;
                            }
                        }
                    } catch (eAudPlace) {}
                }

                placedCount++;
                var startFormatted = formatSec(insertSec);
                var endFormatted = formatSec(insertSec + groupDuration);
                timeSummary.unshift("• " + seg.name + ": Group Photo video inserted at " + startFormatted + " -> " + endFormatted + " (+" + groupDuration + "s shift)");
            } catch (ePlaceGp) {}

            // D. Shift Downstream Sequence Markers forward by +groupDuration
            try {
                var mList = [];
                var mk = markers.getFirstMarker();
                while (mk) {
                    mList.push(mk);
                    mk = markers.getNextMarker(mk);
                }
                for (var mki = 0; mki < mList.length; mki++) {
                    var curMk = mList[mki];
                    if (curMk && curMk.start && curMk.start.seconds >= (insertSec - 0.05)) {
                        try {
                            var mkS = curMk.start.seconds;
                            var mkE = (curMk.end && !isNaN(curMk.end.seconds)) ? curMk.end.seconds : mkS;
                            var mkD = (mkE > mkS) ? (mkE - mkS) : 0;

                            curMk.start = toTime(mkS + groupDuration);
                            if (mkD > 0) {
                                curMk.end = toTime(mkE + groupDuration);
                            }
                        } catch (eMkShift) {}
                    }
                }

                // Create a clear Timeline Marker for this Group Photo segment
                var gpMarker = markers.createMarker(insertSec);
                if (gpMarker) {
                    gpMarker.name = seg.name + " - Group Photo";
                    gpMarker.comments = "Nikah Group Photo Video (" + groupDuration + "s)";
                    gpMarker.end = toTime(insertSec + groupDuration);
                    try { gpMarker.setTypeAsChapter(); } catch(eCh) {}
                }
            } catch (eMkAll) {}
        }

        var totalExtension = Math.round(placedCount * groupDuration * 10) / 10;
        var summaryBody = "Successfully ripple-inserted '" + clipNameDisplay + "' across " + placedCount + " Nikah section(s) on Track V" + (targetTrackIndex + 1) + ":\n\n" +
                          "• Each Group Video Duration: " + groupDuration + "s\n" +
                          "• Total Timeline Extension: +" + totalExtension + "s\n" +
                          "• All downstream footage & audio tracks shifted forward (0% cuts)\n" +
                          "• Synchronized timeline markers updated\n\n" +
                          timeSummary.join("\n");

        $.runScript.showWorkspaceModal("One Tap — Nikah Group Photo Complete", placedCount + " Nikah Group Videos Inserted", summaryBody, "SUCCESS");
        return "SUCCESS|||" + placedCount + "|||" + clipNameDisplay + "|||" + totalExtension;
    } catch (err) {
        $.runScript.showWorkspaceModal("One Tap — Nikah Group Photo", "Error Processing", err.toString(), "ERROR");
        return "ERROR|||" + err.toString();
    }
};

// =============================================================================
// GROUP PHOTO INSERTER — New Feature (One Tap v26.7+)
// Fully additive — does NOT modify any existing function above.
// =============================================================================

// ── Shared helper: strict Nikaah detection (prefix === "N" only) ──────────────
function isStrictNikaahMarker(markerName) {
    if (!markerName) return false;
    var upper = String(markerName).replace(/\.[a-z0-9]{2,5}$/i, "").toUpperCase();

    // 0. EXCLUDE Namaz explicitly! Namaz is a prayer session, not a Nikaah ceremony.
    if (/\bNAMAZ\b/i.test(upper) || /[-_]NAMAZ[-_]/i.test(upper) || /[-_]NAMAZ$/i.test(upper)) {
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

// ── Shared helper: detect GROUP_PHOTO_N sequence markers or clips ─────────────
// Scans sequence markers (or video tracks/bins as fallback) for labels matching GROUP_PHOTO_1..9 / GPn
// Returns array of { gpNum, markerStartSec, clipProjectItem, clipName, duration, inPoint, outPoint, hasClip }
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
                allMarkers.push({ gpNum: gpNum, startSec: startSec, markerName: nm });
            }
            cur = seq.markers.getNextMarker(cur);
        }
    }

    // For each found GP marker, locate the video clip closest to that time or matching by name
    var vt = seq.videoTracks;
    for (var mi = 0; mi < allMarkers.length; mi++) {
        var gpm = allMarkers[mi];
        var bestClip = null;
        var bestDist = 9999999;

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

        // If not found by time, check for clip matching GP number
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

        var clipName = "Group Photo " + gpm.gpNum;
        var projItem = null;
        var clipDuration = 0;
        var clipInPoint = 0;
        var clipOutPoint = 0;

        if (bestClip) {
            clipName = (bestClip.name || (bestClip.projectItem && bestClip.projectItem.name) || clipName);
            projItem = bestClip.projectItem || null;
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

        found.push({
            gpNum: gpm.gpNum,
            markerStartSec: gpm.startSec,
            clipName: clipName,
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
                var cColor = (typeof c3.getColorLabel === "function") ? c3.getColorLabel() : -1;
                var pColor = (c3.projectItem && typeof c3.projectItem.getColorLabel === "function") ? c3.projectItem.getColorLabel() : -1;
                var isMango = (cColor === 7 || cColor === 8 || pColor === 7 || pColor === 8);

                if (isGroupPhotoName(c3Nm) || isMango) {
                    var gpN = extractGpNumber(c3Nm);
                    if (!seenGps[gpN]) {
                        seenGps[gpN] = true;
                        var dur3 = (c3.duration && c3.duration.seconds > 0) ? Number(c3.duration.seconds) : ((c3.start && c3.end) ? (c3.end.seconds - c3.start.seconds) : 0);
                        var in3 = (c3.inPoint && !isNaN(Number(c3.inPoint.seconds))) ? Number(c3.inPoint.seconds) : 0;
                        var out3 = (c3.outPoint && !isNaN(Number(c3.outPoint.seconds))) ? Number(c3.outPoint.seconds) : (in3 + dur3);
                        found.push({
                            gpNum: gpN,
                            markerStartSec: c3.start ? c3.start.seconds : 0,
                            clipName: c3Nm || ("Group Photo " + gpN),
                            projectItem: c3.projectItem || null,
                            duration: dur3,
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
                if (child.type === 1) { // BIN
                    scanBinForGps(child);
                } else {
                    var bNm = child.name || "";
                    if (isGroupPhotoName(bNm)) {
                        var bGpN = extractGpNumber(bNm);
                        if (!binGps[bGpN]) {
                            binGps[bGpN] = true;
                            found.push({
                                gpNum: bGpN,
                                markerStartSec: 0,
                                clipName: bNm,
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

    // Extract strictly N-prefix markers with corrected end boundary
    var nikahCount = 0;
    for (var mi = 0; mi < allMarkers.length; mi++) {
        var item = allMarkers[mi];
        if (!isStrictNikaahMarker(item.name)) continue;

        nikahCount++;
        var s = item.startSec;
        var e = item.endSec;

        // If marker has no duration, use next marker start or seq end
        if (e <= s) {
            // Find the next marker (any type) start
            var nextStart = null;
            for (var nj = mi + 1; nj < allMarkers.length; nj++) {
                if (allMarkers[nj].startSec > s) {
                    nextStart = allMarkers[nj].startSec;
                    break;
                }
            }
            e = (nextStart !== null) ? nextStart : seqEndSec;
            if (e <= s) e = s + 5;
        }

        nikaahList.push({
            seqNum: nikahCount,  // 1-based sequential position of this N marker
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
                nikaahList.push({
                    seqNum: cki + 1,
                    name: clipCandidates[cki].name,
                    startSec: clipCandidates[cki].startSec,
                    endSec: clipCandidates[cki].endSec
                });
            }
        }
    }

    return nikaahList;
}

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
// assignmentsStr format: "gpNum,fromN,toN;gpNum,fromN,toN;..."
// e.g. "1,1,15;2,16,20"
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

        // Build lookup: gpNum -> gpSource
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
            var fields = tok.split(",");
            if (fields.length < 3) continue;
            var gpNum  = parseInt(fields[0], 10);
            var fromN  = parseInt(fields[1], 10);
            var toN    = parseInt(fields[2], 10);
            if (isNaN(gpNum) || isNaN(fromN) || isNaN(toN)) continue;
            assignments.push({ gpNum: gpNum, fromN: fromN, toN: toN });
        }

        if (assignments.length === 0) {
            return "ERROR|||No valid assignments provided.";
        }

        // Build assignment map: nikaahSeqNum -> gpNum
        var nikaahToGp = {};
        var warnings = [];

        for (var asi = 0; asi < assignments.length; asi++) {
            var asgn = assignments[asi];
            var gp = gpByNum[asgn.gpNum];
            if (!gp) {
                warnings.push("⚠ GROUP_PHOTO_" + asgn.gpNum + " marker not found in sequence.");
                continue;
            }
            if (!gp.hasClip) {
                warnings.push("⚠ GROUP_PHOTO_" + asgn.gpNum + ": No video clip found at marker position.");
            }
            var lo = Math.min(asgn.fromN, asgn.toN);
            var hi = Math.max(asgn.fromN, asgn.toN);
            for (var ni = lo; ni <= hi; ni++) {
                if (nikaahToGp.hasOwnProperty(ni)) {
                    warnings.push("⚠ Nikaah " + ni + " is assigned to both GP" + nikaahToGp[ni] + " and GP" + asgn.gpNum + " — GP" + asgn.gpNum + " will be used.");
                }
                nikaahToGp[ni] = asgn.gpNum;
            }
        }

        // Generate preview lines
        var lines = [];
        var plannedCount = 0;
        var skippedCount = 0;

        for (var nki = 0; nki < nikaahMarkers.length; nki++) {
            var nk = nikaahMarkers[nki];
            var assignedGpNum = nikaahToGp[nk.seqNum];

            if (assignedGpNum === undefined || assignedGpNum === null) {
                lines.push("  — Nikaah " + nk.seqNum + "  [" + nk.name + "]  → (no assignment — skipped)");
                skippedCount++;
            } else {
                var srcGp = gpByNum[assignedGpNum];
                var gpLabel = srcGp ? srcGp.clipName : ("GROUP_PHOTO_" + assignedGpNum);
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

// ── Execute: ripple-insert with duplicate prevention ─────────────────────────
// assignmentsStr same format as preview
// Returns "SUCCESS|||inserted=N|skipped=N|failed=N|||reportLines"
$.runScript.groupPhotoInserterExecute = function(assignmentsStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERROR|||No active sequence found.";

        // Enable QE DOM if available
        try { if (typeof app.enableQE === "function") app.enableQE(); } catch(eQE) {}

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
            var fields = tok.split(",");
            if (fields.length < 3) continue;
            var gpNum = parseInt(fields[0], 10);
            var fromN = parseInt(fields[1], 10);
            var toN   = parseInt(fields[2], 10);
            if (isNaN(gpNum) || isNaN(fromN) || isNaN(toN)) continue;
            assignments.push({ gpNum: gpNum, fromN: fromN, toN: toN });
        }

        if (assignments.length === 0) {
            return "ERROR|||No valid assignments provided.";
        }

        // Build nikaahSeqNum -> gpNum map (last assignment wins for overlaps)
        var nikaahToGp = {};
        for (var asi = 0; asi < assignments.length; asi++) {
            var asgn = assignments[asi];
            var lo = Math.min(asgn.fromN, asgn.toN);
            var hi = Math.max(asgn.fromN, asgn.toN);
            for (var ni = lo; ni <= hi; ni++) {
                nikaahToGp[ni] = asgn.gpNum;
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

        // Filter to only assigned Nikaah, reverse-chronological for safe ripple
        var workList = [];
        for (var nki = nikaahMarkers.length - 1; nki >= 0; nki--) {
            var nk = nikaahMarkers[nki];
            var assignedGpNum = nikaahToGp[nk.seqNum];
            if (assignedGpNum === undefined || assignedGpNum === null) continue;
            workList.push({ nk: nk, gpNum: assignedGpNum });
        }

        for (var wi = 0; wi < workList.length; wi++) {
            var nk = workList[wi].nk;
            var gpNum = workList[wi].gpNum;
            var gp = gpByNum[gpNum];

            if (!gp) {
                reportLines.push("✗ Nikaah " + nk.seqNum + " — GROUP_PHOTO_" + gpNum + " marker not found. Skipped.");
                skippedCount++;
                continue;
            }
            if (!gp.hasClip || !gp.projectItem) {
                reportLines.push("✗ Nikaah " + nk.seqNum + " — GROUP_PHOTO_" + gpNum + " has no source clip. Skipped.");
                skippedCount++;
                continue;
            }

            var groupDuration = gp.duration;
            if (groupDuration <= 0) {
                reportLines.push("✗ Nikaah " + nk.seqNum + " — GP" + gpNum + " duration is 0. Skipped.");
                skippedCount++;
                continue;
            }

            // Duplicate prevention: scan target track for clip with OT_GP comment
            var dupKey = "OT_GP_INSERTED|GP:" + gpNum + "|NIKAAH:" + nk.seqNum;
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
                        if (mkCmt.indexOf(dupKey) !== -1 || mkNm === (nk.name + " - GP" + gpNum)) {
                            isDuplicate = true;
                            break;
                        }
                        chkMk = seq.markers.getNextMarker(chkMk);
                    }
                } catch(eMkDup) {}
            }

            if (isDuplicate) {
                reportLines.push("↷ Nikaah " + nk.seqNum + " — GP" + gpNum + " already inserted. Skipped (duplicate).");
                skippedCount++;
                continue;
            }

            var insertSec = nk.endSec;
            var gpProjectItem = gp.projectItem;
            var sourceIn = gp.inPoint;
            var sourceOut = gp.outPoint;

            // Determine target track (V1 = index 0)
            var targetTrackIndex = 0;
            var targetVideoTrack = seq.videoTracks[targetTrackIndex];

            // === RIPPLE: Shift all downstream video clips forward ===
            for (var vIdx = 0; vIdx < seq.videoTracks.numTracks; vIdx++) {
                var vTrk2 = seq.videoTracks[vIdx];
                if (!vTrk2 || !vTrk2.clips) continue;

                var clipsToShift = [];
                var spanningClips = [];

                for (var ci2 = vTrk2.clips.numItems - 1; ci2 >= 0; ci2--) {
                    var c2 = vTrk2.clips[ci2];
                    if (!c2) continue;
                    var cStart = (c2.start) ? c2.start.seconds : 0;
                    var cEnd   = (c2.end)   ? c2.end.seconds   : 0;
                    if (cStart >= (insertSec - 0.05)) {
                        clipsToShift.push(c2);
                    } else if (cStart < (insertSec - 0.05) && cEnd > (insertSec + 0.05)) {
                        spanningClips.push(c2);
                    }
                }

                for (var si = 0; si < clipsToShift.length; si++) {
                    shiftClipForward(clipsToShift[si], vTrk2, groupDuration);
                }
                for (var sp = 0; sp < spanningClips.length; sp++) {
                    var spClip = spanningClips[sp];
                    try {
                        var oStart = spClip.start.seconds;
                        var oEnd   = spClip.end.seconds;
                        var oIn    = (spClip.inPoint && !isNaN(spClip.inPoint.seconds)) ? spClip.inPoint.seconds : 0;
                        var pItm   = spClip.projectItem;
                        spClip.end = toTime(insertSec);
                        if (pItm) {
                            var sh2Start = insertSec + groupDuration;
                            var sh2In    = oIn + (insertSec - oStart);
                            var sh2Dur   = oEnd - insertSec;
                            vTrk2.overwriteClip(pItm, toTime(sh2Start));
                            for (var rci = vTrk2.clips.numItems - 1; rci >= 0; rci--) {
                                var rc = vTrk2.clips[rci];
                                if (rc && Math.abs(rc.start.seconds - sh2Start) < 0.25) {
                                    try { rc.inPoint = toTime(sh2In); rc.outPoint = toTime(sh2In + sh2Dur); } catch(e) {}
                                    break;
                                }
                            }
                        }
                    } catch(eSpan) {}
                }
            }

            // === RIPPLE: Shift all downstream audio clips forward ===
            for (var aIdx2 = 0; aIdx2 < seq.audioTracks.numTracks; aIdx2++) {
                var aTrk2 = seq.audioTracks[aIdx2];
                if (!aTrk2 || !aTrk2.clips) continue;

                var aToShift = [];
                var aSpanning = [];

                for (var aci = aTrk2.clips.numItems - 1; aci >= 0; aci--) {
                    var ac = aTrk2.clips[aci];
                    if (!ac) continue;
                    var acStart = (ac.start) ? ac.start.seconds : 0;
                    var acEnd   = (ac.end)   ? ac.end.seconds   : 0;
                    if (acStart >= (insertSec - 0.05)) {
                        aToShift.push(ac);
                    } else if (acStart < (insertSec - 0.05) && acEnd > (insertSec + 0.05)) {
                        aSpanning.push(ac);
                    }
                }

                for (var asi2 = 0; asi2 < aToShift.length; asi2++) {
                    shiftClipForward(aToShift[asi2], aTrk2, groupDuration);
                }
                for (var asp = 0; asp < aSpanning.length; asp++) {
                    var aspClip = aSpanning[asp];
                    try {
                        var aoStart = aspClip.start.seconds;
                        var aoEnd   = aspClip.end.seconds;
                        var aoIn    = (aspClip.inPoint && !isNaN(aspClip.inPoint.seconds)) ? aspClip.inPoint.seconds : 0;
                        var apItm   = aspClip.projectItem;
                        aspClip.end = toTime(insertSec);
                        if (apItm) {
                            var ash2Start = insertSec + groupDuration;
                            var ash2In    = aoIn + (insertSec - aoStart);
                            var ash2Dur   = aoEnd - insertSec;
                            aTrk2.overwriteClip(apItm, toTime(ash2Start));
                            for (var arci = aTrk2.clips.numItems - 1; arci >= 0; arci--) {
                                var arc = aTrk2.clips[arci];
                                if (arc && Math.abs(arc.start.seconds - ash2Start) < 0.25) {
                                    try { arc.inPoint = toTime(ash2In); arc.outPoint = toTime(ash2In + ash2Dur); } catch(e) {}
                                    break;
                                }
                            }
                        }
                    } catch(eASpan) {}
                }
            }

            // === INSERT: Place GP clip at cleared window ===
            var insertOk = false;
            try {
                // Set In/Out on projectItem if supported so overwriteClip only takes groupDuration
                try {
                    if (typeof gpProjectItem.setInPoint === "function") {
                        gpProjectItem.setInPoint(toTime(sourceIn));
                    }
                    if (typeof gpProjectItem.setOutPoint === "function") {
                        gpProjectItem.setOutPoint(toTime(sourceIn + groupDuration));
                    }
                } catch(eSetIO) {}

                targetVideoTrack.overwriteClip(gpProjectItem, toTime(insertSec));

                // Locate the placed clip and enforce exact inPoint, outPoint, end and stamp duplicate-prevention comment
                for (var pci = targetVideoTrack.clips.numItems - 1; pci >= 0; pci--) {
                    var placedClip = targetVideoTrack.clips[pci];
                    if (placedClip && Math.abs(placedClip.start.seconds - insertSec) < 0.35) {
                        try {
                            placedClip.inPoint  = toTime(sourceIn);
                            placedClip.outPoint = toTime(sourceIn + groupDuration);
                        } catch(eIO) {}
                        try { placedClip.end = toTime(insertSec + groupDuration); } catch(eEnd) {}
                        try { placedClip.comment = dupKey; } catch(eCmt) {}
                        insertOk = true;
                        break;
                    }
                }

                // Place audio on Audio Track 1 if sequence has audio tracks
                if (seq.audioTracks && seq.audioTracks.numTracks > 0) {
                    try {
                        seq.audioTracks[0].overwriteClip(gpProjectItem, toTime(insertSec));
                        for (var apci2 = seq.audioTracks[0].clips.numItems - 1; apci2 >= 0; apci2--) {
                            var aPlaced = seq.audioTracks[0].clips[apci2];
                            if (aPlaced && Math.abs(aPlaced.start.seconds - insertSec) < 0.35) {
                                try {
                                    aPlaced.inPoint  = toTime(sourceIn);
                                    aPlaced.outPoint = toTime(sourceIn + groupDuration);
                                } catch(eAIO) {}
                                try { aPlaced.end = toTime(insertSec + groupDuration); } catch(eAEnd) {}
                                try { aPlaced.comment = dupKey; } catch(eACmt) {}
                                break;
                            }
                        }
                    } catch(eAudPlc) {}
                }

                if (!insertOk) insertOk = true; // clip placed even if comment stamp failed
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

                // Create a marker for the inserted GP
                var newMk = seq.markers.createMarker(insertSec);
                if (newMk) {
                    newMk.name = nk.name + " - GP" + gpNum;
                    newMk.comments = dupKey;
                    try { newMk.end = toTime(insertSec + groupDuration); } catch(e) {}
                    try { newMk.setColorByIndex(4, 0); } catch(e) {} // Yellow = N color
                }
            } catch(eMkAll) {}

            insertedCount++;
            reportLines.unshift("✓ Nikaah " + nk.seqNum + " [" + nk.name + "] → GP" + gpNum + " (" + gp.clipName + ") @ " + formatSec(insertSec) + " (+" + groupDuration + "s)");
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
    }
};
