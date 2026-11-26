package com.onetap.studiotracker.data.analytics

import com.onetap.studiotracker.data.models.SafarCampaign

data class HijriMonthInfo(val monthNumber: Int, val canonicalName: String)

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
        HijriMonthInfo(1, "Muharram al-Haram"), HijriMonthInfo(2, "Safar al-Muzaffar"),
        HijriMonthInfo(3, "Rabi al-Awwal"), HijriMonthInfo(4, "Rabi al-Akhar"),
        HijriMonthInfo(5, "Jumada al-Ula"), HijriMonthInfo(6, "Jumada al-Ukhra"),
        HijriMonthInfo(7, "Rajab al-Asab"), HijriMonthInfo(8, "Shaban al-Karim"),
        HijriMonthInfo(9, "Ramadan al-Moazzam"), HijriMonthInfo(10, "Shawwal al-Mukarram"),
        HijriMonthInfo(11, "Zilqad al-Haram"), HijriMonthInfo(12, "Zilhaj al-Haram")
    )

    fun getMonthName(m: Int): String = HIJRI_MONTHS.firstOrNull { it.monthNumber == m }?.canonicalName ?: "Hijri Month $m"

    fun parseHijriYearAndMonth(input: String): Pair<Int, Int>? {
        val m = Regex("""(\d{4})[-_.](\d{1,2})""").find(input) ?: return null
        val y = m.groupValues[1].toIntOrNull() ?: return null
        val mo = m.groupValues[2].toIntOrNull()?.takeIf { it in 1..12 } ?: return null
        return Pair(y, mo)
    }

    fun parseCampaignYearAndMonth(campaign: SafarCampaign): Pair<Int, Int>? {
        // Prefer task dateFolder (e.g. "1448-06-09 _01") because campaign.name often has serial > 12 (e.g. "1448-19-Mumbai")
        for (task in campaign.tasks) {
            parseHijriYearAndMonth(task.title)?.let { return it }
            parseHijriYearAndMonth(task.hijriDate)?.let { return it }
        }
        return parseHijriYearAndMonth(campaign.name)
    }

    fun parseCampaignYear(campaign: SafarCampaign): Int? {
        Regex("""\b(14\d{2})\b""").find(campaign.name)?.groupValues?.get(1)?.toIntOrNull()?.let { return it }
        campaign.safarYear.toIntOrNull()?.let { return it }
        return parseCampaignYearAndMonth(campaign)?.first
    }

    fun detectAvailableYears(campaigns: List<SafarCampaign>): List<Int> =
        campaigns.mapNotNull { parseCampaignYear(it) }
            .distinct().sortedDescending().ifEmpty { listOf(1448) }

    fun generateMonthSummary(campaigns: List<SafarCampaign>, targetYear: Int, targetMonth: Int): HijriMonthSummary {
        val matching = campaigns.filter {
            val p = parseCampaignYearAndMonth(it)
            p != null && p.first == targetYear && p.second == targetMonth
        }
        val tasks = matching.flatMap { it.tasks }
        val total = tasks.size
        val delivered = tasks.count { it.isVideoDelivered }
        val pct = if (total > 0) ((delivered.toFloat() / total) * 100).toInt().coerceIn(0, 100) else 0
        val leaderboard = tasks.groupBy { it.effectiveVideoEditor }.mapValues { (_, list) -> list.count { it.isVideoDelivered } }.filterValues { it > 0 }
        return HijriMonthSummary(targetYear, targetMonth, getMonthName(targetMonth), matching.size, total, delivered, (total - delivered).coerceAtLeast(0), tasks.count { it.isPhotosDelivered }, pct, leaderboard)
    }

    fun generateAnnualHijriReport(campaigns: List<SafarCampaign>, targetYear: Int): HijriYearSummary {
        val yearCamps = campaigns.filter { parseCampaignYear(it) == targetYear }
        val tasks = yearCamps.flatMap { it.tasks }
        val total = tasks.size
        val delivered = tasks.count { it.isVideoDelivered }
        val pct = if (total > 0) ((delivered.toFloat() / total) * 100).toInt().coerceIn(0, 100) else 0
        val months = (1..12).map { generateMonthSummary(yearCamps, targetYear, it) }.filter { it.campaignsCount > 0 }
        return HijriYearSummary(targetYear, yearCamps.size, total, delivered, tasks.count { it.isPhotosDelivered }, yearCamps.count { it.is100PercentDone }, pct, months)
    }

    fun formatMonthEndBriefing(s: HijriMonthSummary): String = buildString {
        append("📅 *ONE TAP STUDIO | HIJRI MONTH-END REPORT*\n━━━━━━━━━━━━━━━━━━━━\n")
        append("🌙 *Month:* ${s.monthName} (${s.hijriYear}H)\n📍 *Safars:* ${s.campaignsCount}\n\n")
        append("📊 *Summary:*\n • Scheduled: *${s.totalScheduledDates}*\n • Delivered: *${s.deliveredVideosCount}* (${s.completionPercentage}%)\n • Photos: *${s.deliveredPhotosCount}/${s.totalScheduledDates}*\n")
    }

    fun formatAnnualHijriBriefing(s: HijriYearSummary): String = buildString {
        append("🏆 *ONE TAP STUDIO | ${s.hijriYear}H ANNUAL AUDIT*\n━━━━━━━━━━━━━━━━━━━━\n")
        append(" • Safars: *${s.totalSafars}* (${s.safars100PercentDone} 100% Done)\n • Delivered: *${s.totalDatesDelivered}/${s.totalScheduledDates}* (${s.overallPercentage}%)\n • Photos: *${s.totalPhotosDelivered}*\n")
    }
}
