const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

function registerIpcMocks() {
  const handle = (ch, fn) => {
    try { ipcMain.handle(ch, fn); } catch (e) {}
  };

  handle('update:getCurrentVersion', () => '26.10.12');
  handle('settings:getAll', () => ({
    auto_check_updates: false,
    default_output_dir: 'D:/Projects/Exports',
    theme: 'glass',
    sound_enabled: true
  }));
  handle('settings:get', (e, k, def) => def !== undefined ? def : null);
  handle('settings:needsSetup', () => false);
  handle('settings:setAndSave', () => true);
  handle('settings:set', () => true);
  handle('settings:isConfirmDisabled', () => false);
  handle('ffmpeg:check', () => ({ ok: true, version: '6.1.1' }));
  handle('system:getStats', () => ({ cpu: 28, ram: 44, disk: 36 }));
  handle('titleAdder:getAvailablePrefixes', () => ['001 Z01', '002 Reception']);
  handle('titleAdder:previewAudioAssignments', () => []);
  handle('titleAutomode:getSettings', () => ({ enabled: true }));
  handle('statsDb:getAll', () => []);
  handle('archiveCatalog:getCached', () => []);
  handle('archiveCatalog:listDrives', () => []);
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
    console.log('[CONSOLE]', msg);
  });

  await win.loadFile(path.join(__dirname, '../out/renderer/index.html'));
  await new Promise(r => setTimeout(r, 4000));

  console.log('--- Navigating to dashboard ---');
  const res = await win.webContents.executeJavaScript(`
    (() => {
      try {
        window.showPage('dashboard');
        return 'navigated';
      } catch (err) {
        return err.stack;
      }
    })()
  `);
  console.log('Nav result:', res);
  await new Promise(r => setTimeout(r, 2000));

  const domCheck = await win.webContents.executeJavaScript(`
    (() => {
      const db = document.querySelector('.db-page');
      const err = document.querySelector('.error-boundary, [class*="error"]');
      return {
        hasDbPage: !!db,
        hasError: !!err,
        bodyHtmlSnippet: document.body.innerHTML.substring(0, 500)
      };
    })()
  `);
  console.log('DOM check:', domCheck);

  app.quit();
});
