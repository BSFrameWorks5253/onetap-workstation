const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Ensure offscreen rendering or standard window
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  console.log('[Screenshot] App ready, creating window...');
  
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, '../out/preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererPath = path.join(__dirname, '../out/renderer/index.html');
  console.log('[Screenshot] Loading renderer:', rendererPath);
  await win.loadFile(rendererPath);

  // Wait for initial React mounting & splash animation to clear
  console.log('[Screenshot] Waiting for animations to settle (5s)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Capture Main Dashboard / Workstation view
  const img1 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
  const outPath1 = path.join(__dirname, '../website/assets/store_screenshot_1_dashboard.png');
  fs.writeFileSync(outPath1, img1.toPNG());
  console.log('[Screenshot] Saved:', outPath1);

  // Also save as primary store screenshot and copy to import folder
  const primaryStorePath = path.join(__dirname, '../website/assets/store_screenshot_1920x1080.png');
  fs.writeFileSync(primaryStorePath, img1.toPNG());

  const importFolderStorePath = path.join(__dirname, '../website/microsoft_store_import/store_screenshot_1920x1080.png');
  fs.writeFileSync(importFolderStorePath, img1.toPNG());

  // Try navigating or clicking sidebar items if possible via executeJavaScript
  try {
    const navSuccess = await win.webContents.executeJavaScript(`
      (() => {
        // Try clicking on 'Title Adder' or 'Converter' tab if available in DOM
        const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], div[class*="item"], div[class*="nav"]'));
        const converterBtn = buttons.find(b => b.textContent && (b.textContent.includes('Converter') || b.textContent.includes('Title Adder') || b.textContent.includes('Archive')));
        if (converterBtn) {
          converterBtn.click();
          return converterBtn.textContent.trim();
        }
        return 'no-btn';
      })()
    `);
    console.log('[Screenshot] Clicked module:', navSuccess);
    await new Promise(resolve => setTimeout(resolve, 2500));

    const img2 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
    const outPath2 = path.join(__dirname, '../website/assets/store_screenshot_2_converter.png');
    fs.writeFileSync(outPath2, img2.toPNG());
    console.log('[Screenshot] Saved:', outPath2);
  } catch (err) {
    console.warn('[Screenshot] Secondary navigation notice:', err.message);
  }

  // Try third view (Settings or Archive Vault)
  try {
    const navSuccess2 = await win.webContents.executeJavaScript(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], div[class*="item"], div[class*="nav"]'));
        const vaultBtn = buttons.find(b => b.textContent && (b.textContent.includes('Archive') || b.textContent.includes('Vault') || b.textContent.includes('Stats') || b.textContent.includes('Settings')));
        if (vaultBtn) {
          vaultBtn.click();
          return vaultBtn.textContent.trim();
        }
        return 'no-btn';
      })()
    `);
    console.log('[Screenshot] Clicked module 2:', navSuccess2);
    await new Promise(resolve => setTimeout(resolve, 2500));

    const img3 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
    const outPath3 = path.join(__dirname, '../website/assets/store_screenshot_3_vault.png');
    fs.writeFileSync(outPath3, img3.toPNG());
    console.log('[Screenshot] Saved:', outPath3);
  } catch (err) {
    console.warn('[Screenshot] Tertiary navigation notice:', err.message);
  }

  console.log('[Screenshot] All screenshots captured successfully.');
  app.quit();
});
