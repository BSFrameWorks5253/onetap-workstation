package com.onetap.studiotracker.data.models

import androidx.compose.ui.graphics.Color

enum class Stage(
    val id: String,
    val title: String,
    val hexColor: String,
    val composeColor: Color,
    val order: Int
) {
    EDITING_PENDING(
        id = "editing_pending",
        title = "Editing Pending",
        hexColor = "#F59E0B",
        composeColor = Color(0xFFF59E0B),
        order = 0
    ),
    IN_PROGRESS(
        id = "in_progress",
        title = "In Progress",
        hexColor = "#3B82F6",
        composeColor = Color(0xFF3B82F6),
        order = 1
    ),
    UPLOAD_PENDING(
        id = "upload_pending",
        title = "Upload Pending",
        hexColor = "#06B6D4",
        composeColor = Color(0xFF06B6D4),
        order = 2
    ),
    UPLOADED(
        id = "uploaded",
        title = "Uploaded",
        hexColor = "#10B981",
        composeColor = Color(0xFF10B981),
        order = 3
    ),
    ALJAMEA_DONE(
        id = "aljamea_done",
        title = "AlJamea Done",
        hexColor = "#059669",
        composeColor = Color(0xFF059669),
        order = 4
    );

    val isDelivered: Boolean
        get() = this == UPLOADED || this == ALJAMEA_DONE

    companion object {
        fun fromId(id: String?): Stage {
            return entries.firstOrNull { it.id.equals(id, ignoreCase = true) } ?: EDITING_PENDING
        }
    }
}
