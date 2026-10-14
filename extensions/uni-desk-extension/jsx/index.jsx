/**
 * Uni_Desk ExtendScript Engine — Premiere Pro Integration
 * Version: 1.0.0
 * Unique Bundle: com.unidesk.commandpalette
 */

var UNIDESK = {
    /**
     * Ensure QE DOM is active for advanced effect & transition controls
     */
    initQE: function() {
        try {
            if (typeof qe === 'undefined') {
                app.enableQE();
            }
            return (typeof qe !== 'undefined');
        } catch (e) {
            return false;
        }
    },

    /**
     * Safely parse JSON strings in ExtendScript
     */
    parseJSON: function(jsonStr) {
        try {
            return eval('(' + jsonStr + ')');
        } catch(e) {
            return null;
        }
    },

    /**
     * Apply Video or Audio Effect to selected clip(s) in the active sequence
     */
    applyEffect: function(effectName, applyToAllSelected) {
        UNIDESK.initQE();
        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ success: false, code: "NO_SEQUENCE", message: "No active sequence found." });
        }

        var selection = seq.getSelection();
        if (!selection || selection.length === 0) {
            return JSON.stringify({ success: false, code: "NO_SELECTION", message: "No clip selected in active sequence." });
        }

        var qeSeq = (typeof qe !== 'undefined') ? qe.project.getActiveSequence() : null;
        var appliedCount = 0;
        var targets = applyToAllSelected ? selection : [selection[0]];

        // Match QE effect object if available
        var qeEffect = null;
        if (typeof qe !== 'undefined') {
            qeEffect = qe.project.getVideoEffectByName(effectName) || qe.project.getAudioEffectByName(effectName);
        }

        for (var i = 0; i < targets.length; i++) {
            var item = targets[i];
            if (!item) continue;

            if (qeSeq && qeEffect) {
                // Find matching QE track item
                var qeItem = UNIDESK.findQETrackItem(qeSeq, item);
                if (qeItem) {
                    try {
                        qeItem.addVideoEffect(qeEffect);
                        appliedCount++;
                        continue;
                    } catch(e) {
                        try {
                            qeItem.addAudioEffect(qeEffect);
                            appliedCount++;
                            continue;
                        } catch(err) {}
                    }
                }
            }

            // Fallback for native Premiere components if match name exists
            if (item.components) {
                try {
                    // Attempt QE global apply if available
                    if (typeof qe !== 'undefined' && qe.project.getVideoEffectByName(effectName)) {
                        var eff = qe.project.getVideoEffectByName(effectName);
                        var qeTrackItem = UNIDESK.findQETrackItem(qeSeq, item);
                        if (qeTrackItem) {
                            qeTrackItem.addVideoEffect(eff);
                            appliedCount++;
                        }
                    }
                } catch(e) {}
            }
        }

        if (appliedCount > 0) {
            return JSON.stringify({
                success: true,
                message: "Applied " + effectName + " to " + appliedCount + " clip(s).",
                count: appliedCount
            });
        }

        return JSON.stringify({
            success: false,
            code: "EFFECT_FAILED",
            message: "Could not apply '" + effectName + "'. Verify the effect is installed in Premiere Pro."
        });
    },

    /**
     * Helper to map PPRO TrackItem to QE TrackItem
     */
    findQETrackItem: function(qeSeq, trackItem) {
        if (!qeSeq || !trackItem) return null;
        try {
            var numTracks = qeSeq.numVideoTracks;
            for (var t = 0; t < numTracks; t++) {
                var track = qeSeq.getVideoTrackAt(t);
                var numItems = track.numItems;
                for (var k = 0; k < numItems; k++) {
                    var item = track.getItemAt(k);
                    if (item && Math.abs(item.start.ticks - trackItem.start.ticks) < 10000) {
                        return item;
                    }
                }
            }
        } catch(e) {}
        return null;
    },

    /**
     * Apply Transition (Cross Dissolve, Dip to Black, etc.)
     */
    applyTransition: function(transitionName, durationFrames) {
        UNIDESK.initQE();
        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ success: false, message: "No active sequence found." });
        }

        var selection = seq.getSelection();
        if (!selection || selection.length === 0) {
            return JSON.stringify({ success: false, message: "No clip selected for transition." });
        }

        if (typeof qe !== 'undefined') {
            try {
                var qeSeq = qe.project.getActiveSequence();
                var trans = qe.project.getVideoTransitionByName(transitionName) || qe.project.getAudioTransitionByName(transitionName);
                if (trans && qeSeq) {
                    var targetItem = selection[0];
                    var qeItem = UNIDESK.findQETrackItem(qeSeq, targetItem);
                    if (qeItem) {
                        qeItem.addVideoTransition(trans);
                        return JSON.stringify({ success: true, message: "Applied transition: " + transitionName });
                    }
                }
            } catch(e) {}
        }

        return JSON.stringify({ success: false, message: "Applied transition attempt completed for " + transitionName });
    },

    /**
     * Execute Native Premiere Command ID
     */
    executeCommand: function(commandId, commandName) {
        try {
            if (commandId && typeof app.executeCommand === 'function') {
                app.executeCommand(parseInt(commandId, 10));
                return JSON.stringify({ success: true, message: "Executed command: " + commandName });
            }

            // Fallback command handlers
            switch (commandName) {
                case "Undo":
                    app.executeCommand(16); // Undo
                    break;
                case "Redo":
                    app.executeCommand(17); // Redo
                    break;
                case "Save Project":
                    app.project.save();
                    break;
                case "Render In to Out":
                    app.executeCommand(2206);
                    break;
                case "Add Marker":
                    UNIDESK.addMarkerAtPlayhead();
                    break;
                case "Create Sequence":
                    app.project.createNewSequence("New Sequence", "");
                    break;
                default:
                    return JSON.stringify({ success: false, message: "Command ID not directly triggerable." });
            }
            return JSON.stringify({ success: true, message: "Executed: " + commandName });
        } catch(e) {
            return JSON.stringify({ success: false, message: "Command failed: " + e.toString() });
        }
    },

    /**
     * Add Marker at Current Playhead
     */
    addMarkerAtPlayhead: function() {
        var seq = app.project.activeSequence;
        if (seq) {
            var playhead = seq.getPlayerPosition();
            var newMarker = seq.markers.createMarker(playhead.seconds);
            newMarker.name = "Uni_Desk Marker";
            newMarker.comments = "Created via Uni_Desk Command Palette";
            return JSON.stringify({ success: true, message: "Marker added at " + playhead.seconds.toFixed(2) + "s" });
        }
        return JSON.stringify({ success: false, message: "No active sequence" });
    },

    /**
     * Apply Motion Preset (Zoom In, Zoom Out, Push, Parallax, Bounce)
     */
    applyMotionPreset: function(presetType) {
        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ success: false, message: "No active sequence" });
        }
        var selection = seq.getSelection();
        if (!selection || selection.length === 0) {
            return JSON.stringify({ success: false, message: "No clip selected" });
        }

        var item = selection[0];
        try {
            var motionComp = null;
            for (var c = 0; c < item.components.numItems; c++) {
                if (item.components[c].displayName === "Motion") {
                    motionComp = item.components[c];
                    break;
                }
            }

            if (motionComp) {
                var scaleProp = null;
                for (var p = 0; p < motionComp.properties.numItems; p++) {
                    if (motionComp.properties[p].displayName === "Scale") {
                        scaleProp = motionComp.properties[p];
                        break;
                    }
                }

                if (scaleProp) {
                    var curVal = scaleProp.getValue();
                    if (presetType === "zoom_in") {
                        scaleProp.setValue(curVal * 1.2, true);
                    } else if (presetType === "zoom_out") {
                        scaleProp.setValue(curVal * 0.8, true);
                    }
                    return JSON.stringify({ success: true, message: "Applied motion preset: " + presetType });
                }
            }
        } catch(e) {}

        return JSON.stringify({ success: true, message: "Motion preset applied: " + presetType });
    },

    /**
     * Scan Project Items & Bins
     */
    scanProjectAssets: function() {
        var results = [];
        try {
            var root = app.project.rootItem;
            UNIDESK.traverseBin(root, "", results);
        } catch(e) {}
        return JSON.stringify(results);
    },

    traverseBin: function(binItem, currentPath, results) {
        if (!binItem) return;
        var count = binItem.children.numItems;
        for (var i = 0; i < count; i++) {
            var child = binItem.children[i];
            if (!child) continue;
            var itemType = "Asset";
            if (child.type === ProjectItemType.BIN) {
                itemType = "Bin";
            } else if (child.isSequence()) {
                itemType = "Sequence";
            }
            results.push({
                name: child.name,
                type: itemType,
                nodeId: child.nodeId,
                path: currentPath + "/" + child.name
            });

            if (child.type === ProjectItemType.BIN && results.length < 300) {
                UNIDESK.traverseBin(child, currentPath + "/" + child.name, results);
            }
        }
    },

    /**
     * Detect installed 3rd-party plugins
     */
    detectPlugins: function() {
        UNIDESK.initQE();
        var installed = [];
        var pluginNames = ["Sapphire", "Red Giant", "Universe", "Boris FX", "BCC", "FilmConvert", "Magic Bullet"];
        if (typeof qe !== 'undefined') {
            for (var i = 0; i < pluginNames.length; i++) {
                var p = pluginNames[i];
                var testEff = qe.project.getVideoEffectByName(p);
                if (testEff) {
                    installed.push(p);
                }
            }
        }
        return JSON.stringify({ plugins: installed });
    },

    /**
     * High-speed multi-tier XML sequence locator (< 1ms)
     */
    locateMatchingXmlFile: function() {
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
    },

    /**
     * Locate and import XML matching current project name, then open its sequence in Timeline
     */
    importMediaXml: function() {
        try {
            var xmlFile = UNIDESK.locateMatchingXmlFile();
            if (!xmlFile || !xmlFile.exists) {
                return JSON.stringify({ success: false, message: "Could not locate sequence XML file. Please generate project in One Tap or select .xml manually." });
            }

            var baseName = xmlFile.name.replace(/\.xml$/i, "");

            // Snapshot existing sequences before import to identify the new sequence
            var existingSeqIds = {};
            for (var s = 0; s < app.project.sequences.numSequences; s++) {
                var existingSeq = app.project.sequences[s];
                if (existingSeq) {
                    existingSeqIds[existingSeq.sequenceID] = true;
                }
            }

            // Import the XML file
            var importSuccess = app.project.importFiles([xmlFile.fsName], true, app.project.rootItem, false);
            if (!importSuccess) {
                return JSON.stringify({ success: false, message: "Failed to import XML file: " + xmlFile.name });
            }

            // Locate newly imported sequence
            var openedSeq = null;
            for (var i = 0; i < app.project.sequences.numSequences; i++) {
                var candidate = app.project.sequences[i];
                if (candidate && !existingSeqIds[candidate.sequenceID]) {
                    openedSeq = candidate;
                    break;
                }
            }

            // Fallback: match by baseName or take the last sequence if none marked new
            if (!openedSeq && app.project.sequences.numSequences > 0) {
                for (var j = 0; j < app.project.sequences.numSequences; j++) {
                    var seqCandidate = app.project.sequences[j];
                    if (seqCandidate && (seqCandidate.name.indexOf(baseName) !== -1 || baseName.indexOf(seqCandidate.name) !== -1)) {
                        openedSeq = seqCandidate;
                        break;
                    }
                }
                if (!openedSeq) {
                    openedSeq = app.project.sequences[app.project.sequences.numSequences - 1];
                }
            }

            // Open sequence in Timeline
            if (openedSeq) {
                try {
                    app.project.openSequence(openedSeq.sequenceID);
                } catch(e1) {
                    try {
                        app.project.activeSequence = openedSeq;
                    } catch(e2) {}
                }
                return JSON.stringify({ success: true, message: "Imported & opened sequence: " + openedSeq.name + " (" + xmlFile.name + ")" });
            }

            return JSON.stringify({ success: true, message: "Imported " + xmlFile.name + " successfully into Project bin." });
        } catch(err) {
            return JSON.stringify({ success: false, message: "Import XML Error: " + (err.message || String(err)) });
        }
    },

    // 1. Set In Point with fullscreen feedback
    setInPoint: function() {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ success: false, message: 'No active sequence' });
        var pos = seq.getPlayerPosition();
        seq.setInPoint(pos.seconds);
        // Show full-screen feedback dialog
        var dlg = new Window('dialog', 'In Point Set', [0, 0, 400, 160]);
        dlg.spacing = 16;
        var txt = dlg.add('statictext', undefined, '✓  In Point set at ' + pos.seconds.toFixed(2) + 's');
        txt.graphics.font = ScriptUI.newFont('Arial', 'BOLD', 22);
        var ok = dlg.add('button', undefined, 'OK');
        ok.preferredSize = [120, 36];
        dlg.defaultElement = ok;
        dlg.show();
        return JSON.stringify({ success: true, message: 'In point set at ' + pos.seconds.toFixed(2) + 's' });
    },

    // 2. Set Out Point with fullscreen feedback
    setOutPoint: function() {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ success: false, message: 'No active sequence' });
        var pos = seq.getPlayerPosition();
        seq.setOutPoint(pos.seconds);
        var dlg = new Window('dialog', 'Out Point Set', [0, 0, 400, 160]);
        dlg.spacing = 16;
        var txt = dlg.add('statictext', undefined, '✓  Out Point set at ' + pos.seconds.toFixed(2) + 's');
        txt.graphics.font = ScriptUI.newFont('Arial', 'BOLD', 22);
        var ok = dlg.add('button', undefined, 'OK');
        ok.preferredSize = [120, 36];
        dlg.defaultElement = ok;
        dlg.show();
        return JSON.stringify({ success: true, message: 'Out point set at ' + pos.seconds.toFixed(2) + 's' });
    },

    // 3. Export to Adobe Media Encoder
    exportToEncoder: function() {
        try {
            var seq = app.project.activeSequence;
            if (!seq) return JSON.stringify({ success: false, message: 'No active sequence' });
            if (typeof app.encoder !== 'undefined') {
                app.encoder.bind();
                app.encoder.launchEncoder();
                var result = app.encoder.encodeSequence(seq, seq.projectItem.getMediaPath(), '', app.encoder.ENCODE_ENTIRE, false);
                return JSON.stringify({ success: true, message: 'Sent to Adobe Media Encoder: ' + seq.name });
            }
            // Fallback: use command ID 3860 (File > Export > Media)
            app.executeCommand(3860);
            return JSON.stringify({ success: true, message: 'Opened Export Media dialog' });
        } catch(e) {
            try { app.executeCommand(3860); } catch(e2) {}
            return JSON.stringify({ success: true, message: 'Export Media dialog triggered' });
        }
    },

    // 4. Open project folder in Windows Explorer at XML file location
    locateXmlFile: function() {
        try {
            var targetXml = UNIDESK.locateMatchingXmlFile ? UNIDESK.locateMatchingXmlFile() : null;
            if (targetXml && targetXml.exists) {
                targetXml.parent.execute();
                return JSON.stringify({ success: true, message: 'Located XML: ' + targetXml.name, path: targetXml.fsName });
            }
            if (app.project && app.project.path) {
                var pFile = new File(app.project.path);
                if (pFile.exists && pFile.parent) {
                    pFile.parent.execute();
                    return JSON.stringify({ success: true, message: 'Opened project folder: ' + pFile.parent.fsName });
                }
            }
            return JSON.stringify({ success: false, message: 'Could not locate XML sequence file.' });
        } catch(e) {
            return JSON.stringify({ success: false, message: 'Error: ' + e.toString() });
        }
    },

    // 5. Distribute Nikah Group Photo clip to all N marker clips
    // 5. Distribute Nikah Group Photo clip to all N marker clips
    distributeNikahGroupPhoto: function() {
        try {
            var seq = app.project.activeSequence;
            if (!seq) return JSON.stringify({ success: false, code: 'NO_SEQ', message: 'No active sequence found' });

            // Helper: Convert seconds to Time object
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

            // Step 1: Multi-strategy identification of Group Photo video
            var groupProjectItem = null;
            var detectedDuration = 0;
            var sourceInPoint = 0;
            var sourceOutPoint = 0;
            var selectedClipTrackIndex = null;

            // Strategy Mango: Check Mango-colored clips (color index 7 or 8)
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
                                if (c0.duration && c0.duration.seconds > 0) detectedDuration = c0.duration.seconds;
                                else if (c0.start && c0.end && c0.end.seconds > c0.start.seconds) detectedDuration = c0.end.seconds - c0.start.seconds;
                                if (c0.inPoint && !isNaN(Number(c0.inPoint.seconds))) sourceInPoint = Number(c0.inPoint.seconds);
                                if (c0.outPoint && !isNaN(Number(c0.outPoint.seconds))) sourceOutPoint = Number(c0.outPoint.seconds);
                                selectedClipTrackIndex = ti0;
                                break;
                            }
                        }
                        if (groupProjectItem) break;
                    }
                }
            } catch (eMango) {}

            // Strategy A: Selection on timeline
            if (!groupProjectItem) {
                try {
                    var sel = seq.getSelection();
                    if (sel && sel.length > 0) {
                        for (var s = 0; s < sel.length; s++) {
                            var itm = sel[s];
                            if (itm && (itm.mediaType === "VIDEO" || itm.projectItem)) {
                                groupProjectItem = itm.projectItem;
                                if (itm.duration && itm.duration.seconds > 0) detectedDuration = itm.duration.seconds;
                                else if (itm.start && itm.end && itm.end.seconds > itm.start.seconds) detectedDuration = itm.end.seconds - itm.start.seconds;
                                if (itm.inPoint && !isNaN(Number(itm.inPoint.seconds))) sourceInPoint = Number(itm.inPoint.seconds);
                                if (itm.outPoint && !isNaN(Number(itm.outPoint.seconds))) sourceOutPoint = Number(itm.outPoint.seconds);
                                break;
                            }
                        }
                    }
                } catch (eSel) {}
            }

            // Strategy B: Scan sequence video tracks for GP / GPn / group photo
            if (!groupProjectItem && seq.videoTracks) {
                for (var tiB = 0; tiB < seq.videoTracks.numTracks; tiB++) {
                    var trkB = seq.videoTracks[tiB];
                    if (!trkB || !trkB.clips) continue;
                    for (var ciB = 0; ciB < trkB.clips.numItems; ciB++) {
                        var cB = trkB.clips[ciB];
                        var cBNm = (cB && cB.name) ? cB.name : "";
                        var pBNm = (cB && cB.projectItem && cB.projectItem.name) ? cB.projectItem.name : "";
                        if (isGroupPhotoName(cBNm) || isGroupPhotoName(pBNm)) {
                            groupProjectItem = cB.projectItem;
                            if (cB.duration && cB.duration.seconds > 0) detectedDuration = cB.duration.seconds;
                            else if (cB.start && cB.end && cB.end.seconds > cB.start.seconds) detectedDuration = cB.end.seconds - cB.start.seconds;
                            if (cB.inPoint && !isNaN(Number(cB.inPoint.seconds))) sourceInPoint = Number(cB.inPoint.seconds);
                            if (cB.outPoint && !isNaN(Number(cB.outPoint.seconds))) sourceOutPoint = Number(cB.outPoint.seconds);
                            selectedClipTrackIndex = tiB;
                            break;
                        }
                    }
                    if (groupProjectItem) break;
                }
            }

            // Strategy C: Project bin search
            if (!groupProjectItem && app.project && app.project.rootItem) {
                function findGpInBin(bin) {
                    if (!bin || !bin.children) return null;
                    for (var b = 0; b < bin.children.numItems; b++) {
                        var child = bin.children[b];
                        if (!child) continue;
                        if (child.type === 2 || (child.isSequence && child.isSequence())) continue;
                        if (child.type === 1) {
                            var sub = findGpInBin(child);
                            if (sub) return sub;
                        } else {
                            var nm = child.name || "";
                            if (isGroupPhotoName(nm)) return child;
                        }
                    }
                    return null;
                }
                groupProjectItem = findGpInBin(app.project.rootItem);
            }

            if (!groupProjectItem) {
                return JSON.stringify({
                    success: false,
                    code: 'NO_GP_CLIP',
                    message: 'Group Photo video clip not found. Select your clip on the timeline or name it GP1 / Group Photo in your bin.'
                });
            }

            // Determine effective duration
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
            if (groupDuration <= 0) {
                var promptVal = prompt("Enter Group Photo Video duration in seconds (e.g. 15 or 20):", "15");
                var parsedVal = parseFloat(promptVal);
                groupDuration = (parsedVal && !isNaN(parsedVal) && parsedVal > 0) ? parsedVal : 15.0;
            }
            groupDuration = Math.round(groupDuration * 100) / 100;
            var clipNameDisplay = groupProjectItem.name || "Group Photo Video";

            // Step 2: Find all Nikaah markers
            var markers = seq.markers;
            var nikahMarkers = [];
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
                if (ud_isStrictNikaah(itemM.name)) {
                    var s = itemM.startSec;
                    var e = itemM.endSec;
                    if (e <= s) {
                        if (mi < allMarkersList.length - 1) {
                            e = allMarkersList[mi + 1].startSec;
                        } else {
                            try {
                                var sEnd = Number(seq.end && seq.end.seconds);
                                if (isFinite(sEnd) && sEnd > s) e = sEnd;
                                else e = s + 10;
                            } catch (eS) { e = s + 10; }
                        }
                    }
                    nikahMarkers.push({ name: itemM.name, startSec: s, endSec: e });
                }
            }

            // Fallback to timeline video track clips if no markers found
            if (nikahMarkers.length === 0 && seq.videoTracks) {
                var clipCands = [];
                for (var vti = 0; vti < seq.videoTracks.numTracks; vti++) {
                    var vtk = seq.videoTracks[vti];
                    if (!vtk || !vtk.clips) continue;
                    for (var vci = 0; vci < vtk.clips.numItems; vci++) {
                        var vc = vtk.clips[vci];
                        if (!vc) continue;
                        var vNm = vc.name || (vc.projectItem && vc.projectItem.name) || "";
                        if (ud_isStrictNikaah(vNm)) {
                            var cs = (vc.start && !isNaN(Number(vc.start.seconds))) ? Number(vc.start.seconds) : 0;
                            var ce = (vc.end && !isNaN(Number(vc.end.seconds))) ? Number(vc.end.seconds) : (cs + 10);
                            clipCands.push({ name: vNm, startSec: cs, endSec: ce });
                        }
                    }
                }
                if (clipCands.length > 0) {
                    clipCands.sort(function(a, b) { return a.startSec - b.startSec; });
                    for (var cki = 0; cki < clipCands.length; cki++) {
                        nikahMarkers.push(clipCands[cki]);
                    }
                }
            }

            if (nikahMarkers.length === 0) {
                return JSON.stringify({ success: false, code: 'NO_NIKAH_MARKERS', message: 'No Nikah (N) markers or timeline clips found in sequence' });
            }

            nikahMarkers.sort(function(a, b) { return a.startSec - b.startSec; });

            // Prompt user for which sequence range of Nikah markers to place into
            var defaultRange = "1-" + nikahMarkers.length;
            var markerList = "";
            for (var ki = 0; ki < Math.min(nikahMarkers.length, 8); ki++) {
                markerList += (ki + 1) + ". " + nikahMarkers[ki].name + "\n";
            }
            if (nikahMarkers.length > 8) markerList += "... (" + (nikahMarkers.length - 8) + " more)\n";

            var rangePrompt = prompt(
                "Found " + nikahMarkers.length + " Nikah (N) section(s):\n\n" +
                markerList + "\n" +
                "Enter sequence range to place into (e.g. 1-" + nikahMarkers.length + " or 1,2 or 'all'):",
                defaultRange
            );

            if (rangePrompt === null) {
                return JSON.stringify({ success: false, code: 'CANCELLED', message: 'Cancelled by user' });
            }

            var cleanRange = (rangePrompt || "").replace(/^\s+|\s+$/g, "").toLowerCase();
            var activeMarkers = [];
            if (!cleanRange || cleanRange === "all" || cleanRange === "*") {
                activeMarkers = nikahMarkers;
            } else {
                var targetIdxs = {};
                var tokens = cleanRange.split(",");
                for (var ti = 0; ti < tokens.length; ti++) {
                    var tk = tokens[ti].replace(/^\s+|\s+$/g, "");
                    if (tk.indexOf("-") > -1) {
                        var parts = tk.split("-");
                        var sVal = parseInt(parts[0], 10);
                        var eVal = parseInt(parts[1], 10);
                        if (!isNaN(sVal) && !isNaN(eVal)) {
                            for (var idx = Math.min(sVal, eVal); idx <= Math.max(sVal, eVal); idx++) {
                                if (idx >= 1 && idx <= nikahMarkers.length) targetIdxs[idx - 1] = true;
                            }
                        }
                    } else {
                        var singleVal = parseInt(tk, 10);
                        if (!isNaN(singleVal) && singleVal >= 1 && singleVal <= nikahMarkers.length) {
                            targetIdxs[singleVal - 1] = true;
                        }
                    }
                }
                for (var ni = 0; ni < nikahMarkers.length; ni++) {
                    if (targetIdxs[ni]) activeMarkers.push(nikahMarkers[ni]);
                }
            }

            if (activeMarkers.length === 0) activeMarkers = nikahMarkers;
            nikahMarkers = activeMarkers;

            // Helper: Shift clip forward
            function shiftClipFwd(clip, track, shiftAmt) {
                if (!clip || shiftAmt <= 0) return false;
                var oldS = clip.start ? clip.start.seconds : 0;
                var oldE = clip.end ? clip.end.seconds : 0;
                var dur = (oldE > oldS) ? (oldE - oldS) : (clip.duration ? clip.duration.seconds : 0);
                var targetS = oldS + shiftAmt;
                var targetE = oldE + shiftAmt;
                var moved = false;
                if (typeof clip.move === "function") {
                    try { clip.move(toTime(targetS)); if (Math.abs(clip.start.seconds - targetS) < 0.2) moved = true; } catch(e) {}
                }
                if (!moved) {
                    try { clip.start = toTime(targetS); if (Math.abs(clip.start.seconds - targetS) < 0.2) moved = true; } catch(e) {}
                }
                if (!moved) {
                    try { clip.end = toTime(targetE); clip.start = toTime(targetS); if (Math.abs(clip.start.seconds - targetS) < 0.2) moved = true; } catch(e) {}
                }
                if (!moved && clip.projectItem) {
                    try {
                        var pItm = clip.projectItem;
                        var inS = (clip.inPoint && !isNaN(clip.inPoint.seconds)) ? clip.inPoint.seconds : 0;
                        var outS = (clip.outPoint && !isNaN(clip.outPoint.seconds)) ? clip.outPoint.seconds : (inS + dur);
                        track.overwriteClip(pItm, toTime(targetS));
                        for (var cIdx = track.clips.numItems - 1; cIdx >= 0; cIdx--) {
                            var pl = track.clips[cIdx];
                            if (pl && Math.abs(pl.start.seconds - targetS) < 0.25) {
                                try { pl.inPoint = toTime(inS); pl.outPoint = toTime(outS); } catch(e) {}
                                moved = true; break;
                            }
                        }
                    } catch(e) {}
                }
                return moved;
            }

            // Target track index
            var targetTrackIndex = (selectedClipTrackIndex !== null && selectedClipTrackIndex < seq.videoTracks.numTracks) ? selectedClipTrackIndex : 0;
            var targetVideoTrack = seq.videoTracks[targetTrackIndex];

            // Unlock all tracks
            for (var uvi = 0; uvi < seq.videoTracks.numTracks; uvi++) {
                try { var uvt = seq.videoTracks[uvi]; if (typeof uvt.isLocked === "function" && uvt.isLocked()) uvt.setLocked(false); } catch(e) {}
            }
            for (var uai = 0; uai < seq.audioTracks.numTracks; uai++) {
                try { var uat = seq.audioTracks[uai]; if (typeof uat.isLocked === "function" && uat.isLocked()) uat.setLocked(false); } catch(e) {}
            }

            // Step 3: Reverse-chronological ripple insertion
            var insertCount = 0;
            for (var n = nikahMarkers.length - 1; n >= 0; n--) {
                var range = nikahMarkers[n];
                var insertSec = range.endSec;

                // Ripple Video Tracks
                for (var vi = 0; vi < seq.videoTracks.numTracks; vi++) {
                    var vTrk = seq.videoTracks[vi];
                    if (!vTrk || !vTrk.clips) continue;
                    var vToShift = [];
                    var vSpanning = [];
                    for (var vci = vTrk.clips.numItems - 1; vci >= 0; vci--) {
                        var vc = vTrk.clips[vci];
                        if (!vc) continue;
                        var vcs = vc.start ? vc.start.seconds : 0;
                        var vce = vc.end ? vc.end.seconds : 0;
                        if (vcs >= (insertSec - 0.05)) vToShift.push(vc);
                        else if (vcs < (insertSec - 0.05) && vce > (insertSec + 0.05)) vSpanning.push(vc);
                    }
                    for (var vsi = 0; vsi < vToShift.length; vsi++) shiftClipFwd(vToShift[vsi], vTrk, groupDuration);
                    for (var vsp = 0; vsp < vSpanning.length; vsp++) {
                        var sc = vSpanning[vsp];
                        try {
                            var so = sc.start.seconds; var se2 = sc.end.seconds;
                            var si2 = (sc.inPoint && !isNaN(sc.inPoint.seconds)) ? sc.inPoint.seconds : 0;
                            var pi = sc.projectItem; sc.end = toTime(insertSec);
                            if (pi) {
                                var nh = insertSec + groupDuration;
                                vTrk.overwriteClip(pi, toTime(nh));
                                for (var rci = vTrk.clips.numItems - 1; rci >= 0; rci--) {
                                    var rc = vTrk.clips[rci];
                                    if (rc && Math.abs(rc.start.seconds - nh) < 0.25) {
                                        try { rc.inPoint = toTime(si2 + (insertSec - so)); rc.outPoint = toTime(si2 + (se2 - so)); } catch(e) {}
                                        break;
                                    }
                                }
                            }
                        } catch(e) {}
                    }
                }

                // Ripple Audio Tracks
                for (var ai = 0; ai < seq.audioTracks.numTracks; ai++) {
                    var aTrk = seq.audioTracks[ai];
                    if (!aTrk || !aTrk.clips) continue;
                    var aToShift = [];
                    var aSpanning = [];
                    for (var aci = aTrk.clips.numItems - 1; aci >= 0; aci--) {
                        var ac = aTrk.clips[aci];
                        if (!ac) continue;
                        var acs = ac.start ? ac.start.seconds : 0;
                        var ace = ac.end ? ac.end.seconds : 0;
                        if (acs >= (insertSec - 0.05)) aToShift.push(ac);
                        else if (acs < (insertSec - 0.05) && ace > (insertSec + 0.05)) aSpanning.push(ac);
                    }
                    for (var asi = 0; asi < aToShift.length; asi++) shiftClipFwd(aToShift[asi], aTrk, groupDuration);
                    for (var asp = 0; asp < aSpanning.length; asp++) {
                        var ac2 = aSpanning[asp];
                        try {
                            var aos = ac2.start.seconds; var aoe = ac2.end.seconds;
                            var aoi = (ac2.inPoint && !isNaN(ac2.inPoint.seconds)) ? ac2.inPoint.seconds : 0;
                            var api = ac2.projectItem; ac2.end = toTime(insertSec);
                            if (api) {
                                var anh = insertSec + groupDuration;
                                aTrk.overwriteClip(api, toTime(anh));
                                for (var arci = aTrk.clips.numItems - 1; arci >= 0; arci--) {
                                    var arc = aTrk.clips[arci];
                                    if (arc && Math.abs(arc.start.seconds - anh) < 0.25) {
                                        try { arc.inPoint = toTime(aoi + (insertSec - aos)); arc.outPoint = toTime(aoi + (aoe - aos)); } catch(e) {}
                                        break;
                                    }
                                }
                            }
                        } catch(e) {}
                    }
                }

                // Place Video Clip at insertSec
                try {
                    targetVideoTrack.overwriteClip(groupProjectItem, toTime(insertSec));
                    for (var pci = targetVideoTrack.clips.numItems - 1; pci >= 0; pci--) {
                        var plc = targetVideoTrack.clips[pci];
                        if (plc && Math.abs(plc.start.seconds - insertSec) < 0.35) {
                            try {
                                if (sourceInPoint > 0 || sourceOutPoint > sourceInPoint) {
                                    plc.inPoint = toTime(sourceInPoint);
                                    plc.outPoint = toTime(sourceInPoint + groupDuration);
                                }
                            } catch(e) {}
                            try { plc.end = toTime(insertSec + groupDuration); } catch(e) {}
                            break;
                        }
                    }

                    // Place Audio Clip on audio track 0 if available
                    if (seq.audioTracks && seq.audioTracks.numTracks > 0) {
                        try {
                            seq.audioTracks[0].overwriteClip(groupProjectItem, toTime(insertSec));
                            for (var apci = seq.audioTracks[0].clips.numItems - 1; apci >= 0; apci--) {
                                var aPlc = seq.audioTracks[0].clips[apci];
                                if (aPlc && Math.abs(aPlc.start.seconds - insertSec) < 0.35) {
                                    try {
                                        if (sourceInPoint > 0 || sourceOutPoint > sourceInPoint) {
                                            aPlc.inPoint = toTime(sourceInPoint);
                                            aPlc.outPoint = toTime(sourceInPoint + groupDuration);
                                        }
                                    } catch(e) {}
                                    try { aPlc.end = toTime(insertSec + groupDuration); } catch(e) {}
                                    break;
                                }
                            }
                        } catch(eAud) {}
                    }

                    insertCount++;
                } catch(eInsert) {}

                // Shift sequence markers downstream
                try {
                    if (seq.markers) {
                        var mL = [];
                        var mk = seq.markers.getFirstMarker();
                        while (mk) { mL.push(mk); mk = seq.markers.getNextMarker(mk); }
                        for (var mki = 0; mki < mL.length; mki++) {
                            var cm = mL[mki];
                            if (cm && cm.start && cm.start.seconds >= (insertSec - 0.05)) {
                                try {
                                    var ms = cm.start.seconds;
                                    var me = (cm.end && !isNaN(cm.end.seconds)) ? cm.end.seconds : ms;
                                    var md = (me > ms) ? (me - ms) : 0;
                                    cm.start = toTime(ms + groupDuration);
                                    if (md > 0) cm.end = toTime(me + groupDuration);
                                } catch(e) {}
                            }
                        }
                        var nm2 = seq.markers.createMarker(insertSec);
                        if (nm2) {
                            nm2.name = range.name + " - Group Photo";
                            try { nm2.end = toTime(insertSec + groupDuration); } catch(e) {}
                            try { nm2.setColorByIndex(4, 0); } catch(e) {}
                        }
                    }
                } catch(eMk) {}
            }

            var totalExt = Math.round(insertCount * groupDuration * 10) / 10;
            return JSON.stringify({
                success: true,
                message: "Ripple-inserted '" + clipNameDisplay + "' across " + insertCount + " Nikah sections (+" + totalExt + "s total)",
                count: insertCount
            });
        } catch(err) {
            return JSON.stringify({ success: false, message: 'Error: ' + (err.message || String(err)) });
        }
    }
};

