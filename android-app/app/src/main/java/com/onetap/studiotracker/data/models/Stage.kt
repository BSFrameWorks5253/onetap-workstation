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
    EDITING_PENDING("editing_pending", "Editing Pending", "EP", "#F59E0B", Color(0xFFF59E0B), 0),
    IN_PROGRESS("editing", "Editing", "ED", "#3B82F6", Color(0xFF3B82F6), 1),
    UPLOAD_PENDING("upload_pending", "Upload Pending", "UP", "#06B6D4", Color(0xFF06B6D4), 2),
    UPLOADED("uploaded", "Uploaded", "UL", "#10B981", Color(0xFF10B981), 3),
    ALJAMEA_DONE("jameya", "AlJamea Done", "AJ", "#059669", Color(0xFF059669), 4);

    val isDelivered: Boolean get() = this == UPLOADED || this == ALJAMEA_DONE
    val nextStage: Stage? get() = entries.getOrNull(order + 1)
    val prevStage: Stage? get() = if (order > 0) entries.getOrNull(order - 1) else null

    companion object {
        fun fromId(raw: String?): Stage = when (raw?.lowercase()?.trim()) {
            "editing_pending", "pending" -> EDITING_PENDING
            "editing", "in_progress", "in progress", "review" -> IN_PROGRESS
            "upload_pending", "rendering", "rendered" -> UPLOAD_PENDING
            "uploaded", "upload" -> UPLOADED
            "jameya", "aljamea_done", "submitted", "completed" -> ALJAMEA_DONE
            else -> EDITING_PENDING
        }
    }
}
