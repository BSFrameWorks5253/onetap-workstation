package com.onetap.studiotracker.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import com.onetap.studiotracker.data.models.SafarCampaign
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object InfographicBitmapRenderer {
    fun generateCampaignInfographic(context: Context, campaign: SafarCampaign): File {
        val width = 1080
        val height = (960 + (campaign.tasks.size * 68)).coerceAtLeast(1150)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        canvas.drawColor(Color.parseColor("#F8FAFC"))
        val isDone = campaign.is100PercentDone
        canvas.drawRect(0f, 0f, width.toFloat(), 14f, Paint().apply {
            color = if (isDone) Color.parseColor("#10B981") else Color.parseColor("#4F46E5")
        })

        canvas.drawText("ONE TAP STUDIO  •  SAFAR PRODUCTION BRIEFING", 60f, 84f, Paint().apply {
            color = Color.parseColor("#4F46E5"); textSize = 26f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        })
        canvas.drawText(campaign.name, 60f, 146f, Paint().apply {
            color = Color.parseColor("#0F172A"); textSize = 44f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        })
        canvas.drawText("${campaign.totalDates} Scheduled Dates", 60f, 192f, Paint().apply {
            color = Color.parseColor("#64748B"); textSize = 25f; isAntiAlias = true
        })

        val bannerRect = RectF(60f, 232f, (width - 60).toFloat(), 370f)
        canvas.drawRoundRect(bannerRect, 20f, 20f, Paint().apply {
            color = if (isDone) Color.parseColor("#ECFDF5") else Color.WHITE; isAntiAlias = true
        })
        canvas.drawRoundRect(bannerRect, 20f, 20f, Paint().apply {
            color = if (isDone) Color.parseColor("#10B981") else Color.parseColor("#E2E8F0")
            style = Paint.Style.STROKE; strokeWidth = 3f; isAntiAlias = true
        })
        canvas.drawText("${campaign.overallPercentage}%", 96f, 315f, Paint().apply {
            color = if (isDone) Color.parseColor("#059669") else Color.parseColor("#4F46E5")
            textSize = 54f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        })
        canvas.drawText(if (isDone) "100% DELIVERED & ARCHIVED" else "OVERALL VIDEO DELIVERY", 270f, 298f, Paint().apply {
            color = Color.parseColor("#0F172A"); textSize = 28f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        })
        canvas.drawText(
            "${campaign.deliveredVideosCount}/${campaign.totalDates} videos • Photos ${campaign.deliveredPhotosCount}/${campaign.totalDates}",
            270f, 336f, Paint().apply { color = Color.parseColor("#64748B"); textSize = 23f; isAntiAlias = true }
        )

        var y = 430f
        val rowBg = Paint().apply { color = Color.WHITE; isAntiAlias = true }
        val rowBorder = Paint().apply { color = Color.parseColor("#E2E8F0"); style = Paint.Style.STROKE; strokeWidth = 2f; isAntiAlias = true }
        val titlePaint = Paint().apply { color = Color.parseColor("#0F172A"); textSize = 24f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true }
        val stagePaint = Paint().apply { textSize = 21f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true }
        val dotPaint = Paint().apply { isAntiAlias = true }

        campaign.tasks.forEachIndexed { idx, t ->
            val rect = RectF(60f, y, (width - 60).toFloat(), y + 54f)
            canvas.drawRoundRect(rect, 12f, 12f, rowBg)
            canvas.drawRoundRect(rect, 12f, 12f, rowBorder)
            val c = Color.parseColor(t.stage.hexColor)
            dotPaint.color = c
            canvas.drawCircle(90f, y + 27f, 9f, dotPaint)
            canvas.drawText("${idx + 1}. ${t.title}", 118f, y + 35f, titlePaint)
            stagePaint.color = c
            val st = t.stage.title.uppercase(Locale.ROOT)
            canvas.drawText(st, (width - 90).toFloat() - stagePaint.measureText(st), y + 35f, stagePaint)
            y += 66f
        }

        val ts = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
        canvas.drawText("Generated $ts  •  One Tap Studio Tracker", 60f, height - 42f, Paint().apply {
            color = Color.parseColor("#94A3B8"); textSize = 21f; isAntiAlias = true
        })

        val dir = File(context.cacheDir, "briefings").apply { if (!exists()) mkdirs() }
        val file = File(dir, "safar_briefing_${System.currentTimeMillis()}.png")
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        return file
    }
}
