# Anything File Manager (AFM) — Architecture Specification & Master Prompt

> **System Suite**: Anything Production Ecosystem  
> **Target Module / Application**: Personalized Video Production File Manager & Workspace Navigator  
> **Inter-App Compatibility**: Interoperates with One Tap, Task Tracker, Title Adder, DriveSync, and Premiere Pro.

---

## 1. Executive Summary & Vision

The **Anything File Manager (AFM)** is a domain-specific, high-performance desktop file manager and production asset navigator built specifically for high-throughput video production teams, event documentation units, and Safar video pipelines.

Unlike generic OS explorers (Windows Explorer or macOS Finder) which treat folders as plain directories, AFM understands:
- **Semantic Production Hierarchies** (Master Safar vs. Date/Session vs. Slot/Item vs. Person).
- **Hijri & Gregorian Naming Conventions** (`1448-03 Mumbai`, `1448-03-13 _01M`, `1448-05-07_01M-01-01N-40905764`).
- **Media Asset Metrics**: Instant recursive video clip counting and cumulative duration calculation ($\sum \text{duration}$) without loading full media files.
- **Workflow Lifecycle Tracking**: Color-coded badges for Stage 1 (Ingest), Stage 2 (Synced), In Editing, Review, Rendered, Uploaded, Backed Up.
- **Dynamic Premiere Pro Project (`.prproj` / Sequence XML) Generation**: Detects target folder scope (Date vs. Master), confirms sequence settings via pre-flight verification, and creates properly structured project files.

---

## 2. Structural Hierarchy & Pattern Taxonomy

The engine continuously classifies folders into 5 hierarchical levels:

```text
[Level 0] Workstation Container Root:  F:\In Process\
    │
    └── [Level 1] Master Safar Folder: 1448-03 Mumbai\
            │
            ├── Final\ (Export / Delivery Mirror)
            │   └── 1448-03-13 _01M\
            │       ├── 001 03-13 _01M-01-01AQ-60416020.mp4
            │       └── 001 03-13 _01M-01-01AQ-60416020_V.jpg
            │
            └── [Level 2] Date / Session Work Folder: 1448-03-13 _01M\
                    ├── 1448-03-13 _01M.prproj            <-- Adobe Premiere Pro Project
                    ├── 1448-03-13 _01M.xml               <-- Final Cut Pro / Premiere XML
                    ├── Document\                         <-- Inventory & Transfer Logs
                    ├── DVD\                              <-- Intermediate MP4 distribution cuts
                    │
                    ├── [Level 3] Event Category Folder: 01-Mumbai-Bethak\ (Optional Grouping)
                    │       │
                    │       └── [Level 4] Slot Folder: 1448-03-13 _01M-02-01AQ-30338708\
                    │               │
                    │               └── [Level 5] Person Name Folder: Mulla Murtaza...\
                    │                       ├── C0001.MP4
                    │                       ├── C0002.MP4
                    │                       └── photo1.jpg
                    │
                    └── [Level 4] Direct Slot Folder: 1448-05-07_01M-01-01N-40905764\
                            └── Person Name Folder\
                                    ├── C0001.MP4
                                    └── photo1.jpg
```

### 2.1 Regex Classifier Rules

| Hierarchy Level | Regex Pattern | Example Matches | Extracted Semantic Tokens |
|:---|:---|:---|:---|
| **Master Safar Folder** | `^(\d{4})[-_](\d{2})\s+([A-Za-z\s]+)(?:-(.*))?$` | `1448-03 Mumbai`<br>`1448-02 Raipur`<br>`1448-10-Istefada ilmiyah` | `hijriYear`: 1448<br>`safarSerial`: 03<br>`city`: Mumbai<br>`event`: Istefada |
| **Date / Session Work Folder** | `^(\d{4}[-_]\d{2}[-_]\d{2})\s*_(\d{2})([ME])$` | `1448-03-13 _01M`<br>`1448-05-07_01M`<br>`1448-03-12 _02E` | `date`: 1448-03-13<br>`sessionIndex`: 01<br>`sessionPeriod`: M (Morning/Maghrib) or E (Evening) |
| **Item / Slot Folder (Format A)** | `^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{2})-(?:(\d{2})?([A-Z]+))-(\d{5,8})$` | `1448-05-07_01M-01-01N-40905764`<br>`1448-03-13 _01M-02-01AQ-30338708` | `session`: 1448-05-07_01M<br>`slotNo`: 01<br>`occurrence`: 01<br>`eventCode`: N / AQ<br>`its`: 40905764 |
| **Item / Slot Folder (Format B - No ITS)** | `^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{2})-([A-Z]+)-?$` | `1448-03-13 _01M-05-H-`<br>`1448-03-13 _01M-08-SP-` | `eventCode`: H (Hadiyah) / SP<br>`its`: null |
| **Event Category Folder** | `^(\d{2})-([A-Za-z]+)-([A-Za-z\s]+)$` | `01-Mumbai-Bethak`<br>`02-Mumbai-Waaz` | `index`: 01<br>`city`: Mumbai<br>`eventType`: Bethak |

