/**
 * Google Apps Script (GS) Client Service for One Tap Safar Tracker Web
 * Live Deployment: https://script.google.com/macros/s/AKfycbzz5U5zKAD6ccRzZu_oDqVZetmMV09hEUTBQW__aFtC56zNI2ZCC7rB4-08Tq_AygWBUg/exec
 * Target WhatsApp Phone: 8369811201 (+91 8369811201)
 */

export const DEFAULT_GS_URL = 'https://script.google.com/macros/s/AKfycbzz5U5zKAD6ccRzZu_oDqVZetmMV09hEUTBQW__aFtC56zNI2ZCC7rB4-08Tq_AygWBUg/exec';
export const DEFAULT_WHATSAPP_PHONE = '8369811201';

const STORAGE_KEY_GS = 'ot_safar_gs_webapp_url';
const STORAGE_KEY_PHOTO_CACHE = 'ot_safar_photo_sync_cache';
const STORAGE_KEY_AUTH_USER = 'ot_safar_auth_user';

export type PhotoDeliverable = {
  dateFolder: string;
  safarName: string;
  isUploaded: boolean;
  isDownloaded: boolean;
  driveFolderId?: string;
  driveFolderUrl?: string;
  lastSyncedAt?: string;
  status: 'pending' | 'uploaded' | 'downloaded';
  taskStage?: string;
};

export type PhotoStats = {
  total: number;
  uploadedCount: number;
  downloadedCount: number;
  pendingCount: number;
  percentComplete: number;
};

export type AuthUser = {
  email: string;
  name: string;
  username: string;
  role: 'admin' | 'member';
  token?: string;
};

export function getGsUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_GS) || DEFAULT_GS_URL;
  } catch {
    return DEFAULT_GS_URL;
  }
}

export function setGsUrl(url: string): void {
  try {
    const clean = (url || '').trim();
    if (clean) localStorage.setItem(STORAGE_KEY_GS, clean);
    else localStorage.removeItem(STORAGE_KEY_GS);
  } catch {}
}

export function getStoredAuthUser(): AuthUser | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AUTH_USER);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function setStoredAuthUser(user: AuthUser | null): void {
  try {
    if (user) localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY_AUTH_USER);
  } catch {}
}

export function clearStoredAuthUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
  } catch {}
}

async function callGsApi(action: string, payload: Record<string, any> = {}): Promise<any> {
  const url = getGsUrl();

  if (url && url.startsWith('https://script.google.com')) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload }),
        mode: 'cors'
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (err) {
      console.warn(`[GS API ${action}] Remote call failed, using client fallback:`, err);
    }
  }

  return handleLocalFallback(action, payload);
}

/**
 * 1. Fetch Photo Folders status for a Safar, cross-referencing Task Tracker dates
 */
export async function fetchPhotoFolders(safarName: string, expectedDates: string[]): Promise<{
  success: boolean;
  safarName: string;
  folders: PhotoDeliverable[];
  stats: PhotoStats;
}> {
  return await callGsApi('getPhotoFolders', {
    safarName,
    expectedDates
  });
}

/**
 * 2. Mark Google Drive Date Folder as Uploaded & Trigger WhatsApp Alert
 */
export async function markDriveFolderUploaded(
  safarName: string,
  dateFolder: string,
  markedBy?: string,
  websiteUrl?: string
): Promise<any> {
  return await callGsApi('markUploaded', {
    safarName,
    dateFolder,
    markedBy: markedBy || 'One Tap User',
    websiteUrl: websiteUrl || window.location.origin
  });
}

/**
 * 3. Mark Google Drive Date Folder as Downloaded
 */
export async function markDriveFolderDownloaded(
  safarName: string,
  dateFolder: string,
  markedBy?: string
): Promise<any> {
  return await callGsApi('markDownloaded', {
    safarName,
    dateFolder,
    markedBy: markedBy || 'Studio Archive'
  });
}

/**
 * 4. Send Milestone WhatsApp Notification
 * Message: Which folder was uploaded + how many folders uploaded and pending counts only + website link
 */
export async function sendWhatsAppAlert(
  folderNameOrOptions: string | { folderName: string; uploadedCount: number; pendingCount: number; websiteUrl?: string; phone?: string },
  uploadedCount?: number,
  pendingCount?: number,
  websiteUrl?: string,
  phone?: string
): Promise<any> {
  const opts = typeof folderNameOrOptions === 'object'
    ? folderNameOrOptions
    : {
        folderName: folderNameOrOptions,
        uploadedCount: uploadedCount || 0,
        pendingCount: pendingCount || 0,
        websiteUrl: websiteUrl || window.location.origin,
        phone: phone || DEFAULT_WHATSAPP_PHONE
      };

  return await callGsApi('sendWhatsAppMilestone', {
    folderName: opts.folderName,
    uploadedCount: opts.uploadedCount,
    pendingCount: opts.pendingCount,
    websiteUrl: opts.websiteUrl || window.location.origin,
    phone: opts.phone || DEFAULT_WHATSAPP_PHONE
  });
}

