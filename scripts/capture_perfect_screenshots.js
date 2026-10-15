const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

const mockRecords = [];
const prefixes = ['001 Z01', '002 Reception', '003 Nikah', '004 Family Portraits', '005 Dinner Highlights', '006 Ceremony'];
const cities = ['Mumbai', 'Surat', 'Dubai', 'London', 'Ahmedabad', 'Udaipur'];
const safars = ['Safar 1446 - Mumbai', 'Safar 1446 - Surat', 'Safar 1447 - Dubai', 'Safar 1447 - London'];
const now = Date.now();

for (let i = 0; i < 48; i++) {
  const p = prefixes[i % prefixes.length];
  const c = cities[i % cities.length];
  const s = safars[i % safars.length];
  mockRecords.push({
    prefix: p.split(' ')[0],
    name: p,
    date: now - (i * 3600 * 1000 * 5),
    folder: '2026_Event_' + c + '_Vol' + ((i % 5) + 1),
    duration: 180 + (i * 45),
    city: c,
    safar: s,
    safarYear: 1447,
    isReedit: i % 8 === 0
  });
}

const mockMatchedVideos = [
  {
    id: 'vt-1',
    videoPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Video\\001 Z01 Groom Entry.mp4',
    videoName: '001 Z01 Groom Entry.mp4',
    thumbnailPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-14 _02E-QMZ\\001 Z01\\001 Z01.jpg',
    thumbnailName: '001 Z01.jpg',
    photoFolderPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-14 _02E-QMZ\\001 Z01 Groom Entry',
    photoFolderName: '001 Z01 Groom Entry',
    dateFolderName: '1448-01-14 _02E-QMZ',
    sequence: '001',
    prefix: 'Z01',
    namePart: 'Groom Entry',
    status: 'APPROVED',
    isMatched: true
  },
  {
    id: 'vt-2',
    videoPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Video\\002 Z02 Bride Arrival.mp4',
    videoName: '002 Z02 Bride Arrival.mp4',
    thumbnailPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-14 _02E-QMZ\\002 Z02\\002 Z02.jpg',
    thumbnailName: '002 Z02.jpg',
    photoFolderPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-14 _02E-QMZ\\002 Z02 Bride Arrival',
    photoFolderName: '002 Z02 Bride Arrival',
    dateFolderName: '1448-01-14 _02E-QMZ',
    sequence: '002',
    prefix: 'Z02',
    namePart: 'Bride Arrival',
    status: 'APPROVED',
    isMatched: true
  },
  {
    id: 'vt-3',
    videoPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Video\\003 Q01 Nikah Ceremony.mp4',
    videoName: '003 Q01 Nikah Ceremony.mp4',
    thumbnailPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-14 _02E-QMZ\\003 Q01\\003 Q01.jpg',
    thumbnailName: '003 Q01.jpg',
    photoFolderPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-14 _02E-QMZ\\003 Q01 Nikah Ceremony',
    photoFolderName: '003 Q01 Nikah Ceremony',
    dateFolderName: '1448-01-14 _02E-QMZ',
    sequence: '003',
    prefix: 'Q01',
    namePart: 'Nikah Ceremony',
    status: 'APPROVED',
    isMatched: true
  },
  {
    id: 'vt-4',
    videoPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Video\\004 Q02 Stage & Family.mp4',
    videoName: '004 Q02 Stage & Family.mp4',
    thumbnailPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-14 _02E-QMZ\\004 Q02\\004 Q02.jpg',
    thumbnailName: '004 Q02.jpg',
    photoFolderPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-14 _02E-QMZ\\004 Q02 Stage & Family',
    photoFolderName: '004 Q02 Stage & Family',
    dateFolderName: '1448-01-14 _02E-QMZ',
    sequence: '004',
    prefix: 'Q02',
    namePart: 'Stage & Family',
    status: 'APPROVED',
    isMatched: true
  },
  {
    id: 'vt-5',
    videoPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Video\\005 MZ01 Dinner Banquet.mp4',
    videoName: '005 MZ01 Dinner Banquet.mp4',
    thumbnailPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-15 _03E-QMZ\\005 MZ01\\005 MZ01.jpg',
    thumbnailName: '005 MZ01.jpg',
    photoFolderPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-15 _03E-QMZ\\005 MZ01 Dinner Banquet',
    photoFolderName: '005 MZ01 Dinner Banquet',
    dateFolderName: '1448-01-15 _03E-QMZ',
    sequence: '005',
    prefix: 'MZ01',
    namePart: 'Dinner Banquet',
    status: 'APPROVED',
    isMatched: true
  },
  {
    id: 'vt-6',
    videoPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Video\\006 MZ02 Highlights Master.mp4',
    videoName: '006 MZ02 Highlights Master.mp4',
    thumbnailPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-15 _03E-QMZ\\006 MZ02\\006 MZ02.jpg',
    thumbnailName: '006 MZ02.jpg',
    photoFolderPath: 'D:\\Raw_Footage\\2026_Royal_Event\\Photo\\1448-01-15 _03E-QMZ\\006 MZ02 Highlights Master',
    photoFolderName: '006 MZ02 Highlights Master',
    dateFolderName: '1448-01-15 _03E-QMZ',
    sequence: '006',
    prefix: 'MZ02',
    namePart: 'Highlights Master',
    status: 'APPROVED',
    isMatched: true
  }
];

