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
    EDITED(
        id = "edited",
        title = "Edited",
        subtitle = "Exported & Graded",
        hexColor = "#8B5CF6",
        composeColor = Color(0xFF8B5CF6),
        order = 0
    ),
    GIVEN_TO_MURTAZA(
        id = "given_to_murtaza",
        title = "With Murtaza",
        subtitle = "Handed to Video Lead",
        hexColor = "#2563EB",
        composeColor = Color(0xFF2563EB),
        order = 1
    ),
    UPLOADED(
        id = "uploaded",
        title = "Uploaded",
        subtitle = "Cloud Synced",
        hexColor = "#059669",
        composeColor = Color(0xFF059669),
        order = 2
    );

    val isComplete: Boolean
        get() = this == UPLOADED

    val nextStage: PhotoStage?
        get() = entries.getOrNull(order + 1)

    val prevStage: PhotoStage?
        get() = if (order > 0) entries.getOrNull(order - 1) else null

    companion object {
        fun fromId(raw: String?, photoUploaded: Boolean = false): PhotoStage {
            if (photoUploaded) return UPLOADED
            val s = raw?.lowercase()?.trim() ?: ""
            return when (s) {
                "uploaded", "drive_uploaded" -> UPLOADED
                "given_to_murtaza", "color_graded" -> GIVEN_TO_MURTAZA
                "edited", "raw_sorted", "pending", "" -> EDITED
                else -> EDITED
            }
        }
    }
}
