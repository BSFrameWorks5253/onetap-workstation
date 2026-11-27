package com.onetap.studiotracker.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import android.widget.Toast
import com.onetap.studiotracker.MainActivity
import com.onetap.studiotracker.R
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.repository.SafarRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

const val ACTION_DISPATCH_BRIEFING = "com.onetap.studiotracker.ACTION_DISPATCH_BRIEFING"

class SafarWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val repo = SafarRepository.getInstance()
        SafarWidgetUpdater.updateWidgetsForIds(context, appWidgetManager, appWidgetIds, repo.activeCampaign)
        CoroutineScope(Dispatchers.IO).launch { repo.triggerCloudSync(silent = true) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_DISPATCH_BRIEFING) {
            val repo = SafarRepository.getInstance()
            val campaign = repo.activeCampaign
                ?: repo.campaigns.value.firstOrNull { it.isOngoing }
                ?: repo.campaigns.value.firstOrNull { !it.isArchived }
                ?: repo.campaigns.value.firstOrNull()

            if (campaign != null) {
                val briefingText = repo.generateWhatsAppBriefingText(campaign)
                val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("Safar Briefing", briefingText))

                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    Toast.makeText(context, "✓ WhatsApp briefing copied to clipboard!", Toast.LENGTH_SHORT).show()
                }

                try {
                    val waIntent = Intent(Intent.ACTION_VIEW).apply {
                        data = Uri.parse("https://api.whatsapp.com/send?text=${Uri.encode(briefingText)}")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(waIntent)
                } catch (_: Throwable) {
                    // Copied to clipboard already
                }
            } else {
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    Toast.makeText(context, "No active Safar campaign found", Toast.LENGTH_SHORT).show()
                }
            }
            return
        }
        super.onReceive(context, intent)
    }
}

object SafarWidgetUpdater {
    fun updateAllWidgets(context: Context, ongoing: SafarCampaign?, allCampaigns: List<SafarCampaign>) {
        try {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, SafarWidgetProvider::class.java))
            if (ids.isNotEmpty()) {
                val target = ongoing ?: allCampaigns.firstOrNull { !it.isArchived } ?: allCampaigns.firstOrNull()
                updateWidgetsForIds(context, manager, ids, target)
            }
        } catch (_: Throwable) {}
    }

    fun updateWidgetsForIds(context: Context, manager: AppWidgetManager, ids: IntArray, campaign: SafarCampaign?) {
        val launchPi = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val briefingIntent = Intent(context, SafarWidgetProvider::class.java).apply {
            action = ACTION_DISPATCH_BRIEFING
        }
        val briefingPi = PendingIntent.getBroadcast(
            context, 101, briefingIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val title = campaign?.name ?: "One Tap Studio"
        val pct = campaign?.overallPercentage ?: 0

        val nextPendingTask = campaign?.tasks?.firstOrNull { !it.stage.isDelivered }
        val nextPendingText = if (nextPendingTask != null) {
            "${nextPendingTask.title} • ${nextPendingTask.stage.title}"
        } else if (campaign != null && campaign.is100PercentDone) {
            "All Dates 100% Completed! 🏆"
        } else if (campaign != null) {
            "All ${campaign.totalDates} dates delivered"
        } else {
            "Waiting for cloud sync…"
        }

        val statsText = if (campaign != null) {
            "🎬 ${campaign.deliveredVideosCount}/${campaign.totalDates} Videos · 📷 ${campaign.deliveredPhotosCount}/${campaign.totalDates} Photos"
        } else {
            "Real-time Production Pipeline"
        }

        ids.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.widget_safar_status).apply {
                setTextViewText(R.id.widget_safar_name, title)
                setTextViewText(R.id.widget_percent, "$pct%")
                setTextViewText(R.id.widget_next_deliverable, nextPendingText)
                setTextViewText(R.id.widget_stats, statsText)
                setProgressBar(R.id.widget_progress, 100, pct, false)
                setOnClickPendingIntent(R.id.widget_root, launchPi)
                setOnClickPendingIntent(R.id.widget_whatsapp_btn, briefingPi)
            }
            manager.updateAppWidget(id, views)
        }
    }
}
