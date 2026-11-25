package com.onetap.studiotracker.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.sync.SupabaseSyncClient
import com.onetap.studiotracker.util.BatchNotificationManager
import java.time.LocalDate
import java.util.concurrent.TimeUnit

class SafarBackgroundWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("one_tap_bg_worker", Context.MODE_PRIVATE)
        val syncClient = SupabaseSyncClient()
        val res = syncClient.fetchLatestSnapshot()
        if (res.isFailure) return Result.retry()

        val payload = res.getOrNull() ?: return Result.success()
        val deletedSafars = payload.deletedSafars.map { it.lowercase() }.toSet()
        val archivedSafars = payload.safars.filter { it.isArchived }.map { it.safarName.lowercase() }.toSet()
        val today = try { LocalDate.now().toString() } catch (_: Throwable) { "" }

        var overdueCount = 0
        var idleQaCount = 0
        val now = System.currentTimeMillis()
        val idleThresholdMs = 48L * 60L * 60L * 1000L

        payload.tasks.forEach { task ->
            val sLower = task.safarName.lowercase()
            if (sLower in deletedSafars || sLower in archivedSafars) return@forEach

            val stage = Stage.fromId(task.stage ?: task.status)
            if (!stage.isDelivered && !task.dueDate.isNullOrBlank() && today.isNotEmpty() && task.dueDate < today) {
                overdueCount++
            }
            if (stage == Stage.IN_PROGRESS && task.prprojModifiedAt != null && (now - task.prprojModifiedAt) >= idleThresholdMs) {
                idleQaCount++
            }
        }

        val lastAlertAt = prefs.getLong("last_alert_at", 0L)
        val cooldownMs = 6L * 60L * 60L * 1000L // 6 hours
        if ((overdueCount > 0 || idleQaCount > 0) && (now - lastAlertAt) >= cooldownMs) {
            val parts = mutableListOf<String>()
            if (overdueCount > 0) parts.add("$overdueCount overdue date(s)")
            if (idleQaCount > 0) parts.add("$idleQaCount project(s) idle 48h+ for QA")
            BatchNotificationManager.showSimpleNotification(
                context = applicationContext,
                title = "One Tap Production Alert",
                message = parts.joinToString(" • ")
            )
            prefs.edit().putLong("last_alert_at", now).apply()
        }

        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "one_tap_safar_bg_monitor"

        fun schedule(context: Context) {
            try {
                val constraints = Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
                val request = PeriodicWorkRequestBuilder<SafarBackgroundWorker>(30, TimeUnit.MINUTES)
                    .setConstraints(constraints)
                    .build()
                WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    request
                )
            } catch (_: Throwable) {}
        }
    }
}
