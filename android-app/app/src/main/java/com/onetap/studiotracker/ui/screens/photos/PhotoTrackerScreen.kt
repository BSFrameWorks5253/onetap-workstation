package com.onetap.studiotracker.ui.screens.photos

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.FolderShared
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
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
import com.onetap.studiotracker.data.models.PhotoStage
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.ui.components.PhotoStageChip
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.EmeraldSoft
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.IndigoSoft
import com.onetap.studiotracker.ui.theme.LightBackground
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary

@Composable
fun PhotoTrackerScreen(
    viewModel: PhotoTrackerViewModel = viewModel(),
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val campaigns by viewModel.campaigns.collectAsState()
    val activeCampaign by viewModel.activeCampaign.collectAsState()
    val driveInfoMap by viewModel.drivePhotoInfo.collectAsState()

    var selectedSafarId by remember(activeCampaign?.id) { mutableStateOf(activeCampaign?.id) }
    val displayCampaign = campaigns.firstOrNull { it.id == selectedSafarId } ?: activeCampaign
    val tasks = displayCampaign?.tasks ?: emptyList()

    var filterStage by remember { mutableStateOf<PhotoStage?>(null) }
    val filteredTasks = if (filterStage == null) tasks else tasks.filter {
        val effective = if (it.photoUploaded) PhotoStage.UPLOADED else it.photoStage
        effective == filterStage
    }

    val totalDates = displayCampaign?.totalDates ?: 0
    val uploadedDates = displayCampaign?.deliveredPhotosCount ?: 0
    val uploadPercentage = displayCampaign?.photoUploadPercentage ?: 0

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
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Photo Tracker",
                            color = TextPrimary,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Edited → With Murtaza → Uploaded",
                            color = TextSecondary,
                            fontSize = 13.sp
                        )
                    }
                    if (displayCampaign != null) {
                        OutlinedButton(
                            onClick = {
                                viewModel.syncDriveFolders(displayCampaign)
                                Toast.makeText(context, "Syncing Google Drive folders…", Toast.LENGTH_SHORT).show()
                            },
                            shape = RoundedCornerShape(10.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp), tint = IndigoPrimary)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Drive Sync", fontSize = 12.sp, color = IndigoPrimary)
                        }
                    }
                }
            }

            // Safar Switcher Pills
            if (campaigns.isNotEmpty()) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        campaigns.filter { !it.isArchived }.forEach { camp ->
                            val isSelected = camp.id == displayCampaign?.id
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSelected) IndigoPrimary else LightSurface)
                                    .border(1.dp, if (isSelected) IndigoPrimary else LightBorder, RoundedCornerShape(10.dp))
                                    .clickable { selectedSafarId = camp.id }
                                    .padding(horizontal = 12.dp, vertical = 7.dp)
                            ) {
                                Text(
                                    text = camp.name,
                                    color = if (isSelected) Color.White else TextSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }

            // Photo Summary Card
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(LightSurface)
                        .border(1.dp, LightBorder, RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(EmeraldSoft),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.PhotoLibrary, contentDescription = null, tint = EmeraldDark, modifier = Modifier.size(20.dp))
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = displayCampaign?.name ?: "No Active Safar",
                                        color = TextPrimary,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "$uploadedDates of $totalDates dates uploaded",
                                        color = TextSecondary,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                            Text(
                                text = "$uploadPercentage%",
                                color = if (uploadPercentage == 100) EmeraldDark else IndigoPrimary,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        LinearProgressIndicator(
                            progress = { uploadPercentage / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = EmeraldSuccess,
                            trackColor = LightSurfaceSubtle
                        )

                        // 3-Stage Counts Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            PhotoStage.entries.forEach { st ->
                                val count = displayCampaign?.countForPhotoStage(st) ?: 0
                                val isSelected = filterStage == st
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (isSelected) st.composeColor.copy(alpha = 0.14f) else LightSurfaceSubtle)
                                        .border(1.dp, if (isSelected) st.composeColor else LightBorder, RoundedCornerShape(10.dp))
                                        .clickable { filterStage = if (isSelected) null else st }
                                        .padding(10.dp)
                                ) {
                                    Column {
                                        Text(st.title, color = st.composeColor, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        Text("$count", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        val pendingIds = tasks.filter { !it.isPhotosDelivered }.map { it.id }.toSet()
                        if (pendingIds.isNotEmpty()) {
                            Button(
                                onClick = { viewModel.batchMarkUploaded(pendingIds) },
                                modifier = Modifier.fillMaxWidth().height(42.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = EmeraldDark, contentColor = Color.White)
                            ) {
                                Icon(Icons.Default.DoneAll, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Mark All Remaining (${pendingIds.size}) Uploaded", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            if (filteredTasks.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(LightSurface)
                            .border(1.dp, LightBorder, RoundedCornerShape(14.dp))
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (tasks.isEmpty()) "Waiting for Safar dates from Supabase…" else "No dates in this photo stage.",
                            color = TextSecondary,
                            fontSize = 13.sp
                        )
                    }
                }
            }

            items(filteredTasks, key = { it.id }) { task ->
                val driveKey = "${task.campaignId}::${task.title}"
                val driveInfo = driveInfoMap[driveKey]
                PhotoTaskCard(
                    task = task,
                    driveUrlOverride = driveInfo?.driveFolderUrl,
                    onUpdateStage = { next -> viewModel.updatePhotoStage(task, next) },
                    onOpenDrive = { url ->
                        try {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (_: Throwable) {}
                    }
                )
            }
        }
    }
}

@Composable
private fun PhotoTaskCard(
    task: SafarTask,
    driveUrlOverride: String?,
    onUpdateStage: (PhotoStage) -> Unit,
    onOpenDrive: (String) -> Unit
) {
    val effectiveStage = if (task.photoUploaded) PhotoStage.UPLOADED else task.photoStage
    val driveUrl = driveUrlOverride ?: task.driveFolderUrl

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(LightSurface)
            .border(1.dp, LightBorder, RoundedCornerShape(14.dp))
            .padding(14.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(task.title, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Text(
                        text = "Photo Lead: ${task.effectivePhotoEditor} • Video: ${task.stage.title}",
                        color = TextSecondary,
                        fontSize = 11.sp
                    )
                }
                PhotoStageChip(photoStage = effectiveStage)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (effectiveStage.prevStage != null) {
                    OutlinedButton(
                        onClick = { onUpdateStage(effectiveStage.prevStage!!) },
                        modifier = Modifier.height(36.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder)
                    ) {
                        Icon(Icons.Default.ArrowBack, contentDescription = null, modifier = Modifier.size(14.dp), tint = TextSecondary)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(effectiveStage.prevStage!!.title, fontSize = 11.sp, color = TextSecondary)
                    }
                }

                if (effectiveStage.nextStage != null) {
                    Button(
                        onClick = { onUpdateStage(effectiveStage.nextStage!!) },
                        modifier = Modifier.weight(1f).height(36.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = effectiveStage.nextStage!!.composeColor,
                            contentColor = Color.White
                        )
                    ) {
                        Text("Move to ${effectiveStage.nextStage!!.title}", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(14.dp))
                    }
                } else {
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(EmeraldSoft)
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = EmeraldDark, modifier = Modifier.size(15.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Cloud Synced", color = EmeraldDark, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                if (!driveUrl.isNullOrBlank()) {
                    OutlinedButton(
                        onClick = { onOpenDrive(driveUrl) },
                        modifier = Modifier.height(36.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder)
                    ) {
                        Icon(Icons.Default.FolderShared, contentDescription = "Open Drive", tint = IndigoPrimary, modifier = Modifier.size(15.dp))
                    }
                }
            }
        }
    }
}