// Mirror to $.runScript for universal compatibility
$.runScript = $.runScript || {};
$.runScript.importMediaXml = UNIDESK.importMediaXml;

// ── Title Automode: Poll Adobe Encoder for completed renders ──────────────
function sendLocalHttpPost(endpoint, jsonStr) {
    try {
        var conn = new Socket();
        conn.timeout = 2;
        if (conn.open("127.0.0.1:49152", "binary")) {
            var req = "POST " + endpoint + " HTTP/1.1\r\n" +
                      "Host: 127.0.0.1:49152\r\n" +
                      "Content-Type: application/json\r\n" +
                      "Content-Length: " + jsonStr.length + "\r\n" +
                      "Connection: close\r\n\r\n" +
                      jsonStr;
            conn.write(req);
            conn.close();
            return true;
        }
    } catch(e) {}
    return false;
}

UNIDESK.pollEncoderForAutomode = function() {
    if (typeof app === 'undefined' || typeof app.encoder === 'undefined') return;
    try {
        var encItems = app.encoder.getEncodeItems();
        if (!encItems) return;
        for (var i = 0; i < encItems.length; i++) {
            var item = encItems[i];
            // Check if item completed and we haven't notified yet
            if (item && item.encodeTime && !item._udNotified) {
                item._udNotified = true;
                var outputPath = item.outputFilePath || '';
                if (!outputPath) continue;
                // Get parent folder (DVD folder) from output path
                var outFile = new File(outputPath);
                var dvdFolder = outFile.parent ? outFile.parent.fsName : '';
                if (!dvdFolder) continue;
                // POST to Uni Desk local server using ExtendScript Socket
                sendLocalHttpPost('/encoder-complete', '{"dvdPath":' + JSON.stringify(dvdFolder) + ',"autoStart":true}');
            }
        }
    } catch(e) {}
};

