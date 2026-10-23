/**
 * USER PROFILE & EMAIL NOTIFICATION IPC (src/main/ipc/userProfile.ipc.ts)
 *
 * Handles:
 * - Saving/loading the AI user profile (name, email, avatar) to userData
 * - Registering new users to the admin's Google Sheet via Google Apps Script
 * - Sending styled HTML emails to users via EmailJS REST API (free, no SMTP needed)
 * - Fetching the registered user list from Google Sheet for bulk email
 */

import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import https from 'https'
import crypto from 'crypto'

export interface UserProfile {
  name: string
  email: string
  avatarBase64?: string   // base64-encoded image (data:image/...;base64,...)
  registeredAt?: string
  deviceId?: string
  appVersion?: string
  isAdmin?: boolean
}

export interface RegisteredUser {
  name: string
  email: string
  registeredAt: string
  appVersion?: string
  deviceId?: string
}

function getProfilePath(): string {
  return path.join(app.getPath('userData'), 'ai_profile.json')
}

function generateDeviceId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `device_${Date.now()}_${Math.random().toString(36).slice(2)}`
  }
}

/** POST JSON to a URL, follows redirects (crucial for Google Apps Script 302 redirects) */
async function postJson(url: string, payload: Record<string, unknown>): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  })
  return await res.text()
}

/** GET from URL, follows redirects (crucial for Google Apps Script 302 redirects) */
async function getJson(url: string): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow'
  })
  return await res.text()
}

