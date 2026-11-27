package com.onetap.studiotracker.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import androidx.core.app.NotificationCompat
import com.onetap.studiotracker.MainActivity
import com.onetap.studiotracker.R

object BatchNotificationManager {
    private const val CHANNEL_ID = "one_tap_batch_renders"
    private const val CHANNEL_NAME = "One Tap Studio Alerts"

    fun createNotificationChannel(context: Context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Real-time Safar updates, overdue alerts, and render notifications"
                }
                (context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)?.createNotificationChannel(channel)
            }
        } catch (_: Throwable) {}
    }

    fun showSimpleNotification(context: Context, title: String, message: String) {
        try {
            createNotificationChannel(context)
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pi = PendingIntent.getActivity(context, title.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val largeIcon = try {
                BitmapFactory.decodeResource(context.resources, R.drawable.ic_launcher_logo)
            } catch (_: Throwable) { null }
            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFF4F46E5.toInt())
                .apply { if (largeIcon != null) setLargeIcon(largeIcon) }
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pi)
                .setAutoCancel(true)
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)?.notify((System.currentTimeMillis() % 100000).toInt(), builder.build())
        } catch (_: Throwable) {}
    }
}
