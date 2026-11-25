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
        val baseHeight = 960 + (campaign.tasks.size * 68)
        val height = baseHeight.coerceAtLeast(1150)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // 1. Crisp Light Mode Background
        val bgPaint = Paint().apply {
            color = Color.parseColor("#F8FAFC")
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

        // 2. Top Accent Bar
        val is100Done = campaign.is100PercentDone
        val glowPaint = Paint().apply {
            color = if (is100Done) Color.parseColor("#10B981") else Color.parseColor("#4F46E5")
        }
        canvas.drawRect(0f, 0f, width.toFloat(), 14f, glowPaint)

        // 3. Header Text
        val headerPaint = Paint().apply {
            color = Color.parseColor("#4F46E5")
            textSize = 26f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText("ONE TAP STUDIO  •  SAFAR PRODUCTION BRIEFING", 60f, 84f, headerPaint)

        // 4. Campaign Title
        val titlePaint = Paint().apply {
            color = Color.parseColor("#0F172A")
            textSize = 44f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText(campaign.name, 60f, 146f, titlePaint)

        val subText = buildString {
            if (campaign.location.isNotBlank()) append("📍 ${campaign.location}   •   ")
            append("${campaign.totalDates} Scheduled Dates")
        }
        val subPaint = Paint().apply {
            color = Color.parseColor("#64748B")
            textSize = 25f
            isAntiAlias = true
        }
        canvas.drawText(subText, 60f, 192f, subPaint)

        // 5. Completion Banner Card
        val bannerRect = RectF(60f, 232f, (width - 60).toFloat(), 370f)
        val bannerBgPaint = Paint().apply {
            color = if (is100Done) Color.parseColor("#ECFDF5") else Color.WHITE
            isAntiAlias = true
        }
        val bannerBorderPaint = Paint().apply {
            color = if (is100Done) Color.parseColor("#10B981") else Color.parseColor("#E2E8F0")
            style = Paint.Style.STROKE
            strokeWidth = 3f
            isAntiAlias = true
        }
        canvas.drawRoundRect(bannerRect, 20f, 20f, bannerBgPaint)
        canvas.drawRoundRect(bannerRect, 20f, 20f, bannerBorderPaint)

        val percentPaint = Paint().apply {
            color = if (is100Done) Color.parseColor("#059669") else Color.parseColor("#4F46E5")
            textSize = 54f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText("${campaign.overallPercentage}%", 96f, 315f, percentPaint)

        val statusLabelPaint = Paint().apply {
            color = Color.parseColor("#0F172A")
            textSize = 28f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val statusText = if (is100Done) "100% DELIVERED & ARCHIVED" else "OVERALL VIDEO DELIVERY"
        canvas.drawText(statusText, 270f, 298f, statusLabelPaint)

        val statusSubPaint = Paint().apply {
            color = Color.parseColor("#64748B")
            textSize = 23f
            isAntiAlias = true
        }
        canvas.drawText(
            "${campaign.deliveredVideosCount} of ${campaign.totalDates} dates delivered • Photos ${campaign.deliveredPhotosCount}/${campaign.totalDates}",
            270f,
            336f,
            statusSubPaint
        )

        // 6. Two Metric Boxes
        val boxTop = 400f
        val boxBottom = 545f
        val leftBox = RectF(60f, boxTop, 525f, boxBottom)
        val rightBox = RectF(555f, boxTop, (width - 60).toFloat(), boxBottom)

        drawMetricBox(
            canvas = canvas,
            rect = leftBox,
            label = "VIDEO PIPELINE",
            value = "${campaign.deliveredVideosCount} / ${campaign.totalDates}",
            subtext = "${campaign.videoDeliveryPercentage}% Delivered",
            accentColor = Color.parseColor("#4F46E5")
        )
        drawMetricBox(
            canvas = canvas,
            rect = rightBox,
            label = "PHOTO TRACKER",
            value = "${campaign.deliveredPhotosCount} / ${campaign.totalDates}",
            subtext = "${campaign.photoUploadPercentage}% Uploaded",
            accentColor = Color.parseColor("#10B981")
        )

        // 7. Section Header
        var currentY = 605f
        val sectionPaint = Paint().apply {
            color = Color.parseColor("#64748B")
            textSize = 22f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val linePaint = Paint().apply {
            color = Color.parseColor("#E2E8F0")
            strokeWidth = 2f
        }
        canvas.drawText("DATE-BY-DATE SCHEDULE BREAKDOWN", 60f, currentY, sectionPaint)
        canvas.drawLine(60f, currentY + 14f, (width - 60).toFloat(), currentY + 14f, linePaint)

        // 8. Task Rows
        currentY += 42f
        val rowBgPaint = Paint().apply {
            color = Color.WHITE
            isAntiAlias = true
        }
        val rowBorderPaint = Paint().apply {
            color = Color.parseColor("#E2E8F0")
            style = Paint.Style.STROKE
            strokeWidth = 2f
            isAntiAlias = true
        }
        val taskTitlePaint = Paint().apply {
            color = Color.parseColor("#0F172A")
            textSize = 24f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val taskStagePaint = Paint().apply {
            textSize = 21f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val dotPaint = Paint().apply { isAntiAlias = true }

        campaign.tasks.forEachIndexed { index, task ->
            val rowRect = RectF(60f, currentY, (width - 60).toFloat(), currentY + 54f)
            canvas.drawRoundRect(rowRect, 12f, 12f, rowBgPaint)
            canvas.drawRoundRect(rowRect, 12f, 12f, rowBorderPaint)

            val dotColor = Color.parseColor(task.stage.hexColor)
            dotPaint.color = dotColor
            canvas.drawCircle(90f, currentY + 27f, 9f, dotPaint)

            canvas.drawText("${index + 1}. ${task.title}", 118f, currentY + 35f, taskTitlePaint)

            taskStagePaint.color = dotColor
            val stageText = task.stage.title.uppercase(Locale.ROOT)
            val stageWidth = taskStagePaint.measureText(stageText)
            canvas.drawText(stageText, (width - 90).toFloat() - stageWidth, currentY + 35f, taskStagePaint)

            currentY += 66f
        }

        // 9. Footer
        val footerY = height - 42f
        val footerPaint = Paint().apply {
            color = Color.parseColor("#94A3B8")
            textSize = 21f
            isAntiAlias = true
        }
        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
        canvas.drawText("Generated $timestamp  •  One Tap Studio Tracker (Real-Time)", 60f, footerY, footerPaint)

        val dir = File(context.cacheDir, "briefings")
        if (!dir.exists()) dir.mkdirs()
        val file = File(dir, "safar_briefing_${campaign.id.hashCode()}_${System.currentTimeMillis()}.png")
        FileOutputStream(file).use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        }
        return file
    }

    private fun drawMetricBox(
        canvas: Canvas,
        rect: RectF,
        label: String,
        value: String,
        subtext: String,
        accentColor: Int
    ) {
        val bgPaint = Paint().apply {
            color = Color.WHITE
            isAntiAlias = true
        }
        val borderPaint = Paint().apply {
            color = Color.parseColor("#E2E8F0")
            style = Paint.Style.STROKE
            strokeWidth = 2f
            isAntiAlias = true
        }
        canvas.drawRoundRect(rect, 16f, 16f, bgPaint)
        canvas.drawRoundRect(rect, 16f, 16f, borderPaint)

        val accentBar = RectF(rect.left, rect.top, rect.left + 8f, rect.bottom)
        val barPaint = Paint().apply { color = accentColor }
        canvas.drawRoundRect(accentBar, 4f, 4f, barPaint)

        val labelPaint = Paint().apply {
            color = Color.parseColor("#64748B")
            textSize = 20f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText(label, rect.left + 26f, rect.top + 38f, labelPaint)

        val valuePaint = Paint().apply {
            color = Color.parseColor("#0F172A")
            textSize = 36f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText(value, rect.left + 26f, rect.top + 88f, valuePaint)

        val subPaint = Paint().apply {
            color = accentColor
            textSize = 21f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText(subtext, rect.left + 26f, rect.top + 124f, subPaint)
    }
}
