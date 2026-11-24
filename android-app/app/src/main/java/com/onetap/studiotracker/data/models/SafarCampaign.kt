package com.onetap.studiotracker.data.models

import kotlinx.serialization.Serializable

@Serializable
data class SafarCampaign(
    val id: String,
    val name: String,
    val location: String,
    val isOngoing: Boolean = false,
    val isArchived: Boolean = false,
    val startDate: String,
    val endDate: String,
    val tasks: List<SafarTask> = emptyList()
) {
    val totalDates: Int
        get() = tasks.size

    val deliveredVideosCount: Int
        get() = tasks.count { it.isVideoDelivered }

    val deliveredPhotosCount: Int
        get() = tasks.count { it.isPhotosDelivered }

    val totalPhotosCount: Int
        get() = tasks.sumOf { it.totalPhotos }

    val uploadedPhotosCount: Int
        get() = tasks.sumOf { it.uploadedPhotos }

    val photoUploadPercentage: Int
        get() = if (totalPhotosCount > 0) {
            ((uploadedPhotosCount.toFloat() / totalPhotosCount) * 100).toInt().coerceIn(0, 100)
        } else if (tasks.isNotEmpty() && tasks.all { it.photoStage.isComplete }) {
            100
        } else {
            0
        }

    val videoDeliveryPercentage: Int
        get() = if (tasks.isNotEmpty()) {
            ((deliveredVideosCount.toFloat() / tasks.size) * 100).toInt().coerceIn(0, 100)
        } else {
            0
        }

    /**
     * Overall Safar completion percentage.
     * Reaches 100% when all scheduled dates are delivered and all photos uploaded.
     */
    val overallPercentage: Int
        get() {
            if (tasks.isEmpty()) return 0
            val fullyDone = tasks.count { it.isFullyCompleted }
            return ((fullyDone.toFloat() / tasks.size) * 100).toInt().coerceIn(0, 100)
        }

    val is100PercentDone: Boolean
        get() = tasks.isNotEmpty() && tasks.all { it.isFullyCompleted }

    // Counts per stage
    fun countForStage(stage: Stage): Int = tasks.count { it.stage == stage }
}
