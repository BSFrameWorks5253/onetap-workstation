package com.onetap.studiotracker.data.models

data class EditorWorkload(
    val name: String,
    val total: Int,
    val done: Int,
    val inProgress: Int,
    val pending: Int,
    val overdue: Int
) {
    val completionRate: Int
        get() = if (total > 0) ((done.toFloat() / total) * 100).toInt() else 0
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
    val totalPhotosWithMurtaza: Int = 0,
    val totalPhotosEdited: Int = 0,
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
        fun calculate(campaigns: List<SafarCampaign>): StudioStats {
            val activeCampaigns = campaigns.filter { !it.isArchived }
            val allTasks = campaigns.flatMap { it.tasks }
            val ongoing = activeCampaigns.firstOrNull { it.isOngoing }
                ?: activeCampaigns.firstOrNull { !it.is100PercentDone }
                ?: activeCampaigns.firstOrNull()
                ?: campaigns.firstOrNull()

            val delivered = allTasks.count { it.isVideoDelivered }
            val total = allTasks.size
            val deliveryPercent = if (total > 0) ((delivered.toFloat() / total) * 100).toInt() else 0
            val photosUploaded = allTasks.count { it.isPhotosDelivered }
            val photoPercent = if (total > 0) ((photosUploaded.toFloat() / total) * 100).toInt() else 0

            val editorMap = linkedMapOf<String, MutableList<SafarTask>>()
            allTasks.forEach { task ->
                val editor = task.effectiveVideoEditor
                editorMap.getOrPut(editor) { mutableListOf() }.add(task)
            }

            val workloads = editorMap.map { (name, tasks) ->
                EditorWorkload(
                    name = name,
                    total = tasks.size,
                    done = tasks.count { it.isVideoDelivered },
                    inProgress = tasks.count { it.stage == Stage.IN_PROGRESS || it.stage == Stage.UPLOAD_PENDING },
                    pending = tasks.count { it.stage == Stage.EDITING_PENDING },
                    overdue = tasks.count { it.isOverdue }
                )
            }.sortedByDescending { it.total }

            return StudioStats(
                totalSafars = campaigns.size,
                activeSafars = activeCampaigns.size,
                archivedSafars = campaigns.count { it.isArchived },
                ongoingSafarName = ongoing?.name ?: "No Active Safar",
                totalScheduledDays = total,
                editingPendingCount = allTasks.count { it.stage == Stage.EDITING_PENDING },
                inProgressCount = allTasks.count { it.stage == Stage.IN_PROGRESS },
                uploadPendingCount = allTasks.count { it.stage == Stage.UPLOAD_PENDING },
                uploadedCount = allTasks.count { it.stage == Stage.UPLOADED },
                alJameaDoneCount = allTasks.count { it.stage == Stage.ALJAMEA_DONE },
                safars100PercentDone = campaigns.count { it.is100PercentDone },
                totalPhotosUploaded = photosUploaded,
                totalPhotosWithMurtaza = allTasks.count { !it.photoUploaded && it.photoStage == PhotoStage.GIVEN_TO_MURTAZA },
                totalPhotosEdited = allTasks.count { !it.photoUploaded && it.photoStage == PhotoStage.EDITED },
                overdueTasksCount = allTasks.count { it.isOverdue },
                idleQaAlertsCount = allTasks.count { it.isIdleQaAlert },
                totalRenderVideos = allTasks.sumOf { it.renderVideoCount ?: 0 },
                totalRenderDurationSeconds = allTasks.sumOf { it.renderDurationSeconds ?: 0.0 },
                totalRenderSizeBytes = allTasks.sumOf { it.renderSizeBytes ?: 0L },
                overallDeliveryPercentage = deliveryPercent,
                photoDeliveryPercentage = photoPercent,
                editorWorkloads = workloads
            )
        }
    }
}