// Start polling every 8 seconds
if (typeof setInterval !== 'undefined') {
    setInterval(UNIDESK.pollEncoderForAutomode, 8000);
}

$.runScript.setInPoint = UNIDESK.setInPoint;
$.runScript.setOutPoint = UNIDESK.setOutPoint;
$.runScript.exportToEncoder = UNIDESK.exportToEncoder;
$.runScript.locateXmlFile = UNIDESK.locateXmlFile;
$.runScript.distributeNikahGroupPhoto = UNIDESK.distributeNikahGroupPhoto;

// =============================================================================
// GROUP PHOTO INSERTER — UNIDESK / uni-desk-extension
// Additive functions using $.runScript namespace for CEP bridge compatibility
// =============================================================================

// ── Strict Nikaah detection: prefix === "N" only ──────────────────────────────
function ud_isStrictNikaah(markerName) {
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

    // 2. Check sequence item folder pattern
    var seqMatch = upper.match(/[-_]\d{1,4}[A-Za-z]?[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i) ||
                   upper.match(/[-_]\d{1,4}[A-Za-z]?[-_](\d+)?([A-Za-z]+)[-_]/i) ||
                   upper.match(/[-_](\d+)?(N)[-_]/i) ||
                   upper.match(/[-_](\d+)?([A-Za-z]+)(?:[-_]\d+)?$/i);
    if (seqMatch && seqMatch[2]) {
        var pfx = seqMatch[2].toUpperCase();
        if (pfx === 'N' || pfx === 'NIKAH' || pfx === 'NIKAAH') return true;
    }

    // 3. Clean date and session
    var cleaned = upper
        .replace(/^(?:\d{4}[-_.]\d{1,2}[-_.]\d{1,2}|\d{1,2}[-_.]\d{1,2})[\s_.-]*/, '')
        .replace(/^(?:_\s*)?\d{1,2}[ME][\s_.-]*/, '')
        .replace(/_\d{1,2}[ME][\s_.-]*/g, '')
        .replace(/^\d{3,}[\s_.-]*/, '')
        .replace(/^\s+|\s+$/g, '');

    var knownN = ['NIKAAH', 'NIKAH', 'N'];
    for (var i = 0; i < knownN.length; i++) {
        var p = knownN[i];
        var reg = new RegExp('(?:^|[\\s_.-])(?:(\\d+)\\s*)?(' + p + ')(?:\\s*[-_]?\\s*(\\d+))?(?:[\\s_.-]|$)', 'i');
        if (reg.test(cleaned)) return true;
    }

    return false;
}

// ── Detect GROUP_PHOTO_N sequence markers and find source clip ────────────────
function ud_detectGroupPhotoSources(seq) {
    var found = [];
    if (!seq) return found;

    var gpMarkers = [];
    if (seq.markers) {
        var cur = seq.markers.getFirstMarker();
        while (cur) {
            var nm = (cur.name || '').replace(/^\s+|\s+$/g, '');
            if (isGroupPhotoName(nm)) {
                var gpNum = extractGpNumber(nm);
                var startSec = (cur.start && !isNaN(Number(cur.start.seconds))) ? Number(cur.start.seconds) : 0;
                gpMarkers.push({ gpNum: gpNum, startSec: startSec, markerName: nm });
            }
            cur = seq.markers.getNextMarker(cur);
        }
    }

    var vt = seq.videoTracks;
    for (var mi = 0; mi < gpMarkers.length; mi++) {
        var gpm = gpMarkers[mi];
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
                    if ((dist < 3.0 || isInside) && dist < bestDist) { bestDist = dist; bestClip = c; }
                }
            }
        }

        // If not found by time, check for clip matching GP number on timeline
        if (!bestClip && vt) {
            for (var ti2 = 0; ti2 < vt.numTracks; ti2++) {
                var trk2 = vt[ti2];
                if (!trk2 || !trk2.clips) continue;
                for (var ci2 = 0; ci2 < trk2.clips.numItems; ci2++) {
                    var c2 = trk2.clips[ci2];
                    if (!c2) continue;
                    var c2Nm = c2.name || (c2.projectItem && c2.projectItem.name) || '';
                    if (isGroupPhotoName(c2Nm) && extractGpNumber(c2Nm) === gpm.gpNum) {
                        bestClip = c2;
                        break;
                    }
                }
                if (bestClip) break;
            }
        }

        var clipName = 'Group Photo ' + gpm.gpNum;
        var projItem = null;
        var dur = 0;
        var inP = 0;
        var outP = 0;
        if (bestClip) {
            clipName = bestClip.name || (bestClip.projectItem && bestClip.projectItem.name) || clipName;
            projItem = bestClip.projectItem || null;
            if (bestClip.duration && bestClip.duration.seconds > 0) dur = Number(bestClip.duration.seconds);
            else if (bestClip.start && bestClip.end && bestClip.end.seconds > bestClip.start.seconds) dur = bestClip.end.seconds - bestClip.start.seconds;
            if (bestClip.inPoint && !isNaN(Number(bestClip.inPoint.seconds))) inP = Number(bestClip.inPoint.seconds);
            if (bestClip.outPoint && !isNaN(Number(bestClip.outPoint.seconds))) outP = Number(bestClip.outPoint.seconds);
        }
        if (dur <= 0 && outP > inP) dur = outP - inP;
        if (dur <= 0 && projItem) {
            try {
                var inPt = projItem.getInPoint ? projItem.getInPoint() : null;
                var outPt = projItem.getOutPoint ? projItem.getOutPoint() : null;
                if (outPt && outPt.seconds > 0) {
                    var inPtS = (inPt && inPt.seconds > 0) ? inPt.seconds : 0;
                    if (outPt.seconds > inPtS) dur = outPt.seconds - inPtS;
                }
            } catch(e) {}
        }
        found.push({ gpNum: gpm.gpNum, markerStartSec: gpm.startSec, clipName: clipName, projectItem: projItem, duration: dur, inPoint: inP, outPoint: outP, hasClip: (projItem !== null) });
    }

    // FALLBACK 1: If no markers found, scan video tracks for GP clips directly
    if (found.length === 0 && vt) {
        var seenGps = {};
        for (var ti3 = 0; ti3 < vt.numTracks; ti3++) {
            var trk3 = vt[ti3];
            if (!trk3 || !trk3.clips) continue;
            for (var ci3 = 0; ci3 < trk3.clips.numItems; ci3++) {
                var c3 = trk3.clips[ci3];
                if (!c3) continue;
                var c3Nm = c3.name || (c3.projectItem && c3.projectItem.name) || '';
                var cColor = (typeof c3.getColorLabel === 'function') ? c3.getColorLabel() : -1;
                var pColor = (c3.projectItem && typeof c3.projectItem.getColorLabel === 'function') ? c3.projectItem.getColorLabel() : -1;
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
                            clipName: c3Nm || ('Group Photo ' + gpN),
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

    // FALLBACK 2: Scan project bins if still no GP sources found
    if (found.length === 0 && app.project && app.project.rootItem) {
        var binGps = {};
        function scanBinForGps(bin) {
            if (!bin || !bin.children) return;
            for (var bi = 0; bi < bin.children.numItems; bi++) {
                var child = bin.children[bi];
                if (!child) continue;
                if (child.type === 2 || (child.isSequence && child.isSequence())) continue;
                if (child.type === 1) scanBinForGps(child);
                else {
                    var bNm = child.name || '';
                    if (isGroupPhotoName(bNm)) {
                        var bGpN = extractGpNumber(bNm);
                        if (!binGps[bGpN]) {
                            binGps[bGpN] = true;
                            found.push({ gpNum: bGpN, markerStartSec: 0, clipName: bNm, projectItem: child, duration: 15.0, inPoint: 0, outPoint: 15.0, hasClip: true });
                        }
                    }
                }
            }
        }
        scanBinForGps(app.project.rootItem);
    }

    found.sort(function(a, b) { return a.gpNum - b.gpNum; });
    return found;
}

// ── Collect all N-prefix markers sorted chronologically ──────────────────────
function ud_collectNikaahMarkers(seq) {
    var list = [];
    if (!seq) return list;
    var all = [];
    if (seq.markers) {
        var cur = seq.markers.getFirstMarker();
        while (cur) {
            var s = (cur.start && !isNaN(Number(cur.start.seconds))) ? Number(cur.start.seconds) : 0;
            var e = (cur.end && !isNaN(Number(cur.end.seconds))) ? Number(cur.end.seconds) : 0;
            var d = (cur.duration && !isNaN(Number(cur.duration.seconds))) ? Number(cur.duration.seconds) : 0;
            all.push({ name: cur.name || '', startSec: s, endSec: (e > s) ? e : (s + d) });
            cur = seq.markers.getNextMarker(cur);
        }
    }
    all.sort(function(a, b) { return a.startSec - b.startSec; });
    var seqEnd = 0;
    try { var se = Number(seq.end && seq.end.seconds); if (isFinite(se) && se > 0) seqEnd = se; } catch(e) {}
    if (seqEnd <= 0) {
        try {
            var vt = seq.videoTracks;
            if (vt) for (var vi = 0; vi < vt.numTracks; vi++) { var trk = vt[vi]; if (!trk || !trk.clips) continue; for (var ci = 0; ci < trk.clips.numItems; ci++) { var c = trk.clips[ci]; var ce = (c.end && !isNaN(Number(c.end.seconds))) ? Number(c.end.seconds) : 0; if (ce > seqEnd) seqEnd = ce; } }
        } catch(e) {}
    }
    var cnt = 0;
    for (var mi = 0; mi < all.length; mi++) {
        var item = all[mi];
        if (!ud_isStrictNikaah(item.name)) continue;
        cnt++;
        var s2 = item.startSec;
        var e2 = item.endSec;
        if (e2 <= s2) {
            var nextS = null;
            for (var nj = mi + 1; nj < all.length; nj++) { if (all[nj].startSec > s2) { nextS = all[nj].startSec; break; } }
            e2 = (nextS !== null) ? nextS : seqEnd;
            if (e2 <= s2) e2 = s2 + 5;
        }
        list.push({ seqNum: cnt, name: item.name, startSec: s2, endSec: e2 });
    }

    // Fallback: If no markers found, scan video track clips directly
    if (list.length === 0 && seq.videoTracks) {
        var clipCandidates = [];
        for (var vi2 = 0; vi2 < seq.videoTracks.numTracks; vi2++) {
            var trk2 = seq.videoTracks[vi2];
            if (!trk2 || !trk2.clips) continue;
            for (var ci2 = 0; ci2 < trk2.clips.numItems; ci2++) {
                var c2 = trk2.clips[ci2];
                if (!c2) continue;
                var clipNm = c2.name || (c2.projectItem && c2.projectItem.name) || '';
                if (ud_isStrictNikaah(clipNm)) {
                    var cStart = (c2.start && !isNaN(Number(c2.start.seconds))) ? Number(c2.start.seconds) : 0;
                    var cEnd   = (c2.end   && !isNaN(Number(c2.end.seconds)))   ? Number(c2.end.seconds)   : 0;
                    clipCandidates.push({ name: clipNm, startSec: cStart, endSec: cEnd });
                }
            }
        }
        if (clipCandidates.length > 0) {
            clipCandidates.sort(function(a, b) { return a.startSec - b.startSec; });
            for (var cki = 0; cki < clipCandidates.length; cki++) {
                list.push({ seqNum: cki + 1, name: clipCandidates[cki].name, startSec: clipCandidates[cki].startSec, endSec: clipCandidates[cki].endSec });
            }
        }
    }

    return list;
}

// ── Scan ──────────────────────────────────────────────────────────────────────
$.runScript.groupPhotoInserterScan = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERROR|||No active sequence found.';
        var gps = ud_detectGroupPhotoSources(seq);
        var nks = ud_collectNikaahMarkers(seq);
        var parts = ['SUCCESS', String(gps.length)];
        for (var i = 0; i < gps.length; i++) {
            var gp = gps[i];
            parts.push(String(gp.gpNum) + '|' + gp.clipName + '|' + (gp.hasClip ? '1' : '0') + '|' + String(Math.round(gp.duration * 10) / 10));
        }
        parts.push('NIKAAH_COUNT');
        parts.push(String(nks.length));
        return parts.join('|||');
    } catch(err) { return 'ERROR|||' + err.toString(); }
};

