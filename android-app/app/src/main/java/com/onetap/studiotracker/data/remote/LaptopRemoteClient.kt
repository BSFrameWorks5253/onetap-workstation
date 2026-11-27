package com.onetap.studiotracker.data.remote

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit

enum class RemoteConnState { DISCONNECTED, CONNECTING, CONNECTED, ERROR }

class LaptopRemoteClient {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null

    private val _connState = MutableStateFlow(RemoteConnState.DISCONNECTED)
    val connState: StateFlow<RemoteConnState> = _connState.asStateFlow()

    private val _connectedHost = MutableStateFlow("")
    val connectedHost: StateFlow<String> = _connectedHost.asStateFlow()

    private val _errorText = MutableStateFlow("")
    val errorText: StateFlow<String> = _errorText.asStateFlow()

    private val _latestFrame = MutableStateFlow<Bitmap?>(null)
    val latestFrame: StateFlow<Bitmap?> = _latestFrame.asStateFlow()

    private val _isStreaming = MutableStateFlow(true)
    val isStreaming: StateFlow<Boolean> = _isStreaming.asStateFlow()

    fun connect(ips: List<String>, port: Int, token: String) {
        val candidates = ips.map { it.trim() }.filter { it.isNotBlank() }.distinct()
        if (candidates.isEmpty() || token.isBlank()) {
            _connState.value = RemoteConnState.ERROR
            _errorText.value = if (token.isBlank()) "Waiting for Laptop heartbeat token…" else "No LAN IP available"
            return
        }
        disconnect()
        _connState.value = RemoteConnState.CONNECTING
        _errorText.value = ""
        tryNextHost(candidates, 0, port, token)
    }

    private fun tryNextHost(candidates: List<String>, index: Int, port: Int, token: String) {
        if (index >= candidates.size) {
            _connState.value = RemoteConnState.ERROR
            _errorText.value = "Could not reach laptop on LAN (${candidates.joinToString(", ")}:$port). Ensure phone & laptop are on the same Wi-Fi/Tailscale."
            return
        }
        val ip = candidates[index]
        val url = "ws://$ip:$port/?token=$token"
        val req = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                _connState.value = RemoteConnState.CONNECTED
                _connectedHost.value = "$ip:$port"
                _errorText.value = ""
                if (_isStreaming.value) {
                    ws.send(JSONObject().put("type", "stream").put("enabled", true).toString())
                }
            }

            override fun onMessage(ws: WebSocket, bytes: ByteString) {
                scope.launch(Dispatchers.Default) {
                    try {
                        val arr = bytes.toByteArray()
                        val bmp = BitmapFactory.decodeByteArray(arr, 0, arr.size)
                        if (bmp != null) _latestFrame.value = bmp
                    } catch (_: Throwable) {}
                }
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                if (_connState.value == RemoteConnState.CONNECTING) {
                    tryNextHost(candidates, index + 1, port, token)
                } else {
                    _connState.value = RemoteConnState.ERROR
                    _errorText.value = t.message ?: "Connection lost"
                }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                if (_connState.value != RemoteConnState.ERROR) {
                    _connState.value = RemoteConnState.DISCONNECTED
                }
            }
        })
    }

    fun setStreaming(enabled: Boolean) {
        _isStreaming.value = enabled
        sendJson(JSONObject().put("type", "stream").put("enabled", enabled))
    }

    fun sendMove(dx: Float, dy: Float) {
        sendJson(JSONObject().put("type", "move").put("dx", dx.toInt()).put("dy", dy.toInt()))
    }

    fun sendAbsTap(nx: Float, ny: Float) {
        sendJson(JSONObject().put("type", "abs_tap").put("nx", nx.toDouble()).put("ny", ny.toDouble()))
    }

    fun sendClick(button: String = "left") {
        sendJson(JSONObject().put("type", "click").put("button", button))
    }

    fun sendScroll(delta: Int) {
        sendJson(JSONObject().put("type", "scroll").put("delta", delta))
    }

    fun sendText(text: String) {
        if (text.isNotEmpty()) {
            sendJson(JSONObject().put("type", "text").put("text", text))
        }
    }

    fun sendKey(key: String) {
        sendJson(JSONObject().put("type", "key").put("key", key))
    }

    fun sendPower(action: String) {
        sendJson(JSONObject().put("type", "power").put("action", action))
    }

    private fun sendJson(obj: JSONObject) {
        try {
            webSocket?.send(obj.toString())
        } catch (_: Throwable) {}
    }

    fun disconnect() {
        try {
            webSocket?.close(1000, "Client closed")
        } catch (_: Throwable) {}
        webSocket = null
        _connState.value = RemoteConnState.DISCONNECTED
        _connectedHost.value = ""
    }

    companion object {
        @Volatile private var instance: LaptopRemoteClient? = null
        fun getInstance(): LaptopRemoteClient =
            instance ?: synchronized(this) { instance ?: LaptopRemoteClient().also { instance = it } }
    }
}
