package com.onetap.studiotracker.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.LightBackground
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LightSurfaceSubtle
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.ui.theme.liquidBouncyClick
import com.onetap.studiotracker.util.InfographicBitmapRenderer
import com.onetap.studiotracker.util.InfographicPreset
import com.onetap.studiotracker.util.WhatsAppShareManager
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WhatsAppBriefingSheet(campaign: SafarCampaign, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repo = SafarRepository.getInstance()
    val briefingText = remember(campaign) { repo.generateWhatsAppBriefingText(campaign) }
    var isImageMode by remember { mutableStateOf(true) }
    var selectedPreset by remember { mutableStateOf(InfographicPreset.LIQUID_GLASS) }
    var isSendingBot by remember { mutableStateOf(false) }

    val previewBitmap = remember(campaign, selectedPreset, isImageMode) {
        if (isImageMode) InfographicBitmapRenderer.renderCampaignBitmap(campaign, selectedPreset) else null
    }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = LightSurface) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Daily WhatsApp Briefing", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(LightSurfaceSubtle).padding(4.dp)) {
                listOf(true to "Infographic Card", false to "Executive Text").forEach { (img, label) ->
                    Box(
                        modifier = Modifier.weight(1f).clip(RoundedCornerShape(8.dp))
                            .background(if (isImageMode == img) IndigoPrimary else Color.Transparent)
                            .liquidBouncyClick(pressScale = 0.95f) { isImageMode = img }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(label, color = if (isImageMode == img) Color.White else TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (isImageMode) {
                Text("Choose Design Preset", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    InfographicPreset.entries.forEach { preset ->
                        val sel = selectedPreset == preset
                        Column(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (sel) IndigoPrimary else LightSurfaceSubtle)
                                .border(1.dp, if (sel) IndigoPrimary else LightBorder, RoundedCornerShape(12.dp))
                                .liquidBouncyClick(pressScale = 0.94f) { selectedPreset = preset }
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text(preset.label, color = if (sel) Color.White else TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text(preset.tagline, color = if (sel) Color.White.copy(alpha = 0.8f) else TextMuted, fontSize = 10.sp)
                        }
                    }
                }

                previewBitmap?.let { bmp ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(260.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(LightBackground)
                            .border(1.dp, LightBorder, RoundedCornerShape(14.dp))
                            .verticalScroll(rememberScrollState())
                    ) {
                        Image(
                            bitmap = bmp.asImageBitmap(),
                            contentDescription = "Infographic Preview",
                            contentScale = ContentScale.FillWidth,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                Button(
                    onClick = {
                        val file = InfographicBitmapRenderer.generateCampaignInfographic(context, campaign, selectedPreset)
                        WhatsAppShareManager.shareImage(context, file, "📊 *${campaign.name}* (${campaign.overallPercentage}% Delivered)")
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White)
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Share ${selectedPreset.label} to WhatsApp", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
            } else {
                Box(
                    modifier = Modifier.fillMaxWidth().height(210.dp).clip(RoundedCornerShape(12.dp)).background(LightBackground)
                        .border(1.dp, LightBorder, RoundedCornerShape(12.dp)).padding(12.dp)
                ) {
                    Text(briefingText, color = TextPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.verticalScroll(rememberScrollState()))
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = {
                            (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
                                .setPrimaryClip(ClipData.newPlainText("Briefing", briefingText))
                            Toast.makeText(context, "Copied!", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.weight(1f).height(46.dp), shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder)
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp), tint = TextSecondary)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Copy", color = TextPrimary, fontSize = 13.sp)
                    }
                    Button(
                        onClick = { WhatsAppShareManager.shareTextMessage(context, briefingText) },
                        modifier = Modifier.weight(1.3f).height(46.dp), shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Send via WhatsApp", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            OutlinedButton(
                onClick = {
                    if (isSendingBot) return@OutlinedButton
                    scope.launch {
                        isSendingBot = true
                        val res = repo.sendDirectWhatsAppBriefing(campaign)
                        isSendingBot = false
                        Toast.makeText(context, if (res.getOrDefault(false)) "Sent via WhatsApp Bot!" else "Bot dispatch failed", Toast.LENGTH_SHORT).show()
                    }
                },
                modifier = Modifier.fillMaxWidth().height(44.dp),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, LightBorder)
            ) {
                Text(if (isSendingBot) "Dispatching via Bot…" else "Auto-Send via Desktop Bot", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(modifier = Modifier.height(10.dp))
        }
    }
}
