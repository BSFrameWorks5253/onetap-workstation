package com.onetap.studiotracker.ui.screens.analytics

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.data.analytics.HijriSummaryEngine
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.theme.ColorAlJameaDone
import com.onetap.studiotracker.ui.theme.DarkBackground
import com.onetap.studiotracker.ui.theme.DarkBorder
import com.onetap.studiotracker.ui.theme.DarkSurface
import com.onetap.studiotracker.ui.theme.DarkSurfaceElevated
import com.onetap.studiotracker.ui.theme.EmeraldGlow
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.OneTapStudioTheme
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.util.BatchNotificationManager
import com.onetap.studiotracker.util.BatchRenderEventItem
import com.onetap.studiotracker.util.BatchRenderSummaryNotification
import com.onetap.studiotracker.util.WhatsAppShareManager

enum class AnalyticsTab {
    HIJRI_MONTH,
    HIJRI_YEAR,
    WORKSTATION_TELEMETRY
}

@Composable
fun StudioAnalyticsScreen(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val repository = SafarRepository.getInstance()
    val campaigns by repository.campaigns.collectAsState()
    val stats = repository.getStudioStats()

    var currentTab by remember { mutableStateOf(AnalyticsTab.HIJRI_MONTH) }
    var selectedHijriMonth by remember { mutableIntStateOf(6) } // Default to Jumada al-Ukhra (1447-06)
    val hijriYear = 1447

    val monthSummary = remember(campaigns, selectedHijriMonth) {
        HijriSummaryEngine.generateMonthSummary(campaigns, hijriYear, selectedHijriMonth)
    }

    val yearSummary = remember(campaigns) {
        HijriSummaryEngine.generateAnnualHijriReport(campaigns, hijriYear)
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 80.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            item {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "Studio Analytics & Hijri Summary",
                        color = TextPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Hijri month-end reports, annual audits, and desktop telemetry",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                }
            }

            // Mode Selector Tabs
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(DarkSurfaceElevated)
                        .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
                        .padding(4.dp)
                ) {
                    listOf(
                        Triple(AnalyticsTab.HIJRI_MONTH, "🌙 Month-End", Icons.Default.DateRange),
                        Triple(AnalyticsTab.HIJRI_YEAR, "🏆 Year-End", Icons.Default.EmojiEvents),
                        Triple(AnalyticsTab.WORKSTATION_TELEMETRY, "💻 Telemetry", Icons.Default.Computer)
                    ).forEach { (tab, title, icon) ->
                        val isSelected = currentTab == tab
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) IndigoPrimary else Color.Transparent)
                                .clickable { currentTab = tab }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = icon,
                                    contentDescription = null,
                                    tint = if (isSelected) Color.White else TextMuted,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = title,
                                    color = if (isSelected) Color.White else TextSecondary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }

            // ── TAB 1: HIJRI MONTH-END SUMMARY ──
            if (currentTab == AnalyticsTab.HIJRI_MONTH) {
                // Month Selector Horizontal Scroll
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        HijriSummaryEngine.HIJRI_MONTHS.forEach { m ->
                            val isSelected = selectedHijriMonth == m.monthNumber
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSelected) IndigoPrimary else DarkSurface)
                                    .border(1.dp, if (isSelected) IndigoPrimary else DarkBorder, RoundedCornerShape(10.dp))
                                    .clickable { selectedHijriMonth = m.monthNumber }
                                    .padding(horizontal = 12.dp, vertical = 7.dp)
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = m.canonicalName,
                                        color = if (isSelected) Color.White else TextPrimary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Text(
                                        text = "Month ${m.monthNumber} • $hijriYear H",
                                        color = if (isSelected) Color(0xFFC7D2FE) else TextMuted,
                                        fontSize = 10.sp
                                    )
                                }
                            }
                        }
                    }
                }

                // Month Milestone Executive Card
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        DarkSurfaceElevated,
                                        DarkSurface
                                    )
                                )
                            )
                            .border(
                                1.5.dp,
                                if (monthSummary.is100PercentMonthDone) EmeraldSuccess else DarkBorder,
                                RoundedCornerShape(18.dp)
                            )
                            .padding(18.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "🌙 HIJRI MONTH-END AUDIT",
                                    color = Color(0xFF38BDF8),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.5.sp
                                )

                                if (monthSummary.is100PercentMonthDone) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(EmeraldSuccess.copy(alpha = 0.2f))
                                            .padding(horizontal = 8.dp, vertical = 3.dp)
                                    ) {
                                        Text(
                                            text = "100% ARCHIVED",
                                            color = EmeraldSuccess,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }

                            Text(
                                text = "${monthSummary.monthName} ($hijriYear H)",
                                color = TextPrimary,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )

                            // Progress Bar
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "${monthSummary.deliveredVideosCount} of ${monthSummary.totalScheduledDates} Dates Delivered",
                                        color = TextSecondary,
                                        fontSize = 12.sp
                                    )
                                    Text(
                                        text = "${monthSummary.completionPercentage}%",
                                        color = if (monthSummary.is100PercentMonthDone) EmeraldSuccess else TextPrimary,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                LinearProgressIndicator(
                                    progress = { if (monthSummary.totalScheduledDates > 0) monthSummary.deliveredVideosCount.toFloat() / monthSummary.totalScheduledDates else 0f },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(8.dp)
                                        .clip(RoundedCornerShape(4.dp)),
                                    color = if (monthSummary.is100PercentMonthDone) EmeraldSuccess else IndigoPrimary,
                                    trackColor = DarkBackground
                                )
                            }

                            // Volume Stats Row
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(DarkSurface)
                                        .border(1.dp, DarkBorder, RoundedCornerShape(10.dp))
                                        .padding(10.dp)
                                ) {
                                    Column {
                                        Text(text = "TOTAL RUNTIME", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "${monthSummary.totalRuntimeMinutes / 60}h ${monthSummary.totalRuntimeMinutes % 60}m", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "Final cut master", color = TextSecondary, fontSize = 11.sp)
                                    }
                                }

                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(DarkSurface)
                                        .border(1.dp, DarkBorder, RoundedCornerShape(10.dp))
                                        .padding(10.dp)
                                ) {
                                    Column {
                                        Text(text = "DRIVE PHOTOS", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "${monthSummary.totalPhotosArchived}", color = EmeraldSuccess, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "Cloud synced", color = TextSecondary, fontSize = 11.sp)
                                    }
                                }
                            }

                            // Editor Velocity Leaderboard
                            if (monthSummary.editorLeaderboard.isNotEmpty()) {
                                Text(
                                    text = "Editor Delivery Velocity:",
                                    color = TextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    monthSummary.editorLeaderboard.forEach { (editor, count) ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(DarkSurface)
                                                .padding(horizontal = 10.dp, vertical = 6.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(imageVector = Icons.Default.Person, contentDescription = null, tint = Color(0xFF818CF8), modifier = Modifier.size(14.dp))
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text(text = editor, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                            }
                                            Text(text = "$count videos", color = EmeraldSuccess, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }

                            // WhatsApp and Copy Actions
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = {
                                        val briefingText = HijriSummaryEngine.formatMonthEndBriefing(monthSummary)
                                        WhatsAppShareManager.shareTextMessage(context, briefingText)
                                    },
                                    modifier = Modifier.weight(1.3f).height(44.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White)
                                ) {
                                    Icon(imageVector = Icons.Default.Chat, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(text = "Share to WhatsApp", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }

                                OutlinedButton(
                                    onClick = {
                                        val briefingText = HijriSummaryEngine.formatMonthEndBriefing(monthSummary)
                                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        clipboard.setPrimaryClip(ClipData.newPlainText("Hijri Month Report", briefingText))
                                        Toast.makeText(context, "Hijri Month-End Report copied!", Toast.LENGTH_SHORT).show()
                                    },
                                    modifier = Modifier.weight(1f).height(44.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, DarkBorder),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary)
                                ) {
                                    Icon(imageVector = Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(14.dp), tint = TextSecondary)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(text = "Copy Report", fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }

            // ── TAB 2: HIJRI ANNUAL YEAR-END AUDIT ──
            if (currentTab == AnalyticsTab.HIJRI_YEAR) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(DarkSurfaceElevated)
                            .border(1.5.dp, Color(0xFFF59E0B), RoundedCornerShape(18.dp))
                            .padding(18.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "🏆 ANNUAL HIJRI PRODUCTION REVIEW",
                                    color = Color(0xFFF59E0B),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "$hijriYear H",
                                    color = TextPrimary,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Text(
                                text = "Year $hijriYear Hijri Full Production Audit",
                                color = TextPrimary,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(DarkSurface).padding(10.dp)
                                ) {
                                    Column {
                                        Text(text = "CAMPAIGNS", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "${yearSummary.totalSafars}", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "${yearSummary.safars100PercentDone} 100% Done", color = EmeraldSuccess, fontSize = 10.sp)
                                    }
                                }

                                Box(
                                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(DarkSurface).padding(10.dp)
                                ) {
                                    Column {
                                        Text(text = "TOTAL CUTS", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "${yearSummary.totalDatesDelivered}", color = Color(0xFF38BDF8), fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "Final videos", color = TextSecondary, fontSize = 10.sp)
                                    }
                                }

                                Box(
                                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(DarkSurface).padding(10.dp)
                                ) {
                                    Column {
                                        Text(text = "CUT HOURS", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Text(text = String.format("%.1fh", yearSummary.totalRuntimeHours), color = EmeraldGlow, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "Rendered", color = TextSecondary, fontSize = 10.sp)
                                    }
                                }
                            }

                            // Share Annual Report Button
                            Button(
                                onClick = {
                                    val text = HijriSummaryEngine.formatAnnualHijriBriefing(yearSummary)
                                    WhatsAppShareManager.shareTextMessage(context, text)
                                },
                                modifier = Modifier.fillMaxWidth().height(44.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White)
                            ) {
                                Icon(imageVector = Icons.Default.Chat, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(text = "Share Annual Audit to WhatsApp", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // ── TAB 3: WORKSTATION TELEMETRY & BATCH RENDERS ──
            if (currentTab == AnalyticsTab.WORKSTATION_TELEMETRY) {
                // Batch Render Alert Trigger Card
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(DarkSurfaceElevated)
                            .border(1.dp, Color(0xFF38BDF8).copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                            .padding(16.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFF38BDF8).copy(alpha = 0.2f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(imageVector = Icons.Default.NotificationsActive, contentDescription = null, tint = Color(0xFF38BDF8), modifier = Modifier.size(20.dp))
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(text = "Real-Time Batch Render Alerts", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "Instant phone notifications when rendering batches finish", color = TextMuted, fontSize = 11.sp)
                                    }
                                }
                            }

                            Text(
                                text = "Whenever Adobe Media Encoder or One Tap Workstation finishes exporting a batch of dates on your desktop, your phone immediately receives a summary notification with video count and event-by-event breakdown.",
                                color = TextSecondary,
                                fontSize = 12.sp,
                                lineHeight = 16.sp
                            )

                            // Test Notification Button
                            Button(
                                onClick = {
                                    val sampleEvents = listOf(
                                        BatchRenderEventItem("Day 1 - Majlis Opening", "Mumbai Safar", 48, "Mustafa", "rendered"),
                                        BatchRenderEventItem("Day 2 - Morning Ziyarat", "Mumbai Safar", 52, "Ali", "rendered"),
                                        BatchRenderEventItem("Day 3 - Community Gathering", "Mumbai Safar", 65, "Hussain", "rendered")
                                    )
                                    val notification = BatchRenderSummaryNotification(
                                        batchId = "batch_${System.currentTimeMillis()}",
                                        title = "Render Batch Complete: 3 Dates Rendered!",
                                        safarName = "1447-06 Safar Mubaraka - Mumbai",
                                        totalVideos = 3,
                                        totalDurationMinutes = 165,
                                        events = sampleEvents
                                    )
                                    BatchNotificationManager.showBatchRenderNotification(context, notification)
                                    Toast.makeText(context, "Simulated batch notification triggered on phone!", Toast.LENGTH_SHORT).show()
                                },
                                modifier = Modifier.fillMaxWidth().height(42.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
                            ) {
                                Icon(imageVector = Icons.Default.Movie, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(text = "Test Batch Render Notification", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                // Recent Rendered Events Breakdown Card
                item {
                    Text(
                        text = "Current Ingest & Rendered Events",
                        color = TextPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                items(campaigns.firstOrNull()?.tasks ?: emptyList()) { task ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(DarkSurface)
                            .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(text = task.title, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                Text(
                                    text = "Editor: ${task.videoEditor ?: "One Tap"} • ${task.durationMinutes} mins • ${task.uploadedPhotos} photos",
                                    color = TextMuted,
                                    fontSize = 11.sp
                                )
                            }
                            Text(
                                text = task.stage.title,
                                color = task.stage.composeColor,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0F172A)
@Composable
fun StudioAnalyticsScreenPreview() {
    OneTapStudioTheme {
        StudioAnalyticsScreen()
    }
}
