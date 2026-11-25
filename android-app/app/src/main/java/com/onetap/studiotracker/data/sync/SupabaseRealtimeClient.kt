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
    data object RescanRequested : RealtimeEvent()
}

/**
 * Phoenix-protocol WebSocket client for Supabase Realtime.
 * Mirrors safar-tracker-web's 3 realtime channels:
 * - realtime:safar_tracker_db_changes (postgres_changes on safar_tracker_snapshots)
 * - realtime:one_tap_safar_tracker (broadcast snapshot / request_snapshot)
 * - realtime:anyshare_realtime_nexus (broadcast notifications & status events)
 */
class SupabaseRealtimeClient(
    private val baseUrl: String = SupabaseSyncClient.DEFAULT_URL,
    private val apiKey: String = SupabaseSyncClient.DEFAULT_KEY
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

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

    fun disconnect() {
        isStarted = false
        heartbeatJob?.cancel()
        reconnectJob?.cancel()
        webSocket?.close(1000, "Client disconnected")
        webSocket = null
        _isConnected.value = false
    }

    private fun openSocket() {
        val wsBase = baseUrl
            .replace("https://", "wss://")
            .replace("http://", "ws://")
            .trimEnd('/')
        val wsUrl = "$wsBase/realtime/v1/websocket?apikey=$apiKey&vsn=1.0.0"

        val request = Request.Builder()
            .url(wsUrl)
            .build()

        webSocket?.cancel()
        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("SupabaseRealtime", "WebSocket connected")
                reconnectAttempt = 0
                _isConnected.value = true
                joinChannels(webSocket)
                startHeartbeat(webSocket)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleIncomingMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false
                heartbeatJob?.cancel()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false
                heartbeatJob?.cancel()
                if (isStarted) scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w("SupabaseRealtime", "WebSocket failure: ${t.message}")
                _isConnected.value = false
                heartbeatJob?.cancel()
                if (isStarted) scheduleReconnect()
            }
        })
    }

    private fun joinChannels(ws: WebSocket) {
        // 1. Postgres changes channel
        val dbJoin = JSONObject().apply {
            put("topic", "realtime:safar_tracker_db_changes")
            put("event", "phx_join")
            put("ref", refCounter.getAndIncrement().toString())
            put("payload", JSONObject().apply {
                put("config", JSONObject().apply {
                    put("postgres_changes", JSONArray().apply {
                        put(JSONObject().apply {
                            put("event", "*")
                            put("schema", "public")
                            put("table", "safar_tracker_snapshots")
                        })
                    })
                })
            })
        }
        ws.send(dbJoin.toString())

        // 2. Tracker snapshot broadcast channel
        val trackerJoin = JSONObject().apply {
            put("topic", "realtime:one_tap_safar_tracker")
            put("event", "phx_join")
            put("ref", refCounter.getAndIncrement().toString())
            put("payload", JSONObject().apply {
                put("config", JSONObject().apply {
                    put("broadcast", JSONObject().apply {
                        put("self", false)
                    })
                })
            })
        }
        ws.send(trackerJoin.toString())

        // 3. Nexus notifications & safar status channel
        val nexusJoin = JSONObject().apply {
            put("topic", "realtime:anyshare_realtime_nexus")
            put("event", "phx_join")
            put("ref", refCounter.getAndIncrement().toString())
            put("payload", JSONObject().apply {
                put("config", JSONObject().apply {
                    put("broadcast", JSONObject().apply {
                        put("self", false)
                    })
                })
            })
        }
        ws.send(nexusJoin.toString())
    }

    private fun startHeartbeat(ws: WebSocket) {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive && _isConnected.value) {
                delay(25_000)
                val hb = JSONObject().apply {
                    put("topic", "phoenix")
                    put("event", "heartbeat")
                    put("payload", JSONObject())
                    put("ref", refCounter.getAndIncrement().toString())
                }
                ws.send(hb.toString())
            }
        }
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            reconnectAttempt++
            val backoffMs = (2000L * reconnectAttempt).coerceAtMost(30_000L)
            delay(backoffMs)
            if (isStarted && !_isConnected.value) {
                openSocket()
            }
        }
    }

    fun sendBroadcast(topic: String, event: String, payloadJson: JSONObject) {
        val ws = webSocket ?: return
        val frame = JSONObject().apply {
            put("topic", topic)
            put("event", "broadcast")
            put("ref", refCounter.getAndIncrement().toString())
            put("payload", JSONObject().apply {
                put("type", "broadcast")
                put("event", event)
                put("payload", payloadJson)
            })
        }
        ws.send(frame.toString())
    }

    fun requestSnapshotFromPeers() {
        val payload = JSONObject().apply {
            put("requestedAt", System.currentTimeMillis().toString())
        }
        sendBroadcast("realtime:one_tap_safar_tracker", "request_snapshot", payload)
    }

    private fun handleIncomingMessage(text: String) {
        try {
            val root = JSONObject(text)
            val topic = root.optString("topic")
            val event = root.optString("event")
            val payload = root.optJSONObject("payload") ?: return

            when {
                event == "postgres_changes" -> {
                    val data = payload.optJSONObject("data")
                    val record = data?.optJSONObject("record")
                    val snapshotObj = record?.optJSONObject("snapshot")
                    if (snapshotObj != null) {
                        val parsed = json.decodeFromString<RemoteSnapshotPayload>(snapshotObj.toString())
                        _events.tryEmit(RealtimeEvent.SnapshotReceived(parsed))
                    }
                }
                event == "broadcast" && topic == "realtime:one_tap_safar_tracker" -> {
                    val innerEvent = payload.optString("event")
                    val innerPayload = payload.optJSONObject("payload")
                    if (innerEvent == "snapshot") {
                        val snapshotObj = innerPayload?.optJSONObject("snapshot")
                        if (snapshotObj != null) {
                            val parsed = json.decodeFromString<RemoteSnapshotPayload>(snapshotObj.toString())
                            _events.tryEmit(RealtimeEvent.SnapshotReceived(parsed))
                        }
                    } else if (innerEvent == "reset_and_rescan") {
                        _events.tryEmit(RealtimeEvent.RescanRequested)
                    }
                }
                event == "broadcast" && topic == "realtime:anyshare_realtime_nexus" -> {
                    val innerEvent = payload.optString("event")
                    val innerPayload = payload.optJSONObject("payload") ?: JSONObject()
                    when (innerEvent) {
                        "website_user_notification" -> {
                            val title = innerPayload.optString("title", "Studio Update")
                            val msg = innerPayload.optString("message", "")
                            val type = innerPayload.optString("type", "update")
                            if (msg.isNotBlank()) {
                                _events.tryEmit(RealtimeEvent.NotificationReceived(title, msg, type))
                            }
                        }
                        "safar_status_changed" -> {
                            val safarName = innerPayload.optString("safarName", "")
                            if (safarName.isNotBlank()) {
                                _events.tryEmit(
                                    RealtimeEvent.SafarStatusChanged(
                                        safarName = safarName,
                                        isArchived = innerPayload.optBoolean("isArchived", false),
                                        isDone = innerPayload.optBoolean("isDone", false)
                                    )
                                )
                            }
                        }
                    }
                }
            }
        } catch (t: Throwable) {
            Log.w("SupabaseRealtime", "Failed parsing message: ${t.message}")
        }
    }
}
