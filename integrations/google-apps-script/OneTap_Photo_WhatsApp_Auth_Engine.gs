/**
 * ==============================================================================
 * ONE TAP & ANYSHARE — GOOGLE APPS SCRIPT SUITE (OneTap_Photo_WhatsApp_Auth_Engine.gs)
 * ==============================================================================
 * Live Web App URL: https://script.google.com/macros/s/AKfycbzz5U5zKAD6ccRzZu_oDqVZetmMV09hEUTBQW__aFtC56zNI2ZCC7rB4-08Tq_AygWBUg/exec
 * Target WhatsApp Milestone Phone: 8369811201 (+91 8369811201)
 *
 * Capabilities:
 * 1. Photo Data & Drive Folder Tracker: Cross-references expected date folders from Task Tracker,
 *    identifies uploaded and downloaded folders, and tags Drive folders when dates are marked uploaded.
 * 2. WhatsApp Milestone Notifications: Formats and pushes milestone notifications to 8369811201
 *    displaying uploaded count, pending count, and direct link to the website.
 * 3. Passwordless Email Login & Branded Notification: Dispatches animated HTML login emails with 6-digit OTP
 *    and logs user emails to Google Sheets.
 * 4. PWA Push Subscriptions: Stores PWA push notification subscriptions in Sheet.
 *
 * Instructions for Google Apps Script deployment:
 * 1. Open https://script.google.com and open the project.
 * 2. Paste this code into Code.gs (or OneTap_Photo_WhatsApp_Auth_Engine.gs).
 * 3. Deploy > Manage Deployments > Edit > New Version > Deploy (Access: Anyone).
 * ==============================================================================
 */

// ── Configuration ─────────────────────────────────────────────────────────────
var DEFAULT_PHONE = "8369811201";
var SHEET_PHOTO_TRACKER = "Photo_Deliverables";
var SHEET_USERS = "Users_Auth";
var SHEET_PWA_SUBS = "PWA_Subscriptions";

// ── Web App Entry Points ──────────────────────────────────────────────────────

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "status";
  if (action === "status") {
    return createJsonResponse({
      success: true,
      service: "One Tap AnyShare Cloud Engine",
      version: "26.11.14",
      timestamp: new Date().toISOString()
    });
  }
  return createJsonResponse({ success: false, error: "Invalid GET action" });
}

