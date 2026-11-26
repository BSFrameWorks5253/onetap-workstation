package com.onetap.studiotracker.util

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File

object WhatsAppShareManager {
    fun shareTextMessage(context: Context, message: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, message)
            setPackage("com.whatsapp")
        }
        try {
            context.startActivity(intent)
        } catch (_: Exception) {
            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, message)
            }, "Share Safar Briefing"))
        }
    }

    fun shareImage(context: Context, imageFile: File, caption: String) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", imageFile)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, caption)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            setPackage("com.whatsapp")
        }
        try {
            context.startActivity(intent)
        } catch (_: Exception) {
            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, caption)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }, "Share Infographic"))
        }
    }
}