export function registerUserProfileIPC(): void {

  // ── Save profile to userData/ai_profile.json ─────────────────────────────
  ipcMain.handle('userProfile:save', async (_e, profile: UserProfile) => {
    try {
      const existing: Partial<UserProfile> = (() => {
        try {
          const p = getProfilePath()
          if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')) as UserProfile
        } catch {}
        return {}
      })()

      const data: UserProfile = {
        ...existing,
        ...profile,
        registeredAt: existing.registeredAt || new Date().toISOString(),
        deviceId: existing.deviceId || generateDeviceId(),
        appVersion: app.getVersion()
      }

      fs.writeFileSync(getProfilePath(), JSON.stringify(data, null, 2), 'utf8')
      return { success: true, profile: data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Load profile from userData ────────────────────────────────────────────
  ipcMain.handle('userProfile:load', async () => {
    try {
      const p = getProfilePath()
      if (!fs.existsSync(p)) {
        return null
      }
      const data = JSON.parse(fs.readFileSync(p, 'utf8')) as UserProfile
      if (!data.name || !data.email) {
        return null
      }
      return {
        ...data,
        isAdmin: data.isAdmin === true
      }
    } catch {
      return null
    }
  })

  // ── Toggle Admin Mode (PIN unlock for owner) ───────────────────────────────
  ipcMain.handle('userProfile:setAdmin', async (_e, arg: any) => {
    try {
      const pin = typeof arg === 'string' ? arg.trim() : (arg?.pin ? String(arg.pin).trim() : '')
      const p = getProfilePath()
      const existing: UserProfile = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { name: '', email: '' }
      const valid = pin === 'onetap786' || pin === 'admin123' || pin === 'bsframework' || pin === '5253'
      if (valid) {
        existing.isAdmin = true
        fs.writeFileSync(p, JSON.stringify(existing, null, 2), 'utf8')
        return { success: true, isAdmin: true }
      }
      return { success: false, error: 'Incorrect Admin PIN' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Reset All App Setup & AI Profile (Forces fresh setup on next launch) ────
  ipcMain.handle('admin:resetAllSetup', async () => {
    try {
      // 1. Delete settings_location.ini so needsSetup() returns true
      const configRoot = process.platform === 'win32'
        ? (process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'))
        : (process.env.XDG_CONFIG_HOME || path.join(require('os').homedir(), '.config'))
      const locFile1 = path.join(configRoot, 'One Tap', 'settings_location.ini')
      const locFile2 = path.join(configRoot, 'EditorsToolkit', 'settings_location.ini')
      if (fs.existsSync(locFile1)) fs.unlinkSync(locFile1)
      if (fs.existsSync(locFile2)) fs.unlinkSync(locFile2)

      // 2. Delete ai_profile.json
      const profileFile = getProfilePath()
      if (fs.existsSync(profileFile)) {
        fs.unlinkSync(profileFile)
      }

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Register to Google Sheet via Google Apps Script ───────────────────────
  ipcMain.handle('userProfile:registerToSheet', async (_e, {
    profile,
    scriptUrl
  }: {
    profile: UserProfile
    scriptUrl?: string
  }) => {
    const targetUrl =
      scriptUrl ||
      process.env.CLIENT_NOTIFICATION_WEBHOOK_URL ||
      process.env.AI_REGISTRATION_SCRIPT_URL ||
      'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec'

    try {
      const response = await postJson(targetUrl, {
        action: 'register_user',
        name: profile.name,
        email: profile.email,
        registeredAt: profile.registeredAt || new Date().toISOString(),
        appVersion: profile.appVersion || app.getVersion(),
        deviceId: profile.deviceId || 'unknown'
      })
      return { success: true, response }
    } catch (err: any) {
      // Registration failure is non-blocking — profile is already saved locally
      return { success: false, error: err.message }
    }
  })

  // ── Fetch user list from Google Sheet ─────────────────────────────────────
  ipcMain.handle('userProfile:fetchUserList', async (_e, scriptUrl?: string) => {
    const targetUrl =
      scriptUrl ||
      process.env.CLIENT_NOTIFICATION_WEBHOOK_URL ||
      process.env.AI_REGISTRATION_SCRIPT_URL ||
      'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec'

    try {
      const response = await getJson(`${targetUrl}?action=list_users`)
      const parsed = JSON.parse(response)
      return { success: true, users: (parsed.users || []) as RegisteredUser[] }
    } catch (err: any) {
      return { success: false, users: [], error: err.message }
    }
  })

  // ── Send broadcast via Google Apps Script (Node backend to bypass browser CORS) ──
  ipcMain.handle('userProfile:sendBroadcast', async (_e, {
    scriptUrl,
    subject,
    htmlBody,
    recipients
  }: {
    scriptUrl?: string
    subject: string
    htmlBody: string
    recipients: Array<{ name: string; email: string }>
  }) => {
    const targetUrl =
      scriptUrl ||
      process.env.CLIENT_NOTIFICATION_WEBHOOK_URL ||
      process.env.AI_REGISTRATION_SCRIPT_URL ||
      'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec'

    try {
      const raw = await postJson(targetUrl, {
        action: 'send_broadcast',
        subject: (subject || '').trim(),
        htmlBody,
        recipients
      })
      let parsed: any = null
      try {
        parsed = JSON.parse(raw)
      } catch {
        // In case Google returned HTML or error text
        return { success: false, error: raw.length > 200 ? raw.slice(0, 200) + '...' : raw }
      }
      return { success: parsed.status === 'ok', ...parsed }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Send email via EmailJS REST API (Free, no SMTP needed) ───────────────
  // EmailJS free plan: 200 emails/month, unlimited templates
  // Setup: https://www.emailjs.com → Create account → Add Email Service → Create Template
  ipcMain.handle('email:sendViaEmailJS', async (_e, params: {
    serviceId: string      // From EmailJS dashboard (e.g. "service_abc123")
    templateId: string     // From EmailJS dashboard (e.g. "template_xyz456")
    publicKey: string      // From EmailJS dashboard > Account > Public Key
    templateParams: Record<string, string>  // Variables injected into template
  }) => {
    const { serviceId, templateId, publicKey, templateParams } = params

    if (!serviceId || !templateId || !publicKey) {
      return { success: false, error: 'EmailJS credentials not configured. Go to Settings → Email Notifications to set up.' }
    }

    try {
      const response = await postJson('https://api.emailjs.com/api/v1.0/email/send', {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: templateParams
      })

      const isSuccess = response === 'OK' || response.includes('OK') || response.includes('success')
      return { success: isSuccess, response }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Send bulk email to multiple recipients ────────────────────────────────
  ipcMain.handle('email:sendBulk', async (_e, params: {
    serviceId: string
    templateId: string
    publicKey: string
    recipients: Array<{ name: string; email: string }>
    templateParams: Record<string, string>  // Shared params (subject, message, etc.)
    delayMs?: number  // Delay between sends to avoid rate limiting (default: 500ms)
  }) => {
    const { serviceId, templateId, publicKey, recipients, templateParams, delayMs = 600 } = params
    const results: Array<{ email: string; success: boolean; error?: string }> = []

    for (const recipient of recipients) {
      try {
        const result = await postJson('https://api.emailjs.com/api/v1.0/email/send', {
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            ...templateParams,
            to_name: recipient.name,
            to_email: recipient.email
          }
        })
        results.push({ email: recipient.email, success: result === 'OK' || result.includes('OK') })
      } catch (err: any) {
        results.push({ email: recipient.email, success: false, error: err.message })
      }

      // Respect EmailJS rate limits
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }

    const succeeded = results.filter((r) => r.success).length
    return {
      success: succeeded > 0,
      total: recipients.length,
      sent: succeeded,
      failed: recipients.length - succeeded,
      results
    }
  })

  // ── Request Admin OTP — posts to Google Apps Script webhook ────────────────
  ipcMain.handle('userProfile:requestAdminOtp', async (_e, params: {
    webhookUrl?: string
    email: string
    name?: string
  }) => {
    const defaultUrl =
      process.env.CLIENT_NOTIFICATION_WEBHOOK_URL ||
      process.env.AI_REGISTRATION_SCRIPT_URL ||
      'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec'
    const targetUrl = params?.webhookUrl || defaultUrl
    const email = params?.email
    const name = params?.name || 'Admin'
    if (!email) return { success: false, error: 'Missing user email' }
    try {
      const raw = await postJson(targetUrl, { action: 'request_admin_otp', email, name })
      const result = JSON.parse(raw)
      if (result.status === 'ok') return { success: true, message: result.message }
      if (result.message === 'NOT_ADMIN') return { success: false, error: 'NOT_ADMIN', detail: result.detail }
      return { success: false, error: result.message || 'Unknown error' }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  // ── Verify Admin OTP — sends the OTP back to GAS for validation ────────────
  ipcMain.handle('userProfile:verifyAdminOtp', async (_e, params: {
    webhookUrl?: string
    email: string
    otp: string
  }) => {
    const defaultUrl =
      process.env.CLIENT_NOTIFICATION_WEBHOOK_URL ||
      process.env.AI_REGISTRATION_SCRIPT_URL ||
      'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec'
    const targetUrl = params?.webhookUrl || defaultUrl
    const email = params?.email
    const otp = params?.otp
    if (!email || !otp) return { success: false, error: 'Missing email or OTP' }
    try {
      const raw = await postJson(targetUrl, { action: 'verify_admin_otp', email, otp })
      const result = JSON.parse(raw)
      if (result.status === 'ok') {
        // Persist isAdmin=true to local profile
        const profilePath = getProfilePath()
        if (fs.existsSync(profilePath)) {
          const profile: UserProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
          profile.isAdmin = true
          fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8')
        }
        return { success: true }
      }
      return { success: false, error: result.message || 'OTP verification failed' }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  // ── Lock Admin — clear isAdmin from local profile ──────────────────────────
  ipcMain.handle('userProfile:lockAdmin', async (_e) => {
    try {
      const profilePath = getProfilePath()
      if (fs.existsSync(profilePath)) {
        const profile: UserProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
        profile.isAdmin = false
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8')
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  // ── Check is Admin against the webhook (live check) ───────────────────────
  ipcMain.handle('userProfile:checkIsAdmin', async (_e, params: {
    webhookUrl?: string
    email: string
  }) => {
    const defaultUrl =
      process.env.CLIENT_NOTIFICATION_WEBHOOK_URL ||
      process.env.AI_REGISTRATION_SCRIPT_URL ||
      'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec'
    const targetUrl = params?.webhookUrl || defaultUrl
    const email = params?.email
    if (!email) return { success: false, isAdmin: false }
    try {
      const raw = await postJson(targetUrl, { action: 'check_is_admin', email })
      const result = JSON.parse(raw)
      // Also sync to local profile
      const profilePath = getProfilePath()
      if (fs.existsSync(profilePath)) {
        const profile: UserProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
        profile.isAdmin = result.isAdmin === true
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8')
      }
      return { success: true, isAdmin: result.isAdmin === true }
    } catch (err: any) {
      return { success: false, isAdmin: false, error: err.message }
    }
  })

  // ── AI Logout — clear the ai_profile.json (full sign-out) ────────────────
  ipcMain.handle('userProfile:logout', async (_e) => {
    try {
      const profilePath = getProfilePath()
      if (fs.existsSync(profilePath)) {
        fs.unlinkSync(profilePath)
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