---

## 3. Dedicated Properties & Metrics Inspector Panel

When any folder is clicked or selected in the file tree, the inspector displays a specialized analytics sidebar:

```
┌─────────────────────────────────────────────────────────────────┐
│ 📁 PROPERTIES: 1448-03-13 _01M (Date Session Work Folder)       │
├─────────────────────────────────────────────────────────────────┤
│ 🏷️ WORKFLOW STAGE: [ Stage 2: Sync / MultiCam ▼ ]  [ In Editing ]│
├─────────────────────────────────────────────────────────────────┤
│ 📊 AGGREGATE SUMMARY                                            │
│ • Total Subfolders: 14 (12 Item Slots, 2 System Utility Dirs)   │
│ • Raw Video Files: 38 camera clips (.MP4 / .MOV)                │
│ • Still Photos: 24 photography captures (.JPG / .ARW)           │
│ • Total Storage Size: 48.62 GB (52,205,821,952 bytes)           │
│ • Cumulative Video Runtime: 02h 47m 18s (10,038.40 seconds)     │
├─────────────────────────────────────────────────────────────────┤
│ ⏱️ SLOT-BY-SLOT DURATION & ASSET BREAKDOWN                      │
│ ┌───────────────────────────┬────────┬───────────┬────────────┐ │
│ │ Slot Name                 │ Clips  │ Duration  │ Media Size │ │
│ ├───────────────────────────┼────────┼───────────┼────────────┤ │
│ │ 01-01AQ-50458093          │ 3 vids │ 14m 22s   │ 4.10 GB    │ │
│ │ 02-01AQ-30338708          │ 4 vids │ 21m 05s   │ 6.85 GB    │ │
│ │ 03-01N-40905764           │ 2 vids │ 08m 12s   │ 2.40 GB    │ │
│ │ 05-H- (Hadiyah / No ITS)  │ 1 vid  │ 05m 40s   │ 1.15 GB    │ │
│ └───────────────────────────┴────────┴───────────┴────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ 🎬 ADOBE PREMIERE PRO PROJECT GENERATOR                         │
│ Detected Scope: Date / Session Folder                           │
│ Target: 1448-03-13 _01M.prproj (Pending Creation)               │
│ [ ⚡ Pre-Flight & Generate Project File ]                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Behavior Based on Folder Type:
1. **Master Safar Folder Selected**:
   - Shows total count of valid Date folders (e.g. `7 Date Sessions`).
   - Counts total files and raw videos across all dates combined.
   - Shows cumulative video runtime for the entire Safar (e.g. `16h 42m 10s`).
   - Interactive table listing each Date folder with its item count, video count, runtime, and stage badge.
2. **Date / Session Folder Selected**:
   - Counts and categorizes slot folders (Format A vs. Format B).
   - Counts video clips within every slot folder (including inside sub-person directories).
   - Sums video playback duration using asynchronous, non-blocking media headers (MOOV atom parsing for MP4/MOV or FFprobe stream worker).
   - Lists each slot with its individual video count and total time.

---

## 4. Premiere Pro Project (`.prproj` / XML) Integration

The file manager provides one-click generation of Premiere Pro projects tailored to the selected folder scope:

### 4.1 Folder Scope Verification
- **Date Folder Selected**: Default project filename `[Date]_[Session].prproj` (e.g. `1448-03-13 _01M.prproj`).
- **Master Folder Selected**: Default project filename `[Year]-[Serial] [City]_Master.prproj` (e.g. `1448-03 Mumbai_Master.prproj`).

### 4.2 Pre-Flight Project Creation Modal
Before creating the project, a modal appears with:
- **Sequence Preset**: Resolution (`1920x1080` / `3840x2160`) & Framerate (`25.0 fps`, `50.0 fps`, `29.97 fps`).
- **Template Bin Structure**:
  - `01 ROUGH CUTS`
  - `02 AUDIO`
  - `03 TITLES & GRAPHICS`
  - `04 CAMERA FOOTAGE` (Organized by Date / Slot)
- **Timecode & Frame Synchronization**: Strict `<in>`, `<out>`, `<duration>` frame synchronization to eliminate trailing black frames.
- **Verification Buttons**: `Create Project (.prproj)`, `Generate XML Only`, `Cancel`.

---

## 5. Production Lifecycle Tags & Pipeline Status

AFM supports color-coded pipeline stages persisted in a lightweight `.afm_meta.json` in each directory:

| Tag Code | Badge Label | Color Code | Condition / Auto-Detection |
|:---|:---|:---|:---|
| `stage1` | **Stage 1: Raw Ingest** | `#3B82F6` (Blue) | Raw camera clips detected; no `.prproj` exists. |
| `stage2` | **Stage 2: Synced** | `#8B5CF6` (Purple) | Sequence XML or multicam sync created. |
| `editing` | **In Editing** | `#F59E0B` (Amber) | `.prproj` exists and was modified in the last 48 hours. |
| `review` | **Pending Review** | `#EC4899` (Pink) | Edits complete; awaiting supervisor check. |
| `rendered`| **Rendered** | `#10B981` (Emerald) | Final MP4 found in `Final\` export folder. |
| `uploaded`| **Uploaded** | `#06B6D4` (Cyan) | Verified on Google Drive / Cloud Portal. |
| `backedup`| **Backed Up** | `#64748B` (Slate) | Confirmed mirrored on secondary backup drive. |

