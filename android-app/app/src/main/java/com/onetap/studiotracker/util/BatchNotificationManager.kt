package com.onetap.studiotracker.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.onetap.studiotracker.MainActivity

data class BatchRenderEventItem(
    val dateFolder: String,
    val safarName: String,
    val durationMinutes: Int,
    val editorName: String,
    val status: String
)

data class BatchRenderSummaryNotification(
    val batchId: String,
    val title: String,
    val safarName: String,
    val totalVideos: Int,
    val totalDurationMinutes: Int,
    val events: List<BatchRenderEventItem>,
    val timestamp: Long = System.currentTimeMillis()
)

object BatchNotificationManager {

    private const val CHANNEL_ID = "one_tap_batch_renders"
    private const val CHANNEL_NAME = "One Tap Render Batches"
    private const val NOTIFICATION_ID = 2611

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Lifetime-free real-time alerts when video rendering batches complete"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 150, 250)
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    fun showBatchRenderNotification(
        context: Context,
        batchSummary: BatchRenderSummaryNotification
    ) {
        createNotificationChannel(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Build itemized breakdown text
        val breakdownLines = batchSummary.events.joinToString("\n") { e ->
            "• ${e.dateFolder} (${e.durationMinutes}m) [${e.editorName}]"
        }

        val bigText = "${batchSummary.safarName} • ${batchSummary.totalVideos} videos (${batchSummary.totalDurationMinutes} mins total)\n\n$breakdownLines"

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle("🎬 ${batchSummary.title}")
            .setContentText("${batchSummary.totalVideos} Videos Rendered for ${batchSummary.safarName}")
            .setStyle(NotificationCompat.BigTextStyle().bigText(bigText))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, builder.build())
    }
}
