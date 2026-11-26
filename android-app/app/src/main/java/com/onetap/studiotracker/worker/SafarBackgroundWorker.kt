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

class SafarBackgroundWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("one_tap_bg_worker", Context.MODE_PRIVATE)
        val res = SupabaseSyncClient().fetchLatestSnapshot()
        if (res.isFailure) return Result.retry()
        val payload = res.getOrNull() ?: return Result.success()

        val deleted = payload.deletedSafars.map { it.lowercase() }.toSet()
        val archived = payload.safars.filter { it.isArchived }.map { it.safarName.lowercase() }.toSet()
        val today = try { LocalDate.now().toString() } catch (_: Throwable) { "" }
        val now = System.currentTimeMillis()
        var overdue = 0
        var idleQa = 0

        payload.tasks.forEach { t ->
            val s = t.safarName.lowercase()
            if (s in deleted || s in archived) return@forEach
            val stage = Stage.fromId(t.stage ?: t.status)
            if (!stage.isDelivered && !t.dueDate.isNullOrBlank() && today.isNotEmpty() && t.dueDate < today) overdue++
            if (stage == Stage.IN_PROGRESS && t.prprojModifiedAt != null && (now - t.prprojModifiedAt) >= 48L * 3600_000L) idleQa++
        }

        val lastAlert = prefs.getLong("last_alert_at", 0L)
        if ((overdue > 0 || idleQa > 0) && (now - lastAlert) >= 6L * 3600_000L) {
            val msg = listOfNotNull(
                if (overdue > 0) "$overdue overdue date(s)" else null,
                if (idleQa > 0) "$idleQa project(s) idle 48h+ for QA" else null
            ).joinToString(" • ")
            BatchNotificationManager.showSimpleNotification(applicationContext, "One Tap Production Alert", msg)
            prefs.edit().putLong("last_alert_at", now).apply()
        }
        return Result.success()
    }

    companion object {
        fun schedule(context: Context) {
            try {
                val req = PeriodicWorkRequestBuilder<SafarBackgroundWorker>(30, TimeUnit.MINUTES)
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .build()
                WorkManager.getInstance(context).enqueueUniquePeriodicWork("one_tap_bg_monitor", ExistingPeriodicWorkPolicy.KEEP, req)
            } catch (_: Throwable) {}
        }
    }
}
