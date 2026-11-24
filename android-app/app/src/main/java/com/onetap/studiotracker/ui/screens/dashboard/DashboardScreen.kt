package com.onetap.studiotracker.ui.screens.dashboard

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.PendingActions
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import androidx.lifecycle.viewmodel.compose.viewModel
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.ui.components.ExecutiveHeroCard
import com.onetap.studiotracker.ui.components.KpiCard
import com.onetap.studiotracker.ui.components.MultiStageProgressBar
import com.onetap.studiotracker.ui.components.StageChip
import com.onetap.studiotracker.ui.components.WhatsAppBriefingSheet
import com.onetap.studiotracker.ui.theme.ColorAlJameaDone
import com.onetap.studiotracker.ui.theme.ColorEditingPending
import com.onetap.studiotracker.ui.theme.ColorInProgress
import com.onetap.studiotracker.ui.theme.ColorUploadPending
import com.onetap.studiotracker.ui.theme.ColorUploaded
import com.onetap.studiotracker.ui.theme.DarkBackground
import com.onetap.studiotracker.ui.theme.DarkBorder
import com.onetap.studiotracker.ui.theme.DarkSurface
import com.onetap.studiotracker.ui.theme.DarkSurfaceElevated
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary

@Composable
fun DashboardScreen(
    onNavigateKanban: () -> Unit,
    viewModel: DashboardViewModel = viewModel(),
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val campaigns by viewModel.campaigns.collectAsState()
    val activeCampaign by viewModel.activeCampaign.collectAsState()
    val stats by viewModel.stats.collectAsState()
    val isBriefingOpen by viewModel.isBriefingSheetOpen.collectAsState()
    val selectedCampaign by viewModel.selectedBriefingCampaign.collectAsState()
    val briefingMode by viewModel.briefingMode.collectAsState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 80.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Top App Bar Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(IndigoPrimary),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "1T",
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 16.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "One Tap Studio",
                                    color = TextPrimary,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(DarkSurfaceElevated)
                                        .padding(horizontal = 4.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "PRO",
                                        color = Color(0xFF818CF8),
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                            Text(
                                text = "Media Production Workstation",
                                color = TextMuted,
                                fontSize = 11.sp
                            )
                        }
                    }

                    // Live Sync Pill
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(DarkSurfaceElevated)
                            .border(1.dp, DarkBorder, RoundedCornerShape(20.dp))
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(EmeraldSuccess)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Live Sync",
                                color = EmeraldSuccess,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            // Active Ongoing Safar Spotlight Card
            item {
                activeCampaign?.let { campaign ->
                    ExecutiveHeroCard(
                        campaign = campaign,
                        onOpenBriefing = { viewModel.openBriefing(campaign) },
                        onCopyStatus = { viewModel.copyStatus(context, campaign) },
                        onNavigateKanban = onNavigateKanban
                    )
                }
            }

            // KPI Overview Section Title
            item {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "Production Command Center",
                        color = TextPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Global completion status across all campaigns",
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                }
            }

            // KPI Grid (2 columns)
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        KpiCard(
                            title = "Total Days",
                            value = stats.totalScheduledDays.toString(),
                            icon = Icons.Default.DateRange,
                            tintColor = Color(0xFF94A3B8),
                            modifier = Modifier.weight(1f)
                        )
                        KpiCard(
                            title = "Safars 100% Done",
                            value = stats.safars100PercentDone.toString(),
                            icon = Icons.Default.EmojiEvents,
                            tintColor = EmeraldSuccess,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        KpiCard(
                            title = "Editing Pending",
                            value = stats.editingPendingCount.toString(),
                            icon = Icons.Default.PendingActions,
                            tintColor = ColorEditingPending,
                            modifier = Modifier.weight(1f)
                        )
                        KpiCard(
                            title = "In Progress",
                            value = stats.inProgressCount.toString(),
                            icon = Icons.Default.Sync,
                            tintColor = ColorInProgress,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        KpiCard(
                            title = "Upload Pending",
                            value = stats.uploadPendingCount.toString(),
                            icon = Icons.Default.HourglassTop,
                            tintColor = ColorUploadPending,
                            modifier = Modifier.weight(1f)
                        )
                        KpiCard(
                            title = "Delivered Videos",
                            value = (stats.uploadedCount + stats.alJameaDoneCount).toString(),
                            icon = Icons.Default.CheckCircle,
                            tintColor = ColorUploaded,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // Safars in Production Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Safars in Production",
                            color = TextPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${campaigns.size} total active campaigns",
                            color = TextMuted,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // Campaigns List Cards
            items(campaigns) { campaign ->
                CampaignRowCard(
                    campaign = campaign,
                    isActive = campaign.id == activeCampaign?.id,
                    onSelectActive = { viewModel.setActiveCampaign(campaign.id) },
                    onOpenBriefing = { viewModel.openBriefing(campaign) },
                    onCopyStatus = { viewModel.copyStatus(context, campaign) }
                )
            }
        }

        // WhatsApp Briefing Bottom Sheet
        if (isBriefingOpen && selectedCampaign != null) {
            WhatsAppBriefingSheet(
                campaign = selectedCampaign!!,
                mode = briefingMode,
                onModeChange = { viewModel.setBriefingMode(it) },
                onDismiss = { viewModel.closeBriefing() }
            )
        }
    }
}

@Composable
fun CampaignRowCard(
    campaign: SafarCampaign,
    isActive: Boolean,
    onSelectActive: () -> Unit,
    onOpenBriefing: () -> Unit,
    onCopyStatus: () -> Unit
) {
    var isExpanded by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(DarkSurface)
            .border(
                1.dp,
                if (isActive) IndigoPrimary.copy(alpha = 0.5f) else DarkBorder,
                RoundedCornerShape(14.dp)
            )
            .padding(14.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = campaign.name,
                            color = TextPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        if (isActive) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(IndigoPrimary.copy(alpha = 0.2f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "ONGOING",
                                    color = Color(0xFF818CF8),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                    Text(
                        text = "📍 ${campaign.location} • ${campaign.totalDates} Days",
                        color = TextMuted,
                        fontSize = 11.sp
                    )
                }

                Text(
                    text = "${campaign.overallPercentage}%",
                    color = if (campaign.is100PercentDone) EmeraldSuccess else TextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Progress bar
            MultiStageProgressBar(campaign = campaign, height = 6.dp)

            // Bottom Actions & Toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Button(
                        onClick = onOpenBriefing,
                        modifier = Modifier.height(34.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF25D366),
                            contentColor = Color.White
                        ),
                        contentPadding = PaddingValues(horizontal = 10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Chat,
                            contentDescription = null,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = "Briefing", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = onCopyStatus,
                        modifier = Modifier.height(34.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DarkBorder),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondary),
                        contentPadding = PaddingValues(horizontal = 8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = null,
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }

                // Expand/Collapse Dates Preview Button
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable { isExpanded = !isExpanded }
                        .padding(horizontal = 6.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isExpanded) "Hide Dates" else "View Dates",
                        color = Color(0xFF818CF8),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = null,
                        tint = Color(0xFF818CF8),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            // Expandable Dates Preview (Compact rows)
            AnimatedVisibility(visible = isExpanded) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    campaign.tasks.forEach { task ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(DarkSurfaceElevated)
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = task.title,
                                    color = TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = "${task.hijriDate} • ${task.gregorianDate}",
                                    color = TextMuted,
                                    fontSize = 10.sp
                                )
                            }
                            StageChip(stage = task.stage)
                        }
                    }
                }
            }
        }
    }
}
