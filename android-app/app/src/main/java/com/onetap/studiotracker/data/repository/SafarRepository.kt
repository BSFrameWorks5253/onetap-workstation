package com.onetap.studiotracker.data.repository

import android.content.Context
import android.util.Log
import com.onetap.studiotracker.data.analytics.HijriSummaryEngine
import com.onetap.studiotracker.data.models.PhotoStage
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.models.StudioStats
import com.onetap.studiotracker.data.sync.DrivePhotoFolderInfo
import com.onetap.studiotracker.data.sync.GoogleAppsScriptSyncClient
import com.onetap.studiotracker.data.sync.RealtimeEvent
import com.onetap.studiotracker.data.sync.RemoteSafarGroup
import com.onetap.studiotracker.data.sync.RemoteSnapshotPayload
import com.onetap.studiotracker.data.sync.RemoteTaskItem
import com.onetap.studiotracker.data.sync.SupabaseRealtimeClient
import com.onetap.studiotracker.data.sync.SupabaseSyncClient
import com.onetap.studiotracker.data.sync.SyncState
import com.onetap.studiotracker.data.sync.SyncStatus
import com.onetap.studiotracker.util.BatchNotificationManager
import com.onetap.studiotracker.widget.SafarWidgetUpdater
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SafarRepository private constructor(private val appContext: Context?) {

    private val repositoryScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val localStore = appContext?.let { LocalStore(it) }
    private val supabaseClient = SupabaseSyncClient()
    private val realtimeClient = SupabaseRealtimeClient()
    private val gasClient = GoogleAppsScriptSyncClient {
        localStore?.getGsUrl() ?: LocalStore.DEFAULT_GS_URL
    }

    private var latestRawSnapshot: RemoteSnapshotPayload = localStore?.loadSnapshot() ?: RemoteSnapshotPayload()

    private val _campaigns = MutableStateFlow<List<SafarCampaign>>(emptyList())
    val campaigns: StateFlow<List<SafarCampaign>> = _campaigns.asStateFlow()

    private val _activeCampaignId = MutableStateFlow<String?>(null)
    val activeCampaignId: StateFlow<String?> = _activeCampaignId.asStateFlow()

    private val _syncState = MutableStateFlow(SyncState())
    val syncState: StateFlow<SyncState> = _syncState.asStateFlow()

    private val _isInitialLoading = MutableStateFlow(true)
    val isInitialLoading: StateFlow<Boolean> = _isInitialLoading.asStateFlow()

    private val _auditLogs = MutableStateFlow<List<AuditLogEntry>>(localStore?.getAuditLogs() ?: emptyList())
    val auditLogs: StateFlow<List<AuditLogEntry>> = _auditLogs.asStateFlow()

    private val _authUser = MutableStateFlow<AuthUser?>(localStore?.loadAuthUser())
    val authUser: StateFlow<AuthUser?> = _authUser.asStateFlow()

    private val _drivePhotoInfo = MutableStateFlow<Map<String, DrivePhotoFolderInfo>>(emptyMap())
    val drivePhotoInfo: StateFlow<Map<String, DrivePhotoFolderInfo>> = _drivePhotoInfo.asStateFlow()

    init {
        if (latestRawSnapshot.tasks.isNotEmpty() || latestRawSnapshot.safars.isNotEmpty()) {
            applyCloudSnapshot(latestRawSnapshot, persistCache = false)
            _isInitialLoading.value = false
        }
        startRealtimeAndSync()
    }

    private fun startRealtimeAndSync() {
        // 1. Connect Supabase Realtime WebSockets
        realtimeClient.connect()

        // 2. Observe WebSocket connection status
        repositoryScope.launch {
            realtimeClient.isConnected.collect { connected ->
                _syncState.value = _syncState.value.copy(
                    isRealtimeConnected = connected,
                    status = if (connected) SyncStatus.REALTIME_LIVE else _syncState.value.status,
                    syncNotice = if (connected) {
                        "Real-time WebSocket live"
                    } else {
                        _syncState.value.syncNotice
                    }
                )
            }
        }

        // 3. Observe incoming Realtime events (instant updates from web / desktop)
        repositoryScope.launch {
            realtimeClient.events.collect { event ->
                when (event) {
                    is RealtimeEvent.SnapshotReceived -> {
                        applyCloudSnapshot(event.payload, persistCache = true)
                        _isInitialLoading.value = false
                        _syncState.value = _syncState.value.copy(
                            status = SyncStatus.REALTIME_LIVE,
                            lastSyncedAt = System.currentTimeMillis(),
                            syncNotice = "Live update received"
                        )
                    }
                    is RealtimeEvent.SafarStatusChanged -> {
                        updateSafarStatusLocally(event.safarName, event.isArchived, event.isDone)
                    }
                    is RealtimeEvent.NotificationReceived -> {
                        appContext?.let { ctx ->
                            BatchNotificationManager.showSimpleNotification(ctx, event.title, event.message)
                        }
                    }
                    is RealtimeEvent.RescanRequested -> {
                        triggerCloudSync()
                    }
                }
            }
        }

        // 4. Initial REST fetch + flush offline mutations + 30s safety-net reconciliation
        repositoryScope.launch {
            triggerCloudSync()
            while (isActive) {
                delay(30_000)
                if (_syncState.value.isAutoSyncEnabled) {
                    if (localStore?.hasPendingPush() == true) {
                        pushLocalStateToCloud()
                    } else {
                        triggerCloudSync(silent = true)
                    }
                }
            }
        }
    }

    suspend fun triggerCloudSync(silent: Boolean = false): Boolean {
        if (!silent) {
            _syncState.value = _syncState.value.copy(status = SyncStatus.SYNCING)
        }
        val startTime = System.currentTimeMillis()
        val result = supabaseClient.fetchLatestSnapshot()
        val latency = System.currentTimeMillis() - startTime

        return if (result.isSuccess) {
            val payload = result.getOrNull()
            if (payload != null) {
                applyCloudSnapshot(payload, persistCache = true)
            }
            _isInitialLoading.value = false
            val isRt = realtimeClient.isConnected.value
            _syncState.value = _syncState.value.copy(
                status = if (isRt) SyncStatus.REALTIME_LIVE else SyncStatus.CONNECTED,
                lastSyncedAt = System.currentTimeMillis(),
                latencyMs = latency,
                syncNotice = if (isRt) "Real-time live (${latency}ms)" else "Synced (${latency}ms)"
            )
            true
        } else {
            _isInitialLoading.value = false
            val errorMsg = result.exceptionOrNull()?.message ?: "Offline"
            _syncState.value = _syncState.value.copy(
                status = SyncStatus.ERROR,
                syncNotice = "Offline cache active ($errorMsg)"
            )
            false
        }
    }

    fun requestRescanFromDesktop() {
        realtimeClient.requestSnapshotFromPeers()
        repositoryScope.launch {
            triggerCloudSync()
        }
    }

    private fun isJunkSafarName(name: String?): Boolean {
        val s = name?.trim()?.lowercase() ?: return true
        return s.isEmpty() || s == "uncategorized" || s == "general" || s == "null" || s == "undefined"
    }

    private fun parseHijriFromFolder(dateFolder: String, explicitHijri: String?): String {
        if (!explicitHijri.isNullOrBlank()) return explicitHijri
        val match = Regex("""^(\d{4}[-_.]\d{1,2}[-_.]\d{1,2})""").find(dateFolder.trim())
        return match?.groupValues?.get(1) ?: ""
    }

    private fun applyCloudSnapshot(payload: RemoteSnapshotPayload, persistCache: Boolean) {
        try {
            latestRawSnapshot = payload
            if (persistCache) {
                localStore?.saveSnapshot(payload)
            }

            val deletedSafarsSet = payload.deletedSafars.map { it.lowercase() }.toSet()
            val deletedTasksSet = payload.deletedTasks.map { it.lowercase() }.toSet()

            val filteredTasks = payload.tasks.filter { item ->
                val sName = item.safarName.trim()
                val dFolder = item.dateFolder.trim()
                val key = "${sName}::${dFolder}".lowercase()
                !isJunkSafarName(sName) &&
                    !deletedSafarsSet.contains(sName.lowercase()) &&
                    !deletedTasksSet.contains(key)
            }

            val tasksBySafar = filteredTasks.groupBy { it.safarName.trim() }
            val allSafarNames = (tasksBySafar.keys + payload.safars.map { it.safarName.trim() })
                .filter { !isJunkSafarName(it) && !deletedSafarsSet.contains(it.lowercase()) }
                .distinct()

            val updatedCampaigns = mutableListOf<SafarCampaign>()

            allSafarNames.forEach { safarName ->
                val taskItems = tasksBySafar[safarName].orEmpty()
                val safarGroup = payload.safars.firstOrNull { it.safarName == safarName }
                val isArchived = safarGroup?.isArchived ?: false
                val isDone = safarGroup?.isDone ?: safarGroup?.isSafarDone ?: false

                val mappedTasks = taskItems.mapIndexed { index, item ->
                    val overrideKey = "${safarName}::${item.dateFolder}"
                    val overrideElem = payload.stageOverrides[overrideKey]
                    val overrideStage = extractOverrideString(overrideElem, "stage")
                        ?: extractOverrideString(overrideElem, "status")
                    val effectiveStatus = overrideStage ?: item.stage ?: item.status ?: "editing_pending"
                    val stage = Stage.fromId(effectiveStatus)

                    val overrideEditor = extractOverrideString(overrideElem, "editorName")
                    val overrideDue = extractOverrideString(overrideElem, "dueDate")
                    val overridePhotoStage = extractOverrideString(overrideElem, "photoStage")
                    val overridePhotoEditor = extractOverrideString(overrideElem, "photoEditorName")

                    val photoUploaded = item.photoUploaded ||
                        overridePhotoStage?.equals("uploaded", ignoreCase = true) == true ||
                        item.photoStage?.equals("uploaded", ignoreCase = true) == true
                    val photoStage = PhotoStage.fromId(overridePhotoStage ?: item.photoStage, photoUploaded)

                    val taskKey = "${safarName}::${item.dateFolder}"
                    if (localStore?.getStageEnteredAt(taskKey) == null) {
                        localStore?.saveStageEnteredAt(taskKey, System.currentTimeMillis())
                    }

                    SafarTask(
                        id = item.id?.takeIf { it.isNotBlank() } ?: "$safarName::${item.dateFolder}::$index",
                        campaignId = safarName,
                        title = item.dateFolder.ifBlank { "Untitled Date" },
                        hijriDate = parseHijriFromFolder(item.dateFolder, item.hijriDate),
                        dueDate = overrideDue ?: item.dueDate.orEmpty(),
                        stage = stage,
                        videoEditor = overrideEditor ?: item.editorName ?: item.videoEditor,
                        photoEditorName = overridePhotoEditor ?: item.photoEditorName,
                        driveFolderUrl = item.driveFolderUrl,
                        photoStage = photoStage,
                        photoUploaded = photoUploaded,
                        isPresent = item.isPresent ?: item.is_present ?: true,
                        isMissing = item.isMissing ?: false,
                        notes = item.notes ?: item.comment,
                        renderDurationSeconds = item.renderDuration,
                        renderVideoCount = item.renderVideoCount,
                        renderSizeBytes = item.renderSizeBytes,
                        prprojModifiedAt = item.prprojModifiedAt,
                        renderedAt = item.renderedAt,
                        updatedAtIso = item.updatedAt.orEmpty()
                    )
                }.sortedBy { it.title }

                val yearStr = safarGroup?.safarYear?.let {
                    if (it is JsonPrimitive) it.content else ""
                } ?: HijriSummaryEngine.parseHijriYearAndMonth(safarName)?.first?.toString().orEmpty()

                val isOngoing = safarName == payload.activeSafar ||
                    (!isArchived && !isDone && payload.activeSafar == null &&
                        updatedCampaigns.none { it.isOngoing })

                updatedCampaigns.add(
                    SafarCampaign(
                        id = safarName,
                        name = safarName,
                        safarYear = yearStr,
                        location = safarGroup?.city.orEmpty(),
                        isOngoing = isOngoing,
                        isArchived = isArchived,
                        isDone = isDone,
                        updatedAtIso = safarGroup?.updatedAt.orEmpty(),
                        archivePriorStages = safarGroup?.archivePriorStages ?: emptyMap(),
                        tasks = mappedTasks
                    )
                )
            }

            // Ensure one active ongoing campaign if available
            val activeList = updatedCampaigns.filter { !it.isArchived }
            val resolvedOngoing = activeList.firstOrNull { it.isOngoing }
                ?: activeList.firstOrNull { !it.is100PercentDone }
                ?: activeList.firstOrNull()
                ?: updatedCampaigns.firstOrNull()

            val finalCampaigns = updatedCampaigns.map {
                it.copy(isOngoing = (it.id == resolvedOngoing?.id))
            }

            _campaigns.value = finalCampaigns
            val currentActiveId = _activeCampaignId.value
            if (currentActiveId == null || finalCampaigns.none { it.id == currentActiveId }) {
                _activeCampaignId.value = resolvedOngoing?.id
            }

            appContext?.let { SafarWidgetUpdater.updateAllWidgets(it, resolvedOngoing, finalCampaigns) }
        } catch (t: Throwable) {
            Log.e("SafarRepository", "Error applying cloud snapshot", t)
        }
    }

    private fun extractOverrideString(elem: JsonElement?, key: String): String? {
        if (elem == null) return null
        return try {
            if (elem is JsonPrimitive) {
                if (key == "stage" || key == "status") elem.content else null
            } else {
                elem.jsonObject[key]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
            }
        } catch (_: Throwable) {
            null
        }
    }

    private fun updateSafarStatusLocally(safarName: String, isArchived: Boolean, isDone: Boolean) {
        _campaigns.value = _campaigns.value.map { c ->
            if (c.name == safarName) c.copy(isArchived = isArchived, isDone = isDone) else c
        }
    }

    private fun currentIsoTimestamp(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    private fun pushLocalStateToCloud() {
        repositoryScope.launch {
            val currentCampaigns = _campaigns.value
            val active = currentCampaigns.firstOrNull { it.isOngoing }?.name
            val isoDate = currentIsoTimestamp()

            val remoteSafars = currentCampaigns.map { c ->
                RemoteSafarGroup(
                    safarName = c.name,
                    safarYear = JsonPrimitive(c.safarYear.ifBlank { "" }),
                    totalDays = c.totalDates,
                    completedDays = c.deliveredVideosCount,
                    isSafarDone = c.is100PercentDone,
                    isArchived = c.isArchived,
                    isDone = c.isDone,
                    archivePriorStages = c.archivePriorStages,
                    city = c.location.ifBlank { null },
                    updatedAt = isoDate
                )
            }

            val remoteTasks = currentCampaigns.flatMap { c ->
                c.tasks.map { t ->
                    RemoteTaskItem(
                        id = t.id,
                        safarName = c.name,
                        dateFolder = t.title,
                        hijriDate = t.hijriDate.ifBlank { null },
                        stage = t.stage.id,
                        status = t.stage.id,
                        dueDate = t.dueDate.ifBlank { null },
                        editorName = t.effectiveVideoEditor,
                        videoEditor = t.effectiveVideoEditor,
                        photoStage = t.photoStage.id,
                        photoEditorName = t.effectivePhotoEditor,
                        photoUploaded = t.isPhotosDelivered,
                        updatedAt = isoDate,
                        isPresent = t.isPresent,
                        isMissing = t.isMissing,
                        notes = t.notes,
                        driveFolderUrl = t.driveFolderUrl,
                        renderDuration = t.renderDurationSeconds,
                        renderVideoCount = t.renderVideoCount,
                        renderSizeBytes = t.renderSizeBytes,
                        prprojModifiedAt = t.prprojModifiedAt,
                        renderedAt = t.renderedAt
                    )
                }
            }

            val payload = latestRawSnapshot.copy(
                safars = remoteSafars,
                tasks = remoteTasks,
                activeSafar = active,
                updatedAt = isoDate,
                source = "android_app"
            )
            latestRawSnapshot = payload
            localStore?.saveSnapshot(payload)

            val pushResult = supabaseClient.pushSnapshot(payload)
            if (pushResult.isSuccess) {
                localStore?.setPendingPush(false)
                // Broadcast instant snapshot to web & other mobile devices
                val jsonPayload = JSONObject().apply {
                    put("updatedAt", isoDate)
                }
                realtimeClient.sendBroadcast("realtime:one_tap_safar_tracker", "request_snapshot", jsonPayload)
                _syncState.value = _syncState.value.copy(
                    lastSyncedAt = System.currentTimeMillis(),
                    pendingMutationsCount = 0
                )
            } else {
                localStore?.setPendingPush(true)
                _syncState.value = _syncState.value.copy(
                    pendingMutationsCount = _syncState.value.pendingMutationsCount + 1,
                    syncNotice = "Saved offline — will sync when online"
                )
            }
        }
    }

    private fun recordAudit(
        safarName: String,
        dateFolder: String,
        action: String,
        fromVal: String,
        toVal: String,
        turnaroundMs: Long? = null
    ) {
        val actor = _authUser.value?.name ?: "Mobile Operator"
        val entry = AuditLogEntry(
            id = "${System.currentTimeMillis()}_${dateFolder.hashCode()}",
            timestamp = System.currentTimeMillis(),
            safarName = safarName,
            dateFolder = dateFolder,
            action = action,
            fromValue = fromVal,
            toValue = toVal,
            actor = actor,
            turnaroundMs = turnaroundMs
        )
        localStore?.appendAuditLog(entry)
        _auditLogs.value = localStore?.getAuditLogs() ?: emptyList()
    }

    val activeCampaign: SafarCampaign?
        get() = _campaigns.value.firstOrNull { it.id == _activeCampaignId.value }
            ?: _campaigns.value.firstOrNull { it.isOngoing }
            ?: _campaigns.value.firstOrNull()

    fun getStudioStats(): StudioStats = StudioStats.calculate(_campaigns.value)

    fun setActiveCampaign(campaignId: String) {
        _activeCampaignId.value = campaignId
        _campaigns.value = _campaigns.value.map { it.copy(isOngoing = (it.id == campaignId)) }
        appContext?.let { SafarWidgetUpdater.updateAllWidgets(it, activeCampaign, _campaigns.value) }
        pushLocalStateToCloud()
    }

    fun updateTaskStage(taskId: String, newStage: Stage) {
        var changedTask: SafarTask? = null
        var previousStage: Stage? = null
        var campaignName = ""

        _campaigns.value = _campaigns.value.map { campaign ->
            val updatedTasks = campaign.tasks.map { task ->
                if (task.id == taskId) {
                    previousStage = task.stage
                    campaignName = campaign.name
                    val mod = task.copy(stage = newStage, updatedAt = System.currentTimeMillis())
                    changedTask = mod
                    mod
                } else task
            }
            campaign.copy(tasks = updatedTasks)
        }

        changedTask?.let { task ->
            val taskKey = "${campaignName}::${task.title}"
            val enteredAt = localStore?.getStageEnteredAt(taskKey)
            val turnaround = enteredAt?.let { System.currentTimeMillis() - it }?.takeIf { it > 0 }
            localStore?.saveStageEnteredAt(taskKey, System.currentTimeMillis())
            recordAudit(
                safarName = campaignName,
                dateFolder = task.title,
                action = "Stage Updated",
                fromVal = previousStage?.title.orEmpty(),
                toVal = newStage.title,
                turnaroundMs = turnaround
            )
            appContext?.let { SafarWidgetUpdater.updateAllWidgets(it, activeCampaign, _campaigns.value) }
            pushLocalStateToCloud()
            repositoryScope.launch {
                supabaseClient.broadcastNotification(
                    title = "${task.title} Updated",
                    message = "${task.title} moved to ${newStage.title}",
                    type = "mobile_status_update"
                )
            }
        }
    }

    fun bulkUpdateTaskStage(taskIds: Set<String>, newStage: Stage) {
        if (taskIds.isEmpty()) return
        var count = 0
        _campaigns.value = _campaigns.value.map { campaign ->
            val updatedTasks = campaign.tasks.map { task ->
                if (task.id in taskIds) {
                    count++
                    val taskKey = "${campaign.name}::${task.title}"
                    localStore?.saveStageEnteredAt(taskKey, System.currentTimeMillis())
                    recordAudit(campaign.name, task.title, "Bulk Stage Update", task.stage.title, newStage.title)
                    task.copy(stage = newStage, updatedAt = System.currentTimeMillis())
                } else task
            }
            campaign.copy(tasks = updatedTasks)
        }
        if (count > 0) {
            appContext?.let { SafarWidgetUpdater.updateAllWidgets(it, activeCampaign, _campaigns.value) }
            pushLocalStateToCloud()
        }
    }

    fun updateTaskEditor(taskId: String, editorName: String) {
        val clean = editorName.trim()
        _campaigns.value = _campaigns.value.map { campaign ->
            campaign.copy(tasks = campaign.tasks.map { task ->
                if (task.id == taskId) {
                    recordAudit(campaign.name, task.title, "Editor Assigned", task.effectiveVideoEditor, clean.ifBlank { "Murtaza" })
                    task.copy(videoEditor = clean.ifBlank { null }, updatedAt = System.currentTimeMillis())
                } else task
            })
        }
        pushLocalStateToCloud()
    }

    fun updateTaskDueDate(taskId: String, dueDate: String) {
        _campaigns.value = _campaigns.value.map { campaign ->
            campaign.copy(tasks = campaign.tasks.map { task ->
                if (task.id == taskId) {
                    recordAudit(campaign.name, task.title, "Due Date Updated", task.dueDate, dueDate)
                    task.copy(dueDate = dueDate.trim(), updatedAt = System.currentTimeMillis())
                } else task
            })
        }
        pushLocalStateToCloud()
    }

    fun updateTaskPhotoStage(taskId: String, newPhotoStage: PhotoStage) {
        var updatedTask: SafarTask? = null
        var campaignName = ""
        val isUploaded = (newPhotoStage == PhotoStage.UPLOADED)

        _campaigns.value = _campaigns.value.map { campaign ->
            campaign.copy(tasks = campaign.tasks.map { task ->
                if (task.id == taskId) {
                    campaignName = campaign.name
                    recordAudit(campaign.name, task.title, "Photo Stage", task.photoStage.title, newPhotoStage.title)
                    val mod = task.copy(
                        photoStage = newPhotoStage,
                        photoUploaded = isUploaded,
                        updatedAt = System.currentTimeMillis()
                    )
                    updatedTask = mod
                    mod
                } else task
            })
        }

        pushLocalStateToCloud()

        updatedTask?.let { task ->
            if (isUploaded) {
                repositoryScope.launch {
                    val actor = _authUser.value?.name ?: "One Tap Android"
                    val phone = localStore?.getWhatsAppPhone() ?: LocalStore.DEFAULT_WHATSAPP_PHONE
                    gasClient.markFolderUploaded(campaignName, task.title, actor, phone)
                    supabaseClient.broadcastNotification(
                        title = "Photos Uploaded to Drive",
                        message = "${task.title} photos marked Uploaded",
                        type = "photos_uploaded"
                    )
                }
            }
        }
    }

    fun batchUpdatePhotoStage(taskIds: Set<String>, newPhotoStage: PhotoStage) {
        if (taskIds.isEmpty()) return
        val isUploaded = (newPhotoStage == PhotoStage.UPLOADED)
        _campaigns.value = _campaigns.value.map { campaign ->
            campaign.copy(tasks = campaign.tasks.map { task ->
                if (task.id in taskIds) {
                    recordAudit(campaign.name, task.title, "Batch Photo Stage", task.photoStage.title, newPhotoStage.title)
                    task.copy(photoStage = newPhotoStage, photoUploaded = isUploaded, updatedAt = System.currentTimeMillis())
                } else task
            })
        }
        pushLocalStateToCloud()
    }

    fun syncDrivePhotoFolders(safarName: String, expectedDates: List<String>) {
        repositoryScope.launch {
            val result = gasClient.getPhotoFolders(safarName, expectedDates)
            if (result.isSuccess) {
                val data = result.getOrNull() ?: return@launch
                _drivePhotoInfo.value = _drivePhotoInfo.value + data.folders.mapKeys { "${safarName}::${it.key}" }
            }
        }
    }

    fun addManualTask(safarName: String, dateFolder: String, notes: String? = null) {
        val cleanFolder = dateFolder.trim()
        if (safarName.isBlank() || cleanFolder.isBlank()) return
        val newTask = SafarTask(
            id = "$safarName::$cleanFolder::${System.currentTimeMillis()}",
            campaignId = safarName,
            title = cleanFolder,
            hijriDate = parseHijriFromFolder(cleanFolder, null),
            stage = Stage.IN_PROGRESS,
            notes = notes?.trim()?.takeIf { it.isNotEmpty() }
        )
        _campaigns.value = _campaigns.value.map { c ->
            if (c.name == safarName) c.copy(tasks = c.tasks + newTask) else c
        }
        recordAudit(safarName, cleanFolder, "Task Added", "", "Editing")
        pushLocalStateToCloud()
    }

    fun excludeTask(safarName: String, taskId: String, dateFolder: String) {
        val key = "${safarName}::${dateFolder}"
        latestRawSnapshot = latestRawSnapshot.copy(
            deletedTasks = (latestRawSnapshot.deletedTasks + key).distinct()
        )
        _campaigns.value = _campaigns.value.map { c ->
            if (c.name == safarName) c.copy(tasks = c.tasks.filterNot { it.id == taskId }) else c
        }
        recordAudit(safarName, dateFolder, "Task Excluded", "", "Removed")
        pushLocalStateToCloud()
    }

    fun toggleSafarArchive(safarName: String, archive: Boolean) {
        _campaigns.value = _campaigns.value.map { c ->
            if (c.name == safarName) {
                if (archive) {
                    val prior = c.tasks.associate { it.title to it.stage.id }
                    c.copy(
                        isArchived = true,
                        isDone = true,
                        archivePriorStages = prior,
                        tasks = c.tasks.map { it.copy(stage = Stage.ALJAMEA_DONE) }
                    )
                } else {
                    c.copy(
                        isArchived = false,
                        isDone = false,
                        tasks = c.tasks.map { t ->
                            val restored = c.archivePriorStages[t.title]?.let { Stage.fromId(it) } ?: t.stage
                            t.copy(stage = restored)
                        }
                    )
                }
            } else c
        }
        recordAudit(safarName, "All Dates", if (archive) "Safar Archived" else "Safar Restored", "", if (archive) "Archived" else "Active")
        pushLocalStateToCloud()
        realtimeClient.sendBroadcast(
            "realtime:anyshare_realtime_nexus",
            "safar_status_changed",
            JSONObject().apply {
                put("safarName", safarName)
                put("isArchived", archive)
                put("isDone", archive)
            }
        )
    }

    fun deleteSafar(safarName: String) {
        latestRawSnapshot = latestRawSnapshot.copy(
            deletedSafars = (latestRawSnapshot.deletedSafars + safarName).distinct()
        )
        _campaigns.value = _campaigns.value.filterNot { it.name == safarName }
        recordAudit(safarName, "Safar", "Safar Deleted", "", "Deleted")
        pushLocalStateToCloud()
    }

    suspend fun requestOtp(email: String): Result<String> = gasClient.requestOtp(email)

    suspend fun verifyOtp(email: String, otp: String): Result<AuthUser> {
        val res = gasClient.verifyOtp(email, otp)
        if (res.isSuccess) {
            val user = res.getOrNull()
            localStore?.saveAuthUser(user)
            _authUser.value = user
        }
        return res
    }

    fun signOut() {
        localStore?.saveAuthUser(null)
        _authUser.value = null
    }

    fun getGsUrl(): String = localStore?.getGsUrl() ?: LocalStore.DEFAULT_GS_URL
    fun setGsUrl(url: String) = localStore?.setGsUrl(url) ?: Unit
    fun getWhatsAppPhone(): String = localStore?.getWhatsAppPhone() ?: LocalStore.DEFAULT_WHATSAPP_PHONE
    fun setWhatsAppPhone(phone: String) = localStore?.setWhatsAppPhone(phone) ?: Unit

    suspend fun sendDirectWhatsAppBriefing(campaign: SafarCampaign): Result<Boolean> {
        val text = generateWhatsAppBriefingText(campaign)
        val phone = getWhatsAppPhone()
        return gasClient.sendWhatsAppAlert(phone, text)
    }

    fun generateWhatsAppBriefingText(campaign: SafarCampaign): String {
        val totalDays = campaign.tasks.size
        val videoDelivered = campaign.deliveredVideosCount
        val videoPending = (totalDays - videoDelivered).coerceAtLeast(0)
        val overallPercent = campaign.overallPercentage
        val is100Done = campaign.is100PercentDone

        val sb = StringBuilder()
        sb.append("📋 *ONE TAP STUDIO | SAFAR EXECUTIVE BRIEFING*\n")
        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("📍 *Safar:* ${campaign.name}\n")
        if (campaign.location.isNotBlank()) {
            sb.append("🌐 *City:* ${campaign.location}\n")
        }
        sb.append("\n")

        if (is100Done) {
            sb.append("🏆 *MILESTONE REACHED: 100% FULLY DELIVERED!*\n\n")
        } else {
            val filledBars = (overallPercent / 10).coerceIn(0, 10)
            val emptyBars = 10 - filledBars
            val progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars)
            sb.append("📊 *Video Delivery:* *$overallPercent%*\n")
            sb.append("`[$progressBar]`\n\n")
        }

        sb.append("🎬 *Video Production Pipeline:*\n")
        sb.append(" • Total Dates: *$totalDays*\n")
        sb.append(" • Delivered / AlJamea: *$videoDelivered* ✅\n")
        sb.append(" • Remaining: *$videoPending* ⏳\n\n")

        sb.append("📸 *Photo Tracker:*\n")
        sb.append(" • Uploaded: *${campaign.deliveredPhotosCount}/$totalDays* (${campaign.photoUploadPercentage}%)\n\n")

        sb.append("🗓️ *Date-by-Date Status:*\n")
        campaign.tasks.forEachIndexed { index, task ->
            val icon = when (task.stage) {
                Stage.ALJAMEA_DONE -> "🏛️"
                Stage.UPLOADED -> "✅"
                Stage.UPLOAD_PENDING -> "⏳"
                Stage.IN_PROGRESS -> "⚙️"
                Stage.EDITING_PENDING -> "📝"
            }
            val photoBadge = if (task.isPhotosDelivered) "📸✓" else "📸(${task.photoStage.title})"
            sb.append("${index + 1}. $icon *${task.title}* [${task.stage.title}] — $photoBadge\n")
        }

        sb.append("\n━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("⚡ *One Tap Studio Tracker* • _Real-time Cloud Sync_")
        return sb.toString()
    }

    companion object {
        @Volatile
        private var instance: SafarRepository? = null

        fun init(context: Context) {
            if (instance == null) {
                synchronized(this) {
                    if (instance == null) {
                        instance = SafarRepository(context.applicationContext)
                    }
                }
            }
        }

        fun getInstance(): SafarRepository {
            return instance ?: synchronized(this) {
                instance ?: SafarRepository(null).also { instance = it }
            }
        }
    }
}
