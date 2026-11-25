package com.onetap.studiotracker.data.repository

import android.content.Context
import com.onetap.studiotracker.data.sync.RemoteSnapshotPayload
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class AuthUser(
    val email: String,
    val name: String,
    val username: String,
    val role: String = "member",
    val token: String? = null
)

@Serializable
data class AuditLogEntry(
    val id: String,
    val timestamp: Long,
    val safarName: String,
    val dateFolder: String,
    val action: String,
    val fromValue: String = "",
    val toValue: String = "",
    val actor: String = "Mobile",
    val turnaroundMs: Long? = null
)

class LocalStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("one_tap_safar_store", Context.MODE_PRIVATE)
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    fun saveSnapshot(payload: RemoteSnapshotPayload) {
        try {
            prefs.edit().putString(KEY_SNAPSHOT, json.encodeToString(payload)).apply()
        } catch (_: Throwable) {}
    }

    fun loadSnapshot(): RemoteSnapshotPayload? {
        return try {
            val raw = prefs.getString(KEY_SNAPSHOT, null) ?: return null
            json.decodeFromString<RemoteSnapshotPayload>(raw)
        } catch (_: Throwable) {
            null
        }
    }

    fun setPendingPush(pending: Boolean) {
        prefs.edit().putBoolean(KEY_PENDING_PUSH, pending).apply()
    }

    fun hasPendingPush(): Boolean = prefs.getBoolean(KEY_PENDING_PUSH, false)

    fun saveStageEnteredAt(taskKey: String, timestamp: Long) {
        prefs.edit().putLong("stage_entered_$taskKey", timestamp).apply()
    }

    fun getStageEnteredAt(taskKey: String): Long? {
        val v = prefs.getLong("stage_entered_$taskKey", -1L)
        return if (v > 0L) v else null
    }

    fun appendAuditLog(entry: AuditLogEntry) {
        val current = getAuditLogs().toMutableList()
        current.add(0, entry)
        val trimmed = current.take(150)
        try {
            prefs.edit().putString(KEY_AUDIT_LOGS, json.encodeToString(trimmed)).apply()
        } catch (_: Throwable) {}
    }

    fun getAuditLogs(): List<AuditLogEntry> {
        return try {
            val raw = prefs.getString(KEY_AUDIT_LOGS, null) ?: return emptyList()
            json.decodeFromString<List<AuditLogEntry>>(raw)
        } catch (_: Throwable) {
            emptyList()
        }
    }

    fun saveAuthUser(user: AuthUser?) {
        try {
            if (user == null) {
                prefs.edit().remove(KEY_AUTH_USER).apply()
            } else {
                prefs.edit().putString(KEY_AUTH_USER, json.encodeToString(user)).apply()
            }
        } catch (_: Throwable) {}
    }

    fun loadAuthUser(): AuthUser? {
        return try {
            val raw = prefs.getString(KEY_AUTH_USER, null) ?: return null
            json.decodeFromString<AuthUser>(raw)
        } catch (_: Throwable) {
            null
        }
    }

    fun getGsUrl(): String =
        prefs.getString(KEY_GS_URL, null)?.takeIf { it.isNotBlank() } ?: DEFAULT_GS_URL

    fun setGsUrl(url: String) {
        val clean = url.trim()
        if (clean.isEmpty()) prefs.edit().remove(KEY_GS_URL).apply()
        else prefs.edit().putString(KEY_GS_URL, clean).apply()
    }

    fun getWhatsAppPhone(): String =
        prefs.getString(KEY_WHATSAPP_PHONE, null)?.takeIf { it.isNotBlank() } ?: DEFAULT_WHATSAPP_PHONE

    fun setWhatsAppPhone(phone: String) {
        val clean = phone.trim()
        if (clean.isEmpty()) prefs.edit().remove(KEY_WHATSAPP_PHONE).apply()
        else prefs.edit().putString(KEY_WHATSAPP_PHONE, clean).apply()
    }

    companion object {
        private const val KEY_SNAPSHOT = "cached_snapshot_v2"
        private const val KEY_PENDING_PUSH = "has_pending_push"
        private const val KEY_AUDIT_LOGS = "audit_logs_v1"
        private const val KEY_AUTH_USER = "auth_user_v1"
        private const val KEY_GS_URL = "gs_webapp_url"
        private const val KEY_WHATSAPP_PHONE = "whatsapp_phone"
        const val DEFAULT_GS_URL = "https://script.google.com/macros/s/AKfycbzz5U5zKAD6ccRzZu_oDqVZetmMV09hEUTBQW__aFtC56zNI2ZCC7rB4-08Tq_AygWBUg/exec"
        const val DEFAULT_WHATSAPP_PHONE = "8369811201"
    }
}
