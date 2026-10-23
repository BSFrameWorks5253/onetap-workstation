# Blueprint 04: Designing Self-Hosted Animated Cyber Banners & SVGs

A complete guide and source template library for crafting hardware-accelerated animated SVGs that render natively on GitHub, personal websites, and desktop application splash/setup screens with **zero third-party API dependencies**.

---

## 🎨 1. Why Self-Hosted Animated SVGs Dominate

| Metric | Third-Party Image Services | Self-Hosted Pure SVG (`resources/*.svg`) |
| :--- | :---: | :---: |
| **Uptime & Reliability** | Often 500s / timeouts on GitHub Camo | **100% Guaranteed (Served via GitHub CDN)** |
| **Animation Frame Rate** | Often static GIF / webp limits | **Fluid 60fps/120fps Native Vector CSS** |
| **Custom Branding** | Generic templates | **Custom Cyber HUD, Scanlines, Live Telemetry** |
| **App Embeddability** | Web only | **Directly usable in Electron/React Setup Wizards** |

---

## ⚡ 2. Core Animation Techniques Inside SVGs

GitHub's Markdown sanitizer allows inline `<style>` and `@keyframes` inside `.svg` image files:

### 1. Animated Shimmer Linear Gradient
```xml
<linearGradient id="titleShimmer" x1="0%" y1="0%" x2="200%" y2="0%">
  <stop offset="0%" stop-color="#60A5FA" />
  <stop offset="50%" stop-color="#F43F5E" />
  <stop offset="100%" stop-color="#60A5FA" />
  <animate attributeName="x1" from="-100%" to="100%" dur="6s" repeatCount="indefinite" />
  <animate attributeName="x2" from="100%" to="300%" dur="6s" repeatCount="indefinite" />
</linearGradient>
```

### 2. Laser Scanline Sweeper
```xml
<line x1="0" y1="0" x2="1200" y2="0" stroke="rgba(129, 140, 248, 0.35)" stroke-width="2" class="scan-beam" filter="url(#neonGlow)" />
<style>
  @keyframes scanSweep {
    0% { transform: translateY(-50px); opacity: 0; }
    15% { opacity: 0.8; }
    85% { opacity: 0.8; }
    100% { transform: translateY(370px); opacity: 0; }
  }
  .scan-beam { animation: scanSweep 6s ease-in-out infinite; }
</style>
```

### 3. Pulsing Hardware Telemetry LEDs
```xml
<circle cx="50" cy="50" r="4.5" class="status-pulse" />
<style>
  @keyframes pulseGreen {
    0%, 100% { fill: #10B981; opacity: 1; filter: drop-shadow(0 0 6px #10B981); }
    50% { fill: #34D399; opacity: 0.4; filter: drop-shadow(0 0 1px #10B981); }
  }
  .status-pulse { animation: pulseGreen 2s infinite; }
</style>
```

---

## 🛠️ 3. Full Cyber Workstation Hero Banner Template (1200x360)

Save as `resources/hero_animated.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" width="100%" height="100%">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#1E1B4B" stop-opacity="0.9" />
      <stop offset="50%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <linearGradient id="shimmer" x1="0%" y1="0%" x2="200%" y2="0%">
      <stop offset="0%" stop-color="#60A5FA" />
      <stop offset="50%" stop-color="#A78BFA" />
      <stop offset="100%" stop-color="#60A5FA" />
      <animate attributeName="x1" from="-100%" to="100%" dur="5s" repeatCount="indefinite" />
      <animate attributeName="x2" from="100%" to="300%" dur="5s" repeatCount="indefinite" />
    </linearGradient>
  </defs>

  <style>
    .pulse { animation: p 2s infinite; }
    @keyframes p { 0%, 100% { opacity: 1; filter: drop-shadow(0 0 6px #10B981); } 50% { opacity: 0.4; } }
  </style>

  <rect width="1200" height="360" rx="16" fill="url(#bg)" />
  <rect x="12" y="12" width="1176" height="336" rx="12" fill="none" stroke="rgba(99, 102, 241, 0.3)" stroke-width="1.5" />

  <!-- Corner Brackets -->
  <path d="M 12 40 L 12 12 L 40 12" stroke="#6366F1" stroke-width="3" fill="none" />
  <path d="M 1188 40 L 1188 12 L 1160 12" stroke="#6366F1" stroke-width="3" fill="none" />

  <!-- Title -->
  <text x="600" y="160" text-anchor="middle" font-family="sans-serif" font-size="64" font-weight="900" fill="url(#shimmer)" letter-spacing="4">
    YOUR APP NAME
  </text>
  <text x="600" y="210" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="600" fill="#94A3B8" letter-spacing="4">
    ENTERPRISE AUTOMATION &amp; WORKSTATION PLATFORM
  </text>
</svg>
```

---

## 🛣️ 4. Animated Pipeline Highway Template (1000x220)

Save as `resources/workflow_animated.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 220" width="100%">
  <defs>
    <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#C084FC" />
    </linearGradient>
  </defs>
  <style>
    .packet { animation: moveP 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
    @keyframes moveP { 0% { cx: 100; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { cx: 900; opacity: 0; } }
  </style>

  <rect width="1000" height="220" rx="14" fill="#0F172A" stroke="rgba(99,102,241,0.3)" />
  <line x1="100" y1="110" x2="900" y2="110" stroke="url(#pipeGrad)" stroke-width="3" />
  <circle class="packet" cy="110" r="6" fill="#38BDF8" filter="drop-shadow(0 0 8px #38BDF8)" />
</svg>
```

---

## 📌 5. Usage in GitHub Markdown & React/Electron

### In GitHub README.md:
```markdown
<div align="center">
  <img src="resources/hero_animated.svg" width="100%" alt="Cyber Workstation Banner" />
</div>
```

### In React / Electron Component:
```tsx
import heroBannerSvg from '../../assets/hero_animated.svg'

export const SplashHeader = () => (
  <div className="setup-hero-banner-wrap">
    <img src={heroBannerSvg} alt="Banner" className="setup-hero-banner-img" />
  </div>
)
```