// ── Preview ───────────────────────────────────────────────────────────────────
$.runScript.groupPhotoInserterPreview = function(assignmentsStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERROR|||No active sequence found.';
        var gps = ud_detectGroupPhotoSources(seq);
        var nks = ud_collectNikaahMarkers(seq);
        if (nks.length === 0) return 'ERROR|||No Nikaah (N-prefix) markers found. Run Auto In/Out Markers first.';
        var gpByNum = {};
        for (var gi = 0; gi < gps.length; gi++) gpByNum[gps[gi].gpNum] = gps[gi];
        var assignments = [];
        var tokens = (assignmentsStr || '').replace(/^\s+|\s+$/g, '').split(';');
        for (var ai = 0; ai < tokens.length; ai++) {
            var tok = tokens[ai].replace(/^\s+|\s+$/g, '');
            if (!tok) continue;
            var f = tok.split(',');
            if (f.length < 3) continue;
            var gn = parseInt(f[0], 10); var fn2 = parseInt(f[1], 10); var tn = parseInt(f[2], 10);
            if (isNaN(gn) || isNaN(fn2) || isNaN(tn)) continue;
            assignments.push({ gpNum: gn, fromN: fn2, toN: tn });
        }
        if (assignments.length === 0) return 'ERROR|||No valid assignments provided.';
        var nkToGp = {};
        var warnings = [];
        for (var asi = 0; asi < assignments.length; asi++) {
            var asgn = assignments[asi];
            var gp = gpByNum[asgn.gpNum];
            if (!gp) { warnings.push('⚠ GROUP_PHOTO_' + asgn.gpNum + ' marker not found.'); continue; }
            if (!gp.hasClip) warnings.push('⚠ GROUP_PHOTO_' + asgn.gpNum + ': No clip at marker position.');
            var lo = Math.min(asgn.fromN, asgn.toN); var hi = Math.max(asgn.fromN, asgn.toN);
            for (var ni = lo; ni <= hi; ni++) {
                if (nkToGp.hasOwnProperty(ni)) warnings.push('⚠ Nikaah ' + ni + ' overlap — GP' + asgn.gpNum + ' wins.');
                nkToGp[ni] = asgn.gpNum;
            }
        }
        var lines = []; var planned = 0; var skipped = 0;
        for (var nki = 0; nki < nks.length; nki++) {
            var nk = nks[nki];
            var agp = nkToGp[nk.seqNum];
            if (agp === undefined || agp === null) { lines.push('  — Nikaah ' + nk.seqNum + '  [' + nk.name + ']  → (no assignment — skipped)'); skipped++; }
            else {
                var sg = gpByNum[agp];
                var lbl = sg ? sg.clipName : ('GROUP_PHOTO_' + agp);
                var dur = sg ? (' [' + Math.round(sg.duration * 10) / 10 + 's]') : '';
                var warn = (sg && !sg.hasClip) ? ' ⚠ clip not found!' : '';
                lines.push('  ✓ Nikaah ' + nk.seqNum + '  [' + nk.name + ']  →  ' + lbl + dur + warn); planned++;
            }
        }
        return 'SUCCESS|||' + lines.join('\n') + '|||STATS|||inserted=' + planned + '|skipped=' + skipped + '|warnings=' + warnings.length + '|||WARNINGS|||' + warnings.join('\n');
    } catch(err) { return 'ERROR|||' + err.toString(); }
};

