# Folder Structure Specification & AI Guide: `1448-10-Istefada ilmiyah`

This document provides a comprehensive structural guide and metadata reference for AI assistants and automated tools (Task Tracker, Data Vault, Stats DB, and Archive Catalog) to understand the filesystem layout, naming conventions, metadata tokens, and lifecycle states of the Safar folder **`E:\In Process\1448-10-Istefada ilmiyah`**.

---

## 1. High-Level Hierarchy Overview

```text
E:\In Process\                                    <-- Active Workstation Container Root
│
└── 1448-10-Istefada ilmiyah\                       <-- Safar Main Folder (Year-Serial SafarName)
    │
    ├── FOLDER_STRUCTURE.md                       <-- This Architecture & AI Guide
    ├── FOLDER_NAMING_SAMPLES.md                  <-- Prefix Folder Samples (Q, N, Z, M, ZO, MZ...)
    ├── folder_structure.json                     <-- Machine-readable Full JSON Schema
    ├── prefix_folder_samples.json                <-- Machine-readable Prefix Folder Name Samples
    ├── safar_info.json                           <-- Canonical Safar Metadata Manifest
    │
    ├── Final\                                    <-- Central Export / Render Directory (439 MP4s)
    │   ├── 1448-04-05 _02E\                      <-- Matching Session Export Folder (68 MP4s)
    │   │   ├── 1448-04-05 _02E-03-22ZO-30444199.mp4
    │   │   ├── 1448-04-05 _02E-16-01N-50473950.mp4
    │   │   └── ...
    │   ├── 1448-04-06 _01M\                      <-- Matching Session Export Folder
    │   ├── 1448-04-06 _02E\
    │   └── ... (29 session export folders)
    │
    ├── 1448-04-05 _02E\                          <-- Date / Session Work Folder (Session 02 Evening)
    │   ├── 1448-04-05 _02E.prproj                <-- Adobe Premiere Pro Project File
    │   ├── 1448-04-05 _02E.xml                   <-- Timeline Interchange XML
    │   ├── 1448-04-05 _02E.prin                  <-- Project Indicator / Cache
    │   ├── Sequence_Summary_Report_*.xlsx        <-- Sequence Summary Excel Report
    │   ├── 1448-04-05 _02E Masks\                 <-- Title / Motion Graphic Masks
    │   │
    │   ├── Adobe Premiere Pro Auto-Save\         <-- Premiere Auto-Save Backups
    │   │   └── 1448-04-05 _02E--*.prproj
    │   │
    │   ├── Contributor\                          <-- Multi-Camera Ingest Folders
    │   │   ├── Cam 01\
    │   │   └── Cam 02\
    │   │       ├── C0007.MP4
    │   │       └── ...
    │   │
    │   ├── Document\                             <-- Session Metadata, Logs & Reports
    │   │   ├── 1448-04-05 _02E.csv               <-- Session Item Breakdown CSV
    │   │   ├── transfer_log.txt                  <-- Ingest/Transfer Audit Log
    │   │   └── 1448-04-05 _02E_Inventory_Report.xlsx
    │   │
    │   ├── DVD\                                  <-- Distribution / DVD Cut MP4 Files
    │   │
    │   └── 01-Dummas-Bethak\                     <-- Event Category Folder (83 Items)
    │       ├── 1448-04-05 _02E-01-24ZO-40469759\  <-- Individual Item Folder
    │       ├── 1448-04-05 _02E-03-22ZO-30444199\
    │       │   └── Mulla Murtaza bhai Shaikh...\   <-- Person Name Subfolder
    │       │       ├── C0001.MP4                 <-- Raw Camera Footage
    │       │       ├── C0002.MP4
    │       │       └── C0003.MP4
    │       ├── 1448-04-05 _02E-05-H-\            <-- Item Without ITS (Hadiyah)
    │       ├── 1448-04-05 _02E-15-MF-\           <-- Item Without ITS (Mafsuhiyat)
    │       └── 1448-04-05 _02E-16-01N-50473950\  <-- Item with ITS (Nikaah)
    │
    ├── 1448-04-06 _01M\                          <-- Next Session Work Folder
    └── ... (29 session folders total: 1448-04-05 _02E to 1448-04-20 _02E)
```

