package com.onetap.studiotracker.ui.screens.render

import android.app.TimePickerDialog
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
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.CheckBoxOutlineBlank
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.MovieCreation
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.components.StageChip
import com.onetap.studiotracker.ui.components.StudioDropdownSelector
import com.onetap.studiotracker.ui.theme.AmberDark
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.EmeraldSoft
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.LiquidGlassCanvasBrush
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.RoseSoft
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.ui.theme.liquidBouncyClick
import com.onetap.studiotracker.ui.theme.liquidGlassCard
import java.util.Calendar
import java.util.Locale

@Composable
fun RenderBatchScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val repo = SafarRepository.getInstance()
    val campaigns by repo.campaigns.collectAsState()
    val renderState by repo.remoteRenderState.collectAsState()
    val lastHeartbeatAt by repo.lastDesktopHeartbeatAt.collectAsState()
    val renderLogs by repo.renderLogs.collectAsState()

    val isPcOnline = (System.currentTimeMillis() - lastHeartbeatAt) < 45_000L

    LaunchedEffect(Unit) { repo.pingDesktopWorkstation() }

    val activeCampaign = remember(campaigns) {
        campaigns.firstOrNull { it.isOngoing } ?: campaigns.firstOrNull { !it.isArchived } ?: campaigns.firstOrNull()
    }
    var selectedSafarId by remember(activeCampaign?.id) { mutableStateOf(activeCampaign?.id) }
    val displayCampaign = campaigns.firstOrNull { it.id == selectedSafarId } ?: activeCampaign
    val tasks = displayCampaign?.tasks ?: emptyList()

    var selectedFolders by remember(displayCampaign?.id) { mutableStateOf<Set<String>>(emptySet()) }
    var delayMinutes by remember { mutableIntStateOf(0) }
    var customClockLabel by remember { mutableStateOf<String?>(null) }
    var addWatermark by remember { mutableStateOf(true) }
    var muteOriginal by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().statusBarsPadding()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Remote Batch Render", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text("Select folders & trigger or schedule Desktop render", color = TextSecondary, fontSize = 13.sp)
                    }
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (isPcOnline) EmeraldSoft else LightSurface)
                            .border(1.dp, if (isPcOnline) EmeraldSuccess.copy(alpha = 0.4f) else LightBorder, RoundedCornerShape(14.dp))
                            .liquidBouncyClick(pressScale = 0.93f) {
                                repo.pingDesktopWorkstation()
                                Toast.makeText(context, "Pinging Studio PC…", Toast.LENGTH_SHORT).show()
                            }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(if (isPcOnline) EmeraldSuccess else AmberDark))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isPcOnline) "PC Online" else "PC Offline", color = if (isPcOnline) EmeraldDark else AmberDark, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (renderState.status != "idle") {
                item {
                    Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(16.dp, IndigoPrimary.copy(alpha = 0.45f)).padding(14.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.MovieCreation, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = when (renderState.status) {
                                            "scheduled" -> "Scheduled Batch"
                                            "completed" -> "Batch Completed"
                                            "cancelled" -> "Batch Cancelled"
                                            "error" -> "Desktop Alert"
                                            else -> "Rendering on Desktop (${renderState.percent}%)"
                                        },
                                        color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold
                                    )
                                }
                                if (renderState.status == "scheduled" && renderState.jobId.isNotBlank()) {
                                    OutlinedButton(
                                        onClick = { repo.cancelScheduledRemoteRender(renderState.jobId) },
                                        shape = RoundedCornerShape(8.dp),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, RoseError),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                    ) {
                                        Icon(Icons.Default.Cancel, contentDescription = null, tint = RoseError, modifier = Modifier.size(14.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Cancel", color = RoseError, fontSize = 11.sp)
                                    }
                                }
                            }
                            if (renderState.stageText.isNotBlank()) Text(renderState.stageText, color = TextSecondary, fontSize = 12.sp)
                            if (renderState.status == "running" || renderState.status == "completed") {
                                LinearProgressIndicator(
                                    progress = { (renderState.percent / 100f).coerceIn(0f, 1f) },
                                    modifier = Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(4.dp)),
                                    color = if (renderState.status == "completed") EmeraldDark else IndigoPrimary,
                                    trackColor = LightSurfaceSubtle
                                )
                            }
                        }
                    }
                }
            }

            if (renderLogs.isNotEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(RoseSoft).border(1.dp, RoseError.copy(alpha = 0.3f), RoundedCornerShape(14.dp)).padding(12.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Live Render Warnings & Errors", color = RoseError, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            renderLogs.take(4).forEach { line ->
                                Text(line, color = TextPrimary, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }

            val activeRenderSafars = campaigns.filter { !it.isArchived }
            if (activeRenderSafars.isNotEmpty()) {
                item {
                    StudioDropdownSelector(
                        label = "TARGET SAFAR",
                        selectedText = displayCampaign?.name ?: "Select Safar",
                        items = activeRenderSafars,
                        selectedItem = displayCampaign,
                        itemLabel = { it.name },
                        itemSubLabel = { "${it.deliveredVideosCount}/${it.totalDates} Videos (${it.overallPercentage}%)" },
                        leadingIcon = Icons.Default.FolderOpen,
                        onSelect = { camp -> selectedSafarId = camp.id }
                    )
                }
            }

            item {
                val scheduleOptions = listOf(0 to "Start Now", 15 to "In 15m", 30 to "In 30m", 60 to "In 1 hr", -1 to "Pick Custom Time…")
                val currentScheduleOption = if (customClockLabel != null) {
                    scheduleOptions.last()
                } else {
                    scheduleOptions.firstOrNull { it.first == delayMinutes } ?: scheduleOptions.first()
                }
                val currentScheduleLabel = customClockLabel ?: currentScheduleOption.second

                Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(16.dp).padding(14.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Schedule & Render Options", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        StudioDropdownSelector(
                            label = "RENDER SCHEDULE",
                            selectedText = currentScheduleLabel,
                            items = scheduleOptions,
                            selectedItem = currentScheduleOption,
                            itemLabel = { it.second },
                            leadingIcon = Icons.Default.Schedule,
                            onSelect = { (mins, _) ->
                                if (mins == -1) {
                                    val cal = Calendar.getInstance()
                                    TimePickerDialog(context, { _, hour, minute ->
                                        val target = Calendar.getInstance().apply {
                                            set(Calendar.HOUR_OF_DAY, hour)
                                            set(Calendar.MINUTE, minute)
                                            set(Calendar.SECOND, 0)
                                            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
                                        }
                                        val diffMins = ((target.timeInMillis - System.currentTimeMillis()) / 60_000L).toInt().coerceAtLeast(1)
                                        delayMinutes = diffMins
                                        customClockLabel = String.format(Locale.getDefault(), "At %02d:%02d", hour, minute)
                                    }, cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), false).show()
                                } else {
                                    delayMinutes = mins
                                    customClockLabel = null
                                }
                            }
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Add One Tap Watermark", color = TextPrimary, fontSize = 13.sp)
                            Switch(checked = addWatermark, onCheckedChange = { addWatermark = it })
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Mute Original Audio", color = TextPrimary, fontSize = 13.sp)
                            Switch(checked = muteOriginal, onCheckedChange = { muteOriginal = it })
                        }
                        Button(
                            enabled = displayCampaign != null && selectedFolders.isNotEmpty(),
                            onClick = {
                                displayCampaign?.let { camp ->
                                    repo.startOrScheduleRemoteRender(camp.name, selectedFolders.toList(), delayMinutes, addWatermark, muteOriginal)
                                    val msg = if (delayMinutes > 0) "Scheduled ${selectedFolders.size} folder(s) (${customClockLabel ?: "in ${delayMinutes}m"})" else "Started batch render for ${selectedFolders.size} folder(s)"
                                    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(46.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
                        ) {
                            Icon(if (delayMinutes > 0) Icons.Default.Schedule else Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (delayMinutes > 0) "Schedule (${selectedFolders.size} folders • ${customClockLabel ?: "${delayMinutes}m"})" else "Start Batch Render (${selectedFolders.size} folders)",
                                fontSize = 13.sp, fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Select Folders (${selectedFolders.size}/${tasks.size})", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Pending", color = IndigoPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { selectedFolders = tasks.filter { !it.isVideoDelivered }.map { it.title }.toSet() }.padding(4.dp))
                        Text("All", color = IndigoPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { selectedFolders = tasks.map { it.title }.toSet() }.padding(4.dp))
                        Text("Clear", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { selectedFolders = emptySet() }.padding(4.dp))
                    }
                }
            }

            items(tasks, key = { it.id }) { task ->
                val isSel = task.title in selectedFolders
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .liquidGlassCard(12.dp, if (isSel) IndigoPrimary else LightBorder)
                        .liquidBouncyClick(pressScale = 0.97f) {
                            selectedFolders = if (isSel) selectedFolders - task.title else selectedFolders + task.title
                        }
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Icon(if (isSel) Icons.Default.CheckBox else Icons.Default.CheckBoxOutlineBlank, contentDescription = null, tint = if (isSel) IndigoPrimary else TextMuted, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(task.displayTitle, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Text("Editor: ${task.effectiveVideoEditor}", color = TextSecondary, fontSize = 11.sp)
                        }
                    }
                    StageChip(stage = task.stage)
                }
            }
        }
    }
}
