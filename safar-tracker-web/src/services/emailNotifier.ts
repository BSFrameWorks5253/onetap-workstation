// Smart 5-Minute Batching Email Notification Service
// Works 100% free on Vercel without custom domain using Gmail SMTP (or Brevo/Resend)

export interface EmailNotificationSettings {
  enabled: boolean
  recipients: string[]
  provider: 'gmail' | 'brevo' | 'resend'
  gmailUser: string
  gmailAppPass: string
  apiKey?: string
  telegramBotToken?: string
  telegramChatId?: string
  whatsappPhone?: string
  whatsappApiKey?: string
  debounceMinutes: number // default: 5 minutes
  safarWebsiteUrl?: string
}

export interface StageUpdateEvent {
  id: string
  safarName: string
  dateFolder: string
  dateLabel?: string
  fromStage?: string
  stage: string
  stageLabel: string
  editorName?: string
  mediaType: 'video' | 'photo' | 'both'
  timestamp: number
}

export interface SafarContextInfo {
  safarName: string
  totalDates?: number
  deliveredDates?: number
  deliveredPercent?: number
}

const SETTINGS_KEY = 'onetap_email_settings'
const QUEUE_KEY = 'onetap_pending_email_queue'
const TARGET_TIME_KEY = 'onetap_email_target_time'
const CONTEXT_KEY = 'onetap_email_context'

export const DEFAULT_EMAIL_SETTINGS: EmailNotificationSettings = {
  enabled: true,
  recipients: ['murtaza.b5253@gmail.com'],
  provider: 'gmail',
  gmailUser: '',
  gmailAppPass: '',
  debounceMinutes: 5,
  safarWebsiteUrl: typeof window !== 'undefined' ? window.location.origin : 'https://onetap-workstation.vercel.app'
}

export interface EmailQueueStatus {
  queue: StageUpdateEvent[]
  remainingSeconds: number
  isSending: boolean
  lastSentAt?: string
  lastError?: string
}

type QueueListener = (status: EmailQueueStatus) => void

class EmailNotifierService {
  private settings: EmailNotificationSettings = { ...DEFAULT_EMAIL_SETTINGS }
  private queue: StageUpdateEvent[] = []
  private targetTime: number | null = null
  private timerId: ReturnType<typeof setTimeout> | null = null
  private tickerId: ReturnType<typeof setInterval> | null = null
  private listeners: Set<QueueListener> = new Set()
  private isSending: boolean = false
  private lastSentAt?: string
  private lastError?: string
  private safarContextMap: Record<string, SafarContextInfo> = {}

  constructor() {
    this.loadSettings()
    this.restoreQueue()
  }

  // ── Settings Management ──
  public getSettings(): EmailNotificationSettings {
    return { ...this.settings }
  }

