# 🏕️ Safar & Media Stats Inspector (Windhawk Mod v2.0)

A high-performance Windows File Explorer Shell extension mod built for **Windhawk** to inspect Safar media folders, calculate Adobe Premiere Pro timeline durations, count days, and display official event segregation from `Event List.xlsx`.

---

## 🎯 How It Works Under the Hood

### 1. Injected Shell Architecture (Windhawk Hooking)
When Windhawk loads the mod, it injects its 64-bit compiled DLL directly into `explorer.exe`:
- **`PropertySheetW` Hook (`comctl32.dll`):**
  Intercepts Explorer's native Properties dialog initialization. When a folder properties window is opened, the mod resolves the folder path via Windows Shell COM interfaces (`IShellWindows`, `IFolderView`) and dynamically appends our custom property page (**"🏕️ Safar & Media Stats"**) using an in-memory `DLGTEMPLATE_INDIRECT`.
- **`TrackPopupMenuEx` Hook (`user32.dll`):**
  Intercepts right-clicks on folders and directory backgrounds in Explorer, inserting **"🏕️ Inspect Safar & Media Stats"** at the top of the context menu. Clicking it opens the Executive Inspector Dialog directly in 1 click without needing to go to Properties.
- **Explorer Hotkey (`Ctrl+Shift+S`):**
  Optional fast shortcut to immediately inspect the currently highlighted folder in Explorer.

### 2. Hierarchical Level Detection
The parser automatically determines the folder depth using regular expressions:
- **Level 1 (Safar Root):** e.g. `1448-10-Istefada ilmiyah`
  - Scans all Date Sessions (`1448-04-18 _01M`, `1448-04-05 _02E`).
  - Aggregates total days, total events, raw video clips count, and estimated Adobe Premiere Pro timeline duration.
- **Level 2 (Date Session):** e.g. `1448-04-18 _01M`
  - Classifies session as **Morning (`_01M`)** or **Evening (`_02E`)**.
  - Handles direct item folders as well as intermediate category folders (e.g. `01-Surat-QMZ`, `01-Dummas-Bethak`).
- **Level 3 (Individual Event Item):** e.g. `1448-04-18 _01M-01-01Q-20398749`
  - Extracts ITS ID (`20398749`), event prefix (`Q`), occurrence (`01Q`), item index (`01`), and person subfolder.

### 3. Ultra-Fast MP4/MOV Atom Duration Reader
Instead of relying only on slow Windows Property Store queries:
- Reads the ISO Base Media File Format box structure directly (`moov` ➔ `mvhd`).
- Extracts timescale and duration in microseconds without decoding video frames.
- Sums durations of all raw camera clips to calculate the exact Adobe Premiere Pro project timeline run time.

### 4. Zero-Count Suppression & Official Nomenclature
- Cross-references the official 34 event codes from `Event List.xlsx` (`Q, N, Z, MZ, AQ, ZO, BM, BQ, etc.`).
- **Zero-count suppression:** Only event codes with at least 1 record are shown. Non-occurring events are completely hidden to eliminate clutter.
- **1-Click Toggle:** Switch between compact abbreviations (`Q, N, Z`) and full official names (`Qadam, Nikah, Ziyafat`).

---

## 🚀 How to Install & Use in Windhawk

### Step 1: Open Windhawk
1. Launch **Windhawk** on your computer.
2. Click on the **Advanced** tab (or **Mods**).
3. Click **Create Local Mod** (or open the mod editor for `safar-folder-inspector` / `new-mod`).

### Step 2: Paste the Mod Code
1. Open [`safar-folder-inspector.wh.cpp`](file:///d:/ON_GOING%20PROJECT/One%20Tap_V20.6.5/extensions/windhawk-safar-inspector/safar-folder-inspector.wh.cpp) (or [`mod.wh.cpp`](file:///d:/ON_GOING%20PROJECT/One%20Tap_V20.6.5/extensions/windhawk-safar-inspector/mod.wh.cpp)).
2. Copy the entire file content and paste it into the Windhawk Mod Editor.
3. Click **Compile and Load** (or press `Ctrl+B`).
4. Windhawk compiles the mod with Clang and loads it into `explorer.exe`.

### Step 3: Inspect Any Safar Folder
- **Method 1 (Right-Click Context Menu):** Right-click any Safar folder in Explorer ➔ click **"🏕️ Inspect Safar & Media Stats"**.
- **Method 2 (Folder Properties Tab):** Right-click any folder ➔ click **Properties** ➔ select the **"🏕️ Safar & Media Stats"** tab.

---

## 📋 What Was Added & Recommended

1. **Dual Explorer Integration (Context Menu + Properties Sheet):**
   - Users no longer need to open Properties and switch tabs every time. A 1-click right-click option opens the inspector instantly.
2. **In-Memory Dialog Templates (Zero External Resource Dependencies):**
   - The mod uses programmatic Win32 dialog templates (`DLGTEMPLATE_INDIRECT`), eliminating any need for `.rc` files or resource compilers. It compiles cleanly in any Windhawk environment.
3. **1-Click WhatsApp Executive Summary Copy:**
   - Pre-formats an elegant WhatsApp emoji summary with total days, events, timeline run-time, and event breakdown.
4. **1-Click Open Studio Workstation GUI:**
   - A button in the UI directly launches [`gui_inspector.py`](file:///d:/ON_GOING%20PROJECT/One%20Tap_V20.6.5/extensions/windhawk-safar-inspector/gui_inspector.py) with full charts, timeline simulation, and deep inspection.
5. **Windhawk Mod Settings Tab Support:**
   - Supports live configuration through Windhawk's Settings UI (abbreviations by default, toggle context menu, custom python script path).
6. **Optional Instant Registry Installer:**
   - Double-click [`install_context_menu.reg`](file:///d:/ON_GOING%20PROJECT/One%20Tap_V20.6.5/extensions/windhawk-safar-inspector/install_context_menu.reg) to add the right-click menu natively into Windows Shell even when Windhawk is stopped.

---

## 📁 Directory Structure

```text
extensions/windhawk-safar-inspector/
├── safar-folder-inspector.wh.cpp   # Complete standalone Windhawk C++ mod source
├── mod.wh.cpp                      # Windhawk editor copy
├── mod.json                        # Windhawk mod metadata & settings manifest
├── events_definition.h             # 34 official events and hex color definitions
├── safar_parser.h                  # Token & hierarchy parser
├── video_duration.h                # Fast MP4/MOV binary atom duration extractor
├── gui_inspector.py                # Premium CustomTkinter Dark Studio GUI
├── test_harness.py                 # Standalone CLI testing script
├── install_context_menu.reg        # Optional Explorer right-click registry installer
├── uninstall_context_menu.reg      # Registry uninstaller
└── README.md                       # Complete documentation and user guide
```
