# UniDesk - Match Video & Photo Transfer (Google Apps Script Web App)

An automated Google Apps Script Web App featuring interactive Google Drive folder browsing, live folder search, single master event board mode, multi-tier sequence and camera shot code matching (`001 Q01.mp4` ↔ `001 Q01` photo folder), mismatch resolution tools, automated Google Drive video copying, and **Google Sheets Audit Logging**.

---

## ✨ Key Features & Capabilities

1. **🟢 Google Sheets Audit Logging (Backend Configured)**:
   * Provides a clean audit report spreadsheet for clients and team members.
   * Paste your Master Google Sheet URL/ID directly into `MASTER_AUDIT_SHEET_URL` in `Code.gs`.
   * All video transfer operations automatically append audit log entries to this same master sheet.
   * Includes 1-click **"Open Google Sheet Audit Report"** direct link button upon completion.
   * Logged Columns: Timestamp, Date Subfolder, Video File Name, Video File ID, Target Photo Folder Name, Target Folder ID, File Size (MB), Direct Drive Video Link, and Transfer Status (`COPIED SUCCESS`).

2. **🌟 Single Master Board Mode**:
   * Select 1 Master Event Folder (e.g. `Event Master 2026`).
   * Structure detected:
     * `Videos` (or `Video` / `Raw Video`): Date subfolders containing named video clips (`001 Q01.mp4`).
     * `Photos` (or `Photo` / `Photo Folders` / `Events`): Date subfolders containing event/photo target subfolders (`001 Q01`).
   * Automatically pairs video clips into their corresponding event photo folders across matching date subdirectories.

3. **🎯 Shot Code & Sequence Matching**:
   * Uses dual-tier camera shot code matching matching the desktop app engine:
     * **Tier 1 (Shot Code)**: Extracts core camera shot codes (e.g. `001 Z01.mp4` shot code `z01` pairs with photo folder `005 Z01` shot code `z01`).
     * **Tier 2 (Clean Name)**: Normalized name key matching.

4. **📁 Interactive Drive Folder Browser & Live Search**:
   * **Browse My Google Drive**: Modal folder browser with 1-click subfolder navigation.
   * **Live Autocomplete Search**: Search Drive folders by name in real-time.
   * **Recent Folder Quick Chips**: 1-tap presets for your recent Drive folders.

5. **💎 Modern Glassmorphism UI & Exporters**:
   * Dark & Light glassmorphism themes, confetti celebrations, drag-and-drop mismatch remapping, CSV export, and TXT log export.

---

## 🚀 How to Deploy to Google Apps Script

1. Open Google Apps Script: [script.google.com](https://script.google.com).
2. Create a new project named **UniDesk - Video & Photo Match Transfer**.
3. Copy the contents of [`Code.gs`](file:///d:/ON_GOING%20PROJECT_23_07/One%20Tap_V20.6.5/Match%20Video%20Photo_Appscript/Code.gs) into `Code.gs` in the Apps Script editor.
4. Add an HTML file named `Index` and paste the contents of [`Index.html`](file:///d:/ON_GOING%20PROJECT_23_07/One%20Tap_V20.6.5/Match%20Video%20Photo_Appscript/Index.html).
5. Click **Deploy** -> **New deployment**.
6. Select type: **Web App**.
7. Execute as: **Me**.
8. Who has access: **Anyone** (or specified users in your domain).
9. Click **Deploy** and copy the Web App URL!
