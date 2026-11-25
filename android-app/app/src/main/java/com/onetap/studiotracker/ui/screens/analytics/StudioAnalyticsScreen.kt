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
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.data.analytics.HijriSummaryEngine
import com.onetap.studiotracker.data.models.StudioStats
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.theme.AmberDark
import com.onetap.studiotracker.ui.theme.BlueDark
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.LightBackground
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.util.WhatsAppShareManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class AnalyticsTab {
    WORKSTATION_STATS,
    HIJRI_SUMMARY,
    AUDIT_AND_SLA
}

@Composable
fun StudioAnalyticsScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val repository = SafarRepository.getInstance()
    val campaigns by repository.campaigns.collectAsState()
    val auditLogs by repository.auditLogs.collectAsState()
    val syncState by repository.syncState.collectAsState()

    val stats = remember(campaigns) { StudioStats.calculate(campaigns) }
    val availableYears = remember(campaigns) { HijriSummaryEngine.detectAvailableYears(campaigns) }

    var currentTab by remember { mutableStateOf(AnalyticsTab.WORKSTATION_STATS) }
    var selectedYear by remember(availableYears) { mutableIntStateOf(availableYears.first()) }
    var selectedHijriMonth by remember { mutableIntStateOf(1) }
    var searchQuery by remember { mutableStateOf("") }
    var archiveFilter by remember { mutableStateOf("active") }

    val monthSummary = remember(campaigns, selectedYear, selectedHijriMonth) {
        HijriSummaryEngine.generateMonthSummary(campaigns, selectedYear, selectedHijriMonth)
    }
    val yearSummary = remember(campaigns, selectedYear) {
        HijriSummaryEngine.generateAnnualHijriReport(campaigns, selectedYear)
    }

    val filteredSafars = remember(campaigns, archiveFilter, searchQuery) {
        campaigns.filter { c ->
            val archMatch = when (archiveFilter) {
                "active" -> !c.isArchived
                "archived" -> c.isArchived
                else -> true
            }
            val qMatch = searchQuery.isBlank() || c.name.contains(searchQuery, ignoreCase = true)
            archMatch && qMatch
        }.sortedByDescending { it.totalDates }
    }

    val turnaroundSamples = remember(auditLogs) {
        auditLogs.mapNotNull { it.turnaroundMs }
    }
    val avgTurnaroundMinutes = if (turnaroundSamples.isNotEmpty()) {
        (turnaroundSamples.average() / 60000.0).toInt()
    } else null

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(LightBackground)
            .statusBarsPadding()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 84.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Workstation Stats & Analytics", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text("Live metrics from Supabase & real-time app audit log", color = TextSecondary, fontSize = 13.sp)
                }
            }

            // Tab Switcher
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TabPill("Workstation", Icons.Default.BarChart, currentTab == AnalyticsTab.WORKSTATION_STATS) {
                        currentTab = AnalyticsTab.WORKSTATION_STATS
                    }
                    TabPill("Hijri Reports", Icons.Default.DateRange, currentTab == AnalyticsTab.HIJRI_SUMMARY) {
                        currentTab = AnalyticsTab.HIJRI_SUMMARY
                    }
                    TabPill("Live Audit & SLA", Icons.Default.History, currentTab == AnalyticsTab.AUDIT_AND_SLA) {
                        currentTab = AnalyticsTab.AUDIT_AND_SLA
                    }
                }
            }

            if (currentTab == AnalyticsTab.WORKSTATION_STATS) {
                item {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatMiniCard("DELIVERY RATE", "${stats.overallDeliveryPercentage}%", "${stats.uploadedCount + stats.alJameaDoneCount}/${stats.totalScheduledDays} dates", EmeraldDark, Modifier.weight(1f))
                        StatMiniCard("ACTIVE SAFARS", "${stats.activeSafars}", "${stats.archivedSafars} archived", IndigoPrimary, Modifier.weight(1f))
                        StatMiniCard("OVERDUE", "${stats.overdueTasksCount}", "Past due date", if (stats.overdueTasksCount > 0) RoseError else TextSecondary, Modifier.weight(1f))
                    }
                }

                // Real Desktop Workstation Render Telemetry Card
                item {
                    val hasDesktopTelemetry = stats.totalRenderVideos > 0 || stats.totalRenderSizeBytes > 0L || stats.totalRenderDurationSeconds > 0.0 || stats.idleQaAlertsCount > 0
                    val totalGb = stats.totalRenderSizeBytes / (1024.0 * 1024.0 * 1024.0)
                    val totalHours = stats.totalRenderDurationSeconds / 3600.0
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(LightSurface)
                            .border(1.dp, LightBorder, RoundedCornerShape(14.dp))
                            .padding(14.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Desktop Workstation Telemetry", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            if (hasDesktopTelemetry) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    StatMiniCard("EXPORTED CLIPS", "${stats.totalRenderVideos}", "Final renders", IndigoPrimary, Modifier.weight(1f))
                                    StatMiniCard("RUNTIME", String.format(Locale.US, "%.1fh", totalHours), "Rendered video", EmeraldDark, Modifier.weight(1f))
                                    StatMiniCard("SIZE", String.format(Locale.US, "%.1f GB", totalGb), "${stats.idleQaAlertsCount} QA 48h+ idle", if (stats.idleQaAlertsCount > 0) AmberDark else TextSecondary, Modifier.weight(1f))
                                }
                            } else {
                                Text(
                                    text = "Waiting for One Tap Desktop to push render duration, file size, and Premiere idle telemetry to Supabase.",
                                    color = TextSecondary,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }

                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip("Active", archiveFilter == "active") { archiveFilter = "active" }
                            FilterChip("Archived", archiveFilter == "archived") { archiveFilter = "archived" }
                            FilterChip("All", archiveFilter == "all") { archiveFilter = "all" }
                        }
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Search Safars…", fontSize = 13.sp, color = TextMuted) },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }

                items(filteredSafars, key = { it.id }) { camp ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(LightSurface)
                            .border(1.dp, LightBorder, RoundedCornerShape(14.dp))
                            .padding(14.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(camp.name, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                    Text(
                                        text = "${camp.deliveredVideosCount}/${camp.totalDates} Videos (${camp.overallPercentage}%) • ${camp.deliveredPhotosCount}/${camp.totalDates} Photos",
                                        color = TextSecondary,
                                        fontSize = 11.sp
                                    )
                                }
                                IconButton(onClick = { repository.toggleSafarArchive(camp.name, !camp.isArchived) }) {
                                    Icon(
                                        imageVector = if (camp.isArchived) Icons.Default.Unarchive else Icons.Default.Archive,
                                        contentDescription = if (camp.isArchived) "Restore" else "Archive",
                                        tint = IndigoPrimary
                                    )
                                }
                            }
                            LinearProgressIndicator(
                                progress = { camp.overallPercentage / 100f },
                                modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                                color = if (camp.is100PercentDone) EmeraldSuccess else IndigoPrimary,
                                trackColor = LightSurfaceSubtle
                            )
                        }
                    }
                }
            }

            if (currentTab == AnalyticsTab.HIJRI_SUMMARY) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        availableYears.forEach { y ->
                            FilterChip("${y}H", selectedYear == y) { selectedYear = y }
                        }
                    }
                }
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        HijriSummaryEngine.HIJRI_MONTHS.forEach { m ->
                            FilterChip("${m.monthNumber}. ${m.canonicalName.substringBefore(" ")}", selectedHijriMonth == m.monthNumber) {
                                selectedHijriMonth = m.monthNumber
                            }
                        }
                    }
                }
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(LightSurface)
                            .border(1.dp, LightBorder, RoundedCornerShape(16.dp))
                            .padding(16.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("${monthSummary.monthName} (${selectedYear}H)", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            Text(
                                text = "${monthSummary.campaignsCount} Safars • ${monthSummary.deliveredVideosCount}/${monthSummary.totalScheduledDates} Videos Delivered (${monthSummary.completionPercentage}%)",
                                color = TextSecondary,
                                fontSize = 13.sp
                            )
                            LinearProgressIndicator(
                                progress = { monthSummary.completionPercentage / 100f },
                                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                                color = EmeraldSuccess,
                                trackColor = LightSurfaceSubtle
                            )
                            Button(
                                onClick = {
                                    WhatsAppShareManager.shareTextMessage(context, HijriSummaryEngine.formatMonthEndBriefing(monthSummary))
                                },
                                modifier = Modifier.fillMaxWidth().height(42.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White)
                            ) {
                                Icon(Icons.Default.Chat, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Share ${selectedYear}H Month Report", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(LightSurface)
                            .border(1.dp, LightBorder, RoundedCornerShape(16.dp))
                            .padding(16.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Annual ${selectedYear}H Audit", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            Text(
                                text = "${yearSummary.totalSafars} Safars (${yearSummary.safars100PercentDone} 100% Done) • ${yearSummary.totalDatesDelivered}/${yearSummary.totalScheduledDates} Dates (${yearSummary.overallPercentage}%)",
                                color = TextSecondary,
                                fontSize = 13.sp
                            )
                            Button(
                                onClick = {
                                    WhatsAppShareManager.shareTextMessage(context, HijriSummaryEngine.formatAnnualHijriBriefing(yearSummary))
                                },
                                modifier = Modifier.fillMaxWidth().height(42.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
                            ) {
                                Icon(Icons.Default.Chat, contentDescription = null, modifier = Modifier.size(16.dp))
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
                        StatMiniCard(
                            "SYNC LATENCY",
                            if (syncState.latencyMs > 0) "${syncState.latencyMs}ms" else "—",
                            if (syncState.isRealtimeConnected) "WebSocket Live" else "Polling",
                            BlueDark,
                            Modifier.weight(1f)
                        )
                        StatMiniCard(
                            "AVG STAGE TIME",
                            avgTurnaroundMinutes?.let { "${it}m" } ?: "—",
                            "${turnaroundSamples.size} transitions",
                            AmberDark,
                            Modifier.weight(1f)
                        )
                        StatMiniCard(
                            "AUDIT EVENTS",
                            "${auditLogs.size}",
                            "Recorded locally",
                            IndigoPrimary,
                            Modifier.weight(1f)
                        )
                    }
                }

                if (auditLogs.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(LightSurface)
                                .border(1.dp, LightBorder, RoundedCornerShape(14.dp))
                                .padding(20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Real stage transitions and edits will appear here automatically.", color = TextSecondary, fontSize = 13.sp)
                        }
                    }
                } else {
                    items(auditLogs, key = { it.id }) { log ->
                        val timeStr = SimpleDateFormat("MMM dd, HH:mm:ss", Locale.getDefault()).format(Date(log.timestamp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(LightSurface)
                                .border(1.dp, LightBorder, RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("${log.action}: ${log.dateFolder}", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
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
    }
}

@Composable
private fun TabPill(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) IndigoPrimary else LightSurface)
            .border(1.dp, if (selected) IndigoPrimary else LightBorder, RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = if (selected) Color.White else TextSecondary, modifier = Modifier.size(16.dp))
        Spacer(modifier = Modifier.width(6.dp))
        Text(label, color = if (selected) Color.White else TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (selected) IndigoPrimary else LightSurface)
            .border(1.dp, if (selected) IndigoPrimary else LightBorder, RoundedCornerShape(20.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(label, color = if (selected) Color.White else TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun StatMiniCard(label: String, value: String, sub: String, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(LightSurface)
            .border(1.dp, LightBorder, RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            Text(value, color = color, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text(sub, color = TextSecondary, fontSize = 10.sp)
        }
    }
}