function doPost(e) {
  try {
    var rawBody = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(rawBody);
    var action = data.action || "";

    switch (action) {
      case "getPhotoFolders":
        return createJsonResponse(handleGetPhotoFolders(data));
      case "markUploaded":
        return createJsonResponse(handleMarkUploaded(data));
      case "markDownloaded":
        return createJsonResponse(handleMarkDownloaded(data));
      case "sendWhatsAppMilestone":
        return createJsonResponse(handleSendWhatsAppMilestone(data));
      case "sendLoginEmail":
        return createJsonResponse(handleSendLoginEmail(data));
      case "verifyLoginCode":
        return createJsonResponse(handleVerifyLoginCode(data));
      case "registerPwaSubscription":
        return createJsonResponse(handleRegisterPwaSubscription(data));
      default:
        return createJsonResponse({ success: false, error: "Unknown action: " + action });
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 1. Photo Data & Drive Tracker ─────────────────────────────────────────────

function handleGetPhotoFolders(data) {
  var safarName = data.safarName || "Active Safar";
  var expectedDates = Array.isArray(data.expectedDates) ? data.expectedDates : [];
  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_PHOTO_TRACKER, [
    "Safar Name", "Date Folder", "Is Uploaded", "Is Downloaded", "Drive Folder ID", "Drive URL", "Last Synced At"
  ]);

  var rows = sheet.getDataRange().getValues();
  var existingMap = {};
  for (var i = 1; i < rows.length; i++) {
    var sName = String(rows[i][0] || "").trim();
    var dFolder = String(rows[i][1] || "").trim();
    if (sName.toLowerCase() === safarName.toLowerCase()) {
      existingMap[dFolder.toLowerCase()] = {
        isUploaded: Boolean(rows[i][2]),
        isDownloaded: Boolean(rows[i][3]),
        driveFolderId: rows[i][4] || "",
        driveFolderUrl: rows[i][5] || "",
        lastSyncedAt: rows[i][6] || ""
      };
    }
  }

  var folders = [];
  var uploadedCount = 0;
  var downloadedCount = 0;

  for (var j = 0; j < expectedDates.length; j++) {
    var folderName = expectedDates[j];
    var existing = existingMap[folderName.toLowerCase()] || {};
    var isUp = Boolean(existing.isUploaded);
    var isDown = Boolean(existing.isDownloaded);

    // Auto-search Google Drive if no URL is recorded yet
    var driveUrl = existing.driveFolderUrl;
    if (!driveUrl) {
      try {
        var iter = DriveApp.getFoldersByName(folderName);
        if (iter.hasNext()) {
          var f = iter.next();
          driveUrl = f.getUrl();
          isUp = true;
        }
      } catch (e) {}
    }

    if (isUp) uploadedCount++;
    if (isDown) downloadedCount++;

    folders.push({
      dateFolder: folderName,
      safarName: safarName,
      isUploaded: isUp,
      isDownloaded: isDown,
      driveFolderId: existing.driveFolderId || "",
      driveFolderUrl: driveUrl || ("https://drive.google.com/drive/search?q=" + encodeURIComponent(folderName)),
      lastSyncedAt: existing.lastSyncedAt || new Date().toISOString(),
      status: isUp ? (isDown ? "downloaded" : "uploaded") : "pending"
    });
  }

  var total = folders.length;
  var pendingCount = Math.max(0, total - uploadedCount);
  var percentComplete = total > 0 ? Math.round((uploadedCount / total) * 100) : 0;

  return {
    success: true,
    safarName: safarName,
    folders: folders,
    stats: {
      total: total,
      uploadedCount: uploadedCount,
      downloadedCount: downloadedCount,
      pendingCount: pendingCount,
      percentComplete: percentComplete
    }
  };
}

function handleMarkUploaded(data) {
  var safarName = data.safarName || "Active Safar";
  var dateFolder = data.dateFolder || "";
  var markedBy = data.markedBy || "One Tap User";
  var websiteUrl = data.websiteUrl || "https://safar-tracker-web.vercel.app";

  if (!dateFolder) return { success: false, error: "dateFolder is required" };

  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_PHOTO_TRACKER, [
    "Safar Name", "Date Folder", "Is Uploaded", "Is Downloaded", "Drive Folder ID", "Drive URL", "Last Synced At"
  ]);

  var rows = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === safarName.toLowerCase() &&
        String(rows[i][1]).toLowerCase() === dateFolder.toLowerCase()) {
      rowIndex = i + 1;
      break;
    }
  }

  var driveFolderId = "";
  var driveFolderUrl = "";
  try {
    var iter = DriveApp.getFoldersByName(dateFolder);
    if (iter.hasNext()) {
      var found = iter.next();
      driveFolderId = found.getId();
      driveFolderUrl = found.getUrl();
      // Add custom property to Google Drive folder to mark it as uploaded
      found.setDescription("One Tap Verified Deliverable · Stage: Uploaded · Updated: " + new Date().toISOString());
    }
  } catch (e) {}

  var now = new Date().toISOString();
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 3).setValue(true);
    if (driveFolderId) sheet.getRange(rowIndex, 5).setValue(driveFolderId);
    if (driveFolderUrl) sheet.getRange(rowIndex, 6).setValue(driveFolderUrl);
    sheet.getRange(rowIndex, 7).setValue(now);
  } else {
    sheet.appendRow([safarName, dateFolder, true, false, driveFolderId, driveFolderUrl, now]);
  }

  // Calculate current progress counts
  var stats = computeSafarStats(safarName);

  // Trigger WhatsApp notification for the milestone
  handleSendWhatsAppMilestone({
    folderName: dateFolder,
    uploadedCount: stats.uploadedCount,
    pendingCount: stats.pendingCount,
    websiteUrl: websiteUrl,
    phone: DEFAULT_PHONE
  });

  return {
    success: true,
    message: "Folder " + dateFolder + " marked as uploaded in Google Drive & Tracker",
    driveUrl: driveFolderUrl,
    stats: stats
  };
}

function handleMarkDownloaded(data) {
  var safarName = data.safarName || "Active Safar";
  var dateFolder = data.dateFolder || "";
  if (!dateFolder) return { success: false, error: "dateFolder is required" };

  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_PHOTO_TRACKER, [
    "Safar Name", "Date Folder", "Is Uploaded", "Is Downloaded", "Drive Folder ID", "Drive URL", "Last Synced At"
  ]);

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === safarName.toLowerCase() &&
        String(rows[i][1]).toLowerCase() === dateFolder.toLowerCase()) {
      sheet.getRange(i + 1, 4).setValue(true);
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      break;
    }
  }

  return { success: true, message: "Folder " + dateFolder + " marked as downloaded" };
}

