package com.onetap.studiotracker.data.models

import kotlinx.serialization.Serializable

@Serializable
data class SafarTask(
    val id: String,
    val campaignId: String,
    val title: String,
    val hijriDate: String = "",
    val dueDate: String = "",
    val stage: Stage = Stage.EDITING_PENDING,
    val videoEditor: String? = null,
    val photoEditorName: String? = null,
    val driveFolderUrl: String? = null,
    val photoStage: PhotoStage = PhotoStage.EDITED,
    val photoUploaded: Boolean = false,
    val isPresent: Boolean = true,
    val isMissing: Boolean = false,
    val notes: String? = null,
    val renderDurationSeconds: Double? = null,
    val renderVideoCount: Int? = null,
    val renderSizeBytes: Long? = null,
    val prprojModifiedAt: Long? = null,
    val renderedAt: Long? = null,
    val updatedAt: Long = System.currentTimeMillis(),
    val updatedAtIso: String = ""
) {
    val isVideoDelivered: Boolean get() = stage.isDelivered
    val isPhotosDelivered: Boolean get() = photoUploaded || photoStage.isComplete
    val effectiveVideoEditor: String get() = videoEditor?.trim()?.takeIf { it.isNotEmpty() } ?: "Murtaza"
    val effectivePhotoEditor: String get() = photoEditorName?.trim()?.takeIf { it.isNotEmpty() } ?: "Muffadal Peti"

    val isOverdue: Boolean
        get() {
            if (dueDate.isBlank() || isVideoDelivered) return false
            return try {
                dueDate < java.time.LocalDate.now().toString()
            } catch (_: Throwable) {
                false
            }
        }

    val isIdleQaAlert: Boolean
        get() {
            if (stage != Stage.IN_PROGRESS) return false
            val mod = prprojModifiedAt ?: return false
            return (System.currentTimeMillis() - mod) >= 48L * 60L * 60L * 1000L
        }
}
