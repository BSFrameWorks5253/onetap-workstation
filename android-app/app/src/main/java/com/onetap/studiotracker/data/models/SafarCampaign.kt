package com.onetap.studiotracker.data.models

import kotlinx.serialization.Serializable

@Serializable
data class SafarCampaign(
    val id: String,
    val name: String,
    val safarYear: String = "",
    val location: String = "",
    val isOngoing: Boolean = false,
    val isArchived: Boolean = false,
    val isDone: Boolean = false,
    val updatedAtIso: String = "",
    val archivePriorStages: Map<String, String> = emptyMap(),
    val tasks: List<SafarTask> = emptyList()
) {
    val totalDates: Int
        get() = tasks.size

    val deliveredVideosCount: Int
        get() = tasks.count { it.isVideoDelivered }

    val deliveredPhotosCount: Int
        get() = tasks.count { it.isPhotosDelivered }

    val photoUploadPercentage: Int
        get() = if (tasks.isNotEmpty()) {
            ((deliveredPhotosCount.toFloat() / tasks.size) * 100).toInt().coerceIn(0, 100)
        } else {
            0
        }

    val videoDeliveryPercentage: Int
        get() = if (tasks.isNotEmpty()) {
            ((deliveredVideosCount.toFloat() / tasks.size) * 100).toInt().coerceIn(0, 100)
        } else {
            0
        }

    val overallPercentage: Int
        get() = videoDeliveryPercentage

    val is100PercentDone: Boolean
        get() = isDone || (tasks.isNotEmpty() && tasks.all { it.isVideoDelivered })

    fun countForStage(stage: Stage): Int = tasks.count { it.stage == stage }

    fun countForPhotoStage(photoStage: PhotoStage): Int = tasks.count {
        if (it.photoUploaded) photoStage == PhotoStage.UPLOADED else it.photoStage == photoStage
    }
}
