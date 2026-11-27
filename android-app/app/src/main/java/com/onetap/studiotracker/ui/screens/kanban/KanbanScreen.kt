package com.onetap.studiotracker.ui.screens.kanban

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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.CheckBoxOutlineBlank
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.repository.SafarRepository
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

@Composable
fun KanbanScreen(modifier: Modifier = Modifier) {
    val repo = SafarRepository.getInstance()
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
                    task = task, showSafarName = showAllSafars, selectionMode = selectionMode, isSelected = isSelected,
                    onToggleSelect = { selectedIds = if (isSelected) selectedIds - task.id else selectedIds + task.id },
                    onAdvance = { task.stage.nextStage?.let { repo.updateTaskStage(task.id, it) } },
                    onRegress = { task.stage.prevStage?.let { repo.updateTaskStage(task.id, it) } },
                    onExclude = { pendingExcludeTask = task }
                )
            }
        }
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

@Composable
private fun KanbanCard(
    task: SafarTask, showSafarName: Boolean, selectionMode: Boolean, isSelected: Boolean,
    onToggleSelect: () -> Unit, onAdvance: () -> Unit, onRegress: () -> Unit, onExclude: () -> Unit
) {
    Box(modifier = Modifier.fillMaxWidth().liquidGlassCard(cornerRadius = 14.dp, borderColor = if (isSelected) IndigoPrimary else LightBorder).clickable(enabled = selectionMode) { onToggleSelect() }.padding(14.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    if (selectionMode) Icon(if (isSelected) Icons.Default.CheckBox else Icons.Default.CheckBoxOutlineBlank, contentDescription = null, tint = if (isSelected) IndigoPrimary else TextMuted, modifier = Modifier.padding(end = 8.dp).size(20.dp))
                    Column {
                        Text(task.title, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        if (showSafarName) Text(task.campaignId, color = TextSecondary, fontSize = 11.sp)
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StageChip(stage = task.stage)
                    IconButton(onClick = onExclude, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.DeleteOutline, contentDescription = "Exclude", tint = TextMuted, modifier = Modifier.size(16.dp))
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