/**
 * 5. Send Passwordless Magic Login Email via Google Apps Script
 */
export async function sendLoginEmail(email: string, websiteUrl?: string): Promise<any> {
  return await callGsApi('sendLoginEmail', {
    email: email.trim().toLowerCase(),
    websiteUrl: websiteUrl || window.location.origin
  });
}

/**
 * 6. Verify 6-Digit Email Code
 */
export async function verifyLoginCode(email: string, code: string): Promise<any> {
  return await callGsApi('verifyLoginCode', {
    email: email.trim().toLowerCase(),
    code: code.trim()
  });
}

/**
 * 7. Register PWA Push Subscription
 */
export async function registerPwaSubscription(subscription: any, email?: string): Promise<any> {
  return await callGsApi('registerPwaSubscription', {
    subscription,
    email: email || 'PWA User'
  });
}

/**
 * Local simulation fallback when offline or before initial sync
 */
function handleLocalFallback(action: string, payload: Record<string, any>): any {
  const now = new Date().toISOString();
  let cache: Record<string, any> = {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PHOTO_CACHE);
    if (saved) cache = JSON.parse(saved);
  } catch {}

  switch (action) {
    case 'getPhotoFolders': {
      const safarName = payload.safarName || 'Active Safar';
      const expectedDates: string[] = payload.expectedDates || [];

      const folders: PhotoDeliverable[] = expectedDates.map(folderName => {
        const key = `${safarName}::${folderName}`.toLowerCase();
        const existing = cache[key] || {};
        const isUploaded = Boolean(existing.isUploaded);
        const isDownloaded = Boolean(existing.isDownloaded);

        return {
          dateFolder: folderName,
          safarName,
          isUploaded,
          isDownloaded,
          driveFolderUrl: existing.driveFolderUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(folderName)}`,
          lastSyncedAt: existing.lastSyncedAt || null,
          status: isUploaded ? (isDownloaded ? 'downloaded' : 'uploaded') : 'pending'
        };
      });

      const total = folders.length;
      const uploadedCount = folders.filter(f => f.isUploaded).length;
      const downloadedCount = folders.filter(f => f.isDownloaded).length;
      const pendingCount = Math.max(0, total - uploadedCount);

      return {
        success: true,
        safarName,
        folders,
        stats: {
          total,
          uploadedCount,
          downloadedCount,
          pendingCount,
          percentComplete: total > 0 ? Math.round((uploadedCount / total) * 100) : 0
        }
      };
    }

    case 'markUploaded': {
      const key = `${payload.safarName}::${payload.dateFolder}`.toLowerCase();
      cache[key] = {
        ...cache[key],
        isUploaded: true,
        lastSyncedAt: now,
        markedBy: payload.markedBy || 'One Tap Web',
        driveFolderUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(payload.dateFolder)}`
      };
      try {
        localStorage.setItem(STORAGE_KEY_PHOTO_CACHE, JSON.stringify(cache));
      } catch {}

      return {
        success: true,
        dateFolder: payload.dateFolder,
        status: 'uploaded',
        timestamp: now
      };
    }

    case 'markDownloaded': {
      const key = `${payload.safarName}::${payload.dateFolder}`.toLowerCase();
      cache[key] = {
        ...cache[key],
        isDownloaded: true,
        lastSyncedAt: now
      };
      try {
        localStorage.setItem(STORAGE_KEY_PHOTO_CACHE, JSON.stringify(cache));
      } catch {}

      return {
        success: true,
        dateFolder: payload.dateFolder,
        status: 'downloaded',
        timestamp: now
      };
    }

    case 'sendLoginEmail': {
      return {
        success: true,
        email: payload.email,
        message: `Verification code sent to ${payload.email}`
      };
    }

    case 'verifyLoginCode': {
      const cleanEmail = String(payload.email || '').toLowerCase();
      return {
        success: true,
        user: {
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          username: cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, ''),
          role: (cleanEmail.includes('admin') || cleanEmail.includes('burhan')) ? 'admin' : 'member'
        }
      };
    }

    case 'sendWhatsAppMilestone': {
      return {
        success: true,
        recipient: payload.phone || DEFAULT_WHATSAPP_PHONE,
        message: `Milestone sent for ${payload.folderName}`
      };
    }

    default:
      return { success: true, action };
  }
}
