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
  handle('audio:describeMode', () => 'Smart Multi-Track Sequential');
  handle('audio:getPool', () => ({ songs: [] }));
  handle('audio:validatePrefixes', () => ({ valid: true }));
  handle('audio:poolInfo', () => ({ total: 12 }));
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

  await win.loadFile(path.join(__dirname, '../out/renderer/index.html'));
  await new Promise(r => setTimeout(r, 3000));

  const pages = ['dashboard', 'adder', 'videotransfer', 'stats'];
  for (const p of pages) {
    await win.webContents.executeJavaScript(`window.showPage('${p}')`);
    await new Promise(r => setTimeout(r, 1500));
    const info = await win.webContents.executeJavaScript(`
      (() => {
        const wrap = document.querySelector('.page-wrapper');
        const firstChild = wrap ? wrap.firstElementChild : null;
        return {
          page: '${p}',
          wrapClass: wrap ? wrap.className : null,
          childClass: firstChild ? firstChild.className : null,
          htmlLength: wrap ? wrap.innerHTML.length : 0
        };
      })()
    `);
    console.log('Page check:', info);
  }

  app.quit();
});