  public saveSettings(newSettings: Partial<EmailNotificationSettings>) {
    this.settings = { ...this.settings, ...newSettings }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
    } catch {}
    this.notify()
  }

  private loadSettings() {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        this.settings = { ...DEFAULT_EMAIL_SETTINGS, ...parsed }
      }
    } catch {
      this.settings = { ...DEFAULT_EMAIL_SETTINGS }
    }
  }

  // ── Queue Management & 5-Minute Debounce ──
  private restoreQueue() {
    try {
      const storedQueue = localStorage.getItem(QUEUE_KEY)
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue)
      }
      const storedTarget = localStorage.getItem(TARGET_TIME_KEY)
      if (storedTarget) {
        this.targetTime = parseInt(storedTarget, 10)
      }
      const storedCtx = localStorage.getItem(CONTEXT_KEY)
      if (storedCtx) {
        this.safarContextMap = JSON.parse(storedCtx)
      }

      if (this.queue.length > 0 && this.targetTime) {
        const remaining = this.targetTime - Date.now()
        if (remaining <= 0) {
          // If time already expired while offline/unloaded, flush immediately
          setTimeout(() => void this.flushQueue(), 1000)
        } else {
          this.startCountdown(remaining)
        }
      }
    } catch {
      this.queue = []
      this.targetTime = null
    }
  }

  private persistQueue() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue))
      if (this.targetTime) {
        localStorage.setItem(TARGET_TIME_KEY, String(this.targetTime))
      } else {
        localStorage.removeItem(TARGET_TIME_KEY)
      }
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(this.safarContextMap))
    } catch {}
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getStatus(): EmailQueueStatus {
    const remainingSeconds = this.targetTime
      ? Math.max(0, Math.ceil((this.targetTime - Date.now()) / 1000))
      : 0
    return {
      queue: [...this.queue],
      remainingSeconds,
      isSending: this.isSending,
      lastSentAt: this.lastSentAt,
      lastError: this.lastError
    }
  }

  private notify() {
    const status = this.getStatus()
    this.listeners.forEach(fn => {
      try {
        fn(status)
      } catch (err) {
        console.error('[EmailNotifier] Listener error:', err)
      }
    })
  }

  /**
   * Queue a stage update event.
   * If within 5 minutes multiple dates are moved, they are compiled into one single digest.
   */
  public queueStageUpdate(event: Omit<StageUpdateEvent, 'id' | 'timestamp'>, context?: SafarContextInfo) {
    if (!this.settings.enabled) {
      return
    }

    const eventId = `${event.safarName}::${event.dateFolder}`
    const fullEvent: StageUpdateEvent = {
      ...event,
      id: eventId,
      timestamp: Date.now()
    }

    // Context tracking for progress bars
    if (context && context.safarName) {
      this.safarContextMap[context.safarName] = context
    }

    // Upsert into queue: if the same date moved again, update it to the latest stage
    const existingIndex = this.queue.findIndex(e => e.id === eventId)
    if (existingIndex >= 0) {
      this.queue[existingIndex] = fullEvent
    } else {
      this.queue.push(fullEvent)
    }

    // If countdown is not active, start the 5-minute countdown window
    const debounceMs = Math.max(1, this.settings.debounceMinutes || 5) * 60 * 1000
    if (!this.targetTime) {
      this.targetTime = Date.now() + debounceMs
    }

    this.persistQueue()
    this.startCountdown(this.targetTime - Date.now())
    this.notify()
  }

  private startCountdown(remainingMs: number) {
    if (this.timerId) clearTimeout(this.timerId)
    if (this.tickerId) clearInterval(this.tickerId)

    this.timerId = setTimeout(() => {
      void this.flushQueue()
    }, Math.max(0, remainingMs))

    // Tick every second to update countdown display
    this.tickerId = setInterval(() => {
      if (!this.targetTime || Date.now() >= this.targetTime) {
        if (this.tickerId) clearInterval(this.tickerId)
      }
      this.notify()
    }, 1000)
  }

  /**
   * Immediately dispatch all queued updates as a compiled digest (or single notification).
   */
  public async flushQueue(): Promise<{ success: boolean; error?: string }> {
    if (this.queue.length === 0) {
      return { success: true }
    }

    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
    if (this.tickerId) {
      clearInterval(this.tickerId)
      this.tickerId = null
    }

    const eventsToSend = [...this.queue]
    const primarySafar = eventsToSend[0]?.safarName || 'Safar'
    const ctx = this.safarContextMap[primarySafar] || {
      safarName: primarySafar,
      totalDates: eventsToSend.length,
      deliveredDates: eventsToSend.filter(e => e.stage === 'upload' || e.stage === 'jameya' || e.stage === 'completed').length,
      deliveredPercent: 0
    }

    this.isSending = true
    this.lastError = undefined
    this.notify()

    try {
      const payload = {
        recipients: this.settings.recipients,
        provider: this.settings.provider,
        smtpConfig: {
          user: this.settings.gmailUser,
          pass: this.settings.gmailAppPass
        },
        apiKey: this.settings.apiKey,
        telegramConfig: {
          botToken: this.settings.telegramBotToken,
          chatId: this.settings.telegramChatId
        },
        whatsappConfig: {
          phone: this.settings.whatsappPhone,
          apiKey: this.settings.whatsappApiKey
        },
        safarName: primarySafar,
        totalDates: ctx.totalDates || eventsToSend.length,
        deliveredDates: ctx.deliveredDates || 0,
        deliveredPercent: ctx.deliveredPercent || 0,
        events: eventsToSend,
        websiteUrl: this.settings.safarWebsiteUrl || window.location.origin
      }

      const res = await fetch('/api/send-stage-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || `Server responded with ${res.status}`)
      }

      // Success: clear sent queue
      this.queue = []
      this.targetTime = null
      this.lastSentAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      this.persistQueue()
      this.notify()
      return { success: true }
    } catch (err: any) {
      console.error('[EmailNotifier] Flush failed:', err)
      this.lastError = err?.message || String(err)
      // Retry in 2 minutes on error
      this.targetTime = Date.now() + 2 * 60 * 1000
      this.persistQueue()
      this.startCountdown(2 * 60 * 1000)
      this.notify()
      return { success: false, error: this.lastError }
    } finally {
      this.isSending = false
      this.notify()
    }
  }

  /**
   * Send a test notification to verify recipient and credentials.
   */
  public async sendTestEmail(overrideSettings?: Partial<EmailNotificationSettings>): Promise<{ success: boolean; message?: string }> {
    const s = { ...this.settings, ...(overrideSettings || {}) }
    if (!s.recipients || s.recipients.length === 0 || !s.recipients[0]) {
      throw new Error('Please enter at least one recipient email address.')
    }

    const payload = {
      recipients: s.recipients,
      provider: s.provider,
      smtpConfig: {
        user: s.gmailUser,
        pass: s.gmailAppPass
      },
      apiKey: s.apiKey,
      telegramConfig: {
        botToken: s.telegramBotToken,
        chatId: s.telegramChatId
      },
      whatsappConfig: {
        phone: s.whatsappPhone,
        apiKey: s.whatsappApiKey
      },
      safarName: 'System Verification Test',
      totalDates: 1,
      deliveredDates: 1,
      deliveredPercent: 100,
      events: [
        {
          id: 'test-item',
          dateFolder: '1448-05-08_02',
          dateLabel: 'Sample Majlis Session',
          stage: 'upload',
          stageLabel: 'Uploaded',
          editorName: 'Murtaza',
          mediaType: 'both',
          timestamp: Date.now()
        }
      ],
      websiteUrl: s.safarWebsiteUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://onetap-workstation.vercel.app'),
      isTest: true
    }

    const res = await fetch('/api/send-stage-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}: Failed to send test email.`)
    }

    return {
      success: true,
      message: `Test email sent successfully to ${data.recipients?.join(', ') || s.recipients.join(', ')}!`
    }
  }

  /**
   * Cancel and clear all pending updates.
   */
  public clearQueue() {
    this.queue = []
    this.targetTime = null
    if (this.timerId) clearTimeout(this.timerId)
    if (this.tickerId) clearInterval(this.tickerId)
    this.timerId = null
    this.tickerId = null
    this.persistQueue()
    this.notify()
  }
}

export const emailNotifier = new EmailNotifierService()
