package com.onetap.studiotracker.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.onetap.studiotracker.MainActivity
import com.onetap.studiotracker.R
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.repository.SafarRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SafarWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val repo = SafarRepository.getInstance()
        SafarWidgetUpdater.updateWidgetsForIds(context, appWidgetManager, appWidgetIds, repo.activeCampaign)
        CoroutineScope(Dispatchers.IO).launch { repo.triggerCloudSync(silent = true) }
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
        val pi = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val title = campaign?.name ?: "One Tap Studio"
        val pct = campaign?.overallPercentage ?: 0
        val videos = if (campaign != null) "Videos: ${campaign.deliveredVideosCount}/${campaign.totalDates}" else "Waiting for sync…"
        val photos = if (campaign != null) "Photos: ${campaign.deliveredPhotosCount}/${campaign.totalDates}" else "Real-time tracker"

        ids.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.widget_safar_status).apply {
                setTextViewText(R.id.widget_safar_name, title)
                setTextViewText(R.id.widget_percent, "$pct%")
                setTextViewText(R.id.widget_videos, videos)
                setTextViewText(R.id.widget_photos, photos)
                setProgressBar(R.id.widget_progress, 100, pct, false)
                setOnClickPendingIntent(R.id.widget_root, pi)
            }
            manager.updateAppWidget(id, views)
        }
    }
}