function computeSafarStats(safarName) {
  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_PHOTO_TRACKER, [
    "Safar Name", "Date Folder", "Is Uploaded", "Is Downloaded", "Drive Folder ID", "Drive URL", "Last Synced At"
  ]);
  var rows = sheet.getDataRange().getValues();
  var total = 0;
  var uploadedCount = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === safarName.toLowerCase()) {
      total++;
      if (rows[i][2] === true) uploadedCount++;
    }
  }
  return {
    total: total,
    uploadedCount: uploadedCount,
    pendingCount: Math.max(0, total - uploadedCount)
  };
}

// ── 2. WhatsApp Milestone Notifications ────────────────────────────────────────

function handleSendWhatsAppMilestone(data) {
  var phone = String(data.phone || DEFAULT_PHONE).replace(/\D/g, "");
  if (phone.length === 10) phone = "91" + phone;

  var folderName = data.folderName || "Date Folder";
  var uploadedCount = Number(data.uploadedCount) || 0;
  var pendingCount = Number(data.pendingCount) || 0;
  var websiteUrl = data.websiteUrl || "https://safar-tracker-web.vercel.app";

  // Per user specification:
  // "the msg will only have how many folders uploaded and pending counts only with the website link for more in dept deatails"
  var message =
    "🚀 *One Tap · Safar Production Milestone*\n\n" +
    "📁 *Uploaded:* " + folderName + "\n" +
    "✅ *Total Uploaded:* " + uploadedCount + " folder" + (uploadedCount === 1 ? "" : "s") + "\n" +
    "⏳ *Remaining Pending:* " + pendingCount + " folder" + (pendingCount === 1 ? "" : "s") + "\n\n" +
    "🔗 *For in-depth details visit:* " + websiteUrl;

  var whatsappApiSent = false;
  try {
    // If WhatsApp Cloud API token is configured in Script Properties
    var props = PropertiesService.getScriptProperties();
    var waToken = props.getProperty("WHATSAPP_API_TOKEN");
    var waPhoneId = props.getProperty("WHATSAPP_PHONE_NUMBER_ID");
    if (waToken && waPhoneId) {
      var url = "https://graph.facebook.com/v19.0/" + waPhoneId + "/messages";
      var payload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message }
      };
      var resp = UrlFetchApp.fetch(url, {
        method: "post",
        headers: {
          Authorization: "Bearer " + waToken,
          "Content-Type": "application/json"
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      whatsappApiSent = resp.getResponseCode() === 200;
    }
  } catch (e) {
    console.warn("WhatsApp Cloud API send failed:", e);
  }

  var clickToChatUrl = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);

  return {
    success: true,
    phone: phone,
    message: message,
    clickToChatUrl: clickToChatUrl,
    whatsappApiSent: whatsappApiSent
  };
}

// ── 3. Passwordless Email Login with HTML Animation ───────────────────────────