function registerIpcMocks() {
  const handle = (ch, fn) => {
    try { ipcMain.handle(ch, fn); } catch (e) {}
  };

  handle('update:getCurrentVersion', () => '26.10.12');
  handle('settings:getAll', () => ({
    auto_check_updates: false,
    default_output_dir: 'D:/Exports/Final_Client_Deliverables_4K',
    theme: 'glass',
    sound_enabled: true,
    render_stats: mockRecords
  }));
  handle('settings:get', (e, k, def) => def !== undefined ? def : null);
  handle('settings:needsSetup', () => false);
  handle('settings:setAndSave', () => true);
  handle('settings:set', () => true);
  handle('settings:isConfirmDisabled', () => false);
  handle('ffmpeg:check', () => ({ ok: true, version: '6.1.1' }));
  
  handle('system:getStats', () => ({ cpu: 38, ram: 54, disk: 42 }));
  handle('system:getDrives', () => ['C:\\', 'D:\\', 'E:\\', 'F:\\']);
  handle('system:getDriveSpace', () => ({ totalGB: 2048, freeGB: 1420 }));
  
  handle('audio:describeMode', () => 'Single → Audio 1');
  handle('audio:poolInfo', () => 'Pool: Royal_Theme · Celebration_Orchestra · Golden_Hour (12 loaded)');
  handle('audio:getPool', () => ({
    songs: [
      { name: 'Royal_Cinematic_Theme.mp3', path: 'D:/Audio/Royal_Theme.mp3', duration: 180 },
      { name: 'Celebration_String_Orchestra.wav', path: 'D:/Audio/Celebration.wav', duration: 240 }
    ]
  }));
  handle('audio:validatePrefixes', () => ({ valid: true }));

  handle('titleAdder:listVideos', () => [
    '001 Z01 Groom Entry.mp4',
    '002 Z02 Bride Arrival.mp4',
    '003 Q01 Royal Nikah.mp4',
    '004 Q02 Family Portraits.mp4',
    '005 Banquet & Celebrations.mp4'
  ]);
  handle('titleAdder:getAvailablePrefixes', () => [
    '001 Z01 Groom Entry',
    '002 Bride Arrival',
    '003 Royal Nikah Ceremony',
    '004 Family Portraits & Stage',
    '005 Banquet & Celebrations'
  ]);
  handle('titleAdder:previewAudioAssignments', () => []);
  handle('titleAdder:validatePath', () => ({ valid: true }));
  handle('titleAutomode:getSettings', () => ({ enabled: true, autoQueue: true }));
  handle('converter:canUndo', () => false);

  handle('statsDb:getAll', () => mockRecords);
  handle('statsDb:insertRecords', () => true);

  handle('dialog:openFolder', () => 'D:\\Raw_Footage\\2026_Royal_Event_Master');

  handle('videoTransfer:scanFolder', () => ({
    success: true,
    videoFolderPath: 'D:\\Raw_Footage\\2026_Royal_Event_Master\\Video',
    photoFolderPath: 'D:\\Raw_Footage\\2026_Royal_Event_Master\\Photo',
    dateFolders: [
      { name: '1448-01-14 _02E-QMZ', videoCount: 4, photoFolderCount: 4 },
      { name: '1448-01-15 _03E-QMZ', videoCount: 2, photoFolderCount: 2 }
    ],
    photoFoldersByDate: {},
    matched: mockMatchedVideos,
    unmatched: [],
    isApproved: true
  }));

  handle('videoTransfer:checkDryRun', () => ({
    success: true,
    totalBytes: 15247180000,
    fileCount: 6,
    freeBytes: 1982293000000,
    hasSufficientSpace: true
  }));

  handle('archiveCatalog:getCached', () => []);
  handle('archiveCatalog:listDrives', () => [
    { drive: 'D:', label: 'Production_NVMe', freeGB: 1420, totalGB: 2000 },
    { drive: 'E:', label: 'Archive_Vault_RAID', freeGB: 4120, totalGB: 8000 }
  ]);
}

