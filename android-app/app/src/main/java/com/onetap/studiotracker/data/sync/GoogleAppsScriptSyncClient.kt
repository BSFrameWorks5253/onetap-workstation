package com.onetap.studiotracker.data.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class GoogleAppsScriptSyncClient(
    private val scriptUrl: String = "https://script.google.com/macros/s/AKfycbzz5U5zKAD6ccRzZu_oDqVZetmMV09hEUTBQW__aFtC56zNI2ZCC7rB4-08Tq_AygWBUg/exec"
) {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    suspend fun markFolderUploaded(safarName: String, dateFolder: String, markedBy: String = "One Tap Android"): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("action", "markUploaded")
                put("safarName", safarName)
                put("dateFolder", dateFolder)
                put("markedBy", markedBy)
            }

            val request = Request.Builder()
                .url(scriptUrl)
                .post(json.toString().toRequestBody("text/plain;charset=utf-8".toMediaType()))
                .build()

            val response = httpClient.newCall(request).execute()
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPhotoFolders(safarName: String, expectedDates: List<String>): Result<String> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("action", "getPhotoFolders")
                put("safarName", safarName)
                put("expectedDates", JSONArray(expectedDates))
            }

            val request = Request.Builder()
                .url(scriptUrl)
                .post(json.toString().toRequestBody("text/plain;charset=utf-8".toMediaType()))
                .build()

            val response = httpClient.newCall(request).execute()
            val body = response.body?.string() ?: ""
            Result.success(body)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
