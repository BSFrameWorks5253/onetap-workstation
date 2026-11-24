package com.onetap.studiotracker.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

data class AppUpdateInfo(
    val latestVersion: String,
    val versionCode: Int,
    val downloadUrl: String,
    val changelog: String,
    val isUpdateAvailable: Boolean
)

object UpdateManager {

    const val CURRENT_APP_VERSION = "26.11.46.01"

    private const val GITHUB_REPO = "BSFrameWorks5253/onetap-workstation"
    private const val RAW_VERSION_URL =
        "https://raw.githubusercontent.com/$GITHUB_REPO/main/android-app/version.json"
    private const val GITHUB_API_URL =
        "https://api.github.com/repos/$GITHUB_REPO/releases/latest"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .build()

    fun getInstalledVersion(context: Context? = null): String {
        return try {
            if (context != null) {
                val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
                pInfo.versionName ?: com.onetap.studiotracker.BuildConfig.VERSION_NAME
            } else {
                com.onetap.studiotracker.BuildConfig.VERSION_NAME
            }
        } catch (_: Throwable) {
            com.onetap.studiotracker.BuildConfig.VERSION_NAME
        }
    }

    suspend fun checkForUpdates(context: Context? = null): Result<AppUpdateInfo> = withContext(Dispatchers.IO) {
        try {
            val installedVersion = getInstalledVersion(context)
            // First try raw version.json for instant updates
            var version: String = installedVersion
            var code = 261101
            var downloadUrl = ""
            var changelog = ""

            try {
                val req = Request.Builder().url(RAW_VERSION_URL).build()
                val resp = httpClient.newCall(req).execute()
                if (resp.isSuccessful) {
                    val body = resp.body?.string() ?: ""
                    val json = JSONObject(body)
                    version = json.optString("version", installedVersion)
                    code = json.optInt("versionCode", 261101)
                    downloadUrl = json.optString("downloadUrl", "")
                    changelog = json.optString("changelog", "Performance improvements & bug fixes.")
                }
            } catch (_: Exception) {
                // Fallback to GitHub Release API
                val apiReq = Request.Builder()
                    .url(GITHUB_API_URL)
                    .header("Accept", "application/vnd.github.v3+json")
                    .build()
                val apiResp = httpClient.newCall(apiReq).execute()
                if (apiResp.isSuccessful) {
                    val apiBody = apiResp.body?.string() ?: ""
                    val apiJson = JSONObject(apiBody)
                    val tagName = apiJson.optString("tag_name", "").removePrefix("v")
                    if (tagName.isNotBlank()) {
                        version = tagName
                    }
                    changelog = apiJson.optString("body", "Autonomous Release Build.")
                    val assets = apiJson.optJSONArray("assets")
                    if (assets != null && assets.length() > 0) {
                        for (i in 0 until assets.length()) {
                            val asset = assets.getJSONObject(i)
                            val name = asset.optString("name", "")
                            if (name.endsWith(".apk")) {
                                downloadUrl = asset.optString("browser_download_url", "")
                                break
                            }
                        }
                    }
                }
            }

            val isAvailable = isNewer(version, installedVersion)
            Result.success(
                AppUpdateInfo(
                    latestVersion = version,
                    versionCode = code,
                    downloadUrl = downloadUrl,
                    changelog = changelog,
                    isUpdateAvailable = isAvailable
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun downloadAndInstallApk(
        context: Context,
        downloadUrl: String,
        targetVersion: String,
        onProgress: (Float) -> Unit
    ): Result<File> = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder().url(downloadUrl).build()
            val resp = httpClient.newCall(req).execute()
            if (!resp.isSuccessful) {
                return@withContext Result.failure(Exception("Failed to download APK: HTTP ${resp.code}"))
            }

            val body = resp.body ?: return@withContext Result.failure(Exception("Empty download body"))
            val contentLength = body.contentLength()

            val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.cacheDir
            if (!dir.exists()) dir.mkdirs()
            val apkFile = File(dir, "OneTapStudio-v$targetVersion.apk")

            body.byteStream().use { input ->
                FileOutputStream(apkFile).use { output ->
                    val buffer = ByteArray(8192)
                    var bytesRead: Int
                    var totalRead = 0L

                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        output.write(buffer, 0, bytesRead)
                        totalRead += bytesRead
                        if (contentLength > 0) {
                            val progress = (totalRead.toFloat() / contentLength).coerceIn(0f, 1f)
                            onProgress(progress)
                        }
                    }
                    output.flush()
                }
            }

            // Launch package installer
            withContext(Dispatchers.Main) {
                launchApkInstaller(context, apkFile)
            }

            Result.success(apkFile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun launchApkInstaller(context: Context, apkFile: File) {
        val contentUri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            apkFile
        )

        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(contentUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        context.startActivity(installIntent)
    }

    fun isNewer(remoteVersion: String, localVersion: String): Boolean {
        val rParts = remoteVersion.split(".").mapNotNull { it.trim().toIntOrNull() }
        val lParts = localVersion.split(".").mapNotNull { it.trim().toIntOrNull() }

        val maxLen = maxOf(rParts.size, lParts.size)
        for (i in 0 until maxLen) {
            val r = rParts.getOrElse(i) { 0 }
            val l = lParts.getOrElse(i) { 0 }
            if (r > l) return true
            if (r < l) return false
        }
        return false
    }
}
