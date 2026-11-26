package com.onetap.studiotracker.data.sync

import com.onetap.studiotracker.data.repository.AuthUser
import com.onetap.studiotracker.data.repository.LocalStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class DrivePhotoFolderInfo(
    val dateFolder: String,
    val safarName: String,
    val isUploaded: Boolean,
    val isDownloaded: Boolean,
    val driveFolderUrl: String?,
    val status: String
)

data class DrivePhotoSyncResult(
    val success: Boolean,
    val folders: Map<String, DrivePhotoFolderInfo> = emptyMap()
)

class GoogleAppsScriptSyncClient(
    private val urlProvider: () -> String = { LocalStore.DEFAULT_GS_URL }
) {
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    private fun postAction(action: String, payload: JSONObject): JSONObject? {
        val url = urlProvider()
        if (!url.startsWith("https://script.google.com")) return null
        val bodyJson = JSONObject(payload.toString()).apply { put("action", action) }
        val request = Request.Builder()
            .url(url)
            .post(bodyJson.toString().toRequestBody("text/plain;charset=utf-8".toMediaType()))
            .build()
        val response = httpClient.newCall(request).execute()
        if (!response.isSuccessful) return null
        val text = response.body?.string() ?: return null
        return JSONObject(text)
    }

    suspend fun getPhotoFolders(safarName: String, expectedDates: List<String>): Result<DrivePhotoSyncResult> =
        withContext(Dispatchers.IO) {
            try {
                val resp = postAction("getPhotoFolders", JSONObject().apply {
                    put("safarName", safarName); put("expectedDates", JSONArray(expectedDates))
                }) ?: return@withContext Result.failure(Exception("GAS endpoint unreachable"))
                val foldersArr = resp.optJSONArray("folders") ?: JSONArray()
                val map = linkedMapOf<String, DrivePhotoFolderInfo>()
                for (i in 0 until foldersArr.length()) {
                    val obj = foldersArr.optJSONObject(i) ?: continue
                    val df = obj.optString("dateFolder")
                    if (df.isNotBlank()) {
                        map[df] = DrivePhotoFolderInfo(
                            dateFolder = df,
                            safarName = obj.optString("safarName", safarName),
                            isUploaded = obj.optBoolean("isUploaded", false),
                            isDownloaded = obj.optBoolean("isDownloaded", false),
                            driveFolderUrl = obj.optString("driveFolderUrl").takeIf { it.isNotBlank() },
                            status = obj.optString("status", "pending")
                        )
                    }
                }
                Result.success(DrivePhotoSyncResult(resp.optBoolean("success", true), map))
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun markFolderUploaded(safarName: String, dateFolder: String, markedBy: String, phone: String): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val resp = postAction("markUploaded", JSONObject().apply {
                    put("safarName", safarName); put("dateFolder", dateFolder); put("markedBy", markedBy); put("phone", phone)
                })
                Result.success(resp?.optBoolean("success", true) == true)
            } catch (e: Exception) { Result.failure(e) }
        }

    suspend fun sendWhatsAppAlert(phone: String, message: String): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val resp = postAction("sendWhatsApp", JSONObject().apply { put("phone", phone); put("message", message) })
                Result.success(resp?.optBoolean("success", false) == true)
            } catch (e: Exception) { Result.failure(e) }
        }

    suspend fun requestOtp(email: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val resp = postAction("sendOtp", JSONObject().apply { put("email", email.trim()) })
                ?: return@withContext Result.failure(Exception("Unable to reach auth server"))
            if (resp.optBoolean("success", false)) Result.success(resp.optString("message", "Code sent to $email"))
            else Result.failure(Exception(resp.optString("error", "Failed to send code")))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun verifyOtp(email: String, otp: String): Result<AuthUser> = withContext(Dispatchers.IO) {
        try {
            val resp = postAction("verifyOtp", JSONObject().apply { put("email", email.trim()); put("otp", otp.trim()) })
                ?: return@withContext Result.failure(Exception("Unable to reach auth server"))
            if (resp.optBoolean("success", false)) {
                val userObj = resp.optJSONObject("user")
                val cleanEmail = userObj?.optString("email", email.trim()) ?: email.trim()
                Result.success(AuthUser(
                    email = cleanEmail,
                    name = userObj?.optString("name", cleanEmail.substringBefore("@")) ?: cleanEmail.substringBefore("@"),
                    username = userObj?.optString("username", cleanEmail.substringBefore("@")) ?: cleanEmail.substringBefore("@"),
                    role = userObj?.optString("role", "member") ?: "member",
                    token = resp.optString("token").takeIf { it.isNotBlank() }
                ))
            } else {
                Result.failure(Exception(resp.optString("error", "Invalid verification code")))
            }
        } catch (e: Exception) { Result.failure(e) }
    }
}
