package com.onetap.studiotracker.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.ui.theme.DarkBackground
import com.onetap.studiotracker.ui.theme.DarkBorder
import com.onetap.studiotracker.ui.theme.DarkSurface
import com.onetap.studiotracker.ui.theme.DarkSurfaceElevated
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.util.AppUpdateInfo
import com.onetap.studiotracker.util.UpdateManager
import kotlinx.coroutines.launch

@Composable
fun AppUpdateDialog(
    updateInfo: AppUpdateInfo,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isDownloading by remember { mutableStateOf(false) }
    var downloadProgress by remember { mutableFloatStateOf(0f) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = {
            if (!isDownloading) onDismiss()
        },
        containerColor = DarkSurface,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(IndigoPrimary.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.RocketLaunch,
                        contentDescription = null,
                        tint = Color(0xFF818CF8),
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "Update Available",
                        color = TextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "One Tap Studio v${updateInfo.latestVersion}",
                        color = EmeraldSuccess,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Version Compare Pill
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(DarkSurfaceElevated)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Installed: v${UpdateManager.CURRENT_APP_VERSION}",
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                    Text(
                        text = "Latest: v${updateInfo.latestVersion}",
                        color = Color(0xFF38BDF8),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Changelog Box
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(DarkBackground)
                        .border(1.dp, DarkBorder, RoundedCornerShape(10.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "What's New in v${updateInfo.latestVersion}:",
                        color = TextPrimary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = updateInfo.changelog,
                        color = TextSecondary,
                        fontSize = 12.sp,
                        lineHeight = 16.sp
                    )
                }

                // Downloading Progress Indicator
                AnimatedVisibility(visible = isDownloading) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Downloading update package...",
                                color = TextSecondary,
                                fontSize = 11.sp
                            )
                            Text(
                                text = "${(downloadProgress * 100).toInt()}%",
                                color = EmeraldSuccess,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        LinearProgressIndicator(
                            progress = { downloadProgress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = EmeraldSuccess,
                            trackColor = DarkSurfaceElevated
                        )
                    }
                }

                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = Color(0xFFEF4444),
                        fontSize = 11.sp
                    )
                }
            }
        },
        confirmButton = {
            if (!isDownloading) {
                Button(
                    onClick = {
                        isDownloading = true
                        errorMessage = null
                        coroutineScope.launch {
                            val result = UpdateManager.downloadAndInstallApk(
                                context = context,
                                downloadUrl = updateInfo.downloadUrl,
                                targetVersion = updateInfo.latestVersion,
                                onProgress = { progress ->
                                    downloadProgress = progress
                                }
                            )
                            if (result.isFailure) {
                                isDownloading = false
                                errorMessage = result.exceptionOrNull()?.message ?: "Download failed"
                            }
                        }
                    },
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = IndigoPrimary,
                        contentColor = Color.White
                    )
                ) {
                    Icon(imageVector = Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(text = "Install v${updateInfo.latestVersion}", fontWeight = FontWeight.Bold)
                }
            }
        },
        dismissButton = {
            if (!isDownloading) {
                TextButton(onClick = onDismiss) {
                    Text(text = "Remind Me Later", color = TextSecondary)
                }
            }
        }
    )
}
