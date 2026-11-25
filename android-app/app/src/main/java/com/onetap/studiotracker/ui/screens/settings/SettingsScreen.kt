package com.onetap.studiotracker.ui.screens.settings

import android.widget.Toast
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.EmeraldSoft
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.LightBackground
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repository = SafarRepository.getInstance()
    val syncState by repository.syncState.collectAsState()
    val authUser by repository.authUser.collectAsState()

    var gsUrlInput by remember { mutableStateOf(repository.getGsUrl()) }
    var phoneInput by remember { mutableStateOf(repository.getWhatsAppPhone()) }

    var emailInput by remember { mutableStateOf("") }
    var otpInput by remember { mutableStateOf("") }
    var otpSent by remember { mutableStateOf(false) }
    var authBusy by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(LightBackground)
            .statusBarsPadding()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 84.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Column {
                        Text("Settings & Real-Time Sync", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text("Light Mode Only • WebSocket + GAS Config", color = TextSecondary, fontSize = 12.sp)
                    }
                }
            }

            // Real-Time Sync Card
            item {
                SettingsCard(title = "Real-Time Cloud Sync") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (syncState.isRealtimeConnected) EmeraldSoft else LightBackground)
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (syncState.isRealtimeConnected) "Supabase WebSocket Live" else "Reconnecting…",
                                color = if (syncState.isRealtimeConnected) EmeraldDark else TextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(syncState.syncNotice, color = TextSecondary, fontSize = 12.sp)
                        }
                        Icon(Icons.Default.CloudSync, contentDescription = null, tint = if (syncState.isRealtimeConnected) EmeraldDark else IndigoPrimary)
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                scope.launch {
                                    repository.triggerCloudSync()
                                    Toast.makeText(context, "Synced with Supabase", Toast.LENGTH_SHORT).show()
                                }
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Sync Now", fontSize = 12.sp)
                        }
                        OutlinedButton(
                            onClick = {
                                repository.requestRescanFromDesktop()
                                Toast.makeText(context, "Rescan requested from One Tap Desktop", Toast.LENGTH_SHORT).show()
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder)
                        ) {
                            Text("Request Desktop Scan", fontSize = 12.sp, color = TextPrimary)
                        }
                    }
                }
            }

            // Email OTP Auth Card
            item {
                SettingsCard(title = "Google Apps Script Authentication") {
                    if (authUser != null) {
                        Text("Signed in as ${authUser!!.name} (${authUser!!.email})", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        Text("Role: ${authUser!!.role.uppercase()}", color = EmeraldDark, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        OutlinedButton(
                            onClick = { repository.signOut() },
                            shape = RoundedCornerShape(10.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, RoseError)
                        ) {
                            Icon(Icons.Default.Logout, contentDescription = null, tint = RoseError, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Sign Out", color = RoseError, fontSize = 12.sp)
                        }
                    } else {
                        OutlinedTextField(
                            value = emailInput,
                            onValueChange = { emailInput = it },
                            label = { Text("Email Address") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (otpSent) {
                            OutlinedTextField(
                                value = otpInput,
                                onValueChange = { otpInput = it },
                                label = { Text("6-Digit Verification Code") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        Button(
                            onClick = {
                                if (authBusy) return@Button
                                scope.launch {
                                    authBusy = true
                                    if (!otpSent) {
                                        val res = repository.requestOtp(emailInput)
                                        if (res.isSuccess) {
                                            otpSent = true
                                            Toast.makeText(context, res.getOrNull(), Toast.LENGTH_SHORT).show()
                                        } else {
                                            Toast.makeText(context, res.exceptionOrNull()?.message ?: "Failed", Toast.LENGTH_SHORT).show()
                                        }
                                    } else {
                                        val res = repository.verifyOtp(emailInput, otpInput)
                                        if (res.isSuccess) {
                                            otpSent = false
                                            otpInput = ""
                                            Toast.makeText(context, "Signed in!", Toast.LENGTH_SHORT).show()
                                        } else {
                                            Toast.makeText(context, res.exceptionOrNull()?.message ?: "Invalid code", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                    authBusy = false
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary, contentColor = Color.White)
                        ) {
                            Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(if (otpSent) "Verify Code & Sign In" else "Send Verification Code", fontSize = 12.sp)
                        }
                    }
                }
            }

            // Endpoints & WhatsApp Phone
            item {
                SettingsCard(title = "Integrations") {
                    OutlinedTextField(
                        value = phoneInput,
                        onValueChange = { phoneInput = it },
                        label = { Text("Target WhatsApp Phone") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = gsUrlInput,
                        onValueChange = { gsUrlInput = it },
                        label = { Text("Google Apps Script Web App URL") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        onClick = {
                            repository.setWhatsAppPhone(phoneInput)
                            repository.setGsUrl(gsUrlInput)
                            Toast.makeText(context, "Settings saved", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldDark, contentColor = Color.White)
                    ) {
                        Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Save Integration Settings", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsCard(title: String, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(LightSurface)
            .border(1.dp, LightBorder, RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            content()
        }
    }
}
