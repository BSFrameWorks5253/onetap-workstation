/**
 * ====================================================================
 * STATS & TELEMETRY CLOUD SYNC DAEMON (One Tap Workstation)
 * ====================================================================
 * 
 * Synchronizes workstation production stats and Safar tracker snapshots
 * with the cloud (safar-tracker-web / Supabase) with:
 * 1. Zero Database Overload: Single-row UPSERT on 'primary' key (Fixed 1-row table)
 * 2. Nightly Sync: Runs automatically at night (between 22:00 and 02:00)
 * 3. Pre-Shutdown Flush: Flushes today's stats on app close/shutdown before laptop is turned off
 * 4. Next-Boot Catchup: If the client laptop was turned off at night, catches up immediately on launch
 * ====================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getLatestTrackerData, scanTrackerDataAsync } from '../ipc/taskTracker.ipc'
import { getSettingsFolder } from './settingsManager'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dubscvthmkgkeiqdladp.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_kYApNvq2_6HAfNwJb8hW1g_7iLMSVyk'

let supabase: SupabaseClient | null = null
let syncTimer: NodeJS.Timeout | null = null
let isSyncInProgress = false

function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    })
    return supabase
  } catch (err) {
    console.warn('[StatsSyncDaemon] Could not initialize Supabase client:', err)
    return null
  }
}

function getSyncStampFile(): string {
  return path.join(getSettingsFolder(), 'last_cloud_sync.json')
}

export function getLastSyncInfo(): { lastDate: string; lastTime: string } {
  try {
    const p = getSyncStampFile()
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  } catch {}
  return { lastDate: '', lastTime: '' }
}

function saveSyncStamp(): void {
  try {
    const now = new Date()
    const info = {
      lastDate: now.toISOString().slice(0, 10),
      lastTime: now.toISOString()
    }
    fs.writeFileSync(getSyncStampFile(), JSON.stringify(info, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[StatsSyncDaemon] Failed to write sync stamp:', err)
  }
}

/**
 * Pushes a compact snapshot to Supabase safar_tracker_snapshots table.
 * Exactly 1 row is touched (id = 'primary') with zero DB connection pool overhead.
 */
export async function syncStatsToCloud(reason: string): Promise<boolean> {
  if (isSyncInProgress) return false
  isSyncInProgress = true

  const client = getSupabaseClient()
  if (!client) {
    isSyncInProgress = false
    return false
  }

  try {
    console.log(`[StatsSyncDaemon] Initiating cloud sync (reason: ${reason})…`)

    // Ensure we have fresh tracker records
    let data = getLatestTrackerData()
    if (!data || (!data.safars.length && !data.tasks.length)) {
      try {
        data = await scanTrackerDataAsync({ force: false })
      } catch {}
    }

    const tasks = data?.tasks || []
    const safars = data?.safars || []

    const cleanSafars = safars.map((s) => ({
      safarName: s.name,
      safarYear: s.year,
      totalDays: s.totalDays,
      isArchived: Boolean(s.isArchived),
      isDone: Boolean(s.isDone),
      updatedAt: new Date().toISOString()
    }))

    const cleanTasks = tasks.map((t: any) => ({
      id: `${t.safarName}_${t.dateFolder}`.replace(/[^\w-]/g, '_'),
      safarName: t.safarName,
      dateFolder: t.dateFolder,
      hijriDate: t.hijriDate || '',
      stage: t.status || 'editing_pending',
      dueDate: t.dueDate || '',
      editorName: t.editorName || '',
      photoStage: t.photoStage || undefined,
      photoEditorName: t.photoEditorName || undefined,
      photoUploaded: Boolean(t.photoUploaded),
      renderDuration: typeof t.renderDuration === 'number' ? t.renderDuration : undefined,
      renderVideoCount: typeof t.renderVideoCount === 'number' ? t.renderVideoCount : undefined,
      renderSizeBytes: typeof t.renderSizeBytes === 'number' ? t.renderSizeBytes : undefined,
      prprojModifiedAt: typeof t.prprojModifiedAt === 'number' ? t.prprojModifiedAt : undefined,
      renderedAt: typeof t.renderedAt === 'number' ? t.renderedAt : undefined,
      updatedAt: new Date().toISOString()
    }))

    const payload = {
      tasks: cleanTasks,
      folders: Array.from(new Set(cleanTasks.map((t) => t.dateFolder))),
      safars: cleanSafars,
      updatedAt: new Date().toISOString(),
      source: 'onetap-desktop'
    }

    // Zero-Overload Single-Row UPSERT
    const { error } = await client
      .from('safar_tracker_snapshots')
      .upsert({
        id: 'primary',
        snapshot: payload,
        updated_at: payload.updatedAt
      })

    if (error) {
      console.warn('[StatsSyncDaemon] Cloud sync returned error:', error.message)
      return false
    }

    saveSyncStamp()
    console.log(`[StatsSyncDaemon] Cloud sync completed successfully (${cleanTasks.length} tasks, ${cleanSafars.length} safars).`)
    return true
  } catch (err: any) {
    console.warn('[StatsSyncDaemon] Cloud sync error:', err?.message || err)
    return false
  } finally {
    isSyncInProgress = false
  }
}

/**
 * Starts the background sync watchdog:
 * 1. Checks every 15 minutes for the scheduled nightly window (22:00 - 02:00).
 * 2. Runs startup catch-up if yesterday's sync was missed because laptop was off.
 */
export function initStatsSyncDaemon(): void {
  if (syncTimer) return

  // Run startup catch-up after 12s so it never interferes with initial UI launch
  setTimeout(() => {
    try {
      const now = new Date()
      const todayStr = now.toISOString().slice(0, 10)
      const last = getLastSyncInfo()

      if (last.lastDate !== todayStr) {
        console.log('[StatsSyncDaemon] Nightly sync was missed (laptop was off). Running catch-up sync…')
        void syncStatsToCloud('startup_catchup')
      }
    } catch {}
  }, 12000)

  // Every 15 minutes, check if it's the nightly sync window
  syncTimer = setInterval(() => {
    try {
      const now = new Date()
      const hour = now.getHours()
      const todayStr = now.toISOString().slice(0, 10)
      const last = getLastSyncInfo()

      // Night sync window: 22:00 (10 PM) to 02:00 (2 AM)
      const isNightTime = hour >= 22 || hour < 2
      if (isNightTime && last.lastDate !== todayStr) {
        console.log(`[StatsSyncDaemon] Triggering scheduled nightly sync at hour ${hour}:00…`)
        void syncStatsToCloud('nightly_schedule')
      }
    } catch (err) {
      console.warn('[StatsSyncDaemon] Interval tick error:', err)
    }
  }, 15 * 60 * 1000)
}

/**
 * Synchronous/quick flush called before app quits so all today's stats are
 * safely uploaded to the cloud before the client laptop powers down.
 */
export async function flushStatsOnQuit(): Promise<void> {
  console.log('[StatsSyncDaemon] Pre-shutdown flush triggered before app exit…')
  try {
    // Timeout guarantee: Never hold process exit for more than 2.5 seconds
    const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500))
    await Promise.race([syncStatsToCloud('app_exit_shutdown'), timeoutPromise])
  } catch {}
}
