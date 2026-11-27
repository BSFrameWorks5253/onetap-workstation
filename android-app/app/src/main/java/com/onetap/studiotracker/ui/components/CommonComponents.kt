package com.onetap.studiotracker.ui.components

import android.app.DatePickerDialog
import android.widget.Toast
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.ViewKanban
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.data.models.PhotoStage
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import com.onetap.studiotracker.ui.navigation.Screen
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.EmeraldSoft
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.IndigoSoft
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.liquidBouncyClick
import com.onetap.studiotracker.ui.theme.liquidGlassCard
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.util.AppUpdateInfo
import com.onetap.studiotracker.util.UpdateManager
import kotlinx.coroutines.launch

@Composable
fun BottomNavBar(currentRoute: String, onNavigate: (Screen) -> Unit, pendingTaskCount: Int = 0) {
    val navItems = Screen.items.filterNotNull()
    val selectedIndex = navItems.indexOfFirst { it.route == currentRoute }.coerceAtLeast(0)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .height(66.dp)
                .shadow(
                    elevation = 14.dp,
                    shape = RoundedCornerShape(33.dp),
                    ambientColor = Color(0x1E0F172A),
                    spotColor = Color(0x244F46E5)
                )
                .clip(RoundedCornerShape(33.dp))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.76f),
                            Color(0xFFF8FAFC).copy(alpha = 0.58f)
                        )
                    )
                )
                .border(
                    width = 1.25.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.98f),
                            Color(0xFFDCE5F2).copy(alpha = 0.75f)
                        )
                    ),
                    shape = RoundedCornerShape(33.dp)
                )
                .padding(4.dp)
        ) {
            val tabWidth = maxWidth / navItems.size
            val blobOffset by animateDpAsState(
                targetValue = tabWidth * selectedIndex,
                animationSpec = spring(
                    dampingRatio = 0.56f,
                    stiffness = 340f
                ),
                label = "jellyBlobOffset"
            )

            // Bouncy sliding jelly-blob lens pill
            Box(
                modifier = Modifier
                    .offset(x = blobOffset)
                    .width(tabWidth)
                    .fillMaxHeight()
                    .padding(2.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                IndigoSoft.copy(alpha = 0.95f),
                                Color.White.copy(alpha = 0.85f)
                            )
                        )
                    )
                    .border(
                        width = 1.dp,
                        color = IndigoPrimary.copy(alpha = 0.20f),
                        shape = RoundedCornerShape(28.dp)
                    )
            )

            Row(
                modifier = Modifier.fillMaxSize(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                navItems.forEach { screen ->
                    val selected = currentRoute == screen.route
                    val iconScale by animateFloatAsState(
                        targetValue = if (selected) 1.12f else 1f,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioMediumBouncy,
                            stiffness = 420f
                        ),
                        label = "tabIconScale"
                    )
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(28.dp))
                            .liquidBouncyClick(pressScale = 0.92f) { onNavigate(screen) },
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Box(
                                modifier = Modifier.graphicsLayer {
                                    scaleX = iconScale
                                    scaleY = iconScale
                                }
                            ) {
                                Icon(
                                    screen.icon,
                                    contentDescription = screen.title,
                                    tint = if (selected) IndigoPrimary else TextMuted,
                                    modifier = Modifier.size(20.dp)
                                )
                                if (screen == Screen.Kanban && pendingTaskCount > 0) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .offset(x = 5.dp, y = (-3).dp)
                                            .size(14.dp)
                                            .clip(CircleShape)
                                            .background(RoseError),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            if (pendingTaskCount > 9) "9+" else "$pendingTaskCount",
                                            color = Color.White,
                                            fontSize = 8.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                            Text(
                                screen.title,
                                color = if (selected) IndigoPrimary else TextMuted,
                                fontSize = 9.5.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                maxLines = 1
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StageChip(stage: Stage, onClick: (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(stage.composeColor.copy(alpha = 0.11f))
            .border(1.dp, stage.composeColor.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(horizontal = 9.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(stage.composeColor)
        )
        Text(stage.title, color = stage.composeColor, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        if (onClick != null) {
            Icon(
                Icons.Default.KeyboardArrowDown,
                contentDescription = "Change stage",
                tint = stage.composeColor,
                modifier = Modifier.size(13.dp)
            )
        }
    }
}

@Composable
fun StageDropdownChip(
    currentStage: Stage,
    onStageSelected: (Stage) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        StageChip(stage = currentStage, onClick = { expanded = true })
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier
                .background(LightSurface)
                .border(1.dp, LightBorder, RoundedCornerShape(12.dp))
        ) {
            Stage.entries.forEach { st ->
                val isSelected = st == currentStage
                DropdownMenuItem(
                    text = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(st.composeColor)
                            )
                            Text(
                                text = st.title,
                                color = if (isSelected) st.composeColor else TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    },
                    trailingIcon = if (isSelected) {
                        { Icon(Icons.Default.Check, contentDescription = null, tint = st.composeColor, modifier = Modifier.size(16.dp)) }
                    } else null,
                    onClick = {
                        expanded = false
                        if (st != currentStage) onStageSelected(st)
                    },
                    modifier = Modifier.background(if (isSelected) st.composeColor.copy(alpha = 0.08f) else Color.Transparent)
                )
            }
        }
    }
}

@Composable
fun <T> StudioDropdownSelector(
    label: String? = null,
    selectedText: String,
    items: List<T>,
    selectedItem: T?,
    itemLabel: (T) -> String,
    itemSubLabel: ((T) -> String?)? = null,
    leadingIcon: ImageVector? = null,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val arrowRotation by animateFloatAsState(
        targetValue = if (expanded) 180f else 0f,
        label = "dropdownArrow"
    )

    Box(modifier = modifier) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (!label.isNullOrBlank()) {
                Text(
                    text = label,
                    color = TextMuted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(LightSurface)
                    .border(
                        1.dp,
                        if (expanded) IndigoPrimary else LightBorder,
                        RoundedCornerShape(12.dp)
                    )
                    .clickable { expanded = true }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    if (leadingIcon != null) {
                        Icon(
                            leadingIcon,
                            contentDescription = null,
                            tint = IndigoPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    Text(
                        text = selectedText,
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Icon(
                    Icons.Default.KeyboardArrowDown,
                    contentDescription = "Expand",
                    tint = if (expanded) IndigoPrimary else TextSecondary,
                    modifier = Modifier
                        .size(18.dp)
                        .graphicsLayer { rotationZ = arrowRotation }
                )
            }
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier
                .background(LightSurface)
                .border(1.dp, LightBorder, RoundedCornerShape(12.dp))
        ) {
            items.forEach { item ->
                val isSelected = item == selectedItem
                val sub = itemSubLabel?.invoke(item)
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(
                                text = itemLabel(item),
                                color = if (isSelected) IndigoPrimary else TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (!sub.isNullOrBlank()) {
                                Text(
                                    text = sub,
                                    color = TextMuted,
                                    fontSize = 10.sp
                                )
                            }
                        }
                    },
                    trailingIcon = if (isSelected) {
                        { Icon(Icons.Default.Check, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(16.dp)) }
                    } else null,
                    onClick = {
                        expanded = false
                        onSelect(item)
                    },
                    modifier = Modifier.background(if (isSelected) IndigoSoft else Color.Transparent)
                )
            }
        }
    }
}

@Composable
fun PhotoStageChip(photoStage: PhotoStage) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(photoStage.composeColor.copy(alpha = 0.12f))
            .border(1.dp, photoStage.composeColor.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(photoStage.title, color = photoStage.composeColor, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun MultiStageProgressBar(campaign: SafarCampaign, height: Dp = 8.dp) {
    val total = campaign.totalDates.coerceAtLeast(1)
    Row(
        modifier = Modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(height / 2)).background(LightSurfaceSubtle)
    ) {
        Stage.entries.reversed().forEach { st ->
            val count = campaign.countForStage(st)
            if (count > 0) {
                Box(modifier = Modifier.weight(count.toFloat() / total).fillMaxHeight().background(st.composeColor))
            }
        }
    }
}

@Composable
fun ExecutiveHeroCard(
    campaign: SafarCampaign,
    onOpenBriefing: () -> Unit,
    onCopyStatus: () -> Unit,
    onNavigateKanban: () -> Unit
) {
    val is100Done = campaign.is100PercentDone
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .liquidGlassCard(
                cornerRadius = 18.dp,
                borderColor = if (is100Done) EmeraldSuccess else LightBorder,
                borderWidth = if (is100Done) 1.5.dp else 1.dp
            )
            .padding(18.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(if (is100Done) EmeraldSuccess else IndigoPrimary))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (is100Done) "CAMPAIGN COMPLETED" else "ACTIVE ONGOING SAFAR",
                        fontSize = 11.sp, fontWeight = FontWeight.Bold,
                        color = if (is100Done) EmeraldDark else IndigoPrimary
                    )
                }
                if (is100Done) {
                    Row(
                        modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(EmeraldSoft).padding(horizontal = 8.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = EmeraldDark, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("100% DONE", color = EmeraldDark, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Text(campaign.name, color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${campaign.totalDates} Scheduled Dates", color = TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                Text("${campaign.overallPercentage}% Delivered", color = if (is100Done) EmeraldDark else TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }

            MultiStageProgressBar(campaign = campaign, height = 8.dp)

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(LightSurfaceSubtle)
                        .border(1.dp, LightBorder, RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.Movie, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(15.dp))
                    Text("${campaign.deliveredVideosCount}/${campaign.totalDates} Videos", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Row(
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(LightSurfaceSubtle)
                        .border(1.dp, LightBorder, RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = EmeraldDark, modifier = Modifier.size(15.dp))
                    Text("${campaign.deliveredPhotosCount}/${campaign.totalDates} Photos", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Button(
                onClick = onOpenBriefing,
                modifier = Modifier.fillMaxWidth().height(46.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White)
            ) {
                Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Send Daily WhatsApp Briefing", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = onCopyStatus, modifier = Modifier.weight(1f).height(42.dp),
                    shape = RoundedCornerShape(10.dp), border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder)
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(15.dp), tint = TextSecondary)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Copy Status", fontSize = 12.sp, color = TextPrimary)
                }
                OutlinedButton(
                    onClick = onNavigateKanban, modifier = Modifier.weight(1f).height(42.dp),
                    shape = RoundedCornerShape(10.dp), border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder)
                ) {
                    Icon(Icons.Default.ViewKanban, contentDescription = null, modifier = Modifier.size(15.dp), tint = IndigoPrimary)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Open Pipeline", fontSize = 12.sp, color = TextPrimary)
                }
            }
        }
    }
}

@Composable
fun AppUpdateDialog(updateInfo: AppUpdateInfo, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var downloading by remember { mutableStateOf(false) }
    var progress by remember { mutableIntStateOf(0) }

    AlertDialog(
        onDismissRequest = { if (!downloading) onDismiss() },
        containerColor = LightSurface,
        title = { Text("Update Available: v${updateInfo.latestVersion}", color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(updateInfo.changelog, color = TextSecondary, fontSize = 13.sp)
                if (downloading) {
                    LinearProgressIndicator(progress = { progress / 100f }, modifier = Modifier.fillMaxWidth(), color = IndigoPrimary)
                    Text("Downloading APK… $progress%", color = IndigoPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !downloading && updateInfo.downloadUrl.isNotBlank(),
                onClick = {
                    scope.launch {
                        downloading = true
                        val res = UpdateManager.downloadAndInstallApk(context, updateInfo.downloadUrl, updateInfo.latestVersion) { progress = it }
                        downloading = false
                        if (res.isFailure) {
                            Toast.makeText(context, res.exceptionOrNull()?.message ?: "Update failed", Toast.LENGTH_SHORT).show()
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
            ) { Text(if (downloading) "Downloading…" else "Update Now") }
        },
        dismissButton = {
            if (!downloading) TextButton(onClick = onDismiss) { Text("Later") }
        }
    )
}

@Composable
fun NewSafarReceivedDateDialog(
    safarName: String,
    onSave: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val todayStr = remember {
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    }
    var dateInput by remember(safarName) { mutableStateOf(todayStr) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = LightSurface,
        icon = {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(IndigoSoft),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.FolderOpen, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(22.dp))
            }
        },
        title = {
            Text(
                "New Safar Detected",
                color = TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Enter the Received Date for \"$safarName\":",
                    color = TextSecondary,
                    fontSize = 13.sp
                )
                OutlinedTextField(
                    value = dateInput,
                    onValueChange = { dateInput = it },
                    label = { Text("Received Date (YYYY-MM-DD)", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { dateInput = todayStr },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Today", fontSize = 12.sp, color = IndigoPrimary, fontWeight = FontWeight.SemiBold)
                    }
                    OutlinedButton(
                        onClick = {
                            val cal = Calendar.getInstance()
                            DatePickerDialog(
                                context,
                                { _, y, m, d ->
                                    dateInput = String.format(Locale.US, "%04d-%02d-%02d", y, m + 1, d)
                                },
                                cal.get(Calendar.YEAR),
                                cal.get(Calendar.MONTH),
                                cal.get(Calendar.DAY_OF_MONTH)
                            ).show()
                        },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.CalendarToday, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Pick Date", fontSize = 12.sp, color = IndigoPrimary, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = dateInput.isNotBlank(),
                onClick = { onSave(dateInput.trim()) },
                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
            ) {
                Text("Save Date", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Skip", color = TextSecondary)
            }
        }
    )
}

@Composable
fun PhaseCompletionTimelineCard(
    task: SafarTask,
    safarReceivedDate: String = ""
) {
    val formatter = remember { SimpleDateFormat("MMM dd, yyyy • hh:mm a", Locale.getDefault()) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(LightSurfaceSubtle)
            .border(1.dp, LightBorder, RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.Schedule, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(15.dp))
                    Text("Phase Completion Timestamps", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                if (safarReceivedDate.isNotBlank()) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(IndigoSoft)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text("Rcvd: $safarReceivedDate", color = IndigoPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Stage.entries.forEach { st ->
                val ts = task.stageTimestamps[st.id]
                    ?: if (task.stage == st && task.updatedAt > 0L) task.updatedAt else null
                val isReached = task.stage.ordinal >= st.ordinal || ts != null
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(
                            if (isReached) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                            contentDescription = null,
                            tint = if (isReached) st.composeColor else TextMuted,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            st.title,
                            color = if (isReached) TextPrimary else TextMuted,
                            fontSize = 12.sp,
                            fontWeight = if (task.stage == st) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                    Text(
                        text = if (ts != null) formatter.format(Date(ts)) else "Pending",
                        color = if (ts != null) TextSecondary else TextMuted,
                        fontSize = 11.sp,
                        fontWeight = if (ts != null) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
            }
        }
    }
}
