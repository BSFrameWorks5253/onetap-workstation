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
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.Stage
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class InfographicPreset(val label: String, val tagline: String) {
    LIQUID_GLASS("Liquid Glass", "Frosted Aurora"),
    ROYAL_EMERALD("Royal Emerald", "Gold & Ivory"),
    STUDIO_SLATE("Studio Slate", "Midnight Pro"),
    COMPACT_GRID("Compact Grid", "2-Column")
}

private data class Palette(
    val bgTop: Int,
    val bgBottom: Int,
    val cardBg: Int,
    val cardBorder: Int,
    val textPrimary: Int,
    val textSecondary: Int,
    val textMuted: Int,
    val accent: Int,
    val accentSoft: Int,
    val trackBg: Int,
    val isDark: Boolean
)

object InfographicBitmapRenderer {

    fun renderCampaignBitmap(
        campaign: SafarCampaign,
        preset: InfographicPreset = InfographicPreset.LIQUID_GLASS
    ): Bitmap {
        val isCompact = preset == InfographicPreset.COMPACT_GRID
        val width = 1080
        val rowsCount = if (isCompact) (campaign.tasks.size + 1) / 2 else campaign.tasks.size
        val rowPitch = if (isCompact) 92 else 78
        val headerHeight = 610
        val footerHeight = 96
        val height = (headerHeight + rowsCount * rowPitch + footerHeight).coerceAtLeast(980)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val isDone = campaign.is100PercentDone

        val p = when (preset) {
            InfographicPreset.LIQUID_GLASS -> Palette(
                bgTop = Color.parseColor("#F4F8FF"),
                bgBottom = Color.parseColor("#ECFDF7"),
                cardBg = Color.argb(232, 255, 255, 255),
                cardBorder = Color.parseColor("#D8E3F2"),
                textPrimary = Color.parseColor("#0F172A"),
                textSecondary = Color.parseColor("#475569"),
                textMuted = Color.parseColor("#94A3B8"),
                accent = if (isDone) Color.parseColor("#059669") else Color.parseColor("#4F46E5"),
                accentSoft = if (isDone) Color.parseColor("#D1FAE5") else Color.parseColor("#E0E7FF"),
                trackBg = Color.parseColor("#E2E8F0"),
                isDark = false
            )
            InfographicPreset.ROYAL_EMERALD -> Palette(
                bgTop = Color.parseColor("#FCF9F2"),
                bgBottom = Color.parseColor("#F2EFE6"),
                cardBg = Color.parseColor("#FFFFFF"),
                cardBorder = Color.parseColor("#E5D5B5"),
                textPrimary = Color.parseColor("#14261C"),
                textSecondary = Color.parseColor("#4B5E53"),
                textMuted = Color.parseColor("#8A8170"),
                accent = Color.parseColor("#047857"),
                accentSoft = Color.parseColor("#FEF3C7"),
                trackBg = Color.parseColor("#E7E0D0"),
                isDark = false
            )
            InfographicPreset.STUDIO_SLATE -> Palette(
                bgTop = Color.parseColor("#0B1120"),
                bgBottom = Color.parseColor("#111C33"),
                cardBg = Color.argb(215, 30, 41, 59),
                cardBorder = Color.parseColor("#334155"),
                textPrimary = Color.parseColor("#F8FAFC"),
                textSecondary = Color.parseColor("#CBD5E1"),
                textMuted = Color.parseColor("#64748B"),
                accent = if (isDone) Color.parseColor("#10B981") else Color.parseColor("#818CF8"),
                accentSoft = Color.parseColor("#1E293B"),
                trackBg = Color.parseColor("#334155"),
                isDark = true
            )
            InfographicPreset.COMPACT_GRID -> Palette(
                bgTop = Color.parseColor("#F8FAFC"),
                bgBottom = Color.parseColor("#EEF2FF"),
                cardBg = Color.parseColor("#FFFFFF"),
                cardBorder = Color.parseColor("#CBD5E1"),
                textPrimary = Color.parseColor("#0F172A"),
                textSecondary = Color.parseColor("#475569"),
                textMuted = Color.parseColor("#94A3B8"),
                accent = if (isDone) Color.parseColor("#059669") else Color.parseColor("#4F46E5"),
                accentSoft = Color.parseColor("#EEF2FF"),
                trackBg = Color.parseColor("#E2E8F0"),
                isDark = false
            )
        }

        // Background gradient
        canvas.drawRect(
            0f, 0f, width.toFloat(), height.toFloat(),
            Paint().apply {
                shader = LinearGradient(0f, 0f, width.toFloat(), height.toFloat(), p.bgTop, p.bgBottom, Shader.TileMode.CLAMP)
            }
        )

        // Subtle ambient aurora orbs for Liquid Glass / Studio Slate
        if (preset == InfographicPreset.LIQUID_GLASS || preset == InfographicPreset.STUDIO_SLATE) {
            val orbAlpha = if (p.isDark) 52 else 68
            canvas.drawCircle(180f, 160f, 300f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(orbAlpha, 99, 102, 241)
            })
            canvas.drawCircle(920f, 340f, 260f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(orbAlpha, 16, 185, 129)
            })
            // Re-wash softly so orbs look diffused
            canvas.drawRect(
                0f, 0f, width.toFloat(), height.toFloat(),
                Paint().apply {
                    color = if (p.isDark) Color.argb(175, 11, 17, 32) else Color.argb(165, 248, 250, 252)
                }
            )
        }

        // Top accent bar
        val topBarColor2 = if (preset == InfographicPreset.ROYAL_EMERALD) Color.parseColor("#D97706") else Color.parseColor("#06B6D4")
        canvas.drawRect(
            0f, 0f, width.toFloat(), 16f,
            Paint().apply {
                shader = LinearGradient(0f, 0f, width.toFloat(), 0f, p.accent, topBarColor2, Shader.TileMode.CLAMP)
            }
        )

        // Brand tag pill
        val tagRect = RectF(56f, 52f, 520f, 96f)
        canvas.drawRoundRect(tagRect, 22f, 22f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.accentSoft })
        canvas.drawText(
            "ONE TAP STUDIO  •  PRODUCTION REPORT",
            80f, 82f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (preset == InfographicPreset.ROYAL_EMERALD) Color.parseColor("#92400E") else p.accent
                textSize = 20f
                typeface = Typeface.DEFAULT_BOLD
                letterSpacing = 0.06f
            }
        )

        // Campaign Title & Subtitle
        canvas.drawText(
            campaign.name,
            56f, 160f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = p.textPrimary
                textSize = 48f
                typeface = Typeface.DEFAULT_BOLD
            }
        )
        canvas.drawText(
            "${campaign.totalDates} Scheduled Date Folders  •  ${if (isDone) "Completed & Delivered" else "Live Production Status"}",
            56f, 204f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = p.textSecondary
                textSize = 24f
            }
        )

        // Hero Glass Card with Donut Ring + 3 KPI Boxes
        val heroRect = RectF(56f, 236f, (width - 56).toFloat(), 540f)
        canvas.drawRoundRect(heroRect, 28f, 28f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.cardBg })
        canvas.drawRoundRect(heroRect, 28f, 28f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = p.cardBorder
            style = Paint.Style.STROKE
            strokeWidth = 2.5f
        })

        // Donut Progress Ring
        val ringCx = 190f
        val ringCy = 365f
        val ringR = 84f
        val ringRect = RectF(ringCx - ringR, ringCy - ringR, ringCx + ringR, ringCy + ringR)
        canvas.drawArc(ringRect, 0f, 360f, false, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = p.trackBg
            style = Paint.Style.STROKE
            strokeWidth = 20f
        })
        val sweep = (campaign.overallPercentage.coerceIn(0, 100) / 100f) * 360f
        canvas.drawArc(ringRect, -90f, sweep, false, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = p.accent
            style = Paint.Style.STROKE
            strokeWidth = 20f
            strokeCap = Paint.Cap.ROUND
        })
        val pctText = "${campaign.overallPercentage}%"
        val pctPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = p.textPrimary
            textSize = 40f
            typeface = Typeface.DEFAULT_BOLD
        }
        canvas.drawText(pctText, ringCx - pctPaint.measureText(pctText) / 2f, ringCy + 14f, pctPaint)

        // Hero Right Summary + KPI Tiles
        canvas.drawText(
            if (isDone) "100% DELIVERED & ARCHIVED" else "OVERALL DELIVERY PROGRESS",
            318f, 294f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = p.accent
                textSize = 21f
                typeface = Typeface.DEFAULT_BOLD
                letterSpacing = 0.05f
            }
        )

        val pendingCount = (campaign.totalDates - campaign.deliveredVideosCount).coerceAtLeast(0)
        val kpis = listOf(
            Triple("VIDEOS", "${campaign.deliveredVideosCount}/${campaign.totalDates}", Color.parseColor("#10B981")),
            Triple("PHOTOS", "${campaign.deliveredPhotosCount}/${campaign.totalDates}", Color.parseColor("#3B82F6")),
            Triple("PENDING", "$pendingCount", if (pendingCount > 0) Color.parseColor("#F59E0B") else Color.parseColor("#10B981"))
        )
        var kx = 318f
        val kw = 218f
        kpis.forEach { (kLabel, kVal, kColor) ->
            val kRect = RectF(kx, 316f, kx + kw, 438f)
            canvas.drawRoundRect(kRect, 18f, 18f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (p.isDark) Color.parseColor("#0F172A") else Color.parseColor("#F8FAFC")
            })
            canvas.drawRoundRect(kRect, 18f, 18f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = p.cardBorder
                style = Paint.Style.STROKE
                strokeWidth = 1.5f
            })
            canvas.drawText(kLabel, kx + 18f, 348f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = p.textMuted; textSize = 17f; typeface = Typeface.DEFAULT_BOLD
            })
            canvas.drawText(kVal, kx + 18f, 408f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = kColor; textSize = 36f; typeface = Typeface.DEFAULT_BOLD
            })
            kx += kw + 14f
        }

        // Multi-stage segmented bar inside hero card
        val barX = 96f
        val barW = width - 192f
        val barY = 486f
        val barRect = RectF(barX, barY, barX + barW, barY + 14f)
        canvas.drawRoundRect(barRect, 7f, 7f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.trackBg })
        val totalSafe = campaign.totalDates.coerceAtLeast(1).toFloat()
        var segX = barX
        listOf(
            Stage.ALJAMEA_DONE to Color.parseColor("#059669"),
            Stage.UPLOADED to Color.parseColor("#10B981"),
            Stage.UPLOAD_PENDING to Color.parseColor("#06B6D4"),
            Stage.EDITING_IN_PROGRESS to Color.parseColor("#3B82F6"),
            Stage.EDITING_PENDING to Color.parseColor("#F59E0B")
        ).forEach { (st, col) ->
            val cnt = campaign.tasks.count { it.stage == st }
            if (cnt > 0) {
                val segW = (cnt / totalSafe) * barW
                canvas.drawRoundRect(
                    RectF(segX, barY, (segX + segW).coerceAtMost(barX + barW), barY + 14f),
                    7f, 7f,
                    Paint(Paint.ANTI_ALIAS_FLAG).apply { color = col }
                )
                segX += segW
            }
        }

        // Section Label
        canvas.drawText(
            "DATE FOLDER BREAKDOWN",
            56f, 588f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = p.textSecondary
                textSize = 20f
                typeface = Typeface.DEFAULT_BOLD
                letterSpacing = 0.06f
            }
        )

        // Task Rows (Single column or 2-column Compact Grid)
        val rowBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.cardBg }
        val rowBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = p.cardBorder; style = Paint.Style.STROKE; strokeWidth = 1.8f
        }
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = p.textPrimary; textSize = if (isCompact) 21f else 24f; typeface = Typeface.DEFAULT_BOLD
        }
        val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = p.textSecondary; textSize = 18f
        }
        val pillTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = if (isCompact) 16f else 18f; typeface = Typeface.DEFAULT_BOLD
        }
        val pillBgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG)

        if (isCompact) {
            val colW = (width - 112f - 16f) / 2f
            campaign.tasks.forEachIndexed { idx, t ->
                val col = idx % 2
                val row = idx / 2
                val x = 56f + col * (colW + 16f)
                val y = 610f + row * 92f
                val rect = RectF(x, y, x + colW, y + 78f)
                canvas.drawRoundRect(rect, 16f, 16f, rowBgPaint)
                canvas.drawRoundRect(rect, 16f, 16f, rowBorderPaint)

                val c = Color.parseColor(t.stage.hexColor)
                dotPaint.color = c
                canvas.drawCircle(x + 24f, y + 39f, 7f, dotPaint)
                canvas.drawText(t.title, x + 44f, y + 34f, titlePaint)
                canvas.drawText(t.effectiveVideoEditor, x + 44f, y + 58f, subPaint)

                val st = t.stage.title.uppercase(Locale.ROOT)
                val tw = pillTextPaint.measureText(st)
                val pRect = RectF(x + colW - tw - 34f, y + 22f, x + colW - 14f, y + 56f)
                pillBgPaint.color = Color.argb(32, Color.red(c), Color.green(c), Color.blue(c))
                canvas.drawRoundRect(pRect, 12f, 12f, pillBgPaint)
                pillTextPaint.color = c
                canvas.drawText(st, pRect.left + 10f, y + 45f, pillTextPaint)
            }
        } else {
            var y = 610f
            campaign.tasks.forEachIndexed { idx, t ->
                val rect = RectF(56f, y, (width - 56).toFloat(), y + 64f)
                canvas.drawRoundRect(rect, 16f, 16f, rowBgPaint)
                canvas.drawRoundRect(rect, 16f, 16f, rowBorderPaint)

                val c = Color.parseColor(t.stage.hexColor)
                dotPaint.color = c
                canvas.drawCircle(88f, y + 32f, 8f, dotPaint)
                canvas.drawText("${idx + 1}. ${t.title}", 114f, y + 40f, titlePaint)

                val editorTag = t.effectiveVideoEditor
                val titleEnd = 114f + titlePaint.measureText("${idx + 1}. ${t.title}") + 16f
                if (titleEnd < 680f) {
                    canvas.drawText("• $editorTag", titleEnd, y + 39f, subPaint)
                }

                val st = t.stage.title.uppercase(Locale.ROOT)
                val tw = pillTextPaint.measureText(st)
                val pRect = RectF((width - 80).toFloat() - tw - 28f, y + 14f, (width - 80).toFloat(), y + 50f)
                pillBgPaint.color = Color.argb(32, Color.red(c), Color.green(c), Color.blue(c))
                canvas.drawRoundRect(pRect, 14f, 14f, pillBgPaint)
                pillTextPaint.color = c
                canvas.drawText(st, pRect.left + 14f, y + 38f, pillTextPaint)

                y += 78f
            }
        }

        // Footer
        val ts = SimpleDateFormat("MMM dd, yyyy • HH:mm", Locale.getDefault()).format(Date())
        canvas.drawText(
            "Generated $ts  •  One Tap Studio Tracker  •  ${preset.label}",
            56f, height - 38f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = p.textMuted
                textSize = 20f
            }
        )

        return bitmap
    }

    fun generateCampaignInfographic(
        context: Context,
        campaign: SafarCampaign,
        preset: InfographicPreset = InfographicPreset.LIQUID_GLASS
    ): File {
        val bitmap = renderCampaignBitmap(campaign, preset)
        val dir = File(context.cacheDir, "briefings").apply { if (!exists()) mkdirs() }
        val file = File(dir, "safar_briefing_${preset.name.lowercase(Locale.ROOT)}_${System.currentTimeMillis()}.png")
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        return file
    }
}
