# Uni_Desk — Premiere Pro Command Palette Extension

**Uni_Desk** is a lightning-fast, keyboard-driven command palette extension for Adobe Premiere Pro inspired by modern tools like Raycast and VS Code Command Palette.

> **Original & Independent Implementation**  
> Uni_Desk is designed with a unique identity, non-clashing Adobe CEP bundle identifier (`com.unidesk.commandpalette`), custom UI aesthetic, and ExtendScript engine.

---

## Key Features

- **⚡ Ultra-Fast Search Engine (<30ms latency)**: Powered by Fuse.js with fuzzy matching, typo tolerance, keyword expansion, and smart frequency ranking.
- **🎨 Dark Glassmorphism Aesthetic**: 700px floating command palette with dynamic Framer Motion animations, highlight search matching, and preview side drawer.
- **🎬 Full Premiere Pro Action Coverage**:
  - **Video & Audio Effects**: Gaussian Blur, Directional Blur, Lumetri Color, Ultra Key, Transform, Gain, DeNoise, Parametric EQ, Hard Limiter.
  - **Transitions**: Cross Dissolve, Dip to Black, Dip to White, Push, Constant Power.
  - **Commands & Tools**: Undo, Redo, Ripple Delete, Nest, Render In to Out, Save, Export Media, Razor Tool, Pen Tool, Selection Tool.
  - **Workspaces**: Editing, Color, Audio, Captions & Graphics.
  - **3rd-Party Plugin Detection**: Boris FX Continuum, Red Giant Universe, Sapphire, FilmConvert Nitrate, Magic Bullet.
  - **Motion Presets**: Dynamic Zoom In (120%), Zoom Out, Whip Push, Parallax Slide, Bounce In.
- **⚡ Visual Macro Builder**: Chain multiple effects and commands into 1-click reusable workflows.
- **⌨ Keyboard-First Controls**:
  - `CTRL + SPACE`: Toggle command palette
  - `Arrow Up / Down`: Navigate list
  - `ENTER`: Apply to active selected clip
  - `CTRL + ENTER`: Apply effect/transition to all selected clips
  - `SHIFT + ENTER`: Open Preferences
  - `ALT + ENTER`: Toggle Details Preview Panel
  - `TAB`: Autocomplete input text
  - `ESC`: Dismiss palette

---

## Technical Stack & Architecture

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons
- **Search Core**: Fuse.js + Indexed DB / LocalStorage persistence
- **Adobe CEP Host**: CSXS Manifest v7.0 (Bundle: `com.unidesk.commandpalette`, Panel: `com.unidesk.panel`)
- **Host Engine**: ExtendScript (JSX) with Quality Engineering (QE) DOM fallback

---

## Project Structure

```
extensions/uni-desk-extension/
├── CSXS/
│   └── manifest.xml             # CEP Bundle ID & Host Registration
├── jsx/
│   └── index.jsx                # ExtendScript PPRO & QE Engine
├── public/
│   └── lib/
│       └── CSInterface.js       # Adobe CSInterface v11 API
├── src/
│   ├── components/              # CommandPalette, ItemRow, CategoryPills, PreviewPanel, MacroBuilder, SettingsModal
│   ├── data/                    # Effects, Commands, Motion Presets, Macros Catalogs
│   ├── hooks/                   # useKeyboardNav, useSearch, useFavorites
│   ├── services/                # searchEngine, extendScriptBridge, storage, macroEngine
│   ├── styles/                  # Tailwind & Glassmorphism styles
│   ├── types/                   # TypeScript interfaces
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── vite.config.ts
├── INSTALLATION.md
└── README.md
```

---

## Building the Extension

```bash
# Navigate to extension directory
cd extensions/uni-desk-extension

# Install dependencies
npm install

# Run Vite Development Server (with HMR)
npm run dev

# Build production bundle into dist/
npm run build
```
