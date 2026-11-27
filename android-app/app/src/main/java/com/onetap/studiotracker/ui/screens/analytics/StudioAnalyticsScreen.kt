package com.onetap.studiotracker.ui.screens.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.data.analytics.HijriSummaryEngine
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.models.StudioStats
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.components.StudioDropdownSelector
import com.onetap.studiotracker.ui.theme.AmberDark
import com.onetap.studiotracker.ui.theme.BlueDark
import com.onetap.studiotracker.ui.theme.BrandCrimson
import com.onetap.studiotracker.ui.theme.BrandCrimsonSoft
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.IndigoSoft
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.ui.theme.liquidBouncyClick
import com.onetap.studiotracker.ui.theme.liquidGlassCard
import com.onetap.studiotracker.util.WhatsAppShareManager
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

enum class AnalyticsTab { ONE_TAP_STATS, HIJRI_SUMMARY, AUDIT_AND_SLA }
enum class StatsSubView { BY_CATEGORY, BY_SAFAR, REEDIT_HISTORY }
enum class StatsPeriodMode { HIJRI, GREGORIAN, ALL_RECORDS }

private fun formatDurationCompact(seconds: Double): String {
    if (seconds <= 0.0) return "0m"
    val totalSec = seconds.toLong()
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return when {
        h > 0 -> "${h}h ${m}m"
        m > 0 -> "${m}m ${s}s"
        else -> "${s}s"
    }
}

private data class SafarStatGroup(
    val safarName: String,
    val periodVideos: Int,
    val allTimeVideos: Int,
    val sessionsCount: Int,
    val durationSeconds: Double,
    val deliveredCount: Int,
    val totalDates: Int,
    val isArchived: Boolean
)

private data class CategoryStatGroup(
    val categoryName: String,
    val color: Color,
    val videosCount: Int,
    val sessionsCount: Int,
    val durationSeconds: Double
)

