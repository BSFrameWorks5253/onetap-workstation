package com.onetap.studiotracker.data.sync

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class RemoteSnapshotRow(
    val id: String = "primary",
    val snapshot: RemoteSnapshotPayload? = null,
    val updated_at: String? = null
)

@Serializable
data class RemoteSnapshotPayload(
    val tasks: List<RemoteTaskItem> = emptyList(),
    val folders: List<String> = emptyList(),
    val safars: List<RemoteSafarGroup> = emptyList(),
    val stageOverrides: Map<String, JsonElement> = emptyMap(),
    val deletedTasks: List<String> = emptyList(),
    val deletedSafars: List<String> = emptyList(),
    val activeSafar: String? = null,
    val updatedAt: String? = null,
    val source: String? = null
)

@Serializable
data class RemoteSafarGroup(
    val safarName: String = "",
    val safarYear: JsonElement? = null,
    val totalDays: Int = 0,
    val completedDays: Int = 0,
    val isSafarDone: Boolean = false,
    val isArchived: Boolean = false,
    val isDone: Boolean = false,
    val archivePriorStages: Map<String, String> = emptyMap(),
    val city: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class RemoteTaskItem(
    val id: String? = null,
    val safarName: String = "",
    val dateFolder: String = "",
    val hijriDate: String? = null,
    val stage: String? = null,
    val status: String? = null,
    val dueDate: String? = null,
    val editorName: String? = null,
    val videoEditor: String? = null,
    val photoStage: String? = null,
    val photoEditorName: String? = null,
    val photoUploaded: Boolean = false,
    val updatedAt: String? = null,
    val isPresent: Boolean? = null,
    val isMissing: Boolean? = null,
    val is_present: Boolean? = null,
    val notes: String? = null,
    val comment: String? = null,
    val driveFolderUrl: String? = null,
    val renderDuration: Double? = null,
    val renderVideoCount: Int? = null,
    val renderSizeBytes: Long? = null,
    val prprojModifiedAt: Long? = null,
    val renderedAt: Long? = null
)

enum class SyncStatus {
    IDLE, SYNCING, CONNECTED, REALTIME_LIVE, OFFLINE, ERROR
}

data class SyncState(
    val status: SyncStatus = SyncStatus.IDLE,
    val isRealtimeConnected: Boolean = false,
    val lastSyncedAt: Long = 0L,
    val latencyMs: Long = 0L,
    val pendingMutationsCount: Int = 0,
    val syncNotice: String = "Connecting to real-time sync…",
    val isAutoSyncEnabled: Boolean = true
)
