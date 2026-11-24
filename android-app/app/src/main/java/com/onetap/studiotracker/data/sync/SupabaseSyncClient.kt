package com.onetap.studiotracker.data.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class SupabaseSyncClient(
    private val baseUrl: String = "https://dubscvthmkgkeiqdladp.supabase.co",
    private val apiKey: String = "sb_publishable_kYApNvq2_6HAfNwJb8hW1g_7iLMSVyk"
) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    suspend fun fetchLatestSnapshot(): Result<RemoteSnapshotPayload?> = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
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
                return@withContext Result.failure(Exception("Supabase HTTP Error: ${response.code} ${response.message}"))
            }

            val body = response.body?.string() ?: return@withContext Result.success(null)
            val rows = json.decodeFromString<List<RemoteSnapshotRow>>(body)
            val snapshot = rows.firstOrNull()?.snapshot

            Result.success(snapshot)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun pushSnapshot(payload: RemoteSnapshotPayload): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val url = "$baseUrl/rest/v1/safar_tracker_snapshots"
            val row = RemoteSnapshotRow(
                id = "primary",
                snapshot = payload,
                updated_at = payload.updatedAt
            )
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
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Upsert failed: ${response.code} ${response.message}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun broadcastNotification(title: String, message: String, type: String = "mobile_status_update"): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val url = "$baseUrl/realtime/v1/api/broadcast"
            val broadcastPayload = """
                {
                    "messages": [
                        {
                            "topic": "realtime:anyshare_realtime_nexus",
                            "event": "website_user_notification",
                            "payload": {
                                "title": "$title",
                                "message": "$message",
                                "type": "$type",
                                "timestamp": "${System.currentTimeMillis()}"
                            }
                        }
                    ]
                }
            """.trimIndent()

            val request = Request.Builder()
                .url(url)
                .header("apikey", apiKey)
                .header("Authorization", "Bearer $apiKey")
                .header("Content-Type", "application/json")
                .post(broadcastPayload.toRequestBody("application/json".toMediaType()))
                .build()

            val response = httpClient.newCall(request).execute()
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
