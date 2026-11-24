package com.onetap.studiotracker.ui.screens.photos

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.FolderShared
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
fun PhotoTrackerScreen(
    viewModel: PhotoTrackerViewModel = viewModel(),
    modifier: Modifier = Modifier
) {
    val activeCampaign by viewModel.activeCampaign.collectAsState()
    val tasks = activeCampaign?.tasks ?: emptyList()

    val totalPhotos = activeCampaign?.totalPhotosCount ?: 0
    val uploadedPhotos = activeCampaign?.uploadedPhotosCount ?: 0
    val uploadPercentage = activeCampaign?.photoUploadPercentage ?: 0

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
                        text = "Google Drive Photo Tracker",
                        color = TextPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = activeCampaign?.name ?: "No Campaign Selected",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                }
            }

            // Sync Overview Command Box
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(DarkSurfaceElevated)
                        .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
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
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(EmeraldSuccess.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CloudDone,
                                        contentDescription = null,
                                        tint = EmeraldSuccess,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "DRIVE ARCHIVE STATUS",
                                        color = EmeraldSuccess,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "$uploadedPhotos / $totalPhotos Photos",
                                        color = TextPrimary,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            Text(
                                text = "$uploadPercentage%",
                                color = if (uploadPercentage == 100) EmeraldSuccess else TextPrimary,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Linear progress indicator
                        LinearProgressIndicator(
                            progress = { if (totalPhotos > 0) uploadedPhotos.toFloat() / totalPhotos else 0f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = EmeraldSuccess,
                            trackColor = DarkSurface
                        )

                        Text(
                            text = "${activeCampaign?.deliveredPhotosCount ?: 0} of ${tasks.size} scheduled dates fully synced to Drive",
                            color = TextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // Dates List Header
            item {
                Text(
                    text = "Scheduled Dates Coverage",
                    color = TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Task Photos Items
            items(tasks, key = { it.id }) { task ->
                PhotoTaskRowCard(
                    task = task,
                    onAdjustCount = { delta -> viewModel.adjustPhotoCount(task, delta) },
                    onMarkAll = { viewModel.markAllPhotosUploaded(task) },
                    onSelectStage = { stage -> viewModel.updatePhotoStage(task, stage) }
                )
            }
        }
    }
}

@Composable
fun PhotoTaskRowCard(
    task: SafarTask,
    onAdjustCount: (Int) -> Unit,
    onMarkAll: () -> Unit,
    onSelectStage: (PhotoStage) -> Unit
) {
    val context = LocalContext.current
    val isComplete = task.isPhotosDelivered

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(DarkSurface)
            .border(
                1.dp,
                if (isComplete) EmeraldSuccess.copy(alpha = 0.4f) else DarkBorder,
                RoundedCornerShape(14.dp)
            )
            .padding(14.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // Header: Title & Stage Chip
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = task.title,
                        color = TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${task.hijriDate} • ${task.gregorianDate}",
                        color = TextMuted,
                        fontSize = 11.sp
                    )
                }
                PhotoStageChip(photoStage = task.photoStage)
            }

            // Photos Progress Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Synced: ${task.uploadedPhotos} / ${task.totalPhotos} photos",
                    color = TextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "${task.photoProgressPercent}%",
                    color = if (isComplete) EmeraldSuccess else TextPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Progress Bar
            LinearProgressIndicator(
                progress = { if (task.totalPhotos > 0) task.uploadedPhotos.toFloat() / task.totalPhotos else 0f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = if (isComplete) EmeraldSuccess else IndigoPrimary,
                trackColor = DarkSurfaceElevated
            )

            // Stepper and Drive Action Controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Steppers (-10, +10)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedButton(
                        onClick = { onAdjustCount(-10) },
                        modifier = Modifier.size(34.dp),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(0.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DarkBorder),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondary),
                        enabled = task.uploadedPhotos > 0
                    ) {
                        Icon(imageVector = Icons.Default.Remove, contentDescription = "-10", modifier = Modifier.size(14.dp))
                    }

                    OutlinedButton(
                        onClick = { onAdjustCount(10) },
                        modifier = Modifier.size(34.dp),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(0.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DarkBorder),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondary),
                        enabled = task.uploadedPhotos < task.totalPhotos
                    ) {
                        Icon(imageVector = Icons.Default.Add, contentDescription = "+10", modifier = Modifier.size(14.dp))
                    }

                    if (!isComplete) {
                        Button(
                            onClick = onMarkAll,
                            modifier = Modifier.height(34.dp),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceElevated, contentColor = EmeraldSuccess)
                        ) {
                            Icon(imageVector = Icons.Default.DoneAll, contentDescription = null, modifier = Modifier.size(13.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "All Done", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // Open Drive link button
                if (!task.driveFolderUrl.isNullOrBlank()) {
                    OutlinedButton(
                        onClick = {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(task.driveFolderUrl))
                            context.startActivity(intent)
                        },
                        modifier = Modifier.height(34.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DarkBorder),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF38BDF8)),
                        contentPadding = PaddingValues(horizontal = 10.dp)
                    ) {
                        Icon(imageVector = Icons.Default.FolderShared, contentDescription = null, modifier = Modifier.size(13.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = "Drive", fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@androidx.compose.ui.tooling.preview.Preview(showBackground = true, backgroundColor = 0xFF0F172A)
@Composable
fun PhotoTrackerScreenPreview() {
    com.onetap.studiotracker.ui.theme.OneTapStudioTheme {
        PhotoTrackerScreen()
    }
}
