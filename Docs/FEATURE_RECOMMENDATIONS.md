# Uni Desk (One Tap) — Feature Recommendations & Roadmap

This document outlines proposed enhancements and new feature recommendations for **Uni Desk (One Tap)** — Professional Workstation & Media Automation Toolkit.

---

## 🎬 1. Premiere Pro & Media Automation (`PrprojGenerator` & `Converter`)

* **Preset Aspect Ratio & Sequence Templates**
  * Quick-switch aspect ratio presets: **Vertical Shorts/Reels/TikTok (9:16 - 1080x1920)**, **Horizontal Cinema/YouTube (16:9 - 4K / 1080p)**, and **Square Social (1:1)**.
  * Auto-detection of clip frame rates (23.976, 24, 25, 29.97, 59.94 fps) with timeline auto-matching.

* **Audio Track Auto-Routing**
  * Automatic assignment of media clips to targeted audio tracks upon timeline creation:
    * `A1`: Primary Dialogue / A-Roll
    * `A2`: B-Roll Audio
    * `A3`: Background Music (BGM)
    * `A4`: Sound Effects (SFX)

* **Checksum-Based Proxy Batch Generator**
  * Integrated background proxy renderer (ProRes Proxy / H.264 low-res) with automatic file linking for seamless 4K/8K timeline performance.

* **Smart Timeline Marker Import/Export**
  * Import marker locations from CSV/JSON transcripts and export timeline markers to Premiere/DaVinci Resolve EDL files.

---

## 📹 2. Camera Offloading & Ingestion (`CameraTransfer`)

* **MD5 / xxHash Copy Verification**
  * Bit-for-bit checksum calculation during SD card offloading to guarantee data integrity for DITs and videographers.

* **Dual-Destination Offload (Backup Vault)**
  * Simultaneous multi-target copying (e.g., copying footage to working NVMe SSD + secondary backup NAS drive).

* **EXIF & Metadata Auto-Categorization**
  * Automatic sorting of raw footage by camera model, creation date (`YYYY-MM-DD`), resolution, or lens focal length.

---

## 🧹 3. Storage & Project Lifecycle (`Cleaner` & `Utilities`)

* **Adobe Cache & Peak File Purger**
  * 1-click cleanup tool for Adobe cache files (`.mcf`, `.pek`, scratch files) to reclaim tens of gigabytes of disk space safely.

* **Project Archiver & Consolidation Tool**
  * Package a `.prproj` file with only the referenced assets into a zip archive while stripping unused raw takes.

* **Duplicate Asset Detector**
  * Smart scanner to identify duplicate media files across production folders and storage drives.

---

## 💻 4. Desktop Productivity & UI/UX (`Dashboard` & `Utilities`)

* **Mini Floating Desktop Bar (Overlay Mode)**
  * A compact, always-on-top widget providing quick access to folder creation, camera transfer progress, and live CPU/GPU/RAM metrics.

* **Global Hotkey System**
  * System-wide customizable keyboard shortcuts (e.g., `Ctrl + Alt + N` for project folders, `Ctrl + Alt + P` for Premiere generator).

* **Task Completion Notifications**
  * Desktop toast and audio cues when long background conversions or file copies finish.

---

## ☁️ 5. Cloud & Collaboration (`DriveSync` & `CloudPortal`)

* **Automatic Project XML / Prproj Cloud Sync**
  * Real-time background sync for project files (`.prproj`, `.drp`, `.xml`) with local version control history.

* **Team Workspace Presets**
  * Shared folder structure templates and preset configurations across editor workstations via cloud sync.
