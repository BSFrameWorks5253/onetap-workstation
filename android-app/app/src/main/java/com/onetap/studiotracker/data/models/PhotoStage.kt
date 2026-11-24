package com.onetap.studiotracker.data.models

import androidx.compose.ui.graphics.Color

enum class PhotoStage(
    val id: String,
    val title: String,
    val hexColor: String,
    val composeColor: Color
) {
    PENDING(
        id = "pending",
        title = "Pending",
        hexColor = "#64748B",
        composeColor = Color(0xFF64748B)
    ),
    RAW_SORTED(
        id = "raw_sorted",
        title = "Raw Sorted",
        hexColor = "#F59E0B",
        composeColor = Color(0xFFF59E0B)
    ),
    COLOR_GRADED(
        id = "color_graded",
        title = "Color Graded",
        hexColor = "#3B82F6",
        composeColor = Color(0xFF3B82F6)
    ),
    DRIVE_UPLOADED(
        id = "drive_uploaded",
        title = "Drive Uploaded",
        hexColor = "#10B981",
        composeColor = Color(0xFF10B981)
    );

    val isComplete: Boolean
        get() = this == DRIVE_UPLOADED

    companion object {
        fun fromId(id: String?): PhotoStage {
            return entries.firstOrNull { it.id.equals(id, ignoreCase = true) } ?: PENDING
        }
    }
}
