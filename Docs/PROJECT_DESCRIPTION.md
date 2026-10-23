# UniDesk Studio — Comprehensive Project & Product Description

**Version:** 26.10 (Production Workstation Release)  
**Author & Maintainer:** BS Framework (`BSFrameWorks5253`)  
**Official Repository:** [https://github.com/BSFrameWorks5253/onetap-workstation](https://github.com/BSFrameWorks5253/onetap-workstation)  
**License:** Commercial EULA (100% Unrestricted Output Deliverables)

---

## 📌 Executive Summary

**UniDesk Studio** (formerly *One Tap Workstation*) is a high-throughput, enterprise-grade automated video production workstation and media asset management engine. Engineered for professional broadcast teams, wedding event videographers, commercial post-production studios, and YouTube creators, it eliminates manual workflow bottlenecks by interfacing directly with hardware-accelerated **FFmpeg pipelines (NVIDIA NVENC, Intel QuickSync, multi-threaded CPU)**, native Adobe Premiere Pro CEP extensions, and automated file-system batch monitors.

---

## 🎯 Description Tiers (Tailored for All Channels)

### 1. One-Line Elevator Pitch (GitHub Repo About / Package Registry)
> *Next-generation automated video production workstation, sequential multi-batch rendering engine & media asset management platform with hardware NVENC/QSV acceleration.*

### 2. Short Description (App Stores, Social Previews, Search Meta)
> *UniDesk Studio is a high-speed video production workstation built on Electron, React, and FFmpeg. Automate multi-folder batch rendering, intelligent 4K photo pairing, XML sequence mapping, and archive auditing with NVENC GPU acceleration and zero-click domino pipelines.*

### 3. Medium Description (Press Releases, Marketplaces, Release Notes)
> *UniDesk Studio is an all-in-one desktop workstation engineered to streamline video post-production and eliminate repetitive manual rendering tasks. With its Sequential Multi-Batch Queue Engine [1..N], editors can drag-and-drop multiple event folders simultaneously, automatically discover DVD subdirectories, and execute multi-track title additions and watermarks at up to 14.8x real-time speed using NVIDIA NVENC and Intel QuickSync. Featuring an intelligent camera photo renamer, Windows 11 taskbar-style live hover previews, an incremental SHA-256 token cache engine (~891k tokens saved), and 5 Awwwards-grade kinetic preloaders with broadcast RTL wipe animations, UniDesk Studio delivers studio-grade performance with anti-eye-strain visual ergonomics.*

### 4. Comprehensive Technical Description (Enterprise Evaluation & Architecture)
> *UniDesk Studio bridges the gap between raw hardware-accelerated transcoding and production-line editing workflows. Built with Electron 30, React 18, and TypeScript 5.5, it provides a decoupled architecture with secure IPC boundaries. The core render manager orchestrates sequential and parallel batch rendering jobs across local NVMe storage and network-attached storage (NAS). Its proprietary Domino Pipeline automatically chains Adobe Media Encoder renders into downstream title overlay insertion, audio track multiplexing, and photographic asset relocation without requiring manual operator intervention between phases.*

---

## ⚡ Core Capability Modules

### 🎬 1. Sequential Multi-Batch Queue Engine (Title Adder)
- **Arbitrary Batch Ingestion**: Ingest $N$ event folders simultaneously via multi-folder drag-and-drop or batch picker.
- **Dynamic Reordering**: Move batches up/down with live priority updating; source paths, destination paths, and photo transfer directories automatically sync across the entire workstation.
- **Automated DVD Structure Discovery**: Automatically parses and groups event titles from nested camera cards and DVD subdirectories.

### 🖼️ 2. Intelligent 4K Photo Pairing & Batch Renamer (Video Transfer)
- **Synchronized Asset Relocation**: Pairs rendered video titles with high-resolution camera JPEGs.
- **One-Click Batch Execution**: Dedicated `⚡ Rename & Move ALL Batches` pipeline transfers, organizes, and names photos into separate event destination folders in one click.

### 🚀 3. Hardware Video Acceleration (FFmpeg Engine)
- **NVIDIA NVENC (CUDA)**: Up to **14.8x real-time speedup** with low CPU overhead (~8%).
- **Intel QuickSync Video (QSV)**: Up to **8.4x speedup** on integrated Intel GPUs.
- **Multi-Threaded CPU Fallback**: Clean libx264 software encoding for universal hardware compatibility.

### 🖥️ 4. Windows Taskbar-Style Live Hover Previews
- Native Windows 11 style popover windows rendered when hovering over sidebar navigation icons.
- Displays live page telemetry, active queue states, progress gauges, and execution triggers with an ergonomic 240ms debounce.

### 🧠 5. SHA-256 Token Cache Engine (~891,818 Tokens Saved)
- Incremental hash analyzer caching modified files into `.code-analysis/`.
- Prevents expensive token-draining codebase re-scans by AI coding assistants, preserving **99.4% of context budgets**.

### 🎨 6. 5 Awwwards-Grade Kinetic Preloaders & RTL Wipe Animation
- **Broadcast Right-to-Left (RTL) Wipe Animation**: Seamless Arabic calligraphy reveal with a synchronized golden luminous light beam sweeping across the text.
- **Authentic ONTO Kinetic Typography**: Precise 5-stage mechanical choreography.
- **Astral Frontier**: Concentric orbital planetary rings with live telemetry.
- **Walbi Audio Pulse**: Frequency-reactive soundwave equalizer bars.
- **Spasoje Perovic**: Minimalist Swiss brutalist oversized numeric ticker.
- **Mobbin Workstation Dock**: Floating mobile-inspired checklist card.

---

## 🔒 Privacy & On-Premise Security Guarantee

- **100% Local Execution**: All video rendering, photo renaming, and database operations execute locally on the user's workstation.
- **No Cloud Footage Uploads**: Zero media bytes or private client files are transmitted to external servers.
- **Unrestricted Output Ownership**: Licensor claims 0% royalty, copyright, or ownership over videos and files processed using the software.

---

## 📋 Metadata Reference

| Property | Value |
| :--- | :--- |
| **Product Name** | UniDesk Studio™ |
| **Legacy Name** | One Tap Workstation |
| **Current Version** | v26.10.10 |
| **Platforms Supported** | Windows 11 (x64), Windows 10 (x64), Linux (AppImage/deb) |
| **Architecture** | Electron 30, React 18, TypeScript 5.5, FFmpeg NVENC/QSV |
| **Primary Categories** | Video Production, Media Automation, Multimedia Tools, Creative Software |
| **Keywords / Tags** | `video-editing`, `batch-rendering`, `ffmpeg`, `nvenc`, `cuda`, `electron`, `premiere-pro`, `react`, `typescript`, `workstation`, `automation` |
| **Support Contact** | `bs.framework5253@gmail.com` |
