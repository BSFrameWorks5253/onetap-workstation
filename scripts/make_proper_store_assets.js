const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  console.log('[Store Asset Studio] Creating proper high-definition Store Box Art and Poster Art...');

  const storeDir = path.join(__dirname, '../Microsoft_Store_Assets');
  const webAssetsDir = path.join(__dirname, '../website/assets');
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  if (!fs.existsSync(webAssetsDir)) fs.mkdirSync(webAssetsDir, { recursive: true });

  // Read assets
  const iconPath = path.join(__dirname, '../resources/icon.png');
  const iconBase64 = fs.readFileSync(iconPath).toString('base64');
  const iconDataUri = `data:image/png;base64,${iconBase64}`;

  const patternPath = path.join(__dirname, '../src/renderer/src/assets/islamic_pattern_enhanced.png');
  let patternDataUri = '';
  if (fs.existsSync(patternPath)) {
    patternDataUri = `data:image/png;base64,${fs.readFileSync(patternPath).toString('base64')}`;
  }

  const sealPath = path.join(__dirname, '../src/renderer/src/assets/zen_final_nobg.png');
  let sealDataUri = '';
  if (fs.existsSync(sealPath)) {
    sealDataUri = `data:image/png;base64,${fs.readFileSync(sealPath).toString('base64')}`;
  }

  // =========================================================================
  // 1. GENERATE 1:1 BOX ART (1080 x 1080 px)
  // =========================================================================
  console.log('[Store Asset Studio] Rendering 1:1 Box Art (1080x1080)...');
  const boxArtHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1080px;
        overflow: hidden;
        background: #07090E;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #FFFFFF;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        -webkit-font-smoothing: antialiased;
      }

      /* Studio Background lighting & pattern */
      .bg-radial {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 50% 42%, #141B2D 0%, #0A0D15 65%, #05070B 100%);
        z-index: 1;
      }
      .bg-glow-1 {
        position: absolute;
        top: 20%;
        left: 25%;
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, transparent 70%);
        filter: blur(40px);
        z-index: 2;
      }
      .bg-glow-2 {
        position: absolute;
        bottom: 25%;
        right: 25%;
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, transparent 70%);
        filter: blur(40px);
        z-index: 2;
      }
      .bg-pattern {
        position: absolute;
        inset: 0;
        background-image: url('${patternDataUri}');
        background-repeat: repeat;
        background-size: 260px 260px;
        opacity: 0.04;
        z-index: 3;
      }

      /* Inset luxury frame */
      .frame {
        position: absolute;
        inset: 28px;
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        border-radius: 36px;
        z-index: 10;
        pointer-events: none;
        box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.5);
      }
      .frame-inner {
        position: absolute;
        inset: 38px;
        border: 1px solid rgba(56, 189, 248, 0.15);
        border-radius: 28px;
        z-index: 10;
        pointer-events: none;
      }

      /* Content container */
      .content {
        position: relative;
        z-index: 20;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }

      /* Studio Pill Badge */
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 22px;
        background: rgba(255, 255, 255, 0.05);
        border: 1.5px solid rgba(212, 163, 71, 0.4);
        border-radius: 999px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        margin-bottom: 36px;
      }
      .badge-seal {
        width: 22px;
        height: 22px;
        object-fit: contain;
      }
      .badge-text {
        font-size: 13px;
        font-weight: 800;
        color: #E2B86D;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      /* 3D App Icon */
      .icon-wrapper {
        position: relative;
        margin-bottom: 38px;
      }
      .icon-glow {
        position: absolute;
        inset: -20px;
        background: radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, rgba(139, 92, 246, 0.25) 50%, transparent 75%);
        filter: blur(30px);
        border-radius: 50%;
        z-index: 1;
      }
      .app-icon {
        position: relative;
        z-index: 2;
        width: 440px;
        height: 440px;
        object-fit: contain;
        filter: drop-shadow(0 25px 45px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 25px rgba(56, 189, 248, 0.3));
      }

      /* Typography */
      .title {
        font-size: 68px;
        font-weight: 900;
        letter-spacing: 0.04em;
        color: #FFFFFF;
        line-height: 1.05;
        text-shadow: 0 4px 24px rgba(0, 0, 0, 0.7);
      }
      .subtitle-row {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 10px;
      }
      .subtitle-line {
        width: 36px;
        height: 1.5px;
        background: linear-gradient(90deg, transparent, #38BDF8);
      }
      .subtitle-line.right {
        background: linear-gradient(90deg, #38BDF8, transparent);
      }
      .subtitle {
        font-size: 20px;
        font-weight: 800;
        color: #38BDF8;
        letter-spacing: 0.32em;
        text-transform: uppercase;
      }
      .tagline {
        font-size: 17px;
        font-weight: 600;
        color: #94A3B8;
        letter-spacing: 0.08em;
        margin-top: 14px;
      }
    </style>
  </head>
  <body>
    <div class="bg-radial"></div>
    <div class="bg-glow-1"></div>
    <div class="bg-glow-2"></div>
    <div class="bg-pattern"></div>
    <div class="frame"></div>
    <div class="frame-inner"></div>

    <div class="content">
      <div class="badge">
        ${sealDataUri ? `<img class="badge-seal" src="${sealDataUri}" />` : ''}
        <span class="badge-text">ZENINFOSYS &bull; PRO STUDIO</span>
      </div>

      <div class="icon-wrapper">
        <div class="icon-glow"></div>
        <img class="app-icon" src="${iconDataUri}" />
      </div>

      <h1 class="title">UNI DESK</h1>
      <div class="subtitle-row">
        <div class="subtitle-line"></div>
        <span class="subtitle">PRO WORKSTATION</span>
        <div class="subtitle-line right"></div>
      </div>
      <p class="tagline">Media Automation &bull; Smart Audio Domino &bull; Premiere Pro 2026</p>
    </div>
  </body>
  </html>
  `;

  // Render Box Art
  const win1 = new BrowserWindow({
    width: 1080,
    height: 1080,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: { sandbox: false }
  });
  win1.setContentSize(1080, 1080);
  await win1.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(boxArtHtml)}`);
  await new Promise(r => setTimeout(r, 1200));

  const cap1 = await win1.webContents.capturePage({ x: 0, y: 0, width: 1080, height: 1080 });
  const buf1 = await sharp(cap1.toPNG()).resize(1080, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '02_Store_Logo_1x1_BoxArt_1080x1080.png'), buf1);
  fs.writeFileSync(path.join(webAssetsDir, 'store_box_art_1080x1080.png'), buf1);
  console.log('[Store Asset Studio] Wrote 02_Store_Logo_1x1_BoxArt_1080x1080.png');
  win1.close();

  // =========================================================================
  // 2. GENERATE 2:3 POSTER ART (720 x 1080 px)
  // =========================================================================
  console.log('[Store Asset Studio] Rendering 2:3 Poster Art (720x1080)...');
  const posterHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 720px;
        height: 1080px;
        overflow: hidden;
        background: #07090E;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #FFFFFF;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: 56px 48px;
        position: relative;
        -webkit-font-smoothing: antialiased;
      }

      /* Studio Background lighting & pattern */
      .bg-radial {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 50% 26%, #151D33 0%, #0A0D16 65%, #05060A 100%);
        z-index: 1;
      }
      .bg-glow-1 {
        position: absolute;
        top: 12%;
        left: 20%;
        width: 440px;
        height: 440px;
        background: radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, transparent 70%);
        filter: blur(40px);
        z-index: 2;
      }
      .bg-glow-2 {
        position: absolute;
        bottom: 25%;
        right: 15%;
        width: 440px;
        height: 440px;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.16) 0%, transparent 70%);
        filter: blur(40px);
        z-index: 2;
      }
      .bg-pattern {
        position: absolute;
        inset: 0;
        background-image: url('${patternDataUri}');
        background-repeat: repeat;
        background-size: 240px 240px;
        opacity: 0.04;
        z-index: 3;
      }

      /* Inset luxury frame */
      .frame {
        position: absolute;
        inset: 22px;
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        border-radius: 30px;
        z-index: 10;
        pointer-events: none;
        box-shadow: inset 0 0 35px rgba(0, 0, 0, 0.5);
      }
      .frame-inner {
        position: absolute;
        inset: 32px;
        border: 1px solid rgba(56, 189, 248, 0.14);
        border-radius: 22px;
        z-index: 10;
        pointer-events: none;
      }

      /* Header / Brand */
      .header {
        position: relative;
        z-index: 20;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        padding: 7px 20px;
        background: rgba(255, 255, 255, 0.05);
        border: 1.5px solid rgba(212, 163, 71, 0.4);
        border-radius: 999px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      }
      .badge-seal {
        width: 20px;
        height: 20px;
        object-fit: contain;
      }
      .badge-text {
        font-size: 11.5px;
        font-weight: 800;
        color: #E2B86D;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      /* Hero Section */
      .hero {
        position: relative;
        z-index: 20;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        margin-top: -10px;
      }
      .app-icon {
        width: 230px;
        height: 230px;
        object-fit: contain;
        filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 30px rgba(56, 189, 248, 0.35));
        margin-bottom: 22px;
      }
      .title {
        font-size: 50px;
        font-weight: 900;
        letter-spacing: 0.05em;
        color: #FFFFFF;
        line-height: 1;
        text-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
      }
      .subtitle-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }
      .subtitle-line {
        width: 28px;
        height: 1.5px;
        background: linear-gradient(90deg, transparent, #38BDF8);
      }
      .subtitle-line.right {
        background: linear-gradient(90deg, #38BDF8, transparent);
      }
      .subtitle {
        font-size: 16px;
        font-weight: 800;
        color: #38BDF8;
        letter-spacing: 0.28em;
        text-transform: uppercase;
      }
      .tagline {
        font-size: 13.5px;
        font-weight: 600;
        color: #94A3B8;
        letter-spacing: 0.04em;
        margin-top: 8px;
      }

      /* Feature Showcase Cards */
      .features {
        position: relative;
        z-index: 20;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 11px;
      }
      .feature-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 13px 18px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(12px);
      }
      .feature-icon-badge {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: rgba(56, 189, 248, 0.12);
        border: 1px solid rgba(56, 189, 248, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      .feature-text {
        flex: 1;
        text-align: left;
      }
      .feature-title {
        font-size: 13.5px;
        font-weight: 800;
        color: #F1F5F9;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .feature-check {
        color: #4ADE80;
        font-size: 13px;
        font-weight: 900;
      }
      .feature-desc {
        font-size: 11.5px;
        font-weight: 500;
        color: #94A3B8;
        margin-top: 2px;
      }

      /* Footer specifications */
      .footer {
        position: relative;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        padding-top: 14px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }
      .footer-pill {
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #94A3B8;
        padding: 4px 12px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <div class="bg-radial"></div>
    <div class="bg-glow-1"></div>
    <div class="bg-glow-2"></div>
    <div class="bg-pattern"></div>
    <div class="frame"></div>
    <div class="frame-inner"></div>

    <div class="header">
      <div class="badge">
        ${sealDataUri ? `<img class="badge-seal" src="${sealDataUri}" />` : ''}
        <span class="badge-text">ZENINFOSYS &bull; STUDIO WORKSTATION</span>
      </div>
    </div>

    <div class="hero">
      <img class="app-icon" src="${iconDataUri}" />
      <h1 class="title">UNI DESK</h1>
      <div class="subtitle-row">
        <div class="subtitle-line"></div>
        <span class="subtitle">PRO WORKSTATION</span>
        <div class="subtitle-line right"></div>
      </div>
      <p class="tagline">Next-Gen Media Automation &bull; Smart Domino Engine</p>
    </div>

    <div class="features">
      <div class="feature-card">
        <div class="feature-icon-badge">🎬</div>
        <div class="feature-text">
          <div class="feature-title">
            <span>Title Adder & Smart Audio Domino</span>
            <span class="feature-check">&#10003;</span>
          </div>
          <div class="feature-desc">Multi-track intro/outro video queue with smart audio rotation</div>
        </div>
      </div>

      <div class="feature-card">
        <div class="feature-icon-badge" style="background: rgba(139, 92, 246, 0.12); border-color: rgba(139, 92, 246, 0.25);">⚡</div>
        <div class="feature-text">
          <div class="feature-title">
            <span>Adobe Premiere Pro 2026 (.prproj)</span>
            <span class="feature-check">&#10003;</span>
          </div>
          <div class="feature-desc">Zero-click autonomous project generation & timeline assembly</div>
        </div>
      </div>

      <div class="feature-card">
        <div class="feature-icon-badge" style="background: rgba(74, 222, 128, 0.12); border-color: rgba(74, 222, 128, 0.25);">📁</div>
        <div class="feature-text">
          <div class="feature-title">
            <span>Sequence Match Video Transfer</span>
            <span class="feature-check">&#10003;</span>
          </div>
          <div class="feature-desc">Sub-millisecond date & photo subfolder pairing and transfers</div>
        </div>
      </div>

      <div class="feature-card">
        <div class="feature-icon-badge" style="background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.25);">📊</div>
        <div class="feature-text">
          <div class="feature-title">
            <span>Telemetry & Safar Production Vault</span>
            <span class="feature-check">&#10003;</span>
          </div>
          <div class="feature-desc">Real-time CPU/GPU engine vitals & historical render analytics</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <span class="footer-pill">x64 Native</span>
      <span class="footer-pill">Windows 11 Ready</span>
      <span class="footer-pill">GPU Accelerated</span>
      <span class="footer-pill">Studio Edition</span>
    </div>
  </body>
  </html>
  `;

  // Render Poster Art
  const win2 = new BrowserWindow({
    width: 720,
    height: 1080,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: { sandbox: false }
  });
  win2.setContentSize(720, 1080);
  await win2.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(posterHtml)}`);
  await new Promise(r => setTimeout(r, 1200));

  const cap2 = await win2.webContents.capturePage({ x: 0, y: 0, width: 720, height: 1080 });
  const buf2 = await sharp(cap2.toPNG()).resize(720, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '03_Poster_Art_2x3_720x1080.png'), buf2);
  fs.writeFileSync(path.join(webAssetsDir, 'store_poster_art_720x1080.png'), buf2);
  console.log('[Store Asset Studio] Wrote 03_Poster_Art_2x3_720x1080.png');
  win2.close();

  console.log('[Store Asset Studio] All store branding assets successfully generated!');
  app.quit();
});
