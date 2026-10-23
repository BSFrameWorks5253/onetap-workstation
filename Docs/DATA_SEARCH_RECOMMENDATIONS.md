# Data Search (Zero-Storage Virtual Catalog & Reconciler) — Architectural Recommendations & Roadmap

This document outlines high-impact technical and workflow recommendations for **Data Search (ArchiveVault / Ghost Vault)** in **One Tap Workstation** — the media cataloging and reconciliation engine designed for offline multi-terabyte storage drives.

---

## 🎯 1. Zero-Configuration Dynamic Drive Remounting (UUID / Volume Signature)

### The Problem
On Windows, when multiple external SSDs and hard drives (e.g. 8TB–20TB drives) are disconnected and reconnected, Windows frequently reassigns different drive letters (e.g., a drive previously mounted as `E:` mounts as `F:` or `G:`). This causes Data Search to display **"Drive Offline"**, breaking Explorer Locate, Open Folder, and live verification until manually adjusted.

### Architectural Recommendation
* **Volume UUID & Signature Marker (`.onetap_vault.json`)**:
  * During the first scan of any external hard drive, One Tap writes a hidden, lightweight metadata signature file to the root of the drive:
    ```json
    {
      "vault_id": "vault_6f8b91a2-4c91",
      "drive_label": "Seagate_16TB_Archive_01",
      "registered_at": "1448-02-15",
      "serial_number": "NA87X91Z"
    }
    ```
  * In the SQLite `drive_volumes` table, store this unique `vault_id` and the hardware drive serial number (`serial_number`).
* **Background Drive Listener & Auto-Remapping**:
  * Implement a lightweight Windows volume mount listener (`WM_DEVICECHANGE` in Electron main process).
  * When any USB drive or partition mounts, One Tap inspects the drive letter for `.onetap_vault.json` or queries its hardware volume serial.
  * If a match is found in `drive_volumes`, One Tap automatically updates `scanned_archives.root_path` for all Safars assigned to that drive to the new drive letter in **under 50 milliseconds**.
  * **Result**: Zero manual intervention — drives always show **🟢 Connected** no matter what letter Windows assigns.

---

## 🖼️ 2. Ghost Vault Visual Micro-Thumbnails (Near-Zero Local Footprint)

### The Problem
Currently, Data Search catalogs file names, durations, resolutions, event codes, and sizes with extreme speed. However, when hard drives are stored offline in cupboards or drawers, editors cannot visually preview clip contents without plugging the drive in.

### Architectural Recommendation
* **10KB WebP Micro-Thumbnails**:
  * During the initial scan in `archive_scanner.py`, use `ffmpeg` / hardware-accelerated decode to extract a single representative frame at 10%–15% of each video clip.
  * Compress the frame to a WebP thumbnail (resolution: `320x180` at quality `50`, footprint: `~8KB - 12KB`).
  * Store thumbnails in a centralized cache directory (`%APPDATA%/One Tap/vault_thumbnails/<archive_id>/<file_stem>.webp`).
* **Instant Visual Hover Preview**:
  * In the Data Search media table, hovering over any clip displays an instant visual tooltip thumbnail even when the 16TB hard drive is 1,000 miles away.
  * For 50,000 video clips, total disk footprint is only `~400MB` — negligible on modern workstation SSDs.

---

## 💽 3. Multi-Drive Replication & Mirror Tracking (Primary vs. Cold Archive)

### The Problem
Production studios maintain duplicate copies of Safar media across multiple physical drives (e.g. Drive A: Working Field SSD, Drive B: Studio Master HDD, Drive C: Off-site Cold Storage). Editors need to know which drives have which Safars and whether backups are complete.

### Architectural Recommendation
* **Drive Pairing & Redundancy Matrix**:
  * In the **Hard Drive Tracker** tab (`drive_volumes`), allow assigning a drive role:
    * `primary`: Active editing drive
    * `mirror`: Local backup replica
    * `cold_storage`: Deep archive vault
  * Cross-reference cataloged Safars across drives to identify:
    * ✅ **Fully Replicated Safars**: Stored on 2+ distinct drives.
    * ⚠️ **At-Risk Safars**: Stored on only 1 drive with no mirror detected.
* **1-Click Bulk Drive Letter Migration**:
  * Allow editors to select a drive volume and remap all associated Safars from one drive letter to another in one bulk operation.

---

## 🤖 4. Local AI & Semantic Query Engine (Ollama / Natural Language)

### The Problem
Users often search using natural queries like:
- *"Show me all QMZ clips longer than 15 minutes in Mumbai"*
- *"Find clips from 1447 where rendering is complete but upload is pending"*
- *"List all Nikah ceremonies from day 2"*

Currently, users must manually toggle 4–5 individual dropdowns, filters, and duration sliders.

