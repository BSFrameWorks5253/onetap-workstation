package com.onetap.studiotracker.data.repository

import com.onetap.studiotracker.data.models.PhotoStage
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.models.StudioStats
import com.onetap.studiotracker.data.sync.GoogleAppsScriptSyncClient
import com.onetap.studiotracker.data.sync.RemoteSafarGroup
import com.onetap.studiotracker.data.sync.RemoteSnapshotPayload
import com.onetap.studiotracker.data.sync.RemoteTaskItem
import com.onetap.studiotracker.data.sync.SupabaseSyncClient
import com.onetap.studiotracker.data.sync.SyncState
import com.onetap.studiotracker.data.sync.SyncStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class SafarRepository private constructor() {

    private val repositoryScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val supabaseClient = SupabaseSyncClient()
    private val gasClient = GoogleAppsScriptSyncClient()

    private val _campaigns = MutableStateFlow<List<SafarCampaign>>(SampleDataProvider.getSampleCampaigns())
    val campaigns: StateFlow<List<SafarCampaign>> = _campaigns.asStateFlow()

    private val _activeCampaignId = MutableStateFlow<String?>(
        _campaigns.value.firstOrNull { it.isOngoing }?.id ?: _campaigns.value.firstOrNull()?.id
    )
    val activeCampaignId: StateFlow<String?> = _activeCampaignId.asStateFlow()

    private val _syncState = MutableStateFlow(SyncState())
    val syncState: StateFlow<SyncState> = _syncState.asStateFlow()

    init {
        // Start background autonomous cloud sync loop
        startAutoSyncLoop()
    }

    private fun startAutoSyncLoop() {
        repositoryScope.launch {
            // Initial sync on startup
            triggerCloudSync()

            // Continuous sync loop every 20 seconds
            while (isActive) {
                delay(20000)
                if (_syncState.value.isAutoSyncEnabled) {
                    triggerCloudSync()
                }
            }
        }
    }

    suspend fun triggerCloudSync(): Boolean {
        _syncState.value = _syncState.value.copy(status = SyncStatus.SYNCING)
        val startTime = System.currentTimeMillis()

        val result = supabaseClient.fetchLatestSnapshot()
        val latency = System.currentTimeMillis() - startTime

        return if (result.isSuccess) {
            val payload = result.getOrNull()
            if (payload != null && payload.tasks.isNotEmpty()) {
                applyCloudSnapshot(payload)
                _syncState.value = _syncState.value.copy(
                    status = SyncStatus.CONNECTED,
                    lastSyncedAt = System.currentTimeMillis(),
                    latencyMs = latency,
                    syncNotice = "Synced with Web & Desktop (${latency}ms)"
                )
            } else {
                // If cloud database is empty, push local state to initialize it
                pushLocalStateToCloud()
                _syncState.value = _syncState.value.copy(
                    status = SyncStatus.CONNECTED,
                    lastSyncedAt = System.currentTimeMillis(),
                    latencyMs = latency,
                    syncNotice = "Cloud database initialized (${latency}ms)"
                )
            }
            true
        } else {
            val errorMsg = result.exceptionOrNull()?.message ?: "Sync connection error"
            _syncState.value = _syncState.value.copy(
                status = SyncStatus.ERROR,
                syncNotice = "Offline mode - Local cache active ($errorMsg)"
            )
            false
        }
    }

    private fun applyCloudSnapshot(payload: RemoteSnapshotPayload) {
        try {
            // Group remote tasks by safarName
            val tasksBySafar = payload.tasks.groupBy { it.safarName }
            val updatedCampaigns = mutableListOf<SafarCampaign>()

            tasksBySafar.forEach { (safarName, taskItems) ->
                if (safarName.isBlank()) return@forEach
                val safarGroup = payload.safars.firstOrNull { it.safarName == safarName }
                val isArchived = safarGroup?.isArchived ?: false

                val mappedTasks = taskItems.mapIndexed { index, item ->
                    // Check stage overrides
                    val overrideKey = "${safarName}::${item.dateFolder}"
                    val overrideElem = payload.stageOverrides[overrideKey]
                    val overrideStatus = when {
                        overrideElem == null -> null
                        overrideElem is kotlinx.serialization.json.JsonPrimitive -> overrideElem.content
                        overrideElem is kotlinx.serialization.json.JsonObject -> {
                            val stageObj = overrideElem["stage"]
                            val statusObj = overrideElem["status"]
                            if (stageObj is kotlinx.serialization.json.JsonPrimitive) stageObj.content
                            else if (statusObj is kotlinx.serialization.json.JsonPrimitive) statusObj.content
                            else null
                        }
                        else -> null
                    }
                    val effectiveStatus = overrideStatus ?: item.stage ?: item.status ?: "editing_pending"

                    val stage = when (effectiveStatus.lowercase()) {
                        "aljamea_done", "jamea", "submitted" -> Stage.ALJAMEA_DONE
                        "uploaded" -> Stage.UPLOADED
                        "upload_pending", "review" -> Stage.UPLOAD_PENDING
                        "in_progress", "editing" -> Stage.IN_PROGRESS
                        else -> Stage.EDITING_PENDING
                    }

                    val photoStage = when (item.photoStage?.lowercase()) {
                        "drive_uploaded", "uploaded" -> PhotoStage.DRIVE_UPLOADED
                        "color_graded" -> PhotoStage.COLOR_GRADED
                        "raw_sorted" -> PhotoStage.RAW_SORTED
                        else -> if (item.uploadedPhotos >= item.totalPhotos && item.totalPhotos > 0) PhotoStage.DRIVE_UPLOADED else PhotoStage.PENDING
                    }

                    val editor = item.editorName ?: item.videoEditor ?: "One Tap Studio"

                    SafarTask(
                        id = item.id ?: "${safarName.hashCode()}-$index",
                        campaignId = safarName,
                        title = if (item.dateFolder.isNotBlank()) item.dateFolder else "Day ${index + 1}",
                        hijriDate = item.hijriDate ?: "1447-06-${String.format(Locale.ROOT, "%02d", index + 1)}",
                        gregorianDate = "2025-11-${String.format(Locale.ROOT, "%02d", index + 20)}",
                        stage = stage,
                        videoEditor = editor,
                        durationMinutes = 60,
                        driveFolderUrl = item.driveFolderUrl ?: "https://drive.google.com",
                        totalPhotos = if (item.totalPhotos > 0) item.totalPhotos else 120,
                        uploadedPhotos = item.uploadedPhotos,
                        photoStage = photoStage,
                        notes = item.notes
                    )
                }

                val isOngoing = safarName == payload.activeSafar || (payload.activeSafar == null && updatedCampaigns.isEmpty())

                updatedCampaigns.add(
                    SafarCampaign(
                        id = safarName,
                        name = safarName,
                        location = safarGroup?.city ?: "Studio Location",
                        isOngoing = isOngoing,
                        isArchived = isArchived,
                        startDate = "2025-11-20",
                        endDate = "2025-11-27",
                        tasks = mappedTasks
                    )
                )
            }

            if (updatedCampaigns.isNotEmpty()) {
                _campaigns.value = updatedCampaigns
                val currentActive = updatedCampaigns.firstOrNull { it.isOngoing } ?: updatedCampaigns.first()
                _activeCampaignId.value = currentActive.id
            }
        } catch (t: Throwable) {
            android.util.Log.e("SafarRepository", "Error applying cloud snapshot", t)
        }
    }

    private fun pushLocalStateToCloud() {
        repositoryScope.launch {
            val currentCampaigns = _campaigns.value
            val active = _campaigns.value.firstOrNull { it.isOngoing }?.name

            val remoteSafars = currentCampaigns.map { c ->
                RemoteSafarGroup(
                    safarName = c.name,
                    totalDays = c.totalDates,
                    completedDays = c.deliveredVideosCount,
                    isSafarDone = c.is100PercentDone,
                    isArchived = c.isArchived,
                    city = c.location
                )
            }

            val remoteTasks = currentCampaigns.flatMap { c ->
                c.tasks.mapIndexed { idx, t ->
                    RemoteTaskItem(
                        id = t.id,
                        safarName = c.name,
                        dateFolder = t.title,
                        stage = t.stage.id,
                        status = t.stage.id,
                        editorName = t.videoEditor,
                        videoEditor = t.videoEditor,
                        notes = t.notes,
                        driveFolderUrl = t.driveFolderUrl,
                        totalPhotos = t.totalPhotos,
                        uploadedPhotos = t.uploadedPhotos,
                        photoStage = t.photoStage.id,
                        updatedAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).format(Date(t.updatedAt))
                    )
                }
            }

            val isoDate = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).format(Date())
            val payload = RemoteSnapshotPayload(
                safars = remoteSafars,
                tasks = remoteTasks,
                activeSafar = active,
                updatedAt = isoDate
            )

            supabaseClient.pushSnapshot(payload)
        }
    }

    val activeCampaign: SafarCampaign?
        get() = _campaigns.value.firstOrNull { it.id == _activeCampaignId.value } ?: _campaigns.value.firstOrNull()

    fun getStudioStats(): StudioStats {
        return StudioStats.calculate(_campaigns.value)
    }

    fun setActiveCampaign(campaignId: String) {
        _activeCampaignId.value = campaignId
        _campaigns.value = _campaigns.value.map {
            it.copy(isOngoing = (it.id == campaignId))
        }
        pushLocalStateToCloud()
    }

    fun updateTaskStage(taskId: String, newStage: Stage) {
        var updatedTask: SafarTask? = null
        var campaignName = ""

        _campaigns.value = _campaigns.value.map { campaign ->
            val updatedTasks = campaign.tasks.map { task ->
                if (task.id == taskId) {
                    val mod = task.copy(stage = newStage, updatedAt = System.currentTimeMillis())
                    updatedTask = mod
                    campaignName = campaign.name
                    mod
                } else {
                    task
                }
            }
            campaign.copy(tasks = updatedTasks)
        }

        // Asynchronously persist to Supabase cloud database
        pushLocalStateToCloud()

        // Broadcast to desktop workstation & web users
        updatedTask?.let { task ->
            repositoryScope.launch {
                supabaseClient.broadcastNotification(
                    title = "⚡ ${task.title} Updated",
                    message = "${task.title} moved to [${newStage.title}] by Mobile Operator",
                    type = "mobile_status_update"
                )
            }
        }
    }

    fun updateTaskPhotos(taskId: String, uploadedCount: Int, photoStage: PhotoStage) {
        var updatedTask: SafarTask? = null
        var campaignName = ""

        _campaigns.value = _campaigns.value.map { campaign ->
            val updatedTasks = campaign.tasks.map { task ->
                if (task.id == taskId) {
                    val clampedUploaded = uploadedCount.coerceIn(0, task.totalPhotos)
                    val mod = task.copy(
                        uploadedPhotos = clampedUploaded,
                        photoStage = photoStage,
                        updatedAt = System.currentTimeMillis()
                    )
                    updatedTask = mod
                    campaignName = campaign.name
                    mod
                } else {
                    task
                }
            }
            campaign.copy(tasks = updatedTasks)
        }

        pushLocalStateToCloud()

        // If photos are marked uploaded, trigger Google Apps Script sync
        if (photoStage == PhotoStage.DRIVE_UPLOADED && updatedTask != null) {
            repositoryScope.launch {
                gasClient.markFolderUploaded(campaignName, updatedTask!!.title)
                supabaseClient.broadcastNotification(
                    title = "📸 Photos Uploaded to Drive",
                    message = "${updatedTask!!.title} Drive photos (${updatedTask!!.totalPhotos}) marked complete",
                    type = "photos_uploaded"
                )
            }
        }
    }

    fun generateWhatsAppBriefingText(campaign: SafarCampaign): String {
        val totalDays = campaign.tasks.size
        val videoDelivered = campaign.deliveredVideosCount
        val videoPending = totalDays - videoDelivered
        val overallPercent = campaign.overallPercentage
        val is100Done = campaign.is100PercentDone

        val sb = StringBuilder()
        sb.append("📋 *ONE TAP STUDIO | SAFAR EXECUTIVE BRIEFING*\n")
        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("📍 *Campaign:* ${campaign.name}\n")
        sb.append("🌐 *Location:* ${campaign.location}\n")
        sb.append("📅 *Timeline:* ${campaign.startDate} – ${campaign.endDate}\n\n")

        if (is100Done) {
            sb.append("🏆 *MILESTONE REACHED: 100% FULLY DELIVERED!*\n")
            sb.append("✨ All scheduled dates videos and Google Drive photo batches are archived and uploaded successfully!\n\n")
        } else {
            val filledBars = (overallPercent / 10).coerceIn(0, 10)
            val emptyBars = 10 - filledBars
            val progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars)
            sb.append("📊 *Progress Completion:* *$overallPercent%*\n")
            sb.append("`[$progressBar]`\n\n")
        }

        sb.append("🎬 *Video Production Pipeline:*\n")
        sb.append(" • Total Scheduled Dates: *$totalDays*\n")
        sb.append(" • Delivered / Uploaded: *$videoDelivered* ✅\n")
        sb.append(" • Pending / In Production: *$videoPending* ⏳\n\n")

        sb.append("📸 *Google Drive Photo Coverage:*\n")
        sb.append(" • Total Master Photos: *${campaign.totalPhotosCount}*\n")
        sb.append(" • Uploaded to Drive: *${campaign.uploadedPhotosCount}* (${campaign.photoUploadPercentage}%)\n")
        sb.append(" • Dates Completed: *${campaign.deliveredPhotosCount}/$totalDays*\n\n")

        sb.append("🗓️ *Date-by-Date Schedule Status:*\n")
        campaign.tasks.forEachIndexed { index, task ->
            val icon = when (task.stage) {
                Stage.ALJAMEA_DONE -> "🏛️"
                Stage.UPLOADED -> "✅"
                Stage.UPLOAD_PENDING -> "⏳"
                Stage.IN_PROGRESS -> "⚙️"
                Stage.EDITING_PENDING -> "📝"
            }
            val photoIndicator = if (task.isPhotosDelivered) "📸✓" else "📸(${task.uploadedPhotos}/${task.totalPhotos})"
            sb.append("${index + 1}. $icon *${task.title}* [${task.stage.title}] — $photoIndicator\n")
        }

        sb.append("\n━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("⚡ *One Tap Studio Tracker* • _Cloud DB Real-time Sync Active_")
        return sb.toString()
    }

    companion object {
        @Volatile
        private var instance: SafarRepository? = null

        fun getInstance(): SafarRepository {
            return instance ?: synchronized(this) {
                instance ?: SafarRepository().also { instance = it }
            }
        }
    }
}
