import React, { useState, useEffect, useRef } from 'react'
import { useToast } from '../Toast'
import './EmailBroadcastModal.css'

interface Recipient {
  name: string
  email: string
  registeredAt?: string
  appVersion?: string
  deviceId?: string
  selected?: boolean
}

interface EmailBroadcastModalProps {
  isOpen: boolean
  onClose: () => void
}

const TEMPLATE_PRESETS = [
  {
    id: 'update',
    label: '🚀 Version Update',
    subject: 'Important Workstation Update Available: One Tap v26.9.9',
    headline: 'Exciting New Features & Performance Enhancements',
    body: `Salam & Greetings!

We are pleased to announce that an updated version of your One Tap Workstation (v26.9.9) is now available.

What is New in This Release:
• 🎬 High-Speed Title Adder Rendering & Watermarking
• ⚡ Multi-drive Task Tracking & Safar Management
• 🔍 High-Speed Data Search: Locate media and sessions across connected storage volumes instantly
• 🛡️ Enhanced stability, reliability, and offline data backups

Please check your workstation updates today to ensure you are on the latest verified release.`,
    ctaText: 'Open One Tap Workstation',
    ctaUrl: 'https://bsframework.com/onetap'
  },
  {
    id: 'features',
    label: '💡 Features Guide',
    subject: 'Supercharge Your Editing with One Tap Workflows',
    headline: 'Optimized Safar Media Management & Fast Rendering',
    body: `Salam & Greetings!

Discover the full power of your One Tap Workstation for video editing and media archiving.

Key Capabilities You Can Use Today:
• 🏷️ Standardized Safar Serial Numbering & Folder Structures
• ⚡ Automated Title Adder Batch Rendering with Audio Assignments
• 📋 Quick Event Code Lookups for Qadam, Majlis, Nikah, and more
• 📦 Archive Vault with instant search and backup drive management`,
    ctaText: 'Explore Workstation',
    ctaUrl: 'https://bsframework.com/onetap'
  },
  {
    id: 'maintenance',
    label: '🛠️ Maintenance',
    subject: 'Scheduled System Notice: One Tap Workstation Care',
    headline: 'Best Practices for High-Performance Rendering',
    body: `Salam & Greetings!

To keep your workstation running at peak performance:
• Ensure connected media storage drives are properly indexed in Archive Vault
• Check that the output directory has sufficient free disk space before queueing large batches
• Use the Cleaner tool periodically to remove orphaned temporary cache files

Our support team is always available if you require any assistance.`,
    ctaText: 'View Workstation Health',
    ctaUrl: 'https://bsframework.com/onetap'
  },
  {
    id: 'urgent',
    label: '⚠️ Urgent Notice',
    subject: 'Critical Advisory: One Tap Storage & Naming Standard',
    headline: 'Important Protocol Update for All Workstations',
    body: `Salam & Greetings!

Please review this important operational reminder regarding media storage:
• Do not append video file extensions (.mp4) to Safar directory folders
• Verify all drives are securely connected before initiating batch renders
• In case of any sync interruptions, use the Drive Sync verification tool

Thank you for your cooperation in maintaining our production standards.`,
    ctaText: 'Contact Support',
    ctaUrl: 'https://bsframework.com/onetap'
  }
]

