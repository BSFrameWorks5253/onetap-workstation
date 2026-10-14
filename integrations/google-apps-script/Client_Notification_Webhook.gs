// ==============================================================================
// ONE TAP WORKSTATION — CLIENT NOTIFICATION, EMAIL BROADCAST & ADMIN OTP WEBHOOK
// ==============================================================================
// Handles:
// 1. Silent Client Registration – name, email, version, device ID from client PCs.
// 2. Google Sheet Storage – all registered clients in the first/active sheet.
// 3. Email Broadcast – HTML announcement emails via Google's free MailApp quota.
// 4. Admin Management – promote/revoke admin status via "Admins" sheet tab.
// 5. Admin OTP Auth – 6-digit time-limited OTP emailed FREE via MailApp.
//
// ──────────────────────────────────────────────────────────────────────────────
// SETUP (Takes ~60 Seconds)
// ──────────────────────────────────────────────────────────────────────────────
// 1. Open https://sheets.new → name it "One Tap Clients".
// 2. Extensions > Apps Script → delete all → paste this file → Ctrl + S.
// 3. Deploy > New Deployment > Web App:
//    Execute as: Me (your Google account)
//    Who has access: Anyone
// 4. Copy the Web App URL → paste in One Tap (Ctrl + J → Webhook Setup).
//
// NOTE: OTP emails are sent FREE via MailApp (no SMTP setup needed).
// ==============================================================================

// ──────────────────────────────────────────────────────────────────────────────
// CUSTOM SHEET MENU
// ──────────────────────────────────────────────────────────────────────────────
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('👑 One Tap Admin')
    .addItem('👥 Manage Admin Access', 'showAdminManagerUI')
    .addItem('📊 View Client List', 'showClientListUI')
    .addSeparator()
    .addItem('ℹ️ About', 'showAboutDialog')
    .addToUi();
}

function showAdminManagerUI() {
  var html = HtmlService.createHtmlOutput(buildAdminManagerHTML())
    .setWidth(720).setHeight(560).setTitle('👑 Admin Access Manager');
  SpreadsheetApp.getUi().showModalDialog(html, '👑 Admin Access Manager');
}

function showClientListUI() {
  var html = HtmlService.createHtmlOutput(buildClientListHTML())
    .setWidth(700).setHeight(520).setTitle('📊 Registered Clients');
  SpreadsheetApp.getUi().showModalDialog(html, '📊 Registered Clients');
}

function showAboutDialog() {
  SpreadsheetApp.getUi().alert(
    'ℹ️ One Tap Workstation Webhook v1.3.0',
    'Registration, Broadcast, Admin OTP Auth — all 100% FREE via Google MailApp.\nOTPs expire in 10 minutes.\nAdmins unlock "AI Rules & OTA" and "Admin Page" tabs.\n\nBuilt by BSFrameWorks 5253.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SERVER-SIDE FUNCTIONS (called from HTML dialogs)
// ──────────────────────────────────────────────────────────────────────────────
function getAdminListForUI() {
  var adminSheet = getOrCreateAdminsSheet();
  var rows = adminSheet.getDataRange().getValues();
  var admins = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) {
      admins.push({
        email: rows[i][0].toString().trim(),
        name: rows[i][1] || 'Unknown',
        addedDate: rows[i][2] ? rows[i][2].toString() : '',
        status: rows[i][3] || 'Active'
      });
    }
  }
  return admins;
}

function getClientListForUI() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var rows = sheet.getDataRange().getValues();
  var clients = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][2] && rows[i][2].toString().indexOf('@') !== -1) {
      clients.push({
        registeredAt: rows[i][0] ? rows[i][0].toString() : '',
        name: rows[i][1] || 'Client',
        email: rows[i][2].toString().trim(),
        appVersion: rows[i][3] || ''
      });
    }
  }
  return clients;
}

function makeAdminFromUI(email, name) {
  if (!email || email.indexOf('@') === -1) return { success: false, error: 'Invalid email' };
  var adminSheet = getOrCreateAdminsSheet();
  var rows = adminSheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString().trim().toLowerCase() === email.toLowerCase()) {
      adminSheet.getRange(i + 1, 3).setValue(new Date());
      adminSheet.getRange(i + 1, 4).setValue('Active');
      return { success: true, message: 'Admin access updated to Active.' };
    }
  }
  adminSheet.appendRow([email.trim().toLowerCase(), name || 'Admin', new Date(), 'Active']);
  return { success: true, message: 'Admin access granted successfully.' };
}

