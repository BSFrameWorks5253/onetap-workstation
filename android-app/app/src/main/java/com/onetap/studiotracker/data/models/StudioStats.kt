package com.onetap.studiotracker.data.models

data class StudioStats(
    val totalSafars: Int = 0,
    val ongoingSafarName: String = "",
    val totalScheduledDays: Int = 0,
    val editingPendingCount: Int = 0,
    val inProgressCount: Int = 0,
    val uploadPendingCount: Int = 0,
    val uploadedCount: Int = 0,
    val alJameaDoneCount: Int = 0,
    val safars100PercentDone: Int = 0,
    val totalPhotosUploaded: Int = 0,
    val overallDeliveryPercentage: Int = 0
) {
    companion object {
        fun calculate(campaigns: List<SafarCampaign>): StudioStats {
            val allTasks = campaigns.flatMap { it.tasks }
            val ongoing = campaigns.firstOrNull { it.isOngoing } ?: campaigns.firstOrNull()

            val delivered = allTasks.count { it.isVideoDelivered }
            val total = allTasks.size
            val deliveryPercent = if (total > 0) ((delivered.toFloat() / total) * 100).toInt() else 0

            return StudioStats(
                totalSafars = campaigns.size,
                ongoingSafarName = ongoing?.name ?: "No Active Safar",
                totalScheduledDays = total,
                editingPendingCount = allTasks.count { it.stage == Stage.EDITING_PENDING },
                inProgressCount = allTasks.count { it.stage == Stage.IN_PROGRESS },
                uploadPendingCount = allTasks.count { it.stage == Stage.UPLOAD_PENDING },
                uploadedCount = allTasks.count { it.stage == Stage.UPLOADED },
                alJameaDoneCount = allTasks.count { it.stage == Stage.ALJAMEA_DONE },
                safars100PercentDone = campaigns.count { it.is100PercentDone },
                totalPhotosUploaded = allTasks.sumOf { it.uploadedPhotos },
                overallDeliveryPercentage = deliveryPercent
            )
        }
    }
}
