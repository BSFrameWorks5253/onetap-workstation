// Vercel Serverless Function: /api/widget-data
// Returns live ongoing Safar metrics for Mobile Home Screen Widgets,
// iOS Scriptable / Widgy, and Android KWGT.
// Free tier compatible — zero custom domain required.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dubscvthmkgkeiqdladp.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_kYApNvq2_6HAfNwJb8hW1g_7iLMSVyk'

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const requestedSafar = url.searchParams.get('safar') || null

    // Fetch snapshot directly from Supabase REST endpoint
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/safar_tracker_snapshots?id=eq.primary&select=snapshot,updated_at`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Supabase query failed with HTTP ${response.status}`)
    }

    const rows = await response.json()
    const record = rows?.[0]
    const snapshot = record?.snapshot || {}
    const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : []
    const safars = Array.isArray(snapshot.safars) ? snapshot.safars : []

    // Helper to filter out junk names
    const isJunk = name => {
      const lower = String(name || '').toLowerCase()
      return !name || lower === 'uncategorized' || lower === 'general' || lower === 'null' || lower === 'undefined'
    }

    // Determine target Safar
    let targetSafar = requestedSafar

    if (!targetSafar) {
      // Find ongoing non-archived safar with active tasks
      const activeSafars = safars.filter(s => !s.isArchived && !s.isDone && !isJunk(s.safarName))
      if (activeSafars.length > 0) {
        targetSafar = activeSafars[0].safarName
      } else {
        // Fallback: pick safar with the most tasks
        const safarCounts = new Map()
        for (const t of tasks) {
          if (!isJunk(t.safarName)) {
            safarCounts.set(t.safarName, (safarCounts.get(t.safarName) || 0) + 1)
          }
        }
        let maxCount = -1
        for (const [name, count] of safarCounts.entries()) {
          if (count > maxCount) {
            maxCount = count
            targetSafar = name
          }
        }
      }
    }

    if (!targetSafar) {
      return res.status(200).json({
        success: true,
        safarName: 'No Active Safar',
        deliveredPercent: 0,
        totalDates: 0,
        deliveredDates: 0,
        remainingDates: 0,
        video: { uploaded: 0, rendered: 0, editing: 0, total: 0 },
        photos: { uploaded: 0, givenToMurtaza: 0, editing: 0, total: 0 },
        briefingText: 'No active Safar production data currently found.',
        updatedAt: record?.updated_at || new Date().toISOString()
      })
    }

    // Filter tasks for this safar
    const safarTasks = tasks.filter(t => t.safarName === targetSafar)
    const totalDates = safarTasks.length

    let videoEditing = 0
    let videoRendered = 0
    let videoUploaded = 0
    let videoCompleted = 0

    let photoEditing = 0
    let photoMurtaza = 0
    let photoUploaded = 0

    for (const t of safarTasks) {
      const st = t.stage || 'editing'
      if (st === 'editing') videoEditing++
      else if (st === 'rendering') videoRendered++
      else if (st === 'upload') videoUploaded++
      else if (st === 'jameya' || st === 'completed') {
        videoCompleted++
        videoUploaded++
      }

      const pst = t.photoStage || 'edited'
      if (t.photoUploaded || pst === 'uploaded') {
        photoUploaded++
      } else if (pst === 'given_to_murtaza') {
        photoMurtaza++
      } else {
        photoEditing++
      }
    }

    const deliveredDates = videoCompleted
    const deliveredPercent = totalDates > 0 ? Math.round((deliveredDates / totalDates) * 100) : 0
    const remainingDates = Math.max(0, totalDates - deliveredDates)

    // Formatted WhatsApp Daily Briefing string
    const briefingText = [
      `📢 *Safar Media Production Update*`,
      `📍 *${targetSafar}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📊 *Overall Progress:* ${deliveredPercent}% Delivered (${deliveredDates}/${totalDates} dates)`,
      ``,
      `🎬 *Video Pipeline:*`,
      `  • Uploaded: ${videoUploaded}`,
      `  • Rendered: ${videoRendered}`,
      `  • In Editing: ${videoEditing}`,
      ``,
      `📷 *Photo Production:*`,
      `  • Uploaded: ${photoUploaded}`,
      `  • Given to Murtaza: ${photoMurtaza}`,
      `  • In Editing: ${photoEditing}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `⚡ _Generated via One Tap Workstation_`,
      `🔗 https://onetap-workstation.vercel.app`
    ].join('\n')

    return res.status(200).json({
      success: true,
      safarName: targetSafar,
      deliveredPercent,
      totalDates,
      deliveredDates,
      remainingDates,
      video: {
        uploaded: videoUploaded,
        rendered: videoRendered,
        editing: videoEditing,
        completed: videoCompleted,
        total: totalDates
      },
      photos: {
        uploaded: photoUploaded,
        givenToMurtaza: photoMurtaza,
        editing: photoEditing,
        total: totalDates
      },
      briefingText,
      updatedAt: record?.updated_at || new Date().toISOString(),
      webUrl: 'https://onetap-workstation.vercel.app/widget'
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate widget data'
    })
  }
}
