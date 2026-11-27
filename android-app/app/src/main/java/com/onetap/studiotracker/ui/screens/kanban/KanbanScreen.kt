package com.onetap.studiotracker.ui.screens.kanban

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.Toast
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.CheckBoxOutlineBlank
import androidx.compose.material.icons.filled.CloudQueue
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.components.PhaseCompletionTimelineCard
import com.onetap.studiotracker.ui.components.StageChip
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.IndigoSoft
import com.onetap.studiotracker.ui.theme.LightBackground
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.LiquidGlassCanvasBrush
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.ui.theme.liquidBouncyClick
import com.onetap.studiotracker.ui.theme.liquidGlassCard
import kotlin.math.roundToInt

fun triggerTactileFeedback(context: Context, isDoublePulse: Boolean = false) {
    try {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        } ?: return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (isDoublePulse) {
                vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 25, 60, 40), -1))
            } else {
                vibrator.vibrate(VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE))
            }
        } else {
            @Suppress("DEPRECATION")
            if (isDoublePulse) {
                vibrator.vibrate(longArrayOf(0, 25, 60, 40), -1)
            } else {
                vibrator.vibrate(20)
            }
        }
    } catch (_: Throwable) {}
}

@Composable
fun KanbanScreen(modifier: Modifier = Modifier) {
    val repo = SafarRepository.getInstance()
    val context = LocalContext.current
    val campaigns by repo.campaigns.collectAsState()
    val activeCampaign = remember(campaigns) {
        campaigns.firstOrNull { it.isOngoing } ?: campaigns.firstOrNull { !it.isArchived } ?: campaigns.firstOrNull()
    }

    var showAllSafars by remember { mutableStateOf(false) }
    var filterStage by remember { mutableStateOf<Stage?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var selectionMode by remember { mutableStateOf(false) }
    var selectedIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var showAddDialog by remember { mutableStateOf(false) }
    var pendingExcludeTask by remember { mutableStateOf<SafarTask?>(null) }
    var actionSheetTask by remember { mutableStateOf<SafarTask?>(null) }

    val baseTasks = remember(campaigns, activeCampaign, showAllSafars) {
        if (showAllSafars) campaigns.filter { !it.isArchived }.flatMap { it.tasks }
        else activeCampaign?.tasks ?: emptyList()
    }
    val filteredTasks = remember(baseTasks, filterStage, searchQuery) {
        baseTasks.filter { t ->
            (filterStage == null || t.stage == filterStage) &&
                (searchQuery.isBlank() || t.title.contains(searchQuery, true) || t.campaignId.contains(searchQuery, true) || t.effectiveVideoEditor.contains(searchQuery, true))
        }
    }

    Box(modifier = modifier.fillMaxSize().statusBarsPadding()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 84.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Production Pipeline", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text(if (showAllSafars) "All active Safars (${baseTasks.size} dates)" else (activeCampaign?.name ?: "No active Safar"), color = TextSecondary, fontSize = 13.sp)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedButton(
                            onClick = { selectionMode = !selectionMode; if (!selectionMode) selectedIds = emptySet() },
                            shape = RoundedCornerShape(10.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (selectionMode) IndigoPrimary else LightBorder)
                        ) { Text(if (selectionMode) "Done" else "Bulk", fontSize = 12.sp, color = IndigoPrimary) }
                        if (activeCampaign != null) {
                            Button(
                                onClick = { showAddDialog = true }, shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White),
                                contentPadding = PaddingValues(horizontal = 12.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Add", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ScopePill("Ongoing Safar", !showAllSafars) { showAllSafars = false }
                        ScopePill("All Active Safars", showAllSafars) { showAllSafars = true }
                    }
                    OutlinedTextField(
                        value = searchQuery, onValueChange = { searchQuery = it },
                        placeholder = { Text("Search date folder, Safar, or editor…", fontSize = 13.sp, color = TextMuted) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted) },
                        singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)
                    )
                }
            }

            item {
                Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterPill("All (${baseTasks.size})", filterStage == null, IndigoPrimary) { filterStage = null }
                    Stage.entries.forEach { st ->
                        FilterPill("${st.title} (${baseTasks.count { it.stage == st }})", filterStage == st, st.composeColor) {
                            filterStage = if (filterStage == st) null else st
                        }
                    }
                }
            }

            if (selectionMode && selectedIds.isNotEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(IndigoSoft).border(1.dp, IndigoPrimary.copy(alpha = 0.35f), RoundedCornerShape(12.dp)).padding(12.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("${selectedIds.size} selected — Move all to:", color = IndigoPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Stage.entries.forEach { st ->
                                    Button(
                                        onClick = { repo.bulkUpdateTaskStage(selectedIds, st); selectedIds = emptySet(); selectionMode = false },
                                        shape = RoundedCornerShape(8.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = st.composeColor, contentColor = Color.White),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                    ) { Text(st.title, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                                }
                            }
                        }
                    }
                }
            }

            items(filteredTasks, key = { it.id }) { task ->
                val isSelected = task.id in selectedIds
                KanbanCard(
                    task = task,
                    showSafarName = showAllSafars,
                    selectionMode = selectionMode,
                    isSelected = isSelected,
                    onToggleSelect = { selectedIds = if (isSelected) selectedIds - task.id else selectedIds + task.id },
                    onAdvance = {
                        task.stage.nextStage?.let { next ->
                            triggerTactileFeedback(context, next == Stage.UPLOADED || next == Stage.ALJAMEA_DONE)
                            repo.updateTaskStage(task.id, next)
                        }
                    },
                    onRegress = {
                        task.stage.prevStage?.let { prev ->
                            triggerTactileFeedback(context, false)
                            repo.updateTaskStage(task.id, prev)
                        }
                    },
                    onExclude = { pendingExcludeTask = task },
                    onOpenActionSheet = { actionSheetTask = task }
                )
            }
        }
    }

    actionSheetTask?.let { targetTask ->
        TaskExecutiveActionSheet(
            task = targetTask,
            onDismiss = { actionSheetTask = null },
            onAdvance = {
                targetTask.stage.nextStage?.let { next ->
                    triggerTactileFeedback(context, next == Stage.UPLOADED || next == Stage.ALJAMEA_DONE)
                    repo.updateTaskStage(targetTask.id, next)
                }
            },
            onMoveStage = { stage ->
                triggerTactileFeedback(context, stage == Stage.UPLOADED || stage == Stage.ALJAMEA_DONE)
                repo.updateTaskStage(targetTask.id, stage)
                actionSheetTask = null
            },
            onUpdateEditor = { editor ->
                triggerTactileFeedback(context, false)
                repo.updateTaskEditor(targetTask.id, editor)
            },
            onUpdatePhotoEditor = { editor ->
                triggerTactileFeedback(context, false)
                repo.updateTaskPhotoEditor(targetTask.id, editor)
            },
            onToggleUrgent = {
                triggerTactileFeedback(context, true)
                val isUrgent = (targetTask.notes ?: "").contains("[URGENT]")
                val current = targetTask.notes ?: ""
                val updated = if (isUrgent) {
                    current.replace(Regex("\\[URGENT\\]\\s*(?:Audio Sync Issue)?\\s*·?\\s*", RegexOption.IGNORE_CASE), "").trim()
                } else {
                    if (current.isNotBlank()) "[URGENT] Audio Sync Issue · $current" else "[URGENT] Audio Sync Issue"
                }
                repo.updateTaskNotes(targetTask.id, updated)
                actionSheetTask = null
            }
        )
    }

    pendingExcludeTask?.let { targetTask ->
        AlertDialog(
            onDismissRequest = { pendingExcludeTask = null },
            containerColor = LightSurface,
            title = { Text("Exclude Date Folder?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Remove \"${targetTask.title}\" from ${targetTask.campaignId}? You can restore excluded folders later from the desktop app.",
                    color = TextSecondary,
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        repo.excludeTask(targetTask.campaignId, targetTask.id, targetTask.title)
                        pendingExcludeTask = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RoseError, contentColor = Color.White)
                ) { Text("Exclude") }
            },
            dismissButton = {
                TextButton(onClick = { pendingExcludeTask = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }

    if (showAddDialog && activeCampaign != null) {
        var folder by remember { mutableStateOf("") }
        var notes by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAddDialog = false }, containerColor = LightSurface,
            title = { Text("Add Date Task", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Safar: ${activeCampaign.name}", color = TextSecondary, fontSize = 12.sp)
                    OutlinedTextField(value = folder, onValueChange = { folder = it }, label = { Text("Date Folder (e.g. 1448-03-14 _01M)") }, singleLine = true)
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes (optional)") })
                }
            },
            confirmButton = {
                Button(onClick = { if (folder.isNotBlank()) { repo.addManualTask(activeCampaign.name, folder, notes); showAddDialog = false } },
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)) { Text("Add Task") }
            },
            dismissButton = { TextButton(onClick = { showAddDialog = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun ScopePill(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(if (selected) IndigoPrimary else LightSurface).border(1.dp, if (selected) IndigoPrimary else LightBorder, RoundedCornerShape(10.dp)).clickable { onClick() }.padding(horizontal = 12.dp, vertical = 7.dp)) {
        Text(label, color = if (selected) Color.White else TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun FilterPill(label: String, selected: Boolean, color: Color, onClick: () -> Unit) {
    Box(modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(if (selected) color else LightSurface.copy(alpha = 0.85f)).border(1.dp, if (selected) color else LightBorder, RoundedCornerShape(20.dp)).liquidBouncyClick(pressScale = 0.94f) { onClick() }.padding(horizontal = 12.dp, vertical = 7.dp)) {
        Text(label, color = if (selected) Color.White else TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun KanbanCard(
    task: SafarTask,
    showSafarName: Boolean,
    selectionMode: Boolean,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onAdvance: () -> Unit,
    onRegress: () -> Unit,
    onExclude: () -> Unit,
    onOpenActionSheet: () -> Unit
) {
    val context = LocalContext.current
    var swipeOffset by remember { mutableFloatStateOf(0f) }
    val isUrgent = remember(task.notes) { (task.notes ?: "").contains("[URGENT]") }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
    ) {
        // Swipe Right Background Cue (Advance)
        if (swipeOffset > 10f) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(Color(0xFF10B981))
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                    Text("Advance", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Swipe Left Background Cue (Quick Actions)
        if (swipeOffset < -10f) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(IndigoPrimary)
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Actions", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Icon(Icons.Default.MoreVert, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                }
            }
        }

        // Foreground Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .offset { IntOffset(swipeOffset.roundToInt(), 0) }
                .pointerInput(Unit) {
                    detectHorizontalDragGestures(
                        onDragEnd = {
                            if (swipeOffset > 140f) {
                                val next = task.stage.nextStage
                                if (next != null) {
                                    triggerTactileFeedback(context, next == Stage.UPLOADED || next == Stage.ALJAMEA_DONE)
                                    onAdvance()
                                }
                            } else if (swipeOffset < -140f) {
                                triggerTactileFeedback(context, false)
                                onOpenActionSheet()
                            }
                            swipeOffset = 0f
                        },
                        onHorizontalDrag = { _, dragAmount ->
                            swipeOffset = (swipeOffset + dragAmount).coerceIn(-220f, 220f)
                        }
                    )
                }
                .liquidGlassCard(
                    cornerRadius = 14.dp,
                    borderColor = if (isSelected) IndigoPrimary else if (isUrgent) RoseError else LightBorder
                )
                .combinedClickable(
                    onLongClick = {
                        triggerTactileFeedback(context, false)
                        onOpenActionSheet()
                    },
                    onClick = {
                        if (selectionMode) onToggleSelect()
                    }
                )
                .padding(14.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        if (selectionMode) Icon(if (isSelected) Icons.Default.CheckBox else Icons.Default.CheckBoxOutlineBlank, contentDescription = null, tint = if (isSelected) IndigoPrimary else TextMuted, modifier = Modifier.padding(end = 8.dp).size(20.dp))
                        Column {
                            Text(task.displayTitle, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            if (showSafarName) Text(task.campaignId, color = TextSecondary, fontSize = 11.sp)
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        StageChip(stage = task.stage)
                        IconButton(onClick = onOpenActionSheet, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.MoreVert, contentDescription = "Actions", tint = TextMuted, modifier = Modifier.size(16.dp))
                        }
                        IconButton(onClick = onExclude, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "Exclude", tint = TextMuted, modifier = Modifier.size(16.dp))
                        }
                    }
                }

                if (isUrgent) {
                    Box(modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(RoseError.copy(alpha = 0.12f)).padding(horizontal = 8.dp, vertical = 4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = RoseError, modifier = Modifier.size(13.dp))
                            Text("URGENT · Audio Sync Issue", color = RoseError, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = TextMuted, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(task.effectiveVideoEditor, color = TextSecondary, fontSize = 12.sp)
                    }
                    if (task.dueDate.isNotBlank()) {
                        Text("Due ${task.dueDate}" + if (task.isOverdue) " (Overdue)" else "", color = if (task.isOverdue) RoseError else TextSecondary, fontSize = 11.sp, fontWeight = if (task.isOverdue) FontWeight.Bold else FontWeight.Normal)
                    }
                }

                if (!task.notes.isNullOrBlank()) {
                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(LightSurfaceSubtle).padding(horizontal = 8.dp, vertical = 4.dp)) {
                        Text("💬 ${task.notes}", color = TextSecondary, fontSize = 11.sp)
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    task.stage.prevStage?.let { prev ->
                        OutlinedButton(onClick = onRegress, modifier = Modifier.height(36.dp), shape = RoundedCornerShape(8.dp), border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder)) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(14.dp), tint = TextSecondary)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(prev.shortLabel, fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                    val next = task.stage.nextStage
                    if (next != null) {
                        Button(onClick = onAdvance, modifier = Modifier.weight(1f).height(36.dp), shape = RoundedCornerShape(8.dp), colors = ButtonDefaults.buttonColors(containerColor = next.composeColor, contentColor = Color.White)) {
                            Text("Move to ${next.title}", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(14.dp))
                        }
                    } else {
                        Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(LightSurfaceSubtle).padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                            Text("AlJamea Completed", color = EmeraldDark, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskExecutiveActionSheet(
    task: SafarTask,
    onDismiss: () -> Unit,
    onAdvance: () -> Unit,
    onMoveStage: (Stage) -> Unit,
    onUpdateEditor: (String) -> Unit,
    onUpdatePhotoEditor: (String) -> Unit,
    onToggleUrgent: () -> Unit
) {
    val context = LocalContext.current
    val isUrgent = remember(task.notes) { (task.notes ?: "").contains("[URGENT]") }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = LightSurface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(task.displayTitle, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("${task.campaignId} • ${task.stage.title}", color = TextSecondary, fontSize = 12.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    StageChip(stage = task.stage)
                    task.stage.nextStage?.let { next ->
                        Button(
                            onClick = { onAdvance(); onDismiss() },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = next.composeColor, contentColor = Color.White),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text("Advance →", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Phase Completion Timestamps (More Details)
            PhaseCompletionTimelineCard(task = task)

            // Action 1: Send WhatsApp Update for this Date
            Button(
                onClick = {
                    val text = buildString {
                        append("🎬 *ONE TAP STUDIO · DATE UPDATE*\n━━━━━━━━━━━━━━━━━━━━\n")
                        append("📍 *Safar:* ${task.campaignId}\n")
                        append("📁 *Date:* ${task.displayTitle}${if (task.hijriDate.isNotBlank()) " (${task.hijriDate})" else ""}\n")
                        append("📌 *Pipeline:* ${task.stage.title}\n")
                        append("🎬 *Video Editor:* ${task.effectiveVideoEditor} (${if (task.isVideoDelivered) "✓ Uploaded" else "In Progress"})\n")
                        append("📷 *Photo Editor:* ${task.effectivePhotoEditor} (${if (task.isPhotosDelivered) "✓ Uploaded" else "Pending"})\n")
                        if (!task.notes.isNullOrBlank()) append("💬 *Notes:* ${task.notes}\n")
                        append("━━━━━━━━━━━━━━━━━━━━")
                    }
                    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("Safar Date Update", text))
                    Toast.makeText(context, "Briefing for ${task.displayTitle} copied!", Toast.LENGTH_SHORT).show()
                    try {
                        val waIntent = Intent(Intent.ACTION_VIEW).apply {
                            data = Uri.parse("https://api.whatsapp.com/send?text=${Uri.encode(text)}")
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        context.startActivity(waIntent)
                    } catch (_: Throwable) {}
                    onDismiss()
                },
                modifier = Modifier.fillMaxWidth().height(46.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White)
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Send WhatsApp Update for this Date", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }

            // Action 2: ☁️ Open Google Drive Folder
            OutlinedButton(
                onClick = {
                    try {
                        val driveUrl = task.driveFolderUrl?.takeIf { it.isNotBlank() } ?: "https://drive.google.com"
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(driveUrl)).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        context.startActivity(intent)
                    } catch (_: Throwable) {
                        Toast.makeText(context, "Unable to open Google Drive link", Toast.LENGTH_SHORT).show()
                    }
                    onDismiss()
                },
                modifier = Modifier.fillMaxWidth().height(44.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.CloudQueue, contentDescription = null, modifier = Modifier.size(16.dp), tint = IndigoPrimary)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Open Google Drive Folder", fontSize = 13.sp, color = IndigoPrimary, fontWeight = FontWeight.SemiBold)
            }

            // Action 3: 👤 Reassign Editor
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("👤 Reassign Video Editor:", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Murtaza", "Mustafa", "Burhanuddin", "Zainab").forEach { ed ->
                        val isAssigned = task.effectiveVideoEditor == ed
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isAssigned) IndigoPrimary else LightSurfaceSubtle)
                                .border(1.dp, if (isAssigned) IndigoPrimary else LightBorder, RoundedCornerShape(8.dp))
                                .clickable { onUpdateEditor(ed) }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(ed, color = if (isAssigned) Color.White else TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("📷 Reassign Photo Editor:", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Muffadal Peti", "Ali", "Taha", "Taher").forEach { ed ->
                        val isAssigned = task.effectivePhotoEditor == ed
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isAssigned) IndigoPrimary else LightSurfaceSubtle)
                                .border(1.dp, if (isAssigned) IndigoPrimary else LightBorder, RoundedCornerShape(8.dp))
                                .clickable { onUpdatePhotoEditor(ed) }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(ed, color = if (isAssigned) Color.White else TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            // Action 4: ⚠️ Flag as Urgent / Audio Sync Issue
            Button(
                onClick = onToggleUrgent,
                modifier = Modifier.fillMaxWidth().height(42.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isUrgent) Color(0xFFFEE2E2) else LightSurfaceSubtle,
                    contentColor = RoseError
                )
            ) {
                Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(16.dp), tint = RoseError)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    if (isUrgent) "✓ Remove Urgent / Audio Sync Flag" else "⚠️ Flag as Urgent / Audio Sync Issue",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Quick Stage Jump
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Jump Pipeline Stage:", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Stage.entries.forEach { st ->
                        Button(
                            onClick = { onMoveStage(st) },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = st.composeColor, contentColor = Color.White),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(st.title, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
