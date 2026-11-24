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
    val safars: List<RemoteSafarGroup> = emptyList(),
    val tasks: List<RemoteTaskItem> = emptyList(),
    val stageOverrides: Map<String, JsonElement> = emptyMap(),
    val deletedSafars: List<String> = emptyList(),
    val deletedTasks: List<String> = emptyList(),
    val activeSafar: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class RemoteSafarGroup(
    val safarName: String = "",
    val totalDays: Int = 0,
    val completedDays: Int = 0,
    val isSafarDone: Boolean = false,
    val isArchived: Boolean = false,
    val city: String? = null
)

@Serializable
data class RemoteTaskItem(
    val id: String? = null,
    val safarName: String = "",
    val dateFolder: String = "",
    val stage: String? = null,
    val status: String? = null,
    val editorName: String? = null,
    val videoEditor: String? = null,
    val notes: String? = null,
    val driveFolderUrl: String? = null,
    val totalPhotos: Int = 0,
    val uploadedPhotos: Int = 0,
    val photoStage: String? = null,
    val photoUploaded: Boolean = false,
    val photoEditorName: String? = null,
    val hijriDate: String? = null,
    val dueDate: String? = null,
    val updatedAt: String? = null
)

enum class SyncStatus {
    IDLE,
    SYNCING,
    CONNECTED,
    OFFLINE,
    ERROR
}

data class SyncState(
    val status: SyncStatus = SyncStatus.IDLE,
    val lastSyncedAt: Long = 0L,
    val latencyMs: Long = 0L,
    val syncNotice: String = "Ready for cloud sync",
    val isAutoSyncEnabled: Boolean = true
)
