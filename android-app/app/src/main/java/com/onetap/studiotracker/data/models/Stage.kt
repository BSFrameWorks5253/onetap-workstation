package com.onetap.studiotracker.data.models

import androidx.compose.ui.graphics.Color

enum class Stage(
    val id: String,
    val title: String,
    val shortLabel: String,
    val hexColor: String,
    val composeColor: Color,
    val order: Int
) {
    EDITING_PENDING(
        id = "editing_pending",
        title = "Editing Pending",
        shortLabel = "EP",
        hexColor = "#F59E0B",
        composeColor = Color(0xFFF59E0B),
        order = 0
    ),
    IN_PROGRESS(
        id = "editing",
        title = "Editing",
        shortLabel = "ED",
        hexColor = "#3B82F6",
        composeColor = Color(0xFF3B82F6),
        order = 1
    ),
    UPLOAD_PENDING(
        id = "upload_pending",
        title = "Upload Pending",
        shortLabel = "UP",
        hexColor = "#06B6D4",
        composeColor = Color(0xFF06B6D4),
        order = 2
    ),
    UPLOADED(
        id = "uploaded",
        title = "Uploaded",
        shortLabel = "UL",
        hexColor = "#10B981",
        composeColor = Color(0xFF10B981),
        order = 3
    ),
    ALJAMEA_DONE(
        id = "jameya",
        title = "AlJamea Done",
        shortLabel = "AJ",
        hexColor = "#059669",
        composeColor = Color(0xFF059669),
        order = 4
    );

    val isDelivered: Boolean
        get() = this == UPLOADED || this == ALJAMEA_DONE

    val nextStage: Stage?
        get() = entries.getOrNull(order + 1)

    val prevStage: Stage?
        get() = if (order > 0) entries.getOrNull(order - 1) else null

    companion object {
        fun fromId(raw: String?): Stage {
            val s = raw?.lowercase()?.trim() ?: ""
            return when (s) {
                "editing_pending", "pending" -> EDITING_PENDING
                "editing", "in_progress", "in progress", "review" -> IN_PROGRESS
                "upload_pending", "rendering", "rendered" -> UPLOAD_PENDING
                "uploaded", "upload" -> UPLOADED
                "jameya", "aljamea_done", "submitted", "completed" -> ALJAMEA_DONE
                else -> EDITING_PENDING
            }
        }
    }
}
