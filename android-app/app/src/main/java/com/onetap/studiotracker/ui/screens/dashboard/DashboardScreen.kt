package com.onetap.studiotracker.ui.screens.dashboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Image
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.PendingActions
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.R
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.StudioStats
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.data.sync.SyncStatus
import com.onetap.studiotracker.ui.components.ExecutiveHeroCard
import com.onetap.studiotracker.ui.components.MultiStageProgressBar
import com.onetap.studiotracker.ui.components.StageChip
import com.onetap.studiotracker.ui.components.WhatsAppBriefingSheet
import com.onetap.studiotracker.ui.theme.AmberDark
import com.onetap.studiotracker.ui.theme.AmberSoft
import com.onetap.studiotracker.ui.theme.BlueDark
import com.onetap.studiotracker.ui.theme.BlueSoft
import com.onetap.studiotracker.ui.theme.CyanInfo
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.EmeraldSoft
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.IndigoSoft
import com.onetap.studiotracker.ui.theme.LightBackground
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.LiquidGlassCanvasBrush
import com.onetap.studiotracker.ui.theme.liquidGlassCard
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun DashboardScreen(
    onNavigateKanban: () -> Unit,
    onNavigateSettings: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repository = SafarRepository.getInstance()
    val campaigns by repository.campaigns.collectAsState()
    val syncState by repository.syncState.collectAsState()
    val isInitialLoading by repository.isInitialLoading.collectAsState()

    val activeCampaign = remember(campaigns) {
        campaigns.firstOrNull { it.isOngoing } ?: campaigns.firstOrNull { !it.isArchived } ?: campaigns.firstOrNull()
    }
    val stats = remember(campaigns) { StudioStats.calculate(campaigns, activeOnly = true) }
    var briefingCampaign by remember { mutableStateOf<SafarCampaign?>(null) }
    var expandedId by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var showArchived by remember { mutableStateOf(false) }

    val displayedSafars = remember(campaigns, showArchived, searchQuery) {
        campaigns.filter { c ->
            (c.isArchived == showArchived) &&
                (searchQuery.isBlank() || c.name.contains(searchQuery, true) || c.tasks.any { it.title.contains(searchQuery, true) })
        }
    }

    Box(modifier = modifier.fillMaxSize().statusBarsPadding()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)).background(LightSurface)
                                .border(1.dp, LightBorder, RoundedCornerShape(11.dp)).padding(6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Image(painter = painterResource(id = R.drawable.ic_launcher_logo), contentDescription = "One Tap", modifier = Modifier.fillMaxSize())
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("One Tap Studio", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                                Spacer(modifier = Modifier.width(6.dp))
                                Box(modifier = Modifier.clip(RoundedCornerShape(5.dp)).background(IndigoSoft).padding(horizontal = 5.dp, vertical = 2.dp)) {
                                    Text("LIVE", color = IndigoPrimary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Text("Safar Production Tracker", color = TextMuted, fontSize = 11.sp)
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        val isSyncing = syncState.status == SyncStatus.SYNCING
                        val isRt = syncState.isRealtimeConnected || syncState.status == SyncStatus.REALTIME_LIVE
                        val isConn = isRt || syncState.status == SyncStatus.CONNECTED
                        val pillColor = if (isConn) EmeraldDark else if (isSyncing) BlueDark else AmberDark

                        Row(
                            modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(LightSurface)
                                .border(1.dp, LightBorder, RoundedCornerShape(20.dp))
                                .clickable {
                                    scope.launch {
                                        repository.triggerCloudSync()
                                        Toast.makeText(context, "Synced with Supabase", Toast.LENGTH_SHORT).show()
                                    }
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(pillColor))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(if (isSyncing) "Syncing…" else if (isRt) "Live" else if (isConn) "${syncState.latencyMs}ms" else "Offline", color = pillColor, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = pillColor, modifier = Modifier.size(13.dp))
                        }

                        Box(
                            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(LightSurface)
                                .border(1.dp, LightBorder, RoundedCornerShape(10.dp)).clickable { onNavigateSettings() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextSecondary, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }

            // Quick Safar Switcher Strip
            if (campaigns.any { !it.isArchived }) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        campaigns.filter { !it.isArchived }.forEach { camp ->
                            val isSel = camp.id == activeCampaign?.id
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (isSel) IndigoPrimary else LightSurface)
                                    .border(1.dp, if (isSel) IndigoPrimary else LightBorder, RoundedCornerShape(12.dp))
                                    .clickable { repository.setActiveCampaign(camp.id) }
                                    .padding(horizontal = 12.dp, vertical = 7.dp)
                            ) {
                                Text(
                                    text = "${camp.name} (${camp.overallPercentage}%)",
                                    color = if (isSel) Color.White else TextSecondary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }

            if (activeCampaign != null) {
                item {
                    ExecutiveHeroCard(
                        campaign = activeCampaign,
                        onOpenBriefing = { briefingCampaign = activeCampaign },
                        onCopyStatus = {
                            val text = repository.generateWhatsAppBriefingText(activeCampaign)
                            (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
                                .setPrimaryClip(ClipData.newPlainText("Safar Status", text))
                            Toast.makeText(context, "Briefing copied!", Toast.LENGTH_SHORT).show()
                        },
                        onNavigateKanban = onNavigateKanban
                    )
                }
            } else {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(LightSurface)
                            .border(1.dp, LightBorder, RoundedCornerShape(16.dp)).padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(if (isInitialLoading) "Syncing Safar data from Supabase…" else "No active Safars found in Supabase.", color = TextSecondary, fontSize = 13.sp)
                    }
                }
            }

            // Enhanced KPI Matrix with Icons
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Active Pipeline KPIs (${stats.totalScheduledDays} dates)", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        KpiMini("PENDING", "${stats.editingPendingCount}", AmberDark, AmberSoft, Icons.Default.PendingActions, Modifier.weight(1f))
                        KpiMini("EDITING", "${stats.inProgressCount}", BlueDark, BlueSoft, Icons.Default.Movie, Modifier.weight(1f))
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        KpiMini("UPLOAD", "${stats.uploadPendingCount}", CyanInfo, Color(0xFFECFEFF), Icons.Default.HourglassTop, Modifier.weight(1f))
                        KpiMini("DELIVERED", "${stats.uploadedCount + stats.alJameaDoneCount}", EmeraldDark, EmeraldSoft, Icons.Default.CloudDone, Modifier.weight(1f))
                    }
                }
            }

            // Active / Archived Filter + Search
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(if (showArchived) "Archived Safars" else "Active Safars", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            ToggleChip("Active (${campaigns.count { !it.isArchived }})", !showArchived) { showArchived = false }
                            ToggleChip("Archived (${campaigns.count { it.isArchived }})", showArchived) { showArchived = true }
                        }
                    }
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Search Safars or date folders…", fontSize = 13.sp, color = TextMuted) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            }

            items(displayedSafars, key = { it.id }) { camp ->
                val expanded = expandedId == camp.id
                Box(
                    modifier = Modifier.fillMaxWidth()
                        .liquidGlassCard(
                            cornerRadius = 16.dp,
                            borderColor = if (camp.isOngoing) IndigoPrimary.copy(alpha = 0.45f) else LightBorder
                        )
                        .clickable { expandedId = if (expanded) null else camp.id }
                        .padding(14.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(camp.name, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                    if (camp.is100PercentDone) {
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Icon(Icons.Default.CheckCircle, contentDescription = "Done", tint = EmeraldSuccess, modifier = Modifier.size(15.dp))
                                    }
                                }
                                Text("${camp.deliveredVideosCount}/${camp.totalDates} Videos (${camp.overallPercentage}%) • Photos ${camp.deliveredPhotosCount}/${camp.totalDates}", color = TextSecondary, fontSize = 11.sp)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (!camp.isOngoing && !camp.isArchived) {
                                    Text(
                                        text = "Set Active",
                                        color = IndigoPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                        modifier = Modifier.clickable { repository.setActiveCampaign(camp.id) }.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                                Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = null, tint = TextMuted)
                            }
                        }
                        MultiStageProgressBar(campaign = camp, height = 6.dp)
                        AnimatedVisibility(visible = expanded) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 4.dp)) {
                                camp.tasks.forEach { task ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(LightSurfaceSubtle).padding(horizontal = 10.dp, vertical = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(task.title, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                            val renderBadge = if ((task.renderVideoCount ?: 0) > 0 || (task.renderSizeBytes ?: 0L) > 0L) {
                                                val mins = ((task.renderDurationSeconds ?: 0.0) / 60.0).toInt()
                                                val mb = ((task.renderSizeBytes ?: 0L) / (1024.0 * 1024.0)).toInt()
                                                "🎬 ${task.renderVideoCount ?: 1} clip(s)" + (if (mins > 0) " • ${mins}m" else "") + (if (mb > 0) " • ${mb}MB" else "")
                                            } else null
                                            Text(
                                                listOfNotNull(
                                                    task.hijriDate.takeIf { it.isNotBlank() },
                                                    task.dueDate.takeIf { it.isNotBlank() }?.let { "Due $it" },
                                                    task.effectiveVideoEditor,
                                                    renderBadge
                                                ).joinToString(" • "),
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
        }
    }

    briefingCampaign?.let { WhatsAppBriefingSheet(campaign = it, onDismiss = { briefingCampaign = null }) }
}

@Composable
private fun ToggleChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(if (selected) IndigoPrimary else LightSurface)
            .border(1.dp, if (selected) IndigoPrimary else LightBorder, RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Text(label, color = if (selected) Color.White else TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun KpiMini(
    label: String,
    value: String,
    color: Color,
    softBg: Color,
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.liquidGlassCard(cornerRadius = 14.dp, borderColor = LightBorder).padding(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Column {
                Text(label, color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text(value, color = color, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
            }
            Box(
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(softBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
            }
        }
    }
}
