package com.onetap.studiotracker.data.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class SupabaseSyncClient(
    private val baseUrl: String = DEFAULT_URL,
    private val apiKey: String = DEFAULT_KEY
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .writeTimeout(12, TimeUnit.SECONDS)
        .build()

    suspend fun fetchLatestSnapshot(): Result<RemoteSnapshotPayload?> = withContext(Dispatchers.IO) {
        try {
            val url = "$baseUrl/rest/v1/safar_tracker_snapshots?id=eq.primary&select=id,snapshot,updated_at"
            val request = Request.Builder()
                .url(url)
                .header("apikey", apiKey)
                .header("Authorization", "Bearer $apiKey")
                .header("Accept", "application/json")
                .get()
                .build()
            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                return@withContext Result.failure(Exception("Supabase HTTP ${response.code}"))
            }
            val body = response.body?.string() ?: return@withContext Result.success(null)
            val rows = json.decodeFromString<List<RemoteSnapshotRow>>(body)
            Result.success(rows.firstOrNull()?.snapshot)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun pushSnapshot(payload: RemoteSnapshotPayload): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val url = "$baseUrl/rest/v1/safar_tracker_snapshots"
            val row = RemoteSnapshotRow(id = "primary", snapshot = payload, updated_at = payload.updatedAt)
            val jsonBody = json.encodeToString(row)
            val request = Request.Builder()
                .url(url)
                .header("apikey", apiKey)
                .header("Authorization", "Bearer $apiKey")
                .header("Content-Type", "application/json")
                .header("Prefer", "resolution=merge-duplicates")
                .post(jsonBody.toRequestBody("application/json".toMediaType()))
                .build()
            val response = httpClient.newCall(request).execute()
            if (response.isSuccessful) Result.success(true)
            else Result.failure(Exception("Upsert failed: ${response.code}"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun broadcastNotification(
        title: String,
        message: String,
        type: String = "mobile_status_update"
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("title", title)
                put("message", message)
                put("type", type)
                put("timestamp", System.currentTimeMillis().toString())
            }
            val envelope = JSONObject().apply {
                put("messages", JSONArray().apply {
                    put(JSONObject().apply {
                        put("topic", "realtime:anyshare_realtime_nexus")
                        put("event", "website_user_notification")
                        put("payload", payload)
                    })
                })
            }
            val request = Request.Builder()
                .url("$baseUrl/realtime/v1/api/broadcast")
                .header("apikey", apiKey)
                .header("Authorization", "Bearer $apiKey")
                .header("Content-Type", "application/json")
                .post(envelope.toString().toRequestBody("application/json".toMediaType()))
                .build()
            val response = httpClient.newCall(request).execute()
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    companion object {
        const val DEFAULT_URL = "https://dubscvthmkgkeiqdladp.supabase.co"
        const val DEFAULT_KEY = "sb_publishable_kYApNvq2_6HAfNwJb8hW1g_7iLMSVyk"
    }
}
