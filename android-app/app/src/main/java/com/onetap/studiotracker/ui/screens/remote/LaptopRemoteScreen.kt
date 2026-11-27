package com.onetap.studiotracker.ui.screens.remote

import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.DesktopWindows
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Monitor
import androidx.compose.material.icons.filled.Mouse
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.data.remote.LaptopRemoteClient
import com.onetap.studiotracker.data.remote.RemoteConnState
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.theme.AmberDark
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.EmeraldSoft
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.IndigoSoft
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.RoseSoft
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.ui.theme.liquidBouncyClick
import com.onetap.studiotracker.ui.theme.liquidGlassCard

@Composable
fun LaptopRemoteScreen(onBack: () -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    val repo = SafarRepository.getInstance()
    val remote = remember { LaptopRemoteClient.getInstance() }

    val lanIps by repo.desktopLanIps.collectAsState()
    val remotePort by repo.desktopRemotePort.collectAsState()
    val remoteToken by repo.desktopRemoteToken.collectAsState()

    val connState by remote.connState.collectAsState()
    val connectedHost by remote.connectedHost.collectAsState()
    val errorText by remote.errorText.collectAsState()
    val latestFrame by remote.latestFrame.collectAsState()
    val isStreaming by remote.isStreaming.collectAsState()

    var customIp by remember { mutableStateOf("") }
    var textInput by remember { mutableStateOf("") }
    var pendingPowerAction by remember { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(Unit) {
        repo.pingDesktopWorkstation()
    }

    LaunchedEffect(lanIps, remotePort, remoteToken) {
        if (connState == RemoteConnState.DISCONNECTED && lanIps.isNotEmpty() && remoteToken.isNotBlank()) {
            remote.connect(lanIps, remotePort, remoteToken)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            remote.setStreaming(false)
        }
    }

    Box(modifier = modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                        }
                        Column {
                            Text("Laptop Remote", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            Text("Direct LAN • Zero Database Load", color = TextSecondary, fontSize = 11.sp)
                        }
                    }
                    val isConn = connState == RemoteConnState.CONNECTED
                    Row(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (isConn) EmeraldSoft else LightSurface.copy(alpha = 0.9f))
                            .border(1.dp, if (isConn) EmeraldSuccess.copy(alpha = 0.45f) else LightBorder, CircleShape)
                            .liquidBouncyClick(pressScale = 0.93f) {
                                repo.pingDesktopWorkstation()
                                val ips = if (customIp.isNotBlank()) listOf(customIp.trim()) + lanIps else lanIps
                                remote.connect(ips, remotePort, remoteToken)
                            }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(7.dp).clip(CircleShape)
                                .background(
                                    when (connState) {
                                        RemoteConnState.CONNECTED -> EmeraldSuccess
                                        RemoteConnState.CONNECTING -> IndigoPrimary
                                        RemoteConnState.ERROR -> RoseError
                                        RemoteConnState.DISCONNECTED -> AmberDark
                                    }
                                )
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = when (connState) {
                                RemoteConnState.CONNECTED -> connectedHost
                                RemoteConnState.CONNECTING -> "Connecting…"
                                RemoteConnState.ERROR -> "Retry"
                                RemoteConnState.DISCONNECTED -> "Connect"
                            },
                            color = if (isConn) EmeraldDark else TextPrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            if (errorText.isNotBlank()) {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(RoseSoft).border(1.dp, RoseError.copy(alpha = 0.35f), RoundedCornerShape(14.dp)).padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(errorText, color = RoseError, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = customIp,
                                onValueChange = { customIp = it },
                                placeholder = { Text("Custom / Tailscale IP (optional)", fontSize = 12.sp) },
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp)
                            )
                            Button(
                                onClick = {
                                    val ips = if (customIp.isNotBlank()) listOf(customIp.trim()) + lanIps else lanIps
                                    remote.connect(ips, remotePort, remoteToken)
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
                            ) { Text("Connect", fontSize = 12.sp) }
                        }
                    }
                }
            }

            // Live Screen View
            item {
                var viewSize by remember { mutableStateOf(IntSize.Zero) }
                Column(
                    modifier = Modifier.fillMaxWidth().liquidGlassCard(18.dp).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(if (isStreaming) Icons.Default.Videocam else Icons.Default.VideocamOff, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Live Laptop Screen (Tap to Click)", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                        Switch(
                            checked = isStreaming,
                            onCheckedChange = { remote.setStreaming(it) }
                        )
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(16f / 9f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF0F172A).copy(alpha = 0.08f))
                            .border(1.dp, LightBorder, RoundedCornerShape(12.dp))
                            .onSizeChanged { viewSize = it }
                            .pointerInput(viewSize, connState) {
                                detectTapGestures { offset ->
                                    if (viewSize.width > 0 && viewSize.height > 0 && connState == RemoteConnState.CONNECTED) {
                                        val nx = (offset.x / viewSize.width.toFloat()).coerceIn(0f, 1f)
                                        val ny = (offset.y / viewSize.height.toFloat()).coerceIn(0f, 1f)
                                        remote.sendAbsTap(nx, ny)
                                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    }
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        val bmp = latestFrame
                        if (bmp != null) {
                            Image(
                                bitmap = bmp.asImageBitmap(),
                                contentDescription = "Laptop Screen",
                                contentScale = ContentScale.FillBounds,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Default.DesktopWindows, contentDescription = null, tint = TextMuted, modifier = Modifier.size(32.dp))
                                Text(
                                    if (connState == RemoteConnState.CONNECTED) "Waiting for screen frame…" else "Connect on same Wi-Fi / Tailscale to view screen",
                                    color = TextSecondary,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }

            // Touchpad & Mouse Buttons
            item {
                Column(
                    modifier = Modifier.fillMaxWidth().liquidGlassCard(18.dp).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.TouchApp, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Liquid Glass Trackpad", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Row(modifier = Modifier.fillMaxWidth().height(175.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .clip(RoundedCornerShape(16.dp))
                                .background(IndigoSoft.copy(alpha = 0.65f))
                                .border(1.dp, IndigoPrimary.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                                .pointerInput(Unit) {
                                    detectDragGestures { change, dragAmount ->
                                        change.consume()
                                        remote.sendMove(dragAmount.x * 1.45f, dragAmount.y * 1.45f)
                                    }
                                }
                                .pointerInput(Unit) {
                                    detectTapGestures(
                                        onTap = {
                                            remote.sendClick("left")
                                            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        },
                                        onDoubleTap = {
                                            remote.sendClick("double")
                                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                        }
                                    )
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Mouse, contentDescription = null, tint = IndigoPrimary.copy(alpha = 0.5f), modifier = Modifier.size(26.dp))
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("Slide to move • Tap to click", color = TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                            }
                        }

                        // Vertical Scroll Strip
                        Box(
                            modifier = Modifier
                                .width(46.dp)
                                .fillMaxHeight()
                                .clip(RoundedCornerShape(16.dp))
                                .background(LightSurfaceSubtle.copy(alpha = 0.9f))
                                .border(1.dp, LightBorder, RoundedCornerShape(16.dp))
                                .pointerInput(Unit) {
                                    detectDragGestures { change, dragAmount ->
                                        change.consume()
                                        val delta = (-dragAmount.y * 2.5f).toInt()
                                        if (delta != 0) remote.sendScroll(delta)
                                    }
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Text("S\nC\nR\nO\nL\nL", color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, lineHeight = 12.sp)
                        }
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("left" to "Left Click", "double" to "Double", "right" to "Right Click").forEach { (btn, label) ->
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(LightSurface.copy(alpha = 0.92f))
                                    .border(1.dp, LightBorder, RoundedCornerShape(12.dp))
                                    .liquidBouncyClick(pressScale = 0.94f) { remote.sendClick(btn) }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(label, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }

            // Keyboard & Quick Keys
            item {
                Column(
                    modifier = Modifier.fillMaxWidth().liquidGlassCard(18.dp).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Keyboard & Media Keys", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = textInput,
                            onValueChange = { textInput = it },
                            placeholder = { Text("Type text to send to laptop…", fontSize = 12.sp, color = TextMuted) },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        )
                        Button(
                            enabled = textInput.isNotEmpty(),
                            onClick = {
                                remote.sendText(textInput)
                                textInput = ""
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 14.dp)
                        ) {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", modifier = Modifier.size(18.dp))
                        }
                    }

                    Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(
                            "enter" to "Enter",
                            "backspace" to "Bksp",
                            "space" to "Space",
                            "esc" to "Esc",
                            "tab" to "Tab",
                            "win" to "Win",
                            "up" to "↑",
                            "down" to "↓",
                            "left" to "←",
                            "right" to "→",
                            "play_pause" to "Play/Pause",
                            "vol_down" to "Vol-",
                            "vol_up" to "Vol+",
                            "vol_mute" to "Mute"
                        ).forEach { (keyCode, label) ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(LightSurfaceSubtle.copy(alpha = 0.9f))
                                    .border(1.dp, LightBorder, RoundedCornerShape(10.dp))
                                    .liquidBouncyClick(pressScale = 0.92f) { remote.sendKey(keyCode) }
                                    .padding(horizontal = 12.dp, vertical = 8.dp)
                            ) {
                                Text(label, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Quick Power & Studio Actions
            item {
                Column(
                    modifier = Modifier.fillMaxWidth().liquidGlassCard(18.dp).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Workstation Power & Screen", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PowerPill("Lock PC", Icons.Default.Lock, IndigoPrimary, Modifier.weight(1f)) {
                            pendingPowerAction = "lock" to "Lock Laptop Screen?"
                        }
                        PowerPill("Screen Off", Icons.Default.Monitor, AmberDark, Modifier.weight(1f)) {
                            pendingPowerAction = "screen_off" to "Turn Off Laptop Display? (Renders keep running)"
                        }
                        PowerPill("Sleep", Icons.Default.Bedtime, RoseError, Modifier.weight(1f)) {
                            pendingPowerAction = "sleep" to "Put Laptop to Sleep?"
                        }
                    }
                }
            }
        }
    }

    pendingPowerAction?.let { (action, title) ->
        AlertDialog(
            onDismissRequest = { pendingPowerAction = null },
            containerColor = LightSurface,
            title = { Text(title, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = { Text("This command will execute immediately on your connected Windows laptop.", color = TextSecondary, fontSize = 13.sp) },
            confirmButton = {
                Button(
                    onClick = {
                        remote.sendPower(action)
                        Toast.makeText(context, "Sent $action to laptop", Toast.LENGTH_SHORT).show()
                        pendingPowerAction = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
                ) { Text("Confirm") }
            },
            dismissButton = {
                TextButton(onClick = { pendingPowerAction = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
private fun PowerPill(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    tint: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(LightSurface.copy(alpha = 0.9f))
            .border(1.dp, LightBorder, RoundedCornerShape(12.dp))
            .liquidBouncyClick(pressScale = 0.94f, onClick = onClick)
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(15.dp))
        Spacer(modifier = Modifier.width(5.dp))
        Text(label, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}
