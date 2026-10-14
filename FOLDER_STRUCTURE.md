# Folder Structure Specification & AI Guide: `1448-03 Mumbai`

This document provides a comprehensive structural guide for AI assistants and automated tools (Task Tracker, Data Vault, Stats, and Archive Catalog) to understand the filesystem layout, naming conventions, metadata tokens, and lifecycle states of the Safar folder **`F:\In Process\1448-03 Mumbai`**.

---

## 1. High-Level Hierarchy Overview

```text
F:\In Process\                                    <-- Active Workstation Container Root
│
└── 1448-03 Mumbai\                               <-- Safar Main Folder (Year-Serial City)
    │
    ├── Final\                                    <-- Central Export / Render Directory
    │   ├── 1448-03-11 _01M\                      <-- Matching Session Export Folder
    │   │   ├── 001 03-11 _01M-01-01AQ-60416020.mp4
    │   │   └── 001 03-11 _01M-01-01AQ-60416020_V.jpg
    │   ├── 1448-03-12 _01M\
    │   ├── 1448-03-12 _02E\
    │   └── ...
    │
    ├── 1448-03-11 _01M\                          <-- Date / Session Work Folder
    ├── 1448-03-12 _01M\
    ├── 1448-03-12 _02E\
    ├── 1448-03-13 _01M\
    │   ├── 1448-03-13 _01M.prproj                <-- Adobe Premiere Pro Project File
    │   ├── 1448-03-13 _01M.xml                   <-- Timeline Interchange XML
    │   ├── 1448-03-13 _01M.prin                  <-- Project Indicator / Cache
    │   ├── Sequence_Summary_Report_*.xlsx        <-- Sequence Summary Excel
    │   │
    │   ├── Adobe Premiere Pro Auto-Save\         <-- Premiere Auto-Save Backups
    │   │   └── 1448-03-13 _01M--*.prproj
    │   │
    │   ├── Contributor\                          <-- Multi-Camera Ingest Folders
    │   │   ├── Cam 01\
    │   │   ├── Cam 02\
    │   │   └── Cam 03\
    │   │
    │   ├── Document\                             <-- Session Metadata, Logs & Reports
    │   │   ├── 1448-03-13 _01M.csv               <-- Session Item Breakdown CSV
    │   │   ├── transfer_log.txt                  <-- Ingest/Transfer Audit Log
    │   │   └── 1448-03-13 _01M_Inventory_Report.xlsx
    │   │
    │   ├── DVD\                                  <-- Distribution / DVD Cut MP4 Files
    │   │   └── 1448-03-13 _01M-02-01AQ-30338708.mp4
    │   │
    │   ├── 01-Mumbai-Bethak\                     <-- Event Category Folder
    │   │   ├── 1448-03-13 _01M-01-TNQ-50458093\  <-- Individual Item Folder
    │   │   ├── 1448-03-13 _01M-02-01AQ-30338708\
    │   │   │   └── Mulla Murtaza bhai Shaikh Juzer bhai Sounasath\ <-- Person Name Folder
    │   │   │       ├── C0001.MP4                 <-- Raw Camera Footage
    │   │   │       ├── C0002.MP4
    │   │   │       └── photo1.jpg                <-- Still Photography
    │   │   ├── 1448-03-13 _01M-05-H-\            <-- Item Without ITS (e.g. Hadiyah)
    │   │   └── ...
    │   │
    │   ├── 02-Mumbai-Waaz\                       <-- Event Category: Waaz Mubarak
    │   ├── 03-Mumbai-Namaz\                      <-- Event Category: Namaz
    │   └── 04-Mumbai-Ziyarat\                    <-- Event Category: Ziyarat
    │
    └── ...
```

---

## 2. Naming Conventions & Regex Breakdown

### 2.1 Safar Folder Level
* **Syntax**: `[HijriYear]-[SafarSerial] [CityName]` (optional suffix like `- Urs Mubarak`)
* **Regex**: `^(\d{4})[-_](\d{2})\s+([A-Za-z\s]+)(?:-(.*))?$`
* **Examples**:
  * `1448-03 Mumbai` -> Year `1448`, Safar `03`, City `Mumbai`
  * `1448-02 Raipur` -> Year `1448`, Safar `02`, City `Raipur`
  * `1448-07 Mumbai - Urs Mubarak` -> Year `1448`, Safar `07`, City `Mumbai`, Event `Urs Mubarak`
  * `1448-10-Istefada ilmiyah` -> Year `1448`, Safar `10`, Event `Istefada ilmiyah`, City `Surat` (Dumas coastal residence & Surat)
    *(See `E:\In Process\1448-10-Istefada ilmiyah\FOLDER_STRUCTURE.md` and `folder_structure.json` for full 29-session breakdown)*

