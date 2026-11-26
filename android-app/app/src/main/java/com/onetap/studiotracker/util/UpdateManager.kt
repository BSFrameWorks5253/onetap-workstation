package com.onetap.studiotracker.util

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.onetap.studiotracker.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
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
    private const val GITHUB_REPO = "BSFrameWorks5253/onetap-workstation"
    private const val RAW_VERSION_URL = "https://raw.githubusercontent.com/$GITHUB_REPO/main/android-app/version.json"
    private const val GITHUB_API_URL = "https://api.github.com/repos/$GITHUB_REPO/releases?per_page=15"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    fun getInstalledVersion(context: Context? = null): String = try {
        context?.packageManager?.getPackageInfo(context.packageName, 0)?.versionName ?: BuildConfig.VERSION_NAME
    } catch (_: Throwable) { BuildConfig.VERSION_NAME }

    fun getInstalledVersionCode(context: Context? = null): Long = try {
        val pInfo = context?.packageManager?.getPackageInfo(context.packageName, 0)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            pInfo?.longVersionCode ?: BuildConfig.VERSION_CODE.toLong()
        } else {
            @Suppress("DEPRECATION")
            pInfo?.versionCode?.toLong() ?: BuildConfig.VERSION_CODE.toLong()
        }
    } catch (_: Throwable) { BuildConfig.VERSION_CODE.toLong() }

    suspend fun checkForUpdates(context: Context? = null): Result<AppUpdateInfo> = withContext(Dispatchers.IO) {
        try {
            val installedVersion = getInstalledVersion(context)
            val installedCode = getInstalledVersionCode(context)
            var version = installedVersion
            var code = installedCode.toInt()
            var downloadUrl = ""
            var changelog = ""

            try {
                val resp = httpClient.newCall(Request.Builder().url(RAW_VERSION_URL).build()).execute()
                if (resp.isSuccessful) {
                    val json = JSONObject(resp.body?.string() ?: "{}")
                    version = json.optString("version", installedVersion)
                    code = json.optInt("versionCode", installedCode.toInt())
                    downloadUrl = json.optString("downloadUrl", "")
                    changelog = json.optString("changelog", "One Tap Mobile update available.")
                }
            } catch (_: Exception) {}

            if (downloadUrl.isBlank()) {
                val apiResp = httpClient.newCall(
                    Request.Builder().url(GITHUB_API_URL).header("Accept", "application/vnd.github.v3+json").build()
                ).execute()
                if (apiResp.isSuccessful) {
                    val releasesArr = JSONArray(apiResp.body?.string() ?: "[]")
                    for (rIdx in 0 until releasesArr.length()) {
                        val rel = releasesArr.optJSONObject(rIdx) ?: continue
                        if (rel.optBoolean("draft", false)) continue
                        val tName = rel.optString("tag_name", "")
                        val assets = rel.optJSONArray("assets") ?: continue
                        var apkUrl = ""
                        for (i in 0 until assets.length()) {
                            val asset = assets.optJSONObject(i) ?: continue
                            if (asset.optString("name", "").endsWith(".apk", true)) {
                                apkUrl = asset.optString("browser_download_url", "")
                                break
                            }
                        }
                        if (tName.contains("-Mobile", true) || apkUrl.isNotBlank()) {
                            version = tName.removePrefix("v").replace(Regex("-Mobile$", RegexOption.IGNORE_CASE), "")
                            downloadUrl = apkUrl
                            changelog = rel.optString("body", "Mobile Release $version")
                            break
                        }
                    }
                }
            }

            val isAvailable = downloadUrl.isNotBlank() && (code > installedCode || isNewerVersion(version, installedVersion))
            Result.success(AppUpdateInfo(version, code, downloadUrl, changelog, isAvailable))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun isNewerVersion(remote: String, local: String): Boolean {
        val rParts = remote.split(".").mapNotNull { it.toIntOrNull() }
        val lParts = local.split(".").mapNotNull { it.toIntOrNull() }
        val len = maxOf(rParts.size, lParts.size)
        for (i in 0 until len) {
            val r = rParts.getOrElse(i) { 0 }
            val l = lParts.getOrElse(i) { 0 }
            if (r > l) return true
            if (r < l) return false
        }
        return false
    }

    suspend fun downloadAndInstallApk(
        context: Context,
        downloadUrl: String,
        targetVersion: String,
        onProgress: (Int) -> Unit
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val resp = httpClient.newCall(Request.Builder().url(downloadUrl).build()).execute()
            if (!resp.isSuccessful) return@withContext Result.failure(Exception("Download failed: HTTP ${resp.code}"))
            val body = resp.body ?: return@withContext Result.failure(Exception("Empty APK response"))
            val total = body.contentLength()

            val dir = File(context.cacheDir, "updates").apply { if (!exists()) mkdirs() }
            val apkFile = File(dir, "OneTap_V-$targetVersion.apk")
            body.byteStream().use { input ->
                FileOutputStream(apkFile).use { output ->
                    val buf = ByteArray(8192)
                    var read: Int
                    var downloaded = 0L
                    while (input.read(buf).also { read = it } != -1) {
                        output.write(buf, 0, read)
                        downloaded += read
                        if (total > 0) onProgress(((downloaded * 100) / total).toInt().coerceIn(0, 100))
                    }
                }
            }

            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apkFile)
            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(installIntent)
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
