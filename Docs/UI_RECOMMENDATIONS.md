# Uni Desk (One Tap) — UI/UX Design Recommendations & Roadmap

This document presents user interface (UI), visual design, and user experience (UX) recommendations for the **Uni Desk (One Tap)** desktop application.

---

## 🎨 1. Modern Visual Polish & Glassmorphism

* **Frosted Glass (Acrylic / Mica) Cards & Modals**
  * Enhance container panels, tool cards, and modals with modern `backdrop-filter: blur(16px)` and translucent subtle borders (`rgba(255, 255, 255, 0.08)`).
  * Align aesthetics with modern macOS Sonoma & Windows 11 Fluent acrylic design standards.

* **Smooth Theme Color Transitions**
  * Implement smooth CSS transitions (`transition: background 0.4s ease, border-color 0.4s ease`) when switching between pages, preventing abrupt background color jumps when changing active modules.

* **OLED Pure Black Dark Mode**
  * Introduce an **OLED Dark Mode** option (true `#000000` background) alongside the current dark and light themes for high-contrast displays and lower power consumption.

* **Custom Accent Color Picker**
  * Allow users to select custom global accent colors (e.g., *Cyberpunk Cyan, Electric Violet, Emerald Green, Sunset Amber*) in addition to per-page color presets.

---

## 🧭 2. Navigation & Layout Upgrades

* **Collapsible Compact Sidebar (Icon-Only Mode)**
  * Add a toggle button (`Ctrl + B` or sidebar toggle arrow) to collapse the navigation sidebar into a space-saving 64px icon rail.
  * Gives video editors maximum screen real estate for asset management and project generation.

* **Quick Command Palette (`Ctrl + K`)**
  * A Spotlight-style modal search bar to instantly search pages, trigger python workflows, open recently generated folders, or jump to settings without navigating manually.

* **Customizable Dashboard Layout (Drag & Drop Grid)**
  * Enable reordering of dashboard card widgets (Hardware Monitor, Quick Folder Maker, Sticky Notes, Cloud Sync Status) to let users design their ideal workstation overview.

---

## ✨ 3. Micro-Interactions & Interactive Feedback

* **Interactive Drag-and-Drop Dropzones**
  * Upgrade file import areas in Converter, Title Adder, and Camera Transfer with pulsing drop targets, file count badges, and real-time thumbnail previews upon drag-over.

* **Animated Circular Progress Rings**
  * Replace flat linear progress bars with smooth, glowing circular ring gauges for background file copies, media conversions, and folder generations.

* **Floating Action Quick Launcher (Mini Dock)**
  * A sleek, draggable desktop overlay widget/tray dock allowing 1-click execution of favorite utilities directly from anywhere on the screen.

---

## 🖥️ 4. Window Header & Space Optimization

* **Custom Seamless Titlebar**
  * Merge the top window titlebar with the application header strip, saving ~40px of vertical height and creating a unified borderless window aesthetic.

* **Animated Active Tab Indicator**
  * Add a sliding neon glow pill that follows the mouse hover and smoothly glides to mark the active page in the sidebar and top toolbar.

* **Contextual Right-Click Menus**
  * Custom styled context menus on files, cards, and recent projects (Options: *Open in Explorer, Reveal in Premiere, Copy Path, Delete, Send to Converter*).