### 2.2 Date / Session Folder Level
* **Syntax**: `[HijriDate] _[SessionIndex][SessionPeriod]`
* **Regex**: `^(\d{4}[-_]\d{2}[-_]\d{2})\s+_(\d{2})([ME])$`
* **Tokens**:
  * `1448-03-13`: Hijri Year 1448, Month 03 (Rabi al-Awwal), Day 13
  * `_01M`: Session `01`, `M` = Morning / Maghrib
  * `_02E`: Session `02`, `E` = Evening

### 2.3 Event Category Folder Level
* **Syntax**: `[Index]-[City]-[EventType]`
* **Examples**:
  * `01-Mumbai-Bethak`
  * `02-Mumbai-Waaz`
  * `03-Mumbai-Namaz`
  * `04-Mumbai-Ziyarat`

### 2.4 Individual Item Folder Level
* **Syntax**: `[Date_Session]-[ItemNumber]-[EventOccurrence][EventCode]-[ITS_ID]`
* **Regex**: `^(\d{4}-\d{2}-\d{2}\s+_\d{2}[ME])-(\d{2})-(?:(\d{2})?([A-Z]+))-(?:(\d{5,8}))?$`
* **Examples**:
  * `1448-03-13 _01M-02-01AQ-30338708`
    * Date & Session: `1448-03-13 _01M`
    * Item Index: `02`
    * Occurrence: `01` (First of this event in this session)
    * Event Code: `AQ` (Aqueeqah)
    * ITS ID: `30338708` (8-digit Dawat ITS number)
  * `1448-03-13 _01M-18-01N-50423626`
    * Event: `01N` (1st Nikah), ITS: `50423626`
  * `1448-03-13 _01M-34-04MZ-30446024`
    * Event: `04MZ` (4th Misaq Zukoor), ITS: `30446024`
  * `1448-03-13 _01M-05-H-`
    * Event: `H` (Hadiyah), No ITS ID associated

### 2.5 Person Name Subfolder & Media Assets
* Immediately beneath the item folder is the person's full name directory:
  * e.g., `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath\`
* Raw media files sit directly within this folder:
  * Camera files: `C0001.MP4`, `C0002.MP4`, `C0003.MP4`, etc.
  * Still photographs: `photo1.jpg`, `photo2.jpg`, etc.



---

## 4. Lifecycle & Pipeline Status Mapping

The application monitors three root drives/directories:
1. **`F:\In Process\`**: Production workspace (where editing happens)
2. **`F:\To Upload\`**: Rendered packages ready for or during server transfer
3. **`F:\To Delete\` / Archive**: Completed, verified, and submitted safars

### Automated Status Logic for Date Folders:

| Status Code | Display Label | Conditions |
|:---|:---|:---|
| `editing_pending` | Pending | No `.prproj` file exists yet in the date folder. |
| `editing` | In Editing | `.prproj` exists and `mtime` (last modified) is `< 48 hours`. |
| `review` | Review | `.prproj` exists and `mtime` is `>= 48 hours` (edits complete, waiting for final review/render). |
| `upload_pending` | Rendered / Upload Pending | Subfolder with matching date name exists in `F:\In Process\1448-03 Mumbai\Final\`. |
| `uploaded` | Uploaded | Matching date folder exists in `F:\To Upload\1448-03 Mumbai\`. |
| `submitted` | Submitted / Archived | Matching date folder exists in `F:\To Delete\1448-03 Mumbai\`. |

*Note: A Safar is only marked **Done (Completed)** when 100% of its date folders are in `uploaded` or `submitted` status.*

---

## 5. Instructions for AI Models

When analyzing files, performing searches, or debugging logic related to this folder:
1. **Ignore Virtual Folders**: Do not treat `Final\` or `New folder` as date/session folders.
2. **Numeric ITS Search**: Any 5 to 8 digit integer query (e.g. `40490` or `30338708`) should be matched against the ITS token at the tail of item folder names or inside Excel inventory reports.
3. **Event Code Extraction**: Extract the 1-3 letter event code immediately preceding the ITS token (or trailing dash) in the item folder name.
4. **Session Identifier**: The canonical session ID is always formatted as `YYYY-MM-DD _SS[M|E]` (note the exact space and underscore).