function handleSendLoginEmail(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var websiteUrl = data.websiteUrl || "https://safar-tracker-web.vercel.app";
  if (!email || email.indexOf("@") === -1) {
    return { success: false, error: "Valid email is required" };
  }

  // Generate 6-digit code
  var code = Math.floor(100000 + Math.random() * 900000).toString();

  // Store in Script Properties with 15 min expiry
  var props = PropertiesService.getScriptProperties();
  props.setProperty("AUTH_CODE_" + email, code);
  props.setProperty("AUTH_EXPIRY_" + email, (Date.now() + 15 * 60 * 1000).toString());

  // Log user email to Google Sheet
  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_USERS, ["Email", "Registered At", "Last Login At", "Role"]);
  var rows = sheet.getDataRange().getValues();
  var userFound = false;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email) {
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      userFound = true;
      break;
    }
  }
  if (!userFound) {
    sheet.appendRow([email, new Date().toISOString(), new Date().toISOString(), "member"]);
  }

  // Build animated, beautifully styled HTML email matching One Tap app design
  var htmlBody =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>' +
    '@keyframes pulse { 0% { opacity: 0.9; transform: scale(1); } 50% { opacity: 1; transform: scale(1.03); } 100% { opacity: 0.9; transform: scale(1); } }' +
    '</style></head>' +
    '<body style="margin:0;padding:24px;background-color:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#1E293B;">' +
    '  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:24px;border:1px solid #E2E8F0;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);overflow:hidden;">' +
    '    <tr>' +
    '      <td style="background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);padding:36px 32px;text-align:center;">' +
    '        <div style="display:inline-block;width:56px;height:56px;background:linear-gradient(135deg,#4F46E5 0%,#312E81 100%);border-radius:16px;line-height:56px;font-size:28px;color:#FFFFFF;box-shadow:0 8px 20px rgba(79,70,229,0.35);">⚡</div>' +
    '        <h1 style="margin:16px 0 0 0;font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">ONE TAP &middot; ANYSHARE</h1>' +
    '        <p style="margin:6px 0 0 0;font-size:12px;font-weight:600;color:#94A3B8;letter-spacing:0.8px;text-transform:uppercase;">Secure Workstation Verification</p>' +
    '      </td>' +
    '    </tr>' +
    '    <tr>' +
    '      <td style="padding:32px 32px 24px 32px;text-align:center;">' +
    '        <p style="margin:0 0 16px 0;font-size:14px;color:#475569;line-height:1.6;">Use the one-time authentication code below to log in to your Safar Tracker workspace:</p>' +
    '        <div style="margin:20px 0;padding:18px 24px;background:#F1F5F9;border-radius:16px;border:1px dashed #CBD5E1;display:inline-block;">' +
    '          <span style="font-family:\'Courier New\',Courier,monospace;font-size:34px;font-weight:900;letter-spacing:8px;color:#4F46E5;">' + code + '</span>' +
    '        </div>' +
    '        <p style="margin:12px 0 24px 0;font-size:12px;color:#94A3B8;">This verification code expires in 15 minutes.</p>' +
    '        <div style="margin:24px 0 8px 0;">' +
    '          <a href="' + websiteUrl + '" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4F46E5 0%,#4338CA 100%);color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;border-radius:12px;box-shadow:0 4px 12px rgba(79,70,229,0.3);">Open Safar Tracker Website &rarr;</a>' +
    '        </div>' +
    '      </td>' +
    '    </tr>' +
    '    <tr>' +
    '      <td style="padding:20px 32px;background:#F8FAFC;border-top:1px solid #F1F5F9;text-align:center;font-size:11px;color:#94A3B8;">' +
    '        If you did not request this sign-in code, you can safely ignore this email.<br>&copy; 2026 One Tap &middot; AnyShare Nexus.' +
    '      </td>' +
    '    </tr>' +
    '  </table>' +
    '</body></html>';

  MailApp.sendEmail({
    to: email,
    subject: "⚡ Your One Tap Sign-in Code: " + code,
    htmlBody: htmlBody
  });

  return { success: true, message: "Verification code sent to " + email };
}

function handleVerifyLoginCode(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var code = String(data.code || "").trim();
  if (!email || !code) return { success: false, error: "Email and code required" };

  var props = PropertiesService.getScriptProperties();
  var storedCode = props.getProperty("AUTH_CODE_" + email);
  var expiry = Number(props.getProperty("AUTH_EXPIRY_" + email)) || 0;

  if (!storedCode || storedCode !== code) {
    return { success: false, error: "Invalid verification code." };
  }
  if (Date.now() > expiry) {
    return { success: false, error: "Verification code has expired. Please request a new one." };
  }

  // Clear code after successful verification
  props.deleteProperty("AUTH_CODE_" + email);
  props.deleteProperty("AUTH_EXPIRY_" + email);

  var name = email.split("@")[0];
  var role = email.indexOf("admin") !== -1 ? "admin" : "member";

  return {
    success: true,
    user: {
      email: email,
      name: name,
      username: name,
      role: role,
      token: "gs_auth_" + Date.now()
    }
  };
}

// ── 4. PWA Push Subscriptions ──────────────────────────────────────────────────

function handleRegisterPwaSubscription(data) {
  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_PWA_SUBS, ["User Email", "Subscription JSON", "Registered At"]);
  sheet.appendRow([
    data.email || "PWA User",
    JSON.stringify(data.subscription || {}),
    new Date().toISOString()
  ]);
  return { success: true, message: "PWA push subscription recorded." };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty("ONE_TAP_SPREADSHEET_ID");
  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {}
  }
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  var created = SpreadsheetApp.create("One Tap & AnyShare Safar Master");
  props.setProperty("ONE_TAP_SPREADSHEET_ID", created.getId());
  return created;
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#F1F5F9");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}