---

## 2. Naming Conventions & Regex Breakdown

### 2.1 Safar Folder Level
* **Syntax**: `[HijriYear]-[SafarSerial]-[SafarName]` (or `[HijriYear]-[SafarSerial] [CityName]`)
* **Value**: `1448-10-Istefada ilmiyah`
* **Parsed Metadata**:
  * **Hijri Year**: `1448`
  * **Safar Serial**: `10`
  * **Event / Title**: `Istefada ilmiyah`
  * **Canonical City**: `Surat`
  * **Sub-Location**: `Dumas` (coastal suburb where Dumas Bethak was held)
* **Regex**: `^(\d{4})[-_](\d{2})[-_\s]+(.*)$`

### 2.2 Date / Session Folder Level
* **Syntax**: `[HijriDate] _[SessionIndex][SessionPeriod]`
* **Regex**: `^(\d{4}[-_]\d{2}[-_]\d{2})\s+_(\d{2})([ME])$`
* **Tokens**:
  * `1448-04-05`: Hijri Year 1448, Month 04 (Rabi al-Akhar), Day 05
  * `_01M`: Session `01`, `M` = Morning / Maghrib
  * `_02E`: Session `02`, `E` = Evening
* **Range**: Starts `1448-04-05 _02E` and completes on `1448-04-20 _02E` (29 sessions).

### 2.3 Event Category Folder Level
* **Syntax**: `[Index]-[Location]-[EventType]`
* **Active Categories in this Safar**:
  * `01-Dummas-Bethak`: Dumas coastal residence Bethak sessions (15 sessions)
  * `01-Surat-Bethak` / `03-Surat-Bethak`: Surat central Bethak sessions (12 sessions)
  * `01-Surat-Namaz`, `02-Surat-Namaz`, `03-Surat-Namaz`, `05-Surat-Namaz`: Daily prayers (7 sessions)
  * `01-Surat-QMZ`, `02-Surat-QMZ`, `03-Surat-QMZ`, `04-Surat-QMZ`: Qadam Majlis Ziyafat (9 sessions)
  * `02-Surat-Ziyarat`, `03-Surat-Ziyarat`, `04-Surat-Ziyarat`: Mazar-e-Qutbi & holy tombs ziyarat (7 sessions)

### 2.4 Individual Item Folder Level
* **Syntax**: `[Date_Session]-[ItemNumber]-[EventOccurrence][EventCode]-[ITS_ID]`
* **Regex**: `^(\d{4}-\d{2}-\d{2}\s+_\d{2}[ME])-(\d{2})-(?:(\d{2})?([A-Z]+))-(?:(\d{5,8}))?$`
* **Examples**:
  * `1448-04-05 _02E-01-24ZO-40469759`
    * Date & Session: `1448-04-05 _02E`
    * Item Index: `01`
    * Occurrence: `24`
    * Event Code: `ZO` (Zafaf Olda / Zafaf)
    * ITS ID: `40469759`
  * `1448-04-05 _02E-16-01N-50473950`
    * Event: `01N` (1st Nikah), ITS: `50473950`
  * `1448-04-05 _02E-21-09MZ-20361245`
    * Event: `09MZ` (9th Majmui Ziyafat), ITS: `20361245`
  * `1448-04-05 _02E-05-H-`
    * Event: `H` (Hadiyah), No ITS ID
  * `1448-04-05 _02E-15-MF-`
    * Event: `MF` (Mafsuhiyat), No ITS ID

