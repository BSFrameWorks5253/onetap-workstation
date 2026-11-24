package com.onetap.studiotracker.ui.screens.radar

import android.widget.Toast
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CastConnected
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.HourglassBottom
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Radar
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.data.sync.SupabaseSyncClient
import com.onetap.studiotracker.ui.theme.DarkBackground
import com.onetap.studiotracker.ui.theme.DarkBorder
import com.onetap.studiotracker.ui.theme.DarkSurface
import com.onetap.studiotracker.ui.theme.DarkSurfaceElevated
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.util.AudioBriefingPlayer
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@Composable
fun IngestRadarScreen(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val repository = SafarRepository.getInstance()
    val activeCampaign by repository.campaigns.collectAsState()
    val campaign = activeCampaign.firstOrNull { it.isOngoing } ?: activeCampaign.firstOrNull()

    val audioPlayer = remember { AudioBriefingPlayer(context) }
    val isAudioPlaying by audioPlayer.isPlaying.collectAsState()

    // Missing media detection
    val uningestedTasks = campaign?.tasks?.filter { it.stage == Stage.EDITING_PENDING && it.uploadedPhotos == 0 } ?: emptyList()
    val inProgressTasks = campaign?.tasks?.filter { it.stage == Stage.IN_PROGRESS || it.stage == Stage.UPLOAD_PENDING } ?: emptyList()

    // Production Stopwatch State
    var isTimerRunning by remember { mutableStateOf(false) }
    var elapsedSeconds by remember { mutableIntStateOf(0) }

    remember(isTimerRunning) {
        if (isTimerRunning) {
            coroutineScope.launch {
                while (isActive && isTimerRunning) {
                    delay(1000)
                    elapsedSeconds++
                }
            }
        }
    }

    // Pulse animation for radar ring
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

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
                        text = "Live Ingest Radar & Sentinel",
                        color = TextPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Real-time missing media detection & desktop broadcast",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                }
            }

            // Radar Status Card
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(DarkSurfaceElevated)
                        .border(1.dp, if (uningestedTasks.isNotEmpty()) RoseError.copy(alpha = 0.5f) else EmeraldSuccess.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .scale(if (uningestedTasks.isNotEmpty()) pulseScale else 1f)
                                    .clip(CircleShape)
                                    .background(if (uningestedTasks.isNotEmpty()) RoseError.copy(alpha = 0.2f) else EmeraldSuccess.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Radar,
                                    contentDescription = null,
                                    tint = if (uningestedTasks.isNotEmpty()) RoseError else EmeraldSuccess,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = if (uningestedTasks.isNotEmpty()) "MEDIA GAPS DETECTED" else "ALL FOOTAGE INGESTED",
                                    color = if (uningestedTasks.isNotEmpty()) RoseError else EmeraldSuccess,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = if (uningestedTasks.isNotEmpty()) "${uningestedTasks.size} dates pending card ingest" else "All scheduled dates processed",
                                    color = TextPrimary,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        // Broadcast Alert to Desktop Premiere Pro
                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    val client = SupabaseSyncClient()
                                    val res = client.broadcastNotification(
                                        title = "🚨 Media Ingest Alert from Mobile",
                                        message = "Director flagged ${uningestedTasks.size} pending dates for ${campaign?.name}",
                                        type = "media_ingest_alert"
                                    )
                                    if (res.isSuccess) {
                                        Toast.makeText(context, "Ping broadcasted to Desktop Premiere Pro Workstation!", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (uningestedTasks.isNotEmpty()) RoseError else IndigoPrimary,
                                contentColor = Color.White
                            ),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Icon(imageVector = Icons.Default.Campaign, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "Ping Desktop", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // AI Audio Voice Briefing Synthesizer Card
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(DarkSurface)
                        .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
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
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(IndigoPrimary.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.VolumeUp,
                                        contentDescription = null,
                                        tint = Color(0xFF818CF8),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "AI Audio Briefing Synthesizer",
                                        color = TextPrimary,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "High-fidelity spoken voice report for directors",
                                        color = TextMuted,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }

                        Button(
                            onClick = {
                                if (campaign != null) {
                                    audioPlayer.playCampaignBriefing(campaign)
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isAudioPlaying) RoseError else IndigoPrimary,
                                contentColor = Color.White
                            )
                        ) {
                            Icon(
                                imageVector = if (isAudioPlaying) Icons.Default.Stop else Icons.Default.PlayArrow,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (isAudioPlaying) "Stop Voice Memo" else "Play AI Spoken Briefing",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }

            // Production Field Stopwatch & Timer Card
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(DarkSurface)
                        .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Timer, contentDescription = null, tint = Color(0xFF38BDF8), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(text = "Production Shoot Timer", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                            val minutes = elapsedSeconds / 60
                            val seconds = elapsedSeconds % 60
                            Text(
                                text = String.format("%02d:%02d", minutes, seconds),
                                color = TextPrimary,
                                fontSize = 28.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = {
                                    isTimerRunning = false
                                    elapsedSeconds = 0
                                },
                                shape = RoundedCornerShape(8.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, DarkBorder),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondary)
                            ) {
                                Text(text = "Reset", fontSize = 12.sp)
                            }

                            Button(
                                onClick = { isTimerRunning = !isTimerRunning },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isTimerRunning) RoseError else EmeraldSuccess,
                                    contentColor = Color.White
                                )
                            ) {
                                Text(text = if (isTimerRunning) "Pause" else "Start", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Missing Ingest List
            if (uningestedTasks.isNotEmpty()) {
                item {
                    Text(
                        text = "Pending Footage Ingest (${uningestedTasks.size} Dates)",
                        color = RoseError,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                items(uningestedTasks) { task ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(DarkSurfaceElevated)
                            .border(1.dp, RoseError.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(text = task.title, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                Text(text = "No footage or photos ingested yet", color = TextMuted, fontSize = 10.sp)
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(RoseError.copy(alpha = 0.2f))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(text = "UNINGESTED", color = RoseError, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
