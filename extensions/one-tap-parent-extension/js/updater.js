/**
 * One Tap Parent Extension - Node.js Powered CEP Auto-Updater Engine
 * Repository: BSFrameWorks5253 / one-tap-parent-extension
 */

(function () {
    var AutoUpdater = {
        currentVersion: "1.0.0",
        repoOwner: "BSFrameWorks5253",
        repoName: "onetap-adobe-extenstion",
        isUpdating: false,

        // Initialize AutoUpdater engine
        init: function () {
            this.loadLocalVersion();
            var self = this;
            // Silent check 3 seconds after extension launch
            setTimeout(function () {
                self.checkForUpdates(true);
            }, 3000);
        },

        // Get extension installation directory path
        getExtensionPath: function () {
            try {
                if (window.CSInterface) {
                    var cs = new CSInterface();
                    return cs.getSystemPath(SystemPath.EXTENSION);
                }
            } catch (e) { }
            return "";
        },

        // Read local version.json metadata
        loadLocalVersion: function () {
            try {
                var fs = require('fs');
                var path = require('path');
                var extPath = this.getExtensionPath();
                if (extPath) {
                    var verFile = path.join(extPath, 'version.json');
                    if (fs.existsSync(verFile)) {
                        var data = JSON.parse(fs.readFileSync(verFile, 'utf8'));
                        if (data.version) this.currentVersion = data.version;
                        if (data.repoOwner) this.repoOwner = data.repoOwner;
                        if (data.repoName) this.repoName = data.repoName;
                    }
                }
            } catch (e) {
                console.log("[AutoUpdater] loadLocalVersion error:", e);
            }

            // Update UI version badge if element exists
            var badge = document.getElementById("versionBadge");
            if (badge) {
                badge.innerText = "v" + this.currentVersion;
            }
        },

        // SemVer Version Comparison (returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal)
        compareVersions: function (v1, v2) {
            var n1 = (v1 || "").replace(/^v/, "").split('.').map(Number);
            var n2 = (v2 || "").replace(/^v/, "").split('.').map(Number);
            for (var i = 0; i < Math.max(n1.length, n2.length); i++) {
                var val1 = n1[i] || 0;
                var val2 = n2[i] || 0;
                if (val1 > val2) return 1;
                if (val1 < val2) return -1;
            }
            return 0;
        },

        // Check for updates against dedicated GitHub repository
        checkForUpdates: function (silent) {
            var self = this;
            if (this.isUpdating) return;

            if (!silent && window.showStatus) {
                window.showStatus("Checking for extension updates...", "var(--accent)");
            }

            try {
                var https = require('https');
                var rawUrl = "https://raw.githubusercontent.com/" + this.repoOwner + "/" + this.repoName + "/main/version.json";

                https.get(rawUrl, { headers: { 'User-Agent': 'OneTap-CEP-Updater' } }, function (res) {
                    if (res.statusCode !== 200) {
                        if (!silent && window.showToast) {
                            window.showToast("Update Check", "Could not check updates (HTTP " + res.statusCode + ")", "warning");
                        }
                        return;
                    }

                    var body = "";
                    res.on('data', function (chunk) { body += chunk; });
                    res.on('end', function () {
                        try {
                            var remote = JSON.parse(body);
                            if (remote && remote.version) {
                                if (self.compareVersions(remote.version, self.currentVersion) > 0) {
                                    // New update available!
                                    self.promptUpdateAvailable(remote);
                                } else {
                                    if (!silent && window.showToast) {
                                        window.showToast("Up to Date", "Extension is running the latest version (v" + self.currentVersion + ")", "success");
                                    }
                                }
                            }
                        } catch (e) {
                            if (!silent && window.showToast) {
                                window.showToast("Update Check", "Invalid release metadata.", "error");
                            }
                        }
                    });
                }).on('error', function (err) {
                    if (!silent && window.showToast) {
                        window.showToast("Network Error", "Unable to connect to update server.", "error");
                    }
                });
            } catch (err) {
                console.log("[AutoUpdater] Check failed:", err);
            }
        },

        // Prompt user that update is ready to download
        promptUpdateAvailable: function (remote) {
            var self = this;
            var msg = "v" + remote.version + " is available! (" + (remote.releaseNotes || "Performance & UI updates") + ")";
            
            if (window.showToast) {
                window.showToast("⚡ Extension Update Ready", msg, "warning");
            }

            var badge = document.getElementById("versionBadge");
            if (badge) {
                badge.innerHTML = "v" + this.currentVersion + " <span style='color:var(--warning);font-weight:800;'>⚡ v" + remote.version + " Available</span>";
            }

            if (window.showCustomAlert) {
                window.showCustomAlert(
                    "⚡ New Version v" + remote.version + " Ready",
                    "A new update for One Tap Parent Extension is available!\n\n" +
                    "Version: v" + remote.version + "\n" +
                    "Notes: " + (remote.releaseNotes || "General bug fixes & enhancements") + "\n\n" +
                    "Would you like to auto-download and update now?",
                    "info",
                    function () {
                        self.downloadAndInstallUpdate(remote);
                    }
                );
            }
        },

        // Download ZIP payload and extract directly into CEP extension directory
        downloadAndInstallUpdate: function (remote) {
            var self = this;
            this.isUpdating = true;

            if (window.showStatus) {
                window.showStatus("Downloading update v" + remote.version + "...", "var(--accent)");
            }
            if (window.showToast) {
                window.showToast("Downloading Update", "Fetching release zip from GitHub...", "info");
            }

            try {
                var fs = require('fs');
                var path = require('path');
                var os = require('os');
                var https = require('https');
                var child_process = require('child_process');

                var extPath = this.getExtensionPath();
                if (!extPath) {
                    if (window.showToast) window.showToast("Error", "Could not locate CEP extension directory.", "error");
                    this.isUpdating = false;
                    return;
                }

                var zipUrl = remote.downloadUrl || ("https://github.com/" + this.repoOwner + "/" + this.repoName + "/releases/download/v" + remote.version + "/one-tap-parent-extension.zip");
                var tempZipPath = path.join(os.tmpdir(), "one-tap-parent-update-v" + remote.version + ".zip");

                // Download zip file with redirect handling
                this.downloadFile(zipUrl, tempZipPath, function (err) {
                    if (err) {
                        self.isUpdating = false;
                        if (window.showToast) window.showToast("Download Failed", err.message || "Failed to download update zip.", "error");
                        return;
                    }

                    if (window.showStatus) window.showStatus("Installing update v" + remote.version + "...", "var(--accent)");

                    // Use PowerShell Expand-Archive to extract & overwrite CEP extension folder cleanly
                    var psCommand = 'PowerShell -ExecutionPolicy Bypass -Command "Expand-Archive -Path \'' + tempZipPath + '\' -DestinationPath \'' + extPath + '\' -Force"';

                    child_process.exec(psCommand, function (error, stdout, stderr) {
                        // Clean up temporary zip file
                        try { fs.unlinkSync(tempZipPath); } catch (e) { }

                        self.isUpdating = false;

                        if (error) {
                            console.log("[AutoUpdater] Extraction error:", stderr);
                            if (window.showToast) window.showToast("Installation Failed", "Could not extract update zip package.", "error");
                            return;
                        }

                        // Success! Update local version.json file
                        try {
                            var verFile = path.join(extPath, 'version.json');
                            fs.writeFileSync(verFile, JSON.stringify({
                                version: remote.version,
                                repoOwner: self.repoOwner,
                                repoName: self.repoName,
                                releaseNotes: remote.releaseNotes || "",
                                updatedAt: new Date().toISOString()
                            }, null, 2), 'utf8');
                        } catch (e) { }

                        // Show success alert & prompt to reload panel
                        if (window.showCustomAlert) {
                            window.showCustomAlert(
                                "🎉 Extension Updated!",
                                "One Tap Parent Extension has been updated to v" + remote.version + "!\n\nClick 'Reload' below to refresh the extension and run the new version.",
                                "success",
                                function () {
                                    window.location.reload();
                                }
                            );
                        }

                        if (window.showToast) {
                            window.showToast("✓ Update Installed", "Extension upgraded to v" + remote.version + "! Click to reload panel.", "success");
                        }
                    });
                });
            } catch (err) {
                this.isUpdating = false;
                console.log("[AutoUpdater] Install error:", err);
            }
        },

        // Helper to download HTTPS file with redirect follow support
        downloadFile: function (url, destPath, callback) {
            var https = require('https');
            var fs = require('fs');

            var file = fs.createWriteStream(destPath);
            var request = https.get(url, { headers: { 'User-Agent': 'OneTap-CEP-Updater' } }, function (response) {
                // Handle HTTP Redirects (GitHub Release CDN links)
                if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
                    file.close();
                    try { fs.unlinkSync(destPath); } catch (e) { }
                    return AutoUpdater.downloadFile(response.headers.location, destPath, callback);
                }

                if (response.statusCode !== 200) {
                    file.close();
                    try { fs.unlinkSync(destPath); } catch (e) { }
                    return callback(new Error("Server returned HTTP " + response.statusCode));
                }

                response.pipe(file);
                file.on('finish', function () {
                    file.close(callback);
                });
            }).on('error', function (err) {
                file.close();
                try { fs.unlinkSync(destPath); } catch (e) { }
                callback(err);
            });
        }
    };

    window.AutoUpdater = AutoUpdater;

    document.addEventListener('DOMContentLoaded', function () {
        AutoUpdater.init();
    });
})();
