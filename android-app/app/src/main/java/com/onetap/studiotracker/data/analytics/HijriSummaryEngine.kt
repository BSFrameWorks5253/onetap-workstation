package com.onetap.studiotracker.data.analytics

import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.Stage
import java.util.Locale

data class HijriMonthInfo(
    val monthNumber: Int,
    val canonicalName: String,
    val arabicName: String
)

data class HijriMonthSummary(
    val hijriYear: Int,
    val monthNumber: Int,
    val monthName: String,
    val campaignsCount: Int,
    val totalScheduledDates: Int,
    val deliveredVideosCount: Int,
    val pendingVideosCount: Int,
    val totalPhotosArchived: Int,
    val totalRuntimeMinutes: Int,
    val completionPercentage: Int,
    val is100PercentMonthDone: Boolean,
    val activeCampaignNames: List<String>,
    val editorLeaderboard: Map<String, Int>
)

data class HijriYearSummary(
    val hijriYear: Int,
    val totalSafars: Int,
    val totalScheduledDates: Int,
    val totalDatesDelivered: Int,
    val totalPhotosArchived: Int,
    val totalRuntimeHours: Float,
    val safars100PercentDone: Int,
    val overallPercentage: Int,
    val monthlyBreakdown: List<HijriMonthSummary>
)

object HijriSummaryEngine {

    val HIJRI_MONTHS = listOf(
        HijriMonthInfo(1, "Muharram al-Haram", "محرم الحرام"),
        HijriMonthInfo(2, "Safar al-Muzaffar", "صفر المظفر"),
        HijriMonthInfo(3, "Rabi al-Awwal", "ربيع الأول"),
        HijriMonthInfo(4, "Rabi al-Akhar", "ربيع الآخر"),
        HijriMonthInfo(5, "Jumada al-Ula", "جمادى الأولى"),
        HijriMonthInfo(6, "Jumada al-Ukhra", "جمادى الآخرة"),
        HijriMonthInfo(7, "Rajab al-Asab", "رجب الأصب"),
        HijriMonthInfo(8, "Shaban al-Karim", "شعبان الكريم"),
        HijriMonthInfo(9, "Ramadan al-Moazzam", "رمضان المعظم"),
        HijriMonthInfo(10, "Shawwal al-Mukarram", "شوال المكرم"),
        HijriMonthInfo(11, "Zilqad al-Haram", "ذو القعدة الحرام"),
        HijriMonthInfo(12, "Zilhaj al-Haram", "ذو الحجة الحرام")
    )

    fun getMonthName(monthNumber: Int): String {
        return HIJRI_MONTHS.firstOrNull { it.monthNumber == monthNumber }?.canonicalName
            ?: "Hijri Month $monthNumber"
    }

    /**
     * Extracts Hijri Year and Month from campaign title or tasks (e.g. "1447-06 Safar Mubaraka").
     */
    fun parseHijriYearAndMonth(input: String): Pair<Int, Int> {
        val regex = Regex("""(\d{4})[-_](\d{1,2})""")
        val match = regex.find(input)
        return if (match != null) {
            val year = match.groupValues[1].toIntOrNull() ?: 1447
            val month = match.groupValues[2].toIntOrNull() ?: 6
            Pair(year, month)
        } else {
            Pair(1447, 6)
        }
    }

    /**
     * Generates an executive Hijri Month-End Summary for a specific Hijri month.
     */
    fun generateMonthSummary(
        campaigns: List<SafarCampaign>,
        targetYear: Int = 1447,
        targetMonth: Int = 6
    ): HijriMonthSummary {
        // Filter campaigns belonging to this Hijri year and month
        val matchingCampaigns = campaigns.filter { c ->
            val (y, m) = parseHijriYearAndMonth(c.name)
            (y == targetYear && m == targetMonth) || campaigns.size == 1
        }.ifEmpty { campaigns }

        val allTasks = matchingCampaigns.flatMap { it.tasks }
        val totalDates = allTasks.size
        val deliveredVideos = allTasks.count { it.isVideoDelivered }
        val pendingVideos = (totalDates - deliveredVideos).coerceAtLeast(0)
        val totalPhotos = allTasks.sumOf { it.uploadedPhotos }
        val totalRuntime = allTasks.sumOf { it.durationMinutes }

        val completionPercent = if (totalDates > 0) {
            ((deliveredVideos.toFloat() / totalDates) * 100).toInt().coerceIn(0, 100)
        } else 0

        val is100Done = totalDates > 0 && deliveredVideos >= totalDates

        // Editor leaderboard
        val leaderboard = allTasks
            .filter { !it.videoEditor.isNullOrBlank() }
            .groupBy { it.videoEditor!! }
            .mapValues { (_, tasks) -> tasks.count { it.isVideoDelivered } }

        return HijriMonthSummary(
            hijriYear = targetYear,
            monthNumber = targetMonth,
            monthName = getMonthName(targetMonth),
            campaignsCount = matchingCampaigns.size,
            totalScheduledDates = totalDates,
            deliveredVideosCount = deliveredVideos,
            pendingVideosCount = pendingVideos,
            totalPhotosArchived = totalPhotos,
            totalRuntimeMinutes = totalRuntime,
            completionPercentage = completionPercent,
            is100PercentMonthDone = is100Done,
            activeCampaignNames = matchingCampaigns.map { it.name },
            editorLeaderboard = leaderboard
        )
    }