### Architectural Recommendation
* **Natural Language to SQL Parser via Local LLM**:
  * Leverage the workstation's built-in Ollama IPC bridge (`ollama.ipc.ts` with models like `qwen2.5-coder` or `llama3.2`).
  * Pass user natural language prompts with the catalog database schema to generate a structured JSON query filter:
    ```json
    {
      "event_code": "QMZ",
      "city": "Mumbai",
      "min_duration": 900,
      "upload_status": "rendered_pending"
    }
    ```
  * Execute directly against SQLite covering indexes with sub-millisecond response times.
* **Bilingual Event Synonym Dictionary**:
  * Built-in dictionary recognizing both Arabic/Lisan al-Dawat terminology and English equivalents (e.g. *Majlis*, *Bethak*, *Ziyafat*, *Qadam*, *Waaz*, *Misaq*, *Nikah*).

---

## 🎬 5. Direct Premiere Pro Timeline Bridge (`.prproj` & EDL Exporter)

### The Problem
When editors find 15 relevant clips across different days or Safars in Data Search, they currently have to locate each file in Explorer, drag it into Premiere Pro, create a sequence, and order them manually.

### Architectural Recommendation
* **"Send to Premiere Pro Timeline" Button**:
  * Select any set of clips from search results -> Click **"🎬 Create Premiere Sequence"**.
  * Use the existing `PrprojGenerator` XML engine to generate an immediate `.prproj` file with:
    * All selected clips arranged sequentially on Timeline Track `V1`.
    * In/Out markers pre-set.
    * Automatic offline media linking so Premiere automatically relinks as soon as the drive is plugged in.
* **FCPXML / DaVinci Resolve EDL Export**:
  * Export standard `.edl` or `.fcpxml` timelines for color grading or external editing suites.

---

## 📊 6. Automated Excel Reconciliation Correction Engine ("1-Click Fix")

### The Problem
The Excel Reconciler accurately highlights:
- `EXACT`: File matched both date folder and filename.
- `SHIFTED`: File found with date or naming variation.
- `MISSING`: File listed in Excel but missing in archive.

However, after viewing discrepancies, editors must manually rename files or edit Excel cells by hand.

### Architectural Recommendation
* **"Auto-Fix & Align Discrepancies" Button**:
  * When a `SHIFTED` record has high confidence (> 85%), provide an **"Apply File Rename"** button to automatically align the disk filename to the canonical Excel format, or vice versa.
* **Direct Excel Export with Annotated Discrepancy Column**:
  * Generate an annotated Excel sheet highlighting exact mismatches in red and resolved files in green, ready for immediate team submission to AlJamea / audit departments.

---

## 🛡️ 7. Silent Bit-Rot & Media Health Guardian (xxHash64 Integrity Check)

### The Problem
Hard drives sitting in storage for 2–5 years can suffer from magnetic degradation, bad sectors, or corrupted file headers without throwing filesystem errors.

### Architectural Recommendation
* **Background Integrity Verification Daemon**:
  * When a hard drive is left connected, One Tap runs a low-priority background worker calculating fast non-cryptographic checksums (**xxHash64** at > 3GB/s).
  * Stores checksums in `media_items.checksum_hash`.
  * Periodically re-reads file headers to verify data integrity and immediately warns the studio if bit rot or sector corruption is detected before data is lost.

---

## ☁️ 8. Portable Studio Catalog Snapshot (`.onetap-catalog` Sync)

### The Problem
Directors and team leads frequently need to search the studio's media archives while traveling or off-site, but they do not carry 50TB of external hard drives with them.

### Architectural Recommendation
* **Export Portable Compressed Catalog Snapshot**:
  * Export a compact, read-only `.onetap-catalog` file (compressed SQLite snapshot without media files, `< 5MB` for 100,000 clips).
  * Can be synced automatically to Google Drive or shared via Slack/WhatsApp.
  * Any team member running One Tap can open the catalog in "Director Mode", search clips, verify shot counts, generate Excel manifests, and plan edits completely offline.

---

## 🚀 Summary Matrix of Recommendations

| Priority | Feature Recommendation | Value to Studio | Technical Effort |
| :--- | :--- | :--- | :--- |
| **P0** | **Safar Drive Name & Letter Reassignment** | Immediate fix when drive letters shift or media is moved | Implemented |
| **P1** | **Zero-Config Dynamic Drive Remounting** | Automatically resolves drive letter shifts via UUID | Medium |
| **P1** | **10KB WebP Ghost Micro-Thumbnails** | Visual search across offline drives in storage | Medium |
| **P2** | **Direct Premiere Pro Sequence Exporter** | Instant editing from search results | Low (re-uses generator) |
| **P2** | **1-Click Excel Reconciliation Auto-Fix** | Automatically resolves audit mismatches | Medium |
| **P3** | **Natural Language Search via Local LLM** | Search via plain speech/text in English & Arabic | Low (uses Ollama bridge) |
| **P3** | **xxHash64 Silent Bit-Rot Auditing** | Guarantees long-term data preservation | Medium |
| **P3** | **Portable `.onetap-catalog` Sync** | Off-site archive search for directors | Low |