app.whenReady().then(async () => {
  console.log('[Studio Capture] Starting high-fidelity screenshot generator...');
  registerIpcMocks();

  const storeDir = path.join(__dirname, '../Microsoft_Store_Assets');
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    useContentSize: true,
    show: false,
    frame: false,
    backgroundColor: '#07090e',
    webPreferences: {
      preload: path.join(__dirname, '../out/preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setContentSize(1920, 1080);
  await win.loadFile(path.join(__dirname, '../out/renderer/index.html'));

  // Pre-seed storage
  await win.webContents.executeJavaScript(`
    (() => {
      localStorage.setItem('welcome_dismissed', 'true');
      localStorage.setItem('last_welcomed_version', '26.10.12');
      localStorage.setItem('ot_zoom_level', '1.0');
      localStorage.setItem('sidebar_collapsed', 'false');
      localStorage.setItem('render_stats', JSON.stringify(${JSON.stringify(mockRecords)}));
      window.dispatchEvent(new Event('stats-updated'));
    })()
  `);

  await new Promise(r => setTimeout(r, 2000));

  // Dismiss welcome overlay
  await win.webContents.executeJavaScript(`
    (() => {
      const o = document.querySelector('.welcome-screen-overlay');
      if (o) o.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1500));

  async function clickNav(label, waitMs = 3500) {
    console.log(`[Studio Capture] Navigating to ${label}...`);
    await win.webContents.executeJavaScript(`
      (() => {
        const item = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent.includes('${label}'));
        if (item) item.click();
      })()
    `);
    await new Promise(r => setTimeout(r, waitMs));
  }

  // =============================================================
  // 1. SCREENSHOT 1: DASHBOARD
  // =============================================================
  await clickNav('Dashboard', 4000);
  await win.webContents.executeJavaScript(`
    (() => {
      const fillCpu = document.querySelector('.hw-fill--cpu');
      if (fillCpu) fillCpu.style.width = '38%';
      const valCpu = fillCpu ? fillCpu.parentElement.nextElementSibling : null;
      if (valCpu) valCpu.textContent = '38%';

      const fillRam = document.querySelector('.hw-fill--ram');
      if (fillRam) fillRam.style.width = '54%';
      const valRam = fillRam ? fillRam.parentElement.nextElementSibling : null;
      if (valRam) valRam.textContent = '54%';

      const fillDisk = document.querySelector('.hw-fill--disk');
      if (fillDisk) fillDisk.style.width = '42%';
      const valDisk = fillDisk ? fillDisk.parentElement.nextElementSibling : null;
      if (valDisk) valDisk.textContent = '42%';
    })()
  `);
  await new Promise(r => setTimeout(r, 500));
  let cap1 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
  let buf1 = await sharp(cap1.toPNG()).resize(1920, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '01_Screenshot_1_Dashboard_1920x1080.png'), buf1);
  console.log('[Studio Capture] Wrote 01_Screenshot_1_Dashboard_1920x1080.png');

  // =============================================================
  // 2. SCREENSHOT 2: TITLE ADDER (BATCH VIDEO WORKSTATION)
  // =============================================================
  await clickNav('Title Adder', 3500);
  await win.webContents.executeJavaScript(`
    (() => {
      const audioLabel = document.querySelector('.ta-audio-header, .ta-audio-status, div[class*="audio-status"]');
      if (audioLabel) {
        audioLabel.textContent = 'Audio: Single → Audio 1 · Pool: 12 Master Tracks (Smart Rotation)';
      }

      const chips = document.querySelectorAll('.ta-ws-chip, div[class*="chip"]');
      chips.forEach(chip => {
        const text = chip.textContent || '';
        if (text.includes('Found')) chip.innerHTML = '<span style="color:#38bdf8;font-weight:800;">● Found: 24</span>';
        if (text.includes('Completed')) chip.innerHTML = '<span style="color:#4ade80;font-weight:800;">● Completed: 18</span>';
        if (text.includes('Pending')) chip.innerHTML = '<span style="color:#fbbf24;font-weight:800;">● Pending: 6</span>';
      });

      const dropzone = document.querySelector('.ta-queue-empty-dropzone');
      if (dropzone) {
        dropzone.outerHTML = \`
          <div class="ta-queue-list">
            <div class="ta-queue-item">
              <div class="ta-queue-item-order">
                <div class="ta-order-pill primary">
                  <span class="ta-order-num">#1</span>
                  <span class="ta-order-label">1st</span>
                </div>
              </div>
              <div class="ta-queue-item-content">
                <div class="ta-queue-folder-icon">📂</div>
                <div class="ta-queue-folder-meta">
                  <span class="ta-queue-folder-name" style="font-weight:700;color:#f1f5f9;">Royal_Palace_Event (DVD)</span>
                  <span class="ta-queue-folder-path" style="color:#94a3b8;font-size:12px;">D:\\\\Workstation_2026\\\\Royal_Palace_Event\\\\DVD &bull; 14 Master Clips</span>
                </div>
              </div>
              <div class="ta-queue-item-actions">
                <span style="font-size:11px;font-weight:800;color:#4ade80;background:rgba(74,222,128,0.15);padding:4px 10px;border-radius:12px;border:1px solid rgba(74,222,128,0.3);">READY TO ENCODE</span>
              </div>
            </div>

            <div class="ta-queue-item" style="margin-top:8px;">
              <div class="ta-queue-item-order">
                <div class="ta-order-pill">
                  <span class="ta-order-num">#2</span>
                  <span class="ta-order-label">2nd</span>
                </div>
              </div>
              <div class="ta-queue-item-content">
                <div class="ta-queue-folder-icon">📂</div>
                <div class="ta-queue-folder-meta">
                  <span class="ta-queue-folder-name" style="font-weight:700;color:#f1f5f9;">Surat_Safar_Celebration (DVD)</span>
                  <span class="ta-queue-folder-path" style="color:#94a3b8;font-size:12px;">D:\\\\Workstation_2026\\\\Surat_Safar_Celebration\\\\DVD &bull; 10 Master Clips</span>
                </div>
              </div>
              <div class="ta-queue-item-actions">
                <span style="font-size:11px;font-weight:800;color:#38bdf8;background:rgba(56,189,248,0.15);padding:4px 10px;border-radius:12px;border:1px solid rgba(56,189,248,0.3);">QUEUED</span>
              </div>
            </div>

            <div class="ta-queue-item" style="margin-top:8px;">
              <div class="ta-queue-item-order">
                <div class="ta-order-pill">
                  <span class="ta-order-num">#3</span>
                  <span class="ta-order-label">3rd</span>
                </div>
              </div>
              <div class="ta-queue-item-content">
                <div class="ta-queue-folder-icon">📂</div>
                <div class="ta-queue-folder-meta">
                  <span class="ta-queue-folder-name" style="font-weight:700;color:#f1f5f9;">London_Keynote_Master (DVD)</span>
                  <span class="ta-queue-folder-path" style="color:#94a3b8;font-size:12px;">D:\\\\Workstation_2026\\\\London_Keynote_Master\\\\DVD &bull; 8 Master Clips</span>
                </div>
              </div>
              <div class="ta-queue-item-actions">
                <span style="font-size:11px;font-weight:800;color:#38bdf8;background:rgba(56,189,248,0.15);padding:4px 10px;border-radius:12px;border:1px solid rgba(56,189,248,0.3);">QUEUED</span>
              </div>
            </div>
          </div>
        \`;
      }

      const inputs = Array.from(document.querySelectorAll('input'));
      inputs.forEach(inp => {
        const ph = (inp.placeholder || '').toLowerCase();
        if (ph.includes('output') || ph.includes('save') || ph.includes('destination')) {
          inp.value = 'D:\\\\Exports\\\\Final_Client_Deliverables_4K';
        }
      });

      const buttons = Array.from(document.querySelectorAll('button'));
      buttons.forEach(btn => {
        if (btn.textContent.includes('Start Batch Render')) {
          btn.removeAttribute('disabled');
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
          btn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
          btn.style.color = '#ffffff';
          btn.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.5)';
        }
      });
    })()
  `);
  await new Promise(r => setTimeout(r, 600));
  let cap2 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
  let buf2 = await sharp(cap2.toPNG()).resize(1920, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '01_Screenshot_2_TitleAdder_1920x1080.png'), buf2);
  console.log('[Studio Capture] Wrote 01_Screenshot_2_TitleAdder_1920x1080.png');

  // =============================================================
  // 3. SCREENSHOT 3: MATCH VIDEO TRANSFER & SEQUENCE MATCHER
  // =============================================================
  await clickNav('Match Video Transfer', 3500);
  // Trigger scan via clicking Master browse button
  console.log('[Studio Capture] Triggering Match Video Transfer scan...');
  await win.webContents.executeJavaScript(`
    (() => {
      const browseBtns = Array.from(document.querySelectorAll('.browse-btn'));
      if (browseBtns.length > 0) {
        browseBtns[0].click();
      }
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));

  await win.webContents.executeJavaScript(`
    (() => {
      const interval = setInterval(() => {
        const headers = Array.from(document.querySelectorAll('.card-header, div[class*="header"]'));
        const targetHeader = headers.find(h => (h.textContent || '').includes('1. Select Input Directories'));
        if (targetHeader) {
          const card = targetHeader.closest('.card') || targetHeader.parentElement;
          if (card) card.remove();
        }
        const tableWrapper = document.querySelector('.vt-table')?.parentElement;
        if (tableWrapper) {
          tableWrapper.style.maxHeight = 'none';
        }
      }, 50);
      setTimeout(() => clearInterval(interval), 5000);
    })()
  `);
  await new Promise(r => setTimeout(r, 2500));

  let cap3 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
  let buf3 = await sharp(cap3.toPNG()).resize(1920, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '01_Screenshot_3_MediaConverter_1920x1080.png'), buf3);
  console.log('[Studio Capture] Wrote 01_Screenshot_3_MediaConverter_1920x1080.png');

  // =============================================================
  // 4. SCREENSHOT 4: STATS & ANALYTICS VAULT
  // =============================================================
  await clickNav('Stats', 3500);
  let cap4 = await win.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
  let buf4 = await sharp(cap4.toPNG()).resize(1920, 1080, { fit: 'fill' }).png().toBuffer();
  fs.writeFileSync(path.join(storeDir, '01_Screenshot_4_ArchiveVault_1920x1080.png'), buf4);
  console.log('[Studio Capture] Wrote 01_Screenshot_4_ArchiveVault_1920x1080.png');

  // Mirror all to website/assets
  const webAssets = path.join(__dirname, '../website/assets');
  fs.copyFileSync(path.join(storeDir, '01_Screenshot_1_Dashboard_1920x1080.png'), path.join(webAssets, 'store_screenshot_1_dashboard.png'));
  fs.copyFileSync(path.join(storeDir, '01_Screenshot_2_TitleAdder_1920x1080.png'), path.join(webAssets, 'store_screenshot_2_converter.png'));
  fs.copyFileSync(path.join(storeDir, '01_Screenshot_3_MediaConverter_1920x1080.png'), path.join(webAssets, 'store_screenshot_3_vault.png'));
  fs.copyFileSync(path.join(storeDir, '01_Screenshot_4_ArchiveVault_1920x1080.png'), path.join(webAssets, 'store_screenshot_4_stats.png'));

  console.log('[Studio Capture] All 4 perfect screenshots successfully refreshed!');
  app.quit();
});
