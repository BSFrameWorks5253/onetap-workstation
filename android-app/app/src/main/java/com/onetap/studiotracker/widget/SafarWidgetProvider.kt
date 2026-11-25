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
        val ongoing = repo.activeCampaign
        SafarWidgetUpdater.updateWidgetsForIds(context, appWidgetManager, appWidgetIds, ongoing)

        // Also trigger a fresh cloud fetch when widget updates
        CoroutineScope(Dispatchers.IO).launch {
            repo.triggerCloudSync(silent = true)
        }
    }
}

object SafarWidgetUpdater {

    fun updateAllWidgets(context: Context, ongoing: SafarCampaign?, allCampaigns: List<SafarCampaign>) {
        try {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, SafarWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(component)
            if (ids.isNotEmpty()) {
                val target = ongoing ?: allCampaigns.firstOrNull { !it.isArchived } ?: allCampaigns.firstOrNull()
                updateWidgetsForIds(context, manager, ids, target)
            }
        } catch (_: Throwable) {}
    }

    fun updateWidgetsForIds(
        context: Context,
        manager: AppWidgetManager,
        ids: IntArray,
        campaign: SafarCampaign?
    ) {
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val safarTitle = campaign?.name ?: "One Tap Studio"
        val percent = campaign?.overallPercentage ?: 0
        val videosText = if (campaign != null) {
            "Videos: ${campaign.deliveredVideosCount}/${campaign.totalDates}"
        } else {
            "Waiting for sync…"
        }
        val photosText = if (campaign != null) {
            "Photos: ${campaign.deliveredPhotosCount}/${campaign.totalDates}"
        } else {
            "Real-time tracker"
        }

        ids.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.widget_safar_status).apply {
                setTextViewText(R.id.widget_safar_name, safarTitle)
                setTextViewText(R.id.widget_percent, "$percent%")
                setTextViewText(R.id.widget_videos, videosText)
                setTextViewText(R.id.widget_photos, photosText)
                setProgressBar(R.id.widget_progress, 100, percent, false)
                setOnClickPendingIntent(R.id.widget_root, pendingIntent)
            }
            manager.updateAppWidget(widgetId, views)
        }
    }
}
