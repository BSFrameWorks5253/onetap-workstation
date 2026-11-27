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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SafarRepository private constructor(private val appContext: Context?) {

    private val exceptionHandler = kotlinx.coroutines.CoroutineExceptionHandler { _, throwable ->
        Log.e("SafarRepository", "Coroutine error caught safely", throwable)
    }
    private val repositoryScope = CoroutineScope(SupervisorJob() + Dispatchers.IO + exceptionHandler)
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

    data class RemoteRenderJobState(
        val jobId: String = "",
        val safarName: String = "",
        val dateFolders: List<String> = emptyList(),
        val percent: Int = 0,
        val stageText: String = "",
        val status: String = "idle",
        val scheduledFor: String = ""
    )

    private val _remoteRenderState = MutableStateFlow(RemoteRenderJobState())
    val remoteRenderState: StateFlow<RemoteRenderJobState> = _remoteRenderState.asStateFlow()

    private val _lastDesktopHeartbeatAt = MutableStateFlow(0L)
    val lastDesktopHeartbeatAt: StateFlow<Long> = _lastDesktopHeartbeatAt.asStateFlow()

    private val _desktopLanIps = MutableStateFlow<List<String>>(emptyList())
    val desktopLanIps: StateFlow<List<String>> = _desktopLanIps.asStateFlow()

    private val _desktopRemotePort = MutableStateFlow(45253)
    val desktopRemotePort: StateFlow<Int> = _desktopRemotePort.asStateFlow()

    private val _desktopRemoteToken = MutableStateFlow("")
    val desktopRemoteToken: StateFlow<String> = _desktopRemoteToken.asStateFlow()

    private val _renderLogs = MutableStateFlow<List<String>>(emptyList())
    val renderLogs: StateFlow<List<String>> = _renderLogs.asStateFlow()

    private val pendingNewSafarQueue = ArrayDeque<String>()
    private val _pendingNewSafarPrompt = MutableStateFlow<String?>(null)
    val pendingNewSafarPrompt: StateFlow<String?> = _pendingNewSafarPrompt.asStateFlow()

    init {
        if (latestRawSnapshot.tasks.isNotEmpty() || latestRawSnapshot.safars.isNotEmpty()) {
            applyCloudSnapshot(latestRawSnapshot, persistCache = false)
            _isInitialLoading.value = false
        }
        startRealtimeAndSync()
    }

    private fun startRealtimeAndSync() {
        repositoryScope.launch {
            try {
                realtimeClient.connect()
            } catch (t: Throwable) {
                Log.w("SafarRepository", "Realtime connect error", t)
            }
        }

        repositoryScope.launch {
            realtimeClient.isConnected.collect { connected ->
                _syncState.value = _syncState.value.copy(
                    isRealtimeConnected = connected,
                    status = if (connected) SyncStatus.REALTIME_LIVE else _syncState.value.status,
                    syncNotice = if (connected) "Real-time WebSocket live" else _syncState.value.syncNotice
                )
            }
        }

        repositoryScope.launch {
            realtimeClient.events.collect { event ->
                when (event) {
                    is RealtimeEvent.SnapshotReceived -> {
                        if (localStore?.hasPendingPush() == true) {
                            pushLocalStateToCloud()
                        } else {
                            applyCloudSnapshot(event.payload, persistCache = true)
                            _isInitialLoading.value = false
                            _syncState.value = _syncState.value.copy(
                                status = SyncStatus.REALTIME_LIVE,
                                lastSyncedAt = System.currentTimeMillis(),
                                syncNotice = "Live update received"
                            )
                        }
                    }
                    is RealtimeEvent.SafarStatusChanged -> {
                        _campaigns.value = _campaigns.value.map { c ->
                            if (c.name == event.safarName) c.copy(isArchived = event.isArchived, isDone = event.isDone) else c
                        }
                    }
                    is RealtimeEvent.NotificationReceived -> {
                        appContext?.let { BatchNotificationManager.showSimpleNotification(it, event.title, event.message) }
                    }
                    is RealtimeEvent.BatchRenderCompleted -> {
                        appContext?.let { BatchNotificationManager.showSimpleNotification(it, event.title, event.message) }
                        val foldersLabel = event.dateFolders.joinToString(", ").ifBlank { "${event.totalVideos} video(s)" }
                        recordAudit(
                            safarName = event.safarName.ifBlank { "Workstation" },
                            dateFolder = foldersLabel,
                            action = "Batch Render Complete",
                            fromVal = "",
                            toVal = "${event.totalVideos} clips (${event.totalDurationMinutes}m)"
                        )
                        _remoteRenderState.value = _remoteRenderState.value.copy(
                            percent = 100,
                            status = "completed",
                            stageText = "Batch Complete: $foldersLabel"
                        )
                        triggerCloudSync(silent = true)
                    }
                    is RealtimeEvent.RenderTelemetry -> {
                        val prevStatus = _remoteRenderState.value.status
                        _remoteRenderState.value = _remoteRenderState.value.copy(
                            jobId = event.jobId.ifBlank { _remoteRenderState.value.jobId },
                            safarName = event.safarName.ifBlank { _remoteRenderState.value.safarName },
                            percent = event.percent,
                            stageText = event.stage,
                            status = event.status,
                            scheduledFor = event.scheduledFor
                        )
                        if (event.status == "completed" && prevStatus != "completed") {
                            val title = "Render Complete"
                            val msg = event.stage.ifBlank { "${event.safarName.ifBlank { "Batch" }} finished rendering on Desktop" }
                            appContext?.let { BatchNotificationManager.showSimpleNotification(it, title, msg) }
                        }
                    }
                    is RealtimeEvent.RenderLog -> {
                        val prefix = if (event.level == "error") "[ERROR]" else "[WARN]"
                        _renderLogs.value = (listOf("$prefix ${event.message}") + _renderLogs.value).take(25)
                        if (event.level == "error") {
                            appContext?.let { BatchNotificationManager.showSimpleNotification(it, "Render Error", event.message) }
                        }
                    }
                    is RealtimeEvent.WorkstationHeartbeat -> {
                        _lastDesktopHeartbeatAt.value = event.timestampMs
                        if (event.lanIps.isNotEmpty()) _desktopLanIps.value = event.lanIps
                        if (event.remotePort > 0) _desktopRemotePort.value = event.remotePort
                        if (event.remoteToken.isNotBlank()) _desktopRemoteToken.value = event.remoteToken
                    }
                    is RealtimeEvent.RescanRequested -> {
                        triggerCloudSync()
                    }
                }
            }
        }

        repositoryScope.launch {
            if (localStore?.hasPendingPush() == true) {
                pushSnapshotToCloudSync(latestRawSnapshot)
            }
            triggerCloudSync()
            while (isActive) {
                delay(30_000)
                if (_syncState.value.isAutoSyncEnabled) {
                    if (localStore?.hasPendingPush() == true) pushSnapshotToCloudSync(latestRawSnapshot)
                    else triggerCloudSync(silent = true)
                }
            }
        }
    }

    suspend fun triggerCloudSync(silent: Boolean = false): Boolean {
        if (localStore?.hasPendingPush() == true) {
            pushSnapshotToCloudSync(latestRawSnapshot)
        }
        if (!silent) _syncState.value = _syncState.value.copy(status = SyncStatus.SYNCING)
        val startTime = System.currentTimeMillis()
        val result = supabaseClient.fetchLatestSnapshot()
        val latency = System.currentTimeMillis() - startTime

        return if (result.isSuccess) {
            result.getOrNull()?.let { applyCloudSnapshot(it, persistCache = true) }
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
            _syncState.value = _syncState.value.copy(
                status = SyncStatus.ERROR,
                syncNotice = "Offline cache active"
            )
            false
        }
    }

    fun requestRescanFromDesktop() {
        realtimeClient.requestSnapshotFromPeers()
        repositoryScope.launch { triggerCloudSync() }
    }

    private fun isJunkSafarName(name: String?): Boolean {
        if (name.isNullOrBlank()) return true
        val clean = name.trim().lowercase()
        if (clean in setOf("uncategorized", "general", "null", "undefined")) return true
        if (JUNK_SAFAR_REGEX.matches(clean)) return true
        if (clean.contains("intel") || clean.contains("driver") || clean.contains("vga") || clean.contains("dptf") || clean.contains("mei")) return true
        if (clean.contains("in process") || clean.contains("to delete") || clean.contains("to upload") || clean.contains("uploaded data")) return true
        if (Regex("""^\d{4}[\s._-]\d{1,2}[\s._-]\d{1,2}\s*_\d{2}[a-z]?""", RegexOption.IGNORE_CASE).containsMatchIn(clean)) return true
        if (Regex("""^day[\s._-]?\d+$""", RegexOption.IGNORE_CASE).matches(clean)) return true
        if (Regex("""^\d{1,2}$""").matches(clean)) return true
        return false
    }

    private fun parseHijriFromFolder(dateFolder: String, explicitHijri: String?): String {
        if (!explicitHijri.isNullOrBlank()) return explicitHijri
        return Regex("""^(\d{4}[-_.]\d{1,2}[-_.]\d{1,2})""").find(dateFolder.trim())?.groupValues?.get(1) ?: ""
    }

    private fun applyCloudSnapshot(payload: RemoteSnapshotPayload, persistCache: Boolean) {
        try {
            latestRawSnapshot = payload
            if (persistCache) localStore?.saveSnapshot(payload)

            val deletedSafars = payload.deletedSafars.map { it.lowercase() }.toSet()
            val deletedTasks = payload.deletedTasks.map { it.lowercase() }.toSet()

            val filteredTasks = payload.tasks.filter { item ->
                val sName = item.safarName.trim()
                val dFolder = item.dateFolder.trim()
                !isJunkSafarName(sName) &&
                    sName.lowercase() !in deletedSafars &&
                    "${sName}::${dFolder}".lowercase() !in deletedTasks
            }

            val tasksBySafar = filteredTasks.groupBy { it.safarName.trim() }
            val allSafarNames = (tasksBySafar.keys + payload.safars.map { it.safarName.trim() })
                .filter { !isJunkSafarName(it) && it.lowercase() !in deletedSafars }
                .distinct()

            val updatedCampaigns = mutableListOf<SafarCampaign>()
            allSafarNames.forEach { safarName ->
                val taskItems = tasksBySafar[safarName].orEmpty()
                val safarGroup = payload.safars.firstOrNull { it.safarName == safarName }
                val isArchived = safarGroup?.isArchived ?: false
                val isDone = safarGroup?.isDone ?: safarGroup?.isSafarDone ?: false

                val mappedTasks = taskItems.mapIndexed { index, item ->
                    val overrideKey = "${safarName}::${item.dateFolder}"
                    val ov = payload.stageOverrides[overrideKey]
                    val effStatus = extractOverrideString(ov, "stage") ?: extractOverrideString(ov, "status") ?: item.stage ?: item.status ?: "editing_pending"
                    val overridePhotoStage = extractOverrideString(ov, "photoStage")
                    val photoUploaded = item.photoUploaded ||
                        overridePhotoStage?.equals("uploaded", true) == true ||
                        item.photoStage?.equals("uploaded", true) == true

                    if (localStore?.getStageEnteredAt(overrideKey) == null) {
                        localStore?.saveStageEnteredAt(overrideKey, System.currentTimeMillis())
                    }

                    SafarTask(
                        id = item.id?.takeIf { it.isNotBlank() } ?: "$safarName::${item.dateFolder}::$index",
                        campaignId = safarName,
                        title = item.dateFolder.ifBlank { "Untitled Date" },
                        hijriDate = parseHijriFromFolder(item.dateFolder, item.hijriDate),
                        dueDate = extractOverrideString(ov, "dueDate") ?: item.dueDate.orEmpty(),
                        stage = Stage.fromId(effStatus),
                        videoEditor = extractOverrideString(ov, "editorName") ?: item.editorName ?: item.videoEditor,
                        photoEditorName = extractOverrideString(ov, "photoEditorName") ?: item.photoEditorName,
                        driveFolderUrl = item.driveFolderUrl,
                        photoStage = PhotoStage.fromId(overridePhotoStage ?: item.photoStage, photoUploaded),
                        photoUploaded = photoUploaded,
                        isPresent = item.isPresent ?: item.is_present ?: true,
                        isMissing = item.isMissing ?: false,
                        notes = item.notes ?: item.comment,
                        renderDurationSeconds = item.renderDuration,
                        renderVideoCount = item.renderVideoCount,
                        renderSizeBytes = item.renderSizeBytes,
                        prprojModifiedAt = item.prprojModifiedAt,
                        renderedAt = item.renderedAt,
                        stageTimestamps = mergeStageTimestamps(item.stageTimestamps, ov),
                        updatedAtIso = item.updatedAt.orEmpty()
                    )
                }.sortedBy { it.title }

                val yearStr = safarGroup?.safarYear?.let { if (it is JsonPrimitive) it.content else "" }
                    ?: HijriSummaryEngine.parseHijriYearAndMonth(safarName)?.first?.toString().orEmpty()

                updatedCampaigns.add(
                    SafarCampaign(
                        id = safarName,
                        name = safarName,
                        safarYear = yearStr,
                        location = safarGroup?.city.orEmpty(),
                        isOngoing = (safarName == payload.activeSafar),
                        isArchived = isArchived,
                        isDone = isDone,
                        receivedDate = safarGroup?.receivedDate.orEmpty(),
                        updatedAtIso = safarGroup?.updatedAt.orEmpty(),
                        archivePriorStages = safarGroup?.archivePriorStages ?: emptyMap(),
                        tasks = mappedTasks
                    )
                )
            }

            val activeList = updatedCampaigns.filter { !it.isArchived }
            val resolvedOngoing = activeList.firstOrNull { it.isOngoing }
                ?: activeList.firstOrNull { !it.is100PercentDone }
                ?: activeList.firstOrNull()
                ?: updatedCampaigns.firstOrNull()

            val finalCampaigns = updatedCampaigns.map { it.copy(isOngoing = (it.id == resolvedOngoing?.id)) }
            _campaigns.value = finalCampaigns
            if (_activeCampaignId.value == null || finalCampaigns.none { it.id == _activeCampaignId.value }) {
                _activeCampaignId.value = resolvedOngoing?.id
            }
            detectNewlyAddedSafars(finalCampaigns)
            appContext?.let { SafarWidgetUpdater.updateAllWidgets(it, resolvedOngoing, finalCampaigns) }
        } catch (t: Throwable) {
            Log.e("SafarRepository", "Error applying snapshot", t)
        }
    }

    private fun extractOverrideString(elem: JsonElement?, key: String): String? {
        if (elem == null) return null
        return try {
            if (elem is JsonPrimitive) (if (key == "stage" || key == "status") elem.content else null)
            else elem.jsonObject[key]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
        } catch (_: Throwable) { null }
    }

    private fun mergeStageTimestamps(base: Map<String, Long>, elem: JsonElement?): Map<String, Long> {
        val out = base.toMutableMap()
        if (elem != null && elem !is JsonPrimitive) {
            try {
                val tsObj = elem.jsonObject["stageTimestamps"]?.jsonObject
                tsObj?.forEach { (k, v) ->
                    v.jsonPrimitive.content.toLongOrNull()?.let { out[k] = it }
                }
            } catch (_: Throwable) {}
        }
        return out
    }

    private fun detectNewlyAddedSafars(list: List<SafarCampaign>) {
        val store = localStore ?: return
        val activeNames = list.filter { !it.isArchived }.map { it.name }.toSet()
        if (!store.hasSeededKnownSafars()) {
            if (activeNames.isNotEmpty()) {
                store.saveKnownSafarNames(activeNames)
                store.markKnownSafarsSeeded()
            }
            return
        }
        val known = store.getKnownSafarNames()
        val newOnes = list.filter { !it.isArchived && it.name !in known && it.receivedDate.isBlank() }
        if (newOnes.isNotEmpty()) {
            newOnes.forEach { camp ->
                if (camp.name !in pendingNewSafarQueue && _pendingNewSafarPrompt.value != camp.name) {
                    pendingNewSafarQueue.addLast(camp.name)
                }
            }
            if (_pendingNewSafarPrompt.value == null && pendingNewSafarQueue.isNotEmpty()) {
                _pendingNewSafarPrompt.value = pendingNewSafarQueue.removeFirst()
            }
        }
    }

    fun setSafarReceivedDate(safarName: String, receivedDate: String) {
        val cleanDate = receivedDate.trim()
        if (safarName.isBlank()) return
        _campaigns.value = _campaigns.value.map { c ->
            if (c.name == safarName) c.copy(receivedDate = cleanDate) else c
        }
        localStore?.let { store ->
            store.saveKnownSafarNames(store.getKnownSafarNames() + safarName)
        }
        if (cleanDate.isNotBlank()) {
            recordAudit(safarName, "Safar Folder", "Received Date Set", "", cleanDate)
        }
        advanceNewSafarPromptQueue(safarName)
        pushLocalStateToCloud()
    }

    fun dismissNewSafarPrompt(safarName: String) {
        localStore?.let { store ->
            store.saveKnownSafarNames(store.getKnownSafarNames() + safarName)
        }
        advanceNewSafarPromptQueue(safarName)
    }

    private fun advanceNewSafarPromptQueue(handledSafar: String) {
        if (_pendingNewSafarPrompt.value == handledSafar) {
            _pendingNewSafarPrompt.value = if (pendingNewSafarQueue.isNotEmpty()) pendingNewSafarQueue.removeFirst() else null
        }
    }

    private fun currentIsoTimestamp(): String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

    private fun buildCurrentSnapshotPayload(): RemoteSnapshotPayload {
        val currentCampaigns = _campaigns.value
        val active = currentCampaigns.firstOrNull { it.isOngoing }?.name
        val isoDate = currentIsoTimestamp()

        val remoteSafars = currentCampaigns.map { c ->
            RemoteSafarGroup(
                safarName = c.name, safarYear = JsonPrimitive(c.safarYear), totalDays = c.totalDates,
                completedDays = c.deliveredVideosCount, isSafarDone = c.is100PercentDone,
                isArchived = c.isArchived, isDone = c.isDone, archivePriorStages = c.archivePriorStages,
                city = c.location.ifBlank { null }, receivedDate = c.receivedDate.ifBlank { null }, updatedAt = isoDate
            )
        }
        val updatedOverrides = latestRawSnapshot.stageOverrides.toMutableMap()
        val remoteTasks = currentCampaigns.flatMap { c ->
            c.tasks.map { t ->
                val overrideKey = "${c.name}::${t.title}"
                val existingObj = try {
                    (updatedOverrides[overrideKey] as? JsonObject)?.toMutableMap() ?: mutableMapOf()
                } catch (_: Throwable) { mutableMapOf() }
                existingObj["stage"] = JsonPrimitive(t.stage.id)
                existingObj["status"] = JsonPrimitive(t.stage.id)
                existingObj["editorName"] = JsonPrimitive(t.effectiveVideoEditor)
                existingObj["photoStage"] = JsonPrimitive(t.photoStage.id)
                existingObj["photoEditorName"] = JsonPrimitive(t.effectivePhotoEditor)
                if (t.dueDate.isNotBlank()) existingObj["dueDate"] = JsonPrimitive(t.dueDate)
                if (t.stageTimestamps.isNotEmpty()) {
                    existingObj["stageTimestamps"] = buildJsonObject {
                        t.stageTimestamps.forEach { (k, v) -> put(k, JsonPrimitive(v)) }
                    }
                }
                updatedOverrides[overrideKey] = JsonObject(existingObj)

                RemoteTaskItem(
                    id = t.id, safarName = c.name, dateFolder = t.title,
                    hijriDate = t.hijriDate.ifBlank { null }, stage = t.stage.id, status = t.stage.id,
                    dueDate = t.dueDate.ifBlank { null }, editorName = t.effectiveVideoEditor,
                    videoEditor = t.effectiveVideoEditor, photoStage = t.photoStage.id,
                    photoEditorName = t.effectivePhotoEditor, photoUploaded = t.isPhotosDelivered,
                    updatedAt = isoDate, isPresent = t.isPresent, isMissing = t.isMissing,
                    notes = t.notes, driveFolderUrl = t.driveFolderUrl,
                    renderDuration = t.renderDurationSeconds, renderVideoCount = t.renderVideoCount,
                    renderSizeBytes = t.renderSizeBytes, prprojModifiedAt = t.prprojModifiedAt,
                    renderedAt = t.renderedAt, stageTimestamps = t.stageTimestamps
                )
            }
        }

        return latestRawSnapshot.copy(
            safars = remoteSafars,
            tasks = remoteTasks,
            stageOverrides = updatedOverrides,
            activeSafar = active,
            updatedAt = isoDate,
            source = "android_app"
        )
    }

    private suspend fun pushSnapshotToCloudSync(payload: RemoteSnapshotPayload): Boolean {
        return if (supabaseClient.pushSnapshot(payload).isSuccess) {
            localStore?.setPendingPush(false)
            realtimeClient.sendBroadcast(
                "realtime:one_tap_safar_tracker",
                "request_snapshot",
                JSONObject().apply { put("updatedAt", payload.updatedAt ?: currentIsoTimestamp()) }
            )
            _syncState.value = _syncState.value.copy(
                lastSyncedAt = System.currentTimeMillis(),
                pendingMutationsCount = 0
            )
            true
        } else {
            localStore?.setPendingPush(true)
            _syncState.value = _syncState.value.copy(
                pendingMutationsCount = _syncState.value.pendingMutationsCount + 1,
                syncNotice = "Saved offline — will sync when online"
            )
            false
        }
    }

    private fun pushLocalStateToCloud() {
        val payload = buildCurrentSnapshotPayload()
        latestRawSnapshot = payload
        localStore?.saveSnapshot(payload)
        localStore?.setPendingPush(true)
        repositoryScope.launch {
            pushSnapshotToCloudSync(payload)
        }
    }

    private fun recordAudit(safarName: String, dateFolder: String, action: String, fromVal: String, toVal: String, turnaroundMs: Long? = null) {
        val actor = _authUser.value?.name ?: "Mobile Operator"
        localStore?.appendAuditLog(AuditLogEntry(
            id = "${System.currentTimeMillis()}_${dateFolder.hashCode()}", timestamp = System.currentTimeMillis(),
            safarName = safarName, dateFolder = dateFolder, action = action,
            fromValue = fromVal, toValue = toVal, actor = actor, turnaroundMs = turnaroundMs
        ))
        _auditLogs.value = localStore?.getAuditLogs() ?: emptyList()
    }

    val activeCampaign: SafarCampaign?
        get() = _campaigns.value.firstOrNull { it.id == _activeCampaignId.value }
            ?: _campaigns.value.firstOrNull { it.isOngoing }
            ?: _campaigns.value.firstOrNull()

    fun setActiveCampaign(campaignId: String) {
        _activeCampaignId.value = campaignId
        _campaigns.value = _campaigns.value.map { it.copy(isOngoing = (it.id == campaignId)) }
        appContext?.let { SafarWidgetUpdater.updateAllWidgets(it, activeCampaign, _campaigns.value) }
        pushLocalStateToCloud()
    }

    fun updateTaskStage(taskId: String, newStage: Stage) {
        var changed: SafarTask? = null
        var prev: Stage? = null
        var campName = ""
        val now = System.currentTimeMillis()
        _campaigns.value = _campaigns.value.map { c ->
            c.copy(tasks = c.tasks.map { t ->
                if (t.id == taskId) {
                    prev = t.stage; campName = c.name
                    val updatedTs = t.stageTimestamps + (newStage.id to now)
                    t.copy(stage = newStage, stageTimestamps = updatedTs, updatedAt = now).also { changed = it }
                } else t
            })
        }
        changed?.let { t ->
            val key = "${campName}::${t.title}"
            val turnaround = localStore?.getStageEnteredAt(key)?.let { System.currentTimeMillis() - it }?.takeIf { it > 0 }
            localStore?.saveStageEnteredAt(key, System.currentTimeMillis())
            recordAudit(campName, t.title, "Stage Updated", prev?.title.orEmpty(), newStage.title, turnaround)
            appContext?.let { SafarWidgetUpdater.updateAllWidgets(it, activeCampaign, _campaigns.value) }
            pushLocalStateToCloud()
            repositoryScope.launch {
                supabaseClient.broadcastNotification("${t.displayTitle} Updated", "${t.displayTitle} moved to ${newStage.title}")
            }
        }
    }

    fun bulkUpdateTaskStage(taskIds: Set<String>, newStage: Stage) {
        if (taskIds.isEmpty()) return
        val now = System.currentTimeMillis()
        _campaigns.value = _campaigns.value.map { c ->
            c.copy(tasks = c.tasks.map { t ->
                if (t.id in taskIds) {
                    localStore?.saveStageEnteredAt("${c.name}::${t.title}", now)
                    recordAudit(c.name, t.title, "Bulk Stage Update", t.stage.title, newStage.title)
                    val updatedTs = t.stageTimestamps + (newStage.id to now)
                    t.copy(stage = newStage, stageTimestamps = updatedTs, updatedAt = now)
                } else t
            })
        }
        appContext?.let { SafarWidgetUpdater.updateAllWidgets(it, activeCampaign, _campaigns.value) }
        pushLocalStateToCloud()
    }

    fun updateTaskEditor(taskId: String, editorName: String) {
        val clean = editorName.trim()
        _campaigns.value = _campaigns.value.map { c ->
            c.copy(tasks = c.tasks.map { t ->
                if (t.id == taskId) {
                    recordAudit(c.name, t.title, "Editor Assigned", t.effectiveVideoEditor, clean.ifBlank { "Murtaza" })
                    t.copy(videoEditor = clean.ifBlank { null }, updatedAt = System.currentTimeMillis())
                } else t
            })
        }
        pushLocalStateToCloud()
    }

    fun updateTaskDueDate(taskId: String, dueDate: String) {
        _campaigns.value = _campaigns.value.map { c ->
            c.copy(tasks = c.tasks.map { t ->
                if (t.id == taskId) {
                    recordAudit(c.name, t.title, "Due Date Updated", t.dueDate, dueDate)
                    t.copy(dueDate = dueDate.trim(), updatedAt = System.currentTimeMillis())
                } else t
            })
        }
        pushLocalStateToCloud()
    }

    fun updateTaskPhotoStage(taskId: String, newPhotoStage: PhotoStage) {
        var updated: SafarTask? = null
        var campName = ""
        val isUp = (newPhotoStage == PhotoStage.UPLOADED)
        _campaigns.value = _campaigns.value.map { c ->
            c.copy(tasks = c.tasks.map { t ->
                if (t.id == taskId) {
                    campName = c.name
                    recordAudit(c.name, t.title, "Photo Stage", t.photoStage.title, newPhotoStage.title)
                    t.copy(photoStage = newPhotoStage, photoUploaded = isUp, updatedAt = System.currentTimeMillis()).also { updated = it }
                } else t
            })
        }
        pushLocalStateToCloud()
        if (isUp && updated != null) {
            repositoryScope.launch {
                gasClient.markFolderUploaded(campName, updated!!.title, _authUser.value?.name ?: "One Tap Android", getWhatsAppPhone())
                supabaseClient.broadcastNotification("Photos Uploaded", "${updated!!.title} photos marked Uploaded", "photos_uploaded")
            }
        }
    }

    fun batchUpdatePhotoStage(taskIds: Set<String>, newPhotoStage: PhotoStage) {
        if (taskIds.isEmpty()) return
        val isUp = (newPhotoStage == PhotoStage.UPLOADED)
        _campaigns.value = _campaigns.value.map { c ->
            c.copy(tasks = c.tasks.map { t ->
                if (t.id in taskIds) {
                    recordAudit(c.name, t.title, "Batch Photo Stage", t.photoStage.title, newPhotoStage.title)
                    t.copy(photoStage = newPhotoStage, photoUploaded = isUp, updatedAt = System.currentTimeMillis())
                } else t
            })
        }
        pushLocalStateToCloud()
    }

    fun syncDrivePhotoFolders(safarName: String, expectedDates: List<String>) {
        repositoryScope.launch {
            gasClient.getPhotoFolders(safarName, expectedDates).getOrNull()?.let { data ->
                _drivePhotoInfo.value = _drivePhotoInfo.value + data.folders.mapKeys { "${safarName}::${it.key}" }
            }
        }
    }

    fun addManualTask(safarName: String, dateFolder: String, notes: String?) {
        val clean = dateFolder.trim()
        if (safarName.isBlank() || clean.isBlank()) return
        val newTask = SafarTask(
            id = "$safarName::$clean::${System.currentTimeMillis()}", campaignId = safarName,
            title = clean, hijriDate = parseHijriFromFolder(clean, null), stage = Stage.IN_PROGRESS,
            notes = notes?.trim()?.takeIf { it.isNotEmpty() }
        )
        _campaigns.value = _campaigns.value.map { c -> if (c.name == safarName) c.copy(tasks = c.tasks + newTask) else c }
        recordAudit(safarName, clean, "Task Added", "", "Editing")
        pushLocalStateToCloud()
    }

    fun excludeTask(safarName: String, taskId: String, dateFolder: String) {
        latestRawSnapshot = latestRawSnapshot.copy(deletedTasks = (latestRawSnapshot.deletedTasks + "${safarName}::${dateFolder}").distinct())
        _campaigns.value = _campaigns.value.map { c -> if (c.name == safarName) c.copy(tasks = c.tasks.filterNot { it.id == taskId }) else c }
        recordAudit(safarName, dateFolder, "Task Excluded", "", "Removed")
        pushLocalStateToCloud()
    }

    fun toggleSafarArchive(safarName: String, archive: Boolean) {
        _campaigns.value = _campaigns.value.map { c ->
            if (c.name == safarName) {
                if (archive) {
                    val prior = c.tasks.associate { it.title to it.stage.id }
                    c.copy(isArchived = true, isDone = true, archivePriorStages = prior, tasks = c.tasks.map { it.copy(stage = Stage.ALJAMEA_DONE) })
                } else {
                    c.copy(isArchived = false, isDone = false, tasks = c.tasks.map { t ->
                        val restored = c.archivePriorStages[t.title]?.let { Stage.fromId(it) } ?: t.stage
                        t.copy(stage = restored)
                    })
                }
            } else c
        }
        recordAudit(safarName, "All Dates", if (archive) "Safar Archived" else "Safar Restored", "", if (archive) "Archived" else "Active")
        pushLocalStateToCloud()
        realtimeClient.sendBroadcast("realtime:anyshare_realtime_nexus", "safar_status_changed", JSONObject().apply {
            put("safarName", safarName); put("isArchived", archive); put("isDone", archive)
        })
    }

    suspend fun requestOtp(email: String) = gasClient.requestOtp(email)
    suspend fun verifyOtp(email: String, otp: String): Result<AuthUser> {
        val res = gasClient.verifyOtp(email, otp)
        if (res.isSuccess) {
            localStore?.saveAuthUser(res.getOrNull())
            _authUser.value = res.getOrNull()
        }
        return res
    }
    fun signOut() { localStore?.saveAuthUser(null); _authUser.value = null }

    fun getGsUrl(): String = localStore?.getGsUrl() ?: LocalStore.DEFAULT_GS_URL
    fun setGsUrl(url: String) = localStore?.setGsUrl(url) ?: Unit
    fun getWhatsAppPhone(): String = localStore?.getWhatsAppPhone() ?: LocalStore.DEFAULT_WHATSAPP_PHONE
    fun setWhatsAppPhone(phone: String) = localStore?.setWhatsAppPhone(phone) ?: Unit

    suspend fun sendDirectWhatsAppBriefing(campaign: SafarCampaign): Result<Boolean> =
        gasClient.sendWhatsAppAlert(getWhatsAppPhone(), generateWhatsAppBriefingText(campaign))

    fun startOrScheduleRemoteRender(
        safarName: String,
        dateFolders: List<String>,
        delayMinutes: Int = 0,
        addWatermark: Boolean = true,
        muteOriginal: Boolean = false
    ) {
        if (safarName.isBlank() || dateFolders.isEmpty()) return
        val jobId = "mob_${System.currentTimeMillis()}"
        val action = if (delayMinutes > 0) "schedule_batch" else "start_batch"
        _remoteRenderState.value = RemoteRenderJobState(
            jobId = jobId,
            safarName = safarName,
            dateFolders = dateFolders,
            percent = if (delayMinutes > 0) 0 else 5,
            stageText = if (delayMinutes > 0) "Sending schedule ($delayMinutes min) to Desktop…" else "Sending batch render command to Desktop…",
            status = if (delayMinutes > 0) "scheduled" else "running"
        )
        val payload = JSONObject().apply {
            put("jobId", jobId)
            put("itemId", jobId)
            put("action", action)
            put("safarName", safarName)
            put("dateFolders", org.json.JSONArray(dateFolders))
            put("delayMinutes", delayMinutes)
            put("addWatermark", addWatermark)
            put("muteOriginal", muteOriginal)
        }
        realtimeClient.sendBroadcast("realtime:anyshare_realtime_nexus", "render_command", payload)
        recordAudit(
            safarName = safarName,
            dateFolder = dateFolders.joinToString(", "),
            action = if (delayMinutes > 0) "Scheduled Remote Render" else "Started Remote Render",
            fromVal = "",
            toVal = if (delayMinutes > 0) "In $delayMinutes min(s)" else "Immediate"
        )
    }

    fun cancelScheduledRemoteRender(jobId: String) {
        if (jobId.isBlank()) return
        val payload = JSONObject().apply {
            put("jobId", jobId)
            put("action", "cancel_schedule")
        }
        realtimeClient.sendBroadcast("realtime:anyshare_realtime_nexus", "render_command", payload)
        _remoteRenderState.value = _remoteRenderState.value.copy(status = "cancelled", stageText = "Cancelled")
    }

    fun pingDesktopWorkstation() {
        realtimeClient.sendBroadcast("realtime:anyshare_realtime_nexus", "ping_workstation", JSONObject())
    }

    fun generateWhatsAppBriefingText(campaign: SafarCampaign): String = buildString {
        val totalDays = campaign.tasks.size
        val videoDelivered = campaign.deliveredVideosCount
        val pct = campaign.overallPercentage
        append("📋 *ONE TAP STUDIO | SAFAR EXECUTIVE BRIEFING*\n━━━━━━━━━━━━━━━━━━━━\n")
        append("📍 *Safar:* ${campaign.name}\n")
        if (campaign.location.isNotBlank()) append("🌐 *City:* ${campaign.location}\n")
        append("\n")
        if (campaign.is100PercentDone) {
            append("🏆 *MILESTONE REACHED: 100% FULLY DELIVERED!*\n\n")
        } else {
            val filled = (pct / 10).coerceIn(0, 10)
            append("📊 *Video Delivery:* *$pct%*\n`[${"█".repeat(filled)}${"░".repeat(10 - filled)}]`\n\n")
        }
        append("🎬 *Video Pipeline:* $videoDelivered/$totalDays Delivered\n")
        append("📸 *Photo Tracker:* ${campaign.deliveredPhotosCount}/$totalDays Uploaded (${campaign.photoUploadPercentage}%)\n\n")
        append("🗓️ *Date-by-Date Status:*\n")
        campaign.tasks.forEachIndexed { i, t ->
            val icon = when (t.stage) {
                Stage.ALJAMEA_DONE -> "🏛️"
                Stage.UPLOADED -> "✅"
                Stage.UPLOAD_PENDING -> "⏳"
                Stage.IN_PROGRESS -> "⚙️"
                Stage.EDITING_PENDING -> "📝"
            }
            val pBadge = if (t.isPhotosDelivered) "📸✓" else "📸(${t.photoStage.title})"
            append("${i + 1}. $icon *${t.displayTitle}* [${t.stage.title}] — $pBadge\n")
        }
        append("\n━━━━━━━━━━━━━━━━━━━━\n⚡ *One Tap Studio Tracker* • _Real-time Cloud Sync_")
    }

    companion object {
        private val JUNK_SAFAR_REGEX = Regex("""^(?:in[\s_-]?process|pending|to[\s_-]?delete|intel|intelvga|amd|nvidia|system|temp|program|windows|\${'$'}rec|delivery|renders?|output|exports?|dptf|mei)$""", RegexOption.IGNORE_CASE)

        @Volatile
        private var instance: SafarRepository? = null

        fun init(context: Context) {
            if (instance == null) {
                synchronized(this) { if (instance == null) instance = SafarRepository(context.applicationContext) }
            }
        }

        fun getInstance(): SafarRepository = instance ?: synchronized(this) {
            instance ?: SafarRepository(null).also { instance = it }
        }
    }
}
