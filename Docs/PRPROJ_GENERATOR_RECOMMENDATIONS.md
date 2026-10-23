# Premiere Pro Project Generator (.prproj File Maker) — Recommendations

This document outlines the current implementation and recommended enhancements for the **Adobe Premiere Pro Project Generator (`.prproj` File Maker)** module in **One Tap Workstation**.

---

## 📁 1. System Overview & Current Implementation

The current implementation spans the following primary files:
* **Renderer UI**: [PrprojGenerator.tsx](file:///d:/One%20Tap_V20.6.5/src/renderer/src/pages/PrprojGenerator/PrprojGenerator.tsx)
* **Styling**: [PrprojGenerator.css](file:///d:/One%20Tap_V20.6.5/src/renderer/src/pages/PrprojGenerator/PrprojGenerator.css)
* **Main Process IPC Engine**: [prproj.ipc.ts](file:///d:/One%20Tap_V20.6.5/src/main/ipc/prproj.ipc.ts)
* **Python Fallback Engine**: [create_premiere_projects.py](file:///d:/One%20Tap_V20.6.5/src/main/python/create_premiere_projects.py)

### Core Capabilities Currently Active
1. **Multi-Mode Generation**: Supports **Auto Mode**, **Single Mode** (one `.prproj` per subfolder), and **Master Mode** (one combined master project).
2. **Cameraman Breakdown & Markers**: Detects operator folders (`Cam_A`, `Cam_B`, etc.) and assigns custom color markers (`markerColor: { red, green, blue }`).
3. **Media Metadata Probe**: Runs asynchronous `ffprobe` calls to detect video resolution, framerate, duration, timebase, and audio channels.
4. **Excel Production Reporting**: Outputs detailed `.xlsx` sequence summary reports.
5. **Gzip XML Stream Engine**: Generates native gzip-compressed `.prproj` XML buffers compatible with Adobe Premiere Pro.

---

## 🚀 2. Core Feature Recommendations

### 🎞️ 2.1 Multi-Track Layering & Smart Audio Routing
* **Cameraman-to-Track Mapping**: In Master & Multi-Cam modes, assign each camera/operator subfolder to a dedicated video track (`Cam_A` $\rightarrow$ `V1`, `Cam_B` $\rightarrow$ `V2`, `Cam_C` $\rightarrow$ `V3`).
* **Dedicated Audio Routing**: Route external audio files (`.wav`, `.mp3`) onto dedicated audio tracks (`A2`, `A3`) separate from camera scratch audio.

### 📱 2.2 Multi-Aspect Ratio & Social Media Presets (9:16 Reels / Shorts)
* Add a 1-click toggle to generate **Vertical 9:16 (1080x1920)** timeline sequences alongside standard **Horizontal 16:9 (4K/1080p)** sequences.

### 📁 2.3 Template Preset Library & Structured Bin Generator
* **Template Preset Manager**: Select from custom template profiles (*Wedding*, *Corporate*, *Music Video*, *Documentary*).
* **Structured Premiere Bin Trees**: Generate organized project bin hierarchies inside Premiere (`01_FOOTAGE`, `02_AUDIO`, `03_GRAPHICS`, `04_SEQUENCES`).

---

## 📊 3. Additional Excel Report & Pre-Flight Media Audit Features

### 🎥 3.1 Resolution & Framerate Technical Matrices
* **Resolution Breakdown Matrix**: Track and categorize counts for 4K UHD (`3840x2160`) vs Full HD (`1920x1080`) vs 720p clips.
* **Framerate & Slow-Motion Matrix**: Distinguish standard motion clips (`24 fps` / `25 fps` / `30 fps`) from high-fps slow-motion footage (`60 fps` / `120 fps` / `240 fps`).

### 🚩 3.2 Pre-Flight Health Alerts & Red Cell Highlighting
* **Red Cell Highlights in Excel Report**:
  * 🟥 **Corrupted Clips**: Flag files failing `ffprobe` header verification.
  * 🟥 **0-Byte Video Files**: Flag empty or interrupted transfer files.
  * 🟥 **Missing Audio Tracks**: Flag clips recorded with 0 audio channels / missing scratch mics.

---

## 🛠️ 4. Technical Implementation Summary

| Component | Target File | Feature Goal |
| :--- | :--- | :--- |
| **Excel Audit Engine** | [prproj.ipc.ts](file:///d:/One%20Tap_V20.6.5/src/main/ipc/prproj.ipc.ts#L375) | Resolution/FPS matrices & red highlight cells |
| **Multi-Track Engine** | [prproj.ipc.ts](file:///d:/One%20Tap_V20.6.5/src/main/ipc/prproj.ipc.ts#L450) | Assign camera subfolders to distinct V1..V4 tracks |
| **Generator UI** | [PrprojGenerator.tsx](file:///d:/One%20Tap_V20.6.5/src/renderer/src/pages/PrprojGenerator/PrprojGenerator.tsx#L50) | Mode switcher & template options |
