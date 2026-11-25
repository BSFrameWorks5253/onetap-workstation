package com.onetap.studiotracker.data.analytics

import com.onetap.studiotracker.data.models.SafarCampaign

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
    val deliveredPhotosCount: Int,
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
    val totalPhotosDelivered: Int,
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

    fun parseHijriYearAndMonth(input: String): Pair<Int, Int>? {
        val regex = Regex("""(\d{4})[-_.](\d{1,2})""")
        val match = regex.find(input) ?: return null
        val year = match.groupValues[1].toIntOrNull() ?: return null
        val month = match.groupValues[2].toIntOrNull()?.takeIf { it in 1..12 } ?: return null
        return Pair(year, month)
    }

    fun detectAvailableYears(campaigns: List<SafarCampaign>): List<Int> {
        val years = campaigns.mapNotNull { c ->
            parseHijriYearAndMonth(c.name)?.first ?: c.safarYear.toIntOrNull()
        }.distinct().sortedDescending()
        return years.ifEmpty { listOf(1448) }
    }

    fun generateMonthSummary(
        campaigns: List<SafarCampaign>,
        targetYear: Int,
        targetMonth: Int
    ): HijriMonthSummary {
        val matchingCampaigns = campaigns.filter { c ->
            val parsed = parseHijriYearAndMonth(c.name)
            parsed != null && parsed.first == targetYear && parsed.second == targetMonth
        }

        val allTasks = matchingCampaigns.flatMap { it.tasks }
        val totalDates = allTasks.size
        val deliveredVideos = allTasks.count { it.isVideoDelivered }
        val pendingVideos = (totalDates - deliveredVideos).coerceAtLeast(0)
        val deliveredPhotos = allTasks.count { it.isPhotosDelivered }

        val completionPercent = if (totalDates > 0) {
            ((deliveredVideos.toFloat() / totalDates) * 100).toInt().coerceIn(0, 100)
        } else 0

        val is100Done = totalDates > 0 && deliveredVideos >= totalDates

        val leaderboard = allTasks
            .groupBy { it.effectiveVideoEditor }
            .mapValues { (_, tasks) -> tasks.count { it.isVideoDelivered } }
            .filterValues { it > 0 }

        return HijriMonthSummary(
            hijriYear = targetYear,
            monthNumber = targetMonth,
            monthName = getMonthName(targetMonth),
            campaignsCount = matchingCampaigns.size,
            totalScheduledDates = totalDates,
            deliveredVideosCount = deliveredVideos,
            pendingVideosCount = pendingVideos,
            deliveredPhotosCount = deliveredPhotos,
            completionPercentage = completionPercent,
            is100PercentMonthDone = is100Done,
            activeCampaignNames = matchingCampaigns.map { it.name },
            editorLeaderboard = leaderboard
        )
    }

    fun generateAnnualHijriReport(campaigns: List<SafarCampaign>, targetYear: Int): HijriYearSummary {
        val yearCampaigns = campaigns.filter { c ->
            val parsedYear = parseHijriYearAndMonth(c.name)?.first ?: c.safarYear.toIntOrNull()
            parsedYear == targetYear
        }
        val allTasks = yearCampaigns.flatMap { it.tasks }
        val totalDates = allTasks.size
        val deliveredDates = allTasks.count { it.isVideoDelivered }
        val deliveredPhotos = allTasks.count { it.isPhotosDelivered }
        val safarsDone = yearCampaigns.count { it.is100PercentDone }

        val overallPercent = if (totalDates > 0) {
            ((deliveredDates.toFloat() / totalDates) * 100).toInt().coerceIn(0, 100)
        } else 0

        val monthlyBreakdown = (1..12).map { month ->
            generateMonthSummary(yearCampaigns, targetYear, month)
        }.filter { it.campaignsCount > 0 }

        return HijriYearSummary(
            hijriYear = targetYear,
            totalSafars = yearCampaigns.size,
            totalScheduledDates = totalDates,
            totalDatesDelivered = deliveredDates,
            totalPhotosDelivered = deliveredPhotos,
            safars100PercentDone = safarsDone,
            overallPercentage = overallPercent,
            monthlyBreakdown = monthlyBreakdown
        )
    }

    fun formatMonthEndBriefing(summary: HijriMonthSummary): String {
        val sb = StringBuilder()
        sb.append("📅 *ONE TAP STUDIO | HIJRI MONTH-END REPORT*\n")
        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("🌙 *Month:* ${summary.monthName} (${summary.hijriYear}H)\n")
        sb.append("📍 *Safar Campaigns:* ${summary.campaignsCount}\n\n")
        sb.append("📊 *Production Summary:*\n")
        sb.append(" • Scheduled Dates: *${summary.totalScheduledDates}*\n")
        sb.append(" • Delivered Videos: *${summary.deliveredVideosCount}* (${summary.completionPercentage}%)\n")
        sb.append(" • Pending Videos: *${summary.pendingVideosCount}*\n")
        sb.append(" • Photos Uploaded: *${summary.deliveredPhotosCount}/${summary.totalScheduledDates}*\n\n")
        if (summary.editorLeaderboard.isNotEmpty()) {
            sb.append("🏆 *Editor Contributions (Delivered):*\n")
            summary.editorLeaderboard.entries.sortedByDescending { it.value }.forEach { (editor, count) ->
                sb.append(" • $editor: *$count* dates\n")
            }
            sb.append("\n")
        }
        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("⚡ *One Tap Studio Tracker*")
        return sb.toString()
    }

    fun formatAnnualHijriBriefing(summary: HijriYearSummary): String {
        val sb = StringBuilder()
        sb.append("🏆 *ONE TAP STUDIO | ${summary.hijriYear}H ANNUAL AUDIT*\n")
        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append(" • Total Safars: *${summary.totalSafars}* (${summary.safars100PercentDone} 100% Done)\n")
        sb.append(" • Scheduled Dates: *${summary.totalScheduledDates}*\n")
        sb.append(" • Delivered Videos: *${summary.totalDatesDelivered}* (${summary.overallPercentage}%)\n")
        sb.append(" • Photos Uploaded: *${summary.totalPhotosDelivered}*\n\n")
        if (summary.monthlyBreakdown.isNotEmpty()) {
            sb.append("📆 *Monthly Breakdown:*\n")
            summary.monthlyBreakdown.forEach { m ->
                sb.append(" • ${m.monthName}: ${m.deliveredVideosCount}/${m.totalScheduledDates} (${m.completionPercentage}%)\n")
            }
            sb.append("\n")
        }
        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("⚡ *One Tap Studio Tracker*")
        return sb.toString()
    }
}