    /**
     * Generates an Annual Hijri Year-End Production Review.
     */
    fun generateAnnualHijriReport(
        campaigns: List<SafarCampaign>,
        targetYear: Int = 1447
    ): HijriYearSummary {
        val allTasks = campaigns.flatMap { it.tasks }
        val totalDates = allTasks.size
        val totalDelivered = allTasks.count { it.isVideoDelivered }
        val totalPhotos = allTasks.sumOf { it.uploadedPhotos }
        val totalRuntimeHours = allTasks.sumOf { it.durationMinutes } / 60f
        val safars100Done = campaigns.count { it.is100PercentDone }

        val overallPercent = if (totalDates > 0) {
            ((totalDelivered.toFloat() / totalDates) * 100).toInt().coerceIn(0, 100)
        } else 0

        val monthlySummaries = (1..12).map { monthNum ->
            generateMonthSummary(campaigns, targetYear, monthNum)
        }.filter { it.totalScheduledDates > 0 }

        return HijriYearSummary(
            hijriYear = targetYear,
            totalSafars = campaigns.size,
            totalScheduledDates = totalDates,
            totalDatesDelivered = totalDelivered,
            totalPhotosArchived = totalPhotos,
            totalRuntimeHours = totalRuntimeHours,
            safars100PercentDone = safars100Done,
            overallPercentage = overallPercent,
            monthlyBreakdown = monthlySummaries
        )
    }

    /**
     * Formats an executive WhatsApp / clipboard text briefing for the Hijri Month-End.
     */
    fun formatMonthEndBriefing(summary: HijriMonthSummary): String {
        val sb = StringBuilder()
        sb.append("🌙 *ONE TAP STUDIO | HIJRI MONTH-END EXECUTIVE RECAP*\n")
        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("📅 *Month:* ${summary.monthName} (${String.format(Locale.ROOT, "%02d", summary.monthNumber)} / ${summary.hijriYear} H)\n")
        sb.append("📍 *Active Campaigns (${summary.campaignsCount}):* ${summary.activeCampaignNames.joinToString(", ")}\n\n")

        if (summary.is100PercentMonthDone) {
            sb.append("🏆 *MONTHLY MILESTONE: 100% COMPLETE & ARCHIVED!*\n")
            sb.append("✨ Every scheduled date in this Hijri month has been edited, reviewed, and finalized successfully!\n\n")
        } else {
            sb.append("📊 *Monthly Completion Velocity:* *${summary.completionPercentage}%*\n")
            val bars = (summary.completionPercentage / 10).coerceIn(0, 10)
            sb.append("`[${"█".repeat(bars)}${"░".repeat(10 - bars)}]`\n\n")
        }

        sb.append("🎬 *Production Volume:*\n")
        sb.append(" • Total Scheduled Dates: *${summary.totalScheduledDates}*\n")
        sb.append(" • Master Videos Delivered: *${summary.deliveredVideosCount}* ✅\n")
        sb.append(" • Pending in Pipeline: *${summary.pendingVideosCount}* ⏳\n")
        sb.append(" • Total Master Runtime: *${summary.totalRuntimeMinutes} minutes* (${summary.totalRuntimeMinutes / 60}h ${summary.totalRuntimeMinutes % 60}m)\n\n")

        sb.append("📸 *Google Drive Cloud Photos:*\n")
        sb.append(" • Total Photos Synced: *${summary.totalPhotosArchived} photos*\n\n")

        if (summary.editorLeaderboard.isNotEmpty()) {
            sb.append("👥 *Editor Velocity Leaderboard:*\n")
            summary.editorLeaderboard.forEach { (editor, count) ->
                sb.append(" • $editor: *$count videos delivered*\n")
            }
            sb.append("\n")
        }

        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("⚡ *One Tap Studio Tracker* • _Hijri Month-End Report_")
        return sb.toString()
    }

    /**
     * Formats an Annual Hijri Year-End Summary report.
     */
    fun formatAnnualHijriBriefing(summary: HijriYearSummary): String {
        val sb = StringBuilder()
        sb.append("🏆 *ONE TAP STUDIO | ANNUAL HIJRI YEAR-END AUDIT*\n")
        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("🌟 *Hijri Year:* *${summary.hijriYear} H*\n")
        sb.append("📦 *Total Safar Campaigns Produced:* *${summary.totalSafars}*\n")
        sb.append("🎯 *100% Fully Archived Safars:* *${summary.safars100PercentDone} / ${summary.totalSafars}*\n\n")

        sb.append("📊 *Yearly Production Totals:*\n")
        sb.append(" • Total Scheduled Event Dates: *${summary.totalScheduledDates}*\n")
        sb.append(" • Master Videos Delivered: *${summary.totalDatesDelivered}* (${summary.overallPercentage}%)\n")
        sb.append(" • Total Timeline Cut Duration: *${String.format(Locale.ROOT, "%.1f", summary.totalRuntimeHours)} Hours*\n")
        sb.append(" • Total Photos Archived in Cloud: *${summary.totalPhotosArchived}*\n\n")

        sb.append("🗓️ *Monthly Safar Breakdown:*\n")
        summary.monthlyBreakdown.forEach { m ->
            val icon = if (m.is100PercentMonthDone) "✅" else "⏳"
            sb.append(" • $icon *${m.monthName}*: ${m.deliveredVideosCount}/${m.totalScheduledDates} Videos (${m.completionPercentage}%)\n")
        }

        sb.append("\n━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("⚡ *One Tap Media Workstation* • _Annual Production Audit_")
        return sb.toString()
    }
}
