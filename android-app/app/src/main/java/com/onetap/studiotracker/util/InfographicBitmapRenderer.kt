package com.onetap.studiotracker.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.core.content.FileProvider
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.Stage
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object InfographicBitmapRenderer {

    fun generateCampaignInfographic(context: Context, campaign: SafarCampaign): File {
        val width = 1080
        val baseHeight = 1200 + (campaign.tasks.size * 70)
        val height = baseHeight.coerceAtLeast(1350)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // 1. Background Gradient
        val bgPaint = Paint().apply {
            shader = LinearGradient(
                0f, 0f, 0f, height.toFloat(),
                Color.parseColor("#0B132B"),
                Color.parseColor("#1C2541"),
                Shader.TileMode.CLAMP
            )
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

        // 2. Decorative Top Glow Bar
        val glowPaint = Paint().apply {
            color = if (campaign.is100PercentDone) Color.parseColor("#10B981") else Color.parseColor("#4F46E5")
        }
        canvas.drawRect(0f, 0f, width.toFloat(), 14f, glowPaint)

        // 3. Header Text
        val headerPaint = Paint().apply {
            color = Color.parseColor("#818CF8")
            textSize = 28f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText("ONE TAP STUDIO  •  SAFAR PRODUCTION EXECUTIVE BRIEFING", 60f, 90f, headerPaint)

        // 4. Campaign Title
        val titlePaint = Paint().apply {
            color = Color.WHITE
            textSize = 46f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText(campaign.name, 60f, 155f, titlePaint)

        // Location & Date Subtitle
        val subPaint = Paint().apply {
            color = Color.parseColor("#94A3B8")
            textSize = 26f
            typeface = Typeface.DEFAULT
            isAntiAlias = true
        }
        canvas.drawText("📍 ${campaign.location}   |   📅 ${campaign.startDate} – ${campaign.endDate}", 60f, 200f, subPaint)

        // 5. Completion Banner / Card
        val is100Done = campaign.is100PercentDone
        val bannerRect = RectF(60f, 240f, (width - 60).toFloat(), 390f)
        val bannerBgPaint = Paint().apply {
            color = if (is100Done) Color.parseColor("#064E3B") else Color.parseColor("#1E293B")
            isAntiAlias = true
        }
        val bannerBorderPaint = Paint().apply {
            color = if (is100Done) Color.parseColor("#10B981") else Color.parseColor("#334155")
            style = Paint.Style.STROKE
            strokeWidth = 3f
            isAntiAlias = true
        }
        canvas.drawRoundRect(bannerRect, 20f, 20f, bannerBgPaint)
        canvas.drawRoundRect(bannerRect, 20f, 20f, bannerBorderPaint)

        val bannerTitlePaint = Paint().apply {
            color = if (is100Done) Color.parseColor("#34D399") else Color.WHITE
            textSize = 36f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val bannerTitle = if (is100Done) "🏆 100% COMPLETED — ALL DELIVERIES FINISHED" else "OVERALL PROGRESS: ${campaign.overallPercentage}%"
        canvas.drawText(bannerTitle, 90f, 305f, bannerTitlePaint)

        val bannerSubPaint = Paint().apply {
            color = Color.parseColor("#CBD5E1")
            textSize = 24f
            isAntiAlias = true
        }
        val bannerSub = if (is100Done) {
            "All scheduled dates videos edited & Google Drive photos fully uploaded."
        } else {
            "${campaign.deliveredVideosCount} of ${campaign.totalDates} dates delivered  •  ${campaign.photoUploadPercentage}% drive photos synced"
        }
        canvas.drawText(bannerSub, 90f, 350f, bannerSubPaint)

        // 6. Metrics Grid (2 Boxes: Video Pipeline, Photo Coverage)
        val boxWidth = (width - 120 - 30) / 2f
        val boxHeight = 160f
        val boxY = 420f

        // Video Box
        val videoBoxRect = RectF(60f, boxY, 60f + boxWidth, boxY + boxHeight)
        drawMetricBox(
            canvas = canvas,
            rect = videoBoxRect,
            label = "VIDEO DELIVERIES",
            value = "${campaign.deliveredVideosCount} / ${campaign.totalDates}",
            subtext = "${campaign.totalDates - campaign.deliveredVideosCount} Pending",
            accentColor = Color.parseColor("#3B82F6")
        )

        // Photos Box
        val photoBoxRect = RectF(60f + boxWidth + 30f, boxY, (width - 60).toFloat(), boxY + boxHeight)
        drawMetricBox(
            canvas = canvas,
            rect = photoBoxRect,
            label = "DRIVE PHOTO ARCHIVE",
            value = "${campaign.uploadedPhotosCount} Photos",
            subtext = "${campaign.photoUploadPercentage}% Total Completed",
            accentColor = Color.parseColor("#10B981")
        )

        // 7. Schedule Breakdown Section Header
        val sectionPaint = Paint().apply {
            color = Color.parseColor("#F8FAFC")
            textSize = 30f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val linePaint = Paint().apply {
            color = Color.parseColor("#334155")
            strokeWidth = 2f
        }
        var currentY = 640f
        canvas.drawText("SCHEDULE & PIPELINE BREAKDOWN", 60f, currentY, sectionPaint)
        canvas.drawLine(60f, currentY + 15f, (width - 60).toFloat(), currentY + 15f, linePaint)

        // 8. Tasks List Rows
        currentY += 55f
        val rowBgPaint = Paint().apply {
            color = Color.parseColor("#1A2338")
            isAntiAlias = true
        }
        val taskTitlePaint = Paint().apply {
            color = Color.WHITE
            textSize = 25f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val taskStagePaint = Paint().apply {
            textSize = 22f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val dotPaint = Paint().apply {
            isAntiAlias = true
        }

        campaign.tasks.forEachIndexed { index, task ->
            val rowRect = RectF(60f, currentY, (width - 60).toFloat(), currentY + 54f)
            canvas.drawRoundRect(rowRect, 10f, 10f, rowBgPaint)

            // Stage color dot
            val dotColor = Color.parseColor(task.stage.hexColor)
            dotPaint.color = dotColor
            canvas.drawCircle(90f, currentY + 27f, 10f, dotPaint)

            // Task title
            val titleText = "${index + 1}. ${task.title}"
            canvas.drawText(titleText, 120f, currentY + 36f, taskTitlePaint)

            // Task stage text & photos
            taskStagePaint.color = dotColor
            val stageText = task.stage.title.uppercase(Locale.ROOT)
            val stageWidth = taskStagePaint.measureText(stageText)
            canvas.drawText(stageText, (width - 90).toFloat() - stageWidth, currentY + 36f, taskStagePaint)

            currentY += 66f
        }

        // 9. Footer
        val footerY = height - 50f
        val footerPaint = Paint().apply {
            color = Color.parseColor("#64748B")
            textSize = 22f
            isAntiAlias = true
        }
        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
        canvas.drawText("Generated on $timestamp  •  One Tap Studio Mobile Workstation", 60f, footerY, footerPaint)

        // Save Bitmap to File
        val dir = File(context.cacheDir, "briefings")
        if (!dir.exists()) dir.mkdirs()
        val file = File(dir, "safar_briefing_${campaign.id}_${System.currentTimeMillis()}.png")
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
            color = Color.parseColor("#172239")
            isAntiAlias = true
        }
        val borderPaint = Paint().apply {
            color = Color.parseColor("#293855")
            style = Paint.Style.STROKE
            strokeWidth = 2f
            isAntiAlias = true
        }
        canvas.drawRoundRect(rect, 14f, 14f, bgPaint)
        canvas.drawRoundRect(rect, 14f, 14f, borderPaint)

        val accentBar = RectF(rect.left, rect.top, rect.left + 8f, rect.bottom)
        val barPaint = Paint().apply { color = accentColor }
        canvas.drawRoundRect(accentBar, 4f, 4f, barPaint)

        val labelPaint = Paint().apply {
            color = Color.parseColor("#94A3B8")
            textSize = 20f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText(label, rect.left + 24f, rect.top + 38f, labelPaint)

        val valuePaint = Paint().apply {
            color = Color.WHITE
            textSize = 36f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText(value, rect.left + 24f, rect.top + 88f, valuePaint)

        val subPaint = Paint().apply {
            color = Color.parseColor("#38BDF8")
            textSize = 20f
            isAntiAlias = true
        }
        canvas.drawText(subtext, rect.left + 24f, rect.top + 128f, subPaint)
    }
}