---

## 6. Proactive Recommended Features

1. **Hover Keyframe Scrubber**: Hovering over any video thumbnail displays keyframe previews across the video timeline without opening an external player.
2. **Duplicate & Malformed ITS Validator**: Instantly flags slots with duplicate ITS IDs or invalid lengths (must be 5 to 8 digits).
3. **Working Drive Storage Guard**: Warns if available SSD space falls below 15% or 100 GB.
4. **Inter-App One Tap Launchers**:
   - Right-click slot / DVD folder $\rightarrow$ *"Send to Title Adder"* (calls port 49152).
   - Right-click date folder $\rightarrow$ *"Verify & Mirror in DriveSync"*.
   - Generate automated Excel Inventory report (`Sequence_Summary_Report_*.xlsx`).

---

## 7. Master AI Development Prompt

Copy and paste the prompt below into any AI coding assistant to build this application:

```markdown
# MASTER PROMPT: Build the Anything File Manager (AFM) Desktop Application

You are an expert Principal Desktop Applications Engineer tasked with developing the **Anything File Manager (AFM)** — a high-performance desktop file manager and asset coordinator tailored for professional multi-session video production workflows.

### 1. Architectural Stack & Technical Guidelines
- **Core Platform**: Electron (with TypeScript) or Tauri v2 (Rust backend + TypeScript frontend).
- **UI Framework**: React 18+, Tailwind CSS v4, Lucide Icons, and Zustand for state management.
- **Media Ingest & Metadata Engine**:
  - Non-blocking asynchronous video duration reader (using fast MP4/MOV header MOOV atom parsing or bundled FFprobe streaming child processes).
  - Calculate cumulative video runtime across hundreds of raw clips in milliseconds without freezing the UI.
- **Visual Design**: Liquid Glass & Deep Space Obsidian Dark Theme (`var(--surface)`, `var(--accent)`, `var(--border)`). Clean, distraction-free, zero saturated eye-strain colors.

---

### 2. Core Functional Modules

#### Module A: Folder Classifier & Regex Taxonomy Engine
Implement a recursive parser classifying opened directories:
1. **Master Safar Folder**: Regex `^(\d{4})[-_](\d{2})\s+([A-Za-z\s]+)(?:-(.*))?$` (e.g. `1448-03 Mumbai`).
2. **Date / Session Work Folder**: Regex `^(\d{4}[-_]\d{2}[-_]\d{2})\s*_(\d{2})([ME])$` (e.g. `1448-03-13 _01M`, `1448-05-07_01M`).
3. **Slot / Item Folders**:
   - Format A: `^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{2})-(?:(\d{2})?([A-Z]+))-(\d{5,8})$` (e.g. `1448-05-07_01M-01-01N-40905764`).
   - Format B (No ITS): `^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{2})-([A-Z]+)-?$` (e.g. `1448-03-13 _01M-05-H-`).
4. **Category Grouping Directories**: Transparently traverse folders like `01-Mumbai-Bethak`, `02-Mumbai-Waaz` to index nested slot folders.

#### Module B: Properties & Deep Asset Metrics Sidebar
When a folder is clicked, populate a dedicated Properties Drawer:
1. **If Master Safar Folder**:
   - Count all valid Date/Session subfolders (ignoring `Final\` or utility directories).
   - Display summary: total files, total video clips, and grand cumulative duration (`HH:MM:SS`).
   - Breakdown table showing each Date folder with file count, video count, runtime, and lifecycle stage.
2. **If Date / Session Folder**:
   - Count all slot folders, separating Format A (with ITS) and Format B (Hadiyah/Special).
   - Count total camera video files inside each slot's subdirectories.
   - Sum durations of all media files (`.mp4`, `.mov`, `.mkv`, `.avi`, `.mxf`) and display cumulative runtime prominently.
   - Display a breakdown table with slot code, person name, clip count, and individual runtime.

#### Module C: Adobe Premiere Pro Project (.prproj / XML) Creator
1. Detect folder scope (Date Session vs. Master Safar).
2. Open an interactive Pre-Flight Verification Dialog displaying:
   - Target project file name (`1448-03-13 _01M.prproj` or `1448-03 Mumbai_Master.prproj`).
   - Sequence settings preset (1080p / 4K, 25fps / 50fps / 29.97fps).
   - Bin layout structure (`01 ROUGH CUTS`, `02 AUDIO`, `03 TITLES`, `04 CAMERA FOOTAGE`).
   - Timecode `<in>`, `<out>`, `<duration>` frame synchronization to eliminate trailing black frames.
3. User verification button to generate the project file on disk.

#### Module D: Production Stage Tagging System
1. Implement color-coded workflow stages:
   - `Stage 1: Raw Ingest` (Blue)
   - `Stage 2: Synced / MultiCam` (Purple)
   - `In Editing` (Amber)
   - `Pending Review` (Pink)
   - `Rendered` (Emerald)
   - `Uploaded` (Cyan)
   - `Backed Up / Archive` (Slate)
2. Persist tags via `.afm_meta.json` inside each folder or a local SQLite database.
3. Auto-infer stage based on files present (`.prproj`, `Final\` directory match), with manual override dropdown.

#### Module E: Proactive Production Tools
- **Hover Thumbnail Scrubber**: Scrub video keyframes on mouse hover.
- **ITS Duplicate / Format Validator**: Flag duplicate ITS IDs within a session.
- **Disk Health Meter**: Live storage usage indicator with low-space alerts (< 15%).
- **Anything Ecosystem Bridges**: One-click actions to send folders to One Tap Title Adder (Port 49152) and DriveSync.
```

---

## 8. Interactive Decisions & Alignment ("Ask User" Section)

Please consider the following architectural decisions to customize AFM:

1. **Standalone App vs. One Tap Tab**:
   - Would you like AFM as a **separate standalone desktop app** (e.g. `Anything File Manager`), or integrated as a **primary module inside One Tap**?
2. **Video Duration Extraction Method**:
   - Should AFM bundle a standalone `ffprobe.exe` for broad camera codec support (Sony XAVC, Canon MP4, ProRes MOV), or use a lightweight Node-based MP4 atom parser for zero-CPU instant reading?
3. **Premiere Pro Project Templates**:
   - Do you have an existing `.prproj` master template file that AFM should clone and inject clips into, or should AFM generate clean XML interchange sequences that Premiere Pro imports into any project?
4. **Metadata Storage**:
   - Do you prefer pipeline stage tags stored in a local `.afm_meta.json` file inside each date folder, or centralized in a local SQLite database?

