const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1920, height: 1080, show: false });
  await win.loadFile(path.join(__dirname, '../out/renderer/index.html'));
  await new Promise(r => setTimeout(r, 2000));

  await win.webContents.executeJavaScript(`
    const o = document.querySelector('.welcome-screen-overlay');
    if (o) o.click();
  `);
  await new Promise(r => setTimeout(r, 1000));

  await win.webContents.executeJavaScript(`
    if (window.showPage) window.showPage('dashboard');
  `);
  await new Promise(r => setTimeout(r, 2500));

  const check = await win.webContents.executeJavaScript(`
    (() => {
      const db = document.querySelector('.db-page');
      return {
        hasDb: !!db,
        cardsCount: db ? db.querySelectorAll('.card').length : 0
      };
    })()
  `);
  console.log('Result after 2.5s:', check);
  app.quit();
});