export default function EmailBroadcastModal({ isOpen, onClose }: EmailBroadcastModalProps): JSX.Element | null {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'compose' | 'recipients' | 'setup' | 'simulator'>('compose')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')

  // Email form state
  const [subject, setSubject] = useState(TEMPLATE_PRESETS[0].subject)
  const [headline, setHeadline] = useState(TEMPLATE_PRESETS[0].headline)
  const [messageBody, setMessageBody] = useState(TEMPLATE_PRESETS[0].body)
  const [ctaText, setCtaText] = useState(TEMPLATE_PRESETS[0].ctaText)
  const [ctaUrl, setCtaUrl] = useState(TEMPLATE_PRESETS[0].ctaUrl)
  const [bannerUrl, setBannerUrl] = useState('')
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [bannerSourceMode, setBannerSourceMode] = useState<'upload' | 'url'>('upload')

  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [scriptUrl, setScriptUrl] = useState('https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec')
  const [copiedScript, setCopiedScript] = useState(false)
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  })

  // Sending state
  const [isSending, setIsSending] = useState(false)
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [resettingSetup, setResettingSetup] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const loadSettings = async () => {
      const api = (window as any).api
      let url = 'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec'
      if (api?.settings?.getAll) {
        const settings = await api.settings.getAll()
        if (settings?.ai_registration_script_url) {
          url = settings.ai_registration_script_url
        }
      }
      setScriptUrl(url)
      fetchRecipients(url)
    }
    loadSettings()
  }, [isOpen])

  const fetchRecipients = async (urlToUse?: string) => {
    const targetUrl = urlToUse || scriptUrl
    if (!targetUrl) return

    setIsLoadingRecipients(true)
    setStatusFeedback(null)
    try {
      const api = (window as any).api
      if (api?.userProfile?.fetchUserList) {
        const res = await api.userProfile.fetchUserList(targetUrl)
        if (res.success && Array.isArray(res.users)) {
          setRecipients(res.users.map((u: any) => ({ ...u, selected: true })))
          setStatusFeedback({ type: 'success', text: `Loaded ${res.users.length} registered client(s) from your Google Sheet.` })
        } else {
          setStatusFeedback({ type: 'info', text: 'No clients registered yet. As clients use the app, they will appear here.' })
        }
      }
    } catch (e: any) {
      setStatusFeedback({ type: 'error', text: `Failed to fetch client list: ${e.message || String(e)}` })
    } finally {
      setIsLoadingRecipients(false)
    }
  }

  const handleApplyPreset = (presetId: string) => {
    const p = TEMPLATE_PRESETS.find((it) => it.id === presetId)
    if (!p) return
    setSubject(p.subject)
    setHeadline(p.headline)
    setMessageBody(p.body)
    setCtaText(p.ctaText)
    setCtaUrl(p.ctaUrl)
  }

  const handleSaveScriptUrl = async () => {
    const api = (window as any).api
    if (api?.settings?.set) {
      await api.settings.set('ai_registration_script_url', scriptUrl.trim())
      setStatusFeedback({ type: 'success', text: 'Webhook URL saved! Fetching registered clients...' })
      fetchRecipients(scriptUrl.trim())
    }
  }

  const handleTestWebhook = async () => {
    if (!scriptUrl) {
      setStatusFeedback({ type: 'error', text: 'Please enter a valid Google Apps Script Webhook URL first.' })
      return
    }
    setTestResult({ status: 'loading', message: 'Pinging Google Sheet Webhook...' })
    const startTime = Date.now()
    try {
      const res = await fetch(`${scriptUrl}?action=list_users`)
      const latency = Date.now() - startTime
      const json = await res.json()
      if (json.status === 'ok') {
        setTestResult({
          status: 'success',
          message: `✅ Webhook Active! Response: ${latency}ms · Found ${json.users?.length || 0} client record(s).`
        })
        setStatusFeedback({ type: 'success', text: `Verified connection in ${latency}ms!` })
      } else {
        setTestResult({
          status: 'error',
          message: `⚠️ Connected but Apps Script returned: ${json.error || JSON.stringify(json)}`
        })
      }
    } catch (e: any) {
      setTestResult({
        status: 'error',
        message: `❌ Connection Failed: ${e.message || String(e)}`
      })
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setBannerPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const toggleSelectAll = (select: boolean) => {
    setRecipients((prev) => prev.map((r) => ({ ...r, selected: select })))
  }

  const toggleRecipient = (index: number) => {
    setRecipients((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    )
  }

  const handleExportCSV = () => {
    if (recipients.length === 0) return
    const headers = ['Name', 'Email', 'App Version', 'Device ID', 'Registered At']
    const rows = recipients.map((r) => [
      `"${(r.name || 'Client').replace(/"/g, '""')}"`,
      `"${(r.email || '').replace(/"/g, '""')}"`,
      `"${(r.appVersion || '26.9.9').replace(/"/g, '""')}"`,
      `"${(r.deviceId || '').replace(/"/g, '""')}"`,
      `"${(r.registeredAt || '').replace(/"/g, '""')}"`
    ])
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `onetap_clients_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleResetAppSetup = async () => {
    const confirmed = window.confirm(
      '⚠️ RESET APP TO FRESH INSTALL STATE?\n\nThis will remove your local storage locator (settings_location.ini) and AI profile.\n\nThe NEXT time One Tap launches, it will boot directly into:\n1. Welcome Screen\n2. Storage Folder Selection Wizard\n3. AI Profile & Cloud Registration Setup\n\nProceed with reset?'
    )
    if (!confirmed) return

    setResettingSetup(true)
    try {
      const api = (window as any).api
      if (api?.userProfile?.resetAllSetup) {
        await api.userProfile.resetAllSetup()
      }
      localStorage.removeItem('last_welcomed_version')
      localStorage.removeItem('ai_profile')
      showToast({
        type: 'success',
        title: 'App Setup Reset',
        message: 'When you restart Uni Desk, it will launch the complete Welcome and Setup Wizard from scratch.',
        duration: 6000
      })
      onClose()
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Reset Error',
        message: `Error resetting setup: ${e.message || String(e)}`
      })
    } finally {
      setResettingSetup(false)
    }
  }

  // Generate styled responsive HTML template
  const generateHtmlEmail = (recipientName: string = 'Valued Client') => {
    const bannerImg = bannerPreview || bannerUrl
    const formattedBody = messageBody
      .split('\n\n')
      .map((p) => `<p style="margin: 0 0 16px 0; line-height: 1.7; color: #334155; font-size: 15px;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @keyframes ontoWave {
      0%, 100% {
        transform: translateY(0px) scale(1);
        filter: drop-shadow(0 2px 6px rgba(180, 130, 40, 0.2));
      }
      50% {
        transform: translateY(-4px) scale(1.03);
        filter: drop-shadow(0 6px 14px rgba(245, 158, 11, 0.4));
      }
    }
    .arabic-onto-greeting {
      display: inline-block;
      animation: ontoWave 3s ease-in-out infinite;
      direction: rtl;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%); padding: 36px 40px; text-align: center;">
              <div style="display: inline-block; padding: 6px 16px; background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(129, 140, 248, 0.4); border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #c7d2fe; margin-bottom: 12px;">
                UNIDESK WORKSTATION
              </div>
              <h1 style="margin: 4px 0 0 0; color: #ffffff; font-size: 25px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.3;">${headline}</h1>
            </td>
          </tr>
          ${
            bannerImg
              ? `<tr><td style="padding: 0; background-color: #0f172a; text-align: center;"><img src="${bannerImg}" alt="Announcement Banner" style="width: 100%; max-height: 300px; object-fit: cover; display: block;" /></td></tr>`
              : ''
          }
          <tr>
            <td style="padding: 38px 40px 24px 40px;">
              <!-- Arabic Greeting Calligraphy Header with ONTO Wave UI/UX -->
              <div style="text-align: center; margin-bottom: 26px; padding: 18px 20px; background: linear-gradient(135deg, #fefcf8 0%, #f8f4ec 100%); border: 1px solid #eedec4; border-radius: 14px; box-shadow: 0 4px 12px rgba(180, 130, 40, 0.05);">
                <div class="arabic-onto-greeting" style="font-family: 'Amiri', 'Traditional Arabic', 'Scheherazade New', serif; font-size: 34px; font-weight: 700; color: #B48228; line-height: 1.3;">
                  أَهْلًا وَسَهْلًا
                </div>
                <div style="font-size: 10.5px; font-weight: 800; color: #92400e; letter-spacing: 2.2px; text-transform: uppercase; margin-top: 4px;">
                  AHLAN WA SAHLAN · WARM GREETINGS
                </div>
              </div>

              <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 700; color: #0f172a;">
                Hello ${recipientName},
              </p>
              ${formattedBody}
              ${
                ctaText && ctaUrl
                  ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 34px 0 16px 0;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 34px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);">
                      ${ctaText} →
                    </a>
                  </td>
                </tr>
              </table>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: 600;">
                Dispatched securely via UniDesk AI Workstation
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                You are receiving this communication as an authorized operator of the UniDesk Workstation.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }

  const handleSendBroadcast = async () => {
    const selectedList = recipients.filter((r) => r.selected)
    if (selectedList.length === 0) {
      setStatusFeedback({ type: 'error', text: 'Please select at least one recipient.' })
      return
    }

    if (!scriptUrl) {
      setStatusFeedback({ type: 'error', text: 'Please configure your free Google Webhook URL in the Webhook Engine tab first.' })
      return
    }

    const confirmed = window.confirm(
      `Send broadcast "${subject}" to ${selectedList.length} client(s) now?`
    )
    if (!confirmed) return

    setIsSending(true)
    setStatusFeedback(null)

    try {
      const html = generateHtmlEmail('Client')
      const api = (window as any).api
      let result: any = null

      let dispatched = false
      if (api?.userProfile?.sendBroadcast) {
        try {
          result = await api.userProfile.sendBroadcast({
            scriptUrl,
            subject: subject.trim(),
            htmlBody: html,
            recipients: selectedList.map((r) => ({ name: r.name, email: r.email }))
          })
          if (result) dispatched = true
        } catch (ipcErr) {
          console.warn('[Broadcast] Main process IPC not reloaded yet, attempting direct webhook dispatch:', ipcErr)
        }
      }

      if (!dispatched) {
        // Direct browser fallback using text/plain (bypasses CORS preflight check)
        const response = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'send_broadcast',
            subject: subject.trim(),
            htmlBody: html,
            recipients: selectedList.map((r) => ({ name: r.name, email: r.email }))
          })
        })
        const rawText = await response.text()
        try {
          result = JSON.parse(rawText)
        } catch {
          result = { status: 'ok', sent: selectedList.length }
        }
      }

      if (result && (result.status === 'ok' || result.success)) {
        setStatusFeedback({
          type: 'success',
          text: `🎉 Successfully dispatched broadcast to ${result.sent ?? selectedList.length} client(s)!`
        })
      } else {
        setStatusFeedback({ type: 'error', text: `Broadcast failed: ${result?.error || 'Unknown error'}` })
      }
    } catch (e: any) {
      setStatusFeedback({ type: 'error', text: `Failed to send broadcast: ${e.message || String(e)}` })
    } finally {
      setIsSending(false)
    }
  }

  const handleCopyScript = () => {
    const scriptCode = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "Email", "App Version", "Device ID"]);
      sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#f8fafc");
    }
    if (data.action === "register_user") {
      var rows = sheet.getDataRange().getValues();
      var exists = false;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][2] && rows[i][2].toString().toLowerCase() === data.email.toString().toLowerCase()) {
          sheet.getRange(i + 1, 1).setValue(new Date());
          sheet.getRange(i + 1, 4).setValue(data.appVersion || "26.9.9");
          exists = true;
          break;
        }
      }
      if (!exists) {
        sheet.appendRow([new Date(), data.name, data.email, data.appVersion || "26.9.9", data.deviceId || ""]);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "ok" })).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === "send_broadcast") {
      var recipients = data.recipients || [];
      var sentCount = 0;
      for (var j = 0; j < recipients.length; j++) {
        if (recipients[j].email) {
          try {
            MailApp.sendEmail({ to: recipients[j].email, subject: data.subject, htmlBody: data.htmlBody, name: "One Tap Workstation" });
            sentCount++;
          } catch (err) {}
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", sent: sentCount })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var rows = sheet.getDataRange().getValues();
    var users = [];
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][2]) {
        users.push({ registeredAt: rows[i][0], name: rows[i][1] || "Client", email: rows[i][2], appVersion: rows[i][3] || "", deviceId: rows[i][4] || "" });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", users: users })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`
    navigator.clipboard.writeText(scriptCode)
    setCopiedScript(true)
    setTimeout(() => setCopiedScript(false), 2500)
  }

  const handleCopyHtml = () => {
    const html = generateHtmlEmail('Client')
    navigator.clipboard.writeText(html)
    setStatusFeedback({ type: 'success', text: 'Rendered HTML code copied to clipboard!' })
  }

  if (!isOpen) return null

  const filteredRecipients = recipients.filter(
    (r) =>
      r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.appVersion && r.appVersion.toLowerCase().includes(searchFilter.toLowerCase()))
  )

  const selectedCount = recipients.filter((r) => r.selected).length

  return (
    <div className="eb-page-root">
      <div className="eb-page-body">
        {/* Top Executive Header */}
        <div className="eb-header">
          <div className="eb-header-title">
            <div className="eb-crown-badge">👑</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>Admin Command Center & Broadcast Studio</h3>
                <span className="eb-admin-tag">OWNER CONTROLS</span>
              </div>
              <p>Manage registered clients, broadcast styled announcements with rich banners, and simulate clean onboarding.</p>
            </div>
          </div>

          <div className="eb-header-actions">
            <button
              type="button"
              className="eb-reset-app-btn"
              onClick={handleResetAppSetup}
              disabled={resettingSetup}
              title="Reset application setup to test fresh client installation experience"
            >
              🔄 Reset App Setup
            </button>
            <button
              type="button"
              className="eb-back-workstation-btn"
              onClick={onClose}
              title="Return to Workstation"
            >
              ← Back to Workstation
            </button>
          </div>
        </div>

        {/* Executive KPI Bar */}
        <div className="eb-kpi-bar">
          <div className="eb-kpi-card" onClick={() => setActiveTab('recipients')}>
            <span className="eb-kpi-icon">👥</span>
            <div>
              <strong className="eb-kpi-val">{recipients.length}</strong>
              <span className="eb-kpi-label">Registered Clients</span>
            </div>
          </div>
          <div className="eb-kpi-card" onClick={() => setActiveTab('compose')}>
            <span className="eb-kpi-icon">🎯</span>
            <div>
              <strong className="eb-kpi-val">{selectedCount}</strong>
              <span className="eb-kpi-label">Broadcast Targets</span>
            </div>
          </div>
          <div className="eb-kpi-card" onClick={() => setActiveTab('setup')}>
            <span className="eb-kpi-icon">☁️</span>
            <div>
              <strong className="eb-kpi-val" style={{ color: scriptUrl ? '#34d399' : '#f87171' }}>
                {scriptUrl ? 'Live' : 'Unconfigured'}
              </strong>
              <span className="eb-kpi-label">Google Sheet Webhook</span>
            </div>
          </div>
          <div className="eb-kpi-card">
            <span className="eb-kpi-icon">⚡</span>
            <div>
              <strong className="eb-kpi-val" style={{ color: '#818cf8' }}>100% Free</strong>
              <span className="eb-kpi-label">Google Cloud Quota</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="eb-tabs">
          <button
            className={`eb-tab ${activeTab === 'compose' ? 'active' : ''}`}
            onClick={() => setActiveTab('compose')}
          >
            📢 Broadcast Studio
          </button>
          <button
            className={`eb-tab ${activeTab === 'recipients' ? 'active' : ''}`}
            onClick={() => setActiveTab('recipients')}
          >
            👥 Client Directory ({recipients.length})
          </button>
          <button
            className={`eb-tab ${activeTab === 'setup' ? 'active' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            ⚙️ Free Webhook Engine
          </button>
          <button
            className={`eb-tab ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            🧪 Client Setup Simulator
          </button>
        </div>

        {/* Status Notification Banner */}
        {statusFeedback && (
          <div className={`eb-feedback eb-feedback-${statusFeedback.type}`}>
            {statusFeedback.type === 'success' && '✅ '}
            {statusFeedback.type === 'error' && '⚠️ '}
            {statusFeedback.type === 'info' && 'ℹ️ '}
            {statusFeedback.text}
          </div>
        )}

        {/* TAB 1: COMPOSE STUDIO */}
        {activeTab === 'compose' && (
          <div className="eb-content eb-compose-grid">
            <div className="eb-form-col">
              {/* Preset Quick Chips */}
              <div className="eb-preset-chips">
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Quick Presets:</span>
                {TEMPLATE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="eb-chip-btn"
                    onClick={() => handleApplyPreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Islamic Arabic Greeting Header Display */}
              <div className="eb-arabic-greeting-banner">
                <div className="eb-arabic-greeting-info">
                  <span className="eb-arabic-greeting-label">🕌 Islamic Header Greeting</span>
                  <span className="eb-arabic-greeting-sub">Animated ONTO kinetic typography rendered in client emails</span>
                </div>
                <div className="eb-arabic-onto-text">
                  أَهْلًا وَسَهْلًا
                </div>
              </div>

              <div className="eb-field">
                <label>Email Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Important Workstation Update: Uni Desk v26.9.9"
                />
              </div>

              <div className="eb-field">
                <label>Headline Title (Email Hero)</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. New Features & Version 26.9.9"
                />
              </div>

              {/* Banner Image Customization */}
              <div className="eb-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Header Banner / PFP Image</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className={`eb-mini-tab ${bannerSourceMode === 'upload' ? 'active' : ''}`}
                      onClick={() => setBannerSourceMode('upload')}
                    >
                      📁 Upload File
                    </button>
                    <button
                      type="button"
                      className={`eb-mini-tab ${bannerSourceMode === 'url' ? 'active' : ''}`}
                      onClick={() => setBannerSourceMode('url')}
                    >
                      🔗 Image URL
                    </button>
                  </div>
                </div>

                {bannerSourceMode === 'upload' ? (
                  <div className="eb-image-upload-row">
                    <button
                      type="button"
                      className="eb-btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📁 Select Image from PC
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                    />
                    {bannerPreview && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#4ade80' }}>✓ Image Loaded</span>
                        <button
                          type="button"
                          className="eb-btn-ghost"
                          onClick={() => setBannerPreview(null)}
                        >
                          ✕ Remove
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="Paste direct HTTPS image URL (e.g. https://.../banner.png)"
                  />
                )}
              </div>

              <div className="eb-field">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label>Formatted Message Content</label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {messageBody.length} chars · {messageBody.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Type your message here. Separate paragraphs with double enters."
                />
              </div>

              <div className="eb-row-2">
                <div className="eb-field">
                  <label>Action Button Label</label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="e.g. Open One Tap"
                  />
                </div>
                <div className="eb-field">
                  <label>Button Destination URL</label>
                  <input
                    type="text"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://bsframework.com/onetap"
                  />
                </div>
              </div>
            </div>

            {/* Live Visual Preview Column */}
            <div className="eb-preview-col">
              <div className="eb-preview-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>👁️ Real-Time HTML Preview</span>
                  <div className="eb-device-toggle">
                    <button
                      type="button"
                      className={previewDevice === 'desktop' ? 'active' : ''}
                      onClick={() => setPreviewDevice('desktop')}
                      title="Desktop View (600px)"
                    >
                      🖥️ Desktop
                    </button>
                    <button
                      type="button"
                      className={previewDevice === 'mobile' ? 'active' : ''}
                      onClick={() => setPreviewDevice('mobile')}
                      title="Mobile Phone View (375px)"
                    >
                      📱 Mobile
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="eb-chip-btn"
                  onClick={handleCopyHtml}
                  title="Copy full HTML code to clipboard"
                >
                  📋 Copy HTML
                </button>
              </div>

              <div className={`eb-preview-frame-wrapper ${previewDevice === 'mobile' ? 'mobile-view' : ''}`}>
                {previewDevice === 'mobile' && <div className="eb-phone-notch" />}
                <iframe
                  title="Email Preview"
                  className="eb-preview-iframe"
                  srcDoc={generateHtmlEmail('Valued Client')}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLIENT DIRECTORY */}
        {activeTab === 'recipients' && (
          <div className="eb-content">
            <div className="eb-recipients-toolbar">
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search clients by name, email, or version..."
                  className="eb-search-input"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="eb-recipients-actions">
                <button className="eb-btn-secondary" onClick={() => toggleSelectAll(true)}>
                  Select All ({recipients.length})
                </button>
                <button className="eb-btn-secondary" onClick={() => toggleSelectAll(false)}>
                  Deselect All
                </button>
                <button
                  className="eb-btn-secondary"
                  onClick={() => fetchRecipients()}
                  disabled={isLoadingRecipients}
                >
                  {isLoadingRecipients ? 'Syncing...' : '🔄 Sync from Sheet'}
                </button>
                <button
                  className="eb-btn-secondary"
                  onClick={handleExportCSV}
                  disabled={recipients.length === 0}
                  title="Export clients to CSV file"
                >
                  📥 Export CSV
                </button>
              </div>
            </div>

            <div className="eb-table-container">
              {filteredRecipients.length === 0 ? (
                <div className="eb-empty-state">
                  <div style={{ fontSize: '38px', marginBottom: '10px' }}>👥</div>
                  <h4>No Registered Clients Found</h4>
                  <p>
                    {searchFilter
                      ? 'No clients match your search filter.'
                      : 'Make sure your Webhook URL is configured under the Free Webhook Engine tab. As clients set up One Tap, they will automatically appear here!'}
                  </p>
                </div>
              ) : (
                <table className="eb-table">
                  <thead>
                    <tr>
                      <th style={{ width: '44px' }}>
                        <input
                          type="checkbox"
                          checked={selectedCount === recipients.length && recipients.length > 0}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th>Client Name</th>
                      <th>Email Address</th>
                      <th>Workstation Version</th>
                      <th>Device ID</th>
                      <th>Registration Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.map((r, i) => (
                      <tr key={i} className={r.selected ? 'selected' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!r.selected}
                            onChange={() => toggleRecipient(i)}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="eb-avatar-circle">
                              {(r.name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <strong>{r.name || 'Client'}</strong>
                          </div>
                        </td>
                        <td>
                          <code>{r.email}</code>
                        </td>
                        <td>
                          <span className="eb-version-badge">{r.appVersion || '26.9.9'}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {r.deviceId ? `${r.deviceId.slice(0, 12)}...` : '—'}
                          </span>
                        </td>
                        <td>
                          {r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: 100% FREE WEBHOOK ENGINE */}
        {activeTab === 'setup' && (
          <div className="eb-content eb-setup-flow">
            <div className="eb-setup-card">
              <h4>🚀 Free Google Apps Script Webhook Engine (100% Cost-Free Forever)</h4>
              <p>
                When any client installs and completes AI Setup on their computer, their machine silently makes an HTTPS POST
                to your private Google Sheet. You receive their Name, Email, Version, and Timestamp in real-time.
              </p>

              <div className="eb-steps">
                <div className="eb-step">
                  <span className="eb-step-num">1</span>
                  <div>
                    <strong>Create a Blank Google Sheet</strong>
                    <p>Go to <a href="https://sheets.new" target="_blank" rel="noreferrer">sheets.new</a> in your browser and name it <code>One Tap Clients</code>.</p>
                  </div>
                </div>

                <div className="eb-step">
                  <span className="eb-step-num">2</span>
                  <div>
                    <strong>Copy & Paste Free Webhook Code</strong>
                    <p>In Google Sheets, click <strong>Extensions &gt; Apps Script</strong>. Replace existing code and paste:</p>
                    <button className="eb-btn-primary" onClick={handleCopyScript} style={{ marginTop: '8px' }}>
                      {copiedScript ? '✅ Webhook Code Copied!' : '📋 Copy Free Google Apps Script Code'}
                    </button>
                  </div>
                </div>

                <div className="eb-step">
                  <span className="eb-step-num">3</span>
                  <div>
                    <strong>Deploy as Web App</strong>
                    <p>
                      Click <strong>Deploy &gt; New deployment</strong> &gt; select <strong>Web app</strong>.<br />
                      Set <em>Execute as:</em> <strong>Me</strong> and <em>Who has access:</em> <strong>Anyone</strong>.<br />
                      Authorize your Google account, then paste the resulting Web app URL below:
                    </p>
                  </div>
                </div>
              </div>

              <div className="eb-field" style={{ marginTop: '24px' }}>
                <label>Your Google Apps Script Webhook URL</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={scriptUrl}
                    onChange={(e) => setScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    style={{ flex: 1 }}
                  />
                  <button className="eb-btn-primary" onClick={handleSaveScriptUrl}>
                    Save Webhook URL
                  </button>
                  <button className="eb-btn-secondary" onClick={handleTestWebhook}>
                    🧪 Test Connection
                  </button>
                </div>
                {testResult.message && (
                  <div className={`eb-test-box ${testResult.status}`}>
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLIENT SETUP SIMULATOR & FACTORY RESET */}
        {activeTab === 'simulator' && (
          <div className="eb-content eb-setup-flow">
            <div className="eb-setup-card">
              <h4>🧪 Client Onboarding & Clean Setup Simulator</h4>
              <p>
                Want to experience exactly what your clients see when they run One Tap for the first time?
                Clicking the button below will perform a safe factory reset of your local storage locator and AI profile.
              </p>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px', padding: '18px', margin: '18px 0' }}>
                <strong style={{ color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px' }}>
                  <span>⚠️</span> Full Setup Reset Trigger:
                </strong>
                <span style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6', display: 'block' }}>
                  This removes <code>settings_location.ini</code> and <code>ai_profile.json</code>.
                  The <strong>NEXT TIME</strong> you launch One Tap, it will prompt for everything from scratch:
                </span>
                <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.7 }}>
                  <li>✨ <strong>Step 1:</strong> Arabic & Lisan-ud-Dawat Welcome Screen</li>
                  <li>📁 <strong>Step 2:</strong> Storage Folder Selection Wizard</li>
                  <li>👤 <strong>Step 3:</strong> AI Profile Setup (Name, Email, Profile Picture & Sheet Registration)</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="eb-btn-primary"
                  onClick={handleResetAppSetup}
                  disabled={resettingSetup}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                    padding: '14px 28px',
                    fontSize: '14px',
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)'
                  }}
                >
                  {resettingSetup ? 'Resetting Setup...' : '🔄 Factory Reset App Setup for Next Launch'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="eb-footer">
          <div className="eb-footer-left">
            <span className="eb-count-text">
              👥 <strong>{selectedCount}</strong> client(s) selected out of {recipients.length}
            </span>
          </div>
          <div className="eb-footer-right">
            <button className="eb-btn-ghost" onClick={onClose}>
              Close
            </button>
            <button
              className="eb-btn-primary eb-btn-send"
              onClick={handleSendBroadcast}
              disabled={isSending || selectedCount === 0}
            >
              {isSending ? '🚀 Dispatching Broadcast...' : `🚀 Send Broadcast to ${selectedCount} Client(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
