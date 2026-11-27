package com.onetap.studiotracker.data.sync

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

sealed class RealtimeEvent {
    data class SnapshotReceived(val payload: RemoteSnapshotPayload) : RealtimeEvent()
    data class SafarStatusChanged(val safarName: String, val isArchived: Boolean, val isDone: Boolean) : RealtimeEvent()
    data class NotificationReceived(val title: String, val message: String, val type: String) : RealtimeEvent()
    data class BatchRenderCompleted(
        val title: String,
        val safarName: String,
        val totalVideos: Int,
        val totalDurationMinutes: Int,
        val dateFolders: List<String>,
        val message: String
    ) : RealtimeEvent()
    data class RenderTelemetry(
        val jobId: String,
        val safarName: String,
        val percent: Int,
        val stage: String,
        val status: String,
        val scheduledFor: String = ""
    ) : RealtimeEvent()
    data class RenderLog(val jobId: String, val level: String, val message: String) : RealtimeEvent()
    data class WorkstationHeartbeat(val label: String, val timestampMs: Long) : RealtimeEvent()
    data object RescanRequested : RealtimeEvent()
}

class SupabaseRealtimeClient(
    private val baseUrl: String = SupabaseSyncClient.DEFAULT_URL,
    private val apiKey: String = SupabaseSyncClient.DEFAULT_KEY
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true; isLenient = true; encodeDefaults = true }
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(25, TimeUnit.SECONDS)
        .build()

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _events = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 32)
    val events: SharedFlow<RealtimeEvent> = _events.asSharedFlow()

    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null
    private val refCounter = AtomicInteger(1)
    private var reconnectAttempt = 0
    private var isStarted = false

    fun connect() {
        if (isStarted && _isConnected.value) return
        isStarted = true
        openSocket()
    }

    private fun openSocket() {
        val wsBase = baseUrl.replace("https://", "wss://").replace("http://", "ws://").trimEnd('/')
        val wsUrl = "$wsBase/realtime/v1/websocket?apikey=$apiKey&vsn=1.0.0"
        val request = Request.Builder().url(wsUrl).build()

        webSocket?.cancel()
        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                reconnectAttempt = 0
                _isConnected.value = true
                joinChannels(webSocket)
                startHeartbeat(webSocket)
            }
            override fun onMessage(webSocket: WebSocket, text: String) = handleIncomingMessage(text)
            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false; heartbeatJob?.cancel()
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false; heartbeatJob?.cancel()
                if (isStarted) scheduleReconnect()
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w("SupabaseRealtime", "WS failure: ${t.message}")
                _isConnected.value = false; heartbeatJob?.cancel()
                if (isStarted) scheduleReconnect()
            }
        })
    }

    private fun joinChannels(ws: WebSocket) {
        ws.send(JSONObject().apply {
            put("topic", "realtime:safar_tracker_db_changes")
            put("event", "phx_join")
            put("ref", refCounter.getAndIncrement().toString())
            put("payload", JSONObject().apply {
                put("config", JSONObject().apply {
                    put("postgres_changes", JSONArray().apply {
                        put(JSONObject().apply {
                            put("event", "*"); put("schema", "public"); put("table", "safar_tracker_snapshots")
                        })
                    })
                })
            })
        }.toString())

        listOf("realtime:one_tap_safar_tracker", "realtime:anyshare_realtime_nexus").forEach { topic ->
            ws.send(JSONObject().apply {
                put("topic", topic); put("event", "phx_join"); put("ref", refCounter.getAndIncrement().toString())
                put("payload", JSONObject().apply {
                    put("config", JSONObject().apply { put("broadcast", JSONObject().apply { put("self", false) }) })
                })
            }.toString())
        }
    }

    private fun startHeartbeat(ws: WebSocket) {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive && _isConnected.value) {
                delay(25_000)
                ws.send(JSONObject().apply {
                    put("topic", "phoenix"); put("event", "heartbeat"); put("payload", JSONObject())
                    put("ref", refCounter.getAndIncrement().toString())
                }.toString())
            }
        }
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            reconnectAttempt++
            delay((2000L * reconnectAttempt).coerceAtMost(30_000L))
            if (isStarted && !_isConnected.value) openSocket()
        }
    }

    fun sendBroadcast(topic: String, event: String, payloadJson: JSONObject) {
        webSocket?.send(JSONObject().apply {
            put("topic", topic); put("event", "broadcast"); put("ref", refCounter.getAndIncrement().toString())
            put("payload", JSONObject().apply {
                put("type", "broadcast"); put("event", event); put("payload", payloadJson)
            })
        }.toString())
    }

    fun requestSnapshotFromPeers() {
        sendBroadcast("realtime:one_tap_safar_tracker", "request_snapshot",
            JSONObject().apply { put("requestedAt", System.currentTimeMillis().toString()) })
    }

    private fun handleIncomingMessage(text: String) {
        try {
            val root = JSONObject(text)
            val topic = root.optString("topic")
            val event = root.optString("event")
            val payload = root.optJSONObject("payload") ?: return
            when {
                event == "postgres_changes" -> {
                    val snapshotObj = payload.optJSONObject("data")?.optJSONObject("record")?.optJSONObject("snapshot")
                    if (snapshotObj != null) {
                        _events.tryEmit(RealtimeEvent.SnapshotReceived(json.decodeFromString(snapshotObj.toString())))
                    }
                }
                event == "broadcast" && topic == "realtime:one_tap_safar_tracker" -> {
                    val innerEvent = payload.optString("event")
                    val innerPayload = payload.optJSONObject("payload")
                    if (innerEvent == "snapshot") {
                        innerPayload?.optJSONObject("snapshot")?.let {
                            _events.tryEmit(RealtimeEvent.SnapshotReceived(json.decodeFromString(it.toString())))
                        }
                    } else if (innerEvent == "reset_and_rescan") {
                        _events.tryEmit(RealtimeEvent.RescanRequested)
                    }
                }
                event == "broadcast" && topic == "realtime:anyshare_realtime_nexus" -> {
                    val innerEvent = payload.optString("event")
                    val innerPayload = payload.optJSONObject("payload") ?: JSONObject()
                    if (innerEvent == "website_user_notification") {
                        val msg = innerPayload.optString("message", "")
                        if (msg.isNotBlank()) {
                            _events.tryEmit(RealtimeEvent.NotificationReceived(
                                innerPayload.optString("title", "Studio Update"), msg, innerPayload.optString("type", "update")
                            ))
                        }
                    } else if (innerEvent == "batch_render_summary") {
                        val safar = innerPayload.optString("safarName", "")
                        val title = innerPayload.optString("title", "Batch Render Complete")
                        val totalVideos = innerPayload.optInt("totalVideos", 1)
                        val totalMins = innerPayload.optInt("totalDurationMinutes", 0)
                        val eventsArr = innerPayload.optJSONArray("events")
                        val folders = mutableListOf<String>()
                        if (eventsArr != null) {
                            for (i in 0 until eventsArr.length()) {
                                val df = eventsArr.optJSONObject(i)?.optString("dateFolder", "").orEmpty()
                                if (df.isNotBlank()) folders.add(df)
                            }
                        }
                        val fallbackMsg = innerPayload.optString("message", "")
                        val formattedMsg = if (folders.isNotEmpty()) {
                            "${safar.ifBlank { "Safar" }} • Dates: ${folders.joinToString(", ")}" +
                                if (totalMins > 0) " (${totalMins}m)" else ""
                        } else fallbackMsg
                        if (formattedMsg.isNotBlank()) {
                            _events.tryEmit(RealtimeEvent.BatchRenderCompleted(title, safar, totalVideos, totalMins, folders, formattedMsg))
                        }
                    } else if (innerEvent == "render_completed") {
                        val safar = innerPayload.optString("safarName", "")
                        val totalVideos = innerPayload.optInt("totalVideos", 1)
                        val dfArr = innerPayload.optJSONArray("dateFolders")
                        val folders = mutableListOf<String>()
                        if (dfArr != null) {
                            for (i in 0 until dfArr.length()) {
                                val df = dfArr.optString(i, "")
                                if (df.isNotBlank()) folders.add(df)
                            }
                        }
                        val msg = if (folders.isNotEmpty()) {
                            "${safar.ifBlank { "Safar" }} • Dates: ${folders.joinToString(", ")}"
                        } else {
                            "${safar.ifBlank { "Desktop" }} render complete ($totalVideos video${if (totalVideos == 1) "" else "s"})"
                        }
                        _events.tryEmit(RealtimeEvent.BatchRenderCompleted("Render Complete", safar, totalVideos, 0, folders, msg))
                    } else if (innerEvent == "render_telemetry") {
                        _events.tryEmit(RealtimeEvent.RenderTelemetry(
                            jobId = innerPayload.optString("jobId", innerPayload.optString("itemId", "")),
                            safarName = innerPayload.optString("safarName", ""),
                            percent = innerPayload.optInt("percent", 0),
                            stage = innerPayload.optString("stage", ""),
                            status = innerPayload.optString("status", "running"),
                            scheduledFor = innerPayload.optString("scheduledFor", "")
                        ))
                    } else if (innerEvent == "render_log") {
                        val msg = innerPayload.optString("message", "")
                        if (msg.isNotBlank()) {
                            _events.tryEmit(RealtimeEvent.RenderLog(
                                jobId = innerPayload.optString("jobId", ""),
                                level = innerPayload.optString("level", "warn"),
                                message = msg
                            ))
                        }
                    } else if (innerEvent == "workstation_heartbeat") {
                        _events.tryEmit(RealtimeEvent.WorkstationHeartbeat(
                            label = innerPayload.optString("label", "Studio PC"),
                            timestampMs = System.currentTimeMillis()
                        ))
                    } else if (innerEvent == "safar_status_changed") {
                        val name = innerPayload.optString("safarName", "")
                        if (name.isNotBlank()) {
                            _events.tryEmit(RealtimeEvent.SafarStatusChanged(
                                name, innerPayload.optBoolean("isArchived", false), innerPayload.optBoolean("isDone", false)
                            ))
                        }
                    }
                }
            }
        } catch (_: Throwable) {}
    }
}
