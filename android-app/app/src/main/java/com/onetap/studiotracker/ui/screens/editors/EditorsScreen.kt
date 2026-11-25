package com.onetap.studiotracker.ui.screens.editors

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
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
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
import com.onetap.studiotracker.data.models.StudioStats
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.components.StageChip
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.LightBackground
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary

@Composable
fun EditorsScreen(modifier: Modifier = Modifier) {
    val repository = SafarRepository.getInstance()
    val campaigns by repository.campaigns.collectAsState()
    val stats = remember(campaigns) { StudioStats.calculate(campaigns) }

    var selectedEditor by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var editingTask by remember { mutableStateOf<SafarTask?>(null) }

    val allTasks = remember(campaigns) {
        campaigns.filter { !it.isArchived }.flatMap { it.tasks }
    }

    val filteredTasks = remember(allTasks, selectedEditor, searchQuery) {
        allTasks.filter { t ->
            val edMatch = selectedEditor == null || t.effectiveVideoEditor.equals(selectedEditor, ignoreCase = true)
            val qMatch = searchQuery.isBlank() ||
                t.title.contains(searchQuery, ignoreCase = true) ||
                t.campaignId.contains(searchQuery, ignoreCase = true) ||
                t.effectiveVideoEditor.contains(searchQuery, ignoreCase = true)
            edMatch && qMatch
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(LightBackground)
            .statusBarsPadding()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 84.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Editor Assignments", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text("Workloads, due dates, and SLA tracking", color = TextSecondary, fontSize = 13.sp)
                }
            }

            // Editor Workload Cards
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    stats.editorWorkloads.forEach { wl ->
                        val isSelected = selectedEditor == wl.name
                        Box(
                            modifier = Modifier
                                .width(170.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(LightSurface)
                                .border(1.5.dp, if (isSelected) IndigoPrimary else LightBorder, RoundedCornerShape(14.dp))
                                .clickable { selectedEditor = if (isSelected) null else wl.name }
                                .padding(12.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Person, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(wl.name, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                }
                                Text("${wl.done}/${wl.total} Delivered (${wl.completionRate}%)", color = EmeraldDark, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                                LinearProgressIndicator(
                                    progress = { wl.completionRate / 100f },
                                    modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)),
                                    color = IndigoPrimary,
                                    trackColor = LightSurfaceSubtle
                                )
                                Text(
                                    text = "${wl.inProgress} active • ${wl.pending} pending" + if (wl.overdue > 0) " • ${wl.overdue} overdue" else "",
                                    color = if (wl.overdue > 0) RoseError else TextMuted,
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }
                }
            }

            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Filter tasks by date, Safar, or editor…", fontSize = 13.sp, color = TextMuted) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
            }

            items(filteredTasks, key = { it.id }) { task ->
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
                                Text(task.title, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                Text(task.campaignId, color = TextSecondary, fontSize = 11.sp)
                            }
                            StageChip(stage = task.stage)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Editor: ${task.effectiveVideoEditor}", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                if (task.dueDate.isNotBlank()) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.CalendarToday, contentDescription = null, tint = if (task.isOverdue) RoseError else TextMuted, modifier = Modifier.size(12.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = "Due ${task.dueDate}" + if (task.isOverdue) " (Overdue)" else "",
                                            color = if (task.isOverdue) RoseError else TextSecondary,
                                            fontSize = 11.sp
                                        )
                                    }
                                }
                            }
                            OutlinedButton(
                                onClick = { editingTask = task },
                                shape = RoundedCornerShape(8.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(14.dp), tint = IndigoPrimary)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Assign", fontSize = 11.sp, color = IndigoPrimary)
                            }
                        }
                    }
                }
            }
        }
    }

    editingTask?.let { task ->
        var editorInput by remember(task.id) { mutableStateOf(task.effectiveVideoEditor) }
        var dueInput by remember(task.id) { mutableStateOf(task.dueDate) }
        AlertDialog(
            onDismissRequest = { editingTask = null },
            containerColor = LightSurface,
            title = { Text("Assign Editor & Due Date", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("${task.campaignId} • ${task.title}", color = TextSecondary, fontSize = 12.sp)
                    OutlinedTextField(
                        value = editorInput,
                        onValueChange = { editorInput = it },
                        label = { Text("Editor Name") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = dueInput,
                        onValueChange = { dueInput = it },
                        label = { Text("Due Date (YYYY-MM-DD)") },
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        repository.updateTaskEditor(task.id, editorInput)
                        repository.updateTaskDueDate(task.id, dueInput)
                        editingTask = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
                ) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { editingTask = null }) { Text("Cancel") }
            }
        )
    }
}
