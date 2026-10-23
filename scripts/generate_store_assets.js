const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  console.log('[Store Assets Generator] Starting headless Electron capture...');

  const storeDir = path.join(__dirname, '../Microsoft_Store_Assets');
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  // Create frameless window with EXACT content size 1920x1080
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0d14',
    webPreferences: {
      preload: path.join(__dirname, '../out/preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Ensure content bounds are exactly 1920x1080
  win.setContentSize(1920, 1080);

  const rendererPath = path.join(__dirname, '../out/renderer/index.html');
  await win.loadFile(rendererPath);

  // Settle animations
  console.log('[Store Assets Generator] Waiting for UI to mount and settle...');
  await new Promise(r => setTimeout(r, 4500));

  // Dismiss any welcome modal or overlays if present
  await win.webContents.executeJavaScript(`
    (() => {
      const dismissBtns = Array.from(document.querySelectorAll('button'));
      const closeBtn = dismissBtns.find(b => b.textContent && (b.textContent.includes('Get Started') || b.textContent.includes('Close') || b.textContent.includes('Skip') || b.textContent.includes('Continue')));
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot 1: Dashboard
  console.log('[Store Assets Generator] Capturing 1: Dashboard...');
  let cap1 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
  let buf1 = cap1.toPNG();
  // Ensure strict 1920x1080 via sharp if needed
  let final1 = await sharp(buf1).resize(1920, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '01_Screenshot_1_Dashboard_1920x1080.png'), final1);

  // Screenshot 2: Title Adder
  console.log('[Store Assets Generator] Navigating to Title Adder...');
  await win.webContents.executeJavaScript(`
    (() => {
      const items = Array.from(document.querySelectorAll('.nav-item, button, [role=\"button\"]'));
      const target = items.find(el => el.textContent && el.textContent.includes('Title Adder'));
      if (target) target.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));
  let cap2 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
  let final2 = await sharp(cap2.toPNG()).resize(1920, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '01_Screenshot_2_TitleAdder_1920x1080.png'), final2);

  // Screenshot 3: Video Transfer / Converter
  console.log('[Store Assets Generator] Navigating to Converter / Video Transfer...');
  await win.webContents.executeJavaScript(`
    (() => {
      const items = Array.from(document.querySelectorAll('.nav-item, button, [role=\"button\"]'));
      const target = items.find(el => el.textContent && (el.textContent.includes('Converter') || el.textContent.includes('PNG → JPG') || el.textContent.includes('Match Video')));
      if (target) target.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));
  let cap3 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
  let final3 = await sharp(cap3.toPNG()).resize(1920, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '01_Screenshot_3_MediaConverter_1920x1080.png'), final3);

  // Screenshot 4: Archive Vault / Stats
  console.log('[Store Assets Generator] Navigating to Archive Vault / Stats...');
  await win.webContents.executeJavaScript(`
    (() => {
      const items = Array.from(document.querySelectorAll('.nav-item, button, [role=\"button\"]'));
      const target = items.find(el => el.textContent && (el.textContent.includes('Archive') || el.textContent.includes('Vault') || el.textContent.includes('Stats') || el.textContent.includes('Settings')));
      if (target) target.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));
  let cap4 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
  let final4 = await sharp(cap4.toPNG()).resize(1920, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '01_Screenshot_4_ArchiveVault_1920x1080.png'), final4);

  // Copy and strictly guarantee 1:1 Box Art (1080x1080)
  console.log('[Store Assets Generator] Formatting 1:1 Box Art (1080x1080)...');
  const boxArtSrc = path.join(__dirname, '../website/assets/store_box_art_1080x1080.png');
  const boxArtIconSrc = path.join(__dirname, '../website/assets/store_box_art_icon_1080x1080.png');

  if (fs.existsSync(boxArtSrc)) {
    const boxBuf = await sharp(boxArtSrc).resize(1080, 1080, { fit: 'fill' }).png().toBuffer();
    fs.writeFileSync(path.join(storeDir, '02_Store_Logo_1x1_BoxArt_1080x1080.png'), boxBuf);
  }
  if (fs.existsSync(boxArtIconSrc)) {
    const boxIconBuf = await sharp(boxArtIconSrc).resize(1080, 1080, { fit: 'fill' }).png().toBuffer();
    fs.writeFileSync(path.join(storeDir, '02_Store_Logo_1x1_BoxArt_IconOnly_1080x1080.png'), boxIconBuf);
  }

  // Copy and strictly guarantee 2:3 Poster Art (720x1080)
  console.log('[Store Assets Generator] Formatting 2:3 Poster Art (720x1080)...');
  const posterSrc = path.join(__dirname, '../website/assets/store_poster_art_720x1080.png');
  if (fs.existsSync(posterSrc)) {
    const posterBuf = await sharp(posterSrc).resize(720, 1080, { fit: 'fill' }).png().toBuffer();
    fs.writeFileSync(path.join(storeDir, '03_Poster_Art_2x3_720x1080.png'), posterBuf);
  }

  // Also update website/assets/ and website/microsoft_store_import/ so everything is synced
  const webAssets = path.join(__dirname, '../website/assets');
  fs.copyFileSync(path.join(storeDir, '01_Screenshot_1_Dashboard_1920x1080.png'), path.join(webAssets, 'store_screenshot_1_dashboard.png'));
  fs.copyFileSync(path.join(storeDir, '01_Screenshot_2_TitleAdder_1920x1080.png'), path.join(webAssets, 'store_screenshot_2_converter.png'));
  fs.copyFileSync(path.join(storeDir, '01_Screenshot_3_MediaConverter_1920x1080.png'), path.join(webAssets, 'store_screenshot_3_vault.png'));
  fs.copyFileSync(path.join(storeDir, '01_Screenshot_4_ArchiveVault_1920x1080.png'), path.join(webAssets, 'store_screenshot_4_stats.png'));

  console.log('[Store Assets Generator] All assets generated successfully in:', storeDir);
  app.quit();
});
