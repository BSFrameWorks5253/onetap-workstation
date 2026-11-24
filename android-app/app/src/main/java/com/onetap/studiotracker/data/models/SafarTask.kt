package com.onetap.studiotracker.data.models

import kotlinx.serialization.Serializable

@Serializable
data class SafarTask(
    val id: String,
    val campaignId: String,
    val title: String,
    val hijriDate: String,
    val gregorianDate: String,
    val stage: Stage = Stage.EDITING_PENDING,
    val videoEditor: String? = null,
    val durationMinutes: Int = 0,
    val driveFolderUrl: String? = null,
    val totalPhotos: Int = 0,
    val uploadedPhotos: Int = 0,
    val photoStage: PhotoStage = PhotoStage.PENDING,
    val notes: String? = null,
    val updatedAt: Long = System.currentTimeMillis()
) {
    val isVideoDelivered: Boolean
        get() = stage.isDelivered

    val isPhotosDelivered: Boolean
        get() = photoStage.isComplete || (totalPhotos > 0 && uploadedPhotos >= totalPhotos)

    val isFullyCompleted: Boolean
        get() = isVideoDelivered && (totalPhotos == 0 || isPhotosDelivered)

    val photoProgressPercent: Int
        get() = if (totalPhotos > 0) ((uploadedPhotos.toFloat() / totalPhotos) * 100).toInt().coerceIn(0, 100) else 0
}