function revokeAdminFromUI(email) {
  var adminSheet = getOrCreateAdminsSheet();
  var rows = adminSheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString().trim().toLowerCase() === email.toLowerCase()) {
      adminSheet.getRange(i + 1, 4).setValue('Inactive');
      return { success: true };
    }
  }
  return { success: false, error: 'Email not found.' };
}

// ──────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ──────────────────────────────────────────────────────────────────────────────
function getOrCreateAdminsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Admins');
  if (!sheet) {
    sheet = ss.insertSheet('Admins');
    sheet.appendRow(['Email', 'Name', 'Added Date', 'Status']);
    sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 240);
    sheet.setColumnWidth(2, 160);
    sheet.setColumnWidth(3, 160);
    sheet.setColumnWidth(4, 80);
  }
  return sheet;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isAdminEmail(email) {
  var adminSheet = getOrCreateAdminsSheet();
  var rows = adminSheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString().trim().toLowerCase() === email.toLowerCase()
        && (rows[i][3] || '').toString() === 'Active') {
      return true;
    }
  }
  return false;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ──────────────────────────────────────────────────────────────────────────────
// HTTP POST HANDLER
// ──────────────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ status: 'error', message: 'No payload' });
    }
    var data = JSON.parse(e.postData.contents);
    // Always use the FIRST sheet (index 0) — getActiveSheet() changes if user clicks another tab
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Registration Date', 'Client Name', 'Email Address', 'App Version', 'Device ID']);
      sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc');
      sheet.setFrozenRows(1);
    }

    // ── register_user ───────────────────────────────────────────────────────
    if (data.action === 'register_user') {
      var email = (data.email || '').toString().trim().toLowerCase();
      if (!email) return json({ status: 'error', message: 'Missing email' });
      var rows = sheet.getDataRange().getValues();
      var existingRowIndex = -1;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][2] && rows[i][2].toString().trim().toLowerCase() === email) {
          existingRowIndex = i + 1; break;
        }
      }
      var now = new Date();
      if (existingRowIndex > 0) {
        sheet.getRange(existingRowIndex, 1).setValue(now);
        sheet.getRange(existingRowIndex, 2).setValue(data.name || rows[existingRowIndex - 1][1]);
        sheet.getRange(existingRowIndex, 4).setValue(data.appVersion || '26.9.9');
        sheet.getRange(existingRowIndex, 5).setValue(data.deviceId || '');
      } else {
        sheet.appendRow([now, data.name || 'Client', email, data.appVersion || '26.9.9', data.deviceId || '']);
      }
      return json({ status: 'ok', message: 'Client registered successfully' });
    }

    // ── send_broadcast ──────────────────────────────────────────────────────
    if (data.action === 'send_broadcast') {
      var recipients = data.recipients || [];
      var subject = data.subject || 'Important Notice: One Tap Workstation';
      var htmlBody = data.htmlBody || '';
      var sentCount = 0; var failedCount = 0;
      for (var j = 0; j < recipients.length; j++) {
        var r = recipients[j];
        if (r && r.email) {
          try { MailApp.sendEmail({ to: r.email.toString().trim(), subject: subject, htmlBody: htmlBody, name: 'One Tap Workstation' }); sentCount++; }
          catch (me) { failedCount++; }
        }
      }
      return json({ status: 'ok', sent: sentCount, failed: failedCount, total: recipients.length });
    }

    // ── check_is_admin ──────────────────────────────────────────────────────
    if (data.action === 'check_is_admin') {
      var checkEmail = (data.email || '').toString().trim().toLowerCase();
      if (!checkEmail) return json({ status: 'error', message: 'Missing email' });
      return json({ status: 'ok', isAdmin: isAdminEmail(checkEmail) });
    }

    // ── request_admin_otp ───────────────────────────────────────────────────
    if (data.action === 'request_admin_otp') {
      var otpEmail = (data.email || '').toString().trim().toLowerCase();
      if (!otpEmail) return json({ status: 'error', message: 'Missing email' });
      if (!isAdminEmail(otpEmail)) {
        return json({ status: 'error', message: 'NOT_ADMIN', detail: 'This email is not listed as an Active Admin in the Google Sheet. Ask the workspace owner to grant access via the Admin Manager.' });
      }
      var otp = generateOtp();
      var expiry = Date.now() + (10 * 60 * 1000);
      PropertiesService.getScriptProperties().setProperty('OTP_' + otpEmail, JSON.stringify({ otp: otp, expiry: expiry }));
      try {
        MailApp.sendEmail({ to: otpEmail, subject: '\uD83D\uDD10 One Tap Admin OTP', htmlBody: buildOtpEmailHtml(data.name || 'Admin', otpEmail, otp), name: 'One Tap Workstation' });
      } catch (mailErr) {
        return json({ status: 'error', message: 'Failed to send OTP: ' + mailErr.toString() });
      }
      return json({ status: 'ok', message: 'OTP sent to ' + otpEmail + '. Valid for 10 minutes.' });
    }

    // ── verify_admin_otp ────────────────────────────────────────────────────
    if (data.action === 'verify_admin_otp') {
      var verifyEmail = (data.email || '').toString().trim().toLowerCase();
      var userOtp = (data.otp || '').toString().trim();
      if (!verifyEmail || !userOtp) return json({ status: 'error', message: 'Missing email or OTP' });
      var propsV = PropertiesService.getScriptProperties();
      var stored = propsV.getProperty('OTP_' + verifyEmail);
      if (!stored) return json({ status: 'error', message: 'No OTP found. Please request a new one.' });
      var storedData = JSON.parse(stored);
      if (Date.now() > storedData.expiry) {
        propsV.deleteProperty('OTP_' + verifyEmail);
        return json({ status: 'error', message: 'OTP expired. Please request a new one.' });
      }
      if (storedData.otp !== userOtp) return json({ status: 'error', message: 'Invalid OTP. Please try again.' });
      propsV.deleteProperty('OTP_' + verifyEmail);
      return json({ status: 'ok', message: 'Admin access verified successfully.' });
    }

    // ── list_users ──────────────────────────────────────────────────────────
    if (data.action === 'list_users') {
      var listRows = sheet.getDataRange().getValues();
      var users = [];
      for (var li = 1; li < listRows.length; li++) {
        if (listRows[li][2] && listRows[li][2].toString().indexOf('@') !== -1) {
          users.push({ registeredAt: listRows[li][0] ? listRows[li][0].toString() : '', name: listRows[li][1] || 'Client', email: listRows[li][2].toString().trim(), appVersion: listRows[li][3] || '', deviceId: listRows[li][4] || '' });
        }
      }
      return json({ status: 'ok', users: users });
    }

    return json({ status: 'error', message: 'Unknown action: ' + (data.action || 'none') });
  } catch (err) {
    return json({ status: 'error', error: err.toString() });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// HTTP GET HANDLER
//   • No params / ?page=admin  → serves the Admin Manager HTML web page (for browser)
//   • ?action=list_users       → returns JSON list of registered clients (for app)
//   • ?action=admin_page       → same as no params, serves Admin Manager HTML
// ──────────────────────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || '';
    var page   = params.page   || '';

    // ── JSON endpoint: list registered users ────────────────────────────────
    if (action === 'list_users') {
      // Always use getSheets()[0] to match where registrations are written
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      var rows  = sheet.getDataRange().getValues();
      var users = [];
      for (var i = 1; i < rows.length; i++) {
        var email = rows[i][2];
        if (email && email.toString().indexOf('@') !== -1) {
          users.push({
            registeredAt: rows[i][0] ? rows[i][0].toString() : '',
            name:         rows[i][1] || 'Client',
            email:        rows[i][2].toString().trim(),
            appVersion:   rows[i][3] || '',
            deviceId:     rows[i][4] || ''
          });
        }
      }
      return json({ status: 'ok', users: users });
    }

    // ── JSON endpoint: check admin status ───────────────────────────────────
    if (action === 'check_admin') {
      var checkEmail = (params.email || '').toString().trim().toLowerCase();
      if (!checkEmail) return json({ status: 'error', message: 'Missing email' });
      return json({ status: 'ok', isAdmin: isAdminEmail(checkEmail) });
    }

    // ── Default: serve the Admin Manager HTML web page ──────────────────────
    // Supports: no params, ?page=admin, ?action=admin_page
    return HtmlService.createHtmlOutput(buildAdminManagerHTML())
      .setTitle('👑 One Tap Admin Manager')
      .setFaviconUrl('https://www.google.com/images/icons/product/sheets-32.png')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

  } catch (err) {
    return json({ status: 'error', error: err.toString() });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// OTP EMAIL HTML
// ──────────────────────────────────────────────────────────────────────────────
function buildOtpEmailHtml(name, email, otp) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;"><table width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1e1b4b,#1e293b);border-radius:16px;border:1px solid rgba(234,179,8,0.4);"><tr><td style="padding:32px 36px;text-align:center;"><div style="font-size:40px;margin-bottom:8px;">&#128081;</div><h1 style="color:#fef08a;font-size:22px;font-weight:800;margin:0 0 6px 0;">One Tap Admin Access</h1><p style="color:#94a3b8;font-size:13px;margin:0 0 24px 0;">Hello <strong style="color:#e2e8f0;">' + name + '</strong> — your admin unlock code:</p><div style="background:rgba(234,179,8,0.12);border:2px solid rgba(234,179,8,0.4);border-radius:12px;padding:20px 32px;margin-bottom:20px;"><span style="font-size:38px;font-weight:900;letter-spacing:10px;color:#fde047;font-family:monospace;">' + otp + '</span></div><p style="color:#64748b;font-size:12px;margin:0 0 4px 0;">&#9203; Expires in <strong style="color:#fde047;">10 minutes</strong>.</p><p style="color:#64748b;font-size:12px;margin:0;">If you did not request this, ignore this email.</p></td></tr><tr><td style="padding:16px 36px 24px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;"><p style="color:#374151;font-size:11px;margin:0;">Sent to: ' + email + ' &#8226; One Tap Workstation by BSFrameWorks 5253</p></td></tr></table></td></tr></table></body></html>';
}

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN MANAGER HTML UI (inside Google Sheets modal)
// ──────────────────────────────────────────────────────────────────────────────
function buildAdminManagerHTML() {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><base target="_top"><style>*{box-sizing:border-box;}body{font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:20px;font-size:13px;}h2{margin:0 0 4px 0;font-size:18px;font-weight:800;color:#fef08a;}p.sub{color:#64748b;font-size:12px;margin:0 0 18px 0;}.section{background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin-bottom:14px;}.section h3{margin:0 0 12px 0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;}input{width:100%;padding:9px 12px;background:#0f172a;border:1px solid rgba(255,255,255,0.12);border-radius:7px;color:#e2e8f0;font-size:13px;outline:none;transition:border-color 0.15s;margin-bottom:8px;}input:focus{border-color:#eab308;}.row{display:flex;gap:8px;}button{padding:9px 16px;border-radius:7px;border:none;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.15s;}.btn-grant{background:linear-gradient(135deg,#eab308,#ca8a04);color:#0f172a;flex:1;}.btn-grant:hover{filter:brightness(1.1);}.admin-item{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(255,255,255,0.03);border-radius:7px;margin-bottom:6px;border:1px solid rgba(255,255,255,0.05);}.admin-email{color:#f59e0b;font-weight:700;font-size:12px;}.admin-name{color:#94a3b8;font-size:11px;}.badge-active{background:rgba(16,185,129,0.12);color:#4ade80;border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;}.badge-inactive{background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;}.btn-revoke{padding:4px 10px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#f87171;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;}.btn-revoke:hover{background:#dc2626;color:#fff;border-color:#dc2626;}.msg{padding:8px 12px;border-radius:7px;font-size:12px;font-weight:600;margin-top:8px;}.msg.ok{background:rgba(16,185,129,0.12);color:#4ade80;border:1px solid rgba(16,185,129,0.3);}.msg.err{background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.3);}#adminList{max-height:200px;overflow-y:auto;}</style></head><body><h2>&#128081; Admin Access Manager</h2><p class="sub">Grant or revoke admin access for AI Copilot restricted tabs (AI Rules &amp; OTA, Admin Page).</p><div class="section"><h3>&#10133; Grant Admin Access</h3><input id="newEmail" type="email" placeholder="client@example.com"/><input id="newName" type="text" placeholder="Name (optional)"/><div class="row"><button class="btn-grant" onclick="grantAdmin()">&#128081; Grant Admin Access</button></div><div id="grantMsg"></div></div><div class="section"><h3>&#128203; Current Admins</h3><div id="adminList"><p style="color:#475569;font-size:12px;">Loading...</p></div></div><script>function loadAdmins(){google.script.run.withSuccessHandler(function(admins){var list=document.getElementById("adminList");if(!admins||admins.length===0){list.innerHTML=\'<p style="color:#475569;font-size:12px;">No admins yet.</p>\';return;}var h="";admins.forEach(function(a){h+=\'<div class="admin-item"><div><div class="admin-email">\'+a.email+\'</div><div class="admin-name">\'+a.name+\'</div></div><div style="display:flex;align-items:center;gap:8px;"><span class="badge-\'+(a.status==="Active"?"active":"inactive")+\'">\'+a.status+\'</span><button class="btn-revoke" onclick="revokeAdmin(\\\'\'+a.email+\'\\\')">Revoke</button></div></div>\';});list.innerHTML=h;}).getAdminListForUI();}function grantAdmin(){var email=document.getElementById("newEmail").value.trim();var name=document.getElementById("newName").value.trim();var msg=document.getElementById("grantMsg");if(!email||email.indexOf("@")===-1){msg.innerHTML=\'<div class="msg err">Enter a valid email.</div>\';return;}msg.innerHTML=\'<div class="msg ok">Granting...</div>\';google.script.run.withSuccessHandler(function(r){if(r.success){msg.innerHTML=\'<div class="msg ok">&#10003; \'+r.message+\'</div>\';loadAdmins();}else{msg.innerHTML=\'<div class="msg err">&#10007; \'+r.error+\'</div>\';}}).makeAdminFromUI(email,name);}function revokeAdmin(email){if(!confirm("Revoke admin access for "+email+"?"))return;google.script.run.withSuccessHandler(function(r){if(r.success){loadAdmins();}else{alert("Error: "+r.error);}}).revokeAdminFromUI(email);}loadAdmins();</script></body></html>';
}

// ──────────────────────────────────────────────────────────────────────────────
// CLIENT LIST HTML UI
// ──────────────────────────────────────────────────────────────────────────────
function buildClientListHTML() {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><base target="_top"><style>*{box-sizing:border-box;}body{font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:20px;font-size:13px;}h2{margin:0 0 4px 0;font-size:18px;font-weight:800;}p.sub{color:#64748b;font-size:12px;margin:0 0 16px 0;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#1e293b;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.08);}td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);color:#cbd5e1;}tr:hover td{background:rgba(255,255,255,0.02);}.email{color:#60a5fa;font-weight:600;}button.make-admin{padding:3px 9px;background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.3);color:#fde047;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;}button.make-admin:hover{background:#eab308;color:#0f172a;border-color:#eab308;}.scroll{max-height:380px;overflow-y:auto;}</style></head><body><h2>&#128202; Registered Clients</h2><p class="sub">All clients registered from their One Tap Workstation.</p><div class="scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Version</th><th>Registered</th><th>Action</th></tr></thead><tbody id="clientRows"><tr><td colspan="5" style="color:#475569;text-align:center;padding:20px;">Loading...</td></tr></tbody></table></div><script>google.script.run.withSuccessHandler(function(clients){var tbody=document.getElementById("clientRows");if(!clients||clients.length===0){tbody.innerHTML=\'<tr><td colspan="5" style="color:#475569;text-align:center;padding:20px;">No clients yet.</td></tr>\';return;}var h="";clients.forEach(function(c){h+=\'<tr><td>\'+c.name+\'</td><td class="email">\'+c.email+\'</td><td>\'+c.appVersion+\'</td><td>\'+(c.registeredAt?c.registeredAt.split("T")[0]:"")+\'</td><td><button class="make-admin" onclick="grantAdmin(\\\'\'+c.email+\'\\\',\\\'\'+c.name+\'\\\')">&#128081; Make Admin</button></td></tr>\';});tbody.innerHTML=h;}).getClientListForUI();function grantAdmin(email,name){google.script.run.withSuccessHandler(function(r){if(r.success){alert("&#10003; "+r.message);}else{alert("&#10007; "+r.error);}}).makeAdminFromUI(email,name);}</script></body></html>';
}