package com.onetap.studiotracker.data.models

import androidx.compose.ui.graphics.Color

enum class PhotoStage(
    val id: String,
    val title: String,
    val subtitle: String,
    val hexColor: String,
    val composeColor: Color,
    val order: Int
) {
    EDITED("edited", "Edited", "Exported & Graded", "#8B5CF6", Color(0xFF8B5CF6), 0),
    GIVEN_TO_MURTAZA("given_to_murtaza", "With Murtaza", "Handed to Video Lead", "#2563EB", Color(0xFF2563EB), 1),
    UPLOADED("uploaded", "Uploaded", "Cloud Synced", "#059669", Color(0xFF059669), 2);

    val isComplete: Boolean get() = this == UPLOADED
    val nextStage: PhotoStage? get() = entries.getOrNull(order + 1)
    val prevStage: PhotoStage? get() = if (order > 0) entries.getOrNull(order - 1) else null

    companion object {
        fun fromId(raw: String?, photoUploaded: Boolean = false): PhotoStage {
            if (photoUploaded) return UPLOADED
            return when (raw?.lowercase()?.trim()) {
                "uploaded", "drive_uploaded" -> UPLOADED
                "given_to_murtaza", "color_graded" -> GIVEN_TO_MURTAZA
                else -> EDITED
            }
        }
    }
}
