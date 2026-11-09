// Vercel Serverless Function: /api/send-stage-update
// Free tier compatible — zero custom domain required.
// Supports:
// 1. Gmail SMTP via Nodemailer (100% free, 500 emails/day, no domain needed)
// 2. Telegram Bot API (100% free instant push messages to groups or chats, no domain needed)
// 3. WhatsApp Message via CallMeBot (100% free API, no domain needed)
// 4. Brevo Free API (300 emails/day, personal email sender, no domain needed)
// 5. Resend Free API (testing domain / free tier)

import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  try {
    const {
      recipients = [],
      provider = 'gmail',
      smtpConfig = {},
      apiKey = '',
      telegramConfig = {},
      whatsappConfig = {},
      safarName = 'Safar',
      totalDates = 0,
      deliveredDates = 0,
      deliveredPercent = 0,
      events = [],
      websiteUrl = 'https://onetap-workstation.vercel.app',
      isTest = false
    } = req.body || {}

    const cleanRecipients = (Array.isArray(recipients) ? recipients : [recipients])
      .map(r => String(r || '').trim())
      .filter(r => r && r.includes('@'))

    const hasTelegram = Boolean(telegramConfig.botToken && telegramConfig.chatId)
    const hasWhatsApp = Boolean(whatsappConfig.phone && whatsappConfig.apiKey)
    const hasEmail = cleanRecipients.length > 0

    if (!hasEmail && !hasTelegram && !hasWhatsApp) {
      return res.status(400).json({
        error: 'No recipient configured. Please enter recipient emails, Telegram Bot, or WhatsApp details in settings.'
      })
    }

    const eventCount = events.length
    const subject = isTest
      ? `[One Tap] Test Notification · ${safarName || 'System Verified'}`
      : eventCount === 1
        ? `[One Tap] Stage Update: ${events[0].dateFolder} marked ${events[0].stageLabel || events[0].stage} (${safarName})`
        : `[One Tap] Compiled Update: ${eventCount} Dates Advanced in ${safarName}`

    // Stage color mapping
    const getStageColor = (st) => {
      const lower = String(st || '').toLowerCase()
      if (lower.includes('completed')) return { bg: '#10b981', text: '#ffffff', label: 'Completed Every Stage' }
      if (lower.includes('jameya') || lower.includes('submission')) return { bg: '#8b5cf6', text: '#ffffff', label: 'Submission to Al Jamea' }
      if (lower.includes('upload')) return { bg: '#059669', text: '#ffffff', label: 'Uploaded' }
      if (lower.includes('render')) return { bg: '#2563eb', text: '#ffffff', label: 'Rendered' }
      return { bg: '#d97706', text: '#ffffff', label: 'In Editing' }
    }

    // Results ledger
    const dispatchResults = {
      email: false,
      telegram: false,
      whatsapp: false
    }

    // ── Dispatch to Telegram Bot (Instant free push message) ──
    if (hasTelegram) {
      try {
        const tgEvents = events.map(e =>
          `• <b>${e.dateFolder}</b>: ${e.stageLabel || e.stage} (${e.mediaType === 'photo' ? '📷 Photos' : '🎬 Video'} · Editor: ${e.editorName || 'Team'})`
        ).join('\n')

        const tgText = `📢 <b>One Tap Safar Update · ${safarName}</b>\n` +
          `${isTest ? '🧪 <b>Test notification verified!</b>' : `⚡ <b>${eventCount} Date Stage Update${eventCount > 1 ? 's Compiled' : ''} (5-min batch)</b>`}\n\n` +
          `${tgEvents}\n\n` +
          `📊 <b>Progress:</b> ${deliveredDates} of ${totalDates} delivered (${deliveredPercent}%)\n` +
          `🔗 <a href="${websiteUrl}">Open Live Safar Tracker Dashboard</a>`

        const tgRes = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken.trim()}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramConfig.chatId.trim(),
            text: tgText,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        })
        const tgData = await tgRes.json().catch(() => ({}))
        if (tgData.ok) {
          dispatchResults.telegram = true
        } else {
          console.error('[Telegram Error]', tgData)
        }
      } catch (tgErr) {
        console.error('[Telegram Exception]', tgErr)
      }
    }

    // ── Dispatch to WhatsApp via CallMeBot (Free API) ──
    if (hasWhatsApp) {
      try {
        const waEvents = events.map(e => `• ${e.dateFolder}: ${e.stageLabel || e.stage} (${e.editorName || 'Editor'})`).join('\n')
        const waText = `📢 *One Tap Safar Update (${safarName})*\n${isTest ? '🧪 Test Notification' : `⚡ ${eventCount} Dates Advanced`}\n\n${waEvents}\n\n📊 Progress: ${deliveredDates}/${totalDates} delivered (${deliveredPercent}%)\n🔗 ${websiteUrl}`

        const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(whatsappConfig.phone.trim())}&text=${encodeURIComponent(waText)}&apikey=${encodeURIComponent(whatsappConfig.apiKey.trim())}`
        const waRes = await fetch(waUrl)
        if (waRes.ok) {
          dispatchResults.whatsapp = true
        }
      } catch (waErr) {
        console.error('[WhatsApp Exception]', waErr)
      }
    }

    // ── Dispatch via Email (if recipients configured) ──
    if (hasEmail) {
      // HTML Email Template
      const rowsHtml = events.map(evt => {
        const stageInfo = getStageColor(evt.stageLabel || evt.stage)
        const dateText = evt.dateLabel ? `${evt.dateFolder} (${evt.dateLabel})` : evt.dateFolder
        const editor = evt.editorName || 'Team Editor'
        const mediaTag = evt.mediaType === 'photo' ? '📷 Photos' : evt.mediaType === 'both' ? '🎬 Video & 📷 Photos' : '🎬 Video'

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 14px; font-weight: 600; color: #1e293b;">
              ${dateText}
              <div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;">
                ${mediaTag} · Assigned: <strong>${editor}</strong>
              </div>
            </td>
            <td style="padding: 12px 14px; text-align: right;">
              <span style="display: inline-block; background-color: ${stageInfo.bg}; color: ${stageInfo.text}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${evt.stageLabel || stageInfo.label}
              </span>
            </td>
          </tr>
        `
      }).join('')

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
          <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
            
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 24px 28px; text-align: left; border-bottom: 3px solid #6366f1;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); color: #e0e7ff; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; margin-bottom: 8px;">
                One Tap Media Tracker · Production Digest
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
                ${isTest ? '🧪 System Notification Test' : `${eventCount} Stage Update${eventCount > 1 ? 's' : ''} Compiled`}
              </h1>
              <div style="color: #c7d2fe; font-size: 13px; margin-top: 4px; font-weight: 500;">
                📍 Safar Campaign: <strong style="color: #ffffff;">${safarName}</strong>
              </div>
            </div>

            <!-- Body Content -->
            <div style="padding: 24px 28px;">
              ${isTest ? `
                <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
                  <strong style="color: #065f46; font-size: 14px;">✓ Notification Delivery Verified!</strong>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #047857;">
                    Your free notification settings are properly configured. Production stage transitions and 5-minute compiled digests will be delivered directly to this address.
                  </p>
                </div>
              ` : `
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #475569;">
                  The following date session${eventCount > 1 ? 's were' : ' was'} moved to the next production stage within the last 5 minutes:
                </p>
              `}

              <!-- Event Table -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;">
                <thead>
                  <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Date Folder</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Completed Stage</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="2" style="padding: 14px; text-align: center; color: #64748b;">No individual events listed.</td></tr>'}
                </tbody>
              </table>

              <!-- Overall Safar Progress -->
              ${totalDates > 0 ? `
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 14px 18px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; font-weight: 600;">
                    <span style="color: #475569;">Total Campaign Deliverables</span>
                    <span style="color: #059669; font-weight: 800;">${deliveredDates} of ${totalDates} dates delivered (${deliveredPercent}%)</span>
                  </div>
                  <div style="height: 8px; width: 100%; background-color: #e2e8f0; border-radius: 9999px; overflow: hidden;">
                    <div style="height: 100%; width: ${Math.min(100, Math.max(0, deliveredPercent))}%; background: linear-gradient(90deg, #10b981 0%, #059669 100%);"></div>
                  </div>
                </div>
              ` : ''}

              <!-- Action Button -->
              <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${websiteUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                  Open Live Safar Tracker Dashboard ➔
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 16px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              Updates occurring within 5 minutes are compiled automatically to prevent mailbox clutter.<br>
              Powered by <strong>One Tap Workstation</strong> & Vercel Free Tier · No custom domain required.
            </div>
          </div>
        </body>
        </html>
      `

      const textSummary = events.map(e => `• ${e.dateFolder}: ${e.stageLabel || e.stage} (by ${e.editorName || 'Editor'})`).join('\n')
      const emailText = `${subject}\n\nSafar: ${safarName}\nDelivered: ${deliveredDates}/${totalDates} (${deliveredPercent}%)\n\nUpdates:\n${textSummary}\n\nOpen tracker: ${websiteUrl}`

      // Method: Gmail SMTP via Nodemailer
      const smtpUser = smtpConfig.user || process.env.SMTP_USER || process.env.GMAIL_USER
      const smtpPass = smtpConfig.pass || process.env.SMTP_PASS || process.env.GMAIL_APP_PASS

      if (provider === 'gmail' || (!apiKey && smtpUser && smtpPass)) {
        if (smtpUser && smtpPass) {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: smtpUser.trim(),
              pass: smtpPass.trim().replace(/\s+/g, '')
            }
          })

          const info = await transporter.sendMail({
            from: `"One Tap Workstation" <${smtpUser.trim()}>`,
            to: cleanRecipients.join(', '),
            subject,
            text: emailText,
            html: emailHtml
          })
          dispatchResults.email = true
        }
      } else if (provider === 'brevo' || apiKey) {
        const senderEmail = smtpUser || cleanRecipients[0]
        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': apiKey.trim(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: 'One Tap Workstation', email: senderEmail },
            to: cleanRecipients.map(e => ({ email: e })),
            subject,
            htmlContent: emailHtml,
            textContent: emailText
          })
        })
        if (brevoRes.ok) dispatchResults.email = true
      }
    }

    return res.status(200).json({
      success: true,
      dispatchResults,
      recipients: cleanRecipients,
      eventCount
    })
  } catch (err) {
    console.error('[API send-stage-update] Error:', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err)
    })
  }
}