### 2.5 Person Name Subfolder & Media Assets
* Beneath the item folder is the attendee full name directory:
  * e.g., `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath\`
* Raw camera clips are stored inside:
  * `C0001.MP4`, `C0002.MP4`, `C0003.MP4`, etc.

### 2.6 Final Exported Videos
* **Syntax**: `[Date_Session]-[ItemNumber]-[EventOccurrence][EventCode]-[ITS_ID].mp4`
* Located directly inside `Final\[SessionFolder]\`
* Total rendered files: **439 MP4 videos**

---

## 3. Complete 29 Sessions Inventory & Pipeline Metrics

| Session Folder | Period | Primary Categories | Item Folders | Final MP4s | Premiere Project |
|:---|:---:|:---|:---:|:---:|:---|
| `1448-04-05 _02E` | E (Evening) | 01-Dummas-Bethak | 83 | 68 | `1448-04-05 _02E.prproj` |
| `1448-04-06 _01M` | M (Morning) | 01-Dummas-Bethak | 2 | 2 | `1448-04-06 _01M.prproj` |
| `1448-04-06 _02E` | E (Evening) | 01-Dummas-Bethak | 16 | 14 | `1448-04-06 _02E.prproj` |
| `1448-04-07 _01M` | M (Morning) | 01-Surat-Bethak, 02-Surat-Ziyara... | 7 | 5 | `1448-04-07 _01M.prproj` |
| `1448-04-07 _02E` | E (Evening) | 01-Dummas-Bethak | 16 | 15 | `1448-04-07 _02E.prproj` |
| `1448-04-08 _02E` | E (Evening) | 01-Dummas-Bethak | 114 | 14 | `1448-04-08 _02E.prproj` |
| `1448-04-09 _01M` | M (Morning) | 01-Dummas-Bethak | 3 | 3 | `1448-04-09 _01M.prproj` |
| `1448-04-09 _02E` | E (Evening) | 01-Dummas-Bethak | 13 | 10 | `1448-04-09 _02E.prproj` |
| `1448-04-10 _01M` | M (Morning) | 01-Dummas-Bethak | 3 | 3 | `1448-04-10 _01M.prproj` |
| `1448-04-10 _02E` | E (Evening) | 01-Dummas-Bethak | 24 | 21 | `1448-04-10 _02E.prproj` |
| `1448-04-11 _01M` | M (Morning) | 01-Dummas-Bethak | 3 | 3 | `1448-04-11 _01M.prproj` |
| `1448-04-11 _02E` | E (Evening) | 01-Dummas-Bethak | 23 | 21 | `1448-04-11 _02E.prproj` |
| `1448-04-12 _01M` | M (Morning) | 01-Dummas-Bethak | 4 | 4 | `1448-04-12 _01M.prproj` |
| `1448-04-12 _02E` | E (Evening) | 01-Dummas-Bethak | 132 | 70 | `1448-04-12 _02E.prproj` |
| `1448-04-13 _01M` | M (Morning) | 01-Dummas-Bethak | 6 | 6 | `1448-04-13 _01M.prproj` |
| `1448-04-13 _02E` | E (Evening) | 01-Dummas-Bethak | 26 | 21 | `1448-04-13 _02E.prproj` |
| `1448-04-14 _01M` | M (Morning) | 01-Surat-Bethak, 02-Surat-QMZ, 0... | 16 | 9 | `1448-04-14 _01M.prproj` |
| `1448-04-14 _02E` | E (Evening) | 01-Surat-Bethak | 13 | 11 | `1448-04-14 _02E.prproj` |
| `1448-04-15 _01M` | M (Morning) | 01-Surat-Bethak, 02-Surat-QMZ | 18 | 18 | `1448-04-15 _01M.prproj` |
| `1448-04-15 _02E` | E (Evening) | 01-Surat-Bethak | 13 | 12 | `1448-04-15 _02E.prproj` |
| `1448-04-16 _01M` | M (Morning) | 01-Surat-Namaz, 02-Surat-Ziyarat... | 16 | 12 | `1448-04-16 _01M.prproj` |
| `1448-04-16 _02E` | E (Evening) | 01-Surat-Bethak | 13 | 11 | `1448-04-16 _02E.prproj` |
| `1448-04-17 _01M` | M (Morning) | 01-Surat-Namaz, 02-Surat-Ziyarat... | 19 | 16 | `1448-04-17 _01M.prproj` |
| `1448-04-17 _02E` | E (Evening) | 01-Surat-Bethak | 15 | 11 | `1448-04-17 _02E.prproj` |
| `1448-04-18 _01M` | M (Morning) | 01-Surat-QMZ | 21 | 21 | `1448-04-18 _01M.prproj` |
| `1448-04-18 _02E` | E (Evening) | 01-Surat-Bethak, 02-Surat-QMZ | 11 | 10 | `1448-04-18 _02E.prproj` |
| `1448-04-19 _01M` | M (Morning) | 01-Surat-Namaz, 02-Surat-Ziyarat... | 88 | 26 | `1448-04-19 _01M.prproj` |
| `1448-04-19 _02E` | E (Evening) | 01-Surat-Bethak, 02-Surat-Namaz,... | 3 | 1 | `1448-04-19 _02E.prproj` |
| `1448-04-20 _02E` | E (Evening) | 02-Surat-Namaz, 03-Surat-QMZ, 04... | 3 | 1 | `1448-04-20 _02E.prproj` |

**Totals**: **29 Sessions** | **724 Item Folders** | **439 Rendered MP4 Exports** | **14 Distinct Categories**

---

## 4. Event Code Distribution & Canonical Definitions

| Event Code | Description | Item Count | Status |
|:---|:---|:---:|:---|
| **`MF`** | Mafsuhiyat | 142 | Active |
| **`N`** | Nikaah | 136 | Active |
| **`ZO`** | Zafaf Olda / Zafaf | 129 | Active |
| **`H`** | Hadiyah | 91 | Active |
| **`MZ`** | Majmui Ziyafat | 49 | Active |
| **`Q`** | Qadam | 38 | Active |
| **`AQ`** | Aqueeqah | 21 | Active |
| **`Z`** | Ziyafat / Ziyarat | 20 | Active |
| **`M`** | Majlis | 8 | Active |
| **`BZ`** | Bethak Ziyafat | 2 | Active |
| **`BM`** | Bethak Majlis | 1 | Active |

---

## 5. Lifecycle & Pipeline Status Mapping

The application monitors three root drives/directories:
1. **`E:\In Process\`**: Production workspace (where editing happens)
2. **`E:\To Upload\`**: Rendered packages ready for or during server transfer
3. **`E:\To Delete\` / Archive**: Completed, verified, and submitted safars

### Automated Status Logic for Date Folders:

| Status Code | Display Label | Conditions |
|:---|:---|:---|
| `editing_pending` | Pending | No `.prproj` file exists yet in the date folder. |
| `editing` | In Editing | `.prproj` exists and `mtime` (last modified) is `< 48 hours`. |
| `review` | Review | `.prproj` exists and `mtime` is `>= 48 hours` (edits complete, waiting for final review/render). |
| `upload_pending` | Rendered / Upload Pending | Subfolder with matching date name exists in `Final\` with rendered MP4s. |
| `uploaded` | Uploaded | Matching date folder exists in `To Upload\1448-10-Istefada ilmiyah\`. |
| `submitted` | Submitted / Archived | Matching date folder exists in `To Delete\1448-10-Istefada ilmiyah\`. |

*Note: A Safar is marked **Done (Completed)** when 100% of its date folders are in `uploaded` or `submitted` status.*

---

## 6. Instructions for AI Models and Workstation Engine

1. **Folder Identity**: Always recognize `1448-10-Istefada ilmiyah` as **Safar 10 (Year 1448)**, City: **Surat** (with Dumas coastal location).
2. **Config Schema**: Read `folder_structure.json` or `safar_info.json` directly from this directory to obtain instant accurate metadata without traversing subtrees.
3. **Ignore Virtual Folders**: Do not treat `Final\`, `New folder`, or temporary cache folders as date/session folders.
4. **Numeric ITS Search**: Any 5 to 8 digit integer query should be matched against the ITS token at the tail of item folder names, final MP4 names, or inside Excel reports.
5. **Event Code Extraction**: Extract the event code immediately preceding the ITS token (or trailing dash) in the item folder name (e.g., `MF`, `N`, `ZO`, `H`, `MZ`, `Q`, `AQ`, `Z`).
6. **Session Matching**: To correlate stats or renders between `E:\In Process\1448-10-Istefada ilmiyah` and `Final\`, match the exact session folder name `YYYY-MM-DD _SS[M|E]`.