@Composable
fun StudioAnalyticsScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val repository = SafarRepository.getInstance()
    val campaigns by repository.campaigns.collectAsState()
    val auditLogs by repository.auditLogs.collectAsState()
    val syncState by repository.syncState.collectAsState()

    var currentTab by remember { mutableStateOf(AnalyticsTab.ONE_TAP_STATS) }

    // Desktop One Tap Stats state (Image 6)
    var subView by remember { mutableStateOf(StatsSubView.BY_SAFAR) }
    var isGridView by remember { mutableStateOf(true) }
    var periodMode by remember { mutableStateOf(StatsPeriodMode.HIJRI) }
    val availableHijriYears = remember(campaigns) { HijriSummaryEngine.detectAvailableYears(campaigns) }
    var selectedStatsYear by remember(availableHijriYears) { mutableIntStateOf(availableHijriYears.first()) }
    var selectedGregorianYear by remember { mutableIntStateOf(Calendar.getInstance().get(Calendar.YEAR)) }
    var selectedStatsMonth by remember { mutableIntStateOf(0) } // 0 = All Months
    var selectedSafarFilter by remember { mutableStateOf("ALL") }
    var statsSearchQuery by remember { mutableStateOf("") }
    var pendingArchiveSafar by remember { mutableStateOf<Pair<String, Boolean>?>(null) }

    // Hijri Reports tab state (Image 3)
    var reportYear by remember(availableHijriYears) { mutableIntStateOf(availableHijriYears.first()) }
    var reportMonth by remember { mutableIntStateOf(6) }
    val monthSummary = remember(campaigns, reportYear, reportMonth) {
        HijriSummaryEngine.generateMonthSummary(campaigns, reportYear, reportMonth)
    }
    val yearSummary = remember(campaigns, reportYear) {
        HijriSummaryEngine.generateAnnualHijriReport(campaigns, reportYear)
    }

    // Filter tasks for One Tap Stats (Image 6)
    val allSafarNames = remember(campaigns) {
        listOf("ALL") + campaigns.map { it.name }.distinct().sorted()
    }
    val gregorianYears = remember {
        val cur = Calendar.getInstance().get(Calendar.YEAR)
        listOf(cur, cur - 1, cur - 2)
    }

    val filteredCampaignTasks = remember(
        campaigns,
        periodMode,
        selectedStatsYear,
        selectedGregorianYear,
        selectedStatsMonth,
        selectedSafarFilter,
        statsSearchQuery
    ) {
        campaigns.filter { camp ->
            selectedSafarFilter == "ALL" || camp.name == selectedSafarFilter
        }.flatMap { camp ->
            camp.tasks.filter { task ->
                val searchOk = statsSearchQuery.isBlank() ||
                    camp.name.contains(statsSearchQuery, true) ||
                    task.displayTitle.contains(statsSearchQuery, true) ||
                    task.effectiveVideoEditor.contains(statsSearchQuery, true)
                if (!searchOk) return@filter false

                when (periodMode) {
                    StatsPeriodMode.ALL_RECORDS -> true
                    StatsPeriodMode.HIJRI -> {
                        val ym = HijriSummaryEngine.parseHijriYearAndMonth(task.title)
                            ?: HijriSummaryEngine.parseHijriYearAndMonth(task.hijriDate)
                            ?: HijriSummaryEngine.parseCampaignYearAndMonth(camp)
                        val yr = ym?.first ?: HijriSummaryEngine.parseCampaignYear(camp)
                        val yearOk = yr == null || yr == selectedStatsYear
                        val monthOk = selectedStatsMonth == 0 || ym?.second == selectedStatsMonth
                        yearOk && monthOk
                    }
                    StatsPeriodMode.GREGORIAN -> {
                        val ts = task.renderedAt ?: task.updatedAt
                        val cal = Calendar.getInstance().apply { timeInMillis = ts }
                        val yearOk = cal.get(Calendar.YEAR) == selectedGregorianYear
                        val monthOk = selectedStatsMonth == 0 || (cal.get(Calendar.MONTH) + 1) == selectedStatsMonth
                        yearOk && monthOk
                    }
                }
            }.map { task -> camp to task }
        }
    }

    val safarStatGroups = remember(filteredCampaignTasks, campaigns) {
        val byCamp = filteredCampaignTasks.groupBy { it.first.name }
        byCamp.map { (name, pairs) ->
            val camp = pairs.first().first
            val tasks = pairs.map { it.second }
            val periodVids = tasks.sumOf { t -> t.renderVideoCount ?: if (t.isVideoDelivered) 1 else 0 }
            val allTimeVids = camp.tasks.sumOf { t -> t.renderVideoCount ?: if (t.isVideoDelivered) 1 else 0 }
            val dur = tasks.sumOf { it.renderDurationSeconds ?: 0.0 }
            SafarStatGroup(
                safarName = name,
                periodVideos = periodVids,
                allTimeVideos = allTimeVids,
                sessionsCount = tasks.size,
                durationSeconds = dur,
                deliveredCount = tasks.count { it.isVideoDelivered },
                totalDates = tasks.size,
                isArchived = camp.isArchived
            )
        }.sortedByDescending { it.periodVideos }
    }

    val categoryGroups = remember(filteredCampaignTasks) {
        Stage.entries.map { st ->
            val tasks = filteredCampaignTasks.map { it.second }.filter { it.stage == st }
            CategoryStatGroup(
                categoryName = st.title,
                color = st.composeColor,
                videosCount = tasks.sumOf { it.renderVideoCount ?: 1 },
                sessionsCount = tasks.size,
                durationSeconds = tasks.sumOf { it.renderDurationSeconds ?: 0.0 }
            )
        }.filter { it.sessionsCount > 0 }
    }

    val totalVideosInPeriod = remember(safarStatGroups) { safarStatGroups.sumOf { it.periodVideos } }
    val totalDurationInPeriod = remember(safarStatGroups) { safarStatGroups.sumOf { it.durationSeconds } }
    val topSafarName = remember(safarStatGroups) {
        safarStatGroups.maxByOrNull { it.periodVideos }?.takeIf { it.periodVideos > 0 }?.safarName ?: "—"
    }

    val turnaroundSamples = remember(auditLogs) { auditLogs.mapNotNull { it.turnaroundMs } }
    val avgTurnaroundMinutes = if (turnaroundSamples.isNotEmpty()) (turnaroundSamples.average() / 60000.0).toInt() else null

    Box(modifier = modifier.fillMaxSize().statusBarsPadding()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Stats & Analytics", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text("One Tap production metrics & Hijri reports", color = TextSecondary, fontSize = 12.sp)
                    }
                    if (currentTab == AnalyticsTab.ONE_TAP_STATS) {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(LightSurface)
                                .border(1.dp, LightBorder, RoundedCornerShape(10.dp))
                                .clickable {
                                    periodMode = StatsPeriodMode.HIJRI
                                    selectedStatsMonth = 0
                                    selectedSafarFilter = "ALL"
                                    statsSearchQuery = ""
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(Icons.Default.RestartAlt, contentDescription = "Reset", tint = BrandCrimson, modifier = Modifier.size(14.dp))
                            Text("Reset", color = BrandCrimson, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Top-level Navigation Pills
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TabPill("Stats", Icons.Default.BarChart, currentTab == AnalyticsTab.ONE_TAP_STATS) { currentTab = AnalyticsTab.ONE_TAP_STATS }
                    TabPill("Hijri Reports", Icons.Default.DateRange, currentTab == AnalyticsTab.HIJRI_SUMMARY) { currentTab = AnalyticsTab.HIJRI_SUMMARY }
                    TabPill("Live Audit & SLA", Icons.Default.History, currentTab == AnalyticsTab.AUDIT_AND_SLA) { currentTab = AnalyticsTab.AUDIT_AND_SLA }
                }
            }

            if (currentTab == AnalyticsTab.ONE_TAP_STATS) {
                // Sub-view switcher: By Category | By Safar | Re-edit History + Grid/List
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            modifier = Modifier.weight(1f).horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            SubViewChip("By Category", Icons.Default.Category, subView == StatsSubView.BY_CATEGORY) { subView = StatsSubView.BY_CATEGORY }
                            SubViewChip("By Safar", Icons.Default.FolderOpen, subView == StatsSubView.BY_SAFAR) { subView = StatsSubView.BY_SAFAR }
                            SubViewChip("Re-edit History", Icons.Default.History, subView == StatsSubView.REEDIT_HISTORY) { subView = StatsSubView.REEDIT_HISTORY }
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(LightSurface)
                                .border(1.dp, LightBorder, RoundedCornerShape(10.dp))
                                .padding(2.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isGridView) BrandCrimson else Color.Transparent)
                                    .clickable { isGridView = true }
                                    .padding(6.dp)
                            ) {
                                Icon(Icons.Default.GridView, contentDescription = "Grid", tint = if (isGridView) Color.White else TextSecondary, modifier = Modifier.size(16.dp))
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (!isGridView) BrandCrimson else Color.Transparent)
                                    .clickable { isGridView = false }
                                    .padding(6.dp)
                            ) {
                                Icon(Icons.AutoMirrored.Filled.ViewList, contentDescription = "List", tint = if (!isGridView) Color.White else TextSecondary, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                // Period + Dropdown Filters Card (matches Image 6)
                item {
                    Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(cornerRadius = 14.dp).padding(12.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("PERIOD:", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                FilterChip("Hijri", periodMode == StatsPeriodMode.HIJRI) { periodMode = StatsPeriodMode.HIJRI }
                                FilterChip("Gregorian", periodMode == StatsPeriodMode.GREGORIAN) { periodMode = StatsPeriodMode.GREGORIAN }
                                FilterChip("All Records", periodMode == StatsPeriodMode.ALL_RECORDS) { periodMode = StatsPeriodMode.ALL_RECORDS }
                            }

                            if (periodMode != StatsPeriodMode.ALL_RECORDS) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (periodMode == StatsPeriodMode.HIJRI) {
                                        StudioDropdownSelector(
                                            label = "YEAR",
                                            selectedText = "${selectedStatsYear}H",
                                            items = availableHijriYears,
                                            selectedItem = selectedStatsYear,
                                            itemLabel = { "${it}H" },
                                            leadingIcon = Icons.Default.CalendarMonth,
                                            onSelect = { selectedStatsYear = it },
                                            modifier = Modifier.weight(0.42f)
                                        )
                                        val monthItems = listOf(0 to "All Months") + HijriSummaryEngine.HIJRI_MONTHS.map { it.monthNumber to "${it.monthNumber}. ${it.canonicalName.substringBefore(" ")}" }
                                        val selMonthItem = monthItems.firstOrNull { it.first == selectedStatsMonth } ?: monthItems.first()
                                        StudioDropdownSelector(
                                            label = "MONTH",
                                            selectedText = selMonthItem.second,
                                            items = monthItems,
                                            selectedItem = selMonthItem,
                                            itemLabel = { it.second },
                                            onSelect = { selectedStatsMonth = it.first },
                                            modifier = Modifier.weight(0.58f)
                                        )
                                    } else {
                                        StudioDropdownSelector(
                                            label = "YEAR",
                                            selectedText = "$selectedGregorianYear",
                                            items = gregorianYears,
                                            selectedItem = selectedGregorianYear,
                                            itemLabel = { "$it" },
                                            leadingIcon = Icons.Default.Public,
                                            onSelect = { selectedGregorianYear = it },
                                            modifier = Modifier.weight(0.42f)
                                        )
                                        val gregMonths = listOf(0 to "All Months") + (1..12).map { m ->
                                            m to SimpleDateFormat("MMMM", Locale.US).format(Calendar.getInstance().apply { set(Calendar.MONTH, m - 1) }.time)
                                        }
                                        val selGMonth = gregMonths.firstOrNull { it.first == selectedStatsMonth } ?: gregMonths.first()
                                        StudioDropdownSelector(
                                            label = "MONTH",
                                            selectedText = selGMonth.second,
                                            items = gregMonths,
                                            selectedItem = selGMonth,
                                            itemLabel = { it.second },
                                            onSelect = { selectedStatsMonth = it.first },
                                            modifier = Modifier.weight(0.58f)
                                        )
                                    }
                                }
                            }

                            if (periodMode != StatsPeriodMode.ALL_RECORDS) {
                                StudioDropdownSelector(
                                    label = "SAFAR",
                                    selectedText = if (selectedSafarFilter == "ALL") "All Safars" else selectedSafarFilter,
                                    items = allSafarNames,
                                    selectedItem = selectedSafarFilter,
                                    itemLabel = { if (it == "ALL") "All Safars" else it },
                                    leadingIcon = Icons.Default.FolderOpen,
                                    onSelect = { selectedSafarFilter = it }
                                )
                            }
                        }
                    }
                }

                // Showing badge + Search bar
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val periodLabel = when (periodMode) {
                            StatsPeriodMode.ALL_RECORDS -> "All Records"
                            StatsPeriodMode.HIJRI -> {
                                val mStr = if (selectedStatsMonth == 0) "All Months" else HijriSummaryEngine.getMonthName(selectedStatsMonth)
                                "$mStr ${selectedStatsYear}H"
                            }
                            StatsPeriodMode.GREGORIAN -> {
                                val mStr = if (selectedStatsMonth == 0) "All Months" else "Month $selectedStatsMonth"
                                "$mStr $selectedGregorianYear"
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(IndigoSoft).padding(horizontal = 8.dp, vertical = 4.dp)) {
                                Text("Showing: $periodLabel", color = IndigoPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            Text("${filteredCampaignTasks.size} sessions", color = TextSecondary, fontSize = 11.sp)
                        }
                        OutlinedTextField(
                            value = statsSearchQuery,
                            onValueChange = { statsSearchQuery = it },
                            placeholder = { Text("Search by serial, Safar, or date…", fontSize = 13.sp, color = TextMuted) },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }

                // Content area based on subView
                when (subView) {
                    StatsSubView.BY_SAFAR -> {
                        if (safarStatGroups.isEmpty()) {
                            item {
                                Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(14.dp).padding(24.dp), contentAlignment = Alignment.Center) {
                                    Text("No records match the selected period & filters.", color = TextSecondary, fontSize = 13.sp)
                                }
                            }
                        } else if (isGridView) {
                            items(safarStatGroups.chunked(2)) { pair ->
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    pair.forEach { group ->
                                        SafarStatGridCard(
                                            group = group,
                                            onToggleArchive = { pendingArchiveSafar = group.safarName to !group.isArchived },
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                    if (pair.size == 1) Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        } else {
                            items(safarStatGroups, key = { it.safarName }) { group ->
                                SafarStatListCard(
                                    group = group,
                                    onToggleArchive = { pendingArchiveSafar = group.safarName to !group.isArchived }
                                )
                            }
                        }
                    }

                    StatsSubView.BY_CATEGORY -> {
                        items(categoryGroups, key = { it.categoryName }) { cat ->
                            Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(14.dp).padding(14.dp)) {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text(cat.categoryName, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                        Text("${cat.videosCount} videos", color = cat.color, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                                    }
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Sessions: ${cat.sessionsCount}", color = TextSecondary, fontSize = 12.sp)
                                        Text("Duration: ${formatDurationCompact(cat.durationSeconds)}", color = TextSecondary, fontSize = 12.sp)
                                    }
                                    val ratio = (cat.sessionsCount.toFloat() / filteredCampaignTasks.size.coerceAtLeast(1)).coerceIn(0f, 1f)
                                    LinearProgressIndicator(
                                        progress = { ratio },
                                        modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                                        color = cat.color,
                                        trackColor = LightSurfaceSubtle
                                    )
                                }
                            }
                        }
                    }

                    StatsSubView.REEDIT_HISTORY -> {
                        if (auditLogs.isEmpty()) {
                            item {
                                Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(14.dp).padding(24.dp), contentAlignment = Alignment.Center) {
                                    Text("No re-edit or stage change history recorded yet.", color = TextSecondary, fontSize = 13.sp)
                                }
                            }
                        } else {
                            items(auditLogs.take(40), key = { it.id }) { log ->
                                val timeStr = SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault()).format(Date(log.timestamp))
                                Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(12.dp).padding(12.dp)) {
                                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text(SafarTask.formatSessionTitle(log.dateFolder), color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                            Text(timeStr, color = TextMuted, fontSize = 11.sp)
                                        }
                                        Text("${log.safarName} • ${log.action} (${log.actor})", color = TextSecondary, fontSize = 11.sp)
                                        if (log.fromValue.isNotBlank() || log.toValue.isNotBlank()) {
                                            Text("${log.fromValue} → ${log.toValue}", color = IndigoPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Bottom Summary Bar (matches Image 6: TOTAL VIDEOS, DURATION PROCESSED, TOP SAFAR)
                item {
                    Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(14.dp, LightBorder).padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("TOTAL VIDEOS", color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text("$totalVideosInPeriod", color = IndigoPrimary, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                            }
                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("DURATION PROCESSED", color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(formatDurationCompact(totalDurationInPeriod), color = IndigoPrimary, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                            }
                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("TOP SAFAR", color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    topSafarName,
                                    color = TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }

            // Image 3: Hijri Reports with styled dropdown menus for Year & Month
            if (currentTab == AnalyticsTab.HIJRI_SUMMARY) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(cornerRadius = 14.dp).padding(12.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            StudioDropdownSelector(
                                label = "HIJRI YEAR",
                                selectedText = "${reportYear}H",
                                items = availableHijriYears,
                                selectedItem = reportYear,
                                itemLabel = { "${it}H" },
                                leadingIcon = Icons.Default.CalendarMonth,
                                onSelect = { reportYear = it },
                                modifier = Modifier.weight(0.4f)
                            )
                            val selectedMonthObj = HijriSummaryEngine.HIJRI_MONTHS.firstOrNull { it.monthNumber == reportMonth }
                                ?: HijriSummaryEngine.HIJRI_MONTHS.first()
                            StudioDropdownSelector(
                                label = "HIJRI MONTH",
                                selectedText = "${selectedMonthObj.monthNumber}. ${selectedMonthObj.canonicalName}",
                                items = HijriSummaryEngine.HIJRI_MONTHS,
                                selectedItem = selectedMonthObj,
                                itemLabel = { "${it.monthNumber}. ${it.canonicalName}" },
                                leadingIcon = Icons.Default.DateRange,
                                onSelect = { reportMonth = it.monthNumber },
                                modifier = Modifier.weight(0.6f)
                            )
                        }
                    }
                }
                item {
                    Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(cornerRadius = 16.dp).padding(16.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("${monthSummary.monthName} (${reportYear}H)", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            Text("${monthSummary.campaignsCount} Safars • ${monthSummary.deliveredVideosCount}/${monthSummary.totalScheduledDates} Videos (${monthSummary.completionPercentage}%)", color = TextSecondary, fontSize = 13.sp)
                            LinearProgressIndicator(progress = { monthSummary.completionPercentage / 100f }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)), color = EmeraldSuccess, trackColor = LightSurfaceSubtle)
                            Button(onClick = { WhatsAppShareManager.shareTextMessage(context, HijriSummaryEngine.formatMonthEndBriefing(monthSummary)) }, modifier = Modifier.fillMaxWidth().height(42.dp), shape = RoundedCornerShape(10.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White)) {
                                Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Share ${reportYear}H Month Report", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                item {
                    Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(cornerRadius = 16.dp).padding(16.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Annual ${reportYear}H Audit", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            Text("${yearSummary.totalSafars} Safars (${yearSummary.safars100PercentDone} 100% Done) • ${yearSummary.totalDatesDelivered}/${yearSummary.totalScheduledDates} Dates (${yearSummary.overallPercentage}%)", color = TextSecondary, fontSize = 13.sp)
                            Button(onClick = { WhatsAppShareManager.shareTextMessage(context, HijriSummaryEngine.formatAnnualHijriBriefing(yearSummary)) }, modifier = Modifier.fillMaxWidth().height(42.dp), shape = RoundedCornerShape(10.dp), colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)) {
                                Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Share Annual Audit to WhatsApp", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            if (currentTab == AnalyticsTab.AUDIT_AND_SLA) {
                item {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatMiniCard("SYNC LATENCY", if (syncState.latencyMs > 0) "${syncState.latencyMs}ms" else "—", if (syncState.isRealtimeConnected) "WebSocket Live" else "Polling", BlueDark, Modifier.weight(1f))
                        StatMiniCard("AVG STAGE TIME", avgTurnaroundMinutes?.let { "${it}m" } ?: "—", "${turnaroundSamples.size} transitions", AmberDark, Modifier.weight(1f))
                        StatMiniCard("AUDIT EVENTS", "${auditLogs.size}", "Recorded locally", IndigoPrimary, Modifier.weight(1f))
                    }
                }
                items(auditLogs, key = { it.id }) { log ->
                    val timeStr = SimpleDateFormat("MMM dd, HH:mm:ss", Locale.getDefault()).format(Date(log.timestamp))
                    Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(cornerRadius = 12.dp).padding(12.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("${log.action}: ${SafarTask.formatSessionTitle(log.dateFolder)}", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                Text(timeStr, color = TextMuted, fontSize = 11.sp)
                            }
                            Text("${log.safarName} • ${log.actor}", color = TextSecondary, fontSize = 11.sp)
                            if (log.fromValue.isNotBlank() || log.toValue.isNotBlank()) {
                                Text("${log.fromValue} → ${log.toValue}", color = IndigoPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }
    }

    pendingArchiveSafar?.let { (safarName, willArchive) ->
        AlertDialog(
            onDismissRequest = { pendingArchiveSafar = null },
            containerColor = LightSurface,
            title = {
                Text(
                    if (willArchive) "Archive Safar?" else "Unarchive Safar?",
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    if (willArchive) "Move \"$safarName\" to Archived Safars? It will be hidden from Active Safar stats and Kanban."
                    else "Restore \"$safarName\" back to Active Safars?",
                    color = TextSecondary,
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        repository.toggleSafarArchive(safarName, willArchive)
                        pendingArchiveSafar = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (willArchive) AmberDark else IndigoPrimary,
                        contentColor = Color.White
                    )
                ) { Text(if (willArchive) "Archive" else "Unarchive") }
            },
            dismissButton = {
                TextButton(onClick = { pendingArchiveSafar = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
private fun SafarStatGridCard(
    group: SafarStatGroup,
    onToggleArchive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pct = if (group.totalDates > 0) (group.deliveredCount.toFloat() / group.totalDates).coerceIn(0f, 1f) else 0f
    Box(modifier = modifier.liquidGlassCard(cornerRadius = 14.dp).padding(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Text(
                    text = group.safarName,
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Icon(
                    if (group.isArchived) Icons.Default.Unarchive else Icons.Default.Archive,
                    contentDescription = null,
                    tint = TextMuted,
                    modifier = Modifier.size(16.dp).clickable { onToggleArchive() }
                )
            }
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("${group.periodVideos}", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
                Text("TOTAL VIDEOS", color = IndigoPrimary, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                StatMetaRow(Icons.Default.FolderOpen, "Sessions:", "${group.sessionsCount}")
                StatMetaRow(Icons.Default.Timer, "Duration:", formatDurationCompact(group.durationSeconds))
                StatMetaRow(Icons.Default.Movie, "All-time:", "${group.allTimeVideos} videos")
            }
            LinearProgressIndicator(
                progress = { pct },
                modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)),
                color = if (pct >= 1f) EmeraldSuccess else BrandCrimson,
                trackColor = LightSurfaceSubtle
            )
        }
    }
}

@Composable
private fun SafarStatListCard(
    group: SafarStatGroup,
    onToggleArchive: () -> Unit
) {
    val pct = if (group.totalDates > 0) (group.deliveredCount.toFloat() / group.totalDates).coerceIn(0f, 1f) else 0f
    Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(cornerRadius = 14.dp).padding(14.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(group.safarName, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Text("${group.sessionsCount} sessions • ${formatDurationCompact(group.durationSeconds)} • ${group.allTimeVideos} all-time videos", color = TextSecondary, fontSize = 11.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${group.periodVideos} vids", color = IndigoPrimary, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                    IconButton(onClick = onToggleArchive, modifier = Modifier.size(28.dp)) {
                        Icon(if (group.isArchived) Icons.Default.Unarchive else Icons.Default.Archive, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(16.dp))
                    }
                }
            }
            LinearProgressIndicator(
                progress = { pct },
                modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)),
                color = if (pct >= 1f) EmeraldSuccess else BrandCrimson,
                trackColor = LightSurfaceSubtle
            )
        }
    }
}

@Composable
private fun StatMetaRow(icon: ImageVector, label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(icon, contentDescription = null, tint = TextMuted, modifier = Modifier.size(12.dp))
            Text(label, color = TextSecondary, fontSize = 11.sp)
        }
        Text(value, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun TabPill(label: String, icon: ImageVector, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) IndigoPrimary else LightSurface)
            .border(1.dp, if (selected) IndigoPrimary else LightBorder, RoundedCornerShape(12.dp))
            .liquidBouncyClick(pressScale = 0.94f) { onClick() }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = if (selected) Color.White else TextSecondary, modifier = Modifier.size(16.dp))
        Spacer(modifier = Modifier.width(6.dp))
        Text(label, color = if (selected) Color.White else TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SubViewChip(label: String, icon: ImageVector, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) BrandCrimson else LightSurface)
            .border(1.dp, if (selected) BrandCrimson else LightBorder, RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Icon(icon, contentDescription = null, tint = if (selected) Color.White else TextSecondary, modifier = Modifier.size(14.dp))
        Text(label, color = if (selected) Color.White else TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(18.dp))
            .background(if (selected) IndigoPrimary else LightSurface)
            .border(1.dp, if (selected) IndigoPrimary else LightBorder, RoundedCornerShape(18.dp))
            .liquidBouncyClick(pressScale = 0.94f) { onClick() }
            .padding(horizontal = 11.dp, vertical = 5.dp)
    ) {
        Text(label, color = if (selected) Color.White else TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun StatMiniCard(label: String, value: String, sub: String, color: Color, modifier: Modifier = Modifier) {
    Box(modifier = modifier.liquidGlassCard(cornerRadius = 12.dp).padding(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            Text(value, color = color, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text(sub, color = TextSecondary, fontSize = 10.sp)
        }
    }
}
