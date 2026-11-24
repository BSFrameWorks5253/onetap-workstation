/**
 * ====================================================================
 * LIFETIME-FREE BATCH RENDER & EVENT NOTIFIER (One Tap Workstation)
 * ====================================================================
 * Dispatches structured batch rendering summaries and event breakdowns
 * to the mobile app and web app over Supabase Realtime (100% free tier).
 * ====================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dubscvthmkgkeiqdladp.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_kYApNvq2_6HAfNwJb8hW1g_7iLMSVyk'

let supabase: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  if (supabase) return supabase
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    })
    return supabase
  } catch (err) {
    console.warn('[BatchRenderNotifier] Supabase init failed:', err)
    return null
  }
}

export interface RenderEventDetail {
  dateFolder: string
  safarName: string
  durationMinutes: number
  editorName: string
  fileSizeMb?: number
  status: 'rendered' | 'uploaded' | 'in_progress'
}

export interface BatchRenderReport {
  batchId: string
  totalVideos: number
  totalDurationMinutes: number
  safarName: string
  events: RenderEventDetail[]
  renderedAt: string
}

/**
 * Broadcasts a batch render completion notification with an itemized event breakdown.
 * Mobile phones listening on the channel immediately receive this and show
 * a native Android push notification + rich summary card.
 */
export async function broadcastBatchRenderComplete(report: BatchRenderReport): Promise<boolean> {
  const client = getClient()
  if (!client) return false

  try {
    const channel = client.channel('anyshare_realtime_nexus')
    await channel.subscribe()

    // Event breakdown summary string (e.g. "Day 1 (48m), Day 2 (52m)")
    const breakdownText = report.events.map(e => `${e.dateFolder}: ${e.durationMinutes}m [${e.editorName}]`).join(' • ')

    await channel.send({
      type: 'broadcast',
      event: 'batch_render_summary',
      payload: {
        batchId: report.batchId,
        title: `🎬 Batch Complete: ${report.totalVideos} Videos Rendered!`,
        message: `${report.safarName} (${report.totalDurationMinutes} mins total):\n${breakdownText}`,
        totalVideos: report.totalVideos,
        totalDurationMinutes: report.totalDurationMinutes,
        safarName: report.safarName,
        events: report.events,
        timestamp: report.renderedAt
      }
    })

    console.log(`[BatchRenderNotifier] Broadcasted batch render report: ${report.totalVideos} videos for ${report.safarName}`)
    return true
  } catch (err: any) {
    console.warn('[BatchRenderNotifier] Broadcast failed:', err?.message || err)
    return false
  }
}
