package com.onetap.studiotracker.data.models

data class EditorWorkload(
    val name: String,
    val total: Int,
    val done: Int,
    val inProgress: Int,
    val pending: Int,
    val overdue: Int
) {
    val completionRate: Int get() = if (total > 0) ((done.toFloat() / total) * 100).toInt() else 0
}

data class StudioStats(
    val totalSafars: Int = 0,
    val activeSafars: Int = 0,
    val archivedSafars: Int = 0,
    val ongoingSafarName: String = "",
    val totalScheduledDays: Int = 0,
    val editingPendingCount: Int = 0,
    val inProgressCount: Int = 0,
    val uploadPendingCount: Int = 0,
    val uploadedCount: Int = 0,
    val alJameaDoneCount: Int = 0,
    val safars100PercentDone: Int = 0,
    val totalPhotosUploaded: Int = 0,
    val overdueTasksCount: Int = 0,
    val idleQaAlertsCount: Int = 0,
    val totalRenderVideos: Int = 0,
    val totalRenderDurationSeconds: Double = 0.0,
    val totalRenderSizeBytes: Long = 0L,
    val overallDeliveryPercentage: Int = 0,
    val photoDeliveryPercentage: Int = 0,
    val editorWorkloads: List<EditorWorkload> = emptyList()
) {
    companion object {
        fun calculate(campaigns: List<SafarCampaign>, activeOnly: Boolean = false): StudioStats {
            val active = campaigns.filter { !it.isArchived }
            val scopedCampaigns = if (activeOnly) active else campaigns
            val scopedTasks = scopedCampaigns.flatMap { it.tasks }
            val ongoing = active.firstOrNull { it.isOngoing }
                ?: active.firstOrNull { !it.is100PercentDone }
                ?: active.firstOrNull()
                ?: campaigns.firstOrNull()

            val delivered = scopedTasks.count { it.isVideoDelivered }
            val total = scopedTasks.size
            val deliveryPct = if (total > 0) ((delivered.toFloat() / total) * 100).toInt() else 0
            val photosUploaded = scopedTasks.count { it.isPhotosDelivered }
            val photoPct = if (total > 0) ((photosUploaded.toFloat() / total) * 100).toInt() else 0

            val editorMap = linkedMapOf<String, MutableList<SafarTask>>()
            scopedTasks.forEach { t -> editorMap.getOrPut(t.effectiveVideoEditor) { mutableListOf() }.add(t) }
            val workloads = editorMap.map { (name, list) ->
                EditorWorkload(
                    name = name,
                    total = list.size,
                    done = list.count { it.isVideoDelivered },
                    inProgress = list.count { it.stage == Stage.IN_PROGRESS || it.stage == Stage.UPLOAD_PENDING },
                    pending = list.count { it.stage == Stage.EDITING_PENDING },
                    overdue = list.count { it.isOverdue }
                )
            }.sortedByDescending { it.total }

            return StudioStats(
                totalSafars = campaigns.size,
                activeSafars = active.size,
                archivedSafars = campaigns.count { it.isArchived },
                ongoingSafarName = ongoing?.name ?: "No Active Safar",
                totalScheduledDays = total,
                editingPendingCount = scopedTasks.count { it.stage == Stage.EDITING_PENDING },
                inProgressCount = scopedTasks.count { it.stage == Stage.IN_PROGRESS },
                uploadPendingCount = scopedTasks.count { it.stage == Stage.UPLOAD_PENDING },
                uploadedCount = scopedTasks.count { it.stage == Stage.UPLOADED },
                alJameaDoneCount = scopedTasks.count { it.stage == Stage.ALJAMEA_DONE },
                safars100PercentDone = scopedCampaigns.count { it.is100PercentDone },
                totalPhotosUploaded = photosUploaded,
                overdueTasksCount = scopedTasks.count { it.isOverdue },
                idleQaAlertsCount = scopedTasks.count { it.isIdleQaAlert },
                totalRenderVideos = scopedTasks.sumOf { it.renderVideoCount ?: 0 },
                totalRenderDurationSeconds = scopedTasks.sumOf { it.renderDurationSeconds ?: 0.0 },
                totalRenderSizeBytes = scopedTasks.sumOf { it.renderSizeBytes ?: 0L },
                overallDeliveryPercentage = deliveryPct,
                photoDeliveryPercentage = photoPct,
                editorWorkloads = workloads
            )
        }
    }
}
