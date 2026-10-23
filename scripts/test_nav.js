const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

const mockRecords = [];
for (let i = 0; i < 48; i++) {
  mockRecords.push({
    prefix: '00' + ((i % 5) + 1),
    name: '00' + ((i % 5) + 1) + ' Event Session',
    date: Date.now() - (i * 3600 * 1000 * 5),
    folder: '2026_Event_Mumbai_Vol' + ((i % 5) + 1),
    duration: 240,
    city: 'Mumbai',
    safar: 'Safar 1447 - Mumbai',
    safarYear: 1447,
    isReedit: false
  });
}

function registerIpcMocks() {
  const handle = (ch, fn) => {
    try { ipcMain.handle(ch, fn); } catch (e) {}
  };
  handle('update:getCurrentVersion', () => '26.10.12');
  handle('settings:getAll', () => ({
    auto_check_updates: false,
    default_output_dir: 'D:/Exports',
    theme: 'glass',
    sound_enabled: true,
    render_stats: mockRecords
  }));
  handle('settings:get', (e, k, def) => def !== undefined ? def : null);
  handle('settings:needsSetup', () => false);
  handle('settings:setAndSave', () => true);
  handle('settings:set', () => true);
  handle('system:getStats', () => ({ cpu: 38, ram: 54, disk: 42 }));
  handle('audio:describeMode', () => 'Single → Audio 1');
  handle('audio:poolInfo', () => 'Pool: 12 tracks loaded');
  handle('audio:getPool', () => ({ songs: [] }));
  handle('audio:validatePrefixes', () => ({ valid: true }));
  handle('titleAdder:listVideos', () => []);
  handle('titleAdder:getAvailablePrefixes', () => []);
  handle('converter:canUndo', () => false);
  handle('statsDb:getAll', () => mockRecords);
}

app.whenReady().then(async () => {
  registerIpcMocks();

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../out/preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  });

  win.webContents.on('console-message', (e, level, msg) => {
    console.log(`[Browser L${level}] ${msg}`);
  });

  await win.loadFile(path.join(__dirname, '../out/renderer/index.html'));

  // Pre-seed storage
  await win.webContents.executeJavaScript(`
    localStorage.setItem('welcome_dismissed', 'true');
    localStorage.setItem('render_stats', JSON.stringify(${JSON.stringify(mockRecords)}));
  `);
  await new Promise(r => setTimeout(r, 1500));

  // Dismiss welcome screen
  await win.webContents.executeJavaScript(`
    const o = document.querySelector('.welcome-screen-overlay');
    if (o) o.click();
  `);
  await new Promise(r => setTimeout(r, 1500));

  // Click Dashboard nav-item
  console.log('[Test] Clicking Dashboard nav item...');
  const clicked = await win.webContents.executeJavaScript(`
    (() => {
      const item = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent.includes('Dashboard'));
      if (item) {
        item.click();
        return true;
      }
      return false;
    })()
  `);
  console.log('[Test] Clicked dashboard:', clicked);

  // Wait 4s and check DOM
  await new Promise(r => setTimeout(r, 4000));
  const res = await win.webContents.executeJavaScript(`
    (() => {
      const pageWrap = document.querySelector('.page-wrapper');
      return {
        activePageAttr: pageWrap?.getAttribute('data-page'),
        childrenCount: pageWrap?.children.length,
        innerHTMLSnippet: pageWrap?.innerHTML.slice(0, 400)
      };
    })()
  `);
  console.log('[Test] After click result:', JSON.stringify(res, null, 2));

  app.quit();
});