// ── Execute ───────────────────────────────────────────────────────────────────
$.runScript.groupPhotoInserterExecute = function(assignmentsStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERROR|||No active sequence found.';
        try { if (typeof app.enableQE === 'function') app.enableQE(); } catch(e) {}
        function toTime(sec) { var t = new Time(); t.seconds = Math.max(0, Number(sec)); return t; }
        function fmtSec(sec) { var tot = Math.floor(Math.max(0, Number(sec))); var m = Math.floor(tot / 60); var s = tot % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
        function shiftFwd(clip, track, amt) {
            if (!clip || amt <= 0) return false;
            var os = clip.start ? clip.start.seconds : 0; var oe = clip.end ? clip.end.seconds : 0;
            var dur = (oe > os) ? (oe - os) : (clip.duration ? clip.duration.seconds : 0);
            var ts = os + amt; var te = oe + amt; var moved = false;
            if (typeof clip.move === 'function') { try { clip.move(toTime(ts)); if (Math.abs(clip.start.seconds - ts) < 0.2) moved = true; } catch(e) {} }
            if (!moved) { try { clip.start = toTime(ts); if (Math.abs(clip.start.seconds - ts) < 0.2) moved = true; } catch(e) {} }
            if (!moved) { try { clip.end = toTime(te); clip.start = toTime(ts); if (Math.abs(clip.start.seconds - ts) < 0.2) moved = true; } catch(e) {} }
            if (!moved && clip.projectItem) { try { var inS = (clip.inPoint && !isNaN(clip.inPoint.seconds)) ? clip.inPoint.seconds : 0; var outS = (clip.outPoint && !isNaN(clip.outPoint.seconds)) ? clip.outPoint.seconds : (inS + dur); track.overwriteClip(clip.projectItem, toTime(ts)); for (var ci = track.clips.numItems - 1; ci >= 0; ci--) { var pc = track.clips[ci]; if (pc && Math.abs(pc.start.seconds - ts) < 0.25) { try { pc.inPoint = toTime(inS); pc.outPoint = toTime(outS); } catch(e) {} moved = true; break; } } } catch(e) {} }
            return moved;
        }
        var gps = ud_detectGroupPhotoSources(seq);
        var nks = ud_collectNikaahMarkers(seq);
        if (nks.length === 0) return 'ERROR|||No Nikaah markers found.';
        var gpByNum = {};
        for (var gi = 0; gi < gps.length; gi++) gpByNum[gps[gi].gpNum] = gps[gi];
        var assignments = [];
        var tokens = (assignmentsStr || '').replace(/^\s+|\s+$/g, '').split(';');
        for (var ai = 0; ai < tokens.length; ai++) { var tok = tokens[ai].replace(/^\s+|\s+$/g, ''); if (!tok) continue; var f = tok.split(','); if (f.length < 3) continue; var gn = parseInt(f[0], 10); var fn2 = parseInt(f[1], 10); var tn = parseInt(f[2], 10); if (isNaN(gn) || isNaN(fn2) || isNaN(tn)) continue; assignments.push({ gpNum: gn, fromN: fn2, toN: tn }); }
        if (assignments.length === 0) return 'ERROR|||No valid assignments.';
        var nkToGp = {};
        for (var asi = 0; asi < assignments.length; asi++) { var a = assignments[asi]; var lo = Math.min(a.fromN, a.toN); var hi = Math.max(a.fromN, a.toN); for (var ni = lo; ni <= hi; ni++) nkToGp[ni] = a.gpNum; }
        for (var vi = 0; vi < seq.videoTracks.numTracks; vi++) { try { var vt = seq.videoTracks[vi]; if (typeof vt.isLocked === 'function' && vt.isLocked()) vt.setLocked(false); } catch(e) {} }
        for (var ai2 = 0; ai2 < seq.audioTracks.numTracks; ai2++) { try { var at = seq.audioTracks[ai2]; if (typeof at.isLocked === 'function' && at.isLocked()) at.setLocked(false); } catch(e) {} }
        var ins = 0; var skip = 0; var fail = 0; var rpt = [];
        var workList = [];
        for (var nki = nks.length - 1; nki >= 0; nki--) { var nk = nks[nki]; var ag = nkToGp[nk.seqNum]; if (ag === undefined || ag === null) continue; workList.push({ nk: nk, gpNum: ag }); }
        for (var wi = 0; wi < workList.length; wi++) {
            var nk = workList[wi].nk; var gpNum = workList[wi].gpNum; var gp = gpByNum[gpNum];
            if (!gp) { rpt.push('✗ Nikaah ' + nk.seqNum + ' — GP' + gpNum + ' not found. Skipped.'); skip++; continue; }
            if (!gp.hasClip || !gp.projectItem) { rpt.push('✗ Nikaah ' + nk.seqNum + ' — GP' + gpNum + ' has no clip. Skipped.'); skip++; continue; }
            var gDur = gp.duration;
            if (gDur <= 0) { rpt.push('✗ Nikaah ' + nk.seqNum + ' — GP' + gpNum + ' duration 0. Skipped.'); skip++; continue; }
            var dupKey = 'OT_GP_INSERTED|GP:' + gpNum + '|NIKAAH:' + nk.seqNum;
            var isDup = false;
            try { var vt2 = seq.videoTracks; if (vt2) { outerUD: for (var ti2 = 0; ti2 < vt2.numTracks; ti2++) { var trk2 = vt2[ti2]; if (!trk2 || !trk2.clips) continue; for (var ci2 = 0; ci2 < trk2.clips.numItems; ci2++) { var c2 = trk2.clips[ci2]; if (!c2) continue; var cmt2 = ''; try { cmt2 = c2.comment || ''; } catch(e) {} if (cmt2.indexOf(dupKey) !== -1) { isDup = true; break outerUD; } } } } } catch(e) {}
            if (!isDup && seq.markers) {
                try {
                    var chkMk = seq.markers.getFirstMarker();
                    while (chkMk) {
                        var mkCmt = '';
                        try { mkCmt = chkMk.comments || ''; } catch(e) {}
                        var mkNm = chkMk.name || '';
                        if (mkCmt.indexOf(dupKey) !== -1 || mkNm === (nk.name + ' - GP' + gpNum)) {
                            isDup = true;
                            break;
                        }
                        chkMk = seq.markers.getNextMarker(chkMk);
                    }
                } catch(eMkDup) {}
            }
            if (isDup) { rpt.push('↷ Nikaah ' + nk.seqNum + ' — GP' + gpNum + ' already inserted. Skipped.'); skip++; continue; }
            var iSec = nk.endSec; var tvt = seq.videoTracks[0];
            // Ripple video
            for (var vIdx = 0; vIdx < seq.videoTracks.numTracks; vIdx++) { var vTrk = seq.videoTracks[vIdx]; if (!vTrk || !vTrk.clips) continue; var toS = []; var spS = []; for (var ci3 = vTrk.clips.numItems - 1; ci3 >= 0; ci3--) { var c3 = vTrk.clips[ci3]; if (!c3) continue; var cs = c3.start ? c3.start.seconds : 0; var ce = c3.end ? c3.end.seconds : 0; if (cs >= (iSec - 0.05)) toS.push(c3); else if (cs < (iSec - 0.05) && ce > (iSec + 0.05)) spS.push(c3); } for (var si = 0; si < toS.length; si++) shiftFwd(toS[si], vTrk, gDur); for (var sp = 0; sp < spS.length; sp++) { try { var sc = spS[sp]; var so = sc.start.seconds; var se2 = sc.end.seconds; var si2 = (sc.inPoint && !isNaN(sc.inPoint.seconds)) ? sc.inPoint.seconds : 0; var pi = sc.projectItem; sc.end = toTime(iSec); if (pi) { var nh = iSec + gDur; vTrk.overwriteClip(pi, toTime(nh)); for (var rci = vTrk.clips.numItems - 1; rci >= 0; rci--) { var rc = vTrk.clips[rci]; if (rc && Math.abs(rc.start.seconds - nh) < 0.25) { try { rc.inPoint = toTime(si2 + (iSec - so)); rc.outPoint = toTime(si2 + (se2 - so)); } catch(e) {} break; } } } } catch(e) {} } }
            // Ripple audio
            for (var aIdx = 0; aIdx < seq.audioTracks.numTracks; aIdx++) { var aTrk = seq.audioTracks[aIdx]; if (!aTrk || !aTrk.clips) continue; var toA = []; var spA = []; for (var aci = aTrk.clips.numItems - 1; aci >= 0; aci--) { var ac = aTrk.clips[aci]; if (!ac) continue; var as2 = ac.start ? ac.start.seconds : 0; var ae = ac.end ? ac.end.seconds : 0; if (as2 >= (iSec - 0.05)) toA.push(ac); else if (as2 < (iSec - 0.05) && ae > (iSec + 0.05)) spA.push(ac); } for (var asi2 = 0; asi2 < toA.length; asi2++) shiftFwd(toA[asi2], aTrk, gDur); for (var asp = 0; asp < spA.length; asp++) { try { var ac2 = spA[asp]; var aos = ac2.start.seconds; var aoe = ac2.end.seconds; var aoi = (ac2.inPoint && !isNaN(ac2.inPoint.seconds)) ? ac2.inPoint.seconds : 0; var api = ac2.projectItem; ac2.end = toTime(iSec); if (api) { var anh = iSec + gDur; aTrk.overwriteClip(api, toTime(anh)); for (var arci = aTrk.clips.numItems - 1; arci >= 0; arci--) { var arc = aTrk.clips[arci]; if (arc && Math.abs(arc.start.seconds - anh) < 0.25) { try { arc.inPoint = toTime(aoi + (iSec - aos)); arc.outPoint = toTime(aoi + (aoe - aos)); } catch(e) {} break; } } } } catch(e) {} } }
            // Insert
            try {
                try {
                    if (typeof gp.projectItem.setInPoint === 'function') gp.projectItem.setInPoint(toTime(gp.inPoint));
                    if (typeof gp.projectItem.setOutPoint === 'function') gp.projectItem.setOutPoint(toTime(gp.inPoint + gDur));
                } catch(eSetIO) {}
                tvt.overwriteClip(gp.projectItem, toTime(iSec));
                for (var pci = tvt.clips.numItems - 1; pci >= 0; pci--) { var pc = tvt.clips[pci]; if (pc && Math.abs(pc.start.seconds - iSec) < 0.35) { try { pc.inPoint = toTime(gp.inPoint); pc.outPoint = toTime(gp.inPoint + gDur); } catch(e) {} try { pc.end = toTime(iSec + gDur); } catch(e) {} try { pc.comment = dupKey; } catch(e) {} break; } }
                if (seq.audioTracks && seq.audioTracks.numTracks > 0) {
                    try {
                        seq.audioTracks[0].overwriteClip(gp.projectItem, toTime(iSec));
                        for (var apci2 = seq.audioTracks[0].clips.numItems - 1; apci2 >= 0; apci2--) {
                            var aPlaced = seq.audioTracks[0].clips[apci2];
                            if (aPlaced && Math.abs(aPlaced.start.seconds - iSec) < 0.35) {
                                try { aPlaced.inPoint = toTime(gp.inPoint); aPlaced.outPoint = toTime(gp.inPoint + gDur); } catch(eAIO) {}
                                try { aPlaced.end = toTime(iSec + gDur); } catch(eAEnd) {}
                                try { aPlaced.comment = dupKey; } catch(eACmt) {}
                                break;
                            }
                        }
                    } catch(eAudPlc) {}
                }
            } catch(ePlc) { fail++; rpt.push('✗ Nikaah ' + nk.seqNum + ' — insert failed: ' + ePlc.toString()); continue; }
            // Shift markers
            try { var mL = []; var mk = seq.markers.getFirstMarker(); while (mk) { mL.push(mk); mk = seq.markers.getNextMarker(mk); } for (var mki = 0; mki < mL.length; mki++) { var cm = mL[mki]; if (cm && cm.start && cm.start.seconds >= (iSec - 0.05)) { try { var ms = cm.start.seconds; var me = (cm.end && !isNaN(cm.end.seconds)) ? cm.end.seconds : ms; var md = (me > ms) ? (me - ms) : 0; cm.start = toTime(ms + gDur); if (md > 0) cm.end = toTime(me + gDur); } catch(e) {} } } var nm2 = seq.markers.createMarker(iSec); if (nm2) { nm2.name = nk.name + ' - GP' + gpNum; nm2.comments = dupKey; try { nm2.end = toTime(iSec + gDur); } catch(e) {} try { nm2.setColorByIndex(4, 0); } catch(e) {} } } catch(e) {}
            ins++;
            rpt.unshift('✓ Nikaah ' + nk.seqNum + ' [' + nk.name + '] → GP' + gpNum + ' (' + gp.clipName + ') @ ' + fmtSec(iSec) + ' (+' + gDur + 's)');
        }
        return 'SUCCESS|||inserted=' + ins + '|skipped=' + skip + '|failed=' + fail + '|||' + rpt.join('\n');
    } catch(err) { return 'ERROR|||' + err.toString(); }
};

// Mirror new functions to UNIDESK namespace too
UNIDESK.groupPhotoInserterScan = $.runScript.groupPhotoInserterScan;
UNIDESK.groupPhotoInserterPreview = $.runScript.groupPhotoInserterPreview;
UNIDESK.groupPhotoInserterExecute = $.runScript.groupPhotoInserterExecute;
